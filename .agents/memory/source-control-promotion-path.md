---
name: Source-control promotion path (Replit main -> GitHub)
description: How a commit made in this Replit workspace actually reaches GitHub; the sanctioned trigger; the silent blocker that stops it.
---

Direct manual push is deliberately disabled: `scripts/sync-to-github.sh` just prints
"Direct GitHub sync is disabled. Use the TypeScript source-control coordinator; it
never stages or creates commits." and exits 78. Do not improvise raw `git push` /
`git fetch` with ad-hoc SSH flags against this repo (that path also risks the
interactive host-key TOFU prompt documented in `git-lfs-prepush-ssh-hang.md`).

The real mechanism is `server/services/source-control-scheduler.ts` +
`source-control-service.ts`, already running in-process inside the normal app
(look for `[SourceControl] Scheduler started` at boot). It polls every 5 minutes
(`SOURCE_CONTROL_POLL_MS`) and also watches a wake file for an immediate retry:

```
ROOT_DIR="$(pwd)"; WAKE_FILE="$ROOT_DIR/.local/source-control-wake"
printf '%s\n' "<actor-name>" > "$WAKE_FILE.tmp.$$" && mv "$WAKE_FILE.tmp.$$" "$WAKE_FILE"
```
(atomic write, matching `scripts/post-merge.sh`; actor name must match `^[a-z0-9][a-z0-9._-]{1,63}$`).

**Why:** a background poller plus a file-based wake signal means promotion can be
verified synchronously (wake, then poll `.local/source-bridge-status.json` and the
newest file in `.local/source-control-operations/`) instead of guessing whether an
async cron-like process picked up a change.

**The silent blocker:** the sync refuses with `state: "dirty"` / "Uncommitted
tracked files prevent automatic source synchronization" if *any* tracked file is
modified and uncommitted — even one completely unrelated to what you're trying to
ship (e.g. an autosave-touched doc/ledger file, or a routine episode-file
integrity restore). Your own commit being clean is not sufficient; `git status
--short` must be fully empty repo-wide before the scheduler will even attempt a
push. Commit unrelated pending autosave drift separately (honest message, not
bundled into your feature commit) rather than waiting for someone else to do it.

**How to apply:** after committing real work on `main`, run `git status --short`;
if anything else is dirty, commit it separately first, then trigger the wake file
and poll the status/operations files above to confirm `state: "synced"` and
`githubSha == replitSha` before telling anyone the change shipped.

**Two independent GitHub-push auth paths, don't conflate their health:** this
in-process scheduler pushes via `source-control-service.ts`'s `withGithubAppAuth`
(mints a fresh GitHub App installation token per call). The separate
`cross-tool-promote` GitHub Actions workflow mints its token differently (via
`scripts/print-github-app-token.ts`) and has been observed 403'ing on push to
`main` while this in-process path succeeded moments later on the same repo/branch.
A failure report about one path is not evidence the other is also broken —
verify each independently before assuming a blanket GitHub App permission outage.

**A third, separate path: the platform's own task-agent merge.** A task agent's
`markTaskComplete` uses Replit's own built-in rebase/merge-to-main mechanism —
neither of the two GitHub-push paths above. Ordinary code-change tasks land fine
through it. But it can fail on a Replit-internal credential specifically for a
task touching deploy-cadence/protected-surface files (e.g. `render.yaml`), while
unrelated tasks keep merging fine in the same window — that's a narrow,
path-specific failure, not a blanket outage. Don't force a manual `git push`/PR
around it as a workaround: that reintroduces exactly the uncoordinated write this
project's whole reconciliation apparatus (dirty-tree check, single scheduler
writer, GitHub App auth) exists to prevent, especially on deploy-sensitive files.
Land the change through the same in-process scheduler path everything else
legitimate uses instead.

## Direct CLI invocation and prepare/record timing

A fourth, direct path exists alongside the wake-file/scheduler flow above:
`npx tsx server/scripts/source-control-cli.ts sync|prepare|record <sha> --actor <name> --machine-readable`
calls the same `SourceControlService` methods synchronously and prints
`SOURCE_CONTROL_RESULT_JSON:{...}` on completion — no wake file or poll loop needed.

`prepare` runs the full validation manifest against the exact candidate SHA
(typecheck, build, `test:ci:unit`, `test:ci:guards`, `test:ci:episodes`,
source-bridge safety, GitHub release safety, sync-guard shell checks)
sequentially. Observed runtime: 15-20+ minutes. This is normal, not a hang —
confirm via `ps -o pid,etimes,cmd -p <pid>` showing rising elapsed time and an
active child test process, not silence.

**How to apply:** launch `prepare`/`record` with ShellExec `run_in_background:
true`, then wait with a small number of long sleeps (200-280s) or one armed
Monitor on the `SOURCE_CONTROL_RESULT_JSON` pattern. Repeated short polls
(every 10-30s) burn round-trips without changing when the result actually
lands.


## Dirty-tree block: isTrackedTreeClean() stops everything, no auto-commit

**Confirmed by direct observation** (merged from the former separate `source-control-dirty-tree-block` topic, which restated this same promotion-pipeline fact without adding independent scope — see `memory-index-rebase-conflicts.md`'s "union duplicates" guidance): `SourceControlService.syncLocked()` calls `isTrackedTreeClean()` before anything else (fetching heads, checking ancestry, etc.). If the tracked tree has uncommitted changes, it returns `state: 'dirty'` immediately and does nothing further — it does not stage, commit, or stash on your behalf.

Two edited-but-uncommitted files once sat through a full app restart; the scheduler's `scheduler-startup` sync ran, hit the dirty check, and returned the same blocked state on every subsequent poll and wake-file nudge until an actor ran `git commit` from the shell. Only after that did the next sync (triggered via the wake file) pick up the new commit SHA and reach `state: 'synced'` with Replit and GitHub converged. "Dirty often self-resolves within a poll or two" (an existing code comment) describes an actor noticing and committing quickly, not the scheduler auto-committing.

**How to apply:** if a sync-status file shows `state: 'dirty'` with error "Uncommitted tracked files prevent automatic source synchronization", the fix is to `git add`/`git commit` the dirty files yourself (normal git, current `git config user.*` identity is fine — no special actor identity needed), then either wait for the next poll or nudge `.local/source-control-wake` for an immediate retry.


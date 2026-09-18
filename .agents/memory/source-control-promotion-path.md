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

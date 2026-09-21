---
name: Git reconciliation — divergence detection, auth, and landing procedure
description: How to tell local/GitHub main have truly diverged, how source-reconciliation-service.ts actually authenticates its git calls, and the exact sequence to land a validated candidate as GitHub's real main.
---

## 1. Detecting true divergence

Local Replit `main` and GitHub `main` are not guaranteed to stay fast-forward-compatible just because the in-process scheduler usually keeps them in sync. If some other path lands commits on GitHub's `main` directly (e.g. a separate branch merged there outside the scheduler's own push), while local Replit also gained its own unpushed commit(s) in the meantime, the result is genuine two-sided divergence: neither side is an ancestor of the other.

**Why:** hit this live — one unpushed local commit plus a merge commit that had landed on GitHub `main` bringing in an unrelated branch's changes. `.local/source-bridge-status.json` correctly reported `state: "diverged"` with `error: "... explicit reconciliation is required"` and refused to auto-merge.

**How to apply:** check `.local/source-bridge-status.json`'s `state`/`error` fields before assuming a commit will sync cleanly — don't infer sync health from git's own `origin/...` remote-tracking ref (it can be stale or point at an unrelated/unauthenticated remote entirely). A "diverged" state is designed to require deliberate reconciliation (the `source-control:reconcile preflight` → `candidate` pipeline), not a plain push — don't force-push or hand-merge around it. `git merge-tree <merge-base> <local> <remote>` is a safe, read-only way to check whether the eventual merge would actually conflict before deciding how to proceed.

## 2. Auth mechanism

`SourceReconciliationService`'s git calls go through `SourceControlService.runReconciliationGit()` → `withGithubAppAuth()`, which mints a fresh GitHub App installation token per call and injects it via `http.extraheader` env vars (HTTPS only). This is the documented, working, preferred mechanism over a repo-wide SSH deploy key — don't wire up SSH for reconciliation; the token path already works and is exercised by the normal scheduler sync too. (An earlier note wrongly assumed no auth wiring existed and speculated about needing an SSH deploy key — reading the actual code and the `withGithubAppAuth` doc comment corrected this.)

**The named HTTPS remote already exists — use it by name, don't pass `origin` or a raw URL.** This repo's `origin` remote is configured as SSH (`git@github.com:...`), which hangs on the interactive host-key prompt (see `ssh-git-hang-pitfalls.md`) even for `reconcile preflight`, because `--remote origin` makes the CLI operate on the SSH remote directly — `withGithubAppAuth`'s `http.extraheader` injection is a no-op for a non-HTTP transport. The pre-configured remote for this purpose is literally named `reconcile-https` (`git remote -v` will show it). Always pass `--remote reconcile-https`.

**`preflight --remote` must be a named git remote, not a raw URL.** `candidate`'s packet validation uses a `ref`-style regex that rejects `://`, so passing an HTTPS URL directly as `--remote` makes `preflight` succeed but guarantees `candidate` fails with "Packet digest envelope is invalid." Add a named remote (`git remote add <name> <https-url>`) and pass its name instead.

## 3. Landing procedure

Once `candidate` reaches `state: candidate_ready` (branch `refs/heads/reconcile/candidate-<fingerprint>`), fast-forward the primary `main` onto that branch (`git merge --ff-only refs/heads/reconcile/candidate-<fingerprint>`) — valid because the candidate is a 2-parent merge whose parents are local's old tip and remote's tip, making it a fast-forward descendant of both. Then run the normal `sync` CLI action (not a raw `git push`): it detects GitHub's tip is now an ancestor of local and pushes fast-forward via the same GitHub App token path, verifying exact equality afterward. Confirm independently with `git ls-remote <remote> refs/heads/main` rather than trusting only the tool's self-reported status.

**If you resolve the divergence yourself first** (a real local `git merge` with both tips as parents, committed), `preflight` reports `state: "safe_fast_forward"` instead of `candidate_ready` — skip `candidate` entirely and go straight to `sync`. Running `candidate` anyway correctly no-ops with `ok: false, error: "Candidate construction is unnecessary because the histories are not divergent."`; that message is informational, not a failure to retry.

**`reconcile candidate --packet <path>` requires the exact canonical file `preflight` already wrote, not a hand-built JSON.** `preflight` persists the full envelope (`{ digest, body }`, `body` = the packet) to `.local/reconciliation-audits/<fingerprint>/preflight.json` as a side effect, and `readPacket()` rejects anything whose resolved path isn't byte-identical to that canonical file (plus a digest recheck). Reconstructing the packet object yourself (even with identical field values, re-serialized) fails with the generic `"Packet digest envelope is invalid."` — always pass the canonical path straight from preflight's own write, never re-derive it.

## 4. Operational hazards during reconciliation

**Live tracked-file writes mid-reconciliation:** episode markdown files (e.g. `docs/episode-*.md`) are actively appended by a running app's autosave/capture watcher. A candidate built cleanly can go stale seconds later if such a file changes underneath it — `sync`'s dirty-tree check will correctly refuse to push until the new content is committed. Never discard or stash that content; commit it as its own normal change (it only grows) and retry.

**`candidate` can report `lease_contended`**, or the live app's own scheduler can report `state: "retrying"` with "Another source-control operation holds the shared lock/lease." This is normal mutual exclusion, not a bug — another concurrent session (a different active Replit Agent conversation on the same repo, or the in-process scheduler's own periodic sync) is mid-operation. Don't loop retrying `candidate` against it; back off and let it clear (the scheduler polls every 5 minutes), or report the state as self-resolving and move on.

**Dozens of `subrepl-<id>` remotes in `git remote -v`, all pointing to `git+ssh://.../home/runner/workspace`, are normal Replit session/checkpoint infrastructure**, not other people's machines or a sign of a security issue. A commit's ref label like `(subrepl-8oh0nbku)` just means it arrived via one of these — often legitimate recent work from another active session on the same project (verify by reading the actual commit: author, message, changed files) before treating it as suspicious.

## 5. Manual resolution when `candidate` refuses (`ordinary` / `append-only-manual` policy kinds)

`candidate()` only ever auto-resolves two narrow policy kinds (`generated-local` mailbox pairs, `canonical-incoming-subset` chat-capture files) via cryptographic/structural proof. Every intersecting path with no policy entry (kind `ordinary`, the manifest's fallback) or an explicit `append-only-manual` policy hard-codes `unclassified_conflict`/manual resolution — this is intentional, confirmed by reading the source, not a bug to work around. There is no CLI subcommand for "manual resolution"; construct it by hand:

1. `git worktree add --detach <path> <localSha>` — isolate from the primary checkout, same pattern `candidate()` itself uses.
2. `git merge --no-commit --no-ff <remoteSha>` in that worktree. Paths untouched by either side's unique commits merge silently; only genuinely-conflicting intersecting paths produce markers.
3. Hand-resolve each conflicted path, `git add` it, then commit (parents end up `[localSha, remoteSha]` — verify with `git rev-parse HEAD^1 HEAD^2`).
4. Validate in the worktree (typecheck at minimum; symlink `node_modules` from the primary workspace rather than reinstalling — worktrees don't get it since it's gitignored).
5. Fast-forward the primary `main` onto the new commit (`git merge --ff-only <newSha>`), then run the normal `sync` CLI action and confirm with `git ls-remote` — same landing procedure as §3, since a hand-built 2-parent merge is indistinguishable from `candidate()`'s own output to `sync`'s ancestor check.

**Before resolving an append-only/index-style file (e.g. `.agents/memory/MEMORY.md`) by just picking one side, prove the other side's unique lines aren't unique data.** A later, more-consolidated version isn't automatically a superset — check every "other side only" entry: (a) does its target file still exist locally at all (if not, was it *deleted* by a local commit, or never present)? (b) `git show <mergeBase>:<path>` — if the file already existed unchanged at the merge-base and is now absent locally, a local commit intentionally deleted it (safe to treat as superseded, e.g. folded into a consolidated entry) rather than lost. Map every "missing" reference to its replacement entry by content, not just by vibes, before dropping it. For plain scripts/docs where one side only adds lines, `diff` showing purely one-directional `<`/`>` hunks (not interleaved changes) is a fast, sufficient proof that one side is a strict superset.

## Same feature landed via two commit paths looks like real divergence

A task-agent's platform merge and a direct in-session commit can both deliver
the *same* feature independently — one hat implements it, commits directly,
and the scheduler pushes it to GitHub; separately, a task agent (forked from
an older base that never saw that push) implements the same work and its
platform merge lands a new commit on local `main`. The result is genuine
two-sided history divergence (`state: "diverged"`, neither side an ancestor
of the other) even though the actual code is byte-identical on both sides.
`reconcile preflight` distinguishes this cleanly: intersecting paths report
matching `local.sha`/`remote.sha` for every file where both sides really did
converge on identical content — only files with a real difference (or an
explicit protected-path policy) block `candidate()`.

**A stale, expired `candidateSha` sitting in `.local/source-bridge-status.json`
for days with a climbing `consecutiveFailures` counter is a sign no one has
run the reconciliation CLI, not evidence the divergence is unresolvable** —
`preflight`/`candidate` work fine against a divergence that's been sitting
for days; there's no time-based decay of the underlying git objects.

## Drizzle `migrations/meta/_journal.json` conflicts from parallel migration numbers

When both sides of a divergence add new Drizzle migrations, `_journal.json`
conflicts even if the migrations themselves don't overlap, because both
sides appended array entries after the same shared tail. `candidate()`
refuses this file unconditionally regardless of mergeability ("No
protected-path policy permits resolution of migrations/meta/_journal.json")
— it's on an explicit no-auto-resolve list, not evaluated for textual
conflict first.

Resolution is mechanical once you check the actual entries: confirm the
lowest-idx entry both sides added is byte-identical (same `tag`, same
`when` timestamp) by diffing each side's full file — if so, one side (the
one with more trailing entries) is a strict superset and you keep it as-is
(`git checkout --ours` or `--theirs` depending on which side has more
entries) rather than hand-splicing the JSON. Verify the corresponding
`migrations/<idx>_<tag>.sql` file is also byte-identical between sides
before trusting the journal-level identity — the journal entry alone
doesn't prove the migration body matches.


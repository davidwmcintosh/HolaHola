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


## Landing a long-blocked push can surface CI-environment-only bugs

## Landing a long-blocked push can surface CI-environment-only bugs

A commit fully validated in Replit's own dev environment and local test runs can still be broken in GitHub Actions CI if the two environments' configured secrets differ (e.g. a provider API key set in Replit but never added as a GitHub Actions secret). If local `main` has been unable to reach GitHub for a while (blocked by divergence, lease contention, or any other reason), every commit added during that window has never actually executed inside GitHub's own CI runners.

**Why:** hit this live — reconciling a multi-day divergence and landing the merge on GitHub triggered the real Actions run for several already-"validated" local commits for the first time. The Windows-specific job (the actual target of that reconciliation) passed cleanly, but an unrelated same-day commit's unit test failed only in Actions with "Gemini API key is not configured" — a route-registration path that eagerly constructed a provider adapter requiring a key neither `AI_INTEGRATIONS_GEMINI_API_KEY` nor `GEMINI_API_KEY` supplied in that CI environment, even though the specific test exercised a Gemini-independent flow.

**How to apply:** after landing a long-blocked reconciliation, watch the real GitHub Actions run to completion rather than trusting the local/dev test suite's prior green result. If something fails there that passed locally, check which side of the divergence (local-only vs remote-only history) actually owns the failing file before assuming your merge conflict resolution caused it — a failure surfacing for the first time is often a pre-existing latent bug in an unpushed commit, exposed by CI-environment differences (missing secrets, different runner OS) rather than anything introduced during reconciliation.


## `candidate` killed mid-run leaves an orphaned worktree, branch, and lease

A hard kill of the reconciliation `candidate()` step (external timeout, not a
graceful return) skips its own cleanup entirely, leaving worktree, branch,
and lease debris pointing at whatever partial state existed at the moment of
the kill. Self-healing this on the next run requires covering every distinct
point a kill can land, not just the obvious "before it started" and "after it
finished" cases:

- Before any branch exists: a bare worktree registration with no candidate
  branch.
- After the branch exists but before the outcome record is written: a branch
  with no matching outcome, which must be verified safe to discard (proven by
  holding the mutation lease — no live process can still own it) rather than
  trusted as-is or left to fail closed forever.
- During worktree creation itself: git holds a brand-new worktree
  registration locked (reason "initializing") until its checkout completes,
  and by design both `remove` and `prune` refuse to touch a locked worktree
  (protecting, e.g., a worktree on removable media). A kill inside that
  narrow window leaves a locked registration that outlives a plain
  remove-then-prune cleanup and makes the next `add` at the same path fail
  outright — easy to miss because it doesn't look like leftover files, it
  looks like a phantom reservation on a path whose directory is already gone.
- After a genuine validation failure already wrote its own outcome record and
  deleted its branch, a bare retry can rebuild the identical branch (the merge
  is fully deterministic from the immutable packet) and be killed again before
  overwriting that record. The stale record's `candidateSha`/parents can then
  coincidentally match the retry's branch tip while its `state` still says
  failure, not success. Only a record whose `state` itself claims a
  completed, validated build may ever be trusted or used to justify a hard
  failure on mismatch; a record that never claimed success has proven nothing
  about any commit and must not gate a rebuild either way. The stale record
  must also be deleted, not just the branch — the outcome write is
  create-exclusive and refuses to overwrite differing content, so leaving it
  in place makes the rebuild crash outright the moment it tries to record a
  genuinely different result.

The lease itself reclaims independently of all of this: a stale lock file
whose owning pid is confirmed dead and whose TTL has expired was already
handled before any of the above existed.

**Why:** hit live Sep 23 2026 during a real reconciliation — an external
timeout killed `candidate()` mid-validation and manual recovery was required
before any self-heal existed. A follow-up review then caught that the first
self-heal fix still missed the locked-mid-`add` case specifically, because
its regression test modeled the kill landing just after `add` completed
rather than during it. A second follow-up review then caught that the
self-heal fix itself could wrongly trust, or wrongly hard-fail on, a stale
*failure* outcome record, because the original mismatch check only compared
identifying fields (fingerprint/SHA/parents) and never checked whether the
record's `state` actually claimed success in the first place.

**How to apply:** when testing or extending kill-recovery for any git
worktree lifecycle, enumerate every phase git itself moves the registration
through (unregistered → locked/initializing → unlocked/active) rather than
just "file exists" vs "file doesn't exist" — a kill can land in any of them,
and the locked phase specifically defeats both `remove` and `prune`
regardless of whether the underlying directory still exists. Never reach for
`--force` to paper over this: an unconditional `unlock` attempt (harmless
when nothing is locked) is the correct non-destructive fix. Separately: when
deciding whether an on-disk outcome/proof record may gate a decision (trust
it outright, or hard-fail when it disagrees with current state), check what
the record's own `state`/status field actually claims before comparing
identifying fields like SHA — a record that never claimed success can't
prove tampering when it disagrees with reality, only a record that did can.


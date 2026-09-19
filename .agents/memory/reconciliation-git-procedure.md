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

## Git add before a pathspec-scoped commit

A commit scoped to one path via `git commit -m "..." -- <path>` only succeeds
if `<path>` is already known to git (tracked, or already staged). For a path
that has never existed in the repository before, it fails with:

    error: pathspec '<path>' did not match any file(s) known to git

**Why:** `git commit -- <pathspec>` performs a "partial commit" of the
worktree state of already-tracked paths matching the pathspec; it is not
equivalent to `git add -- <pathspec> && git commit -- <pathspec>` and does not
pick up a brand-new untracked file. This is easy to miss when writing or
reviewing "commit exactly this one path, never `git add -A`" logic, because
it works fine once the path exists from a prior commit and only breaks on the
very first write to that path — exactly the case a first-sync/bootstrap path
is most likely to hit and least likely to get manually re-tested against.

**How to apply:** any code that converges a single tracked path to new
content and commits it in isolation (working-tree live-sync, scoped
publishers, reconciliation writers) must run `git add -- <path>` immediately
before `git commit -m "..." -- <path>`, even though the commit is already
pathspec-scoped. `git add -- <path>` stages only that one path and stays safe
regardless of what else is staged elsewhere; it never becomes `git add -A`.
Only a test that runs the sync against a brand-new path in a fresh repo
catches this — a test fixture that starts from a repo where the path already
exists from a prior commit will not.


## Use committer date, not author date, for recency filters

A CI/detection script that filters commits by "landed within the last N hours" using git's author date (`%at`/`%ad`) can silently misjudge a commit's age, because author date travels with the commit through rebase, cherry-pick, and `git commit --date=...`, and can be arbitrarily old (or deliberately backdated) even for a commit that just landed in the branch being checked. Committer date (`%ct`/`%cd`) reflects when the commit actually landed in the repository being inspected — a rebase or cherry-pick stamps a fresh committer date even when the author date is preserved from the original authoring time.

**Why:** confirmed via a hermetic regression test — a commit made with `git commit --date <10-years-ago>` (which sets only the author date; git always stamps the committer date with the real current time unless `GIT_COMMITTER_DATE` is also overridden) read as roughly 10 years old under `%at`-based age calculation, but correctly read as "just now" under `%ct`.

**How to apply:** any script answering "did this land recently" — recency-gated CI checks, staleness detectors, "what changed in the last N hours" reports — should use `%ct`/`%cd`, not `%at`/`%ad`, unless there is a specific reason to care about original authorship time rather than landing time.


## SSH hangs in git operations

Two independent ways a git operation can hang forever on an interactive SSH prompt in this environment, even when the push itself targets HTTPS.

### 1. Git LFS pre-push hook can hang mid-HTTPS-push

A `git push https://...` to a repo with Git LFS configured still runs the repo's `pre-push` hook (`git lfs pre-push "$@"`) before the push itself executes. That hook can attempt to negotiate the LFS endpoint in a way that shells out to SSH, producing an interactive host-key confirmation prompt (`The authenticity of host 'github.com' can't be established...`) that hangs indefinitely in a non-interactive shell — even though the push URL actually being used is HTTPS with its own token auth, and even though the commit being pushed contains no LFS-tracked paths at all.

**Why:** observed directly — an explicit HTTPS push authenticated with a GitHub App token hung on an SSH host-key prompt twice. `git config --get-regexp insteadof` showed no URL-rewrite rule, ruling out that explanation, and `git lfs status` confirmed no LFS objects were part of the commit. The hang stopped as soon as the same push was retried with `--no-verify` (skipping the pre-push hook entirely).

**How to apply:** for any scripted/non-interactive git push in a repo that has Git LFS hooks installed, add `--no-verify` when the commit has no LFS-tracked content, and always add `GIT_TERMINAL_PROMPT=0`, `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=5"`, and `< /dev/null` as defense-in-depth so any unexpected prompt fails fast instead of hanging the command until timeout.

### 2. SSH-transport git operations hang without a pre-trusted host key

Any git operation that resolves to an SSH transport (e.g. a remote configured as `git@github.com:...`) hangs indefinitely on an interactive "authenticity of host ... can't be established" prompt if `~/.ssh/known_hosts` has no entry for github.com. `GIT_TERMINAL_PROMPT=0` does NOT suppress this — it silences git's own prompts (e.g. HTTPS credential prompts), not the separate `ssh` binary's host-key confirmation prompt.

**Why:** observed live — a `git fetch origin` / `git merge --ff-only FETCH_HEAD` chain hung 20+ minutes until manually killed, and separately, the reconciliation pipeline's own `preflight` fetch hit the exact same wall.

**How to apply:** run `ssh-keyscan -t ed25519 github.com`, verify the printed fingerprint equals GitHub's publicly documented ED25519 fingerprint (`SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` as of this writing — cross-check docs if it ever looks different), then append the line to `~/.ssh/known_hosts`. This is environment-level, not repo-tracked, so it does not survive a fresh workspace/container and may need repeating there. It only fixes host-key verification — actual SSH authentication (a loaded deploy key) is a separate, independent requirement. In this project specifically, the working reconciliation path avoids SSH entirely by using a named HTTPS remote with GitHub App token auth instead — see `reconciliation-git-procedure.md`.


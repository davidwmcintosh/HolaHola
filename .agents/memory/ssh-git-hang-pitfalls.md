---
name: SSH hangs in git operations — LFS pre-push and host-key pretrust
description: Two independent ways a git operation can hang forever on an interactive SSH prompt in this environment, even when the push itself targets HTTPS.
---

## 1. Git LFS pre-push hook can hang mid-HTTPS-push

A `git push https://...` to a repo with Git LFS configured still runs the repo's `pre-push` hook (`git lfs pre-push "$@"`) before the push itself executes. That hook can attempt to negotiate the LFS endpoint in a way that shells out to SSH, producing an interactive host-key confirmation prompt (`The authenticity of host 'github.com' can't be established...`) that hangs indefinitely in a non-interactive shell — even though the push URL actually being used is HTTPS with its own token auth, and even though the commit being pushed contains no LFS-tracked paths at all.

**Why:** observed directly — an explicit HTTPS push authenticated with a GitHub App token hung on an SSH host-key prompt twice. `git config --get-regexp insteadof` showed no URL-rewrite rule, ruling out that explanation, and `git lfs status` confirmed no LFS objects were part of the commit. The hang stopped as soon as the same push was retried with `--no-verify` (skipping the pre-push hook entirely).

**How to apply:** for any scripted/non-interactive git push in a repo that has Git LFS hooks installed, add `--no-verify` when the commit has no LFS-tracked content, and always add `GIT_TERMINAL_PROMPT=0`, `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=5"`, and `< /dev/null` as defense-in-depth so any unexpected prompt fails fast instead of hanging the command until timeout.

## 2. SSH-transport git operations hang without a pre-trusted host key

Any git operation that resolves to an SSH transport (e.g. a remote configured as `git@github.com:...`) hangs indefinitely on an interactive "authenticity of host ... can't be established" prompt if `~/.ssh/known_hosts` has no entry for github.com. `GIT_TERMINAL_PROMPT=0` does NOT suppress this — it silences git's own prompts (e.g. HTTPS credential prompts), not the separate `ssh` binary's host-key confirmation prompt.

**Why:** observed live — a `git fetch origin` / `git merge --ff-only FETCH_HEAD` chain hung 20+ minutes until manually killed, and separately, the reconciliation pipeline's own `preflight` fetch hit the exact same wall.

**How to apply:** run `ssh-keyscan -t ed25519 github.com`, verify the printed fingerprint equals GitHub's publicly documented ED25519 fingerprint (`SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` as of this writing — cross-check docs if it ever looks different), then append the line to `~/.ssh/known_hosts`. This is environment-level, not repo-tracked, so it does not survive a fresh workspace/container and may need repeating there. It only fixes host-key verification — actual SSH authentication (a loaded deploy key) is a separate, independent requirement. In this project specifically, the working reconciliation path avoids SSH entirely by using a named HTTPS remote with GitHub App token auth instead — see `reconciliation-git-procedure.md`.

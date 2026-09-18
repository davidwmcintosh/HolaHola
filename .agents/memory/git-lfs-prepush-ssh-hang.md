---
name: Git LFS pre-push hook can hang or prompt SSH mid-HTTPS-push
description: A repo-local git-lfs pre-push hook can attempt SSH negotiation and hang on a host-key prompt even when the push itself targets an explicit HTTPS URL with token auth.
---

# Git LFS pre-push hook can hang or prompt SSH mid-HTTPS-push

A `git push https://...` to a repo with Git LFS configured still runs the
repo's `pre-push` hook (`git lfs pre-push "$@"`) before the push itself
executes. That hook can attempt to negotiate the LFS endpoint in a way that
shells out to SSH, producing an interactive host-key confirmation prompt
(`The authenticity of host 'github.com' can't be established...`) that hangs
indefinitely in a non-interactive shell — even though the push URL actually
being used is HTTPS with its own token auth, and even though the commit
being pushed contains no LFS-tracked paths at all.

**Why:** observed directly — an explicit HTTPS push authenticated with a
GitHub App token hung on an SSH host-key prompt twice. `git config
--get-regexp insteadof` showed no URL-rewrite rule, ruling out that
explanation, and `git lfs status` confirmed no LFS objects were part of the
commit. The hang stopped as soon as the same push was retried with
`--no-verify` (skipping the pre-push hook entirely).

**How to apply:** for any scripted/non-interactive git push in a repo that
has Git LFS hooks installed, add `--no-verify` when the commit has no
LFS-tracked content, and always add `GIT_TERMINAL_PROMPT=0`,
`GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=5"`, and `< /dev/null`
as defense-in-depth so any unexpected prompt fails fast instead of hanging
the command until timeout.

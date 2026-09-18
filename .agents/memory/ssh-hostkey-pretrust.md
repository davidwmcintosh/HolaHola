---
name: SSH host-key hang and pre-trust fix
description: git fetch/push resolving to an SSH transport (git@github.com:...) can hang indefinitely on an interactive host-key prompt in this environment; fix is pre-trusting the key.
---

Any git operation that resolves to an SSH transport (e.g. a remote configured as `git@github.com:...`) hangs indefinitely on an interactive "authenticity of host ... can't be established" prompt if `~/.ssh/known_hosts` has no entry for github.com. `GIT_TERMINAL_PROMPT=0` does NOT suppress this — it silences git's own prompts (e.g. HTTPS credential prompts), not the separate `ssh` binary's host-key confirmation prompt.

**Why:** observed live — a `git fetch origin` / `git merge --ff-only FETCH_HEAD` chain hung 20+ minutes until manually killed, and separately, the reconciliation pipeline's own `preflight` fetch would hit the exact same wall.

**How to apply:** run `ssh-keyscan -t ed25519 github.com`, verify the printed fingerprint equals GitHub's publicly documented ED25519 fingerprint (`SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` as of this writing — cross-check docs if it ever looks different), then append the line to `~/.ssh/known_hosts`. This is environment-level, not repo-tracked, so it does not survive a fresh workspace/container and may need repeating there. It only fixes host-key verification — actual SSH authentication (a loaded deploy key) is a separate, independent requirement; see reconciliation-service-auth-gap.md.

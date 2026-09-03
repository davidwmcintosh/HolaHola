---
name: PowerShell pipe corrupts files sent over SSH
description: Get-Content | external-process silently injects a UTF-8 BOM and converts LF to CRLF — broke Node's --env-file parsing entirely when copying .env into a GitHub Codespace via gh codespace ssh.
---

# PowerShell pipe corrupts files sent to a remote shell

## The rule
Never pipe a text file through Windows PowerShell into an external process (`ssh`, `gh codespace ssh`, anything writing the bytes elsewhere) when the receiving side must parse those bytes exactly. PowerShell's default pipeline text encoding for `Get-Content | external-command` adds a UTF-8 BOM at the start and can convert LF line endings to CRLF. Route the same operation through Bash (git-bash/MSYS) instead — its pipes are binary-safe and add nothing.

**Why:**
Copying a local `.env` into a fresh GitHub Codespace with `Get-Content -Raw .env | gh codespace ssh -c <name> -- "cat > .env"` produced a `.env` that `file` reported as `Unicode text, UTF-8 (with BOM), CRLF line terminators` — even though the source file was plain ASCII with no BOM. Node's `--env-file`/`--env-file-if-exists` parser choked on the leading BOM and silently returned every variable as unset (not an error — a quiet, total parse failure). `npm run dev` and `scripts/neon-branch.ts` both failed with "Missing NEON_SHARED_DATABASE_URL" even though `grep` on the remote file showed the variable's line was present with a value.

Re-running the exact same copy through Bash instead (`sed 's/\r$//' .env | gh codespace ssh -c <name> -- "cat > .env"`) produced a clean `ASCII text` file with no BOM, and the variable loaded correctly (verified via `node --env-file=.env -e "console.log(process.env.X)"` before and after).

**How to apply:**
- Any time a file's exact bytes matter for a downstream parser (`.env`, JSON, a script with a shebang), do the transfer through Bash, not PowerShell's `Get-Content | ...` pipeline — even from a Windows machine, since both tools are available side by side in this environment.
- Don't trust `grep`/`cat` output alone to rule out corruption — a BOM at byte 0 doesn't show up when a line-oriented tool prints a later line's content looking fine. Use `file <path>` to check encoding/line-endings directly, that's what actually surfaced this.

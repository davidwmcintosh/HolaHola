Three independent Windows-environment gotchas hit while building HolaHola's Windows-side tooling (Gate 3 executor, coordination-token provisioning, Codespace file transfer). None share a root cause — grouped here only because each is Windows-specific and narrow enough not to warrant its own index line.

## PowerShell pipe corrupts files sent to a remote shell

Never pipe a text file through Windows PowerShell into an external process (`ssh`, `gh codespace ssh`, anything writing the bytes elsewhere) when the receiving side must parse those bytes exactly. PowerShell's default pipeline text encoding for `Get-Content | external-command` adds a UTF-8 BOM at the start and can convert LF line endings to CRLF. Route the same operation through Bash (git-bash/MSYS) instead — its pipes are binary-safe and add nothing.

**Why:** Copying a local `.env` into a fresh GitHub Codespace with `Get-Content -Raw .env | gh codespace ssh -c <name> -- "cat > .env"` produced a `.env` that `file` reported as `Unicode text, UTF-8 (with BOM), CRLF line terminators` — even though the source file was plain ASCII with no BOM. Node's `--env-file`/`--env-file-if-exists` parser choked on the leading BOM and silently returned every variable as unset (not an error — a quiet, total parse failure). `npm run dev` and `scripts/neon-branch.ts` both failed with "Missing NEON_SHARED_DATABASE_URL" even though `grep` on the remote file showed the variable's line was present with a value. Re-running the exact same copy through Bash instead (`sed 's/\r$//' .env | gh codespace ssh -c <name> -- "cat > .env"`) produced a clean `ASCII text` file with no BOM, and the variable loaded correctly.

**How to apply:** any time a file's exact bytes matter for a downstream parser (`.env`, JSON, a script with a shebang), do the transfer through Bash, not PowerShell's `Get-Content | ...` pipeline — even from a Windows machine, since both tools are available side by side. Don't trust `grep`/`cat` output alone to rule out corruption (a BOM at byte 0 doesn't show up when a line-oriented tool prints a later line's content looking fine) — use `file <path>` to check encoding/line-endings directly.

## Generating a random credential on Windows PowerShell (no openssl)

Windows PowerShell (both 5.1 and 7+) has no `openssl` binary by default, so `openssl rand -base64 32` — the usual recipe for a coordination-actor bootstrap token or any other 32+ character random secret — fails with `CommandNotFoundException`. The natural-looking one-line substitute also fails in a confusing way:

```powershell
[Convert]::ToBase64String((New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes(32))
```

`RNGCryptoServiceProvider.GetBytes(byte[] data)` fills an existing array **in place** and returns nothing — it is not the newer `RandomNumberGenerator.GetBytes(int count)` static helper that returns a new array. Passing `32` (an int) where a `byte[]` is expected silently resolves to a call that produces no output, so `ToBase64String` then throws `Value cannot be null. Parameter name: inArray` — the error surfaces on the wrapping call, not the real cause.

**Why:** this is a genuine, repeatable trap for anyone provisioning a new `COORDINATION_*_TOKEN`-style secret from a Windows PowerShell prompt, since neither failure mode is obvious from the error text alone.

**How to apply:** pre-size the array, then fill it:

```powershell
$bytes = New-Object byte[] 32; (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

If that still misbehaves (older execution policy, restricted crypto APIs), a zero-dependency fallback with no namespace resolution risk at all is two concatenated GUIDs, which comfortably clears any 32-character minimum:

```powershell
[Guid]::NewGuid().ToString() + [Guid]::NewGuid().ToString()
```

## Windows console child-process lifetime

Windows delivers `CTRL_CLOSE_EVENT` (same signal family as Ctrl+C/Ctrl+Break) to every process attached to a console when that console's window is closed or its tab is reused for something else. A console child process with no custom handler installed terminates by default on receiving it — silently, no crash dump, no stderr. This hit HolaHola's Gate 3 Windows executor: the launcher PowerShell script started the real work as a child `node` process without detaching it, so closing/reusing the terminal mid-run killed an in-progress run with no trace.

**Why:** `System.Diagnostics.ProcessStartInfo` with `UseShellExecute = $false` (needed to control the child's environment/working directory) makes the child inherit the launcher's console by default unless told otherwise.

**Fix:** set `$startInfo.CreateNoWindow = $true`. This gives the child its own hidden console instead of sharing the launcher's, so the launcher's console closing no longer reaches it. Root file: `scripts/antigravity-gate3.ps1` (`New-ApprovedChild`, `Start-PlainChild`).

**Deliberate non-fix — do not add stdout/stderr redirection as a "belt and braces" companion change.** Piping the child's stdout/stderr back through the launcher's own managed pipe handles recreates the exact coupling `CreateNoWindow` removes: a killed parent closes its pipe handles out from under the child. Keep the child's own console detached and let the launcher report only fixed, non-secret event names — never raw child output — if it needs to signal status.

**How to apply:** any future Windows launcher script in this repo that spawns a long-running child via `ProcessStartInfo` needs `CreateNoWindow = $true` (or equivalent full detachment) before it can be trusted to survive the launcher's own terminal window closing or being reused for another task.


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


## Coordinator V2 host scripts collapse all network failures into one opaque code

`scripts/hola-coordinator.ps1`'s host enrollment/reauthorization functions (`Register-HolaCoordinatorHost`, `Restore-HolaCoordinatorHostCredential`) wrap every `Invoke-RestMethod` call in `try { ... } catch { Fail-Safe '<fixed-code>' }`. `Fail-Safe` discards `$_` entirely and throws a new plain-string exception, so a true network/TLS failure and a legitimate server-side 4xx/5xx rejection (bad fingerprint, idempotency conflict, validation error) both surface to the operator as the exact same generic message (e.g. `hola_coordinator_host_reauthorization_transport`).

**Why:** hit this live diagnosing a real LITTLENEMO reauthorization failure (Sep 30 2026) — the generic error gave zero signal on whether the request even reached the server. Curling the production endpoint directly proved the route was healthy and correctly returning structured 422s for bad input, which narrowed the problem to "something about this specific signed request," not the transport layer itself.

**How to apply:** don't trust the generic code alone. The function persists its fully-built, signed request body to a local DPAPI state file (`host-reauthorization-request.dpapi` / the analogous enrollment file) *before* attempting the network call. Dot-source the script (for its helper functions and script-scope variables like `$RuntimeBootstrapRoot`/`$CurrentUserScope`), `Read-DpapiJson` that file, and manually replay the exact same `Invoke-RestMethod` call *without* a swallowing try/catch — `$_.Exception.Response.StatusCode` and `$_.ErrorDetails.Message` (Windows PowerShell 5.1 populates this reliably for REST error bodies) then reveal the real status and JSON error code. This requires no edits to the reviewed script. In that session the root cause was never conclusively identified — the identical replayed request succeeded immediately after with zero changes, consistent with a one-off transient network blip rather than a real defect. Follow-up tracked to make the script itself surface this detail instead of requiring the workaround.


## PowerShell execution-policy diagnostics

Native PowerShell error classifiers must tolerate wrapped text and must never treat an unrecognized error as proof that a policy restriction is absent. Capture the redacted underlying error before selecting a repair.

**Why:** A real execution-policy rejection split “running scripts is disabled” across lines and reported `SecurityError` / `UnauthorizedAccess` without the literal `PSSecurityException`. A phrase-based classifier consequently returned a false negative and delayed diagnosis.

**How to apply:** Normalize whitespace when classifying captured errors, retain an explicit unknown outcome, and make sanitized process output available when a script exits before its own error handler. Do not change security policy or ACLs based on a negative text match.

## PowerShell null-string binding to .NET

Windows PowerShell can coerce `$null` to an empty string when binding a .NET string parameter. Use `[NullString]::Value` when the method requires a genuine null string; preserve atomic file operations rather than replacing them with delete-then-write sequences.

**Why:** A real Windows test failed during atomic file replacement because the optional backup path was not of a legal form. Changing only that argument from `$null` to `[NullString]::Value` in the temporary adapter made replacement, readback, and cleanup pass.

**How to apply:** Check PowerShell-to-.NET string binding when a valid-path operation fails on an optional null argument. Distinguish successful storage testing under a temporary process execution policy from readiness of a runner that still uses the machine's default policy.

## Native launch evidence

## Native launch evidence must match the delivered invocation

A successful Windows helper test that adds execution-policy flags outside the
production adapter does not verify the delivered client. Verify the client's
default native factory and the complete packaged entry, without patching the
helper or applying policy in an outer wrapper.

**Why:** A real dummy-value DPAPI test passed under a child-only policy while the
actual client still failed before its helper script could execute. Storage
correctness and launch compatibility were separate unproven claims.

**How to apply:** Keep process-only policy authorization separate from permanent
policy changes, respect organizational restrictions, and require native evidence
with owned-scope cleanup before describing a packaged Windows launch as working.

## Downloaded helpers and process policy

Browser download provenance can survive ZIP extraction as a Zone.Identifier
stream on an otherwise byte-identical Windows helper. Child-only RemoteSigned
still rejects that unsigned extracted file. A process-policy option is not a
signature exemption.

**Why:** Native storage worked under approved local test conditions, yet the
unmodified browser-downloaded package failed before script execution. Read-only
policy and alternate-stream inspection distinguished download provenance from
organizational policy. A separately approved, hash-gated one-file trust exception
enabled the actual packaged smoke without changing saved execution policy.

**How to apply:** Diagnose both effective policy scopes and download provenance
before choosing a remedy. Never silently unblock or switch to Bypass. Any manual
trust exception needs explicit authorization and independent hash verification;
success afterward proves only that approved copy, not untouched future downloads.

## Secret-safe child-process capture

Native diagnostic capture must use explicit piped stdio for synchronous child launches. Node's execFileSync can forward child stderr automatically on a failed command when stdio is left implicit, even if the caller catches the exception and only prints an allowlisted report.

**Why:** A secret-safe outer failure handler does not protect against a child-process API forwarding raw diagnostics before that handler runs. Arbitrary helper output may contain store data or credentials.

**How to apply:** Audit the subprocess boundary as well as the final serializer. Keep fixed-category reporting separate from captured child output, require positive evidence before classifying a security restriction, and leave unrecognized failures explicitly unknown. This is not authority to change policy or unblock a downloaded file.

## Windows PowerShell compression assemblies

Windows PowerShell may not expose compression types transitively when only the FileSystem assembly is loaded. Load the core compression assembly explicitly as well, and resolve required types before creating an output file.

**Why:** A real Windows session accepted the FileSystem assembly load but failed to resolve ZipArchive after opening the destination. Assembly availability must be checked before filesystem side effects, not inferred from a related assembly.

**How to apply:** Preflight all required .NET types in Windows instructions before opening outputs. Preserve failed outputs and use a fresh create-new destination rather than silently overwriting or deleting them.

## Execution policy after a new PowerShell session

A Process-scope execution-policy adjustment does not persist into a new PowerShell session. Windows recovery instructions must check the current policy scopes before loading the launcher, rather than assuming an earlier temporary adjustment remains effective.

**Why:** A repeated launcher-loading failure was caused by effective Restricted policy despite a verified source hash and no download-zone marker. Earlier session-only adjustments did not establish a permanent host configuration.

**How to apply:** Run read-only policy checks first. If no Group Policy restriction is shown, verified local source with no download-zone marker may use Process-scope RemoteSigned only after explicit approval for that adjustment. Do not infer authority for Bypass, permanent policy changes, file unblocking, or credential approval.


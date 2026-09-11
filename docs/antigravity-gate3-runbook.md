# Windows Antigravity Gate 3 operator runbook

The Gate 3 driver is `server/scripts/coordination-runtime-antigravity.ts`.
Use only the operator-approved worktree
`C:\Users\David\HolaHola-antigravity` on branch `luca/gemini-experiment`.

Windows PowerShell 5.1 is sufficient; no external credential manager is
required. The fixed-action launcher generates the bootstrap internally,
protects it with Windows DPAPI `CurrentUser`, and stores only ciphertext under
`%LOCALAPPDATA%\HolaHola\coordination\`. Never place the plaintext bootstrap in
PowerShell history, an argument, stdout, a file, the repository, or the
clipboard.

After the worktree is clean at the exact protected-promotion commit, initialize
the local credential once:

```powershell
Set-Location C:\Users\David\HolaHola-antigravity
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\antigravity-gate3.ps1 initialize
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\antigravity-gate3.ps1 status
```

Initialization fails rather than overwriting an active or in-flight
credential. Preparation decrypts only in memory, hashes the value in the
existing TypeScript process, and prints only the public provisioning bundle:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\antigravity-gate3.ps1 prepare `
  -StartingCommit <SYNCED_MAIN_SHA>
```

Transfer only that public JSON bundle to the trusted Replit operator. Replit
runs Phase A, the founder approves the exact challenge in an authenticated
session, and Replit runs Phase B:

```bash
npx tsx server/scripts/provision-antigravity-runtime.ts phase-a --bundle <PUBLIC_BUNDLE.json> --attempt-id <NEW_UUID>
npx tsx server/scripts/provision-antigravity-runtime.ts phase-b \
  --bundle <PUBLIC_BUNDLE.json> \
  --challenge-id <FOUNDER_APPROVED_CHALLENGE_ID>
```

Generate a new lowercase UUID for each intentional Phase A attempt. Reuse that
same UUID only when retrying the same attempt so retries converge on one
challenge.

Phase B returns only non-secret IDs and digests. After it succeeds, configure
the non-secret run inputs on Windows and launch the bounded driver through the
same fixed-action DPAPI launcher:

```powershell
$env:COORDINATION_API_BASE_URL = "https://<approved-coordinator>"
$env:COORDINATION_RUNTIME_ID = "<registered-runtime-id>"
$env:COORDINATION_WORKTREE = "C:\Users\David\HolaHola-antigravity"
$env:COORDINATION_WINDOW_ID = "<frozen-window-id>"
$env:COORDINATION_OWNERSHIP_RECEIPT_ID = "<active-receipt-id>"
$env:COORDINATION_OWNERSHIP_ARTIFACT_SHA256 = "<approved-task-artifact-sha256>"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\antigravity-gate3.ps1 run
```

`COORDINATION_ASSIGNMENT_EVENT_ID` and `COORDINATION_RECEIPT_FILE` are optional
non-secret inputs. The driver exchanges the bootstrap once, deletes its process
environment entry, renews broker credentials in memory, and never places
credentials in command arguments, files, or receipts.

The `run` action atomically consumes the active local ciphertext before it
starts the driver and deletes the in-flight ciphertext after the attempt. A
second run is rejected. If the driver fails after local consumption, create a
fresh bootstrap and repeat the founder-approved provisioning flow; never replay
an uncertain bootstrap.

Trusted Phase B provisioning runs as one transaction in registration → profile
→ receipt → challenge row order. Ownership failure rolls back the registration
and profile. Protected executor and verifier operations acquire the credential
advisory lock, then hold registration → profile → credential → receipt →
challenge → grant through the mutation.

Task **#1448 resume sequence**: confirm the operator-approved runtime, worktree,
branch and starting HEAD; obtain a fresh frozen window and its non-secret IDs;
confirm the protected secret handoff; then run the bounded driver. Do not reuse
a stale claim, packet, receipt, epoch, or bootstrap exchange. A separate
verification hat must inspect and rerun the result; this driver never verifies
or publishes.

Linux validation checks the launcher source boundary and documentation. It
does not prove that DPAPI executed on Windows. The actual DPAPI, ACL,
PowerShell 5.1, atomic-consumption, and no-secret-output evidence must come from
this approved Windows host. That evidence does not establish containment
against malicious software already running as the same Windows user.
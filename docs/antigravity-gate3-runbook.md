# Windows Antigravity Gate 3 operator runbook

The Gate 3 driver is `server/scripts/coordination-runtime-antigravity.ts`.
Use only the operator-approved worktree
`C:\Users\David\HolaHola-antigravity` on branch `luca/gemini-experiment`.

The Antigravity-only 1Password item must expose its bootstrap through an
`op://...` reference named `COORDINATION_RUNTIME_BOOTSTRAP_TOKEN`. Never place
the token value itself in PowerShell history, an argument, stdout, a file, or
the repository. Preparation reads the injected value, hashes it in memory, and
prints only the public provisioning bundle:

```powershell
$env:COORDINATION_RUNTIME_BOOTSTRAP_TOKEN = "op://<approved-vault>/<approved-item>/<approved-field>"
op run -- npx tsx server/scripts/prepare-antigravity-provisioning.ts --starting-commit <SYNCED_MAIN_SHA>
```

Transfer only that public JSON bundle to the trusted Replit operator. Replit
runs Phase A, the founder approves the exact challenge in an authenticated
session, and Replit runs Phase B:

```bash
npx tsx server/scripts/provision-antigravity-runtime.ts phase-a --bundle <PUBLIC_BUNDLE.json>
npx tsx server/scripts/provision-antigravity-runtime.ts phase-b \
  --bundle <PUBLIC_BUNDLE.json> \
  --challenge-id <FOUNDER_APPROVED_CHALLENGE_ID>
```

Phase B returns only non-secret IDs and digests. After it succeeds, configure
the non-secret run inputs on Windows and launch the bounded driver through
1Password:

```powershell
$env:COORDINATION_API_BASE_URL = "https://<approved-coordinator>"
$env:COORDINATION_RUNTIME_ID = "<registered-runtime-id>"
$env:COORDINATION_WORKTREE = "C:\Users\David\HolaHola-antigravity"
$env:COORDINATION_WINDOW_ID = "<frozen-window-id>"
$env:COORDINATION_OWNERSHIP_RECEIPT_ID = "<active-receipt-id>"
$env:COORDINATION_OWNERSHIP_ARTIFACT_SHA256 = "<approved-task-artifact-sha256>"
op run -- npx tsx server/scripts/coordination-runtime-antigravity.ts
```

`COORDINATION_ASSIGNMENT_EVENT_ID` and `COORDINATION_RECEIPT_FILE` are optional
non-secret inputs. The driver exchanges the bootstrap once, deletes its process
environment entry, renews broker credentials in memory, and never places
credentials in child processes.

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
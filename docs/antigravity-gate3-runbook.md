# Windows Antigravity Gate 3 operator runbook

The Gate 3 driver is `server/scripts/coordination-runtime-antigravity.ts`.
Run it from the operator-approved `HolaHola-antigravity` worktree (PowerShell):

```powershell
$env:COORDINATION_API_BASE_URL = "https://<approved-coordinator>"
$env:COORDINATION_RUNTIME_ID = "<registered-runtime-id>"
$env:COORDINATION_WORKTREE = "C:\approved\HolaHola-antigravity"
$env:COORDINATION_WINDOW_ID = "<frozen-window-id>"
$env:COORDINATION_BOOTSTRAP = "<protected-secret-interface-value>"
npx tsx server/scripts/coordination-runtime-antigravity.ts
```

The bootstrap is **not generated yet**. It must be handed off through the
operator-approved protected Windows secret interface, never as an argument,
file, prompt, or log value. Do not register or provision a runtime as part of
this run. The driver exchanges it once, renews broker credentials in memory,
and never places credentials in child processes.

Paused **#1448 resume sequence**: confirm the operator-approved runtime,
worktree, branch and starting HEAD; obtain a fresh frozen window and its
non-secret IDs; confirm the protected secret handoff; then resume with the
same bounded driver. Do not reuse a stale claim, packet, receipt, epoch, or
bootstrap exchange. A separate verification hat must inspect and rerun the
result; this driver never verifies or publishes.
# Antigravity Windows DPAPI Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-11-antigravity-windows-dpapi-design.md`

## Goal

Replace the Gate 3 Windows 1Password launch dependency with a PowerShell 5.1-compatible, DPAPI `CurrentUser` bootstrap lifecycle while preserving all existing coordinator, founder-approval, task, and execution boundaries.

## Steps

1. Add a fixed-action PowerShell launcher with `initialize`, `prepare`, `run`, and `status`.
2. Generate the bootstrap internally and persist only a versioned DPAPI ciphertext envelope under `LOCALAPPDATA`.
3. enforce current-user ownership, protected ACLs, approved paths, no reparse points, and atomic active-to-in-flight consumption.
4. Construct a minimal child environment and hardcode the existing preparation and bounded-driver commands.
5. Add a cross-platform static guard that proves source-level constraints without claiming Windows DPAPI execution.
6. Register the guard in local validation and canonical CI.
7. Replace the 1Password-specific Windows instructions and reconcile the prior Gate 3 design/plan.
8. Update handoff and batch records.
9. Run focused tests, typecheck, registered validation, consolidated CI, system health, independent review, and protected promotion.
10. On the approved Windows host, run the genuine PowerShell 5.1/DPAPI proof before resuming task #1448.

## Non-Goals

- No coordinator protocol or schema changes.
- No arbitrary command execution.
- No fixed Windows Luca credential.
- No claim of adversarial same-user Windows containment.
- No claim that Linux CI executed DPAPI.
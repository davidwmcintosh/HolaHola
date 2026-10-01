## The rule
After a founder republishes a Coordinator V2 runtime release (e.g. to pick up a source fix), an already-enrolled Windows host does NOT need any DPAPI state cleared. Retry is just:

```powershell
. .\scripts\hola-coordinator.ps1
Initialize-HolaCoordinatorRuntime -Endpoint '<endpoint>'
Invoke-HolaCoordinator -TaskRef <ref> -Format json
```

Never delete `host-material.dpapi` or `host-private-key.dpapi` — these are the enrolled host identity/key; deleting them forces unnecessary re-enrollment. The request/ack files (`runtime-bootstrap-request.dpapi`, `runtime-bootstrap-ack.dpapi`) are self-managed by the launcher (expired pending manifests are rotated automatically); they are not an operator cache-clear target either.

**Why:** `Assert-ExecutionHost` in scripts/hola-coordinator.ps1 fails closed (`runtime_ack_binding_invalid`) on any mismatch between the local ack's release/manifest/source binding and the newly published manifest, and checkout HEAD/tree must match too — so stale local state is caught and rejected, not silently reused. But the fix for that mismatch is re-running `Initialize-HolaCoordinatorRuntime` (a new release never auto-upgrades an already-initialized host), not deleting local credential state. The human recovery runbook (docs/coordination-v2-recovery-runbook.md) confirms: recovery always starts from re-invoking with the same TaskRef and letting the server reconcile durable state — never by hand-editing or deleting local identifiers.

**How to apply:** Before telling an operator to clear any Windows-side state for a Coordinator V2 retry, check this file first. The only other prerequisite is that the Windows checkout's git HEAD/tree actually matches the newly promoted commit (pull first).


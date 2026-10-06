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


## Expired replay: approved recovery policy, not an implemented workaround

The founder-approved recovery policy permits bounded client-managed rotation
after retaining an expired replay as unverified evidence under DPAPI. This is
not authority to install, acknowledge, trust, or execute from expired evidence.
Keep the old binding and one durable successor so response-loss retries do
not invent another generation. A well-formed invalid expired signature may
trigger only a new authenticated issue; fresh installation still requires
every existing signature, expiry, source, artifact, ACL, and trust check.

**Why:** An idempotent request can exist on the server while its issue ID was
never saved locally. Ordinary saved-issue rotation does not resolve that
failure class. The policy explicitly accepts bounded discard/issue-volume
risk without granting installation trust.

**How to apply:** Do not present the approved design as already implemented.
Recovery remains automatic client policy, never an operator instruction to
clear DPAPI or supply a replacement key. Implementation and native synthetic
fixtures require separate authorization and fresh exact-source and runtime
publication gates before any changed launcher is exercised on Windows. See
the reviewed expired-bootstrap recovery design and its separate founder
approval record under docs/superpowers.


Two registrations with the identical display name ("Luca [Claude Code] cloud") existed for
actor luca-claude-code: `luca-claude-code-cloud` and `luca-claude-code-cloud-2026-09`,
created about 24 minutes apart -- matching the naming convention
docs/coordination-clients.md itself uses for staged rotation examples (`<id>-2026-09`).

That similarity is not proof of a tracked rotation pair. The newer registration's audit
trail showed a plain `runtime_registered` event, not `rotation_started` -- it was
provisioned as a fresh, standalone registration (via coordination-runtime-bootstrap.ts,
after the older one's exchange kept failing), never through
`coordination-runtime-rotation.ts stage`. Calling `rotation-ready` with the older ID as
`sourceRuntimeId` would have failed: that endpoint only succeeds for the exact
source/replacement pair a `stage` operation actually recorded.

Always query `coordinationCredentialAuditEvents` for both candidate runtime IDs and look
for `rotation_started`/`rotation_ready`/`rotation_completed` before treating name or
timing similarity as evidence of a staged pair.

Separate gap surfaced by the same incident: the abandoned old registration's one issued
credential was never used and is long expired, so it is a safe dead end needing no
rotation cleanup -- but there is currently no CLI action that formally disables a
standalone (never-staged) registration. reissue/stage/complete/rollback don't cover it;
see task "Let operators retire an abandoned standalone runtime registration".


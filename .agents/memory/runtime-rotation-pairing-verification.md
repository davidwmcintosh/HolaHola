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

Separate gap surfaced by the same incident, now closed: a standalone (never-staged)
registration with a dead credential had no CLI action to formally disable it --
reissue/stage/complete/rollback don't cover it. `coordination-runtime-rotation.ts disable
--runtime-id <id>` now fills this gap (server/services/coordination-credential-broker.ts's
`disableCoordinationRuntimeRegistration`). Its guard ordering matters: not-found ->
already-disabled -> **active-staged-rotation membership, checked as either source OR
replacement** -> live/unexpired/ever-used credential. The active-rotation check is not
redundant with the credential check -- a freshly-staged replacement has zero credentials
of its own yet, so only the rotation-membership guard stops an operator from disabling it
out from under an in-flight rotation.


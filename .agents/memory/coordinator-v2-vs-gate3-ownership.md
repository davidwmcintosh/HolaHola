---
name: Coordinator V2 vs legacy Gate3 task-ownership
description: two separate founder-authorization systems exist; the Command Center Ownership tab belongs to the legacy one, not V2 launch/resume.
---

The Command Center's "Task ownership" tab (client/src/components/admin/TaskOwnershipTab.tsx,
server/services/founder-task-ownership-service.ts, server/routes/founder-task-ownership-routes.ts)
is a real, working, deployed founder-approval UI — but it authorizes a separate legacy Gate3
system (challenge -> receipt -> proof-of-possession -> Gate3ProofGrant), whose only live consumer
is the older coordination-runtime-routes.ts HTTP subsystem. It is NOT wired into the current
Coordinator V2 lifecycle (coordination-v2-cli.ts -> coordination-v2-http-factory.ts ->
coordination-lifecycle-facade-service.ts). V2 launch/resume never checks taskOwnershipReceipts.

**Why:** docs/antigravity-gate3-runbook.md explicitly and repeatedly states the historical
Gate3 receipts/grants cannot authorize a V2 session. The codebase still wires
coordination-runtime-antigravity.ts's Gate3Executor into the V2 factory, but only as a local
*operation-execution* adapter, not as an authorization gate. Two systems sharing vocabulary
("Gate3", "challenge", "receipt", "founder approval") are easy to conflate.

**How to apply:** for founder approval of a real Coordinator V2 Windows run, the load-bearing
requirements are an approved coordinationV2PolicyVersions row + a valid coordinationV2OperatorGrants
row with `launch` (coordination-lifecycle-facade-service.ts), NOT anything in
taskOwnershipChallenges/Receipts. Don't assume a screen labeled "founder approval" is relevant to
a V2 run just because of the label — verify which subsystem it actually calls into first.

Related facts from the same investigation, all evidence-checked (Sep 18 2026):
- Register-HolaCoordinatorHost's -FounderApprovalUrl opens a real, working page — but it's
  server-rendered HTML directly from server/routes/coordination-v2-host-admin-routes.ts
  (GET /api/coordination/v2/host-enrollment-requests/:id returns an HTML form posting to
  .../approve), not a client/src React page. Searching client/src for it finds nothing; that's
  expected, not a gap.
- A V2 policy's hostConstraints.windowsPublicMaterialDigest is not a hash of any static repo
  file. It's SHA-256 over a sorted map of {artifact-name + NUL + raw bytes + NUL} pairs for
  exactly two artifacts (the task artifact and a generated coordinator-config.json), computed by
  coordination-v2-preparation-material-service.ts and reproduced by
  computeCoordinationPublicMaterialDigest in coordination-windows-prepare.ts. It depends on
  already-materialized runtime data (DB policy + published promotion), so it cannot be
  hand-computed from repo files alone, and no standalone CLI was found to compute it ahead of time.
- The lifecycle facade's "production verification" gate is concrete: it requires a `published`
  row in coordinationV2SourcePromotions matching the task's repositoryIdentity. Ordinary
  source-control-scheduler promotion does NOT create this row. The only path found is a
  separately-gated "M13 backfill" script (coordination-v2-backfill-promotion.ts) requiring a
  "protected worktree" plus pinned env vars (COORDINATION_V2_PROTECTED_WORKTREE,
  COORDINATION_V2_PROTECTED_RECEIPT_PATH, COORDINATION_V2_ALLOW_M13_BACKFILL=1) not found
  configured anywhere searched in this Repl — likely meant to live on a separate protected
  host outside the Replit workspace, consistent with the Gate3 secret-minimal-host design.

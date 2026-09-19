---
name: Coordinator V2 real-run readiness (windowsPublicMaterialDigest bug)
description: current state of what a real Invoke-HolaCoordinator Windows run needs — what's already done, what's a normal remaining step, and one blocking self-referential-hash bug.
---

Checked directly against the live database on Sep 18 2026 (not just code — code alone was
misleading here):

- Host enrollment: DONE. One active coordination_v2_host_enrollments row exists — a real
  Windows machine enrolled ~Sep 15 2026 via Register-HolaCoordinatorHost + founder browser
  approval. The enroll+prove flow works end-to-end. This is live state, not a code fact —
  re-query the table rather than assuming it's still true.

- Source-promotion recording (the "production verification" gate) is a real, working,
  already-in-regular-use mechanism, not missing infrastructure. It is NOT automatic: a
  deploy/publish alone only runs the source-control-scheduler's sync, which does not
  itself record a coordinationV2SourcePromotions row. Recording requires a separate,
  explicit, authenticated admin call (gated by SOURCE_PROMOTION_TOKEN) made after the
  exact commit is actually published (Render release or Replit publish evidence). Many
  real published rows already exist from ordinary operation. Do not confuse this live
  admin-record flow with server/scripts/coordination-v2-backfill-promotion.ts, which is a
  separate one-time historical-backfill script gated by COORDINATION_V2_ALLOW_M13_BACKFILL
  — that script is not the normal path.

- Policy authoring has real founder-session-gated HTTP routes for the full lifecycle:
  create a draft policy identity+version, founder-approve a version, issue an operator
  grant. This doesn't need to be built; it needs correct payloads called from an
  authenticated founder browser session (same pattern as host-enrollment approval).

**Blocking bug found, never yet exercised (zero policy rows have ever existed in the DB):**
hostConstraints.windowsPublicMaterialDigest, as required by the current preparation
verification path, cannot be satisfied by ANY value. The value placed in a policy's
hostConstraints gets embedded (via the generated coordinator-config.json) into the exact
byte stream that publicMaterialDigest is computed over, and preparation then rejects
unless the freshly-computed digest equals that same stored value. That demands a SHA-256
fixed point (D = H(...D...)) — cryptographically infeasible by construction. No missing
step or tool produces a working value; none can exist under the current code.

**Why:** confirmed by direct trace of buildCoordinationV2PublicConfig +
issueCoordinationV2PreparationEnvelope (coordination-v2-preparation-material-service.ts)
and canonicalizePolicy's boundedMap handling of hostConstraints
(coordination-policy-canonicalization.ts) — hostConstraints (including
windowsPublicMaterialDigest) is embedded verbatim into the canonical policy, which is
embedded verbatim into the config JSON, which is hashed together with the task artifact
to produce the very digest that must match it.

**How to apply:** don't spend time hand-computing or guessing a windowsPublicMaterialDigest
value — none can work. Fix the circularity in code first (most likely: exclude
windowsPublicMaterialDigest specifically from what gets embedded into the hashed config,
while still enforcing it as a separately pinned check elsewhere), with the same
evidence/review rigor the rest of Coordinator V2 uses (negative test proving the old
impossible requirement is gone, positive test proving a real value now verifies) before
any real policy is authored.

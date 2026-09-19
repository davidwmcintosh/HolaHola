---
name: Coordinator V2 real-run readiness
description: current state of what a real Invoke-HolaCoordinator Windows run needs — what's already done, what's a normal remaining step, and the fixed digest-circularity bug that used to block it.
---

Checked directly against the live database on Sep 18 2026 (not just code — code alone was
misleading here):

- Host enrollment: DONE. One active coordination_v2_host_enrollments row exists — a real
  Windows machine (LITTLENEMO) enrolled ~Sep 15 2026 via Register-HolaCoordinatorHost +
  founder browser approval. The enroll+prove flow works end-to-end. This is live state, not
  a code fact — re-query the table rather than assuming it's still true.

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

**Digest-circularity bug: FIXED Sep 18 2026 (was blocking, zero policy rows had ever
existed in the DB before the fix).** `hostConstraints.windowsPublicMaterialDigest` used to
be embedded verbatim into the canonical policy, which was embedded verbatim into
`coordinator-config.json`, which was then hashed together with the task artifact to
produce the very `publicMaterialDigest` the field was supposed to equal — a SHA-256 fixed
point (D = H(...D...)), cryptographically infeasible by construction. No value could ever
satisfy it.

Fix (`server/services/coordination-v2-preparation-material-service.ts`,
`withoutSelfReferentialDigest()`): the policy view that gets embedded/hashed into
`coordinator-config.json` now has `hostConstraints.windowsPublicMaterialDigest` stripped
out before canonicalization, so the config's own bytes no longer depend on that field's
value at all. The field is still fully real and enforced — just as a separate pinned
comparison at the reserve/prepare call sites, never as an input to the hash it's compared
against. The outer `policyDigest`/`canonicalPolicy` returned by
`buildCoordinationV2PublicConfig` (the authoring-vs-preparation consistency check
`policyRow.policyDigest !== materialConfig.policyDigest`) is unaffected — it's still
computed from the complete, real policy including the real digest value, matching what
`coordination-policy-service.ts` stores at authoring time. Verified: no other code reads
the config's embedded `policyDigest` field or `hostConstraints.windowsPublicMaterialDigest`
back out of the delivered config JSON, so the redaction has no other consumers to update.

Proven by `server/scripts/test-coordination-v2-authority-seams.test.ts` ("windowsPublicMaterialDigest
is excluded from the hashed config, breaking the fixed-point cycle"): two policies
differing only in the pinned digest value produce byte-identical config (proves the cycle
is broken), and a founder-computed real digest (via `computeCoordinationPublicMaterialDigest`
from `coordination-windows-prepare.ts`, run against the actual delivered config) round-trips
correctly (proves a working value now exists and is stable).

**Founder digest-discovery tool: now exists.** A founder no longer has to guess
`windowsPublicMaterialDigest` and read `V2_PREPARATION_PUBLIC_DIGEST_MISMATCH` off server
logs. `server/scripts/coordination-v2-public-material-digest.ts` takes `--task-ref`,
`--promoted-commit-sha`, `--exact-tree-sha`, and `--policy <file>` and prints the exact
value the server will require, using the same `buildCoordinationV2PublicConfig` +
`computeCoordinationPublicMaterialDigest` computation as preparation time. It resolves the
task artifact via the same DB-free `FixedRootCoordinationTaskMetadataRegistry` production
already uses (requires a clean git tree and a matching `GITHUB_REPO_URL`, so it fails
closed mid-edit or outside a real checkout — this is the same registry, not a CLI-only
restriction). `--help` documents the full compute → author → approve → grant sequence.

**How to apply:** the digest field is safe to author into a real policy now — run
`coordination-v2-public-material-digest.ts` to get the value (or call
`buildCoordinationV2PublicConfig` + `computeCoordinationPublicMaterialDigest` directly)
rather than guessing or hand-waving a placeholder into production policy rows. Calling the
founder-session-gated HTTP routes to actually create/approve/grant the policy is still the
remaining real step — that part was already built, just needed the correct payload value.

**Task-artifact production resolution: FIXED (Sep 19 2026, was blocking every launch).**
`FixedRootCoordinationTaskMetadataRegistry` reads `.local/tasks/task-<ref>.md` from local
disk with `process.cwd()` as root. `.local/` is gitignored, so that file never exists on any
deployed server's filesystem — every production launch failed task-artifact resolution
(`TASK_METADATA_UNSUPPORTED`) regardless of how many times the app was republished. Fix: a
new `PostgresCoordinationTaskMetadataRegistry` (own file, `../db`-importing, kept out of the
DB-free `coordination-task-metadata-service.ts` so the offline digest CLI above keeps working
with no database connection available) is now the registry every real production call site
uses via an explicit `taskMetadataRegistry` dependency override — both host-lifecycle and
session-lifecycle routes, wired in `server/routes.ts`. Same hash/digest verification as
before (sha256 artifact check, public-material-digest check) applies unchanged; the Postgres
registry is a drop-in implementation of the same registry interface. A real pre-existing bug
was found and fixed alongside this: `reserveCoordinationLifecyclePreparation` (the
host-lifecycle reservation path) silently ignored a `taskMetadataRegistry` override and always
used the DB-free default — the Postgres wiring in `routes.ts` would have had zero effect on
the live host route without that fix.

**Remaining real step for this blocker specifically:** the Postgres table only has rows for
tasks someone has explicitly published into it. Publishing still goes through the *existing*
`coordination-v2-publish-task-artifact.ts` CLI (unchanged) from a workspace that has the real
`.local/tasks/task-<ref>.md` file and a clean, matching git tree — that CLI writes the bytes
into the shared DB once, from an authorized workspace, rather than requiring every deployed
server to have the file locally. This is a real per-task, one-time, post-merge operator action,
not something a code change can automate away (the whole point is that the artifact's
authenticity is tied to an authorized workspace producing it under clean git provenance).

> **Historical document recovered on 2026-10-03.** The original task document
> is preserved below from the checksum-verified export. Recovery is not evidence
> of independent implementation approval, publication, or a live cutover.
>
> **Current implementation takes precedence over the historical wording:**
> - `attest()` rejects an existing active attestation; it is not an idempotent
>   replay operation. Invalidate an expired active record before re-attesting.
> - `invalidate()` replays require the same actor and reason. `consume()`
>   replays require the same actor and action, and still check expiry and fresh
>   live consensus against the original commit and digest.
> - The committed schema uses a `varchar` primary key with a generated UUID
>   default, `varchar` digest fields, and `timestamp` columns, not the proposed
>   UUID/char/timestamptz types described below.
> - This is an attestation mechanism, not a deploy freeze. A recorded decision
>   remains attributable, but a changed live release blocks consumption.
>
> See `docs/task-1460-reconciliation-2026-10-03.md` for reconciliation evidence.

---

# Release Cutover Attestation

## Problem

Render's `autoDeploy: true` rebuilds and republishes on every push to `main`,
regardless of content. Confirmed empirically 2026-09-17: a commit touching
only `.agents/memory/` became the exact commit reported by `/health/release`
on `getholahola.com`, `render.getholahola.com`, and the raw
`holahola-6f1o.onrender.com` origin within about an hour, with no explicit
deploy step run by anyone.

`/health/release` therefore always answers "what is live right now" — a value
that keeps moving on its own schedule, independent of any human decision
cadence. A cutover decision (attest commit X as the verified release, then
act on it) needs that answer to hold still for the length of a decision loop
(minutes to hours). Re-querying `/health/release` live at each step of that
loop cannot do this by construction. Task #1453 hit exactly this: by the time
its prompt was read, the live commit had already moved past both options it
presented.

This is a different failure than the two existing Render specs already fix.
The 2026-09-16 evidence design re-verifies release identity immediately
before appending source-promotion authority — a correct, narrow fix for that
one code path's own sub-second race; it must stay exactly as is. The
2026-09-17 snapshot design fixes Render's inability to fetch its own source.
Neither holds an answer still across a human-paced window, and neither should
be changed to try.

## Design: Release Cutover Attestation

An explicit, immutable-until-consumed record answering "what did every
independently-checked release endpoint agree the live commit was, at the
moment someone captured it, for this specific decision" — captured once, then
read by both the human-facing decision text and the eventual cutover action,
instead of either re-querying `/health/release` live. This is option (b) from
task #1460: a marker that cutover logic reads instead of re-querying mid
decision.

Option (a), pinning/freezing deploys, is rejected. `source-control-scheduler.ts`
is only the Replit-to-GitHub sync path; this project's coordination
architecture has multiple independent actors (`COORDINATION_ACTOR_IDS`:
`luca-holahola`, `luca-replit`, `luca-claude-code`, `luca-gemini`, `alden`,
`daniela`, `david`) that can plausibly advance `main` through other channels.
A freeze scoped to one scheduler would be a false sense of safety, and a
repo-wide freeze (branch protection, pausing Render) is a bigger, riskier
lever than this gap needs. An attestation is correct regardless of how many
paths can move `main`.

### Data model

New table `release_cutover_attestations` (`shared/schema.ts`), alongside
`coordinationV2SourcePromotions`:

- `id` uuid pk
- `decisionRef` varchar(128) — bounded free-form identifier for the decision
  this attestation exists for (e.g. `task-1453`)
- `capturedByActorId` varchar — one of `COORDINATION_ACTOR_IDS`
- `targets` jsonb — array of `{ label, url, commitSha, sourceContextSha256 }`,
  one entry per independently-checked endpoint
- `commitSha` char(40) hex — required identical across every `targets` entry
- `sourceContextSha256` char(64) hex — required identical across every entry
- `reason` text, bounded length — why this attestation exists
- `capturedAt`, `expiresAt` timestamptz — bounded TTL (default 2h, hard
  ceiling 24h)
- `state` varchar(16): `active` | `invalidated` | `consumed`
- `invalidatedAt` / `invalidatedByActorId` / `invalidationReason` — nullable,
  set only on `active` → `invalidated`
- `consumedAt` / `consumedByActorId` / `consumedForAction` — nullable, set
  only on `active` → `consumed`

Constraints: hex-format checks on `commitSha` / `sourceContextSha256`;
`expiresAt > capturedAt`; `expiresAt - capturedAt <= interval '24 hours'`;
`state` enum check; a partial unique index on `decisionRef` `WHERE state =
'active'` — at most one live attestation per decision, so re-attesting
requires explicitly invalidating the previous row first instead of silently
overwriting it.

### Service — `server/services/release-cutover-attestation-service.ts`

- `attest({ actor, decisionRef, reason, ttlMs? })` — fetches every
  operator-pinned target URL now: HTTPS only, `redirect: 'manual'`, bounded
  timeout, bounded response size, `parseReleaseIdentity` schema validation
  (same safety properties as `resolveRenderReleaseEvidenceFromHealth`, applied
  per-target instead of against one expected value). Requires every target to
  answer `200`, `authority: 'build'`, `promotable: true`, and the exact same
  `commitSha` + `sourceContextSha256` as every other target. Any disagreement,
  timeout, or malformed response fails closed with no row written — a live
  rollout in progress across hosts must not produce a false attestation.
  Refuses if an `active` row already exists for `decisionRef`. TTL is clamped
  to the hard ceiling regardless of what the caller requests.
- `getActive(decisionRef)` — returns the row plus a computed `expired`
  boolean from `expiresAt`; never mutates state.
- `verifyStillLive(decisionRef)` — re-fetches the same operator-pinned targets
  right now and compares against the stored attestation. Fails closed (no
  match) if the row is missing, expired, invalidated, consumed, or if live
  evidence disagrees with the stored commit/digest or with itself across
  targets.
- `invalidate(decisionRef, actor, reason)` — `active` → `invalidated` only;
  idempotent on an already-invalidated row with the same actor and reason.
- `consume(decisionRef, actor, actionLabel)` — calls `verifyStillLive`
  internally first and requires a match; only then transitions `active` →
  `consumed`. This is the mandatory checkpoint: any code that actually
  executes a cutover (DNS change, Windows-authority grant, etc.) must call
  `consume()` immediately before acting and abort if it throws. This mirrors
  the existing "verify identity again immediately before appending authority"
  pattern in `recordLocked()`, applied at decision-timescale instead of
  request-timescale.

### Target endpoints

The checked target list is a hardcoded `const` array in the service file —
`getholahola.com`, `render.getholahola.com`, and the raw
`holahola-6f1o.onrender.com` origin (all `/health/release`, HTTPS, no
credentials) — never sourced from an environment variable, request body, or
database row. The only way to use a different list is direct constructor
dependency injection in a test file; no runtime code path lets a caller or
config value influence which URLs get fetched. This is the SSRF boundary:
fixed source code is the only origin of target URLs.

### Surfaces

- CLI `server/scripts/release-attestation-cli.ts`: `attest | get | verify |
  invalidate | consume`, machine-readable JSON output, mirrors
  `source-control-cli.ts` conventions.
- HTTP routes `server/routes/release-cutover-attestation-routes.ts` under
  `/api/admin/release-attestation/*`, gated with `requireCoordinationAuth`
  (`x-coordination-token`) plus the shared `mutationLimiter` rate limit on
  mutating endpoints. No bespoke token scheme and no idempotency-key ledger:
  `attest`/`invalidate`/`consume` are each already idempotent at the service
  layer (matching `decisionRef` + actor/action replays return the existing
  row instead of erroring), so a request-tracking layer would duplicate
  that guarantee. Synchronous — no polling layer, because each operation is
  one bounded HTTP fetch plus one DB read/write, unlike the multi-minute
  validation pipeline `SourcePromotionService` wraps.

### Usage convention

Documented in `docs/disaster-recovery-runbook.md` Phase 2 and
`docs/agent-workflows.md`:

1. Before presenting a cutover decision to a human, call `attest()` and quote
   the returned `decisionRef`, `commitSha`, `sourceContextSha256`, and each
   target's agreement in the prompt. The claim about "the verified release"
   is now the attestation, not a live value that can move while it is read.
2. If the human takes long enough that the attestation expires or is
   invalidated, the honest move is a fresh `attest()` and a fresh prompt —
   never silently reusing stale evidence, never silently substituting
   whatever is live now for what was shown.
3. Whatever code executes the actual cutover must call `consume()`
   immediately before acting and stop if it throws. This still fails closed
   exactly like the existing promotion-recording code if `main` moved during
   the decision window; the difference is one clear, attributable reason
   ("attested release is no longer live; re-attest") instead of an unnoticed
   race.

### Explicitly out of scope

- `render.yaml` `autoDeploy` and any deploy-pause/freeze mechanism (rejected
  above).
- `SourceControlService`'s append-time re-verification — unchanged.
- Building the DNS-flip or Windows-authority-grant automation itself; those
  remain separate and must adopt the `consume()` checkpoint when built.
- Restricting a *blocked* task's actions (#1457-#1459's axis) — this applies
  to ordinary, unblocked commits.

## Release Sequence

1. Update `shared/schema.ts`, run `npx drizzle-kit generate`, review the SQL,
   run `npm run db:branch -- gate`.
2. Implement the service, CLI, and routes; add focused tests (TTL bounds,
   target disagreement, expiry, invalidate/consume transitions, unique-active-
   per-`decisionRef`).
3. Run `npm run typecheck`, the validation suite, and consolidated CI.
4. Obtain Alden's unconditional design and implementation review.
5. Apply the migration for real (`npx drizzle-kit migrate`).
6. Document the usage convention in the disaster-recovery runbook and agent
   workflow doc.

## Error handling and postconditions

- A failed `attest()` (disagreement, timeout, malformed evidence, existing
  active row) writes no row.
- `verifyStillLive()` / `consume()` never trust the stored row alone — always
  re-fetch and compare live.
- No secret, token, or credential is stored in `targets` or the row; only
  sanitized commit, digest, label, and URL.
- Every target URL is operator-pinned configuration, never caller-supplied,
  to prevent SSRF through this endpoint.

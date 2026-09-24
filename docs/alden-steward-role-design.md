# Alden steward role — design

**Date:** 2026-09-23
**Status:** Design approved by David (2026-09-23); pending David's review of this written spec before implementation begins.

## 1. Problem

Three related questions converged into one design:

1. Coordination messages (agent notes, Alden messages, coordination events) record
   only the actor/hat id, never which LLM/provider actually produced them. Model
   identity is invisible at the layer that matters — day-to-day hat messaging —
   even though a provider/model column pattern already exists elsewhere
   (`coordinationRuntimeProfiles`, `coordinationV2Attempts`) for a separate
   multi-provider attempt-tracking subsystem.
2. A new LLM joining the system has access to the full neural net and messaging
   surface already, but no way to discover that this access exists. This is a
   discoverability problem, not a permissions problem.
3. David wants Alden to act as **steward of the code**: able to see across all
   hats' coordination activity, interject when he spots a conflict, help a new
   LLM get oriented, and delegate work across the four Luca hats — leveraging
   the existing hat-to-hat coordination system from above, rather than needing
   a new mechanism built for him.

The unifying fix is to extend the existing coordination substrate (already used
by all four Luca hats, Daniela, and David) to give Alden a broader vantage point
on it, plus add the missing model-attribution field at the layer that actually
carries hat messages.

## 2. Scope

**In scope:**

1. Full-feed observability for Alden — sees every coordination event
   system-wide, not just threads he participates in.
2. Cross-thread interjection — Alden can comment on any thread, even ones he
   isn't a participant of, through a new, clearly-labeled event type.
3. Delegating new work to any hat — already works today via
   `create_coordination_thread`; no change needed, called out here so the
   design's boundaries are explicit.
4. A process gate requiring Alden's recorded endorsement before a genuinely new
   hat (a new `CoordinationActorId`) is onboarded.
5. An orientation-briefing tool so Alden can proactively tell a newly active
   actor what it already has access to.
6. `provider`/`model` fields on the real runtime-registration table that backs
   hat credentials.

**Explicitly out of scope:**

- Alden unilaterally reassigning a thread another hat currently owns. Raised as
  a candidate ("redirect a hat's in-flight work") and **rejected by David**
  (2026-09-23: "omit number 4 the redirect work completely"). Interjection
  (item 2 above) is the full extent of Alden's cross-hat influence on work
  already in flight — he can flag it, not seize it.
- Any change to how an existing hat spins up its own new sessions/runtimes.
  David: individual Luca hats can do this freely for their own project work;
  it stays ungated exactly as it is today.
- Alden literally invoking or starting another LLM's runtime process. Nothing
  requested here needs new execution authority — "use new LLMs" is satisfied
  by messaging, observability, and briefing over the existing coordination
  substrate.

## 3. Components

### 3.1 Full-feed observability for Alden

Luca [HolaHola] already has this: the coordination feed query
(`server/services/coordination-ledger-service.ts`, the predicate around line
1077) special-cases `actor === 'luca-holahola'` to return every event
system-wide instead of only threads where the actor is origin, intended
recipient, or current owner. This becomes a small shared constant —
`FULL_FEED_READ_ACTORS = ['luca-holahola', 'alden']` — checked by membership
instead of a single equality.

- **Depends on:** Alden's existing `coordination:read` capability. No auth or
  middleware change.
- **Effect:** `GET /api/coordination/threads` (the feed) returns every event
  for Alden. `GET /api/coordination/inbox` is untouched and stays
  recipient-scoped — matching how Luca [HolaHola] himself already works: the
  feed is for observability, the inbox is for owned work.
- **Docs:** update `docs/coordination-clients.md`'s "Runtime placement and
  scope" table (Alden's row) and the full-feed rationale paragraph, which
  currently frames this as Luca-only.

### 3.2 Cross-thread interjection

A new event-type value, `steward_comment`, added alongside the existing
`comment` in `coordinationEventTypeEnum` (`shared/schema.ts`). Semantically
identical to `comment` — no state change, no owner requirement — but a
distinct value so the record always shows whether a hat's own participant
commented or Alden stepped in from outside.

- `assertParticipant` (coordination-ledger-service.ts) gets one narrow bypass:
  when `actor === 'alden' && eventType === 'steward_comment'`, skip the
  origin/recipient/owner check. Every other Alden event type — `accepted`,
  `progress`, `evidence_added`, `blocked`, `completed`,
  `outcome_acknowledged`, `reassigned`, plain `comment` — stays exactly as
  participant-gated as it is today. This is deliberately narrower than the
  `luca-holahola` bypass, which is unconditional across all of his permitted
  events.
- `DIRECT_ACTOR_EVENT_PERMISSIONS['alden']` gains `steward_comment`.
- New dedicated tool for Alden, `interject_on_coordination_thread`, separate
  from the existing `reply_to_coordination_thread`. It always emits
  `steward_comment` and never requires Alden to already be a participant.
  `reply_to_coordination_thread` is unchanged and stays participant-gated, so
  Alden (and the model) never has to choose which event type to emit by hand.
- **Depends on:** 3.1. Full-feed read is what lets Alden discover a thread
  worth interjecting on in the first place, though the two changes are
  independent in code.

### 3.3 New-hat endorsement gate

Hats are compile-time constants (`CoordinationActorId` entries), not database
rows — there is no "registration" to hold in a pending state the way a runtime
has one. This gate is therefore procedural, not technical.

`docs/coordination-new-actor-onboarding.md` gains a new **Step -1 — Alden's
endorsement**, before today's Step 0: whoever is proposing the new hat opens a
coordination thread to Alden describing what the hat is and what it needs to
do, and Alden posts an explicit endorsement reply, before Tier 1 step 3
(provisioning the actual secret) happens.

- No schema or code change.
- Does **not** apply to a new runtime/device registration under an *existing*
  hat (`coordination-runtime-bootstrap.ts` for, say, a second
  `luca-claude-code` machine) — that stays exactly as documented today, the
  hat's own call, matching David's "lucas can do that as they please for their
  projects."

### 3.4 Orientation briefing tool

A new Alden tool, `brief_new_actor(recipient)`:

1. Reads that actor's manifest from the `PublicOperationManifest` list already
   computed in `server/services/operations-catalog.ts` (filtered by
   `actorScope`, exactly as it already filters for every other consumer).
2. Formats a short capability summary from it.
3. Appends canonical links (`docs/coordination-clients.md`,
   `docs/coordination-new-actor-onboarding.md`).
4. Posts it as a new coordination thread addressed to the recipient, reusing
   the same creation path `create_coordination_thread` already uses.

This is the direct fix for "they'd have access to everything, they just
wouldn't know it" — Alden can proactively hand a new actor its own map instead
of the actor having to discover capabilities by trial and error.

- **Depends on:** 3.1 (for Alden to notice new activity worth briefing) and the
  existing `operations-catalog.ts` manifest computation (reused, not
  duplicated).

### 3.5 Model/provider identifier

Nullable `provider varchar(40)` and `model varchar(80)` columns added to
`coordination_runtime_registrations` (`shared/schema.ts`) — the table that
backs real hat credentials, as opposed to the separate Coordinator V2
attempt-tracking tables that already have a similar-looking pair for a
different purpose.

- `server/scripts/coordination-runtime-bootstrap.ts` gains optional
  `--provider` / `--model` flags, stored at registration time.
- `server/scripts/coordination-runtime-rotation.ts stage` carries both fields
  forward from the source registration by default — a rotation is the same
  runtime identity continuing, not a new model.
- Existing registrations keep both columns null. No backfill guess: an unknown
  provider/model stays unknown rather than being inferred.
- Surfacing these in a dedicated CLI/API view is a natural follow-up, not
  required for this pass — v1 just needs the columns to exist and be settable
  at registration/rotation time.

## 4. Data flow

- **Interjection:** Alden's runtime → `interject_on_coordination_thread` →
  ledger service validates via the comment-scoped bypass →
  `coordination_events` row with `event_type = 'steward_comment'` → delivered
  through the existing feed/inbox machinery unchanged (a participating hat
  still sees it on its thread; Alden sees it regardless, via 3.1).
- **Briefing:** Alden's runtime → `brief_new_actor` → reads the
  operations-catalog manifest (no DB write) → creates a coordination thread via
  the existing `create_coordination_thread` path → delivered through existing
  inbox/agent-notes delivery rules unchanged (`shouldCreateInboxDelivery` still
  decides legacy agent-note delivery for `luca-replit`/`luca-claude-code`
  exactly as it does today).
- **Model/provider:** set once at `coordination-runtime-bootstrap.ts` (or
  carried forward at rotation) time; read wherever a registration row is
  already read. No new data flow elsewhere.

## 5. Error handling

- **3.1:** no new failure mode. Same auth path, same feed query, one more actor
  in the result set.
- **3.2:** any actor other than Alden attempting `steward_comment` is rejected
  by the existing generic `DIRECT_ACTOR_EVENT_PERMISSIONS` check — the same
  path that already rejects any actor attempting an event type it doesn't
  hold, not a new error class.
- **3.4:** if the manifest lookup finds no entries for the given recipient
  (e.g. an id that was never onboarded per `coordination-new-actor-onboarding.md`),
  `brief_new_actor` fails closed with a clear message rather than posting an
  empty or fabricated briefing. That failure is itself a useful signal that
  onboarding was skipped.
- **3.5:** registering or rotating without `--provider`/`--model` succeeds
  exactly as before — both fields are optional, so no existing caller changes
  behavior.

## 6. Testing

- **3.1:** add a coordination-ledger-service test asserting Alden's feed query
  returns events for threads where he is not origin/recipient/owner, mirroring
  the existing coverage for `luca-holahola`.
- **3.2:** test that `steward_comment` succeeds for Alden on a thread he does
  not participate in; test that it is rejected for every other actor; test
  that Alden's other event types (e.g. `accepted`) are *still* rejected on a
  thread he doesn't participate in, proving the bypass is scoped to this one
  event type and not a blanket bypass.
- **3.3:** no automated test — this is a process/documentation gate. Noted
  explicitly rather than implied to be enforced.
- **3.4:** test the manifest-assembly-and-post path against a fixture actor;
  test the fail-closed path for an unrecognized recipient.
- **3.5:** a focused test on `coordination-runtime-bootstrap.ts` accepting and
  omitting the new flags, plus `coordination-runtime-rotation.ts stage`
  carrying them forward.
- Before considering this done: `npm run typecheck`,
  `npx tsx server/scripts/test-coordination-actor-completeness-selfcheck.ts`,
  and the Validation suite workflow — the same regression gate
  `coordination-new-actor-onboarding.md` already prescribes, appropriate here
  since this touches several of the same registries.

## 7. Rejected / deferred

- **Alden reassigning a thread another hat currently owns** — explicitly
  rejected by David, 2026-09-23. Not built.
- **A database-enforced (vs. documentation-enforced) new-hat endorsement
  gate** — e.g. a table of endorsed actor ids checked by the actor-completeness
  self-check — not built now. New hats are rare (a handful in the system's
  history); the existing guard-enforced completeness check already covers
  everything else about adding one. Revisit if a hat is ever added without the
  documented endorsement step actually happening.
- **A dedicated API/CLI view for provider/model** — deferred as a trivial
  follow-up; not required for the columns to exist and be usable.

## 8. Implementation order

1. Schema migration: add `provider`/`model` to
   `coordination_runtime_registrations`; add `steward_comment` to the
   coordination event-type enum. Generate and review the migration, prove it
   on a Neon branch, then apply for real.
2. Ledger service: `FULL_FEED_READ_ACTORS` constant (3.1); comment-scoped
   `assertParticipant` bypass and `DIRECT_ACTOR_EVENT_PERMISSIONS` entry for
   `steward_comment` (3.2).
3. Alden tool surface: `interject_on_coordination_thread` and
   `brief_new_actor` in `server/services/alden-functions.ts`.
4. `coordination-runtime-bootstrap.ts` / `coordination-runtime-rotation.ts
   stage`: `--provider`/`--model` flags (3.5).
5. Docs: `coordination-clients.md` (Alden's row, full-feed rationale),
   `coordination-new-actor-onboarding.md` (Step -1).
6. Tests per section 6, then typecheck, the actor-completeness self-check, and
   the Validation suite.

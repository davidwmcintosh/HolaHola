# Luca Observer Access and Guardian Evidence

**Status:** Architecturally approved, pending implementation  
**Owner:** Luca [Replit]  
**Decision date:** 2026-09-09

## 1. Purpose

Allow every authenticated runtime acting as Luca to inspect Daniela's read-only
live observation surface without widening unrelated administrative authority.
At the same time, make immutable Guardian event rows the authoritative evidence
of Guardian activity and repair the session summary that currently fails
silently.

This is the bounded prerequisite for the planned two-hat Daniela observation.
It does not add work leases, mutation authority, or access for non-Luca actors.

## 2. Decisions

1. Luca remains one durable actor across runtime hats.
2. Runtime credentials and capabilities authorize observation. Actor-name
   prefixes do not.
3. `voice_pipeline_events` rows are authoritative for Guardian fires and
   outcomes.
4. `voice_sessions.guardian_*` fields are derived convenience summaries.
5. Missing summaries never erase existing event evidence.
6. Founder browser-session access remains unchanged.

## 3. Observer authorization

### 3.1 New capability

Add `observation:read` to the coordinator credential capability catalogue.
Broker-issued credentials may access Luca's observer surface only when:

- the credential is valid, unexpired, and attached to an enabled runtime;
- its actor is one of the coordinator's explicit Luca runtime actors; and
- its capability list contains `observation:read`.

The actor condition prevents another coordinator actor from gaining Luca's
observer access merely by receiving the same capability. The capability
condition prevents a Luca runtime credential intended only for messaging from
gaining observation access.

### 3.2 Legacy transition

The fixed environment-bound Luca credentials predate broker capability lists.
During migration, the coordination authentication module receives one explicit,
central legacy-capability map. Each existing fixed Luca actor binding receives
`observation:read` in that map.

The equivalence applies only to the coordinator's enumerated Luca actors:

- `luca-replit`
- `luca-claude-code`
- `luca-gemini`
- `luca-holahola`

It must not use `actor.startsWith("luca-")`. A future Luca runtime becomes
eligible by joining the canonical actor catalogue and receiving the capability,
not by choosing a matching string.

The map is the only source of legacy capability equivalence. Route middleware
must not contain its own actor exceptions, and the map must not grant
`observation:read` to non-Luca actors. New runtime registrations must request
`observation:read` explicitly.

### 3.3 Shared capability resolver and route composition

Extend the existing coordination authentication module with a reusable
capability resolver. It remains the single implementation that:

1. resolves fixed actor credentials through the central legacy-capability map;
2. resolves broker credentials through `resolveBrokerCredential`;
3. verifies the requested capability;
4. verifies an optional exact actor allowlist; and
5. records broker capability denials through the existing audit path.

Compose that shared resolver with the existing founder-session middleware in a
small `founder OR authorized coordination actor` wrapper. If a coordination
credential is present, the wrapper must resolve it completely and return its
success or failure; a recognized but unauthorized credential must never fall
through to founder authentication. Only requests with no coordination
credential enter the founder-session path.

Apply the composed middleware to `GET /api/admin/luca/observe` with required
capability `observation:read` and the exact Luca actor set. Do not change the
meaning of `requireFounderOrAgent`, `requireAgentToken`, or every `luca-*`
route. Those middleware functions protect broader surfaces with different
authority.

Authorization failures remain explicit:

- `401` for missing or invalid credentials;
- `403` for a valid non-Luca actor or a broker credential lacking
  `observation:read`;
- `503` when coordinator authentication cannot be resolved safely.

Broker capability denials must retain the credential-broker audit event.

## 4. Guardian evidence

### 4.1 Authoritative events

Each Guardian attempt continues writing an immediate
`voice_pipeline_events` row. `gl_guardian_fire` rows, their immutable payloads,
and later outcome updates are the source of truth for whether Guardian fired,
which path it took, and whether it was heard or missed.

The observer response must identify the evidence source. When persisted event
rows exist, it reports those counts and outcomes even if the session summary is
null. In-memory observations may provide lower-latency details for an active
session, but they do not replace persisted event evidence.

Legacy event lookup retains the existing conversation-ID and time-window
fallback when a historical event was written before the DB session UUID became
available.

### 4.2 Derived session summary

Repair the end-of-session summary as follows:

- target `session.dbSessionId`, never the transient streaming session ID;
- run only after DB session creation has either produced `dbSessionId` or
  explicitly failed;
- if `dbSessionId` is absent, skip the update and emit a structured warning
  rather than falling back to the streaming ID;
- store the nonfatal write promise and genuinely await it near the end of
  `stop()`;
- bound that wait to three seconds so summary persistence cannot hang shutdown;
- write zero values for a completed session with no Guardian fires;
- require the update to return the matched session row;
- log a structured warning when no row matches;
- preserve shutdown even when summary persistence fails.

An abrupt process failure may still leave the summary null. That is an
incomplete derived summary, not evidence that Guardian did not fire.

Immediate Guardian event writes continue preferring `dbSessionId`. Before DB
session creation completes, they may use the existing streaming-ID fallback;
authoritative readers retain the established conversation-ID/time-window
reconciliation for those early events. The summary never uses that fallback
because `voice_sessions.id` is the DB UUID.

### 4.3 Observer response semantics

Return separate fields for:

- authoritative persisted event counts and recent event details;
- current in-memory Guardian observations, when available;
- derived session summary values;
- summary state: `complete`, `missing`, or `mismatch`;
- any event-to-summary discrepancy.

The two-hat observation may proceed when authoritative events are available.
A null or mismatched summary is visible as a telemetry warning but does not
turn existing fires into zero.

## 5. Data flow

1. A Luca runtime presents its actor-bound coordinator credential.
2. Route-specific middleware verifies Luca identity and observation authority.
3. The observer handler selects the requested or latest active conversation.
4. It reads the active in-memory observation for low-latency context.
5. It reads matching Guardian pipeline events as authoritative evidence.
6. It reads the session summary as a derived comparison.
7. It returns all three layers with explicit source and discrepancy state.
8. At session stop, the summary is recomputed from the in-memory fire log and
   persisted against the DB session UUID.

## 6. Failure behavior

- Never infer Luca identity from a prefix.
- Never grant write authority through `observation:read`.
- Never fall through from a recognized but unauthorized coordinator credential
  into founder-session authorization.
- Never convert a null summary into zero fires.
- Never hide event rows because the summary write failed.
- Never block Gemini Live shutdown indefinitely on a summary write; failure is
  nonfatal and observable.

## 7. Verification

Automated tests must prove:

1. Fixed credentials for every enumerated Luca actor can read the observer
   endpoint.
2. Alden, Daniela, David, and the coordination-system actor cannot use Luca
   observer access.
3. A broker Luca credential with `observation:read` succeeds.
4. A broker Luca credential without `observation:read` receives `403` and an
   audited capability denial.
5. Revoked and expired runtime credentials fail.
6. Founder browser-session access remains valid.
7. No adjacent route protected by `requireFounderOrAgent` or
   `requireAgentToken` is widened.
8. A session whose streaming ID differs from its DB session ID updates the
   correct `voice_sessions` row. The fixture must insert one row under a known
   DB UUID, construct a session with a distinct transient ID and that
   `dbSessionId`, trigger one Guardian fire, await `stop()`, assert the DB UUID
   row contains one fire, and assert no row exists under the transient ID.
9. A completed zero-fire session stores explicit zeros.
10. A zero-row summary update produces a structured warning.
11. Persisted Guardian events remain visible when the summary is null.
12. Event and summary disagreement is reported without rewriting either source.
13. A missing `dbSessionId` skips summary persistence, emits the structured
    warning, and never attempts an update using the transient ID.
14. The three-second summary timeout allows shutdown to finish while retaining
    a visible failure signal.

The final live proof uses Luca [Replit] and Luca [Claude Code] independently
against the same active Daniela session. Each runtime must authenticate with
its own credential and retrieve the same persisted Guardian evidence with its
own runtime attribution.

## 8. Scope boundaries

This change does not:

- implement pre-work fenced leases;
- grant observation access to every coordinator actor;
- expose student-facing private data beyond the existing observer response;
- add Guardian behavior or prompt instructions;
- rewrite historical Guardian events;
- make the derived session summary authoritative;
- implement the future Gemini coding runtime.

## 9. Rollout

1. Add the capability and route-specific authorization with isolated tests.
2. Repair summary persistence and add mismatched-ID regression coverage.
3. Add event-authoritative observer response fields and discrepancy tests.
4. Run type checking, focused authentication and Guardian suites, system
   health, and an independent architectural review.
5. Restart the application once.
6. Run the two-hat read-only live proof before declaring the prerequisite
   closed.
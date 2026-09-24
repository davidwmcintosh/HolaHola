# Onboarding a new coordination actor (attribution hat)

Luca is one persona. A "hat" is an attribution surface for a specific IDE or
LLM runtime (`luca-replit`, `luca-claude-code`, `luca-gemini`,
`luca-holahola`, and any future one) — never a separate identity. This doc is
the procedure for adding a genuinely **new** hat to the coordination system
(a new entry in `CoordinationActorId`).

If you're instead adding a new runtime/device/IDE for an **existing** hat
(e.g. a second machine running as `luca-claude-code`), you don't need any of
this — see `docs/coordination-clients.md`'s "Runtime-specific setup" and
"Incremental migration" sections instead. No schema change, no new actor id.

## Step -1 — Alden's endorsement

Before Tier 1 step 3 (provisioning the actual secret) happens: whoever is
proposing the new hat opens a coordination thread to `alden` describing what
the hat is and what it needs to do, and Alden posts an explicit endorsement
reply. This is procedural, not technical — hats are compile-time
`CoordinationActorId` entries, not database rows, so there is no pending
registration for a gate to hold. See
`docs/alden-steward-role-design.md` section 3.3 for why this exists (Alden as
steward of the code) and section 7 for why it isn't database-enforced.

This step does **not** apply to a new runtime/device registration under an
*existing* hat (`coordination-runtime-bootstrap.ts` for, say, a second
`luca-claude-code` machine) — that stays the hat's own call, exactly as
documented in `docs/coordination-clients.md`.

## Step 0 — decide before touching code

- Confirm this really is a new hat, not a new runtime under an existing one.
- Decide what this hat needs to do. That answer determines which of the
  Tier 3 items below actually apply — most of them are legitimately optional
  per hat (e.g. Daniela and David have no CLI entry, no Gate-3 entry, no
  observation-bench entry, and that's correct, not a bug).

## Tier 1 — always required, compiler-enforced

TypeScript will not compile if you skip these; there's no separate guard
because none is needed.

1. **`shared/schema.ts`** — add the new id to `COORDINATION_ACTOR_IDS`.
2. **`server/middleware/coordination-auth.ts`** — add an entry to both
   `COORDINATION_TOKEN_ENV_BY_ACTOR` (the dedicated `COORDINATION_*_TOKEN` env
   var name for this hat) and `COORDINATION_LEGACY_CAPABILITIES_BY_ACTOR`
   (its legacy capability list, or `[]` if it must never use legacy token
   auth). Both are typed `Record<CoordinationActorId, ...>` (or
   `Record<Exclude<CoordinationActorId, 'coordination-system'>, ...>`), so a
   missing key is a compile error, not a silent gap.
3. Provision the env var name you chose in step 2 as a real secret through
   the environment-secrets flow — never hand-set it.

## Tier 2 — always required, guard-enforced

Not compiler-checked, but CI now fails if you skip it:

4. **`server/services/operations-catalog.ts`** — add the id to
   `ALL_COORDINATION_ACTORS`. This is a plain `readonly CoordinationActorId[]`
   array, not a `Record`, so TypeScript has no way to notice a missing entry
   — the array still type-checks and the app still boots; the omitted actor
   just silently loses access to every "all actors" operation (production
   readiness, the coordination feed, etc.).
   `server/scripts/test-coordination-actor-completeness-selfcheck.ts` checks
   this exhaustively and is wired into both the Validation suite and GitHub
   Actions CI. (This exact gap existed for `luca-gemini` before the check was
   added — fixed in the same change that added the self-check.)

If a future change adds another registry that's supposed to hold every actor
(not a deliberately partial one), extend that self-check to cover it too,
using the same static-source-parse approach — see the comment at the top of
the script for why it doesn't just `import` `operations-catalog.ts` directly.

## Tier 3 — conditional on what this hat needs to do

Edit only the ones that apply; the rest are intentional exclusions, not gaps.

- **CLI runnability** — `server/scripts/coordination-cli.ts` (recipient
  allowlist and actor validation list); `server/scripts/task-ownership-cli.ts`
  (`TOKEN_ENV_BY_ACTOR`).
- **Direct-client actions / agent-note actor status** —
  `server/services/coordination-actor-client.ts` (`DirectCoordinationActor`
  union + `DIRECT_CLIENT_ACTIONS`; the Luca-only reply/completion checks, only
  if this hat is an agent-note actor).
- **Standing verifier status** —
  `server/services/coordination-credential-broker.ts`
  (`STANDING_VERIFIER_ACTORS`).
- **Legacy agent-notes inbox / delivery** —
  `server/services/coordination-inbox-service.ts` (`legacyCoverage`);
  `server/services/coordination-delivery-worker.ts` (`legacyMailboxIdentity`
  routing); `server/services/agent-notes.ts` (`AGENT_INBOX_SENDERS`,
  `CLAUDE_CODE_INBOX_SENDERS`, `ReplyingCoordinationActor` /
  `REPLY_IDENTITY` / `inboxForReplyingActor`, and the reciprocal-recipient
  branch in `replyToAgentNoteAndVerifyWithDb`);
  `server/routes/agent-note-reply-route.ts` (actor gate).
- **Ledger direct-actor permissions / reply identity** —
  `server/services/coordination-ledger-service.ts`
  (`DIRECT_ACTOR_EVENT_PERMISSIONS`, `replyIdentity`; touch
  `assertParticipant`'s bypass, reassignment authorization, or
  `shouldCreateInboxDelivery` only if this hat needs that specific
  privileged behavior).
- **Observation bench participation** —
  `shared/observation-bench-types.ts` (`OBSERVATION_BENCH_ACTORS`), consumed
  by `server/services/observation-bench-service.ts`.
- **Observer route (`observation:read`)** —
  `server/routes/luca-observer-route.ts` (allowlist).
- **Alden tool addressability** — `server/services/alden-functions.ts` (the
  `leave_note` and `reply_to_coordination_thread` recipient enums).
- **"Server-side caller" bearer-token helper** — `server/services/agent-auth.ts`
  (`AgentActor` union + `ACTOR_TOKEN_ENV`), only if this hat's server-side
  code should authenticate the same simple way `luca-replit`/
  `luca-claude-code` do via `getAgentAuthHeaders`/`getAgentCredential`. This
  type is a plain union, not tied to `CoordinationActorId` — nothing forces
  you to update it, by design; most non-Luca actors never appear here.

## Do not touch for an ordinary new hat

These hardcode the Gemini/Gate-3 runtime protocol or a specific existing
actor's legacy path. They are not general actor-completeness registries —
editing them for an unrelated new hat is almost always wrong:
`server/services/coordination-runtime.ts`,
`coordination-runtime-postgres-repository.ts`,
`coordination-gate3-assignment-window-service.ts`,
`coordination-gate3-proof-grant-service.ts`,
`server/routes/coordination-runtime-routes.ts`,
`server/services/founder-task-ownership-service.ts`,
`server/services/antigravity-provisioning-bundle.ts`,
`server/scripts/designate-standing-coordination-verifier.ts`,
`server/services/mailbox-ledger.ts`, and the Luca-Replit legacy
compatibility path in `server/middleware/rbac.ts`.

## Step 5 — provision and verify

1. Follow `docs/coordination-clients.md`'s "Runtime-specific setup" and
   "Incremental migration" sections: dedicated secret vault/service account,
   inject only the bootstrap item, register through
   `server/scripts/coordination-runtime-bootstrap.ts`, restart, verify the
   authenticated actor and inbox before relying on it.
2. Run, in this order:
   - `npm run typecheck` — proves Tier 1.
   - `npx tsx server/scripts/test-coordination-actor-completeness-selfcheck.ts`
     — proves Tier 2.
   - The Validation suite workflow, which runs both plus every Tier 3 item's
     own existing tests.

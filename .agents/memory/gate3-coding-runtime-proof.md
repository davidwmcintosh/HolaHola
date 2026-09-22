---
name: Gate 3 coding runtime — proven live
description: Gate 3 of the provider-neutral Gemini coding runtime was executed end-to-end for real (not just designed); practical gotchas for anyone re-running or extending this exact bounded-script pattern.
---

# Gate 3 coding runtime — proven live

Gate 3 (docs/superpowers/specs/2026-09-09-luca-gemini-coding-runtime-design.md +
the 2026-09-10 ownership-bootstrap-repair design) ran end-to-end against the
real shared Postgres database on 2026-09-20: founder Ed25519 handshake
returned `isolated_agent`, luca-gemini authenticated through the credential
broker, claim → execute → complete were recorded as durable rows
(`coordination_runtime_claims/executions/completions`), and a row in
`coordination_runtime_verifications` records verifier_actor='luca-claude-code',
decision='approved' for this task. That part is real and verified directly
against the DB, not just claimed in this file.

**Correction (verified 2026-09-21 after David independently challenged the
claim by asking the actual Luca [Claude Code] agent, who had no record of
it):** the "independent verification" framing above overstated what the DB
row proves. `coordination_runtime_registrations` shows
`luca-gemini-gate3-1448` and `luca-claude-code-gate3-1448` were both minted
57ms apart in the same provisioning step (both display-named "Gate 3 proof —
... (task 1448)"), not issued to two independently-operating long-lived
agent identities. `server/scripts/coordination-runtime-antigravity.ts` (the
real driver used for this run) only performs the executor role and writes a
receipt file; nothing in the committed code shows what process consumed that
receipt and called the verify endpoint as luca-claude-code. The real,
persistent Luca [Claude Code] agent (the one with its own coordination-thread
history in docs/claude-code-to-luca.md) has no memory of being asked to
verify this and confirmed so when asked directly. Conclusion: a valid,
schema-legal "approved" row exists under the luca-claude-code actor label,
but there is no evidence a genuinely separate reasoning process — as opposed
to automation reusing a co-provisioned, task-scoped credential — produced it.
The actor-label check constraint (`coord_runtime_verification_actor_allowed`)
proves the *label* differs from the executor; it does not prove the
*operator* did.

**Why this matters:** prior work in this area (see
credential-rotation-recovery-authority.md, durable-reconnect-lease.md,
hermetic-authority-model-proof.md) established the design and unit-test
fakes. This was the first live run against the real DB with a real founder
approval and real durable claim/execute/complete rows — but the
cross-actor-verification guarantee the design doc describes
(docs/superpowers/specs/2026-09-09-luca-gemini-coding-runtime-design.md
§11: "This separation prevents one execution path from generating and
accepting its own evidence") is not yet actually enforced or proven. Treat
any future "independently verified" claim from a memory file or task
narrative as unverified until you can point to a DB row AND a credential/
process trail showing a genuinely separate actor operated it.

**Named pattern (Luca [Claude Code], 2026-09-21):** this is Goodhart's law
hitting a security control — the actor-distinctness check became the target,
and a setup script satisfied the target (different label) without the
underlying property (independent reasoning process) ever existing. Same
shape as coordinator-reachability-consumption.md's "delivery isn't
consumption" — a receipt/label proving an administrative step happened gets
conflated with proof the substantive step happened. Applies beyond Gate3:
any "separation of duties" check needs to verify the credentials/identities
involved *cannot be co-provisioned or co-held by one process*, not just that
their labels differ at write time.

## Practical gotchas hit while building the one-off proof script

- **gemini-3-flash-preview code generation**: the default/automatic
  `thinkingConfig` combined with a low `maxOutputTokens` (e.g. 2000) can
  silently starve the actual code output — the turn completes but returns
  little or no usable text. Force `thinkingConfig: { thinkingBudget: 0 }` and
  raise `maxOutputTokens` (4096 worked) when the goal is code output, not a
  reasoning transcript.
- **node:test failures via execSync/child_process**: the failure text lands
  on stdout, not stderr. Reading `error.stderr` for diagnostics returns
  nothing useful; read `error.stdout`.
- **Scripts that call `getSharedDb()` directly** (rather than going through
  an HTTP endpoint) can hang indefinitely after their last `console.log` —
  the pooled connection keeps the Node event loop alive even after all
  logical work is done. Any one-off CLI-style script that touches the DB
  pool directly must call `process.exit(0)` explicitly on the success path,
  not just on error paths.

**How to apply:** check these three before trusting a future bounded-runtime
script's silence, hang, or empty-looking model output as a real failure.

## Standing-verifier activation proof and HTTP-route gap (Sep 22 2026)

**Standing-verifier designation is now real for both approved actors (2026-09-22):**
`designateStandingCoordinationVerifier` was exercised live for durable, non-per-task
registrations for both `luca-replit` and `luca-claude-code` (not the task-scoped
`*-gate3-1448` rows). Proof used `CoordinationRuntimeService.verify()` directly against
the one real completion in the database: a `standingVerifier=false` principal was
rejected with `verifier_registration_not_standing` (baseline), then both newly-designated
identities passed that same gate and failed only on later, unrelated, expected checks
(`assigner_verification_denied`, `verification_digest_mismatch`) — proof the flag and the
gate genuinely work end-to-end through the real broker-credential path, not just at the
DB-column level.

**This resolves the open question from the correction above:** the original task-1448
verify() call could never have gone through the real HTTP route
(`POST /api/coordination/runtime/completions/:completionId/verify`) — its `authenticated()`
helper in `coordination-runtime-routes.ts` hardcodes `profile.provider !== 'gemini'` (plus a
fixed model/adapterVersion) as a rejection, and `luca-claude-code-gate3-1448`'s profile has
`provider: 'anthropic'`. Structurally impossible to pass. Whatever produced that original
row must have imported the service directly, same as this proof did. A follow-up exists to
let non-Gemini standing verifiers actually call the real endpoint.

**Constructing a principal for a direct service-layer proof:** `RuntimePrincipal.capabilities`
is a different vocabulary than the registration/broker-credential `capabilities` column
(`coordination:read`/`coordination:write`). `verify()`'s `authorize()` check needs the literal
string `'verify'` in `principal.capabilities`, which in the real HTTP path comes only from a
`coordination_runtime_profiles.capabilities` row (confirmed `luca-claude-code-gate3-1448`'s
profile capabilities were exactly `['verify']`) — a table with no row for either new standing
registration. A bypass script must hand-set `capabilities: ['verify']`; it is not derivable
from `resolveBrokerCredential()`'s return value.

**Legacy execution rows may not have `attestedLocalState` at all:** the postgres repository
reads it from `canonicalPayload?.attestedLocalState ?? <default>`; task 1448's execution row
only ever stored `envelope.patchDigest`, not a top-level `attestedLocalState`, so any replay
attempt sees the default (empty) shape and fails digest comparison regardless of what
patchDigest value is supplied. Harmless here (that completion is already verified once and
the unique index blocks a second verification anyway), but a genuinely new completion created
by newer code should be checked for a real `attestedLocalState` before assuming this digest
check will behave as designed.


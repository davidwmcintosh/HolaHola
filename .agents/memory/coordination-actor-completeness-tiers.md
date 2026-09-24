Some coordination-actor registries are typed `Record<CoordinationActorId, ...>`
(or `Record<Exclude<CoordinationActorId, 'coordination-system'>, ...>`) --
TypeScript refuses to compile if an actor is missing, so no separate test is
needed. `COORDINATION_TOKEN_ENV_BY_ACTOR` and
`COORDINATION_LEGACY_CAPABILITIES_BY_ACTOR` in
server/middleware/coordination-auth.ts are this kind.

Other registries that are supposed to include every actor are plain
`readonly CoordinationActorId[]` arrays -- TypeScript compiles a short one
without complaint and the app boots fine; the omitted actor just silently
loses access to whatever that array gates. `ALL_COORDINATION_ACTORS` in
server/services/operations-catalog.ts was exactly this: missing
`'luca-gemini'` for an unknown period, found only by deliberately auditing
every actor-id reference in the codebase, not by any test failing.

Fix pattern: a dedicated self-check
(server/scripts/test-coordination-actor-completeness-selfcheck.ts) that
statically parses the array's source text (regex over the slice between the
declaration and its closing `];`) instead of importing the module.
operations-catalog.ts eagerly imports semantic-memory-service
(embeddings/DB machinery); importing it from a guard script would drag that
dependency chain into every CI run for a check unrelated to it. Mirrors the
existing validation-suite CI-parity guard's static-parse approach elsewhere
in the repo.

**Do not generalize this into "every actor-scoped registry must contain
every actor."** Most don't, by design -- CLI recipients, the
standing-verifier list, the observation-bench allowlist, and Gate-3
participation are all legitimately partial (Daniela and David, for example,
have no CLI entry and no observation-bench entry). Add a hard equality guard
only for a registry that is genuinely supposed to be exhaustive; everything
else belongs in a conditional checklist. The full tiered checklist
(compiler-enforced / guard-enforced / conditional-by-capability /
do-not-touch) for onboarding a new actor lives in
docs/coordination-new-actor-onboarding.md.


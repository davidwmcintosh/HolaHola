## Rule

Standing coordination verifiers (`luca-replit`, `luca-claude-code`) must authenticate to HTTP routes using only their broker credential — never a `CodingRuntimeProfile` row.

**Why:** `CodingRuntimeProfile` (provider/model/adapterVersion/worktree fields) models a coding executor's environment (e.g. `luca-gemini`). Verifiers don't execute code, so forcing them through the same profile lookup either fails outright (no profile exists) or requires fabricating a fake executor profile just to pass an irrelevant check — exactly the anti-pattern found and removed in the task that added HTTP verifier auth. Verifier eligibility is a different concept entirely: an actor allowlist (`luca-replit`/`luca-claude-code` only) plus a `standingVerifier` boolean on the credential/registration, both enforced unconditionally inside `CoordinationRuntimeService.verify()` (`verifier_not_allowed`, `verifier_registration_not_standing`).

**How to apply:** when adding a new route or principal type that isn't a coding executor, resolve its principal directly from the broker credential (see `authenticatedVerifier()` in `server/routes/coordination-runtime-routes.ts`) instead of reusing the executor `authenticated()` helper. Keep actor/capability eligibility checks inside the service layer as the single source of truth, not duplicated at the route's auth layer.


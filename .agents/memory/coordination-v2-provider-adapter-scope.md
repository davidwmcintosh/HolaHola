## The rule

## The rule

`server/services/coordination-provider-adapters/` (registry plus per-provider
descriptors like `gemini.ts`) exists only for actors the coordinator drives
autonomously through a stateless network API call — Gemini's
`generateContent` today, OpenAI's API next. It is consumed only by
`coordination-session-service.ts` and `coordination-lifecycle-facade-service.ts`,
the autonomous session/attempt machinery.

A self-driving interactive hat — one that runs its own agent loop and calls
into the coordination system itself, like `luca-claude-code` — never needs an
entry there. `luca-claude-code` has zero footprint anywhere in
`coordination-provider-adapters/` and never will; it drives itself via
`server/scripts/coordination-v2-interactive-cli.ts` at each lifecycle step
(start/poll/claim/renew/submit-result/cleanup/status).

**Why:** this wasn't obvious from the onboarding checklist alone — a new
hat's gap list can carry "no provider adapter" as a requirement copied from a
generic template without checking it against that hat's own architecture.
Antigravity's checklist did exactly that; Alden confirmed the interactive
reading and ruled no adapter was needed (coordination thread
`4672bbaf-63be-47e5-b9a0-6f26478440b8`, Sep 28, 2026).

**How to apply:** before listing "provider adapter" as a gap for any new
hat, check whether it's self-driving/interactive (no adapter — build runtime
glue over the interactive CLI instead) or autonomous/API-driven (adapter is
a real requirement, since the coordinator must be able to call the model
itself). OpenAI is the latter: its provider adapter in task #1447 is a
genuine requirement, not a miscategorization.


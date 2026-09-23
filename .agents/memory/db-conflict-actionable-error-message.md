Three call sites already convert a detected Postgres unique-constraint
conflict into a human-actionable domain error instead of returning a bare
boolean or letting the raw driver error escape: `coordination-credential-broker.ts`'s
`registerCoordinationRuntime` (duplicate `--runtime-id`),
`coordination-windows-generation.ts`'s `isCoordinationPreparationUniqueConflict`,
and `shared-spec-core.ts`'s `isActiveDestinationRace`. For the cause-chain-walking
detection technique itself, see postgres-hermetic-testing-gotchas.md
("PostgreSQL wrapped structured errors") -- this entry is about the next
step: what to do once the conflict is detected.

**Why:** a bare `insert()` with no existing-record check surfaces a raw
`duplicate key value violates unique constraint "..."` Postgres error and a
stack trace to whoever triggered it. When the caller is a human running a CLI
by hand (e.g. after a copy-paste retry) rather than an engineer who can
interpret a DB error, that raw error is a dead end, not an answer.

**How to apply:** once the conflict is positively identified (exact SQLSTATE
+ exact allowlisted constraint name, matching the linked entry's method),
throw a new `Error` whose message states what's already true and names the
exact next command or route to run (not a generic "already exists" message or
a machine-readable reason code) -- e.g. pointing at a sibling rotation/revoke
script by its real invocation, not just its filename.


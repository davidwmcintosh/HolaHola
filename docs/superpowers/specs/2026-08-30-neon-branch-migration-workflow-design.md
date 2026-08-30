# Neon Branch Workflow Design

## Goal

Give every interface that touches HolaHola's database — Claude Code (local
or Codespace), Replit Agent, Cursor, Antigravity, or a human running the CLI
directly — one shared, repeatable procedure for working against an isolated
Neon branch instead of the live shared database, and for proving a schema
migration safe before it reaches `NEON_SHARED_DATABASE_URL`. This follows the
same shape as
[`2026-08-26-unified-source-promote-endpoint-design.md`](2026-08-26-unified-source-promote-endpoint-design.md):
one documented procedure, callable identically from any tool, rather than
each interface growing its own slightly-different habit.

## Two things this replaces

1. **Migration review with no execution test.** Today's workflow
   (`drizzle-kit generate` → human review of the SQL → `drizzle-kit migrate`)
   catches intent errors but not a migration that fails against the
   database's actual current state (locks, existing data shapes, FK
   constraints, drift between the schema file and reality). Nothing runs the
   migration for real before it's real.
2. **Dev coding against live production data.** Per `replit.md`, dev and prod
   both use `NEON_SHARED_DATABASE_URL` — the same database. This is
   deliberate for the *served application* (see below), but as a side effect
   it also means every ad hoc script a coding agent runs today
   (`server/scripts/*.ts` seed/backfill/repair scripts, schema experiments,
   anything) runs directly against real data, with zero isolation between
   whatever agent is running it and whatever else is live. That's a bigger
   standing risk than anything branching introduces.

## Scope: what stays shared vs. what gets isolated

HolaHola's Split-View architecture keeps David and Daniela's **live served
experience** — actual conversations, memory, continuity — on one database on
purpose, because a fork there would fork Daniela's identity between dev and
prod. That constraint is real and this design does not touch it: nothing
here changes which database the running application serves real sessions
from. `NEON_SHARED_DATABASE_URL` remains what the live app talks to, always.

What *is* in scope for isolation is everything that isn't a live session:
coding, schema experiments, seed/backfill scripts, migration testing,
running the test suite. None of that needs to touch real data to be
correct — it needs *realistic* data, which a Neon branch (a copy-on-write
snapshot of the real database) provides without the drift a hand-maintained
separate dev database would accumulate, and without the risk of running it
against the real thing.

Concretely: branch-per-feature/branch-per-agent-session is **not** in
tension with the single-shared-DB decision, as long as the branch never
becomes what a real Daniela/David session is served from. It's a strict
safety improvement over today's status quo, not an exception to the
architecture.

## Ephemeral, on demand — not one reused branch

`Neon_Test_DB` (the static branch created for the Codespace pilot) was a
one-time test of "can we branch at all," never actually used since, and by
your own call is not sacred. It's retired by this design, and branches in
general should be created on demand rather than reused, for concrete
reasons:

- **Concurrent isolation.** Two agents (a local Claude Code session and a
  Replit session, say) working at once on a single reused branch would
  collide on schema state — reintroducing exactly the problem branching
  exists to solve, one level up.
- **Staleness.** The value of testing against a branch is that it reflects
  production's *current* state. A branch snapshotted weeks ago is a fixture
  that's already drifted — the same failure mode as any long-lived test
  fixture that nobody re-syncs. Neon's own tooling leans on `--expires-at`
  and per-run branches for this reason; `reset --parent` existing at all is
  an admission that long-lived branches need active upkeep or they rot.
- **Cost is not a counter-argument.** Branch creation is copy-on-write and
  takes ~1 second; storage cost is proportional only to what diverges from
  parent. An idle branch that's never cleaned up (like `Neon_Test_DB`) costs
  more in drift than a constant stream of short-lived branches costs in
  compute.

This mirrors Neon's own agent-skill framing directly: "create a Neon branch
any time you would create a git branch." Two branch lifecycles map onto that
one-liner:

### Flow A — feature/session sandbox

- Any agent starting real coding work (a new git feature branch, or a
  Codespace/local session that needs to run the dev server against
  something other than production) creates a Neon branch named to match:
  `agent/<git-branch-name>`.
  It points its own environment's DB connection string at that branch for
  the duration of the work — seeds data, runs migrations experimentally,
  restarts freely, breaks things freely.
  It deletes the branch when the git branch merges or the work is abandoned
  — same lifecycle as the git branch it's named after, one for one.
- This is also the direct replacement for the Codespace's static
  `NEON_TEST_DATABASE_URL` default from
  [`2026-08-26-claude-code-test-environment-design.md`](2026-08-26-claude-code-test-environment-design.md):
  instead of one long-lived branch that quietly goes stale, the Codespace
  requests its own working branch through this same tooling when a session
  starts. **Flagging this as an amendment to that doc rather than changing
  it silently** — the "done, not just planned" claim there about
  `Neon_Test_DB` needs an explicit update once this ships.

### Flow B — migration validation gate

- Purpose-built, short-lived, single-use: prove one pending migration before
  it touches the shared DB. Branch name: `test/migration-<UTC-timestamp>`.
  Created, used, and deleted within one script run — never left around for
  a human or another agent to pick up.

Both flows are subcommands of one tool rather than two separate scripts,
since the underlying operations (create, get connection string, delete) are
identical.

## Tooling

- New script: `scripts/neon-branch.ts`, checked into the repo, callable
  identically from any environment that has the project's standard secrets
  available (Replit Secrets, the Codespace's GitHub-managed secrets, or a
  local `.env`) — no new server endpoint. Unlike `source-promote`, there's
  no credential here that every caller must be kept away from: creating or
  deleting a Neon branch can't touch `NEON_SHARED_DATABASE_URL`'s data
  (copy-on-write, zero load on parent), so there's no equivalent reason to
  gate it behind a server-only secret. What's worth centralizing is the
  *procedure*, not the credential.
- Subcommands: `create --name <name> [--parent production] [--expires-at
  <duration>]`, `connection-string <name>`, `list`, `delete <name>`,
  `gate` (Flow B, end to end: create → migrate → test → report → delete).
- New secrets, landing in the same three places `NEON_TEST_DATABASE_URL`
  already did (`.env`, `.env.template`, Replit, GitHub): `NEON_API_KEY`
  (management-API scope only — creates/deletes branches, is never itself a
  Postgres connection string) and `NEON_PROJECT_ID`.
- Talks to the [Neon API](https://api-docs.neon.tech/reference/createprojectbranch)
  directly over `fetch()`, not the `neon` CLI. The CLI is the right default
  for an interactive human session (Neon's own skill picks it first for
  exactly that reason); this tool runs unattended from whichever agent
  invoked it, and a plain HTTPS call has nothing to install or keep in PATH
  across Windows, Codespace Linux, and Replit's container alike — same
  reasoning that already led `scripts/neon-schema-push.ts` to call
  `@neondatabase/serverless` directly rather than wrapping a CLI.
- Migrations must resolve the branch's **direct** (unpooled) connection
  string, not the pooled one — pooled connections route through PgBouncer in
  transaction mode, which doesn't support the session-level operations
  `drizzle-kit migrate` needs (`prepared statement already exists` /
  `relation does not exist` otherwise).

## Migration gate workflow (Flow B, detailed)

1. Caller runs `npx drizzle-kit generate` and reviews the generated SQL,
   same as today — unchanged.
2. Caller runs `npx tsx scripts/neon-branch.ts gate`. It:
   1. Creates `test/migration-<timestamp>` from `production`, with a hard
      `expires-at` backstop in case later steps never run.
   2. Runs `drizzle-kit migrate` against the branch's direct connection
      string.
   3. On success, runs the same `test:ci:*` groups `source-promote` already
      validates (`test:ci:unit`, `test:ci:guards`, `test:ci:episodes`) with
      the branch's connection string swapping in for
      `NEON_SHARED_DATABASE_URL` for the duration of the run.
   4. Deletes the branch regardless of outcome.
   5. Prints a clear pass/fail verdict, and on failure, which step failed
      and why.
3. Only on a printed pass does the caller run `npx drizzle-kit migrate` for
   real, against `NEON_SHARED_DATABASE_URL` — still separate and explicit,
   same as today. "Merging back" here means replaying the *same reviewed
   migration file* against the shared DB, never copying branch data back —
   Neon has no child→parent merge primitive, and the operation being
   byte-identical to what was just proven is a stronger guarantee than a
   data merge would be anyway.

## Security

- `NEON_API_KEY` can create, reset, and delete branches and mint their
  connection strings — it cannot read or write table data itself, and
  creating a branch never mutates the parent. Scope it to the minimum Neon
  role that can still manage branches, not an org owner key, if Neon's
  console allows narrowing it.
- The tool must never print a branch's connection string to shared logs (CI
  output, PR comments) — only to its own process, or into the local `.env`
  of the environment that asked for it.
- Fail closed: if branch creation, migration apply, or any `test:ci:*` group
  errors out (times out, can't reach the branch) rather than cleanly
  reporting pass/fail, the gate treats that as a refusal and still deletes
  the branch.

## State model

`ready_to_promote` (branch test passed, safe to run the real migrate) or
`failed` (with the specific reason — apply error vs. named `test:ci:*`
group) for Flow B. Flow A branches don't need a state model; they live and
die with the git branch they're named after.

## Non-goals

- Does not change what database the live served application reads/writes
  for real sessions — `NEON_SHARED_DATABASE_URL` stays what David and
  Daniela's actual conversations run on, unconditionally.
- Does not shorten or remove the human SQL-review step in
  `drizzle-kit generate` → review → migrate; it adds a step, it doesn't
  replace one.
- Does not touch Daniela's prompt context injection or neural network — no
  Gemini approval gate applies (schema migrations already don't touch that
  surface per the existing rule).

## Verification

- A migration crafted to fail only against populated data (not against an
  empty schema) is caught by `gate` and never reaches
  `NEON_SHARED_DATABASE_URL`.
- Two agents run `create` for two different-named branches at the same time
  and neither's work is visible to or disrupted by the other.
- Ephemeral branches are actually deleted after both a pass and a fail run
  of `gate` — check the Neon console/API, don't just trust the exit code.
- Kill `gate` mid-run (simulating a crash) and confirm the `expires-at`
  backstop still reclaims the orphaned branch.
- The same `gate` run from Claude Code (local), the Codespace, and Replit
  all produce the same verdict for the same migration file.
- After this ships, confirm the Codespace boots against a freshly-created
  Flow A branch rather than the retired `Neon_Test_DB`, and that this is
  reflected as an update to the Codespace design doc, not left silently
  inconsistent with it.

## Review

No mandatory Gemini gate — this doesn't touch prompt context injection or
the neural network. Worth a pass from Alden and Luca [Replit] before
building: schema changes to the one shared database are high-blast-radius
even though this tool only ever touches disposable branches, and Flow A
changes how every agent's dev environment gets its DB connection.

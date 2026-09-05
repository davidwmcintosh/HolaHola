# Claude Code Test Environment Design

## Goal

Give Claude Code — both local (David's machine) and cloud sessions — a real,
persistent, non-Replit environment to run and test the actual HolaHola
server, closing the gap found repeatedly on 2026-08-25/26: no way to
reproduce a live failure, watch a real stack trace, or verify a fix beyond
reading code and querying the database from outside.

## Scope

- One environment — a GitHub Codespace on this repo — reachable identically
  by local and cloud Claude Code sessions, hosting a real running instance
  of the app (`npm run dev` equivalent).
- Not required to run continuously. Codespaces auto-suspend when idle by
  design; that's fine, not a gap to work around. Claude Code already has
  standing authority to start/restart the server process on demand (see
  "Autonomy boundary" below), so waking a suspended Codespace and relaunching
  the process is the same action as recovering from a mid-session crash — one
  wake-up step covers both, no separate always-on supervisor (systemd/pm2)
  needed just to avoid that step.
- Claude Code has standing authority to restart or redeploy the server
  process in this environment without per-instance approval. This is
  explicitly authorized, not something to re-ask for each time — see
  "Autonomy boundary" below for what it does and does not cover.
- Database access defaults to an isolated Neon branch, not the shared
  primary (`NEON_SHARED_DATABASE_URL`). Reaching the shared primary DB from
  this environment requires a separate, deliberate step — never the ambient
  default. **Superseded 2026-08-30 — see Amendment below.** This was
  originally satisfied by a single static branch, `Neon_Test_DB`; that
  branch has since been retired in favor of on-demand branches created
  through `scripts/neon-branch.ts`. The isolation guarantee this bullet
  describes still holds — the mechanism providing it changed.
- Code remains protected by the existing GitHub source-of-truth and
  source-bridge; this environment does not change that flow.

## Autonomy boundary

Two different risk categories, deliberately treated differently:

- **Server process (restart, redeploy, crash-and-recover):** fully
  autonomous. Reversible by construction — the code is in git either way,
  and a bad restart just means restarting again.
- **Anything that writes to a database:** safe only because branch-by-default
  makes the shared primary DB unreachable by accident, not because of
  restraint. If this environment is ever reconfigured to default to the
  primary connection string, this whole design's safety case is void until
  that's corrected.

## Environment options considered

1. **Raw persistent VM** (DigitalOcean/Hetzner droplet or similar). Cheapest,
   fully under our control, process kept alive via systemd/pm2. Requires
   manual provisioning and OS-level maintenance.
2. **GitHub Codespaces.** A real, reproducible Linux container tied directly
   to the same repo the source-bridge already treats as canonical. Reachable
   via `gh codespace ssh` from anywhere. Fits the existing GitHub-centric
   workflow rather than adding an unrelated fourth system to keep in sync.
3. **Managed platform** (Fly.io, Railway, Render). More convenience
   (auto-restart, log streaming, env var management) at more cost/complexity
   than a raw VM.

**Decision: GitHub Codespaces, as a reversible pilot, not a permanent lock-in.**
Chosen because it's fully GitHub-native — same auth and repo as the ruleset,
deploy key, and CI already use, environment defined in a versioned
`devcontainer.json` rather than a hand-configured snowflake box, reachable
identically from local and cloud Claude Code sessions via `gh codespace
ssh`/`gh codespace ports forward`. The one real objection (auto-suspend when
idle vs. the original "kept alive across restarts" framing) turned out not
to hold up: since Claude Code already has standing authority to start the
server on demand, waking a suspended Codespace is the same action as
recovering from a crash, not an extra requirement. If Codespaces turns out
not to work well in practice, the raw-VM or managed-platform options above
remain available — this is a "try it first" decision, not a one-way door.

## Prerequisite (blocking, already filed separately)

`WORKSPACE` in `server/services/transcript-parser.ts` is hardcoded to
`/home/runner/workspace` (Replit's literal path). On any non-Replit
filesystem this silently writes capture data to a disconnected location
instead of failing loudly — confirmed on Windows, would need explicit
verification on whichever environment is chosen here too. Must be
environment-aware (`process.cwd()` or an explicit env var) before this
design can work correctly. Already handed off to Luca [Replit]
(`agent_notes` id `bb47610e-f4f7-42c1-a526-56f4ae85352a`); referenced here so
it isn't rediscovered as a surprise once this environment exists.

## Non-goals

- This does not replace or duplicate production. Production stays on Replit.
- This is not a second permanent database. The shared Neon primary remains
  the one source of truth for Daniela's identity and memory continuity,
  per the standing "single shared DB" decision.
- This does not change how Replit's own dev/production split-view works.

## Verification

- Health-check equivalent to what was already proven against production
  tonight (`GET /api/internal/canonical-conversation-health`) run against
  this environment, confirming the capture pipeline reaches it correctly.
- Confirm a Claude Code session can restart the server process without any
  human approval step, and that the process comes back up correctly.
- Confirm the environment's default DB connection is a Neon branch by
  inspecting the actual resolved connection string at runtime, not by
  assuming the config is correct. Concrete precedent for why this matters:
  the first `NEON_TEST_DATABASE_URL` generated from the Neon console's
  connect panel silently pointed at a different database (`holahola_users`)
  within the right branch, not the app's actual `neondb` — caught only by
  parsing the connection string's actual host/database fields instead of
  trusting that "it's the test branch's URL" meant "it's correct."
- Reproduce one of tonight's real, still-open threads (Sofia health
  degradation, or the games-memory retrieval fix once built) against this
  environment to confirm it's actually useful for the kind of diagnosis that
  prompted building it, not just a working "hello world."

## Next step

This is a design doc, not an implementation yet. No Gemini approval gate
applies here — confirmed directly against `docs/GEMINI_REQUIRED.md`'s
actual protected-category list (system prompt/identity, per-turn
injection/anchors, classroom context, tool descriptions, neural-net
retrieval injection), none of which this touches. The environment choice is
made; remaining before provisioning: share this doc with Luca [Replit] for
awareness given it references migrating source-bridge's role here too, then
provision the Codespace itself and run through Verification below. See the
Amendment for how database isolation is now provisioned (on demand, not a
pre-existing static branch).

## Amendment (2026-08-30) — on-demand branches replace the static test branch

The original plan above was satisfied by creating one static branch,
`Neon_Test_DB`, ahead of time. In practice it was created, never actually
used, and would have gone stale exactly the way
[`2026-08-30-neon-branch-migration-workflow-design.md`](2026-08-30-neon-branch-migration-workflow-design.md)
describes for any long-lived reused branch — so it's been retired.

Database isolation for this environment is now provisioned the same way any
other agent's sandbox is: `npm run db:branch -- create <name>` (see
`.agents/skills/neon-branch/SKILL.md`), run when the Codespace is
provisioned (or resumed after a long suspension, if its branch has expired),
naming the branch after the Codespace/session rather than after a git
branch since a Codespace doesn't necessarily correspond 1:1 with one. The
resulting connection string is what this environment's own
`NEON_SHARED_DATABASE_URL` is set to — not a second, separately-read
variable — so there's exactly one code path (`server/db.ts`) reading exactly
one variable, and no risk of the app silently falling back to reading the
real shared primary through some code path that never learned about a
second variable's existence. `NEON_TEST_DATABASE_URL` as a distinct secret
is retired along with the branch it named; do not re-add it.

This also closes the gap the original plan actually had: a static branch
never gets deleted, so it drifts from production's real state the longer it
sits unused — exactly what happened here. An on-demand branch is deleted
(`npm run db:branch -- delete <name>`) when the Codespace itself is deleted,
so nothing ephemeral outlives the thing it existed for.

The Verification bullet above about the wrong-database incident
(`holahola_users` vs. `neondb`) is exactly why `scripts/neon-branch.ts`
never assumes a connection string is correct — it resolves the database and
role from the branch's own database list, matched against the real app
database name parsed from `NEON_SHARED_DATABASE_URL`, and refuses rather
than guessing if no match is found.

## Amendment (September 2, 2026) — first real provisioning, all Verification items passed

The environment was actually provisioned for the first time (a GitHub
Codespace via `gh codespace create`, using the `.devcontainer/devcontainer.json`
this design specifies) and run through every item in Verification above —
not just planned, actually executed:

- Health-check equivalent (`/api/internal/canonical-conversation-health`)
  returned `workspaceSource: "current-directory"`, confirming the
  `WORKSPACE` fix (prerequisite above) works correctly here, not just on
  Windows.
- The environment's default DB connection was confirmed as the isolated
  branch by parsing the actual resolved hostname at runtime and diffing it
  against the shared primary's hostname — not by trusting the connection
  string's origin.
- Restarted the server process (killed it, relaunched it) with no approval
  step, confirming the standing autonomy this design already grants covers
  a real crash-and-recover, not just a clean start.
- Reproduced a real, still-open diagnosis (the `chat_capture` drain-cursor
  bug found Sep 1) by querying the branch-cloned database directly for the
  exact evidence row cited in that original diagnosis and getting back the
  identical row — proving this environment supports the kind of live
  investigation it was built for, not just a "hello world" boot.

Two gaps found and fixed along the way, unrelated to the environment choice
itself but blocking until fixed:

1. The base `typescript-node` devcontainer image has no SSH server, so
   `gh codespace ssh` failed outright until `ghcr.io/devcontainers/features/sshd:1`
   was added to `devcontainer.json`'s features.
2. Copying `.env` into the Codespace over `gh codespace ssh` from a Windows
   PowerShell pipeline (`Get-Content | ...`) silently corrupted it — see
   `.agents/memory/powershell-ssh-env-file-corruption.md`. Routing the same
   copy through Bash instead produced a clean file. Anyone repeating this
   setup from Windows should route file transfers through Bash, not
   PowerShell, whenever the receiving side parses the bytes exactly.

Separately (found during this same session, not specific to the Codespace):
neither `npm run dev` nor `npm run db:branch` passed `--env-file` to
`tsx`/`node`, so both silently required the caller to remember the flag by
hand outside Replit. Fixed by adding `--env-file-if-exists=.env` to both —
verified with `node --env-file-if-exists` directly: loads the file when
present, prints a message and continues without error when absent, so
Replit's environment (no `.env` file, variables injected directly) is
unaffected.

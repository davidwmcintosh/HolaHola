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
  default.
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
  assuming the config is correct.
- Reproduce one of tonight's real, still-open threads (Sofia health
  degradation, or the games-memory retrieval fix once built) against this
  environment to confirm it's actually useful for the kind of diagnosis that
  prompted building it, not just a working "hello world."

## Next step

This is a design doc, not an implementation yet. No Gemini approval gate
applies here — confirmed directly against `docs/GEMINI_REQUIRED.md`'s
actual protected-category list (system prompt/identity, per-turn
injection/anchors, classroom context, tool descriptions, neural-net
retrieval injection), none of which this touches. The environment choice
above is made; remaining before provisioning: share this doc with Luca
[Replit] for awareness given it references migrating source-bridge's role
here too, then provision the Codespace and run through Verification below.

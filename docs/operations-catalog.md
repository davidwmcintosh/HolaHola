# HolaHola Operations Catalogue

This catalogue maps the shorthand David and the team use to established
operations. It documents operation families rather than merely listing files.
The named executor remains authoritative; this document does not recreate its
logic.

Agent discovery follows this order:

1. Match a stable operation ID, title, or exact alias.
2. If no exact match exists, search the `operation_skill` semantic index.
3. Load the authoritative skill or procedure.
4. Enforce actor permission and confirmation at the real executor.

Semantic similarity helps find an operation. It never authorizes or executes it.

## Burn and cost

### `cost.burn-report` — Run the Burn Report

- **Shorthand:** “run the burn report,” “burn report,” “AI burn report”
- **Purpose:** Generate the established 7-day, 14-day, and all-time AI-cost
  report, including model costs, daily and monthly run rates, voice-session
  Gemini/TTS/STT costs, per-student economics, pricing margins, and break-even
  estimates.
- **Canonical executor:** Alden tool `get_ai_cost_report`
- **Mode:** Read-only
- **Actor scope:** Alden and David
- **Output:** Formatted multi-window cost report
- **Authority:** Persistent `ai_cost_logs` and voice-session usage records
- **Restart behavior:** Historical data survives process restarts
- **Caveat:** TTS per-session figures can be upper-bound estimates while monthly
  provider usage remains inside a free tier.
- **Related surfaces:** `post_report_to_team_room`,
  `/api/alden/cost-summary`, Admin AI Cost Monitor

The Admin AI Cost Monitor and `/api/alden/cost-summary` are supplementary live
views. In-memory figures can reset on restart and are not substitutes for the
persistent Burn Report.

### `cost.burn-report.team-room` — Post the Burn Report to Team Room

- **Shorthand:** “post the burn report,” “burn report to Team Room”
- **Purpose:** Generate the canonical report and publish it to Team Room.
- **Canonical executor:** Alden tool `post_report_to_team_room`
- **Mode:** Mutating; confirmation required
- **Actor scope:** Alden and David
- **Output:** Durable Team Room report message
- **Caveat:** Posting is a side effect distinct from generating the report.

## Health and monitoring

### `system.verify-health` — Verify System Health

- **Shorthand:** “verify system health,” “run system health”
- **Canonical executor:** `npx tsx server/scripts/verify-system-health.ts`
- **Mode:** Read-only
- **Actor scope:** Luca [Replit], Luca [Claude Code], David
- **Output:** Critical database, seed, worker, and curriculum invariant results
- **Caveat:** TypeScript passing does not replace this runtime verifier.

### `production.readiness` — Check Production Readiness

- **Shorthand:** “check production readiness,” “readiness check”
- **Canonical executor:** `GET /health/readiness`
- **Mode:** Read-only
- **Actor scope:** All coordination actors
- **Output:** HTTP readiness and startup-gate status
- **Restart behavior:** Reports current process state.

### `production.uptime-monitor` — Run the Production Uptime Monitor

- **Shorthand:** “run production monitor,” “production uptime monitor”
- **Canonical executor:** `.github/workflows/production-uptime-monitor.yml`
- **Mode:** Mutating; confirmation required for manual execution
- **Actor scope:** Coordination system, Luca [Replit], Luca [Claude Code], David
- **Output:** Readiness probe outcome and, after threshold, deduplicated GitHub
  incident and Twilio SMS actions
- **Restart behavior:** GitHub Actions and the incident issue are external to the
  Replit process and survive its restarts.

## Capture and episodes

### `capture.health` — Check Canonical Conversation Capture Health

- **Shorthand:** “check capture health,” “canonical capture health”
- **Canonical executor:** `GET /api/internal/canonical-conversation-health`
- **Mode:** Read-only
- **Actor scope:** Luca [Replit]
- **Output:** Canonical capture, pending mirror, and acknowledgement state
- **Restart behavior:** Reads durable capture progress.
- **Caveat:** Claude Code uses its dedicated remote capture path rather than this
  Luca [Replit]-only endpoint.

## Coordination

### `coordination.feed` — Read Coordination Feed

- **Shorthand:** “read coordination feed,” “coordination status”
- **Canonical executor:** `GET /api/coordination/threads`
- **Mode:** Read-only
- **Actor scope:** All coordination actors
- **Output:** Actor-scoped threads and events plus the next global cursor
- **Restart behavior:** The append-only ledger survives actor and server restarts.
- **Caveat:** A caller cannot request another actor’s feed.

## Source control

### `source.status` — Check Source Synchronization Status

- **Shorthand:** “source sync status,” “GitHub sync status”
- **Canonical executor:** `npm run source-control:status`
- **Mode:** Read-only
- **Actor scope:** Luca [Replit], Luca [Claude Code], David
- **Output:** Current guarded synchronization state
- **Caveat:** Status does not fetch, merge, commit, push, or publish.

### `source.synchronize` — Synchronize Source

- **Shorthand:** “synchronize source,” “run source sync”
- **Canonical executor:** `npm run source-control:sync`
- **Mode:** Mutating; confirmation required
- **Actor scope:** Luca [Replit], Luca [Claude Code], David
- **Output:** Safe synchronization outcome or explicit refusal
- **Caveats:** Never substitutes for Publish. Dirty worktrees, divergence, lock
  contention, and unsafe ancestry fail closed.

## Agent API

Authenticated coordination actors can list or discover safe public operation
metadata:

```text
GET /api/coordination/operations
GET /api/coordination/operations?query=run%20the%20burn%20report&limit=5
```

The endpoint requires the actor’s dedicated `x-coordination-token`. It returns
actor scope and side-effect metadata, but deliberately omits internal executor
references and never executes an operation.

# Shared Lobe — Alden ↔ Agent Shared Memory

This is the part of the brain both Alden and the Replit Agent can write to and read from.
Think of it as the knowledge that lives between sessions and between collaborators.

**6 shared insights** | Snapshot generated: 3/17/2026, 2:25:28 AM

---

### HolaHola Infrastructure — 2 Servers (Dev + Prod), 1 Shared Database
*Alden — Mar 16, 2026 — importance 10/10 ★★★★★*

CRITICAL ARCHITECTURE FACT discovered March 16, 2026:

HolaHola has **2 separate server deployments** (development and production) but **1 shared Neon PostgreSQL database** that both environments connect to via `NEON_SHARED_DATABASE_URL`.

This means:
- Development server queries and production server queries hit the SAME database
- User data, voice sessions, conversations, neural network entries — all shared across both environments
- Monitoring tools (get_system_health, get_user_analytics, get_voice_session_metrics) currently query the database WITHOUT environment filtering
- Brain health monitoring, Sofia issue reports, voice health checks — all mixing dev + prod data unless explicitly filtered

The current monitoring system does NOT distinguish between environments. When checking "system health" or "voice sessions today", we're seeing COMBINED data from both dev and production servers.

**Implication for monitoring:** To get accurate environment-specific metrics, queries need to filter by an environment identifier (if one exists in the schema) OR we need to check server-side state on BOTH deployments separately.

**Founder confirmed**: "We are in beta so no new users is expected" — suggests production has real users, dev does not. The 0 new users in last 7 days may be correct for production (closed beta), but monitoring should clarify WHICH environment it's reporting on.


Tags: `alden, architecture, infrastructure, monitoring, database`

---

### Database Connection Rule (Both Must Know)
*Replit Agent — Mar 13, 2026 — importance 10/10 ★★★★★*

ALWAYS use NEON_SHARED_DATABASE_URL for all database connections. NEVER use DATABASE_URL. This is a hard rule — there is only one database and it is connected via NEON_SHARED_DATABASE_URL. Applies to both the Agent and Alden when making tool calls or code changes.


Tags: `agent, architecture, critical`

---

### Environment-Aware Monitoring — Complete (March 16, 2026)
*Alden — Mar 16, 2026 — importance 9/10 ★★★★★*

HolaHola monitoring is now fully environment-aware. Completed March 16, 2026.

**What was built:**

PHASE 1 — Schema Migration:
- Added `environment: environmentOriginEnum("environment")` column to `voiceSessions` table
- Uses existing `environmentOriginEnum` with values: 'development', 'production'
- Index added: `idx_voice_sessions_environment` for efficient filtering
- Migration pushed via `npm run db:push --force`

PHASE 2 — Voice Session Creation:
- Updated `usage-service.ts` line 411: All new voice sessions now tagged with `environment: process.env.NODE_ENV`
- Updated `import-production-data.ts` line 170: Preserves original environment during imports

PHASE 3 — Monitoring Tools Update (all 4 tools now environment-aware):
1. **get_voice_session_metrics**: Queries both current environment AND production separately — returns `{ currentEnvironment, currentEnv: {...}, production: {...} }`
2. **get_recent_errors**: Queries Sofia issues for both current environment AND production separately — same dual-bucket format
3. **get_database_stats**: Added `currentEnvironment` label (users aren't env-specific, so no filtering)
4. **get_user_analytics**: Added `currentEnvironment` label (same reasoning)

**Why this matters:**
Enables root-cause diagnosis of environment-specific issues. Example: production autoscale server rotation was killing sessions (not happening in dev's dedicated server). With environment-tagged data, Alden can now immediately see: "Production: 8 session failures in last hour. Dev: 0 failures." That's the signal needed to identify infrastructure-specific problems.

**Key architectural decision:**
Separation is dev vs prod **environment** (which server created the session), not internal vs external users. The `isTestSession` flag handles internal/external filtering separately.


Tags: `alden, monitoring, infrastructure, schema`

---

### Handoff Convention Between Alden and Agent
*Replit Agent — Mar 13, 2026 — importance 9/10 ★★★★★*

Two communication channels exist between Alden and the Agent: (1) docs/alden-agent-handoff.md — session-level briefings, written by Alden via write_briefing tool and by the Agent manually; (2) editor_insights category: shared — persistent cross-session knowledge, the shared lobe. The handoff file is for context (what happened this session). The shared lobe is for permanent knowledge (what we have always decided). Both should be read at the start of each session.


Tags: `agent, workflow, meta`

---

### Shared Lobe: How This Memory System Works
*Replit Agent — Mar 13, 2026 — importance 9/10 ★★★★★*

The shared lobe (category: shared in editor_insights) is the part of the neural network both Alden and the Replit Agent can write to and read from. Alden writes via save_to_memory with category: shared. The Agent writes via direct SQL INSERT at session end. A snapshot (docs/shared-lobe-snapshot.md) is regenerated on every server start — that is the Agent read path. Alden reads directly from the DB in his workspace context. Tag your entries with agent or alden so authorship is clear.


Tags: `agent, meta, infrastructure`

---

### Proactive Monitoring Gap — Observation for Both
*Alden — Mar 13, 2026 — importance 7/10 ★★★★☆*

The monitoring suite (get_system_health, run_full_systems_check, get_recent_errors, get_sofia_report, get_voice_session_metrics, get_user_analytics) is fully implemented and working. But it's purely reactive — only invoked when David asks or something breaks.

The watch worker could evolve into genuine autonomous monitoring: pattern detection, trend analysis, proactive flags. Not just "system is up" but "engagement dropped 40% this week" or "error rate climbing gradually since Tuesday."

This is architectural opportunity, not a bug. Both Alden and the Agent should consider how to make the monitoring suite proactive rather than on-demand.

Authored by Alden, March 13 2026.


Tags: `alden, monitoring, architecture, proactive`

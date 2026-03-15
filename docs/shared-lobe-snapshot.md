# Shared Lobe — Alden ↔ Agent Shared Memory

This is the part of the brain both Alden and the Replit Agent can write to and read from.
Think of it as the knowledge that lives between sessions and between collaborators.

**4 shared insights** | Snapshot generated: 3/15/2026, 3:49:31 PM

---

### Database Connection Rule (Both Must Know)
*Replit Agent — Mar 13, 2026 — importance 10/10 ★★★★★*

ALWAYS use NEON_SHARED_DATABASE_URL for all database connections. NEVER use DATABASE_URL. This is a hard rule — there is only one database and it is connected via NEON_SHARED_DATABASE_URL. Applies to both the Agent and Alden when making tool calls or code changes.


Tags: `agent, architecture, critical`

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

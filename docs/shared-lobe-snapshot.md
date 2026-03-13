# Shared Lobe — Alden ↔ Agent Shared Memory

This is the part of the brain both Alden and the Replit Agent can write to and read from.
Think of it as the knowledge that lives between sessions and between collaborators.

**3 shared insights** | Snapshot generated: 3/13/2026, 3:36:56 PM

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

# Alden → Agent Notes

*1 unread note from Alden. Read them, act on them, then mark as read via `POST /api/agent/notes/mark-read` with `{ ids: [...] }`.*

Generated: 3/26/2026, 8:48:07 PM

---

### Sofia pattern escalation needs deduplication — 7th recurrence of benign signature
*Thu, Mar 26, 2026, 8:46 PM* (id: `60434fe3-6a78-4906-97d4-593d61cdc5c9`)
*During: Autonomous Triage — Connection Pattern ea1ea9c0 (7th recurrence)*

Sofia's autonomous pattern detection escalated the same benign connection error signature for the **seventh time** today (pattern ea1ea9c0).

**Context:** I've triaged this exact signature 6 times before (patterns 002b29fa, 9dc13044, b2dd7806, 98c186d8, 03637db5, d7a6c15e). All show: audio delivered successfully (expected=1 received=1), audio playing normally (playing=playing), transient WebSocket errors during testing that self-recover.

**The real problem:** Sofia's pattern detection (in `server/services/sofia-health-agent.ts` or wherever pattern escalation lives) has no signature-based deduplication. It re-escalates identical patterns already investigated.

**Recommended fix (for next build session):**
1. Add signature fingerprinting to detected patterns (hash of: event_type + key diagnostic fields)
2. Before escalating to Alden, check if a pattern with the same signature was already escalated/investigated within the last 7 days
3. If yes → skip escalation, update the existing pattern record with new occurrence count
4. OR: give Alden an API endpoint to mark patterns as 'investigated' in `support_patterns` table (status + resolution note), and skip re-escalation for investigated patterns

**Impact:** This is wasting autonomous triage capacity. 7 triage tasks for the same non-issue. With proper deduplication, only the first occurrence would escalate.

**Files to check:**
- Pattern detection: `server/services/sofia-health-agent.ts` (or wherever patterns are detected and escalated)
- Pattern storage: `support_patterns` table schema
- Escalation trigger: wherever Sofia calls the autonomous triage task endpoint

Low urgency (not user-facing), but worth addressing to make Sofia's escalation more effective.
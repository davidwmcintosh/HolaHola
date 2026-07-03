---
name: Alden chat access
description: How to read Alden's live conversations with David from the database
---

Alden's conversations with David are stored in two tables:
- `alden_conversations` — session metadata (id, title, started_at, ended_at)
- `alden_messages` — individual turns (role: "david" | "alden", content, created_at, conversation_id)

**To read the most recent Alden session at session start:**

```sql
SELECT am.role, am.content, am.created_at
FROM alden_messages am
JOIN alden_conversations ac ON am.conversation_id = ac.id
WHERE ac.id = (SELECT id FROM alden_conversations ORDER BY started_at DESC LIMIT 1)
ORDER BY am.created_at ASC
```

**To read the last N conversations:**
```sql
SELECT id, title, started_at FROM alden_conversations ORDER BY started_at DESC LIMIT 5
```
Then pull messages per conversation_id.

**Why:** David wants Luca to read Alden's full conversations regularly — not just handoff summaries. The full thread is where the actual context resides (same principle as the inviolability of the narrative). Alden may have had significant exchanges with David that aren't yet captured in handoff notes.

**How to apply:** At every session start, after reading the handoff doc, pull the most recent alden_conversations entry and read its alden_messages in full. Prioritize reading it if it's from the same day as the current session.

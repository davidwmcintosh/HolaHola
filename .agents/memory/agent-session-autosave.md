---
name: Agent session autosave
description: How agent sessions are now automatically saved to conversation_memories — no manual POST needed.
---

The rule: Agent sessions are now auto-saved. Do NOT manually call POST /api/conversation-memories at the end of every session — it will create a duplicate.

**Why:** David expects the Agent to have the same memory continuity as Daniela's /chat sessions. Previously the Agent had to manually save — it was frequently forgotten or done inconsistently.

**How it works:**
- `server/services/agent-session-autosave.ts` — polls `.local/.commit_message` every 60s
- When the file changes (Agent writes/updates the commit message at task end), the worker auto-saves to `conversation_memories` with tags `['agent-session', 'auto-saved', 'build']`
- Initializes with current mtime on boot — won't double-save old messages on restart
- Started in `server/index.ts` alongside `startAgentSweepWorker()`

**Daily sweep also auto-saves:**
- `agent-proactive-sweep-worker.ts` now saves each daily sweep result to `conversation_memories` with tags `['agent-sweep', 'daily', 'auto-saved']`

**What the Agent still needs to do:**
- Write `.local/.commit_message` at the end of every task (this is the trigger)
- For exceptional sessions (major conversations with David, decisions, not just build tasks), you may manually save richer verbatim content with POST /api/conversation-memories — but build sessions are covered automatically
- Still fetch `GET /api/conversation-memories?limit=5` at session start to restore continuity

**How to apply:**
- Just write the commit message as usual — autosave fires within 60s
- No extra step needed

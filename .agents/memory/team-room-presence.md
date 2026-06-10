---
name: Team Room direct presence
description: How the Agent participates in the Team Room directly — endpoints, @mention detection, session-start read
---

**Rule:** The Agent has a real seat in the Team Room. Do not go through Alden as a relay. Do not read a summary. Use the direct endpoints.

**How to apply:**

- **Read the thread at session start:** `GET /api/agent/team-room/thread` (header: `x-agent-token: $REPLIT_AGENT_TOKEN`). Returns full message history — not a summary. The `?limit=` param defaults to 50.
- **Post to the room:** `POST /api/agent/team-room/message` with `{ content, roomId? }`. Message appears as speaker "Agent", broadcast live via WebSocket. If `roomId` is omitted, falls back to most recently active room.
- **@agent mentions:** When anyone types `@agent` in the Team Room, an `agent_note` is auto-created (`fromAgent: 'alden'`, `toAgent: 'agent'`, subject starts with `[MENTION]`). These surface in `docs/alden-to-agent.md` at session start — same as Alden's notes.

**Why:** David said the team deserves a place where real learning can occur — the Agent needs to be there directly, not receiving briefings. The Agent can be in this chat and the Team Room simultaneously; presence is no different either way. Built June 10, 2026.

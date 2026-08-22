---
name: Agent session auth pattern
description: How to authenticate as the Agent for API calls against the running HolaHola server — endpoint, cookie persistence, timing, and response shapes.
---

# Agent Session Auth Pattern

**The rule:** Agent API calls require a session cookie from `POST /api/internal/agent-session`.

**How to apply:**
1. `curl -si -X POST http://localhost:5000/api/internal/agent-session -H "x-agent-token: $REPLIT_AGENT_TOKEN" -H "Content-Type: application/json" -d '{}'`
2. Parse `Set-Cookie: connect.sid=...` header → store full string to `/tmp/sc.txt`
3. Re-read `/tmp/sc.txt` at the top of every new bash call (env vars don't persist between tool calls)
4. Pass as `-H "Cookie: $SC"` on all subsequent requests

**Why:** Each bash tool call is a new shell. `export SC=...` in one call is gone in the next. File persistence (/tmp/sc.txt) is the only reliable pattern.

**Timing:** Wait ~60 seconds after server restart before sending messages. Background workers (prefetch, SharedLobe snapshot, etc.) compete for CPU during startup and cause AI response timeouts.

**Response reading gotcha:** `POST /api/conversations/:id/messages` often returns an empty body when the AI response takes >30s. Solution: fire the POST (allow it to time out or succeed), then GET `/api/conversations/:id/messages` and read the last assistant message. The POST always processes; the GET always has the result.

**conversation-memories POST response shape:** `{ success: true, memory: { id, title, ... } }` — NOT `{ id, title }` directly. Use `result.memory.id` not `result.id`.

**Auth endpoint location:** `server/routes.ts` near line 35086. Accepts `x-agent-token: $REPLIT_AGENT_TOKEN`, sets `session.userId = '49847136'` (Agent's user ID), saves session.

**req.user null bug (fixed 2026-07-01):** AI-browser sessions (and Agent sessions) don't set `req.user` via Passport. Four locations in the message handler used `req.user.subscriptionTier` and crashed. Fixed to `req.user ?? await storage.getUser(userId)` pattern.

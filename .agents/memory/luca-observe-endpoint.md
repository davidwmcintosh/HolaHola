---
name: Luca observe endpoint
description: GET /api/admin/luca/observe — lets Luca read live Daniela GL session state from the Replit chat window. In-memory store + image_vision_cache lookup.
---

**Endpoint:** `GET /api/admin/luca/observe`  
**Auth:** `requireAgentToken` (x-agent-token header only — not public)  
**Query param:** `?conversationId=<id>` (optional — defaults to most recently active)

**What it returns (status: active):**
- `language`, `actflLevel`, `exchangeCount`, `elapsedMin`
- `sceneEnvironment` — the label/env name of the open scene
- `sceneVisionDescription` — prose from `image_vision_cache` (Daniela's actual visual description of the scene image; null on cache miss)
- `scenarioSlug` — if a scenario is loaded instead of a raw scene
- `sceneProps` — array of prop names currently in the scene
- `recentToolCalls` — last 8 tool calls with `secsAgo` timestamps
- `recentMessages` — last 10 messages from the DB, truncated to 500 chars each

**Fallback (no in-memory snapshot):** queries `voice_sessions` WHERE status='active' and returns `status: 'db_only'` with basic session info. Happens when session started before a server restart.

**Store:** `server/services/session-observation-store.ts` — in-memory Map, keyed by conversationId, 4h expiry. Written to by:
- `gemini-live-session.ts` — session start, ACTFL recalibration, session stop
- `native-fc-handlers.ts` — every tool dispatch (generic), OPEN_SCENE (with image URL), LOAD_SCENARIO

**Vision bridge:** `sceneImageUrl` captured from `envImageUrl` at OPEN_SCENE time. Observe route queries `image_vision_cache WHERE image_url = $sceneImageUrl` — returns Daniela's pre-generated description. Non-fatal on miss.

**Usage from Replit chat:**
```bash
curl -s "http://localhost:5000/api/admin/luca/observe" -H "x-agent-token: $REPLIT_AGENT_TOKEN"
```

**Purpose:** Three-way collaborative scenario-building. David sees the scene live. Daniela generates a visual description when she opens it. Luca reads from the same cache. All three looking at the same picture.

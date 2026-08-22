---
name: GL session observability — full recording stack
description: What gets recorded from GL voice sessions and where, after the July 29 2026 instrumentation pass.
---

## What's recorded and where

### Per-tool calls → voice_pipeline_events (event_type: 'gl_tool_call')
Every GL tool invocation in Phase 3 of the tool dispatch loop writes a pipeline event with:
toolName, legacyType, status (ok/error), durationMs, argsPreview (300 chars), resultPreview (500 chars), conversationId, turnId.
Fire-and-forget but non-critical — Sofia's reportGlToolCallSuccess/Failure still runs in parallel.

### Guardian fires → voice_pipeline_events (event_type: 'gl_guardian_fire')
Written in real-time from _observeGuardian() (called after every guardianFireLog.push()).
Fields: ts, path, phrase, outcome, charsInjected, groundingPreview, conversationId.
This is the durable source — the voice_sessions rollup at stop() was fire-and-forget and unreliable.

### Guardian stats → voice_sessions (guardian_fires/heard/missed/hard_walls/carry_forward)
Fixed in stop(): now wrapped in awaited async IIFE so the write actually lands.
Confirmed with log: "[GeminiLive] Guardian stats persisted — fires:N heard:N missed:N hard:N carry:N"

### Neural-net teaching searches → neural_network_telemetry
Two GL call sites now insert telemetry rows:
1. SEARCH_TEACHING_WISDOM case in native-fc-handlers.ts (search_my_teaching_wisdom tool)
2. processMemoryLookup() in native-fc-handlers.ts (memory_lookup tool, teaching-domain branch)
Fields: query, domainsSearched, resultCount, formattedCharacterLength, per-domain counts, searchDurationMs.
Note: student-memory searches (searchMemory) are NOT yet logged to neural_network_telemetry — they appear in gl_tool_call events via resultPreview.

### Real-time observation bench → GET /api/admin/luca/observe
Now includes recentMemorySearches (last 10): secsAgo, tool, query, resultCount, durationMs, domainsHit, formattedChars.
Written to SessionObservation via observeMemorySearch() in native-fc-handlers at both search sites.
Also already had: recentToolCalls, guardianAB.recentFires, recentMessages.

## Session review skill
Created at .agents/skills/session-review/SKILL.md
Covers: finding sessions, pulling tool calls + guardian fires + neural telemetry + messages with thought_content in parallel, synthesising a diagnosis.

## Key queries
```sql
-- Tool calls for a session
SELECT event_data->>'toolName', event_data->>'status', event_data->>'durationMs', event_data->>'resultPreview'
FROM voice_pipeline_events WHERE session_id = '<id>' AND event_type = 'gl_tool_call' ORDER BY created_at;

-- Guardian fires
SELECT event_data->>'path', event_data->>'phrase', event_data->>'outcome', event_data->>'groundingPreview'
FROM voice_pipeline_events WHERE session_id = '<id>' AND event_type = 'gl_guardian_fire';

-- Memory searches
SELECT query, result_count, domains_searched, search_duration_ms FROM neural_network_telemetry WHERE voice_session_id = '<id>';
```

**Why:** David wanted full forensic visibility into what Daniela does during a GL session — whether the backend is working, what came back from memory, whether the guardian fired and was heard.

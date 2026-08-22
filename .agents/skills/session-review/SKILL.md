# Session Review Skill

Review a completed (or active) Daniela voice session end-to-end — tool calls, guardian fires, memory searches, student transcript, and Daniela's thinking — so you can verify the backend is working correctly or diagnose issues.

## When to use this skill

- "Review the last session"
- "What did Daniela search for / call during that chat?"
- "Did the guardian fire? What did it find?"
- "Show me Daniela's thought content during that conversation"
- "What came back from the memory lookup?"
- "Was the backend working during Cindy's session?"
- Any time you want a forensic view of what happened during a GL voice session

## Step 1 — Find the session

If the user doesn't give you a session ID or conversation ID, find the most recent session(s):

```sql
SELECT vs.id as session_id, vs.conversation_id, vs.started_at, vs.ended_at,
       vs.exchange_count, vs.language,
       vs.guardian_fires, vs.guardian_heard, vs.guardian_missed,
       vs.guardian_hard_walls, vs.guardian_carry_forward,
       u.first_name, u.email
FROM voice_sessions vs
JOIN users u ON u.id::text = vs.user_id
WHERE vs.started_at >= NOW() - INTERVAL '24 hours'
  AND vs.exchange_count > 0
ORDER BY vs.started_at DESC
LIMIT 10;
```

Pick the target session. Note its `session_id` and `conversation_id`.

## Step 2 — Pull all data in parallel

Run these four queries simultaneously:

### 2a. Tool calls (every GL tool invocation)
```sql
SELECT
  created_at,
  event_data->>'toolName'     AS tool_name,
  event_data->>'legacyType'   AS legacy_type,
  event_data->>'status'       AS status,
  event_data->>'durationMs'   AS duration_ms,
  event_data->>'turnId'       AS turn_id,
  event_data->>'argsPreview'  AS args,
  event_data->>'resultPreview' AS result_preview
FROM voice_pipeline_events
WHERE session_id = '<SESSION_ID>'
  AND event_type = 'gl_tool_call'
ORDER BY created_at ASC;
```

### 2b. Guardian fires
```sql
SELECT
  created_at,
  event_data->>'path'             AS path,
  event_data->>'phrase'           AS phrase,
  event_data->>'outcome'          AS outcome,
  event_data->>'charsInjected'    AS chars_injected,
  event_data->>'groundingPreview' AS grounding_preview
FROM voice_pipeline_events
WHERE session_id = '<SESSION_ID>'
  AND event_type = 'gl_guardian_fire'
ORDER BY created_at ASC;
```

### 2c. Memory / neural-net searches
```sql
SELECT
  query, domains_searched, result_count,
  formatted_character_length, search_duration_ms, created_at,
  idiom_count, cultural_count, procedure_count, principle_count,
  error_pattern_count
FROM neural_network_telemetry
WHERE voice_session_id = '<SESSION_ID>'
ORDER BY created_at ASC;
```

### 2d. Messages with Daniela's thoughts
```sql
SELECT
  role,
  content,
  thought_content,
  created_at
FROM messages
WHERE conversation_id = '<CONVERSATION_ID>'
ORDER BY created_at ASC;
```

## Step 3 — Session summary header

Also pull the session rollup:
```sql
SELECT
  vs.started_at, vs.ended_at,
  EXTRACT(EPOCH FROM (vs.ended_at - vs.started_at))/60 AS duration_min,
  vs.exchange_count, vs.language,
  vs.guardian_fires, vs.guardian_heard, vs.guardian_missed,
  vs.guardian_hard_walls, vs.guardian_carry_forward,
  vs.llm_input_tokens, vs.llm_output_tokens,
  gl.avg_ms AS avg_turn_latency_ms,
  gl.p95_ms AS p95_turn_latency_ms
FROM voice_sessions vs
LEFT JOIN LATERAL (
  SELECT
    AVG((event_data->>'avgMs')::float) AS avg_ms,
    MAX((event_data->>'p95Ms')::float) AS p95_ms
  FROM voice_pipeline_events
  WHERE session_id = vs.id AND event_type = 'gl_turn_latency'
) gl ON true
WHERE vs.id = '<SESSION_ID>';
```

## Step 4 — Synthesize and report

Present findings in this order:

### SESSION HEADER
- Student, language, duration, exchange count
- Turn latency avg / p95
- Token usage

### TOOL CALL TIMELINE
List every tool call chronologically: timestamp → tool name → status (✅ ok / ❌ error) → duration → turn ID → key args → result preview (first 200 chars).
Flag any errors with the error message.

### GUARDIAN REPORT
For each fire: path (pre-turn / post-turn-phrase / hard-wall / carry-forward) → trigger phrase → outcome (heard / missed / pending) → chars injected → grounding preview.
Summarise: N fires, N heard, N missed. Call out any missed fires (Daniela made a memory assertion without archive backup).

### MEMORY SEARCH REPORT
For each neural-net search: query → domains searched → result count → duration ms → character length returned.
Flag searches that returned 0 results (Daniela got nothing back).

### THOUGHT CONTENT HIGHLIGHTS
For each assistant turn that has non-null `thought_content`, show:
- Turn summary (first 50 chars of content)
- Thought excerpt (first 300 chars of thought_content)
This shows what Daniela was actually reasoning about.

### DIAGNOSIS
End with a short paragraph: "Backend was [tight / had gaps]. Issues found: [list or 'none']."
Flag specifically:
- Tool calls that errored
- Guardian fires that were missed (no archive backup)
- Memory searches returning 0 results
- Turns where Daniela's thoughts show she planned to call a tool but the tool call doesn't appear in the timeline

## Real-time monitoring (active session)

To watch a session while it's live, call:

```bash
curl -s -H "x-agent-token: $AGENT_TOKEN" \
  "http://localhost:5000/api/admin/luca/observe" | jq .
```

Key fields in the response:
- `recentToolCalls` — last 8 tools Daniela called (name + secsAgo)
- `guardianAB.recentFires` — last 10 guardian fires with grounding preview
- `guardianAB.pendingCount / heardCount / missedCount` — live tallies
- `recentMemorySearches` — last 10 neural-net searches (query, resultCount, durationMs, domainsHit)
- `recentMessages` — last 10 conversation turns

You can poll this every few seconds to watch a live session. Add `?conversationId=<id>` to target a specific conversation.

## Finding the agent token

The agent token is stored in the environment. In shell scripts:
```bash
AGENT_TOKEN=$(node -e "require('dotenv').config(); console.log(process.env.AGENT_TOKEN || '')" 2>/dev/null)
# Or check the SESSION_SECRET / AGENT_TOKEN env vars
```

Or call from the CodeExecution sandbox using the `viewEnvVars` callback if available, or check `process.env.AGENT_TOKEN`.

## Notes

- `voice_pipeline_events.event_type` values for GL sessions: `gl_tool_call`, `gl_guardian_fire`, `gl_session_heartbeat`, `gl_turn_latency`, `gl_barge_in`, `gl_reconnect_mid_turn`, `gl_session_established`
- `guardian_fires` on `voice_sessions` is the rollup written at session end — if 0/null, the session may have ended unexpectedly before `stop()` ran. The real-time `gl_guardian_fire` events are the durable source.
- `thought_content` on `messages` is Daniela's GL chain-of-thought captured at `generationComplete`. It shows her reasoning before she speaks, including planned tool calls that may or may not have actually fired.
- `neural_network_telemetry` only captures *teaching-domain* searches (`searchTeachingKnowledge`). Student-memory searches (`searchMemory`) are not yet logged there — they appear in `gl_tool_call` events via the `memory_lookup` result preview.

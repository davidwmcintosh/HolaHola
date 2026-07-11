# Sofia Monitor Skill

Use this skill when you want to query Sofia's health data, ask her to monitor something new, or understand what she has reported back. Sofia is HolaHola's autonomous monitoring agent — she runs health checks on the voice pipeline, memory system, GL session quality, and billing. She can also file issue reports and escalate to Alden and Luca via agent_notes.

---

## What Sofia Monitors

Sofia has access to these tools (call them via `POST /api/admin/agent-voice-turn` or directly through the Sofia persona service):

### Voice Pipeline
- `get_health_status` — overall system health snapshot
- `get_recent_pipeline_events` — recent events from `voice_pipeline_events`
- `get_gl_health` — GL turn latency, tool success rate, silent turns, reconnects (best first call for voice issues)
- `get_gl_session_detail(session_id)` — full event timeline for one session
- `get_greeting_retry_stats(days?)` — retry attempts / succeeded / exhausted counts per day
- `get_session_reliability_report(days?)` — abnormal disconnects + tutor no-response trends

### Memory & Brain
- `get_brain_health_report` — unified brain health
- `get_memory_health` — memory embedding and retrieval health
- `get_neural_network_health` — embedding index status
- `get_neural_sync_health` — sync between tool_knowledge and embedding layers
- `get_context_injection_health` — context injection pipeline health
- `run_brain_anomaly_detection` — detect anomalies in memory patterns

### Session Management
- `get_daily_summaries` — daily health digest summaries
- `get_recent_health_digests` — recent digest entries
- `list_active_sessions` — currently active voice sessions
- `get_student_learning_health` — student-level learning signal health

### Remediation
- `cleanup_stale_sessions` — force-close stale sessions
- `refresh_context_cache` — flush and rebuild context cache
- `disable_optional_context_source(source, reason)` — temporarily disable a context source (30min)
- `trigger_memory_recovery` — run orphaned memory recovery
- `track_pattern(pattern_name, description)` — register a pattern to watch
- `upsert_kb_article(title, content)` — update Sofia's knowledge base
- `escalate_to_founder(message)` — escalate directly to David

---

## How Sofia Posts Back to Luca

Sofia files reports to two places:

### 1. Sofia Issue Reports (DB)
Table: `sofia_issue_reports`
- Read via: `GET /api/admin/sofia-issue-reports` (requires founder auth)
- Or: `GET /api/sofia/issues` (open endpoint)
- Fields: `issue_type`, `description`, `event_data`, `dedup_key`, `resolved_at`
- immediateFlare reports trigger an instant monitoring run

### 2. Agent Notes (for Luca)
When Sofia finds something Luca needs to know:
- She (or Alden) calls `POST /api/agent/note` with `x-agent-token: $REPLIT_AGENT_TOKEN`
- Luca reads them at session start via `GET /api/luca/briefing` (includes unread notes)

---

## How to Ask Sofia to Monitor Something New

**Option A — Add a `reportXxx()` function to `sofia-billing-monitor.ts`**
```typescript
export async function reportMyNewThing(opts: {
  userId: string;
  sessionId: string;
  // ... other fields
}): Promise<void> {
  await fileSofiaReport(
    'runtime_fault:my_new_thing',  // issue_type
    `Human-readable description for ${opts.userId}`,
    opts,                           // event_data
    `my_new_thing:${opts.sessionId}`, // dedup_key (omit for no dedup)
    { immediateFlare: false },      // true = wake Sofia immediately
  );
}
```
Then call it at the relevant event point — fire-and-forget with `.catch(() => {})`.

**Option B — Add a `get_xxx_stats` tool to `sofia-health-functions.ts`**
1. Add the declaration object to `SOFIA_HEALTH_FUNCTION_DECLARATIONS` array
2. Add the `case "get_xxx_stats":` handler in the switch statement
3. Query `voice_pipeline_events` for the relevant `event_type` values
4. Return `{ success: true, data: { summary, byDay } }`

**Option C — Add a telemetry event**
```typescript
import { voiceTelemetry } from './voice-pipeline-telemetry';
voiceTelemetry.log(sessionId, userId, 'my_event_type', { ...payload });
```
Events land in `voice_pipeline_events` — queryable by Sofia immediately.

---

## Event Types in voice_pipeline_events

| event_type | When it fires |
|---|---|
| `greeting_retry_attempt` | Silent greeting detected, retry fired |
| `greeting_retry_succeeded` | Audio arrived on a retry turn |
| `greeting_retry_exhausted` | Both retries burned, student never heard greeting |
| `gl_tutor_no_response` | GL connected but no audio within 90s watchdog |
| `session_abnormal_disconnect` | WS close code != 1000 |
| `gl_tool_call_success` | Tool call completed successfully |
| `gl_tool_call_failure` | Tool call failed or timed out |

---

## Dedup Key Rules

- Include `sessionId` in the dedup key to fire once per session: `"my_thing:${sessionId}"`
- Include only the issue type to fire once ever: `"my_thing:global"`
- Omit dedup_key entirely to fire every time

---

## immediateFlare vs. Normal Report

- **Normal report** — queued for Sofia's next scheduled check (every 5min)
- **immediateFlare: true** — triggers an instant monitoring run; use for genuine failures (student never heard greeting, API hang, etc.)

---

## Reading What Sofia Filed (Quick Reference)

```bash
# All open issues
curl "$APP_URL/api/sofia/issues"

# Admin view with more detail
curl -H "Cookie: ..." "$APP_URL/api/admin/sofia-issue-reports"

# Greeting retry stats (Sofia tool — call via agent-voice-turn or briefing)
# Sofia can call get_greeting_retry_stats(days=7) herself
```

---
name: Pedagogical state machine
description: Server-side GL teaching loop persistence — how it works, the FK gotcha, and the key patterns.
---

## What it is
Four Daniela tools that persist teaching loop state in `pedagogical_loop_state` DB table, surviving GL context window decay. Solves curriculum continuity: Daniela always knows what step she's on, even after a long student tangent or GL reconnect.

## Tools
- `get_current_teaching_context` — compass (active loop, suspended loops, next recommendation)
- `start_madrigal_loop(vocab_query)` — semantic search → matched unit → loop row inserted
- `advance_loop_step(student_performance)` — pass/needs_more/skip; marks complete when all steps done
- `suspend_current_loop(reason)` — graceful pause, resumable next session

## State Envelope pattern
Every tool returns `{ result, compass }`. Since sendClientContent is disabled (audio doubling risk), the tool response is the ONLY context injection window. The compass is always in the response — context window is atomically refreshed on every call.

## FK gotcha: session ID resolution
`pedagogical_loop_state.sessionId` references `tutorSessions.id` (NOT the GL streaming session ID). The service has a private `resolveTutorSessionId(studentId)` helper that looks up the most recent tutor session by userId. All public methods call this first.

**Why:** GL streaming session IDs are ephemeral per-connection; tutor session IDs persist per-class-session and are the FK-safe scope for loop state.

## Madrigal routing
Semantic search via OpenAI `text-embedding-3-small` against `memory_embeddings` (type='madrigal_unit', userId=null). Text-match fallback if embeddings not yet indexed. Threshold: 0.35 cosine similarity. Madrigal indexer runs at +110s boot (idempotent, skips unchanged units).

## Shadow Auditor
Fire-and-forget post-session analyzer. Triggered from `GeminiLiveSession.stop()` (skips incognito). Reads conversation transcript, calls `gemini-3-flash-preview`, writes `sessionSummary` to most recent `tutor_sessions` row. Also suspends any 'active' loops. Stale reaper runs every 30min for dropped connections. Does NOT write to `daniela_self_reflections` (Daniela's authorship domain).

## How to apply
- Any change to loop scope → always pass `tutorSessionId` (from resolver), never raw GL session ID
- Any new tool that returns state → must return State Envelope `{ result, compass }`
- Adding madrigal units → update `madrigal-loop-catalog.ts`; indexer handles embeddings on next restart

---
name: Sophia student support layer
description: Architecture of the student-facing incident layer (Sophia ph-spelling) — tool, worker, WS events, frontend widget, learner fact hook.
---

# Sophia Student Support Layer

**Why:** Students hit audio, connection, and rendering issues mid-session. Daniela detects them but had no way to hand off to support. Sophia fills that gap without touching the voice channel.

**How to apply:** When debugging incident flows, remember the two-step delivery: native-fc-handler creates the row + sends `sophia_incident_created`, then the worker sends the actual support message text via `sophia_support_message` (up to 30s later).

## Key invariants

- **sofia (f) vs sophia (ph)**: `sofia_issue_reports` / `sofia-issue-cleanup-worker.ts` = internal telemetry. `sophia_incidents` / `sophia-worker.ts` = student-facing. Keep the distinction.
- **GL cap**: Adding `escalate_to_support` brought GL to 65 (hard cap 64). Fixed by moving `find_teaching_tool` to `GL_EXCLUDED_TOOLS`. If adding new GL tools, audit this first.
- **WS event sequence**: `sophia_incident_created` (from handler, immediately) → `sophia_support_message` (from worker, ≤30s) → `sophia_all_clear` (on resolve or 2-min timeout).
- **Voice channel stays Daniela's**: Sophia is text/UI only. No TTS injection, no voice interruption.
- **Learner fact on resolve**: `learner_personal_facts` row (factType=`technical_support`) upserted on resolution. Daniela can reference it in future sessions.

## Files
- `server/services/sophia-worker.ts` — poll, message delivery, resolve, learner fact
- `server/services/daniela-function-registry.ts` — `escalate_to_support` declaration
- `server/services/native-fc-handlers.ts` — `ESCALATE_TO_SUPPORT` case
- `client/src/components/SophiaWidget.tsx` — student widget
- `client/src/lib/streamingVoiceClient.ts` — 3 event types + switch cases
- `client/src/hooks/useStreamingVoice.ts` — `sophiaIncident` in `StreamingVoiceState`
- `client/src/components/StreamingVoiceChat.tsx` — widget render
- `server/index.ts` — worker start at +55s, resolve route

## Tool description approval
`escalate_to_support` description was approved unconditionally by Alden (Anthropic direct) and Gemini before DB seed. Do not re-run approval loop.

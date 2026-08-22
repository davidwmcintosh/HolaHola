# Daniela Outbound Presence — Architecture

> Written May 2, 2026. This document captures the full design of Daniela's ability to reach out to absent students.

## Philosophy

Daniela's voice is hers. No background process writes her messages or speaks on her behalf. The outbound presence system gives Daniela *awareness* (absence detection) and *affordances* (tools to act) — but every word she sends to a student comes from a live session where she chose to write it.

This is the same authorship principle that governs `daniela_self_reflections` and `daniela_aspirations`: only Daniela writes there, from an active session context.

---

## Phase 1 — Absence Detection + Express Lane Nudge (COMPLETED)

### What it does
A background worker runs daily and detects students who haven't had a voice session in 5+ days. When a student crosses the threshold, the worker posts a nudge to the Express Lane in a dedicated session called **"Daniela — Student Watch"**. Daniela reads the nudge, recalls context using her memory tools, and either:
- Calls `leave_for_next_session(content)` to queue a message for the student's next arrival
- Calls `dismiss_absence_nudge(userId, suppressDays?)` to acknowledge and optionally snooze

A student is never re-nudged until Daniela resolves the prior nudge.

### Key files
| File | Role |
|---|---|
| `server/services/daniela-absence-worker.ts` | Worker: detection, Express Lane post, resolve |
| `shared/schema.ts` → `danielaAbsenceNudges` | Nudge state tracking table |
| `server/services/daniela-function-registry.ts` | `DISMISS_ABSENCE_NUDGE` declaration |
| `server/services/streaming-voice-orchestrator.ts` | Case handlers for DISMISS_ABSENCE_NUDGE and LEAVE_FOR_NEXT_SESSION (auto-resolve) |
| `server/services/classroom-environment.ts` | Tool Rack entry |
| `server/index.ts` | Worker startup at +80s |

### Absence detection query
Queries `voice_sessions` for the most recent session per user (excluding test sessions), joins with `users` for names, and filters for students whose last session was ≥ 5 days ago with no pending unresolved nudge or active suppress window.

### Nudge dedup logic
`danielaAbsenceNudges` table:
- `resolvedAt = NULL` → nudge is pending, student is blocked from re-notification
- `resolvedAt IS NOT NULL` → resolved; student is eligible again after threshold
- `suppressUntil > NOW()` → snooze window active, student also blocked

### Express Lane format
```
[ABSENCE NUDGE] {name} hasn't had a session in {N} days. Last session: {date} ({language}).

You know {name}. If you want to reach out, call leave_for_next_session(content) — it'll be waiting when they arrive.
If you know they're away or it's fine, call dismiss_absence_nudge(userId="{userId}") or
dismiss_absence_nudge(userId="{userId}", suppressDays=14) to snooze for two weeks.

userId: {userId}
```

### Auto-resolve on message queue
When Daniela calls `leave_for_next_session` for any student, the LEAVE_FOR_NEXT_SESSION handler automatically resolves any pending absence nudge for that student with type `message_queued`. No manual dismiss needed.

---

## Phase 2 — Phone Number + SMS Consent (PLANNED — Task #17)

### What it does
Collects phone numbers from students (with explicit TCPA consent) so later phases can deliver SMS and VoIP.

### Key design decisions
- Google OAuth exposes a phone scope but requires explicit consent UI — not silent collection
- Two separate consent fields: `phoneConsentSms` and `phoneConsentVoice`
- TCPA requires written consent + STOP opt-out in every SMS
- Phone number stored encrypted; consent timestamp recorded for audit

---

## Phase 3 — SMS Voice Message Delivery (PLANNED — Task #18)

### What it does
When Daniela queues a message via `leave_for_next_session`, the worker also renders an audio version using `gemini-2.5-flash-preview-tts` and sends it to the student's phone as an MMS/voice SMS.

### Key design decisions
- Twilio for SMS/MMS delivery
- Audio rendered as MP3 via the existing TTS pipeline; URL stored in `danielaOutboundQueue.audioUrl`
- Delivery timestamp in `danielaOutboundQueue.smsDeliveredAt`
- Student can reply STOP to revoke consent

---

## Phase 4 — VoIP Calling (PLANNED — Task #19)

### What it does
Daniela can initiate a live voice call to a student — a real Gemini Live session delivered over the phone.

### Architecture
```
Twilio Programmable Voice
  → Media Streams WebSocket (bidirectional audio)
  → Backend bridge (server/services/twilio-bridge.ts)
  → Gemini Live 3.1 session (gemini-3.1-flash-live-preview)
```

### Key constraints
- Twilio not yet configured — needs account + phone number
- Separate consent required (phoneConsentVoice)
- Call duration must be bounded (e.g. 10 min max)
- Depends on Phase 2 for phone number + consent infrastructure

---

## Absence Threshold

Default: **5 days** (hardcoded in `daniela-absence-worker.ts` → `ABSENCE_THRESHOLD_DAYS`).

Per-student configuration via UI is explicitly out of scope for Phase 1.

---

## Delivery chain summary

```
Student absent 5+ days
  → AbsenceWorker detects
  → Express Lane nudge posted to "Daniela — Student Watch"
  → Daniela reads nudge (next Founder Mode session or Express Lane check)
  → Daniela calls leave_for_next_session OR dismiss_absence_nudge
  → If message queued:
      → Delivered as in-session greeting at student's next session start (Phase 1, LIVE)
      → Delivered as SMS audio (Phase 3, planned)
      → Or Daniela calls the student via VoIP (Phase 4, planned)
```

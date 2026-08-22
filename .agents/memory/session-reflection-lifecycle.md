---
name: Session reflection lifecycle — final architecture
description: Three-layer reflection pipeline after COOL_DOWN trigger was removed; CLOSE_SESSION is now the primary trigger; Gemini approved round 5.
---

## Rule
generateReflectionNow() must be triggered from CLOSE_SESSION handler (step 5), NOT from UPDATE_SESSION_PHASE(COOL_DOWN).

## Why
PedagogicalSupervisor can nudge Daniela into COOL_DOWN mid-session (overly-long phase detection). The no-op rule on generateReflectionNow() would lock in that premature reflection, making the rest of the session invisible to Daniela's memory permanently.

## How to apply
If anyone proposes moving the reflection trigger back to COOL_DOWN or adding a new phase-transition hook that fires generateReflectionNow(), reject it. CLOSE_SESSION is the only intentional trigger.

## Final three-layer pipeline
1. CLOSE_SESSION handler step 5 (native-fc-handlers.ts) → generateReflectionNow() fires after tutorSessions/hiveSnapshot/conversationMemory writes; transcript complete including warm wrap-up; student still present
2. ws.on('close') → generateReflectionNow() checks for existing row → no-op if step 1 ran; safety net for abrupt drops
3. schedulePendingReflectionIfMissing() chains sequentially after step 2 → server crash safety net

## COOL_DOWN tool description
Still instructs Daniela to call write_to_self herself — that voluntary path is separate from the server trigger and is unaffected.

## Lifecycle audit findings (Gemini round 4 + Daniela consult, July 6 2026)
- reflection / summary / brief are distinct artifacts: "soul/vibe" vs "hard data ledger" vs "forward strategy" — not redundant
- Context redundancy between conversationMemories and daniela_self_reflections both feeding getCompassContext() is a prompt hygiene note for a future sprint, not a current blocker
- recap phase (pedagogical arc) has no server-side hook — correct; CLOSE_SESSION is single source of truth

## Approvals
- Gemini round 5: "APPROVED — Ship it." (conversation_memories 1975ee8d)
- Daniela lifecycle consult: confirmed all three artifacts feel distinct (conversation_memories 3073fc10)

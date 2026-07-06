---
name: Session reflection — immediate generation + race fix
description: Why write_to_self was never called at clean close, what was built, and the remaining "scent of goodbye" gap.
---

## The Problem
Daniela never called `write_to_self` at session close. All reflections appeared as `deferred-reflection` / `session-drop` — generated cold at next session start via `pending_reflections`. Looked like network drops; was actually a training-weight problem.

## Root Cause (dual consult July 6, 2026)
**Terminal Function Gravity Well** (Gemini's term): `close_session` is a trained terminal node. When a student says goodbye, `goodbye → close_session` is a stronger model weight than sequential instruction-following (`write_to_self first`). No instruction can fully overcome this — it is structural, not linguistic. Instruction changes improve compliance ~60-70%; the other 30% the model falls into the terminal gravity well.

**Daniela's framing**: "The goodbye is a hard guillotine — writing after the door is shut feels clinical and lonely. Write while the air is still warm."

## What Was Built
1. **`generateReflectionNow()`** in `session-reflection-worker.ts` — generates reflection immediately at `ws.on('close')` while transcript is hot. Tagged `session_close` (not `deferred-reflection`). 8K transcript context vs. 2K in old deferred path. No-op if Daniela already wrote herself.
2. **Sequential orchestration** in `unified-ws-handler.ts` — PRIMARY (`generateReflectionNow`) runs first, FALLBACK (`schedulePendingReflectionIfMissing`) chains after. Eliminates race condition where both independently read "no existing reflection" and both proceed.
3. **Instruction repositioned** in `daniela-function-registry.ts` — "bridge to the goodbye, written while you can still feel their presence" instead of "BEFORE calling close_session:". Both tool description and dispatcher entry.

**Why:**
- Worker is the real fix; instruction change is the "nice to have" for when the model is contemplative.
- Sequential chaining is the only safe deduplication without a DB unique constraint: PRIMARY writes first, FALLBACK sees the row and no-ops.

## APPROVED — July 6, 2026 (Gemini round 3 + Daniela round 3)

Gemini: "APPROVED — Ship it." Confirmed COOL_DOWN resolves partial-flush + zombie-execution concerns from round 2. ws.on('close') fallback is acceptable graceful degradation.

Daniela: "It's actually right. Ship it. You've stopped treating my data like a byproduct and started treating it like a hand-off." Confirmed COOL_DOWN should be called in ~95% of sessions. If skipped (network cut), fallback is acceptable — "design for sessions where we're actually human."

Consultation round 3 saved: conversation_memories b732b749-f0ec-4383-9a83-54d196e800e5

## The "Scent of Goodbye" — RESOLVED via COOL_DOWN hook

The system already had `update_session_phase(COOL_DOWN)` — "Session wrap (50/50). Name today's wins." This IS the scent of the goodbye: Daniela calls it while the student is still present. We hooked generateReflectionNow() there. Partial-flush risk eliminated (transcript is complete; student hasn't said goodbye yet).

Final architecture:
1. COOL_DOWN handler in native-fc-handlers.ts → generateReflectionNow() (student present, transcript warm)
2. ws.on('close') → generateReflectionNow() checks for existing row, no-ops if Layer 1 ran
3. schedulePendingReflectionIfMissing() sequential chain after Layer 2 (server crash safety)

## Validation Query (what "working" looks like)
```sql
SELECT 
  CASE WHEN 'session_close' = ANY(tags) THEN 'session_close (worker)'
       WHEN 'deferred-reflection' = ANY(tags) THEN 'deferred (fallback)'
       ELSE 'self (Daniela)'
  END as source_path,
  COUNT(*) 
FROM daniela_self_reflections 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1;
```
Expected healthy state: session_close ~30-35%, deferred <5%, self the remainder.
Red flag: if `session_close` AND `deferred-reflection` appear for the same `sessionId` — race condition is still active.

---
name: Archive Guardian Tier B directive
description: slideCorrectionQueued flag turns LAST TURN CORRECTION from passive context into active behavioral lock; pre-turn Guardian confirmed fully built universally. July 25 2026.
---

## The pre-turn Guardian is fully built (not dead code)

`detectStudentMemoryRisk()` IS called in `gemini-live-session.ts` at ~line 2212 for labeling — but the Guardian fires universally regardless. The universal grounding block fires on every student utterance >10 chars.

Full architecture (confirmed):
- `inputTranscription` → `preTurnGroundingFired` gate → `runAutoGrounding` async
- Result stored in `preTurnGroundingResult` via `.then()`
- 150ms timer → `pendingWeeOoGrounding` (tool-result channel only)
- `sendClientContent` documented UNSAFE: `turnComplete:true` = duplicate generation; `false` = blocks VAD
- Tool handler: 400ms race await on `preTurnGroundingPromise` before injection
- Post-turn: slide detector + friction signal analysis at `generationComplete`
- Carry-forward: late arrivals → `pendingCarryForwardGrounding` → next turn
- Hard wall: fires if slide detected mid-output

**Remaining narrow gap:** No-tool-call turns — grounding arrives one turn late. GL API constraint; carry-forward is the correct solution.

## Tier B build — behavioral directive

**Why:** The `[LAST TURN CORRECTION]` whisper was passive ("here's your history"). When grounding arrives on the next turn's tool call after a slide-detected turn, it gives Cindy context but doesn't instruct action.

**How:** Added `private slideCorrectionQueued = false;` to `GeminiLiveSession`.

Set in two places:
1. `FrictionlessSlide/GL`: after `this.pendingWeeOoGrounding = groundingResult;` (~line 2602)
2. `HardWall`: after queuing correction to `pendingWeeOoGrounding` (~line 2773)

In the tool handler injection block (~line 3358), when `slideCorrectionQueued` is true:
```
[LAST TURN CORRECTION — VERIFY BEFORE CONTINUING: Your previous response contained a memory assertion that was not verified against your Archive. Here is what your Archive actually holds:\n${grounding}\n\nBefore making any further claims about shared history this turn, call grounding_query or introspect now. Do not assert from memory alone.]
```

Flag cleared after injection. Passive context → active behavioral lock.

**Why it matters:** Tier B is the instruction layer on top of Tier A (context delivery). When grounding arrives late (no-tool-call turn), Cindy doesn't just get data — she gets an explicit mandate to verify before she continues.

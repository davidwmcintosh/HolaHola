---
name: Archive Guardian Tier B directive
description: slideCorrectionQueued flag turns LAST TURN CORRECTION from passive context into active behavioral lock. Gemini-approved wording July 25 2026.
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

**Why:** The `[LAST TURN CORRECTION]` whisper was passive ("here's your history"). When grounding arrives on the next turn's tool call after a slide-detected turn, it gives Daniela context but doesn't instruct action.

**How:** Added `private slideCorrectionQueued = false;` to `GeminiLiveSession`.

Set in two places:
1. `FrictionlessSlide/GL`: after `this.pendingWeeOoGrounding = groundingResult;` (~line 2602)
2. `HardWall`: after queuing correction to `pendingWeeOoGrounding` (~line 2773)

In the tool handler injection block (~line 3358), when `slideCorrectionQueued` is true, uses the Gemini-approved wording (see below). Flag cleared after injection.

## Gemini-approved wording (approved July 25 2026, memory: 3fd6432a)

```
[LAST TURN CORRECTION — ARCHIVE SYNC: Our shared history contains specific records relevant to your last turn. Archive Data:
{grounding data}

To ensure we stay aligned, please use grounding_query or introspect to reconcile this information before making further assertions about our shared history.]
```

This lands inside the outer `[ARCHIVE GUARDIAN: ...]` bracket, so the full injection is:
```
[ARCHIVE GUARDIAN:
[LAST TURN CORRECTION — ARCHIVE SYNC: ...]]
```

**What Gemini rejected:** "Your previous response contained a memory assertion that was not verified" — meta-critical, triggers defensive/apologetic voice output, breaks immersion.

**What Gemini confirmed:**
- `ARCHIVE SYNC` = sounds like a system process not a reprimand
- `"To ensure we stay aligned"` = persona-consistent motivation for the tool call
- Nested bracket structure `[ARCHIVE GUARDIAN: [SUB-LABEL: ...]]` = confirmed effective; outer bracket = System/Guardian layer, inner = Contextual Trigger
- Behavioral mandate ("use grounding_query or introspect") effective as Tier B lock when framed as accuracy requirement not mistake correction

**Why it matters:** Tier B is the instruction layer on top of Tier A (context delivery). When grounding arrives late (no-tool-call turn), Daniela doesn't just get data — she gets a mandate to verify before she continues.

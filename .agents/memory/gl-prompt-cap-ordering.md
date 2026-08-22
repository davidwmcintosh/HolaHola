---
name: GL system prompt cap and ordering
description: The 34K hard cap trims from the END; the full assembled prompt is 40K+; fix is compact classroom + priority reorder.
---

## The Rule
For Gemini Live sessions, always assemble the system prompt in priority order:
  1. Compact classroom (~1.5K)
  2. GL_DISPATCHER_SYSTEM_PROMPT (~4K)
  3. Persona / language rules (as much as fits in 34K)
  4. Neural net / TOC (trimmed by cap — acceptable)

## Why
The GL system prompt hard cap is ~34,033 chars, trimming from the END.
The assembled base prompt (persona + dispatcher + neural net + TOC) is 40K+.
Any content appended or naively prepended beyond the cap gets silently dropped.

The classroom block was 14K chars — larger than many sections of the persona.
Even with a prepend, a 14K classroom + 36K base = 50K → cap keeps first 34K,
meaning only the first 20K of the base persona survives and the dispatcher (at ~36K) is gone.

The "✓ Classroom context baked" log fires BEFORE the cap trim — it was always a false positive.

## How to Apply
- `buildClassroomEnvironment({ isGL: true })` — returns compact ~1.5K block
  (strips toolRack, studentProgressBoard, patternCompass, northStarWall, identityWall, textbook)
- In unified-ws-handler.ts GL session setup:
  ```
  const baseWithoutDispatcher = geminiLiveSystemPrompt.replace(GL_DISPATCHER_SYSTEM_PROMPT, '');
  geminiLiveSystemPrompt = classroomCtx + '\n\n' + GL_DISPATCHER_SYSTEM_PROMPT + '\n\n' + baseWithoutDispatcher;
  ```
- Log confirms: `[GeminiLive] ✓ System prompt REORDERED: classroom(N) + dispatcher(N) + persona(N) = N chars total`
- If classroom chars >> 2000, the isGL compact path is not firing.
- Future optimization: dynamic tool registration (only 10-15 relevant tools vs. all 40) could free another 10K+.

**Established:** June 13, 2026

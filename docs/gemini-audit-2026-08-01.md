# Gemini Audit — Task #338 (Text-mode memory chain nudge: once-per-streak)
**Date:** 2026-08-01  
**Auditor:** Gemini 3-flash-preview  
**Triggered by:** Post-merge Gemini gate (daniela-caller.ts changed without audit doc)

## What was reviewed
Task #338 added `textMemoryNudgeSent` flag to `runDanielaFCLoop()` in `server/services/daniela-caller.ts`. Change: text-mode memory chain nudge now fires **once per streak** (matching GL's `glMemoryNudgeSent` pattern) instead of on every turn at or beyond `MEMORY_CHAIN_LIMIT`. Flag resets when the streak breaks.

## Gemini verdict: APPROVED — no further comments

**Q1: Is once-per-streak the right behavior for text-mode?**  
Yes. Repeated nudges within the same turn-sequence cause "instruction fatigue." If the model ignores the first nudge, repeating the same string rarely changes the outcome — it consumes tokens and may increase hallucination. One clear redirect per streak is the correct signal.

**Q2: Any risk in the reset logic?**  
No. Reset on streak break ensures a new spiral later in the same conversation still gets the nudge. Correct state machine behavior.

**Q3: Interactions with the FC loop?**  
Minimal. Appending to `last.functionResponse.response.output[0].text` is the standard steering pattern. `functionResponseParts.length > 0` check prevents edge-case crash.

**Minor observation (non-blocking):** Confirm `MEMORY_CHAIN_NUDGE_TEXT` starts with a clear delimiter (newline or system label) so the model distinguishes tool output from the steering instruction.

## Audit table entry
| Date | File/area changed | Audit doc | Outcome |
|------|-------------------|-----------|---------|
| 2026-07-31 | `buildActclPersonaAnchor` + pattern signal injection | `docs/gemini-audit-2026-07-31.md` | Approved. Null guard bug caught and fixed. |
| 2026-08-01 | `runDanielaFCLoop` — text-mode nudge once-per-streak | `docs/gemini-audit-2026-08-01.md` | Approved with no further comments. |

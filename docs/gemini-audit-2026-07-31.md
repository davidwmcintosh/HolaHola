# Gemini Audit — Task #10 (Pattern Signals in Mid-Session ACTFL Anchor)
**Date:** 2026-07-31  
**Auditor:** Gemini 3-flash-preview  
**Triggered by:** Post-merge review (task merged without pre-approval loop)

## What was reviewed
Task #10 extended `buildActflPersonaAnchor()` to carry wobbling/pounding grammar pattern signals from the greeting into every subsequent per-turn injection. Two refresh points added in PTT and OpenMic RECORD_PATTERN_SIGNAL handlers. Session field `activePatternSignals` seeded at greeting.

## Gemini verdict: 8/10 logic, 9/10 architecture — one real bug

### Bug found: "Sticky Pattern" null guard
`if (refreshed !== null) session.activePatternSignals = refreshed;` in both PTT and OpenMic handlers prevents clearing the session state when all patterns resolve to `stable`. Daniela would continue drilling mastered patterns for the rest of the session.

**Fix applied immediately (Luca, 2026-07-31):** Both instances changed to `session.activePatternSignals = refreshed;` — null now correctly clears stale patterns.

### Architecture approved
- Per-turn anchor is the correct placement for Gemini Flash (recency bias — last thing before student utterance)
- 5-line cap + `|` join prevents token bloat (10/10 performance)
- "Active grammar patterns:" label format is fine; Gemini's suggestion of `[PEDAGOGICAL STATE]` label held for future discussion (bracket patterns reserved for Guardian/system labels)

### Text-mode gap (accepted tradeoff)
Text-mode path doesn't get `activePatternSignals`. Noted as a gap. Low priority — pattern signals are most impactful in voice sessions where drilling patterns in real-time matters.

### Async race (accepted tradeoff)  
DB refresh may complete one turn after the RECORD_PATTERN_SIGNAL event in GL streaming. Stable behavior — refresh is for next turn, not current response.

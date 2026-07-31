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

---

# Gemini Audit — Task #240 (Text-mode pattern signal injection — voice→text gap)
**Date:** 2026-07-31  
**Auditor:** Gemini 3-flash-preview (two-round loop)  
**Triggered by:** Pre-merge requirement per `docs/GEMINI_REQUIRED.md`

## What was reviewed
Added `activePatternSignals?: string | null` to `RunDanielaFCLoopParams`. When provided, injected into the system prompt before the first `generateContent` call — same pipe-joined, 5-line-capped format as `buildActflPersonaAnchor` in voice. Closes the gap where a student switching from voice to text mid-session loses all active grammar pattern context.

## Round 1 findings (not approved — two issues flagged)

### Issue 1: Logic duplication
The `split('\n').map.filter.slice` parsing block was copied inline into `daniela-caller.ts` instead of shared. A future format change would drift the two paths.

**Fix:** Extracted into `formatActivePatternSignalNote(signals: string | null | undefined): string` in `pattern-signal-context.ts`. Both `buildActflPersonaAnchor` (voice) and `runDanielaFCLoop` (text) now call this single function.

### Issue 2: Missing newline separator
Appending to `systemPrompt` without checking for a trailing newline could merge the injection with a closing instruction on the same line.

**Fix:** `systemPrompt + (systemPrompt.endsWith('\n') ? '' : '\n') + patternSuffix.trimStart()` guarantees exactly one newline between the base prompt and the injection.

## Round 2 verdict: **Ship it.**

Gemini confirmed both fixes address the flagged issues fully. Two hygiene notes (non-blocking):
- `formatActivePatternSignalNote` adds a leading `\n` which `runDanielaFCLoop` immediately strips with `trimStart()` — slightly redundant but safe; ensures `buildActflPersonaAnchor` keeps its required newline without needing a special case.
- The `-`/`•` filter is excellent input safety — blobs of text can't pollute the prompt.

**Full logic flow verified:** shared helper → voice path (leading `\n` for temporalAnchor gap) → text path (endsWith guard for systemPrompt gap) → Daniela's pattern context consistent across both modalities.

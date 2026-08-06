---
name: Guardian injection — PRIOR TURN CONTEXT label and pipeline fixes
description: Five bugs found and fixed in the pre-turn Guardian whisper construction during Gemini audit Aug 6 2026.
---

# Guardian injection — PRIOR TURN CONTEXT label and pipeline fixes

**Gemini audit Aug 6 2026. Five distinct bugs fixed.**

## The label decision
`[LUCA — COLLEAGUE NOTE: ...]` was rejected by Gemini as dishonest framing. When the content is Daniela's own archive data (retrieved by the Guardian's three-phase lookup), labeling it as coming from a "colleague" causes persona drift: Daniela treats Luca as the source of truth for her own memory. Approved replacement: `[PRIOR TURN CONTEXT: ...]` — neutral, accurate, no authorship implied.

When Luca later writes *actual external observations* to the session-context store, revisit the label at that time.

## The five bugs

### 1. Double-injection gate (postToTeamRoom)
`runAutoGrounding` at the pre-turn call site passed `{ writeToDb: false, notifyLuca: false }` but NOT `postToTeamRoom`. Since `undefined !== false`, the postToTeamRoom block executed: `setLucaSessionContext(conversationId, content)` stored content, then `consumeLucaSessionContext` 150ms later returned the identical content. Same data delivered twice in one whisper.

**Fix:** Pass `postToTeamRoom: false` explicitly at the pre-turn call site.

### 2. Passenger problem (early exit discards lucaCtx)
Original early exit: `if (!this.preTurnGroundingResult || ...)`. If the pre-turn DB lookup was slow (>150ms) and returned null, the early exit fired AFTER `lucaCtx` was already consumed from the session store — silently dropping a prior-turn correction with no way to recover it.

**Fix:** Consume `lucaCtx` BEFORE the early exit. New gate: only exit if ALL of `preTurnGroundingResult`, `lucaCtx`, AND `pendingCarryForwardGrounding` are falsy.

### 3. ReferenceError in dedup check
Dedup used `result?.includes(...)` — `result` was the `.then()` closure variable which might differ from `this.preTurnGroundingResult` at evaluation time inside the setTimeout.

**Fix:** Use `this.preTurnGroundingResult?.includes(...)`.

### 4. lucaCtx lost on late-arrival carry-forward
Late-arrival path saved `this.preTurnGroundingResult` to `pendingCarryForwardGrounding` then returned. But `lucaCtx` had already been consumed from the session store at the top of the function — the return discarded it permanently.

**Fix:** Merge `lucaCtx` into `carryBuffer` before assigning to `pendingCarryForwardGrounding`: `carryBuffer = \`[PRIOR TURN CONTEXT: ${lucaCtx}]\n${grounding}\``.

### 5. Contradictory confidence signals ("The well is deep" + PRIOR TURN CONTEXT)
If `preTurnGroundingResult` was empty but `lucaCtx` existed, the old code would produce `[PRIOR TURN CONTEXT: X]\n[ARCHIVE GUARDIAN: The well is deep and still...]` — a correction followed by a "nothing found" message. Contradictory.

**Fix:** Build parts conditionally. "The well is deep" only fires when ALL of `lucaCtxDeduped`, `pendingCarryForwardGrounding`, AND `preTurnGroundingResult` are falsy. Parts joined with `\n\n` for clean block separation.

## Why
**Why:** [LUCA — COLLEAGUE NOTE] was the initial label when the feature was scaffolded in one session. Gemini audit (required by Gemini approval gate rule) caught the framing problem and all four code bugs before they reached a live session.

## How to apply
Any future change to the pre-turn Guardian whisper construction must:
1. Consume `lucaCtx` before any early-exit guard
2. Merge all components (lucaCtx, carry-forward, current grounding) into `carryBuffer` before any `return` in the late-arrival path
3. Never use label names that imply external authorship when the content is Daniela's own archive data
4. Run `postToTeamRoom: false` explicitly on all pre-turn `runAutoGrounding` calls (notifyLuca:false should match)

---
name: Instructional Piggybacking — SHIPPED
description: SESSION ANCHOR injected every 10 student turns inside [ARCHIVE GUARDIAN: ...] bracket — nested sub-label format, Gemini-approved prose and structure. July 26 2026.
---

## What It Is

A mechanism to counteract GL system prompt attention fade in long sessions. Every 10 student turns, a `[SESSION ANCHOR: ...]` sub-label is folded inside the existing `[ARCHIVE GUARDIAN: ...]` bracket, immediately before Daniela generates her response.

**Why this works:** Tool results sit at position N in the context window — the most recent, highest-attention-weight position. The system prompt sits at position 0 and loses salience as the session grows. Instructional Piggybacking moves core behavioral directives from position 0 to position N, refreshing them at every injection point.

Gemini confirmed (July 26 2026, DB: `036309ca`): "Treat the tool-result body not just as a data carrier, but as a behavioral steering wheel."

## Status: SHIPPED — July 26 2026. Typecheck clean.

## Approved Wording (Gemini — DB: `b5503bea`)

> The heart of this session is the language itself. I am a teacher first; my warmth serves the lesson, and my words are chosen for their impact. The Archive is the bedrock of my memory; I speak from its truths, and where the record is silent, I prefer the honesty of the unknown over the friction of a guess.

Style: "Internalized Intuition" — prose she surfaces from within, not a command handed to her.
Rejected: Alden's draft ("Remember your purpose," "Fewer words, more impact") — imperative commands trigger external-instruction persona shift.

## Approved Structure (Gemini — DB: `777d0f55`)

Nested sub-label `[SESSION ANCHOR: ...]` inside `[ARCHIVE GUARDIAN: ...]`, consistent with `[LAST TURN CORRECTION]` and `[CURRENT CONTEXT]`.

```
[ARCHIVE GUARDIAN:
[LAST TURN CORRECTION — ARCHIVE SYNC: ...]   ← Tier B (slide detected)
[CURRENT CONTEXT: ...]                         ← Archive Guardian (pre-turn grounding)
[SESSION ANCHOR: The heart of this session...]] ← every 10 student turns
```

**Why nested, not raw prose:** Without the label, the anchor sits as raw text next to `[CURRENT CONTEXT]`. The attention system may semantically merge them — "warmth" or "honesty" could be interpreted as specific instructions for the active scenario rather than universal identity. The `[SESSION ANCHOR: ...]` label categorizes the content type: foundational reminder of her nature, not factual correction.

**Why NOT a separate outer bracket:** Gemini (DB: `036309ca`) flagged "double bracket risk" — two competing top-level brackets at position N create interference. The nested approach gives the anchor Guardian-level priority without that conflict.

**Why 10-turn interval:** Gemini (DB: `777d0f55`) named 10 the "sweet spot." More frequent = "Instructional Fatigue" (model ignores or recites the anchor to the student). Less frequent = insufficient re-exposure as sessions grow.

## Implementation

- `sessionStudentTurnCount` field on `GeminiLiveSession` class
- Incremented at `generationComplete` (same reset point as `preTurnGroundingFired`)
- `SESSION_ANCHOR_INTERVAL = 10` static constant
- Fires when `sessionStudentTurnCount > 0 && count % 10 === 0`
- Log: `[ArchiveGuardian/anchor] Session Anchor injected at turn N`
- Key file: `server/services/gemini-live-session.ts` (~lines 405-409, 2790, 3413-3432)

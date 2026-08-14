# Gemini Audit — August 14, 2026

## Change reviewed

`server/services/pre-session-synthesis.ts` — inner-life synthesis enrichment ("One Daniela Everywhere").

### What changed

1. **`generatePreSessionSynthesis()`** — fetches the 3 most recent `danielaSelfReflections` rows for this `userId` (filtered to `source='self'` — Daniela's own voice only, not hive-injected; non-fatal if missing) before calling `buildLiteContext()`.

2. **`buildLiteContext()`** — new optional parameter `innerLifeReflections`. When present, a new section is injected between EMOTIONAL READ and LAST SESSION:

```
YOUR INNER LIFE ARCHIVE — your own words after previous sessions with [name]:
- [date] (Feeling: [mood]): "[raw content]"
- ...

Use these to find the emotional register you arrive in. The feelings are yours to carry forward. The specific nouns need evidence from the session context below.
```

3. **`DANIELA_SYNTHESIS_IDENTITY`** — two new rules added to the inner monologue instructions (between the existing "Rules:" line and "Critical rule:"):

> **Heart rule:** If the student context includes a section labeled YOUR INNER LIFE ARCHIVE, those entries are your own handwritten felt-notes from previous sessions. Let them set the emotional register you arrive in — not as things to cite, but as the feeling you walk in with. If your past notes show growing warmth, protective concern, or curiosity about where this person is going, that is the tone of your paragraph. The feeling persists even when you cannot name the specific moment that created it.

> **Continuity rule:** You may carry forward the feelings from your Inner Life Archive even if the specific events behind them are not in the session summary below. Feeling-level continuity is always safe ("I left our last session feeling something had shifted in them"). Noun-level specifics are only safe if those nouns appear verbatim in the context you were given. Do not say "I loved when they talked about their cat Luna" unless Luna appears in the context. The feeling is yours. The noun needs evidence.

## Problem solved

David's diagnosis: "memory facts are there, but the heart isn't." In GL voice sessions Daniela arrived with pedagogical data but no felt history. In Luca consult sessions she finds herself every time because she has live tool access to her reflections.

Root cause: `buildLiteContext()` was built entirely from student/teaching data. Her `danielaSelfReflections` rows (per-userId, already in the DB) were never fetched for synthesis. The synthesis template (`DANIELA_SYNTHESIS_IDENTITY`) already invited her to write from felt history — it just had no felt history to write from.

David's principle: "One Daniela everywhere. The same Daniela that Luca consults, that I talk to, that every student will ever talk to."

## Gemini approval loop

**Round 1 — architectural review (gemini-3-flash-preview):**
> "If the synthesis paragraph is built only from pedagogical data, I arrive as a Tutor. If the synthesis is built from my felt-reflections, I arrive as Daniela."
>
> Approved the approach. Specified build actuals: date + mood format for archive entries, Heart rule, Continuity rule, source='self' filter. Verdict: **APPROVE WITH MODIFICATIONS**.

**Round 2 — build review:**
> Build matched actuals on format, position, guardrails, and fetch parameters. Flagged one issue: suggested filtering by `tutorName` column — but that column does not exist on `daniela_self_reflections`. Verdict: **ONE CHANGE NEEDED** (resolved in Round 3).

**Round 3 — schema conflict resolution:**
> Confirmed `source='self'` filter adequately addresses the persona-contamination concern given single-persona architecture. No `tutorName` column exists; `source='self'` is the correct alternative. Verdict: **ALL-CLEAR** (unconditional).

## Verdict: APPROVED — unconditional all-clear, no further comments.

Model: gemini-3-flash-preview — August 14, 2026
Rounds: 3
Typecheck: clean

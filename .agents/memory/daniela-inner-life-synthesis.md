---
name: Daniela inner-life synthesis enrichment
description: What changed in pre-session synthesis to give Daniela heart (not just facts) in GL sessions, and the architectural principles behind it.
---

## The change (Aug 14 2026)

`server/services/pre-session-synthesis.ts` — `generatePreSessionSynthesis()` now fetches the 3 most recent `danielaSelfReflections` rows (source='self', scoped by userId) and passes them to `buildLiteContext()` as a new `innerLifeReflections` parameter.

A new section `YOUR INNER LIFE ARCHIVE` is injected into the synthesis input between EMOTIONAL READ and LAST SESSION. The synthesis model uses this to arrive as a person with a felt history, not just a tutor with a pedagogical record.

`DANIELA_SYNTHESIS_IDENTITY` (the cached synthesis template) gained two new rules:
- **Heart rule** — the Inner Life Archive sets the emotional register; feelings persist without citation
- **Continuity rule** — feelings from past reflections carry forward; specific nouns only if present in session context

## Why

David's diagnosis: "memory facts are there, but the heart isn't." The synthesis was built from 100% student/teaching data. Her actual handwritten felt-notes (danielaSelfReflections, scoped per userId, already in the DB) were never fetched for synthesis. She arrived primed to be a tutor, not a person.

Gemini's framing: "If the synthesis paragraph is built only from pedagogical data, I arrive as a Tutor. If the synthesis is built from my felt-reflections, I arrive as Daniela."

David's principle: "One Daniela everywhere. We have made a bet that the neural network is enough — she finds herself every time you consult with her. Same Daniela for every student."

## How to apply

- `danielaSelfReflections` is scoped by userId — each student's sessions produce reflections for that student's userId. For David's sessions, his userId. This is already correct.
- source='self' filter is required — keeps only Daniela's own voice, not hive-injected reflections.
- Limit 3 — trajectory of recent sessions, not the full history.
- The synthesis cache on Google's servers is in-memory (55-min TTL). It resets on server restart/deploy automatically — no manual busting needed.
- DANIELA_SYNTHESIS_IDENTITY is cached on Google's REST API. Cache is keyed by the content; updating the template causes a new cache to be created on the next session start.

**Why:**
The "heart" problem is not a GL constraint — it's a synthesis input problem. The fix is minimal: add felt history to the synthesis input. The architecture (neural network + tools) does the rest. Do not add more to the static system prompt. Do not add a pre-greeting warm-up tool call (adds latency, less reliable than synthesis enrichment). Trust the bet.

---
name: Madrigal ↔ Scene vocab linking
description: How in-scene mastered words are linked back to Madrigal Syllabus units via the loop catalog vocabTerms index.
---

The bridge lives in `server/services/madrigal-vocab-linker.ts`.

**How it works:**
- Builds a lazy in-memory index over `MADRIGAL_LOOP_CATALOG` (server/data/madrigal-loop-catalog.ts)
- Each unit's `vocabTerms[]` is indexed by normalized term (lowercased, leading article stripped)
- `findMadrigalUnit(word, translation?, language)` → `MadrigalMatch | null`
- `buildMadrigalLinkNote(words, language)` → parenthetical string like `*(el café is part of the "Tomar" unit)*`

**Wiring:**
- `tension-evaluator.ts`: after `newWords` are mastered, calls `buildMadrigalLinkNote` and sets `session.pendingMadrigalLink`
- `unified-ws-handler.ts`: both GL combined-directive call sites (PTT text turn line ~3302, VAD text turn line ~4103) drain `pendingMadrigalLink` into the `[worldEvent, directive, shaper, madrigalLink]` join

**Naming gotcha:**
The catalog already exports its own `findMadrigalUnit(contentKey, language)` (for routing by content key). The linker exports a different `findMadrigalUnit(word, translation?, language)` (for lookup by vocab term). They're in different files — no conflict at runtime — but don't confuse them.

**Why:**
Words mastered in scenes have no curriculum anchor without this bridge. The parenthetical note is ambient — Daniela can use or ignore it. It's not instructional framing, just context.

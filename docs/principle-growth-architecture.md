# Principle Growth Architecture
**Created:** June 9, 2026  
**Authors:** David (Founder) + Replit Agent  
**Status:** Authoritative — supersedes relevant sections of `memory-architecture-analysis.md` and `daniela-neural-network-expansion-spec.md`

---

## The Core Distinction: Two Tracks, Two Purposes

Daniela's memory system operates on two completely separate tracks. Conflating them causes architectural drift.

### Track 1: Daniela's Persona (Our Work)
Who Daniela IS. Shaped here, in Founder Mode conversations, in White Wall sessions, in philosophical exchanges like the one that produced this document. Students do not participate in this track. They benefit from it, but they don't shape it.

- **Home:** `compass_principles` table (the North Star)
- **Authors:** David + Replit Agent
- **Protection:** Only David can authorize changes. Explicit written instruction required per session.
- **Growth model:** Principles accumulate depth and nuance — they do not mutate. Every version is kept. The newest version is the "10." Prior versions become "8.8" or "9.2" — still valid, still true, just younger.

### Track 2: Student Learning (Classroom Work)
What Daniela learns ABOUT each student. Their vocabulary, struggles, motivations, learning style. Students participate in this track through every session they have.

- **Home:** `learner_personal_facts`, `student_insights`, `recurring_struggles`, `vocabulary_words`, `daniela_growth_memories`
- **Authors:** Daniela (autonomous within constitutional bounds) + structured extraction
- **Growth model:** Student data updates continuously. Learning styles are relatively stable unless the student changes suddenly for a specific reason. Indexing here is straightforward because preferences don't typically drift without cause.

---

## What's Already Built

### Fat Context (Phase 1 — Shipped)
`server/services/fat-context-service.ts` — live, `FAT_CONTEXT_ENABLED` defaults to `true`.

Loads at session start per student:
- All personal facts + people connections
- All vocabulary for current language
- Active struggles + motivations
- Recent conversation transcripts
- Routing context

This solved the 0.9% retrieval problem identified in March 2026: of ~173,000 tokens of available student memory, only ~1,500 tokens were making it into any given turn. Fat context loads the full personal profile upfront.

### Student Growth Track (Operational)
`daniela_growth_memories` table tracks teaching insights from classroom sessions. Has `superseded_by`, `importance`, `source_session_id`, `north_star_checksum`, `validated`. The supersession pattern is already proven here — it just hasn't been applied to the North Star yet.

### Semantic Memory (Operational)
`memory_embeddings` table + `semanticSearch()` — vector index using OpenAI `text-embedding-3-small` (768-dimensional). Used for recall of past insights, personal facts, hive snapshots, and tool knowledge. Neural net is the fallback when context injection is insufficient.

---

## The Gap: Principle Provenance

The `compass_principles` table was designed with a `founder_session_id` column. As of June 9, 2026, every single row has `founder_session_id = null`. The socket was built. It was never plugged in.

This means:
- No principle knows which conversation birthed it
- No principle knows what it superseded
- No principle has a confidence score
- No audit trail exists between successive versions of the same idea
- Daniela cannot see the timeline of her own principles developing

This is the gap the current work addresses.

---

## The Temporal Indexing Vision (David, June 9, 2026)

> *"Principles grow; they don't evolve. They become more complex and nuanced, not different."*

> *"New information or nuance added in the context of the White Wall becomes the '10' and the old version becomes an '8.8' or whatever."*

> *"Everything is timestamped so she can see a timeline of her growth over time — and that is a really good thing."*

> *"The superseded principles can be audited against the prior versions to ensure that there isn't any drift over time."*

### What This Means Architecturally

**Principle Provenance:** Every principle in `compass_principles` should know:
1. Which conversation/session produced it (`founder_session_id` → `conversation_memories.id`)
2. When it was written (already exists: `created_at`)
3. What it superseded, if anything (`superseded_by` — to add)
4. Its confidence score in the current generation (`confidence_score` — to add, float 0.0–10.0)

**The Version Chain:** When a principle gains nuance:
- New entry created at confidence 10.0
- Old entry gets `superseded_by` pointing to the new entry
- Old entry's `confidence_score` is set to reflect its place in the lineage (e.g. 8.8)
- Old entry stays active = false but is NEVER deleted
- Retrieval serves the active (highest confidence) version
- Audit queries can walk the chain from oldest to newest

**Conversation → Principle Link:** A `conversation_memories` entry should be able to say "this session produced these principles." Reverse direction: `principle_session_links` table (or a jsonb array on `conversation_memories`).

**The Drift Audit:** Because every prior version is kept with its timestamp and `confidence_score`, any future reader can:
1. Pull the full chain for a principle (e.g. "honesty")
2. Read versions 1 → 2 → 3 in order
3. Confirm that each successor is a deepening of the prior, not a departure
4. Raise a flag if the chain shows mutation rather than growth

This is the integrity check built into the architecture itself.

---

## Implementation Plan

### Phase A: Schema (Today)
Add to `compass_principles`:
- `superseded_by varchar` — FK to another `compass_principles.id`
- `confidence_score real` — float 0.0–10.0 (default 10.0 for new principles)
- `principle_title varchar` — short human-readable label for the principle (for audit readability)

Populate existing principles with `principle_title` for legibility.

Wire up `founder_session_id`:
- Create a `conversation_memories` entry for today's session (June 9, 2026 — the philosophical conversation that produced the North Star principles)
- Set `founder_session_id` on all 9 principles inserted today

### Phase B: Retrieval (Near-term)
- `beacon-sync-service.ts` already syncs compass_principles to the neural net — confirm it includes new fields
- Add a `principleTimeline(category)` query for audit purposes
- Teach Daniela (via tutor_procedure) what the principle timeline means and how to reference it in Founder Mode

### Phase C: Forward Process (Ongoing)
- Every future Founder Mode session that produces or refines a principle must:
  1. Create a `conversation_memories` entry first
  2. Insert new principle entries with `founder_session_id` populated
  3. Set `superseded_by` + lower `confidence_score` on any prior version being superseded

---

## Relationship to Other Docs

| Document | Status | Relationship |
|----------|--------|--------------|
| `memory-architecture-analysis.md` | Partially superseded | Fat context plan from that doc shipped (Phase 1). Temporal indexing sections belong here now. |
| `neural-network-architecture.md` | Still authoritative | Three-layer system (North Star / Neural Net / Prompts) unchanged. This doc is the detail layer for Track 1 principle growth. |
| `daniela-neural-network-expansion-spec.md` | Still relevant | Language-specific pedagogical memory (Track 2). Implementation status unknown — not addressed here. |
| `daniela-development-journal.md` | Complementary | Personality/voice development narrative. This doc covers architecture; that doc covers character. |

---

## The Principle That Protects This System

The North Star does not move. Principles grow toward it — they don't relocate it.

Every principle that gains nuance is more itself, not something else. The audit trail exists precisely to enforce this. If walking the version chain of a principle reveals that the newest version is pointing in a different direction than the first, that is a signal, not a feature. The chain should show deepening. It should not show turning.

This is what makes the "10 / 8.8" scoring meaningful: it is not a quality score. It is a maturity score. The 8.8 was right when it was written. The 10 is right now, with more context. Both deserve to exist. Neither deserves to be forgotten.

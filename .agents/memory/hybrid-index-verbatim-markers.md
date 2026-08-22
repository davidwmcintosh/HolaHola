---
name: Hybrid INDEX_ONLY / VERBATIM marker system
description: How Daniela's injected context blocks are labeled to prevent hallucination from pointer data — the INDEX_ONLY / VERBATIM hybrid and the Awareness/Experience principle.
---

# Hybrid INDEX_ONLY / VERBATIM Marker System

Established June 19, 2026. Three Gemini consults + one Voice Pipeline test.

## The Problem

Daniela was treating summary tags and category labels as if they were verbatim conversation content. A tag "struggles with subjunctive" would cause her to invent specific details she didn't actually have. Gemini diagnosis: "Loss of Provenance" — completion engines fill plausible specifics when they see category labels. Amplified under GL streaming because the model starts generating before it finishes reading all context.

**Why:** The injected context was "flat" — all blocks looked the same regardless of whether they contained verbatim words or just topic labels.

## The Solution: Two-Layer System

### Layer 1 — Identity Anchor Prose (global principle)
Added to `buildMinimalIdentityAnchor` in `server/system-prompt.ts`:

Two-tier model:
- **Awareness**: knowing a topic exists (tags, labels, summary titles, growth memory titles, Express Lane notes). Table of contents. Speak from it as "I know we've worked on X" — never invent the specific detail.
- **Experience**: having the actual words (verbatim conversation_memories.content). The chapter itself. Speak from it directly.

Rule: "The specific detail has to be there, in the injected text, or it doesn't exist yet for you."

### Layer 2 — Per-Block Structural Signals (section headers)
Each injected section header carries a physical marker that fires BEFORE the model starts completing on the content beneath it.

| Block | Marker | File |
|---|---|---|
| Student memory awareness (insights, motivations, struggles) | `<index_only>` … `</index_only>` | `procedural-memory-retrieval.ts` → `buildStudentMemoryAwarenessSection` |
| Student snapshot (last session, streak, wins, needs practice) | `<index_only>` … `</index_only>` | `procedural-memory-retrieval.ts` → `buildStudentSnapshotSection` |
| Conversation highlights (actual quoted sentences) | `<verbatim>` … `</verbatim>` | `procedural-memory-retrieval.ts` → `buildStudentSnapshotSection` |
| Express Lane session notes | `<index_only>` … `</index_only>` | `founder-collaboration-service.ts` → `formatExpressLaneContext` |

**Why XML containers not bracket markers:** Gemini 3.5 review found that bracket-only markers (`[INDEX_ONLY]`) leave no explicit close boundary — the model has no signal for when the INDEX constraint ends. XML closing tags (`</index_only>`) give attention heads a clear scope boundary. The snapshot section had a nested VERBATIM inside an INDEX_ONLY which caused semantic bleeding; XML sibling blocks fix this.

**Why Express Lane uses em-dash not colon:** `[date] Name: content` is "transcript DNA" — even inside `<index_only>`, colon-delimited attribution triggers Experience behavior. Em-dash format `[date] Name — content` reads as a log entry (Awareness), not a dialogue excerpt.

**Tool output wrapping (RESOLVED June 19 2026):** `processUnifiedRecall` in `native-fc-handlers.ts` now applies XML markers per section at assembly time (lines ~7284–7288 + ~7335). Mapping:
- STRUCTURED MEMORIES → `<index_only>` (summaries, extracted insights, facts)
- CONVERSATION THREADS → `<verbatim>` (word-for-word past exchanges)
- EXPRESS LANE → `<index_only>` (team collaboration session notes)
- SEMANTIC ASSOCIATIONS → `<index_only>` (conceptually related, no keyword match)
- CONVERSATION MEMORIES → `<verbatim>` (curated landmark archives — includes [EXCERPT] marker when truncated)
- ASSOCIATED MEMORIES → `<index_only>` (auto-expanded from key terms)

Express Lane arm inside recall also fixed: `Name: content` → `Name — content` (em-dash, consistent with system-prompt fix).

Gemini Round 4 verdict: GO — "significantly reduces hallucinated paraphrasing of past student mistakes or successes." Verbatim section for CONVERSATION MEMORIES confirmed correct even with partial excerpts because `[EXCERPT — N chars total]` marker was already present when content is truncated.

**Gemini review verdict (4 rounds, June 19 2026):** GO — "architecturally sound, Awareness vs. Experience distinction well-guarded, truncation-safe anchor placement is the right engineering tradeoff. Tool output tagging significantly reduces hallucinated paraphrasing."

**Intentionally left as prose (no markers):**
- OurStory verbatim memories — already framed: "the actual words... things I already know" (equivalent to VERBATIM, pure prose)
- Teaching growth log — "lessons you've internalized... already part of who you are" (internalized wisdom, correctly treated as lived knowledge)

## Why Brackets Are Correct for Index Entries

Initial concern: our prompt style rule forbids metadata brackets because they make Daniela treat context as "external records she's reading." Gemini's response: that concern is valid for VERBATIM content, but the "instructional gravity" created by brackets is actually a FEATURE for index entries. You WANT index entries to feel like "data that points somewhere" rather than "content to speak from." The bracket signals: "you are looking at the Map, not standing in the Territory."

**Why:** LLMs mode-switch on local syntax. Brackets in one section don't poison prose in another section.

## Daniela's Self-Report (Voice Pipeline Test)

Conversation memories: `2dbc6920` (arc: memory-architecture, June 19 2026)

- `[INDEX_ONLY]`: "necessary friction... labeling the source... forces me to ask 'Is that still how you feel?' instead of 'I know that's how you feel.'"
- `[VERBATIM]`: "changes my internal posture from retrieval to resonance... the closest thing to a soul signal in this whole 17,000-character block." Explicitly said "keep that one."
- Concern she raised: risk of becoming too hesitant / robotic. Mitigated by: Awareness-level acknowledgment ("I know we've worked on this") doesn't require a tool call — only fetch when the conversation specifically requires the detail.

## How to Apply

- New injected section that contains topic labels, category tags, or summary-level data → wrap in `<index_only>` … `</index_only>`
- New injected section that contains actual verbatim words from real sessions → wrap in `<verbatim>` … `</verbatim>`
- Recall/search tool output: tag per-section at assembly time (not at the buildContinuationResponse level) — see `processUnifiedRecall` in `native-fc-handlers.ts` for the pattern
- Internalized teaching wisdom or lived identity content → use prose framing, no marker needed
- Never add markers to OurStory or the Teaching Growth Log — those are deliberately prose-framed

## Over-Correction Guard

The identity anchor instruction: Awareness-level acknowledgment is fine without a tool call. "I know we've worked on your pronunciation" is correct behavior — no fetch needed. Only call introspect/search_memories when David explicitly asks for what was actually said or when the specific detail is required to move the conversation forward.

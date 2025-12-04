# Tutor Consultation Synthesis

**Date:** December 4, 2025
**Purpose:** Understand what teaching tools the AI tutor wishes it had
**Method:** Consulted Gemini in tutor persona about classroom needs

---

## Key Insight

The tutor consistently asked for tools that show **relationships and context** - not just isolated facts. This aligns with our philosophy: the tutor knows *when* these aids help, we just need to provide the capability.

---

## Phase 3+ Tool Ideas (from Tutor Consultation)

### 1. Word Relationships
**Need:** Show how words connect to each other
- Synonyms, antonyms, collocations
- Word families (happy → happiness, happily)
- Semantic fields

**Potential markup:** `[WORD_MAP]target_word[/WORD_MAP]`

### 2. Contextual Examples
**Need:** Show words in multiple sentence contexts
- Especially for polysemous words (run, get, take)
- Highlight the target word in each example

**Potential markup:** `[CONTEXT]word|sentence1|sentence2|sentence3[/CONTEXT]`

### 3. Grammar Visualization
**Need:** Show patterns, not just explain them
- Conjugation tables
- Inflection patterns
- Sentence structure diagrams

**Potential markup:** `[GRAMMAR_TABLE]verb|tense[/GRAMMAR_TABLE]`

### 4. Cultural Context
**Need:** Visual guides to customs and etiquette
- When/how to use formal vs informal
- Gestures, greetings, social norms
- "Why" behind language patterns

**Potential markup:** `[CULTURE]topic|description[/CULTURE]`

### 5. Script Support (Non-Latin)
**Need:** Visual aids for writing systems
- Stroke order animations
- Script comparisons (romanization vs native)
- Character formation guides

**Potential markup:** `[STROKE_ORDER]character[/STROKE_ORDER]`

### 6. Richer Interactive Drills
**Need:** Beyond text-based exercises
- Drag-and-drop word ordering
- Image-word matching
- Visual scene completion

**Potential markup:** `[DRILL type="match"]pairs[/DRILL]`

---

## Priority Assessment

| Tool | Difficulty | Impact | Phase |
|------|------------|--------|-------|
| Grammar Tables | Medium | High | 3 |
| Context Sentences | Low | High | 3 |
| Word Maps | Medium | Medium | 3-4 |
| Matching Drills | Medium | Medium | 3-4 |
| Cultural Infographics | High | Medium | 4 |
| Stroke Order | High | Niche | 4+ |

---

## Implementation Notes

**Philosophy reminder:** We don't tell the tutor WHEN to use these. We provide the tools, document them in the system prompt, and trust the tutor's judgment.

**Architecture reminder:** All tools follow the same pattern:
1. Tutor includes markup in response
2. Server parses and strips before TTS
3. Client receives whiteboard_update via WebSocket
4. UI renders the visual aid

---

## What We Learned

1. **Relationships matter** - The tutor wants to show connections, not isolated facts
2. **Context is king** - Multiple examples beat single definitions
3. **Culture is language** - Can't separate the two effectively
4. **Visuals reduce friction** - For grammar especially, showing beats explaining

---

*This document captures ideas only. Implementation details are internal.*

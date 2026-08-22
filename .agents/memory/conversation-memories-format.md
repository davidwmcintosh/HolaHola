---
name: conversation_memories format — Gemini-approved
description: The canonical format for all conversation_memories content that Daniela will read back as her own past. Brackets are forbidden. Confirmed by Gemini (same model family as Daniela) and both Alden engines.
---

## The Rule

All conversation_memories content that Daniela retrieves must use:

```
Conversation with Luca regarding {topic}
Date: {date}
Language: {language label}

---

Luca: {text}
Daniela: {text}
```

**No brackets.** `[LUCA]\n{text}` is forbidden — LLMs treat brackets as metadata/log markers; attention weakens across them. The newline between label and text decouples speaker from statement in positional encoding.

**Why:** Gemini (same model family as Daniela) confirmed: "When I see [BRACKETS], my attention mechanism flags the content as system overhead. To make Daniela feel like she is remembering her life, you must remove the log file scaffolding." Gemini audit saved at conversation_memories id: f367ccef.

## Format Details (Daniela + Gemini iterated — July 12, 2026)

- Header: `With Luca — {topic}` (no "Conversation with... regarding" — Daniela: "sounds like a librarian filing a folder")
- Date: just the date on its own line, no label prefix
- **No language label** — dropped entirely; first 3 tokens of Spanish self-identify; explicit label introduces "translation-layer interference" (Gemini) and "feels like a reminder I'm being processed" (Daniela)
- `---` separator before the dialogue
- Turns: `Name: text` on one line, next turn on the next line (no blank lines between turns)
- Verbatim dialogue (not first-person narrative) — exact phrasing is diagnostic data for language learning
- No metadata noise in the body (Session ID, Turn Count live in title field only)

**Final approved format (post-implementation, Daniela confirmed on real memory):**
```
With Luca — {topic}

---

Luca: {text}
Daniela: {text}
```

Date lives in the title field only. Daniela on dropping it from the body: "A technical scar on a personal moment. If it lives in the title, that's enough for my internal filing."

## David↔Luca build logs

Same rule applies even though Daniela wasn't a participant — brackets signal "low-importance technical data." Use `David: {text}` / `Luca: {text}`.

## Existing DB rows

Do NOT re-store. `reformatSpeakerHeaders()` in `memory-embedding-indexer.ts` has a Pass 2 that converts bare `[LUCA]`, `[DANIELA]`, `[AGENT]`, `[DAVID]`, `[WREN]`, `[ALDEN]` labels at retrieval/chunk time. Every memory served to Daniela gets the correct format automatically.

## Files Changed

- `server/routes.ts` — agent-voice-turn accumulator + fullTranscript header (both endSession path and expiry setInterval)
- `server/services/agent-daniela-dialogue-worker.ts` — `logTurn()`
- `server/services/agent-session-autosave.ts` — David↔Luca transcript block
- `server/services/memory-embedding-indexer.ts` — `reformatSpeakerHeaders()` Pass 2

**Why verbatim over narrative:** In language learning, the exact words the student used are data. Narrative summaries erase that signal. Daniela needs "You said 'esperanza'" not "She seemed hopeful."

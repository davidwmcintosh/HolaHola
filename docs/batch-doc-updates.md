# Batch Documentation Updates

Pending documentation updates to be applied together.

---

## Phase 2: Interactive Whiteboard Tools (Dec 4, 2025)

### New Whiteboard Tools

**IMAGE - Vocabulary Images**
- Format: `[IMAGE]word[/IMAGE]`
- Shows contextual images for vocabulary learning
- Fallback chain: Stock images → AI generation → placeholder
- Helps visual learners associate words with images

**DRILL - Interactive Exercises**
- Format: `[DRILL type="repeat|translate|fill_blank"]prompt[/DRILL]`
- Three drill types:
  - `repeat`: Listen and repeat pronunciation
  - `translate`: Translate phrase to target language
  - `fill_blank`: Complete the missing word
- Gemini-powered evaluation with feedback
- Integrated into streaming voice flow via WebSocket

### Files Changed
- `shared/whiteboard-types.ts` - ImageItem, DrillItem types
- `client/src/components/Whiteboard.tsx` - UI components
- `server/system-prompt.ts` - Tool documentation
- Voice orchestrator integration for drill evaluation

---

## Phase 3a+3b: Context & Grammar Tools (Dec 4, 2025)

### New Whiteboard Tools

**CONTEXT - Context Sentences**
- Format: `[CONTEXT]word|sentence1|sentence2|sentence3[/CONTEXT]`
- Shows vocabulary in multiple real usage contexts
- Word highlighting in each sentence
- Staggered animation for sentence reveal
- Cyan color scheme

**GRAMMAR_TABLE - Verb Conjugation**
- Format: `[GRAMMAR_TABLE]verb|tense[/GRAMMAR_TABLE]`
- Visual conjugation display with pronoun-form grid
- Supports: present, past, future, imperfect, conditional, subjunctive
- Loading state for async conjugation generation
- Indigo color scheme

### Files Changed
- `shared/whiteboard-types.ts` - ContextItem, GrammarTableItem types
- `client/src/components/Whiteboard.tsx` - UI components
- `server/system-prompt.ts` - Tool documentation

---

## Phase 3c: Asian Language Tools (Dec 4, 2025)

### New Whiteboard Tools

**READING - Pronunciation Guides**
- Format: `[READING]character|pronunciation|language[/READING]`
- Supports: furigana (Japanese), pinyin (Mandarin), romanization (Korean)
- Uses HTML ruby elements for proper annotation display
- Language parameter is optional (auto-detected from characters)
- Pink color scheme

**STROKE - Stroke Order Display**
- Format: `[STROKE]character|language[/STROKE]`
- Large character display for writing practice
- Static display (animated strokes planned for Phase 5)
- Language parameter optional for context hints
- Orange color scheme

### Files Changed
- `shared/whiteboard-types.ts` - ReadingItem, StrokeItem types + parsing
- `client/src/components/Whiteboard.tsx` - UI components
- `server/system-prompt.ts` - Asian language tools documentation

---

## Documentation To Update (Batch)

### User-Facing Docs
- [ ] Whiteboard tools reference guide (all markup formats)
- [ ] Asian language learner guide (READING, STROKE)
- [ ] Interactive exercises guide (DRILL types)

### Teacher/Admin Docs
- [ ] Teacher guide for using whiteboard tools
- [ ] Best practices for visual teaching aids

### Technical Docs
- [ ] API documentation for whiteboard markup formats
- [ ] WebSocket integration for drills

---

## Phase 4a: Word Map Tool (Dec 4, 2025)

### New Whiteboard Tool

**WORD_MAP - Word Relationships**
- Format: `[WORD_MAP]word[/WORD_MAP]`
- Shows visual web of related words:
  - Synonyms: Words with similar meaning
  - Antonyms: Opposite meaning words
  - Collocations: Common word pairings
  - Word Family: Related forms (happy → happiness, happily)
- Teal color scheme
- Loading state while AI generates related words

### Files Changed
- `shared/whiteboard-types.ts` - WordMapItem, WordMapItemData types + parsing
- `client/src/components/Whiteboard.tsx` - WordMapItemDisplay UI component
- `server/system-prompt.ts` - Word Map tool documentation and examples

---

## Phase 4b: Matching Drills (Dec 4, 2025)

### New Drill Type

**DRILL type="match" - Interactive Matching**
- Format: `[DRILL type="match"]` with pairs as `term => translation` (one per line)
- Example:
  ```
  [DRILL type="match"]
  hello => hola
  goodbye => adiós
  thank you => gracias
  [/DRILL]
  ```
- Dual-column layout with shuffled right side
- Click-to-select interaction (tap left, then tap matching right)
- Visual feedback: cyan for selection, green for matches, red shake for wrong
- Progress bar and attempt counter
- Try Again button after completion
- Cyan color scheme

### Files Changed
- `shared/whiteboard-types.ts` - MatchPair, MatchState types, parseMatchPairs function, updated DrillItemData
- `client/src/components/Whiteboard.tsx` - MatchDrillDisplay UI component
- `server/system-prompt.ts` - Matching drill documentation and examples

---

## Pending Items

### Route Alias Investigation
- `/voice-tutor` returns 404 - the actual voice chat route is `/chat`
- Consider adding route aliases or redirects for common alternative paths:
  - `/voice-tutor` → `/chat`
  - `/voice` → `/chat`
  - `/tutor` → `/chat`
- This would improve discoverability and reduce confusion

(Add new batch items here as work progresses)

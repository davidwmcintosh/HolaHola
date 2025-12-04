# Batch Documentation Updates

This file collects documentation updates during development sessions for later consolidation into main docs.

**Status:** ✅ All items consolidated on December 4, 2025

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

## Phase 4c: Cultural Infographics Tool (Dec 4, 2025)

### New Whiteboard Tool

**CULTURE - Cultural Context Cards**
- Format: `[CULTURE]topic|context|category[/CULTURE]`
- Shows cultural insights, customs, etiquette inline during voice lessons
- Categories (optional): food, dining, gestures, body language, holidays, festivals, etiquette, customs
- Category-specific icons:
  - Globe (default)
  - Utensils (food/dining)
  - HandMetal (gestures/body language)
  - Calendar (holidays/festivals)
  - Users (etiquette/customs)
- Amber/golden color scheme
- Helps explain WHY phrases are used, not just what they mean

### Examples
```
[CULTURE]Tu vs Vous|In France, use 'vous' with strangers and 'tu' with friends|etiquette[/CULTURE]
[CULTURE]Business Cards|In Japan, receive meishi with both hands and study it carefully|customs[/CULTURE]
[CULTURE]Tipping in Japan|Tipping is actually considered rude - good service is expected|dining[/CULTURE]
```

### Files Changed
- `shared/whiteboard-types.ts` - CultureItemData, CultureItem types, isCultureItem guard, parseCultureItem
- `client/src/components/Whiteboard.tsx` - CultureItemDisplay UI component with category icons
- `server/system-prompt.ts` - Cultural Context Tools section with examples and best practices
- `docs/future-features.md` - Added Completed Features section

---

## Whiteboard Tools Roadmap (Dec 4, 2025)

### Added to future-features.md

Created comprehensive "Whiteboard Tools Roadmap" section documenting:

**Completed Phases (1-4):**
- Core Foundation: WRITE, PHONETIC, COMPARE, IMAGE, DRILL
- Contextual Teaching: CONTEXT, GRAMMAR_TABLE, READING, STROKE
- Vocabulary & Culture: WORD_MAP, DRILL match, CULTURE

**Planned Phases:**

**Phase 5: Enhanced Interactivity (P1)**
- Animated Stroke Order - stroke-by-stroke CJK character animation
- Audio Replay `[PLAY]word[/PLAY]` - on-demand pronunciation
- Speed Control - variable speed audio for difficult phrases

**Phase 6: Advanced Teaching Aids (P2)**
- Scenario Cards `[SCENARIO]location|situation[/SCENARIO]` - role-play setup
- Error Patterns `[ERRORS]` - display student's common mistakes
- Vocabulary Timeline `[TIMELINE]` - words learned over time
- Lesson Summary `[SUMMARY]` - auto-generated recap

**Phase 7: Immersive Learning (P3 - Future)**
- AR Vocabulary Labels
- Video Clips
- Interactive Stories

---

## Phase 5: Audio & Session Tools (Dec 4, 2025)

### New Whiteboard Tools

**PLAY - Audio Replay Button**
- Format: `[PLAY]text[/PLAY]` or `[PLAY speed="slow"]text[/PLAY]`
- Speed options: slow (0.5x), normal (1x), fast (1.5x)
- Shows text with interactive play button for pronunciation practice
- Sky blue color scheme
- Great for complex phrases students want to hear again

**SCENARIO - Role-Play Scene Setup**
- Format: `[SCENARIO]location|situation|mood[/SCENARIO]`
- Moods (optional): formal, casual, urgent, friendly
- Creates immersive scene cards before role-play exercises
- Displays location with map pin icon, situation description, mood indicator
- Optional role badges for multi-character scenarios
- Purple color scheme

**SUMMARY - Lesson Recap**
- Format: `[SUMMARY]title|word1,word2,word3|phrase1,phrase2[/SUMMARY]`
- Words section: comma-separated vocabulary learned (displayed as badges)
- Phrases section: comma-separated key phrases (displayed as list)
- Perfect for end-of-lesson takeaways
- Emerald green color scheme

### Examples
```
[PLAY speed="slow"]Encantado de conocerte[/PLAY]
[SCENARIO]Café|You walk into a café in Barcelona and want to order coffee|casual[/SCENARIO]
[SUMMARY]Today's Greetings|hola,adiós,gracias|Buenos días,Hasta luego[/SUMMARY]
```

### Files Changed
- `shared/whiteboard-types.ts` - PlayItemData, ScenarioItemData, SummaryItemData types + parsing
- `client/src/components/Whiteboard.tsx` - PlayItemDisplay, ScenarioItemDisplay, SummaryItemDisplay UI components
- `server/system-prompt.ts` - Audio & Session Tools section with examples and best practices
- `docs/future-features.md` - Updated roadmap to mark Phase 5 complete

### Notes
- SCENARIO roles are auto-extracted from situation text (e.g., "waiter", "customer")
- SUMMARY totalItems count tracks combined words + phrases for analytics

---

## Phase 5 Implementation Updates (Dec 4, 2025)

**Summary:** Completed wiring of PLAY and STROKE whiteboard tools to their respective backends.
- PLAY: Connected to Cartesia TTS with variable speed (0.5x/1x/1.5x) and request cancellation
- STROKE: Integrated HanziWriter library with SSR-safe dynamic import and proper cleanup

### PLAY Button - Wired to Cartesia TTS

The PLAY button is now fully functional with Cartesia TTS integration:

**Implementation Details:**
- Backend: Added `speakingRate` parameter to `/api/voice/synthesize` endpoint
- Client: Updated `synthesizeSpeech()` function in `restVoiceApi.ts` to accept speed param
- UI: PlayItemDisplay now calls TTS on click with appropriate speed

**Speed Mapping:**
- `slow` → 0.5x speaking rate
- `normal` → 1.0x speaking rate
- `fast` → 1.5x speaking rate

**UX Features:**
- Loading spinner while synthesizing
- Stop button while playing (also cancels in-flight requests)
- AbortController pattern for proper request cancellation
- Cleanup on unmount (stops audio, revokes object URLs)
- Language context from LanguageProvider for proper TTS voice

**Technical Details:**
- `synthesizeSpeech()` now accepts optional `signal?: AbortSignal` parameter (8th argument)
- Signal passed through to fetch for proper network request cancellation
- AbortController abort() called before creating new controller to cancel any pending requests

**Files Changed:**
- `server/routes.ts` - speakingRate parameter support
- `client/src/lib/restVoiceApi.ts` - synthesizeSpeech with speakingRate + AbortSignal
- `client/src/components/Whiteboard.tsx` - PlayItemDisplay TTS integration with cancellation

---

### STROKE Tool - HanziWriter Animated Strokes

The STROKE tool now shows animated stroke order using HanziWriter library:

**Implementation Details:**
- Installed `hanzi-writer` npm package
- StrokeItemDisplay uses dynamic import for SSR safety (avoids "window is not defined" error)
- HanziWriter.create() renders animated character with proper cleanup (writer.destroy())
- Auto-animates on display, with replay button for manual control

**Features:**
- Stroke count badge showing total strokes
- Automatic animation on display
- Replay Animation button
- Graceful fallback for unsupported characters (shows static text)

**HanziWriter Configuration:**
- Width/Height: 120x120px
- Stroke color: Orange theme (#ea580c)
- Outline visible for guidance
- 300ms delay between strokes

**SSR Safety & Cleanup:**
- Uses `import('hanzi-writer')` dynamic import to avoid SSR crashes
- Guard: `if (typeof window === 'undefined')` returns early in SSR context
- All early exits set `isLoading: false` and `hasError: true` to prevent stuck spinners
- Cleanup calls `writer.destroy()` on unmount to prevent memory leaks
- `mounted` flag prevents state updates after component unmounts

**Files Changed:**
- `client/src/components/Whiteboard.tsx` - StrokeItemDisplay with HanziWriter + SSR guards

---

## Pending Items

### Route Alias Investigation
- `/voice-tutor` returns 404 - the actual voice chat route is `/chat`
- Consider adding route aliases or redirects for common alternative paths:
  - `/voice-tutor` → `/chat`
  - `/voice` → `/chat`
  - `/tutor` → `/chat`
- This would improve discoverability and reduce confusion

---

## Student Empowerment Features (Dec 4, 2025)

### Image Library Enhancements

**Modal Overflow Fix**
- Detail panel now scrollable with `max-h-[80vh]` and `overflow-y-auto`
- Smaller image preview (200px max-height) for better content visibility
- Action buttons always accessible at bottom of modal
- No more hidden buttons on smaller screens

**Three View Modes**
- **Grid View**: 5-column layout with larger thumbnails (default)
- **Compact View**: 8-column layout with smaller thumbnails for quick browsing
- **List View**: Table layout with sortable columns

**Sortable Columns (List View)**
- Date Added (newest/oldest)
- Image Source (stock/ai_generated/user_upload)
- Usage Count (most/least used)
- Language
- File Size

**New Images Indicator**
- Badge on Images tab shows count of images added in last 24 hours
- Uses `newCount` from backend query
- Helps admins spot content needing review

**Files Changed:**
- `client/src/pages/admin/CommandCenter.tsx` - View mode toggle, sort controls, responsive layouts
- `server/routes.ts` - Added `sortBy`, `sortOrder` query params to `/api/admin/media`
- `server/storage.ts` - `getMediaFiles()` now supports sorting options, `newCount` for 24-hour images

---

### Vocabulary Export

**Export Formats**
- **CSV**: Standard comma-separated values for spreadsheets
- **Anki**: Tab-separated format compatible with Anki flashcard app

**Export Contents**
- Word (target language)
- Translation (English)
- Pronunciation (if available)
- Examples (semicolon-separated)
- Date Added
- Last Reviewed

**UI Implementation**
- Export dropdown button in Vocabulary page header
- Format selection (CSV or Anki)
- Automatic download with descriptive filename (e.g., `vocabulary-spanish-anki.txt`)
- Language filter applied to exports

**API Endpoint**
- `GET /api/vocabulary/export?format=csv|anki&language=optional`
- Returns appropriate Content-Type and Content-Disposition headers

**Files Changed:**
- `server/routes.ts` - New `/api/vocabulary/export` endpoint
- `server/storage.ts` - `exportVocabulary()` method with format support
- `client/src/pages/vocabulary.tsx` - Export button with dropdown menu

---

### Conversation Search

**Search Features**
- Full-text search across all message content
- Debounced input (300ms) to avoid API spam
- Minimum 2 characters required to trigger search
- Results show message content with highlighted matches

**Search Results Display**
- Shows conversation title (or "Untitled Conversation")
- Message date
- Role indicator (user/tutor with avatar)
- Highlighted matching text using `<mark>` tags
- Click result to navigate to that conversation

**UX Details**
- Clear button (X) to reset search
- Loading spinner during search
- "No results" state with helpful message
- Regular conversation list hidden while search results are displayed
- Search results count displayed ("X results for 'query'")

**API Endpoint**
- `GET /api/messages/search?q=query`
- Returns messages with `conversationId`, `conversationTitle`, and `content`

**Files Changed:**
- `server/routes.ts` - New `/api/messages/search` endpoint
- `server/storage.ts` - `searchMessages()` method with full-text search
- `client/src/components/ConversationHistory.tsx` - Search input, results display, highlighting

---

## Image Library Review Workflow (Dec 4, 2025)

### New Admin Features

**Review Tracking System**
- Added `targetWord`, `isReviewed`, `reviewedAt`, `reviewedBy` fields to MediaFile schema
- Tracks which vocabulary word triggered each image for better context
- Records who reviewed each image and when

**Unreviewed Count Badge**
- Red warning badge showing count of images pending review
- Displayed in Command Center Image Library tab header
- Helps admins prioritize quality control workflow

**Bulk Selection & Actions**
- Checkboxes in list view header and rows for multi-select
- "Select All" and "Clear" buttons in bulk actions bar
- Bulk "Mark as Reviewed" / "Mark as Unreviewed" operations
- Selection automatically clears when changing page/filter/view

**Enhanced List View**
- Word column: Shows `targetWord` or `searchQuery` with filename below
- Reviewed column: Green check badge for reviewed, gray clock for pending
- Highlight selected rows with primary color background

**Image Detail Modal Updates**
- Target Word display at top of detail grid
- Review Status with green "Reviewed" or gray "Pending Review" badge
- "Mark Reviewed" / "Mark Unreviewed" toggle button in footer
- Shows `reviewedAt` and `reviewedBy` metadata when available

**Request New Image Dialog**
- "Request Image" button in Image Library header
- Modal with vocabulary word input and language selector (9 languages)
- Calls vocabulary-image-resolver to generate/fetch image
- Image added to library marked for review

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/media` | GET | Returns `unreviewedCount` in response |
| `/api/admin/media/:id` | PATCH | Supports `isReviewed` field update |
| `/api/admin/media/bulk-review` | POST | Bulk update review status for multiple images |
| `/api/admin/media/request-image` | POST | Generate new image for vocabulary word |

### Files Changed
- `shared/schema.ts` - MediaFile schema with review fields
- `server/storage.ts` - `getAllMediaFiles()` returns `unreviewedCount`, `bulkUpdateMediaReviewStatus()` method
- `server/routes.ts` - Bulk review and request image endpoints
- `client/src/pages/admin/CommandCenter.tsx` - Full UI implementation with bulk selection, review workflow

### Data Model Updates

```typescript
// MediaFile additions
targetWord?: string | null;    // Vocabulary word that triggered image
isReviewed?: boolean;          // Default false
reviewedAt?: Date | null;      // Timestamp of review
reviewedBy?: string | null;    // User ID of reviewer
```

---

## Session Documentation Consolidation (Dec 4, 2025)

All batch documentation updates have been applied to:
- `replit.md` - Main project documentation updated with Image Library review workflow
- `docs/future-features.md` - Completed features section updated

---

(Add new batch items here as work progresses)

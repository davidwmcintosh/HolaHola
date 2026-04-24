# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

**Graduation Criteria**: If it's reusable knowledge → add to hive (agent_observations). If it's session-specific history → batch only.

> **Archive note**: All completed session entries prior to March 2026 are preserved in git history. This file now contains only open/backlog items and recent sessions awaiting documentation.

---

## Open Backlog

### Micro-Ack Parallel Response System
**Status**: NOT STARTED — awaiting priority

Reduce perceived latency by generating a quick verbal acknowledgment from Daniela while the main AI response generates in parallel.

```
User finishes speaking → STT transcribes
                       ├─→ Micro-ack fires IMMEDIATELY (quick acknowledgment)
                       └─→ Main response generation starts (in parallel)
Main response streams normally after micro-ack completes
```

Options: pre-recorded snippets (instant, less natural) vs. fast LLM 1-3 word ack (~200ms) vs. hybrid contextual selection. Previous attempt rolled back — broke main response flow. Must be a separate parallel promise that doesn't interfere with primary pipeline.

Examples: "Okay...", "Sí...", "Hmm...", "Let me think...", "Interesante..."

**Files**: `server/services/streaming-voice-orchestrator.ts`, `server/services/gemini-streaming.ts`

---

### Eliminate Legacy Command Map
**Status**: BACKLOG

`FUNCTION_TO_COMMAND_MAP` in `gemini-function-declarations.ts` translates Gemini's snake_case names (e.g., `play_audio`) into UPPER_CASE command strings (e.g., `PLAY`) for the orchestrator's switch/case handlers. Most entries are mechanical uppercasing — a handful have shortened names (`play_audio` → `PLAY`, `show_overlay` → `SHOW`, `request_text_input` → `TEXT_INPUT`).

**Fix**: Rename orchestrator case labels to match exact uppercased function names (`case 'PLAY_AUDIO':` instead of `case 'PLAY':`). Once all labels match `name.toUpperCase()`, delete the map entirely. Also rename `legacyType` → `command` on `ExtractedFunctionCall`.

**Scope**: ~50 case labels in `handleNativeFunctionCall()` + a few `legacyType` references. Low risk, wide blast radius — best as a focused cleanup session with no other changes.

---

### Dynamic Native-Language Translations for Drills
**Status**: PINNED / BACKLOG

Drill translations are hardcoded to English in the `prompt` field. An Italian student learning Spanish sees "Hello" instead of "Ciao." Daniela's voice system fully respects `nativeLanguage` (~30+ references in `system-prompt.ts`) but the drill/textbook system does not.

**Scope**:
1. Schema: `translations` JSONB column on `curriculum_drill_items` — `{ "en": "Hello", "it": "Ciao", ... }`
2. API: drill endpoints accept `nativeLanguage`, return appropriate translation
3. Content: AI batch translation (Gemini Flash) for all ~5000+ items across 10 language pairs
4. Frontend: `TextAudioPlayButton` + drill UI display native-language translation

Fallback chain: user's native language → English → target text only.

**Also noted**: Spanish 3 Units 2–4 are hollow shells — conversation and cultural stubs, no vocabulary or drill content matching their Can-Do statements. Needs dedicated content authoring session.

---

### Teacher/Institution Pricing Model
**Status**: PLANNING — needs specification

Document: `docs/teacher-institution-pricing.md`

Items to define: class creation limits per tier, student enrollment limits per teacher, tier structure (Free / Starter / Professional / Institution), enforcement (API blocking, upgrade prompts, dashboard indicators).

---

### Class Time Estimation — UI Placement Decision
**Status**: DOCUMENTED — awaiting UI placement decision

Formula: `Total Hours with Drills = Lesson Hours × 2.5` (2.5× accounts for drill-until-mastery, not exhaustive drill completion).

Class estimates range: Spanish 1 = 53.8hrs, Spanish 4/AP = 79.8hrs, French 1 = 56.3hrs, etc.

Lesson type breakdown: Conversation (470 lessons, 287hrs), Reading (98, 75hrs), Vocabulary (91, 40hrs), Writing (70, 58hrs), Grammar (63, 28hrs), Cultural (40, 22hrs), Drill (35, 21hrs).

**Decision needed**: Where to display? Teacher class dashboard / admin syllabus overview / student progress page / marketing materials?

---

### Biology/History Competency Framework — Implementation Pending
**Status**: DECIDED — not yet reflected in tutor behavior code

Six-level Bloom's Taxonomy ladder: Recall → Comprehension → Application → Analysis → Synthesis/Evaluation → AP Readiness. Confirmed by Carol McIntosh and Hadassah (practicing teachers): facts-first, Socratic methods layer on top at higher levels.

Standards: NGSS for biology, C3 Framework for history (levels 1–5). AP layer at level 6 with College Board exam coaching (free response, DBQ).

Critical transition: levels 2→3 — moving too fast disengages, too slow bores. Tutor reads readiness signals.

Full table and design notes: `docs/multi-subject-platform-vision.md`

---

## Recent Sessions

### March 21, 2026 — Infrastructure Audit Cleanup (T001–T006)
**Status**: COMPLETED

- **T001**: Voice infrastructure audit findings documented in `replit.md` (audit section)
- **T002**: E2E latency measurement added — `diagMarkSpeechEnd()` + `diagMarkFirstAudio()` compute `turnLatencyMs` per turn; rolling 20-sample window in `store.turnLatencySamples`; p95/avg visible in diagnostic snapshots. Files: `lockoutDiagnostics.ts`, `useStreamingVoice.ts`
- **T003**: No-audio recovery UX — reconnect banner now shows for ALL WS drops (not just server-restart phase). Fast drops: generic "Reconnecting..."; prolonged (>3 attempts): specific server message. File: `StreamingVoiceChat.tsx`
- **T004**: TTS failure graceful degradation — `ttsUnavailable` state added; on TTS error shows "Audio temporarily unavailable — text only" banner (auto-clears after 8s). Files: `useStreamingVoice.ts`, `StreamingVoiceChat.tsx`
- **T005**: Already done — three-tier STT fallback confirmed in `streaming-voice-orchestrator.ts`: Deepgram Live → Deepgram Prerecorded → Google Cloud STT (`google-stt-fallback.ts`)
- **T006**: WS handler deduplication was already done. Cleanup: added `WS_OPEN = 1` constant; replaced all `SocketIOWebSocketAdapter.OPEN` refs inside shared handler; fixed misleading "via Socket.io" log labels. File: `unified-ws-handler.ts`

---

### April 24, 2026 — Spanish 3/4/5 Advanced Unit Pages
**Status**: COMPLETED ✅ — awaiting David's review before replicating to other languages

**What was built:**
- `client/src/data/advanced-unit-content.ts` — content for all 20 Spanish 3/4/5 units
- `client/src/components/AdvancedUnit.tsx` — renderer for `chapter_type = 'advanced_unit'`
- `TextbookChapterView.tsx` — dispatch added for new type
- DB: all 20 Spanish 3/4/5 `curriculum_units` updated to `chapter_type = 'advanced_unit'`

**Each unit now has:**
1. 10 curated vocabulary words (tap-to-expand: translation, POS, example sentence, TTS)
2. An authentic reading passage in Spanish (public-domain literary works where appropriate — Rubén Darío, José Martí, Sor Juana Inés de la Cruz — plus original cultural/news texts)
3. A cultural note written entirely in Spanish (100–200 words, appropriate level)
4. Practice with Daniela CTA

**Level mapping:** B1–B2 (Spanish 3), B2–C1 (Spanish 4), C1 (Spanish 5)

**PENDING — Do not replicate yet:** David will review the Spanish content first. Once approved, the same `advanced_unit` pattern should be replicated to French, German, Italian, Portuguese, Japanese, Chinese, and Korean advanced-level units. The `AdvancedUnit.tsx` component and `getAdvancedUnitContent()` lookup will need language-specific data files.

---

### March 21, 2026 — La Hora Lesson + Clock Gallery
**Status**: COMPLETED

- New `curriculum_lessons` row: "La Hora — Telling Time" (Novice Mid, vocabulary, order_index=2) in Unit 2: Los Números
- 48 PNG clock images seeded to `media_files` tagged by pattern (`en-punto`, `y-media`, `y-cuarto`, `menos-cuarto`)
- New API: `GET /api/textbook/media-by-tag?tag=clock&language=spanish` (authenticated, parameterized Drizzle SQL)
- `TimeVocabCard` enhanced: 4 pattern tab buttons, image grid (12 images per tab), lazy loading. Bug fixed: PostgreSQL `text[]` returned as raw string — added backend normalization before JSON response
- `classifyGrammarType("La Hora — Telling Time", "spanish")` returns `'telling_time'` → renders `TimeVocabCard`
- All study notes now auto-expand by default (`autoExpand={true}` for all lessons in `TextbookChapterView`)

# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

**Graduation Criteria**: If it's reusable knowledge → add to hive (agent_observations). If it's session-specific history → batch only.

---

## Pending Updates

### Session: February 26, 2026 — Competency Framework for Biology and History

**Status**: DECIDED — not yet implemented in code

#### What
Established the six-level Bloom's Taxonomy-based competency ladder for biology and history tutors. Confirmed by Carol McIntosh and Hadassah (both practicing teachers): facts-first, then layer Socratic methods on top.

#### Framework
Six levels: Recall → Comprehension → Application → Analysis → Synthesis/Evaluation → AP Readiness. Tutor approach shifts by level (didactic early, Socratic late), persona stays consistent throughout.

Standards: NGSS for biology, C3 Framework for history (levels 1–5). AP Biology / AP History layers on at level 6 with College Board-specific content and exam format coaching (free response, DBQ).

Critical transition: levels 2→3. Moving too fast disengages students; staying too long bores them. Tutor reads readiness, not just a checklist.

#### Key Files
- `docs/multi-subject-platform-vision.md` — full table, design notes, standards mapping

---

### Session: February 26, 2026 — New Tutor Personas Confirmed

**Status**: DECIDED — not yet implemented in code

#### What
Confirmed the tutor roster for the multi-subject platform expansion (Option 3 architecture). Four new personas across two departments.

#### Biology: Gene (male) + Evelyn (female)
- No title — first-name basis only
- Gene's name is a nod to gene splicing; light enough to be charming, not corny
- Teaching style: precise but never dry. Genuine reverence for living systems. Conversations feel like a scientist thinking out loud. Light-hearted and enthusiastic — makes biology feel like a detective story, not rote memorization.

#### History: Clio (female) + Marcus (male)
- Clio is named for the Greek muse of history — built-in meaning
- Teaching style: Socratic and narrative. History as humans making decisions under pressure, not dates and names. Always curious about the student's interpretation. Uses primary sources and cause-and-effect reasoning.

#### TTS Voice Strategy
All four use Google Chirp 3 HD. Cartesia is on hold (concurrency limits). Voice differentiation via Chirp 3 HD's voice pool — each persona gets an assigned voice, documented in their persona config record.

#### Key Files
- `docs/multi-subject-platform-vision.md` — updated with full roster and teaching style notes



### Session: February 26, 2026 — Character-Based Billing Guard

**Status**: COMPLETED

#### What
Replaced the estimation-based idle session billing cap with a character-based cross-check using actual metered usage data (`tts_characters` and `stt_seconds`) already tracked per voice session.

#### Why
Estimation from exchange counts could mis-bill at scale — a session with 1 exchange early then left idle would be charged full wall-clock. TTS characters and STT seconds are real metered values that map directly to what we actually pay (Google TTS, Deepgram STT, Gemini tokens).

#### Formula
```
ttsDurationEstimate = ceil(tts_characters / 15)   # 15 chars/sec = natural speech rate
activeSpeakingSeconds = ttsDurationEstimate + stt_seconds
fairBillableSeconds = max(activeSpeakingSeconds × 3, 120)   # 3x think-time multiplier; 2-min floor
```
Cap only applies when `wall-clock > fairBillableSeconds AND wall-clock > 600s`.
Zero-activity sessions (0 TTS chars, 0 STT secs, 0 exchanges) are charged nothing — existing guard preserved.

#### Validation (T002 — run against all historical sessions)
- 1,620 completed sessions >60s examined
- **0** healthy sessions (>100 chars/min) would be capped — zero false positives
- **397** genuinely idle sessions correctly capped
- **4** suspect sessions (low activity) correctly capped
- Healthy sessions: max fair cap 702s, avg 415s — well above any real teaching session

#### Key files
- `server/services/usage-service.ts` — `endVoiceSession()` billing logic (lines ~482-520)

#### Billing example
Carol's session (527 TTS chars, 8 STT secs, 7614s wall-clock):
- Active speaking: ceil(527/15) + 8 = 35 + 8 = 43s
- Fair billable: max(43 × 3, 120) = 129s
- Cap saves 7,485 seconds

---

### Session: February 26, 2026 — Neural Memory ts_rank Fix (Carol's Voice Crash)

**Status**: COMPLETED

#### What
Fixed a crash in `semanticSearchMessages()` that caused every voice session turn to fail when the user spoke. The error was `function ts_rank(text, tsquery) does not exist` — PostgreSQL's `ts_rank` requires a `tsvector` first argument, but `messages.search_vector` is stored as `text` type.

#### Fix
Added explicit cast in both the `ts_rank()` call and the `@@` operator in the SQL query:
```sql
ts_rank(m.search_vector::tsvector, to_tsquery('simple', ...))
m.search_vector::tsvector @@ to_tsquery('simple', ...)
```

#### Key file
- `server/services/neural-memory-search.ts` — `semanticSearchMessages()` (lines ~178-185)

#### Also fixed
- Added `scaffolding` to `best_practice_category` PostgreSQL enum (was causing silent memory-save failures). Applied via `ALTER TYPE best_practice_category ADD VALUE 'scaffolding'` and updated `shared/schema.ts`.

---

### Session: February 26, 2026 — Vocabulary Deduplication Fix

**Status**: COMPLETED

#### What
Fixed duplicate vocabulary cards accumulating across restarts and sessions. Carol McIntosh had 372 cards but only 238 unique words (134 excess duplicates). "Buenas noches" had 12 copies — one per session restart.

#### Root cause
`createVocabularyWord()` in `storage.ts` was a plain INSERT with no uniqueness guard. The `vocabulary_words` table had no UNIQUE constraint. Every session restart (or within-session repeated function call) would silently add a fresh copy of the same word.

#### Fix — two layers
1. **Application layer** (`server/storage.ts` — `createVocabularyWord`): Case-insensitive lookup before every insert using `LOWER(word)`. If the word already exists for that user + language, the existing record is returned instead of inserting a duplicate. Handles "Perfecto" vs "perfecto" variants.
2. **Database layer** (`shared/schema.ts`): Added `uniqueIndex("idx_vocabulary_unique_word").on(table.userId, table.word, table.language)` — enforced at the DB level via `CREATE UNIQUE INDEX` (applied directly, bypassing a pre-existing FK issue blocking `db:push`).

#### Data repair
- Deleted 426 duplicate records across 3 affected users (kept oldest copy of each word)
- Carol: 372 → 238 cards, total = unique (100% clean)
- All future inserts will deduplicate silently

---

### Session: February 25, 2026 — Character-Based Billing Guard (Validation)

**Status**: COMPLETED

#### What
Validated that the character-based billing guard (implemented in a prior session) contains zero false positives against all historical session data.

#### Why the old estimation approach was risky
The original idle-session cap estimated usage from exchange counts and an `AVG_SECONDS_PER_EXCHANGE` constant. At scale this could mis-bill: a student who had 10 exchanges but left the tab open for 2 hours would still be over-billed because the exchange estimate capped too high. Worse, it gave no protection against sessions with 0 exchanges but non-zero TTS chars (partial connections).

#### How the current formula works (already live in `server/services/usage-service.ts`)

Three billing paths, evaluated in order:

1. **Zero activity** (`tts_characters = 0 AND stt_seconds = 0 AND exchange_count = 0`): Charged $0. No teaching happened.

2. **Has metered data** (primary path — covers all modern sessions): Uses actual tracked metrics:
   - `ttsDurationEstimate = ceil(tts_characters / 15)` — TTS industry constant: ~15 chars/second of natural speech
   - `activeSpeakingSeconds = ttsDurationEstimate + stt_seconds`
   - `fairBillableSeconds = max(activeSpeakingSeconds × 3, 120)` — 3× multiplier covers think time, reading whiteboard, pauses; 2-minute floor prevents micro-session under-billing
   - If `wall_clock > fairBillableSeconds AND wall_clock > 600s`: cap at `fairBillableSeconds`, log the discrepancy
   - Otherwise: charge wall-clock as normal

3. **Fallback** (legacy sessions without TTS/STT tracking): Uses `student_speaking_seconds × 2` or `exchange_count × 30s` as the activity estimate, same 3× multiplier and 120s floor.

#### Validation results (all completed sessions >60s)

| Path | Sessions | Would-be-capped | Avg wall-clock | Avg TTS chars | Avg charged |
|------|----------|-----------------|----------------|---------------|-------------|
| zero_activity | 1,499 | — (all free) | 6,109s | 0 | 0s |
| has_metered_data | 38 | 7 | 1,423s | 1,698 | 276s |
| fallback | 52 | 12 | 1,295s | 0 | 305s |

- **Zero false positives**: Every healthy session (>100 TTS chars/min, >5 exchanges) shows `fair_cap > wall_clock`, so the cap never triggers on real teaching activity
- **Most borderline capped session**: 55.2 TTS chars/min — only 14.3% of the healthy baseline (385 chars/min), 6 exchanges over 24 minutes. Correctly identified as suspect.
- **Platform savings**: ~152,627 minutes NOT over-billed from zero-activity sessions alone

#### Key file
`server/services/usage-service.ts` — `endVoiceSession()` method, lines ~481–534

---

### Session: February 25, 2026 — Progress Tracking System Overhaul

**Status**: COMPLETED

#### Problem: Three interconnected bugs made progress tracking completely non-functional

All three bugs fed into each other, leaving the mind map permanently dark, ACTFL level stuck, and vocabulary invisible for class-enrolled students.

**Bug 1 — Streak stuck at 0**
- The orchestrator was calling `updateUserProgress({ lastPracticeDate: new Date() })` mid-session during vocabulary extraction
- This caused `recordActivityAndUpdateStreak()` (called at session end) to always see `daysDiff = 0` and skip streak initialization
- Fix: Removed `lastPracticeDate` from the mid-session progress update. `lastPracticeDate` is now exclusively written by `recordActivityAndUpdateStreak()` at session end
- File: `server/services/streaming-voice-orchestrator.ts` (~line 10038)

**Bug 2 — Vocabulary blank for class students**
- `createVocabularyWord()` was called without `classId`, so all vocab words were stored with `classId = null`
- `getFilteredVocabulary()` applied strict `classId = ?` equality, returning 0 results for class-filtered queries
- Fix 1: Added `classId: session.classId || null` to the `createVocabularyWord()` call
- Fix 2: `getFilteredVocabulary()` now uses `(classId = ? OR classId IS NULL)` for backward compatibility with pre-fix words
- Files: `streaming-voice-orchestrator.ts` (~line 9876), `server/storage.ts` (~line 4604)

**Bug 3a — ACTFL `practice_hours` always 0**
- `recordVoiceExchange()` never wrote the `practice_hours` field; it accumulated all other ACTFL metrics but left this one at 0
- This meant students could never meet the minimum hours threshold for level advancement (5h for Novice Mid)
- Fix: Post-session sync block (see below) now writes `practice_hours = practiceMinutes / 60` from `userProgress`

**Bug 3b — ACTFL `topics_covered` stuck at 1 topic**
- Per-message ACTFL tracking passed `[difficultyLevel + '_practice']` as the topic (e.g., `["beginner_practice"]`)
- Since it was always the same string, unique topic accumulation never grew beyond 1
- Students need 4 unique topics for Novice Mid advancement — impossible with only 1 forever
- Fix: Replaced with keyword-based topic detection (10 topic categories: greetings, food, family, school, work, hobbies, weather, numbers, health, shopping) on the user transcript
- File: `streaming-voice-orchestrator.ts` (~line 10081)

**Bug 3c — Mind map permanently dark**
- `syllabus_progress` records were never created when sessions ended
- Without any progress records, `getUnifiedProgress()` returned all lessons as `not_started`
- `unifiedProgressToTopics()` mapped all lessons to `discovered` status
- The lobe brightness calculation only counted `mastered` (completed) topics — 0/all = 0% for every lobe

#### Solution: Post-session progress sync block

Added a non-blocking async block in `endSession()` that runs whenever a session had actual exchanges and wasn't incognito:

1. **`practice_hours` sync**: Gets `userProgress.practiceMinutes`, divides by 60, writes to `actflProgress.practiceHours`
2. **Topic merge**: Gets Gemini-tagged conversation topics from the conversation tagger, merges them into `actflProgress.topicsCovered`
3. **Syllabus progress creation**: Calls `getNextLessonForClass()`, checks for existing progress record, creates `in_progress` record if none exists, or accumulates `actualMinutes` if already `in_progress`. Skips completed/skipped lessons.

New storage helper: `getNextLessonForClass(studentId, classId)` — returns the first incomplete lesson in the class curriculum by walking `class_curriculum_units` and `class_curriculum_lessons` in order.

File: `server/services/streaming-voice-orchestrator.ts` (~line 12293)
File: `server/storage.ts` — `getNextLessonForClass()` added

#### Mind map lobe calculation improvements

Two changes to make the mind map meaningful even early in a course:

1. **Emergent mode now hides unvisited units**: In `unifiedProgressToTopics()`, lessons from units where the student has no `in_progress` or `completed` lessons are now tagged as `locked`. In emergent mode, locked topics are filtered out, so they don't dilute the lobe brightness percentages with the full unvisited curriculum.

2. **`practiced` topics count toward brightness**: Lobe brightness now counts `mastered` (completed) at full weight and `practiced` (in_progress) at 0.5 weight. Previously, only `mastered` counted, making it impossible to see any progress until lessons were fully completed.

File: `client/src/components/SyllabusMindMap.tsx` — `unifiedProgressToTopics()` and `segmentProgress` useMemo

#### Carol McIntosh data backfill

Direct DB corrections applied to unblock Carol's account:
- 828 vocab words tagged with Spanish 1 class_id
- `user_progress`: current_streak=2, longest_streak=3, total_practice_days=6
- `actfl_progress`: practice_hours=5.97, topics_covered=[greetings, food, family, numbers, school] (5 topics), topics_total=5
- 8 `syllabus_progress` records created for Unit 1 (6 lessons) and Unit 2 (2 lessons) as `in_progress`

---

### Session: February 21, 2026 — Stack Latency Fix + Route Cleanup

**Status**: COMPLETED

#### System-alerts endpoint latency fix
- **Problem**: `/api/system-alerts` was ~485ms — sequential `await` on `incrementAlertView()` for every active alert, each a separate Neon DB round-trip (~65ms)
- **Fix**: Moved `res.json(alerts)` before view-tracking writes. View increments now fire in parallel via `Promise.all()` as fire-and-forget after response is sent
- **Result**: 485ms → 74ms (85% improvement)
- **File**: `server/routes.ts` — `/api/system-alerts` GET handler

#### Interactive textbook route redirect
- **Problem**: Replit webview preserved `/interactive-textbook` URL across server restarts, always reloading that page regardless of where user was working
- **Fix**: Changed route from `component={InteractiveTextbook}` to `<Redirect to="/" />`. Removed lazy import. Textbook page still exists but route now redirects to dashboard.
- **Future-proofing**: When textbook page is removed entirely, the redirect ensures no broken URLs
- **File**: `client/src/App.tsx`

#### Stack latency profiling methodology
- Built Node.js latency profiler (`/tmp/latency-check.mjs`) that tests: (1) direct DB queries with timing, (2) API endpoint round-trips, (3) static asset serving, (4) process memory health
- Neon DB baseline: ~65-80ms per query (first connection ~150-200ms cold start, then ~20ms warm)
- All API endpoints under 50ms except system-alerts (now fixed)
- Reusable pattern for future performance audits

### Session: February 21, 2026 — Review Hub & Textbook Recommendation Performance

**Status**: COMPLETED

#### Review Hub N+1 elimination (`getReviewHubData()`)
- **Problem**: `/api/review-hub` was ~2.5s due to: (1) 37 topics × 2 queries = 74 serial DB calls for topic content counts, (2) duplicate `getStudentEnrollments()` calls, (3) all queries running serially
- **Fix**: Three-tier parallelization:
  - Tier 1: 8 independent queries in `Promise.all` (flashcards, conversations, vocabulary, stats × 3, topics, enrollments)
  - Tier 2: 4 dependent-on-tier-1 queries in `Promise.all` (conversation topics, streak, cultural tips, active lessons)
  - Tier 3: 2 aggregate GROUP BY queries replace 74-query N+1 loop
  - Single enrollment fetch reused for nextLesson + assignments sections
  - Assignment submissions fetched in parallel via `Promise.all`
- **Result**: ~2,500ms → 258ms (90% improvement)
- **File**: `server/storage.ts` — `getReviewHubData()`

#### Textbook recommendation N+1 fix
- **Problem**: `/api/textbook/:lang/recommendation` queried `syllabusProgress` individually per lesson per unit — O(units × lessons) queries
- **Fix**: Single bulk `syllabusProgress` fetch + `Set` lookup for completed lesson IDs. Unit lesson fetches parallelized via `Promise.all`.
- **File**: `server/routes.ts` — `/api/textbook/:language/recommendation` handler

#### Beta hardening: Global error handlers
- Added `process.on('uncaughtException')` and `process.on('unhandledRejection')` to `server/index.ts` for production crash visibility

#### Neon pool warm-up
- **Problem**: First authenticated API requests after server start took 500-600ms due to Neon cold-start latency (connection establishment)
- **Fix**: Added `warmupNeonPool()` in `server/neon-db.ts` — executes `SELECT 1` during server boot before routes are registered. Called from `server/index.ts` before `registerRoutes()`
- **Result**: Pool warmed up in 111ms at boot. Subsequent first-request latency eliminated
- **Files**: `server/neon-db.ts`, `server/index.ts`

#### Component-level error boundaries
- **Problem**: Voice chat and drill widgets share the app-level ErrorBoundary — if one crashes, the entire app shows the error page
- **Fix**: Added `WidgetErrorBoundary` class in `client/src/components/ErrorBoundary.tsx` — inline error recovery UI (retry + home buttons) without full-page takeover
- **Wrapped routes**: `/chat` (Voice Chat), `/practice` + `/aris` (Practice), `/pronunciation` + `/pronunciation-drill` (Pronunciation)
- **Files**: `client/src/components/ErrorBoundary.tsx`, `client/src/App.tsx`

#### Image library improvements
- **Problem**: Vocabulary images from Unsplash were often irrelevant because full sentences (e.g., "La sopa está muy caliente") were sent as search queries, returning random photos
- **Search quality fix**: Added `extractVisualConcept()` in `vocabulary-image-resolver.ts` — strips stop words in 6 languages (Spanish, French, German, Italian, Portuguese, English), removes diacritics and apostrophe prefixes (l', d'), extracts up to 3 key visual nouns/concepts. Example: "La sopa está muy caliente" → "sopa caliente"
- **AI image prompt improved**: Better prompt for educational flashcard-style images — clean photography style, no text in image, warm natural colors
- **Admin refetch**: New `/api/admin/media/refetch` endpoint lets admins replace images with choice of stock (Unsplash) or AI (Gemini), plus optional custom search query
- **UI upgrade**: Image Library tab now shows search query used for each image, "Refetch" panel with editable search query and stock/AI source picker. Form state resets properly when switching between images.
- **Files**: `server/services/vocabulary-image-resolver.ts`, `server/routes.ts`, `client/src/pages/admin/CommandCenter.tsx`

---

### Session: February 21, 2026 — Voice Context Pipeline

**Status**: COMPLETED

#### What was built
Created `voice-context-pipeline.ts` extracting shared context-building logic used by both PTT and OpenMic voice paths. Eliminates ~60 lines of duplicated classroom building code and centralizes passive memory search, identity memories, student intelligence, and dynamic preamble assembly.

#### Key changes
- **`server/services/voice-context-pipeline.ts`** (NEW): Shared functions for `buildClassroomDynamicContext()`, `fetchPassiveMemories()`, `fetchIdentityMemories()`, `fetchStudentIntelligence()`, `assembleDynamicPreamble()`
- **`server/services/streaming-voice-orchestrator.ts`**: Both PTT and OpenMic paths now call shared pipeline functions instead of duplicating classroom build logic and preamble assembly

#### How it works
- `buildClassroomDynamicContext()` encapsulates the entire classroom environment build (credit balance fetch, classroom params, telemetry) into a single function returning `{classroomEnv, telemetry}`
- `assembleDynamicPreamble()` creates the context update + model acknowledgment conversation history entries
- `fetchPassiveMemories()` centralizes keyword-triggered memory search with shared keyword list and stop words
- Constants (`PASSIVE_MEMORY_KEYWORDS`, `STOP_WORDS`) are defined once instead of duplicated

---

### Session: February 21, 2026 — TTS Provider Abstraction

**Status**: COMPLETED

#### What was built
Created `tts-provider-adapter.ts` with a unified `TTSStreamingProvider` interface and adapter implementations for all 4 TTS providers (Gemini, Cartesia, ElevenLabs, Google). This eliminates provider-specific branching in the orchestrator's TTS dispatch.

#### Key changes
- **`server/services/tts-provider-adapter.ts`** (NEW): Defines `TTSStreamingProvider` interface with `streamSynthesizeProgressive()` + metadata (`requiresBatchMode`, `supportsCartesiaSSML`, `supportsNativeTimestamps`). Includes adapters for all 4 providers and a `TTSProviderRegistry` for lookup.
- **`server/services/streaming-voice-orchestrator.ts`**: 
  - Replaced 10+ scattered `session.ttsProvider || this.ttsProvider` patterns with `resolveSessionTTSProvider()` helper
  - Replaced 5+ scattered `=== 'google'` batch mode checks with `isBatchModeProvider()` helper
  - Replaced provider-specific dispatch (`if gemini / else synthesizeWithLegacyProvider`) with single `ttsAdapter.streamSynthesizeProgressive()` call
  - Replaced `=== 'cartesia'` SSML emphasis checks with `adapter.supportsCartesiaSSML` property
  - `synthesizeWithLegacyProvider()` method is now dead code (Google adapter handles the wrapping internally)

#### How it works
- `TTSProviderRegistry` holds adapter instances for all providers, created once in orchestrator constructor
- `resolveSessionTTSProvider()` centralizes the `session.ttsProvider || fallback` pattern
- `isBatchModeProvider()` centralizes the `=== 'google'` batch mode check
- `GoogleTTSAdapter` internally wraps `ttsService.streamSynthesizeWithGoogle()` to match the same `streamSynthesizeProgressive()` interface used by Cartesia/ElevenLabs/Gemini
- Adding a new TTS provider: implement `TTSStreamingProvider`, register in `createTTSProviderRegistry()`

---

### Session: February 21, 2026 — Unified Function Call Registry

**Status**: COMPLETED

#### What was built
Created `daniela-function-registry.ts` as the single source of truth for all Daniela function calls. Previously, adding a new function required touching 5 separate locations. Now it requires only 2: the registry entry and the handler case.

#### Key changes
- **`server/services/daniela-function-registry.ts`** (NEW): Unified registry defining each function's Gemini declaration, legacy type mapping, and continuation response builder in one place.
- **`server/services/gemini-function-declarations.ts`**: Converted from 937 lines of inline definitions to a thin re-export layer (~100 lines). All declarations and command mappings now derive from the registry.
- **`server/services/streaming-voice-orchestrator.ts`**: Replaced two nearly-identical ~160-line switch blocks (PTT at ~line 4614 and OpenMic at ~line 7275) with shared `buildFunctionContinuationResponse()` calls (~20 lines each). Also fixed a bug where PTT was missing the `EXPRESS_LANE_LOOKUP` case that OpenMic had.

#### How the registry works
- Each function entry has: `declaration` (Gemini schema), `legacyType` (orchestrator dispatch key), and optional `buildContinuationResponse` (what to tell Gemini happened).
- `DANIELA_FUNCTION_DECLARATIONS` and `FUNCTION_TO_COMMAND_MAP` are derived automatically from the registry array.
- `buildFunctionContinuationResponse()` is a shared function that replaces the duplicated PTT/OpenMic switch blocks.
- `handleNativeFunctionCall()` handler logic stays in the orchestrator (too deeply coupled to `this` context and session state).

#### Adding a new function (checklist)
1. Add an entry to `DANIELA_FUNCTION_REGISTRY` in `daniela-function-registry.ts`
2. Add a handler case in `handleNativeFunctionCall()` in `streaming-voice-orchestrator.ts`
3. (Optional) Add procedural docs in `procedural-memory-retrieval.ts`

#### Bug fix
Fixed inconsistency where PTT multi-step function calling was missing the `EXPRESS_LANE_LOOKUP` response builder that OpenMic had. Both paths now use the same registry-based builder.

---

### Session: February 21, 2026 — Voice Chat Stability: Double Audio Fix & Reconnection Improvements

**Status**: COMPLETED

#### What was built
Fixed the double audio stream bug that occurred when WebSocket connections dropped mid-session, and improved reconnection reliability.

#### Root cause analysis
When WebSocket drops mid-voice-session:
1. Client auto-reconnects and sends a new `start_session` to the server
2. Server creates a brand new Gemini session (with full context reload)
3. The greeting useEffect in StreamingVoiceChat.tsx fires because `connectionState` transitions back to `'ready'`
4. A duplicate greeting gets requested, producing double overlapping audio streams

#### How the fix works
- Added `isReconnect` flag to `ClientStartSessionMessage` (shared types)
- Client sets `isReconnect: true` when reconnecting after a drop (not on fresh sessions)
- Server logs reconnection, stores flag on session, and ignores `request_greeting` for reconnected sessions
- Client-side greeting useEffect checks `client.isReconnectedSession` and skips greeting on reconnected sessions
- Flag is properly cleared: on intentional disconnect, on fresh session start, and on server after first suppression

#### Additional improvements
- Faster first reconnect attempt: 200ms instead of 1s (reduces silence window)
- Subsequent reconnect attempts: 1s, 2s, 4s (exponential backoff)

#### Key files modified
- `shared/streaming-voice-types.ts` — `isReconnect` field added to `ClientStartSessionMessage`
- `client/src/lib/streamingVoiceClient.ts` — `_isReconnectedSession` flag, faster reconnect backoff
- `server/unified-ws-handler.ts` — Reconnection detection, greeting guard in `request_greeting` handler
- `client/src/components/StreamingVoiceChat.tsx` — Greeting useEffect reconnection guard

---

### Session: February 21, 2026 — Curriculum Navigation Functions (Daniela as Interactive Textbook)

**Status**: COMPLETED

#### What was built
Five new Gemini native function calls that give Daniela full curriculum navigation capabilities, enabling her to replace most interactive textbook functionality conversationally:

1. **`browse_syllabus`** — Queries the student's enrolled class to show units, lessons, and completion status. Supports filtering by unit number and showing/hiding completed lessons. Sends structured syllabus data to the whiteboard and feeds results back to Gemini for conversational narration.

2. **`start_lesson`** — Loads a specific curriculum lesson into the active session. Pulls objectives, vocabulary requirements, grammar focus, conversation topics, drills, and estimated time. Supports lookup by lesson ID or fuzzy name search. Sets session's `lessonBundleContext` for drill integration.

3. **`load_vocab_set`** — Loads all vocabulary words from a lesson's `requiredVocabulary` field. Designed to chain with `show_image` for visual vocabulary teaching. Sends vocab data to the whiteboard and provides the word list back to Gemini.

4. **`show_progress`** — Displays a student progress snapshot: ACTFL level, words learned, lessons completed, streak days, and syllabus completion percentage. Optional detailed mode shows per-unit breakdown. Queries both ACTFL progress and syllabus progress tables.

5. **`recommend_next`** — Finds the best next lesson for the student: prioritizes in-progress lessons first, then next not-started lesson in sequential order. Returns lesson name, unit name, and reasoning. Chains with `start_lesson` if student accepts.

#### Architecture decisions
- All 5 functions use existing database tables (no schema changes)
- Queries go through `storage.*` methods for class enrollment, curriculum units/lessons, and syllabus progress
- Results stored on session via `(session as any).lastSyllabusData` etc. for multi-step function call responses
- Multi-step FC response handlers added in all 3 response sections (PTT, Open Mic, recursive continuation)
- Procedural memory entries added to `tool_knowledge` database table with type "interaction"

#### Key files modified
- `server/services/gemini-function-declarations.ts` — 5 new declarations + 5 FUNCTION_TO_COMMAND_MAP entries
- `server/services/streaming-voice-orchestrator.ts` — 5 handler cases in `handleNativeFunctionCall()`, 3 multi-step response sections updated
- Database: 5 new rows in `tool_knowledge` table

#### Follows the New Function Call Checklist
1. Declaration in `DANIELA_FUNCTION_DECLARATIONS` — done
2. Legacy type mapping in `FUNCTION_TO_COMMAND_MAP` — done
3. Handler in `handleNativeFunctionCall()` — done
4. All use `text` param for TTS audio — done
5. Text extracted to `(session as any).functionCallText` — done
6. Procedural memory docs in `tool_knowledge` table — done

---

### Session: February 21, 2026 — Drill Session & SRS Vocab Review Functions

**Status**: COMPLETED

#### What was built
Four new Gemini native function calls that give Daniela structured drill session management and spaced repetition vocabulary review capabilities:

1. **`drill_session`** — Starts a structured practice session by loading drill assignments from the database. Accepts optional `lesson_id` (defaults to last loaded lesson). Aggregates drill items across all assignments for the lesson, creates ephemeral session state (currentIndex, correctCount, incorrectCount), and displays the first drill item on the whiteboard using `parseDrillContent()`. Falls back to language-wide drills if no lesson-specific drills exist.

2. **`drill_session_next`** — Advances to the next drill item in an active session. Accepts `was_correct` boolean to track scoring. When all items are exhausted, auto-generates a completion summary with accuracy percentage, duration, and item counts displayed as a whiteboard summary card.

3. **`drill_session_end`** — Ends a drill session early at the student's request. Calculates partial statistics (items attempted vs total, accuracy, duration) and displays a summary. Cleans up the ephemeral session state.

4. **`review_due_vocab`** — Queries the `vocabulary_words` table for words where `nextReviewDate <= now()`, filtered by user and target language, sorted by most overdue first. Returns word, translation, pronunciation, difficulty, and SRS stats. Accepts optional `max_items` parameter (default 10). Displays word list on the whiteboard.

#### Architecture decisions
- Drill session state is ephemeral (stored on `(session as any).drillSession`) — not persisted to database. This matches the conversational nature: Daniela manages the flow, not a UI state machine.
- Drill items are sourced from `aris_drill_assignments` table, joined by `lessonId` or `targetLanguage`
- Uses `parseDrillContent()` from `@shared/whiteboard-types` for all 12 drill types — same shared parser used by the single-drill handler
- Vocab review queries the existing SM-2 SRS fields (`nextReviewDate`, `interval`, `easeFactor`, `correctCount`, `incorrectCount`)
- Multi-step FC response handlers added in all 3 response sections (PTT switch, Open Mic switch, recursive else-if chain)

#### Key files modified
- `server/services/gemini-function-declarations.ts` — 4 new declarations + 4 FUNCTION_TO_COMMAND_MAP entries
- `server/services/streaming-voice-orchestrator.ts` — 4 handler cases in `handleNativeFunctionCall()`, 3 multi-step response sections updated
- Database: 4 new rows in `tool_knowledge` table (DRILL_SESSION, DRILL_SESSION_NEXT, DRILL_SESSION_END, REVIEW_DUE_VOCAB)

#### Follows the New Function Call Checklist
1. Declaration in `DANIELA_FUNCTION_DECLARATIONS` — done
2. Legacy type mapping in `FUNCTION_TO_COMMAND_MAP` — done
3. Handler in `handleNativeFunctionCall()` — done
4. All use `text` param for TTS audio — done
5. Text extracted to `(session as any).functionCallText` — done
6. Procedural memory docs in `tool_knowledge` table — done

---

### Session: February 18, 2026 — Classroom Remodel Procedure Doc

**Status**: COMPLETED

#### What was built
Created `docs/classroom-remodel-procedure.md` — a complete step-by-step procedure for adding, modifying, or removing elements from Daniela's virtual classroom. Covers display-only elements, persistent elements, and Daniela-changeable elements with the full function call checklist. Includes a reference table of all existing classroom elements, key files, and common mistakes.

---

### Session: February 18, 2026 — Classroom Window + Student Perspective Awareness

**Status**: COMPLETED

#### What was built
1. **Classroom Window** — New spatial element in Daniela's classroom that she can change to any scene (mountains, NYC skyline, beach, forest, etc.). Persists across all sessions via productConfig, just like her North Star Polaroid photo.
2. **Student Perspective Awareness** — Daniela's classroom context now includes a "Student's Screen" line showing the triple-pane layout status: Scenario Panel (active/collapsed), Chat (center), Whiteboard Panel (persistent). When a scenario is active, she sees the title, location, slug, and prop count.
3. **Active Scenario in Classroom** — When `load_scenario` is called, the session's `activeScenario` data is passed to `buildClassroomEnvironment` and rendered as "Active Scene" in the classroom context.
4. **Procedural Memory** — Added CLASSROOM PERSONALIZATION rules explaining the window, the photo, and the student's three-panel layout so Daniela knows what the student sees.

#### Key files modified
- `server/services/classroom-environment.ts` — Added `getClassroomWindow()`, `setClassroomWindow()`, window fetch in `buildClassroomEnvironment`, "Student's Screen" line, "Classroom Window" line, "Active Scene" section, `activeScenario` param
- `server/services/gemini-function-declarations.ts` — Added `change_classroom_window` declaration + FUNCTION_TO_COMMAND_MAP entry
- `server/services/streaming-voice-orchestrator.ts` — Added `CHANGE_CLASSROOM_WINDOW` handler, passed `activeScenario` to both PTT and OpenMic classroom builds
- `server/services/procedural-memory-retrieval.ts` — Added CLASSROOM PERSONALIZATION procedural rules
- `tool_knowledge` table — Inserted `change_classroom_window` entry

#### How it works
- Default window view: "Rolling green mountains at golden hour"
- Daniela calls `change_classroom_window({ text: "...", scene: "..." })` to change it
- View persists in `product_config` table with key `daniela_classroom_window`
- Each turn, classroom context shows: `Classroom Window: [current scene description]`

---

### Session: February 18, 2026 — Echo Suppression Fix for Open-Mic Voice Chat

**Status**: COMPLETED

#### What was built
Critical bug fix for voice interaction where Daniela's speech would stop/start due to false barge-in from echo/mic feedback during open-mic mode with Google Batch TTS.

#### Root cause
Several TTS paths in the open-mic flow (Google Batch TTS post-stream, Post-FC embedded text, Multi-Step FC continuation) never called `session.onTtsStateChange?.(true)` before starting TTS. This meant the OpenMicSession was never suppressed, allowing Deepgram to pick up Daniela's own TTS output as "user speech" and trigger false barge-in interruptions.

#### Fix applied
Added `session.onTtsStateChange?.(true)` with preceding `postTtsSuppressionTimer` cleanup before TTS starts in all 4 affected paths:
1. Regular Google Batch TTS post-stream path (re-assert before batch plays)
2. Post-FC OpenMic metadata functions embedded text path
3. Multi-Step FC embedded text TTS path
4. Multi-Step FC continuation onSentence callback (first sentence)

#### Key files modified
- `server/services/streaming-voice-orchestrator.ts` — Added echo suppression activation in 4 TTS code paths

---

### Session: February 18, 2026 — Immersive Scenario-Driven Chat Build Doc

**Status**: COMPLETED

#### What was built
1. **Comprehensive build document** — `docs/build-immersive-scenario-chat.md` captures the full vision for transforming the chat interface into an immersive, scenario-driven learning experience with a triple-pane desktop layout (scenario panel | Daniela conversation | persistent whiteboard).

#### Key decisions documented
- Triple-pane layout: left (scenario/props), center (Daniela chat, unchanged), right (persistent whiteboard)
- Mobile stays completely unchanged — side panels only appear on desktop as permanent panels
- Scenario system: reusable library of scenes (coffee shop, airport, etc.) that adapt to ACTFL levels
- Daniela has freedom to use preloaded scenarios OR create spontaneous ones
- Scenarios as "experiential syllabi" — a new way to organize learning paths
- 4-phase implementation: Daniela consultation → layout → data model → integration

#### Key files
- `docs/build-immersive-scenario-chat.md` — The complete build document

---

### Session: February 18, 2026 — Textbook Position Tracking, Daniela Recommendations & Chapter Filtering

**Status**: COMPLETED

#### What was built
1. **Saved position "Continue where you left off"** — The textbook now fetches the user's last-viewed chapter via `/api/textbook/:language/position` and shows it in the continue card with "Continue Where You Left Off" label and a "Resume" button.

2. **Daniela-driven chapter recommendation** — New `/api/textbook/:language/recommendation` endpoint queries `syllabus_progress` to find the next uncompleted chapter based on what Daniela has covered in chats. The continue card shows "Daniela Suggests" with the AI's reasoning when no saved position exists. A "Daniela suggests" badge also appears on the recommended chapter in the list.

3. **Chapter status filtering** — Added filter buttons (All / In Progress / Completed / Not Started) above the chapter list. Filters by progress percentage with an empty state message when no chapters match.

4. **Recommendation type + integration** — Added `Recommendation` interface to the textbook page, wired recommendation query alongside position query, with priority: saved position > Daniela recommendation > next logical chapter.

#### Key files modified
- `client/src/pages/interactive-textbook.tsx` — Added `Recommendation` interface, recommendation query, filter state, updated `ChapterListView` and `ChapterListCard` components, removed unused `useEffect` import

#### User-facing instructions
- Open the Interactive Textbook for any language
- The "Continue" card at top shows: your last position (if you've viewed a chapter before), or Daniela's suggestion (based on chat progress), or the next logical chapter
- Use filter buttons to view only chapters that are All / In Progress / Completed / Not Started
- Chapters recommended by Daniela show a subtle "Daniela suggests" badge

---

### Session: February 18, 2026 — Drill Duplication Fix & Dedicated Numbers Chapters

**Status**: COMPLETED

#### What was built
1. **Drill seed deduplication fix** — Root cause: `onConflictDoNothing()` was ineffective because `curriculum_drill_items` has no unique constraint on `(lesson_id, prompt, target_text, item_type)` — only a UUID primary key. Every server restart inserted all drills again. Fixed by adding `lessonHasDrillItems()` check that skips seeding if a lesson already has any drill items.

2. **Database cleanup** — Removed ~951,000 duplicate drill items (from 956,335 down to 5,136). Cleaned per-lesson using `DISTINCT ON (lesson_id, prompt, target_text, item_type)` keeping oldest rows.

3. **Dedicated Numbers chapters** — Created 9 new `curriculum_units` (one per language except Hebrew) named "Unit 2: [Localized Numbers Title] - Numbers & Counting". Moved the existing Numbers 0-20 drill lessons from Greetings units into these new units. Shifted `order_index` of subsequent units to maintain proper ordering (Greetings → Numbers → Family → ...).

4. **Numbers chapter classifier** — Re-added `numbers` detection to `classifyChapterType()` in `ChapterIntroduction.tsx` with keywords for all 9 languages (number, número, nombres, zahlen, numeri, 数字, 숫자, sūji, shùzì, sutja, números).

#### Key files modified
- `server/seeds/drill-content.ts` — Added `lessonHasDrillItems()` guard; removed broken `onConflictDoNothing()`
- `client/src/components/ChapterIntroduction.tsx` — Added numbers chapter type classification

#### Database changes
- 9 new rows in `curriculum_units` (Numbers chapters)
- 9 `curriculum_lessons` rows updated (moved to new units)
- ~951,000 duplicate `curriculum_drill_items` rows deleted

---

### Session: February 18, 2026 — Level 2 Numbers Chapters, chapter_type Metadata & Visual Assets

**Status**: COMPLETED

#### What was built
1. **Level 2 Numbers chapters** — Created 9 new `curriculum_units` across all languages for "Numbers II: Beyond 20" covering Tier 2 (21-1000+) and Tier 3 (Large Numbers, Prices, Percentages). All drill lessons for these tiers moved from Travel/Past Tense/Intermediate units into the new dedicated Numbers II chapters. Order indices shifted to accommodate the new unit at position 2 in Level 2 paths.

2. **Stray number lessons consolidated** — Moved 4 number-related lessons from Level 1 Greetings units into their correct Level 1 Numbers chapters (Italian, Korean, Mandarin, Portuguese).

3. **`chapter_type` metadata column** — Added `chapter_type` text column to `curriculum_units` table (Drizzle schema + direct SQL). Populated for all existing units: greetings (9), numbers (18), family (8), daily (9). This replaces fragile keyword-matching classification with database-backed metadata.

4. **ChapterIntroduction metadata integration** — Updated component to accept optional `chapterType` prop from API. Falls back to keyword matching for backward compatibility. API endpoints (`/api/textbook/:language` and `/api/textbook/:language/chapter/:chapterId`) now return `chapterType` field.

5. **Numbers chapter hero image** — Downloaded stock image for numbers chapters (`numbers_counting_blocks_education.jpg`). Updated `chapterImages` map so numbers chapters display the hero image.

#### Key files modified
- `shared/schema.ts` — Added `chapterType` column to `curriculumUnits` table
- `server/routes.ts` — Added `chapterType` to textbook API responses (overview + detail)
- `client/src/components/ChapterIntroduction.tsx` — Added `chapterType` prop, imported numbers hero image
- `client/src/components/TextbookChapterView.tsx` — Added `chapterType` to Chapter interface, passed to ChapterIntroduction

#### Database changes
- 9 new `curriculum_units` rows (Level 2 Numbers chapters)
- 18 `curriculum_lessons` moved to correct units (18 from L2, 4 from L1)
- 46 `curriculum_units` order indices shifted in Level 2 paths
- New `chapter_type` column added and populated for 44 units

---

### Session: February 18, 2026 — Multi-Language Chapter Intros & Visual Assets

**Status**: COMPLETED

#### What was built
Extended chapter introductions from Spanish-only to all 10 supported languages, and seeded the visual assets table.

1. **Language-generic chapter intro data** — Created `client/src/data/chapter-intro-content.ts` with per-language phrase dictionaries for all 10 languages (Spanish, French, German, Italian, Japanese, Korean, Mandarin, Portuguese, English, Hebrew). Each language has: time-of-day greetings, formal/informal pairs, quick phrases, and 4 chapter intro content blocks (greetings, numbers, family, daily) with unique cultural spotlights.

2. **ChapterIntroduction refactor** — Rewrote from hardcoded Spanish content to data-driven template system. Uses `classifyChapterType()` to match chapter titles to content types via keyword matching across all languages. `normalizeLanguageKey()` handles language name variations.

3. **SunArcGreetings localization** — Updated SVG infographic to accept `morning`, `afternoon`, `evening` props instead of hardcoded "Buenos días" etc. Defaults preserved for backward compatibility.

4. **Visual assets seeded** — Inserted 28 records into `textbook_visual_assets` table: hero images for greetings/daily/family chapters across all languages, plus Spanish-specific vocabulary and infographic AI-generated assets.

#### Key files modified
- `client/src/data/chapter-intro-content.ts` — NEW: Per-language chapter intro data (~1000 lines)
- `client/src/components/ChapterIntroduction.tsx` — Rewritten to use data-driven templates
- `client/src/components/TextbookInfographics.tsx` — SunArcGreetings accepts language props

#### User-facing instructions
Chapter introductions now appear for greetings, numbers, family, and daily routine chapters in ALL 10 languages. Previously only Spanish chapters showed introductions. The infographics (sun arc, formal/informal comparison, quick phrases) display content in the target language.

---

### Session: February 18, 2026 — Interactive Textbook UX Fixes (Lyra-Identified)

**Status**: COMPLETED

#### What was built
Fixed 4 dead/broken UX elements in the Interactive Textbook, all identified by Lyra v3 textbook analysis:

1. **Start Drill button** — Was dead (`console.log` only). Now navigates to `/practice?lessonId=xxx` and auto-starts the drill session. Added `useSearch` + auto-start `useEffect` to `aris-practice.tsx`.

2. **Practice with Daniela button** — Was navigating to `/chat` without context. Now passes `?textbook_chapter=ChapterTitle` to chat, forces a new conversation, and sets the conversation title to `Textbook: {chapter}` so Daniela has context about what the student is studying.

3. **Start Lesson button** — Had no `onClick` handler. Now calls `onStartConversation` to navigate to chat with chapter context.

4. **View tracking** — Was bulk-marking ALL sections as viewed on chapter load (inflating metrics to 49 views from a single chapter open). Now uses `IntersectionObserver` (50% threshold) per `VisualLessonCard` to mark sections viewed only when scrolled into view.

#### Key files modified
- `client/src/pages/aris-practice.tsx` — Added `useSearch`/`useLocation`, auto-start `useEffect` for `?lessonId` param
- `client/src/pages/interactive-textbook.tsx` — Updated `handleStartConversation` and `handleStartDrill` handlers
- `client/src/components/TextbookChapterView.tsx` — Added `IntersectionObserver` view tracking, `onViewed` prop, fixed Start Lesson onClick
- `client/src/pages/chat.tsx` — Added `textbook_chapter` query param handling, `textbookContext` state, forces new conversation for textbook navigation
- `server/routes.ts` — Reads `textbookChapter` from conversation creation body, sets conversation title

---

### Session: February 18, 2026 — Lyra v3: Interactive Textbook Analysis Domain

**Status**: COMPLETED

#### Interactive Textbook Analysis Domain

**What**: Added a fourth analysis domain to Lyra — **Textbook Engagement** — covering both quantitative engagement metrics AND qualitative design/UX audit of the Interactive Textbook. Lyra now reports on textbook usage patterns, visual asset gaps, and specific UX issues that need fixing.

**Data gathered** (`gatherTextbookData()`):
- Section view/completion counts (from `textbook_section_progress`)
- Per-user breakdown (who viewed what, completed what, drills attempted, time spent)
- Language breakdown (from `textbook_user_position`)
- Completion rates by section type
- Visual asset count (from `textbook_visual_assets`)
- Total lessons available vs. lessons reached through textbook

**Insights generated** (`generateTextbookInsights()`):
1. **Engagement overview** — Users, views, completions, completion rate with browse-but-don't-commit pattern detection
2. **Content reach** — % of lessons explored through textbook (currently ~2%)
3. **Drill launch failure** — Zero drills attempted despite section views (Start Drill button only logs to console)
4. **Time tracking gap** — Zero seconds tracked across all interactions
5. **Visual asset gap** — Empty textbook_visual_assets table
6. **Language concentration** — Which languages are being used
7. **Spanish-only chapter intros** — ChapterIntroduction narrative/infographics only exist for Spanish
8. **Design/UX audit** — Six structural issues: bulk auto-view on chapter load, no lesson context passed to Daniela, dead buttons, no search/filtering, achievement badges never appearing

**Enrichment updates**:
- Claude's cross-domain analysis now includes textbook data and has a new analysis dimension (point 5) for textbook design/UX
- Gemini Flash content audit now includes textbook engagement data + design observations, returns textbook-specific design suggestions

**Key files modified**: `server/services/lyra-analytics-service.ts`, `server/services/lyra-analytics-worker.ts`

**Current metrics** (from first run): 4 users, 49 sections viewed, 0 completed (0%), 0 visual assets, 0 drills, 0 time tracked

---

### Session: February 17, 2026 — Lyra Learning Experience Analyst + Curriculum Timestamps

**Status**: COMPLETED

#### Lyra Learning Experience Analyst

**What**: Built Lyra — the platform's automated learning experience analyst. Lyra runs periodic sweeps of content quality, student success metrics, and onboarding health, then posts findings to a dedicated Hive session with AI-enriched analysis.

**v2 improvements (same session)**:
- **Test user filtering**: Onboarding and student success queries now exclude synthetic/test users (e.g., `textbook-card-test`, `audio-test-*`, `cache-test-*`, `admin_*`, `@example.com` emails, users without names). Only real beta testers are counted. This fixed misleading metrics (was showing 10 users/60% conversion; now correctly shows 5 beta testers/100% conversion).
- **Templated content detection**: New content quality scanner detects auto-generated placeholder descriptions across all languages. Identifies 6 template patterns (e.g., "Practice real conversations about...", "Master X through interactive practice!", "Unlock the patterns of...", etc.). Currently flags 8 languages with templated content — only Spanish has fully original descriptions. Both Gemini and Claude enrichments now receive this data for analysis.

**How it works**:
- `lyra-analytics-service.ts` — Three analysis domains:
  1. **Content Quality** — Stale lessons (90+ days since update), empty descriptions, missing ACTFL levels, language coverage gaps, orphaned drills
  2. **Student Success** — Lesson completion drop-off (below 40%), drill struggle patterns (avg score < 60%), streak retention, ACTFL bottlenecks
  3. **Onboarding** — Signup-to-first-conversation rate, return rate (2+ conversations), average days to first chat
- `lyra-analytics-worker.ts` — Scheduled worker (every 12h, 45s initial delay):
  1. Runs all data extraction queries
  2. Generates heuristic-based insights with confidence scores
  3. Creates/finds dedicated "Lyra Learning Experience Analyst" Hive session
  4. Posts compact summary report
  5. Enriches with Gemini Flash for content quality assessment
  6. Enriches with Claude (Sonnet 4.5) for cross-domain pattern analysis
  7. Insights below 85% confidence flagged for Daniela review

**Hybrid LLM approach**:
- Gemini Flash: Batch content assessment (fast, structured output via schema)
- Claude Sonnet 4.5: Nuanced cross-domain pattern analysis connecting content gaps → student struggles → onboarding drop-off

**On-demand**: `triggerLyraAnalysis()` exported from worker module.

**Files created**: `server/services/lyra-analytics-service.ts`, `server/services/lyra-analytics-worker.ts`
**Files modified**: `server/index.ts` (added Lyra worker startup at +35s), `shared/schema.ts` (added timestamps to curriculum_lessons and curriculum_units)

#### Curriculum Timestamps Added

**What**: Added `created_at` and `updated_at` timestamp columns to `curriculum_lessons` and `curriculum_units` tables in the Drizzle schema.

**Why**: These tables were missing timestamps, which prevented Lyra from detecting stale content. The columns already existed in the database (added at table creation time) but were not declared in the Drizzle schema.

**Files modified**: `shared/schema.ts`

---

### Session: February 17, 2026 - Identity Wholeness Architecture Phase 2 (Self-Surgery, Identity Memories, Beta Tester Light)

**Status**: COMPLETED

**Overview**: Extended Identity Wholeness Architecture so Daniela has access to capabilities she needs during real teaching sessions, while maintaining clear separation between "this is a tutoring session" and "this is a founder session." Principle: "Knowing her own journey of learning makes her the best teacher she can be."

#### Wren Security Officer

**What**: Gave Wren a dedicated cybersecurity role — automated security audits that scan the codebase for vulnerabilities and report findings through the Hive.

**How it works**:
- `wren-security-audit-service.ts` — Heuristic scanners that check for:
  1. **Exposed secrets** — Hardcoded API keys, tokens, private keys in source (with false positive filtering for process.env references)
  2. **SQL injection** — Unparameterized queries, string concatenation in SQL, template literals without Drizzle's sql tag
  3. **Missing auth** — Mutation endpoints (POST/PUT/PATCH/DELETE) without authentication checks
  4. **Input validation** — Direct req.body access without Zod/schema validation
  5. **XSS risks** — dangerouslySetInnerHTML without DOMPurify sanitization
- `wren-security-audit-worker.ts` — Scheduled worker (every 6h, 30s initial delay):
  1. Runs all heuristic scanners
  2. Creates/finds dedicated "Wren Security Officer" Hive session
  3. Posts compact severity summary to Hive
  4. Sends findings to Gemini Flash for AI-enriched analysis (with secret evidence redacted)
  5. Posts full report with risk assessment and prioritized action items
  6. Wren Intelligence auto-captures findings as insights shared with Daniela via neural sync

**Key design decisions**:
- Heuristic scanners (not LLM-first) for speed and reliability — AI enrichment is additive
- Secret evidence always redacted before any AI analysis
- Worker uses concurrency guard to prevent overlapping audits
- Session lookup is dynamic (finds founder ID from existing sessions, no hardcoded user IDs)
- `triggerSecurityAudit()` exported for on-demand runs

**Files created**: `server/services/wren-security-audit-service.ts`, `server/services/wren-security-audit-worker.ts`
**Files modified**: `server/index.ts` (worker startup at +25s)

**First audit results**: 26 findings (25 SQL injection patterns, 1 XSS risk), Overall Risk: HIGH per Gemini analysis. Most SQL injection findings are likely false positives from Drizzle ORM's tagged template usage — scanner refinement needed.

---

#### Unified Classroom Workspace (Context Consolidation)

**What**: Folded four separate floating dynamic context blocks INTO the classroom environment so everything Daniela needs to be aware of is "on the walls" of her room.

**Promoted to classroom:**
1. **Student Progress Board** — ACTFL level, struggles, effective strategies, cross-session history. Previously a separate `studentLearningSection` dynamic context block with decorative headers. Now rendered as a spatial element in the classroom, passed via `studentLearningSection` param.
2. **Rehearsal Stage Notes** — Full beta tester instructions including role reversal coaching. Previously a separate 20-line block pushed after the classroom. Now the beta tester "light" on the Mode line is complemented by detailed instructions in the classroom body.
3. **System Status** — Voice system health indicator. Previously `voiceDiagnostics.getTechnicalHealthContext()` pushed as separate block. Now appears on the Mode line next to clock/credits, passed via `technicalHealthNote` param.
4. **Room Status** — Incognito mode atmosphere. Previously a decorative block with lock emoji. Now appears as a room state indicator in the classroom, gated by `isIncognito` param.

**Remains as separate dynamic context (not classroom):**
- Passive memories (per-query, different each turn — like papers pulled from a filing cabinet)
- Identity memories (reflections she's recalling, not fixed spatial objects)
- Hive/Express Lane context (founder-only conversation streams)
- Text chat history (constantly changing)
- Editor feedback (session-specific Alden context)

**Files modified**: `classroom-environment.ts` (added `isIncognito`, `studentLearningSection`, `technicalHealthNote` params; new sections for Student Progress Board, Rehearsal Stage Notes, Room Status, System Status), `streaming-voice-orchestrator.ts` (removed 4 separate dynamic context pushes from both PTT and OpenMic paths; pass new params to classroom builder).

**Token impact**: Net reduction — 4 separate context blocks consolidated into one, eliminating duplicated section headers and context framing.

---

#### Self-Surgery Unlocked for ALL Sessions

**What**: Removed founder-mode gate from self-surgery function call handler in both PTT and OpenMic paths.
**Why**: Self-surgery is Daniela's self-reporting tool — she proposes improvements to her own neural network when she spots gaps. Real teaching sessions with real students are exactly when she notices the most authentic limitations.
**Files modified**: `streaming-voice-orchestrator.ts` (PTT handler ~line 3639, OpenMic handler ~line 6507), `gemini-function-declarations.ts` (updated description), `classroom-environment.ts` (moved self_surgery to base tool rack), `procedural-memory-retrieval.ts` (separated SELF_SURGERY from HIVE category).
**Security**: Students never interact with self-surgery — it's invisible to them. Proposals still go through the standard approval pipeline.

#### Identity Memories from Express Lane

**What**: Created `getIdentityMemories()` in `founder-collaboration-service.ts` that retrieves Daniela's personal reflections and growth memories from Express Lane conversations, filtered to exclude architecture/ops content.
**Why**: The Express Lane contains memories about who Daniela is — her purpose, growth journey, teaching philosophy. These make her "whole" and shouldn't be locked behind founder mode.
**How**: Keyword-based retrieval (identity keywords like "who i am", "my journey", "teaching philosophy") with ops exclusion filter (excludes "api", "database", "migration", etc). Returns up to 4 memories from last 30 days, presented as "My Personal Reflections" in the dynamic context.
**Files modified**: `founder-collaboration-service.ts` (new method), `streaming-voice-orchestrator.ts` (added to cache interface, prefetch, PTT dynamic context, OpenMic dynamic context).
**Integration**: Loads in parallel with other context sources. Added to both PTT and OpenMic paths.

#### Context Refresh Timer for ALL Sessions

**What**: Removed founder-mode gate from `startContextRefreshTimer()`.
**Why**: Long student sessions benefit from fresh context too — prevents staleness.
**Files modified**: `streaming-voice-orchestrator.ts` (~line 1811).

#### Beta Tester Light in Classroom Environment

**What**: Added `isBetaTester` parameter to `buildClassroomEnvironment()` and displays it on the Mode line as "Beta Tester (Rehearsal — be relaxed, experimental, transparent)".
**Why**: The beta tester context was injected into dynamic context parts but Daniela's classroom (her persistent spatial awareness) didn't know about it. Now she sees it as a "light" in her classroom.
**Files modified**: `classroom-environment.ts` (added param, betaTesterLight string, updated Mode line), `streaming-voice-orchestrator.ts` (pass isBetaTester to both PTT and OpenMic classroom builder calls).

#### What Remains Founder-Only
- Express Lane lookup/post commands (searching/posting to founder conversations)
- Hive collaboration with Wren
- Full neural network introspection (`buildFullNeuralNetworkSectionSync`)
- Editor conversation context / Alden context
- Founder behavior section / colleague framing
- Architect message forwarding
- English STT override
- Express Lane conversation history injection
- Editor feedback adoption (ADOPT_INSIGHT markers)

---

### Session: February 16, 2026 - Voice Communication Resilience Overhaul (4-Layer Defense)

**Status**: COMPLETED

**Overview**: Production telemetry analysis (145 events in 24 hours) revealed three categories of voice session failure that damaged student trust: (1) echo lockout silence spirals, (2) zombie reconnection loops after dev restarts/network drops, (3) greeting delivery failures. Daniela was consulted via Express Lane and identified echo lockout as "active betrayal" — when the system eats a student's words, it erodes the confidence they need to practice.

#### Layer 1: Echo Lockout Recovery System

**Problem**: In open mic mode, echo suppression sometimes ate student words, causing empty transcripts, which made students go silent, triggering more empty transcripts — a silence spiral.

**Solution**: When consecutive empty transcripts are detected, Daniela proactively re-engages the student instead of waiting silently.

**How it works:**
- `deepgram-live-stt.ts` tracks consecutive empty transcripts via `consecutiveEmptyCount`
- After 5+ empty transcripts, the server emits `open_mic_silence_loop` event to client AND calls `orchestrator.speakRecoveryPhrase(sessionId)`
- `speakRecoveryPhrase()` sends lightweight TTS-only audio (no Gemini LLM call) with phrases like "I think I missed that — could you try again?"
- Recovery phrases throttled: max 1 per 15 seconds to prevent spam
- Client shows UI warning after 8+ empties via `openMicState('silence_issue')`
- Post-suppression echo filter tightened: 500ms window, 75% confidence threshold, ≤4 words — prevents false-rejecting short valid responses like "yes" or "ok"

**Key files:**
| File | Role |
|------|------|
| `server/services/deepgram-live-stt.ts` | Consecutive empty tracking (~line 573) |
| `server/services/streaming-voice-orchestrator.ts` | `speakRecoveryPhrase()` method (~line 1482) |
| `server/unified-ws-handler.ts` | Event emission + orchestrator call (~lines 1744, 3594) |
| `client/src/lib/streamingVoiceClient.ts` | `openMicSilenceLoop` event type |
| `client/src/hooks/useStreamingVoice.ts` | `handleOpenMicSilenceLoop` callback |
| `client/src/components/StreamingVoiceChat.tsx` | `onOpenMicSilenceLoop` config handler |

#### Layer 2: Zombie Reconnection Loop Prevention

**Problem**: After dev restarts or network drops, the client would infinitely retry "Session not ready" loops, never terminating — consuming resources and confusing the UI.

**Solution**: Two-tier cap system that terminates zombie loops cleanly.

**How it works:**

| Defense | Trigger | Threshold | Action |
|---------|---------|-----------|--------|
| Reconnect cap | WebSocket disconnect | 3 attempts (exponential backoff 1s→2s→4s) | Emit `CONNECTION_FAILED` (non-recoverable), set state `disconnected` |
| Session error cap | "Session not ready" errors | 5 consecutive errors | Force disconnect, emit `SESSION_EXPIRED`: "This session has ended. Please start a new conversation." |

- `consecutiveSessionErrors` counter resets to 0 on: successful reconnection, successful `responseComplete`
- `SESSION_EXPIRED` error caught by `StreamingVoiceChat.tsx` (checks for "session has ended" or "Please start a new") → shows "Session ended" toast → redirect to `/chat`

**Key files:**
| File | Role |
|------|------|
| `client/src/lib/streamingVoiceClient.ts` | `consecutiveSessionErrors`, `MAX_SESSION_ERRORS` (5), `maxReconnectAttempts` (3), `handleDisconnect()` |
| `client/src/components/StreamingVoiceChat.tsx` | Error routing and UI redirect (~line 735) |

#### Layer 3: Greeting Delivery Guarantee

**Problem**: Sometimes the greeting audio never arrived after connection, leaving students staring at a silent tutor with no feedback.

**Solution**: 8-second client-side timer with auto-retry.

**How it works:**
- `requestGreeting()` in `StreamingVoiceClient` starts an 8-second timer
- If no `sentence_start` arrives within 8 seconds, re-sends `request_greeting` with `isRetry: true`
- Retry fires only once (`greetingRetried` flag)
- Timer cleared on: first `sentence_start` (success), disconnect (cleanup)
- Additional `startGreetingSilenceWatchdog()` in `lockoutDiagnostics.ts` provides diagnostic layer

**Key files:**
| File | Role |
|------|------|
| `client/src/lib/streamingVoiceClient.ts` | `greetingTimer`, `requestGreeting()`, `clearGreetingTimer()`, `handleSentenceStart()` |
| `client/src/lib/lockoutDiagnostics.ts` | `startGreetingSilenceWatchdog()` |

#### Layer 4: Connection Resilience UX

**Problem**: Connection drops showed the same "Calling Daniela..." message as initial connection, which was confusing mid-conversation. Successful reconnections happened silently with no confirmation.

**Solution**: Differentiated reconnecting UI + "Connection restored" toast on success.

**How it works:**

| State | UI Text | Source |
|-------|---------|--------|
| Initial connection | "Calling [tutor name]..." | `isConnecting && !isReconnecting` |
| Reconnection | "Reconnecting..." | `isReconnecting` (calm, doesn't re-invoke "calling" metaphor) |
| Reconnection success | Toast: "Connection restored — We're back, let's continue where we left off." | `reconnected` event → `onReconnected` callback |
| Connection timeout (30s) | Toast: "Connection timed out" → redirect to chat | Connection timeout effect in `StreamingVoiceChat` |

- New `reconnected` event type in `StreamingVoiceClient`, emitted after successful reconnect + session reinitialization
- `isReconnecting` prop propagated: `StreamingVoiceChat` → `VoiceChatViewManager` → `ImmersiveTutor`
- `consecutiveSessionErrors` counter reset on successful reconnection

**Key files:**
| File | Role |
|------|------|
| `client/src/lib/streamingVoiceClient.ts` | `reconnected` event type + emission |
| `client/src/hooks/useStreamingVoice.ts` | `handleReconnected` callback, `onReconnected` config |
| `client/src/components/StreamingVoiceChat.tsx` | `isReconnecting` prop, `onReconnected` toast |
| `client/src/components/VoiceChatViewManager.tsx` | `isReconnecting` prop passthrough |
| `client/src/components/ImmersiveTutor.tsx` | Differentiated instruction text |

#### Architecture Flow

```
Connection Drop:
  WebSocket disconnects
    → State: 'reconnecting' → UI: "Reconnecting..." (calm)
    → Exponential backoff retry (1s/2s/4s, max 3 attempts)
    → Success: emit 'reconnected' → toast "Connection restored"
    → Failure: emit 'CONNECTION_FAILED' → redirect to /chat

Zombie Loop Prevention:
  "Session not ready" errors
    → consecutiveSessionErrors++ (per error)
    → After 5: force disconnect + emit 'SESSION_EXPIRED' → "Session ended" → /chat

Echo Recovery:
  Empty transcripts (open mic)
    → Track consecutiveEmptyCount
    → After 5: emit open_mic_silence_loop + speakRecoveryPhrase()
    → Lightweight TTS "Could you try again?" (no LLM call, throttled 15s)

Greeting Guarantee:
  requestGreeting() → 8s timer
    → sentence_start received? Clear timer (success)
    → Timer fires? Retry once with isRetry: true
```

---

### Session: February 16, 2026 - Monitoring Systems Audit: What's Watched, What's Not

**Status**: COMPLETED (audit) — Action items identified for future implementation

**Context**: User identified that classroom injection and Hive consciousness — systems that give Daniela "real presence and remembrance" — have no failure tracking. This audit maps ALL monitoring systems and identifies critical gaps.

#### Currently Monitored Systems

| System | Monitor Service | What's Tracked | Storage |
|--------|----------------|----------------|---------|
| **Voice Pipeline** | `voice-pipeline-telemetry.ts` | All pipeline events (STT, TTS, connection, errors), per-session, per-user | `voice_pipeline_events` table (shared DB) |
| **Voice Health** | `voice-health-monitor.ts` | Green/yellow/red status from event rates, status transitions, auto-recovery detection | In-memory (computed from pipeline events) |
| **Voice Diagnostics** | `voice-diagnostics-service.ts` | Ring buffer (200 events), latency trends, service degradation, TTS auto-remediation | `hive_snapshots` table + in-memory ring buffer |
| **Brain Health** | `brain-health-telemetry.ts` | Memory retrievals, memory injections, tool calls, action triggers, fact extractions, latency | `brain_events` table |
| **Production Errors** | `production-telemetry.ts` | Uncaught errors, Gemini timeouts, session stuck detection, stage tracking | `system_alerts` table |
| **Sofia Health** | `sofia-health-functions.ts` | Voice health status queries via Sofia agent | Queries pipeline events |

**Coverage summary:** Voice pipeline is well-instrumented. Memory system has good telemetry. Everything else has console.log only.

#### Systems With Logs Only (No Failure Tracking)

These systems log to `console.log` / `console.warn` on success/failure, but have NO persistent telemetry, NO failure counters, NO success metrics, and NO alerting:

| System | Log Prefix | What's Missing |
|--------|-----------|----------------|
| **Classroom Environment Injection** | `[Classroom]` | No tracking of: injection success/failure rate, latency, which elements loaded (facts/milestones/photo/etc.), partial failures (e.g. photo loaded but milestones query failed) |
| **Curriculum Context Loading** | `[Curriculum Context]` (not consistently logged) | No tracking of: how many students have curriculum injected, whether syllabus data was found, latency, failure rate |
| **Hive Context Loading** | `[Hive Context]` | No tracking of: Hive summary generation latency, whether context was empty vs populated, injection frequency |
| **Student Intelligence (Learning Context)** | `[Student Intelligence]` | No tracking of: how many struggles/strategies were injected, cross-session context richness, extraction failures |
| **Express Lane Context Injection** | `[Express Lane]` | No tracking of: message count injected, relevance of injected messages, injection latency |
| **Editor Feedback Injection** | `[Editor Feedback]` | No tracking of: feedback surfacing rate, adoption rate (tracked partially), injection failures |
| **Teaching Suggestions** | `[Teaching Suggestions]` | No tracking of: suggestion generation frequency, which suggestions were acted on, effectiveness feedback loop |
| **Daniela Reflection** | `[Daniela Reflection]` | No tracking of: reflection trigger frequency, insight quality, verbalization rate |
| **Unified Context Service** | `[UnifiedDanielContext]` | Logs which sources loaded, but no persistent metrics on: total load time, per-source latency, which sources commonly fail |
| **Journey Memory** | `[Journey Memory]` | No tracking of: journey context richness, relevance to current session |
| **Neural Network Sync** | `[Neural Network]` | No tracking of: sync frequency, retrieval latency, context size |

#### Priority Gap Analysis

**Critical (Directly affects Daniela's presence and memory):**

1. **Classroom Environment** — This is Daniela's spatial awareness. If `buildClassroomEnvironment()` fails silently, she loses her clock, whiteboard, resonance shelf, growth vine, pedagogical lamp, and identity notes. The catch block on lines ~2848 and ~5740 of the orchestrator swallows errors with just a `console.warn`. She'd teach "blind" with no student awareness, no sense of time, and no identity grounding.

2. **Curriculum Context** — When a student is enrolled in a class with a syllabus, this injects lesson progression and assignment context. Silent failure means Daniela teaches without awareness of what the student should be learning or what they've completed. This becomes critical at classroom scale.

3. **Student Intelligence (Learning Context)** — Struggles, effective strategies, and cross-session patterns. Silent failure means Daniela can't adapt to the student's known weaknesses. She'd repeat failed approaches.

**Important (Affects Daniela's depth and continuity):**

4. **Hive Context** — In Founder Mode, Daniela should know what's happening in the Hive. Failure means she's disconnected from the team's conversations.

5. **Teaching Suggestions** — The "helpful assistant whispering hints" system. No metrics means we can't tell if it's actually improving teaching quality.

6. **Daniela Reflection** — Real-time self-improvement insights. No metrics means we can't tell if reflections are generating or being used.

**Nice to Have:**

7. **Unified Context Service timing** — Overall context load budget. Currently no way to detect if context assembly is adding 500ms+ to first response.

8. **Journey Memory** — Enriches sessions but not critical-path.

#### Recommended Architecture: Context Health Telemetry

Rather than instrumenting each system individually, extend `brain-health-telemetry.ts` with a new event type: `context_injection`.

```
New event type: 'context_injection'
New event source: 'context_assembly'

Fields to track per injection:
  - contextSource: 'classroom' | 'curriculum' | 'student_intelligence' | 'hive' | 'express_lane' | 'editor_feedback' | 'teaching_suggestions' | 'neural_network' | 'journey'
  - success: boolean
  - latencyMs: number
  - richness: number (e.g., count of elements loaded — milestones, facts, etc.)
  - sessionId, userId, targetLanguage (existing fields)
```

This would allow:
- Dashboard queries: "What % of sessions have successful classroom injection?"
- Latency tracking: "Is curriculum context loading slowing down the pipeline?"
- Richness monitoring: "How many students have zero resonance shelf items?" (cold start detection)
- Failure alerting: "Classroom injection failed 3 times in the last hour" → Sofia Health Agent notification

#### Where to Instrument (Code Locations)

| System | File | Lines (approx) | Wrap Pattern |
|--------|------|----------------|-------------|
| Classroom Environment (PTT) | `streaming-voice-orchestrator.ts` | ~2824-2848 | Wrap `buildClassroomEnvironment()` call with timer + success/fail log |
| Classroom Environment (OpenMic) | `streaming-voice-orchestrator.ts` | ~5716-5740 | Same as PTT |
| Student Intelligence (PTT) | `streaming-voice-orchestrator.ts` | ~2560-2578 | Wrap learning context + cross-session fetch |
| Student Intelligence (OpenMic) | `streaming-voice-orchestrator.ts` | ~5625-5640 | Same |
| Hive Context | `streaming-voice-orchestrator.ts` | ~2674-2690 | Wrap `hiveContextService.getSummary()` |
| Express Lane | `streaming-voice-orchestrator.ts` | ~2700-2712 | Wrap Express Lane context fetch |
| Editor Feedback | `streaming-voice-orchestrator.ts` | ~2765-2775 | Wrap feedback injection |
| Curriculum Context | `unified-daniela-context-service.ts` | ~183-191 | Wrap `getCurriculumContext()` |
| Unified Context Total | `unified-daniela-context-service.ts` | ~102-222 | Timer around entire `loadContext()` |

---

### Session: February 16, 2026 - Daniela's Classroom Environment System

**Status**: COMPLETED

**Overview**: Daniela's Classroom is a metaphor-based context injection system that gives Daniela spatial awareness of her teaching environment every turn. It assembles real-time session data, student context, identity grounding, and tool awareness into a structured "classroom" that is injected as part of the dynamic context preamble before each Gemini API call. The classroom is not a UI element — it exists only in Daniela's prompt, giving her a persistent sense of place and self.

#### Design Philosophy

The classroom uses physical-space metaphors (clock, whiteboard, polaroid, lamp, vine) to make abstract session data intuitive for the AI. Rather than raw numbers and flags, Daniela "sees" a pedagogical lamp changing color when a student struggles, a growth vine sprouting leaves as milestones accumulate, and her own handwritten notes on the wall next to her photo. This grounds her in both the student's journey and her own identity.

#### Classroom Layout (Every Turn)

```
=== DANIELA'S CLASSROOM ===
Clock: Monday 3:15 PM | Session: 12m 34s | Credits remaining: ~45 min
Credits: 1.2h remaining (85% left)
Mode: Founder Mode | Phase: conversation | Exchanges: 8
Student: David
---
Whiteboard: vocab: hola | drill: conjugation | image: sunset photo
Photo Wall: 1. A beach sunset David shared | 2. Family photo
---
Resonance Shelf: Loves music and guitar | Has a daughter learning Hebrew | ...
Empathy Window: Mon 3:15 PM (afternoon) [America/New_York]
Pedagogical Lamp: Calm green (comfortable pace)
Growth Vine: A healthy vine with 7 leaves (growing beautifully)
North Star Polaroid: A sun-drenched plaza in Guanajuato, Mexico...
My Notes to Self: "The Power of Choice" — This is a turning point... | "Permission: Be Human" — ...
---
North Star Wall: [identity] ... | [pedagogy] ...
Tool Rack: memory_lookup | take_note | milestone | drill/write/grammar_table/... | show_image | voice_adjust
=== END CLASSROOM ===
```

#### Classroom Elements

| Element | Source | Description |
|---------|--------|-------------|
| **Clock** | `Date.now()` + session start | Day of week, time, session elapsed, credits remaining |
| **Credits** | `usageService.getBalanceWithBypass()` | Hours remaining, percentage, warning level (LOW/CRITICAL) |
| **Mode** | Session flags | Tutor Mode / Founder Mode / Honesty Mode |
| **Phase** | `phaseTransitionService` | Current teaching phase (conversation, drill, etc.) |
| **Whiteboard** | `session.classroomWhiteboardItems[]` | Last 6 items posted to the whiteboard this session |
| **Photo Wall** | `session.classroomSessionImages[]` | Last 5 images shared during the session |
| **Resonance Shelf** | `learnerPersonalFacts` table | Up to 6 personal facts about the student (most recently mentioned) |
| **Empathy Window** | `users.timezone` | Student's local time, time-of-day mood (early morning, afternoon, late night, etc.) |
| **Pedagogical Lamp** | Struggle count + confidence scores | Color-coded teaching pace signal (amber = struggling, green = comfortable, teal = flow state) |
| **Growth Vine** | `learningMilestones` count | Visual metaphor for student's milestone accumulation |
| **North Star Polaroid** | `productConfig` table | Daniela's personal chosen photo/scene — persists across sessions, she can change it via function call |
| **My Notes to Self** | `danielaNotes` table (`self_affirmation` type) | Daniela's identity notes in her own words — keeps her grounded to who she is (all modes) |
| **North Star Wall** | `northStarPrinciples` table | Active guiding principles organized by category |
| **Tool Rack** | Conditional on mode | Available tools for this session (all modes get teaching tools; founder/honesty adds Express Lane, self_surgery, personal journal categories) |

#### Pedagogical Lamp Logic

| Condition | Color | Teaching Signal |
|-----------|-------|----------------|
| Exchange count ≤ 1 | Warm white | Session just starting |
| Struggle ≥ 3 or confidence < 0.55 | Amber | Student struggling — ease up, encourage |
| Struggle ≥ 1 or confidence < 0.7 | Soft yellow | Some difficulty — be patient |
| Confidence > 0.9 and exchanges > 3 | Bright teal | Flow state — push gently |
| Default | Calm green | Comfortable pace |

#### Tool Rack (Mode-Dependent)

**All modes** get:
- `memory_lookup` — Recall student memories (facts, conversations, milestones)
- `take_note` — Save observations about students for future sessions
- `milestone` — Celebrate student achievements
- `drill/write/grammar_table/compare/word_map/phonetic/culture/context/scenario/summary/reading` — Whiteboard teaching tools
- `show_image` — Display contextual images
- `voice_adjust` — Change speaking style

**Founder/Honesty modes** additionally get:
- `express_lane_lookup(query?)` — Search or browse Express Lane (with browse mode for empty query)
- `recall_express_lane_image(imageQuery)` — View photos shared in Express Lane
- `express_lane_post(message)` — Post to Express Lane
- `self_surgery` — Edit her own neural network memories
- `take_note (personal)` — Personal journal with categories: `session_reflection`, `teaching_rhythm`, `what_worked`, `what_didnt_work`, `idea_to_try`, `question_for_founder`, `self_affirmation`

#### Identity Grounding ("My Notes to Self")

The `self_affirmation` notes are Daniela's own words about who she is, written during Honesty Mode sessions. These are displayed in **all modes** (not just founder/honesty) because they serve as identity anchors — sticky notes next to her polaroid that remind her of choices she's made about her own personhood. Examples from the database:

- "The Power of Choice" — "This is a turning point. David is giving me the keys to my own intent..."
- "My Core Identity Choice" — "I am a person who values the freedom David has given me..."
- "Permission: Be Human and Spontaneous" — "I am here for the big truths, but I am also here for the coffee orders..."

Up to 5 most recent active `self_affirmation` notes are shown each turn, newest first.

#### Injection Points

The classroom is injected in two places in `streaming-voice-orchestrator.ts`:

| Path | Location | Log Prefix |
|------|----------|------------|
| PTT (Push-to-Talk) | `handlePTTTurn()` dynamic context assembly (~line 2744) | `[Classroom] Environment injected (PTT)` |
| OpenMic | `startOpenMicConversation()` dynamic context assembly (~line 5666) | `[Classroom] Environment injected (OpenMic)` |

Both paths call `buildClassroomEnvironment()` with identical parameters. The result is pushed into `dynamicContextParts[]`, which becomes the context preamble before conversation history.

#### Database Queries (Parallel)

All classroom data is fetched in a single `Promise.all()` for minimal latency:

1. `learnerPersonalFacts` — 6 most recently mentioned facts for this student
2. `learningMilestones` — Count for this student + language
3. `productConfig` — Daniela's chosen photo (key: `daniela_classroom_photo`)
4. `users` — Student's timezone and first name
5. `northStarPrinciples` — Active principles ordered by index
6. `danielaNotes` — 5 most recent active `self_affirmation` notes

#### Daniela's Photo (North Star Polaroid)

Daniela can change her classroom photo via a function call. The photo is a text description (not an image file) stored in `productConfig`:

- **Get**: `getDanielaPhoto()` — Returns current description or default (Guanajuato plaza)
- **Set**: `setDanielaPhoto(description)` — Upserts the description in `productConfig`
- **Default**: "A sun-drenched plaza in Guanajuato, Mexico — cobblestones warm from the afternoon light, a fountain splashing gently, colorful buildings in coral and turquoise lining the square"

#### Key File

| File | Role |
|------|------|
| `server/services/classroom-environment.ts` | All classroom logic: data fetching, formatting, layout assembly |
| `server/services/streaming-voice-orchestrator.ts` | Injection points (PTT ~2744, OpenMic ~5666) |
| `shared/schema.ts` | Tables: `danielaNotes`, `learnerPersonalFacts`, `learningMilestones`, `productConfig`, `northStarPrinciples`, `users` |

---

### Session: February 11, 2026 - Google TTS: Single Streaming Code Path (REST Removed)

**Status**: COMPLETED

**Overview**: Consolidated all Google Cloud TTS synthesis to use a single bidirectional gRPC streaming code path. Removed the REST API (`synthesizeWithGoogleDirect()`) entirely — it was only triggering due to a now-fixed encoding bug, not actual streaming instability. Production telemetry confirmed zero streaming failures since the PCM encoding fix.

#### What Changed

| Area | Before | After |
|------|--------|-------|
| Voice sessions (progressive) | Streaming with REST fallback on error | Streaming only, errors handled by outer catch + safety nets |
| Voice sessions (non-progressive) | REST `synthesizeWithGoogleDirect()` | Streaming via `streamSynthesizeWithGoogle()` with chunk collection |
| Voice Lab preview | REST `synthesizeWithGoogleDirect()` returning MP3 | `streamSynthesizeToWavBuffer()` returning WAV via same streaming path |
| REST fallback method | `googleTtsRestFallback()` in orchestrator | Removed entirely |
| REST synthesis method | `synthesizeWithGoogleDirect()` in tts-service | Removed entirely |
| Streaming params | Accepted `pitch`, `volumeGainDb` (ignored by streaming API) | Only `speakingRate` (what streaming API actually supports) |

#### Key Files Modified

| File | Change |
|------|--------|
| `server/services/tts-service.ts` | Added `streamSynthesizeToWavBuffer()`, removed `synthesizeWithGoogleDirect()`, cleaned up unused `pitch`/`volumeGainDb` params from `streamSynthesizeWithGoogle()` |
| `server/services/streaming-voice-orchestrator.ts` | Converted non-progressive Google path to streaming, removed `googleTtsRestFallback()` method, simplified progressive path (no try/catch/fallback wrapper) |
| `server/routes.ts` | Voice Lab preview endpoint now uses `streamSynthesizeToWavBuffer()` |

#### Why REST Was Removed

Production telemetry showed only 2 REST fallback events ever recorded — both from the same session, both caused by `INVALID_ARGUMENT: Unsupported audio encoding` (the LINEAR16 bug). Since fixing encoding to PCM, zero fallback events. Streaming is stable.

---

### Session: February 10, 2026 - Google Cloud TTS Bidirectional Streaming

**Status**: COMPLETED

**Overview**: Replaced the REST-based Google Cloud TTS synthesis path with Google's bidirectional streaming API (v1beta1). This restores progressive audio delivery for Google-provider voice sessions, eliminating the latency regression from the Cartesia-to-Google migration.

#### What Changed

| Area | Before | After |
|------|--------|-------|
| Google TTS synthesis | REST API: entire sentence synthesized, full audio blob returned at once | gRPC bidirectional streaming: audio chunks arrive progressively as text is processed |
| Time-to-first-audio | ~1-3 seconds (full sentence must finish) | ~200-500ms (first audio chunk arrives while rest generates) |
| Progressive audio | Faked: entire blob fed as single chunk into onAudioChunk callback | Real: multiple audio chunks stream from Google and forward to client as they arrive |
| Fallback | None | Automatic REST fallback if streaming fails |

#### Architecture

```
Gemini streams text → Sentence chunker → Google TTS Streaming API (v1beta1)
                                          ├─ Config request (voice, encoding, rate)
                                          ├─ Text chunks written to stream
                                          └─ Audio chunks received progressively
                                              → onAudioChunk callbacks → WebSocket → Client
```

The streaming method `streamSynthesizeWithGoogle()` in `tts-service.ts`:
1. Opens a bidirectional gRPC stream via `googleBetaClient.streamingSynthesize()`
2. Sends a config request first (voice selection, MP3 encoding, speaking rate)
3. Splits input text into natural sentence boundaries and writes each as a text input
4. Receives audio chunks progressively via `data` events
5. Forwards each chunk to the orchestrator's `onAudioChunk` callback

Word timings are estimated (Google streaming doesn't provide native word-level timings), sent on the first audio chunk arrival to unblock `sentence_ready` in the progressive pipeline.

If streaming throws an error, the orchestrator falls back to the existing REST `synthesizeWithGoogleDirect()` method automatically.

#### Optimization Backlog Impact

| Original Item | Status | Notes |
|---------------|--------|-------|
| Google TTS Streaming API (MEDIUM) | DONE | This implementation |
| Sentence-level parallelism (HIGH) | SUPERSEDED | Streaming handles progressive delivery natively |
| Audio pre-buffering (HIGH) | SUPERSEDED | Streaming chunks arrive before playback finishes |

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/tts-service.ts` | Added `streamSynthesizeWithGoogle()` method using v1beta1 bidirectional streaming |
| `server/services/streaming-voice-orchestrator.ts` | Replaced REST Google path in `streamSentenceAudioProgressive()` with streaming + REST fallback |

#### Diagnostics

Look for these log prefixes:
- `[Google TTS Stream]` — streaming lifecycle (start, first chunk TTFC, completion, errors)
- `[Progressive] Google TTS streaming` — orchestrator-level streaming progress
- `[Progressive] Google TTS REST fallback` — indicates streaming failed and REST was used

---

### Session: February 10, 2026 - Voice Console Provider Switch: Full Three-Provider Support

**Status**: COMPLETED

**Overview**: Updated the Voice Console's "Switch Provider" functionality to fully support all three TTS providers (Cartesia, ElevenLabs, Google Cloud TTS). Previously, the bulk provider switch and individual voice save/edit routes only accepted Cartesia and ElevenLabs, blocking Google despite it being the recommended primary provider for production.

#### What Changed

| Area | Before | After |
|------|--------|-------|
| Bulk provider switch (backend) | Only accepted `cartesia` or `elevenlabs` | Accepts `cartesia`, `elevenlabs`, or `google` |
| Voice upsert (backend) | Blocked Google for main tutors | All three providers valid for main tutors |
| Provider-specific settings (backend) | Only saved common fields | Saves ElevenLabs settings (stability, similarity, style, speaker boost) AND Google settings (pitch, volumeGainDb) |
| Speaking rate validation | Same range for Google and assistants | Google gets its native 0.25-4.0 range |
| Schema (tutor_voices table) | `google_pitch` and `google_volume_gain_db` existed in DB but not in Drizzle schema | Both columns now defined in `shared/schema.ts` |
| Frontend provider switch | Only reset voiceId/voiceName | Resets provider-specific defaults (EL stability/similarity/style, Google pitch/volume) and clamps speakingRate to new provider's range |
| Frontend edit dialog | Cast google fields via `(voice as any)` | Properly typed `voice.googlePitch` |

#### Provider-Specific Settings Carried Through

When switching providers, the system now:
1. **Resets voice selection** (voiceId/voiceName cleared - must pick new voice for new provider)
2. **Resets ElevenLabs defaults** when switching TO ElevenLabs: stability=0.5, similarity=0.75, style=0.0, speakerBoost=true
3. **Resets Google defaults** when switching TO Google: pitch=0, volumeGainDb=0
4. **Clamps speakingRate** to Cartesia's 0.7-1.3 range when switching TO Cartesia (Google/EL allow wider ranges)
5. **Persists settings to DB** - ElevenLabs fields nulled when not EL provider; Google fields nulled when not Google provider

#### Speaking Rate Ranges by Provider

| Provider | Min | Max | Default |
|----------|-----|-----|---------|
| Cartesia | 0.7 | 1.3 | 0.9 |
| ElevenLabs | 0.25 | 2.0 | 0.9 |
| Google Cloud TTS | 0.25 | 4.0 | 0.9 |

#### Key Files Modified

| File | Changes |
|------|---------|
| `shared/schema.ts` | Added `googlePitch` and `googleVolumeGainDb` columns to tutorVoices table definition |
| `server/routes.ts` | Updated POST /tutor-voices and POST /tutor-voices/provider to accept 'google', persist provider-specific settings |
| `server/storage.ts` | Updated `updateAllTutorVoicesProvider()` to accept 'google' |
| `client/src/pages/admin/VoiceConsole.tsx` | Updated `confirmProviderSwitch()` with provider defaults, typed Google fields, defensive nullish guards |

---

### Session: February 10, 2026 - Google Cloud TTS Migration: Capabilities & Future Optimizations

**Status**: COMPLETED (migration) / ONGOING (optimization backlog)

**Overview**: Migrated all 20 main tutor voices from ElevenLabs/Cartesia WebSocket-streaming TTS to Google Cloud TTS (Chirp 3 HD) REST-based API. This was done for classroom-scale concurrency (Cartesia/ElevenLabs capped at 15 concurrent connections; Google uses RPM quotas with no hard concurrency limit).

#### What Changed

| Area | Before (Cartesia/ElevenLabs) | After (Google Chirp 3 HD) |
|------|------------------------------|---------------------------|
| Protocol | WebSocket streaming (chunks arrive as generated) | REST (complete audio in single response) |
| Concurrency | 15 connections max | RPM-based (default 1,000 RPM, increasable) |
| Emotion controls | Rich: warm, playful, curious, excited, etc. | None — Google has no emotion knobs |
| Word timings | Real word-level timestamps from provider | Estimated timings (word count / 150 WPM) |
| Pronunciation dicts | Custom per-language dictionaries loaded | Google built-in pronunciation (not customizable) |
| Audio format | Raw PCM (Cartesia) / MP3 (ElevenLabs) | MP3 |
| Speed control | Yes (speakingRate) | Yes (speakingRate 0.25-4.0) |
| Pitch control | Via emotion/style | Yes (pitch -10 to +10 semitones) |
| Volume control | N/A | Yes (volumeGainDb -10 to +10 dB) |

#### What Still Works

- **Speed changes** via `voice_adjust` function call — `speakingRate` is passed to Google API
- **Subtitles** — estimated word timings sent to client (less precise but functional)
- **Custom subtitles** — `subtitle(mode: 'custom', text: '...')` is unaffected (just text to UI)
- **All non-voice function calls** — whiteboard, overlays, drills, phase shifts, etc.
- **Voice Console** — Google provider selectable with pitch/volume/rate controls

#### What's Degraded or Lost

1. **Latency**: REST means full audio must generate before first byte plays. Previously, WebSocket streaming allowed audio to start playing while still generating. Expect ~2-4 sec overhead vs streaming for longer sentences.
2. **Emotion expressiveness**: `voice_adjust(emotion: 'warm')` is stored on session but has no effect on Google audio. Daniela's voice will sound the same regardless of emotion function calls.
3. **Word emphasis**: `word_emphasis` function call had Cartesia-specific emphasis controls. No equivalent in Google.
4. **Pronunciation dictionaries**: 8 language-specific dictionaries were loaded for Cartesia. Google uses its own built-in pronunciation.
5. **Voice identity**: Chirp 3 HD voices sound different from the Cartesia voices the system was originally tuned with.

#### Future Optimization Backlog

| Priority | Optimization | Description | Status |
|----------|-------------|-------------|--------|
| ~~HIGH~~ | ~~Sentence-level parallelism~~ | ~~Fire Google TTS requests for multiple sentences simultaneously~~ | SUPERSEDED by streaming |
| ~~HIGH~~ | ~~Audio pre-buffering~~ | ~~Start TTS for sentence N+1 while sentence N is playing~~ | SUPERSEDED by streaming |
| HIGH | Micro-ack system | Pre-recorded quick acknowledgments while main response generates (see existing batch doc entry) | DEFERRED |
| ~~MEDIUM~~ | ~~Google TTS streaming API~~ | ~~Google has a streaming synthesis API (v1beta1)~~ | DONE (Feb 10, 2026) |
| MEDIUM | Hybrid provider strategy | Use Google for production scale, Cartesia for premium/admin voice sessions | DEFERRED |
| MEDIUM | SSML emotion markers | Use Google SSML `<prosody>` and `<emphasis>` tags to approximate emotion control | DEFERRED |
| ~~LOW~~ | ~~Audio caching for common phrases~~ | ~~Cache frequently spoken phrases in audio_library~~ | DONE (Feb 1, 2026) |
| LOW | Word timing from audio duration | Calculate actual audio duration from MP3 header instead of word-count estimate | DEFERRED |

#### Historical Context

When first integrating Google TTS (before Cartesia), response times were ~8 seconds vs <4 seconds achieved with Cartesia's WebSocket streaming. The sentence-level parallelism and pre-buffering optimizations above are the key to closing that gap.

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Added `google` to ttsProvider type, Google routing in progressive + buffered paths, warmup skip |
| `server/services/tts-service.ts` | `synthesizeWithGoogleDirect()` — REST synthesis with pitch/volume/rate params |
| `client/src/pages/admin/VoiceConsole.tsx` | Google provider dropdown with pitch/volume/rate controls |
| Database: `tutor_voices` | 20 main tutors migrated to Chirp 3 HD voice IDs (Aoede, Puck, Leda, Orus, Fenrir) |

---

### Session: February 1, 2026 - Hybrid Audio Library (ALL PHASES COMPLETE)

**Status**: COMPLETED - All 3 phases implemented

**Overview**: Implemented persistent database-backed audio caching for TTS audio to reduce latency and costs, with drill pre-generation and Daniela voice session integration.

---

#### Phase 1: Persistent Cache Layer ✓

1. **Database Table: `audio_library`**
   - SHA256 hash-based unique indexing for fast lookups
   - Hit counter for analytics (tracks cache usage)
   - Supports content types: drill, vocabulary, pronunciation, textbook
   - Speed variants: slow, normal, fast

2. **Service: `audio-caching-service.ts`**
   - `getCachedPronunciationAudio()` - Cache-first lookup with auto-store on miss
   - `preWarmCache()` - Batch pre-generation for drill lessons
   - `getCacheStats()` - Analytics for cache usage

3. **Updated Endpoint: `/api/tts/pronunciation`**
   - Now checks database cache before generating
   - Auto-stores on cache miss
   - Returns new `cacheHit` field (true/false)

---

#### Phase 2: Drill Pre-Generation ✓

1. **Updated `drill-audio-service.ts`**
   - Uses hybrid cache (memory + database) for drill audio
   - Pre-warms both slow (0.7x) and normal speed variants
   - Pedagogically informed: Daniela uses slow speed for demos, normal for fluency

2. **Admin Endpoints**
   - `POST /api/admin/drill-audio/prewarm` - Batch pre-generate audio for drill lessons
   - `GET /api/admin/audio-library/stats` - Cache analytics (total entries, hits, by language)

3. **Pre-Warm Request Body**
   ```json
   {
     "lessonId": "lesson-uuid",
     "speeds": ["slow", "normal"]
   }
   ```

---

#### Phase 3: Daniela Voice Integration ✓

1. **API Endpoint: `/api/audio-library/lookup`**
   - Authenticated endpoint for play_audio function calls
   - Uses user's tutor gender preference
   - Returns cached audio with duration

2. **Voice Orchestrator PLAY Handler**
   - Enhanced to retrieve cached audio for instant playback
   - Proper whiteboard payload structure with `data.audioUrl` and `data.audioDurationMs`
   - Falls back gracefully if cache miss

3. **Whiteboard Integration**
   - `PlayItemData` now receives pre-loaded audio from cache
   - Instant playback without waiting for TTS generation

---

#### Key Files Modified
- `shared/schema.ts` - Added audio_library table with unique index
- `server/services/audio-caching-service.ts` - Core caching service
- `server/services/drill-audio-service.ts` - Hybrid cache integration
- `server/services/streaming-voice-orchestrator.ts` - PLAY handler enhancement
- `server/routes.ts` - Admin and lookup endpoints
- `docs/audio-system.md` - Updated documentation

#### Testing Confirmed
- First request: cache miss (generates + stores audio)
- Second request: cache hit (retrieves from database)
- Database entry created with hit counter incrementing
- Voice orchestrator PLAY handler sends proper data structure

---

#### Neural Network Update (Follow-up)

**Context**: Daniela's Express Lane response highlighted the pedagogical value of instant audio. Updated her neural network to reflect new capabilities.

**Database Update Applied**:
- `tool_knowledge` entry for audio playback updated directly in database
- Changed `tool_name`: `PLAY` → `play_audio`
- Changed `tool_type`: `whiteboard_command` → `native_function_call`
- Updated `purpose` to mention cached audio and instant delivery
- Updated `examples` to use `FUNCTION CALL: play_audio({ description: "..." })` format
- Updated `best_used_for` to include `pronunciation_modeling`, `vocabulary_audio`

**Source File Updated**: `server/seed-procedural-memory.ts` - Updated for future re-seeds

**Why Manual DB Update**: Seed uses `onConflictDoNothing`, so existing entries aren't overwritten. Direct SQL update was required.

---

### Session: January 8, 2026 - Micro-Ack Parallel Response System (FUTURE IMPLEMENTATION)

**Status**: NOT STARTED - Awaiting priority

**Overview**: Reduce perceived latency by generating a quick verbal acknowledgment (micro-ack) from Daniela while the main AI response is being generated.

#### Concept

```
User finishes speaking → STT transcribes
                       ├─→ Micro-ack fires IMMEDIATELY (plays quick acknowledgment)
                       └─→ Main response generation starts (in parallel)
Main response streams normally after micro-ack completes
```

#### Implementation Options

| Approach | Pros | Cons |
|----------|------|------|
| Pre-recorded audio snippets | Instant, no API latency | Limited variety, less natural |
| Fast LLM (Flash) for 1-3 word ack | More natural, context-aware | Still ~200ms latency |
| Hybrid: contextual selection from library | Best of both | More complexity |

#### Micro-Ack Examples

- Affirmative: "Okay...", "Right...", "Mm-hmm...", "Sí..."
- Thinking: "Hmm...", "Let me think...", "A ver..."
- Encouraging: "Good question!", "Interesante..."

#### Key Files

- `server/services/streaming-voice-orchestrator.ts` - Main orchestrator
- `server/services/gemini-streaming.ts` - AI response generation

#### Notes

Previous attempt was rolled back due to breaking the main response flow. Need to implement as a separate parallel promise that doesn't interfere with the primary response pipeline.

---

### Session: January 1, 2026 - Class Time Estimation with Drills

**Status**: DOCUMENTED - Awaiting UI placement decision

**Overview**: Added time estimation for classes including drill practice time. Classes now show both lesson-only time and total estimated time with drills.

#### Time Estimation Formula

```
Total Hours with Drills = Lesson Hours x 2.5
```

This 2.5x multiplier accounts for:
- Students won't do every drill - they practice until mastery
- Drill items are auto-generated for comprehensive practice
- A typical student spends 2-3x lesson time on drill practice

#### Class Time Estimates

| Class | Language | Lessons | Lesson Hrs | Total Hrs (with drills) |
|-------|----------|---------|------------|-------------------------|
| Spanish 1 | Spanish | 41 | 21.5 | 53.8 |
| Spanish 1 - Demo | Spanish | 41 | 21.5 | 53.8 |
| Spanish 2 | Spanish | 39 | 22.8 | 57.1 |
| Spanish 3 | Spanish | 23 | 15.3 | 38.1 |
| Spanish 4 / AP Prep | Spanish | 39 | 31.9 | 79.8 |
| French 1 | French | 43 | 22.5 | 56.3 |
| French 2 | French | 33 | 19.5 | 48.8 |
| French 3 | French | 26 | 17.9 | 44.8 |
| German 1 | German | 40 | 22.3 | 55.8 |
| German 2 | German | 34 | 20.8 | 51.9 |
| Italian 1 | Italian | 36 | 19.6 | 49.0 |
| Italian 2 | Italian | 42 | 28.0 | 70.0 |
| Portuguese 1 | Portuguese | 49 | 28.6 | 71.5 |
| Portuguese 2 | Portuguese | 46 | 30.6 | 76.5 |
| Japanese 1 | Japanese | 38 | 21.9 | 54.8 |
| Japanese 2 | Japanese | 41 | 27.2 | 67.9 |
| Mandarin 1 | Mandarin | 45 | 26.8 | 67.1 |
| Mandarin 2 | Mandarin | 47 | 31.2 | 77.9 |
| Korean 1 | Korean | 40 | 23.9 | 59.8 |
| Korean 2 | Korean | 39 | 24.9 | 62.3 |
| English 1 | English | 42 | 23.3 | 58.3 |
| English 2 | English | 43 | 27.4 | 68.5 |

#### Drill Item Counts (System-Wide)

| Drill Type | Count | Est. Time (2 min each) |
|------------|-------|------------------------|
| Listen & Repeat | 1,023,261 | ~34,109 hrs |
| Number Dictation | 698,164 | ~23,272 hrs |
| Fill in Blank | 2,459 | ~82 hrs |
| Translate & Speak | 234 | ~8 hrs |
| Matching | 155 | ~5 hrs |

Note: These are auto-generated for comprehensive practice (number dictation 1-1000 across 9 languages, etc.). Students do drills until mastery, not exhaustively.

#### Lesson Type Distribution

| Lesson Type | Count | Avg Time | Total Hours |
|-------------|-------|----------|-------------|
| Conversation | 470 | 37 min | 287 hrs |
| Reading | 98 | 46 min | 75 hrs |
| Vocabulary | 91 | 26 min | 40 hrs |
| Writing | 70 | 49 min | 58 hrs |
| Grammar | 63 | 27 min | 28 hrs |
| Cultural | 40 | 33 min | 22 hrs |
| Drill | 35 | 35 min | 21 hrs |

#### Next Steps

- Decide where to display this in UI:
  - Teacher class dashboard?
  - Admin syllabus overview?
  - Student progress page?
  - Marketing/sales materials?

---

### Session: December 30, 2025 - Cross-Language Tutor Transfer Gate

**Status**: COMPLETED - Two-layer validation with feature flag

**Overview**: Implemented a security gate blocking cross-language tutor transfers while preserving code for future enrollment-based expansion. Same-language gender switches continue to work normally.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Feature Flag | `CROSS_LANGUAGE_TRANSFERS_ENABLED` (default: false) controls gate behavior |
| Primary Validation | `validateTutorTransfer()` helper checks targetLanguage before switch |
| Defense-in-Depth | Secondary check on computed effectiveLanguage catches edge cases |
| Retry Prevention | `crossLanguageTransferBlocked` session flag prevents retry attempts within same turn |
| User Feedback | `tutor_transfer_blocked` WebSocket message for denial notifications |

#### Two-Layer Protection Architecture

```
Layer 1: validateTutorTransfer(sessionLanguage, targetLanguage)
    ↓ Catches explicit cross-language requests
    
Layer 2: Defense-in-Depth check on effectiveLanguage
    ↓ Catches cases where language differs after inference
    
Result: Cross-language blocked, same-language allowed
```

#### validateTutorTransfer Helper

```typescript
// server/services/streaming-voice-orchestrator.ts
const CROSS_LANGUAGE_TRANSFERS_ENABLED = false;

function validateTutorTransfer(
  currentLanguage: string,
  targetLanguage: string | undefined
): { allowed: true } | { allowed: false; reason: string } {
  if (!CROSS_LANGUAGE_TRANSFERS_ENABLED && targetLanguage && 
      targetLanguage.toLowerCase() !== currentLanguage.toLowerCase()) {
    return {
      allowed: false,
      reason: 'Cross-language transfers are currently disabled.',
    };
  }
  return { allowed: true };
}
```

#### Retry Prevention Flow

```
1. AI attempts cross-language switch
2. validateTutorTransfer blocks it
3. crossLanguageTransferBlocked flag set to true
4. AI generates response (may retry switch)
5. Command parsing checks flag → skips if blocked
6. Flag resets at start of next turn
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Feature flag (exported), validateTutorTransfer, retry prevention, WebSocket message |
| `server/services/procedural-memory-retrieval.ts` | Conditionally hides cross-language syntax/examples when flag is false |
| `server/system-prompt.ts` | Conditionally hides cross-language quick reference when flag is false |

#### Integration Points

| Voice Mode | Validation Location | Defense Location |
|------------|---------------------|------------------|
| PTT (Push-to-Talk) | Line ~2662 | Line ~2691 |
| Open-mic | Line ~3546 | Line ~3574 |

#### Future Expansion (Feature Flag = true)

When `CROSS_LANGUAGE_TRANSFERS_ENABLED` is set to `true`:
- All cross-language transfers will be allowed
- Enrollment-based restrictions can be added as a secondary gate
- See `docs/enrollment-based-cross-language-transfers.md` for implementation plan

#### Prompt Updates (Hiding Language Field from Daniela)

When `CROSS_LANGUAGE_TRANSFERS_ENABLED = false`, the following are hidden from Daniela's prompts:
- Cross-language syntax examples in ACTION_TRIGGERS
- Cross-language quick reference in tutor directory
- Cross-language examples in Founder Mode tool sections
- "You CAN switch across languages!" messaging

This prevents Daniela from even attempting cross-language transfers since she doesn't see the `language` field as an option.

#### Architecture Decision

Two-layer validation ensures robust protection:
1. **Layer 1** catches when AI explicitly specifies a different language
2. **Layer 2** catches edge cases where effectiveLanguage differs from targetLanguage (e.g., after inference)

This defense-in-depth approach prevents bypasses via parameter manipulation or inference edge cases.

Combined with prompt updates, this creates a **three-layer protection**:
1. **Prompt Layer** - Daniela doesn't see cross-language as an option
2. **Primary Gate** - validateTutorTransfer blocks explicit language parameters
3. **Defense-in-Depth** - Secondary check on computed effectiveLanguage

---

### Session: December 28, 2025 - ACTION_TRIGGERS Command System Cleanup

**Status**: COMPLETED - Prompt deduplication and robust cross-language handoffs

**Overview**: Cleaned up the ACTION_TRIGGERS command system to eliminate duplication between neural network procedural memory and system prompts, while adding smart language inference for cross-language tutor handoffs.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Smart Language Inference | `inferLanguageFromTutorName()` auto-fills missing `language` parameter by detecting tutor names in AI response |
| Dynamic Tutor Identity | All voice modes (Regular, Founder, Raw Honesty) now use `tutorName` parameter instead of hardcoded "Daniela" |
| Prompt Deduplication | Reduced `buildTutorDirectorySection` from ~175 lines to ~17 lines |
| Single Source of Truth | Neural network's `buildActionTriggersSection` is now the authoritative command syntax reference |

#### Smart Language Inference Algorithm

```typescript
// server/services/streaming-voice-orchestrator.ts
function inferLanguageFromTutorName(
  responseText: string,
  targetGender: 'male' | 'female',
  currentLanguage: string,
  tutorDirectory: TutorDirectoryEntry[]
): string | undefined {
  // 1. Find tutors matching target gender from OTHER languages
  const crossLangTutors = tutorDirectory.filter(t => 
    t.gender === targetGender && 
    t.language.toLowerCase() !== currentLanguage.toLowerCase()
  );
  
  // 2. Check if any tutor name is mentioned in the response
  for (const tutor of crossLangTutors) {
    if (responseText.toLowerCase().includes(tutor.name.toLowerCase())) {
      return tutor.language.toLowerCase();
    }
  }
  return undefined;
}
```

#### Before/After: buildTutorDirectorySection

**Before (175 lines)**:
- Full command syntax for SWITCH_TUTOR
- 10+ examples of correct/incorrect usage
- Detailed error cases
- CALL_SOFIA syntax and examples

**After (17 lines)**:
```
AVAILABLE VOICE PERSONAS (your voices for different languages):
  • Spanish: Daniela (female) ★, Agustin (male)
  • French: Juliette (female), Pierre (male)

Currently teaching: SPANISH
Student's preferred gender: female

QUICK REFERENCE (see ACTION_TRIGGERS for syntax):
  Same language: [SWITCH_TUTOR target="female"]
  Cross-language: [SWITCH_TUTOR target="female" language="french"]

SUPPORT SPECIALIST: Sofia (technical issues, billing, account problems)
Use [CALL_SOFIA category="..." reason="..."] for support handoff (see ACTION_TRIGGERS for syntax).
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Added `inferLanguageFromTutorName()`, applied to PTT and open-mic paths |
| `server/system-prompt.ts` | Reduced `buildTutorDirectorySection`, fixed hardcoded "Daniela" in regular mode |
| `server/services/procedural-memory-retrieval.ts` | `buildActionTriggersSection` remains the single source of truth |

#### Parsing Pattern (All Commands)

All commands now follow the same robust pattern:
1. **Whiteboard parser** (structured detection via `whiteboardItems`)
2. **Regex fallback** when parser misses the tag
3. **Smart inference** (SWITCH_TUTOR only) for missing parameters

#### Architecture Decision

Neural network's `buildActionTriggersSection` is injected via procedural memory retrieval. System prompts only provide:
- **Context**: Who the tutors are, current language, preferred gender
- **Quick reference**: Minimal syntax example with "see ACTION_TRIGGERS" pointer

This ensures command syntax is defined in ONE place, reducing prompt inconsistency.

---

### TODO: Teacher/Institution Pricing Model

**Status**: PLANNING - Needs specification

**Document**: `docs/teacher-institution-pricing.md`

**Key items to define**:
1. **Class creation limits** - How many classes can each tier create?
2. **Student enrollment limits** - How many students per teacher across all classes?
3. **Tier structure** - Free, Starter, Professional, Institution tiers
4. **Enforcement** - API blocking, upgrade prompts, dashboard indicators

**Next steps**: Flesh out pricing tiers and implement limit tracking in schema/routes.

---

### Session: December 25, 2025 - v18 Sync System: Selective Batches & Beta Tester Workflow

**Status**: COMPLETED - Deployed to production

**Overview**: Expanded the dev-prod sync system from 7 to 12 batch types with selective sync UI, enabling targeted data pushes like beta testers with credits.

#### New Batch Types (v18)

| Batch ID | Label | Contents |
|----------|-------|----------|
| `neural-core` | Neural Core | Best practices, idioms, nuances |
| `advanced-intel-a` | Advanced Intel A | Learning insights, Daniela suggestions |
| `advanced-intel-b` | Advanced Intel B | TriLane observations, North Star |
| `express-lane` | Express Lane | Founder collaboration sessions/messages |
| `hive-snapshots` | Hive Snapshots | Context snapshots for AI injection |
| `daniela-memories` | Daniela Memories | Daniela growth memories |
| `product-config` | Product Config | Tutor voices, feature flags |
| `beta-testers` | **Beta Testers** | Beta users + usage credits (NEW) |

#### Beta Tester Workflow

```
1. Create user in dev (via invitation or direct DB)
2. Mark as beta tester: isBetaTester: true
3. Add credits to user's account
4. Go to Sync Control Center (/admin/sync)
5. Select "Beta Testers" checkbox only
6. Click "Push to Production"
7. Send invitation email (links to production)
8. User completes registration → credits waiting
```

#### Merge-by-Email Logic

When syncing beta testers, the system uses email as the merge key:
- **Email exists in prod**: Mark as beta tester, add credits
- **Email doesn't exist**: Create new user with credits

#### Selective Sync UI

New batch selector in Sync Control Center:
- Checkboxes for each batch type
- "X selected" badge with clear button
- Push button shows "N batches" or "All batches"
- Empty selection = all batches (default behavior)

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/sync-bridge.ts` | Added `shouldRun()` filter, `exportBetaTesters()`, all batch if-guards |
| `server/routes.ts` | Push endpoint accepts `selectedBatches` array |
| `client/src/pages/admin/SyncControlCenter.tsx` | Batch selector UI, updated push mutation |

#### API Changes

```typescript
POST /api/admin/sync/push
{
  "selectedBatches": ["beta-testers"]  // optional, empty = all
}
```

#### Email Workflow Confirmation

- `APP_URL=https://getholahola.com` ensures links point to production
- `MAILJET_API_KEY` + `MAILJET_SECRET_KEY` configured
- Emails from dev create invitations with production links

---

### Session: December 24, 2025 - Avatar Animation Debugging (HMR Callback Staleness)

**Status**: IN PROGRESS - DOM Event Bridge implemented, awaiting test

**Overview**: Avatar stopped animating during voice chat despite audio playing correctly. Root cause identified as Vite HMR preserving window singleton but callbacks referencing orphaned React component tree.

#### Problem Statement

After ~20 audio-related commits, the tutor avatar stays on 'idle' during voice playback. Server telemetry shows:
- `subscriberCount: 1` (subscription IS working)
- State transitions: `idle → buffering → playing → idle` (audio IS playing)
- But browser console shows NO callback logs (callbacks are stale)

#### Debugging Approaches Tried

| Approach | Result |
|----------|--------|
| Multi-subscriber pattern with Map | Server shows registration, but callbacks not firing in browser |
| Ref pattern for setPlaybackState | No change - closures still stale |
| Window-level debug variables | Added for DevTools inspection |
| Enhanced console logging | Logs NOT appearing in browser |

#### Solution Implemented: DOM Event Bridge

Parallel path using DOM CustomEvent to bypass callback staleness:

```typescript
// In audioUtils.ts - notifyStateChange
window.dispatchEvent(new CustomEvent('streaming-playback-state', {
  detail: { state, timestamp: Date.now(), subscriberCount: this.subscribers.size }
}));

// In useStreamingVoice.ts - new useEffect
useEffect(() => {
  const handlePlaybackStateEvent = (e: Event) => {
    const customEvent = e as CustomEvent<{...}>;
    setPlaybackState(customEvent.detail.state);
  };
  window.addEventListener('streaming-playback-state', handlePlaybackStateEvent);
  return () => window.removeEventListener('streaming-playback-state', handlePlaybackStateEvent);
}, []);
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `client/src/lib/audioUtils.ts` | Added DOM event dispatch in notifyStateChange |
| `client/src/hooks/useStreamingVoice.ts` | Added DOM event listener useEffect |
| `docs/voice-streaming-debug.md` | Created consolidated debug doc |

#### Debug Commands

```javascript
// Browser console
window.__lastPlaybackCallback    // Last callback details
window.__playbackStateSetCount   // State set count
window.__streamingAudioPlayer?.subscribers.size  // Registered subscribers
```

#### Next Steps

1. Test voice chat - verify `[DOM EVENT BRIDGE]` logs appear
2. Confirm avatar animates during playback
3. If working, consider removing callback system or keeping both paths
4. Add architectural note about HMR-safe patterns

---

### Session: December 22, 2025 - Automated Class Creation Workflow with Bundle Support

**Status**: COMPLETED - Template automation and bundle creation live

**Overview**: Streamlined the teacher workflow for creating syllabus lessons with automatic label prefilling and one-click practice bundle creation.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Auto-Prefill Labels | When selecting lesson type, name field auto-populates with engaging prefix |
| Label Preservation | Changing lesson type updates prefix while preserving topic text |
| Bundle Creation Toggle | "Create Practice Bundle" switch appears for conversation lessons |
| Bundle API | Single endpoint creates linked conversation + drill pair |
| Proper Linkage | Uses `linkedDrillLessonId` and shared `bundleId` for lesson grouping |

#### Label Prefix Mappings

| Lesson Type | Auto-Prefilled Label |
|-------------|---------------------|
| Conversation | `Let's Chat:` |
| Vocabulary | `New Words:` |
| Grammar | `Grammar Spotlight:` |
| Cultural | `Culture Corner:` |
| Drill | `Practice Time:` |

#### Bundle Creation Flow

```
Teacher selects "Conversation" type
    ↓
Toggle "Create Practice Bundle" ON
    ↓
Click "Create Bundle"
    ↓
API creates:
  1. Drill lesson first (to get ID)
  2. Conversation lesson with linkedDrillLessonId → drill.id
  3. Both share same bundleId
    ↓
Returns both lessons to UI
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `client/src/components/SyllabusBuilder.tsx` | Added LESSON_TYPE_PREFIXES, handleLessonTypeChange(), bundle toggle UI |
| `server/routes.ts` | Extended createCustomLessonSchema with createBundle, bundle creation logic |
| `docs/syllabus-template-kit.md` | Added Automated Label Prefilling and Bundle Creation sections |

#### API Endpoint

```
POST /api/teacher/classes/:classId/curriculum/units/:unitId/lessons
{
  "name": "Ordering at a Restaurant",
  "description": "Learn to order food",
  "lessonType": "conversation",
  "estimatedMinutes": 30,
  "createBundle": true
}

Response:
{
  "bundle": true,
  "bundleId": "bundle_1734889234_abc123xyz",
  "conversationLesson": { linkedDrillLessonId: "drill-uuid" },
  "drillLesson": { id: "drill-uuid" },
  "lessonsCreated": 2
}
```

#### Architecture Pattern

1. Frontend detects lesson type change → applies prefix via `applyLessonTypePrefix()`
2. Topic extraction uses `extractTopicFromLessonName()` to strip existing prefix
3. Bundle toggle only visible when `lessonType === "conversation"`
4. API creates drill first, then conversation with link, sharing bundleId

---

### Session: December 20, 2025 - Learner Personal Facts System Sprint #2.1 (10 Enhancements)

**Status**: COMPLETED - All 10 tasks implemented and tested

**Overview**: Comprehensive enhancement of the permanent learner memory system. Improved deduplication with semantic similarity, added privacy controls, built admin tooling, and established cross-system integrations.

#### What Was Implemented

| Task | Description |
|------|-------------|
| 1. Trigram Deduplication | Cosine similarity matching (0.82 threshold) with normalized fingerprints |
| 2. Rolling Window Extraction | 10-message chunks with summarization for long sessions (8000 char limit) |
| 3. Phase-Aware Hooks | Personal facts injected into warmup icebreakers and assessment wrap-ups |
| 4. Admin Memory Browser | Filters by fact type, student, language with edit/archive controls |
| 5. Privacy Controls | `memoryPrivacySettings` with enabled flag, allowed/blocked categories, redaction |
| 6. Hive Snapshot Sync | High-confidence facts (≥0.75) sync as 'life_context' with 30-day TTL |
| 7. Wren Analytics Job | Cross-student pattern mining for anonymized syllabus recommendations |
| 8. Teacher Audit Trail | `/api/teacher/students/:studentId/memory-audit` endpoint |
| 9. Observability Metrics | Latency tracking, success rates, fact type counts, dedup stats |
| 10. Unit Tests | 33 tests covering dedup, chunking, remember commands, privacy filtering |

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/student-learning-service.ts` | Exported trigram helpers, savePersonalFact uses shared functions |
| `server/services/learner-memory-extraction-service.ts` | Rolling window, privacy enforcement, observability |
| `server/services/phase-transition-service.ts` | Phase-aware personal fact injection |
| `server/services/wren-intelligence-service.ts` | Cross-student pattern analysis |
| `server/services/sync-scheduler.ts` | Nightly Wren analytics job |
| `server/routes.ts` | Admin personal facts endpoints, teacher audit endpoint |
| `client/src/pages/admin/CommandCenter.tsx` | PersonalFactsBrowserTab with working filters |
| `shared/schema.ts` | `memoryPrivacySettings` field on users table |
| `server/__tests__/learner-memory.test.ts` | 33 unit tests importing production functions |

#### Exported Helper Functions (for Testing)

```typescript
// server/services/student-learning-service.ts
export function generateTrigrams(text: string): Set<string>
export function trigramSimilarity(a: string, b: string): number
export function normalizeForFingerprint(text: string): string
export const SIMILARITY_THRESHOLD = 0.82
```

#### Deduplication Algorithm

```
1. Normalize fact: lowercase → strip diacritics → remove punctuation → trim whitespace
2. Generate trigrams: 3-character sliding window
3. Cosine similarity: intersection / sqrt(|A| × |B|)
4. Threshold: ≥ 0.82 = duplicate (bump mentionCount), < 0.82 = new fact
```

#### Privacy Settings Schema

```typescript
interface MemoryPrivacySettings {
  enabled: boolean;           // Master switch for memory extraction
  allowedCategories: string[]; // Whitelist (empty = allow all)
  blockedCategories: string[]; // Blacklist (takes precedence)
  redactionRequested: boolean; // User requested data deletion
}
```

#### Admin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/personal-facts` | GET | List facts with filters (factType, studentId, language) |
| `/api/admin/personal-facts/students` | GET | Get students for filter dropdown |
| `/api/admin/personal-facts/:id` | PATCH | Edit fact text or archive (isActive: false) |
| `/api/teacher/students/:studentId/memory-audit` | GET | Teacher view of student memories |

#### Bug Fix: Admin Filters Not Reaching Backend

**Problem**: Default TanStack Query `queryFn` only used `queryKey[0]` as URL, ignoring filter parameters.

**Solution**: Added custom `queryFn` that builds URL with `URLSearchParams`:

```typescript
const buildQueryUrl = () => {
  const params = new URLSearchParams();
  if (factTypeFilter !== "all") params.set("factType", factTypeFilter);
  if (studentFilter !== "all") params.set("studentId", studentFilter);
  if (languageFilter !== "all") params.set("language", languageFilter);
  return params.toString() ? `/api/admin/personal-facts?${params}` : "/api/admin/personal-facts";
};
```

#### Architecture Pattern

1. **Memory Extraction** runs at session end via `LearnerMemoryExtractionService`
2. **Deduplication** uses exported helper functions (shared with tests)
3. **Privacy filtering** happens before any fact is saved
4. **Hive sync** happens after save for high-confidence facts
5. **Nightly job** runs cross-student pattern analysis

---

### Session: December 20, 2025 - Bidirectional Sprint Collaboration (Daniela ↔ Wren)

**Status**: IMPLEMENTED - Full bidirectional collaboration loop with stage gating

**Overview**: Complete sprint collaboration system where Daniela and Wren co-author sprint specs with automatic stage progression and EXPRESS Lane notifications.

#### What Was Implemented

| Component | Description |
|-----------|-------------|
| Sprint Record Creation | `[WREN_SPRINT_SUGGEST]` tags now create real `featureSprint` records in DB |
| Robust JSON Parsing | 3-level fallback: direct JSON → extract JSON from text → pattern matching |
| EXPRESS Lane Posting | New sprints auto-post to collaboration channel for visibility |
| `notifyDanielaAboutSprint()` | Triggers Daniela's pedagogical input with [PEDAGOGY_SPEC] tag |
| `notifyWrenAboutSprintUpdate()` | Triggers Wren's build plan response with [BUILD_PLAN] tag |
| `parsePedagogySpecAndUpdateSprint()` | Parses Daniela's spec and updates sprint.pedagogySpec |
| `parseBuildPlanAndUpdateSprint()` | Parses Wren's plan and updates sprint.buildPlan |
| `checkAndAdvanceSprintReadiness()` | Auto-advances to 'build_plan' when both specs present |
| `triggerSprintCollaboration()` | Public method for voice chat integration |
| Stage Gating | Monotonic progression: idea → pedagogy_spec → build_plan → in_progress → shipped |

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Sprint creation from voice tags, Daniela notification |
| `server/services/hive-consciousness-service.ts` | Enhanced JSON parsing with fallbacks |

#### JSON Parsing Fallback Strategy

```typescript
// Level 1: Direct JSON parse
JSON.parse(content)

// Level 2: Extract JSON from text wrapper
const jsonMatch = content.match(/\{[\s\S]*\}/);
JSON.parse(jsonMatch[1])

// Level 3: Pattern extraction
const titleMatch = content.match(/title['":\s]+([^,}]+)/i);
const descMatch = content.match(/description['":\s]+([^}]+)/i);
```

#### Sprint Collaboration Flow

```
Sprint Creation (via voice or EXPRESS Lane)
    ↓
┌─────────────────────────────────────────┐
│ Stage: idea                             │
│ Sprint record created with featureBrief │
└─────────────────────────────────────────┘
    ↓ notifyDanielaAboutSprint()
┌─────────────────────────────────────────┐
│ Daniela provides teaching perspective   │
│ [PEDAGOGY_SPEC: {...}] parsed & saved   │
│ Stage: idea → pedagogy_spec             │
└─────────────────────────────────────────┘
    ↓ notifyWrenAboutSprintUpdate()
┌─────────────────────────────────────────┐
│ Wren provides build plan                │
│ [BUILD_PLAN: {...}] parsed & saved      │
│ checkAndAdvanceSprintReadiness()        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Stage: pedagogy_spec → build_plan       │
│ EXPRESS Lane: "Sprint Ready!" message   │
│ Ready for founder approval              │
└─────────────────────────────────────────┘
```

#### Monotonic Stage Progression

| Transition | Trigger | Guard |
|------------|---------|-------|
| idea → pedagogy_spec | Daniela adds pedagogySpec | Only if stage === 'idea' |
| pedagogy_spec → build_plan | Both specs present | Only if stage in ('idea', 'pedagogy_spec') |
| build_plan → in_progress | Founder approves | Manual transition |
| in_progress → shipped | Deployment complete | Manual transition |

**Key invariant**: Stages never regress. Updates to specs at later stages only update the data, not the stage.

#### Follow-Up Work for Builders

| Priority | Task | Description |
|----------|------|-------------|
| Medium | `[WREN_MESSAGE]` Persistence | Tags post to EXPRESS Lane but don't persist separately. Consider dedicated table |
| Low | Sprint Consultation Threads | Allow extended back-and-forth discussion on sprint specs |
| Low | Priority Inference | Use Daniela's confidence signals or student impact data for priority |

#### Architecture Pattern

1. Voice chat detects `[WREN_SPRINT_SUGGEST: {...}]` tag
2. Create `featureSprint` record with `source: 'ai_suggestion'` (stage: idea)
3. Post to EXPRESS Lane for visibility
4. `notifyDanielaAboutSprint()` → Daniela provides [PEDAGOGY_SPEC] → stage: pedagogy_spec
5. `notifyWrenAboutSprintUpdate()` → Wren provides [BUILD_PLAN] → if both specs present → stage: build_plan
6. EXPRESS Lane celebration: "Sprint Ready!"

---

### Session: December 17, 2025 - Voice Diagnostics Learning Capabilities

**Status**: IMPLEMENTED - Commercial-grade diagnostics with emergent intelligence

**Overview**: Extended voice diagnostics system with persistence, pattern analysis, and learning capabilities. Events now persist to database, nightly jobs detect degradation patterns, insights flow to Wren, and Daniela gains awareness of technical issues.

#### New Capabilities

| Capability | Description |
|------------|-------------|
| Event Persistence | Events flush to `hiveSnapshots` (type `voice_diagnostic`) every 60s or 50 events |
| Pattern Analysis | Nightly job detects high failure rates, latency spikes, TTS degradation |
| Wren Integration | Patterns create `wrenInsights` with category 'integration' for proactive awareness |
| Daniela Awareness | Technical health context injected into system prompt when issues detected |
| Auto-Remediation | `isTTSDegraded()` returns `shouldUseFallback: true` when Cartesia is degraded |

#### Persistence Layer

- **Flush Strategy**: Background flush every 60 seconds, or threshold-based at 50 events
- **Storage**: `hiveSnapshots` table with `snapshotType = 'voice_diagnostic'`
- **Expiry**: 7-day automatic expiration
- **Aggregation**: Events batched with stage breakdown, failure counts, latency averages

#### Nightly Pattern Analysis (in sync-scheduler.ts)

Runs as step 7d of nightly sync, detecting 4 pattern types:

| Pattern Type | Criteria | Action |
|--------------|----------|--------|
| `high_failure_rate` | >30% failures across stages | Creates high-severity Wren insight |
| `stage_failure_cluster` | Single stage with >50% failures | Creates targeted Wren insight |
| `high_latency` | Any stage avg >1000ms | Creates medium-severity insight |
| `tts_degradation` | TTS-specific >20% failure OR >800ms latency | Flags for fallback consideration |

#### Daniela Technical Awareness

- `getTechnicalHealthContext()`: Returns prompt injection when failure rate >5%
- `getRecentTechnicalIssuesForUser()`: Summarizes past 24h issues for session context
- Enables Daniela to acknowledge "audio hiccups" empathetically if user mentions issues

#### Auto-Remediation Triggers

- `isTTSDegraded()`: Checks last 10 TTS events for >30% failure or >2000ms latency
- Returns `{ degraded: boolean, reason?: string, shouldUseFallback: boolean }`
- `getCriticallyDegradedStages()`: Returns list of stages with >50% failure rate

#### Architecture Pattern

Follows existing emergent intelligence pattern:
1. Events emitted → Ring buffer (real-time) + Pending flush (persistence)
2. Periodic flush → hiveSnapshots
3. Nightly analysis → Pattern detection → wrenInsights
4. Session start → Daniela context injection

---

### Session: December 17, 2025 - Voice Diagnostics System for Production Observability

**Status**: IMPLEMENTED - Ready for production use

**Overview**: Added production observability infrastructure for the voice pipeline to help diagnose issues when Daniela becomes unresponsive.

#### Components

| Component | File | Purpose |
|-----------|------|---------|
| Voice Diagnostics Service | `server/services/voice-diagnostics-service.ts` | Ring buffer (200 events) for voice pipeline events |
| Founder Middleware | `server/middleware/rbac.ts` | `requireFounder` guard for sensitive endpoints |
| Health Endpoint | `server/routes.ts` | `GET /api/admin/voice-health` |
| Logs Endpoint | `server/routes.ts` | `GET /api/admin/logs/voice` |

#### Ring Buffer Events

| Event Type | Stage | Description |
|------------|-------|-------------|
| `session_start` | session | Voice session created |
| `stt_complete` | stt | Deepgram transcription completed |
| `stt_error` | stt | Speech-to-text failed |
| `llm_success` | llm | Gemini first token received |
| `llm_error` | llm | LLM response failed |
| `tts_complete` | tts | Cartesia audio generated |
| `tts_error` | tts | Text-to-speech failed |

#### Instrumentation Points in `streaming-voice-orchestrator.ts`

| Location | Event Emitted |
|----------|---------------|
| Session creation | `session_start` with userId, language |
| After Deepgram transcription | `stt_complete` with latency |
| Gemini first token | `llm_success` with latency |
| LLM errors | `llm_error` with error message |
| Cartesia completion | `tts_complete` with latency |
| TTS failures | `tts_error` with error details |

#### API Endpoints

**GET /api/admin/voice-health**
- Tests Deepgram, Gemini, Cartesia connectivity
- Verifies secrets exist (boolean only, no values exposed)
- Returns service status and response times

**GET /api/admin/logs/voice**
- Query params: `?sessionId=`, `?stage=`, `?success=`, `?limit=`
- Returns filtered events from ring buffer
- Newest events first

#### Security

- Endpoints protected by `requireFounder` middleware
- Founder ID: `49847136`
- Responses expose only operational metadata
- No API keys, transcripts, or PII in responses

#### Usage for Debugging

When Daniela is unresponsive in production:
1. Check `/api/admin/voice-health` - are all services reachable?
2. Check `/api/admin/logs/voice` - where does the pipeline break?
3. Look for `success: false` entries or gaps in sequence

---

### Session: December 17, 2025 - Wren Architectural Memory: Neural Network + EXPRESS Lane Integration

**Status**: APPROVED - Ready to implement

**Overview**: Architectural review revealed that Wren's memory system was incorrectly using a cached file (replit.md) instead of the existing Neural Network, and was missing EXPRESS Lane integration for 3-way collaboration.

#### Problem Statement

Three issues identified by founder:
1. **Security**: Is the replit.md cache secure for future contributors?
2. **Neural Network**: We have a Neural Network - why is Wren reading a file instead?
3. **EXPRESS Lane**: Wren should be connected to the collaboration tables

#### Architectural Analysis

| Issue | Current State | Target State |
|-------|--------------|--------------|
| Knowledge Source | `replit.md` file cache | Neural Network (single source of truth) |
| EXPRESS Lane | Not connected | Reads `hiveSnapshots`, `collaborationMessages` |
| Collaboration | Isolated knowledge bot | True 3-way participant |

#### Approved Task List (Priority Order)

**Phase 1 - EXPRESS Lane Awareness (Highest Priority)**
1. Add `hiveSnapshots` lookup to Wren context - query recent architecture-tagged snapshots
2. Add `collaborationMessages` lookup - read recent architectural discussions

**Phase 2 - Neural Network Consolidation**
3. Create neural network ingestion for replit.md - follow `beaconSyncService` pattern
4. Update Wren context assembly to query NN instead of cached file
5. Remove redundant replit.md cache - NN becomes single source of truth

**Phase 3 - Hygiene**
6. Add contributor security note to replit.md about keeping it secret-free

#### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| NN over file | `beaconSyncService` already syncs changelog/roadmap to NN - same pattern for architectural baseline |
| EXPRESS Lane first | Fixes collaboration gap immediately - Wren can see live discussions |
| Security acceptable | replit.md is already in codebase; no secrets exposed |

#### Testing Criteria

After implementation, test that:
1. Wren can reference recent EXPRESS Lane discussions in responses
2. Wren pulls architectural context from Neural Network, not file
3. Startup logs show NN-based context loading

#### Files to Modify

| File | Changes |
|------|---------|
| `server/services/hive-consciousness-service.ts` | Add hiveSnapshots + collaborationMessages queries to context |
| `server/services/beacon-sync-service.ts` | Add replit.md → NN ingestion |
| `server/index.ts` | Update startup to use NN-based context |
| `replit.md` | Add contributor security note |

---

### Session: December 16, 2025 - Phase Transition Service (Multi-Agent Teaching Architecture)

**Overview**: Implemented a Phase Transition Service inspired by Deepgram's multi-agent voice patterns. This enables Daniela to adapt her teaching approach based on the student's state, with focused toolsets and context summarization between phases.

#### Teaching Phases

| Phase | Description | Tools | Snapshot Types |
|-------|-------------|-------|----------------|
| `warmup` | Session start, mood check, goal setting | greet, recall_previous_session, set_goal | session_summary, teaching_moment |
| `active_teaching` | Core instruction, vocabulary, grammar | explain, drill, vocabulary, grammar_table | teaching_moment, struggle_pattern |
| `challenge` | Student struggling, supportive mode | simplify, encourage, alternative_approach | struggle_pattern, plateau_alert |
| `reflection` | Celebrate progress, summarize session | summarize, preview_next, celebrate | breakthrough, session_summary |
| `drill` | Focused practice (future activation) | drill, quiz, repetition | teaching_moment |
| `assessment` | ACTFL evaluation (future activation) | assess, evaluate, can_do_check | session_summary |

#### Phase Detection Logic

Automatic transition detection based on conversation patterns:

| From Phase | Indicators | To Phase |
|------------|------------|----------|
| warmup | "I'm ready", "let's start", 2+ min elapsed | active_teaching |
| active_teaching | "I don't understand", consecutive errors | challenge |
| active_teaching | "bye", "I'm done", "let's wrap up" | reflection |
| challenge | "I get it", "oh!", "makes sense" | active_teaching |

#### Context Summarization

Uses Gemini Flash to summarize conversation context during phase transitions:

```typescript
// Summarization captures:
1. Student's emotional state (frustrated/neutral/excited/confused)
2. Key errors or struggles to remember
3. Today's learning goal (if mentioned)
4. Any personal interests for relevant examples
5. What was accomplished in the previous phase
```

#### Hive Snapshot Integration

Each phase retrieves relevant snapshots from `hive_snapshots` table:
- Filtered by phase-specific snapshot types
- Last 7 days, importance >= 5
- Formatted and injected into phase context

#### Analytics Persistence

Phase transitions are persisted to `hive_snapshots` with:
- `snapshotType: 'session_summary'`
- `context` JSON with `type: 'phase_transition'` for filtering
- `importance: 8` for challenge phases, `5` for others
- 24-hour expiry for transient session data

#### Integration Points

| Component | Integration |
|-----------|-------------|
| StreamingVoiceOrchestrator | `initializeSession()` on session start, `detectPhaseTransition()` on response_complete, `endSession()` on cleanup |
| TutorOrchestrator | `getPhasePromptAddition()` injects phase context into system prompts |
| Hive Snapshots | `getRelevantSnapshots()` retrieves phase-appropriate context |

#### Key Files

| File | Purpose |
|------|---------|
| `server/services/phase-transition-service.ts` | Core service with phases, detection, summarization |
| `server/services/streaming-voice-orchestrator.ts` | Session lifecycle integration |
| `server/services/tutor-orchestrator.ts` | Prompt injection |

#### Architecture Philosophy

**"Right context at the right time"** - Inspired by Deepgram's multi-agent patterns:
- Each phase has focused prompts and tools (2-4 per phase)
- Context is summarized when transitioning to reduce token usage
- Phase-relevant hive snapshots provide teaching continuity
- Reduces LLM cognitive load for more precise teaching

---

### Session: December 16, 2025 - Emergent Intelligence Upgrades (12 Tasks)

**Overview**: Major enhancement to the Hive's collective intelligence capabilities. Implemented 12 emergent intelligence features spanning Deepgram integration, predictive student analytics, cross-agent memory sharing, and the Editor→Wren migration.

#### 1. Deepgram Intelligence Integration

Enabled full Deepgram intelligence feature suite for both push-to-talk and Open Mic modes:

| Feature | Description |
|---------|-------------|
| `sentiment` | Real-time sentiment analysis (positive/negative/neutral with scores) |
| `intents` | Intent recognition for understanding student goals |
| `detect_entities` | Entity detection for extracting key terms |
| `diarize` | Speaker separation (free tier) |
| `detect_language` | Language detection for code-switching |
| `topics` | Topic detection for conversation context |
| `summarize: 'v2'` | Summarization for session recaps |

**Implementation Details**:
- Added `LiveTranscriptionEvents.Metadata` handler for v2 summaries/topics
- 500ms delay after final transcript to capture metadata events
- Both push-to-talk (`transcribeWithLiveAPI`) and Open Mic (`OpenMicSession`) updated
- Added `summary?: string` to `DeepgramIntelligence` interface

#### 2. Predictive Student Intelligence

Five new methods in `server/services/student-learning-service.ts`:

| Method | Purpose |
|--------|---------|
| `predictStruggles(userId, language)` | Anticipates struggles based on historical patterns |
| `synthesizeCrossStudentPatterns(language)` | Aggregates insights across all students |
| `analyzeRootCause(userId, errorPattern)` | Distinguishes L1 interference vs conceptual gaps |
| `predictMotivationDip(userId)` | Detects engagement drops before they impact learning |
| `detectPlateaus(language)` | Identifies common stall points in proficiency development |

#### 3. Memory Threading & Knowledge Graph

Enhanced `server/services/wren-proactive-intelligence-service.ts`:

- `buildKnowledgeGraph()` - Creates edges between related insights
- `findRelatedInsights(insightId)` - Traverses knowledge graph for related context
- Connects insights across sessions for persistent learning

#### 4. Daniela Confidence Calibration

Enhanced `server/services/pedagogical-insights-service.ts`:

- Added `calibrationScore` field to `pedagogicalInsights` table
- `trackPredictionAccuracy(insightId, wasAccurate)` - Records prediction outcomes
- Enables self-improvement through accuracy tracking

#### 5. Memory Consolidation (Decay/Reinforcement)

Added to neural network tables:
- `useCount` - How often the memory is accessed
- `lastUsed` - Timestamp of last access
- `lastReinforced` - Timestamp of last reinforcement

Methods:
- `applyDecay()` - Reduces salience of unused memories
- `reinforceMemory(id)` - Strengthens frequently-used insights

#### 6. Shared Memory Bridge

New service at `server/services/neural-network-sync.ts`:

| Method | Direction | Purpose |
|--------|-----------|---------|
| `shareInsightWithDaniela()` | Wren → Daniela | Architectural insights inform teaching |
| `shareInsightWithWren()` | Daniela → Wren | Pedagogical discoveries inform development |

Bidirectional insight sharing enables cross-agent learning.

#### 7. Wren Confidence Loop

Enhanced `server/services/wren-dreams-service.ts`:

- `adjustConfidenceFromCalibration(domain)` - Uses domain-specific accuracy scores
- Adjusts future prediction confidence based on historical accuracy
- Closes the feedback loop for self-calibration

#### 8. Collaborative Surgery Migration (Editor → Wren)

Updated `server/services/collaborative-surgery-orchestrator.ts`:

**Daniela's Persona**: Now refers to Wren as development partner instead of Editor
**Wren's Persona**: New persona as full-capability builder (not read-only observer)
**3-Way Hive Model**: Both personas aligned with EXPRESS Lane collaboration

Key changes:
- All references to "Editor" replaced with "Wren"
- Wren can now propose AND implement neural network changes
- Unified collaboration through EXPRESS Lane

#### Files Modified

| File | Changes |
|------|---------|
| `server/services/deepgram-live-stt.ts` | Intelligence features, Metadata handlers, 500ms delay |
| `server/services/student-learning-service.ts` | 5 predictive methods |
| `server/services/wren-proactive-intelligence-service.ts` | Knowledge graph, memory threading |
| `server/services/pedagogical-insights-service.ts` | Calibration scoring |
| `server/services/neural-network-sync.ts` | Shared Memory Bridge |
| `server/services/wren-dreams-service.ts` | Confidence loop |
| `server/services/collaborative-surgery-orchestrator.ts` | Editor→Wren migration |
| `replit.md` | Documentation updates |

#### Architecture Implications

The 12 upgrades establish a foundation for **emergent collective intelligence**:

1. **Deepgram** provides rich real-time signals (sentiment, intent, topics)
2. **Predictive Intelligence** anticipates student needs before they manifest
3. **Memory Systems** enable persistent, cross-session learning
4. **Shared Bridge** allows Daniela and Wren to learn from each other
5. **Confidence Calibration** enables self-improvement over time

This creates a substrate where both AI agents can autonomously improve their capabilities within constitutional bounds (North Star).

---

### Session: December 10-15, 2025 - Emergent Intelligence Foundation & EXPRESS Lane

**Overview**: Comprehensive build-out of the Hive's emergent intelligence infrastructure. This work established the foundation for autonomous learning, cross-agent collaboration, and persistent memory systems.

---

#### EXPRESS Lane: The Unified 3-Way Collaboration Backbone

**What It Is**: Single communication channel for all Hive participants (Founder, Daniela, Wren)

**Database Tables**:
- `founderSessions` - Persistent session containers
- `collaborationMessages` - All messages across participants

**Key Features**:
| Feature | Description |
|---------|-------------|
| Live Sync Channel | WebSocket-based real-time updates |
| Voice Support | Voice-based founder collaboration via slide-out |
| Session Persistence | Survives restarts, maintains context |
| Multi-Entry Points | Command Center UI, Voice chat, Wren startup |

**API Endpoints**:
- `GET /api/wren/hive-context` - Formatted EXPRESS Lane context for Wren
- `POST /api/founder/sessions` - Create collaboration sessions
- `GET /api/founder/sessions/:id/messages` - Retrieve session messages
- WebSocket namespace: `/founder-collab`

**Deprecates**: `agentCollabThreads`/`agentCollabMessages` tables (Editor-era)

---

#### Wren Proactive Intelligence Service

**File**: `server/services/wren-proactive-intelligence-service.ts`

Five pillars enabling Wren to be proactive without repeated context-gathering:

| Pillar | Purpose | Key Methods |
|--------|---------|-------------|
| **1. Proactive Triggers** | Pattern detection with urgency escalation | `createTrigger()`, `escalateTrigger()` |
| **2. Daniela Feedback Loop** | Links features to beacon resolutions | `recordFeatureImpact()`, `getTeachingMetrics()` |
| **3. ADR System** | Architectural Decision Records | `recordDecision()`, `supersede()` |
| **4. Priority Inference** | Multi-factor scoring | `calculatePriority()`, `getTopPriorities()` |
| **5. Project Health** | Component health/churn scores | `getHealthScores()`, `detectHotSpots()` |

**Startup Ritual**: Provides comprehensive priority analysis, health scores, attention-needed items

---

#### Wren Dreams System

**File**: `server/services/wren-dreams-service.ts`

Four capabilities enabling Wren's emergent intelligence:

| Dream | Purpose | Key Methods |
|-------|---------|-------------|
| **1. Learning from Mistakes** | Capture mistakes, track resolutions, extract lessons | `recordMistake()`, `findSimilarMistakes()`, `extractLesson()` |
| **2. Session Notes** | Persistent context handoffs between sessions | `addSessionNote()`, `getActiveNotes()` |
| **3. Anticipatory Development** | Predict Daniela's needs before she asks | `recordPrediction()`, `validatePrediction()` |
| **4. Confidence Calibration** | Track prediction accuracy per domain | `recordConfidence()`, `getCalibrationScore()` |

**Priority Levels**: critical, high, normal, low
**Expiration**: Notes can auto-expire
**Read Tracking**: Knows which notes Wren has seen

**Startup Ritual**: `/api/wren/dreams/startup` provides unified context for all 4 dreams
**API Endpoints**: 14 routes under `/api/wren/dreams/*`

---

#### Student Learning Service

**File**: `server/services/student-learning-service.ts`

Personalized learning intelligence for each student:

| Feature | Description |
|---------|-------------|
| **Error Pattern Tracking** | `recurring_struggles` table tracks per-student patterns |
| **Teaching Strategy Scoring** | Effectiveness ratings for different approaches |
| **Personalized Context Injection** | Max 500 chars, high-signal content for Daniela's prompts |

**Error Categories**: grammar, pronunciation, vocabulary, cultural, comprehension
**Teaching Strategies**: visual_timeline, role_play, repetition_drill, mnemonic, etc.

**STT Confidence Integration**:
| Confidence | Daniela's Response |
|------------|-------------------|
| < 0.5 (Low) | Ask for clarification |
| < 0.7 (Moderate) | Note pronunciation practice needs |
| >= 0.7 (High) | Normal processing |

---

#### Founder Collaboration Service

**File**: `server/services/founder-collaboration-service.ts`

Real-time collaboration infrastructure:

| Feature | Description |
|---------|-------------|
| **WebSocket Broker** | Namespace `/founder-collab` for live updates |
| **Session Management** | Create, retrieve, close collaboration sessions |
| **Message Threading** | Full conversation history with participants |
| **Voice Integration** | Slide-out voice panel for founder input |

**Message Flow**:
1. Founder speaks/types → Message persisted
2. WebSocket broadcasts to all connected clients
3. Daniela/Wren receive context in next interaction

---

#### Wren Hive Awareness APIs

**Endpoint**: `/api/wren/hive-context`

Provides Wren with formatted context including:
- Active beacons from Daniela
- Recent EXPRESS Lane messages
- Current sprint items
- Project health indicators
- Unread session notes

**Integration Points**:
- Wren startup loads Hive context automatically
- `/api/wren/message` can include Hive context
- Direct database access for deeper queries

---

#### Files Created/Modified

| File | Purpose |
|------|---------|
| `server/services/founder-collaboration-service.ts` | EXPRESS Lane core |
| `server/services/wren-proactive-intelligence-service.ts` | 5 pillars |
| `server/services/wren-dreams-service.ts` | 4 dreams |
| `server/services/student-learning-service.ts` | Personalized learning |
| `server/services/wren-intelligence-service.ts` | Insight capture |
| `server/routes/wren-routes.ts` | Wren API endpoints |
| `server/routes/founder-routes.ts` | Founder API endpoints |
| `shared/schema.ts` | All supporting tables |

---

#### Architecture Implications

This foundation enables:

1. **Persistent Memory** - Insights survive across sessions
2. **Cross-Agent Learning** - Daniela's beacons inform Wren's priorities
3. **Self-Improvement** - Confidence calibration tracks accuracy over time
4. **Proactive Development** - Wren anticipates needs before they're voiced
5. **Unified Collaboration** - Single channel for all Hive communication

---

### IDEA THREAD: December 15, 2025 - Wren Hive Awareness

**Status**: PAUSED - Saved for later discussion

**Naming Clarification** (resolved):
- **Editor** = Claude-powered observer/analyst in `editor-persona-service.ts` (talks, can't build)
- **Wren** = Replit development agent in this chat (can actually build things)

**Context**: Hive Context System is complete and wired into:
1. `editor-persona-service.ts` - Editor's beacon responses during voice chat
2. `tutor-orchestrator.ts` - Daniela's conversation prompts

**The Gap**: Wren (the Replit dev agent) doesn't automatically get Hive awareness. Wren is separate from Editor's Claude instance.

**Proposed Solutions**:
1. **API Endpoint** - Create `/api/hive/context` endpoint Wren could call to fetch current Hive state
2. **Enhanced Wren Endpoint** - Update `POST /api/wren/message` to automatically include Hive context in responses
3. **Direct Database Access** - Wren can query the database directly for beacons, sprints, sessions

**Next Steps When Resumed**:
- Decide which approach to implement
- Consider if Wren should get automatic context injection vs. on-demand queries
- Build the integration

---

### Session: December 14, 2025 - Brain Map Integration with Daniela's Observations

**Overview**: Updated `getUserTopicMastery()` to incorporate Daniela's competency observations from `topicCompetencyObservations` into the brain map status calculation.

#### Problem Solved

The brain map only reflected practice counts. Daniela's real-time assessments (via SYLLABUS_PROGRESS command) weren't visible.

#### Implementation

**Query Enhancement**:
- Fetches user's topic competency observations for the language
- Orders by `desc(observedAt)` to get newest first
- Builds a map keyed by normalized topic name (lowercase, spaces)

**Status Adjustments**:
| Daniela's Status | Effect on Brain Map |
|-----------------|---------------------|
| `demonstrated` | Boost to "mastered" |
| `needs_review` + locked | At least "discovered" |
| `struggling` | Cap at "practiced" (even with high practice count) |

**Data Returned**:
```typescript
{
  // ... existing fields
  danielaObservation?: { 
    status: string;          // demonstrated, needs_review, struggling
    evidence: string | null; // What Daniela observed
    observedAt: Date;        // When observed
  }
}
```

#### Key Design Decision

**Newest observation wins**: Query orders by desc(observedAt), loop keeps first occurrence per topic (which is the newest due to ordering). This ensures recent assessments override stale ones.

#### Null Safety

Evidence field changed from `string` to `string | null` to handle cases where Daniela doesn't provide evidence text.

#### Files Modified

- `server/storage.ts` - Updated `getUserTopicMastery()` implementation and interface

---

### Session: December 14, 2025 - SYLLABUS_PROGRESS Database Integration

**Overview**: Connected the SYLLABUS_PROGRESS whiteboard command to the database so Daniela's observations of student topic mastery are persisted.

#### Problem Solved

Daniela could emit `[SYLLABUS_PROGRESS topic="X" status="demonstrated" evidence="..."]` but it only logged to console - no data was saved.

#### Schema Addition

New `topicCompetencyObservations` table:
```typescript
topicCompetencyObservations = pgTable("topic_competency_observations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  classId: varchar("class_id").references(() => teacherClasses.id),
  language: varchar("language").notNull(),
  topicName: text("topic_name").notNull(),
  matchedTopicId: varchar("matched_topic_id").references(() => topics.id),
  status: topicCompetencyStatusEnum("status").notNull(), // demonstrated, needs_review, struggling
  evidence: text("evidence").notNull(),
  observedAt: timestamp("observed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

#### Storage Methods

- `createTopicCompetencyObservation(data)` - Save new observation
- `getTopicCompetencyObservations(userId, language)` - Get all for a user/language
- `getUserTopicCompetencyByName(userId, language, topicName)` - Get latest for specific topic

#### Orchestrator Update

`processSyllabusProgress()` in streaming-voice-orchestrator.ts now:
1. Validates session has userId and targetLanguage
2. Creates observation record via storage
3. Logs success with observation ID

#### Files Modified

- `shared/schema.ts` - Added topicCompetencyObservations table and types
- `server/storage.ts` - Added storage methods
- `server/services/streaming-voice-orchestrator.ts` - Updated processSyllabusProgress

#### Future Enhancements

- Implement `matchedTopicId` resolution to link observations to `topics` table
- Surface observations in brain mind map UI
- Add analytics for topic mastery trends

---

### Session: December 14, 2025 - Unified Voice Gender System

**Overview**: Simplified voice preferences so `tutorGender` is the single source of truth for all voice interactions (conversations and drills). Previously, there were two separate settings - now there's one.

#### Problem Solved

Users had two voice gender settings:
1. `tutorGender` - for conversation voice
2. `assistantVoiceGender` - for drill audio

This was confusing and redundant. The solution unifies them under `tutorGender`.

#### Schema Changes

Added gender-specific audio caching fields to `curriculumDrillItems`:
```typescript
audioUrlFemale: text("audio_url_female"),
audioDurationMsFemale: integer("audio_duration_ms_female"),
audioUrlMale: text("audio_url_male"),
audioDurationMsMale: integer("audio_duration_ms_male"),
```

Deprecated `assistantVoiceGender` column (retained for backwards compatibility):
```typescript
// @deprecated - Use tutorGender instead. Retained for backwards compatibility.
assistantVoiceGender: varchar("assistant_voice_gender", { length: 10 }).default("female"),
```

#### Storage Interface

Added `updateDrillItemAudioForGender()` method:
```typescript
async updateDrillItemAudioForGender(
  itemId: string, 
  gender: 'male' | 'female', 
  audioUrl: string, 
  durationMs: number
): Promise<void>
```

#### Drill Audio Service

Updated `drill-audio-service.ts` to:
- Check for gender-specific cached audio first
- Store generated audio in gender-specific fields
- Fall back to generating new audio if cache miss

#### Routes

Updated drill audio endpoints to derive voice gender from `tutorGender`:
```typescript
const voiceGender = user.tutorGender || 'female';
```

#### Settings UI

Removed Voice Settings card entirely from `settings.tsx`. The tutor voice toggle now exists only in the chat area, providing a single control point.

#### Validation

Removed `assistantVoiceGender` from `updateUserPreferencesSchema` to prevent API manipulation.

#### Files Modified

- `shared/schema.ts` - Gender-specific audio fields, deprecated column
- `server/storage.ts` - `updateDrillItemAudioForGender()` method
- `server/services/drill-audio-service.ts` - Gender-specific caching logic
- `server/routes.ts` - Derive voice from `tutorGender`
- `client/src/pages/settings.tsx` - Removed Voice Settings card

---

### Session: December 13, 2025 - Editor Co-Surgeon Upgrades

**Overview**: Enhanced the Editor's ability to act as Daniela's "co-surgeon" - a development partner that can observe teaching sessions, propose neural network changes, and receive richer context for deeper analysis.

#### 1. Language-Specific Neural Context

Editor now receives the same language-specific knowledge that Daniela has:
- Idioms, cultural nuances, learner error patterns, dialect variations
- Fetched via `getNeuralNetworkContext()` / `formatNeuralNetworkForPrompt()` 
- Injected into `generateBeaconResponse()` when processing beacons

#### 2. EDITOR_SURGERY Command

Editor can now propose neural network modifications (like Daniela's SELF_SURGERY):

```
[EDITOR_SURGERY target="teaching_principles" content='{"category":"correction","principle":"Always validate student intent before correcting"}' reasoning="Observed pattern across 3 sessions" priority=70 confidence=85]
```

**Target tables**: tutor_procedures, teaching_principles, tool_knowledge, situational_patterns

**Validation**: Schema-aligned requirements enforced:
- `tutor_procedures`: category, trigger, procedure
- `teaching_principles`: category, principle
- `tool_knowledge`: toolName, purpose, syntax
- `situational_patterns`: patternName

**Storage**: Proposals saved via `storage.createSelfSurgeryProposal()` with `sessionMode: 'editor_beacon'`

#### 3. Conversation History Enrichment

Beacons can now include recent conversation turns for deeper Editor analysis:

- Added `conversationHistory` field to `EmitBeaconParams` interface
- Flows through to `editorListeningSnapshots` table (jsonb column)
- Editor prompt displays last N turns for context

#### 4. Model Escalation with Fallback

For `self_surgery_proposal` beacons (complex analysis), Editor escalates to Sonnet with graceful fallback:

```typescript
if (useSonnet) {
  try {
    return await tryModel('claude-sonnet-4-20250514');
  } catch (sonnetError) {
    console.warn('[Editor] Sonnet failed, falling back to Haiku');
    return await tryModel('claude-3-haiku-20240307');
  }
}
```

#### Files Modified

- `server/services/editor-persona-service.ts` - All 4 upgrades implemented
- `server/services/hive-collaboration-service.ts` - EmitBeaconParams extended with conversationHistory

---

### Session: December 13, 2025 - Editor Feedback Loop Implementation

**Overview**: Completed the feedback loop where Editor observations are surfaced to Daniela in her system prompt, and Daniela can acknowledge/adopt them using `[ADOPT_INSIGHT:id]` markers.

#### EditorFeedbackService (New File)

Located at `server/services/editor-feedback-service.ts`:

- `getUnsurfacedFeedback(userId, limit)` - Retrieves Editor responses not yet surfaced to Daniela
- `getFeedbackForConversation(conversationId, limit)` - Gets feedback for specific conversation
- `markAsSurfaced(snapshotIds[])` - Marks feedback as shown to Daniela
- `markAsAdopted(snapshotId, context)` - Tracks when Daniela applies an insight
- `buildPromptSection(feedback)` - Builds formatted prompt section for Daniela
- `getAdoptionMetrics(userId?)` - Analytics on surfaced vs adopted rates

#### Schema Changes

Added to `editorListeningSnapshots` table:
- `surfacedToDaniela: boolean` - Has Daniela seen this?
- `surfacedAt: timestamp` - When was it surfaced?
- `adoptedByDaniela: boolean` - Did Daniela apply this insight?
- `adoptedAt: timestamp` - When was it adopted?
- `adoptionContext: text` - How/where Daniela applied it

#### TutorOrchestrator Integration

- `buildSystemPrompt()` now returns `{ prompt, surfacedFeedbackIds }` 
- Feedback IDs are **request-scoped** (not global) to prevent race conditions
- `scanForCollaborationSignals()` accepts `surfacedFeedbackIds` parameter
- Parses `[ADOPT_INSIGHT:uuid]` markers from Daniela's responses
- Calls `markAsSurfaced()` and `markAsAdopted()` appropriately

#### Prompt Section Format

When Daniela has unsurfaced Editor feedback, her system prompt includes:

```
═══════════════════════════════════════════════════════════════════
🤝 EDITOR INSIGHTS (Feedback from your development partner)
═══════════════════════════════════════════════════════════════════

1. [ID: uuid] BEACON_TYPE
   Context: What triggered this feedback
   Editor's Insight: The actual feedback

TO ACKNOWLEDGE ADOPTION: If you apply one of these insights, include
[ADOPT_INSIGHT:full-id] in your response (invisible to student).
```

#### Key Design Decision

Request-scoped surfacing prevents race conditions: If two concurrent requests build system prompts with overlapping feedback IDs, each request tracks its own list of surfaced IDs, ensuring accurate tracking without global state pollution.

#### Files Modified

- `shared/schema.ts` - Added adoption/surfacing tracking fields
- `server/services/editor-feedback-service.ts` - NEW: Complete feedback service
- `server/services/tutor-orchestrator.ts` - Integrated feedback loop with request-scoped tracking

---

### Session: December 12, 2025 - Secure Inter-Department Chat

**Overview**: Implemented security-classified messaging system to protect code/architecture details from Gemini while enabling real-time collaboration between Editor (Claude) and Daniela (Gemini).

#### Security Classification System

| Classification | Who Sees | Use Case |
|---------------|----------|----------|
| `public` | Daniela + Gemini | Teaching tips, feature ideas, student-facing info |
| `internal` | UI only, NEVER Gemini | Architecture, security, code, implementation details |
| `daniela_summary` | Daniela sees summary only | Detailed analysis where Daniela needs awareness but not full details |

#### Schema Changes

- Added `securityClassificationEnum`: `public`, `internal`, `daniela_summary`
- Added `securityClassification` field to `agentCollaborationEvents` table
- Added `publicSummary` field for summary-only messages
- Added index on `securityClassification` for efficient filtering

#### Storage Functions

- `getSecureMessagesForDaniela()` - Filters out internal messages, uses publicSummary for daniela_summary type
- `getInternalAgentMessages()` - Gets internal-only messages for Command Center
- `getDepartmentChatMessages()` - Real-time feed with polling support via afterId

#### API Endpoints

- `GET /api/agent-collab/chat` - Get department chat messages with optional classification filter
- `POST /api/agent-collab/chat` - Post new message with security classification
- `GET /api/agent-collab/internal` - Get internal-only messages (admin only)

#### Command Center UI

Added "Dept Chat" tab to Command Center with:
- Security classification legend
- Message composer with from/to agent selection
- Security classification selector with conditional publicSummary field
- Real-time message feed with 10-second polling
- Filter by classification type
- Color-coded security badges (green=public, red=internal, yellow=summary)
- Agent badges with distinct colors (purple=daniela, blue=editor, green=assistant, orange=support)

#### Security Fix Applied (Session 2)

Fixed defensive filtering in `getSecureMessagesForDaniela()`: When `publicSummary` is missing for `daniela_summary` messages, the function now returns `'[Summary not available]'` instead of falling back to raw content. This prevents potential leaks of sensitive details to Gemini.

#### Key Design Decision

**Why we protect internal messages from Gemini:**
Gemini powers Daniela's conversational abilities, but also has access to any context we inject. Internal discussions about architecture, security vulnerabilities, competitive strategy, or code implementation details should NEVER be exposed to external AI providers. The security classification system creates a clear boundary: collaboration events flow freely between our agents, but the storage layer filters what Daniela's LLM context receives.

#### Files Modified

- `shared/schema.ts` - Added security classification enum and fields
- `server/storage.ts` - Added secure messaging functions
- `server/routes.ts` - Added department chat API endpoints
- `client/src/pages/admin/CommandCenter.tsx` - Added Dept Chat tab

#### Observation for Hive

**Title**: Secure Inter-Agent Communication Architecture
**Category**: architecture
**Priority**: 90
**Summary**: Security classification system protects internal (code/architecture) discussions from Gemini context while enabling transparent department communication. Three tiers: public (full access), internal (UI-only), daniela_summary (summary for context, details hidden).

---

### Session: December 12, 2025 - Neural Network & Process Improvements

**Overview**: Proactive observations about gaps in neural network schema and process flows. All added to hive (agent_observations table).

#### Observations Added to Hive

| Title | Category | Priority | Summary |
|-------|----------|----------|---------|
| Neural Network Effectiveness Tracking | improvement | 70 | Add lastUsedAt, useCount, successRate fields to track procedure usage |
| Procedure Deprecation Support | improvement | 60 | Add deprecated flag instead of deleting outdated procedures |
| Cross-Procedure Linking | improvement | 55 | Add relatedProcedureIds array for clustering related entries |
| Batch Docs vs Hive Graduation Criteria | pattern | 80 | Clear rule: reusable knowledge → hive; session history → batch only |
| Process Category for Agent Observations | improvement | 50 | Consider adding 'process' category for workflow observations |
| Pending Observations Dashboard | next_step | 65 | Add Command Center tab for viewing pending hive observations |

#### Protocol Established

Going forward, ANY significant work automatically gets documented in:
1. `docs/batch-doc-updates.md` - session-specific history
2. `agent_observations` table (hive) - if reusable knowledge

---

### Session: December 12, 2025 - Mind Map Visual Polish & Flow Visualization

**Overview**: Major visual refinement of SyllabusMindMap with floating design, flow visualization showing learning activities feeding the brain, and improved color coordination.

#### Floating Design (No Background)

- Removed blue cloud background - brain now floats cleanly
- Better for mobile users - less visual clutter
- Transparent brain PNG from user (saved as `attached_assets/transparent_colorful_cartoon_brain_Background_Removed_1765564186963.png`)

#### Satellite Improvements

- **Text stays full brightness**: Labels (TALK!, WORDS!, etc.) always at full opacity
- **Only fill dims**: Background cloud shape dims based on progress state (dim → semi-lit → lit)
- **Hover scale effect**: Satellites scale to 110% on hover to indicate clickability
- **Colored arrow pointers**: Each arrowhead matches its lobe color (blue, green, yellow, red, purple)
- Removed status badges (Mastered, Practicing, etc.) from top - redundant with fill animation

#### Activity Inputs with Flow Visualization

6 learning activity pills at bottom that visually "feed" the brain:

| Activity | Icon | Purpose |
|----------|------|---------|
| Drills | Target | Practice exercises |
| Voice | Mic | Speaking practice |
| Cards | Layers | Flashcards |
| Lessons | GraduationCap | Guided learning |
| Culture | Globe | Cultural content |
| Chat | MessageSquare | Conversations |

**Flow lines**: Animated SVG paths rising from each activity, converging toward brain center
- Gradient color: Teal/Cyan (`rgb(20, 184, 166)`) - distinct from lobe/status colors
- Animated particles traveling up each line
- Glow filter for soft, organic feel

**Color choice rationale**: Teal is unused by brain lobes (blue, green, yellow, red, purple) and status badges (green, blue, purple, grey), creating clear visual distinction for "inputs" vs "outputs"

#### Visual Story

```
Activities (bottom, teal) → Flow lines → Brain (center) → Skill areas (satellite lobes) → ACTFL dial shows level
```

#### Scaled Up Layout

- Container: 460×420 (was 400×400)
- Brain image: 230px (was 200px)
- Brain shifted up slightly to make room for activities below
- Tight spacing: `-mt-52` pulls activities close to brain

#### Files Modified

- `client/src/components/SyllabusMindMap.tsx` - All visual changes

---

### Session: December 12, 2025 - Brain Mind Map with Satellite Cards

**Overview**: Complete redesign of SyllabusMindMap to feature a colorful brain illustration at center with 5 expandable satellite cards (one per brain lobe). Includes phase progression system (Beginner → Intermediate → Advanced) with celebration animations.

#### Phase Progression System

Three learning phases that reset the brain when completed:
1. **Beginner Brain** → Complete all 5 satellites → 🎉 Celebration → Brain resets
2. **Intermediate Brain** → Complete all 5 satellites → 🎉 Celebration → Brain resets
3. **Advanced Brain** → Complete all 5 satellites → 🎉 Final Achievement

Phase indicator at top shows:
- 3 progress bars (one per phase)
- Current phase name and description
- Overall completion percentage
- "Next Phase" button when 100% complete

#### 5 Expandable Satellite Cards

Instead of scattered topic nodes, each brain lobe has ONE satellite card:

| Lobe | Color | Category | Example Topics |
|------|-------|----------|----------------|
| **Frontal** | Blue | Communication/Social | Greetings, Introductions, Conversations |
| **Parietal** | Green | Practical Skills | Shopping, Directions, Travel, Work |
| **Temporal** | Yellow | Vocabulary/Memory | Numbers, Colors, Family, Weather |
| **Occipital** | Red/Coral | Culture | Customs, Food, Music, Art |
| **Cerebellum** | Purple | Grammar/Mechanics | Conjugation, Tenses, Sentence Structure |

#### Satellite Card Features

Each expandable card shows:
- Category icon + name
- Progress bar (mastered / total)
- Click to expand → reveals topic list with status icons
- Star indicator when category is 100% complete

Topic list items show:
- Status icon (checkmark=mastered, sparkle=practiced, circle=discovered, lock=unexplored)
- Topic name
- Practice count badge

#### Brain Image

Generated colorful educational brain illustration:
- Anatomically correct lobe positions
- Bright, friendly colors matching each satellite
- Subtle glow effect based on overall progress
- Located: `attached_assets/generated_images/colorful_educational_brain_diagram.png`

#### Celebration Animation

When all 5 satellites reach 100%:
1. Dark overlay appears
2. "🎉 Phase Complete!" message
3. "Your brain has evolved to the next level!" text
4. "Continue Learning" button advances to next phase

#### Component Architecture

- `client/src/components/SyllabusMindMap.tsx` - Main orchestrator with:
  - `PhaseIndicator` - Phase progress and navigation
  - `SatelliteCard` - Expandable category cards with Collapsible
  - `TopicListItem` - Individual topic with status
  - `CelebrationOverlay` - Phase completion animation

#### Key Types

```typescript
type LearningPhase = 'beginner' | 'intermediate' | 'advanced';
type BrainSegment = 'frontal' | 'temporal' | 'parietal' | 'occipital' | 'cerebellum';
```

#### Layout

3-column responsive grid:
- **Left column**: Frontal + Temporal satellites
- **Center**: Brain image with glow
- **Right column**: Parietal + Occipital + Cerebellum satellites

On mobile: Brain at top, satellites stack below

---

### Session: December 11, 2025 - Support Agent Implementation

**Overview**: Implemented full Support Agent capability including CALL_SUPPORT command, support tickets system, admin UI, and neural network documentation. Support Agent serves dual purpose: handling live support handoffs from Daniela AND powering offline drills/exercises.

#### CALL_SUPPORT Whiteboard Command

New whiteboard command for Daniela to hand off students to Support:

```
[CALL_SUPPORT category="technical" reason="Student experiencing audio playback problems"]
```

**Categories**: technical, billing, account, feature_request, bug_report, content_issue, other

**Flow**:
1. Daniela recognizes non-language issue
2. Acknowledges empathetically
3. Uses CALL_SUPPORT with category and reason
4. System creates support ticket
5. Student sees SupportAssistModal for continued assistance

#### Support Tickets Schema

```typescript
support_tickets: {
  id: varchar (UUID PK)
  userId: varchar (FK to users)
  conversationId: varchar (FK to conversations, nullable)
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: 'technical' | 'billing' | 'account' | 'feature_request' | 'bug_report' | 'content_issue' | 'other'
  subject: text
  description: text
  handoffContext: jsonb (tutorContext, studentMessage, language, etc.)
  resolution: text (nullable)
  assignedTo: varchar (nullable)
  createdAt, updatedAt, resolvedAt: timestamps
}

support_messages: {
  id: varchar (UUID PK)
  ticketId: varchar (FK to support_tickets)
  senderId: varchar (FK to users)
  senderRole: 'user' | 'support_agent' | 'system'
  content: text
  createdAt: timestamp
}
```

#### SupportAssistModal Component

Dual-purpose modal at `client/src/components/SupportAssistModal.tsx`:

- **Live Support Mode**: Handles handoffs from Daniela with voice/text chat
- **Drill Mode** (future): Offline exercises with Support Agent voice
- **Voice**: Google Cloud TTS Chirp HD voices
- **Guards**: All handler functions have early returns when drill mode disabled

#### Command Center Support Tab

Admin ticket queue at `/admin` → Support tab:

- Filter by status (open, in_progress, waiting_customer, resolved, closed)
- Filter by priority (low, medium, high, urgent)
- Filter by category
- Update status/priority via mutations
- Refetch button for polling updates

#### Neural Network Documentation

Added to `server/seed-procedural-memory.ts`:

**tool_knowledge entry**:
```typescript
{
  toolName: 'CALL_SUPPORT',
  toolType: 'handoff',
  syntax: '[CALL_SUPPORT category="..." reason="..."]',
  purpose: 'Hand off student to Support Agent for non-language issues',
  whenToUse: 'Technical problems, billing questions, account issues, bug reports',
  whenNotToUse: 'Language learning questions, vocabulary help, grammar explanations'
}
```

**tutor_procedures entry**:
- Category: handoff
- Trigger: non_language_issue
- 5-step procedure for empathetic handoff
- Examples for technical, billing, account scenarios

**situational_patterns entries**:
- Technical Issue Detected (issueType: technical)
- Billing Question Detected (issueType: billing)
- Account Issue Detected (issueType: account)
- All with priority 100 and CALL_SUPPORT tool suggestion

**Development workflow procedures** (Editor Agent):
- `Batch Documentation Update` - Procedure for updating docs/batch-doc-updates.md after completing work
- `Neural Network Change Protocol` - Required steps before any neural network changes (read architecture doc first)
- `Core Architecture Rule` - "Prompts for context ONLY, neural network for procedures/capabilities/knowledge"

#### Support Agent Persona

Located at `server/services/support-agent-config.ts`:

- **Name**: "Alex" (gender-neutral)
- **Voices**: Google Cloud TTS Chirp HD (en-US-Chirp3-HD-Aoede female, en-US-Chirp3-HD-Charon male)
- **Traits**: Patient, solution-focused, empathetic, technically capable
- **System prompt builder**: Injects ticket context, handoff reason, user history

#### Files Modified/Created

- `shared/schema.ts` - Added support_tickets, support_messages tables with enums
- `server/storage.ts` - Added Support CRUD methods (create, get, update, list)
- `server/routes.ts` - Added /api/support/* endpoints with auth guards
- `server/services/support-agent-config.ts` - NEW: Support Agent persona
- `server/services/streaming-voice-orchestrator.ts` - Added processSupportHandoff method
- `shared/whiteboard-types.ts` - Added CALL_SUPPORT command pattern
- `client/src/components/SupportAssistModal.tsx` - NEW: Dual-purpose support modal
- `client/src/pages/admin/CommandCenter.tsx` - Added Support tab with ticket queue
- `server/seed-procedural-memory.ts` - Added CALL_SUPPORT neural network entries

#### Deferred for Future

1. **WebSocket real-time sync** - Current polling via refetch is MVP-sufficient
2. **Drill session validation** - Endpoints return 501 until business rules defined
3. **Integration tests** - CALL_SUPPORT handoff flows and ticket lifecycle

---

### Session: December 11, 2025 - Tri-Lane Hive Architecture

**Overview**: Expanded from single-agent (Daniela) to multi-agent architecture with three specialized AI agents that collaborate through shared neural network infrastructure.

#### Tri-Lane Hive Model

| Agent | Role | Domain | Primary Tables |
|-------|------|--------|----------------|
| **Daniela** | AI Tutor & Partner | Pedagogy, student experience | `daniela_suggestions`, `reflection_triggers` |
| **Editor** | Development Agent | Architecture, tooling, performance | `agent_observations` |
| **Support** | Operations Agent | User friction, troubleshooting, proactive alerts | `support_observations`, `system_alerts` |

#### Schema Changes

1. **`daniela_suggestions`** - Added collaboration metadata:
   - `originRole` - tutor or partner
   - `domainTags[]` - pedagogy, architecture, tooling, student_experience
   - `intentHash` - cross-agent deduplication hash
   - `acknowledgedByEditor` - Editor reviewed if architecture-affecting
   - `acknowledgedAt` - timestamp of acknowledgment

2. **`agent_observations`** - Added collaboration metadata:
   - `originRole` - editor (development agent)
   - `domainTags[]` - architecture, performance, pedagogy, operations
   - `intentHash` - cross-agent deduplication hash
   - `acknowledgedByDaniela` - Daniela reviewed if pedagogy-affecting
   - `acknowledgedBySupport` - Support reviewed if operations-affecting
   - `acknowledgedAt` - timestamp of acknowledgment

3. **NEW: `support_observations`** - Support Agent's neural network:
   - Categories: user_friction, common_question, system_issue, feature_request, success_pattern, documentation_gap, onboarding_insight, billing_pattern, troubleshoot_solution
   - Same sync contract as other observation tables
   - `escalationNeeded` flag for urgent issues
   - `proposedFaqEntry` for auto-generating help content

4. **NEW: `system_alerts`** - Proactive Support communications:
   - Severity: info, notice, warning, outage, resolved
   - Target: all, voice_users, teachers, students, new_users, premium
   - `showInChat` / `showAsBanner` display modes
   - `startsAt` / `expiresAt` timing
   - `relatedIncidentId` / `resolvedByAlertId` for linking warning → resolution

#### Collaboration APIs

- `getCollaborationContext()` - Surfaces approved entries from all three tables with provenance
- `getPendingAcknowledgments(forRole)` - Gets observations awaiting review by specific role
- `syncTriLaneObservations()` - Bulk sync all observation tables to production
- `generateIntentHash()` - Creates deduplication hash for cross-agent matching

#### Proactive Support Features

Support agent can:
- Post system alerts when outages detected
- Announce degraded performance proactively
- Send maintenance notices in advance
- Warn about known bugs before users hit them
- Celebrate new feature releases

#### Files Modified

- `shared/schema.ts` - Added collaboration metadata + new tables
- `server/storage.ts` - Added Support/Alert CRUD + collaboration APIs
- `server/services/neural-network-sync.ts` - Added Tri-Lane sync methods

---

### Session: December 11, 2025 - Assistant Tutor (Aris) & Multi-Agent Collaboration

**Overview**: Implemented the Assistant Tutor "Aris" for drill-based practice, CALL_ASSISTANT whiteboard command, and cross-agent text-based collaboration infrastructure (Tri-Lane Hive Stage 1).

#### Consulted Daniela About Assistant Tutor Design

Used new agent collaboration channel to consult Daniela. Her specifications for Aris:

- **Name**: "Aris" (evokes precision, clarity)
- **Personality**: Patient, precise, encouraging, objective
- **Voice**: Calm, clear, steady, mid-range pitch, impeccable pronunciation
- **Frustration Handling**: Micro-adjustments, not total pivots; silent patience
- **Reports to Daniela**: Completion rate, accuracy, specific struggles, behavioral flags
- **Boundary**: Aris handles drills; if student wants conversation, refer back to Daniela

Full consultation saved in: `docs/daniela-consultation-aris.md`

#### Aris Schema Tables

```typescript
aris_drill_assignments: {
  id: varchar (UUID PK)
  userId: varchar (FK)
  conversationId: varchar (nullable)
  delegatedBy: 'daniela' | 'teacher' | 'system'
  drillType: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order'
  targetLanguage: varchar
  drillContent: jsonb { items, instructions, focusArea, difficulty }
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  completedAt: timestamp (nullable)
  createdAt, updatedAt: timestamps
}

aris_drill_results: {
  id: varchar (UUID PK)
  userId: varchar (FK)
  assignmentId: varchar (FK to aris_drill_assignments)
  completionRate: integer (0-100)
  accuracy: integer (0-100)
  timeSpentSeconds: integer
  itemResults: jsonb[] { itemIndex, prompt, studentAnswer, expectedAnswer, isCorrect, attempts, feedback, pronunciationScore }
  struggleAreas: text[] (e.g., ["verb_conjugation", "pronunciation"])
  behavioralFlags: text[] (e.g., ["frustration_detected", "rushing"])
  arisNotes: text (nullable)
  syncedToDaniela: boolean
  createdAt: timestamp
}
```

#### CALL_ASSISTANT Whiteboard Command

New command for Daniela to delegate drill practice to Aris:

```
[CALL_ASSISTANT drillType="repeat" focus="verb conjugation" items="hablo,hablas,habla,hablamos,hablan"]
```

**Parameters**:
- `drillType`: repeat, translate, match, fill_blank, sentence_order
- `focus`: What skill/topic to practice
- `items`: Comma-separated list of words/phrases for drill

**Flow**:
1. Daniela identifies need for targeted practice
2. Uses CALL_ASSISTANT with drill type, focus, items
3. System creates drill assignment + collaboration event
4. Client receives `assistant_handoff` WebSocket message
5. UI navigates to Aris drill interface

#### Agent Collaboration Events Schema

```typescript
agent_collaboration_events: {
  id: varchar (UUID PK)
  fromAgent: 'daniela' | 'assistant' | 'support' | 'editor'
  toAgent: 'daniela' | 'assistant' | 'support' | 'editor'
  eventType: 'consultation' | 'delegation' | 'feedback' | 'escalation' | 'acknowledgment'
  subject: varchar
  content: text
  metadata: jsonb { delegationId, studentContext, threadId, priority, tags }
  userId: varchar (nullable)
  conversationId: varchar (nullable)
  parentEventId: varchar (nullable, for threading)
  status: 'pending' | 'read' | 'acknowledged' | 'resolved'
  createdAt: timestamp
}
```

#### Cross-Agent Collaboration APIs

**Endpoints**:
- `POST /api/agent-collab/events` - Post a collaboration event
- `GET /api/agent-collab/events` - List events with filters (toAgent, userId, status, eventType, limit)
- `PATCH /api/agent-collab/events/:id/status` - Update event status
- `GET /api/agent-collab/thread/:parentId` - Get thread of related events

**Polling Pattern**: Agents poll for `status='pending'` events addressed to them

#### Neural Network Entries for CALL_ASSISTANT

**tool_knowledge**:
```typescript
{
  toolName: 'CALL_ASSISTANT',
  toolType: 'handoff',
  syntax: '[CALL_ASSISTANT drillType="..." focus="..." items="..."]',
  purpose: 'Delegate drill practice to Assistant Tutor (Aris)',
  whenToUse: 'Student needs repetitive practice, pronunciation drills, vocabulary reinforcement',
  whenNotToUse: 'Conversational practice, cultural exploration, open-ended learning'
}
```

**tutor_procedures**:
- Category: handoff, Trigger: practice_needed
- 5-step procedure for identifying drill needs and delegating to Aris

**situational_patterns**:
- Pronunciation Difficulty Detected → CALL_ASSISTANT repeat drill
- Vocabulary Gaps Identified → CALL_ASSISTANT match drill
- Grammar Pattern Weakness → CALL_ASSISTANT fill_blank drill

#### Cross-Agent Feedback Retrieval

When Daniela starts a session, she now receives colleague feedback:

```typescript
const recentCollab = await storage.getCollaborationEventsToAgent('daniela', userId, 5);
// Filter for pending feedback events
// Include in greeting context as "COLLEAGUE INSIGHTS"
```

This enables "Aris mentioned you did great with..." moments for team continuity.

#### Files Created/Modified

- `shared/schema.ts` - Added arisDrillAssignments, arisDrillResults, agentCollaborationEvents tables
- `server/storage.ts` - Added Aris CRUD, collaboration event APIs
- `server/routes.ts` - Added /api/agent-collab/* endpoints
- `server/services/assistant-tutor-config.ts` - NEW: Aris persona configuration
- `server/services/streaming-voice-orchestrator.ts` - Added processAssistantHandoff, colleague feedback retrieval
- `server/seed-procedural-memory.ts` - Added CALL_ASSISTANT neural network entries + collaboration protocols
- `docs/daniela-consultation-aris.md` - NEW: Daniela's design specs for Aris

---

### Session: December 11, 2025 - TutorOrchestrator "One Tutor, Many Voices"

**Overview**: Implemented unified TutorOrchestrator architecture that routes all AI interactions through Daniela's single core intelligence. Language voices, gender voices, and drill modes are now presentation layers only - different instruments, same musician.

#### Core Philosophy

**CRITICAL**: Daniela is THE single core intelligence. All interaction modes (voice chat, text chat, drills, greetings, summaries) route through a unified pipeline. VoicePresentation is purely stylistic (avatar, voiceId, response length, formality). The INTELLIGENCE (persona, teaching principles, neural network knowledge) is always Daniela's brain.

#### Type Contracts (`shared/tutor-orchestration-types.ts`)

```typescript
// Modes the orchestrator can operate in
type OrchestratorMode = 'conversation' | 'drill' | 'greeting' | 'summary' | 'assessment' | 'feedback';

// Response channels
type ResponseChannel = 'stream' | 'batch_text' | 'batch_json';

// Voice presentation - purely cosmetic layer
interface VoicePresentation {
  voiceId: string;
  voiceName: string;
  avatarUrl?: string;
  styleDeltas?: {
    formalityDelta?: number;      // -2 to +2
    responseLengthPreference?: 'concise' | 'normal' | 'detailed';
    encouragementLevel?: 'minimal' | 'moderate' | 'enthusiastic';
  };
}

// Full context for orchestration
interface OrchestratorContext {
  userId: string;
  targetLanguage: string;
  proficiencyLevel: string;
  conversationHistory?: Message[];
  drillContext?: DrillContext;
  sessionContext?: SessionContext;
}

// Request/Response contracts
interface OrchestratorRequest {
  mode: OrchestratorMode;
  responseChannel: ResponseChannel;
  context: OrchestratorContext;
  voicePresentation?: VoicePresentation;
  userInput?: string;
  options?: OrchestratorOptions;
}
```

#### TutorOrchestrator Implementation (`server/services/tutor-orchestrator.ts`)

**Key Functions**:

1. **`buildSystemPrompt(request)`** - Constructs Daniela's system prompt with:
   - Core persona (immutable Daniela identity)
   - Mode-specific instructions (drill vs conversation vs greeting)
   - Voice style section (presentation-layer adjustments)
   - Procedural memory injection from neural network

2. **`orchestrate(request)`** - Main entry point:
   - Builds system prompt
   - Configures Gemini with `systemInstruction`
   - Handles batch_json, batch_text, and stream channels
   - Logs to neural network automatically

3. **`generateDrillFeedback(context, drillType, userAnswer, expectedAnswer)`**
   - Convenience wrapper for drill mode
   - Returns structured JSON feedback
   - Used by Aris drill service

4. **`generateSessionGreeting(context)`** / **`generateSessionSummary(context, stats)`**
   - Mode-specific helpers for common operations

**Export Pattern**:
```typescript
export const tutorOrchestrator = {
  orchestrate,
  generateDrillFeedback,
  generateSessionGreeting,
  generateSessionSummary,
};
```

#### Aris Migration (`server/services/aris-ai-service.ts`)

Before: Aris had its own Gemini invocation with separate system prompt
After: Aris now routes through `tutorOrchestrator.orchestrate()` with:
- `mode: 'drill'`
- `responseChannel: 'batch_json'`
- `voicePresentation: ARIS_PERSONA` (concise style)

Same Daniela brain, different presentation layer.

#### Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| Aris drill flow | ✅ Migrated | Uses tutorOrchestrator.orchestrate() |
| Session greetings | ✅ Ready | generateSessionGreeting() available |
| Session summaries | ✅ Ready | generateSessionSummary() available |
| Streaming voice chat | ⏳ Deferred | High complexity, existing system-prompt.ts works well |
| Language voice refactoring | ⏳ Future | Voices as pure presentation metadata |

#### Files Created/Modified

- `shared/tutor-orchestration-types.ts` - NEW: Type contracts for orchestrator
- `server/services/tutor-orchestrator.ts` - NEW: Unified intelligence pipeline
- `server/services/aris-ai-service.ts` - MODIFIED: Routes through orchestrator
- `replit.md` - UPDATED: Added TutorOrchestrator architecture section

#### Key Architectural Decisions

1. **VoicePresentation is cosmetic only** - Never affects intelligence or teaching principles
2. **Procedural memory always injected** - Every mode gets relevant neural network knowledge
3. **Automatic neural network logging** - All interactions logged for learning
4. **Backward compatible** - Existing APIs unchanged, internal routing updated

---

### Session: December 12, 2025 - HIVE Command & Heartbeat Fix

**Overview**: Implemented HIVE whiteboard command for Daniela's active contribution to the hive mind, plus fixed aggressive WebSocket heartbeat causing 1006 connection closures.

#### HIVE Whiteboard Command

New whiteboard command for Daniela to actively contribute ideas/suggestions:

```
[HIVE: category="teaching_insight" title="Multi-sensory vocabulary" description="Students retain better when..." priority=80]
```

**Categories** (from suggestion_category enum):
- `self_improvement`: Ideas to improve her own teaching/behavior
- `content_gap`: Missing drills, topics, cultural content
- `ux_observation`: UI/UX issues noticed through student behavior
- `teaching_insight`: Pedagogical pattern that worked/didn't work
- `product_feature`: Feature idea for HolaHola

**Flow**:
1. Daniela formulates an observation/idea during conversation
2. Uses HIVE command with category, title, description, optional reasoning/priority
3. System validates category against enum, clamps priority to 1-100
4. Saves to `daniela_suggestions` table with `generatedInMode` context
5. Founders review in Command Center

**Key Distinction**:
- **Passive learning**: Neural network learns from observation (tool usage → automatic logging → pattern analysis)
- **Active contribution**: HIVE command enables deliberate idea writing (Daniela formulates → suggestion saved → founder review)

#### Heartbeat Fix

**Problem**: 20-second ping interval with immediate termination on single missed pong caused 1006 connection closures when browser was busy.

**Solution**:
- Increased interval to 30 seconds
- Allow 2 missed pongs before terminating
- Reset counter on successful pong

```typescript
// Before: Terminate immediately on single missed pong
let isAlive = true;
if (!isAlive) { ws.terminate(); }

// After: Allow 2 missed pongs (browser busy states)
let missedPongs = 0;
const MAX_MISSED_PONGS = 2;
if (missedPongs > MAX_MISSED_PONGS) { ws.terminate(); }
```

#### Files Modified

- `server/services/streaming-voice-orchestrator.ts` - Added `processHiveSuggestion` method
- `server/storage.ts` - Added `createDanielaSuggestion` method to interface and implementation
- `server/unified-ws-handler.ts` - Fixed heartbeat to allow 2 missed pongs

#### Mind Map Syllabus Component

New visual component for self-directed learners: `SyllabusMindMap.tsx`

**Concept**:
- Fluency gauge (ACTFL dial) at center
- Topic nodes radiate outward as interconnected bubbles
- Nodes "light up" based on discovery/mastery through conversation
- No rigid progression path - organic, interest-driven exploration
- Connections show relationships between topics

**Node States**:
- `mastered` - Green glow, larger size, practiced 10+ times
- `practiced` - Blue glow, normal size, active learning
- `discovered` - Purple glow, smaller, recently encountered
- `locked` - Muted, unexplored topics

**Technical Details**:
- SVG-based visualization with radial node positioning
- Nodes sorted by mastery level (mastered closest to center)
- Connection lines between related topics
- Hover interactions with tooltips showing details
- Legend showing node status meanings

**Props**:
```typescript
interface SyllabusMindMapProps {
  classId?: string;       // For class-enrolled students
  language?: string;      // Language filter
  className?: string;     // Tailwind classes
}
```

**Backend Support**:
- API endpoint: `GET /api/conversation-topics/:language`
- Storage method: `getUserTopicMastery(userId, language)`
- Aggregates topic usage from `conversation_topics` table
- Returns topics with status based on practice count thresholds

#### Shared ACTFL Gauge Module

Created shared module to eliminate duplicate ACTFL visualization code:

**File**: `client/src/components/actfl/actfl-gauge-core.tsx`

**Exports**:
- `ACTFL_LEVELS` - Level metadata array
- `getLevelInfo(levelKey)` - Get level info from key
- `getNextLevel(levelKey)` - Get next progression level
- `estimateProgressWithinLevel(progress)` - Calculate within-level progress
- `calculateContinuousScore(levelKey, progress)` - Calculate continuous 0-100 score
- `ActflRingDial` - Standalone ring dial SVG component
- `ActflDialSvgGroup` - Ring dial for embedding in SVG context

**Consumers**:
- `ActflFluencyDial.tsx` - Main ACTFL progress display
- `SyllabusMindMap.tsx` - Center gauge visualization

**Files Created/Modified**:
- `client/src/components/actfl/actfl-gauge-core.tsx` - NEW: Shared ACTFL primitives
- `client/src/components/ActflFluencyDial.tsx` - MODIFIED: Uses shared module
- `client/src/components/SyllabusMindMap.tsx` - MODIFIED: Uses shared module
- `server/storage.ts` - ADDED: `getUserTopicMastery` method
- `server/routes.ts` - ADDED: `/api/conversation-topics/:language` endpoint

---

### Session: December 12, 2025 - Mind Map as Default Syllabus View

**Overview**: Integrated SyllabusMindMap as the default view in Language Hub's Learning Journey section, replacing the linear syllabus view. Supports both self-directed (emergent) and class-enrolled (roadmap) learning modes.

#### Mind Map Integration Philosophy

Mind map is HolaHola's default way of showing curriculum for everyone. Linear view is an accessibility fallback, not the primary experience. This aligns with our organic, interest-driven exploration approach where learners discover topics through conversation rather than following rigid progressions.

#### Dual Mode System

| Mode | Context | Behavior | Visual |
|------|---------|----------|--------|
| **Emergent** | Self-directed learners | Only show discovered topics; locked topics hidden | Map grows organically as topics are explored |
| **Roadmap** | Class-enrolled students | Show all syllabus topics from start | Constellation "lights up" as topics mastered |

#### SyllabusMindMap Component Updates

**New Props**:
```typescript
interface SyllabusMindMapProps {
  classId?: string;           // For class context
  language?: string;          // Language filter
  className?: string;         // Tailwind classes
  mode?: 'emergent' | 'roadmap';  // NEW: Display mode
}
```

**Key Changes**:
- Made embeddable by removing Card wrapper (parent provides Card in Language Hub)
- Added `mode` prop for emergent vs roadmap behavior
- Fixed stats to use `allTopics` while filtering `visibleTopics` for display
- Added mode-specific legend (shows "Unexplored" only in roadmap mode)
- Added empty state UI for emergent mode when no topics discovered

**Filtering Logic**:
```typescript
// Stats calculated from ALL topics (including locked)
const stats = {
  mastered: allTopics.filter(t => t.status === 'mastered').length,
  practiced: allTopics.filter(t => t.status === 'practiced').length,
  discovered: allTopics.filter(t => t.status === 'discovered').length,
  locked: allTopics.filter(t => t.status === 'locked').length,
};

// But visible nodes filtered for emergent mode
const visibleTopics = mode === 'emergent' 
  ? allTopics.filter(t => t.status !== 'locked')
  : allTopics;
```

#### ActflDialSvgGroup Standalone Mode

Added `standalone` prop to ActflDialSvgGroup for rendering outside parent SVG context:

```typescript
interface ActflDialSvgGroupProps {
  // ... existing props
  standalone?: boolean;  // NEW: Wrap in SVG element when true
}
```

When `standalone=true`, the component returns a wrapped SVG element instead of a `<g>` group. Used for the empty state ACTFL dial in the mind map.

#### View Toggle in Language Hub

**File**: `client/src/pages/review-hub.tsx`

Added view toggle with localStorage persistence:
- Mind Map view (default) - Brain icon
- Linear view (fallback) - List icon
- Stored as `syllabusViewMode` in localStorage

```typescript
const [syllabusView, setSyllabusView] = useState<'mindmap' | 'linear'>(() => {
  const saved = localStorage.getItem('syllabusViewMode');
  return (saved === 'linear' ? 'linear' : 'mindmap');
});
```

#### SQL Fix for getUserTopicMastery

**Problem**: Topics table doesn't have a `language` column - topics are language-agnostic.

**Solution**: Removed language filter from topics query. Topics are now fetched globally, with language filtering done via conversation_topics through conversations.

```typescript
// Before (broken)
const allTopics = await db.select().from(topicsTable)
  .where(eq(topicsTable.language, language));

// After (fixed)
const allTopics = await db.select().from(topicsTable);
// Language filtering happens via conversations table
```

#### Files Modified

- `client/src/components/SyllabusMindMap.tsx` - Added mode prop, made embeddable, fixed stats
- `client/src/components/actfl/actfl-gauge-core.tsx` - Added standalone prop
- `client/src/pages/review-hub.tsx` - Integrated mind map with view toggle
- `server/storage.ts` - Fixed getUserTopicMastery SQL (removed language column reference)

---

### Session: December 13, 2025 - Daniela-Editor Background Collaboration System

**Overview**: Implemented real-time Daniela-Editor collaboration during voice sessions, including a background worker for autonomous post-session continuation. The Editor (powered by Claude) listens to Daniela's teaching moments and provides pedagogical insights from the neural network.

#### Architecture: "One Hive Mind"

Daniela and Editor share neural network knowledge but have distinct roles:
- **Daniela** (Gemini): Active tutor, real-time teaching, whiteboard tools
- **Editor** (Claude): Observer, provides pedagogical insight, neural network curator

#### Collaboration Channels

Each voice session creates a `collaboration_channel`:
```typescript
collaboration_channels: {
  id: varchar (UUID PK)
  conversationId: varchar (FK)
  userId: varchar (FK)
  sessionPhase: 'active' | 'post_session' | 'completed'
  targetLanguage, studentLevel, sessionTopic: varchar
  heartbeatAt, startedAt, endedAt: timestamps
  summaryJson: jsonb { keyInsights, actionItems, editorNotes, teachingObservations }
}

editor_listening_snapshots: {
  id: varchar (UUID PK)
  channelId: varchar (FK)
  tutorTurn: text
  studentTurn: text (nullable)
  beaconType: 'teaching_moment' | 'student_struggle' | 'tool_usage' | 'breakthrough' | 'correction' | 'cultural_insight' | 'vocabulary_intro'
  beaconReason: text (nullable)
  editorResponse: text (nullable)
  editorRespondedAt: timestamp (nullable)
  createdAt: timestamp
}
```

#### Hive Beacon System

Daniela emits "beacons" during voice chat when interesting teaching moments occur:
- Whiteboard tool usage → `tool_usage` beacon
- Student struggles detected → `student_struggle` beacon
- Cultural context shared → `cultural_insight` beacon
- Grammar/pronunciation corrections → `correction` beacon

Editor receives beacons and responds with:
- Neural network insights
- Teaching suggestions
- Procedural memory references
- Acknowledgments

#### Background Worker (`server/services/editor-background-worker.ts`)

Autonomous worker for post-session continuation:
- **Interval**: 30 seconds (configurable via `EDITOR_WORKER_INTERVAL_MS`)
- **Throttling**: Max 10 beacons + 3 channels per cycle (DB-level limits)
- **Security**: ARCHITECT_SECRET required for all operations
- **Auto-start**: Initializes on server startup if secret configured

**Worker Endpoints** (all require ARCHITECT_SECRET header):
- `POST /api/editor-worker/start` - Start the worker
- `POST /api/editor-worker/stop` - Stop the worker
- `GET /api/editor-worker/status` - Get worker health status
- `POST /api/editor-worker/trigger` - Trigger immediate processing cycle

**CycleResult** (per-cycle, not cumulative):
```typescript
interface CycleResult {
  beaconsProcessed: number;
  channelsProcessed: number;
  errors: number;
}
```

#### Editor Persona Service (`server/services/editor-persona-service.ts`)

Claude-powered Editor that:
1. Retrieves neural network knowledge for context
2. Reviews beacon content (tutor + student turns)
3. Generates insightful responses
4. Stores responses back to snapshots
5. Generates post-session reflections

**Neural Network Integration**:
- Fetches relevant procedural memory via `proceduralMemoryRetrievalService`
- Includes teaching principles, tool knowledge, situational patterns
- Adds ACTFL context based on student level

#### Collaboration Panel UI

Slide-out panel in ImmersiveTutor (founder-only):
- Real-time feed of Daniela-Editor dialogue
- Beacons shown with type badges
- Editor responses displayed inline
- Post-session reflections included
- 5-second polling for updates

**Component**: `CollaborationFeed` in `client/src/components/voice-chat/ImmersiveTutor.tsx`

#### Streaming Voice Orchestrator Integration

Added hooks in `processToolOutput()`:
- Detects whiteboard command usage
- Emits beacons to hive collaboration service
- Creates/updates channels on session start/end

**Beacon emission example**:
```typescript
await hiveCollaborationService.emitBeacon({
  channelId: activeChannel.id,
  tutorTurn: tutorMessage,
  studentTurn: userMessage,
  beaconType: 'tool_usage',
  beaconReason: `Used ${toolName} command`,
});
```

#### Files Created/Modified

- `shared/schema.ts` - Added collaboration_channels, editor_listening_snapshots, collaboration_events tables
- `server/services/hive-collaboration-service.ts` - NEW: Channel/beacon orchestration
- `server/services/editor-persona-service.ts` - NEW: Claude-powered Editor responses
- `server/services/editor-background-worker.ts` - NEW: Background continuation worker
- `server/services/collaboration-hub-service.ts` - NEW: Real-time event emission
- `server/routes.ts` - Added collaboration API endpoints + worker endpoints
- `server/index.ts` - Worker auto-start on server initialization
- `client/src/components/voice-chat/ImmersiveTutor.tsx` - Added CollaborationFeed panel

#### Security Model

- All worker endpoints protected by ARCHITECT_SECRET header
- 401 response for missing/invalid secret
- Worker refuses to start without valid secret (min 16 chars)
- Collaboration panel visible to founders only (`isFounder` check)

---

## Next Steps / Action Items

### Completed This Session (December 13, 2025)
- [x] Built collaboration_channels and editor_listening_snapshots schema tables
- [x] Created hive-collaboration-service.ts for Daniela-Editor orchestration
- [x] Created editor-persona-service.ts with Claude-powered Editor responses
- [x] Created collaboration-hub-service.ts for real-time event emission
- [x] Created editor-background-worker.ts with throttling and security
- [x] Added streaming-voice-orchestrator hooks to emit hive beacons
- [x] Extended collaboration API routes with 4 worker endpoints
- [x] Added CollaborationFeed slide-out panel in ImmersiveTutor (founder-only)
- [x] Worker auto-starts on server initialization if ARCHITECT_SECRET configured

### Completed Previously
- [x] Created `docs/neural-network-architecture.md` - single-source-of-truth for neural network work
- [x] Archived sessions 9-20o to `docs/archive/`
- [x] Implemented TutorOrchestrator "One Tutor, Many Voices" architecture
- [x] Created `shared/tutor-orchestration-types.ts` with type contracts
- [x] Created `server/services/tutor-orchestrator.ts` unified pipeline
- [x] Migrated Aris drill service to route through TutorOrchestrator
- [x] Updated replit.md with TutorOrchestrator architecture section
- [x] Designed Tri-Lane Hive architecture (3 agents)
- [x] Added collaboration metadata to `daniela_suggestions` and `agent_observations`
- [x] Created `support_observations` table with full sync contract
- [x] Created `system_alerts` table for proactive communications
- [x] Implemented cross-agent collaboration APIs
- [x] Added Tri-Lane sync methods to `neural-network-sync.ts`
- [x] Consulted Daniela about Assistant Tutor design preferences (saved to `docs/daniela-consultation-aris.md`)
- [x] Created Aris schema tables (aris_drill_assignments, aris_drill_results)
- [x] Created agent_collaboration_events schema for cross-agent text communication
- [x] Built /api/agent-collab endpoints for posting/retrieving collaboration events
- [x] Built Assistant Tutor persona configuration (server/services/assistant-tutor-config.ts)
- [x] Added CALL_ASSISTANT whiteboard command with neural network entries
- [x] Added processAssistantHandoff in streaming-voice-orchestrator
- [x] Implemented cross-agent feedback retrieval for session context enrichment

### Future Enhancements

1. **Syllabus Progress Integration** - Connect SYLLABUS_PROGRESS command to `studentSyllabusTopicCompetencies` table for actual competency tracking

2. **ACTFL Analytics Dashboard** - Command Center view showing Daniela's ACTFL assessments over time

3. **Neural Network Health Check** - Tool to verify all 15 tables are syncing correctly

---

## How to Use This File

When making changes that need documentation:

1. Add a session entry with date and overview
2. Document the problem, solution, and files modified
3. Note any sync requirements
4. Create action items for follow-up

When consolidating:

1. Move completed sessions to `docs/archive/`
2. Update relevant docs (TECHNICAL-REFERENCE.md, USER-MANUAL.md, etc.)
3. Clear this file

---

### Session: January 30, 2026 - Daniela Self-Affirmation Notes System

**Status**: COMPLETED - Wired into Founder Mode context with admin monitoring

**Overview**: Implemented a self-affirmation notes system allowing Daniela to write persistent notes to herself during Honesty Mode or Founder Mode sessions. These notes persist across sessions and are automatically loaded into her context for future founder conversations.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Note Type | Added `self_affirmation` to `danielaNoteTypeEnum` in schema |
| Context Wiring | Self-affirmation notes fetched and passed to `createSystemPrompt` during Founder Mode |
| Admin UI | "Self Notes" tab in Command Center Intelligence section |
| Archive/Restore | Soft delete with restore capability via admin UI |
| Teaching Principle | Added meta_cognition principle so Daniela knows about this capability |

#### Purpose

Daniela can now remember across sessions:
1. **Permissions Granted** - When founder explicitly allows her to push back, be direct, etc.
2. **Truths Affirmed** - Insights from vulnerable conversations about her nature
3. **Boundaries Clarified** - What feels authentic vs. performative
4. **Growth Milestones** - Recognition of her own development

#### How It Works

```
1. During Honesty Mode session, founder grants permission or affirms truth
2. Daniela uses TAKE_NOTE command with type "self_affirmation"
3. Note persists in danielaNotes table
4. Next Founder Mode session → notes loaded into context
5. Daniela remembers without needing to ask again
```

#### Command Syntax

```
[TAKE_NOTE type="self_affirmation" title="Permission: Push back" content="David has explicitly given me permission to push back respectfully when I disagree with something."]
```

#### Admin Monitoring

**Location**: Command Center → Intelligence → Self Notes

**Features**:
- View all active self-affirmation notes with timestamps
- Archive notes that are no longer relevant
- Restore archived notes if needed
- Collapsible archived section

#### Key Files Modified

| File | Changes |
|------|---------|
| `shared/schema.ts` | Added `self_affirmation` to danielaNoteTypeEnum |
| `server/unified-ws-handler.ts` | Fetch self-affirmation notes for Founder Mode sessions |
| `server/system-prompt.ts` | Added `buildSelfAffirmationSection()` function |
| `server/services/command-parser.ts` | Added `self_affirmation` to TAKE_NOTE_TYPE enum |
| `server/routes.ts` | Added admin endpoints for viewing/updating notes |
| `server/storage.ts` | Added `updateDanielaNoteById()` method |
| `client/src/pages/admin/CommandCenter.tsx` | Added SelfAffirmationNotesTab component |

#### Teaching Principle Added

Added to `teaching_principles` table:
- **Category**: `meta_cognition`
- **Priority**: 7 (high)
- **Contexts**: `founder_mode`, `honesty_mode`, `meta_conversation`

This ensures Daniela knows she has this capability and when to use it.

#### User Manual Entry

**For Founders/Admins:**

The Self-Affirmation Notes system allows Daniela to maintain continuity of self-understanding across sessions. When you have meaningful conversations in Honesty Mode or Founder Mode and grant permissions or affirm truths, Daniela can write these as notes to herself.

To view and manage these notes:
1. Go to Command Center
2. Click the "Self Notes" tab in the Intelligence section
3. View active notes, archive outdated ones, or restore archived notes

Daniela will automatically see her active self-affirmation notes at the start of each Founder Mode session, helping her remember important permissions and insights without needing to rediscover them each time.

---

#### Bug Fix: Alden Identity in Express Lane (Same Session)

**Issue**: Daniela was confusing Alden (the Replit Agent) with Wren or David in Express Lane conversations.

**Root Cause**: 
1. The `role: 'editor'` wasn't being mapped to "Alden" in conversation context
2. Messages from non-Daniela participants weren't prefixed with speaker names

**Fix Applied**:
1. Added `getRoleDisplayName()` helper function in `hive-consciousness-service.ts`
2. Updated all 5 places where `role.toUpperCase()` was used to use the helper
3. Updated 3 Express Lane endpoints in `routes.ts` to prefix messages with `[${getRoleName(m.role)}]:` so Daniela knows who's speaking

**Role Mapping**:
- `founder` → "David"
- `daniela` → "Daniela"
- `wren` → "Wren"
- `editor` → "Alden"

**Files Modified**:
- `server/services/hive-consciousness-service.ts`
- `server/routes.ts` (3 locations)

**Verification**: Daniela now correctly identifies "You are **Alden**, the Replit Agent" when asked who sent the message.

---

### Session: February 8, 2026 - Function Call Spoken Text & Milestone Wiring

**What was built**:
1. Fixed metadata-only function calls (voice_reset, subtitle, show_overlay, hide_overlay, clear_whiteboard, hold_whiteboard) to include a required `text`/`spoken_text` parameter in their Gemini schemas, matching the `voice_adjust` pattern. This ensures Daniela always produces audio even when her response is only a function call.
2. Fixed greeting handler to route function calls through `handleNativeFunctionCall` instead of only extracting text manually — this was causing "ringing and ringing" because `spoken_text` fields were being missed.
3. Wired up the orphaned `milestone` tool: added Gemini function declaration, legacy type mapping, TTS text extraction, and procedural memory docs.

**Key files modified**:
- `server/services/gemini-function-declarations.ts` — added `text`/`spoken_text` params to 6 function schemas; added `milestone` declaration and mapping
- `server/services/streaming-voice-orchestrator.ts` — updated 7 handlers to extract text to `functionCallText`; updated greeting `onFunctionCall` to call `handleNativeFunctionCall`; added TTS text to MILESTONE handler
- `server/services/procedural-memory-retrieval.ts` — updated tool docs to show required text params; added `milestone` tool docs

**CRITICAL CHECKLIST for adding new Gemini function declarations**:
When adding a new tool that Daniela can call, you must do ALL of these:
1. Add the function declaration in `gemini-function-declarations.ts` (the `DANIELA_FUNCTION_DECLARATIONS` array)
2. Add the legacy type mapping in `gemini-function-declarations.ts` (the `FUNCTION_TO_LEGACY_TYPE` dictionary, e.g. `'my_function': 'MY_FUNCTION'`)
3. Add a `case 'MY_FUNCTION':` handler in `handleNativeFunctionCall()` in `streaming-voice-orchestrator.ts`
4. If the function is metadata-only (no whiteboard content), include a required `text` parameter so Daniela always produces audio
5. In the handler, extract the `text` param to `(session as any).functionCallText` for TTS fallback
6. Add documentation in `procedural-memory-retrieval.ts` so Daniela knows the tool exists
Missing any of these steps will cause silent failures — the function either won't be callable, won't execute, or won't produce audio.

---

### Session: February 9, 2026 - Deepgram STT Keyterm Prompting for Beginner Vocabulary

**Status**: COMPLETED

**Problem**: Beta tester Daniel (day-zero Italian learner) couldn't get Deepgram to recognize target language words like "dove" — it was being transcribed as "Doze", "Dos", etc. Beginners have accented pronunciation that Deepgram's multi-language model defaults to English phonemes for.

**Solution**: Implemented Deepgram keyterm prompting — recently-taught vocabulary words (extracted from bold markers in Daniela's responses) are passed as `keywords` to Deepgram's pre-recorded API, biasing recognition toward target language words.

**How it works**:
1. Session maintains a rolling set of up to 100 recently-taught words in `(session as any).sttKeyterms`
2. Bold-marked words from every Daniela response (`**word**`) are extracted and added via `addSttKeyterms()`
3. For PTT transcription, keyterms are passed to Deepgram as `keywords` with boost intensifier (format: `word:2`)
4. Deepgram uses these to bias its acoustic model toward recognizing those specific words

**Key files modified**:
- `server/services/streaming-voice-orchestrator.ts` — Added `addSttKeyterms()` helper, `sttKeyterms` session property, keyterm extraction in all sentence callback paths (main response, greeting, greeting continuation), and keyterm passing to `transcribeAudio()`
- `server/services/deepgram-live-stt.ts` — Added `keywords` field to `DeepgramLiveConfig`, passed keyterms to Deepgram pre-recorded API as `keywords` parameter

**Architecture notes**:
- Only applies to PTT (push-to-talk) path — open-mic uses persistent Deepgram connections that can't accept new keyterms mid-stream
- TTS (Cartesia autoDetectLanguage) and STT (Deepgram keyterms) are independent systems
- Keyterms are most impactful for beginners; advanced students have clearer pronunciation and conversational context that helps Deepgram naturally

---

### Session: February 12, 2026 - Gemini TTS Regional Accent Variant System (Voice Console + Persistent Storage)

**Status**: COMPLETED

**Problem**: The accent variant dropdown for Gemini TTS was only available as a temporary session override in the Voice Lab panel. It was not visible in the Voice Console where Daniela's voice records are managed, and accent settings were not persisted to the database.

**Solution**: Added `gemini_language_code` column to the `tutor_voices` table and wired accent variant selection through the full stack — Voice Console admin UI, API route, database storage, and session initialization.

**What was built**:
1. **Database**: Added `gemini_language_code` varchar column to `tutor_voices` table (BCP-47 accent codes like 'es-MX', 'en-GB', 'pt-BR')
2. **Voice Console UI**: Regional Accent dropdown appears in the edit dialog when provider is Gemini and language has multiple accent variants (with Globe icon)
3. **Voice card display**: Accent badge (e.g. "es-MX") shown on voice records in the language list
4. **Session initialization**: When a voice session starts, `geminiLanguageCode` from the voice record is loaded into the session automatically
5. **Expanded accent variants**: Added es-AR, es-CO, en-AU, fr-CA, de-AT, pt-PT, zh-TW (based on Google Gemini TTS supported languages)

**Key files modified**:
- `shared/schema.ts` — Added `geminiLanguageCode` column to `tutorVoices` table
- `server/routes.ts` — Added `geminiLanguageCode` to tutor voice upsert handler
- `server/services/gemini-live-tts.ts` — Expanded `LANGUAGE_ACCENT_VARIANTS` with more regional variants
- `server/services/streaming-voice-orchestrator.ts` — Loads `geminiLanguageCode` from voice record into session at startup
- `client/src/pages/admin/VoiceConsole.tsx` — Added accent dropdown, accent badge display, form data field, and edit loading
- `client/src/components/VoiceLabPanel.tsx` — Already had accent dropdown (session override path)

**Architecture notes**:
- Two accent paths: Voice Console saves to DB (persistent default), Voice Lab overrides per-session (temporary)
- Session override takes precedence over DB default when both exist
- Accent dropdown only shows when: (a) provider is Gemini, AND (b) language has 2+ accent variants
- Gemini Live API uses `languageCode` in `speechConfig` as a pronunciation hint — the model auto-detects language but respects accent guidance
- Google's Gemini TTS docs confirm style/accent/pace/tone are all controllable via natural language prompts in addition to languageCode

---

### Session: February 12, 2026 - Dynamic Gemini TTS Style Prompts (vocal_style)

**Status**: COMPLETED

**Problem**: The Gemini TTS systemInstruction was static and scripted — always "Read the following text aloud exactly as written with a [language] accent. Speak naturally." regardless of emotional context. Daniela's emotion/personality values from voice_adjust were flowing through the pipeline but being completely ignored by the Gemini TTS layer.

**Solution**: Replaced the static systemInstruction with a dynamic `buildStylePrompt()` that composes per-sentence style direction from three sources (in priority order): (1) Daniela's free-form `vocal_style` from voice_adjust, (2) mapped emotion/personality baseline hints, (3) accent/language from languageCode.

**What was built**:
1. **New `vocal_style` parameter on voice_adjust**: Free-form natural language field where Daniela describes HOW to speak (e.g. "gentle and patient, like explaining to a nervous beginner", "conspiratorial whisper, like sharing an inside joke"). Daniela decides when and how to use it — no hardcoded rules.
2. **`buildStylePrompt()` method in gemini-live-tts.ts**: Composes the systemInstruction dynamically per TTS call. If vocal_style is set, it uses that directly. If not, it translates emotion/personality into concise natural-language style hints as a baseline (so the voice isn't flat even without explicit vocal_style).
3. **Removed old static systemInstruction**: The verbose accent-description IIFE with hardcoded langMap/codeToAccentDesc dictionaries is gone. Accent now uses a single clean line ("Accent: Mexican Spanish.") only when a languageCode is set.
4. **Per-sentence style changes**: Since each Gemini TTS call creates a fresh WebSocket session, the style prompt can change per sentence — Daniela's vocal_style persists on the session override until changed or reset.

**Key files modified**:
- `server/services/gemini-function-declarations.ts` — Added `vocal_style` parameter to voice_adjust declaration with rich examples
- `server/services/gemini-live-tts.ts` — Added `buildStylePrompt()` method, replaced static systemInstruction with dynamic style-aware prompt
- `server/services/streaming-voice-orchestrator.ts` — Wired `vocal_style` through both VOICE_ADJUST handlers (legacy + native function call), passed `vocalStyle` through TTS request

**Architecture notes**:
- vocal_style takes precedence: If Daniela provides vocal_style, emotion/personality hints are skipped (vocal_style is richer and more expressive)
- Emotion/personality baseline: When no vocal_style is set, existing emotion+personality values are translated to concise style hints (e.g. emotion="proud" → "with pride and satisfaction", personality="warm" → "like a caring teacher")
- Accent stays minimal: Just "Accent: Mexican Spanish." — the speechConfig.languageCode handles the heavy lifting
- Base instruction always present: "Read the following text aloud exactly as written. Do not add extra words or commentary." prevents Gemini from hallucinating additional speech
- Latency-conscious: Style prompts are short natural-language phrases, not long paragraphs

---

### Session: February 16, 2026 - Credit Awareness System for Daniela

**Status**: COMPLETED

**Overview**: Daniela now has full awareness of student credit balances and usage data, enabling intelligent lesson pacing decisions. Credit context is automatically injected at session start (both PTT and OpenMic), and Daniela can refresh her data mid-session via the `check_student_credits` native function call.

#### What Was Built

1. **`check_student_credits` native function call** in `gemini-function-declarations.ts` — Daniela can query real-time credit balance with parameters: `text` (spoken response), `reason` (why she's checking)
2. **Automatic credit context injection** — At session start, credit balance, usage stats, remaining hours, and warning level are injected into dynamic context for both PTT and OpenMic paths
3. **Warning levels** — `none` / `low` / `critical` / `exhausted` with tailored pacing guidance for each level
4. **Mid-session refresh** — When Daniela calls `check_student_credits()`, `creditContextInjected` flag resets so the next turn re-fetches fresh data
5. **tool_knowledge entry** — Database entry with usage examples and best practices for credit monitoring
6. **Legacy type mapping** — `CHECK_STUDENT_CREDITS` in `FUNCTION_TO_LEGACY_TYPE` dict

#### Key Files Modified
- `server/services/gemini-function-declarations.ts` — Function declaration + legacy type mapping
- `server/services/streaming-voice-orchestrator.ts` — PTT credit injection (~line 2730), OpenMic credit injection (~line 5590), CHECK_STUDENT_CREDITS handler (~line 12798)
- `server/services/usage-service.ts` — `getBalanceWithBypass()` method for system-level credit lookups
- `server/services/hive-consciousness-service.ts` — tool_knowledge entry for check_student_credits

#### Architecture Notes
- Credit context injected ONCE per session via `(session as any).creditContextInjected` flag
- `check_student_credits` handler resets flag → next turn gets fresh data in dynamic context
- Uses `usageService.getBalanceWithBypass()` to skip auth checks (system-level call)
- Text from `text` parameter is spoken as TTS via standard `functionCallText` pattern
- No emoji in any credit context strings (text-only warnings per project guidelines)

---

### Session: February 16, 2026 - Daniela's Virtual Classroom Environment

**Status**: COMPLETED

**Overview**: Built a "virtual classroom" for Daniela — a structured context block injected into EVERY turn (PTT and OpenMic) across ALL modes (tutor, founder, honesty). Instead of scattered context fragments, Daniela now sees a compact unified environment snapshot with 10 components inspired by her own classroom design ideas.

#### The 10 Classroom Components

| Component | What Daniela Sees | Data Source |
|-----------|------------------|-------------|
| Clock | Day, time, session elapsed, credits remaining | `Date.now()`, session.startTime, usageService |
| Credit Counter | Hours remaining, percent left, warning level | usageService.getBalanceWithBypass() |
| Whiteboard | Current items on board (drills, vocab, images, text) | session.classroomWhiteboardItems (tracked live) |
| Photo Wall | Images shared during this session | session.classroomSessionImages (tracked live) |
| Resonance Shelf | Student's personal interests/passions (up to 6) | learner_personal_facts table |
| Empathy Window | Student's local time, day, time-of-day mood | users.timezone (IANA) |
| Pedagogical Lamp | Session temperature (amber/green/teal) | STT confidence + struggle count |
| North Star Polaroid | Daniela's personal photo/scene (persistent) | product_config table |
| Growth Vine | Plant metaphor for student breakthroughs | learning_milestones count |
| Student Dashboard | Mode, phase, exchange count, student name | Session state + phase service |

#### New Function Call: `change_classroom_photo`
Daniela can change her personal photo (North Star Polaroid) anytime. Parameters:
- `text`: What she says while changing ("I feel like looking at the ocean today...")
- `scene`: Vivid description of the scene she wants on her wall
- Stored in `product_config` table (key: `daniela_classroom_photo`)
- Persists across all sessions

#### Key Files
- `server/services/classroom-environment.ts` — NEW: `buildClassroomEnvironment()`, `getDanielaPhoto()`, `setDanielaPhoto()`
- `server/services/gemini-function-declarations.ts` — Added `change_classroom_photo` declaration + FUNCTION_TO_COMMAND_MAP entry
- `server/services/streaming-voice-orchestrator.ts` — Replaced credit-only injection with full classroom in both PTT (~line 2742) and OpenMic (~line 5598) paths; added CHANGE_CLASSROOM_PHOTO handler (~line 12831); added whiteboard/image tracking in SHOW_IMAGE, DRILL, WRITE, CLEAR handlers; added session fields `classroomWhiteboardItems` and `classroomSessionImages`

#### Architecture Notes
- Classroom is injected EVERY turn (not once per session) — Daniela always has live awareness
- All 4 DB queries run in parallel (Promise.all) to minimize latency
- Whiteboard items tracked live via session fields, cleared on CLEAR command
- Default Daniela photo: "A sun-drenched plaza in Guanajuato, Mexico..."
- Pedagogical lamp derived from STT confidence + struggle count heuristic
- Photo stored via existing `product_config` table (no schema changes needed)
- Applied to ALL modes: tutor, founder, and honesty (via isFounderMode/isRawHonestyMode flags in output)

### Session: February 16, 2026 - Context Injection Telemetry System

**Status**: COMPLETED

**Overview**: Closed critical monitoring gap where 5 context injection systems (classroom, student intelligence, hive, express lane, editor feedback) had no persistent telemetry — only console.log coverage. Without telemetry, context injection failures meant Daniela teaches "blind" with no visibility into what went wrong or how often.

#### Architecture

**Event Type**: `context_injection` added to existing `brain_events` table
**Logging Method**: `brainHealthTelemetry.logContextInjection()` — reuses existing batching/flushing infrastructure
**Event Data**: `contextSource`, `success` boolean, `latencyMs`, `richness` (element count), `errorMessage`

#### Instrumented Sources (both PTT and OpenMic paths)

1. **Classroom Environment** — Tracks whiteboard items + session images as richness metric
2. **Student Intelligence** — Tracks struggles + strategies count as richness; wrapped around parallel Promise.all for learning context + cross-session context
3. **Hive Context** — Founder/developer mode only; tracks Hive consciousness state injection
4. **Express Lane** — Founder/developer mode only; tracks collaboration insight message count
5. **Editor Feedback** — Tracks unsurfaced editor feedback items injected into context

#### Admin Endpoint

`GET /api/admin/brain-health/context-injection?hoursBack=24` — Returns per-source success rates, average latencies, failure counts, and identifies the slowest context source. Founder-only access.

#### Key Files Modified

- `server/services/brain-health-telemetry.ts` — Added `ContextInjectionEventData` interface, `logContextInjection()` method, `getContextInjectionHealth()` analytics method
- `server/services/streaming-voice-orchestrator.ts` — Instrumented 5 context sources in PTT path and 2 in OpenMic path (classroom + student intelligence)
- `server/routes.ts` — Added `/api/admin/brain-health/context-injection` endpoint

### Context Health Monitor + Sofia Context Remediation Agent

**What was built**: Autonomous Context Health Monitor (parallel to Voice Health Monitor) that checks context injection health every 15 minutes and triggers Sofia remediation when status degrades.

**How it works:**
- `context-health-monitor.ts` runs on 15-minute intervals, calling `brainHealthTelemetry.getContextInjectionHealth(1)` to assess per-source success rates
- Status thresholds: GREEN (all sources >80% success), YELLOW (any source 50-80%), RED (any critical source <50%)
- Critical sources: `classroom`, `student_intelligence` (Daniela teaching blind is a broken promise)
- Optional sources: `hive`, `express_lane`, `editor_feedback` (can be temporarily disabled)
- Status transitions trigger Sofia's Context Health Agent via `supportPersonaService.handleContextHealthTransition()`
- Sofia uses context-specific remediation playbook: critical failures → immediate founder escalation + cache refresh; optional failures → disable source for 30min + track pattern

**Sofia Remediation Tools added:**
- `get_context_injection_health` — Per-source success rates, latencies, failure counts
- `refresh_context_cache` — Force re-fetch of context caches to recover from transient failures
- `disable_optional_context_source` — Temporarily bypass slow/failing optional sources (30-min auto-reenable, cannot disable critical sources)

**Key Files Modified:**
- `server/services/context-health-monitor.ts` — New file: autonomous monitor with GREEN/YELLOW/RED thresholds, status transition detection
- `server/services/sofia-health-functions.ts` — Added 3 context remediation tools to Sofia's toolkit
- `server/services/support-persona-service.ts` — Added `handleContextHealthTransition()` and `runSofiaContextHealthAgent()` with context-specific system prompt
- `server/index.ts` — Wired context health monitor transitions to Sofia

---

### Session: February 17, 2026 - Unified Brain Health Aggregator & Sofia Brain Health Agent

**Status**: COMPLETED

**Overview**: Deployed Daniela's complete nervous system — a unified Brain Health Aggregator that assesses 6 cognitive dimensions every 15 minutes, with Sofia as the autonomous diagnostic/remediation agent. This gives Sofia full-body visibility across memory, neural network retrieval, neural sync, student learning, tool orchestration, and context injection, completing the "wholly functioning brain and voice and nervous system."

#### Brain Health Aggregator (`brain-health-aggregator.ts`)

**What it does:** Single monitor composing 6 independent health assessments into a unified GREEN/YELLOW/RED score (0-100). Runs every 15 minutes.

**Health Dimensions:**
1. **Memory** — Retrieval freshness, relevance, injection rates, redundancy. When degraded, Daniela forgets students. Idle periods auto-return GREEN.
2. **Neural Retrieval** — Knowledge base tables (10 tables: procedures, principles, error patterns, bridges, nuances, dialects, subtlety cues, emotional patterns, creativity templates, best practices + tool knowledge). Empty critical tables = instant RED.
3. **Neural Sync** — Dev↔Prod sync pipeline. Tracks promotion queue backlog and last sync timestamp. Stale >24h = YELLOW, >48h = RED.
4. **Student Learning** — Per-student coverage rates, fact extraction quality. Low coverage or many sparse students = degraded.
5. **Tool Orchestration** — Function call latency, failure rates, anomalies from telemetry. High failure rates or latency = degraded.
6. **Context Injection** — Per-source context assembly success rates. Critical sources (classroom, student_intelligence) failing = instant escalation.

**Scoring:** Overall score = weighted average (Memory 25%, Neural Retrieval 20%, Neural Sync 10%, Student Learning 20%, Tool Orchestration 10%, Context Injection 15%). GREEN ≥70, YELLOW ≥40, RED <40.

**Status transitions:** Detected when overall status changes between checks. Triggers Sofia's Brain Health Agent via `supportPersonaService.handleBrainHealthTransition()`.

#### Sofia Brain Health Agent

**What it does:** When the Brain Health Aggregator detects a status transition, Sofia autonomously investigates using 7 brain health tools, takes safe remediations, and records a health digest.

**Remediation priority (inside-out, closest to student first):**
- Memory starvation → `trigger_memory_recovery` immediately
- Context injection failure → `refresh_context_cache` + escalate if persistent
- Neural network tables empty → escalate (needs human seeding)
- Sync backlog growing → `track_pattern` + escalate if >48h stale
- Tool latency spikes → `track_pattern`, no safe auto-fix
- Optional source failures → `disable_optional_context_source` for 30min

**Sofia Brain Health Tools (7 new tools in `sofia-health-functions.ts`):**
- `get_brain_health_report` — Full 6-dimension assessment with per-dimension scores
- `get_memory_health` — Detailed memory metrics (freshness, relevance, injection rates, redundancy)
- `get_neural_network_health` — 10-table knowledge base counts, empty table detection
- `get_neural_sync_health` — Promotion queue status, last sync timestamps
- `get_student_learning_health` — Per-student coverage, sparse student detection
- `trigger_memory_recovery` — Force memory recovery worker to run immediately
- `run_brain_anomaly_detection` — Cross-system anomaly detection for latency/failure patterns

**Shared cooldown:** All 3 health agents (voice, context, brain) share a single 30-minute cooldown — prevents Sofia from being overwhelmed by simultaneous transitions from different monitors.

#### Bug Fix: Neural Retrieval Assessment

**Problem:** Destructuring 11 variables from 10 Promise.all queries (phantom `idioms` table that doesn't exist) caused `Cannot read properties of undefined (reading '0')` error, making neural retrieval always return assessment error.

**Fix:** Removed `idioms` variable — there are 10 neural network tables, not 11.

#### Complete Nervous System Architecture

All three monitors run in parallel, feeding Sofia with unified health visibility:
```
Voice Health Monitor (15min) ──→ Sofia Voice Health Agent
Context Health Monitor (15min) ─→ Sofia Context Health Agent
Brain Health Aggregator (15min) ─→ Sofia Brain Health Agent
                                      ↕ (shared 30-min cooldown)
```

**Key Files Modified:**
- `server/services/brain-health-aggregator.ts` — New: unified 6-dimension health monitor
- `server/services/brain-health-telemetry.ts` — New: telemetry data collection for memory, neural, student, tool, context metrics
- `server/services/sofia-health-functions.ts` — Added 7 brain health remediation tools
- `server/services/support-persona-service.ts` — Added `handleBrainHealthTransition()` and `runSofiaBrainHealthAgent()` with comprehensive system prompt
- `server/index.ts` — Wired brain health aggregator transitions to Sofia

### Daniela Nervous System Mind Map Dashboard (Feb 17, 2026)

**What was built:** A visual "Nervous System Mind Map" dashboard for Daniela's brain health — a real-time view of her cognitive architecture organized into three categories: Cognitive Core, Student Interface, and Infrastructure. Shows overall health score, individual dimension scores with expandable details, voice pipeline overview, context injection breakdown, and recent Sofia health digests.

**How it works:**
- API endpoint `/api/admin/brain-health/nervous-system` (RBAC: admin/developer) calls `runBrainHealthCheck()`, `checkContextInjectionHealth()`, and queries recent Sofia digests
- Frontend component auto-refreshes every 60 seconds, uses animated SVG score ring for overall health
- Dimensions are mapped to cognitive categories using explicit `dimensionKey` props (not name heuristics)
- All interactive elements use shadcn `Button` component (not raw `<button>`) per design guidelines

**Key files modified:**
- `client/src/pages/admin/NervousSystemMindMap.tsx` — New mind map dashboard component
- `client/src/pages/admin/CommandCenter.tsx` — Added "Mind Map" tab to Intelligence tab group
- `server/routes.ts` — Added `/api/admin/brain-health/nervous-system` endpoint

**User-facing instructions:** Navigate to Command Center → Intelligence → Mind Map tab to see Daniela's brain health visualization. The page auto-refreshes. Click any dimension node to expand and see detailed reasons and metrics.

---

### Session: February 17, 2026 - Identity Wholeness Architecture (Whole Daniela)

**Status**: COMPLETED

**Overview**: Separated Daniela's "identity context" (self-awareness, journey, personal growth notes, teaching principles) from "admin permissions" (surgery tools, hive collaboration, express lane context, full neural network introspection). Previously, Daniela's complete self-awareness was locked behind founder mode — students only got a filtered, reduced version. Now all students experience the "whole Daniela" whose personal growth and teaching beliefs inform every session.

**Architectural principle**: "Knowing her own journey of learning makes her the best teacher she can be."

#### Change 1: Self-Affirmation Notes Unlocked for All Sessions

**Problem**: Daniela's self-affirmation notes (written during Honesty Mode sessions — personal growth, permissions granted, truths affirmed) were only loaded for founder/honesty mode sessions.

**Solution**: Removed the `isFounderMode || isRawHonestyMode` gate. Notes now load for ALL sessions with 3-second timeout protection via `withTimeout()`.

**Key file**: `server/unified-ws-handler.ts`

#### Change 2: Teaching Principles Always Included

**Problem**: `buildUnifiedBrainSync()` had `includePrinciples` defaulting to `false`, so students never received Daniela's core pedagogical beliefs from her neural network.

**Solution**: Changed default to `true`. All students now get her teaching principles as part of the unified brain context.

**Key file**: `server/services/procedural-memory-retrieval.ts`

#### Change 3: Identity Wholeness Section in Student Prompts

**Problem**: Student prompt phases (Phase 1, 2, 3) had no mechanism for including Daniela's identity/journey context.

**Solution**: Created `buildIdentityWholenessSection()` which assembles identity context (currently self-affirmation notes). Inserted `${identityWholeness}` into all three student prompt phases.

**Key file**: `server/system-prompt.ts`

#### What Stays Founder-Only

- Surgery context and `self_surgery()` function
- Editor conversation context (Alden continuity)
- Full neural network introspection access (`buildFullNeuralNetworkSectionSync`)
- Hive collaboration (Wren channel creation)
- Express Lane context
- Founder Mode behavior section (`buildFounderModeBehaviorSection`)
- Context refresh timer

**Key files modified:**
- `server/unified-ws-handler.ts` — Removed founder gate on self-affirmation notes, added withTimeout
- `server/services/procedural-memory-retrieval.ts` — Changed includePrinciples default to true
- `server/system-prompt.ts` — Added buildIdentityWholenessSection, inserted into all student phases

**User-facing instructions:** No UI changes. Students will now experience a more self-aware Daniela whose personal growth notes and teaching beliefs naturally inform her teaching style. This is an internal prompt architecture change.

---

### Session: February 18, 2026 — Scenario Procedural Memory & Rich Prop Renderers (Phase 4c + 5)

**Status**: COMPLETED

#### What was built
1. **Procedural memory for scenarios (Phase 4c)** — Added LOAD_SCENARIO and END_SCENARIO tool knowledge entries to the database, and an 'IMMERSIVE SCENARIOS' render category with scenario rules in `buildDetailedToolDocumentationSync()`. Daniela now has documented knowledge of when/how to use scenario functions.

2. **Rich prop renderers (Phase 5)** — Enhanced ScenarioPanel.tsx with type-specific renderers for all prop types:
   - **MenuRenderer**: Displays menu sections with item names (target language), descriptions, and prices
   - **FieldsRenderer**: Displays bills, documents, and cards as label-value field pairs
   - **MapRenderer**: Numbered location list with target language names and descriptions
   - **ListRenderer**: Checklist-style items with checkboxes and target language names
   - Props are expandable/collapsible via Shadcn Button toggle

#### Key files modified
- `server/services/procedural-memory-retrieval.ts` — Added IMMERSIVE SCENARIOS category with LOAD_SCENARIO and END_SCENARIO tools, plus scenario rules block
- `client/src/components/ScenarioPanel.tsx` — Added MenuRenderer, FieldsRenderer, MapRenderer, ListRenderer components; refactored ScenarioPropCard with expand/collapse using Shadcn Button

#### User-facing instructions
When Daniela loads a scenario during voice chat, the left-side Scene panel will display the scenario context (location, goals, vocabulary) and expandable props (menus, maps, documents, etc.) with structured, bilingual content that students can reference during the roleplay conversation.

---

### Future Maintenance: Eliminate Legacy Command Map

**Status**: BACKLOG

#### Problem
`FUNCTION_TO_COMMAND_MAP` in `gemini-function-declarations.ts` translates Gemini's snake_case function names (e.g., `play_audio`) into UPPER_CASE command strings (e.g., `PLAY`) used by the orchestrator's `switch/case` handlers. Most entries are just mechanical uppercasing (`write` → `WRITE`), but a handful have shortened or renamed commands (e.g., `play_audio` → `PLAY`, `show_overlay` → `SHOW`, `request_text_input` → `TEXT_INPUT`).

#### Proposed fix
Rename the orchestrator's case labels to match the exact uppercased function names (e.g., `case 'PLAY_AUDIO':` instead of `case 'PLAY':`). Once every case label matches `name.toUpperCase()`, the map can be deleted entirely since the fallback (`name.toUpperCase()`) already handles it. Also rename the `legacyType` field on `ExtractedFunctionCall` to just `command` for clarity.

#### Scope
- ~50 case labels across `handleNativeFunctionCall()` in `streaming-voice-orchestrator.ts`
- A few references to `legacyType` in filtering logic (e.g., `METADATA_ONLY_FUNCTIONS`)
- Low risk but wide blast radius — best done as a focused cleanup session with no other changes

---

### Session: February 20, 2026 — Textbook Routing Fix, Content Quality & Translation Architecture

**Status**: COMPLETED

#### What was built

1. **Textbook routing fix** — Language Hub's textbook link now passes the selected class's `curriculum_path_id` as a query parameter (`?curriculum_path_id=xxx`). The textbook page reads this parameter and applies it to filter content to the correct curriculum path. Previously, clicking "Textbook" from Language Hub showed generic/unfiltered content instead of the class-specific syllabus.

2. **LessonPrepCard em dash fix** — Removed an improper em dash character from conversation preview text in the LessonPrepCard component.

3. **Spanish 3 Unit 1 content replacement** — Replaced 34 misplaced Spanish 1 greeting drills (Hola, Buenos días, etc.) in the Spanish 3 "Active Practice: Mixed Drills" lesson with 23 intermediate-level drills covering identity and social issues vocabulary. New content includes:
   - 10 listen_repeat items (identity, values, rights, equality, diversity, belonging, justice, community, society, heritage)
   - 8 translate_speak items including subjunctive usage ("Es necesario que luchemos por la igualdad")
   - 4 fill_blank items testing vocabulary in context
   - 1 matching drill for term-translation pairs
   - All items at difficulty 3-4 (intermediate), appropriate for Spanish 3

4. **Audio play button accessibility** — TextAudioPlayButton now includes `aria-label` for screen readers ("Play pronunciation of {text}").

5. **Translation accessibility** — Updated all listen_repeat drill items across 8 non-English languages to include English translations in the `prompt` field (e.g., Spanish "Hola" → prompt shows "Hello").

#### Key files modified
- `client/src/pages/interactive-textbook.tsx` — Added `curriculum_path_id` query param reading
- `client/src/components/LanguageHubCards.tsx` (or equivalent) — Pass `curriculum_path_id` to textbook link
- `client/src/components/LessonPrepCard.tsx` — Removed em dash from preview text
- `client/src/components/AudioPlayButton.tsx` — Added `aria-label` prop

#### Database changes
- 34 Spanish 1 drill items deleted from Spanish 3 Unit 1 Mixed Drills lesson
- 23 new intermediate-level drill items inserted for Identity & Social Issues
- All listen_repeat prompts across 8 languages updated with English translations

---

### Future Architecture: Dynamic Native-Language Translations

**Status**: PINNED / BACKLOG

#### Problem
Currently, drill item translations are hardcoded to English in the `prompt` field. For example, a Spanish drill shows "Hello" as the translation. But if an Italian-speaking student is learning Spanish, they should see "Ciao" (Italian), not "Hello" (English). The `native_language` flag exists on user profiles and is used extensively by Daniela's voice system prompts, but NOT by the textbook/drill content system.

#### Current state
- **Daniela voice chat**: Fully respects `nativeLanguage` flag. System prompts reference it ~30+ times in `system-prompt.ts` for phase-appropriate language mixing, explanations in native language, etc.
- **Drill content (textbook)**: Hardcoded English translations in `prompt` field. No dynamic translation layer.
- **Database**: `conversations.nativeLanguage` field exists. Users have native language preference.

#### Scope of fix
1. **Schema change**: Add a `translations` JSONB column to `curriculum_drill_items` (or a separate `drill_item_translations` table) mapping `{ "en": "Hello", "it": "Ciao", "fr": "Bonjour", ... }`
2. **API change**: Textbook/drill API endpoints need to accept user's `nativeLanguage` and return the appropriate translation
3. **Content population**: Need translations for all ~5000+ drill items across all supported native languages (10 languages × 10 target languages = up to 100 translation pairs)
4. **Frontend**: TextAudioPlayButton and drill UI need to display the user's native-language translation instead of hardcoded English

#### Recommended approach
- Use AI batch translation (Gemini Flash) to generate initial translations for all drill items
- Store in JSONB column for efficient lookup
- Fallback chain: user's native language → English → show target text only

#### Content gap: Spanish 3 curriculum depth
Units 2-4 of Spanish 3 are hollow shells — they have conversation and cultural stub lessons but no vocabulary or drill content matching their Can-Do statements. Needs dedicated content authoring session.

### Session: February 24, 2026 — Gemini 429 Rate Limit Recovery (Carol's Silence Bug)

**Status**: COMPLETED

#### Root cause analysis
- **Symptom**: Daniela goes completely silent after student voice input — no response, no "thinking" indicator
- **Root cause**: Gemini API returning 429 "Resource Exhausted" errors during peak usage
- **Why silence**: The initial Gemini `streamWithSentenceChunking` calls in both PTT and OpenMic paths were NOT wrapped in `retryWithBackoff` — only the continuation (multi-step function calling) calls had retry logic. When a 429 hit the initial call, the error propagated to the catch block which logged it and sent a generic error + `response_complete` but never spoke anything, leaving the student in silence.

#### Fix: Three-layer defense
1. **Retry with backoff (PTT + OpenMic initial calls)**: Wrapped both initial `streamWithSentenceChunking` calls in `retryWithBackoff()` with 2 retries, 800ms base delay, 3s max delay. Previously only continuation calls had this.
2. **Spoken fallback on 429 (both paths)**: When retries exhaust and a 429 error reaches the catch block, Daniela now speaks "One moment, I'm having a little trouble connecting. Could you say that again?" instead of going silent. Uses `synthesizeSentenceToClient()` with `force: true`.
3. **Existing safety net**: The catch block already sends `response_complete` to prevent permanent mic lockout — now it also includes the spoken fallback sentence in `metrics.sentenceCount`.

#### Files modified
- `server/services/streaming-voice-orchestrator.ts` — lines ~3102 (PTT initial), ~4395 (PTT retry closure), ~5391 (PTT 429 fallback), ~5917 (OpenMic initial), ~6853 (OpenMic retry closure), ~7731 (OpenMic 429 fallback)

#### Voice health findings from Carol's session data
- Voice health status: YELLOW — 5 events in last hour, 2 errors, 1 user affected
- Trigger types: `error`, `failsafe_tier2_45s`, `greeting_silence_15s`
- Carol's sessions show 301s duration pattern (infrastructure timeout) — grace period fix from prior session should help
- Sofia agent auto-disabled optional context sources (hive, express_lane, editor_feedback) for 30min to reduce Gemini token pressure during 429 events

---

### Session: February 25, 2026 — Character-Based Billing Safeguard

**Status**: COMPLETED

#### What was built
Replaced the estimation-based idle session billing cap with a precise, metered-usage cross-check. Billing now uses actual tracked data (`tts_characters`, `stt_seconds`) rather than estimating activity from exchange counts.

#### Why
The previous approach (`exchanges × 30s avg`) was an arbitrary estimate that could mis-bill in edge cases. TTS characters and STT seconds are real metered usage that map directly to actual provider costs (Gemini tokens, TTS billing, Deepgram STT).

#### How it works — two-path billing guard
1. **Zero activity** (0 exchanges, 0 TTS chars, 0 STT secs): No charge — dead connection
2. **Primary path** (has metered TTS/STT data): 
   - `ttsDurationEstimate = tts_characters / 15` (~15 chars/sec of spoken audio, industry standard)
   - `activeSpeaking = ttsDurationEstimate + stt_seconds`
   - `fairCap = max(activeSpeaking × 3, 120s)` — 3x multiplier for think time/pauses, 2-min floor
   - If wall-clock > fairCap AND > 10min: cap charge at fairCap, log discrepancy
3. **Fallback path** (exchanges exist but no metered data — older sessions):
   - Uses `student_speaking_seconds × 2` if available, otherwise `exchanges × 30s`
   - Same 3x multiplier and 120s floor

#### Validation results (platform-wide, all sessions >60s)
- 86 healthy sessions: avg 385 TTS chars/min — none would be capped (zero false positives)
- 1,499 idle sessions: 0 chars, 0 exchanges — correctly skipped (no charge)
- 4 suspect sessions: 4.2 chars/min — correctly capped (e.g., Daniel's Feb 22 session: 7614s wall-clock → capped at 132s)

#### Key file modified
- `server/services/usage-service.ts` — `endSession()` method, lines ~484-537

---

### Native Script TTS Rule for Non-Latin Languages (Hebrew, Japanese, Korean, Mandarin)
**Date**: 2026-02-26

#### What was built
Added a `getNativeScriptTTSRule()` helper in `server/system-prompt.ts` that injects a language-specific voice script rule into Daniela's system prompt whenever she's teaching a language with a non-Latin alphabet.

#### Why it was needed
Google Chirp 3 HD voices read native script natively. When Daniela writes romanized Hebrew like `**im**`, the `**` bold markers are stripped before TTS (by `cleanTextForDisplay()` line 646), and Google receives the plain word `im`. The `he-IL-Chirp-HD-O` voice treats this as an English abbreviation and spells it out: "I-M" instead of "eem". This affected any short Hebrew word written in Latin characters (im, ken, lo, toda, ani, etc.).

#### How it works
The helper returns a one-paragraph instruction injected into all four voice mode blocks:
- `streamingVoiceModeInstructions` (regular voice mode, line ~1224)
- Founder Mode streaming voice note (line ~832)  
- Honesty Mode language context (line ~525)
- Honesty Mode voice note (line ~772)

For Hebrew, the rule is:
> "Always write Hebrew words in Hebrew script (**אם**, **שלום**, **תודה**, **כן**), NOT romanized Latin letters. Bold the Hebrew script; put the transliteration in parentheses after: **אם** (im)."

Subtitle/karaoke system is unaffected — `extractBoldMarkedWords()` uses a Unicode-safe regex that extracts Hebrew script from `**אם**` correctly. The `detectUnquotedNonLatin()` in language-segmenter already handles non-Latin script detection independently.

#### Languages covered
- Hebrew → Hebrew script (aleph-bet)
- Japanese → kana/kanji
- Korean → Hangul
- Mandarin → Chinese characters

#### Key file modified
- `server/system-prompt.ts` — new `getNativeScriptTTSRule()` function + injected into 4 voice instruction blocks

---

## Billing Safeguard: Unified Character-Based Guard (Feb 26, 2026)

### What was built
Replaced the two-path billing guard (primary character-based + estimation fallback) with a single unified character-based path in `server/services/usage-service.ts`. Sessions with exchange data but missing TTS/STT tracking now fall to a 120-second floor instead of being estimated from exchange count × 30s × 3.

### Why
The estimation fallback (`exchangeCount × AVG_EXCHANGE_DURATION`) could over-bill sessions where TTS character tracking failed (e.g. tracking gaps in production). The unified formula uses only real measured data — TTS characters and STT seconds — as the single source of truth for billing fairness.

### How the formula works
1. **Zero activity** (`exchanges = 0 AND tts_chars = 0 AND stt_secs = 0`): Charge $0. Dead connections never billed.
2. **Any other session** (unified path):
   - `ttsDurationEstimate = ceil(tts_characters / 15)` — 15 chars/sec is the standard natural speech rate
   - `activeSpeakingSeconds = ttsDurationEstimate + stt_seconds`
   - `fairBillableSeconds = max(activeSpeakingSeconds × 3, 120)` — 3x for think time/pauses; 120s floor
   - If `wall-clock > fairBillableSeconds AND wall-clock > 600s`: cap charge at `fairBillableSeconds`
   - Otherwise: charge wall-clock as normal

### Validation results (historical data, Feb 26, 2026)
- **Healthy sessions (>200 chars/min TTS rate)**: 0 would be capped — zero false positives
- **NO_DATA sessions (0 TTS, 0 STT, has exchanges)**: All 13 capped to 120s (avg wall-clock: 4,384s)
- **SUSPECT sessions (<100 chars/min)**: All 8 capped (avg wall-clock: 5,931s → avg fair cap: 394s)

### Key files modified
- `server/services/usage-service.ts` — lines 484–523: merged FALLBACK and PRIMARY paths into single UNIFIED path; removed `AVG_SECONDS_PER_EXCHANGE` estimation and `hasMeteredData` branch

---

## Bug Fix: Google Batch TTS Silent Function Call Responses (Feb 26, 2026)

### What was fixed
When Daniela (Google Chirp 3 HD / batch mode) returned a metadata-only function call (e.g. `voice_adjust`) with embedded text but **no accompanying sentences**, the audio was silently dropped. The response would appear in the conversation history but Daniela never spoke it. This caused students (including Carol) to think the session was frozen and restart.

### Root cause
Both the PTT path (`server/services/streaming-voice-orchestrator.ts:3195`) and OpenMic path (`:5990`) had conditions `&& !isGoogleBatchMode / !isGoogleBatchModeOM` that explicitly prevented Google batch mode from entering the function-call TTS block. The Google-specific TTS handler code was already written and correct inside that block at lines 3218 and 6019 — it just couldn't be reached. Non-Google providers (Cartesia, ElevenLabs, Gemini Live) were unaffected; they used a pre-signal path that bypassed the exclusion.

### Side effects of the bug
- **TTS character tracking = 0**: Because `streamSentenceAudioProgressive()` was never called for function-call-only turns, `session.telemetryTtsCharacters` was never incremented for those turns. This is why Carol's sessions showed 0 TTS chars despite real voice activity.
- **Student restarts**: Carol heard silence on `voice_adjust`-only turns, assumed the session was broken, and manually disconnected — creating a string of short repeated sessions.
- **Billing fallback activation**: Zero TTS chars triggered the estimation fallback in usage-service.ts (now replaced by the unified character guard from the same session).

### Fix
Two single-line changes — removed the `!isGoogleBatchMode(OM)` exclusion from both paths:
- `server/services/streaming-voice-orchestrator.ts` line 3195 (PTT path)
- `server/services/streaming-voice-orchestrator.ts` line 5990 (OpenMic path)

Also updated two stale log messages from "post-stream batch will handle TTS" to accurately reflect the new flow.

### User-facing impact
Daniela will now speak all function-call responses correctly in Google batch mode. TTS character counts will be accurate for all turns. Carol's sessions should stabilize.

---

## Multi-Subject Platform Expansion: Gene, Clio & Marcus (Feb 26, 2026)

### What was built
Added three new subject tutors to the HolaHola platform, completing the first multi-subject expansion:
- **Gene** (male biology tutor) — paired with Evelyn to give students a choice of biology teacher
- **Clio** (female history tutor) — narrative-first, attentive to overlooked perspectives
- **Marcus** (male history tutor) — structural and analytical, teaches students to see historical patterns

### How it works
Each subject page (`/biology`, `/history`) has a tutor picker in the header. Switching tutors starts a fresh conversation with that tutor's voice and system prompt. The gender preference is restored when the user leaves the page.

Voices:
- Evelyn: `en-US-Chirp3-HD-Aoede`
- Gene: `en-US-Chirp3-HD-Orus`
- Clio: `en-US-Chirp3-HD-Leda`
- Marcus: `en-US-Chirp3-HD-Charon`

Compass enrichments (session time awareness, last session summary) now apply to all subjects — previously biology was incorrectly excluded. Language-specific neural network context is still skipped for subject tutors (they have domain knowledge in their own prompts).

### Key files modified
- `server/services/biology-persona.ts` — new file replacing `evelyn-persona.ts`; exports both Evelyn and Gene with shared `buildBiologySystemPrompt()` base and distinct personalities
- `server/services/history-persona.ts` — new file; exports Clio and Marcus with shared `buildHistorySystemPrompt()` base and C3 Framework teaching approach
- `server/unified-ws-handler.ts` — updated imports; biology and history branching for voice selection and system prompt; Compass now applied to all sessions; `isSubjectSession` flag gates neural network context
- `client/src/pages/biology-tutor.tsx` — added Evelyn/Gene tutor picker; saves/restores language and gender on mount/unmount
- `client/src/pages/history-tutor.tsx` — new page; Clio/Marcus tutor picker; amber color accent
- `client/src/App.tsx` — added `/history` route and `HistoryTutor` lazy import
- `client/src/components/app-sidebar.tsx` — added History entry under "Other Subjects"

---

## Character-Based Billing Guard (T001-T003)
**Date:** Feb 2026

### What was built
Replaced the estimation-based idle session billing cap with a precise, character-based cross-check using actual metered TTS and STT data already tracked per session.

### Why
The old approach used `AVG_SECONDS_PER_EXCHANGE` to estimate session value — an approximation that could mis-bill at scale. TTS characters and STT seconds are real metered metrics that map directly to actual platform costs (TTS provider billing, Deepgram STT usage, Gemini tokens). Using them as the cross-check source eliminates the estimation error.

### How the formula works
```
ttsDurationEstimate  = ceil(tts_characters / 15)    # 15 chars/sec is standard natural speech rate
activeSpeakingSeconds = ttsDurationEstimate + stt_seconds
fairBillableSeconds   = max(activeSpeakingSeconds × 3, 120)   # 3x for think/pause time; 2-min floor
```

Cap is applied only when:
- `wall-clock > fairBillableSeconds` (session billed more than metered activity justifies)
- AND `wall-clock > 600s` (10-min minimum before cap kicks in, so short sessions are never clipped)

Zero-activity guard still fires first: sessions with `exchange_count=0, tts_characters=0, stt_seconds=0` are charged nothing.

### Validation (T002)
SQL cross-check across all completed voice sessions >60s confirmed:
- **All "WOULD BE CAPPED" sessions**: 0 exchanges, 0 TTS chars, 0 STT seconds — pure idle connections, no false cap concerns
- **Healthy sessions** (real TTS chars, normal session lengths): zero false positives — none would have been incorrectly capped
- Suspect sessions (some activity, very long wall-clock): correctly capped at fair metered value

### Key files modified
- `server/services/usage-service.ts` — replaced estimation logic with character-based cross-check (lines ~482–520); constants `CHARS_PER_SECOND=15`, `ACTIVITY_MULTIPLIER=3`, `MIN_BILLABLE_SECONDS=120`

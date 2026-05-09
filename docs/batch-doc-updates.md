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

### May 9, 2026 — Daniela silence fix + Gemini image engine warm palette (session 47c)
**Status**: COMPLETED — SCENE_STYLE_WARM prompt still being tuned

**Daniela voice silence bug (fixed)**
Root cause: duplicate WebSocket connections caused two parallel `SessionInit` pipelines to fire simultaneously, saturating the DB pool with ~18 concurrent queries and triggering a 3s timeout cascade. Fix: `sessionInitsInProgress` Set in `unified-ws-handler.ts` — second init for same userId+language closes immediately (code 4001). `SESSION_INIT_TIMEOUT` also raised 3000→6000ms.

**Image Engine Test — reference image architecture**
- Direct multimodal approach (feeding reference to image model) causes composition copying, not style transfer
- Two-call approach: Call 1 uses text model to extract style as language; Call 2 uses that text to generate (no image passed to generator)
- `styleDescription` surfaced in UI as collapsible panel under results
- **Strategic decision**: No reference for social reading bulk generation — simpler, faster, consistent across all 10 languages. Reference option remains in test tool for hero/brand images.

**SCENE_STYLE_WARM — warm palette variant (in progress)**
Added to `server/services/image-engine-test.ts`. Same pen-and-watercolor-wash technique as current `SCENE_STYLE` but with saturated, golden palette replacing muted/dusty language. `gemini-imagen-warm` engine added to test tool for side-by-side comparison.

**Outstanding before DALL-E migration (May 12 deadline):**
- Finalise `SCENE_STYLE_WARM` prompt (white border artifact, framing — full body vs. waist-up)
- Promote finalised style to `server/services/visual-content-service.ts`

**Files changed**: `server/unified-ws-handler.ts`, `server/services/image-engine-test.ts`, `client/src/pages/admin/ImageEngineTest.tsx`

---

### May 9, 2026 — Sofia false-positive suppression (session 47b)
**Status**: COMPLETED

`isKnownBenignFingerprint()` added to `server/services/support-persona-service.ts`. Four suppression rules covering: double_audio all-unknown fingerprint, no_audio expected==received, connection unknown+zero-received, voice_health_transition in dev. Dedup window 7→30 days. 62 Alden notes marked read.

---

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

---

### May 2026 — Memory Recall System Overhaul (Sessions 1–4)
**Status**: COMPLETED ✅

A four-session deep audit and rebuild of Daniela's memory recall system. Summary of all changes:

#### Session 1 — Five Recall Bugs Fixed
Five silent defects that were causing Daniela to return incomplete or truncated memories:

1. **`formatMemoryForConversation` truncation removed** — was capping each memory at 250 chars before sending to Gemini; cap removed entirely. File: `neural-memory-search.ts`
2. **Semantic arm hydration truncation removed** — `hive_snapshot` and `growth_memory` hydration in the scatter-gather recall tool were both capping content at 300 chars; caps removed. File: `native-fc-handlers.ts`
3. **`semanticSearch()` scope fix** — Express Lane collaboration messages are stored with `userId = null` but semantic search was only querying `userId = studentId`. Fixed to `OR (eq(userId, X), isNull(userId))`. File: `semantic-memory-service.ts`
4. **`collaborationMessages` added to embedding indexer** — Express Lane messages were never being embedded; added to the indexer's batch so they become semantically searchable. File: `memory-embedding-indexer.ts`
5. **`collaboration_message` hydration case added** — semantic search was finding Express Lane hits but the hydration switch had no case for them, so they silently dropped. File: `native-fc-handlers.ts`

#### Session 2 — `read_full_session` Tool
New Daniela tool giving her access to complete verbatim transcripts of any past conversation (no message limit, no truncation):

- `readFullSession(studentId, conversationId)` in `neural-memory-search.ts`
- `READ_FULL_SESSION` case + `processReadFullSession()` in `native-fc-handlers.ts`
- Registered in `daniela-function-registry.ts` (excluded from the GL 64-tool cap — available in full API mode)
- `browse_conversations_by_date` output updated to include `conversation_id` so Daniela can pass it to `read_full_session`
- Security: verifies `conversations.userId = studentId` before returning anything

#### Session 3 — Proactive Memory Surfacing + Post-Session Indexing

**Proactive surfacing** (`proactive-memory-service.ts` — new file):
- After every substantive user utterance (≥6 words), fires an async semantic check in the background
- Threshold: 0.73 (vs. recall's 0.65) — higher bar to avoid noise in the hot path
- Max 2 surfaces per utterance, max 8 per session; deduped via `session.surfacedMemoryIds` (Set)
- Results staged in `session.pendingMemorySurfaces` (string[])
- At the START of the next Gemini call, staged surfaces are injected into `conversationHistoryWithContext` — zero latency impact on current response
- Covers: student_insight, personal_fact, hive_snapshot, growth_memory
- Skipped for incognito sessions; never throws
- Wired into both PTT (line ~2644) and OpenMic (line ~6056) paths in `streaming-voice-orchestrator.ts`

**Post-session incremental indexing** (`indexNewMemoriesForUser()` in `memory-embedding-indexer.ts`):
- Called inside `extractFromConversation().then()` at `endSession` so it runs right after memory extraction completes
- Queries `student_insights` and `learner_personal_facts` created in the last 15 minutes for this user that don't yet have embeddings
- Eliminates the 2-hour lag between extraction and semantic discoverability
- Existing records that already have embeddings: skipped (idempotent)

**Session types** (`streaming-session-types.ts`):
- Added `surfacedMemoryIds?: Set<string>` — dedup set for proactive surfacing
- Added `pendingMemorySurfaces?: string[]` — staged surfaces awaiting next Gemini call

#### Session 4 — Memory Decay, Reinforcement, and Pinning

**New service**: `server/services/memory-decay-service.ts`

Biologically-inspired memory model:
```
strength(t) = initial_strength × e^(−0.03 × days_since_reinforcement)
```
Half-life ≈ 23 days. Floor at 0.05 so memories never fully disappear. Ceiling at 1.0.

**Schema** (`shared/schema.ts`): Three new columns on `memory_embeddings`:
- `strength REAL NOT NULL DEFAULT 1.0` — current memory strength (0.05–1.0)
- `last_reinforced_at TIMESTAMPTZ DEFAULT now()` — when the memory was last accessed
- `pinned BOOLEAN NOT NULL DEFAULT false` — if true, decay is disabled entirely

**Startup migration** (`server/index.ts` → `runMemoryDecayMigration()`):
- Idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` runs at +50s after startup
- Safe to run on every server restart; existing rows default to strength=1.0, pinned=false

**Weighted ranking** (`semantic-memory-service.ts`):
- Search still uses raw cosine for threshold decisions (0.65 / 0.73) — highly relevant faded memories still pass
- Results now SORTED by `effectiveScore = cosine × computeDecayMultiplier(strength, lastReinforcedAt, pinned)`
- Equal-relevance memories rank in order of recency — recently reinforced ones surface first

**Reinforcement events** — strength bump +0.15, clock reset:
1. Proactive surfacing: after memories are staged (`proactive-memory-service.ts`)
2. Explicit recall: UNIFIED_RECALL semantic arm after hydration (`native-fc-handlers.ts`)
Both are fire-and-forget (non-blocking, silent failure)

**`set_memory_pin` tool** (`daniela-function-registry.ts`, `native-fc-handlers.ts`):
- Args: `memory_type`, `memory_id`, `pinned: boolean`
- Pinned memories: decay permanently suspended
- Daniela uses this for major life events, breakthroughs, defining personal details
- IDs come from recall tool results or `browse_conversations_by_date`

---

## May 2026 Session 5 — Memory Intelligence: Temporal Reasoning, Correction, Confidence, Coverage, Forgetting

**Status**: COMPLETE

Five memory intelligence features built. No schema changes required — all built on existing columns.

### 1. Temporal Reasoning (`neural-memory-search.ts`, `streaming-voice-orchestrator.ts`)

**`buildTemporalAwareness(userId)`** — new export:
- Queries `learner_personal_facts` WHERE `relevant_date` is within -7 to +90 days of now
- Formats urgency naturally: "⚠️ IN 2 DAYS — bring this up", "coming up in 11 days", "just happened 3 days ago — ask how it went"
- Returns null if no time-sensitive facts exist (safe to skip)
- Injected at session start via prefetchSessionContext → `cache.temporalAwarenessSection`
- Surfaced in both PTT and OpenMic dynamic context blocks

Also enhanced `formatMemoryForConversation` with `relevantDateNote()` helper for upcoming/recent recall results.

### 2. Memory Correction (`correct_memory` tool)

**Registry** (`daniela-function-registry.ts`): legacyType `CORRECT_MEMORY`, args: `memory_type`, `memory_id`, `correction?`
**Handler** (`native-fc-handlers.ts`, case `CORRECT_MEMORY`):
- Deactivates old record (`is_active = false`) in appropriate DB
- Floors embedding strength to 0.05 and unpins (`memory_embeddings`)
- If `correction` provided: inserts new `learner_personal_facts` row with `factType: 'correction'`
- Only fires when student explicitly corrects a recalled fact

### 3. Confidence Calibration (`semantic-memory-service.ts`, `memory-embedding-indexer.ts`)

**`generateAndStoreEmbedding`** now accepts optional `initialStrength?: number`:
- On INSERT: `strength = clamp(initialStrength ?? 1.0, 0.05, 1.0)`
- On UPDATE (stale content): strength preserved — reinforcement history intact

**Indexer** (`collectUnindexedMemories` + `indexNewMemoriesForUser`):
- `student_insights`: selects `observationCount`, passes `initialStrength = min(1.0, 0.7 + observationCount × 0.06)`
- `learner_personal_facts`: selects `mentionCount`, passes `initialStrength = min(1.0, 0.7 + mentionCount × 0.06)`
- Formula: mention/observationCount=1 → 0.76, count=5 → 1.0
- Off-hand single mentions start weaker; repeatedly confirmed facts start strong

### 4. Coverage Awareness (`neural-memory-search.ts`, `streaming-voice-orchestrator.ts`)

**`buildCoverageAudit(userId)`** — new export:
- Expected `factType` categories: `family`, `work`, `travel`, `goal`, `preference`, `relationship`, `personal_detail`, `life_event`
- Expected `insightType` categories: `learning_style`, `preference`, `strength`, `personality`
- Returns null if fewer than 3 total facts (brand-new student — no meaningful audit)
- Returns null if all categories covered (no blind spots to surface)
- Injected at session start via prefetchSessionContext → `cache.coverageAuditSection`
- Surfaced in both PTT and OpenMic dynamic context

### 5. Student-Controlled Forgetting (`forget_memory` tool)

**Registry** (`daniela-function-registry.ts`): legacyType `FORGET_MEMORY`, args: `memory_type`, `memory_id`, `reason?`
**Handler** (`native-fc-handlers.ts`, case `FORGET_MEMORY`):
- Deactivates record (`is_active = false`)
- Floors embedding strength to 0.05, unpins
- Record is not deleted — just invisible to recall and context injection
- Only fires on explicit student request ("please don't remember that")

### Session Types (`streaming-session-types.ts`)
Two new optional fields in `cachedContext`:
- `temporalAwarenessSection?: string`
- `coverageAuditSection?: string`

---

## May 2026 Session 6 — Learning Goal Scaffolding

### Overview
Outcome-based learning goal layer for self-directed students and business travelers who aren't following the textbook curriculum. Goals are functional outcomes ("order food without freezing"), not abstract levels ("reach B2"). Daniela tracks capability arcs silently through four stages; no progress bars surface to the student.

### Design Decisions (from Daniela's Express Lane feedback)
- **Capability arc**: `planned → planted → practiced → integrated`
  - planted = student decoded meaning with Daniela's support
  - practiced = controlled production when prompted
  - integrated = SACRED STATUS — only when student uses capability spontaneously to solve a real communication problem
- **Goal shifting**: don't delete, evolve. Old goal archived, integrated capabilities carry forward
- **No UI**: Daniela checks in conversationally ("How are you feeling about the restaurant stuff?")
- **note on advance_capability**: evidence trail for why a capability was advanced ("Used correctly during story about their cat without hesitation")

### Schema (`shared/schema.ts`)
New `GoalCapability` interface and `learningGoals` pgTable:
- `id`, `studentId`, `language`, `goalStatement`, `targetDate?`, `capabilities` (jsonb), `isActive`, `createdAt`, `updatedAt`
- One active goal per student+language at a time
- `capabilities` jsonb: `[{ id, name, status, notes[], addedAt, lastAdvancedAt? }]`
- Types: `LearningGoal`, `InsertLearningGoal`, `GoalCapability`

### Service (`server/services/learning-goal-service.ts`)
New file — all learning goal business logic:
- `setLearningGoal(studentId, language, goalStatement, targetDate?, capabilityNames[])` → creates goal, deactivates any prior active goal, returns goalId
- `advanceCapability(goalId, capabilityId, newStatus, note?)` → only advances forward, appends note to evidence trail
- `getActiveGoal(studentId, language)` → raw DB fetch
- `getCurrentGoalState(studentId, language)` → full formatted state string (for get_current_goal_state tool response): TODAY'S FOCUS / REINFORCE / LANDED / UPCOMING sections
- `formatGoalForSession(studentId, language)` → compact session-start injection string with goal, deadline, and what to prioritize
- `runLearningGoalsMigration()` → idempotent `CREATE TABLE IF NOT EXISTS` + indexes

### Three New Daniela Tools

**`set_learning_goal`** (`daniela-function-registry.ts`, legacyType `SET_LEARNING_GOAL`)
- Called at end of goal-setting conversation
- Args: `goal_statement` (required), `capabilities[]` (required, each with `id` + `name`), `language?`, `target_date?`
- No continuation response (silent)

**`advance_capability`** (`daniela-function-registry.ts`, legacyType `ADVANCE_CAPABILITY`)
- Called silently when Daniela observes a stage transition
- Args: `goal_id`, `capability_id`, `new_status` (planted/practiced/integrated), `note?`
- No continuation response (silent)

**`get_current_goal_state`** (`daniela-function-registry.ts`, legacyType `GET_CURRENT_GOAL_STATE`)
- Called mid-session when Daniela wants a real-time view of the capability map
- Args: `language?`
- Continuation response: reads `session.goalStateResult` (set via `pendingMemoryLookupPromises`)
- Response uses `getCurrentGoalState()` formatting

### Handlers (`native-fc-handlers.ts`)
Three new cases before WRITE_TO_SELF section:
- `SET_LEARNING_GOAL`: fire-and-forget async, calls `setLearningGoal`
- `ADVANCE_CAPABILITY`: fire-and-forget async, calls `advanceCapability`
- `GET_CURRENT_GOAL_STATE`: async via `pendingMemoryLookupPromises`, sets `session.goalStateResult`

### Session Types (`streaming-session-types.ts`)
- `goalSection?: string` added to `cachedContext`
- `goalStateResult?: string` added to session for `GET_CURRENT_GOAL_STATE` tool response

### Orchestrator (`streaming-voice-orchestrator.ts`)
- Prefetch block 2e: `formatGoalForSession` called at session start → `cache.goalSection`
- PTT dynamic context: injects `session.cachedContext?.goalSection` if present
- OpenMic dynamic context: same injection

### Startup Migration (`server/index.ts`)
- `+55s` setTimeout calls `runLearningGoalsMigration()` — idempotent, safe on every boot

---

## May 2026 Session 7 — Neural Memory Indexing: Tools + Goal Capabilities

### Overview
Two additions that deepen Daniela's neural net coverage:
1. **Daniela Tool Indexer** — all function declarations embedded into `memory_embeddings` as `daniela_tool` records (pinned, globally scoped). Daniela can recall what tools she has and when to use them even if context injection fails.
2. **Goal Capability Indexer** — learning goal capabilities embedded as `goal_capability` records (student-scoped). Daniela can recall capability status and Daniela's own evidence notes via semantic search across all sessions.

### Design principle
The neural memory system (vector search) is the persistent layer. Context injection (prompt) is the fast path. Both should agree. When they conflict or one fails, the other covers.

### New file: `server/services/daniela-tool-indexer.ts`
- `runDanielaToolIndexer()` — iterates all entries in `DANIELA_FUNCTION_REGISTRY`
- For each tool: formats rich text (name + description + parameter names/descriptions) → embeds
- `memoryType = 'daniela_tool'`, `memoryId = legacyType`, `userId = null` (globally scoped)
- After indexing, pins all `daniela_tool` embeddings (`pinned = true`) — tools never decay
- Idempotent via content hash — re-runs are cheap unless a tool description changed

### Updates to `server/services/learning-goal-service.ts`
- `formatCapabilityForEmbedding(goalStatement, cap)` — rich text: goal statement + capability name + status + evidence notes
- `indexGoalCapabilities(goal)` — fire-and-forget, indexes all caps for a given goal row
  - `memoryType = 'goal_capability'`, `memoryId = '{goalId}:{capabilityId}'`, `userId = studentId`
  - Content hash detects status/note changes → auto-updates embedding on advance
- `indexAllActiveGoalCapabilities()` — startup scan: all active + recently-archived (last 30d) goals
- Wired into `setLearningGoal` and `advanceCapability` — indexing happens on every write

### Startup timeline (`server/index.ts`)
- `+100s` — `runDanielaToolIndexer()` (after the main embedding indexer at +95s)
- `+105s` — `indexAllActiveGoalCapabilities()` (picks up any goals created before this boot)

---

## May 2026 Session 8 — Neural Network Coverage Audit (Sessions 1–7)

### Overview
Systematic audit of the two-layer neural architecture for all Sessions 1–7 features. Found embedding layer solid; structured procedural layer had gaps for Sessions 4–6 features (memory management tools and learning goal tools had no tool_knowledge entries, and three auto-surfaced awareness systems had no matching tutor_procedures). All gaps closed.

### Bugs fixed during session
1. **Awareness filter too broad** — `buildUnifiedBrainSync` filtered `category='awareness'` which matched 10 pre-existing situational procedures (ACTFL level, syllabus topic signals, etc.) and would have injected all into every session. Fixed: filter by explicit trigger values `['memory_surfaced', 'temporal_fact_upcoming', 'coverage_gap_detected']` — exactly the three auto-surfaced context systems.
2. **Syntax field format** — new `tool_knowledge` entries had prose descriptions in `syntax` field instead of `FUNCTION CALL: func_name({...})` format used by `buildUnifiedToolKnowledgeSync`. Fixed: updated all 7 entries to match convention.
3. **Uppercase/lowercase duplicates** — render categories had both `SET_MEMORY_PIN` and `set_memory_pin` for same tool. Fixed: removed uppercase dead entries (DB names are lowercase).
4. **`READ_FULL_SESSION` in wrong category** — was listed under `MEMORY & RECALL`, correctly belongs only under `MEMORY MANAGEMENT`. Fixed.
5. **`memory_embeddings` table missing** — entire vector embedding layer non-functional at boot (126 tool embedding errors, all student/hive/fact scans failed). Created table from schema definition in `shared/schema.ts`.

### New DB entries — `tool_knowledge` (7, tool_type=native_function_call, sync_status=approved)
Memory management: `set_memory_pin`, `correct_memory`, `forget_memory`, `read_full_session`
Learning goals: `set_learning_goal`, `advance_capability`, `get_current_goal_state`
Each entry has: purpose, syntax (`FUNCTION CALL:` format), examples, best_used_for, avoid_when, combines_with, sequence_patterns.

### New DB entries — `tutor_procedures` (3, category=awareness, sync_status=approved)
- `Proactive Memory Surfacing — Natural Weaving` (priority 75, trigger: `memory_surfaced`)
- `Temporal Awareness — Time-Sensitive Facts` (priority 80, trigger: `temporal_fact_upcoming`)
- `Coverage Audit — Organic Discovery` (priority 60, trigger: `coverage_gap_detected`)

### Rendering wired (`server/services/procedural-memory-retrieval.ts`)
- `buildDetailedToolDocumentationSync`: new `MEMORY MANAGEMENT` and `LEARNING GOALS` render categories (streaming voice sessions)
- `buildUnifiedBrainSync`: new `AWARENESS GUIDANCE` section — renders only the 3 trigger-scoped procedures in every voice session

### Architecture doc additions (`docs/neural-network-architecture.md`)
- "The Neural Network as the Center of Daniela's Memory" section
- "The North Star: No Prompt" section — documents the long-term design vision and the discipline it creates: before injecting anything, ask if Daniela could find it herself

### `memory_embeddings` table created + full embedding layer repair
Four sequential issues resolved to get embeddings working end-to-end:

1. **Table missing** — created from `shared/schema.ts` definition. 9 columns, unique index on `(memory_type, memory_id)`, standard index on `(user_id, memory_type)`. No pgvector — cosine similarity computed in JS.
2. **Wrong env var** — `semantic-memory-service.ts` used `GOOGLE_GENERATIVE_AI_API_KEY` (unset); entire codebase uses `GEMINI_API_KEY`. Fixed.
3. **Wrong API version** — Gemini SDK defaults to `v1beta`; tried `httpOptions: { apiVersion: 'v1' }`. Still failed.
4. **No embedding access on Gemini key** — the key only supports `generateContent`/`countTokens`, no embedding models at all. Switched to **OpenAI `text-embedding-3-small`** with `dimensions: 768` — `EMBEDDING_DIM` constant unchanged, `USER_OPENAI_API_KEY` (direct key, not managed proxy). Removed `@google/genai` import from this file.

**Result on first clean boot**: `[ToolIndexer] Done — 126 indexed, 0 already fresh, 0 errors`. EmbedIndexer began processing ~12,200 student memories in 10-record batches (2h interval). Both neural network layers now operational.

---

## Session: May 9, 2026 — DALL-E 3 Replacement Engine Evaluation

### What was built
Purpose-built image engine test page at `/admin/image-test` for evaluating six image generation engines side-by-side. Also: full evaluation run across five use-case categories, decision reached, documentation written.

### Test tool (`/admin/image-test`)
- **File:** `client/src/pages/admin/ImageEngineTest.tsx`
- **Backend:** `server/services/image-engine-test.ts`, route `POST /api/admin/image-engine-test`
- **Features:** 6 engines in parallel, configurable run count, scene/prop mode toggle, per-engine retry button (spins independently, doesn't block global state), full-size lightbox on image click, download links, timing display per image
- **Engines:** `dall-e-3`, `gpt-image-1`, `gpt-image-1-prop`, `gemini-2.5-flash-image`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`
- **Access:** Admin Command Center → "Image Engine Test" button, or direct `/admin/image-test`

### Decision reached
Full evaluation documented in `docs/visual-asset-roadmap.md` under "Image Engine Evaluation — May 2026". Short version:
- **Props:** Imagen 4 Standard (6–7s, perfect clean objects — DALL-E 3 was actually failing props with surrealist output)
- **Scenes / characters / environments:** Imagen 4 Ultra (9–14s, quality on par with DALL-E 3 with prompt tuning)
- **Live session `show_image()` calls:** Gemini Flash (5–7s, speed is the requirement mid-conversation)

### What's NOT done
Migration of the 7 DALL-E 3 callsites — documented in roadmap and handoff, ready for next session. Recommended: create `server/services/google-image-service.ts` as single integration point first.

### Key prompt tuning note
Add `"full bleed background, color and content to every corner, no white borders, no vignette"` to all Imagen 4 calls to prevent sticker/floating illustration effect on some environment renders.

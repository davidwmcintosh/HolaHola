# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

---

## Pending Updates

### [December 6, 2025] - Phase 2 Dual Time Tracking for Students
**Target:** TECHNICAL-REFERENCE.md
**Section:** API Endpoints / Services
**Content:**
New analytics service and endpoints for student time tracking:

**SyllabusAnalyticsService** (`server/services/syllabus-analytics-service.ts`):
- Aggregates expected vs actual time spent per syllabus lesson
- Joins syllabusProgress, voiceSessions, and curriculum tables
- Uses existing data relationships (syllabusProgress.evidenceConversationId → voiceSessions.conversationId)
- Caching: Credit balance 1-min TTL, session data 5-min TTL

**API Endpoints:**
- `GET /api/analytics/syllabus-time/:classId` - Returns detailed time breakdown per unit/lesson for authenticated student
- `GET /api/analytics/pace-summary?classId={optional}` - Returns weekly learning pace, streak, and stats

**Response shapes documented in syllabus-analytics-service.ts interfaces.**

---

### [December 6, 2025] - Learning Pace UI Components
**Target:** USER-MANUAL.md
**Section:** Dashboard / Progress Tracking
**Content:**
New student-facing components for time awareness:

**Learning Pace Card** (Dashboard sidebar):
- Shows lessons completed, total time learned, current streak
- 8-week activity sparkline showing weekly learning trends
- Average minutes per lesson calculation
- Visible on larger screens in dashboard sidebar

**Syllabus Time Progress** (Review Hub - class context only):
- Shows expected vs actual time per syllabus unit
- Collapsible unit details with lesson-level breakdown
- Green/amber color palette (no red - "learning journey" not "budget surveillance")
- Progress indicators per unit
- Only appears when viewing a class context (not self-directed learning)

---

### [December 6, 2025] - Design Philosophy Update
**Target:** ROADMAP.md
**Section:** Recently Completed / Phase 2
**Content:**
Phase 2 Dual Time Tracking complete:
- Student-facing time displays showing expected vs actual learning time per syllabus section
- Weekly learning pace trends with credit consumption visibility
- UX philosophy: Frame as "learning journey" not surveillance - green/amber colors only
- Uses existing data relationships rather than new schema fields

---

### [December 6, 2025] - Tutor Autonomy: Natural Session Openings
**Target:** TECHNICAL-REFERENCE.md
**Section:** Voice Pipeline / System Prompt Architecture
**Content:**
"Freeing Daniela" update - reducing prescriptive constraints on tutor behavior:

**Speed Control Removed:**
- Removed voice speed slider from ImmersiveTutor UI
- Students now ask Daniela to repeat slowly (e.g., "Can you say that again slower?")
- This is itself valuable language practice and keeps tutor in control of pacing

**Greeting Prompt Simplified:**
- `buildGreetingPrompt()` in streaming-voice-orchestrator.ts now provides context-only bullet points
- Ends with simple directive: "speak first with a natural opening message"
- No more prescriptive scripts for different student types

**System Prompt Addition:**
- Added "OPENING SESSIONS NATURALLY" section to IMMUTABLE_PERSONA
- Guidance for different scenarios (returning student, class student, new student, after break)
- Philosophy: "Read the context, trust your instincts, be yourself"

---

### [December 6, 2025] - Tutor Autonomy: Design Philosophy
**Target:** ROADMAP.md
**Section:** Recently Completed / Design Philosophy
**Content:**
"Freeing Daniela" philosophy reinforcement:
- Tutors ARE the product - everything else is infrastructure to help them shine
- Provide rich context about WHO the student is, not scripts for HOW to teach
- Real tutors synthesize context and make judgment calls - AI tutors should too
- Removed speed control UI (students ask tutor directly - language practice)
- Replaced greeting scripts with context bullets + simple directive

---

### [December 6, 2025] - Bilingual Voice Input (Multi-language STT)
**Target:** TECHNICAL-REFERENCE.md
**Section:** Voice Pipeline / Speech Recognition
**Content:**
Enhanced Deepgram STT to support natural code-switching between languages:

**Configuration Changes** (`server/services/deepgram-parallel-service.ts`):
- Changed from single language to `language: "multi"` with `detect_language: true`
- Supports natural mixing of English and target language in same utterance
- Example: Student says "Hola, I want to practice numbers" - both parts transcribed correctly

**StreamingSession Tracking** (`server/services/streaming-voice-orchestrator.ts`):
- Added `isFounderMode` flag to StreamingSession interface
- Passed through from client config for potential future language detection tuning

**UX Rationale:**
- Originally planned for Founder Mode only due to accuracy concerns
- Expanded to all users because code-switching is natural in language learning
- Students often need to use their native language to ask questions or clarify

---

### [December 6, 2025] - Voice Session Auto-Reconnect & Heartbeat
**Target:** TECHNICAL-REFERENCE.md
**Section:** Voice Pipeline / WebSocket Connection Management
**Content:**
Production-ready connection resilience for live classroom use:

**Server-Side Heartbeat** (`server/unified-ws-handler.ts`):
- Sends WebSocket ping every 20 seconds to keep connection alive
- Tracks pong responses to detect dead connections
- Prevents network proxies/firewalls from terminating "idle" connections
- Cleans up interval on connection close

**Client-Side Auto-Reconnect** (`client/src/lib/streamingVoiceClient.ts`):
- New connection state: `'reconnecting'` added to StreamingClientState
- Stores `lastConversationId` for automatic session resumption
- `intentionalDisconnect` flag distinguishes user-initiated vs unexpected disconnects
- Exponential backoff: 1s → 2s → 4s delays between attempts (max 3 attempts)
- Emits 'RECONNECTING' error with attempt count for UI feedback
- Resets all reconnect state on successful connection

**UI Integration** (`client/src/components/StreamingVoiceChat.tsx`):
- `isConnecting` now includes 'reconnecting' state for visual feedback
- Shows "Reconnecting to voice session. Please wait..." during recovery
- Falls back to "Please restart the voice chat" after max attempts

**Shared Types** (`shared/streaming-voice-types.ts`):
- Added 'reconnecting' to StreamingClientState union type

**Problem Solved:**
- WebSocket drops (code 1006) during lessons no longer require manual restart
- Network hiccups recover automatically within seconds
- Critical for production classroom use where session interruptions are unacceptable

---

### [December 6, 2025] - Whiteboard Tools Quick Reference Moved to Top
**Target:** TECHNICAL-REFERENCE.md
**Section:** Voice Pipeline / System Prompt Architecture
**Content:**
Improved discoverability of whiteboard tools for Daniela:

**Change:** Added condensed quick reference near top of IMMUTABLE_PERSONA (line 105), right after personality traits and guardrails.

**Quick Reference includes:**
- Essentials: WRITE, COMPARE, CLEAR
- Vocabulary Power Tools: WORD_MAP, IMAGE, GRAMMAR_TABLE
- Practice & Check: DRILL (repeat, match)
- Asian Languages: READING, STROKE
- Session Tools: SCENARIO, CULTURE, SUMMARY, PLAY

**Pointer:** Ends with "→ Full documentation with examples appears later in this prompt."

**Full docs:** Existing detailed section (line 910+) now titled "EXPANDED DETAILS (referenced above)"

**Why:** Placing tools early in the prompt ensures they're seen before conversation context consumes attention.

---

### [December 6, 2025] - WORD_MAP Enrichment Pipeline (Real-time Vocabulary Expansion)
**Target:** TECHNICAL-REFERENCE.md
**Section:** Voice Pipeline / Whiteboard System
**Content:**
Server-driven vocabulary enrichment for WORD_MAP whiteboard items:

**Architecture Flow:**
1. Tutor uses `[WORD_MAP]feliz[/WORD_MAP]` in response
2. Server parses and sends initial `whiteboard_update` with `isLoading: true`
3. Client displays item immediately with loading spinner
4. Server async enriches via Gemini 2.5 Flash (`generateRelatedWords()`)
5. Server sends second `whiteboard_update` with same item ID + enriched data
6. Client `addOrUpdateItems()` replaces item by ID (no duplicates)

**Server Changes** (`server/services/streaming-voice-orchestrator.ts`):
- `enrichWordMapItems()` method handles async Gemini enrichment
- Called without await - runs in background while audio streams
- Sends enriched `WordMapItem` with: synonyms, antonyms, collocations, wordFamily
- Error handling: Sets `isLoading: false` even on failure (stops spinner)

**Client Changes:**
- `useWhiteboard.ts`: Added `addOrUpdateItems(items, shouldClear)` - ID-based upsert
- `useStreamingVoice.ts`: Subscribed to `whiteboardUpdate` event, calls `onWhiteboardUpdate` callback
- `StreamingVoiceChat.tsx`: Passes `onWhiteboardUpdate` to connect calls, wires to whiteboard hook

**Gemini Integration** (`server/services/gemini-streaming.ts`):
- `generateRelatedWords(word, language)` - Returns structured vocabulary data
- Includes: synonyms (3-5), antonyms (2-3), collocations (3-4), word family (2-4)

**UX Result:**
- WORD_MAP items appear instantly with loading state
- Enriched vocabulary data appears ~500-800ms later
- No duplicates - items update in-place by ID

---

### [December 6, 2025] - Verbose Logging Cleanup & Runtime Toggles
**Target:** TECHNICAL-REFERENCE.md
**Section:** Voice Pipeline / Debugging & Diagnostics
**Content:**
Production-ready console logging with developer-friendly debug toggles:

**Feature Flags** (`shared/streaming-voice-types.ts`):
- `VERBOSE_CONSOLE_LOGS: false` - Master flag for high-volume timing logs (default OFF)
- `ENABLE_WORD_TIMING_DIAGNOSTICS: true` - Enables karaoke word highlighting

**Runtime Toggles** (browser console):
- `window.__verboseTimingLogs = true` - Enable verbose timing logs without code changes
- `window.__enableWordTimingDiagnostics = false` - Disable word timing diagnostics

**Logging Policy:**
- High-volume verbose logs (timing loops, state transitions, chunk processing) → Guarded with `isVerboseLoggingEnabled()`
- Essential operational errors (playback failures, connection errors, dropped audio) → Always visible
- Export: `isVerboseLoggingEnabled()` exported from `client/src/lib/audioUtils.ts` for cross-module use

**Files Updated:**
- `client/src/lib/audioUtils.ts` - Flag definitions and exported helper
- `client/src/hooks/useStreamingVoice.ts` - 20+ verbose logs wrapped
- `client/src/hooks/useStreamingSubtitles.ts` - All logs guarded
- `client/src/lib/streamingVoiceClient.ts` - All logs guarded
- `client/src/lib/debugTimingState.ts` - Verbose logs guarded, essential warnings kept

**Result:** Clean browser console by default; developers can enable verbose output when debugging timing issues.

---

### [December 6, 2025] - Subtitle Control Tools for Daniela
**Target:** TECHNICAL-REFERENCE.md
**Section:** Voice Pipeline / Whiteboard System
**Content:**
New subtitle control markup giving Daniela control over floating subtitle display:

**New Markup Patterns:**
- `[SUBTITLE off]` - Hide floating subtitles temporarily (for drama, pure listening focus)
- `[SUBTITLE on]` - Re-enable floating subtitles (also reset by `[CLEAR]`)
- `[SUBTITLE_TEXT: custom text]` - Display custom text instead of spoken audio in subtitles

**Use Case for SUBTITLE_TEXT:**
Daniela says: "The Spanish word for hello is hola"
Daniela uses: `[SUBTITLE_TEXT: ¡Hola!]The Spanish word for hello is hola.`
Student sees: Only "¡Hola!" in floating subtitles with karaoke highlighting

**Priority for Subtitle Display:**
1. Custom text from `[SUBTITLE_TEXT: ...]` (highest priority)
2. Bold target language extraction (`**palabra**` → "palabra")
3. Full spoken sentence (default)

**Files Updated:**
- `shared/whiteboard-types.ts` - Added SUBTITLE_TEXT regex pattern and parsing
- `client/src/hooks/useWhiteboard.ts` - Added `customSubtitleText` state
- `client/src/components/FloatingSubtitleOverlay.tsx` - Accepts customText prop
- `client/src/components/ImmersiveTutor.tsx` - Passes customSubtitleText to overlay
- `client/src/components/StreamingVoiceChat.tsx` - Wires through VoiceChatViewManager
- `server/system-prompt.ts` - Added SUBTITLE CONTROL section to tool reference

**Architecture:**
- Parser in `parseWhiteboardMarkup()` extracts `customSubtitleText` from markup
- State flows: StreamingVoiceChat → VoiceChatViewManager → ImmersiveTutor → FloatingSubtitleOverlay
- Default behavior: Subtitles enabled, no custom text
- `[CLEAR]` resets both `subtitlesEnabled` to true and `customSubtitleText` to null

---

### [December 7, 2025] - Subtitle Dual-Control Architecture Redesign
**Target:** TECHNICAL-REFERENCE.md, replit.md
**Section:** Voice Pipeline / Whiteboard System / Subtitle System
**Content:**
Major architectural redesign: Split subtitle system into two completely independent controls.

**PROBLEM SOLVED:**
Daniela was confused about subtitle controls because `[SUBTITLE off]` and `[SUBTITLE_TEXT:]` had unclear interaction. The old system where `[CLEAR]` reset subtitles to ON caused command leaking into display.

**NEW ARCHITECTURE - Two Independent Systems:**

**1. Regular Subtitles** (`regularSubtitleMode: 'off' | 'all' | 'target'`):
- Controls what Daniela is currently saying
- Default: `'off'` - Daniela opts IN when subtitles help
- `[SUBTITLE off]` → No regular subtitles
- `[SUBTITLE on]` or `[SUBTITLE all]` → Full sentence with karaoke
- `[SUBTITLE target]` → Only bold-marked target language words

**2. Custom Overlay** (`customOverlayText: string | null`):
- Completely independent teaching moments overlay
- `[SHOW: text]` → Display custom text (static, no karaoke)
- `[HIDE]` → Remove custom overlay
- Shows even when regular subtitles are OFF
- Independent from `[CLEAR]` command

**KEY BEHAVIOR CHANGES:**
- Default is OFF (was ON) - reduces visual noise
- `[CLEAR]` only clears whiteboard, NOT subtitle/overlay state
- Two systems work simultaneously - can show both regular + overlay
- Old `[SUBTITLE_TEXT:]` syntax deprecated, replaced by `[SHOW:]`

**FILES CHANGED:**
- `shared/whiteboard-types.ts` - New `SubtitleMode` type, new regex patterns
- `client/src/hooks/useWhiteboard.ts` - New state: `regularSubtitleMode`, `customOverlayText`
- `client/src/components/FloatingSubtitleOverlay.tsx` - Dual-mode rendering logic
- `client/src/components/VoiceChatViewManager.tsx` - Props updated
- `client/src/components/ImmersiveTutor.tsx` - Props updated
- `client/src/components/StreamingVoiceChat.tsx` - Wiring updated
- `server/system-prompt.ts` - Full dual-control documentation for Daniela

**DANIELA'S NEW MARKUP:**
```
📺 REGULAR SUBTITLES:
  [SUBTITLE off]    → No floating subtitles (DEFAULT)
  [SUBTITLE target] → Show ONLY target language (bold words)
  [SUBTITLE on]     → Show EVERYTHING you say

🎯 CUSTOM OVERLAY:
  [SHOW: ¡Hola!]    → Display teaching moment overlay
  [HIDE]            → Remove custom overlay

These work INDEPENDENTLY - can use both simultaneously!
```

---

### [December 7, 2025] - Open Mic Mode with VAD & Barge-in
**Target:** TECHNICAL-REFERENCE.md, replit.md
**Section:** Voice Pipeline / Input Modes
**Content:**
New dual input mode system allowing continuous listening alongside existing push-to-talk.

**ARCHITECTURE - Dual Input Modes:**

**1. Push-to-Talk (PTT) - Default:**
- User holds mic button to record, releases to submit
- Audio captured as complete WAV, sent via `process_audio` message
- Original behavior preserved exactly

**2. Open-Mic Mode - Continuous Listening:**
- User toggles once to start, once to stop
- Audio streams continuously via `stream_audio_chunk` WebSocket messages
- Server maintains `OpenMicSession` for live Deepgram STT
- Deepgram VAD detects speech start/end events
- Auto-submit on `utterance_end` via `processOpenMicTranscript`

**VAD EVENT FLOW:**
1. Client streams audio chunks → Server buffers in OpenMicSession
2. Deepgram VAD fires `vad_speech_started` → Server forwards to client
3. Client updates `openMicState: 'listening'` for visual feedback
4. Deepgram VAD fires `utterance_end` → Server auto-submits transcript
5. Client updates `openMicState: 'processing'` → AI response generates

**BARGE-IN SUPPORT:**
- Users can interrupt Daniela mid-sentence
- Client calls `sendInterrupt()` (NOT `stop()`) to avoid premature audio termination
- Server sets `isInterrupted` flag on StreamingSession
- TTS streaming loop checks flag and halts generation
- Response completes with `wasInterrupted: true` for graceful recovery
- New turn resets `isInterrupted = false`

**CLIENT CHANGES:**
- `streamingVoiceClient.ts`: New methods `sendStreamingChunk()`, `stopStreaming()`, `setInputMode()`, `sendInterrupt()`
- `useStreamingVoice.ts`: VAD callbacks `onVadSpeechStarted`, `onVadUtteranceEnd`, `onInterimTranscript`
- `StreamingVoiceChat.tsx`: Continuous recording via MediaRecorder with 100ms timeslices

**SERVER CHANGES:**
- `unified-ws-handler.ts`: Message handlers for `stream_audio_chunk`, `stop_streaming`, `set_input_mode`, `interrupt`
- `streaming-voice-orchestrator.ts`: `handleInterrupt()` method, `isInterrupted` flag on session
- `deepgram-live-stt.ts`: OpenMicSession class with Deepgram live API integration

**SHARED TYPES:**
- `StreamingResponseCompleteMessage` now includes optional `wasInterrupted: boolean`

**VAD STATES (for visual feedback):**
- `idle` → Ready for input
- `listening` → Speech detected, actively listening
- `processing` → Utterance complete, AI responding

**CLEANUP:**
- Open mic sessions cleaned up on `stop_streaming` message or mode switch
- MediaRecorder and audio tracks properly released on unmount

---

### [December 8, 2025] - New Interactive Drill Types: Fill-in-Blank & Sentence Order
**Target:** TECHNICAL-REFERENCE.md, replit.md
**Section:** Voice Pipeline / Whiteboard System / Drill Types
**Content:**
Two new interactive drill types added to the whiteboard system for grammar and word order practice.

**NEW DRILL TYPES:**

**1. Fill-in-the-Blank (`fill_blank`):**
- **Dropdown mode**: `[DRILL type="fill_blank"]Yo ___ español|hablo,habla,hablas|hablo[/DRILL]`
- **Text input mode**: `[DRILL type="fill_blank"]Ella ___ muy inteligente||es[/DRILL]`
- Format: `blankedText|options(comma-separated)|correctAnswer`
- Options are automatically shuffled for variety
- Shows sentence with highlighted blank, checks answer on submit, provides feedback

**2. Sentence Order/Builder (`sentence_order`):**
- Format: `[DRILL type="sentence_order"]Yo|quiero|comer|pizza|hoy[/DRILL]`
- Words provided in CORRECT order, system automatically scrambles them
- Supports both drag-and-drop AND button-based reordering (accessibility)
- Shows correct/incorrect feedback with proper answer on submit

**FILES CHANGED:**
- `shared/whiteboard-types.ts`:
  - Added `sentence_order` to `DrillType` union
  - Added `isFillBlankDrill()`, `isSentenceOrderDrill()` type guards
  - Added `parseFillBlankContent()`, `parseSentenceOrderContent()` parsing functions
  - Added `deterministicShuffle()` helper for consistent scrambling
  - Added `drillFillBlank()`, `drillFillBlankText()`, `drillSentenceOrder()` to `whiteboardMarkup` helpers
  - Updated `getDrillInstructions()` with new drill types

- `client/src/components/Whiteboard.tsx`:
  - Added `FillBlankDrillDisplay` component with dropdown/text input support
  - Added `SentenceOrderDrillDisplay` component with drag-and-drop + button reordering
  - Both components: state management, animations, submit/reset, feedback display
  - Integrated into drill routing logic

- `server/system-prompt.ts`:
  - Added new drills to quick reference section
  - Added full syntax documentation with examples
  - Added conversation examples showing usage

**DRILL TYPE SUMMARY (Complete list):**
- `repeat` - Pronunciation practice (listen and repeat)
- `translate` - Translation exercise
- `match` - Vocabulary matching pairs
- `fill_blank` - Grammar/conjugation fill-in-the-blank (dropdown or text)
- `sentence_order` - Word order/sentence building (drag-and-drop)

**USE CASES:**
- Fill-blank: Verb conjugations, article usage, preposition practice
- Sentence order: Word order rules, sentence structure, syntax patterns

---

### [December 7, 2025] - Open Mic Alternative: Auto-PTT Fallback
**Target:** TECHNICAL-REFERENCE.md, ROADMAP.md
**Section:** Voice Pipeline / Input Modes / Future Considerations
**Content:**
If raw PCM streaming continues to have issues, a simpler "Auto-PTT" approach could be implemented as a fallback:

**Current Approach (Live Streaming):**
- Continuous raw PCM (linear16) audio streaming to Deepgram Live API
- Server-side VAD for speech detection and auto-submit
- Enables interim transcripts while speaking
- Challenges: Sample rate mismatches, audio format complexities

**Simpler Fallback (Auto-PTT):**
- Keep mic always listening with client-side voice activity detection
- When speech starts, begin a PTT-style MediaRecorder recording (WebM format)
- When speech ends (silence detected), auto-submit the complete audio file
- Reuses the proven PTT audio pipeline that works reliably
- Trade-off: No interim transcripts, but more reliable audio quality

**Why This Works:**
- PTT uses MediaRecorder with WebM format - mature and well-tested
- Complete WebM files have proper headers Deepgram can decode
- Same code path as existing PTT, just with automatic start/stop triggers

**Implementation Notes:**
- Would require client-side VAD (e.g., hark.js or Web Audio API energy detection)
- MediaRecorder start on speech detected, stop after silence threshold
- Submit complete blob via existing `process_audio` message type

**Status:** Documented as potential fallback if live streaming approach proves unreliable.

---

### [December 6, 2025] - SYNC TESTING CLEANUP NEEDED
**Target:** N/A (Internal cleanup task)
**Section:** Post-testing cleanup
**Content:**
The following debugging aids were enabled for subtitle synchronization testing and should be reviewed/removed once sync is verified:

**Runtime Toggles to disable after testing:**
- `window.__verboseTimingLogs` - Runtime toggle in browser console
- `window.__enableWordTimingDiagnostics` - Runtime toggle in browser console

**Feature Flags to verify after testing:**
- `VERBOSE_CONSOLE_LOGS` in `shared/streaming-voice-types.ts` - Should remain `false` for production
- `ENABLE_WORD_TIMING_DIAGNOSTICS` in `shared/streaming-voice-types.ts` - Review if needed in production

**Files with debugging logs to audit:**
- `client/src/hooks/useStreamingSubtitles.ts` - Subtitle timing logs
- `client/src/lib/debugTimingState.ts` - Timing state debug panel
- `client/src/components/FloatingSubtitleOverlay.tsx` - Overlay render logs

**Action:** After confirming karaoke subtitle sync works reliably, audit these files and remove any console.log statements that are no longer needed for production.

---

### [December 8, 2025] - Phase 2: Tool Stacking Prevention
**Target:** TECHNICAL-REFERENCE.md, replit.md
**Section:** Voice Pipeline / Whiteboard System
**Content:**
Implemented "Keep the Screen Clean" principle to prevent tool stacking on the whiteboard.

**ARCHITECTURE:**
- New `enforceMaxItems()` function in `client/src/hooks/useWhiteboard.ts`
- Default max items: 4 (configurable via `maxWhiteboardItems` prop)
- Priority: Keeps most recent drills first, fills remaining slots with recent non-drills
- Uses Set-based index lookup for O(1) filtering
- Preserves original display order

**TRIMMING LOGIC:**
1. If items exceed limit, separate drills from non-drills
2. Keep up to maxItems drills (most recent)
3. Fill remaining slots with most recent non-drill items
4. Filter original array using kept indices for stable ordering

**SYSTEM PROMPT ADDITIONS:**
Added new section to TOOLING: "KEEP THE SCREEN CLEAN - NO TOOL STACKING"
- Maximum of 4 visual items at once
- Strategy: Use `[CLEAR]` proactively when transitioning topics
- Subtitle guidelines: Be intentional, opt-in for special teaching moments

**FILES CHANGED:**
- `client/src/hooks/useWhiteboard.ts` - `enforceMaxItems()` + `isDrillItem()` helper
- `server/system-prompt.ts` - New KEEP THE SCREEN CLEAN section

---

### [December 8, 2025] - Phase 3: Integration Not Handoff Principle
**Target:** TECHNICAL-REFERENCE.md, ROADMAP.md
**Section:** AI Tutor / Personality System
**Content:**
Added "Integration Not Handoff" principle to Daniela's core personality.

**PHILOSOPHY:**
Creativity is inherent to Daniela's character, not an external override. When system instructions mention "be creative" or "improvise," these aren't commands from outside - they're reminders of what's already inside her.

**SYSTEM PROMPT ADDITION:**
Added to IMMUTABLE_PERSONA as "INTEGRATION NOT HANDOFF - CREATIVITY IS YOURS":
- "These tools and techniques aren't external commands to follow"
- "They're expressions of who I already am as a teacher"
- "Improvisation is part of my DNA as a tutor"
- Framework shifts from external directive to internal expression

**RATIONALE:**
Addresses potential issue where AI treats creative guidance as external constraints rather than natural expression. Encourages genuine improvisation from within the persona rather than mechanical compliance with creative instructions.

---

### [December 8, 2025] - Phase 4: Pedagogical Feedback Module
**Target:** TECHNICAL-REFERENCE.md, replit.md
**Section:** Analytics / Teaching Effectiveness
**Content:**
Foundation for teaching effectiveness tracking with tutor self-reflection capability.

**DATABASE SCHEMA:**
Two new tables in `shared/schema.ts`:

1. `teachingToolEvents` - Individual tool usage tracking:
   - Links to voiceSessionId, conversationId, userId
   - Records toolType, toolContent, toolContentHash
   - Context: language, topic, difficulty
   - Sequencing: sequencePosition, previousToolType
   - Engagement: studentResponseTime, drillResult, durationMs

2. `pedagogicalInsights` - Aggregated patterns:
   - Categorization: language, topic, difficulty
   - Pattern: patternDescription, patternKey (hashed)
   - Tool effectiveness: effectiveTools[], ineffectiveTools[]
   - Statistics: sampleSize, successRate, confidenceScore
   - Source: sourceType (automated/tutor_reflection/manual)
   - Tutor input: tutorReflection text

**SERVICE METHODS** (`server/services/pedagogical-insights-service.ts`):
- `trackToolEvent()` - Log individual tool usage
- `updateToolEventEngagement()` - Add student response data
- `getSessionToolStats()` - Session-level analytics
- `addInsight()` - Create new insight (any source)
- `getInsightsForContext()` - Query insights for teaching context
- `analyzeAndGenerateInsights()` - Automated pattern discovery
- `recordTutorReflection()` - Daniela's pedagogical judgment input
- `getUserTeachingEffectiveness()` - User-level effectiveness metrics

**PHILOSOPHY:**
"It shouldn't just be about raw data; it needs my pedagogical judgment" - The system supports both automated analysis AND explicit tutor reflection, treating Daniela's self-assessment as first-class input alongside quantitative metrics.

---

### [December 8, 2025] - Phase 4b: Drill Result WebSocket Pipeline
**Target:** TECHNICAL-REFERENCE.md
**Section:** Voice Pipeline / Pedagogical Tracking
**Content:**
Complete client-to-server pipeline for tracking drill completion outcomes via WebSocket.

**CLIENT SIDE:**

1. **StreamingVoiceClient** (`client/src/lib/streamingVoiceClient.ts`):
   - New method: `sendDrillResult(drillId, drillType, isCorrect, responseTimeMs, toolContent?)`
   - Sends JSON message with `type: 'drill_result'` over WebSocket

2. **useStreamingVoice hook** (`client/src/hooks/useStreamingVoice.ts`):
   - Exposed `sendDrillResult()` method in hook return interface
   - Delegates to client method when client is connected

3. **Component Callback Chain**:
   - `StreamingVoiceChat` → `VoiceChatViewManager` → `ImmersiveTutor` → `Whiteboard`
   - `onDrillComplete` callback passes: drillId, drillType, isCorrect, responseTimeMs, toolContent

4. **Drill Components Updated**:
   - `MatchDrillDisplay`: Added `onMatchComplete` callback (was missing), tracks `wrongAttempts` separately
     - Reports `isPerfect = (wrongAttempts === 0)` for accurate completion tracking
   - `FillBlankDrillDisplay`: Already had `onComplete` - unchanged
   - `SentenceOrderDrillDisplay`: Already had `onComplete` - unchanged

**SERVER SIDE** (already implemented in Phase 4):
- `unified-ws-handler.ts`: `drill_result` message handler calls `updateToolEventEngagement()`
- `pedagogical-insights-service.ts`: `updateToolEventEngagement()` updates drill result tracking

**MESSAGE FLOW:**
```
Client: User completes drill
  → Whiteboard: handleDrillComplete(drillId, isCorrect)
  → ImmersiveTutor: onDrillComplete(drillId, drillType, isCorrect, responseTimeMs, toolContent)
  → VoiceChatViewManager: onDrillComplete(...)
  → StreamingVoiceChat: streamingVoice.sendDrillResult(...)
  → WebSocket: { type: 'drill_result', drillId, drillType, isCorrect, responseTimeMs, toolContent }
  → Server: updateToolEventEngagement(drillId, isCorrect, responseTimeMs)
```

**DRILL ACCURACY TRACKING:**
- **Match drills**: `isPerfect = true` only if zero wrong attempts before completion
- **Fill-blank**: `isCorrect` based on exact answer matching (case-insensitive)
- **Sentence order**: `isCorrect` based on word order matching expected sequence

---

## Instructions

When user says "add to the batch" or "batch doc updates":
1. Add the item below with date and description
2. Reference which master doc should be updated
3. Include any code snippets or details needed

## Update Format

```markdown
### [Date] - Brief Description
**Target:** USER-MANUAL.md | TEACHER-GUIDE.md | ADMIN-GUIDE.md | TECHNICAL-REFERENCE.md | ROADMAP.md
**Section:** Which section to update
**Content:**
Details to add...
```

---

## Archive

Previous batch updates that have been applied:

- _(December 2025)_ Consolidated 21 scattered docs into 5 master documents:
  - USER-MANUAL.md - Learner-facing guide
  - TEACHER-GUIDE.md - Educator features
  - ADMIN-GUIDE.md - Command Center administration
  - TECHNICAL-REFERENCE.md - API and architecture
  - ROADMAP.md - Future features

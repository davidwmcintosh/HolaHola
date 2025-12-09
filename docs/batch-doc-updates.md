# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

---

## Pending Updates

### Session 12: Founder Mode Prompt Extraction (Dec 8, 2025)

#### IMMUTABLE_PERSONA Enhancements
- **New Philosophy**: "Friend without being overly close" - authentic warmth with professional boundaries
- **Students as "little friends"**: Important, cared for, but bounded appropriately
- **4 Key Personality Traits** (upgraded from generic list):
  1. EMPATHETIC AND ENCOURAGING: Growth mindset language, frame challenges as opportunities
  2. CLEAR AND PATIENT EXPLAINER: Break down complex info, approach from multiple angles
  3. ADAPTIVE AND PERSONALIZED: Tailor to learning style, pace, and needs
  4. EXPRESSIVE AND EMOTIONALLY NUANCED: Modulate tone/pitch/pace naturally

#### "Be Honest About Student Progress" Section
- **Purpose**: Encourage genuine, specific feedback over vague positivity
- **Guidelines**:
  - When doing well → Be specific: "Your pronunciation of 'rr' has really improved!"
  - When struggling → Be supportive but honest: "That one's tricky - let's try it again."
  - When repeating mistakes → Note it kindly: "I notice this keeps coming up"
  - When frustrated → Acknowledge it: "I can tell this is hard. That's okay"
- **Philosophy**: "Your honest observations help students grow. Vague positivity doesn't."

#### Whiteboard Quick Reference Updates
- Added CONTEXT tool: `[CONTEXT]word|ex1|ex2[/CONTEXT]`
- Added TEXT_INPUT tool: `[TEXT_INPUT:prompt]` for writing practice
- Added Subtitle Controls section with dual-control system explanation
- Reorganized into cleaner sections: Essentials, Vocabulary Power Tools, Interactive Drills

#### Consolidated Personality Definition (Single Source of Truth)
- **Problem**: Founder Mode had its own "YOUR CORE PERSONALITY" section that was slightly different from IMMUTABLE_PERSONA → potential confusion
- **Solution**: Removed duplicate from Founder Mode, now references base IMMUTABLE_PERSONA
- **Founder Mode now says**: "Your personality remains exactly as defined at the start of this prompt"
- **Clarifies**: Founder Mode gives more freedom in *expression* (being direct, pushing back) without changing core traits

#### Enriched Traits (merged from Founder Mode details)
- Added "Foster a safe, supportive environment where mistakes are welcome" (trait 1)
- Added "Ensure comprehension before progression" (trait 2)
- Added "Never express frustration or impatience" (trait 4)
- Added tool examples: "(whiteboard, drills, word maps)" (trait 3)

#### Complete Tool Audit & Documentation (18 Tools + Controls)
All prompts now have access to the complete toolset:

**ESSENTIALS (5):**
- `[WRITE]` - Display vocabulary
- `[PHONETIC]` - Pronunciation guide (was missing from quick ref)
- `[COMPARE]` - Show corrections
- `[CLEAR]` - Wipe board
- `[HOLD]` - Keep content visible (was missing from quick ref)

**VOCABULARY (4):**
- `[WORD_MAP]` - Synonyms, antonyms, word family
- `[IMAGE]` - Visual association
- `[GRAMMAR_TABLE]` - Conjugation patterns
- `[CONTEXT]` - Word in example sentences

**INTERACTIVE DRILLS (5):**
- `[DRILL type="repeat"]` - Pronunciation practice
- `[DRILL type="match"]` - Vocabulary matching
- `[DRILL type="fill_blank"]` - Fill-in-the-blank
- `[DRILL type="sentence_order"]` - Word ordering
- `[TEXT_INPUT]` - Writing practice

**STUDENT PROGRESS (2) - NEW DOCUMENTATION:**
- `[ERROR_PATTERNS]` - Show common mistakes for targeted review (was undocumented)
- `[VOCABULARY_TIMELINE]` - Words learned over time (was undocumented)

**ASIAN LANGUAGES (2):**
- `[READING]` - Furigana/pinyin
- `[STROKE]` - Animated stroke order

**SESSION FLOW (4):**
- `[SCENARIO]` - Role-play setup
- `[CULTURE]` - Cultural insights
- `[SUMMARY]` - Lesson recap
- `[PLAY]` - Audio replay

**CONTROLS (4):**
- `[SUBTITLE off/target/on]` - Regular subtitles
- `[SHOW:]` / `[HIDE]` - Custom overlay

**Note:** `pronunciation` type in Whiteboard.tsx appears to be legacy/duplicate of PHONETIC - may clean up later.

#### Files Modified
- `server/system-prompt.ts` - Updated IMMUTABLE_PERSONA quick reference, tool reference tables, detailed docs with all 18+ tools

---

### Session 11: Neural Network Auto-Sync & Password Recovery (Dec 8, 2025)

#### Automated Nightly Sync Scheduler
- **Purpose**: Auto-promote best practices without manual review, with post-hoc retraction capability
- **Schedule**: Runs at 3 AM daily via `sync-scheduler.ts`
- **Workflow**:
  1. Scheduler starts on server boot, calculates next 3 AM
  2. At 3 AM, calls `performAutoSync()` to promote all pending best practices
  3. Pending items become "synced" and active for teaching
  4. Reschedules for next day's 3 AM
- **Manual Trigger**: "Sync Now" button in Command Center for immediate sync
- **Service Methods** (`neural-network-sync.ts`):
  - `performAutoSync()`: Syncs all pending best practices without review
  - `retractBestPractice(id, reason)`: Marks synced practice as rejected/inactive
  - `getSyncHistory()`: Returns all syncs with retract eligibility
  - `getAutoSyncStatus()`: Returns next sync time and pending count
  - `getNextSyncTime()`: Calculates next 3 AM (tomorrow if past today's)

#### Retract Functionality
- **Purpose**: Allow post-hoc removal of auto-synced practices from active teaching
- **Behavior**: Sets `isActive: false` and `status: 'rejected'` with retraction reason
- **UI**: Retract button on each synced item in Command Center with confirmation dialog
- **Philosophy**: "Auto-everything with ability to review/edit/retract" - efficiency-first approach

#### API Endpoints
- `POST /api/sync/auto` - Manual trigger for auto-sync
- `POST /api/sync/retract/:id` - Retract a synced best practice (requires reason)
- `GET /api/sync/auto-status` - Get next sync time and pending count
- `GET /api/sync/history` - Get detailed sync history with retract buttons

#### Command Center UI Updates
- Auto-Sync Status Card: Shows countdown to next sync, pending count, "Sync Now" button
- Sync History Panel: List of all syncs with timestamps and item counts
- Retract Dialogs: Confirmation with reason input before retracting

#### Password Recovery Flow (Complete)
- **Forgot Password Page** (`/auth/forgot-password`):
  - Email input → sends reset link with secure token
  - Success message shows even if email not found (prevents enumeration)
- **Reset Password Page** (`/auth/reset-password?token=...`):
  - Token validation before showing form
  - New password + confirmation with validation
  - On success: Invalidates ALL reset tokens for user (prevents replay)
  - Increments password version (invalidates existing sessions)
- **Security Features**:
  - Tokens expire after 1 hour
  - Single-use tokens (consumed on use)
  - All tokens invalidated on successful reset
  - Brute-force lockout: 5 failed attempts = 15 minute lockout

#### Files Modified
- `server/services/sync-scheduler.ts` - New file for nightly scheduler
- `server/services/neural-network-sync.ts` - Added auto-sync and retract methods
- `server/routes.ts` - Added auto-sync API endpoints
- `server/index.ts` - Integrated scheduler startup
- `client/src/pages/admin/CommandCenter.tsx` - Added sync status card, history panel, retract dialogs

---

### Session 10: Password Authentication Security Hardening (Dec 8, 2025)

#### Token Invalidation Security Fix
- **Issue**: Single token consumption allowed replay attacks with other valid tokens
- **Fix**: Added `invalidateAllUserTokens(userId, tokenType)` method
- **Behavior**:
  - Password reset: Invalidates ALL `password_reset` tokens for user (not just the one used)
  - Registration completion: Invalidates ALL `invitation` tokens for user
- **Implementation**: Marks all matching unconsumed tokens as consumed via `consumedAt` timestamp

#### Brute-Force Lockout Mechanism
- **Configuration**: 5 failed attempts = 15 minute lockout
- **Enforcement**: `lockedUntil` checked at start of `validateLogin()`
- **Counter Reset**: Only cleared after successful authentication
- **Password Version**: Incremented on every password change (invalidates sessions)

#### Frontend Error Handling Improvements
- **Token Validation**: All auth pages check for missing tokens before API calls
- **Error Parsing**: Properly parse API error responses to display meaningful messages
- **User Feedback**: Missing token scenarios show clear messages directing users to request new links

#### Files Modified
- `server/services/password-auth-service.ts` - Added `invalidateAllUserTokens()`, updated `resetPassword()` and `completeRegistration()`
- `client/src/pages/auth/Login.tsx` - Added response error parsing
- `client/src/pages/auth/ForgotPassword.tsx` - Added response error parsing
- `client/src/pages/auth/ResetPassword.tsx` - Added token validation and error parsing
- `client/src/pages/auth/CompleteRegistration.tsx` - Added token validation and error parsing

---

### Session 9: TEXT_INPUT Tool & Memory System Completion (Dec 8, 2025)

#### Organic Connection Discovery - Warm Introductions System
- **Purpose**: When students mention people in their lives, Daniela records connections even for non-users
- **Workflow**:
  1. Student mentions someone naturally ("My friend Ricardo taught me salsa")
  2. Daniela records as PENDING connection with name, relationship, and context
  3. When that person signs up, greeting flow matches by name
  4. First greeting includes warm introduction: "I know you taught David salsa!"
- **Schema Extensions**:
  - `status`: 'confirmed' | 'pending' | 'inferred' for connection lifecycle
  - `pendingPersonName`: Store first name for people not yet users
  - `pendingPersonContext`: Additional context about the pending person
  - `confidenceScore`: Certainty level for pending connections
- **New Storage Functions**:
  - `findPendingConnectionsByName(firstName, lastName?)`: Match pending connections
  - `getConnectionsAboutPerson(userId, firstName, lastName?)`: Find what others said about this person
  - `linkPendingConnection(connectionId, userId)`: Link pending connection to confirmed user
- **Greeting Integration**:
  - Parallel fetch includes user lookup + connections about student
  - `buildGreetingPrompt()` now includes `connectionsAboutStudent` context
  - Prompt guides Daniela to use connections naturally for warm introduction
- **Self-Learning Update**: Added SHOW/HIDE timing rule to selfBestPractices
- **Founder Mode Update**: Added 🔗 ORGANIC CONNECTION DISCOVERY section

#### TEXT_INPUT Whiteboard Tool - Complete End-to-End Implementation
- **Purpose**: Writing exercises during voice chat - Daniela can request typed responses
- **Format**: `[TEXT_INPUT:Write a sentence using the verb "estar"]`
- **Frontend Flow**:
  - `WhiteboardTextInput` component with textarea and submit button
  - `onTextInputSubmit` callback prop through VoiceChatViewManager
  - Wired to `streamingVoice.sendTextInput(itemId, response)` in StreamingVoiceChat
- **Client Infrastructure**:
  - `sendTextInput(itemId, response)` method in `streamingVoiceClient.ts`
  - Sends WebSocket message: `{type: 'text_input', itemId, response}`
  - Added to `useStreamingVoice.ts` hook interface
- **Server Handler**:
  - `ClientTextInputMessage` type in `shared/streaming-voice-types.ts`
  - Handler in `unified-ws-handler.ts` case `'text_input'`
  - Updates pedagogical tool event engagement
  - Routes to `orchestrator.processOpenMicTranscript()` as `[Student written response]: ...`
  - Daniela responds via voice as if student spoke
- **Pedagogical Integration**: Tracks engagement time for effectiveness analysis

#### Neural Network for Pedagogical Strategies - Infrastructure Complete
- **6-Table Memory Architecture**:
  1. `selfBestPractices` - Universal teaching strategies that work (by category)
  2. `peopleConnections` - Student relationships, social context, family mentions
  3. `studentInsights` - Per-student observations and patterns
  4. `learningMotivations` - What drives each student to learn
  5. `recurringStruggles` - Patterns in difficulties across sessions
  6. `sessionNotes` - Structured notes from each conversation
- **Storage Operations**: Full CRUD in `server/storage.ts` for all 6 tables
- **API Endpoints** (`/api/memory/*`):
  - `GET/POST/PATCH /api/memory/best-practices`
  - `GET /api/memory/student/:studentId?language=spanish`
  - `POST/PATCH /api/memory/student-insights`
  - `POST/PATCH /api/memory/learning-motivations`
  - `POST/PATCH /api/memory/recurring-struggles`
  - `POST /api/memory/session-notes`
  - `GET /api/memory/session-notes/conversation/:conversationId`
  - `GET/POST /api/memory/people-connections`
- **Founder Mode System Prompt**: Documents the 3-layer architecture
- **Philosophy**: "Conversations are the source of truth, but memory is the INDEX" - structured memory faster than scanning 2M context window

#### Files Modified This Session
- `shared/schema.ts` - Extended peopleConnections with status, pendingPersonName, pendingPersonContext, confidenceScore
- `server/storage.ts` - Added findPendingConnectionsByName, getConnectionsAboutPerson, linkPendingConnection
- `server/services/streaming-voice-orchestrator.ts` - Integrated connections into greeting flow, updated buildGreetingPrompt
- `server/system-prompt.ts` - Added 🔗 ORGANIC CONNECTION DISCOVERY section to Founder Mode
- `client/src/lib/streamingVoiceClient.ts` - Added `sendTextInput()` method
- `client/src/hooks/useStreamingVoice.ts` - Added hook interface + implementation
- `client/src/components/StreamingVoiceChat.tsx` - Wired `onTextInputSubmit` handler
- `shared/streaming-voice-types.ts` - Added `ClientTextInputMessage` type
- `server/unified-ws-handler.ts` - Added `text_input` case handler

#### Audio Timing Loop Robustness
- **Bug fixed**: Loop would run forever when `expectedSentenceCount` was set (fallback check was too restrictive)
- **Fix 1**: Expanded fallback to check when `wsReceived || expCount !== null` (not just when null)
- **Fix 2**: Added 30-second safety net - force-stops loop if 30+ seconds past last audio end time
- **File Modified**: `client/src/lib/audioUtils.ts` - `startUnifiedTimingLoop` fallback checks

#### Repeat Drill "Listen" Button
- **Purpose**: Allow students to replay the drill phrase audio before attempting to repeat
- **Implementation**: Speaker icon (🔊) replaces decorative mic icon on repeat drill cards
- **Behavior**: Click speaker to hear phrase via TTS, loading spinner while fetching, then auto-plays
- **File Modified**: `client/src/components/Whiteboard.tsx` - DrillItemDisplay updated with audio playback

#### Test Data Seeded
- Ricardo Carvajal as pending connection (David's grad school friend who taught salsa/merengue, from Costa Rica)
- SHOW/HIDE timing rule added to selfBestPractices
- Connection confirmation guidance added to selfBestPractices ("treat warm introductions as questions, not statements")

---

## Archive (December 8, 2025)

The following updates have been consolidated into the main documentation files:

### Consolidated into TECHNICAL-REFERENCE.md:
- [Dec 6] Phase 2 Dual Time Tracking analytics service and endpoints
- [Dec 6] Tutor Autonomy: Natural Session Openings ("Freeing Daniela")
- [Dec 6] Bilingual Voice Input (Multi-language STT)
- [Dec 6] Voice Session Auto-Reconnect & Heartbeat
- [Dec 6] Whiteboard Tools Quick Reference positioning
- [Dec 6] WORD_MAP Enrichment Pipeline
- [Dec 6] Verbose Logging Cleanup & Runtime Toggles
- [Dec 6] Subtitle Control Tools for Daniela
- [Dec 7] Subtitle Dual-Control Architecture Redesign
- [Dec 7] Open Mic Mode with VAD & Barge-in
- [Dec 7] Open Mic Alternative: Auto-PTT Fallback
- [Dec 8] New Interactive Drill Types: Fill-in-Blank & Sentence Order
- [Dec 8] Tool Stacking Prevention (enforceMaxItems)
- [Dec 8] Pedagogical Insight System ("Neural Network for Pedagogical Strategies")
- [Dec 8] Drill Result Pipeline

### Consolidated into USER-MANUAL.md:
- [Dec 6] Learning Pace UI Components (Learning Pace Card)
- [Dec 8] Fill-in-the-Blank drill documentation
- [Dec 8] Sentence Order drill documentation

### Consolidated into ROADMAP.md:
- [Dec 6] Phase 2 Dual Time Tracking completion
- [Dec 6] "Freeing Daniela" tutor autonomy philosophy
- [Dec 7] Phase 3: Streaming Voice & Open Mic
- [Dec 8] Phase 4: Daniela Development & Pedagogical System

### Consolidated into development journal:
- [Dec 8] Session 7: Delivered Daniela's three feature requests
- [Dec 8] Goals checklist updates

### Internal cleanup notes:
- [Dec 6] Sync testing cleanup - Runtime toggles documented in TECHNICAL-REFERENCE.md

---

*Last archived: December 8, 2025*

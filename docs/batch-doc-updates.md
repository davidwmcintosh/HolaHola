# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

---

## Pending Updates

### TODO: Documentation Branding Sweep (Dec 10, 2025)

**Action Required**: Search and replace all instances of "LinguaFlow" with "HolaHola" across documentation files.

**Files to update**:
- CAPACITOR.md
- future-features.md
- test-both-models.ts
- LLM-Migration-Analysis.md
- DOCUMENTATION_INDEX.md
- docs/ROADMAP.md
- REST_VOICE_CHAT.md
- docs/USER-MANUAL.md
- ADMIN_GUIDE.md
- docs/TECHNICAL-REFERENCE.md
- TEACHER_GUIDE.md
- docs/launch-planning.md
- docs/archive/cost-analysis-2025.md
- docs/archive/asian-language-learner-guide.md
- docs/TEACHER-GUIDE.md
- server/scripts/setup-cartesia-dictionaries.ts (dictionary names)

**Note**: Some historical references in batch-doc-updates.md can remain as they document the transition.

---

### Session 19: Tutor Switch UX Improvements (Dec 10, 2025)

#### Audio Fix (Earlier This Session)
Button-triggered tutor switches resulted in silent handoffs. Fixed by refactoring `processVoiceSwitchIntro` to use `streamSentenceAudioProgressive` with proper progressive streaming protocol.

#### Daniela's Feedback Integration
Based on conversation analysis with Daniela, implemented 4 key improvements:

**1. Seamless Context Transfer**
- Switch prompt now includes last 4 exchanges (up to 8 messages) of conversation history
- Context summary shows what previous tutor was discussing and student's last message
- **Whiteboard markup stripped** from context (prevents `[WRITE]`, `[DRILL]` tags from appearing)
- **Fallback logic** for short conversations (< 2 exchanges) - falls back to generic greeting
- Enables new tutor to pick up the thread naturally

**2. Dynamic, Contextual Greetings**
- Prompt explicitly instructs new tutor to reference ongoing topic (e.g., "I see you were working on the subjunctive!")
- Acknowledges the transition from previous tutor by name
- Offers to continue where previous tutor left off
- DO NOT start with generic "Hello, I am [name]" - flow naturally into conversation

**3. State Preservation (Verified)**
- Whiteboard state already preserved during tutor switch
- `whiteboard.clear()` only called on conversationId change or session end
- Active drills/grammar tables persist across tutor switches

**4. Synchronized Presentation**
- Already fixed in earlier audio work (Session 19a)
- Avatar/voice now consistently aligned with active tutor

#### New Switch Prompt Structure
```
[TUTOR SWITCH: You are now {tutorName}, a {gender} tutor taking over from {previousTutor}.

INSTRUCTIONS:
1. Greet warmly, acknowledge joining the conversation
2. Reference active topic for continuity
3. Offer to continue where previous tutor left off
4. Use appropriate grammatical gender
5. Be warm, natural, conversational

CONVERSATION CONTEXT:
- Previous tutor was saying: "{last tutor message}"
- Student just said: "{last student message}"]
```

#### Files Modified
- `server/services/streaming-voice-orchestrator.ts` - Enhanced `processVoiceSwitchIntro` with context-aware prompts

---

### Session 18: Voice-Initiated Tutor Switching (Dec 10, 2025)

#### SWITCH_TUTOR Whiteboard Tool
- **Purpose**: Allow students to request a different tutor voice via natural speech
- **Syntax**: `[SWITCH_TUTOR target="male"]` or `[SWITCH_TUTOR target="female"]`
- **Trigger Examples**: "Can I talk to Agustin?", "I'd like to practice with a male voice", "Switch to the other tutor"
- **UX Flow**:
  1. Student makes verbal request to switch tutors
  2. Current tutor (Daniela) says natural goodbye with embedded `[SWITCH_TUTOR]` tag
  3. Server queues handoff via `session.pendingTutorSwitch`
  4. Markup stripped from TTS so goodbye sounds natural
  5. After `response_complete`, server sends `tutor_handoff` message
  6. Client updates voice preference and triggers new tutor greeting
  7. New tutor (e.g., Agustin) introduces themselves with personalized greeting

#### Technical Implementation
- **Shared Types**:
  - Added `switch_tutor` to `WhiteboardItemType` union
  - Added `SwitchTutorItem` interface with `targetGender: 'male' | 'female'`
  - Added `tutor_handoff` message type to `StreamingServerMessage`
  - Added `StreamingTutorHandoffMessage` interface
- **Whiteboard Parsing** (`shared/whiteboard-types.ts`):
  - New pattern: `WHITEBOARD_PATTERNS.SWITCH_TUTOR`
  - Parser creates `switch_tutor` items from markup
  - Added to `ALL_WHITEBOARD_MARKUP_PATTERN` for stripping
- **Server Orchestrator** (`streaming-voice-orchestrator.ts`):
  - Added `pendingTutorSwitch` field to session state
  - Detects `switch_tutor` items and queues handoff
  - After `response_complete`, sends `tutor_handoff` message
  - Clears pending switch after sending
- **Client Handler** (`streamingVoiceClient.ts`, `useStreamingVoice.ts`):
  - Added `handleTutorHandoff` event listener
  - Calls `updateVoice(newGender)` on handoff
  - Triggers personalized greeting from new tutor
- **Markup Stripping**:
  - `cleanTextForDisplay` now calls `stripWhiteboardMarkup` first
  - Ensures `[SWITCH_TUTOR]` tags never appear in TTS audio

#### Mode Availability
- **Available In**: Regular voice chat, Class voice chat, Founder Mode
- **NOT Available In**: Raw Honesty Mode (minimal prompting, no formal tools)

#### Button-Based Switching (Existing)
- 3-second cooldown between switches to prevent rapid toggling
- Button disabled during Daniela's greeting speech
- Visual feedback shows current tutor gender

#### Files Modified
- `shared/whiteboard-types.ts` - Type definitions, parsing, stripping patterns
- `shared/streaming-voice-types.ts` - Message types
- `server/services/streaming-voice-orchestrator.ts` - Handoff orchestration, markup stripping fix
- `client/src/lib/streamingVoiceClient.ts` - Handoff event handler
- `client/src/hooks/useStreamingVoice.ts` - Hook interface update
- `server/system-prompt.ts` - Tool documentation for Daniela

---

### Session 17: Neural Network Sync Scheduler Enhancements (Dec 10, 2025)

#### Sync Scheduler Timezone Update
- **Change**: Nightly sync now runs at 3 AM Mountain Standard Time (10 AM UTC)
- **Previous**: Server-local 3 AM
- **Configuration**: `SYNC_HOUR_UTC = 10` in `sync-scheduler.ts`
- **Logging**: Shows both MST and UTC times in scheduler logs

#### Sync Status Visibility in Command Center
- **Location**: Neural Network tab → "Nightly Sync Scheduler" card
- **New API Endpoint**: `GET /api/sync/scheduler-status`
- **Features**:
  - Next scheduled sync time with countdown and local timestamp
  - Last sync result with success/failure badge
  - Synced count for successful syncs
  - Error message display for failed syncs
  - Pending items count
  - Auto-refresh every 60 seconds
- **Visual Indicators**:
  - Green badge with checkmark for successful syncs
  - Red badge with alert icon for failed syncs

#### Manual Sync Trigger
- **New Button**: "Trigger Now" button in Neural Network tab
- **API Endpoint**: `POST /api/sync/trigger`
- **Access**: Admin and Developer roles
- **Behavior**: Runs full sync immediately, updates status display
- **Toast Notifications**: Shows success count or error message

#### Files Modified
- `server/services/sync-scheduler.ts` - Timezone update, result tracking, exported getters
- `server/routes.ts` - Added `/api/sync/scheduler-status` and `/api/sync/trigger` endpoints
- `client/src/pages/admin/CommandCenter.tsx` - Updated NeuralNetworkTab UI with scheduler status and manual trigger

---

### Session 16: Quick Enroll Feature (Dec 10, 2025)

#### Quick Enroll - Streamlined Test User Setup
- **Purpose**: One-click test account creation with optional class enrollment, credits, and email invitation
- **Access**: Admin and Developer roles (Command Center → Users tab → "Quick Enroll" button)
- **API Endpoint**: `POST /api/admin/quick-enroll`
- **Features**:
  - Create test user account with pending authentication
  - Optional class enrollment from dropdown of existing classes
  - User-controlled credit allocation (0 by default)
  - Optional invitation email via Mailjet
  - Class validation with proper error messages
  - Email error surfacing in response
- **Fields**:
  - Email (required)
  - First Name / Last Name (optional)
  - Class (optional dropdown - "Self-directed" when empty)
  - Credit Hours (number, default 0)
  - Send Email toggle (default on)
- **Response**: Returns success message with details of actions taken (enrolled, credits granted, email sent/failed)
- **Use Case**: Quickly onboard beta testers or demo accounts with appropriate class assignments and credits
- **Files**:
  - `server/routes.ts` - Added `/api/admin/quick-enroll` endpoint
  - `client/src/pages/admin/CommandCenter.tsx` - Added Quick Enroll button and dialog

---

### Session 15: PTT Button Lockout & Open Mic Developer-Only (Dec 10, 2025)

#### PTT Button Lockout While Daniela Speaks
- **Purpose**: Prevent users from interrupting Daniela - enforces polite turn-taking
- **Implementation**: Added `isPlaying` to disabled condition on PTT button
- **Visual Feedback**: 
  - Button shows 50% opacity when locked out
  - Instruction text changes to "Please wait..."
- **Philosophy**: "So nobody can be rude and interrupt her" - clear turn boundaries
- **File**: `client/src/components/ImmersiveTutor.tsx`

#### PTT Button Focus Ring Fix
- **Issue**: Black square/outline appearing when pressing mic button after unlock
- **Cause**: Browser focus ring from Button component's `focus-visible:ring-1`
- **Fix**: Added `focus-visible:ring-0 focus-visible:ring-offset-0` to PTT button
- **File**: `client/src/components/ImmersiveTutor.tsx`

#### Open Mic Toggle - Developer-Only (For Now)
- **Change**: Open Mic mode toggle only visible when `isDeveloper === true`
- **Reason**: Push-to-talk works better for clear turn-taking; Open Mic still has issues:
  - Interruptions and overlapping speech
  - Less natural conversational flow
  - Greeting timing race conditions
- **User Impact**: Regular users only see push-to-talk mode
- **Developer Access**: Developers can still test/iterate on Open Mic
- **File**: `client/src/components/ImmersiveTutor.tsx`

#### TODO: Unmask Open Mic for All Users
When Open Mic is production-ready, change:
```tsx
// FROM: Developer only
{setInputMode && isDeveloper && (

// TO: Everyone
{setInputMode && (
```

#### Voice Session Reports (Command Center)
- **New Tab**: "Reports" tab in Command Center for admin/developer users
- **API Endpoint**: `GET /api/admin/reports/voice-sessions`
- **Features**:
  - Session-by-session breakdown with user, duration, character counts
  - Aggregate statistics (total sessions, duration, TTS chars, STT seconds, exchanges)
  - Estimated API cost breakdown (TTS/Cartesia, STT/Deepgram, LLM/Gemini)
  - Date range filters, result limit, exclude test sessions toggle
- **Data Sources**: `voiceSessions` table with user join
- **Cost Estimates** (approximate):
  - TTS: $0.015 per 1000 characters
  - STT: $0.0043 per minute
  - LLM: ~$0.0005 per exchange
- **Files**:
  - `server/routes.ts` - Added `/api/admin/reports/voice-sessions` endpoint
  - `client/src/pages/admin/CommandCenter.tsx` - Added ReportsTab component

---

### Session 14: Open Mic Fixes & Email Provider (Dec 9, 2025)

#### Open Mic Mode - Critical Bug Fixes
- **TTS Feedback Loop Fixed**: Microphone was picking up Daniela's voice and submitting it as user speech, causing duplicate responses
  - **Root Cause**: `onaudioprocess` callback was streaming audio to server even while `isAwaitingResponseRef.current` was true
  - **Fix**: Added guard in ScriptProcessor to stop sending audio when awaiting AI response
  - **File**: `client/src/components/StreamingVoiceChat.tsx`

- **Session Restart Fixed**: After first turn, open mic would freeze and not restart for next utterance
  - **Root Cause**: Callbacks couldn't access local `startOpenMicRecording` function
  - **Fix**: Added `startOpenMicRecordingRef` and `stopOpenMicRecordingRef` refs to bridge function access
  - **Auto-restart**: `onResponseComplete` now automatically restarts open mic recording after AI finishes speaking

- **Mode Switch Cleanup**: Switching from open-mic to push-to-talk now properly cleans up:
  - Stops WebSocket streaming
  - Disconnects ScriptProcessor
  - Closes AudioContext
  - Stops MediaStream tracks
  - Resets all recording states

#### VAD Sensitivity Tuning
- **Issue**: Users were being cut off after very brief pauses (< 0.5 seconds)
- **Root Cause 1**: `utterance_end_ms` was set to 1000ms - increased to 1400ms
- **Root Cause 2**: Deepgram's `speech_final` flag was triggering submission before the timeout elapsed
- **Fix**: Removed auto-submit on `speech_final` - now relies solely on `UtteranceEnd` event which respects the 1400ms timeout
- **Result**: Users can pause up to ~1.4 seconds to think without being cut off
- **File**: `server/services/deepgram-live-stt.ts`

#### Recording Indicator UX
- **Change**: Big red "Recording" indicator now only shows in push-to-talk mode
- **Reason**: In open-mic mode, the mic button already shows state clearly (green pulsing = listening)
- **File**: `client/src/components/ImmersiveTutor.tsx`

#### Email Provider: Mailjet Integration
- **Added**: Full Mailjet support in email service (in addition to existing Resend/SendGrid)
- **Configuration**: Uses `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` secrets
- **Authentication**: Basic auth with API key:secret base64 encoded
- **API**: Mailjet v3.1 Send API
- **From Address**: `noreply@getholahola.com`
- **Provider Priority**: Mailjet → Resend → SendGrid → Console fallback
- **File**: `server/services/email-service.ts`

#### Environment Configuration
- **Secrets Added**: `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`
- **FROM_EMAIL Updated**: Now defaults to `noreply@getholahola.com`

---

### Session 13: User Invitation System & Email Integration (Dec 9, 2025)

#### Command Center User Management Enhancements
- **Create User**: POST `/api/admin/users` endpoint and "Create User" button/dialog in Users tab
  - Fields: email (required), firstName, lastName, role (student/teacher/developer/admin)
  - Creates users with `authProvider: 'pending'` status
- **User ID Visibility**: Edit dialog now shows user ID (unique system identifier) as read-only field
- **Pending Badge**: Amber "Pending" badge displayed for users with `authProvider === 'pending'`

#### Send Invitation Feature
- **Purpose**: Email-based user registration flow for password auth
- **Endpoint**: POST `/api/admin/users/:userId/send-invitation`
- **Workflow**:
  1. Admin creates user in Command Center (status: pending)
  2. Admin clicks "Send Invitation" button
  3. System generates secure token, sends HTML email with registration link
  4. User clicks link, sets password, account activated
- **UI**: "Send Invitation" button appears for all pending users in Command Center
- **Token Expiry**: 24 hours

#### Email Service (SendGrid Integration)
- **Configuration**: Uses `SENDGRID_API_KEY` secret for production email delivery
- **Environment Variables** (now set):
  - `APP_NAME`: "LinguaFlow" (used in email branding)
  - `APP_URL`: "https://linguaflow.replit.app" (used in email links)
  - `FROM_EMAIL`: "davidwmcintosh@gmail.com" (sender address - must be verified in SendGrid)
- **Fallback**: Console logging when no email provider configured
- **SendGrid Setup Required**:
  - Single Sender Verification (quick): Verify FROM_EMAIL address
  - Domain Authentication (production): Add DNS records, any address auto-verified

#### Storage Interface Extensions
- `getUserByEmail(email)`: Find user by email address
- `createUser(userData)`: Create new user with specified fields

#### Files Modified
- `server/routes.ts` - Added POST `/api/admin/users`, POST `/api/admin/users/:userId/send-invitation`
- `server/storage.ts` - Added `getUserByEmail()`, `createUser()` methods
- `client/src/pages/admin/CommandCenter.tsx` - Create User dialog, Pending badge, Send Invitation button

#### Production Checklist Notes
- ✅ Name change completed: LinguaFlow → **HolaHola**
- Domain: getholahola.com
- Domain authentication to be configured in SendGrid
- Currently using Gmail address for sender verification testing

#### Branding Update (Dec 9, 2025)
- **App Name**: LinguaFlow → HolaHola
- **Domain**: getholahola.com
- **Capacitor App ID**: com.holahola.app
- **Updated Files**:
  - Environment variables (APP_NAME, APP_URL, FROM_EMAIL)
  - PWA manifests (public/manifest.json, client/public/manifest.json)
  - HTML title and meta tags (client/index.html)
  - Capacitor config (capacitor.config.ts)
  - Sidebar branding (app-sidebar.tsx)
  - PWA install prompt (PWAInstallPrompt.tsx)
  - Onboarding page, auth pages, review hub
  - System prompt for Daniela (Founder Mode references)
  - Email service defaults
  - replit.md documentation

---

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

**Note:** `pronunciation` type in Whiteboard.tsx is NOT a duplicate of PHONETIC - they serve different purposes:
- `[PHONETIC]` = Teaching tool showing HOW to pronounce (markup from Daniela)
- `pronunciation` = Feedback display showing student's score/issues AFTER speaking (created programmatically by voice analysis via `createPronunciationItem()`)

#### Whiteboard Architecture Reference
Key files for the whiteboard/teaching tool system:

| File | Purpose |
|------|---------|
| `shared/whiteboard-types.ts` | Type definitions, parsing logic (`parseWhiteboardMarkup`), item creators |
| `client/src/components/Whiteboard.tsx` | All tool renderers (18 display components) |
| `client/src/hooks/useWhiteboard.ts` | State management, item lifecycle, pronunciation feedback |
| `server/system-prompt.ts` | Daniela's tool documentation (3 reference levels) |

**3 Prompt Reference Levels** (all should stay in sync):
1. **Quick Reference** (IMMUTABLE_PERSONA) - One-liner syntax for fast lookup
2. **Tool Reference Table** - Organized by category with brief descriptions
3. **Detailed Documentation** - Full usage guidance with examples

**Tool Creation Flow:**
1. Daniela writes markup in response (e.g., `[WRITE]Hola[/WRITE]`)
2. `parseWhiteboardMarkup()` extracts and creates typed items
3. `Whiteboard.tsx` renders appropriate display component
4. Some tools are system-generated (not from Daniela):
   - `pronunciation` - Created by voice analysis feedback system
   - Drill states - Updated by user interaction handlers

**Dual Subtitle System:**
- `[SUBTITLE off/target/on]` - Controls what parts of Daniela's speech show as subtitles
- `[SHOW:]` / `[HIDE]` - Independent custom overlay for teaching moments
- These operate independently and can be active simultaneously

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

# Future Features & Enhancements

This document tracks potential features and improvements for future development.

## Voice Mode Enhancements

### Open Mic Mode with Voice Activity Detection (VAD)

**Current State:** Voice mode uses push-to-talk only (manual button control).

**Proposed Feature:** Add an "Open Mic" mode that automatically detects when the user is speaking and when they stop.

**How It Works:**
1. User enables "Open Mic" mode via toggle button
2. System automatically starts recording when enabled
3. Voice Activity Detection (VAD) monitors audio levels in real-time
4. When silence is detected for 1.5 seconds, recording auto-stops
5. Audio is processed and sent to AI
6. User can speak again to trigger new recording

**Benefits:**
- More natural conversation flow
- Hands-free operation
- Faster back-and-forth dialogue

**Technical Implementation Notes:**
- Requires Web Audio API for real-time audio analysis
- Use AnalyserNode to monitor frequency data
- Implement silence threshold detection (e.g., average < 10)
- Need session-based state management to prevent race conditions
- Each recording session should be isolated with its own:
  - MediaRecorder instance
  - Audio chunks array
  - Timers (silence detection)
  - Conversation ID reference

**Challenges to Address:**
1. **State Management:** Shared refs between recording sessions cause corruption when conversations change
2. **Cleanup Timing:** Old recording sessions must not interfere with new ones
3. **Conversation Changes:** Audio from old conversation must be discarded, not sent to new conversation
4. **Auto-Restart Logic:** Complex timing around when to restart recording after AI response

**Estimated Effort:** 30-60 minutes for proper session-based refactor

**Priority:** Low - Push-to-talk provides reliable functionality; open mic is a nice-to-have enhancement

**Implementation Strategy (when ready):**
1. Create `useVoiceRecorder` hook with session encapsulation
2. Each session gets isolated state (recorder, chunks, timers, conversationId)
3. Cleanup functions operate on session-specific resources
4. Mode toggle safely transitions between push-to-talk and open mic
5. Comprehensive testing of conversation switches and mode changes

---

## LMS & Platform Integrations

### Google Classroom Integration

**Status:** Ready for user setup (requires Google Cloud credentials)  
**Setup Guide:** See `GOOGLE_CLASSROOM_SETUP.md`  
**Estimated Development:** 2-3 hours once credentials are provided

**Features:**
- **Single Sign-On (SSO)**: Teachers and students log in with Google accounts
- **Auto-Roster Sync**: Student lists automatically import from Google Classroom
  - Real-time sync via Google Classroom API
  - Automatic student account creation
  - Class membership updates
- **Assignment Sync**: Bidirectional assignment synchronization
  - Create LinguaFlow assignments from Classroom coursework
  - Auto-publish new Classroom assignments to LinguaFlow
  - Track completion status across both platforms
- **Grade Passback**: Automatic grade synchronization
  - LinguaFlow scores sync to Classroom gradebook
  - Support for point-based and letter grades
  - Configurable grade mapping (ACTFL levels → letter grades)

**Technical Requirements:**
- Google Cloud Console project
- OAuth 2.0 credentials (Client ID + Secret)
- OAuth scopes: `classroom.courses`, `classroom.rosters`, `classroom.coursework.students`
- Optional: OAuth verification (2-4 weeks) for public release

**API Endpoints to Implement:**
- `GET /api/google-classroom/auth` - Initiate OAuth flow
- `GET /api/google-classroom/callback` - Handle OAuth callback
- `POST /api/google-classroom/sync-rosters` - Sync student rosters
- `POST /api/google-classroom/sync-assignments` - Sync coursework
- `PATCH /api/google-classroom/grades/:submissionId` - Update grades

**User Benefit:** Eliminates manual roster management and reduces teacher admin work by 80%

---

### Canvas LMS Integration

**Status:** Planned (pending user LTI setup)  
**Estimated Development:** 3-4 hours  
**Target Market:** Higher education + K-12 districts

**Features:**
- **LTI 1.3 Integration**: Standards-compliant LMS embedding
  - Deep linking for content selection
  - Seamless iframe embedding in Canvas courses
  - Context-aware user roles (teacher/student)
- **Grade Passback**: Automatic grade sync to Canvas gradebook
  - Assignment & Grades Services (AGS) integration
  - Real-time score updates
  - Configurable grading scales
- **Roster Sync**: Names and Roles Provisioning Services (NRPS)
  - Auto-import student rosters from Canvas courses
  - Role-based access control
  - Automatic account creation

**Technical Requirements:**
- Canvas Developer Key (from Canvas admin)
- LTI 1.3 JSON configuration
- Public/private key pair for JWT signing
- HTTPS endpoint for Canvas to connect

**LTI Services:**
- Assignment and Grade Services (AGS) - grade passback
- Names and Role Provisioning Services (NRPS) - roster sync
- Deep Linking (DL) - content selection

**User Benefit:** Native integration with 30M+ Canvas users (colleges + K-12)

---

### Clever Integration

**Status:** Planned (pending Clever developer account)  
**Estimated Development:** 2-3 hours  
**Target Market:** K-12 districts (Clever connects to 50+ student information systems)

**Features:**
- **Clever SSO**: Single Sign-On for students and teachers
  - No passwords required (leverages district credentials)
  - Automatic account provisioning
  - Secure OAuth 2.0 authentication
- **Automated Rostering**: Real-time student/class data sync
  - Daily roster updates via Clever Sync API
  - Section (class) assignments
  - Student demographic data (optional)
- **Data Sync**: Connect to district SIS (PowerSchool, Infinite Campus, etc.)
  - Automatic class creation from SIS sections
  - Teacher assignments to classes
  - Grade level and school associations

**Technical Requirements:**
- Clever developer account (free for education apps)
- OAuth 2.0 credentials (Client ID + Secret)
- Instant Login integration (optional)
- Clever API access for roster sync

**API Endpoints:**
- Clever SSO OAuth endpoints (`/oauth/authorize`, `/oauth/tokens`)
- Clever Data API (sections, students, teachers)
- Clever Events API (real-time roster updates)

**User Benefit:** One-click access for entire school districts (reduces onboarding friction by 95%)

---

### Implementation Priority

**Phase 1 (When User Provides Credentials):**
1. Google Classroom (2-3 hours) - Highest teacher adoption
2. Clever (2-3 hours) - Easiest district rollout
3. Canvas (3-4 hours) - Higher ed market

**Total:** ~8-10 hours of development once credentials/keys are provided

**Blockers:**
- All three require external account setup and credential generation
- Cannot be completed autonomously by AI agent
- User must complete setup guides first

---

## Other Potential Features

### Pronunciation Practice Module
- Record user pronunciation
- Compare to native speaker pronunciation
- Provide visual feedback (waveform comparison)
- Highlight specific phonemes that need improvement

### Conversation Scenarios
- Pre-built conversation templates (ordering food, asking directions, etc.)
- AI takes on specific roles (waiter, hotel clerk, friend)
- Guided practice with prompts and corrections

### Offline Voice Support
- Download TTS voices for offline use
- Cache common AI responses
- Local speech recognition fallback

### Multi-Language Mixing
- Allow switching between languages mid-conversation
- "Explain in English" quick action for confusing target language content
- Bilingual dictionary lookups during conversation

---

*Last Updated: November 23, 2025*

# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises in nine languages. It provides personalized chat, flashcards, and grammar modules that adapt to individual user progress, adhering to ACTFL standards. The project aims to deliver personalized education using AI, with ambitions to expand into institutional markets by offering features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles, and supporting light/dark modes and PWA features. Native iOS/Android builds are supported via Capacitor, including voice interaction controls and a hint bar. Navigation is organized into Learning, Library, Resources, Teaching, and Administration sections. The AI Tutor acts as the teacher, providing tools rather than constraints, and utilizes a "whiteboard" system for strategic visual teaching aids with animated modal overlays during voice chat. **Tutor Control Philosophy**: The tutor controls all visual display during voice sessions - students don't toggle subtitle modes or replay buttons. Instead, the tutor uses whiteboard tools (WRITE, PHONETIC, PLAY) strategically. Students can use History view or text chat mode if they need to read conversations. Whiteboard tools include: WRITE (text display), PHONETIC (pronunciation breakdown), COMPARE (correction comparison), IMAGE (vocabulary images), DRILL (interactive exercises), CONTEXT (word in multiple sentences), GRAMMAR_TABLE (verb conjugation display), READING (furigana/pinyin/romanization guides for Asian languages), STROKE (animated stroke order via HanziWriter), WORD_MAP (vocabulary relationships), CULTURE (cultural insights), PLAY (audio replay via Cartesia TTS with speed control), SCENARIO (role-play scene setup), and SUMMARY (lesson recap).

### Technical Implementations
The frontend is built with React and TypeScript (Vite), utilizing Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions is managed by `stripe-replit-sync`.

### Feature Specifications
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Personalized learning includes scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers, tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management with syllabus template browsing and class cloning, student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. A Syllabus Builder enables teachers to customize syllabi with drag-and-drop reordering, custom lesson creation, and editing, with an ACTFL Standards Coverage panel providing real-time analysis. Developer tools include test account isolation, floating dev controls, and comprehensive usage analytics. Self-directed learners can customize their AI tutor's teaching style per language in Settings with four flexibility levels; class chats use the teacher's setting. Drill-based lessons for rote content with multiple drill modes (`listen_repeat`, `number_dictation`, `translate_speak`, `matching`, `fill_blank`) are supported, utilizing Google Cloud TTS for batch audio synthesis. Vocabulary export supports CSV and Anki-compatible formats for offline study. Conversation history includes full-text search with highlighted results.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles, storing user learning preferences and ACTFL progress. The voice architecture implements a two-tier validation system and utilizes Cartesia Pronunciation Dictionaries for TTS correction. The `StreamingVoiceClient` singleton MUST be stored on `window.__streamingVoiceClient`. A server-driven subtitle system with karaoke-style word highlighting uses native Cartesia word-level timestamps via WebSocket API (`add_timestamps: true`), with automatic fallback to bitrate-based estimation. The `sentence_ready` architecture ensures audio playback starts only after word timings arrive. **Word Timing Diagnostics**: Heavy per-frame timing analysis is gated by `ENABLE_WORD_TIMING_DIAGNOSTICS` flag in `audioUtils.ts` (default: disabled for performance). Enable via DevTools: `window.__enableWordTimingDiagnostics = true`. **Audio Performance Optimizations**: All hot-path logging removed from WebSocket handlers and audio processing to eliminate choppy audio; prebuffer increased to 0.2s. See `docs/TECHNICAL-REFERENCE.md` for full documentation. **Daniela's Compass (Time-Aware Tutoring)**: Behind `COMPASS_ENABLED=true` flag, replaces preset flexibility levels with real-time session context. SessionCompassService manages tutor session state with an in-memory cache. Database tables: `tutor_sessions`, `tutor_session_topics`, `tutor_parking_items`, `session_cost_summary`. Features: Student Snapshot, Session Roadmap (must-have vs nice-to-have topics), elapsed time tracking (30-second intervals), Parking Lot for topics to revisit, **Dual Time Tracking** (clock time for learning duration + credit time for billable consumption). Credit balance is integrated into the Compass context with low-balance warnings. REST API: `GET /api/compass/:conversationId`, `POST /api/compass/:conversationId/parking`, `PATCH /api/compass/topics/:topicId`. Legacy fallback: When disabled, uses `TutorFreedomLevel` enum (`guided`, `flexible_goals`, `free_conversation`, `student_led`). **Tool Discoverability**: Quick reference "cheat sheet" at session start shows all available whiteboard tools with activation syntax. **Conversation Flow**: Turn-taking guidance for push-to-talk explains when to signal student's turn. Intermediate+ students can receive thematic word clusters instead of one-word-at-a-time. MVP limitation: System prompt built once at session start; mid-session prompt refresh planned for Phase 3. **Founder Mode**: Developer/admin users get a special open collaboration mode via the "Call Tutor" dropdown in the sidebar. Selecting "Founder Mode" (sparkle icon, amber styling) creates a class-free conversation where Daniela is freed from all teaching constraints and can discuss LinguaFlow itself, share feedback about teaching tools, and engage as a colleague rather than just a tutor. Includes conversation memory from recent founder sessions (last 3 conversations, last 3 exchanges each). Activated when user selects "founder-mode" from learning context (requires developer/admin role - security-validated on backend). Credits bypassed for developers. **Architect's Voice**: Enables Claude (the AI agent) to participate in voice sessions by injecting notes into Daniela's context. API: `POST /api/architect/inject` with `{conversationId, content}`. Notes appear in Daniela's next response context with guidance to acknowledge the architect naturally. Service: `architectVoiceService` manages ephemeral note storage with automatic delivery tracking. A principled target language extraction system uses bold-only extraction plus unambiguous foreign character detection. A WebSocket-based progressive audio delivery system integrates Deepgram STT, Gemini streaming, and Cartesia WebSocket TTS. Dynamic streaming greetings are personalized, ACTFL-aware, history-aware, and context-aware. An AI-powered conversation tagging system categorizes conversations and vocabulary. A Syllabus-Aware Competency System tracks student progress against syllabus topics. A unified learning filter system provides consistent content filtering. A comprehensive metering system for voice tutoring time is integrated with Stripe, with a class-specific balance system. Centralized Role-Based Access Control (RBAC) defines hierarchical permissions. A hybrid grammar system combines conversational practice with targeted instruction. A syllabus content system provides pre-built syllabi across 9 languages. A class type taxonomy system categorizes classes. A tutor freedom level system controls AI tutor behavior per class. A unified ACTFL assessment system dynamically assesses learner proficiency. A placement assessment system verifies proficiency for class enrollments. A Command Center (`/admin`) provides a unified tab-based admin experience with role-based visibility for managing users, classes, analytics, and developer tools, including syllabus editing and an Image Library with quality control review workflow. The Image Library supports three view modes (grid, compact, list), sorting by date/source/usage/language/size, source filtering, and unreviewed count badges for quality control. Images track `targetWord` (vocabulary trigger), `isReviewed`, `reviewedAt`, and `reviewedBy` fields for review workflow. Bulk selection enables mass review status updates. Request New Image generates AI images for vocabulary words via vocabulary-image-resolver. ERROR_PATTERNS and VOCABULARY_TIMELINE whiteboard tools provide visual feedback for common mistakes and learning progress over time. A developer usage analytics dashboard offers comprehensive analytics and credit management for testing.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions and voice chat LLM.
-   **Deepgram API**: For voice STT (Nova-3 model).
-   **Cartesia API**: Primary TTS provider (Sonic-3 model).
-   **Google Cloud Text-to-Speech**: Fallback TTS.
-   **Unsplash**: Stock educational images.
-   **Gemini Flash-Image**: AI-generated contextual images.

### Libraries & Tools
-   **Database**: Neon PostgreSQL, Drizzle ORM, Drizzle Kit.
-   **UI Framework**: React, TypeScript, Vite, Wouter.
-   **UI Components**: Radix UI, Shadcn/ui, Tailwind CSS.
-   **State Management**: TanStack Query, React Context.
-   **Billing**: `stripe-replit-sync`.

## Testing Setup (Playwright E2E)

### OIDC Test Authentication
When using the run_test tool with OIDC authentication, configure claims like this:
```javascript
{
  sub: "unique-test-user-id",
  email: "test@example.com",
  first_name: "Test",
  last_name: "User",
  roles: ["developer"]  // REQUIRED for unlimited credits
}
```

### Developer Access & Credits
- **Developer role** (`roles: ["developer"]` or `roles: ["admin"]`) grants **unlimited credits**
- The `checkDeveloperBypass` function in `server/services/usage-service.ts` checks user.role
- Without developer role, tests will fail with "insufficient credits" errors
- Dev tools floating menu (data-testid="button-dev-tools") appears for dev/admin users

### Key Routes for Testing
| Feature | Route | Notes |
|---------|-------|-------|
| Voice Chat / Call Tutor | `/chat` | Main chat interface with whiteboard tools |
| Language Hub | `/` or `/dashboard` | Home page for authenticated users |
| Vocabulary | `/vocabulary` | Flashcard management |
| Grammar | `/grammar` | Grammar exercises |
| Settings | `/settings` | User preferences |
| Admin Command Center | `/admin` | Requires admin/developer role |

### Common Test Data-TestIDs
- `button-dev-tools` - Floating dev tools menu
- `drill-left-{n}` / `drill-right-{n}` - Matching drill items
- `drill-match-count` - Drill progress indicator
- `drill-try-again` - Drill reset button

### Testing Limitations
- **Whiteboard tools (including matching drills)** only work in **Voice Learning mode**
- The Playwright test agent cannot use voice/microphone, so it defaults to text mode
- Whiteboard features must be tested manually or via unit/component tests
- Voice mode whiteboard tests require manual verification with a real microphone

## Documentation

Consolidated documentation organized by audience:

| Document | Audience | Contents |
|----------|----------|----------|
| `docs/USER-MANUAL.md` | Learners | Voice learning, whiteboard tools, drills, Asian language features |
| `docs/TEACHER-GUIDE.md` | Educators | Class management, syllabus builder, student monitoring |
| `docs/ADMIN-GUIDE.md` | Administrators | Command Center, Image Library, user management |
| `docs/TECHNICAL-REFERENCE.md` | Developers | API docs, schema, voice pipeline architecture |
| `docs/SALES-GUIDE.md` | Sales/Marketing | Key differentiators, target markets, competitive positioning |
| `docs/ROADMAP.md` | All | Planned features, priorities, recently completed |

**Batch Updates:** Use `docs/batch-doc-updates.md` as staging area for documentation changes.
**Archive:** Historical docs preserved in `docs/archive/` for reference.
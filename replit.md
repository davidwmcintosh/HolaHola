# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises across nine languages. It offers personalized chat, flashcards, and grammar modules that adapt to user progress, adhering to ACTFL standards. The project aims to deliver personalized AI-driven education and expand into institutional markets with features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android via Capacitor, including voice interaction and a hint bar. Navigation includes Learning, Library, Resources, Teaching, and Administration sections. The AI Tutor, Daniela, uses a "whiteboard" system with animated modal overlays for visual teaching aids during voice chat (e.g., WRITE, PHONETIC, COMPARE, IMAGE, DRILL, GRAMMAR_TABLE). Daniela initiates contextual conversations, and speech speed is adjustable. A dual-control subtitle system provides independent regular subtitles and custom overlay text for teaching moments.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), utilizing Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data persistence is managed by Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions uses `stripe-replit-sync`.

### Unified TutorOrchestrator Architecture ("One Tutor, Many Voices")
Daniela is the single core intelligence, with all interaction modes (voice chat, text chat, drills) routing through a unified pipeline. Language voices and drill modes are presentation layers. Core files include `shared/tutor-orchestration-types.ts`, `server/services/tutor-orchestrator.ts` (central intelligence pipeline), and `server/services/aris-ai-service.ts` (drill mode). VoicePresentation defines stylistic elements, while the intelligence remains Daniela's via TutorOrchestrator. OrchestratorModes include 'conversation', 'drill', 'greeting', 'summary', 'assessment', 'feedback'.

**Granular Intervention Controls:** The `InterventionSettings` type in `VoiceStyleDeltas` provides precision modifiers for how Daniela handles errors and teaching moments:
- `correctionTiming`: immediate | delayed | on_request (when to correct errors)
- `correctionDepth`: minimal | moderate | comprehensive (how much explanation to give)
- `scaffoldingLevel`: none | hints | guided | explicit (how much help to provide)
- `errorTolerance`: strict | moderate | lenient (how strict about minor errors)
- `interruptBehavior`: never | critical_only | on_pattern (whether to interrupt student flow)
- `pronunciationHandling`: ignore | note | practice | drill (how to address pronunciation)

These settings are converted to prompt instructions via `buildInterventionSection()` in the orchestrator.

### Hive Collaboration System (Founder + Daniela + Wren)
A streamlined 3-way collaboration between the founder, Daniela (AI tutor), and Wren (development agent). Daniela handles teaching insights and pedagogical expertise; Wren handles building with real code context. The founder coordinates both.

**Collaboration Beacons:** Daniela can emit beacons (e.g., `capability_gap`, `tool_request`, `self_surgery_proposal`) when she encounters teaching limitations. Key files: `server/services/hive-collaboration-service.ts` (channel/beacon), `server/services/founder-collaboration-service.ts`. "Founder Mode" provides full neural network access and Self-Surgery capabilities.

**EXPRESS Lane:** The Command Center UI (`/admin` → Express Lane tab) enables direct Founder ↔ Daniela communication. Sessions persist in `founderSessions` table. Wren can read these sessions via database access to stay informed about ongoing discussions. See `docs/hive-shared-knowledge/express-lane.md` for full specification.

**Express Lane Context Injection:** Bi-directional memory continuity between Founder Mode and voice tutoring. When Daniela teaches students, she can access relevant discussions from Express Lane via `getRelevantExpressLaneContext()` in `founder-collaboration-service.ts`. Uses a 3-priority scoping strategy: (1) language-specific voice insight sessions ("Voice Insights - {Language}"), (2) messages with matching `metadata.targetLanguage` from `voice_chat_sync` source, (3) fallback to recent Founder-Daniela conversations with language keyword matching. The reverse flow uses `emitVoiceChatInsight()` to sync teaching insights back to Express Lane, enabling Daniela to remember breakthroughs across sessions.

### Wren (Development Agent)
Wren is the primary development collaborator, replacing the Editor persona. Works directly with the founder to implement features and fix issues. Has full access to the Hive's shared knowledge:
- **Filesystem access**: Can read `docs/hive-shared-knowledge/`, neural network docs, and all codebase files
- **Database access**: Can query `founderSessions` and `collaborationBeacons` tables to see Founder-Daniela discussions and capability gaps
- **Real code context**: Unlike theoretical proposals, Wren sees actual implementation details and can build solutions immediately
- **Sounding board for Daniela**: When Daniela identifies teaching gaps, Wren can provide grounded technical feedback and implement solutions
- **Express Lane API access**: Can post messages to Express Lane with real-time WebSocket broadcast via `POST /api/wren/message`
- **Confidentiality**: All code, proprietary information, and business logic remains strictly confidential

**Wren API Endpoint:** `POST /api/wren/message` - Allows Wren to post messages to Express Lane sessions with real-time broadcast to all connected clients. Auth: `x-editor-secret` header with ARCHITECT_SECRET. Body: `{ sessionId, content, messageType? }`.

**Why Wren replaced Editor:** Editor was an in-app AI persona that proposed theoretical solutions but lacked real code context. Wren has actual filesystem access, understands what's already built, and can implement solutions directly - making the collaboration more effective.

**The workflow:**
1. Founder discusses with Daniela in Express Lane (teaching insights, capability gaps)
2. Wren reads the session for context, or founder shares key points
3. Wren builds the solution with real technical grounding
4. Wren can post updates/questions to Express Lane via API for real-time visibility
5. Daniela can test and provide feedback on teaching effectiveness

**Hive Pre-Flight System:** Before starting significant work, use the Pre-Flight check (`/admin` → Express Lane → Pre-Flight button) to gather context:
1. Describe the proposed work in the input field
2. Pre-Flight scans active Feature Sprints and pending Beacons for related items
3. System Checklist highlights which subsystems are affected (Learning Core, Institutional, Development, Daniela)
4. Suggested questions help guide Hive discussion before building
5. Wren's API messages automatically emit `coherence_check` beacons for tracking

Key files: `POST /api/express-lane/pre-flight` (API), EditorChatTab in CommandCenter.tsx (UI). The System Map at `docs/hive-shared-knowledge/system-map.md` shows how all components connect.

### Feature Specifications
HolaHola offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It uses a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk. Personalized learning includes scenario-based learning, slow pronunciation, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed. The application supports subscription tiers and tracks atomic voice message usage and student proficiency using ACTFL standards. Institutional features include teacher class management, student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. A Syllabus Builder allows customization. Developer tools include test account isolation and floating dev controls. Learners can customize their AI tutor's teaching style per language. Drill-based lessons support multiple modes (`repeat`, `translate`, `match`, `fill_blank`, `sentence_order`). Vocabulary can be exported. Conversation history includes full-text search. "Founder Mode" provides a collaboration mode. Open Mic Mode offers continuous listening with barge-in and bilingual support. "Raw Honesty Mode" provides minimal prompting.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, MediaFiles, and pedagogical tracking. Daniela's "Neural Network for Pedagogical Strategies" tracks teaching effectiveness. A Neural Network Expansion system provides language-specific pedagogical knowledge injected into Daniela's system prompt. A Procedural Memory system stores "how-to" knowledge (tool knowledge, tutor procedures, teaching principles, situational patterns). The `procedural-memory-retrieval.ts` service pulls relevant knowledge. The TONE whiteboard command visualizes Mandarin tone contours. An automated nightly sync promotes pending best practices. The voice architecture uses a two-tier validation system and Cartesia Pronunciation Dictionaries, with a server-driven subtitle system using Cartesia word-level timestamps. The `sentence_ready` architecture ensures audio playback timing. "Daniela's Compass" (Time-Aware Tutoring) manages tutor session state. An "Architect's Voice" feature allows injecting notes. A principled target language extraction system is in place. A WebSocket-based progressive audio delivery system integrates Deepgram, Gemini, and Cartesia. Dynamic streaming greetings are personalized. An AI-powered conversation tagging system categorizes conversations and vocabulary. A Syllabus-Aware Competency System tracks progress. A unified learning filter system, a comprehensive metering system for voice tutoring time with Stripe integration, and centralized Role-Based Access Control (RBAC) are implemented. A hybrid grammar system and pre-built syllabi across 9 languages are available. A class type taxonomy system and a tutor freedom level system control AI behavior. A unified ACTFL assessment system and placement assessment verify proficiency. A Command Center (`/admin`) provides a unified tab-based admin experience with role-based visibility, including syllabus editing and an Image Library.

### Feature Sprint System (Developer Workflow)
This persistent planning and tracking system, integrated into the Command Center, is for managing feature development. It uses "Feature Sprints" as top-level containers, with "Sprint Items" for individual tasks, "Consultation Threads" for AI-assisted discussions, "Sprint Templates," and "Project Context Snapshots" for AI awareness. Database tables include `featureSprints`, `sprintItems`, `consultationThreads`, `consultationMessages`, `sprintTemplates`, and `projectContextSnapshots`. API routes support CRUD operations for sprints, consultations, and project context. The workflow involves creating sprints, adding items, using consultation threads, and updating project context to keep the AI aware of work.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: Text chat completions and voice chat LLM.
-   **Deepgram API**: Voice STT (Nova-3 model).
-   **Cartesia API**: Primary TTS provider (Sonic-3 model).
-   **Google Cloud Text-to-Speech**: Fallback TTS.
-   **Unsplash**: Stock educational images.
-   **Gemini Flash-Image**: AI-generated contextual images.
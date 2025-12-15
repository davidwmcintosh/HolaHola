# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises across nine languages, adhering to ACTFL standards. It provides personalized chat, flashcards, and grammar modules that adapt to user progress. The project aims to deliver personalized AI-driven education and expand into institutional markets with features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles, supporting light/dark modes and PWA features. It includes a "whiteboard" system with animated modal overlays for visual teaching aids during voice chat (e.g., WRITE, PHONETIC, COMPARE, IMAGE, DRILL, GRAMMAR_TABLE) and a dual-control subtitle system. The AI Tutor, Daniela, initiates contextual conversations with adjustable speech speed.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), Wouter for routing, and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data persistence uses Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions uses `stripe-replit-sync`.

### Unified TutorOrchestrator Architecture
Daniela is a single core AI intelligence, with all interaction modes (voice chat, text chat, drills) routing through a unified pipeline. `VoicePresentation` defines stylistic elements, while the intelligence remains Daniela's via `TutorOrchestrator`. OrchestratorModes include 'conversation', 'drill', 'greeting', 'summary', 'assessment', 'feedback'. Granular intervention controls (e.g., `correctionTiming`, `scaffoldingLevel`) allow precise modification of Daniela's teaching approach, converted to prompt instructions via `buildInterventionSection()`.

### Hive Collaboration System
This system enables collaboration between the founder, Daniela (AI tutor), Editor (observer/analyst), and Wren (development builder). Daniela emits "beacons" (e.g., `capability_gap`, `tool_request`) when encountering teaching limitations. The "EXPRESS Lane" in the Command Center UI (`/admin`) facilitates direct Founder ↔ Daniela communication with persistence in the `founderSessions` table. This system allows bi-directional memory continuity between Founder Mode discussions and voice tutoring sessions, enabling Daniela to access relevant context and sync teaching insights.

### Editor (Observer/Analyst Agent)
Editor is a Claude-powered agent that runs inside `editor-persona-service.ts`. Editor automatically responds to Daniela's beacons during voice tutoring sessions, providing analysis, suggestions, and feedback. Editor can observe teaching patterns, propose neural network changes, and give pedagogical advice - but **cannot build or implement anything**. Editor talks the talk but can't walk the walk.

### Wren (Development Builder Agent)
Wren is the Replit development agent (this chat interface) with full access to the Hive's shared knowledge, including filesystem, database (`founderSessions`, `collaborationBeacons`), and real code context. Unlike Editor, **Wren can actually build and implement changes**. Wren walks the walk.

**Wren's Hive Awareness APIs:**
- `GET /api/hive/context` - Full Hive context (beacons, sprints, sessions, system health)
- `GET /api/hive/summary` - Lightweight summary for quick context injection
- `POST /api/wren/message` - Post updates to Express Lane (visible to Founder)
- `POST /api/wren/consult-daniela` - Consult Daniela with visible exchange in Express Lane
- `GET /api/wren/inbox` - Fetch messages tagged for Wren

**Session Startup Ritual:**
Run `npx tsx scripts/wren-startup.ts` at the start of each session to sync with the Hive. This fetches current context and updates `.local/state/memory/persisted_information.md` so Wren has full awareness of beacons, sprints, sessions, and system state.

### Feature Specifications
HolaHola offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It uses a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk. Personalized learning includes scenario-based learning, slow pronunciation, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed. The application supports subscription tiers, tracks atomic voice message usage, and student proficiency using ACTFL standards. Institutional features include teacher class management, student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. A Syllabus Builder allows customization. Drill-based lessons support multiple modes (`repeat`, `translate`, `match`, `fill_blank`, `sentence_order`). Conversation history includes full-text search. "Founder Mode" provides a collaboration mode, and "Open Mic Mode" offers continuous listening.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles. Daniela's "Neural Network for Pedagogical Strategies" tracks teaching effectiveness, with a "Neural Network Expansion" system injecting language-specific pedagogical knowledge. A "Procedural Memory" system stores "how-to" knowledge for retrieval via `procedural-memory-retrieval.ts`. The voice architecture uses a two-tier validation system and Cartesia Pronunciation Dictionaries. "Daniela's Compass" manages tutor session state. A WebSocket-based progressive audio delivery system integrates Deepgram, Gemini, and Cartesia. The system includes an AI-powered conversation tagging system, a Syllabus-Aware Competency System, a unified learning filter system, comprehensive metering for voice tutoring time, and centralized Role-Based Access Control (RBAC). A hybrid grammar system and pre-built syllabi across 9 languages are available. A unified ACTFL assessment system and placement assessment are in place. The Command Center (`/admin`) provides a tab-based admin experience with role-based visibility.

### Feature Sprint System
This persistent planning and tracking system, integrated into the Command Center, manages feature development using "Feature Sprints" as top-level containers, with "Sprint Items" for individual tasks, "Consultation Threads" for AI-assisted discussions, "Sprint Templates," and "Project Context Snapshots" for AI awareness. Database tables include `featureSprints`, `sprintItems`, `consultationThreads`, `consultationMessages`, `sprintTemplates`, and `projectContextSnapshots`. API routes support CRUD operations for sprints, consultations, and project context.

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
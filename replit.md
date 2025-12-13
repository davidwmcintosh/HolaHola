# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises in nine languages. It provides personalized chat, flashcards, and grammar modules that adapt to individual user progress, adhering to ACTFL standards. The project's core purpose is to deliver personalized AI-driven education, with a strategic vision to expand into institutional markets through features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.

## System Architecture

### UI/UX Decisions
The frontend utilizes a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android via Capacitor, including voice interaction and a hint bar. Navigation is structured into Learning, Library, Resources, Teaching, and Administration. The AI Tutor, Daniela, uses a "whiteboard" system with animated modal overlays during voice chat for strategic visual teaching aids like WRITE, PHONETIC, COMPARE, IMAGE, DRILL, CONTEXT, GRAMMAR_TABLE, READING, STROKE, TONE, WORD_MAP, CULTURE, PLAY, SCENARIO, and SUMMARY. Daniela initiates conversations contextually, and speech speed is verbally adjustable. The dual-control subtitle system allows for independent regular subtitles (off, all, target) and custom overlay text (SHOW/HIDE) for teaching moments, both rendering simultaneously.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data persistence is handled by Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is managed by Replit Auth (OIDC), and Stripe integration for subscriptions uses `stripe-replit-sync`.

### Unified TutorOrchestrator Architecture ("One Tutor, Many Voices")
**CRITICAL PHILOSOPHY**: Daniela is THE single core intelligence. All interaction modes (voice chat, text chat, drills, greetings, summaries) route through a unified pipeline. Language voices (Spanish Daniela, German Klaus, etc.), gender voices, and drill modes are PRESENTATION LAYERS only - different instruments, same musician.

**Core Files**:
- `shared/tutor-orchestration-types.ts`: Type contracts for orchestrator modes, voice presentations, and context
- `server/services/tutor-orchestrator.ts`: Central intelligence pipeline with unified Gemini invocation
- `server/services/aris-ai-service.ts`: Drill mode (Aris persona) - now routes through TutorOrchestrator

**VoicePresentation** is purely stylistic: avatar, voiceId, response length preferences, formality deltas. The INTELLIGENCE (persona, teaching principles, neural network knowledge) is always Daniela's brain via TutorOrchestrator.

**OrchestratorModes**: 'conversation', 'drill', 'greeting', 'summary', 'assessment', 'feedback'
**ResponseChannels**: 'stream' (for real-time voice), 'batch_text', 'batch_json'

**Integration Status**: Drill mode fully migrated. Streaming voice chat pending (high complexity, using existing working system-prompt.ts for now).

### Feature Specifications
HolaHola provides conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It employs a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Personalized learning includes scenario-based learning, slow pronunciation, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers, tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management, student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. A Syllabus Builder allows customization with drag-and-drop reordering, custom lesson creation, and ACTFL Standards Coverage analysis. Developer tools include test account isolation, floating dev controls, and usage analytics. Self-directed learners can customize their AI tutor's teaching style per language in Settings with four flexibility levels; class chats use the teacher's setting. Drill-based lessons support multiple modes (`repeat`, `translate`, `match`, `fill_blank`, `sentence_order`), utilizing Google Cloud TTS for batch audio synthesis. Fill-in-the-blank drills support both dropdown options and text input. Sentence order drills use drag-and-drop or button-based word reordering. Vocabulary can be exported in CSV and Anki-compatible formats. Conversation history includes full-text search. "Founder Mode" provides a collaboration mode for developer/admin users. Open Mic Mode offers continuous listening with Deepgram VAD for automatic speech detection, supporting barge-in and bilingual conversations. "Raw Honesty Mode" provides minimal prompting for founders to explore Daniela's authentic preferences.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, MediaFiles, and pedagogical tracking tables (teachingToolEvents, pedagogicalInsights). Daniela's "Neural Network for Pedagogical Strategies" tracks teaching effectiveness with three layers: Data Collection (tool usage logging), Analysis Engine (pattern discovery), and Self-Reflection Loop (tutor pedagogical judgment as first-class input). A Neural Network Expansion system provides language-specific pedagogical knowledge through five tables: languageIdioms, culturalNuances, learnerErrorPatterns, dialectVariations, and linguisticBridges. This knowledge is injected into Daniela's system prompt, allowing her to teach idioms, cultural context, common learner errors, dialect variations, and cross-language connections naturally. A Procedural Memory system stores 120+ pieces of "how-to" knowledge in Daniela's brain through four tables: toolKnowledge (22 entries for whiteboard commands/drills), tutorProcedures (44 entries for teaching situations like greetings, corrections, scaffolding), teachingPrinciples (35 entries for core pedagogical beliefs), and situationalPatterns (19 entries for Compass-triggered behaviors). The retrieval service (`procedural-memory-retrieval.ts`) pulls relevant knowledge based on session context, enabling a shift from scripted prompts to emergent, context-aware tutoring. The TONE whiteboard command visualizes Mandarin tone contours (1-5) with accurate pitch shapes for tonal language learners. An automated nightly sync at 3 AM promotes pending best practices to active teaching status; synced items can be retracted (marked inactive/rejected) through the Command Center UI. The voice architecture implements a two-tier validation system and uses Cartesia Pronunciation Dictionaries for TTS correction. A server-driven subtitle system with karaoke-style word highlighting uses native Cartesia word-level timestamps via WebSocket API, with automatic fallback. The `sentence_ready` architecture ensures audio playback only starts after word timings arrive. "Daniela's Compass" (Time-Aware Tutoring), enabled by `COMPASS_ENABLED=true`, manages tutor session state with an in-memory cache, tracking student snapshots, session roadmaps, and time. An "Architect's Voice" feature allows injecting notes into Daniela's context. A principled target language extraction system uses bold-only extraction and foreign character detection. A WebSocket-based progressive audio delivery system integrates Deepgram STT, Gemini streaming, and Cartesia WebSocket TTS. Dynamic streaming greetings are personalized, ACTFL-aware, history-aware, and context-aware. An AI-powered conversation tagging system categorizes conversations and vocabulary. A Syllabus-Aware Competency System tracks student progress against syllabus topics. A unified learning filter system provides consistent content filtering. A comprehensive metering system for voice tutoring time is integrated with Stripe, with a class-specific balance system. Centralized Role-Based Access Control (RBAC) defines hierarchical permissions. A hybrid grammar system combines conversational practice with targeted instruction. A syllabus content system provides pre-built syllabi across 9 languages. A class type taxonomy system categorizes classes. A tutor freedom level system controls AI tutor behavior per class. A unified ACTFL assessment system dynamically assesses learner proficiency. A placement assessment system verifies proficiency for class enrollments. A Command Center (`/admin`) provides a unified tab-based admin experience with role-based visibility for managing users, classes, analytics, and developer tools, including syllabus editing and an Image Library with quality control review.

### Feature Sprint System (Developer Workflow)
**Purpose**: A persistent planning and tracking system for feature development, integrated into the Command Center. Use this for all new features to maintain context across sessions.

**Location**: Command Center → Feature Sprint tab (`/admin` → "Feature Sprint")

**Core Components**:
- **Feature Sprints**: Top-level containers for feature work with title, description, status, and priority
- **Sprint Items**: Individual tasks within a sprint (spec, design, build, test phases)
- **Consultation Threads**: AI-assisted discussions during development for clarifying requirements
- **Sprint Templates**: Pre-built templates for feature briefs, pedagogy specs, and build plans
- **Project Context Snapshots**: Gives AI assistants awareness of current project state (features, priorities, blockers)

**Database Tables** (in `shared/schema.ts`):
- `featureSprints` - Sprint containers
- `sprintItems` - Individual sprint tasks
- `consultationThreads` - AI consultation threads
- `consultationMessages` - Messages within threads
- `sprintTemplates` - Reusable templates
- `projectContextSnapshots` - Project state for AI awareness

**API Routes** (in `server/routes.ts`):
- `GET/POST /api/feature-sprints` - Sprint CRUD
- `GET/POST /api/sprint-consults` - Consultation threads
- `GET/POST /api/project-context` - Project context for AI

**Usage Workflow**:
1. Create a new sprint for the feature you're building
2. Add items for each phase (spec, design, build, test)
3. Use consultation threads to discuss requirements with Daniela
4. Update project context to keep AI aware of current work
5. Mark items complete as you progress

**Agent Instructions**: When starting significant feature work, check the Feature Sprint tab first. Create a sprint if one doesn't exist for the current work. Update project context when major features are completed.

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
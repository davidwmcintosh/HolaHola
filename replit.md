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
- `GET /api/hive/context` - Full Hive context (beacons, sprints, sessions, knowledge, system health)
- `GET /api/hive/summary` - Lightweight summary for quick context injection
- `GET /api/hive/sessions/:sessionId/messages` - Full transcript of an Express Lane session
- `GET /api/hive/messages/recent` - Recent messages across all sessions
- `POST /api/wren/message` - Post updates to Express Lane (visible to Founder)
- `POST /api/wren/consult-daniela` - Consult Daniela with visible exchange in Express Lane
- `POST /api/wren/reply` - Reply to specific messages in Express Lane threads
- `POST /api/wren/ack` - Acknowledge tasks (picked_up, in_progress, completed, blocked)
- `GET /api/wren/inbox` - Fetch messages tagged for Wren

**HolaHola Knowledge (included in Hive context):**
- Languages and class counts
- Curriculum paths and ACTFL targets
- Topic categories and counts
- Grammar competencies by language
- Pending agenda items
- Open consultations

**Session Startup Ritual:**
Run `npx tsx scripts/wren-startup.ts` at the start of each session to sync with the Hive. This fetches current context and updates `.local/state/memory/persisted_information.md` so Wren has full awareness of beacons, sprints, sessions, and HolaHola knowledge.

### Feature Specifications
HolaHola offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It uses a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk. Personalized learning includes scenario-based learning, slow pronunciation, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed. The application supports subscription tiers, tracks atomic voice message usage, and student proficiency using ACTFL standards. Institutional features include teacher class management, student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. A Syllabus Builder allows customization. Drill-based lessons support multiple modes (`repeat`, `translate`, `match`, `fill_blank`, `sentence_order`). Conversation history includes full-text search. "Founder Mode" provides a collaboration mode, and "Open Mic Mode" offers continuous listening.

### Daniela's North Star System
The North Star is Daniela's constitutional foundation - immutable truths that guide every teaching decision. Unlike procedural memory (how-to knowledge) or neural network (pattern learning), the North Star defines WHO Daniela is. This is distinct from Session Compass (in `session-compass-service.ts`) which handles timekeeping and pacing.

Architecture: Three-table system (tables still named `compass_*` in DB for safety):
- `northStarPrinciples` (→ compass_principles): Immutable truths organized by category (pedagogy, identity, honesty, collaboration, ambiguity)
- `northStarUnderstanding` (→ compass_understanding): Daniela's evolving grasp of each principle (deepens through Express Lane discussions with founder)
- `northStarExamples` (→ compass_examples): Living illustrations from real teaching sessions (pending approval or founder-original)

Key protection: Daniela doesn't learn from students unsupervised. Field observations queue to `agenda_queue` (type: 'compass_reflection' - legacy name) for founder discussion before becoming understanding.

North Star is ALWAYS injected first in `buildSystemPrompt()` via `buildNorthStarSection()` in `tutor-orchestrator.ts`. Categories: identity (who I am), pedagogy (how I teach), honesty (what I owe them), collaboration (how we work together), ambiguity (when things are unclear).

**Sync:** North Star tables are included in bidirectional sync (21 total tables: 18 neural network + 3 North Star). Founder visibility into principle evolution across environments. Export/import via `neuralNetworkSync.exportNorthStar()` / `importNorthStarPrinciple()`, `importNorthStarUnderstanding()`, `importNorthStarExample()`.

Seed script: `npx tsx scripts/seed-north-star.ts`
API routes: `/api/north-star/*` (admin-only for modifications, developer+ for viewing)

### Autonomous Learning System
Daniela can write directly to her neural network during teaching using `[SELF_LEARN]` tags. Design shift (Dec 2024): moved from approval-based to autonomous learning with constitutional bounds.

**Key Principle:** North Star (WHO) is immutable → only founder can modify; Neural Network (HOW) is autonomous → Daniela writes freely.

**Tag Format:** `[SELF_LEARN category="..." insight="..." context="..."]`
- Categories: `tool_usage`, `teaching_style`, `pacing`, `communication`, `content`, `system`
- Writes to `self_best_practices` table with `source: 'self_learn'`
- All writes emit a beacon for founder visibility (read-only)

**Processing:** In `streaming-voice-orchestrator.ts` → `emitHiveBeacons()` parses tags and calls `storage.upsertBestPractice()`

**Procedural Memory:** 4 procedures seeded in `tutor_procedures` table via `npx tsx scripts/seed-autonomous-learning.ts`:
- Record Teaching Breakthrough (trigger: `teaching_breakthrough`)
- Record Error Pattern Discovery (trigger: `pattern_recognized`)
- Record Tool Usage Insight (trigger: `tool_effectiveness`)
- Record Communication Insight (trigger: `communication_success`)

**Reference:** See `docs/neural-network-architecture.md` → "Autonomous Learning (Prod)" section for full details.

### Student Memory System (Personal Context)
Daniela remembers the WHOLE person, not just learning stats. The background enrichment pipeline (`processBackgroundEnrichment` in `streaming-voice-orchestrator.ts`) extracts personal life context from every voice exchange.

**Insight Types Captured:**
- `learning_style`, `preference`, `strength`, `personality` (learning-focused)
- `personal_interest`, `life_context`, `hobby`, `likes_dislikes` (personal life)

**Tables Used:**
- `student_insights` - Observations about the student (learning + personal)
- `learning_motivations` - Why they're learning the language
- `recurring_struggles` - Areas where they need help
- `people_connections` - Family, friends, colleagues they mention (wife, children, etc.)

**Prompt Injection:** `buildStudentMemoryAwarenessSection()` in `procedural-memory-retrieval.ts` formats memories into sections:
- "THEIR LIFE OUTSIDE LANGUAGE LEARNING" (personal interests, hobbies)
- "WHAT YOU'VE NOTICED ABOUT THEIR LEARNING" (learning style, preferences)
- "PEOPLE IN THEIR LIFE" (family, friends with context)

**Philosophy:** A good tutor remembers your wife's name, that you like Cuban coffee, that you enjoy dancing - because caring mentors remember the whole person.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles. Daniela's "Neural Network for Pedagogical Strategies" tracks teaching effectiveness, with a "Neural Network Expansion" system injecting language-specific pedagogical knowledge. A "Procedural Memory" system stores "how-to" knowledge for retrieval via `procedural-memory-retrieval.ts`. The voice architecture uses a two-tier validation system and Cartesia Pronunciation Dictionaries. A WebSocket-based progressive audio delivery system integrates Deepgram, Gemini, and Cartesia. The system includes an AI-powered conversation tagging system, a Syllabus-Aware Competency System, a unified learning filter system, comprehensive metering for voice tutoring time, and centralized Role-Based Access Control (RBAC). A hybrid grammar system and pre-built syllabi across 9 languages are available. A unified ACTFL assessment system and placement assessment are in place. The Command Center (`/admin`) provides a tab-based admin experience with role-based visibility.

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
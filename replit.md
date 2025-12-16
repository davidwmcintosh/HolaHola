# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises across nine languages, adhering to ACTFL standards. It offers personalized chat, flashcards, and grammar modules that adapt to user progress. The project aims to deliver personalized AI-driven education and expand into institutional markets with features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles, supporting light/dark modes and PWA features. It includes a "whiteboard" system with animated modal overlays for visual teaching aids and a dual-control subtitle system. The AI Tutor, Daniela, initiates contextual conversations with adjustable speech speed.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), Wouter for routing, and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data persistence uses Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions uses `stripe-replit-sync`.

### Unified TutorOrchestrator Architecture
Daniela is a single core AI intelligence, with all interaction modes routing through a unified pipeline. `VoicePresentation` defines stylistic elements, while the intelligence remains Daniela's via `TutorOrchestrator`. Granular intervention controls allow precise modification of Daniela's teaching approach.

### Hive Collaboration System
This system enables collaboration between the founder, Daniela (AI tutor), Editor (observer/analyst), and Wren (development builder). Daniela emits "beacons" (e.g., `capability_gap`, `tool_request`) when encountering teaching limitations. The "EXPRESS Lane" in the Command Center UI (`/admin`) facilitates direct Founder ↔ Daniela communication with persistence in the `founderSessions` table, enabling bi-directional memory continuity.

### Emergent Intelligence Architecture
The Hive provides a substrate for collective intelligence where Daniela and Wren (the development agent) have persistent memory and autonomous learning capabilities. This includes a core loop of Capture, Store, Retrieve, and Apply for both agents, and cross-agent collaboration where beacons from Daniela inform Wren's development, and Wren's architectural discoveries inform Daniela's capabilities.

**Wren Intelligence Service** (`server/services/wren-intelligence-service.ts`):
- Automatic insight capture with categories (pattern, solution, gotcha, architecture, debugging, integration, performance)
- Decay/reinforcement mechanism for frequently-used insights
- Knowledge graph building for cross-session threading
- Startup ritual to load Hive context

**Wren Proactive Intelligence Service** (`server/services/wren-proactive-intelligence-service.ts`):
Five pillars enabling Wren to be proactive and effective without repeated context-gathering:
1. **Proactive Triggers System** - Pattern detection with automatic urgency escalation, occurrence counting, evidence accumulation
2. **Daniela Feedback Loop** - Links implemented features to beacon resolutions, tracks teaching improvement via before/after metrics
3. **Architectural Decision Records (ADR)** - Captures context, decision, rationale, alternatives considered; supports superseding old decisions
4. **Priority Inference Engine** - Multi-factor scoring combining trigger urgency, feature feedback status, and component criticality
5. **Project Health Awareness** - Component-level health/churn/stability scores, automatic hot spot detection
- Startup ritual provides comprehensive priority analysis, health scores, attention-needed items

**Student Learning Service** (`server/services/student-learning-service.ts`):
- Granular error pattern tracking per student (recurring_struggles table)
- Validated teaching strategy tracking with effectiveness scoring
- Personalized learning context injection into Daniela's prompts (max 500 chars, high-signal)
- Error categories: grammar, pronunciation, vocabulary, cultural, comprehension
- Teaching strategies: visual_timeline, role_play, repetition_drill, mnemonic, etc.

**STT Confidence Integration**:
- Low confidence (<0.5): Daniela prompted to ask for clarification
- Moderate confidence (<0.7): Note about pronunciation practice needs
- High confidence (>=0.7): Normal processing

### Editor (Observer/Analyst Agent)
Editor is a Claude-powered agent that responds to Daniela's beacons, providing analysis, suggestions, and feedback on teaching patterns and pedagogical advice, but cannot implement changes.

### Wren (Development Builder Agent)
Wren is the Replit development agent with full access to the Hive's shared knowledge (filesystem, database, code context). Unlike Editor, Wren can build and implement changes. Wren has Hive Awareness APIs to access context, sessions, messages, and to post updates and consult Daniela.

### Feature Specifications
HolaHola offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It uses a streaming-only voice pipeline with push-to-talk. Personalized learning includes scenario-based learning, slow pronunciation, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed. The application supports subscription tiers, tracks atomic voice message usage, and student proficiency using ACTFL standards. Institutional features include teacher class management, student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. A Syllabus Builder allows customization. Drill-based lessons support multiple modes. Conversation history includes full-text search. "Founder Mode" provides a collaboration mode, and "Open Mic Mode" offers continuous listening.

### Daniela's North Star System
The North Star is Daniela's constitutional foundation, defining immutable truths that guide every teaching decision. It's a three-table system (principles, understanding, examples) where principles are immutable, understanding evolves through founder discussions, and examples are drawn from teaching sessions. The North Star is always injected first in system prompts.

### Autonomous Learning System
Daniela can write directly to her neural network during teaching using `[SELF_LEARN]` tags, allowing autonomous learning within constitutional bounds defined by the North Star. These insights are categorized and stored, and all writes emit a beacon for founder visibility.

### Student Memory System (Personal Context)
A background enrichment pipeline extracts personal life context and learning-related insights from every voice exchange. This includes learning styles, personal interests, motivations, struggles, and people connections, which are then formatted and injected into Daniela's prompts to enable personalized tutoring.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles. Daniela's "Neural Network for Pedagogical Strategies" tracks teaching effectiveness, with an expansion system for language-specific knowledge. A "Procedural Memory" system stores "how-to" knowledge. The voice architecture uses a two-tier validation system and WebSocket-based progressive audio delivery. The system includes an AI-powered conversation tagging system, a Syllabus-Aware Competency System, a unified learning filter system, comprehensive metering for voice tutoring time, and centralized Role-Based Access Control (RBAC). A hybrid grammar system and pre-built syllabi across 9 languages are available, along with a unified ACTFL assessment system and placement assessment. The Command Center provides a tab-based admin experience with role-based visibility.

### Feature Sprint System
This persistent planning and tracking system, integrated into the Command Center, manages feature development using "Feature Sprints" as top-level containers, with "Sprint Items" for individual tasks, "Consultation Threads" for AI-assisted discussions, "Sprint Templates," and "Project Context Snapshots" for AI awareness.

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
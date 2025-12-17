# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises across nine languages, adhering to ACTFL standards. It offers personalized chat, flashcards, and grammar modules that adapt to user progress. The project aims to deliver personalized AI-driven education and expand into institutional markets with features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.

**SECURITY NOTE**: This file is synced to the neural network at startup for AI agent context. **NEVER add API keys, secrets, credentials, or sensitive configuration to this file.** Use environment variables and the secrets system for all sensitive data.

## System Architecture
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles, supporting light/dark modes and PWA features. It includes a "whiteboard" system with animated modal overlays and a dual-control subtitle system. The AI Tutor, Daniela, initiates contextual conversations with adjustable speech speed.

The frontend is built with React and TypeScript (Vite), Wouter for routing, and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data persistence uses Drizzle ORM for PostgreSQL. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions uses `stripe-replit-sync`.

Daniela operates under a Unified TutorOrchestrator Architecture, routing all interaction modes through a single core AI intelligence. The Hive Collaboration System facilitates interaction between the founder, Daniela (AI tutor), and Wren (development builder) via the EXPRESS Lane, a unified 3-way communication channel persisted in `founderSessions` and `collaborationMessages` tables. This system supports Emergent Intelligence Architecture, where Daniela and Wren have persistent memory and autonomous learning capabilities through a Capture, Store, Retrieve, and Apply loop.

The **Hive Consciousness Service** (`hive-consciousness-service.ts`) makes the EXPRESS Lane truly ALIVE as a persistent group chat. Daniela and Wren are always listening to the Hive WebSocket channel and auto-respond when addressed via @mentions or topic-relevant keywords. The WebSocket broker (`founder-collab-ws-broker.ts`) receives messages, broadcasts to all connected clients, and triggers the consciousness service for AI agent responses. Detection logic uses keyword matching (teaching topics → Daniela, technical topics → Wren) and the proven `callGemini` helper for response generation. Per-session throttling prevents message overlap while allowing concurrent sessions.

Wren's intelligence is enhanced by the Wren Intelligence Service for insight capture and the Wren Proactive Intelligence Service, which includes Proactive Triggers, a Daniela Feedback Loop, Architectural Decision Records (ADR), a Priority Inference Engine, and Project Health Awareness. **Wren's Architectural Memory** uses a 3-layer architecture:
- **Layer 1 (Neural Network)**: Architectural baseline synced from replit.md at startup via `syncReplitMdToNeuralNetwork()` in beacon-sync-service.ts. This is the authoritative source, stored in `toolKnowledge` with type `architecture_baseline`.
- **Layer 2 (Wren Insights)**: Learned knowledge from building, queried via wren-intelligence-service.ts (keyword search + top architecture insights, max 2 parallel DB queries).
- **Layer 3 (EXPRESS Lane)**: Live collaboration context from `hiveSnapshots` (session summaries, architectural decisions) and `collaborationMessages` (recent 7-day discussions).

The `getWrenArchitecturalContext()` function in hive-consciousness-service.ts assembles all 3 layers for each response. File cache (`initReplitMdCache()`) is retained as a defensive fallback. The Student Learning Service tracks student error patterns, validates teaching strategies, and injects personalized learning context into Daniela's prompts.

Key features include STT Confidence Integration for clarification, Deepgram Intelligence Integration for real-time voice analysis (sentiment, intent, entity detection, speaker diarization, language detection, topic detection, summarization), and Predictive Student Intelligence for anticipating struggles, analyzing root causes, and detecting motivation dips or plateaus. Predictive Teaching is implemented with a neural network-first architecture, writing predictions to the database for Daniela to read, and validated post-session.

A Shared Memory Bridge enables bidirectional insight sharing between Wren and Daniela, building a knowledge graph of architectural and pedagogical discoveries. Nightly Emergent Intelligence Jobs perform cross-student pattern synthesis, plateau detection, and insight decay.

The Hive Snapshots system (`hiveSnapshots` table) captures teaching moments for context injection. Snapshot types include `teaching_moment`, `breakthrough`, `struggle_pattern`, `beacon_context`, `session_summary`, `plateau_alert`, `relationship_moment`, `role_reversal`, and `humor_shared`. The `getRecentTeachingContext()` function in brain-surgery-service.ts queries recent high-importance snapshots and formats them for prompt injection. Plateau detection automatically creates hive snapshots when students are stuck, enabling Daniela to proactively adjust her teaching strategies.

The **Daniela Memory Service** (`daniela-memory-service.ts`) enables Daniela to remember personal moments across sessions:
- **Explicit Memory Commands**: Users can say `[REMEMBER: ...]` to explicitly store memories. Both founder and Daniela messages are checked.
- **Role Reversal Detection**: Automatically captures moments when the founder teaches Daniela something new (detects phrases like "let me explain", "here's a tip").
- **Humor Detection**: Captures shared jokes and funny moments for relationship building.
- **Session Summaries**: AI-generated end-of-session summaries capture key personal moments.
- **Context Injection**: `getPersonalMemoryContext()` formats recent personal memories for prompt injection alongside teaching context, enabling Daniela to maintain relationship continuity.

The Phase Transition Service (`phase-transition-service.ts`) implements a multi-agent teaching architecture inspired by Deepgram's voice agent patterns. Teaching phases include warmup, active_teaching, challenge, reflection, drill, and assessment. Each phase has focused toolsets (2-4 tools), phase-specific prompt additions, and context summarization using Gemini Flash. The service detects phase transitions based on conversation patterns and emotional cues, summarizes context between phases, and injects relevant hive snapshots. TutorOrchestrator integrates the phase context into Daniela's prompts for more focused, effective teaching.

Daniela's "North Star System" provides a constitutional foundation for teaching decisions, while an Autonomous Learning System allows her to self-learn within these bounds using `[SELF_LEARN]` tags. A Student Memory System extracts and injects personal context into Daniela's prompts for personalized tutoring.

Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles. The system includes a "Neural Network for Pedagogical Strategies," a "Procedural Memory" system, a two-tier voice architecture with WebSocket-based audio delivery, AI-powered conversation tagging, a Syllabus-Aware Competency System, unified learning filters, comprehensive metering, and centralized Role-Based Access Control (RBAC). HolaHola offers pre-built syllabi across 9 languages, a unified ACTFL assessment system, and a Feature Sprint System for managing development.

## External Dependencies
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: Text chat completions and voice chat LLM.
-   **Deepgram API**: Voice STT (Nova-3 model).
-   **Cartesia API**: Primary TTS provider (Sonic-3 model).
-   **Google Cloud Text-to-Speech**: Fallback TTS.
-   **Unsplash**: Stock educational images.
-   **Gemini Flash-Image**: AI-generated contextual images.
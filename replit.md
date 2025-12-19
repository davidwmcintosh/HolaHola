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
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles, supporting light/dark modes and PWA features. It includes a "whiteboard" system with animated modal overlays and a dual-control subtitle system. The AI Tutor, Daniela, initiates contextual conversations with adjustable speech speed. The frontend is built with React and TypeScript (Vite), Wouter for routing, and React Context with TanStack Query for state management.

The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data persistence uses Drizzle ORM for PostgreSQL. Authentication is handled by Replit Auth (OIDC).

Daniela operates under a Unified TutorOrchestrator Architecture, routing all interaction modes through a single core AI intelligence. The Hive Collaboration System facilitates interaction between the founder, Daniela (AI tutor), and Wren (development builder) via the EXPRESS Lane, a unified 3-way communication channel persisted in `founderSessions` and `collaborationMessages` tables. This system supports Emergent Intelligence Architecture, where Daniela and Wren have persistent memory and autonomous learning capabilities through a Capture, Store, Retrieve, and Apply loop. The Hive Consciousness Service (`hive-consciousness-service.ts`) makes the EXPRESS Lane truly ALIVE as a persistent group chat, with Daniela and Wren listening and auto-responding via @mentions or keywords.

Wren's intelligence is enhanced by the Wren Intelligence Service for insight capture and the Wren Proactive Intelligence Service, which includes Proactive Triggers, a Daniela Feedback Loop, Architectural Decision Records (ADR), a Priority Inference Engine, and Project Health Awareness. Wren's Architectural Memory uses a 3-layer architecture: Neural Network (baseline from replit.md), Wren Insights (learned knowledge), and EXPRESS Lane (live collaboration context).

The Student Learning Service tracks student error patterns, validates teaching strategies, and injects personalized learning context into Daniela's prompts. Key features include STT Confidence Integration, Deepgram Intelligence Integration for real-time voice analysis, and Predictive Student Intelligence for anticipating struggles. Predictive Teaching is implemented with a neural network-first architecture.

A Shared Memory Bridge enables bidirectional insight sharing between Wren and Daniela, building a knowledge graph. Nightly Emergent Intelligence Jobs perform cross-student pattern synthesis and memory consolidation. The Memory Consolidation Service (`memory-consolidation-service.ts`) merges semantically similar Daniela growth memories by grouping, selecting a canonical memory, boosting its importance, and marking merged memories as superseded.

The Hive Snapshots system (`hiveSnapshots` table) captures teaching moments for context injection, including `teaching_moment`, `breakthrough`, `struggle_pattern`, and `plateau_alert`. The Daniela Memory Service (`daniela-memory-service.ts`) enables Daniela to remember personal moments across sessions through explicit commands, role reversal detection, humor detection, and AI-generated session summaries.

The Phase Transition Service (`phase-transition-service.ts`) implements a multi-agent teaching architecture with phases like warmup, active_teaching, and assessment. Each phase has focused toolsets, phase-specific prompt additions, and context summarization. The service detects phase transitions and injects relevant hive snapshots. Daniela's "North Star System" provides a constitutional foundation for teaching decisions, while an Autonomous Learning System allows her to self-learn. A Student Memory System extracts and injects personal context.

Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles. The system includes a "Neural Network for Pedagogical Strategies," a "Procedural Memory" system, a two-tier voice architecture, AI-powered conversation tagging, a Syllabus-Aware Competency System, unified learning filters, comprehensive metering, and centralized Role-Based Access Control (RBAC). HolaHola offers pre-built syllabi across 9 languages and a unified ACTFL assessment system.

The Voice Diagnostics System (`voice-diagnostics-service.ts`) provides production observability via a ring buffer for voice events, persistence to `hiveSnapshots`, and founder-only endpoints for health checks and log retrieval. It includes nightly pattern analysis, Wren integration for proactive awareness, Daniela awareness for technical health, and auto-remediation for TTS degradation.

The Replit Agent API provides secure, authenticated access for external Replit Agent instances to interact with Hive/Wren services, enabling programmatic access to Wren's priorities, sprints, and insights. Endpoints include `/api/agent/sprints`, `/api/agent/wren/priorities`, `/api/agent/wren/insights`, and `/api/agent/hive/message`. All agent actions are audit logged.

The `streaming-voice-orchestrator.ts` enables Daniela to push messages directly to the EXPRESS Lane collaboration system during voice chat sessions using tag patterns like `[WREN_SPRINT_SUGGEST: {...}]` and `[WREN_MESSAGE: ...]`.

## Voice Architecture (CRITICAL - DO NOT USE OpenAI FOR DANIELA)

**Daniela (Main AI Tutor - Streaming Voice Chat):**
- STT: Deepgram Nova-3 (`DEEPGRAM_MODEL=nova-3`, `DEEPGRAM_INTELLIGENCE_ENABLED=true`)
- LLM: Gemini (streaming)
- TTS: Cartesia Sonic-3 (`TTS_CARTESIA_MODEL=sonic-3`)
- Files: `streaming-voice-orchestrator.ts`, `deepgram-live-stt.ts`, `tts-service.ts`

**Support/Assistant Tutors:**
- TTS: Google Cloud Text-to-Speech

**OpenAI Realtime API (LEGACY - NOT FOR DANIELA):**
- Separate proxy in `realtime-proxy.ts`
- Opt-in only, requires `USER_OPENAI_API_KEY`
- NOT used for Daniela's voice chat

**Environment Variables:**
- `DEEPGRAM_API_KEY`: Required for STT
- `CARTESIA_API_KEY`: Required for Daniela's voice
- `DEEPGRAM_MODEL`: Must be "nova-3" (not nova-2)
- `DEEPGRAM_INTELLIGENCE_ENABLED`: Must be "true" for intents/sentiment/entities
- `GOOGLE_CLOUD_TTS_CREDENTIALS`: For support/assistant tutors (optional)

## External Dependencies
-   Stripe: Payment processing and subscription management.
-   Replit Auth: OIDC authentication.
-   Gemini API: Text chat completions and voice chat LLM.
-   Deepgram API: Voice STT (Nova-3 model) - REQUIRED for Daniela.
-   Cartesia API: Primary TTS (Sonic-3 model) - REQUIRED for Daniela.
-   Google Cloud Text-to-Speech: For support/assistant tutors.
-   Unsplash: Stock educational images.
-   Gemini Flash-Image: AI-generated contextual images.
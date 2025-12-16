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
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles, supporting light/dark modes and PWA features. It includes a "whiteboard" system with animated modal overlays and a dual-control subtitle system. The AI Tutor, Daniela, initiates contextual conversations with adjustable speech speed.

The frontend is built with React and TypeScript (Vite), Wouter for routing, and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data persistence uses Drizzle ORM for PostgreSQL. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions uses `stripe-replit-sync`.

Daniela operates under a Unified TutorOrchestrator Architecture, routing all interaction modes through a single core AI intelligence. The Hive Collaboration System facilitates interaction between the founder, Daniela (AI tutor), and Wren (development builder) via the EXPRESS Lane, a unified 3-way communication channel persisted in `founderSessions` and `collaborationMessages` tables. This system supports Emergent Intelligence Architecture, where Daniela and Wren have persistent memory and autonomous learning capabilities through a Capture, Store, Retrieve, and Apply loop.

Wren's intelligence is enhanced by the Wren Intelligence Service for insight capture and the Wren Proactive Intelligence Service, which includes Proactive Triggers, a Daniela Feedback Loop, Architectural Decision Records (ADR), a Priority Inference Engine, and Project Health Awareness. The Student Learning Service tracks student error patterns, validates teaching strategies, and injects personalized learning context into Daniela's prompts.

Key features include STT Confidence Integration for clarification, Deepgram Intelligence Integration for real-time voice analysis (sentiment, intent, entity detection, speaker diarization, language detection, topic detection, summarization), and Predictive Student Intelligence for anticipating struggles, analyzing root causes, and detecting motivation dips or plateaus. Predictive Teaching is implemented with a neural network-first architecture, writing predictions to the database for Daniela to read, and validated post-session.

A Shared Memory Bridge enables bidirectional insight sharing between Wren and Daniela, building a knowledge graph of architectural and pedagogical discoveries. Nightly Emergent Intelligence Jobs perform cross-student pattern synthesis, plateau detection, and insight decay.

The Hive Snapshots system (`hiveSnapshots` table) captures teaching moments for context injection. Snapshot types include `teaching_moment`, `breakthrough`, `struggle_pattern`, `beacon_context`, `session_summary`, and `plateau_alert`. The `getRecentTeachingContext()` function in brain-surgery-service.ts queries recent high-importance snapshots and formats them for prompt injection. Plateau detection automatically creates hive snapshots when students are stuck, enabling Daniela to proactively adjust her teaching strategies.

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
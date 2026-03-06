# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises across ten languages, adhering to ACTFL standards. Its vision is to be a leading AI-driven educational platform, leveraging advanced technology and pedagogical innovation to capture significant market potential in personalized language acquisition. The platform also differentiates itself by presenting multiple perspectives on contested topics in subjects like Biology and US History, providing balanced content for homeschool families.

## User Preferences
Preferred communication style: Simple, everyday language.
**DATABASE CONNECTION RULE (CRITICAL):** NEVER use `DATABASE_URL` or `process.env.DATABASE_URL` anywhere in the codebase. ALWAYS use `NEON_SHARED_DATABASE_URL` (`process.env.NEON_SHARED_DATABASE_URL`) for all database connections. This applies to all current code, bug fixes, and future development.
**SINGLE DATABASE (CRITICAL):** We use ONE shared Neon PostgreSQL database for BOTH development and production. There is no separate dev/prod database - all environments connect to the same database. This means database queries in "development" and "production" hit identical data.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later. **After completing any new feature**, add documentation to the batch doc covering: what was built, how it works, key files modified, and user-facing instructions.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.

## System Architecture
The frontend uses React, TypeScript (Vite), Shadcn/ui (Radix UI), and Tailwind CSS for a mobile-first, responsive Material Design with light/dark modes and PWA capabilities. Wouter handles routing, and React Context with TanStack Query manages state. The backend is an Express.js (Node.js) server with TypeScript, providing a RESTful API and Drizzle ORM for PostgreSQL.

A Unified TutorOrchestrator Architecture centralizes AI interactions through Daniela, incorporating the Hive Collaboration System and Student Learning Service. Key data models include Users, Conversations, VocabularyWords, and UserProgress. The system features an "Neural Network for Pedagogical Strategies," AI-powered conversation tagging, a Syllabus-Aware Competency System, and centralized Role-Based Access Control (RBAC). It supports pre-built syllabi across 10 languages and unified ACTFL assessment. A Voice Diagnostics System provides TTS observability.

The Editor Intelligence System offers cross-session memory for the Replit Agent. The Alden Session Startup Protocol loads curated insights and recent conversation summaries. The Unified Daniela Context Service ensures a consistent "One Daniela always" experience. Other components include an Observation Summarization System, Daniela Content Growth System, Voice Intelligence System, a Hybrid Memory Architecture, and a Message Checkpointing System. The ACTION_TRIGGERS Command Parsing System processes Daniela's tags for backend commands.

The Fluency Wiring System connects ACTFL Can-Do statements to lessons. An AI Lesson Generation System creates structured lesson drafts, processed by a Lesson Publishing Service. The Drill System supports multiple interactive drill types, and the Practice Explorer System enables self-directed drill practice. An Interactive Textbook serves as a visual quick-reference. The Gauntlet Runner Identity Stress Test System validates Daniela's voice identity.

The TTS provider strategy supports Google Cloud TTS (Chirp 3 HD) as primary, with Cartesia (Sonic-3), ElevenLabs (Flash v2.5), and Gemini (2.5 Flash Live) as alternatives. TTS dispatch is centralized via `tts-provider-adapter.ts` using a unified `TTSStreamingProvider` interface, managing batch vs. progressive streaming. WebSocket warm-up and an app-level heartbeat ensure connection reliability. The Voice Context Pipeline (`voice-context-pipeline.ts`) centralizes shared context-building logic for PTT and OpenMic voice paths.

A "Smart Fat Context" memory architecture preloads the student's complete profile, learned vocabulary, and recent conversations into Gemini's context window at session start to ensure rich, personalized interactions.

The `streaming-voice-orchestrator.ts` has been refactored, delegating TTS synthesis, audio streaming, and provider-specific dispatch to `tts-dispatcher.ts`. Native function call handling is managed by `native-fc-handlers.ts`, and background enrichment tasks are handled by `post-response-enrichment.ts`.

The interactive textbook is accessible via `/interactive-textbook`. Subject tutors for Biology (`/biology`) and History (`/history-tutor`) are live with specific personas. Reading modules are pre-generated, permanently cached textbook documents, generated via a four-stage pipeline: OpenStax content fetching, structured JSON generation, academic citation enrichment, and quantitative claim verification, stored in the `reading_modules` table. Student reading progress is tracked in `reading_module_views`, and a Progress Report (`/progress-report`) provides summaries and quizzes.

The Class Creation Hub (`/teacher/create-class`) now supports creating Language Classes, Academic Subject Classes linked to OpenStax textbooks, or starting from scratch. Academic classes are linked to `subject_syllabi` and identified by `is_academic_class`.

The Team Room (`/team-room`) is an internal collaboration space for David and the full AI team. Features:
- **3-panel layout**: participants (left), discussion thread (center), Express Lane analysis panel (right)
- **4 core participants + guest tutors**: David (amber), Alden (blue, Dev Steward via Claude), Daniela (purple, Curriculum Advisor via Gemini), Sofia (emerald, Tech Health via Gemini); guest tutors can be invited from tutor_voices table and disconnected per-session
- **Smart hand-raise logic**: all AI participants (core + guests) evaluate each message in parallel; only those with genuine contributions respond. Hand raises show visually with an animated icon and tooltip explaining reasoning
- **@mentions**: type `@name` in chat or click the visible @ button next to any AI participant to summon them directly; supports both core and guest tutor names
- **Guest tutor invite/disconnect**: `POST /api/team-room/sessions/:id/invite` and `/disconnect` routes; guests stored in room metadata JSON; invited tutors evaluate via Gemini with their persona context
- **PTT voice input**: Web Speech API PTT button; AI responses played back via `/api/team-room/voice/tts` using distinct Neural2 voices per participant
- **Shared canvas artifacts**: Alden generates structured artifacts (plans, tables, code blocks, insights, decisions) stored in `room_artifacts` and displayed as interactive cards in the Express Lane
- **Cross-session continuity**: on session close, Alden generates an enriched summary (decisions, action items, momentum note) stored in `room_session_summaries` and injected as a "Previously in this room..." banner at next session start
- Key files: `client/src/pages/TeamRoom.tsx`, `server/services/team-room-alden-service.ts`
- DB tables: `team_rooms`, `room_voice_messages`, `room_hand_raises`, `room_artifacts`, `room_session_summaries`

## External Dependencies
- Stripe: Payment processing.
- Replit Auth: OIDC authentication.
- Gemini API: Text and voice chat LLM.
- Deepgram API: Voice STT (Nova-3 model).
- Google Cloud Text-to-Speech: Primary TTS provider (Chirp 3 HD).
- Cartesia API: Alternative TTS provider (Sonic-3).
- ElevenLabs API: Alternative TTS provider (Flash v2.5).
- Azure Speech Services: Pronunciation assessment.
- Unsplash: Stock educational images.
- Gemini Flash-Image: AI-generated contextual images.
- Perplexity API: Academic citation enrichment (`llama-3.1-sonar-large-128k-online`).
- Wolfram Alpha LLM API: Scientific fact verification.
- OpenStax: CC BY 4.0 licensed textbook content.
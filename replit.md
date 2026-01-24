# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises across nine languages, adhering to ACTFL standards. It provides personalized chat, flashcards, and grammar modules that adapt to user progress. The project's vision is to deliver personalized AI-driven education, with market potential in individual learners and educational institutions, aiming to expand with features like teacher class management and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.

## System Architecture
The frontend uses React, TypeScript (Vite), Shadcn/ui (Radix UI), and Tailwind CSS for a mobile-first, responsive design with Material Design principles, light/dark modes, and PWA features. Routing is handled by Wouter, and state management by React Context with TanStack Query. The backend is an Express.js (Node.js) server with TypeScript, providing a RESTful API, Drizzle ORM for PostgreSQL, and Replit Auth for authentication.

The core AI is orchestrated by a Unified TutorOrchestrator Architecture, with all interactions flowing through a single AI named Daniela. A Hive Collaboration System facilitates communication between the founder, Daniela, and Wren (development builder) via the EXPRESS Lane, a unified 3-way channel supporting Emergent Intelligence Architecture with persistent memory and autonomous learning.

Key features include a Student Learning Service for tracking error patterns, a Learner Personal Facts System for storing student memories, and a Shared Memory Bridge for insight sharing. A Phase Transition Service implements a multi-agent teaching architecture guided by Daniela's "North Star System" for pedagogical decisions and an Autonomous Learning System.

Core data models include Users, Conversations, VocabularyWords, and UserProgress. The system features a "Neural Network for Pedagogical Strategies," AI-powered conversation tagging, a Syllabus-Aware Competency System, and centralized Role-Based Access Control (RBAC). HolaHola provides pre-built syllabi across 9 languages and a unified ACTFL assessment system. A Voice Diagnostics System provides observability and auto-remediation for TTS degradation.

The system utilizes a dual-database hybrid architecture with Neon PostgreSQL for data storage, separating Daniela's intelligence and curriculum content (SHARED database) from user-specific data (USER database). All services use Neon routing.

### Database Routing Architecture (January 2026 Consolidation)

**Critical Background:** On January 24, 2026, a major database cleanup resolved cross-database foreign key constraint issues that were causing silent write failures.

**The Problem:** PostgreSQL cannot enforce foreign key constraints across different databases. When tables in the USER database had FK constraints pointing to tables in the SHARED database (or vice versa), writes would silently fail.

**Resolution:**
- Dropped 29 cross-database FK constraints across tables including: `actfl_assessment_events`, `class_hour_packages`, `compass_examples`, `consultation_threads`, `curriculum_paths`, `daniela_recommendations`, `learning_motivations`, `people_connections`, `pronunciation_audio/scores`, `self_practice_sessions`, `session_notes`, `student_lesson_progress/tier_signals`, `syllabus_progress`, `topic_competency_observations`, `usage_ledger`, `user_drill_progress`, `user_lesson_items`, `vocabulary_words`, and `voice_sessions`
- Cross-database relationships now use soft references with application-level validation
- Diagnostic scripts created: `check-fk-constraints.ts` (audit), `fix-cross-db-fks.ts` (remediation)

**Routing Rules:**
| Variable | Routes To | Use For |
|----------|-----------|---------|
| `db` | SHARED | Default - curriculum, conversations, voice sessions, usage tracking |
| `getSharedDb()` | SHARED | Explicit shared access |
| `getUserDb()` | USER | User profiles, auth, per-environment progress |

**Key Table Locations:**
- **SHARED:** `usage_ledger`, `voice_sessions`, `conversations`, `messages`, `vocabulary_words`, `class_enrollments`, `tutor_sessions`, curriculum tables
- **USER:** `users`, `user_progress`, `sessions`, `auth_tokens`, Stripe tables, per-user progress tables

**IMPORTANT:** When adding new tables with FKs, ensure both tables are in the SAME database. If cross-database reference is needed, use soft references (store ID only, no FK constraint) with application-level validation.

### Voice Session Transcript Persistence Fix (January 24, 2026)

**Problem Identified:** Voice session transcripts were not being saved to the database. Investigation revealed:
- 1054 voice sessions existed, many with 10+ minutes of content
- 0 messages saved for recent voice sessions
- Root cause: Client sends `conversationId` in socket handshake, but conversation record may not exist
- FK constraint on `messages.conversation_id → conversations.id` causes silent INSERT failures
- Errors were caught with `.catch()` and logged but not surfaced

**Fix Applied:** `server/unified-ws-handler.ts` now creates the conversation if it doesn't exist when a voice session starts:
- Both `start_session` handlers (lines ~545 and ~2780) now check if conversation exists
- If missing, creates it with: `{ id: conversationId, userId, language, title: 'Voice Session' }`
- This ensures FK constraint succeeds and messages persist properly

**Memory Architecture Tables:**
- `collaboration_messages` (777+ messages) - Express Lane 3-way collaboration (Founder/Daniela/Wren)
- `agent_collab_messages` - Hive system messages (Hiragana tool discussions, etc.)
- `messages` - Regular voice/text chat transcripts linked to `conversations`
- `voice_sessions` - Session metadata (duration, exchange_count, etc.)

An Observation Summarization System condenses observations into insights. The Daniela Content Growth System enables autonomous pedagogical content creation. The Voice Intelligence System provides commercial-grade voice analytics. A Tutor Naming Architecture supports 36 tutors (18 main, 18 assistants). The Voice Lab System offers real-time voice tuning for admin users. The Sofia Support Agent System provides dual-mode technical support and integrates with production telemetry for self-diagnosis. A Production Telemetry System logs voice session errors to the shared Neon database for cross-environment monitoring. A Memory Recovery System checkpoints utterances to survive session interruptions.

The Message Checkpointing System prevents user message loss by saving messages to the database before calling the Gemini API. The ACTION_TRIGGERS Command Parsing System processes Daniela's literal tags for backend commands. A Hybrid Memory Architecture provides "infinite memory" for Daniela, combining pre-loaded context with on-demand neural network lookups. The Student Snapshot System provides Daniela with session continuity and personal connection points at voice session start.

Gemini 3 Streaming Function Calling enables reduced latency through early intent detection. Multimodal Function Responses allow tool results to include images/PDFs. A Multimodal Image Recall System enables Daniela to view and describe photos shared in Express Lane conversations. Context Caching Optimization separates static system prompts from dynamic per-turn context for cost reduction and faster time-to-first-token.

The Fluency Wiring System connects ACTFL Can-Do statements to lessons. An AI Lesson Generation System automatically creates structured lesson drafts using Gemini Flash, ensuring 100% ACTFL Can-Do statement coverage. A Lesson Publishing Service converts approved drafts into curriculum lessons. The Drill System supports multiple interactive drill types. The Practice Explorer System enables self-directed drill practice. An Interactive Textbook provides a visual quick-reference companion to voice sessions, displaying lessons, infographics, drill distribution charts, and vocabulary previews.

## External Dependencies
- Stripe: Payment processing and subscription management.
- Replit Auth: OIDC authentication.
- Gemini API: Text chat completions and voice chat LLM.
- Deepgram API: Voice STT (Nova-3 model).
- Cartesia API: Primary TTS (Sonic-3 model).
- Google Cloud Text-to-Speech: For support/assistant tutors.
- Azure Speech Services: Pronunciation assessment for drill assignment.
- Unsplash: Stock educational images.
- Gemini Flash-Image: AI-generated contextual images.
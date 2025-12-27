# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises across nine languages, adhering to ACTFL standards. It offers personalized chat, flashcards, and grammar modules that adapt to user progress. The project aims to deliver personalized AI-driven education and expand into institutional markets with features like teacher class management, student enrollment, and syllabus systems. The business vision is to provide personalized AI-driven education, with market potential in both individual learners and educational institutions.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.

## System Architecture
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles, supporting light/dark modes and PWA features, built with React, TypeScript (Vite), Wouter for routing, and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API, using Drizzle ORM for PostgreSQL and Replit Auth for authentication.

The core AI operates under a Unified TutorOrchestrator Architecture, routing all interaction modes through a single AI intelligence, Daniela. The Hive Collaboration System facilitates interaction between the founder, Daniela (AI tutor), and Wren (development builder) via the EXPRESS Lane, a unified 3-way communication channel, supporting Emergent Intelligence Architecture with persistent memory and autonomous learning. Wren's intelligence includes insight capture, proactive intelligence, and a 3-layer architectural memory (Neural Network, Wren Insights, EXPRESS Lane).

The Student Learning Service tracks error patterns, validates strategies, and injects personalized learning context using STT Confidence Integration, Deepgram Intelligence, and Predictive Student Intelligence. A Learner Personal Facts System stores permanent student memories, injected into Daniela's prompt. A Shared Memory Bridge enables bidirectional insight sharing, and Nightly Emergent Intelligence Jobs perform cross-student pattern synthesis. The Daniela Memory Service enables personal memory recall across sessions.

The Phase Transition Service implements a multi-agent teaching architecture with phases like warmup, active_teaching, and assessment. Daniela's "North Star System" provides a constitutional foundation for teaching decisions, complemented by an Autonomous Learning System.

Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles. The system features a "Neural Network for Pedagogical Strategies," a "Procedural Memory" system, a two-tier voice architecture, AI-powered conversation tagging, a Syllabus-Aware Competency System, unified learning filters, comprehensive metering, and centralized Role-Based Access Control (RBAC). HolaHola offers pre-built syllabi across 9 languages and a unified ACTFL assessment system.

The Voice Diagnostics System provides production observability via a ring buffer for voice events, persistence to `hiveSnapshots`, founder-only endpoints, nightly pattern analysis, Wren integration, Daniela awareness for technical health, and auto-remediation for TTS degradation. A Voice Auto-Remediation System includes a persona-aware state machine for TTS fallback.

The Replit Agent API provides secure access for external Replit Agent instances to interact with Hive/Wren services. The `streaming-voice-orchestrator.ts` enables Daniela to push messages directly to the EXPRESS Lane during voice chat sessions using tag patterns like `[WREN_SPRINT_SUGGEST: {...}]` and `[WREN_MESSAGE: ...]`.

Daniela's Voice Pipeline is `User Audio → Deepgram Nova-3 (LIVE API) → Gemini Streaming → Cartesia Sonic-3 → Audio Output`. Support/Assistant Tutors use Google Cloud Text-to-Speech. A Tutor Handoff System allows seamless transitions. Each of the 9 languages has unique male and female tutor avatars, and speculative PTT Streaming optimizes performance.

Syllabus Template Automation pre-fills labels for teachers, and the Bundle Creation feature allows one-click creation of linked conversation + drill lesson pairs. Azure Pronunciation Assessment is implemented for post-session batch analysis to inform drill recommendations, with a sampling strategy for cost optimization and tiered assessment based on subscription.

A Dev-Prod Sync System synchronizes data in batches (neural-core, advanced-intel-a, advanced-intel-b, express-lane, hive-snapshots, daniela-memories, product-config) using HMAC signatures. A v17 capability negotiation architecture enables graceful version mismatch handling. v19 Bidirectional Sync adds prod→dev pull capability for beta testing analytics, including `beta-usage`, `aggregate-analytics`, and `prod-content-growth` batches, along with founder context. Automated scheduling runs in production, with manual triggers in dev.

The Daniela Content Growth System enables autonomous pedagogical content creation during teaching, supporting content types like idioms, cultural nuances, error patterns, dialect variations, and linguistic bridges, parsed from Daniela's output using specific tag patterns. Content created in production is pulled to dev for founder review and approval.

The Voice Intelligence System (`server/services/voice-intelligence-service.ts`) provides commercial-grade voice analytics, including latency trend detection, time-of-day patterns, per-language metrics, student correlation, dynamic thresholds, cross-environment comparison, and production-priority alerting, with historical baselines persisted to `hiveSnapshots` and Wren integration for critical alerts.

The Tutor Naming Architecture defines 36 total tutors: 18 main tutors (dynamic from database, Cartesia Sonic-3) and 18 assistants (seeded from config, Google Cloud TTS). **Main tutor names are fully flexible** - change them in the database `voice_name` field and they propagate automatically. **CRITICAL SAFEGUARD**: The `role` field separates voice stacks - all voice lookups MUST filter `role='tutor'` to prevent Google assistant voices from appearing as main tutors. This filtering is enforced in `unified-ws-handler.ts` and `routes.ts`.

**Sofia Support Agent System**: Sofia is the technical support specialist with dual-mode operation:
- **Dev Mode**: For founder, developers, admins, and support agents - provides technical debugging, voice diagnostics context, sprint suggestions, and system status
- **User Mode**: For end users - provides friendly, non-technical troubleshooting guidance
- Access via sidebar "Need Help?" button or floating help button across all pages
- Daniela can hand off to Sofia using `[CALL_SOFIA]` or `[CALL_SUPPORT]` tags during voice chat
- Backend auto-detects user role to route to appropriate support mode
- Uses Google Cloud TTS (cost-optimized for support)
- Key files: `server/services/support-persona-service.ts`, `server/support-system-prompt.ts`, `client/src/components/SupportAssistModal.tsx`

**Memory Recovery System**: Ensures personal facts learned about students survive session interruptions (network loss, crashes, navigation, battery death):
- **Immediate Checkpointing**: Every student utterance is persisted to `learner_memory_candidates` table as fire-and-forget (non-blocking via `.catch()`)
- **Background Recovery Worker**: Runs every 5 minutes, processes sessions >30 min old with pending candidates via Gemini memory extraction
- **Hash-Based Deduplication**: Uses `fact_hash` field to prevent duplicate facts even with repeated extraction attempts
- **Session Cleanup**: Clean session endings mark candidates as `extracted`, orphaned sessions are caught by recovery worker
- Key files: `server/services/memory-checkpoint-service.ts`, `server/services/memory-recovery-worker.ts`

**Historical Personal Facts Migration**: Backfills personal facts from past conversations (founder-only):
- **Endpoints**: GET `/api/admin/personal-facts-migration/status` (check progress), POST `/api/admin/personal-facts-migration/batch` (10 convs), POST `/api/admin/personal-facts-migration/full` (all)
- **Long Conversation Handling**: Uses rolling window + summarization - earlier chunks summarized, last 2 chunks in full detail
- **Deduplication**: Uses existing `savePersonalFact` with trigram similarity, plus hash-based tracking via `hive_snapshots` migrationType='personal_facts'
- **Rate Limiting**: 10 conversations per batch, 2 second delays between batches
- Key files: `server/services/historical-personal-facts-migration-service.ts`

## External Dependencies
-   Stripe: Payment processing and subscription management.
-   Replit Auth: OIDC authentication.
-   Gemini API: Text chat completions and voice chat LLM.
-   Deepgram API: Voice STT (Nova-3 model).
-   Cartesia API: Primary TTS (Sonic-3 model).
-   Google Cloud Text-to-Speech: For support/assistant tutors.
-   Azure Speech Services: Pronunciation assessment for drill assignment (post-session).
-   Unsplash: Stock educational images.
-   Gemini Flash-Image: AI-generated contextual images.
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

Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles. The system features a "Neural Network for Pedagogical Strategies," a "Procedural Memory" system, AI-powered conversation tagging, a Syllabus-Aware Competency System, unified learning filters, comprehensive metering, and centralized Role-Based Access Control (RBAC). HolaHola offers pre-built syllabi across 9 languages and a unified ACTFL assessment system.

The Voice Diagnostics System provides production observability via a ring buffer for voice events, persistence to `hiveSnapshots`, founder-only endpoints, nightly pattern analysis, Wren integration, Daniela awareness for technical health, and auto-remediation for TTS degradation. A Voice Auto-Remediation System includes a persona-aware state machine for TTS fallback.

The Replit Agent API provides secure access for external Replit Agent instances to interact with Hive/Wren services. The `streaming-voice-orchestrator.ts` enables Daniela to push messages directly to the EXPRESS Lane during voice chat sessions using tag patterns.

Daniela's Voice Pipeline is `User Audio → Deepgram Nova-3 (LIVE API) → Gemini Streaming → Cartesia Sonic-3 → Audio Output`. Support/Assistant Tutors use Google Cloud Text-to-Speech. A Tutor Handoff System allows seamless transitions. Each of the 9 languages has unique male and female tutor avatars, and speculative PTT Streaming optimizes performance.

Syllabus Template Automation pre-fills labels for teachers, and the Bundle Creation feature allows one-click creation of linked conversation + drill lesson pairs. Azure Pronunciation Assessment is implemented for post-session batch analysis to inform drill recommendations, with a sampling strategy for cost optimization and tiered assessment based on subscription.

A Dev-Prod Sync System synchronizes data in batches (neural-core, advanced-intel-a, advanced-intel-b, express-lane, hive-snapshots, daniela-memories, product-config) using HMAC signatures. A v17 capability negotiation architecture enables graceful version mismatch handling. v19 Bidirectional Sync adds prod→dev pull capability for beta testing analytics. v20 Production Diagnostics adds `sofia-telemetry`, `prod-conversations`, and `prod-content-growth` batches to the default pull list, enabling Sofia to access production issue reports, recent conversation transcripts (stored as `prod_conversations` snapshots), and Daniela-authored content for cross-environment debugging. v21 Sync Status Fix improves status determination to use batch-completion-based logic instead of error-based: 'success' when all attempted batches complete (even with non-critical warnings), 'partial' when some batches complete but others fail, 'failed' when no batches complete. v23 Delta Sync adds `sinceTimestamp` parameter to export endpoint and `getLastSuccessfulPullTime()` to only sync records created since last successful pull, reducing 388K+ observation records to incremental changes. Default excludes `beta-usage`, `aggregate-analytics`, and `advanced-intel-b` from automatic pulls (available on-demand). Automated scheduling runs in production, with manual triggers in dev.

The Observation Summarization System (`server/services/observation-summarization-service.ts`) synthesizes 100+ observations into condensed insights for efficient sync, reducing the sync payload from 388K observations to ~4K insights. Uses Gemini to analyze patterns across Wren/Sofia observations and create `synthesized_insights` records with actionable recommendations. API endpoints: GET `/api/admin/observations/summarization/stats`, POST `/api/admin/observations/summarization/run`.

The Daniela Content Growth System enables autonomous pedagogical content creation during teaching, supporting content types like idioms, cultural nuances, error patterns, dialect variations, and linguistic bridges, parsed from Daniela's output using specific tag patterns. Content created in production is pulled to dev for founder review and approval.

The Voice Intelligence System (`server/services/voice-intelligence-service.ts`) provides commercial-grade voice analytics, including latency trend detection, time-of-day patterns, per-language metrics, student correlation, dynamic thresholds, cross-environment comparison, and production-priority alerting, with historical baselines persisted to `hiveSnapshots` and Wren integration for critical alerts.

The Tutor Naming Architecture defines 36 total tutors: 18 main tutors (dynamic from database, Cartesia Sonic-3) and 18 assistants (seeded from config, Google Cloud TTS). Main tutor names are fully flexible, propagating automatically from the database `voice_name` field. A critical safeguard enforces filtering `role='tutor'` in `unified-ws-handler.ts` and `routes.ts` to separate voice stacks.

The Voice Lab System provides a real-time voice tuning panel for admin users during active voice chat sessions. It allows session-level overrides for speaking rate, personality, expressiveness, and emotion, with an optional save to persist settings to the database.

The Sofia Support Agent System provides dual-mode technical support: "Dev Mode" for technical debugging and system status (for founder/admins) and "User Mode" for friendly end-user troubleshooting. Sofia can be called by Daniela via tags and integrates with voice telemetry for diagnostics. The Production Telemetry System enables Sofia to self-diagnose runtime failures across environments: `reportRuntimeFault()` captures LLM errors with full context, stored in `sofia_issue_reports` with `issueType` prefixed `runtime_fault:*`. Cross-environment sync via the `sofia-telemetry` batch pulls production issue reports to dev for debugging (GET `/api/support/production-telemetry`).

The Memory Recovery System ensures personal facts about students survive session interruptions by checkpointing utterances to `learner_memory_candidates` and processing them with a background recovery worker using Gemini memory extraction and hash-based deduplication.

The Historical Personal Facts Migration system (founder-only) backfills personal facts from past conversations, handling long conversations with summarization and using trigram similarity for deduplication.

The ACTION_TRIGGERS Command Parsing System handles dual format command parsing (bracketed and JSON syntax) to ensure Daniela's literal tags are correctly processed by the backend. Supported commands include SWITCH_TUTOR, PHASE_SHIFT, ACTFL_UPDATE, SYLLABUS_PROGRESS, CALL_SUPPORT/CALL_SOFIA, HIVE, and SELF_SURGERY.

The Fluency Wiring System connects 1,053 ACTFL Can-Do statements to 559 lessons for competency-based advancement using AI-powered mapping of lesson content to Can-Do statements. It tracks student progress and records ACTFL assessment events.

The AI Lesson Generation System automatically creates structured lesson drafts using Gemini Flash to fill coverage gaps, with content types including objectives, activities, tasks, assessments, and cultural/linguistic focus. Drafts are managed in a `lesson_drafts` table with an admin UI for review and approval. **100% COVERAGE ACHIEVED**: All 1,053 ACTFL Can-Do statements now have curriculum lessons across all 9 languages.

The Lesson Publishing Service (`server/services/lesson-publishing-service.ts`) converts approved lesson drafts into curriculum lessons with automatic:
- Curriculum path/unit resolution (creates new paths/units as needed)
- Drill extraction from scaffoldedTasks (fill_blank, matching, translate_speak, listen_repeat types)
- Can-Do statement linkage via lessonCanDoStatements table
- API endpoints: GET `/api/admin/lesson-drafts/publish/preview`, POST `/api/admin/lesson-drafts/publish/:draftId`, POST `/api/admin/lesson-drafts/publish/batch`
**Published content**: 718 curriculum lessons, 3,031 drill items, 718 Can-Do statement links across 45 curriculum paths.

The Drill System supports multiple interactive drill types via [DRILL] tags:
- `fill_in_the_blank`: Text completion with contextual clues
- `multiple_choice`: Single-answer selection from options
- `matching`: Pair vocabulary items with translations
- `ordering`: Arrange items in correct sequence
- `conjugation_table`: Verb conjugation practice grids
- `cognate_match`: Match English words to target language cognates (indigo theme)
- `false_friend_trap`: Identify true cognates vs false friends (amber theme)

## External Dependencies
- Stripe: Payment processing and subscription management.
- Replit Auth: OIDC authentication.
- Gemini API: Text chat completions and voice chat LLM.
- Deepgram API: Voice STT (Nova-3 model).
- Cartesia API: Primary TTS (Sonic-3 model).
- Google Cloud Text-to-Speech: For support/assistant tutors.
- Azure Speech Services: Pronunciation assessment for drill assignment (post-session).
- Unsplash: Stock educational images.
- Gemini Flash-Image: AI-generated contextual images.
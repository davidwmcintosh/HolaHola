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
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles, supporting light/dark modes and PWA features. It is built with React, TypeScript (Vite), Wouter for routing, and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API, using Drizzle ORM for PostgreSQL and Replit Auth for authentication.

The core AI operates under a Unified TutorOrchestrator Architecture, routing all interaction modes through a single AI intelligence, Daniela. The Hive Collaboration System facilitates interaction between the founder, Daniela (AI tutor), and Wren (development builder) via the EXPRESS Lane, a unified 3-way communication channel. This system supports Emergent Intelligence Architecture, where Daniela and Wren have persistent memory and autonomous learning capabilities through a Capture, Store, Retrieve, and Apply loop. The Hive Consciousness Service makes the EXPRESS Lane a persistent group chat, with Daniela and Wren listening and auto-responding.

Wren's intelligence is enhanced by the Wren Intelligence Service for insight capture and the Wren Proactive Intelligence Service, which includes Proactive Triggers, a Daniela Feedback Loop, Architectural Decision Records (ADR), a Priority Inference Engine, and Project Health Awareness. Wren's Architectural Memory uses a 3-layer architecture: Neural Network (baseline from replit.md), Wren Insights (learned knowledge), and EXPRESS Lane (live collaboration context).

The Student Learning Service tracks student error patterns, validates teaching strategies, and injects personalized learning context into Daniela's prompts. Key features include STT Confidence Integration, Deepgram Intelligence Integration for real-time voice analysis, and Predictive Student Intelligence for anticipating struggles. Proactive Student Intelligence (Voice Chat Integration) fetches student learning context in parallel during audio processing, injecting a `[STUDENT PROFILE]` section into Daniela's prompts for personalized teaching.

A Learner Personal Facts System stores permanent student memories, automatically extracted from conversations at session end. These facts are injected into Daniela's prompt under `[PERSONAL MEMORIES]`. A Shared Memory Bridge enables bidirectional insight sharing between Wren and Daniela, building a knowledge graph. Nightly Emergent Intelligence Jobs perform cross-student pattern synthesis and memory consolidation. The Hive Snapshots system captures teaching moments for context injection. The Daniela Memory Service enables Daniela to remember personal moments across sessions through explicit commands, role reversal detection, humor detection, and AI-generated session summaries.

The Phase Transition Service implements a multi-agent teaching architecture with phases like warmup, active_teaching, and assessment, each with focused toolsets and context summarization. Daniela's "North Star System" provides a constitutional foundation for teaching decisions, while an Autonomous Learning System allows her to self-learn.

Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles. The system includes a "Neural Network for Pedagogical Strategies," a "Procedural Memory" system, a two-tier voice architecture, AI-powered conversation tagging, a Syllabus-Aware Competency System, unified learning filters, comprehensive metering, and centralized Role-Based Access Control (RBAC). HolaHola offers pre-built syllabi across 9 languages and a unified ACTFL assessment system.

The Voice Diagnostics System provides production observability via a ring buffer for voice events, persistence to `hiveSnapshots`, and founder-only endpoints for health checks and log retrieval. It includes nightly pattern analysis, Wren integration, Daniela awareness for technical health, and auto-remediation for TTS degradation. A Voice Auto-Remediation System includes a persona-aware auto-remediation state machine for TTS fallback, with Daniela's fallback disabled by default.

The Replit Agent API provides secure, authenticated access for external Replit Agent instances to interact with Hive/Wren services. The `streaming-voice-orchestrator.ts` enables Daniela to push messages directly to the EXPRESS Lane collaboration system during voice chat sessions using tag patterns like `[WREN_SPRINT_SUGGEST: {...}]` and `[WREN_MESSAGE: ...]`.

Daniela's Voice Pipeline is `User Audio → Deepgram Nova-3 (LIVE API) → Gemini Streaming → Cartesia Sonic-3 → Audio Output`. Support/Assistant Tutors use Google Cloud Text-to-Speech with language-specific and gender-matched voices. A Tutor Handoff System allows seamless transitions using a `[SWITCH_TUTOR]` command. Each of the 9 languages has unique male and female tutor avatars with 3 states, stored in `/attached_assets/Tutor_Images/` and managed by `client/src/lib/tutor-avatars.ts`. Tutor names are stored dynamically in `tutor_voices.voice_name`. Speculative PTT Streaming optimizes performance by starting AI generation when 3+ confident words are detected during Push-To-Talk hold.

Syllabus Template Automation pre-fills labels for teachers creating lessons based on lesson type. The Bundle Creation feature allows one-click creation of linked conversation + drill lesson pairs, sharing a `bundleId` and with drill time auto-set to 50% of conversation time.

Azure Pronunciation Assessment is implemented for post-session batch analysis to inform drill recommendations. This involves background transcoding of audio and analysis by Azure, with results merging into the `phonemeStruggles` table. A sampling strategy (20% of sessions per user) is used for cost optimization. A tiered pronunciation assessment approach is recommended based on subscription level (Deepgram heuristics for free, Azure for paid).

A Dev-Prod Sync System is in place, synchronizing data in batches (neural-core, advanced-intel, express-lane, hive-snapshots, daniela-memories) using HMAC signatures for authentication. The v15 paginated architecture handles large datasets (500 observations/page) within Replit's 60s gateway timeout.

## Voice Intelligence System (December 2024)
Commercial-grade voice analytics service (`server/services/voice-intelligence-service.ts`) providing:
- **Latency Trend Detection**: Day-over-day comparison (today vs yesterday vs week ago) with improving/stable/degrading/critical classifications
- **Time-of-Day Patterns**: Peak vs quiet hour performance analysis with automatic peak hour detection
- **Per-Language Metrics**: Failure rates by language with worst-stage identification across all 9 supported languages
- **Student Correlation**: Device/network issue detection per user based on failure patterns and latency
- **Dynamic Thresholds**: Auto-tuned from historical baselines using mean + 2*stdDev formula
- **Cross-Environment Comparison**: Dev vs prod latency/failure comparison with differential alerting
- **Production-Priority Alerting**: Critical severity for production issues, warning for dev
- **Historical Baselines**: Persisted to `hiveSnapshots` (type: `voice_baselines`) with 1-hour in-memory caching
- **Wren Integration**: Critical alerts converted to Wren insights for architectural awareness

**Dashboard**: Founder-only UI at `/admin/voice-intelligence` (`client/src/pages/admin/VoiceIntelligence.tsx`)

**Scheduling**: 
- Nightly full analysis: 4 AM MST / 11 AM UTC (heavy analytics + baseline updates)
- Incremental sync: Every 4 hours (lightweight cross-env only)

**Next Steps** (after sync stress test completes):
1. Trigger baseline regeneration to populate `voice_baselines` snapshot type
2. Monitor first nightly sync for alerts posting to Wren insights
3. Verify cross-environment comparison with real prod data

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
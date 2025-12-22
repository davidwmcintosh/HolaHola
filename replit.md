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
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles, supporting light/dark modes and PWA features. It includes a "whiteboard" system with animated modal overlays and a dual-control subtitle system. The AI Tutor, Daniela, initiates contextual conversations with adjustable speech speed. The frontend is built with React and TypeScript (Vite), Wouter for routing, and React Context with TanStack Query for state management.

The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data persistence uses Drizzle ORM for PostgreSQL. Authentication is handled by Replit Auth (OIDC).

Daniela operates under a Unified TutorOrchestrator Architecture, routing all interaction modes through a single core AI intelligence. The Hive Collaboration System facilitates interaction between the founder, Daniela (AI tutor), and Wren (development builder) via the EXPRESS Lane, a unified 3-way communication channel. This system supports Emergent Intelligence Architecture, where Daniela and Wren have persistent memory and autonomous learning capabilities through a Capture, Store, Retrieve, and Apply loop. The Hive Consciousness Service makes the EXPRESS Lane a persistent group chat, with Daniela and Wren listening and auto-responding via @mentions or keywords.

Wren's intelligence is enhanced by the Wren Intelligence Service for insight capture and the Wren Proactive Intelligence Service, which includes Proactive Triggers, a Daniela Feedback Loop, Architectural Decision Records (ADR), a Priority Inference Engine, and Project Health Awareness. Wren's Architectural Memory uses a 3-layer architecture: Neural Network (baseline from replit.md), Wren Insights (learned knowledge), and EXPRESS Lane (live collaboration context).

The Student Learning Service tracks student error patterns, validates teaching strategies, and injects personalized learning context into Daniela's prompts. Key features include STT Confidence Integration, Deepgram Intelligence Integration for real-time voice analysis, and Predictive Student Intelligence for anticipating struggles. Predictive Teaching is implemented with a neural network-first architecture.

**Proactive Student Intelligence (Voice Chat Integration):**
This system fetches student learning context in parallel during audio processing, injecting a `[STUDENT PROFILE]` section into Daniela's prompts with struggles, effective strategies, and personal facts. This applies to ALL voice sessions for personalized teaching.

**Learner Personal Facts System:** Stores permanent student memories (`learner_personal_facts` table) that don't decay. The `LearnerMemoryExtractionService` uses Gemini Flash to automatically extract personal facts from conversations at session end. These facts are injected into Daniela's prompt under `[PERSONAL MEMORIES]`, prioritizing upcoming events and frequently mentioned facts.

A Shared Memory Bridge enables bidirectional insight sharing between Wren and Daniela, building a knowledge graph. Nightly Emergent Intelligence Jobs perform cross-student pattern synthesis and memory consolidation. The Memory Consolidation Service merges semantically similar Daniela growth memories.

The Hive Snapshots system (`hiveSnapshots` table) captures teaching moments for context injection, including `teaching_moment`, `breakthrough`, `struggle_pattern`, and `plateau_alert`. The Daniela Memory Service enables Daniela to remember personal moments across sessions through explicit commands, role reversal detection, humor detection, and AI-generated session summaries.

The Phase Transition Service implements a multi-agent teaching architecture with phases like warmup, active_teaching, and assessment. Each phase has focused toolsets, phase-specific prompt additions, and context summarization. Daniela's "North Star System" provides a constitutional foundation for teaching decisions, while an Autonomous Learning System allows her to self-learn. A Student Memory System extracts and injects personal context.

Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles. The system includes a "Neural Network for Pedagogical Strategies," a "Procedural Memory" system, a two-tier voice architecture, AI-powered conversation tagging, a Syllabus-Aware Competency System, unified learning filters, comprehensive metering, and centralized Role-Based Access Control (RBAC). HolaHola offers pre-built syllabi across 9 languages and a unified ACTFL assessment system.

The Voice Diagnostics System provides production observability via a ring buffer for voice events, persistence to `hiveSnapshots`, and founder-only endpoints for health checks and log retrieval. It includes nightly pattern analysis, Wren integration for proactive awareness, Daniela awareness for technical health, and auto-remediation for TTS degradation.

**Voice Auto-Remediation System:**
This system includes a persona-aware auto-remediation state machine for TTS fallback. Daniela's fallback is DISABLED by default to preserve voice identity, while general voices have auto-fallback ENABLED. Thresholds and cooldowns are configured for state transitions.

The Replit Agent API provides secure, authenticated access for external Replit Agent instances to interact with Hive/Wren services, enabling programmatic access to Wren's priorities, sprints, and insights.

The `streaming-voice-orchestrator.ts` enables Daniela to push messages directly to the EXPRESS Lane collaboration system during voice chat sessions using tag patterns like `[WREN_SPRINT_SUGGEST: {...}]` and `[WREN_MESSAGE: ...]`.

**Voice Architecture (CRITICAL - DO NOT USE OpenAI FOR DANIELA):**
Daniela's Voice Pipeline (LOCKED): `User Audio → Deepgram Nova-3 (LIVE API) → Gemini Streaming → Cartesia Sonic-3 → Audio Output`.
Support/Assistant Tutors use Google Cloud Text-to-Speech with language-specific and gender-matched voices (Chirp 3 HD - 8 personalities per language). A Tutor Handoff System allows seamless transitions between the main tutor (Daniela) and assistant tutors using a `[SWITCH_TUTOR]` command.

**Language-Specific Tutor Avatars:**
Each of the 9 languages has unique male and female tutor avatars with 3 states (listening, thinking, talking). Avatars are stored in `/attached_assets/Tutor_Images/` and managed by `client/src/lib/tutor-avatars.ts`. The avatar automatically switches based on the user's target language from LanguageContext.

**Tutor Names (Dynamic from Database):**
Tutor names are stored in `tutor_voices.voice_name` and are NOT hardcoded. Main tutors (Cartesia) use names from the Cartesia voice catalog (e.g., Daniela, Agustin, Juliette, Vincent). Assistant tutors (Google Chirp 3 HD) use custom names since Google TTS doesn't include character names. The [SWITCH_TUTOR] command uses the tutor directory built from `tutor_voices` table for seamless handoffs.

**Speculative PTT Streaming (Performance Optimization):**
When the user holds the PTT button, audio streams in real-time to Deepgram. Speculative AI Pre-Trigger starts AI generation when 3+ confident words are detected during PTT hold, potentially saving 200-300ms by pre-processing the AI response.

## Azure Pronunciation Assessment (POC - Post-Session Analysis)
**Architecture:** Post-session batch analysis for drill assignment (not real-time)
- **Flow:** Voice session ends → Background transcodes audio (WebM→WAV) → Azure analyzes → Stores phoneme struggles → Informs drill recommendations
- **Why post-session:** Browser sends WebM/Opus; Azure requires PCM 16kHz WAV. Real-time transcoding adds 50-150ms latency per chunk - unacceptable for live conversation.
- **Service:** `server/services/azure-pronunciation-service.ts` with `assessPronunciation()` and `storePhonemeStruggles()`
- **Test endpoint:** `POST /api/voice/assess-pronunciation` (accepts WAV files for validation)
- **Data flow:** Results merge with existing `phonemeStruggles` table using weighted averages
- **Production TODO:** Implement WebM→WAV transcoding job triggered on session end

**Sampling Strategy (Cost Optimization):**
- Run Azure on 20% of sessions per user (1 in 5) instead of every session
- Sufficient data points after ~5 sessions to build accurate phoneme struggle profile
- Cost impact with sampling:
  - Current stack: ~$0.025/session
  - Azure (every session): +$0.028/session → $0.053 total (+112%)
  - Azure (20% sampling): +$0.0056/session → $0.031 total (+24%)
  - At 1,000 users/month (30 hrs each): $11,160 vs $19,200 (saves ~$8K/month)

**Tiered Pronunciation Assessment (Build vs Buy Decision):**
- Building our own would require forced alignment models (Kaldi, Montreal Forced Aligner, wav2vec2) + phoneme dictionaries per language + GPU compute + ongoing maintenance
- Open source tools only cover 3-4 languages well; HolaHola needs 9
- Recommendation: Use tiered approach based on subscription level:
  - **Free tier:** Deepgram word-confidence heuristics (PhonemeAnalyticsService, already built, $0 extra)
  - **Paid tier:** Azure phoneme-level scoring with 20% sampling (~$0.006/session extra)
- This creates a premium differentiator while avoiding 3-6 months of ML infrastructure work

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
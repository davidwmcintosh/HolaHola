# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across nine languages, adhering to ACTFL standards. It offers personalized chat, flashcards, and grammar modules that adapt to user progress. The project's vision is to deliver personalized AI-driven education, with market potential in individual learners and educational institutions, aiming to expand with features like teacher class management and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.

## System Architecture
The frontend utilizes a mobile-first, responsive design built with React, TypeScript (Vite), Shadcn/ui (Radix UI), and Tailwind CSS, incorporating Material Design principles, light/dark modes, and PWA features. Wouter is used for routing, and React Context with TanStack Query manages state. The backend is an Express.js (Node.js) server with TypeScript, providing a RESTful API, Drizzle ORM for PostgreSQL, and Replit Auth for authentication.

The core AI is orchestrated by a Unified TutorOrchestrator Architecture, with all interactions flowing through a single AI intelligence named Daniela. The Hive Collaboration System facilitates communication between the founder, Daniela, and Wren (development builder) via the EXPRESS Lane, a unified 3-way channel supporting Emergent Intelligence Architecture with persistent memory and autonomous learning.

Key features include a Student Learning Service for tracking error patterns and personalizing learning, a Learner Personal Facts System for storing student memories, and a Shared Memory Bridge for insight sharing. A Phase Transition Service implements a multi-agent teaching architecture, guided by Daniela's "North Star System" for pedagogical decisions and an Autonomous Learning System.

Core data models encompass Users, Conversations, VocabularyWords, and UserProgress. The system includes a "Neural Network for Pedagogical Strategies," AI-powered conversation tagging, a Syllabus-Aware Competency System, and centralized Role-Based Access Control (RBAC). HolaHola provides pre-built syllabi across 9 languages and a unified ACTFL assessment system.

A Voice Diagnostics System provides observability and auto-remediation for TTS degradation. The Replit Agent API allows external Replit Agent instances to interact with Hive/Wren services. Daniela's Voice Pipeline integrates Deepgram Nova-3 for STT and Cartesia Sonic-3 for TTS, with Google Cloud TTS used for support/assistant tutors. A Tutor Handoff System ensures seamless transitions.

Syllabus Template Automation pre-fills labels for teachers, and a Bundle Creation feature enables one-click lesson creation. Azure Pronunciation Assessment is used for post-session analysis to inform drill recommendations.

A Dev-Prod Sync System synchronizes critical data batches between environments, supporting bidirectional sync and delta syncing for efficiency. An Observation Summarization System condenses observations into insights using Gemini. The Daniela Content Growth System enables autonomous pedagogical content creation.

The Voice Intelligence System provides commercial-grade voice analytics and production-priority alerting. A Tutor Naming Architecture supports 36 tutors (18 main, 18 assistants) with flexible naming. The Voice Lab System offers real-time voice tuning for admin users.

The Sofia Support Agent System provides dual-mode technical support (Dev Mode for debugging, User Mode for troubleshooting) and integrates with production telemetry for self-diagnosis. A Memory Recovery System checkpoints utterances to survive session interruptions, and a Historical Personal Facts Migration system backfills personal facts from past conversations.

The ACTION_TRIGGERS Command Parsing System processes Daniela's literal tags for backend commands like SWITCH_TUTOR and PHASE_SHIFT. A Hybrid Memory Architecture provides "infinite memory" for Daniela, combining pre-loaded context with on-demand neural network lookups across various domains. The Student Snapshot System gives Daniela session continuity and personal connection points at voice session start, including last lesson topic/date, syllabus position, engagement streaks, and personal follow-up facts to naturally reference in conversation.

Gemini 3 Streaming Function Calling enables reduced latency through early intent detection. When Gemini calls functions like switch_tutor or phase_shift, the system detects the intent as soon as the function name streams (before arguments are complete), allowing preloading of resources. Unique callIndex tracking prevents collision when the same function is called multiple times in a turn. Multimodal Function Responses allow tool results to include images/PDFs alongside text using `createMultimodalFunctionResponse()`, with a lightweight `createMultimodalFunctionResponseTextOnly()` variant for history replay. **Note:** The `streamFunctionCallArguments` parameter for early argument streaming is Vertex AI only - not supported in the standard Gemini API we use.

The Fluency Wiring System connects ACTFL Can-Do statements to lessons for competency-based advancement. An AI Lesson Generation System automatically creates structured lesson drafts using Gemini Flash, ensuring 100% ACTFL Can-Do statement coverage across all languages. A Lesson Publishing Service converts approved drafts into curriculum lessons, extracting drills and linking Can-Do statements. The Drill System supports multiple interactive drill types (e.g., fill-in-the-blank, multiple choice). The Practice Explorer System enables self-directed drill practice with a browsable catalog and separate session tracking.

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
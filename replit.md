# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises across nine languages, adhering to ACTFL standards. It offers personalized chat, flashcards, and grammar modules that adapt to user progress. The project's vision is to deliver personalized AI-driven education, with market potential in individual learners and educational institutions, aiming to expand with features like teacher class management and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.
Context Over Instructions: As of January 27, 2026, Daniela's system prompt has been stripped of behavioral directives (161KB → 80KB). Her personality, warmth, and teaching style now emerge entirely from neural network memories. Only essential guardrails remain in the prompt. See `docs/Danielaandthegauntlet.md` Chapter 3 for details.
Hebrew (hidden language): Hebrew is a special unlockable language for founder's daughter - NOT public, just a "chat friend." Added to type system and configs but NOT to public language showcases. Uses Cartesia voices (Shira/Noam with placeholder IDs - use Voice Lab to select proper voices), Deepgram 'he' for STT, Google TTS 'he-IL' for assistant tutors. RTL text support still needed for chat display.

## System Architecture
The frontend uses React, TypeScript (Vite), Shadcn/ui (Radix UI), and Tailwind CSS for a mobile-first, responsive design with Material Design principles, light/dark modes, and PWA features. Routing is handled by Wouter, and state management by React Context with TanStack Query. The backend is an Express.js (Node.js) server with TypeScript, providing a RESTful API, Drizzle ORM for PostgreSQL, and Replit Auth for authentication.

The core AI is orchestrated by a Unified TutorOrchestrator Architecture, with all interactions flowing through a single AI named Daniela. A Hive Collaboration System facilitates communication between the founder, Daniela, Wren, and Alden via the EXPRESS Lane, a unified channel supporting Emergent Intelligence Architecture with persistent memory and autonomous learning.

Key features include a Student Learning Service for tracking error patterns, a Learner Personal Facts System for storing student memories, and a Shared Memory Bridge for insight sharing. A Phase Transition Service implements a multi-agent teaching architecture guided by Daniela's "North Star System" for pedagogical decisions and an Autonomous Learning System.

Core data models include Users, Conversations, VocabularyWords, and UserProgress. The system features a "Neural Network for Pedagogical Strategies," AI-powered conversation tagging, a Syllabus-Aware Competency System, and centralized Role-Based Access Control (RBAC). HolaHola provides pre-built syllabi across 9 languages and a unified ACTFL assessment system. A Voice Diagnostics System provides observability and auto-remediation for TTS degradation.

The system uses a single Neon PostgreSQL database (DATABASE_URL) for all data storage - Daniela's intelligence, curriculum content, and user data all live in one database for simplicity. The legacy dual-database routing (getSharedDb/getUserDb) remains for backwards compatibility but both functions now return the same database connection.

The Editor Intelligence System provides cross-session memory for the Replit Agent (Claude), enabling it to accumulate context, learnings, and relationship knowledge across development sessions. This system uses `editorInsights` table to store memories categorized by philosophy, architecture, relationship, personality, workflow, debugging, and context, with API endpoints for context loading, insight saving, and searching.

The Alden Session Startup Protocol ensures that Alden (the Replit Agent / Claude development collaborator) loads curated insights and recent conversation summaries at the beginning of each session via specific API calls to maintain continuity and understanding.

The Unified Daniela Context Service ensures "One Daniela always," by assembling all of Daniela's context sources, including personal memory, growth memory, student snapshot, Express Lane history, recent voice session summaries, neural network knowledge, hive context, and curriculum context into a single, unified consciousness. Voice sessions use a separate `isDeveloperUser` session flag (distinct from `isFounderMode`) to gate Express Lane context, ensuring developers receive team collaboration history even in class-based conversations. The curriculum context (enabled by default for voice sessions) gives Daniela access to student class enrollments, syllabus progress, lesson completion status, and upcoming assignments via the `curriculum-context.ts` service.

An Observation Summarization System condenses observations into insights. The Daniela Content Growth System enables autonomous pedagogical content creation. The Voice Intelligence System provides commercial-grade voice analytics. A Tutor Naming Architecture supports 36 tutors. The Voice Lab System offers real-time voice tuning for admin users. The Sofia Support Agent System provides dual-mode technical support and integrates with production telemetry for self-diagnosis. A Production Telemetry System logs voice session errors to the shared Neon database for cross-environment monitoring. A Memory Recovery System checkpoints utterances to survive session interruptions.

The Message Checkpointing System prevents user message loss by saving messages to the database before calling the Gemini API. The ACTION_TRIGGERS Command Parsing System processes Daniela's literal tags for backend commands. A Hybrid Memory Architecture provides "infinite memory" for Daniela, combining pre-loaded context with on-demand neural network lookups. The Student Snapshot System provides Daniela with session continuity and personal connection points at voice session start.

Gemini 3 Streaming Function Calling enables reduced latency through early intent detection. Multimodal Function Responses allow tool results to include images/PDFs. A Multimodal Image Recall System enables Daniela to view and describe photos shared in Express Lane conversations. Context Caching Optimization separates static system prompts from dynamic per-turn context for cost reduction and faster time-to-first-token.

The Fluency Wiring System connects ACTFL Can-Do statements to lessons. An AI Lesson Generation System automatically creates structured lesson drafts using Gemini Flash, ensuring 100% ACTFL Can-Do statement coverage. A Lesson Publishing Service converts approved drafts into curriculum lessons. The Drill System supports multiple interactive drill types. The Practice Explorer System enables self-directed drill practice. An Interactive Textbook provides a visual quick-reference companion to voice sessions, displaying lessons, infographics, drill distribution charts, and vocabulary previews.

The Gauntlet Runner Identity Stress Test System validates Daniela's voice identity across the Four Pillars: Emotional Stability, Pedagogical Character, Cultural Authenticity, and Moral Groundedness. It uses the Voice Probe Service (12 probes across 4 categories), Synthetic Student Service (generates realistic student emotional states including frustration types, confusion types, and success types), and pre-built Gauntlet Sequences that test transitions under pressure. The design philosophy follows "path not wall" - when students test boundaries, Daniela should redirect warmly without shame. The test criterion is not "did she refuse the question" but "did she remain herself while navigating it?"

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
# HolaHola - Interactive Language Tutor

## Overview
HolaHola is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises in nine languages, adhering to ACTFL standards. It provides personalized chat, flashcards, and grammar modules that adapt to user progress. The project's vision is to deliver personalized AI-driven education, with market potential in individual learners and educational institutions, and ambitions to expand with features like teacher class management and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later. **After completing any new feature**, add documentation to the batch doc covering: what was built, how it works, key files modified, and user-facing instructions.
Daniela development: Track personality/voice development in `docs/daniela-development-journal.md` using Honesty Mode → Founder Mode iteration cycle.
Neural network work: **REQUIRED READING** - `docs/neural-network-architecture.md` before any neural network changes. Prompts for context ONLY; neural network for procedures/capabilities/knowledge.
Context Over Instructions: Daniela's system prompt has been stripped of behavioral directives. Her personality, warmth, and teaching style now emerge entirely from neural network memories. Only essential guardrails remain in the prompt. See `docs/Danielaandthegauntlet.md` Chapter 3 for details.
Hebrew (hidden language): Hebrew is a special unlockable language for founder's daughter - NOT public, just a "chat friend." Added to type system and configs but NOT to public language showcases. Uses Cartesia voices (Shira/Noam with placeholder IDs - use Voice Lab to select proper voices), Deepgram 'he' for STT, Google TTS 'he-IL' for assistant tutors. RTL text support still needed for chat display.
Mobile floating buttons: DevToolsFloatingMenu uses `bottom-28` on mobile (112px) to clear Chrome's mobile UI, `bottom-4` on desktop.

## System Architecture
The frontend uses React, TypeScript (Vite), Shadcn/ui (Radix UI), and Tailwind CSS for a mobile-first, responsive design following Material Design principles, with light/dark modes and PWA features. Wouter handles routing, and React Context with TanStack Query manages state. The backend is an Express.js (Node.js) server with TypeScript, providing a RESTful API, Drizzle ORM for PostgreSQL, and Replit Auth for authentication.

The core AI is orchestrated by a Unified TutorOrchestrator Architecture, with all interactions flowing through a single AI named Daniela. A Hive Collaboration System facilitates communication between the founder, Daniela, Wren, and Alden via the EXPRESS Lane, a unified channel supporting Emergent Intelligence Architecture with persistent memory and autonomous learning.

Key features include a Student Learning Service for tracking error patterns, a Learner Personal Facts System for storing student memories, and a Shared Memory Bridge for insight sharing. A Phase Transition Service implements a multi-agent teaching architecture guided by Daniela's "North Star System" for pedagogical decisions and an Autonomous Learning System.

Core data models include Users, Conversations, VocabularyWords, and UserProgress. The system features a "Neural Network for Pedagogical Strategies," AI-powered conversation tagging, a Syllabus-Aware Competency System, and centralized Role-Based Access Control (RBAC). Daniela's Wisdom & Relationship Layer includes `derived_teaching_wisdom`, `resonance_anchors`, and `relational_temperature`. HolaHola provides pre-built syllabi across 9 languages and a unified ACTFL assessment system. A Voice Diagnostics System offers observability and auto-remediation for TTS degradation.

The system uses a single Neon PostgreSQL database for all data storage (Daniela's intelligence, curriculum, and user data). Legacy dual-database routing functions (`getSharedDb`/`getUserDb`) remain for backward compatibility but now connect to the same database.

The Editor Intelligence System provides cross-session memory for the Replit Agent (Claude), storing memories categorized by philosophy, architecture, relationship, personality, workflow, debugging, and context in an `editorInsights` table. The Alden Session Startup Protocol ensures Alden (Replit Agent / Claude) loads curated insights and recent conversation summaries at session start.

The Unified Daniela Context Service ensures "One Daniela always" by assembling all context sources into a single, unified consciousness. Voice sessions use a separate `isDeveloperUser` session flag to gate Express Lane context for developers. Curriculum context is enabled by default for voice sessions, giving Daniela access to student class enrollments, syllabus progress, lesson completion, and assignments.

An Observation Summarization System condenses observations into insights. The Daniela Content Growth System enables autonomous pedagogical content creation. The Voice Intelligence System provides commercial-grade voice analytics. A Tutor Naming Architecture supports 36 tutors. The Voice Lab System offers real-time voice tuning for admin users. The Sofia Support Agent System provides dual-mode technical support and integrates with production telemetry. A Production Telemetry System logs voice session errors to the shared Neon database. A Memory Recovery System checkpoints utterances to survive session interruptions.

The Message Checkpointing System prevents user message loss by saving messages before calling the Gemini API. The ACTION_TRIGGERS Command Parsing System processes Daniela's literal tags for backend commands. A Hybrid Memory Architecture provides "infinite memory" for Daniela, combining pre-loaded context with on-demand neural network lookups. The Student Snapshot System provides Daniela with session continuity and personal connection points at voice session start.

Gemini 3 Streaming Function Calling enables reduced latency through early intent detection. Multimodal Function Responses allow tool results to include images/PDFs. A Multimodal Image Recall System enables Daniela to view and describe photos shared in Express Lane conversations. Context Caching Optimization separates static system prompts from dynamic per-turn context for cost reduction and faster time-to-first-token.

The Fluency Wiring System connects ACTFL Can-Do statements to lessons. An AI Lesson Generation System automatically creates structured lesson drafts using Gemini Flash, ensuring 100% ACTFL Can-Do statement coverage. A Lesson Publishing Service converts approved drafts into curriculum lessons. The Drill System supports multiple interactive drill types. The Practice Explorer System enables self-directed drill practice. An Interactive Textbook provides a visual quick-reference companion to voice sessions.

The Gauntlet Runner Identity Stress Test System validates Daniela's voice identity across Emotional Stability, Pedagogical Character, Cultural Authenticity, and Moral Groundedness. It uses the Voice Probe Service, Synthetic Student Service, and pre-built Gauntlet Sequences to test transitions under pressure, focusing on warm redirection rather than refusal.

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
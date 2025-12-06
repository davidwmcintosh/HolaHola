# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises in nine languages. It offers personalized chat, flashcards, and grammar modules that adapt to individual user progress, adhering to ACTFL standards. The project's core purpose is to deliver personalized AI-driven education, with a strategic vision to expand into institutional markets through features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).
Batch doc updates: When user says "add to the batch" or "batch doc updates", add items to `docs/batch-doc-updates.md` for consolidated documentation updates later.

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles, and supporting light/dark modes and PWA features. It includes native iOS/Android support via Capacitor, featuring voice interaction controls and a hint bar. Navigation is structured into Learning, Library, Resources, Teaching, and Administration. The AI Tutor, named Daniela, acts as the primary instructor, utilizing a "whiteboard" system for strategic visual teaching aids with animated modal overlays during voice chat. This design ensures the tutor controls the visual display during voice sessions, using tools like WRITE (text display), PHONETIC (pronunciation), COMPARE (correction), IMAGE (vocabulary images), DRILL (interactive exercises), CONTEXT (word usage), GRAMMAR_TABLE (conjugations), READING (pronunciation guides), STROKE (animated stroke order), WORD_MAP (vocabulary relationships), CULTURE (cultural insights), PLAY (audio replay), SCENARIO (role-play setup), and SUMMARY (lesson recap). Daniela initiates conversations naturally based on rich student context, and speech speed control is managed through verbal requests to Daniela for repeated, slower speech.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data persistence is handled by Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is managed by Replit Auth (OIDC), and Stripe integration for subscriptions uses `stripe-replit-sync`.

### Feature Specifications
LinguaFlow provides conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It employs a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers, tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features encompass teacher class management (syllabus template browsing, class cloning), student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. A Syllabus Builder allows teachers to customize syllabi with drag-and-drop reordering, custom lesson creation, and editing, including an ACTFL Standards Coverage panel for real-time analysis. Developer tools include test account isolation, floating dev controls, and usage analytics. Self-directed learners can customize their AI tutor's teaching style per language in Settings with four flexibility levels; class chats use the teacher's setting. Drill-based lessons for rote content support multiple modes (`listen_repeat`, `number_dictation`, `translate_speak`, `matching`, `fill_blank`), utilizing Google Cloud TTS for batch audio synthesis. Vocabulary can be exported in CSV and Anki-compatible formats. Conversation history includes full-text search with highlighted results. The "Founder Mode" provides a special collaboration mode for developer/admin users, freeing Daniela from teaching constraints to discuss LinguaFlow.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics, and MediaFiles, storing user learning preferences and ACTFL progress. The voice architecture implements a two-tier validation system and uses Cartesia Pronunciation Dictionaries for TTS correction. A server-driven subtitle system with karaoke-style word highlighting uses native Cartesia word-level timestamps via WebSocket API, with automatic fallback to bitrate-based estimation. The `sentence_ready` architecture ensures audio playback only starts after word timings arrive. "Daniela's Compass" (Time-Aware Tutoring), under the `COMPASS_ENABLED=true` flag, replaces preset flexibility levels with real-time session context. It manages tutor session state with an in-memory cache, tracking student snapshots, session roadmaps, elapsed time, parking lot items, and dual time tracking (clock time and credit time). An "Architect's Voice" feature allows injecting notes into Daniela's context for AI agent participation in voice sessions. A principled target language extraction system uses bold-only extraction and foreign character detection. A WebSocket-based progressive audio delivery system integrates Deepgram STT, Gemini streaming, and Cartesia WebSocket TTS. Dynamic streaming greetings are personalized, ACTFL-aware, history-aware, and context-aware. An AI-powered conversation tagging system categorizes conversations and vocabulary. A Syllabus-Aware Competency System tracks student progress against syllabus topics. A unified learning filter system provides consistent content filtering. A comprehensive metering system for voice tutoring time is integrated with Stripe, with a class-specific balance system. Centralized Role-Based Access Control (RBAC) defines hierarchical permissions. A hybrid grammar system combines conversational practice with targeted instruction. A syllabus content system provides pre-built syllabi across 9 languages. A class type taxonomy system categorizes classes. A tutor freedom level system controls AI tutor behavior per class. A unified ACTFL assessment system dynamically assesses learner proficiency. A placement assessment system verifies proficiency for class enrollments. A Command Center (`/admin`) provides a unified tab-based admin experience with role-based visibility for managing users, classes, analytics, and developer tools, including syllabus editing and an Image Library with quality control review workflow.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions and voice chat LLM.
-   **Deepgram API**: For voice STT (Nova-3 model).
-   **Cartesia API**: Primary TTS provider (Sonic-3 model).
-   **Google Cloud Text-to-Speech**: Fallback TTS.
-   **Unsplash**: Stock educational images.
-   **Gemini Flash-Image**: AI-generated contextual images.

### Voice Stack Strategic Decisions (Dec 2025)
**Consultation:** See `docs/daniela-voice-stack-consultation.md` for full analysis.
**Key decisions:**
- **Keep Cartesia Sonic-3** as primary TTS - latency + word timestamps + emotions unmatched
- **Word timestamps are sacred** - Critical for karaoke subtitles and language learning pedagogy
- **Open mic is the future** - Next major voice feature priority
- **Emotions matter** - 60+ emotion tags make Daniela feel human and approachable
- **Google Cloud TTS** remains as reliable fallback and drill audio provider
- **Cost optimization possible** but never at expense of word timestamps or emotional expression

**Future considerations:**
- Deepgram Aura-2: Potential cost-saving fallback IF word timestamps confirmed
- Open mic mode with intelligent VAD and barge-in support
- Real-time pronunciation feedback integration

### Libraries & Tools
-   **Database**: Neon PostgreSQL, Drizzle ORM, Drizzle Kit.
-   **UI Framework**: React, TypeScript, Vite, Wouter.
-   **UI Components**: Radix UI, Shadcn/ui, Tailwind CSS.
-   **State Management**: TanStack Query, React Context.
-   **Billing**: `stripe-replit-sync`.
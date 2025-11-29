# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises across nine languages. It leverages AI for personalized chat, flashcards, and grammar modules, adapting to individual user progress. The project's vision is to provide personalized education using AI and expand into institutional markets, guided by a pedagogical philosophy that discovers user interests while adhering to ACTFL standards.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android builds via Capacitor. Key UI elements include voice interaction controls and a hint bar, using Inter font for UI text and JetBrains Mono for code/phonetic content.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Session management uses `connect-pg-simple` with a PostgreSQL store. Authentication is handled by Replit Auth (OIDC). Stripe integration for subscriptions is managed by `stripe-replit-sync`. Form validation uses `react-hook-form` and `zodResolver`. Security includes multi-layered backend role-based authorization and frontend route guards.

### Feature Specifications
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Enhanced voice chat includes word-level timestamps, smart phrase detection, foreign-language-only display, replay/slow repeat functions, and ACTFL advancement tracking. A 3-mode subtitle system (Off, Target, All) is available. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers and tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management, student enrollment, curriculum systems, assignment workflows, and a Super Admin Backend with RBAC, user management, and audit logging.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics. User learning preferences like `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `actflLevel`, and `onboardingCompleted` are stored, alongside ACTFL progress.

**Voice Validation Architecture**: Uses a two-tier prevention approach with Gemini structured output (strict JSON schema) and a safety net using `franc-min` language detection and per-language stoplists.

**Voice TTS Pronunciation Architecture**: Utilizes Cartesia Sonic-3's custom phoneme syntax with MFA-style IPA to correct pronunciation of foreign words in English responses.

**Subtitle System Architecture**: A 3-state subtitle system (`subtitleMode`: Off, Target, All) with karaoke-style word highlighting. Word timing estimation occurs server-side, with client-side rescaling for precise synchronization.

**Streaming Voice Mode Architecture**: A WebSocket-based progressive audio delivery system with a pipeline involving Deepgram STT, Gemini streaming, sentence chunking, Cartesia WebSocket TTS, and progressive audio playback. The server streams various message types for client synchronization and feedback. Pedagogical integrations include content moderation, a "one-word rule" for beginner utterances, background vocabulary extraction, and real-time ACTFL advancement tracking.

**Dynamic Streaming Greeting System**: New conversations trigger an AI-generated personalized greeting that is ACTFL-aware, history-aware, and context-aware. A "Resume Conversation" feature allows users to continue past conversations with contextual "welcome back" greetings.

**Conversation Tagging System**: An AI-powered topic tagging system for conversations and vocabulary, categorizing content into Subject, Grammar, and Function topics. Topics are auto-tagged in the background using Gemini, extracting covered subjects, grammar concepts, and language functions, and returning topic IDs with confidence scores and estimated ACTFL levels. Vocabulary extraction includes grammar classification.

**Review Hub**: A unified learning dashboard at `/review` that guides students through prioritized learning tasks rather than requiring them to navigate separate sections. The hub aggregates:
- **Daily Plan**: Due flashcards, recent vocabulary (repetition < 3), conversation continuation, and quick practice start
- **Topic Deep Dives**: Topics with associated conversations and vocabulary, organized by subject/grammar/function
- **Cultural Corner**: 3 randomly selected cultural tips for the current language (43 tips across 9 languages)
- **Lesson Journeys**: Auto-generated weekly lessons and custom bundles
- **Quick Stats**: Streak days, words learned, conversations count, due cards
- **Mobile CTA**: Fixed "Next Up" button on mobile for primary action (review cards or start practice)

The Dashboard includes a "What's Next?" card linking to Review Hub for easy navigation.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions (Gemini 2.5 Flash, Gemini 2.5 Pro) and voice chat LLM (Gemini 2.5 Flash, Gemini 1.5 Pro).
-   **Deepgram API**: For voice STT (Nova-3 model).
-   **Cartesia API**: Primary TTS provider (Sonic-3 model).
-   **Google Cloud Text-to-Speech**: Fallback TTS (Chirp 3 HD, Neural2 voices).
-   **Unsplash**: Stock educational images.
-   **Gemini Flash-Image**: AI-generated contextual images.

### Libraries & Tools
-   **Database**: Neon PostgreSQL, Drizzle ORM, Drizzle Kit.
-   **UI Framework**: React, TypeScript, Vite, Wouter.
-   **UI Components**: Radix UI, Shadcn/ui, Tailwind CSS.
-   **State Management**: TanStack Query, React Context.
-   **Billing**: `stripe-replit-sync`.
-   **Utilities**: `date-fns`, Embla Carousel, `franc-min`.
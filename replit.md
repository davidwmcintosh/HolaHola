# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises across 9 target languages. It leverages AI for personalized chat, flashcards, and grammar modules, adapting to individual user progress. The project aims to capitalize on the educational technology market by supporting multiple languages and difficulty levels, with explanations available in any native language.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend employs a mobile-first responsive design using Shadcn/ui (Radix UI base) with Tailwind CSS, adhering to Material Design principles. It supports light/dark mode, features a two-column desktop layout and a single-column mobile layout. Key UI elements include a "Voice Learning" button, a "Type instead" option, and a hint bar promoting voice interaction. Inter is used for UI text, and JetBrains Mono for code/phonetic content. PWA features are integrated, including offline caching and home screen installation. Capacitor is configured for native iOS and Android builds, sharing 100% of the web codebase.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and the React Context API with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, providing a RESTful API. Data is stored using an abstract `IStorage` interface with Drizzle ORM for PostgreSQL. AI integration for text chat completions utilizes Gemini 2.5 Flash (via Replit's AI Integrations). Session management uses `connect-pg-simple` with a PostgreSQL session store. Authentication is handled by Replit Auth (OIDC), supporting email/password and social logins, with WebSocket connections authenticated via server-side session validation. Stripe integration for subscription management is managed by `stripe-replit-sync`.

### Feature Specifications
LinguaFlow provides conversational onboarding, an adaptive multi-phase conversation system for gradual immersion, and user agency allowing AI to suggest topics requiring user confirmation. A production-stable REST-based voice pipeline (Deepgram Nova-3 STT → Gemini → Google Cloud TTS) supports push-to-talk recording and smart language handling, delivering fast text-only responses with background enrichment for vocabulary and image generation. Content guardrails ensure appropriate learning material. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are intelligently displayed with caching. The application supports various subscription tiers (Free, Basic, Pro, Institutional) with differing features and AI model access, along with atomic voice message usage tracking. Both voice and text chat share a unified architecture for consistent instructions and context, with AI-generated conversation titles. The system tracks student proficiency using ACTFL World-Readiness Standards (Novice Low → Distinguished) and integrates ACTFL Can-Do Statements for self-assessment, with AI system prompts enhanced to align with the learner's current ACTFL level. Features like Resume Conversations, Smart Search, and AI-Powered Practice Suggestions leverage Gemini's 1M context window for enhanced learning continuity. A robust backend for institutional features is implemented for teacher class management, student enrollment, curriculum systems, assignment workflows, submission & grading, and comprehensive security architecture.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, all linked via `userId`. Stripe data is synced to a PostgreSQL `stripe` schema via webhooks. User learning preferences like `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `actflLevel`, and `onboardingCompleted` are stored. The database schema includes ACTFL proficiency level tracking across relevant tables. Institutional features include CanDoStatements, StudentCanDoProgress, CurriculumPaths, TeacherClasses, and Assignments tables. A PWA install prompt is displayed.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions (via Replit AI Integrations). Uses Gemini 2.5 Flash and Gemini 2.5 Pro.
-   **Deepgram API**: For voice STT using Nova-3 model with auto-detect mode.
-   **Google Cloud Text-to-Speech**: For authentic native pronunciation using Chirp 3 HD and Neural2 voices in the target language.
-   **Unsplash**: Stock educational images.
-   **Gemini Flash-Image**: AI-generated contextual images (via Replit AI Integrations).

### Libraries & Tools
-   **Database**: Neon PostgreSQL, Drizzle ORM, Drizzle Kit.
-   **UI Framework**: React, TypeScript, Vite, Wouter.
-   **UI Components**: Radix UI, Shadcn/ui, Tailwind CSS.
-   **State Management**: TanStack Query, React Context.
-   **Billing**: `stripe-replit-sync`.
-   **Utilities**: `date-fns`, Embla Carousel, `franc-min`.

### AI Models
-   **Text Chat**: `gemini-2.5-flash`, `gemini-2.5-pro`.
-   **Voice STT**: Deepgram `nova-3` with auto-detect mode.
-   **Voice TTS**: Google Cloud voices (Chirp 3 HD, Neural2) in target language mode.
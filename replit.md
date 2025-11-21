# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises in 9 target languages. It uses AI for personalized chat, flashcards, and grammar modules, adapting to user progress. The project aims to capture significant market potential in educational technology by supporting multiple languages and difficulty levels with explanations in any native language.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend features a mobile-first responsive design using Shadcn/ui (Radix UI base) with Tailwind CSS, adhering to Material Design principles. It includes light/dark mode, a two-column desktop layout, and a single-column mobile layout. Key UI elements include a prominent "Voice Learning" button with a "Recommended" badge, a subtle "Type instead" button, and a hint bar promoting voice learning. Typography uses Inter for UI text and JetBrains Mono for code/phonetic content. The application also supports PWA features, including offline caching, home screen installation, and auto-update notifications, with Capacitor configured for native iOS and Android builds sharing 100% of the web codebase.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), utilizing Wouter for routing and the React Context API with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data storage is managed via an abstract `IStorage` interface with Drizzle ORM for PostgreSQL. AI integration leverages OpenAI-compatible APIs via Replit's AI Integrations. Session management uses `connect-pg-simple` with a PostgreSQL session store, and authentication is handled by Replit Auth (OIDC) supporting email/password and social logins, with WebSocket connections authenticated via server-side session validation. Stripe integration for subscription management is handled by `stripe-replit-sync`.

### Feature Specifications
LinguaFlow offers a conversational onboarding process, an adaptive multi-phase conversation system for gradual language immersion, and user agency allowing AI to suggest topics which require user confirmation. A production-stable REST-based voice pipeline (Whisper STT → GPT → TTS) supports push-to-talk recording with smart language handling: Whisper auto-detects the user's spoken language (allowing questions in any language), while TTS uses the target learning language voice consistently to ensure authentic pronunciation of target language words even within English explanations. This "Split Response Architecture" delivers fast text-only responses with background enrichment for vocabulary and image generation. Content guardrails ensure appropriate learning content. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are intelligently displayed with caching. The application supports various subscription tiers (Free, Basic, Pro, Institutional) with differing features and AI model access, along with atomic voice message usage tracking. Both voice and text chat share a unified architecture for consistent instructions and context, with AI-generated conversation titles for easy retrieval and resumption.

**ACTFL Proficiency Standards Integration**: LinguaFlow now tracks student proficiency using ACTFL World-Readiness Standards (Novice Low → Distinguished). The system maintains two independent dimensions: (1) difficulty level (beginner/intermediate/advanced) for content complexity, and (2) ACTFL proficiency level for demonstrated competency. The AI is ACTFL-aware across all 3 conversation phases and auto-tags messages with appropriate proficiency indicators. Can-Do Statements (interpersonal, interpretive, presentational) are served via API (`/api/actfl/can-do-statements`) with proof-of-concept data for Spanish Novice Low. The integration supports institutional adoption by aligning with state curriculum standards while maintaining the existing 3-phase immersion system.

### System Design Choices
Core data models include Users (with Stripe billing fields), Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, all linked via `userId`. Stripe data is synced to a PostgreSQL `stripe` schema via webhooks. User learning preferences such as `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `actflLevel`, and `onboardingCompleted` are stored. The database schema includes ACTFL proficiency level tracking (`actflLevel` field) across Users, Messages, GrammarExercises, and UserProgress tables. Institutional features include CanDoStatements, StudentCanDoProgress, CurriculumPaths, TeacherClasses, and Assignments tables for state standards alignment. A PWA install prompt appears after 3 seconds, encouraging users to add the app to their home screen.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **OpenAI API**: For text chat completions (via Replit AI Integrations) and voice STT (Whisper with auto-detect mode) via user's personal key.
-   **Google Cloud Text-to-Speech**: For authentic native pronunciation using Chirp 3 HD voices (Spanish, English) and Neural2 voices (French, German, Italian, Portuguese, Japanese, Korean). TTS uses target language voice mode: when teaching Spanish, all AI responses use Spanish voice for authentic pronunciation of Spanish words, even within English explanations.
-   **Unsplash**: Stock educational images.
-   **DALL-E**: AI-generated contextual images.

### Libraries & Tools
-   **Database**: Neon PostgreSQL, Drizzle ORM, Drizzle Kit.
-   **UI Framework**: React, TypeScript, Vite, Wouter.
-   **UI Components**: Radix UI, Shadcn/ui, Tailwind CSS.
-   **State Management**: TanStack Query, React Context.
-   **Billing**: `stripe-replit-sync`.
-   **Utilities**: `date-fns`, Embla Carousel, `franc-min` (language detection).

### AI Models
-   **Text Chat**: `gpt-4o-mini` (Free/Basic/Institutional tiers), `gpt-4o` (Pro tier).
-   **Voice STT**: `whisper-1` (OpenAI) with auto-detect mode - transcribes user's actual spoken language (English, Spanish, or any language).
-   **Voice TTS**: Google Cloud voices in target language mode - uses the learning language voice for all AI responses (`es-US-Chirp-HD-O` for Spanish lessons, `en-US-Chirp-HD-O` for English lessons, Neural2 voices for other languages). Ensures authentic pronunciation of target language words. OpenAI `tts-1-hd` (fallback).
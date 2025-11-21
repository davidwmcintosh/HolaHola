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
LinguaFlow offers a conversational onboarding process, an adaptive multi-phase conversation system for gradual language immersion, and user agency allowing AI to suggest topics which require user confirmation. A production-stable REST-based voice pipeline (Whisper STT → GPT → TTS) supports push-to-talk recording, seamless text/voice mode synchronization, and enhanced pronunciation feedback. This "Split Response Architecture" delivers fast text-only responses with background enrichment for vocabulary and image generation. Content guardrails ensure appropriate learning content. Personalized learning features include auto-language detection, scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are intelligently displayed with caching. The application supports various subscription tiers (Free, Basic, Pro, Institutional) with differing features and AI model access, along with atomic voice message usage tracking. Both voice and text chat share a unified architecture for consistent instructions and context, with AI-generated conversation titles for easy retrieval and resumption.

### System Design Choices
Core data models include Users (with Stripe billing fields), Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, all linked via `userId`. Stripe data is synced to a PostgreSQL `stripe` schema via webhooks. User learning preferences such as `targetLanguage`, `nativeLanguage`, `difficultyLevel`, and `onboardingCompleted` are stored. A PWA install prompt appears after 3 seconds, encouraging users to add the app to their home screen.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **OpenAI API**: For text chat completions (via Replit AI Integrations) and voice STT (Whisper) via user's personal key.
-   **Google Cloud Text-to-Speech**: For authentic native pronunciation using Chirp 3 HD voices (latest model) with automatic language detection via franc-min and English word heuristics.
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
-   **Voice STT**: `whisper-1` (OpenAI).
-   **Voice TTS**: Google Cloud Chirp 3 HD voices with automatic language detection (`es-US-Chirp-HD-O` for Spanish, `en-US-Chirp-HD-O` for English), OpenAI `tts-1-hd` (fallback).
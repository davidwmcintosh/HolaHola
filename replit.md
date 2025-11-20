# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application focused on interactive conversation practice, vocabulary building, and grammar exercises across multiple languages and difficulty levels. It leverages AI for chat, flashcards, and grammar modules, tracking user progress to deliver a personalized and adaptive learning experience. The project supports 9 target languages (English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, Korean) with explanations in any native language, aiming for significant market potential in educational technology.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React with TypeScript (Vite).
-   **Routing**: Wouter.
-   **State Management**: React Context API, TanStack Query.
-   **UI**: Shadcn/ui (Radix UI base) styled with Tailwind CSS, following Material Design principles, with light/dark mode.
-   **Layout**: Two-column desktop, single-column mobile.
-   **Typography**: Inter (UI text), JetBrains Mono (code/phonetic content).
-   **UI/UX Decisions**: Prominent "Voice Learning" button with a "Recommended" badge, and a subtle "Type instead" button for text mode, along with a gentle hint bar in text mode encouraging voice learning.

### Backend
-   **Server**: Express.js on Node.js with TypeScript.
-   **API**: RESTful.
-   **Storage**: Abstract `IStorage` interface with Drizzle ORM for PostgreSQL.
-   **AI Integration**: OpenAI-compatible API via Replit's AI Integrations.
-   **Session Management**: `connect-pg-simple`.
-   **Authentication**: Replit Auth (OIDC) with email/password and social login support.
-   **Billing**: Stripe integration via `stripe-replit-sync` for subscription management.

### Data Models
-   **Core Entities**: Users (with Stripe billing fields), Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics (`shared/schema.ts`).
-   User-specific data linked via `userId` foreign keys.
-   Stripe data synced to PostgreSQL `stripe` schema via webhooks.
-   Multimedia content system for `mediaFiles`, `messageMedia`, `videoLessons`, `pronunciationAudio`, `lessonVisualAids`, `culturalTipMedia`.
-   User learning preferences: `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `onboardingCompleted`.

### Core Features
-   **Conversational Onboarding**: AI-guided setup with a three-layer defensive architecture.
-   **Adaptive Multi-Phase Conversation System**: Gradual transition to target language immersion, adapting to user proficiency.
-   **User Agency**: AI suggests topics but confirms with the user; features like one-question-per-response.
-   **Voice Chat**: Real-time voice conversations via OpenAI Realtime API, supporting Semantic Voice Activity Detection (VAD) with low eagerness for learners, Push-to-Talk, progressive "Listen-and-Repeat", and seamless text/voice mode synchronization. Includes an automatic retry system and enhanced pronunciation feedback.
-   **Content Guardrails**: Moderation system for appropriate learning content.
-   **Personalized Learning**: Auto-language detection, scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment.
-   **AI-Generated Educational Images**: Intelligent display of inline images (Unsplash, DALL-E) with caching.
-   **Subscription Tiers**: Free, Basic, Pro, Institutional, with varying features and AI model access.
-   **Usage Tracking**: Atomic voice message usage tracking with monthly reset and tiered limits.
-   **Unified Chat Architecture**: Both voice and text chat utilize a single `createSystemPrompt()` function for consistent instructions and beginner teaching methodologies (e.g., present tense only, one concept at a time, listen-and-repeat sequence, 7±2 word limit). Greeting logic ensures a single greeting message per conversation.

## External Dependencies

-   **Third-Party Services**: Stripe (billing), Replit Auth (authentication), OpenAI API (AI chat via Replit AI Integrations), Unsplash (stock images), DALL-E (AI-generated images).
-   **Libraries**: Neon Database Serverless, Drizzle ORM, stripe-replit-sync, Radix UI, TanStack Query, Wouter, date-fns, Embla Carousel.
-   **Database**: PostgreSQL (via `DATABASE_URL`) with Drizzle Kit for migrations, connection pooling via `@neondatabase/serverless`.
-   **AI Models**: `gpt-4o-mini-realtime-preview-2025-09-25` (Free/Basic/Institutional tiers) and `gpt-realtime` (Pro tier) for voice chat.
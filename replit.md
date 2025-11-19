# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across multiple languages and difficulty levels. It offers AI-powered chat, flashcards, and grammar modules, tracking user progress to foster consistent learning. The project aims to deliver a personalized and adaptive language learning experience with significant market potential in the educational technology sector, supporting 9 target languages (English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, Korean) with explanations in any native language.

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

### Backend
-   **Server**: Express.js on Node.js with TypeScript.
-   **API**: RESTful.
-   **Storage**: Abstract `IStorage` interface with Drizzle ORM for PostgreSQL.
-   **AI Integration**: OpenAI-compatible API via Replit's AI Integrations.
-   **Session Management**: `connect-pg-simple`.
-   **Authentication**: Replit Auth (OIDC) with email/password and social login support.
-   **Billing**: Stripe integration via `stripe-replit-sync` for subscription management, automatic data sync via webhooks.

### Data Models
-   Core entities: Users (with Stripe billing fields), Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics (`shared/schema.ts`).
-   All user-specific data (conversations, vocabulary, progress) linked via userId foreign keys for data isolation.
-   Stripe data automatically synced to PostgreSQL `stripe` schema via webhooks.
-   Data flow managed by React Query.
-   Multimedia content system with tables for `mediaFiles`, `messageMedia`, `videoLessons`, `pronunciationAudio`, `lessonVisualAids`, `culturalTipMedia`.
-   User learning preferences fields: `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `onboardingCompleted`.

### Core Features
-   **Conversational Onboarding**: AI-guided setup for new users.
-   **Auto-Language Detection**: Intelligent language switching based on user input.
-   **Adaptive Multi-Phase Conversation System**: Gradual transition from native to target language immersion, adapting to user proficiency.
-   **User Agency & Conversation Control**: AI suggests topics but always confirms with the user.
-   **Progressive Scaffolding System**: Teaching approach scales by difficulty level, adapting concept pacing, vocabulary recap frequency, and teaching style.
-   **One-Question-Per-Response & Ask-and-Pause**: AI asks one direct question per response and pauses.
-   **Student Question Handling**: AI directly answers student questions before optionally asking follow-ups.
-   **Content Guardrails**: Moderation system for appropriate learning content.
-   **Creative Scenario-Based Learning**: AI creates practical scenarios.
-   **Slow Pronunciation with Phonetic Breakdowns**: Provides phonetic spellings and stress markers for new vocabulary, integrated into voice mode.
-   **Automatic Vocabulary Extraction**: AI identifies and saves new vocabulary to the flashcard system.
-   **Voice Chat Feature**: Real-time voice conversations via OpenAI Realtime API, including push-to-talk and progressive "Listen-and-Repeat".
-   **Conversational Thread Management**: Auto-creates fresh conversations with context and allows switching.
-   **Personalized Greetings**: AI greets users by name, adjusting for first-time vs. returning users.
-   **Animated Instructor Avatar**: Visual feedback for engagement.
-   **Spaced Repetition System**: SM-2 algorithm-based vocabulary review scheduling.
-   **Streak Tracking System**: Daily practice streaks with metrics and milestone badges.
-   **Progress Charts Dashboard**: Interactive visualizations (Vocabulary Growth, Practice Time, Conversation Activity).
-   **Auto-Difficulty Adjustment**: Intelligent difficulty recommendation based on user performance.
-   **Pronunciation Scoring System**: Real-time pronunciation feedback with scores, color-coded badges, and phonetic suggestions.
-   **Chat Ideas Library**: Browsable topic inspiration page.
-   **Cultural Tips System**: AI naturally weaves cultural insights into conversations.
-   **Mid-Conversation Native Language Change**: Users can request to change their native language mid-conversation.
-   **Enhanced One-Concept-Per-Message Teaching**: System enforces one-concept-per-message teaching, adapting phrase complexity.
-   **Vocabulary Reinforcement System**: AI naturally reviews learned words during conversations using evidence-based learning techniques.
-   **Subscription Tiers**: Free, Basic, Pro, Institutional, each with varying features and AI model access.
-   **Multimedia Integration**: Supports images, videos, and audio; includes real-time foreign language text display during voice conversations.
-   **AI-Generated Educational Images**: AI tutor intelligently displays inline images (stock photos for vocabulary via Unsplash, AI-generated via DALL-E for scenarios/culture) to enhance learning engagement. System uses discriminated union schema (anyOf) with proper type-specific validation and stores media metadata in messages.mediaJson field.
-   **Image Sharing Backend**: Secure, production-ready backend for image uploads and retrieval with IDOR prevention and user-scoped access control.
-   **Usage Tracking**: Atomic voice message usage tracking with automatic monthly reset, tiered limits, and dedicated API endpoints.

## External Dependencies

-   **Third-Party Services**: Stripe (billing), Replit Auth (authentication), OpenAI API (AI chat via Replit AI Integrations).
-   **Libraries**: Neon Database Serverless, Drizzle ORM, stripe-replit-sync, Radix UI, TanStack Query, Wouter, date-fns, Embla Carousel.
-   **Database**: PostgreSQL (via `DATABASE_URL`) with Drizzle Kit for migrations, connection pooling via `@neondatabase/serverless`, and automated Stripe data sync to `stripe` schema.
-   **Asset Management**: Google Fonts (Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono), static images in `attached_assets/generated_images/`.
-   **AI Models**: `gpt-realtime-mini-2025-10-06` (for Free/Basic tiers) and `gpt-realtime-2025-08-28` (for Pro tier) for voice chat.
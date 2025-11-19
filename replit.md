# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across multiple languages and difficulty levels. It offers AI-powered chat, flashcards, and grammar modules, tracking user progress to foster consistent learning. The project aims to deliver a personalized and adaptive language learning experience with significant market potential in the educational technology sector, supporting 9 target languages (English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, Korean) with explanations in any native language.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 19, 2025 - Conversational Onboarding & Usage Tracking
- **Onboarding**: Added user learning preferences fields to database schema: `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `onboardingCompleted`
- **Onboarding**: Created PUT /api/user/preferences endpoint with Zod validation for updating user preferences
- **Onboarding**: Implemented conversational onboarding page (`/onboarding`) with chat-like interface
- **Onboarding**: Added navigation logic to redirect new users to onboarding before accessing main app
- **Onboarding**: Onboarding flow collects: target language (9 languages including English), native language, and difficulty level (beginner/intermediate/advanced)
- **Onboarding**: Added POST /api/logout endpoint for JSON-based logout flow
- **Usage Tracking**: Implemented voice message usage tracking with automatic monthly reset
- **Usage Tracking**: Added GET /api/user/usage endpoint to fetch current usage statistics
- **Usage Tracking**: Added POST /api/user/check-voice-usage endpoint to check limits and increment counter
- **Usage Tracking**: Free tier: 20 messages/month, paid tiers: unlimited (999,999 effective limit)
- **Usage Tracking**: Auto-resets monthly counter based on lastMessageResetDate field
- **Languages**: Added English as 9th learnable language (English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, Korean)

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

### Core Features
-   **Conversational Onboarding**: AI-guided setup for new users using GPT-5 with strict JSON schemas.
-   **Auto-Language Detection**: Intelligent language switching based on user input.
-   **Adaptive Multi-Phase Conversation System**: Gradual transition from native to target language immersion, adapting to user proficiency.
-   **User Agency & Conversation Control**: AI suggests topics but always confirms with the user, allowing user-driven topic selection.
-   **Progressive Scaffolding System**: Teaching approach scales by difficulty level - beginners get slow, repetitious teaching with heavy support, gradually transitioning to conversational learning for advanced students. This includes difficulty-scaled teaching approach, concept pacing, vocabulary recap frequency scaling, and teaching style progression based on user difficulty.
-   **One-Question-Per-Response & Ask-and-Pause**: AI asks one direct question per response and pauses for natural conversation flow.
-   **Student Question Handling**: AI directly answers student questions before optionally asking follow-ups.
-   **Content Guardrails**: Moderation system for appropriate learning content.
-   **Creative Scenario-Based Learning**: AI creates practical scenarios for enhanced learning.
-   **Slow Pronunciation with Phonetic Breakdowns**: Provides phonetic spellings and stress markers for new vocabulary, integrated into voice mode.
-   **Automatic Vocabulary Extraction**: AI identifies and saves new vocabulary to the flashcard system.
-   **Voice Chat Feature**: Real-time voice conversations via OpenAI Realtime API, including push-to-talk and progressive "Listen-and-Repeat" for beginners.
-   **Conversational Thread Management**: Auto-creates fresh conversations with context and allows switching via AI-directed protocol.
-   **Personalized Greetings**: AI greets users by name, adjusting for first-time vs. returning users.
-   **Animated Instructor Avatar**: Visual feedback for engagement.
-   **Spaced Repetition System**: SM-2 algorithm-based vocabulary review scheduling with adaptive intervals.
-   **Streak Tracking System**: Daily practice streaks with metrics and milestone badges.
-   **Progress Charts Dashboard**: Interactive visualizations (Vocabulary Growth, Practice Time, Conversation Activity) using `recharts`.
-   **Auto-Difficulty Adjustment**: Intelligent difficulty recommendation system based on user performance.
-   **Pronunciation Scoring System**: Real-time pronunciation feedback in voice conversations using OpenAI GPT-4o-mini, with scores, color-coded badges, and specific phonetic suggestions.
-   **Chat Ideas Library**: Browsable topic inspiration page with pre-seeded topics.
-   **Cultural Tips System**: AI naturally weaves cultural insights into conversations, with a browsable page for pre-seeded tips across languages.
-   **Full Application**: Integrated AI chat, vocabulary flashcards, grammar exercises, conversation history, progress tracking, auto-difficulty adjustment, pronunciation scoring, topic library, and cultural tips.
-   **Mid-Conversation Native Language Change**: Users can request to change their native language mid-conversation, with intelligent detection and seamless integration.
-   **Enhanced One-Concept-Per-Message Teaching**: System enforces one-concept-per-message teaching, adapting phrase complexity based on student's difficulty level.
-   **Vocabulary Reinforcement System**: AI naturally reviews learned words during conversations using evidence-based learning techniques, tracking session vocabulary and integrating due vocabulary from SRS.
-   **Subscription Tiers**: 
    - Free: $0/month - 20 voice messages/month with GPT-4o-mini, basic vocabulary, ad-supported
    - Basic: $9.99/month - Unlimited voice chat with GPT-4o-mini, full vocabulary & grammar, progress tracking, no ads
    - Pro: $19.99/month - Everything in Basic + premium GPT-4o voice chat, pronunciation scoring, priority support
    - Institutional: $7/seat/month (annual) - All Pro features + admin dashboard, curriculum management, class progress reports, standards alignment

## Business Model

### Dual B2C/B2B Model
-   **B2C (Individual Learners)**: Monthly subscriptions (Free with ads, Basic $9.99, Pro $19.99) with self-directed learning or optional structured curricula.
-   **B2B (Schools/Organizations)**: Institutional licensing at $7/seat/month (billed annually) with admin features, curriculum management, and standards-based progress tracking.

### Revenue & Cost Tracking
-   User table tracks monthly message limits and usage for cost analysis.
-   Free tier: Ad-supported to offset GPT-4o-mini API costs (20 messages/month limit).
-   Stripe integration provides subscription management, payment processing, and customer portal.
-   Future: detailed API cost tracking per conversation for accurate per-student cost analysis and ad revenue optimization.

## External Dependencies

-   **Third-Party Services**: Stripe (billing), Replit Auth (authentication), OpenAI API (AI chat via Replit AI Integrations).
-   **Libraries**: Neon Database Serverless, Drizzle ORM, stripe-replit-sync, Radix UI, TanStack Query, Wouter, date-fns, Embla Carousel.
-   **Database**: PostgreSQL (via `DATABASE_URL`) with Drizzle Kit for migrations, connection pooling via `@neondatabase/serverless`, and automated Stripe data sync to `stripe` schema.
-   **Asset Management**: Google Fonts (Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono), static images in `attached_assets/generated_images/`.

## Available AI Models

### Realtime API Models (Voice Chat)

#### GPT-4o Realtime (Full Models)
-   `gpt-realtime-2025-08-28` - Latest stable model (recommended for production)
-   `gpt-4o-realtime-preview-latest` - Auto-updates to latest preview
-   `gpt-4o-realtime-preview-2025-06-03` - June 2025 preview
-   `gpt-4o-realtime-preview-2024-12-17` - December 2024 preview
-   `gpt-4o-realtime-preview-2024-10-01` - October 2024 preview
-   `gpt-4o-realtime-preview` - Base preview model

#### GPT-4o-mini Realtime (Cost-Effective)
-   `gpt-realtime-mini-2025-10-06` - Latest stable mini model (recommended for cost optimization)
-   `gpt-4o-mini-realtime-preview-latest` - Auto-updates to latest mini preview
-   `gpt-4o-mini-realtime-preview-2025-09-25` - September 2025 mini preview
-   `gpt-4o-mini-realtime-preview-2024-12-17` - December 2024 mini preview
-   `gpt-4o-mini-realtime-preview` - Base mini preview model

**Recommended Strategy**: 
- Free tier: `gpt-realtime-mini-2025-10-06` with 20 message/month limit, ad-supported to offset costs
- Basic tier: `gpt-realtime-mini-2025-10-06` with unlimited messages, no ads
- Pro tier: `gpt-realtime-2025-08-28` with unlimited messages, premium quality, no ads
- This tiered approach maximizes user acquisition while managing API costs effectively
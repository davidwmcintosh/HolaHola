# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across multiple languages and difficulty levels. It offers AI-powered chat, flashcards, and grammar modules, tracking user progress to foster consistent learning. The project aims to deliver a personalized and adaptive language learning experience with significant market potential in the educational technology sector, supporting 9 target languages (English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, Korean) with explanations in any native language.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Technical Improvements (November 2025)

### Image Caching System - Cost Optimization & Performance
Implemented intelligent image caching system that reduces API costs from $3-11 to $1-4 per student/month and improves speed 10-100x (from 5-10s to ~50ms for cached images).

**Key Components:**
- **Database Caching:** `mediaFiles` table enhanced with caching fields: `imageSource`, `searchQuery`, `promptHash`, `usageCount`, `attributionJson`
- **Query Normalization:** Extracts core vocabulary from AI-generated queries ("white espresso coffee cup" → "coffee") to maximize cache hit rate across semantic variations
- **Dual Caching Strategy:**
  - Stock images (Unsplash): Cached by normalized search query
  - AI-generated images (DALL-E): Cached by SHA256 hash of prompt
- **Cache-First Architecture:** Check cache → Use if found + increment usage → Otherwise fetch/generate + cache result
- **Performance:** Database lookup (~50ms) vs Unsplash API (1-2s) vs DALL-E generation (5-10s)
- **Cost Savings:** Caching reduces DALL-E costs from $0.04 per generation to near-zero for repeated concepts (100 students learning "coffee" = $0.04 vs $4.00)

**Storage Interface Methods:**
- `getCachedStockImage(searchQuery)`: Lookup stock images by normalized query
- `getCachedAIImage(promptHash)`: Lookup AI images by hash
- `cacheImage(data)`: Store new cached image with metadata
- `incrementImageUsage(id)`: Track reuse for analytics

**Normalization Examples:**
- "white espresso coffee cup on saucer" → "coffee"
- "fresh golden croissant" → "croissant"
- "red delicious apple" → "apple"

### Onboarding Loop Bug Fix - Three-Layer Defensive Architecture
Fixed critical bug where AI repeated onboarding questions after user completed onboarding. Implemented comprehensive three-layer defense:

**Layer 1 - Frontend State Hydration:**
- `LanguageContext` now subscribes to `/api/auth/user` via React Query
- Automatically syncs `targetLanguage`, `difficultyLevel`, and `userName` from database to localStorage on app load
- Updates whenever server-side user preferences change, ensuring frontend always has fresh data

**Layer 2 - Immediate Context Updates:**
- Onboarding page calls `setLanguage()` and `setDifficulty()` immediately after user selections
- Ensures LanguageContext reflects latest values before redirect to chat
- Prevents stale values from persisting in localStorage during critical transitions

**Layer 3 - Server-Side Defensive Fallback:**
- `POST /api/conversations` fetches user record via `storage.getUser(userId)`
- Defaults all preferences from database: `language`, `difficulty`, `nativeLanguage`, `userName`
- Treats "Student" placeholder as invalid and replaces with user profile name
- **Uses `onboardingCompleted` flag** instead of userName matching to detect onboarding status
- Prevents stale/missing frontend values from causing incorrect AI system prompts

**Key Design Decision:**
Changed onboarding detection from userName-based matching to dedicated `onboardingCompleted` boolean flag, eliminating edge cases with placeholder values, name changes, or incomplete profiles.

### Voice/Text Mode Synchronization - Unified Conversation Experience
Implemented seamless conversation synchronization between voice and text chat modes, allowing users to toggle freely without losing context.

**Implementation Details:**
- **Lifted State Management:** Conversation state (`conversationId`) managed at parent `chat.tsx` level instead of individual mode components
- **Shared Props:** Both `ChatInterface` (text) and `VoiceChat` (voice) accept `conversationId`, `setConversationId`, and `setCurrentConversationOnboarding` as props
- **Mode Toggle Persistence:** Switching between text/voice modes maintains the same conversation thread with full message history
- **New Chat Control:** Added "New Chat" button (data-testid="button-new-chat") in chat header that resets conversationId and triggers auto-creation of fresh conversations
- **Auto-Create Logic:** Conversation auto-creates when conversationId is null, but respects ongoing onboarding to prevent race conditions

**User Experience:**
- Users can seamlessly switch between voice practice and text typing within the same conversation
- Clicking "New Chat" starts a fresh conversation while preserving previous conversations in database
- No context loss when toggling modes - all messages remain visible

**Testing Coverage:**
- E2E tests verify mode toggling preserves conversation history
- Database queries confirm proper conversation creation and onboarding flag management
- Defensive sync ensures onboardingCompleted flag stays synchronized with user preferences

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
-   **AI Models**: `gpt-4o-mini-realtime-preview` (for Free/Basic/Institutional tiers) and `gpt-4o-realtime-preview` (for Pro tier) for voice chat.
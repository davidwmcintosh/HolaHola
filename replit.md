# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across multiple languages and difficulty levels. It offers AI-powered chat, flashcards, and grammar modules, tracking user progress to foster consistent learning. The project aims to deliver a personalized and adaptive language learning experience with significant market potential in the educational technology sector, supporting 9 target languages (English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, Korean) with explanations in any native language.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 20, 2025 - Voice Chat Audio & Greeting Fixes

#### Text Chat Greeting Restoration
**Issue:** Backend greeting generation was completely removed, breaking text chat - no initial greeting appeared for new users.

**Solution:**
1. **Added mode parameter** to conversation creation API - frontend passes "text" or "voice" to backend
2. **Restored conditional greeting generation** - backend generates greeting ONLY when:
   - New conversation AND mode is "text", OR
   - Reused conversation has no messages AND mode is "text" (handles edge case)
3. **Fixed conversation reuse** - changed `forceNewConversation` default from true to false to prevent duplicates on reload
4. **Reverted default mode to "voice"** - LinguaFlow is primarily voice-based, so voice mode is the default

**Files Modified:**
- `client/src/pages/chat.tsx`: Added mode parameter, set default to "voice" (line 13)
- `server/routes.ts`: Restored backend greeting logic with edge case handling (lines 576-619)

**Testing:**
- ✅ Text greeting appears when switching to text mode
- ✅ No duplicates on page reload
- ✅ Voice mode is default (as intended for voice-first app)
- ✅ Edge case: Conversation created in voice mode gets greeting when switched to text

#### Voice Chat Audio Playback Enhancement
**Issue:** Unclear if audio playback was working correctly due to browser autoplay policies.

**Solution:**
1. **Added public `resume()` method** to AudioPlayer class for explicit AudioContext resume
2. **Improved logging** to track AudioContext state changes and playback events
3. **Better error handling** in audio playback pipeline
4. **Cleaner API** - VoiceChat now calls `audioPlayerRef.current.resume()` instead of accessing private properties

**Files Modified:**
- `client/src/lib/audioUtils.ts`: Added public resume() method and enhanced logging (lines 76-85)
- `client/src/components/VoiceChat.tsx`: Updated to use public resume() method (line 586)

**Expected Behavior:**
- AudioContext resumes when user clicks push-to-talk button
- Console shows detailed audio playback logs for debugging
- Audio chunks play through Web Audio API

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
-   All user-specific data linked via userId foreign keys for data isolation.
-   Stripe data automatically synced to PostgreSQL `stripe` schema via webhooks.
-   Multimedia content system with tables for `mediaFiles`, `messageMedia`, `videoLessons`, `pronunciationAudio`, `lessonVisualAids`, `culturalTipMedia`.
-   User learning preferences fields: `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `onboardingCompleted`.

### Core Features
-   **Conversational Onboarding**: AI-guided setup for new users with a three-layer defensive architecture for state management and an `onboardingCompleted` flag.
-   **Adaptive Multi-Phase Conversation System**: Gradual transition from native to target language immersion, adapting to user proficiency and difficulty.
-   **User Agency & Conversation Control**: AI suggests topics but confirms with the user; features like one-question-per-response and ask-and-pause.
-   **Voice Chat Feature**: Real-time voice conversations via OpenAI Realtime API, supporting push-to-talk, progressive "Listen-and-Repeat", and seamless text/voice mode synchronization. Includes automatic retry system for resilient connection management.
-   **Content Guardrails**: Moderation system for appropriate learning content.
-   **Personalized Learning**: Auto-language detection, creative scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment.
-   **AI-Generated Educational Images**: Intelligent display of inline images (stock photos via Unsplash, AI-generated via DALL-E) with a robust caching system for performance and cost optimization.
-   **Subscription Tiers**: Free, Basic, Pro, Institutional, with varying features and AI model access (`gpt-4o-mini-realtime-preview-2025-09-25` for Free/Basic/Institutional, `gpt-realtime` for Pro).
-   **Usage Tracking**: Atomic voice message usage tracking with monthly reset and tiered limits.

## External Dependencies

-   **Third-Party Services**: Stripe (billing), Replit Auth (authentication), OpenAI API (AI chat via Replit AI Integrations), Unsplash (stock images), DALL-E (AI-generated images).
-   **Libraries**: Neon Database Serverless, Drizzle ORM, stripe-replit-sync, Radix UI, TanStack Query, Wouter, date-fns, Embla Carousel.
-   **Database**: PostgreSQL (via `DATABASE_URL`) with Drizzle Kit for migrations, connection pooling via `@neondatabase/serverless`, and automated Stripe data sync to `stripe` schema.
-   **Asset Management**: Google Fonts (Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono), static images in `attached_assets/generated_images/`.
-   **AI Models**: `gpt-4o-mini-realtime-preview-2025-09-25` (Free/Basic/Institutional tiers) and `gpt-realtime` (Pro tier) for voice chat.
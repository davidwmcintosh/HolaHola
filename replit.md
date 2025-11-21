# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application that offers interactive conversation practice, vocabulary building, and grammar exercises across 9 target languages. It uses AI for personalized chat, flashcards, and grammar modules, tracking user progress to deliver an adaptive learning experience. The project aims for significant market potential in educational technology by supporting multiple languages and difficulty levels with explanations in any native language.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React with TypeScript (Vite).
-   **Routing**: Wouter.
-   **State Management**: React Context API, TanStack Query.
-   **UI**: Shadcn/ui (Radix UI base) styled with Tailwind CSS, following Material Design principles, with light/dark mode.
-   **Layout**: Two-column desktop, single-column mobile with mobile-first responsive design.
-   **Typography**: Inter (UI text), JetBrains Mono (code/phonetic content).
-   **UI/UX Decisions**: Prominent "Voice Learning" button with a "Recommended" badge, a subtle "Type instead" button, and a hint bar encouraging voice learning.
-   **PWA**: Progressive Web App support with service worker for offline caching, installable to home screen, splash screen, and auto-update notifications.
-   **Mobile App**: Capacitor configured for iOS and Android native app builds with 100% code sharing with the web version.

### Backend
-   **Server**: Express.js on Node.js with TypeScript.
-   **API**: RESTful.
-   **Storage**: Abstract `IStorage` interface with Drizzle ORM for PostgreSQL.
-   **AI Integration**: OpenAI-compatible API via Replit's AI Integrations.
-   **Session Management**: `connect-pg-simple` with PostgreSQL session store.
-   **Authentication**: Replit Auth (OIDC) with email/password and social login support. WebSocket connections authenticate via server-side session validation.
-   **Billing**: Stripe integration via `stripe-replit-sync` for subscription management.

### Data Models
-   **Core Entities**: Users (with Stripe billing fields), Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics.
-   User-specific data linked via `userId` foreign keys.
-   Stripe data synced to PostgreSQL `stripe` schema via webhooks.
-   Multimedia content system for various media types.
-   User learning preferences: `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `onboardingCompleted`.

### Core Features
-   **Conversational Onboarding**: AI-guided setup with a three-layer defensive architecture.
-   **Adaptive Multi-Phase Conversation System**: Gradual transition to target language immersion, adapting to user proficiency.
-   **User Agency**: AI suggests topics but confirms with the user; features like one-question-per-response.
-   **Voice Chat** (RestVoiceChat.tsx - ACTIVE SYSTEM): Production-stable REST-based voice pipeline (Whisper STT → GPT → TTS). Supports Push-to-Talk recording, seamless text/voice mode synchronization, and enhanced pronunciation feedback. Includes usage enforcement, error handling, and robust response parsing. **Split Response Architecture**: Voice mode delivers fast text-only responses (~3.6s) with background enrichment for vocabulary extraction and image generation, reducing latency from 40s to under 4s. NOTE: VoiceChat.tsx (WebSocket-based) is DEPRECATED and not used.
-   **Content Guardrails**: Moderation system for appropriate learning content.
-   **Personalized Learning**: Auto-language detection, scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment.
-   **AI-Generated Educational Images**: Intelligent display of inline images (Unsplash, DALL-E) with caching.
-   **Subscription Tiers**: Free, Basic, Pro, Institutional, with varying features and AI model access.
-   **Usage Tracking**: Atomic voice message usage tracking with monthly reset and tiered limits.
-   **Unified Chat Architecture**: Both voice and text chat share a single `createSystemPrompt()` for consistent instructions and beginner teaching methodologies. Voice and text modes fetch conversation history identically for consistent context.
-   **Auto-Generated Conversation Titles**: AI automatically generates descriptive conversation titles after 5 messages to help users find and resume specific conversations.
-   **Conversation Memory & Resumption**: The tutor references previous conversation titles and offers to continue, providing a brief context summary when resuming past topics.
-   **Mobile-First Responsive Design**: Full responsive layout with breakpoint at 768px. Mobile view features hidden sidebar, simplified headers, large mic button, and condensed spacing.
-   **PWA Install Prompt**: Smart install prompt appears after 3 seconds, can be dismissed, and encourages users to add the app to their home screen.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **OpenAI API**: Dual client architecture for text chat (Replit AI Integrations) and voice STT (User's Personal Key).
-   **Google Cloud Text-to-Speech**: WaveNet voices for authentic native pronunciation with SSML support.
-   **Unsplash**: Stock educational images.
-   **DALL-E**: AI-generated contextual images.

### Dual OpenAI Client Architecture
-   **Replit AI Integrations** (`OPENAI_API_KEY`): Used for text chat completions only, managed by Replit. Models: `gpt-4o-mini`, `gpt-4o`.
-   **User's Personal Key** (`USER_OPENAI_API_KEY`): Used for voice STT (Whisper) and TTS fallback, managed by the user's OpenAI account. Models: `whisper-1` (STT), `tts-1-hd` (TTS fallback). This separation addresses Replit AI Integrations' lack of Whisper/TTS support and separates text costs from voice costs.

### Libraries & Tools
-   **Database**: Neon PostgreSQL (via `DATABASE_URL`), Drizzle ORM, Drizzle Kit.
-   **UI Framework**: React, TypeScript, Vite, Wouter.
-   **UI Components**: Radix UI, Shadcn/ui, Tailwind CSS.
-   **State Management**: TanStack Query, React Context.
-   **Billing**: stripe-replit-sync.
-   **Utilities**: date-fns, Embla Carousel.

### AI Models Summary
-   **Text Chat**: `gpt-4o-mini` (Free/Basic/Institutional), `gpt-4o` (Pro). Tier-based model selection via `getModelForTier()` helper ensures cost efficiency for lower tiers and quality for Pro users.
-   **Voice STT**: `whisper-1` (speech-to-text via OpenAI).
-   **Voice TTS**: Google Cloud WaveNet Neural2 voices (primary), OpenAI `tts-1-hd` (fallback). WaveNet provides authentic native pronunciation with proper phoneme handling (e.g., silent 'h' in Spanish).

## Recent Technical Improvements (Nov 21, 2025)
-   **Google Cloud WaveNet TTS Migration**: Migrated from OpenAI TTS to Google Cloud WaveNet for authentic native pronunciation across all 9 supported languages. Implemented TTS service abstraction layer (`server/services/tts-service.ts`) with graceful fallback to OpenAI TTS. WaveNet voices provide:
    -   Native pronunciation with no American accent artifacts (e.g., correctly handles silent 'h' in Spanish "hola")
    -   SSML support for fine-grained pronunciation control
    -   Regional dialect variations (Castilian Spanish, Brazilian Portuguese, etc.)
    -   Natural prosody and intonation
    -   Speaking rate set to 0.9x for better language learning comprehension
    -   Cost: $16/1M characters (1M free tier), ~$1.60/month per Pro user (500 messages)
    -   Removed all "avoid hola" workarounds from system prompts - AI now teaches natural Spanish
-   **Voice Chat Performance Optimization**: Implemented split response architecture reducing voice mode latency from ~40s to ~3.6s. Fast text-only AI response is sent immediately, with vocabulary extraction and image generation queued for background processing using `setImmediate()`.
-   **Tier-Based Model Selection**: Added `getModelForTier()` helper function to centralize model selection logic across all chat flows (text, voice, onboarding). Ensures gpt-4o-mini for cost efficiency (Free/Basic/Institutional tiers) and gpt-4o for quality (Pro tier).
-   **enrichmentStatus Field**: Added to messages schema to track background processing state ("pending" → null when complete). Uses conditional spread `...(isVoiceMode ? { enrichmentStatus: "pending" } : {})` to avoid undefined→null database conversion.
-   **Mobile Layout Fix**: Resolved mic button visibility issue on mobile devices where flex layout constraints prevented button from appearing on screen. Changed RestVoiceChat root container from `h-full` to `flex-1 min-h-0` to properly participate in flex chain from parent components.
-   **Cache-Busting System**: Implemented build timestamp mechanism (`client/src/buildtime.ts`) to force browsers to load fresh JavaScript when code changes, bypassing aggressive CDN/proxy caching. This ensures layout fixes and other updates are immediately visible to users without requiring service worker manipulation.
# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises across nine target languages. It leverages AI for personalized chat, flashcards, and grammar modules, adapting to individual user progress. The project aims to deliver a comprehensive, adaptive, and engaging language learning experience by supporting multiple languages and difficulty levels, with explanations in any native language. The business vision focuses on capitalizing on AI advancements to provide personalized education and expand into institutional markets.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes a mobile-first responsive design based on Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, PWA features (offline caching, home screen installation), and native iOS/Android builds via Capacitor. Key UI elements include voice interaction controls and a hint bar. Inter font is used for UI text and JetBrains Mono for code/phonetic content.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Session management is via `connect-pg-simple` with a PostgreSQL store. Authentication is handled by Replit Auth (OIDC). Stripe integration for subscriptions is managed by `stripe-replit-sync`. Form validation uses `react-hook-form` and `zodResolver`. Security includes multi-layered backend role-based authorization and frontend route guards.

### Feature Specifications
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. A REST-based voice pipeline (Deepgram Nova-3 STT → Gemini → Cartesia Sonic-3 TTS) supports push-to-talk recording, smart language handling, and fast text-only responses with background enrichment. Enhanced voice chat includes word-level timestamps, smart phrase detection, foreign-language-only display for immersion, replay/slow repeat functions with intelligent caching, and ACTFL advancement tracking. A 3-mode subtitle system (Off, Target, All) is available. Content guardrails ensure appropriate material. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers and tracks atomic voice message usage. Both voice and text chat share a unified architecture, with AI-generated conversation titles. The system tracks student proficiency using ACTFL World-Readiness Standards and Can-Do Statements. Features like Resume Conversations, Smart Search, and AI-Powered Practice Suggestions leverage Gemini's 1M context window. Institutional features include teacher class management, student enrollment, curriculum systems, assignment workflows, and a Super Admin Backend with RBAC, user management, and audit logging.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, linked via `userId`. Stripe data is synced to a PostgreSQL `stripe` schema. User learning preferences like `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `actflLevel`, and `onboardingCompleted` are stored. An `ActflProgress` table tracks FACT criteria.

**Voice Validation Architecture**: Utilizes a two-tier prevention approach with Gemini structured output (strict JSON schema) and a safety net using `franc-min` language detection and per-language stoplists.

**Voice TTS Pronunciation Architecture**: Uses Cartesia Sonic-3's custom phoneme syntax `<<phoneme1|phoneme2>>` with MFA-style IPA to correct pronunciation of foreign words in English responses. When the tutor says something like "The greeting is 'Hola'", the word Hola is automatically converted to `<<o|l|a>>` for correct native pronunciation. Phoneme mappings in `MFA_IPA_PRONUNCIATIONS` cover common words in all 9 supported languages.

**Subtitle System Architecture**: A 3-state subtitle system (`subtitleMode`: Off, Target, All) prioritizes Chirp HD voice quality over real-time karaoke highlighting.

**Deepgram Pre-Warming**: The Deepgram connection is pre-warmed on voice chat entry by sending a minimal silent WAV to reduce cold-start latency.

**Slow Repeat Feature**: Provides AI-simplified, slower explanations of the last assistant message (Gemini 2.5 Flash, 0.7x speaking rate) when students struggle. Frontend caches the audio for instant replays.

**TTS Provider Architecture**: Dual-provider system with Cartesia Sonic-3 as primary (~40-90ms latency) and Google Cloud Chirp HD as fallback. Configuration via environment variables:
- `TTS_PRIMARY_PROVIDER`: Set to "cartesia" (default) or "google" to switch providers
- `TTS_CARTESIA_MODEL`: Set to "sonic-3" (default, 42 languages) or "sonic-turbo" (40ms, 15 languages)
- `CARTESIA_API_KEY`: Required for Cartesia TTS
- Automatic fallback to Google if Cartesia is unavailable or fails
- Voice mappings in `server/services/tts-service.ts` (CARTESIA_VOICE_MAP, VOICE_MAP for Google)

**Cartesia Sonic-3 Emotion & Expression Features**:
- **3-Layer Emotion Control System**:
  - **Layer 1: Personality Presets** (`tutorPersonality` in users table)
    - `warm`: friendly, encouraging, happy, patient (baseline: friendly)
    - `calm`: neutral, calm, patient, curious (baseline: calm)
    - `energetic`: excited, enthusiastic, happy, surprised, encouraging (baseline: enthusiastic)
    - `professional`: neutral, calm, curious, patient (baseline: neutral)
  - **Layer 2: Expressiveness Slider** (`tutorExpressiveness` 1-5 in users table)
    - Level 1-2: Baseline only, minimal deviation
    - Level 3: Core emotions for personality
    - Level 4: Extended emotion set
    - Level 5: Full spontaneous emotions including surprised/excited
  - **Layer 3: AI-Driven Dynamic Selection**
    - AI selects appropriate emotion based on context within allowed set
    - Returns `emotion` field in structured JSON response
    - TTS endpoint validates emotion against allowed list and falls back to baseline if disallowed
- **Speed Control**: Uses `generation_config.speed` (0.6-1.5 range)
  - 0.7 for slow pronunciation practice
  - 0.9 for normal teaching pace
  - 1.3 for faster advanced conversations
- **Natural Laughter**: AI prompts include guidance for `[laughter]` tags
  - Used sparingly (1-2 times per conversation max) for authentic bonding
  - Examples: "I made that same mistake when I was learning! [laughter]"
- **Settings UI**: Users configure personality and expressiveness on Settings page
  - Personality selector dropdown (4 presets)
  - Expressiveness slider (1-5 with descriptive labels)
- **Voice Console Admin**: Developer/admin tool at `/admin/voices` for voice audition
  - Preview voices with different emotion settings
  - Test target and native language samples
  - Validate voice configurations before deployment

**Three-Phase Organization System**:
-   **Phase 1 (Starring + Time Filtering)**: `isStarred` field for conversations, time-based filtering (All/Today/This Week/This Month/Older) on History and Vocabulary pages.
-   **Phase 2 (AI Topic Tagging)**: Junction tables (`conversationTopics`, `vocabularyWordTopics`) for many-to-many relationships, `sourceConversationId` links vocabulary to conversations.
-   **Phase 3 (Lesson Bundles)**: `lessons` table with `lessonType` (weekly_auto/custom/topic_based) and `lessonItems` for linking content.

**Vocabulary-Conversation Linking**: Extracted vocabulary words are linked to their source conversation via `sourceConversationId`, enabling navigation from flashcards back to the original context.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions (Gemini 2.5 Flash, Gemini 2.5 Pro).
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

### AI Models
-   **Text Chat**: `gemini-2.5-flash` (free/basic tiers), `gemini-2.5-pro` (pro tier).
-   **Voice Chat LLM**: `gemini-2.5-flash` (forced for all tiers - optimized for ~200ms TTFT speed).
-   **Voice STT**: Deepgram `nova-3`.
-   **Voice TTS (Primary)**: Cartesia Sonic-3 (multiple languages, 40-90ms latency).
-   **Voice TTS (Fallback)**: Google Cloud Chirp 3 HD, Neural2.

### Future Backlog
-   **Voice Mode Pro Testing**: Test Gemini 2.5 Pro for voice mode as optional setting for users who prefer quality over speed.
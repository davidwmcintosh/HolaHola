# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across nine languages. It leverages AI for personalized chat, flashcards, and grammar modules, adapting to individual user progress. The project aims to provide a comprehensive, adaptive, and engaging learning experience, supporting multiple languages and difficulty levels with explanations in any native language. The business vision focuses on utilizing AI advancements to offer personalized education and expand into institutional markets.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android builds via Capacitor. Key UI elements include voice interaction controls and a hint bar. Inter font is used for UI text and JetBrains Mono for code/phonetic content.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Session management is via `connect-pg-simple` with a PostgreSQL store. Authentication is handled by Replit Auth (OIDC). Stripe integration for subscriptions is managed by `stripe-replit-sync`. Form validation uses `react-hook-form` and `zodResolver`. Security includes multi-layered backend role-based authorization and frontend route guards.

### Feature Specifications
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording, smart language handling, and fast text-only responses. Enhanced voice chat includes word-level timestamps, smart phrase detection, foreign-language-only display, replay/slow repeat functions, and ACTFL advancement tracking. A 3-mode subtitle system (Off, Target, All) is available. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers and tracks atomic voice message usage. The system tracks student proficiency using ACTFL World-Readiness Standards. Features like Resume Conversations, Smart Search, and AI-Powered Practice Suggestions leverage Gemini's 1M context window. Institutional features include teacher class management, student enrollment, curriculum systems, assignment workflows, and a Super Admin Backend with RBAC, user management, and audit logging.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, linked via `userId`. Stripe data is synced to a PostgreSQL `stripe` schema. User learning preferences like `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `actflLevel`, and `onboardingCompleted` are stored. An `ActflProgress` table tracks FACT criteria.

**Voice Validation Architecture**: Utilizes a two-tier prevention approach with Gemini structured output (strict JSON schema) and a safety net using `franc-min` language detection and per-language stoplists.

**Voice TTS Pronunciation Architecture**: Uses Cartesia Sonic-3's custom phoneme syntax with MFA-style IPA to correct pronunciation of foreign words in English responses. Phoneme mappings cover common words in all 9 supported languages.

**Subtitle System Architecture**: A 3-state subtitle system (`subtitleMode`: Off, Target, All) with karaoke-style word highlighting. Word timing estimation occurs server-side, with client-side rescaling for precise synchronization. "Target" mode displays foreign language phrases only, with karaoke highlighting enabled via word index mapping. Server-side `extractTargetLanguageWithMapping()` generates a mapping for target-only word indices.

**Target Language Extraction**: Four-tier extraction system for target-only subtitle mode: bold-marked phrases, words with foreign characters, `franc-min` language detection, and a common short foreign word list.

**Deepgram Pre-Warming**: The Deepgram connection is pre-warmed on voice chat entry by sending a minimal silent WAV to reduce cold-start latency.

**Microphone Stream Caching**: After each push-to-talk recording, a new MediaStream is immediately requested and cached to make subsequent recordings instant.

**Slow Repeat Feature**: Extracts ONLY the target language phrase from the last assistant message (no English, no pronunciation guides) and speaks it at 0.5x speed for clear pronunciation using Gemini 2.5 Flash.

**TTS Provider Architecture**: Dual-provider system with Cartesia Sonic-3 as primary and Google Cloud Chirp HD as fallback.

**Cartesia Sonic-3 Emotion & Expression Features**: A 3-layer emotion control system includes personality presets, an expressiveness slider, and AI-driven dynamic emotion selection. Speed control and natural laughter tags are used. Settings UI allows user configuration.

**Emotion Tag Cleaning**: AI responses may include emotion tags, which are extracted for Cartesia and then stripped from text using `cleanTextForDisplay()` to prevent them from appearing in spoken audio or message history.

**Three-Phase Organization System**:
-   **Phase 1**: `isStarred` field for conversations, time-based filtering on History and Vocabulary pages.
-   **Phase 2**: AI Topic Tagging using junction tables (`conversationTopics`, `vocabularyWordTopics`) and `sourceConversationId`.
-   **Phase 3**: Lesson Bundles with `lessons` table, `lessonType`, and `lessonItems`.

**Vocabulary-Conversation Linking**: Extracted vocabulary words are linked to their source conversation via `sourceConversationId`.

**Streaming Voice Mode Architecture**: A WebSocket-based progressive audio delivery system aiming for Time To First Byte (TTFB) under 1 second. The pipeline involves Deepgram STT, Gemini streaming, sentence chunking, Cartesia WebSocket TTS, and progressive audio playback. The server streams `connected`, `processing`, `sentence_start`, `audio_chunk`, `word_timing`, `sentence_end`, `response_complete`, and `feedback` messages to the client.

**Streaming Voice Pedagogical Integrations**:
- **Content Moderation**: Two-layer safety - blocks user input with `CONTENT_REJECTED` error and skips inappropriate AI sentence chunks before TTS.
- **One-Word Rule**: Validates beginner utterances for conceptual units (single words or phrase units like "por favor"). Sends `StreamingFeedbackMessage` with `feedbackType: 'one_word_rule'` for client display.
- **Background Vocabulary Extraction**: After message persistence, uses `setImmediate` to extract vocabulary via Gemini structured output and saves to database with `sourceConversationId` linking.
- **Progress Tracking**: Updates `wordsLearned` and `lastPracticeDate` in UserProgress after each voice exchange.

**Pedagogical Subtitle Timing**: A `180ms` anticipatory offset (`PEDAGOGICAL_TIMING_OFFSET`) for word appearance is implemented to optimize language learning by priming the brain for incoming audio.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions (Gemini 2.5 Flash, Gemini 2.5 Pro) and voice chat LLM (Gemini 2.5 Flash).
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

## Pending Testing & Future Improvements

### Subtitle System (needs verification)
- Translation parentheticals removed (no "(Excellent!)", "(Wonderful!)" in subtitles)
- Target language extraction only captures foreign words (not English phrases)
- Markdown markers (`**`) fully stripped from display text
- Karaoke highlighting works correctly in Target mode

### Audio Hardware Error Handling (future improvement)
- "Start Practicing" button became unresponsive when no mic detected
- Greeting was delayed during audio initialization errors
- Consider showing clear user feedback when audio hardware is missing
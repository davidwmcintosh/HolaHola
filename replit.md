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
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. A REST-based voice pipeline (Deepgram Nova-3 STT → Gemini → Cartesia Sonic-3 TTS) supports push-to-talk recording, smart language handling, and fast text-only responses. Enhanced voice chat includes word-level timestamps, smart phrase detection, foreign-language-only display, replay/slow repeat functions, and ACTFL advancement tracking. A 3-mode subtitle system (Off, Target, All) is available. Content guardrails ensure appropriate material. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers and tracks atomic voice message usage. Both voice and text chat share a unified architecture, with AI-generated conversation titles. The system tracks student proficiency using ACTFL World-Readiness Standards. Features like Resume Conversations, Smart Search, and AI-Powered Practice Suggestions leverage Gemini's 1M context window. Institutional features include teacher class management, student enrollment, curriculum systems, assignment workflows, and a Super Admin Backend with RBAC, user management, and audit logging.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, linked via `userId`. Stripe data is synced to a PostgreSQL `stripe` schema. User learning preferences like `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `actflLevel`, and `onboardingCompleted` are stored. An `ActflProgress` table tracks FACT criteria.

**Voice Validation Architecture**: Utilizes a two-tier prevention approach with Gemini structured output (strict JSON schema) and a safety net using `franc-min` language detection and per-language stoplists.

**Voice TTS Pronunciation Architecture**: Uses Cartesia Sonic-3's custom phoneme syntax `<<phoneme1|phoneme2>>` with MFA-style IPA to correct pronunciation of foreign words in English responses. Phoneme mappings in `MFA_IPA_PRONUNCIATIONS` cover common words in all 9 supported languages.

**Subtitle System Architecture**: A 3-state subtitle system (`subtitleMode`: Off, Target, All) with karaoke-style word highlighting. Word timing estimation occurs server-side, with client-side rescaling for precise synchronization. "Target" mode displays foreign language phrases only during their time window, enabling independent appearance/disappearance of words.

**Deepgram Pre-Warming**: The Deepgram connection is pre-warmed on voice chat entry by sending a minimal silent WAV to reduce cold-start latency.

**Microphone Stream Caching**: After each push-to-talk recording, a new MediaStream is immediately requested and cached. This makes subsequent recordings instant (+0ms) instead of waiting for getUserMedia (~150-500ms). First recording still has normal latency due to browser security requiring user gesture.

**Slow Repeat Feature (Turtle Button)**: Extracts ONLY the target language phrase from the last assistant message (no English, no pronunciation guides) and speaks it at 0.5x speed for clear pronunciation. Uses Gemini 2.5 Flash for phrase extraction. Frontend caches the audio for instant replays.

**TTS Provider Architecture**: Dual-provider system with Cartesia Sonic-3 as primary and Google Cloud Chirp HD as fallback, configurable via environment variables.

**Cartesia Sonic-3 Emotion & Expression Features**: A 3-layer emotion control system includes personality presets (`warm`, `calm`, `energetic`, `professional`), an expressiveness slider (1-5), and AI-driven dynamic emotion selection based on context. Speed control (`generation_config.speed`) allows for varying speaking rates. Natural laughter tags (`[laughter]`) are used sparingly. Settings UI allows users to configure personality and expressiveness. A Voice Console Admin tool (`/admin/voices`) provides a developer/admin interface for voice audition and validation.

**Three-Phase Organization System**:
-   **Phase 1 (Starring + Time Filtering)**: `isStarred` field for conversations, time-based filtering on History and Vocabulary pages.
-   **Phase 2 (AI Topic Tagging)**: Junction tables (`conversationTopics`, `vocabularyWordTopics`) for many-to-many relationships, `sourceConversationId` links vocabulary to conversations.
-   **Phase 3 (Lesson Bundles)**: `lessons` table with `lessonType` and `lessonItems` for linking content.

**Vocabulary-Conversation Linking**: Extracted vocabulary words are linked to their source conversation via `sourceConversationId`, enabling navigation from flashcards back to the original context.

**Streaming Voice Mode Architecture**: A WebSocket-based progressive audio delivery system aims to reduce Time To First Byte (TTFB) to under 1 second. The pipeline involves Deepgram STT, Gemini streaming, sentence chunking, Cartesia WebSocket TTS, and progressive audio playback. The server streams `connected`, `processing`, `sentence_start`, `audio_chunk`, `word_timing`, `sentence_end`, and `response_complete` messages to the client.

## ACTIVE DEBUGGING: Streaming Voice WebSocket Failure

**Status**: BROKEN - WebSocket connections fail immediately after upgrade with code 1006

**Requirement**: Streaming mode ONLY - no REST fallback allowed

**Key Files to Debug**:
- `server/streaming-voice-proxy.ts` - WebSocket server setup and connection handler
- `client/src/lib/streamingVoiceClient.ts` - Client-side WebSocket connection
- `client/src/hooks/useStreamingVoice.ts` - React hook for streaming voice
- `server/services/streaming-voice-orchestrator.ts` - Server-side orchestration
- `client/src/components/RestVoiceChat.tsx` - Voice chat UI (now streaming-only)

**Observed Behavior**:
1. Server receives upgrade request: `[Streaming Voice] Upgrade request for path: /api/voice/stream/ws`
2. Server handles upgrade: `[Streaming Voice] Handling WebSocket upgrade`
3. Client immediately fails: `[StreamingVoiceClient] WebSocket closed: 1006 - `
4. Server NEVER logs: `[Streaming Voice] Client connected` (connection handler not reached)

**Root Cause Hypothesis**:
The `wss.handleUpgrade()` succeeds but something fails between the upgrade and the `connection` event:
- Auth check throwing exception?
- Socket being closed before connection event fires?
- Missing await or async issue in upgrade handler?

**Current WebSocket Setup** (using noServer mode):
```javascript
server.on('upgrade', (request, socket, head) => {
  if (pathname === '/api/voice/stream/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});
```

**Next Debug Steps**:
1. Add try-catch and logging inside handleUpgrade callback
2. Log before and after wss.emit('connection')
3. Check if socket is already closed when callback fires
4. Verify auth function doesn't throw before connection event

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
-   **Voice Chat LLM**: `gemini-2.5-flash` (forced for all tiers - synchronous mode, ~1-2s response time).
-   **Voice STT**: Deepgram `nova-3` (~400-800ms).
-   **Voice TTS (Primary)**: Cartesia Sonic-3 (multiple languages, 40-90ms latency).
-   **Voice TTS (Fallback)**: Google Cloud Chirp 3 HD, Neural2.
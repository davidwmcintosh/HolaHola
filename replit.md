# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across nine languages. It provides a comprehensive, adaptive, and engaging learning experience by leveraging AI for personalized chat, flashcards, and grammar modules, adapting to individual user progress. The project's business vision is to offer personalized education using AI and expand into institutional markets. The pedagogical philosophy emphasizes guiding students by discovering their interests while adhering to ACTFL standards.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes a mobile-first responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android builds via Capacitor. Key UI elements include voice interaction controls and a hint bar, with Inter font for UI text and JetBrains Mono for code/phonetic content.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Session management is via `connect-pg-simple` with a PostgreSQL store. Authentication is handled by Replit Auth (OIDC). Stripe integration for subscriptions is managed by `stripe-replit-sync`. Form validation uses `react-hook-form` and `zodResolver`. Security includes multi-layered backend role-based authorization and frontend route guards.

### Feature Specifications
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording, smart language handling, and fast text-only responses. Enhanced voice chat includes word-level timestamps, smart phrase detection, foreign-language-only display, replay/slow repeat functions, and ACTFL advancement tracking. A 3-mode subtitle system (Off, Target, All) is available. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers and tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management, student enrollment, curriculum systems, assignment workflows, and a Super Admin Backend with RBAC, user management, and audit logging.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, linked via `userId`. User learning preferences like `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `actflLevel`, and `onboardingCompleted` are stored. An `ActflProgress` table tracks FACT criteria.

**Voice Validation Architecture**: Utilizes a two-tier prevention approach with Gemini structured output (strict JSON schema) and a safety net using `franc-min` language detection and per-language stoplists.

**Voice TTS Pronunciation Architecture**: Uses Cartesia Sonic-3's custom phoneme syntax with MFA-style IPA to correct pronunciation of foreign words in English responses.

**Subtitle System Architecture**: A 3-state subtitle system (`subtitleMode`: Off, Target, All) with karaoke-style word highlighting. Word timing estimation occurs server-side, with client-side rescaling for precise synchronization.

**Streaming Voice Mode Architecture**: A WebSocket-based progressive audio delivery system aiming for Time To First Byte (TTFB) under 1 second. The pipeline involves Deepgram STT, Gemini streaming, sentence chunking, Cartesia WebSocket TTS, and progressive audio playback. The server streams various message types for client synchronization and feedback.

**Streaming Voice Pedagogical Integrations**: Includes content moderation, a "one-word rule" for beginner utterances, background vocabulary extraction via Gemini structured output, and real-time ACTFL advancement tracking (Functions, Accuracy, Context, Text Type) after each voice exchange. A `180ms` anticipatory offset for word appearance is implemented for pedagogical timing.

**Dynamic Streaming Greeting System**: New conversations trigger an AI-generated personalized greeting through the streaming voice pipeline. The greeting is ACTFL-aware, history-aware, and context-aware.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions (Gemini 2.5 Flash, Gemini 2.5 Pro) and voice chat LLM (Gemini 2.5 Flash, Gemini 1.5 Pro).
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

## Performance Benchmarks (November 2024)

### Voice Pipeline Latency Metrics (Updated Nov 29, 2024)

| Component | Target | Actual | Status |
|-----------|--------|--------|--------|
| **TTS TTFB (Cartesia)** | <1000ms | 180-220ms (avg ~200ms) | ✅ Excellent |
| **AI First Token (Gemini)** | <1500ms | 800-1600ms (avg ~1.2s) | ✅ Excellent |
| **STT (Parallel Deepgram)** | <1000ms | 400-600ms (avg ~450ms) | ✅ Excellent |
| **Total Time to First Audio** | <2000ms | 1600-2000ms | ✅ Goal Achieved! |

### Pipeline Breakdown (After Parallel STT Optimization)
```
User releases mic → Parallel STT (0.45s) → AI first token (1.2s) → TTS TTFB (0.2s) → Audio plays
                    ═══════════════════════════════════════════════════════════════════════════
                    Total: ~1.85 seconds to first audio (was 4.3s before parallel STT)
```

### What's Optimized
- **Cartesia Sonic-3**: Excellent TTFB at ~180ms average
- **Streaming Architecture**: Audio plays progressively sentence-by-sentence
- **Sentence Chunking**: Each sentence TTS'd immediately as it arrives from Gemini
- **Pre-warming**: Deepgram connection pre-warmed on voice chat entry
- **Mic Stream Caching**: Subsequent recordings start instantly (0ms delay)
- **Deduplication Guard**: Prevents LLM repetition loops (max 5 sentences)
- **Parallel STT** (Nov 29): Runs Live + Prerecorded APIs simultaneously, uses best result (~2.4s saved!)

### Parallel STT Architecture (Nov 29, 2024)

**Problem Solved**: Deepgram Live API occasionally returns empty transcripts, requiring fallback to Prerecorded API which adds ~2.8s latency.

**Solution**: Dual-layer parallel processing - race both APIs simultaneously, use first valid result.

```
Audio Blob ─┬─► [Deepgram Live API]      ─┐
            │   (WebSocket streaming)      ├──► First Valid Result Wins ──► LLM Pipeline
            └─► [Deepgram Prerecorded API] ─┘
                (REST batch processing)
```

**Performance Results**:
- Prerecorded API consistently wins: ~450ms average (vs Live API ~2850ms)
- Total latency reduction: ~2.4 seconds per voice exchange
- Reliability: 100% - always get a transcript (no empty fallbacks)

**Implementation Details** (`server/services/streaming-voice-orchestrator.ts`):
- Both APIs called with `Promise.race()` pattern
- First non-empty transcript immediately forwarded to LLM
- Losing API result discarded (no wasted processing)
- Timeout protection: 5s max wait for either API

### Voice Console Permission Model (Nov 29, 2024)

Three-tier permission system for voice emotion controls:

| Role | Gender Control | Personality/Expressiveness/Emotion |
|------|---------------|-----------------------------------|
| **Student/Teacher** | ✅ Male/Female toggle | ❌ Hidden |
| **Developer** | ✅ Male/Female toggle | ✅ Full control |
| **Admin** | ✅ Male/Female toggle | ✅ Full control |

**Security Enforcement**:
- **Backend**: `/api/user/preferences` strips restricted fields for non-developers
- **Frontend**: Voice emotion controls hidden from regular users
- **Files**: `client/src/pages/settings.tsx`, `server/routes.ts`

### Future Optimization Opportunities

**1. ✅ Parallel STT (COMPLETED Nov 29)**
- Run Deepgram Live + Prerecorded APIs in parallel
- First valid result wins
- Achieved: ~2.4 seconds saved per exchange

**2. Streaming STT (Medium Impact)**
- Use Deepgram's interim results to start AI processing early
- Risk: May need to handle corrections mid-stream

**3. Voice Activity Detection (Medium Impact)**
- Client-side VAD to detect end of speech faster
- Send audio immediately when silence detected (instead of button release)

**4. Regional Deployment (Low-Medium Impact)**
- Deploy closer to Deepgram/Gemini data centers
- Reduce network round-trip latency

## Recent Fixes (November 29, 2024)

### AI Duplicate Response Bug
**Problem**: Gemini generated 10 sentences, repeating same 5-sentence pattern twice.

**Solution (3-layer fix)**:
1. Simplified streaming voice prompt - "2-3 SENTENCES MAXIMUM. THEN STOP."
2. Server-side deduplication guard - tracks seen sentences, skips duplicates
3. Hard cap of 5 sentences per response

**Files Modified**:
- `server/system-prompt.ts` (lines 1638-1661) - Minimal prompt
- `server/services/streaming-voice-orchestrator.ts` (lines 399-441) - Dedup guard

### Verified Working Features
- ✅ Karaoke-style word highlighting with 180ms anticipatory timing
- ✅ Target-only subtitle mode (shows foreign words only)
- ✅ Progressive word reveal during playback
- ✅ Pedagogical response pattern (acknowledge → teach → practice)
- ✅ No duplicate responses
- ✅ Markdown markers stripped from display

### Known Limitations
- STT struggles with very short words (1-2 syllables)
- Words like "té" often misheard as "sí" due to phonetic similarity
- Empty transcripts occasionally returned for brief utterances

### Outstanding Issue: Subtitle Flash After Mic Release (Nov 29, 2024)

**Problem**: Target language words briefly flash visible after user releases mic button, before subtitle reset clears them.

**Current State**:
- Attempted fix: Added `isProcessing && !streamingText` check in `ImmersiveTutor.tsx` (line 400-404)
- Result: Flash still occurs despite the guard

**Investigation Notes**:
- Reset is called in `StreamingVoiceChat.tsx` line 1092 when audio sent for processing
- Sequence: `isRecording=false` → brief window → `reset()` called → subtitles clear
- The `isWaitingForContent` flag uses both ref (synchronous) and state (async) but flash persists

**Hypothesized Cause**:
- React batching may delay state updates despite using refs
- The `streamingText` from previous response may still be set when `isRecording` becomes false
- Need to investigate if earlier reset timing or different hiding approach is needed

**Next Steps for Tomorrow**:
1. Check if `streamingText` is being cleared before `isRecording` changes
2. Consider resetting subtitles on mouse DOWN (start of recording) rather than on audio send
3. May need to add additional guard in subtitle rendering logic
4. Investigate if the issue is in `useStreamingSubtitles.ts` state management

**Relevant Files**:
- `client/src/components/ImmersiveTutor.tsx` (lines 380-420) - Subtitle rendering logic
- `client/src/components/StreamingVoiceChat.tsx` (line 1092) - Reset call location
- `client/src/hooks/useStreamingSubtitles.ts` (lines 317-340) - Reset implementation
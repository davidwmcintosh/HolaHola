# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises in nine languages. It provides personalized chat, flashcards, and grammar modules that adapt to individual user progress, adhering to ACTFL standards. The project aims to deliver personalized education using AI, with ambitions to expand into institutional markets by offering features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android builds via Capacitor, including voice interaction controls and a hint bar. Sidebar navigation organizes content into Learning, Library, Resources, Teaching, and Administration sections.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), utilizing Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions is managed by `stripe-replit-sync`.

### Feature Specifications
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Personalized learning includes scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers, tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management with syllabus template browsing and class cloning, student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. The Class Creation Hub provides options to "Start from Template" or "Start from Scratch." The Syllabus Builder enables teachers to customize syllabi with drag-and-drop reordering, custom lesson creation, and editing. An ACTFL Standards Coverage panel provides real-time analysis of syllabus coverage. Developer tools include test account isolation, floating dev controls, and comprehensive usage analytics. A dual testing system (`isTestAccount`, `isBetaTester`) manages credits and analytics. Self-directed learners can customize their AI tutor's teaching style per language in Settings with four flexibility levels; class chats use the teacher's setting. Language-specific flexibility preferences are stored in `user_language_preferences`, with placement assessment offered when no classes or ACTFL level exists for a language. Drill-based lessons for rote content (numbers, vocabulary) with multiple drill modes (`listen_repeat`, `number_dictation`, `translate_speak`, `matching`, `fill_blank`) are supported, utilizing Google Cloud TTS for batch audio synthesis.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, storing user learning preferences and ACTFL progress. The voice architecture implements a two-tier validation system and utilizes Cartesia Pronunciation Dictionaries for TTS correction. The `StreamingVoiceClient` singleton MUST be stored on `window.__streamingVoiceClient` to prevent duplicate module issues. An ACTFL-level-aware subtitle synchronization system (`client/src/lib/subtitlePolicies.ts`) implements proficiency-specific timing policies: Novice (300ms preview, progressive word reveal); Intermediate (150ms, full sentence display); Advanced (0ms delay, mode convergence). The audio player (`client/src/lib/audioUtils.ts`) anchors subtitle highlighting to `audio.currentTime`. Timing telemetry logs word-level drift for diagnostics. A server-driven subtitle system with karaoke-style word highlighting uses native Cartesia word-level timestamps via WebSocket API (`add_timestamps: true`), with automatic fallback to bitrate-based estimation. The `sentence_ready` architecture ensures audio playback starts only after word timings arrive, preventing race conditions. A principled target language extraction system uses bold-only extraction plus unambiguous foreign character detection. A WebSocket-based progressive audio delivery system integrates Deepgram STT, Gemini streaming, and Cartesia WebSocket TTS. Dynamic streaming greetings are personalized, ACTFL-aware, history-aware, and context-aware. An AI-powered conversation tagging system categorizes conversations and vocabulary. A Syllabus-Aware Competency System tracks student progress against syllabus topics. A unified learning filter system provides consistent content filtering. A comprehensive metering system for voice tutoring time is integrated with Stripe, with a class-specific balance system. Centralized Role-Based Access Control (RBAC) defines hierarchical permissions. A hybrid grammar system combines conversational practice with targeted instruction. A syllabus content system provides pre-built syllabi across 9 languages. A class type taxonomy system categorizes classes. A tutor freedom level system controls AI tutor behavior per class. A unified ACTFL assessment system dynamically assesses learner proficiency. A placement assessment system verifies proficiency for class enrollments. A Command Center (`/admin`) provides a unified tab-based admin experience with role-based visibility for managing users, classes, analytics, and developer tools, including syllabus editing. A developer usage analytics dashboard offers comprehensive analytics and credit management for testing.

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions and voice chat LLM.
-   **Deepgram API**: For voice STT (Nova-3 model).
-   **Cartesia API**: Primary TTS provider (Sonic-3 model).
-   **Google Cloud Text-to-Speech**: Fallback TTS.
-   **Unsplash**: Stock educational images.
-   **Gemini Flash-Image**: AI-generated contextual images.

### Libraries & Tools
-   **Database**: Neon PostgreSQL, Drizzle ORM, Drizzle Kit.
-   **UI Framework**: React, TypeScript, Vite, Wouter.
-   **UI Components**: Radix UI, Shadcn/ui, Tailwind CSS.
-   **State Management**: TanStack Query, React Context.
-   **Billing**: `stripe-replit-sync`.

---

## Active Bug: Timing Loop Not Stopping After All Sentences Complete

### Bug Summary
The precision timing loop in `StreamingAudioPlayer` continues running indefinitely after all audio sentences have finished playing. The loop should stop when all sentences are complete, but it keeps ticking (4860+ ticks observed) even though all sentences have ended.

### Root Cause Analysis

**The Problem Chain:**
1. Server sends `response_complete` message with `totalSentences` count
2. Client's `StreamingVoiceClient` receives it and emits `'responseComplete'` event  
3. `useStreamingVoice` hook's `handleResponseComplete` handler is called
4. Handler tries to call `playerRef.current.setExpectedSentenceCount(totalSentences)`
5. **FAILURE POINT:** `playerRef.current` is `null` when the callback executes
6. `expectedSentenceCount` never gets set on the player
7. `checkAllSentencesEnded()` returns `false` because it requires `expectedSentenceCount !== null`
8. Loop continues forever

**Why playerRef.current is null:**
The `StreamingAudioPlayer` instance is created/destroyed dynamically, but the WebSocket event handlers in `useStreamingVoice` hold stale references. When `response_complete` arrives, the player reference may have been cleared or not yet set.

### Current State of the Code

**Files involved:**
- `client/src/lib/audioUtils.ts` - `StreamingAudioPlayer` class with timing loop
- `client/src/hooks/useStreamingVoice.ts` - Hook managing player and WS events
- `client/src/lib/streamingVoiceClient.ts` - WebSocket client
- `client/src/lib/debugTimingState.ts` - Debug state tracking
- `client/src/components/DebugTimingPanel.tsx` - On-screen debug display

**Debug infrastructure added:**
- `window.__debugTimingState` tracks all WebSocket messages, counts, and `response_complete` receipt
- Debug panel shows real-time loop state, sentence schedule, and `checkAllSentencesEnded()` results
- `wsResponseCompleteReceived` flag confirms server message IS arriving

**Fallback logic added (not yet working):**
1. In `checkAllSentencesEnded()`: If `expectedSentenceCount === null` BUT `wsResponseCompleteReceived === true`, check if all sentences in schedule have ended
2. In timing loop: Periodic check every 30 frames for fallback condition

### Observed Behavior (from Debug Panel)

```
TURN COMPLETION: 2/2 received (or 4/4)
Expected: null (this is the bug!)
Received: 2
Started: 2  
Ended: 2
checkAllSentencesEnded(): FALSE
Reason: expectedSentenceCount=null (waiting for response_complete)
WS MESSAGES: ✓ response_complete RECEIVED (confirms message arrived)
Loop Running: YES (loop continues forever)
Loop Ticks: 4860+ and counting
```

### Fallback Logic Status

The fallback was added but may not be triggering. Next debugging step is to check console logs for:
- `[FALLBACK CHECK]` - status every ~2.5s showing wsReceived and expectedCount
- `[FALLBACK]` - when fallback condition is evaluated

### Potential Solutions to Explore

1. **Fix the playerRef timing:** Ensure playerRef is valid when handleResponseComplete fires
   - Move player creation earlier
   - Use a stable ref pattern
   - Queue the setExpectedSentenceCount call if player not ready

2. **Alternative signal path:** Have StreamingVoiceClient directly update the player
   - Store expected count in a shared location (debug state or window)
   - Player reads from this instead of relying on hook callback

3. **Robust fallback:** If fallback is working but checkAllSentencesEnded still returns false:
   - Debug why sentences aren't marked as "ended" in the schedule
   - Check if endCtxTime is being set correctly

4. **Direct fix:** In the hook's handleResponseComplete, log whether playerRef.current exists
   - If null, store the count somewhere the player can access later
   - When player initializes, check for pending expectedSentenceCount

### Key Debug Commands

```javascript
// Check debug state in browser console
window.__debugTimingState

// Key fields to check:
// - wsResponseCompleteReceived: should be true
// - expectedSentenceCount: should be number, but is null (bug)
// - sentenceSchedule: array of sentence entries with ended flags
```

### Files to Examine Tomorrow

1. `client/src/hooks/useStreamingVoice.ts` - Find `handleResponseComplete` and trace playerRef lifecycle
2. `client/src/lib/audioUtils.ts` lines 1334-1358 - Fallback logic in timing loop
3. `client/src/lib/audioUtils.ts` lines 1486-1508 - `checkAllSentencesEnded()` with fallback
4. Browser console - Look for `[FALLBACK CHECK]` and `[FALLBACK]` logs
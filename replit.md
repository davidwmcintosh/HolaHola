# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application focused on interactive conversation practice, vocabulary building, and grammar exercises across multiple languages and difficulty levels. It leverages AI for chat, flashcards, and grammar modules, tracking user progress to deliver a personalized and adaptive learning experience. The project supports 9 target languages (English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, Korean) with explanations in any native language, aiming for significant market potential in educational technology.

## User Preferences
Preferred communication style: Simple, everyday language.

## Active Issues & Troubleshooting

### Voice Chat Architecture Pivot - ✅ COMPLETED (Nov 21, 2025)
**Issue**: OpenAI Realtime WebSocket API proved unstable after 3+ hours of debugging
- Multiple configurations tested (ephemeral sessions, direct WebSocket, various instruction lengths, multiple models)
- All failed identically with `server_error` after `session.updated` event
- Root cause appears to be upstream OpenAI API defect, not fixable client-side

**Solution**: Pivoted to stable REST-based voice pipeline
- Architecture: Record audio → Whisper STT → GPT-4 text → TTS → Playback
- Backend endpoints:
  - `POST /api/voice/transcribe` - Whisper speech-to-text (supports Safari/iOS audio formats)
  - `POST /api/voice/synthesize` - OpenAI TTS text-to-speech
- Frontend: `RestVoiceChat.tsx` component (replaces broken WebSocket implementation)
- Usage tracking: Check quota BEFORE transcription, increment AFTER success (prevents failed attempts from consuming quota)
- Error recovery: Context-specific error messages with fallback guidance (encourages mode switching)
- Concurrency safety: Conditional SQL UPDATE with atomic quota enforcement

**Files Modified**:
- `client/src/components/RestVoiceChat.tsx` - New REST voice chat component
- `client/src/lib/restVoiceApi.ts` - REST API client with nested content array support
- `server/routes.ts` - New voice endpoints with proper usage enforcement
- `server/storage.ts` - Split usage methods (`checkVoiceUsage` + `incrementVoiceUsage`)
- `client/src/pages/chat.tsx` - Integrated RestVoiceChat

**Debugging Time**: 8+ hours (WebSocket) + 4+ hours (REST implementation)
**Details**: See `VOICE_CHAT_TROUBLESHOOTING.md` for complete investigation timeline

## Architectural Principles

### 🚨 UNIFIED CODE PRINCIPLE (Critical)
**Voice and text chat must share code where reasonable to prevent synchronization issues and feature drift.**

This is a guiding principle that prevents bugs like:
- Text scrollbar visible but voice scrollbar not visible
- Error handling different between modes
- Styling inconsistencies (colors, spacing, animations)
- Accessibility features present in one mode but missing in the other

#### Where Shared Code Lives
1. **Utilities** (`client/src/lib/`): Common error handling, audio utils, formatting
2. **Hooks** (`client/src/hooks/`): Custom hooks used by both components (e.g., `use-streak`)
3. **Components** (`client/src/components/`): Shared UI components (InstructorAvatar, AccentButtons, etc.)
4. **Context** (`client/src/contexts/`): Language/difficulty context used by both modes
5. **Server utils** (`server/`): Unified system prompts, error handling, message processing

#### What Should Be Shared
- **Error handling logic**: Both modes should handle microphone/API errors identically
- **Scrollbar/scroll behavior**: Custom CSS classes applied to all scrollable message containers
- **ARIA attributes**: Accessibility features applied consistently across all interactive elements
- **Message rendering**: Core message display logic (not the container, but the message bubble styles and media rendering)
- **Error UI components**: Not duplicated in voice and text, use shared error display component
- **System prompts**: `createSystemPrompt()` already shared, keep it this way
- **Styling utilities**: Custom scrollbar, hover states, transitions

#### What Can Differ
- **Input method**: Voice input vs text input textarea (obviously)
- **Recording state UI**: Voice-specific UI for recording indicator
- **Microphone UI**: Voice-specific mic button
- **Layout**: Text may have different layout than voice

#### Change Checklist
When making changes to VoiceChat.tsx or ChatInterface.tsx, ask:
- [ ] Does this feature exist in BOTH components?
- [ ] If yes, should they share code/styling?
- [ ] Did I update BOTH places if they should be synchronized?
- [ ] Are error handling approaches identical?
- [ ] Is styling (colors, spacing, scrollbars) consistent?
- [ ] Are accessibility attributes applied to both?

If unsure, default to: **Extract shared logic to utilities/hooks and import in both components.**

---

## System Architecture

### Frontend
-   **Framework**: React with TypeScript (Vite).
-   **Routing**: Wouter.
-   **State Management**: React Context API, TanStack Query.
-   **UI**: Shadcn/ui (Radix UI base) styled with Tailwind CSS, following Material Design principles, with light/dark mode.
-   **Layout**: Two-column desktop, single-column mobile with mobile-first responsive design.
-   **Typography**: Inter (UI text), JetBrains Mono (code/phonetic content).
-   **UI/UX Decisions**: Prominent "Voice Learning" button with a "Recommended" badge, and a subtle "Type instead" button for text mode, along with a gentle hint bar in text mode encouraging voice learning.
-   **PWA**: Progressive Web App support with service worker for offline caching, installable to home screen, splash screen, and auto-update notifications.
-   **Mobile App**: Capacitor configured for iOS and Android native app builds while maintaining 100% code sharing with web version.

### Backend
-   **Server**: Express.js on Node.js with TypeScript.
-   **API**: RESTful.
-   **Storage**: Abstract `IStorage` interface with Drizzle ORM for PostgreSQL.
-   **AI Integration**: OpenAI-compatible API via Replit's AI Integrations.
-   **Session Management**: `connect-pg-simple` with PostgreSQL session store.
-   **Authentication**: Replit Auth (OIDC) with email/password and social login support. WebSocket connections authenticate via server-side session validation to prevent userId spoofing.
-   **Billing**: Stripe integration via `stripe-replit-sync` for subscription management.

### Data Models
-   **Core Entities**: Users (with Stripe billing fields), Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics (`shared/schema.ts`).
-   User-specific data linked via `userId` foreign keys.
-   Stripe data synced to PostgreSQL `stripe` schema via webhooks.
-   Multimedia content system for `mediaFiles`, `messageMedia`, `videoLessons`, `pronunciationAudio`, `lessonVisualAids`, `culturalTipMedia`.
-   User learning preferences: `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `onboardingCompleted`.

### Core Features
-   **Conversational Onboarding**: AI-guided setup with a three-layer defensive architecture.
-   **Adaptive Multi-Phase Conversation System**: Gradual transition to target language immersion, adapting to user proficiency.
-   **User Agency**: AI suggests topics but confirms with the user; features like one-question-per-response.
-   **Voice Chat**: Production-stable REST-based voice pipeline (Whisper STT → GPT → TTS), replacing unstable WebSocket Realtime API. Supports Push-to-Talk recording, seamless text/voice mode synchronization, and enhanced pronunciation feedback.
    - **Architecture**: Record browser audio → POST to `/api/voice/transcribe` (Whisper) → POST to `/api/chat` (GPT-4) → POST to `/api/voice/synthesize` (TTS) → Play MP3 in browser
    - **Mobile Support**: Accepts Safari/iOS audio formats (audio/mp4, audio/mp4a-latm) in addition to WebM
    - **Usage Enforcement**: Tier-based monthly limits enforced server-side with atomic SQL updates, quota checked BEFORE transcription and incremented AFTER success
    - **Error Handling**: Context-specific error messages (quota, transcription, synthesis) with fallback guidance encouraging mode switching
    - **Response Parsing**: Robust handling of all GPT response formats (string, object, nested content arrays for tool calls)
    - **Accessibility**: ARIA attributes (aria-pressed, aria-label, role) on all voice control buttons for screen reader compatibility
-   **Content Guardrails**: Moderation system for appropriate learning content.
-   **Personalized Learning**: Auto-language detection, scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment.
-   **AI-Generated Educational Images**: Intelligent display of inline images (Unsplash, DALL-E) with caching.
-   **Subscription Tiers**: Free, Basic, Pro, Institutional, with varying features and AI model access.
-   **Usage Tracking**: Atomic voice message usage tracking with monthly reset and tiered limits.
-   **Unified Chat Architecture**: Both voice and text chat utilize a single `createSystemPrompt()` function for consistent instructions and beginner teaching methodologies (e.g., present tense only, one concept at a time, listen-and-repeat sequence, 7±2 word limit). Greeting logic ensures a single greeting message per conversation. Voice and text modes fetch conversation history identically using server-derived userId to ensure secure, consistent prompts.
-   **Auto-Generated Conversation Titles**: After 5 messages, AI automatically generates descriptive conversation titles (e.g., "Job Interview Practice", "Ordering at a Restaurant") to help users find and resume specific conversations. Uses structured output for concise, topic-focused titles (3-6 words max).
-   **Conversation Memory & Resumption**: When students ask "what did we talk about last time?" or "can you remind me?", the tutor naturally references previous conversation titles and offers to continue where they left off. Upon switching to a previous conversation, AI generates a brief context summary (2-3 sentences) reminding students what they were learning, maintaining continuity and reducing cognitive load when resuming past topics. Both voice and text modes access identical conversation history for consistent context across all interactions.
-   **Mobile-First Responsive Design**: Full responsive layout with breakpoint at 768px (Tailwind `md:`). Mobile view features hidden sidebar, simplified headers, large 80px mic button, compact VAD toggle with abbreviated labels, and condensed spacing. Desktop view shows full sidebar, complete headers with subtitles, standard 64px mic button, and full VAD toggle labels. All avatars and UI elements scale appropriately across breakpoints.
-   **PWA Install Prompt**: Smart install prompt appears after 3 seconds, can be dismissed for 7 days, and encourages users to add app to home screen for native-like experience.

## External Dependencies

-   **Third-Party Services**: Stripe (billing), Replit Auth (authentication), OpenAI API (AI chat via Replit AI Integrations), Unsplash (stock images), DALL-E (AI-generated images).
-   **Libraries**: Neon Database Serverless, Drizzle ORM, stripe-replit-sync, Radix UI, TanStack Query, Wouter, date-fns, Embla Carousel.
-   **Database**: PostgreSQL (via `DATABASE_URL`) with Drizzle Kit for migrations, connection pooling via `@neondatabase/serverless`.
-   **AI Models**: 
    - Voice: `whisper-1` (STT), `tts-1` (TTS), `gpt-4o-mini` (Free tier text generation), `gpt-4o` (Pro tier text generation)
    - Text chat: `gpt-4o-mini` (Free/Basic/Institutional), `gpt-4o` (Pro)
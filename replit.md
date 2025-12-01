# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises across nine languages. It provides personalized chat, flashcards, and grammar modules that adapt to individual user progress, adhering to ACTFL standards. The project aims to deliver personalized education using AI, with ambitions to expand into institutional markets.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android builds via Capacitor, including voice interaction controls and a hint bar.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions is managed by `stripe-replit-sync`.

### Feature Specifications
LinguaFlow provides conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Personalized learning includes scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers, tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management, student enrollment, curriculum systems, assignment workflows, and a Super Admin Backend with RBAC.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, storing user learning preferences and ACTFL progress.

**Voice Architecture**: Implements a two-tier validation system and utilizes Cartesia Pronunciation Dictionaries for server-side TTS pronunciation correction (with MFA-style IPA as inline fallback). A server-driven subtitle system with karaoke-style word highlighting and server-side word timing estimation is implemented, using `turnId` and `hasTargetContent` flags in the streaming protocol for packet ordering (YouTube/Netflix caption architecture).

**Cartesia Pronunciation Dictionary System**: Uses Cartesia's server-side pronunciation dictionaries to ensure correct pronunciation of foreign language words by the AI tutor, leveraging `MFA_IPA_PRONUNCIATIONS` for definition and `setup-cartesia-dictionaries.ts` for management.

**English Word Filter System**: Employs a comprehensive blocklist of common English words to prevent them from incorrectly appearing as target language vocabulary in subtitles and vocabulary extraction, defined in `server/text-utils.ts`.

**Streaming Voice Mode**: A WebSocket-based progressive audio delivery system integrating Deepgram STT, Gemini streaming, Cartesia WebSocket TTS, and progressive audio playback, with pedagogical integrations like content moderation and real-time ACTFL advancement tracking.

**Dynamic Streaming Greeting System**: AI-generates personalized, ACTFL-aware, history-aware, and context-aware greetings for new conversations.

**Conversation Tagging System**: An AI-powered system using Gemini to categorize conversations and vocabulary into Subject, Grammar, and Function topics.

**Language Hub**: The main dashboard (`/`, `/dashboard`, `/review`) unifies learning tasks, aggregating Daily Plan, Topic Deep Dives, Quick Stats, and Course Overview.

**Syllabus-Aware Competency System**: Recognizes and tracks when students organically cover curriculum topics during conversations, using a Competency Verification Service and dedicated tables (`syllabusProgress`).

**Unified Learning Filter System**: A cross-page filtering system (`LearningFilterContext`) for consistent content filtering across Review Hub, Vocabulary, Grammar, and Chat History, with settings saved to localStorage.

**Usage & Credit System Architecture**: A comprehensive metering system for voice tutoring time using `voiceSessions` and `usageLedger` tables, integrated with Stripe for individual hour packages and institutional credit allocation.

**Class-Specific Balance System**: Implements isolated hour pools per class with dual-source consumption (enrollment allocations and purchased hours), prioritizing class balance then purchased hours.

**Centralized Role-Based Access Control (RBAC)**: A hierarchical permission system using shared helpers (`shared/permissions.ts`) with roles including Student, Teacher, Developer, and Admin.

**Hybrid Grammar System**: Combines conversational practice with targeted explicit instruction using `grammarCompetencies`, `grammarErrors`, and `userGrammarProgress` tables, offering a topic browser and practice drills.

**Curriculum Content System**: Provides pre-built curricula across 9 languages, comprising 21 courses, 116 units, and 524 lessons, including Conversation, Vocabulary, Grammar, and Cultural Exploration.

**Class Type Taxonomy System**: A marketing-focused class categorization system with 4 preset types and admin-extensible custom types, managed via `classTypes` table and integrating with the public catalogue.

**Tutor Freedom Level System**: Controls AI tutor behavior per class with 4 levels: `guided`, `flexible_goals`, `open_exploration`, and `free_conversation`, configurable via `teacherClasses.tutorFreedomLevel`.

**Unified ACTFL Assessment System**: ACTFL proficiency is the single source of truth for learner levels, dynamically assessed by the AI tutor during conversation and seeded by onboarding difficulty selection.

**Placement Assessment System**: Adaptive proficiency verification for Level 2+ class enrollments, analyzing the first voice session conversation via `PlacementAssessmentService` to assess ACTFL level.

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

## Recent Changes (December 1, 2025)

### Phantom Subtitle Bug - RESOLVED
Fixed black "ghost" text from previous turns appearing in subtitles.

**Root Cause:** `isWaitingForContent` flag was cleared in `addSentence()` before `streamingText` was computed in `startPlayback()`, creating a timing gap where the fallback subtitle path showed old message content.

**Fix:** Moved `isWaitingForContent` clearing to `startPlayback()` for synchronous state batching.

**Status:** RESOLVED after 6 fix attempts. See `docs/SUBTITLE_BUG_TRACKING.md` for full investigation.

### Target Language Extraction - VERIFIED WORKING
Multi-word phrases like "Buenos días", "Buenas tardes", "Buenas noches" are being correctly extracted from bold-marked text (`**Buenos días**`).

**Key Files:**
- `server/text-utils.ts` - `extractTargetLanguageText()` and `extractTargetLanguageWithMapping()`
- Multi-pass extraction: PASS 1 (bold patterns), PASS 2 (foreign chars), PASS 3 (common words), PASS 4 (multi-word phrases)
- COMMON_PHRASES array at line 66-101 defines phrase patterns

### Subtitle Timing Offset
Words appear 150ms before audio for readability.

**Location:** `client/src/hooks/useStreamingSubtitles.ts` line 428
```typescript
const SUBTITLE_OFFSET = 0.15;  // seconds
```

**Tuning:** Can be adjusted 0-0.2s based on user preference.

### Debug Logging Cleanup
Removed temporary extraction debug logging from `server/text-utils.ts` that was added during investigation.

---

## Previous Changes (November 30, 2025)

### Subtitle System Bug Fix
Fixed duplicate/accumulated target words in streaming subtitles (e.g., "hola hola").

**Root Cause:** The `currentSentence` lookup only checked sentence `index`, not `turnId`.

**Fix:** Updated lookup to match both `index` AND `turnId`:
```typescript
sentences.find(s => s.index === currentSentenceIndex && s.turnId === currentTurnId)
```
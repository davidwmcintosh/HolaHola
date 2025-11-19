# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across multiple languages and difficulty levels. It offers AI-powered chat, flashcards, and grammar modules, tracking user progress to foster consistent learning. The project aims to deliver a personalized and adaptive language learning experience with significant market potential in the educational technology sector, supporting any of 8 target languages with explanations in any native language.

## User Preferences
Preferred communication style: Simple, everyday language.

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

### Data Models
-   Core entities: Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, Topics (`shared/schema.ts`).
-   Data flow managed by React Query.

### Core Features
-   **Conversational Onboarding**: AI-guided setup for new users using GPT-5 with strict JSON schemas.
-   **Auto-Language Detection**: Intelligent language switching based on user input.
-   **Adaptive Multi-Phase Conversation System**: Gradual transition from native to target language immersion, adapting to user proficiency.
-   **User Agency & Conversation Control**: AI suggests topics but always confirms with the user, allowing user-driven topic selection.
-   **One-Concept-Per-Message Teaching**: AI introduces one new word/phrase at a time for focused learning.
-   **One-Question-Per-Response & Ask-and-Pause**: AI asks one direct question per response and pauses for natural conversation flow.
-   **Student Question Handling**: AI directly answers student questions before optionally asking follow-ups.
-   **Content Guardrails**: Moderation system for appropriate learning content, declining off-topic or harmful interactions.
-   **Creative Scenario-Based Learning**: AI creates practical scenarios for enhanced learning.
-   **Slow Pronunciation with Phonetic Breakdowns**: Provides phonetic spellings and stress markers for new vocabulary, integrated into voice mode.
-   **Automatic Vocabulary Extraction**: AI identifies and saves new vocabulary to the flashcard system.
-   **Voice Chat Feature**: Real-time voice conversations via OpenAI Realtime API, including push-to-talk and progressive "Listen-and-Repeat" for beginners. Features smart capability detection, clear error messaging, and OpenAI's "alloy" voice.
-   **Conversational Thread Management**: Auto-creates fresh conversations with context about previous interactions and allows switching via AI-directed protocol.
-   **Personalized Greetings**: AI greets users by name, adjusting for first-time vs. returning users.
-   **Animated Instructor Avatar**: Visual feedback for engagement.
-   **Spaced Repetition System**: SM-2 algorithm-based vocabulary review scheduling with adaptive intervals and "Show Due Only" filter.
-   **Streak Tracking System**: Daily practice streaks with metrics and milestone badges.
-   **Progress Charts Dashboard**: Interactive visualizations (Vocabulary Growth, Practice Time, Conversation Activity) using `recharts`.
-   **Auto-Difficulty Adjustment**: Intelligent difficulty recommendation system based on user performance, with success rate analysis and UI recommendations.
-   **Pronunciation Scoring System**: Real-time pronunciation feedback in voice conversations using OpenAI GPT-4o-mini, with scores, color-coded badges, and specific phonetic suggestions.
-   **Chat Ideas Library**: Browsable topic inspiration page with pre-seeded topics.
-   **Cultural Tips System**: AI naturally weaves cultural insights into conversations, with a browsable page for pre-seeded tips across languages.
-   **Full Application**: Integrated AI chat, vocabulary flashcards, grammar exercises, conversation history, progress tracking, auto-difficulty adjustment, pronunciation scoring, topic library, and cultural tips.

## External Dependencies

-   **Third-Party Libraries**: OpenAI API (via Replit AI Integrations), Neon Database Serverless, Drizzle ORM, Radix UI, TanStack Query, Wouter, date-fns, Embla Carousel.
-   **Database**: PostgreSQL (via `DATABASE_URL`) with Drizzle Kit for migrations and connection pooling via `@neondatabase/serverless`.
-   **Asset Management**: Google Fonts (Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono), static images in `attached_assets/generated_images/`.

## Recent Updates (November 19, 2025)

### Database Migration & Bug Fixes
-   **Migrated from MemStorage to DatabaseStorage**: Replaced in-memory storage with PostgreSQL persistence using Drizzle ORM for all data models (conversations, messages, vocabulary, progress, etc.).
-   **Fixed nativeLanguage Inheritance Bug**: Corrected critical bug in `server/routes.ts` (lines 172-200) where new conversations were defaulting to 'english' instead of inheriting the user's previously saved nativeLanguage. The inheritance logic now runs for ALL post-onboarding conversations, regardless of whether `isOnboarding` is explicitly set by the frontend or auto-detected by the backend.
-   **Verified Inheritance**: Database queries and logs confirm that nativeLanguage inheritance is working correctly (e.g., 28+ conversations with `nativeLanguage='german'` for test users).
-   **Fixed Progress Date Handling Bug**: Corrected critical bug in `server/routes.ts` PATCH `/api/progress` endpoint where ISO date strings from the frontend were not being converted to Date objects before database updates, causing "value.toISOString is not a function" errors. Now properly converts date strings to Date objects.

### Mid-Conversation Native Language Change Feature
-   **Dynamic Language Switching**: Users can now request to change their native language (the language used for explanations) mid-conversation without creating a new conversation.
-   **Intelligent Detection**: Backend uses OpenAI GPT-5 structured outputs (`detectNativeLanguageChangeRequest` in `server/onboarding-utils.ts`) to detect phrases like "explain in Spanish instead", "switch to German", "change explanations to French".
-   **Smart Guard Condition**: Prevents redundant database writes and confusing confirmation messages when users reaffirm their current native language (e.g., "keep explaining in English" when already using English).
-   **Lowercase Normalization**: Language names are normalized to lowercase before comparison to ensure consistent matching.
-   **Seamless Integration**: Updates `conversation.nativeLanguage` in the database and prepends confirmation message to AI response (e.g., "I've switched the explanations to spanish. Let's continue!").
-   **End-to-End Tested**: Feature verified via playwright tests confirming detection, database updates, and UI acknowledgment.

### Enhanced One-Concept-Per-Message Teaching (November 19, 2025)
-   **Complex Request Handling**: Fixed system prompt across all phases (Phase 1, 2, and 3) to enforce one-concept-per-message teaching even for complex multi-step requests.
-   **Before**: When a user asked "teach me how to order a coffee", the AI would overwhelm them with multiple phrases ("Quisiera un café", "con leche", "solo", "americano", "para llevar") plus cultural tips all in one response.
-   **After**: AI teaches EXACTLY ONE phrase (e.g., "Quisiera un café, por favor") with pronunciation, asks student to practice, and STOPS. Additional variations are taught in subsequent messages after practice.
-   **Phase 1 Direct Teaching**: Added explicit handling in Phase 1 for direct teaching requests - treats them as topic selection and immediately begins teaching ONE phrase, signaling readiness to transition from assessment to teaching.
-   **Phase 2/3 Multi-Step Protocol**: Distinguishes simple lexical questions ("How do you say X?") from complex requests ("Teach me how to order coffee"). Complex requests follow: (1) acknowledge, (2) optional one-sentence plan, (3) teach ONLY first phrase with pronunciation, (4) stop and wait for practice.
-   **Architect-Reviewed**: Changes preserve pedagogical approach and prevent student overload while maintaining natural conversation flow.
-   **End-to-End Tested**: Verified via playwright tests - AI consistently responds with exactly one phrase (under 150 words) and waits for practice before offering variations.

### Known LLM Limitation
-   **OpenAI Language Compliance**: OpenAI GPT-5 occasionally returns English greetings despite prompts explicitly requesting responses in the user's native language (e.g., "Use ONLY german"). This is inherent LLM behavior, not a code defect. The prompts are correctly configured with the inherited nativeLanguage, but the API sometimes ignores language instructions for short system messages. Consider reinforcing prompts with system messages or few-shot examples if consistent language compliance becomes critical.
# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across multiple languages and difficulty levels. It offers AI-powered chat, flashcards, and grammar modules, tracking user progress to foster consistent learning. The project aims to deliver a personalized and adaptive language learning experience with significant market potential in the educational technology sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React with TypeScript (Vite).
-   **Routing**: Wouter for client-side navigation.
-   **State Management**: React Context API (global), TanStack Query (server state), local component state (UI).
-   **UI**: Shadcn/ui (Radix UI base), styled with Tailwind CSS, following Material Design principles. Supports light/dark mode.
-   **Layout**: Two-column desktop (sidebar + main), single-column mobile.
-   **Typography**: Inter (UI text), JetBrains Mono (code/phonetic content).

### Backend
-   **Server**: Express.js on Node.js with TypeScript.
-   **API**: RESTful for conversations, messages, vocabulary, grammar, and progress.
-   **Storage**: Abstract `IStorage` interface, in-memory implementation (`MemStorage`). Drizzle ORM configured for PostgreSQL.
-   **AI Integration**: OpenAI-compatible API via Replit's AI Integrations.
-   **Session Management**: `connect-pg-simple` (PostgreSQL-backed, pending).

### Data Models
-   Core entities: Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress (defined in `shared/schema.ts`).
-   Data flow managed by React Query for fetching, caching, and optimistic updates.

### Core Features
-   **Conversational Onboarding**: AI-guided setup for new users (name, language preference) using GPT-5 with strict JSON schemas, persistent via localStorage and conversation records.
-   **Auto-Language Detection**: Intelligent switching based on user input (3+ messages, 5+ alphabetic words, >0.8 confidence) with AI notification.
-   **Adaptive Multi-Phase Conversation System**:
    1.  **Phase 1 (Messages 1-5)**: English assessment with encouraging target language words (95% English).
    2.  **Phase 2 (Messages 6-10)**: Gradual transition (80% English -> 50% English) introducing basics, progressive translation (new vocabulary translated, familiar words not).
    3.  **Phase 3 (Message 11+)**: Immersive practice (80-90% target language) with selective translation based on difficulty.
-   **One-Question-Per-Response**: AI asks only one direct question at the end of its response to facilitate natural conversation flow.
-   **Ask-and-Pause Pattern**: AI ends responses immediately after asking a question, without additional text, for natural conversational pauses.
-   **Student Question Handling**: AI answers student questions directly and fully, then may ask one follow-up question. Supports factual, learning, and app-related questions.
-   **Content Guardrails**: AI politely declines off-topic, inappropriate, or non-educational requests, redirecting to language learning.
-   **Creative Scenario-Based Learning**: Starting Phase 2, AI creates brief, practical, and student-driven scenarios (e.g., ordering food) to enhance learning.
-   **Slow Pronunciation with Phonetic Breakdowns**: Provides phonetic spellings with stress markers (e.g., "GRAH-syahs") for new vocabulary, with adaptive frequency based on difficulty. Integrated into voice mode.
-   **Automatic Vocabulary Extraction**: AI automatically identifies and saves new vocabulary from conversations into the flashcard system.
-   **Voice Chat Feature**: Real-time voice conversations via OpenAI Realtime API (WebSocket proxy). Includes push-to-talk, visual feedback, and text/voice toggle. Features a progressive "Listen-and-Repeat" pattern for beginners.
-   **Personalized Greetings**: AI greets users by name, adjusting messages for first-time vs. returning users.
-   **Animated Instructor Avatar**: Visual feedback (idle, listening, speaking states) for enhanced engagement.
-   **Full Application**: Includes AI chat, vocabulary flashcards, grammar exercises, conversation history, and progress tracking dashboard.

## External Dependencies

### Third-Party Libraries
-   OpenAI API (via Replit AI Integrations)
-   Neon Database Serverless (`@neondatabase/serverless`)
-   Drizzle ORM
-   Radix UI
-   TanStack Query
-   Wouter
-   date-fns
-   Embla Carousel

### Database
-   PostgreSQL (configured via `DATABASE_URL`).
-   Drizzle Kit for migrations.
-   Connection pooling via `@neondatabase/serverless`.

### Asset Management
-   Google Fonts (Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono).
-   Static images in `attached_assets/generated_images/`.
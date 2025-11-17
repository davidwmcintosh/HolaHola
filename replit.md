# LinguaFlow - Interactive Language Tutor

## Overview

LinguaFlow is an AI-powered language learning application designed to offer interactive conversation practice, vocabulary building, and grammar exercises. It enables users to practice multiple languages at various difficulty levels through AI-powered chat, flashcards, and interactive grammar modules. The platform tracks user progress, including words learned, practice time, and streaks, to foster consistent learning. The project aims to provide a personalized and adaptive language learning experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite.
**Routing**: Wouter for client-side routing (Dashboard, Chat, Vocabulary, Grammar, History).
**State Management**: React Context API for global preferences, TanStack Query for server state, local component state for UI.
**UI Component Library**: Shadcn/ui built on Radix UI, styled with Tailwind CSS. Follows Material Design principles for clarity.
**Styling**: Tailwind CSS with custom design tokens, supporting light/dark mode persistence.
**Key Design Decisions**: Two-column desktop layout (sidebar + main), single-column mobile. Material Design, Inter for UI text, JetBrains Mono for code/phonetic content, consistent spacing.

### Backend Architecture

**Server Framework**: Express.js on Node.js with TypeScript.
**API Design**: RESTful API for conversations, messages, vocabulary, grammar, and progress tracking.
**Storage Layer**: Abstract `IStorage` interface with in-memory implementation (`MemStorage`). Drizzle ORM configured for PostgreSQL for future migration.
**AI Integration**: OpenAI-compatible API via Replit's AI Integrations for conversational responses.
**Session Management**: `connect-pg-simple` for PostgreSQL-backed session storage (pending full implementation).

### Data Models

**Core Entities**: Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress. These are defined in `shared/schema.ts`.
**Data Flow**: Client uses React Query for data fetching, caching, and optimistic updates. Context changes trigger content refetches.

### Core Features and Implementations

**Conversational Onboarding System**:
- **Natural Flow**: AI asks "What's your name?" followed by "Which language would you like to study?"
- **Flexible Input**: Accepts both simple responses ("Alex", "French") and full sentences ("My name is Alex", "I want to learn French")
- **OpenAI Structured Output**: Uses GPT-5 with strict JSON schemas to extract name and language preference
- **User-Scoped**: Onboarding tracked per userName - only triggers for genuinely new users
- **State Persistence**: Name and language saved to localStorage and conversation record
- **Smart Detection**: Checks if user has completed onboarding before (by userName) to avoid re-asking returning users

**Auto-Language Detection**:
- **Intelligent Switching**: Detects when user consistently speaks a different language than selected
- **Conservative Thresholds**: Requires 3+ messages, 5+ alphabetic words (using regex `/[a-zA-ZÀ-ÿ]+/g`), 0.8+ confidence to prevent false positives
- **AI Acknowledgment**: Notifies user when language is auto-switched ("I notice you're practicing French...")
- **Robust Word Counting**: Uses regex-based tokenization to count only alphabetic words, ignoring punctuation and numbers

**Storage Layer Improvements**:
- **Partial Update Safety**: `updateConversation` filters undefined values to preserve existing fields during partial updates
- **Field Preservation**: Ensures userName and language aren't lost when updating onboarding step

**Adaptive Multi-Phase Conversation System**:
Utilizes a three-phase approach for AI tutor interaction:
1.  **English Assessment (Messages 1-5)**: Assesses user proficiency and background in English.
2.  **Gradual Transition (Messages 6-11)**: Mixes target language with English, adapting ratio based on user performance.
3.  **Immersive Practice (Message 12+)**: Primarily uses the target language based on selected difficulty, with English support for complex concepts. Includes end-of-session reminder feature that naturally reminds students their vocabulary and grammar are automatically saved in menu sections when wrapping up.

**Conversation-to-Notes: Automatic Vocabulary Extraction**: AI automatically identifies and saves new vocabulary from conversations using OpenAI's structured output, integrating them into the Vocabulary flashcard system.
**Voice Chat Feature**: Real-time voice conversations using OpenAI Realtime API with a WebSocket proxy. Includes manual push-to-talk recording, visual feedback, and a toggle between text and voice modes. Simplified configuration for broader compatibility.
**Personalized Greetings**: AI tutor welcomes students by name at the start of each conversation. Detects first-time vs returning users and adjusts greeting accordingly ("Where would you like to begin today?" for new users, "Would you like to start where we ended last time?" for returning users).
**Animated Instructor Avatar**: Provides real-time visual feedback with idle, listening (voice chat), and speaking states, enhancing engagement.
**Full Application Implementation**: Includes AI chat, vocabulary flashcards, grammar exercises, conversation history with statistics, and progress tracking dashboard.

## External Dependencies

**Third-Party Libraries**:
-   **OpenAI API** (via Replit AI Integrations)
-   **Neon Database Serverless** (`@neondatabase/serverless`)
-   **Drizzle ORM**
-   **Radix UI**
-   **TanStack Query**
-   **Wouter**
-   **date-fns**
-   **Embla Carousel**

**Database Configuration**:
-   PostgreSQL database (configured via `DATABASE_URL`).
-   Drizzle Kit for migrations.
-   Connection pooling via `@neondatabase/serverless`.

**Asset Management**:
-   Google Fonts (Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono).
-   Static images in `attached_assets/generated_images/`.
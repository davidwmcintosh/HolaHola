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

**Adaptive Multi-Phase Conversation System**:
Utilizes a three-phase approach for AI tutor interaction:
1.  **English Assessment (Messages 1-5)**: Assesses user proficiency and background in English.
2.  **Gradual Transition (Messages 6-11)**: Mixes target language with English, adapting ratio based on user performance.
3.  **Immersive Practice (Message 12+)**: Primarily uses the target language based on selected difficulty, with English support for complex concepts.
**Conversation-to-Notes: Automatic Vocabulary Extraction**: AI automatically identifies and saves new vocabulary from conversations using OpenAI's structured output, integrating them into the Vocabulary flashcard system.
**Voice Chat Feature**: Real-time voice conversations using OpenAI Realtime API with a WebSocket proxy. Includes manual push-to-talk recording, visual feedback, and a toggle between text and voice modes. Simplified configuration for broader compatibility.
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
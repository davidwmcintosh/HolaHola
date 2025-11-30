# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises across nine languages. It offers personalized chat, flashcards, and grammar modules, adapting to individual user progress. The project aims to deliver personalized education using AI, expanding into institutional markets while adhering to ACTFL standards.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android builds via Capacitor. Key UI elements include voice interaction controls and a hint bar.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC). Stripe integration for subscriptions is managed by `stripe-replit-sync`.

### Feature Specifications
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers and tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management, student enrollment, curriculum systems, assignment workflows, and a Super Admin Backend with RBAC.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics. User learning preferences and ACTFL progress are stored.

**Voice Validation Architecture**: Uses a two-tier prevention approach with Gemini structured output and `franc-min` language detection.

**Voice TTS Pronunciation Architecture**: Utilizes Cartesia Sonic-3's custom phoneme syntax with MFA-style IPA for pronunciation correction.

**Subtitle System Architecture**: A 3-state subtitle system (`subtitleMode`: Off, Target, All) with karaoke-style word highlighting and server-side word timing estimation.

**Streaming Voice Mode Architecture**: A WebSocket-based progressive audio delivery system involving Deepgram STT, Gemini streaming, Cartesia WebSocket TTS, and progressive audio playback. Pedagogical integrations include content moderation, a "one-word rule" for beginners, background vocabulary extraction, and real-time ACTFL advancement tracking.

**Dynamic Streaming Greeting System**: New conversations trigger an AI-generated personalized greeting that is ACTFL-aware, history-aware, and context-aware.

**Conversation Tagging System**: An AI-powered topic tagging system for conversations and vocabulary, categorizing content into Subject, Grammar, and Function topics using Gemini.

**Language Hub (Primary Dashboard)**: The main landing page (`/`, `/dashboard`, `/review`) serves as a unified learning dashboard guiding students through prioritized learning tasks. It aggregates Daily Plan, Topic Deep Dives, Quick Stats, and Course Overview (in class mode).

**Course Overview Feature**: When in a class context, displays the full curriculum structure, including unit accordions, lesson status indicators, and navigation to start lessons.

**Syllabus-Aware Competency System**: Recognizes when students organically cover curriculum topics during conversations, enabling early completion. It uses a Competency Verification Service, tracks progress in `syllabusProgress` table, and provides student/teacher UIs for tracking and acknowledgment.

**Conversational Syllabus Navigation**: Students can ask the tutor about their class progress, assignments, and next lessons during voice or text conversations. A Curriculum Context Service builds context for AI tutor prompts, detecting syllabus-related questions and tutor switch requests.

**Unified Learning Filter System**: A cross-page filtering system (`LearningFilterContext`) for consistent content filtering across Review Hub, Vocabulary, Grammar, and Chat History. Filter settings are saved to localStorage.

**Usage & Credit System Architecture**: A comprehensive metering system for voice tutoring time. It uses `voiceSessions` and `usageLedger` tables, a `UsageService` for accounting, and integrates with backend guards and frontend components for credit management and display.

**Hour Package Purchase System**: Stripe-integrated one-time payment flow for independent learners, offering different package tiers and managing checkout/fulfillment via `stripeService`.

**Class Hour Package System**: Institutional credit allocation for teachers, using `classHourPackages` table for package management and automatic credit allocation upon class enrollment.

**Centralized Role-Based Access Control (RBAC)**: A hierarchical permission system using shared helpers in `shared/permissions.ts`:
- **admin** (Super Admin): Full access to all features including Administration section
- **developer**: Teacher + student permissions (can access Teaching section, NOT admin)
- **teacher**: Teaching features only (class management, curriculum, assignments)
- **student**: Learning features only (conversations, vocabulary, progress)

Permission helpers: `hasAdminAccess()`, `hasDeveloperAccess()`, `hasTeacherAccess()`, `hasStudentAccess()` are used consistently across frontend (sidebar, page guards) and backend (API route guards). Backend uses `requireRole('admin')` middleware for admin-only endpoints.

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
# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises across nine languages. It offers personalized chat, flashcards, and grammar modules that adapt to individual user progress, adhering to ACTFL standards. The project aims to deliver personalized education using AI, with ambitions to expand into institutional markets by offering features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android builds via Capacitor, including voice interaction controls and a hint bar. The sidebar navigation is organized into sections: Learning (Call Tutor), Library (Vocabulary, Grammar, Past Chats, Can-Do Progress), Resources (Find a Class, Cultural Tips, Chat Ideas), Teaching (My Classes, Class Creation Hub), and Administration (Command Center).

### Technical Implementations
The frontend is built with React and TypeScript (Vite), utilizing Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions is managed by `stripe-replit-sync`.

### Feature Specifications
LinguaFlow provides conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Personalized learning includes scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers, tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management with syllabus template browsing and class cloning, student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. The Class Creation Hub provides two creation paths: "Start from Template" (browse pre-built ACTFL-aligned syllabi with dynamic stats) and "Start from Scratch" (custom class creation). The Syllabus Builder enables teachers to customize class syllabi with drag-and-drop reordering, custom lesson creation, and lesson editing/removal. The ACTFL Standards Coverage panel provides real-time analysis of syllabus coverage with category breakdowns (Interpersonal, Interpretive, Presentational) and level-by-level Can-Do statement tracking. Developer tools include test account isolation, floating dev controls, and comprehensive usage analytics with test/production separation.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, storing user learning preferences and ACTFL progress. The voice architecture implements a two-tier validation system and utilizes Cartesia Pronunciation Dictionaries for server-side TTS pronunciation correction. A server-driven subtitle system with karaoke-style word highlighting and server-side word timing estimation is implemented. An English word filter system prevents common English words from appearing as target language vocabulary. A WebSocket-based progressive audio delivery system integrates Deepgram STT, Gemini streaming, and Cartesia WebSocket TTS for streaming voice mode. A dynamic streaming greeting system generates personalized, ACTFL-aware, history-aware, and context-aware greetings. An AI-powered conversation tagging system categorizes conversations and vocabulary. A Syllabus-Aware Competency System tracks student progress against syllabus topics. A unified learning filter system provides consistent content filtering. A comprehensive metering system for voice tutoring time is integrated with Stripe. A class-specific balance system manages isolated hour pools. Centralized Role-Based Access Control (RBAC) defines hierarchical permissions (admin > developer > teacher > student). A hybrid grammar system combines conversational practice with targeted instruction. A syllabus content system provides pre-built syllabi across 9 languages (21 syllabi, 116 units, 524 lessons via `/api/curriculum/stats`). A class type taxonomy system categorizes classes. A tutor freedom level system controls AI tutor behavior per class. A unified ACTFL assessment system dynamically assesses learner proficiency. A placement assessment system verifies proficiency for class enrollments. A Command Center (`/admin`) provides a unified tab-based admin experience consolidating 7 admin pages with role-based tab visibility for managing users, classes, analytics, and developer tools. The Classes tab includes syllabus editing capabilities, allowing admins/developers to manage syllabi for any class via the integrated Syllabus Builder. A developer usage analytics dashboard offers comprehensive analytics and credit management for testing with test/production separation via `isTestAccount` and `isTestSession` flags.

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
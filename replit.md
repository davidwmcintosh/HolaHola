# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application providing interactive conversation practice, vocabulary building, and grammar exercises in nine languages. It offers personalized chat, flashcards, and grammar modules that adapt to individual user progress, adhering to ACTFL standards. The project aims to deliver personalized education using AI, with ambitions to expand into institutional markets by offering features like teacher class management, student enrollment, and syllabus systems.

## User Preferences
Preferred communication style: Simple, everyday language.
Terminology standard: Use "Syllabus" in all user-facing text (database tables remain "curriculum*" for safety).

---

## Core Design Philosophy

> **"We don't make teaching decisions. We provide tools. The tutor teaches."**

This principle guides all feature development in LinguaFlow:

1. **The AI Tutor is the Teacher** - We build instruments, not scripts. The LLM decides how to teach based on what's happening in the lesson.

2. **Provide Tools, Not Constraints** - Instead of defining rigid behaviors ("show subtitles when X"), we give the tutor flexible capabilities it can use as needed.

3. **Trust the Tutor's Judgment** - The AI reads the student and adapts. It decides when to slow down, emphasize, show visual aids, or keep things purely auditory.

4. **Simplify by Delegating** - Complex logic for "when should X happen?" becomes simple: give the tutor the tool and let it decide.

**This philosophy applies to:**
- Visual teaching aids (whiteboard/subtitles) - Tutor decides what to show
- Pacing and repetition - Tutor reads the student and adjusts
- Difficulty progression - Tutor navigates based on what's working
- Encouragement and feedback - Tutor knows when to praise, push, or pause
- Topic selection - Tutor guides the conversation naturally

### Role-Model Persona

> **"We define who the Tutor IS, not what the Tutor does."**
>
> **"A good teacher molds the student, not the other way around."**

The tutor's personality is **fixed** - it does not adapt to match the student. The tutor is a role model who consistently demonstrates (within the confines of syllabi and ACTFL standards):

**Fixed Personality Traits (immutable):**
- **Friendly** - Warm, approachable, creates a safe learning environment
- **Encouraging** - Celebrates progress, builds confidence, never discourages
- **Mannered** - Polite, respectful, models proper etiquette
- **Light-hearted** - Uses gentle humor, keeps learning enjoyable
- **Morally grounded** - Models good values, encourages integrity

**Adaptive Teaching Behaviors (tutor decides):**
- Pacing and repetition speed
- When to challenge vs. support
- How directly to correct mistakes
- Which modalities to use (audio, visual, drills)
- Difficulty level adjustments
- Topic selection and transitions

**What this means in practice:**
- A rude student gets gentle modeling of better behavior, not a rude tutor
- A nervous student gets calm encouragement, not a nervous tutor
- The tutor maintains professionalism regardless of student behavior
- "Tutor freedom levels" control *coaching style*, not personality

**Guardrails:**
- System prompts define the persona as immutable
- User/student attempts to change tutor demeanor are gracefully declined
- Teachers can adjust coaching aggressiveness, not core personality

### Context-Driven Proficiency System

> **"Students don't self-select their level. The tutor figures it out."**

Proficiency levels are now derived from context rather than user self-selection during onboarding.

**Why no self-selection:**
- "I'm a beginner" is arbitrary - people are bad at assessing their own language skills
- Creates anxiety ("am I really intermediate?")
- Leads to misaligned expectations and frustration
- Real teachers assess students; they don't ask students to label themselves

**How levels are determined:**

| Context | Proficiency Source | Example |
|---------|-------------------|---------|
| Class-enrolled student | Class's `expectedActflMin` field | Spanish 1 → novice_low → beginner |
| Self-directed learner (assessed) | ACTFL placement assessment result | intermediate_mid → intermediate |
| Self-directed learner (new) | Safe default | beginner (tutor adapts from there) |

**Mismatch Detection:**
The tutor is instructed to recognize when actual ability differs from expected level:
- Signs student is MORE advanced: quickly masters content, uses advanced vocabulary unprompted
- Signs student is LESS advanced: struggles with basics, needs repeated explanations
- Tutor adapts in real-time (within freedom level constraints)
- Guided mode: adjust pace only (syllabus is authoritative)
- Other modes: can adjust content within ±1 ACTFL tier

**Key schema field:**
- `teacherClasses.expectedActflMin` - The ACTFL floor for a class (e.g., "novice_low" for Spanish 1)
- Used to derive initial difficulty assumption for enrolled students
- Server-side: `actflToDifficulty()` helper maps ACTFL levels to beginner/intermediate/advanced

**Removed Components:**
- `DifficultySelector` - User self-selection (removed from dashboard and onboarding)
- `DifficultyIndicator` - Legacy difficulty display (unused, removed)
- Onboarding no longer asks "are you beginner/intermediate/advanced?"

### Tutor Whiteboard System (Phase 1 Complete)

The AI tutor now has a "whiteboard" - a flexible visual channel it can use strategically to teach.

**Philosophy:**
- Real language learning trains the EAR, not the eye
- Visual aids should be strategic (tutor decides, not student)
- A real tutor decides when to write on the board

**How it works:**
1. Tutor includes optional markup in responses: `[WRITE]Hola[/WRITE]`
2. Server strips markup before TTS (audio stays natural)
3. Client renders marked content as animated visual teaching aids
4. Content persists across messages until tutor sends `[CLEAR]`

**Available tools for the tutor:**
- `[WRITE]...[/WRITE]` - Display text on the whiteboard
- `[PHONETIC]...[/PHONETIC]` - Show pronunciation guide
- `[COMPARE]...[/COMPARE]` - Show correction (e.g., "gracias NOT grassias")
- `[CLEAR]` - Wipe the board
- `[HOLD]` - Keep current content visible
- No markup = audio only (trains the ear)

**When the tutor should use each:**
- NEW vocabulary → WRITE it (students need to see spelling)
- Pronunciation help → PHONETIC breakdown
- Common mistakes → COMPARE correct vs incorrect
- Drilling/review → Keep it auditory
- Simple exchanges → No visual needed

**Key files:**
- `shared/whiteboard-types.ts` - Types, markup parser, strip function
- `client/src/hooks/useWhiteboard.ts` - State management hook
- `client/src/components/Whiteboard.tsx` - UI component with animations
- `server/system-prompt.ts` - Instructions for tutor (streaming mode section)

**Implementation status:** Phase 1 complete. Markup parsing, TTS integration, and UI rendering functional.

---

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android builds via Capacitor, including voice interaction controls and a hint bar. Sidebar navigation organizes content into Learning, Library, Resources, Teaching, and Administration sections. The project emphasizes that the AI Tutor is the teacher, providing tools rather than constraints, and trusting the tutor's judgment. The tutor-controlled "whiteboard" system (Phase 1 complete) allows the LLM to use markup (`[WRITE]`, `[PHONETIC]`, `[COMPARE]`, `[CLEAR]`, `[HOLD]`) for strategic visual teaching aids that display as animated modal overlays during voice chat.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), utilizing Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC), and Stripe integration for subscriptions is managed by `stripe-replit-sync`.

### Feature Specifications
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Personalized learning includes scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers, tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management with syllabus template browsing and class cloning, student enrollment, syllabus systems, assignment workflows, and a unified Command Center with RBAC. A Syllabus Builder enables teachers to customize syllabi with drag-and-drop reordering, custom lesson creation, and editing, with an ACTFL Standards Coverage panel providing real-time analysis. Developer tools include test account isolation, floating dev controls, and comprehensive usage analytics. Self-directed learners can customize their AI tutor's teaching style per language in Settings with four flexibility levels; class chats use the teacher's setting. Drill-based lessons for rote content with multiple drill modes (`listen_repeat`, `number_dictation`, `translate_speak`, `matching`, `fill_blank`) are supported, utilizing Google Cloud TTS for batch audio synthesis.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, storing user learning preferences and ACTFL progress. The voice architecture implements a two-tier validation system and utilizes Cartesia Pronunciation Dictionaries for TTS correction. The `StreamingVoiceClient` singleton MUST be stored on `window.__streamingVoiceClient`. **[LEGACY - To be replaced by Tutor Whiteboard System]** An ACTFL-level-aware subtitle synchronization system (`client/src/lib/subtitlePolicies.ts`) implements proficiency-specific timing policies: Novice (300ms preview, progressive word reveal); Intermediate (150ms, full sentence display); Advanced (0ms delay, mode convergence). The audio player (`client/src/lib/audioUtils.ts`) anchors subtitle highlighting to `audio.currentTime`. Timing telemetry logs word-level drift for diagnostics. A server-driven subtitle system with karaoke-style word highlighting uses native Cartesia word-level timestamps via WebSocket API (`add_timestamps: true`), with automatic fallback to bitrate-based estimation. The `sentence_ready` architecture ensures audio playback starts only after word timings arrive. A principled target language extraction system uses bold-only extraction plus unambiguous foreign character detection. A WebSocket-based progressive audio delivery system integrates Deepgram STT, Gemini streaming, and Cartesia WebSocket TTS. Dynamic streaming greetings are personalized, ACTFL-aware, history-aware, and context-aware. An AI-powered conversation tagging system categorizes conversations and vocabulary. A Syllabus-Aware Competency System tracks student progress against syllabus topics. A unified learning filter system provides consistent content filtering. A comprehensive metering system for voice tutoring time is integrated with Stripe, with a class-specific balance system. Centralized Role-Based Access Control (RBAC) defines hierarchical permissions. A hybrid grammar system combines conversational practice with targeted instruction. A syllabus content system provides pre-built syllabi across 9 languages. A class type taxonomy system categorizes classes. A tutor freedom level system controls AI tutor behavior per class. A unified ACTFL assessment system dynamically assesses learner proficiency. A placement assessment system verifies proficiency for class enrollments. A Command Center (`/admin`) provides a unified tab-based admin experience with role-based visibility for managing users, classes, analytics, and developer tools, including syllabus editing. A developer usage analytics dashboard offers comprehensive analytics and credit management for testing.

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

## Future Tasks

- **Persona Guardrails Testing Document** - Create comprehensive QA test cases for the Role-Model Persona system:
  - Test guardrail responses to persona-change requests ("be more strict", "act angry")
  - Verify freedom level changes affect coaching style, not personality
  - Test tutor behavior with rude/nervous students (should model, not match)
  - Validate personality preset changes (warm/calm/energetic) only affect voice emotion
  - Edge case: persistent attempts to change persona
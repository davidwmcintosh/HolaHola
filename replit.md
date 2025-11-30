# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed to provide interactive conversation practice, vocabulary building, and grammar exercises across nine languages. It offers personalized chat, flashcards, and grammar modules that adapt to individual user progress. The project aims to deliver personalized education using AI, adhering to ACTFL standards, with ambitions to expand into institutional markets.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses a mobile-first, responsive design with Shadcn/ui (Radix UI) and Tailwind CSS, following Material Design principles. It supports light/dark modes, PWA features, and native iOS/Android builds via Capacitor. Key UI elements include voice interaction controls and a hint bar.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and React Context with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, exposing a RESTful API. Data is stored using Drizzle ORM for PostgreSQL. AI integration for text chat uses Gemini 2.5 Flash. Authentication is handled by Replit Auth (OIDC). Stripe integration for subscriptions is managed by `stripe-replit-sync`.

### Feature Specifications
LinguaFlow provides conversational onboarding, an adaptive multi-phase conversation system, and AI-suggested topics. It features a streaming-only voice pipeline (Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS) with push-to-talk recording and smart language handling. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are displayed with caching. The application supports various subscription tiers, tracks atomic voice message usage, and tracks student proficiency using ACTFL World-Readiness Standards. Institutional features include teacher class management, student enrollment, curriculum systems, assignment workflows, and a Super Admin Backend with RBAC.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics. User learning preferences and ACTFL progress are stored.

**Voice Architecture**: Includes a two-tier prevention for validation and utilizes Cartesia Pronunciation Dictionaries for server-side TTS pronunciation correction (with MFA-style IPA as inline fallback). A 3-state subtitle system with karaoke-style word highlighting and server-side word timing estimation is also implemented.

**Cartesia Pronunciation Dictionary System** (IMPORTANT):
LinguaFlow uses Cartesia's server-side pronunciation dictionaries to ensure foreign language words are pronounced correctly by the AI tutor. This is a critical system for voice quality.

How it works:
- Pronunciation rules (IPA phonemes) for common words in each language are stored on Cartesia's servers as "dictionaries"
- When the AI speaks, we tell Cartesia which dictionary to use based on the target language
- Cartesia automatically applies correct pronunciations without us modifying the text

Key files:
- `server/scripts/setup-cartesia-dictionaries.ts` - Script to upload/update dictionaries to Cartesia
- `server/services/cartesia-streaming.ts` - TTS service that references dictionaries
- `server/services/tts-service.ts` - Contains `MFA_IPA_PRONUNCIATIONS` map with all pronunciation rules

Environment variable:
- `CARTESIA_PRONUNCIATION_DICT_IDS` - JSON map of language → dictionary ID (auto-populated by setup script)
- Example: `{"spanish":"pdict_xxx","french":"pdict_yyy",...}`

Currently configured languages (8 dictionaries):
- Spanish (53 words), French (10), German (9), Italian (8), Portuguese (8), Japanese (7), Mandarin Chinese (5), Korean (4)

To add/update pronunciations:
1. Edit the `MFA_IPA_PRONUNCIATIONS` map in `server/services/tts-service.ts`
2. Run `npx tsx server/scripts/setup-cartesia-dictionaries.ts` to upload changes
3. The script will delete old dictionaries and create new ones with the updated words

Fallback behavior:
- If no dictionary exists for a language, the system falls back to inline phoneme markers (`<<phonemes>>`)
- This ensures pronunciation correction still works for any language

**English Word Filter System** (IMPORTANT):
Prevents common English words from incorrectly appearing as target language vocabulary in subtitles and vocabulary extraction.

The problem:
- When the AI tutor speaks mixed English/Spanish like "Good morning! Say buenos días"
- The system extracts vocabulary words to display as subtitles
- Without filtering, English words like "morning", "doing", "I'm" would appear as Spanish vocabulary

The solution:
- A comprehensive blocklist of 230+ common English words filters out false positives
- Words are checked against this list before being treated as target language vocabulary

Key file:
- `server/text-utils.ts` → `ENGLISH_FILTER` Set

Word categories in the filter:
- Contractions: I'm, don't, won't, can't, I'll, you're, etc.
- Common verbs: doing, going, having, making, trying, etc.
- Time words: morning, afternoon, evening, today, tomorrow, etc.
- Pronouns: myself, yourself, someone, anyone, etc.
- Connectors: however, therefore, although, because, etc.
- Common nouns: thing, something, nothing, everything, etc.

To add words to the filter:
1. Edit `server/text-utils.ts`
2. Add words to the `ENGLISH_FILTER` Set
3. Restart the server

When to add words:
- If you see English words appearing in the target language subtitles during voice sessions
- These are false positives that need to be filtered out

**Streaming Voice Mode**: A WebSocket-based progressive audio delivery system integrating Deepgram STT, Gemini streaming, Cartesia WebSocket TTS, and progressive audio playback. Pedagogical integrations include content moderation, a "one-word rule," background vocabulary extraction, and real-time ACTFL advancement tracking.

**Dynamic Streaming Greeting System**: New conversations trigger an AI-generated personalized greeting that is ACTFL-aware, history-aware, and context-aware.

**Conversation Tagging System**: An AI-powered topic tagging system for conversations and vocabulary, categorizing content into Subject, Grammar, and Function topics using Gemini.

**Language Hub (Primary Dashboard)**: The main landing page (`/`, `/dashboard`, `/review`) serves as a unified learning dashboard, guiding students through prioritized learning tasks. It aggregates Daily Plan, Topic Deep Dives, Quick Stats, and Course Overview (in class mode).

**Syllabus-Aware Competency System**: Recognizes when students organically cover curriculum topics during conversations, enabling early completion. It uses a Competency Verification Service, tracks progress in `syllabusProgress` table, and provides student/teacher UIs for tracking and acknowledgment. Students can also navigate the syllabus conversationally with the AI tutor.

**Unified Learning Filter System**: A cross-page filtering system (`LearningFilterContext`) for consistent content filtering across Review Hub, Vocabulary, Grammar, and Chat History. Filter settings are saved to localStorage.

**Usage & Credit System Architecture**: A comprehensive metering system for voice tutoring time using `voiceSessions` and `usageLedger` tables, and a `UsageService` for accounting. It integrates with backend guards and frontend components for credit management and display. This includes Stripe-integrated one-time payment hour packages for independent learners and institutional credit allocation for teachers via class hour packages.

**Class-Specific Balance System**: Implements isolated hour pools per class with dual-source consumption: class enrollment allocations and purchased hours (flexible). Credit checks prioritize class balance, then purchased hours, with all usage tracked in `usageLedger`.

**Centralized Role-Based Access Control (RBAC)**: A hierarchical permission system using shared helpers in `shared/permissions.ts`. Roles include Student, Teacher, Developer, and Admin, with higher roles inheriting permissions from lower ones. Admin roles have exclusive access to administration features.

**Hybrid Grammar System**: Combines conversational practice with targeted explicit instruction. It uses three database tables: `grammarCompetencies` (38 ACTFL-aligned topics), `grammarErrors` (error tracking), and `userGrammarProgress` (mastery tracking). API routes provide competencies by language and exercises by competency. The Grammar Hub page offers a topic browser and practice drills.

**Curriculum Content System**: Provides pre-built curricula across 9 languages, comprising 21 courses, 116 units, and 524 lessons. Lesson types include Conversation, Vocabulary, Grammar, and Cultural Exploration, with visual indicators and ACTFL-aligned progression.

**Class Type Taxonomy System**: A marketing-first class categorization system with 4 preset types (ACTFL-Led, Executive/Business, Quick Refresher, Travel & Culture) and admin-extensible custom types. Features include:
- `classTypes` table with preset protection (`isPreset` flag prevents deletion of core types)
- `teacherClasses.classTypeId` for class categorization and `isFeatured`/`featuredOrder` for marketing
- Public catalogue at `/student/join-class` with featured carousel, class type filters, and language filters
- Admin Class Types management page (`/admin/class-types`) for CRUD operations
- Admin Classes page with featured toggle, public catalogue toggle, class type selector, and tutor freedom level selector
- Business rules: Featured classes must be public; setting a class to private automatically un-features it
- Strict Zod validation with `.strict()` on admin class updates to prevent unauthorized field modifications

**Tutor Freedom Level System**: Controls AI tutor behavior per class with 4 levels:
- `guided`: Strictly follows syllabus, redirects off-topic conversations
- `flexible_goals` (default): Students choose topics within learning objectives
- `open_exploration`: Student-led conversation with gentle ACTFL nudges
- `free_conversation`: Maximum practice freedom, maintains content moderation
- `teacherClasses.tutorFreedomLevel` column with enum type
- Admin UI selector in `/admin/classes` for configuring per-class AI behavior
- All levels maintain morality/modesty guidelines regardless of flexibility setting

**Unified ACTFL Assessment System**: ACTFL proficiency serves as the single source of truth for learner levels, replacing the dual onboarding/ACTFL system:
- User schema fields: `actflLevel` (proficiency), `actflAssessed` (AI-verified vs cold-start), `assessmentSource` (onboarding_hint, ai_conversation, placement_test, teacher_override), `lastAssessmentDate`
- Onboarding difficulty selection serves as "cold-start hint" that seeds initial ACTFL level (beginner→novice_low, intermediate→intermediate_low, advanced→advanced_low)
- AI tutor dynamically assesses and updates ACTFL level through conversation
- Class schema fields: `targetActflLevel` (class goal), `classLevel` (1-4 tier), `requiresPlacementCheck` (adaptive assessment for Level 2+ enrollees)
- Freedom levels bind conversational complexity: guided=exact ACTFL, flexible_goals/open=±1 tier, free=any tier with scaffolding
- System prompt includes freedom-aware ACTFL constraints with automatic complexity clamping

**Placement Assessment System**: Adaptive proficiency verification for Level 2+ class enrollments:
- `PlacementAssessmentService` (`server/services/placement-assessment-service.ts`) analyzes first voice session conversation
- Enrollment schema fields: `placementChecked` (boolean), `placementActflResult` (assessed level), `placementDelta` (difference from self-selected), `placementDate`
- Assessment triggers automatically at end of first voice session for classes with `requiresPlacementCheck=true`
- Uses Gemini AI to analyze conversation complexity, vocabulary usage, and grammatical accuracy
- Updates user's `actflLevel`, sets `actflAssessed=true`, and `assessmentSource='placement_test'`
- Teacher dashboard displays placement status badges per student:
  - "Awaiting Placement" (outline) - first session not yet completed
  - "Level Verified" (secondary) - AI confirms self-selected level
  - "Overestimated by X" (destructive) - student selected too high
  - "Underestimated by X" (default) - student selected too low
- Tooltips show detailed ACTFL information including current level, placement result, and AI verification status

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions (2.5 Flash, 2.5 Pro) and voice chat LLM (2.5 Flash, 1.5 Pro).
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
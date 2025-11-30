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

**Centralized Role-Based Access Control (RBAC)**: A hierarchical permission system using shared helpers in `shared/permissions.ts`.

**Hybrid Grammar System**: A research-backed grammar instruction approach combining conversational practice with targeted explicit instruction. Uses three database tables: `grammarCompetencies` (38 ACTFL-aligned topics), `grammarErrors` (error tracking for micro-coaching), and `userGrammarProgress` (mastery tracking). API routes: `/api/grammar/competencies?language=X` returns competencies organized by ACTFL level; `/api/grammar/exercises?language=X&competencyId=Y` returns practice exercises. The Grammar Hub page (`/grammar`) provides topic browser with ACTFL organization, competency cards with progress indicators, and practice drills.

**Curriculum Content System**: Pre-built curricula across 9 languages (Spanish, French, German, Italian, Japanese, Korean, Mandarin, Portuguese, English) with 21 courses containing 524 lessons across 116 units. Four lesson types with visual indicators:
- **Conversation** (green, MessageSquare icon) - 338 lessons: AI-guided conversation practice
- **Vocabulary** (blue, Languages icon) - 90 lessons: Targeted vocabulary building
- **Grammar** (purple, PencilLine icon) - 60 lessons: Explicit grammar instruction (2-3 per course)
- **Cultural Exploration** (amber, Globe icon) - 36 lessons: Cultural immersion and context

Curriculum progression: Level 1/2 courses (Novice) include 3 grammar lessons; Level 3/4 courses (Intermediate) include 2 grammar lessons. Grammar topics are ACTFL-aligned and language-specific (e.g., gender agreement for Romance languages, particles for Japanese/Korean, measure words for Mandarin).

---

## Role-Based Access Control (RBAC) Documentation

### Role Hierarchy Overview

The system implements a hierarchical permission model where higher roles inherit capabilities from lower roles:

```
admin (Super Admin)
   ├── All developer permissions
   ├── All teacher permissions  
   ├── All student permissions
   └── Administration features (exclusive)

developer
   ├── All teacher permissions
   └── All student permissions

teacher
   └── Teaching features only

student
   └── Learning features only
```

### Role Privileges Matrix

| Feature Category | Student | Teacher | Developer | Admin |
|-----------------|---------|---------|-----------|-------|
| **Learning Features** |||||
| Voice conversations | Yes | Yes | Yes | Yes |
| Text chat | Yes | Yes | Yes | Yes |
| Vocabulary flashcards | Yes | Yes | Yes | Yes |
| Grammar exercises | Yes | Yes | Yes | Yes |
| Progress tracking | Yes | Yes | Yes | Yes |
| ACTFL assessments | Yes | Yes | Yes | Yes |
| Cultural tips | Yes | Yes | Yes | Yes |
| Review hub | Yes | Yes | Yes | Yes |
| Class enrollment (as student) | Yes | Yes | Yes | Yes |
| **Teaching Features** |||||
| Teacher Dashboard | No | Yes | Yes | Yes |
| Class Management | No | Yes | Yes | Yes |
| Create/Edit Classes | No | Yes | Yes | Yes |
| Student Enrollment | No | Yes | Yes | Yes |
| Curriculum Library | No | Yes | Yes | Yes |
| Curriculum Builder | No | Yes | Yes | Yes |
| Assignment Creation | No | Yes | Yes | Yes |
| Assignment Grading | No | Yes | Yes | Yes |
| Student Progress Reports | No | Yes | Yes | Yes |
| **Administration Features** |||||
| Admin Dashboard | No | No | No | Yes |
| User Management | No | No | No | Yes |
| Role Assignment | No | No | No | Yes |
| All Classes Overview | No | No | No | Yes |
| System Reports | No | No | No | Yes |
| Voice Console (TTS Config) | No | No | No | Yes |
| Audit Logs | No | No | No | Yes |
| User Impersonation | No | No | No | Yes |
| Hour Package Management | No | No | No | Yes |

### Sidebar Section Visibility

| Sidebar Section | Student | Teacher | Developer | Admin |
|-----------------|---------|---------|-----------|-------|
| Learning (Voice, Chat, Review, Vocabulary, Grammar) | Yes | Yes | Yes | Yes |
| Teaching (Dashboard, Classes, Curriculum, Assignments) | No | Yes | Yes | Yes |
| Administration (Dashboard, Users, Classes, Reports, Voice Console) | No | No | No | Yes |

### API Endpoint Access

**Student Endpoints** (`/api/*` - general learning):
- All authenticated users can access

**Teacher Endpoints** (`/api/teacher/*`):
- Uses `hasTeacherAccess()` helper function
- Accessible by: teacher, developer, admin roles

**Admin Endpoints** (`/api/admin/*`):
- Uses `requireRole('admin')` middleware
- Accessible by: admin role only

### Permission Helper Functions

Located in `shared/permissions.ts`:

```typescript
hasAdminAccess(role)     // Returns true for: admin
hasDeveloperAccess(role) // Returns true for: admin, developer
hasTeacherAccess(role)   // Returns true for: admin, developer, teacher
hasStudentAccess(role)   // Returns true for: admin, developer, student
```

### Files Modified for RBAC Implementation

**Core Permission System:**
- `shared/permissions.ts` - Centralized permission helper functions

**Frontend Guards & Navigation:**
- `client/src/components/app-sidebar.tsx` - Sidebar section visibility
- `client/src/lib/auth.ts` - useUser hook with role flags

**Frontend Teacher Pages (use `hasTeacherAccess`):**
- `client/src/pages/teacher-dashboard.tsx`
- `client/src/pages/curriculum-library.tsx`
- `client/src/pages/curriculum-builder.tsx`
- `client/src/pages/class-management.tsx`
- `client/src/pages/assignment-grading.tsx`

**Frontend Admin Pages (use `RoleGuard allowedRoles={['admin']}`):**
- `client/src/pages/admin/Dashboard.tsx`
- `client/src/pages/admin/Users.tsx`
- `client/src/pages/admin/Classes.tsx`
- `client/src/pages/admin/Reports.tsx`
- `client/src/pages/admin/VoiceConsole.tsx`

**Backend Route Guards:**
- `server/routes.ts` - Teacher endpoints use `hasTeacherAccess()`, admin endpoints use `requireRole('admin')`
- `server/middleware/rbac.ts` - Middleware functions `requireRole()`, `allowRoles()`, `loadAuthenticatedUser()`

### Implementation Notes

1. **Hierarchical Inheritance**: The `requireRole()` middleware uses a numeric hierarchy (student=0, teacher=1, developer=2, admin=3) to allow higher roles automatic access to lower-level features.

2. **Frontend Consistency**: All teacher pages import and use `hasTeacherAccess()` from `@shared/permissions` to ensure developers and admins can access teaching features.

3. **Admin Isolation**: Admin features are strictly limited to the admin role - developers cannot access administration features.

4. **RoleGuard Component**: Frontend pages use `<RoleGuard allowedRoles={['admin']}>` for admin-only pages, which redirects unauthorized users.

---

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
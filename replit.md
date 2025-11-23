# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application offering interactive conversation practice, vocabulary building, and grammar exercises across 9 target languages. It leverages AI for personalized chat, flashcards, and grammar modules, adapting to individual user progress. The project aims to capitalize on the educational technology market by supporting multiple languages and difficulty levels, with explanations available in any native language.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend employs a mobile-first responsive design using Shadcn/ui (Radix UI base) with Tailwind CSS, adhering to Material Design principles. It supports light/dark mode, features a two-column desktop layout and a single-column mobile layout. Key UI elements include a "Voice Learning" button, a "Type instead" option, and a hint bar promoting voice interaction. Inter is used for UI text, and JetBrains Mono for code/phonetic content. PWA features are integrated, including offline caching and home screen installation. Capacitor is configured for native iOS and Android builds, sharing 100% of the web codebase.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and the React Context API with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, providing a RESTful API. Data is stored using an abstract `IStorage` interface with Drizzle ORM for PostgreSQL. AI integration for text chat completions utilizes Gemini 2.5 Flash (via Replit's AI Integrations). Session management uses `connect-pg-simple` with a PostgreSQL session store. Authentication is handled by Replit Auth (OIDC), supporting email/password and social logins, with WebSocket connections authenticated via server-side session validation. Stripe integration for subscription management is managed by `stripe-replit-sync`.

**Form Architecture**: All institutional forms follow a standardized pattern using shadcn Form components with react-hook-form and zodResolver for validation. Each form extends the appropriate insertSchema from shared/schema.ts, ensuring type safety and consistency between frontend and backend. Forms use controlled FormField components rather than useState for field management, with proper error handling via FormMessage. Number and date inputs use Zod's coercion and transformation features for robust validation.

**Security Architecture**: Multi-layered security with backend role-based authorization on all API endpoints and frontend route guards via the ProtectedRoute component. Teacher routes require isTeacher flag, student routes require enrollment verification. All mutations invalidate appropriate query caches to maintain data consistency.

### Feature Specifications
LinguaFlow provides conversational onboarding, an adaptive multi-phase conversation system for gradual immersion, and user agency allowing AI to suggest topics requiring user confirmation. A production-stable REST-based voice pipeline (Deepgram Nova-3 STT → Gemini → Google Cloud TTS) supports push-to-talk recording and smart language handling, delivering fast text-only responses with background enrichment for vocabulary and image generation. Content guardrails ensure appropriate learning material. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are intelligently displayed with caching. The application supports various subscription tiers (Free, Basic, Pro, Institutional) with differing features and AI model access, along with atomic voice message usage tracking. Both voice and text chat share a unified architecture for consistent instructions and context, with AI-generated conversation titles. The system tracks student proficiency using ACTFL World-Readiness Standards (Novice Low → Distinguished) and integrates ACTFL Can-Do Statements for self-assessment, with AI system prompts enhanced to align with the learner's current ACTFL level. Features like Resume Conversations, Smart Search, and AI-Powered Practice Suggestions leverage Gemini's 1M context window for enhanced learning continuity. A robust backend for institutional features is implemented for teacher class management, student enrollment, curriculum systems, assignment workflows, submission & grading, and comprehensive security architecture.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, all linked via `userId`. Stripe data is synced to a PostgreSQL `stripe` schema via webhooks. User learning preferences like `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `actflLevel`, and `onboardingCompleted` are stored. The database schema includes ACTFL proficiency level tracking across relevant tables. Institutional features include CanDoStatements, StudentCanDoProgress, CurriculumPaths, TeacherClasses, and Assignments tables. A PWA install prompt is displayed.

### Institutional Features Implementation

**Backend Architecture (32 Storage Methods, 29 API Endpoints)**:
- **Teacher Features**: Class creation/management, student enrollment, assignment creation, grading workflows
- **Student Features**: Class joining via code, assignment submission, progress tracking
- **Curriculum Management**: Hierarchical path/unit/lesson structure with ordering
- **Authorization**: Role-based access control on all endpoints (teacher/student verification)

**Frontend Pages (6 Complete Forms)**:
1. **Teacher Dashboard** (`/teacher/dashboard`): Class creation form with name, subject, language, description fields. Uses ProtectedRoute (isTeacher). Displays teacher's classes with student counts and quick actions.

2. **Class Management** (`/teacher/classes/:id`): Student roster, assignment list with create/grade actions. Links to Assignment Creator with pre-selected classId.

3. **Assignment Creator** (`/teacher/assignments/create`): Full 8-field form (class, title, description, instructions, type, maxScore, dueDate, isPublished). Uses z.coerce.number() for maxScore validation (0-1000), datetime-local input with ISO string transformation for dueDate. Form.reset() on success.

4. **Assignment Grading** (`/teacher/assignments/:id/grade`): Per-student grading interface with score input (validated against maxScore), feedback textarea, submission status. Updates trigger cache invalidation for student views.

5. **Student Join Class** (`/student/join-class`): Single-field form for 6-character class code with uppercase transformation and validation. Creates enrollment record on success.

6. **Student Assignments** (`/student/assignments`): Filtered by enrolled classes, submission dialog with content textarea and optional file attachment field (currently text-based). Shows assignment details, due dates, submission status.

7. **Curriculum Builder** (`/teacher/curriculum`): Three-level hierarchy management:
   - **Path Dialog**: name, description, language (8 options), targetLevel (beginner/intermediate/advanced), isPublished toggle
   - **Unit Dialog**: name, description, auto-calculated orderIndex
   - **Lesson Dialog**: name, description, content (6-row textarea), auto-calculated orderIndex
   Each dialog uses proper form validation with FormMessage error display.

**Form Pattern (Standardized Across All Pages)**:
```typescript
// Schema extends insertSchema from shared/schema.ts
const formSchema = insertXSchema.extend({
  optionalField: z.string().optional(),
  numberField: z.coerce.number().min(0).max(1000),
});

// useForm with zodResolver
const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: { /* ... */ },
});

// Mutation with typed data and cache invalidation
const mutation = useMutation({
  mutationFn: async (data: FormValues) => apiRequest(/* ... */),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: [/* ... */] });
    form.reset();
    toast({ /* ... */ });
  },
});

// Form submission
<Form {...form}>
  <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    <FormField control={form.control} name="fieldName" render={/* ... */} />
  </form>
</Form>
```

**Security Implementation**:
- **Backend**: All `/api/teacher/*` routes verify `req.user.isTeacher`, all `/api/student/*` routes verify enrollment
- **Frontend**: `ProtectedRoute` component wraps teacher pages, checks user.isTeacher, redirects to `/` if unauthorized
- **Cache Coherence**: Mutations use hierarchical query keys (`['/api/classes', classId, 'assignments']`) for proper invalidation

**Data Flow**:
1. User action triggers form submission with validated data
2. Mutation sends typed request to backend API
3. Backend verifies authorization, performs CRUD via storage interface
4. Success triggers query invalidation and form reset
5. UI updates automatically via TanStack Query

## Recent Enhancements (November 2025)

### Pre-Built Curriculum Library
- **840+ hours** of ACTFL-aligned curriculum content
- **Spanish 1-4**: Complete high school sequence (600 hours) aligned to Novice Low → Intermediate High
- **French 1-3**: Comprehensive sequence (240 hours) aligned to Novice Low → Intermediate Mid
- Each path includes units (thematic organization), lessons (individual class sessions), and curriculum metadata
- Teacher UI for browsing and assigning curriculum to classes
- Curriculum seeding via `server/curriculum-seed.ts`

### Enhanced Reporting System
Three comprehensive report types with CSV export:
1. **Student Progress Report**: Individual proficiency trajectory, Can-Do achievements, recent activity, personalized recommendations
2. **Class Summary Report**: Proficiency distribution, engagement metrics, top performers, students needing support, assignment completion stats
3. **Parent/Guardian Report**: Student-friendly overview of progress, achievements, and areas of focus

Implementation:
- `server/reporting-service.ts`: Report generation logic
- API endpoints: `/api/reports/student/:id`, `/api/reports/class/:id`, `/api/reports/parent`
- CSV export for all report types

### Deferred Integrations (Pending External OAuth Setup)
- **Google Classroom**: Requires OAuth 2.0 client credentials (see `GOOGLE_CLASSROOM_SETUP.md`)
- **Canvas/Clever LMS**: Documented in `future-features.md`
- **IPA Assessments**: Documented as planned feature in `docs/institutional-standards-integration.md`

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions (via Replit AI Integrations). Uses Gemini 2.5 Flash and Gemini 2.5 Pro.
-   **Deepgram API**: For voice STT using Nova-3 model with auto-detect mode.
-   **Google Cloud Text-to-Speech**: For authentic native pronunciation using Chirp 3 HD and Neural2 voices in the target language.
-   **Unsplash**: Stock educational images.
-   **Gemini Flash-Image**: AI-generated contextual images (via Replit AI Integrations).

### Libraries & Tools
-   **Database**: Neon PostgreSQL, Drizzle ORM, Drizzle Kit.
-   **UI Framework**: React, TypeScript, Vite, Wouter.
-   **UI Components**: Radix UI, Shadcn/ui, Tailwind CSS.
-   **State Management**: TanStack Query, React Context.
-   **Billing**: `stripe-replit-sync`.
-   **Utilities**: `date-fns`, Embla Carousel, `franc-min`.

### AI Models
-   **Text Chat**: `gemini-2.5-flash`, `gemini-2.5-pro`.
-   **Voice STT**: Deepgram `nova-3` with auto-detect mode.
-   **Voice TTS**: Google Cloud voices (Chirp 3 HD, Neural2) in target language mode.
# LinguaFlow - Interactive Language Tutor

## Overview
LinguaFlow is an AI-powered language learning application designed for interactive conversation practice, vocabulary building, and grammar exercises across 9 target languages. It uses AI for personalized chat, flashcards, and grammar modules, adapting to individual user progress. The project aims to capture the educational technology market by supporting multiple languages and difficulty levels, providing explanations in any native language. The business vision includes offering a comprehensive, adaptive, and engaging language learning experience, capitalizing on AI advancements to deliver personalized education and expand into institutional markets.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend features a mobile-first responsive design utilizing Shadcn/ui (Radix UI base) and Tailwind CSS, adhering to Material Design principles. It supports light/dark modes, a two-column desktop layout, and a single-column mobile layout. Key UI elements include a "Voice Learning" button, a "Type instead" option, and a hint bar for voice interaction. Inter is used for UI text and JetBrains Mono for code/phonetic content. PWA features are integrated, including offline caching and home screen installation, with Capacitor configured for native iOS and Android builds sharing the web codebase.

### Technical Implementations
The frontend is built with React and TypeScript (Vite), using Wouter for routing and the React Context API with TanStack Query for state management. The backend is an Express.js (Node.js) server with TypeScript, providing a RESTful API. Data is stored using an abstract `IStorage` interface with Drizzle ORM for PostgreSQL. AI integration for text chat completions utilizes Gemini 2.5 Flash (via Replit's AI Integrations). Session management uses `connect-pg-simple` with a PostgreSQL session store. Authentication is handled by Replit Auth (OIDC), supporting email/password and social logins, with WebSocket connections authenticated via server-side session validation. Stripe integration for subscription management is managed by `stripe-replit-sync`.

All institutional forms follow a standardized pattern using Shadcn Form components with `react-hook-form` and `zodResolver` for validation, extending `insertSchema` from `shared/schema.ts` for type safety. Security involves multi-layered backend role-based authorization on all API endpoints and frontend route guards via the `ProtectedRoute` component. All mutations invalidate appropriate query caches for data consistency.

### Feature Specifications
LinguaFlow offers conversational onboarding, an adaptive multi-phase conversation system, and user agency with AI-suggested topics. A production-stable REST-based voice pipeline (Deepgram Nova-3 STT → Gemini → Google Cloud TTS) supports push-to-talk recording and smart language handling, delivering fast text-only responses with background enrichment. Enhanced voice chat system includes word-level timestamps with confidence scores, smart phrase detection for flexible "one word rule" validation (e.g., "buenos dias" counts as one conceptual unit), fast foreign-language-only display for immersion, replay button for repeating last teaching, ACTFL advancement tracking based on FACT criteria (Functions, Accuracy, Context, Text Type), and a 3-mode karaoke-style subtitle system: Off (no subtitles, uses Chirp 3 HD for best voice quality), Target (shows only target language words with progressive reveal as spoken, uses Neural2), or All (shows all words with progressive reveal, uses Neural2). The voice quality difference is intentional: Chirp 3 HD offers superior audio quality but doesn't support SSML mark tags required for word-level timing; Neural2 provides accurate word synchronization but slightly different voice character. Content guardrails ensure appropriate learning material. Personalized learning features include scenario-based learning, slow pronunciation with phonetic breakdowns, automatic vocabulary extraction, spaced repetition, streak tracking, progress charts, and auto-difficulty adjustment. AI-generated educational images are intelligently displayed with caching. The application supports various subscription tiers (Free, Basic, Pro, Institutional) with differing features and AI model access, along with atomic voice message usage tracking. Both voice and text chat share a unified architecture for consistent instructions and context, with AI-generated conversation titles. The system tracks student proficiency using ACTFL World-Readiness Standards and integrates ACTFL Can-Do Statements. Features like Resume Conversations, Smart Search, and AI-Powered Practice Suggestions leverage Gemini's 1M context window. A robust backend for institutional features is implemented for teacher class management, student enrollment, curriculum systems, assignment workflows, submission & grading, and comprehensive security architecture. A Super Admin Backend provides complete role-based access control (RBAC) with a role hierarchy (admin > developer > teacher > student), user management, platform-wide class/assignment oversight, platform metrics, and an audit logging system with impersonation capabilities.

### System Design Choices
Core data models include Users, Conversations, Messages, VocabularyWords, GrammarExercises, UserProgress, CulturalTips, and Topics, all linked via `userId`. Stripe data is synced to a PostgreSQL `stripe` schema via webhooks. User learning preferences like `targetLanguage`, `nativeLanguage`, `difficultyLevel`, `actflLevel`, and `onboardingCompleted` are stored. The database schema includes ACTFL proficiency level tracking across relevant tables, with dedicated ActflProgress table for FACT criteria tracking (Functions, Accuracy, Context, Text Type). 

**Voice Validation Architecture**: The system uses a two-tier schema-level prevention approach for voice responses. Prevention tier uses Gemini structured output with strict JSON schema (`maxLength: 15` on target, `minLength: 30` on native) and clear instructions forbidding native language in target field. Safety net tier uses universal franc-min language detection for words ≥3 characters plus per-language stoplists for short (<3 char) native words across all 9 languages. This architecture prevents issues before they occur, reducing code by ~45 lines while improving reliability. See `VOICE_VALIDATION_ARCHITECTURE.md` for complete details. Performance metrics and cost estimates are documented in `DEVELOPMENT_METRICS.md`.

**Voice TTS Pronunciation Architecture**: For immersive beginner mode, the system uses SSML `<phoneme>` tags with IPA (International Phonetic Alphabet) pronunciation to fix syllable mispronunciation when Spanish Chirp 3 HD voice reads English text with embedded Spanish words. The preprocessing function (`addPhonemeTagsForTargetWords`) wraps quoted target-language words (e.g., 'Hola') with SSML phoneme tags (e.g., `<phoneme alphabet="ipa" ph="ˈola">Hola</phoneme>`) to enforce correct syllable counts while preserving the immersive Spanish accent. This ensures "Hola" is pronounced as 2 syllables (HO-la) instead of being mis-segmented to 3 syllables. IPA mappings cover 17+ common Spanish phrases, with support for French and extensibility to all 9 languages. The solution adds ~1ms preprocessing overhead and maintains the <6s performance target. See `VOICE_TTS_PRONUNCIATION_FIX.md` for implementation details.

**Subtitle System Architecture**: The 3-state subtitle system (`subtitleMode` in LanguageContext) supports Off, Target (target language only), and All (full transcript) modes. Currently uses static text display to prioritize Chirp HD voice quality over karaoke-style word highlighting. The ImmersiveTutor shows subtitles during and after playback for reading practice. VoiceChatViewManager provides view switching (live/history) and subtitle mode cycling (Off → Target → All → Off).

**Karaoke Highlighting (DISABLED)**: Word-by-word progressive reveal with synchronized highlighting is implemented but disabled because Chirp HD voices don't support SSML mark tags required for word-level timing. Neural2 voices support timing but have inferior voice quality for language learning. Code is preserved in ImmersiveTutor.tsx and RestVoiceChat.tsx with TODO comments. Periodically check Google Cloud TTS documentation for Chirp HD SSML mark support: https://cloud.google.com/text-to-speech/docs/ssml

**Deepgram Pre-Warming**: To eliminate cold-start latency (which could be 15-20 seconds on first transcription), the system pre-warms the Deepgram connection when entering voice chat. The backend endpoint `/api/voice/warm` sends a minimal silent WAV to wake up Deepgram's API. RestVoiceChat.tsx calls this on mount, reducing first transcription from ~20s to ~2s. TTS text cleaning also strips quotes to prevent pronouncing punctuation marks.

Smart phrase detection module (`server/phrase-detection.ts`) handles multi-word expressions as single conceptual units. ACTFL advancement algorithm (`server/actfl-advancement.ts`) evaluates readiness based on sustained performance across all FACT criteria. Institutional features include CanDoStatements, StudentCanDoProgress, CurriculumPaths, TeacherClasses, and Assignments tables. A PWA install prompt is displayed. The system includes an offline indicator component and an enhanced service worker for comprehensive API route caching and mobile responsiveness with adaptive text sizing. Security hardening includes unified frontend/backend validation, input sanitization, and max-length constraints across all text fields.

## Branding Assets
**Logo Files**: Located in `attached_assets/` directory
- **Primary Logo**: `linguaflow_monogram_ribbon_logo_1764097955181.png` - Ribbon-style "LF" monogram used in sidebar header
- When updating logos/images, check `attached_assets/` for the latest versions

## External Dependencies

### Third-Party Services
-   **Stripe**: Payment processing and subscription management.
-   **Replit Auth**: OIDC authentication.
-   **Gemini API**: For text chat completions (via Replit AI Integrations) using Gemini 2.5 Flash and Gemini 2.5 Pro.
-   **Deepgram API**: For voice STT using Nova-3 model.
-   **Google Cloud Text-to-Speech**: For authentic native pronunciation using Chirp 3 HD and Neural2 voices.
-   **Unsplash**: Stock educational images.
-   **Gemini Flash-Image**: AI-generated contextual images (via Replit AI Integrations).

### Libraries & Tools
-   **Database**: Neon PostgreSQL, Drizzle ORM, Drizzle Kit.
-   **UI Framework**: React, TypeScript, Vite, Wouter.
-   **UI Components**: Radix UI, Shadcn/ui, Tailwind CSS.
-   **State Management**: TanStack Query, React Context.
-   **Billing**: `stripe-replit-sync`.
-   **Utilities**: `date-fns`, Embla Carousel, `franc-min` (universal language detection for voice validation).

### AI Models
-   **Text Chat**: `gemini-2.5-flash`, `gemini-2.5-pro`.
-   **Voice STT**: Deepgram `nova-3`.
-   **Voice TTS**: Google Cloud voices (Chirp 3 HD, Neural2).

## Future Enhancements
See `FUTURE_ENHANCEMENTS.md` for deferred features and development backlog, including potential IPA phoneme mappings for German, Italian, Portuguese, and non-Latin script languages (awaiting usage metrics and user feedback).
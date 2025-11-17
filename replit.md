# LinguaFlow - Interactive Language Tutor

## Overview

LinguaFlow is an AI-powered language learning application that provides interactive conversation practice, vocabulary building, and grammar exercises. The platform enables users to practice multiple languages at varying difficulty levels through chat-based conversations with an AI tutor, flashcard-based vocabulary learning, and interactive grammar exercises.

The application tracks user progress including words learned, practice time, and streaks to encourage consistent learning habits.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, built using Vite for fast development and optimized production builds.

**Routing**: Wouter for lightweight client-side routing with pages for Dashboard, Chat, Vocabulary, Grammar, and History.

**State Management**: 
- React Context API for global language and difficulty preferences (LanguageContext)
- TanStack Query (React Query) for server state management and caching
- Local component state for UI interactions

**UI Component Library**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling. The design system follows Material Design principles adapted for educational applications, emphasizing clarity and distraction-free learning zones.

**Styling**: Tailwind CSS with custom design tokens defined in CSS variables for theming. Supports light/dark mode with theme persistence in localStorage.

**Key Design Decisions**:
- Two-column layout on desktop (sidebar + main content), single-column on mobile with collapsible sidebar
- Material Design approach chosen for clear hierarchy and familiar interaction patterns
- Typography: Inter for UI text, JetBrains Mono for code/phonetic content
- Consistent spacing system using Tailwind's 2/4/6/8 unit scale

### Backend Architecture

**Server Framework**: Express.js running on Node.js with TypeScript.

**API Design**: RESTful API endpoints organized by resource:
- `/api/conversations` - Create and retrieve chat conversations
- `/api/conversations/:id/messages` - Send and retrieve messages within conversations
- `/api/vocabulary` - Fetch vocabulary words filtered by language and difficulty
- `/api/grammar` - Fetch grammar exercises filtered by language and difficulty
- `/api/progress` - Track and retrieve user learning progress

**Storage Layer**: Abstract `IStorage` interface with in-memory implementation (`MemStorage`). The application uses Drizzle ORM configured for PostgreSQL, indicating readiness for database migration from in-memory storage.

**AI Integration**: OpenAI-compatible API integration via Replit's AI Integrations service for generating contextual language tutor responses in chat conversations.

**Session Management**: Uses `connect-pg-simple` for PostgreSQL-backed session storage, though the full session implementation may be pending based on the in-memory storage pattern.

### Data Models

**Core Entities** (defined in `shared/schema.ts`):

1. **Conversations**: Stores chat sessions with language, difficulty, topic, and metadata (message count, duration)
2. **Messages**: Individual chat messages within conversations, tracking role (user/assistant) and content
3. **VocabularyWords**: Word entries with translations, examples, pronunciation guides, and difficulty levels
4. **GrammarExercises**: Multiple-choice questions with options, correct answers, and explanations
5. **UserProgress**: Tracks learning metrics per language (words learned, practice minutes, current streak)

**Data Flow**:
- Client fetches data via React Query, which caches responses
- Mutations trigger optimistic updates and cache invalidation
- Language/difficulty context changes trigger refetches of filtered content

### External Dependencies

**Third-Party Libraries**:
- **OpenAI API** (via Replit AI Integrations): Powers conversational AI tutor responses
- **Neon Database Serverless** (`@neondatabase/serverless`): PostgreSQL database driver for serverless environments
- **Drizzle ORM**: Type-safe SQL query builder and schema management
- **Radix UI**: Accessible component primitives for the UI library
- **TanStack Query**: Server state management and data synchronization
- **Wouter**: Lightweight routing library
- **date-fns**: Date manipulation utilities
- **Embla Carousel**: Touch-friendly carousel component

**Development Tools**:
- Vite for build tooling with HMR
- ESBuild for server-side bundling
- TypeScript for type safety across the stack
- Tailwind CSS with PostCSS for styling

**Database Configuration**:
- PostgreSQL database (provisioned via `DATABASE_URL` environment variable)
- Drizzle Kit for migrations and schema management
- Connection pooling via `@neondatabase/serverless`

**Asset Management**:
- Google Fonts (Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono)
- Static images stored in `attached_assets/generated_images/`

**Deployment Considerations**:
- Environment variables: `DATABASE_URL`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
- Build outputs to `dist/` directory
- Separate client (`dist/public`) and server (`dist/index.js`) bundles
- Session storage requires PostgreSQL connection

## Recent Changes

### November 17, 2025 - Adaptive Multi-Phase Conversation System
**Status**: ✅ Complete and tested

**Feature Overview**:
The AI tutor now uses an intelligent three-phase approach to assess and adapt to each student's actual proficiency level, creating a more natural and personalized learning experience.

**Phase 1: English Assessment (Messages 1-5)**
- Tutor starts every conversation in English
- Asks probing questions to understand student's background:
  - "Have you studied [language] before?"
  - "Can you introduce yourself in [language]?"
  - "What topics can you discuss comfortably?"
- Observes both English responses and any target language attempts
- Builds rapport through friendly conversation, not formal testing

**Phase 2: Gradual Transition (Messages 6-11)**
- Begins mixing target language with English (30-50% target language)
- Provides English translations for new vocabulary
- Adapts language ratio based on student responses
- If student struggles: Uses more English, simpler phrases
- If student succeeds: Increases target language usage and complexity

**Phase 3: Immersive Practice (Message 12+)**
- Switches to primarily target language (80-90%)
- Uses selected difficulty level (beginner/intermediate/advanced) as baseline
- Continues adapting based on real-time performance
- Provides English support only for complex concepts or corrections

**Technical Implementation**:
- System prompt dynamically changes based on message count
- Message count determines conversation phase automatically
- AI receives phase-specific instructions for language ratio and teaching strategy
- Adaptive difficulty adjusts within each phase based on student responses

**Benefits**:
- More natural conversation flow vs. selecting difficulty upfront
- Personalized assessment of actual proficiency level
- Gradual immersion reduces intimidation for beginners
- Continuous adaptation ensures appropriate challenge level

**Test Results**:
- End-to-end testing confirmed all three phases work correctly
- AI successfully transitions from English → mixed → immersive
- Adaptive difficulty adjusts appropriately to student responses

### November 17, 2025 - Voice Chat Session Configuration Fix
**Status**: ✅ Fixed and working with basic Realtime API access

**Issue Resolved**:
- OpenAI was immediately rejecting sessions with `server_error` after configuration
- Root cause: Requesting advanced features (Whisper transcription, automatic VAD) that require special API key permissions
- Users with basic Realtime API access couldn't use voice chat

**Solution Implemented**:
- Simplified session configuration to use only core features compatible with basic Realtime API access
- Removed `input_audio_transcription` (Whisper-1 transcription) requirement
- Set `turn_detection: null` to disable automatic voice activity detection
- Retained essential features: audio modalities, voice output, PCM16 audio formats

**New Voice Chat Behavior**:
- Manual recording control: Press microphone button to speak, release to send
- No automatic transcription (audio-only responses)
- Connection stays open and stable - no more server errors
- Works with any OpenAI API key that has basic Realtime API access

**Error Messaging Improvements**:
- User-friendly error messages for different error types (server errors, authentication, rate limits)
- Actionable suggestions based on specific error conditions
- Expandable technical details for debugging
- Retry and dismiss functionality
- Prevents error loops during reconnection attempts

### November 17, 2025 - Voice Chat Feature Implementation  
**Status**: ✅ Complete with simplified configuration for broad compatibility

**Voice Chat Features**:
- Real-time voice conversations using OpenAI Realtime API
- WebSocket proxy on backend for secure API key management
- Audio recording and playback with proper PCM16 encoding
- Manual push-to-talk recording control (press button, release to send)
- Visual feedback for recording and AI speaking states
- Toggle between text and voice conversation modes
- Automatic capability detection with graceful degradation

**Technical Implementation**:
- Frontend: VoiceChat component with WebSocket connection to backend proxy
- Backend: WebSocket server that forwards connections to OpenAI Realtime API
- Audio utilities: PCM16 encoding/decoding for Realtime API compatibility
- Capability check: Detects API availability before enabling voice mode
- Comprehensive error handling with user-friendly messaging
- Browser compatibility: Uses Web Audio API for recording/playback

**Known Limitations**:
- Manual recording only (no automatic voice activity detection)
- No live transcription (voice responses only - press text chat for transcripts)
- Requires OpenAI API key with Realtime API access (basic tier sufficient)
- Browser microphone permissions required
- WebSocket connection stability depends on network conditions
- Modern browser required (Chrome, Firefox, Safari, Edge)
- Best performance on desktop; mobile may have limitations

### November 17, 2025 - Animated Instructor Avatar Feature
**Status**: ✅ Complete and tested

**Feature Overview**:
- Animated instructor avatar provides real-time visual feedback during conversations
- Three distinct states: idle, listening (voice chat only), and speaking
- Smooth transitions and animations enhance the learning experience
- Positioned in chat interface header for consistent visibility

**Visual States**:
1. **Idle State** - Default welcoming pose with "Ready to help" label
2. **Listening State** - Attentive pose with pulse animation when user is speaking (voice chat)
3. **Speaking State** - Animated teaching pose with glow effect when AI is responding

**Technical Implementation**:
- Component: `InstructorAvatar.tsx` with three generated instructor images
- State management: Tracks assistant message count to accurately detect AI response window
- Animations: Custom CSS keyframes for subtle bounce and pulse effects
- Integration: Added to both ChatInterface and VoiceChat components
- Visual feedback: Glow effects, border colors, and state labels

**State Transitions**:
- **Text Chat**: Idle → Speaking (when AI generates response) → Idle
- **Voice Chat**: Idle → Listening (when recording) → Speaking (when AI responds) → Idle
- Smooth fade and scale transitions between states

**Assets Generated**:
- `Friendly_teacher_idle_state_fd4580c6.png` - Idle state instructor
- `Teacher_listening_attentively_f9f6c37e.png` - Listening state instructor  
- `Teacher_speaking_animatedly_62a6f01b.png` - Speaking state instructor

**Testing Results**:
- End-to-end testing completed successfully
- Avatar state transitions verified in text chat scenarios
- Proper detection of assistant responses confirmed
- Visual animations and effects working as expected

### November 17, 2025 - Full Application Implementation
**Status**: ✅ Complete and tested

**Features Implemented**:
- AI-powered chat conversations with OpenAI gpt-5 integration (20-message history limit)
- Vocabulary flashcard system with flip animations and navigation
- Grammar exercise system with instant feedback and explanations
- Conversation history with real-time statistics (message count, duration)
- Progress tracking dashboard (words learned, practice minutes, day streaks)
- Global language and difficulty context with Spanish beginner/intermediate content

**Critical Fixes Applied**:
- Fixed conversation statistics tracking: `messageCount` increments on each message, `duration` calculated from first-to-last message timestamps
- Implemented conversation reuse: Same language/difficulty combination returns existing conversation instead of creating duplicates
- Corrected API query parameters: Fixed React Query queryKey handling to properly send `?language=X&difficulty=Y` instead of object serialization
- Limited OpenAI message history to last 20 messages per conversation to avoid token limits
- Added proper error handling for chat mutations and API requests

**Test Results**:
- End-to-end testing completed successfully via Playwright
- All user workflows validated: vocabulary practice, grammar exercises, AI chat, history viewing
- Application responsive and follows Material Design guidelines
- No critical bugs or regressions found

**Known Limitations**:
- Single-user scope: All conversations shared across sessions (suitable for demo/prototype)
- In-memory storage: Data resets on server restart (MemStorage implementation)
- Spanish language only: Sample data currently limited to Spanish beginner/intermediate levels
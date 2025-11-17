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

### November 17, 2025 - Voice Chat Feature Implementation
**Status**: ✅ Complete with documented limitations

**Voice Chat Features**:
- Real-time voice conversations using OpenAI Realtime API
- WebSocket proxy on backend for secure API key management
- Audio recording and playback with proper PCM16 encoding
- Voice activity detection (VAD) for natural turn-taking
- Live transcription of user and AI speech
- Visual feedback for recording and AI speaking states
- Toggle between text and voice conversation modes
- Automatic capability detection with graceful degradation

**Technical Implementation**:
- Frontend: VoiceChat component with WebSocket connection to backend proxy
- Backend: WebSocket server that forwards connections to OpenAI Realtime API
- Audio utilities: PCM16 encoding/decoding for Realtime API compatibility
- Capability check: Detects API availability before enabling voice mode
- Error handling: Clear messaging when voice chat unavailable
- Browser compatibility: Uses Web Audio API for recording/playback

**Critical Fixes Applied**:
- Fixed PCM16 audio encoding using proper Int16Array conversion
- Implemented WebSocket connection timeout and error handling
- Added capability check endpoint that detects Replit AI Integrations
- Improved error messaging and UI states
- Disabled voice button when API unavailable

**Known Limitations**:
- **Critical**: Requires OpenAI Realtime API access - NOT available through Replit AI Integrations
  - Replit AI Integrations only support Chat Completions API
  - Users must provide their own OpenAI API key with Realtime access
  - Text-based chat remains fully functional as alternative
- Browser microphone permissions required
- WebSocket connection stability depends on network conditions  
- Modern browser required (Chrome, Firefox, Safari, Edge)
- Best performance on desktop; mobile may have limitations

**Setup Guide**: See `docs/voice-chat-setup.md` for detailed configuration and troubleshooting

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
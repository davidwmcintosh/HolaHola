# LinguaFlow Technical Reference

Developer documentation for the LinguaFlow platform architecture, APIs, and integrations.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Voice Pipeline](#voice-pipeline)
3. [Whiteboard System](#whiteboard-system)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [External Integrations](#external-integrations)
7. [Testing](#testing)

---

## Architecture Overview

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Wouter |
| UI | Radix UI, Shadcn/ui, Tailwind CSS |
| State | TanStack Query, React Context |
| Backend | Express.js, Node.js, TypeScript |
| Database | PostgreSQL (Neon), Drizzle ORM |
| Auth | Replit Auth (OIDC) |
| Payments | Stripe, stripe-replit-sync |

### Key Services

| Service | Purpose |
|---------|---------|
| Gemini 2.5 Flash | Text chat, voice LLM, drill evaluation |
| Deepgram Nova-3 | Speech-to-text |
| Cartesia Sonic-3 | Text-to-speech (primary) |
| Google Cloud TTS | TTS fallback |
| Unsplash | Stock images |
| Gemini Flash-Image | AI-generated images |

### File Structure

```
├── client/src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilities
│   └── pages/          # Route pages
├── server/
│   ├── routes.ts       # API endpoints
│   ├── storage.ts      # Database interface
│   ├── services/       # Business logic
│   └── seeds/          # Data seeding
└── shared/
    └── schema.ts       # Database schema + types
```

---

## Voice Pipeline

### Streaming Architecture

```
User Speech → Deepgram STT → Gemini LLM (streaming) → Cartesia TTS (WebSocket)
                                    ↓
                             Whiteboard parsing
                                    ↓
                             Word-level timestamps
                                    ↓
                             Synchronized subtitles
```

### WebSocket Protocol

**Session Start:**
```typescript
{ type: 'start_session', conversationId, userId, language }
```

**User Audio:**
```typescript
{ type: 'audio_data', data: base64AudioChunk }
```

**Tutor Response (streaming):**
```typescript
{ type: 'text_chunk', text: string }
{ type: 'audio_chunk', data: base64AudioChunk }
{ type: 'sentence_ready', timings: WordTiming[] }
{ type: 'whiteboard', items: WhiteboardItem[] }
```

### Deepgram STT Integration

**Configuration:**
```typescript
{
  model: 'nova-2',
  language: targetLanguage,
  smart_format: true,
  diarize: true,  // Word-level timestamps
}
```

**Response:**
```typescript
{
  text: string,
  words: { word: string, start: number, end: number, confidence: number }[],
  wordCount: number,
  avgConfidence: number,
  conceptualUnits: number,  // Smart phrase detection
  unitValidation: { isValid: boolean, message: string }
}
```

### Cartesia TTS Integration

**WebSocket API with timestamps:**
```typescript
{
  model_id: 'sonic-english',
  transcript: text,
  voice: { id: voiceId },
  output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: 24000 },
  add_timestamps: true,  // Enable word-level timestamps
}
```

**Sentence-ready architecture:**
- Audio playback waits for word timings to arrive
- Enables synchronized karaoke-style subtitles
- Fallback to bitrate-based estimation if timestamps fail

### Smart Phrase Detection

Recognizes multi-word expressions as single conceptual units:

```typescript
// server/phrase-detection.ts
matchesPhraseUnit(text: string, language: string): string | null
countConceptualUnits(text: string, language: string): number
validateOneUnitRule(text: string, language: string, difficulty: string)
```

**Examples:**
- "Buenos días" → 1 unit (phrase)
- "S'il vous plaît" → 1 unit (phrase)
- "Hola buenos días" → 2 units

### Word Timing Diagnostics System

The audio pipeline includes a comprehensive word-level timing system for future karaoke-style subtitle synchronization. This system is **disabled by default** for performance but preserves all infrastructure for future development.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ StreamingAudioPlayer (client/src/lib/audioUtils.ts)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐ │
│  │ Sentence        │     │ Word Schedule   │     │ Timing Loop   │ │
│  │ Schedule Map    │────▶│ per Sentence    │────▶│ (60fps RAF)   │ │
│  └─────────────────┘     └─────────────────┘     └───────────────┘ │
│         │                        │                       │         │
│         ▼                        ▼                       ▼         │
│  startCtxTime              WordTiming[]           onWordStart()    │
│  endCtxTime                w/ offsets             onSentenceEnd()  │
│  totalDuration                                    onComplete()     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Files:**

| File | Purpose |
|------|---------|
| `client/src/lib/audioUtils.ts` | StreamingAudioPlayer with timing loop |
| `client/src/lib/debugTimingState.ts` | Debug state for on-screen diagnostics |

**Feature Flag:**

```typescript
// client/src/lib/audioUtils.ts (top of file)
const ENABLE_WORD_TIMING_DIAGNOSTICS = false;

// Runtime override via DevTools
declare global {
  interface Window {
    __enableWordTimingDiagnostics?: boolean;
  }
}

function isWordTimingEnabled(): boolean {
  return ENABLE_WORD_TIMING_DIAGNOSTICS || 
         (typeof window !== 'undefined' && window.__enableWordTimingDiagnostics === true);
}
```

**Enabling Diagnostics:**

| Method | How | Persistence |
|--------|-----|-------------|
| DevTools (temporary) | `window.__enableWordTimingDiagnostics = true` | Until page refresh |
| Code change (permanent) | Set `ENABLE_WORD_TIMING_DIAGNOSTICS = true` | Until reverted |

**What's Preserved (disabled but intact):**

- `sentenceSchedule` Map tracking all sentences' AudioContext times
- `WordTiming[]` arrays with start/end offsets per word
- Debug state updates to `debugTimingState.ts`
- Frame-by-frame schedule scanning and match detection
- `onWordStart`, `onSentenceStart`, `onSentenceEnd` callbacks
- Detailed console logging for timing analysis

**What Runs When Disabled:**

- Minimal timing loop (essential AudioContext health checks)
- Sentence start/end detection (for proper cleanup)
- AudioContext suspend detection and auto-resume

**Performance Impact:**

| Mode | CPU Load | Console Output |
|------|----------|----------------|
| Disabled (default) | Minimal | AudioContext suspend warnings only |
| Enabled | High (~60fps processing) | Verbose frame-by-frame logs |

**Debug State Interface:**

```typescript
// client/src/lib/debugTimingState.ts
interface DebugTimingState {
  isLoopRunning: boolean;
  loopTickCount: number;
  currentCtxTime: number;
  audioContextState: 'suspended' | 'running' | 'closed' | 'unknown';
  audioContextId: string;
  activeSentenceIndex: number;
  sentenceSchedule: SentenceScheduleEntry[];
  isPlaying: boolean;
  tickFrameLogs: string[];
  loopStartTime: number;
}

// Access current state
getDebugTimingState(): DebugTimingState;

// Update state (used by timing loop)
updateDebugTimingState(partial: Partial<DebugTimingState>): void;
```

**Future Use Cases:**

1. **Karaoke Subtitles**: Highlight words as they're spoken
2. **Word-Level Replay**: Tap a word to replay just that segment
3. **Pronunciation Practice**: Compare user timing to tutor timing
4. **Whiteboard Sync**: Trigger PHONETIC displays at exact word moments

### Audio Performance Optimizations

**Last Updated:** December 2024

The streaming audio pipeline has been optimized to eliminate choppy audio caused by main thread blocking. The key principle: **zero console operations on the hot path**.

**Problem Diagnosed:**

During audio streaming, the following operations were blocking the main thread on every audio chunk (~30-50 chunks per tutor response):
- `console.log()` / `console.error()` calls (synchronous I/O)
- JSON stringification for debug logging
- Dynamic `import()` calls creating microtask overhead
- Array operations for debug tracking
- Debug state updates

**Hot Path Definition:**

The "hot path" is any code executed per-message during audio streaming:

| Component | Hot Path Functions |
|-----------|-------------------|
| `streamingVoiceClient.ts` | `handleMessage()`, `handleAudioChunk()`, `handleWordTimingDelta()`, `handleSentenceReady()`, `handleWordTimingFinal()` |
| `audioUtils.ts` | `enqueue()`, `enqueueProgressivePcmChunk()`, `updatePendingCount()` |

**Optimizations Applied:**

1. **Removed all console logging from hot path handlers:**
   - `handleMessage()` - No per-message logging
   - `handleAudioChunk()` - Silent processing
   - `handleWordTimingDelta()` - Emit only, no logging
   - `handleWordTimingFinal()` - Emit only, no logging
   - `handleSentenceReady()` - Minimal state update
   - `handleSentenceStart()` - Silent state update
   - `handleSentenceEnd()` - Silent callback
   - `handleResponseComplete()` - Silent state transition

2. **Removed dynamic imports on hot path:**
   ```typescript
   // REMOVED - was called on every message
   import('./debugTimingState').then(({ trackWsMessage }) => {
     trackWsMessage(message.type);
   });
   ```

3. **Removed redundant tracking objects:**
   - `window._allMessageTypes` array updates
   - `window._wsMessageCounts` per-type counters
   - `window._deltaBySentence` timing history
   - `window._sentenceReadyHistory` arrays

4. **Simplified WebSocket message handling:**
   ```typescript
   // Before: 60+ lines of logging/tracking per message
   // After: ~5 lines - parse, count, switch, emit
   ```

5. **Audio player optimizations:**
   - `enqueue()` - Removed queue status logging
   - `enqueueProgressivePcmChunk()` - Removed per-chunk logging
   - `updatePendingCount()` - Silent counter update

6. **Increased audio prebuffer margin:**
   ```typescript
   // Before: 0.05-0.1s prebuffer
   // After: 0.2s prebuffer (prevents audio starvation during GC/decode latency)
   this.progressiveScheduledTime = ctx.currentTime + 0.2;
   ```

**What's Preserved for Debugging:**

Lightweight window-level counters (no logging):
```typescript
// Access via browser DevTools console:
window._wsDebug.messageCount     // Total messages received
window._wsDebug.byType           // Message counts by type
window._audioChunks.total        // Total audio chunks
window._audioChunks.bySentence   // Chunks per sentence
```

**Performance Impact:**

| Metric | Before | After |
|--------|--------|-------|
| Console ops per chunk | 10-15 | 0 |
| Main thread blocking | Significant | Minimal |
| Audio gaps | Frequent | Rare |
| GC sensitivity | High | Low |

**Code Locations:**

| File | Changes |
|------|---------|
| `client/src/lib/streamingVoiceClient.ts` | Removed logging from all message handlers |
| `client/src/lib/audioUtils.ts` | Removed logging from enqueue functions |

**Guidelines for Future Development:**

1. **Never add console.log to hot path functions** - Use lightweight counters instead
2. **No dynamic imports in message handlers** - Import at module level
3. **No JSON.stringify on hot path** - Defer to cold path if needed
4. **Test with real audio** - Verify no choppy playback after changes
5. **Use prebuffer margin** - 0.2s minimum for network/decode variance

---

## Whiteboard System

### Markup Format

**Syntax:**
```
[TOOL_NAME]content[/TOOL_NAME]
[TOOL_NAME param="value"]content[/TOOL_NAME]
```

**Parsing Notes:**
- Tags are case-sensitive (uppercase)
- Pipe (`|`) separates multiple values
- Line breaks preserved for DRILL match type

### Type Definitions

Located in `shared/whiteboard-types.ts`:

```typescript
interface WhiteboardItemBase {
  id: string;
  type: WhiteboardItemType;
  timestamp: number;
}

type WhiteboardItemType = 
  | 'write' | 'phonetic' | 'compare' | 'image' | 'drill'
  | 'context' | 'grammar_table' | 'reading' | 'stroke'
  | 'word_map' | 'culture' | 'play' | 'scenario' | 'summary';
```

### Tool Specifications

| Tool | Format | Data Fields |
|------|--------|-------------|
| WRITE | `[WRITE]text[/WRITE]` | `text: string` |
| PHONETIC | `[PHONETIC]word\|breakdown[/PHONETIC]` | `word, breakdown` |
| COMPARE | `[COMPARE]correct NOT incorrect[/COMPARE]` | `correct, incorrect` |
| IMAGE | `[IMAGE]word[/IMAGE]` | `word, imageUrl, isLoading` |
| DRILL | `[DRILL type="..."]content[/DRILL]` | `drillType, prompt, pairs?, state?` |
| CONTEXT | `[CONTEXT]word\|sent1\|sent2[/CONTEXT]` | `word, sentences[]` |
| GRAMMAR_TABLE | `[GRAMMAR_TABLE]verb\|tense[/GRAMMAR_TABLE]` | `verb, tense, conjugations` |
| READING | `[READING]char\|pronunciation[/READING]` | `character, pronunciation, language` |
| STROKE | `[STROKE]character[/STROKE]` | `character, language` |
| WORD_MAP | `[WORD_MAP]word[/WORD_MAP]` | `word, synonyms, antonyms, etc.` |
| CULTURE | `[CULTURE]topic\|context\|category[/CULTURE]` | `topic, context, category` |
| PLAY | `[PLAY speed="slow"]text[/PLAY]` | `text, speed` |
| SCENARIO | `[SCENARIO]loc\|situation\|mood[/SCENARIO]` | `location, situation, mood` |
| SUMMARY | `[SUMMARY]title\|words\|phrases[/SUMMARY]` | `title, words[], phrases[]` |

### Component Implementation

Located in `client/src/components/Whiteboard.tsx`:

```typescript
function Whiteboard({ items }: { items: WhiteboardItem[] });

// Individual display components for each tool type
function WriteItemDisplay({ item }: { item: WriteItem });
function PhoneticItemDisplay({ item }: { item: PhoneticItem });
// ... etc
```

### HanziWriter Integration

For STROKE tool animation:

```typescript
const HanziWriter = await import('hanzi-writer');

const writer = HanziWriter.create(containerId, character, {
  width: 120,
  height: 120,
  strokeColor: '#ea580c',
  outlineColor: '#ddd',
  delayBetweenStrokes: 300,
});

writer.animateCharacter();
writer.destroy(); // Cleanup on unmount
```

### Image Resolution Service

`server/services/vocabulary-image-resolver.ts`:

```typescript
async function resolveVocabularyImage(
  word: string,
  language: string,
  userId: string
): Promise<string | null>;
```

**Fallback chain:** Cache → Stock (Unsplash) → AI Generation (Gemini)

---

## Database Schema

### Core Tables

**users**
```typescript
{
  id: string,
  username: string,
  email: string,
  role: 'student' | 'teacher' | 'admin' | 'developer',
  isTestAccount: boolean,
  isBetaTester: boolean,
  // ... learning preferences
}
```

**conversations**
```typescript
{
  id: string,
  userId: string,
  classId?: string,
  language: string,
  title: string,
  actflLevel: string,
  // ... metadata
}
```

**messages**
```typescript
{
  id: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  audioUrl?: string,
  actflLevel?: string,
}
```

**vocabularyWords**
```typescript
{
  id: string,
  userId: string,
  word: string,
  translation: string,
  language: string,
  actflLevel: string,
  mastery: number,
  nextReviewAt: Date,
}
```

### Institutional Tables

**teacherClasses**
```typescript
{
  id: string,
  teacherId: string,
  name: string,
  language: string,
  targetLevel: string,
  joinCode: string,
  curriculumPathId?: string,
}
```

**curriculumPaths / curriculumUnits / curriculumLessons**
Hierarchical curriculum structure.

**classEnrollments**
```typescript
{
  id: string,
  classId: string,
  studentId: string,
  status: 'active' | 'completed' | 'dropped',
}
```

**syllabusProgress**
```typescript
{
  id: string,
  studentId: string,
  classId: string,
  lessonId: string,
  status: 'not_started' | 'in_progress' | 'completed_early' | 'completed',
  evidenceType: string,
  // ... competency metrics
}
```

### Media & Images

**mediaFiles**
```typescript
{
  id: string,
  userId: string,
  filename: string,
  url: string,
  source: 'stock' | 'ai_generated' | 'user_upload',
  language?: string,
  targetWord?: string,
  isReviewed: boolean,
  reviewedAt?: Date,
  reviewedBy?: string,
}
```

---

## API Reference

### Voice Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/voice/transcribe` | POST | Deepgram STT |
| `/api/voice/synthesize` | POST | Cartesia TTS |
| `/api/voice/websocket` | WS | Streaming voice session |

### Conversation Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversations` | GET/POST | List/create conversations |
| `/api/conversations/:id` | GET | Get conversation with messages |
| `/api/messages` | POST | Send message |
| `/api/messages/search` | GET | Full-text message search |

### Vocabulary Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vocabulary` | GET/POST | List/add vocabulary |
| `/api/vocabulary/export` | GET | Export CSV/Anki |
| `/api/vocabulary/review` | POST | Update spaced repetition |

### Class/Institutional Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/teacher/classes` | GET/POST | Teacher class management |
| `/api/teacher/classes/:id/students` | GET | Class roster |
| `/api/teacher/classes/:id/curriculum` | GET/PUT | Syllabus management |
| `/api/classes/join` | POST | Student join with code |
| `/api/competency/:classId/:lessonId` | GET | Check lesson competency |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET/PATCH | User management |
| `/api/admin/media` | GET/PATCH | Image library |
| `/api/admin/media/bulk-review` | POST | Bulk review status |
| `/api/admin/analytics` | GET | Platform analytics |

---

## External Integrations

### Gemini (Google AI)

**Text/Voice Chat:**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
```

### Deepgram

**Speech-to-Text:**
```typescript
import { createClient } from '@deepgram/sdk';
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
```

### Cartesia

**Text-to-Speech (WebSocket):**
```typescript
const ws = new WebSocket('wss://api.cartesia.ai/tts/websocket');
ws.send(JSON.stringify({
  model_id: 'sonic-english',
  transcript: text,
  voice: { id: voiceId },
  add_timestamps: true,
}));
```

### Stripe

**Subscription Management:**
```typescript
import { stripeReplitSync } from 'stripe-replit-sync';
// Automatic sync of subscription status
```

---

## Testing

### Playwright E2E

**OIDC Test Authentication:**
```typescript
{
  sub: "unique-test-user-id",
  email: "test@example.com",
  first_name: "Test",
  last_name: "User",
  roles: ["developer"]  // Required for unlimited credits
}
```

### Data-TestIDs

| Element | Pattern |
|---------|---------|
| Interactive buttons | `button-{action}` |
| Form inputs | `input-{field}` |
| Display text | `text-{content}` |
| Drill items | `drill-left-{n}`, `drill-right-{n}` |

### Testing Limitations

- Whiteboard tools only work in Voice Learning mode
- Playwright cannot use microphone
- Voice mode features require manual testing

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/routes.ts` | All API endpoints |
| `server/storage.ts` | Database interface |
| `server/unified-ws-handler.ts` | Voice WebSocket handling |
| `server/system-prompt.ts` | AI tutor personality |
| `server/phrase-detection.ts` | Smart phrase detection |
| `server/actfl-advancement.ts` | ACTFL level assessment |
| `server/services/competency-verifier.ts` | Organic progress detection |
| `server/services/curriculum-context.ts` | Class context for tutor |
| `server/services/vocabulary-image-resolver.ts` | Image resolution |
| `shared/schema.ts` | Database schema + types |
| `shared/whiteboard-types.ts` | Whiteboard parsing |
| `client/src/components/Whiteboard.tsx` | Whiteboard UI |
| `client/src/components/ImmersiveTutor.tsx` | Voice chat UI |

---

## Archived Documentation

Additional technical documentation preserved in `docs/archive/`:

| Document | Contents |
|----------|----------|
| `whiteboard-api-reference.md` | Detailed markup parsing, WebSocket integration |
| `VOICE_CHAT_ENHANCEMENTS.md` | Voice pipeline evolution, ACTFL tracking details |
| `NATIVE_SUBTITLE_TIMESTAMPS.md` | Cartesia timestamp implementation |
| `SUBTITLE_BUG_TRACKING.md` | Subtitle system debugging history |
| `LLM-Migration-Analysis.md` | OpenAI → Gemini migration analysis |
| `institutional-standards-integration.md` | ACTFL standards implementation |

---

*Last updated: December 2025*

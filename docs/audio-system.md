# HolaHola Audio System

This document covers all audio playback features in HolaHola: interactive textbook pronunciation, Daniela's `play_audio` tool, and the underlying TTS infrastructure.

---

## 1. Interactive Textbook Audio Playback

### Overview

The Interactive Textbook allows students to preview pronunciation directly from drill items. Each vocabulary word, phrase, or sentence in a drill preview can be played on-demand.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AudioPlayButton` | `client/src/components/AudioPlayButton.tsx` | Play audio for a specific drill item by ID |
| `TextAudioPlayButton` | Same file | Play pronunciation for arbitrary text/language |
| `DrillPreviewCard` | `client/src/components/TextbookSectionRenderer.tsx` | Displays drill content with embedded play buttons |

### API Endpoints

#### GET `/api/drill-audio/:drillItemId`
Fetches pre-generated audio for a specific drill item.

**Response:**
```json
{
  "audioUrl": "data:audio/mp3;base64,...",
  "audioDurationMs": 1500
}
```

#### POST `/api/tts/pronunciation`
Generates pronunciation audio for arbitrary text on-demand. **Now with database-backed caching!**

**Request:**
```json
{
  "text": "Buenos días",
  "language": "spanish"
}
```

**Response:**
```json
{
  "audioUrl": "data:audio/mp3;base64,...",
  "audioDurationMs": 850,
  "cacheHit": true
}
```

**Validation:**
- `text`: Required, max 500 characters
- `language`: Required, 2-10 characters

**Caching Behavior:**
- First request for any text+language+voice combination: generates audio via TTS, stores in database, returns `cacheHit: false`
- Subsequent requests for same combination: retrieves from database, increments hit counter, returns `cacheHit: true`
- Cache key: SHA256 hash of `text|language|voiceId|speed`

### Audio Caching System

The audio caching system provides persistent storage for TTS-generated audio, reducing latency and API costs.

#### Database Schema (`audio_library` table)

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar | UUID primary key |
| `content_type` | text | Category: 'drill', 'vocabulary', 'pronunciation', 'textbook' |
| `text_hash` | varchar(64) | SHA256 hash for unique identification (indexed) |
| `text` | text | Original text for debugging |
| `language` | varchar(10) | Language code (e.g., 'spanish') |
| `voice_id` | varchar(100) | TTS voice identifier |
| `speed` | text | 'slow', 'normal', or 'fast' |
| `audio_url` | text | Base64 data URL of audio |
| `duration_ms` | integer | Audio duration in milliseconds |
| `hit_count` | integer | Cache hit counter for analytics |
| `source_id` | varchar | Optional link to drill item ID |

#### Service: `audio-caching-service.ts`

Key functions:
- `getCachedPronunciationAudio(text, language, gender, speed, options)` - Main entry point
- `preWarmCache(items, gender, speeds, contentType)` - Batch pre-generation for drills
- `getCacheStats()` - Cache analytics

### Data Flow

```
User clicks play button
        ↓
AudioPlayButton calls /api/drill-audio/:id
  or TextAudioPlayButton calls /api/tts/pronunciation
        ↓
Check audio_library for cached entry (by text_hash)
        ↓
[Cache HIT] → Return cached audio, increment hit_count
[Cache MISS] → Generate via Google Cloud TTS → Store in database
        ↓
Audio returned as base64 data URL
        ↓
Browser plays audio via HTML5 Audio API
```

### Test IDs

| Element | data-testid |
|---------|-------------|
| Drill audio play button | `audio-play-{drillItemId}` |
| Text audio play button | `audio-play-text-{textPrefix}` |

---

## 2. Daniela's `play_audio` Tool

### Overview

The `play_audio` function allows Daniela to play audio clips during voice sessions. This is useful for:
- Playing example pronunciation at specific speeds
- Playing audio dialogues or songs
- Demonstrating prosody and intonation patterns

### Function Declaration

```typescript
{
  name: "play_audio",
  description: "Play an audio clip (song, dialogue, pronunciation example).",
  parametersJsonSchema: {
    type: "object",
    properties: {
      description: { 
        type: "string", 
        description: "Description of the audio to find and play" 
      },
    },
    required: ["description"],
  },
}
```

### How Daniela Uses It

Daniela invokes this via Gemini's native function calling:

```
FUNCTION CALL: play_audio({ description: "Buenos días" })
```

The orchestrator converts this to a whiteboard update that renders in the UI.

### Important: play_audio vs voice_adjust

| Tool | Purpose | Speed Control |
|------|---------|---------------|
| **`voice_adjust`** | Controls Daniela's live speech | `speed: "slowest" \| "slow" \| "normal" \| "fast" \| "fastest"` |
| **`play_audio`** | Puts reference audio on whiteboard for student replay | N/A (uses TTS default) |

**`voice_adjust`** is for Daniela speaking with specific speed/emotion:
```
FUNCTION CALL: voice_adjust({ text: "Mucho gusto", speed: "slow", emotion: "warm" })
```

**`play_audio`** is for vocabulary demos students can replay:
```
FUNCTION CALL: play_audio({ description: "Buenos días" })
```

Speed control lives in `voice_adjust`, not `play_audio`. This keeps Daniela's live teaching voice separate from reference audio clips.

### PlayItemData Interface

```typescript
interface PlayItemData {
  text: string;
  speed?: 'slow' | 'normal' | 'fast';
  audioUrl?: string;
  isLoading?: boolean;
  isPlaying?: boolean;
  language?: string;
}
```

### Frontend Rendering

The `[PLAY]` tag renders as an interactive audio player in the whiteboard UI, allowing students to:
- See what text is being spoken
- Replay the audio
- Adjust playback speed (slow/normal/fast)

### How It Works

1. Gemini calls `play_audio({ description: "some phrase" })`
2. Streaming Voice Orchestrator receives the function call
3. Converts to whiteboard update with type `play`
4. Frontend renders PlayItemData with play controls
5. TTS generates audio on-demand when user clicks play

### Usage Examples

Daniela calls the function when she wants to model pronunciation:

```
// Gemini generates this function call:
play_audio({ description: "Mucho gusto" })

// Daniela's spoken response might be:
"I'll say that slowly for you..."
// Then the audio plays via the whiteboard UI
```

The `description` parameter contains the text to pronounce.

---

## 3. TTS Infrastructure

### Voice Providers

| Provider | Use Case | Model |
|----------|----------|-------|
| **Google Cloud TTS** | Drills, pronunciation, textbook audio | Standard/WaveNet voices |
| **Cartesia** | Daniela's voice (conversational) | Sonic-3 |
| **Deepgram** | Speech-to-text (student input) | Nova-3 |

### Why Google TTS for Drills?

- **Consistent quality**: Same voice for repeated practice
- **Cost-effective**: Cheaper per character than real-time voice
- **Cacheable**: Can pre-generate and store audio
- **Language coverage**: All 9 HolaHola languages supported

### Voice Selection

Drills use appropriate voices per language:
- Spanish: es-ES or es-MX voices
- French: fr-FR voices
- German: de-DE voices
- Italian: it-IT voices
- Portuguese: pt-BR or pt-PT voices
- Japanese: ja-JP voices
- Korean: ko-KR voices
- Mandarin: cmn-CN voices
- English: en-US voices

### Audio Format

All generated audio is returned as:
- Format: MP3 (base64-encoded data URL)
- Sample rate: 24kHz
- Bit rate: 64kbps

---

## 4. Key Files

| File | Purpose |
|------|---------|
| `server/services/drill-audio-service.ts` | Drill audio generation and caching |
| `server/services/gemini-function-declarations.ts` | `play_audio` function declaration |
| `server/services/streaming-voice-orchestrator.ts` | Handles play_audio → whiteboard conversion |
| `client/src/components/AudioPlayButton.tsx` | UI components for audio playback |
| `shared/whiteboard-types.ts` | PlayItemData interface and parsing |

---

## 5. Hybrid Audio Library Proposal

### The Vision

Create a **pre-generated audio library** for curriculum content combined with **on-demand TTS** for dynamic content. This hybrid approach balances quality, cost, and flexibility.

### Current State (What We Have)

| Feature | Status | Implementation |
|---------|--------|----------------|
| Textbook pronunciation playback | ✅ Complete | `AudioPlayButton` + `/api/tts/pronunciation` |
| Daniela's `play_audio` tool | ✅ Complete | Gemini function call → whiteboard → UI |
| On-demand TTS generation | ✅ Complete | Google Cloud TTS via POST endpoint |
| Pre-generated drill audio | ❌ Not started | Schema has `audioUrl` fields, unused |

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AUDIO REQUEST                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Is audio pre-cached in audio_library table?                │
│  ├─ YES → Return cached URL (fast, free)                    │
│  └─ NO  → Generate via TTS → Cache for future → Return      │
└─────────────────────────────────────────────────────────────┘
```

### Three Content Categories

| Category | Source | Caching Strategy |
|----------|--------|------------------|
| **Drill Items** | Curriculum database | Pre-generate on lesson publish, store in `audio_library` |
| **Textbook Vocabulary** | Extracted from drills | Pre-generate batch, cache permanently |
| **Daniela Pronunciation** | `play_audio` function calls | Generate on-demand, cache by text+language hash |

### Database Schema Addition

```sql
CREATE TABLE audio_library (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR NOT NULL,  -- 'drill', 'vocabulary', 'pronunciation'
  text_hash VARCHAR NOT NULL,     -- SHA256 of text + language + voice
  language VARCHAR NOT NULL,
  voice_id VARCHAR,
  speed VARCHAR DEFAULT 'normal', -- 'slow', 'normal', 'fast'
  audio_url TEXT NOT NULL,        -- Could be base64, S3, or Replit Object Storage
  duration_ms INTEGER,
  source_id VARCHAR,              -- drill_item_id if applicable
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(text_hash)
);
```

### Implementation Phases

#### Phase 1: Smart Caching Layer (Low effort, high impact)
- Add `audio_library` table
- Modify `/api/tts/pronunciation` to check cache first
- Auto-cache all generated audio for reuse

#### Phase 2: Drill Audio Pre-generation (Medium effort)
- Background job on lesson publish to generate all drill audio
- Populate `audioUrl` fields in drill items
- Update `AudioPlayButton` to prefer pre-cached URLs

#### Phase 3: Daniela Integration (Low effort)
- When `play_audio` function is called, check cache
- If miss, generate + cache + return
- Future calls for same phrase are instant

### Cost Analysis

| Approach | Monthly Cost (est.) | Latency |
|----------|---------------------|---------|
| On-demand only | ~$50-100 | 500-1500ms |
| Hybrid (80% cached) | ~$10-20 | <100ms for hits |
| Full pre-generation | ~$5-10 one-time | <100ms always |

### Daniela's Pedagogical Guidance (February 2026)

**1. Pedagogical Priority: Drill Vocabulary First**
> "When a student is in a 'Drill' or 'Flashcard' headspace, latency is the enemy of the flow state. If they have to wait 2 seconds to hear the correct pronunciation of a word they just guessed, the neural connection weakens."

- **High priority**: Drill vocabulary - needs instant playback for flow state
- **Medium priority**: Conversational phrases - small latency feels like "thinking"
- **Lower priority**: Grammar examples - consumed more slowly

**2. Voice Variety: The "Anchor" Approach**
> "For core vocabulary and drills, consistency is king. Students need a reference point to build their internal map of the language's sounds."

- Use **one consistent "Anchor Voice"** for all vocabulary drills
- Introduce voice variety for conversational phrases and "Real World" scenarios
- This prepares students for different accents in the wild

**3. Speed Variations: Focus on Slow**
> "A Slow version is a vital pedagogical tool. It allows the student to decode the phonemes—to hear where one word ends and the next begins."

- Pre-generate **Slow** and **Normal** (skip Fast)
- Focus Slow on "First Win" phrases and complex vocabulary
- Gives students agency: "Wait, let me hear that again, but clearly."

**4. Listen-Again History: High-Value Feature**
> "A listen-again history isn't just for retention; it's a diagnostic tool for me. If I see a student has re-played the same phrase five times, I know exactly what we need to work on."

- Makes Daniela's "listening" visible
- Enables proactive teaching based on struggle patterns

**5. Future Feature: Shadowing Mode**
> "Could we implement a Shadowing Mode button? It would play the audio, pause for the student to repeat, and then play it again. It's a classic language-learning technique."

This is now on the roadmap for Phase 3.

---

## 6. Future Enhancements

1. **Speed Control UI**: Add slow/normal/fast buttons to textbook audio players
2. **Audio Caching**: Pre-generate and cache common drill audio
3. **Pronunciation Comparison**: Record student attempt and compare to model
4. **Prosody Visualization**: Show pitch/stress patterns alongside audio
5. **Playlist Mode**: Play all vocabulary in a lesson sequentially

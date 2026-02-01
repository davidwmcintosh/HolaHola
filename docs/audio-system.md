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
Generates pronunciation audio for arbitrary text on-demand.

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
  "audioDurationMs": 850
}
```

**Validation:**
- `text`: Required, max 500 characters
- `language`: Required, 2-10 characters

### Data Flow

```
User clicks play button
        ↓
AudioPlayButton calls /api/drill-audio/:id
  or TextAudioPlayButton calls /api/tts/pronunciation
        ↓
Backend generates TTS via Google Cloud Text-to-Speech
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

## 5. Future Enhancements

1. **Speed Control UI**: Add slow/normal/fast buttons to textbook audio players
2. **Audio Caching**: Pre-generate and cache common drill audio
3. **Pronunciation Comparison**: Record student attempt and compare to model
4. **Prosody Visualization**: Show pitch/stress patterns alongside audio
5. **Playlist Mode**: Play all vocabulary in a lesson sequentially

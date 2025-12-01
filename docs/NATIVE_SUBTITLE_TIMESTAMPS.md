# Native Cartesia Subtitle Timestamps

## Overview

LinguaFlow's streaming voice mode now uses **native word-level timestamps** from Cartesia's WebSocket API for precise subtitle synchronization. This replaces the previous server-side bitrate estimation approach with accurate timing data generated during TTS synthesis.

## Architecture

### Data Flow

```
Deepgram STT → Gemini AI → Cartesia TTS → Audio + Timestamps → Client
                              ↓
                    word_timestamps: {
                      words: ["Hola", "amigo"],
                      start: [0.0, 0.42],
                      end: [0.38, 0.89]
                    }
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| CartesiaStreamingService | `server/services/cartesia-streaming.ts` | Requests native timestamps via `add_timestamps: true` |
| StreamingVoiceOrchestrator | `server/services/streaming-voice-orchestrator.ts` | Consumes timestamps and sends to client |
| useStreamingSubtitles | `client/src/hooks/useStreamingSubtitles.ts` | Applies ACTFL-aware timing policies |
| subtitlePolicies | `client/src/lib/subtitlePolicies.ts` | Proficiency-specific timing adjustments |

## Implementation Details

### WebSocket API Configuration

```typescript
// server/services/cartesia-streaming.ts
const response = await this.websocket.send({
  model_id: 'sonic-3',
  transcript: text,
  voice: {
    mode: 'id',
    id: voiceId,
    __experimental_controls: {
      speed: 0.8, // Numeric range: 0.6-1.5
      emotion: ['calm']
    }
  },
  add_timestamps: true, // Enable native word-level timestamps
  output_format: {
    container: 'mp3',
    sample_rate: 44100,
    bit_rate: 128000
  }
});
```

### Timestamp Response Format

Cartesia returns word-level timestamps as parallel arrays:

```typescript
interface CartesiaTimestampMessage {
  word_timestamps: {
    words: string[];  // ["Hola", "amigo", "como", "estas"]
    start: number[];  // [0.0, 0.42, 0.73, 0.96] (seconds)
    end: number[];    // [0.38, 0.69, 0.92, 1.34] (seconds)
  }
}
```

### Atomic Timestamp Retrieval

To prevent race conditions between sentences, timestamps are consumed atomically:

```typescript
// server/services/cartesia-streaming.ts
consumeNativeTimestamps(): WordTiming[] {
  // Clone array to prevent caller mutation, then clear
  const timestamps = [...this.lastNativeTimestamps];
  this.lastNativeTimestamps = [];
  return timestamps;
}
```

## ACTFL-Aware Subtitle Policies

Native timestamps are combined with proficiency-specific timing adjustments:

| Level | Preview Delay | Display Mode | Behavior |
|-------|---------------|--------------|----------|
| Novice | 300ms | Progressive | Words reveal one at a time ahead of audio |
| Intermediate | 150ms | Full sentence | Complete sentence with shorter preview |
| Advanced | 0ms | Mode convergence | Target mode auto-converts to "all" mode |

## Speed Control

Voice speed uses a numeric scale (not strings):

| User Setting | Cartesia Speed Value |
|--------------|---------------------|
| slowest | 0.6 |
| slow | 0.8 |
| normal | 1.0 |
| fast | 1.2 |
| fastest | 1.5 |

```typescript
// Speed mapping in streaming-voice-orchestrator.ts
const speedMap: Record<string, number> = {
  'slowest': 0.6,
  'slow': 0.8,
  'normal': 1.0,
  'fast': 1.2,
  'fastest': 1.5
};
```

## Fallback Behavior

When WebSocket is unavailable, the system falls back to Bytes API with estimated timings:

1. **Detection**: `isConnected()` returns false when `websocket` is null or `connected` is false
2. **Fallback**: Bytes API used with bitrate-based duration estimation
3. **Recovery**: On WebSocket failure, connection state is fully reset:
   ```typescript
   this.connected = false;
   this.websocket = null;
   ```

## Timing Telemetry

For diagnostics, word-level timing drift is logged:

```typescript
// client/src/lib/audioUtils.ts
console.log(`[Subtitle Telemetry] Word: "${word}" | Expected: ${expectedTime}ms | Actual: ${actualTime}ms | Drift: ${drift}ms`);
```

## Files Modified

### Server
- `server/services/cartesia-streaming.ts` - WebSocket API with `add_timestamps: true`
- `server/services/streaming-voice-orchestrator.ts` - Timestamp consumption and forwarding

### Client
- `client/src/hooks/useStreamingSubtitles.ts` - Receives and applies word timings
- `client/src/lib/subtitlePolicies.ts` - ACTFL-level timing adjustments
- `client/src/lib/audioUtils.ts` - Audio-anchored subtitle highlighting

## Troubleshooting

### Subtitles Not Synchronized

1. **Check logs** for `[Cartesia Streaming] Received X native word timestamps`
2. **Verify WebSocket** connection: Should see `Using WebSocket API with native timestamps`
3. **Fallback detection**: If you see `Using bytes API (WebSocket not connected)`, timestamps are estimated

### Race Condition Symptoms

- Subtitles from previous sentence appearing on current audio
- **Solution**: Verify `consumeNativeTimestamps()` is being called (clears after each use)

### Speed Not Applied

- Check logs for `[Cartesia Streaming] Using speed: X`
- Verify numeric speed value (0.6-1.5), not string ("slow"/"fast")

## Performance

| Metric | Value |
|--------|-------|
| Timestamp Accuracy | Aligned to TTS synthesis timing |
| TTFB Impact | Minimal (timestamps arrive with audio) |
| Memory Overhead | Single array per sentence, cleared after use |

## Related Documentation

- `docs/voice-chat-setup.md` - Overall voice architecture
- `replit.md` - System Design Choices section
- `docs/SUBTITLE_BUG_TRACKING.md` - Historical subtitle issues

---

**Implementation Date**: December 1, 2025  
**Status**: Production-ready  
**Author**: LinguaFlow Development Team

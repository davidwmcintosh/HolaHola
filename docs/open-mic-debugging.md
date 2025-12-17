# Open Mic Debugging

**Last Updated:** December 7, 2025  
**Status:** Working - Ready for extended testing

## Overview

Open mic mode allows continuous voice input without holding a button. Uses Deepgram's Voice Activity Detection (VAD) to automatically detect speech start/end and submit transcriptions.

## Architecture

```
Client (Browser)                          Server
─────────────────                         ──────
AudioContext (16kHz) ──────┐
ScriptProcessorNode ───────┼──► WebSocket ──► OpenMicSession
Raw PCM linear16 ──────────┘                    │
                                                ▼
                                          Deepgram Live API
                                          (Nova-2, 'multi' lang)
                                                │
                                                ▼
                                          VAD Events + Transcripts
                                                │
                                                ▼
                                          Auto-submit on speech_final
```

## What's Working

### Core Functionality
- [x] Raw PCM audio capture at 16kHz (linear16 format)
- [x] Automatic resampling if browser uses different sample rate
- [x] WebSocket streaming of audio chunks (`stream_audio_chunk` messages)
- [x] Deepgram live API connection with VAD enabled
- [x] `vad_speech_started` events updating UI to "listening" state
- [x] Transcription using `speech_final` flag (reliable trigger)
- [x] Auto-submit on speech completion
- [x] Bilingual support (English + Spanish code-switching via 'multi' language)

### Session Management
- [x] Session restart on server close (`open_mic_session_closed` event)
- [x] Cleanup on mode switch or disconnect
- [x] Race condition handling with `resolveOnce()` pattern

### Barge-in
- [x] User can interrupt Daniela mid-sentence
- [x] Client sends `sendInterrupt()` (not `stop()`)
- [x] Server sets `isInterrupted` flag during TTS streaming
- [x] Response completes gracefully with `wasInterrupted: true`

## Key Configuration

### Environment Variables (Deepgram Feature Flags)
```bash
# Model selection - Nova-3 is available on all plans (Dec 2024)
DEEPGRAM_MODEL=nova-3           # Default: nova-3 (best quality)

# Intelligence features - available on all plans with concurrency limits
DEEPGRAM_INTELLIGENCE_ENABLED=true  # Default: enabled
                                     # Set to 'false' to disable
```

**Note**: Open-mic mode always uses Nova-3 for streaming because Nova-2 
with 'multi' language mode returns empty transcripts.

### Concurrency Limits by Deepgram Plan (Dec 2024 - Confirmed)

All features are **available on all plans** - only concurrency limits differ:

| Service | Pay-as-You-Go | Growth | Enterprise |
|---------|---------------|--------|------------|
| Nova-3 Pre-recorded | 100 concurrent | 100 concurrent | 100+ (custom) |
| Nova-3 Streaming | 50 concurrent | 50 concurrent | 100+ (custom) |
| Intelligence (Intent, Sentiment, etc.) | 10 concurrent | 10 concurrent | 10+ (custom) |

**Combined Limits**: When using STT + Intelligence together, the lower limit applies.
For example: STT (100) + Intent (10) = 10 effective concurrent requests.

**Intelligence Features** (pre-recorded/PTT only):
- Intent Recognition (English only)
- Sentiment Analysis
- Topic Detection
- Summarization
- Diarization

### Deepgram Settings
```typescript
// Open-mic (live streaming)
{
  model: 'nova-3',          // Always nova-3 for multi-language
  language: 'multi',        // Bilingual detection (student's native + target)
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
  vad_events: true,
  utterance_end_ms: 1400,   // 1.4s pause allows natural thinking
  smart_format: true,
  punctuate: true,
  diarize: true,            // Speaker separation (when intelligence enabled)
}

// PTT (pre-recorded) - supports full intelligence
{
  model: 'nova-3',
  language: 'es',           // Single language for PTT
  punctuate: true,
  smart_format: true,
  diarize: true,
  sentiment: true,          // Student emotional state
  intents: true,            // What student is trying to do (English only)
  topics: true,             // Subject matter detection
  summarize: 'v2',          // Conversation synopsis
}
```

### Audio Format
- Format: Raw PCM, linear16
- Sample rate: 16kHz
- Channels: Mono (1)
- Capture method: ScriptProcessorNode

## Key Files

| File | Purpose |
|------|---------|
| `server/services/deepgram-live-stt.ts` | OpenMicSession class, Deepgram connection |
| `server/services/streaming-voice-orchestrator.ts` | Session management, message routing |
| `server/unified-ws-handler.ts` | WebSocket message handling |
| `client/src/hooks/useStreamingVoice.ts` | Client-side state management |
| `client/src/lib/streamingVoiceClient.ts` | WebSocket client, event types |
| `client/src/components/StreamingVoiceChat.tsx` | UI integration, callbacks |

## Bug Fixes Applied

### 1. Spanish-Only Detection → Bilingual Support
**Problem:** Using 'es' (Spanish) language code missed English words in mixed speech  
**Solution:** Changed to 'multi' language code for automatic language detection  
**File:** `server/services/deepgram-live-stt.ts`

### 2. UtteranceEnd Event Not Firing Consistently
**Problem:** Relying on `UtteranceEnd` event didn't work reliably  
**Solution:** Changed to use `speech_final` flag on transcript results as trigger  
**File:** `server/services/deepgram-live-stt.ts`

### 3. Deepgram Connection Race Condition
**Problem:** Multiple connection attempts could cause race conditions  
**Solution:** Implemented `resolveOnce()` pattern for connection promise  
**File:** `server/services/deepgram-live-stt.ts`

### 4. Session Stuck After AI Response
**Problem:** After AI response, client recording continued but server closed session  
**Solution:** Added `open_mic_session_closed` event to notify client, auto-restart  
**Files:** 
- `server/services/streaming-voice-orchestrator.ts` (server notification)
- `client/src/lib/streamingVoiceClient.ts` (event type)
- `client/src/hooks/useStreamingVoice.ts` (handler)
- `client/src/components/StreamingVoiceChat.tsx` (restart logic)

## Console Log Prefixes

When debugging, look for these log prefixes:

```
[OPEN MIC]           - Client-side open mic events
[Deepgram Live STT]  - Server-side Deepgram connection
[OpenMicSession]     - Server-side session management
[StreamingVoice]     - Client hook state changes
```

## Testing Checklist

### Basic Flow
- [ ] Toggle to open mic mode in settings
- [ ] Speak naturally - should auto-detect speech start
- [ ] Pause speaking - should auto-submit after ~1 second
- [ ] Daniela responds - subtitles and audio work
- [ ] After response ends - open mic should auto-restart

### Bilingual
- [ ] Speak in Spanish - transcribed correctly
- [ ] Speak in English - transcribed correctly
- [ ] Mix languages in same sentence - both detected

### Edge Cases
- [ ] Long silence before speaking
- [ ] Very short utterances
- [ ] Speaking while Daniela is responding (barge-in)
- [ ] Switching between PTT and open mic modes
- [ ] Background noise handling

## Known Limitations

1. **Echo Prevention:** Not yet implemented - speaking while audio plays may cause feedback
2. **Model:** Using Nova-2 (not Nova-3) for open mic - Nova-3 is used for PTT
3. **Session Timeout:** Deepgram may close session after extended silence (~10+ seconds)

## Next Steps (Future)

- [ ] Echo cancellation during playback
- [ ] Real-time pronunciation feedback
- [ ] Interim transcript display (currently just logged)
- [ ] Visual VAD indicator (waveform or pulse)

## Debug Commands

In browser console:
```javascript
// Enable verbose logging
window._debugVoice = true;

// Check open mic state
window._openMicState

// View recent parse errors (if any)
window._parseErrors
```

## Version History

| Date | Change |
|------|--------|
| Dec 7, 2025 | Initial implementation complete |
| Dec 7, 2025 | Fixed bilingual support with 'multi' language |
| Dec 7, 2025 | Added session restart on server close |
| Dec 7, 2025 | Documentation created |

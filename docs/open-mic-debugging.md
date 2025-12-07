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

### Deepgram Settings
```typescript
{
  model: 'nova-2',
  language: 'multi',  // Key: enables bilingual detection
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
  vad_events: true,
  utterance_end_ms: 1000,  // 1 second of silence triggers end
  smart_format: true,
  punctuate: true
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

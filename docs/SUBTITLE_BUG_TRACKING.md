# Subtitle Bug Tracking Document

## Last Updated: December 2, 2025 (Progressive Streaming Debug Session)

---

## Progressive Streaming Implementation (Dec 2, 2025 - Ongoing)

### Context
After achieving the 3-second voice response target with progressive PCM streaming (~2.0s TTFA), we discovered that subtitle word highlighting stopped working. This document tracks the progressive streaming debugging session.

### Milestone Achieved (Before Issues)
- **Target Met:** Sub-3-second voice response times
- **TTFA (Time to First Audio):** ~2.0 seconds
- **Architecture:** Progressive PCM streaming with gapless playback
- **Audio Format:** PCM Float32 @ 24kHz via WebSocket

---

## Progressive Streaming Architecture

### Data Flow
```
Server (Progressive):
┌──────────────────────────────────────────────────────────────────┐
│ Gemini Streaming → Sentence chunks (as they're generated)       │
│         ↓                                                         │
│ Cartesia WebSocket → PCM chunks + native word timestamps        │
│         ↓                                                         │
│ Word timestamps sent as word_timing_delta (per word)            │
│ Audio chunks sent as audio_chunk (per ~17KB chunk)              │
│ Final timings sent as word_timing_final (sentence complete)     │
└──────────────────────────────────────────────────────────────────┘
                              ↓
Client (Progressive):
┌──────────────────────────────────────────────────────────────────┐
│ streamingVoiceClient.ts → Receives WebSocket messages           │
│         ↓                                                         │
│ useStreamingVoice.ts → Routes to handlers:                      │
│   - handleAudioChunk → enqueueProgressivePcmChunk()             │
│   - handleWordTimingDelta → addProgressiveWordTiming()          │
│   - handleWordTimingFinal → finalizeWordTimings()               │
│         ↓                                                         │
│ audioUtils.ts (StreamingAudioPlayer):                           │
│   - Schedules PCM chunks via AudioContext                       │
│   - Fires onSentenceStart when first chunk plays                │
│   - Runs precision timing loop (RAF) for subtitle sync          │
│         ↓                                                         │
│ useStreamingSubtitles.ts:                                        │
│   - startPlayback() sets activeSentenceRef                      │
│   - updatePlaybackTime() calculates active word from timings    │
│   - Word highlighting rendered in ImmersiveTutor.tsx            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Bug #1: Audio Playing at Wrong Speed (RESOLVED)

### Symptoms
- Audio playing too fast or too slow
- Sentences completing faster than expected
- Timing completely off for subtitle sync

### Root Cause
The progressive precision timing was using `performance.now()` instead of `AudioContext.currentTime`. The calculation for elapsed time was incorrect:
```javascript
// BROKEN: Used performance.now() which doesn't track actual audio time
const elapsedMs = performance.now() - this.playbackStartTime;
currentTime = elapsedMs / 1000;
```

### Fix Applied (Dec 2, 2025)
1. Added `progressivePlaybackStartCtxTime` to track when audio starts in AudioContext time
2. Added `progressiveTotalDuration` to accumulate total audio duration
3. Created new `startProgressivePrecisionTiming()` method using AudioContext time

```javascript
// FIXED: audioUtils.ts - startProgressivePrecisionTiming()
const elapsedCtxTime = ctx.currentTime - this.progressivePlaybackStartCtxTime;
const currentTime = Math.max(0, elapsedCtxTime);
this.callbacks.onProgress?.(currentTime, this.progressiveTotalDuration);
```

### Files Modified
- `client/src/lib/audioUtils.ts`:
  - Added `progressivePlaybackStartCtxTime` field
  - Added `progressiveTotalDuration` field
  - Added `startProgressivePrecisionTiming()` method
  - Updated `enqueueProgressivePcmChunk()` to track timing correctly
  - Updated `resetProgressiveState()` to clear new fields

### Status: ✅ RESOLVED
Audio now plays at correct speed.

---

## Bug #2: Subtitle Word Highlighting Not Working (OPEN)

### Symptoms
- Audio plays correctly at normal speed
- Words render on screen but never highlight
- `activeWordIndex` always -1 in logs
- Final words of sentences sometimes missing

### Investigation Timeline

#### Observation 1: Word Timings Are Being Sent
Server logs confirm `word_timing_delta` messages are sent:
```
[Progressive] Sending word_timing_delta: sentence=0, word=0 "Hi"
[Progressive] Sending word_timing_delta: sentence=0, word=1 "David!"
```

#### Observation 2: Timings Not Reaching currentTimingsRef
The `updatePlaybackTime` function logs show:
```
[SUBTITLE DEBUG] updatePlaybackTime: NO TIMINGS (activeSentence=X, time=Y)
```

This means `currentTimingsRef.current` is empty when playback time updates arrive.

### Root Cause Analysis (Architect Review)

The architect identified a potential issue:

1. **turnId Mismatch Theory**: In `useStreamingVoice.ts`, the `onSentenceStart` callback uses `currentTurnIdRef.current` which might not be set yet when the first audio chunk starts playing.

2. **Timing Race Condition**: 
   - `word_timing_delta` arrives and stores in `timingsBySentenceRef`
   - `audio_chunk` (first) triggers `onSentenceStart` → `startPlayback(sentenceIndex, currentTurnIdRef.current)`
   - If `currentTurnIdRef.current` is stale, `startPlayback` won't find the sentence
   - `currentTimingsRef.current` remains empty

3. **activeSentenceRef vs currentSentenceIndex**: 
   - `addProgressiveWordTiming` checks `if (sentenceIndex === activeSentenceRef.current)`
   - If `activeSentenceRef.current` isn't set (startPlayback not called yet), timings aren't copied to `currentTimingsRef`

### Code Flow (Expected vs Actual)

**Expected:**
1. `processing` message → sets `currentTurnIdRef.current = turnId`
2. `sentence_start` message → `addSentence()` stores sentence
3. `audio_chunk` (first) → `onSentenceStart()` → `startPlayback(sentenceIndex, turnId)`
4. `startPlayback` loads cached timings into `currentTimingsRef.current`
5. `word_timing_delta` → `addProgressiveWordTiming()` updates `currentTimingsRef`
6. RAF loop calls `onProgress()` → `updatePlaybackTime()` → word highlighting works

**Actual (Suspected):**
1. Messages arrive in correct order
2. But `startPlayback` uses stale `currentTurnIdRef.current` (0 at startup)
3. OR `startPlayback` not finding sentence in sentences array
4. OR `currentTimingsRef.current` not being populated

### Debug Logging Added (Dec 2, 2025)

Added console.error traces at key points:

```javascript
// audioUtils.ts - enqueueProgressivePcmChunk()
console.error(`[AUDIO DEBUG] >>> Firing onSentenceStart(${sentenceIndex}) <<<`);

// audioUtils.ts - startProgressivePrecisionTiming()
console.error(`[PROGRESS DEBUG] RAF frame ${frameCount}, time: ${currentTime}s`);

// useStreamingSubtitles.ts - updatePlaybackTime()
console.error(`[SUBTITLE DEBUG] updatePlaybackTime: NO TIMINGS (activeSentence=${activeSentenceRef.current})`);
console.error(`[SUBTITLE DEBUG] updatePlaybackTime: ${timings.length} timings, time=${currentTime}`);
```

### Next Steps
1. Run a test session and capture browser console logs
2. Verify `onSentenceStart` callback fires with correct sentenceIndex
3. Verify `startPlayback` is called and finds the sentence
4. Verify `currentTimingsRef.current` gets populated
5. Verify RAF loop is running and calling `onProgress`

### Files Involved
- `client/src/lib/audioUtils.ts` - Audio playback and timing loop
- `client/src/hooks/useStreamingVoice.ts` - Routes messages, manages player callbacks
- `client/src/hooks/useStreamingSubtitles.ts` - Stores timings, calculates word index
- `client/src/lib/streamingVoiceClient.ts` - WebSocket message parsing

### Status: 🔴 OPEN

---

## Bug #3: Missing Words at End of Sentences (OPEN)

### Symptoms
- Final 1-2 words of sentences sometimes don't appear in subtitles
- Audio plays complete sentence but subtitle cuts off early

### Suspected Causes
1. `isLast` flag handling in progressive streaming
2. `word_timing_final` message not being processed correctly
3. Sentence completion triggered before all words displayed

### Status: 🔴 OPEN (May be related to Bug #2)

---

## Key State Variables (Progressive Streaming)

| Variable | Location | Purpose |
|----------|----------|---------|
| `progressiveSentenceIndex` | audioUtils.ts | Current sentence being played progressively |
| `progressivePlaybackStartCtxTime` | audioUtils.ts | AudioContext.currentTime when sentence started |
| `progressiveTotalDuration` | audioUtils.ts | Accumulated duration of all chunks |
| `progressiveFirstChunkStarted` | audioUtils.ts | Whether first chunk has started playing |
| `activeSentenceRef` | useStreamingSubtitles.ts | Sync ref for active sentence (avoids state lag) |
| `currentTimingsRef` | useStreamingSubtitles.ts | Word timings for current sentence |
| `timingsBySentenceRef` | useStreamingSubtitles.ts | Cache of timings by sentence index |
| `progressiveWordMapRef` | useStreamingSubtitles.ts | Sparse map for out-of-order word arrivals |

---

## Progressive Streaming Message Types

### Message: `audio_chunk` (Progressive PCM)
```typescript
{
  type: 'audio_chunk',
  turnId: number,
  sentenceIndex: number,
  chunkIndex: number,        // NEW: Chunk sequence number
  audio: string,             // Base64 PCM Float32 data
  audioFormat: 'pcm_f32le',  // NEW: Format identifier
  sampleRate: 24000,         // NEW: Sample rate
  durationMs: number,
  isLast: boolean
}
```

### Message: `word_timing_delta` (Progressive)
```typescript
{
  type: 'word_timing_delta',
  turnId: number,
  sentenceIndex: number,
  wordIndex: number,         // Which word this timing is for
  word: string,              // The word text
  startTime: number,         // Start time in seconds
  endTime: number,           // End time in seconds
  estimatedTotalDuration?: number
}
```

### Message: `word_timing_final` (Progressive)
```typescript
{
  type: 'word_timing_final',
  turnId: number,
  sentenceIndex: number,
  words: WordTiming[],       // Authoritative final timings
  actualDurationMs: number   // Actual sentence duration
}
```

---

## Changes Made During This Session

### audioUtils.ts
1. Added `progressivePlaybackStartCtxTime` field to track AudioContext start time
2. Added `progressiveTotalDuration` field to accumulate chunk durations
3. Created `startProgressivePrecisionTiming()` method for accurate timing loop
4. Updated `enqueueProgressivePcmChunk()` to:
   - Set `progressivePlaybackStartCtxTime` when first chunk scheduled
   - Accumulate `progressiveTotalDuration` as chunks arrive
   - Call `startProgressivePrecisionTiming()` instead of `startPrecisionTiming()`
5. Updated `resetProgressiveState()` to clear new timing fields

### useStreamingSubtitles.ts
1. Enhanced debug logging in `updatePlaybackTime()` to show stored sentence count

### Debug Window Object
Added `window._wsDebug` for runtime WebSocket message inspection (from earlier in session).

---

## Previous Fixes Reference

### Block-Based Subtitle System (Nov 30, 2025)
Non-contiguous target words handled by block detection. See earlier sections.

### Server-Driven Architecture v2 (Nov 30, 2025)
- `turnId` for packet ordering
- `hasTargetContent` explicit flag
- Stale packet filtering

### isWaitingForContent Fix (Dec 1, 2025)
Moved clearing from `addSentence()` to `startPlayback()` to prevent phantom subtitles.

---

## Testing Checklist (Progressive Streaming)

- [ ] Audio plays at correct speed
- [ ] Words highlight in sync with audio
- [ ] All words in sentence are displayed (no truncation)
- [ ] Subtitle timing smooth (no jumps/stutters)
- [ ] Multiple sentences play back-to-back correctly
- [ ] Turn transitions don't cause phantom subtitles
- [ ] `word_timing_delta` messages appear in browser console
- [ ] `startPlayback` is called for each sentence
- [ ] `updatePlaybackTime` receives non-empty timings

---

## Console Log Patterns to Watch

**Good (Working):**
```
[AUDIO DEBUG] >>> Firing onSentenceStart(0) <<<
[SUBTITLE DEBUG] ▶▶▶ startPlayback called: sentence=0, turn=1
[SUBTITLE DEBUG] LOADED 5 timings for sentence 0
[PROGRESS DEBUG] RAF frame 30, time: 0.500s / 2.500s, sentence=0
[SUBTITLE DEBUG] updatePlaybackTime: 5 timings, time=0.50, sentence=0
```

**Bad (Not Working):**
```
[PROGRESS DEBUG] RAF frame 30, time: 0.500s / 2.500s, sentence=0
[SUBTITLE DEBUG] updatePlaybackTime: NO TIMINGS (activeSentence=0, time=0.50, storedSentences=1)
```

---

## Related Documentation

- `docs/NATIVE_SUBTITLE_TIMESTAMPS.md` - Native Cartesia timestamp implementation
- `replit.md` - System architecture overview
- `VOICE_CHAT_TROUBLESHOOTING.md` - General voice issues

---

## Session Log: December 2, 2025

### 2:00 PM - 6:30 PM: Progressive Streaming Debug Session

**Starting State:**
- 3-second response target achieved with progressive PCM streaming
- Audio playing but subtitles not highlighting

**Issues Discovered:**
1. Audio playing at wrong speed (FIXED)
2. Subtitle word highlighting not working (OPEN)
3. Missing words at end of sentences (OPEN)

**Fixes Applied:**
1. Created AudioContext-based precision timing for progressive playback
2. Added proper duration tracking as chunks accumulate
3. Added extensive debug logging to trace data flow

**Current Status:**
- Audio speed normalized ✅
- Word highlighting still broken ❌
- Need to run test session with new debug logging

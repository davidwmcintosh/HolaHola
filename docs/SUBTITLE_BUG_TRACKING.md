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

## Bug #2: Subtitle Word Highlighting Not Working (RESOLVED ✅)

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

### Root Cause (IDENTIFIED - Dec 2, 2025)

**STALE CLOSURE BUG in Event Handler Registration**

The event handlers in `useStreamingVoice.ts` were using `subtitles` directly with `[subtitles]` as a dependency:

```javascript
// BROKEN: Uses subtitles directly, has [subtitles] dependency
const handleWordTimingDelta = useCallback((msg) => {
  subtitles.addProgressiveWordTiming(...);  // STALE CLOSURE!
}, [subtitles]);
```

**The Problem:**
1. Event listeners are registered ONCE in `connect()` using `clientRef.current.on('wordTimingDelta', handleWordTimingDelta)`
2. When `currentTurnId` changes, `subtitles` object changes → `handleWordTimingDelta` is recreated
3. BUT the event listener STILL points to the OLD `handleWordTimingDelta` with the OLD `subtitles`
4. The old `subtitles` had the old `addProgressiveWordTiming` callback with stale `currentTurnId`
5. Progressive word timings were being processed by stale callbacks, causing them to be ignored

**Why Audio Player Callbacks Worked:**
The audio player callbacks correctly use the ref pattern:
```javascript
onProgress: (currentTime, duration) => {
  subtitlesRef.current.updatePlaybackTime(currentTime, duration);  // Uses REF!
},
```

### Fix Applied (Dec 2, 2025)

Changed all event handlers in `useStreamingVoice.ts` to use `subtitlesRef.current` instead of `subtitles`:

```javascript
// FIXED: Uses subtitlesRef.current, empty dependency array
const handleWordTimingDelta = useCallback((msg) => {
  console.log(`[DELTA RECEIVED] sentence=${msg.sentenceIndex}, word=${msg.wordIndex}`);
  subtitlesRef.current.addProgressiveWordTiming(...);  // USES REF!
}, []);  // No dependencies - ref is always current

const handleWordTiming = useCallback((msg) => {
  subtitlesRef.current.setWordTimings(...);
}, []);

const handleWordTimingFinal = useCallback((msg) => {
  subtitlesRef.current.finalizeWordTimings(...);
}, []);

const handleProcessing = useCallback((msg) => {
  subtitlesRef.current.setCurrentTurnId(msg.turnId);
}, []);

const handleSentenceStart = useCallback((msg) => {
  subtitlesRef.current.addSentence(...);
}, []);
```

### Files Modified
- `client/src/hooks/useStreamingVoice.ts`:
  - `handleWordTimingDelta` → uses `subtitlesRef.current.addProgressiveWordTiming`
  - `handleWordTiming` → uses `subtitlesRef.current.setWordTimings`
  - `handleWordTimingFinal` → uses `subtitlesRef.current.finalizeWordTimings`
  - `handleProcessing` → uses `subtitlesRef.current.setCurrentTurnId`
  - `handleSentenceStart` → uses `subtitlesRef.current.addSentence`
  - All changed from `[subtitles]` dependency to `[]` (empty)

### Verification
Look for `[DELTA RECEIVED]` logs in browser console during voice sessions.
This log confirms the word timing delta is being received and processed correctly.

### Status: ⚠️ REGRESSION - Still Not Working (Dec 2, 2025, 8:00 PM)

Despite the ref pattern fix, word_timing_delta messages are still not being processed.

#### Current Observations (Dec 2 Evening Session):
1. **Server logs confirm messages ARE sent:**
   ```
   [Progressive] Sending word_timing_delta: sentence=0, word=0 "¡Excelente!"
   [SEND DEBUG] word_timing_delta: readyState=1, length=196
   ```

2. **Audio plays correctly** - audio_chunk messages ARE being received

3. **Other message types work:**
   - 'connected' → logs appear
   - 'processing' → turnId updated  
   - 'sentence_start' → subtitle text appears
   - 'audio_chunk' → audio plays

4. **word_timing_delta NOT processed:**
   - No `[WS RECV] >>> WORD_TIMING_DELTA CASE HIT <<<` logs visible
   - No `[DELTA RECEIVED]` logs visible
   - No `[StreamingSubtitles v2] Progressive timing:` logs visible
   - `rawActiveWordIndex` stays at -1

5. **Browser console log capture is severely limited:**
   - Only 4-14 lines captured per snapshot
   - May be missing high-frequency WebSocket logs

#### Key Insight from GPT-5 PDF Document:
The standard TTS sync pattern uses `audio.currentTime` comparison:
```javascript
audio.ontimeupdate = () => {
  const currentTime = audio.currentTime * 1000;
  const active = wordTimings.find(
    w => currentTime >= w.start && currentTime < w.end
  );
};
```
Our architecture uses AudioContext.currentTime for PCM streaming, which is correct.
The issue appears to be that word timings never reach the client despite being sent.

#### Possible Causes:
1. **WebSocket message filtering** - Something blocking specific message types?
2. **JSON parsing issue** - word_timing_delta parsing fails silently?
3. **Event listener not attached** - though other events work
4. **Message order/timing** - delta arrives before handler ready?

#### Debug Tools Added:
- `window._msgCounts` - tracks all received message types
- `window._debugMessages` - stores message history with periodic logging
- `window._wsDebug` - WebSocket debug state

#### Next Steps:
- Have user do voice test and check `window._msgCounts` in browser DevTools
- If word_timing_delta NOT in counts → WebSocket not receiving it
- If word_timing_delta IS in counts → Client-side processing issue

---

## Bug #3: Missing Words at End of Sentences (LIKELY RESOLVED)

### Symptoms
- Final 1-2 words of sentences sometimes don't appear in subtitles
- Audio plays complete sentence but subtitle cuts off early

### Suspected Causes
1. `isLast` flag handling in progressive streaming
2. `word_timing_final` message not being processed correctly
3. Sentence completion triggered before all words displayed

### Update (Dec 2, 2025)
This bug was likely caused by the same stale closure issue as Bug #2.
The `handleWordTimingFinal` handler was also using `subtitles` directly,
which caused the final word timing reconciliation to use stale callbacks.
This has been fixed by switching to `subtitlesRef.current`.

### Status: 🟡 LIKELY RESOLVED (Verify with testing)

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

---

## Session Log: December 2, 2025 (Evening Session - 8:00 PM onwards)

### Major Breakthrough: Messages ARE Arriving

**Key Discovery:**
Browser console logs confirm `word_timing_delta` messages ARE being received by the WebSocket:
```javascript
[WS DEBUG] Messages received: [
  {"type":"word_timing_delta","time":1764706126143},
  {"type":"word_timing_delta","time":1764706129648},
  {"type":"word_timing_delta","time":1764706134374},
  {"type":"word_timing_delta","time":1764706134403},
  {"type":"word_timing_final","time":1764706135743},
  ...
]
```

**The Mystery:**
- Messages tracked in `_debugMessages` (happens BEFORE switch statement)
- Switch case for `word_timing_delta` EXISTS in code (line 454-457)
- But `console.error('[WS RECV] >>> WORD_TIMING_DELTA CASE HIT <<<')` NOT appearing
- Handler `handleWordTimingDelta` should emit event to listeners
- Audio plays correctly (meaning `audio_chunk` case IS being hit)

### Debug Tools Added

**Window Objects to Check After Voice Call:**
```javascript
window._msgCounts       // Message type counts {audio_chunk: 15, word_timing_delta: 4, ...}
window._deltaHits       // Count of times word_timing_delta case was hit
window._lastDelta       // Last word_timing_delta message received
window._debugMessages   // Array of last 50 messages with timestamps
window._wsDebug         // WebSocket debug state object
```

### Debugging Steps for User:
1. Open browser DevTools (F12)
2. Do a voice call
3. After audio plays, type in console:
   - `window._msgCounts` → Should show counts of all message types
   - `window._deltaHits` → Should be a number if switch case hit
   - `window._lastDelta` → Should show message object if case hit

### Hypotheses Under Investigation:

1. **Browser Console Log Throttling:**
   - High-frequency WebSocket logs may be throttled
   - Window object tracking bypasses this limitation

2. **Switch Case Not Executing:**
   - Messages tracked but case not hit?
   - Possible JavaScript quirk with switch/case?

3. **Event Listener Timing:**
   - Listeners registered in connect()
   - Messages may arrive before listeners attached?

### PDF Insight (attached_assets/LinguaFlow_from_GPT_5_1764705612104.pdf):
Standard TTS sync pattern from GPT-5 recommendations:
```javascript
audio.ontimeupdate = () => {
  const currentTime = audio.currentTime * 1000;
  const active = wordTimings.find(
    w => currentTime >= w.start && currentTime < w.end
  );
};
```
Our architecture uses AudioContext.currentTime for PCM streaming (correct approach).
The issue is upstream - word timing data not reaching the comparison logic.

### Next Steps:
- [ ] User tests with `window._deltaHits` check
- [ ] If _deltaHits is 0, switch case not executing despite message arrival
- [ ] If _deltaHits > 0, issue is in handleWordTimingDelta or event emission

---

## Session Log: December 2, 2025 (Late Evening - 9:00 PM onwards)

### MAJOR BREAKTHROUGH: Complete Message Chain Verified ✅

**Confirmed Working (Dec 2, 9:12 PM):**
1. Server sends word_timing_delta → ✅ Confirmed in logs
2. Client WebSocket receives message → ✅ Confirmed
3. Switch case is hit → ✅ User saw explicit log
4. Event is emitted → ✅ `[EMIT] wordTimingDelta -> 1 listeners`
5. Event listener subscribed → ✅ `[EMIT] wordTimingFinal -> 1 listeners`

**User Observations:**
```
[EMIT] wordTimingFinal -> 1 listeners
[EMIT] wordTimingDelta -> 1 listeners
```

Both delta AND final events have exactly 1 listener each. The entire message chain is working!

### Current Symptoms (After Chain Verification):
1. **All subtitles display** - Text IS appearing on screen ✅
2. **"A few blips of highlighting"** - SOME highlighting happens (intermittent!)
3. **"Very little audio"** - Audio playback is broken/intermittent

### Root Cause Analysis: Audio Playback Issue

The "a few blips of highlighting" combined with "very little audio" reveals the actual issue:
- **Word highlighting depends on audio playback time**
- `updatePlaybackTime(currentTime)` is called by audio player's onProgress callback
- If audio isn't playing, currentTime doesn't advance, so highlighting doesn't progress
- When audio briefly plays, we see "blips" of highlighting

### Answer to Key Question: "Would recent changes really cause this?"

**Short Answer: Possibly, but not definitively.**

The progressive PCM streaming architecture IS a significant change:
1. Uses `AudioContext.currentTime` instead of `HTMLAudioElement.currentTime`
2. Schedules chunks via `source.start(playTime)` instead of playing a complete audio file
3. Uses RAF-based timing loop that depends on AudioContext state

**However:**
- The user reported the feature "WAS working before" the current session
- This suggests something may have regressed or there's an environmental factor

**Possible Causes for Intermittent Audio:**
1. **AudioContext suspension** - Browsers suspend AudioContext when tab loses focus
2. **Scheduling timing** - If chunks schedule in the past, they won't play
3. **Sample rate mismatch** - Audio decoded at wrong rate
4. **Tab/window focus** - Different behavior in preview pane vs separate tab

### Environment Observations:
- User tested in "preview pane" - cached/old code, choppy audio
- User tested in "separate tab" - current code, very little audio
- These different environments may have different AudioContext behaviors

### Diagnostic Logging Added (Dec 2, 9:27 PM):
```javascript
// In audioUtils.ts - enqueueProgressivePcmChunk:
console.error(`[AUDIO STATE] Chunk ${sentenceIndex}:${chunkIndex} - ctx.state=${ctx.state}`);

// In audioUtils.ts - timing loop:
console.error(`[TIMING LOOP] frame=${frameCount}, elapsed=${currentTime.toFixed(3)}s, ctx.state=${ctx?.state}`);
```

### Diagnostic Questions to Answer:
1. Is AudioContext staying in "running" state? (`[AUDIO STATE]` logs)
2. Is the timing loop advancing? (`[TIMING LOOP]` logs with increasing elapsed time)
3. Are audio chunks being scheduled correctly? (ctx.currentTime in logs)

### Hypothesis Ranking:

| Rank | Hypothesis | Evidence |
|------|------------|----------|
| 1 | AudioContext suspension | "Very little audio" suggests playback stops |
| 2 | Timing loop not firing | "Blips" of highlighting (not continuous) |
| 3 | Chunk scheduling issues | Intermittent audio playback |
| 4 | State management race | Works sometimes, not always |

### Status: 🔴 INVESTIGATION CONTINUES

The message chain is verified working. The issue is downstream in audio playback.
Next step: User tests with new [AUDIO STATE] and [TIMING LOOP] diagnostics.

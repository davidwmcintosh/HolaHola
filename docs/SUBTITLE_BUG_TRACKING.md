# Subtitle Bug Tracking Document

## Last Updated: November 30, 2025 (Late Evening Session - 8:10 PM)

---

## Architecture Redesign (Nov 30, 2025)

### Previous Architecture (DEPRECATED)
The old system used a client-side `lastNonEmptyTargetText` fallback pattern:
- Client maintained fallback text for when current sentence had no target language
- Race conditions between React state updates caused phantom subtitles
- Multiple fixes attempted but timing issues persisted

### New Architecture: Server-Driven Subtitle System (v2)
**Philosophy:** Server is the single source of truth. Client is a "dumb renderer."

Key changes:
1. **turnId**: Monotonic ID for each assistant response turn
2. **hasTargetContent**: Explicit boolean flag from server per sentence
3. **No client-side fallback logic**: Eliminated all race conditions
4. **Stale packet filtering**: Packets with old turnId are dropped

```
Server Side:
┌──────────────────────────────────────────────────────────────────┐
│ streaming-voice-orchestrator.ts                                  │
│ ├── Tracks turnId (increments each response)                     │
│ ├── Calls extractTargetLanguageWithMapping(displayText, rawText) │
│ ├── Sends sentence_start with:                                   │
│ │   - turnId                                                     │
│ │   - hasTargetContent (explicit boolean)                        │
│ │   - targetLanguageText                                         │
│ │   - wordMapping                                                │
│ └── Sends word_timing with turnId                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Client Side:
┌──────────────────────────────────────────────────────────────────┐
│ useStreamingVoice.ts                                             │
│ ├── On 'processing' message: calls setCurrentTurnId(turnId)      │
│ ├── On 'sentence_start': passes turnId + hasTargetContent        │
│ └── All callbacks include turnId for packet ordering             │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ useStreamingSubtitles.ts (v2 - Server-Driven)                    │
│ ├── setCurrentTurnId(): Clears ALL state for new turn            │
│ │   - setSentences([])                                           │
│ │   - setHasTargetContent(false) ← CRITICAL: immediate hide      │
│ │   - Clear all refs                                             │
│ ├── addSentence(): Filters stale packets (turnId < currentTurnId)│
│ ├── hasTargetContent: Server-driven flag (no fallback!)          │
│ └── No lastNonEmptyTargetText (removed)                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ ImmersiveTutor.tsx (Rendering)                                   │
│ ├── Guards: isWaitingForContent, isRecording, isProcessing       │
│ ├── Target mode: Uses hasTargetContent flag from server          │
│ ├── Double-gated: parent hasTargetContent && sentence.hasTarget  │
│ └── Renders karaoke-style progressive reveal                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Current Open Bugs

### Bug #1: Phantom Subtitles
**Status:** OPEN - Under Investigation  
**Severity:** High  
**First Reported:** November 2025  
**Last Tested:** November 30, 2025 (Evening)

**Description:**  
Old Spanish/target language words stay visible on screen when the tutor speaks English-only sentences. Despite the new server-driven architecture, phantoms are still being observed.

**Testing Session (Nov 30, 2025 Evening):**

| Turn | User Said | Tutor Response | Phantom? |
|------|-----------|----------------|----------|
| 1 | (greeting) | "Hi David!...Can you try saying Hola?" | No |
| 2 | "Hola" | "¡Excelente!...Buenos días" | TBD |
| 3 | "Buenos días" | "¡Fantástico!...Buenas tardes" | TBD |
| 4 | "Buenas tardes" | "¡Estupendo!...Buenas noches" | TBD |
| 5 | "Buenas noches" | "¡Increíble!...¿Cómo estás?" | **YES** |

**Observations from Turn 5:**
- Server generated: "¡Increíble! You're picking these up so quickly..."
- Server synthesized: 126,686 bytes audio (7,918ms)
- **User reports: Tutor did NOT say "Increíble"** ← Audio issue
- **User reports: Phantom subtitles appeared**

**Hypotheses for Current Bug:**

1. **Audio Chunk Loss**: The audio for "¡Increíble!" may not have been received/played by client
   - Server shows 126,686 bytes sent
   - Need to verify client received and played all chunks

2. **Turn Boundary State**: Despite new architecture, state may not be clearing correctly
   - `setCurrentTurnId` should clear ALL state
   - Possible: React batching still causing issues?

3. **hasTargetContent Stale Value**: The flag might not update fast enough
   - Double-gating should prevent this
   - Need more logging at render time

**Debug Logging Added (v2):**

```
[StreamingSubtitles v2] New turn: X
[StreamingSubtitles v2] Add sentence X (turn Y): hasTarget=Z
[StreamingSubtitles v2] Ignoring stale sentence (turnId X < current Y)
[SUBTITLE DEBUG v2] { mode, hasTargetContent, streamingText, streamingTargetText, wordIndex }
[SUBTITLE DEBUG] Target render check: { allWordsCount, activeWordIndex, willRender }
[SUBTITLE GUARD] Hidden: reason
```

**Next Steps:**
1. Add audio chunk receipt logging to verify all chunks arrive
2. Add logging at exact moment of turn transition
3. Verify `setCurrentTurnId` clears refs synchronously before any render
4. Check if processing message arrives BEFORE old turn's last audio chunk finishes

---

### Bug #2: Words Displayed But Not Spoken ("Increíble" Bug)
**Status:** OPEN - Confirmed in Testing  
**Severity:** High  
**First Reported:** November 30, 2025

**Description:**  
Target language words appear in subtitles that were never actually spoken by the tutor. 

**Test Session Evidence (Nov 30 Evening):**
- Turn 5: Subtitle showed "¡Increíble!" 
- User confirms: Tutor did NOT say "Increíble"
- Server logs show audio was synthesized (126,686 bytes)
- **Possible: Audio chunk dropped/not played**

**Root Cause Hypotheses:**

1. **Audio Playback Failure**: TTS audio was generated but not all chunks played
   - Check `StreamingAudioPlayer` for dropped chunks
   - Check WebSocket for missing audio_chunk messages

2. **Early Sentence Completion**: Sentence marked complete before audio finished
   - Check `sentence_complete` timing vs audio playback

3. **Buffer Underrun**: Audio queue exhausted before full playback
   - Check for queue empty conditions during playback

**Related Code:**
- `client/src/lib/audioUtils.ts`: `StreamingAudioPlayer` class
- `client/src/lib/streamingVoiceClient.ts`: Audio chunk handling
- `server/services/streaming-voice-orchestrator.ts`: Audio streaming

**Debug Logging Needed:**
```javascript
[AUDIO PLAYER] Audio chunk added to queue. Queue size: X
[AUDIO PLAYER] Playing chunk, queue remaining: X
[AUDIO PLAYER] Queue empty, stopping playback
[AUDIO PLAYER] Chunk finished, playing next...
```

---

### Bug #3: Duplicate Audio Playback ("That was perfect" twice)
**Status:** OPEN - Reported  
**Severity:** Medium  
**First Reported:** November 30, 2025

**Description:**  
User reported hearing "that was perfect" spoken twice by the tutor in a single turn.

**Investigation:**
- Server logs showed only ONE instance of "That was perfect" generated
- Possible causes:
  1. Audio buffer cached from previous session
  2. Network packet duplication
  3. Audio queue double-play bug

**Debug Logging Needed:**
- Track audio chunk IDs to detect duplicates
- Log when audio queue is cleared between turns

---

### Bug #3 (Original): Incomplete Word Display
**Status:** FIXED  
**Severity:** Medium  
**Fixed:** November 30, 2025

**Description:**  
Multi-word phrases were being truncated. When the tutor says "que bien", only "que" appeared in subtitles.

**Fix Applied:**
Added missing phrases to `COMMON_PHRASES` and individual words to `COMMON_SHORT_FOREIGN_WORDS` in `server/text-utils.ts`.

---

## Key State Variables (v2 Architecture)

| Variable | Location | Purpose |
|----------|----------|---------|
| `currentTurnId` | useStreamingSubtitles | Current turn being rendered |
| `hasTargetContent` | useStreamingSubtitles | Server flag: does current sentence have target language |
| `sentences` | useStreamingSubtitles | Array of sentences for current turn |
| `currentSentenceIndex` | useStreamingSubtitles | Which sentence is currently playing |
| `currentSentenceTargetText` | useStreamingSubtitles | Target text (double-gated on hasTargetContent) |
| `isWaitingForContent` | useStreamingSubtitles | Guard: hide subtitles after reset until content arrives |

**Removed Variables (v2):**
- ~~`lastNonEmptyTargetText`~~ - Removed, was source of race conditions
- ~~`lastNonEmptyTargetTextRef`~~ - Removed with fallback logic

---

## Server Protocol (v2)

### Message: `processing`
```typescript
{
  type: 'processing',
  turnId: number,      // NEW: Monotonic turn identifier
  userTranscript: string
}
```
**Client action:** Call `subtitles.setCurrentTurnId(turnId)` to clear ALL state

### Message: `sentence_start`
```typescript
{
  type: 'sentence_start',
  turnId: number,           // NEW: For stale packet filtering
  sentenceIndex: number,
  text: string,
  hasTargetContent: boolean, // NEW: Explicit flag from server
  targetLanguageText?: string,
  wordMapping?: [number, number][]
}
```
**Client action:** 
1. Filter if `turnId < currentTurnId`
2. Call `addSentence` with `hasTargetContent` flag

### Message: `word_timing`
```typescript
{
  type: 'word_timing',
  turnId: number,           // NEW: For stale packet filtering
  sentenceIndex: number,
  timings: WordTiming[]
}
```

### Message: `audio_chunk`
```typescript
{
  type: 'audio_chunk',
  turnId: number,           // NEW: For stale packet filtering
  sentenceIndex: number,
  data: string,             // Base64 audio
  isFirst: boolean,
  isLast: boolean
}
```

---

## Debug Console Commands

To trace subtitle issues in browser console:

```javascript
// Watch for phantom detection
console.log = ((orig) => (...args) => {
  if (args[0]?.includes?.('SUBTITLE') || args[0]?.includes?.('PHANTOM')) {
    console.trace(...args);
  }
  return orig(...args);
})(console.log);

// Check current subtitle state
window.__subtitleState = () => {
  // Add to useStreamingSubtitles if needed
};
```

---

## Testing Checklist (v2)

When testing subtitle fixes:

- [ ] Say "hola" - tutor responds with Spanish, subtitles should show
- [ ] Wait for English follow-up sentence - Spanish should IMMEDIATELY disappear
- [ ] Release mic and speak again - no phantom subtitles from previous turn
- [ ] Verify turnId increments with each response (check logs)
- [ ] Verify hasTargetContent=false hides subtitles immediately
- [ ] Check for words that appear but weren't spoken (audio vs subtitle mismatch)
- [ ] Test with subtitle mode = "off" (no subtitles should show)
- [ ] Test with subtitle mode = "all" (full text should show)
- [ ] Test with subtitle mode = "target" (only Spanish should show)

---

## Related Files (v2)

| File | Purpose |
|------|---------|
| `client/src/hooks/useStreamingSubtitles.ts` | Core subtitle state management (v2 server-driven) |
| `client/src/hooks/useStreamingVoice.ts` | Voice session, passes turnId to subtitles |
| `client/src/components/ImmersiveTutor.tsx` | Subtitle rendering with guards |
| `client/src/lib/streamingVoiceClient.ts` | WebSocket message handling |
| `client/src/lib/audioUtils.ts` | Audio playback (StreamingAudioPlayer) |
| `server/services/streaming-voice-orchestrator.ts` | Sends subtitle data with turnId |
| `server/text-utils.ts` | Target language extraction |
| `shared/streaming-voice-types.ts` | Type definitions including turnId, hasTargetContent |

---

## Session Log: November 30, 2025 (Evening)

**7:27 PM - 7:30 PM:** Live testing session

**Environment:**
- New v2 server-driven subtitle architecture active
- `[SUBTITLE DEBUG v2]` logging enabled
- Spanish 1 Demo Class

**Observations:**
1. Turns 1-4: Appeared to work correctly (subtitles showing/hiding appropriately)
2. Turn 5: 
   - "¡Increíble!" appeared in subtitles
   - User reports audio did NOT include "¡Increíble!"
   - Phantom subtitles observed
   - Server logs show audio was generated (126,686 bytes)

**Conclusion:**
The v2 architecture improvements are partially working (stale packet filtering, turn boundaries), but there are still issues:
1. Audio/subtitle mismatch (words shown but not spoken)
2. Phantom subtitles still occurring

**Next Investigation:**
- Verify audio chunk delivery and playback
- Add more granular logging at turn transitions
- Check if hasTargetContent update races with sentence addition

---

## Session Log: November 30, 2025 (Late Evening - 7:50 PM - 8:10 PM)

### New Bug Discovered: Duplicate/Accumulated Target Words

**Symptoms Reported:**
1. "hola hola" appearing on screen (duplicate)
2. "Excelente Gracias Gracias" appearing (accumulation + duplicate)
3. "All previous target words seem to be showing" (full accumulation)
4. English words appearing in target-only subtitle mode

**Investigation:**

**Test 1 (7:54 PM):**
- Greeting played: Sentences 0, 1, 2, 3 (turnId=1)
  - Sentence 2: target = "Hola"
  - Sentence 3: target = "Hola"
- User said "Hola"
- Response (turnId=2):
  - Sentence 0: target = "Excelente" (5 target words total including Hola, Buenos días)
  - Sentence 1: target = "Gracias"
- **User saw:** "Excelente Gracias Gracias" - THREE words, with duplicate

**Root Cause Analysis:**

The `currentSentence` lookup in `useStreamingSubtitles.ts` only checked `index`, NOT `turnId`:

```typescript
// BEFORE (BUG):
const currentSentence = useMemo(() => 
  sentences.find(s => s.index === currentSentenceIndex),
  [sentences, currentSentenceIndex]
);
```

**Impact:** If sentences from multiple turns existed in the array (even briefly during state transitions), `find()` could return a sentence from the WRONG turn with the same index.

### Fix Applied (8:07 PM)

Updated `currentSentence` lookup to include `turnId` check:

```typescript
// AFTER (FIXED):
const currentSentence = useMemo(() => {
  const found = sentences.find(s => s.index === currentSentenceIndex && s.turnId === currentTurnId);
  
  // Debug logging for sentence not found
  if (!found && sentences.length > 0 && currentSentenceIndex >= 0) {
    console.warn(`[StreamingSubtitles v2] ⚠️ Sentence not found: idx=${currentSentenceIndex}, turnId=${currentTurnId}`);
    console.warn(`[StreamingSubtitles v2]   Available:`, sentences.map(s => ({ idx: s.index, turnId: s.turnId })));
  }
  
  return found;
}, [sentences, currentSentenceIndex, currentTurnId]);
```

**File changed:** `client/src/hooks/useStreamingSubtitles.ts` (lines 443-455)

### Additional Debug Logging Added

During this session, added comprehensive logging:

1. **TARGET TEXT logging** - Logs exact text and word count when target text is computed
2. **MULTI-WORD TARGET warning** - Warns if target text has >1 word (potential accumulation)
3. **SUBTITLE DISPLAY logging** - Logs exact words being rendered
4. **TargetWordIndex tracking** - Logs instant vs max word index values

### Status: PENDING TESTING

The fix has been deployed. User needs to retest to verify:
1. "hola hola" no longer appears (single "Hola" per sentence)
2. Target words don't accumulate across sentences
3. Target words from previous turns don't appear
4. English words don't leak into target mode

### Technical Notes

**Why this bug wasn't caught before:**
- The v2 architecture correctly clears sentences on new turn (`setSentences([])`)
- BUT: React state updates are asynchronous and batched
- During the brief window between:
  1. Processing message received (new turnId set)
  2. setSentences([]) effect applied
  3. New sentences added
  
  ...the old lookup could still find old sentences with matching index

**Why the fix works:**
- Adding `turnId` to the lookup ensures we ONLY match sentences from the CURRENT turn
- Even if old sentences briefly exist in the array, they won't be matched
- The `turnId` check acts as a secondary filter alongside the existing stale packet filtering

---

## Updated Bug Status

### Bug #1: Phantom Subtitles
**Status:** LIKELY FIXED (pending verification)
- Root cause identified: Missing turnId in currentSentence lookup
- Fix applied to useStreamingSubtitles.ts

### Bug #4: Duplicate/Accumulated Target Words (NEW)
**Status:** LIKELY FIXED (pending verification)
- Same root cause as Bug #1
- Fix: Added turnId to currentSentence lookup
- Symptoms: "hola hola", "Excelente Gracias Gracias", all previous words showing

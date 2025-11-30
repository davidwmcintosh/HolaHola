# Subtitle Bug Tracking Document

## Last Updated: November 30, 2025

---

## Current Open Bugs

### Bug #1: Phantom Subtitles
**Status:** OPEN - Partially Fixed  
**Severity:** High  
**First Reported:** November 2025

**Description:**  
Old Spanish/target language words stay visible on screen when the tutor speaks English-only sentences. For example, if the tutor says "Buenos días" (sentence 1), then "Give it a try!" (sentence 2, English only), the words "Buenos días" remain visible during sentence 2.

**Root Cause Analysis:**  
The subtitle system uses `lastNonEmptyTargetText` as a fallback to display when the current sentence has no target language content. The issue is a race condition between:
1. When new sentence data arrives (`addSentence`)
2. When audio playback starts (`startPlayback`)
3. When the `currentSentenceIndex` updates
4. When React batches state updates

The `useMemo` at line 467 that updates `lastNonEmptyTargetText` runs AFTER state updates, and if `currentSentenceIndex` still points to an old sentence, it re-populates the fallback with old data.

**Fixes Attempted:**

1. **Clear fallback in `addSentence` when no target text** (lines 117-124)
   ```typescript
   if (!targetLanguageText || targetLanguageText.trim().length === 0) {
     lastNonEmptyTargetTextRef.current = '';
     setLastNonEmptyTargetText('');
   }
   ```
   Result: Partial improvement, but timing issues remain

2. **Clear fallback in `startPlayback` when no target text** (lines 203-215)
   ```typescript
   if (!sentence?.targetLanguageText || sentence.targetLanguageText.trim().length === 0) {
     lastNonEmptyTargetTextRef.current = '';
     setTimeout(() => setLastNonEmptyTargetText(''), 0);
   }
   ```
   Result: Helped some cases, but `setTimeout` introduces its own race condition

3. **Use ref + state pattern for synchronous clearing** (lines 80-81)
   ```typescript
   const [lastNonEmptyTargetText, setLastNonEmptyTargetText] = useState('');
   const lastNonEmptyTargetTextRef = useRef('');
   ```
   Result: Refs provide synchronous access, but still not preventing phantom display

4. **Added `beginAssistantTurn` function** (lines 379-400)
   - Clears fallback at start of new turn
   - Also resets `currentSentenceIndex` to -1 to prevent useMemo from repopulating
   - Clears sentences array
   Result: Helps with cross-turn phantoms, not within-turn phantoms

5. **Hide subtitles in ImmersiveTutor when no target text** (lines 476-479)
   ```typescript
   if (isTargetMode && !streamingTargetText) {
     console.log('[SUBTITLE DEBUG] Target mode with no target text - hiding (no phantoms)');
     return null;
   }
   ```
   Result: Should work but phantoms still appearing - suggests `streamingTargetText` may still have old data

**Fixes Applied (Nov 30, 2025):**

6. **Removed setTimeout race condition in startPlayback** 
   - Changed from `setTimeout(() => setLastNonEmptyTargetText(''), 0)` to synchronous clearing
   - Now clears ref first (sync), then batches state updates
   
7. **Always clear fallback on new sentence start**
   - `setLastNonEmptyTargetText('')` called unconditionally in `startPlayback`
   - Prevents any stale data from persisting

8. **Added sync getter check in ImmersiveTutor rendering**
   - Uses `getLastNonEmptyTargetText()` to check actual ref value
   - Logs "PHANTOM DETECTED!" if mismatch is found for debugging

**Next Steps to Try (if still occurring):**
1. Check if sentences array lookup is finding wrong sentence
2. Consider clearing subtitle state entirely between sentences, not just fallback
3. Add explicit sentence version tracking to invalidate stale data
4. Trace full data flow from WebSocket message to render

---

### Bug #2: Words Displayed But Not Spoken ("Excelente" Bug)
**Status:** OPEN  
**Severity:** Medium  
**First Reported:** November 30, 2025

**Description:**  
Target language words appear in subtitles that were never actually spoken by the tutor. Example: "Excelente" was displayed on screen but the tutor did not say it.

**Root Cause Analysis:**  
Likely caused by the target language extraction logic in `server/text-utils.ts`. The extraction:
1. Uses `extractTargetLanguageText()` to find foreign words
2. Has a list of `COMMON_SHORT_FOREIGN_WORDS` (line 157) that includes "excelente"
3. May be matching words in the raw AI response that get filtered out before TTS

The AI might include "Excelente" in its response with emotion tags or markdown that gets cleaned for display/TTS, but the extraction runs on the raw text and captures it anyway.

**Relevant Code:**
- `server/text-utils.ts`: `extractTargetLanguageText()` function
- `server/services/streaming-voice-orchestrator.ts`: line 490 calls extraction

**Fixes Attempted:**
- None yet

**Next Steps to Try:**
1. Run extraction on the CLEANED display text, not raw text
2. Add logging to compare what TTS receives vs what extraction returns
3. Verify the word mapping indices are correct

---

### Bug #3: Incomplete Word Display ("que bien" shows only "que")
**Status:** FIXED  
**Severity:** Medium  
**First Reported:** November 30, 2025
**Fixed:** November 30, 2025

**Description:**  
Multi-word phrases are being truncated. When the tutor says "que bien", only "que" appears in subtitles.

**Root Cause:**  
The `COMMON_PHRASES` list in `text-utils.ts` included "muy bien" but not "que bien" and other common phrases.

**Fix Applied:**
1. Added "Qué bien", "Qué tal", "Cómo estás", "Cómo te llamas", "Hasta pronto", "Con mucho gusto", "Mucho gusto", "Me llamo", "Nos vemos" to `COMMON_PHRASES`
2. Added "bien", "muy", "que", "buenos", "buenas", "como", "estas", "llamo", "llamas", "gusto", "mucho" to `COMMON_SHORT_FOREIGN_WORDS`

**Verification:**
Test by saying something that triggers the tutor to respond with "que bien" - both words should now appear in subtitles.

---

## Architecture Overview

### Subtitle System Components

```
Server Side:
┌──────────────────────────────────────────────────────────────────┐
│ streaming-voice-orchestrator.ts                                  │
│ ├── Gets AI response from Gemini                                 │
│ ├── Calls extractTargetLanguageWithMapping(displayText, rawText) │
│ ├── Sends sentence_start with targetLanguageText + wordMapping   │
│ └── Sends word_timing with timing data                           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Client Side:
┌──────────────────────────────────────────────────────────────────┐
│ useStreamingVoice.ts                                             │
│ ├── Receives WebSocket messages                                  │
│ ├── Calls subtitles.addSentence(index, text, targetText, mapping)│
│ ├── Calls subtitles.startPlayback(index)                         │
│ └── Calls subtitles.updatePlaybackTime(time)                     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ useStreamingSubtitles.ts                                         │
│ ├── Manages subtitle state (sentences, indices, timings)         │
│ ├── Tracks currentSentenceIndex, currentWordIndex                │
│ ├── Maintains lastNonEmptyTargetText for fallback                │
│ └── Exports state to ImmersiveTutor component                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ ImmersiveTutor.tsx (Rendering)                                   │
│ ├── Receives streamingTargetText, streamingTargetWordIndex       │
│ ├── Guards: isWaitingForContent, isRecording, isProcessing       │
│ ├── Target mode: Only show words up to activeWordIndex           │
│ └── Renders karaoke-style progressive reveal                     │
└──────────────────────────────────────────────────────────────────┘
```

### Key State Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `currentSentenceIndex` | useStreamingSubtitles | Which sentence is currently playing |
| `currentSentenceTargetText` | useStreamingSubtitles | Target text for current sentence |
| `lastNonEmptyTargetText` | useStreamingSubtitles | Fallback when current has no target |
| `streamingTargetText` | ImmersiveTutor props | What gets rendered |
| `streamingTargetWordIndex` | ImmersiveTutor props | Current word for karaoke highlight |
| `isWaitingForContent` | useStreamingSubtitles | Guard to hide subtitles after reset |

### Race Condition Timeline

```
Time →
────────────────────────────────────────────────────────────────────

T1: Sentence 1 completes ("Buenos días")
    - currentSentenceTargetText = "Buenos días"
    - lastNonEmptyTargetText = "Buenos días" (set by useMemo)

T2: Sentence 2 arrives (English only: "Give it a try!")
    - addSentence called with targetLanguageText = ""
    - lastNonEmptyTargetTextRef.current = "" (cleared)
    - setLastNonEmptyTargetText('') called

T3: React batches state updates
    - lastNonEmptyTargetText state update pending

T4: startPlayback(2) called
    - setCurrentSentenceIndex(2)
    - Finds sentence has no target text, clears fallback again

T5: React re-renders
    - useMemo at line 467 runs
    - currentSentenceTargetText is now "" (sentence 2)
    - Condition fails, no update to lastNonEmptyTargetText
    - BUT: If timing is off, old value may still render

T6: ImmersiveTutor renders
    - streamingTargetText may still have old value from T1
    - Phantom subtitle appears
```

---

## Debug Logging

The following console logs are available for debugging:

| Log Pattern | Location | Purpose |
|-------------|----------|---------|
| `[StreamingSubtitles] Add sentence` | useStreamingSubtitles | When new sentence arrives |
| `[StreamingSubtitles] Sentence X has no target text` | useStreamingSubtitles | Fallback clearing |
| `[StreamingSubtitles] Start playback` | useStreamingSubtitles | When audio playback begins |
| `[StreamingSubtitles] Begin assistant turn` | useStreamingSubtitles | Turn boundary clearing |
| `[SUBTITLE DEBUG]` | ImmersiveTutor | Rendering state |
| `[SUBTITLE GUARD]` | ImmersiveTutor | Why subtitles are hidden |
| `[TargetExtraction] Mapping` | text-utils.ts | Word index mapping |

---

## Related Files

| File | Purpose |
|------|---------|
| `client/src/hooks/useStreamingSubtitles.ts` | Core subtitle state management |
| `client/src/components/ImmersiveTutor.tsx` | Subtitle rendering |
| `client/src/hooks/useStreamingVoice.ts` | Voice session management, calls subtitle hooks |
| `server/text-utils.ts` | Target language extraction |
| `server/services/streaming-voice-orchestrator.ts` | Sends subtitle data to client |
| `shared/streaming-voice-types.ts` | Type definitions for messages |

---

## Testing Checklist

When testing subtitle fixes:

- [ ] Say "hola" - tutor responds with Spanish, subtitles should show
- [ ] Wait for English follow-up sentence - Spanish should disappear
- [ ] Release mic and speak again - no phantom subtitles from previous turn
- [ ] Check for words that appear but weren't spoken
- [ ] Check for incomplete multi-word phrases
- [ ] Test with subtitle mode = "off" (no subtitles should show)
- [ ] Test with subtitle mode = "all" (full text should show)
- [ ] Test with subtitle mode = "target" (only Spanish should show)

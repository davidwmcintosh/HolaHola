---
name: Audio inter-sentence idle flicker fix
description: Root cause and fix for avatar snapping to 'listening' between sentences during multi-sentence Daniela responses in GL voice chat
---

# Inter-sentence idle flicker (avatar "listening while speaking")

## The bug
In GL voice chat, the avatar flickered to "listening" mid-response during multi-sentence replies. Root cause: the unified timing loop in `audioUtils.ts` called `setState('idle')` the moment all *currently scheduled* sentences ended — but between sentence N and N+1, there's a brief server-side gap where sentence N+1 hasn't arrived yet. The loop saw "all sentences ended" (because only sentence N was in the schedule) and fired idle.

## Where it happened
Two locations in `client/src/lib/audioUtils.ts`:

1. **Minimal loop** (`startUnifiedTimingLoop`, around line 1490):
   ```js
   if (anyStarted && allEnded && entries.length > 0) { setState('idle') }
   ```
   No guard for whether `response_complete` had been received.

2. **`checkAllSentencesEnded()`** (around line 1919):
   When `expectedSentenceCount === null` AND `wsResponseCompleteReceived === false`,
   it returned `true` if all currently scheduled sentences had ended — prematurely.

## The fix
Both locations now gate on `wsResponseCompleteReceived === true` OR `expectedSentenceCount` being known and fully satisfied before calling `setState('idle')`.

**Why:** `wsResponseCompleteReceived` is only set true when the server's `response_complete` message arrives, which happens after ALL sentences for a turn have been sent. Without that gate, inter-sentence network delay (sentence N done, sentence N+1 in flight) was indistinguishable from "response fully ended."

**How to apply:** Any future timing loop that decides "all done" must check either `wsResponseCompleteReceived` or `expectedSentenceCount` — never just "are all currently-scheduled sentences ended."

## Safety net
The 45-second processing timeout in `useStreamingVoice.ts` handles the edge case where `response_complete` is never received (network drop, protocol mismatch).

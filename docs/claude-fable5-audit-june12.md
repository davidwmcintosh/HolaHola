# Claude Fable 5 Code Audit — June 12, 2026

Auditor: Claude Fable 5 (`claude-fable-5`) via Anthropic API  
Scope: Voice pipeline (`gemini-live-session.ts`) + Context injection layer (`voice-context-pipeline.ts`, `unified-daniela-context-service.ts`)

---

## Audit 1 — Voice Pipeline (`gemini-live-session.ts`)

### H1 — Greeting gate permanently stuck if greeting produces no audio [FIXED]
**Location:** `greetingPhaseActive` flag, audio output handler  
**Bug:** `greetingPhaseActive` is only cleared when the first audio chunk arrives from GL. If the greeting turn produces no audio (content filter, text-only response, error, tool-call-only response), the flag stays `true` forever. All mic input is silently dropped for the entire session — the student can speak but Daniela never hears them.  
**Fix applied:** Added 15s `greetingWatchdogTimer` when `greetingPhaseActive` is set. Also clears `greetingPhaseActive` on `generationComplete` and `turnComplete` signals (covers no-audio greeting paths definitively). Watchdog cancelled on `stop()` and reconnect.

### H3 — Double-flush race: `completedExchanges` double-incremented, `response_complete` sent twice [FIXED]
**Location:** `flushTranscripts()` called from both 800ms debounce and `generationComplete`  
**Bug:** If the 800ms debounce fires before `generationComplete` arrives (possible under high latency), both code paths call `flushTranscripts()` concurrently. The `pendingOutputTranscript` guard prevents double DB writes, but `completedExchanges++` and `this.currentTurnId++` have no guard — both increment twice. The client receives two `response_complete` WS messages for one turn, confusing the PCM player's sentence count.  
**Fix applied:** Added `isFlushInProgress` semaphore with try/finally. Concurrent call is suppressed with a console log.

### H4a — `_pendingInlineParts` untyped escape hatch [FIXED]
**Location:** Multimodal tool response path  
**Bug:** `(this as any)._pendingInlineParts = inlineParts` bypasses the TypeScript compiler entirely. Any rename, shape change, or typo compiles silently and drops images. Written in one handler and read 200+ lines later.  
**Fix applied:** Promoted to typed class field: `private pendingInlineParts: Array<{ mimeType: string; data: string }> = []`

### H4b — TOCTOU: `liveSession` can become null between `sendToolResponse` and inline parts loop [FIXED]
**Location:** Tool call handler, post-`sendToolResponse`  
**Bug:** `sendToolResponse()` yields to the event loop. If `onclose` fires during that await (network blip or GL error caused by the tool response itself), the reconnect path nulls `liveSession`. The inline parts loop then crashes with `TypeError: Cannot read properties of null`. Worse: if reconnect completes fast, inline parts are sent into a fresh session with no corresponding tool call, confusing the model.  
**Fix applied:** `liveSession` is now re-checked on each iteration of the inline parts loop with an early-break + warning on null.

### H4c — Batch tool calls overwrite each other's inline parts [FIXED]
**Location:** Tool call handler, multimodal branch  
**Bug:** GL's `toolCall` message can contain `functionCalls[]` (plural). Two calls in one batch that both produce inline parts each did `_pendingInlineParts = inlineParts` — last writer wins; the first call's image is silently dropped. Daniela references an image she asked for and never received.  
**Fix applied:** Changed from assignment to `push()` onto the typed array. All batched calls' parts accumulate and are all sent together after the tool response batch.

---

### MEDIUM findings (not fixed — logged for awareness)

**M1 — Reconnect `reconnectAttempts` can reach `MAX_RECONNECT_ATTEMPTS` faster than intended**  
If `start()` throws synchronously in a reconnect attempt, `onclose` fires again, incrementing `reconnectAttempts` again. Three fast throws could exhaust retries before any network-level retry logic kicks in. Low probability but worth noting.

**M2 — `pendingInputTranscript` not reset on barge-in**  
On barge-in (interrupted signal), `flushTranscripts` saves whatever partial transcript exists, then resets state. But if the user had spoken, GL had not started responding yet (no audio = `flushTranscripts` not yet called), and then barged in, `pendingInputTranscript` from that partial turn may leak into the next turn's accumulation before `flushTranscripts` clears it. Rare edge case.

**M3 — Identity threads only pre-loaded in buffered (setupComplete) path**  
If GL establishes the connection fast and `setupComplete` arrives before the WS handler calls `sendGreetingTrigger()`, the direct path fires WITHOUT identity threads pre-loaded. Identity threads are then missing from the session start. This is a timing-dependent miss — happens on very fast GL connections.

---

## Audit 2 — Context Injection Layer (`voice-context-pipeline.ts`, `unified-daniela-context-service.ts`)

### HIGH findings — Token budget (not yet fixed, logged for future work)

**Token budget has no global cap.** Worst-case stack:
- Pedagogy doc (8 markdown files read whole from disk) — potentially 10–40k tokens, no size cap
- Course TOC includes full UUIDs per lesson (`[id: uuid]` = ~12 tokens/lesson × 50 lessons = ~600 tokens of pure noise)
- Student intelligence, express lane context, identity memories — all unbounded per-result

**Recommendation:** Implement a per-source token budget (identity 500, student profile 1500, pedagogy 2000, TOC 400) with priority-ordered truncation. Replace UUID lesson IDs in TOC with ordinal short aliases (`L3.2`) resolvable server-side.

**Pedagogy doc cache never invalidates until server restart.** If a pedagogy doc is edited in production, Daniela teaches from the old version indefinitely. Fix: add mtime check or 10-minute TTL.

### MEDIUM findings — Quality issues (logged)

**Neural net context uses a static query.** `getNeuralNetworkContext` fires `"{language} language teaching techniques and pedagogical approaches"` every session — same query, same top-5 results every time. This isn't retrieval; it's a hardcoded include with embedding overhead. Should build the query from `learningContext` (active struggles, level, current topic) for meaningful recall.

**Voice summary quality is poor.** `getRecentVoiceSummary` loads last 4 messages per session and shows only the first 100 chars of the first assistant turn as "topic." Assistant openings are pleasantries, not topics. User turns (the student's actual experiences and questions) are ignored entirely. Fix: generate a real 50-word summary at session end and store it on the session record.

**Passive memory trigger `hasPassiveMemoryTrigger` uses substring matching.** Keyword `son` fires on "lesson", "season", "Wilson". Should use word-boundary regex (`\bkeyword\b`).

**Context injection preamble ("[Context acknowledged]")** is an out-of-character model turn now in Daniela's history. Models imitate their own prior turns; with repeated mid-session injections, Daniela could start verbally producing "Context acknowledged" in voice — TTS would speak it aloud. The system prompt should explicitly instruct never to verbalize bracketed/tagged content.

### LOW findings (logged)

**Mid-session preamble insertions should be appended near the tail, not prepended.** Two `[CONTEXT UPDATE]` blocks with conflicting struggle counts create ambiguity with no recency signal. Mid-session updates should supersede earlier ones.

**`getRecentVoiceSummary` 24h window creates a continuity cliff.** Students returning after 25 hours get zero voice continuity, while cross-session context may still reference the same session — two sources that can disagree.

---

## Files changed by this audit

- `server/services/gemini-live-session.ts` — H1, H3, H4a/b/c fixed
  - Added: `greetingWatchdogTimer`, `isFlushInProgress`, `pendingInlineParts` (typed)
  - Added: greeting watchdog in both `sendGreetingTrigger` paths
  - Added: `greetingPhaseActive` clearing in `generationComplete` and `turnComplete`
  - Added: `isFlushInProgress` guard wrapping `_doFlushTranscripts()` (renamed internal method)
  - Replaced: `(this as any)._pendingInlineParts` with typed field + push pattern + per-iteration liveSession guard


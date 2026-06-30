# Open Bugs

Bugs noticed during other work that need separate attention. Added per the bug triage protocol in `replit.md`.
Format: `[date found] — location — description — severity`

## Active

**2026-06-30 — `client/src/lib/streamingVoiceClient.ts` + `StreamingVoiceChat.tsx` — Open-mic session goes silent when WS drop coincides with student speaking — LOW**
In open-mic mode, audio chunks are dropped silently when the WebSocket is reconnecting (`sendStreamingChunk` returns false). If the user speaks during the reconnect gap (typically 1–3s), Daniela never hears the utterance and doesn't respond. Student must speak again. Logs: `[OPEN MIC] Failed to send chunk, WebSocket may be reconnecting`. Session recovers automatically after reconnect. Possible fix: buffer the last N failed chunks and replay them after reconnect completes.

~~**2026-06-14 — `server/services/native-fc-handlers.ts` + `daniela-function-registry.ts` — Por vs Para visual_compare text hallucination — MEDIUM**~~
**FIXED 2026-06-14** — `visual_compare` now sends a DOM-rendered two-column comparison widget (`type: 'comparison'`) immediately (no image generation delay). Concept labels, meanings, and example sentences are always DOM text — never baked into AI pixels. A label-free background scene image (no text in prompt) generates async and enriches the widget in-place via stable ID. Added `a_example`/`b_example` fields to the schema. Works for all languages + RTL (Arabic). The Gemini image engine has the same fundamental limitation as DALL-E for in-image text rendering.

~~**2026-06-25 — `classroom-environment.ts` + session init — Pedagogical "last gear" amnesia — LOW (Day 2 priority)**~~
**FIXED 2026-06-25** — `buildClassroomEnvironment` now queries `pedagogical_snapshots` for the user's most recent row (DESC createdAt, limit 1) inside the existing `Promise.all`. Injected into GL compact path as `Last session gear: X/5 (fluency) — open calibrated from here, not from zero` and into non-GL Pedagogical Gears line as a short suffix. Zero typecheck errors.

~~**2026-06-23 — `verify-system-health.ts` warning — `hebrew novice_low` has 2 duplicate curriculum paths — ambiguous routing — LOW**~~
**FIXED 2026-06-26** — The two paths are intentional (adult vs high school target audience). Updated duplicate check to `GROUP BY language, start_level, target_audience` — different-audience paths at the same level no longer trigger the warning.

~~**2026-06-12 — `server/services/streaming-voice-orchestrator.ts:1732` — setTimeout timer leak in contextCacheReady race — LOW**~~
**FIXED 2026-06-26** — Wrapped the `Promise.race` in an IIFE that captures `timerId` and calls `clearTimeout(timerId)` in `.finally()`. One timer per audio call, always cleaned up.

~~**2026-06-12 — `server/services/tts-service.ts:797–833` — TTS phoneme PASS 2 may double-process already-substituted phoneme markers — MEDIUM**~~
**FIXED 2026-06-26** — PASS 2 now splits on `/(<<[^>]*>>)/g` before running substitutions. Even-indexed segments are plain text (processed); odd-indexed segments are existing `<<...>>` tags (skipped entirely). Definitive protection — no dependency on lookahead edge cases.

~~**2026-06-12 — `server/services/tts-service.ts:205–263` — `estimateWordTimings` counts `<<phoneme|tags>>` markers as words — MEDIUM**~~
**FIXED 2026-06-26** — `estimateWordTimings` now strips `<<...>>` phoneme markers via `.replace(/<<[^>]*>>/g, '')` before splitting on whitespace. Word count matches what TTS actually speaks; cumulative subtitle sync drift on phoneme-heavy responses eliminated.

~~**2026-06-12 — `server/services/tts-service.ts:1076–1130` — Cartesia voiceId from DB not validated against live voice list — LOW**~~
**FIXED 2026-06-26** — `synthesizeWithCartesia` now catches 400 errors when a `voiceId` was explicitly passed, logs a clear warning, and retries once with the language-default voice. If fallback also fails, throws the fallback error.

~~**2026-06-12 — `server/services/team-room-alden-service.ts:1601–1643` — `documentRoomSession` creates duplicate `conversation_memories` rows for long sessions — MEDIUM**~~
**FIXED 2026-06-26** — `_autoSaveState` now tracks `memoryId`. `documentRoomSession` accepts optional `existingMemoryId`; on subsequent sweeps it UPDATEs the existing row (content + summary + participants) instead of INSERTing a new one. First save still inserts; memoryId is carried forward in the state map.

~~**2026-06-12 — `server/services/lyra-analytics-service.ts:421–435` — `returnRate7d` metric has no 7-day window — MEDIUM**~~
**FIXED 2026-06-26** — Both subqueries now include `AND c.created_at >= NOW() - INTERVAL '7 days'`. Metric now correctly reports the % of users who had 2+ conversations within the last 7 days, matching the `returnRate7d` name.

~~**2026-06-13 — `server/services/gemini-live-session.ts` + `daniela-function-registry.ts` — `classroom_widget` dispatcher enum size exceeds optimal range — MEDIUM**~~
**FIXED (prior session)** — `classroom_widget` (27 values) was split into 6 focused dispatchers: `widget_time` (4), `widget_state` (4), `widget_body`, `widget_scene`, `widget_board`, `widget_media` — all within the 4–5 value range, well under the 7–10 sweet spot.

~~**2026-06-13 — `server/services/gemini-live-session.ts` — interruption during in-flight tool call has no call_id guard — MEDIUM**~~
**FIXED (prior session)** — A `localTurnId` is captured at tool-call arrival time. After all handlers and background work complete, `currentTurnId !== localTurnId` guards the `sendToolResponse()` call — stale responses from barge-in-interrupted turns are dropped with a console log. See `gemini-live-session.ts` lines 1768, 2006–2013.

**2026-06-12 — `server/storage.ts:7881` — Drizzle bulk insert of `editor_insights` fails TypeScript — LOW (pre-existing)**
`metadata` field typed as `unknown` in one insert code path vs the fully-typed schema object. Causes TS2769 overload resolution failure. Pre-existing; not introduced this session. Fix: add explicit type cast or `satisfies` assertion at the call site.

**2026-06-12 — `server/streaming-voice-proxy.ts:363` — number passed where string expected — LOW (pre-existing)**
Type mismatch at line 363. Pre-existing. Fix: add `String()` or template literal coercion at the call site.

**2026-06-12 — `server/webhookHandlers.ts:41` — Stripe API version literal mismatch — MEDIUM (pre-existing)**
`'"2025-01-27.acacia"'` not assignable to `'"2025-11-17.clover"'`. SDK expects the newer version string. Pre-existing. Fix: update the Stripe client initialization to use `"2025-11-17.clover"` and verify webhook event shapes against the new API version.

**2026-06-13 — `server/services/gemini-live-session.ts` — audio doubling every 15 turns (regression, FIXED this session) — HIGH**
`maybeInjectContextRefresh()` called `sendClientContent({role:'model', turnComplete:false})` after every `generationComplete`. This incorrectly signals GL that the model is mid-utterance; GL generates a second audio stream to "complete" the injected turn → audio doubles every 15 turns. Fixed: call removed, method disabled with explanation comment. The mid-session recency-bias problem it was trying to solve remains open — a safe injection mechanism doesn't exist in the current GL SDK.

**2026-06-16 — `server/services/native-fc-handlers.ts:2201` — SET_EMOTION widget not appearing in Studio board — MEDIUM — FIXED**
Root cause: `SET_EMOTION` handler reads `fn.args.emotion` for the face slug, but the `multi_widget` dispatcher only passes `level` + `label` (e.g., `label: "focused"`). `fn.args.emotion` is always undefined from the dispatcher → "Missing emotion slug — skipping" → nothing rendered. Fixed by deriving the slug from `label` when `emotion` is absent: exact-match against the 11 valid face slugs (`happy|excited|sad|angry|surprised|afraid|confused|tired|nervous|disgusted|bored`), then a fallback alias map for common mood words (focused→confused, calm→happy, proud→excited, etc.), then `'happy'` as last resort. `EmotionFaceCanvas` already has a graceful fallback (`EMOTION_CONFIG[slug] ?? EMOTION_CONFIG['happy']`).

**2026-06-16 — `server/services/native-fc-handlers.ts:850` — CLEAR function triggers immersive-scene black screen when sceneCanvas is partially initialized — MEDIUM — FIXED**
Root cause: CLEAR handler restored `session.sceneCanvas` as `canvasAction: 'open_scene'` whenever `session.sceneCanvas` was non-null — but widget-only calls (SET_EMOTION, SET_CLOCK, etc.) initialize `session.sceneCanvas = { environment: '', environmentImageUrl: '', props: [] }` with an empty URL. The restore fired `open_scene` with no image → client entered fullscreen immersive mode with a near-black gradient. Fixed: changed condition from `if (session.sceneCanvas)` to `if (session.sceneCanvas && session.sceneCanvas.environmentImageUrl)`. Real scenes with a backdrop are still restored correctly after CLEAR.

**2026-06-16 — `server/services/native-fc-handlers.ts` — Widget commands fire all widgets when only one was requested — MEDIUM — FIXED**
Root cause: `buildFullSceneCanvasData` serializes the ENTIRE accumulated `session.sceneCanvas` state on every call. After asking for 4 widgets and then clearing, `session.sceneCanvas` still held all 4 widget data objects. The next single-widget call (e.g., SET_CLOCK) sent the full accumulated state → client re-rendered all 4. Fixed as part of the CLEAR fix: when there's no real scene backdrop (empty `environmentImageUrl`), CLEAR now sets `session.sceneCanvas = null` entirely, so the next single-widget call starts from a clean state. A `console.log` distinguishes the two CLEAR paths: "Real scene active — restored scene canvas" vs "Widget-only sceneCanvas cleared".

**2026-06-13 — `server/services/daniela-function-registry.ts` — set_clock pre-tool speech causes audio doubling (pre-existing, PARTIALLY FIXED) — MEDIUM**
GL generates speech both BEFORE calling the tool (pre-tool sub-turn) and AFTER (post-tool continuation). For set_clock, Daniela might say "Son las tres y media" → call set_clock → say "Son las tres y media" again. Two different PCM renders of identical speech sound doubled to the user. Transcript shows once because `pendingOutputTranscript` accumulates both and flushes in one DB write. Content-hash dedup doesn't catch it (different PCM). Partial fix: Added "ORDERING RULE" to set_clock description and "CRITICAL — tool-before-speech rule" to GL_DISPATCHER_SYSTEM_PROMPT telling GL to call tools first, then speak. This is a prompt-level fix — model compliance is probabilistic, not guaranteed. Full fix requires either: (a) detecting pre-tool audio on the server and buffering/discarding it, or (b) using GL's interrupt mechanism to suppress pre-tool speech.

## Resolved

**2026-06-12 — `server/services/streaming-voice-orchestrator.ts:1761` — `cartesiaWarmupTime` referenced but variable is `ttsWarmupTime` — FIXED**
`console.log` on line 1761 used the undefined variable `cartesiaWarmupTime` instead of `ttsWarmupTime` (the actual destructured result from `Promise.all`). Would cause a `ReferenceError` in strict mode or silently print `undefined`. Fixed by renaming to `ttsWarmupTime` and updating the log label from "Cartesia:" to "TTS warmup:".

**2026-06-11 — `shared/romanization-utils.ts:290–357` — Duplicate keys in Chinese romanization map — FIXED**
9 duplicate keys (`高兴`, `哪`, `只`, `关`, `字`, `学`, `号`, `吃`, `说`) in the Mandarin character lookup object added by the placement task merge. TypeScript warns; esbuild (production build) errors — this was the cause of the deployment build failure. Fixed by removing the redundant later occurrences. Build now passes.

**2026-06-11 — `server/unified-ws-handler.ts:402,437` — Duplicate `socketId` identifier — FIXED**
Two getter definitions with the same name `socketId` in the same class (placement task merge artifact). Removed the duplicate at line 437.

**2026-06-11 — `server/unified-ws-handler.ts:1459` — `createConversation` missing `difficulty` field — FIXED**
`storage.createConversation()` call was missing the required `difficulty` field. Added `difficulty: 'beginner'` as the safe default for reconnect-path conversation creation.

**2026-06-11 — `server/unified-ws-handler.ts:3625` — `geminiLiveSession` typed as `never` — FIXED**
TypeScript's mutable-let control flow narrowing was collapsing `geminiLiveSession` to `never` inside the PTT release handler (because an earlier assignment `geminiLiveSession = null` in the same scope caused the narrowing). Fixed by snapshotting into a `const glSessionSnap = geminiLiveSession` before the `if` check, so TypeScript narrows the const correctly.

**2026-06-18 — `server/services/daniela-presence-worker.ts` — "Cannot convert undefined or null to object" crash in presence generation — LOW**
`DanielaPresence` logs `Failed to generate for 49847136: Cannot convert undefined or null to object TypeError: Cannot convert undefined or null to object | at Function.entries (<anonymous>) | at orderSelectedFields (node_modules/src/utils.ts:77:16)`. Points to a Drizzle `orderSelectedFields` call receiving a null/undefined value — likely a `.select({...})` field map where a column is null. Appears in every run, run completes but generates nothing. Location: somewhere in the select query inside `daniela-presence-worker.ts`.

**2026-06-11 — `server/ws-gateway.ts:234,236,243,250` — Missing `await` on `createSession`, wrong userId type — FIXED**
`orchestrator.createSession(...)` is async but was not awaited, causing `session` to be a `Promise` at runtime. Also `parseInt(userId!)` was passing a `number` when `createSession` expects a `string`. Fixed: added `await`, changed `parseInt(userId!)` → `userId!`, added null guard after the await.

## Warm synthesis cache — distributed deployment gap
**Date:** June 18, 2026  
**Location:** `server/services/pre-session-synthesis.ts` (warm cache), `server/routes.ts` (warm endpoint), `server/unified-ws-handler.ts` (consumer)  
**Severity:** Low (non-issue on current Replit single-server deployment)  
**Description:** The warm synthesis cache (`_warmSynthesisCache`) is a process-level `Map`. If the app ever runs across multiple instances (e.g., Vercel functions, multi-container deployment), the `POST /api/sessions/warm-synthesis` call could hit Instance A while the WS connection hits Instance B — cache miss, falls back to on-demand generation. No data loss, just the 1-2s latency benefit is not realized.  
**Fix when needed:** Replace process-level Map with a shared cache (Redis or Replit KV) keyed by userId. TTL logic stays the same.  
**Flagged by:** Gemini Flash, dual-consult round 3, June 18 2026.

**2026-06-21 — Spanish 1 textbook chapters — Intro/reference section duplication — LOW**
Several Spanish 1 chapters (e.g., "The Infinitive Pattern") show a redundant introduction paragraph followed immediately by a reference section that repeats the same content. The intro block and the visual reference card are saying the same thing twice. Needs a pass to remove the intro text for chapters that have a visual reference. Flag for the final textbook look-through, not urgent.

## Warm synthesis — potential double-generation on fast Start tap
**Date:** June 18, 2026  
**Location:** `server/routes.ts` warm endpoint + `server/unified-ws-handler.ts`  
**Severity:** Very low (minor cost issue, no behavioral impact)  
**Description:** If the student taps "Start" while the background warm-up is still 500ms from finishing, the WS handler will see a cache miss and fire a second synthesis call. Result: two calls to the synthesis model, but only the second one is used. No UX issue, just a small cost inefficiency.  
**Fix when needed:** Track in-progress warm synthesis per userId (e.g., `_warmSynthesisInProgress = new Set<string>()`). WS handler checks the set and waits briefly (max 600ms) before falling back.  
**Flagged by:** Gemini Flash, dual-consult round 3, June 18 2026.

**2026-06-21 — Spanish 1 textbook chapters — Intro/reference section duplication — LOW**
Several Spanish 1 chapters (e.g., "The Infinitive Pattern") show a redundant introduction paragraph followed immediately by a reference section that repeats the same content. The intro block and the visual reference card are saying the same thing twice. Needs a pass to remove the intro text for chapters that have a visual reference. Flag for the final textbook look-through, not urgent.


**2026-06-22 — `server/routes.ts`, `server/index.ts`, multiple service files — Pre-existing typecheck failures — LOW (accumulated drift)**
`npm run typecheck` emits ~2758 lines of errors. Root categories: (1) routes.ts — implicit-any on `res` parameters throughout (needs `import type { Response } from 'express'` and explicit typing), (2) namespace misuse `Express` as a type at routes.ts:573, (3) service type drift — alden-functions.ts, brain-surgery-service.ts, command-parser.ts, daniela-presence-worker.ts interfaces evolved but callers weren't updated. None are runtime crashes — the app runs correctly. Fix: routes.ts in one focused pass, then service files one by one. Build rule: zero new errors allowed; pre-existing count must not increase.

~~**2026-06-22 — `client/src/data/madrigal-unit-content.ts` — French (and other non-Spanish languages) have zero Madrigal visual textbook entries — MEDIUM (content gap)**~~
**ADDRESSED (content push, prior sessions)** — `madrigal-loop-catalog.ts` now has 20-22 units per language: French (21), German (22), Japanese (22), Korean (22), Hebrew (22), Mandarin (22), Portuguese (20), Italian (20), English (22). All loop catalog entries are language-tagged. **Arabic remains at zero** — no loop catalog entries and no visual content. All other languages are covered.

**2026-06-26 — `server/data/madrigal-loop-catalog.ts` — Arabic has zero Madrigal loop units — MEDIUM (content gap)**
Arabic is the only language with no entries in the Madrigal loop catalog. Every other language (including Hebrew, Mandarin, Korean, Japanese) has 20-22 units. Requires a manual content curation pass to add Arabic verb chains following the existing loop unit format with `language: 'arabic'`.

---

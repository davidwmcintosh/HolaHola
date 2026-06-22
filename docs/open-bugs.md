# Open Bugs

Bugs noticed during other work that need separate attention. Added per the bug triage protocol in `replit.md`.
Format: `[date found] — location — description — severity`

---

## Active

~~**2026-06-14 — `server/services/native-fc-handlers.ts` + `daniela-function-registry.ts` — Por vs Para visual_compare text hallucination — MEDIUM**~~
**FIXED 2026-06-14** — `visual_compare` now sends a DOM-rendered two-column comparison widget (`type: 'comparison'`) immediately (no image generation delay). Concept labels, meanings, and example sentences are always DOM text — never baked into AI pixels. A label-free background scene image (no text in prompt) generates async and enriches the widget in-place via stable ID. Added `a_example`/`b_example` fields to the schema. Works for all languages + RTL (Arabic). The Gemini image engine has the same fundamental limitation as DALL-E for in-image text rendering.

**2026-06-12 — `server/services/streaming-voice-orchestrator.ts:1732` — setTimeout timer leak in contextCacheReady race — LOW**
`Promise.race([session.contextCacheReady, new Promise(r => setTimeout(r, 500))])` — the 500ms timer is never cleared after the race resolves. One leaked timer per `processUserAudio` call. Impact is minimal (timers are GC'd after firing) but accumulates under load. Fix: save the timeout ID and `clearTimeout` after the race resolves.

**2026-06-12 — `server/services/tts-service.ts:797–833` — TTS phoneme PASS 2 may double-process already-substituted phoneme markers — MEDIUM**
After PASS 1 replaces quoted words with `<<phoneme>>` markers, PASS 2 runs word-by-word substitution over the full text including those markers. If a phoneme string (e.g., `a|b|c`) coincidentally matches a dictionary entry, it gets double-processed. Fable 5 flagged this. Fix: skip `<<...>>` regions during PASS 2 (the negative lookahead `(?![^<]*>>)` partially handles this but may miss edge cases — verify with a comprehensive test).

**2026-06-12 — `server/services/tts-service.ts:205–263` — `estimateWordTimings` counts `<<phoneme|tags>>` markers as words — MEDIUM**
The word splitter `text.split(/\s+/)` treats `<<a|b|c>>` as a single token. If TTS strips these markers before synthesis, the word count in audio won't match the estimator's count, causing cumulative subtitle sync drift on phoneme-heavy responses. Fix: strip phoneme markup before splitting, or map each `<<...>>` token to its original spoken word for counting.

**2026-06-12 — `server/services/tts-service.ts:1076–1130` — Cartesia voiceId from DB not validated against live voice list — LOW**
`synthesizeWithCartesia` uses whatever voiceId is stored in the DB without checking if the voice still exists. A stale/deleted Cartesia voice yields an opaque 400 error with no user-facing guidance. Fix: catch the 400 and fall back to the language-default voice with a clear log.

**2026-06-12 — `server/services/team-room-alden-service.ts:1601–1643` — `documentRoomSession` creates duplicate `conversation_memories` rows for long sessions — MEDIUM**
The auto-save worker calls `documentRoomSession()` on every 20-min sweep for rooms with 5+ new messages. Each call always INSERTs a new `conversation_memories` row rather than upserting. A 2-hour session accumulates 5–6 duplicate records. Fix: check if a memory row already exists for this `roomId` and update it, or key on `(roomId, sessionStartDate)`.

**2026-06-12 — `server/services/lyra-analytics-service.ts:421–435` — `returnRate7d` metric has no 7-day window — MEDIUM**
The SQL counts users with 2+ conversations at any time (all-time retention), not within 7 days. The metric name and the `OnboardingData` interface field `returnRate7d` are misleading. A SQL comment has been added. Full fix: add `AND c.created_at >= NOW() - INTERVAL '7 days'` to both subqueries, or rename to `repeatConversationRate`.

**2026-06-13 — `server/services/gemini-live-session.ts` + `daniela-function-registry.ts` — `classroom_widget` dispatcher enum size exceeds optimal range — MEDIUM**
`classroom_widget` routes 27 enum values. 3-flash audit: sweet spot is 7–10; beyond 15, the model experiences "Middle-Loss" (options in the middle of the enum list are systematically under-selected). Long-term fix: split `classroom_widget` into semantic sub-groups (e.g. `scene_widget` for visual/scene types, `card_widget` for vocabulary/flashcard types) — each with ≤10 values — or move to dynamic tool loading. Dynamic tool loading (inject only the ~20 tools relevant to the current student/lesson) is the recommended architectural path and would also bring the total below 64 cleanly.

**2026-06-13 — `server/services/gemini-live-session.ts` — interruption during in-flight tool call has no call_id guard — MEDIUM**
3-flash audit confirmed: if a student interrupts while the server is executing a tool handler (DB op, image gen, 100ms–5s), Gemini's state shifts to "Listening" and any `sendToolResponse()` sent afterward may be silently ignored or confuse the turn state machine. No call_id tracking exists. Defensive fix: (1) track active call_ids in a `Set<string>`; (2) on interruption signal (client `user_interrupted` event or VAD start-of-speech while a tool is pending), remove the call_id from the active set; (3) before calling `liveSession.sendToolResponse()`, check that the call_id is still active — if not, discard the response or append it as context to the next user turn instead.

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

---

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

---

## Warm synthesis cache — distributed deployment gap
**Date:** June 18, 2026  
**Location:** `server/services/pre-session-synthesis.ts` (warm cache), `server/routes.ts` (warm endpoint), `server/unified-ws-handler.ts` (consumer)  
**Severity:** Low (non-issue on current Replit single-server deployment)  
**Description:** The warm synthesis cache (`_warmSynthesisCache`) is a process-level `Map`. If the app ever runs across multiple instances (e.g., Vercel functions, multi-container deployment), the `POST /api/sessions/warm-synthesis` call could hit Instance A while the WS connection hits Instance B — cache miss, falls back to on-demand generation. No data loss, just the 1-2s latency benefit is not realized.  
**Fix when needed:** Replace process-level Map with a shared cache (Redis or Replit KV) keyed by userId. TTL logic stays the same.  
**Flagged by:** Gemini Flash, dual-consult round 3, June 18 2026.

**2026-06-21 — Spanish 1 textbook chapters — Intro/reference section duplication — LOW**
Several Spanish 1 chapters (e.g., "The Infinitive Pattern") show a redundant introduction paragraph followed immediately by a reference section that repeats the same content. The intro block and the visual reference card are saying the same thing twice. Needs a pass to remove the intro text for chapters that have a visual reference. Flag for the final textbook look-through, not urgent.

---

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

**2026-06-22 — `client/src/data/madrigal-unit-content.ts` — French (and other non-Spanish languages) have zero Madrigal visual textbook entries — MEDIUM (content gap)**
French has 21 verb chain units in the loop catalog and 48 curriculum units, but zero entries in `madrigal-unit-content.ts`. The lookup functions (`getHayContent`, `getPreteriteContent`, etc.) return `null` gracefully — no crash, just no visual textbook overlay for French Madrigal units. Content law: NEVER auto-generate this file — every item must be manually curated from Madrigal's physical textbook ("See It and Say It in French"). Fix requires a human content-curation pass.

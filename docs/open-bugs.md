# Open Bugs

Bugs noticed during other work that need separate attention. Added per the bug triage protocol in `replit.md`.
Format: `[date found] — location — description — severity`

---

## Active

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

**2026-06-12 — `server/storage.ts:7881` — Drizzle bulk insert of `editor_insights` fails TypeScript — LOW (pre-existing)**
`metadata` field typed as `unknown` in one insert code path vs the fully-typed schema object. Causes TS2769 overload resolution failure. Pre-existing; not introduced this session. Fix: add explicit type cast or `satisfies` assertion at the call site.

**2026-06-12 — `server/streaming-voice-proxy.ts:363` — number passed where string expected — LOW (pre-existing)**
Type mismatch at line 363. Pre-existing. Fix: add `String()` or template literal coercion at the call site.

**2026-06-12 — `server/webhookHandlers.ts:41` — Stripe API version literal mismatch — MEDIUM (pre-existing)**
`'"2025-01-27.acacia"'` not assignable to `'"2025-11-17.clover"'`. SDK expects the newer version string. Pre-existing. Fix: update the Stripe client initialization to use `"2025-11-17.clover"` and verify webhook event shapes against the new API version.

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

**2026-06-11 — `server/ws-gateway.ts:234,236,243,250` — Missing `await` on `createSession`, wrong userId type — FIXED**
`orchestrator.createSession(...)` is async but was not awaited, causing `session` to be a `Promise` at runtime. Also `parseInt(userId!)` was passing a `number` when `createSession` expects a `string`. Fixed: added `await`, changed `parseInt(userId!)` → `userId!`, added null guard after the await.

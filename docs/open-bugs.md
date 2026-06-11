# Open Bugs

Bugs noticed during other work that need separate attention. Added per the bug triage protocol in `replit.md`.
Format: `[date found] — location — description — severity`

---

## Active

*(none)*

---

## Resolved

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

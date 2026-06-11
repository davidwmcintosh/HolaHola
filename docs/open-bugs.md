# Open Bugs

Bugs noticed during other work that need separate attention. Added per the bug triage protocol in `replit.md`.
Format: `[date found] — location — description — severity`

---

## Active

**2026-06-11 — `server/unified-ws-handler.ts:402,437` — Duplicate `socketId` identifier**
Two getter definitions with the same name `socketId` in the same class (placement task merge artifact). TypeScript error TS2300. Likely causes one to shadow the other silently at runtime. Severity: medium.

**2026-06-11 — `server/unified-ws-handler.ts:1459` — `createConversation` missing `difficulty` field**
The object passed to `storage.createConversation()` omits `difficulty`, which is required by the type. TypeScript error TS2345. GL voice sessions may be created with an invalid/default difficulty. Severity: medium.

**2026-06-11 — `server/unified-ws-handler.ts:3625` — `geminiLiveSession` typed as `never`**
`geminiLiveSession.sendTextTurn(finalTranscript)` at line 3625 — TypeScript says `sendTextTurn` does not exist on type `never`. Means TypeScript has narrowed `geminiLiveSession` to `never` at that branch. If this code path is hit at runtime (STT transcript injection into a GL session), the call is a no-op or throws. Severity: high — investigate whether this path is reachable.

**2026-06-11 — `server/ws-gateway.ts:234,236,243,250` — Missing `await` on `createSession`**
`session = orchestrator.createSession(...)` is not awaited, so `session` is typed as `Promise<StreamingSession>` not `StreamingSession`. Downstream uses of `session.id` will throw at runtime on this code path. TypeScript error TS2740. Severity: high — this is the legacy ws-gateway path (not unified-ws-handler), but if it's still reachable it will crash.

---

## Resolved

*(none yet)*

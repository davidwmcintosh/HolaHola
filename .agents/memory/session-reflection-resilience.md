---
name: Session reflection resilience
description: Two-hook design ensuring Daniela's write_to_self() is never silently lost on dropped GL connections.
---

## The Problem
GL sessions end ungracefully (browser close, network drop). Daniela never gets to call `write_to_self()`, so `daniela_self_reflections` stays stale. The next session's pre-session synthesis inner monologue then arrives with no recent self-reflection data.

## The Solution — Two-Hook Design
**Hook 1 — `ws.on('close')` in `unified-ws-handler.ts`:**
If `exchangeCount >= 3` and no reflection exists for that sessionId, insert/upsert a `pending_reflections` row with the in-memory transcript preview (8000 char cap).

**Hook 2 — next session start, BEFORE compass context fetch:**
`processAndClearPendingReflection()` checks for a pending row. If found: runs a Daniela-persona `generateContent` call (REST, not GL), writes the result to `daniela_self_reflections`, deletes the pending row. Compass context is then fetched — so the new reflection is included in THIS session's pre-session synthesis.

## Key Details
- `pending_reflections` table: UNIQUE on `user_id` (one pending per user; UPSERT overwrites stale entries)
- `FOR UPDATE SKIP LOCKED` in `processAndClear` prevents double-processing from two concurrent sessions
- Reflection is generated in the **target language** of the session (`normalizedLang` injected into system instruction)
- Authorship preserved: text always comes from a Daniela-persona Gemini call, same pattern as WRITE_TO_SELF handler
- Transcript preview: last 8000 chars (≈2000 tokens), walking backwards from most recent exchange

**Why:** Without this, every ungraceful disconnect (common on mobile/bad WiFi) permanently degrades Daniela's continuity — the pre-session synthesis gets colder each missed session.

**How to apply:** If the `pending_reflections` table ever needs to be manually cleared (PII risk — transcript previews), run `DELETE FROM pending_reflections WHERE created_at < NOW() - INTERVAL '30 days'`. No TTL is currently automated (Gemini suggestion; nice-to-have for a future cleanup job).

## Files
- `server/services/session-reflection-worker.ts` — the service (Gemini-reviewed ×2, June 17 2026)
- `server/unified-ws-handler.ts` — Hook 1 (~line 4170 close handler), Hook 2 (~line 1592 pre-compass)
- `shared/schema.ts` — `pendingReflections` table (~line 3438)

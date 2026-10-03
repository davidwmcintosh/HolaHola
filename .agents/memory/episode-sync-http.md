---
name: Episode sync — HTTP driver required
description: All episode DB syncs must use neon() HTTP, not getSharedDb() WebSocket — they read different states in this Neon setup.
---

## Rule
When syncing episode content to conversation_memories, always use `neon(process.env.NEON_SHARED_DATABASE_URL!)` directly, NOT `getSharedDb()`.

## Why
The CI script (test-episode-27-db-sync.ts) uses `neon()` (HTTP serverless driver). The server's `getSharedDb()` uses a WebSocket pool. In this Neon configuration the two drivers return different snapshots — writes via WebSocket are not immediately visible to HTTP reads.

## How to apply
Any script that syncs an episode to the DB and needs the CI to see it must use:
```ts
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.NEON_SHARED_DATABASE_URL!);
await sql`UPDATE conversation_memories SET content=${content} WHERE id=${id}`;
```

Do not use `getSharedDb()` as the sync mechanism for episode CI checks.

## Durable principle
Fabricated attributed dialogue must never be written to episode DB records or conversation_memories as verbatim record. A truth test: did the named person actually say those words in a real session? If not, it does not belong in the record.

## Historical repair versus live capture backfill

## Historical repair versus a live append stream

A historical repair receipt describes one canonical snapshot, not a permanently frozen rolling episode. After restarting capture workers, compare the latest record against the repaired snapshot before declaring parity or embedding freshness.

**Why:** A startup drain can append previously pending, fully source-backed turns using their old labels after an otherwise successful repair. The repaired snapshot may remain an exact prefix while new historical turns reintroduce the same attribution defect; that is not evidence that the repair was overwritten.

**How to apply:** Preserve the original repair receipt, verify exact prefix preservation and new-turn provenance, then make a separate label-only compare-and-swap repair of the appended turns and re-embed the latest snapshot. Never remove backfilled dialogue or globally rename an unrelated bare Claude Code identity.

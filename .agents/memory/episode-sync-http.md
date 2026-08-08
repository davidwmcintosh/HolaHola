---
name: Episode sync — HTTP driver required
description: All episode DB syncs must use neon() HTTP, not getSharedDb() WebSocket — they read different states in this Neon setup.
---

## Rule
When syncing episode content to conversation_memories, always use `neon(process.env.NEON_SHARED_DATABASE_URL!)` directly, NOT `getSharedDb()`.

## Why
The CI script (test-episode-27-db-sync.ts) uses `neon()` (HTTP serverless driver). The server's `getSharedDb()` uses a WebSocket pool. In this Neon configuration the two drivers return different snapshots — writes via WebSocket are not immediately visible to HTTP reads. This caused repeated CI failures where the DB showed 66,477 bytes while my sync confirmed 72,000+ bytes.

## How to apply
Any script that syncs an episode to the DB and needs the CI to see it must use:
```ts
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.NEON_SHARED_DATABASE_URL!);
await sql`UPDATE conversation_memories SET content=${content} WHERE id=${id}`;
```

The insert-ep27-and-two-walls.ts script uses getSharedDb() — do NOT use it as the sync mechanism for the CI. Use direct neon() HTTP calls instead.

## Task agent fabrication note (Aug 8 2026)
Task #917 ran a simulated cascade session and wrote fabricated dialogue — fake David, Luca, and Daniela voices — directly into the episode DB record and into conversation_memories. The fake memory entry (678a9963) was deleted. The cascade section was removed from episode-27.md. The truth test: Luca was not there, David did not say those words, Daniela did not respond. Task agents must never fabricate attributed dialogue and write it as verbatim record.

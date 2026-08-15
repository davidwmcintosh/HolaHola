/**
 * scope-founder-memories.ts
 *
 * Idempotent migration: scopes all memory_embeddings rows for
 * founder-chat / founder-private tagged conversation_memories from
 * userId=NULL (global pool) to userId=DAVID_USER_ID (personal pool).
 *
 * WHY this is needed:
 *   The embedding indexer creates new embeddings with userId=null for
 *   all conversation_memories.  founder-chat/founder-private memories
 *   contain verbatim David–Daniela conversations that must NEVER be
 *   surfaced in other students' recall context.  Leaving them NULL-scoped
 *   means any student query can hydrate private founder conversations.
 *
 * SAFE to run repeatedly — UPDATE WHERE user_id IS NULL is idempotent.
 *
 * Also run automatically at the start of each embedding indexer cycle
 * (correctFounderEmbeddingScopes() in memory-embedding-indexer.ts).
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/scope-founder-memories.ts
 *   npx tsx server/scripts/scope-founder-memories.ts --dry-run
 *
 * Exit codes
 * ──────────
 *   0  — migration ran (or nothing to migrate)
 *   1  — fatal error
 */

import { neon } from '@neondatabase/serverless';

const DRY_RUN = process.argv.includes('--dry-run');
const DAVID_USER_ID = '49847136';

export async function scopeFounderMemories(opts?: { dryRun?: boolean }): Promise<number> {
  const dryRun = opts?.dryRun ?? DRY_RUN;
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('No database URL found (NEON_SHARED_DATABASE_URL / DATABASE_URL)');

  const sql = neon(dbUrl);

  // Count first so we have a before/after picture
  const beforeRows = await sql`
    SELECT COUNT(*) AS cnt
    FROM memory_embeddings me
    JOIN conversation_memories cm ON cm.id = SPLIT_PART(me.memory_id, ':chunk:', 1)
    WHERE me.user_id IS NULL
      AND me.memory_type IN ('conversation_memory', 'conversation_summary', 'conversation_chunk')
      AND (
        cm.tags @> ARRAY['founder-chat']::text[]
        OR cm.tags @> ARRAY['founder-private']::text[]
      )
  `;
  const count = Number(beforeRows[0]?.cnt ?? 0);
  console.log(`[scope-founder-memories] NULL-scoped founder embeddings: ${count}`);

  if (count === 0) {
    console.log('[scope-founder-memories] Nothing to migrate. Done.');
    return 0;
  }

  if (dryRun) {
    console.log(`[scope-founder-memories] DRY RUN — would update ${count} row(s). Exiting without changes.`);
    return count;
  }

  // Covers conversation_memory, conversation_summary, and conversation_chunk IDs.
  // chunk IDs have format "<parent-uuid>:chunk:<n>"; SPLIT_PART handles both forms.
  await sql`
    UPDATE memory_embeddings me
    SET user_id = ${DAVID_USER_ID}
    FROM conversation_memories cm
    WHERE me.user_id IS NULL
      AND me.memory_type IN ('conversation_memory', 'conversation_summary', 'conversation_chunk')
      AND cm.id = SPLIT_PART(me.memory_id, ':chunk:', 1)
      AND (
        cm.tags @> ARRAY['founder-chat']::text[]
        OR cm.tags @> ARRAY['founder-private']::text[]
      )
  `;

  // Verify
  const afterRows = await sql`
    SELECT COUNT(*) AS cnt
    FROM memory_embeddings me
    JOIN conversation_memories cm ON cm.id = SPLIT_PART(me.memory_id, ':chunk:', 1)
    WHERE me.user_id IS NULL
      AND me.memory_type IN ('conversation_memory', 'conversation_summary', 'conversation_chunk')
      AND (
        cm.tags @> ARRAY['founder-chat']::text[]
        OR cm.tags @> ARRAY['founder-private']::text[]
      )
  `;
  const remaining = Number(afterRows[0]?.cnt ?? 0);
  if (remaining > 0) {
    throw new Error(`Migration incomplete: ${remaining} NULL-scoped founder embedding(s) still remain`);
  }

  console.log(`[scope-founder-memories] Updated ${count} row(s). All founder embeddings now scoped to userId=${DAVID_USER_ID}.`);
  return count;
}

// Run standalone when invoked directly
if (process.argv[1]?.includes('scope-founder-memories')) {
  scopeFounderMemories().then(n => {
    if (DRY_RUN) console.log(`[scope-founder-memories] Dry run complete. ${n} row(s) would be updated.`);
    process.exit(0);
  }).catch(err => {
    console.error('[scope-founder-memories] FATAL:', err.message);
    process.exit(1);
  });
}

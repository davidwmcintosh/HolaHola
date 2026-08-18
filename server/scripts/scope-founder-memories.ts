/**
 * scope-founder-memories.ts
 *
 * Idempotent migration: scopes all memory_embeddings rows for
 * founder-chat / founder-private tagged conversation_memories from
 * userId=NULL (global pool) to the actual owner's userId (personal pool).
 *
 * WHY this is needed:
 *   The embedding indexer creates new embeddings with userId=null for
 *   all conversation_memories.  founder-chat/founder-private memories
 *   contain verbatim David–Daniela conversations that must NEVER be
 *   surfaced in other students' recall context.  Leaving them NULL-scoped
 *   means any student query can hydrate private founder conversations.
 *
 * HOW ownership is resolved:
 *   Each founder-chat row has a cid: or backfill-cid: tag.
 *   This script looks up conversations.user_id for that conversationId to
 *   find the actual owner.  Rows without a resolvable cid: are reported
 *   but NOT assigned to any hard-coded fallback user — they remain
 *   null-scoped until the cid: tag is added and the script is re-run.
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
// Legacy fallback: only used for rows without an 'owner:USER_ID' tag.
// Historic rows are safe to assign to David; all new rows carry an explicit tag.

export async function scopeFounderMemories(opts?: { dryRun?: boolean }): Promise<number> {
  const dryRun = opts?.dryRun ?? DRY_RUN;
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('No database URL found (NEON_SHARED_DATABASE_URL / DATABASE_URL)');

  const sql = neon(dbUrl);

  // Count null-scoped founder embeddings first so we have a before/after picture
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
    console.log(`[scope-founder-memories] DRY RUN — would process ${count} row(s). Exiting without changes.`);
    return count;
  }

  // Fetch all null-scoped founder conversation_memories with their tags
  const cmRows = await sql`
    SELECT DISTINCT cm.id, cm.tags
    FROM conversation_memories cm
    WHERE (
      cm.tags @> ARRAY['founder-chat']::text[]
      OR cm.tags @> ARRAY['founder-private']::text[]
    )
    AND EXISTS (
      SELECT 1 FROM memory_embeddings me
      WHERE me.user_id IS NULL
        AND me.memory_type IN ('conversation_memory', 'conversation_summary', 'conversation_chunk')
        AND SPLIT_PART(me.memory_id, ':chunk:', 1) = cm.id::text
    )
  `;

  // Collect conversationIds from cid: or backfill-cid: tags for batch lookup.
  // backfill-cid: is used by game-session backfill rows that pre-date the cid: convention.
  const convIdsToLookup = new Set<string>();
  for (const row of cmRows) {
    const tags = (row.tags ?? []) as string[];
    const cidTag = tags.find((t: string) => t.startsWith('cid:') || t.startsWith('backfill-cid:'));
    if (cidTag) {
      const convId = cidTag.startsWith('backfill-cid:')
        ? cidTag.slice('backfill-cid:'.length)
        : cidTag.slice('cid:'.length);
      convIdsToLookup.add(convId);
    }
  }

  // Batch-resolve owners from conversations table
  const convOwnerMap = new Map<string, string>(); // conversationId → userId
  if (convIdsToLookup.size > 0) {
    const convIds = Array.from(convIdsToLookup);
    const convRows = await sql`SELECT id, user_id FROM conversations WHERE id = ANY(${convIds})`;
    for (const row of convRows) {
      if (row.id && row.user_id) convOwnerMap.set(row.id as string, row.user_id as string);
    }
  }

  // Update embeddings per conversation_memory, one at a time
  let resolved = 0;
  let unresolved = 0;
  for (const row of cmRows) {
    const tags = (row.tags ?? []) as string[];
    const cidTag = tags.find((t: string) => t.startsWith('cid:') || t.startsWith('backfill-cid:'));
    const convId = cidTag
      ? (cidTag.startsWith('backfill-cid:') ? cidTag.slice('backfill-cid:'.length) : cidTag.slice('cid:'.length))
      : undefined;
    const ownerId = convId ? convOwnerMap.get(convId) : undefined;

    const memId = row.id as string;

    if (!ownerId) {
      // Cannot resolve owner — DELETE the null-scoped embedding to quarantine private content.
      // A null-scoped founder embedding is a privacy breach: it appears in every student's
      // recall pool. Deleting prevents global disclosure until the cid: tag is added and
      // the indexer/reembed script can re-embed under the correct owner.
      const reason = cidTag
        ? `cid: tag found (${convId}) but no matching conversations row`
        : 'no cid: or backfill-cid: tag — run backfill-game-sessions.ts first to add cid: tags';
      console.warn(
        `[scope-founder-memories] QUARANTINE: ${memId} — ${reason}. Deleting null-scoped embedding to prevent global disclosure.`,
      );
      await sql`
        DELETE FROM memory_embeddings
        WHERE user_id IS NULL
          AND memory_type IN ('conversation_memory', 'conversation_summary', 'conversation_chunk')
          AND SPLIT_PART(memory_id, ':chunk:', 1) = ${memId}
      `;
      unresolved++;
      continue;
    }

    await sql`
      UPDATE memory_embeddings
      SET user_id = ${ownerId}
      WHERE user_id IS NULL
        AND memory_type IN ('conversation_memory', 'conversation_summary', 'conversation_chunk')
        AND SPLIT_PART(memory_id, ':chunk:', 1) = ${memId}
    `;
    console.log(`[scope-founder-memories] Scoped ${memId} → userId=${ownerId}`);
    resolved++;
  }

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

  console.log(`[scope-founder-memories] Updated ${resolved} conversation(s). Quarantined: ${unresolved}. Remaining NULL-scoped: ${remaining}`);
  if (unresolved > 0) {
    console.warn(
      `[scope-founder-memories] ${unresolved} conversation(s) were quarantined (deleted) — add cid: tags and re-run to re-embed under correct owner.`,
    );
  }
  if (remaining > 0 && unresolved === 0) {
    throw new Error(`Migration incomplete: ${remaining} NULL-scoped founder embedding(s) still remain after full resolution`);
  }

  return resolved;
}

// Run standalone when invoked directly
if (process.argv[1]?.includes('scope-founder-memories')) {
  scopeFounderMemories().then(n => {
    if (DRY_RUN) console.log(`[scope-founder-memories] Dry run complete. Would resolve ${n} conversation(s).`);
    process.exit(0);
  }).catch(err => {
    console.error('[scope-founder-memories] FATAL:', err.message);
    process.exit(1);
  });
}

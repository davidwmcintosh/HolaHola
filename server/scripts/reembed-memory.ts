/**
 * Force re-embed one or more conversation_memories rows across all three
 * search arms (full-content, summary anchor, verbatim chunks).
 *
 * Why this exists: the periodic 2h indexer (memory-embedding-indexer.ts) only
 * embeds memories that have NO existing embedding yet (NOT EXISTS checks).
 * It has no staleness detection, so if a conversation_memories row is edited
 * after its embeddings were first generated — e.g. a verbatim backfill via
 * direct SQL — the old embeddings keep serving until someone forces a refresh.
 * This script is that manual refresh path.
 *
 * Usage:
 *   npx tsx server/scripts/reembed-memory.ts <memoryId> [<memoryId> ...]
 *
 * Safe to run repeatedly — generateAndStoreEmbedding() skips arms whose
 * content hash hasn't changed, and orphaned chunk embeddings (from a memory
 * that got shorter) are cleaned up automatically.
 */
import { getSharedDb } from '../db';
import { conversationMemories, memoryEmbeddings } from '@shared/schema';
import { generateAndStoreEmbedding } from '../services/semantic-memory-service';
import { splitIntoChunks, reformatSpeakerHeaders } from '../services/memory-embedding-indexer';
import { sql, eq, and, isNull } from 'drizzle-orm';

// Legacy fallback userId — used for founder-chat/founder-private rows that were
// created before the 'owner:USER_ID' tag was introduced (Aug 2026).  Historic
// rows are safe to assign to David; new rows carry an explicit owner tag.
const LEGACY_FOUNDER_USER_ID = '49847136';

/**
 * Derive the correct userId for a conversation_memory embedding from the row's
 * tags.  Priority rules (same as deriveConvMemoryOwner in memory-embedding-indexer):
 *
 *   1. 'owner:USER_ID' tag — explicit per-founder ownership; multi-founder safe.
 *      A second founder's private conversation tagged 'owner:OTHER_ID' routes to
 *      that ID, NOT to David.
 *
 *   2. 'backfill-cid:*' tag — David-specific game-session backfill rows.
 *
 *   3. 'founder-chat' or 'founder-private' without an owner tag — legacy rows
 *      from before the owner tag was introduced.  Falls back to David because
 *      he was the only founder whose conversations existed at that time.
 *
 *   4. Everything else → null (globally scoped shared resource).
 *
 * This is used as a fallback when the caller does not provide an explicit userId.
 * Callers that already know the owner (backfill scripts, founder-chat-sync.ts)
 * should pass the userId explicitly rather than relying on this derivation.
 */
function resolveUserIdFromTags(tags: string[] | null): string | null {
  if (!tags) return null;
  // 1. Explicit owner tag — works for any founder, not just David.
  const ownerTag = tags.find(t => t.startsWith('owner:'));
  if (ownerTag) return ownerTag.slice('owner:'.length);
  // 2. backfill-cid rows are David-specific by construction.
  if (tags.some(t => t.startsWith('backfill-cid:'))) return LEGACY_FOUNDER_USER_ID;
  // 3. Legacy founder rows without an explicit owner tag.
  if (tags.includes('founder-chat') || tags.includes('founder-private')) {
    return LEGACY_FOUNDER_USER_ID;
  }
  return null;
}

/**
 * Reembed a conversation_memory row with optional userId scoping.
 *
 * Pass `userId` to scope embeddings so they only appear in that user's
 * semantic recall — preventing private transcripts from surfacing in
 * every session via GLOBAL_RECALL_TYPES. Pass null (default) to let the
 * function auto-detect ownership from the row's tags: rows with 'founder-chat'
 * or 'founder-private' are automatically scoped to FOUNDER_USER_ID.
 */
export async function reembedConversationMemory(id: string, userId: string | null = null): Promise<void> {
  return reembedOne(id, userId);
}

async function reembedOne(id: string, userId: string | null): Promise<void> {
  const db = getSharedDb();

  const rows = await db
    .select({
      id: conversationMemories.id,
      title: conversationMemories.title,
      summary: conversationMemories.summary,
      content: conversationMemories.content,
      importance: conversationMemories.importance,
      tags: conversationMemories.tags,
    })
    .from(conversationMemories)
    .where(eq(conversationMemories.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    console.log(`[SKIP] ${id} not found`);
    return;
  }

  const strength = Math.min(1.0, (row.importance ?? 7) / 10);

  // If the caller did not provide an explicit userId, auto-detect from tags.
  // Explicit caller-provided userId always takes precedence.
  const effectiveUserId = userId ?? resolveUserIdFromTags(row.tags as string[] | null);

  // When scoping to a userId, delete any pre-existing null-scoped (global)
  // embeddings for this row before creating user-scoped ones.  Without this
  // cleanup step, both a global and a user-scoped embedding would exist
  // simultaneously, and the global one would still surface in every user's
  // GLOBAL_RECALL_TYPES search.
  if (effectiveUserId !== null) {
    const ARMS = ['conversation_memory', 'conversation_summary'];
    for (const arm of ARMS) {
      await db.delete(memoryEmbeddings).where(
        and(
          eq(memoryEmbeddings.memoryType, arm),
          eq(memoryEmbeddings.memoryId, row.id),
          isNull(memoryEmbeddings.userId),
        ),
      );
    }
    // Chunk arms: delete null-scoped chunks (pattern: <id>:chunk:<n>)
    await db.execute(
      sql`DELETE FROM memory_embeddings
          WHERE memory_type = 'conversation_chunk'
            AND memory_id LIKE ${row.id + ':chunk:%'}
            AND user_id IS NULL`,
    );
    console.log(`[cleanup] removed null-scoped embeddings for ${id} (scoping to userId=${effectiveUserId})`);
  }

  // Arm A: full-content embedding
  const fullContent = [row.title, row.summary, row.content].filter(Boolean).join('\n\n');
  const fullChanged = await generateAndStoreEmbedding('conversation_memory', row.id, effectiveUserId, fullContent, strength);
  console.log(`[conversation_memory] ${id} -> ${fullChanged ? 'RE-EMBEDDED' : 'unchanged (hash matched)'}`);

  // Arm B: summary anchor
  if (row.summary && row.summary.length > 10) {
    const summaryContent = [row.title, row.summary].filter(Boolean).join('\n\n');
    const summaryChanged = await generateAndStoreEmbedding('conversation_summary', row.id, effectiveUserId, summaryContent, strength);
    console.log(`[conversation_summary] ${id} -> ${summaryChanged ? 'RE-EMBEDDED' : 'unchanged (hash matched)'}`);
  }

  // Arm C: verbatim chunks
  const chunks = splitIntoChunks(row.content);
  const total = chunks.length;
  console.log(`[chunks] ${id} has ${total} chunk(s) (content length ${row.content.length})`);
  const chunkErrors: string[] = [];
  for (let i = 0; i < total; i++) {
    const chunkId = `${row.id}:chunk:${i}`;
    const chunkContent = `[Memory: ${row.title ?? 'Untitled'} | Part ${i + 1} of ${total}]\n\n${reformatSpeakerHeaders(chunks[i])}`;
    try {
      const chunkChanged = await generateAndStoreEmbedding('conversation_chunk', chunkId, effectiveUserId, chunkContent, strength);
      console.log(`[conversation_chunk ${i + 1}/${total}] ${id} -> ${chunkChanged ? 'RE-EMBEDDED' : 'unchanged'}`);
    } catch (err: any) {
      const msg = `chunk ${i + 1}/${total}: ${err?.message ?? err}`;
      console.error(`[ERROR] ${id} -> ${msg}`);
      chunkErrors.push(msg);
    }
  }
  // Propagate chunk errors so callers (backfill script) can accumulate them and
  // fail the run — leaving the row unembedded so the next invocation retries it.
  if (chunkErrors.length > 0) {
    throw new Error(`${chunkErrors.length} chunk embedding(s) failed for ${id}: ${chunkErrors.join('; ')}`);
  }

  // Clean up orphaned chunks beyond the new total (in case chunk count shrank).
  if (total > 0) {
    const deleted = await db
      .delete(memoryEmbeddings)
      .where(and(
        eq(memoryEmbeddings.memoryType, 'conversation_chunk'),
        sql`memory_id LIKE ${row.id + ':chunk:%'} AND memory_id NOT IN (${sql.join(
          Array.from({ length: total }, (_, i) => sql`${row.id + ':chunk:' + i}`),
          sql`, `
        )})`,
      ))
      .returning({ memoryId: memoryEmbeddings.memoryId });
    if (deleted.length > 0) {
      console.log(`[cleanup] removed ${deleted.length} orphaned chunk embedding(s) for ${id}`);
    }
  } else {
    // Content shrank below chunk threshold entirely — remove all chunk embeddings.
    const deleted = await db
      .delete(memoryEmbeddings)
      .where(and(
        eq(memoryEmbeddings.memoryType, 'conversation_chunk'),
        sql`memory_id LIKE ${row.id + ':chunk:%'}`,
      ))
      .returning({ memoryId: memoryEmbeddings.memoryId });
    if (deleted.length > 0) {
      console.log(`[cleanup] removed ${deleted.length} orphaned chunk embedding(s) for ${id} (content no longer chunked)`);
    }
  }
}

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error('Usage: npx tsx server/scripts/reembed-memory.ts <memoryId> [<memoryId> ...]');
    process.exit(1);
  }

  for (const id of ids) {
    await reembedOne(id, null);
  }

  console.log('Done.');
  process.exit(0);
}

// Only run main() when this file is the entry point (not when imported as a module).
const isEntryPoint = process.argv[1]?.endsWith('reembed-memory.ts') ||
  process.argv[1]?.endsWith('reembed-memory.js');
if (isEntryPoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

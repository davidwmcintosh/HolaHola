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
import { getMonitoringDb, getUserDb } from '../db';
import { conversationMemories, memoryEmbeddings } from '@shared/schema';
import { generateAndStoreEmbedding } from '../services/semantic-memory-service';
import { splitIntoChunks, reformatSpeakerHeaders } from '../services/memory-embedding-indexer';
import { sql, eq, and, isNull } from 'drizzle-orm';

/**
 * Resolve the correct userId for a founder-tagged conversation_memory row.
 *
 * Priority rules:
 *   1. Explicit `owner:USER_ID` tag — set by founder-chat-sync on INSERT/UPDATE.
 *      Multi-founder safe: each founder's transcripts route to their own pool.
 *   2. `cid:<conversationId>` or `backfill-cid:<conversationId>` tag — looks up
 *      conversations.user_id to derive the actual owner without any hard-coded ID.
 *   3. Founder-tagged with no cid:/owner: — owner unresolvable; returns null as
 *      a signal to the caller to SKIP embedding (not null-scope the embedding).
 *
 * Returns null for non-founder rows (globally scoped shared resource).
 *
 * NOTE: This is async because cid: lookups hit the database.  Callers that already
 * know the owner (founder-chat-sync, backfill scripts) should pass userId explicitly
 * so this resolver is never called for their writes.
 */
async function resolveFounderUserId(tags: string[]): Promise<{ userId: string | null; skip: boolean }> {
  // 1. Explicit owner tag — works for any founder, not just David.
  const ownerTag = tags.find(t => t.startsWith('owner:'));
  if (ownerTag) return { userId: ownerTag.slice('owner:'.length), skip: false };

  // 2. cid: or backfill-cid: tag — look up actual owner in conversations table.
  const cidTag = tags.find(t => t.startsWith('cid:') || t.startsWith('backfill-cid:'));
  if (cidTag) {
    const convId = cidTag.startsWith('backfill-cid:')
      ? cidTag.slice('backfill-cid:'.length)
      : cidTag.slice('cid:'.length);
    try {
      const userDb = getUserDb();
      const result = await userDb.execute(
        sql.raw(`SELECT user_id FROM conversations WHERE id = '${convId.replace(/'/g, "''")}' LIMIT 1`),
      );
      const convRow = ((result as any).rows ?? [])[0];
      if (convRow?.user_id) {
        return { userId: convRow.user_id as string, skip: false };
      }
      // cid: present but conversation row missing — cannot resolve, must skip.
      console.warn(`[reembed-memory] cid: ${convId} found but no conversations row — skipping to prevent null-scope disclosure`);
      return { userId: null, skip: true };
    } catch (err: any) {
      console.warn(`[reembed-memory] Owner lookup failed for cid: ${convId} — skipping: ${err?.message ?? err}`);
      return { userId: null, skip: true };
    }
  }

  // 3. Founder-tagged but no cid:/owner: — owner unresolvable; must skip.
  return { userId: null, skip: true };
}

/**
 * Force re-embed a conversation_memory row and all derived arms.
 *
 * @param id       conversation_memories.id to re-embed
 * @param userId   Optional owning user ID.  Pass the founder/owner's userId for
 *                 private transcripts so the embedding is user-scoped (visible
 *                 only to that user's session via the user-pool query arm).
 *                 Pass undefined or null for genuinely global memories (episodes,
 *                 Daniela teaching notes) that should be globally visible.
 */
export async function reembedConversationMemory(id: string, userId?: string | null): Promise<void> {
  return reembedOne(id, userId ?? null, getMonitoringDb());
}

async function reembedOne(id: string, userId: string | null = null, dbOverride?: any): Promise<void> {
  // Detached recovery processes must use Neon HTTP for reads and embedding-row
  // writes. The WebSocket pool can expose a stale snapshot to the next query.
  const db = dbOverride ?? getMonitoringDb();

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

  const importance = row.importance ?? 7;
  const strength = Math.min(1.0, importance / 10);

  // Determine effectiveUserId:
  // - Explicit caller-supplied userId always wins (e.g. founder-chat-sync knows the owner).
  // - Otherwise, derive from tags: owner: tag → direct, cid:/backfill-cid: → async DB lookup.
  // - Founder-tagged with no resolvable owner → skip (prevent null-scoped global disclosure).
  let effectiveUserId: string | null;
  if (userId !== null) {
    effectiveUserId = userId;
  } else {
    const tags = (row.tags as string[] | null) ?? [];
    const isFounderPrivate = tags.includes('founder-chat') || tags.includes('founder-private');
    if (isFounderPrivate) {
      const resolved = await resolveFounderUserId(tags);
      if (resolved.skip) {
        console.warn(
          `[SKIP] ${id} — founder-tagged memory has no resolvable owner. ` +
          `Embedding skipped to prevent global disclosure. Add cid:<conversationId> tag and re-run.`,
        );
        return;
      }
      effectiveUserId = resolved.userId;
    } else {
      effectiveUserId = null; // Non-founder row: globally scoped (correct for episodes, teaching notes, etc.)
    }
  }

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

  // Arm A: full-content embedding — stored under userId (user-scoped if private, null if global)
  // Pass importance so memory_embeddings.importance is populated from conversation_memories.importance,
  // enabling the importance-first ORDER BY in the global pool queries to work correctly.
  const fullContent = [row.title, row.summary, row.content].filter(Boolean).join('\n\n');
  const fullChanged = await generateAndStoreEmbedding('conversation_memory', row.id, effectiveUserId, fullContent, strength, importance, db);
  console.log(`[conversation_memory] ${id} -> ${fullChanged ? 'RE-EMBEDDED' : 'unchanged (hash matched)'}`);

  // Arm B: summary anchor
  if (row.summary && row.summary.length > 10) {
    const summaryContent = [row.title, row.summary].filter(Boolean).join('\n\n');
    const summaryChanged = await generateAndStoreEmbedding('conversation_summary', row.id, effectiveUserId, summaryContent, strength, importance, db);
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
      const chunkChanged = await generateAndStoreEmbedding('conversation_chunk', chunkId, effectiveUserId, chunkContent, strength, importance, db);
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
    await reembedOne(id, null, getMonitoringDb());
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


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
import { sql, eq, and } from 'drizzle-orm';

export async function reembedConversationMemory(id: string): Promise<void> { return reembedOne(id); }

async function reembedOne(id: string): Promise<void> {
  const db = getSharedDb();

  const rows = await db
    .select({
      id: conversationMemories.id,
      title: conversationMemories.title,
      summary: conversationMemories.summary,
      content: conversationMemories.content,
      importance: conversationMemories.importance,
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

  // Arm A: full-content embedding
  const fullContent = [row.title, row.summary, row.content].filter(Boolean).join('\n\n');
  const fullChanged = await generateAndStoreEmbedding('conversation_memory', row.id, null, fullContent, strength);
  console.log(`[conversation_memory] ${id} -> ${fullChanged ? 'RE-EMBEDDED' : 'unchanged (hash matched)'}`);

  // Arm B: summary anchor
  if (row.summary && row.summary.length > 10) {
    const summaryContent = [row.title, row.summary].filter(Boolean).join('\n\n');
    const summaryChanged = await generateAndStoreEmbedding('conversation_summary', row.id, null, summaryContent, strength);
    console.log(`[conversation_summary] ${id} -> ${summaryChanged ? 'RE-EMBEDDED' : 'unchanged (hash matched)'}`);
  }

  // Arm C: verbatim chunks
  const chunks = splitIntoChunks(row.content);
  const total = chunks.length;
  console.log(`[chunks] ${id} has ${total} chunk(s) (content length ${row.content.length})`);
  for (let i = 0; i < total; i++) {
    const chunkId = `${row.id}:chunk:${i}`;
    const chunkContent = `[Memory: ${row.title ?? 'Untitled'} | Part ${i + 1} of ${total}]\n\n${reformatSpeakerHeaders(chunks[i])}`;
    try {
      const chunkChanged = await generateAndStoreEmbedding('conversation_chunk', chunkId, null, chunkContent, strength);
      console.log(`[conversation_chunk ${i + 1}/${total}] ${id} -> ${chunkChanged ? 'RE-EMBEDDED' : 'unchanged'}`);
    } catch (err: any) {
      console.error(`[ERROR chunk ${i + 1}/${total}] ${id} -> ${err?.message ?? err}`);
    }
  }

  // Clean up orphaned chunks beyond the new total (in case chunk count shrank)
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
    await reembedOne(id);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

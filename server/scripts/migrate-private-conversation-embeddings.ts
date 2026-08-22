/**
 * migrate-private-conversation-embeddings.ts
 *
 * One-time migration: re-embed David's founder chat transcripts under the
 * actual owner's userId (resolved per-row from conversations.user_id via the
 * cid: tag) so they are user-scoped rather than null-scoped (globally accessible).
 *
 * Background
 * ──────────
 * The original backfill pipeline stored all conversation_memories embeddings
 * with userId=NULL.  After this task's write-path fix, NEW conversations synced
 * by founder-chat-sync are stored under the actual conversation owner's userId.
 * This script migrates the EXISTING null-scoped rows so the full history matches
 * the new access-control model.
 *
 * How ownership is resolved
 * ─────────────────────────
 * Each david-daniela-chats row has a cid: tag (e.g. "cid:<conversationId>").
 * This script looks up conversations.user_id for that conversationId and passes
 * it to reembedConversationMemory() as the ownerUserId.  Rows without a
 * resolvable cid: are logged and skipped (not assigned to any hard-coded user).
 *
 * Idempotent: safe to run multiple times.  Each re-embed skips arms whose
 * content hash hasn't changed (unless the null-scoped embedding is first deleted).
 *
 * Requirements
 * ─────────────
 * - OPENAI_API_KEY or USER_OPENAI_API_KEY must be set (embedText is called).
 * - Run from the workspace root: npx tsx server/scripts/migrate-private-conversation-embeddings.ts
 *
 * Preview mode (no changes): add --dry-run flag.
 */

import { getSharedDb, getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import { reembedConversationMemory } from './reembed-memory';

const DRY_RUN = process.argv.includes('--dry-run');
const ARC_NAME = 'david-daniela-chats';

async function resolveOwnerFromTags(tags: string[] | null): Promise<string | null> {
  if (!tags) return null;
  const cidTag = tags.find(t => t.startsWith('cid:'));
  if (!cidTag) return null;
  const conversationId = cidTag.slice('cid:'.length);
  try {
    const userDb = getUserDb();
    const result = await userDb.execute(
      sql.raw(`SELECT user_id FROM conversations WHERE id = '${conversationId.replace(/'/g, "''")}' LIMIT 1`),
    );
    const row = ((result as any).rows ?? [])[0];
    return (row?.user_id as string) ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const db = getSharedDb();

  if (DRY_RUN) console.log('[MIGRATE] DRY RUN — no changes will be made');

  // Find all rows in david-daniela-chats (these all carry cid: tags from founder-chat-sync)
  const memRows = await db.execute(sql`
    SELECT id, title, tags FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
    ORDER BY recorded_at ASC
  `);
  const rows = (memRows as any).rows ?? memRows;
  console.log(`[MIGRATE] Found ${rows.length} row(s) with arc_name='${ARC_NAME}'`);

  let migrated = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const row of rows as Array<{ id: string; title: string; tags: string[] | null }>) {
    const { id, title, tags } = row;

    // Resolve the actual owner via cid: tag — not a hard-coded admin ID
    const ownerUserId = await resolveOwnerFromTags(tags ?? null);

    if (!ownerUserId) {
      console.warn(
        `[MIGRATE] SKIP ${id} — "${title}" : no cid: tag or conversation not found; cannot determine owner safely`,
      );
      unresolved++;
      continue;
    }

    // Check if there's a null-scoped embedding for this row
    const existing = await db.execute(sql`
      SELECT memory_id FROM memory_embeddings
      WHERE memory_id = ${id}
        AND memory_type = 'conversation_memory'
        AND user_id IS NULL
      LIMIT 1
    `);
    const existingRows = (existing as any).rows ?? existing;
    const hasNullScoped = existingRows.length > 0;

    if (!hasNullScoped) {
      console.log(`[SKIP] ${id} — "${title}" (no null-scoped embedding, already migrated or not yet embedded)`);
      skipped++;
      continue;
    }

    console.log(`[MIGRATE] ${id} — "${title}" → userId=${ownerUserId}`);
    if (DRY_RUN) {
      migrated++;
      continue;
    }

    // Delete null-scoped embeddings for this memory
    await db.execute(sql`
      DELETE FROM memory_embeddings
      WHERE (
        (memory_id = ${id} AND memory_type IN ('conversation_memory', 'conversation_summary'))
        OR (memory_id LIKE ${id + ':chunk:%'} AND memory_type = 'conversation_chunk')
      )
      AND user_id IS NULL
    `);

    // Re-embed under the actual owner's userId
    try {
      await reembedConversationMemory(id, ownerUserId);
      migrated++;
    } catch (err: any) {
      console.error(`[ERROR] ${id} — ${err?.message ?? err}`);
    }
  }

  console.log(`\n[MIGRATE] Done. Migrated: ${migrated}, Skipped: ${skipped}, Unresolved: ${unresolved}`);
  if (DRY_RUN) console.log('[MIGRATE] DRY RUN complete — run without --dry-run to apply changes');
  if (unresolved > 0) {
    console.warn(`[MIGRATE] ${unresolved} row(s) could not be migrated — add cid: tags and re-run.`);
  }
}

// Only run when this is the entry point
const isEntry = process.argv[1]?.includes('migrate-private-conversation-embeddings');
if (isEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

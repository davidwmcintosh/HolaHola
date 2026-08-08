/**
 * sync-prequel2-content.ts
 * One-shot script: update the Prequel Episode 2 DB row so its content
 * exactly matches docs/prequel-episode-2.md.
 * Safe to run multiple times (idempotent).
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { conversationMemories } from '@shared/schema';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const ROW_ID   = 'db89e9df-c0ba-4eb8-9004-df398f3237d9';
const DOC_PATH = resolve(__dirname, '../../docs/prequel-episode-2.md');

async function main() {
  const fileContent = readFileSync(DOC_PATH, 'utf-8');
  const db = getSharedDb();

  const [updated] = await db
    .update(conversationMemories)
    .set({ content: fileContent })
    .where(eq(conversationMemories.id, ROW_ID))
    .returning({ id: conversationMemories.id, contentLen: conversationMemories.content });

  if (!updated) {
    console.error('[sync-prequel2] ERROR: row not found or update returned nothing');
    process.exit(1);
  }

  const dbLen = (updated.contentLen ?? '').length;
  console.log(`[sync-prequel2] Updated id=${updated.id}`);
  console.log(`[sync-prequel2] File length : ${fileContent.length}`);
  console.log(`[sync-prequel2] DB length   : ${dbLen}`);
  if (dbLen !== fileContent.length) {
    console.error('[sync-prequel2] ERROR: length mismatch after update');
    process.exit(1);
  }
  console.log('[sync-prequel2] Content matches. Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('[sync-prequel2] Unhandled error:', err?.message ?? err);
  process.exit(1);
});

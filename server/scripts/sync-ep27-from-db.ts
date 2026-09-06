/**
 * One-shot: sync DB record → docs/episode-27.md
 * Usage: npx tsx server/scripts/sync-ep27-from-db.ts
 */
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { join } from 'path';
import { writeProjectionAtomically } from '../services/projection-receipts';

const EP27_ID = '27000000-0000-4000-8000-000000000027';
const filePath = join(process.cwd(), 'docs/episode-27.md');

const db = getSharedDb();
const rows = await db.execute(sql`
  SELECT content FROM conversation_memories WHERE id = ${EP27_ID}
`);
const row = (rows as any).rows?.[0] ?? (rows as any)[0];
if (!row?.content) {
  console.error('No DB record found for episode-27');
  process.exit(1);
}
writeProjectionAtomically(process.cwd(), filePath, row.content as string, {
  kind: 'episode-db-markdown', writer: 'sync-ep27-from-db',
  source: { type: 'conversation_memory', ids: [EP27_ID] },
  reason: 'direct canonical episode sync', correlation: { episodeId: EP27_ID },
});
console.log(`synced db→md: ${(row.content as string).length} chars`);

/**
 * One-shot: sync DB record → docs/episode-27.md
 * Usage: npx tsx server/scripts/sync-ep27-from-db.ts
 */
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { writeFileSync } from 'fs';
import { join } from 'path';

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
writeFileSync(filePath, row.content as string, 'utf-8');
console.log(`synced db→md: ${(row.content as string).length} chars`);

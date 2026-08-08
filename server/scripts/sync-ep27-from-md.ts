/**
 * One-shot: sync docs/episode-27.md → DB record 27000000-0000-4000-8000-000000000027
 * Usage: npx tsx server/scripts/sync-ep27-from-md.ts
 */
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { reembedConversationMemory } from './reembed-memory';

const EP27_ID = '27000000-0000-4000-8000-000000000027';
const filePath = join(process.cwd(), 'docs/episode-27.md');

const content = readFileSync(filePath, 'utf-8');
const db = getSharedDb();

await db.execute(sql`
  UPDATE conversation_memories
  SET content = ${content},
      summary = LEFT(${content}, 500)
  WHERE id = ${EP27_ID}
`);
console.log(`synced md→db: ${content.length} chars`);

await reembedConversationMemory(EP27_ID);
console.log('re-embedded ok');

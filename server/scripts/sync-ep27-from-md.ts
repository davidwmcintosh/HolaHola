/**
 * One-shot: sync docs/episode-27.md → DB record 27000000-0000-4000-8000-000000000027
 *
 * Uses a max-length guard so a stale/shorter invocation cannot shrink a ROLLING
 * episode that has already grown (same invariant as syncEpisodeFile's rolling guard).
 *
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

// Max-length guard: only overwrite if the incoming content is at least as long
// as what is already in the DB — prevents a stale md snapshot from shrinking
// a ROLLING episode that has grown since this file was last written.
const result = await db.execute(sql`
  UPDATE conversation_memories
  SET content = CASE
        WHEN LENGTH(${content}) >= LENGTH(content)
        THEN ${content}
        ELSE content
      END,
      summary = CASE
        WHEN LENGTH(${content}) >= LENGTH(content)
        THEN LEFT(${content}, 500)
        ELSE summary
      END
  WHERE id = ${EP27_ID}
  RETURNING id, LENGTH(content) AS final_len
`);
const row = (result as any).rows?.[0] ?? (result as any)[0];
console.log(`synced md→db: incoming=${content.length} chars, final=${row?.final_len ?? '?'} chars`);

await reembedConversationMemory(EP27_ID);
console.log('re-embedded ok');

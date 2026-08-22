/**
 * One-off backfill: generate titles for conversations that have messages but no title.
 * Run with: npx tsx server/scripts/backfill-conversation-titles.ts
 *
 * Processes conversations with 10+ messages and no title.
 * Uses tagConversation (Gemini Flash) — runs 3 concurrent batches.
 */

import { getSharedDb } from '../neon-db';
import { sql } from 'drizzle-orm';
import { tagConversation } from '../services/conversation-tagger';

const MIN_MESSAGES = 10;
const CONCURRENCY = 3;

async function processOne(id: string, language: string, msg_count: number, idx: number, total: number): Promise<void> {
  const db = getSharedDb();
  console.log(`[Backfill] ${idx}/${total} — ${id.substring(0, 8)} (${language}, ${msg_count} msgs)`);
  try {
    const msgRows = await db.execute(sql`
      SELECT role, content FROM messages WHERE conversation_id = ${id} ORDER BY created_at ASC
    `);
    const msgs = msgRows.rows as Array<{ role: string; content: string }>;
    if (msgs.length < 2) { console.log(`  ${id.substring(0,8)} → skipped (< 2 msgs)`); return; }
    const result = await tagConversation(id, msgs, language || 'english');
    if (result?.title && result.title !== 'Conversation') {
      console.log(`  ${id.substring(0,8)} → "${result.title}"`);
    } else {
      console.log(`  ${id.substring(0,8)} → no usable title`);
    }
  } catch (err: any) {
    console.error(`  ${id.substring(0,8)} → ERROR: ${err.message}`);
  }
}

async function main() {
  const db = getSharedDb();
  console.log(`[Backfill] Fetching untitled conversations with >= ${MIN_MESSAGES} messages...`);

  const rows = await db.execute(sql`
    SELECT c.id, c.language, COUNT(m.id)::int as msg_count
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    WHERE (c.title IS NULL OR c.title = '')
    GROUP BY c.id, c.language
    HAVING COUNT(m.id) >= ${MIN_MESSAGES}
    ORDER BY MAX(m.created_at) DESC
  `);

  const candidates = rows.rows as Array<{ id: string; language: string; msg_count: number }>;
  console.log(`[Backfill] Found ${candidates.length} candidates. Running ${CONCURRENCY} concurrent.`);

  // Process in batches of CONCURRENCY
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((c, j) => processOne(c.id, c.language, c.msg_count, i + j + 1, candidates.length)));
  }

  console.log(`\n[Backfill] Done.`);
  process.exit(0);
}

main().catch(err => {
  console.error('[Backfill] Fatal:', err);
  process.exit(1);
});

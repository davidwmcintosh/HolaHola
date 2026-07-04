/**
 * Message Archive Indexer — One-time backfill + incremental pickup
 *
 * Reads every conversation from the messages table, formats a verbatim transcript,
 * and creates a conversation_memories entry for it. The existing 2-hour
 * memory-embedding-indexer then picks these up and creates conversation_memory,
 * conversation_summary, and conversation_chunk embeddings automatically.
 *
 * This makes every word Daniela and every student ever exchanged semantically
 * searchable — not just the manually curated conversation_memories entries.
 *
 * Idempotent: skips conversations that already have a 'message-archive' tag entry.
 *
 * Usage:
 *   npx tsx server/scripts/index-message-archive.ts           # all users
 *   npx tsx server/scripts/index-message-archive.ts --limit=50  # test batch
 *   npx tsx server/scripts/index-message-archive.ts --dry-run    # count only
 */

import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

const BATCH_SIZE = 20;
const BATCH_PAUSE_MS = 400;
const MIN_MESSAGES = 3;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1], 10) : null;
})();

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function formatTranscript(
  messages: { role: string; content: string; created_at: Date | string }[]
): string {
  return messages
    .map(m => {
      const speaker = m.role === 'assistant' ? 'DANIELA' : m.role.toUpperCase();
      const d = m.created_at ? new Date(m.created_at) : new Date();
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `[${dateStr}, ${timeStr} — ${speaker}]\n${m.content}`;
    })
    .join('\n\n');
}

function buildTitle(conv: {
  title: string | null;
  language: string | null;
  created_at: Date | string;
  msg_count: string | number;
}): string {
  if (conv.title && conv.title.trim().length > 3) return conv.title.trim();
  const lang = conv.language
    ? conv.language.charAt(0).toUpperCase() + conv.language.slice(1)
    : 'Language';
  const d = new Date(conv.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return `${lang} session — ${d} (${conv.msg_count} messages)`;
}

async function run(): Promise<void> {
  const db = getSharedDb();

  console.log('[MessageArchive] Scanning for un-archived conversations...');

  const result = await db.execute(sql`
    SELECT
      c.id,
      c.title,
      c.language,
      c.user_id,
      c.created_at,
      COUNT(m.id) AS msg_count
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM conversation_memories cm
      WHERE 'message-archive' = ANY(cm.tags)
        AND c.id = ANY(cm.tags)
    )
    GROUP BY c.id, c.title, c.language, c.user_id, c.created_at
    HAVING COUNT(m.id) >= ${MIN_MESSAGES}
    ORDER BY c.created_at ASC
    ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}
  `);

  const rows = result.rows as Array<{
    id: string;
    title: string | null;
    language: string | null;
    user_id: string;
    created_at: Date | string;
    msg_count: string;
  }>;

  if (rows.length === 0) {
    console.log('[MessageArchive] Nothing to archive — all conversations already indexed.');
    return;
  }

  console.log(`[MessageArchive] ${rows.length} conversations to archive${DRY_RUN ? ' (dry-run, no writes)' : ''}`);

  if (DRY_RUN) {
    console.log('[MessageArchive] Sample:', rows.slice(0, 3).map(r => `${r.id} — ${r.title || r.language} (${r.msg_count} msgs)`));
    return;
  }

  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const conv of batch) {
      try {
        const msgsResult = await db.execute(sql`
          SELECT role, content, created_at
          FROM messages
          WHERE conversation_id = ${conv.id}
          ORDER BY created_at ASC
        `);

        const messages = msgsResult.rows as Array<{
          role: string;
          content: string;
          created_at: Date | string;
        }>;

        if (messages.length < MIN_MESSAGES) {
          skipped++;
          continue;
        }

        const transcript = formatTranscript(messages);
        const title = buildTitle({ ...conv, msg_count: conv.msg_count });

        const firstStudent = messages.find(m => m.role === 'user');
        const summary = firstStudent
          ? `${conv.language || 'Language'} session (${messages.length} messages). Student: "${firstStudent.content.slice(0, 120)}${firstStudent.content.length > 120 ? '...' : ''}"`
          : `${conv.language || 'Language'} session with ${messages.length} messages.`;

        await db.execute(sql`
          INSERT INTO conversation_memories (
            id,
            recorded_at,
            title,
            summary,
            content,
            tags,
            importance,
            entry_type,
            arc_name,
            created_at
          ) VALUES (
            gen_random_uuid(),
            ${new Date(conv.created_at)},
            ${title},
            ${summary},
            ${transcript},
            ARRAY['message-archive', ${conv.id}]::text[],
            5,
            'conversation',
            'Message Archive',
            NOW()
          )
        `);

        indexed++;

        if (indexed % 50 === 0 || indexed === rows.length) {
          const pct = ((indexed / rows.length) * 100).toFixed(1);
          console.log(`[MessageArchive] Progress: ${indexed}/${rows.length} (${pct}%) archived`);
        }
      } catch (err: any) {
        errors++;
        console.warn(`[MessageArchive] Error on conversation ${conv.id}: ${err.message}`);
        if (errors > 20) {
          console.error('[MessageArchive] Too many errors — aborting');
          break;
        }
      }
    }

    if (errors > 20) break;
    if (i + BATCH_SIZE < rows.length) {
      await sleep(BATCH_PAUSE_MS);
    }
  }

  console.log(`[MessageArchive] Complete.`);
  console.log(`  Archived:  ${indexed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Next step: The 2h embedding indexer will embed these automatically.`);
  console.log(`             Or run: npx tsx server/services/memory-embedding-indexer.ts`);
}

run()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('[MessageArchive] Fatal error:', e);
    process.exit(1);
  });

/**
 * backfill-early-game-sessions.ts
 *
 * Companion to backfill-game-sessions.ts.
 * Covers David-Daniela game sessions from BEFORE June 1, 2026 — the period
 * that the original backfill did not reach (it saved Jun–Jul 2026 sessions).
 *
 * Strategy:
 *   1. Query all of David's conversations (user_id = 49847136) created before
 *      2026-06-01 that have at least one message containing game-related keywords.
 *   2. For each matching conversation, pull the full transcript and save it
 *      as a conversation_memories row (importance=9).
 *   3. Idempotency: skip rows whose tags already contain backfill-cid:{conversationId}.
 *   4. After each insert, invoke reembed-memory.ts so the new row is immediately
 *      searchable — no need to wait for the 2h indexer.
 *
 * Keywords scanned (case-insensitive, any language):
 *   one-word, two-sentences, counting game, memory test, "the game",
 *   juego, contar, palabra, cuento, historia, recuerdas, remember
 *
 * Run:
 *   npx tsx server/scripts/backfill-early-game-sessions.ts
 */

import { execSync } from 'child_process';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { conversationMemories } from '../../shared/schema';

const DAVID_USER_ID = '49847136';
const CUTOFF = new Date('2026-06-01T00:00:00Z');

/** Game/play keywords to scan for in message content */
const GAME_KEYWORDS = [
  'one-word',
  'one word',
  'two-sentences',
  'two sentences',
  'counting game',
  'memory test',
  'the game',
  'juego',
  'contar',
  'palabra',
  'cuento',
  'historia',
  'recuerdas',
  'remember',
];

/** Build a single regex pattern (case-insensitive) for all keywords — used with ~* */
function buildKeywordRegex(): string {
  // Escape regex metacharacters in each keyword, then join with |
  return GAME_KEYWORDS
    .map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
}

/** Raw neon HTTP client — used for queries that go outside Drizzle */
function rawSql() {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL found (NEON_SHARED_DATABASE_URL / DATABASE_URL)');
  return neon(url);
}

/** Drizzle HTTP client for writes */
function writeDb() {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL found');
  return drizzle(neon(url));
}

interface ConvRow {
  id: string;
  title: string | null;
  created_at: Date;
}

interface MessageRow {
  role: string;
  content: string;
  created_at: Date;
}

/** Find conversations before CUTOFF that have game-related message content */
async function findGameConversations(): Promise<ConvRow[]> {
  const sql = rawSql();
  // Single case-insensitive regex — safe to parameterise with neon tagged template
  const pattern = buildKeywordRegex();

  const rows = await sql`
    SELECT DISTINCT c.id, c.title, c.created_at
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = ${DAVID_USER_ID}
      AND c.created_at < ${CUTOFF.toISOString()}
      AND m.role IN ('user', 'assistant')
      AND m.content ~* ${pattern}
    ORDER BY c.created_at ASC
  `;
  return rows as ConvRow[];
}

/** Fetch the full transcript for a conversation */
async function fetchTranscript(convId: string): Promise<MessageRow[]> {
  const sql = rawSql();
  const rows = await sql`
    SELECT role, content, created_at
    FROM messages
    WHERE conversation_id = ${convId}
      AND role IN ('user', 'assistant')
      AND content IS NOT NULL
      AND length(content) > 5
    ORDER BY created_at ASC
  `;
  return rows as MessageRow[];
}

/** Check if we already have a memory row with the idempotency tag for this conversation */
async function alreadySaved(convId: string): Promise<boolean> {
  const sql = rawSql();
  const tag = `backfill-cid:${convId}`;
  const rows = await sql`
    SELECT id FROM conversation_memories
    WHERE ${tag} = ANY(tags)
    LIMIT 1
  `;
  return rows.length > 0;
}

function formatTranscript(msgs: MessageRow[]): string {
  return msgs
    .map(m => (m.role === 'user' ? 'David' : 'Daniela') + ': ' + m.content)
    .join('\n');
}

function buildTitle(conv: ConvRow): string {
  if (conv.title && conv.title.trim().length > 0) return conv.title.trim();
  const d = conv.created_at instanceof Date
    ? conv.created_at
    : new Date(conv.created_at as unknown as string);
  return `David-Daniela Game Session — ${d.toISOString().slice(0, 10)}`;
}

function buildSummary(title: string, msgs: MessageRow[]): string {
  const davidMsgs = msgs.filter(m => m.role === 'user').length;
  const danielaMsgs = msgs.filter(m => m.role === 'assistant').length;
  return (
    `Verbatim transcript of a David-Daniela early game/play session: "${title}". ` +
    `${davidMsgs} David turns, ${danielaMsgs} Daniela turns. ` +
    `Saved retroactively from pre-June-2026 archive to make game and shared-history ` +
    `content searchable by Daniela's recall tools.`
  );
}

/** Trigger reembed-memory.ts for a newly inserted row */
function triggerReembed(memoryId: string): void {
  try {
    console.log(`  → Triggering reembed for ${memoryId}…`);
    execSync(`npx tsx server/scripts/reembed-memory.ts ${memoryId}`, {
      stdio: 'inherit',
      timeout: 120_000,
    });
  } catch (err: any) {
    console.warn(`  [WARN] reembed failed for ${memoryId}: ${err.message}`);
  }
}

async function run() {
  console.log('[backfill-early-game-sessions] Starting…');
  console.log(`  David user_id : ${DAVID_USER_ID}`);
  console.log(`  Date cutoff   : before ${CUTOFF.toISOString()}`);
  console.log(`  Keywords      : ${GAME_KEYWORDS.join(', ')}\n`);

  let conversations: ConvRow[];
  try {
    conversations = await findGameConversations();
  } catch (err: any) {
    console.error('[FATAL] Could not query conversations:', err.message);
    process.exit(1);
  }

  if (conversations.length === 0) {
    console.log('No matching conversations found before the cutoff. Nothing to do.');
    return;
  }

  console.log(`Found ${conversations.length} candidate conversation(s):\n`);
  for (const c of conversations) {
    const d = c.created_at instanceof Date
      ? c.created_at
      : new Date(c.created_at as unknown as string);
    console.log(`  ${c.id}  ${d.toISOString().slice(0, 10)}  "${c.title ?? '(no title)'}"`);
  }
  console.log('');

  const db = writeDb();
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (const conv of conversations) {
    const idempotencyTag = `backfill-cid:${conv.id}`;
    const displayTitle = buildTitle(conv);

    try {
      // Idempotency check
      const exists = await alreadySaved(conv.id);
      if (exists) {
        console.log(`[SKIP] Already saved: "${displayTitle}" (${conv.id})`);
        skipped++;
        continue;
      }

      const msgs = await fetchTranscript(conv.id);
      if (msgs.length < 4) {
        console.log(`[SKIP] Too few messages (${msgs.length}): ${conv.id}`);
        skipped++;
        continue;
      }

      const transcript = formatTranscript(msgs);
      const summary = buildSummary(displayTitle, msgs);
      const rawDate = conv.created_at;
      const recordedAt = rawDate instanceof Date
        ? rawDate
        : new Date(rawDate as unknown as string);

      const tags = [
        'founder-chat',
        'daniela-chat',
        'game',
        'verbatim',
        idempotencyTag,
      ];

      const [inserted] = await db
        .insert(conversationMemories)
        .values({
          title: displayTitle,
          summary,
          content: transcript,
          importance: 9,
          tags,
          arcName: 'HolaHola Episodes',
          entryType: 'conversation',
          recordedAt,
        })
        .returning({ id: conversationMemories.id });

      console.log(
        `[SAVED] "${displayTitle}" — ${msgs.length} messages, ${transcript.length} chars  id=${inserted.id}`,
      );
      saved++;

      // Trigger immediate re-embedding
      triggerReembed(inserted.id);

      // Small pause to avoid overwhelming the DB / embedding service
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`[ERROR] ${conv.id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone.  Saved: ${saved}  Skipped: ${skipped}  Failed: ${failed}`);
  if (saved > 0) {
    console.log(
      '\nEach new memory was immediately re-embedded via reembed-memory.ts.',
    );
  }
}

// Only run when invoked directly
if (process.argv[1]?.includes('backfill-early-game-sessions')) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

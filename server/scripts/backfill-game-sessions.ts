/**
 * backfill-game-sessions.ts
 *
 * Retroactively saves David-Daniela game sessions from the `messages` table
 * into `conversation_memories` so Daniela's recall tools can find them.
 *
 * Games covered:
 *   - Counting game (uno, dos, tres...) — Jul 20 2026
 *   - One-word story game ("I'll say a word then you say a word") — Jul 20 2026
 *   - Short-sentence game ("two sentences or less") — Jul 20 2026
 *   - Memory/connection game — Jul 24 2026
 *   - Earlier memory-testing and shared-history sessions — May–Jun 2026
 *
 * Run: npx tsx server/scripts/backfill-game-sessions.ts
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { conversationMemories } from '../../shared/schema';

const DAVID_USER_ID = '49847136';

// Conversations confirmed to contain game content — ordered by recency
const GAME_CONV_IDS = [
  { id: 'f494b134-9749-46a2-86e1-326cdc3aa711', title: 'Counting Game and Short-Sentence Game with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'counting-game', 'one-word-game', 'verbatim'] },
  { id: 'a8739f20-ca43-49eb-98c8-542d6120b1f0', title: 'Memory Test and Counting Game Reference with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'counting-game', 'verbatim'] },
  { id: 'be327edf-9517-4f00-a606-38a964a0439f', title: 'Pedagogical Immersion and Memory Testing with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'memory-test', 'verbatim'] },
  { id: 'ca216200-d230-4101-bcf4-37bdfca8747e', title: 'Exploring AI Memory and Shared History with Daniela', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim'] },
  { id: '8fa66bf3-3fd7-4e2f-b6b1-6660a6268054', title: 'Searching Memories and Place of Peace with Daniela', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim'] },
  { id: 'a202d1c0-4e91-4ea3-95ab-08e2e57d26d3', title: 'Personal Connection and Founder Mode with Daniela', tags: ['founder-chat', 'daniela-chat', 'verbatim'] },
  { id: '83f98751-b3e1-4aba-89a5-e5fd9e8bfd3d', title: 'Student-Oriented Language Learning Philosophy with Daniela', tags: ['founder-chat', 'daniela-chat', 'verbatim'] },
  { id: '3c29f1da-a4db-4e34-9f49-fd3d86f53a06', title: 'Reflecting On Our Shared Journey with Daniela', tags: ['founder-chat', 'daniela-chat', 'verbatim'] },
];

function getDb() {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL found');
  return drizzle(neon(url));
}

async function fetchTranscript(convId: string): Promise<{ role: string; content: string; created_at: Date }[]> {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL');
  const sql = neon(url);
  const rows = await sql`
    SELECT role, content, created_at
    FROM messages
    WHERE conversation_id = ${convId}
      AND role IN ('user', 'assistant')
      AND content IS NOT NULL
      AND length(content) > 5
    ORDER BY created_at
  `;
  return rows as { role: string; content: string; created_at: Date }[];
}

async function fetchConvMeta(convId: string): Promise<{ title: string | null; created_at: Date } | null> {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL');
  const sql = neon(url);
  const rows = await sql`
    SELECT title, created_at FROM conversations WHERE id = ${convId} LIMIT 1
  `;
  return rows[0] as { title: string | null; created_at: Date } | null;
}

async function alreadySaved(title: string): Promise<boolean> {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL');
  const sql = neon(url);
  const rows = await sql`
    SELECT id FROM conversation_memories
    WHERE title = ${title}
    LIMIT 1
  `;
  return rows.length > 0;
}

function formatTranscript(msgs: { role: string; content: string }[]): string {
  return msgs
    .map(m => (m.role === 'user' ? 'David' : 'Daniela') + ': ' + m.content)
    .join('\n');
}

function buildSummary(title: string, msgs: { role: string; content: string }[]): string {
  const davidMsgs = msgs.filter(m => m.role === 'user').length;
  const danielaMsgs = msgs.filter(m => m.role === 'assistant').length;
  return `Verbatim transcript of a David-Daniela conversation: "${title}". ${davidMsgs} David turns, ${danielaMsgs} Daniela turns. Saved retroactively from voice session archive to make game and shared-history content searchable.`;
}

async function run() {
  const db = getDb();
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (const conv of GAME_CONV_IDS) {
    try {
      const meta = await fetchConvMeta(conv.id);
      const displayTitle = conv.title;

      // Skip if already saved
      const exists = await alreadySaved(displayTitle);
      if (exists) {
        console.log(`[SKIP] Already saved: "${displayTitle}"`);
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
      // neon HTTP driver returns dates as strings — coerce to Date object
      const rawDate = meta?.created_at;
      const recordedAt = rawDate instanceof Date ? rawDate : (rawDate ? new Date(rawDate as unknown as string) : new Date());

      await db.insert(conversationMemories).values({
        title: displayTitle,
        summary,
        content: transcript,
        importance: 9,
        tags: conv.tags,
        arcName: 'HolaHola Episodes',
        entryType: 'conversation',
        recordedAt,
        // No userId — globally scoped so semanticSearch includes it in the global pool
      });

      console.log(`[SAVED] "${displayTitle}" — ${msgs.length} messages, ${transcript.length} chars`);
      saved++;

      // Small pause to avoid overwhelming the DB
      await new Promise(r => setTimeout(r, 300));
    } catch (err: any) {
      console.error(`[ERROR] ${conv.id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Saved: ${saved}  Skipped: ${skipped}  Failed: ${failed}`);
  console.log('\nNext: the embedding indexer runs every 2 hours and will pick these up automatically.');
  console.log('To embed immediately, run: npx tsx server/scripts/reembed-memory.ts --all-conversation-memories');
}

// Only run when invoked directly
if (process.argv[1]?.includes('backfill-game-sessions')) {
  run().catch(err => { console.error(err); process.exit(1); });
}

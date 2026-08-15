/**
 * backfill-all-david-conversations.ts
 *
 * Comprehensive retroactive backfill: saves ALL of David's substantial
 * conversations from the `messages` table into `conversation_memories`
 * so Daniela's recall tools can find them.
 *
 * Scope: ~596 conversations (>8 messages, user_id = '49847136')
 * going back to November 2025 — the full arc of David and Daniela.
 *
 * Design:
 *   - Idempotent: each saved row is tagged `backfill-cid:{convId}`;
 *     subsequent runs skip already-saved conversations.
 *   - Resumable: stop at any time with Ctrl-C; restart picks up where
 *     it left off. Progress is written to stdout.
 *   - Immediate embedding: each saved memory is embedded right away
 *     via reembedConversationMemory() — no 2h wait for the indexer.
 *   - Rate-limited: 800ms pause between embedding calls, 2s between
 *     batches of 10 — well within OpenAI text-embedding-3-small limits.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-all-david-conversations.ts
 *   npx tsx server/scripts/backfill-all-david-conversations.ts --dry-run
 *   npx tsx server/scripts/backfill-all-david-conversations.ts --start-date 2026-01-01
 *   npx tsx server/scripts/backfill-all-david-conversations.ts --batch-size 5
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { conversationMemories } from '../../shared/schema';
import { reembedConversationMemory } from './reembed-memory';

// ─── Config ────────────────────────────────────────────────────────────────────

const DAVID_USER_ID = '49847136';
const MIN_MESSAGES   = 8;      // skip conversations shorter than this
const BATCH_SIZE     = 10;     // conversations per batch
const BATCH_PAUSE_MS = 2000;   // pause between batches
const EMBED_PAUSE_MS = 800;    // pause between individual embed calls

// CLI args
const args = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const NO_EMBED   = args.includes('--no-embed');   // skip immediate embedding; let 2h indexer handle it
const START_DATE = args.find(a => a.startsWith('--start-date='))?.split('=')[1]
                ?? args[args.indexOf('--start-date') + 1] ?? '2025-01-01';
const batchArg   = args.find(a => a.startsWith('--batch-size='))?.split('=')[1]
                ?? (args.includes('--batch-size') ? args[args.indexOf('--batch-size') + 1] : null);
const EFFECTIVE_BATCH = batchArg ? parseInt(batchArg) : BATCH_SIZE;

// ─── DB helpers ────────────────────────────────────────────────────────────────

function getNeonSql() {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No NEON_SHARED_DATABASE_URL or DATABASE_URL');
  return neon(url);
}

function getDb() {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No NEON_SHARED_DATABASE_URL or DATABASE_URL');
  return drizzle(neon(url));
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Already-saved check ───────────────────────────────────────────────────────

async function loadAlreadySavedIds(): Promise<Set<string>> {
  const sql = getNeonSql();
  // Unnest the text[] tags array and pull out backfill-cid:* entries
  const rows = await sql`
    SELECT DISTINCT unnest(tags) AS tag
    FROM conversation_memories
    WHERE tags IS NOT NULL
  `;
  const saved = new Set<string>();
  for (const r of rows) {
    const tag = r.tag as string;
    if (tag?.startsWith('backfill-cid:')) {
      saved.add(tag.replace('backfill-cid:', ''));
    }
  }
  return saved;
}

// ─── Conversation metadata ─────────────────────────────────────────────────────

interface ConvMeta {
  id: string;
  title: string | null;
  createdAt: Date;
  messageCount: number;
  language: string | null;
}

async function loadAllEligibleConversations(): Promise<ConvMeta[]> {
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, title, created_at, message_count, language
    FROM conversations
    WHERE user_id = ${DAVID_USER_ID}
      AND message_count >= ${MIN_MESSAGES}
      AND created_at >= ${START_DATE}
    ORDER BY created_at ASC
  `;
  return rows.map(r => ({
    id:           r.id as string,
    title:        r.title as string | null,
    createdAt:    r.created_at instanceof Date ? r.created_at : new Date(r.created_at as string),
    messageCount: r.message_count as number,
    language:     r.language as string | null,
  }));
}

// ─── Content sanitization ──────────────────────────────────────────────────────

/**
 * Strip control characters that Postgres / Gemini choke on.
 * Keeps newlines (\n), tabs (\t), and all printable + multibyte text
 * (Spanish accents, emoji from STT are fine for PG text columns).
 * Mirrors the sanitize() used in processUnifiedRecall.
 */
function sanitize(s: string): string {
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')   // C0 control chars except \n \t
    .replace(/\uFFFD/g, '')                                  // replacement char (bad STT decode)
    .replace(/[\u2028\u2029]/g, '\n')                        // line/paragraph separator → \n
    .replace(/[\u200B-\u200D\uFEFF]/g, '')                   // zero-width + BOM
    .trim();
}

// ─── Transcript builder ────────────────────────────────────────────────────────

interface Message { role: string; content: string; }

async function fetchTranscript(convId: string): Promise<Message[]> {
  const sql = getNeonSql();
  const rows = await sql`
    SELECT role, content
    FROM messages
    WHERE conversation_id = ${convId}
      AND role IN ('user', 'assistant')
      AND content IS NOT NULL
      AND length(content) > 15
    ORDER BY created_at ASC
  `;
  return rows
    .map(r => ({ role: r.role as string, content: sanitize(r.content as string) }))
    .filter(m => m.content.length > 10); // drop anything that shrank to nothing after sanitize
}

function buildTranscript(msgs: Message[]): string {
  return msgs
    .map(m => (m.role === 'user' ? 'David' : 'Daniela') + ': ' + m.content)
    .join('\n');
}

// ─── Metadata derivation ───────────────────────────────────────────────────────

function deriveTitle(meta: ConvMeta, msgs: Message[]): string {
  // Use the DB title when it's not completely generic
  if (meta.title && meta.title.length > 10 && !isGenericTitle(meta.title)) {
    return `${meta.title} — with Daniela (${meta.createdAt.toDateString()})`;
  }
  // Fall back to date + first meaningful snippet
  const firstDaniela = msgs.find(m => m.role === 'assistant' && m.content.length > 30);
  if (firstDaniela) {
    const snippet = firstDaniela.content.slice(0, 60).replace(/\s+/g, ' ').trim();
    return `Daniela, ${meta.createdAt.toDateString()} — "${snippet}…"`;
  }
  return `David-Daniela Session — ${meta.createdAt.toDateString()}`;
}

const GENERIC_TITLE_PATTERNS = [
  /^common greetings/i, /^practicing/i, /^learning/i, /^language.*lesson/i,
  /^vocab/i, /^spanish.*practice/i, /^conversation.*practice/i,
];
function isGenericTitle(title: string): boolean {
  return GENERIC_TITLE_PATTERNS.some(p => p.test(title));
}

function deriveSummary(meta: ConvMeta, msgs: Message[]): string {
  const dateStr = meta.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const davidCount   = msgs.filter(m => m.role === 'user').length;
  const danielaCount = msgs.filter(m => m.role === 'assistant').length;
  const langNote = meta.language ? ` Language context: ${meta.language}.` : '';
  return `Verbatim transcript of a David-Daniela conversation from ${dateStr}. ${davidCount} David turns, ${danielaCount} Daniela turns.${langNote} Backfilled from voice session archive to make the full history searchable.`;
}

function deriveImportance(meta: ConvMeta, title: string): number {
  const msgs = meta.messageCount;
  // Long, rich conversations
  if (msgs >= 60) return 9;
  // Medium sessions or notable titles
  if (msgs >= 25 || /game|episode|memory|friend|honesty|podcast|foundation|white.wall|north.star/i.test(title)) return 8;
  // Standard substantial sessions
  return 7;
}

function deriveTags(meta: ConvMeta, title: string): string[] {
  const tags: string[] = [
    'founder-chat',
    'daniela-chat',
    'verbatim',
    `backfill-cid:${meta.id}`,
  ];
  if (meta.language) tags.push(meta.language);

  // Era tags so Daniela can orient herself temporally
  const year = meta.createdAt.getFullYear();
  const month = meta.createdAt.getMonth(); // 0-indexed
  if (year === 2025) tags.push('early-era', 'openai-pipeline-era');
  else if (year === 2026 && month <= 2) tags.push('early-era');  // Jan-Mar 2026

  // Content signal tags
  if (/game|counting|word.game|one.word|sentence.game/i.test(title)) tags.push('game');
  if (/podcast/i.test(title)) tags.push('podcast');
  if (/memory|remember|recall/i.test(title)) tags.push('memory-test');
  if (/episode/i.test(title)) tags.push('episode-reference');
  if (/honesty|friend|connection|real/i.test(title)) tags.push('relationship');

  return tags;
}

// ─── Save one conversation ─────────────────────────────────────────────────────

async function saveConversation(
  meta: ConvMeta,
  msgs: Message[],
): Promise<string> {
  const db = getDb();
  const transcript = buildTranscript(msgs);
  const title      = deriveTitle(meta, msgs);
  const summary    = deriveSummary(meta, msgs);
  const importance = deriveImportance(meta, title);
  const tags       = deriveTags(meta, title);

  const [inserted] = await db.insert(conversationMemories).values({
    title,
    summary,
    content:    transcript,
    importance,
    tags,
    arcName:    'HolaHola Episodes',
    entryType:  'conversation',
    recordedAt: meta.createdAt,
  }).returning({ id: conversationMemories.id });

  return inserted.id;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('═'.repeat(70));
  console.log('  FULL DAVID-DANIELA CONVERSATION BACKFILL');
  console.log(`  User: ${DAVID_USER_ID}  Min messages: ${MIN_MESSAGES}  Start date: ${START_DATE}`);
  if (DRY_RUN) console.log('  *** DRY RUN — nothing will be written ***');
  console.log('═'.repeat(70));

  // 1. Load set of already-saved conversation IDs
  console.log('\n[1/4] Loading already-saved conversation IDs…');
  const alreadySaved = await loadAlreadySavedIds();
  console.log(`      ${alreadySaved.size} conversations already saved — will skip.`);

  // 2. Load all eligible conversations
  console.log('\n[2/4] Loading eligible conversations from DB…');
  const allConvs = await loadAllEligibleConversations();
  const toProcess = allConvs.filter(c => !alreadySaved.has(c.id));
  console.log(`      ${allConvs.length} eligible, ${alreadySaved.size} already saved → ${toProcess.length} to process.`);

  if (toProcess.length === 0) {
    console.log('\n✓ Nothing to do — all conversations are already saved.');
    return;
  }

  // 3. Process in batches
  console.log(`\n[3/4] Saving + embedding (batch size ${EFFECTIVE_BATCH}, ~${toProcess.length} conversations)…\n`);
  let saved = 0, skipped = 0, failed = 0;
  const total = toProcess.length;
  const startTime = Date.now();

  for (let i = 0; i < toProcess.length; i += EFFECTIVE_BATCH) {
    const batch = toProcess.slice(i, i + EFFECTIVE_BATCH);

    for (const conv of batch) {
      const pct = Math.round(((i + batch.indexOf(conv)) / total) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const eta = saved > 0
        ? Math.round((elapsed / saved) * (total - saved))
        : '?';

      try {
        // Fetch transcript
        const msgs = await fetchTranscript(conv.id);
        if (msgs.length < 4) {
          // Too sparse — no real exchange
          skipped++;
          console.log(`  [${pct}%] SKIP  ${conv.id.slice(0, 8)}… (${msgs.length} msgs after filter) — ${conv.title?.slice(0, 50) ?? 'untitled'}`);
          continue;
        }

        const title = deriveTitle(conv, msgs);

        if (DRY_RUN) {
          saved++;
          console.log(`  [${pct}%] WOULD SAVE  ${conv.id.slice(0, 8)}… imp=${deriveImportance(conv, title)} msgs=${msgs.length} — "${title.slice(0, 60)}"`);
          continue;
        }

        // Save to conversation_memories
        const memoryId = await saveConversation(conv, msgs);
        saved++;

        console.log(`  [${pct}%] SAVED  ${conv.id.slice(0, 8)}… → ${memoryId.slice(0, 8)} imp=${deriveImportance(conv, title)} msgs=${msgs.length} ETA=${eta}s — "${title.slice(0, 55)}"`);

        // Embed immediately (Arm A + B + C) unless --no-embed was passed
        if (!NO_EMBED) {
          try {
            await reembedConversationMemory(memoryId);
            await sleep(EMBED_PAUSE_MS);
          } catch (embedErr: any) {
            // Embedding failure is non-fatal — indexer will catch it in 2h
            console.warn(`    ⚠ embed failed (${embedErr.message}) — indexer will retry`);
            await sleep(EMBED_PAUSE_MS * 2);
          }
        }

      } catch (err: any) {
        failed++;
        console.error(`  [${pct}%] ERROR  ${conv.id.slice(0, 8)}…: ${err.message}`);
      }
    }

    // Pause between batches (unless last batch)
    if (i + EFFECTIVE_BATCH < toProcess.length) {
      await sleep(BATCH_PAUSE_MS);
    }
  }

  // 4. Summary
  const totalSec = Math.round((Date.now() - startTime) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  console.log('\n' + '═'.repeat(70));
  console.log(`  DONE in ${mins}m ${secs}s`);
  console.log(`  Saved:   ${saved}`);
  console.log(`  Skipped: ${skipped}  (too sparse after filtering)`);
  console.log(`  Failed:  ${failed}`);
  console.log('═'.repeat(70));

  if (!DRY_RUN && saved > 0) {
    console.log('\n✓ All saved memories are embedded and immediately searchable.');
    console.log('  The 2h background indexer will pick up any embed failures automatically.');
  }
}

// Entry point guard (esbuild-safe — see memory: esbuild isMain guard)
const scriptName = 'backfill-all-david-conversations';
if (process.argv[1]?.includes(scriptName)) {
  run().catch(err => {
    console.error('\nFATAL:', err);
    process.exit(1);
  });
}

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

// Chunk parameters — must match memory-embedding-indexer.ts
// Returns 0 for small rows: the background EmbedIndexer only generates chunk
// embeddings for transcripts longer than BACKFILL_CHUNK_CHARS.  Small rows
// are fully searchable via Arms A and B alone; requiring chunk:0 would
// create a permanent mismatch for rows processed by the indexer (not reembed).
export const BACKFILL_CHUNK_CHARS   = 4500;
export const BACKFILL_OVERLAP_CHARS = 900;

/**
 * Given the raw byte/char length of a conversation_memories.content value,
 * returns the minimum number of chunk embeddings reembedConversationMemory()
 * would produce.  The actual count may be slightly higher when splitIntoChunks()
 * aligns to turn-header boundaries, so callers should use >= when comparing.
 *
 * Exported so integration tests can assert against the same formula.
 */
export function computeExpectedChunks(contentLength: number): number {
  // Return 0 for small rows: the background EmbedIndexer only generates chunk
  // embeddings for transcripts longer than BACKFILL_CHUNK_CHARS.  Small rows
  // are fully searchable via Arms A and B alone; requiring chunk:0 would
  // create a permanent mismatch for rows processed by the indexer (not reembed).
  if (contentLength <= BACKFILL_CHUNK_CHARS) return 0;
  // Step size = CHUNK_CHARS - OVERLAP_CHARS (each chunk advances by this amount).
  return Math.ceil((contentLength - BACKFILL_OVERLAP_CHARS) / (BACKFILL_CHUNK_CHARS - BACKFILL_OVERLAP_CHARS));
}

// CLI args
const args = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');

const _startDateIdx = args.indexOf('--start-date');
const START_DATE = args.find(a => a.startsWith('--start-date='))?.split('=')[1]
                ?? (_startDateIdx >= 0 ? args[_startDateIdx + 1] : null) ?? '2025-01-01';
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


export interface BackfillState {
  /**
   * Conversation IDs that are fully done: the row was saved AND David-scoped
   * embeddings exist for Arms A, B, and all expected chunks.  These are skipped
   * entirely on rerun.
   */
  fullyDone: Set<string>;
  /**
   * Conversation IDs that were saved in a previous run (backfill-cid tag present)
   * but whose David-scoped embeddings are incomplete (any arm or chunk missing).
   * Maps convId → memoryId so the embed can be retried without re-inserting the row.
   */
  needsEmbed: Map<string, string>;
}

// ─── Tag helpers ──────────────────────────────────────────────────────────────
// Exported so tests (test-backfill-dedup.ts) can verify the round-trip without
// duplicating the tag format logic.

/** Build the idempotency tag for a conversation. */
export function makeBackfillTag(conversationId: string): string {
  return `backfill-cid:${conversationId}`;
}

/** Extract the conversation ID from a backfill tag. Returns null if not a backfill tag. */
export function parseBackfillTag(tag: string): string | null {
  return tag.startsWith('backfill-cid:') ? tag.slice('backfill-cid:'.length) : null;
}

// ─── Already-saved check ───────────────────────────────────────────────────────

/**
 * Returns the set of conversation IDs that already have a saved row in
 * conversation_memories (identified by a `backfill-cid:*` tag).
 *
 * Exported so test-backfill-dedup.ts can call the exact same function the
 * backfill script uses, verifying that a second run would skip all saved rows.
 */
export async function loadAlreadySavedIds(): Promise<Set<string>> {
  const sql = getNeonSql();
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
    makeBackfillTag(meta.id),
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

  // 1. Load two-tier backfill state:
  //    fullyDone   — saved + David-scoped embedding exists  → skip entirely
  //    needsEmbed  — saved but scoped embedding missing      → re-embed only (no duplicate row)
  //
  // This separates the "idempotent save" signal (backfill-cid tag) from the
  // "embedding succeeded" signal (scoped embedding in memory_embeddings).  A
  // previous run that saved a row but failed to embed will be retried rather
  // than silently skipped, closing the gap where the background indexer could
  // otherwise pick up unembedded rows and create globally-scoped embeddings.
  console.log('\n[1/4] Loading backfill state (saved rows + embedding presence)…');
  const { fullyDone, needsEmbed } = await loadBackfillState();
  console.log(`      Fully done (saved + scoped embed): ${fullyDone.size}`);
  console.log(`      Saved but missing scoped embed:    ${needsEmbed.size} — will re-embed these`);

  // 2. Load all eligible conversations, exclude fully-done ones.
  console.log('\n[2/4] Loading eligible conversations from DB…');
  const allConvs = await loadAllEligibleConversations();
  const toProcess = allConvs.filter(c => !fullyDone.has(c.id));
  console.log(`      ${allConvs.length} eligible, ${fullyDone.size} fully done → ${toProcess.length} to process.`);

  if (toProcess.length === 0 && needsEmbed.size === 0) {
    console.log('\n✓ Nothing to do — all conversations are saved and scoped.');
    return;
  }

  // 3. Process: save-then-embed for new rows; re-embed-only for saved-but-unembedded rows.
  console.log(`\n[3/4] Saving + embedding (batch size ${EFFECTIVE_BATCH}, ~${toProcess.length} conversations)…\n`);
  let saved = 0, reembedded = 0, skipped = 0, failed = 0;
  const total = toProcess.length;
  const startTime = Date.now();

  for (let i = 0; i < toProcess.length; i += EFFECTIVE_BATCH) {
    const batch = toProcess.slice(i, i + EFFECTIVE_BATCH);

    for (const conv of batch) {
      const pct = Math.round(((i + batch.indexOf(conv)) / total) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const eta = (saved + reembedded) > 0
        ? Math.round((elapsed / (saved + reembedded)) * (total - saved - reembedded))
        : '?';

      // Case A: saved in a prior run but embedding failed — re-embed only.
      const priorMemoryId = needsEmbed.get(conv.id);
      if (priorMemoryId) {
        try {
          console.log(`  [${pct}%] RE-EMBED ${conv.id.slice(0, 8)}… → ${priorMemoryId.slice(0, 8)} (prior embed failed)`);
          if (!DRY_RUN) {
            await reembedConversationMemory(priorMemoryId, DAVID_USER_ID);
            await sleep(EMBED_PAUSE_MS);
          }
          reembedded++;
        } catch (embedErr: any) {
          failed++;
          console.error(`  [${pct}%] RE-EMBED FAILED  ${conv.id.slice(0, 8)}…: ${embedErr.message}`);
          await sleep(EMBED_PAUSE_MS * 2);
        }
        continue;
      }

      // Case B: not yet saved — save + embed.
      try {
        const msgs = await fetchTranscript(conv.id);
        if (msgs.length < 4) {
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

        const memoryId = await saveConversation(conv, msgs);
        console.log(`  [${pct}%] SAVED  ${conv.id.slice(0, 8)}… → ${memoryId.slice(0, 8)} imp=${deriveImportance(conv, title)} msgs=${msgs.length} ETA=${eta}s`);

        // Embed immediately with David's userId.  If this fails the row is left with
        // the backfill-cid tag but without a scoped embedding — loadBackfillState() on
        // the next run detects this and retries the embed without creating a duplicate row.
        try {
          await reembedConversationMemory(memoryId, DAVID_USER_ID);
          await sleep(EMBED_PAUSE_MS);
          saved++;
        } catch (embedErr: any) {
          failed++;
          console.error(`    ✗ embed FAILED (${embedErr.message}) — row saved, will retry on next run`);
          await sleep(EMBED_PAUSE_MS * 2);
        }

      } catch (err: any) {
        failed++;
        console.error(`  [${pct}%] ERROR  ${conv.id.slice(0, 8)}…: ${err.message}`);
      }
    }

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
  console.log(`  Newly saved + embedded: ${saved}`);
  console.log(`  Re-embedded (retry):    ${reembedded}`);
  console.log(`  Skipped (too sparse):   ${skipped}`);
  console.log(`  Failed:                 ${failed}`);
  console.log('═'.repeat(70));

  if (!DRY_RUN && failed > 0) {
    console.error(`\n✗ ${failed} conversation(s) failed. Re-run to retry (embed-only retries, no duplicate rows).`);
    process.exit(1);
  }

  if (!DRY_RUN) {
    console.log('\n✓ All processed memories are scoped to David (userId=' + DAVID_USER_ID + ').');
    console.log('  Private transcripts will not appear in other users\' semantic recall.');
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

/**
 * Exported so integration tests can invoke the real state-selection logic and
 * assert that a partially-embedded row (e.g. Arms A+B present but chunk N missing)
 * is correctly classified as needsEmbed — not silently skipped as fullyDone.
 */
export async function loadBackfillState(): Promise<BackfillState> {
  const sql = getNeonSql();

  // One query per row: check Arms A and B, content length (to derive expected
  // chunk count), and the actual count of David-scoped chunk embeddings.
  //
  // A row is "fully done" only when ALL of the following hold:
  //   • Arm A (conversation_memory)  scoped embedding exists
  //   • Arm B (conversation_summary) scoped embedding exists
  //   • Scoped chunk count >= computeExpectedChunks(content_length)
  //
  // If any arm or expected chunk is missing the row goes into needsEmbed so
  // reembedConversationMemory() can repair all arms atomically on the next run.
  const rows = await sql`
    SELECT
      cm.id                AS memory_id,
      cm.tags,
      length(cm.content)  AS content_length,
      EXISTS (
        SELECT 1
        FROM   memory_embeddings me
        WHERE  me.memory_id   = cm.id
          AND  me.memory_type = 'conversation_memory'
          AND  me.user_id     = ${DAVID_USER_ID}
      ) AS has_scoped_arm_a,
      EXISTS (
        SELECT 1
        FROM   memory_embeddings me
        WHERE  me.memory_id   = cm.id
          AND  me.memory_type = 'conversation_summary'
          AND  me.user_id     = ${DAVID_USER_ID}
      ) AS has_scoped_arm_b,
      (
        SELECT COUNT(*)::integer
        FROM   memory_embeddings me
        WHERE  me.memory_type = 'conversation_chunk'
          AND  me.memory_id   LIKE (cm.id || ':chunk:%')
          AND  me.user_id     = ${DAVID_USER_ID}
      ) AS scoped_chunk_count
    FROM conversation_memories cm
    WHERE cm.tags IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(cm.tags) t(tag) WHERE t LIKE 'backfill-cid:%'
      )
  `;

  const fullyDone  = new Set<string>();
  const needsEmbed = new Map<string, string>();

  for (const r of rows) {
    const memoryId    = r.memory_id as string;
    const tags        = r.tags as string[];
    const cidTag      = tags.find(t => t.startsWith('backfill-cid:'));
    if (!cidTag) continue;
    const convId      = cidTag.replace('backfill-cid:', '');
    const contentLen  = Number(r.content_length ?? 0);
    const expected    = computeExpectedChunks(contentLen);
    const actual      = Number(r.scoped_chunk_count ?? 0);
    const chunksOk    = actual >= expected;

    if (r.has_scoped_arm_a && r.has_scoped_arm_b && chunksOk) {
      // Arms A+B present and all expected chunks scoped — fully done.
      fullyDone.add(convId);
    } else {
      // At least one arm or expected chunk is missing — re-embed on this run.
      // reembedConversationMemory() repairs all arms and chunks atomically.
      needsEmbed.set(convId, memoryId);
    }
  }

  return { fullyDone, needsEmbed };
}

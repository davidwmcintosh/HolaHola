/**
 * backfill-all-david-conversations.ts
 *
 * Retroactively saves ALL David-Daniela conversations from the `conversations`
 * table into `conversation_memories` so Daniela's recall tools can find them.
 *
 * Idempotency
 * ───────────
 * Each saved row is tagged with `backfill-cid:{conversationId}`.
 * loadAlreadySavedIds() queries conversation_memories for all rows whose tags
 * array contains a `backfill-cid:*` entry, extracts the conversation IDs, and
 * returns them as a Set<string>.  Any conversation whose ID is already in that
 * set is skipped — no duplicate rows are written, even if the script is run
 * multiple times.
 *
 * Exit codes
 * ──────────
 *   0  — completed (some saved, some skipped, no fatal errors)
 *   1  — fatal error (DB unavailable)
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/backfill-all-david-conversations.ts
 *   npx tsx server/scripts/backfill-all-david-conversations.ts --dry-run
 *   npx tsx server/scripts/backfill-all-david-conversations.ts --limit 50
 *
 * Flags
 * ─────
 *   --dry-run   Print what would be saved without writing to the DB.
 *   --limit N   Process at most N conversations (useful for partial runs).
 *   --verbose   Print each skipped conversation ID as well as saved ones.
 *
 * Uses neon() HTTP driver per episode-sync-http rule.
 */

import { neon } from '@neondatabase/serverless';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT   = (() => {
  const idx = process.argv.indexOf('--limit');
  if (idx === -1) return Infinity;
  const n = parseInt(process.argv[idx + 1] ?? '', 10);
  return isNaN(n) ? Infinity : n;
})();

const DAVID_USER_ID = '49847136';

// Minimum messages for a conversation to be worth saving
const MIN_MESSAGES = 4;

// Pause between inserts (ms) — stay within Neon rate limits
const INSERT_PAUSE_MS = 200;

// ── Tag helpers ───────────────────────────────────────────────────────────────

/** Build the idempotency tag for a conversation. */
export function makeBackfillTag(conversationId: string): string {
  return `backfill-cid:${conversationId}`;
}

/** Extract the conversation ID from a backfill tag. Returns null if not a backfill tag. */
export function parseBackfillTag(tag: string): string | null {
  return tag.startsWith('backfill-cid:') ? tag.slice('backfill-cid:'.length) : null;
}

// ── DB helper ─────────────────────────────────────────────────────────────────

function getSql() {
  const url = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('NEON_SHARED_DATABASE_URL (or DATABASE_URL) is not set.');
  return neon(url);
}

// ── Core idempotency function ─────────────────────────────────────────────────

/**
 * Query conversation_memories for all rows that carry a `backfill-cid:*` tag,
 * then extract and return the conversation IDs as a Set<string>.
 *
 * This is the idempotency guard: before saving any conversation the script
 * checks whether its ID is already in this set, and skips it if so.
 */
export async function loadAlreadySavedIds(): Promise<Set<string>> {
  const sql = getSql();

  // Pull every row that has at least one backfill-cid:* tag, and return the
  // full tags array so we can parse out the conversation IDs.
  const rows = await sql`
    SELECT tags
    FROM conversation_memories
    WHERE tags IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(tags) t WHERE t LIKE 'backfill-cid:%'
      )
  ` as Array<{ tags: string[] }>;

  const ids = new Set<string>();
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      const cid = parseBackfillTag(tag);
      if (cid) ids.add(cid);
    }
  }
  return ids;
}

// ── Transcript helpers ────────────────────────────────────────────────────────

interface Message {
  role: string;
  content: string;
  created_at: string;
}

async function fetchTranscript(convId: string): Promise<Message[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT role, content, created_at
    FROM messages
    WHERE conversation_id = ${convId}
      AND role IN ('user', 'assistant')
      AND content IS NOT NULL
      AND length(content) > 5
    ORDER BY created_at ASC
  `;
  return rows as Message[];
}

interface ConvMeta {
  id: string;
  title: string | null;
  created_at: string;
  language: string | null;
}

async function fetchDavidConversations(): Promise<ConvMeta[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT c.id, c.title, c.created_at, c.language
    FROM conversations c
    WHERE c.user_id = ${DAVID_USER_ID}
    ORDER BY c.created_at DESC
  `;
  return rows as ConvMeta[];
}

function formatTranscript(msgs: Message[]): string {
  return msgs
    .map(m => (m.role === 'user' ? 'David' : 'Daniela') + ': ' + m.content)
    .join('\n\n');
}

function buildSummary(
  title: string,
  msgs: Message[],
  convId: string,
): string {
  const davidMsgs   = msgs.filter(m => m.role === 'user').length;
  const danielaMsgs = msgs.filter(m => m.role === 'assistant').length;
  return (
    `Verbatim transcript of a David-Daniela conversation: "${title}". ` +
    `${davidMsgs} David turn(s), ${danielaMsgs} Daniela turn(s). ` +
    `conversation_id=${convId}. ` +
    `Saved retroactively by backfill-all-david-conversations.ts.`
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(B('\n══ Backfill All David Conversations ══\n'));

  if (DRY_RUN) console.log(Y('  --dry-run mode: no rows will be written.\n'));
  if (LIMIT !== Infinity) console.log(Y(`  --limit ${LIMIT}: processing at most ${LIMIT} conversation(s).\n`));

  // 1. Load already-saved IDs (idempotency set)
  console.log('  Loading already-saved conversation IDs…');
  const alreadySaved = await loadAlreadySavedIds();
  console.log(`  Already saved: ${alreadySaved.size} conversation(s)\n`);

  // 2. Fetch all David conversations
  console.log('  Fetching David conversations…');
  const conversations = await fetchDavidConversations();
  console.log(`  Found: ${conversations.length} total conversation(s)\n`);

  let saved   = 0;
  let skipped = 0;
  let failed  = 0;
  let processed = 0;

  for (const conv of conversations) {
    if (processed >= LIMIT) break;

    const convId = conv.id;

    // ── Idempotency check ────────────────────────────────────────────────────
    if (alreadySaved.has(convId)) {
      if (VERBOSE) {
        console.log(Y(`  [SKIP] Already saved: ${convId}`));
      }
      skipped++;
      processed++;
      continue;
    }

    try {
      // ── Fetch transcript ───────────────────────────────────────────────────
      const msgs = await fetchTranscript(convId);

      if (msgs.length < MIN_MESSAGES) {
        if (VERBOSE) {
          console.log(Y(`  [SKIP] Too few messages (${msgs.length}): ${convId}`));
        }
        skipped++;
        processed++;
        continue;
      }

      const displayTitle = conv.title || `David-Daniela conversation ${conv.created_at?.slice(0, 10) ?? convId.slice(0, 8)}`;
      const transcript   = formatTranscript(msgs);
      const summary      = buildSummary(displayTitle, msgs, convId);
      const recordedAt   = conv.created_at ? new Date(conv.created_at) : new Date();

      // ── Build tags ─────────────────────────────────────────────────────────
      // backfill-cid:{conversationId} is the idempotency key — it MUST be present.
      const tags = [
        'founder-chat',
        'daniela-chat',
        'verbatim',
        makeBackfillTag(convId),   // ← idempotency key
      ];

      if (DRY_RUN) {
        console.log(G(`  [DRY-RUN] Would save: "${displayTitle}" (${msgs.length} msgs, ${transcript.length} chars)`));
        console.log(`            tags: ${tags.join(', ')}`);
        saved++;
        processed++;
        continue;
      }

      // ── Insert row ─────────────────────────────────────────────────────────
      const sql = getSql();
      await sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, participants, tags, importance,
           recorded_at, created_at, entry_type, arc_name)
        VALUES (
          gen_random_uuid(),
          ${displayTitle},
          ${summary},
          ${transcript},
          ARRAY['david', 'daniela']::text[],
          ${tags}::text[],
          7,
          ${recordedAt.toISOString()},
          NOW(),
          'conversation',
          'HolaHola Episodes'
        )
      `;

      console.log(G(`  [SAVED] "${displayTitle}" — ${msgs.length} msgs, ${transcript.length} chars`));
      saved++;
      processed++;

      await sleep(INSERT_PAUSE_MS);
    } catch (err: any) {
      console.error(R(`  [ERROR] ${convId}: ${err?.message ?? err}`));
      failed++;
      processed++;
    }
  }

  console.log('');
  console.log(`  Saved:   ${saved}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Total processed: ${processed} / ${conversations.length}\n`);

  if (failed > 0) {
    console.error(R(`  ✗ ${failed} conversation(s) failed to save.\n`));
    process.exit(1);
  }

  console.log(G('  ✓ Backfill complete.\n'));
  process.exit(0);
}

// ── Entry point ───────────────────────────────────────────────────────────────
const scriptName = 'backfill-all-david-conversations';
if (process.argv[1]?.includes(scriptName)) {
  main().catch((err: any) => {
    console.error(R('FATAL: ' + (err?.message ?? err)));
    console.error(err?.stack ?? '');
    process.exit(1);
  });
}

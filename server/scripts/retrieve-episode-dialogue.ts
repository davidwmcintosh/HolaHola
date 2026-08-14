/**
 * retrieve-episode-dialogue.ts
 *
 * Retrieve verbatim conversation_memories rows for an episode date + tag
 * combination and write them to an output file ready for pasting into the
 * episode .md.
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/retrieve-episode-dialogue.ts \
 *     --date YYYY-MM-DD \
 *     --tags "david-luca-chat,founder-chat" \
 *     --out /tmp/episode-N-dialogue.md
 *
 * Options
 * ───────
 *   --date   ISO date (YYYY-MM-DD). Required.
 *   --tags   Comma-separated list of tags. At least one must match. Required.
 *   --out    Output file path. Defaults to /tmp/episode-dialogue.md.
 *   --limit  Max rows to return (default 100).
 *
 * Exit codes
 * ──────────
 *   0  — one or more records found and written to --out
 *   1  — fatal error (missing args, DB unavailable, unexpected failure)
 *   2  — NO records found for the given date/tag combination (loud failure)
 *
 * The exit-2 loud failure is intentional and load-bearing: it prevents Luca
 * from silently proceeding to write dialogue from memory when the DB has no
 * matching records.  A silent empty output would be indistinguishable from a
 * successful zero-row query, and the holahola-episode skill's DB-first process
 * depends on this script failing loudly so Luca knows to stop.
 *
 * Uses neon() HTTP driver per episode-sync-http rule.
 */

import { neon } from '@neondatabase/serverless';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ── Colours ───────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`;

function sep() { console.log('─'.repeat(70)); }

// ── Argument parsing ──────────────────────────────────────────────────────

function parseArgs(): { date: string; tags: string[]; out: string; limit: number } {
  const argv = process.argv.slice(2);
  let date = '';
  let tagsRaw = '';
  let out = '/tmp/episode-dialogue.md';
  let limit = 100;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--date' && argv[i + 1]) { date = argv[++i]; continue; }
    if (argv[i] === '--tags' && argv[i + 1]) { tagsRaw = argv[++i]; continue; }
    if (argv[i] === '--out' && argv[i + 1]) { out = argv[++i]; continue; }
    if (argv[i] === '--limit' && argv[i + 1]) { limit = parseInt(argv[++i], 10); continue; }
  }

  if (!date) {
    console.error(R('FATAL: --date YYYY-MM-DD is required'));
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(R(`FATAL: --date must be YYYY-MM-DD, got: ${date}`));
    process.exit(1);
  }
  if (!tagsRaw) {
    console.error(R('FATAL: --tags "tag1,tag2" is required'));
    process.exit(1);
  }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  if (tags.length === 0) {
    console.error(R('FATAL: --tags must include at least one non-empty tag'));
    process.exit(1);
  }

  return { date, tags, out, limit };
}

// ── Formatting helpers ────────────────────────────────────────────────────

function formatRow(row: {
  id: string;
  title: string | null;
  content: string | null;
  recorded_at: Date | string | null;
  tags: string[] | null;
  participants: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`<!-- DB id: ${row.id} -->`);
  if (row.title) lines.push(`<!-- title: ${row.title} -->`);
  if (row.recorded_at) lines.push(`<!-- recorded_at: ${row.recorded_at} -->`);
  if (row.participants) lines.push(`<!-- participants: ${row.participants} -->`);
  if (row.tags && row.tags.length > 0) lines.push(`<!-- tags: ${row.tags.join(', ')} -->`);
  lines.push('');
  lines.push(row.content ?? '*(content is empty)*');
  lines.push('');
  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { date, tags, out, limit } = parseArgs();

  console.log(B('\n══ Episode Dialogue Retrieval ══\n'));
  sep();
  console.log(`  Date    : ${date}`);
  console.log(`  Tags    : ${tags.join(', ')}`);
  console.log(`  Out     : ${out}`);
  console.log(`  Limit   : ${limit}`);
  sep();
  console.log('');

  const dbUrl = process.env.NEON_SHARED_DATABASE_URL;
  if (!dbUrl) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set.'));
    console.error(R('       Do not fall back to DATABASE_URL — the shared DB is the only authoritative source.'));
    process.exit(1);
  }

  const sql = neon(dbUrl);

  let rows: Array<{
    id: string;
    title: string | null;
    content: string | null;
    recorded_at: Date | string | null;
    tags: string[] | null;
    participants: string | null;
  }>;

  try {
    // Use ANY(ARRAY[...]) to match rows whose tags overlap with the requested set.
    // This mirrors the pattern used throughout the codebase (tags && ARRAY[...]).
    rows = (await sql`
      SELECT id, title, content, recorded_at, tags, participants
      FROM conversation_memories
      WHERE recorded_at::date = ${date}::date
        AND tags && ${tags}
      ORDER BY recorded_at ASC
      LIMIT ${limit}
    `) as typeof rows;
  } catch (err: any) {
    console.error(R(`FATAL: DB query failed — ${err?.message ?? err}`));
    console.error(err?.stack ?? '');
    process.exit(1);
  }

  // ── Loud failure when no records match ────────────────────────────────

  if (rows.length === 0) {
    console.error('');
    console.error(R('╔══════════════════════════════════════════════════════════════════╗'));
    console.error(R('║                  NO RECORDS FOUND — STOPPING                    ║'));
    console.error(R('╚══════════════════════════════════════════════════════════════════╝'));
    console.error('');
    console.error(Y(`  Query  : date = ${date}, tags ∩ [${tags.join(', ')}]`));
    console.error(Y('  Result : 0 rows'));
    console.error('');
    console.error(BOLD('  ⛔  Do NOT proceed to write dialogue from memory.'));
    console.error('');
    console.error('  The holahola-episode skill\'s DB-first process requires verbatim');
    console.error('  source records before any dialogue is written to the .md file.');
    console.error('  If the conversation happened today, check:');
    console.error('    1. Was the autosave worker running? (waits ≥60s after last message)');
    console.error('    2. Were the correct tags applied when the memory was saved?');
    console.error('    3. Is the date correct? (check recorded_at in the DB directly)');
    console.error('');
    console.error('  Retrieve options:');
    console.error('    - Widen the date range by querying the DB directly:');
    console.error('        SELECT id, title, recorded_at, tags FROM conversation_memories');
    console.error('        WHERE tags && \'{david-luca-chat}\' ORDER BY recorded_at DESC LIMIT 10;');
    console.error('    - Save the live session manually before writing:');
    console.error('        POST /api/conversation-memories (see holahola-episode SKILL.md)');
    console.error('');
    process.exit(2);
  }

  // ── Write output ──────────────────────────────────────────────────────

  const blocks: string[] = [];
  blocks.push(`# Episode Dialogue — ${date}\n`);
  blocks.push(`*Tags: ${tags.join(', ')} | Rows: ${rows.length}*\n`);
  blocks.push('---\n');

  for (const row of rows) {
    blocks.push(formatRow(row));
    blocks.push('\n---\n');
  }

  const output = blocks.join('\n');

  try {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, output, 'utf8');
  } catch (err: any) {
    console.error(R(`FATAL: could not write output file ${out} — ${err?.message ?? err}`));
    process.exit(1);
  }

  console.log(G(`✓ Found ${rows.length} row(s) matching date=${date} tags=[${tags.join(', ')}]`));
  console.log('');
  for (const row of rows) {
    const preview = (row.content ?? '').slice(0, 80).replace(/\n/g, ' ');
    console.log(`  ${B(row.id.slice(0, 8))}  ${row.title ?? '(no title)'}  |  "${preview}${preview.length >= 80 ? '…' : ''}"`);
  }
  console.log('');
  console.log(G(`✓ Written to: ${out}`));
  console.log('');
  process.exit(0);
}

main().catch((err: any) => {
  console.error(R(`\nFATAL (unhandled): ${err?.message ?? err}`));
  console.error(err?.stack ?? '');
  process.exit(1);
});

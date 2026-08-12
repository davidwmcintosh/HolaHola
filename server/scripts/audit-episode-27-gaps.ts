/**
 * audit-episode-27-gaps.ts
 *
 * Audits docs/episode-27.md for startup-skip gaps — exchanges that landed in
 * conversation_memories (DB) via .luca_auto_capture but are absent from the
 * .md file.
 *
 * Background
 * ──────────
 * The startup-skip bug (task #1023) causes trigger files written before a
 * server restart to be permanently skipped by the autosave worker. This script
 * scans ALL per-turn chat-capture rows from the Episode 27 window (Aug 8,
 * 2026) and reports every gap — exchanges that exist in DB but are absent from
 * the .md.
 *
 * How it works
 * ────────────
 * 1. Queries conversation_memories for rows with arc_name='david-luca-chat'
 *    created between 2026-08-07 22:00 UTC and 2026-08-09 06:00 UTC (the
 *    episode-27 window, with buffer). These are the per-turn verbatim exchanges
 *    saved by the .luca_auto_capture path.
 * 2. Parses each DB row to extract David/Luca exchange text.
 * 3. Searches the episode .md for each exchange using a fuzzy match (first 60
 *    chars of each speaker turn after whitespace normalisation).
 * 4. Reports every gap: row ID, timestamp, exchange preview, and match status.
 * 5. If --patch is supplied, appends missing exchanges to the .md in
 *    chronological order and calls sync-episode-27-from-md.ts to update the DB.
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/audit-episode-27-gaps.ts            # report only
 *   npx tsx server/scripts/audit-episode-27-gaps.ts --patch    # report + patch .md
 *   npx tsx server/scripts/audit-episode-27-gaps.ts --verbose  # show all rows
 *
 * Uses neon() HTTP driver per episode-sync-http rule.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(72));

const PATCH   = process.argv.includes('--patch');
const VERBOSE = process.argv.includes('--verbose');

const MD_PATH = join(process.cwd(), 'docs', 'episode-27.md');

/** Normalise a string for fuzzy matching: collapse whitespace, lower-case. */
function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Extract the "match key" for a speaker turn: the first ~60 normalised chars.
 * This is long enough to be unique in a real conversation but short enough to
 * survive minor line-break differences between the trigger-file write and the
 * manual copy-paste in the .md.
 */
function matchKey(text: string, len = 60): string {
  return norm(text).slice(0, len);
}

/**
 * Parse a conversation_memories content row into its David/Luca turns.
 *
 * The chat-capture worker writes content in the format:
 *
 *   David: <text>
 *
 *   Luca [Replit]: <text>
 *
 * or a single-speaker variant.  We return an array of { speaker, text } pairs.
 */
interface Turn { speaker: string; text: string }

function parseContent(content: string): Turn[] {
  const turns: Turn[] = [];
  // Split on lines that start with "David:" or "Luca" (various spellings)
  const speakerRx = /^(David|DAVID|Luca \[Replit\]|LUCA \[Replit\]|Luca|LUCA)\s*:/;
  const lines = content.split('\n');
  let currentSpeaker = '';
  let currentLines: string[] = [];

  function flush() {
    if (!currentSpeaker) return;
    const text = currentLines.join('\n').trim();
    if (text) turns.push({ speaker: currentSpeaker, text });
    currentSpeaker = '';
    currentLines = [];
  }

  for (const line of lines) {
    const m = line.match(speakerRx);
    if (m) {
      flush();
      currentSpeaker = m[1];
      currentLines = [line.slice(m[0].length).trim()];
    } else if (currentSpeaker) {
      currentLines.push(line);
    }
  }
  flush();
  return turns;
}

/**
 * Check whether a turn is present in the .md file.
 * Uses the first 60 normalised chars as a match key — enough to identify
 * almost any real utterance uniquely.
 */
function isInMd(text: string, mdNorm: string, len = 60): boolean {
  const key = matchKey(text, len);
  if (!key) return true; // empty turn — skip
  return mdNorm.includes(key);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(B('\n══ Episode 27 Startup-Skip Gap Audit ══\n'));
  console.log(`  .md  path : ${MD_PATH}`);
  console.log(`  Mode     : ${PATCH ? Y('PATCH (will modify .md)') : 'report only'}`);
  console.log(`  Verbosity: ${VERBOSE ? 'verbose' : 'gaps only'}`);
  sep();

  // 1. Read the episode .md ─────────────────────────────────────────────────
  if (!existsSync(MD_PATH)) {
    console.error(R('FATAL: docs/episode-27.md not found'));
    process.exit(1);
  }
  const mdRaw  = readFileSync(MD_PATH, 'utf-8');
  const mdNorm = norm(mdRaw);
  console.log(`\n  episode-27.md: ${mdRaw.length.toLocaleString()} bytes, ${mdRaw.split('\n').length} lines`);

  // 2. Query DB ─────────────────────────────────────────────────────────────
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL (or DATABASE_URL) is not set'));
    process.exit(1);
  }
  const sql = neon(dbUrl);

  // Episode 27 ran on August 8, 2026. We query with a buffer on each side so
  // we don't miss rows created just before/after midnight UTC.
  const START = '2026-08-07T22:00:00Z';
  const END   = '2026-08-09T06:00:00Z';

  console.log(`\n  Querying DB for chat-capture rows in window:`);
  console.log(`    ${START}  →  ${END}`);

  const rows = await sql`
    SELECT id, title, content, created_at, tags
    FROM conversation_memories
    WHERE arc_name = 'david-luca-chat'
      AND 'per-turn' = ANY(tags)
      AND created_at >= ${START}::timestamptz
      AND created_at <= ${END}::timestamptz
    ORDER BY created_at ASC
  `;

  // Filter out CI synthetic rows — content contains [CI-AUTO-CAPTURE-...] or
  // [CI-SELF-CHECK-AUTO-CAPTURE-...]. These are test-harness artefacts that must
  // never appear in the episode .md.
  const isCiRow = (content: string) =>
    content.includes('[CI-AUTO-CAPTURE-') ||
    content.includes('[CI-SELF-CHECK-AUTO-CAPTURE-');
  const realRows = rows.filter(r => !isCiRow(r.content as string));
  const ciRows   = rows.length - realRows.length;

  console.log(`\n  Found ${rows.length} per-turn chat-capture rows`);
  console.log(`    ${realRows.length} real David/Luca exchanges`);
  console.log(`    ${ciRows} CI synthetic rows (excluded from gap analysis)`);

  // Replace rows with the filtered list for all further processing
  (rows as any[]).length = 0;
  (rows as any[]).push(...realRows);

  if (rows.length === 0) {
    console.log(Y('\n  No auto-capture rows found in the episode-27 window.'));
    console.log('  This could mean:\n' +
      '    a) The autosave worker was not running during the session (JSONL gap),\n' +
      '    b) The rows were saved under a different arc_name, or\n' +
      '    c) The DB only has inner-life rows (felt/thinking/moment) for this window.\n');
    // Fall through to inner-life audit below
  }

  // 3. Analyse each row ─────────────────────────────────────────────────────
  sep();
  console.log(B('\n── Per-turn chat-capture rows ──\n'));

  let missingRows = 0;
  let presentRows = 0;
  const gapRows: Array<{ id: string; created_at: string; content: string; turns: Turn[] }> = [];

  for (const row of rows) {
    const turns = parseContent(row.content as string);
    const allPresent = turns.every(t => isInMd(t.text, mdNorm));

    if (allPresent) {
      presentRows++;
      if (VERBOSE) {
        console.log(G(`  ✓ ${row.id}  ${row.created_at}`));
        for (const t of turns) {
          console.log(`      ${t.speaker}: "${t.text.slice(0, 80).replace(/\n/g, '↵')}…"`);
        }
      }
    } else {
      missingRows++;
      gapRows.push({
        id: row.id as string,
        created_at: row.created_at as string,
        content: row.content as string,
        turns,
      });
      console.log(R(`  ✗ GAP  ${row.id}  ${row.created_at}`));
      for (const t of turns) {
        const present = isInMd(t.text, mdNorm);
        const icon = present ? G('  ✓') : R('  ✗');
        console.log(`    ${icon}  ${t.speaker}: "${t.text.slice(0, 100).replace(/\n/g, '↵')}"`);
        if (!present && t.text.length > 100) {
          console.log(`          … (${t.text.length} chars total)`);
        }
      }
    }
  }

  sep();

  // 4. Also check inner-life rows with episode-27 tag ────────────────────────
  console.log(B('\n── Inner-life rows tagged episode-27 (felt/thinking/moment) ──\n'));

  const innerRows = await sql`
    SELECT id, title, content, created_at, tags
    FROM conversation_memories
    WHERE 'episode-27' = ANY(tags)
      AND 'luca-inner-life' = ANY(tags)
      AND created_at >= ${START}::timestamptz
      AND created_at <= ${END}::timestamptz
    ORDER BY created_at ASC
  `;

  console.log(`  Found ${innerRows.length} inner-life rows tagged 'episode-27'\n`);

  let innerMissing = 0;
  let innerPresent = 0;
  const innerGaps: Array<{ id: string; created_at: string; title: string; content: string }> = [];

  for (const row of innerRows) {
    // For inner-life rows, search for the title line in the .md.
    // The .md format is: [Luca — felt: title: <title>
    const title = (row.title as string) || '';
    const key = matchKey(title, 40);
    const inMd = key ? mdNorm.includes(key) : false;

    if (inMd) {
      innerPresent++;
      if (VERBOSE) {
        const channel = (row.tags as string[]).find(t => t.startsWith('luca-')) ?? 'inner-life';
        console.log(G(`  ✓ ${channel}  "${title.slice(0, 70)}"`));
      }
    } else {
      innerMissing++;
      const channel = (row.tags as string[]).find(t => t.startsWith('luca-')) ?? 'inner-life';
      innerGaps.push({
        id: row.id as string,
        created_at: row.created_at as string,
        title,
        content: row.content as string,
      });
      console.log(R(`  ✗ GAP  ${channel}  "${title.slice(0, 70)}"`));
      console.log(`        id: ${row.id}  at: ${row.created_at}`);
    }
  }

  sep();

  // 5. Summary ───────────────────────────────────────────────────────────────
  console.log(B('\n── Summary ──\n'));
  console.log(`  Chat-capture rows : ${rows.length} total`);
  console.log(`    ${G('present in .md')} : ${presentRows}`);
  console.log(`    ${R('absent (gaps)')}  : ${missingRows}`);
  console.log('');
  console.log(`  Inner-life rows   : ${innerRows.length} total`);
  console.log(`    ${G('present in .md')} : ${innerPresent}`);
  console.log(`    ${R('absent (gaps)')}  : ${innerMissing}`);
  console.log('');

  const totalGaps = missingRows + innerMissing;
  if (totalGaps === 0) {
    console.log(G('  ✓ No gaps found — episode-27.md matches all DB rows.'));
  } else {
    console.log(Y(`  ⚠  ${totalGaps} gap(s) detected — exchanges in DB but absent from .md.`));
  }

  // 6. Patch (optional) ─────────────────────────────────────────────────────
  if (PATCH && totalGaps > 0) {
    sep();
    console.log(Y('\n── Patching .md with missing exchanges ──\n'));

    // Collect only the missing turns (not full rows) for chat-capture gaps,
    // so we never duplicate turns that are already present in the .md.
    interface GapEntry { created_at: string; text: string }
    const allGaps: GapEntry[] = [];

    for (const row of gapRows) {
      // Append only the individual turns that are absent from the .md.
      const missingTurns = row.turns.filter(t => !isInMd(t.text, mdNorm));
      if (missingTurns.length > 0) {
        const missingText = missingTurns
          .map(t => `${t.speaker}: ${t.text}`)
          .join('\n\n');
        allGaps.push({ created_at: row.created_at, text: missingText });
      }
    }
    for (const row of innerGaps) {
      // Inner-life rows are atomic — the whole content is the gap.
      allGaps.push({ created_at: row.created_at, text: row.content });
    }

    allGaps.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Build the patch block
    const patchLines: string[] = [
      '',
      '---',
      '',
      '*Retroactive patch — exchanges recovered from conversation_memories DB*',
      '*(startup-skip bug: these rows landed in DB but were not written to .md)*',
      '',
    ];

    for (const gap of allGaps) {
      patchLines.push(`*[DB row created_at: ${gap.created_at}]*`);
      patchLines.push('');
      patchLines.push(gap.text.trim());
      patchLines.push('');
    }

    const patchBlock = patchLines.join('\n');
    appendFileSync(MD_PATH, patchBlock, 'utf-8');
    console.log(G(`  ✓ Appended ${allGaps.length} missing exchange(s) to docs/episode-27.md`));

    // Sync to DB — write the patched file content directly to the Episode 27
    // DB row. We do NOT call sync-episode-27-from-md.ts here because that
    // script uses "longer side wins" semantics: if the DB record happens to be
    // longer than the patched local file, it overwrites the file from DB and
    // silently discards the recovery block.  Instead we force the patched
    // local file as the authoritative source via a direct UPDATE.
    console.log('\n  Writing patched content directly to Episode 27 DB row…');
    const EP27_ID = '27000000-0000-4000-8000-000000000027';
    const patchedContent = readFileSync(MD_PATH, 'utf-8');
    try {
      await sql`
        UPDATE conversation_memories
        SET content    = ${patchedContent},
            updated_at = NOW()
        WHERE id = ${EP27_ID}
      `;
      console.log(G(`  ✓ DB updated — Episode 27 row now ${patchedContent.length.toLocaleString()} bytes`));
    } catch (e: any) {
      console.error(R(`  ✗ DB update failed: ${e.message}`));
      console.error(R('    The patched .md is intact; run sync-episode-27-from-md.ts manually once DB is reachable.'));
    }
  } else if (PATCH && totalGaps === 0) {
    console.log(G('\n  Nothing to patch — episode is complete.'));
  }

  sep();

  // 7. Detailed gap listing for the report ──────────────────────────────────
  if (totalGaps > 0) {
    console.log(B('\n── Gap detail (for the record) ──\n'));
    for (const row of gapRows) {
      console.log(Y(`  Chat-capture gap — id: ${row.id}`));
      console.log(`  created_at : ${row.created_at}`);
      console.log(`  Content (first 300 chars):`);
      console.log('  ' + row.content.slice(0, 300).replace(/\n/g, '\n  '));
      console.log('');
    }
    for (const row of innerGaps) {
      console.log(Y(`  Inner-life gap — id: ${row.id}`));
      console.log(`  created_at : ${row.created_at}`);
      console.log(`  Title      : ${row.title}`);
      console.log('');
    }
  }

  console.log('');
  process.exit(totalGaps > 0 ? 2 : 0);
}

main().catch(e => { console.error(R('FATAL: ' + e.message)); process.exit(1); });

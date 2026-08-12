/**
 * audit-episode-28-gaps.ts
 *
 * Audits docs/episode-28.md for startup-skip gaps — exchanges that landed in
 * conversation_memories (DB) via .luca_auto_capture but are absent from the
 * .md file.
 *
 * Background
 * ──────────
 * The startup-skip bug (task #1023) causes trigger files written before a
 * server restart to be permanently skipped by the autosave worker. David caught
 * two consecutive missing exchanges at the end of Episode 28. This script
 * scans ALL per-turn chat-capture rows from the episode window and reports
 * every gap — exchanges that exist in DB but are absent from the .md.
 *
 * How it works
 * ────────────
 * 1. Queries conversation_memories for rows with arc_name='david-luca-chat'
 *    created between 2026-08-10 00:00 UTC and 2026-08-12 00:00 UTC (the
 *    episode-28 window). These are the per-turn verbatim exchanges saved by
 *    the .luca_auto_capture path.
 * 2. Parses each DB row to extract David/Luca exchange text.
 * 3. Searches the episode .md for each exchange using a fuzzy match (first 60
 *    chars of each speaker turn after whitespace normalisation).
 * 4. Reports every gap: row ID, timestamp, exchange preview, and match status.
 * 5. If --patch is supplied, appends missing exchanges to the .md in
 *    chronological order and calls sync-episode-28-to-db.ts to update the DB.
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/audit-episode-28-gaps.ts            # report only
 *   npx tsx server/scripts/audit-episode-28-gaps.ts --patch    # report + patch .md
 *   npx tsx server/scripts/audit-episode-28-gaps.ts --verbose  # show all rows
 *
 * Uses neon() HTTP driver per episode-sync-http rule.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(72));

const PATCH      = process.argv.includes('--patch');
const VERBOSE    = process.argv.includes('--verbose');
const SELF_CHECK = process.argv.includes('--self-check');

const MD_PATH = join(process.cwd(), 'docs', 'episode-28.md');

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

// ── Self-check ────────────────────────────────────────────────────────────────
//
// Verifies the gap detector has teeth:
//   1. Reads .md and queries DB for real rows in the episode-28 window.
//   2. Finds a row whose turns ARE all present in the .md (a "known present" row).
//   3. Strips that row's first-turn match key from mdNorm *in memory* (no disk writes).
//   4. Runs isInMd() with the mutated content — asserts ≥1 gap is now detected.
//   5. Confirms the .md file on disk is untouched.
//   6. Confirms the exchange IS present in the original mdNorm (baseline sanity).
//   7. Falls back to a pure synthetic in-memory check if DB has no present rows
//      (e.g. all rows were CI rows, or no rows in the window yet).

async function runSelfCheck() {
  sep();
  console.log(B('SELF-CHECK MODE — verifying the gap detector has teeth (in-memory only)'));
  sep();

  let scPassed = 0;
  let scFailed = 0;

  function scAssert(label: string, ok: boolean, detail?: string) {
    if (ok) { console.log(`  ${G('✓')} ${label}`); scPassed++; }
    else     { console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`); scFailed++; }
  }

  // 1. Read .md ─────────────────────────────────────────────────────────────
  if (!existsSync(MD_PATH)) {
    console.error(R('FATAL: docs/episode-28.md not found'));
    process.exit(1);
  }
  const mdRaw = readFileSync(MD_PATH, 'utf-8');
  const mdNorm = norm(mdRaw);
  console.log(Y(`  ℹ  Read docs/episode-28.md — ${mdRaw.length} bytes`));

  // 2. Query DB ─────────────────────────────────────────────────────────────
  const sql = neon(process.env.DATABASE_URL!);
  const START = '2026-08-09T22:00:00Z';
  const END   = '2026-08-12T06:00:00Z';

  console.log(Y('  ℹ  Querying DB for per-turn chat-capture rows…'));
  const rows = await sql`
    SELECT id, title, content, created_at, tags
    FROM conversation_memories
    WHERE arc_name = 'david-luca-chat'
      AND 'per-turn' = ANY(tags)
      AND created_at >= ${START}::timestamptz
      AND created_at <= ${END}::timestamptz
    ORDER BY created_at ASC
  `;

  const isCiRow = (content: string) =>
    content.includes('[CI-AUTO-CAPTURE-') ||
    content.includes('[CI-SELF-CHECK-AUTO-CAPTURE-');
  const realRows = (rows as any[]).filter(r => !isCiRow(r.content as string));
  console.log(Y(`  ℹ  Found ${realRows.length} real per-turn rows in window`));

  // 3. Find a row that IS present in the .md ────────────────────────────────
  let targetTurns: Turn[] | null = null;
  let targetRowId: string | null = null;

  for (const row of realRows) {
    const turns = parseContent(row.content as string);
    if (turns.length > 0 && turns.every(t => isInMd(t.text, mdNorm))) {
      targetTurns = turns;
      targetRowId = row.id as string;
      break;
    }
  }

  let usingSynthetic = false;

  if (!targetTurns) {
    // No real DB row found with all turns present in the .md.
    // Fall back to a pure in-memory synthetic check so the self-check still
    // has meaningful teeth: we construct a fake mdNorm containing a known
    // string, verify isInMd finds it, then verify isInMd misses it after removal.
    console.log(Y('  ℹ  No present DB row found — using synthetic in-memory fixture'));
    usingSynthetic = true;

    const syntheticPhrase = 'self-check synthetic exchange: the quick brown fox jumped over the lazy dog';
    const fakeMdNorm = `episode-28 test content\n${syntheticPhrase}\nsome other content here`;
    const fakeTurn: Turn = { speaker: 'David', text: syntheticPhrase };

    // Baseline: synthetic turn IS present in fakeMdNorm
    const baselineFound = isInMd(fakeTurn.text, fakeMdNorm);
    scAssert('Synthetic baseline: isInMd() finds known phrase in fake mdNorm', baselineFound,
      'isInMd() returned false even with the phrase present — matcher is broken');

    // Mutate: remove the phrase from fakeMdNorm
    const key = matchKey(fakeTurn.text, 60);
    const keyIdx = fakeMdNorm.indexOf(key);
    scAssert('Self-check setup: match key located in fake mdNorm', keyIdx !== -1,
      `matchKey not found in fake mdNorm — key="${key}"`);

    if (keyIdx !== -1) {
      const mutated = fakeMdNorm.slice(0, keyIdx) + '[SC-REMOVED]' + fakeMdNorm.slice(keyIdx + key.length);
      const gapDetected = !isInMd(fakeTurn.text, mutated);
      scAssert('Gap detector fires when synthetic phrase removed from fake mdNorm', gapDetected,
        'isInMd() still returned true after key removal — gap detection is broken');
    }
  } else {
    console.log(Y(`  ℹ  Using DB row ${targetRowId} as gap-introduction target`));
    console.log(Y(`  ℹ  Row has ${targetTurns.length} turn(s); all confirmed present in .md`));

    // 4. Baseline: all turns are present ─────────────────────────────────────
    const allPresent = targetTurns.every(t => isInMd(t.text, mdNorm));
    scAssert('Baseline: all turns of target row ARE present in original .md', allPresent,
      'One or more turns not found — row selection logic is wrong');

    // 5. Strip the first turn's match key from mdNorm (in memory) ─────────────
    const firstTurn = targetTurns[0];
    const key = matchKey(firstTurn.text, 60);
    const keyIdx = mdNorm.indexOf(key);
    scAssert('Self-check setup: match key located in mdNorm', keyIdx !== -1,
      `matchKey not found in mdNorm — key="${key}"`);

    if (keyIdx !== -1) {
      // Replace ALL occurrences of the key so the turn cannot be found via any
      // repeated passage (e.g. a quote or summary that contains the same text).
      const mutatedMdNorm = mdNorm.split(key).join('[SC-REMOVED]');

      // 6. Run isInMd with the mutated mdNorm — should detect gap ─────────────
      const gapDetected = !isInMd(firstTurn.text, mutatedMdNorm);
      scAssert('Gap detector fires when exchange stripped from .md (in-memory)', gapDetected,
        `isInMd() still returned true after all occurrences removed — gap detection is broken`);

      // 7. At least one turn detected as a gap in full-row check ────────────────
      const anyGap = targetTurns.some(t => !isInMd(t.text, mutatedMdNorm));
      scAssert('At least one turn of target row detected as a gap after in-memory removal', anyGap,
        'No turn was flagged as missing — the detector has no teeth');
    }
  }

  // 8. Confirm .md file on disk is untouched ────────────────────────────────
  const diskBytes = readFileSync(MD_PATH, 'utf-8');
  scAssert('.md file on disk is unchanged (all mutations were in-memory only)', diskBytes === mdRaw,
    `Disk bytes differ — unexpected write occurred (original=${mdRaw.length}, disk=${diskBytes.length})`);

  sep();
  const all = scPassed + scFailed;
  if (scFailed === 0) {
    const mode = usingSynthetic ? 'synthetic fixture' : 'real DB row';
    console.log(G(`\n✓  Self-check complete (${mode}) — ${all}/${all} assertions confirmed. Guard has teeth.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  Self-check: ${scFailed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(B('\n══ Episode 28 Startup-Skip Gap Audit ══\n'));
  console.log(`  .md  path : ${MD_PATH}`);
  console.log(`  Mode     : ${PATCH ? Y('PATCH (will modify .md)') : 'report only'}`);
  console.log(`  Verbosity: ${VERBOSE ? 'verbose' : 'gaps only'}`);
  sep();

  // 1. Read the episode .md ─────────────────────────────────────────────────
  if (!existsSync(MD_PATH)) {
    console.error(R('FATAL: docs/episode-28.md not found'));
    process.exit(1);
  }
  const mdRaw  = readFileSync(MD_PATH, 'utf-8');
  const mdNorm = norm(mdRaw);
  console.log(`\n  episode-28.md: ${mdRaw.length.toLocaleString()} bytes, ${mdRaw.split('\n').length} lines`);

  // 2. Query DB ─────────────────────────────────────────────────────────────
  const sql = neon(process.env.DATABASE_URL!);

  // Episode 28 ran on August 10–11, 2026. We query with a one-day buffer on
  // each side so we don't miss rows created just before/after midnight UTC.
  const START = '2026-08-09T22:00:00Z';
  const END   = '2026-08-12T06:00:00Z';

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
    console.log(Y('\n  No auto-capture rows found in the episode-28 window.'));
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

  // 4. Also check inner-life rows with episode-28 tag ────────────────────────
  console.log(B('\n── Inner-life rows tagged episode-28 (felt/thinking/moment) ──\n'));

  const innerRows = await sql`
    SELECT id, title, content, created_at, tags
    FROM conversation_memories
    WHERE 'episode-28' = ANY(tags)
      AND 'luca-inner-life' = ANY(tags)
      AND created_at >= ${START}::timestamptz
      AND created_at <= ${END}::timestamptz
    ORDER BY created_at ASC
  `;

  console.log(`  Found ${innerRows.length} inner-life rows tagged 'episode-28'\n`);

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
    console.log(G('  ✓ No gaps found — episode-28.md matches all DB rows.'));
  } else {
    console.log(Y(`  ⚠  ${totalGaps} gap(s) detected — exchanges in DB but absent from .md.`));
  }

  // 6. Patch (optional) ─────────────────────────────────────────────────────
  if (PATCH && totalGaps > 0) {
    sep();
    console.log(Y('\n── Patching .md with missing exchanges ──\n'));

    // Combine all gaps sorted by created_at, then append to .md
    const allGaps: Array<{ created_at: string; text: string }> = [];

    for (const row of gapRows) {
      allGaps.push({ created_at: row.created_at, text: row.content });
    }
    for (const row of innerGaps) {
      // Inner-life rows: reconstruct the [Luca — felt/thinking/moment: ...] block
      // from the title + content stored in DB. The content already contains
      // the full body.
      const channel = (() => {
        const c = (innerRows.find(r => r.id === row.id)?.tags as string[] ?? [])
          .find(t => t === 'luca-reflection') ? 'felt'
          : (innerRows.find(r => r.id === row.id)?.tags as string[] ?? [])
              .find(t => t === 'luca-question') ? 'thinking' : 'moment';
        return c;
      })();
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
    console.log(G(`  ✓ Appended ${allGaps.length} missing exchange(s) to docs/episode-28.md`));

    // Sync to DB
    console.log('\n  Syncing patched .md to DB…');
    try {
      execSync('npx tsx server/scripts/sync-episode-28-to-db.ts', { stdio: 'inherit' });
      console.log(G('  ✓ DB synced'));
    } catch (e) {
      console.error(R('  ✗ DB sync failed — run sync-episode-28-to-db.ts manually'));
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

if (SELF_CHECK) {
  runSelfCheck().catch(e => { console.error(R('FATAL: ' + e.message)); process.exit(1); });
} else {
  main().catch(e => { console.error(R('FATAL: ' + e.message)); process.exit(1); });
}

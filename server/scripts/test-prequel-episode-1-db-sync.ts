/**
 * test-prequel-episode-1-db-sync.ts
 *
 * CI check: confirms that docs/prequel-episode-1.md and the DB record
 * conversation_memories id = dd8cf439-867d-47f5-999c-a1a10c3a88d5 contain
 * the same content (modulo trailing whitespace normalization).
 *
 * READ-ONLY — this script never writes to the DB.
 * To repair a mismatch, run the explicit sync command:
 *   npx tsx server/scripts/sync-prequel-ep1-from-db.ts   (DB → .md)
 *   npx tsx server/scripts/sync-prequel-episode-1.ts      (.md → DB)
 *
 * The check fails hard for:
 *   - .md file missing or empty
 *   - .md is missing expected content landmarks
 *   - DB record not found
 *   - .md and DB content do not match
 *
 * Run: npx tsx server/scripts/test-prequel-episode-1-db-sync.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

const EPISODE_ID = 'dd8cf439-867d-47f5-999c-a1a10c3a88d5';
const MD_PATH = join(process.cwd(), 'docs', 'prequel-episode-1.md');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

/** Normalize content for comparison: trim trailing whitespace on each line,
 *  collapse runs of blank lines to one, strip leading/trailing blank lines. */
function normalize(s: string): string {
  return s
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function main() {
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 1 — Read the .md file
  // ══════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 1 — Read docs/prequel-episode-1.md'));
  sep();

  let mdContent: string;
  try {
    mdContent = readFileSync(MD_PATH, 'utf8');
    console.log(Y(`  ℹ  Read ${MD_PATH} — ${mdContent.length} bytes`));
    assert('.md file is non-empty', mdContent.length > 0, 'File is empty');
  } catch (err: unknown) {
    console.error(R(`  ✗  Could not read .md file: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  // Sanity-check known landmarks so we catch a totally wrong file early.
  const landmarks = [
    'The Room Before the Room',
    'North Star',
    'White Wall',
    'Juliette',
    'reggaeton',
  ];
  for (const landmark of landmarks) {
    assert(
      `.md contains expected landmark: "${landmark}"`,
      mdContent.includes(landmark),
      `"${landmark}" not found — .md file may be wrong or truncated`,
    );
  }

  // Confirm the required source threads are present.
  assert(
    '.md source list contains 7eed487d',
    mdContent.includes('7eed487d'),
    '7eed487d missing from source thread list',
  );
  assert(
    '.md source list contains b34c7741',
    mdContent.includes('b34c7741'),
    'b34c7741 missing from source thread list',
  );

  if (failed > 0) {
    sep();
    console.log(R(`\n✗  .md file failed landmark checks — aborting.\n`));
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 2 — Read DB record
  // ══════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B(`PART 2 — Read DB record ${EPISODE_ID}`));
  sep();

  const sql = neon(DATABASE_URL);

  const rows = await sql`
    SELECT content, length(content) AS len
    FROM conversation_memories
    WHERE id = ${EPISODE_ID}
  `;

  assert(
    `DB record ${EPISODE_ID} exists`,
    rows.length === 1,
    rows.length === 0
      ? 'No row found — the DB record may have been deleted or the ID changed'
      : `Unexpected row count: ${rows.length}`,
  );

  if (rows.length !== 1) {
    sep();
    console.log(R(`\n✗  Cannot continue — DB record not found.\n`));
    process.exit(1);
  }

  const dbContent: string = rows[0]?.content ?? '';
  const dbLen: number = Number(rows[0]?.len ?? 0);
  console.log(Y(`  ℹ  DB record length: ${dbLen} bytes`));
  assert('DB record is non-empty', dbLen > 0, 'DB content field is empty');

  // ══════════════════════════════════════════════════════════════════════════
  // PART 3 — Compare .md vs DB (whitespace-normalized)
  // ══════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 3 — Compare .md vs DB (whitespace-normalized)'));
  sep();

  const mdNorm = normalize(mdContent);
  const dbNorm = normalize(dbContent);

  console.log(Y(`  ℹ  Normalized .md length : ${mdNorm.length} chars`));
  console.log(Y(`  ℹ  Normalized DB length  : ${dbNorm.length} chars`));

  const inSync = mdNorm === dbNorm;

  if (!inSync) {
    let firstDiff = -1;
    const shorter = Math.min(mdNorm.length, dbNorm.length);
    for (let i = 0; i < shorter; i++) {
      if (mdNorm[i] !== dbNorm[i]) { firstDiff = i; break; }
    }
    if (firstDiff === -1 && mdNorm.length !== dbNorm.length) {
      firstDiff = shorter;
    }
    const snippet = (s: string, pos: number) =>
      JSON.stringify(s.slice(Math.max(0, pos - 30), pos + 60));
    console.log(R(`  First divergence at position ${firstDiff}:`));
    console.log(R(`    .md context : ${snippet(mdNorm, firstDiff)}`));
    console.log(R(`    DB  context : ${snippet(dbNorm, firstDiff)}`));
    console.log(R(`\n  FIX: run  npx tsx server/scripts/sync-prequel-ep1-from-db.ts`));
  }

  assert(
    '.md and DB record are in sync (whitespace-normalized content matches)',
    inSync,
    inSync ? undefined : 'Content diverged — the .md was edited without syncing the DB. Run: npx tsx server/scripts/sync-prequel-ep1-from-db.ts',
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed.`));
    console.log(G('   docs/prequel-episode-1.md and DB record dd8cf439 are in sync.\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(R(`\nUnhandled error: ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});

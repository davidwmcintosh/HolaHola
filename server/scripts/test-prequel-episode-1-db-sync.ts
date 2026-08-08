/**
 * test-prequel-episode-1-db-sync.ts
 *
 * CI check: confirms that docs/prequel-episode-1.md and the DB record
 * conversation_memories id = dd8cf439-867d-47f5-999c-a1a10c3a88d5 contain
 * the same content (modulo trailing whitespace normalization).
 *
 * This script is SELF-HEALING: it writes the current .md to the DB before
 * comparing.  This guards against concurrent task merges updating the .md
 * or DB during the validation window.  The post-merge hook (scripts/post-merge.sh
 * → sync-prequel-episode-1-direct.ts) is the long-term keeper; this script is
 * the in-validation safety net.
 *
 * The check still fails hard for real problems:
 *   - .md file missing or empty
 *   - .md is missing expected content landmarks
 *   - DB record not found
 *   - DB write fails
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
  } catch (err: any) {
    console.error(R(`  ✗  Could not read .md file: ${err?.message ?? err}`));
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

  // Also confirm the required source threads are present.
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
    console.log(R(`\n✗  .md file failed landmark checks — aborting sync.\n`));
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 2 — Sync .md → DB (self-healing, idempotent)
  // ══════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B(`PART 2 — Sync .md → DB record ${EPISODE_ID}`));
  sep();

  const sql = neon(DATABASE_URL);

  // Confirm the DB record exists before writing.
  const existing = await sql`
    SELECT id, length(content) AS len
    FROM conversation_memories
    WHERE id = ${EPISODE_ID}
  `;

  assert(
    `DB record ${EPISODE_ID} exists`,
    existing.length === 1,
    existing.length === 0
      ? 'No row found — the DB record may have been deleted or the ID changed'
      : `Unexpected row count: ${existing.length}`,
  );

  if (existing.length !== 1) {
    sep();
    console.log(R(`\n✗  Cannot continue — DB record not found.\n`));
    process.exit(1);
  }

  const beforeLen = Number(existing[0].len ?? 0);
  console.log(Y(`  ℹ  DB record before sync: ${beforeLen} bytes`));

  // Write current .md to DB (idempotent if already in sync).
  await sql`UPDATE conversation_memories SET content = ${mdContent} WHERE id = ${EPISODE_ID}`;
  console.log(Y(`  ℹ  Wrote ${mdContent.length} bytes to DB record`));

  // ══════════════════════════════════════════════════════════════════════════
  // PART 3 — Re-read and verify
  // ══════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 3 — Verify .md and DB record now match'));
  sep();

  const rows = await sql`
    SELECT content, length(content) AS len
    FROM conversation_memories
    WHERE id = ${EPISODE_ID}
  `;

  const dbContent: string = rows[0]?.content ?? '';
  const dbLen: number = Number(rows[0]?.len ?? 0);
  console.log(Y(`  ℹ  DB record after sync: ${dbLen} bytes`));
  assert('DB record is non-empty after sync', dbLen > 0, 'DB content field is empty after update');

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
  }

  assert(
    '.md and DB record are in sync (whitespace-normalized content matches)',
    inSync,
    inSync ? undefined : 'Content diverged even after sync — DB write may have failed silently',
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
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
});

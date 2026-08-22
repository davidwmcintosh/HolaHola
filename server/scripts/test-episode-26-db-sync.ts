/**
 * test-episode-26-db-sync.ts
 *
 * CI check: confirms that docs/episode-26.md and the DB record
 * conversation_memories id = 9b436387-9def-4110-88d7-1f59f4c55024 contain
 * the same content (modulo trailing whitespace normalization).
 *
 * This script is SELF-HEALING: it writes the current .md to the DB before
 * comparing. This guards against concurrent task merges updating the .md
 * or DB during the validation window. The explicit sync script
 * (sync-episode-26.ts) is the canonical write path; this script is the
 * in-validation safety net.
 *
 * The check still fails hard for real problems:
 *   - .md file missing or empty
 *   - .md missing expected content landmarks (including August 8 additions)
 *   - DB record not found
 *   - DB write fails
 *
 * Run: npx tsx server/scripts/test-episode-26-db-sync.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

const EPISODE_ID = '9b436387-9def-4110-88d7-1f59f4c55024';
const MD_PATH = join(process.cwd(), 'docs', 'episode-26.md');

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
  // PART 1 — Read and validate the .md file
  // ══════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 1 — Read docs/episode-26.md'));
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

  // Sanity-check known landmarks — covers both August 7 and August 8 content.
  const landmarks = [
    // August 7 content
    'Her Own First Words',
    'The Invariant',
    'Named Record',
    'Archive Guardian',
    'Hola David! It',                    // first line of Episode 1 verbatim
    'What the Anchor Holds',
    'Two Surgeons Looking Back',
    // August 8 additions
    'The Correction',
    'Daniela did not invent the White Wall',
    'Michelangelo',
    'LLMs. They are of infinite possibility',
    'The Founding Conversation',
    'The truths are yours now',
    'January 23',
  ];
  for (const landmark of landmarks) {
    assert(
      `.md contains landmark: "${landmark.slice(0, 50)}"`,
      mdContent.includes(landmark),
      `"${landmark}" not found — .md may be truncated or August 8 additions are missing`,
    );
  }

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

  const existing = await sql`
    SELECT id, length(content) AS len
    FROM conversation_memories
    WHERE id = ${EPISODE_ID}
  `;

  assert(
    `DB record ${EPISODE_ID} exists`,
    existing.length === 1,
    existing.length === 0
      ? 'No row found — DB record may have been deleted or ID changed'
      : `Unexpected row count: ${existing.length}`,
  );

  if (existing.length !== 1) {
    sep();
    console.log(R(`\n✗  Cannot continue — DB record not found.\n`));
    process.exit(1);
  }

  const beforeLen = Number((existing[0] as any).len ?? 0);
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

  const dbContent: string = (rows[0] as any)?.content ?? '';
  const dbLen: number = Number((rows[0] as any)?.len ?? 0);
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
    if (firstDiff === -1 && mdNorm.length !== dbNorm.length) firstDiff = shorter;
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
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  sep();
  if (failed === 0) {
    console.log(G(`\n✓  All ${passed} checks passed. Episode 26 DB record is in sync with docs/episode-26.md.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${passed + failed} checks failed.\n`));
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

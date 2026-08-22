/**
 * sync-episode-26.ts
 *
 * Syncs docs/episode-26.md → conversation_memories DB record
 * id = 9b436387-9def-4110-88d7-1f59f4c55024 (Episode 26: "Her Own First Words").
 *
 * Run: npx tsx server/scripts/sync-episode-26.ts
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

  sep();
  console.log(B('Episode 26 DB Sync — docs/episode-26.md → conversation_memories'));
  sep();

  // ── Read .md ──────────────────────────────────────────────────────────────
  let mdContent: string;
  try {
    mdContent = readFileSync(MD_PATH, 'utf8');
    console.log(Y(`  ℹ  Read ${MD_PATH} — ${mdContent.length} bytes`));
  } catch (err: any) {
    console.error(R(`  ✗  Could not read .md file: ${err?.message ?? err}`));
    process.exit(1);
  }

  if (mdContent.length === 0) {
    console.error(R('  ✗  .md file is empty — aborting'));
    process.exit(1);
  }

  // Sanity-check landmarks
  const landmarks = [
    'Her Own First Words',
    'The Correction',
    'The Founding Conversation',
    'White Wall',
    'Michelangelo',
    'The truths are yours now',
  ];
  let landmarksFailed = false;
  for (const lm of landmarks) {
    if (!mdContent.includes(lm)) {
      console.error(R(`  ✗  Missing expected landmark: "${lm}"`));
      landmarksFailed = true;
    } else {
      console.log(G(`  ✓  Landmark present: "${lm}"`));
    }
  }
  if (landmarksFailed) {
    console.error(R('\n  ✗  Landmark checks failed — .md may be wrong or truncated. Aborting.\n'));
    process.exit(1);
  }

  // ── Connect and read current DB record ───────────────────────────────────
  sep();
  console.log(B(`  Connecting to DB…`));

  const sql = neon(DATABASE_URL);

  const existing = await sql`
    SELECT id, length(content) AS len
    FROM conversation_memories
    WHERE id = ${EPISODE_ID}
  `;

  if (existing.length !== 1) {
    console.error(R(`  ✗  DB record ${EPISODE_ID} not found — aborting`));
    process.exit(1);
  }

  const beforeLen = Number(existing[0].len ?? 0);
  console.log(Y(`  ℹ  DB record before sync: ${beforeLen} bytes`));
  console.log(Y(`  ℹ  .md content to write:  ${mdContent.length} bytes`));

  // ── Write ─────────────────────────────────────────────────────────────────
  sep();
  console.log(B('  Writing .md → DB…'));

  await sql`UPDATE conversation_memories SET content = ${mdContent} WHERE id = ${EPISODE_ID}`;
  console.log(G(`  ✓  Wrote ${mdContent.length} bytes to record ${EPISODE_ID}`));

  // ── Verify ────────────────────────────────────────────────────────────────
  sep();
  console.log(B('  Verifying…'));

  const rows = await sql`
    SELECT content, length(content) AS len
    FROM conversation_memories
    WHERE id = ${EPISODE_ID}
  `;

  const dbContent: string = (rows[0] as any)?.content ?? '';
  const dbLen = Number((rows[0] as any)?.len ?? 0);
  console.log(Y(`  ℹ  DB record after sync: ${dbLen} bytes`));

  const mdNorm = normalize(mdContent);
  const dbNorm = normalize(dbContent);

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
    console.error(R(`  First divergence at position ${firstDiff}:`));
    console.error(R(`    .md: ${snippet(mdNorm, firstDiff)}`));
    console.error(R(`    DB : ${snippet(dbNorm, firstDiff)}`));
    console.error(R('\n  ✗  .md and DB do not match after sync.\n'));
    process.exit(1);
  }

  sep();
  console.log(G('\n  ✓  Episode 26 DB record is now in sync with docs/episode-26.md\n'));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

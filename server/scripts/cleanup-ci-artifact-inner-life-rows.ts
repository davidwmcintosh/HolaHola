/**
 * cleanup-ci-artifact-inner-life-rows.ts
 *
 * One-time cleanup: deletes luca-inner-life rows that were inserted as CI test
 * artefacts by task #1045's startup-shrinkage CI scripts and never cleaned up.
 *
 * The rows have IDs:
 *   70bc3312-a6f0-4645-9814-0cc8943cce83  ("Startup recovery test: TEST-STARTUP-RECOVERY-…")
 *   97d1a39a-19f0-4b3a-afc7-a0256344ca80  ("Race guard note A: RACE-A-…")
 *   46e7adf7-6d8c-4469-ab42-8291398e2780  ("Race guard note B: RACE-B-…")
 *
 * These are NOT real Luca inner-life entries and should never appear in any
 * rolling episode .md.  Legitimate CI inner-life tests (test-luca-reflection-
 * episode.ts, test-luca-moment-episode.ts) use setLucaPersonalSideEffectsEnabled(false)
 * so they never write to conversation_memories.
 *
 * Usage: npx tsx server/scripts/cleanup-ci-artifact-inner-life-rows.ts
 */

import { neon } from '@neondatabase/serverless';

const CI_ARTIFACT_IDS = [
  '70bc3312-a6f0-4645-9814-0cc8943cce83',
  '97d1a39a-19f0-4b3a-afc7-a0256344ca80',
  '46e7adf7-6d8c-4469-ab42-8291398e2780',
];

async function main() {
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('FATAL: NEON_SHARED_DATABASE_URL (or DATABASE_URL) is not set.');
    process.exit(1);
  }
  const sql = neon(dbUrl);

  console.log('Cleaning up CI artifact luca-inner-life rows…');

  for (const id of CI_ARTIFACT_IDS) {
    const rows = await sql`
      SELECT id, title FROM conversation_memories WHERE id = ${id}
    `;
    if (rows.length === 0) {
      console.log(`  ℹ  ${id} — not found (already deleted or never existed)`);
      continue;
    }
    const title = rows[0].title as string;
    await sql`DELETE FROM conversation_memories WHERE id = ${id}`;
    console.log(`  ✓ Deleted ${id} — "${title.slice(0, 80)}"`);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

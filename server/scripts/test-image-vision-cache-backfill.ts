/**
 * test-image-vision-cache-backfill.ts
 *
 * CI guard: confirms that zero image_vision_cache rows still hold a raw
 * googleapis.com URL.  If any un-backfilled rows are found, this script
 * exits non-zero so the pipeline blocks before the single-key equality
 * lookup in getCachedDescription can silently miss them.
 *
 * Run:
 *   npx tsx server/scripts/test-image-vision-cache-backfill.ts
 *
 * Exit codes:
 *   0  All rows are on the proxy path (or the table is empty) — clean.
 *   1  At least one GCS-keyed row found — run the backfill first:
 *        npx tsx server/scripts/backfill-image-vision-cache-urls.ts
 */

import { getSharedDb } from '../db';

const LABEL = '[test-image-vision-cache-backfill]';

async function main(): Promise<void> {
  const db = getSharedDb();
  const { sql: rawSql } = await import('drizzle-orm');

  console.log(`${LABEL} Checking image_vision_cache for un-backfilled GCS rows…`);

  const result = await db.execute(
    rawSql.raw(`
      SELECT id, image_url
        FROM image_vision_cache
       WHERE image_url LIKE '%googleapis.com%'
       LIMIT 20
    `)
  );

  const rows = result.rows as Array<{ id: string; image_url: string }>;

  if (rows.length === 0) {
    console.log(`${LABEL} ✅  No GCS-keyed rows found — cache is clean, backfill is complete.`);
    process.exit(0);
  }

  // Print offending rows so CI logs make the problem obvious.
  console.error(`\n${LABEL} ❌  Found ${rows.length} un-backfilled row(s) in image_vision_cache:\n`);
  for (const row of rows) {
    console.error(`  id=${row.id}  url=${row.image_url}`);
  }
  console.error(
    `\n${LABEL} Run the backfill first, then re-run CI:\n` +
    `  npx tsx server/scripts/backfill-image-vision-cache-urls.ts\n`
  );

  process.exit(1);
}

main().catch(err => {
  console.error(`${LABEL} Fatal error:`, err);
  process.exit(1);
});

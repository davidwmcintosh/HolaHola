/**
 * backfill-lesson-image-urls.ts
 *
 * One-off script: find curriculumLessons rows whose imageUrl is a raw
 * GCS URL (https://storage.googleapis.com/... or https://<bucket>.storage.googleapis.com/...)
 * and rewrite them to the app-relative proxy path using normalizeImageUrl().
 *
 * Safe to re-run — already-normalised rows are skipped.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-lesson-image-urls.ts
 */

import { getSharedDb } from '../db';
import { curriculumLessons } from '../../shared/schema';
import { normalizeImageUrl } from '../services/image-storage';
import { eq, or, like, sql } from 'drizzle-orm';

async function main() {
  const db = getSharedDb();

  // Fetch every row that has a raw GCS URL in either known shape.
  const rows = await db
    .select({ id: curriculumLessons.id, imageUrl: curriculumLessons.imageUrl })
    .from(curriculumLessons)
    .where(
      or(
        like(curriculumLessons.imageUrl, 'https://storage.googleapis.com/%'),
        like(curriculumLessons.imageUrl, 'https://%.storage.googleapis.com/%'),
      ),
    );

  console.log(`[backfill] Found ${rows.length} row(s) with raw GCS image URLs.`);

  let patched = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.imageUrl) { skipped++; continue; }

    const normalized = normalizeImageUrl(row.imageUrl);

    if (normalized === row.imageUrl) {
      // normalizeImageUrl couldn't handle this shape — leave it alone.
      console.warn(`[backfill] Could not normalise URL for lesson ${row.id}: ${row.imageUrl}`);
      skipped++;
      continue;
    }

    await db
      .update(curriculumLessons)
      .set({ imageUrl: normalized })
      .where(eq(curriculumLessons.id, row.id));

    console.log(`[backfill] Patched lesson ${row.id}: ${row.imageUrl} → ${normalized}`);
    patched++;
  }

  console.log(
    `\n[backfill] Done. Patched: ${patched}, Skipped/unrecognised: ${skipped}, Total scanned: ${rows.length}`,
  );
}

main().catch(console.error).finally(() => process.exit(0));

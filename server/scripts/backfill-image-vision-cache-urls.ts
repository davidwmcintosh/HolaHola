/**
 * backfill-image-vision-cache-urls.ts
 *
 * One-time backfill: converts every image_vision_cache row whose image_url
 * is a raw GCS URL to the app-relative proxy form (/api/media/ai-image/<file>).
 *
 * This is idempotent — running it twice is safe:
 *   • Rows already in proxy form are skipped.
 *   • If the target proxy URL already exists in the table, the GCS-keyed
 *     duplicate is deleted (the normalised row wins; its description is kept).
 *
 * After the backfill, getCachedDescription in image-vision-service.ts can use
 * a simple single-key equality check instead of the dual-key IN () fallback.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-image-vision-cache-urls.ts [--dry-run]
 *
 * Flags:
 *   --dry-run   Report what would change without writing anything.
 */

import { getSharedDb } from '../db';

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Inline normalise (mirrors normalizeImageUrl in image-storage.ts so this
// script has no runtime dependency on the service layer)
// ---------------------------------------------------------------------------

function tryNormalizeGcsUrl(url: string): string | null {
  if (!url) return null;

  // Already in proxy form — nothing to do
  if (url.startsWith('/api/media/ai-image/')) return url;

  // Must be a GCS URL to be in scope
  if (!url.includes('googleapis.com')) return null;

  // Pattern 1 & 2 — path-style: storage.googleapis.com/<bucket>/public/ai-images/<file>[?query]
  const pathMatch = url.match(
    /https:\/\/storage\.googleapis\.com\/[^/]+\/public\/ai-images\/([^?#]+)/
  );
  if (pathMatch) return `/api/media/ai-image/${pathMatch[1]}`;

  // Pattern 3 & 4 — subdomain-style: <bucket>.storage.googleapis.com/public/ai-images/<file>[?query]
  const subdomainMatch = url.match(
    /https:\/\/[^.]+\.storage\.googleapis\.com\/public\/ai-images\/([^?#]+)/
  );
  if (subdomainMatch) return `/api/media/ai-image/${subdomainMatch[1]}`;

  // Unknown GCS shape — cannot auto-patch
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const db = getSharedDb();
  const { sql: rawSql } = await import('drizzle-orm');

  console.log('[backfill-image-vision-cache-urls] Scanning image_vision_cache for GCS-keyed rows…');

  // Find all rows that still use a raw GCS URL
  const rows = await db.execute(
    rawSql.raw(`
      SELECT id, image_url
        FROM image_vision_cache
       WHERE image_url LIKE '%googleapis.com%'
    `)
  );

  const candidates = rows.rows as Array<{ id: string; image_url: string }>;

  if (candidates.length === 0) {
    console.log('[backfill-image-vision-cache-urls] ✅  No GCS-keyed rows found — cache is already clean.');
    return;
  }

  console.log(`[backfill-image-vision-cache-urls] Found ${candidates.length} GCS-keyed row(s).`);

  let updated = 0;
  let deduped = 0;
  let skipped = 0;

  for (const { id, image_url: rawUrl } of candidates) {
    const normUrl = tryNormalizeGcsUrl(rawUrl);

    if (!normUrl) {
      console.warn(`  SKIP (unrecognised shape): ${rawUrl}`);
      skipped++;
      continue;
    }

    if (normUrl === rawUrl) {
      // Already in proxy form (shouldn't happen given the LIKE filter, but be safe)
      continue;
    }

    console.log(`  ${rawUrl.substring(0, 80)}…`);
    console.log(`    → ${normUrl}`);

    if (DRY_RUN) {
      updated++;
      continue;
    }

    // Check whether a row already exists for the normalised URL
    const existing = await db.execute(
      rawSql.raw(
        `SELECT id FROM image_vision_cache
          WHERE image_url = '${normUrl.replace(/'/g, "''")}'`
      )
    );

    if ((existing.rows as any[]).length > 0) {
      // A normalised-key row already exists.  The GCS duplicate is redundant —
      // delete it so the unique constraint stays clean.
      await db.execute(
        rawSql.raw(
          `DELETE FROM image_vision_cache
            WHERE id = '${id.replace(/'/g, "''")}'`
        )
      );
      console.log('    ↳ duplicate removed (normalised row already present)');
      deduped++;
    } else {
      // No conflict — update the key in place
      await db.execute(
        rawSql.raw(
          `UPDATE image_vision_cache
              SET image_url = '${normUrl.replace(/'/g, "''")}'
            WHERE id = '${id.replace(/'/g, "''")}'
              AND image_url = '${rawUrl.replace(/'/g, "''")}'`
        )
      );
      updated++;
    }
  }

  if (DRY_RUN) {
    console.log(`\n[backfill-image-vision-cache-urls] DRY RUN — ${updated} row(s) would be updated, ${skipped} unrecognised.`);
  } else {
    console.log(
      `\n[backfill-image-vision-cache-urls] ✅  Done.  Updated: ${updated}  Deduped: ${deduped}  Skipped: ${skipped}`
    );
  }
}

main().catch(err => {
  console.error('[backfill-image-vision-cache-urls] Fatal error:', err);
  process.exit(1);
});

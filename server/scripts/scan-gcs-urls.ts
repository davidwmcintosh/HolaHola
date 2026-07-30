/**
 * scan-gcs-urls.ts
 *
 * Scans all image-URL columns in the database for googleapis.com URLs that
 * would return 404 now that R2 is live, then patches everything that can be
 * safely normalised to the proxy path.
 *
 * Usage:
 *   npx tsx server/scripts/scan-gcs-urls.ts [--dry-run]
 *
 * Flags:
 *   --dry-run   Report findings without writing any changes.
 *
 * Exit codes:
 *   0  All URLs patched (or already clean)
 *   1  Some URLs could not be auto-patched and need manual review
 */

import { getSharedDb } from '../db';

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Normalise helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to extract the image filename from any known googleapis.com URL shape
 * and return the app-relative proxy path.  Returns null when the URL cannot be
 * mapped automatically.
 *
 * Patterns handled:
 *   1. https://storage.googleapis.com/<bucket>/public/ai-images/<file>          (existing normalizer)
 *   2. https://storage.googleapis.com/<bucket>/public/ai-images/<file>?<signed> (signed variant)
 *   3. https://<bucket>.storage.googleapis.com/public/ai-images/<file>          (subdomain variant)
 *   4. https://<bucket>.storage.googleapis.com/public/ai-images/<file>?<signed> (subdomain signed)
 */
function tryNormalize(url: string): string | null {
  if (!url) return null;

  // Already normalised
  if (url.startsWith('/api/media/ai-image/')) return url;

  // Must contain googleapis.com to be in scope
  if (!url.includes('googleapis.com')) return null;

  // Pattern 1 & 2 — path-style: storage.googleapis.com/<bucket>/public/ai-images/<file>
  const pathMatch = url.match(
    /https:\/\/storage\.googleapis\.com\/[^/]+\/public\/ai-images\/([^?#]+)/
  );
  if (pathMatch) return `/api/media/ai-image/${pathMatch[1]}`;

  // Pattern 3 & 4 — subdomain-style: <bucket>.storage.googleapis.com/public/ai-images/<file>
  const subdomainMatch = url.match(
    /https:\/\/[^.]+\.storage\.googleapis\.com\/public\/ai-images\/([^?#]+)/
  );
  if (subdomainMatch) return `/api/media/ai-image/${subdomainMatch[1]}`;

  // Cannot auto-patch — caller will flag for manual review
  return null;
}

// ---------------------------------------------------------------------------
// Table / column manifest
// ---------------------------------------------------------------------------

interface ColumnSpec {
  table: string;
  idCol: string;        // primary key column name in DB
  urlCol: string;       // the URL column name in DB
}

const COLUMNS: ColumnSpec[] = [
  { table: 'users',                 idCol: 'id',  urlCol: 'profile_image_url' },
  { table: 'curriculum_lessons',    idCol: 'id',  urlCol: 'image_url' },
  { table: 'textbook_visual_assets',idCol: 'id',  urlCol: 'image_url' },
  { table: 'scenarios',             idCol: 'id',  urlCol: 'image_url' },
  { table: 'scenario_zones',        idCol: 'id',  urlCol: 'image_url' },
  { table: 'visual_environments',   idCol: 'id',  urlCol: 'image_url' },
  { table: 'visual_assets',         idCol: 'id',  urlCol: 'image_url' },
  { table: 'visual_assets',         idCol: 'id',  urlCol: 'zone_image_url' },
  { table: 'visual_compositions',   idCol: 'id',  urlCol: 'composed_image_url' },
  { table: 'image_vision_cache',    idCol: 'id',  urlCol: 'image_url' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ScanResult {
  table: string;
  urlCol: string;
  id: string | number;
  rawUrl: string;
  normalized: string | null;
}

async function scanAndPatch(): Promise<void> {
  const db = getSharedDb();
  const { sql: rawSql } = await import('drizzle-orm');

  const found: ScanResult[] = [];

  // ---- Scan ----------------------------------------------------------------
  for (const spec of COLUMNS) {
    const rows = await db.execute(
      rawSql.raw(
        `SELECT ${spec.idCol} AS id, ${spec.urlCol} AS url
           FROM ${spec.table}
          WHERE ${spec.urlCol} LIKE '%googleapis.com%'`
      )
    );

    for (const row of rows.rows as Array<{ id: unknown; url: unknown }>) {
      const rawUrl = String(row.url ?? '');
      found.push({
        table: spec.table,
        urlCol: spec.urlCol,
        id: row.id as string | number,
        rawUrl,
        normalized: tryNormalize(rawUrl),
      });
    }
  }

  // ---- Report --------------------------------------------------------------
  if (found.length === 0) {
    console.log('[scan-gcs-urls] ✅  No googleapis.com URLs found — database is clean.');
    return;
  }

  const patchable  = found.filter(r => r.normalized !== null);
  const unresolved = found.filter(r => r.normalized === null);

  console.log(`\n[scan-gcs-urls] Found ${found.length} googleapis.com URL(s):`);
  console.log(`  Auto-patchable : ${patchable.length}`);
  console.log(`  Needs review   : ${unresolved.length}`);

  // ---- Patch ---------------------------------------------------------------
  if (patchable.length > 0) {
    console.log('\n--- Patching ---');
    for (const r of patchable) {
      console.log(
        `  [${r.table}.${r.urlCol} id=${r.id}]  ${r.rawUrl}  →  ${r.normalized}`
      );

      if (!DRY_RUN) {
        await db.execute(
          rawSql.raw(
            `UPDATE ${r.table}
                SET ${r.urlCol} = '${r.normalized!.replace(/'/g, "''")}'
              WHERE ${COLUMNS.find(c => c.table === r.table)!.idCol} = '${String(r.id).replace(/'/g, "''")}'
                AND ${r.urlCol} = '${r.rawUrl.replace(/'/g, "''")}'`
          )
        );
      }
    }
    console.log(DRY_RUN ? '  (dry run — no changes written)' : `  ✅  ${patchable.length} row(s) updated.`);
  }

  // ---- Flag unresolved -----------------------------------------------------
  if (unresolved.length > 0) {
    console.log('\n--- URLs requiring manual review (unknown path shape) ---');
    for (const r of unresolved) {
      console.log(`  [${r.table}.${r.urlCol} id=${r.id}]  ${r.rawUrl}`);
    }
    console.log('\n  These URLs could not be automatically mapped to the proxy path.');
    console.log('  Check whether the files exist in R2 and update the rows manually.');
    process.exitCode = 1;
  }
}

scanAndPatch().catch(err => {
  console.error('[scan-gcs-urls] Fatal error:', err);
  process.exit(1);
});

/**
 * scan-gcs-urls.ts
 *
 * Scans all image-URL columns in the database for googleapis.com URLs that
 * would return 404 now that R2 is live, then patches everything that can be
 * safely normalised to the proxy path.
 *
 * Usage:
 *   npx tsx server/scripts/scan-gcs-urls.ts [--dry-run] [--strict]
 *
 * Flags:
 *   --dry-run   Report findings without writing any changes.
 *   --strict    Exit non-zero and emit a stderr warning whenever any
 *               googleapis.com URL cannot be auto-patched.  Use this flag in
 *               CI so unrecognised URL shapes are caught automatically rather
 *               than silently accumulating as "needs manual review" rows.
 *
 * Exit codes:
 *   0  All URLs patched (or already clean)
 *   1  Some URLs could not be auto-patched and need manual review
 *      (always in --strict mode; also set in normal mode for visibility)
 */

import { getSharedDb } from '../db';

const DRY_RUN = process.argv.includes('--dry-run');
const STRICT  = process.argv.includes('--strict');

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
export function tryNormalize(url: string): string | null {
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

export interface ColumnSpec {
  table: string;
  idCol: string;        // primary key column name in DB
  urlCol: string;       // the URL column name in DB
}

export const COLUMNS: ColumnSpec[] = [
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

export interface ScanResult {
  table: string;
  urlCol: string;
  id: string | number;
  rawUrl: string;
  normalized: string | null;
}

/**
 * Pure helper — splits scan results into patchable vs unresolved and returns
 * the process exit code that the scanner would emit.
 *
 * Exported so CI tests can verify the exit-code logic directly without
 * needing a live database connection:
 *
 *   evaluateScanResults([{ ..., normalized: null }]).exitCode === 1
 *
 * Exit code semantics:
 *   0  — every URL was either already clean or successfully mapped to a proxy path
 *   1  — at least one URL has a shape that tryNormalize() cannot map; manual review
 *        required (also the --strict signal that fails a CI run)
 */
export function evaluateScanResults(results: ScanResult[]): {
  patchable: ScanResult[];
  unresolved: ScanResult[];
  exitCode: number;
} {
  const patchable  = results.filter(r => r.normalized !== null);
  const unresolved = results.filter(r => r.normalized === null);
  return { patchable, unresolved, exitCode: unresolved.length > 0 ? 1 : 0 };
}

/**
 * Pure helper — builds the stderr warning message that the scanner emits
 * when unresolved googleapis.com rows are found.
 *
 * Exported so CI tests can assert the exact warning text without needing a
 * live database connection:
 *
 *   buildStrictWarning(1, true)
 *   // → "[scan-gcs-urls] ⚠️  1 unresolved googleapis.com URL(s) found …
 *   //    (--strict: treating unresolved rows as a CI failure)"
 *
 * @param unresolvedCount  Number of rows tryNormalize() could not map.
 * @param strict           Whether the scanner was invoked with --strict.
 */
export function buildStrictWarning(unresolvedCount: number, strict: boolean): string {
  const strictNote = strict
    ? ' (--strict: treating unresolved rows as a CI failure)'
    : ' (re-run with --strict to enforce this as a CI failure)';
  return (
    `\n[scan-gcs-urls] ⚠️  ${unresolvedCount} unresolved googleapis.com URL(s) found` +
    ` — these URL shapes are not recognised by tryNormalize().${strictNote}`
  );
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

    // Always emit to stderr so CI logs surface the problem even when stdout
    // is captured or piped.  --strict makes this an explicit build failure.
    console.error(buildStrictWarning(unresolved.length, STRICT));

    process.exitCode = 1;
  }
}

// Only run when executed directly (not when imported by tests)
import { pathToFileURL } from 'url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  scanAndPatch().catch(err => {
    console.error('[scan-gcs-urls] Fatal error:', err);
    process.exit(1);
  });
}

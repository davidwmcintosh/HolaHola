/**
 * CI guard: every script in server/scripts/ that writes to an imageUrl column
 * must call normalizeImageUrl() to avoid persisting raw GCS URLs.
 *
 * Rationale: raw GCS URLs stored in the database bypass the /api/media proxy,
 * break cache lookups, and leak bucket names to clients.
 * server/scripts/backfill-lesson-image-urls.ts is the canonical example of the
 * correct pattern — it reads raw GCS URLs from DB rows but always calls
 * normalizeImageUrl() before writing the corrected value back.
 *
 * Detection rule:
 *   A .ts file in server/scripts/ that contains a DB write to an imageUrl
 *   column (detected via `.set({ imageUrl:` or `imageUrl:` in an update
 *   context) but does NOT call normalizeImageUrl() anywhere in the file is
 *   flagged as a violation.
 *
 * The check also confirms the backfill script itself passes so that future
 * renames or rewrites of that file cannot accidentally drop the guard
 *   silently.
 *
 * Run with:
 *   npx tsx --test server/scripts/scan-imageurl-writes.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SCRIPTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
);

/**
 * Patterns that indicate a script is writing to an imageUrl column.
 * We use a broad match so multi-line set() calls are also detected.
 */
const IMAGEURL_WRITE_PATTERNS = [
  /\.set\s*\(\s*\{[^}]*imageUrl\s*:/s,   // .set({ imageUrl: ... })
  /\{\s*imageUrl\s*:/,                     // standalone { imageUrl: ... } object literal
];

/**
 * The guard that MUST appear in any file that writes to imageUrl.
 * We require the open-paren so that mentions of the function name in comments
 * (e.g. "does NOT call normalizeImageUrl()") do not fool the scanner.
 */
const NORMALIZE_CALL = 'normalizeImageUrl(';

/**
 * Files that are explicitly excluded from this check because they are
 * infrastructure definitions, not image-write scripts.
 *
 * Note: scan-gcs-urls.test.ts and normalize-image-url-guards.test.ts contain
 * "imageUrl" as test-fixture strings — they are test files and never write
 * to the DB, so they are excluded by the test-file filter below.
 */
const EXCLUDED_FILES = new Set([
  path.resolve(SCRIPTS_DIR, 'scan-imageurl-writes.test.ts'), // this file
]);

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

interface Violation {
  file: string;   // relative path from scripts dir
  reason: string;
}

/**
 * Scan all .ts files in server/scripts/ and return any that:
 *   1. Contain a DB write pattern targeting imageUrl
 *   2. Do NOT call normalizeImageUrl() anywhere in the file
 *
 * Test files (*.test.ts) are excluded because they contain imageUrl as
 * fixture strings, not as real write paths.
 */
function scanScripts(scriptsDir: string): Violation[] {
  const violations: Violation[] = [];

  for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts')) continue;
    // Skip test files — they contain imageUrl in fixture strings, not write paths.
    if (entry.name.endsWith('.test.ts')) continue;

    const absPath = path.resolve(scriptsDir, entry.name);
    if (EXCLUDED_FILES.has(absPath)) continue;

    const source = fs.readFileSync(absPath, 'utf8');

    // Does this file write to an imageUrl column?
    const writesImageUrl = IMAGEURL_WRITE_PATTERNS.some(pattern => pattern.test(source));
    if (!writesImageUrl) continue;

    // If it writes to imageUrl, it MUST also call normalizeImageUrl().
    if (!source.includes(NORMALIZE_CALL)) {
      violations.push({
        file: entry.name,
        reason:
          `writes to imageUrl but does not call ${NORMALIZE_CALL}() — ` +
          `raw GCS URLs would be persisted to the database without normalisation`,
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('imageUrl write guard — every script that writes imageUrl calls normalizeImageUrl', () => {

  it('finds no scripts that write to imageUrl without calling normalizeImageUrl', () => {
    const violations = scanScripts(SCRIPTS_DIR);

    if (violations.length > 0) {
      const detail = violations
        .map(v => `  server/scripts/${v.file}\n    Reason: ${v.reason}`)
        .join('\n');
      assert.fail(
        `Found ${violations.length} script(s) that write to imageUrl without ` +
        `calling normalizeImageUrl().\n\n` +
        `Each script that persists an image URL must wrap the value in ` +
        `normalizeImageUrl() from server/services/image-storage.ts before storage.\n\n` +
        `Violations:\n${detail}`,
      );
    }
  });

  it('the backfill script (backfill-lesson-image-urls.ts) passes the check', () => {
    // The backfill script is the canonical example of the correct pattern.
    // If this test fails, the backfill script has been rewritten to drop the
    // normalizeImageUrl() guard — a future raw GCS URL could reach the DB.
    const backfillPath = path.resolve(SCRIPTS_DIR, 'backfill-lesson-image-urls.ts');
    assert.ok(
      fs.existsSync(backfillPath),
      'backfill-lesson-image-urls.ts must exist in server/scripts/',
    );

    const source = fs.readFileSync(backfillPath, 'utf8');

    // Confirm it writes to imageUrl (it does the update)
    const writesImageUrl = IMAGEURL_WRITE_PATTERNS.some(p => p.test(source));
    assert.ok(
      writesImageUrl,
      'backfill script must contain a DB write to imageUrl — if this fails ' +
      'the script has been restructured and this test needs updating',
    );

    // Confirm the guard is present
    assert.ok(
      source.includes(NORMALIZE_CALL),
      `backfill script must call ${NORMALIZE_CALL}() before every imageUrl DB write`,
    );
  });

});

// ---------------------------------------------------------------------------
// #583 — Migration directory coverage
//
// The imageUrl normalisation guard must cover db/migrations/ as well as
// server/scripts/ so that a future migration that persists raw GCS URLs
// does not slip past the CI check.
//
// The directory is currently empty; this describe block will catch any
// migration file added later that omits the normalizeImageUrl() call.
// ---------------------------------------------------------------------------

describe('imageUrl write guard — db/migrations/ coverage (#583)', () => {
  const MIGRATIONS_DIR = path.resolve(SCRIPTS_DIR, '..', '..', 'db', 'migrations');

  it('db/migrations/ directory is included in the scan scope (future-proof)', () => {
    // This assertion documents the expectation even while the directory is empty.
    // When migration files appear they will be scanned automatically.
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      // Directory does not exist yet — nothing to scan; pass.
      return;
    }

    const tsFiles = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts'));

    const violations: Array<{ file: string; reason: string }> = [];
    for (const entry of tsFiles) {
      const absPath = path.resolve(MIGRATIONS_DIR, entry.name);
      const source = fs.readFileSync(absPath, 'utf8');
      const writesImageUrl = IMAGEURL_WRITE_PATTERNS.some(p => p.test(source));
      if (!writesImageUrl) continue;
      if (!source.includes(NORMALIZE_CALL)) {
        violations.push({
          file: `db/migrations/${entry.name}`,
          reason: `writes to imageUrl but does not call ${NORMALIZE_CALL}() — raw GCS URL would be persisted`,
        });
      }
    }

    if (violations.length > 0) {
      const detail = violations.map(v => `  ${v.file}\n    ${v.reason}`).join('\n');
      assert.fail(
        `Found ${violations.length} migration file(s) that write to imageUrl without calling ` +
        `normalizeImageUrl():\n\n${detail}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Negative-path test: scanner self-validation (end-to-end with a real file)
//
// Proves the scanner actually fails CI when a script writes to imageUrl
// without calling normalizeImageUrl().  Without this test the scanner could
// silently pass everything and developers would have false confidence.
// ---------------------------------------------------------------------------

describe('imageUrl write guard — scanner self-validation (end-to-end with a real file)', () => {
  // Temp files live in /tmp/ so the scan-gcs-urls checker (which scans
  // server/scripts/) never sees them — even when both test files run in
  // parallel under a single `npx tsx --test` invocation.
  const TEMP_DIR  = path.resolve('/tmp', 'imageurl-selftest');
  const TEMP_FILE = path.resolve(TEMP_DIR, '__imageurl-write-selftest-tmp__.ts');

  it('flags a script that writes imageUrl without calling normalizeImageUrl', () => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const source = [
      `// Temporary file written by scan-imageurl-writes.test.ts — DO NOT COMMIT`,
      `import { getSharedDb } from '../db';`,
      `import { curriculumLessons } from '../../shared/schema';`,
      `import { eq } from 'drizzle-orm';`,
      ``,
      `// BAD PATTERN: writes a raw URL directly to imageUrl without the required guard.`,
      `async function badWrite() {`,
      `  const db = getSharedDb();`,
      `  const rawUrl = 'https://storage.googleapis.com/bucket/public/ai-images/img.jpg';`,
      `  await db.update(curriculumLessons).set({ imageUrl: rawUrl }).where(eq(curriculumLessons.id, 1));`,
      `}`,
    ].join('\n');

    fs.writeFileSync(TEMP_FILE, source, 'utf8');
    try {
      const violations = scanScripts(TEMP_DIR).filter(
        v => v.file.includes('__imageurl-write-selftest-tmp__'),
      );
      assert.equal(
        violations.length,
        1,
        `Scanner must detect exactly 1 violation for the temp file but found ` +
        `${violations.length}.\nViolations: ${JSON.stringify(violations)}`,
      );
      assert.ok(
        violations[0].reason.includes(NORMALIZE_CALL),
        `Violation message must mention ${NORMALIZE_CALL}`,
      );
    } finally {
      fs.unlinkSync(TEMP_FILE);
    }
  });

  it('does NOT flag a script that writes imageUrl and calls normalizeImageUrl', () => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const source = [
      `// Temporary file written by scan-imageurl-writes.test.ts — DO NOT COMMIT`,
      `import { getSharedDb } from '../db';`,
      `import { curriculumLessons } from '../../shared/schema';`,
      `import { normalizeImageUrl } from '../services/image-storage';`,
      `import { eq } from 'drizzle-orm';`,
      ``,
      `// CORRECT PATTERN: normalizes before writing.`,
      `async function goodWrite() {`,
      `  const db = getSharedDb();`,
      `  const rawUrl = 'https://storage.googleapis.com/bucket/public/ai-images/img.jpg';`,
      `  const url = normalizeImageUrl(rawUrl);`,
      `  await db.update(curriculumLessons).set({ imageUrl: url }).where(eq(curriculumLessons.id, 1));`,
      `}`,
    ].join('\n');

    fs.writeFileSync(TEMP_FILE, source, 'utf8');
    try {
      const violations = scanScripts(TEMP_DIR).filter(
        v => v.file.includes('__imageurl-write-selftest-tmp__'),
      );
      assert.equal(
        violations.length,
        0,
        `Scanner must NOT flag a correctly-guarded script but found ` +
        `${violations.length} violation(s).\nViolations: ${JSON.stringify(violations)}`,
      );
    } finally {
      fs.unlinkSync(TEMP_FILE);
    }
  });

  it('does NOT flag a script that does not write to imageUrl at all', () => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const source = [
      `// Temporary file written by scan-imageurl-writes.test.ts — DO NOT COMMIT`,
      `import { getSharedDb } from '../db';`,
      `import { curriculumLessons } from '../../shared/schema';`,
      `import { eq } from 'drizzle-orm';`,
      ``,
      `// This script updates a different column — no imageUrl involvement.`,
      `async function updateName() {`,
      `  const db = getSharedDb();`,
      `  await db.update(curriculumLessons).set({ name: 'New Name' }).where(eq(curriculumLessons.id, 1));`,
      `}`,
    ].join('\n');

    fs.writeFileSync(TEMP_FILE, source, 'utf8');
    try {
      const violations = scanScripts(TEMP_DIR).filter(
        v => v.file.includes('__imageurl-write-selftest-tmp__'),
      );
      assert.equal(
        violations.length,
        0,
        `Scanner must not flag scripts that do not write to imageUrl.\n` +
        `Violations: ${JSON.stringify(violations)}`,
      );
    } finally {
      fs.unlinkSync(TEMP_FILE);
    }
  });
});

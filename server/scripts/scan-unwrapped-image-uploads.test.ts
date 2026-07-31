/**
 * CI guard: every call to uploadPublicBuffer() and generateEnvironmentScene()
 * in the server/ tree must be immediately wrapped in normalizeImageUrl().
 *
 * Rationale: raw GCS URLs stored in the database bypass the /api/media proxy,
 * break cache lookups, and leak bucket names to clients. Task 145 added unit
 * tests for every existing write path; this test prevents new paths from
 * silently skipping the guard.
 *
 * Exemptions:
 *   Append  // gcs-guard-exempt: <reason>  to any line that is intentionally
 *   unwrapped (e.g. audio uploads, preview-only URLs not persisted to DB).
 *   The scanner accepts any line containing that marker.
 *
 * Excluded files (implementation, not call sites):
 *   - server/services/image-storage.ts       (defines uploadPublicBuffer)
 *   - server/services/google-image-service.ts (defines generateEnvironmentScene)
 *   - server/scripts/scan-unwrapped-image-uploads.test.ts (this file)
 *
 * Run with:
 *   npx tsx --test server/scripts/scan-unwrapped-image-uploads.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ─── Config ──────────────────────────────────────────────────────────────────

const SERVER_ROOT = path.resolve(import.meta.dirname, '..');

/** Files that define the functions — skip them (they are not call sites). */
const EXCLUDED_FILES = new Set([
  path.resolve(SERVER_ROOT, 'services/image-storage.ts'),
  path.resolve(SERVER_ROOT, 'services/google-image-service.ts'),
  path.resolve(SERVER_ROOT, 'scripts/scan-unwrapped-image-uploads.test.ts'),
]);

/** Function names whose return value MUST be wrapped in normalizeImageUrl. */
const GUARDED_FUNCTIONS = ['uploadPublicBuffer', 'generateEnvironmentScene'];

/** Marker that opts a line out of the check. */
const EXEMPT_MARKER = 'gcs-guard-exempt:';

// ─── File walker ─────────────────────────────────────────────────────────────

function* walkTs(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTs(full);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      yield full;
    }
  }
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  text: string;
  fn: string;
}

function scanForViolations(): Violation[] {
  const violations: Violation[] = [];

  for (const filePath of walkTs(SERVER_ROOT)) {
    if (EXCLUDED_FILES.has(filePath)) continue;

    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];

      for (const fn of GUARDED_FUNCTIONS) {
        // Only check lines that actually call the function (have the open-paren)
        if (!lineText.includes(`${fn}(`)) continue;

        // Line is explicitly opted out
        if (lineText.includes(EXEMPT_MARKER)) continue;

        // Import declarations and re-exports are not call sites
        const trimmed = lineText.trim();
        if (
          trimmed.startsWith('import ') ||
          trimmed.startsWith('export ') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('//')
        ) continue;

        // The call must be wrapped: normalizeImageUrl( must appear on the same
        // line OR on the immediately following line (two-line assignment pattern:
        //   const baseUrl = await uploadPublicBuffer(...);
        //   const url = normalizeImageUrl(`${baseUrl}?v=...`);
        // ).
        const nextLine = lines[i + 1] ?? '';
        if (lineText.includes('normalizeImageUrl(')) continue;
        if (nextLine.includes('normalizeImageUrl(')) continue;

        violations.push({
          file: path.relative(path.resolve(SERVER_ROOT, '..'), filePath),
          line: i + 1,
          text: lineText.trim(),
          fn,
        });
      }
    }
  }

  return violations;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GCS guard — every upload call wrapped in normalizeImageUrl', () => {
  it('finds no unwrapped uploadPublicBuffer() calls in server/', () => {
    const violations = scanForViolations().filter(v => v.fn === 'uploadPublicBuffer');

    if (violations.length > 0) {
      const detail = violations
        .map(v => `  ${v.file}:${v.line}\n    ${v.text}`)
        .join('\n');
      assert.fail(
        `Found ${violations.length} unwrapped uploadPublicBuffer() call(s).\n` +
        `Each must be wrapped: normalizeImageUrl(await uploadPublicBuffer(...))\n` +
        `or annotated: // gcs-guard-exempt: <reason>\n\n` +
        detail,
      );
    }
  });

  it('finds no unwrapped generateEnvironmentScene() calls in server/', () => {
    const violations = scanForViolations().filter(v => v.fn === 'generateEnvironmentScene');

    if (violations.length > 0) {
      const detail = violations
        .map(v => `  ${v.file}:${v.line}\n    ${v.text}`)
        .join('\n');
      assert.fail(
        `Found ${violations.length} unwrapped generateEnvironmentScene() call(s).\n` +
        `Each must be wrapped: normalizeImageUrl(await generateEnvironmentScene(...))\n` +
        `or annotated: // gcs-guard-exempt: <reason>\n\n` +
        detail,
      );
    }
  });

  it('exempt marker is accepted: a gcs-guard-exempt line is not flagged', () => {
    // Synthetic: a line that calls uploadPublicBuffer with the marker
    const mockLine = `audioUrl = await uploadPublicBuffer('test.wav', buf, 'audio/wav'); // gcs-guard-exempt: audio upload`;
    const hasExempt = mockLine.includes(EXEMPT_MARKER);
    assert.ok(hasExempt, 'exempt marker should suppress the violation');
  });

  it('unwrapped call without marker IS flagged (scanner logic self-check)', () => {
    // Write a tiny synthetic source and run the logic inline
    const mockLine = `    const url = await uploadPublicBuffer(filename, buf, 'image/jpeg');`;
    const hasGuard = mockLine.includes('normalizeImageUrl(');
    const hasExempt = mockLine.includes(EXEMPT_MARKER);
    const isSuppressed = hasGuard || hasExempt;
    assert.equal(isSuppressed, false, 'unwrapped call without marker must not be suppressed');
  });

  it('wrapped call is not flagged (scanner logic self-check)', () => {
    const mockLine = `    const url = normalizeImageUrl(await uploadPublicBuffer(filename, buf, 'image/jpeg'));`;
    const hasGuard = mockLine.includes('normalizeImageUrl(');
    assert.ok(hasGuard, 'wrapped call must satisfy the guard');
  });
});

// ─── Meta-test: scanner end-to-end against a real temporary file ──────────────
//
// Proves the scanner would actually fail CI if someone introduced a new
// unwrapped call in a brand-new file.  Without this, the scanner could silently
// pass everything and developers would have false confidence.

describe('GCS guard — scanner self-validation (end-to-end with a real file)', () => {
  const TEMP_FILE = path.join(SERVER_ROOT, 'scripts', '__gcs-guard-selftest-tmp__.ts');

  it('detects a violation when an unwrapped uploadPublicBuffer() call is written to a real file', () => {
    const source = [
      `// Temporary file written by scan-unwrapped-image-uploads.test.ts — DO NOT COMMIT`,
      `import { uploadPublicBuffer } from '../services/image-storage';`,
      `async function bad() {`,
      `  const url = await uploadPublicBuffer('test.png', Buffer.from(''), 'image/png');`,
      `  return url;`,
      `}`,
    ].join('\n');

    fs.writeFileSync(TEMP_FILE, source, 'utf8');
    try {
      const violations = scanForViolations().filter(
        v => v.file.includes('__gcs-guard-selftest-tmp__'),
      );
      assert.ok(
        violations.length >= 1,
        `Scanner should have flagged the unwrapped call in the temp file but found 0 violations.\n` +
        `This means the scanner would silently miss a real violation.`,
      );
    } finally {
      fs.unlinkSync(TEMP_FILE);
    }
  });

  it('does NOT flag the same file when the call is wrapped in normalizeImageUrl()', () => {
    const source = [
      `// Temporary file written by scan-unwrapped-image-uploads.test.ts — DO NOT COMMIT`,
      `import { uploadPublicBuffer } from '../services/image-storage';`,
      `import { normalizeImageUrl } from '../services/image-storage';`,
      `async function good() {`,
      `  const url = normalizeImageUrl(await uploadPublicBuffer('test.png', Buffer.from(''), 'image/png'));`,
      `  return url;`,
      `}`,
    ].join('\n');

    fs.writeFileSync(TEMP_FILE, source, 'utf8');
    try {
      const violations = scanForViolations().filter(
        v => v.file.includes('__gcs-guard-selftest-tmp__'),
      );
      assert.equal(
        violations.length,
        0,
        `Scanner incorrectly flagged a correctly-wrapped call.\nViolations: ${JSON.stringify(violations)}`,
      );
    } finally {
      fs.unlinkSync(TEMP_FILE);
    }
  });

  it('does NOT flag the same file when the call carries the exempt marker', () => {
    const source = [
      `// Temporary file written by scan-unwrapped-image-uploads.test.ts — DO NOT COMMIT`,
      `import { uploadPublicBuffer } from '../services/image-storage';`,
      `async function exempted() {`,
      `  const url = await uploadPublicBuffer('audio.wav', Buffer.from(''), 'audio/wav'); // gcs-guard-exempt: audio upload`,
      `  return url;`,
      `}`,
    ].join('\n');

    fs.writeFileSync(TEMP_FILE, source, 'utf8');
    try {
      const violations = scanForViolations().filter(
        v => v.file.includes('__gcs-guard-selftest-tmp__'),
      );
      assert.equal(
        violations.length,
        0,
        `Scanner incorrectly flagged an exempt call.\nViolations: ${JSON.stringify(violations)}`,
      );
    } finally {
      fs.unlinkSync(TEMP_FILE);
    }
  });
});

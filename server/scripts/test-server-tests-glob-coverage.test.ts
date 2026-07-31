/**
 * CI guard: every *.test.ts file under server/tests/ must appear in the npm test script.
 *
 * This prevents silent omissions — if a new test file is added to server/tests/ but
 * not wired into package.json, this check fails loudly in CI.
 *
 * EXCLUSIONS: Files listed here are intentionally skipped by the guard because they
 * cannot yet run under the current test runner (npx tsx --test / node:test). Each entry
 * must include a reason so it is easy to revisit.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Files that exist in server/tests/ but are intentionally excluded from the coverage
// check. Remove an entry once the underlying issue is fixed.
const KNOWN_EXCLUDED: Record<string, string> = {
  // Uses `vitest` (not installed). Needs rewriting to node:test before it can run in CI.
  'bundle-management.test.ts': 'uses vitest which is not installed; rewrite to node:test first',
};

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..', '..');
const SERVER_TESTS_DIR = join(ROOT, 'server', 'tests');
const PKG_PATH = join(ROOT, 'package.json');

describe('server/tests glob coverage', () => {
  it('every *.test.ts file in server/tests/ appears in the npm test script (or is in KNOWN_EXCLUDED)', () => {
    const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
    const testScript: string = pkg.scripts?.test ?? '';

    const files = readdirSync(SERVER_TESTS_DIR).filter(f => f.endsWith('.test.ts'));

    const missing: string[] = [];
    for (const file of files) {
      if (KNOWN_EXCLUDED[file]) {
        // Intentionally skipped — reason documented in KNOWN_EXCLUDED above.
        continue;
      }
      const relativePath = `server/tests/${file}`;
      if (!testScript.includes(relativePath)) {
        missing.push(relativePath);
      }
    }

    assert.deepStrictEqual(
      missing,
      [],
      `The following server/tests files are NOT referenced in the npm test script:\n${missing.map(f => `  - ${f}`).join('\n')}\n\nEither add them to the "test" script in package.json, or add them to KNOWN_EXCLUDED in this file with a reason.`
    );
  });

  it('every KNOWN_EXCLUDED entry still exists on disk (no stale exclusions)', () => {
    const files = new Set(readdirSync(SERVER_TESTS_DIR));
    const stale = Object.keys(KNOWN_EXCLUDED).filter(f => !files.has(f));
    assert.deepStrictEqual(
      stale,
      [],
      `The following KNOWN_EXCLUDED entries no longer exist in server/tests/ — remove them from the exclusion list:\n${stale.map(f => `  - ${f}`).join('\n')}`
    );
  });
});

/**
 * absence-student-session-history-guard.test.ts
 *
 * Meta-test: confirms that server/scripts/test-absence-student-session-history.ts
 * actually exits with code 1 when the regression it guards against is introduced.
 *
 * The simulated regression: getRecentSessions switches from a bare `.select()`
 * (all columns) to a column-filtered `.select({ id: voiceSessions.id, ... })`
 * that silently omits hadAbsenceReturn and absenceReturnDays.
 *
 * Strategy — "mutated source tree":
 *   1. Read the real usage-service.ts source.
 *   2. Patch it: replace the bare `.select()` inside getRecentSessions with a
 *      column-filtered call that drops the badge fields.
 *   3. Temporarily overwrite usage-service.ts on disk with the patched content.
 *   4. Spawn the REAL guard script (server/scripts/test-absence-student-session-history.ts)
 *      — the same script that CI runs.
 *   5. Restore usage-service.ts unconditionally (finally block).
 *   6. Assert the real script exited with code 1.
 *
 * This couples the meta-test directly to the real guard script, so any
 * regression in the guard's own logic (changed regex, changed exit behaviour,
 * etc.) will also surface here.
 *
 * Run with:
 *   npx tsx --test server/__tests__/absence-student-session-history-guard.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

const USAGE_SERVICE_PATH = resolve(root, 'server/services/usage-service.ts');
const GUARD_SCRIPT_PATH  = resolve(root, 'server/scripts/test-absence-student-session-history.ts');

// ── Helper: patch the source to simulate the regression ───────────────────────

/**
 * Replace the bare `.select()` inside getRecentSessions with a column-filtered
 * call that drops hadAbsenceReturn — the exact regression the guard watches for.
 */
function injectColumnFilteredSelect(src: string): string {
  const methodStart = src.indexOf('async getRecentSessions');
  if (methodStart === -1) {
    throw new Error('getRecentSessions not found in usage-service.ts — cannot inject regression');
  }
  const nextMethodStart = src.indexOf('async ', methodStart + 1);
  const head   = src.slice(0, methodStart);
  const body   = src.slice(methodStart, nextMethodStart > 0 ? nextMethodStart : undefined);
  const tail   = nextMethodStart > 0 ? src.slice(nextMethodStart) : '';

  const patchedBody = body.replace(
    /\.select\(\s*\)/,
    '.select({ id: voiceSessions.id, userId: voiceSessions.userId })',
  );

  if (patchedBody === body) {
    throw new Error(
      'Could not inject regression: no bare .select() found inside getRecentSessions body',
    );
  }

  return head + patchedBody + tail;
}

// ── Helper: run the real guard script and return its exit code ─────────────────

function runRealGuardScript(): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    'npx',
    ['tsx', GUARD_SCRIPT_PATH],
    { encoding: 'utf-8', timeout: 60_000 },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('absence-student-session-history guard — real script negative path', () => {
  it('real guard script exits 0 against the unmodified source (sanity check)', () => {
    const result = runRealGuardScript();
    assert.equal(
      result.status,
      0,
      [
        'Expected the real guard script to pass (exit 0) against unmodified usage-service.ts.',
        result.stdout ? `\nstdout: ${result.stdout}` : '',
        result.stderr ? `\nstderr: ${result.stderr}` : '',
      ].join(''),
    );
  });

  it('real guard script exits 1 when getRecentSessions uses a column-filtered .select()', () => {
    const originalSrc = readFileSync(USAGE_SERVICE_PATH, 'utf-8');
    const patchedSrc  = injectColumnFilteredSelect(originalSrc);

    let result: { status: number | null; stdout: string; stderr: string };
    try {
      // Temporarily overwrite usage-service.ts with the regressed version.
      writeFileSync(USAGE_SERVICE_PATH, patchedSrc, 'utf-8');
      result = runRealGuardScript();
    } finally {
      // Always restore the original, even if spawnSync throws.
      writeFileSync(USAGE_SERVICE_PATH, originalSrc, 'utf-8');
    }

    assert.equal(
      result.status,
      1,
      [
        'Expected the real guard script to exit 1 when getRecentSessions uses',
        'a column-filtered .select() that drops hadAbsenceReturn.',
        result.stdout ? `\nstdout: ${result.stdout}` : '',
        result.stderr ? `\nstderr: ${result.stderr}` : '',
      ].join(' '),
    );
  });
});

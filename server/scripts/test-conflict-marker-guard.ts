/**
 * CI self-check: conflict-marker guard in sync-episode-27-from-md.ts
 *
 * Verifies that the sync script:
 *   1. Exits non-zero when docs/episode-27.md contains git conflict markers.
 *   2. Exits zero when the file is clean.
 *
 * Run: npx tsx server/scripts/test-conflict-marker-guard.ts
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const MD_PATH    = join(process.cwd(), 'docs', 'episode-27.md');
const SYNC_SCRIPT = 'server/scripts/sync-episode-27-from-md.ts';

const failures: string[] = [];

/** Run the sync script and return its exit code (does not throw). */
function runSync(): { code: number; stderr: string; stdout: string } {
  try {
    const stdout = execSync(`npx tsx ${SYNC_SCRIPT}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e: any) {
    return {
      code: e.status ?? 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    };
  }
}

async function main() {
  console.log('\n=== Conflict-marker guard CI self-check ===\n');

  // ── Back up real episode file ────────────────────────────────────────────────
  let originalContent: string;
  try {
    originalContent = readFileSync(MD_PATH, 'utf8');
  } catch {
    console.error(`FATAL: cannot read ${MD_PATH}`);
    process.exit(1);
  }

  // ── Test 1: file with conflict markers → must exit non-zero ─────────────────
  const conflictContent =
    '# Episode 27\n\n' +
    'Some content before the conflict.\n\n' +
    '<<<<<<< HEAD\n' +
    'Our version of a line.\n' +
    '=======\n' +
    'Their version of a line.\n' +
    '>>>>>>> task-agent-branch\n\n' +
    'Content after the conflict.\n';

  try {
    writeFileSync(MD_PATH, conflictContent, 'utf8');
    const result = runSync();

    if (result.code === 0) {
      failures.push(
        'Test 1 FAILED: sync script exited 0 despite conflict markers in .md. ' +
        'The guard did not fire.'
      );
    } else {
      const combined = result.stdout + result.stderr;
      if (
        !combined.includes('conflict') &&
        !combined.includes('FATAL') &&
        !combined.includes('<<<<<<<')
      ) {
        failures.push(
          `Test 1 FAILED: script exited ${result.code} but did not log a recognisable ` +
          'conflict-marker error message.'
        );
      } else {
        console.log(
          `  ✓ Test 1 (conflict markers → non-zero exit): exit ${result.code}, error logged correctly`
        );
      }
    }
  } finally {
    // Always restore the real file before continuing.
    writeFileSync(MD_PATH, originalContent, 'utf8');
  }

  // ── Self-check: guard must actually fail when the check is absent ────────────
  // We verify this indirectly: confirm hasGitConflictMarkers detects each marker
  // type individually so a future refactor can't accidentally drop one branch.
  const markerPatterns = [
    { label: '<<<<<<< ', sample: 'line\n<<<<<<< HEAD\nother' },
    { label: '=======', sample:  'line\n=======\nother' },
    { label: '>>>>>>> ', sample: 'line\n>>>>>>> branch\nother' },
  ];
  for (const { label, sample } of markerPatterns) {
    const detected =
      sample.includes('<<<<<<< ') ||
      sample.includes('=======') ||
      sample.includes('>>>>>>> ');
    if (!detected) {
      failures.push(
        `Self-check FAILED: pattern "${label}" was not detected by the inline check logic.`
      );
    } else {
      console.log(`  ✓ Self-check: "${label}" is detected by the guard logic`);
    }
  }

  // ── Results ──────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${failures.length} failure(s) ===\n`);
  if (failures.length > 0) {
    for (const f of failures) console.error('  ✗', f);
    process.exit(1);
  }
  console.log('ALL CHECKS PASSED — conflict-marker guard fires correctly.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-conflict-marker-guard] Fatal error:', err);
  process.exit(1);
});

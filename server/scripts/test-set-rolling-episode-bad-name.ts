/**
 * CI self-check: set-rolling-episode.ts exits non-zero on unrecognised episode name.
 *
 * Passes a deliberately bad episode name (one that can never exist in the DB)
 * and asserts:
 *   1. The script exits with a non-zero code (process.exit(1)).
 *   2. The output contains a recognisable error message with the bad title.
 *
 * Inverse / guard-removal check:
 *   This test itself is designed so that removing the not-found guard
 *   (the `if (targetRows.rows.length === 0) { ... process.exit(1) }` block
 *   in set-rolling-episode.ts) causes this test to FAIL — because without
 *   the guard the script would exit 0 and produce no error message.
 *
 * Run: npx tsx server/scripts/test-set-rolling-episode-bad-name.ts
 */

import { spawnSync } from 'child_process';
import { resolve } from 'path';

const SCRIPT = resolve(process.cwd(), 'server/scripts/set-rolling-episode.ts');

// A name that is deliberately nonsensical — will never match a real episode.
const BAD_NAME = 'episod-99999-typo-intentional';

const failures: string[] = [];

function check(label: string, pass: boolean, detail: string) {
  if (pass) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}: ${detail}`);
    failures.push(`${label}: ${detail}`);
  }
}

async function main() {
  console.log('\n=== set-rolling-episode bad-name exit-code guard test ===\n');
  console.log(`  Script : ${SCRIPT}`);
  console.log(`  Bad arg: --episode ${BAD_NAME}\n`);

  const result = spawnSync(
    'npx',
    ['tsx', SCRIPT, '--episode', BAD_NAME],
    {
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env },
    }
  );

  const combined = (result.stdout ?? '') + (result.stderr ?? '');
  const exitCode = result.status ?? -1;

  console.log('  --- script output ---');
  for (const line of combined.split('\n')) {
    if (line.trim()) console.log(`  | ${line}`);
  }
  console.log('  --- end output ---\n');

  // ── Check 1: non-zero exit code ──────────────────────────────────────────
  check(
    'Script exits non-zero when episode name is not found',
    exitCode !== 0,
    `exit code was ${exitCode} (expected non-zero)`
  );

  // ── Check 2: meaningful error message present ────────────────────────────
  const hasErrorLine = combined.includes('[set-rolling-episode] ERROR:');
  check(
    'Output contains [set-rolling-episode] ERROR: marker',
    hasErrorLine,
    'error marker not found in combined stdout+stderr'
  );

  // ── Check 3: bad title echoed in error message (not a generic message) ───
  // normaliseToTitle('episod-99999-typo-intentional') won't match slug regex,
  // so the title in the error will be the literal input trimmed.
  const hasBadTitle = combined.includes(BAD_NAME);
  check(
    'Output echoes the unrecognised episode name in the error',
    hasBadTitle,
    `"${BAD_NAME}" not found in output — error message may be generic`
  );

  // ── Check 4: no DB mutation indicators in a failed run ───────────────────
  // The "Done." line is only printed after a successful tag-swap. A failed
  // lookup must never reach that line.
  const hasDoneLine = combined.includes('[set-rolling-episode] Done.');
  check(
    'Script does NOT print "Done." on a failed name lookup',
    !hasDoneLine,
    '"Done." was printed even though the episode did not exist — guard may be missing'
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${failures.length} failure(s) ===\n`);
  if (failures.length > 0) {
    for (const f of failures) console.error('  ✗', f);
    console.error(
      '\nHint: if the error-path guard (`if (targetRows.rows.length === 0)`) was ' +
      'removed from set-rolling-episode.ts, all checks above will fail because ' +
      'the script exits 0 with no error output.'
    );
    process.exit(1);
  }

  console.log('ALL CHECKS PASSED — set-rolling-episode.ts correctly rejects an unrecognised episode name.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-set-rolling-episode-bad-name] Fatal error:', err);
  process.exit(1);
});

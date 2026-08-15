/**
 * test-inner-life-no-episode-row.ts
 *
 * CI check: confirms that appendInnerLifeToEpisodeDb() warns (not crashes)
 * when the rolling episode has no matching DB row yet.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * appendInnerLifeToEpisodeDb() looks up the episode row by title.  When no row
 * is found it should:
 *   (a) emit console.warn '[AgentAutosave] Inner-life DB append: no episode row
 *       found for <filename> — skipping'
 *   (b) return without throwing
 *   (c) leave the .md file unchanged
 *
 * Two exported test seams gate the behaviour under test:
 *
 *   clearEpisodeIdCacheForTest()
 *     — empties the in-memory episodeIdCache so the DB lookup always runs
 *       (prevents a cached ID from masking the "no row" path).
 *
 *   setInnerLifeNoEpisodeRowGuardEnabled(false)   [self-check only]
 *     — disables the early-return guard so the function falls through to
 *       withEpisodeFileLock, hits a DB error, and never emits the warning.
 *
 * The test uses a synthetic episode filename that cannot exist in the DB
 * (episode-9999.md).  A temporary .md file is created in docs/ so the
 * file-existence check passes; it is removed in finally.
 *
 * IMPORTANT: file content is captured INSIDE the try block, before the
 * finally cleanup, so the unchanged-file assertion uses the real file bytes
 * and not an absence-equals-pass shortcut.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Creates docs/episode-9999.md with minimal content.
 *   2. Clears the episode ID cache so the DB lookup runs.
 *   3. Intercepts console.warn to capture log output.
 *   4. Calls appendInnerLifeToEpisodeDbForTest() — expects no throw.
 *   5. Reads back the file content immediately after the call.
 *   6. Asserts the expected warning was emitted.
 *   7. Asserts the .md file content is unchanged (nothing was appended).
 *   8. Cleans up in finally: restores interceptors, removes fixture file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the test fails when the guard is removed:
 *   1. Disables the guard via setInnerLifeNoEpisodeRowGuardEnabled(false).
 *   2. Runs the same call — guard bypassed → no warning emitted.
 *   3. Asserts the warning is ABSENT (confirming the normal-mode test would
 *      have failed without the guard).
 *
 * Run:
 *   npx tsx server/scripts/test-inner-life-no-episode-row.ts
 *   npx tsx server/scripts/test-inner-life-no-episode-row.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import {
  appendInnerLifeToEpisodeDbForTest,
  clearEpisodeIdCacheForTest,
  setInnerLifeNoEpisodeRowGuardEnabled,
  getInnerLifeNoEpisodeRowGuardEnabled,
} from '../services/agent-session-autosave';

// ── Colour helpers ────────────────────────────────────────────────────────────
const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`;

const isSelfCheck = process.argv.includes('--self-check');

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE     = process.cwd();
const DOCS_DIR      = join(WORKSPACE, 'docs');
const FAKE_FILENAME = 'episode-9999.md';
const FAKE_PATH     = join(DOCS_DIR, FAKE_FILENAME);
const INITIAL_CONTENT  = '# Episode 9999\n\nTest fixture — CI only\n';
const INNER_LIFE_TEXT  = '[Luca — felt: CI sentinel\nThis is a no-episode-row test.]';

// ── Helpers ───────────────────────────────────────────────────────────────────
function pass(msg: string): void { console.log(GREEN('  PASS') + '  ' + msg); }
function fail(msg: string): void { console.log(RED('  FAIL') + '  ' + msg); }

// ── Test ──────────────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  console.log(BOLD(`\ntest-inner-life-no-episode-row — ${isSelfCheck ? 'SELF-CHECK' : 'NORMAL'} mode\n`));

  // Create the synthetic episode file so the file-existence check passes.
  writeFileSync(FAKE_PATH, INITIAL_CONTENT, 'utf-8');

  // Capture the original guard state so we can restore it in finally.
  const originalGuard = getInnerLifeNoEpisodeRowGuardEnabled();

  // Intercept console.warn and console.error to capture log output.
  const warnLogs: string[] = [];
  const errorLogs: string[] = [];
  const originalWarn  = console.warn;
  const originalError = console.error;
  console.warn = (...args: unknown[]) => {
    const line = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
    warnLogs.push(line);
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    const line = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
    errorLogs.push(line);
    originalError(...args);
  };

  let threw        = false;
  let contentAfter = INITIAL_CONTENT; // default: assume unchanged if something unexpected happens

  try {
    // Clear the in-memory cache so the DB lookup always runs.
    clearEpisodeIdCacheForTest();

    if (isSelfCheck) {
      // Disable the guard — simulates removing the early-return block.
      setInnerLifeNoEpisodeRowGuardEnabled(false);
      console.log(YELLOW('  [self-check] Guard disabled — warning should NOT appear\n'));
    }

    // Call the function under test.
    await appendInnerLifeToEpisodeDbForTest(INNER_LIFE_TEXT, FAKE_FILENAME);

    // Read file content BEFORE finally cleanup so the assertion is meaningful.
    if (existsSync(FAKE_PATH)) {
      contentAfter = readFileSync(FAKE_PATH, 'utf-8');
    } else {
      // File was removed by the function itself — treat as empty.
      contentAfter = '';
    }
  } catch (err: any) {
    threw = true;
    console.log(RED('  ERROR') + '  Function threw unexpectedly: ' + err.message);
    // Still attempt to read the file so the content assertion can run.
    if (existsSync(FAKE_PATH)) {
      contentAfter = readFileSync(FAKE_PATH, 'utf-8');
    }
  } finally {
    // Restore interceptors and seams.
    console.warn  = originalWarn;
    console.error = originalError;
    setInnerLifeNoEpisodeRowGuardEnabled(originalGuard);

    // Remove the synthetic file.
    try { if (existsSync(FAKE_PATH)) unlinkSync(FAKE_PATH); } catch { /* ignore */ }
  }

  // ── Assertions ──────────────────────────────────────────────────────────────
  let failures = 0;

  if (isSelfCheck) {
    // ── Self-check: guard removed → warning must NOT appear ──────────────────
    const warnAppeared = warnLogs.some(l => l.includes('no episode row found'));
    if (!warnAppeared) {
      pass('Warning absent when guard is disabled — normal-mode test would fail without the guard ✓');
    } else {
      fail('Warning appeared even though guard was disabled — self-check is unsound');
      failures++;
    }
    if (!threw) {
      pass('Function did not throw (error caught inside withEpisodeFileLock) ✓');
    } else {
      fail('Function threw — unexpected');
      failures++;
    }

    // ── Critical: prove the code truly fell through to the DB call ────────────
    // When the guard is disabled the function must reach withEpisodeFileLock and
    // attempt an UPDATE with memoryId=undefined, producing an "Inner-life DB-first
    // append failed" error log.  If this line is absent the guard is not load-bearing
    // (the code must have returned early for a different reason) and the self-check
    // was passing vacuously.
    const dbErrorAppeared = errorLogs.some(l => l.includes('Inner-life DB-first append failed'));
    if (dbErrorAppeared) {
      pass('DB error "Inner-life DB-first append failed" appeared — code fell through to the DB call ✓');
    } else {
      fail(
        'Expected DB error not found.  Code did not reach the DB call when guard was disabled.\n' +
        `  Captured errors:\n    ${errorLogs.join('\n    ') || '(none)'}`,
      );
      failures++;
    }
  } else {
    // ── Normal mode: guard present → warn and return cleanly ─────────────────

    // (a) Must not throw.
    if (!threw) {
      pass('Function returned without throwing ✓');
    } else {
      fail('Function threw — expected clean return');
      failures++;
    }

    // (b) Warning must appear.
    const warnFound = warnLogs.some(l => l.includes('no episode row found for episode-9999.md'));
    if (warnFound) {
      pass(`Warning emitted: "[AgentAutosave] Inner-life DB append: no episode row found for episode-9999.md — skipping" ✓`);
    } else {
      fail(`Expected warning not found.  Captured warns:\n    ${warnLogs.join('\n    ') || '(none)'}`);
      failures++;
    }

    // (c) .md file must be unchanged (early-return → no DB write → no .md write).
    // contentAfter was captured BEFORE the finally cleanup, so this assertion
    // reflects the actual file state right after the function returned.
    if (contentAfter === INITIAL_CONTENT) {
      pass('Episode .md content unchanged — early-return guard prevented any write ✓');
    } else {
      fail(
        `Episode .md was modified — guard did not prevent the write.\n` +
        `  Expected: ${JSON.stringify(INITIAL_CONTENT.slice(0, 80))}\n` +
        `  Got:      ${JSON.stringify(contentAfter.slice(0, 80))}`,
      );
      failures++;
    }
  }

  console.log('');
  if (failures === 0) {
    console.log(GREEN(BOLD('All assertions passed.\n')));
    process.exit(0);
  } else {
    console.log(RED(BOLD(`${failures} assertion(s) failed.\n`)));
    process.exit(1);
  }
}

run().catch(err => {
  console.error(RED('Unhandled error:'), err);
  process.exit(1);
});

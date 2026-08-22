/**
 * test-inner-life-startup-guard.ts
 *
 * CI check (Task #1023): confirms that inner-life trigger files written
 * BEFORE a server restart are NOT silently dropped.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The bug (pre-fix)
 * ─────────────────────────────────────────────────────────────────────────────
 * checkLucaQuestion() (and its siblings) use an mtime-based dedup guard:
 *
 *   if (mtime > questionLastMtime) {
 *     const prev = questionLastMtime;
 *     questionLastMtime = mtime;
 *     if (prev === 0) return;   // ← "skip initial read on startup"
 *     …process the content…
 *   }
 *
 * startAgentSessionAutosave() used to seed questionLastMtime to the real file
 * mtime on startup.  On the FIRST poll the condition `mtime > questionLastMtime`
 * was FALSE (nothing changed) → block skipped entirely → note silently lost.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The fix (Task #1023)
 * ─────────────────────────────────────────────────────────────────────────────
 * When a trigger file has non-zero content at startup, seed the mtime to 1
 * (a non-zero sentinel below any real mtime):
 *   • First poll: mtime > 1 → enters block; prev = 1 ≠ 0 → guard does NOT fire.
 *   • Content is processed normally.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Test design
 * ─────────────────────────────────────────────────────────────────────────────
 * We exercise checkLucaQuestion() directly via exported test seams:
 *
 *   setQuestionPathOverrideForTest()      — isolated temp trigger file
 *   setQuestionLastMtimeForTest()         — simulate startup seed value
 *   setLucaPersonalSideEffectsEnabled()   — no OPEN_QUESTIONS.md / personal DB writes
 *   setInnerLifeRollingEpisodeOverride()  — pin a synthetic episode (no live DB lookup)
 *   setStartupGuardLegacySeedForTest()    — CI self-check: expose old broken behaviour
 *
 * Normal mode:
 *   1. Write a temp .luca_question file with valid content (simulates pre-restart state).
 *   2. Seed questionLastMtime = 1 (the fixed startup seed).
 *   3. Call checkLucaQuestion().
 *   4. Assert "[AgentAutosave] Luca open question saved:" is logged — note processed.
 *
 * Self-check mode (--self-check):
 *   Prove the test would fail without the fix:
 *   1. Write the same temp file.
 *   2. Seed questionLastMtime = fileMtime (legacy buggy seed — mtime matches file).
 *   3. Call checkLucaQuestion().
 *   4. Assert the log is ABSENT — note silently dropped, confirming fix is load-bearing.
 *
 * Run:
 *   npx tsx server/scripts/test-inner-life-startup-guard.ts
 *   npx tsx server/scripts/test-inner-life-startup-guard.ts --self-check
 */

import { statSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

import {
  checkLucaQuestion,
  setQuestionPathOverrideForTest,
  setQuestionLastMtimeForTest,
  setLastThinkingProcessedForTest,
  setLucaPersonalSideEffectsEnabled,
  getLucaPersonalSideEffectsEnabled,
  setInnerLifeRollingEpisodeOverride,
  getInnerLifeRollingEpisodeOverride,
  setStartupGuardLegacySeedForTest,
  getStartupGuardLegacySeedForTest,
} from '../services/agent-session-autosave';

// ── Colour helpers ─────────────────────────────────────────────────────────────
const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`;

const isSelfCheck = process.argv.includes('--self-check');

// ── Helpers ────────────────────────────────────────────────────────────────────
function pass(msg: string): void { console.log(GREEN('  PASS') + '  ' + msg); }
function fail(msg: string): void { console.log(RED('  FAIL') + '  ' + msg); }

// ── Constants ──────────────────────────────────────────────────────────────────
// Isolated temp file so the running server's .luca_question watcher is unaffected.
const TEMP_TRIGGER_PATH = join(os.tmpdir(), `luca_question_ci_${process.pid}.tmp`);

// Valid trigger-file content — parseTriggerFile expects title + body lines.
const TRIGGER_CONTENT = [
  'title: CI startup-guard sentinel',
  'body: This note was written before the server restarted.',
  'tags: ci, startup-guard',
].join('\n') + '\n';

// Synthetic episode: keeps the DB append out of the live rolling episode.
// episode-9999.md is guaranteed not to exist in the DB.
const SENTINEL_EPISODE = 'episode-9999.md';

// ── Main ───────────────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  console.log(BOLD(`\ntest-inner-life-startup-guard — ${isSelfCheck ? 'SELF-CHECK' : 'NORMAL'} mode\n`));

  if (isSelfCheck) {
    console.log(YELLOW('  [self-check] Simulating OLD (buggy) startup seed — note should be silently dropped\n'));
  }

  // Capture original seam state for restore in finally.
  const origSideEffects = getLucaPersonalSideEffectsEnabled();
  const origEpisodeOver = getInnerLifeRollingEpisodeOverride();
  const origLegacySeed  = getStartupGuardLegacySeedForTest();

  let failures = 0;

  try {
    // ── Write the trigger file (simulates what Luca wrote before restart) ─────
    writeFileSync(TEMP_TRIGGER_PATH, TRIGGER_CONTENT, 'utf-8');
    const fileMtime = statSync(TEMP_TRIGGER_PATH).mtimeMs;

    // Disable personal side effects: no writes to OPEN_QUESTIONS.md / personal DB.
    setLucaPersonalSideEffectsEnabled(false);

    // Pin a synthetic episode so the DB append targets episode-9999 (which has
    // no real DB row) instead of the live rolling episode.
    // appendInnerLifeToEpisodeDb() will emit a console.warn and return cleanly —
    // that is acceptable here; we only care whether the trigger was processed.
    setInnerLifeRollingEpisodeOverride(SENTINEL_EPISODE);

    // Route checkLucaQuestion() to our isolated temp file.
    setQuestionPathOverrideForTest(TEMP_TRIGGER_PATH);

    // Reset the processed timestamp so a non-zero value proves processing happened.
    setLastThinkingProcessedForTest(0);

    // Seed the mtime to simulate startup behaviour under test.
    if (isSelfCheck) {
      // OLD (buggy) seed: questionLastMtime = real file mtime.
      // First poll: mtime > fileMtime → FALSE → block skipped entirely → note lost.
      setQuestionLastMtimeForTest(fileMtime);
    } else {
      // NEW (fixed) seed: questionLastMtime = 1 (sentinel < any real mtime).
      // First poll: mtime > 1 → TRUE; prev = 1 ≠ 0 → "skip initial read" guard
      // does NOT fire → note is processed.
      setQuestionLastMtimeForTest(1);
    }

    // ── Intercept console.log to detect processing ────────────────────────────
    const logLines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      const line = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
      logLines.push(line);
      originalLog(...args);
    };

    try {
      await checkLucaQuestion();
    } finally {
      console.log = originalLog;
    }

    // ── Assertions ─────────────────────────────────────────────────────────────
    const noteProcessed = logLines.some(l => l.includes('Luca open question saved'));

    if (isSelfCheck) {
      // Self-check: legacy seed → note must be silently dropped (not processed).
      if (!noteProcessed) {
        pass('Note was silently dropped with legacy seed — fix is load-bearing ✓');
      } else {
        fail('Note was processed even with legacy seed — self-check is unsound');
        failures++;
      }
    } else {
      // Normal mode: fixed seed → note must be processed.
      if (noteProcessed) {
        pass('Note was processed with fixed seed (1) — pre-restart notes survive server restarts ✓');
      } else {
        fail(
          'Note was NOT processed — startup guard is still silently dropping pre-restart notes.\n' +
          `  Captured logs:\n    ${logLines.join('\n    ') || '(none)'}`,
        );
        failures++;
      }
    }

  } catch (err: any) {
    fail('Unexpected error: ' + (err?.message ?? String(err)));
    failures++;
  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────────
    setQuestionPathOverrideForTest(null);
    setLucaPersonalSideEffectsEnabled(origSideEffects);
    setInnerLifeRollingEpisodeOverride(origEpisodeOver);
    setStartupGuardLegacySeedForTest(origLegacySeed);

    try { if (existsSync(TEMP_TRIGGER_PATH)) unlinkSync(TEMP_TRIGGER_PATH); } catch { /* ignore */ }
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

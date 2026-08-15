/**
 * test-stale-channel-boot-seed.ts
 *
 * CI check: confirms that seedStaleChannelAlertAtBoot() writes the stale-channel
 * alert file when either inner-life trigger file (`.luca_reflection` /
 * `.luca_question`) has a mtime ≥ 60 minutes old, and does NOT write the alert
 * when files are recent, absent, or when an alert already exists.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Rounds
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Round A — stale felt channel (mtime = 61 min ago):
 *     .luca_reflection mtime = now − 61 min  → stale
 *     .luca_question absent                  → never written (not stale)
 *     Expects: alert file WRITTEN, contains "⚠️ STALE ALERT"
 *
 *   Round B — recent felt channel (mtime = 59 min ago):
 *     .luca_reflection mtime = now − 59 min  → recent (below threshold)
 *     .luca_question absent
 *     Expects: alert file NOT written
 *
 *   Round C — both files absent:
 *     Neither trigger file exists
 *     Expects: alert file NOT written (channels never written = not stale)
 *
 *   Round D — existing alert file preserved:
 *     Alert file already present with sentinel content
 *     .luca_reflection mtime = now − 61 min  → stale (but alert already seeded)
 *     Expects: alert file content UNCHANGED (sentinel still there)
 *
 *   Round E — stale thinking channel only:
 *     .luca_question mtime = now − 61 min    → stale
 *     .luca_reflection absent
 *     Expects: alert file WRITTEN, contains "thinking"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Verifies server/index.ts contains the seedStaleChannelAlertAtBoot() call,
 *   proving the boot-seed is actually wired at server start, not just callable.
 *   Also shows the negative path (recent file → no alert) to prove the threshold
 *   gate is active.
 *
 * Run:
 *   npx tsx server/scripts/test-stale-channel-boot-seed.ts
 *   npx tsx server/scripts/test-stale-channel-boot-seed.ts --self-check
 */

import { existsSync, writeFileSync, unlinkSync, utimesSync, mkdirSync } from 'fs';
import { join }                                                           from 'path';
import { readFileSync }                                                   from 'fs';
import {
  seedStaleChannelAlertAtBoot,
  getStaleChannelAlertPath,
} from '../services/agent-session-autosave';

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE    = process.cwd();
const LOCAL_DIR    = join(WORKSPACE, '.local');
const REFLECT_PATH = join(LOCAL_DIR, '.luca_reflection');
const QUESTION_PATH = join(LOCAL_DIR, '.luca_question');
const ALERT_PATH   = getStaleChannelAlertPath();

const MIN          = 60_000;
const STALE_MS     = 61 * MIN;  // 61 min — clearly over the 60-min threshold
const RECENT_MS    = 59 * MIN;  // 59 min — just under the threshold

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── State counters ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Write a trigger file and set its mtime to `now - ageMs`. */
function seedTriggerFile(path: string, ageMs: number): void {
  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(path, `CI-TEST-${Date.now()}\n`, 'utf-8');
  const mtimeDate = new Date(Date.now() - ageMs);
  utimesSync(path, mtimeDate, mtimeDate);
}

/** Remove a file if it exists. */
function rmIfExists(path: string): void {
  if (existsSync(path)) unlinkSync(path);
}

/** Save and clear both trigger files; returns a restore function. */
function backupTriggerFiles(): () => void {
  const hadReflect = existsSync(REFLECT_PATH);
  const hadQuestion = existsSync(QUESTION_PATH);
  const reflectContent  = hadReflect  ? readFileSync(REFLECT_PATH, 'utf-8')  : null;
  const questionContent = hadQuestion ? readFileSync(QUESTION_PATH, 'utf-8') : null;

  rmIfExists(REFLECT_PATH);
  rmIfExists(QUESTION_PATH);

  return () => {
    rmIfExists(REFLECT_PATH);
    rmIfExists(QUESTION_PATH);
    if (reflectContent  !== null) writeFileSync(REFLECT_PATH,  reflectContent,  'utf-8');
    if (questionContent !== null) writeFileSync(QUESTION_PATH, questionContent, 'utf-8');
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Normal mode
// ─────────────────────────────────────────────────────────────────────────────

async function runNormalMode(): Promise<void> {
  const restore = backupTriggerFiles();

  try {
    // ── Round A: stale felt → alert written ─────────────────────────────────
    sep();
    console.log(B('Round A — stale felt channel (61 min old) → alert must be written'));
    sep();

    rmIfExists(ALERT_PATH);
    seedTriggerFile(REFLECT_PATH, STALE_MS);
    rmIfExists(QUESTION_PATH);

    seedStaleChannelAlertAtBoot();

    const alertA = existsSync(ALERT_PATH) ? readFileSync(ALERT_PATH, 'utf-8') : '';

    // The stale-channels summary line is: "**Inner-life channels silent for 60+ min: felt (last: ...)**"
    // The instruction line always mentions "thinking" as a channel name — check the summary line only.
    const summaryLineA = alertA.split('\n').find(l => l.includes('Inner-life channels silent'));

    assert('Round A: alert file created',                existsSync(ALERT_PATH));
    assert('Round A: alert contains ⚠️ STALE ALERT',    alertA.includes('⚠️ STALE ALERT'));
    assert('Round A: alert contains "felt" in summary',  (summaryLineA ?? '').includes('felt'));
    assert('Round A: alert contains "seeded at server boot"', alertA.includes('seeded at server boot'));
    assert('Round A: summary does NOT list "thinking" as stale', !(summaryLineA ?? '').includes('thinking'));

    // ── Round B: recent felt → no alert ─────────────────────────────────────
    sep();
    console.log(B('Round B — recent felt channel (59 min old) → no alert'));
    sep();

    rmIfExists(ALERT_PATH);
    seedTriggerFile(REFLECT_PATH, RECENT_MS);
    rmIfExists(QUESTION_PATH);

    seedStaleChannelAlertAtBoot();

    assert('Round B: alert file NOT created (below 60-min threshold)', !existsSync(ALERT_PATH));

    // ── Round C: both files absent → no alert ───────────────────────────────
    sep();
    console.log(B('Round C — no trigger files → no alert (channels never written)'));
    sep();

    rmIfExists(ALERT_PATH);
    rmIfExists(REFLECT_PATH);
    rmIfExists(QUESTION_PATH);

    seedStaleChannelAlertAtBoot();

    assert('Round C: alert file NOT created (channels never written)', !existsSync(ALERT_PATH));

    // ── Round D: existing alert preserved ───────────────────────────────────
    sep();
    console.log(B('Round D — existing alert file → seedStaleChannelAlertAtBoot leaves it untouched'));
    sep();

    const SENTINEL = `EXISTING-ALERT-SENTINEL-${Date.now()}`;
    writeFileSync(ALERT_PATH, SENTINEL, 'utf-8');
    seedTriggerFile(REFLECT_PATH, STALE_MS);

    seedStaleChannelAlertAtBoot();

    const alertD = existsSync(ALERT_PATH) ? readFileSync(ALERT_PATH, 'utf-8') : '';
    assert('Round D: alert file still exists',           existsSync(ALERT_PATH));
    assert('Round D: original sentinel preserved',       alertD === SENTINEL,
      `expected sentinel "${SENTINEL}", got "${alertD.slice(0, 60)}"`);

    rmIfExists(ALERT_PATH);

    // ── Round E: stale thinking → alert written ──────────────────────────────
    sep();
    console.log(B('Round E — stale thinking channel (61 min old) → alert must be written'));
    sep();

    rmIfExists(ALERT_PATH);
    rmIfExists(REFLECT_PATH);
    seedTriggerFile(QUESTION_PATH, STALE_MS);

    seedStaleChannelAlertAtBoot();

    const alertE = existsSync(ALERT_PATH) ? readFileSync(ALERT_PATH, 'utf-8') : '';
    assert('Round E: alert file created',                existsSync(ALERT_PATH));
    assert('Round E: alert contains "thinking"',         alertE.includes('thinking'));

    rmIfExists(ALERT_PATH);

  } finally {
    restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-check mode
// ─────────────────────────────────────────────────────────────────────────────

async function runSelfCheckMode(): Promise<void> {
  sep();
  console.log(B('SELF-CHECK — verifies the boot-seed is wired in server/index.ts'));
  sep();

  // ── Static check: server/index.ts must call seedStaleChannelAlertAtBoot ────
  const indexPath = join(WORKSPACE, 'server/index.ts');
  const indexSrc  = existsSync(indexPath) ? readFileSync(indexPath, 'utf-8') : '';

  assert(
    'server/index.ts imports seedStaleChannelAlertAtBoot',
    indexSrc.includes('seedStaleChannelAlertAtBoot'),
    'The boot-seed call is missing from server/index.ts — add it inside the server.listen() callback',
  );

  const callPattern = /seedStaleChannelAlertAtBoot\s*\(\s*\)/;
  assert(
    'server/index.ts actually invokes seedStaleChannelAlertAtBoot()',
    callPattern.test(indexSrc),
    'Found import but no call site — seedStaleChannelAlertAtBoot() must be called, not just imported',
  );

  // ── Negative path: recent file → no alert ──────────────────────────────────
  sep();
  console.log(B('SELF-CHECK negative path — recent file must NOT produce an alert'));
  sep();

  const restore = backupTriggerFiles();
  try {
    rmIfExists(ALERT_PATH);
    seedTriggerFile(REFLECT_PATH, RECENT_MS);  // 59 min — below threshold

    seedStaleChannelAlertAtBoot();

    assert(
      'Recent trigger file (59 min) does NOT produce an alert',
      !existsSync(ALERT_PATH),
      'Alert was written even though mtime is below the 60-min threshold — check the >= predicate',
    );

    // ── Positive path: stale file → alert ─────────────────────────────────────
    sep();
    console.log(B('SELF-CHECK positive path — stale file MUST produce an alert'));
    sep();

    rmIfExists(ALERT_PATH);
    seedTriggerFile(REFLECT_PATH, STALE_MS);   // 61 min — above threshold

    seedStaleChannelAlertAtBoot();

    assert(
      'Stale trigger file (61 min) DOES produce an alert',
      existsSync(ALERT_PATH),
      'Alert was not written even though mtime is ≥ 60-min threshold — the boot-seed is broken',
    );

    rmIfExists(ALERT_PATH);

  } finally {
    restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

const selfCheckMode = process.argv.includes('--self-check');

(async () => {
  try {
    if (selfCheckMode) {
      await runSelfCheckMode();
    } else {
      await runNormalMode();
    }
  } catch (err: any) {
    console.error(R('UNEXPECTED ERROR:'), err?.message ?? err);
    process.exit(1);
  }

  sep();
  if (failed === 0) {
    console.log(G(`✓  All ${passed} assertions passed.`));
    console.log(Y('   seedStaleChannelAlertAtBoot() writes the alert correctly at server boot.'));
  } else {
    console.log(R(`\n${failed}/${passed + failed} assertions FAILED ✗`));
  }

  process.exit(failed > 0 ? 1 : 0);
})();

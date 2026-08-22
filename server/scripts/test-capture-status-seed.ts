/**
 * test-capture-status-seed.ts
 *
 * CI check: confirms that seedCaptureStatusFromEpisodeFile() is wired into
 * startAgentSessionAutosave() AND that when it runs it sets _seededFromPriorSession
 * and writes the "previous round from prior session" label to the status file
 * before any live exchange has happened.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Two layers of protection
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Layer 1 — Source wiring check (catches deletion of the startup call):
 *   Reads agent-session-autosave.ts, extracts the startAgentSessionAutosave()
 *   function body, and asserts it contains the NEEDLE:
 *     seedCaptureStatusFromEpisodeFile().catch(
 *   Deleting that line from the source causes the check to fail immediately —
 *   no live execution required.
 *
 * Layer 2 — Seed output check (confirms the function itself works correctly):
 *   Calls seedCaptureStatusFromEpisodeFile() directly with a temporary episode
 *   file (snapshot/restored in finally) and asserts:
 *     - _seededFromPriorSession is true
 *     - status file contains "previous round from prior session"
 *     - felt/thinking channel labels reflect the episode file content
 *     - live-write race guard works (_liveWriteHasOccurred blocks the seed)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Layer 1 self-check: strips the NEEDLE from the in-memory source string (never
 *   modifies the file on disk) and asserts the wiring check would fail without it.
 *
 * Layer 2 self-check: resets state, does NOT call seed, writes the status file
 *   via forceWriteCaptureStatusForTest(), and asserts "previous round from prior
 *   session" is absent — proving the label only appears when the seed runs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixture safety
 * ─────────────────────────────────────────────────────────────────────────────
 *   The temp episode file is docs/episode-ci-seed-test.md.  Any pre-existing
 *   content is snapshotted before the test and restored byte-for-byte in finally.
 *   The capture status file is similarly snapshotted and restored.
 *
 * Run:
 *   npx tsx server/scripts/test-capture-status-seed.ts
 *   npx tsx server/scripts/test-capture-status-seed.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

import {
  seedCaptureStatusFromEpisodeFile,
  getSeededFromPriorSession,
  resetCaptureStatusSeedStateForTest,
  forceWriteCaptureStatusForTest,
  setPinnedRollingEpisodeFilename,
  setLiveWriteHasOccurredForTest,
} from '../services/agent-session-autosave';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE           = process.cwd();
const DOCS_DIR            = join(WORKSPACE, 'docs');
const LOCAL_DIR           = join(WORKSPACE, '.local');
const AUTOSAVE_SRC        = join(WORKSPACE, 'server', 'services', 'agent-session-autosave.ts');
const CAPTURE_STATUS_PATH = join(LOCAL_DIR, 'episode-capture-status.md');
const TEMP_EPISODE        = 'episode-ci-seed-test.md';
const TEMP_EPISODE_PATH   = join(DOCS_DIR, TEMP_EPISODE);

/**
 * The exact string that must be present inside startAgentSessionAutosave()'s body.
 * If this call is removed from startup, the source wiring check will fail.
 */
const STARTUP_WIRING_NEEDLE = 'seedCaptureStatusFromEpisodeFile().catch(';

// ── CLI ───────────────────────────────────────────────────────────────────────
const selfCheckMode = process.argv.includes('--self-check');

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

// ── File snapshot/restore helpers ─────────────────────────────────────────────

interface FileSnapshot { existed: boolean; content: string; }

function snapshotFile(path: string): FileSnapshot {
  if (!existsSync(path)) return { existed: false, content: '' };
  return { existed: true, content: readFileSync(path, 'utf-8') };
}

function restoreFile(path: string, snap: FileSnapshot, label: string): void {
  if (snap.existed) {
    writeFileSync(path, snap.content, 'utf-8');
    console.log(Y(`  ℹ  ${label} restored (${snap.content.length} chars)`));
  } else if (existsSync(path)) {
    unlinkSync(path);
    console.log(Y(`  ℹ  ${label} removed (was not present before test)`));
  }
}

// ── Temp episode file ─────────────────────────────────────────────────────────

function writeTempEpisode(withInnerLife: boolean): void {
  const lines = [
    '# Episode CI Seed Test — fixture only, not a real episode',
    '',
    'DAVID: Hello, this is a test exchange.',
    '',
    'LUCA [Replit]: Understood, this is a test.',
    '',
  ];
  if (withInnerLife) {
    lines.push('[Luca — felt: curious about the test]');
    lines.push('');
    lines.push('[Luca — thinking: how will this assertion resolve?]');
    lines.push('');
  }
  lines.push('DAVID: Another line for context.');
  lines.push('');
  lines.push('LUCA [Replit]: Noted.');
  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
  writeFileSync(TEMP_EPISODE_PATH, lines.join('\n'), 'utf-8');
}

// ── Source wiring check ───────────────────────────────────────────────────────

/**
 * Extract the body of startAgentSessionAutosave() from the source text.
 * Returns the slice from the opening brace to the matching closing brace.
 */
function extractStartupFunctionBody(source: string): string {
  const startIdx = source.indexOf('export function startAgentSessionAutosave()');
  if (startIdx === -1) return '';
  const braceIdx = source.indexOf('{', startIdx);
  if (braceIdx === -1) return '';
  let depth = 0;
  let i = braceIdx;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) break; }
  }
  return source.slice(braceIdx, i + 1);
}

function checkSourceWiring(source: string): boolean {
  const body = extractStartupFunctionBody(source);
  return body.includes(STARTUP_WIRING_NEEDLE);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (selfCheckMode) {
    console.log(B('\n══ Capture-Status Seed CI — Self-Check Mode ══'));
    console.log(Y('  Proves both guards detect their respective regressions\n'));
  } else {
    console.log(B('\n══ Capture-Status Seed CI — Normal Mode ══\n'));
  }

  const statusSnap  = snapshotFile(CAPTURE_STATUS_PATH);
  const episodeSnap = snapshotFile(TEMP_EPISODE_PATH);

  try {
    if (selfCheckMode) {
      await runSelfCheck();
    } else {
      await runNormalCheck();
    }
  } finally {
    setPinnedRollingEpisodeFilename(null);
    resetCaptureStatusSeedStateForTest();
    restoreFile(TEMP_EPISODE_PATH, episodeSnap, 'Temp episode file');
    restoreFile(CAPTURE_STATUS_PATH, statusSnap, 'Status file');
  }

  sep();
  if (failed === 0) {
    console.log(G(`\n  All ${passed} assertion(s) passed.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n  ${failed} assertion(s) FAILED (${passed} passed).\n`));
    process.exit(1);
  }
}

// ── Normal check ──────────────────────────────────────────────────────────────

async function runNormalCheck(): Promise<void> {
  // ── Layer 1: Source wiring ─────────────────────────────────────────────────
  sep();
  console.log('  Layer 1 — Source wiring check');
  console.log(`  Reads ${AUTOSAVE_SRC.replace(WORKSPACE + '/', '')}`);
  console.log(`  Asserts startAgentSessionAutosave() body contains NEEDLE:`);
  console.log(`    "${STARTUP_WIRING_NEEDLE}"\n`);

  assert(
    'agent-session-autosave.ts exists on disk',
    existsSync(AUTOSAVE_SRC),
    `Expected source file at ${AUTOSAVE_SRC}`
  );

  if (!existsSync(AUTOSAVE_SRC)) {
    console.log(R('  Cannot continue source check — file not found.'));
  } else {
    const source = readFileSync(AUTOSAVE_SRC, 'utf-8');

    const startupBody = extractStartupFunctionBody(source);
    assert(
      'startAgentSessionAutosave() body was located in source',
      startupBody.length > 0,
      'Could not find startAgentSessionAutosave() in the source file.'
    );

    assert(
      `NEEDLE "${STARTUP_WIRING_NEEDLE}" is present in startAgentSessionAutosave() body`,
      checkSourceWiring(source),
      `seedCaptureStatusFromEpisodeFile().catch( is missing from startAgentSessionAutosave().\n` +
      `  Deleting this call means capture status is never seeded at startup.`
    );
  }

  // ── Layer 2: Seed output ───────────────────────────────────────────────────
  sep();
  console.log('  Layer 2a — Seed output (episode WITH felt: and thinking:)');

  writeTempEpisode(/* withInnerLife= */ true);
  assert('Temp episode file exists on disk', existsSync(TEMP_EPISODE_PATH));

  setPinnedRollingEpisodeFilename(TEMP_EPISODE);
  resetCaptureStatusSeedStateForTest();
  assert('_seededFromPriorSession is false before seed', !getSeededFromPriorSession());

  await seedCaptureStatusFromEpisodeFile();

  assert('_seededFromPriorSession === true after seed', getSeededFromPriorSession(),
    'seedCaptureStatusFromEpisodeFile() did not set _seededFromPriorSession');

  const statusExists = existsSync(CAPTURE_STATUS_PATH);
  assert('Status file written after seed', statusExists,
    `Expected ${CAPTURE_STATUS_PATH}`);

  if (statusExists) {
    const content = readFileSync(CAPTURE_STATUS_PATH, 'utf-8');
    assert(
      'Status file contains "previous round from prior session" label',
      content.includes('previous round from prior session'),
      'The seeded status file should contain the prior-session ordering label.'
    );
    assert(
      'Status file contains "seeded from prior session" note',
      content.includes('seeded from prior session')
    );
    assert(
      'Status file references the pinned episode filename',
      content.includes(TEMP_EPISODE)
    );
    assert(
      'Felt channel listed as "present in prior session"',
      content.includes('📁  Felt:') && content.includes('present in prior session')
    );
    assert(
      'Thinking channel listed as "present in prior session"',
      content.includes('📁  Thinking:') && content.includes('present in prior session')
    );
  }

  // ── Layer 2b: Seed output (no inner-life markers) ─────────────────────────
  sep();
  console.log('  Layer 2b — Seed output (episode WITHOUT felt:/thinking:)');

  resetCaptureStatusSeedStateForTest();
  writeTempEpisode(/* withInnerLife= */ false);
  await seedCaptureStatusFromEpisodeFile();

  assert('_seededFromPriorSession true even with no inner-life markers', getSeededFromPriorSession());

  if (existsSync(CAPTURE_STATUS_PATH)) {
    const content2 = readFileSync(CAPTURE_STATUS_PATH, 'utf-8');
    assert(
      '"previous round from prior session" present even without felt:/thinking:',
      content2.includes('previous round from prior session')
    );
    assert(
      'Felt reported as "not found in prior session" when marker absent',
      content2.includes('📁  Felt:') && content2.includes('not found in prior session')
    );
  }

  // ── Layer 2c: Live-write race guard ────────────────────────────────────────
  sep();
  console.log('  Layer 2c — Live-write race guard');
  console.log('  Simulates: live writeCaptureStatus() fires BEFORE seed DB round-trip completes\n');

  resetCaptureStatusSeedStateForTest();
  writeTempEpisode(/* withInnerLife= */ true);
  // Set the monotonic live-write flag to true BEFORE calling the seed —
  // simulates a live exchange arriving while the DB round-trip was in flight.
  setLiveWriteHasOccurredForTest(true);
  await seedCaptureStatusFromEpisodeFile();

  assert(
    '_seededFromPriorSession stays false when live write already occurred',
    !getSeededFromPriorSession(),
    'The seed should abort without setting _seededFromPriorSession when _liveWriteHasOccurred is true.'
  );
}

// ── Self-check ────────────────────────────────────────────────────────────────

async function runSelfCheck(): Promise<void> {
  // ── Layer 1 self-check: strip NEEDLE from in-memory source ────────────────
  sep();
  console.log('  Layer 1 self-check — wiring detection');
  console.log('  Strips NEEDLE from in-memory source (file NOT modified on disk)\n');

  assert(
    'agent-session-autosave.ts exists on disk',
    existsSync(AUTOSAVE_SRC)
  );

  if (existsSync(AUTOSAVE_SRC)) {
    const realSource     = readFileSync(AUTOSAVE_SRC, 'utf-8');
    const mutatedSource  = realSource.replace(STARTUP_WIRING_NEEDLE, '/* NEEDLE-REMOVED-BY-SELFCHECK */');

    assert(
      'NEEDLE is present in real source (confirms self-check is testing a real regression)',
      checkSourceWiring(realSource),
      'The NEEDLE must be present in the real source for self-check to be meaningful.'
    );

    assert(
      'Source wiring check fails when NEEDLE is stripped (regression detectable)',
      !checkSourceWiring(mutatedSource),
      'The wiring check should return false when the startup call is absent from the source.'
    );

    console.log(G('\n  ✓ Layer 1 self-check: deleting the startup call IS caught by the source wiring check.'));
  }

  // ── Layer 2 self-check: status file lacks label when seed not called ───────
  sep();
  console.log('  Layer 2 self-check — output detection');
  console.log('  seed NOT called → "previous round from prior session" must be absent\n');

  writeTempEpisode(/* withInnerLife= */ true);
  assert('Temp episode file exists on disk', existsSync(TEMP_EPISODE_PATH));

  setPinnedRollingEpisodeFilename(TEMP_EPISODE);
  resetCaptureStatusSeedStateForTest();

  // Do NOT call seedCaptureStatusFromEpisodeFile() — simulating regression.
  forceWriteCaptureStatusForTest(TEMP_EPISODE);

  assert(
    '_seededFromPriorSession === false (seed never ran)',
    !getSeededFromPriorSession()
  );

  assert(
    'Status file written by forceWriteCaptureStatusForTest()',
    existsSync(CAPTURE_STATUS_PATH)
  );

  if (existsSync(CAPTURE_STATUS_PATH)) {
    const content = readFileSync(CAPTURE_STATUS_PATH, 'utf-8');
    assert(
      '"previous round from prior session" ABSENT when seed did not run',
      !content.includes('previous round from prior session'),
      'The label should be absent when _seededFromPriorSession is false.'
    );
    assert(
      '"seeded from prior session" ABSENT when seed did not run',
      !content.includes('seeded from prior session')
    );
    console.log(G('\n  ✓ Layer 2 self-check: the label check WOULD catch this regression.'));
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

main().catch((err: any) => {
  console.error(R(`\nFATAL: ${err?.message ?? err}`));
  console.error(err?.stack ?? '');
  process.exit(1);
});

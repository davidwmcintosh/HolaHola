/**
 * test-luca-reflection-episode.ts
 *
 * CI check: confirms that writing a reflection to .local/.luca_reflection
 * causes checkLucaReflection() to append a [Luca — felt: ...] entry to the
 * current rolling episode .md.
 *
 * Design notes
 * ─────────────────────────────────────────────────────────────────────────────
 * Two exported test seams gate the side-effects that would otherwise pollute
 * durable stores on every CI run:
 *
 *   setLucaPersonalSideEffectsEnabled(false)
 *     — skips appendToPersonalFile() and savePersonalMemory(), so no synthetic
 *       entries land in REFLECTIONS.md or the live DB.
 *
 *   setLucaEpisodeAppendEnabled(false)   [self-check only]
 *     — skips appendExchangeToEpisode(), simulating the removal of that call.
 *
 * The trigger file (.local/.luca_reflection) is snapshotted before the test
 * and restored byte-for-byte in finally — including the case where the file
 * did not exist before the test ran.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Queries DB for the currently-rolling episode (arc_name = 'HolaHola
 *      Episodes', 'rolling' in tags) to discover the target .md filename.
 *   2. Reads original .md content for restore in try/finally.
 *   3. Snapshots the trigger file state (exists + content).
 *   4. Disables personal side-effects to prevent REFLECTIONS.md / DB pollution.
 *   5. Writes a timestamped sentinel to .local/.luca_reflection.
 *   6. Primes the watcher mtime state (first call — prev===0, skips).
 *   7. Re-writes the sentinel with a fresh mtime.
 *   8. Calls checkLucaReflection() — processes trigger, appends to .md.
 *   9. Asserts "[Luca — felt: <sentinel>…]" appears in the episode .md.
 *  10. Cleans up: strips sentinel from .md, restores trigger file, re-enables
 *      personal side-effects.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the gate fails when the episode-append path is disabled (simulates
 *   removing the appendExchangeToEpisode() call from checkLucaReflection()):
 *   1. Disables both personal side-effects AND episode append.
 *   2. Primes mtime state, re-writes sentinel, calls checkLucaReflection().
 *   3. Asserts sentinel does NOT appear in .md (path was skipped).
 *   4. Restores trigger file, re-enables both seams.
 *
 * Run:
 *   npx tsx server/scripts/test-luca-reflection-episode.ts
 *   npx tsx server/scripts/test-luca-reflection-episode.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  checkLucaReflection,
  resetReflectionMtimeForTest,
  setLucaEpisodeAppendEnabled,
  getLucaEpisodeAppendEnabled,
  setLucaPersonalSideEffectsEnabled,
  getLucaPersonalSideEffectsEnabled,
} from '../services/agent-session-autosave';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE        = process.cwd();
const REFLECTION_PATH  = join(WORKSPACE, '.local', '.luca_reflection');
const DOCS_DIR         = join(WORKSPACE, 'docs');
const ARC_NAME         = 'HolaHola Episodes';

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Snapshot the trigger file before the test so we can restore it exactly. */
interface TriggerSnapshot {
  existed: boolean;
  content: string;
}
function snapshotTrigger(): TriggerSnapshot {
  if (!existsSync(REFLECTION_PATH)) return { existed: false, content: '' };
  return { existed: true, content: readFileSync(REFLECTION_PATH, 'utf-8') };
}
/** Restore the trigger file to exactly its pre-test state. */
function restoreTrigger(snap: TriggerSnapshot): void {
  if (snap.existed) {
    writeFileSync(REFLECTION_PATH, snap.content, 'utf-8');
  } else if (existsSync(REFLECTION_PATH)) {
    unlinkSync(REFLECTION_PATH);
  }
}

/**
 * Write payload to REFLECTION_PATH and spin until its mtime is strictly
 * newer than afterMs (or 2 s elapsed).  Guards against sub-ms filesystem
 * clock resolution on Linux.
 */
async function writeReflectionTrigger(payload: string, afterMs: number): Promise<number> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    writeFileSync(REFLECTION_PATH, payload, 'utf-8');
    const mtime = statSync(REFLECTION_PATH).mtimeMs;
    if (mtime > afterMs) return mtime;
    await sleep(5);
  }
  return statSync(REFLECTION_PATH).mtimeMs;
}

/**
 * Strip a [Luca — felt: <sentinelTitle>…] block appended by the check.
 * Only removes the exact block we added — never touches real episode content.
 */
function stripFeltSentinel(content: string, sentinelTitle: string): string {
  const escaped = sentinelTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Matches: \n?[Luca — felt: <title>\n<body>]\n?
  const re = new RegExp(`\\n?\\[Luca — felt: ${escaped}[^\\[]*?\\]\\n?`, 'gs');
  return content.replace(re, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Normal mode
// ─────────────────────────────────────────────────────────────────────────────

async function runNormalMode(): Promise<void> {
  sep();
  console.log(B('NORMAL MODE — Luca reflection → rolling episode .md check'));
  sep();

  const db = getSharedDb();

  // ── Step 0: Discover the rolling episode from DB ───────────────────────────
  const rollingRows = await db.execute(sql`
    SELECT id, title, tags
    FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const rollingRow = (rollingRows as any).rows?.[0] ?? (rollingRows as any)[0];

  assert(
    'Rolling episode DB row found',
    !!rollingRow,
    'No rolling episode in DB — cannot verify episode append',
  );
  if (!rollingRow) return;

  const rawTitle: string = rollingRow.title ?? '';
  // Derive filename: "Episode 28" → "episode-28.md"
  const m = /^Episode (\d+)$/i.exec(rawTitle);
  const episodeFilename: string = m
    ? `episode-${parseInt(m[1], 10)}.md`
    : rawTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';

  const mdPath = join(DOCS_DIR, episodeFilename);
  console.log(Y(`  ℹ  Rolling episode     : "${rawTitle}" (${episodeFilename})`));

  assert(
    `docs/${episodeFilename} exists on disk`,
    existsSync(mdPath),
    `File not found: ${mdPath}`,
  );
  if (!existsSync(mdPath)) return;

  const originalMd: string = readFileSync(mdPath, 'utf-8');
  console.log(Y(`  ℹ  Original .md size  : ${originalMd.length} chars`));

  // ── Unique sentinel ────────────────────────────────────────────────────────
  const sentinelTitle = `CI-REFLECTION-SENTINEL-${Date.now()}`;
  const sentinelBody  = 'This is a synthetic CI reflection — safe to ignore.';
  // Plain-text format: first line = title, rest = body
  const payload = `${sentinelTitle}\n${sentinelBody}`;

  // ── Snapshot trigger file BEFORE touching it ───────────────────────────────
  const triggerSnap = snapshotTrigger();
  console.log(Y(`  ℹ  Trigger file before : ${triggerSnap.existed ? `exists (${triggerSnap.content.length} chars)` : 'absent'}`));

  // Disable personal side-effects so no sentinel entries land in REFLECTIONS.md
  // or the live DB on each CI run.
  setLucaPersonalSideEffectsEnabled(false);
  console.log(Y(`  ℹ  Personal side-effects: disabled for this test`));

  try {
    sep();
    console.log(B('STEP 1 — Prime the watcher mtime state (first call skips — prev===0)'));
    sep();

    resetReflectionMtimeForTest();
    const mtime0 = await writeReflectionTrigger(payload, 0);
    console.log(Y(`  ℹ  Reflection trigger written (mtime0 = ${mtime0})`));

    // First call: prev === 0 → skips, stamps reflectionLastMtime = mtime0
    await checkLucaReflection();
    console.log(Y(`  ℹ  Prime call complete (mtime0 stamped)`));

    sep();
    console.log(B('STEP 2 — Re-write trigger with fresh mtime and process'));
    sep();

    const mtime1 = await writeReflectionTrigger(payload, mtime0);
    console.log(Y(`  ℹ  Trigger re-written (mtime1 = ${mtime1})`));
    assert(
      'Trigger mtime advanced (prerequisite for watcher detection)',
      mtime1 > mtime0,
      `mtime1 (${mtime1}) must be > mtime0 (${mtime0})`,
    );

    // Second call: prev = mtime0 ≠ 0 → processes reflection → appends to .md
    await checkLucaReflection();
    console.log(Y(`  ℹ  checkLucaReflection() processed the trigger`));

    sep();
    console.log(B('STEP 3 — Verify [Luca — felt: …] appears in episode .md tail'));
    sep();

    const mdAfter = existsSync(mdPath) ? readFileSync(mdPath, 'utf-8') : '';
    const feltNeedle = `[Luca — felt: ${sentinelTitle}`;
    assert(
      `"[Luca — felt: ${sentinelTitle.slice(0, 40)}…]" appears in ${episodeFilename}`,
      mdAfter.includes(feltNeedle),
      `Expected "[Luca — felt: ${sentinelTitle}…]" in .md — not found\n` +
      `       .md tail (last 300 chars): …${mdAfter.slice(-300).replace(/\n/g, '↵')}`,
    );
    console.log(Y(`  ℹ  .md size after append: ${mdAfter.length} chars (was ${originalMd.length})`));
    if (mdAfter.includes(feltNeedle)) {
      const idx = mdAfter.indexOf(feltNeedle);
      console.log(Y(`  ℹ  Entry at char ${idx}: ${mdAfter.slice(idx, idx + 80).replace(/\n/g, '↵')}`));
    }

  } finally {
    sep();
    console.log(B('STEP 4 — Restore all state (sentinel, trigger file, seams)'));
    sep();

    // Strip sentinel from .md (read CURRENT file to preserve any concurrent writes)
    try {
      if (existsSync(mdPath)) {
        const currentMd = readFileSync(mdPath, 'utf-8');
        const cleanedMd = stripFeltSentinel(currentMd, sentinelTitle);
        writeFileSync(mdPath, cleanedMd, 'utf-8');
        assert(
          'Sentinel stripped from .md (rolling content preserved)',
          !readFileSync(mdPath, 'utf-8').includes(sentinelTitle),
          '.md still contains sentinel title after cleanup',
        );
        console.log(Y(`  ℹ  .md after cleanup: ${cleanedMd.length} chars`));
      }
    } catch (err: any) {
      console.error(R(`  ✗  .md cleanup failed: ${err.message}`));
      failed++;
    }

    // Restore trigger file to exact pre-test state
    restoreTrigger(triggerSnap);
    console.log(Y(`  ℹ  Trigger file restored: ${triggerSnap.existed ? `${triggerSnap.content.length} chars` : 'deleted (was absent)'}`));

    // Re-enable personal side-effects
    setLucaPersonalSideEffectsEnabled(true);
    console.log(Y(`  ℹ  Personal side-effects: re-enabled`));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-check mode
// ─────────────────────────────────────────────────────────────────────────────

async function runSelfCheck(): Promise<void> {
  sep();
  console.log(B('SELF-CHECK MODE — verify gate fails when episode-append path is disabled'));
  sep();
  console.log(Y('  ℹ  Simulates removing appendExchangeToEpisode() from checkLucaReflection().'));
  console.log(Y('  ℹ  Sentinel must NOT appear in .md when the path is disabled.'));

  const db = getSharedDb();

  // Discover rolling episode
  const rollingRows = await db.execute(sql`
    SELECT id, title, tags
    FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const rollingRow = (rollingRows as any).rows?.[0] ?? (rollingRows as any)[0];

  assert(
    'Rolling episode DB row found',
    !!rollingRow,
    'No rolling episode — cannot run self-check',
  );
  if (!rollingRow) {
    if (failed > 0) process.exit(1);
    return;
  }

  const rawTitle: string = rollingRow.title ?? '';
  const m = /^Episode (\d+)$/i.exec(rawTitle);
  const episodeFilename: string = m
    ? `episode-${parseInt(m[1], 10)}.md`
    : rawTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';

  const mdPath = join(DOCS_DIR, episodeFilename);
  assert(
    `docs/${episodeFilename} exists on disk`,
    existsSync(mdPath),
    `File not found: ${mdPath}`,
  );
  if (!existsSync(mdPath)) {
    if (failed > 0) process.exit(1);
    return;
  }

  const originalMd = readFileSync(mdPath, 'utf-8');
  const sentinelTitle = `CI-SELF-CHECK-REFLECTION-${Date.now()}`;
  const sentinelBody  = 'Self-check synthetic reflection — should not appear in episode.';
  const payload = `${sentinelTitle}\n${sentinelBody}`;

  // Snapshot trigger file before touching it
  const triggerSnap = snapshotTrigger();
  console.log(Y(`  ℹ  Trigger file before : ${triggerSnap.existed ? `exists (${triggerSnap.content.length} chars)` : 'absent'}`));

  // Disable BOTH personal side-effects AND episode append path
  setLucaPersonalSideEffectsEnabled(false);
  setLucaEpisodeAppendEnabled(false);
  console.log(Y(`  ℹ  Personal side-effects: disabled`));
  console.log(Y(`  ℹ  Episode append       : disabled (simulates missing call)`));

  try {
    sep();
    console.log(B('STEP 1 — Prime mtime state'));
    sep();

    resetReflectionMtimeForTest();
    const mtime0 = await writeReflectionTrigger(payload, 0);
    console.log(Y(`  ℹ  Trigger written (mtime0 = ${mtime0})`));
    await checkLucaReflection();
    console.log(Y(`  ℹ  Prime call complete`));

    sep();
    console.log(B('STEP 2 — Re-write trigger and call checkLucaReflection() with episode-append disabled'));
    sep();

    const mtime1 = await writeReflectionTrigger(payload, mtime0);
    console.log(Y(`  ℹ  Trigger re-written (mtime1 = ${mtime1})`));
    assert(
      'Trigger mtime advanced (prerequisite)',
      mtime1 > mtime0,
      `mtime1 (${mtime1}) must be > mtime0 (${mtime0})`,
    );

    await checkLucaReflection();
    console.log(Y(`  ℹ  checkLucaReflection() called with episode-append disabled`));

    sep();
    console.log(B('STEP 3 — Assert [Luca — felt: …] does NOT appear in .md (gate held)'));
    sep();

    const mdAfter = existsSync(mdPath) ? readFileSync(mdPath, 'utf-8') : '';
    const feltNeedle = `[Luca — felt: ${sentinelTitle}`;

    const sentinelPresent = mdAfter.includes(feltNeedle);
    assert(
      `"[Luca — felt: ${sentinelTitle.slice(0, 40)}…]" correctly absent from ${episodeFilename}`,
      !sentinelPresent,
      'GATE BROKEN — sentinel appeared in .md even though episode-append path was disabled',
    );
    assert(
      '.md unchanged from original (no spurious writes)',
      mdAfter === originalMd,
      '.md was unexpectedly modified despite episode-append being disabled',
    );

    sep();
    console.log(B('STEP 4 — Confirm normal-mode check would fail in this scenario (gate is sound)'));
    sep();

    // Normal mode asserts sentinel IS present.  Since it is absent, normal mode would fail.
    assert(
      'Normal-mode "appears in .md" assertion would fail when path is disabled',
      !sentinelPresent,
      'Sentinel absent confirms the normal-mode check would have caught the regression.',
    );

  } finally {
    // Re-enable both seams unconditionally
    setLucaPersonalSideEffectsEnabled(true);
    setLucaEpisodeAppendEnabled(true);
    console.log(Y('\n  ℹ  Personal side-effects: re-enabled'));
    console.log(Y('  ℹ  Episode append       : re-enabled'));

    // Restore trigger file to exact pre-test state
    restoreTrigger(triggerSnap);
    console.log(Y(`  ℹ  Trigger file restored: ${triggerSnap.existed ? `${triggerSnap.content.length} chars` : 'deleted (was absent)'}`));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (selfCheckMode) {
    await runSelfCheck();
  } else {
    await runNormalMode();
  }

  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`\nAll ${total} checks passed ✓`));
  } else {
    console.log(R(`\n${failed}/${total} checks FAILED ✗`));
  }
  sep();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(R('\nFATAL:'), err);
  process.exit(1);
});

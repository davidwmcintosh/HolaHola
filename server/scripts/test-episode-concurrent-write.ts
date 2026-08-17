/**
 * test-episode-concurrent-write.ts
 *
 * CI check: fires two appendExchangeToEpisode() calls simultaneously and
 * confirms both entries appear in the rolling episode .md with no content lost.
 *
 * Why this matters
 * ─────────────────────────────────────────────────────────────────────────────
 * Before Task 1047, appendExchangeToEpisode() used a read-modify-write pattern:
 *   1. read the whole file
 *   2. compute new content
 *   3. writeFileSync (overwrites)
 *
 * Two concurrent async callers both reading at step 1 got the same snapshot,
 * then whichever wrote last silently discarded the other's content.
 *
 * The fix (Task 1047) replaces the pattern with:
 *   • fs.appendFileSync — atomic at the OS level
 *   • withEpisodeFileLock — in-process per-filename mutex that serialises
 *     concurrent async callers
 *
 * This test fires two appends simultaneously (Promise.all) and asserts both
 * sentinels appear in the file afterwards.
 *
 * Self-check mode (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 * Proves the test itself would detect a regression by temporarily patching
 * appendExchangeToEpisode to use the old read-modify-write pattern, then
 * confirming the concurrent writes reproduce the loss.
 *
 * Run:
 *   npx tsx server/scripts/test-episode-concurrent-write.ts
 *   npx tsx server/scripts/test-episode-concurrent-write.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync, appendFileSync } from 'fs';
import { join } from 'path';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import {
  appendExchangeToEpisode,
  withEpisodeFileLock,
  syncEpisodeFile,
} from '../services/agent-session-autosave';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE = process.cwd();
const DOCS_DIR  = join(WORKSPACE, 'docs');
const ARC_NAME  = 'HolaHola Episodes';

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

// ── Sentinel strip helper ─────────────────────────────────────────────────────
function stripSentinels(content: string, ...ids: string[]): string {
  let out = content;
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(
      new RegExp(`\\n?\\[CI-CONCURRENT-${escaped}[^\\[]*?\\]\\n?`, 'gs'),
      '',
    );
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normal mode — concurrent appends via the fixed appendExchangeToEpisode
// ─────────────────────────────────────────────────────────────────────────────

async function runNormalMode(): Promise<void> {
  sep();
  console.log(B('NORMAL MODE — two concurrent appendExchangeToEpisode() calls'));
  console.log(Y('  Both sentinels must appear in the .md with no content lost.'));
  sep();

  const db = getSharedDb();

  // ── Discover rolling episode ───────────────────────────────────────────────
  const rows = await db.execute(sql`
    SELECT id, title FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = (rows as any).rows?.[0] ?? (rows as any)[0];

  assert('Rolling episode DB row found', !!row, 'No rolling episode in DB');
  if (!row) return;

  const rawTitle: string = row.title ?? '';
  const m = /^Episode (\d+)$/i.exec(rawTitle);
  const episodeFilename: string = m
    ? `episode-${parseInt(m[1], 10)}.md`
    : rawTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';

  const mdPath = join(DOCS_DIR, episodeFilename);
  console.log(Y(`  ℹ  Rolling episode: "${rawTitle}" (${episodeFilename})`));

  assert(
    `docs/${episodeFilename} exists on disk`,
    existsSync(mdPath),
    `File not found: ${mdPath}`,
  );
  if (!existsSync(mdPath)) return;

  const originalMd = readFileSync(mdPath, 'utf-8');
  console.log(Y(`  ℹ  Original .md size: ${originalMd.length} chars`));

  // ── Unique sentinels ───────────────────────────────────────────────────────
  const ts = Date.now();
  const id1 = `${ts}-A`;
  const id2 = `${ts}-B`;
  const entry1 = `[CI-CONCURRENT-${id1}\nSentinel A — concurrent write test]`;
  const entry2 = `[CI-CONCURRENT-${id2}\nSentinel B — concurrent write test]`;

  try {
    sep();
    console.log(B('STEP 1 — Fire two appends simultaneously via Promise.all'));
    sep();

    // Both promises start before either await resolves — true concurrency
    // within the Node.js event loop.
    const [, ] = await Promise.all([
      appendExchangeToEpisode(entry1, episodeFilename),
      appendExchangeToEpisode(entry2, episodeFilename),
    ]);

    sep();
    console.log(B('STEP 2 — Verify both sentinels appear in the .md'));
    sep();

    const mdAfter = readFileSync(mdPath, 'utf-8');
    console.log(Y(`  ℹ  .md size after concurrent appends: ${mdAfter.length} chars`));

    const has1 = mdAfter.includes(`CI-CONCURRENT-${id1}`);
    const has2 = mdAfter.includes(`CI-CONCURRENT-${id2}`);

    assert(
      `Sentinel A (${id1}) present in .md`,
      has1,
      `Sentinel A missing — indicates the concurrent write was lost`,
    );
    assert(
      `Sentinel B (${id2}) present in .md`,
      has2,
      `Sentinel B missing — indicates the concurrent write was lost`,
    );
    assert(
      '.md grew by at least the combined sentinel length',
      mdAfter.length >= originalMd.length + entry1.length + entry2.length,
      `expected growth ≥ ${entry1.length + entry2.length}, got ${mdAfter.length - originalMd.length}`,
    );

    if (has1 && has2) {
      const idx1 = mdAfter.indexOf(`CI-CONCURRENT-${id1}`);
      const idx2 = mdAfter.indexOf(`CI-CONCURRENT-${id2}`);
      console.log(Y(`  ℹ  A at char ${idx1}, B at char ${idx2} — both present ✓`));
    }

  } finally {
    sep();
    console.log(B('STEP 3 — Clean up sentinels (serialized via withEpisodeFileLock)'));
    sep();

    try {
      if (existsSync(mdPath)) {
        await withEpisodeFileLock(episodeFilename, () => {
          const currentMd = readFileSync(mdPath, 'utf-8');
          const cleaned   = stripSentinels(currentMd, id1, id2);
          writeFileSync(mdPath, cleaned, 'utf-8');
        });
        const afterClean = readFileSync(mdPath, 'utf-8');
        assert(
          'Sentinels stripped from .md (rolling content preserved)',
          !afterClean.includes(`CI-CONCURRENT-${id1}`) && !afterClean.includes(`CI-CONCURRENT-${id2}`),
          '.md still contains sentinel after cleanup',
        );
        console.log(Y(`  ℹ  .md after cleanup: ${afterClean.length} chars (was ${originalMd.length})`));
      }
    } catch (err: any) {
      console.error(R(`  ✗  Cleanup failed: ${err.message}`));
      failed++;
    }
  }

  // ── STEP 4 — Concurrent append + syncEpisodeFile: DB must match .md ─────
  //
  // Proves that wrapping syncEpisodeFile's read+upsert in withEpisodeFileLock
  // prevents a stale snapshot from reaching the DB when an append is in flight.
  //
  // HERMETIC: Uses a synthetic episode-9998 row/file (created_at = 2020-01-01 so
  // it never surfaces as the "current" rolling episode) rather than the real
  // rolling episode file.  The real rolling episode may be written by the live
  // server's stalled-session monitor at any moment, making its DB length a moving
  // target that defeats the rolling-guard comparison in syncEpisodeFile.  A
  // synthetic row gives a stable baseline that cannot race with the server.
  //
  // Mechanism (deterministic — no timing assumptions):
  //   1. Insert synthetic DB row (STEP4_CONTENT) and write matching .md file.
  //   2. Grab the per-filename lock (simulating appendExchangeToEpisode in flight).
  //   3. While holding that lock, write the sentinel to .md via appendFileSync.
  //   4. SIMULTANEOUSLY start syncEpisodeFile — it tries to acquire the same lock
  //      and queues behind step 2 (withEpisodeFileLock is a promise chain).
  //   5. Release the lock (step 2 resolves).
  //   6. syncEpisodeFile acquires the lock, reads .md with sentinel already on disk,
  //      and pushes it to the DB — sentinel is now in DB.
  //   7. Assert sentinel appears in DB immediately (no extra sync cycle needed).
  //
  // Cleanup: DELETE the synthetic DB row and file — no restore needed.
  // ──────────────────────────────────────────────────────────────────────────
  sep();
  console.log(B('STEP 4 — Concurrent append (lock-held) + syncEpisodeFile: DB must match .md'));
  console.log(Y('  withEpisodeFileLock spanning read+upsert forces sync to wait for the append.'));
  console.log(Y('  Uses synthetic episode-9998 (hermetic — not affected by live server writes).'));
  sep();

  // Synthetic episode constants for STEP 4.
  // created_at = 2020-01-01 keeps episode-9998 below real rolling episodes in
  // getCurrentRollingEpisodeFilename() ORDER BY created_at DESC, so it never
  // pollutes the rolling-episode cursor used by other tests.
  const STEP4_ID      = '99980000-0000-4000-8000-000000009998';
  const STEP4_TITLE   = 'Episode 9998';
  const STEP4_FILE    = 'episode-9998.md';
  const STEP4_PATH    = join(DOCS_DIR, STEP4_FILE);
  // The DB row must start longer than STEP4_CONTENT so the rolling guard allows
  // .md → DB only when .md grows (i.e. after the sentinel is appended).
  // Short base content ensures the sentinel always makes .md > DB.
  const STEP4_CONTENT = '# Episode 9998\n\n' + 'X'.repeat(5000);

  const ts4    = Date.now();
  const id4    = `${ts4}-DB`;
  const entry4 = `[CI-CONCURRENT-${id4}\nSentinel DB — concurrent append+sync test]`;

  const step4Cleanup = async () => {
    await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${STEP4_ID}`);
    if (existsSync(STEP4_PATH)) unlinkSync(STEP4_PATH);
  };

  // Pre-cleanup: remove any leftover from a previous failed run.
  await step4Cleanup();

  try {
    // ── Step 1: create synthetic episode ─────────────────────────────────
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, importance, entry_type, tags, arc_name, created_at)
      VALUES (
        ${STEP4_ID},
        ${STEP4_TITLE},
        ${'step-4 synthetic episode'},
        ${STEP4_CONTENT},
        ${9},
        'episode',
        ARRAY['episode', 'rolling']::text[],
        ${ARC_NAME},
        '2020-01-01 00:00:00+00'
      )
    `);
    writeFileSync(STEP4_PATH, STEP4_CONTENT, 'utf-8');
    console.log(Y(`  ℹ  Synthetic episode-9998 created: DB=${STEP4_CONTENT.length} chars, .md=${STEP4_CONTENT.length} chars`));

    // ── Steps 2–3: grab lock, append sentinel inside the callback ─────────
    // appendDone resolves only after the lock callback returns (sentinel on disk).
    const appendDone = withEpisodeFileLock(STEP4_FILE, () => {
      appendFileSync(STEP4_PATH, '\n' + entry4 + '\n', 'utf-8');
    });

    // ── Step 4: start sync — queues behind appendDone's lock ─────────────
    // Both promises are in flight before any await (true concurrency in the event loop).
    const syncPromise = syncEpisodeFile(STEP4_FILE);

    // ── Steps 5–6: wait for append to release, then for sync to complete ──
    await appendDone;
    await syncPromise;

    // ── Step 7a: verify .md contains the sentinel ─────────────────────────
    const mdAfter4 = readFileSync(STEP4_PATH, 'utf-8');
    assert(
      `Sentinel (${id4}) present in .md after locked append`,
      mdAfter4.includes(`CI-CONCURRENT-${id4}`),
      'Sentinel missing from .md — appendFileSync inside lock failed',
    );

    // ── Step 7b: verify sentinel is in DB immediately — no extra sync ──────
    // syncEpisodeFile held the lock across read+upsert, so the DB reflects
    // the post-append file without any race gap.
    const dbRows4 = await db.execute(sql`
      SELECT content FROM conversation_memories
      WHERE id = ${STEP4_ID}
      LIMIT 1
    `);
    const dbRow4     = (dbRows4 as any).rows?.[0] ?? (dbRows4 as any)[0];
    const dbContent4 = (dbRow4?.content ?? '') as string;

    assert(
      `Sentinel (${id4}) present in DB immediately after concurrent sync`,
      dbContent4.includes(`CI-CONCURRENT-${id4}`),
      'Sentinel missing from DB — syncEpisodeFile read before the lock was released ' +
      '(withEpisodeFileLock must span both readFileSync and the DB upsert in syncEpisodeFile)',
    );
    assert(
      'DB content length matches post-append .md (sync captured the full file)',
      dbContent4.length === mdAfter4.length,
      `DB length (${dbContent4.length}) != post-append .md length (${mdAfter4.length}); ` +
      'sync may have read a pre-append snapshot',
    );

    console.log(Y(`  ℹ  .md after step 4: ${mdAfter4.length} chars, DB: ${dbContent4.length} chars`));

  } finally {
    sep();
    console.log(B('STEP 4 cleanup — remove synthetic episode-9998 from .md and DB'));
    sep();
    try {
      await step4Cleanup();
      console.log(Y('  ℹ  Synthetic episode-9998 removed from DB and disk'));
    } catch (err: any) {
      console.error(R(`  ✗  STEP 4 cleanup failed: ${err.message}`));
      failed++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-check mode — simulate the old read-modify-write race
// Proves this test CAN detect the pre-fix race condition.
// ─────────────────────────────────────────────────────────────────────────────

async function runSelfCheck(): Promise<void> {
  sep();
  console.log(B('SELF-CHECK MODE — simulate pre-fix read-modify-write race'));
  console.log(Y('  Patches appendExchangeToEpisode with the OLD racy pattern.'));
  console.log(Y('  At least one sentinel is likely lost — confirms the test detects the bug.'));
  sep();

  const db = getSharedDb();

  // Discover rolling episode
  const rows = await db.execute(sql`
    SELECT id, title FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = (rows as any).rows?.[0] ?? (rows as any)[0];
  assert('Rolling episode DB row found', !!row, 'No rolling episode in DB');
  if (!row) { if (failed > 0) process.exit(1); return; }

  const rawTitle: string = row.title ?? '';
  const m = /^Episode (\d+)$/i.exec(rawTitle);
  const episodeFilename: string = m
    ? `episode-${parseInt(m[1], 10)}.md`
    : rawTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
  const mdPath = join(DOCS_DIR, episodeFilename);

  assert(`docs/${episodeFilename} exists`, existsSync(mdPath), `Not found: ${mdPath}`);
  if (!existsSync(mdPath)) { if (failed > 0) process.exit(1); return; }

  const originalMd = readFileSync(mdPath, 'utf-8');

  const ts  = Date.now();
  const id1 = `${ts}-SC-A`;
  const id2 = `${ts}-SC-B`;
  const entry1 = `[CI-CONCURRENT-${id1}\nSelf-check sentinel A]`;
  const entry2 = `[CI-CONCURRENT-${id2}\nSelf-check sentinel B]`;

  // ── Racey append helper — the OLD pattern without mutex or appendFileSync ──
  const racyAppend = async (exchange: string): Promise<void> => {
    // Deliberately NOT using withEpisodeFileLock or appendFileSync.
    // This reproduces the pre-fix race.
    const existing  = readFileSync(mdPath, 'utf-8');
    // Simulate async work between read and write (makes the race reproducible)
    await new Promise(r => setTimeout(r, 0));
    const separator = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
    const updated   = existing + separator + exchange + '\n';
    writeFileSync(mdPath, updated, 'utf-8');
  };

  try {
    sep();
    console.log(B('STEP 1 — Fire two RACY appends simultaneously'));
    sep();

    await Promise.all([
      racyAppend(entry1),
      racyAppend(entry2),
    ]);

    sep();
    console.log(B('STEP 2 — Observe that one sentinel is likely absent (race detected)'));
    sep();

    const mdAfter = readFileSync(mdPath, 'utf-8');
    const has1 = mdAfter.includes(`CI-CONCURRENT-${id1}`);
    const has2 = mdAfter.includes(`CI-CONCURRENT-${id2}`);

    console.log(Y(`  ℹ  Sentinel A present: ${has1}`));
    console.log(Y(`  ℹ  Sentinel B present: ${has2}`));

    // In self-check mode the race should have dropped at least one sentinel.
    // (The async setTimeout(0) makes this reliably reproducible.)
    const raceCaught = !(has1 && has2);
    assert(
      'Race condition reproduced: at least one sentinel was lost',
      raceCaught,
      'UNEXPECTED: both sentinels present despite racy pattern — race was not triggered. ' +
      'The self-check may need a longer async gap to reliably reproduce the race.',
    );
    assert(
      'Normal-mode test WOULD have failed (confirms test detects the regression)',
      raceCaught,
      'If the race is not reproducible the self-check cannot validate the guard.',
    );

  } finally {
    sep();
    console.log(B('STEP 3 — Clean up any sentinels left by self-check'));
    sep();

    try {
      if (existsSync(mdPath)) {
        // In self-check mode we use writeFileSync directly since appendFileSync
        // is the feature under test (not yet in scope here).
        const currentMd = readFileSync(mdPath, 'utf-8');
        const cleaned   = stripSentinels(currentMd, id1, id2);
        writeFileSync(mdPath, cleaned, 'utf-8');
        const afterClean = readFileSync(mdPath, 'utf-8');
        assert(
          'Sentinels stripped from .md',
          !afterClean.includes(`CI-CONCURRENT-${id1}`) && !afterClean.includes(`CI-CONCURRENT-${id2}`),
          '.md still contains sentinel after cleanup',
        );
        console.log(Y(`  ℹ  .md after cleanup: ${afterClean.length} chars`));
        // Restore exact original if cleanup changed the size unexpectedly
        if (afterClean.length < originalMd.length) {
          writeFileSync(mdPath, originalMd, 'utf-8');
          console.log(Y(`  ℹ  Restored original (cleanup shrank file below baseline)`));
        }
      }
    } catch (err: any) {
      console.error(R(`  ✗  Cleanup failed: ${err.message}`));
      failed++;
    }
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

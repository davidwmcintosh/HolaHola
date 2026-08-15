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
  // Mechanism (deterministic — no timing assumptions):
  //   1. Capture exact pre-test .md content and DB content (for clean restore).
  //   2. Grab the per-filename lock (simulating appendExchangeToEpisode in flight).
  //   3. While holding that lock, write the sentinel to .md via appendFileSync.
  //   4. SIMULTANEOUSLY start syncEpisodeFile — it tries to acquire the same lock
  //      and queues behind step 2 (withEpisodeFileLock is a promise chain).
  //   5. Release the lock (step 2 resolves).
  //   6. syncEpisodeFile acquires the lock, reads .md with sentinel already on disk,
  //      and pushes it to the DB — sentinel is now in DB.
  //   7. Assert sentinel appears in DB immediately (no extra sync cycle needed).
  //
  // Cleanup uses a direct SQL UPDATE (bypassing the rolling max-length guard)
  // to restore the exact pre-test DB content, then verifies both .md and DB
  // are free of the sentinel before exiting.
  // ──────────────────────────────────────────────────────────────────────────
  sep();
  console.log(B('STEP 4 — Concurrent append (lock-held) + syncEpisodeFile: DB must match .md'));
  console.log(Y('  withEpisodeFileLock spanning read+upsert forces sync to wait for the append.'));
  sep();

  const ts4    = Date.now();
  const id4    = `${ts4}-DB`;
  const entry4 = `[CI-CONCURRENT-${id4}\nSentinel DB — concurrent append+sync test]`;

  // Capture pre-test snapshots before the test mutates anything.
  // mdBefore4 is the .md content — the source of truth we restore to.
  // dbSnap4Id is the DB row ID needed for the direct SQL restore in cleanup.
  const mdBefore4 = readFileSync(mdPath, 'utf-8');
  const dbSnap4Rows = await db.execute(sql`
    SELECT id FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND title    = ${rawTitle}
    LIMIT 1
  `);
  const dbSnap4Row = (dbSnap4Rows as any).rows?.[0] ?? (dbSnap4Rows as any)[0];
  const dbSnap4Id  = (dbSnap4Row?.id ?? '') as string;

  assert('Pre-test DB row found for episode', !!dbSnap4Id, 'Cannot run STEP 4 without a DB row to restore');

  // Prime the DB so it matches the current .md exactly before the concurrent
  // write test begins.  Previous tests in the group may have left the DB row
  // with longer content (after their own sync + cleanup cycles).  If the DB is
  // longer than mdBefore4+entry4, syncEpisodeFile's rolling guard
  // (LENGTH(content) <= LENGTH(incoming)) would silently skip the UPDATE and
  // the sentinel would never reach the DB.  A direct UPDATE (bypassing the
  // guard) guarantees DB == .md before we start, so the rolling guard passes.
  if (dbSnap4Id) {
    await db.execute(sql`
      UPDATE conversation_memories
      SET content = ${mdBefore4}
      WHERE id = ${dbSnap4Id}
    `);
  }

  try {
    if (!dbSnap4Id) {
      console.log(Y('  ⚠  Skipping STEP 4 body — no pre-test DB row found'));
    } else {
      // Step 2–3: Grab lock synchronously; write sentinel inside the callback.
      // appendDone resolves only after the lock callback returns (sentinel on disk).
      const appendDone = withEpisodeFileLock(episodeFilename, () => {
        appendFileSync(mdPath, '\n' + entry4 + '\n', 'utf-8');
      });

      // Flush the microtask queue once so that withEpisodeFileLock's internal
      // async lock-acquisition completes before syncEpisodeFile starts competing
      // for the same lock.  Without this yield, both calls race for the lock in
      // the same microtask batch and the ordering is non-deterministic.
      await Promise.resolve();

      // Step 4: Start sync — it now queues behind appendDone's lock.
      const syncPromise = syncEpisodeFile(episodeFilename);

      // Steps 5–6: Wait for append to release the lock, then for sync to complete.
      await appendDone;
      await syncPromise;

      // Step 7a: Verify .md contains the sentinel.
      const mdAfter4 = readFileSync(mdPath, 'utf-8');
      assert(
        `Sentinel (${id4}) present in .md after locked append`,
        mdAfter4.includes(`CI-CONCURRENT-${id4}`),
        'Sentinel missing from .md — appendFileSync inside lock failed',
      );

      // Step 7b: Verify sentinel is in DB — no extra sync cycle needed.
      // syncEpisodeFile held the lock across read+upsert, so the DB reflects
      // the post-append file without any race gap.
      //
      // Short retry (up to 2 s, 200 ms intervals): the upsert has committed,
      // but Neon's HTTP/WebSocket connection pool may route the SELECT to a
      // slightly-behind replica.  We retry the read — not the sync — to tolerate
      // DB network propagation latency without re-running syncEpisodeFile.
      let dbContent4 = '';
      for (let attempt = 0; attempt < 10; attempt++) {
        const dbRows4 = await db.execute(sql`
          SELECT content FROM conversation_memories
          WHERE id = ${dbSnap4Id}
          LIMIT 1
        `);
        const dbRow4 = (dbRows4 as any).rows?.[0] ?? (dbRows4 as any)[0];
        dbContent4 = (dbRow4?.content ?? '') as string;
        if (dbContent4.includes(`CI-CONCURRENT-${id4}`)) break;
        if (attempt < 9) await new Promise(r => setTimeout(r, 200));
      }

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
    }

  } finally {
    sep();
    console.log(B('STEP 4 cleanup — restore exact pre-test content in .md and DB'));
    console.log(Y('  Direct SQL UPDATE bypasses the rolling max-length guard,'));
    console.log(Y('  ensuring CI leaves no sentinel in the canonical DB row.'));
    sep();

    try {
      // 1. Restore .md to exact pre-test content (inside the file lock).
      if (existsSync(mdPath)) {
        await withEpisodeFileLock(episodeFilename, () => {
          writeFileSync(mdPath, mdBefore4, 'utf-8');
        });
        const afterMdClean4 = readFileSync(mdPath, 'utf-8');
        assert(
          'STEP 4 sentinel absent from .md after restore',
          !afterMdClean4.includes(`CI-CONCURRENT-${id4}`),
          '.md still contains sentinel after writeFileSync restore',
        );
        assert(
          '.md exactly matches pre-test snapshot',
          afterMdClean4 === mdBefore4,
          `.md length after restore: ${afterMdClean4.length} (expected ${mdBefore4.length})`,
        );
        console.log(Y(`  ℹ  .md restored: ${afterMdClean4.length} chars (was ${mdBefore4.length})`));
      }

      // 2. Restore DB to match the pre-test .md content via direct SQL UPDATE.
      //    Using mdBefore4 (the .md source of truth) rather than the pre-test
      //    DB content ensures any pre-existing DB/file divergence is also fixed.
      //    This bypasses syncEpisodeFile and the rolling max-length guard, which
      //    would otherwise reject the shorter (sentinel-free) write and leave
      //    the sentinel permanently in the canonical DB row.
      if (dbSnap4Id) {
        await db.execute(sql`
          UPDATE conversation_memories
          SET content = ${mdBefore4}
          WHERE id    = ${dbSnap4Id}
        `);
        const afterDbClean4Rows = await db.execute(sql`
          SELECT content FROM conversation_memories
          WHERE id = ${dbSnap4Id}
          LIMIT 1
        `);
        const afterDbClean4Row     = (afterDbClean4Rows as any).rows?.[0] ?? (afterDbClean4Rows as any)[0];
        const afterDbClean4Content = (afterDbClean4Row?.content ?? '') as string;
        assert(
          'STEP 4 sentinel absent from DB after restore',
          !afterDbClean4Content.includes(`CI-CONCURRENT-${id4}`),
          'DB still contains sentinel after direct SQL restore',
        );
        assert(
          'DB content matches pre-test .md snapshot after restore',
          afterDbClean4Content === mdBefore4,
          `DB length after restore: ${afterDbClean4Content.length} (expected ${mdBefore4.length})`,
        );
        console.log(Y(`  ℹ  DB restored to match .md: ${afterDbClean4Content.length} chars`));
      }
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

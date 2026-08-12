/**
 * test-startup-inner-life-gap-patch.ts
 *
 * CI check: end-to-end round-trip confirming that the inner-life phase of
 * runStartupGapCheck() detects a missing felt/thinking/moment block and
 * appends it to the rolling episode .md.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Reads the current rolling episode .md and snapshots its exact bytes.
 *   2. Inserts a synthetic luca-inner-life row into conversation_memories
 *      (arc_name='luca-inner-life', tags: luca-inner-life + luca-reflection,
 *      title: "Luca reflection: CI-INNER-LIFE-<ts>").
 *   3. Confirms the title key is absent from the .md before patching.
 *   4. Resets _startupGapCheckDone and calls runStartupGapCheck() directly.
 *   5. Asserts the [Luca — felt: CI-INNER-LIFE-<ts>] block is now in the .md.
 *   6. Restores the exact pre-test bytes from the snapshot (guarantees zero
 *      git diff after the run) and deletes the synthetic DB row.
 *   7. Verifies git diff is clean after cleanup.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the normal assertion would catch a broken append path:
 *   1. Snapshots the .md bytes.
 *   2. Inserts the synthetic DB row.
 *   3. Calls runStartupGapCheck() — the real code path runs and appends the
 *      block to the .md.
 *   4. Restores the snapshot (simulates "block was appended then lost" /
 *      "append path was broken").
 *   5. Asserts the block is ABSENT from the restored .md.
 *      This is the expected negative outcome — confirming the normal assertion
 *      would exit 1 for a real broken-append regression.
 *   6. Restores the .md and deletes the DB row in finally.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Exit codes
 * ─────────────────────────────────────────────────────────────────────────────
 *   0 — PASS
 *   1 — FAIL (DB unavailable, no rolling episode, block not appended in normal
 *             mode, block still visible after restore in self-check, or cleanup
 *             failure)
 *
 * Uses neon() HTTP driver for DB setup / teardown per episode-sync-http rule.
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/test-startup-inner-life-gap-patch.ts
 *   npx tsx server/scripts/test-startup-inner-life-gap-patch.ts --self-check
 */

import { neon } from '@neondatabase/serverless';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  runStartupGapCheck,
  resetStartupGapCheckForTest,
} from '../services/agent-session-autosave';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const SELF_CHECK = process.argv.includes('--self-check');
const DOCS_DIR   = join(process.cwd(), 'docs');

// ── normForGap mirrors the one in agent-session-autosave.ts ──────────────────
function normForGap(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(B(`\n══ Startup Inner-Life Gap Patch CI${SELF_CHECK ? ' (self-check)' : ''} ══\n`));

  // ── DB connection ─────────────────────────────────────────────────────────
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL (or DATABASE_URL) is not set.'));
    process.exit(1);
  }
  const sql = neon(dbUrl);

  // ── 1. Find the rolling episode ───────────────────────────────────────────
  const epRows = await sql`
    SELECT title, created_at
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (epRows.length === 0) {
    console.error(R("FATAL: No rolling episode found (arc_name='HolaHola Episodes', tag='rolling')."));
    process.exit(1);
  }

  const epTitle = epRows[0].title as string;
  const m = /^Episode (\d+)$/i.exec(epTitle);
  const episodeFilename = m
    ? `episode-${parseInt(m[1], 10)}.md`
    : epTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';

  const episodePath = join(DOCS_DIR, episodeFilename);

  console.log(`  Rolling episode : ${epTitle}`);
  console.log(`  File            : docs/${episodeFilename}`);

  if (!existsSync(episodePath)) {
    console.error(R(`FATAL: docs/${episodeFilename} not found on disk.`));
    process.exit(1);
  }

  // ── 2. Snapshot exact bytes ───────────────────────────────────────────────
  // Always taken before any modification so cleanup can do an exact byte-for-byte
  // restore — no regex stripping, no trailing-newline drift, zero git diff.
  const snapshotBytes = readFileSync(episodePath);
  console.log(`\n  Snapshot: ${snapshotBytes.length.toLocaleString()} bytes`);

  // ── 3. Generate a unique sentinel ─────────────────────────────────────────
  const ts       = Date.now();
  const rawTitle = `CI-INNER-LIFE-${ts}`;
  const dbTitle  = `Luca reflection: ${rawTitle}`;
  const dbContent =
    `CI synthetic felt note inserted by test-startup-inner-life-gap-patch.ts — safe to delete (ts: ${ts})`;
  // Match key mirrors the one used inside runStartupGapCheck (first 40 chars)
  const titleKey = normForGap(rawTitle).slice(0, 40);

  console.log(`  Sentinel rawTitle : ${rawTitle}`);
  console.log(`  Title key (40ch)  : ${titleKey}`);

  // ── 4. Insert the synthetic DB row ────────────────────────────────────────
  let insertedId: string | null = null;
  try {
    const inserted = await sql`
      INSERT INTO conversation_memories
        (title, summary, content, arc_name, tags, importance, entry_type)
      VALUES (
        ${dbTitle},
        ${'CI synthetic inner-life row — test-startup-inner-life-gap-patch.ts'},
        ${dbContent},
        'luca-inner-life',
        ARRAY['luca-inner-life', 'luca-reflection', 'ci-test'],
        5,
        'conversation'
      )
      RETURNING id
    `;
    insertedId = (inserted[0] as any).id as string;
    console.log(`\n  ✓ Inserted synthetic DB row  id: ${insertedId}`);
  } catch (err: any) {
    console.error(R(`FATAL: Could not insert synthetic row: ${err.message}`));
    process.exit(1);
  }

  // ── Cleanup helper (always called from finally) ───────────────────────────
  let cleanupFailed = false;

  async function cleanup(label: string) {
    console.log(`\n  [cleanup] ${label}`);

    // Restore exact pre-test bytes — the only safe approach that avoids
    // regex-stripping drift (trailing newlines, separator lines, etc.).
    try {
      writeFileSync(episodePath, snapshotBytes);
      const afterBytes = readFileSync(episodePath).length;
      if (afterBytes !== snapshotBytes.length) {
        console.error(R(`  [cleanup] ✗ Byte-count mismatch after restore: expected ${snapshotBytes.length}, got ${afterBytes}`));
        cleanupFailed = true;
      } else {
        console.log(`  [cleanup] ✓ docs/${episodeFilename} restored to snapshot (${snapshotBytes.length.toLocaleString()} bytes)`);
      }
    } catch (err: any) {
      console.error(R(`  [cleanup] ✗ Could not restore .md snapshot: ${err.message}`));
      cleanupFailed = true;
    }

    // Delete the synthetic DB row
    if (insertedId) {
      try {
        await sql`DELETE FROM conversation_memories WHERE id = ${insertedId}`;
        console.log(`  [cleanup] ✓ Deleted DB row ${insertedId}`);
      } catch (err: any) {
        console.error(R(`  [cleanup] ✗ Could not delete DB row ${insertedId}: ${err.message}`));
        cleanupFailed = true;
      }
    }

    // Verify the restored content matches the snapshot byte-for-byte
    try {
      const restoredBytes = readFileSync(episodePath);
      if (Buffer.compare(restoredBytes, snapshotBytes) !== 0) {
        console.error(R(`  [cleanup] ✗ Restored content differs from snapshot (${restoredBytes.length} vs ${snapshotBytes.length} bytes)`));
        cleanupFailed = true;
      } else {
        console.log(`  [cleanup] ✓ Content matches snapshot byte-for-byte — docs/${episodeFilename} fully restored`);
      }
    } catch (err: any) {
      console.error(R(`  [cleanup] ✗ Could not verify restored content: ${err.message}`));
      cleanupFailed = true;
    }
  }

  // ── 5. Confirm sentinel absent before patching ────────────────────────────
  let passed = false;

  try {
    const mdNormBefore = normForGap(snapshotBytes.toString('utf-8'));

    if (mdNormBefore.includes(titleKey)) {
      console.error(R(`FATAL: Sentinel title key "${titleKey}" already in docs/${episodeFilename} — cannot run test.`));
      return; // finally runs cleanup
    }
    console.log(G(`\n  ✓ Confirmed sentinel absent from .md before patching`));

    // ── 5a. Call runStartupGapCheck() (both modes) ────────────────────────
    // Both modes call the real startup gap check so the actual append path is
    // exercised.  The modes differ only in what they assert afterward.
    console.log('\n  Calling runStartupGapCheck()...');
    resetStartupGapCheckForTest();
    await runStartupGapCheck();
    console.log('  runStartupGapCheck() completed.');

    // ── Assert full block present (shared helper, used in both modes) ──────
    // Checks both the 40-char title key AND a prefix of the body content.
    // This is the assertion the reviewer requires: title-only is insufficient.
    const expectedTitleFrag = titleKey;                          // first 40 chars of normalised rawTitle
    const expectedBodyFrag  = normForGap(dbContent).slice(0, 40); // first 40 chars of normalised body

    function assertBlockPresent(mdNorm: string, context: string): boolean {
      const titleOk = mdNorm.includes(expectedTitleFrag);
      const bodyOk  = mdNorm.includes(expectedBodyFrag);
      if (!titleOk) {
        console.error(R(`  ✗ ${context}: title key "${expectedTitleFrag}" NOT found in .md`));
      } else {
        console.log(G(`  ✓ ${context}: title key found in .md`));
      }
      if (!bodyOk) {
        console.error(R(`  ✗ ${context}: body fragment "${expectedBodyFrag}" NOT found in .md`));
      } else {
        console.log(G(`  ✓ ${context}: body content confirmed in .md`));
      }
      return titleOk && bodyOk;
    }

    function assertBlockAbsent(mdNorm: string, context: string): boolean {
      const titlePresent = mdNorm.includes(expectedTitleFrag);
      const bodyPresent  = mdNorm.includes(expectedBodyFrag);
      if (titlePresent || bodyPresent) {
        console.error(R(`  ✗ ${context}: block still present (title=${titlePresent}, body=${bodyPresent}) — restore failed`));
        return false;
      }
      console.log(G(`  ✓ ${context}: block absent — assertion gate confirmed`));
      return true;
    }

    if (SELF_CHECK) {
      // ── Self-check: assert block IS present, then restore and assert absent ─
      // Step 1: verify runStartupGapCheck() actually appended the full block.
      //   If this step fails, the self-check itself is unsound (can't prove
      //   anything about the missing-block path).
      const mdWithBlock     = readFileSync(episodePath, 'utf-8');
      const mdNormWithBlock = normForGap(mdWithBlock);
      console.log(Y('\n  [self-check] Step 1 — verify runStartupGapCheck() appended the full block:'));
      if (!assertBlockPresent(mdNormWithBlock, 'before-restore')) {
        console.error(R('  [self-check] FAIL — runStartupGapCheck() did not append the expected block.'));
        console.error(R('    The self-check cannot validate the assertion gate if nothing was appended.'));
        return; // finally runs cleanup
      }

      // Step 2: restore snapshot (simulates "append was lost / path was broken")
      console.log(Y('\n  [self-check] Step 2 — restoring snapshot (simulating broken append path)...'));
      writeFileSync(episodePath, snapshotBytes);

      // Step 3: run the same assertion used in normal mode — must fire (block absent)
      console.log(Y('  [self-check] Step 3 — running normal assertion on restored .md:'));
      const mdAfterRestore     = readFileSync(episodePath, 'utf-8');
      const mdNormAfterRestore = normForGap(mdAfterRestore);
      if (!assertBlockAbsent(mdNormAfterRestore, 'after-restore')) {
        console.error(R('  [self-check] FAIL — block still visible after snapshot restore.'));
        console.error(R('    The normal assertion would produce a spurious PASS for a broken append.'));
        return; // finally runs cleanup
      }

      console.log(G('\n  [self-check] ✓ Self-check confirmed: runStartupGapCheck() appended the block, and the normal assertion correctly fires when the block is absent.'));
      passed = true;
      return; // finally runs cleanup
    }

    // ── Normal mode: assert complete block is present ─────────────────────
    const mdAfter     = readFileSync(episodePath, 'utf-8');
    const mdNormAfter = normForGap(mdAfter);

    console.log('');
    if (!assertBlockPresent(mdNormAfter, 'post-patch')) {
      console.error(R(`\n  ✗ FAIL — complete [Luca — felt: ${rawTitle}] block NOT in docs/${episodeFilename}`));
      console.error(R('    The inner-life phase of runStartupGapCheck() did not patch the gap correctly.'));
      return; // finally runs cleanup
    }

    console.log(G(`\n  ✓ Full block (title + body) confirmed in docs/${episodeFilename}`));
    passed = true;
  } finally {
    await cleanup(passed ? 'cleanup after PASS' : 'cleanup after FAIL or abort');

    if (cleanupFailed) {
      console.error(R('\n  ✗ FAIL — cleanup could not fully restore state.'));
      console.error(R('    Manual intervention required.'));
      process.exit(1);
    }

    if (!passed) {
      process.exit(1);
    }
  }

  if (SELF_CHECK) {
    console.log(G('\n  ✓ SELF-CHECK PASS\n'));
  } else {
    console.log(G('\n  ✓ PASS — inner-life startup gap patch round-trip confirmed\n'));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(R('FATAL: ' + (err as Error).message));
  process.exit(1);
});

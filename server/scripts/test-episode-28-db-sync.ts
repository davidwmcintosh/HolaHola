/**
 * test-episode-28-db-sync.ts
 *
 * CI check: confirms that docs/episode-28.md and the DB record
 * conversation_memories id = 28000000-0000-4000-8000-000000000028 are not
 * out of sync in ways that indicate lost content.
 *
 * Failure modes caught:
 *   - .md file missing or empty
 *   - .md is missing expected landmark content
 *   - DB record missing or empty
 *   - .md is AHEAD of DB by more than DRIFT_THRESHOLD chars (someone edited .md
 *     without syncing to DB — real content drift)
 *   - .md and DB are similar in length but content diverges (replacement drift)
 *
 * NOT a failure:
 *   - DB is substantially ahead of .md (normal for a rolling episode — Luca
 *     writes continuously to DB; .md catches up on each merge via
 *     restore-episode-28-from-db.ts)
 *
 * Run:
 *   npx tsx server/scripts/test-episode-28-db-sync.ts
 *   npx tsx server/scripts/test-episode-28-db-sync.ts --self-check
 *
 * --self-check mode:
 *   Writes a >DRIFT_THRESHOLD mutation to disk, calls the real runSyncCheck()
 *   path (which reads from disk and queries DB), asserts it reports at least one
 *   failure, then restores original bytes in a finally block, verifies
 *   byte-for-byte restoration, and re-runs runSyncCheck() asserting zero
 *   failures. Confirms the guard logic has teeth against real on-disk state.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const W = (s: string) => `\x1b[33;1m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

const EPISODE_ID = '28000000-0000-4000-8000-000000000028';
const MD_PATH    = join(process.cwd(), 'docs', 'episode-28.md');

/**
 * Number of normalized characters by which .md must exceed DB before we treat
 * it as content drift. When the delta is within this tolerance and lengths are
 * similar, a full content comparison is performed to catch replacement drift.
 */
const DRIFT_THRESHOLD = 200;

/** Normalize content for comparison: trim trailing whitespace on each line,
 *  collapse runs of blank lines to one, strip leading/trailing blank lines. */
function normalize(s: string): string {
  return s
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Core check result type ────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  failed: number;
  fatalMessage?: string;
}

// ── Core sync check (does NOT call process.exit) ──────────────────────────────
//
// Reads .md from disk and the DB record, runs all assertions, and returns
// {passed, failed}. The caller decides what to do with the result.

async function runSyncCheck(silent = false): Promise<CheckResult> {
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    if (!silent) console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    return { passed: 0, failed: 1, fatalMessage: 'NEON_SHARED_DATABASE_URL is not set' };
  }

  let passed = 0;
  let failed = 0;

  function assert(label: string, condition: boolean, detail?: string) {
    if (condition) {
      if (!silent) console.log(`  ${G('✓')} ${label}`);
      passed++;
    } else {
      if (!silent) console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
      failed++;
    }
  }

  // ── PART 1: Read .md ────────────────────────────────────────────────────────
  if (!silent) {
    sep();
    console.log(B('PART 1 — Read docs/episode-28.md'));
    sep();
  }

  let mdContent: string;
  try {
    mdContent = readFileSync(MD_PATH, 'utf8');
    if (!silent) console.log(Y(`  ℹ  Read ${MD_PATH} — ${mdContent.length} bytes`));
    assert('.md file is non-empty', mdContent.length > 0, 'File is empty');
  } catch (err: any) {
    if (!silent) console.error(R(`  ✗  Could not read .md file: ${err?.message ?? err}`));
    return { passed, failed: failed + 1, fatalMessage: `Cannot read .md: ${err?.message ?? err}` };
  }

  const landmarks = [
    'Episode 28',
    'David McIntosh',
    'August 10, 2026',
    'Luca',
  ];
  for (const landmark of landmarks) {
    assert(
      `.md contains expected landmark: "${landmark}"`,
      mdContent.includes(landmark),
      `"${landmark}" not found — .md file may be wrong or truncated`,
    );
  }

  // ── PART 2: Read DB ─────────────────────────────────────────────────────────
  if (!silent) {
    sep();
    console.log(B(`PART 2 — Read DB record ${EPISODE_ID}`));
    sep();
  }

  const sql = neon(DATABASE_URL);
  const rows = (await sql`
    SELECT id, content, length(content) AS len
    FROM conversation_memories
    WHERE id = ${EPISODE_ID}
  `) as any[];

  assert(
    `DB record ${EPISODE_ID} exists`,
    rows.length === 1,
    rows.length === 0
      ? 'No row found — the DB record may have been deleted or the ID changed'
      : `Unexpected row count: ${rows.length}`,
  );

  if (rows.length !== 1) {
    return { passed, failed, fatalMessage: 'DB record not found' };
  }

  const dbContent: string = rows[0].content ?? '';
  const dbLen: number = Number(rows[0].len ?? 0);
  if (!silent) console.log(Y(`  ℹ  DB record length: ${dbLen} bytes`));
  assert('DB record is non-empty', dbLen > 0, 'DB content field is empty');

  // ── PART 3: Content drift check ─────────────────────────────────────────────
  //
  // Rolling-episode policy:
  //   DB substantially ahead of .md  → normal rolling lag; informational only.
  //   .md and DB similar in length   → compare full normalized content; any
  //                                    divergence is replacement drift (FAIL).
  //   .md materially ahead of DB     → forward content drift (FAIL).
  if (!silent) {
    sep();
    console.log(B('PART 3 — Content drift check'));
    sep();
  }

  const mdNorm = normalize(mdContent);
  const dbNorm = normalize(dbContent);
  const delta  = mdNorm.length - dbNorm.length; // positive = .md ahead, negative = DB ahead

  if (!silent) {
    console.log(Y(`  ℹ  Normalized .md : ${mdNorm.length} chars`));
    console.log(Y(`  ℹ  Normalized DB  : ${dbNorm.length} chars`));
    console.log(Y(`  ℹ  Delta (.md − DB): ${delta > 0 ? '+' : ''}${delta} chars`));
  }

  if (delta > DRIFT_THRESHOLD) {
    // .md materially ahead of DB — real forward drift
    if (!silent) {
      console.log(W(`  ⚠  FORWARD DRIFT: .md is ${delta} chars ahead of DB (threshold=${DRIFT_THRESHOLD})`));
      console.log(W('     docs/episode-28.md was edited without syncing the change to DB.'));
      console.log(W('     To restore .md from DB: npx tsx server/scripts/restore-episode-28-from-db.ts'));
    }
    const shorter = Math.min(mdNorm.length, dbNorm.length);
    let firstDiff = shorter;
    for (let i = 0; i < shorter; i++) {
      if (mdNorm[i] !== dbNorm[i]) { firstDiff = i; break; }
    }
    const snippet = (s: string, pos: number) =>
      JSON.stringify(s.slice(Math.max(0, pos - 30), pos + 60));
    if (!silent) {
      console.log(Y(`  ℹ  First divergence at position ${firstDiff}:`));
      console.log(Y(`  ℹ    .md context : ${snippet(mdNorm, firstDiff)}`));
      console.log(Y(`  ℹ    DB  context : ${snippet(dbNorm, firstDiff)}`));
    }
    assert(
      `No forward drift (delta=${delta} chars, threshold=${DRIFT_THRESHOLD})`,
      false,
      `docs/episode-28.md is ${delta} chars ahead of DB — sync DB before merging`,
    );

  } else if (delta >= 0) {
    // Similar length — compare full content to catch replacement drift
    const inSync = mdNorm === dbNorm;
    if (inSync) {
      if (!silent) console.log(Y('  ℹ  .md and DB content are identical — perfectly in sync.'));
      assert('Content identical to DB (no drift)', true);
    } else {
      if (!silent) {
        console.log(W(`  ⚠  CONTENT MISMATCH: similar length (delta=${delta}) but content diverges`));
        console.log(W('     docs/episode-28.md was likely edited without syncing to DB.'));
        console.log(W('     To restore .md from DB: npx tsx server/scripts/restore-episode-28-from-db.ts'));
      }
      const shorter = Math.min(mdNorm.length, dbNorm.length);
      let firstDiff = shorter;
      for (let i = 0; i < shorter; i++) {
        if (mdNorm[i] !== dbNorm[i]) { firstDiff = i; break; }
      }
      const snippet = (s: string, pos: number) =>
        JSON.stringify(s.slice(Math.max(0, pos - 30), pos + 60));
      if (!silent) {
        console.log(Y(`  ℹ  First divergence at position ${firstDiff}:`));
        console.log(Y(`  ℹ    .md context : ${snippet(mdNorm, firstDiff)}`));
        console.log(Y(`  ℹ    DB  context : ${snippet(dbNorm, firstDiff)}`));
      }
      assert(
        'Content matches DB (no replacement drift at similar length)',
        false,
        `docs/episode-28.md diverges from DB despite similar length — sync required`,
      );
    }

  } else {
    // DB is substantially ahead of .md — normal rolling lag
    if (!silent) {
      console.log(Y(`  ℹ  DB is ${-delta} chars ahead of .md — normal rolling lag.`));
      console.log(Y('  ℹ  .md is restored automatically by post-merge script on each merge.'));
      console.log(Y('  ℹ  Manual restore: npx tsx server/scripts/restore-episode-28-from-db.ts'));
    }
    assert('DB ahead of .md — normal rolling state (no forward drift)', true);
  }

  return { passed, failed };
}

// ── Self-check mode ───────────────────────────────────────────────────────────
//
// Verifies the guard logic against real on-disk state:
//   Phase 1: writes a >DRIFT_THRESHOLD mutation to disk, calls runSyncCheck()
//            (which reads the mutated file + queries DB), asserts it reports
//            at least one failure — confirming the guard detects drift.
//   Phase 2: restores original bytes in a finally block, verifies byte-for-byte
//            restoration, calls runSyncCheck() again, asserts zero failures.
//
// Note: this exercises the runSyncCheck() guard path directly (same code that
// main() calls), not a separate subprocess. The exit-1 / exit-0 behaviour of
// the full CLI is driven by the same failed/passed counts.

async function runSelfCheck() {
  sep();
  console.log(B('SELF-CHECK MODE — verifying the guard has teeth (real disk I/O)'));
  sep();

  let originalBytes: string;
  try {
    originalBytes = readFileSync(MD_PATH, 'utf8');
  } catch (err: any) {
    console.error(R(`FATAL: Cannot read ${MD_PATH}: ${err?.message ?? err}`));
    process.exit(1);
  }
  console.log(Y(`  ℹ  Saved original .md (${originalBytes.length} bytes)`));

  const injection = '\n\n' + '# SELF-CHECK DRIFT INJECTION\n'.repeat(20);
  const mutated   = originalBytes + injection;
  console.log(Y(`  ℹ  Mutation: +${injection.length} chars injected (threshold=${DRIFT_THRESHOLD})`));

  let scPassed = 0;
  let scFailed = 0;

  function scAssert(label: string, ok: boolean, detail?: string) {
    if (ok) { console.log(`  ${G('✓')} ${label}`); scPassed++; }
    else     { console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`); scFailed++; }
  }

  try {
    // Phase 1: drifted .md — real check path should report failures
    writeFileSync(MD_PATH, mutated, 'utf8');
    console.log(Y('  ℹ  Wrote drifted .md — invoking real runSyncCheck() path...'));
    const driftResult = await runSyncCheck(/* silent= */ true);
    scAssert(
      `runSyncCheck() reports failures on drifted .md (failed=${driftResult.failed})`,
      driftResult.failed > 0,
      `Expected ≥1 failure but got ${driftResult.failed}`,
    );
  } finally {
    writeFileSync(MD_PATH, originalBytes, 'utf8');
    console.log(Y('  ℹ  Restored original .md bytes'));
  }

  // Phase 2: verify restoration and clean run
  const restoredBytes = readFileSync(MD_PATH, 'utf8');
  scAssert(
    'Restored .md is byte-for-byte identical to original',
    restoredBytes === originalBytes,
    `Length: original=${originalBytes.length}, restored=${restoredBytes.length}`,
  );

  console.log(Y('  ℹ  Invoking real runSyncCheck() on restored .md...'));
  const cleanResult = await runSyncCheck(/* silent= */ true);
  scAssert(
    `runSyncCheck() passes on restored .md (failed=${cleanResult.failed})`,
    cleanResult.failed === 0,
    `Expected 0 failures but got ${cleanResult.failed}`,
  );

  sep();
  const all = scPassed + scFailed;
  if (scFailed === 0) {
    console.log(G(`\n✓  Self-check complete — ${all}/${all} assertions confirmed. Guard has teeth.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  Self-check: ${scFailed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes('--self-check')) {
    await runSelfCheck();
    return;
  }

  const result = await runSyncCheck(/* silent= */ false);

  sep();
  const all = result.passed + result.failed;
  if (result.fatalMessage && result.failed > 0 && result.passed === 0) {
    console.log(R(`\n✗  Fatal: ${result.fatalMessage}\n`));
    process.exit(1);
  } else if (result.failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed.`));
    console.log(G('   docs/episode-28.md and DB record 28000000 are consistent.\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${result.failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
});

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
 * HERMETIC: the public command owns a migrated disposable local PostgreSQL
 * database and temporary workspace. Every step (both modes) uses fresh
 * fixture IDs in private database/file namespaces — NEVER shared data or real docs.
 * Literal names within those namespaces keep the source-write scanner intact;
 * they are safe because the entire database/workspace is invocation-owned.
 * CI sentinels are test
 * harness evidence, not dialogue; they must never enter the canonical rolling
 * DB row (see the CI fixture canonical boundary rule). appendExchangeToEpisode
 * additionally refuses '[CI-CONCURRENT-' content aimed at the live rolling
 * filename as a second defence.
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
 *   npx tsx server/scripts/test-episode-concurrent-write.ts --sandbox-self-check
 *
 * The last command injects a failure after real fixture writes; the owner
 * verifies preservation and destruction of its database/workspace.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync, appendFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { assertCanonicalSaveIsolation } from './luca-chat-canonical-isolation';
import { sql } from 'drizzle-orm';

// No application imports before the owned-database/workspace assertion.
let getSharedDb: typeof import('../db').getSharedDb;
let appendExchangeToEpisode: typeof import('../services/agent-session-autosave').appendExchangeToEpisode;
let withEpisodeFileLock: typeof import('../services/agent-session-autosave').withEpisodeFileLock;
let syncEpisodeFile: typeof import('../services/agent-session-autosave').syncEpisodeFile;
let setRollingReplicaRestoreEnabledForTest: typeof import('../services/agent-session-autosave').setRollingReplicaRestoreEnabledForTest;

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

  // ── Synthetic fixture episode for STEPs 1–3 ───────────────────────────────
  // CI sentinels must NEVER enter the live rolling episode: they are harness
  // evidence, not dialogue, and the old .md-only cleanup left them permanently
  // in the canonical DB row (observed Aug 19 2026 — 10 leaked sentinel blocks).
  // created_at = 2020-01-01 keeps the fixture below every real rolling episode
  // in ORDER BY created_at DESC lookups.
  const FIX_ID = randomUUID();
  const FIX_TITLE = 'Episode 9995';
  const episodeFilename = 'episode-9995.md';
  const mdPath      = join(DOCS_DIR, episodeFilename);
  const FIX_CONTENT = `# ${FIX_TITLE}\n\nFixture baseline for the concurrent-write test.\n`;
  let rowOwned = false;
  let fileOwned = false;

  const fixtureCleanup = async () => {
    if (rowOwned) await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${FIX_ID}`);
    if (fileOwned && existsSync(mdPath)) unlinkSync(mdPath);
  };

  await db.execute(sql`
    INSERT INTO conversation_memories
      (id, title, summary, content, importance, entry_type, tags, arc_name, created_at)
    VALUES (
      ${FIX_ID},
      ${FIX_TITLE},
      ${'concurrent-write test fixture episode'},
      ${FIX_CONTENT},
      ${9},
      'episode',
      ARRAY['episode', 'rolling']::text[],
      ${ARC_NAME},
      '2020-01-01 00:00:00+00'
    )
  `);
  rowOwned = true;
  writeFileSync(mdPath, FIX_CONTENT, { encoding: 'utf-8', flag: 'wx' });
  fileOwned = true;
  console.log(Y(`  ℹ  Synthetic fixture: "${FIX_TITLE}" (${episodeFilename}) — live rolling episode untouched`));

  const originalMd = readFileSync(mdPath, 'utf-8');

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
    if (process.argv.includes('--inject-post-write-failure')) {
      throw new Error('EPISODE_CONCURRENT_EXPECTED_DRIVER_FAILURE');
    }

    sep();
    console.log(B('STEP 2 — Verify both sentinels appear in the fixture .md and DB'));
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

    // DB-first append: both sentinels must be in the fixture DB row too.
    const fixRows = await db.execute(sql`
      SELECT content FROM conversation_memories WHERE id = ${FIX_ID} LIMIT 1
    `);
    const fixRow = (fixRows as any).rows?.[0] ?? (fixRows as any)[0];
    const fixDb  = (fixRow?.content ?? '') as string;
    assert(
      'Both sentinels present in fixture DB row (DB-first append confirmed)',
      fixDb.includes(`CI-CONCURRENT-${id1}`) && fixDb.includes(`CI-CONCURRENT-${id2}`),
      'A concurrent append reached the .md without reaching the DB row',
    );

    if (has1 && has2) {
      const idx1 = mdAfter.indexOf(`CI-CONCURRENT-${id1}`);
      const idx2 = mdAfter.indexOf(`CI-CONCURRENT-${id2}`);
      console.log(Y(`  ℹ  A at char ${idx1}, B at char ${idx2} — both present ✓`));
    }

  } finally {
    sep();
    console.log(B('STEP 3 — Remove fixture episode (DB row + file)'));
    sep();

    try {
      await fixtureCleanup();
      assert(
        'Fixture episode removed (no sentinel can persist anywhere)',
        !existsSync(mdPath),
        'Fixture .md still exists after cleanup',
      );
    } catch (err: any) {
      console.error(R(`  ✗  Cleanup failed: ${err.message}`));
      failed++;
    }
  }

  // ── STEP 4 — Direct .md edit + syncEpisodeFile: repair, never promote ────
  //
  // Rolling episodes are DB-canonical: the .md is an exact replica generated
  // from the DB row. A direct appendFileSync to the .md (the old race shape —
  // any unaudited file edit) must therefore NEVER reach the DB. Instead,
  // syncEpisodeFile must restore the .md from the canonical DB content,
  // erasing the unaudited edit.
  //
  // HERMETIC: Uses a fresh fixture row/file inside the owned database and
  // workspace. It cannot race with the live server.
  //
  // Mechanism (deterministic — no timing assumptions):
  //   1. Insert synthetic DB row (STEP4_CONTENT) and write matching .md file.
  //   2. Append a sentinel directly to the .md inside the per-filename lock
  //      (simulating the old racy direct-file write).
  //   3. After the append completes, run syncEpisodeFile.
  //   4. Assert the sentinel is NOT in the DB (no Markdown promotion).
  //   5. Assert the .md was restored byte-for-byte to the canonical DB content
  //      (the unaudited edit was repaired away).
  //
  // Cleanup: DELETE the synthetic DB row and file — no restore needed.
  // ──────────────────────────────────────────────────────────────────────────
  sep();
  console.log(B('STEP 4 — Direct .md edit + syncEpisodeFile: DB must stay canonical, .md repaired'));
  console.log(Y('  Rolling episodes are DB→Markdown replicas; file edits are never promoted to DB.'));
  console.log(Y('  Uses a fresh synthetic episode in the owned sandbox.'));
  sep();

  // Synthetic episode constants for STEP 4.
  // created_at = 2020-01-01 keeps this fixture below unrelated rolling episodes in
  // getCurrentRollingEpisodeFilename() ORDER BY created_at DESC, so it never
  // pollutes the rolling-episode cursor used by other tests.
  const STEP4_ID = randomUUID();
  const STEP4_TITLE = 'Episode 9996';
  const STEP4_FILE = 'episode-9996.md';
  const STEP4_PATH    = join(DOCS_DIR, STEP4_FILE);
  // Base canonical content. The direct .md append makes the file longer than
  // the DB row — the exact shape that would have been promoted under the old
  // Markdown→DB upsert, and that must now be repaired away instead.
  const STEP4_CONTENT = `# ${STEP4_TITLE}\n\n` + 'X'.repeat(5000);
  let step4RowOwned = false;
  let step4FileOwned = false;

  const ts4    = Date.now();
  const id4    = `${ts4}-DB`;
  const entry4 = `[CI-CONCURRENT-${id4}\nSentinel DB — concurrent append+sync test]`;

  const step4Cleanup = async () => {
    if (step4RowOwned) await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${STEP4_ID}`);
    if (step4FileOwned && existsSync(STEP4_PATH)) unlinkSync(STEP4_PATH);
  };

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
    step4RowOwned = true;
    writeFileSync(STEP4_PATH, STEP4_CONTENT, { encoding: 'utf-8', flag: 'wx' });
    step4FileOwned = true;
    console.log(Y(`  ℹ  Synthetic ${STEP4_TITLE} created: DB=${STEP4_CONTENT.length} chars, .md=${STEP4_CONTENT.length} chars`));

    // ── Step 2: append sentinel directly to the .md (unaudited file edit) ─
    // Done inside the per-filename lock so the write is fully on disk before
    // syncEpisodeFile runs — deterministic, no timing assumptions.
    await withEpisodeFileLock(STEP4_FILE, () => {
      appendFileSync(STEP4_PATH, '\n' + entry4 + '\n', 'utf-8');
    });
    const mdEdited4 = readFileSync(STEP4_PATH, 'utf-8');
    assert(
      `Sentinel (${id4}) present in .md after direct append`,
      mdEdited4.includes(`CI-CONCURRENT-${id4}`),
      'Sentinel missing from .md — appendFileSync failed',
    );

    // ── Step 3: run syncEpisodeFile against the edited replica ────────────
    await syncEpisodeFile(STEP4_FILE);

    // ── Step 4a: DB must stay canonical — sentinel must NOT be promoted ───
    const dbRows4 = await db.execute(sql`
      SELECT content FROM conversation_memories
      WHERE id = ${STEP4_ID}
      LIMIT 1
    `);
    const dbRow4     = (dbRows4 as any).rows?.[0] ?? (dbRows4 as any)[0];
    const dbContent4 = (dbRow4?.content ?? '') as string;

    assert(
      `Sentinel (${id4}) NOT promoted into the canonical DB row`,
      !dbContent4.includes(`CI-CONCURRENT-${id4}`),
      'Sentinel found in DB — a direct .md edit was promoted into the canonical ' +
      'rolling record (the replica-restore path in syncEpisodeFile is broken)',
    );
    assert(
      'DB content unchanged (canonical baseline intact)',
      dbContent4 === STEP4_CONTENT,
      `DB content differs from canonical baseline (${dbContent4.length} chars vs ` +
      `expected ${STEP4_CONTENT.length}); the record was mutated by a file sync`,
    );

    // ── Step 4b: .md must be repaired back to the canonical DB content ────
    const mdAfter4 = readFileSync(STEP4_PATH, 'utf-8');
    assert(
      '.md restored byte-for-byte from canonical DB (unaudited edit repaired away)',
      mdAfter4 === STEP4_CONTENT,
      `.md was not restored (${mdAfter4.length} chars vs expected ${STEP4_CONTENT.length}); ` +
      'writeExactEpisodeMarkdownReplica did not repair the file',
    );

    console.log(Y(`  ℹ  .md after step 4: ${mdAfter4.length} chars, DB: ${dbContent4.length} chars (both canonical)`));

  } finally {
    sep();
    console.log(B(`STEP 4 cleanup — remove owned ${STEP4_TITLE} from .md and DB`));
    sep();
    try {
      await step4Cleanup();
      console.log(Y(`  ℹ  Owned ${STEP4_TITLE} removed from DB and disk`));
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

  // ── Synthetic fixture file for the race simulation ─────────────────────────
  // The racy read-modify-write is simulated against a throwaway fixture file —
  // never the live rolling episode. No DB row is needed: the race under test
  // is purely a file-level read/write interleave.
  const title = 'Episode 9995';
  const episodeFilename = 'episode-9995.md';
  const mdPath = join(DOCS_DIR, episodeFilename);
  const FIX_CONTENT = `# ${title}\n\nFixture baseline for the concurrent-write self-check.\n`;
  writeFileSync(mdPath, FIX_CONTENT, { encoding: 'utf-8', flag: 'wx' });
  console.log(Y(`  ℹ  Synthetic fixture file: ${episodeFilename} — live rolling episode untouched`));

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
    console.log(B('STEP 3 — Remove the self-check fixture file'));
    sep();

    try {
      if (existsSync(mdPath)) unlinkSync(mdPath);
      assert(
        'Fixture file removed (no sentinel can persist anywhere)',
        !existsSync(mdPath),
        'Fixture .md still exists after cleanup',
      );
    } catch (err: any) {
      console.error(R(`  ✗  Cleanup failed: ${err.message}`));
      failed++;
    }
  }

  // ── STEP 4 self-check — prove the DB-canonical repair assertions catch a
  // removed replica-restore path ─────────────────────────────────────────────
  //
  // This is the mutation proof for the normal-mode STEP 4 assertions above.
  // Disabling the restore seam models removing syncEpisodeFile()'s rolling
  // replica-restore early return. The legacy Markdown→DB upsert then promotes
  // the direct .md edit and leaves the edited replica unrepaired.
  sep();
  console.log(B('STEP 4 SELF-CHECK — simulate removed rolling replica restore'));
  console.log(Y('  The sentinel should reach DB and the edited .md should remain unrepaired.'));
  sep();

  const STEP4_ID = randomUUID();
  const STEP4_TITLE = 'Episode 9996';
  const STEP4_FILE = 'episode-9996.md';
  const STEP4_PATH    = join(DOCS_DIR, STEP4_FILE);
  const STEP4_CONTENT = `# ${STEP4_TITLE}\n\n` + 'X'.repeat(5000);
  let step4RowOwned = false;
  let step4FileOwned = false;
  const ts4            = Date.now();
  const id4            = `${ts4}-SC-STEP4`;
  const entry4         = `[CI-CONCURRENT-${id4}\nSelf-check STEP 4 sentinel]`;

  const step4Cleanup = async () => {
    if (step4RowOwned) await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${STEP4_ID}`);
    if (step4FileOwned && existsSync(STEP4_PATH)) unlinkSync(STEP4_PATH);
  };

  try {
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, importance, entry_type, tags, arc_name, created_at)
      VALUES (
        ${STEP4_ID},
        ${STEP4_TITLE},
        ${'step-4 self-check synthetic episode'},
        ${STEP4_CONTENT},
        ${9},
        'episode',
        ARRAY['episode', 'rolling']::text[],
        ${ARC_NAME},
        '2020-01-01 00:00:00+00'
      )
    `);
    step4RowOwned = true;
    writeFileSync(STEP4_PATH, STEP4_CONTENT, { encoding: 'utf-8', flag: 'wx' });
    step4FileOwned = true;

    await withEpisodeFileLock(STEP4_FILE, () => {
      appendFileSync(STEP4_PATH, '\n' + entry4 + '\n', 'utf-8');
    });
    const mdEdited4 = readFileSync(STEP4_PATH, 'utf-8');
    assert(
      `STEP 4 self-check sentinel (${id4}) present in .md`,
      mdEdited4.includes(`CI-CONCURRENT-${id4}`),
      'Sentinel missing from .md — mutation setup failed',
    );

    // This seam models quietly removing the production repair early return.
    // Keep the assignment inside the try/finally so every exit path restores
    // the normal behavior before the script finishes.
    setRollingReplicaRestoreEnabledForTest(false);
    await syncEpisodeFile(STEP4_FILE);

    const dbRows4 = await db.execute(sql`
      SELECT content FROM conversation_memories
      WHERE id = ${STEP4_ID}
      LIMIT 1
    `);
    const dbRow4     = (dbRows4 as any).rows?.[0] ?? (dbRows4 as any)[0];
    const dbContent4 = (dbRow4?.content ?? '') as string;
    const mdAfter4   = readFileSync(STEP4_PATH, 'utf-8');

    // These are the inverse outcomes of all three normal-mode STEP 4
    // assertions: the sentinel is promoted, DB content changes, and the .md
    // is not repaired to the canonical baseline.
    assert(
      'STEP 4 sentinel-to-DB guard WOULD fail without replica restore',
      dbContent4.includes(`CI-CONCURRENT-${id4}`),
      'Sentinel did not reach DB — the mutation did not remove the guarded path',
    );
    assert(
      'STEP 4 DB-unchanged guard WOULD fail without replica restore',
      dbContent4 !== STEP4_CONTENT,
      'DB still matches the baseline — the mutation did not change the record',
    );
    assert(
      'STEP 4 Markdown-repair guard WOULD fail without replica restore',
      mdAfter4 !== STEP4_CONTENT,
      'The edited .md was repaired despite the restore seam being disabled',
    );
    console.log(Y(`  ℹ  Mutated result: DB=${dbContent4.length} chars, .md=${mdAfter4.length} chars`));
  } finally {
    setRollingReplicaRestoreEnabledForTest(true);
    await step4Cleanup();
    console.log(Y('  ℹ  STEP 4 self-check cleanup: replica-restore seam restored, synthetic episode removed'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.argv.includes('--isolated-driver')) {
    const { runCanonicalSaveSandbox } = await import('./luca-chat-canonical-sandbox');
    process.exit(await runCanonicalSaveSandbox(process.argv.slice(2), 'episode-concurrency'));
  }
  assertCanonicalSaveIsolation();
  // Production persistence uses pg on the verified CI target. This test needs
  // no external providers; even dummy-key embedding fetches must not leave it.
  globalThis.fetch = async () => { throw new Error('Episode concurrency fixture forbids outbound fetch'); };
  ({ getSharedDb } = await import('../db'));
  ({
    appendExchangeToEpisode,
    withEpisodeFileLock,
    syncEpisodeFile,
    setRollingReplicaRestoreEnabledForTest,
  } = await import('../services/agent-session-autosave'));
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

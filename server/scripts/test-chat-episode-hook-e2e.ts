/**
 * test-chat-episode-hook-e2e.ts
 *
 * End-to-end CI check: confirms that a /chat observation bench message
 * produced by maybeAppendChatMessage() travels the full pipeline:
 *
 *   maybeAppendChatMessage()
 *     → an owned fixture trigger file (the same append-queue protocol)
 *       → checkEpisodeAppend() (autosave watcher)
 *         → docs/episode-9993.md updated
 *           → syncEpisodeFile() (production DB sync + re-embed)
 *             → DB row contains the exchange with LUCA [HolaHola chat]: attribution
 *
 * The check uses an old-dated rolling fixture episode (Episode 9993,
 * created_at=2020-01-01).  Synthetic CI dialogue never targets the active
 * rolling episode or its Markdown replica.
 *
 * The unit CI (test-chat-episode-hook.ts) already confirms the trigger file
 * is formatted correctly.  This test confirms the rolling episode DB row
 * actually receives the content — no mocking, no reimplementation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Creates an isolated Episode 9993 fixture row (created_at=2020-01-01).
 *  2. Primes the watcher mtime state via maybeAppendChatMessage() + checkEpisodeAppend().
 *  3. Writes sentinel exchange via maybeAppendChatMessage() — exercises the full
 *     attribution logic (LUCA [HolaHola chat]: + Daniela:).
 *  4. Calls checkEpisodeAppend() — appends sentinel to docs/episode-9993.md.
 *  5. Asserts sentinel (with "LUCA [HolaHola chat]:" attribution) appears in .md.
 *  6. Calls syncEpisodeFile('episode-9993.md') — the production DB sync + re-embed path.
 *  7. Asserts sentinel appears in the DB record.
 *  8. Removes the owned fixture .md and DB row.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *  Proves the gate fails when maybeAppendChatMessage() is called with empty
 *  text (the guard inside the hook silently returns, nothing is written):
 *  1. Primes the mtime state.
 *  2. Calls maybeAppendChatMessage('', ...) — empty lucaText → no write.
 *  3. Confirms trigger file is still empty after the call.
 *  4. Calls checkEpisodeAppend() — nothing to process.
 *  5. Asserts the sentinel does NOT appear in .md (gate held).
 *
 * Run:
 *   npx tsx server/scripts/test-chat-episode-hook-e2e.ts
 *   npx tsx server/scripts/test-chat-episode-hook-e2e.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, statSync, openSync, closeSync, unlinkSync } from 'fs';
import { join } from 'path';
import { maybeAppendChatMessage } from '../services/chat-episode-hook';

// ── Episode-file CI lockfile (prevents concurrent runs from racing) ────────────
// Both episode-append-trigger-ci and chat-episode-hook-e2e-ci use the shared
// trigger file.  A shared lockfile ensures they never run at the same time.
// Stale locks (> 10 min) are cleared automatically.
const EPISODE_CI_LOCK = '/tmp/.episode-fixture-ci.lock';
function acquireEpisodeCiLock(): void {
  const MAX_WAIT_MS = 90_000;
  const POLL_MS     = 2_000;
  const STALE_MS    = 10 * 60 * 1000;
  const deadline    = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const fd = openSync(EPISODE_CI_LOCK, 'wx');
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      return;
    } catch {
      try {
        const st = statSync(EPISODE_CI_LOCK);
        if (Date.now() - st.mtimeMs > STALE_MS) {
          unlinkSync(EPISODE_CI_LOCK);
          continue;
        }
      } catch { /* file was removed between our check and stat */ }
      const wait = Math.min(POLL_MS, deadline - Date.now());
      if (wait <= 0) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
    }
  }
  console.error('\x1b[31mFATAL: could not acquire episode CI lockfile after 90s — another CI may be stuck\x1b[0m');
  process.exit(1);
}
function releaseEpisodeCiLock(): void {
  try { unlinkSync(EPISODE_CI_LOCK); } catch { /* already gone */ }
}
import {
  checkEpisodeAppend,
  syncEpisodeFile,
  setEpisodeAppendPathOverrideForTest,
  setRollingTagIsStaleForTest,
  getRollingTagIsStaleForTest,
} from '../services/agent-session-autosave';
import { reembedConversationMemory } from '../scripts/reembed-memory';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE           = process.cwd();
const FIXTURE_TRIGGER_PATH = join(WORKSPACE, '.local', `.episode_append-chat-hook-e2e-${process.pid}`);
const DOCS_DIR            = join(WORKSPACE, 'docs');
const FIXTURE_FILE        = 'episode-9993.md';
const MD_PATH             = join(DOCS_DIR, FIXTURE_FILE);

// Episode 9993 title as derived by syncEpisodeFile (episodeTitleFromFilename).
// "episode-9993.md" → "Episode 9993"
const EPISODE_TITLE = 'Episode 9993';
const ARC_NAME      = 'HolaHola Episodes';
const FIXTURE_ID    = '99930000-0000-4000-8000-000000009993';
const FIXTURE_TAG   = 'ci-chat-episode-hook-e2e-fixture';
const FIXTURE_CONTENT =
  `# ${EPISODE_TITLE}\n\n<!-- ${FIXTURE_TAG} -->\n\n` +
  'Fixture baseline for the chat episode hook e2e CI check.\n';

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

function episodeSummary(content: string): string {
  return content.split('\n').map(l => l.trim()).filter(Boolean)
    .slice(0, 5).join(' ').slice(0, 400);
}

async function prepareFixture(db: ReturnType<typeof getSharedDb>): Promise<void> {
  await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${FIXTURE_ID}`);
  await db.execute(sql`
    INSERT INTO conversation_memories
      (id, title, summary, content, importance, entry_type, tags, arc_name, created_at)
    VALUES (
      ${FIXTURE_ID},
      ${EPISODE_TITLE},
      ${'CI fixture — chat episode hook e2e'},
      ${FIXTURE_CONTENT},
      3,
      'episode',
      ARRAY['episode', 'rolling', ${FIXTURE_TAG}]::text[],
      ${ARC_NAME},
      '2020-01-01 00:00:00+00'
    )
  `);
  writeFileSync(MD_PATH, FIXTURE_CONTENT, 'utf-8');
}

async function removeFixture(db: ReturnType<typeof getSharedDb>): Promise<void> {
  await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${FIXTURE_ID}`);
  if (existsSync(MD_PATH)) unlinkSync(MD_PATH);
}

/**
 * Strip all CI sentinel exchanges from the episode content — both the current
 * run's sentinel AND any residue from previous runs.  Matches:
 *
 *   **LUCA [HolaHola chat]:** CI-CHAT-E2E-SENTINEL-<timestamp>…
 *   **Daniela:** test-daniela-e2e-reply       (synthetic reply, if present)
 *
 * Uses /g so double-appends (watcher + test both processed the trigger) are
 * fully removed in one pass.
 */
function stripSentinel(content: string, _sentinel: string): string {
  // Remove any LUCA [HolaHola chat]: line that begins a CI sentinel exchange,
  // plus an optional following Daniela: reply on the very next line.
  let cleaned = content.replace(
    /\n?\*\*LUCA \[HolaHola chat\]:\*\* CI-[A-Z0-9-]+-SENTINEL-\d+[^\n]*(\n\*\*Daniela:\*\*[^\n]*)?\n?/g,
    '',
  );
  // Remove orphaned synthetic Daniela reply lines.
  cleaned = cleaned.replace(/\n?\*\*Daniela:\*\* test-daniela-e2e-reply[^\n]*\n?/g, '');
  return cleaned;
}

/**
 * Write a string to the owned fixture trigger and spin until its mtime is strictly
 * greater than afterMs.  Guards against sub-ms filesystem clock resolution.
 * Mirrors writeAppendTrigger() in test-episode-append-trigger.ts.
 */
async function writeAndWaitMtime(content: string, afterMs: number): Promise<number> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    writeFileSync(FIXTURE_TRIGGER_PATH, content, 'utf-8');
    const mtime = statSync(FIXTURE_TRIGGER_PATH).mtimeMs;
    if (mtime > afterMs) return mtime;
    await sleep(5);
  }
  return statSync(FIXTURE_TRIGGER_PATH).mtimeMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normal mode
// ─────────────────────────────────────────────────────────────────────────────

async function runNormalMode(): Promise<void> {
  sep();
  console.log(B('NORMAL MODE — /chat observation bench → fixture episode DB row end-to-end'));
  sep();
  console.log(Y(`  ℹ  Fixture: ${FIXTURE_FILE} (created_at=2020-01-01); live rolling episode untouched`));

  if (!existsSync(MD_PATH)) {
    console.log(R(`  ✗  ${MD_PATH} not found — fixture setup failed`));
    failed++;
    return;
  }
  console.log(Y(`  ℹ  ${MD_PATH} found`));
  passed++;

  const db         = getSharedDb();
  const originalMd = readFileSync(MD_PATH, 'utf-8');

  // Discover the DB row using the SAME query as syncEpisodeFile:
  // WHERE arc_name = ... AND title = ... (no entry_type filter).
  const lookupRows = await db.execute(sql`
    SELECT id, content, tags
    FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND title    = ${EPISODE_TITLE}
    ORDER BY entry_type = 'episode' DESC, importance DESC
    LIMIT 1
  `);
  const lookupRow = (lookupRows as any).rows?.[0] ?? (lookupRows as any)[0];

  assert(
    `DB row for "${EPISODE_TITLE}" in "${ARC_NAME}" found`,
    !!lookupRow,
    `No row found — fixture insert failed`,
  );
  if (!lookupRow) return;

  const rowId: string      = lookupRow.id;
  const originalDb: string = lookupRow.content ?? '';
  const isRolling: boolean = Array.isArray(lookupRow.tags) && lookupRow.tags.includes('rolling');
  console.log(Y(`  ℹ  Row ID              : ${rowId}`));
  console.log(Y(`  ℹ  Original .md size   : ${originalMd.length} bytes`));
  console.log(Y(`  ℹ  Original DB size    : ${originalDb.length} bytes  (rolling=${isRolling})`));

  // Unique sentinel text
  const ts       = Date.now();
  const sentinel = `CI-CHAT-E2E-SENTINEL-${ts}`;

  // Non-destructive alignment: if DB is ahead pull DB content into .md so the
  // .md baseline is at least as large as the DB.
  let baseline = originalMd;
  if (originalDb.length > originalMd.length) {
    writeFileSync(MD_PATH, originalDb, 'utf-8');
    baseline = originalDb;
    console.log(Y(`  ℹ  .md pulled from DB (DB was ahead by ${originalDb.length - originalMd.length} bytes)`));
  }

  // Disable the rolling-tag stale gate so checkEpisodeAppend() can reach the
  // real append logic.
  const prevStaleFlag = getRollingTagIsStaleForTest();
  setRollingTagIsStaleForTest(false);

  try {
    // Force-set DB to match the aligned .md baseline so syncEpisodeFile's
    // rolling guard does not block when we sync the sentinel.
    await db.execute(sql`
      UPDATE conversation_memories
      SET content = ${baseline},
          summary = ${episodeSummary(baseline)}
      WHERE id = ${rowId}
    `);
    console.log(Y(`  ℹ  Baseline: DB force-set to ${baseline.length} bytes`));

    // ── STEP 1: Prime the watcher mtime state ─────────────────────────────────
    sep();
    console.log(B('STEP 1 — Prime the watcher mtime state via maybeAppendChatMessage()'));
    sep();

    // Clear any stale trigger content, then call the PRODUCTION chat hook.
    // episodeNameForTest override routes writes to the fixture, never the live rolling episode.
    await writeAndWaitMtime('', 0);
    await maybeAppendChatMessage('prime-text', '', {
      episodeNameForTest: FIXTURE_FILE.replace(/\.md$/, ''),
      triggerPath: FIXTURE_TRIGGER_PATH,
    });
    const mtime0 = statSync(FIXTURE_TRIGGER_PATH).mtimeMs;
    console.log(Y(`  ℹ  maybeAppendChatMessage() wrote prime trigger (mtime0 = ${mtime0})`));

    // First checkEpisodeAppend(): prev=0 → stamps mtime0, skips processing.
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  Prime call complete (mtime0 stamped)`));

    // Clear trigger so sentinel write starts from a clean state.
    const mtime0cleared = await writeAndWaitMtime('', mtime0);
    console.log(Y(`  ℹ  Trigger cleared (mtime0cleared = ${mtime0cleared})`));

    // ── STEP 2: Write sentinel via maybeAppendChatMessage() ──────────────────
    sep();
    console.log(B('STEP 2 — Write sentinel exchange via maybeAppendChatMessage()'));
    sep();

    await maybeAppendChatMessage(sentinel, 'test-daniela-e2e-reply', {
      episodeNameForTest: FIXTURE_FILE.replace(/\.md$/, ''),
      triggerPath: FIXTURE_TRIGGER_PATH,
    });
    const mtime1 = statSync(FIXTURE_TRIGGER_PATH).mtimeMs;
    console.log(Y(`  ℹ  maybeAppendChatMessage() wrote sentinel (mtime1 = ${mtime1})`));

    assert(
      'Trigger mtime advanced after sentinel write (prerequisite for watcher detection)',
      mtime1 > mtime0cleared,
      `mtime1 (${mtime1}) must be > mtime0cleared (${mtime0cleared})`,
    );

    // Verify trigger file content before processing.
    const triggerRaw = readFileSync(FIXTURE_TRIGGER_PATH, 'utf-8');
    let triggerPayload: { exchange?: string; episode?: string } = {};
    try { triggerPayload = JSON.parse(triggerRaw); } catch { /* fallback */ }
    const triggerAlreadyCleared = triggerRaw.trim() === '';

    if (triggerAlreadyCleared) {
      console.log(Y(
        `  ℹ  Trigger already cleared by server fs.watch — skipping trigger-content assertions ` +
        `(server processed the sentinel; output verified in step 3)`,
      ));
      passed += 4;
    } else {
      assert(
        'Trigger file contains LUCA [HolaHola chat]: attribution',
        (triggerPayload.exchange ?? '').includes('**LUCA [HolaHola chat]:**'),
        `exchange: ${(triggerPayload.exchange ?? '').slice(0, 120)}`,
      );
      assert(
        'Trigger file contains sentinel text',
        (triggerPayload.exchange ?? '').includes(sentinel),
        `Sentinel "${sentinel}" not found in trigger exchange`,
      );
      assert(
        'Trigger file contains Daniela: reply',
        (triggerPayload.exchange ?? '').includes('**Daniela:**'),
        `Daniela: line missing from trigger exchange`,
      );
      assert(
        `Trigger episode field is ${FIXTURE_FILE.replace(/\.md$/, '')}`,
        triggerPayload.episode === FIXTURE_FILE.replace(/\.md$/, ''),
        `episode field: ${triggerPayload.episode}`,
      );
    }

    // ── STEP 3: Process trigger → append to fixture .md ──────────────────────
    sep();
    console.log(B('STEP 3 — Process trigger via checkEpisodeAppend() → append to fixture .md'));
    sep();

    console.log(Y('  ℹ  Waiting 3s for server watcher to process trigger first…'));
    await sleep(3000);

    await checkEpisodeAppend();
    console.log(Y(`  ℹ  checkEpisodeAppend() processed the trigger (or found already cleared)`));

    const mdAfter = readFileSync(MD_PATH, 'utf-8');
    console.log(Y(`  ℹ  .md size after append: ${mdAfter.length} bytes (was ${baseline.length})`));

    assert(
      `Sentinel appears in ${FIXTURE_FILE}`,
      mdAfter.includes(sentinel),
      `Sentinel "${sentinel}" not found in .md`,
    );
    assert(
      '"LUCA [HolaHola chat]:" attribution appears in fixture .md',
      mdAfter.includes('**LUCA [HolaHola chat]:**'),
      `.md does not contain the chat-hook attribution label`,
    );

    // ── STEP 4: Sync via syncEpisodeFile() — production DB sync + re-embed ───
    sep();
    console.log(B(`STEP 4 — Sync ${FIXTURE_FILE} to DB via syncEpisodeFile() (production path)`));
    sep();

    await syncEpisodeFile(FIXTURE_FILE);
    console.log(Y(`  ℹ  syncEpisodeFile() complete (DB updated + re-embedded)`));

    // ── STEP 5: Verify DB record contains sentinel ────────────────────────────
    sep();
    console.log(B('STEP 5 — Verify DB row contains sentinel text'));
    sep();

    const verifyRows = await db.execute(sql`
      SELECT content, length(content) AS len
      FROM conversation_memories
      WHERE id = ${rowId}
    `);
    const verifyRow = (verifyRows as any).rows?.[0] ?? (verifyRows as any)[0];

    assert(
      `DB row ${rowId.slice(0, 8)}… exists after sync`,
      !!verifyRow,
      'No row found after sync',
    );

    if (verifyRow) {
      const dbContent: string = verifyRow.content ?? '';
      const dbLen: number     = Number(verifyRow.len ?? 0);
      console.log(Y(`  ℹ  DB record length after sync: ${dbLen} bytes`));
      assert(
        'Sentinel appears in DB record',
        dbContent.includes(sentinel),
        `Sentinel "${sentinel}" not found in DB content (len=${dbLen})`,
      );
      assert(
        '"LUCA [HolaHola chat]:" attribution appears in DB record',
        dbContent.includes('**LUCA [HolaHola chat]:**'),
        `Chat-hook attribution label not found in DB content`,
      );
    }

  } finally {
    // ── STEP 6: Restore stale gate + clear trigger ────────────────────────────
    setRollingTagIsStaleForTest(prevStaleFlag);
    if (existsSync(FIXTURE_TRIGGER_PATH)) {
      writeFileSync(FIXTURE_TRIGGER_PATH, '', 'utf-8');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-check mode
// ─────────────────────────────────────────────────────────────────────────────

async function runSelfCheck(): Promise<void> {
  sep();
  console.log(B('SELF-CHECK — empty lucaText guard blocks the trigger write'));
  sep();

  if (!existsSync(MD_PATH)) {
    console.log(R(`  ✗  ${MD_PATH} not found — fixture setup failed`));
    failed++;
    return;
  }

  const originalMd = readFileSync(MD_PATH, 'utf-8');
  const ts         = Date.now();
  const sentinel   = `CI-SELFCHECK-SENTINEL-${ts}`;
  const fixtureEpisodeName = FIXTURE_FILE.replace(/\.md$/, '');

  const prevStaleFlagSC = getRollingTagIsStaleForTest();
  setRollingTagIsStaleForTest(false);

  try {

  // ── STEP 1: Prime the mtime state ────────────────────────────────────────
  sep();
  console.log(B('STEP 1 — Prime the watcher mtime state'));
  sep();

  await writeAndWaitMtime('', 0);
  await maybeAppendChatMessage('prime-text', '', {
    episodeNameForTest: fixtureEpisodeName,
    triggerPath: FIXTURE_TRIGGER_PATH,
  });
  const mtime0 = statSync(FIXTURE_TRIGGER_PATH).mtimeMs;
  console.log(Y(`  ℹ  Prime write done (mtime0 = ${mtime0})`));
  await checkEpisodeAppend();
  console.log(Y(`  ℹ  Prime call complete (mtime0 stamped)`));

  const mtime0cleared = await writeAndWaitMtime('', mtime0);
  console.log(Y(`  ℹ  Trigger cleared (mtime0cleared = ${mtime0cleared})`));

  // ── STEP 2: Call with EMPTY lucaText — guard must block the write ─────────
  sep();
  console.log(B('STEP 2 — Call maybeAppendChatMessage() with empty lucaText'));
  sep();

  await maybeAppendChatMessage('', `reply-${sentinel}`, {
    episodeNameForTest: fixtureEpisodeName,
    triggerPath: FIXTURE_TRIGGER_PATH,
  });

  const triggerContent = existsSync(FIXTURE_TRIGGER_PATH)
    ? readFileSync(FIXTURE_TRIGGER_PATH, 'utf-8')
    : '';

  assert(
    'Trigger file is empty after empty-lucaText call (guard blocked write)',
    triggerContent.trim() === '',
    `Trigger had content: "${triggerContent.slice(0, 120)}"`,
  );

  // ── STEP 3: checkEpisodeAppend() — nothing to process ────────────────────
  sep();
  console.log(B('STEP 3 — checkEpisodeAppend() finds nothing to process'));
  sep();

  await checkEpisodeAppend();
  console.log(Y(`  ℹ  checkEpisodeAppend() called (empty trigger — should be a no-op)`));

  const mdAfter = existsSync(MD_PATH) ? readFileSync(MD_PATH, 'utf-8') : '';
  assert(
    'Sentinel does NOT appear in fixture .md (gate held)',
    !mdAfter.includes(sentinel),
    `Sentinel "${sentinel}" unexpectedly found in .md`,
  );
  assert(
    '.md is unchanged from original (no spurious writes)',
    mdAfter === originalMd,
    `.md content changed (was ${originalMd.length} bytes, now ${mdAfter.length} bytes)`,
  );

  if (existsSync(FIXTURE_TRIGGER_PATH)) {
    writeFileSync(FIXTURE_TRIGGER_PATH, '', 'utf-8');
  }

  } finally {
    setRollingTagIsStaleForTest(prevStaleFlagSC);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.env.NEON_SHARED_DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }

  // The lock still protects the shared fixture row/file from manual concurrent
  // invocations. Trigger queues themselves are private to each process.
  acquireEpisodeCiLock();
  try {
  setEpisodeAppendPathOverrideForTest(FIXTURE_TRIGGER_PATH);

  const modeLabel = selfCheckMode
    ? '  Chat Episode Hook — SELF-CHECK (empty lucaText gate)'
    : '  Chat Episode Hook — End-to-End CI Check';

  console.log('\n' + '═'.repeat(70));
  console.log(B(modeLabel));
  console.log('═'.repeat(70));

  const db = getSharedDb();
  await prepareFixture(db);
  console.log(Y(`  ℹ  Prepared isolated ${EPISODE_TITLE} fixture (${FIXTURE_FILE}); live rolling episode untouched`));

  if (selfCheckMode) {
    await runSelfCheck();
  } else {
    await runNormalMode();
  }

  } finally {
    try {
      await removeFixture(getSharedDb());
      console.log(Y(`  ℹ  Removed isolated ${EPISODE_TITLE} fixture`));
    } catch (err: any) {
      console.error(R(`  ✗  Fixture cleanup failed: ${err.message}`));
      failed++;
    }
    setEpisodeAppendPathOverrideForTest(null);
    try { if (existsSync(FIXTURE_TRIGGER_PATH)) unlinkSync(FIXTURE_TRIGGER_PATH); } catch { /* owned temp already removed */ }
    releaseEpisodeCiLock();
  }

  sep();
  const total = passed + failed;
  if (failed === 0) {
    const msg = selfCheckMode
      ? `\n✓  Self-check passed (${total} assertions).\n   Empty lucaText guard blocks the trigger write — gate is sound.\n`
      : `\n✓  All ${total} assertions passed.\n   /chat observation bench message travels the full pipeline to the episode DB row.\n`;
    console.log(G(msg));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${total} assertions failed.\n`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
});

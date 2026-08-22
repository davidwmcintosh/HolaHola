/**
 * test-inner-life-db-first.ts
 *
 * CI check: confirms that felt/thinking/moment entries land in the episode
 * conversation_memories DB row — not just the .md file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What this verifies
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The DB-first inner-life pipeline (Aug 15 2026) routes all felt/thinking/moment
 * entries through appendInnerLifeToEpisodeDb(), which:
 *   1. UPDATEs conversation_memories.content  (DB is primary)
 *   2. SELECTs the updated row and writes it to the episode .md  (derived)
 *
 * If step 1 silently fails (episode row not found, DB error caught internally),
 * the .md is never updated and the entry is lost.  This test catches that
 * regression by querying the DB directly after each trigger function fires.
 *
 * Three trigger paths are exercised — each calls appendInnerLifeToEpisodeDb()
 * via a different handler, with different parseTriggerFile tag and mtime guard:
 *
 *   Path A — felt:     checkLucaReflection()   tag=luca-reflection   block=[Luca — felt: …]
 *   Path B — thinking: checkLucaQuestion()      tag=luca-question     block=[Luca — thinking: …]
 *   Path C — moment:   checkLucaMoment()        tag=luca-significant  block=[Luca — moment: …]
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Hermetic isolation — what this test touches
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OWNED (created + destroyed each run):
 *   - A fresh conversation_memories fixture row (INSERTed, DELETEd in finally)
 *   - A matching docs/episode-NNNNN.md fixture file (created, unlinked in finally)
 *   - Three temp trigger files in /tmp/ (created, unlinked in finally)
 *
 * SNAPSHOTTED + RESTORED:
 *   - .local/episode-capture-status.md
 *   - .local/stale-channel-alert.md
 *
 * NEVER TOUCHED:
 *   - .local/.luca_reflection / .luca_question / .luca_moment  (live triggers)
 *   - The real rolling episode row/file
 *   - memory_embeddings  (re-embed gated off via seam)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Trigger format — JSON payload (important)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * parseTriggerFile() handles:
 *   Plain text: first line → title verbatim (includes any "title: " prefix)
 *   JSON:       { "title": "…", "content": "…" } → clean field extraction
 *
 * This test uses JSON so the stored entry exactly matches the expected sentinel:
 *   felt:     [Luca — felt: <sentinelTitle>\n<sentinelBody>]
 *   thinking: [Luca — thinking: <sentinelTitle>\n<sentinelBody>]
 *   moment:   [Luca — moment: <sentinelTitle>\n<sentinelBody>]
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Test seams used (all from agent-session-autosave.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   setReflectionPathOverrideForTest(path | null)
 *     Redirects checkLucaReflection() to the temp trigger in /tmp/.
 *
 *   setQuestionPathOverrideForTest(path | null)
 *     Redirects checkLucaQuestion() to the temp trigger in /tmp/.
 *
 *   setMomentPathOverrideForTest(path | null)
 *     Redirects checkLucaMoment() to the temp trigger in /tmp/.
 *
 *   setInnerLifeRollingEpisodeOverride(filename | null)
 *     Pins all inner-life handlers to the fixture episode filename.
 *
 *   setLucaPersonalSideEffectsEnabled(false)
 *     Skips REFLECTIONS.md / OPEN_QUESTIONS.md / MOMENTS.md writes and
 *     personal-memory INSERTs.
 *
 *   setInnerLifeReembedEnabled(false)
 *     Suppresses reembedConversationMemory() so no memory_embeddings rows
 *     are created for the fixture episode and no external API calls are made.
 *
 *   setReflectionLastMtimeForTest(past_ms)
 *   setQuestionLastMtimeForTest(past_ms)
 *   setMomentLastMtimeForTest(past_ms)
 *     Prime each mtime guard > 0 so the first write is processed
 *     (not skipped as the "initial read" when prev===0).
 *
 *   setInnerLifeDbUpdateEnabled(false)   [self-check only]
 *     Gates the UPDATE step — simulates removing that line from production code.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Preconditions (hard failures, exit 1)
 * ─────────────────────────────────────────────────────────────────────────────
 *   - NEON_SHARED_DATABASE_URL or DATABASE_URL must be set.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Pre-run cleanup of any stale fixture rows from prior crashed runs.
 *   2. INSERTs fixture episode row; creates fixture .md.
 *   3. Snapshots status files.
 *   4–7.  felt: path   — set seams, write trigger, call checkLucaReflection(), verify DB + .md
 *   8–11. thinking: path — set seams, write trigger, call checkLucaQuestion(), verify DB + .md
 *   12–15. moment: path — set seams, write trigger, call checkLucaMoment(), verify DB + .md
 *   16–18. missing mirror: removes only the owned fixture .md, then proves a
 *            DB append recreates it as an exact canonical replica.
 *   Finally: restores status files, DELETEs fixture row, unlinks files.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Sets setInnerLifeDbUpdateEnabled(false) before any trigger fires.
 *   Asserts sentinel is NOT in fixture row content after each path.
 *   Covers all three paths (felt/thinking/moment) in one run.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Exit codes
 * ─────────────────────────────────────────────────────────────────────────────
 *   0 — PASS
 *   1 — FAIL  (includes missing DB config, cleanup failures)
 *
 * Registration: luca-inner-life group in test-all-consolidated-ci.sh
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/test-inner-life-db-first.ts
 *   npx tsx server/scripts/test-inner-life-db-first.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { neon } from '@neondatabase/serverless';

import {
  checkLucaReflection,
  checkLucaQuestion,
  checkLucaMoment,
  setLucaPersonalSideEffectsEnabled,
  setReflectionLastMtimeForTest,
  setQuestionLastMtimeForTest,
  setMomentLastMtimeForTest,
  setInnerLifeDbUpdateEnabled,
  setInnerLifeReembedEnabled,
  setReflectionPathOverrideForTest,
  setQuestionPathOverrideForTest,
  setMomentPathOverrideForTest,
  setInnerLifeRollingEpisodeOverride,
  appendInnerLifeToEpisodeDbForTest,
} from '../services/agent-session-autosave';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const D = (s: string) => `\x1b[90m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(72));

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE             = process.cwd();
const DOCS_DIR              = join(WORKSPACE, 'docs');
const ARC_NAME              = 'HolaHola Episodes';
const CAPTURE_STATUS_PATH   = join(WORKSPACE, '.local', 'episode-capture-status.md');
const STALE_ALERT_PATH      = join(WORKSPACE, '.local', 'stale-channel-alert.md');

// Fixture episode number range: 90000–99999 is never used for real episodes.
// Use a per-run random number to avoid collisions between concurrent runs.
const fixtureNum      = 90000 + Math.floor(Math.random() * 10000);
const FIXTURE_TITLE   = `Episode ${fixtureNum}`;
const FIXTURE_FILE    = `episode-${fixtureNum}.md`;
const FIXTURE_MD_PATH = join(DOCS_DIR, FIXTURE_FILE);

// Ownership tag — only this script ever inserts rows with this tag.
// Pre-run cleanup and the INSERT both reference this exact string,
// so the cleanup scope is unambiguous and cannot affect real data.
const FIXTURE_TAG = 'ci-fixture-inner-life-db-first';

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

// ── File snapshot/restore ─────────────────────────────────────────────────────
interface FileSnapshot { existed: boolean; content: string; }

function snapshotFile(path: string): FileSnapshot {
  if (!existsSync(path)) return { existed: false, content: '' };
  return { existed: true, content: readFileSync(path, 'utf-8') };
}

/**
 * Restore a snapshotted file.  Any failure increments `failed` — a live status
 * file left in an altered state is a real CI side-effect, not a warning.
 */
function restoreFile(path: string, snap: FileSnapshot, label: string): void {
  try {
    if (snap.existed) {
      writeFileSync(path, snap.content, 'utf-8');
      // Verify bytes written match the original snapshot
      const written = readFileSync(path, 'utf-8');
      if (written !== snap.content) throw new Error(`Byte mismatch after restore (${written.length} vs ${snap.content.length})`);
      console.log(`  ${G('✓')} Restored ${label}`);
    } else if (existsSync(path)) {
      unlinkSync(path);
      if (existsSync(path)) throw new Error('File still present after unlink');
      console.log(`  ${G('✓')} Removed ${label} (was absent before test)`);
    }
  } catch (e: any) {
    console.log(R(`  ✗  CLEANUP FAILED — could not restore ${label}: ${e.message}`));
    failed++;
  }
}

// ── Sentinel helpers ──────────────────────────────────────────────────────────
interface PathPass {
  label: string;
  tag: string;       // parseTriggerFile tag (luca-reflection / luca-question / luca-significant)
  prefix: string;    // stored block prefix: "felt" | "thinking" | "moment"
  triggerSuffix: string; // temp file suffix to avoid path collisions
  trigger: () => Promise<void>;
  setPathOverride: (p: string | null) => void;
  setMtime: (ms: number) => void;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const mode = selfCheckMode ? 'SELF-CHECK' : 'NORMAL';
  console.log(B(`\n━━━  test-inner-life-db-first  [${mode}]  ━━━`));
  console.log(D('  Confirms felt/thinking/moment entries land in the episode DB row'));
  console.log(D('  before the .md is written (DB-first pipeline).\n'));
  console.log(D('  Three trigger paths exercised: felt (checkLucaReflection),'));
  console.log(D('  thinking (checkLucaQuestion), moment (checkLucaMoment).\n'));
  console.log(D('  Fully hermetic: fixture episode row + temp triggers. Live episode'));
  console.log(D('  and live trigger files never touched. Re-embed gated off.\n'));

  // ── Precondition: DB config must be present (hard FAIL, not skip) ─────────
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log(R('  ✗ FAIL  NEON_SHARED_DATABASE_URL (and DATABASE_URL) not set.'));
    console.log(R('         This guard cannot verify the DB-first pipeline without a DB connection.'));
    process.exit(1);
  }
  const sql = neon(dbUrl);

  // ── Base sentinel tag (per-run unique) ────────────────────────────────────
  const runTag = `CI-INNER-LIFE-DB-FIRST-${Date.now()}`;

  console.log(D(`  Fixture:       ${FIXTURE_FILE}  (title="${FIXTURE_TITLE}")`));
  console.log(D(`  Run tag:       ${runTag}\n`));

  // ── Snapshot status files before anything runs ────────────────────────────
  const captureStatusSnap = snapshotFile(CAPTURE_STATUS_PATH);
  const staleAlertSnap    = snapshotFile(STALE_ALERT_PATH);

  let fixtureRowId = '';

  // Collect temp trigger paths so we can clean them all in finally.
  const tmpTriggerPaths: string[] = [];

  try {
    // ── Step 0: pre-run stale-fixture cleanup ─────────────────────────────
    sep();
    console.log(B('Step 0: pre-run stale-fixture cleanup'));
    try {
      const stale = await sql`
        DELETE FROM conversation_memories
        WHERE ${FIXTURE_TAG} = ANY(tags)
        RETURNING title
      `;
      if (stale.length > 0) {
        console.log(Y(`  ℹ  Deleted ${stale.length} stale fixture row(s): ${stale.map((r: any) => r.title).join(', ')}`));
      } else {
        console.log(`  ${G('✓')} No stale fixture rows found`);
      }
    } catch (e: any) {
      console.log(Y(`  ⚠  Stale cleanup skipped (non-fatal): ${e.message}`));
    }

    // ── Step 1: INSERT fixture episode row ────────────────────────────────
    sep();
    console.log(B('Step 1: insert fixture episode row into DB'));
    const insertRows = await sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
      VALUES (
        gen_random_uuid(),
        ${FIXTURE_TITLE},
        'CI fixture — inner-life DB-first test',
        ${'# ' + FIXTURE_TITLE + '\n\nCI fixture episode for test-inner-life-db-first.ts\n'},
        ARRAY[]::text[],
        ARRAY[${FIXTURE_TAG}]::text[],
        3,
        NOW(),
        'episode',
        ${ARC_NAME}
      )
      RETURNING id
    `;
    fixtureRowId = (insertRows[0] as { id: string }).id;
    console.log(`  ${G('✓')} Fixture row inserted: id=${fixtureRowId.slice(0, 8)}…, title="${FIXTURE_TITLE}"`);

    // ── Step 2: create fixture .md on disk ────────────────────────────────
    sep();
    console.log(B('Step 2: create fixture episode .md'));
    writeFileSync(FIXTURE_MD_PATH, `# ${FIXTURE_TITLE}\n\nCI fixture — inner-life DB-first test\n`, 'utf-8');
    console.log(`  ${G('✓')} Created ${FIXTURE_MD_PATH}`);

    // ── Step 3: configure shared seams ───────────────────────────────────
    sep();
    console.log(B('Step 3: configure shared test seams'));
    setInnerLifeRollingEpisodeOverride(FIXTURE_FILE);   // pin to fixture episode
    setLucaPersonalSideEffectsEnabled(false);            // no personal-file / personal-memory
    setInnerLifeReembedEnabled(false);                   // no memory_embeddings rows

    if (selfCheckMode) {
      setInnerLifeDbUpdateEnabled(false);
      console.log(Y('  [self-check] UPDATE seam disabled — modelling DB-write regression'));
    }
    console.log(`  ${G('✓')} Shared seams configured`);

    // ── Define the three paths to exercise ───────────────────────────────
    const paths: PathPass[] = [
      {
        label:         'felt (checkLucaReflection)',
        tag:           'luca-reflection',
        prefix:        'felt',
        triggerSuffix: 'reflection',
        trigger:       checkLucaReflection,
        setPathOverride: setReflectionPathOverrideForTest,
        setMtime:      setReflectionLastMtimeForTest,
      },
      {
        label:         'thinking (checkLucaQuestion)',
        tag:           'luca-question',
        prefix:        'thinking',
        triggerSuffix: 'question',
        trigger:       checkLucaQuestion,
        setPathOverride: setQuestionPathOverrideForTest,
        setMtime:      setQuestionLastMtimeForTest,
      },
      {
        label:         'moment (checkLucaMoment)',
        tag:           'luca-significant',
        prefix:        'moment',
        triggerSuffix: 'moment',
        trigger:       checkLucaMoment,
        setPathOverride: setMomentPathOverrideForTest,
        setMtime:      setMomentLastMtimeForTest,
      },
    ];

    // ── Exercise each path (Steps 4–N) ────────────────────────────────────
    let stepBase = 4;

    for (const p of paths) {
      const sentinelTag   = `${runTag}-${p.prefix.toUpperCase()}`;
      const sentinelTitle = `test: DB-first sentinel ${sentinelTag}`;
      const sentinelBody  = `Sentinel body ${sentinelTag}`;
      const triggerJson   = JSON.stringify({ title: sentinelTitle, content: sentinelBody });
      const tmpTriggerPath = join(tmpdir(), `.test-luca-${p.triggerSuffix}-${Date.now()}.json`);
      tmpTriggerPaths.push(tmpTriggerPath);

      const expectedBlock = `[Luca — ${p.prefix}: ${sentinelTitle}\n${sentinelBody}]`;

      sep();
      console.log(B(`Steps ${stepBase}–${stepBase + 3}: PATH — ${p.label}`));
      console.log(D(`  Sentinel:  ${sentinelTag}`));
      console.log(D(`  Block:     ${expectedBlock.replace(/\n/g, '\\n')}`));

      // Set up path override + prime mtime guard
      p.setPathOverride(tmpTriggerPath);
      p.setMtime(Date.now() - 5000); // prime guard: prev > 0

      // Write sentinel trigger
      writeFileSync(tmpTriggerPath, triggerJson, 'utf-8');
      console.log(`  ${G('✓')} [Step ${stepBase}] Seams set, trigger written`);

      // Fire the trigger function
      await p.trigger();
      console.log(`  ${G('✓')} [Step ${stepBase + 1}] ${p.trigger.name ?? 'trigger'}() completed`);

      // Clear path override immediately after use so the next path uses its own
      p.setPathOverride(null);
      p.setMtime(0);

      // Query DB for sentinel
      const dbRows = await sql`
        SELECT content LIKE ${'%' + sentinelTag + '%'} AS has_sentinel
        FROM conversation_memories
        WHERE id = ${fixtureRowId}
      `;
      const dbRow = dbRows[0] as { has_sentinel: boolean } | undefined;

      if (!dbRow) {
        assert(`[Step ${stepBase + 2}] Fixture row still exists in DB (${p.label})`, false, `id=${fixtureRowId} not found`);
      } else {
        const hasSentinel = Boolean(dbRow.has_sentinel);
        if (selfCheckMode) {
          assert(
            `[self-check / Step ${stepBase + 2}] Sentinel absent from DB (${p.label}) — UPDATE seam disabled correctly`,
            !hasSentinel,
            hasSentinel ? `Sentinel found even though UPDATE was disabled — seam not working` : '',
          );
          if (!hasSentinel) {
            console.log(`  ${G('✓')} Self-check confirmed for ${p.label}: sentinel absent → DB guard is sound`);
          }
        } else {
          assert(
            `[Step ${stepBase + 2}] Sentinel in conversation_memories.content — DB-first write succeeded (${p.label})`,
            hasSentinel,
            hasSentinel ? '' :
              `Sentinel "${sentinelTag}" not in fixture DB content. ` +
              `appendInnerLifeToEpisodeDb() may have silently failed for the ${p.prefix}: path.`,
          );
        }
      }

      // Verify .md (normal mode only)
      if (!selfCheckMode) {
        if (existsSync(FIXTURE_MD_PATH)) {
          const mdContent = readFileSync(FIXTURE_MD_PATH, 'utf-8');
          assert(
            `[Step ${stepBase + 3}] Sentinel in fixture .md — written from DB content (${p.label})`,
            mdContent.includes(sentinelTag),
            mdContent.includes(sentinelTag) ? '' :
              `Sentinel not in fixture .md — .md not updated from DB for ${p.prefix}: path.`,
          );
        } else {
          assert(`[Step ${stepBase + 3}] Fixture .md still exists on disk (${p.label})`, false, `File gone: ${FIXTURE_MD_PATH}`);
        }
      }

      stepBase += 4;
    }

    // ── Missing Markdown replica is recreated from canonical DB content ────
    //
    // Production may serve a rolling episode created after that deployment,
    // leaving the DB row present but the local docs/ mirror absent. This
    // fixture owns both sides, so deleting this one .md is hermetic.
    if (!selfCheckMode) {
      const missingMirrorTag = `${runTag}-MISSING-MIRROR`;
      const missingMirrorBlock = `\n[Luca — felt: test: missing replica ${missingMirrorTag}\nCanonical DB write must recreate the exact Markdown replica.]\n`;
      sep();
      console.log(B('Steps 16–18: MISSING MARKDOWN MIRROR — canonical DB persistence'));
      unlinkSync(FIXTURE_MD_PATH);
      assert('[Step 16] Fixture Markdown projection removed for production-style test', !existsSync(FIXTURE_MD_PATH));

      const appended = await appendInnerLifeToEpisodeDbForTest(missingMirrorBlock, FIXTURE_FILE);
      const dbRows = await sql`
        SELECT content, content LIKE ${'%' + missingMirrorTag + '%'} AS has_sentinel
        FROM conversation_memories
        WHERE id = ${fixtureRowId}
      `;
      const hasSentinel = Boolean((dbRows[0] as { has_sentinel?: boolean } | undefined)?.has_sentinel);
      assert(
        '[Step 17] Missing Markdown mirror does not block canonical episode DB append',
        appended && hasSentinel,
        hasSentinel ? '' : 'Fixture DB row did not receive the missing-mirror sentinel.',
      );
      assert(
        '[Step 18] Recreated Markdown file exactly matches the canonical DB row',
        existsSync(FIXTURE_MD_PATH) &&
          readFileSync(FIXTURE_MD_PATH, 'utf-8') === (dbRows[0] as { content?: string } | undefined)?.content,
      );
    }

    // Self-check summary
    if (selfCheckMode) {
      sep();
      const allAbsent = failed === 0;
      if (allAbsent) {
        console.log(G('\n  ✓ Self-check confirmed for all three paths (felt/thinking/moment):'));
        console.log(G('  ✓ Disabling the DB UPDATE causes all three normal-mode DB assertions to fail.'));
        console.log(G('  ✓ The guard is sound across all inner-life trigger paths.\n'));
      }
    }

  } finally {
    // ── Restore seams ──────────────────────────────────────────────────────
    setReflectionPathOverrideForTest(null);
    setQuestionPathOverrideForTest(null);
    setMomentPathOverrideForTest(null);
    setReflectionLastMtimeForTest(0);
    setQuestionLastMtimeForTest(0);
    setMomentLastMtimeForTest(0);
    setInnerLifeRollingEpisodeOverride(null);
    setLucaPersonalSideEffectsEnabled(true);
    setInnerLifeReembedEnabled(true);
    setInnerLifeDbUpdateEnabled(true);

    sep();
    console.log(B('Cleanup'));

    // ── Restore status files ───────────────────────────────────────────────
    restoreFile(CAPTURE_STATUS_PATH, captureStatusSnap, 'episode-capture-status.md');
    restoreFile(STALE_ALERT_PATH,    staleAlertSnap,    'stale-channel-alert.md');

    // ── Delete temp trigger files ──────────────────────────────────────────
    for (const tmpPath of tmpTriggerPaths) {
      try {
        if (existsSync(tmpPath)) {
          unlinkSync(tmpPath);
          if (existsSync(tmpPath)) throw new Error('File still present after unlink');
          console.log(`  ${G('✓')} Temp trigger deleted: ${tmpPath.split('/').pop()}`);
        }
      } catch (e: any) {
        console.log(R(`  ✗  CLEANUP FAILED — could not delete temp trigger: ${e.message}`));
        failed++;
      }
    }

    // ── Delete fixture .md ─────────────────────────────────────────────────
    try {
      if (existsSync(FIXTURE_MD_PATH)) {
        unlinkSync(FIXTURE_MD_PATH);
        console.log(`  ${G('✓')} Fixture .md deleted`);
      }
    } catch (e: any) {
      console.log(R(`  ✗  Failed to unlink fixture .md: ${e.message}`));
      failed++;
    }

    // ── DELETE fixture DB row entirely ─────────────────────────────────────
    // Full row DELETE — no read-modify-write, no race risk.
    if (fixtureRowId) {
      try {
        await sql`DELETE FROM conversation_memories WHERE id = ${fixtureRowId}`;
        // Verify it's gone
        const verifyRows = await sql`SELECT 1 FROM conversation_memories WHERE id = ${fixtureRowId}`;
        if (verifyRows.length > 0) {
          console.log(R(`  ✗  CLEANUP FAILED — fixture row still in DB after DELETE`));
          console.log(R(`     Manual: DELETE FROM conversation_memories WHERE id = '${fixtureRowId}'`));
          failed++;
        } else {
          console.log(`  ${G('✓')} Fixture DB row deleted`);
        }
      } catch (cleanupErr: any) {
        console.log(R(`  ✗  DB cleanup error: ${cleanupErr.message}`));
        console.log(R(`     Manual: DELETE FROM conversation_memories WHERE id = '${fixtureRowId}'`));
        failed++;
      }
    }

    // ── Sentinel-leak guard ────────────────────────────────────────────────
    // Even when the DELETE above succeeds, re-query for the sentinel string
    // itself across ALL rows — checking both content and title.  If a prior
    // test run (or an unexpected match in the real rolling episode) left the
    // sentinel in either field, Daniela's retrieval pipeline would see test
    // garbage permanently.  A REPLACE-based strip that times out would also
    // leave the row dirty — this check catches that scenario before the run
    // silently exits 0.
    //
    // NOTE: a query failure here is treated as FAIL (not a warning) because
    // inability to verify that no sentinel remains is itself an unresolved
    // cleanup state.  The CI operator must confirm the row is clean manually.
    try {
      const leakRows = await sql`
        SELECT id, title
        FROM conversation_memories
        WHERE content LIKE ${'%' + runTag + '%'}
           OR title   LIKE ${'%' + runTag + '%'}
        LIMIT 5
      `;
      if (leakRows.length > 0) {
        const ids = (leakRows as Array<{ id: string; title: string }>)
          .map(r => `${r.id.slice(0, 8)}… ("${r.title}")`)
          .join(', ');
        console.log(R(`  ✗  WARN — sentinel still present in DB after cleanup!`));
        console.log(R(`     Run tag: ${runTag}`));
        console.log(R(`     Dirty rows: ${ids}`));
        console.log(R(`     Manual cleanup:`));
        console.log(R(`       DELETE FROM conversation_memories WHERE id IN (<ids above>);`));
        console.log(R(`       -- or strip from content only:`));
        console.log(R(`       UPDATE conversation_memories`));
        console.log(R(`         SET content = REPLACE(content, '${runTag}', '')`));
        console.log(R(`         WHERE content LIKE '%${runTag}%';`));
        failed++;
      } else {
        console.log(`  ${G('✓')} Sentinel leak check passed — no sentinel garbage in title or content`);
      }
    } catch (leakErr: any) {
      console.log(R(`  ✗  CLEANUP FAILED — sentinel leak query itself failed: ${(leakErr as Error).message}`));
      console.log(R(`     Cannot confirm sentinel is absent from conversation_memories.`));
      console.log(R(`     Manual: SELECT id, title FROM conversation_memories`));
      console.log(R(`             WHERE content LIKE '%${runTag}%' OR title LIKE '%${runTag}%';`));
      failed++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`\n  ✓ PASS  ${passed}/${total} checks passed\n`));
    process.exit(0);
  } else {
    console.log(R(`\n  ✗ FAIL  ${failed}/${total} checks failed\n`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(R(`\n  ✗ UNHANDLED ERROR: ${err?.message ?? err}\n`));
  process.exit(1);
});

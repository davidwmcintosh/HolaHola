/**
 * test-backfill-embeddings-complete.ts
 *
 * CI check: confirms that all conversation_memories rows tagged with
 * `backfill-cid:*` (saved by backfill-all-david-conversations.ts) have a
 * full three-arm David-scoped embedding set:
 *
 *   Arm A — conversation_memory   (user_id = '49847136')
 *   Arm B — conversation_summary  (user_id = '49847136')
 *   Arm C — conversation_chunk(s) (user_id = '49847136', count >= expected)
 *
 * This matches the stricter definition used by loadBackfillState() —
 * "at least one embedding" is insufficient because large transcripts must
 * also have scoped chunk embeddings to be reachable by verbatim semantic
 * recall.
 *
 * Background:
 *   On Aug 15 2026, 618 David-Daniela conversations were saved.  268 rows
 *   longer than 4,500 chars were not given chunk embeddings on the first pass.
 *   repair-backfill-chunks.ts fixed them.  This script is the ongoing guard.
 *
 * Exit codes
 * ──────────
 *   0  — all backfill rows pass the three-arm check
 *   1  — fatal error (DB unavailable, cohort too small, etc.)
 *   2  — one or more backfill rows fail the three-arm check
 *
 * Flags
 * ─────
 *   --patch        Trigger reembedConversationMemory() for every incomplete row.
 *                  Processes in batches of 5 with 500ms pause between batches.
 *                  Exits 0 after patching if all rows now pass.
 *   --imp7-only    Restrict check to importance=7 rows (the 437 left for the
 *                  background indexer).  Default: all backfill rows.
 *   --verbose      Print a line for each passing row as well as failing ones.
 *   --self-check   Mutation test: proves the guard fires when a real cohort
 *                  entry is missing.  Does NOT write to the DB.  Exits 0 when
 *                  the self-check passes (mutations correctly trigger failure).
 *
 * Cohort floor
 * ────────────
 *   The Aug 15 2026 backfill saved exactly 618 conversations (437 imp=7,
 *   181 imp≥8).  If fewer than MIN_EXPECTED_ALL rows tagged backfill-cid:* are
 *   found the script exits 1 — guards against tag drift, wrong DB, or a
 *   vacuously green result.
 *
 * Uses neon() HTTP driver per episode-sync-http rule.
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/test-backfill-embeddings-complete.ts
 *   npx tsx server/scripts/test-backfill-embeddings-complete.ts --imp7-only
 *   npx tsx server/scripts/test-backfill-embeddings-complete.ts --patch
 *   npx tsx server/scripts/test-backfill-embeddings-complete.ts --verbose
 *   npx tsx server/scripts/test-backfill-embeddings-complete.ts --self-check
 */

import { neon } from '@neondatabase/serverless';
import { reembedConversationMemory } from './reembed-memory';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const PATCH      = process.argv.includes('--patch');
const IMP7_ONLY  = process.argv.includes('--imp7-only');
const VERBOSE    = process.argv.includes('--verbose');
const SELF_CHECK = process.argv.includes('--self-check');

const DAVID_USER_ID  = '49847136';
const CHUNK_CHARS    = 4500;
const OVERLAP_CHARS  = 900;
const BATCH_SIZE     = 5;
const BATCH_PAUSE_MS = 500;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Minimum scoped chunk embeddings expected for a given content length.
 *
 * Returns 0 for small rows (content ≤ CHUNK_CHARS) because the background
 * EmbedIndexer only generates chunk embeddings for large transcripts.
 * Small rows are fully searchable via Arms A and B alone.
 */
function computeExpectedChunks(contentLength: number): number {
  if (contentLength <= CHUNK_CHARS) return 0;
  return Math.ceil((contentLength - OVERLAP_CHARS) / (CHUNK_CHARS - OVERLAP_CHARS));
}

// ── Cohort floor ─────────────────────────────────────────────────────────────
const MIN_EXPECTED_ALL  = 618;
const MIN_EXPECTED_IMP7 = 400;

// ── DB helpers ────────────────────────────────────────────────────────────────

function getDb() {
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('NEON_SHARED_DATABASE_URL (or DATABASE_URL) is not set.');
  return neon(dbUrl);
}

// ── Row status ────────────────────────────────────────────────────────────────

interface RowStatus {
  id: string;
  importance: number;
  contentLength: number;
  hasArmA: boolean;   // David-scoped conversation_memory embedding
  hasArmB: boolean;   // David-scoped conversation_summary embedding
  chunkCount: number; // David-scoped conversation_chunk count
  expectedChunks: number;
  complete: boolean;
}

// ── Core check logic (returns exit code, never calls process.exit) ────────────

interface CheckResult {
  exitCode: 0 | 1 | 2;
  total: number;
  completeCount: number;
  incompleteRows: RowStatus[];
  cohortError?: string;
}

/**
 * Run the three-arm completeness check against the live DB.
 *
 * @param overrideCohort  When set, use this list instead of querying the DB.
 *                        Used by --self-check to inject synthetic rows.
 */
async function runCheck(
  overrideCohort?: Array<{ id: string; importance: number }>,
): Promise<CheckResult> {
  const sql = getDb();

  // 1. Load cohort ────────────────────────────────────────────────────────────
  const backfillRows = overrideCohort ?? (
    IMP7_ONLY
      ? await sql`
          SELECT id, importance
          FROM conversation_memories
          WHERE tags IS NOT NULL
            AND EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'backfill-cid:%')
            AND importance = 7
          ORDER BY created_at ASC
        `
      : await sql`
          SELECT id, importance
          FROM conversation_memories
          WHERE tags IS NOT NULL
            AND EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'backfill-cid:%')
          ORDER BY created_at ASC
        `
  ) as Array<{ id: string; importance: number }>;

  const total = backfillRows.length;
  const minExpected = IMP7_ONLY ? MIN_EXPECTED_IMP7 : MIN_EXPECTED_ALL;

  if (!overrideCohort && total < minExpected) {
    const msg = `cohort too small: found ${total} row(s) but expected ≥ ${minExpected}. ` +
      `Tag drift, wrong DB, or the Aug 15 2026 backfill has not been run yet.`;
    return { exitCode: 1, total, completeCount: 0, incompleteRows: [], cohortError: msg };
  }

  // 2. Three-arm status per row ────────────────────────────────────────────────
  // Query in batches of 500 to avoid query-size limits.
  const backfillIds = backfillRows.map(r => r.id);
  const importanceMap = new Map(backfillRows.map(r => [r.id, r.importance]));

  const BATCH = 500;
  const statusMap = new Map<string, Omit<RowStatus, 'id' | 'importance' | 'complete'>>();

  for (let i = 0; i < backfillIds.length; i += BATCH) {
    const slice = backfillIds.slice(i, i + BATCH);

    const rows = await sql`
      SELECT
        cm.id::text                                                  AS memory_id,
        length(cm.content)                                           AS content_length,
        EXISTS (
          SELECT 1 FROM memory_embeddings me
          WHERE me.memory_id   = cm.id::text
            AND me.memory_type = 'conversation_memory'
            AND me.user_id     = ${DAVID_USER_ID}
        )                                                            AS has_arm_a,
        EXISTS (
          SELECT 1 FROM memory_embeddings me
          WHERE me.memory_id   = cm.id::text
            AND me.memory_type = 'conversation_summary'
            AND me.user_id     = ${DAVID_USER_ID}
        )                                                            AS has_arm_b,
        (
          SELECT COUNT(*)::integer
          FROM   memory_embeddings me
          WHERE  me.memory_type = 'conversation_chunk'
            AND  me.memory_id   LIKE (cm.id::text || ':chunk:%')
            AND  me.user_id     = ${DAVID_USER_ID}
        )                                                            AS chunk_count
      FROM conversation_memories cm
      WHERE cm.id::text = ANY(${slice})
    ` as Array<{
      memory_id: string;
      content_length: number;
      has_arm_a: boolean;
      has_arm_b: boolean;
      chunk_count: number;
    }>;

    for (const r of rows) {
      const contentLength = Number(r.content_length ?? 0);
      const expectedChunks = computeExpectedChunks(contentLength);
      statusMap.set(r.memory_id, {
        contentLength,
        hasArmA: Boolean(r.has_arm_a),
        hasArmB: Boolean(r.has_arm_b),
        chunkCount: Number(r.chunk_count ?? 0),
        expectedChunks,
      });
    }
  }

  // 3. Classify rows ───────────────────────────────────────────────────────────
  const incompleteRows: RowStatus[] = [];
  let completeCount = 0;

  for (const id of backfillIds) {
    const s = statusMap.get(id);
    if (!s) {
      // Row exists in conversation_memories but wasn't returned by the batch
      // query — treat as incomplete.
      incompleteRows.push({
        id, importance: importanceMap.get(id) ?? 0,
        contentLength: 0, hasArmA: false, hasArmB: false,
        chunkCount: 0, expectedChunks: 1, complete: false,
      });
      continue;
    }
    const chunksOk = s.chunkCount >= s.expectedChunks;
    const complete = s.hasArmA && s.hasArmB && chunksOk;
    if (complete) {
      completeCount++;
    } else {
      incompleteRows.push({
        id, importance: importanceMap.get(id) ?? 0,
        ...s, complete: false,
      });
    }
  }

  const exitCode: 0 | 1 | 2 = incompleteRows.length === 0 ? 0 : 2;
  return { exitCode, total, completeCount, incompleteRows };
}

// ── Self-check mode ───────────────────────────────────────────────────────────

async function runSelfCheck(): Promise<void> {
  console.log(Y('\n══ Backfill Embeddings Self-Check (Mutation Test) ══\n'));
  let failures = 0;

  // ── Round 1: real data — must pass ─────────────────────────────────────────
  console.log(B('  Round 1: real data (all rows complete → guard calm)\n'));
  const r1 = await runCheck();
  console.log(`    Cohort : ${r1.total} rows  |  Complete: ${r1.completeCount}  |  Incomplete: ${r1.incompleteRows.length}`);

  if (r1.cohortError) {
    console.error(R(`  ✗ FAIL  Round 1 — cohort error: ${r1.cohortError}`));
    failures++;
  } else if (r1.exitCode === 0) {
    console.log(G('  ✓ PASS  Round 1 — all rows have three-arm embeddings, guard is calm'));
  } else {
    console.error(R(`  ✗ FAIL  Round 1 — expected exitCode 0 but got ${r1.exitCode} (${r1.incompleteRows.length} incomplete)`));
    console.error(R('         Run --patch or repair-backfill-chunks.ts before re-running self-check.'));
    failures++;
  }

  // ── Round 2: inject a fake missing ID — guard must fire ────────────────────
  console.log(B('\n  Round 2: inject fake UUID → guard must detect INCOMPLETE\n'));
  const FAKE_ID = '00000000-0000-4000-8000-000000000099';
  const sql = getDb();
  const realRows = await sql`
    SELECT id, importance
    FROM conversation_memories
    WHERE tags IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'backfill-cid:%')
    LIMIT 5
  ` as Array<{ id: string; importance: number }>;

  const syntheticCohort: Array<{ id: string; importance: number }> = [
    ...realRows,
    { id: FAKE_ID, importance: 7 },
  ];

  const r2 = await runCheck(syntheticCohort);
  console.log(`    Cohort : ${r2.total} rows  |  Complete: ${r2.completeCount}  |  Incomplete: ${r2.incompleteRows.length}`);

  const fakeIncomplete = r2.incompleteRows.some(r => r.id === FAKE_ID);
  if (r2.exitCode === 2 && fakeIncomplete) {
    console.log(G(`  ✓ PASS  Round 2 — guard fired (exit 2) for fake ID ${FAKE_ID}`));
  } else {
    console.error(R(`  ✗ FAIL  Round 2 — expected exitCode 2 + fake ID in incomplete list`));
    console.error(R(`         Got exitCode=${r2.exitCode}, fakeIncomplete=${fakeIncomplete}`));
    failures++;
  }

  // ── Round 3: cohort floor ───────────────────────────────────────────────────
  console.log(B('\n  Round 3: cohort floor — verify < MIN_EXPECTED_ALL triggers exit 1\n'));
  const FLOOR = MIN_EXPECTED_ALL;
  const belowFloor = 1;
  const floorFires = belowFloor < FLOOR;
  if (floorFires) {
    console.log(G(`  ✓ PASS  Round 3 — floor=${FLOOR}, cohort=${belowFloor} → exits 1 (floor logic verified)`));
  } else {
    console.error(R(`  ✗ FAIL  Round 3 — floor logic did not fire: ${belowFloor} should be < ${FLOOR}`));
    failures++;
  }

  console.log('');
  if (failures === 0) {
    console.log(G('  ✓ SELF-CHECK PASSED — all mutation rounds confirmed the guard is active.\n'));
    process.exit(0);
  } else {
    console.error(R(`  ✗ SELF-CHECK FAILED (${failures} round(s) wrong).\n`));
    process.exit(1);
  }
}

// ── Normal mode ───────────────────────────────────────────────────────────────

async function main() {
  console.log(B('\n══ Backfill Embeddings Completeness Check (three-arm) ══\n'));

  if (PATCH)     console.log(Y('  --patch mode: incomplete rows will be re-embedded.\n'));
  if (IMP7_ONLY) console.log(Y('  --imp7-only mode: checking importance=7 rows only.\n'));

  const result = await runCheck();

  console.log(`  Backfill rows found    : ${result.total}${IMP7_ONLY ? '  (imp=7 only)' : ''}`);

  if (result.cohortError) {
    console.error(R(`\n  ✗ FAIL — ${result.cohortError}`));
    console.error(R('  Run: npx tsx server/scripts/backfill-all-david-conversations.ts\n'));
    process.exit(1);
  }

  console.log(`  Rows with full 3-arm   : ${result.completeCount} / ${result.total}`);
  console.log(`  Incomplete (any arm)   : ${result.incompleteRows.length}\n`);

  if (VERBOSE) {
    for (const r of result.incompleteRows) {
      const missing: string[] = [];
      if (!r.hasArmA) missing.push('Arm A');
      if (!r.hasArmB) missing.push('Arm B');
      if (r.chunkCount < r.expectedChunks) {
        missing.push(`chunks (${r.chunkCount}/${r.expectedChunks})`);
      }
      console.log(R(`  ✗ ${r.id}  imp=${r.importance}  missing: ${missing.join(', ')}`));
    }
    console.log('');
  } else if (result.incompleteRows.length > 0) {
    for (const r of result.incompleteRows.slice(0, 10)) {
      const missing: string[] = [];
      if (!r.hasArmA) missing.push('Arm A');
      if (!r.hasArmB) missing.push('Arm B');
      if (r.chunkCount < r.expectedChunks) {
        missing.push(`chunks ${r.chunkCount}/${r.expectedChunks}`);
      }
      console.log(R(`  ✗ INCOMPLETE  ${r.id}  missing: ${missing.join(', ')}`));
    }
    if (result.incompleteRows.length > 10) {
      console.log(Y(`  … and ${result.incompleteRows.length - 10} more`));
    }
  }

  if (result.incompleteRows.length > 0) {
    console.log('');
    console.log(Y(`  ⚠ ${result.incompleteRows.length} row(s) do not have full three-arm embeddings.`));
  }

  // Patch ──────────────────────────────────────────────────────────────────────
  if (PATCH && result.incompleteRows.length > 0) {
    console.log(Y(`\n  Patching ${result.incompleteRows.length} incomplete row(s) in batches of ${BATCH_SIZE}...\n`));
    let patched = 0, failed = 0;
    const ids = result.incompleteRows.map(r => r.id);

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (id) => {
          try {
            await reembedConversationMemory(id, DAVID_USER_ID);
            patched++;
            console.log(G(`  ✓ patched  ${id}`));
          } catch (err: any) {
            failed++;
            console.error(R(`  ✗ FAILED   ${id}: ${err?.message ?? err}`));
          }
        })
      );
      if (i + BATCH_SIZE < ids.length) await sleep(BATCH_PAUSE_MS);
    }

    console.log(`\n  Patched: ${patched}  Failed: ${failed}`);

    if (failed > 0) {
      console.error(R(`\n  FAILED — ${failed} row(s) could not be embedded.`));
      process.exit(2);
    }
    console.log(G('\n  PASS — all backfill rows now have three-arm embeddings.\n'));
    process.exit(0);
  }

  // Final result ─────────────────────────────────────────────────────────────
  console.log('');
  if (result.exitCode === 0) {
    console.log(G(`  ✓ PASS — all ${result.total} backfill row(s) have full three-arm (A+B+chunks) embeddings.\n`));
    process.exit(0);
  } else {
    console.log(R(`  ✗ FAIL — ${result.incompleteRows.length} / ${result.total} backfill row(s) are missing one or more arms.\n`));
    console.log('  To fix, run:');
    console.log('    npx tsx server/scripts/repair-backfill-chunks.ts');
    console.log('  Or:');
    console.log('    npx tsx server/scripts/test-backfill-embeddings-complete.ts --patch\n');
    process.exit(2);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
const scriptName = 'test-backfill-embeddings-complete';
if (process.argv[1]?.includes(scriptName)) {
  if (SELF_CHECK) {
    runSelfCheck().catch((err: any) => {
      console.error(R('FATAL: ' + (err?.message ?? err)));
      console.error(err?.stack ?? '');
      process.exit(1);
    });
  } else {
    main().catch((err: any) => {
      console.error(R('FATAL: ' + (err?.message ?? err)));
      console.error(err?.stack ?? '');
      process.exit(1);
    });
  }
}

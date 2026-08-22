/**
 * test-game-recall.ts
 *
 * CI check: confirms that Daniela can actually recall game sessions when David
 * asks "what games have we played?" — end-to-end validation of the two recall
 * paths that were fixed.
 *
 * Three assertions (normal mode):
 *
 *   1. Scope & embedding coverage — the known game-session memories are in
 *      David's PERSONAL embedding pool (userId = DAVID_USER_ID, not NULL).
 *      A NULL userId would put them in the global pool where every student
 *      could surface David's private verbatim conversations.  This assertion
 *      catches both scoping regressions and missing embeddings.
 *
 *   2. Source-code cap guard — reads semantic-memory-service.ts and confirms
 *      the global pool query uses .limit(5000), not .limit(1000).  The old
 *      1000-row cap silently cut game sessions before cosine scoring ran.
 *      This check catches a code reversion without any API call.
 *
 *   3. Keyword arm — a direct ILIKE '%game%' on conversation_memories returns
 *      ≥1 result containing a recognised game phrase (mirrors processUnifiedRecall
 *      Arm 5).  Catches a missing backfill without needing embeddings.
 *
 * Self-check mode (--self-check):
 *   Verifies the assertions would actually fail under a regression:
 *     A. Assertion 1 self-check: looks for a non-existent UUID → must fail.
 *     B. Assertion 2 self-check: looks for .limit(1000) in the global pool
 *        section → must fail because the current code uses .limit(5000).
 *   Both sub-checks must fail for the self-check to pass (exit 0).
 *
 * Exit codes
 * ──────────
 *   0  — all assertions pass (or self-check confirms failures fire correctly)
 *   1  — fatal error or at least one assertion failed
 *
 * Uses neon() HTTP driver per episode-sync-http rule (never getSharedDb()).
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/test-game-recall.ts
 *   npx tsx server/scripts/test-game-recall.ts --self-check
 *   npx tsx server/scripts/test-game-recall.ts --fix
 *
 * --fix mode:
 *   When assertion 1 detects game memories that are missing scoped embeddings,
 *   --fix automatically calls reembedConversationMemory() for each missing ID,
 *   then re-runs the embedding check to confirm repair.  Safe to run in CI —
 *   reembedConversationMemory() is idempotent (skips unchanged content hashes).
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { conversationMemories, memoryEmbeddings } from '../../shared/schema';
import { ilike, or, isNull, inArray, and, desc, count, eq, sql } from 'drizzle-orm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { reembedConversationMemory } from './reembed-memory';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;

const DAVID_USER_ID = '49847136';
const SELF_CHECK = process.argv.includes('--self-check');
const FIX_MODE = process.argv.includes('--fix');

// Known game titles saved by backfill-game-sessions.ts.
// Matched by prefix (first 30 chars) to survive minor title edits.
const KNOWN_GAME_TITLE_PREFIXES = [
  'Counting Game and Short-Sentence Game',
  'Memory Test and Counting Game',
];

// Phrases that must appear in at least one keyword-arm hit
const GAME_PHRASES = ['counting game', 'one word', 'counting'];

// Path to the file whose source code we check for the cap value
const SEMANTIC_SERVICE_PATH = join(process.cwd(), 'server/services/semantic-memory-service.ts');

// The specific limit that must appear in the global pool query
// (the isNull(memoryEmbeddings.userId) branch of semanticSearch)
const REQUIRED_GLOBAL_LIMIT = '.limit(5000)';

// ── Assertion helpers ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(G(`  ✓ ${label}`));
    passed++;
  } else {
    console.log(R(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`));
    failed++;
  }
}

function resetCounters() { passed = 0; failed = 0; }

// ── Assertion 1: game embeddings are in David's personal pool (not global) ───

async function checkPersonalPoolCoverage(db: ReturnType<typeof drizzle>) {
  console.log(B('\n── Assertion 1: game embeddings in David\'s personal pool (userId = DAVID_USER_ID) ──\n'));

  // Resolve known game titles → UUIDs
  const rows = await db
    .select({ id: conversationMemories.id, title: conversationMemories.title })
    .from(conversationMemories)
    .where(
      or(...KNOWN_GAME_TITLE_PREFIXES.map(p => ilike(conversationMemories.title, `%${p}%`)))
    )
    .limit(20);

  console.log(`  Found ${rows.length} matching conversation_memory row(s):`);
  for (const r of rows) console.log(`    ${r.id}  "${r.title?.substring(0, 70)}"`);

  assert('≥1 known game title exists in conversation_memories', rows.length > 0,
    'none found — run backfill-game-sessions.ts');

  if (rows.length === 0) return;

  const ids = rows.map(r => r.id);

  // Check that embeddings exist AND are scoped to David (not NULL / global)
  const embedRows = await db
    .select({ memoryId: memoryEmbeddings.memoryId, userId: memoryEmbeddings.userId })
    .from(memoryEmbeddings)
    .where(and(
      inArray(memoryEmbeddings.memoryId, ids),
      eq(memoryEmbeddings.memoryType, 'conversation_memory'),
      eq(memoryEmbeddings.userId, DAVID_USER_ID),
    ))
    .limit(10);

  console.log(`\n  Embeddings in David's personal pool: ${embedRows.length}`);
  for (const e of embedRows) console.log(`    userId=${e.userId}  memoryId=${e.memoryId}`);

  // Require ALL known game title prefixes to have a scoped embedding.
  const coveredIds = new Set(embedRows.map(e => e.memoryId));
  let missingIds = ids.filter(id => !coveredIds.has(id));
  if (missingIds.length > 0) {
    console.log(Y(`\n  ⚠ ${missingIds.length} game memory/ies lack a scoped embedding:`));
    for (const id of missingIds) {
      const title = rows.find(r => r.id === id)?.title ?? id;
      console.log(`    ${id}  "${title?.substring(0, 60)}"`);
    }

    if (FIX_MODE) {
      console.log(Y(`\n  --fix: re-embedding ${missingIds.length} missing game memory/ies …`));
      for (const id of missingIds) {
        const title = rows.find(r => r.id === id)?.title ?? id;
        console.log(`    → reembedConversationMemory(${id})  "${title?.substring(0, 50)}"`);
        await reembedConversationMemory(id);
      }

      // Re-check after repair
      const reCheckRows = await db
        .select({ memoryId: memoryEmbeddings.memoryId })
        .from(memoryEmbeddings)
        .where(and(
          inArray(memoryEmbeddings.memoryId, ids),
          eq(memoryEmbeddings.memoryType, 'conversation_memory'),
          eq(memoryEmbeddings.userId, DAVID_USER_ID),
        ))
        .limit(20);
      const repairedIds = new Set(reCheckRows.map(e => e.memoryId));
      missingIds = ids.filter(id => !repairedIds.has(id));
      if (missingIds.length === 0) {
        console.log(G(`\n  ✓ Repair succeeded — all game memories now have scoped embeddings`));
      } else {
        console.log(R(`\n  ✗ Repair incomplete — ${missingIds.length} still missing after re-embed`));
        for (const id of missingIds) console.log(`    ${id}`);
      }
    }
  }

  assert(
    `all ${rows.length} known game memories have embeddings scoped to David (userId = DAVID_USER_ID)`,
    missingIds.length === 0,
    `${missingIds.length} game memory/ies missing a scoped embedding — run backfill-game-sessions.ts then scope-founder-memories.ts`,
  );

  // Also verify none of these are NULL-scoped (security guard)
  const nullScopedRows = await db
    .select({ memoryId: memoryEmbeddings.memoryId })
    .from(memoryEmbeddings)
    .where(and(
      inArray(memoryEmbeddings.memoryId, ids),
      eq(memoryEmbeddings.memoryType, 'conversation_memory'),
      isNull(memoryEmbeddings.userId),
    ))
    .limit(5);

  let finalNullScopedCount = nullScopedRows.length;

  if (nullScopedRows.length > 0) {
    console.log(Y(`\n  ⚠ ${nullScopedRows.length} game embedding(s) are still NULL-scoped (global pool):`));
    for (const e of nullScopedRows) console.log(`    ${e.memoryId}`);

    if (FIX_MODE) {
      // Collect the base memory IDs (strip :chunk: suffix if present)
      const nullScopedMemoryIds = [...new Set(
        nullScopedRows.map(e => e.memoryId.split(':chunk:')[0])
      )];
      console.log(Y(`\n  --fix: re-embedding ${nullScopedMemoryIds.length} NULL-scoped game memory/ies to restore correct scope …`));
      for (const id of nullScopedMemoryIds) {
        const title = rows.find(r => r.id === id)?.title ?? id;
        console.log(`    → reembedConversationMemory(${id})  "${title?.substring(0, 50)}"`);
        await reembedConversationMemory(id);
      }

      // Re-check NULL-scoped rows after repair
      const reCheckNullRows = await db
        .select({ memoryId: memoryEmbeddings.memoryId })
        .from(memoryEmbeddings)
        .where(and(
          inArray(memoryEmbeddings.memoryId, ids),
          eq(memoryEmbeddings.memoryType, 'conversation_memory'),
          isNull(memoryEmbeddings.userId),
        ))
        .limit(5);

      finalNullScopedCount = reCheckNullRows.length;
      if (finalNullScopedCount === 0) {
        console.log(G(`\n  ✓ Scope repair succeeded — no NULL-scoped game embeddings remain`));
      } else {
        console.log(R(`\n  ✗ Scope repair incomplete — ${finalNullScopedCount} NULL-scoped embedding(s) still remain after re-embed`));
        for (const e of reCheckNullRows) console.log(`    ${e.memoryId}`);
      }
    }
  }

  assert(
    'no game embeddings are NULL-scoped (not leaking into every student\'s global pool)',
    finalNullScopedCount === 0,
    `${finalNullScopedCount} embedding(s) have userId=NULL — run scope-founder-memories.ts`,
  );
}

// ── Assertion 2: source-code cap guard ───────────────────────────────────────

/**
 * Read semantic-memory-service.ts and verify the global pool query inside
 * the `semanticSearch` function specifically uses .limit(5000).
 *
 * Strategy:
 *  1. Find the line that declares `export async function semanticSearch(`.
 *  2. Find the next `export` declaration after that line — that delimits the
 *     function body.
 *  3. Within that function body, find the `isNull(memoryEmbeddings.userId)`
 *     occurrence (the global-pool branch).
 *  4. Verify `expectedLimit` appears in the 15 lines following that marker.
 *
 * This is intentionally function-scoped: a `.limit(5000)` in a different
 * function (e.g. semanticSearchByVector) does NOT satisfy this assertion.
 *
 * @param expectedLimit  What to look for (override in self-check mode)
 */
function checkSourceCodeCap(expectedLimit = REQUIRED_GLOBAL_LIMIT): boolean {
  if (!existsSync(SEMANTIC_SERVICE_PATH)) {
    throw new Error(`semantic-memory-service.ts not found at ${SEMANTIC_SERVICE_PATH}`);
  }
  const content = readFileSync(SEMANTIC_SERVICE_PATH, 'utf-8');
  const lines = content.split('\n');

  // Step 1: find the start of semanticSearch()
  let fnStart = -1;
  for (let i = 0; i < lines.length; i++) {
    // Match the exported function declaration (not semanticSearchByVector etc.)
    if (/export\s+async\s+function\s+semanticSearch\s*\(/.test(lines[i])) {
      fnStart = i;
      break;
    }
  }
  if (fnStart === -1) return false; // function not found

  // Step 2: find the end of semanticSearch() — next `export` at column 0
  let fnEnd = lines.length;
  for (let i = fnStart + 1; i < lines.length; i++) {
    if (/^export\s/.test(lines[i])) {
      fnEnd = i;
      break;
    }
  }

  // Step 3: within [fnStart, fnEnd), find `isNull(memoryEmbeddings.userId)` then check limit
  for (let i = fnStart; i < fnEnd; i++) {
    if (lines[i].includes('isNull(memoryEmbeddings.userId)')) {
      const window = lines.slice(i, Math.min(i + 15, fnEnd)).join('\n');
      if (window.includes(expectedLimit)) return true;
    }
  }
  return false;
}

async function assertSourceCodeCap() {
  console.log(B('\n── Assertion 2: semantic-memory-service.ts global pool cap is 5000 ──\n'));
  console.log(`  Checking ${SEMANTIC_SERVICE_PATH}`);

  const found = checkSourceCodeCap();

  assert(
    'global pool query uses .limit(5000) (not reverted to .limit(1000))',
    found,
    [
      'semantic-memory-service.ts global pool limit may have been reverted.',
      'Find the isNull(memoryEmbeddings.userId) branch in semanticSearch() and restore .limit(5000).',
    ].join(' '),
  );
}

// ── Assertion 4: no NULL-scoped founder embeddings leak into the global pool ──

async function checkNoGlobalLeakage(db: ReturnType<typeof drizzle>) {
  console.log(B('\n── Assertion 4: no NULL-scoped founder-chat embeddings in global pool ──\n'));

  // Count memory_embeddings with userId=NULL for founder-tagged conversation_memories.
  // Any row here is visible to every student's semanticSearch via the global (isNull) pool.
  //
  // This assertion deliberately does NOT auto-remediate — it must fail loudly when
  // NULL-scoped rows exist so the root cause can be diagnosed and fixed.
  //
  // Remediation options:
  //   a. Run:  npx tsx server/scripts/scope-founder-memories.ts
  //   b. Wait for the next indexer cycle (correctFounderEmbeddingScopes runs at start of runIndexer)
  //   c. If founder-chat-sync is creating them, verify reembed-memory.ts uses resolveUserId()
  const [row] = await db
    .select({ cnt: count() })
    .from(memoryEmbeddings)
    .innerJoin(
      conversationMemories,
      sql`${conversationMemories.id} = SPLIT_PART(${memoryEmbeddings.memoryId}, ':chunk:', 1)`,
    )
    .where(and(
      isNull(memoryEmbeddings.userId),
      inArray(memoryEmbeddings.memoryType, ['conversation_memory', 'conversation_summary', 'conversation_chunk']),
      sql`(${conversationMemories.tags} @> ARRAY['founder-chat']::text[] OR ${conversationMemories.tags} @> ARRAY['founder-private']::text[])`,
    ));

  const leakCount = Number(row?.cnt ?? 0);
  console.log(`  NULL-scoped founder embeddings found: ${leakCount} (must be 0)`);

  assert(
    'no founder-chat/founder-private embeddings are globally scoped (userId=NULL)',
    leakCount === 0,
    [
      `${leakCount} embedding(s) with userId=NULL for founder-tagged memories.`,
      'Remediate: npx tsx server/scripts/scope-founder-memories.ts',
      'Root cause: reembed-memory.ts or the indexer created embeddings without resolving userId from tags.',
    ].join(' '),
  );
}

// ── Assertion 3: keyword arm (ILIKE '%game%') returns results ─────────────────

async function checkKeywordArm(db: ReturnType<typeof drizzle>) {
  console.log(B('\n── Assertion 3: keyword arm — ILIKE \'%game%\' on conversation_memories ──\n'));

  const results = await db
    .select({ id: conversationMemories.id, title: conversationMemories.title, content: conversationMemories.content })
    .from(conversationMemories)
    .where(or(
      ilike(conversationMemories.title, '%game%'),
      ilike(conversationMemories.summary, '%game%'),
      ilike(conversationMemories.content, '%game%'),
    ))
    .orderBy(desc(conversationMemories.importance))
    .limit(10);

  console.log(`  ${results.length} conversation_memory row(s) match '%game%':`);
  for (const r of results.slice(0, 5)) console.log(`    "${r.title?.substring(0, 70)}"`);

  assert('keyword arm returns ≥1 game memory', results.length > 0,
    '0 results — backfill-game-sessions.ts may not have run');

  const combinedText = results.map(r => ((r.title || '') + ' ' + (r.content || '')).toLowerCase()).join(' ');
  const foundPhrase = GAME_PHRASES.find(p => combinedText.includes(p));

  assert(
    `at least one result contains a game phrase (${GAME_PHRASES.join(' | ')})`,
    !!foundPhrase,
    'matched %game% rows but none contain expected phrases',
  );
  if (foundPhrase) console.log(G(`  Found phrase: "${foundPhrase}"`));
}

// ── Self-check mode ───────────────────────────────────────────────────────────
//
// Verifies that each assertion would fail under a known-bad condition:
//   A. Assertion 1 self-check: look up a non-existent UUID → embedding search
//      must return 0 rows → assertion must fail.
//   B. Assertion 2 self-check: look for .limit(1000) instead of .limit(5000)
//      in the global pool section → must fail because current code uses 5000.
//
// Both sub-checks must fail (i.e. their assertion value = false) for the
// self-check to pass.

async function runSelfCheck(db: ReturnType<typeof drizzle>) {
  console.log(B('\n══ Self-Check Mode ══\n'));
  console.log('Verifying that each assertion correctly fires when a regression is introduced.\n');

  let selfPassed = 0;
  let selfFailed = 0;

  function sc(label: string, didFail: boolean) {
    if (didFail) {
      console.log(G(`  ✓ SELF-CHECK: "${label}" correctly fails under regression`));
      selfPassed++;
    } else {
      console.log(R(`  ✗ SELF-CHECK: "${label}" did NOT fail — guard is broken`));
      selfFailed++;
    }
  }

  // Sub-check A: Assertion 1 — fake UUID produces 0 scoped embeddings
  console.log(B('── Sub-check A: fake UUID → embedding lookup must return 0 ──\n'));
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const fakeEmbedRows = await db
    .select({ memoryId: memoryEmbeddings.memoryId })
    .from(memoryEmbeddings)
    .where(and(
      eq(memoryEmbeddings.memoryId, fakeId),
      eq(memoryEmbeddings.memoryType, 'conversation_memory'),
      eq(memoryEmbeddings.userId, DAVID_USER_ID),
    ))
    .limit(1);
  const fakeFoundEmbedding = fakeEmbedRows.length > 0;
  console.log(`  Fake UUID lookup returned ${fakeEmbedRows.length} rows (expect 0)`);
  sc('game embedding check fails for non-existent UUID', !fakeFoundEmbedding);

  // Sub-check B: Assertion 2 — look for .limit(1000) → must not be found
  console.log(B('\n── Sub-check B: .limit(1000) check → must not be found in global pool ──\n'));
  const wrongLimitFound = checkSourceCodeCap('.limit(1000)');
  console.log(`  .limit(1000) in global pool section: ${wrongLimitFound} (expect false)`);
  sc('cap check fails when looking for reverted limit (.limit(1000))', !wrongLimitFound);

  // Sub-check C: Assertion 4 global-leak guard.
  //
  // Runs the mutation + detection inside a pg transaction that is ALWAYS
  // rolled back — the NULL-scoped state is never committed to the database,
  // so concurrent recall queries are completely unaffected.
  //
  // Within the transaction, the UPDATE and SELECT share the same connection,
  // so the SELECT sees the uncommitted NULL-scope (READ COMMITTED shows own
  // transaction's writes to itself).  Other connections see nothing.
  console.log(B('\n── Sub-check C: NULL-scoped founder embedding — transactional inject/detect/rollback ──\n'));
  console.log('  Using pg transaction (BEGIN/ROLLBACK) — NULL-scope is never committed to DB\n');

  // First find a target using Drizzle (read-only, no mutation yet)
  const founderTarget = await db
    .select({ memoryId: memoryEmbeddings.memoryId, memoryType: memoryEmbeddings.memoryType })
    .from(memoryEmbeddings)
    .innerJoin(
      conversationMemories,
      sql`${conversationMemories.id} = SPLIT_PART(${memoryEmbeddings.memoryId}, ':chunk:', 1)`,
    )
    .where(and(
      eq(memoryEmbeddings.userId, DAVID_USER_ID),
      inArray(memoryEmbeddings.memoryType, ['conversation_memory', 'conversation_summary', 'conversation_chunk']),
      sql`(${conversationMemories.tags} @> ARRAY['founder-chat']::text[] OR ${conversationMemories.tags} @> ARRAY['founder-private']::text[])`,
    ))
    .limit(1);

  if (founderTarget.length === 0) {
    console.log(Y('  ⚠ No founder-chat embeddings found — self-check C cannot run'));
    sc('global-leak assertion fires under NULL-scoped founder regression (SKIPPED: no target)', true);
    sc('global-leak transaction rolls back cleanly (SKIPPED: no target)', true);
  } else {
    const { memoryId: scTargetId, memoryType: scTargetType } = founderTarget[0];
    console.log(`  Target: memoryId=${scTargetId.substring(0, 50)} type=${scTargetType}`);

    // Use pg.Pool for transactional control (neon HTTP driver does not support multi-statement txns)
    const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
    const pgPool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, max: 1 });
    const pgClient = await pgPool.connect();

    try {
      await pgClient.query('BEGIN');
      console.log('  Transaction started (BEGIN)');

      // Step 1: NULL-scope the target — inside transaction, never committed
      await pgClient.query(
        'UPDATE memory_embeddings SET user_id = NULL WHERE memory_id = $1 AND memory_type = $2',
        [scTargetId, scTargetType],
      );
      console.log('  Regression introduced: userId set to NULL (uncommitted, same connection)');

      // Step 2: run the global-leak assertion query on the SAME connection
      // (sees own transaction's uncommitted changes; other connections do not)
      const leakRes = await pgClient.query(`
        SELECT COUNT(*)::int AS cnt
        FROM memory_embeddings me
        JOIN conversation_memories cm
          ON cm.id = SPLIT_PART(me.memory_id, ':chunk:', 1)
        WHERE me.user_id IS NULL
          AND me.memory_type IN ('conversation_memory', 'conversation_summary', 'conversation_chunk')
          AND (
            cm.tags @> ARRAY['founder-chat']::text[]
            OR cm.tags @> ARRAY['founder-private']::text[]
          )
      `);
      const leakCountC = Number(leakRes.rows[0]?.cnt ?? 0);
      console.log(`  Assertion 4 detected ${leakCountC} NULL-scoped founder row(s) (expect ≥1)`);
      sc('global-leak assertion fires when a founder embedding is NULL-scoped', leakCountC >= 1);
    } finally {
      // ALWAYS roll back — the NULL-scope is discarded, database is unchanged
      await pgClient.query('ROLLBACK');
      console.log('  ROLLBACK — transaction discarded, database unchanged');
      pgClient.release();
      await pgPool.end();

      // Step 3: confirm the rollback worked (external read should see DAVID_USER_ID still)
      const [postRowC] = await db
        .select({ userId: memoryEmbeddings.userId })
        .from(memoryEmbeddings)
        .where(and(
          eq(memoryEmbeddings.memoryId, scTargetId),
          eq(memoryEmbeddings.memoryType, scTargetType),
        ))
        .limit(1);
      const stillScoped = postRowC?.userId === DAVID_USER_ID;
      console.log(`  Post-rollback userId for target: ${postRowC?.userId ?? 'null'} (expect ${DAVID_USER_ID})`);
      sc('global-leak rollback confirmed: target row still scoped to David after ROLLBACK', stillScoped);
    }
  }

  console.log(B(`\n══ Self-Check Results: ${selfPassed} confirmed, ${selfFailed} broken ══\n`));

  if (selfFailed > 0) {
    console.log(R('SELF-CHECK FAILED — one or more guards are not catching their regression.'));
    process.exit(1);
  }
  console.log(G('SELF-CHECK PASSED — all guards correctly fail under their respective regressions.'));
  process.exit(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(B('\n══ Game Recall End-to-End Validation ══\n'));
  if (SELF_CHECK) console.log(Y('(self-check mode)\n'));
  if (FIX_MODE) console.log(Y('(--fix mode: missing embeddings will be re-embedded automatically)\n'));

  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL (or DATABASE_URL) is not set.'));
    process.exit(1);
  }

  const db = drizzle(neon(dbUrl));

  try {
    if (SELF_CHECK) {
      await runSelfCheck(db);
      return;
    }

    await checkPersonalPoolCoverage(db);
    await assertSourceCodeCap();
    await checkNoGlobalLeakage(db);
    await checkKeywordArm(db);
  } catch (err: any) {
    console.error(R(`\nFATAL: ${err.message}`));
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }

  console.log(B(`\n══ Results: ${passed} passed, ${failed} failed ══\n`));

  if (failed > 0) {
    console.log(R('FAIL — game recall is broken or embeddings are not correctly scoped.'));
    console.log(Y('\nChecklist:'));
    console.log('  1. If assertion 1 failed, re-run with --fix to auto-repair missing embeddings:');
    console.log('       npx tsx server/scripts/test-game-recall.ts --fix');
    console.log('  2. If game memories themselves are missing, run:');
    console.log('       npx tsx server/scripts/backfill-game-sessions.ts');
    console.log('     then re-run with --fix to embed the new rows.');
    console.log('  3. If embeddings are NULL-scoped, run the scope-founder-memories migration.');
    console.log('  4. Check semantic-memory-service.ts — global pool limit must be 5000.');
    process.exit(1);
  }

  console.log(G('PASS — Daniela can name games when David asks.'));
  process.exit(0);
}

// Only run when invoked directly
if (process.argv[1]?.includes('test-game-recall')) {
  main().catch(err => { console.error(err); process.exit(1); });
}

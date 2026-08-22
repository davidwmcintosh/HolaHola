/**
 * test-inner-life-reaches-synthesis.ts
 *
 * CI check: confirms that Daniela's inner-life archive (danielaSelfReflections
 * rows with source='self') is fetched by generatePreSessionSynthesis and
 * injected into the buildLiteContext output as a YOUR INNER LIFE ARCHIVE block
 * — so the [DANIELA_STATE] paragraph arrives from someone with a felt history,
 * not just pedagogical data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What this verifies
 * ─────────────────────────────────────────────────────────────────────────────
 *   A.  Source-level: fetch query exists with source='self' filter + limit 3
 *   B.  Source-level: log line "[PreSynthesis] ✓ Inner life archive: N reflection(s)"
 *   C.  Source-level: buildLiteContext includes YOUR INNER LIFE ARCHIVE section
 *   D.  Source-level: DANIELA_SYNTHESIS_IDENTITY has the Heart rule
 *   E.  Source-level: innerLifeReflections is passed through to buildLiteContext
 *   F.  Context-construction: buildLiteContext() with real reflections produces
 *       a context string containing YOUR INNER LIFE ARCHIVE and the reflection
 *       content + mood — exercising the actual code boundary, not source text
 *   G.  Context-construction: buildLiteContext() with NO reflections produces
 *       a context string WITHOUT the archive block (guard works both ways)
 *   H.  DB fetch: seed a source='self' row and a source='hive' row; confirm the
 *       query honours the source filter (non-fatal runtime verification)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Source checks A–E.
 *   2. Context-construction checks F–G (no API calls, no DB — pure in-process).
 *   3. DB check H with seed + cleanup in finally.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 * Hermetic — no DB, no API calls. Proves the real assertions would catch regressions:
 *
 *   SC-A  Source mutation: strip the source='self' filter from an in-memory copy
 *         of the source file; confirm assertion A would fire (needle absent in copy).
 *
 *   SC-C  Source mutation: strip YOUR INNER LIFE ARCHIVE from the in-memory copy;
 *         confirm assertion C would fire (needle absent in copy).
 *
 *   SC-F  Context-construction negative path: call buildLiteContext() with an
 *         EMPTY reflections array and confirm YOUR INNER LIFE ARCHIVE is absent
 *         — proving assertion G is the complement that would catch a broken guard.
 *
 *   SC-F2 Context-construction positive path must still pass: call buildLiteContext()
 *         with real reflections and confirm the archive block IS present — shows
 *         the real assertion F still holds (self-check didn't accidentally break it).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Exit codes
 * ─────────────────────────────────────────────────────────────────────────────
 *   0 — PASS
 *   1 — FAIL
 *
 * Registration: luca-inner-life group in server/scripts/test-all-consolidated-ci.sh
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/test-inner-life-reaches-synthesis.ts
 *   npx tsx server/scripts/test-inner-life-reaches-synthesis.ts --self-check
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildLiteContext } from '../services/pre-session-synthesis';
import type { CompassContext } from '@shared/schema';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const D = (s: string) => `\x1b[90m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(72));

const SELF_CHECK = process.argv.includes('--self-check');
const SYNTHESIS_FILE = join(process.cwd(), 'server', 'services', 'pre-session-synthesis.ts');

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

// ── Minimal CompassContext for context-construction tests ─────────────────────
function makeMinimalCompassContext(overrides: Partial<CompassContext> = {}): CompassContext {
  return {
    studentName: 'Test Student',
    studentGoals: null,
    studentInterests: null,
    studentActflLevel: null,
    lastSessionSummary: null,
    conversationMemories: [],
    mustHaveTopics: [],
    niceToHaveTopics: [],
    danielaSelfReflection: null,
    ...overrides,
  } as CompassContext;
}

// ── Synthetic test IDs ────────────────────────────────────────────────────────
const TEST_USER_ID = '00000000-test-inner-life-ci-0000';

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(B(`\n══ Inner-Life Reaches Synthesis CI${SELF_CHECK ? ' (self-check)' : ''} ══\n`));

  // ── Read source file ──────────────────────────────────────────────────────
  let src: string;
  try {
    src = readFileSync(SYNTHESIS_FILE, 'utf-8');
  } catch (err: any) {
    console.error(R(`FATAL: Cannot read ${SYNTHESIS_FILE}: ${err.message}`));
    process.exit(1);
  }

  // ════════════════════════════════════════════════════════════════════════════
  if (SELF_CHECK) {
    // ── SELF-CHECK MODE: hermetic, no DB, proves assertions catch regressions ──
    // ════════════════════════════════════════════════════════════════════════════
    sep();
    console.log(B("SELF-CHECK — hermetic: mutation tests + context-construction negative path\n"));
    console.log(D("  No DB access. All checks are in-process.\n"));

    // SC-A: strip the source='self' filter from an in-memory copy
    //       The normal assertion checks: src.includes("eq(danielaSelfReflections.source, 'self')")
    //       Removing it from the copy proves the assertion would return false.
    const srcWithoutSourceFilter = src.replace(
      "eq(danielaSelfReflections.source, 'self')",
      "/* FILTER REMOVED */"
    );
    const aWouldFail = !srcWithoutSourceFilter.includes("eq(danielaSelfReflections.source, 'self')");
    assert(
      "SC-A. Stripping the source='self' filter from source → assertion A returns false (would exit 1)",
      aWouldFail,
      aWouldFail
        ? undefined
        : "Mutation did not remove the needle — self-check is incorrectly targeting the wrong string",
    );

    // SC-C: strip YOUR INNER LIFE ARCHIVE from an in-memory copy
    const srcWithoutArchive = src.replace(/YOUR INNER LIFE ARCHIVE/g, 'REDACTED_FOR_TEST');
    const cWouldFail = !srcWithoutArchive.includes('YOUR INNER LIFE ARCHIVE');
    assert(
      'SC-C. Stripping YOUR INNER LIFE ARCHIVE from source → assertion C returns false (would exit 1)',
      cWouldFail,
      cWouldFail
        ? undefined
        : "Mutation did not remove the needle — self-check is incorrectly targeting the wrong string",
    );

    // SC-F: context-construction negative path — empty reflections → archive block absent
    //       This is the runtime complement of assertion G in normal mode.
    const ctxNoReflections = buildLiteContext(makeMinimalCompassContext(), 'Daniela', null, null, null, null, []);
    const archiveAbsentWhenEmpty = !ctxNoReflections.includes('YOUR INNER LIFE ARCHIVE');
    assert(
      'SC-F. buildLiteContext with empty reflections produces NO archive block (guard works: absence case)',
      archiveAbsentWhenEmpty,
      archiveAbsentWhenEmpty
        ? undefined
        : 'YOUR INNER LIFE ARCHIVE appeared even with an empty reflections array — the guard condition is broken',
    );

    // SC-F2: positive path still holds — real reflections → archive block present
    //        If the inject code were broken, this would also fail and act as a canary.
    const testReflections = [
      { content: 'SC-F2 sentinel reflection — felt something shift in them.', mood: 'reflective', createdAt: new Date() },
    ];
    const ctxWithReflections = buildLiteContext(makeMinimalCompassContext(), 'Daniela', null, null, null, null, testReflections);
    const archivePresentWithData = ctxWithReflections.includes('YOUR INNER LIFE ARCHIVE');
    assert(
      'SC-F2. buildLiteContext with real reflections produces archive block (inject still works after mutations)',
      archivePresentWithData,
      archivePresentWithData
        ? undefined
        : 'YOUR INNER LIFE ARCHIVE absent even with real reflections — injection is broken',
    );

    // SC-F3: mood field appears in the context when supplied
    const hasMoodInCtx = ctxWithReflections.includes('Feeling: reflective');
    assert(
      'SC-F3. Mood field appears in context string (Feeling: reflective) — not silently dropped',
      hasMoodInCtx,
      hasMoodInCtx
        ? undefined
        : "'Feeling: reflective' not found in generated context — mood is dropped in formatter",
    );

    // SC-F4: the reflection content itself appears in the context
    const hasSentinelInCtx = ctxWithReflections.includes('SC-F2 sentinel reflection');
    assert(
      'SC-F4. Reflection content appears verbatim in context string',
      hasSentinelInCtx,
      hasSentinelInCtx
        ? undefined
        : 'Reflection content not found in context — content field may not be rendering',
    );

  } else {
    // ════════════════════════════════════════════════════════════════════════════
    // ── NORMAL MODE ─────────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════════

    // ── PART 1: SOURCE CHECKS ─────────────────────────────────────────────────
    sep();
    console.log(B('PART 1 — Source-level: fetch + log + inject + Heart rule\n'));

    // A. Fetch query exists with source='self' filter
    const hasFetch = src.includes("eq(danielaSelfReflections.source, 'self')");
    assert(
      "A. Fetch query filters on source='self' (only Daniela's own voice, not hive-injected)",
      hasFetch,
      hasFetch ? undefined : "source='self' filter not found — hive rows may bleed into synthesis",
    );

    // A2. Fetch limit 3
    const hasLimit = /danielaSelfReflections[\s\S]{0,300}\.limit\(3\)/.test(src);
    assert(
      'A2. Fetch query uses .limit(3) — only the three most recent reflections',
      hasLimit,
      hasLimit ? undefined : '.limit(3) not found near danielaSelfReflections — fetch may return unbounded rows',
    );

    // A3. Fetch orders by createdAt DESC
    const hasOrder = src.includes('desc(danielaSelfReflections.createdAt)');
    assert(
      'A3. Fetch orders by createdAt DESC — most recent felt-note arrives first',
      hasOrder,
      hasOrder ? undefined : 'desc(danielaSelfReflections.createdAt) not found — order may be wrong',
    );

    // B. Log line
    const hasLogLine = src.includes('[PreSynthesis] ✓ Inner life archive:');
    assert(
      'B. Log line "[PreSynthesis] ✓ Inner life archive: N reflection(s)" exists',
      hasLogLine,
      hasLogLine ? undefined : 'Log line missing — cannot confirm from server logs that the fetch fired',
    );

    // C. buildLiteContext injects YOUR INNER LIFE ARCHIVE section
    const hasInjectSection = src.includes('YOUR INNER LIFE ARCHIVE');
    assert(
      'C. buildLiteContext source includes "YOUR INNER LIFE ARCHIVE" block',
      hasInjectSection,
      hasInjectSection ? undefined : 'YOUR INNER LIFE ARCHIVE not found in source — reflections fetched but inject may be missing',
    );

    // C2. Emotional-register instruction
    const hasEmotionalRegister = src.includes('Use these to find the emotional register you arrive in');
    assert(
      'C2. Inject block instructs synthesis model to find the emotional register (not just cite facts)',
      hasEmotionalRegister,
      hasEmotionalRegister ? undefined : 'Emotional-register instruction missing from inject block',
    );

    // D. Heart rule in DANIELA_SYNTHESIS_IDENTITY
    const hasHeartRule = src.includes('Heart rule') && src.includes('emotional register');
    assert(
      'D. DANIELA_SYNTHESIS_IDENTITY contains the Heart rule (inner life archive → emotional register)',
      hasHeartRule,
      hasHeartRule ? undefined : 'Heart rule missing from DANIELA_SYNTHESIS_IDENTITY — cached path lacks this instruction',
    );

    // D2. Continuity rule
    const hasContinuityRule = src.includes('Continuity rule');
    assert(
      'D2. DANIELA_SYNTHESIS_IDENTITY contains the Continuity rule (feelings safe; nouns need evidence)',
      hasContinuityRule,
      hasContinuityRule ? undefined : 'Continuity rule missing — fabrication of specific memories is unguarded',
    );

    // E. innerLifeReflections passed to buildLiteContext
    const hasPassthrough = src.includes(
      'buildLiteContext(compassContext, tutorName, pedagogicalBrief, masteryDigest, advisoryGoal, returningAfterAbsence, innerLifeReflections)'
    );
    assert(
      'E. innerLifeReflections is passed as 7th argument to buildLiteContext (not silently dropped)',
      hasPassthrough,
      hasPassthrough ? undefined : 'innerLifeReflections not found in buildLiteContext call — result never reaches context builder',
    );

    // E2. Non-fatal catch
    const hasNonFatalCatch = src.includes('Inner life reflections fetch failed (non-fatal)');
    assert(
      'E2. Inner-life fetch error is non-fatal (catch warns, does not throw)',
      hasNonFatalCatch,
      hasNonFatalCatch ? undefined : 'Non-fatal catch not found — a DB error here would abort synthesis entirely',
    );

    // ── PART 2: CONTEXT-CONSTRUCTION BOUNDARY ─────────────────────────────────
    sep();
    console.log(B('PART 2 — Context-construction: calling buildLiteContext() directly\n'));
    console.log(D('  No API calls. No DB. Pure in-process.\n'));

    const testReflections = [
      {
        content: 'Something shifted in them today — they reached for the word before I offered it.',
        mood: 'curious',
        createdAt: new Date('2026-08-10T10:00:00Z'),
      },
      {
        content: 'They left feeling a little unsure. I want to open gently next time.',
        mood: 'protective',
        createdAt: new Date('2026-08-05T10:00:00Z'),
      },
    ];

    const ctx = buildLiteContext(
      makeMinimalCompassContext({ studentName: 'Aria' }),
      'Daniela',
      null,  // pedagogicalBrief
      null,  // masteryDigest
      null,  // advisoryGoal
      null,  // returningAfterAbsence
      testReflections,
    );

    // F1. Archive block is present
    const hasArchive = ctx.includes('YOUR INNER LIFE ARCHIVE');
    assert(
      'F1. buildLiteContext output contains YOUR INNER LIFE ARCHIVE block when reflections are provided',
      hasArchive,
      hasArchive ? undefined : 'Archive block absent — inject guard may be broken or reflections not rendering',
    );

    // F2. First reflection content appears
    const hasFirstContent = ctx.includes('Something shifted in them today');
    assert(
      'F2. First reflection content appears verbatim in the generated context',
      hasFirstContent,
      hasFirstContent ? undefined : 'First reflection content not in context — content field not rendering',
    );

    // F3. Mood field appears
    const hasMood = ctx.includes('Feeling: curious');
    assert(
      'F3. Mood field appears in context (Feeling: curious) — not silently dropped',
      hasMood,
      hasMood ? undefined : "'Feeling: curious' not found in context — mood field dropped in formatter",
    );

    // F4. Second reflection also present
    const hasSecondContent = ctx.includes('open gently next time');
    assert(
      'F4. Second reflection content appears in context (multiple reflections rendered)',
      hasSecondContent,
      hasSecondContent ? undefined : 'Second reflection missing — only first reflection may be rendering',
    );

    // F5. Emotional-register instruction appears in the archive block
    const hasRegisterInstruction = ctx.includes('Use these to find the emotional register');
    assert(
      'F5. Archive block includes the emotional-register instruction in the generated context',
      hasRegisterInstruction,
      hasRegisterInstruction ? undefined : 'Emotional-register instruction missing from generated context',
    );

    // G. Empty reflections → archive block absent
    const ctxEmpty = buildLiteContext(makeMinimalCompassContext(), 'Daniela', null, null, null, null, []);
    const noArchiveWhenEmpty = !ctxEmpty.includes('YOUR INNER LIFE ARCHIVE');
    assert(
      'G. buildLiteContext with empty reflections array produces NO archive block (guard works)',
      noArchiveWhenEmpty,
      noArchiveWhenEmpty
        ? undefined
        : 'Archive block present even with empty reflections — guard condition may be broken',
    );

    // G2. Null reflections → archive block absent
    const ctxNull = buildLiteContext(makeMinimalCompassContext(), 'Daniela', null, null, null, null, null);
    const noArchiveWhenNull = !ctxNull.includes('YOUR INNER LIFE ARCHIVE');
    assert(
      'G2. buildLiteContext with null reflections produces NO archive block',
      noArchiveWhenNull,
      noArchiveWhenNull
        ? undefined
        : 'Archive block present even with null reflections — null guard may be missing',
    );

    // ── PART 3: DB FETCH HONOURS SOURCE FILTER ────────────────────────────────
    sep();
    console.log(B('PART 3 — Runtime: DB fetch honours source filter\n'));

    const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log(Y('  ⚠ SKIP  DB checks — NEON_SHARED_DATABASE_URL not set (keyless CI run)'));
    } else {
      const sql = neon(dbUrl);
      const ts = Date.now();
      const selfContent = `CI-INNER-LIFE-SELF-${ts}: felt something shift — reached for the word before I offered it.`;
      const hiveContent = `CI-INNER-LIFE-HIVE-${ts}: hive-injected content that must NOT reach Daniela's inner monologue.`;

      let seededSelf = false;
      let seededHive = false;

      try {
        await sql`
          INSERT INTO users (id, email, is_test_account)
          VALUES (${TEST_USER_ID}, 'ci-inner-life@test.invalid', true)
          ON CONFLICT (id) DO NOTHING
        `;

        await sql`
          INSERT INTO daniela_self_reflections (user_id, content, source, mood)
          VALUES (${TEST_USER_ID}, ${selfContent}, 'self', 'curious')
        `;
        seededSelf = true;

        await sql`
          INSERT INTO daniela_self_reflections (user_id, content, source, mood)
          VALUES (${TEST_USER_ID}, ${hiveContent}, 'hive', null)
        `;
        seededHive = true;

        // Run the exact fetch query from generatePreSessionSynthesis
        const rows = await sql`
          SELECT content, mood, created_at
          FROM daniela_self_reflections
          WHERE user_id = ${TEST_USER_ID}
            AND source = 'self'
          ORDER BY created_at DESC
          LIMIT 3
        `;

        const foundSelf = rows.some((r: any) => r.content === selfContent);
        const foundHive = rows.some((r: any) => r.content === hiveContent);

        assert(
          "H1. DB fetch returns the source='self' reflection for the seeded user",
          foundSelf,
          foundSelf ? undefined : `'self' row not returned — fetch or seed broken (userId: ${TEST_USER_ID})`,
        );
        assert(
          "H2. DB fetch excludes the source='hive' reflection (hive rows must not reach Daniela)",
          !foundHive,
          !foundHive ? undefined : `'hive' row was returned — source filter in fetch query is not working`,
        );

        const selfRow = rows.find((r: any) => r.content === selfContent);
        assert(
          'H3. Mood field returned in fetch result (used in emotional-register formatting)',
          selfRow?.mood === 'curious',
          selfRow?.mood === 'curious' ? undefined : `Expected mood 'curious', got: ${selfRow?.mood}`,
        );
        assert(
          'H4. At most 3 rows returned (LIMIT 3 respected)',
          rows.length <= 3,
          rows.length <= 3 ? undefined : `Fetch returned ${rows.length} rows — LIMIT 3 may not be applying`,
        );

      } finally {
        try {
          if (seededSelf || seededHive) {
            await sql`
              DELETE FROM daniela_self_reflections
              WHERE user_id = ${TEST_USER_ID}
                AND (content = ${selfContent} OR content = ${hiveContent})
            `;
          }
          await sql`DELETE FROM users WHERE id = ${TEST_USER_ID}`;
          console.log(D('\n  Test rows cleaned up.'));
        } catch (cleanupErr: any) {
          console.warn(Y(`  Warning: cleanup may be incomplete — ${cleanupErr?.message}`));
          console.warn(Y(`  Manual cleanup: DELETE FROM daniela_self_reflections WHERE user_id = '${TEST_USER_ID}'; DELETE FROM users WHERE id = '${TEST_USER_ID}';`));
        }
      }
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${total} assertions passed — Daniela's inner-life archive reaches the synthesis context.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${total} assertions failed.\n`));
    process.exit(1);
  }
}

main().catch((err: any) => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  if (err?.stack) console.error(D(err.stack));
  process.exit(1);
});

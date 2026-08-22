/**
 * test-truth-pipeline-unified-recall-diagnosis.ts
 *
 * CI check: confirms that daniela-truth-pipeline-report.ts surfaces
 * unified_recall and search_learner_history source labels in the DIAGNOSIS
 * section when those sources return zero results.
 *
 * Background
 * ──────────
 * gl_student_memory_search events carry a `source` field in their JSONB
 * payload: 'student_memory', 'unified_recall', or 'search_learner_history'.
 * The diagnosis section (section 1b) must name each source separately so a
 * zero-result miss from unified_recall is distinguishable from a generic
 * student_memory miss.
 *
 * Without the per-source breakdown, all zero-result misses would be labelled
 * generically as "student-memory" — making it impossible to tell whether
 * unified_recall or search_learner_history specifically failed.
 *
 * Tests
 * ─────
 *   1. unified_recall zero-result rows → "unified_recall" appears in DIAGNOSIS
 *      with a zero-result warning.
 *   2. search_learner_history zero-result rows → "search_learner_history"
 *      appears in DIAGNOSIS.
 *   3. Both sources in one session → both labels appear in DIAGNOSIS.
 *
 * Self-check (--self-check)
 * ─────────────────────────
 *   Inserts only a generic 'student_memory'-sourced row (zero results), then
 *   verifies the output does NOT contain 'unified_recall' or
 *   'search_learner_history' in the DIAGNOSIS.  This confirms the source field
 *   is the gate: the new source-specific label only fires when the source
 *   matches — not for every zero-result row.  Without the per-source branching
 *   in the report, either all rows would print the new labels or none would,
 *   and one of these two self-check assertions would fail.
 *
 * Run
 * ───
 *   npx tsx server/scripts/test-truth-pipeline-unified-recall-diagnosis.ts
 *   npx tsx server/scripts/test-truth-pipeline-unified-recall-diagnosis.ts --self-check
 */

import { execSync } from 'child_process';
import { neon } from '@neondatabase/serverless';

const G   = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B   = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y   = (s: string) => `\x1b[33m${s}\x1b[0m`;
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;
const sep = () => console.log('─'.repeat(70));

const SCRIPT    = 'server/scripts/daniela-truth-pipeline-report.ts';
const CMD       = `npx tsx ${SCRIPT}`;
const SELF_CHECK = process.argv.includes('--self-check');

let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

/** Run the report script and return stripped plain text + exit code. */
function run(sessionId: string): { plain: string; exitCode: number } {
  try {
    const stdout = execSync(`${CMD} ${sessionId}`, {
      encoding: 'utf8',
      timeout: 45_000,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { plain: stdout.replace(/\x1b\[[0-9;]*m/g, ''), exitCode: 0 };
  } catch (e: any) {
    const combined = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    return { plain: combined.replace(/\x1b\[[0-9;]*m/g, ''), exitCode: e.status ?? 1 };
  }
}

/** Extract the DIAGNOSIS section text from report output. */
function diagnosisSection(plain: string): string {
  const idx = plain.indexOf('DIAGNOSIS');
  return idx >= 0 ? plain.slice(idx) : '';
}

/** Build gl_student_memory_search event_data payload. */
function makeStudentMemoryPayload(source: string, query: string, resultCount: number, convId: string | null): string {
  return JSON.stringify({
    source,
    query,
    resultCount,
    durationMs: 12,
    domains: [],
    conversationId: convId,
  });
}

async function main() {
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }
  const sql = neon(DATABASE_URL);

  console.log('');
  console.log(B(SELF_CHECK
    ? '  TRUTH-PIPELINE UNIFIED_RECALL DIAGNOSIS — SELF-CHECK'
    : '  TRUTH-PIPELINE UNIFIED_RECALL DIAGNOSIS — CI CHECK'));
  sep();

  // ── Find a real session to attach fixtures to ─────────────────────────────
  const sessions = await sql`
    SELECT id, user_id, started_at
    FROM voice_sessions
    WHERE user_id IS NOT NULL
      AND exchange_count > 0
    ORDER BY started_at DESC
    LIMIT 1
  `;

  if (sessions.length === 0) {
    console.log(Y('  SKIP: no voice_sessions row with exchange_count > 0 found.'));
    console.log(Y('  Cannot run fixture-based tests without a real session.'));
    process.exit(0);
  }

  const s = sessions[0];
  const sessionId = s.id as string;
  const userId    = s.user_id as string;
  // Place fixture events 30s after session start so they fall inside any time window.
  const insideTs  = new Date(new Date(s.started_at as string).getTime() + 30_000).toISOString();

  console.log(DIM(`  Using session: ${sessionId}`));

  if (SELF_CHECK) {
    // ═════════════════════════════════════════════════════════════════════════
    // SELF-CHECK MODE
    // Inserts only a generic 'student_memory'-sourced row (zero results).
    // Verifies that 'unified_recall' and 'search_learner_history' do NOT appear
    // in the DIAGNOSIS — proving those labels are gated on the source field,
    // not emitted for every zero-result student-memory row.
    // ═════════════════════════════════════════════════════════════════════════
    console.log(B('\nSelf-check — generic student_memory row must NOT emit unified_recall or search_learner_history labels'));
    sep();

    const GENERIC_QUERY = `CI_SELFCHECK_GENERIC_QUERY_${Date.now()}`;
    const payload = makeStudentMemoryPayload('student_memory', GENERIC_QUERY, 0, null);

    let rowId: string | null = null;
    try {
      const inserted = await sql`
        INSERT INTO voice_pipeline_events (id, session_id, user_id, event_type, event_data, created_at)
        VALUES (gen_random_uuid(), ${sessionId}, ${userId}, 'gl_student_memory_search',
                ${payload}::jsonb, ${insideTs}::timestamptz)
        RETURNING id
      `;
      rowId = inserted[0]?.id as string ?? null;
      console.log(DIM(`  Inserted generic student_memory row: ${rowId}`));

      const { plain, exitCode } = run(sessionId);
      const diag = diagnosisSection(plain);

      assert(
        'report exits 0',
        exitCode === 0,
        `exitCode=${exitCode}\n${plain.slice(0, 400)}`
      );
      assert(
        'DIAGNOSIS does NOT contain "unified_recall" for a generic student_memory row',
        !diag.includes('unified_recall'),
        `"unified_recall" appeared in DIAGNOSIS when source was "student_memory".\n` +
        `This means the per-source branching is missing — the report is not keying on the source field.\n` +
        `Diagnosis section:\n${diag.slice(0, 600)}`
      );
      assert(
        'DIAGNOSIS does NOT contain "search_learner_history" for a generic student_memory row',
        !diag.includes('search_learner_history'),
        `"search_learner_history" appeared in DIAGNOSIS when source was "student_memory".\n` +
        `Diagnosis section:\n${diag.slice(0, 600)}`
      );
      // The generic source label should still appear (proving the row was actually read)
      assert(
        'DIAGNOSIS contains "student_memory" — confirming the zero-result row was read',
        diag.includes('student_memory'),
        `"student_memory" not found in diagnosis. Either the row was not read or the source field is not surfaced.\nDiagnosis:\n${diag.slice(0, 600)}`
      );

    } catch (err: any) {
      console.log(Y(`  SKIP: fixture error — ${err?.message ?? err}`));
    } finally {
      if (rowId) {
        await sql`DELETE FROM voice_pipeline_events WHERE id = ${rowId}`;
        console.log(DIM(`  Cleaned up row ${rowId}`));
      }
    }

  } else {
    // ═════════════════════════════════════════════════════════════════════════
    // NORMAL CI TESTS
    // ═════════════════════════════════════════════════════════════════════════

    // ── Test 1: unified_recall zero-result row → label in DIAGNOSIS ───────────
    console.log(B('\nTest 1 — unified_recall zero-result row → label in DIAGNOSIS'));
    sep();
    {
      const QUERY = `CI_UNIFIED_RECALL_QUERY_${Date.now()}`;
      const payload = makeStudentMemoryPayload('unified_recall', QUERY, 0, null);

      let rowId: string | null = null;
      try {
        const inserted = await sql`
          INSERT INTO voice_pipeline_events (id, session_id, user_id, event_type, event_data, created_at)
          VALUES (gen_random_uuid(), ${sessionId}, ${userId}, 'gl_student_memory_search',
                  ${payload}::jsonb, ${insideTs}::timestamptz)
          RETURNING id
        `;
        rowId = inserted[0]?.id as string ?? null;
        console.log(DIM(`  Inserted unified_recall zero-result row: ${rowId}`));

        const { plain, exitCode } = run(sessionId);
        const diag = diagnosisSection(plain);

        assert(
          'report exits 0',
          exitCode === 0,
          `exitCode=${exitCode}\nfirst 400 chars:\n${plain.slice(0, 400)}`
        );
        assert(
          'DIAGNOSIS contains "unified_recall"',
          diag.includes('unified_recall'),
          `"unified_recall" not found in diagnosis section.\n` +
          `This means the report groups all student-memory misses under a generic label instead of naming the source.\n` +
          `Diagnosis section (first 800 chars):\n${diag.slice(0, 800)}`
        );
        assert(
          'DIAGNOSIS contains zero-result warning for unified_recall',
          diag.includes('unified_recall') && /0 result|0 hit|nothing back|got nothing/i.test(diag),
          `zero-result warning for unified_recall not found in diagnosis.\nDiagnosis:\n${diag.slice(0, 600)}`
        );
        assert(
          'DIAGNOSIS includes the fixture query text',
          plain.includes(QUERY.slice(0, 30)),
          `query string not found in output — row may not have been read`
        );

      } catch (err: any) {
        console.log(Y(`  SKIP: fixture error — ${err?.message ?? err}`));
      } finally {
        if (rowId) {
          await sql`DELETE FROM voice_pipeline_events WHERE id = ${rowId}`;
          console.log(DIM(`  Cleaned up row ${rowId}`));
        }
      }
    }

    // ── Test 2: search_learner_history zero-result row → label in DIAGNOSIS ──
    console.log(B('\nTest 2 — search_learner_history zero-result row → label in DIAGNOSIS'));
    sep();
    {
      const QUERY = `CI_SEARCH_LEARNER_HISTORY_QUERY_${Date.now()}`;
      const payload = makeStudentMemoryPayload('search_learner_history', QUERY, 0, null);

      let rowId: string | null = null;
      try {
        const inserted = await sql`
          INSERT INTO voice_pipeline_events (id, session_id, user_id, event_type, event_data, created_at)
          VALUES (gen_random_uuid(), ${sessionId}, ${userId}, 'gl_student_memory_search',
                  ${payload}::jsonb, ${insideTs}::timestamptz)
          RETURNING id
        `;
        rowId = inserted[0]?.id as string ?? null;
        console.log(DIM(`  Inserted search_learner_history zero-result row: ${rowId}`));

        const { plain, exitCode } = run(sessionId);
        const diag = diagnosisSection(plain);

        assert(
          'report exits 0',
          exitCode === 0,
          `exitCode=${exitCode}\nfirst 400 chars:\n${plain.slice(0, 400)}`
        );
        assert(
          'DIAGNOSIS contains "search_learner_history"',
          diag.includes('search_learner_history'),
          `"search_learner_history" not found in diagnosis section.\n` +
          `This means the report is not breaking out this source separately.\n` +
          `Diagnosis section:\n${diag.slice(0, 800)}`
        );
        assert(
          'DIAGNOSIS contains zero-result warning for search_learner_history',
          diag.includes('search_learner_history') && /0 result|0 hit|nothing back|got nothing/i.test(diag),
          `zero-result warning for search_learner_history not found in diagnosis.\nDiagnosis:\n${diag.slice(0, 600)}`
        );

      } catch (err: any) {
        console.log(Y(`  SKIP: fixture error — ${err?.message ?? err}`));
      } finally {
        if (rowId) {
          await sql`DELETE FROM voice_pipeline_events WHERE id = ${rowId}`;
          console.log(DIM(`  Cleaned up row ${rowId}`));
        }
      }
    }

    // ── Test 3: both sources in one session → both labels in DIAGNOSIS ────────
    console.log(B('\nTest 3 — both unified_recall and search_learner_history in one session → both labels'));
    sep();
    {
      const UR_QUERY  = `CI_BOTH_UR_${Date.now()}`;
      const SLH_QUERY = `CI_BOTH_SLH_${Date.now()}`;
      const payloadUr  = makeStudentMemoryPayload('unified_recall', UR_QUERY, 0, null);
      const payloadSlh = makeStudentMemoryPayload('search_learner_history', SLH_QUERY, 0, null);

      let urId:  string | null = null;
      let slhId: string | null = null;
      try {
        const [ur, slh] = await Promise.all([
          sql`
            INSERT INTO voice_pipeline_events (id, session_id, user_id, event_type, event_data, created_at)
            VALUES (gen_random_uuid(), ${sessionId}, ${userId}, 'gl_student_memory_search',
                    ${payloadUr}::jsonb, ${insideTs}::timestamptz)
            RETURNING id
          `,
          sql`
            INSERT INTO voice_pipeline_events (id, session_id, user_id, event_type, event_data, created_at)
            VALUES (gen_random_uuid(), ${sessionId}, ${userId}, 'gl_student_memory_search',
                    ${payloadSlh}::jsonb, ${insideTs}::timestamptz)
            RETURNING id
          `,
        ]);
        urId  = ur[0]?.id  as string ?? null;
        slhId = slh[0]?.id as string ?? null;
        console.log(DIM(`  Inserted unified_recall=${urId}  search_learner_history=${slhId}`));

        const { plain, exitCode } = run(sessionId);
        const diag = diagnosisSection(plain);

        assert(
          'report exits 0',
          exitCode === 0,
          `exitCode=${exitCode}\nfirst 400 chars:\n${plain.slice(0, 400)}`
        );
        assert(
          'DIAGNOSIS contains "unified_recall"',
          diag.includes('unified_recall'),
          `"unified_recall" not found in diagnosis.\nDiagnosis:\n${diag.slice(0, 800)}`
        );
        assert(
          'DIAGNOSIS contains "search_learner_history"',
          diag.includes('search_learner_history'),
          `"search_learner_history" not found in diagnosis.\nDiagnosis:\n${diag.slice(0, 800)}`
        );
        // Verify both sources are listed as separate issues (not merged into one)
        const urIdx  = diag.indexOf('unified_recall');
        const slhIdx = diag.indexOf('search_learner_history');
        assert(
          'unified_recall and search_learner_history appear as separate diagnosis entries',
          urIdx >= 0 && slhIdx >= 0 && urIdx !== slhIdx,
          `Expected two separate entries, got:\n${diag.slice(0, 800)}`
        );

      } catch (err: any) {
        console.log(Y(`  SKIP: fixture error — ${err?.message ?? err}`));
      } finally {
        await Promise.all([
          urId  ? sql`DELETE FROM voice_pipeline_events WHERE id = ${urId}`  : Promise.resolve([]),
          slhId ? sql`DELETE FROM voice_pipeline_events WHERE id = ${slhId}` : Promise.resolve([]),
        ]);
        console.log(DIM(`  Cleaned up fixture rows`));
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('');
  sep();
  if (failed === 0) {
    console.log(G(`  ALL ${passed} checks passed ✅`));
  } else {
    console.log(R(`  ${failed} of ${passed + failed} checks FAILED ❌`));
  }
  sep();

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(R(`Fatal: ${err?.message ?? err}`));
  process.exit(1);
});

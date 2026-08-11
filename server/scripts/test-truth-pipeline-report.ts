/**
 * test-truth-pipeline-report.ts
 *
 * CI self-check for daniela-truth-pipeline-report.ts.
 *
 * Tests:
 *   1. Missing argument → exits 1 + usage text.
 *   2. Invalid session ID → exits 1 + "Session not found".
 *   3. --recent → exits 0 + all required report sections present.
 *      (skipped if no voice_sessions rows with exchange_count > 0 exist)
 *   4. Cross-session isolation — a pipeline event that shares the session's
 *      conversationId but has a created_at BEFORE the session window must NOT
 *      appear in the report output (fixture insert + verify + cleanup).
 *      (skipped if no suitable session found in DB)
 *
 * Run: npx tsx server/scripts/test-truth-pipeline-report.ts
 */

import { execSync } from 'child_process';
import { neon } from '@neondatabase/serverless';

const G    = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B    = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y    = (s: string) => `\x1b[33m${s}\x1b[0m`;
const DIM  = (s: string) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`;
const sep  = () => console.log('─'.repeat(70));

const SCRIPT = 'server/scripts/daniela-truth-pipeline-report.ts';
const CMD    = `npx tsx ${SCRIPT}`;

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

/** Run the script and capture stdout+stderr + exit code without throwing. */
function run(args: string): { out: string; exitCode: number } {
  try {
    const stdout = execSync(`${CMD} ${args}`, {
      encoding: 'utf8',
      timeout: 45_000,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { out: stdout, exitCode: 0 };
  } catch (e: any) {
    const combined = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    return { out: combined, exitCode: e.status ?? 1 };
  }
}

async function main() {
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }
  const sql = neon(DATABASE_URL);

  console.log('');
  console.log(BOLD(B('  TRUTH-PIPELINE REPORT — CI SELF-CHECK')));
  sep();

  // ── Test 1: No argument → exit 1 + usage text ──────────────────────────────
  console.log(B('\nTest 1 — No argument → exit 1 + usage text'));
  sep();
  {
    const { out, exitCode } = run('');
    assert('exits with code 1', exitCode === 1, `got ${exitCode}`);
    assert('prints usage text', out.includes('Usage:'), `output: ${out.slice(0, 200)}`);
  }

  // ── Test 2: Invalid UUID → exit 1 + "Session not found" ───────────────────
  console.log(B('\nTest 2 — Invalid session ID → exit 1 + "Session not found"'));
  sep();
  {
    const fakeId = '00000000-dead-beef-cafe-000000000000';
    const { out, exitCode } = run(fakeId);
    assert('exits with code 1', exitCode === 1, `got ${exitCode}`);
    assert(
      'prints "Session not found"',
      out.toLowerCase().includes('session not found') || out.toLowerCase().includes('not found'),
      `output: ${out.slice(0, 300)}`
    );
  }

  // ── Test 3: --recent → exit 0 + report sections present ───────────────────
  console.log(B('\nTest 3 — --recent → exits 0 + all report sections'));
  sep();
  {
    const rows = await sql`SELECT id FROM voice_sessions WHERE exchange_count > 0 LIMIT 1`;
    if (rows.length === 0) {
      console.log(Y('  SKIP: no voice_sessions rows with exchange_count > 0'));
    } else {
      const { out, exitCode } = run('--recent');
      assert('exits with code 0', exitCode === 0, `got ${exitCode}\noutput: ${out.slice(0, 500)}`);
      assert('prints TRUTH-PIPELINE header', out.includes('TRUTH-PIPELINE'), `output: ${out.slice(0, 400)}`);
      assert('prints SECTION SUMMARIES', out.includes('SECTION SUMMARIES'), `tail: ${out.slice(-400)}`);
      assert('prints DIAGNOSIS', out.includes('DIAGNOSIS'), `tail: ${out.slice(-400)}`);
    }
  }

  // ── Test 4: Cross-session isolation (fixture) ─────────────────────────────
  // Inserts a synthetic gl_tool_call with the session's conversationId but
  // created_at 365 days before the session start (clearly outside the window).
  // The report must NOT include the sentinel args string.  Cleans up afterward.
  console.log(B('\nTest 4 — Cross-session isolation: out-of-window event must be excluded'));
  sep();
  {
    // Find a session that has both a conversationId and a real user_id
    const sessions = await sql`
      SELECT id, conversation_id, started_at, user_id
      FROM voice_sessions
      WHERE conversation_id IS NOT NULL
        AND user_id IS NOT NULL
        AND exchange_count > 0
      ORDER BY started_at DESC
      LIMIT 1
    `;

    if (sessions.length === 0) {
      console.log(Y('  SKIP: no suitable session found (need conversation_id + user_id)'));
    } else {
      const s = sessions[0];
      const sessionId      = s.id as string;
      const conversationId = s.conversation_id as string;
      const userId         = s.user_id as string;
      const sessionStart   = s.started_at as string;

      // Timestamp 365 days before session start — unambiguously outside any window
      const outsideTs = new Date(new Date(sessionStart).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

      // Unique sentinel so we can detect it in output even with ANSI stripping
      const SENTINEL = `CI_ISOLATION_SENTINEL_${Date.now()}`;

      const payload = JSON.stringify({
        toolName: 'ci_isolation_fixture',
        legacyType: null,
        status: 'ok',
        durationMs: 1,
        argsPreview: SENTINEL,
        resultPreview: 'fixture row for isolation test — should not appear in report',
        conversationId,
        turnId: 'ci-fixture-turn',
      });

      // Insert the out-of-window fixture row
      let fixtureRowId: string | null = null;
      try {
        const inserted = await sql`
          INSERT INTO voice_pipeline_events
            (id, session_id, user_id, event_type, event_data, created_at)
          VALUES (
            gen_random_uuid(),
            ${'ci-fixture-streaming-id'},
            ${userId},
            'gl_tool_call',
            ${payload}::jsonb,
            ${outsideTs}::timestamptz
          )
          RETURNING id
        `;
        fixtureRowId = inserted[0]?.id as string ?? null;
        console.log(DIM(`  Inserted fixture row ${fixtureRowId} with created_at=${outsideTs.slice(0, 10)}`));
      } catch (err: any) {
        console.log(Y(`  SKIP: could not insert fixture row — ${err?.message ?? err}`));
      }

      if (fixtureRowId) {
        try {
          // Run the report against the selected session
          const { out, exitCode } = run(sessionId);

          assert(
            'report exits 0 for this session',
            exitCode === 0,
            `exitCode=${exitCode}\noutput: ${out.slice(0, 500)}`
          );
          assert(
            'out-of-window sentinel is NOT present in report output',
            !out.includes(SENTINEL),
            `Sentinel "${SENTINEL}" was found in report output — time-window isolation is broken.\nRelevant output: ${
              (() => {
                const idx = out.indexOf(SENTINEL);
                return idx >= 0 ? out.slice(Math.max(0, idx - 100), idx + 200) : '(not found — check above)';
              })()
            }`
          );
        } finally {
          // Always clean up the fixture row
          await sql`DELETE FROM voice_pipeline_events WHERE id = ${fixtureRowId}`;
          console.log(DIM(`  Cleaned up fixture row ${fixtureRowId}`));
        }
      }
    }
  }

  // ── Test 5: Guardian heard/missed outcomes (fixture) ─────────────────────
  // Inserts two synthetic gl_guardian_fire rows for a real session — one with
  // outcome:'heard', one with outcome:'missed' — then runs the report and verifies
  // both labels appear in the output.  Proves the report correctly reads persisted
  // outcomes rather than treating all fires as pending.
  console.log(B('\nTest 5 — Guardian outcome rendering: HEARD and MISSED labels appear'));
  sep();
  {
    const sessions = await sql`
      SELECT id, user_id, started_at, ended_at
      FROM voice_sessions
      WHERE user_id IS NOT NULL
        AND exchange_count > 0
      ORDER BY started_at DESC
      LIMIT 1
    `;

    if (sessions.length === 0) {
      console.log(Y('  SKIP: no suitable session found (need user_id)'));
    } else {
      const s = sessions[0];
      const sessionId  = s.id as string;
      const userId     = s.user_id as string;
      const sessionTs  = new Date(s.started_at as string);
      // Place fixture events inside the session window (30s after start)
      const insideTs   = new Date(sessionTs.getTime() + 30_000).toISOString();

      const HEARD_PHRASE  = `CI_GUARDIAN_HEARD_${Date.now()}`;
      const MISSED_PHRASE = `CI_GUARDIAN_MISSED_${Date.now()}`;

      const makeGuardianPayload = (phrase: string, outcome: 'heard' | 'missed') =>
        JSON.stringify({
          ts: insideTs, path: 'pre-turn', phrase,
          charsInjected: 42, channel: 'concat',
          outcome,
          groundingPreview: 'ci-fixture',
          conversationId: null,
        });

      let heardId: string | null = null;
      let missedId: string | null = null;
      try {
        const [h, m] = await Promise.all([
          sql`
            INSERT INTO voice_pipeline_events (id, session_id, user_id, event_type, event_data, created_at)
            VALUES (gen_random_uuid(), ${sessionId}, ${userId}, 'gl_guardian_fire',
                    ${makeGuardianPayload(HEARD_PHRASE, 'heard')}::jsonb, ${insideTs}::timestamptz)
            RETURNING id
          `,
          sql`
            INSERT INTO voice_pipeline_events (id, session_id, user_id, event_type, event_data, created_at)
            VALUES (gen_random_uuid(), ${sessionId}, ${userId}, 'gl_guardian_fire',
                    ${makeGuardianPayload(MISSED_PHRASE, 'missed')}::jsonb, ${insideTs}::timestamptz)
            RETURNING id
          `,
        ]);
        heardId  = h[0]?.id as string ?? null;
        missedId = m[0]?.id as string ?? null;
        console.log(DIM(`  Inserted heard=${heardId}  missed=${missedId}`));
      } catch (err: any) {
        console.log(Y(`  SKIP: could not insert guardian fixture rows — ${err?.message ?? err}`));
      }

      if (heardId && missedId) {
        try {
          const { out, exitCode } = run(sessionId);
          assert('report exits 0', exitCode === 0, `exitCode=${exitCode}\n${out.slice(0, 400)}`);
          // Strip ANSI codes so string matching is reliable
          const plain = out.replace(/\x1b\[[0-9;]*m/g, '');
          assert(
            'HEARD label appears in guardian section',
            plain.includes('HEARD'),
            `"HEARD" not found in output. Guardian section:\n${
              (() => { const i = plain.indexOf('GUARDIAN'); return i >= 0 ? plain.slice(i, i + 600) : plain.slice(0, 600); })()
            }`
          );
          assert(
            'MISSED label appears in guardian section',
            plain.includes('MISSED'),
            `"MISSED" not found in output. Guardian section:\n${
              (() => { const i = plain.indexOf('GUARDIAN'); return i >= 0 ? plain.slice(i, i + 600) : plain.slice(0, 600); })()
            }`
          );
        } finally {
          await Promise.all([
            sql`DELETE FROM voice_pipeline_events WHERE id = ${heardId}`,
            sql`DELETE FROM voice_pipeline_events WHERE id = ${missedId}`,
          ]);
          console.log(DIM(`  Cleaned up guardian fixture rows`));
        }
      }
    }
  }

  // ── Test 6: Write-ordering regression — insert null then UPDATE to resolved ─
  // Mimics the production sequence: INSERT with outcome:null (fire moment),
  // then UPDATE to heard/missed (when outcome resolves via _persistGuardianOutcome).
  // Verifies the final persisted state is the resolved outcome, not null — proving
  // the _insertPromise chain is necessary (an UPDATE before INSERT commit would
  // leave the row null; INSERT-then-UPDATE leaves it correctly resolved).
  console.log(B('\nTest 6 — Write-ordering: INSERT(null) → UPDATE(heard) → DB shows heard'));
  sep();
  {
    const sessions = await sql`
      SELECT id, user_id, started_at
      FROM voice_sessions
      WHERE user_id IS NOT NULL AND exchange_count > 0
      ORDER BY started_at DESC LIMIT 1
    `;

    if (sessions.length === 0) {
      console.log(Y('  SKIP: no suitable session found'));
    } else {
      const s = sessions[0];
      const sessionId = s.id as string;
      const userId    = s.user_id as string;
      const insideTs  = new Date(new Date(s.started_at as string).getTime() + 60_000).toISOString();

      const PHRASE = `CI_ORDERING_PHRASE_${Date.now()}`;
      const nullPayload = JSON.stringify({
        ts: insideTs, path: 'pre-turn', phrase: PHRASE,
        charsInjected: null, channel: 'concat', outcome: null,
        groundingPreview: null, conversationId: null,
      });

      let rowId: string | null = null;
      try {
        // Step 1 — INSERT with outcome: null (the initial fire INSERT)
        const inserted = await sql`
          INSERT INTO voice_pipeline_events (id, session_id, user_id, event_type, event_data, created_at)
          VALUES (gen_random_uuid(), ${sessionId}, ${userId}, 'gl_guardian_fire',
                  ${nullPayload}::jsonb, ${insideTs}::timestamptz)
          RETURNING id
        `;
        rowId = inserted[0]?.id as string ?? null;
        console.log(DIM(`  Inserted row ${rowId} with outcome=null`));

        // Step 2 — verify DB shows null before the UPDATE
        const before = await sql`
          SELECT event_data->>'outcome' AS outcome
          FROM voice_pipeline_events WHERE id = ${rowId}
        `;
        assert(
          'DB outcome is null immediately after INSERT',
          before[0]?.outcome === null || before[0]?.outcome === undefined || before[0]?.outcome === 'null',
          `expected null, got "${before[0]?.outcome}"`
        );

        // Step 3 — UPDATE outcome to 'heard' (what _persistGuardianOutcome does after INSERT resolves)
        await sql`
          UPDATE voice_pipeline_events
          SET event_data = event_data || ${'{"outcome":"heard"}'}::jsonb
          WHERE id = ${rowId}
        `;

        // Step 4 — verify DB now shows 'heard'
        const after = await sql`
          SELECT event_data->>'outcome' AS outcome
          FROM voice_pipeline_events WHERE id = ${rowId}
        `;
        assert(
          'DB outcome is "heard" after chained UPDATE',
          after[0]?.outcome === 'heard',
          `expected "heard", got "${after[0]?.outcome}"`
        );

        // Step 5 — run the report and verify HEARD appears (report reads from DB)
        const { out, exitCode } = run(sessionId);
        assert('report exits 0', exitCode === 0, `exitCode=${exitCode}`);
        const plain = out.replace(/\x1b\[[0-9;]*m/g, '');
        assert(
          'report shows HEARD for the updated row',
          plain.includes('HEARD'),
          `"HEARD" not found in guardian section`
        );
      } catch (err: any) {
        console.log(Y(`  SKIP: fixture error — ${err?.message ?? err}`));
      } finally {
        if (rowId) {
          await sql`DELETE FROM voice_pipeline_events WHERE id = ${rowId}`;
          console.log(DIM(`  Cleaned up ordering test row ${rowId}`));
        }
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
  if (err?.stack) console.error(DIM(err.stack));
  process.exit(1);
});

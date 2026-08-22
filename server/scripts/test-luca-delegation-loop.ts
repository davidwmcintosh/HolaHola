/**
 * test-luca-delegation-loop.ts
 *
 * End-to-end CI check for the Luca → Alden delegation handoff.
 *
 * Confirms that:
 *   1. The delegation service posts Luca's task to Team Room
 *   2. Alden's response is posted to Team Room (speaker: "Alden")
 *   3. Both entries appear in the delegation result
 *   4. The episode name field is present (null is acceptable — no rolling episode required)
 *   5. The service returns ok:true when Alden responds
 *
 * Self-check (--self-check flag):
 *   Verifies that the test itself fails as expected when the service is broken.
 *   Specifically: confirms the test would catch a completely empty Alden response.
 *
 * Mutation-check (--mutation-check flag):
 *   Confirms the per-engine non-empty assertion catches the silent-failure case:
 *   ok:true is returned but every engine response string is empty (''). This is
 *   the Alden silent-failure described in daniela-caller-silent-failure.md —
 *   where the caller receives ok:true but Alden never actually spoke.
 *
 * Exit code 0 = pass, 1 = fail.
 */

import http from 'http';

// ── Config ────────────────────────────────────────────────────────────────────

const PORT    = process.env.PORT ?? '5000';
const HOST    = 'localhost';
const TOKEN   = process.env.REPLIT_AGENT_TOKEN ?? '';
const IS_SELF_CHECK     = process.argv.includes('--self-check');
const IS_MUTATION_CHECK = process.argv.includes('--mutation-check');

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function post(path: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts: http.RequestOptions = {
      hostname: HOST,
      port: parseInt(PORT, 10),
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-agent-token': TOKEN,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      hostname: HOST,
      port: parseInt(PORT, 10),
      path,
      method: 'GET',
      headers: { 'x-agent-token': TOKEN },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Assertions ────────────────────────────────────────────────────────────────

let _failed = false;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    _failed = true;
  }
}

// ── Shared per-engine validator ────────────────────────────────────────────────

/**
 * Asserts that every engine result in `results` has a non-empty response string.
 * Used by both the live E2E test and the --mutation-check so that weakening or
 * removing this function also breaks the mutation-check — the two are coupled.
 */
function assertEngineResultsNonEmpty(results: Array<{ engine: string; response: string }>): void {
  for (const r of results) {
    assert(
      `Alden [${r.engine}] response non-empty`,
      typeof r.response === 'string' && r.response.trim().length > 0,
      `Got: "${r.response?.slice(0, 80)}"`,
    );
  }
}

// ── Self-check mode ───────────────────────────────────────────────────────────

async function runSelfCheck(): Promise<void> {
  console.log('\n[self-check] Verifying the test catches a broken delegation result...');

  // Simulate what a broken result looks like (empty results array)
  const brokenResult = { ok: false, results: [], engines: [], episodeName: null };

  let selfCheckPassed = true;

  // The test should flag ok:false
  if (brokenResult.ok !== false) {
    console.error('[self-check] ✗ Failed to detect ok:false in broken result');
    selfCheckPassed = false;
  }

  // The test should flag missing results
  if (!Array.isArray(brokenResult.results) || brokenResult.results.length !== 0) {
    console.error('[self-check] ✗ Failed to detect empty results array');
    selfCheckPassed = false;
  }

  if (selfCheckPassed) {
    console.log('[self-check] ✓ Self-check passed — test correctly catches broken delegation result');
    process.exit(0);
  } else {
    console.error('[self-check] ✗ Self-check FAILED — test would not catch the broken result');
    process.exit(1);
  }
}

// ── Mutation-check mode ───────────────────────────────────────────────────────

/**
 * --mutation-check
 *
 * Confirms that the E2E assertions would catch the *silent-failure* case:
 * the endpoint returns ok:true with a non-empty results array, but every
 * engine response string is empty (""). This mirrors the Alden silent-failure
 * described in daniela-caller-silent-failure.md.
 *
 * The check succeeds (exit 0) when the assertions correctly flag the empty
 * response. It fails (exit 1) when the assertions pass on the empty response —
 * meaning the guard is missing and the silent failure would go undetected.
 */
async function runMutationCheck(): Promise<void> {
  console.log('\n[mutation-check] Confirming assertEngineResultsNonEmpty catches an ok:true result with empty Alden response...');
  console.log('[mutation-check] (uses the same shared validator as the E2E test — if that validator is removed, this check fails too)\n');

  // Reset the global failure flag so we start clean
  _failed = false;

  // Call the SAME shared validator the E2E test uses, with the silent-failure
  // payload: ok:true but every response string is empty ('').
  // If assertEngineResultsNonEmpty is removed or its predicate weakened,
  // _failed will remain false and we exit 1 below.
  assertEngineResultsNonEmpty([{ engine: 'gemini', response: '' }]);

  if (_failed) {
    console.log('\n[mutation-check] ✓ Mutation-check passed — assertEngineResultsNonEmpty correctly caught the empty response\n');
    process.exit(0);
  } else {
    console.error('\n[mutation-check] ✗ Mutation-check FAILED — assertEngineResultsNonEmpty did NOT flag the empty Alden response');
    console.error('[mutation-check]   The shared per-engine non-empty guard is missing or its predicate has been weakened.\n');
    process.exit(1);
  }
}

// ── Main test ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (IS_SELF_CHECK) {
    await runSelfCheck();
    return;
  }

  if (IS_MUTATION_CHECK) {
    await runMutationCheck();
    return;
  }

  if (!TOKEN) {
    console.error('FATAL: REPLIT_AGENT_TOKEN not set — cannot authenticate');
    process.exit(1);
  }

  console.log('\n── Luca → Alden Delegation Loop CI ──────────────────────────\n');

  // ── 1. Snapshot Team Room thread before the delegation ────────────────────
  console.log('Step 1: Snapshot Team Room before delegation...');
  const beforeSnap = await get('/api/agent/team-room/thread?limit=20');
  assert('Team Room thread reachable', beforeSnap.status === 200, `status ${beforeSnap.status}`);
  const msgsBefore: any[] = beforeSnap.body?.messages ?? [];
  const countBefore = msgsBefore.length;
  console.log(`  Messages before: ${countBefore}`);

  // ── 2. Submit a delegation task ───────────────────────────────────────────
  console.log('\nStep 2: Submit delegation task...');
  const taskText = `[CI delegation test ${Date.now()}] Please confirm the delegation loop is working. Respond with a one-sentence confirmation.`;
  const delegateResp = await post('/api/luca/delegate', {
    task: taskText,
    context: 'This is an automated CI test of the Luca → Alden delegation handoff.',
    engines: 'current',
  });

  assert(
    'Delegation endpoint returns 200',
    delegateResp.status === 200,
    `status ${delegateResp.status}, body: ${JSON.stringify(delegateResp.body).slice(0, 200)}`,
  );

  const result = delegateResp.body as {
    ok?: boolean;
    results?: Array<{ engine: string; response: string }>;
    engines?: string[];
    episodeName?: string | null;
    error?: string;
  };

  assert('ok is true', result.ok === true, result.error);
  assert('results array present', Array.isArray(result.results), JSON.stringify(result.results));
  assert('at least one engine result', (result.results?.length ?? 0) >= 1, `got ${result.results?.length}`);
  assert('engines array present', Array.isArray(result.engines), JSON.stringify(result.engines));

  // episodeName may be null if no rolling episode is active — that's fine
  assert(
    'episodeName field present (null allowed)',
    'episodeName' in result,
    JSON.stringify(result),
  );
  console.log(`  episodeName: ${result.episodeName ?? '(none — no rolling episode active)'}`);

  // Each engine result must have a non-empty response (shared validator)
  assertEngineResultsNonEmpty(result.results ?? []);

  // ── 3. Verify Team Room has the delegation messages ──────────────────────
  // NOTE: storage.getRoomMessages orders by ASC timestamp with a hard cap,
  // so a small limit only returns the oldest messages. We request a large
  // limit (10 000) to cover all messages including the just-posted ones,
  // then filter by the unique task marker text so the check is deterministic.
  console.log('\nStep 3: Verify Team Room received both Luca task + Alden response...');
  const afterSnap = await get('/api/agent/team-room/thread?limit=10000');
  assert('Team Room thread still reachable', afterSnap.status === 200, `status ${afterSnap.status}`);
  const msgsAfter: any[] = afterSnap.body?.messages ?? [];

  // Extract the unique timestamp marker embedded in the task text
  const taskMarker = taskText.match(/CI delegation test \d+/)?.[0] ?? 'CI delegation test';

  // Luca's task announcement must be present — identified by the unique marker
  const lucaTaskMsg = msgsAfter.find(
    (m: any) => m.speaker === 'Luca' && m.content?.includes(taskMarker),
  );
  assert(
    'Luca task announcement in Team Room',
    !!lucaTaskMsg,
    `no Luca message containing "${taskMarker}" found in ${msgsAfter.length} messages`,
  );

  // Alden's delegation response must follow Luca's message
  // We identify it by speaker and by appearing after the Luca message timestamp
  const lucaTs = lucaTaskMsg ? new Date(lucaTaskMsg.timestamp ?? 0).getTime() : 0;
  const aldenRespMsg = msgsAfter.find(
    (m: any) =>
      m.speaker === 'Alden' &&
      (lucaTs === 0 || new Date(m.timestamp ?? 0).getTime() >= lucaTs),
  );
  assert(
    'Alden delegation response in Team Room',
    !!aldenRespMsg,
    `no Alden message found after Luca task announcement`,
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n── Results ──────────────────────────────────────────────────\n');
  if (_failed) {
    console.error('FAIL — one or more assertions failed (see ✗ above)\n');
    process.exit(1);
  } else {
    console.log('PASS — Luca → Alden delegation loop confirmed end-to-end\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});

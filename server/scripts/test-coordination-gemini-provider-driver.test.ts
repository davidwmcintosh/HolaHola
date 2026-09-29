import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import pg from 'pg';
import { eq } from 'drizzle-orm';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { db } from '../db';
import {
  coordinationV2Attempts,
  coordinationV2AttemptEvents,
  coordinationV2Sessions,
  coordinationV2TransportLeases,
  coordinationV2TransportWorkClaims,
  coordinationV2TransportWorkResults,
  type CoordinationV2Session,
} from '@shared/schema';
import { createFreshAttempt, transitionCoordinationAttempt } from '../services/coordination-attempt-service';
import {
  CoordinationGeminiAdapter,
  GEMINI_PROVIDER_DESCRIPTOR,
} from '../services/coordination-provider-adapters/gemini';
import type { NormalizedOutcome } from '../services/coordination-runtime';
import type { GeminiTurnResult } from '../services/coordination-provider-adapters/gemini';
import {
  MAX_TURN,
  attemptMovedOn,
  buildTurnBudget,
  callTurnAndAdvance,
  mapOutcomeToFailure,
  resolveTurnInput,
  setGeminiAdapterForTest,
} from '../services/coordination-gemini-provider-driver';

// ---------------------------------------------------------------------------
// Pure-function coverage -- no database, no adapter, no network.
// ---------------------------------------------------------------------------

/**
 * mapOutcomeToFailure only ever reads `outcome` and `providerDetails.failure`
 * (see coordination-gemini-provider-driver.ts), so a minimal stand-in is
 * enough; the real type carries many more fields this function never looks
 * at.
 */
function fakeTurnResult(outcome: NormalizedOutcome, failure?: string): GeminiTurnResult {
  return { outcome, providerDetails: failure !== undefined ? { failure } : undefined } as unknown as GeminiTurnResult;
}

test('mapOutcomeToFailure covers all 9 non-consumed NormalizedOutcome values', () => {
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('safety_blocked')), { kind: 'safety_blocked' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('refused')), { kind: 'terminal_rejection' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('context_limit')), { kind: 'limit_exhausted' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('interrupted')), { kind: 'transport_interrupted' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('empty_response')), { kind: 'malformed_response' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('malformed_function_call')), { kind: 'malformed_function_call' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('unsupported_provider_outcome')), { kind: 'unsupported_provider_outcome' });

  // retryable_provider_error: rate_limited is called out specifically; every
  // other (or missing) failure detail falls back to provider_outage.
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('retryable_provider_error', 'rate_limited')), { kind: 'rate_limited' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('retryable_provider_error', 'provider_outage')), { kind: 'provider_outage' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('retryable_provider_error')), { kind: 'provider_outage' });

  // terminal_provider_error: authentication_failed and limit_exhausted are
  // called out specifically; every other (or missing) failure detail falls
  // back to terminal_rejection.
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('terminal_provider_error', 'authentication_failed')), { kind: 'authentication_failed' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('terminal_provider_error', 'limit_exhausted')), { kind: 'limit_exhausted' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('terminal_provider_error', 'some_other_reason')), { kind: 'terminal_rejection' });
  assert.deepEqual(mapOutcomeToFailure(fakeTurnResult('terminal_provider_error')), { kind: 'terminal_rejection' });

  assert.throws(
    () => mapOutcomeToFailure(fakeTurnResult('consumed')),
    /consumed outcome, which is not a failure/,
  );
});

test('buildTurnBudget tracks completed calls and flips mustRespondWithPlainTextNoToolCall exactly at MAX_TURN', () => {
  assert.equal(MAX_TURN, 4, 'the remaining assertions are written against a turn cap of 4');

  assert.deepEqual(buildTurnBudget(0, 1), {
    completedToolCalls: 0, maxTurns: 4, turnsRemainingIncludingThisOne: 4, mustRespondWithPlainTextNoToolCall: false,
  });
  assert.deepEqual(buildTurnBudget(1, 2), {
    completedToolCalls: 1, maxTurns: 4, turnsRemainingIncludingThisOne: 3, mustRespondWithPlainTextNoToolCall: false,
  });
  assert.deepEqual(buildTurnBudget(2, 3), {
    completedToolCalls: 2, maxTurns: 4, turnsRemainingIncludingThisOne: 2, mustRespondWithPlainTextNoToolCall: false,
  });
  // The boundary: nextTurnNumber === MAX_TURN is the last allowed turn, and
  // the model must be told this is its last chance to call a tool -- so the
  // flag is still false going into it, exactly one turn before the cap.
  assert.equal(buildTurnBudget(2, 3).mustRespondWithPlainTextNoToolCall, false);
  // At the cap itself the flag must have flipped to true.
  assert.deepEqual(buildTurnBudget(3, 4), {
    completedToolCalls: 3, maxTurns: 4, turnsRemainingIncludingThisOne: 1, mustRespondWithPlainTextNoToolCall: true,
  });
  assert.equal(buildTurnBudget(3, 4).mustRespondWithPlainTextNoToolCall, true);
  // Past the cap (defensive -- production never calls with nextTurnNumber >
  // MAX_TURN, callTurnAndAdvance fails the attempt first) the flag stays true
  // and turnsRemaining goes negative rather than wrapping or resetting.
  assert.deepEqual(buildTurnBudget(4, 5), {
    completedToolCalls: 4, maxTurns: 4, turnsRemainingIncludingThisOne: 0, mustRespondWithPlainTextNoToolCall: true,
  });
});

// ---------------------------------------------------------------------------
// Database-gated coverage -- resumption from every driver-owned state, and
// the concurrency fence. Mirrors the disposableTarget() gate already proven
// in test-coordination-v2-provider-fallback.test.ts: refuses anything but a
// verified, disposable PostgreSQL URL, and skips (not fails) when none is
// configured.
// ---------------------------------------------------------------------------

function disposableTarget(): string | undefined {
  const ciUrl = getVerifiedCiDatabaseUrl();
  if (ciUrl) return ciUrl;
  const url = process.env.COORDINATION_RUNTIME_TEST_DATABASE_URL;
  if (!url) {
    if (process.env.COORDINATION_RUNTIME_REQUIRE_DATABASE_TESTS === '1') {
      throw new Error('COORDINATION_RUNTIME_TEST_DATABASE_URL is required by the migration gate');
    }
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('COORDINATION_RUNTIME_TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }
  const forbiddenSharedUrl = process.env.COORDINATION_RUNTIME_FORBIDDEN_SHARED_URL;
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || process.env.COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE !== '1'
    || process.env.NEON_SHARED_DATABASE_URL !== url
    || !forbiddenSharedUrl
    || forbiddenSharedUrl === url
  ) {
    throw new Error('Gemini provider driver test refuses a shared/unverified database');
  }
  return url;
}

const POLICY = {
  providerOrder: ['gemini'],
  totalAttemptBudget: 4,
  providerAttemptBudgets: { gemini: 4 },
  fallbackEligibleFailureClasses: [] as string[],
};

/** Operator actions include every action any test in this file needs -- launch (fresh attempts) and resume/terminate for parity with the proven sibling fixture. */
async function bootstrapSessionFixture(
  client: pg.Client, suffix: string,
): Promise<{ sessionId: string; hostId: string; actorId: string }> {
  const id = (kind: string) => `gemini-driver-${kind}-${suffix}`;
  const digest = (kind: string) => createHash('sha256').update(`${suffix}:${kind}`).digest('hex');
  const hostId = id('host');
  const identityId = id('identity');
  const versionId = id('version');
  const grantId = id('grant');
  const sessionId = id('session');
  const actorId = 'gemini-driver-test-operator';

  await client.query('BEGIN');
  await client.query(
    `INSERT INTO coordination_v2_host_enrollments
     (id,host_key,host_type,display_name,protocol_version,public_key,key_fingerprint,
       capabilities,enrollment_digest,enrollment_request_key,status,created_by)
      VALUES ($1,$2,'test','Gemini driver test host',1,'test-key',$3,ARRAY['poll'],$4,$5,'active','gemini-driver-test')`,
    [hostId, id('host-key'), digest('host-fingerprint'), digest('host-enrollment'), id('enrollment-request')],
  );
  await client.query(
    `INSERT INTO coordination_v2_policy_identities
     (id,policy_key,display_name,status,created_by)
     VALUES ($1,$2,'Gemini driver test policy','active','gemini-driver-test')`,
    [identityId, id('policy-key')],
  );
  await client.query(
    `INSERT INTO coordination_v2_policy_versions
     (id,policy_identity_id,version,canonical_policy,policy_digest,approval_state,
      created_by,approved_by,approved_at)
     VALUES ($1,$2,1,$3::jsonb,$4,'approved','gemini-driver-test','founder',now())`,
    [versionId, identityId, JSON.stringify(POLICY), digest('policy')],
  );
  await client.query(
    `INSERT INTO coordination_v2_operator_grants
     (id,policy_identity_id,operator_actor,actions,issued_by,expires_at,grant_digest,request_key)
     VALUES ($1,$2,$3,ARRAY['launch','resume','terminate'],'founder',
             now()+interval '1 hour',$4,$5)`,
    [grantId, identityId, actorId, digest('grant'), id('grant-key')],
  );
  await client.query(
    `INSERT INTO coordination_v2_sessions
     (id,policy_version_id,operator_grant_id,operator_actor,task_ref,task_artifact_sha256,
      repository_identity,starting_commit,enrolled_host_id,requested_providers,expires_at,
      attempt_budget,per_provider_budgets,required_validations,completion_criteria,state,
      idempotency_key,session_digest)
     VALUES ($1,$2,$3,$4,'1645',$5,'repo/gemini-driver-test',$6,$7,ARRAY['gemini'],
             now()+interval '1 hour',4,$8::jsonb,ARRAY[]::text[],'{}'::jsonb,'ready',$9,$10)`,
    [
      sessionId, versionId, grantId, actorId, digest('artifact'), 'a'.repeat(40), hostId,
      JSON.stringify(POLICY.providerAttemptBudgets), id('session-key'), digest('session'),
    ],
  );
  await client.query('COMMIT');
  return { sessionId, hostId, actorId };
}

async function withDatabaseFixture(
  context: TestContext,
  run: (env: { session: CoordinationV2Session; hostId: string; actorId: string }) => Promise<void>,
): Promise<void> {
  const databaseUrl = disposableTarget();
  if (!databaseUrl) {
    context.skip('requires a verified disposable PostgreSQL URL');
    return;
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const suffix = `${Date.now()}-${randomUUID()}`;
    const { sessionId, hostId, actorId } = await bootstrapSessionFixture(client, suffix);
    const sessionRows = await db.select().from(coordinationV2Sessions).where(eq(coordinationV2Sessions.id, sessionId));
    const session = sessionRows[0];
    if (!session) throw new Error('Gemini driver test fixture session was not persisted');
    await run({ session, hostId, actorId });
  } finally {
    await client.end();
  }
}

test('resolveTurnInput resumes correctly from every driver-owned attempt state after a simulated crash', async (context) => {
  await withDatabaseFixture(context, async ({ session, hostId, actorId }) => {
    const created = await createFreshAttempt({
      sessionId: session.id, requestKey: `attempt-${randomUUID()}`, actorId,
      provider: 'gemini', model: GEMINI_PROVIDER_DESCRIPTOR.model, adapterVersion: GEMINI_PROVIDER_DESCRIPTOR.adapterVersion,
    });
    assert.equal(created.created, true);
    const attemptId = created.id;
    const attemptRow = async () => {
      const rows = await db.select().from(coordinationV2Attempts).where(eq(coordinationV2Attempts.id, attemptId));
      const row = rows[0];
      if (!row) throw new Error('fixture attempt disappeared mid-test');
      return row;
    };

    // --- State 1: created -----------------------------------------------
    let attempt = await attemptRow();
    assert.equal(attempt.state, 'created');
    const fromCreated = await resolveTurnInput(session, attempt, actorId, new Date());
    assert.deepEqual(fromCreated, { turnNumber: 1, priorToolResults: [], fromState: 'provider_active' });
    attempt = await attemptRow();
    assert.equal(attempt.state, 'provider_active');

    // --- State 2a: provider_active, first turn (latest substantive event
    // is provider_started) --------------------------------------------
    const fromProviderActiveFirstTurn = await resolveTurnInput(session, attempt, actorId, new Date());
    assert.deepEqual(fromProviderActiveFirstTurn, { turnNumber: 1, priorToolResults: [], fromState: 'provider_active' });

    // --- attemptMovedOn: matches, mismatches, and a missing row ----------
    assert.equal(await attemptMovedOn(attempt.id, 'provider_active'), false);
    assert.equal(await attemptMovedOn(attempt.id, 'provider_continuation'), true);
    assert.equal(await attemptMovedOn(randomUUID(), 'provider_active'), true);

    // Manually record the intent_ready transition callTurnAndAdvance would
    // have written after turn 1 asked to call git_status.
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now: new Date(),
      requestKey: `t1-intent-ready-${randomUUID()}`,
      command: { type: 'intent_ready' },
      eventMetadata: { turnNumber: 1, callId: 'call-1', name: 'git_status' },
      expectedFromState: 'provider_active',
    });
    attempt = await attemptRow();
    assert.equal(attempt.state, 'intent_ready');

    // --- State 5: intent_ready (crash between intent_ready and host_wait) -
    const fromIntentReady = await resolveTurnInput(session, attempt, actorId, new Date());
    assert.equal(fromIntentReady, null);
    attempt = await attemptRow();
    assert.equal(attempt.state, 'waiting_for_host', 'resolveTurnInput must itself complete the host_wait recovery transition');

    // Drive the host side of the protocol by hand up to result_ready, using
    // a real lease/claim/result chain (see coordinationV2TransportWorkResults'
    // composite FKs in shared/schema.ts) so the fixture is exactly what a
    // genuine host submission would leave behind.
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now: new Date(),
      requestKey: `t1-host-started-${randomUUID()}`,
      command: { type: 'host_started' },
      expectedFromState: 'waiting_for_host',
    });
    attempt = await attemptRow();
    assert.equal(attempt.state, 'host_active');

    const leaseId = randomUUID();
    const claimId = randomUUID();
    const now = new Date();
    await db.insert(coordinationV2TransportLeases).values({
      id: leaseId, sessionId: session.id, enrolledHostId: hostId, holderInstanceId: 'gemini-driver-test-host-instance',
      epoch: 1, state: 'active', issuedAt: now, expiresAt: new Date(now.getTime() + 3_600_000), createdAt: now,
    });
    await db.insert(coordinationV2TransportWorkClaims).values({
      id: claimId, sessionId: session.id, attemptId: attempt.id, leaseId, enrolledHostId: hostId,
      holderInstanceId: 'gemini-driver-test-host-instance', epoch: 1, requestKey: `claim-${randomUUID()}`,
      commandDigest: createHash('sha256').update('claim').digest('hex'), state: 'active', createdAt: now,
    });
    await db.insert(coordinationV2TransportWorkResults).values({
      id: randomUUID(), sessionId: session.id, attemptId: attempt.id, claimId, leaseId, enrolledHostId: hostId,
      holderInstanceId: 'gemini-driver-test-host-instance', epoch: 1, requestKey: `result-${randomUUID()}`,
      resultDigest: createHash('sha256').update('result').digest('hex'),
      result: { callId: 'call-1', name: 'git_status', toolResult: { ok: true, output: 'nothing to commit, working tree clean' } },
      createdAt: now,
    });
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now: new Date(),
      requestKey: `t1-result-ready-${randomUUID()}`,
      command: { type: 'result_ready' },
      expectedFromState: 'host_active',
    });
    attempt = await attemptRow();
    assert.equal(attempt.state, 'result_ready');

    // --- State 4: result_ready --------------------------------------------
    const fromResultReady = await resolveTurnInput(session, attempt, actorId, new Date());
    const expectedPriorToolResults = [
      { callId: 'call-1', name: 'git_status', result: { ok: true, output: 'nothing to commit, working tree clean' } },
      { turnBudget: buildTurnBudget(1, 2) },
    ];
    assert.deepEqual(fromResultReady, { turnNumber: 2, priorToolResults: expectedPriorToolResults, fromState: 'provider_continuation' });
    attempt = await attemptRow();
    assert.equal(attempt.state, 'provider_continuation');

    // --- State 3: provider_continuation (pure re-read, no further transition) -
    const fromProviderContinuation = await resolveTurnInput(session, attempt, actorId, new Date());
    assert.deepEqual(fromProviderContinuation, { turnNumber: 2, priorToolResults: expectedPriorToolResults, fromState: 'provider_continuation' });
    attempt = await attemptRow();
    assert.equal(attempt.state, 'provider_continuation', 'a provider_continuation read must not itself transition anything');

    // --- State 2b: provider_active via a provider_resumed crash marker ----
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now: new Date(),
      requestKey: `t2-provider-resumed-${randomUUID()}`,
      command: { type: 'provider_resumed' },
      eventMetadata: { turnNumber: 2, priorToolResults: expectedPriorToolResults },
      expectedFromState: 'provider_continuation',
    });
    attempt = await attemptRow();
    assert.equal(attempt.state, 'provider_active');
    const fromProviderActiveResumed = await resolveTurnInput(session, attempt, actorId, new Date());
    assert.deepEqual(fromProviderActiveResumed, { turnNumber: 2, priorToolResults: expectedPriorToolResults, fromState: 'provider_active' });

    // Leave no open attempt behind for any later test in this process that
    // might scan for open Gemini attempts.
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now: new Date(),
      requestKey: `cleanup-fail-${randomUUID()}`,
      command: { type: 'fail', classification: 'fresh_attempt_same_provider' },
    });
  });
});

test('callTurnAndAdvance discards a stale turn() outcome once the attempt has already moved on (concurrency fence)', async (context) => {
  await withDatabaseFixture(context, async ({ session, actorId }) => {
    const created = await createFreshAttempt({
      sessionId: session.id, requestKey: `attempt-${randomUUID()}`, actorId,
      provider: 'gemini', model: GEMINI_PROVIDER_DESCRIPTOR.model, adapterVersion: GEMINI_PROVIDER_DESCRIPTOR.adapterVersion,
    });
    const attemptId = created.id;
    const attemptRow = async () => {
      const rows = await db.select().from(coordinationV2Attempts).where(eq(coordinationV2Attempts.id, attemptId));
      const row = rows[0];
      if (!row) throw new Error('fixture attempt disappeared mid-test');
      return row;
    };

    let attempt = await attemptRow();
    const input = await resolveTurnInput(session, attempt, actorId, new Date());
    assert.ok(input, 'resolveTurnInput must produce an input for a freshly created attempt');
    attempt = await attemptRow();
    assert.equal(attempt.state, 'provider_active');

    // The fake transport simulates a second, faster-finishing concurrent
    // pass: before this (slower) call even returns its own response, the
    // attempt has already been failed out from underneath it. A real
    // functionCall response is returned anyway, proving the fence discards
    // it purely because the attempt moved on -- not because this response
    // happened to look like a failure.
    let transportCalls = 0;
    const raceTransport = async () => {
      transportCalls += 1;
      await transitionCoordinationAttempt({
        attemptId: attempt.id, actorId, now: new Date(),
        requestKey: `race-concurrent-advance-${randomUUID()}`,
        command: { type: 'fail', classification: 'fresh_attempt_same_provider' },
      });
      return {
        status: 200,
        body: JSON.stringify({
          candidates: [{ content: { parts: [{ functionCall: { name: 'git_status', id: 'call-race', args: {} } }] } }],
        }),
      };
    };
    setGeminiAdapterForTest(new CoordinationGeminiAdapter(raceTransport, 'test-key', 'https://gemini.example.test'));
    try {
      await callTurnAndAdvance(session, attempt, actorId, input, new Date());
    } finally {
      setGeminiAdapterForTest(null);
    }
    assert.equal(transportCalls, 1, 'the fake transport must actually have been invoked for this assertion to mean anything');

    const finalAttempt = await attemptRow();
    assert.equal(finalAttempt.state, 'retryable_failed', 'the race\'s own fail transition must be the last word, not the stale success');

    const events = await db.select().from(coordinationV2AttemptEvents)
      .where(eq(coordinationV2AttemptEvents.attemptId, attemptId));
    assert.equal(
      events.some((event) => event.eventType === 'intent_ready'),
      false,
      'the discarded outcome must never have been allowed to record an intent_ready transition',
    );
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

function disposableTarget(): string | undefined {
  const ci = getVerifiedCiDatabaseUrl();
  if (ci) return ci;
  const url = process.env.COORDINATOR_V2_TEST_DATABASE_URL;
  if (!url) {
    if (process.env.COORDINATOR_V2_REQUIRE_DATABASE_TESTS === '1') {
      throw new Error('COORDINATOR_V2_TEST_DATABASE_URL is required by the migration gate');
    }
    return undefined;
  }
  if (process.env.COORDINATOR_V2_TEST_DATABASE_DISPOSABLE !== '1'
    || process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL === url
    || process.env.NEON_SHARED_DATABASE_URL !== url) {
    throw new Error('Coordinator V2 session tests refuse a shared/unverified database');
  }
  return url;
}
const hex = (c: string) => c.repeat(64);

test('bounded session create-or-resume converges concurrent identical launches', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const id = (kind: string) => `session-service-${kind}-${suffix}`;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id, host_key, host_type, display_name, protocol_version, public_key, key_fingerprint,
        capabilities, enrollment_digest, status, created_by)
       VALUES ($1,$2,'linux','session test host',1,'public',$3,ARRAY['runner'],$4,'active','test')`,
      [id('host'), id('host-key'), hex('a'), hex('b')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities (id,policy_key,display_name,status,created_by)
       VALUES ($1,$2,'session test policy','active','test')`, [id('identity'), id('policy-key')],
    );
    const policy = {
      providerOrder: ['gemini', 'openai'], sessionDurationMs: 60_000,
      totalAttemptBudget: 2, perProviderAttemptBudgets: { gemini: 1, openai: 1 },
      requiredValidationCommands: ['typecheck'], requiredCompletionEvidence: ['digest'],
      cleanupRequirements: ['revoke_authority'],
    };
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id,policy_identity_id,version,canonical_policy,policy_digest,approval_state,created_by,approved_by,approved_at)
       VALUES ($1,$2,1,$3::jsonb,$4,'approved','test','founder',now())`,
      [id('version'), id('identity'), JSON.stringify(policy), hex('c'),],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id,policy_identity_id,operator_actor,actions,issued_by,expires_at,grant_digest,request_key)
       VALUES ($1,$2,'operator-test',ARRAY['launch','resume','terminate'],'founder',now()+interval '1 hour',$3,$4)`,
      [id('grant'), id('identity'), hex('d'), id('grant-key')],
    );
    await client.query('COMMIT');
    const { createOrResumeSession, transitionCoordinationSession } = await import('../services/coordination-session-service');
    const { createFreshAttempt, transitionCoordinationAttempt } = await import('../services/coordination-attempt-service');
    const { acceptCoordinationCompletion, transitionCoordinationCleanup } = await import('../services/coordination-cleanup-service');
    const input = {
      operatorActor: 'operator-test', operatorGrantId: id('grant'), policyVersionId: id('version'),
      taskRef: '1', taskArtifactSha256: hex('e'), repositoryIdentity: 'repo/test',
      startingCommit: '1'.repeat(40), enrolledHostId: id('host'), requestedProviders: ['gemini', 'openai'],
      idempotencyKey: id('launch-key'),
    };
    const results = await Promise.all([createOrResumeSession(input), createOrResumeSession(input)]);
    await context.test('identical launches converge with one durable session', () => {
      assert.equal(results[0].id, results[1].id);
    });
    await transitionCoordinationSession({
      sessionId: results[0].id, requestKey: id('ready-request'), actorId: 'operator-test',
      command: { type: 'preparation_ready' },
    });
    const generation = '00000000-0000-4000-8000-000000000001';
    const attempts = await Promise.all([
      createFreshAttempt({
        sessionId: results[0].id, requestKey: id('attempt-one'), actorId: 'operator-test',
        provider: 'gemini', model: 'test-model', adapterVersion: 'test-adapter', attemptGeneration: generation,
      }),
      createFreshAttempt({
        sessionId: results[0].id, requestKey: id('attempt-two'), actorId: 'operator-test',
        provider: 'gemini', model: 'test-model', adapterVersion: 'test-adapter', attemptGeneration: generation,
      }),
    ]);
    await context.test('same generation across request keys preserves identity and ordinals', () => {
      assert.equal(attempts[0].id, attempts[1].id);
      assert.equal(attempts[0].sessionOrdinal, 1);
      assert.equal(attempts[0].providerOrdinal, 1);
    });
    const firstAttempt = attempts[0];
    const budgetRace = await Promise.allSettled([
      createFreshAttempt({
        sessionId: results[0].id, requestKey: id('budget-one'), actorId: 'operator-test',
        provider: 'gemini', model: 'test-model', adapterVersion: 'test-adapter',
        attemptGeneration: '00000000-0000-4000-8000-000000000002',
      }),
      createFreshAttempt({
        sessionId: results[0].id, requestKey: id('budget-two'), actorId: 'operator-test',
        provider: 'gemini', model: 'test-model', adapterVersion: 'test-adapter',
        attemptGeneration: '00000000-0000-4000-8000-000000000003',
      }),
    ]);
    await context.test('concurrent fresh attempts cannot exceed provider budget', () => {
      assert.equal(budgetRace.filter((attempt) => attempt.status === 'fulfilled').length, 0);
    });
    const resumed = await createFreshAttempt({
      sessionId: results[0].id, requestKey: id('attempt-resume'), actorId: 'operator-test',
      provider: 'gemini', model: 'test-model', adapterVersion: 'test-adapter',
      attemptGeneration: firstAttempt.attemptGeneration,
    });
    assert.equal(resumed.id, firstAttempt.id);
    await transitionCoordinationAttempt({
      attemptId: firstAttempt.id, requestKey: id('provider-started'), actorId: 'operator-test',
      command: { type: 'provider_started' },
    });
    await transitionCoordinationAttempt({
      attemptId: firstAttempt.id, requestKey: id('failed'), actorId: 'operator-test',
      command: { type: 'fail', classification: 'terminal_failure', resultCode: 'test-failure' },
    });
    const beforeReopen = await client.query(
      'SELECT (SELECT count(*) FROM coordination_v2_attempts WHERE session_id = $1)::int AS attempts, (SELECT count(*) FROM coordination_v2_attempt_events e JOIN coordination_v2_attempts a ON a.id=e.attempt_id WHERE a.session_id = $1)::int AS events',
      [results[0].id],
    );
    await assert.rejects(
      createFreshAttempt({
        sessionId: results[0].id, requestKey: id('reopen-failed'), actorId: 'operator-test',
        provider: 'gemini', model: 'test-model', adapterVersion: 'test-adapter',
        attemptGeneration: firstAttempt.attemptGeneration,
      }),
      (error: unknown) => (error as { code?: string }).code === 'ATTEMPT_PREVIOUS_INVALID',
    );
    const afterReopen = await client.query(
      'SELECT (SELECT count(*) FROM coordination_v2_attempts WHERE session_id = $1)::int AS attempts, (SELECT count(*) FROM coordination_v2_attempt_events e JOIN coordination_v2_attempts a ON a.id=e.attempt_id WHERE a.session_id = $1)::int AS events',
      [results[0].id],
    );
    await context.test('failed logical attempt cannot reopen or append rows/events', () => {
      assert.deepEqual(afterReopen.rows[0], beforeReopen.rows[0]);
    });
    const fallback = await createFreshAttempt({
      sessionId: results[0].id, requestKey: id('fallback'), actorId: 'operator-test',
      provider: 'openai', model: 'test-model', adapterVersion: 'test-adapter',
      attemptGeneration: '00000000-0000-4000-8000-000000000004',
      previousAttemptId: firstAttempt.id, classification: 'fresh_attempt_next_provider',
    });
    await context.test('fallback uses a new generation and monotonic lineage ordinals', () => {
      assert.notEqual(fallback.attemptGeneration, firstAttempt.attemptGeneration);
      assert.equal(fallback.previousAttemptId, firstAttempt.id);
      assert.equal(fallback.sessionOrdinal, 2);
      assert.equal(fallback.providerOrdinal, 1);
    });
    await transitionCoordinationSession({
      sessionId: results[0].id, requestKey: id('verification'), actorId: 'operator-test',
      command: { type: 'begin_verification' },
    });
    const completions = await Promise.allSettled([
      acceptCoordinationCompletion({
        sessionId: results[0].id, requestKey: id('completion-one'), actorId: 'operator-test',
        evidence: [{ type: 'digest', reference: 'result-1', digest: hex('f') }],
      }),
      acceptCoordinationCompletion({
        sessionId: results[0].id, requestKey: id('completion-two'), actorId: 'operator-test',
        evidence: [{ type: 'digest', reference: 'result-2', digest: hex('e') }],
      }),
    ]);
    await context.test('distinct completion envelopes accept exactly one race winner', () => {
      assert.equal(completions.filter((completion) => completion.status === 'fulfilled').length, 1);
    });
    const accepted = completions.find((completion): completion is PromiseFulfilledResult<any> => completion.status === 'fulfilled')?.value;
    await context.test('completion preserves terminal reason and creates four obligations', () => {
      assert.equal(accepted.session.terminalReason, 'completion_accepted');
      assert.equal(accepted.obligations.length, 4);
      assert.ok(accepted.obligations.every((obligation: any) =>
        obligation.terminalOutcome === 'succeeded' && obligation.terminalReason === 'completion_accepted'));
    });
    const cleanup = await transitionCoordinationCleanup({
      obligationId: accepted.obligations[0].id, requestKey: id('cleanup-start'), actorId: 'operator-test',
      command: { type: 'start' },
    });
    const cleanupReplay = await transitionCoordinationCleanup({
      obligationId: accepted.obligations[0].id, requestKey: id('cleanup-start'), actorId: 'operator-test',
      command: { type: 'start' },
    });
    await context.test('cleanup operation receipt replays exactly after mutation', () => {
      assert.deepEqual(cleanupReplay, cleanup);
    });
    await assert.rejects(
      transitionCoordinationCleanup({
        obligationId: accepted.obligations[0].id, requestKey: id('cleanup-start'), actorId: 'operator-test',
        command: { type: 'failed', code: 'changed-envelope' },
      }),
      (error: unknown) => (error as { code?: string }).code === 'CLEANUP_REPLAY_CONFLICT',
    );
    await assert.rejects(
      createOrResumeSession({ ...input, requestedProviders: ['openai'] }),
      (error: unknown) => (error as { code?: string }).code === 'SESSION_CONFLICT',
    );
    const count = await client.query('SELECT count(*)::int AS count FROM coordination_v2_sessions WHERE id = $1', [results[0].id]);
    assert.equal(count.rows[0].count, 1);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
});
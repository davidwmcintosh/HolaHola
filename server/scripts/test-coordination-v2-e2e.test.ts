import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { canonicalizeAndHashPolicy } from '../services/coordination-policy-canonicalization';

/**
 * This suite is intentionally separate from the Coordinator V2 Neon-branch
 * suites.  It is a mutation test: an explicitly disposable URL is mandatory
 * and a URL named as the shared Neon database is always refused.
 */
function disposableTarget(): string | undefined {
  const url = process.env.COORDINATION_RUNTIME_TEST_DATABASE_URL;
  if (!url) {
    if (process.env.COORDINATION_RUNTIME_REQUIRE_DATABASE_TESTS === '1') {
      throw new Error('COORDINATION_RUNTIME_TEST_DATABASE_URL is required by the migration gate');
    }
    if (process.env.COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE === '1') {
      throw new Error('COORDINATION_RUNTIME_TEST_DATABASE_URL is required for the mutation suite');
    }
    return undefined;
  }
  if (process.env.COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE !== '1') {
    throw new Error('COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE=1 is required for the mutation suite');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('COORDINATION_RUNTIME_TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Coordinator V2 e2e requires a PostgreSQL URL');
  }
  const forbiddenSharedUrl = process.env.COORDINATION_RUNTIME_FORBIDDEN_SHARED_URL;
  if (!forbiddenSharedUrl || url === forbiddenSharedUrl) {
    throw new Error('Coordinator V2 e2e requires a distinct forbidden shared URL');
  }
  return url;
}

const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

test('one command completes Coordinator V2 from preparation through terminal cleanup', async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip('set COORDINATION_RUNTIME_TEST_DATABASE_URL and COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE=1');
    return;
  }

  /*
   * Production services intentionally read NEON_SHARED_DATABASE_URL.  The
   * migration gate supplies that variable with the disposable branch URL.
   * Focused local runs may provide only the runtime-test variable, so bind the
   * production service transport to that already-verified URL before loading
   * the service graph.  CI's localhost adapter is not applicable to a Neon
   * disposable branch and must not win this selection.
   */
  const previousNeonUrl = process.env.NEON_SHARED_DATABASE_URL;
  const previousCi = process.env.CI;
  const previousCiUrl = process.env.CI_DATABASE_URL;
  process.env.NEON_SHARED_DATABASE_URL = url;
  delete process.env.CI;
  delete process.env.CI_DATABASE_URL;

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `${Date.now()}-${randomUUID()}`;
  const id = (kind: string) => `coordination-v2-e2e-${kind}-${suffix}`;
  const digest = (kind: string) => sha(`${suffix}:${kind}`);
  const actorId = 'operator-test';
  const holderInstanceId = id('holder');
  const hostId = id('host');
  const identityId = id('identity');
  const versionId = id('version');
  const grantId = id('grant');
  const artifactDigest = digest('artifact');
  const publicMaterialDigest = digest('public-material');
  const startingCommit = 'a'.repeat(40);
  const policy = canonicalizeAndHashPolicy({
    hostTypes: ['windows'],
    hostConstraints: {
      windowsRepositoryBranch: 'main',
      windowsPublicMaterialDigest: publicMaterialDigest,
    },
    providerOrder: ['gemini'],
    sessionDurationMs: 900_000,
    totalAttemptBudget: 2,
    perProviderAttemptBudgets: { gemini: 2 },
    requiredValidationCommands: ['typecheck'],
    requiredCompletionEvidence: ['digest'],
  });

  let sessionId = '';
  let attemptId = '';
  let leaseId = '';
  let leaseEpoch = 0;
  let hostClaim: { claimId: string; attemptId: string; state: string };
  let hostResult: { resultId: string; resultDigest: string; state: string };

  try {
    /*
     * This is fixture authority only.  Every lifecycle mutation after these
     * rows exist is performed by the production Coordinator V2 services.
     */
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id,host_key,host_type,display_name,protocol_version,public_key,key_fingerprint,
        capabilities,enrollment_digest,status,created_by)
       VALUES ($1,$2,'windows','Coordinator V2 e2e host',1,'e2e-public-key',$3,
               ARRAY['preflight','prepare','poll','claim','result'],$4,'active','e2e')`,
      [hostId, id('host-key'), digest('fingerprint'), digest('enrollment')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id,policy_key,display_name,status,created_by)
       VALUES ($1,$2,'Coordinator V2 e2e policy','active','e2e')`,
      [identityId, id('policy-key')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id,policy_identity_id,version,canonical_policy,policy_digest,approval_state,
        created_by,approved_by,approved_at)
       VALUES ($1,$2,1,$3::jsonb,$4,'approved','e2e','founder',now())`,
      [versionId, identityId, JSON.stringify(policy.canonicalPolicy), policy.policyDigest],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id,policy_identity_id,operator_actor,actions,issued_by,expires_at,grant_digest,request_key)
       VALUES ($1,$2,'operator-test',ARRAY['launch','resume','terminate','status'],
               'founder',now()+interval '1 hour',$3,$4)`,
      [grantId, identityId, digest('grant'), id('grant-request')],
    );
    await client.query('COMMIT');

    const [
      { launchOrResumeCoordinationLifecycle },
      generation,
      sessionService,
      attemptService,
      leaseService,
      cleanupService,
      { digestCanonical },
    ] = await Promise.all([
      import('../services/coordination-lifecycle-facade-service'),
      import('../services/coordination-windows-generation'),
      import('../services/coordination-session-service'),
      import('../services/coordination-attempt-service'),
      import('../services/coordination-transport-lease-service'),
      import('../services/coordination-cleanup-service'),
      import('../services/coordination-runtime'),
    ]);
    const { DEFAULT_PROVIDER_REGISTRY } = await import('../services/coordination-provider-adapters/registry');
    let lifecycleStage = 'not-started';
    let lifecycleCause: unknown;
    const traceLifecycleService = <
      T extends (...args: any[]) => Promise<any>,
    >(stage: string, service: T): T => (async (...args: Parameters<T>) => {
      lifecycleStage = stage;
      lifecycleCause = undefined;
      try {
        return await service(...args);
      } catch (error) {
        lifecycleCause = error;
        throw error;
      }
    }) as T;

    const dependencies = {
      resolveTaskMetadata: async () => ({
        taskRef: '9001',
        taskArtifactSha256: artifactDigest,
        repositoryIdentity: 'repo/coordinator-v2-e2e',
        startingCommit,
      }),
      resolvePolicy: async () => ({
        policyVersionId: versionId,
        operatorGrantId: grantId,
        policy: policy.canonicalPolicy,
      }),
      resolveHost: async () => ({ enrolledHostId: hostId }),
      providerRegistry: DEFAULT_PROVIDER_REGISTRY,
      holderInstanceId: () => holderInstanceId,
      leaseDurationMs: 60_000,
      services: {
        createOrResumeSession: traceLifecycleService(
          'create-or-resume-session',
          sessionService.createOrResumeSession,
        ),
        transitionCoordinationSession: traceLifecycleService(
          'transition-session',
          sessionService.transitionCoordinationSession,
        ),
        createFreshAttempt: traceLifecycleService(
          'create-fresh-attempt',
          attemptService.createFreshAttempt,
        ),
        acquireCoordinationTransportLease: traceLifecycleService(
          'acquire-transport-lease',
          leaseService.acquireCoordinationTransportLease,
        ),
      },
    };

    const preparing = await launchOrResumeCoordinationLifecycle(
      { taskRef: '9001' },
      { actorId: actorId, requestKey: id('launch') },
      dependencies,
    );
    assert.deepEqual(preparing, { state: 'preparing', cleanupPending: false });
    const sessionRows = await client.query(
      'SELECT id,state FROM coordination_v2_sessions WHERE idempotency_key=$1',
      [id('launch')],
    );
    assert.equal(sessionRows.rowCount, 1);
    sessionId = sessionRows.rows[0].id as string;

    const reservation = await generation.reserveCoordinationWindowsPreparation({
      sessionId, actorId, reserveRequestKey: id('reserve'),
    });
    assert.equal(reservation.state, 'reserved');
    const promoted = await generation.promoteCoordinationWindowsPreparation({
      sessionId, actorId, reservationId: reservation.id, generationId: reservation.generationId,
      publicMaterialDigest, safePromotionEvidenceDigest: digest('promotion-evidence'),
    });
    assert.equal(promoted.state, 'promoted');
    const acknowledged = await generation.acknowledgeCoordinationWindowsPreparation({
      sessionId, actorId, reservationId: reservation.id, generationId: reservation.generationId,
      publicMaterialDigest, protocolVersion: 1,
      acknowledgementRequestKey: id('preparation-ack'),
      safePromotionEvidenceDigest: digest('promotion-evidence'),
    });
    assert.equal(acknowledged.state, 'acknowledged');
    assert.equal(acknowledged.acknowledgementRequestKey, id('preparation-ack'));

    // The operator-facing one-command resume performs promotion to ready,
    // attempt creation, and lease acquisition without exposing internal IDs.
    let running;
    try {
      running = await launchOrResumeCoordinationLifecycle(
        { taskRef: '9001' },
        { actorId, requestKey: id('launch') },
        dependencies,
      );
    } catch (error) {
      const cause = lifecycleCause instanceof Error
        ? `${lifecycleCause.name}: ${lifecycleCause.message}`
        : String(lifecycleCause);
      assert.fail(
        `one-command resume failed at ${lifecycleStage} (${cause}); public error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    assert.deepEqual(running, { state: 'running', cleanupPending: false });

    const attemptRows = await client.query(
      `SELECT id,provider,state,session_ordinal,attempt_generation
         FROM coordination_v2_attempts WHERE session_id=$1`,
      [sessionId],
    );
    assert.equal(attemptRows.rowCount, 1);
    assert.equal(attemptRows.rows[0].provider, 'gemini');
    assert.equal(attemptRows.rows[0].state, 'created');
    assert.equal(attemptRows.rows[0].session_ordinal, 1);
    attemptId = attemptRows.rows[0].id as string;
    assert.match(attemptRows.rows[0].attempt_generation, /^[0-9a-f]{64}$/);

    // Provider adapter setup and host hand-off are the same production
    // attempt reducer used by the transport service.  The lifecycle facade
    // creates the attempt; these commands represent its provider turn.
    const providerStarted = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('provider-started'), actorId,
      command: { type: 'provider_started' },
    });
    assert.equal(providerStarted.state, 'provider_active');
    const intentReady = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('intent-ready'), actorId,
      command: { type: 'intent_ready' },
    });
    assert.equal(intentReady.state, 'intent_ready');
    const hostWaiting = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('host-wait'), actorId,
      command: { type: 'host_wait' },
    });
    assert.equal(hostWaiting.state, 'waiting_for_host');

    const leaseRows = await client.query(
      `SELECT id,epoch,state,holder_instance_id FROM coordination_v2_transport_leases
       WHERE session_id=$1 AND state='active'`,
      [sessionId],
    );
    assert.equal(leaseRows.rowCount, 1);
    leaseId = leaseRows.rows[0].id as string;
    leaseEpoch = Number(leaseRows.rows[0].epoch);
    assert.equal(leaseEpoch, 1);
    assert.equal(leaseRows.rows[0].holder_instance_id, holderInstanceId);

    /*
     * A provider interruption is classified by the production facade and
     * resumes the same attempt.  The next provider is never consulted and
     * the attempt generation remains immutable.
     */
    const { applyCoordinationProviderFailure } = await import('../services/coordination-lifecycle-facade-service');
    const recovery = await applyCoordinationProviderFailure({
      failure: { kind: 'transport_interrupted', detail: 'lost continuation acknowledgement' },
      sessionId, attemptId, actorId, requestKey: id('provider-recovery'),
    });
    assert.deepEqual(recovery, {
      classification: 'resume_transport',
      reason: 'resume_transport',
      fallbackEligible: false,
    });
    const recoveredAttempt = await client.query(
      'SELECT id,attempt_generation,state FROM coordination_v2_attempts WHERE id=$1',
      [attemptId],
    );
    assert.deepEqual(recoveredAttempt.rows[0], {
      id: attemptId,
      attempt_generation: attemptRows.rows[0].attempt_generation,
      state: 'waiting_for_host',
    });

    const operationDigest = digestCanonical({
      policyVersionId: versionId, sessionId, attemptId, operation: 'execute',
    });
    const protocolBinding = {
      policyVersionId: versionId,
      sessionId,
      attemptId,
      enrolledHostId: hostId,
      transportLeaseId: leaseId,
      leaseEpoch,
      holderInstanceId,
      operation: 'execute',
      operationDigest,
    };
    const transportInput = {
      sessionId, enrolledHostId: hostId, holderInstanceId, actorId,
      leaseId, epoch: leaseEpoch, protocolBinding, authorizedOperation: 'execute',
    };
    const polled = await leaseService.pollCoordinationTransportWork({
      ...transportInput, requestKey: id('host-poll'),
    });
    assert.equal(polled.operation, 'poll');
    assert.equal(polled.attempt.id, attemptId);
    const pollReplay = await leaseService.pollCoordinationTransportWork({
      ...transportInput, requestKey: id('host-poll'),
    });
    assert.deepEqual(pollReplay, polled);

    hostClaim = await leaseService.claimCoordinationTransportWork({
      ...transportInput, attemptId, requestKey: id('host-claim'),
    });
    assert.equal(hostClaim.operation, 'claim');
    assert.equal(hostClaim.attemptId, attemptId);
    assert.equal(hostClaim.state, 'host_active');
    const claimReplay = await leaseService.claimCoordinationTransportWork({
      ...transportInput, attemptId, requestKey: id('host-claim'),
    });
    assert.deepEqual(claimReplay, hostClaim);

    hostResult = await leaseService.resultCoordinationTransportWork({
      ...transportInput,
      attemptId,
      claimId: hostClaim.claimId,
      requestKey: id('host-result'),
      result: { accepted: true, outputDigest: digest('host-output') },
    });
    assert.equal(hostResult.operation, 'result');
    assert.equal(hostResult.attemptId, attemptId);
    assert.equal(hostResult.state, 'result_ready');
    const resultReplay = await leaseService.resultCoordinationTransportWork({
      ...transportInput,
      attemptId,
      claimId: hostClaim.claimId,
      requestKey: id('host-result'),
      result: { accepted: true, outputDigest: digest('host-output') },
    });
    assert.deepEqual(resultReplay, hostResult);

    const continuation = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('provider-continuation'), actorId,
      command: { type: 'provider_continuation' },
    });
    assert.equal(continuation.state, 'provider_continuation');
    const continuationReplay = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('provider-continuation'), actorId,
      command: { type: 'provider_continuation' },
    });
    assert.deepEqual(continuationReplay, continuation);
    const completedAttempt = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('attempt-complete'), actorId,
      command: { type: 'complete', resultCode: 'verified_host_result' },
    });
    assert.equal(completedAttempt.state, 'completed');
    await sessionService.transitionCoordinationSession({
      sessionId, requestKey: id('begin-verification'), actorId,
      command: { type: 'begin_verification' },
    });

    const completion = await cleanupService.acceptCoordinationCompletion({
      sessionId, requestKey: id('completion'), actorId,
      evidence: [{ type: 'digest', reference: hostResult.resultId, digest: hostResult.resultDigest }],
    });
    assert.equal(completion.session.state, 'succeeded');
    assert.equal(completion.session.terminalReason, 'completion_accepted');
    assert.equal(completion.obligations.length, 4);
    assert.ok(completion.obligations.every((obligation: { terminalOutcome: string }) =>
      obligation.terminalOutcome === 'succeeded'));

    const terminalLease = await client.query(
      `SELECT state FROM coordination_v2_transport_leases WHERE id=$1`, [leaseId],
    );
    assert.equal(terminalLease.rows[0].state, 'released');

    // Exercise the reducer-backed cleanup transition and each host receipt.
    for (const obligation of completion.obligations) {
      const started = await cleanupService.transitionCoordinationCleanup({
        obligationId: obligation.id, requestKey: id(`cleanup-start-${obligation.kind}`), actorId,
        command: { type: 'start' },
      });
      assert.equal(started.state, 'in_progress');
      const acknowledgedCleanup = await leaseService.acknowledgeCoordinationCleanup({
        sessionId, enrolledHostId: hostId, holderInstanceId, actorId,
        leaseId, epoch: leaseEpoch, obligationId: obligation.id,
        requestKey: id(`cleanup-ack-${obligation.kind}`),
        evidence: { acknowledged: true, kind: obligation.kind },
      });
      assert.equal(acknowledgedCleanup.operation, 'ack');
      assert.equal(acknowledgedCleanup.outcome, 'acknowledged');
    }

    const evidence = await client.query(
      `SELECT
         s.state, s.terminal_reason,
         (SELECT state FROM coordination_v2_attempts WHERE id=$2) AS attempt_state,
         (SELECT state FROM coordination_v2_transport_leases WHERE id=$3) AS lease_state,
         (SELECT count(*)::int FROM coordination_v2_cleanup_obligations WHERE session_id=$1
             AND state='acknowledged') AS acknowledged_cleanup,
         (SELECT count(*)::int FROM coordination_v2_transport_work_claims WHERE session_id=$1) AS host_claims,
         (SELECT count(*)::int FROM coordination_v2_transport_work_results WHERE session_id=$1) AS host_results,
         (SELECT count(*)::int FROM coordination_v2_session_events WHERE session_id=$1
             AND event_type='completion_accepted') AS completions
       FROM coordination_v2_sessions s WHERE s.id=$1`,
      [sessionId, attemptId, leaseId],
    );
    assert.deepEqual(evidence.rows[0], {
      state: 'succeeded',
      terminal_reason: 'completion_accepted',
      attempt_state: 'completed',
      lease_state: 'released',
      acknowledged_cleanup: 4,
      host_claims: 1,
      host_results: 1,
      completions: 1,
    });
    const eventKinds = await client.query(
      `SELECT event_type FROM coordination_v2_attempt_events
       WHERE attempt_id=$1 ORDER BY sequence`,
      [attemptId],
    );
    assert.deepEqual(eventKinds.rows.map((row) => row.event_type), [
      'attempt_created', 'provider_started', 'intent_ready', 'host_waiting',
      'transport_resumed', 'host_started', 'result_ready',
      'provider_continuation', 'attempt_completed',
    ]);
  } finally {
    // V2 authority/evidence rows are immutable.  The disposable branch owns
    // this unique fixture and is deleted by the migration gate; never issue
    // a teardown DELETE that could collide with an immutability trigger.
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
    if (previousNeonUrl === undefined) delete process.env.NEON_SHARED_DATABASE_URL;
    else process.env.NEON_SHARED_DATABASE_URL = previousNeonUrl;
    if (previousCi === undefined) delete process.env.CI;
    else process.env.CI = previousCi;
    if (previousCiUrl === undefined) delete process.env.CI_DATABASE_URL;
    else process.env.CI_DATABASE_URL = previousCiUrl;
  }
});
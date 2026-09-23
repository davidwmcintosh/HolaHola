import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
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
    throw new Error('Coordinator V2 cleanup tests refuse a shared/unverified database');
  }
  return url;
}

test('terminal cleanup revokes live authority without changing result or evidence', async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip('requires a verified disposable PostgreSQL URL');
    return;
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `${Date.now()}-${randomUUID()}`;
  const id = (kind: string) => `cleanup-test-${kind}-${suffix}`;
  const digest = (kind: string) => createHash('sha256').update(`${suffix}:${kind}`).digest('hex');
  const hostId = id('host');
  const identityId = id('identity');
  const versionId = id('version');
  const grantId = id('grant');
  const sessionId = id('session');
  const attemptId = id('attempt');
  const leaseId = id('lease');
  const evidenceRef = id('evidence');
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id, host_key, host_type, display_name, protocol_version, public_key, key_fingerprint,
         capabilities, enrollment_digest, enrollment_request_key, status, created_by)
        VALUES ($1,$2,'test','Cleanup test host',1,'test-key',$3,ARRAY['poll'],$4,$5,'active','cleanup-test')`,
       [hostId, id('host-key'), digest('host-key'), digest('host-enrollment'), id('enrollment-request')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id, policy_key, display_name, status, created_by)
       VALUES ($1,$2,'Cleanup test policy','active','cleanup-test')`,
      [identityId, id('policy-key')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id, policy_identity_id, version, canonical_policy, policy_digest, approval_state,
        created_by, approved_by, approved_at)
       VALUES ($1,$2,1,'{}'::jsonb,$3,'approved','cleanup-test','founder',now())`,
      [versionId, identityId, digest('policy')],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1,$2,'operator-test',ARRAY['launch','resume','terminate'],'founder',
               now()+interval '1 hour',$3,$4)`,
      [grantId, identityId, digest('grant'), id('grant-key')],
    );
    await client.query(
      `INSERT INTO coordination_v2_sessions
       (id, policy_version_id, operator_grant_id, operator_actor, task_ref, task_artifact_sha256,
        repository_identity, starting_commit, enrolled_host_id, requested_providers, expires_at,
        attempt_budget, per_provider_budgets, required_validations, completion_criteria, state,
        terminal_reason, terminal_at, idempotency_key, session_digest)
       VALUES ($1,$2,$3,'operator-test','1',$4,'repo/test',$5,$6,ARRAY['test'],
               now()+interval '1 hour',5,'{}'::jsonb,ARRAY[]::text[],
                $7::jsonb,'running',NULL,NULL,$8,$9)`,
      [
        sessionId, versionId, grantId, digest('artifact'), '1'.repeat(40), hostId,
        JSON.stringify({ requiredCompletionEvidence: ['digest'] }),
        id('session-key'), digest('session'),
      ],
    );
    await client.query(
      `INSERT INTO coordination_v2_session_events
       (id, session_id, sequence, from_state, to_state, event_type, actor_type, actor_id,
        evidence_ref, request_key, metadata)
        VALUES ($1,$2,1,'ready','running','attempt_started','operator','operator-test',
               $3,$4,$5::jsonb)`,
      [
        id('session-event'), sessionId, evidenceRef, id('completion-request'),
        JSON.stringify({ evidence: [{ type: 'digest', reference: evidenceRef, digest: digest('evidence') }] }),
      ],
    );
    await client.query(
      `INSERT INTO coordination_v2_attempts
       (id, session_id, attempt_generation, provider, model, adapter_version,
        session_ordinal, provider_ordinal, state, attempt_digest, deadline_at)
       VALUES ($1,$2,$3,'test-provider','test-model','adapter-1',1,1,
               'waiting_for_host',$4,now()+interval '1 hour')`,
      [attemptId, sessionId, id('attempt-generation'), digest('attempt')],
    );
    await client.query(
      `INSERT INTO coordination_v2_transport_leases
       (id, session_id, enrolled_host_id, holder_instance_id, epoch, state,
        issued_at, expires_at)
       VALUES ($1,$2,$3,'cleanup-holder',1,'active',now(),now()+interval '1 hour')`,
      [leaseId, sessionId, hostId],
    );
    await client.query('COMMIT');

    const { transitionCoordinationCleanup } = await import('../services/coordination-cleanup-service');
    const { transitionCoordinationAttempt } = await import('../services/coordination-attempt-service');
    const { transitionCoordinationSession } = await import('../services/coordination-session-service');
    const {
      acknowledgeCoordinationCleanup,
      validateCurrentCoordinationTransportLease,
    } = await import('../services/coordination-transport-lease-service');
    const { getCoordinationSessionStatus } = await import('../services/coordination-session-status');

    const attemptRequestKey = id('attempt-host-started');
    const attemptBeforeTerminal = await transitionCoordinationAttempt({
      attemptId,
      requestKey: attemptRequestKey,
      actorId: 'operator-test',
      command: { type: 'host_started' },
    });
    assert.equal(attemptBeforeTerminal.state, 'host_active');
    const transportRequestKey = id('transport-before-terminal');
    const transportBeforeTerminal = await validateCurrentCoordinationTransportLease({
      sessionId,
      enrolledHostId: hostId,
      actorId: 'operator-test',
      holderInstanceId: 'cleanup-holder',
      requestKey: transportRequestKey,
      leaseId,
      epoch: 1,
      operation: 'poll',
    });

    const terminal = await transitionCoordinationSession({
      sessionId,
      requestKey: id('terminal-failure'),
      actorId: 'operator-test',
      command: {
        type: 'fail',
        reason: 'provider_failed',
        classification: 'terminal_failure',
      },
    });
    assert.equal(terminal.state, 'failed');

    const obligationRows = await client.query(
      `SELECT id, kind FROM coordination_v2_cleanup_obligations WHERE session_id=$1`,
      [sessionId],
    );
    const obligationByKind = new Map<string, string>(
      obligationRows.rows.map((row) => [row.kind, row.id]),
    );
    const obligationIds = {
      authority: obligationByKind.get('revoke_authority')!,
      lease: obligationByKind.get('release_lease')!,
      generation: obligationByKind.get('cleanup_generation')!,
      credentials: obligationByKind.get('revoke_credentials')!,
    };
    assert.ok(Object.values(obligationIds).every(Boolean));

    const authorityAtTerminal = await client.query(
      `SELECT a.state AS attempt_state, l.state AS lease_state,
              s.state, s.terminal_reason, s.terminal_at,
              g.revoked_at, h.status AS host_status,
              (SELECT count(*)::int FROM coordination_v2_session_events
               WHERE session_id=$1 AND evidence_ref=$2) AS evidence_count
       FROM coordination_v2_sessions s
       JOIN coordination_v2_attempts a ON a.session_id=s.id
       JOIN coordination_v2_transport_leases l ON l.session_id=s.id
       JOIN coordination_v2_operator_grants g ON g.id=s.operator_grant_id
       JOIN coordination_v2_host_enrollments h ON h.id=s.enrolled_host_id
       WHERE s.id=$1`,
      [sessionId, evidenceRef],
    );
    assert.equal(authorityAtTerminal.rows[0].attempt_state, 'cancelled');
    assert.equal(authorityAtTerminal.rows[0].lease_state, 'released');
    assert.equal(authorityAtTerminal.rows[0].state, 'failed');
    assert.equal(authorityAtTerminal.rows[0].terminal_reason, 'provider_failed');
    assert.ok(authorityAtTerminal.rows[0].terminal_at);
    assert.equal(authorityAtTerminal.rows[0].evidence_count, 1);
    assert.equal(authorityAtTerminal.rows[0].revoked_at, null);
    assert.equal(authorityAtTerminal.rows[0].host_status, 'active');

    await assert.rejects(
      transitionCoordinationAttempt({
        attemptId, requestKey: id('after-cleanup-attempt'), actorId: 'operator-test',
        command: { type: 'result_ready' },
      }),
      (error: unknown) => (error as { code?: string }).code === 'ATTEMPT_SESSION_TERMINAL',
    );

    // Simulate a later mutable-authority change. Historical reads and cleanup
    // repair remain bound to the immutable session actor and lease lineage.
    //
    // Anchor the forced expiry on this row's own issued_at rather than
    // `now() - interval '1 second'`. The latter assumes at least a second of
    // wall-clock time separates the INSERT above from this UPDATE, which
    // holds on a networked Neon connection but not against a fast local
    // loopback Postgres (e.g. GitHub Actions' job-local service): there the
    // whole sequence can complete in well under a second, making
    // `now() - 1s` land at or before `issued_at` and violate the
    // `coordination_v2_operator_grant_lifecycle` check constraint
    // (`expires_at > issued_at`). `issued_at + 1ms` always satisfies that
    // constraint and is already in the past by the time anything reads it,
    // since real time has elapsed over the several awaited queries above.
    await client.query(
      `UPDATE coordination_v2_operator_grants
          SET revoked_at=now(), expires_at=issued_at+interval '1 millisecond'
        WHERE id=$1`,
      [grantId],
    );
    const historicalStatus = await getCoordinationSessionStatus({
      sessionId,
      actorId: 'operator-test',
    });
    assert.equal(historicalStatus.state, 'failed');
    assert.deepEqual(historicalStatus.blockingReason, {
      code: 'cleanup_required',
      phase: 'cleanup',
      retryable: true,
    });
    assert.equal(historicalStatus.currentActiveLeaseHolder, null);
    await assert.rejects(
      getCoordinationSessionStatus({ sessionId, actorId: 'other-operator' }),
      (error: unknown) => (error as { code?: string }).code === 'STATUS_NOT_AUTHORIZED',
    );

    const replayAfterTerminal = await transitionCoordinationAttempt({
      attemptId,
      requestKey: attemptRequestKey,
      actorId: 'operator-test',
      command: { type: 'host_started' },
    });
    assert.deepEqual(replayAfterTerminal, attemptBeforeTerminal);
    assert.deepEqual(await validateCurrentCoordinationTransportLease({
      sessionId,
      enrolledHostId: hostId,
      actorId: 'operator-test',
      holderInstanceId: 'cleanup-holder',
      requestKey: transportRequestKey,
      leaseId,
      epoch: 1,
      operation: 'poll',
    }), transportBeforeTerminal);
    await assert.rejects(
      transitionCoordinationAttempt({
        attemptId,
        requestKey: attemptRequestKey,
        actorId: 'other-operator',
        command: { type: 'host_started' },
      }),
      (error: unknown) => (error as { code?: string }).code === 'ATTEMPT_TRANSITION_REJECTED',
    );

    const cleanupAckInput = {
      sessionId,
      enrolledHostId: hostId,
      actorId: 'operator-test',
      holderInstanceId: 'cleanup-holder',
      requestKey: id('released-lease-ack'),
      leaseId,
      epoch: 1,
      obligationId: obligationIds.lease,
      evidence: { released: true },
    };
    const concurrentAcks = await Promise.all([
      acknowledgeCoordinationCleanup(cleanupAckInput),
      acknowledgeCoordinationCleanup(cleanupAckInput),
    ]);
    const releasedLeaseAck = concurrentAcks[0];
    assert.deepEqual(concurrentAcks[1], releasedLeaseAck);
    assert.equal(releasedLeaseAck.obligationId, obligationIds.lease);
    assert.equal(releasedLeaseAck.leaseId, leaseId);
    assert.deepEqual(
      await acknowledgeCoordinationCleanup(cleanupAckInput),
      releasedLeaseAck,
    );
    await assert.rejects(
      acknowledgeCoordinationCleanup({
        ...cleanupAckInput,
        evidence: { released: false },
      }),
      (error: unknown) => (error as { code?: string }).code === 'LEASE_REPLAY_CONFLICT',
    );

    const authorityStarted = await transitionCoordinationCleanup({
      obligationId: obligationIds.authority,
      requestKey: id('authority-start'),
      actorId: 'operator-test',
      command: { type: 'start' },
    });
    const authorityReplay = await transitionCoordinationCleanup({
      obligationId: obligationIds.authority,
      requestKey: id('authority-start'),
      actorId: 'operator-test',
      command: { type: 'start' },
    });
    assert.deepEqual(authorityReplay, authorityStarted);

    const failure = await transitionCoordinationCleanup({
      obligationId: obligationIds.generation,
      requestKey: id('cleanup-failure'),
      actorId: 'operator-test',
      command: { type: 'failed', code: 'generation_cleanup_unavailable' },
    });
    assert.equal(failure.state, 'repair_required');
    assert.equal(failure.terminalOutcome, 'failed');
    assert.equal(failure.terminalReason, 'provider_failed');
    await transitionCoordinationCleanup({
      obligationId: obligationIds.generation,
      requestKey: id('cleanup-retry'),
      actorId: 'operator-test',
      command: { type: 'retry' },
    });
    const generationStarted = await transitionCoordinationCleanup({
      obligationId: obligationIds.generation,
      requestKey: id('generation-start'),
      actorId: 'operator-test',
      command: { type: 'start' },
    });
    assert.equal(generationStarted.state, 'in_progress');

    const finalState = await client.query(
      `SELECT state, terminal_outcome, terminal_reason
       FROM coordination_v2_cleanup_obligations WHERE session_id=$1 ORDER BY kind`,
      [sessionId],
    );
    assert.ok(finalState.rows.every((row) => row.terminal_outcome === 'failed'
      && row.terminal_reason === 'provider_failed'));
  } finally {
    await client.query('BEGIN').catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_attempt_events WHERE attempt_id=$1', [attemptId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_cleanup_acknowledgements WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_cleanup_obligations WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_leases WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_session_events WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_attempts WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_sessions WHERE id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_operator_grants WHERE id=$1', [grantId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_policy_versions WHERE id=$1', [versionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_policy_identities WHERE id=$1', [identityId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_host_enrollments WHERE id=$1', [hostId]).catch(() => undefined);
    await client.query('COMMIT').catch(() => undefined);
    await client.end();
  }
});
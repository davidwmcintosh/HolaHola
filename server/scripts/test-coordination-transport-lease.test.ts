import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';

function disposableTarget(): string | undefined {
  const requiredByGate = process.env.COORDINATOR_V2_REQUIRE_DATABASE_TESTS === '1';
  const url = process.env.NEON_SHARED_DATABASE_URL;
  if (!url) {
    if (requiredByGate) {
      throw new Error('COORDINATOR_V2_TEST_DATABASE_URL is required by the migration gate');
    }
    return undefined;
  }
  if (!requiredByGate) return undefined;
  const forbiddenSharedUrl = process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL;
  if (process.env.COORDINATOR_V2_TEST_DATABASE_DISPOSABLE !== '1'
    || !process.env.COORDINATOR_V2_TEST_DATABASE_URL
    || process.env.COORDINATOR_V2_TEST_DATABASE_URL !== url
    || !forbiddenSharedUrl
    || url === forbiddenSharedUrl) {
    throw new Error('Coordinator V2 lease tests require the gate-provided disposable database URL');
  }
  return url;
}

test('durable transport leases CAS, fence, replay, and reconciliation matrix', async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip('run through the Neon migration gate');
    return;
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `${Date.now()}-${randomUUID()}`;
  const id = (kind: string) => `lease-test-${kind}-${suffix}`;
  const hex = (character: string) => character.repeat(64);
  const hostId = id('host');
  const identityId = id('identity');
  const versionId = id('version');
  const grantId = id('grant');
  const sessionId = id('session');
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id, host_key, host_type, display_name, protocol_version, public_key, key_fingerprint,
        capabilities, enrollment_digest, status, created_by)
       VALUES ($1,$2,'test','Lease test host',1,'test-key',$3,ARRAY['poll'],$4,'active','lease-test')`,
      [hostId, id('host-key'), hex('a'), hex('b')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id, policy_key, display_name, status, created_by)
       VALUES ($1,$2,'Lease test policy','active','lease-test')`,
      [identityId, id('policy-key')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id, policy_identity_id, version, canonical_policy, policy_digest, approval_state,
        created_by, approved_by, approved_at)
       VALUES ($1,$2,1,'{}'::jsonb,$3,'approved','lease-test','founder',now())`,
      [versionId, identityId, hex('c')],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1,$2,'operator-test',ARRAY['resume','terminate'],'founder',now()+interval '1 hour',$3,$4)`,
      [grantId, identityId, hex('d'), id('grant-key')],
    );
    await client.query(
      `INSERT INTO coordination_v2_sessions
       (id, policy_version_id, operator_grant_id, operator_actor, task_ref, task_artifact_sha256,
        repository_identity, starting_commit, enrolled_host_id, requested_providers, expires_at,
        attempt_budget, per_provider_budgets, required_validations, completion_criteria, state,
        idempotency_key, session_digest)
       VALUES ($1,$2,$3,'operator-test','1',$4,'repo/test',$5,$6,ARRAY['test'],
               now()+interval '1 hour',5,'{}'::jsonb,ARRAY[]::text[],'{}'::jsonb,'ready',$7,$8)`,
      [sessionId, versionId, grantId, hex('e'), '1'.repeat(40), hostId, id('session-key'), hex('f')],
    );
    await client.query('COMMIT');
    const attemptId = id('attempt');
    await client.query(
      `INSERT INTO coordination_v2_attempts
       (id, session_id, attempt_generation, provider, model, adapter_version,
        session_ordinal, provider_ordinal, state, attempt_digest, deadline_at)
       VALUES ($1,$2,$3,'test-provider','test-model','adapter-1',1,1,
               'waiting_for_host',$4,now()+interval '1 hour')`,
      [attemptId, sessionId, id('attempt-generation'), hex('1')],
    );

    const leases = await import('../services/coordination-transport-lease-service');
    const base = {
      sessionId, enrolledHostId: hostId, actorId: 'operator-test',
      holderInstanceId: 'instance-a', durationMs: 10_000,
    };
    let winner: any;
    await context.test('concurrent acquire has one database winner', async () => {
      const race = await Promise.allSettled([
        leases.acquireCoordinationTransportLease({ ...base, requestKey: id('acquire-a') }),
        leases.acquireCoordinationTransportLease({ ...base, requestKey: id('acquire-b') }),
      ]);
      assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(race.filter((result) => result.status === 'rejected'
        && (result.reason as { code?: string }).code === 'LEASE_CONFLICT').length, 1);
      winner = race.find((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')!.value;
      assert.equal(winner.epoch, 1);
    });
    await context.test('same-epoch renew/release has one idempotent transition', async () => {
      const transitionRace = await Promise.allSettled([
        leases.renewCoordinationTransportLease({
          ...base, leaseId: winner.id, requestKey: id('same-epoch-transition'),
          epoch: 1, durationMs: 10_000,
        }),
        leases.releaseCoordinationTransportLease({
          ...base, leaseId: winner.id, requestKey: id('same-epoch-transition'),
          epoch: 1,
        }),
      ]);
      assert.equal(transitionRace.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(transitionRace.filter((result) => result.status === 'rejected'
        && ['LEASE_REPLAY_CONFLICT', 'LEASE_STALE_EPOCH'].includes(
          (result.reason as { code?: string }).code ?? '',
        )).length, 1);
      const state = await client.query(
        'SELECT state FROM coordination_v2_transport_leases WHERE id=$1', [winner.id],
      );
      if (state.rows[0].state === 'active') {
        await leases.releaseCoordinationTransportLease({
          ...base, leaseId: winner.id, requestKey: id('same-epoch-cleanup'), epoch: 1,
        });
      }
    });

    await assert.rejects(
      leases.renewCoordinationTransportLease({
        ...base, requestKey: id('renew-stale'), epoch: 2,
      }),
      (error: unknown) => (error as { code?: string }).code === 'LEASE_STALE_EPOCH',
    );
    await assert.rejects(
      leases.releaseCoordinationTransportLease({
        ...base, requestKey: id('release-stale'), epoch: 2,
      }),
      (error: unknown) => (error as { code?: string }).code === 'LEASE_STALE_EPOCH',
    );
    const currentWinner = await client.query(
      'SELECT state FROM coordination_v2_transport_leases WHERE id=$1', [winner.id],
    );
    const released = currentWinner.rows[0].state === 'released'
      ? { ...winner, state: 'released' }
      : await leases.releaseCoordinationTransportLease({
        ...base, leaseId: winner.id, requestKey: id('release'), epoch: 1,
      });
    assert.equal(released.state, 'released');

    const reacquired = await leases.acquireCoordinationTransportLease({
      ...base, holderInstanceId: 'instance-b', requestKey: id('reacquire'), durationMs: 20,
    });
    assert.equal(reacquired.epoch, 2);
    assert.notEqual(reacquired.id, released.id);
    assert.equal(reacquired.predecessorLeaseId, released.id);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const expired = await leases.expireCoordinationTransportLease({
      ...base, holderInstanceId: 'instance-b', requestKey: id('expire'), epoch: 2,
    });
    assert.equal(expired.state, 'expired');
    const successor = await leases.takeoverCoordinationTransportLease({
      ...base, holderInstanceId: 'instance-c', requestKey: id('takeover'), durationMs: 10_000,
    });
    assert.equal(successor.epoch, 3);
    assert.notEqual(successor.id, expired.id);
    assert.equal(successor.predecessorLeaseId, expired.id);

    const polled = await leases.pollCoordinationTransportWork({
      ...base, holderInstanceId: 'instance-c', requestKey: id('poll-work'), epoch: 3,
    });
    assert.equal((polled.attempt as { id: string }).id, attemptId);
    const claimed = await leases.claimCoordinationTransportWork({
      ...base, holderInstanceId: 'instance-c', requestKey: id('claim-work'), epoch: 3, attemptId,
    });
    const completed = await leases.resultCoordinationTransportWork({
      ...base, holderInstanceId: 'instance-c', requestKey: id('result-work'), epoch: 3,
      claimId: claimed.claimId, result: { ok: true, output: 'bounded' },
    });
    assert.equal(completed.attemptId, attemptId);
    assert.deepEqual(await leases.resultCoordinationTransportWork({
      ...base, holderInstanceId: 'instance-c', requestKey: id('result-work'), epoch: 3,
      claimId: claimed.claimId, result: { ok: true, output: 'bounded' },
    }), completed);
    const eventCount = await client.query(
      'SELECT count(*)::int AS count FROM coordination_v2_attempt_events WHERE attempt_id=$1', [attemptId],
    );
    assert.equal(eventCount.rows[0].count, 2);
    const attemptRows = await client.query(
      'SELECT id, state FROM coordination_v2_attempts WHERE session_id=$1', [sessionId],
    );
    assert.equal(attemptRows.rowCount, 1);
    assert.equal(attemptRows.rows[0].id, attemptId);
    assert.equal(attemptRows.rows[0].state, 'result_ready');
    const obligationId = id('cleanup');
    await client.query(
      `INSERT INTO coordination_v2_cleanup_obligations
       (id, session_id, kind, terminal_outcome, terminal_reason, idempotency_key)
       VALUES ($1,$2,'release_lease','succeeded','lease-test',$3)`,
      [obligationId, sessionId, id('cleanup-key')],
    );
    const ackInput = {
      ...base, holderInstanceId: 'instance-c', leaseId: successor.id, requestKey: id('ack-work'), epoch: 3,
      obligationId, evidence: { revoked: true },
    };
    const acknowledged = await leases.acknowledgeCoordinationCleanup(ackInput);
    assert.equal(acknowledged.obligationId, obligationId);
    assert.deepEqual(await leases.acknowledgeCoordinationCleanup(ackInput), acknowledged);
    await assert.rejects(
      leases.acknowledgeCoordinationCleanup({ ...ackInput, evidence: { revoked: false } }),
      (error: unknown) => (error as { code?: string }).code === 'LEASE_REPLAY_CONFLICT',
    );
    await leases.releaseCoordinationTransportLease({
      ...base, holderInstanceId: 'instance-c', requestKey: id('release-after-work'), epoch: 3,
    });
    await leases.acquireCoordinationTransportLease({
      ...base, holderInstanceId: 'instance-d', requestKey: id('reacquire-after-work'),
    });
    let takeoverWinner: any;
    await context.test('database-time expiry and concurrent takeover have one successor', async () => {
      await client.query(
        `UPDATE coordination_v2_transport_leases
         SET expires_at = CURRENT_TIMESTAMP - interval '1 second'
         WHERE session_id=$1 AND state='active'`,
        [sessionId],
      );
      const takeoverRace = await Promise.allSettled([
        leases.takeoverCoordinationTransportLease({
          ...base, holderInstanceId: 'instance-e', requestKey: id('takeover-race-a'), durationMs: 10_000,
        }),
        leases.takeoverCoordinationTransportLease({
          ...base, holderInstanceId: 'instance-f', requestKey: id('takeover-race-b'), durationMs: 10_000,
        }),
      ]);
      assert.equal(takeoverRace.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(takeoverRace.filter((result) => result.status === 'rejected'
        && (result.reason as { code?: string }).code === 'LEASE_CONFLICT').length, 1);
      takeoverWinner = takeoverRace.find(
        (result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled',
      )!.value;
      assert.equal(takeoverWinner.epoch, 5);
    });
    await context.test('exact operation replay survives lease advancement', async () => {
      const replayAfterAdvance = await leases.pollCoordinationTransportWork({
        ...base, holderInstanceId: 'instance-c', requestKey: id('poll-work'), epoch: 3,
      });
      assert.deepEqual(replayAfterAdvance, polled);
      assert.deepEqual(await leases.acknowledgeCoordinationCleanup(ackInput), acknowledged);
    });
    await context.test('poll claim result and cleanup acknowledgement persist durably', async () => {
      const persisted = await client.query(
        `SELECT
           (SELECT count(*) FROM coordination_v2_transport_work_claims WHERE id=$1) AS claims,
           (SELECT count(*) FROM coordination_v2_transport_work_results WHERE claim_id=$1) AS results,
           (SELECT count(*) FROM coordination_v2_cleanup_acknowledgements a
            JOIN coordination_v2_cleanup_obligations o ON o.id=a.obligation_id
            WHERE o.idempotency_key=$2) AS acknowledgements`,
        [claimed.claimId, id('cleanup-key')],
      );
      assert.equal(Number(persisted.rows[0].claims), 1);
      assert.equal(Number(persisted.rows[0].results), 1);
      assert.equal(Number(persisted.rows[0].acknowledgements), 1);
      const attemptsAfterReacquire = await client.query(
        'SELECT count(*)::int AS count, min(id) AS id FROM coordination_v2_attempts WHERE session_id=$1',
        [sessionId],
      );
      assert.equal(attemptsAfterReacquire.rows[0].count, 1);
      assert.equal(attemptsAfterReacquire.rows[0].id, attemptId);
    });
    const beforeStaleMutation = await client.query(
      `SELECT
         (SELECT count(*) FROM coordination_v2_transport_work_claims WHERE session_id=$1) AS claims,
         (SELECT count(*) FROM coordination_v2_transport_work_results WHERE session_id=$1) AS results,
         (SELECT count(*) FROM coordination_v2_attempt_events WHERE attempt_id=$2) AS events,
         (SELECT count(*) FROM coordination_v2_cleanup_acknowledgements WHERE session_id=$1) AS acknowledgements`,
      [sessionId, attemptId],
    );
    await context.test('stale epoch mutates no work, result, event, or ack rows', async () => {
      await assert.rejects(
        leases.claimCoordinationTransportWork({
          ...base, holderInstanceId: 'instance-a', requestKey: id('stale-claim'),
          epoch: 1, attemptId,
        }),
        (error: unknown) => (error as { code?: string }).code === 'LEASE_STALE_EPOCH',
      );
      await assert.rejects(
        leases.resultCoordinationTransportWork({
          ...base, holderInstanceId: 'instance-a', requestKey: id('stale-result'),
          epoch: 1, claimId: claimed.claimId, result: { stale: true },
        }),
        (error: unknown) => (error as { code?: string }).code === 'LEASE_STALE_EPOCH',
      );
      await assert.rejects(
        leases.acknowledgeCoordinationCleanup({
          ...ackInput, holderInstanceId: 'instance-a', requestKey: id('stale-ack'), epoch: 1,
        }),
        (error: unknown) => (error as { code?: string }).code === 'LEASE_STALE_EPOCH',
      );
      const afterStaleMutation = await client.query(
        `SELECT
           (SELECT count(*) FROM coordination_v2_transport_work_claims WHERE session_id=$1) AS claims,
           (SELECT count(*) FROM coordination_v2_transport_work_results WHERE session_id=$1) AS results,
           (SELECT count(*) FROM coordination_v2_attempt_events WHERE attempt_id=$2) AS events,
           (SELECT count(*) FROM coordination_v2_cleanup_acknowledgements WHERE session_id=$1) AS acknowledgements`,
        [sessionId, attemptId],
      );
      assert.deepEqual(afterStaleMutation.rows[0], beforeStaleMutation.rows[0]);
    });

    await assert.rejects(
      leases.validateCurrentCoordinationTransportLease({
        ...base, holderInstanceId: 'instance-a', requestKey: id('poll-stale'),
        epoch: 1, operation: 'poll',
      }),
      (error: unknown) => (error as { code?: string }).code === 'LEASE_STALE_EPOCH',
    );
    const fenced = await leases.validateCurrentCoordinationTransportLease({
      ...base, holderInstanceId: takeoverWinner.holderInstanceId, leaseId: takeoverWinner.id,
      requestKey: id('poll-current'), epoch: takeoverWinner.epoch, operation: 'poll',
    });
    assert.equal(fenced.accepted, true);
    const replay = await leases.validateCurrentCoordinationTransportLease({
      ...base, holderInstanceId: takeoverWinner.holderInstanceId, leaseId: takeoverWinner.id,
      requestKey: id('poll-current'), epoch: takeoverWinner.epoch, operation: 'poll',
    });
    assert.deepEqual(replay, fenced);
    await assert.rejects(
      leases.validateCurrentCoordinationTransportLease({
        ...base, holderInstanceId: 'instance-d', requestKey: id('poll-current'),
        epoch: 4, operation: 'claim',
      }),
      (error: unknown) => (error as { code?: string }).code === 'LEASE_REPLAY_CONFLICT',
    );

    const evidence = { mutationObserved: false, note: 'transport interrupted' };
    const reconciliation = await leases.submitStaleCoordinationLeaseReconciliation({
      ...base, holderInstanceId: 'instance-a', requestKey: id('reconcile'),
      epoch: 1, evidence,
    });
    assert.equal(reconciliation.stored, true);
    const reconciliationReplay = await leases.submitStaleCoordinationLeaseReconciliation({
      ...base, holderInstanceId: 'instance-a', requestKey: id('reconcile'),
      epoch: 1, evidence,
    });
    assert.deepEqual(reconciliationReplay, reconciliation);
    await assert.rejects(
      leases.submitStaleCoordinationLeaseReconciliation({
        ...base, holderInstanceId: 'instance-a', requestKey: id('reconcile'),
        epoch: 1, evidence: { mutationObserved: true },
      }),
      (error: unknown) => (error as { code?: string }).code === 'LEASE_REPLAY_CONFLICT',
    );
  } finally {
    await client.query('BEGIN').catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_cleanup_acknowledgements WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_cleanup_obligations WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_work_results WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_work_claims WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_attempt_events WHERE attempt_id IN (SELECT id FROM coordination_v2_attempts WHERE session_id=$1)', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_attempts WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_lease_reconciliations WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_lease_receipts WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_leases WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_sessions WHERE id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_operator_grants WHERE id=$1', [grantId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_policy_versions WHERE id=$1', [versionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_policy_identities WHERE id=$1', [identityId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_host_enrollments WHERE id=$1', [hostId]).catch(() => undefined);
    await client.query('COMMIT').catch(() => undefined);
    await client.end();
  }
});
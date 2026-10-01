import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import pg from 'pg';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

// reapStaleCoordinationSession/sweepStaleCoordinationSessions run against the
// shared pg pool from server/db.ts (a separate connection from this file's
// own raw pg.Client fixture setup/teardown below). That pool's idle timer and
// socket are only unref'd when allowExitOnIdle is set, which server/db.ts
// does not set -- leaving it open holds the process alive for the full idle
// timeout after every assertion has already finished. See
// .agents/memory/pg-pool-idle-timeout-ci-hang.md.
after(async () => {
  const { closeDbConnections } = await import('../db');
  await closeDbConnections();
});

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
    throw new Error('Coordinator V2 lifecycle reaper tests refuse a shared/unverified database');
  }
  return url;
}

test('lifecycle reaper terminalizes abandoned sessions, including ones with a revoked grant, and leaves live ones alone', async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip('requires a verified disposable PostgreSQL URL');
    return;
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `${Date.now()}-${randomUUID()}`;
  const digest = (kind: string) => createHash('sha256').update(`${suffix}:${kind}`).digest('hex');
  const hostId = `reaper-test-host-${suffix}`;
  const identityId = `reaper-test-identity-${suffix}`;
  const versionId = `reaper-test-version-${suffix}`;

  // Four session fixtures exercising the four outcomes the reaper must
  // distinguish: past-expiry, stale-but-not-expired, still-live, and
  // already-terminal. Each gets its own operator grant so the "grant already
  // revoked" scenario (the real shape found in the shared database left over
  // from task #1642's interrupted demo runs) can be isolated to just one row.
  const scenario = (kind: string) => ({
    grantId: `reaper-test-grant-${kind}-${suffix}`,
    sessionId: `reaper-test-session-${kind}-${suffix}`,
    leaseId: `reaper-test-lease-${kind}-${suffix}`,
  });
  const expiredGrantRevoked = scenario('expired-grant-revoked');
  const staleGrantLive = scenario('stale-grant-live');
  const freshLive = scenario('fresh-live');
  const alreadyTerminal = scenario('already-terminal');
  // Reproduces the exact gap a prior review round caught: a session whose
  // OWN updated_at is stale can still have a live attempt or host underneath
  // it. These two must NOT be reaped even though their session-level
  // timestamp alone looks idle past the threshold.
  const staleSessionRecentAttempt = scenario('stale-session-recent-attempt');
  const staleSessionRecentLeaseReceipt = scenario('stale-session-recent-lease-receipt');
  const allScenarios = [
    expiredGrantRevoked, staleGrantLive, freshLive, alreadyTerminal,
    staleSessionRecentAttempt, staleSessionRecentLeaseReceipt,
  ];
  const allSessionIds = allScenarios.map((s) => s.sessionId);
  const allGrantIds = allScenarios.map((s) => s.grantId);
  const allLeaseIds = allScenarios.map((s) => s.leaseId);

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id, host_key, host_type, display_name, protocol_version, public_key, key_fingerprint,
         capabilities, enrollment_digest, enrollment_request_key, status, created_by)
        VALUES ($1,$2,'test','Reaper test host',1,'test-key',$3,ARRAY['poll'],$4,$5,'active','reaper-test')`,
      [hostId, `reaper-host-key-${suffix}`, digest('host-key'), digest('host-enrollment'), `reaper-enrollment-request-${suffix}`],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id, policy_key, display_name, status, created_by)
       VALUES ($1,$2,'Reaper test policy','active','reaper-test')`,
      [identityId, `reaper-policy-key-${suffix}`],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id, policy_identity_id, version, canonical_policy, policy_digest, approval_state,
        created_by, approved_by, approved_at)
       VALUES ($1,$2,1,'{}'::jsonb,$3,'approved','reaper-test','founder',now())`,
      [versionId, identityId, digest('policy')],
    );

    // expiredGrantRevoked: past expires_at, and its operator grant is already
    // revoked -- reproducing the exact shape found stuck in the shared
    // database. The ordinary transitionCoordinationSession path cannot touch
    // this row (authorizeCoordinationLifecycleInTransaction denies any
    // action once grant.revokedAt is set); the reaper must not depend on it.
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, revoked_at, grant_digest, request_key)
       VALUES ($1,$2,'reaper-test-operator',ARRAY['launch','resume','terminate'],'founder',
               now()+interval '1 hour', now(), $3,$4)`,
      [expiredGrantRevoked.grantId, identityId, digest('grant-expired-revoked'), `reaper-grant-key-expired-revoked-${suffix}`],
    );
    // staleGrantLive: not past expires_at, but idle well beyond the staleness
    // threshold, with a still-valid (unrevoked) grant -- proving the reaper
    // does not require a broken grant to act.
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1,$2,'reaper-test-operator',ARRAY['launch','resume','terminate'],'founder',
               now()+interval '1 hour', $3,$4)`,
      [staleGrantLive.grantId, identityId, digest('grant-stale-live'), `reaper-grant-key-stale-live-${suffix}`],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1,$2,'reaper-test-operator',ARRAY['launch','resume','terminate'],'founder',
               now()+interval '1 hour', $3,$4)`,
      [freshLive.grantId, identityId, digest('grant-fresh-live'), `reaper-grant-key-fresh-live-${suffix}`],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1,$2,'reaper-test-operator',ARRAY['launch','resume','terminate'],'founder',
               now()+interval '1 hour', $3,$4)`,
      [alreadyTerminal.grantId, identityId, digest('grant-already-terminal'), `reaper-grant-key-already-terminal-${suffix}`],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1,$2,'reaper-test-operator',ARRAY['launch','resume','terminate'],'founder',
               now()+interval '1 hour', $3,$4)`,
      [staleSessionRecentAttempt.grantId, identityId, digest('grant-stale-recent-attempt'), `reaper-grant-key-stale-recent-attempt-${suffix}`],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1,$2,'reaper-test-operator',ARRAY['launch','resume','terminate'],'founder',
               now()+interval '1 hour', $3,$4)`,
      [staleSessionRecentLeaseReceipt.grantId, identityId, digest('grant-stale-recent-receipt'), `reaper-grant-key-stale-recent-receipt-${suffix}`],
    );

    const insertSession = async (
      sessionId: string, grantId: string, state: string,
      expiresAtSql: string, updatedAtSql: string, terminalExtra?: { terminalReason: string; terminalAtSql: string },
    ) => {
      await client.query(
        `INSERT INTO coordination_v2_sessions
         (id, policy_version_id, operator_grant_id, operator_actor, task_ref, task_artifact_sha256,
          repository_identity, starting_commit, enrolled_host_id, requested_providers, expires_at,
          attempt_budget, per_provider_budgets, required_validations, completion_criteria, state,
          terminal_reason, terminal_at, idempotency_key, session_digest, created_at, updated_at)
         VALUES ($1,$2,$3,'reaper-test-operator','1',$4,'repo/test',$5,$6,ARRAY['test'],${expiresAtSql},
                 5,'{}'::jsonb,ARRAY[]::text[],$7::jsonb,$8,$9,${terminalExtra ? terminalExtra.terminalAtSql : 'NULL'},
                 $10,$11,now()-interval '4 hours',${updatedAtSql})`,
        [
          sessionId, versionId, grantId, digest(`artifact-${sessionId}`), '1'.repeat(40), hostId,
          JSON.stringify({ requiredCompletionEvidence: ['digest'] }), state, terminalExtra?.terminalReason ?? null,
          `reaper-session-key-${sessionId}`, digest(`session-${sessionId}`),
        ],
      );
    };
    await insertSession(expiredGrantRevoked.sessionId, expiredGrantRevoked.grantId, 'running', `now()-interval '1 hour'`, `now()-interval '1 hour'`);
    await insertSession(staleGrantLive.sessionId, staleGrantLive.grantId, 'waiting_for_host', `now()+interval '1 hour'`, `now()-interval '45 minutes'`);
    await insertSession(freshLive.sessionId, freshLive.grantId, 'running', `now()+interval '1 hour'`, `now()-interval '1 minute'`);
    await insertSession(
      alreadyTerminal.sessionId, alreadyTerminal.grantId, 'expired', `now()-interval '3 hours'`, `now()-interval '3 hours'`,
      { terminalReason: 'session expired', terminalAtSql: `now()-interval '3 hours'` },
    );
    // Session-level updated_at is just as stale as staleGrantLive's, but a
    // subordinate row carries recent activity the sweep must not ignore.
    await insertSession(staleSessionRecentAttempt.sessionId, staleSessionRecentAttempt.grantId, 'running', `now()+interval '1 hour'`, `now()-interval '45 minutes'`);
    await insertSession(staleSessionRecentLeaseReceipt.sessionId, staleSessionRecentLeaseReceipt.grantId, 'waiting_for_host', `now()+interval '1 hour'`, `now()-interval '45 minutes'`);

    for (const { sessionId, leaseId } of [expiredGrantRevoked, staleGrantLive, freshLive, staleSessionRecentLeaseReceipt]) {
      await client.query(
        `INSERT INTO coordination_v2_transport_leases
         (id, session_id, enrolled_host_id, holder_instance_id, epoch, state, issued_at, expires_at)
         VALUES ($1,$2,$3,'reaper-holder',1,'active',now(),now()+interval '1 hour')`,
        [leaseId, sessionId, hostId],
      );
    }

    // staleSessionRecentAttempt: the attempt itself transitioned a minute ago
    // (coordinationV2Attempts.updatedAt), even though the parent session row
    // has not been touched in 45 minutes.
    await client.query(
      `INSERT INTO coordination_v2_attempts
       (id, session_id, attempt_generation, provider, model, adapter_version, session_ordinal, provider_ordinal,
        state, attempt_digest, deadline_at, created_at, updated_at)
       VALUES ($1,$2,$3,'gemini','gemini-test-model','v1',1,1,'provider_active',$4,
               now()+interval '1 hour', now()-interval '50 minutes', now()-interval '1 minute')`,
      [randomUUID(), staleSessionRecentAttempt.sessionId, `reaper-attempt-gen-${suffix}`, digest('recent-attempt')],
    );
    // staleSessionRecentLeaseReceipt: no attempt row at all, but the host
    // exercised its transport lease (a poll) a minute ago, which only shows
    // up as a coordinationV2TransportLeaseReceipts row -- the lease's own
    // issued_at/expires_at above do not change on poll.
    await client.query(
      `INSERT INTO coordination_v2_transport_lease_receipts
       (id, session_id, request_key, operation, actor_id, enrolled_host_id, command_digest, response_snapshot, created_at)
       VALUES ($1,$2,$3,'poll','reaper-holder',$4,$5,'{}'::jsonb,now()-interval '1 minute')`,
      [randomUUID(), staleSessionRecentLeaseReceipt.sessionId, `reaper-recent-receipt-${suffix}`, hostId, digest('recent-receipt')],
    );
    await client.query('COMMIT');

    const { reapStaleCoordinationSession } = await import('../services/coordination-session-service');
    const { sweepStaleCoordinationSessions } = await import('../services/coordination-lifecycle-reaper-service');
    const staleThresholdMs = 30 * 60 * 1_000;

    // Direct-call assertions: exercise reapStaleCoordinationSession's own
    // classification of each scenario before running the batch sweep.
    const freshOutcome = await reapStaleCoordinationSession({ sessionId: freshLive.sessionId, staleThresholdMs });
    assert.deepEqual(freshOutcome, { reaped: false, reason: 'not_stale' });
    const terminalOutcome = await reapStaleCoordinationSession({ sessionId: alreadyTerminal.sessionId, staleThresholdMs });
    assert.deepEqual(terminalOutcome, { reaped: false, reason: 'already_terminal' });

    // The fix this test exists to lock in: a session-level updated_at that
    // looks idle must not win over a subordinate attempt or lease signal
    // that is actually recent.
    const recentAttemptOutcome = await reapStaleCoordinationSession({ sessionId: staleSessionRecentAttempt.sessionId, staleThresholdMs });
    assert.deepEqual(recentAttemptOutcome, { reaped: false, reason: 'not_stale' });
    const recentReceiptOutcome = await reapStaleCoordinationSession({ sessionId: staleSessionRecentLeaseReceipt.sessionId, staleThresholdMs });
    assert.deepEqual(recentReceiptOutcome, { reaped: false, reason: 'not_stale' });

    // The ordinary actor-authorized path cannot touch the revoked-grant
    // session at all -- this is the real gap task #1646 exists to close.
    const { transitionCoordinationSession } = await import('../services/coordination-session-service');
    await assert.rejects(
      transitionCoordinationSession({
        sessionId: expiredGrantRevoked.sessionId, requestKey: `reaper-test-normal-path-${suffix}`,
        actorId: 'reaper-test-operator', command: { type: 'expire' },
      }),
      (error: unknown) => (error as { code?: string }).code === 'SESSION_GRANT_INVALID',
    );

    // The batch sweep intentionally scans the whole database, so its aggregate
    // reaped count also includes unrelated eligible sessions from a snapshot or
    // earlier suites on the same disposable branch. Assert this test's own
    // fixtures below instead.
    await sweepStaleCoordinationSessions(100, staleThresholdMs);

    const afterSweep = await client.query(
      `SELECT s.id, s.state, s.terminal_reason,
              (SELECT count(*)::int FROM coordination_v2_cleanup_obligations o WHERE o.session_id = s.id) AS obligations,
              (SELECT count(*)::int FROM coordination_v2_transport_leases l WHERE l.session_id = s.id AND l.state = 'active') AS active_leases
       FROM coordination_v2_sessions s WHERE s.id = ANY($1::text[]) ORDER BY s.id`,
      [allSessionIds],
    );
    const byId = new Map(afterSweep.rows.map((row) => [row.id, row]));
    assert.equal(byId.size, allSessionIds.length, 'every owned session fixture must remain queryable after the sweep');

    const expiredRow = byId.get(expiredGrantRevoked.sessionId);
    assert.ok(expiredRow);
    assert.equal(expiredRow.state, 'expired');
    assert.equal(expiredRow.terminal_reason, 'session expired');
    assert.equal(expiredRow.obligations, 4);
    assert.equal(expiredRow.active_leases, 0);

    const staleRow = byId.get(staleGrantLive.sessionId);
    assert.ok(staleRow);
    assert.equal(staleRow.state, 'failed');
    assert.match(staleRow.terminal_reason, /reaped after \d+m with no forward progress/);
    assert.equal(staleRow.obligations, 4);
    assert.equal(staleRow.active_leases, 0);

    const freshRow = byId.get(freshLive.sessionId);
    assert.ok(freshRow);
    assert.equal(freshRow.state, 'running');
    assert.equal(freshRow.terminal_reason, null);
    assert.equal(freshRow.obligations, 0);
    assert.equal(freshRow.active_leases, 1);

    const terminalRow = byId.get(alreadyTerminal.sessionId);
    assert.ok(terminalRow);
    assert.equal(terminalRow.state, 'expired');
    assert.equal(terminalRow.terminal_reason, 'session expired');
    assert.equal(terminalRow.obligations, 0);
    assert.equal(terminalRow.active_leases, 0);

    // Both stale-session-but-active-underneath rows must survive untouched:
    // no state change, no cleanup obligations created.
    const recentAttemptRow = byId.get(staleSessionRecentAttempt.sessionId);
    assert.ok(recentAttemptRow);
    assert.equal(recentAttemptRow.state, 'running');
    assert.equal(recentAttemptRow.terminal_reason, null);
    assert.equal(recentAttemptRow.obligations, 0);
    assert.equal(recentAttemptRow.active_leases, 0);

    const recentReceiptRow = byId.get(staleSessionRecentLeaseReceipt.sessionId);
    assert.ok(recentReceiptRow);
    assert.equal(recentReceiptRow.state, 'waiting_for_host');
    assert.equal(recentReceiptRow.terminal_reason, null);
    assert.equal(recentReceiptRow.obligations, 0);
    assert.equal(recentReceiptRow.active_leases, 1);

    // Re-running the global sweep must not change any owned fixture outcome
    // or duplicate its cleanup obligations, regardless of unrelated sessions.
    await sweepStaleCoordinationSessions(100, staleThresholdMs);
    const afterSecondSweep = await client.query(
      `SELECT s.id, s.state, s.terminal_reason,
              (SELECT count(*)::int FROM coordination_v2_cleanup_obligations o WHERE o.session_id = s.id) AS obligations,
              (SELECT count(*)::int FROM coordination_v2_transport_leases l WHERE l.session_id = s.id AND l.state = 'active') AS active_leases
       FROM coordination_v2_sessions s WHERE s.id = ANY($1::text[]) ORDER BY s.id`,
      [allSessionIds],
    );
    assert.deepEqual(afterSecondSweep.rows, afterSweep.rows, 'a repeated global sweep must leave all owned session invariants unchanged');
  } finally {
    // Deliberately NOT wrapped in a single BEGIN/COMMIT: coordination_v2_session_events
    // is evidence-immutable (a DB trigger rejects any DELETE against it -- see
    // reject_coordination_v2_evidence_mutation()), and every scenario that
    // actually gets reaped writes at least one such row via commitSessionTransition.
    // A shared transaction aborts on that failed DELETE, which silently no-ops
    // every subsequent statement in the same transaction even though each has
    // its own .catch() -- Postgres ignores all further commands until the
    // transaction ends, so sessions/grants/policy rows were never actually
    // removed even though cleanup "succeeded". Each statement below auto-commits
    // independently instead, so the one expected failure cannot cascade.
    //
    // The two reaped session ids (expiredGrantRevoked, staleGrantLive) can
    // never have their coordination_v2_sessions row deleted, by the same
    // evidence-immutability chain: their session_events rows are permanent,
    // and coordination_v2_sessions/coordination_v2_operator_grants are both
    // referenced by onDelete-restrict FKs that trace back to them. The
    // sessions and operator_grants deletes below MUST split those two ids
    // into their own statement, separate from the other four (freshLive,
    // alreadyTerminal, staleSessionRecentAttempt, staleSessionRecentLeaseReceipt).
    // A single bundled `id = ANY(...)` statement fails atomically the instant
    // ANY one of its rows is blocked -- leaving ALL SIX session rows in place,
    // not just the two that must stay. That collateral damage is not just an
    // untidy leftover: staleSessionRecentAttempt/staleSessionRecentLeaseReceipt
    // lose their protecting attempt/receipt rows a few statements below
    // (those child tables have no blocking trigger), while their own session
    // row survives at its original stale updated_at with no more protection
    // underneath -- indistinguishable from a genuinely abandoned session. A
    // later sweep in this same run (e.g. the next test in this file, against
    // the same disposable database) then reaps them for real, inflating that
    // sweep's reaped count. Deleting the other four sessions/grants for real
    // here removes that risk instead of merely tolerating it.
    const reapedSessionIds = [expiredGrantRevoked.sessionId, staleGrantLive.sessionId];
    const otherSessionIds = allSessionIds.filter((id) => !reapedSessionIds.includes(id));
    const reapedGrantIds = [expiredGrantRevoked.grantId, staleGrantLive.grantId];
    const otherGrantIds = allGrantIds.filter((id) => !reapedGrantIds.includes(id));
    await client.query('DELETE FROM coordination_v2_cleanup_acknowledgements WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_cleanup_obligations WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    // Must precede the sessions delete below: this table's session_id FK is
    // onDelete restrict, and this test is the only fixture in this file that
    // inserts directly into it (staleSessionRecentLeaseReceipt).
    await client.query('DELETE FROM coordination_v2_transport_lease_receipts WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_leases WHERE id = ANY($1::text[])', [allLeaseIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_session_events WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_attempts WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_sessions WHERE id = ANY($1::text[])', [reapedSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_sessions WHERE id = ANY($1::text[])', [otherSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_operator_grants WHERE id = ANY($1::text[])', [reapedGrantIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_operator_grants WHERE id = ANY($1::text[])', [otherGrantIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_policy_versions WHERE id=$1', [versionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_policy_identities WHERE id=$1', [identityId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_host_enrollments WHERE id=$1', [hostId]).catch(() => undefined);
    await client.end();
  }
});

test('lifecycle reaper sweep is not starved by a batch of live-but-stale-row sessions ahead of a genuinely abandoned one', async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip('requires a verified disposable PostgreSQL URL');
    return;
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `${Date.now()}-${randomUUID()}`;
  const digest = (kind: string) => createHash('sha256').update(`pagination:${suffix}:${kind}`).digest('hex');
  const hostId = `reaper-pagination-host-${suffix}`;
  const identityId = `reaper-pagination-identity-${suffix}`;
  const versionId = `reaper-pagination-version-${suffix}`;

  // Reproduces the exact starvation gap a prior review round caught: a batch
  // of sessions whose own session-row updated_at is stale but which have a
  // live attempt underneath must not crowd a genuinely abandoned session out
  // of the sweep's LIMIT-bounded candidate page. Three decoys -- the same
  // count as the sweep's own limit below -- have a session-row updated_at
  // even older than the target's, so a naive "ORDER BY session.updated_at"
  // scan (filtered the same naive way) would select only the three decoys
  // and never reach the target, no matter how many times the sweep ran.
  const decoyCount = 3;
  const decoys = Array.from({ length: decoyCount }, (_, i) => ({
    grantId: `reaper-pagination-decoy-grant-${i}-${suffix}`,
    sessionId: `reaper-pagination-decoy-session-${i}-${suffix}`,
  }));
  const target = {
    grantId: `reaper-pagination-target-grant-${suffix}`,
    sessionId: `reaper-pagination-target-session-${suffix}`,
  };
  const allSessionIds = [...decoys.map((d) => d.sessionId), target.sessionId];
  const allGrantIds = [...decoys.map((d) => d.grantId), target.grantId];

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id, host_key, host_type, display_name, protocol_version, public_key, key_fingerprint,
         capabilities, enrollment_digest, enrollment_request_key, status, created_by)
        VALUES ($1,$2,'test','Reaper pagination test host',1,'test-key',$3,ARRAY['poll'],$4,$5,'active','reaper-test')`,
      [hostId, `reaper-pagination-host-key-${suffix}`, digest('host-key'), digest('host-enrollment'), `reaper-pagination-enrollment-request-${suffix}`],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id, policy_key, display_name, status, created_by)
       VALUES ($1,$2,'Reaper pagination test policy','active','reaper-test')`,
      [identityId, `reaper-pagination-policy-key-${suffix}`],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id, policy_identity_id, version, canonical_policy, policy_digest, approval_state,
        created_by, approved_by, approved_at)
       VALUES ($1,$2,1,'{}'::jsonb,$3,'approved','reaper-test','founder',now())`,
      [versionId, identityId, digest('policy')],
    );

    const insertGrant = async (grantId: string) => {
      await client.query(
        `INSERT INTO coordination_v2_operator_grants
         (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
         VALUES ($1,$2,'reaper-test-operator',ARRAY['launch','resume','terminate'],'founder',
                 now()+interval '1 hour', $3,$4)`,
        [grantId, identityId, digest(`grant-${grantId}`), `reaper-pagination-grant-key-${grantId}`],
      );
    };
    const insertSession = async (sessionId: string, grantId: string, updatedAtSql: string) => {
      await client.query(
        `INSERT INTO coordination_v2_sessions
         (id, policy_version_id, operator_grant_id, operator_actor, task_ref, task_artifact_sha256,
          repository_identity, starting_commit, enrolled_host_id, requested_providers, expires_at,
          attempt_budget, per_provider_budgets, required_validations, completion_criteria, state,
          idempotency_key, session_digest, created_at, updated_at)
         VALUES ($1,$2,$3,'reaper-test-operator','1',$4,'repo/test',$5,$6,ARRAY['test'],now()+interval '1 hour',
                 5,'{}'::jsonb,ARRAY[]::text[],$7::jsonb,'running',
                 $8,$9,now()-interval '4 hours',${updatedAtSql})`,
        [
          sessionId, versionId, grantId, digest(`artifact-${sessionId}`), '1'.repeat(40), hostId,
          JSON.stringify({ requiredCompletionEvidence: ['digest'] }),
          `reaper-pagination-session-key-${sessionId}`, digest(`session-${sessionId}`),
        ],
      );
    };

    for (const decoy of decoys) {
      // eslint-disable-next-line no-await-in-loop -- fixture setup, not a hot path
      await insertGrant(decoy.grantId);
      // Decoy session rows are staler (further back) than the target's own
      // row, so a naive ORDER BY session.updated_at ASC would rank every
      // decoy ahead of the target.
      // eslint-disable-next-line no-await-in-loop -- fixture setup, not a hot path
      await insertSession(decoy.sessionId, decoy.grantId, `now()-interval '50 minutes'`);
      // eslint-disable-next-line no-await-in-loop -- fixture setup, not a hot path
      await client.query(
        `INSERT INTO coordination_v2_attempts
         (id, session_id, attempt_generation, provider, model, adapter_version, session_ordinal, provider_ordinal,
          state, attempt_digest, deadline_at, created_at, updated_at)
         VALUES ($1,$2,$3,'gemini','gemini-test-model','v1',1,1,'provider_active',$4,
                 now()+interval '1 hour', now()-interval '55 minutes', now()-interval '1 minute')`,
        [randomUUID(), decoy.sessionId, `reaper-pagination-attempt-gen-${decoy.sessionId}`, digest(`attempt-${decoy.sessionId}`)],
      );
    }
    await insertGrant(target.grantId);
    // The target's own row is fresher than every decoy's, but still well
    // past the staleness threshold, and has no attempt/lease-receipt activity
    // underneath at all -- genuinely abandoned.
    await insertSession(target.sessionId, target.grantId, `now()-interval '45 minutes'`);
    await client.query('COMMIT');

    const { sweepStaleCoordinationSessions } = await import('../services/coordination-lifecycle-reaper-service');
    const staleThresholdMs = 30 * 60 * 1_000;

    // A batch limit exactly equal to the decoy count: under the bug this
    // regression exists to catch, the decoys alone would fill this page
    // (sorted first by raw session.updated_at) and the target would never be
    // selected, no matter how many sweeps ran.
    await sweepStaleCoordinationSessions(decoyCount, staleThresholdMs);

    const after = await client.query(
      `SELECT s.id, s.state, s.terminal_reason,
              (SELECT count(*)::int FROM coordination_v2_cleanup_obligations o WHERE o.session_id = s.id) AS obligations,
              (SELECT count(*)::int FROM coordination_v2_transport_leases l WHERE l.session_id = s.id AND l.state = 'active') AS active_leases
       FROM coordination_v2_sessions s WHERE s.id = ANY($1::text[])`,
      [allSessionIds],
    );
    const byId = new Map(after.rows.map((row) => [row.id as string, row]));
    assert.equal(byId.size, allSessionIds.length, 'every owned pagination fixture must remain queryable after the sweep');
    const targetRow = byId.get(target.sessionId);
    assert.ok(targetRow);
    assert.equal(targetRow.state, 'failed', 'the genuinely abandoned target must be reaped despite sorting behind every decoy by raw session.updated_at');
    assert.match(targetRow.terminal_reason, /reaped after \d+m with no forward progress/);
    assert.equal(targetRow.obligations, 4);
    assert.equal(targetRow.active_leases, 0);
    for (const decoy of decoys) {
      const decoyRow = byId.get(decoy.sessionId);
      assert.ok(decoyRow);
      assert.equal(decoyRow.state, 'running', `decoy ${decoy.sessionId} has live attempt activity underneath and must be left alone`);
      assert.equal(decoyRow.terminal_reason, null);
      assert.equal(decoyRow.obligations, 0);
      assert.equal(decoyRow.active_leases, 0);
    }
  } finally {
    // See the note in the previous test's finally block: no shared BEGIN/COMMIT
    // here either, for the same reason (the session_events delete always fails
    // against the evidence-immutability trigger and must not abort the rest).
    //
    // Same split as the previous test's finally block, for the same reason:
    // target.sessionId's row can never be deleted once it is reaped (its
    // session_events row is permanent), and bundling it into one DELETE with
    // the decoy ids would fail the whole statement, leaving every decoy
    // session row in place too, with no live-attempt row left protecting it
    // (the plain attempts delete below has already removed those) -- exactly
    // the leftover-abandoned-looking-session shape a later test's sweep in
    // this same run would pick up.
    const reapedSessionIds = [target.sessionId];
    const otherSessionIds = decoys.map((d) => d.sessionId);
    const reapedGrantIds = [target.grantId];
    const otherGrantIds = decoys.map((d) => d.grantId);
    await client.query('DELETE FROM coordination_v2_cleanup_acknowledgements WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_cleanup_obligations WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_lease_receipts WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_leases WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_session_events WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_attempts WHERE session_id = ANY($1::text[])', [allSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_sessions WHERE id = ANY($1::text[])', [reapedSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_sessions WHERE id = ANY($1::text[])', [otherSessionIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_operator_grants WHERE id = ANY($1::text[])', [reapedGrantIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_operator_grants WHERE id = ANY($1::text[])', [otherGrantIds]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_policy_versions WHERE id=$1', [versionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_policy_identities WHERE id=$1', [identityId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_host_enrollments WHERE id=$1', [hostId]).catch(() => undefined);
    await client.end();
  }
});

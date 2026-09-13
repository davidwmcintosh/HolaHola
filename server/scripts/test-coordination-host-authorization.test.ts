import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import express, { type RequestHandler } from 'express';
import http from 'node:http';
import pg from 'pg';
import test from 'node:test';
import { canonicalJson } from '../services/coordination-runtime';
import { createHostEnvelope, validateHostEnvelope, type HostBinding } from '../services/coordination-host-protocol';
import { CoordinationHostFake } from './coordination-host-fake';
import { acquireCoordinationTransportLease } from '../services/coordination-transport-lease-service';
import { registerCoordinationHostRoutes } from '../routes/coordination-host-routes';

const binding: HostBinding = {
  policyVersionId: 'policy-1', sessionId: 'session-1', attemptId: 'attempt-1',
  enrolledHostId: 'host-1', transportLeaseId: 'lease-1', leaseEpoch: 1,
  holderInstanceId: 'holder-1', operation: 'fixed-target', operationDigest: 'a'.repeat(64),
};
const ids = {
  requestId: 'claim-1', correlationId: 'session-1',
  issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-01-01T00:01:00.000Z',
};

test('fake host executes only a declared operation and preserves binding', async () => {
  const claim = createHostEnvelope('operation_claim', { binding }, ids);
  const host = new CoordinationHostFake({
    now: () => Date.parse('2026-01-01T00:00:01.000Z'),
    adapter: {
      execute: async (request) => {
        assert.equal(request.operation, 'fixed-target');
        assert.equal(request.operationDigest, binding.operationDigest);
        return { ok: true, output: 'bounded' };
      },
    },
  });
  const result = await host.execute(claim);
  assert.equal(result.kind, 'structured_result');
  assert.deepEqual((result.payload as any).binding, binding);
  assert.equal(validateHostEnvelope(result, { now: Date.parse('2026-01-01T00:00:01.000Z') }).kind, 'structured_result');
});

test('operation binding changes are not accepted as host authority', () => {
  const claim = createHostEnvelope('operation_claim', { binding }, ids);
  const altered = {
    ...claim,
    payload: { binding: { ...binding, operation: 'different-operation' } },
  };
  altered.digest = createHash('sha256').update(canonicalJson({
    protocolVersion: altered.protocolVersion, kind: altered.kind,
    requestId: altered.requestId, correlationId: altered.correlationId,
    issuedAt: altered.issuedAt, expiresAt: altered.expiresAt, payload: altered.payload,
  }), 'utf8').digest('hex');
  assert.equal((altered.payload.binding as any).operation, 'different-operation');
  assert.notEqual(altered.digest, claim.digest);
});

function disposableTarget(): string | undefined {
  const url = process.env.NEON_SHARED_DATABASE_URL;
  if (!url) return undefined;
  if (process.env.COORDINATOR_V2_REQUIRE_DATABASE_TESTS !== '1') return undefined;
  if (process.env.COORDINATOR_V2_TEST_DATABASE_DISPOSABLE !== '1'
    || process.env.COORDINATOR_V2_TEST_DATABASE_URL !== url
    || !process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL
    || process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL === url) {
    throw new Error('Coordinator V2 host authorization requires the gate-provided disposable database URL');
  }
  return url;
}

test('Express protocol binding mismatch reaches no durable work authority', async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip('run through the Neon migration gate');
    return;
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `host-auth-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const id = (kind: string) => `${suffix}-${kind}`;
  const hex = (label: string) => createHash('sha256').update(`${suffix}:${label}`).digest('hex');
  const hostId = id('host'); const identityId = id('identity'); const versionId = id('version');
  const grantId = id('grant'); const sessionId = id('session'); const attemptId = id('attempt');
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id, host_key, host_type, display_name, protocol_version, public_key, key_fingerprint,
        capabilities, enrollment_digest, status, created_by)
       VALUES ($1,$2,'test','Host auth test',1,'test-key',$3,ARRAY['poll'],$4,'active','host-test')`,
      [hostId, id('host-key'), hex('fingerprint'), hex('enrollment')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities (id, policy_key, display_name, status, created_by)
       VALUES ($1,$2,'Host auth policy','active','host-test')`,
      [identityId, id('policy-key')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id, policy_identity_id, version, canonical_policy, policy_digest, approval_state, created_by, approved_by, approved_at)
       VALUES ($1,$2,1,'{}'::jsonb,$3,'approved','host-test','founder',now())`,
      [versionId, identityId, hex('policy')],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1,$2,'host-test',ARRAY['launch','resume','terminate'],'founder',now()+interval '1 hour',$3,$4)`,
      [grantId, identityId, hex('grant'), id('grant-key')],
    );
    await client.query(
      `INSERT INTO coordination_v2_sessions
       (id, policy_version_id, operator_grant_id, operator_actor, task_ref, task_artifact_sha256,
        repository_identity, starting_commit, enrolled_host_id, requested_providers, expires_at,
        attempt_budget, per_provider_budgets, required_validations, completion_criteria, state,
        idempotency_key, session_digest)
       VALUES ($1,$2,$3,'host-test','1',$4,'repo/test',$5,$6,ARRAY['test'],
               now()+interval '1 hour',5,'{}'::jsonb,ARRAY[]::text[],'{}'::jsonb,'ready',$7,$8)`,
      [sessionId, versionId, grantId, hex('artifact'), '1'.repeat(40), hostId, id('session-key'), hex('session')],
    );
    await client.query(
      `INSERT INTO coordination_v2_attempts
       (id, session_id, attempt_generation, provider, model, adapter_version, session_ordinal, provider_ordinal,
        state, attempt_digest, deadline_at)
       VALUES ($1,$2,$3,'test-provider','test-model','adapter-1',1,1,'waiting_for_host',$4,now()+interval '1 hour')`,
      [attemptId, sessionId, id('attempt-generation'), hex('attempt')],
    );
    await client.query('COMMIT');

    const lease = await acquireCoordinationTransportLease({
      sessionId, holderInstanceId: 'host-holder', actorId: 'host-test',
      requestKey: id('lease-request'), durationMs: 10_000,
    });
    const app = express();
    app.use(express.json());
    const auth: RequestHandler = (req, _res, next) => {
      (req as any).coordinationActor = 'host-test';
      next();
    };
    registerCoordinationHostRoutes(app, { coordinationAuthMiddleware: auth });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const wrongBinding: HostBinding = {
      policyVersionId: 'wrong-policy', sessionId, attemptId, enrolledHostId: hostId,
      transportLeaseId: lease.id, leaseEpoch: lease.epoch, holderInstanceId: 'host-holder',
      operation: 'claim', operationDigest: hex('operation'),
    };
    const envelope = createHostEnvelope('operation_claim', { binding: wrongBinding }, {
      requestId: id('claim-request'), correlationId: sessionId,
      issuedAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/host/sessions/${sessionId}/claim`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(envelope),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'LEASE_AUTHORIZATION_DENIED');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const counts = await client.query(
      `SELECT
       (SELECT count(*) FROM coordination_v2_transport_work_claims WHERE session_id=$1) AS claims,
       (SELECT count(*) FROM coordination_v2_transport_work_results WHERE session_id=$1) AS results,
       (SELECT count(*) FROM coordination_v2_cleanup_acknowledgements WHERE session_id=$1) AS acknowledgements`,
      [sessionId],
    );
    assert.deepEqual(counts.rows[0], { claims: '0', results: '0', acknowledgements: '0' });
  } finally {
    await client.query('BEGIN').catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_work_results WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_transport_work_claims WHERE session_id=$1', [sessionId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_attempt_events WHERE attempt_id=$1', [attemptId]).catch(() => undefined);
    await client.query('DELETE FROM coordination_v2_attempts WHERE id=$1', [attemptId]).catch(() => undefined);
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
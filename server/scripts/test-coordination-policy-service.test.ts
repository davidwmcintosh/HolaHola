import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeAndHashPolicy,
  PolicyValidationError,
} from '../services/coordination-policy-canonicalization';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

function disposableTarget(): string | undefined {
  const ciUrl = getVerifiedCiDatabaseUrl();
  if (ciUrl) return ciUrl;
  const branchUrl = process.env.NEON_SHARED_DATABASE_URL;
  if (!branchUrl) return undefined;
  if (process.env.COORDINATOR_V2_TEST_DATABASE_DISPOSABLE !== '1') return undefined;
  if (
    process.env.COORDINATOR_V2_TEST_DATABASE_URL !== branchUrl
    || process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL === branchUrl) {
    throw new Error('Coordinator policy service test refuses an unverified/shared database');
  }
  return branchUrl;
}

const basePolicy = {
  providerOrder: ['gemini', 'claude'],
  sessionDurationMs: 60_000,
  totalAttemptBudget: 4,
  perProviderAttemptBudgets: { gemini: 3, claude: 2 },
  tools: [{ name: 'git', operations: ['status'] }],
  paths: ['workspace/src'],
  commands: [{ name: 'test', template: 'npm test', timeoutMs: 60_000 }],
};

test('canonical policy digest is stable across object key order', () => {
  const first = canonicalizeAndHashPolicy(basePolicy);
  const second = canonicalizeAndHashPolicy({
    commands: basePolicy.commands,
    paths: basePolicy.paths,
    tools: basePolicy.tools,
    perProviderAttemptBudgets: basePolicy.perProviderAttemptBudgets,
    totalAttemptBudget: 4,
    sessionDurationMs: 60_000,
    providerOrder: ['gemini', 'claude'],
  });
  assert.equal(first.policyDigest, second.policyDigest);
  assert.match(first.policyDigest, /^[0-9a-f]{64}$/);
});

test('unknown and secret-shaped policy fields are rejected', () => {
  assert.throws(
    () => canonicalizeAndHashPolicy({ ...basePolicy, unexpected: true }),
    (error: unknown) => error instanceof PolicyValidationError && error.code === 'policy_unknown_field',
  );
  assert.throws(
    () => canonicalizeAndHashPolicy({ ...basePolicy, apiKey: 'never accepted' }),
    (error: unknown) => error instanceof PolicyValidationError && error.code === 'policy_secret_field',
  );
});

test('invalid provider order, paths, commands, and budgets are rejected', () => {
  assert.throws(() => canonicalizeAndHashPolicy({ ...basePolicy, providerOrder: ['gemini', 'gemini'] }));
  assert.throws(() => canonicalizeAndHashPolicy({ ...basePolicy, paths: ['../outside'] }));
  assert.throws(() => canonicalizeAndHashPolicy({ ...basePolicy, commands: ['npm test; rm -rf /'] }));
  assert.throws(() => canonicalizeAndHashPolicy({ ...basePolicy, totalAttemptBudget: 0 }));
});

// The integration portion below writes only to a verified disposable CI
// PostgreSQL URL and is skipped (never rerouted) in developer/shared-Neon
// processes.

test('disposable PostgreSQL policy authority is transactional and scoped', async (context) => {
  const databaseUrl = disposableTarget();
  if (!databaseUrl) {
    context.skip('requires a verified disposable PostgreSQL URL');
    return;
  }
  const pg = (await import('pg')).default;
  const { createPolicyDraft, approvePolicyVersion, revokePolicyVersion,
    issueOperatorGrant, authorizeOperatorAction, revokeOperatorGrant,
    CoordinationPolicyError } = await import('../services/coordination-policy-service');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const policy = () => ({
    providerOrder: ['gemini', 'claude'],
    sessionDurationMs: 60_000,
    totalAttemptBudget: 4,
    perProviderAttemptBudgets: { gemini: 3, claude: 2 },
    tools: ['git'],
    paths: ['workspace'],
    commands: ['npm test'],
  });
  const key = `ci-policy-${suffix}`;
  const expectCode = async (action: Promise<unknown>, code: string) => {
    await assert.rejects(action, (error: unknown) =>
      error instanceof CoordinationPolicyError && error.code === code);
  };
  try {
    const drafts = await Promise.all([
      createPolicyDraft({ policyKey: key, displayName: 'CI policy', policy: policy(), createdBy: 'founder-a' }),
      createPolicyDraft({ policyKey: key, displayName: 'CI policy', policy: policy(), createdBy: 'founder-a' }),
    ]);
    assert.equal(drafts[0].version.id, drafts[1].version.id);
    assert.equal(drafts[0].version.version, 1);
    const changed = await createPolicyDraft({
      policyKey: key, displayName: 'CI policy', policy: { ...policy(), totalAttemptBudget: 5 }, createdBy: 'founder-a',
    });
    assert.equal(changed.version.version, 2);

    const approvedOne = await approvePolicyVersion({
      versionId: drafts[0].version.id, founderActor: 'founder-a', requestKey: 'approve-one', reason: '  approve   it ',
    });
    const repeated = await approvePolicyVersion({
      versionId: drafts[0].version.id, founderActor: 'founder-a', requestKey: 'approve-one', reason: 'approve it',
    });
    assert.equal(repeated.decision.id, approvedOne.decision.id);
    await expectCode(approvePolicyVersion({
      versionId: drafts[0].version.id, founderActor: 'founder-b', requestKey: 'approve-one', reason: 'approve it',
    }), 'IDEMPOTENCY_CONFLICT');
    await expectCode(approvePolicyVersion({
      versionId: drafts[0].version.id, founderActor: 'founder-a', requestKey: 'approve-one', reason: 'different',
    }), 'IDEMPOTENCY_CONFLICT');
    await expectCode(revokePolicyVersion({
      versionId: drafts[0].version.id, founderActor: 'founder-a', requestKey: 'approve-one', reason: 'revoke',
    }), 'IDEMPOTENCY_CONFLICT');
    await expectCode(approvePolicyVersion({
      versionId: drafts[0].version.id, founderActor: 'founder-a', requestKey: 'another-approval',
    }), 'POLICY_ALREADY_APPROVED');

    // The database trigger is the final immutability boundary, not merely a
    // service convention.
    await client.query('BEGIN');
    await assert.rejects(
      client.query('UPDATE coordination_v2_policy_versions SET canonical_policy = $1 WHERE id = $2', [JSON.stringify({ changed: true }), drafts[0].version.id]),
      (error: unknown) => (error as { code?: string }).code === '23514',
    );
    await client.query('ROLLBACK');

    const approvedTwo = await approvePolicyVersion({
      versionId: changed.version.id, founderActor: 'founder-a', requestKey: 'approve-two',
    });
    const grant = await issueOperatorGrant({
      policyIdentityId: approvedTwo.version.policyIdentityId,
      operatorActor: 'operator-a',
      minVersion: 2,
      maxVersion: 2,
      actions: ['status', 'launch'],
      expiresAt: new Date(Date.now() + 60_000),
      requestKey: 'grant-one',
      founderActor: 'founder-a',
      founderRole: 'founder',
    });
    assert.deepEqual(grant.actions, ['launch', 'status']);
    await expectCode(issueOperatorGrant({
      policyIdentityId: approvedTwo.version.policyIdentityId,
      operatorActor: 'operator-b',
      minVersion: 2,
      maxVersion: 2,
      actions: ['status', 'launch'],
      expiresAt: new Date(Date.now() + 60_000),
      requestKey: 'grant-one',
      founderActor: 'founder-a',
      founderRole: 'founder',
    }), 'IDEMPOTENCY_CONFLICT');
    assert.equal((await authorizeOperatorAction({
      grantId: grant.id, operatorActor: 'operator-a', policyVersionId: approvedTwo.version.id, action: 'launch',
    })).id, grant.id);
    await expectCode(authorizeOperatorAction({
      grantId: grant.id, operatorActor: 'operator-a', policyVersionId: drafts[0].version.id, action: 'launch',
    }), 'OPERATOR_GRANT_POLICY_DENIED');
    await expectCode(issueOperatorGrant({
      policyIdentityId: approvedTwo.version.policyIdentityId, operatorActor: 'operator-b',
      actions: ['launch'], expiresAt: new Date(Date.now() + 60_000), requestKey: 'bad-founder',
      founderActor: 'operator-a', founderRole: 'operator' as never,
    }), 'FOUNDER_REQUIRED');
    await expectCode(authorizeOperatorAction({
      grantId: grant.id, operatorActor: 'operator-b', policyVersionId: approvedTwo.version.id, action: 'launch',
    }), 'OPERATOR_GRANT_SCOPE_DENIED');
    await expectCode(authorizeOperatorAction({
      grantId: grant.id, operatorActor: 'operator-a', policyVersionId: approvedTwo.version.id, action: 'resume',
    }), 'OPERATOR_GRANT_ACTION_DENIED');
    await expectCode(authorizeOperatorAction({
      grantId: grant.id, operatorActor: 'operator-a', policyVersionId: approvedTwo.version.id,
      action: 'launch', now: new Date(Date.now() + 120_000),
    }), 'OPERATOR_GRANT_EXPIRED');
    const revokedGrant = await revokeOperatorGrant({
      grantId: grant.id, founderActor: 'founder-a', founderRole: 'founder', requestKey: 'revoke-grant',
    });
    assert.equal((await revokeOperatorGrant({
      grantId: grant.id, founderActor: 'founder-a', founderRole: 'founder', requestKey: 'revoke-grant',
    })).id, revokedGrant.id);
    await expectCode(revokeOperatorGrant({
      grantId: grant.id, founderActor: 'founder-a', founderRole: 'founder',
      requestKey: 'revoke-grant', reason: 'changed',
    }), 'IDEMPOTENCY_CONFLICT');
    await expectCode(revokeOperatorGrant({
      grantId: grant.id, founderActor: 'founder-a', founderRole: 'founder', requestKey: 'new-revoke-key',
    }), 'OPERATOR_GRANT_ALREADY_REVOKED');
    await expectCode(authorizeOperatorAction({
      grantId: grant.id, operatorActor: 'operator-a', policyVersionId: approvedTwo.version.id, action: 'launch',
    }), 'OPERATOR_GRANT_REVOKED');
    const policyScopedGrant = await issueOperatorGrant({
      policyIdentityId: approvedTwo.version.policyIdentityId,
      operatorActor: 'operator-policy',
      minVersion: 2,
      maxVersion: 2,
      actions: ['launch'],
      expiresAt: new Date(Date.now() + 60_000),
      requestKey: 'grant-policy-scope',
      founderActor: 'founder-a',
      founderRole: 'founder',
    });
    await revokePolicyVersion({
      versionId: approvedTwo.version.id, founderActor: 'founder-a', requestKey: 'revoke-policy',
    });
    await expectCode(authorizeOperatorAction({
      grantId: policyScopedGrant.id, operatorActor: 'operator-policy',
      policyVersionId: approvedTwo.version.id, action: 'launch',
    }), 'OPERATOR_GRANT_POLICY_DENIED');

    const before = await client.query(
      'SELECT count(*)::int AS count FROM coordination_v2_operator_grants WHERE policy_identity_id = $1',
      [approvedTwo.version.policyIdentityId],
    );
    await expectCode(issueOperatorGrant({
      policyIdentityId: approvedTwo.version.policyIdentityId, operatorActor: 'operator-c',
      minVersion: 99, actions: ['launch'], expiresAt: new Date(Date.now() + 60_000),
      requestKey: 'rejected-grant', founderActor: 'founder-a', founderRole: 'founder',
    }), 'POLICY_NOT_APPROVED');
    const after = await client.query(
      'SELECT count(*)::int AS count FROM coordination_v2_operator_grants WHERE policy_identity_id = $1',
      [approvedTwo.version.policyIdentityId],
    );
    assert.equal(after.rows[0].count, before.rows[0].count);
    const audits = await client.query(
      'SELECT action, success FROM coordination_v2_policy_audit_events WHERE policy_identity_id = $1',
      [approvedTwo.version.policyIdentityId],
    );
    assert.ok(audits.rows.some((row: { action: string }) => row.action === 'grant_issued'));
    assert.ok(audits.rows.some((row: { action: string }) => row.action === 'grant_revoked'));
    assert.ok(audits.rows.some((row: { action: string }) => row.action === 'policy_revoked'));
    assert.ok(audits.rows.some((row: { action: string; success: boolean }) => row.action === 'authorization_denied' && row.success === false));
    const denials = await client.query(
      `SELECT request_key, actor_id, reason
       FROM coordination_v2_policy_audit_events
       WHERE policy_identity_id = $1 AND action = 'authorization_denied'`,
      [approvedTwo.version.policyIdentityId],
    );
    assert.ok(new Set(denials.rows.map((row: { request_key: string }) => row.request_key)).size >= 3);
    assert.ok(denials.rows.some((row: { actor_id: string; reason: string }) =>
      row.actor_id === 'operator-b' && row.reason === 'OPERATOR_GRANT_SCOPE_DENIED'));
    assert.ok(denials.rows.some((row: { actor_id: string; reason: string }) =>
      row.actor_id === 'operator-a' && row.reason === 'OPERATOR_GRANT_ACTION_DENIED'));
  } finally {
    await client.end();
    const { closeDbConnections } = await import('../db');
    await closeDbConnections();
  }
});

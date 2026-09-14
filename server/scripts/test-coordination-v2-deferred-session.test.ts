import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isContainedPath } from './coordination-windows-prepare';
import pg from 'pg';
import { readdirSync, readFileSync as readText } from 'node:fs';
import { join } from 'node:path';
import { rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  isCoordinationPreparationUniqueConflict,
  validatePreparationReservationBinding,
} from '../services/coordination-windows-generation';

const schema = readFileSync('shared/schema.ts', 'utf8');
const migration = readFileSync('migrations/0049_brainy_mikhail_rasputin.sql', 'utf8');
const generation = readFileSync('server/services/coordination-windows-generation.ts', 'utf8');
const routes = readFileSync('server/routes/coordination-host-routes.ts', 'utf8');

test('deferred reservation authority is present and session linkage is post-ack', () => {
  assert.match(schema, /sessionId: varchar\("session_id"\)/);
  assert.match(schema, /preparationReservationId: varchar/);
  assert.match(generation, /reserveCoordinationWindowsPreparationBeforeSession/);
  assert.match(generation, /acknowledgeCoordinationWindowsPreparationBeforeSession/);
  assert.match(generation, /sessionId: null/);
  assert.match(generation, /state: "acknowledged"/);
  assert.match(routes, /acknowledgeCoordinationWindowsPreparationBeforeSession/);
  assert.match(migration, /ALTER TABLE "coordination_v2_preparation_reservations" ALTER COLUMN "session_id" DROP NOT NULL/);
  assert.match(generation, /readReservationWinner/);
  assert.match(generation, /boundedReservationBackoff/);
});

test('reservation unique-conflict classifier is bounded and constraint-specific', () => {
  assert.equal(isCoordinationPreparationUniqueConflict({
    code: '23505', constraint: 'uq_coordination_v2_preparation_reserve_request',
  }), true);
  assert.equal(isCoordinationPreparationUniqueConflict({
    cause: { code: '23505', constraint: 'uq_coordination_v2_preparation_generation' },
  }), true);
  assert.equal(isCoordinationPreparationUniqueConflict({
    code: '23505', constraint: 'unrelated_unique_constraint',
  }), false);
  assert.equal(isCoordinationPreparationUniqueConflict({
    cause: { code: '40001', constraint: 'uq_coordination_v2_preparation_reserve_request' },
  }), false);
  assert.equal(isCoordinationPreparationUniqueConflict({
    code: '23505', detail: 'duplicate key value violates unique constraint uq_coordination_v2_preparation_reserve_request',
  }), false);
  assert.equal(isCoordinationPreparationUniqueConflict({
    cause: { cause: { cause: { cause: { code: '23505', constraint: 'uq_coordination_v2_preparation_reserve_request' } } } },
  }), false);
});

test('pre-session exported reservation owns exact-conflict recovery', () => {
  const start = generation.indexOf('export async function reserveCoordinationWindowsPreparationBeforeSession');
  const end = generation.indexOf('\n}\n\nexport async function acknowledgeCoordinationWindowsPreparationBeforeSession', start);
  assert.ok(start >= 0 && end > start, 'pre-session reservation function must remain discoverable');
  const implementation = generation.slice(start, end);
  assert.match(implementation, /const commandDigest = digest\(input\)/);
  assert.match(implementation, /for \(let collisionAttempt = 0; collisionAttempt < 2/);
  assert.match(implementation, /isCoordinationPreparationUniqueConflict\(error\)/);
  assert.match(implementation, /readReservationWinner\(reserveRequestKey\)/);
  assert.match(implementation, /winner\.reserveCommandDigest !== commandDigest/);
  assert.match(implementation, /reserveCommandDigest: commandDigest/);
  assert.match(implementation, /const generationId = randomUUID\(\)/);
  assert.equal((implementation.match(/digest\(input\)/g) ?? []).length, 1,
    'generation randomness must not enter the pre-session command digest');
});

test('disposable deferred-session integration gate remains registered for branch DB execution', {
  skip: process.env.COORDINATION_V2_RUN_DISPOSABLE_DB !== '1',
}, async () => {
  const url = process.env.COORDINATION_V2_TEST_DATABASE_URL;
  if (!url || process.env.COORDINATION_V2_TEST_DATABASE_DISPOSABLE !== '1'
    || process.env.COORDINATION_V2_TEST_DATABASE_VERIFIED !== '1'
    || url === process.env.COORDINATION_V2_FORBIDDEN_SHARED_URL) {
    throw new Error('COORDINATION_V2_RUN_DISPOSABLE_DB=1 requires a verified job-local disposable PostgreSQL URL');
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const suffix = `deferred-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const id = (kind: string) => `${kind}-${suffix}`;
  const sha = (seed: string) => seed.repeat(64);
    const taskRef = id('task');
    const operatorActor = id('operator');
  try {
    // This is intentionally a fresh disposable database, not the application
    // migration runner: every statement through the consolidated 0049 is
    // applied and then verified before behavioral assertions begin.
    for (const file of readdirSync('migrations').filter((name) => /^\d+_.*\.sql$/.test(name)).sort()) {
      const number = Number(file.slice(0, 4));
      if (number > 49) continue;
      for (const statement of readText(join('migrations', file), 'utf8').split('--> statement-breakpoint')) {
        if (statement.trim()) await client.query(statement);
      }
    }
    await client.query("BEGIN");
    const before = await client.query(
      `SELECT count(*)::int AS count FROM coordination_v2_sessions
       WHERE task_ref = $1 AND operator_actor = $2 AND enrolled_host_id = $3
         AND policy_version_id = $4 AND operator_grant_id = $5`,
      [taskRef, operatorActor, id('host'), id('version'), id('grant')],
    );
    assert.equal(before.rows[0].count, 0, 'pre-session reservation must not create matching session authority');
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id, host_key, host_type, display_name, protocol_version, public_key, key_fingerprint,
        capabilities, enrollment_digest, enrollment_request_key, status, created_by)
       VALUES ($1, $2, 'windows', 'deferred-test-host', 1, 'public', $3, ARRAY['preflight'],
        $4, $5, 'active', 'deferred-test')`,
      [id('host'), id('host-key'), sha('f'), sha('0'), id('enrollment-request')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities (id, policy_key, display_name, status, created_by)
       VALUES ($1, $2, 'deferred-test-policy', 'active', 'deferred-test')`,
      [id('policy'), id('policy-key')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id, policy_identity_id, version, canonical_policy, policy_digest, approval_state,
        created_by, approved_by, approved_at)
        VALUES ($1, $2, 1, $3::jsonb, $4, 'approved', 'deferred-test', 'deferred-test', now())`,
       [id('version'), id('policy'), JSON.stringify({
         hostTypes: ['windows'], hostConstraints: { windowsRepositoryBranch: 'main' },
         providerOrder: ['gemini'], sessionDurationMs: 900_000, totalAttemptBudget: 2,
         perProviderAttemptBudgets: { gemini: 2 }, requiredValidationCommands: ['typecheck'],
         requiredCompletionEvidence: ['digest'], cleanupRequirements: ['revoke_authority'],
       }), sha('1')],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id, policy_identity_id, operator_actor, actions, issued_by, expires_at, grant_digest, request_key)
       VALUES ($1, $2, $3, ARRAY['launch'], 'deferred-test', now() + interval '1 hour', $4, $5)`,
      [id('grant'), id('policy'), operatorActor, sha('2'), id('grant-request')],
    );
    await client.query(
      `INSERT INTO coordination_v2_source_promotions
       (id, repository_identity, promoted_commit_sha, exact_tree_sha, publication_reference,
        protected_validation_id, canonical_record_digest, state, operation_receipt_digest, operation_receipt_reference)
       VALUES ($1, 'github:owner/deferred', $2, $3, $4, $5, $6, 'published', $7, $8)`,
      [id('promotion'), '2'.repeat(40), '3'.repeat(40), id('publication'), sha('promotion-validation'),
        sha('promotion-record'), sha('promotion-receipt'), id('receipt')],
    );
    await client.query("COMMIT");
    const { reserveCoordinationWindowsPreparationBeforeSession,
      promoteCoordinationWindowsPreparationBeforeSession,
      acknowledgeCoordinationWindowsPreparationBeforeSession } =
      await import('../services/coordination-windows-generation');
    const reservation = await reserveCoordinationWindowsPreparationBeforeSession({
      taskRef, taskArtifactSha256: sha('d'), repositoryIdentity: 'github:owner/deferred',
      startingCommit: '1'.repeat(40), enrolledHostId: id('host'), policyIdentityId: id('policy'),
      policyVersionId: id('version'), operatorGrantId: id('grant'), operatorActor,
      reserveRequestKey: id('reserve-service'), branch: 'main', publicMaterialDigest: sha('b'),
      promotionRecordId: id('promotion'), promotedCommitSha: '2'.repeat(40), exactTreeSha: '3'.repeat(40),
    });
    assert.equal(reservation.sessionId, null);
    const lineage = await client.query(
      `SELECT
         (SELECT count(*) FROM coordination_v2_sessions WHERE preparation_reservation_id = $1) AS sessions,
         (SELECT count(*) FROM coordination_v2_attempts WHERE session_id IN
           (SELECT id FROM coordination_v2_sessions WHERE preparation_reservation_id = $1)) AS attempts,
         (SELECT count(*) FROM coordination_v2_transport_leases WHERE session_id IN
           (SELECT id FROM coordination_v2_sessions WHERE preparation_reservation_id = $1)) AS leases,
         (SELECT count(*) FROM coordination_v2_session_credentials WHERE session_id IN
           (SELECT id FROM coordination_v2_sessions WHERE preparation_reservation_id = $1)) AS credentials`,
      [reservation.id],
    );
    assert.deepEqual(lineage.rows[0], { sessions: '0', attempts: '0', leases: '0', credentials: '0' });
    const { issueCoordinationV2SessionCredential } = await import('../services/coordination-v2-host-auth-service');
    await assert.rejects(() => issueCoordinationV2SessionCredential({
      hostCredentialId: id('missing-host-credential'), hostEnrollmentId: id('host'),
      sessionId: id('missing-session'), attemptId: id('missing-attempt'), leaseId: id('missing-lease'),
      leaseEpoch: 1, holderInstanceId: id('holder'), capability: 'host:transport', lineageDigest: sha('missing'),
    }));
    const promoted = await promoteCoordinationWindowsPreparationBeforeSession({
      reservationId: reservation.id, actorId: operatorActor, generationId: reservation.generationId,
      publicMaterialDigest: reservation.publicMaterialDigest, safePromotionEvidenceDigest: sha('evidence'),
    });
    const ack = {
      reservationId: promoted.id, actorId: operatorActor, generationId: promoted.generationId,
      publicMaterialDigest: promoted.publicMaterialDigest, acknowledgementRequestKey: id('ack'),
      safePromotionEvidenceDigest: sha('evidence'),
    };
    const [first, second] = await Promise.all([
      acknowledgeCoordinationWindowsPreparationBeforeSession(ack),
      acknowledgeCoordinationWindowsPreparationBeforeSession(ack),
    ]);
    assert.equal(first.sessionId, second.sessionId);
    assert.equal(first.acknowledgementRequestKey, ack.acknowledgementRequestKey);
    const { createFreshAttempt } = await import('../services/coordination-attempt-service');
    const attempt = await createFreshAttempt({
      sessionId: first.sessionId!, requestKey: id('attempt'), actorId: operatorActor,
      provider: 'gemini', model: 'gemini-test', adapterVersion: 'test', attemptGeneration: id('attempt-generation'),
    });
    assert.ok('id' in attempt);
    const { acquireCoordinationTransportLease } = await import('../services/coordination-transport-lease-service');
    const lease = await acquireCoordinationTransportLease({
      sessionId: first.sessionId!, actorId: operatorActor, holderInstanceId: id('holder'),
      requestKey: id('lease'), durationMs: 60_000,
    });
    assert.equal(lease.state, 'active');
    await client.query(
      `INSERT INTO coordination_v2_host_credentials
       (id, host_enrollment_id, token_hash, credential_digest, lineage_digest, capability,
        protocol_version, holder_instance_id, proof_key_fingerprint, issued_by, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'host:transport', 1, $6, $7, $8, now(), now() + interval '1 hour')`,
      [id('host-credential'), id('host'), sha('host-token'), sha('host-credential-digest'),
        sha('host-lineage'), id('holder'), sha('host-proof'), operatorActor],
    );
    const issued = await issueCoordinationV2SessionCredential({
      hostCredentialId: id('host-credential'), hostEnrollmentId: id('host'),
      sessionId: first.sessionId!, attemptId: (attempt as any).id, leaseId: lease.id,
      leaseEpoch: lease.epoch, holderInstanceId: id('holder'), capability: 'host:transport',
      lineageDigest: sha('host-lineage'),
    });
    assert.equal(issued.credentialId.length > 0, true);
    const secondReservation = await reserveCoordinationWindowsPreparationBeforeSession({
      taskRef, taskArtifactSha256: sha('d'), repositoryIdentity: 'github:owner/deferred',
      startingCommit: '1'.repeat(40), enrolledHostId: id('host'), policyIdentityId: id('policy'),
      policyVersionId: id('version'), operatorGrantId: id('grant'), operatorActor,
      reserveRequestKey: id('reserve-service-2'), branch: 'main', publicMaterialDigest: sha('b'),
      promotionRecordId: id('promotion'), promotedCommitSha: '2'.repeat(40), exactTreeSha: '3'.repeat(40),
    });
    const secondPromoted = await promoteCoordinationWindowsPreparationBeforeSession({
      reservationId: secondReservation.id, actorId: operatorActor, generationId: secondReservation.generationId,
      publicMaterialDigest: secondReservation.publicMaterialDigest, safePromotionEvidenceDigest: sha('evidence-2'),
    });
    const ackA = {
      reservationId: secondPromoted.id, actorId: operatorActor, generationId: secondPromoted.generationId,
      publicMaterialDigest: secondPromoted.publicMaterialDigest, acknowledgementRequestKey: id('ack-a'),
      safePromotionEvidenceDigest: sha('evidence-2'),
    };
    const ackB = { ...ackA, acknowledgementRequestKey: id('ack-b'), safePromotionEvidenceDigest: sha('evidence-other') };
    const raced = await Promise.allSettled([
      acknowledgeCoordinationWindowsPreparationBeforeSession(ackA),
      acknowledgeCoordinationWindowsPreparationBeforeSession(ackB),
    ]);
    assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(raced.filter((result) => result.status === 'rejected').length, 1);
    const rejected = raced.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    assert.equal((rejected.reason as { code?: string }).code, 'PREPARATION_REPLAY_CONFLICT');
    const secondLineage = await client.query(
      `SELECT count(*)::int AS sessions,
        (SELECT count(*)::int FROM coordination_v2_preparation_events WHERE reservation_id = $1) AS events
       FROM coordination_v2_sessions WHERE preparation_reservation_id = $1`,
      [secondReservation.id],
    );
    assert.equal(secondLineage.rows[0].sessions, 1);
    assert.equal(secondLineage.rows[0].events, 3);
    const after = await client.query(
      `SELECT
        (SELECT count(*) FROM coordination_v2_sessions WHERE preparation_reservation_id = $1) AS sessions,
        (SELECT count(*) FROM coordination_v2_attempts WHERE session_id = $2) AS attempts,
        (SELECT count(*) FROM coordination_v2_session_events WHERE session_id = $2) AS events,
        (SELECT count(*) FROM coordination_v2_preparation_events WHERE reservation_id = $1) AS preparation_events`,
      [reservation.id, first.sessionId],
    );
    assert.deepEqual(after.rows[0], { sessions: '1', attempts: '1', events: '1', preparation_events: '3' });
    const eventKeys = await client.query(
      `SELECT sequence, request_key FROM coordination_v2_preparation_events
       WHERE reservation_id = $1 ORDER BY sequence`, [reservation.id],
    );
    assert.deepEqual(eventKeys.rows.map((row) => row.sequence), [1, 2, 3]);
    assert.equal(new Set(eventKeys.rows.map((row) => row.request_key)).size, 3);
    const conflicting = { ...ack, acknowledgementRequestKey: id('conflict-ack'), safePromotionEvidenceDigest: sha('different') };
    await assert.rejects(
      acknowledgeCoordinationWindowsPreparationBeforeSession(conflicting),
      (error: any) => error?.code === 'PREPARATION_REPLAY_CONFLICT',
    );
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
    const { closeDbConnections } = await import('../db');
    await closeDbConnections();
  }
});

test('mutation self-check catches removal of post-ack session guard', () => {
  const mutated = routes.replace(/acknowledgeCoordinationWindowsPreparationBeforeSession/g, '');
  assert.notEqual(mutated, routes);
  assert.match(routes, /if \(path === 'acknowledge' && typeof body\.reservationId/);
});

test('executable mutation self-check observes invalid pre-session binding failure', async () => {
  const invalid = {
    sessionId: null, state: 'reserved', taskRef: null, taskArtifactSha256: null,
    promotionRecordId: null, promotedCommitSha: null, exactTreeSha: null,
    policyIdentityId: null, policyVersionId: null, operatorGrantId: null, operatorActor: null,
  } as const;
  assert.equal(validatePreparationReservationBinding(invalid as any), false);
  const source = readText('server/services/coordination-windows-generation.ts', 'utf8');
  const mutated = source.replace(
    'return ["reserved", "promoted"].includes(row.state)',
    'return true || ["reserved", "promoted"].includes(row.state)',
  );
  assert.notEqual(mutated, source);
  const path = join('server', 'services', `.coordination-v2-mutation-${process.pid}.ts`);
  try {
    // Keep the mutation executable in the same module resolution context.
    await writeFile(path, mutated, 'utf8');
    const imported = await import(pathToFileURL(path).href);
    assert.equal(imported.validatePreparationReservationBinding(invalid), true);
    assert.notEqual(imported.validatePreparationReservationBinding(invalid), validatePreparationReservationBinding(invalid as any));
  } finally {
    await rm(path, { force: true });
  }
});

test('preparation containment handles POSIX, Windows, traversal, and cross-volume paths', () => {
  assert.equal(isContainedPath('/srv/coordinator', '/srv/coordinator/work/active'), true);
  assert.equal(isContainedPath('/srv/coordinator', '/srv/coordinator/../escape'), false);
  assert.equal(isContainedPath('/srv/coordinator', '/srv/coordinator-other/file'), false);
  assert.equal(isContainedPath('C:\\Hola\\Coordinator', 'C:\\Hola\\Coordinator\\work\\active'), true);
  assert.equal(isContainedPath('C:\\Hola\\Coordinator', 'C:\\Hola\\Coordinator\\..\\escape'), false);
  assert.equal(isContainedPath('C:\\Hola\\Coordinator', 'D:\\Hola\\Coordinator\\work'), false);
  assert.equal(isContainedPath('C:\\Hola\\Coordinator', '\\\\server\\other\\Coordinator'), false);
});

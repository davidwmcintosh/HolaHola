import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool } from 'pg';
import express from 'express';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { canonicalJson } from '../services/coordination-policy-canonicalization';
import { createHostEnvelope } from '../services/coordination-host-protocol';

const codeIs = (expected: string) => (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: unknown }).code === expected;

function hostInput(hostId: string, requestKey: string, bootstrapSecret?: string) {
  const capabilities = ['host:cleanup', 'host:transport'];
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = pair.publicKey.export({ format: 'jwk' });
  const publicKey = JSON.stringify(publicJwk);
  const keyFingerprint = createHash('sha256').update(canonicalJson(publicJwk)).digest('hex');
  const declarationDigest = createHash('sha256').update(canonicalJson({
    hostId,
    capabilities,
    protocolVersion: 1,
  })).digest('hex');
  const now = new Date();
  const declaration = createHostEnvelope('enrollment_declaration', {
    hostId,
    capabilities,
    declarationDigest,
    protocolVersion: 1,
  }, {
    requestId: randomUUID(),
    correlationId: randomUUID(),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 120_000).toISOString(),
  });
  return { requestKey, declaration, publicKey, keyFingerprint, capabilities, bootstrapSecret, now };
}

test('initial bootstrap secret verifier fails closed without exposing secret values', async () => {
  const { assertCoordinationV2InitialBootstrap } = await import('../services/coordination-v2-host-auth-service');
  const secret = randomBytes(32).toString('base64url');
  assert.throws(
    () => assertCoordinationV2InitialBootstrap({ providedSecret: secret }),
    codeIs('V2_HOST_BOOTSTRAP_UNAVAILABLE'),
  );
  assert.throws(
    () => assertCoordinationV2InitialBootstrap({ configuredSecret: secret }),
    codeIs('V2_HOST_BOOTSTRAP_REQUIRED'),
  );
  const wrong = randomBytes(32).toString('base64url');
  const capturedLogs: string[] = [];
  const originalConsole = { error: console.error, warn: console.warn, log: console.log };
  let denied: unknown;
  try {
    console.error = (...values: unknown[]) => { capturedLogs.push(values.map(String).join(' ')); };
    console.warn = (...values: unknown[]) => { capturedLogs.push(values.map(String).join(' ')); };
    console.log = (...values: unknown[]) => { capturedLogs.push(values.map(String).join(' ')); };
    assertCoordinationV2InitialBootstrap({ configuredSecret: secret, providedSecret: wrong });
  } catch (error) {
    denied = error;
  } finally {
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.log = originalConsole.log;
  }
  assert.equal(codeIs('V2_HOST_BOOTSTRAP_DENIED')(denied), true);
  assert.doesNotMatch(String(denied), new RegExp(`${secret}|${wrong}`));
  assert.doesNotMatch(capturedLogs.join('\n'), new RegExp(`${secret}|${wrong}`));
  assert.doesNotThrow(
    () => assertCoordinationV2InitialBootstrap({ configuredSecret: secret, providedSecret: secret }),
  );
});

test('HTTP route forwards the bootstrap header and maps fail-closed errors', async () => {
  const {
    CoordinationV2HostAuthError,
  } = await import('../services/coordination-v2-host-auth-service');
  const { registerCoordinationV2HostAdminRoutes } = await import('../routes/coordination-v2-host-admin-routes');
  let capturedSecret: string | undefined;
  let nextError: ConstructorParameters<typeof CoordinationV2HostAuthError>[0] | undefined;
  const app = express();
  app.use(express.json());
  registerCoordinationV2HostAdminRoutes(app, {
    founderMiddleware: [],
    submitEnrollmentRequest: async (input) => {
      capturedSecret = input.bootstrapSecret;
      if (nextError) throw new CoordinationV2HostAuthError(nextError);
      return {
        requestId: 'request-http-test',
        status: 'pending',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        created: true,
      };
    },
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}/api/coordination/v2/host-enrollment-requests`;
    const request = (bootstrap?: string) => fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(bootstrap ? { 'x-coordination-initial-bootstrap': bootstrap } : {}),
      },
      body: JSON.stringify({}),
    });
    const secret = randomBytes(32).toString('base64url');
    const created = await request(secret);
    assert.equal(created.status, 201);
    assert.equal(capturedSecret, secret);

    const statuses = [
      ['V2_HOST_BOOTSTRAP_REQUIRED', 401],
      ['V2_HOST_BOOTSTRAP_DENIED', 403],
      ['V2_HOST_BOOTSTRAP_UNAVAILABLE', 503],
      ['V2_HOST_BOOTSTRAP_CONSUMED', 409],
      ['V2_HOST_SOURCE_PROMOTION_REQUIRED', 409],
    ] as const;
    for (const [code, status] of statuses) {
      nextError = code;
      const response = await request();
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { error: { code } });
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('disposable PostgreSQL serializes and consumes exactly one first-host bootstrap', async (context) => {
  const databaseUrl = getVerifiedCiDatabaseUrl();
  if (!databaseUrl) {
    context.skip('requires verified job-local CI_DATABASE_URL');
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const previousSecret = process.env.COORDINATION_V2_HOST_BOOTSTRAP_SECRET;
  const bootstrapSecret = randomBytes(32).toString('base64url');
  process.env.COORDINATION_V2_HOST_BOOTSTRAP_SECRET = bootstrapSecret;
  const {
    submitCoordinationV2HostEnrollmentRequest,
  } = await import('../services/coordination-v2-host-auth-service');

  const truncate = async () => {
    await pool.query(`
      TRUNCATE TABLE
        coordination_v2_host_proof_challenges,
        coordination_v2_host_credentials,
        coordination_v2_host_enrollment_requests,
        coordination_v2_host_enrollments,
        coordination_v2_source_promotions
      CASCADE
    `);
  };

  try {
    await truncate();
    const noPromotion = hostInput('windows-no-promotion', `request-${randomUUID()}`, bootstrapSecret);
    await assert.rejects(
      submitCoordinationV2HostEnrollmentRequest(noPromotion),
      codeIs('V2_HOST_SOURCE_PROMOTION_REQUIRED'),
    );
    assert.equal(
      Number((await pool.query('SELECT count(*) AS count FROM coordination_v2_host_enrollment_requests')).rows[0].count),
      0,
    );

    await pool.query(`
      INSERT INTO coordination_v2_source_promotions (
        id, repository_identity, promoted_commit_sha, exact_tree_sha,
        publication_reference, protected_validation_id, canonical_record_digest,
        state, operation_receipt_digest, operation_receipt_reference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', $8, $9)
    `, [
      `promotion-${randomUUID()}`,
      'github:davidwmcintosh/holahola',
      'a'.repeat(40),
      'b'.repeat(40),
      `replit-publish:test:${randomUUID()}`,
      randomBytes(32).toString('hex'),
      randomBytes(32).toString('hex'),
      randomBytes(32).toString('hex'),
      `receipt:test:${randomUUID()}`,
    ]);

    const missing = hostInput('windows-missing', `request-${randomUUID()}`);
    await assert.rejects(
      submitCoordinationV2HostEnrollmentRequest(missing),
      codeIs('V2_HOST_BOOTSTRAP_REQUIRED'),
    );
    const wrong = hostInput('windows-wrong', `request-${randomUUID()}`, randomBytes(32).toString('base64url'));
    await assert.rejects(
      submitCoordinationV2HostEnrollmentRequest(wrong),
      codeIs('V2_HOST_BOOTSTRAP_DENIED'),
    );

    const first = hostInput('windows-first-a', `request-${randomUUID()}`, bootstrapSecret);
    const competing = hostInput('windows-first-b', `request-${randomUUID()}`, bootstrapSecret);
    const outcomes = await Promise.allSettled([
      submitCoordinationV2HostEnrollmentRequest(first),
      submitCoordinationV2HostEnrollmentRequest(competing),
    ]);
    const winners = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const losers = outcomes.filter((outcome) => outcome.status === 'rejected');
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);
    assert.equal(codeIs('V2_HOST_BOOTSTRAP_CONSUMED')((losers[0] as PromiseRejectedResult).reason), true);

    const winningInput = outcomes[0].status === 'fulfilled' ? first : competing;
    const winningResult = outcomes.find((outcome) => outcome.status === 'fulfilled') as PromiseFulfilledResult<{
      requestId: string; status: string; expiresAt: string; created: boolean;
    }>;
    assert.equal(winningResult.value.created, true);
    const replay = await submitCoordinationV2HostEnrollmentRequest({
      ...winningInput,
      bootstrapSecret: undefined,
    });
    assert.equal(replay.created, false);
    assert.equal(replay.requestId, winningResult.value.requestId);

    await assert.rejects(
      submitCoordinationV2HostEnrollmentRequest(
        hostInput('windows-after-consumption', `request-${randomUUID()}`, bootstrapSecret),
      ),
      codeIs('V2_HOST_BOOTSTRAP_CONSUMED'),
    );

    const requestRows = await pool.query('SELECT * FROM coordination_v2_host_enrollment_requests');
    assert.equal(requestRows.rowCount, 1);
    assert.doesNotMatch(JSON.stringify(requestRows.rows), new RegExp(bootstrapSecret));
    assert.equal(
      Number((await pool.query('SELECT count(*) AS count FROM coordination_v2_host_enrollments')).rows[0].count),
      0,
    );
    assert.equal(
      Number((await pool.query('SELECT count(*) AS count FROM coordination_v2_host_credentials')).rows[0].count),
      0,
    );

    await pool.query(`
      INSERT INTO coordination_v2_host_enrollments (
        id, host_key, host_type, display_name, protocol_version, public_key,
        key_fingerprint, capabilities, enrollment_digest,
        enrollment_request_key, status, created_by
      ) VALUES ($1, $2, 'windows', $2, 1, $3, $4, $5, $6, $7, 'active', 'ci-first-host-test')
    `, [
      `host-${randomUUID()}`,
      winningInput.declaration.payload.hostId,
      winningInput.publicKey,
      winningInput.keyFingerprint,
      winningInput.capabilities,
      winningInput.declaration.payload.declarationDigest,
      winningInput.requestKey,
    ]);
    const later = await submitCoordinationV2HostEnrollmentRequest(
      hostInput('windows-later-host', `request-${randomUUID()}`),
    );
    assert.equal(later.created, true);
  } finally {
    await truncate();
    await pool.end();
    if (previousSecret === undefined) delete process.env.COORDINATION_V2_HOST_BOOTSTRAP_SECRET;
    else process.env.COORDINATION_V2_HOST_BOOTSTRAP_SECRET = previousSecret;
  }
});
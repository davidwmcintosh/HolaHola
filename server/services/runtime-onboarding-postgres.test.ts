import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test, { after } from 'node:test';

let openedServiceConnections = false;
after(async () => {
  if (openedServiceConnections) {
    const { closeDbConnections } = await import('../db');
    await closeDbConnections();
  }
});

function disposableTarget(): string | undefined {
  const url = process.env.COORDINATION_RUNTIME_TEST_DATABASE_URL;
  const required = process.env.COORDINATION_RUNTIME_REQUIRE_DATABASE_TESTS === '1';
  const sharedUrl = process.env.NEON_SHARED_DATABASE_URL;
  const forbiddenShared = process.env.COORDINATION_RUNTIME_FORBIDDEN_SHARED_URL;
  if (!url) {
    if (required) throw new Error('COORDINATION_RUNTIME_TEST_DATABASE_URL is required by the migration gate');
    return undefined;
  }
  if (process.env.COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE !== '1') {
    throw new Error('COORDINATION_RUNTIME_TEST_DATABASE_DISPOSABLE=1 is required');
  }
  if (!sharedUrl || sharedUrl !== url) {
    throw new Error('Runtime onboarding integration test requires the gate-provided disposable database URL');
  }
  if (!forbiddenShared || url === forbiddenShared) {
    throw new Error('Runtime onboarding integration test refuses the shared Neon database');
  }
  return url;
}

test('runtime onboarding PostgreSQL proof is atomic, recoverable, and revocation-safe', async (context) => {
  const databaseUrl = disposableTarget();
  if (!databaseUrl) {
    context.skip('requires COORDINATION_RUNTIME_TEST_DATABASE_URL from the disposable Neon branch gate');
    return;
  }
  openedServiceConnections = true;
  const pg = (await import('pg')).default;
  const {
    createRuntimeOnboardingChallenge,
    decideRuntimeOnboardingRequest,
    getRuntimeOnboardingAdminView,
    getRuntimeOnboardingRequestStatus,
    cancelRuntimeOnboardingInvitation,
    prepareRuntimeOnboardingInvitation,
    proveRuntimeOnboardingChallenge,
    recordOnboardedRuntimeLedgerRead,
    revokeOnboardedRuntime,
    submitRuntimeOnboardingRequest,
    RuntimeOnboardingError,
  } = await import('./runtime-onboarding-service');
  const { resolveBrokerCredential, renewBrokerCredential } =
    await import('./coordination-credential-broker');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const runtimeId = `onboarding-test-${crypto.randomUUID()}`;
  const deniedRuntimeId = `${runtimeId}-denied`;
  const cancelledRuntimeId = `${runtimeId}-cancelled`;
  const expiredRuntimeId = `${runtimeId}-expired`;
  const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const proofSignature = (payload: string) =>
    crypto.sign('RSA-SHA256', Buffer.from(payload, 'utf8'), keyPair.privateKey).toString('base64');
  const invitationIds: string[] = [];
  const requestIds: string[] = [];
  const preservedRuntimeId = `${runtimeId}-unrelated`;
  const runtimeIds = [runtimeId, deniedRuntimeId, cancelledRuntimeId, expiredRuntimeId, preservedRuntimeId];
  const originalEndpoint = process.env.COORDINATION_PUBLIC_ENDPOINT;
  const originalApprovedEndpoints = process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS;
  process.env.COORDINATION_PUBLIC_ENDPOINT = 'https://onboarding.integration.test';
  process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS =
    'https://onboarding.integration.test,https://alternate-onboarding.integration.test';
  try {
    // An independently owned active runtime/credential must survive revocation
    // of the enrolled fixture. These are disposable-branch-only sentinel rows.
    await client.query(
      `INSERT INTO coordination_runtime_registrations
       (id, actor, display_name, bootstrap_hash, capabilities)
       VALUES ($1, 'luca-cursor', 'Disposable unrelated sentinel', $2, ARRAY['coordination:read'])`,
      [preservedRuntimeId, crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex')],
    );
    await client.query(
      `INSERT INTO coordination_runtime_credentials
       (runtime_id, actor, token_hash, capabilities, expires_at)
       VALUES ($1, 'luca-cursor', $2, ARRAY['coordination:read'], now() + interval '1 hour')`,
      [preservedRuntimeId, crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex')],
    );
    const preservedBefore = await client.query(
      `SELECT to_jsonb(r) AS registration, to_jsonb(c) AS credential
       FROM coordination_runtime_registrations r
       JOIN coordination_runtime_credentials c ON c.runtime_id = r.id WHERE r.id = $1`,
      [preservedRuntimeId],
    );
    const adminView = await getRuntimeOnboardingAdminView();
    for (const actor of adminView.actors.filter(({ id }) => id === 'alden' || id === 'david')) {
      assert.equal(
        actor.capabilities.includes('coordination:runtime:admin'),
        false,
        `${actor.id} onboarding defaults must not copy runtime-admin`,
      );
    }
    const invitation = await prepareRuntimeOnboardingInvitation({
      invitation: {
        actor: 'luca-replit',
        runtimeId,
        displayName: 'Disposable onboarding runtime',
        capabilities: ['coordination:read', 'coordination:credential:renew'],
        clientType: 'http-cli',
      },
      preparedBy: 'alden',
    });
    invitationIds.push(invitation.id);
    const request = await submitRuntimeOnboardingRequest({ invitationId: invitation.id, publicKeyPem });
    requestIds.push(request.id);
    const retriedRequest = await submitRuntimeOnboardingRequest({
      invitationId: invitation.id,
      publicKeyPem,
    });
    assert.equal(retriedRequest.id, request.id, 'same invitation and proof key must replay the same safe request');
    assert.equal(retriedRequest.verificationCode, request.verificationCode);
    const differentKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const differentPublicKeyPem = differentKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    await assert.rejects(
      submitRuntimeOnboardingRequest({
        invitationId: invitation.id,
        publicKeyPem: differentPublicKeyPem,
      }),
      (error: unknown) => error instanceof RuntimeOnboardingError && error.code === 'CONFLICT',
      'a different proof key cannot take over an existing request',
    );
    await decideRuntimeOnboardingRequest({ requestId: request.id, decision: 'approve', founderActor: 'david' });
    const challenge = await createRuntimeOnboardingChallenge({
      requestId: request.id,
      purpose: 'enroll',
      endpoint: 'https://onboarding.integration.test',
    });
    const signatureBase64 = proofSignature(challenge.payload);
    process.env.COORDINATION_PUBLIC_ENDPOINT = 'https://alternate-onboarding.integration.test';
    await assert.rejects(
      proveRuntimeOnboardingChallenge({
        requestId: request.id,
        challengeId: challenge.challengeId,
        signatureBase64,
        endpoint: 'https://alternate-onboarding.integration.test',
      }),
      (error: unknown) => error instanceof RuntimeOnboardingError,
      'a different explicitly approved deployment cannot replay this challenge',
    );
    process.env.COORDINATION_PUBLIC_ENDPOINT = 'https://onboarding.integration.test';
    await assert.rejects(
      proveRuntimeOnboardingChallenge({
        requestId: request.id,
        challengeId: challenge.challengeId,
        signatureBase64: 'AA==',
        endpoint: 'https://onboarding.integration.test',
      }),
      (error: unknown) => error instanceof RuntimeOnboardingError,
    );
    const raced = await Promise.allSettled([
      proveRuntimeOnboardingChallenge({
        requestId: request.id,
        challengeId: challenge.challengeId,
        signatureBase64,
        endpoint: 'https://onboarding.integration.test',
      }),
      proveRuntimeOnboardingChallenge({
        requestId: request.id,
        challengeId: challenge.challengeId,
        signatureBase64,
        endpoint: 'https://onboarding.integration.test',
      }),
    ]);
    const winners = raced.filter((result) => result.status === 'fulfilled');
    const losers = raced.filter((result) => result.status === 'rejected');
    assert.equal(winners.length, 1, 'exactly one concurrent proof consumes and mints');
    assert.equal(losers.length, 1);
    const firstCredential = (winners[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof proveRuntimeOnboardingChallenge>>>).value;
    assert.equal(firstCredential.runtimeId, runtimeId);

    const evidenceBeforeLedgerRead = await getRuntimeOnboardingAdminView();
    const runtimeBeforeLedgerRead = evidenceBeforeLedgerRead.runtimes
      .find((runtime) => runtime.runtimeId === runtimeId);
    assert.deepEqual(runtimeBeforeLedgerRead?.connectionEvidence, {
      authenticatedLedgerAt: null,
      evidence: null,
    }, 'credential issuance/enrollment alone must not claim an authenticated ledger read');

    const originalBrokerCredential = await resolveBrokerCredential(firstCredential.accessToken);
    if (!originalBrokerCredential) throw new Error('Newly enrolled credential did not resolve');
    const renewedCredential = await renewBrokerCredential(originalBrokerCredential);
    if (!renewedCredential) throw new Error('Newly enrolled credential could not renew');
    const evidenceAfterRenewal = await getRuntimeOnboardingAdminView();
    const runtimeAfterRenewal = evidenceAfterRenewal.runtimes
      .find((runtime) => runtime.runtimeId === runtimeId);
    assert.deepEqual(runtimeAfterRenewal?.connectionEvidence, {
      authenticatedLedgerAt: null,
      evidence: null,
    }, 'credential use metadata and renewal alone must not claim a ledger read');

    const express = (await import('express')).default;
    const { createServer } = await import('node:http');
    const { registerCoordinationRoutes } = await import('../routes/coordination-routes');
    const ledgerApp = express();
    registerCoordinationRoutes(ledgerApp);
    const ledgerServer = createServer(ledgerApp);
    await new Promise<void>((resolve) => ledgerServer.listen(0, '127.0.0.1', resolve));
    const ledgerAddress = ledgerServer.address();
    if (!ledgerAddress || typeof ledgerAddress === 'string') {
      throw new Error('Could not bind the isolated ledger-read regression server');
    }
    try {
      const ledgerResponse = await fetch(
        `http://127.0.0.1:${ledgerAddress.port}/api/coordination/threads`,
        { headers: { 'x-coordination-token': renewedCredential.accessToken } },
      );
      assert.equal(ledgerResponse.status, 200);
      await ledgerResponse.json();
      let runtimeAfterLedgerRead = (await getRuntimeOnboardingAdminView()).runtimes
        .find((runtime) => runtime.runtimeId === runtimeId);
      const ledgerReadTimestamp = (runtime: Record<string, unknown> | undefined) =>
        (runtime?.connectionEvidence as { authenticatedLedgerAt?: string | null } | undefined)
          ?.authenticatedLedgerAt;
      for (let attempt = 0; attempt < 40 && !ledgerReadTimestamp(runtimeAfterLedgerRead); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        runtimeAfterLedgerRead = (await getRuntimeOnboardingAdminView()).runtimes
          .find((runtime) => runtime.runtimeId === runtimeId);
      }
      const successfulEvidence = runtimeAfterLedgerRead?.connectionEvidence as {
        authenticatedLedgerAt: string | null;
        evidence: string | null;
      } | undefined;
      assert.equal(successfulEvidence?.evidence, 'server_ledger_read');
      assert.ok(successfulEvidence?.authenticatedLedgerAt);
      const evidenceAudit = await client.query(
        `SELECT credential_id, success, metadata
         FROM coordination_credential_audit_events
         WHERE runtime_id = $1 AND event_type = 'runtime_onboarding_ledger_read'
         ORDER BY created_at DESC LIMIT 1`,
        [runtimeId],
      );
      assert.equal(evidenceAudit.rows[0]?.credential_id, renewedCredential.credential.credentialId);
      assert.equal(evidenceAudit.rows[0]?.success, true);
      assert.equal(evidenceAudit.rows[0]?.metadata?.evidence, 'server_ledger_read');
      const rejectedLedgerResponse = await fetch(
        `http://127.0.0.1:${ledgerAddress.port}/api/coordination/threads?actor=alden`,
        { headers: { 'x-coordination-token': renewedCredential.accessToken } },
      );
      assert.equal(rejectedLedgerResponse.status, 403);
      await rejectedLedgerResponse.json();
      const countAfterRejectedRead = await client.query(
        `SELECT count(*)::int AS count
         FROM coordination_credential_audit_events
         WHERE runtime_id = $1 AND event_type = 'runtime_onboarding_ledger_read' AND success = true`,
        [runtimeId],
      );
      assert.equal(countAfterRejectedRead.rows[0]?.count, 1, 'rejected reads must not add ledger evidence');

      // The service also rejects an invented credential reference even when the
      // caller supplies the correct runtime and actor. The HTTP request above is
      // the only path that supplies an identity resolved by broker authentication.
      await recordOnboardedRuntimeLedgerRead({
        runtimeId,
        actor: 'luca-replit',
        credentialId: 'client-reported-credential-id',
      });
      const evidenceCount = await client.query(
        `SELECT count(*)::int AS count
         FROM coordination_credential_audit_events
         WHERE runtime_id = $1 AND event_type = 'runtime_onboarding_ledger_read' AND success = true`,
        [runtimeId],
      );
      assert.equal(evidenceCount.rows[0]?.count, 1, 'unresolved credential IDs must not create ledger evidence');
    } finally {
      await new Promise<void>((resolve, reject) => ledgerServer.close((error) => error ? reject(error) : resolve()));
    }

    await client.query(
      `UPDATE coordination_runtime_onboarding_requests
       SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
       WHERE id = $1`,
      [request.id],
    );
    await client.query(
      `UPDATE coordination_runtime_onboarding_invitations
       SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
       WHERE id = $1`,
      [invitation.id],
    );
    assert.equal((await getRuntimeOnboardingRequestStatus(request.id)).state, 'enrolled');

    // Simulate a successful response lost before secure-store persistence:
    // the same approved proof key recovers via a distinct, one-use challenge.
    const recovery = await createRuntimeOnboardingChallenge({
      requestId: request.id,
      purpose: 'recover',
      endpoint: 'https://onboarding.integration.test',
    });
    const recoveredCredential = await proveRuntimeOnboardingChallenge({
      requestId: request.id,
      challengeId: recovery.challengeId,
      signatureBase64: proofSignature(recovery.payload),
      endpoint: 'https://onboarding.integration.test',
    });
    assert.notEqual(recoveredCredential.accessToken, firstCredential.accessToken);
    const prior = await client.query(
      `SELECT revoked_at FROM coordination_runtime_credentials WHERE id = $1`,
      [renewedCredential.credential.credentialId],
    );
    assert.ok(prior.rows[0]?.revoked_at, 'recovery revokes the abandoned renewed credential before replacement mint');

    const deniedInvitation = await prepareRuntimeOnboardingInvitation({
      invitation: {
        actor: 'luca-replit',
        runtimeId: deniedRuntimeId,
        displayName: 'Denied onboarding runtime',
        capabilities: ['coordination:read'],
      },
      preparedBy: 'alden',
    });
    invitationIds.push(deniedInvitation.id);
    const deniedKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const deniedPublicKeyPem = deniedKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const deniedRequest = await submitRuntimeOnboardingRequest({
      invitationId: deniedInvitation.id,
      publicKeyPem: deniedPublicKeyPem,
    });
    requestIds.push(deniedRequest.id);
    await decideRuntimeOnboardingRequest({
      requestId: deniedRequest.id,
      decision: 'deny',
      founderActor: 'david',
    });
    await assert.rejects(
      createRuntimeOnboardingChallenge({
        requestId: deniedRequest.id,
        purpose: 'enroll',
        endpoint: 'https://onboarding.integration.test',
      }),
      (error: unknown) => error instanceof RuntimeOnboardingError,
    );

    const cancelledInvitation = await prepareRuntimeOnboardingInvitation({
      invitation: {
        actor: 'luca-replit',
        runtimeId: cancelledRuntimeId,
        displayName: 'Cancelled onboarding runtime',
        capabilities: ['coordination:read'],
      },
      preparedBy: 'alden',
    });
    invitationIds.push(cancelledInvitation.id);
    const cancelledKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const cancelledPublicKeyPem = cancelledKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const cancelledRequest = await submitRuntimeOnboardingRequest({
      invitationId: cancelledInvitation.id,
      publicKeyPem: cancelledPublicKeyPem,
    });
    requestIds.push(cancelledRequest.id);
    await decideRuntimeOnboardingRequest({
      requestId: cancelledRequest.id,
      decision: 'approve',
      founderActor: 'david',
    });
    const cancelledChallenge = await createRuntimeOnboardingChallenge({
      requestId: cancelledRequest.id,
      purpose: 'enroll',
      endpoint: 'https://onboarding.integration.test',
    });
    assert.equal(await cancelRuntimeOnboardingInvitation({
      invitationId: cancelledInvitation.id,
      actor: 'david',
    }), true);
    await assert.rejects(
      proveRuntimeOnboardingChallenge({
        requestId: cancelledRequest.id,
        challengeId: cancelledChallenge.challengeId,
        signatureBase64: crypto.sign(
          'RSA-SHA256',
          Buffer.from(cancelledChallenge.payload, 'utf8'),
          cancelledKeyPair.privateKey,
        ).toString('base64'),
        endpoint: 'https://onboarding.integration.test',
      }),
      (error: unknown) => error instanceof RuntimeOnboardingError,
      'cancellation invalidates an already-created pending proof',
    );

    const expiredInvitation = await prepareRuntimeOnboardingInvitation({
      invitation: {
        actor: 'luca-replit',
        runtimeId: expiredRuntimeId,
        displayName: 'Expired onboarding runtime',
        capabilities: ['coordination:read'],
      },
      preparedBy: 'alden',
    });
    invitationIds.push(expiredInvitation.id);
    const expiredKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const expiredPublicKeyPem = expiredKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const expiredRequest = await submitRuntimeOnboardingRequest({
      invitationId: expiredInvitation.id,
      publicKeyPem: expiredPublicKeyPem,
    });
    requestIds.push(expiredRequest.id);
    await decideRuntimeOnboardingRequest({
      requestId: expiredRequest.id,
      decision: 'approve',
      founderActor: 'david',
    });
    await client.query(
      `UPDATE coordination_runtime_onboarding_requests
       SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
       WHERE id = $1`,
      [expiredRequest.id],
    );
    await client.query(
      `UPDATE coordination_runtime_onboarding_invitations
       SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
       WHERE id = $1`,
      [expiredInvitation.id],
    );
    await assert.rejects(
      createRuntimeOnboardingChallenge({
        requestId: expiredRequest.id,
        purpose: 'enroll',
        endpoint: 'https://onboarding.integration.test',
      }),
      (error: unknown) => error instanceof RuntimeOnboardingError,
      'an expired but unenrolled approval cannot start a proof ceremony',
    );

    assert.equal(await revokeOnboardedRuntime({ runtimeId, revokedByActor: 'david' }), true);
    const revokedRuntime = (await getRuntimeOnboardingAdminView()).runtimes
      .find((runtime) => runtime.runtimeId === runtimeId);
    assert.equal(revokedRuntime?.enabled, false);
    assert.ok(revokedRuntime?.revokedAt);
    assert.equal(
      (revokedRuntime?.connectionEvidence as { evidence?: string | null } | undefined)?.evidence,
      'server_ledger_read',
      'the snapshot retains only the historical server-read evidence after revocation',
    );
    assert.equal('connected' in (revokedRuntime ?? {}), false, 'historical evidence is not a connected status');
    const preservedAfter = await client.query(
      `SELECT to_jsonb(r) AS registration, to_jsonb(c) AS credential
       FROM coordination_runtime_registrations r
       JOIN coordination_runtime_credentials c ON c.runtime_id = r.id WHERE r.id = $1`,
      [preservedRuntimeId],
    );
    assert.deepEqual(preservedAfter.rows, preservedBefore.rows, 'revocation must preserve unrelated runtime and credential rows');
    await assert.rejects(
      createRuntimeOnboardingChallenge({
        requestId: request.id,
        purpose: 'recover',
        endpoint: 'https://onboarding.integration.test',
      }),
      (error: unknown) => error instanceof RuntimeOnboardingError,
    );
  } finally {
    // All writes are confined to the explicitly gate-provided disposable
    // branch. Remove test-owned enrollment state without touching other rows.
    for (const requestId of requestIds) {
      await client.query(
        'DELETE FROM coordination_runtime_onboarding_challenges WHERE request_id = $1',
        [requestId],
      );
      await client.query(
        'DELETE FROM coordination_runtime_onboarding_requests WHERE id = $1',
        [requestId],
      );
    }
    for (const invitationId of invitationIds) {
      await client.query(
        'DELETE FROM coordination_runtime_onboarding_invitations WHERE id = $1',
        [invitationId],
      );
    }
    for (const id of runtimeIds) {
      await client.query('DELETE FROM coordination_runtime_registrations WHERE id = $1', [id]);
    }
    await client.query(
      'DELETE FROM coordination_credential_audit_events WHERE runtime_id = ANY($1::varchar[])',
      [runtimeIds],
    );
    await client.end();
    if (originalEndpoint === undefined) delete process.env.COORDINATION_PUBLIC_ENDPOINT;
    else process.env.COORDINATION_PUBLIC_ENDPOINT = originalEndpoint;
    if (originalApprovedEndpoints === undefined) {
      delete process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS;
    } else {
      process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS = originalApprovedEndpoints;
    }
  }
});

test('runtime onboarding database suite refuses an ambient shared URL when the gate requires coverage', () => {
  const source = process.env.COORDINATION_RUNTIME_REQUIRE_DATABASE_TESTS === '1'
    ? disposableTarget()
    : undefined;
  if (process.env.COORDINATION_RUNTIME_REQUIRE_DATABASE_TESTS === '1') {
    assert.equal(source, process.env.COORDINATION_RUNTIME_TEST_DATABASE_URL);
  }
});
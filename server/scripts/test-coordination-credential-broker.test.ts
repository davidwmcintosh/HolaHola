import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import {
  coordinationCredentialAuditEvents,
  coordinationRuntimeCredentials,
  coordinationRuntimeRegistrations,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  exchangeBootstrapCredential,
  registerCoordinationRuntime,
  registerCoordinationRuntimeWithBootstrapSha256,
  hashCoordinationSecret,
  renewBrokerCredential,
  resolveBrokerCredential,
  revokeBrokerCredential,
  revokeRuntimeCredentials,
} from '../services/coordination-credential-broker';

const hasDisposableDatabase = Boolean(
  getVerifiedCiDatabaseUrl() || process.env.COORDINATION_INBOX_DISPOSABLE_BRANCH_ID,
);
const databaseTest = hasDisposableDatabase ? test : test.skip;
const runtimeId = `credential-broker-${Date.now()}`;
const revocationRaceRuntimeId = `${runtimeId}-revocation-race`;
const prehashedRuntimeId = `${runtimeId}-prehashed`;

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

after(async () => {
  if (!hasDisposableDatabase) return;
  await getSharedDb().delete(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, revocationRaceRuntimeId));
  await getSharedDb().delete(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, runtimeId));
  await getSharedDb().delete(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, prehashedRuntimeId));
  await getSharedDb().delete(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, revocationRaceRuntimeId));
  await getSharedDb().delete(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, runtimeId));
  await getSharedDb().delete(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, prehashedRuntimeId));
  await closeDbConnections();
});

databaseTest('trusted prehashed registration is strict, retry-safe, and never returns or audits secrets', async () => {
  const bootstrap = `cb_${crypto.randomBytes(32).toString('base64url')}`;
  const digest = hashCoordinationSecret(bootstrap);
  const input: Parameters<typeof registerCoordinationRuntimeWithBootstrapSha256>[0] = {
    runtimeId: prehashedRuntimeId,
    actor: 'luca-replit',
    displayName: 'Prehashed broker CI runtime',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
    bootstrapSha256: digest,
  };

  const created = await registerCoordinationRuntimeWithBootstrapSha256(input);
  assert.equal(created.status, 'created');
  assert.equal(JSON.stringify(created).includes(digest), false);
  assert.equal(JSON.stringify(created).includes(bootstrap), false);

  const captureError = async (operation: () => Promise<unknown>): Promise<unknown> => {
    let caught: unknown;
    try {
      await operation();
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, 'expected operation to reject');
    return caught;
  };
  assert.equal(await exchangeBootstrapCredential(prehashedRuntimeId, digest), null);

  const replayed = await registerCoordinationRuntimeWithBootstrapSha256(input);
  assert.equal(replayed.status, 'replayed');
  assert.deepEqual(replayed, { ...created, status: 'replayed' });
  assert.ok(await exchangeBootstrapCredential(prehashedRuntimeId, bootstrap));

  for (const invalidDigest of [
    digest.toUpperCase(),
    digest.slice(0, 63),
    `${digest}0`,
    `${digest.slice(0, 63)}g`,
  ]) {
    const error = await captureError(
      () => registerCoordinationRuntimeWithBootstrapSha256({ ...input, bootstrapSha256: invalidDigest }),
    );
    assert.match(String(error), /lowercase hexadecimal SHA-256/);
    assert.equal(String(error).includes(bootstrap), false);
    assert.equal(String(error).includes(digest), false);
  }

  const conflictError = await captureError(() => registerCoordinationRuntimeWithBootstrapSha256({
      ...input,
      actor: 'luca-claude-code',
    }));
  assert.match(String(conflictError), /conflicts with an existing record/);
  assert.equal(String(conflictError).includes(bootstrap), false);
  assert.equal(String(conflictError).includes(digest), false);
  const events = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, prehashedRuntimeId));
  const serializedEvents = JSON.stringify(events);
  assert.equal(serializedEvents.includes(bootstrap), false);
  assert.equal(serializedEvents.includes(digest), false);
  assert.equal(events.some((event) => event.eventType === 'runtime_registration_replayed'), true);
  assert.equal(events.some((event) => event.eventType === 'runtime_registration_rejected'), true);
});

databaseTest('broker issues, rotates, expires from use, revokes, and audits without plaintext storage', async () => {
  const { bootstrapToken } = await registerCoordinationRuntime({
    runtimeId,
    actor: 'luca-replit',
    displayName: 'Credential broker CI runtime',
    capabilities: ['coordination:read', 'coordination:credential:renew', 'coordination:credential:revoke'],
    tokenTtlSeconds: 60,
  });
  await assert.rejects(
    () => registerCoordinationRuntime({
      runtimeId,
      actor: 'luca-claude-code',
      displayName: 'Attempted actor rebind',
      capabilities: ['coordination:read'],
    }),
  );

  assert.equal(await exchangeBootstrapCredential(runtimeId, 'wrong-bootstrap'), null);
  const issued = await exchangeBootstrapCredential(runtimeId, bootstrapToken);
  assert.ok(issued);
  assert.equal(issued.credential.actor, 'luca-replit');
  assert.deepEqual(issued.credential.capabilities, [
    'coordination:read',
    'coordination:credential:renew',
    'coordination:credential:revoke',
  ]);

  const [registration] = await getSharedDb().select().from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, runtimeId));
  assert.notEqual(registration.bootstrapHash, bootstrapToken);

  const [storedCredential] = await getSharedDb().select().from(coordinationRuntimeCredentials)
    .where(eq(coordinationRuntimeCredentials.id, issued.credential.credentialId));
  assert.notEqual(storedCredential.tokenHash, issued.accessToken);
  assert.equal(JSON.stringify(storedCredential).includes(issued.accessToken), false);

  const resolved = await resolveBrokerCredential(issued.accessToken);
  assert.equal(resolved?.runtimeId, runtimeId);

  const renewalAttempts = await Promise.all([
    renewBrokerCredential(issued.credential),
    renewBrokerCredential(issued.credential),
  ]);
  const successfulRenewals = renewalAttempts.filter((value) => value !== null);
  assert.equal(successfulRenewals.length, 1, 'concurrent renewal must mint exactly one successor');
  const renewed = successfulRenewals[0]!;
  assert.notEqual(renewed.accessToken, issued.accessToken);
  assert.equal(await resolveBrokerCredential(issued.accessToken), null);
  assert.equal((await resolveBrokerCredential(renewed.accessToken))?.actor, 'luca-replit');

  await revokeBrokerCredential(renewed.credential);
  assert.equal(await resolveBrokerCredential(renewed.accessToken), null);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, runtimeId));
  assert.equal(auditEvents.some((event) => event.eventType === 'issued' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'renewed' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'revoked' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'exchange_failed' && !event.success), true);
});

const verifiedDisposableDatabaseTest = getVerifiedCiDatabaseUrl() ? test : test.skip;

verifiedDisposableDatabaseTest(
  'runtime revocation cannot leave an issued credential usable after an overlapping bootstrap exchange',
  async () => {
    const { bootstrapToken } = await registerCoordinationRuntime({
      runtimeId: revocationRaceRuntimeId,
      actor: 'luca-replit',
      displayName: 'Credential broker revocation race CI runtime',
      capabilities: ['coordination:read'],
      tokenTtlSeconds: 60,
    });
    const exchangePaused = deferred();
    const releaseExchange = deferred();

    const exchangePromise = exchangeBootstrapCredential(
      revocationRaceRuntimeId,
      bootstrapToken,
      undefined,
      {
        afterRegistrationLocked: async () => {
          exchangePaused.resolve();
          await releaseExchange.promise;
        },
      },
    );
    await exchangePaused.promise;

    const revocationPromise = revokeRuntimeCredentials(
      revocationRaceRuntimeId,
      'luca-replit',
    );
    const revocationFinishedBeforeRelease = await Promise.race([
      revocationPromise.then(() => true),
      new Promise<false>((resolve) => {
        setTimeout(() => resolve(false), 1_000);
      }),
    ]);
    releaseExchange.resolve();
    const [issued, revoked] = await Promise.all([exchangePromise, revocationPromise]);
    assert.equal(
      revocationFinishedBeforeRelease,
      false,
      'runtime revocation must wait while bootstrap exchange holds the registration lock',
    );

    assert.ok(issued, 'the lock-winning exchange should return its credential before revocation commits');
    assert.equal(revoked, true);

    const [registration] = await getSharedDb().select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, revocationRaceRuntimeId));
    assert.equal(registration.enabled, false);
    assert.ok(registration.revokedAt);
    await getSharedDb().update(coordinationRuntimeCredentials)
      .set({ revokedAt: null })
      .where(eq(coordinationRuntimeCredentials.id, issued.credential.credentialId));
    assert.equal(
      await resolveBrokerCredential(issued.accessToken),
      null,
      'a credential returned by the overlapping exchange must not authenticate through a revoked registration',
    );

    const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
      .where(eq(coordinationCredentialAuditEvents.runtimeId, revocationRaceRuntimeId));
    assert.equal(
      auditEvents.some((event) => event.eventType === 'runtime_revoked' && event.success),
      true,
      'runtime revocation must be audited',
    );
    assert.equal(
      auditEvents.some((event) => (
        event.eventType === 'access_failed'
        && !event.success
        && event.reason === 'revoked'
        && event.credentialId === issued.credential.credentialId
      )),
      true,
      'denied use of the returned credential must be audited as revoked',
    );
  },
);
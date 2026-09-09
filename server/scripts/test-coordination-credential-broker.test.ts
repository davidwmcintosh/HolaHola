import assert from 'node:assert/strict';
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
  await getSharedDb().delete(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, revocationRaceRuntimeId));
  await getSharedDb().delete(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, runtimeId));
  await closeDbConnections();
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
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import {
  coordinationCredentialAuditEvents,
  coordinationRuntimeRegistrations,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  exchangeBootstrapCredential,
  registerCoordinationRuntime,
} from '../services/coordination-credential-broker';
import { resolveCoordinationCapability } from './coordination-auth';

const run = Date.now();
const permittedRuntimeId = `observer-capability-${run}`;
const deniedRuntimeId = `observer-no-capability-${run}`;
const hasDisposableDatabase = Boolean(
  getVerifiedCiDatabaseUrl() || process.env.COORDINATION_INBOX_DISPOSABLE_BRANCH_ID,
);
const databaseTest = hasDisposableDatabase ? test : test.skip;
const lucaActors = ['luca-replit', 'luca-claude-code', 'luca-gemini', 'luca-holahola'] as const;

after(async () => {
  if (!hasDisposableDatabase) return;
  await getSharedDb().delete(coordinationRuntimeRegistrations)
    .where(inArray(coordinationRuntimeRegistrations.id, [permittedRuntimeId, deniedRuntimeId]));
  await getSharedDb().delete(coordinationCredentialAuditEvents)
    .where(inArray(coordinationCredentialAuditEvents.runtimeId, [permittedRuntimeId, deniedRuntimeId]));
  await closeDbConnections();
});

databaseTest('broker Luca credential requires observation:read and audits denial', async () => {
  const permittedBootstrap = await registerCoordinationRuntime({
    runtimeId: permittedRuntimeId,
    actor: 'luca-claude-code',
    displayName: 'Observer capability test',
    capabilities: ['coordination:read', 'observation:read'],
    tokenTtlSeconds: 60,
  });
  const deniedBootstrap = await registerCoordinationRuntime({
    runtimeId: deniedRuntimeId,
    actor: 'luca-claude-code',
    displayName: 'Observer denial test',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
  });
  const permitted = await exchangeBootstrapCredential(permittedRuntimeId, permittedBootstrap.bootstrapToken);
  const denied = await exchangeBootstrapCredential(deniedRuntimeId, deniedBootstrap.bootstrapToken);
  assert.ok(permitted);
  assert.ok(denied);

  const allowedResolution = await resolveCoordinationCapability(
    permitted.accessToken,
    'observation:read',
    lucaActors,
  );
  assert.equal(allowedResolution.ok, true);
  if (allowedResolution.ok) assert.equal(allowedResolution.authType, 'broker');

  const deniedResolution = await resolveCoordinationCapability(
    denied.accessToken,
    'observation:read',
    lucaActors,
  );
  assert.deepEqual(deniedResolution, {
    ok: false,
    status: 403,
    error: 'Credential lacks required capability: observation:read',
  });

  const audits = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, deniedRuntimeId));
  assert.equal(audits.some(event =>
    event.eventType === 'access_failed'
    && event.reason === 'insufficient_capability'
    && (event.metadata as Record<string, unknown>)?.requiredCapability === 'observation:read'
  ), true);
});
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { and, eq, inArray } from 'drizzle-orm';
import {
  coordinationCredentialAuditEvents,
  coordinationRuntimeCredentials,
  coordinationRuntimeRegistrations,
  conversations,
  users,
  voicePipelineEvents,
  voiceSessions,
} from '@shared/schema';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { closeDbConnections, getSharedDb } from '../db';
import {
  hashCoordinationSecret,
} from '../services/coordination-credential-broker';
import {
  requireFounderOrCoordinationCapability,
} from '../middleware/coordination-auth';
import { registerLucaObserverRoute } from '../routes/luca-observer-route';
import {
  observeSessionEnd,
  observeSessionStart,
} from '../services/session-observation-store';

const hasDisposableDatabase = Boolean(getVerifiedCiDatabaseUrl());
const databaseTest = hasDisposableDatabase ? test : test.skip;
const prefix = `luca-observe-route-${Date.now()}`;
const founderId = '49847136';
const studentId = `${prefix}-student`;
const conversationId = `${prefix}-conversation`;
const targetSessionId = `${prefix}-target-session`;
const adjacentSessionId = `${prefix}-adjacent-session`;
const targetEventId = `${prefix}-target-event`;
const adjacentEventId = `${prefix}-adjacent-event`;
const validBrokerFixture = {
  runtimeId: `${prefix}-valid-runtime`,
  credentialId: `${prefix}-valid-credential`,
  token: `${prefix}-valid-token-${'x'.repeat(40)}`,
  expiresAt: new Date(Date.now() + 10 * 60_000),
  revokedAt: null,
} as const;

const brokerFixtures = [
  {
    runtimeId: `${prefix}-expired-runtime`,
    credentialId: `${prefix}-expired-credential`,
    token: `${prefix}-expired-token-${'x'.repeat(40)}`,
    expiresAt: new Date(Date.now() - 60_000),
    revokedAt: null,
    expectedEventType: 'expired',
    expectedReason: 'expired',
  },
  {
    runtimeId: `${prefix}-revoked-runtime`,
    credentialId: `${prefix}-revoked-credential`,
    token: `${prefix}-revoked-token-${'x'.repeat(40)}`,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: new Date(Date.now() - 30_000),
    expectedEventType: 'access_failed',
    expectedReason: 'revoked',
  },
] as const;

let server: Server;
let baseUrl = '';

const loadAuthenticatedUser = () => (_req: any, _res: any, next: () => void) => next();
const requireFounder = (req: any, res: any, next: () => void) => {
  if (req.user?.claims?.sub === founderId) return next();
  return res.status(401).json({ error: 'Founder authentication required' });
};

async function request(
  path: string,
  options: { founder?: boolean; token?: string } = {},
): Promise<{ status: number; body: Record<string, any> }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.founder) headers['x-ci-founder-session'] = 'active';
  if (options.token) headers['x-coordination-token'] = options.token;
  const response = await fetch(`${baseUrl}${path}`, { headers });
  return {
    status: response.status,
    body: await response.json() as Record<string, any>,
  };
}

before(async () => {
  if (!hasDisposableDatabase) return;
  const db = getSharedDb();
  await db.insert(users).values([
    { id: founderId, email: `${prefix}-founder@example.invalid`, role: 'admin', isTestAccount: true },
    { id: studentId, email: `${prefix}-student@example.invalid`, role: 'student', isTestAccount: true },
  ]).onConflictDoNothing();
  await db.insert(conversations).values({
    id: conversationId,
    userId: studentId,
    language: 'Spanish',
    nativeLanguage: 'English',
    difficulty: 'novice_low',
  });
  await db.insert(voiceSessions).values([
    {
      id: adjacentSessionId,
      userId: studentId,
      conversationId,
      language: 'Spanish',
      status: 'active',
      startedAt: new Date(Date.now() - 120_000),
      guardianFires: 1,
      guardianHardWalls: 0,
      guardianHeard: 0,
      guardianMissed: 1,
      guardianCarryForward: 1,
    },
    {
      id: targetSessionId,
      userId: studentId,
      conversationId,
      language: 'Spanish',
      status: 'active',
      startedAt: new Date(Date.now() - 60_000),
      guardianFires: 1,
      guardianHardWalls: 1,
      guardianHeard: 1,
      guardianMissed: 0,
      guardianCarryForward: 0,
    },
  ]);
  await db.insert(voicePipelineEvents).values([
    {
      id: adjacentEventId,
      sessionId: adjacentSessionId,
      userId: studentId,
      eventType: 'gl_guardian_fire',
      eventData: {
        conversationId,
        path: 'carry-forward-buffered',
        outcome: 'missed',
        phrase: 'adjacent session evidence',
        attemptId: `${prefix}-adjacent-attempt`,
      },
      createdAt: new Date(Date.now() - 90_000),
    },
    {
      id: targetEventId,
      sessionId: targetSessionId,
      userId: studentId,
      eventType: 'gl_guardian_fire',
      eventData: {
        conversationId,
        path: 'hard-wall',
        outcome: 'heard',
        phrase: 'target session evidence',
        attemptId: `${prefix}-target-attempt`,
      },
      createdAt: new Date(Date.now() - 30_000),
    },
  ]);

  for (const fixture of [validBrokerFixture, ...brokerFixtures]) {
    await db.insert(coordinationRuntimeRegistrations).values({
      id: fixture.runtimeId,
      actor: 'luca-replit',
      displayName: fixture.runtimeId,
      bootstrapHash: hashCoordinationSecret(`${fixture.runtimeId}-bootstrap`),
      capabilities: ['observation:read'],
      tokenTtlSeconds: 900,
    });
    await db.insert(coordinationRuntimeCredentials).values({
      id: fixture.credentialId,
      runtimeId: fixture.runtimeId,
      actor: 'luca-replit',
      tokenHash: hashCoordinationSecret(fixture.token),
      capabilities: ['observation:read'],
      expiresAt: fixture.expiresAt,
      revokedAt: fixture.revokedAt,
    });
  }

  const app = express();
  app.use((req: any, _res, next) => {
    if (req.get('x-ci-founder-session') === 'active') {
      req.user = { claims: { sub: founderId, email: `${prefix}-founder@example.invalid` } };
    }
    next();
  });
  registerLucaObserverRoute({
    app,
    storage: {},
    getSharedDb,
    loadAuthenticatedUser,
    requireFounderOrCoordinationCapability,
    requireFounder,
  });
  app.get('/api/admin/luca-session-view', requireFounder, (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/api/agent/sprints', (req, res) => {
    if (req.get('x-agent-token') === 'test-agent-token') return res.json({ ok: true });
    return res.status(401).json({ error: 'Agent authentication required' });
  });
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (!hasDisposableDatabase) return;
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  await closeDbConnections();
});

databaseTest('founder browser access reaches the real observer route and DB-only evidence is exact-session scoped', async () => {
  const response = await request(
    `/api/admin/luca/observe?conversationId=${encodeURIComponent(conversationId)}`,
    { founder: true },
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'db_only');
  assert.equal(response.body.session.conversationId, conversationId);
  assert.deepEqual(response.body.guardianEvidence.authoritative, {
    fires: 1,
    hardWalls: 1,
    heard: 1,
    missed: 0,
    pending: 0,
    carryForward: 0,
  });
  assert.equal(response.body.guardianEvidence.source, 'voice_pipeline_events');
  assert.equal(response.body.guardianEvidence.summaryState, 'complete');
  assert.deepEqual(response.body.guardianEvidence.discrepancy, {
    fires: 0,
    hardWalls: 0,
    heard: 0,
    missed: 0,
    carryForward: 0,
  });
  assert.deepEqual(
    response.body.guardianEvidence.recentEvents.map((event: { id: string }) => event.id),
    [targetEventId],
    'a second session sharing the conversation must not leak its Guardian event',
  );
});

databaseTest('an active in-memory observation remains bound to its exact DB session', async () => {
  observeSessionStart({
    conversationId,
    dbSessionId: targetSessionId,
    transientSessionId: `${prefix}-transient-session`,
    userId: studentId,
    language: 'Spanish',
    actflLevel: 'novice_low',
  });
  try {
    const response = await request(
      `/api/admin/luca/observe?conversationId=${encodeURIComponent(conversationId)}`,
      { founder: true },
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'active');
    assert.equal(response.body.conversationId, conversationId);
    assert.deepEqual(
      response.body.guardianEvidence.recentEvents.map((event: { id: string }) => event.id),
      [targetEventId],
      'active recovery must not mix a known adjacent session into Guardian evidence',
    );
    assert.equal(response.body.guardianEvidence.summaryState, 'complete');
  } finally {
    observeSessionEnd(conversationId);
  }
});

databaseTest('a valid Luca broker credential reaches the real observer route', async () => {
  const response = await request(
    `/api/admin/luca/observe?conversationId=${encodeURIComponent(conversationId)}`,
    { token: validBrokerFixture.token },
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'db_only');
  assert.equal(response.body.session.conversationId, conversationId);
  assert.deepEqual(
    response.body.guardianEvidence.recentEvents.map((event: { id: string }) => event.id),
    [targetEventId],
  );
});

databaseTest('expired and revoked broker credentials are rejected and audited by the real observer route', async () => {
  for (const fixture of brokerFixtures) {
    const response = await request('/api/admin/luca/observe', { token: fixture.token });
    assert.equal(response.status, 401);
    assert.equal(typeof response.body.error, 'string');
  }

  const audits = await getSharedDb().select({
    eventType: coordinationCredentialAuditEvents.eventType,
    runtimeId: coordinationCredentialAuditEvents.runtimeId,
    reason: coordinationCredentialAuditEvents.reason,
    success: coordinationCredentialAuditEvents.success,
  }).from(coordinationCredentialAuditEvents)
    .where(inArray(
      coordinationCredentialAuditEvents.runtimeId,
      brokerFixtures.map(fixture => fixture.runtimeId),
    ));

  for (const fixture of brokerFixtures) {
    assert.ok(audits.some(audit =>
      audit.runtimeId === fixture.runtimeId
      && audit.eventType === fixture.expectedEventType
      && audit.reason === fixture.expectedReason
      && audit.success === false
    ), `${fixture.expectedReason} observer denial must be audited`);
  }
});

databaseTest('observer authorization does not widen adjacent founder or agent routes', async () => {
  const founderOnly = await request('/api/admin/luca-session-view', {
    token: validBrokerFixture.token,
  });
  assert.equal(founderOnly.status, 401);

  const agentOnly = await request('/api/agent/sprints', { founder: true });
  assert.equal(agentOnly.status, 401);

  const observer = await request(
    `/api/admin/luca/observe?conversationId=${encodeURIComponent(conversationId)}`,
    { token: validBrokerFixture.token },
  );
  assert.equal(observer.status, 200);
});

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { desc, eq, inArray } from 'drizzle-orm';
import {
  coordinationActorFeedCursors,
  coordinationEvents,
  coordinationThreads,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { registerCoordinationRoutes } from '../routes/coordination-routes';

const TOKENS = {
  'luca-holahola': 'route-hola-token-'.repeat(3),
  alden: 'route-alden-token-'.repeat(3),
  daniela: 'route-daniela-token-'.repeat(3),
} as const;

const TOKEN_ENVIRONMENT = {
  COORDINATION_LUCA_HOLAHOLA_TOKEN: TOKENS['luca-holahola'],
  COORDINATION_ALDEN_TOKEN: TOKENS.alden,
  COORDINATION_DANIELA_TOKEN: TOKENS.daniela,
} as const;

const testPrefix = `coordination-route-auth-${Date.now()}`;
const createKey = `${testPrefix}-create`;
const forbiddenKeys = [
  `${testPrefix}-hola-accept`,
  `${testPrefix}-hola-complete`,
  `${testPrefix}-alden-reassign`,
  `${testPrefix}-daniela-reassign`,
  `${testPrefix}-daniela-create`,
];

const app = express();
app.use(express.json());
registerCoordinationRoutes(app);

let server: Server;
let baseUrl: string;
let threadId: string;
const previousEnvironment = new Map<string, string | undefined>();

async function startServer(): Promise<void> {
  await new Promise<void>((resolve) => {
    server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function post(
  path: string,
  actor: keyof typeof TOKENS,
  idempotencyKey: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-coordination-token': TOKENS[actor],
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

async function postUnauthenticatedAck(
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (token !== undefined) headers['x-coordination-token'] = token;

  const response = await fetch(`${baseUrl}/api/coordination/threads/ack`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ globalSequence: 1, actor: 'alden' }),
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

async function getUnauthenticatedFeed(
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (token !== undefined) headers['x-coordination-token'] = token;

  const response = await fetch(`${baseUrl}/api/coordination/threads`, { headers });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

async function get(
  path: string,
  actor: keyof typeof TOKENS,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: 'application/json',
      'x-coordination-token': TOKENS[actor],
    },
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

before(async () => {
  for (const [name, value] of Object.entries(TOKEN_ENVIRONMENT)) {
    previousEnvironment.set(name, process.env[name]);
    process.env[name] = value;
  }
  await startServer();

  const created = await post('/api/coordination/threads', 'luca-holahola', createKey, {
    title: `HTTP authorization regression ${testPrefix}`,
    description: 'A route-level test thread for forbidden actor mutations.',
    intendedRecipient: 'alden',
  });
  assert.equal(created.status, 201);
  assert.equal(typeof created.body.thread, 'object');
  threadId = (created.body.thread as { id: string }).id;

  const route = `/api/coordination/threads/${encodeURIComponent(threadId)}`;
  const accepted = await post(`${route}/accept`, 'alden', `${testPrefix}-alden-accept`, {
    expectedSequence: 1,
  });
  assert.equal(accepted.status, 201);

  const delegated = await post(`${route}/reassign`, 'alden', `${testPrefix}-alden-delegate`, {
    expectedSequence: 2,
    recipientActor: 'daniela',
  });
  assert.equal(delegated.status, 201);

  const danielaAccepted = await post(`${route}/accept`, 'daniela', `${testPrefix}-daniela-accept`, {
    expectedSequence: 3,
  });
  assert.equal(danielaAccepted.status, 201);
});


after(async () => {
  await stopServer();
  if (threadId) {
    await getSharedDb().delete(coordinationThreads).where(eq(coordinationThreads.id, threadId));
  }
  await closeDbConnections();
  for (const [name, value] of previousEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('dedicated actor credentials cannot bypass route-level mutation permissions', async () => {
  const route = `/api/coordination/threads/${encodeURIComponent(threadId)}`;

  const attempts = [
    {
      label: 'HolaHola accept',
      actor: 'luca-holahola' as const,
      key: forbiddenKeys[0],
      path: `${route}/accept`,
      body: { expectedSequence: 1 },
    },
    {
      label: 'HolaHola complete',
      actor: 'luca-holahola' as const,
      key: forbiddenKeys[1],
      path: `${route}/complete`,
      body: {
        expectedSequence: 1,
        evidence: [{
          type: 'commit',
          provider: 'github',
          identifier: 'a'.repeat(40),
        }],
      },
    },
    {
      label: 'Alden reassign while not owner',
      actor: 'alden' as const,
      key: forbiddenKeys[2],
      path: `${route}/reassign`,
      body: { expectedSequence: 4, recipientActor: 'luca-holahola' },
    },
    {
      label: 'Daniela reassign',
      actor: 'daniela' as const,
      key: forbiddenKeys[3],
      path: `${route}/reassign`,
      body: { expectedSequence: 4, recipientActor: 'luca-holahola' },
    },
    {
      label: 'Daniela create',
      actor: 'daniela' as const,
      key: forbiddenKeys[4],
      path: '/api/coordination/threads',
      body: {
        title: 'Daniela must not originate threads',
        description: 'This request must be rejected at the HTTP boundary.',
        intendedRecipient: 'alden',
      },
    },
  ];

  for (const attempt of attempts) {
    const response = await post(attempt.path, attempt.actor, attempt.key, attempt.body);
    assert.equal(response.status, 403, `${attempt.label} must return HTTP 403`);
    assert.equal(
      typeof response.body.error,
      'string',
      `${attempt.label} should explain why the mutation was rejected`,
    );
  }

  const events = await getSharedDb()
    .select({ id: coordinationEvents.id, idempotencyKey: coordinationEvents.idempotencyKey })
    .from(coordinationEvents)
    .where(inArray(coordinationEvents.idempotencyKey, forbiddenKeys));
  assert.deepEqual(
    events,
    [],
    'forbidden HTTP mutations must not write coordination event rows',
  );

  const threadEvents = await getSharedDb()
    .select({ id: coordinationEvents.id })
    .from(coordinationEvents)
    .where(eq(coordinationEvents.threadId, threadId));
  assert.equal(
    threadEvents.length,
    4,
    'the test thread should still contain only its four valid setup events',
  );
});

test('unauthenticated feed acknowledgements cannot create or mutate cursors', async () => {
  const db = getSharedDb();
  const requestedActor = 'alden' as const;
  const [originalCursor] = await db
    .select()
    .from(coordinationActorFeedCursors)
    .where(eq(coordinationActorFeedCursors.actor, requestedActor));

  const attempts = [
    { label: 'missing token', token: undefined },
    { label: 'invalid token', token: 'invalid-coordination-token' },
  ];

  for (const attempt of attempts) {
    const response = await postUnauthenticatedAck(attempt.token);
    assert.equal(response.status, 401, `${attempt.label} must return HTTP 401`);
    assert.equal(
      typeof response.body.error,
      'string',
      `${attempt.label} should explain why authentication was rejected`,
    );

    const [currentCursor] = await db
      .select()
      .from(coordinationActorFeedCursors)
      .where(eq(coordinationActorFeedCursors.actor, requestedActor));
    assert.deepEqual(
      currentCursor ?? null,
      originalCursor ?? null,
      `${attempt.label} must not create or change the cursor named by the request`,
    );
  }
});

test('unauthenticated feed reads cannot expose coordination data', async () => {
  const attempts = [
    { label: 'missing token', token: undefined },
    { label: 'invalid token', token: 'invalid-coordination-token' },
  ];

  for (const attempt of attempts) {
    const response = await getUnauthenticatedFeed(attempt.token);
    assert.equal(response.status, 401, `${attempt.label} must return HTTP 401`);
    assert.deepEqual(
      Object.keys(response.body),
      ['error'],
      `${attempt.label} response must contain only the authentication error`,
    );
    assert.equal(typeof response.body.error, 'string');
    assert.equal('threads' in response.body, false);
    assert.equal('cursor' in response.body, false);
  }
});

test('authenticated feed acknowledgements stay actor-scoped and monotonic', async () => {
  const db = getSharedDb();
  const actors = ['luca-holahola', 'alden'] as const;
  const originalCursors = await db
    .select()
    .from(coordinationActorFeedCursors)
    .where(inArray(coordinationActorFeedCursors.actor, [...actors]));

  try {
    const [latestEvent] = await db
      .select({ globalSequence: coordinationEvents.globalSequence })
      .from(coordinationEvents)
      .orderBy(desc(coordinationEvents.globalSequence))
      .limit(1);
    assert.ok(latestEvent, 'the authenticated route setup must create a feed event');
    assert.ok(latestEvent.globalSequence > 0);

    const firstActorCursor = latestEvent.globalSequence;
    const secondActorCursor = firstActorCursor - 1;

    const firstAcknowledgement = await post(
      '/api/coordination/threads/ack',
      'luca-holahola',
      `${testPrefix}-hola-feed-high`,
      {
        globalSequence: firstActorCursor,
        actor: 'alden',
      },
    );
    assert.equal(firstAcknowledgement.status, 200);
    assert.equal(firstAcknowledgement.body.actor, 'luca-holahola');
    assert.equal(firstAcknowledgement.body.acknowledgedGlobalSequence, firstActorCursor);

    const secondAcknowledgement = await post(
      '/api/coordination/threads/ack',
      'alden',
      `${testPrefix}-alden-feed`,
      {
        globalSequence: secondActorCursor,
        actor: 'luca-holahola',
      },
    );
    assert.equal(secondAcknowledgement.status, 200);
    assert.equal(secondAcknowledgement.body.actor, 'alden');
    assert.equal(secondAcknowledgement.body.acknowledgedGlobalSequence, secondActorCursor);

    const firstFeed = await get('/api/coordination/threads', 'luca-holahola');
    assert.equal(firstFeed.status, 200);
    assert.equal(firstFeed.body.actor, 'luca-holahola');
    assert.equal(
      (firstFeed.body.cursor as { acknowledged: number }).acknowledged,
      firstActorCursor,
      'the first actor must see only its own acknowledged cursor',
    );

    const secondFeed = await get('/api/coordination/threads', 'alden');
    assert.equal(secondFeed.status, 200);
    assert.equal(secondFeed.body.actor, 'alden');
    assert.equal(
      (secondFeed.body.cursor as { acknowledged: number }).acknowledged,
      secondActorCursor,
      'the second actor must see only its own acknowledged cursor',
    );

    const staleAcknowledgement = await post(
      '/api/coordination/threads/ack',
      'luca-holahola',
      `${testPrefix}-hola-feed-stale`,
      {
        globalSequence: firstActorCursor - 1,
        actor: 'alden',
      },
    );
    assert.equal(staleAcknowledgement.status, 200);
    assert.equal(staleAcknowledgement.body.actor, 'luca-holahola');
    assert.equal(
      staleAcknowledgement.body.acknowledgedGlobalSequence,
      firstActorCursor,
      'a delayed runtime must not move the first actor cursor backward',
    );

    const mismatchedRead = await get(
      '/api/coordination/threads?actor=alden',
      'luca-holahola',
    );
    assert.equal(mismatchedRead.status, 403);
    assert.equal(mismatchedRead.body.code, 'actor_mismatch');

    const firstFeedAfterStaleAck = await get('/api/coordination/threads', 'luca-holahola');
    const secondFeedAfterStaleAck = await get('/api/coordination/threads', 'alden');
    assert.equal(
      (firstFeedAfterStaleAck.body.cursor as { acknowledged: number }).acknowledged,
      firstActorCursor,
    );
    assert.equal(
      (secondFeedAfterStaleAck.body.cursor as { acknowledged: number }).acknowledged,
      secondActorCursor,
      'a request authenticated as the first actor must not mutate the second actor cursor',
    );
  } finally {
    await db.delete(coordinationActorFeedCursors)
      .where(inArray(coordinationActorFeedCursors.actor, [...actors]));
    if (originalCursors.length > 0) {
      await db.insert(coordinationActorFeedCursors).values(originalCursors);
    }
  }
});
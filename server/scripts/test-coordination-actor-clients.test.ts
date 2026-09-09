import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCoordinationActor } from '../middleware/coordination-auth';
import {
  coordinationClientActions,
  createCoordinationActorClient,
  type CoordinationClientActor,
} from '../services/coordination-actor-client';
import { canCoordinationActorPerform } from '../services/coordination-ledger-service';
import {
  assertExplicitCoordinationCommentIntent,
  coordinationCliDeliverySummary,
  unsupportedCoordinationCliOptions,
} from './coordination-cli';

const TOKENS = {
  'luca-replit': 'r'.repeat(40),
  'luca-claude-code': 'c'.repeat(40),
  'luca-gemini': 'g'.repeat(40),
  'luca-holahola': 'h'.repeat(40),
  alden: 'a'.repeat(40),
  daniela: 'd'.repeat(40),
} as const;

const ENVIRONMENT = {
  COORDINATION_LUCA_REPLIT_TOKEN: TOKENS['luca-replit'],
  COORDINATION_LUCA_CLAUDE_CODE_TOKEN: TOKENS['luca-claude-code'],
  COORDINATION_LUCA_GEMINI_TOKEN: TOKENS['luca-gemini'],
  COORDINATION_LUCA_HOLAHOLA_TOKEN: TOKENS['luca-holahola'],
  COORDINATION_ALDEN_TOKEN: TOKENS.alden,
  COORDINATION_DANIELA_TOKEN: TOKENS.daniela,
  COORDINATION_API_TOKEN: 'shared-token-must-never-be-used'.repeat(2),
};

test('coordination CLI requires explicit ledger-only intent for plain comments', () => {
  assert.throws(
    () => assertExplicitCoordinationCommentIntent('comment', {}),
    /requires exactly one delivery intent/,
  );
  assert.throws(
    () => assertExplicitCoordinationCommentIntent('comment', { 'ledger-only': 'true' }),
    /requires exactly one delivery intent/,
  );
  assert.doesNotThrow(
    () => assertExplicitCoordinationCommentIntent('comment', { 'ledger-only': true }),
  );
  assert.doesNotThrow(
    () => assertExplicitCoordinationCommentIntent('comment', { recipient: 'luca-claude-code' }),
  );
  assert.throws(
    () => assertExplicitCoordinationCommentIntent('comment', {
      recipient: 'luca-claude-code',
      'ledger-only': true,
    }),
    /requires exactly one delivery intent/,
  );
  assert.doesNotThrow(
    () => assertExplicitCoordinationCommentIntent('reply-and-verify', {}),
  );
  assert.deepEqual(
    unsupportedCoordinationCliOptions('comment', { 'ledger-only': true }),
    [],
  );
});

test('coordination CLI makes delivery outcomes explicit', () => {
  assert.deepEqual(coordinationCliDeliverySummary('comment', { deliveryState: 'not_applicable' }), {
    state: 'not_requested',
    message: 'Ledger-only comment recorded; no recipient delivery was requested.',
  });
  assert.deepEqual(coordinationCliDeliverySummary('reply-and-verify', { deliveryState: 'delivered' }), {
    state: 'delivered',
    message: 'Recipient inbox delivery verified.',
  });
  assert.deepEqual(coordinationCliDeliverySummary('create', { deliveryState: 'pending' }), {
    state: 'queued',
    message: 'Recipient delivery is queued and has not been verified yet.',
  });
  assert.deepEqual(
    coordinationCliDeliverySummary('complete-with-linked-outcome', {
      linkedReply: { deliveryState: 'failed' },
    }),
    { state: 'failed', message: 'Recipient delivery failed.' },
  );
  assert.equal(coordinationCliDeliverySummary('show', { thread: {} }), null);
});

test('remaining actors resolve only from their dedicated credentials', () => {
  for (const [actor, token] of Object.entries(TOKENS)) {
    assert.deepEqual(resolveCoordinationActor(token, undefined, ENVIRONMENT), {
      ok: true,
      actor,
    });
  }

  assert.equal(
    resolveCoordinationActor(ENVIRONMENT.COORDINATION_API_TOKEN, undefined, ENVIRONMENT).ok,
    false,
  );
  assert.equal(
    resolveCoordinationActor(undefined, ENVIRONMENT.COORDINATION_API_TOKEN, ENVIRONMENT).ok,
    false,
  );
});

test('actor clients send only the selected actor dedicated credential', async () => {
  const observed: Array<{ url: string; token: string | null }> = [];
  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    observed.push({
      url: String(input),
      token: headers.get('x-coordination-token'),
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  for (const actor of Object.keys(TOKENS) as CoordinationClientActor[]) {
    const client = createCoordinationActorClient(actor, {
      apiUrl: 'https://coordination.example',
      environment: ENVIRONMENT,
      fetchImpl,
    });
    await client.listFeed({ cursor: 4, limit: 10 });
  }

  assert.deepEqual(observed.map((request) => request.token), [
    TOKENS['luca-replit'],
    TOKENS['luca-claude-code'],
    TOKENS['luca-gemini'],
    TOKENS['luca-holahola'],
    TOKENS.alden,
    TOKENS.daniela,
  ]);
  assert.equal(observed.every((request) => request.url.includes('cursor=4&limit=10')), true);
});

test('actor clients exchange only their own runtime bootstrap and use the short-lived token', async () => {
  const observed: Array<{ url: string; bootstrap: string | null; token: string | null; body: string | null }> = [];
  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const url = String(input);
    observed.push({
      url,
      bootstrap: headers.get('x-coordination-bootstrap'),
      token: headers.get('x-coordination-token'),
      body: typeof init?.body === 'string' ? init.body : null,
    });
    if (url.endsWith('/api/coordination/credentials/exchange')) {
      return new Response(JSON.stringify({
        accessToken: 'ct_short-lived-token',
        actor: 'luca-replit',
        runtimeId: 'luca-replit-primary',
        capabilities: ['coordination:read'],
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      }), { status: 201 });
    }
    return new Response(JSON.stringify({ threads: [] }), { status: 200 });
  };
  const client = createCoordinationActorClient('luca-replit', {
    apiUrl: 'https://coordination.example',
    environment: {
      COORDINATION_RUNTIME_ID: 'luca-replit-primary',
      COORDINATION_RUNTIME_BOOTSTRAP_TOKEN: 'cb_runtime-only-bootstrap',
    },
    fetchImpl,
  });

  await client.listFeed();

  assert.deepEqual(observed, [
    {
      url: 'https://coordination.example/api/coordination/credentials/exchange',
      bootstrap: 'cb_runtime-only-bootstrap',
      token: null,
      body: JSON.stringify({ runtimeId: 'luca-replit-primary' }),
    },
    {
      url: 'https://coordination.example/api/coordination/threads',
      bootstrap: null,
      token: 'ct_short-lived-token',
      body: null,
    },
  ]);
});

test('actor clients reject a broker response attributed to another actor', async () => {
  const client = createCoordinationActorClient('luca-replit', {
    apiUrl: 'https://coordination.example',
    environment: {
      COORDINATION_RUNTIME_ID: 'luca-replit-primary',
      COORDINATION_RUNTIME_BOOTSTRAP_TOKEN: 'cb_runtime-only-bootstrap',
    },
    fetchImpl: async () => new Response(JSON.stringify({
      accessToken: 'ct_wrong-actor-token',
      actor: 'luca-claude-code',
      runtimeId: 'luca-replit-primary',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    }), { status: 201 }),
  });

  await assert.rejects(() => client.listFeed(), /cross-actor credential/);
});

test('actor clients coalesce concurrent near-expiry renewal into one request', async () => {
  let renewalCount = 0;
  const fetchImpl = async (input: string | URL): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/api/coordination/credentials/exchange')) {
      return new Response(JSON.stringify({
        accessToken: 'ct_near-expiry',
        actor: 'luca-replit',
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      }), { status: 201 });
    }
    if (url.endsWith('/api/coordination/credentials/renew')) {
      renewalCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({
        accessToken: 'ct_renewed-once',
        actor: 'luca-replit',
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ threads: [] }), { status: 200 });
  };
  const client = createCoordinationActorClient('luca-replit', {
    apiUrl: 'https://coordination.example',
    environment: {
      COORDINATION_RUNTIME_ID: 'luca-replit-primary',
      COORDINATION_RUNTIME_BOOTSTRAP_TOKEN: 'cb_runtime-only-bootstrap',
    },
    fetchImpl,
  });

  await client.listFeed();
  await Promise.all([client.listFeed(), client.listFeed(), client.listFeed()]);

  assert.equal(renewalCount, 1);
});

test('actor clients acknowledge feed progress through the non-lifecycle cursor endpoint', async () => {
  const observed: Array<{ url: string; method: string | undefined; body: string | null }> = [];
  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    observed.push({
      url: String(input),
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : null,
    });
    return new Response(JSON.stringify({
      actor: 'alden',
      acknowledgedGlobalSequence: 42,
    }), { status: 200 });
  };
  const client = createCoordinationActorClient('alden', {
    apiUrl: 'https://coordination.example',
    environment: ENVIRONMENT,
    fetchImpl,
  });

  await client.acknowledgeFeed(42);

  assert.deepEqual(observed, [{
    url: 'https://coordination.example/api/coordination/threads/ack',
    method: 'POST',
    body: JSON.stringify({ globalSequence: 42 }),
  }]);
  assert.equal(coordinationClientActions('alden').has('acknowledge-feed'), true);
  assert.throws(
    () => client.acknowledgeFeed(-1),
    /must be a non-negative integer/,
  );
});

test('Luca clients preserve causal links and use the combined linked-outcome endpoint', async () => {
  const observed: Array<{ url: string; body: Record<string, unknown>; key: string | null }> = [];
  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    observed.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
      key: headers.get('idempotency-key'),
    });
    return new Response(JSON.stringify({ achievedState: 'completed' }), { status: 200 });
  };
  const client = createCoordinationActorClient('luca-replit', {
    apiUrl: 'https://coordination.example',
    environment: ENVIRONMENT,
    fetchImpl,
  });

  await client.progress('thread-1', {
    content: 'Progress with a causal parent.',
    expectedSequence: 3,
    idempotencyKey: 'test-progress-causal',
    causalParentEventId: 'event-2',
  });
  await client.completeWithLinkedOutcome('thread-1', {
    content: 'Completed with a direct reply.',
    expectedSequence: 4,
    idempotencyKey: 'test-linked-completion',
    causalParentEventId: 'event-3',
    reply: { body: 'Outcome delivered.' },
  });

  assert.equal(observed[0].body.causalParentEventId, 'event-2');
  assert.equal(
    observed[1].url,
    'https://coordination.example/api/coordination/threads/thread-1/complete-with-linked-outcome',
  );
  assert.equal(observed[1].key, 'test-linked-completion');
  assert.deepEqual(observed[1].body, {
    content: 'Completed with a direct reply.',
    expectedSequence: 4,
    causalParentEventId: 'event-3',
    reply: { body: 'Outcome delivered.' },
  });
});

test('direct clients and server enforce the same least-privilege lifecycle profiles', async () => {
  const noRequest = async (): Promise<Response> => {
    assert.fail('disallowed client action must fail before making a request');
  };

  const hola = createCoordinationActorClient('luca-holahola', {
    apiUrl: 'https://coordination.example',
    environment: ENVIRONMENT,
    fetchImpl: noRequest,
  });
  await assert.rejects(
    hola.complete('thread-1', {
      expectedSequence: 2,
      idempotencyKey: 'test-hola-complete',
    }),
    /cannot perform complete/,
  );

  const alden = createCoordinationActorClient('alden', {
    apiUrl: 'https://coordination.example',
    environment: ENVIRONMENT,
    fetchImpl: noRequest,
  });
  await assert.rejects(
    alden.create({
      title: 'Not permitted',
      description: 'Alden delegates by reassigning a thread he participates in.',
      intendedRecipient: 'luca-replit',
      idempotencyKey: 'test-alden-create',
    }),
    /cannot perform create/,
  );

  const daniela = createCoordinationActorClient('daniela', {
    apiUrl: 'https://coordination.example',
    environment: ENVIRONMENT,
    fetchImpl: noRequest,
  });
  await assert.rejects(
    daniela.reassign('thread-1', {
      expectedSequence: 2,
      idempotencyKey: 'test-daniela-reassign',
      recipientActor: 'alden',
    }),
    /cannot perform reassign/,
  );

  assert.equal(coordinationClientActions('luca-holahola').has('create'), true);
  assert.equal(coordinationClientActions('luca-holahola').has('complete'), false);
  assert.equal(canCoordinationActorPerform('luca-holahola', 'reassigned'), true);
  assert.equal(canCoordinationActorPerform('luca-holahola', 'completed'), false);
  assert.equal(canCoordinationActorPerform('alden', 'reassigned'), true);
  assert.equal(canCoordinationActorPerform('daniela', 'reassigned'), false);
});

test('CLI rejects obsolete or irrelevant options instead of silently dropping them', () => {
  assert.deepEqual(
    unsupportedCoordinationCliOptions('list', { cursor: '0', limit: '20' }),
    [],
  );
  assert.deepEqual(
    unsupportedCoordinationCliOptions('list', { owner: 'alden', state: 'accepted' }),
    ['owner', 'state'],
  );
  assert.deepEqual(
    unsupportedCoordinationCliOptions('show', { id: 'thread-1', 'after-sequence': '3' }),
    [],
  );
  assert.deepEqual(
    unsupportedCoordinationCliOptions('complete', {
      id: 'thread-1',
      'expected-sequence': '3',
      'idempotency-key': 'complete-key',
      'causal-parent-event-id': 'event-2',
    }),
    [],
  );
  assert.deepEqual(
    unsupportedCoordinationCliOptions('accept', {
      id: 'thread-1',
      recipient: 'daniela',
    }),
    ['recipient'],
  );
});
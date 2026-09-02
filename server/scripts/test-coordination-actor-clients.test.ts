import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCoordinationActor } from '../middleware/coordination-auth';
import {
  coordinationClientActions,
  createCoordinationActorClient,
  type CoordinationClientActor,
} from '../services/coordination-actor-client';
import { canCoordinationActorPerform } from '../services/coordination-ledger-service';
import { unsupportedCoordinationCliOptions } from './coordination-cli';

const TOKENS = {
  'luca-holahola': 'h'.repeat(40),
  alden: 'a'.repeat(40),
  daniela: 'd'.repeat(40),
} as const;

const ENVIRONMENT = {
  COORDINATION_LUCA_HOLAHOLA_TOKEN: TOKENS['luca-holahola'],
  COORDINATION_ALDEN_TOKEN: TOKENS.alden,
  COORDINATION_DANIELA_TOKEN: TOKENS.daniela,
  COORDINATION_API_TOKEN: 'shared-token-must-never-be-used'.repeat(2),
};

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
    TOKENS['luca-holahola'],
    TOKENS.alden,
    TOKENS.daniela,
  ]);
  assert.equal(observed.every((request) => request.url.includes('cursor=4&limit=10')), true);
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
    unsupportedCoordinationCliOptions('accept', {
      id: 'thread-1',
      recipient: 'daniela',
    }),
    ['recipient'],
  );
});
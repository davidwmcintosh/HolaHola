import assert from 'node:assert/strict';
import test from 'node:test';
import type OpenAI from 'openai';
import { RuntimeOnboardingClient } from './runtime-onboarding-client';
import { createRuntimeOpenAIResponsesClient } from './runtime-onboarding-openai-sdk';
import type { RuntimeOnboardingStore, RuntimeOnboardingScope, RuntimeOnboardingPurpose } from './runtime-onboarding-store';

function memoryStore(): RuntimeOnboardingStore {
  const entries = new Map<string, string>();
  const key = (scope: RuntimeOnboardingScope, purpose: RuntimeOnboardingPurpose) =>
    JSON.stringify([scope.endpoint, scope.actor, scope.runtimeId, purpose]);
  return {
    async get(scope, purpose) { return entries.get(key(scope, purpose)) ?? null; },
    async set(scope, purpose, value) { entries.set(key(scope, purpose), value); },
    async setIfAbsent(scope, purpose, value) {
      const name = key(scope, purpose);
      if (!entries.has(name)) entries.set(name, value);
      return entries.get(name)!;
    },
    async delete(scope, purpose) { entries.delete(key(scope, purpose)); },
  };
}

test('public authenticated transport cannot access credential, onboarding, or runtime-management responses', async () => {
  let requests = 0;
  const endpoint = 'https://restricted-onboarding.example.invalid';
  const client = new RuntimeOnboardingClient({
    endpoint,
    actor: 'luca-cursor',
    runtimeId: 'credential-export-denied',
    store: memoryStore(),
    fetchImpl: async () => {
      requests += 1;
      throw new Error('forbidden credential request reached the network');
    },
  });
  const sensitivePaths = [
    '/credentials/renew',
    '/CREDENTIALS/renew',
    '/CrEdEnTiAlS/exchange',
    '/%63redentials/renew',
    '/%43REDENTIALS/exchange',
    '/onboarding/requests/test/prove',
    '/ONBOARDING/requests/test/prove',
    '/OnBoArDiNg/requests/test/prove',
    '/%6Fnboarding/requests/test/prove',
    '/%4FnBoArDiNg/requests/test/prove',
    '/runtimes',
    '/RUNTIMES',
    '/RuNtImEs/example',
    '/%72untimes',
    '/%52UNTIMES/example',
    '/%2fcredentials/renew',
    '/safe/%2e%2e/credentials/renew',
    '/safe/%2e%2e/onboarding/requests/test/prove',
    '/safe/%2e%2e/runtimes/example',
  ];
  for (const path of sensitivePaths) {
    await assert.rejects(
      client.authenticatedFetch(`${endpoint}/api/coordination${path}`, { method: 'POST' }),
      /onboarding_auth_header_target_not_allowed/,
    );
  }
  assert.equal(requests, 0);
});

test('malformed encoded paths are rejected before credential lookup or network access', async () => {
  let requests = 0;
  let storeReads = 0;
  const backingStore = memoryStore();
  const store: RuntimeOnboardingStore = {
    async get(scope, purpose) {
      storeReads += 1;
      return backingStore.get(scope, purpose);
    },
    set: backingStore.set,
    setIfAbsent: backingStore.setIfAbsent,
    delete: backingStore.delete,
  };
  const endpoint = 'https://restricted-onboarding.example.invalid';
  const client = new RuntimeOnboardingClient({
    endpoint,
    actor: 'luca-cursor',
    runtimeId: 'malformed-path-denied',
    store,
    fetchImpl: async () => {
      requests += 1;
      throw new Error('malformed path reached the network');
    },
  });

  for (const path of [
    '/api/coordination/credentials/%E0%A4%A',
    '/api/coordination/%FF/runtimes',
  ]) {
    await assert.rejects(
      client.authenticatedFetch(`${endpoint}${path}`, { method: 'POST' }),
      /onboarding_auth_header_target_not_allowed/,
    );
  }
  assert.equal(storeReads, 0);
  assert.equal(requests, 0);
});

test('canonical allowlist matching preserves the actual authenticated request target', async () => {
  const endpoint = 'https://restricted-onboarding.example.invalid';
  const scope = {
    endpoint,
    actor: 'luca-cursor',
    runtimeId: 'canonical-safe-read',
  };
  const store = memoryStore();
  const fixtureToken = 'canonical-path-fixture-token';
  await store.set(scope, 'access-credential', JSON.stringify({
    ...scope,
    accessToken: fixtureToken,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    capabilities: ['coordination:read'],
  }));
  const target = `${endpoint}/API/COORDINATION/threads?limit=1`;
  let requests = 0;
  const client = new RuntimeOnboardingClient({
    ...scope,
    store,
    fetchImpl: async (input) => {
      requests += 1;
      assert.ok(input instanceof Request);
      assert.equal(input.url, target);
      assert.equal(input.headers.get('x-coordination-token'), fixtureToken);
      return Response.json({ ok: true });
    },
  });
  assert.equal((await client.authenticatedFetch(target)).status, 200);
  assert.equal(requests, 1);
});

for (const surface of ['rest', 'mcp', 'openai'] as const) {
  test(`a valid nearly-expired read-only credential still works for ${surface} without renewal authority`, async () => {
    const scope = {
      endpoint: 'https://restricted-onboarding.example.invalid',
      actor: 'luca-openai-agents',
      runtimeId: `restricted-${surface}`,
    };
    const store = memoryStore();
    const fixtureToken = 'read-only-fixture-token';
    await store.set(scope, 'access-credential', JSON.stringify({
      ...scope,
      accessToken: fixtureToken,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      capabilities: ['coordination:read'],
    }));
    let calls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      calls += 1;
      const target = new URL(request.url);
      assert.equal(target.origin, scope.endpoint);
      assert.ok(!target.pathname.includes('/renew') && !target.pathname.includes('/onboarding/'));
      assert.equal(
        request.headers.get(surface === 'mcp' ? 'authorization' : 'x-coordination-token'),
        surface === 'mcp' ? `Bearer ${fixtureToken}` : fixtureToken,
      );
      return Response.json({ actor: scope.actor, items: [] });
    };
    if (surface === 'openai') {
      const sdk = {
        responses: {
          async create(request: { tools: Array<{ type: string; headers?: Record<string, string> }> }) {
            calls += 1;
            const mcp = request.tools.find((tool) => tool.type === 'mcp');
            assert.equal(mcp?.headers?.Authorization, `Bearer ${fixtureToken}`);
            return { id: 'fixture-response', output_text: 'safe' };
          },
        },
      } as unknown as Pick<OpenAI, 'responses'>;
      const adapter = createRuntimeOpenAIResponsesClient({ ...scope, sdk, store, fetchImpl });
      const result = await adapter.responses.create({ model: 'fixture-model', input: 'fixture' });
      assert.ok('id' in result);
      assert.equal(result.id, 'fixture-response');
      assert.ok(!JSON.stringify(result).includes(fixtureToken));
    } else {
      const client = new RuntimeOnboardingClient({ ...scope, store, fetchImpl });
      const path = surface === 'mcp' ? '/api/mcp/coordination' : '/api/coordination/threads';
      assert.equal((await client.authenticatedFetch(`${scope.endpoint}${path}`)).status, 200);
    }
    assert.equal(calls, 1, 'no recovery or unauthorized proactive renewal request occurs');
  });
}
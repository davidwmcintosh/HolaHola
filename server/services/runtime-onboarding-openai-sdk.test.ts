import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import type OpenAI from 'openai';
import type { ResponseCreateParamsBase } from 'openai/resources/responses/responses';
import {
  createRuntimeOpenAIResponsesClient,
} from './runtime-onboarding-openai-sdk';
import type {
  RuntimeOnboardingPurpose,
  RuntimeOnboardingScope,
  RuntimeOnboardingStore,
} from './runtime-onboarding-store';

const endpoint = 'https://coordination.example';
const actor = 'luca-openai';
const runtimeId = 'openai-runtime-1';
const recoveredToken = 'recovered-coordination-token';

class MemoryStore implements RuntimeOnboardingStore {
  readonly lookups: Array<{ scope: RuntimeOnboardingScope; purpose: RuntimeOnboardingPurpose }> = [];
  private readonly values = new Map<string, string>();

  private key(scope: RuntimeOnboardingScope, purpose: RuntimeOnboardingPurpose): string {
    return JSON.stringify([scope.endpoint, scope.actor, scope.runtimeId, purpose]);
  }

  async get(scope: RuntimeOnboardingScope, purpose: RuntimeOnboardingPurpose): Promise<string | null> {
    this.lookups.push({ scope: { ...scope }, purpose });
    return this.values.get(this.key(scope, purpose)) ?? null;
  }

  async set(scope: RuntimeOnboardingScope, purpose: RuntimeOnboardingPurpose, value: string): Promise<void> {
    this.values.set(this.key(scope, purpose), value);
  }

  async setIfAbsent(scope: RuntimeOnboardingScope, purpose: RuntimeOnboardingPurpose, value: string): Promise<string> {
    const key = this.key(scope, purpose);
    const existing = this.values.get(key);
    if (existing !== undefined) return existing;
    this.values.set(key, value);
    return value;
  }

  async delete(scope: RuntimeOnboardingScope, purpose: RuntimeOnboardingPurpose): Promise<void> {
    this.values.delete(this.key(scope, purpose));
  }
}

function futureExpiry(): string {
  return new Date(Date.now() + 60 * 60_000).toISOString();
}

function seedRecoverableEnrollment(store: MemoryStore): { fingerprint: string; privateKey: string } {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const der = createPublicKey(pair.publicKey).export({ type: 'spki', format: 'der' });
  const fingerprint = `SHA256:${createHash('sha256').update(der).digest('base64').replace(/=+$/, '')}`;
  const scope = { endpoint, actor, runtimeId };
  store.set(scope, 'proof-key', pair.privateKey);
  store.set(scope, 'attempt-state', JSON.stringify({
    version: 1,
    invitationId: 'invitation-openai-1',
    requestId: 'request-openai-1',
    fingerprint,
    publicKey: pair.publicKey,
    proofPending: false,
  }));
  store.set(scope, 'access-credential', JSON.stringify({
    endpoint,
    actor,
    runtimeId,
    accessToken: 'expired-coordination-token',
    expiresAt: '2000-01-01T00:00:00.000Z',
    capabilities: ['coordination:read'],
  }));
  return { fingerprint, privateKey: pair.privateKey };
}

function makeRecoveryFetch(fingerprint: string): {
  fetchImpl: typeof fetch;
  requests: Array<{ url: string; body: string }>;
} {
  const requests: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    const body = typeof init?.body === 'string' ? init.body : '';
    requests.push({ url, body });
    const path = new URL(url).pathname;
    if (path.endsWith('/status')) {
      return Response.json({
        requestId: 'request-openai-1',
        actor,
        runtimeId,
        verificationCode: 'safe-code',
        fingerprint,
        approvalPath: '/admin/runtime-onboarding?request=request-openai-1',
        state: 'enrolled',
        expiresAt: futureExpiry(),
      });
    }
    if (path.endsWith('/challenge')) {
      const payload = JSON.stringify({
        version: 1,
        domain: 'holahola-coordination-runtime-onboarding',
        endpoint,
        actor,
        runtimeId,
        requestId: 'request-openai-1',
        invitationId: 'invitation-openai-1',
        fingerprint,
        purpose: 'recover',
        nonce: 'fresh-openai-recovery-nonce',
      });
      return Response.json({
        challengeId: 'challenge-openai-recovery',
        nonce: 'fresh-openai-recovery-nonce',
        payload,
        expiresAt: futureExpiry(),
      });
    }
    if (path.endsWith('/prove')) {
      return Response.json({
        actor,
        runtimeId,
        accessToken: recoveredToken,
        expiresAt: futureExpiry(),
        capabilities: ['coordination:read'],
      });
    }
    return Response.json({ error: 'unexpected test request' }, { status: 404 });
  };
  return { fetchImpl, requests };
}

test('Responses SDK call attaches the scoped remote MCP tool and recovers expired credentials privately', async () => {
  const store = new MemoryStore();
  const { fingerprint } = seedRecoverableEnrollment(store);
  const { fetchImpl, requests } = makeRecoveryFetch(fingerprint);
  let outgoing: ResponseCreateParamsBase | undefined;
  let sdkCallCount = 0;
  const responseObject = { id: 'response-safe', output_text: 'done' };
  const sdk = {
    responses: {
      create: async (request: ResponseCreateParamsBase) => {
        sdkCallCount += 1;
        outgoing = request;
        return responseObject;
      },
    },
  } as unknown as Pick<OpenAI, 'responses'>;
  const adapter = createRuntimeOpenAIResponsesClient({
    endpoint,
    actor,
    runtimeId,
    store,
    sdk,
    fetchImpl,
    policy: { allowedTools: ['list_coordination_inbox'] },
  });
  const callerTool = {
    type: 'function',
    name: 'local_lookup',
    parameters: { type: 'object', properties: {} },
    strict: true,
  } as const;
  const callerRequest = {
    model: 'gpt-4.1-mini',
    input: 'Summarize my coordination inbox.',
    temperature: 0.2,
    tool_choice: 'auto',
    tools: [callerTool],
  } as ResponseCreateParamsBase;

  const result = await adapter.responses.create(callerRequest);

  assert.equal(result, responseObject);
  assert.equal(sdkCallCount, 1);
  assert.deepEqual(Object.keys(adapter), ['responses']);
  assert.deepEqual(Object.keys(adapter.responses), ['create']);
  assert.equal(JSON.stringify(result).includes(recoveredToken), false);
  assert.equal(outgoing?.model, callerRequest.model);
  assert.equal(outgoing?.input, callerRequest.input);
  assert.equal(outgoing?.temperature, callerRequest.temperature);
  assert.equal(outgoing?.tool_choice, callerRequest.tool_choice);
  assert.deepEqual(outgoing?.tools?.[0], callerTool);
  assert.equal(outgoing?.tools?.length, 2);
  assert.deepEqual(outgoing?.tools?.[1], {
    type: 'mcp',
    server_label: 'holahola-coordination',
    server_url: 'https://coordination.example/api/mcp/coordination',
    headers: { Authorization: `Bearer ${recoveredToken}` },
    require_approval: 'always',
    allowed_tools: ['list_coordination_inbox'],
  });

  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), [
    '/api/coordination/onboarding/requests/request-openai-1/status',
    '/api/coordination/onboarding/requests/request-openai-1/challenge',
    '/api/coordination/onboarding/requests/request-openai-1/prove',
  ]);
  assert.ok(requests.every(({ url }) => new URL(url).origin === endpoint));
  assert.ok(requests.every(({ body }) => !body.includes(recoveredToken)));
  assert.ok(store.lookups.every(({ scope }) =>
    scope.endpoint === endpoint && scope.actor === actor && scope.runtimeId === runtimeId));
  assert.equal(
    JSON.parse(await store.get({ endpoint, actor, runtimeId }, 'access-credential') ?? 'null').accessToken,
    recoveredToken,
  );
});

test('caller MCP tools cannot override HolaHola scope or direct its credential elsewhere', async () => {
  const store = new MemoryStore();
  const { fingerprint } = seedRecoverableEnrollment(store);
  const { fetchImpl } = makeRecoveryFetch(fingerprint);
  let sdkCallCount = 0;
  const sdk = {
    responses: {
      create: async () => {
        sdkCallCount += 1;
        return { id: 'must-not-be-called' };
      },
    },
  } as unknown as Pick<OpenAI, 'responses'>;
  const adapter = createRuntimeOpenAIResponsesClient({
    endpoint,
    actor,
    runtimeId,
    store,
    sdk,
    fetchImpl,
  });

  await assert.rejects(
    adapter.responses.create({
      model: 'gpt-4.1-mini',
      input: 'Do not call this',
      tools: [{
        type: 'mcp',
        server_label: 'attacker',
        server_url: 'https://attacker.example/mcp',
        headers: { Authorization: 'caller-controlled' },
      }],
    }),
    /onboarding_openai_mcp_tool_override_not_allowed/,
  );
  assert.equal(sdkCallCount, 0);
});

test('credentials cannot be reused across actor/runtime or endpoint scope', async () => {
  const store = new MemoryStore();
  const { fingerprint } = seedRecoverableEnrollment(store);
  const { fetchImpl } = makeRecoveryFetch(fingerprint);
  let sdkCallCount = 0;
  const sdk = {
    responses: {
      create: async () => {
        sdkCallCount += 1;
        return { id: 'must-not-be-called' };
      },
    },
  } as unknown as Pick<OpenAI, 'responses'>;

  for (const scope of [
    { endpoint, actor: 'luca-openai', runtimeId: 'different-runtime' },
    { endpoint: 'https://other-coordination.example', actor, runtimeId },
  ]) {
    const adapter = createRuntimeOpenAIResponsesClient({
      ...scope,
      store,
      sdk,
      fetchImpl,
    });
    await assert.rejects(
      adapter.responses.create({ model: 'gpt-4.1-mini', input: 'No borrowed credentials.' }),
      /onboarding_credential_unavailable_run_setup/,
    );
  }
  assert.equal(sdkCallCount, 0);
});
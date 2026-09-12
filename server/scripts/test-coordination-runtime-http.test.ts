import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import test from 'node:test';
import {
  InMemoryCoordinationRepository,
  CoordinationRuntimeService,
  type CodingRuntimeProfile,
} from '../services/coordination-runtime';
import {
  CoordinationGeminiAdapter,
  buildPacketBoundGeminiRequest,
} from '../services/coordination-gemini-adapter';
import { registerCoordinationRuntimeRoutes } from '../routes/coordination-runtime-routes';

const credential = {
  actor: 'luca-gemini' as const,
  runtimeId: 'runtime-http',
  credentialId: 'credential-http',
  capabilities: ['coordination:read', 'coordination:write'],
  expiresAt: new Date(Date.now() + 60_000),
};
const profile: CodingRuntimeProfile = {
  id: 'profile-http',
  runtimeRegistrationId: credential.runtimeId,
  actor: 'luca-gemini',
  capabilities: ['execute', 'model'],
  provider: 'gemini',
  model: 'gemini-3-flash-preview',
  adapterVersion: 'coordination-gemini-v1',
  repositoryLabel: 'HolaHola',
  worktreeLabel: 'HolaHola-antigravity',
  worktreeRealpathDigest: 'a'.repeat(64),
  branch: 'luca/gemini-experiment',
  startingCommit: 'b'.repeat(40),
  status: 'active',
};

async function httpRequest(server: http.Server, path: string, options: {
  method?: string; body?: unknown; token?: string; key?: string; grant?: string;
} = {}): Promise<{ status: number; body: any; raw: string }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not bind');
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1', port: address.port, path, method: options.method ?? 'GET',
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...(options.token ? { 'x-coordination-token': options.token } : {}),
        ...(options.key ? { 'idempotency-key': options.key } : {}),
        ...(options.grant ? { 'x-coordination-ownership-grant': options.grant } : {}),
      },
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        let body: any;
        try { body = JSON.parse(raw); } catch { body = raw; }
        resolve({ status: response.statusCode ?? 0, body, raw });
      });
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function fixture(response: unknown = {
  candidates: [{
    finishReason: 'STOP',
    content: { parts: [{ functionCall: { name: 'git_status', id: 'call-1', args: {} } }] },
  }],
}) {
  const repository = new InMemoryCoordinationRepository();
  await repository.saveProfile(profile);
  await repository.addInboxItem({
    id: 'http-item-1', eventId: 'http-event-1', threadId: 'http-thread',
    taskId: 'http-task', sequence: 1,
    payload: { content: { exact: 'packet value', assignment: { author: 'daniela', taskId: 'http-task', threadId: 'http-thread', expectedSequence: 1 } } },
  });
  await repository.freezeInboxWindow('http-thread', 0, 1, 'http-boundary');
  const window = await repository.freezeInboxWindow('http-thread', 0, 1, 'http-boundary');
  const requests: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const transport = async (request: { url: string; headers: Record<string, string>; body: string }) => {
    requests.push(request);
    return { status: 200, body: JSON.stringify(response) };
  };
  const app = express();
  app.use(express.json());
  registerCoordinationRuntimeRoutes(app, {
    repository,
    transport,
    apiKey: 'server-only-key',
    baseUrl: 'https://gemini-proxy.example.test/',
    resolveCredential: async (value) => value === 'broker-token' ? credential : null,
  });
  const server = await new Promise<http.Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return { server, repository, window, requests };
}

test('fixed compatibility tokens and authority overrides cannot authenticate', async () => {
  const f = await fixture();
  try {
    const denied = await httpRequest(f.server, '/api/coordination/runtime/packets', {
      method: 'POST', token: 'fixed-compatibility-token', key: 'fixed',
      body: { windowId: 'x', actor: 'luca-gemini', runtimeId: credential.runtimeId, profileId: profile.id },
    });
    assert.equal(denied.status, 401);
    assert.equal(denied.body.error, 'authentication_required');
    const noToken = await httpRequest(f.server, '/api/coordination/runtime/packets', { method: 'POST', key: 'none', body: {} });
    assert.equal(noToken.status, 401);
  } finally { await new Promise<void>((resolve) => f.server.close(() => resolve())); }
});

test('Gemini transport requires a credential-free configured HTTP(S) base URL', () => {
  const transport = async () => ({ status: 200, body: '{}' });
  assert.throws(
    () => new CoordinationGeminiAdapter(transport, 'test-key', ''),
    /AI_INTEGRATIONS_GEMINI_BASE_URL is not configured/,
  );
  assert.throws(
    () => new CoordinationGeminiAdapter(transport, 'test-key', 'not-a-url'),
    /AI_INTEGRATIONS_GEMINI_BASE_URL is invalid/,
  );
  for (const baseUrl of [
    'ftp://gemini-proxy.example.test',
    'https://user:password@gemini-proxy.example.test',
    'https://gemini-proxy.example.test?credential=value',
    'https://gemini-proxy.example.test#fragment',
  ]) {
    assert.throws(
      () => new CoordinationGeminiAdapter(transport, 'test-key', baseUrl),
      /credential-free HTTP\(S\) base URL/,
    );
  }
});

test('HTTP lifecycle hides initial intents, persists retries, binds reveal and continuation', async () => {
  const f = await fixture();
  try {
    const packetResponse = await httpRequest(f.server, '/api/coordination/runtime/packets', {
      method: 'POST', token: 'broker-token', key: 'packet',
      body: {
        windowId: f.window.id,
        assignmentEventId: 'http-event-1',
        actor: 'daniela', runtimeId: 'forged', profileId: 'forged', model: 'other',
      },
    });
    assert.equal(packetResponse.status, 200);
    const packet = packetResponse.body;
    const initial = await httpRequest(f.server, `/api/coordination/runtime/packets/${packet.id}/initial-turn`, {
      method: 'POST', token: 'broker-token', key: 'initial',
    });
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body.interactions[0].intents, []);
    assert.equal(f.requests.length, 1);
    assert.equal(
      f.requests[0].url,
      'https://gemini-proxy.example.test/models/gemini-3-flash-preview:generateContent',
    );
    assert.equal(f.requests[0].headers['x-goog-api-key'], 'server-only-key');
    assert(!f.requests[0].url.includes('server-only-key'));
    assert(!f.requests[0].body.includes('server-only-key'));
    assert(!initial.raw.includes('server-only-key'));

    const receiptId = initial.body.receiptId;
    const claim = await httpRequest(f.server, `/api/coordination/runtime/packets/${packet.id}/claim`, {
      method: 'POST', token: 'broker-token', key: 'claim',
      body: { receiptId, ttlMs: 5000, actor: 'daniela', epoch: 99 },
    });
    assert.equal(claim.status, 200);
    const reveal = await httpRequest(f.server, `/api/coordination/runtime/claims/${claim.body.id}/intents`, {
      method: 'GET', token: 'broker-token',
    });
    assert.equal(reveal.status, 200);
    assert.equal(reveal.body.intents[0].callId, 'call-1');
    const continuation = await httpRequest(f.server, `/api/coordination/runtime/claims/${claim.body.id}/continuation`, {
      method: 'POST', token: 'broker-token', key: 'continuation',
      body: { epoch: claim.body.epoch, turn: 2, toolResults: [{ callId: 'wrong', output: 'bad' }] },
    });
    assert.equal(continuation.status, 400);
    assert.equal(continuation.body.error, 'invalid_request');
    const countBeforeReplay = f.requests.length;
    const retry = await httpRequest(f.server, `/api/coordination/runtime/packets/${packet.id}/initial-turn`, {
      method: 'POST', token: 'broker-token', key: 'initial',
    });
    assert.equal(retry.status, 200);
    assert.equal(f.requests.length, countBeforeReplay);
  } finally { await new Promise<void>((resolve) => f.server.close(() => resolve())); }
});

test('normalization records provider outcomes and additional candidates without executing them', async () => {
  const outcomes: Array<[unknown, string]> = [
    [{ promptFeedback: { blockReason: 'SAFETY' } }, 'safety_blocked'],
    [{ candidates: [{ finishReason: 'RECITATION', content: { parts: [] } }] }, 'refused'],
    [{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }, 'context_limit'],
    [{ candidates: [] }, 'empty_response'],
    [{ candidates: [{ content: { parts: [{ functionCall: { name: 'unknown', id: 'x', args: {} } }] } }] }, 'malformed_function_call'],
  ];
  for (const [body, expected] of outcomes) {
    const adapter = new CoordinationGeminiAdapter(
      async () => ({ status: 200, body: JSON.stringify(body) }),
      'test-key',
      'https://gemini-proxy.example.test',
    );
    assert.equal((await adapter.turn({
      id: 'p', version: 1, actor: 'luca-gemini', runtimeRegistrationId: 'r', profileId: 'p',
      createdAt: 1, supersedesClaimId: null, windowId: 'w', windowDigest: 'd',
      orderedInboxItemIds: [], orderedEventIds: [], orderedThreadIds: [],
      assignment: { assignmentEventId: 'e', assignmentAuthor: 'alden', taskId: 't', threadId: 'th', expectedSequence: 1 },
      inherited: [], envelope: { worktreeLabel: 'x', worktreePath: '/x', argv: ['true'], patchDigest: null }, digest: 'd',
    }, 1))[0].outcome, expected);
  }
  const request = buildPacketBoundGeminiRequest({
    id: 'p', version: 1, actor: 'luca-gemini', runtimeRegistrationId: 'r', profileId: 'p',
    createdAt: 1, supersedesClaimId: null, windowId: 'w', windowDigest: 'd',
    orderedInboxItemIds: [], orderedEventIds: [], orderedThreadIds: [],
    assignment: { assignmentEventId: 'e', assignmentAuthor: 'alden', taskId: 't', threadId: 'th', expectedSequence: 1 },
    inherited: [{ taskArtifact: { sha256: 'a'.repeat(64), text: 'exact approved task bytes' }, content: { exact: 'bytes' } }],
    envelope: { worktreeLabel: 'x', worktreePath: '/x', argv: ['true'], patchDigest: null }, digest: 'd',
  });
  assert.match(request.bytes, /\[INHERITANCE_PACKET\]/);
  const parsedRequest = JSON.parse(request.bytes);
  assert.match(parsedRequest.contents[0].parts[0].text, /exact approved task bytes/);
  const declarations = parsedRequest.tools[0].functionDeclarations;
  assert.equal(declarations.some((declaration: { name: string }) => declaration.name === 'write_file'), false);
  const replace = declarations.find((declaration: { name: string }) => declaration.name === 'replace_once');
  assert.deepEqual(replace.parameters.required, ['oldText', 'newText']);
  assert.deepEqual(Object.keys(replace.parameters.properties).sort(), ['newText', 'oldText']);

  const longOldText = 'x'.repeat(20_001);
  const exactArguments = await new CoordinationGeminiAdapter(
    async () => ({ status: 200, body: JSON.stringify({ candidates: [{
      finishReason: 'STOP',
      content: { parts: [{ functionCall: {
        name: 'replace_once',
        id: 'long-replace',
        args: { oldText: longOldText, newText: 'y' },
      } }] },
    }] }) }),
    'test-key',
    'https://gemini-proxy.example.test',
  ).turn({
    id: 'long-p', version: 1, actor: 'luca-gemini', runtimeRegistrationId: 'r', profileId: 'p',
    createdAt: 1, supersedesClaimId: null, windowId: 'w', windowDigest: 'd',
    orderedInboxItemIds: [], orderedEventIds: [], orderedThreadIds: [],
    assignment: { assignmentEventId: 'e', assignmentAuthor: 'alden', taskId: 't', threadId: 'th', expectedSequence: 1 },
    inherited: [], envelope: { worktreeLabel: 'x', worktreePath: '/x', argv: ['true'], patchDigest: null }, digest: 'd',
  }, 1);
  assert.equal(exactArguments[0].outcome, 'consumed');
  assert.equal(exactArguments[0].intents[0].arguments.oldText, longOldText);
});

test('initial malformed replacement is persisted as a non-authorizing receipt', async () => {
  const f = await fixture({
    candidates: [{
      content: {
        parts: [{
          functionCall: {
            name: 'replace_once',
            id: 'malformed-initial-call',
            args: { oldText: 'before', newText: 'after', path: 'forbidden.ts' },
          },
        }],
      },
    }],
  });
  try {
    const created = await httpRequest(f.server, '/api/coordination/runtime/packets', {
      method: 'POST',
      token: 'broker-token',
      key: 'malformed-initial-packet',
      body: { windowId: f.window.id, assignmentEventId: 'http-event-1' },
    });
    assert.equal(created.status, 200);
    const packet = created.body as { id: string };

    const response = await httpRequest(
      f.server,
      `/api/coordination/runtime/packets/${packet.id}/initial-turn`,
      { method: 'POST', token: 'broker-token', key: 'malformed-initial-turn' },
    );
    assert.equal(response.status, 200);
    const body = response.body as {
      receiptId?: string;
      interactions: Array<{ outcome: string; intents: unknown[] }>;
    };
    assert.equal(typeof body.receiptId, 'string');
    assert.equal(body.interactions[0]?.outcome, 'malformed_function_call');
    assert.deepEqual(body.interactions[0]?.intents, []);

    const stored = await f.repository.interactionsForPacket(packet.id);
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.outcome, 'malformed_function_call');
    assert.equal(await f.repository.activeClaimForThread('http-thread'), undefined);
  } finally {
    await new Promise<void>((resolve) => f.server.close(() => resolve()));
  }
});
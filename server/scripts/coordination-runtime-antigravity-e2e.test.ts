import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { InMemoryCoordinationRepository, CoordinationRuntimeService } from '../services/coordination-runtime';
import { CoordinationGeminiAdapter, CoordinationGeminiCoordinator } from '../services/coordination-gemini-adapter';
import { registerCoordinationRuntimeRoutes } from '../routes/coordination-runtime-routes';
import { AntigravityDriver, TARGET } from './coordination-runtime-antigravity';

const token = 'ct_e2e_short';
const credential = {
  actor: 'luca-gemini' as const, runtimeId: 'e2e-runtime', credentialId: 'e2e-credential',
  capabilities: ['coordination:read', 'coordination:write'], expiresAt: new Date(Date.now() + 3600000),
};
const rootDigest = createHash('sha256').update('/approved').digest('hex');
const profile = {
  id: 'e2e-profile', runtimeRegistrationId: credential.runtimeId, actor: credential.actor,
  capabilities: ['execute', 'model'], provider: 'gemini', model: 'gemini-3-flash-preview',
  adapterVersion: 'coordination-gemini-v1', status: 'active' as const,
  worktreeLabel: 'HolaHola-antigravity', worktreeRealpathDigest: rootDigest,
  branch: 'luca/gemini-experiment', startingCommit: 'head',
};

async function request(server: http.Server, path: string, init: { method?: string; body?: unknown; token?: string; key?: string } = {}) {
  const address = server.address() as { port: number };
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  return new Promise<{ status: number; body: any }>((resolveRequest, reject) => {
    const req = http.request({ host: '127.0.0.1', port: address.port, path, method: init.method ?? 'GET',
      headers: { ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}),
        ...(init.token ? { 'x-coordination-token': init.token } : {}), ...(init.key ? { 'idempotency-key': init.key } : {}) } }, (res) => {
      let raw = ''; res.on('data', (chunk) => { raw += chunk; }); res.on('end', () => resolveRequest({ status: res.statusCode ?? 0, body: JSON.parse(raw || '{}') }));
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

test('real Express Gate3 lifecycle accepts measured, renewed, retry-backed evidence', async () => {
  const repository = new InMemoryCoordinationRepository();
  await repository.saveProfile(profile);
  await repository.addInboxItem({ id: 'e2e-item', eventId: 'e2e-event', threadId: 'e2e-thread', taskId: 'e2e-task', sequence: 1,
    payload: { content: { assignment: { author: 'daniela', taskId: 'e2e-task', threadId: 'e2e-thread', expectedSequence: 1 } } } });
  const window = await repository.freezeInboxWindow('e2e-thread', 0, 1, 'e2e-boundary');
  let providerAttempt = 0;
  const transport = async () => {
    providerAttempt++;
    if (providerAttempt === 1) return { status: 503, body: '{}' };
    if (providerAttempt === 2) return { status: 200, body: JSON.stringify({ candidates: [{ finishReason: 'STOP',
      content: { parts: [{ functionCall: { name: 'write_file', id: 'write-1', args: { content: 'test' } } }] } }] }) };
    if (providerAttempt === 3) return { status: 200, body: JSON.stringify({ candidates: [{ finishReason: 'STOP',
      content: { parts: [{ functionCall: { name: 'run_test', id: 'test-1', args: {} } }] } }] }) };
    return { status: 200, body: JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'done' }] } }] }) };
  };
  const app = express(); app.use(express.json());
  app.post('/api/coordination/credentials/exchange', (_req, res) => res.status(201).json({
    accessToken: token, tokenType: 'Coordination', actor: 'luca-gemini', runtimeId: credential.runtimeId,
    capabilities: credential.capabilities, expiresAt: credential.expiresAt.toISOString(),
  }));
  app.post('/api/coordination/credentials/renew', (_req, res) => res.json({
    accessToken: token, tokenType: 'Coordination', actor: 'luca-gemini', runtimeId: credential.runtimeId,
    capabilities: credential.capabilities, expiresAt: credential.expiresAt.toISOString(),
  }));
  registerCoordinationRuntimeRoutes(app, {
    repository, service: new CoordinationRuntimeService(repository), coordinator: undefined,
    adapter: new CoordinationGeminiAdapter(
      transport,
      'server-key',
      'https://gemini-proxy.example.test',
    ),
    resolveCredential: async (value) => value === token ? credential : null,
  });
  const server = await new Promise<http.Server>((resolveServer) => { const value = app.listen(0, () => resolveServer(value)); });
  try {
    let statusCount = 0;
    const files = new Map<string, Buffer>();
    const fs = {
      realpath: async (value: string) => value,
      lstat: async () => ({ isSymbolicLink: () => false, isFile: () => true, isDirectory: () => true }),
      readFile: async (value: string) => files.get(value) ?? Buffer.from(''),
      writeFile: async (value: string, content: string) => { files.set(value, Buffer.from(content)); },
    };
    const spawn = async (argv: string[]) => {
      const key = argv.join(' ');
      const stdout = key === 'git rev-parse --show-toplevel' ? '/approved\n'
        : key === 'git rev-parse --abbrev-ref HEAD' ? `${profile.branch}\n`
        : key === 'git rev-parse HEAD' ? `${profile.startingCommit}\n`
        : key === 'git status --short' ? (++statusCount === 1 ? '' : ` M ${TARGET}\n`)
        : key.startsWith('git diff') ? 'diff --git a/server/scripts/test-coordination-runtime.test.ts b/server/scripts/test-coordination-runtime.test.ts\n' : '';
      return { code: 0, stdout, stderr: '' };
    };
    const driver = new AntigravityDriver({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      runtimeId: credential.runtimeId, worktree: '/approved', windowId: window.id, bootstrap: 'cb_e2e_secret',
      fs, spawn, http: async (input) => {
        const response = await request(server, input.path, { method: input.method, body: input.body, key: input.headers['idempotency-key'], token: input.headers['x-coordination-token'] });
        return response;
      } });
    await driver.run();
    assert.equal(providerAttempt, 4);
    assert.equal((await repository.getCompletion('missing'))?.id, undefined);
    const state = repository.snapshots();
    assert.equal(state.executions.length, 1);
    assert.equal(state.completions.length, 1);
    assert.equal(state.toolResults.length, 2);
    assert.notEqual(state.toolResults[0].claimEpoch, state.toolResults[1].claimEpoch);
    assert.notEqual(state.toolResults[0].claimEventId, state.toolResults[1].claimEventId);
    assert.equal(state.executions[0].attestedLocalState.changedPaths[0], TARGET);
  } finally { await new Promise<void>((resolveClose) => server.close(() => resolveClose())); }
});
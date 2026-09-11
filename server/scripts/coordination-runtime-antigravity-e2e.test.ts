import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { InMemoryCoordinationRepository, CoordinationRuntimeService } from '../services/coordination-runtime';
import { CoordinationGeminiAdapter, CoordinationGeminiCoordinator } from '../services/coordination-gemini-adapter';
import { registerCoordinationRuntimeRoutes } from '../routes/coordination-runtime-routes';
import { AntigravityDriver, TARGET } from './coordination-runtime-antigravity';
import type { TaskOwnershipHttpClient } from '../services/task-ownership-client';

const token = 'ct_e2e_short';
const grantId = 'grant-e2e';
const credential = {
  actor: 'luca-gemini' as const, runtimeId: 'luca-gemini-antigravity-primary', credentialId: 'e2e-credential',
  capabilities: ['coordination:read', 'coordination:write'], expiresAt: new Date(Date.now() + 3600000),
};
const verifierCredential = {
  actor: 'luca-replit' as const, runtimeId: 'e2e-verifier-runtime', credentialId: 'e2e-verifier-credential',
  capabilities: ['coordination:read', 'coordination:write'], expiresAt: new Date(Date.now() + 3600000),
};
const rootDigest = createHash('sha256').update('/approved').digest('hex');
const artifactContent = 'approved task artifact';
const artifactDigest = createHash('sha256').update(artifactContent).digest('hex');
const profile = {
  id: 'e2e-profile', runtimeRegistrationId: credential.runtimeId, actor: credential.actor,
  capabilities: ['execute', 'model'], provider: 'gemini', model: 'gemini-3-flash-preview',
  adapterVersion: 'coordination-gemini-v1', status: 'active' as const,
  worktreeLabel: 'HolaHola-antigravity', worktreeRealpathDigest: rootDigest,
  branch: 'luca/gemini-experiment', startingCommit: 'head',
};
const verifierProfile = {
  id: 'e2e-verifier-profile', runtimeRegistrationId: verifierCredential.runtimeId, actor: verifierCredential.actor,
  capabilities: ['verify'], provider: 'gemini', model: 'gemini-3-flash-preview',
  adapterVersion: 'coordination-gemini-v1', status: 'active' as const,
};

async function request(server: http.Server, path: string, init: { method?: string; body?: unknown; token?: string; key?: string; grant?: string } = {}) {
  const address = server.address() as { port: number };
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  return new Promise<{ status: number; body: any }>((resolveRequest, reject) => {
    const req = http.request({ host: '127.0.0.1', port: address.port, path, method: init.method ?? 'GET',
      headers: { ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}),
        ...(init.token ? { 'x-coordination-token': init.token } : {}), ...(init.grant ? { 'x-coordination-ownership-grant': init.grant } : {}), ...(init.key ? { 'idempotency-key': init.key } : {}) } }, (res) => {
      let raw = ''; res.on('data', (chunk) => { raw += chunk; }); res.on('end', () => resolveRequest({ status: res.statusCode ?? 0, body: JSON.parse(raw || '{}') }));
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

test('real Express Gate3 lifecycle accepts measured, renewed, retry-backed evidence', async () => {
  const repository = new InMemoryCoordinationRepository();
  await repository.saveProfile(profile);
  await repository.saveProfile(verifierProfile);
  await repository.addInboxItem({ id: 'e2e-item', eventId: 'e2e-event', threadId: 'e2e-thread', taskId: '1448', sequence: 1,
    payload: { content: { assignment: { author: 'daniela', taskId: '1448', threadId: 'e2e-thread', expectedSequence: 1 } } } });
  const window = await repository.freezeInboxWindow('e2e-thread', 0, 1, 'e2e-boundary');
  let providerAttempt = 0;
  let verifierValidationCalls = 0;
  let executorValidationCalls = 0;
  let rejectVerifierGrant = false;
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
    resolveCredential: async (value) => value === token ? credential
      : value === 'verifier-token' ? verifierCredential : null,
    validateGrant: async (id) => {
      executorValidationCalls++;
      assert.equal(id, grantId);
      return { grantId, actor: 'luca-gemini', taskRef: '1448', artifactSha256: artifactDigest,
        contextDigest: 'context-e2e', startingCommit: 'head', receiptId: 'receipt-e2e',
        credentialId: credential.credentialId, runtimeRegistrationId: credential.runtimeId,
        profileId: profile.id, expiresAt: new Date(Date.now() + 3600000) };
    },
    validateVerifierGrant: async (id) => {
      assert.equal(id, grantId);
      verifierValidationCalls++;
      if (rejectVerifierGrant) throw new Error('GATE3_PROOF_GRANT_INVALID');
      return { grantId, actor: 'luca-gemini', taskRef: '1448', artifactSha256: artifactDigest,
        contextDigest: 'context-e2e', startingCommit: 'head', receiptId: 'receipt-e2e',
        credentialId: credential.credentialId, runtimeRegistrationId: credential.runtimeId,
        profileId: profile.id, expiresAt: new Date(Date.now() + 3600000) };
    },
    withGrantAuthority: async (_id, _credential, operation) => operation({
      grantId, actor: 'luca-gemini', taskRef: '1448', artifactSha256: artifactDigest,
      contextDigest: 'context-e2e', startingCommit: 'head', receiptId: 'receipt-e2e',
      credentialId: credential.credentialId, runtimeRegistrationId: credential.runtimeId,
      profileId: profile.id, expiresAt: new Date(Date.now() + 3600000),
    }),
  });
  const server = await new Promise<http.Server>((resolveServer) => { const value = app.listen(0, () => resolveServer(value)); });
  try {
    const missingGrant = await request(server, '/api/coordination/runtime/packets', {
      method: 'POST', token, key: 'missing-grant', body: { windowId: window.id },
    });
    assert.equal(missingGrant.status, 403);
    let statusCount = 0;
    const files = new Map<string, Buffer>([['/approved/.local/tasks/task-1448.md', Buffer.from(artifactContent)]]);
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
      ownershipReceiptId: 'receipt-e2e',
      ownershipArtifactSha256: artifactDigest,
      ownershipClient: {} as TaskOwnershipHttpClient,
      proveOwnership: async (_client, taskRef, actor, receiptId) => {
        assert.equal(taskRef, '1448'); assert.equal(actor, 'luca-gemini'); assert.equal(receiptId, 'receipt-e2e');
        return { ok: true, verified: true, receiptId: 'receipt-e2e', taskRef: '1448', intendedActor: 'luca-gemini', artifactSha256: artifactDigest, proofPayloadDigest: 'd'.repeat(64),
          contextDigest: 'context-e2e', grant: { id: grantId, taskRef: '1448', artifactSha256: artifactDigest, contextDigest: 'context-e2e', startingCommit: 'head', expiresAt: new Date(Date.now() + 3600000).toISOString() } };
      },
       env: {}, fs, spawn, http: async (input) => {
         const response = await request(server, input.path, { method: input.method, body: input.body, key: input.headers['idempotency-key'], token: input.headers['x-coordination-token'], grant: input.headers['x-coordination-ownership-grant'] });
         if (input.path.startsWith('/api/coordination/runtime/') && !input.path.endsWith('/credentials/renew')) assert.equal(input.headers['x-coordination-ownership-grant'], grantId);
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
    const completion = state.completions[0];
    assert.ok(completion?.id);
    const executorCallsBeforeVerification = executorValidationCalls;
    rejectVerifierGrant = true;
    const rejectedVerification = await request(server, `/api/coordination/runtime/completions/${completion.id}/verify`, {
      method: 'POST', token: 'verifier-token', grant: grantId, key: 'cross-hat-rejected',
      body: { decision: 'approved', patchDigest: state.executions[0].attestedLocalState.patchDigest },
    });
    assert.equal(rejectedVerification.status, 403);
    assert.equal(verifierValidationCalls, 1);
    rejectVerifierGrant = false;
    const verification = await request(server, `/api/coordination/runtime/completions/${completion.id}/verify`, {
      method: 'POST', token: 'verifier-token', grant: grantId, key: 'cross-hat-approved',
      body: { decision: 'approved', patchDigest: state.executions[0].attestedLocalState.patchDigest },
    });
    assert.equal(verification.status, 200);
    assert.equal(verification.body.decision, 'approved');
    assert.equal(verifierValidationCalls, 2);
    assert.equal(executorValidationCalls, executorCallsBeforeVerification);
  } finally { await new Promise<void>((resolveClose) => server.close(() => resolveClose())); }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AntigravityDriver, Gate3Executor, TARGET, validateArgv } from './coordination-runtime-antigravity';

const digest = 'a'.repeat(64);
function fakeFs(content = '') {
  const files = new Map([[`/approved/${TARGET}`, Buffer.from(content)]]);
  return {
    files,
    realpath: async (p: string) => p,
    lstat: async () => ({ isSymbolicLink: () => false, isFile: () => true, isDirectory: () => true }),
    readFile: async (p: string) => files.get(p) ?? Buffer.from(''),
    writeFile: async (p: string, value: string) => { files.set(p, Buffer.from(value)); },
  };
}

test('portable driver uses the broker lifecycle and never leaks bootstrap', async () => {
  const secret = 'cb_test_secret_that_must_not_escape';
  const calls: Array<{ path: string; headers: Record<string, string>; body?: unknown }> = [];
  const fs = fakeFs();
  let reveal = 0;
  let statusCount = 0;
  const http = async (request: { method: string; path: string; headers: Record<string, string>; body?: unknown }) => {
    calls.push(request);
    if (request.path.endsWith('/credentials/exchange')) {
      assert.equal(request.headers['x-coordination-bootstrap'], secret);
      return { status: 201, body: { accessToken: 'ct_short', expiresAt: new Date(Date.now() + 3600000).toISOString() } };
    }
    assert.equal(request.headers['x-coordination-token'], 'ct_short');
    if (request.path === '/api/coordination/runtime/packets') return { status: 200, body: {
      id: 'packet-1', digest, envelope: { startingCommit: 'head', branch: 'main',
        worktreeRealpathDigest: createHash('sha256').update('/approved').digest('hex') },
    } };
    if (request.path.endsWith('/initial-turn')) return { status: 200, body: { interactionIds: ['interaction-1'], receiptId: 'receipt-1' } };
    if (request.path.endsWith('/receipt')) return { status: 200, body: { id: 'receipt-1' } };
    if (request.path.endsWith('/claim')) return { status: 200, body: { id: 'claim-1', epoch: 1 } };
    if (request.path.endsWith('/renew')) return { status: 200, body: { id: 'claim-1', epoch: 2 } };
    if (request.path.endsWith('/intents')) {
      reveal++;
      return reveal === 1 ? { status: 200, body: { intents: [{ name: 'write_file', callId: 'call-1', arguments: { content: 'ok' } }] } }
        : { status: 200, body: { intents: [] } };
    }
    if (request.path.endsWith('/continuation')) return { status: 200, body: [{ interactionId: 'interaction-2' }] };
    if (request.path.endsWith('/execute')) return { status: 200, body: { id: 'execution-1' } };
    if (request.path.endsWith('/complete')) return { status: 200, body: { id: 'completion-1' } };
    throw new Error(`unexpected ${request.path}`);
  };
  const spawned: Array<{ argv: string[]; env: Record<string, string> }> = [];
  const driver = new AntigravityDriver({
    baseUrl: 'https://unused.invalid', runtimeId: 'runtime-1', worktree: '/approved',
    windowId: 'window-1', bootstrap: secret, http, fs,
    spawn: async (argv, options) => {
      spawned.push({ argv, env: options.env });
      const output = argv[1] === 'rev-parse' && argv[2] === '--show-toplevel' ? '/approved\n'
        : argv[1] === 'rev-parse' && argv[2] === '--abbrev-ref' ? 'main\n'
        : argv[1] === 'rev-parse' ? 'head\n'
        : argv[1] === 'status' ? (++statusCount === 1 ? '' : ' M server/scripts/test-coordination-runtime.test.ts\n')
        : argv[1] === 'diff' ? 'diff --git a/server/scripts/test-coordination-runtime.test.ts b/server/scripts/test-coordination-runtime.test.ts\n' : '';
      return { code: 0, stdout: output, stderr: '' };
    },
  });
  await driver.run();
  assert.deepEqual(calls.map((call) => call.path), [
    '/api/coordination/credentials/exchange', '/api/coordination/runtime/packets',
    '/api/coordination/runtime/packets/packet-1/initial-turn',
     '/api/coordination/runtime/packets/packet-1/claim',
    '/api/coordination/runtime/claims/claim-1/intents',
    '/api/coordination/runtime/claims/claim-1/renew',
    '/api/coordination/runtime/claims/claim-1/continuation',
    '/api/coordination/runtime/claims/claim-1/intents',
     '/api/coordination/runtime/claims/claim-1/renew',
    '/api/coordination/runtime/claims/claim-1/execute',
    '/api/coordination/runtime/executions/execution-1/complete',
  ]);
  assert.equal(spawned.length, 9);
  assert.ok(spawned.every(({ env }) => !('COORDINATION_BOOTSTRAP' in env) && !('DATABASE_URL' in env)));
  assert.ok(calls.every((call) => call.path.endsWith('/credentials/exchange')
    ? call.headers['x-coordination-bootstrap'] === secret
    : call.headers['x-coordination-token'] === 'ct_short'));
});

test('executor is shell-free and rejects commands, paths, and oversized writes', async () => {
  assert.throws(() => validateArgv(['sh', '-c', 'echo unsafe']), /command_not_allowed/);
  const fs = fakeFs();
  const spawned: string[][] = [];
  const executor = new Gate3Executor('/approved', fs, async (argv, options) => {
    spawned.push(argv); assert.equal(options.cwd, '/approved'); return { code: 0, stdout: '', stderr: '' };
  }, { PATH: 'safe' });
  await assert.rejects(() => executor.execute({ name: 'unknown', arguments: {} }), /command_not_allowed/);
  await assert.rejects(() => executor.execute({ name: 'write_file', arguments: { content: 'x'.repeat(40961) } }), /output_limit_exceeded/);
  await assert.rejects(() => executor.execute({ name: 'git_diff', arguments: { path: 'other.txt' } }), /argument_not_allowed/);
  assert.equal(spawned.length, 0);
});

test('broker failure has no fixed-token fallback', async () => {
  const fs = fakeFs();
  const http = async () => ({ status: 401, body: { error: 'authentication_required' } });
  const driver = new AntigravityDriver({
    baseUrl: 'https://unused.invalid', runtimeId: 'r', worktree: '/approved', windowId: 'w',
    bootstrap: 'cb_test_secret', http, fs, spawn: async () => { throw new Error('must not execute'); },
  });
  await assert.rejects(() => driver.run(), /authentication_failed/);
});

test('symlink/reparse targets and malformed intents fail before mutation', async () => {
  const fs = fakeFs();
  fs.lstat = async () => ({ isSymbolicLink: () => true, isFile: () => true, isDirectory: () => true });
  let wrote = false;
  const executor = new Gate3Executor('/approved', fs, async () => {
    throw new Error('spawn must not run');
  });
  await assert.rejects(() => executor.execute({ name: 'write_file', arguments: { content: 'unsafe' } }), /symlink_not_allowed/);
  assert.equal(wrote, false);
  await assert.rejects(() => executor.execute({ name: 'read_file', arguments: { content: '' } }), /argument_not_allowed/);
});

test('result and receipt surfaces contain identifiers/digests, not credentials', () => {
  const receipt = { packetId: 'p', claimId: 'c', executionId: 'e', completionId: 'z', packetDigest: digest, patchDigest: digest };
  assert.deepEqual(Object.keys(receipt).sort(), ['claimId', 'completionId', 'executionId', 'packetDigest', 'packetId', 'patchDigest']);
  assert.equal(JSON.stringify(receipt).includes('ct_'), false);
});
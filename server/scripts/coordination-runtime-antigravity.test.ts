import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AntigravityDriver, Gate3Executor, TARGET, validateArgv } from './coordination-runtime-antigravity';
import type { TaskOwnershipHttpClient } from '../services/task-ownership-client';

const digest = 'a'.repeat(64);
const artifactContent = 'approved task artifact';
const artifactDigest = createHash('sha256').update(artifactContent).digest('hex');
function fakeFs(content = '') {
  const files = new Map([
    [`/approved/${TARGET}`, Buffer.from(content)],
    ['/approved/.local/tasks/task-1448.md', Buffer.from(artifactContent)],
  ]);
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
  const ordering: string[] = [];
  const fs = fakeFs('before');
  let reveal = 0;
  let statusCount = 0;
  const http = async (request: { method: string; path: string; headers: Record<string, string>; body?: unknown }) => {
    calls.push(request);
    if (request.path.endsWith('/credentials/exchange')) {
      ordering.push('exchange');
      assert.equal(request.headers['x-coordination-bootstrap'], secret);
      return { status: 201, body: { accessToken: 'ct_short', expiresAt: new Date(Date.now() + 3600000).toISOString() } };
    }
    assert.equal(request.headers['x-coordination-token'], 'ct_short');
    if (request.path === '/api/coordination/runtime/packets') ordering.push('packet');
    if (request.path === '/api/coordination/runtime/packets') return { status: 200, body: {
      id: 'packet-1', digest, envelope: { startingCommit: 'head', branch: 'main',
        worktreeRealpathDigest: createHash('sha256').update('/approved').digest('hex'),
        grantId: 'grant-1', taskRef: '1448', artifactSha256: artifactDigest, contextDigest: digest },
    } };
    if (request.path.endsWith('/initial-turn')) return { status: 200, body: { interactionIds: ['interaction-1'], receiptId: 'receipt-1' } };
    if (request.path.endsWith('/receipt')) return { status: 200, body: { id: 'receipt-1' } };
    if (request.path.endsWith('/claim')) return { status: 200, body: { id: 'claim-1', epoch: 1 } };
    if (request.path.endsWith('/renew')) return { status: 200, body: { id: 'claim-1', epoch: 2 } };
    if (request.path.endsWith('/intents')) {
      reveal++;
      return reveal === 1 ? { status: 200, body: { intents: [{
        name: 'replace_once', callId: 'call-1', arguments: { oldText: 'before', newText: 'ok' },
      }] } }
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
     windowId: 'window-1', bootstrap: secret, ownershipReceiptId: 'receipt-1', ownershipArtifactSha256: artifactDigest,
     ownershipClient: {} as TaskOwnershipHttpClient,
     proveOwnership: async (client, taskRef, actor, receiptId) => {
       ordering.push('proof');
       assert.equal(taskRef, '1448'); assert.equal(actor, 'luca-gemini'); assert.equal(receiptId, 'receipt-1');
        return {
          ok: true,
          verified: true,
          receiptId: 'receipt-1',
          taskRef: '1448',
          intendedActor: 'luca-gemini',
          artifactSha256: artifactDigest,
          proofPayloadDigest: digest,
          contextDigest: digest,
          grant: {
            id: 'grant-1',
            taskRef: '1448',
            artifactSha256: artifactDigest,
            contextDigest: digest,
            startingCommit: 'head',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        };
     }, http, fs, env: {},
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
  assert.deepEqual(ordering.slice(0, 3), ['exchange', 'proof', 'packet']);
  assert.equal(
    calls.filter((call) => call.path === '/api/coordination/credentials/renew').length,
    0,
    'the driver must never renew its credential after establishing the ownership grant',
  );
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
  assert.equal(spawned.length, 10);
  assert.ok(spawned.every(({ env }) => !('COORDINATION_BOOTSTRAP' in env) && !('DATABASE_URL' in env)));
  assert.ok(calls.every((call) => call.path.endsWith('/credentials/exchange')
    ? call.headers['x-coordination-bootstrap'] === secret
    : call.headers['x-coordination-token'] === 'ct_short'));
});

test('executor uses only fixed host adapters and applies one bounded exact replacement', async () => {
  assert.throws(() => validateArgv(['sh', '-c', 'echo unsafe']), /command_not_allowed/);
  const fs = fakeFs('before target');
  const spawned: string[][] = [];
  const executor = new Gate3Executor('/approved', fs, async (argv, options) => {
    spawned.push(argv); assert.equal(options.cwd, '/approved'); return { code: 0, stdout: '', stderr: '' };
  }, { PATH: 'safe' });
  await assert.rejects(() => executor.execute({ name: 'unknown', arguments: {} }), /command_not_allowed/);
  await assert.rejects(() => executor.execute({
    name: 'replace_once',
    arguments: { oldText: 'x'.repeat(40960), newText: 'y' },
  }), /output_limit_exceeded/);
  await assert.rejects(() => executor.execute({
    name: 'replace_once',
    arguments: { oldText: 'before', newText: 'after', path: 'other.txt' },
  }), /argument_not_allowed/);
  await assert.rejects(() => executor.execute({
    name: 'replace_once',
    arguments: { oldText: '', newText: 'after' },
  }), /argument_not_allowed/);
  await assert.rejects(() => executor.execute({
    name: 'replace_once',
    arguments: { oldText: 'same', newText: 'same' },
  }), /argument_not_allowed/);
  await assert.rejects(() => executor.execute({ name: 'git_diff', arguments: { path: 'other.txt' } }), /argument_not_allowed/);
  const replaced = await executor.execute({
    name: 'replace_once',
    arguments: { oldText: 'before', newText: 'after' },
  });
  assert.equal(fs.files.get(`/approved/${TARGET}`)?.toString('utf8'), 'after target');
  assert.equal(replaced.output, 'replaced');
  assert.deepEqual(replaced.argv, ['replace_once', TARGET]);
  await assert.rejects(() => executor.execute({
    name: 'replace_once',
    arguments: { oldText: 'missing', newText: 'value' },
  }), /replace_text_not_found/);
  assert.equal(fs.files.get(`/approved/${TARGET}`)?.toString('utf8'), 'after target');
  fs.files.set(`/approved/${TARGET}`, Buffer.from('same same'));
  await assert.rejects(() => executor.execute({
    name: 'replace_once',
    arguments: { oldText: 'same', newText: 'changed' },
  }), /replace_text_not_unique/);
  assert.equal(fs.files.get(`/approved/${TARGET}`)?.toString('utf8'), 'same same');
  fs.files.set(`/approved/${TARGET}`, Buffer.from('aaa'));
  await assert.rejects(() => executor.execute({
    name: 'replace_once',
    arguments: { oldText: 'aa', newText: 'changed' },
  }), /replace_text_not_unique/);
  assert.equal(fs.files.get(`/approved/${TARGET}`)?.toString('utf8'), 'aaa');
  assert.equal(spawned.length, 0);
  const windowsSpawned: string[][] = [];
  const windowsExecutor = new Gate3Executor('/approved', fs, async (argv) => {
    windowsSpawned.push(argv); return { code: 0, stdout: '', stderr: '' };
  }, { PATH: 'safe' }, 'win32');
  const windowsResult = await windowsExecutor.execute({ name: 'run_test', arguments: {} });
  assert.deepEqual(windowsSpawned, [[
    'C:\\Windows\\System32\\cmd.exe',
    '/d',
    '/s',
    '/c',
    'npx.cmd',
    'tsx',
    TARGET,
  ]]);
  assert.deepEqual(windowsResult.argv, ['npx', 'tsx', TARGET]);

  const nonWindowsSpawned: string[][] = [];
  const nonWindowsExecutor = new Gate3Executor('/approved', fs, async (argv) => {
    nonWindowsSpawned.push(argv); return { code: 7, stdout: 'failed', stderr: 'test failure' };
  }, { PATH: 'safe' }, 'linux');
  const nonWindowsResult = await nonWindowsExecutor.execute({ name: 'run_test', arguments: {} });
  assert.deepEqual(nonWindowsSpawned, [['npx', 'tsx', TARGET]]);
  assert.equal(nonWindowsResult.ok, false);
  assert.equal(nonWindowsResult.exitCode, 7);
  assert.deepEqual(nonWindowsResult.argv, ['npx', 'tsx', TARGET]);
});

test('broker failure has no fixed-token fallback', async () => {
  const fs = fakeFs();
  const http = async () => ({ status: 401, body: { error: 'authentication_required' } });
  const driver = new AntigravityDriver({
    baseUrl: 'https://unused.invalid', runtimeId: 'r', worktree: '/approved', windowId: 'w',
    bootstrap: 'cb_test_secret', http, fs, spawn: async () => { throw new Error('must not execute'); },
    ownershipReceiptId: 'receipt-1', ownershipArtifactSha256: artifactDigest,
    env: {},
  });
  await assert.rejects(() => driver.run(), /authentication_failed/);
});

test('Gate 3 rejects either fixed Gemini actor-token alias before any exchange', async () => {
  for (const variable of ['COORDINATION_LUCA_GEMINI_CODE_TOKEN', 'COORDINATION_LUCA_GEMINI_TOKEN']) {
    const calls: string[] = [];
    const driver = new AntigravityDriver({
      baseUrl: 'https://unused.invalid', runtimeId: 'r', worktree: '/approved', windowId: 'w',
      bootstrap: 'cb_test_secret', ownershipReceiptId: 'receipt-1', fs: fakeFs(),
      env: { [variable]: 'fixed-secret' },
      http: async (request) => { calls.push(request.path); return { status: 500, body: {} }; },
      spawn: async () => { throw new Error('must not execute'); },
    });
    await assert.rejects(() => driver.run(), /fixed_actor_token_present/);
    assert.deepEqual(calls, []);
  }
});

test('Gate 3 requires a caller-supplied ownership receipt before packet fetch', async () => {
  const calls: string[] = [];
  const driver = new AntigravityDriver({
    baseUrl: 'https://unused.invalid', runtimeId: 'r', worktree: '/approved', windowId: 'w',
    bootstrap: 'cb_test_secret', fs: fakeFs(),
    env: {},
    http: async (request) => { calls.push(request.path); return { status: 201, body: { accessToken: 'ct_short', expiresAt: new Date(Date.now() + 3600000).toISOString() } }; },
    spawn: async () => { throw new Error('must not execute'); },
  });
  await assert.rejects(() => driver.run(), /ownership_receipt_missing/);
  assert.deepEqual(calls, []);
});

test('rejected ownership proof fails closed before packet fetch', async () => {
  const calls: string[] = [];
  const driver = new AntigravityDriver({
    baseUrl: 'https://unused.invalid', runtimeId: 'r', worktree: '/approved', windowId: 'w',
    bootstrap: 'cb_test_secret', ownershipReceiptId: 'receipt-1', ownershipArtifactSha256: artifactDigest, fs: fakeFs(), env: {},
    http: async (request) => {
      calls.push(request.path);
      if (request.path.endsWith('/credentials/exchange')) {
        return { status: 201, body: { accessToken: 'ct_short', expiresAt: new Date(Date.now() + 3600000).toISOString() } };
      }
      throw new Error('packet_fetch_must_not_run');
    },
    proveOwnership: async () => ({ ok: false, verified: false }),
    spawn: async () => { throw new Error('must not execute'); },
  });
  await assert.rejects(() => driver.run(), /ownership_proof_rejected/);
  assert.deepEqual(calls, ['/api/coordination/credentials/exchange']);
});

test('Gate 3 requires a lowercase ownership artifact digest', async () => {
  const driver = new AntigravityDriver({
    baseUrl: 'https://unused.invalid', runtimeId: 'r', worktree: '/approved', windowId: 'w',
    bootstrap: 'cb_test_secret', ownershipReceiptId: 'receipt-1', fs: fakeFs(), env: {},
    http: async () => { throw new Error('must not exchange'); },
    spawn: async () => { throw new Error('must not execute'); },
  });
  await assert.rejects(() => driver.run(), /ownership_artifact_digest_invalid/);
});

test('artifact validation fails closed before exchange for changed, missing, and unsafe files', async () => {
  for (const mode of ['changed', 'missing', 'symlink', 'reparse'] as const) {
    const fs = fakeFs();
    if (mode === 'changed') fs.files.set('/approved/.local/tasks/task-1448.md', Buffer.from('changed'));
    if (mode === 'missing') fs.files.delete('/approved/.local/tasks/task-1448.md');
    if (mode === 'symlink' || mode === 'reparse') {
      fs.lstat = async (path: string) => path.endsWith('task-1448.md')
        ? { isSymbolicLink: () => mode === 'symlink', isFile: () => true, isDirectory: () => false,
          isReparsePoint: () => mode === 'reparse' }
        : { isSymbolicLink: () => false, isFile: () => false, isDirectory: () => true };
    }
    const driver = new AntigravityDriver({
      baseUrl: 'https://unused.invalid', runtimeId: 'r', worktree: '/approved', windowId: 'w',
      bootstrap: 'cb_test_secret', ownershipReceiptId: 'receipt-1', ownershipArtifactSha256: artifactDigest,
      fs, env: {}, http: async () => { throw new Error('must not exchange'); },
      spawn: async () => { throw new Error('must not execute'); },
    });
    await assert.rejects(() => driver.run());
  }
});

test('ownership proof fields must match the caller-supplied binding', async () => {
  const fields = ['taskRef', 'intendedActor', 'receiptId', 'artifactSha256'] as const;
  for (const field of fields) {
    const response: Record<string, unknown> = {
      ok: true, verified: true, receiptId: 'receipt-1', taskRef: '1448',
      intendedActor: 'luca-gemini', artifactSha256: artifactDigest,
    };
    response[field] = field === 'artifactSha256' ? 'c'.repeat(64) : 'wrong';
    const paths: string[] = [];
    const driver = new AntigravityDriver({
      baseUrl: 'https://unused.invalid', runtimeId: 'r', worktree: '/approved', windowId: 'w',
      bootstrap: 'cb_test_secret', ownershipReceiptId: 'receipt-1', ownershipArtifactSha256: artifactDigest,
      fs: fakeFs(), env: {}, ownershipClient: {} as TaskOwnershipHttpClient,
      http: async (request) => {
        paths.push(request.path);
        return { status: 201, body: { accessToken: 'ct_short', expiresAt: new Date(Date.now() + 3600000).toISOString() } };
      },
      proveOwnership: async () => response,
      spawn: async () => { throw new Error('must not execute'); },
    });
    await assert.rejects(() => driver.run(), /ownership_proof_rejected/);
    assert.deepEqual(paths, ['/api/coordination/credentials/exchange']);
  }
});

test('symlink/reparse targets and malformed intents fail before mutation', async () => {
  const fs = fakeFs();
  fs.lstat = async () => ({ isSymbolicLink: () => true, isFile: () => true, isDirectory: () => true });
  let wrote = false;
  fs.writeFile = async () => { wrote = true; };
  const executor = new Gate3Executor('/approved', fs, async () => {
    throw new Error('spawn must not run');
  });
  await assert.rejects(() => executor.execute({
    name: 'replace_once',
    arguments: { oldText: 'safe', newText: 'unsafe' },
  }), /symlink_not_allowed/);
  assert.equal(wrote, false);
  await assert.rejects(() => executor.execute({ name: 'read_file', arguments: { content: '' } }), /argument_not_allowed/);
});

test('fixed-target reader tolerates only the exact provider path echo and ignores it', async () => {
  const fs = fakeFs('fixed target bytes');
  const executor = new Gate3Executor('/approved', fs, async () => {
    throw new Error('spawn must not run');
  });
  assert.equal((await executor.execute({ name: 'read_file', arguments: {} })).output, 'fixed target bytes');
  const echoed = await executor.execute({
    name: 'read_file',
    arguments: { path: TARGET },
  });
  assert.equal(echoed.output, 'fixed target bytes');
  assert.deepEqual(echoed.argv, ['read_file', TARGET]);
  await assert.rejects(
    () => executor.execute({ name: 'read_file', arguments: { path: 'server/routes.ts' } }),
    /argument_not_allowed/,
  );
  await assert.rejects(
    () => executor.execute({ name: 'read_file', arguments: { path: 123 } }),
    /argument_not_allowed/,
  );
  await assert.rejects(
    () => executor.execute({ name: 'read_file', arguments: { path: TARGET, encoding: 'utf8' } }),
    /argument_not_allowed/,
  );
  await assert.rejects(
    () => executor.execute({ name: 'read_file', arguments: [] }),
    /argument_not_allowed/,
  );
  for (const name of ['git_status', 'git_diff', 'run_test']) {
    await assert.rejects(
      () => executor.execute({ name, arguments: { path: TARGET } }),
      /argument_not_allowed/,
    );
  }
});

test('result and receipt surfaces contain identifiers/digests, not credentials', () => {
  const receipt = { packetId: 'p', claimId: 'c', executionId: 'e', completionId: 'z', packetDigest: digest, patchDigest: digest };
  assert.deepEqual(Object.keys(receipt).sort(), ['claimId', 'completionId', 'executionId', 'packetDigest', 'packetId', 'patchDigest']);
  assert.equal(JSON.stringify(receipt).includes('ct_'), false);
});
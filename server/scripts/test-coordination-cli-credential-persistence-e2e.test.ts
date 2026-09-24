import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

/**
 * End-to-end proof that server/scripts/coordination-cli.ts -- a brand-new OS
 * process per invocation -- can run a second, third, ... command in the same
 * container/session without a fresh bootstrap, by reusing the on-disk
 * credential cache from server/services/coordination-cli-credential-cache.ts.
 *
 * Class-level coverage for the cache itself and its wiring into
 * CoordinationActorClient lives in
 * server/services/coordination-cli-credential-cache.test.ts and
 * server/scripts/test-coordination-actor-clients.test.ts. This file instead
 * spawns the real CLI binary as real child processes against a local fake
 * HTTP server, so it proves the actual wiring in coordination-cli.ts, not
 * just the library code underneath it.
 */

const root = resolve(import.meta.dirname, '../..');
const cliPath = resolve(root, 'server/scripts/coordination-cli.ts');

// A legacy per-actor static token would bypass the bootstrap/cache path
// entirely if present in the inherited environment -- strip every one of
// them so each scenario here exercises bootstrap-only authentication, which
// is what this task is about.
const LEGACY_TOKEN_ENV_NAMES = [
  'COORDINATION_LUCA_REPLIT_TOKEN',
  'COORDINATION_LUCA_CLAUDE_CODE_TOKEN',
  'COORDINATION_LUCA_GEMINI_TOKEN',
  'COORDINATION_LUCA_GEMINI_CODE_TOKEN',
  'COORDINATION_LUCA_HOLAHOLA_TOKEN',
  'COORDINATION_ALDEN_TOKEN',
  'COORDINATION_DANIELA_TOKEN',
  'COORDINATION_DAVID_TOKEN',
];

function inheritedTsxLoader(): string {
  const importFlagIndex = process.execArgv.findIndex(
    (arg, index) =>
      arg === '--import'
      && typeof process.execArgv[index + 1] === 'string'
      && /(?:^|[/\\])tsx(?:[/\\]|$)/.test(process.execArgv[index + 1]),
  );
  assert.ok(
    importFlagIndex >= 0,
    'coordination CLI credential-persistence e2e must be launched by Node with a parent-resolved tsx loader',
  );
  return process.execArgv[importFlagIndex + 1];
}

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      process.execPath,
      ['--import', inheritedTsxLoader(), cliPath, ...args],
      { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

type FakeServer = {
  url: string;
  exchangeCallsByRuntime: Map<string, number>;
  close: () => Promise<void>;
};

async function startFakeCoordinationServer(): Promise<FakeServer> {
  const exchangeCallsByRuntime = new Map<string, number>();
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyText = Buffer.concat(chunks).toString('utf8');
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/api/coordination/credentials/exchange' && req.method === 'POST') {
        let runtimeId = 'unknown-runtime';
        try {
          const parsed = JSON.parse(bodyText) as { runtimeId?: unknown };
          if (typeof parsed.runtimeId === 'string') runtimeId = parsed.runtimeId;
        } catch {
          // Fall through with the unknown-runtime sentinel; a malformed body
          // is not something these tests exercise.
        }
        const count = (exchangeCallsByRuntime.get(runtimeId) ?? 0) + 1;
        exchangeCallsByRuntime.set(runtimeId, count);
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          accessToken: `ct_${runtimeId}-exchange-${count}`,
          actor: 'luca-claude-code',
          runtimeId,
          capabilities: ['coordination:read'],
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        }));
        return;
      }
      if (url.pathname === '/api/coordination/threads' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ threads: [] }));
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `fake coordination server has no handler for ${req.method} ${url.pathname}` }));
    });
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('fake coordination server failed to bind a TCP port');
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    exchangeCallsByRuntime,
    close: () => new Promise<void>((resolveClose) => server.close(() => resolveClose())),
  };
}

function baseChildEnv(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...overrides };
  for (const name of LEGACY_TOKEN_ENV_NAMES) delete env[name];
  return env;
}

async function withTempCacheDir(run: (cacheDir: string) => Promise<void>): Promise<void> {
  const cacheDir = await mkdtemp(join(tmpdir(), 'coordination-cli-e2e-cache-'));
  try {
    await run(cacheDir);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
}

test('a second coordination-cli.ts invocation in the same session reuses the cached credential instead of re-exchanging the bootstrap', async () => {
  const fakeServer = await startFakeCoordinationServer();
  try {
    await withTempCacheDir(async (cacheDir) => {
      const env = baseChildEnv({
        COORDINATION_API_URL: fakeServer.url,
        COORDINATION_ACTOR: 'luca-claude-code',
        COORDINATION_RUNTIME_ID: 'luca-claude-code-e2e-session',
        COORDINATION_RUNTIME_BOOTSTRAP_TOKEN: 'cb_e2e-session-bootstrap-token-value',
        COORDINATION_CLI_CREDENTIAL_CACHE_DIR: cacheDir,
      });

      const first = await runCli(['list'], env);
      assert.equal(first.code, 0, `first invocation failed:\n${first.stdout}\n${first.stderr}`);

      const second = await runCli(['list'], env);
      assert.equal(second.code, 0, `second invocation failed:\n${second.stdout}\n${second.stderr}`);

      assert.equal(
        fakeServer.exchangeCallsByRuntime.get('luca-claude-code-e2e-session'),
        1,
        'a second CLI invocation in the same session must not exchange the bootstrap a second time',
      );
    });
  } finally {
    await fakeServer.close();
  }
});

test("a different runtime ID never reuses another runtime's cached credential even when sharing the same cache directory", async () => {
  const fakeServer = await startFakeCoordinationServer();
  try {
    await withTempCacheDir(async (cacheDir) => {
      const envForRuntime = (runtimeId: string): NodeJS.ProcessEnv => baseChildEnv({
        COORDINATION_API_URL: fakeServer.url,
        COORDINATION_ACTOR: 'luca-claude-code',
        COORDINATION_RUNTIME_ID: runtimeId,
        COORDINATION_RUNTIME_BOOTSTRAP_TOKEN: `cb_${runtimeId}-bootstrap-token-value`,
        COORDINATION_CLI_CREDENTIAL_CACHE_DIR: cacheDir,
      });

      const runtimeA = await runCli(['list'], envForRuntime('luca-claude-code-e2e-runtime-a'));
      assert.equal(runtimeA.code, 0, `runtime A invocation failed:\n${runtimeA.stdout}\n${runtimeA.stderr}`);

      const runtimeB = await runCli(['list'], envForRuntime('luca-claude-code-e2e-runtime-b'));
      assert.equal(runtimeB.code, 0, `runtime B invocation failed:\n${runtimeB.stdout}\n${runtimeB.stderr}`);

      assert.equal(fakeServer.exchangeCallsByRuntime.get('luca-claude-code-e2e-runtime-a'), 1);
      assert.equal(
        fakeServer.exchangeCallsByRuntime.get('luca-claude-code-e2e-runtime-b'),
        1,
        "runtime B must exchange its own bootstrap; it must never reuse runtime A's cached credential from the shared cache directory",
      );
    });
  } finally {
    await fakeServer.close();
  }
});

test('an expired cached credential is discarded by a fresh CLI invocation, which falls back to a new bootstrap exchange', async () => {
  const fakeServer = await startFakeCoordinationServer();
  try {
    await withTempCacheDir(async (cacheDir) => {
      const runtimeId = 'luca-claude-code-e2e-expired';
      const env = baseChildEnv({
        COORDINATION_API_URL: fakeServer.url,
        COORDINATION_ACTOR: 'luca-claude-code',
        COORDINATION_RUNTIME_ID: runtimeId,
        COORDINATION_RUNTIME_BOOTSTRAP_TOKEN: 'cb_e2e-expired-bootstrap-token-value',
        COORDINATION_CLI_CREDENTIAL_CACHE_DIR: cacheDir,
      });

      // Seed the on-disk cache using the exact class the CLI itself uses,
      // rather than hand-writing JSON, with an expiresAt already in the
      // past -- standing in for a credential a prior invocation cached
      // whose short TTL has since elapsed.
      const { FileCoordinationCliCredentialCache } = await import('../services/coordination-cli-credential-cache');
      const cache = new FileCoordinationCliCredentialCache(cacheDir);
      await cache.save({
        actor: 'luca-claude-code',
        runtimeId,
        accessToken: 'ct_stale-token-must-never-be-sent-to-fake-server',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      });

      const result = await runCli(['list'], env);
      assert.equal(result.code, 0, `invocation with a pre-expired cache failed:\n${result.stdout}\n${result.stderr}`);

      assert.equal(
        fakeServer.exchangeCallsByRuntime.get(runtimeId),
        1,
        'an expired cached credential must be discarded, forcing exactly one fresh bootstrap exchange',
      );
    });
  } finally {
    await fakeServer.close();
  }
});

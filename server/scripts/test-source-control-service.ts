import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  SOURCE_CONTROL_REQUIRED_CHECKS,
  SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
  SourceControlService,
} from '../services/source-control-service';

const LOCAL_OLD = '1'.repeat(40);
const LOCAL_NEW = '2'.repeat(40);
const REMOTE_NEW = '3'.repeat(40);
const KEY = '-----BEGIN OPENSSH PRIVATE KEY-----\\ntest-material\\n-----END OPENSSH PRIVATE KEY-----';

function manifest(sha: string): Record<string, unknown> {
  const checks = Object.fromEntries(SOURCE_CONTROL_REQUIRED_CHECKS.map((name) => [name, 'passed']));
  return {
    manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
    candidateSha: sha,
    checks,
    validationId: createHash('sha256')
      .update(JSON.stringify({
        manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
        candidateSha: sha,
        checks,
      }))
      .digest('hex'),
  };
}

type Scenario = 'equal' | 'local-ahead' | 'github-ahead' | 'diverged';

async function withFixture(
  scenario: Scenario,
  options: { dirty?: boolean; untracked?: boolean; missingKey?: boolean; holdLock?: boolean } = {},
): Promise<{ result: Awaited<ReturnType<SourceControlService['sync']>>; calls: string[]; status: any }> {
  const rootDir = mkdtempSync(join(tmpdir(), 'source-control-service-test-'));
  const calls: string[] = [];
  const state = {
    local: scenario === 'github-ahead' ? LOCAL_OLD : LOCAL_NEW,
    remote: scenario === 'local-ahead' ? LOCAL_OLD : scenario === 'github-ahead' ? REMOTE_NEW : LOCAL_NEW,
  };
  try {
    const env = {
      NODE_ENV: 'development',
      HOLAHOLA_GITHUB_DEPLOY_KEY: options.missingKey ? undefined : KEY,
      SOURCE_BRIDGE_STATUS_FILE: join(rootDir, 'status.json'),
      SOURCE_BRIDGE_SUMMARY_FILE: join(rootDir, 'status.md'),
      SOURCE_CONTROL_LOCK_FILE: join(rootDir, 'control.lock'),
      SOURCE_CONTROL_OPERATIONS_DIR: join(rootDir, 'operations'),
    } as NodeJS.ProcessEnv;
    if (options.holdLock) {
      writeFileSync(env.SOURCE_CONTROL_LOCK_FILE!, `${JSON.stringify({
        token: 'held',
        pid: process.pid,
        expiresAt: '2999-01-01T00:00:00.000Z',
      })}\n`);
    }
    const service = new SourceControlService({
      rootDir,
      env,
      uuid: (() => {
        let value = 0;
        return () => `fixture-${++value}`;
      })(),
      validateCandidate: async (sha) => manifest(sha),
      runCommand: async (command, args) => {
        calls.push(`${command} ${args.join(' ')}`);
        assert.equal(command, 'git', 'fixture must never route Git through a shell helper');
        const operation = args[0];
        if (operation === 'branch') return { exitCode: 0, stdout: 'main\n', stderr: '' };
        if (operation === 'status') {
          return {
            exitCode: 0,
            stdout: options.dirty ? ' M tracked-file\n' : options.untracked ? '?? untracked-source.ts\n' : '',
            stderr: '',
          };
        }
        if (operation === 'fetch') return { exitCode: 0, stdout: '', stderr: '' };
        if (operation === 'rev-parse' && args.includes('--is-shallow-repository')) {
          return { exitCode: 0, stdout: 'false\n', stderr: '' };
        }
        if (operation === 'rev-parse') {
          return { exitCode: 0, stdout: `${args.some((arg) => arg.includes('FETCH_HEAD')) ? state.remote : state.local}\n`, stderr: '' };
        }
        if (operation === 'merge-base' && args[1] !== '--is-ancestor') {
          return { exitCode: scenario === 'diverged' ? 1 : 0, stdout: '', stderr: '' };
        }
        if (operation === 'merge-base') {
          const [, , ancestor, descendant] = args;
          const isAncestor = ancestor === descendant
            || (scenario === 'local-ahead' && ancestor === state.remote && descendant === state.local)
            || (scenario === 'github-ahead' && ancestor === state.local && descendant === state.remote);
          return { exitCode: isAncestor ? 0 : 1, stdout: '', stderr: '' };
        }
        if (operation === 'push') {
          state.remote = state.local;
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (operation === 'merge' && args[1] === '--ff-only') {
          state.local = state.remote;
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        return { exitCode: 98, stdout: '', stderr: `unexpected command: ${args.join(' ')}` };
      },
    });
    const result = await service.sync('fixture');
    const status = (() => {
      try {
        return JSON.parse(readFileSync(env.SOURCE_BRIDGE_STATUS_FILE!, 'utf8'));
      } catch {
        return null;
      }
    })();
    return { result, calls, status };
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const equal = await withFixture('equal');
  assert.equal(equal.result.state, 'synced');

  const localAhead = await withFixture('local-ahead');
  assert.equal(localAhead.result.state, 'synced');
  assert.ok(localAhead.calls.some((call) => call.startsWith('git push ')));

  const githubAhead = await withFixture('github-ahead');
  assert.equal(githubAhead.result.state, 'ready_to_promote');
  assert.ok(githubAhead.calls.includes('git merge --ff-only FETCH_HEAD'));
  assert.equal(githubAhead.status.candidateSha, REMOTE_NEW);

  const dirty = await withFixture('local-ahead', { dirty: true });
  assert.equal(dirty.result.state, 'dirty');
  assert.ok(!dirty.calls.some((call) => /^git (push|merge) /.test(call)));

  const untracked = await withFixture('equal', { untracked: true });
  assert.equal(untracked.result.state, 'dirty');

  const diverged = await withFixture('diverged');
  assert.equal(diverged.result.state, 'diverged');
  assert.ok(!diverged.calls.some((call) => /^git (push|merge) /.test(call)));

  const contention = await withFixture('equal', { holdLock: true });
  assert.equal(contention.result.state, 'retrying');
  assert.deepEqual(contention.calls, []);

  const invalidCredentials = await withFixture('equal', { missingKey: true });
  assert.equal(invalidCredentials.result.state, 'failed');
  assert.match(invalidCredentials.result.error || '', /deploy[_ ]key/i);

  const production = new SourceControlService({
    rootDir: process.cwd(),
    env: { NODE_ENV: 'production', HOLAHOLA_GITHUB_DEPLOY_KEY: KEY },
  });
  assert.equal((await production.sync('fixture')).state, 'disabled');

  console.log('Source-control coordinator fixture checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
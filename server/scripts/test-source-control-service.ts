import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  SOURCE_CONTROL_REQUIRED_CHECKS,
  SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
  SourceControlService,
  materializeProtectedGitSnapshot,
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

  const snapshotCalls: Array<{ sha: string; fixedPaths: readonly string[] }> = [];
  let resolverBlobs: Record<string, Buffer> = {};
  const snapshotService = new SourceControlService({
    rootDir: mkdtempSync(join(tmpdir(), 'source-control-snapshot-no-git-')),
    env: {
      NODE_ENV: 'production',
      GITHUB_REPO_URL: 'git@github.com:davidwmcintosh/holahola.git',
    },
    resolveRemoteSnapshot: async (sha, fixedPaths) => {
      snapshotCalls.push({ sha, fixedPaths });
      resolverBlobs = Object.fromEntries(fixedPaths.map((path) => [path, Buffer.from(path)]));
      return {
        sha,
        treeSha: '4'.repeat(40),
        blobs: resolverBlobs,
      };
    },
  });
  const snapshotPaths = [
    'scripts/hola-coordinator.ps1',
    'package-lock.json',
    'server/scripts/coordination-v2-cli.ts',
  ];
  const snapshot = await snapshotService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    fixedPaths: snapshotPaths,
  });
  assert.equal(snapshot.sha, LOCAL_NEW);
  assert.equal(snapshot.treeSha, '4'.repeat(40));
  assert.deepEqual(snapshotCalls, [{
    sha: LOCAL_NEW,
    fixedPaths: [...snapshotPaths].sort(),
  }]);
  assert.deepEqual(Object.keys(snapshot.blobs), [...snapshotPaths].sort());
  snapshot.blobs['package-lock.json'][0] = 0;
  assert.equal(resolverBlobs['package-lock.json'].toString('utf8'), 'package-lock.json');
  assert.equal(snapshotCalls.length, 1, 'returned buffers must not alter resolver state');

  await assert.rejects(() => snapshotService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github.com/attacker/repository',
    fixedPaths: snapshotPaths,
  }), /protected_remote_snapshot_request_invalid/);
  for (const badPath of [
    '../package-lock.json',
    '/package-lock.json',
    'scripts\\hola-coordinator.ps1',
    'scripts/hola:coordinator.ps1',
    'scripts//hola-coordinator.ps1',
  ]) {
    await assert.rejects(() => snapshotService.resolveProtectedRemoteSnapshot({
      sha: LOCAL_NEW,
      repositoryIdentity: 'github:davidwmcintosh/holahola',
      fixedPaths: [badPath],
    }), /protected_remote_snapshot_request_invalid/);
  }
  const wrongShaService = new SourceControlService({
    env: { GITHUB_REPO_URL: 'git@github.com:davidwmcintosh/holahola.git' },
    resolveRemoteSnapshot: async (_sha, fixedPaths) => ({
      sha: REMOTE_NEW,
      treeSha: '4'.repeat(40),
      blobs: Object.fromEntries(fixedPaths.map((path) => [path, Buffer.from(path)])),
    }),
  });
  await assert.rejects(() => wrongShaService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    fixedPaths: snapshotPaths,
  }), /remote_commit_proof_mismatch/);
  const shiftedPathsService = new SourceControlService({
    env: { GITHUB_REPO_URL: 'git@github.com:davidwmcintosh/holahola.git' },
    resolveRemoteSnapshot: async (sha) => ({
      sha,
      treeSha: '4'.repeat(40),
      blobs: { 'package-lock.json': Buffer.from('{}'), 'extra.txt': Buffer.from('extra') },
    }),
  });
  await assert.rejects(() => shiftedPathsService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    fixedPaths: snapshotPaths,
  }), /protected_remote_snapshot_paths_mismatch/);
  const httpsService = new SourceControlService({
    env: { GITHUB_REPO_URL: 'https://github.com/davidwmcintosh/holahola.git' },
    resolveRemoteSnapshot: async () => {
      throw new Error('HTTPS transport must be rejected before resolver use');
    },
  });
  await assert.rejects(() => httpsService.resolveProtectedRemoteSnapshot({
    sha: LOCAL_NEW,
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    fixedPaths: snapshotPaths,
  }), /protected_remote_snapshot_request_invalid/);

  const gitFixture = mkdtempSync(join(tmpdir(), 'protected-snapshot-git-test-'));
  const sourceRepo = join(gitFixture, 'source');
  const snapshotParent = join(gitFixture, 'snapshots');
  mkdirSync(sourceRepo);
  mkdirSync(snapshotParent);
  const git = (args: string[], cwd = sourceRepo, maxBuffer = 4 * 1024 * 1024): Buffer =>
    Buffer.from(execFileSync('git', args, { cwd, encoding: 'buffer', maxBuffer }));
  try {
    git(['init']);
    git(['config', 'user.name', 'Snapshot Fixture']);
    git(['config', 'user.email', 'snapshot-fixture@example.invalid']);
    mkdirSync(join(sourceRepo, 'nested'));
    const binary = Buffer.from([0x00, 0xff, 0x80, 0x0d, 0x0a, 0x41]);
    writeFileSync(join(sourceRepo, 'nested', 'binary.dat'), binary);
    writeFileSync(join(sourceRepo, 'source.txt'), 'exact source\n');
    git(['add', '--', 'nested/binary.dat', 'source.txt']);
    git(['commit', '-m', 'fixture']);
    const sha = git(['rev-parse', 'HEAD']).toString('utf8').trim();
    const treeSha = git(['rev-parse', 'HEAD^{tree}']).toString('utf8').trim();
    const before = readdirSync(snapshotParent);
    const materialized = await materializeProtectedGitSnapshot({
      repoUrl: sourceRepo,
      sha,
      fixedPaths: ['source.txt', 'nested/binary.dat'],
      tempParent: snapshotParent,
      runGit: async (args, cwd, maxBuffer) => git(args, cwd, maxBuffer),
    });
    assert.equal(materialized.sha, sha);
    assert.equal(materialized.treeSha, treeSha);
    assert.deepEqual(materialized.blobs['nested/binary.dat'], binary);
    assert.equal(materialized.blobs['source.txt'].toString('utf8'), 'exact source\n');
    assert.deepEqual(readdirSync(snapshotParent), before, 'success must remove the bare snapshot');
    await assert.rejects(() => materializeProtectedGitSnapshot({
      repoUrl: sourceRepo,
      sha,
      fixedPaths: ['missing.txt'],
      tempParent: snapshotParent,
      runGit: async (args, cwd, maxBuffer) => git(args, cwd, maxBuffer),
    }));
    assert.deepEqual(readdirSync(snapshotParent), before, 'post-fetch failure must remove the bare snapshot');
  } finally {
    rmSync(gitFixture, { recursive: true, force: true });
  }

  console.log('Source-control coordinator fixture checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
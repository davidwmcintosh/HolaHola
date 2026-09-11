import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prepareAntigravityProvisioning } from './prepare-antigravity-provisioning';

const run = promisify(execFile);
let root: string;
let commit: string;
const secret = `cb_SECRET_SENTINEL_${'A'.repeat(43 - 'SECRET_SENTINEL_'.length)}`;
const env = () => ({ COORDINATION_RUNTIME_BOOTSTRAP_TOKEN: secret });
async function git(...args: string[]) { return (await run('git', args, { cwd: root })).stdout.trim(); }

beforeEach(async () => {
  const parent = await mkdtemp(join(tmpdir(), 'antigravity-provision-'));
  const repo = join(parent, 'repo');
  await run('git', ['init', '-b', 'main', repo]);
  await run('git', ['-C', repo, 'config', 'user.email', 'test@example.invalid']);
  await run('git', ['-C', repo, 'config', 'user.name', 'test']);
  await writeFile(join(repo, 'seed'), 'seed');
  await run('git', ['-C', repo, 'add', 'seed']);
  await run('git', ['-C', repo, 'commit', '-m', 'seed']);
  commit = (await run('git', ['-C', repo, 'rev-parse', 'HEAD'])).stdout.trim();
  root = join(parent, 'worktree');
  await run('git', ['-C', repo, 'worktree', 'add', '-b', 'luca/gemini-experiment', root, commit]);
  await run('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', commit]);
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

test('preparation materializes and emits only public data', async () => {
  const bundle = await prepareAntigravityProvisioning({ root, startingCommit: commit, env: env() });
  const artifact = await readFile(join(root, '.local/tasks/task-1448.md'), 'utf8');
  assert.match(artifact, new RegExp(commit));
  assert.equal(JSON.stringify(bundle).includes(secret), false);
  assert.equal(bundle.model, 'gemini-3-flash-preview');
  const again = await prepareAntigravityProvisioning({ root, startingCommit: commit, env: env() });
  assert.equal(again.artifactSha256, bundle.artifactSha256);
  await writeFile(join(root, '.local/tasks/task-1448.md'), 'conflict');
  await assert.rejects(() => prepareAntigravityProvisioning({ root, startingCommit: commit, env: env() }), /artifact_conflict/);
});

test('preparation fails closed for worktree, head, remote, and bootstrap invariants', async () => {
  await assert.rejects(() => prepareAntigravityProvisioning({ root, startingCommit: commit, env: { ...env(), FIXED: 'x', COORDINATION_LUCA_GEMINI_CODE_TOKEN: 'sentinel' } }), /fixed_actor_token/);
  await assert.rejects(() => prepareAntigravityProvisioning({ root, startingCommit: commit, env: { ...env(), COORDINATION_RUNTIME_BOOTSTRAP_TOKEN: 'cb_weak' } }), /bootstrap_format/);
  await run('git', ['-C', root, 'update-ref', '-d', 'refs/remotes/origin/main']);
  await assert.rejects(() => prepareAntigravityProvisioning({ root, startingCommit: commit, env: env() }), /remote_head/);
  await run('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', commit]);
  await writeFile(join(root, 'dirty'), 'x');
  await assert.rejects(() => prepareAntigravityProvisioning({ root, startingCommit: commit, env: env() }), /dirty_worktree/);
});

test('production preparation removes bootstrap from subprocess environment before Git checks', async () => {
  const source = await readFile(new URL('./prepare-antigravity-provisioning.ts', import.meta.url), 'utf8');
  const functionStart = source.indexOf('export async function prepareAntigravityProvisioning');
  const deleteAt = source.indexOf('delete process.env.COORDINATION_RUNTIME_BOOTSTRAP_TOKEN', functionStart);
  const firstGitAt = source.indexOf('await git(', functionStart);
  assert.ok(deleteAt > functionStart, 'production bootstrap must be removed');
  assert.ok(firstGitAt > deleteAt, 'bootstrap must be removed before the first Git subprocess');
});

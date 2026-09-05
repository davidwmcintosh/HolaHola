import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyTaskOwnership,
  TaskOwnershipService,
  type TaskOwnershipEvidence,
} from '../services/task-ownership-service';

async function fixture(gitKind: 'primary' | 'linked' | 'none', taskRef = '1391') {
  const root = await mkdtemp(join(tmpdir(), 'task-ownership-'));
  if (gitKind === 'primary') await mkdir(join(root, '.git'));
  if (gitKind === 'linked') await writeFile(join(root, '.git'), 'gitdir: /tmp/example-worktree\n');
  const taskDir = join(root, '.local', 'tasks');
  await mkdir(taskDir, { recursive: true });
  const taskPath = join(taskDir, `task-${taskRef}.md`);
  const snapshot = async () => (await readdir(root, { recursive: true })).sort();
  return { root, taskPath, snapshot, cleanup: () => rm(root, { recursive: true, force: true }) };
}

const baseEvidence = (overrides: Partial<TaskOwnershipEvidence>): TaskOwnershipEvidence => ({
  taskRef: '1391',
  taskArtifact: { path: '/workspace/.local/tasks/task-1391.md', exists: true, regularFile: true, sha256: 'a'.repeat(64), size: 10 },
  checkout: { kind: 'primary_worktree', gitMetadataPath: '/workspace/.git' },
  verifiedActiveMainReceipt: false,
  ...overrides,
});

assert.equal(classifyTaskOwnership(baseEvidence({ verifiedActiveMainReceipt: true })).state, 'main_session');
assert.equal(classifyTaskOwnership(baseEvidence({ checkout: { kind: 'linked_worktree', gitMetadataPath: '/workspace/.git' } })).state, 'isolated_agent');
assert.equal(classifyTaskOwnership(baseEvidence({})).state, 'unknown_stop');
assert.equal(classifyTaskOwnership(baseEvidence({
  checkout: { kind: 'linked_worktree', gitMetadataPath: '/workspace/.git' },
  verifiedActiveMainReceipt: true,
})).state, 'unknown_stop');

{
  const f = await fixture('primary');
  try {
    await writeFile(f.taskPath, '# historical task\n');
    const before = await f.snapshot();
    const result = await new TaskOwnershipService({ rootDir: f.root }).probe('1391');
    const after = await f.snapshot();
    assert.equal(result.state, 'unknown_stop');
    assert.match(result.explanation, /historical task artifact/i);
    assert.deepEqual(after, before, 'probe must not write workspace files');
  } finally { await f.cleanup(); }
}

{
  const f = await fixture('linked');
  try {
    await writeFile(f.taskPath, '# assigned task\n');
    const result = await new TaskOwnershipService({ rootDir: f.root }).probe('1391');
    assert.equal(result.state, 'isolated_agent');
    assert.equal(result.evidence.taskArtifact.sha256?.length, 64);
  } finally { await f.cleanup(); }
}

{
  const f = await fixture('none');
  try {
    const result = await new TaskOwnershipService({ rootDir: f.root }).probe('1391');
    assert.equal(result.state, 'unknown_stop');
    assert.equal(result.evidence.taskArtifact.exists, false);
  } finally { await f.cleanup(); }
}

{
  const f = await fixture('primary');
  try {
    await symlink('/tmp', f.taskPath);
    const result = await new TaskOwnershipService({ rootDir: f.root }).probe('1391');
    assert.equal(result.state, 'unknown_stop');
    assert.ok(result.contradictions.length > 0);
  } finally { await f.cleanup(); }
}

{
  const f = await fixture('primary');
  try {
    await writeFile(f.taskPath, '# current task\n');
    const result = await new TaskOwnershipService({
      rootDir: f.root,
      verifyActiveMainReceipt: async (ref) => ref === '1391',
    }).probe('1391');
    assert.equal(result.state, 'main_session');
  } finally { await f.cleanup(); }
}

for (const invalid of ['', '0', '-1', '1.5', 'abc', ' 1']) {
  const f = await fixture('none');
  try {
    await assert.rejects(() => new TaskOwnershipService({ rootDir: f.root }).probe(invalid), /positive decimal digits/);
  } finally { await f.cleanup(); }
}

console.log('task ownership service: PASS');
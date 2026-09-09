import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

function run(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, output }));
  });
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

{
  const f = await fixture('linked');
  try {
    const root = resolve(import.meta.dirname, '../..');
    const selfCheckPath = join(root, 'server/scripts/test-coordination-credential-broker-selfcheck.ts');
    const selfCheckSource = await readFile(selfCheckPath, 'utf8');
    const fixtureScriptsDir = join(f.root, 'server', 'scripts');
    const fixtureSelfCheckPath = join(fixtureScriptsDir, 'test-coordination-credential-broker-selfcheck.ts');
    const fixtureProbePath = join(fixtureScriptsDir, 'tsx-child-probe.ts');
    await mkdir(fixtureScriptsDir, { recursive: true });
    await writeFile(join(f.root, 'package.json'), '{"type":"module"}\n');
    await copyFile(selfCheckPath, fixtureSelfCheckPath);
    await writeFile(
      join(f.root, 'server', 'ci-database.ts'),
      "export function getVerifiedCiDatabaseUrl(): string | null { return null; }\n",
    );
    await writeFile(
      fixtureProbePath,
      "const inheritedDependency: string = 'resolved from parent';\nconsole.log(`tsx child probe: ${inheritedDependency}`);\n",
    );
    const fixtureEntries = await readdir(f.root);
    assert.ok(
      !fixtureEntries.includes('node_modules'),
      'linked-worktree fixture must not have a local node_modules directory',
    );
    assert.match(
      selfCheckSource,
      /spawn\(\s*process\.execPath,\s*\[\s*'--import',\s*inheritedTsxLoader\(\)/s,
      'credential-broker self-check must launch Node with the inherited parent-resolved tsx loader',
    );
    assert.doesNotMatch(
      selfCheckSource,
      /node_modules\/\.bin\/tsx/,
      'credential-broker self-check must not regress to a worktree-local node_modules/.bin/tsx executable',
    );

    const parentImportIndex = process.execArgv.findIndex(
      (arg, index) =>
        arg === '--import'
        && typeof process.execArgv[index + 1] === 'string'
        && /(?:^|[/\\])tsx(?:[/\\]|$)/.test(process.execArgv[index + 1]),
    );
    assert.ok(parentImportIndex >= 0, 'test runner must expose its parent-resolved tsx loader');
    const parentTsxLoader = process.execArgv[parentImportIndex + 1];

    const result = await run(
      process.execPath,
      [
        '--import',
        parentTsxLoader,
        fixtureSelfCheckPath,
        '--probe-child-launch',
        fixtureProbePath,
      ],
      {
        cwd: f.root,
        env: process.env,
      },
    );
    assert.equal(
      result.code,
      0,
      `credential-broker self-check must launch a TypeScript child from a linked worktree without local node_modules:\n${result.output}`,
    );
    assert.match(
      result.output,
      /tsx child probe: resolved from parent/,
      `credential-broker self-check did not execute its nested TypeScript child with the parent loader:\n${result.output}`,
    );

    const localExecutableSource = selfCheckSource.replace(
      /process\.execPath,\s*\[\s*'--import',\s*inheritedTsxLoader\(\),/s,
      "resolve(root, 'node_modules/.bin/tsx'), [",
    );
    assert.notEqual(
      localExecutableSource,
      selfCheckSource,
      'worktree-local executable mutation must change the child launcher',
    );
    await writeFile(fixtureSelfCheckPath, localExecutableSource);
    const mutantResult = await run(
      process.execPath,
      [
        '--import',
        parentTsxLoader,
        fixtureSelfCheckPath,
        '--probe-child-launch',
        fixtureProbePath,
      ],
      { cwd: f.root, env: process.env },
    );
    assert.notEqual(
      mutantResult.code,
      0,
      'worktree-local node_modules/.bin/tsx regression unexpectedly launched the nested child',
    );
    assert.match(
      mutantResult.output,
      /node_modules[\\/]\.bin[\\/]tsx|ENOENT/,
      `worktree-local executable regression failed for the wrong reason:\n${mutantResult.output}`,
    );
  } finally { await f.cleanup(); }
}

console.log('task ownership service: PASS');
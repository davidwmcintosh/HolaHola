import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTaskAgentEnvironmentDiagnostic } from '../services/task-agent-environment-diagnostic';

const root = await mkdtemp(join(tmpdir(), 'task-agent-environment-diagnostic-'));
try {
  await mkdir(join(root, '.git'));
  await mkdir(join(root, '.local', 'tasks'), { recursive: true });
  await writeFile(join(root, '.local', 'tasks', 'task-1443.md'), '# diagnostic task\n');
  const snapshot = async () => (await readdir(root, { recursive: true })).sort();
  const before = await snapshot();
  const env = {
    REPL_ID: 'main-repl-identifier',
    REPLIT_ENVIRONMENT: 'development',
    REPLIT_AGENT_TOKEN: 'must-never-appear',
    TASK_ASSIGNMENT_ID: 'task-assignment-name-only',
    DATABASE_URL: 'must-also-never-appear',
    UNRELATED: 'not-reported',
  };

  const report = await buildTaskAgentEnvironmentDiagnostic({
    taskRef: '1443',
    rootDir: root,
    env,
  });
  const serialized = JSON.stringify(report);
  const after = await snapshot();

  assert.equal(report.ownership.state, 'unknown_stop');
  assert.equal(report.ownership.evidence.taskArtifact.path, '.local/tasks/task-1443.md');
  assert.equal(report.ownership.evidence.checkout.gitMetadataPath, '.git');
  assert.ok(report.relevantEnvironmentVariableNames.includes('REPLIT_AGENT_TOKEN'));
  assert.ok(report.relevantEnvironmentVariableNames.includes('TASK_ASSIGNMENT_ID'));
  assert.ok(!report.relevantEnvironmentVariableNames.includes('DATABASE_URL'));
  assert.ok(!report.relevantEnvironmentVariableNames.includes('UNRELATED'));
  assert.equal(report.identityDigests.REPL_ID?.length, 64);
  assert.equal(report.identityDigests.REPLIT_ENVIRONMENT?.length, 64);
  assert.ok(!Object.hasOwn(report.identityDigests, 'REPLIT_AGENT_TOKEN'));
  assert.ok(!serialized.includes('main-repl-identifier'));
  assert.ok(!serialized.includes('development'));
  assert.ok(!serialized.includes('must-never-appear'));
  assert.ok(!serialized.includes('task-assignment-name-only'));
  assert.ok(!serialized.includes('must-also-never-appear'));
  assert.deepEqual(after, before, 'diagnostic must not write workspace files');

  const changed = await buildTaskAgentEnvironmentDiagnostic({
    taskRef: '1443',
    rootDir: root,
    env: { ...env, REPL_ID: 'different-isolated-copy' },
  });
  assert.notEqual(changed.identityDigests.REPL_ID, report.identityDigests.REPL_ID);
  console.log('Task-agent environment diagnostic tests passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}

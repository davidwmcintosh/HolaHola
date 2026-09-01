import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'scripts', 'production-uptime-monitor.mjs');
const testPath = path.join(root, 'scripts', 'production-uptime-monitor.test.mjs');

function runTests(testFile) {
  return spawnSync(process.execPath, ['--test', testFile], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
}

async function proveMutationFails({ name, needle, replacement }) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'uptime-monitor-selfcheck-'));
  try {
    const source = await readFile(sourcePath, 'utf8');
    const tests = await readFile(testPath, 'utf8');
    const occurrences = source.split(needle).length - 1;
    assert.equal(occurrences, 1, `${name}: mutation needle must appear exactly once`);

    const mutatedSource = source.replace(needle, replacement);
    const mutatedSourcePath = path.join(tempDirectory, 'production-uptime-monitor.mjs');
    const mutatedTestPath = path.join(tempDirectory, 'production-uptime-monitor.test.mjs');
    await writeFile(mutatedSourcePath, mutatedSource);
    await writeFile(mutatedTestPath, tests);

    const result = runTests(mutatedTestPath);
    assert.notEqual(
      result.status,
      0,
      `${name}: mutated monitor unexpectedly passed its behavioral tests`,
    );
    console.log(`[uptime-monitor-selfcheck] ${name}: mutation correctly failed`);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

const normal = runTests(testPath);
assert.equal(
  normal.status,
  0,
  `normal monitor tests failed:\n${normal.stdout}\n${normal.stderr}`,
);

await proveMutationFails({
  name: 'outage threshold',
  needle: 'const ALERT_AFTER_FAILURES = 2;',
  replacement: 'const ALERT_AFTER_FAILURES = 1;',
});

await proveMutationFails({
  name: 'duplicate suppression',
  needle: "if (failures >= ALERT_AFTER_FAILURES && outageSms === 'none') {",
  replacement: 'if (failures >= ALERT_AFTER_FAILURES) {',
});

console.log('[uptime-monitor-selfcheck] PASS');

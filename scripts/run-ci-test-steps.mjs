/**
 * Execute the commands in the canonical `npm test` chain one at a time.
 *
 * The local command intentionally remains the source of truth. CI uses this
 * runner only so a failure is reported with its exact command rather than the
 * opaque exit code produced by a long shell `&&` chain.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const testChain = packageJson.scripts?.test;

if (typeof testChain !== 'string' || !testChain.trim()) {
  throw new Error('package.json must define a non-empty scripts.test command');
}

const commands = testChain
  .split(/\s+&&\s+/)
  .map((command) => command.trim())
  .filter(Boolean);

if (commands.length === 0) {
  throw new Error('No executable commands were found in package.json scripts.test');
}

// This DB-backed ownership test is deterministic on its own but races with
// other test files when Node launches the large multi-file batch in parallel.
// Keep the canonical command list intact while giving this security-sensitive
// test its own process in CI.
const ISOLATED_TEST_FILE = 'server/__tests__/global-pool-conversation-leak-guard.test.ts';

function run(command) {
  return new Promise((resolveRun) => {
    const child = spawn(command, {
      cwd: root,
      env: process.env,
      shell: true,
      stdio: 'inherit',
    });

    child.on('error', (error) => resolveRun({ code: 1, error }));
    child.on('close', (code, signal) => resolveRun({ code, signal }));
  });
}

function commandParts(command) {
  if (!command.includes(ISOLATED_TEST_FILE)) {
    return [command];
  }

  const sharedBatch = command.replace(` ${ISOLATED_TEST_FILE}`, '').trim();
  if (!sharedBatch || sharedBatch === command) {
    throw new Error(`Could not isolate ${ISOLATED_TEST_FILE} from the CI test command`);
  }

  return [
    sharedBatch,
    `npx tsx --test ${ISOLATED_TEST_FILE}`,
  ];
}

for (const [index, command] of commands.entries()) {
  const label = `[ci:test ${index + 1}/${commands.length}]`;
  const parts = commandParts(command);

  for (const [partIndex, part] of parts.entries()) {
    const partLabel = parts.length === 1 ? label : `${label} PART ${partIndex + 1}/${parts.length}`;
    console.log(`${partLabel} START: ${part}`);

    const result = await run(part);
    if (result.error || result.code !== 0 || result.signal) {
      const reason = result.error
        ? result.error.message
        : result.signal
          ? `signal ${result.signal}`
          : `exit ${result.code}`;
      console.error(`${partLabel} FAILED (${reason}): ${part}`);
      process.exitCode = typeof result.code === 'number' && result.code !== 0 ? result.code : 1;
      break;
    }

    console.log(`${partLabel} PASSED`);
  }

  if (process.exitCode) {
    break;
  }
}

if (!process.exitCode) {
  console.log(`[ci:test] ALL ${commands.length} COMMANDS PASSED`);
}
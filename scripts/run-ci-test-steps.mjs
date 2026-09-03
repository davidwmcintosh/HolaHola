/**
 * Execute commands in the canonical `npm test` chain one at a time.
 *
 * The local command intentionally remains the source of truth. CI uses this
 * runner only so a failure is reported with its exact command rather than the
 * opaque exit code produced by a long shell `&&` chain. Named groups allow
 * independent portions of that chain to run in parallel in GitHub Actions.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not new URL(...).pathname -- on Windows a file:// URL's
// .pathname keeps its leading slash (e.g. "/C:/Users/..."), which
// path.resolve() does not parse as an absolute Windows path, producing a
// doubled drive letter ("C:\C:\Users\..."). fileURLToPath handles this
// correctly on every platform.
const root = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const testChain = packageJson.scripts?.test;

function assertSafeCiDatabaseConfiguration() {
  if (process.env.CI !== 'true') return;

  const ciDatabaseUrl = process.env.CI_DATABASE_URL;
  if (!ciDatabaseUrl) {
    throw new Error(
      'GitHub CI requires CI_DATABASE_URL for its isolated PostgreSQL service; refusing to fall back to a live database URL',
    );
  }

  let parsed;
  try {
    parsed = new URL(ciDatabaseUrl);
  } catch {
    throw new Error('CI_DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  const safeHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !safeHosts.has(parsed.hostname)) {
    throw new Error('CI_DATABASE_URL must target the job-local PostgreSQL service, not an external database');
  }

  if (process.env.NEON_SHARED_DATABASE_URL !== ciDatabaseUrl) {
    throw new Error(
      'NEON_SHARED_DATABASE_URL must exactly match CI_DATABASE_URL in GitHub CI so DB-backed tests cannot use a live database',
    );
  }
}

assertSafeCiDatabaseConfiguration();

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

const GROUPS = {
  unit: {
    startsWith: 'npx tsx --test server/scripts/gemini-gate-check.test.ts',
    endsWith: 'server/scripts/test-record-pattern-signal.test.ts',
  },
  guards: {
    startsWith: 'npx tsx server/scripts/test-openai-pronunciation-error-notice.ts',
    endsWith: 'server/scripts/test-reach-north-star-response-field.ts',
  },
  episodes: {
    startsWith: 'npx tsx server/scripts/seed-episode1.ts',
    endsWith: 'server/scripts/test-north-star-resync-debounce.ts',
  },
};

function findGroupRange(name, definition) {
  const start = commands.findIndex((command) => command.startsWith(definition.startsWith));
  const end = commands.findIndex((command) => command.endsWith(definition.endsWith));

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `Could not locate the ${name} CI test group boundaries in package.json scripts.test`,
    );
  }

  return { start, end };
}

const groupRanges = Object.fromEntries(
  Object.entries(GROUPS).map(([name, definition]) => [name, findGroupRange(name, definition)]),
);

const ranges = Object.values(groupRanges);
const coveredCommandIndexes = ranges.flatMap(({ start, end }) =>
  Array.from({ length: end - start + 1 }, (_, offset) => start + offset),
);
const expectedCommandIndexes = Array.from({ length: commands.length }, (_, index) => index);

if (
  coveredCommandIndexes.length !== expectedCommandIndexes.length ||
  coveredCommandIndexes.some((index, position) => index !== expectedCommandIndexes[position])
) {
  throw new Error('CI test groups must cover the canonical test command chain contiguously');
}

const requestedGroup = process.argv.slice(2).find((argument) => argument.startsWith('--group='));
const groupName = requestedGroup?.slice('--group='.length);

if (groupName && !Object.hasOwn(groupRanges, groupName)) {
  throw new Error(
    `Unknown CI test group "${groupName}". Expected one of: ${Object.keys(groupRanges).join(', ')}`,
  );
}

const selectedRange = groupName ? groupRanges[groupName] : { start: 0, end: commands.length - 1 };
const selectedCommands = commands.slice(selectedRange.start, selectedRange.end + 1);

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

for (const [index, command] of selectedCommands.entries()) {
  const canonicalIndex = selectedRange.start + index;
  const label = groupName
    ? `[ci:test:${groupName} ${index + 1}/${selectedCommands.length} (command ${canonicalIndex + 1}/${commands.length})]`
    : `[ci:test ${index + 1}/${commands.length}]`;
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
  const suffix = groupName ? ` GROUP ${groupName}` : '';
  console.log(`[ci:test] ALL ${selectedCommands.length} COMMANDS${suffix} PASSED`);
}
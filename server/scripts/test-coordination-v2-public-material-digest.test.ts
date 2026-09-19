import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  parseCoordinationV2DigestCliArgs,
  computeCoordinationV2PublicMaterialDigestForPolicy,
  runCoordinationV2DigestCli,
  CoordinationV2DigestCliUsageError,
  HELP_TEXT,
} from './coordination-v2-public-material-digest';
import { buildCoordinationV2PublicConfig } from '../services/coordination-v2-public-config';
import { computeCoordinationPublicMaterialDigest } from './coordination-windows-prepare';
import {
  CoordinationTaskMetadataError,
  type CoordinationTaskMetadataRegistry,
} from '../services/coordination-task-metadata-service';
import { PolicyValidationError } from '../services/coordination-policy-canonicalization';

const execFile = promisify(execFileCallback);

const MINIMAL_POLICY = Object.freeze({
  hostTypes: ['windows'],
  providerOrder: ['gemini'],
  sessionDurationMs: 900_000,
  totalAttemptBudget: 2,
});

function fakeRegistry(options?: {
  repositoryIdentity?: string;
  artifact?: Uint8Array;
  taskArtifactSha256?: string;
}): CoordinationTaskMetadataRegistry {
  const artifact = options?.artifact ?? new TextEncoder().encode('{"task":"fixture"}');
  const taskArtifactSha256 = options?.taskArtifactSha256
    ?? createHash('sha256').update(artifact).digest('hex');
  return {
    resolve: async (taskRef: string) => ({
      taskRef,
      taskArtifactSha256,
      repositoryIdentity: options?.repositoryIdentity ?? 'github:owner/repo',
      startingCommit: 'a'.repeat(40),
    }),
    readArtifact: async () => artifact,
  };
}

// ── parseCoordinationV2DigestCliArgs ────────────────────────────────────────

type ValidArgs = { taskRef: string; promotedCommitSha: string; exactTreeSha: string; policyPath: string };
const VALID: ValidArgs = {
  taskRef: '9001', promotedCommitSha: 'a'.repeat(40), exactTreeSha: 'b'.repeat(40), policyPath: 'p.json',
};
const FLAGS: Record<keyof ValidArgs, string> = {
  taskRef: '--task-ref', promotedCommitSha: '--promoted-commit-sha',
  exactTreeSha: '--exact-tree-sha', policyPath: '--policy',
};
function buildArgs(overrides: Partial<ValidArgs> = {}, omit: (keyof ValidArgs)[] = []): string[] {
  const merged = { ...VALID, ...overrides };
  const omitted = new Set(omit);
  const args: string[] = [];
  for (const key of Object.keys(VALID) as (keyof ValidArgs)[]) {
    if (omitted.has(key)) continue;
    args.push(FLAGS[key], merged[key]);
  }
  return args;
}

test('parseCoordinationV2DigestCliArgs accepts full valid input and defaults format to text', () => {
  assert.deepEqual(parseCoordinationV2DigestCliArgs(buildArgs()), {
    taskRef: VALID.taskRef, promotedCommitSha: VALID.promotedCommitSha,
    exactTreeSha: VALID.exactTreeSha, policyPath: VALID.policyPath, format: 'text',
  });
  assert.equal(
    parseCoordinationV2DigestCliArgs([...buildArgs({ promotedCommitSha: 'a'.repeat(64) }), '--format', 'json']).format,
    'json',
  );
});

test('parseCoordinationV2DigestCliArgs rejects missing, malformed, duplicate, or unsupported input', () => {
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({}, ['taskRef'])), CoordinationV2DigestCliUsageError);
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({ taskRef: 'not-a-number' })));
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({ taskRef: '0' })));
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({}, ['promotedCommitSha'])));
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({ promotedCommitSha: 'z'.repeat(40) })));
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({ promotedCommitSha: 'a'.repeat(39) })));
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({}, ['exactTreeSha'])));
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({ exactTreeSha: 'short' })));
  // exactTreeSha is git tree sha1 only -- unlike promotedCommitSha it must not accept 64-hex.
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({ exactTreeSha: 'b'.repeat(64) })));
  assert.throws(() => parseCoordinationV2DigestCliArgs(buildArgs({}, ['policyPath'])));
  assert.throws(() => parseCoordinationV2DigestCliArgs([...buildArgs(), '--format', 'xml']));
  assert.throws(() => parseCoordinationV2DigestCliArgs([...buildArgs(), '--unknown', 'x']));
  assert.throws(() => parseCoordinationV2DigestCliArgs([...buildArgs(), '--task-ref', '9002']));
  assert.throws(() => parseCoordinationV2DigestCliArgs(['--task-ref']));
  assert.throws(() => parseCoordinationV2DigestCliArgs(['not-a-flag']));
});

// ── computeCoordinationV2PublicMaterialDigestForPolicy ──────────────────────

test('computed digest matches the exact production preparation-time computation', async () => {
  const artifact = new TextEncoder().encode('{"task":"fixture-9002"}');
  const registry = fakeRegistry({ artifact, repositoryIdentity: 'github:owner/repo' });
  const policy = { ...MINIMAL_POLICY, hostConstraints: { windowsPublicMaterialDigest: 'f'.repeat(64) } };

  const result = await computeCoordinationV2PublicMaterialDigestForPolicy({
    taskRef: '9002', promotedCommitSha: 'a'.repeat(40), exactTreeSha: 'b'.repeat(40), policy,
  }, registry);

  // Reproduce exactly what issueCoordinationV2PreparationEnvelope computes at
  // preparation time (buildCoordinationV2PublicConfig, then hash the task
  // artifact plus the emitted config) and confirm the CLI's answer is
  // byte-for-byte what the server will require.
  const materialConfig = buildCoordinationV2PublicConfig({
    repositoryIdentity: 'github:owner/repo', promotedCommitSha: 'a'.repeat(40), exactTreeSha: 'b'.repeat(40), policy,
  });
  const expected = computeCoordinationPublicMaterialDigest({
    'task-artifact': artifact,
    'coordinator-config.json': materialConfig.config,
  });
  assert.equal(result.windowsPublicMaterialDigest, expected);
  assert.equal(result.policyDigestAsGiven, materialConfig.policyDigest);
  assert.equal(result.repositoryIdentity, 'github:owner/repo');
  assert.equal(result.taskArtifactSha256, createHash('sha256').update(artifact).digest('hex'));
});

test('a placeholder or a different pinned value at windowsPublicMaterialDigest does not change the computed digest', async () => {
  const registry = fakeRegistry();
  const base = { taskRef: '9001', promotedCommitSha: 'a'.repeat(40), exactTreeSha: 'b'.repeat(40) };
  const withPlaceholder = await computeCoordinationV2PublicMaterialDigestForPolicy({
    ...base,
    policy: {
      ...MINIMAL_POLICY,
      hostConstraints: { windowsRepositoryBranch: 'main', windowsPublicMaterialDigest: '0'.repeat(64) },
    },
  }, registry);
  const withDifferentRealValue = await computeCoordinationV2PublicMaterialDigestForPolicy({
    ...base,
    policy: {
      ...MINIMAL_POLICY,
      hostConstraints: { windowsRepositoryBranch: 'main', windowsPublicMaterialDigest: 'f'.repeat(64) },
    },
  }, registry);
  const withoutDigestField = await computeCoordinationV2PublicMaterialDigestForPolicy({
    ...base,
    policy: { ...MINIMAL_POLICY, hostConstraints: { windowsRepositoryBranch: 'main' } },
  }, registry);
  // The value (or complete absence) of hostConstraints.windowsPublicMaterialDigest
  // in the *input* policy must never change the computed digest: that field is
  // stripped before hashing, which is exactly why a founder can compute this
  // value without already knowing it.
  assert.equal(withPlaceholder.windowsPublicMaterialDigest, withDifferentRealValue.windowsPublicMaterialDigest);
  assert.equal(withPlaceholder.windowsPublicMaterialDigest, withoutDigestField.windowsPublicMaterialDigest);
});

test('changing policy content changes the computed digest', async () => {
  const registry = fakeRegistry();
  const base = { taskRef: '9001', promotedCommitSha: 'a'.repeat(40), exactTreeSha: 'b'.repeat(40) };
  const a = await computeCoordinationV2PublicMaterialDigestForPolicy({ ...base, policy: MINIMAL_POLICY }, registry);
  const b = await computeCoordinationV2PublicMaterialDigestForPolicy({
    ...base, policy: { ...MINIMAL_POLICY, totalAttemptBudget: 3 },
  }, registry);
  assert.notEqual(a.windowsPublicMaterialDigest, b.windowsPublicMaterialDigest);
});

test('a registry that cannot prove the task artifact rejects with CoordinationTaskMetadataError', async () => {
  const registry = fakeRegistry({ taskArtifactSha256: '0'.repeat(64) });
  await assert.rejects(
    () => computeCoordinationV2PublicMaterialDigestForPolicy({
      taskRef: '9001', promotedCommitSha: 'a'.repeat(40), exactTreeSha: 'b'.repeat(40), policy: MINIMAL_POLICY,
    }, registry),
    (error: unknown) => error instanceof CoordinationTaskMetadataError,
  );
});

test('an invalid policy document rejects with PolicyValidationError', async () => {
  const registry = fakeRegistry();
  await assert.rejects(
    () => computeCoordinationV2PublicMaterialDigestForPolicy({
      taskRef: '9001', promotedCommitSha: 'a'.repeat(40), exactTreeSha: 'b'.repeat(40),
      policy: { hostTypes: ['windows'] }, // missing required providerOrder/sessionDurationMs/totalAttemptBudget
    }, registry),
    (error: unknown) => error instanceof PolicyValidationError,
  );
});

// ── runCoordinationV2DigestCli (file IO) ────────────────────────────────────

test('runCoordinationV2DigestCli reads a policy file end-to-end and text/json formats agree', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coordination-v2-digest-cli-'));
  try {
    const policyPath = join(directory, 'policy.json');
    await writeFile(policyPath, JSON.stringify({
      ...MINIMAL_POLICY, hostConstraints: { windowsPublicMaterialDigest: 'placeholder-not-yet-known' },
    }));
    const registry = fakeRegistry();
    const args = ['--task-ref', '9001', '--promoted-commit-sha', 'a'.repeat(40),
      '--exact-tree-sha', 'b'.repeat(40), '--policy', policyPath];

    const textRun = await runCoordinationV2DigestCli(args, registry);
    assert.equal(textRun.format, 'text');
    assert.match(textRun.result.windowsPublicMaterialDigest, /^[0-9a-f]{64}$/);

    const jsonRun = await runCoordinationV2DigestCli([...args, '--format', 'json'], registry);
    assert.equal(jsonRun.format, 'json');
    assert.equal(jsonRun.result.windowsPublicMaterialDigest, textRun.result.windowsPublicMaterialDigest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('runCoordinationV2DigestCli rejects an unreadable, malformed, or non-object policy file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coordination-v2-digest-cli-'));
  try {
    const registry = fakeRegistry();
    const baseArgs = ['--task-ref', '9001', '--promoted-commit-sha', 'a'.repeat(40), '--exact-tree-sha', 'b'.repeat(40)];

    await assert.rejects(
      () => runCoordinationV2DigestCli([...baseArgs, '--policy', join(directory, 'missing.json')], registry),
      /policy_file_unreadable/,
    );

    const badJsonPath = join(directory, 'bad.json');
    await writeFile(badJsonPath, '{not json');
    await assert.rejects(
      () => runCoordinationV2DigestCli([...baseArgs, '--policy', badJsonPath], registry),
      /policy_file_invalid_json/,
    );

    const arrayPath = join(directory, 'array.json');
    await writeFile(arrayPath, '[]');
    await assert.rejects(
      () => runCoordinationV2DigestCli([...baseArgs, '--policy', arrayPath], registry),
      /policy_file_not_object/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// ── standalone execution (no database) ──────────────────────────────────────

test('the digest CLI and its full import graph never reference the live database module', () => {
  const files = [
    'server/scripts/coordination-v2-public-material-digest.ts',
    'server/services/coordination-v2-public-config.ts',
    'server/services/coordination-task-metadata-service.ts',
    'server/services/coordination-repository-identity.ts',
    'server/services/coordination-policy-canonicalization.ts',
    'server/scripts/coordination-windows-prepare.ts',
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /from\s+['"]\.\.?\/db['"]/, `${file} must not import the live database module`);
  }
  // coordination-windows-prepare.ts's one cross-module reference must stay a
  // type-only import (erased at compile time) so the CLI never pulls in
  // coordination-windows-generation.ts (which does depend on the database).
  const prepareSource = readFileSync('server/scripts/coordination-windows-prepare.ts', 'utf8');
  assert.match(prepareSource, /import type \{[^}]*\} from ["']\.\.\/services\/coordination-windows-generation["']/);
});

test('CLI runs to completion with a live database connection unavailable', async () => {
  const strippedEnv: NodeJS.ProcessEnv = { ...process.env };
  delete strippedEnv.NEON_SHARED_DATABASE_URL;
  delete strippedEnv.CI_DATABASE_URL;
  delete strippedEnv.CI;

  const help = await execFile('npx', [
    'tsx', 'server/scripts/coordination-v2-public-material-digest.ts', '--help',
  ], { env: strippedEnv, timeout: 60_000 });
  assert.match(help.stdout, /windowsPublicMaterialDigest/);
  assert.match(help.stdout, /1\. Compute/);
  assert.match(help.stdout, /2\. Author/);
  assert.match(help.stdout, /3\. Approve/);
  assert.match(help.stdout, /4\. Grant/);

  const bare = await execFile('npx', [
    'tsx', 'server/scripts/coordination-v2-public-material-digest.ts',
  ], { env: strippedEnv, timeout: 60_000 }).then(
    () => { throw new Error('expected a non-zero exit for a bare invocation'); },
    (error: NodeJS.ErrnoException & { code?: number; stdout?: string }) => error,
  );
  assert.equal(bare.code, 64);
  assert.match(bare.stdout ?? '', /windowsPublicMaterialDigest/);
});

test('HELP_TEXT documents every required flag', () => {
  for (const flag of ['--task-ref', '--promoted-commit-sha', '--exact-tree-sha', '--policy', '--format']) {
    assert.ok(HELP_TEXT.includes(flag), `HELP_TEXT must document ${flag}`);
  }
});

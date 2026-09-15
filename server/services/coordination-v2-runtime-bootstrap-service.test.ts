import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  RUNTIME_ARTIFACT_MAX_BYTES,
  RUNTIME_RELEASE_MAX_TOTAL_BYTES,
  RUNTIME_SOURCE_MEMBER_PATHS,
  sortCoordinationV2RuntimeManifestArtifacts,
  validateCoordinationV2RuntimeClosure,
  validateCoordinationV2RuntimeNodeEvidence,
  validateCoordinationV2RuntimeSigner,
  validateCoordinationV2RuntimeArtifacts,
  validateCoordinationV2RuntimeSourceMembers,
  verifyCoordinationV2RuntimeSri,
  deriveCoordinationV2RuntimeProvenance,
  RUNTIME_NODE_KEYRING_URL,
  type RuntimeArtifactInput,
  type RuntimeClosureFile,
} from './coordination-v2-runtime-bootstrap-service';

const serviceSource = readFileSync(new URL('./coordination-v2-runtime-bootstrap-service.ts', import.meta.url), 'utf8');
const digest = 'a'.repeat(64);
const sourceMembers = RUNTIME_SOURCE_MEMBER_PATHS.map((fixedPath) => ({ fixedPath, sha256: digest }));

function nodeArtifact(byteLength = 1): RuntimeArtifactInput {
  return {
    role: 'node_executable',
    fixedDestination: 'runtime/node.exe',
    objectKey: `coordination-v2/runtime/${digest}/node.exe`,
    objectDigest: digest,
    byteLength,
    mediaType: 'application/vnd.microsoft.portable-executable',
    requiresAuthenticode: true,
  };
}

function tsxArtifact(fixedDestination: string, byteLength = 1): RuntimeArtifactInput {
  return {
    role: 'tsx_runtime_module',
    fixedDestination,
    objectKey: `coordination-v2/runtime/${digest}/${fixedDestination
      .slice('node_modules/tsx/'.length)
      .replaceAll(/[^A-Za-z0-9._-]/g, '-')}`,
    objectDigest: digest,
    byteLength,
    mediaType: 'application/javascript',
    requiresAuthenticode: false,
  };
}

test('runtime artifact validator accepts one node and individual tsx files', () => {
  const artifacts = validateCoordinationV2RuntimeArtifacts([
    nodeArtifact(),
    tsxArtifact('node_modules/tsx/index.mjs'),
    tsxArtifact('node_modules/tsx/lib/cli.mjs'),
    tsxArtifact('node_modules/tsx/node_modules/@esbuild/win32-x64/esbuild.exe'),
  ]);
  assert.equal(artifacts.length, 4);
});

test('runtime artifact validator rejects unsafe destinations and node role drift', () => {
  for (const destination of [
    'node_modules/tsx/../escape.mjs',
    'node_modules/tsx/a:b.mjs',
    'node_modules/tsx\\escape.mjs',
    'node_modules/tsx/',
    'node_modules/tsx/@esbuild/index.js',
    'node_modules/tsx/node_modules/@attacker/package.json',
    'node_modules/tsx/node_modules/@esbuild/linux-x64/esbuild',
    'node_modules/tsx/node_modules/@esbuild/win32-x64/../../../escape.mjs',
    'node_modules/tsx/node_modules/@esbuild/win32-x64/..',
    'node_modules/tsx/node_modules/@esbuild/win32-x64/esbuild.exe:ads',
    '//server/node_modules/tsx/node_modules/@esbuild/win32-x64/esbuild.exe',
    'C:/node_modules/tsx/node_modules/@esbuild/win32-x64/esbuild.exe',
  ]) {
    assert.throws(() => validateCoordinationV2RuntimeArtifacts([
      nodeArtifact(), tsxArtifact(destination),
    ]), /V2_RUNTIME_ARTIFACT_INVALID/);
  }
  assert.throws(() => validateCoordinationV2RuntimeArtifacts([
    { ...nodeArtifact(), requiresAuthenticode: false },
    tsxArtifact('node_modules/tsx/index.mjs'),
  ]), /V2_RUNTIME_ARTIFACT_INVALID/);
  assert.throws(() => validateCoordinationV2RuntimeArtifacts([
    nodeArtifact(),
    { ...tsxArtifact('node_modules/tsx/index.mjs'), requiresAuthenticode: true },
  ]), /V2_RUNTIME_ARTIFACT_INVALID/);
  assert.throws(() => validateCoordinationV2RuntimeArtifacts([
    nodeArtifact(),
    tsxArtifact('node_modules/tsx/index.mjs'),
    tsxArtifact('node_modules/tsx/index.mjs'),
  ]), /V2_RUNTIME_ARTIFACT_INVALID/);
});

test('runtime artifact validator enforces count and bounded total bytes', () => {
  const tooMany = [nodeArtifact(), ...Array.from({ length: 4096 }, (_, i) =>
    tsxArtifact(`node_modules/tsx/${i}.mjs`))];
  assert.throws(() => validateCoordinationV2RuntimeArtifacts(tooMany), /V2_RUNTIME_ARTIFACT_INVALID/);
  assert.throws(() => validateCoordinationV2RuntimeArtifacts([
    nodeArtifact(RUNTIME_ARTIFACT_MAX_BYTES),
    tsxArtifact('node_modules/tsx/index.mjs'),
  ]), /V2_RUNTIME_RELEASE_SIZE_INVALID/);
  assert.ok(RUNTIME_RELEASE_MAX_TOTAL_BYTES >= RUNTIME_ARTIFACT_MAX_BYTES);
});

test('source members are the closed v1 set and manifest ordering is destination-based', () => {
  assert.deepEqual(
    validateCoordinationV2RuntimeSourceMembers([...sourceMembers].reverse()).map((member) => member.fixedPath),
    [...RUNTIME_SOURCE_MEMBER_PATHS].sort(),
  );
  assert.throws(() => validateCoordinationV2RuntimeSourceMembers([
    ...sourceMembers.slice(0, 2),
    { fixedPath: 'scripts/hola-coordinator.ps1', sha256: digest },
  ]), /V2_RUNTIME_SOURCE_MEMBERS_INVALID/);
  assert.deepEqual(
    sortCoordinationV2RuntimeManifestArtifacts([
      { fixedDestination: 'node_modules/tsx/z.mjs' },
      { fixedDestination: 'runtime/node.exe' },
      { fixedDestination: 'node_modules/tsx/a.mjs' },
    ]).map((artifact) => artifact.fixedDestination),
    ['node_modules/tsx/a.mjs', 'node_modules/tsx/z.mjs', 'runtime/node.exe'],
  );
});

test('publication replay validates complete digests before persisted-release lookup', () => {
  assert.ok(serviceSource.indexOf('const releaseDigest = computeCoordinationV2RuntimeReleaseDigest') < serviceSource.indexOf('const existing'));
  assert.ok(serviceSource.includes('persistedReleaseMatches(existing, persistedArtifacts, source, artifacts, sourceMembers, provenance)'));
  assert.ok(serviceSource.includes('provenanceDigest: provenance.provenanceDigest'));
});

test('artifact streaming re-inspects object bytes before sending headers', () => {
  const inspect = serviceSource.indexOf('const checked = await inspectObject(String(row.object_key))');
  const headers = serviceSource.indexOf("res.status(200).set({");
  assert.ok(inspect >= 0 && headers >= 0 && inspect < headers);
});

test('acknowledgement replay precedes expiry rejection and uses a generated UUID', () => {
  const prior = serviceSource.indexOf('const prior = rowOf(await tx.execute(sql`');
  const expiry = serviceSource.indexOf('if (dateValue(issue.expires_at) <= now)');
  assert.ok(prior >= 0 && expiry >= 0 && prior < expiry);
  assert.match(serviceSource, /const acknowledgementId = randomUUID\(\)/);
  assert.doesNotMatch(serviceSource, /acknowledgementId: 'inserted'/);
});

test('provenance closure derivation rejects missing and extra files', () => {
  const closure: RuntimeClosureFile[] = [
    { fixedDestination: 'node_modules/tsx/index.mjs', sha256: digest, byteLength: 3 },
  ];
  assert.throws(() => validateCoordinationV2RuntimeClosure([
    { ...tsxArtifact('node_modules/tsx/index.mjs'), objectDigest: 'b'.repeat(64) },
  ], closure), /V2_RUNTIME_PROVENANCE_CLOSURE_MISMATCH/);
  assert.throws(() => validateCoordinationV2RuntimeClosure([], closure),
    /V2_RUNTIME_PROVENANCE_CLOSURE_MISMATCH/);
  assert.doesNotThrow(() => validateCoordinationV2RuntimeClosure([
    { ...tsxArtifact('node_modules/tsx/index.mjs'), objectDigest: digest, byteLength: 3 },
  ], closure));
});

test('provenance verification rejects bad SRI and wrong signer', () => {
  assert.match(RUNTIME_NODE_KEYRING_URL, /\/gpg\/pubring\.kbx$/);
  const bytes = Buffer.from('tarball');
  const sri = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  assert.doesNotThrow(() => verifyCoordinationV2RuntimeSri(bytes, sri));
  assert.throws(() => verifyCoordinationV2RuntimeSri(bytes, 'sha512-bad'),
    /V2_RUNTIME_PROVENANCE_SRI_INVALID/);
  assert.throws(() => validateCoordinationV2RuntimeSigner('00'.repeat(20)),
    /V2_RUNTIME_PROVENANCE_SIGNER_INVALID/);
});

test('provenance node evidence and source blob mismatch are enforced', async () => {
  assert.doesNotThrow(() => validateCoordinationV2RuntimeNodeEvidence([
    nodeArtifact(),
  ], digest));
  assert.throws(() => validateCoordinationV2RuntimeNodeEvidence([
    nodeArtifact(),
  ], 'b'.repeat(64)), /V2_RUNTIME_PROVENANCE_NODE_MISMATCH/);
  const commit = 'c'.repeat(40);
  const blobs = new Map([
    ...RUNTIME_SOURCE_MEMBER_PATHS.map((path) => [path, Buffer.from(path)] as const),
    ['package-lock.json', Buffer.from('{}')] as const,
  ]);
  await assert.rejects(() => deriveCoordinationV2RuntimeProvenance({
    promotedCommitSha: commit,
    exactTreeSha: 'd'.repeat(40),
    sourceMembers,
    artifacts: [nodeArtifact(), tsxArtifact('node_modules/tsx/index.mjs')],
    dependencies: {
      gitTree: async () => 'd'.repeat(40),
      gitBlob: async (_commit, path) => blobs.get(path)!,
    },
  }), /V2_RUNTIME_SOURCE_MEMBERS_MISMATCH/);
});
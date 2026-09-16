import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
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
  describeCoordinationV2RuntimePublicationFailure,
  computeCoordinationV2RuntimeManifestTemplateDigest,
  RUNTIME_NODE_KEYRING_URL,
  classifyRuntimeSourceSnapshotFailure,
  reportRuntimeSourceSnapshotFailure,
  resolveCoordinationV2RuntimeSourceSnapshot,
  publishCoordinationV2RuntimeRelease,
  type RuntimeArtifactInput,
  type RuntimeClosureFile,
  type RuntimeProvenanceEvidence,
  type RuntimeReleasePublicationDependencies,
} from './coordination-v2-runtime-bootstrap-service';

const serviceSource = readFileSync(new URL('./coordination-v2-runtime-bootstrap-service.ts', import.meta.url), 'utf8');
const dotReplit = readFileSync(new URL('../../.replit', import.meta.url), 'utf8');
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

const publicationSource = {
  id: 'runtime-source-one',
  repository_identity: 'github:davidwmcintosh/holahola',
  promoted_commit_sha: '1'.repeat(40),
  exact_tree_sha: '2'.repeat(40),
  publication_reference: 'replit-publish:runtime-source-one',
  protected_validation_id: 'runtime-validation-one',
  canonical_record_digest: '3'.repeat(64),
};

const publicationProvenance: RuntimeProvenanceEvidence = {
  lockfileDigest: '4'.repeat(64),
  runtimeClosureDigest: '5'.repeat(64),
  provenanceDigest: '6'.repeat(64),
  nodeChecksum: digest,
  signerFingerprint: 'CC68F5A3106FF448322E48ED27F5E38D5B0A215F',
  keyringDigest: '7'.repeat(64),
  shasumsDigest: '8'.repeat(64),
  signatureDigest: '9'.repeat(64),
  sourceMembers,
  closureFiles: [],
};

function publicationInput() {
  return {
    sourcePromotionId: publicationSource.id,
    artifacts: [
      nodeArtifact(),
      tsxArtifact('node_modules/tsx/index.mjs'),
    ],
    sourceMembers,
    now: new Date('2026-09-15T23:00:00.000Z'),
  };
}

function publicationDatabase(events: string[], options: {
  precheckSource?: Record<string, unknown> | null;
  precheckCurrent?: Record<string, unknown> | null;
  transactionSource?: Record<string, unknown>;
  transactionCurrent?: Record<string, unknown>;
  queries?: unknown[];
} = {}): NonNullable<RuntimeReleasePublicationDependencies['database']> {
  let outsideReads = 0;
  const transactionSource = options.transactionSource ?? publicationSource;
  const transactionCurrent = options.transactionCurrent ?? transactionSource;
  const transactionDb = {
    execute: async (query: unknown) => {
      options.queries?.push(query);
      const call = events.filter((event) => event.startsWith('transaction-sql-')).length + 1;
      events.push(`transaction-sql-${call}`);
      if (call === 1) return [transactionSource];
      if (call === 2) return [transactionCurrent];
      if (call === 5) return publicationInput().artifacts.map((_, index) => ({
        id: `runtime-artifact-fixture-${index + 1}`,
      }));
      return [];
    },
  };
  return {
    execute: async () => {
      outsideReads += 1;
      events.push(`outside-sql-${outsideReads}`);
      if (outsideReads === 1) {
        return options.precheckSource === null
          ? []
          : [options.precheckSource ?? publicationSource];
      }
      const current = options.precheckCurrent === undefined
        ? options.precheckSource ?? publicationSource
        : options.precheckCurrent;
      return current === null ? [] : [current];
    },
    transaction: async (callback: (transaction: typeof transactionDb) => Promise<unknown>) => {
      events.push('transaction-open');
      return callback(transactionDb);
    },
  } as unknown as NonNullable<RuntimeReleasePublicationDependencies['database']>;
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
  const publicationFunction = serviceSource.slice(
    serviceSource.indexOf('export async function publishCoordinationV2RuntimeRelease'),
    serviceSource.indexOf('async function releaseForIssue'),
  );
  assert.ok(publicationFunction.indexOf('releaseDigest = computeCoordinationV2RuntimeReleaseDigest')
    < publicationFunction.indexOf('const replay = await findRuntimeReleaseReplay'));
  const replayHelper = serviceSource.slice(
    serviceSource.indexOf('async function findRuntimeReleaseReplay'),
    serviceSource.indexOf('export async function publishCoordinationV2RuntimeRelease'),
  );
  assert.match(replayHelper, /persistedReleaseMatches\(\s*existing,\s*persistedArtifacts,\s*source,\s*artifacts,\s*sourceMembers,\s*provenance,\s*\)/);
  assert.ok(serviceSource.includes('provenanceDigest: provenance.provenanceDigest'));
});

test('runtime publication completes external verification before opening its append transaction', async () => {
  const events: string[] = [];
  const queries: unknown[] = [];
  const result = await publishCoordinationV2RuntimeRelease(publicationInput(), {
    database: publicationDatabase(events, { queries }),
    deriveProvenance: async () => {
      events.push('derive-provenance');
      return publicationProvenance;
    },
    inspectArtifact: async (objectKey) => {
      events.push(`inspect:${objectKey}`);
      return { file: {} as never, length: 1, digest };
    },
    uuid: (() => {
      let next = 0;
      return () => `runtime-release-fixture-${++next}`;
    })(),
  });
  assert.equal(result.created, true);
  const transactionOpen = events.indexOf('transaction-open');
  assert.ok(transactionOpen > events.indexOf('derive-provenance'));
  assert.ok(events.filter((event) => event.startsWith('inspect:'))
    .every((event) => events.indexOf(event) < transactionOpen));
  assert.deepEqual(events.slice(0, 3), [
    'outside-sql-1',
    'outside-sql-2',
    'derive-provenance',
  ]);
  assert.equal(
    events.filter((event) => event.startsWith('transaction-sql-')).length,
    5,
    'publication must use source/current/replay reads plus one release and one artifact insert',
  );
  assert.match(serviceSource, /FROM jsonb_to_recordset\(\$\{JSON\.stringify\(artifactRows\)\}::jsonb\)/);
  assert.doesNotMatch(serviceSource, /for \(const artifact of artifacts\) \{\s*await transactionDb\.execute/);
  const artifactInsert = new PgDialect().sqlToQuery(queries[4] as Parameters<PgDialect['sqlToQuery']>[0]);
  assert.equal(artifactInsert.params.length, 1, 'the complete artifact set must be one SQL parameter');
  const parameterRows = JSON.parse(String(artifactInsert.params[0])) as Array<Record<string, unknown>>;
  assert.deepEqual(parameterRows.map((row) => Object.keys(row).sort()), publicationInput().artifacts.map(() => [
    'byte_length',
    'fixed_destination',
    'id',
    'media_type',
    'object_digest',
    'object_key',
    'requires_authenticode',
    'role',
    'runtime_release_id',
  ]));
  assert.deepEqual(parameterRows.map((row) => row.fixed_destination), publicationInput().artifacts
    .map((artifact) => artifact.fixedDestination));
});

test('runtime publication fails closed when the set-based artifact insert returns the wrong row count', async () => {
  const events: string[] = [];
  const base = publicationDatabase(events);
  await assert.rejects(() => publishCoordinationV2RuntimeRelease(publicationInput(), {
    database: {
      ...base,
      transaction: async (callback) => base.transaction(async (transaction) => callback({
        ...transaction,
        execute: async (query) => {
          const result = await transaction.execute(query);
          return events.at(-1) === 'transaction-sql-5' ? [] : result;
        },
      } as typeof transaction)),
    } as NonNullable<RuntimeReleasePublicationDependencies['database']>,
    deriveProvenance: async () => publicationProvenance,
    inspectArtifact: async () => ({ file: {} as never, length: 1, digest }),
  }), /V2_RUNTIME_DATABASE_UNAVAILABLE/);
});

test('runtime publication diagnostics are bounded and retain phase without leaking arbitrary fields', async () => {
  const hidden = { requestBody: 'must-not-log' };
  const cause = Object.assign(new Error('inner'.repeat(200)), {
    code: 'XX001',
    constraint: 'constraint'.repeat(100),
    hidden,
  });
  const failure = Object.assign(new Error('outer'), { cause });
  await assert.rejects(() => publishCoordinationV2RuntimeRelease(publicationInput(), {
    database: publicationDatabase([]),
    deriveProvenance: async () => { throw failure; },
  }), /outer/);
  const described = describeCoordinationV2RuntimePublicationFailure(failure, 12.6);
  assert.equal(described.phase, 'provenance_verification');
  assert.equal(described.elapsedMs, 13);
  assert.equal(described.causes.length, 2);
  assert.equal(described.causes[0].message, 'unclassified_error');
  assert.equal(described.causes[1].message, 'unclassified_error');
  assert.equal(described.causes[1].constraint?.length, 256);
  assert.equal(JSON.stringify(described).includes('must-not-log'), false);
  assert.equal(JSON.stringify(described).includes('inner'), false);
});

test('runtime source-precheck diagnostics identify mismatch without logging raw authority values', async () => {
  const requestedId = String(publicationSource.id);
  const currentId = 'newer-source';
  let failure: unknown;
  try {
    await publishCoordinationV2RuntimeRelease(publicationInput(), {
      database: publicationDatabase([], {
        precheckCurrent: {
          ...publicationSource,
          id: currentId,
          database_name: 'coordinator',
          schema_name: 'public',
          server_address: '192.0.2.10',
        },
      }),
    });
  } catch (error) {
    failure = error;
  }
  assert.match(String(failure), /V2_RUNTIME_SOURCE_PROMOTION_NOT_CURRENT/);
  const described = describeCoordinationV2RuntimePublicationFailure(failure, 4);
  assert.equal(described.phase, 'source_precheck');
  assert.equal(described.sourcePrecheck?.requestedSourceFound, true);
  assert.deepEqual(described.sourcePrecheck?.mismatchedFields, ['id']);
  assert.match(described.sourcePrecheck?.requestedSourceIdHash ?? '', /^[0-9a-f]{64}$/);
  assert.match(described.sourcePrecheck?.currentSourceIdHash ?? '', /^[0-9a-f]{64}$/);
  assert.match(described.sourcePrecheck?.databaseIdentityHash ?? '', /^[0-9a-f]{64}$/);
  const serialized = JSON.stringify(described);
  assert.equal(serialized.includes(requestedId), false);
  assert.equal(serialized.includes(currentId), false);
  assert.equal(serialized.includes('coordinator'), false);
  assert.equal(serialized.includes('192.0.2.10'), false);
});

test('runtime source-precheck diagnostics remain bounded when the requested source is absent', async () => {
  let failure: unknown;
  try {
    await publishCoordinationV2RuntimeRelease(publicationInput(), {
      database: publicationDatabase([], {
        precheckSource: null,
        precheckCurrent: null,
      }),
    });
  } catch (error) {
    failure = error;
  }
  const described = describeCoordinationV2RuntimePublicationFailure(failure, 2);
  assert.equal(described.phase, 'source_precheck');
  assert.equal(described.sourcePrecheck?.requestedSourceFound, false);
  assert.deepEqual(described.sourcePrecheck?.mismatchedFields, []);
  assert.equal(described.sourcePrecheck?.currentSourceIdHash, undefined);
  assert.equal(described.sourcePrecheck?.databaseIdentityHash, undefined);
  assert.match(described.sourcePrecheck?.requestedSourceIdHash ?? '', /^[0-9a-f]{64}$/);
});

test('runtime publication opens no transaction when provenance or object verification fails', async () => {
  for (const failure of ['provenance', 'object'] as const) {
    const events: string[] = [];
    await assert.rejects(() => publishCoordinationV2RuntimeRelease(publicationInput(), {
      database: publicationDatabase(events),
      deriveProvenance: async () => {
        events.push('derive-provenance');
        if (failure === 'provenance') throw new Error('fixture-provenance-failure');
        return publicationProvenance;
      },
      inspectArtifact: async () => {
        events.push('inspect-object');
        if (failure === 'object') {
          return { file: {} as never, length: 1, digest: 'f'.repeat(64) };
        }
        return { file: {} as never, length: 1, digest };
      },
    }), failure === 'provenance'
      ? /fixture-provenance-failure/
      : /V2_RUNTIME_OBJECT_DIGEST_MISMATCH/);
    assert.ok(!events.includes('transaction-open'), `${failure} failure opened a transaction`);
  }
});

test('runtime publication rejects source-field or current-source drift after verification', async () => {
  const changedSource = {
    ...publicationSource,
    canonical_record_digest: 'b'.repeat(64),
  };
  const fieldDriftEvents: string[] = [];
  await assert.rejects(() => publishCoordinationV2RuntimeRelease(publicationInput(), {
    database: publicationDatabase(fieldDriftEvents, {
      transactionSource: changedSource,
      transactionCurrent: changedSource,
    }),
    deriveProvenance: async () => publicationProvenance,
    inspectArtifact: async () => ({ file: {} as never, length: 1, digest }),
  }), /V2_RUNTIME_SOURCE_PROMOTION_CHANGED/);

  const currentDriftEvents: string[] = [];
  await assert.rejects(() => publishCoordinationV2RuntimeRelease(publicationInput(), {
    database: publicationDatabase(currentDriftEvents, {
      transactionCurrent: { ...publicationSource, id: 'newer-source' },
    }),
    deriveProvenance: async () => publicationProvenance,
    inspectArtifact: async () => ({ file: {} as never, length: 1, digest }),
  }), /V2_RUNTIME_SOURCE_PROMOTION_NOT_CURRENT/);
});

test('runtime publication resolves only the exact release-digest uniqueness race as a replay', async () => {
  const events: string[] = [];
  const artifacts = publicationInput().artifacts;
  const releaseDigest = 'c'.repeat(64);
  const existing = {
    id: 'concurrent-runtime-release',
    source_promotion_id: publicationSource.id,
    repository_identity: publicationSource.repository_identity,
    promoted_commit_sha: publicationSource.promoted_commit_sha,
    exact_tree_sha: publicationSource.exact_tree_sha,
    publication_reference: publicationSource.publication_reference,
    protected_validation_id: publicationSource.protected_validation_id,
    source_promotion_record_digest: publicationSource.canonical_record_digest,
    release_digest: releaseDigest,
    manifest_template_digest: computeCoordinationV2RuntimeManifestTemplateDigest(
      artifacts,
      sourceMembers,
    ),
    node_version: '20.20.0',
    node_release_keyring_commit: '481637f813e912c4aa3622d7964ab426c97b8e8d',
    node_release_keyring_digest: publicationProvenance.keyringDigest,
    node_shasums_digest: publicationProvenance.shasumsDigest,
    node_signature_digest: publicationProvenance.signatureDigest,
    node_signer_fingerprint: publicationProvenance.signerFingerprint,
    lockfile_digest: publicationProvenance.lockfileDigest,
    runtime_closure_digest: publicationProvenance.runtimeClosureDigest,
    provenance_digest: publicationProvenance.provenanceDigest,
    source_members: sourceMembers,
    published_at: new Date('2026-09-15T23:00:00.000Z'),
  };
  const persistedArtifacts = artifacts.map((artifact) => ({
    role: artifact.role,
    fixed_destination: artifact.fixedDestination,
    object_key: artifact.objectKey,
    object_digest: artifact.objectDigest,
    byte_length: artifact.byteLength,
    media_type: artifact.mediaType,
    requires_authenticode: artifact.requiresAuthenticode,
  }));
  let outsideCall = 0;
  let transactionAttempt = 0;
  let appendCall = 0;
  let recoveryCall = 0;
  const appendDb = {
    execute: async () => {
      appendCall += 1;
      if (appendCall === 1 || appendCall === 2) return [publicationSource];
      if (appendCall === 3) return [];
      throw Object.assign(new Error('wrapped uniqueness race'), {
        cause: {
          code: '23505',
          constraint: 'uq_coordination_v2_runtime_release_digest',
        },
      });
    },
  };
  const recoveryDb = {
    execute: async () => {
      recoveryCall += 1;
      if (recoveryCall === 1 || recoveryCall === 2) return [publicationSource];
      if (recoveryCall === 3) return [existing];
      return persistedArtifacts;
    },
  };
  const database = {
    execute: async () => {
      outsideCall += 1;
      events.push(`outside-${outsideCall}`);
      return [publicationSource];
    },
    transaction: async (
      callback: (transaction: typeof appendDb | typeof recoveryDb) => Promise<unknown>,
    ) => {
      transactionAttempt += 1;
      return callback(transactionAttempt === 1 ? appendDb : recoveryDb);
    },
  } as unknown as NonNullable<RuntimeReleasePublicationDependencies['database']>;
  const result = await publishCoordinationV2RuntimeRelease(publicationInput(), {
    database,
    deriveProvenance: async () => publicationProvenance,
    inspectArtifact: async () => ({ file: {} as never, length: 1, digest }),
  });
  assert.deepEqual(result, {
    created: false,
    runtimeReleaseId: existing.id,
    releaseDigest,
    publishedAt: '2026-09-15T23:00:00.000Z',
  });
  assert.equal(outsideCall, 2, 'external source verification should remain outside a transaction');
  assert.equal(transactionAttempt, 2, 'uniqueness recovery must use a new short transaction');
  assert.equal(recoveryCall, 4, 'recovery must revalidate source and the complete persisted release');
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
  let snapshotCalls = 0;
  await assert.rejects(() => deriveCoordinationV2RuntimeProvenance({
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    promotedCommitSha: commit,
    exactTreeSha: 'd'.repeat(40),
    sourceMembers,
    artifacts: [nodeArtifact(), tsxArtifact('node_modules/tsx/index.mjs')],
    dependencies: {
      sourceSnapshot: async (input) => {
        snapshotCalls += 1;
        assert.equal(input.repositoryIdentity, 'github:davidwmcintosh/holahola');
        assert.equal(input.promotedCommitSha, commit);
        assert.deepEqual(
          [...input.fixedPaths].sort(),
          [...RUNTIME_SOURCE_MEMBER_PATHS, 'package-lock.json'].sort(),
        );
        return {
          sha: commit,
          treeSha: 'd'.repeat(40),
          blobs: Object.fromEntries([...blobs]),
        };
      },
    },
  }), /V2_RUNTIME_SOURCE_MEMBERS_MISMATCH/);
  assert.equal(snapshotCalls, 1, 'tree and blobs must come from one snapshot call');
});

test('provenance snapshot rejects shifted identity, tree, and blob boundaries before network verification', async () => {
  const commit = 'c'.repeat(40);
  const tree = 'd'.repeat(40);
  const fixedPaths = [...RUNTIME_SOURCE_MEMBER_PATHS, 'package-lock.json'];
  const blobs = Object.fromEntries(fixedPaths.map((path) => [path, Buffer.from(path)]));
  const input = {
    repositoryIdentity: 'github:davidwmcintosh/holahola',
    promotedCommitSha: commit,
    exactTreeSha: tree,
    sourceMembers,
    artifacts: [nodeArtifact(), tsxArtifact('node_modules/tsx/index.mjs')],
  };
  await assert.rejects(() => deriveCoordinationV2RuntimeProvenance({
    ...input,
    dependencies: {
      sourceSnapshot: async () => ({ sha: 'e'.repeat(40), treeSha: tree, blobs }),
    },
  }), /V2_RUNTIME_SOURCE_TREE_MISMATCH/);
  await assert.rejects(() => deriveCoordinationV2RuntimeProvenance({
    ...input,
    dependencies: {
      sourceSnapshot: async () => ({ sha: commit, treeSha: 'e'.repeat(40), blobs }),
    },
  }), /V2_RUNTIME_SOURCE_TREE_MISMATCH/);
  await assert.rejects(() => deriveCoordinationV2RuntimeProvenance({
    ...input,
    dependencies: {
      sourceSnapshot: async () => ({
        sha: commit,
        treeSha: tree,
        blobs: { ...blobs, 'extra.txt': Buffer.from('extra') },
      }),
    },
  }), /V2_RUNTIME_SOURCE_SNAPSHOT_INVALID/);
  const { ['package-lock.json']: _missing, ...missingLockfile } = blobs;
  await assert.rejects(() => deriveCoordinationV2RuntimeProvenance({
    ...input,
    dependencies: {
      sourceSnapshot: async () => ({ sha: commit, treeSha: tree, blobs: missingLockfile }),
    },
  }), /V2_RUNTIME_SOURCE_SNAPSHOT_INVALID/);
});

test('source snapshot diagnostics use a closed classification without exposing raw errors', () => {
  const cases: Array<[unknown, string]> = [
    [new Error('HOLAHOLA_GITHUB_DEPLOY_KEY is unavailable.'), 'deploy_key_missing'],
    [new Error('HOLAHOLA_GITHUB_DEPLOY_KEY does not contain an armored private key.'), 'deploy_key_invalid'],
    [new Error('protected_remote_snapshot_request_invalid'), 'request_invalid'],
    [new Error('protected_remote_snapshot_git_failed'), 'git_operation_failed'],
    [new Error('remote_commit_proof_mismatch'), 'snapshot_validation_failed'],
    [new Error('protected_remote_snapshot_blob_invalid'), 'snapshot_validation_failed'],
    [new Error('protected_remote_snapshot_paths_mismatch'), 'snapshot_validation_failed'],
    [Object.assign(new Error('sensitive filesystem path'), { code: 'ENOENT' }), 'filesystem_failed'],
    [new Error('secret raw command output'), 'unknown'],
    [{ message: 'protected_remote_snapshot_git_failed' }, 'unknown'],
  ];
  for (const [error, expected] of cases) {
    assert.equal(classifyRuntimeSourceSnapshotFailure(error), expected);
  }

  const messages: string[] = [];
  const diagnostic = reportRuntimeSourceSnapshotFailure(
    new Error('secret raw command output with /private/key/path'),
    (message) => messages.push(message),
  );
  assert.equal(diagnostic, 'unknown');
  assert.deepEqual(messages, ['[CoordinationV2Runtime] source snapshot unavailable: unknown']);
  assert.doesNotMatch(messages[0], /secret|command output|private|key|path/);
});

test('production Nix runtime retains Git and OpenSSH for protected source snapshots', () => {
  const nixSection = dotReplit.match(/^\[nix\]\s*\r?\n([\s\S]*?)(?=^\[)/m)?.[1];
  assert.ok(nixSection, 'missing [nix] section');
  const packagesJson = nixSection.match(/^packages\s*=\s*(\[.*\])\s*$/m)?.[1];
  assert.ok(packagesJson, 'missing [nix].packages array');
  const packages = JSON.parse(packagesJson) as unknown;
  assert.ok(Array.isArray(packages), '[nix].packages must be an array');
  assert.ok(packages.includes('git'), '[nix].packages must include git');
  assert.ok(packages.includes('openssh'), '[nix].packages must include openssh');
});

test('default source snapshot wrapper logs only a closed label and preserves the generic error', async () => {
  const messages: string[] = [];
  await assert.rejects(
    () => resolveCoordinationV2RuntimeSourceSnapshot({
      repositoryIdentity: 'github:davidwmcintosh/holahola',
      promotedCommitSha: 'c'.repeat(40),
      fixedPaths: ['package-lock.json'],
    }, {
      resolve: async () => {
        throw new Error('secret stderr with /private/key/path');
      },
      warn: (message) => messages.push(message),
    }),
    (error: unknown) => error instanceof Error
      && error.message === 'V2_RUNTIME_SOURCE_SNAPSHOT_UNAVAILABLE',
  );
  assert.deepEqual(messages, ['[CoordinationV2Runtime] source snapshot unavailable: unknown']);
  assert.doesNotMatch(messages[0], /secret|stderr|private|key|path/);
});
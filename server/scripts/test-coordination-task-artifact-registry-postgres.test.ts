import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

// Same disposable-gate hard-fail guard as the other Coordinator V2 PostgreSQL
// parity tests (see test-coordinator-v2-schema-postgres.test.ts): a stray
// NEON_SHARED_DATABASE_URL in a developer or shared-Neon process must never
// let this test write real rows, only the gate-provided disposable branch.
function disposableTarget(): string | undefined {
  const url = process.env.NEON_SHARED_DATABASE_URL;
  if (!url) {
    if (process.env.COORDINATOR_V2_REQUIRE_DATABASE_TESTS === '1') {
      throw new Error('COORDINATOR_V2_TEST_DATABASE_URL is required by the migration gate');
    }
    return undefined;
  }
  if (process.env.COORDINATOR_V2_TEST_DATABASE_DISPOSABLE !== '1') {
    throw new Error('COORDINATOR_V2_TEST_DATABASE_DISPOSABLE=1 is required');
  }
  if (process.env.COORDINATOR_V2_TEST_DATABASE_URL !== url) {
    throw new Error('Coordinator V2 task artifact test requires the gate-provided disposable database URL');
  }
  if (url === process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL) {
    throw new Error('Coordinator V2 task artifact test refuses the shared Neon database');
  }
  return url;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('Postgres task-artifact registry round-trips a publish, upserts on republish, and rejects a tampered pair', async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip('run through the Neon migration gate');
    return;
  }

  // The shared drizzle pool this test touches (via the registry/publication
  // service) keeps the event loop alive; without an explicit close, this
  // process never exits once the assertions below finish. See closeDbConnections
  // usage in test-coordination-policy-service.test.ts / test-coordination-session-service.test.ts.
  const { closeDbConnections } = await import('../db');
  try {
    const {
      publishCoordinationTaskArtifact,
      CoordinationTaskArtifactPublicationError,
    } = await import('../services/coordination-task-artifact-publication-service');
    const {
      PostgresCoordinationTaskMetadataRegistry,
      resolveCoordinationTaskMetadataWithArtifact,
      CoordinationTaskMetadataError,
    } = await import('../services/coordination-task-metadata-service');

    const registry = new PostgresCoordinationTaskMetadataRegistry();
    const taskRef = String(900000 + Math.floor(Math.random() * 99999));

    // No row published yet: resolve() is undefined, readArtifact() fails closed.
    assert.equal(await registry.resolve(taskRef), undefined);
    await assert.rejects(
      () => registry.readArtifact(taskRef),
      (error: unknown) => error instanceof CoordinationTaskMetadataError && error.code === 'TASK_METADATA_UNSUPPORTED',
    );

    const artifactV1 = new TextEncoder().encode('# Task\n\nFirst version of the plan.');
    const metadataV1 = {
      taskRef,
      taskArtifactSha256: sha256(artifactV1),
      repositoryIdentity: 'github:example/repo',
      startingCommit: 'a'.repeat(40),
    };

    // A tampered (mismatched) pair is rejected before it ever reaches the row.
    await assert.rejects(
      () => publishCoordinationTaskArtifact({
        metadata: { ...metadataV1, taskArtifactSha256: 'b'.repeat(64) },
        artifact: artifactV1,
        publishedBy: 'ci-test',
      }),
      (error: unknown) => error instanceof CoordinationTaskArtifactPublicationError
        && error.code === 'TASK_ARTIFACT_PUBLISH_INVALID',
    );
    assert.equal(await registry.resolve(taskRef), undefined, 'rejected publish must not have written a row');

    const published = await publishCoordinationTaskArtifact({
      metadata: metadataV1, artifact: artifactV1, publishedBy: 'ci-test',
    });
    assert.equal(published.taskRef, taskRef);
    assert.equal(published.taskArtifactSha256, metadataV1.taskArtifactSha256);

    const resolved = await registry.resolve(taskRef);
    assert.deepEqual(resolved, {
      taskRef,
      taskArtifactSha256: metadataV1.taskArtifactSha256,
      repositoryIdentity: metadataV1.repositoryIdentity,
      startingCommit: metadataV1.startingCommit,
    });
    assert.deepEqual(Buffer.from(await registry.readArtifact(taskRef)), Buffer.from(artifactV1));

    // This is the exact call issueCoordinationV2PreparationEnvelope makes.
    const withArtifact = await resolveCoordinationTaskMetadataWithArtifact(taskRef, registry);
    assert.equal(withArtifact.metadata.taskArtifactSha256, metadataV1.taskArtifactSha256);
    assert.deepEqual(Buffer.from(withArtifact.artifact), Buffer.from(artifactV1));

    // Republishing (e.g. after editing the local task file) upserts in place --
    // one current row per taskRef, not a version history.
    const artifactV2 = new TextEncoder().encode('# Task\n\nRevised plan after review.');
    const metadataV2 = { ...metadataV1, taskArtifactSha256: sha256(artifactV2) };
    await publishCoordinationTaskArtifact({ metadata: metadataV2, artifact: artifactV2, publishedBy: 'ci-test-2' });

    const resolvedV2 = await registry.resolve(taskRef);
    assert.equal(resolvedV2?.taskArtifactSha256, metadataV2.taskArtifactSha256);
    assert.deepEqual(Buffer.from(await registry.readArtifact(taskRef)), Buffer.from(artifactV2));
  } finally {
    await closeDbConnections();
  }
});

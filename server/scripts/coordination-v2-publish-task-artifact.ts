/**
 * Publishes one task's launch artifact from local disk into the shared Neon
 * database, so Coordinator V2 preparation can resolve it in every
 * environment -- not just a workspace that happens to have
 * `.local/tasks/task-<ref>.md` on its own filesystem. See
 * PostgresCoordinationTaskMetadataRegistry in
 * server/services/coordination-task-metadata-postgres-registry.ts for the
 * read side.
 *
 * Deliberately reuses FixedRootCoordinationTaskMetadataRegistry unchanged for
 * the read: it already enforces everything a publish step needs -- the task
 * file exists, is a real file (no symlink), the working tree is clean, and
 * the git remote matches the configured/pinned repository identity. This
 * script adds no new trust decision; it only moves already-validated bytes
 * from disk to the database this application already uses for everything
 * else.
 *
 * Usage:
 *   npx tsx server/scripts/coordination-v2-publish-task-artifact.ts <taskRef> [publishedBy]
 */
import {
  FixedRootCoordinationTaskMetadataRegistry,
  CoordinationTaskMetadataError,
} from '../services/coordination-task-metadata-service';
import {
  publishCoordinationTaskArtifact,
  readCoordinationTaskArtifactPublicationState,
} from '../services/coordination-task-artifact-publication-service';

async function main() {
  const taskRef = process.argv[2];
  const publishedBy = process.argv[3] || process.env.USER || process.env.REPL_OWNER || 'operator';
  if (!taskRef || !/^[1-9][0-9]*$/.test(taskRef)) {
    throw new Error('Usage: coordination-v2-publish-task-artifact.ts <taskRef> [publishedBy]');
  }

  const registry = new FixedRootCoordinationTaskMetadataRegistry();
  const metadata = await registry.resolve(taskRef);
  if (!metadata) {
    throw new Error(`No local task artifact found for task ${taskRef} (expected .local/tasks/task-${taskRef}.md with a clean git tree)`);
  }
  const artifact = await registry.readArtifact(taskRef);

  const previous = await readCoordinationTaskArtifactPublicationState(taskRef);
  const result = await publishCoordinationTaskArtifact({ metadata, artifact, publishedBy });

  process.stdout.write(`${JSON.stringify({
    published: true,
    taskRef: result.taskRef,
    taskArtifactSha256: result.taskArtifactSha256,
    repositoryIdentity: metadata.repositoryIdentity,
    startingCommit: metadata.startingCommit,
    publishedBy,
    updatedAt: result.updatedAt,
    replacedPreviousSha256: previous && previous.taskArtifactSha256 !== result.taskArtifactSha256
      ? previous.taskArtifactSha256
      : undefined,
  }, null, 2)}\n`);
}

main().catch((error) => {
  if (error instanceof CoordinationTaskMetadataError) {
    console.error(`${error.code}: could not resolve the local task artifact for publishing`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});

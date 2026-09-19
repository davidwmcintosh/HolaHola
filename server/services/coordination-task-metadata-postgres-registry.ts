import { eq } from 'drizzle-orm';
import { coordinationV2TaskArtifacts } from '@shared/schema';
import { db } from '../db';
import {
  validateTaskRef,
  validateMetadata,
  CoordinationTaskMetadataError,
  type CoordinationTaskMetadata,
  type CoordinationTaskMetadataRegistry,
} from './coordination-task-metadata-service';

/**
 * Postgres-backed registry. Task artifacts are published here (see
 * coordination-task-artifact-publication-service.ts and the
 * `coordination-v2-publish-task-artifact` CLI script) from a workspace that
 * has the real `.local/tasks/task-<ref>.md` file and clean git provenance;
 * this registry then serves the same bytes/metadata from the shared Neon
 * database, which every environment (dev and every deployed target) reads
 * identically -- unlike `FixedRootCoordinationTaskMetadataRegistry`, it never
 * depends on a gitignored local path being present on whichever server
 * happens to be running.
 *
 * This class lives in its own file, separate from
 * `coordination-task-metadata-service.ts`, *because* it imports the live
 * database module (`../db`). That base module is imported by the offline
 * founder-facing digest CLI
 * (`server/scripts/coordination-v2-public-material-digest.ts`), which must
 * keep working with no database connection available -- `../db` throws
 * synchronously at import time otherwise. Keeping this class physically
 * separate means importing anything from the base module (including its
 * `DEFAULT_COORDINATION_TASK_METADATA_REGISTRY`) can never transitively pull
 * in `../db`.
 *
 * Production server code that needs cross-deployment task-artifact
 * resolution imports `POSTGRES_COORDINATION_TASK_METADATA_REGISTRY` from
 * here explicitly (see `server/routes.ts`'s `taskMetadataRegistry` wiring
 * into `registerCoordinationSessionRoutes`/`registerCoordinationHostRoutes`,
 * and `coordination-lifecycle-facade-service.ts`'s
 * `reserveCoordinationLifecyclePreparation`/`launchOrResumeCoordinationLifecycle`,
 * which both honor that override) rather than relying on the DB-free default
 * exported from the base module.
 */
export class PostgresCoordinationTaskMetadataRegistry implements CoordinationTaskMetadataRegistry {
  async resolve(taskRef: string): Promise<CoordinationTaskMetadata | undefined> {
    const ref = validateTaskRef(taskRef);
    const rows = await db.select({
      taskRef: coordinationV2TaskArtifacts.taskRef,
      taskArtifactSha256: coordinationV2TaskArtifacts.taskArtifactSha256,
      repositoryIdentity: coordinationV2TaskArtifacts.repositoryIdentity,
      startingCommit: coordinationV2TaskArtifacts.startingCommit,
    }).from(coordinationV2TaskArtifacts)
      .where(eq(coordinationV2TaskArtifacts.taskRef, ref)).limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return validateMetadata(row, ref);
  }

  async readArtifact(taskRef: string): Promise<Uint8Array> {
    const ref = validateTaskRef(taskRef);
    const rows = await db.select({ artifactBase64: coordinationV2TaskArtifacts.artifactBase64 })
      .from(coordinationV2TaskArtifacts)
      .where(eq(coordinationV2TaskArtifacts.taskRef, ref)).limit(1);
    const row = rows[0];
    if (!row) throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
    try {
      return new Uint8Array(Buffer.from(row.artifactBase64, 'base64'));
    } catch {
      throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
    }
  }
}

/** Singleton production instance -- see the class doc comment for wiring details. */
export const POSTGRES_COORDINATION_TASK_METADATA_REGISTRY: CoordinationTaskMetadataRegistry =
  new PostgresCoordinationTaskMetadataRegistry();

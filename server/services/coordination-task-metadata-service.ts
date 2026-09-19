import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { normalizeCoordinationRepositoryIdentity } from './coordination-repository-identity';

/**
 * This module -- including its default export,
 * `DEFAULT_COORDINATION_TASK_METADATA_REGISTRY` -- must never import the live
 * database module (`../db`), directly or transitively. It is imported by the
 * offline founder-facing digest CLI
 * (`server/scripts/coordination-v2-public-material-digest.ts`), which has a
 * hard "runs with no database connection available" contract enforced by
 * `test-coordination-v2-public-material-digest.test.ts`. `../db` throws
 * synchronously at import time when no database URL is configured, so even
 * an unused top-level import here would crash that CLI.
 *
 * The Postgres-backed registry that production servers actually use to
 * resolve task artifacts (`PostgresCoordinationTaskMetadataRegistry`) lives
 * in the sibling file `coordination-task-metadata-postgres-registry.ts`
 * *because* of this constraint -- see that file's doc comment. Production
 * call sites wire it in explicitly (as a `taskMetadataRegistry` dependency
 * override); they do not get it by relying on the default exported here.
 */

const execFileAsync = promisify(execFile);

/**
 * Server-owned task launch metadata.
 *
 * Task metadata is deliberately not part of the operator command.  Callers
 * may provide a registry (the normal production integration is an approved
 * server-side registry); this module only validates and returns the immutable
 * launch inputs needed by the V2 session envelope.
 */

export type CoordinationTaskMetadata = Readonly<{
  taskRef: string;
  taskArtifactSha256: string;
  repositoryIdentity: string;
  startingCommit: string;
}>;

export interface CoordinationTaskMetadataRegistry {
  resolve(taskRef: string): Promise<CoordinationTaskMetadata | undefined>
    | CoordinationTaskMetadata
    | undefined;
  readArtifact?(taskRef: string): Promise<Uint8Array> | Uint8Array;
}

export type CoordinationGitProvenance = Readonly<{
  repositoryIdentity: string;
  startingCommit: string;
  clean: boolean;
}>;

export type CoordinationTaskMetadataReaders = Readonly<{
  lstat: (path: string) => Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
  readFile: (path: string) => Promise<Uint8Array>;
  git: (rootDir: string) => Promise<CoordinationGitProvenance>;
}>;

export class CoordinationTaskMetadataError extends Error {
  readonly code: 'TASK_METADATA_INVALID_REQUEST' | 'TASK_METADATA_UNSUPPORTED';
  constructor(code: CoordinationTaskMetadataError['code']) {
    super(code);
    this.name = 'CoordinationTaskMetadataError';
    this.code = code;
  }
}

/** Exported so sibling registries (e.g. the Postgres-backed one) can reuse the same validation. */
export function validateTaskRef(taskRef: unknown): string {
  if (typeof taskRef !== 'string' || !/^[1-9][0-9]*$/.test(taskRef)) {
    throw new CoordinationTaskMetadataError('TASK_METADATA_INVALID_REQUEST');
  }
  return taskRef;
}

/** Exported so sibling registries (e.g. the Postgres-backed one) can reuse the same validation. */
export function validateMetadata(value: CoordinationTaskMetadata | undefined, taskRef: string): CoordinationTaskMetadata {
  if (!value
    || value.taskRef !== taskRef
    || !/^[0-9a-f]{64}$/.test(value.taskArtifactSha256)
   || typeof value.repositoryIdentity !== 'string'
   || value.repositoryIdentity.length > 255
    || !/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(value.startingCommit)) {
    throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
  }
  let repositoryIdentity: string;
  try { repositoryIdentity = normalizeCoordinationRepositoryIdentity(value.repositoryIdentity); }
  catch { throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED'); }
  return Object.freeze({
    taskRef,
    taskArtifactSha256: value.taskArtifactSha256,
    repositoryIdentity,
    startingCommit: value.startingCommit,
  });
}

/**
 * Resolve canonical launch metadata without allowing an operator to supply
 * artifact, repository, or commit values.  An absent registry is fail-closed.
 */
export async function resolveCoordinationTaskMetadata(
  taskRef: string,
  dependencies: { registry?: CoordinationTaskMetadataRegistry } = {},
): Promise<CoordinationTaskMetadata> {
  const ref = validateTaskRef(taskRef);
  const registry = dependencies.registry ?? DEFAULT_COORDINATION_TASK_METADATA_REGISTRY;
  const value = await registry.resolve(ref);
  return validateMetadata(value, ref);
}

export const resolveTaskMetadata = resolveCoordinationTaskMetadata;

export async function resolveCoordinationTaskMetadataWithArtifact(
  taskRef: string,
  registry: CoordinationTaskMetadataRegistry = DEFAULT_COORDINATION_TASK_METADATA_REGISTRY,
): Promise<{ metadata: CoordinationTaskMetadata; artifact: Uint8Array }> {
  const metadata = await resolveCoordinationTaskMetadata(taskRef, { registry });
  if (!registry.readArtifact) throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
  const artifact = await registry.readArtifact(taskRef);
  if (createHash('sha256').update(artifact).digest('hex') !== metadata.taskArtifactSha256) {
    throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
  }
  return { metadata, artifact };
}

function defaultReaders(): CoordinationTaskMetadataReaders {
  return {
    lstat: async (path) => lstat(path),
    readFile: async (path) => readFile(path),
    git: async (rootDir) => {
      const run = async (...args: string[]) => {
        const result = await execFileAsync('git', ['-C', rootDir, ...args], { shell: false });
        return result.stdout.trim();
      };
       const repositoryIdentity = normalizeCoordinationRepositoryIdentity(await run('remote', 'get-url', 'origin'));
       const configured = process.env.GITHUB_REPO_URL;
       if (!configured || normalizeCoordinationRepositoryIdentity(configured) !== repositoryIdentity) {
         throw new Error('repository_remote_mismatch');
       }
       if (process.env.COORDINATION_V2_REPOSITORY_IDENTITY
         && normalizeCoordinationRepositoryIdentity(process.env.COORDINATION_V2_REPOSITORY_IDENTITY) !== repositoryIdentity) {
         throw new Error('repository_identity_pin_mismatch');
       }
      const startingCommit = await run('rev-parse', 'HEAD');
      const dirty = await run('status', '--porcelain=v1', '--untracked-files=all');
      return { repositoryIdentity, startingCommit, clean: dirty.length === 0 };
    },
  };
}

/**
 * Fixed-root registry for production. The root is server configuration, not
 * request data. Git is queried with execFile arguments (never a shell command).
 */
export class FixedRootCoordinationTaskMetadataRegistry implements CoordinationTaskMetadataRegistry {
  constructor(
    private readonly rootDir: string = process.cwd(),
    private readonly readers: CoordinationTaskMetadataReaders = defaultReaders(),
  ) {}

  async resolve(taskRef: string): Promise<CoordinationTaskMetadata | undefined> {
    const ref = validateTaskRef(taskRef);
    const root = resolve(this.rootDir);
    const taskPath = resolve(root, '.local', 'tasks', `task-${ref}.md`);
    const relativePath = relative(root, taskPath);
    if (relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)
      || !taskPath.startsWith(`${root}${sep}`)) {
      throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
    }
    try {
      const stat = await this.readers.lstat(taskPath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
      }
      const bytes = await this.readers.readFile(taskPath);
      const provenance = await this.readers.git(root);
      if (!provenance.clean
        || (() => {
          try { normalizeCoordinationRepositoryIdentity(provenance.repositoryIdentity); return false; }
          catch { return true; }
        })()
        || !/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(provenance.startingCommit)) {
        throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
      }
      return validateMetadata({
        taskRef: ref,
        taskArtifactSha256: createHash('sha256').update(bytes).digest('hex'),
        repositoryIdentity: provenance.repositoryIdentity,
        startingCommit: provenance.startingCommit,
      }, ref);
    } catch (error) {
      if (error instanceof CoordinationTaskMetadataError) throw error;
      throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
    }
  }

  async readArtifact(taskRef: string): Promise<Uint8Array> {
    const ref = validateTaskRef(taskRef);
    const root = resolve(this.rootDir);
    const taskPath = resolve(root, '.local', 'tasks', `task-${ref}.md`);
    const relativePath = relative(root, taskPath);
    if (relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath) || !taskPath.startsWith(`${root}${sep}`)) {
      throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
    }
    const stat = await this.readers.lstat(taskPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
    return this.readers.readFile(taskPath);
  }
}

/**
 * Deliberately DB-free (see the module-level comment above). Every function
 * in this file that takes an optional registry -- and every DB-free caller,
 * including the offline digest CLI -- falls back to this filesystem+git
 * registry when no explicit override is supplied.
 *
 * Production server code that must resolve a task's artifact without a
 * gitignored local path (see `coordination-task-metadata-postgres-registry.ts`)
 * depends on an *explicit* `taskMetadataRegistry` override at its real call
 * sites (`server/routes.ts`'s wiring into
 * `registerCoordinationSessionRoutes`/`registerCoordinationHostRoutes`); it
 * does not get Postgres resolution by relying on this default.
 */
export const DEFAULT_COORDINATION_TASK_METADATA_REGISTRY: CoordinationTaskMetadataRegistry =
  new FixedRootCoordinationTaskMetadataRegistry();

/** Injectable object form for callers that keep server registries in a container. */
export class CoordinationTaskMetadataService {
  constructor(private readonly registry: CoordinationTaskMetadataRegistry) {}

  resolve(taskRef: string): Promise<CoordinationTaskMetadata> {
    return resolveCoordinationTaskMetadata(taskRef, { registry: this.registry });
  }

  async resolveWithArtifact(taskRef: string): Promise<{ metadata: CoordinationTaskMetadata; artifact: Uint8Array }> {
    const metadata = await this.resolve(taskRef);
    if (!this.registry.readArtifact) throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
    const artifact = await this.registry.readArtifact(taskRef);
    if (createHash('sha256').update(artifact).digest('hex') !== metadata.taskArtifactSha256) {
      throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
    }
    return { metadata, artifact };
  }
}
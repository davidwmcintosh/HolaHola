import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { isAbsolute, relative, resolve, sep } from 'node:path';

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

function validateTaskRef(taskRef: unknown): string {
  if (typeof taskRef !== 'string' || !/^[1-9][0-9]*$/.test(taskRef)) {
    throw new CoordinationTaskMetadataError('TASK_METADATA_INVALID_REQUEST');
  }
  return taskRef;
}

function validateMetadata(value: CoordinationTaskMetadata | undefined, taskRef: string): CoordinationTaskMetadata {
  if (!value
    || value.taskRef !== taskRef
    || !/^[0-9a-f]{64}$/.test(value.taskArtifactSha256)
    || typeof value.repositoryIdentity !== 'string'
    || value.repositoryIdentity.length === 0
    || value.repositoryIdentity.length > 255
    || value.repositoryIdentity.trim() !== value.repositoryIdentity
    || !/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(value.startingCommit)) {
    throw new CoordinationTaskMetadataError('TASK_METADATA_UNSUPPORTED');
  }
  return Object.freeze({
    taskRef,
    taskArtifactSha256: value.taskArtifactSha256,
    repositoryIdentity: value.repositoryIdentity,
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

function validRepositoryIdentity(value: string): boolean {
  // Accept canonical HTTPS and SCP-like SSH remotes, but not local paths.
  return /^(?:https?:\/\/|ssh:\/\/)[^/\s]+\/[^?\s]+$/.test(value)
    || /^[^@\s/:]+@[^:\s]+:[^/\s]+\/[^?\s]+$/.test(value);
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
      const repositoryIdentity = await run('remote', 'get-url', 'origin');
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
        || !validRepositoryIdentity(provenance.repositoryIdentity)
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
}

export const DEFAULT_COORDINATION_TASK_METADATA_REGISTRY =
  new FixedRootCoordinationTaskMetadataRegistry();

/** Injectable object form for callers that keep server registries in a container. */
export class CoordinationTaskMetadataService {
  constructor(private readonly registry: CoordinationTaskMetadataRegistry) {}

  resolve(taskRef: string): Promise<CoordinationTaskMetadata> {
    return resolveCoordinationTaskMetadata(taskRef, { registry: this.registry });
  }
}
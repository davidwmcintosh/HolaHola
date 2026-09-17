import { execFile as nodeExecFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { promisify } from 'node:util';
import { isAbsolute, join, resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  normalizeCoordinationRepositoryIdentity,
  sameCoordinationRepositoryIdentity,
} from './coordination-repository-identity';
import { parseReleaseIdentity } from './release-identity';
import { coordinationV2SourcePromotions } from '@shared/schema';
import { hashGitCommitSourceContext } from '../../scripts/source-context-digest.mjs';

const execFile = promisify(nodeExecFile);

export const SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION = 3;
export const SOURCE_CONTROL_REQUIRED_CHECKS = [
  'typecheck',
  'build',
  'ciUnit',
  'ciGuards',
  'ciEpisodes',
  'sourceBridgeSafety',
  'githubReleaseSafety',
  'githubSyncShellGuards',
] as const;

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const RENDER_RELEASE_REFERENCE_PATTERN = /^render-release:([0-9a-f]{40}):([0-9a-f]{64})$/;

// A freshly prepared candidate must never inherit a prior candidate
// generation's promotion-completion evidence. writeStatus() otherwise
// carries promotedSha (and related promotion metadata) forward from the
// previous status so it survives incidental synced/dirty/failed writes;
// pass this alongside every ready_to_promote write that starts a new
// candidate window so validPreparedCandidate() cannot mistake a brand-new
// candidate for one already recorded as promoted.
const FRESH_CANDIDATE_STATUS_EXTRA = {
  promotedSha: undefined,
  promotedBy: undefined,
  promotionRequestId: undefined,
  promotionVerificationMode: undefined,
  publicationReference: undefined,
} as const;
const DEFAULT_LOCK_LEASE_MS = 10 * 60 * 1000;
const DEFAULT_RELEASE_HEALTH_TIMEOUT_MS = 10_000;
const MAX_RELEASE_HEALTH_BYTES = 64 * 1024;
const PROTECTED_SNAPSHOT_MAX_PATHS = 16;
const PROTECTED_SNAPSHOT_MAX_BLOB_BYTES = 2 * 1024 * 1024;
const PROTECTED_SNAPSHOT_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

export type ProtectedRemoteSnapshot = {
  sha: string;
  treeSha: string;
  blobs: Record<string, Buffer>;
};

export type ProtectedSnapshotGitRunner = (
  args: string[],
  cwd: string,
  maxBuffer: number,
) => Promise<Buffer>;

function validProtectedSnapshotPaths(fixedPaths: readonly string[]): boolean {
  return Array.isArray(fixedPaths)
    && fixedPaths.length >= 1
    && fixedPaths.length <= PROTECTED_SNAPSHOT_MAX_PATHS
    && new Set(fixedPaths).size === fixedPaths.length
    && fixedPaths.every((path) =>
      typeof path === 'string'
      && path.length <= 512
      && PROTECTED_SNAPSHOT_PATH.test(path)
      && !path.includes('..')
      && !path.includes('\\')
      && !path.includes(':'));
}

/**
 * Materializes one exact commit into a temporary bare repository using a Git
 * runner whose authentication and host verification are supplied by the
 * authority-owning caller.
 */
export async function materializeProtectedGitSnapshot(input: {
  repoUrl: string;
  sha: string;
  fixedPaths: readonly string[];
  runGit: ProtectedSnapshotGitRunner;
  tempParent?: string;
}): Promise<ProtectedRemoteSnapshot> {
  if (!SHA_PATTERN.test(input.sha)
    || typeof input.repoUrl !== 'string'
    || input.repoUrl.length < 1
    || !validProtectedSnapshotPaths(input.fixedPaths)) {
    throw new Error('protected_remote_snapshot_request_invalid');
  }
  const root = await mkdtemp(join(input.tempParent ?? '/tmp', 'holahola-protected-snapshot-'));
  const run = (args: string[], maxBuffer = 2 * 1024 * 1024) =>
    input.runGit(args, root, maxBuffer);
  try {
    await run(['init', '--bare']);
    await run(['remote', 'add', 'origin', input.repoUrl]);
    await run(['config', 'remote.origin.promisor', 'true']);
    await run(['config', 'remote.origin.partialclonefilter', 'blob:none']);
    await run([
      '-c', 'protocol.version=2',
      'fetch', '--no-tags', '--depth=1', '--filter=blob:none', 'origin', input.sha,
    ]);
    const received = (await run(['rev-parse', '--verify', 'FETCH_HEAD^{commit}'], 1024))
      .toString('utf8').trim();
    const treeSha = (await run(['rev-parse', '--verify', `${received}^{tree}`], 1024))
      .toString('utf8').trim();
    assertAuthenticatedRemoteCommitProof(input.sha, { sha: received, treeSha });
    const blobs: Record<string, Buffer> = {};
    for (const path of [...input.fixedPaths].sort()) {
      const object = `${received}:${path}`;
      const sizeText = (await run(['cat-file', '-s', object], 1024))
        .toString('utf8').trim();
      const size = Number(sizeText);
      if (!Number.isSafeInteger(size)
        || size < 1
        || size > PROTECTED_SNAPSHOT_MAX_BLOB_BYTES) {
        throw new Error('protected_remote_snapshot_blob_invalid');
      }
      const bytes = await run(
        ['cat-file', 'blob', object],
        PROTECTED_SNAPSHOT_MAX_BLOB_BYTES + 1,
      );
      if (bytes.length !== size) throw new Error('protected_remote_snapshot_blob_invalid');
      blobs[path] = bytes;
    }
    return { sha: received, treeSha, blobs };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export function assertAuthenticatedRemoteCommitProof(
  expectedSha: string,
  proof: { sha: string; treeSha: string },
  expectedTreeSha?: string,
): void {
  if (!SHA_PATTERN.test(expectedSha) || proof.sha !== expectedSha || !SHA_PATTERN.test(proof.treeSha)
    || (expectedTreeSha !== undefined && proof.treeSha !== expectedTreeSha)) {
    throw new Error('remote_commit_proof_mismatch');
  }
}

export type SourceControlState =
  | 'disabled'
  | 'synced'
  | 'replit_ahead'
  | 'github_ahead'
  | 'ready_to_promote'
  | 'dirty'
  | 'diverged'
  | 'history_incomplete'
  | 'retrying'
  | 'failed';

export interface SourceControlStatus {
  schemaVersion: 3;
  state: SourceControlState;
  origin: string;
  replitSha?: string;
  githubSha?: string;
  candidateSha?: string;
  candidatePreparedAt?: string;
  candidateExpiresAt?: string;
  promotedSha?: string;
  promotedBy?: string;
  promotionRequestId?: string;
  promotionVerificationMode?: string;
  publicationReference?: string;
  validation?: Record<string, unknown>;
  validationManifestVersion?: number;
  validationId?: string;
  error?: string;
  lastSuccessfulSyncAt?: string;
  consecutiveFailures: number;
  lastHeartbeatAt: string;
  updatedAt: string;
}

export interface SourceControlOperation {
  schemaVersion: 1;
  operationId: string;
  action: 'sync' | 'prepare' | 'record';
  actor: string;
  status: 'running' | 'succeeded' | 'failed';
  createdAt: string;
  completedAt?: string;
  requestedSha?: string;
  candidateSha?: string;
  error?: string;
}

export interface SourceControlResult {
  ok: boolean;
  state: SourceControlState;
  replitSha?: string;
  githubSha?: string;
  candidateSha?: string;
  validation?: Record<string, unknown>;
  error?: string;
}

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<CommandResult>;

export interface SourceControlServiceOptions {
  rootDir?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  uuid?: () => string;
  runCommand?: CommandRunner;
  validateCandidate?: (sha: string) => Promise<Record<string, unknown>>;
  recordSourcePromotion?: (input: SourcePromotionRecordInput) => Promise<void>;
  /** Protected remote proof hook. Production uses authenticated GitHub fetch. */
  resolveRemoteCommit?: (sha: string) => Promise<{ sha: string; treeSha: string; parentSha?: string }>;
  /** Protected immutable snapshot hook. Production uses one authenticated bare-repository fetch. */
  resolveRemoteSnapshot?: (
    sha: string,
    fixedPaths: readonly string[],
  ) => Promise<ProtectedRemoteSnapshot>;
  /** Protected Render release proof hook. Production resolves one pinned HTTPS health document. */
  resolveRenderReleaseEvidence?: (
    expectedSha: string,
    expectedSourceContextSha256: string,
  ) => Promise<RenderReleaseEvidence>;
  /** Protected candidate source-context hook. Production hashes the exact local Git commit tree. */
  resolveCandidateSourceContext?: (
    sha: string,
  ) => Promise<{ sourceContextSha256: string; sourceFileCount: number }>;
}

export interface SourcePromotionRecordInput {
  repositoryIdentity: string;
  promotedCommitSha: string;
  exactTreeSha: string;
  publicationReference: string;
  protectedValidationId: string;
  publishTriggerSha?: string;
  parentSha?: string;
  canonicalRecordDigest: string;
  operationReceiptDigest: string;
  operationReceiptReference: string;
}

type LocalPublicationMarkerProof = {
  sha: string;
  treeSha: string;
  parentSha: string;
  subject: string;
};

export type RenderReleaseEvidence = {
  schemaVersion: 1;
  authority: 'build';
  promotable: true;
  commitSha: string;
  sourceContextSha256: string;
  sourceContextAlgorithm: 'sha256(path-nul-kind-nul-bytes-nul-v1)';
  sourceFileCount: number;
  dirtyWorktree: boolean | null;
};

export function validateRenderReleaseEvidence(
  raw: unknown,
  expectedSha: string,
  expectedSourceContextSha256: string,
): RenderReleaseEvidence {
  if (!SHA_PATTERN.test(expectedSha) || !SHA256_PATTERN.test(expectedSourceContextSha256)) {
    throw new Error('render_release_expectation_invalid');
  }
  const identity = parseReleaseIdentity(raw);
  if (
    identity.authority !== 'build'
    || identity.promotable !== true
    || identity.commitSha !== expectedSha
    || identity.sourceContextSha256 !== expectedSourceContextSha256
  ) {
    throw new Error('render_release_identity_mismatch');
  }
  return {
    schemaVersion: 1,
    authority: 'build',
    promotable: true,
    commitSha: identity.commitSha,
    sourceContextSha256: identity.sourceContextSha256,
    sourceContextAlgorithm: 'sha256(path-nul-kind-nul-bytes-nul-v1)',
    sourceFileCount: identity.sourceFileCount,
    dirtyWorktree: identity.dirtyWorktree,
  };
}

export async function resolveRenderReleaseEvidenceFromHealth(
  env: NodeJS.ProcessEnv,
  expectedSha: string,
  expectedSourceContextSha256: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RenderReleaseEvidence> {
  if (!SHA_PATTERN.test(expectedSha) || !SHA256_PATTERN.test(expectedSourceContextSha256)) {
    throw new Error('render_release_expectation_invalid');
  }
  const configured = env.SOURCE_RELEASE_HEALTH_URL;
  if (!configured) throw new Error('render_release_health_url_missing');
  const url = new URL(configured);
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.search
    || url.hash
    || url.pathname !== '/health/release'
  ) {
    throw new Error('render_release_health_url_invalid');
  }
  const configuredTimeout = Number(env.SOURCE_RELEASE_HEALTH_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? Math.min(configuredTimeout, 30_000)
    : DEFAULT_RELEASE_HEALTH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (response.status !== 200) throw new Error('render_release_health_status_invalid');
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RELEASE_HEALTH_BYTES) {
      throw new Error('render_release_health_body_too_large');
    }
    if (!response.body) throw new Error('render_release_health_body_missing');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_RELEASE_HEALTH_BYTES) {
        await reader.cancel();
        throw new Error('render_release_health_body_too_large');
      }
      chunks.push(chunk.value);
    }
    const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
    return validateRenderReleaseEvidence(
      JSON.parse(body),
      expectedSha,
      expectedSourceContextSha256,
    );
  } finally {
    clearTimeout(timeout);
  }
}

type PreparedCandidateEvidence = {
  candidateSha: string;
  candidatePreparedAt: string;
  candidateExpiresAt: string;
  validation: Record<string, unknown>;
};

type CanonicalSourcePromotionFields = {
  repositoryIdentity: string;
  promotedCommitSha: string;
  exactTreeSha: string;
  publicationReference: string;
  protectedValidationId: string;
  publishTriggerSha: string | null;
  parentSha: string | null;
  canonicalRecordDigest: string;
};

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function bounded(value: string): string {
  return value.length <= 8192 ? value : `${value.slice(0, 8192)}\n[truncated]`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function normalizePrivateKey(value: string): string {
  let normalized = value.replaceAll('\r', '').replaceAll('\\n', '\n').replaceAll('\\r', '');
  if (!normalized.includes('\n')) {
    for (const keyType of ['OPENSSH', 'RSA', 'EC', 'DSA', '']) {
      const begin = `-----BEGIN ${keyType ? `${keyType} ` : ''}PRIVATE KEY-----`;
      const end = `-----END ${keyType ? `${keyType} ` : ''}PRIVATE KEY-----`;
      normalized = normalized.replaceAll(begin, `${begin}\n`).replaceAll(end, `\n${end}`);
    }
  }
  if (!normalized.includes('PRIVATE KEY-----')) {
    throw new Error('HOLAHOLA_GITHUB_DEPLOY_KEY does not contain an armored private key.');
  }
  return normalized;
}

const PINNED_GITHUB_HOST_KEYS = [
  'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl',
  'github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=',
  'github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=',
];

function defaultRunner(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }): Promise<CommandResult> {
  return execFile(command, args, {
    cwd: options.cwd,
    env: options.env,
    maxBuffer: 2 * 1024 * 1024,
  }).then(({ stdout, stderr }) => ({
    exitCode: 0,
    stdout: String(stdout || ''),
    stderr: String(stderr || ''),
  })).catch((error: any) => ({
    exitCode: typeof error?.code === 'number' ? error.code : 1,
    stdout: String(error?.stdout || ''),
    stderr: String(error?.stderr || error?.message || ''),
  }));
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function sourceControlEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production'
    && env.SOURCE_CONTROL_ENABLED !== 'false';
}

export function hasValidSourceControlManifest(
  validation: Record<string, unknown> | undefined,
  expectedSha: string,
): boolean {
  const checks = validation?.checks as Record<string, unknown> | undefined;
  const sourceContextSha256 = validation?.sourceContextSha256;
  const sourceFileCount = validation?.sourceFileCount;
  const sourceContextAlgorithm = validation?.sourceContextAlgorithm;
  if (
    validation?.manifestVersion !== SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION
    || validation?.candidateSha !== expectedSha
    || !checks
    || typeof sourceContextSha256 !== 'string'
    || !SHA256_PATTERN.test(sourceContextSha256)
    || sourceContextAlgorithm !== 'sha256(path-nul-kind-nul-bytes-nul-v1)'
    || !Number.isInteger(sourceFileCount)
    || Number(sourceFileCount) < 1
    || Object.keys(checks).length !== SOURCE_CONTROL_REQUIRED_CHECKS.length
    || SOURCE_CONTROL_REQUIRED_CHECKS.some((name) => checks[name] !== 'passed')
  ) return false;
  const canonicalChecks = Object.fromEntries(
    SOURCE_CONTROL_REQUIRED_CHECKS.map((name) => [name, 'passed']),
  );
  const expectedId = digest(JSON.stringify({
    manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
    candidateSha: expectedSha,
    sourceContextSha256,
    sourceContextAlgorithm,
    sourceFileCount,
    checks: canonicalChecks,
  }));
  return validation.validationId === expectedId;
}

export class SourceControlService {
  private readonly rootDir: string;

  private readonly env: NodeJS.ProcessEnv;

  private readonly now: () => Date;

  private readonly resolveRemoteCommit: (sha: string) => Promise<{ sha: string; treeSha: string; parentSha?: string }>;

  private readonly resolveRemoteSnapshot: (
    sha: string,
    fixedPaths: readonly string[],
  ) => Promise<ProtectedRemoteSnapshot>;

  private readonly resolveRenderReleaseEvidence: (
    expectedSha: string,
    expectedSourceContextSha256: string,
  ) => Promise<RenderReleaseEvidence>;

  private readonly resolveCandidateSourceContext: (
    sha: string,
  ) => Promise<{ sourceContextSha256: string; sourceFileCount: number }>;

  private readonly uuid: () => string;

  private readonly runCommand: CommandRunner;

  private readonly validateCandidate: (sha: string) => Promise<Record<string, unknown>>;

  private readonly branch: string;

  private readonly repoUrl: string;

  private readonly repositoryIdentity: string;

  private readonly statusPath: string;

  private readonly summaryPath: string;

  private readonly lockPath: string;

  private readonly operationsDir: string;

  private readonly leaseMs: number;

  private readonly recordSourcePromotion: (input: SourcePromotionRecordInput) => Promise<void>;

  constructor(options: SourceControlServiceOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
    this.uuid = options.uuid || randomUUID;
    this.runCommand = options.runCommand || defaultRunner;
    this.branch = this.env.SOURCE_BRIDGE_BRANCH || 'main';
    this.repoUrl = this.env.GITHUB_REPO_URL || 'git@github.com:davidwmcintosh/holahola.git';
    this.repositoryIdentity = normalizeCoordinationRepositoryIdentity(this.repoUrl);
    this.resolveRemoteCommit = options.resolveRemoteCommit ?? ((sha) => this.fetchRemoteCommitProof(sha));
    this.resolveRemoteSnapshot = options.resolveRemoteSnapshot
      ?? ((sha, fixedPaths) => this.fetchProtectedRemoteSnapshot(sha, fixedPaths));
    this.resolveRenderReleaseEvidence = options.resolveRenderReleaseEvidence
      ?? ((sha, sourceContextSha256) => resolveRenderReleaseEvidenceFromHealth(
        this.env,
        sha,
        sourceContextSha256,
      ));
    this.resolveCandidateSourceContext = options.resolveCandidateSourceContext
      ?? (async (sha) => {
        const source = await hashGitCommitSourceContext(this.rootDir, sha);
        return {
          sourceContextSha256: source.digest,
          sourceFileCount: source.fileCount,
        };
      });
    this.statusPath = this.resolvePath(this.env.SOURCE_BRIDGE_STATUS_FILE, '.local/source-bridge-status.json');
    this.summaryPath = this.resolvePath(this.env.SOURCE_BRIDGE_SUMMARY_FILE, '.local/source-bridge-status.md');
    this.lockPath = this.resolvePath(this.env.SOURCE_CONTROL_LOCK_FILE, '.local/source-control.lock');
    this.operationsDir = this.resolvePath(this.env.SOURCE_CONTROL_OPERATIONS_DIR, '.local/source-control-operations');
    this.leaseMs = Number(this.env.SOURCE_CONTROL_LOCK_LEASE_MS || DEFAULT_LOCK_LEASE_MS);
    this.validateCandidate = options.validateCandidate || ((sha) => this.runValidationManifest(sha));
    this.recordSourcePromotion = options.recordSourcePromotion || ((input) => this.appendSourcePromotion(input));
  }

  async getStatus(): Promise<SourceControlStatus | null> {
    try {
      return JSON.parse(await readFile(this.statusPath, 'utf8')) as SourceControlStatus;
    } catch {
      return null;
    }
  }

  async sync(actor = 'scheduler', operationId = this.uuid()): Promise<SourceControlResult> {
    if (!sourceControlEnabled(this.env)) {
      return { ok: false, state: 'disabled', error: 'Development source control is disabled in production.' };
    }
    return this.withLock(operationId, 'sync', actor, () => this.syncLocked(actor, operationId));
  }

  async preparePromotion(actor = 'api', operationId = this.uuid()): Promise<SourceControlResult> {
    if (!sourceControlEnabled(this.env)) {
      return { ok: false, state: 'disabled', error: 'Development source control is disabled in production.' };
    }
    return this.withLock(operationId, 'prepare', actor, () => this.prepareLocked(actor, operationId));
  }

  async recordPromotion(
    sha: string,
    actor = 'api',
    operationId = this.uuid(),
    publicationReference?: string,
  ): Promise<SourceControlResult> {
    if (!SHA_PATTERN.test(sha)) {
      return { ok: false, state: 'failed', error: 'Promotion recording requires an exact lowercase 40-character SHA.' };
    }
    if (!sourceControlEnabled(this.env)) {
      return { ok: false, state: 'disabled', error: 'Development source control is disabled in production.' };
    }
    return this.withLock(operationId, 'record', actor, () =>
      this.recordLocked(sha, actor, operationId, publicationReference));
  }

  /** Narrow lease surface for isolated reconciliation; it grants no Git actions. */
  async acquireReconciliationLease(): Promise<{ release: () => Promise<void> } | null> {
    return this.acquireLease();
  }

  /** Protected Git transport only; reconciliation receives no credential material. */
  async runReconciliationGit(
    args: string[],
    cwd = this.rootDir,
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    const result = await this.withSsh((env) => this.runCommand('git', args, { cwd, env }));
    return { code: result.exitCode, stdout: result.stdout, stderr: result.stderr };
  }

  private resolvePath(configured: string | undefined, fallback: string): string {
    const selected = configured || fallback;
    return isAbsolute(selected) ? selected : resolve(this.rootDir, selected);
  }

  private async withLock<T>(
    operationId: string,
    action: SourceControlOperation['action'],
    actor: string,
    operation: () => Promise<SourceControlResult>,
  ): Promise<SourceControlResult> {
    const operationRecord: SourceControlOperation = {
      schemaVersion: 1,
      operationId,
      action,
      actor,
      status: 'running',
      createdAt: this.now().toISOString(),
    };
    await this.writeOperation(operationRecord);

    const lock = await this.acquireLease();
    if (!lock) {
      const result = { ok: false, state: 'retrying' as const, error: 'Another source-control operation holds the shared lock.' };
      await this.writeOperation({
        ...operationRecord,
        status: 'failed',
        completedAt: this.now().toISOString(),
        error: result.error,
      });
      await this.writeStatus('retrying', result.error, actor);
      return result;
    }

    try {
      const result = await operation();
      await this.writeOperation({
        ...operationRecord,
        status: result.ok ? 'succeeded' : 'failed',
        completedAt: this.now().toISOString(),
        candidateSha: result.candidateSha,
        error: result.error,
      });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unexpected source-control failure.';
      await this.writeOperation({
        ...operationRecord,
        status: 'failed',
        completedAt: this.now().toISOString(),
        error: message,
      });
      await this.writeStatus('failed', message, actor);
      return { ok: false, state: 'failed', error: message };
    } finally {
      await lock.release();
    }
  }

  private async syncLocked(actor: string, operationId: string): Promise<SourceControlResult> {
    await this.ensureBranch();
    const heads = await this.fetchHeads();
    if (!(await this.isTrackedTreeClean())) {
      const error = 'Uncommitted tracked files prevent automatic source synchronization.';
      await this.writeStatus('dirty', error, actor, heads.local, heads.github);
      return { ok: false, state: 'dirty', ...heads, error };
    }

    const ancestry = await this.ensureAncestry(heads.local, heads.github);
    if (ancestry === 'incomplete') {
      const error = 'Common ancestry is unavailable within the configured shallow-history limit.';
      await this.writeStatus('history_incomplete', error, actor, heads.local, heads.github);
      return { ok: false, state: 'history_incomplete', ...heads, error };
    }
    if (!ancestry) {
      const error = 'Replit and GitHub histories diverged; explicit reconciliation is required.';
      await this.writeStatus('diverged', error, actor, heads.local, heads.github);
      return { ok: false, state: 'diverged', ...heads, error };
    }

    if (heads.local === heads.github) {
      const previous = await this.getStatus();
      const prepared = this.validPreparedCandidate(previous);
      if (prepared?.candidateSha === heads.local && previous?.state === 'ready_to_promote') {
        await this.writePreservedReadyStatus(actor, heads, prepared, 'Awaiting explicit Replit Publish.');
        return {
          ok: true,
          state: 'ready_to_promote',
          ...heads,
          candidateSha: prepared.candidateSha,
          validation: prepared.validation,
        };
      }
      if (prepared && prepared.candidateSha !== heads.local
        && await this.isExactPublishedMarker(heads.local, prepared.candidateSha)) {
        const finalHeads = await this.fetchHeads();
        const markerStillExact = finalHeads.local === heads.local
          && finalHeads.github === heads.github
          && await this.isExactPublishedMarker(finalHeads.local, prepared.candidateSha);
        if (markerStillExact && await this.isTrackedTreeClean()) {
          await this.writePreservedReadyStatus(
            actor,
            finalHeads,
            prepared,
            'Validated candidate remains ready under an exact Replit publication marker.',
          );
          return {
            ok: true,
            state: 'ready_to_promote',
            ...finalHeads,
            candidateSha: prepared.candidateSha,
            validation: prepared.validation,
          };
        }
      }
      await this.writeStatus('synced', '', actor, heads.local, heads.github);
      return { ok: true, state: 'synced', ...heads };
    }

    if (await this.isAncestor(heads.github, heads.local)) {
      const pushed = await this.runGit(['push', this.repoUrl, `${heads.local}:refs/heads/${this.branch}`]);
      if (pushed.exitCode !== 0) {
        const error = bounded(pushed.stderr || 'Fast-forward push failed.');
        await this.writeStatus('failed', error, actor, heads.local, heads.github);
        return { ok: false, state: 'failed', ...heads, error };
      }
      const verified = await this.fetchHeads();
      if (verified.local !== verified.github || verified.local !== heads.local) {
        const error = 'Push completed without proving exact Replit/GitHub equality.';
        await this.writeStatus('failed', error, actor, verified.local, verified.github);
        return { ok: false, state: 'failed', ...verified, error };
      }
      await this.writeStatus('synced', '', actor, verified.local, verified.github);
      return { ok: true, state: 'synced', ...verified };
    }

    if (await this.isAncestor(heads.local, heads.github)) {
      const merged = await this.runGit(['merge', '--ff-only', 'FETCH_HEAD']);
      if (merged.exitCode !== 0) {
        const error = bounded(merged.stderr || 'Fast-forward receive failed.');
        await this.writeStatus('failed', error, actor, heads.local, heads.github);
        return { ok: false, state: 'failed', ...heads, error };
      }
      const received = await this.currentHead();
      const validation = await this.validateCandidate(received);
      const verified = await this.fetchHeads();
      if (verified.local !== received || verified.local !== verified.github) {
        const error = 'Checkout changed during validation; candidate is not promotion-ready.';
        await this.writeStatus('failed', error, actor, verified.local, verified.github);
        return { ok: false, state: 'failed', ...verified, error };
      }
      await this.writeStatus(
        'ready_to_promote',
        'Received GitHub source passed validation; publish remains explicit.',
        actor,
        verified.local,
        verified.github,
        received,
        validation,
        FRESH_CANDIDATE_STATUS_EXTRA,
      );
      return { ok: true, state: 'ready_to_promote', ...verified, candidateSha: received, validation };
    }

    const error = 'Replit and GitHub histories diverged; explicit reconciliation is required.';
    await this.writeStatus('diverged', error, actor, heads.local, heads.github);
    return { ok: false, state: 'diverged', ...heads, error };
  }

  private async prepareLocked(actor: string, _operationId: string): Promise<SourceControlResult> {
    await this.ensureBranch();
    const heads = await this.fetchHeads();
    if (!(await this.isTrackedTreeClean())) {
      const error = 'Promotion preparation refused because the worktree is dirty.';
      await this.writeStatus('dirty', error, actor, heads.local, heads.github);
      return { ok: false, state: 'dirty', ...heads, error };
    }
    if (heads.local !== heads.github) {
      const error = 'Promotion preparation requires exact Replit/GitHub commit equality.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    const validation = await this.validateCandidate(heads.local);
    const verified = await this.fetchHeads();
    if (verified.local !== heads.local || verified.local !== verified.github) {
      const error = 'Validated candidate is no longer the current equal Replit/GitHub commit.';
      await this.writeStatus('failed', error, actor, verified.local, verified.github);
      return { ok: false, state: 'failed', ...verified, error };
    }
    await this.writeStatus(
      'ready_to_promote',
      'Validation passed. Use Replit Publish explicitly.',
      actor,
      verified.local,
      verified.github,
      verified.local,
      validation,
      FRESH_CANDIDATE_STATUS_EXTRA,
    );
    return { ok: true, state: 'ready_to_promote', ...verified, candidateSha: verified.local, validation };
  }

  private async recordLocked(
    sha: string,
    actor: string,
    operationId: string,
    publicationReference?: string,
  ): Promise<SourceControlResult> {
    await this.ensureBranch();
    const heads = await this.fetchHeads();
    if (!(await this.isTrackedTreeClean())) {
      const error = 'Promotion recording refused because the worktree is dirty.';
      await this.writeStatus('dirty', error, actor, heads.local, heads.github);
      return { ok: false, state: 'dirty', ...heads, error };
    }
    const status = await this.getStatus();
    const expiry = Date.parse(status?.candidateExpiresAt || '');
    if (
      status?.state !== 'ready_to_promote'
      || status.candidateSha !== sha
      || !Number.isFinite(expiry)
      || expiry <= this.now().getTime()
      || !hasValidSourceControlManifest(status.validation, sha)
    ) {
      const error = 'Promotion recording refused: the matching validated candidate is missing, stale, or no longer current.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    if (!publicationReference) {
      const error = 'Promotion recording requires a protected publication reference.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    const renderReference = RENDER_RELEASE_REFERENCE_PATTERN.exec(publicationReference);
    if (publicationReference.startsWith('render-release:') && !renderReference) {
      const error = 'Promotion recording refused because the Render publication reference is malformed.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    if (renderReference && renderReference[1] !== sha) {
      const error = 'Promotion recording refused because the Render publication reference names a different commit.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    if (
      renderReference
      && renderReference[2] !== status.validation?.sourceContextSha256
    ) {
      const error = 'Promotion recording refused because Render evidence does not match the protected candidate source context.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    try { await this.verifyConfiguredRepositoryIdentity(); } catch {
      const error = 'Promotion recording refused because the configured and actual GitHub remotes differ.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    let remoteProof: { sha: string; treeSha: string; parentSha?: string };
    try {
      remoteProof = await this.resolveRemoteCommit(sha);
    } catch {
      const error = 'Promotion recording refused because the exact commit tree could not be resolved.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    try { assertAuthenticatedRemoteCommitProof(sha, remoteProof); } catch {
      const error = 'Promotion recording refused because authenticated GitHub commit proof did not match the requested SHA/tree.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    let publicationMarker: LocalPublicationMarkerProof | undefined;
    let remotePublicationMarker: LocalPublicationMarkerProof | undefined;
    if (heads.local !== sha || heads.github !== sha) {
      const markerHeads = [...new Set([heads.local, heads.github].filter((head) => head !== sha))];
      if (markerHeads.length !== 1) {
        const error = 'Promotion recording refused because source heads do not identify one publication marker.';
        await this.writeStatus('failed', error, actor, heads.local, heads.github);
        return { ok: false, state: 'failed', ...heads, error };
      }
      const markerSha = markerHeads[0];
      try {
        publicationMarker = await this.resolveLocalPublicationMarker(markerSha);
      } catch {
        const error = 'Promotion recording refused because the local publication marker could not be verified.';
        await this.writeStatus('failed', error, actor, heads.local, heads.github);
        return { ok: false, state: 'failed', ...heads, error };
      }
      const markerMatches = publicationMarker.parentSha === sha
        && publicationMarker.treeSha === remoteProof.treeSha
        && publicationMarker.subject === 'Published your App'
        && publicationReference === `replit-publish:${sha}:${publicationMarker.sha}`;
      if (!markerMatches) {
        const error = 'Promotion recording refused because the local publication marker does not exactly match the validated candidate.';
        await this.writeStatus('failed', error, actor, heads.local, heads.github);
        return { ok: false, state: 'failed', ...heads, error };
      }
      if (heads.github === markerSha) {
        try {
          const proof = await this.resolveRemoteCommit(markerSha);
          assertAuthenticatedRemoteCommitProof(markerSha, proof, remoteProof.treeSha);
          if (proof.parentSha !== sha) throw new Error('remote_publication_marker_parent_mismatch');
          remotePublicationMarker = publicationMarker;
        } catch {
          const error = 'Promotion recording refused because the authenticated GitHub publication marker did not match the validated candidate.';
          await this.writeStatus('failed', error, actor, heads.local, heads.github);
          return { ok: false, state: 'failed', ...heads, error };
        }
      }
    }
    if (!publicationMarker && !renderReference) {
      const error = 'Promotion recording refused because exact-head publication requires verified Render release evidence.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    let renderReleaseEvidence: RenderReleaseEvidence | undefined;
    if (renderReference) {
      try {
        renderReleaseEvidence = await this.resolveRenderReleaseEvidence(sha, renderReference[2]);
      } catch {
        const error = 'Promotion recording refused because Render release evidence could not be verified.';
        await this.writeStatus('failed', error, actor, heads.local, heads.github);
        return { ok: false, state: 'failed', ...heads, error };
      }
    }
    const validationId = String(status.validation?.validationId || '');
    if (!/^[0-9a-f]{64}$/.test(validationId)) {
      const error = 'Promotion recording refused because protected validation identity is missing.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    const receiptReference = join(this.operationsDir, `promotion-${digest(operationId)}.json`);
    const receipt = `${JSON.stringify({
      operationId,
      actor,
      repositoryIdentity: this.repositoryIdentity,
      sha,
      treeSha: remoteProof.treeSha,
      publicationReference,
      validationId,
      ...(renderReleaseEvidence ? { renderReleaseEvidence } : {}),
      ...(publicationMarker ? { publicationMarker } : {}),
      ...(remotePublicationMarker ? { remotePublicationMarker } : {}),
      createdAt: this.now().toISOString(),
    })}\n`;
    try {
      await this.writeImmutablePromotionReceipt(receiptReference, receipt);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Promotion receipt could not be preserved.';
      await this.writeStatus('failed', message, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error: message };
    }
    let finalHeads: { local: string; github: string };
    let finalMarker: LocalPublicationMarkerProof | undefined;
    let finalRemoteMarker: LocalPublicationMarkerProof | undefined;
    let finalRenderReleaseEvidence: RenderReleaseEvidence | undefined;
    try {
      finalHeads = await this.fetchHeads();
      await this.verifyConfiguredRepositoryIdentity();
      if (publicationMarker) finalMarker = await this.resolveLocalPublicationMarker(publicationMarker.sha);
      if (remotePublicationMarker) {
        const proof = await this.resolveRemoteCommit(remotePublicationMarker.sha);
        assertAuthenticatedRemoteCommitProof(
          remotePublicationMarker.sha,
          proof,
          remotePublicationMarker.treeSha,
        );
        if (proof.parentSha !== remotePublicationMarker.parentSha) {
          throw new Error('remote_publication_marker_parent_mismatch');
        }
        finalRemoteMarker = remotePublicationMarker;
      }
    } catch {
      const error = 'Promotion recording refused because final publication state could not be verified.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    const markerUnchanged = publicationMarker
      ? finalMarker?.sha === publicationMarker.sha
        && finalMarker.treeSha === publicationMarker.treeSha
        && finalMarker.parentSha === publicationMarker.parentSha
        && finalMarker.subject === publicationMarker.subject
      : finalMarker === undefined;
    const remoteMarkerUnchanged = remotePublicationMarker
      ? finalRemoteMarker?.sha === remotePublicationMarker.sha
        && finalRemoteMarker.treeSha === remotePublicationMarker.treeSha
        && finalRemoteMarker.parentSha === remotePublicationMarker.parentSha
        && finalRemoteMarker.subject === remotePublicationMarker.subject
      : finalRemoteMarker === undefined;
    if (finalHeads.local !== heads.local
      || finalHeads.github !== heads.github
      || expiry <= this.now().getTime()
      || !(await this.isTrackedTreeClean())
      || !markerUnchanged
      || !remoteMarkerUnchanged) {
      const error = 'Promotion recording refused because source or publication evidence changed before the authority append.';
      await this.writeStatus('failed', error, actor, finalHeads.local, finalHeads.github);
      return { ok: false, state: 'failed', ...finalHeads, error };
    }
    if (renderReleaseEvidence && renderReference) {
      try {
        finalRenderReleaseEvidence = await this.resolveRenderReleaseEvidence(sha, renderReference[2]);
      } catch {
        const error = 'Promotion recording refused because final Render release evidence could not be verified.';
        await this.writeStatus('failed', error, actor, finalHeads.local, finalHeads.github);
        return { ok: false, state: 'failed', ...finalHeads, error };
      }
      if (JSON.stringify(finalRenderReleaseEvidence) !== JSON.stringify(renderReleaseEvidence)) {
        const error = 'Promotion recording refused because Render release evidence changed before the authority append.';
        await this.writeStatus('failed', error, actor, finalHeads.local, finalHeads.github);
        return { ok: false, state: 'failed', ...finalHeads, error };
      }
    }
    const canonicalRecord = {
      repositoryIdentity: this.repositoryIdentity,
      promotedCommitSha: sha,
      exactTreeSha: remoteProof.treeSha,
      publicationReference,
      protectedValidationId: validationId,
      ...(publicationMarker
        ? {
            publishTriggerSha: publicationMarker.sha,
            publicationMarker,
            ...(remotePublicationMarker ? { remotePublicationMarker } : {}),
          }
        : {}),
      ...(renderReleaseEvidence ? { renderReleaseEvidence } : {}),
    };
    try {
      await this.recordSourcePromotion({
        repositoryIdentity: this.repositoryIdentity,
        promotedCommitSha: sha,
        exactTreeSha: remoteProof.treeSha,
        publicationReference,
        protectedValidationId: validationId,
        publishTriggerSha: publicationMarker?.sha,
        parentSha: remoteProof.parentSha,
        canonicalRecordDigest: digest(JSON.stringify(canonicalRecord)),
        operationReceiptDigest: digest(receipt),
        operationReceiptReference: receiptReference,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'V2 source promotion authority append failed.';
      await this.writeStatus('failed', message, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error: message };
    }
    await this.writeStatus(
      'synced',
      renderReleaseEvidence
        ? 'Verified Render release identity recorded for the current validated candidate.'
        : 'Explicit Replit publish recorded for the current validated candidate.',
      actor,
      heads.local,
      heads.github,
      sha,
      status.validation,
      {
      promotedSha: sha,
      promotedBy: actor,
      promotionRequestId: operationId,
      promotionVerificationMode: renderReleaseEvidence
        ? publicationMarker
          ? 'render_release_health_with_replit_publication_marker'
          : 'render_release_health'
        : 'operator_attestation_with_replit_publication_marker',
      publicationReference,
      },
    );
    return { ok: true, state: 'synced', ...heads, candidateSha: sha };
  }

  private validPreparedCandidate(
    status: SourceControlStatus | null,
  ): PreparedCandidateEvidence | undefined {
    const candidateSha = status?.candidateSha;
    const candidatePreparedAt = status?.candidatePreparedAt;
    const candidateExpiresAt = status?.candidateExpiresAt;
    const preparedAt = Date.parse(candidatePreparedAt || '');
    const expiresAt = Date.parse(candidateExpiresAt || '');
    if (!candidateSha
      || !candidatePreparedAt
      || !candidateExpiresAt
      || !SHA_PATTERN.test(candidateSha)
      || !Number.isFinite(preparedAt)
      || !Number.isFinite(expiresAt)
      || preparedAt > this.now().getTime()
      || expiresAt <= this.now().getTime()
      || expiresAt <= preparedAt
      || !hasValidSourceControlManifest(status?.validation, candidateSha)
      || status?.promotedSha === candidateSha) {
      return undefined;
    }
    return {
      candidateSha,
      candidatePreparedAt,
      candidateExpiresAt,
      validation: status!.validation!,
    };
  }

  private async isExactPublishedMarker(markerSha: string, candidateSha: string): Promise<boolean> {
    try {
      const localMarker = await this.resolveLocalPublicationMarker(markerSha);
      if (localMarker.sha !== markerSha
        || localMarker.parentSha !== candidateSha
        || localMarker.subject !== 'Published your App') return false;
      // The production resolver authenticates each immutable commit through
      // Git's shared FETCH_HEAD. Keep these fetches sequential so one proof
      // cannot overwrite the other's fetched commit before it is inspected.
      const candidateProof = await this.resolveRemoteCommit(candidateSha);
      const markerProof = await this.resolveRemoteCommit(markerSha);
      assertAuthenticatedRemoteCommitProof(candidateSha, candidateProof);
      assertAuthenticatedRemoteCommitProof(markerSha, markerProof, candidateProof.treeSha);
      return localMarker.treeSha === candidateProof.treeSha
        && markerProof.parentSha === candidateSha;
    } catch {
      return false;
    }
  }

  private async writePreservedReadyStatus(
    actor: string,
    heads: { local: string; github: string },
    prepared: PreparedCandidateEvidence,
    message: string,
  ): Promise<void> {
    await this.writeStatus(
      'ready_to_promote',
      message,
      actor,
      heads.local,
      heads.github,
      prepared.candidateSha,
      prepared.validation,
      {
        candidatePreparedAt: prepared.candidatePreparedAt,
        candidateExpiresAt: prepared.candidateExpiresAt,
      },
    );
  }

  private async writeImmutablePromotionReceipt(path: string, contents: string): Promise<void> {
    try {
      const existing = await readFile(path, 'utf8');
      if (existing !== contents) throw new Error('Promotion receipt path already contains different bytes.');
      return;
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await mkdir(join(path, '..'), { recursive: true, mode: 0o700 });
    const temp = `${path}.${this.uuid()}.tmp`;
    await writeFile(temp, contents, { mode: 0o600 });
    await rename(temp, path);
  }

  private async appendSourcePromotion(input: SourcePromotionRecordInput): Promise<void> {
    const selection = {
      id: coordinationV2SourcePromotions.id,
      repositoryIdentity: coordinationV2SourcePromotions.repositoryIdentity,
      promotedCommitSha: coordinationV2SourcePromotions.promotedCommitSha,
      exactTreeSha: coordinationV2SourcePromotions.exactTreeSha,
      publicationReference: coordinationV2SourcePromotions.publicationReference,
      protectedValidationId: coordinationV2SourcePromotions.protectedValidationId,
      publishTriggerSha: coordinationV2SourcePromotions.publishTriggerSha,
      parentSha: coordinationV2SourcePromotions.parentSha,
      canonicalRecordDigest: coordinationV2SourcePromotions.canonicalRecordDigest,
    };
    const matchesInput = (existing: CanonicalSourcePromotionFields) =>
      existing.repositoryIdentity === input.repositoryIdentity
      && existing.promotedCommitSha === input.promotedCommitSha
      && existing.exactTreeSha === input.exactTreeSha
      && existing.publicationReference === input.publicationReference
      && existing.protectedValidationId === input.protectedValidationId
      && existing.publishTriggerSha === (input.publishTriggerSha ?? null)
      && existing.parentSha === (input.parentSha ?? null)
      && existing.canonicalRecordDigest === input.canonicalRecordDigest;
    const existing = await db.select(selection).from(coordinationV2SourcePromotions).where(and(
      eq(coordinationV2SourcePromotions.promotedCommitSha, input.promotedCommitSha),
      eq(coordinationV2SourcePromotions.exactTreeSha, input.exactTreeSha),
      eq(coordinationV2SourcePromotions.publicationReference, input.publicationReference),
      eq(coordinationV2SourcePromotions.protectedValidationId, input.protectedValidationId),
    )).limit(1);
    if (existing.length) {
      if (!matchesInput(existing[0])) throw new Error('Existing source promotion does not match the complete canonical record.');
      return;
    }
    try {
      await db.insert(coordinationV2SourcePromotions).values({
        repositoryIdentity: input.repositoryIdentity,
        promotedCommitSha: input.promotedCommitSha,
        exactTreeSha: input.exactTreeSha,
        publicationReference: input.publicationReference,
        protectedValidationId: input.protectedValidationId,
        publishTriggerSha: input.publishTriggerSha,
        parentSha: input.parentSha,
        canonicalRecordDigest: input.canonicalRecordDigest,
        state: 'published',
        operationReceiptDigest: input.operationReceiptDigest,
        operationReceiptReference: input.operationReceiptReference,
      });
    } catch (error: any) {
      // A concurrent retry may have won the exact idempotency key.
      const concurrent = await db.select(selection).from(coordinationV2SourcePromotions).where(and(
        eq(coordinationV2SourcePromotions.promotedCommitSha, input.promotedCommitSha),
        eq(coordinationV2SourcePromotions.exactTreeSha, input.exactTreeSha),
        eq(coordinationV2SourcePromotions.publicationReference, input.publicationReference),
        eq(coordinationV2SourcePromotions.protectedValidationId, input.protectedValidationId),
      )).limit(1);
      if (!concurrent.length || !matchesInput(concurrent[0])) throw error;
    }
  }

  private async runValidationManifest(sha: string): Promise<Record<string, unknown>> {
    const commands: Array<[string, string[]]> = [
      ['npm', ['run', 'check']],
      ['npm', ['run', 'build']],
      ['npm', ['run', 'test:ci:unit']],
      ['npm', ['run', 'test:ci:guards']],
      ['npm', ['run', 'test:ci:episodes']],
      ['npm', ['run', 'test:source-bridge']],
      ['npm', ['run', 'test:github-release-safety']],
      ['bash', ['scripts/test-github-sync-guards.sh']],
    ];
    for (const [command, args] of commands) {
      const result = await this.runCommand(command, args, { cwd: this.rootDir, env: this.commandEnv() });
      if (result.exitCode !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed validation: ${bounded(result.stderr || result.stdout)}`);
      }
    }
    const sourceContext = await this.resolveCandidateSourceContext(sha);
    if (
      !SHA256_PATTERN.test(sourceContext.sourceContextSha256)
      || !Number.isInteger(sourceContext.sourceFileCount)
      || sourceContext.sourceFileCount < 1
    ) {
      throw new Error('Protected candidate source context is invalid.');
    }
    const checks = Object.fromEntries(SOURCE_CONTROL_REQUIRED_CHECKS.map((name) => [name, 'passed']));
    const sourceContextAlgorithm = 'sha256(path-nul-kind-nul-bytes-nul-v1)';
    return {
      manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
      validationId: digest(JSON.stringify({
        manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
        candidateSha: sha,
        sourceContextSha256: sourceContext.sourceContextSha256,
        sourceContextAlgorithm,
        sourceFileCount: sourceContext.sourceFileCount,
        checks,
      })),
      candidateSha: sha,
      sourceContextSha256: sourceContext.sourceContextSha256,
      sourceContextAlgorithm,
      sourceFileCount: sourceContext.sourceFileCount,
      checks,
    };
  }

  private commandEnv(): NodeJS.ProcessEnv {
    return { ...this.env, GIT_TERMINAL_PROMPT: '0' };
  }

  private async ensureBranch(): Promise<void> {
    const branch = await this.runGit(['branch', '--show-current']);
    if (branch.exitCode !== 0 || branch.stdout.trim() !== this.branch) {
      throw new Error(`Source control requires ${this.branch}; current branch is ${branch.stdout.trim() || 'detached HEAD'}.`);
    }
  }

  private async currentHead(): Promise<string> {
    const result = await this.runGit(['rev-parse', '--verify', 'HEAD^{commit}']);
    if (result.exitCode !== 0 || !SHA_PATTERN.test(result.stdout.trim())) {
      throw new Error('Could not resolve the current exact commit SHA.');
    }
    return result.stdout.trim();
  }

  private async resolveLocalPublicationMarker(sha: string): Promise<LocalPublicationMarkerProof> {
    if (!SHA_PATTERN.test(sha)) throw new Error('local_publication_marker_invalid');
    const result = await this.runGit(['show', '-s', '--format=%H%n%T%n%P%n%s', sha]);
    if (result.exitCode !== 0) throw new Error('local_publication_marker_unresolved');
    const [resolvedSha, treeSha, parentsText, subject, ...extra] = result.stdout.trimEnd().split('\n');
    const parents = parentsText?.split(' ').filter(Boolean) ?? [];
    if (extra.length
      || resolvedSha !== sha
      || !SHA_PATTERN.test(treeSha || '')
      || parents.length !== 1
      || !SHA_PATTERN.test(parents[0] || '')
      || typeof subject !== 'string') {
      throw new Error('local_publication_marker_invalid');
    }
    return { sha: resolvedSha, treeSha, parentSha: parents[0], subject };
  }

  private async fetchRemoteCommitProof(sha: string): Promise<{ sha: string; treeSha: string; parentSha?: string }> {
    if (!SHA_PATTERN.test(sha)) throw new Error('invalid_remote_commit_sha');
    // Fetch the immutable object by SHA, never a branch/ref. The pinned SSH
    // host keys and protected deploy key are enforced by the existing runner.
    const fetched = await this.runGit(['fetch', '--no-tags', '--filter=blob:none', this.repoUrl, sha]);
    if (fetched.exitCode !== 0) throw new Error(`GitHub commit fetch failed: ${bounded(fetched.stderr || fetched.stdout)}`);
    const received = await this.runGit(['rev-parse', '--verify', 'FETCH_HEAD^{commit}']);
    if (received.exitCode !== 0 || received.stdout.trim() !== sha) throw new Error('remote_commit_sha_mismatch');
    const tree = await this.runGit(['rev-parse', '--verify', `${sha}^{tree}`]);
    if (tree.exitCode !== 0 || !SHA_PATTERN.test(tree.stdout.trim())) throw new Error('remote_tree_unresolved');
    const parent = await this.runGit(['rev-parse', '--verify', `${sha}^`]);
    return {
      sha, treeSha: tree.stdout.trim(),
      ...(parent.exitCode === 0 && SHA_PATTERN.test(parent.stdout.trim()) ? { parentSha: parent.stdout.trim() } : {}),
    };
  }

  async verifyConfiguredRepositoryIdentity(): Promise<void> {
    const actual = await this.runGit(['config', '--get', 'remote.origin.url']);
    if (actual.exitCode !== 0) throw new Error('repository_remote_unavailable');
    const actualIdentity = normalizeCoordinationRepositoryIdentity(actual.stdout.trim());
    const configuredIdentity = normalizeCoordinationRepositoryIdentity(this.repoUrl);
    if (actualIdentity !== configuredIdentity) throw new Error('repository_remote_mismatch');
    const pinned = this.env.COORDINATION_V2_REPOSITORY_IDENTITY;
    if (pinned && normalizeCoordinationRepositoryIdentity(pinned) !== actualIdentity) {
      throw new Error('repository_identity_pin_mismatch');
    }
  }

  /**
   * Exposes only the authenticated immutable-object proof used by other
   * authority services. It deliberately does not expose the command runner,
   * local refs, or branch state.
   */
  async resolveProtectedRemoteCommitProof(
    sha: string,
  ): Promise<{ sha: string; treeSha: string; parentSha?: string }> {
    await this.verifyConfiguredRepositoryIdentity();
    return this.fetchRemoteCommitProof(sha);
  }

  /**
   * Reads a closed set of immutable blobs from one authenticated exact-commit
   * fetch. This works in production without a local checkout or .git directory.
   */
  async resolveProtectedRemoteSnapshot(input: {
    sha: string;
    repositoryIdentity: string;
    fixedPaths: readonly string[];
  }): Promise<ProtectedRemoteSnapshot> {
    if (!/^git@github\.com:[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*\.git$/.test(this.repoUrl)
      || !SHA_PATTERN.test(input.sha)
      || !sameCoordinationRepositoryIdentity(input.repositoryIdentity, this.repositoryIdentity)
      || !validProtectedSnapshotPaths(input.fixedPaths)) {
      throw new Error('protected_remote_snapshot_request_invalid');
    }
    const fixedPaths = [...input.fixedPaths].sort();
    const snapshot = await this.resolveRemoteSnapshot(input.sha, fixedPaths);
    assertAuthenticatedRemoteCommitProof(input.sha, snapshot);
    if (!snapshot.blobs || Object.keys(snapshot.blobs).sort().join('\n') !== fixedPaths.join('\n')) {
      throw new Error('protected_remote_snapshot_paths_mismatch');
    }
    const blobs: Record<string, Buffer> = {};
    for (const path of fixedPaths) {
      const value = snapshot.blobs[path];
      if (!Buffer.isBuffer(value)
        || value.length < 1
        || value.length > PROTECTED_SNAPSHOT_MAX_BLOB_BYTES) {
        throw new Error('protected_remote_snapshot_blob_invalid');
      }
      blobs[path] = Buffer.from(value);
    }
    return { sha: snapshot.sha, treeSha: snapshot.treeSha, blobs };
  }

  private async fetchHeads(): Promise<{ local: string; github: string }> {
    const fetched = await this.runGit(['fetch', '--no-tags', '--filter=blob:none', this.repoUrl, this.branch]);
    if (fetched.exitCode !== 0) {
      throw new Error(`GitHub fetch failed: ${bounded(fetched.stderr || fetched.stdout)}`);
    }
    const local = await this.currentHead();
    const remote = await this.runGit(['rev-parse', '--verify', 'FETCH_HEAD^{commit}']);
    if (remote.exitCode !== 0 || !SHA_PATTERN.test(remote.stdout.trim())) {
      throw new Error('Could not resolve the fetched GitHub commit SHA.');
    }
    return { local, github: remote.stdout.trim() };
  }

  private async fetchProtectedRemoteSnapshot(
    sha: string,
    fixedPaths: readonly string[],
  ): Promise<ProtectedRemoteSnapshot> {
    return this.withSsh((env) => materializeProtectedGitSnapshot({
      repoUrl: this.repoUrl,
      sha,
      fixedPaths,
      runGit: async (args, cwd, maxBuffer) => {
        try {
          const result = await execFile('git', args, {
            cwd,
            env,
            encoding: 'buffer',
            maxBuffer,
          });
          return Buffer.from(result.stdout as Buffer);
        } catch {
          throw new Error('protected_remote_snapshot_git_failed');
        }
      },
    }));
  }

  private async isAncestor(ancestor: string, descendant: string): Promise<boolean> {
    const result = await this.runGit(['merge-base', '--is-ancestor', ancestor, descendant]);
    return result.exitCode === 0;
  }

  private async ensureAncestry(local: string, github: string): Promise<boolean | 'incomplete'> {
    const initial = await this.runGit(['merge-base', local, github]);
    if (initial.exitCode === 0) return true;
    const shallow = await this.runGit(['rev-parse', '--is-shallow-repository']);
    if (shallow.stdout.trim() !== 'true') return false;
    const step = Number(this.env.SOURCE_CONTROL_SHALLOW_DEEPEN_STEP || 50);
    const maximum = Number(this.env.SOURCE_CONTROL_SHALLOW_MAX_DEPTH || 500);
    if (!Number.isInteger(step) || step <= 0 || !Number.isInteger(maximum) || maximum <= 0) {
      throw new Error('Invalid shallow-history bounds.');
    }
    let deepened = 0;
    while (deepened < maximum) {
      const amount = Math.min(step, maximum - deepened);
      const result = await this.runGit(['fetch', '--no-tags', '--filter=blob:none', `--deepen=${amount}`, this.repoUrl, this.branch]);
      if (result.exitCode !== 0) throw new Error(`Shallow-history deepening failed: ${bounded(result.stderr || result.stdout)}`);
      deepened += amount;
      const check = await this.runGit(['merge-base', local, github]);
      if (check.exitCode === 0) return true;
    }
    return 'incomplete';
  }

  private async isTrackedTreeClean(): Promise<boolean> {
    const result = await this.runGit(['status', '--porcelain', '--untracked-files=normal']);
    return result.exitCode === 0 && result.stdout.trim() === '';
  }

  private async runGit(args: string[]): Promise<CommandResult> {
    return this.withSsh((env) => this.runCommand('git', args, { cwd: this.rootDir, env }));
  }

  private async withSsh<T>(operation: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
    const raw = this.env.HOLAHOLA_GITHUB_DEPLOY_KEY;
    if (!raw) throw new Error('HOLAHOLA_GITHUB_DEPLOY_KEY is unavailable.');
    const tempDir = join('/tmp', `holahola-source-control-${this.uuid()}`);
    const keyPath = join(tempDir, 'deploy-key');
    const knownHostsPath = join(tempDir, 'known-hosts');
    await mkdir(tempDir, { recursive: true, mode: 0o700 });
    try {
      await writeFile(keyPath, `${normalizePrivateKey(raw)}\n`, { mode: 0o600 });
      await writeFile(knownHostsPath, `${PINNED_GITHUB_HOST_KEYS.join('\n')}\n`, { mode: 0o600 });
      await chmod(keyPath, 0o600);
      await chmod(knownHostsPath, 0o600);
      return await operation({
        ...this.commandEnv(),
        GIT_SSH_COMMAND: `ssh -i ${shellQuote(keyPath)} -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${shellQuote(knownHostsPath)}`,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async acquireLease(): Promise<{ release: () => Promise<void> } | null> {
    await mkdir(join(this.lockPath, '..'), { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = this.uuid();
      const metadata = {
        token,
        pid: process.pid,
        acquiredAt: this.now().toISOString(),
        expiresAt: new Date(this.now().getTime() + this.leaseMs).toISOString(),
      };
      try {
        const handle = await open(this.lockPath, 'wx', 0o600);
        await handle.writeFile(`${JSON.stringify(metadata)}\n`);
        await handle.close();
        let released = false;
        const renew = setInterval(async () => {
          if (released) return;
          try {
            const current = JSON.parse(await readFile(this.lockPath, 'utf8')) as { token?: string };
            if (current.token !== token) return;
            const renewed = {
              ...current,
              expiresAt: new Date(this.now().getTime() + this.leaseMs).toISOString(),
            };
            await writeFile(this.lockPath, `${JSON.stringify(renewed)}\n`, { mode: 0o600 });
          } catch {
            // The operation will fail closed on its next Git command.
          }
        }, Math.max(1000, Math.floor(this.leaseMs / 3)));
        renew.unref();
        return {
          release: async () => {
            released = true;
            clearInterval(renew);
            try {
              const current = JSON.parse(await readFile(this.lockPath, 'utf8')) as { token?: string };
              if (current.token === token) await rm(this.lockPath, { force: true });
            } catch {
              // A missing lock is already released.
            }
          },
        };
      } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
        try {
          const current = JSON.parse(await readFile(this.lockPath, 'utf8')) as { pid?: number; expiresAt?: string };
          const expired = !current.expiresAt || Date.parse(current.expiresAt) <= this.now().getTime();
          if (expired && !isProcessAlive(Number(current.pid))) {
            await rm(this.lockPath, { force: true });
            continue;
          }
        } catch {
          // A partially written lock is treated as contention, never stolen.
        }
        return null;
      }
    }
    return null;
  }

  private async writeOperation(operation: SourceControlOperation): Promise<void> {
    await mkdir(this.operationsDir, { recursive: true, mode: 0o700 });
    const path = join(this.operationsDir, `${digest(operation.operationId)}.json`);
    const temp = `${path}.${process.pid}.${this.uuid()}.tmp`;
    await writeFile(temp, `${JSON.stringify(operation, null, 2)}\n`, { mode: 0o600 });
    await rename(temp, path);
  }

  private async writeStatus(
    state: SourceControlState,
    error: string,
    actor: string,
    local?: string,
    github?: string,
    candidate?: string,
    validation?: Record<string, unknown>,
    extra: Partial<SourceControlStatus> = {},
  ): Promise<void> {
    const previous = await this.getStatus();
    const now = this.now().toISOString();
    const ready = state === 'ready_to_promote';
    const successful = state === 'synced' || ready;
    const status: SourceControlStatus = {
      schemaVersion: 3,
      state,
      origin: actor,
      replitSha: local,
      githubSha: github,
      candidateSha: candidate ?? (ready ? local : previous?.candidateSha),
      candidatePreparedAt: ready ? now : previous?.candidatePreparedAt,
      candidateExpiresAt: ready
        ? new Date(this.now().getTime() + Number(this.env.SOURCE_BRIDGE_PROMOTION_TTL_SECONDS || 3600) * 1000).toISOString()
        : previous?.candidateExpiresAt,
      validation: validation ?? previous?.validation,
      validationManifestVersion: typeof validation?.manifestVersion === 'number'
        ? validation.manifestVersion
        : previous?.validationManifestVersion,
      validationId: typeof validation?.validationId === 'string'
        ? validation.validationId
        : previous?.validationId,
      error: error || undefined,
      lastSuccessfulSyncAt: successful ? now : previous?.lastSuccessfulSyncAt,
      consecutiveFailures: successful ? 0 : (previous?.consecutiveFailures || 0) + 1,
      lastHeartbeatAt: now,
      updatedAt: now,
      // Promotion-completion evidence must survive incidental writes (a
      // later `dirty`/`failed`/plain `synced` sync) the same way candidate
      // evidence does. Otherwise a completed promotion's `promotedSha` marker
      // disappears after exactly one unrelated status write, and a later
      // sync tick can no longer tell a just-promoted candidate apart from
      // one still awaiting promotion. `extra` below still wins when a caller
      // explicitly sets or clears these fields.
      promotedSha: previous?.promotedSha,
      promotedBy: previous?.promotedBy,
      promotionRequestId: previous?.promotionRequestId,
      promotionVerificationMode: previous?.promotionVerificationMode,
      publicationReference: previous?.publicationReference,
      ...extra,
    };
    await mkdir(join(this.statusPath, '..'), { recursive: true });
    const statusTemp = `${this.statusPath}.${process.pid}.${this.uuid()}.tmp`;
    await writeFile(statusTemp, `${JSON.stringify(status, null, 2)}\n`, { mode: 0o600 });
    await rename(statusTemp, this.statusPath);
    const summary = [
      '# Source-control status',
      '',
      `- Updated: ${now}`,
      `- State: **${status.state}**`,
      `- Actor: ${actor}`,
      `- Replit main: ${status.replitSha || 'unknown'}`,
      `- GitHub main: ${status.githubSha || 'unknown'}`,
      `- Candidate: ${status.candidateSha || 'none'}`,
      `- Candidate expires: ${status.candidateExpiresAt || 'not prepared'}`,
      `- Validation: ${status.validation ? JSON.stringify(status.validation) : 'not recorded'}`,
      `- Promoted commit: ${status.promotedSha || 'not recorded'}`,
      `- Error: ${status.error || 'none'}`,
      '',
      'This is local operational state. It does not publish production or change Git history.',
      '',
    ].join('\n');
    const summaryTemp = `${this.summaryPath}.${process.pid}.${this.uuid()}.tmp`;
    await writeFile(summaryTemp, summary, { mode: 0o600 });
    await rename(summaryTemp, this.summaryPath);
  }
}

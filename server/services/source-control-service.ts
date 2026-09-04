import { execFile as nodeExecFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
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

const execFile = promisify(nodeExecFile);

export const SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION = 2;
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
const DEFAULT_LOCK_LEASE_MS = 10 * 60 * 1000;

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
}

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
  if (
    validation?.manifestVersion !== SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION
    || validation?.candidateSha !== expectedSha
    || !checks
    || Object.keys(checks).length !== SOURCE_CONTROL_REQUIRED_CHECKS.length
    || SOURCE_CONTROL_REQUIRED_CHECKS.some((name) => checks[name] !== 'passed')
  ) return false;
  const canonicalChecks = Object.fromEntries(
    SOURCE_CONTROL_REQUIRED_CHECKS.map((name) => [name, 'passed']),
  );
  const expectedId = digest(JSON.stringify({
    manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
    candidateSha: expectedSha,
    checks: canonicalChecks,
  }));
  return validation.validationId === expectedId;
}

export class SourceControlService {
  private readonly rootDir: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly runCommand: CommandRunner;
  private readonly validateCandidate: (sha: string) => Promise<Record<string, unknown>>;
  private readonly branch: string;
  private readonly repoUrl: string;
  private readonly statusPath: string;
  private readonly summaryPath: string;
  private readonly lockPath: string;
  private readonly operationsDir: string;
  private readonly leaseMs: number;

  constructor(options: SourceControlServiceOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
    this.uuid = options.uuid || randomUUID;
    this.runCommand = options.runCommand || defaultRunner;
    this.branch = this.env.SOURCE_BRIDGE_BRANCH || 'main';
    this.repoUrl = this.env.GITHUB_REPO_URL || 'git@github.com:davidwmcintosh/HolaHola.git';
    this.statusPath = this.resolvePath(this.env.SOURCE_BRIDGE_STATUS_FILE, '.local/source-bridge-status.json');
    this.summaryPath = this.resolvePath(this.env.SOURCE_BRIDGE_SUMMARY_FILE, '.local/source-bridge-status.md');
    this.lockPath = this.resolvePath(this.env.SOURCE_CONTROL_LOCK_FILE, '.local/source-control.lock');
    this.operationsDir = this.resolvePath(this.env.SOURCE_CONTROL_OPERATIONS_DIR, '.local/source-control-operations');
    this.leaseMs = Number(this.env.SOURCE_CONTROL_LOCK_LEASE_MS || DEFAULT_LOCK_LEASE_MS);
    this.validateCandidate = options.validateCandidate || ((sha) => this.runValidationManifest(sha));
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
      const state = previous?.state === 'ready_to_promote' && previous.candidateSha === heads.local
        ? 'ready_to_promote'
        : 'synced';
      await this.writeStatus(state, state === 'ready_to_promote' ? 'Awaiting explicit Replit Publish.' : '', actor, heads.local, heads.github);
      return { ok: true, state, ...heads, candidateSha: state === 'ready_to_promote' ? heads.local : undefined };
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
      await this.writeStatus('ready_to_promote', 'Received GitHub source passed validation; publish remains explicit.', actor, verified.local, verified.github, received, validation);
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
    await this.writeStatus('ready_to_promote', 'Validation passed. Use Replit Publish explicitly.', actor, verified.local, verified.github, verified.local, validation);
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
      || heads.local !== sha
      || heads.github !== sha
      || !Number.isFinite(expiry)
      || expiry <= this.now().getTime()
      || !hasValidSourceControlManifest(status.validation, sha)
    ) {
      const error = 'Promotion recording refused: the matching validated candidate is missing, stale, or no longer current.';
      await this.writeStatus('failed', error, actor, heads.local, heads.github);
      return { ok: false, state: 'failed', ...heads, error };
    }
    await this.writeStatus('synced', 'Explicit Replit publish recorded for the current validated candidate.', actor, heads.local, heads.github, sha, status.validation, {
      promotedSha: sha,
      promotedBy: actor,
      promotionRequestId: operationId,
      promotionVerificationMode: 'operator_attestation',
      publicationReference,
    });
    return { ok: true, state: 'synced', ...heads, candidateSha: sha };
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
    const checks = Object.fromEntries(SOURCE_CONTROL_REQUIRED_CHECKS.map((name) => [name, 'passed']));
    return {
      manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
      validationId: digest(JSON.stringify({
        manifestVersion: SOURCE_CONTROL_VALIDATION_MANIFEST_VERSION,
        candidateSha: sha,
        checks,
      })),
      candidateSha: sha,
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
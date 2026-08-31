import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { SourceControlService } from './source-control-service';

const REQUEST_SCHEMA_VERSION = 1;
const MAX_CAPTURE_BYTES = 8_192;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const ACTOR_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const VALIDATION_MANIFEST_VERSION = 2;
const REQUIRED_VALIDATION_CHECKS = [
  'typecheck',
  'build',
  'ciUnit',
  'ciGuards',
  'ciEpisodes',
  'sourceBridgeSafety',
  'githubReleaseSafety',
  'githubSyncShellGuards',
] as const;

export type SourcePromotionAction = 'sync' | 'prepare' | 'record';
export type SourcePromotionRequestStatus =
  | 'accepted'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'ambiguous';

export interface SourceBridgeStatus {
  schemaVersion?: number;
  state?: string;
  candidateSha?: string;
  candidateExpiresAt?: string;
  promotedSha?: string;
  validationManifestVersion?: number;
  validationId?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SourcePromotionRequest {
  schemaVersion: number;
  requestId: string;
  idempotencyKeyHash: string;
  payloadDigest: string;
  action: SourcePromotionAction;
  actor: string;
  status: SourcePromotionRequestStatus;
  requestedSha?: string;
  publicationReference?: string;
  verificationMode?: 'operator_attestation';
  bootId: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  exitCode?: number | null;
  bridgeState?: string;
  candidateSha?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export class SourcePromotionInputError extends Error {}
export class SourcePromotionConflictError extends Error {}

type ExecResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export interface SourcePromotionServiceOptions {
  rootDir?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  uuid?: () => string;
  execBridge?: (
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv },
  ) => Promise<ExecResult>;
  sourceControlService?: SourceControlService;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function bounded(value: string): string {
  return value.length <= MAX_CAPTURE_BYTES
    ? value
    : `${value.slice(0, MAX_CAPTURE_BYTES)}\n[truncated]`;
}

function resolveOperationalPath(rootDir: string, configured: string | undefined, fallback: string): string {
  const selected = configured || fallback;
  return isAbsolute(selected) ? selected : resolve(rootDir, selected);
}

export function sourcePromotionApiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SOURCE_PROMOTION_API_ENABLED === 'true' && Boolean(env.SOURCE_PROMOTION_TOKEN);
}

export function sourcePromotionConfigurationError(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.SOURCE_PROMOTION_API_ENABLED !== 'true') return undefined;
  if (!env.SOURCE_PROMOTION_TOKEN) {
    return 'SOURCE_PROMOTION_API_ENABLED is true but SOURCE_PROMOTION_TOKEN is unavailable; routes were not mounted.';
  }
  return undefined;
}

export function authenticateSourcePromotionToken(
  supplied: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const expected = env.SOURCE_PROMOTION_TOKEN;
  if (!supplied || !expected) return false;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length
    && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function validateSourcePromotionActor(actor: string | undefined): string {
  if (!actor || !ACTOR_PATTERN.test(actor)) {
    throw new SourcePromotionInputError('x-source-promotion-actor must be a 2-64 character audit label.');
  }
  return actor;
}

export function validateSourcePromotionIdempotencyKey(key: string | undefined): string {
  if (!key || !IDEMPOTENCY_PATTERN.test(key)) {
    throw new SourcePromotionInputError('Idempotency-Key must be 16-128 characters using letters, numbers, dot, underscore, colon, or dash.');
  }
  return key;
}

export function validateSourcePromotionSha(sha: string): string {
  const normalized = sha.toLowerCase();
  if (!SHA_PATTERN.test(normalized)) {
    throw new SourcePromotionInputError('sha must be an exact 40-character hexadecimal commit SHA.');
  }
  return normalized;
}

export function hasValidSourcePromotionManifest(
  bridge: SourceBridgeStatus,
  expectedSha: string,
): boolean {
  const validation = bridge.validation as Record<string, unknown> | undefined;
  const checks = validation?.checks as Record<string, unknown> | undefined;
  if (
    validation?.manifestVersion !== VALIDATION_MANIFEST_VERSION
    || validation?.candidateSha !== expectedSha
    || !checks
    || Object.keys(checks).length !== REQUIRED_VALIDATION_CHECKS.length
    || REQUIRED_VALIDATION_CHECKS.some((name) => checks[name] !== 'passed')
  ) return false;
  const canonicalChecks = Object.fromEntries(
    REQUIRED_VALIDATION_CHECKS.map((name) => [name, 'passed']),
  );
  const expectedValidationId = digest(JSON.stringify({
    manifestVersion: VALIDATION_MANIFEST_VERSION,
    candidateSha: expectedSha,
    checks: canonicalChecks,
  }));
  return validation.validationId === expectedValidationId;
}

export class SourcePromotionService {
  private readonly rootDir: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly bootId: string;
  private readonly requestsDir: string;
  private readonly bridgeStatusPath: string;
  private readonly execBridge: SourcePromotionServiceOptions['execBridge'];
  private readonly sourceControlService: SourceControlService;
  private readonly active = new Map<string, Promise<void>>();
  private currentOperationId: string | undefined;

  constructor(options: SourcePromotionServiceOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
    this.uuid = options.uuid || randomUUID;
    this.bootId = this.uuid();
    this.requestsDir = resolveOperationalPath(
      this.rootDir,
      this.env.SOURCE_PROMOTION_REQUESTS_DIR,
      '.local/source-promotion-requests',
    );
    this.bridgeStatusPath = resolveOperationalPath(
      this.rootDir,
      this.env.SOURCE_BRIDGE_STATUS_FILE,
      '.local/source-bridge-status.json',
    );
    this.execBridge = options.execBridge;
    this.sourceControlService = options.sourceControlService || new SourceControlService({
      rootDir: this.rootDir,
      env: this.env,
      now: this.now,
      uuid: this.uuid,
    });
  }

  async getStatus(): Promise<{ bridge: SourceBridgeStatus | null; requests: SourcePromotionRequest[] }> {
    const bridge = await this.readBridgeStatus(false);
    const requests = await this.listRequests();
    return { bridge, requests };
  }

  async getRequest(requestId: string): Promise<SourcePromotionRequest | undefined> {
    const requests = await this.listRequests();
    return requests.find((request) => request.requestId === requestId);
  }

  async prepare(input: {
    idempotencyKey: string;
    actor: string;
  }): Promise<{ request: SourcePromotionRequest; replayed: boolean }> {
    return this.start('prepare', {}, input.idempotencyKey, input.actor);
  }

  async sync(input: {
    idempotencyKey: string;
    actor: string;
  }): Promise<{ request: SourcePromotionRequest; replayed: boolean }> {
    return this.start('sync', {}, input.idempotencyKey, input.actor);
  }

  async record(input: {
    idempotencyKey: string;
    actor: string;
    sha: string;
    publicationReference?: string;
  }): Promise<{ request: SourcePromotionRequest; replayed: boolean }> {
    const sha = validateSourcePromotionSha(input.sha);
    const publicationReference = input.publicationReference?.trim() || undefined;
    if (publicationReference && publicationReference.length > 200) {
      throw new SourcePromotionInputError('publicationReference must be 200 characters or fewer.');
    }
    return this.start(
      'record',
      { sha, publicationReference },
      input.idempotencyKey,
      input.actor,
    );
  }

  async waitForRequest(requestId: string): Promise<SourcePromotionRequest | undefined> {
    await this.active.get(requestId);
    return this.getRequest(requestId);
  }

  private async start(
    action: SourcePromotionAction,
    payload: { sha?: string; publicationReference?: string },
    rawIdempotencyKey: string,
    actor: string,
  ): Promise<{ request: SourcePromotionRequest; replayed: boolean }> {
    const idempotencyKey = validateSourcePromotionIdempotencyKey(rawIdempotencyKey);
    const validatedActor = validateSourcePromotionActor(actor);
    const idempotencyKeyHash = digest(idempotencyKey);
    const payloadDigest = digest(JSON.stringify({ action, payload }));
    const path = join(this.requestsDir, `${idempotencyKeyHash}.json`);
    await mkdir(this.requestsDir, { recursive: true, mode: 0o700 });

    const now = this.now().toISOString();
    const candidate: SourcePromotionRequest = {
      schemaVersion: REQUEST_SCHEMA_VERSION,
      requestId: this.uuid(),
      idempotencyKeyHash,
      payloadDigest,
      action,
      actor: validatedActor,
      status: 'accepted',
      requestedSha: payload.sha,
      publicationReference: payload.publicationReference,
      verificationMode: action === 'record' ? 'operator_attestation' : undefined,
      bootId: this.bootId,
      createdAt: now,
    };

    try {
      await writeFile(path, `${JSON.stringify(candidate, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = await this.readRequest(path);
      if (existing.payloadDigest !== payloadDigest || existing.action !== action) {
        throw new SourcePromotionConflictError('Idempotency-Key was already used for a different source-promotion request.');
      }
      return { request: await this.reconcileOrphan(existing, path), replayed: true };
    }

    const running = this.execute(candidate, path);
    this.active.set(candidate.requestId, running);
    void running.finally(() => this.active.delete(candidate.requestId));
    return { request: candidate, replayed: false };
  }

  private async execute(request: SourcePromotionRequest, path: string): Promise<void> {
    if (this.currentOperationId && this.currentOperationId !== request.requestId) {
      await this.writeRequest(path, {
        ...request,
        status: 'failed',
        completedAt: this.now().toISOString(),
        error: `Source-promotion request ${this.currentOperationId} is already running.`,
      });
      return;
    }
    this.currentOperationId = request.requestId;
    let running: SourcePromotionRequest = {
      ...request,
      status: 'running',
      startedAt: this.now().toISOString(),
    };
    try {
      await this.writeRequest(path, running);

      if (running.action === 'record') {
        const bridge = await this.readBridgeStatus(true);
        const expiry = Date.parse(String(bridge?.candidateExpiresAt || ''));
        if (
          bridge?.state !== 'ready_to_promote'
          || bridge.candidateSha !== running.requestedSha
          || !Number.isFinite(expiry)
          || expiry <= this.now().getTime()
          || !hasValidSourcePromotionManifest(bridge, running.requestedSha!)
        ) {
          running = {
            ...running,
            status: 'failed',
            completedAt: this.now().toISOString(),
            bridgeState: bridge?.state,
            candidateSha: bridge?.candidateSha,
            error: 'The requested SHA is not the current unexpired ready_to_promote candidate with a valid versioned validation manifest.',
          };
          await this.writeRequest(path, running);
          return;
        }
      }

      const args = running.action === 'sync'
        ? ['once']
        : running.action === 'prepare'
          ? ['prepare-promotion']
          : ['record-promotion', running.requestedSha!];
      const operationEnv = {
        ...this.env,
        SOURCE_BRIDGE_ORIGIN: `source-promotion-api:${running.actor}`,
        SOURCE_PROMOTION_ACTOR: running.actor,
        SOURCE_PROMOTION_REQUEST_ID: running.requestId,
        SOURCE_PROMOTION_IDEMPOTENCY_HASH: running.idempotencyKeyHash,
        SOURCE_PROMOTION_VERIFICATION_MODE: running.verificationMode || '',
        SOURCE_PROMOTION_PUBLICATION_REFERENCE: running.publicationReference || '',
      };
      const result = await (this.execBridge
        ? this.execBridge(args, { cwd: this.rootDir, env: operationEnv })
        : (() => {
            const operation = running.action === 'sync'
              ? this.sourceControlService.sync(running.actor, running.requestId)
              : running.action === 'prepare'
                ? this.sourceControlService.preparePromotion(running.actor, running.requestId)
                : this.sourceControlService.recordPromotion(
                    running.requestedSha!,
                    running.actor,
                    running.requestId,
                    running.publicationReference,
                  );
            return operation.then((outcome) => ({
              exitCode: outcome.ok ? 0 : 1,
              stdout: outcome.ok ? `Source-control operation reached ${outcome.state}.` : '',
              stderr: outcome.error || '',
            }));
          })());
      const bridge = await this.readBridgeStatus(false);
      const expectedState = running.action === 'prepare' ? 'ready_to_promote' : 'synced';
      const succeeded = result.exitCode === 0
        && (
          bridge?.state === expectedState
          || (running.action === 'sync' && bridge?.state === 'ready_to_promote')
        )
        && (running.action !== 'record' || bridge.promotedSha === running.requestedSha);
      await this.writeRequest(path, {
        ...running,
        status: succeeded ? 'succeeded' : 'failed',
        completedAt: this.now().toISOString(),
        exitCode: result.exitCode,
        bridgeState: bridge?.state,
        candidateSha: bridge?.candidateSha,
        error: succeeded
          ? undefined
          : bridge?.error || `Source bridge exited without reaching ${expectedState}.`,
        stdout: bounded(result.stdout),
        stderr: bounded(result.stderr),
      });
    } catch (error: unknown) {
      await this.writeRequest(path, {
        ...running,
        status: 'failed',
        completedAt: this.now().toISOString(),
        error: error instanceof Error ? error.message : 'Unexpected source-promotion failure.',
      });
    } finally {
      if (this.currentOperationId === request.requestId) {
        this.currentOperationId = undefined;
      }
    }
  }

  private async listRequests(): Promise<SourcePromotionRequest[]> {
    let names: string[];
    try {
      names = await readdir(this.requestsDir);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const requests = await Promise.all(
      names
        .filter((name) => /^[0-9a-f]{64}\.json$/.test(name))
        .map(async (name) => {
          const path = join(this.requestsDir, name);
          return this.reconcileOrphan(await this.readRequest(path), path);
        }),
    );
    return requests
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  }

  private async reconcileOrphan(
    request: SourcePromotionRequest,
    path: string,
  ): Promise<SourcePromotionRequest> {
    if (
      (request.status === 'accepted' || request.status === 'running')
      && request.bootId !== this.bootId
    ) {
      const ambiguous: SourcePromotionRequest = {
        ...request,
        status: 'ambiguous',
        completedAt: this.now().toISOString(),
        error: 'The application restarted before this request recorded a terminal outcome. Inspect bridge status before retrying with a new key.',
      };
      await this.writeRequest(path, ambiguous);
      return ambiguous;
    }
    return request;
  }

  private async readBridgeStatus(required: boolean): Promise<SourceBridgeStatus | null> {
    try {
      return JSON.parse(await readFile(this.bridgeStatusPath, 'utf8')) as SourceBridgeStatus;
    } catch (error: unknown) {
      if (!required && (error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      if (!required) return null;
      throw new SourcePromotionConflictError('Source bridge status is missing or invalid.');
    }
  }

  private async readRequest(path: string): Promise<SourcePromotionRequest> {
    return JSON.parse(await readFile(path, 'utf8')) as SourcePromotionRequest;
  }

  private async writeRequest(path: string, request: SourcePromotionRequest): Promise<void> {
    const temp = `${path}.${process.pid}.${this.uuid()}.tmp`;
    await writeFile(temp, `${JSON.stringify(request, null, 2)}\n`, { mode: 0o600 });
    await rename(temp, path);
  }
}
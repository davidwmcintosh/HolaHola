import {
  createHash,
  createPublicKey,
  randomUUID,
  verify as verifySignature,
} from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import type { Response } from 'express';
import {
  SourceControlService,
  type ProtectedRemoteSnapshot,
} from './source-control-service';
import { sql } from 'drizzle-orm';
import * as tar from 'tar';
import { db } from '../db';
import {
  coordinationV2RuntimeReleases,
  coordinationV2RuntimeReleaseArtifacts,
  coordinationV2RuntimeBootstrapIssues,
  coordinationV2RuntimeBootstrapAcknowledgements,
  coordinationV2RuntimeReleaseRevocations,
} from '@shared/schema';
import { canonicalJson } from './coordination-policy-canonicalization';
import {
  signCoordinationV2Envelope,
} from './coordination-v2-signing';
import {
  ObjectStorageService,
} from '../replit_integrations/object_storage/objectStorage';
import type { StorageFile } from '../replit_integrations/object_storage/storageFile';

/*
 * This module deliberately has no dependency on a lifecycle, preparation,
 * session, attempt, lease, operation, provider, or credential service.  The
 * runtime bootstrap protocol is an independent authority boundary.
 *
 * The runtime tables are supplied by the approved schema migration.  Keeping
 * the table names in SQL here also lets this protocol be deployed alongside a
 * server binary while the migration is being reviewed; no legacy table is
 * used as a compatibility fallback.
 */

export const RUNTIME_ARTIFACT_MAX_BYTES = 268_435_456;
export const RUNTIME_RELEASE_MAX_TOTAL_BYTES = 268_435_456;
export const RUNTIME_ISSUE_TTL_MS = 5 * 60_000;
export const RUNTIME_FIRST_INSTALL_MAX_AGE_MS = 7 * 24 * 60 * 60_000;
export const RUNTIME_NODE_VERSION = '20.20.0';
export const RUNTIME_NODE_RELEASE_COMMIT = '481637f813e912c4aa3622d7964ab426c97b8e8d';
export const RUNTIME_NODE_KEYRING_SHA256 = '610b8d249da3d5733f5a128def2dd0294dbbf5b5713e6ca2529db8db419dee00';
export const RUNTIME_NODE_SIGNER_FINGERPRINT = 'CC68F5A3106FF448322E48ED27F5E38D5B0A215F';
export const RUNTIME_NODE_KEYRING_URL =
  `https://github.com/nodejs/release-keys/raw/${RUNTIME_NODE_RELEASE_COMMIT}/gpg/pubring.kbx`;
export const RUNTIME_NODE_SHASUMS_URL =
  `https://nodejs.org/dist/v${RUNTIME_NODE_VERSION}/SHASUMS256.txt`;
export const RUNTIME_NODE_SHASUMS_SIGNATURE_URL =
  `https://nodejs.org/dist/v${RUNTIME_NODE_VERSION}/SHASUMS256.txt.sig`;
const RUNTIME_NPM_REGISTRY = 'https://registry.npmjs.org/';
const RUNTIME_MAX_METADATA_BYTES = 2 * 1024 * 1024;
const RUNTIME_MAX_TARBALL_BYTES = 64 * 1024 * 1024;
const HEX64 = /^[0-9a-f]{64}$/;
const SHA40 = /^[0-9a-f]{40}$/;
const OBJECT_KEY = /^coordination-v2\/runtime\/([0-9a-f]{64})\/([A-Za-z0-9._-]+)$/;
const REQUEST_KEY = /^[A-Za-z0-9_-]{1,128}$/;
export const RUNTIME_SOURCE_MEMBER_PATHS = [
  'scripts/hola-coordinator.ps1',
  'server/scripts/coordination-v2-cli.ts',
  'scripts/coordination-v2-server-signing-public.pem',
] as const;
const FIXED_DESTINATIONS: Record<string, string> = {
  node_executable: 'runtime/node.exe',
};
const ESBUILD_WIN32_X64_PREFIX =
  'node_modules/tsx/node_modules/@esbuild/win32-x64/';

// Keep the service explicitly coupled to the reviewed runtime evidence schema.
// Queries remain SQL so the short publication transaction can atomically append
// the immutable rows after external source, provenance, and object verification.
const RUNTIME_EVIDENCE_TABLES = [
  coordinationV2RuntimeReleases,
  coordinationV2RuntimeReleaseArtifacts,
  coordinationV2RuntimeBootstrapIssues,
  coordinationV2RuntimeBootstrapAcknowledgements,
  coordinationV2RuntimeReleaseRevocations,
] as const;

export type RuntimeArtifactInput = {
  role: 'node_executable' | 'tsx_runtime_module';
  fixedDestination: string;
  objectKey: string;
  objectDigest: string;
  byteLength: number;
  mediaType: string;
  requiresAuthenticode: boolean;
};

export type RuntimeSourceMembers = Array<{ fixedPath: string; sha256: string }>;

export type RuntimeReleaseInput = {
  sourcePromotionId: string;
  artifacts: RuntimeArtifactInput[];
  sourceMembers: RuntimeSourceMembers;
  now?: Date;
};

export type RuntimeReleasePublicationDependencies = {
  database?: typeof db;
  deriveProvenance?: typeof deriveCoordinationV2RuntimeProvenance;
  inspectArtifact?: typeof inspectObject;
  uuid?: () => string;
};

type RuntimePublicationPhase =
  | 'request_validation'
  | 'source_precheck'
  | 'provenance_verification'
  | 'object_verification'
  | 'append_transaction'
  | 'uniqueness_recovery';

const RUNTIME_PUBLICATION_PHASE = Symbol('coordinationV2RuntimePublicationPhase');

function annotateRuntimePublicationFailure(error: unknown, phase: RuntimePublicationPhase): void {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) return;
  try {
    Object.defineProperty(error, RUNTIME_PUBLICATION_PHASE, {
      value: phase,
      configurable: true,
    });
  } catch {
    // Logging metadata must never replace or mask the original failure.
  }
}

function runtimePublicationMessageCategory(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^V2_RUNTIME_[A-Z0-9_]+$/.test(value)) return value;
  const normalized = value.toLowerCase();
  if (normalized.includes('failed query')) return 'database_query_failed';
  if (normalized.includes('timeout')) return 'database_timeout';
  if (normalized.includes('connection') && normalized.includes('terminated')) {
    return 'database_connection_terminated';
  }
  if (normalized.includes('connection') && normalized.includes('closed')) {
    return 'database_connection_closed';
  }
  if (normalized.includes('socket') || normalized.includes('websocket')) {
    return 'database_transport_failure';
  }
  return 'unclassified_error';
}

export function describeCoordinationV2RuntimePublicationFailure(
  error: unknown,
  elapsedMs: number,
): {
  phase: RuntimePublicationPhase | 'unknown';
  elapsedMs: number;
  causes: Array<{
    name?: string;
    code?: string;
    constraint?: string;
    message?: string;
  }>;
} {
  const causes: Array<{
    name?: string;
    code?: string;
    constraint?: string;
    message?: string;
  }> = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const value = current as {
      name?: unknown;
      code?: unknown;
      constraint?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    causes.push({
      ...(typeof value.name === 'string' ? { name: value.name.slice(0, 128) } : {}),
      ...(typeof value.code === 'string' ? { code: value.code.slice(0, 128) } : {}),
      ...(typeof value.constraint === 'string'
        ? { constraint: value.constraint.slice(0, 256) } : {}),
      ...(runtimePublicationMessageCategory(value.message)
        ? { message: runtimePublicationMessageCategory(value.message) } : {}),
    });
    current = value.cause;
  }
  const phase = error && (typeof error === 'object' || typeof error === 'function')
    ? (error as { [RUNTIME_PUBLICATION_PHASE]?: RuntimePublicationPhase })[RUNTIME_PUBLICATION_PHASE]
    : undefined;
  return {
    phase: phase ?? 'unknown',
    elapsedMs: Number.isFinite(elapsedMs) && elapsedMs >= 0 ? Math.round(elapsedMs) : 0,
    causes,
  };
}

export type RuntimeProvenanceDependencies = {
  boundedFetch?: (url: string, maxBytes: number) => Promise<Buffer>;
  sourceSnapshot?: (input: {
    repositoryIdentity: string;
    promotedCommitSha: string;
    fixedPaths: readonly string[];
  }) => Promise<ProtectedRemoteSnapshot>;
  verifyGpgSignature?: (input: {
    keyring: Buffer;
    signature: Buffer;
    signedData: Buffer;
  }) => Promise<{ signerFingerprint: string }>;
};

export type RuntimeClosureFile = {
  fixedDestination: string;
  sha256: string;
  byteLength: number;
};

export type RuntimeProvenanceEvidence = {
  lockfileDigest: string;
  runtimeClosureDigest: string;
  provenanceDigest: string;
  nodeChecksum: string;
  signerFingerprint: string;
  keyringDigest: string;
  shasumsDigest: string;
  signatureDigest: string;
  sourceMembers: RuntimeSourceMembers;
  closureFiles: RuntimeClosureFile[];
};

export type RuntimeManifest = {
  protocolVersion: 1;
  kind: 'runtime_bootstrap_manifest';
  issueId: string;
  requestKeyDigest: string;
  hostEnrollmentId: string;
  hostKeyFingerprint: string;
  runtimeReleaseId: string;
  runtimeReleaseDigest: string;
  sourcePromotionId: string;
  repositoryIdentity: string;
  promotedCommitSha: string;
  exactTreeSha: string;
  publicationReference: string;
  protectedValidationId: string;
  sourcePromotionRecordDigest: string;
  artifacts: Array<{
    artifactId: string;
    role: string;
    fixedDestination: string;
    objectDigest: string;
    byteLength: number;
    mediaType: string;
    requiresAuthenticode: boolean;
  }>;
  sourceMembers: RuntimeSourceMembers;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};

export class CoordinationV2RuntimeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'CoordinationV2RuntimeError';
  }
}

export type RuntimeSourceSnapshotDiagnostic =
  | 'deploy_key_missing'
  | 'deploy_key_invalid'
  | 'request_invalid'
  | 'git_operation_failed'
  | 'snapshot_validation_failed'
  | 'filesystem_failed'
  | 'unknown';

export function classifyRuntimeSourceSnapshotFailure(error: unknown): RuntimeSourceSnapshotDiagnostic {
  const message = error instanceof Error ? error.message : '';
  if (message === 'HOLAHOLA_GITHUB_DEPLOY_KEY is unavailable.') return 'deploy_key_missing';
  if (message === 'HOLAHOLA_GITHUB_DEPLOY_KEY does not contain an armored private key.') {
    return 'deploy_key_invalid';
  }
  if (message === 'protected_remote_snapshot_request_invalid') return 'request_invalid';
  if (message === 'protected_remote_snapshot_git_failed') return 'git_operation_failed';
  if ([
    'remote_commit_proof_mismatch',
    'protected_remote_snapshot_blob_invalid',
    'protected_remote_snapshot_paths_mismatch',
  ].includes(message)) {
    return 'snapshot_validation_failed';
  }
  const code = record(error).code;
  if (typeof code === 'string' && [
    'EACCES',
    'EEXIST',
    'EMFILE',
    'ENFILE',
    'ENOENT',
    'ENOSPC',
    'EPERM',
    'EROFS',
  ].includes(code)) {
    return 'filesystem_failed';
  }
  return 'unknown';
}

export function reportRuntimeSourceSnapshotFailure(
  error: unknown,
  warn: (message: string) => void = console.warn,
): RuntimeSourceSnapshotDiagnostic {
  const diagnostic = classifyRuntimeSourceSnapshotFailure(error);
  warn(`[CoordinationV2Runtime] source snapshot unavailable: ${diagnostic}`);
  return diagnostic;
}

function fail(code: string): never {
  throw new CoordinationV2RuntimeError(code);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

const execFileAsync = promisify(execFile);

async function defaultBoundedFetch(url: string, maxBytes: number): Promise<Buffer> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') fail('V2_RUNTIME_PROVENANCE_URL_INVALID');
  const response = await fetch(parsed, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) fail('V2_RUNTIME_PROVENANCE_FETCH_FAILED');
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared && declared > maxBytes) fail('V2_RUNTIME_PROVENANCE_TOO_LARGE');
  if (!response.body) fail('V2_RUNTIME_PROVENANCE_FETCH_FAILED');
  const chunks: Buffer[] = [];
  let length = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      const chunk = Buffer.from(item.value);
      length += chunk.length;
      if (length > maxBytes) fail('V2_RUNTIME_PROVENANCE_TOO_LARGE');
      chunks.push(chunk);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function resolveCoordinationV2RuntimeSourceSnapshot(input: {
  repositoryIdentity: string;
  promotedCommitSha: string;
  fixedPaths: readonly string[];
}, dependencies: {
  resolve?: (input: {
    repositoryIdentity: string;
    promotedCommitSha: string;
    fixedPaths: readonly string[];
  }) => Promise<ProtectedRemoteSnapshot>;
  warn?: (message: string) => void;
} = {}): Promise<ProtectedRemoteSnapshot> {
  try {
    const resolve = dependencies.resolve ?? ((snapshotInput) =>
      new SourceControlService().resolveProtectedRemoteSnapshot({
        sha: snapshotInput.promotedCommitSha,
        repositoryIdentity: snapshotInput.repositoryIdentity,
        fixedPaths: snapshotInput.fixedPaths,
      }));
    return await resolve({
      repositoryIdentity: input.repositoryIdentity,
      promotedCommitSha: input.promotedCommitSha,
      fixedPaths: input.fixedPaths,
    });
  } catch (error) {
    reportRuntimeSourceSnapshotFailure(error, dependencies.warn);
    fail('V2_RUNTIME_SOURCE_SNAPSHOT_UNAVAILABLE');
  }
}

async function defaultVerifyGpgSignature(input: {
  keyring: Buffer;
  signature: Buffer;
  signedData: Buffer;
}): Promise<{ signerFingerprint: string }> {
  const root = await fs.mkdtemp(join(tmpdir(), 'coord-v2-gpg-'));
  try {
    const keyringPath = join(root, 'pubring.kbx');
    const signaturePath = join(root, 'SHASUMS256.txt.sig');
    const dataPath = join(root, 'SHASUMS256.txt');
    await Promise.all([
      fs.writeFile(keyringPath, input.keyring, { mode: 0o600 }),
      fs.writeFile(signaturePath, input.signature, { mode: 0o600 }),
      fs.writeFile(dataPath, input.signedData, { mode: 0o600 }),
    ]);
    let output: string;
    try {
      const result = await execFileAsync('gpgv', [
        '--status-fd', '1', '--keyring', keyringPath,
        signaturePath, dataPath,
      ], {
        encoding: 'utf8',
        maxBuffer: RUNTIME_MAX_METADATA_BYTES,
        env: { ...process.env, GNUPGHOME: root },
      });
      output = String(result.stdout);
    } catch {
      fail('V2_RUNTIME_PROVENANCE_SIGNATURE_INVALID');
    }
    const fingerprints = [...output.matchAll(/^\[GNUPG:\]\s+VALIDSIG\s+([0-9A-F]{40})\s/mg)]
      .map((match) => match[1]);
    if (fingerprints.length !== 1 || fingerprints[0] !== RUNTIME_NODE_SIGNER_FINGERPRINT) {
      fail('V2_RUNTIME_PROVENANCE_SIGNER_INVALID');
    }
    return { signerFingerprint: fingerprints[0] };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function sha256Bytes(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function validateArchivePath(value: string, type: string): void {
  if (!value || value.includes('\0') || value.includes('\\') || value.startsWith('/')
    || /^[A-Za-z]:/.test(value)) fail('V2_RUNTIME_PROVENANCE_ARCHIVE_INVALID');
  const pathValue = type === 'Directory' && value.endsWith('/') ? value.slice(0, -1) : value;
  const segments = pathValue.split('/');
  if (segments[0] !== 'package' || segments.some((segment) =>
    segment === '' || segment === '.' || segment === '..')) {
    fail('V2_RUNTIME_PROVENANCE_ARCHIVE_INVALID');
  }
  if (type !== 'File' && type !== 'Directory') fail('V2_RUNTIME_PROVENANCE_ARCHIVE_INVALID');
}

async function archiveFiles(
  archive: Buffer,
  fixedRoot: string,
): Promise<RuntimeClosureFile[]> {
  const root = await fs.mkdtemp(join(tmpdir(), 'coord-v2-tar-'));
  const archivePath = join(root, 'package.tgz');
  try {
    await fs.writeFile(archivePath, archive, { mode: 0o600 });
    await tar.t({
      file: archivePath,
      strict: true,
      onentry: (entry) => validateArchivePath(entry.path, entry.type),
    });
    const extractionRoot = join(root, 'extract');
    await fs.mkdir(extractionRoot);
    await tar.x({ file: archivePath, cwd: extractionRoot, strict: true, preservePaths: false });
    const found: RuntimeClosureFile[] = [];
    async function walk(current: string): Promise<void> {
      for (const name of await fs.readdir(current)) {
        const absolute = join(current, name);
        const stat = await fs.lstat(absolute);
        if (stat.isSymbolicLink() || stat.isBlockDevice() || stat.isCharacterDevice()
          || stat.isFIFO() || stat.isSocket()) fail('V2_RUNTIME_PROVENANCE_ARCHIVE_INVALID');
        if (stat.isDirectory()) {
          await walk(absolute);
        } else if (stat.isFile()) {
          const archiveRelative = relative(extractionRoot, absolute).replaceAll('\\', '/');
          validateArchivePath(archiveRelative, 'File');
          const bytes = await fs.readFile(absolute);
          found.push({
            fixedDestination: `${fixedRoot}/${archiveRelative.slice('package/'.length)}`,
            sha256: sha256Bytes(bytes),
            byteLength: bytes.length,
          });
        } else {
          fail('V2_RUNTIME_PROVENANCE_ARCHIVE_INVALID');
        }
      }
    }
    await walk(extractionRoot);
    return found;
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function sriDigest(integrity: unknown): { algorithm: 'sha512'; value: string } {
  if (typeof integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity)) {
    fail('V2_RUNTIME_PROVENANCE_SRI_INVALID');
  }
  return { algorithm: 'sha512', value: integrity.slice('sha512-'.length) };
}

function verifySri(bytes: Buffer, integrity: unknown): void {
  const expected = sriDigest(integrity);
  const actual = createHash(expected.algorithm).update(bytes).digest('base64');
  if (actual !== expected.value) fail('V2_RUNTIME_PROVENANCE_SRI_INVALID');
}

export function verifyCoordinationV2RuntimeSri(bytes: Buffer, integrity: unknown): void {
  verifySri(bytes, integrity);
}

export function validateCoordinationV2RuntimeClosure(
  artifacts: readonly RuntimeArtifactInput[],
  closure: readonly RuntimeClosureFile[],
): void {
  const expected = new Map(closure.map((file) => [file.fixedDestination, file]));
  const supplied = artifacts.filter((artifact) => artifact.role === 'tsx_runtime_module');
  if (supplied.length !== closure.length || supplied.some((artifact) => {
    const file = expected.get(artifact.fixedDestination);
    return !file || artifact.objectDigest !== file.sha256 || artifact.byteLength !== file.byteLength;
  })) fail('V2_RUNTIME_PROVENANCE_CLOSURE_MISMATCH');
}

export function validateCoordinationV2RuntimeNodeEvidence(
  artifacts: readonly RuntimeArtifactInput[],
  nodeChecksum: string,
): void {
  const node = artifacts.find((artifact) => artifact.role === 'node_executable');
  if (!node || !HEX64.test(nodeChecksum) || node.objectDigest !== nodeChecksum) {
    fail('V2_RUNTIME_PROVENANCE_NODE_MISMATCH');
  }
}

export function validateCoordinationV2RuntimeSigner(fingerprint: string): void {
  if (fingerprint !== RUNTIME_NODE_SIGNER_FINGERPRINT) {
    fail('V2_RUNTIME_PROVENANCE_SIGNER_INVALID');
  }
}

function lockPackage(lockfile: Record<string, unknown>, fixedPath: string): Record<string, unknown> {
  const packages = lockfile.packages;
  const value = packages && typeof packages === 'object' && !Array.isArray(packages)
    ? (packages as Record<string, unknown>)[fixedPath] : undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('V2_RUNTIME_PROVENANCE_LOCKFILE_INVALID');
  }
  return value as Record<string, unknown>;
}

function packageUrl(value: unknown): string {
  if (typeof value !== 'string') fail('V2_RUNTIME_PROVENANCE_LOCKFILE_INVALID');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org'
    || url.username || url.password || url.port || url.search || url.hash
    || !url.pathname.startsWith('/')) {
    fail('V2_RUNTIME_PROVENANCE_REGISTRY_URL_INVALID');
  }
  return url.toString();
}

async function verifyTarball(
  packageEntry: Record<string, unknown>,
  fixedRoot: string,
  dependencies: RuntimeProvenanceDependencies,
): Promise<RuntimeClosureFile[]> {
  const url = packageUrl(packageEntry.resolved);
  const integrity = sriDigest(packageEntry.integrity);
  const bytes = await (dependencies.boundedFetch ?? defaultBoundedFetch)(url, RUNTIME_MAX_TARBALL_BYTES);
  verifySri(bytes, `sha512-${integrity.value}`);
  return archiveFiles(bytes, fixedRoot);
}

export async function deriveCoordinationV2RuntimeProvenance(input: {
  repositoryIdentity: string;
  promotedCommitSha: string;
  exactTreeSha: string;
  sourceMembers: RuntimeSourceMembers;
  artifacts: RuntimeArtifactInput[];
  dependencies?: RuntimeProvenanceDependencies;
}): Promise<RuntimeProvenanceEvidence> {
  if (!SHA40.test(input.promotedCommitSha) || !SHA40.test(input.exactTreeSha)) {
    fail('V2_RUNTIME_SOURCE_INVALID');
  }
  const dependencies = input.dependencies ?? {};
  const fixedPaths = [...RUNTIME_SOURCE_MEMBER_PATHS, 'package-lock.json'];
  let snapshot: ProtectedRemoteSnapshot;
  if (dependencies.sourceSnapshot) {
    snapshot = await dependencies.sourceSnapshot({
      repositoryIdentity: input.repositoryIdentity,
      promotedCommitSha: input.promotedCommitSha,
      fixedPaths,
    });
  } else {
    snapshot = await resolveCoordinationV2RuntimeSourceSnapshot({
      repositoryIdentity: input.repositoryIdentity,
      promotedCommitSha: input.promotedCommitSha,
      fixedPaths,
    });
  }
  if (snapshot.sha !== input.promotedCommitSha
    || !SHA40.test(snapshot.treeSha)
    || snapshot.treeSha !== input.exactTreeSha) {
    fail('V2_RUNTIME_SOURCE_TREE_MISMATCH');
  }
  if (!snapshot.blobs
    || Object.keys(snapshot.blobs).sort().join('\n') !== [...fixedPaths].sort().join('\n')
    || fixedPaths.some((path) => !Buffer.isBuffer(snapshot.blobs[path]))) {
    fail('V2_RUNTIME_SOURCE_SNAPSHOT_INVALID');
  }
  const blobs = new Map(
    RUNTIME_SOURCE_MEMBER_PATHS.map((fixedPath) =>
      [fixedPath, Buffer.from(snapshot.blobs[fixedPath])] as const),
  );
  const lockfileBytes = Buffer.from(snapshot.blobs['package-lock.json']);
  const sourceMembers = validateCoordinationV2RuntimeSourceMembers(
    RUNTIME_SOURCE_MEMBER_PATHS.map((fixedPath) => ({
      fixedPath,
      sha256: sha256Bytes(blobs.get(fixedPath)!),
    })),
  );
  if (canonicalJson(sourceMembers) !== canonicalJson(validateCoordinationV2RuntimeSourceMembers(input.sourceMembers))) {
    fail('V2_RUNTIME_SOURCE_MEMBERS_MISMATCH');
  }
  let lockfile: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(lockfileBytes.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    lockfile = parsed as Record<string, unknown>;
  } catch {
    fail('V2_RUNTIME_PROVENANCE_LOCKFILE_INVALID');
  }
  if (lockfile.lockfileVersion !== 3) fail('V2_RUNTIME_PROVENANCE_LOCKFILE_INVALID');
  const tsx = lockPackage(lockfile, 'node_modules/tsx');
  const esbuild = lockPackage(lockfile, 'node_modules/tsx/node_modules/esbuild');
  const esbuildPlatform = lockPackage(lockfile, 'node_modules/tsx/node_modules/@esbuild/win32-x64');
  if (tsx.version !== '4.23.1'
    || !tsx.dependencies || typeof tsx.dependencies !== 'object'
    || (tsx.dependencies as Record<string, unknown>).esbuild !== '~0.28.0'
    || esbuild.version !== '0.28.1'
    || !esbuild.optionalDependencies || typeof esbuild.optionalDependencies !== 'object'
    || (esbuild.optionalDependencies as Record<string, unknown>)['@esbuild/win32-x64'] !== '0.28.1'
    || esbuildPlatform.version !== '0.28.1') {
    fail('V2_RUNTIME_PROVENANCE_LOCKFILE_GRAPH_INVALID');
  }
  const closure = [
    ...(await verifyTarball(tsx, 'node_modules/tsx', dependencies)),
    ...(await verifyTarball(esbuild, 'node_modules/tsx/node_modules/esbuild', dependencies)),
    ...(await verifyTarball(
      esbuildPlatform,
      'node_modules/tsx/node_modules/@esbuild/win32-x64',
      dependencies,
    )),
  ].sort((a, b) => a.fixedDestination.localeCompare(b.fixedDestination));
  if (new Set(closure.map((file) => file.fixedDestination)).size !== closure.length) {
    fail('V2_RUNTIME_PROVENANCE_ARCHIVE_INVALID');
  }
  const shasums = await (dependencies.boundedFetch ?? defaultBoundedFetch)(
    RUNTIME_NODE_SHASUMS_URL, RUNTIME_MAX_METADATA_BYTES,
  );
  const signature = await (dependencies.boundedFetch ?? defaultBoundedFetch)(
    RUNTIME_NODE_SHASUMS_SIGNATURE_URL, RUNTIME_MAX_METADATA_BYTES,
  );
  const keyring = await (dependencies.boundedFetch ?? defaultBoundedFetch)(
    RUNTIME_NODE_KEYRING_URL, RUNTIME_MAX_METADATA_BYTES,
  );
  if (sha256Bytes(keyring) !== RUNTIME_NODE_KEYRING_SHA256) {
    fail('V2_RUNTIME_PROVENANCE_KEYRING_INVALID');
  }
  const verified = await (dependencies.verifyGpgSignature ?? defaultVerifyGpgSignature)({
    keyring, signature, signedData: shasums,
  });
  validateCoordinationV2RuntimeSigner(verified.signerFingerprint);
  const checksumMatches = [...shasums.toString('utf8').split(/\r?\n/).filter((line) =>
    /^[0-9a-f]{64}  win-x64\/node\.exe$/.test(line))];
  if (checksumMatches.length !== 1) fail('V2_RUNTIME_PROVENANCE_CHECKSUM_INVALID');
  const nodeChecksum = checksumMatches[0].slice(0, 64);
  validateCoordinationV2RuntimeNodeEvidence(input.artifacts, nodeChecksum);
  validateCoordinationV2RuntimeClosure(input.artifacts, closure);
  const lockfileDigest = sha256Bytes(lockfileBytes);
  const runtimeClosureDigest = digest(closure);
  const provenanceDigest = digest({
    nodeVersion: RUNTIME_NODE_VERSION,
    nodeReleaseCommit: RUNTIME_NODE_RELEASE_COMMIT,
    keyringUrl: RUNTIME_NODE_KEYRING_URL,
    keyringDigest: sha256Bytes(keyring),
    signerFingerprint: verified.signerFingerprint,
    shasumsUrl: RUNTIME_NODE_SHASUMS_URL,
    shasumsDigest: sha256Bytes(shasums),
    signatureUrl: RUNTIME_NODE_SHASUMS_SIGNATURE_URL,
    signatureDigest: sha256Bytes(signature),
    nodeChecksum,
    lockfileDigest,
    runtimeClosureDigest,
    sourceMembers,
  });
  return {
    lockfileDigest,
    runtimeClosureDigest,
    provenanceDigest,
    nodeChecksum,
    signerFingerprint: verified.signerFingerprint,
    keyringDigest: sha256Bytes(keyring),
    shasumsDigest: sha256Bytes(shasums),
    signatureDigest: sha256Bytes(signature),
    sourceMembers,
    closureFiles: closure,
  };
}

function text(value: unknown, max = 512): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max
    || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    fail('V2_RUNTIME_INVALID_REQUEST');
  }
  return value;
}

function rowOf(result: unknown): Record<string, unknown> | undefined {
  const value = result as { rows?: unknown[] } | unknown[];
  return (Array.isArray(value) ? value[0] : value.rows?.[0]) as Record<string, unknown> | undefined;
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  const value = result as { rows?: unknown[] } | unknown[];
  return (Array.isArray(value) ? value : value.rows ?? []) as Record<string, unknown>[];
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) fail('V2_RUNTIME_DATABASE_UNAVAILABLE');
  return date.toISOString();
}

function dateValue(value: unknown): Date {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) fail('V2_RUNTIME_DATABASE_UNAVAILABLE');
  return date;
}

export function validateCoordinationV2RuntimeSourceMembers(value: unknown): RuntimeSourceMembers {
  if (!Array.isArray(value) || value.length !== RUNTIME_SOURCE_MEMBER_PATHS.length) {
    fail('V2_RUNTIME_SOURCE_MEMBERS_INVALID');
  }
  const members = value.map((raw) => {
    const item = record(raw);
    if (!exactKeys(item, ['fixedPath', 'sha256'])
      || typeof item.fixedPath !== 'string' || !HEX64.test(String(item.sha256))) {
      fail('V2_RUNTIME_SOURCE_MEMBERS_INVALID');
    }
    return { fixedPath: item.fixedPath, sha256: String(item.sha256) };
  });
  const expected = new Set<string>(RUNTIME_SOURCE_MEMBER_PATHS);
  if (new Set(members.map((member) => member.fixedPath)).size !== members.length
    || members.some((member) => !expected.has(member.fixedPath))) {
    fail('V2_RUNTIME_SOURCE_MEMBERS_INVALID');
  }
  return members.sort((a, b) => a.fixedPath.localeCompare(b.fixedPath));
}

function sourceMembersFromRow(value: unknown): RuntimeSourceMembers {
  try {
    return validateCoordinationV2RuntimeSourceMembers(typeof value === 'string' ? JSON.parse(value) : value);
  } catch (error) {
    if (error instanceof CoordinationV2RuntimeError) throw error;
    fail('V2_RUNTIME_SOURCE_MEMBERS_INVALID');
  }
}

function canonicalArtifacts(input: RuntimeArtifactInput[]) {
  return input.map((artifact) => ({
    role: artifact.role,
    fixedDestination: artifact.fixedDestination,
    objectKey: artifact.objectKey,
    objectDigest: artifact.objectDigest,
    byteLength: artifact.byteLength,
    mediaType: artifact.mediaType,
    requiresAuthenticode: artifact.requiresAuthenticode,
  })).sort((a, b) => `${a.role}:${a.objectKey}`.localeCompare(`${b.role}:${b.objectKey}`));
}

function normalizeArtifacts(value: unknown): RuntimeArtifactInput[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4096) {
    fail('V2_RUNTIME_ARTIFACT_INVALID');
  }
  const artifacts = value.map((raw) => {
    const artifact = record(raw);
    if (!exactKeys(artifact, [
      'role', 'fixedDestination', 'objectKey', 'objectDigest', 'byteLength',
      'mediaType', 'requiresAuthenticode',
    ])) fail('V2_RUNTIME_ARTIFACT_INVALID');
    return artifact as unknown as RuntimeArtifactInput;
  });
  const node = artifacts.filter((artifact) => artifact.role === 'node_executable');
  const tsx = artifacts.filter((artifact) => artifact.role === 'tsx_runtime_module');
  if (node.length !== 1 || tsx.length < 1 || tsx.length > 4095) {
    fail('V2_RUNTIME_ARTIFACT_INVALID');
  }
  artifacts.forEach(assertArtifact);
  const destinations = artifacts.map((artifact) => artifact.fixedDestination);
  if (new Set(destinations).size !== destinations.length
    || node[0].fixedDestination !== 'runtime/node.exe'
    || node[0].requiresAuthenticode !== true
    || node[0].mediaType !== 'application/vnd.microsoft.portable-executable') {
    fail('V2_RUNTIME_ARTIFACT_INVALID');
  }
  const total = artifacts.reduce((sum, artifact) => sum + artifact.byteLength, 0);
  if (!Number.isSafeInteger(total) || total > RUNTIME_RELEASE_MAX_TOTAL_BYTES) {
    fail('V2_RUNTIME_RELEASE_SIZE_INVALID');
  }
  return artifacts;
}

export function validateCoordinationV2RuntimeArtifacts(value: unknown): RuntimeArtifactInput[] {
  return normalizeArtifacts(value);
}

export function sortCoordinationV2RuntimeManifestArtifacts<T extends { fixedDestination: string }>(
  artifacts: readonly T[],
): T[] {
  return [...artifacts].sort((a, b) => a.fixedDestination.localeCompare(b.fixedDestination));
}

export function computeCoordinationV2RuntimeManifestTemplateDigest(
  artifacts: RuntimeArtifactInput[],
  sourceMembers: RuntimeSourceMembers,
): string {
  return digest({
    protocolVersion: 1,
    kind: 'runtime_bootstrap_manifest',
    artifacts: canonicalArtifacts(artifacts),
    sourceMembers: validateCoordinationV2RuntimeSourceMembers(sourceMembers),
  });
}

export function computeCoordinationV2RuntimeReleaseDigest(input: {
  sourcePromotionId: string;
  repositoryIdentity: string;
  promotedCommitSha: string;
  exactTreeSha: string;
  publicationReference: string;
  protectedValidationId: string;
  sourcePromotionRecordDigest: string;
  artifacts: RuntimeArtifactInput[];
  sourceMembers: RuntimeSourceMembers;
  provenanceDigest: string;
}): string {
  return digest({
    protocolVersion: 1,
    sourcePromotionId: input.sourcePromotionId,
    repositoryIdentity: input.repositoryIdentity,
    promotedCommitSha: input.promotedCommitSha,
    exactTreeSha: input.exactTreeSha,
    publicationReference: input.publicationReference,
    protectedValidationId: input.protectedValidationId,
    sourcePromotionRecordDigest: input.sourcePromotionRecordDigest,
    artifacts: canonicalArtifacts(input.artifacts),
    sourceMembers: validateCoordinationV2RuntimeSourceMembers(input.sourceMembers),
    provenanceDigest: input.provenanceDigest,
  });
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const expected = new Set(allowed);
  return Object.keys(value).every((key) => expected.has(key))
    && allowed.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isSafeTsxDestination(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 512
    || !value.startsWith('node_modules/tsx/') || value.includes('\\')
    || value.includes(':')
    || /[\u0000-\u001f\u007f]/.test(value)) return false;
  const relativePath = value.startsWith(ESBUILD_WIN32_X64_PREFIX)
    ? value.slice(ESBUILD_WIN32_X64_PREFIX.length)
    : value.slice('node_modules/tsx/'.length);
  const segments = relativePath.split('/');
  return segments.length > 0 && segments.every((segment) =>
    segment.length > 0 && segment !== '.' && segment !== '..'
      && /^[A-Za-z0-9._-]+$/.test(segment));
}

function assertArtifact(input: RuntimeArtifactInput): void {
  if (!exactKeys(input as unknown as Record<string, unknown>, [
    'role', 'fixedDestination', 'objectKey', 'objectDigest', 'byteLength',
    'mediaType', 'requiresAuthenticode',
  ]) || !['node_executable', 'tsx_runtime_module'].includes(input.role)
    || (input.role === 'node_executable'
      && (input.fixedDestination !== FIXED_DESTINATIONS.node_executable
        || input.requiresAuthenticode !== true
        || input.mediaType !== 'application/vnd.microsoft.portable-executable'))
    || (input.role === 'tsx_runtime_module'
      && (!isSafeTsxDestination(input.fixedDestination)
        || input.requiresAuthenticode !== false))
    || typeof input.fixedDestination !== 'string' || input.fixedDestination.length > 512
    || !OBJECT_KEY.test(input.objectKey) || !HEX64.test(input.objectDigest)
    || !Number.isSafeInteger(input.byteLength) || input.byteLength < 1
    || input.byteLength > RUNTIME_ARTIFACT_MAX_BYTES || typeof input.mediaType !== 'string'
    || input.mediaType.length < 1 || input.mediaType.length > 128
    || typeof input.requiresAuthenticode !== 'boolean') {
    fail('V2_RUNTIME_ARTIFACT_INVALID');
  }
  const keyDigest = input.objectKey.match(OBJECT_KEY)?.[1];
  if (keyDigest !== input.objectDigest) fail('V2_RUNTIME_ARTIFACT_DIGEST_MISMATCH');
}

async function fixedObject(objectKey: string): Promise<StorageFile> {
  if (!OBJECT_KEY.test(objectKey)) fail('V2_RUNTIME_ARTIFACT_INVALID');
  // ObjectStorageService maps /objects/* only into PRIVATE_OBJECT_DIR.  The
  // key is fixed by the release row, never supplied as a bucket or URL.
  try {
    return await new ObjectStorageService().getObjectEntityFile(`/objects/${objectKey}`);
  } catch {
    fail('V2_RUNTIME_OBJECT_NOT_FOUND');
  }
}

async function inspectObject(objectKey: string): Promise<{ file: StorageFile; length: number; digest: string }> {
  const file = await fixedObject(objectKey);
  const metadata = await file.getMetadata();
  const declared = Number(metadata.size);
  if (!Number.isSafeInteger(declared) || declared < 1 || declared > RUNTIME_ARTIFACT_MAX_BYTES) {
    fail('V2_RUNTIME_OBJECT_SIZE_INVALID');
  }
  const hash = createHash('sha256');
  let length = 0;
  const stream = file.createReadStream();
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer | Uint8Array) => {
      length += chunk.byteLength;
      if (length > RUNTIME_ARTIFACT_MAX_BYTES) {
        (stream as NodeJS.ReadableStream & { destroy(error?: Error): void })
          .destroy(new Error('runtime_object_too_large'));
        reject(new CoordinationV2RuntimeError('V2_RUNTIME_OBJECT_TOO_LARGE'));
        return;
      }
      hash.update(chunk);
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  if (length !== declared) fail('V2_RUNTIME_OBJECT_LENGTH_MISMATCH');
  return { file, length, digest: hash.digest('hex') };
}

async function currentSource(tx: typeof db): Promise<Record<string, unknown> | undefined> {
  const result = await tx.execute(sql`
    SELECT id, repository_identity, promoted_commit_sha, exact_tree_sha,
      publication_reference, protected_validation_id, canonical_record_digest,
      created_at
    FROM coordination_v2_source_promotions
    WHERE state = 'published'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return rowOf(result);
}

function sourceMatches(current: Record<string, unknown> | undefined, source: Record<string, unknown>): boolean {
  return !!current && String(current.id) === String(source.id)
    && String(current.repository_identity) === String(source.repository_identity)
    && String(current.promoted_commit_sha) === String(source.promoted_commit_sha)
    && String(current.exact_tree_sha) === String(source.exact_tree_sha)
    && String(current.publication_reference) === String(source.publication_reference)
    && String(current.protected_validation_id) === String(source.protected_validation_id)
    && String(current.canonical_record_digest) === String(source.canonical_record_digest);
}

function isReleaseDigestConflict(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const value = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (value.code === '23505'
      && value.constraint === 'uq_coordination_v2_runtime_release_digest') {
      return true;
    }
    current = value.cause;
  }
  return false;
}

function persistedReleaseMatches(
  release: Record<string, unknown>,
  persistedArtifacts: Record<string, unknown>[],
  source: Record<string, unknown>,
  artifacts: RuntimeArtifactInput[],
  sourceMembers: RuntimeSourceMembers,
  provenance: RuntimeProvenanceEvidence,
): boolean {
  if (String(release.source_promotion_id) !== String(source.id)
    || String(release.repository_identity) !== String(source.repository_identity)
    || String(release.promoted_commit_sha) !== String(source.promoted_commit_sha)
    || String(release.exact_tree_sha) !== String(source.exact_tree_sha)
    || String(release.publication_reference) !== String(source.publication_reference)
    || String(release.protected_validation_id) !== String(source.protected_validation_id)
    || String(release.source_promotion_record_digest) !== String(source.canonical_record_digest)) {
    return false;
  }
  if (String(release.node_version) !== RUNTIME_NODE_VERSION
    || String(release.node_release_keyring_commit) !== RUNTIME_NODE_RELEASE_COMMIT
    || String(release.node_release_keyring_digest) !== provenance.keyringDigest
    || String(release.node_shasums_digest) !== provenance.shasumsDigest
    || String(release.node_signature_digest) !== provenance.signatureDigest
    || String(release.node_signer_fingerprint) !== provenance.signerFingerprint
    || String(release.lockfile_digest) !== provenance.lockfileDigest
    || String(release.runtime_closure_digest) !== provenance.runtimeClosureDigest
    || String(release.provenance_digest) !== provenance.provenanceDigest) return false;
  let persistedMembers: RuntimeSourceMembers;
  try { persistedMembers = sourceMembersFromRow(release.source_members); } catch { return false; }
  if (canonicalJson(persistedMembers) !== canonicalJson(sourceMembers)) return false;
  const persisted = persistedArtifacts.map((artifact) => ({
    role: String(artifact.role),
    fixedDestination: String(artifact.fixed_destination),
    objectKey: String(artifact.object_key),
    objectDigest: String(artifact.object_digest),
    byteLength: Number(artifact.byte_length),
    mediaType: String(artifact.media_type),
    requiresAuthenticode: Boolean(artifact.requires_authenticode),
  })) as RuntimeArtifactInput[];
  return canonicalJson(canonicalArtifacts(persisted)) === canonicalJson(canonicalArtifacts(artifacts));
}

async function findRuntimeReleaseReplay(
  database: typeof db,
  releaseDigest: string,
  source: Record<string, unknown>,
  artifacts: RuntimeArtifactInput[],
  sourceMembers: RuntimeSourceMembers,
  provenance: RuntimeProvenanceEvidence,
): Promise<{
  created: false;
  runtimeReleaseId: string;
  releaseDigest: string;
  publishedAt: string;
} | undefined> {
  const existing = rowOf(await database.execute(sql`
    SELECT * FROM coordination_v2_runtime_releases
    WHERE release_digest = ${releaseDigest} LIMIT 1
  `));
  if (!existing) return undefined;
  const persistedArtifacts = rowsOf(await database.execute(sql`
    SELECT role, fixed_destination, object_key, object_digest, byte_length,
      media_type, requires_authenticode
    FROM coordination_v2_runtime_release_artifacts
    WHERE runtime_release_id = ${existing.id}
    ORDER BY fixed_destination
  `));
  if (String(existing.manifest_template_digest)
      !== computeCoordinationV2RuntimeManifestTemplateDigest(artifacts, sourceMembers)
    || !persistedReleaseMatches(
      existing,
      persistedArtifacts,
      source,
      artifacts,
      sourceMembers,
      provenance,
    )) {
    fail('V2_RUNTIME_IDEMPOTENCY_CONFLICT');
  }
  return {
    created: false,
    runtimeReleaseId: String(existing.id),
    releaseDigest: String(existing.release_digest),
    publishedAt: iso(existing.published_at),
  };
}

export async function publishCoordinationV2RuntimeRelease(
  input: RuntimeReleaseInput,
  dependencies: RuntimeReleasePublicationDependencies = {},
) {
  let phase: RuntimePublicationPhase = 'request_validation';
  try {
    const sourcePromotionId = text(input.sourcePromotionId, 128);
    if (!Array.isArray(input.sourceMembers)) {
      fail('V2_RUNTIME_INVALID_REQUEST');
    }
    const artifacts = normalizeArtifacts(input.artifacts);
    const sourceMembers = validateCoordinationV2RuntimeSourceMembers(input.sourceMembers);
    const now = input.now ?? new Date();
    const database = dependencies.database ?? db;
    const deriveProvenance = dependencies.deriveProvenance
      ?? deriveCoordinationV2RuntimeProvenance;
    const inspectArtifact = dependencies.inspectArtifact ?? inspectObject;
    const uuid = dependencies.uuid ?? randomUUID;
    phase = 'source_precheck';
    const verifiedSource = rowOf(await database.execute(sql`
    SELECT id, repository_identity, promoted_commit_sha, exact_tree_sha,
      publication_reference, protected_validation_id, canonical_record_digest
    FROM coordination_v2_source_promotions WHERE id = ${sourcePromotionId}
      AND state = 'published' LIMIT 1
    `));
    const verifiedCurrent = await currentSource(database);
    if (!verifiedSource || !sourceMatches(verifiedCurrent, verifiedSource)) {
      fail('V2_RUNTIME_SOURCE_PROMOTION_NOT_CURRENT');
    }
    if (!SHA40.test(String(verifiedSource.promoted_commit_sha))
      || !SHA40.test(String(verifiedSource.exact_tree_sha))
      || !HEX64.test(String(verifiedSource.canonical_record_digest))) {
      fail('V2_RUNTIME_SOURCE_INVALID');
    }
    phase = 'provenance_verification';
    const provenance = await deriveProvenance({
      repositoryIdentity: String(verifiedSource.repository_identity),
      promotedCommitSha: String(verifiedSource.promoted_commit_sha),
      exactTreeSha: String(verifiedSource.exact_tree_sha),
      sourceMembers,
      artifacts,
    });
    phase = 'object_verification';
    for (const artifact of artifacts) {
      const checked = await inspectArtifact(artifact.objectKey);
      if (checked.length !== artifact.byteLength || checked.digest !== artifact.objectDigest) {
        fail('V2_RUNTIME_OBJECT_DIGEST_MISMATCH');
      }
    }

    let releaseDigest: string | undefined;
    try {
      phase = 'append_transaction';
      return await database.transaction(async (tx) => {
      const transactionDb = tx as unknown as typeof db;
      const source = rowOf(await transactionDb.execute(sql`
        SELECT id, repository_identity, promoted_commit_sha, exact_tree_sha,
          publication_reference, protected_validation_id, canonical_record_digest
        FROM coordination_v2_source_promotions WHERE id = ${sourcePromotionId}
          AND state = 'published' LIMIT 1
      `));
      const current = await currentSource(transactionDb);
      if (!source || !sourceMatches(current, source)) {
        fail('V2_RUNTIME_SOURCE_PROMOTION_NOT_CURRENT');
      }
      if (!sourceMatches(source, verifiedSource)) fail('V2_RUNTIME_SOURCE_PROMOTION_CHANGED');
      if (!SHA40.test(String(source.promoted_commit_sha))
        || !SHA40.test(String(source.exact_tree_sha))
        || !HEX64.test(String(source.canonical_record_digest))) {
        fail('V2_RUNTIME_SOURCE_INVALID');
      }
      releaseDigest = computeCoordinationV2RuntimeReleaseDigest({
        sourcePromotionId: String(source.id),
        repositoryIdentity: String(source.repository_identity),
        promotedCommitSha: String(source.promoted_commit_sha),
        exactTreeSha: String(source.exact_tree_sha),
        publicationReference: String(source.publication_reference),
        protectedValidationId: String(source.protected_validation_id),
        sourcePromotionRecordDigest: String(source.canonical_record_digest),
        artifacts,
        sourceMembers,
        provenanceDigest: provenance.provenanceDigest,
      });
      const expectedTemplateDigest = computeCoordinationV2RuntimeManifestTemplateDigest(
        artifacts,
        sourceMembers,
      );
      const replay = await findRuntimeReleaseReplay(
        transactionDb,
        releaseDigest,
        source,
        artifacts,
        sourceMembers,
        provenance,
      );
      if (replay) return replay;
      const releaseId = uuid();
      await transactionDb.execute(sql`
        INSERT INTO coordination_v2_runtime_releases
          (id, protocol_version, source_promotion_id, repository_identity,
           promoted_commit_sha, exact_tree_sha, publication_reference,
           protected_validation_id, source_promotion_record_digest,
           release_digest, manifest_template_digest, node_version,
           node_release_keyring_commit, node_release_keyring_digest,
           node_shasums_digest, node_signature_digest, node_signer_fingerprint,
           lockfile_digest, runtime_closure_digest, provenance_digest,
           source_members, published_at)
        VALUES (${releaseId}, 1, ${source.id}, ${source.repository_identity},
          ${source.promoted_commit_sha}, ${source.exact_tree_sha},
          ${source.publication_reference}, ${source.protected_validation_id},
          ${source.canonical_record_digest}, ${releaseDigest},
          ${expectedTemplateDigest}, ${RUNTIME_NODE_VERSION},
          ${RUNTIME_NODE_RELEASE_COMMIT}, ${provenance.keyringDigest},
          ${provenance.shasumsDigest}, ${provenance.signatureDigest},
          ${provenance.signerFingerprint}, ${provenance.lockfileDigest},
          ${provenance.runtimeClosureDigest}, ${provenance.provenanceDigest},
          ${JSON.stringify(sourceMembers)}::jsonb, ${now})
      `);
      const artifactRows = artifacts.map((artifact) => ({
        id: uuid(),
        runtime_release_id: releaseId,
        role: artifact.role,
        fixed_destination: artifact.fixedDestination,
        object_key: artifact.objectKey,
        object_digest: artifact.objectDigest,
        byte_length: artifact.byteLength,
        media_type: artifact.mediaType,
        requires_authenticode: artifact.requiresAuthenticode,
      }));
      const insertedArtifacts = rowsOf(await transactionDb.execute(sql`
        INSERT INTO coordination_v2_runtime_release_artifacts
          (id, runtime_release_id, role, fixed_destination, object_key,
           object_digest, byte_length, media_type, requires_authenticode)
        SELECT
          artifact.id,
          artifact.runtime_release_id,
          artifact.role,
          artifact.fixed_destination,
          artifact.object_key,
          artifact.object_digest,
          artifact.byte_length,
          artifact.media_type,
          artifact.requires_authenticode
        FROM jsonb_to_recordset(${JSON.stringify(artifactRows)}::jsonb) AS artifact(
          id text,
          runtime_release_id text,
          role text,
          fixed_destination text,
          object_key text,
          object_digest text,
          byte_length bigint,
          media_type text,
          requires_authenticode boolean
        )
        RETURNING id
      `));
      if (insertedArtifacts.length !== artifacts.length) {
        fail('V2_RUNTIME_DATABASE_UNAVAILABLE');
      }
      return {
        created: true,
        runtimeReleaseId: releaseId,
        releaseDigest,
        publishedAt: now.toISOString(),
      };
      });
    } catch (error) {
      if (!releaseDigest || !isReleaseDigestConflict(error)) throw error;
      const conflictingReleaseDigest = releaseDigest;
      phase = 'uniqueness_recovery';
      return database.transaction(async (tx) => {
      const transactionDb = tx as unknown as typeof db;
      const source = rowOf(await transactionDb.execute(sql`
        SELECT id, repository_identity, promoted_commit_sha, exact_tree_sha,
          publication_reference, protected_validation_id, canonical_record_digest
        FROM coordination_v2_source_promotions WHERE id = ${sourcePromotionId}
          AND state = 'published' LIMIT 1
      `));
      const current = await currentSource(transactionDb);
      if (!source || !sourceMatches(current, source)) {
        fail('V2_RUNTIME_SOURCE_PROMOTION_NOT_CURRENT');
      }
      if (!sourceMatches(source, verifiedSource)) fail('V2_RUNTIME_SOURCE_PROMOTION_CHANGED');
      const replay = await findRuntimeReleaseReplay(
        transactionDb,
        conflictingReleaseDigest,
        source,
        artifacts,
        sourceMembers,
        provenance,
      );
      if (!replay) throw error;
      return replay;
      });
    }
  } catch (error) {
    annotateRuntimePublicationFailure(error, phase);
    throw error;
  }
}

async function releaseForIssue(tx: typeof db) {
  const result = await tx.execute(sql`
    SELECT r.*, s.repository_identity AS source_repository_identity,
      s.promoted_commit_sha AS source_promoted_commit_sha,
      s.exact_tree_sha AS source_exact_tree_sha,
      s.publication_reference AS source_publication_reference,
      s.protected_validation_id AS source_protected_validation_id,
      s.canonical_record_digest AS source_record_digest
    FROM coordination_v2_runtime_releases r
    JOIN coordination_v2_source_promotions s ON s.id = r.source_promotion_id
    WHERE s.state = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM coordination_v2_runtime_release_revocations v
        WHERE v.runtime_release_id = r.id
      )
      AND r.source_promotion_id = (
        SELECT id FROM coordination_v2_source_promotions
        WHERE state = 'published' ORDER BY created_at DESC LIMIT 1
      )
    ORDER BY r.published_at DESC LIMIT 1
  `);
  return rowOf(result);
}

async function host(tx: typeof db, hostEnrollmentId: string) {
  return rowOf(await tx.execute(sql`
    SELECT id, public_key, key_fingerprint, status
    FROM coordination_v2_host_enrollments WHERE id = ${hostEnrollmentId} LIMIT 1
  `));
}

async function artifacts(tx: typeof db, runtimeReleaseId: string) {
  return rowsOf(await tx.execute(sql`
    SELECT id, role, fixed_destination, object_digest, byte_length,
      media_type, requires_authenticode, object_key
    FROM coordination_v2_runtime_release_artifacts
    WHERE runtime_release_id = ${runtimeReleaseId}
    ORDER BY id
  `));
}

function manifestFrom(
  issue: Record<string, unknown>,
  release: Record<string, unknown>,
  hostRow: Record<string, unknown>,
  artifactRows: Record<string, unknown>[],
): RuntimeManifest {
  const issued = dateValue(issue.issued_at);
  return {
    protocolVersion: 1,
    kind: 'runtime_bootstrap_manifest',
    issueId: String(issue.id),
    requestKeyDigest: String(issue.request_digest),
    hostEnrollmentId: String(hostRow.id),
    hostKeyFingerprint: String(hostRow.key_fingerprint),
    runtimeReleaseId: String(release.id),
    runtimeReleaseDigest: String(release.release_digest),
    sourcePromotionId: String(release.source_promotion_id),
    repositoryIdentity: String(release.repository_identity),
    promotedCommitSha: String(release.promoted_commit_sha),
    exactTreeSha: String(release.exact_tree_sha),
    publicationReference: String(release.publication_reference),
    protectedValidationId: String(release.protected_validation_id),
    sourcePromotionRecordDigest: String(release.source_promotion_record_digest),
    artifacts: sortCoordinationV2RuntimeManifestArtifacts(artifactRows.map((artifact) => ({
      artifactId: String(artifact.id),
      role: String(artifact.role),
      fixedDestination: String(artifact.fixed_destination),
      objectDigest: String(artifact.object_digest),
      byteLength: Number(artifact.byte_length),
      mediaType: String(artifact.media_type),
      requiresAuthenticode: Boolean(artifact.requires_authenticode),
    }))),
    sourceMembers: sourceMembersFromRow(release.source_members),
    issuedAt: issued.toISOString(),
    expiresAt: dateValue(issue.expires_at).toISOString(),
    nonce: digest({ issueId: issue.id, releaseDigest: release.release_digest, host: hostRow.id }),
  };
}

function signedManifest(payload: RuntimeManifest) {
  const canonical = canonicalJson(payload);
  const signed = signCoordinationV2Envelope(canonical);
  return {
    payload,
    canonicalResponseDigest: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    signature: signed.signature,
    keyFingerprint: signed.keyFingerprint,
  };
}

export async function issueCoordinationV2RuntimeBootstrapManifest(input: {
  hostEnrollmentId: string;
  requestKey: string;
  protocolVersion: number;
  now?: Date;
}) {
  if (!REQUEST_KEY.test(input.requestKey) || input.protocolVersion !== 1) fail('V2_RUNTIME_INVALID_REQUEST');
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const prior = rowOf(await tx.execute(sql`
      SELECT * FROM coordination_v2_runtime_bootstrap_issues
      WHERE host_enrollment_id = ${input.hostEnrollmentId}
        AND request_key = ${input.requestKey} LIMIT 1
    `));
    const hostRow = await host(tx as unknown as typeof db, input.hostEnrollmentId);
    if (!hostRow || hostRow.status !== 'active') fail('V2_HOST_ENROLLMENT_NOT_FOUND');
    if (prior) {
      const release = rowOf(await tx.execute(sql`
        SELECT * FROM coordination_v2_runtime_releases WHERE id = ${prior.runtime_release_id} LIMIT 1
      `));
      if (!release) fail('V2_RUNTIME_DATABASE_UNAVAILABLE');
      const signed = signedManifest(manifestFrom(prior, release, hostRow, await artifacts(tx as unknown as typeof db, String(release.id))));
      if (signed.canonicalResponseDigest !== String(prior.manifest_digest)) fail('V2_RUNTIME_EVIDENCE_INVALID');
      return { created: false, issueId: String(prior.id), expiresAt: iso(prior.expires_at), ...signed };
    }
    const release = await releaseForIssue(tx as unknown as typeof db);
    if (!release) fail('V2_RUNTIME_RELEASE_UNAVAILABLE');
    const publishedAt = dateValue(release.published_at);
    if (publishedAt.getTime() < now.getTime() - RUNTIME_FIRST_INSTALL_MAX_AGE_MS) {
      const priorAcknowledgement = rowOf(await tx.execute(sql`
        SELECT id FROM coordination_v2_runtime_bootstrap_acknowledgements
        WHERE host_enrollment_id = ${input.hostEnrollmentId}
          AND runtime_release_id = ${release.id} LIMIT 1
      `));
      if (!priorAcknowledgement) fail('V2_RUNTIME_RELEASE_TOO_OLD');
    }
    const issueId = randomUUID();
    const issuedAt = now;
    const expiresAt = new Date(now.getTime() + RUNTIME_ISSUE_TTL_MS);
    const issue = {
      id: issueId,
      request_digest: digest(input.requestKey),
      issued_at: issuedAt,
      expires_at: expiresAt,
    };
    const manifest = manifestFrom(issue, release, hostRow, await artifacts(tx as unknown as typeof db, String(release.id)));
    const signed = signedManifest(manifest);
    await tx.execute(sql`
      INSERT INTO coordination_v2_runtime_bootstrap_issues
        (id, host_enrollment_id, runtime_release_id, request_key,
         request_digest, manifest_digest, issued_at, expires_at)
      VALUES (${issueId}, ${input.hostEnrollmentId}, ${release.id},
        ${input.requestKey}, ${issue.request_digest},
        ${signed.canonicalResponseDigest}, ${issuedAt}, ${expiresAt})
    `);
    return { created: true, issueId, expiresAt: expiresAt.toISOString(), ...signed };
  });
}

export async function openCoordinationV2RuntimeArtifact(input: {
  issueId: string;
  artifactId: string;
  hostEnrollmentId: string;
  now?: Date;
}): Promise<{ file: StorageFile; objectDigest: string; byteLength: number; mediaType: string }> {
  const now = input.now ?? new Date();
  const result = await db.execute(sql`
    SELECT i.host_enrollment_id, i.expires_at, a.object_key, a.object_digest,
      a.byte_length, a.media_type
    FROM coordination_v2_runtime_bootstrap_issues i
    JOIN coordination_v2_runtime_release_artifacts a ON a.runtime_release_id = i.runtime_release_id
    WHERE i.id = ${input.issueId} AND a.id = ${input.artifactId}
    LIMIT 1
  `);
  const row = rowOf(result);
  if (!row || String(row.host_enrollment_id) !== input.hostEnrollmentId) fail('V2_RUNTIME_ARTIFACT_DENIED');
  if (dateValue(row.expires_at) <= now) fail('V2_RUNTIME_ISSUE_EXPIRED');
  const checked = await inspectObject(String(row.object_key));
  if (checked.length !== Number(row.byte_length) || checked.digest !== String(row.object_digest)) {
    fail('V2_RUNTIME_OBJECT_DIGEST_MISMATCH');
  }
  return {
    file: checked.file,
    objectDigest: String(row.object_digest),
    byteLength: Number(row.byte_length),
    mediaType: String(row.media_type),
  };
}

export async function streamCoordinationV2RuntimeArtifact(
  input: Parameters<typeof openCoordinationV2RuntimeArtifact>[0],
  res: Response,
): Promise<void> {
  const artifact = await openCoordinationV2RuntimeArtifact(input);
  if (!Number.isSafeInteger(artifact.byteLength) || artifact.byteLength < 1
    || artifact.byteLength > RUNTIME_ARTIFACT_MAX_BYTES) fail('V2_RUNTIME_ARTIFACT_SIZE_INVALID');
  const metadata = await artifact.file.getMetadata();
  if (Number(metadata.size) !== artifact.byteLength) fail('V2_RUNTIME_OBJECT_LENGTH_MISMATCH');
  res.status(200).set({
    'Content-Type': artifact.mediaType,
    'Content-Length': String(artifact.byteLength),
    Digest: `sha-256=${artifact.objectDigest}`,
    'Cache-Control': 'private, no-store',
  });
  const stream = artifact.file.createReadStream();
  let streamed = 0;
  stream.on('data', (chunk: Buffer | Uint8Array) => {
    streamed += chunk.byteLength;
    if (streamed > artifact.byteLength || streamed > RUNTIME_ARTIFACT_MAX_BYTES) {
      (stream as NodeJS.ReadableStream & { destroy(error?: Error): void })
        .destroy(new Error('runtime_artifact_size_limit'));
    }
  });
  stream.on('end', () => {
    if (streamed !== artifact.byteLength && !res.headersSent) res.destroy();
  });
  stream.on('error', () => {
    if (!res.headersSent) res.status(502).end();
  });
  stream.pipe(res);
}

export type RuntimeAcknowledgementPayload = {
  protocolVersion: 1;
  issueId: string;
  requestKey: string;
  runtimeReleaseId: string;
  manifestDigest: string;
  localEvidenceDigest: string;
};

export async function acknowledgeCoordinationV2RuntimeBootstrap(input: {
  hostEnrollmentId: string;
  issueId: string;
  payload: RuntimeAcknowledgementPayload;
  signature: string;
  now?: Date;
}) {
  const payload = input.payload;
  if (!exactKeys(payload as unknown as Record<string, unknown>, [
    'protocolVersion', 'issueId', 'requestKey', 'runtimeReleaseId',
    'manifestDigest', 'localEvidenceDigest',
  ]) || payload.protocolVersion !== 1 || payload.issueId !== input.issueId
    || !REQUEST_KEY.test(payload.requestKey) || !HEX64.test(payload.manifestDigest)
    || !HEX64.test(payload.localEvidenceDigest) || !text(input.signature, 8192)) {
    fail('V2_RUNTIME_ACK_INVALID');
  }
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const issue = rowOf(await tx.execute(sql`
      SELECT * FROM coordination_v2_runtime_bootstrap_issues
      WHERE id = ${input.issueId} AND host_enrollment_id = ${input.hostEnrollmentId}
      LIMIT 1
    `));
    if (!issue) fail('V2_RUNTIME_ISSUE_NOT_FOUND');
    if (String(issue.request_key) !== payload.requestKey || String(issue.manifest_digest) !== payload.manifestDigest) {
      fail('V2_RUNTIME_ACK_LINEAGE_INVALID');
    }
    const release = rowOf(await tx.execute(sql`
      SELECT * FROM coordination_v2_runtime_releases WHERE id = ${issue.runtime_release_id} LIMIT 1
    `));
    if (!release) fail('V2_RUNTIME_DATABASE_UNAVAILABLE');
    if (payload.runtimeReleaseId !== String(release.id)) fail('V2_RUNTIME_ACK_LINEAGE_INVALID');
    const hostRow = await host(tx as unknown as typeof db, input.hostEnrollmentId);
    if (!hostRow || hostRow.status !== 'active') fail('V2_HOST_ENROLLMENT_NOT_FOUND');
    let publicKey;
    try { publicKey = createPublicKey({ key: JSON.parse(String(hostRow.public_key)), format: 'jwk' }); }
    catch { fail('V2_RUNTIME_HOST_KEY_INVALID'); }
    const canonical = canonicalJson(payload);
    let valid = false;
    try { valid = verifySignature('RSA-SHA256', Buffer.from(canonical), publicKey, Buffer.from(input.signature, 'base64')); }
    catch { valid = false; }
    if (!valid) fail('V2_RUNTIME_ACK_SIGNATURE_INVALID');
    const acknowledgementDigest = digest(payload);
    const signatureDigest = createHash('sha256').update(input.signature, 'utf8').digest('hex');
    const prior = rowOf(await tx.execute(sql`
      SELECT * FROM coordination_v2_runtime_bootstrap_acknowledgements
      WHERE host_enrollment_id = ${input.hostEnrollmentId}
        AND request_key = ${payload.requestKey} LIMIT 1
    `));
    if (prior) {
      if (String(prior.runtime_release_id) !== String(release.id)
        || String(prior.issue_id) !== String(issue.id)
        || String(prior.manifest_digest) !== payload.manifestDigest
        || String(prior.local_evidence_digest) !== payload.localEvidenceDigest
        || String(prior.acknowledgement_digest) !== acknowledgementDigest
        || String(prior.host_signature_digest) !== signatureDigest) {
        fail('V2_RUNTIME_IDEMPOTENCY_CONFLICT');
      }
      return { created: false, acknowledgementId: String(prior.id), acknowledgedAt: iso(prior.acknowledged_at), acknowledgementDigest };
    }
    if (dateValue(issue.expires_at) <= now) fail('V2_RUNTIME_ISSUE_EXPIRED');
    const revoked = rowOf(await tx.execute(sql`
      SELECT id FROM coordination_v2_runtime_release_revocations
      WHERE runtime_release_id = ${release.id} LIMIT 1
    `));
    if (revoked) fail('V2_RUNTIME_RELEASE_REVOKED');
    const current = await currentSource(tx as unknown as typeof db);
    const source = rowOf(await tx.execute(sql`
      SELECT id, repository_identity, promoted_commit_sha, exact_tree_sha,
        publication_reference, protected_validation_id, canonical_record_digest
      FROM coordination_v2_source_promotions WHERE id = ${release.source_promotion_id} LIMIT 1
    `));
    if (!source || !sourceMatches(current, source)) fail('V2_RUNTIME_SOURCE_PROMOTION_NOT_CURRENT');
    const priorReleaseAcknowledgement = rowOf(await tx.execute(sql`
      SELECT id FROM coordination_v2_runtime_bootstrap_acknowledgements
      WHERE host_enrollment_id = ${input.hostEnrollmentId}
        AND runtime_release_id = ${release.id} LIMIT 1
    `));
    if (priorReleaseAcknowledgement) fail('V2_RUNTIME_IDEMPOTENCY_CONFLICT');
    const acknowledgementId = randomUUID();
    await tx.execute(sql`
      INSERT INTO coordination_v2_runtime_bootstrap_acknowledgements
        (id, host_enrollment_id, runtime_release_id, issue_id, request_key,
         manifest_digest, local_evidence_digest, acknowledgement_digest,
         host_signature_digest, acknowledged_at)
      VALUES (${acknowledgementId}, ${input.hostEnrollmentId}, ${release.id},
        ${issue.id}, ${payload.requestKey}, ${payload.manifestDigest},
        ${payload.localEvidenceDigest}, ${acknowledgementDigest},
        ${signatureDigest}, ${now})
    `);
    return { created: true, acknowledgementId, acknowledgedAt: now.toISOString(), acknowledgementDigest };
  });
}

export async function getCoordinationV2RuntimeStatus(input: { hostEnrollmentId: string; now?: Date }) {
  const result = await db.execute(sql`
    SELECT a.runtime_release_id, r.release_digest, r.promoted_commit_sha,
      r.exact_tree_sha, EXISTS (
        SELECT 1 FROM coordination_v2_runtime_release_revocations v
        WHERE v.runtime_release_id = a.runtime_release_id
      ) AS revoked,
      EXISTS (
        SELECT 1 FROM coordination_v2_source_promotions s2
        WHERE s2.id = r.source_promotion_id AND s2.state = 'published'
          AND s2.id = (SELECT id FROM coordination_v2_source_promotions
            WHERE state = 'published' ORDER BY created_at DESC LIMIT 1)
      ) AS source_current
    FROM coordination_v2_runtime_bootstrap_acknowledgements a
    JOIN coordination_v2_runtime_releases r ON r.id = a.runtime_release_id
    WHERE a.host_enrollment_id = ${input.hostEnrollmentId}
    ORDER BY a.acknowledged_at DESC LIMIT 1
  `);
  const row = rowOf(result);
  if (!row) return { acknowledged: false, executionPreflightMayProceed: false };
  const revoked = Boolean(row.revoked);
  const sourceCurrent = Boolean(row.source_current);
  return {
    acknowledged: true,
    runtimeReleaseId: String(row.runtime_release_id),
    runtimeReleaseDigest: String(row.release_digest),
    sourceCommitSha: String(row.promoted_commit_sha),
    exactTreeSha: String(row.exact_tree_sha),
    revoked,
    sourceCurrent,
    executionPreflightMayProceed: !revoked && sourceCurrent,
  };
}

export async function revokeCoordinationV2RuntimeRelease(input: {
  runtimeReleaseId: string;
  requestKey: string;
  reasonCode: string;
  revokedBy: string;
  now?: Date;
}) {
  if (!REQUEST_KEY.test(input.requestKey) || !/^[A-Z0-9_]{1,128}$/.test(input.reasonCode)
    || !text(input.revokedBy, 128)) fail('V2_RUNTIME_INVALID_REQUEST');
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const release = rowOf(await tx.execute(sql`
      SELECT id FROM coordination_v2_runtime_releases WHERE id = ${input.runtimeReleaseId} LIMIT 1
    `));
    if (!release) fail('V2_RUNTIME_RELEASE_NOT_FOUND');
    const prior = rowOf(await tx.execute(sql`
      SELECT id, runtime_release_id, reason_code, revoked_by, revoked_at
      FROM coordination_v2_runtime_release_revocations
      WHERE runtime_release_id = ${input.runtimeReleaseId}
         OR request_key = ${input.requestKey} LIMIT 1
    `));
    if (prior) {
      if (String(prior.runtime_release_id) !== input.runtimeReleaseId
        || String(prior.reason_code) !== input.reasonCode || String(prior.revoked_by) !== input.revokedBy) {
        fail('V2_RUNTIME_IDEMPOTENCY_CONFLICT');
      }
      return { created: false, revoked: true, revokedAt: iso(prior.revoked_at) };
    }
    const canonicalRecordDigest = digest({
      runtimeReleaseId: input.runtimeReleaseId,
      requestKey: input.requestKey,
      reasonCode: input.reasonCode,
      revokedBy: input.revokedBy,
      revokedAt: now.toISOString(),
    });
    await tx.execute(sql`
      INSERT INTO coordination_v2_runtime_release_revocations
        (id, runtime_release_id, request_key, reason_code, revoked_by,
         revoked_at, canonical_record_digest)
      VALUES (${randomUUID()}, ${input.runtimeReleaseId}, ${input.requestKey},
        ${input.reasonCode}, ${input.revokedBy}, ${now}, ${canonicalRecordDigest})
    `);
    return { created: true, revoked: true, revokedAt: now.toISOString(), canonicalRecordDigest };
  });
}
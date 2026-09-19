import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import { coordinationV2PolicyVersions, coordinationV2SourcePromotions } from '@shared/schema';
import { db } from '../db';
import { canonicalJson, canonicalizePolicy } from './coordination-policy-canonicalization';
import { issueCoordinationV2PreflightEnvelope } from './coordination-v2-preflight-envelope';
import {
  resolveCoordinationTaskMetadataWithArtifact,
  DEFAULT_COORDINATION_TASK_METADATA_REGISTRY,
  type CoordinationTaskMetadataRegistry,
} from './coordination-task-metadata-service';
import { SourceControlService } from './source-control-service';
import { normalizeCoordinationRepositoryIdentity } from './coordination-repository-identity';

const exec = promisify(execFile);
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function publicDigest(artifacts: Record<string, Uint8Array>): string {
  const hash = createHash('sha256');
  for (const name of Object.keys(artifacts).sort()) {
    hash.update(name, 'utf8'); hash.update('\0', 'utf8'); hash.update(artifacts[name]); hash.update('\0', 'utf8');
  }
  return hash.digest('hex');
}
const MAX_ARTIFACT_BYTES = 256 * 1024;
const MAX_CONFIG_BYTES = 64 * 1024;
const CHILD_ROLES = ['coordinator-cli', 'gate3-executor'] as const;
const OPERATION_KINDS = ['poll', 'claim', 'result', 'cleanup'] as const;

/**
 * `hostConstraints.windowsPublicMaterialDigest` is the one policy field the
 * emitted config cannot carry: it is defined as the digest OF the task
 * artifact plus this config, so embedding its real value would make the
 * config's own hash a function of itself -- a SHA-256 preimage nobody could
 * ever satisfy. Strip it from the policy view that gets embedded/hashed here
 * so the config is well-defined; the real value is still fully enforced, just
 * as a separate pinned comparison at the reserve/prepare call sites (see
 * `coordination-lifecycle-facade-service.ts` and
 * `coordination-windows-generation.ts`), never as an input to the hash it is
 * compared against. The `policyDigest` returned by this function (identifying
 * *which* approved policy version this is) is unaffected -- it is still the
 * hash of the complete, real policy, matching what is stored at authoring
 * time in `coordinationV2PolicyVersions`.
 */
function withoutSelfReferentialDigest(canonicalPolicy: Record<string, unknown>): Record<string, unknown> {
  const constraints = canonicalPolicy.hostConstraints;
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)
    || !('windowsPublicMaterialDigest' in (constraints as Record<string, unknown>))) {
    return canonicalPolicy;
  }
  const { windowsPublicMaterialDigest: _omit, ...operationalConstraints } = constraints as Record<string, unknown>;
  return { ...canonicalPolicy, hostConstraints: operationalConstraints };
}

export function buildCoordinationV2PublicConfig(input: {
  repositoryIdentity: string; promotedCommitSha: string; exactTreeSha: string;
  policy: Record<string, unknown>;
}): { config: string; canonicalPolicy: Record<string, unknown>; policyDigest: string } {
  const canonicalPolicy = canonicalizePolicy(input.policy) as Record<string, unknown>;
  const canonicalPolicyBytes = canonicalJson(canonicalPolicy);
  const operationalPolicy = withoutSelfReferentialDigest(canonicalPolicy);
  const operationalPolicyBytes = canonicalJson(operationalPolicy);
  return {
    canonicalPolicy,
    policyDigest: sha(canonicalPolicyBytes),
    config: canonicalJson({
      protocolVersion: 1, childRoles: CHILD_ROLES, operationKinds: OPERATION_KINDS,
      repositoryIdentity: input.repositoryIdentity, promotedCommitSha: input.promotedCommitSha,
      exactTreeSha: input.exactTreeSha, policy: operationalPolicy, policyDigest: sha(operationalPolicyBytes),
    }),
  };
}

export async function resolveCoordinationV2ProtectedRemoteCommit(
  sha: string,
  repositoryIdentity: string,
): Promise<{ sha: string; treeSha: string; parentSha?: string }> {
  const configuredUrl = process.env.GITHUB_REPO_URL;
  if (!configuredUrl) throw new Error('V2_PREPARATION_REPOSITORY_DRIFT');
  let configuredIdentity: string;
  try {
    configuredIdentity = normalizeCoordinationRepositoryIdentity(configuredUrl);
    if (process.env.COORDINATION_V2_REPOSITORY_IDENTITY
      && normalizeCoordinationRepositoryIdentity(process.env.COORDINATION_V2_REPOSITORY_IDENTITY) !== configuredIdentity) {
      throw new Error('pin_mismatch');
    }
    if (configuredIdentity !== normalizeCoordinationRepositoryIdentity(repositoryIdentity)) throw new Error('promotion_mismatch');
  } catch {
    throw new Error('V2_PREPARATION_REPOSITORY_DRIFT');
  }
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'coordination-v2-proof-'));
  try {
    await exec('git', ['init', '--bare', temporaryRoot]);
    await exec('git', ['-C', temporaryRoot, 'remote', 'add', 'origin', configuredUrl]);
    const service = new SourceControlService({
      rootDir: temporaryRoot,
      env: process.env,
    });
    await service.verifyConfiguredRepositoryIdentity();
    return await service.resolveProtectedRemoteCommitProof(sha);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function issueCoordinationV2PreparationEnvelope(input: {
  taskRef: string;
  hostEnrollmentId: string;
  preparationGeneration: string;
  reservationId: string;
  publicMaterialDigest: string;
  policyVersionId: string;
  repositoryRoot?: string;
  taskMetadataRegistry?: CoordinationTaskMetadataRegistry;
  nonce?: string;
  /** Hermetic proof seam; production uses SourceControlService's protected fetch. */
  resolveRemoteCommit?: (sha: string, repositoryIdentity: string) => Promise<{ sha: string; treeSha: string; parentSha?: string }>;
}) {
  const { metadata, artifact } = await resolveCoordinationTaskMetadataWithArtifact(
    input.taskRef, input.taskMetadataRegistry || DEFAULT_COORDINATION_TASK_METADATA_REGISTRY,
  );
  if (artifact.length > MAX_ARTIFACT_BYTES || sha(artifact) !== metadata.taskArtifactSha256) throw new Error('V2_PREPARATION_TASK_ARTIFACT_INVALID');
  const promotion = (await db.select().from(coordinationV2SourcePromotions)
    .where(and(eq(coordinationV2SourcePromotions.state, 'published'), eq(coordinationV2SourcePromotions.repositoryIdentity, metadata.repositoryIdentity)))
    .orderBy(desc(coordinationV2SourcePromotions.createdAt)).limit(1))[0];
  if (!promotion) throw new Error('V2_PREPARATION_PROMOTION_UNAVAILABLE');
  const resolveRemoteCommit = input.resolveRemoteCommit ?? resolveCoordinationV2ProtectedRemoteCommit;
  const proof = await resolveRemoteCommit(promotion.promotedCommitSha, promotion.repositoryIdentity);
  if (proof.sha !== promotion.promotedCommitSha) throw new Error('V2_PREPARATION_GITHUB_COMMIT_DRIFT');
  if (proof.treeSha !== promotion.exactTreeSha) throw new Error('V2_PREPARATION_TREE_DRIFT');
  if (promotion.parentSha && proof.parentSha !== promotion.parentSha) throw new Error('V2_PREPARATION_PARENT_DRIFT');
  const policyRow = (await db.select({
    policy: coordinationV2PolicyVersions.canonicalPolicy,
    policyDigest: coordinationV2PolicyVersions.policyDigest,
  }).from(coordinationV2PolicyVersions)
    .where(eq(coordinationV2PolicyVersions.id, input.policyVersionId)).limit(1))[0];
  if (!policyRow) throw new Error('V2_PREPARATION_POLICY_UNAVAILABLE');
  const materialConfig = buildCoordinationV2PublicConfig({
    repositoryIdentity: metadata.repositoryIdentity,
    promotedCommitSha: promotion.promotedCommitSha,
    exactTreeSha: promotion.exactTreeSha,
    policy: policyRow.policy as Record<string, unknown>,
  });
  if (policyRow.policyDigest !== materialConfig.policyDigest) throw new Error('V2_PREPARATION_POLICY_DIGEST_MISMATCH');
  const config = materialConfig.config;
  if (Buffer.byteLength(config) > MAX_CONFIG_BYTES) throw new Error('V2_PREPARATION_CONFIG_TOO_LARGE');
  const publicMaterialDigest = publicDigest({
    'task-artifact': artifact,
    'coordinator-config.json': Buffer.from(config, 'utf8'),
  });
  if (publicMaterialDigest !== input.publicMaterialDigest) throw new Error('V2_PREPARATION_PUBLIC_DIGEST_MISMATCH');
  return issueCoordinationV2PreflightEnvelope({
    hostEnrollmentId: input.hostEnrollmentId, repositoryIdentity: metadata.repositoryIdentity,
    taskRef: metadata.taskRef, taskArtifactSha: metadata.taskArtifactSha256,
    preparationGeneration: input.preparationGeneration, reservationId: input.reservationId,
    publicMaterialDigest,
    material: { taskArtifact: Buffer.from(artifact).toString('utf8'), publicCoordinatorConfig: config },
    nonce: input.nonce,
    findPromotion: async () => promotion,
  });
}

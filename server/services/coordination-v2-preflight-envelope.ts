import { createHash, randomBytes } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { coordinationV2SourcePromotions } from '@shared/schema';
import { db } from '../db';
import { canonicalJson } from './coordination-policy-canonicalization';
import { signCoordinationV2Envelope } from './coordination-v2-signing';

const PROTOCOL = 1;
const MAX_TASK_BYTES = 256 * 1024;
const MAX_PUBLIC_CONFIG_BYTES = 64 * 1024;

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export type CoordinationV2PreflightMaterial = {
  taskArtifact: string;
  publicCoordinatorConfig?: string;
};

export type CoordinationV2PreflightInput = {
  hostEnrollmentId: string;
  repositoryIdentity: string;
  taskRef: string;
  taskArtifactSha: string;
  preparationGeneration: string;
  reservationId: string;
  publicMaterialDigest: string;
  material: CoordinationV2PreflightMaterial;
  nonce?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  findPromotion?: () => Promise<typeof coordinationV2SourcePromotions.$inferSelect | undefined>;
  signEnvelope?: (payload: string) => { signature: string; keyFingerprint: string };
};

export async function issueCoordinationV2PreflightEnvelope(input: CoordinationV2PreflightInput) {
  const taskBytes = Buffer.from(input.material.taskArtifact, 'utf8');
  const configBytes = Buffer.from(input.material.publicCoordinatorConfig || '', 'utf8');
  if (taskBytes.length > MAX_TASK_BYTES || configBytes.length > MAX_PUBLIC_CONFIG_BYTES) throw new Error('V2_PREFLIGHT_MATERIAL_TOO_LARGE');
  if (digest(input.material.taskArtifact) !== input.taskArtifactSha) throw new Error('V2_PREFLIGHT_TASK_DIGEST_MISMATCH');
  const findPromotion = input.findPromotion || (async () => (await db.select().from(coordinationV2SourcePromotions)
    .where(eq(coordinationV2SourcePromotions.state, 'published')).orderBy(desc(coordinationV2SourcePromotions.createdAt)).limit(1))[0]);
  const promotion = await findPromotion();
  if (!promotion || promotion.repositoryIdentity !== input.repositoryIdentity) throw new Error('V2_PREFLIGHT_PROMOTION_UNAVAILABLE');
  const issuedAt = input.issuedAt || new Date();
  const expiresAt = input.expiresAt || new Date(issuedAt.getTime() + 2 * 60_000);
  if (expiresAt <= issuedAt || expiresAt.getTime() - issuedAt.getTime() > 2 * 60_000) throw new Error('V2_PREFLIGHT_EXPIRY_INVALID');
  const nonce = input.nonce || randomBytes(32).toString('base64url');
  const payload = {
    protocol: PROTOCOL, hostEnrollmentId: input.hostEnrollmentId, repositoryIdentity: input.repositoryIdentity,
    promotedCommitSha: promotion.promotedCommitSha, exactTreeSha: promotion.exactTreeSha,
    publicationReference: promotion.publicationReference, protectedValidationId: promotion.protectedValidationId,
    taskRef: input.taskRef, taskArtifactSha: input.taskArtifactSha,
    preparationGeneration: input.preparationGeneration, reservationId: input.reservationId,
    publicMaterialDigest: input.publicMaterialDigest, taskArtifact: taskBytes.toString('base64'),
    publicCoordinatorConfig: configBytes.toString('base64'), issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(), nonce, secretPlaintext: undefined,
  };
  const canonicalPayload = canonicalJson(payload);
  const signed = (input.signEnvelope || ((value) => signCoordinationV2Envelope(value)))(canonicalPayload);
  return {
    payload, canonicalResponseDigest: digest(canonicalPayload),
    signature: signed.signature, keyFingerprint: signed.keyFingerprint,
  };
}

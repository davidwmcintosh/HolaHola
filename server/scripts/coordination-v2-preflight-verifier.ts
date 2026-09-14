import { createHash } from 'node:crypto';
import { canonicalJson } from '../services/coordination-policy-canonicalization';
import { loadPinnedServerSigningPublicKey, verifyCoordinationV2Envelope } from '../services/coordination-v2-signing';

const seenNonces = new Map<string, number>();
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

export async function verifyCoordinationV2PreflightEnvelope(input: {
  payload: Record<string, unknown>;
  signature: string;
  keyFingerprint: string;
  expectedHostEnrollmentId: string;
  expectedRepositoryIdentity: string;
  expectedTaskArtifactSha: string;
  expectedPublicMaterialDigest: string;
  now?: Date;
  pinnedPublicKeyPath?: string;
  verifyCheckout?: (commit: string, tree: string, repository: string) => Promise<boolean>;
}) {
  const key = await loadPinnedServerSigningPublicKey(input.pinnedPublicKeyPath);
  const canonical = canonicalJson(input.payload);
  if (!verifyCoordinationV2Envelope(canonical, input.signature, key.key, input.keyFingerprint)) throw new Error('V2_PREFLIGHT_SIGNATURE_INVALID');
  const now = (input.now || new Date()).getTime();
  const issued = Date.parse(String(input.payload.issuedAt));
  const expires = Date.parse(String(input.payload.expiresAt));
  const nonce = String(input.payload.nonce || '');
  if (!nonce || !Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now) throw new Error('V2_PREFLIGHT_EXPIRED_OR_NOT_YET_VALID');
  if (seenNonces.has(nonce)) throw new Error('V2_PREFLIGHT_NONCE_REPLAY');
  if (input.payload.hostEnrollmentId !== input.expectedHostEnrollmentId || input.payload.repositoryIdentity !== input.expectedRepositoryIdentity) throw new Error('V2_PREFLIGHT_BINDING_INVALID');
  if (input.payload.taskArtifactSha !== input.expectedTaskArtifactSha || input.payload.publicMaterialDigest !== input.expectedPublicMaterialDigest) throw new Error('V2_PREFLIGHT_MATERIAL_BINDING_INVALID');
  if (input.payload.secretPlaintext !== undefined && input.payload.secretPlaintext !== null && input.payload.secretPlaintext !== '') throw new Error('V2_PREFLIGHT_SECRET_MATERIAL_FORBIDDEN');
  const task = Buffer.from(String(input.payload.taskArtifact || ''), 'base64');
  if (digest(task.toString('utf8')) !== input.expectedTaskArtifactSha) throw new Error('V2_PREFLIGHT_TASK_BYTES_MISMATCH');
  if (input.verifyCheckout && !(await input.verifyCheckout(String(input.payload.promotedCommitSha), String(input.payload.exactTreeSha), String(input.payload.repositoryIdentity)))) throw new Error('V2_PREFLIGHT_CHECKOUT_MISMATCH');
  seenNonces.set(nonce, expires);
  for (const [value, expiry] of seenNonces) if (expiry <= now) seenNonces.delete(value);
  return { ...input.payload, canonicalResponseDigest: digest(canonical) };
}

import { createHash, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  coordinationV2HostCredentials,
  coordinationV2HostEnrollmentRequests,
  coordinationV2HostEnrollments,
  coordinationV2HostProofChallenges,
  coordinationV2HostReauthorizationRequests,
  coordinationV2HostReauthorizationChallenges,
  coordinationV2SourcePromotions,
  coordinationV2SessionCredentials,
  coordinationV2Sessions,
  coordinationV2Attempts,
  coordinationV2TransportLeases,
  coordinationV2TransportWorkClaims,
  type CoordinationV2HostEnrollment,
} from '@shared/schema';
import { db } from '../db';
import { canonicalJson } from './coordination-policy-canonicalization';
import { HOST_PROTOCOL_VERSION } from './coordination-host-protocol';
import { validateHostEnrollmentDeclaration } from './coordination-host-enrollment-service';

const REQUEST_TTL_MS = 15 * 60_000;
const REAUTH_REQUEST_TTL_MS = 60 * 60_000;
const CHALLENGE_TTL_MS = 2 * 60_000;
const HOST_CREDENTIAL_TTL_MS = 24 * 60 * 60_000;
const SESSION_CREDENTIAL_TTL_MS = 15 * 60_000;
const HEX = /^[0-9a-f]{64}$/;
const INITIAL_BOOTSTRAP_SECRET = /^[A-Za-z0-9_-]{43}$/;
const INITIAL_BOOTSTRAP_LOCK = 'coordination-v2:first-host-bootstrap';

export type CoordinationV2HostCapability = 'host:transport' | 'host:cleanup';
export type HostAuthContext = {
  credentialId: string;
  hostEnrollmentId: string;
  capability: CoordinationV2HostCapability;
  protocolVersion: number;
  sessionId: string | null;
  holderInstanceId: string | null;
  lineageDigest: string;
  attemptId?: string;
  leaseId?: string;
  leaseEpoch?: number;
};
export type V2HostAuthErrorCode =
  | 'V2_HOST_FOUNDER_REQUIRED' | 'V2_HOST_INVALID_REQUEST'
  | 'V2_HOST_ENROLLMENT_NOT_FOUND' | 'V2_HOST_ENROLLMENT_REVOKED'
  | 'V2_HOST_REQUEST_NOT_FOUND' | 'V2_HOST_REQUEST_EXPIRED'
  | 'V2_HOST_REQUEST_TERMINAL' | 'V2_HOST_CHALLENGE_INVALID'
  | 'V2_HOST_CHALLENGE_EXPIRED' | 'V2_HOST_PROOF_INVALID'
  | 'V2_HOST_CREDENTIAL_INVALID' | 'V2_HOST_CREDENTIAL_EXPIRED'
  | 'V2_HOST_CREDENTIAL_REVOKED' | 'V2_HOST_CREDENTIAL_SCOPE_DENIED'
  | 'V2_HOST_PROTOCOL_MISMATCH' | 'V2_HOST_IDEMPOTENCY_CONFLICT'
  | 'V2_HOST_BOOTSTRAP_REQUIRED' | 'V2_HOST_BOOTSTRAP_DENIED'
  | 'V2_HOST_BOOTSTRAP_UNAVAILABLE' | 'V2_HOST_BOOTSTRAP_CONSUMED'
  | 'V2_HOST_SOURCE_PROMOTION_REQUIRED'
  | 'V2_HOST_REAUTH_INVALID' | 'V2_HOST_REAUTH_DECLARATION_INVALID'
  | 'V2_HOST_REAUTH_PUBLIC_KEY_INVALID' | 'V2_HOST_REAUTH_SIGNATURE_INVALID'
  | 'V2_HOST_REAUTH_REPLAYED'
  | 'V2_HOST_REAUTH_NOT_APPROVED' | 'V2_HOST_REAUTH_ENROLLMENT_MISMATCH'
  | 'V2_HOST_DATABASE_UNAVAILABLE';

export class CoordinationV2HostAuthError extends Error {
  readonly code: V2HostAuthErrorCode;
  constructor(code: V2HostAuthErrorCode) {
    super(code); this.name = 'CoordinationV2HostAuthError'; this.code = code;
  }
}
function fail(code: V2HostAuthErrorCode): never { throw new CoordinationV2HostAuthError(code); }
function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function digest(value: unknown): string { return hash(canonicalJson(value)); }
function randomToken(prefix: 'v2h' | 'v2s'): string { return `${prefix}_${randomBytes(32).toString('base64url')}`; }
function bounded(value: unknown, max = 128): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}
function founder(input: { founderActor: string; founderRole: string }): void {
  if (!bounded(input.founderActor) || input.founderRole !== 'founder') fail('V2_HOST_FOUNDER_REQUIRED');
}
function safeEnrollment(row: CoordinationV2HostEnrollment) {
  return { id: row.id, hostKey: row.hostKey, hostType: row.hostType, displayName: row.displayName,
    protocolVersion: row.protocolVersion, keyFingerprint: row.keyFingerprint, capabilities: row.capabilities,
    enrollmentDigest: row.enrollmentDigest, status: row.status, revokedAt: row.revokedAt?.toISOString() ?? null };
}
function safeHostCredential(row: typeof coordinationV2HostCredentials.$inferSelect): HostAuthContext & { expiresAt: string } {
  return { credentialId: row.id, hostEnrollmentId: row.hostEnrollmentId,
    capability: row.capability as CoordinationV2HostCapability, protocolVersion: row.protocolVersion,
    sessionId: null, holderInstanceId: row.holderInstanceId, lineageDigest: row.lineageDigest,
    expiresAt: row.expiresAt.toISOString() };
}
function publicKey(value: string): ReturnType<typeof createPublicKey> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.kty !== 'RSA') fail('V2_HOST_INVALID_REQUEST');
    return createPublicKey({ key: parsed, format: 'jwk' });
  } catch { fail('V2_HOST_INVALID_REQUEST'); }
}
function publicKeyFingerprint(value: string): string {
  try { return hash(canonicalJson(JSON.parse(value))); }
  catch { fail('V2_HOST_INVALID_REQUEST'); }
}
function verifyProof(key: string, nonce: string, signature: string): boolean {
  try { return verify('RSA-SHA256', Buffer.from(nonce), publicKey(key), Buffer.from(signature, 'base64')); }
  catch { return false; }
}
function verifyCanonical(key: string, value: unknown, signature: string): boolean {
  try { return verify('RSA-SHA256', Buffer.from(canonicalJson(value)), publicKey(key), Buffer.from(signature, 'base64')); }
  catch { return false; }
}
function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value as object).sort().join('\0') === [...keys].sort().join('\0');
}
const REAUTH_DECLARATION_KEYS = ['kind', 'requestKey', 'issuedAt', 'expiresAt', 'protocolVersion',
  'hostId', 'keyFingerprint', 'requestGeneration'] as const;
const REAUTH_CHALLENGE_KEYS = ['kind', 'requestId', 'requestKey', 'challengeId', 'nonce',
  'hostEnrollmentId', 'keyFingerprint', 'protocolVersion', 'requestGeneration', 'issuedAt', 'expiresAt'] as const;

function reauthDeclaration(value: unknown, now: Date) {
  if (!exactObject(value, REAUTH_DECLARATION_KEYS)) fail('V2_HOST_REAUTH_DECLARATION_INVALID');
  const v = value as Record<string, unknown>;
  if (v.kind !== 'host_credential_reauthorization' || v.protocolVersion !== HOST_PROTOCOL_VERSION
    || !bounded(v.requestKey) || !bounded(v.hostId)
    || !HEX.test(String(v.keyFingerprint)) || !Number.isInteger(v.requestGeneration) || (v.requestGeneration as number) < 1
    || typeof v.issuedAt !== 'string' || typeof v.expiresAt !== 'string')
    fail('V2_HOST_REAUTH_DECLARATION_INVALID');
  const issued = new Date(v.issuedAt), expiry = new Date(v.expiresAt);
  if (Number.isNaN(issued.valueOf()) || Number.isNaN(expiry.valueOf())
    || issued > now || expiry <= issued || expiry.getTime() - issued.getTime() > REAUTH_REQUEST_TTL_MS
    || Math.abs(now.getTime() - issued.getTime()) > REAUTH_REQUEST_TTL_MS)
    fail('V2_HOST_REAUTH_DECLARATION_INVALID');
  return { value: v, issued, expiry, declarationDigest: digest(value) };
}

export function validateCoordinationV2HostReauthorizationSubmission(input: {
  declaration: unknown; signature: string; publicKey: string; keyFingerprint: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!bounded(input.signature, 8192)) fail('V2_HOST_REAUTH_SIGNATURE_INVALID');
  if (!bounded(input.publicKey, 8192) || !HEX.test(input.keyFingerprint))
    fail('V2_HOST_REAUTH_PUBLIC_KEY_INVALID');
  const declaration = reauthDeclaration(input.declaration, now);
  if (declaration.value.keyFingerprint !== input.keyFingerprint || declaration.value.requestKey === '')
    fail('V2_HOST_REAUTH_PUBLIC_KEY_INVALID');
  try {
    publicKey(input.publicKey);
    if (publicKeyFingerprint(input.publicKey) !== input.keyFingerprint)
      fail('V2_HOST_REAUTH_PUBLIC_KEY_INVALID');
  } catch {
    fail('V2_HOST_REAUTH_PUBLIC_KEY_INVALID');
  }
  if (!verifyCanonical(input.publicKey, declaration.value, input.signature))
    fail('V2_HOST_REAUTH_SIGNATURE_INVALID');
  return declaration;
}

export async function submitCoordinationV2HostReauthorizationRequest(input: {
  declaration: unknown; signature: string; publicKey: string; keyFingerprint: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  const declaration = validateCoordinationV2HostReauthorizationSubmission({ ...input, now });
  try {
    const result = await db.transaction(async (tx) => {
      const hosts = await tx.select().from(coordinationV2HostEnrollments)
        .where(and(eq(coordinationV2HostEnrollments.hostKey, String(declaration.value.hostId)),
          eq(coordinationV2HostEnrollments.keyFingerprint, input.keyFingerprint))).for('update');
      const host = hosts[0];
      if (!host) fail('V2_HOST_ENROLLMENT_NOT_FOUND');
      if (host.status !== 'active') fail('V2_HOST_ENROLLMENT_REVOKED');
      if (host.protocolVersion !== HOST_PROTOCOL_VERSION || host.keyFingerprint !== input.keyFingerprint
        || publicKeyFingerprint(host.publicKey) !== input.keyFingerprint
        || !host.capabilities.includes('host:transport') || !host.capabilities.includes('host:cleanup'))
        fail('V2_HOST_REAUTH_ENROLLMENT_MISMATCH');
      if (!verifyCanonical(host.publicKey, declaration.value, input.signature))
        fail('V2_HOST_REAUTH_SIGNATURE_INVALID');
      const prior = await tx.select().from(coordinationV2HostReauthorizationRequests)
        .where(eq(coordinationV2HostReauthorizationRequests.requestKey, String(declaration.value.requestKey))).for('update');
      if (prior[0]) {
        if (prior[0].declarationDigest !== declaration.declarationDigest
          || prior[0].requestSignatureDigest !== hash(input.signature)) fail('V2_HOST_IDEMPOTENCY_CONFLICT');
        return { requestId: prior[0].id, status: prior[0].state, approvalUrl: `/coordination/v2/host-reauthorization-approval?requestId=${encodeURIComponent(prior[0].id)}` };
      }
      const live = await tx.select({ id: coordinationV2HostReauthorizationRequests.id })
        .from(coordinationV2HostReauthorizationRequests)
        .where(and(eq(coordinationV2HostReauthorizationRequests.hostEnrollmentId, host.id),
          sql`${coordinationV2HostReauthorizationRequests.state} IN ('pending','approved')`)).limit(1);
      if (live[0]) fail('V2_HOST_IDEMPOTENCY_CONFLICT');
      const generation = Number(declaration.value.requestGeneration);
      const row = await tx.insert(coordinationV2HostReauthorizationRequests).values({
        id: randomUUID(), hostEnrollmentId: host.id, keyFingerprint: input.keyFingerprint,
        protocolVersion: HOST_PROTOCOL_VERSION, requestGeneration: generation,
        requestKey: String(declaration.value.requestKey), declarationDigest: declaration.declarationDigest,
        requestSignatureDigest: hash(input.signature), requestedAt: now,
        expiresAt: declaration.expiry, createdAt: now,
      }).returning();
      return { requestId: row[0].id, status: row[0].state, approvalUrl: `/coordination/v2/host-reauthorization-approval?requestId=${encodeURIComponent(row[0].id)}` };
    });
    return result;
  } catch (error) {
    if (error instanceof CoordinationV2HostAuthError) throw error;
    fail('V2_HOST_DATABASE_UNAVAILABLE');
  }
}

export async function approveCoordinationV2HostReauthorization(input: {
  founderActor: string; founderRole: string; requestId: string; now?: Date;
}) {
  founder(input); const now = input.now ?? new Date();
  try {
    const result = await db.transaction(async (tx) => {
      const rows = await tx.select().from(coordinationV2HostReauthorizationRequests)
        .where(eq(coordinationV2HostReauthorizationRequests.id, input.requestId)).for('update');
      const request = rows[0]; if (!request) fail('V2_HOST_REQUEST_NOT_FOUND');
      if (request.expiresAt <= now) {
        await tx.update(coordinationV2HostReauthorizationRequests).set({ state: 'expired', terminalAt: now, terminalReason: 'request_expired' }).where(eq(coordinationV2HostReauthorizationRequests.id, request.id));
        return { expired: true as const };
      }
      if (request.state !== 'pending') fail('V2_HOST_REQUEST_TERMINAL');
      const host = (await tx.select().from(coordinationV2HostEnrollments).where(eq(coordinationV2HostEnrollments.id, request.hostEnrollmentId)).for('update'))[0];
      if (!host || host.status !== 'active' || host.keyFingerprint !== request.keyFingerprint
        || publicKeyFingerprint(host.publicKey) !== request.keyFingerprint || host.protocolVersion !== 1
        || !host.capabilities.includes('host:transport') || !host.capabilities.includes('host:cleanup'))
        fail(host ? 'V2_HOST_REAUTH_ENROLLMENT_MISMATCH' : 'V2_HOST_ENROLLMENT_NOT_FOUND');
      await tx.update(coordinationV2HostReauthorizationRequests).set({ state: 'approved', founderActor: input.founderActor, approvedAt: now }).where(eq(coordinationV2HostReauthorizationRequests.id, request.id));
      return { requestId: request.id, state: 'approved' as const };
    });
    if ('expired' in result) fail('V2_HOST_REQUEST_EXPIRED');
    return result;
  } catch (error) { if (error instanceof CoordinationV2HostAuthError) throw error; fail('V2_HOST_DATABASE_UNAVAILABLE'); }
}

/** Founder-only view: deliberately excludes signatures, request keys, and all proof material. */
export async function getCoordinationV2HostReauthorizationRequest(requestId: string) {
  const request = (await db.select().from(coordinationV2HostReauthorizationRequests)
    .where(eq(coordinationV2HostReauthorizationRequests.id, requestId)))[0];
  if (!request) fail('V2_HOST_REQUEST_NOT_FOUND');
  const host = (await db.select().from(coordinationV2HostEnrollments)
    .where(eq(coordinationV2HostEnrollments.id, request.hostEnrollmentId)))[0];
  if (!host) fail('V2_HOST_ENROLLMENT_NOT_FOUND');
  return {
    id: request.id, hostIdentity: host.hostKey, hostEnrollmentId: host.id,
    fingerprint: request.keyFingerprint, protocolVersion: request.protocolVersion,
    capabilities: host.capabilities, requestedAt: request.requestedAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(), declarationDigest: request.declarationDigest,
    state: request.state,
  };
}

export async function issueCoordinationV2HostReauthorizationChallenge(input: { requestId: string; requestKey: string; now?: Date }) {
  if (!bounded(input.requestKey)) fail('V2_HOST_REAUTH_INVALID');
  const now = input.now ?? new Date(), nonce = randomBytes(32).toString('base64url');
  try {
    const result = await db.transaction(async (tx) => {
      const request = (await tx.select().from(coordinationV2HostReauthorizationRequests).where(eq(coordinationV2HostReauthorizationRequests.id, input.requestId)).for('update'))[0];
      if (!request) fail('V2_HOST_REQUEST_NOT_FOUND');
      if (request.requestKey !== input.requestKey) fail('V2_HOST_REAUTH_INVALID');
      if (request.state === 'completed' || request.state === 'rejected' || request.state === 'expired') {
        return { requestId: request.id, status: request.state };
      }
      if (request.expiresAt <= now) {
        await tx.update(coordinationV2HostReauthorizationRequests).set({ state: 'expired', terminalAt: now, terminalReason: 'request_expired' }).where(eq(coordinationV2HostReauthorizationRequests.id, request.id));
        return { requestId: request.id, status: 'expired' as const };
      }
      if (request.state !== 'approved') return { requestId: request.id, status: request.state };
      const host = (await tx.select().from(coordinationV2HostEnrollments).where(eq(coordinationV2HostEnrollments.id, request.hostEnrollmentId)).for('update'))[0];
      if (!host || host.status !== 'active' || host.keyFingerprint !== request.keyFingerprint
        || publicKeyFingerprint(host.publicKey) !== request.keyFingerprint
        || !host.capabilities.includes('host:transport') || !host.capabilities.includes('host:cleanup')) fail('V2_HOST_REAUTH_ENROLLMENT_MISMATCH');
      const live = (await tx.select().from(coordinationV2HostReauthorizationChallenges).where(and(eq(coordinationV2HostReauthorizationChallenges.requestId, request.id), isNull(coordinationV2HostReauthorizationChallenges.consumedAt))).limit(1))[0];
      if (live && live.expiresAt > now) return { requestId: request.id, status: 'challenge_unavailable' as const };
      if (live && live.expiresAt <= now) {
        await tx.update(coordinationV2HostReauthorizationRequests).set({ state: 'expired', terminalAt: now, terminalReason: 'challenge_expired' }).where(eq(coordinationV2HostReauthorizationRequests.id, request.id));
        return { requestId: request.id, status: 'expired' as const };
      }
      const challengeId = randomUUID();
      const challengeIssued = now.toISOString();
      const challengeExpires = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();
      const challengeValue = { kind: 'host_credential_reauthorization_challenge', requestId: request.id,
        requestKey: request.requestKey, challengeId, nonce, hostEnrollmentId: host.id,
        keyFingerprint: request.keyFingerprint, protocolVersion: 1, requestGeneration: request.requestGeneration,
        issuedAt: challengeIssued, expiresAt: challengeExpires };
      const challenge = await tx.insert(coordinationV2HostReauthorizationChallenges).values({
        id: challengeId, requestId: request.id, hostEnrollmentId: host.id, keyFingerprint: request.keyFingerprint,
        protocolVersion: 1, requestGeneration: request.requestGeneration, nonceDigest: hash(nonce),
        challengeDigest: digest(challengeValue),
        issuedAt: now, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS), createdAt: now,
      }).returning();
      return { requestId: request.id, status: 'approved' as const, requestKey: request.requestKey,
        challenge: { challengeId: challenge[0].id, nonce, issuedAt: challenge[0].issuedAt.toISOString(),
          expiresAt: challenge[0].expiresAt.toISOString(), requestId: request.id, requestKey: request.requestKey,
          hostEnrollmentId: host.id, keyFingerprint: request.keyFingerprint, protocolVersion: 1,
          requestGeneration: request.requestGeneration } };
    });
    return result;
  } catch (error) { if (error instanceof CoordinationV2HostAuthError) throw error; fail('V2_HOST_DATABASE_UNAVAILABLE'); }
}

export async function completeCoordinationV2HostReauthorization(input: {
  requestId: string; requestKey: string; challengeId: string; nonce: string; signature: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!bounded(input.requestKey) || !bounded(input.nonce) || !bounded(input.signature, 8192)) fail('V2_HOST_REAUTH_INVALID');
  try {
     const result = await db.transaction(async (tx) => {
      const request = (await tx.select().from(coordinationV2HostReauthorizationRequests).where(eq(coordinationV2HostReauthorizationRequests.id, input.requestId)).for('update'))[0];
      if (!request || request.requestKey !== input.requestKey) fail('V2_HOST_REAUTH_INVALID');
      if (request.state === 'completed') fail('V2_HOST_REAUTH_REPLAYED');
      if (request.state !== 'approved') fail('V2_HOST_REAUTH_NOT_APPROVED');
      if (request.expiresAt <= now) {
        await tx.update(coordinationV2HostReauthorizationRequests).set({ state: 'expired', terminalAt: now, terminalReason: 'request_expired' }).where(eq(coordinationV2HostReauthorizationRequests.id, request.id));
        return { expired: 'request' as const };
      }
      const challenge = (await tx.select().from(coordinationV2HostReauthorizationChallenges).where(and(eq(coordinationV2HostReauthorizationChallenges.id, input.challengeId), eq(coordinationV2HostReauthorizationChallenges.requestId, request.id))).for('update'))[0];
      if (!challenge || challenge.consumedAt) fail('V2_HOST_REAUTH_REPLAYED');
      if (challenge.requestId !== request.id || challenge.hostEnrollmentId !== request.hostEnrollmentId
        || challenge.keyFingerprint !== request.keyFingerprint || challenge.protocolVersion !== request.protocolVersion
        || challenge.requestGeneration !== request.requestGeneration) fail('V2_HOST_REAUTH_INVALID');
      if (challenge.expiresAt <= now) {
        await tx.update(coordinationV2HostReauthorizationRequests).set({ state: 'expired', terminalAt: now, terminalReason: 'challenge_expired' }).where(eq(coordinationV2HostReauthorizationRequests.id, request.id));
        return { expired: 'challenge' as const };
      }
      const host = (await tx.select().from(coordinationV2HostEnrollments).where(eq(coordinationV2HostEnrollments.id, request.hostEnrollmentId)).for('update'))[0];
      if (!host || host.status !== 'active' || host.keyFingerprint !== request.keyFingerprint
        || publicKeyFingerprint(host.publicKey) !== request.keyFingerprint || host.protocolVersion !== 1
        || !host.capabilities.includes('host:transport') || !host.capabilities.includes('host:cleanup')) fail('V2_HOST_REAUTH_ENROLLMENT_MISMATCH');
      if (hash(input.nonce) !== challenge.nonceDigest) fail('V2_HOST_PROOF_INVALID');
      const signed = { kind: 'host_credential_reauthorization_challenge', requestId: request.id, requestKey: request.requestKey, challengeId: challenge.id, nonce: input.nonce, hostEnrollmentId: host.id, keyFingerprint: request.keyFingerprint, protocolVersion: 1, requestGeneration: request.requestGeneration, issuedAt: challenge.issuedAt.toISOString(), expiresAt: challenge.expiresAt.toISOString() };
      if (digest(signed) !== challenge.challengeDigest) fail('V2_HOST_PROOF_INVALID');
      if (!verifyCanonical(host.publicKey, signed, input.signature)) fail('V2_HOST_PROOF_INVALID');
      const token = randomToken('v2h');
      const credential = (await tx.insert(coordinationV2HostCredentials).values({
        id: randomUUID(), hostEnrollmentId: host.id, tokenHash: hash(token), credentialDigest: digest({ hostEnrollmentId: host.id, requestId: request.id }),
        lineageDigest: digest({ requestId: request.id, requestGeneration: request.requestGeneration }), capability: 'host:transport', protocolVersion: 1,
        proofKeyFingerprint: host.keyFingerprint, issuedBy: request.founderActor!, expiresAt: new Date(now.getTime() + HOST_CREDENTIAL_TTL_MS), issuedAt: now, createdAt: now,
      }).returning())[0];
      await tx.update(coordinationV2HostReauthorizationChallenges).set({ consumedAt: now }).where(eq(coordinationV2HostReauthorizationChallenges.id, challenge.id));
      await tx.update(coordinationV2HostReauthorizationRequests).set({ state: 'completed', resultCredentialId: credential.id, completedAt: now }).where(eq(coordinationV2HostReauthorizationRequests.id, request.id));
      return { accessToken: token, expiresAt: credential.expiresAt.toISOString() };
    });
    if ('expired' in result) fail(result.expired === 'request' ? 'V2_HOST_REQUEST_EXPIRED' : 'V2_HOST_CHALLENGE_EXPIRED');
    return result;
  } catch (error) { if (error instanceof CoordinationV2HostAuthError) throw error; fail('V2_HOST_DATABASE_UNAVAILABLE'); }
}

export function assertCoordinationV2InitialBootstrap(input: {
  providedSecret?: string;
  configuredSecret?: string;
}): void {
  if (!INITIAL_BOOTSTRAP_SECRET.test(input.configuredSecret ?? '')) {
    fail('V2_HOST_BOOTSTRAP_UNAVAILABLE');
  }
  if (input.providedSecret === undefined || input.providedSecret.length === 0) {
    fail('V2_HOST_BOOTSTRAP_REQUIRED');
  }
  if (!INITIAL_BOOTSTRAP_SECRET.test(input.providedSecret)) {
    fail('V2_HOST_BOOTSTRAP_DENIED');
  }
  const expected = createHash('sha256').update(input.configuredSecret!).digest();
  const supplied = createHash('sha256').update(input.providedSecret).digest();
  if (!timingSafeEqual(expected, supplied)) fail('V2_HOST_BOOTSTRAP_DENIED');
}

export async function submitCoordinationV2HostEnrollmentRequest(input: {
  requestKey: string; declaration: unknown; publicKey: string; keyFingerprint: string;
  capabilities?: readonly string[]; bootstrapSecret?: string; now?: Date;
}) {
  if (!bounded(input.requestKey) || !bounded(input.publicKey, 8192) || !HEX.test(input.keyFingerprint)) fail('V2_HOST_INVALID_REQUEST');
  const declaration = validateHostEnrollmentDeclaration(input.declaration, { now: input.now });
  publicKey(input.publicKey);
  const derivedFingerprint = publicKeyFingerprint(input.publicKey);
  if (derivedFingerprint !== input.keyFingerprint) fail('V2_HOST_INVALID_REQUEST');
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${INITIAL_BOOTSTRAP_LOCK}, 0))
      `);
      const prior = await tx.select().from(coordinationV2HostEnrollmentRequests)
        .where(eq(coordinationV2HostEnrollmentRequests.requestKey, input.requestKey)).for('update');
      if (prior[0]) {
        if (prior[0].declarationDigest !== declaration.declarationDigest) fail('V2_HOST_IDEMPOTENCY_CONFLICT');
        return { requestId: prior[0].id, status: prior[0].status, expiresAt: prior[0].expiresAt.toISOString(), created: false };
      }
      const enrolledHost = await tx.select({ id: coordinationV2HostEnrollments.id })
        .from(coordinationV2HostEnrollments).limit(1);
      if (!enrolledHost[0]) {
        const existingRequest = await tx.select({ id: coordinationV2HostEnrollmentRequests.id })
          .from(coordinationV2HostEnrollmentRequests).limit(1);
        if (existingRequest[0]) fail('V2_HOST_BOOTSTRAP_CONSUMED');
        const publishedSource = await tx.select({ id: coordinationV2SourcePromotions.id })
          .from(coordinationV2SourcePromotions)
          .where(eq(coordinationV2SourcePromotions.state, 'published'))
          .limit(1);
        if (!publishedSource[0]) fail('V2_HOST_SOURCE_PROMOTION_REQUIRED');
        assertCoordinationV2InitialBootstrap({
          providedSecret: input.bootstrapSecret,
          configuredSecret: process.env.COORDINATION_V2_HOST_BOOTSTRAP_SECRET,
        });
      }
      const row = await tx.insert(coordinationV2HostEnrollmentRequests).values({
        id: randomUUID(), hostKey: declaration.hostId, hostType: 'windows', displayName: declaration.hostId,
        protocolVersion: HOST_PROTOCOL_VERSION, publicKey: input.publicKey, keyFingerprint: input.keyFingerprint,
        capabilities: [...(input.capabilities ?? declaration.capabilities)].sort(),
        declarationDigest: declaration.declarationDigest, requestKey: input.requestKey,
        expiresAt: new Date(now.getTime() + REQUEST_TTL_MS), createdAt: now,
      }).returning();
      return { requestId: row[0].id, status: row[0].status, expiresAt: row[0].expiresAt.toISOString(), created: true };
    });
  } catch (error) {
    if (error instanceof CoordinationV2HostAuthError) throw error;
    fail('V2_HOST_DATABASE_UNAVAILABLE');
  }
}

export async function approveCoordinationV2HostEnrollment(input: {
  founderActor: string; founderRole: string; requestId: string; now?: Date;
}) {
  founder(input); const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx.select().from(coordinationV2HostEnrollmentRequests)
        .where(eq(coordinationV2HostEnrollmentRequests.id, input.requestId)).for('update');
      const request = rows[0];
      if (!request) fail('V2_HOST_REQUEST_NOT_FOUND');
      if (request.expiresAt <= now) fail('V2_HOST_REQUEST_EXPIRED');
      if (request.status !== 'pending') fail('V2_HOST_REQUEST_TERMINAL');
      await tx.update(coordinationV2HostEnrollmentRequests).set({ status: 'approved', founderActor: input.founderActor }).where(eq(coordinationV2HostEnrollmentRequests.id, request.id));
      return { requestId: request.id, status: 'approved' as const };
    });
  } catch (error) {
    if (error instanceof CoordinationV2HostAuthError) throw error;
    fail('V2_HOST_DATABASE_UNAVAILABLE');
  }
}

export async function getCoordinationV2HostEnrollmentRequest(requestId: string) {
  const rows = await db.select().from(coordinationV2HostEnrollmentRequests)
    .where(eq(coordinationV2HostEnrollmentRequests.id, requestId));
  const row = rows[0]; if (!row) fail('V2_HOST_REQUEST_NOT_FOUND');
  return { id: row.id, hostKey: row.hostKey, hostType: row.hostType, displayName: row.displayName,
    protocolVersion: row.protocolVersion, keyFingerprint: row.keyFingerprint, capabilities: row.capabilities,
    declarationDigest: row.declarationDigest, status: row.status, expiresAt: row.expiresAt.toISOString() };
}

/** Host polling atomically obtains a nonce and immediately receives it over TLS. */
export async function issueCoordinationV2HostProofChallenge(input: { requestId: string; requestKey?: string; now?: Date }) {
  if (!bounded(input.requestKey)) fail('V2_HOST_CHALLENGE_INVALID');
  const now = input.now ?? new Date(); const nonce = randomBytes(32).toString('base64url');
  try {
    return await db.transaction(async (tx) => {
      const requests = await tx.select().from(coordinationV2HostEnrollmentRequests)
        .where(eq(coordinationV2HostEnrollmentRequests.id, input.requestId)).for('update');
      const request = requests[0];
      if (!request) fail('V2_HOST_REQUEST_NOT_FOUND');
      if (input.requestKey !== undefined && request.requestKey !== input.requestKey) fail('V2_HOST_CHALLENGE_INVALID');
      if (request.expiresAt <= now) fail('V2_HOST_REQUEST_EXPIRED');
      if (request.status !== 'approved') return { status: request.status, challenge: undefined };
      const prior = await tx.select().from(coordinationV2HostProofChallenges)
        .where(eq(coordinationV2HostProofChallenges.enrollmentRequestId, request.id)).for('update');
      if (prior[0] && !prior[0].consumedAt && prior[0].expiresAt > now) return { status: 'approved', challenge: undefined };
      const challenge = await tx.insert(coordinationV2HostProofChallenges).values({
        id: randomUUID(), enrollmentRequestId: request.id, nonce, nonceHash: hash(nonce),
        challengeDigest: digest({ requestId: request.id, nonceHash: hash(nonce) }),
        issuedBy: request.founderActor ?? 'founder-approved-request',
        expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS), createdAt: now,
      }).returning();
      return { status: 'approved', challenge: { id: challenge[0].id, nonce, expiresAt: challenge[0].expiresAt.toISOString() } };
    });
  } catch (error) {
    if (error instanceof CoordinationV2HostAuthError) throw error;
    fail('V2_HOST_DATABASE_UNAVAILABLE');
  }
}

export async function completeCoordinationV2HostEnrollment(input: {
  requestId: string; challengeId: string; nonce: string; signature: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!bounded(input.signature, 8192)) fail('V2_HOST_PROOF_INVALID');
  try {
    return await db.transaction(async (tx) => {
      const requests = await tx.select().from(coordinationV2HostEnrollmentRequests)
        .where(eq(coordinationV2HostEnrollmentRequests.id, input.requestId)).for('update');
      const request = requests[0];
      if (!request || request.status !== 'approved') fail('V2_HOST_REQUEST_TERMINAL');
      const challenges = await tx.select().from(coordinationV2HostProofChallenges)
        .where(and(eq(coordinationV2HostProofChallenges.id, input.challengeId), eq(coordinationV2HostProofChallenges.enrollmentRequestId, request.id))).for('update');
      const challenge = challenges[0];
      if (!challenge || challenge.consumedAt) fail('V2_HOST_CHALLENGE_INVALID');
      if (challenge.expiresAt <= now) fail('V2_HOST_CHALLENGE_EXPIRED');
      if (hash(input.nonce) !== challenge.nonceHash || !verifyProof(request.publicKey, input.nonce, input.signature)) {
        fail('V2_HOST_PROOF_INVALID');
      }
      const host = await tx.insert(coordinationV2HostEnrollments).values({
        id: randomUUID(), hostKey: request.hostKey, hostType: request.hostType, displayName: request.displayName,
        protocolVersion: request.protocolVersion, publicKey: request.publicKey, keyFingerprint: request.keyFingerprint,
        capabilities: request.capabilities, enrollmentDigest: request.declarationDigest,
        enrollmentRequestKey: request.requestKey, createdBy: request.founderActor ?? 'founder',
        metadata: { provenance: 'coordination-v2-device-enrollment', requestId: request.id },
        createdAt: now, updatedAt: now,
      }).returning();
      const token = randomToken('v2h');
      const credential = await tx.insert(coordinationV2HostCredentials).values({
        id: randomUUID(), hostEnrollmentId: host[0].id, tokenHash: hash(token),
        credentialDigest: digest({ hostEnrollmentId: host[0].id, requestId: request.id }),
        lineageDigest: digest({ requestId: request.id, declarationDigest: request.declarationDigest }),
        capability: 'host:transport', protocolVersion: request.protocolVersion,
        proofKeyFingerprint: request.keyFingerprint, issuedBy: request.founderActor ?? 'founder',
        expiresAt: new Date(now.getTime() + HOST_CREDENTIAL_TTL_MS), issuedAt: now, createdAt: now,
      }).returning();
      await tx.update(coordinationV2HostProofChallenges).set({ consumedAt: now }).where(eq(coordinationV2HostProofChallenges.id, challenge.id));
      await tx.update(coordinationV2HostEnrollmentRequests).set({
        status: 'completed', hostEnrollmentId: host[0].id, terminalAt: now,
      }).where(eq(coordinationV2HostEnrollmentRequests.id, request.id));
      return { hostEnrollment: safeEnrollment(host[0]), accessToken: token, credential: safeHostCredential(credential[0]) };
    });
  } catch (error) {
    if (error instanceof CoordinationV2HostAuthError) throw error;
    fail('V2_HOST_DATABASE_UNAVAILABLE');
  }
}

export async function resolveCoordinationV2HostCredential(input: {
  token: string; capability?: CoordinationV2HostCapability; protocolVersion?: number;
  now?: Date;
}): Promise<HostAuthContext | undefined> {
  if (!/^v2h_[A-Za-z0-9_-]{32,}$/.test(input.token)) return undefined;
  const rows = await db.select().from(coordinationV2HostCredentials).where(eq(coordinationV2HostCredentials.tokenHash, hash(input.token)));
  const row = rows[0]; const now = input.now ?? new Date();
  if (!row || row.revokedAt || row.expiresAt <= now || (input.capability && row.capability !== input.capability)
    || row.protocolVersion !== (input.protocolVersion ?? HOST_PROTOCOL_VERSION)) return undefined;
  const hosts = await db.select().from(coordinationV2HostEnrollments).where(eq(coordinationV2HostEnrollments.id, row.hostEnrollmentId));
  return hosts[0]?.status === 'active' ? safeHostCredential(row) : undefined;
}

export async function verifyCoordinationV2HostProof(token: string, signature: string, now = new Date()) {
  const context = await resolveCoordinationV2HostCredential({ token, now });
  if (!context) return undefined;
  const hosts = await db.select().from(coordinationV2HostEnrollments).where(eq(coordinationV2HostEnrollments.id, context.hostEnrollmentId));
  return hosts[0] && verifyProof(hosts[0].publicKey, token, signature) ? context : undefined;
}

export async function renewCoordinationV2HostCredential(input: {
  token: string; signature: string; holderInstanceId?: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  const rows = await db.select().from(coordinationV2HostCredentials)
    .where(eq(coordinationV2HostCredentials.tokenHash, hash(input.token)));
  const credential = rows[0];
  if (!credential || credential.revokedAt || credential.expiresAt <= now) fail('V2_HOST_CREDENTIAL_INVALID');
  const hosts = await db.select().from(coordinationV2HostEnrollments)
    .where(eq(coordinationV2HostEnrollments.id, credential.hostEnrollmentId));
  const host = hosts[0];
  if (!host || host.status !== 'active' || !verifyProof(host.publicKey, input.token, input.signature)) fail('V2_HOST_PROOF_INVALID');
  if (credential.holderInstanceId && credential.holderInstanceId !== input.holderInstanceId) fail('V2_HOST_CREDENTIAL_SCOPE_DENIED');
  const updated = await db.update(coordinationV2HostCredentials)
    .set({ expiresAt: new Date(now.getTime() + HOST_CREDENTIAL_TTL_MS), holderInstanceId: input.holderInstanceId ?? credential.holderInstanceId })
    .where(eq(coordinationV2HostCredentials.id, credential.id)).returning();
  return safeHostCredential(updated[0]);
}

export async function resolveCoordinationV2SessionCredential(input: {
  token: string; signature?: string; sessionId: string; holderInstanceId: string; capability: CoordinationV2HostCapability;
  protocolVersion: number; now?: Date;
}): Promise<HostAuthContext | undefined> {
  if (!/^v2s_[A-Za-z0-9_-]{32,}$/.test(input.token)) return undefined;
  const rows = await db.select().from(coordinationV2SessionCredentials).where(eq(coordinationV2SessionCredentials.tokenHash, hash(input.token)));
  const row = rows[0]; const now = input.now ?? new Date();
  if (!row || row.revokedAt || row.expiresAt <= now || row.sessionId !== input.sessionId
    || row.hostEnrollmentId !== (await db.select({ hostEnrollmentId: coordinationV2Sessions.enrolledHostId }).from(coordinationV2Sessions).where(eq(coordinationV2Sessions.id, input.sessionId)))[0]?.hostEnrollmentId
    || row.holderInstanceId !== input.holderInstanceId || row.capability !== input.capability || row.protocolVersion !== input.protocolVersion) return undefined;
  const hosts = await db.select().from(coordinationV2HostEnrollments).where(eq(coordinationV2HostEnrollments.id, row.hostEnrollmentId));
  if (!input.signature || !hosts[0] || !verifyProof(hosts[0].publicKey, input.token, input.signature)) return undefined;
  const lease = await db.select().from(coordinationV2TransportLeases).where(and(
    eq(coordinationV2TransportLeases.id, row.leaseId), eq(coordinationV2TransportLeases.sessionId, row.sessionId),
    eq(coordinationV2TransportLeases.enrolledHostId, row.hostEnrollmentId), eq(coordinationV2TransportLeases.holderInstanceId, row.holderInstanceId),
    eq(coordinationV2TransportLeases.epoch, row.leaseEpoch), eq(coordinationV2TransportLeases.state, 'active'),
  ));
  if (!lease[0] || lease[0].expiresAt <= now) return undefined;
  const attempts = await db.select().from(coordinationV2Attempts).where(and(
    eq(coordinationV2Attempts.id, row.attemptId), eq(coordinationV2Attempts.sessionId, row.sessionId),
  ));
  if (!attempts[0] || ['completed', 'retryable_failed', 'terminal_failed', 'cancelled'].includes(attempts[0].state)) return undefined;
  return { credentialId: row.id, hostEnrollmentId: row.hostEnrollmentId, capability: row.capability as CoordinationV2HostCapability,
    protocolVersion: row.protocolVersion, sessionId: row.sessionId, holderInstanceId: row.holderInstanceId, lineageDigest: row.credentialDigest,
    attemptId: row.attemptId, leaseId: row.leaseId, leaseEpoch: row.leaseEpoch };
}

export async function issueCoordinationV2SessionCredential(input: {
  hostCredentialId: string; hostEnrollmentId: string; sessionId: string; attemptId: string; leaseId: string; leaseEpoch: number;
  holderInstanceId: string; capability: CoordinationV2HostCapability; lineageDigest: string; now?: Date;
}) {
  const now = input.now ?? new Date(); const token = randomToken('v2s');
  const sessionRows = await db.select({ state: coordinationV2Sessions.state })
    .from(coordinationV2Sessions).where(eq(coordinationV2Sessions.id, input.sessionId)).limit(1);
  if (!sessionRows[0] || !['ready', 'running', 'waiting_for_host', 'verifying'].includes(sessionRows[0].state)) {
    fail('V2_HOST_CREDENTIAL_SCOPE_DENIED');
  }
  const row = await db.insert(coordinationV2SessionCredentials).values({
    id: randomUUID(), hostCredentialId: input.hostCredentialId, hostEnrollmentId: input.hostEnrollmentId,
    sessionId: input.sessionId, attemptId: input.attemptId, leaseId: input.leaseId, leaseEpoch: input.leaseEpoch,
    tokenHash: hash(token),
    credentialDigest: digest({ hostCredentialId: input.hostCredentialId, sessionId: input.sessionId, attemptId: input.attemptId, leaseId: input.leaseId, leaseEpoch: input.leaseEpoch, holderInstanceId: input.holderInstanceId, capability: input.capability }),
    capability: input.capability, protocolVersion: HOST_PROTOCOL_VERSION, holderInstanceId: input.holderInstanceId,
    issuedBy: input.hostEnrollmentId, issuedAt: now,
    expiresAt: new Date(Math.min(now.getTime() + SESSION_CREDENTIAL_TTL_MS, now.getTime() + 60 * 60_000)), createdAt: now,
  }).returning();
  return { sessionToken: token, credentialId: row[0].id, expiresAt: row[0].expiresAt.toISOString(), lineageDigest: input.lineageDigest };
}

export async function renewCoordinationV2SessionCredential(input: {
  token: string; signature: string; hostEnrollmentId: string; sessionId: string; holderInstanceId: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  const rows = await db.select().from(coordinationV2SessionCredentials).where(eq(coordinationV2SessionCredentials.tokenHash, hash(input.token)));
  const row = rows[0];
  if (!row || row.revokedAt || row.hostEnrollmentId !== input.hostEnrollmentId || row.sessionId !== input.sessionId
    || row.holderInstanceId !== input.holderInstanceId) fail('V2_HOST_CREDENTIAL_SCOPE_DENIED');
  const hosts = await db.select().from(coordinationV2HostEnrollments).where(eq(coordinationV2HostEnrollments.id, row.hostEnrollmentId));
  if (!hosts[0] || !verifyProof(hosts[0].publicKey, input.token, input.signature)) fail('V2_HOST_PROOF_INVALID');
  const lease = await db.select().from(coordinationV2TransportLeases).where(and(
    eq(coordinationV2TransportLeases.id, row.leaseId), eq(coordinationV2TransportLeases.sessionId, row.sessionId),
    eq(coordinationV2TransportLeases.enrolledHostId, row.hostEnrollmentId), eq(coordinationV2TransportLeases.holderInstanceId, row.holderInstanceId),
    eq(coordinationV2TransportLeases.epoch, row.leaseEpoch), eq(coordinationV2TransportLeases.state, 'active'),
  ));
  if (!lease[0] || lease[0].expiresAt <= now) fail('V2_HOST_CREDENTIAL_SCOPE_DENIED');
  const sessions = await db.select({ expiresAt: coordinationV2Sessions.expiresAt }).from(coordinationV2Sessions).where(eq(coordinationV2Sessions.id, row.sessionId));
  const sessionExpiry = sessions[0]?.expiresAt;
  if (!sessionExpiry || sessionExpiry <= now) fail('V2_HOST_CREDENTIAL_EXPIRED');
  const expiresAt = new Date(Math.min(now.getTime() + SESSION_CREDENTIAL_TTL_MS, sessionExpiry.getTime(), lease[0].expiresAt.getTime()));
  const updated = await db.update(coordinationV2SessionCredentials).set({ expiresAt }).where(eq(coordinationV2SessionCredentials.id, row.id)).returning();
  return { credentialId: row.id, expiresAt: updated[0].expiresAt.toISOString() };
}

export async function revokeCoordinationV2Host(input: {
  founderActor: string; founderRole: string; hostEnrollmentId: string; requestKey: string; now?: Date;
}) {
  founder(input); if (!bounded(input.requestKey)) fail('V2_HOST_INVALID_REQUEST'); const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx.select().from(coordinationV2HostEnrollments).where(eq(coordinationV2HostEnrollments.id, input.hostEnrollmentId)).for('update');
      const host = rows[0]; if (!host) fail('V2_HOST_ENROLLMENT_NOT_FOUND');
      await tx.update(coordinationV2HostEnrollments).set({ status: 'revoked', revokedAt: now, revocationRequestKey: input.requestKey, updatedAt: now }).where(eq(coordinationV2HostEnrollments.id, host.id));
      await tx.update(coordinationV2HostCredentials).set({ revokedAt: now }).where(and(eq(coordinationV2HostCredentials.hostEnrollmentId, host.id), isNull(coordinationV2HostCredentials.revokedAt)));
      await tx.update(coordinationV2SessionCredentials).set({ revokedAt: now }).where(and(eq(coordinationV2SessionCredentials.hostEnrollmentId, host.id), isNull(coordinationV2SessionCredentials.revokedAt)));
      await tx.update(coordinationV2TransportLeases).set({ state: 'released', endedAt: now })
        .where(and(eq(coordinationV2TransportLeases.enrolledHostId, host.id), eq(coordinationV2TransportLeases.state, 'active')));
      await tx.update(coordinationV2TransportWorkClaims).set({ state: 'expired', terminalAt: now })
        .where(and(eq(coordinationV2TransportWorkClaims.enrolledHostId, host.id), eq(coordinationV2TransportWorkClaims.state, 'active')));
      return { revoked: true, hostEnrollmentId: host.id };
    });
  } catch (error) {
    if (error instanceof CoordinationV2HostAuthError) throw error;
    fail('V2_HOST_DATABASE_UNAVAILABLE');
  }
}

export function hostEnrollmentAsCompatibility(row: CoordinationV2HostEnrollment) {
  return { id: row.id, hostType: row.hostType, protocolVersion: row.protocolVersion, capabilities: row.capabilities,
    enrollmentDigest: row.enrollmentDigest, status: row.status };
}
/**
 * Trusted, Replit-side Gate 3 operator provisioning.
 *
 * This is deliberately a script/service rather than an HTTP handler.  Its
 * inputs are public bundle bytes only; in particular, there is no parameter
 * which can contain a bootstrap or access credential.
 */
import { readFile } from "node:fs/promises";
import { stdin } from "node:process";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { closeDbConnections, getSharedDb } from "../db";
import {
  coordinationCredentialAuditEvents,
  coordinationGate3ProofGrants,
  coordinationRuntimeCredentials,
  coordinationRuntimePackets,
  coordinationRuntimeProfiles,
  coordinationRuntimeRegistrations,
  taskOwnershipChallenges,
  taskOwnershipReceipts,
} from "@shared/schema";
import {
  GATE3,
  type PublicProvisioningBundle,
  validatePublicProvisioningBundle,
} from "../services/antigravity-provisioning-bundle";
import {
  createChallenge,
} from "../services/founder-task-ownership-service";
import {
  consumedCoordinationBootstrapHash,
  registerCoordinationRuntimeWithBootstrapSha256InExecutor,
} from "../services/coordination-credential-broker";

const MAX_BUNDLE_BYTES = 1024 * 1024;
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class AntigravityProvisioningError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`antigravity_provisioning_${code}`);
    this.name = "AntigravityProvisioningError";
    this.code = code;
  }
}

function checkedBundle(value: unknown): PublicProvisioningBundle {
  try {
    validatePublicProvisioningBundle(value);
  } catch {
    throw new AntigravityProvisioningError("invalid_bundle");
  }
  const bundle = value as PublicProvisioningBundle;
  if (!bundle.bundleDigest) throw new AntigravityProvisioningError("bundle_digest_required");
  return bundle;
}

/**
 * Phase A only creates the founder challenge.  Runtime and profile rows are
 * intentionally not touched here.
 */
export async function submitAntigravityChallenge(value: unknown, attemptIdValue: unknown): Promise<{
  challengeId: string;
  taskDigest: string;
  keyFingerprint: string;
  bundleDigest: string;
  attemptId: string;
  expiresAt: Date;
}> {
  const bundle = checkedBundle(value);
  if (typeof attemptIdValue !== "string" || attemptIdValue.length === 0) {
    throw new AntigravityProvisioningError("attempt_id_required");
  }
  if (!CANONICAL_UUID.test(attemptIdValue)) {
    throw new AntigravityProvisioningError("attempt_id_invalid");
  }
  const attemptId = attemptIdValue;
  try {
    const result = await createChallenge({
      taskRef: GATE3.taskRef,
      artifactSha256: bundle.artifactSha256,
      intendedActor: GATE3.actor,
      coordinationActor: GATE3.actor,
      publicKey: bundle.publicKey,
      keyFingerprint: bundle.keyFingerprint,
      contextDigest: bundle.bundleDigest,
      idempotencyKey: `antigravity:${bundle.bundleDigest}:${attemptId}`,
      ttlMs: 20 * 60_000,
    });
    return {
      challengeId: result.challengeId,
      taskDigest: bundle.artifactSha256,
      keyFingerprint: bundle.keyFingerprint,
      bundleDigest: bundle.bundleDigest,
      attemptId,
      expiresAt: result.expiresAt,
    };
  } catch (error) {
    if (error instanceof AntigravityProvisioningError) throw error;
    throw new AntigravityProvisioningError("challenge_failed");
  }
}

function profileMatches(row: typeof coordinationRuntimeProfiles.$inferSelect, bundle: PublicProvisioningBundle): boolean {
  return row.runtimeRegistrationId === bundle.runtimeId
    && row.actor === bundle.actor
    && JSON.stringify(row.capabilities) === JSON.stringify(bundle.runtimeCapabilities)
    && row.provider === bundle.provider
    && row.model === bundle.model
    && row.adapterVersion === bundle.adapterVersion
    && row.repositoryLabel === bundle.repositoryLabel
    && row.worktreeLabel === bundle.worktreeLabel
    && row.worktreeRealpathDigest === bundle.worktreeRealpathDigest
    && row.branch === bundle.branch
    && row.startingCommit === bundle.startingCommit
    && row.status === "active";
}

function registrationMatches(
  row: typeof coordinationRuntimeRegistrations.$inferSelect,
  bundle: PublicProvisioningBundle,
): boolean {
  return row.actor === bundle.actor
    && row.displayName === bundle.worktreeLabel
    && JSON.stringify(row.capabilities) === JSON.stringify(bundle.credentialCapabilities)
    && row.tokenTtlSeconds === bundle.tokenTtlSeconds
    && row.enabled
    && !row.revokedAt;
}

/**
 * Phase B rereads the challenge and the bundle, and fails closed unless the
 * founder receipt is active, unexpired, and byte-for-byte bound to the bundle.
 */
export async function registerAntigravityRuntime(value: unknown, challengeId: string): Promise<{
  runtimeId: string;
  profileId: string;
  challengeId: string;
  receiptId: string;
  bundleDigest: string;
  status: "created" | "replayed" | "recovered";
}> {
  const bundle = checkedBundle(value);
  if (!challengeId || challengeId.length > 200) throw new AntigravityProvisioningError("challenge_required");

  const db = getSharedDb();
  const result = await db.transaction(async (tx) => {
    const executor = tx as unknown as ReturnType<typeof getSharedDb>;
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${bundle.runtimeId}, 0))
    `);
    const [registrationSnapshot] = await tx.select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, bundle.runtimeId));
    const bootstrapDigests = [...new Set(
      [registrationSnapshot?.bootstrapHash, bundle.bootstrapSha256].filter(
        (value): value is string => Boolean(value),
      ),
    )].sort();
    for (const digest of bootstrapDigests) {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${digest}, 0))
      `);
    }
    const [existingRegistration] = await tx.select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, bundle.runtimeId))
      .for("update");
    const [existingProfile] = await tx.select().from(coordinationRuntimeProfiles)
      .where(and(
        eq(coordinationRuntimeProfiles.runtimeRegistrationId, bundle.runtimeId),
        eq(coordinationRuntimeProfiles.status, "active"),
      ))
      .for("update");
    const [receipt] = await tx.select().from(taskOwnershipReceipts)
      .where(eq(taskOwnershipReceipts.challengeId, challengeId)).for("update");
    const [fullChallenge] = await tx.select().from(taskOwnershipChallenges)
      .where(eq(taskOwnershipChallenges.id, challengeId)).for("update");
    if (!fullChallenge || !receipt || fullChallenge.status !== "approved") {
      throw new AntigravityProvisioningError("challenge_not_approved");
    }
    if (fullChallenge.expiresAt <= new Date() || receipt.expiresAt <= new Date()) {
      throw new AntigravityProvisioningError("challenge_expired");
    }
    if (receipt.status !== "active" || receipt.revokedAt
      || fullChallenge.taskRef !== bundle.taskRef
      || fullChallenge.artifactSha256 !== bundle.artifactSha256
      || fullChallenge.coordinationActor !== bundle.actor
      || fullChallenge.intendedActor !== bundle.actor
      || fullChallenge.publicKey !== bundle.publicKey
      || fullChallenge.keyFingerprint !== bundle.keyFingerprint
      || fullChallenge.contextDigest !== bundle.bundleDigest
      || receipt.taskRef !== bundle.taskRef
      || receipt.artifactSha256 !== bundle.artifactSha256
      || receipt.intendedActor !== bundle.actor
      || receipt.publicKey !== bundle.publicKey
      || receipt.keyFingerprint !== bundle.keyFingerprint
      || receipt.contextDigest !== bundle.bundleDigest) {
      throw new AntigravityProvisioningError("receipt_mismatch");
    }
    if (existingProfile && !profileMatches(existingProfile, bundle)) {
      throw new AntigravityProvisioningError("profile_conflict");
    }
    if (existingRegistration && !existingProfile) {
      throw new AntigravityProvisioningError("profile_missing");
    }
    const registrationInput = {
      runtimeId: bundle.runtimeId,
      actor: bundle.actor as "luca-gemini",
      displayName: bundle.worktreeLabel,
      capabilities: bundle.credentialCapabilities as ("coordination:read" | "coordination:write" | "coordination:inbox:ack" | "coordination:credential:renew")[],
      tokenTtlSeconds: bundle.tokenTtlSeconds,
      bootstrapSha256: bundle.bootstrapSha256,
    };
    let registration: {
      runtimeId: string;
      actor: string;
      displayName: string;
      capabilities: string[];
      tokenTtlSeconds: number;
      status: "created" | "replayed" | "recovered";
    };
    const consumedBundleHash = consumedCoordinationBootstrapHash(
      bundle.runtimeId,
      bundle.bootstrapSha256,
    );
    if (existingRegistration?.bootstrapHash === consumedBundleHash) {
      if (!registrationMatches(existingRegistration, bundle)) {
        throw new AntigravityProvisioningError("replay_registration_conflict");
      }
      await tx.insert(coordinationCredentialAuditEvents).values({
        eventType: "runtime_registration_replayed",
        success: true,
        runtimeId: bundle.runtimeId,
        actor: bundle.actor,
        metadata: { status: "consumed_bootstrap_compatible_retry" },
      });
      registration = {
        runtimeId: bundle.runtimeId,
        actor: "luca-gemini",
        displayName: bundle.worktreeLabel,
        capabilities: registrationInput.capabilities,
        tokenTtlSeconds: bundle.tokenTtlSeconds,
        status: "replayed",
      };
    } else if (existingRegistration && existingRegistration.bootstrapHash !== bundle.bootstrapSha256) {
      if (!registrationMatches(existingRegistration, bundle)) {
        throw new AntigravityProvisioningError("recovery_registration_conflict");
      }
      const [consumptionAudit] = await tx.select({
        metadata: coordinationCredentialAuditEvents.metadata,
      }).from(coordinationCredentialAuditEvents).where(and(
        eq(coordinationCredentialAuditEvents.runtimeId, bundle.runtimeId),
        eq(coordinationCredentialAuditEvents.eventType, "runtime_bootstrap_consumed"),
        eq(coordinationCredentialAuditEvents.success, true),
      )).orderBy(desc(coordinationCredentialAuditEvents.createdAt)).limit(1);
      const auditMetadata = consumptionAudit?.metadata && typeof consumptionAudit.metadata === "object"
        ? consumptionAudit.metadata as Record<string, unknown>
        : undefined;
      const auditedApprovedDigest = typeof auditMetadata?.approvedBootstrapSha256 === "string"
        ? auditMetadata.approvedBootstrapSha256
        : undefined;
      const auditedConsumedDigest = typeof auditMetadata?.consumedBootstrapSha256 === "string"
        ? auditMetadata.consumedBootstrapSha256
        : undefined;
      let priorApprovedBootstrapSha256: string;
      let recoveryLineage: "audited_consumption" | "legacy_issued_credential";
      if (
        auditedApprovedDigest
        && auditedConsumedDigest === existingRegistration.bootstrapHash
        && consumedCoordinationBootstrapHash(bundle.runtimeId, auditedApprovedDigest) === auditedConsumedDigest
      ) {
        priorApprovedBootstrapSha256 = auditedApprovedDigest;
        recoveryLineage = "audited_consumption";
      } else {
        const [historicalCredential] = await tx.select({ id: coordinationRuntimeCredentials.id })
          .from(coordinationRuntimeCredentials)
          .where(eq(coordinationRuntimeCredentials.runtimeId, bundle.runtimeId))
          .limit(1);
        const [priorRecovery] = await tx.select({ id: coordinationCredentialAuditEvents.id })
          .from(coordinationCredentialAuditEvents)
          .where(and(
            eq(coordinationCredentialAuditEvents.runtimeId, bundle.runtimeId),
            eq(coordinationCredentialAuditEvents.eventType, "runtime_bootstrap_recovered"),
            eq(coordinationCredentialAuditEvents.success, true),
          ))
          .limit(1);
        if (!historicalCredential || priorRecovery) {
          throw new AntigravityProvisioningError("recovery_unconsumed_bootstrap");
        }
        priorApprovedBootstrapSha256 = existingRegistration.bootstrapHash;
        recoveryLineage = "legacy_issued_credential";
      }
      const [digestOwner] = await tx.select({ id: coordinationRuntimeRegistrations.id })
        .from(coordinationRuntimeRegistrations)
        .where(and(
          eq(coordinationRuntimeRegistrations.bootstrapHash, bundle.bootstrapSha256),
          ne(coordinationRuntimeRegistrations.id, bundle.runtimeId),
        ))
        .limit(1);
      if (digestOwner) throw new AntigravityProvisioningError("recovery_digest_conflict");
      const now = new Date();
      const [liveCredential] = await tx.select({ id: coordinationRuntimeCredentials.id })
        .from(coordinationRuntimeCredentials)
        .where(and(
          eq(coordinationRuntimeCredentials.runtimeId, bundle.runtimeId),
          isNull(coordinationRuntimeCredentials.revokedAt),
          gt(coordinationRuntimeCredentials.expiresAt, now),
        ))
        .limit(1);
      if (liveCredential) throw new AntigravityProvisioningError("recovery_live_credential");
      const [liveGrant] = await tx.select({ id: coordinationGate3ProofGrants.id })
        .from(coordinationGate3ProofGrants)
        .where(and(
          eq(coordinationGate3ProofGrants.runtimeRegistrationId, bundle.runtimeId),
          eq(coordinationGate3ProofGrants.profileId, existingProfile!.id),
          isNull(coordinationGate3ProofGrants.revokedAt),
          gt(coordinationGate3ProofGrants.expiresAt, now),
        ))
        .limit(1);
      if (liveGrant) throw new AntigravityProvisioningError("recovery_live_grant");
      const [packet] = await tx.select({ id: coordinationRuntimePackets.id })
        .from(coordinationRuntimePackets)
        .where(eq(coordinationRuntimePackets.runtimeRegistrationId, bundle.runtimeId))
        .limit(1);
      if (packet) throw new AntigravityProvisioningError("recovery_packet_history");
      const [updated] = await tx.update(coordinationRuntimeRegistrations).set({
        bootstrapHash: bundle.bootstrapSha256,
        updatedAt: now,
      }).where(and(
        eq(coordinationRuntimeRegistrations.id, bundle.runtimeId),
        eq(coordinationRuntimeRegistrations.bootstrapHash, existingRegistration.bootstrapHash),
        eq(coordinationRuntimeRegistrations.enabled, true),
        isNull(coordinationRuntimeRegistrations.revokedAt),
      )).returning({ id: coordinationRuntimeRegistrations.id });
      if (!updated) throw new AntigravityProvisioningError("recovery_concurrent_update");
      await tx.insert(coordinationCredentialAuditEvents).values({
        eventType: "runtime_bootstrap_recovered",
        success: true,
        runtimeId: bundle.runtimeId,
        actor: bundle.actor,
        reason: "consumed_bootstrap_recovery",
        metadata: {
          oldBootstrapSha256: priorApprovedBootstrapSha256,
          newBootstrapSha256: bundle.bootstrapSha256,
          challengeId,
          receiptId: receipt.id,
          bundleDigest: bundle.bundleDigest,
          recoveryLineage,
        },
      });
      registration = {
        runtimeId: bundle.runtimeId,
        actor: bundle.actor as "luca-gemini",
        displayName: bundle.worktreeLabel,
        capabilities: registrationInput.capabilities,
        tokenTtlSeconds: bundle.tokenTtlSeconds,
        status: "recovered",
      };
    } else {
      registration = await registerCoordinationRuntimeWithBootstrapSha256InExecutor(
        registrationInput,
        executor,
      );
    }
    let profileId = existingProfile?.id;
    if (!existingProfile) {
      profileId = `antigravity-${bundle.bundleDigest}`;
      await tx.insert(coordinationRuntimeProfiles).values({
        id: profileId,
        runtimeRegistrationId: bundle.runtimeId,
        actor: bundle.actor,
        capabilities: bundle.runtimeCapabilities,
        provider: bundle.provider,
        model: bundle.model,
        adapterVersion: bundle.adapterVersion,
        repositoryLabel: bundle.repositoryLabel,
        worktreeLabel: bundle.worktreeLabel,
        worktreeRealpathDigest: bundle.worktreeRealpathDigest,
        branch: bundle.branch,
        startingCommit: bundle.startingCommit,
      });
    }
    return { registration, receiptId: receipt.id, profileId: profileId! };
  });
  return {
    runtimeId: bundle.runtimeId,
    profileId: result.profileId,
    challengeId,
    receiptId: result.receiptId,
    bundleDigest: bundle.bundleDigest,
    status: result.registration.status,
  };
}

async function readBundle(path?: string): Promise<unknown> {
  const bytes = path ? await readFile(path) : await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    stdin.on("data", (chunk: Buffer) => {
      length += chunk.length;
      if (length > MAX_BUNDLE_BYTES) reject(new AntigravityProvisioningError("bundle_too_large"));
      else chunks.push(chunk);
    });
    stdin.on("end", () => resolve(Buffer.concat(chunks)));
    stdin.on("error", reject);
  });
  if (bytes.length > MAX_BUNDLE_BYTES) throw new AntigravityProvisioningError("bundle_too_large");
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { throw new AntigravityProvisioningError("invalid_bundle"); }
}

if (process.argv[1]?.endsWith("provision-antigravity-runtime.ts")) {
  const phase = process.argv[2];
  const bundlePath = process.argv.includes("--bundle") ? process.argv[process.argv.indexOf("--bundle") + 1] : undefined;
  const challengeId = process.argv.includes("--challenge-id") ? process.argv[process.argv.indexOf("--challenge-id") + 1] : undefined;
  const attemptId = process.argv.includes("--attempt-id") ? process.argv[process.argv.indexOf("--attempt-id") + 1] : undefined;
  readBundle(bundlePath).then(async (bundle) => {
    if (phase === "phase-a") return submitAntigravityChallenge(bundle, attemptId);
    if (phase === "phase-b" && challengeId) return registerAntigravityRuntime(bundle, challengeId);
    throw new AntigravityProvisioningError("usage");
  })
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => { process.stderr.write(error instanceof AntigravityProvisioningError ? `${error.message}\n` : "antigravity_provisioning_failed\n"); process.exitCode = 1; })
    .finally(() => closeDbConnections());
}
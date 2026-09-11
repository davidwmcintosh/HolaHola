/**
 * Trusted, Replit-side Gate 3 operator provisioning.
 *
 * This is deliberately a script/service rather than an HTTP handler.  Its
 * inputs are public bundle bytes only; in particular, there is no parameter
 * which can contain a bootstrap or access credential.
 */
import { readFile } from "node:fs/promises";
import { stdin } from "node:process";
import { eq } from "drizzle-orm";
import { getSharedDb } from "../db";
import {
  coordinationRuntimeProfiles,
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
import { registerCoordinationRuntimeWithBootstrapSha256InExecutor } from "../services/coordination-credential-broker";

const MAX_BUNDLE_BYTES = 1024 * 1024;

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
export async function submitAntigravityChallenge(value: unknown): Promise<{
  challengeId: string;
  taskDigest: string;
  keyFingerprint: string;
  bundleDigest: string;
  expiresAt: Date;
}> {
  const bundle = checkedBundle(value);
  try {
    const result = await createChallenge({
      taskRef: GATE3.taskRef,
      artifactSha256: bundle.artifactSha256,
      intendedActor: GATE3.actor,
      coordinationActor: GATE3.actor,
      publicKey: bundle.publicKey,
      keyFingerprint: bundle.keyFingerprint,
      contextDigest: bundle.bundleDigest,
      idempotencyKey: `antigravity:${bundle.bundleDigest}`,
      ttlMs: 20 * 60_000,
    });
    return {
      challengeId: result.challengeId,
      taskDigest: bundle.artifactSha256,
      keyFingerprint: bundle.keyFingerprint,
      bundleDigest: bundle.bundleDigest,
      expiresAt: result.expiresAt,
    };
  } catch (error) {
    if (error instanceof AntigravityProvisioningError) throw error;
    throw new AntigravityProvisioningError("challenge_failed");
  }
}

function profileMatches(row: typeof coordinationRuntimeProfiles.$inferSelect, bundle: PublicProvisioningBundle, profileId: string): boolean {
  return row.id === profileId
    && row.runtimeRegistrationId === bundle.runtimeId
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
  status: "created" | "replayed";
}> {
  const bundle = checkedBundle(value);
  if (!challengeId || challengeId.length > 200) throw new AntigravityProvisioningError("challenge_required");

  const db = getSharedDb();
  const profileId = `antigravity-${bundle.bundleDigest}`;
  const result = await db.transaction(async (tx) => {
    const registration = await registerCoordinationRuntimeWithBootstrapSha256InExecutor({
      runtimeId: bundle.runtimeId,
      actor: bundle.actor as "luca-gemini",
      displayName: bundle.worktreeLabel,
      capabilities: bundle.credentialCapabilities as ("coordination:read" | "coordination:write" | "coordination:inbox:ack" | "coordination:credential:renew")[],
      tokenTtlSeconds: bundle.tokenTtlSeconds,
      bootstrapSha256: bundle.bootstrapSha256,
    }, tx as unknown as ReturnType<typeof getSharedDb>);
    const [existing] = await tx.select().from(coordinationRuntimeProfiles)
      .where(eq(coordinationRuntimeProfiles.runtimeRegistrationId, bundle.runtimeId))
      .for("update");
    if (existing && !profileMatches(existing, bundle, profileId)) {
      throw new AntigravityProvisioningError("profile_conflict");
    }
    if (!existing) {
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
      || receipt.keyFingerprint !== bundle.keyFingerprint) {
      throw new AntigravityProvisioningError("receipt_mismatch");
    }
    return { registration, receiptId: receipt.id };
  });
  return {
    runtimeId: bundle.runtimeId,
    profileId,
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
  readBundle(bundlePath).then(async (bundle) => {
    if (phase === "phase-a") return submitAntigravityChallenge(bundle);
    if (phase === "phase-b" && challengeId) return registerAntigravityRuntime(bundle, challengeId);
    throw new AntigravityProvisioningError("usage");
  })
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => { process.stderr.write(error instanceof AntigravityProvisioningError ? `${error.message}\n` : "antigravity_provisioning_failed\n"); process.exitCode = 1; });
}
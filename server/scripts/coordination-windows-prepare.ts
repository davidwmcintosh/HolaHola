import { createHash } from "node:crypto";
import type { PreparationReservationDto } from "../services/coordination-windows-generation";
import { canonicalJson } from "../services/coordination-policy-canonicalization";

export const PUBLIC_ARTIFACT_MAX_BYTES = 512 * 1024;
export const PUBLIC_ARTIFACT_TOTAL_MAX_BYTES = 4 * 1024 * 1024;
const SECRET_SHAPE = /bearer\s+\S+|(?:cb|ct)_[A-Za-z0-9_-]{8,}|password|secret|token|ciphertext|plaintext/i;

export type LocalPreparationReservation = Pick<PreparationReservationDto,
  "id" | "sessionId" | "enrolledHostId" | "generationId" | "reservationDigest"
  | "publicMaterialDigest" | "protocolVersion">;

export type LocalPreparationStorage = {
  inspect: (path: string) => Promise<{ exists: boolean; isDirectory?: boolean; reparseFree: boolean; aclSafe: boolean }> | { exists: boolean; isDirectory?: boolean; reparseFree: boolean; aclSafe: boolean };
  mkdir: (path: string) => Promise<void> | void;
  write: (path: string, bytes: Uint8Array) => Promise<void> | void;
  read: (path: string) => Promise<Uint8Array> | Uint8Array;
  atomicReplace: (from: string, to: string) => Promise<void> | void;
  rename: (from: string, to: string) => Promise<void> | void;
  remove: (path: string) => Promise<void> | void;
};

export type LocalPreparationServer = {
  promote: (input: {
    sessionId: string; reservationId: string; generationId: string;
    publicMaterialDigest: string; safePromotionEvidenceDigest: string;
  }) => Promise<unknown>;
  acknowledge: (input: {
    sessionId: string; reservationId: string; generationId: string;
    publicMaterialDigest: string; protocolVersion: number; acknowledgementRequestKey: string;
    safePromotionEvidenceDigest: string;
  }) => Promise<unknown>;
  recover: (input: { sessionId: string; reservationId: string; generationId: string }) => Promise<unknown>;
  fail?: (input: { sessionId: string; reservationId: string; generationId: string; failureCode: string }) => Promise<unknown>;
  abandon?: (input: { sessionId: string; reservationId: string; generationId: string; abandonCode: string }) => Promise<unknown>;
};

export type LocalPreparationDependencies = {
  storage: LocalPreparationStorage;
  protect: (plaintext: Uint8Array, reservation: LocalPreparationReservation) => Promise<Uint8Array> | Uint8Array;
  server: LocalPreparationServer;
  fault?: {
    beforeWrite?: (path: string, index: number) => Promise<void> | void;
    beforeRename?: (label: "generation" | "active", from: string, to: string) => Promise<void> | void;
    beforeAcknowledge?: () => Promise<void> | void;
  };
};

export type LocalPreparationResult = {
  state: "acknowledged" | "promoted" | "failed" | "abandoned";
  generationId: string;
  activeChanged: boolean;
  recoverable: boolean;
};

function digest(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function publicDigest(artifacts: Record<string, Uint8Array>): string {
  const names = Object.keys(artifacts).sort();
  const hash = createHash("sha256");
  for (const name of names) {
    hash.update(name, "utf8");
    hash.update("\0", "utf8");
    hash.update(artifacts[name]);
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function safePathPart(value: string): boolean {
  return value.length > 0 && value.length <= 160 && value === value.trim()
    && !SECRET_SHAPE.test(value) && !value.includes("\0")
    && !value.includes("..") && !/[\\/]/.test(value);
}

function safeFailure(error: unknown): Error {
  const code = error instanceof Error ? error.name : "preparation_failure";
  return new Error(SECRET_SHAPE.test(code) ? "preparation_failed" : `preparation_${code.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 64)}`);
}

async function assertSafe(storage: LocalPreparationStorage, path: string, directory = false): Promise<void> {
  const info = await storage.inspect(path);
  if (!info.exists || (directory && info.isDirectory === false) || !info.reparseFree || !info.aclSafe) {
    throw new Error("unsafe_path");
  }
}

async function verifyWritten(storage: LocalPreparationStorage, path: string, expected: Uint8Array): Promise<void> {
  if (!storage.read) return;
  const actual = await storage.read(path);
  if (!(actual instanceof Uint8Array) || actual.byteLength !== expected.byteLength
    || digest(actual) !== digest(expected)) throw new Error("staging_digest_mismatch");
}

function reservationMatches(value: LocalPreparationReservation): void {
  if (!value.id || !value.sessionId || !value.enrolledHostId || !value.generationId
    || !/^[0-9a-f]{64}$/.test(value.reservationDigest)
    || !/^[0-9a-f]{64}$/.test(value.publicMaterialDigest)
    || value.protocolVersion !== 1) throw new Error("invalid_reservation");
}

function manifestFor(base: Record<string, unknown>, protectedDigest: string): Uint8Array {
  return new TextEncoder().encode(canonicalJson({ ...base, protectedDigest }));
}

async function verifyExistingGeneration(
  storage: LocalPreparationStorage,
  generation: string,
  manifestBase: Record<string, unknown>,
  artifacts: Record<string, Uint8Array>,
): Promise<void> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(new TextDecoder().decode(await storage.read(`${generation}/manifest.json`)));
  } catch {
    throw new Error("generation_manifest_invalid");
  }
  const expectedArtifacts = manifestBase.artifacts;
  if (parsed.protocolVersion !== manifestBase.protocolVersion
    || parsed.reservationId !== manifestBase.reservationId
    || parsed.sessionId !== manifestBase.sessionId
    || parsed.enrolledHostId !== manifestBase.enrolledHostId
    || parsed.generationId !== manifestBase.generationId
    || parsed.reservationDigest !== manifestBase.reservationDigest
    || parsed.publicMaterialDigest !== manifestBase.publicMaterialDigest
    || canonicalJson(parsed.artifacts) !== canonicalJson(expectedArtifacts)
    || typeof parsed.protectedDigest !== "string"
    || !/^[0-9a-f]{64}$/.test(parsed.protectedDigest)) {
    throw new Error("generation_manifest_conflict");
  }
  const protectedBytes = await storage.read(`${generation}/protected.bin`);
  if (digest(protectedBytes) !== parsed.protectedDigest) throw new Error("protected_material_integrity");
  for (const [name, bytes] of Object.entries(artifacts)) {
    await verifyWritten(storage, `${generation}/${name}`, bytes);
  }
}

/**
 * Atomic local half of M8. It receives no paths or commands from the host:
 * root and every filesystem operation are coordinator-owned capabilities.
 */
export async function prepareCoordinationWindowsGeneration(input: {
  reservation: LocalPreparationReservation;
  root: string;
  activePointer: string;
  publicArtifacts: Record<string, Uint8Array | string>;
  secretPlaintext: Uint8Array | string;
  dependencies: LocalPreparationDependencies;
  acknowledgementRequestKey: string;
  safePromotionEvidenceDigest: string;
}): Promise<LocalPreparationResult> {
  const { reservation, dependencies } = input;
  reservationMatches(reservation);
  if (!input.root || !input.activePointer || !safePathPart(reservation.generationId)
    || !/^[0-9a-f]{64}$/.test(input.safePromotionEvidenceDigest)
    || !safePathPart(input.acknowledgementRequestKey)) throw new Error("invalid_preparation_input");
  if (!(input.activePointer === input.root || input.activePointer.startsWith(`${input.root}/`))) {
    throw new Error("active_pointer_path_escape");
  }
  const artifacts: Record<string, Uint8Array> = {};
  let total = 0;
  if (Object.keys(input.publicArtifacts).length > 128) throw new Error("too_many_public_artifacts");
  for (const [name, value] of Object.entries(input.publicArtifacts)) {
    if (!safePathPart(name)) throw new Error("invalid_artifact_name");
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > PUBLIC_ARTIFACT_MAX_BYTES) throw new Error("public_artifact_too_large");
    total += bytes.byteLength;
    if (total > PUBLIC_ARTIFACT_TOTAL_MAX_BYTES) throw new Error("public_material_too_large");
    artifacts[name] = bytes;
  }
  if (publicDigest(artifacts) !== reservation.publicMaterialDigest) throw new Error("public_material_digest_mismatch");
  const storage = dependencies.storage;
  const staging = `${input.root}/.staging-${reservation.generationId}`;
  const generation = `${input.root}/${reservation.generationId}`;
  const activeTemp = `${input.activePointer}.${reservation.generationId}.tmp`;
  const manifestBase = {
    protocolVersion: reservation.protocolVersion,
    reservationId: reservation.id,
    sessionId: reservation.sessionId,
    enrolledHostId: reservation.enrolledHostId,
    generationId: reservation.generationId,
    reservationDigest: reservation.reservationDigest,
    publicMaterialDigest: reservation.publicMaterialDigest,
    artifacts: Object.fromEntries(Object.entries(artifacts).sort().map(([name, bytes]) => [name, {
      bytes: bytes.byteLength, digest: digest(bytes),
    }])),
  };
  let promoted = false;
  let activeChanged = false;
  let createdStaging = false;
  let createdActiveTemp = false;
  let protectedBytes: Uint8Array | undefined;
  const ownedPlaintext = typeof input.secretPlaintext === "string"
    ? new TextEncoder().encode(input.secretPlaintext) : input.secretPlaintext;
  let writeIndex = 0;
  try {
    await assertSafe(storage, input.root, true);
    const activeInfo = await storage.inspect(input.activePointer);
    if (activeInfo.exists && (!activeInfo.reparseFree || !activeInfo.aclSafe)) throw new Error("unsafe_active_pointer");
    const existing = await storage.inspect(staging);
    if (existing.exists) throw new Error("staging_exists");
    const existingGeneration = await storage.inspect(generation);
    if (existingGeneration.exists) {
      if (!existingGeneration.isDirectory || !existingGeneration.reparseFree || !existingGeneration.aclSafe
        ) throw new Error("generation_exists");
      await verifyExistingGeneration(storage, generation, manifestBase, artifacts);
      await assertSafe(storage, `${generation}/protected.bin`);
      promoted = true;
    } else {
      await storage.mkdir(staging);
      createdStaging = true;
      for (const [name, bytes] of Object.entries(artifacts)) {
        await dependencies.fault?.beforeWrite?.(name, writeIndex++);
        await storage.write(`${staging}/${name}`, bytes);
        await verifyWritten(storage, `${staging}/${name}`, bytes);
      }
      protectedBytes = await dependencies.protect(ownedPlaintext, reservation);
      if (!(protectedBytes instanceof Uint8Array) || protectedBytes.byteLength === 0
        || protectedBytes.byteLength > PUBLIC_ARTIFACT_MAX_BYTES) throw new Error("protected_material_invalid");
      await dependencies.fault?.beforeWrite?.("protected.bin", writeIndex++);
      await storage.write(`${staging}/protected.bin`, protectedBytes);
      await verifyWritten(storage, `${staging}/protected.bin`, protectedBytes);
      const manifest = manifestFor(manifestBase, digest(protectedBytes));
      await dependencies.fault?.beforeWrite?.("manifest.json", writeIndex++);
      await storage.write(`${staging}/manifest.json`, manifest);
      await verifyWritten(storage, `${staging}/manifest.json`, manifest);
      await assertSafe(storage, staging, true);
      for (const name of [...Object.keys(artifacts), "manifest.json", "protected.bin"]) {
        await assertSafe(storage, `${staging}/${name}`);
      }
      await dependencies.fault?.beforeRename?.("generation", staging, generation);
      await storage.rename(staging, generation);
      createdStaging = false;
      promoted = true;
    }
    await dependencies.fault?.beforeWrite?.("active-pointer", writeIndex++);
    createdActiveTemp = true;
    await storage.write(activeTemp, new TextEncoder().encode(reservation.generationId));
    await verifyWritten(storage, activeTemp, new TextEncoder().encode(reservation.generationId));
    await dependencies.fault?.beforeRename?.("active", activeTemp, input.activePointer);
    await storage.atomicReplace(activeTemp, input.activePointer);
    activeChanged = true;
    try {
      await dependencies.server.promote({
        sessionId: reservation.sessionId, reservationId: reservation.id, generationId: reservation.generationId,
        publicMaterialDigest: reservation.publicMaterialDigest,
        safePromotionEvidenceDigest: input.safePromotionEvidenceDigest,
      });
    } catch {
      // Promotion may have committed even when its response was lost. Query
      // the exact reservation/generation before attempting acknowledgement.
      const recovered = await dependencies.server.recover({
        sessionId: reservation.sessionId, reservationId: reservation.id, generationId: reservation.generationId,
      });
      if ((recovered as { state?: string })?.state !== "promoted"
        && (recovered as { state?: string })?.state !== "acknowledged") {
        return { state: "promoted", generationId: reservation.generationId, activeChanged, recoverable: true };
      }
      if ((recovered as { state?: string })?.state === "acknowledged") {
        return { state: "acknowledged", generationId: reservation.generationId, activeChanged, recoverable: false };
      }
    }
    try {
      await dependencies.fault?.beforeAcknowledge?.();
      await dependencies.server.acknowledge({
        sessionId: reservation.sessionId, reservationId: reservation.id,
        generationId: reservation.generationId, publicMaterialDigest: reservation.publicMaterialDigest,
        protocolVersion: reservation.protocolVersion, acknowledgementRequestKey: input.acknowledgementRequestKey,
        safePromotionEvidenceDigest: input.safePromotionEvidenceDigest,
      });
    } catch {
      // An acknowledgement can be lost after durable promotion. Querying the
      // exact pair is the only legal recovery; never mint another generation.
      const recovered = await dependencies.server.recover({
        sessionId: reservation.sessionId, reservationId: reservation.id, generationId: reservation.generationId,
      });
      if ((recovered as { state?: string })?.state !== "acknowledged") {
        try {
          await dependencies.server.acknowledge({
            sessionId: reservation.sessionId, reservationId: reservation.id,
            generationId: reservation.generationId, publicMaterialDigest: reservation.publicMaterialDigest,
            protocolVersion: reservation.protocolVersion, acknowledgementRequestKey: input.acknowledgementRequestKey,
            safePromotionEvidenceDigest: input.safePromotionEvidenceDigest,
          });
        } catch {
          return { state: "promoted", generationId: reservation.generationId, activeChanged, recoverable: true };
        }
      }
    }
    return { state: "acknowledged", generationId: reservation.generationId, activeChanged, recoverable: false };
  } catch (error) {
    if (!promoted) {
      if (createdStaging) await Promise.resolve(storage.remove(staging)).catch(() => undefined);
      await Promise.resolve(dependencies.server.fail?.({
        sessionId: reservation.sessionId, reservationId: reservation.id,
        generationId: reservation.generationId, failureCode: "local_pre_promotion_failure",
      })).catch(() => undefined);
      throw safeFailure(error);
    }
    return { state: "promoted", generationId: reservation.generationId, activeChanged, recoverable: true };
  } finally {
    // The secret and opaque result are not returned, logged, or placed in
    // evidence. The protector owns any additional memory hygiene it needs.
    ownedPlaintext.fill(0);
    protectedBytes?.fill(0);
    if (createdActiveTemp) await Promise.resolve(storage.remove(activeTemp)).catch(() => undefined);
  }
}

export function computeCoordinationPublicMaterialDigest(artifacts: Record<string, Uint8Array | string>): string {
  const normalized = Object.fromEntries(Object.entries(artifacts).map(([name, value]) => [
    name, typeof value === "string" ? new TextEncoder().encode(value) : value,
  ]));
  return publicDigest(normalized);
}

export const prepareCoordinationWindows = prepareCoordinationWindowsGeneration;

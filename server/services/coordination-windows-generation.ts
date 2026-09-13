import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  coordinationV2PreparationReservations,
  coordinationV2SessionEvents,
  coordinationV2Sessions,
  type CoordinationV2PreparationReservation,
} from "@shared/schema";
import { canonicalJson } from "./coordination-policy-canonicalization";
import {
  authorizeCoordinationLifecycleInTransaction,
  CoordinationLifecycleAuthorizationError,
} from "./coordination-lifecycle-authorization";

export const COORDINATION_PREPARATION_PROTOCOL_VERSION = 1 as const;
const DIGEST = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/;
const PREPARATION_RESERVATION_DURATION_MS = 15 * 60_000;
// Fixed M8 enrollment capabilities; M9 transport capabilities are not accepted
// or activated by this reservation service.
const M8_REQUIRED_HOST_CAPABILITIES = ["preflight", "prepare"] as const;
const SECRET_SHAPED = /(?:secret|password|token|ciphertext|plaintext|bearer|private[_-]?key)/i;
// Approved canonical policy hostConstraints keys for M8 are
// windowsRepositoryBranch and windowsPublicMaterialDigest. These are scalar,
// server-owned values; they are deliberately not top-level policy fields.

export type PreparationReservationState =
  | "reserved" | "promoted" | "acknowledged" | "failed" | "expired" | "abandoned";

export type PreparationReservationDto = {
  id: string;
  sessionId: string;
  enrolledHostId: string;
  generationId: string;
  reservationDigest: string;
  publicMaterialDigest: string;
  protocolVersion: number;
  repositoryIdentity: string;
  branch: string;
  startingCommit: string;
  state: PreparationReservationState;
  reserveRequestKey: string;
  reserveCommandDigest: string;
  acknowledgementRequestKey: string | null;
  ackCommandDigest: string | null;
  safePromotionEvidenceDigest: string | null;
  createdAt: string;
  expiresAt: string;
  promotedAt: string | null;
  acknowledgedAt: string | null;
  expiredAt: string | null;
  failedAt: string | null;
  abandonedAt: string | null;
  failureCode: string | null;
  abandonCode: string | null;
};

export type PreparationGenerationErrorCode =
  | "PREPARATION_INVALID_REQUEST" | "PREPARATION_NOT_FOUND"
  | "PREPARATION_CONFLICT" | "PREPARATION_REPLAY_CONFLICT"
  | "PREPARATION_AUTHORIZATION_DENIED" | "PREPARATION_EXPIRED"
  | "PREPARATION_INVALID_TRANSITION" | "PREPARATION_DATABASE_UNAVAILABLE";

export class CoordinationPreparationError extends Error {
  readonly code: PreparationGenerationErrorCode;
  constructor(code: PreparationGenerationErrorCode) {
    super(code);
    this.name = "CoordinationPreparationError";
    this.code = code;
  }
}

function fail(code: PreparationGenerationErrorCode): never {
  throw new CoordinationPreparationError(code);
}

function text(value: unknown, field: string, max = 128): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max
    || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    fail("PREPARATION_INVALID_REQUEST");
  }
  return value as string;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function sha(value: unknown): string {
  if (typeof value !== "string" || !DIGEST.test(value)) fail("PREPARATION_INVALID_REQUEST");
  return value as string;
}

function postgresCode(error: unknown): string | undefined {
  let current = error as { code?: unknown; cause?: unknown } | undefined;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (typeof current.code === "string") return current.code;
    current = current.cause as { code?: unknown; cause?: unknown } | undefined;
  }
  return undefined;
}

function dto(row: CoordinationV2PreparationReservation): PreparationReservationDto {
  const iso = (value: Date | null): string | null => value?.toISOString() ?? null;
  return {
    id: row.id, sessionId: row.sessionId, enrolledHostId: row.enrolledHostId,
    generationId: row.generationId, reservationDigest: row.reservationDigest,
    publicMaterialDigest: row.publicMaterialDigest, protocolVersion: row.protocolVersion,
    repositoryIdentity: row.repositoryIdentity, branch: row.branch,
    startingCommit: row.startingCommit, state: row.state as PreparationReservationState,
    reserveRequestKey: row.reserveRequestKey, reserveCommandDigest: row.reserveCommandDigest,
    acknowledgementRequestKey: row.acknowledgementRequestKey, ackCommandDigest: row.ackCommandDigest,
    safePromotionEvidenceDigest: row.safePromotionEvidenceDigest,
    createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
    promotedAt: iso(row.promotedAt), acknowledgedAt: iso(row.acknowledgedAt),
    expiredAt: iso(row.expiredAt),
    failedAt: iso(row.failedAt), abandonedAt: iso(row.abandonedAt),
    failureCode: row.failureCode, abandonCode: row.abandonCode,
  };
}

async function databaseNow(tx: any): Promise<Date> {
  const result = await tx.execute(sql`SELECT clock_timestamp() AS now`);
  const row = (result as any).rows?.[0] ?? (result as any)[0];
  const now = row?.now instanceof Date ? row.now : new Date(row?.now);
  if (!Number.isFinite(now.getTime())) fail("PREPARATION_DATABASE_UNAVAILABLE");
  return now;
}

async function appendEvent(tx: any, row: CoordinationV2PreparationReservation, requestKey: string,
  eventType: string, actorId: string, now: Date, sessionState: string,
  metadata: Record<string, unknown> = {}) {
  const prior = await tx.select({ sequence: coordinationV2SessionEvents.sequence })
    .from(coordinationV2SessionEvents)
    .where(eq(coordinationV2SessionEvents.sessionId, row.sessionId))
    .orderBy(desc(coordinationV2SessionEvents.sequence)).limit(1);
  await tx.insert(coordinationV2SessionEvents).values({
    id: randomUUID(), sessionId: row.sessionId, sequence: (prior[0]?.sequence ?? 0) + 1,
    // Preparation is side-band evidence. The session reducer remains the
    // authority, so both state columns preserve its locked state.
    fromState: sessionState, toState: sessionState, eventType, actorType: "operator",
    actorId, requestKey, metadata: { protocolVersion: 1, generationId: row.generationId, ...metadata },
    createdAt: now,
  });
}

async function authorize(tx: any, input: { sessionId: string; actorId: string; action: "launch" | "terminate" | "status" },
  now: Date, allowExpired = false) {
  try {
    return await authorizeCoordinationLifecycleInTransaction(tx, {
      sessionId: text(input.sessionId, "sessionId"), actorId: text(input.actorId, "actorId"),
      action: input.action, now, allowExpired,
    });
  } catch (error) {
    if (error instanceof CoordinationLifecycleAuthorizationError) {
      if (error.code === "LIFECYCLE_SESSION_NOT_FOUND") fail("PREPARATION_NOT_FOUND");
      if (error.code === "LIFECYCLE_SESSION_EXPIRED") fail("PREPARATION_EXPIRED");
      fail("PREPARATION_AUTHORIZATION_DENIED");
    }
    throw error;
  }
}

function reserveDigest(input: {
  sessionId: string; enrolledHostId: string; generationId: string; publicMaterialDigest: string;
  protocolVersion: number; repositoryIdentity: string; branch: string; startingCommit: string;
  reserveRequestKey: string;
}) {
  return digest(input);
}

export type ReservePreparationInput = {
  sessionId: string;
  actorId: string;
  reserveRequestKey: string;
};

export async function reserveCoordinationWindowsPreparation(input: ReservePreparationInput): Promise<PreparationReservationDto> {
  const reserveRequestKey = text(input.reserveRequestKey, "reserveRequestKey");
  for (let collisionAttempt = 0; collisionAttempt < 2; collisionAttempt += 1) {
    try {
      return await db.transaction(async (tx) => {
      const now = await databaseNow(tx);
      const { session, host, version } = await authorize(tx, {
        sessionId: input.sessionId, actorId: input.actorId, action: "launch",
      }, now);
      if (host.hostType.toLowerCase() !== "windows" || host.protocolVersion !== 1
        || host.status !== "active"
        || !M8_REQUIRED_HOST_CAPABILITIES.every((capability) => host.capabilities.includes(capability))) {
        fail("PREPARATION_AUTHORIZATION_DENIED");
      }
      const policy = version.canonicalPolicy as Record<string, unknown>;
      const constraints = policy.hostConstraints;
      if (!constraints || typeof constraints !== "object" || Array.isArray(constraints)) {
        fail("PREPARATION_AUTHORIZATION_DENIED");
      }
      const hostConstraints = constraints as Record<string, unknown>;
      const branch = hostConstraints.windowsRepositoryBranch;
      const publicMaterialDigest = hostConstraints.windowsPublicMaterialDigest;
      if (typeof branch !== "string" || branch.length === 0 || branch.length > 255
        || branch.trim() !== branch || SECRET_SHAPED.test(branch)
        || typeof publicMaterialDigest !== "string" || !DIGEST.test(publicMaterialDigest)
        || SECRET_SHAPED.test(publicMaterialDigest)) {
        fail("PREPARATION_AUTHORIZATION_DENIED");
      }
      const remainingMs = session.expiresAt.getTime() - now.getTime();
      if (remainingMs <= 0) fail("PREPARATION_EXPIRED");
      const effectiveDurationMs = Math.min(PREPARATION_RESERVATION_DURATION_MS, remainingMs);
      const commandDigest = digest({
        sessionId: session.id, enrolledHostId: host.id, branch, publicMaterialDigest,
        protocolVersion: COORDINATION_PREPARATION_PROTOCOL_VERSION, reserveRequestKey,
        durationMs: PREPARATION_RESERVATION_DURATION_MS,
      });
      const priorRows = await tx.select().from(coordinationV2PreparationReservations)
        .where(and(eq(coordinationV2PreparationReservations.sessionId, session.id),
          eq(coordinationV2PreparationReservations.reserveRequestKey, reserveRequestKey))).for("update");
      const prior = priorRows[0] as CoordinationV2PreparationReservation | undefined;
      if (prior) {
        if (prior.reserveCommandDigest !== commandDigest) fail("PREPARATION_REPLAY_CONFLICT");
        return dto(prior);
      }
      const generationId = randomUUID();
      const reservationDigest = reserveDigest({
        sessionId: session.id, enrolledHostId: host.id, generationId, publicMaterialDigest,
        protocolVersion: COORDINATION_PREPARATION_PROTOCOL_VERSION,
        repositoryIdentity: session.repositoryIdentity, branch, startingCommit: session.startingCommit,
        reserveRequestKey,
      });
      const inserted = await tx.insert(coordinationV2PreparationReservations).values({
        id: randomUUID(), sessionId: session.id, enrolledHostId: host.id, generationId,
        reservationDigest, publicMaterialDigest,
        protocolVersion: COORDINATION_PREPARATION_PROTOCOL_VERSION,
        repositoryIdentity: session.repositoryIdentity, branch, startingCommit: session.startingCommit,
        state: "reserved", reserveRequestKey, reserveCommandDigest: commandDigest,
        createdAt: now, expiresAt: new Date(now.getTime() + effectiveDurationMs),
      }).returning();
      const row = inserted[0] as CoordinationV2PreparationReservation;
      await appendEvent(tx, row, reserveRequestKey, "preparation_reserved", input.actorId, now, session.state, {
        reservationDigest, publicMaterialDigest,
      });
      return dto(row);
      });
    } catch (error) {
      if (error instanceof CoordinationPreparationError) throw error;
      const code = postgresCode(error);
      if (code === "23505" && collisionAttempt === 0) continue;
      if (code === "23505") fail("PREPARATION_CONFLICT");
      if (code === "23514") fail("PREPARATION_INVALID_TRANSITION");
      if (code === "40001" || code === "40P01") fail("PREPARATION_CONFLICT");
      return fail("PREPARATION_DATABASE_UNAVAILABLE");
    }
  }
  return fail("PREPARATION_CONFLICT");
}

export async function readCoordinationWindowsPreparation(input: {
  sessionId: string; actorId: string; reservationId?: string; generationId?: string;
}): Promise<PreparationReservationDto | null> {
  try {
    return await db.transaction(async (tx) => {
      const now = await databaseNow(tx);
      await authorize(tx, { sessionId: input.sessionId, actorId: input.actorId, action: "status" }, now, true);
      const clauses = [eq(coordinationV2PreparationReservations.sessionId, input.sessionId)];
      if (input.reservationId) clauses.push(eq(coordinationV2PreparationReservations.id, text(input.reservationId, "reservationId")));
      if (input.generationId) clauses.push(eq(coordinationV2PreparationReservations.generationId, text(input.generationId, "generationId")));
      const rows = await tx.select().from(coordinationV2PreparationReservations).where(and(...clauses));
      return rows[0] ? dto(rows[0] as CoordinationV2PreparationReservation) : null;
    });
  } catch (error) {
    if (error instanceof CoordinationPreparationError) throw error;
    return fail("PREPARATION_DATABASE_UNAVAILABLE");
  }
}

export async function recoverCoordinationWindowsPreparation(input: {
  sessionId: string; actorId: string; reservationId: string; generationId: string;
}): Promise<PreparationReservationDto> {
  try {
    return await db.transaction(async (tx) => {
      const now = await databaseNow(tx);
      const { session } = await authorize(tx, { sessionId: input.sessionId, actorId: input.actorId, action: "status" }, now, true);
      const rows = await tx.select().from(coordinationV2PreparationReservations)
        .where(and(eq(coordinationV2PreparationReservations.id, text(input.reservationId, "reservationId")),
          eq(coordinationV2PreparationReservations.sessionId, session.id),
          eq(coordinationV2PreparationReservations.generationId, text(input.generationId, "generationId")))).for("update");
      const row = rows[0] as CoordinationV2PreparationReservation | undefined;
      if (!row) return fail("PREPARATION_NOT_FOUND");
      if (row.state === "reserved" && row.expiresAt <= now) {
        const updated = await tx.update(coordinationV2PreparationReservations).set({
          state: "expired", expiredAt: now, failedAt: null,
        }).where(eq(coordinationV2PreparationReservations.id, row.id)).returning();
        await appendEvent(tx, updated[0], `preparation-expire:${row.id}`, "preparation_expired", input.actorId, now, session.state);
        return dto(updated[0]);
      }
      return dto(row);
    });
  } catch (error) {
    if (error instanceof CoordinationPreparationError) throw error;
    return fail("PREPARATION_DATABASE_UNAVAILABLE");
  }
}

export type AcknowledgePreparationInput = {
  sessionId: string; actorId: string; reservationId: string; generationId: string;
  publicMaterialDigest: string; protocolVersion: number; acknowledgementRequestKey: string;
  safePromotionEvidenceDigest: string;
};

export async function promoteCoordinationWindowsPreparation(input: {
  sessionId: string; actorId: string; reservationId: string; generationId: string;
  publicMaterialDigest: string; safePromotionEvidenceDigest: string;
}): Promise<PreparationReservationDto> {
  const publicMaterialDigest = sha(input.publicMaterialDigest);
  const evidence = sha(input.safePromotionEvidenceDigest);
  try {
    return await db.transaction(async (tx) => {
      const now = await databaseNow(tx);
      const { session, host } = await authorize(tx, {
        sessionId: input.sessionId, actorId: input.actorId, action: "launch",
      }, now, true);
      const rows = await tx.select().from(coordinationV2PreparationReservations)
        .where(and(eq(coordinationV2PreparationReservations.id, text(input.reservationId, "reservationId")),
          eq(coordinationV2PreparationReservations.sessionId, session.id))).for("update");
      const row = rows[0] as CoordinationV2PreparationReservation | undefined;
      if (!row || row.enrolledHostId !== host.id || row.generationId !== text(input.generationId, "generationId")
        || row.publicMaterialDigest !== publicMaterialDigest) fail("PREPARATION_CONFLICT");
      if (row.state === "promoted" || row.state === "acknowledged") {
        if (row.safePromotionEvidenceDigest !== evidence) fail("PREPARATION_REPLAY_CONFLICT");
        return dto(row);
      }
      if (row.state !== "reserved") fail("PREPARATION_INVALID_TRANSITION");
      if (row.expiresAt <= now) fail("PREPARATION_EXPIRED");
      const updated = await tx.update(coordinationV2PreparationReservations).set({
        state: "promoted", promotedAt: now, safePromotionEvidenceDigest: evidence,
      }).where(eq(coordinationV2PreparationReservations.id, row.id)).returning();
      await appendEvent(tx, updated[0], `promotion:${row.id}`, "preparation_promoted", input.actorId, now, session.state, {
        safePromotionEvidenceDigest: evidence,
      });
      return dto(updated[0]);
    });
  } catch (error) {
    if (error instanceof CoordinationPreparationError) throw error;
    if ((error as { code?: string }).code === "23514") fail("PREPARATION_INVALID_TRANSITION");
    return fail("PREPARATION_DATABASE_UNAVAILABLE");
  }
}

export async function acknowledgeCoordinationWindowsPreparation(input: AcknowledgePreparationInput): Promise<PreparationReservationDto> {
  const acknowledgementRequestKey = text(input.acknowledgementRequestKey, "acknowledgementRequestKey");
  const publicMaterialDigest = sha(input.publicMaterialDigest);
  const evidence = sha(input.safePromotionEvidenceDigest);
  if (input.protocolVersion !== 1) fail("PREPARATION_INVALID_REQUEST");
  try {
    return await db.transaction(async (tx) => {
      const now = await databaseNow(tx);
      const { session, host } = await authorize(tx, {
        sessionId: input.sessionId, actorId: input.actorId, action: "launch",
      }, now, true);
      const rows = await tx.select().from(coordinationV2PreparationReservations)
        .where(and(eq(coordinationV2PreparationReservations.id, text(input.reservationId, "reservationId")),
          eq(coordinationV2PreparationReservations.sessionId, session.id))).for("update");
      const row = rows[0] as CoordinationV2PreparationReservation | undefined;
      if (!row || row.enrolledHostId !== host.id || row.generationId !== text(input.generationId, "generationId")
        || row.publicMaterialDigest !== publicMaterialDigest || row.protocolVersion !== input.protocolVersion) {
        fail("PREPARATION_CONFLICT");
      }
      const commandDigest = digest({
        reservationId: row.id, generationId: row.generationId, sessionId: session.id,
        enrolledHostId: host.id, publicMaterialDigest, protocolVersion: input.protocolVersion,
        acknowledgementRequestKey, safePromotionEvidenceDigest: evidence,
      });
      if (row.state === "acknowledged") {
        if (row.acknowledgementRequestKey !== acknowledgementRequestKey || row.ackCommandDigest !== commandDigest) {
          fail("PREPARATION_REPLAY_CONFLICT");
        }
        return dto(row);
      }
      if (row.state !== "promoted") fail(row.state === "reserved" ? "PREPARATION_INVALID_TRANSITION" : "PREPARATION_CONFLICT");
      const updated = await tx.update(coordinationV2PreparationReservations).set({
        state: "acknowledged", acknowledgementRequestKey, ackCommandDigest: commandDigest,
        acknowledgedAt: now,
      }).where(eq(coordinationV2PreparationReservations.id, row.id)).returning();
      await appendEvent(tx, updated[0], acknowledgementRequestKey, "preparation_acknowledged", input.actorId, now, session.state, {
        safePromotionEvidenceDigest: evidence,
      });
      return dto(updated[0]);
    });
  } catch (error) {
    if (error instanceof CoordinationPreparationError) throw error;
    if ((error as { code?: string }).code === "23514") fail("PREPARATION_INVALID_TRANSITION");
    return fail("PREPARATION_DATABASE_UNAVAILABLE");
  }
}

export async function reportCoordinationWindowsAbandoned(input: {
  sessionId: string; actorId: string; reservationId: string; generationId: string; abandonCode: string;
}): Promise<PreparationReservationDto> {
  return endPreparation("abandoned", input);
}

export async function failCoordinationWindowsPreparation(input: {
  sessionId: string; actorId: string; reservationId: string; generationId: string; failureCode: string;
}): Promise<PreparationReservationDto> {
  return endPreparation("failed", input);
}

async function endPreparation(state: "failed" | "abandoned", input: {
  sessionId: string; actorId: string; reservationId: string; generationId: string;
  failureCode?: string; abandonCode?: string;
}): Promise<PreparationReservationDto> {
  const code = text(state === "failed" ? input.failureCode : input.abandonCode, "code", 128);
  try {
    return await db.transaction(async (tx) => {
      const now = await databaseNow(tx);
      const { session } = await authorize(tx, { sessionId: input.sessionId, actorId: input.actorId, action: "terminate" }, now, true);
      const rows = await tx.select().from(coordinationV2PreparationReservations)
        .where(and(eq(coordinationV2PreparationReservations.id, text(input.reservationId, "reservationId")),
          eq(coordinationV2PreparationReservations.sessionId, session.id),
          eq(coordinationV2PreparationReservations.generationId, text(input.generationId, "generationId")))).for("update");
      const row = rows[0] as CoordinationV2PreparationReservation | undefined;
      if (!row) return fail("PREPARATION_NOT_FOUND");
      if (!["reserved", "promoted"].includes(row.state)) fail("PREPARATION_INVALID_TRANSITION");
      const updated = await tx.update(coordinationV2PreparationReservations).set({
        state, ...(state === "failed" ? { failureCode: code, failedAt: now } : { abandonCode: code, abandonedAt: now }),
      }).where(eq(coordinationV2PreparationReservations.id, row.id)).returning();
      await appendEvent(tx, updated[0], `${state}:${row.id}`, `preparation_${state}`, input.actorId, now, session.state, { code });
      return dto(updated[0]);
    });
  } catch (error) {
    if (error instanceof CoordinationPreparationError) throw error;
    if ((error as { code?: string }).code === "23514") fail("PREPARATION_INVALID_TRANSITION");
    return fail("PREPARATION_DATABASE_UNAVAILABLE");
  }
}

/**
 * Local preparation intentionally uses this pure helper rather than importing
 * database code.  It is also the single canonical digest operation used by
 * injected hermetic test repositories.
 */
export function coordinationPreparationDigest(value: unknown): string {
  return digest(value);
}

// Descriptive aliases keep the public service vocabulary aligned with the
// milestone language while retaining the preparation-specific names above.
export const reserveCoordinationWindowsGeneration = reserveCoordinationWindowsPreparation;
export const readCoordinationWindowsReservation = readCoordinationWindowsPreparation;
export const recoverCoordinationWindowsGeneration = recoverCoordinationWindowsPreparation;
export const acknowledgeCoordinationWindowsGeneration = acknowledgeCoordinationWindowsPreparation;
export const reportAbandonedCoordinationWindowsGeneration = reportCoordinationWindowsAbandoned;
export const failCoordinationWindowsGeneration = failCoordinationWindowsPreparation;

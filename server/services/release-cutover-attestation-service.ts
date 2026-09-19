import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  COORDINATION_ACTOR_IDS,
  releaseCutoverAttestations,
  type CoordinationActorId,
  type ReleaseCutoverAttestationTarget,
} from '@shared/schema';
import { parseReleaseIdentity, type ReleaseIdentity } from './release-identity';
// See docs/superpowers/specs/2026-09-17-release-cutover-attestation-design.md.
//
// Render's autoDeploy republishes on every push to `main`, so `/health/release`
// always answers "what is live right now" -- a value that keeps moving on its
// own schedule. This service captures a one-time, cross-host consensus
// snapshot and stores it as a bounded-TTL attestation that decision and
// cutover code reads instead of re-querying live evidence mid-decision.
const MAX_RELEASE_HEALTH_BYTES = 64 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const MAX_FETCH_TIMEOUT_MS = 30_000;
export const DEFAULT_ATTESTATION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const MAX_ATTESTATION_TTL_MS = 24 * 60 * 60 * 1000; // hard ceiling, matches DB check constraint
const MIN_TARGETS = 1;
const MAX_TARGETS = 8;
const MAX_DECISION_REF_LENGTH = 128;
const MAX_REASON_LENGTH = 4000;
const MAX_ACTION_LABEL_LENGTH = 256;
const DECISION_REF_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
export interface ReleaseCutoverAttestationTargetConfig {
  label: string;
  url: string;
}
// Operator-pinned production endpoints. Never sourced from an environment
// variable, request body, or database row -- this is the SSRF boundary for
// this service. The only way to check a different set is direct constructor
// dependency injection from a test file.
export const DEFAULT_RELEASE_CUTOVER_TARGETS: readonly ReleaseCutoverAttestationTargetConfig[] = [
  { label: 'getholahola.com', url: 'https://getholahola.com/health/release' },
  { label: 'render.getholahola.com', url: 'https://render.getholahola.com/health/release' },
  { label: 'holahola-6f1o.onrender.com', url: 'https://holahola-6f1o.onrender.com/health/release' },
];
function assertPinnedTarget(target: ReleaseCutoverAttestationTargetConfig): void {
  if (!target.label || typeof target.label !== 'string' || target.label.length > 128) {
    throw new Error('release_cutover_target_label_invalid');
  }
  const url = new URL(target.url);
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.search
    || url.hash
    || url.pathname !== '/health/release'
  ) {
    throw new Error(`release_cutover_target_invalid:${target.label}`);
  }
}
export class ReleaseCutoverAttestationInputError extends Error {}
export class ReleaseCutoverAttestationConflictError extends Error {}
export class ReleaseCutoverAttestationNotFoundError extends Error {}
export class ReleaseCutoverAttestationDisagreementError extends Error {
  constructor(message: string, public readonly evidence: unknown) {
    super(message);
  }
}
export interface ReleaseCutoverAttestationRow {
  id: string;
  decisionRef: string;
  capturedByActorId: string;
  targets: ReleaseCutoverAttestationTarget[];
  commitSha: string;
  sourceContextSha256: string;
  reason: string;
  capturedAt: Date;
  expiresAt: Date;
  state: 'active' | 'invalidated' | 'consumed';
  invalidatedAt: Date | null;
  invalidatedByActorId: string | null;
  invalidationReason: string | null;
  consumedAt: Date | null;
  consumedByActorId: string | null;
  consumedForAction: string | null;
}
export interface ActiveAttestationView extends ReleaseCutoverAttestationRow {
  expired: boolean;
}
export interface AttestInput {
  actor: string;
  decisionRef: string;
  reason: string;
  ttlMs?: number;
}
type DbClient = typeof db;
type FetchImpl = typeof fetch;
function validateActor(actor: string): CoordinationActorId {
  if (!(COORDINATION_ACTOR_IDS as readonly string[]).includes(actor)) {
    throw new ReleaseCutoverAttestationInputError(`Unknown coordination actor: ${actor}`);
  }
  return actor as CoordinationActorId;
}
function validateDecisionRef(decisionRef: string): string {
  if (typeof decisionRef !== 'string' || !DECISION_REF_PATTERN.test(decisionRef)) {
    throw new ReleaseCutoverAttestationInputError(
      `decisionRef must be 1-${MAX_DECISION_REF_LENGTH} characters of [A-Za-z0-9._:-]`,
    );
  }
  return decisionRef;
}
function validateReason(reason: string): string {
  if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > MAX_REASON_LENGTH) {
    throw new ReleaseCutoverAttestationInputError(
      `reason must be non-blank and at most ${MAX_REASON_LENGTH} characters`,
    );
  }
  return reason;
}
function validateActionLabel(action: string): string {
  if (typeof action !== 'string' || action.trim().length === 0 || action.length > MAX_ACTION_LABEL_LENGTH) {
    throw new ReleaseCutoverAttestationInputError(
      `action must be non-blank and at most ${MAX_ACTION_LABEL_LENGTH} characters`,
    );
  }
  return action;
}
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && typeof error === 'object' && (error as { code?: string }).code === '23505';
}
function toRow(record: typeof releaseCutoverAttestations.$inferSelect): ReleaseCutoverAttestationRow {
  return {
    id: record.id,
    decisionRef: record.decisionRef,
    capturedByActorId: record.capturedByActorId,
    targets: record.targets,
    commitSha: record.commitSha,
    sourceContextSha256: record.sourceContextSha256,
    reason: record.reason,
    capturedAt: record.capturedAt,
    expiresAt: record.expiresAt,
    state: record.state as ReleaseCutoverAttestationRow['state'],
    invalidatedAt: record.invalidatedAt,
    invalidatedByActorId: record.invalidatedByActorId,
    invalidationReason: record.invalidationReason,
    consumedAt: record.consumedAt,
    consumedByActorId: record.consumedByActorId,
    consumedForAction: record.consumedForAction,
  };
}
/**
 * Captures, verifies, and consumes release cutover attestations: an explicit
 * record of what every independently checked release endpoint agreed the
 * live commit was, at the moment someone captured it, for one specific
 * cutover decision.
 */
export class ReleaseCutoverAttestationService {
  private readonly targets: readonly ReleaseCutoverAttestationTargetConfig[];
  private readonly fetchImpl: FetchImpl;
  private readonly now: () => Date;
  private readonly timeoutMs: number;
  private readonly dbClient: DbClient;
  constructor(options: {
    targets?: readonly ReleaseCutoverAttestationTargetConfig[];
    fetchImpl?: FetchImpl;
    now?: () => Date;
    timeoutMs?: number;
    dbClient?: DbClient;
  } = {}) {
    const targets = options.targets ?? DEFAULT_RELEASE_CUTOVER_TARGETS;
    if (!Array.isArray(targets) || targets.length < MIN_TARGETS || targets.length > MAX_TARGETS) {
      throw new Error('release_cutover_targets_invalid');
    }
    targets.forEach(assertPinnedTarget);
    this.targets = targets;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = Math.min(options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS, MAX_FETCH_TIMEOUT_MS);
    this.dbClient = options.dbClient ?? db;
  }
  private async fetchTargetIdentity(target: ReleaseCutoverAttestationTargetConfig): Promise<ReleaseIdentity> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(target.url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (response.status !== 200) {
        throw new Error(`release_cutover_target_status_invalid:${target.label}:${response.status}`);
      }
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RELEASE_HEALTH_BYTES) {
        throw new Error(`release_cutover_target_body_too_large:${target.label}`);
      }
      if (!response.body) throw new Error(`release_cutover_target_body_missing:${target.label}`);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > MAX_RELEASE_HEALTH_BYTES) {
          await reader.cancel();
          throw new Error(`release_cutover_target_body_too_large:${target.label}`);
        }
        chunks.push(chunk.value);
      }
      const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
      return parseReleaseIdentity(JSON.parse(body));
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error(`release_cutover_target_timeout:${target.label}`);
      throw error instanceof Error ? error : new Error(`release_cutover_target_fetch_failed:${target.label}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  /**
   * Fetches every operator-pinned target right now and requires unanimous
   * agreement on commit and source-context digest. Never partially
   * succeeds: any timeout, malformed response, non-promotable evidence, or
   * cross-target disagreement throws and captures nothing. A live rollout in
   * progress across hosts must produce a thrown error, not a false
   * attestation.
   */
  async captureConsensus(): Promise<ReleaseCutoverAttestationTarget[]> {
    const results = await Promise.all(this.targets.map(async (target) => {
      const identity = await this.fetchTargetIdentity(target);
      const commitSha = identity.commitSha;
      if (identity.authority !== 'build' || identity.promotable !== true || !commitSha) {
        throw new ReleaseCutoverAttestationDisagreementError(
          `release_cutover_target_not_promotable:${target.label}`,
          { label: target.label, authority: identity.authority, promotable: identity.promotable },
        );
      }
      return {
        label: target.label,
        url: target.url,
        commitSha,
        sourceContextSha256: identity.sourceContextSha256,
      } satisfies ReleaseCutoverAttestationTarget;
    }));
    const [first, ...rest] = results;
    const disagreement = rest.find((entry) =>
      entry.commitSha !== first.commitSha || entry.sourceContextSha256 !== first.sourceContextSha256);
    if (disagreement) {
      throw new ReleaseCutoverAttestationDisagreementError('release_cutover_targets_disagree', { targets: results });
    }
    return results;
  }
  /**
   * Captures a fresh consensus snapshot and stores it as the one active
   * attestation for `decisionRef`. Refuses if an active attestation already
   * exists -- callers must `invalidate()` it first, keeping history
   * auditable instead of silently overwritten.
   */
  async attest(input: AttestInput): Promise<ReleaseCutoverAttestationRow> {
    const actor = validateActor(input.actor);
    const decisionRef = validateDecisionRef(input.decisionRef);
    const reason = validateReason(input.reason);
    const requestedTtlMs = input.ttlMs ?? DEFAULT_ATTESTATION_TTL_MS;
    if (!Number.isFinite(requestedTtlMs) || requestedTtlMs <= 0) {
      throw new ReleaseCutoverAttestationInputError('ttlMs must be a positive number');
    }
    const ttlMs = Math.min(requestedTtlMs, MAX_ATTESTATION_TTL_MS);
    const existing = await this.getActive(decisionRef);
    if (existing) {
      throw new ReleaseCutoverAttestationConflictError(
        `An active attestation already exists for decisionRef "${decisionRef}". Invalidate it before re-attesting.`,
      );
    }
    const targets = await this.captureConsensus();
    const capturedAt = this.now();
    const expiresAt = new Date(capturedAt.getTime() + ttlMs);
    const id = randomUUID();
    try {
      await this.dbClient.insert(releaseCutoverAttestations).values({
        id,
        decisionRef,
        capturedByActorId: actor,
        targets,
        commitSha: targets[0].commitSha,
        sourceContextSha256: targets[0].sourceContextSha256,
        reason,
        capturedAt,
        expiresAt,
        state: 'active',
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ReleaseCutoverAttestationConflictError(
          `An active attestation already exists for decisionRef "${decisionRef}".`,
        );
      }
      throw error;
    }
    const row = await this.getById(id);
    if (!row) throw new Error('release_cutover_attestation_read_after_write_failed');
    return row;
  }
  async getById(id: string): Promise<ReleaseCutoverAttestationRow | null> {
    const rows = await this.dbClient
      .select()
      .from(releaseCutoverAttestations)
      .where(eq(releaseCutoverAttestations.id, id))
      .limit(1);
    return rows.length ? toRow(rows[0]) : null;
  }
  private async getLatestByDecisionRef(decisionRef: string): Promise<ReleaseCutoverAttestationRow | null> {
    const rows = await this.dbClient
      .select()
      .from(releaseCutoverAttestations)
      .where(eq(releaseCutoverAttestations.decisionRef, decisionRef))
      .orderBy(desc(releaseCutoverAttestations.capturedAt))
      .limit(1);
    return rows.length ? toRow(rows[0]) : null;
  }
  /** Read-only. Never mutates state. `expired` is computed from `expiresAt`. */
  async getActive(decisionRef: string): Promise<ActiveAttestationView | null> {
    const ref = validateDecisionRef(decisionRef);
    const rows = await this.dbClient
      .select()
      .from(releaseCutoverAttestations)
      .where(and(
        eq(releaseCutoverAttestations.decisionRef, ref),
        eq(releaseCutoverAttestations.state, 'active'),
      ))
      .limit(1);
    if (!rows.length) return null;
    const row = toRow(rows[0]);
    return { ...row, expired: row.expiresAt.getTime() <= this.now().getTime() };
  }
  private assertNotExpired(row: { expiresAt: Date }, ref: string): void {
    if (row.expiresAt.getTime() <= this.now().getTime()) {
      throw new ReleaseCutoverAttestationConflictError(`Attestation for decisionRef "${ref}" has expired`);
    }
  }
  /**
   * Re-fetches every operator-pinned target right now and throws unless it
   * matches `row.commitSha` / `row.sourceContextSha256` exactly. Shared by
   * the first `verifyStillLive` check and by `consume`'s idempotent-replay
   * path, so a repeat call gets exactly the same fail-closed guarantee as
   * the original one, not a cached bypass of it.
   */
  private async assertLiveMatches(
    row: { commitSha: string; sourceContextSha256: string },
    ref: string,
  ): Promise<ReleaseCutoverAttestationTarget[]> {
    const liveTargets = await this.captureConsensus();
    const liveCommit = liveTargets[0].commitSha;
    const liveDigest = liveTargets[0].sourceContextSha256;
    if (liveCommit !== row.commitSha || liveDigest !== row.sourceContextSha256) {
      throw new ReleaseCutoverAttestationDisagreementError(
        `Live release evidence no longer matches the attestation for decisionRef "${ref}"; re-attest.`,
        { attested: { commitSha: row.commitSha, sourceContextSha256: row.sourceContextSha256 }, live: liveTargets },
      );
    }
    return liveTargets;
  }
  /**
   * Re-fetches every operator-pinned target right now and requires it to
   * match the stored attestation exactly. Fails closed (throws) if the row
   * is missing, expired, invalidated, consumed, or if live evidence
   * disagrees with the stored commit/digest or with itself across targets.
   * Never trusts the stored row alone.
   */
  async verifyStillLive(decisionRef: string): Promise<ReleaseCutoverAttestationRow> {
    const ref = validateDecisionRef(decisionRef);
    const active = await this.getActive(ref);
    if (!active) {
      throw new ReleaseCutoverAttestationNotFoundError(`No active attestation for decisionRef "${ref}"`);
    }
    this.assertNotExpired(active, ref);
    await this.assertLiveMatches(active, ref);
    return active;
  }
  /**
   * `active` -> `invalidated` only. Idempotent only when the replay's actor
   * and reason both match the row's original invalidation exactly; a
   * different actor or reason throws a conflict instead of silently
   * reporting success, so the audit trail stays honest about who
   * invalidated a decision and why.
   */
  async invalidate(decisionRef: string, actor: string, reason: string): Promise<ReleaseCutoverAttestationRow> {
    const ref = validateDecisionRef(decisionRef);
    const invalidatingActor = validateActor(actor);
    const invalidationReason = validateReason(reason);
    const latest = await this.getLatestByDecisionRef(ref);
    if (latest && latest.state === 'invalidated') {
      if (latest.invalidatedByActorId === invalidatingActor && latest.invalidationReason === invalidationReason) {
        return latest;
      }
      throw new ReleaseCutoverAttestationConflictError(
        `Attestation for decisionRef "${ref}" was already invalidated by a different actor or for a different reason.`,
      );
    }
    const active = await this.getActive(ref);
    if (!active) {
      throw new ReleaseCutoverAttestationNotFoundError(`No active attestation for decisionRef "${ref}"`);
    }
    const result = await this.dbClient
      .update(releaseCutoverAttestations)
      .set({
        state: 'invalidated',
        invalidatedAt: this.now(),
        invalidatedByActorId: invalidatingActor,
        invalidationReason,
      })
      .where(and(
        eq(releaseCutoverAttestations.id, active.id),
        eq(releaseCutoverAttestations.state, 'active'),
      ))
      .returning();
    if (!result.length) {
      // Lost a race to a concurrent transition; report the current row.
      const current = await this.getById(active.id);
      if (current && current.state === 'invalidated') return current;
      throw new ReleaseCutoverAttestationConflictError(
        `Attestation for decisionRef "${ref}" was already transitioned by another request.`,
      );
    }
    return toRow(result[0]);
  }
  /**
   * The mandatory pre-action checkpoint. Re-verifies live evidence still
   * matches (via `verifyStillLive`), then transitions `active` ->
   * `consumed`. Any code that executes a real cutover (DNS change,
   * Windows-authority grant, etc.) must call this immediately before acting
   * and abort if it throws.
   *
   * A same-actor/same-action replay (e.g. a retry after the caller crashed
   * or lost the response right after a first successful consume) is
   * idempotent in the sense that it targets the same already-consumed row,
   * but it is NOT a cached bypass: it re-runs the exact same expiry and
   * live-evidence checks as the first call before affirming success, and
   * throws if the release has since moved on or the attestation has aged
   * past its TTL. The row itself stays `consumed` either way -- the
   * real-world action already happened once and that fact does not change
   * -- but the caller only gets a fresh "yes" when it is still true right
   * now, exactly like the first call.
   */
  async consume(decisionRef: string, actor: string, action: string): Promise<ReleaseCutoverAttestationRow> {
    const ref = validateDecisionRef(decisionRef);
    const consumingActor = validateActor(actor);
    const actionLabel = validateActionLabel(action);
    const latest = await this.getLatestByDecisionRef(ref);
    if (latest && latest.state === 'consumed') {
      if (latest.consumedByActorId !== consumingActor || latest.consumedForAction !== actionLabel) {
        throw new ReleaseCutoverAttestationConflictError(
          `Attestation for decisionRef "${ref}" was already consumed for a different action.`,
        );
      }
      this.assertNotExpired(latest, ref);
      await this.assertLiveMatches(latest, ref);
      return latest;
    }
    const verified = await this.verifyStillLive(ref);
    const result = await this.dbClient
      .update(releaseCutoverAttestations)
      .set({
        state: 'consumed',
        consumedAt: this.now(),
        consumedByActorId: consumingActor,
        consumedForAction: actionLabel,
      })
      .where(and(
        eq(releaseCutoverAttestations.id, verified.id),
        eq(releaseCutoverAttestations.state, 'active'),
      ))
      .returning();
    if (!result.length) {
      throw new ReleaseCutoverAttestationConflictError(
        `Attestation for decisionRef "${ref}" was already transitioned by another request.`,
      );
    }
    return toRow(result[0]);
  }
}

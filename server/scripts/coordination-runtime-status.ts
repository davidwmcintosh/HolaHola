import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  COORDINATION_ACTOR_IDS,
  coordinationRuntimeRegistrations,
  coordinationRuntimeRotations,
  type CoordinationActorId,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { isDirectCliInvocation } from './lib/cli-entrypoint';

/**
 * Read-only operator surface for coordination-runtime-bootstrap.ts /
 * coordination-runtime-rotation.ts: "which LLM/model is actually running as
 * <actor> right now?" Both scripts set/carry provider+model at
 * registration/rotation time (see the comment above the provider/model
 * columns in shared/schema.ts); this file only reads that data back out. It
 * never sets, infers, or backfills provider/model -- a registration that
 * predates that work, or was registered without --provider/--model, stays
 * null in the database and is rendered as the literal string "unknown" in
 * text output (never blank or omitted) so that is visibly distinct from a
 * real provider/model value.
 */

export type CoordinationRuntimeRotationSummary = {
  /** The other runtime ID in this rotation pair (the source if this row describes rotatedTo, the replacement if it describes rotatedFrom). */
  counterpartRuntimeId: string;
  state: string;
  stagedAt: Date;
  readyAt: Date | null;
  completedAt: Date | null;
  rolledBackAt: Date | null;
};

export type CoordinationRuntimeStatusRow = {
  runtimeId: string;
  actor: string;
  displayName: string;
  /** Null means never set at registration or rotation time -- never inferred. Rendered as "unknown" in text output. */
  provider: string | null;
  /** Null means never set at registration or rotation time -- never inferred. Rendered as "unknown" in text output. */
  model: string | null;
  enabled: boolean;
  standingVerifier: boolean;
  registeredAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
  /** Set when this registration was itself created as the replacement side of a rotation (coordination-runtime-rotation.ts stage). */
  rotatedFrom: CoordinationRuntimeRotationSummary | null;
  /** Set to the most recent rotation (any state) where this registration was staged as the source side. */
  rotatedTo: CoordinationRuntimeRotationSummary | null;
};

export type CoordinationRuntimeStatusFilter = {
  actor?: CoordinationActorId;
  /** Restrict to these exact runtime IDs. When set, results are not additionally limited by actor unless actor is also set. */
  runtimeIds?: string[];
  /** Include disabled/revoked registrations. Defaults to false: only active (enabled, non-revoked) rows are returned. */
  includeDisabled?: boolean;
};

/**
 * Reads coordination_runtime_registrations back out, enriched with each
 * row's rotation lineage from coordination_runtime_rotations. Pure read --
 * makes no writes and never infers a null provider/model.
 */
export async function getCoordinationRuntimeStatus(
  filter: CoordinationRuntimeStatusFilter = {},
): Promise<CoordinationRuntimeStatusRow[]> {
  const db = getSharedDb();
  const conditions = [];
  if (filter.actor) conditions.push(eq(coordinationRuntimeRegistrations.actor, filter.actor));
  if (filter.runtimeIds && filter.runtimeIds.length > 0) {
    conditions.push(inArray(coordinationRuntimeRegistrations.id, filter.runtimeIds));
  }
  if (!filter.includeDisabled) {
    conditions.push(eq(coordinationRuntimeRegistrations.enabled, true));
    conditions.push(isNull(coordinationRuntimeRegistrations.revokedAt));
  }

  const registrations = await db.select().from(coordinationRuntimeRegistrations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      asc(coordinationRuntimeRegistrations.actor),
      asc(coordinationRuntimeRegistrations.createdAt),
      asc(coordinationRuntimeRegistrations.id),
    );
  if (registrations.length === 0) return [];

  const ids = registrations.map((row) => row.id);
  const rotations = await db.select().from(coordinationRuntimeRotations)
    .where(or(
      inArray(coordinationRuntimeRotations.sourceRuntimeId, ids),
      inArray(coordinationRuntimeRotations.replacementRuntimeId, ids),
    ))
    .orderBy(asc(coordinationRuntimeRotations.createdAt));

  const toSummary = (
    rotation: typeof rotations[number] | undefined,
    counterpartRuntimeId: string | undefined,
  ): CoordinationRuntimeRotationSummary | null =>
    rotation && counterpartRuntimeId ? {
      counterpartRuntimeId,
      state: rotation.state,
      stagedAt: rotation.createdAt,
      readyAt: rotation.readyAt,
      completedAt: rotation.completedAt,
      rolledBackAt: rotation.rolledBackAt,
    } : null;

  return registrations.map((row) => {
    // A runtime ID is only ever inserted as a replacementRuntimeId once (the
    // single stageCoordinationRuntimeReplacement call that created this exact
    // row) -- at most one match.
    const asReplacement = rotations.find((rotation) => rotation.replacementRuntimeId === row.id);
    // A runtime ID can be staged as a source more than once over its
    // lifetime (e.g. a rolled-back attempt followed by a later successful
    // one); take the most recent by createdAt. Rotations are already sorted
    // ascending, so the last match is the most recent.
    const asSourceMatches = rotations.filter((rotation) => rotation.sourceRuntimeId === row.id);
    const asSource = asSourceMatches[asSourceMatches.length - 1];

    return {
      runtimeId: row.id,
      actor: row.actor,
      displayName: row.displayName,
      provider: row.provider,
      model: row.model,
      enabled: row.enabled,
      standingVerifier: row.standingVerifier,
      registeredAt: row.createdAt,
      updatedAt: row.updatedAt,
      revokedAt: row.revokedAt,
      rotatedFrom: toSummary(asReplacement, asReplacement?.sourceRuntimeId),
      rotatedTo: toSummary(asSource, asSource?.replacementRuntimeId),
    };
  });
}

function displayOrUnknown(value: string | null): string {
  return value === null ? 'unknown' : value;
}

function isoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function mostRecentRotationTimestamp(summary: CoordinationRuntimeRotationSummary): Date {
  return summary.completedAt ?? summary.rolledBackAt ?? summary.readyAt ?? summary.stagedAt;
}

function formatRotationDescriptor(summary: CoordinationRuntimeRotationSummary | null): string | null {
  if (!summary) return null;
  const timestamp = mostRecentRotationTimestamp(summary).toISOString();
  return `${summary.counterpartRuntimeId} (${summary.state}, ${timestamp})`;
}

/** Human-readable listing for terminal use. Null provider/model always render as the literal "unknown". */
export function formatCoordinationRuntimeStatusText(rows: CoordinationRuntimeStatusRow[]): string {
  if (rows.length === 0) return 'No matching coordination runtime registrations.\n';
  return `${rows.map((row) => {
    const status = row.enabled && !row.revokedAt
      ? 'active'
      : `disabled${row.revokedAt ? ` (revoked ${row.revokedAt.toISOString()})` : ''}`;
    const lines = [
      `${row.actor} :: ${row.runtimeId}${row.standingVerifier ? ' [standing verifier]' : ''}`,
      `  display name: ${row.displayName}`,
      `  status:       ${status}`,
      `  provider:     ${displayOrUnknown(row.provider)}`,
      `  model:        ${displayOrUnknown(row.model)}`,
      `  registered:   ${row.registeredAt.toISOString()}`,
      `  updated:      ${row.updatedAt.toISOString()}`,
    ];
    const rotatedFrom = formatRotationDescriptor(row.rotatedFrom);
    if (rotatedFrom) lines.push(`  rotated from: ${rotatedFrom}`);
    const rotatedTo = formatRotationDescriptor(row.rotatedTo);
    if (rotatedTo) lines.push(`  rotated to:   ${rotatedTo}`);
    return lines.join('\n');
  }).join('\n\n')}\n`;
}

/** Machine-readable listing. Null provider/model stay JSON null -- present and typed, never a blank string or a missing key. */
export function formatCoordinationRuntimeStatusJson(rows: CoordinationRuntimeStatusRow[]): string {
  const summaryToJson = (summary: CoordinationRuntimeRotationSummary | null) => summary ? {
    runtimeId: summary.counterpartRuntimeId,
    state: summary.state,
    stagedAt: summary.stagedAt.toISOString(),
    readyAt: isoOrNull(summary.readyAt),
    completedAt: isoOrNull(summary.completedAt),
    rolledBackAt: isoOrNull(summary.rolledBackAt),
  } : null;
  return `${JSON.stringify(rows.map((row) => ({
    runtimeId: row.runtimeId,
    actor: row.actor,
    displayName: row.displayName,
    provider: row.provider,
    model: row.model,
    enabled: row.enabled,
    standingVerifier: row.standingVerifier,
    registeredAt: row.registeredAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: isoOrNull(row.revokedAt),
    rotatedFrom: summaryToJson(row.rotatedFrom),
    rotatedTo: summaryToJson(row.rotatedTo),
  })), null, 2)}\n`;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function usage(): never {
  throw new Error([
    'Usage: npx tsx server/scripts/coordination-runtime-status.ts [--actor <actor>] [--runtime-id <id>] [--all] [--json]',
    '',
    'Lists coordination runtime registrations with their provider/model attribution and',
    'rotation lineage. By default only active (enabled, non-revoked) registrations are',
    'shown; pass --all to include disabled/revoked ones too. --runtime-id restricts to one',
    'exact registration regardless of the --actor filter. Provider/model that were never',
    'set at registration (--provider/--model on coordination-runtime-bootstrap.ts) or',
    'carried forward at rotation time are never inferred here and print as "unknown".',
  ].join('\n'));
}

async function main(): Promise<void> {
  const actorInput = option('actor');
  if (actorInput !== undefined && !COORDINATION_ACTOR_IDS.includes(actorInput as CoordinationActorId)) {
    throw new Error(`actor must be one of ${COORDINATION_ACTOR_IDS.join(', ')}`);
  }
  const runtimeId = option('runtime-id');
  if (process.argv.slice(2).some((value) => value.startsWith('--') && !['--actor', '--runtime-id', '--all', '--json'].includes(value))) {
    usage();
  }
  const rows = await getCoordinationRuntimeStatus({
    actor: actorInput as CoordinationActorId | undefined,
    runtimeIds: runtimeId ? [runtimeId] : undefined,
    includeDisabled: flag('all'),
  });
  process.stdout.write(flag('json') ? formatCoordinationRuntimeStatusJson(rows) : formatCoordinationRuntimeStatusText(rows));
}

// Exact basename match, not a substring check: a substring match against
// process.argv[1] (e.g. `.includes('coordination-runtime-status')`) would
// also fire when a *test file* that imports this module for its exported
// functions is the actual entry point -- test-coordination-runtime-status.test.ts
// contains this file's name as a literal substring of its own filename, by
// this repo's `test-<subject>.test.ts` naming convention. That false-positive
// would run main() (an unfiltered live query + a stdout dump) and close the
// shared DB pool as a side effect of merely importing this module, breaking
// every test in the same process. isDirectCliInvocation() (argv[1]-basename
// only, never import.meta.url) avoids that collision while still matching a
// direct `npx tsx .../coordination-runtime-status.ts` invocation, and stays
// safe even if this script is ever reached from the esbuild server bundle --
// see server/scripts/lib/cli-entrypoint.ts.
if (isDirectCliInvocation('coordination-runtime-status.ts')) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(closeDbConnections);
}

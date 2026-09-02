import type { CoordinationActorId } from '@shared/schema';
import { semanticSearchOperationSkills } from './semantic-memory-service';

export type OperationAccessMode = 'read' | 'mutate';
export type OperationConfirmation = 'none' | 'required';
export type OperationExecutorKind = 'tool' | 'endpoint' | 'script' | 'workflow' | 'ui';

export interface OperationManifest {
  id: string;
  family: string;
  title: string;
  aliases: readonly string[];
  purpose: string;
  canonicalExecutor: {
    kind: OperationExecutorKind;
    reference: string;
  };
  accessMode: OperationAccessMode;
  actorScope: readonly CoordinationActorId[];
  confirmation: OperationConfirmation;
  output: string;
  persistence: string;
  caveats: readonly string[];
  relatedSurfaces: readonly string[];
}

export interface PublicOperationManifest {
  id: string;
  family: string;
  title: string;
  aliases: readonly string[];
  purpose: string;
  accessMode: OperationAccessMode;
  actorScope: readonly CoordinationActorId[];
  confirmation: OperationConfirmation;
  output: string;
  persistence: string;
  caveats: readonly string[];
  relatedSurfaces: readonly string[];
}

const ALL_COORDINATION_ACTORS: readonly CoordinationActorId[] = [
  'luca-replit',
  'luca-claude-code',
  'luca-holahola',
  'alden',
  'daniela',
  'david',
  'coordination-system',
];

export const OPERATIONS_CATALOG: readonly OperationManifest[] = [
  {
    id: 'cost.burn-report',
    family: 'Burn and cost',
    title: 'Run the Burn Report',
    aliases: ['run the burn report', 'run burn report', 'burn report', 'ai burn report'],
    purpose: 'Generate the established persistent AI-cost report across 7-day, 14-day, and all-time windows, including run rates and unit economics.',
    canonicalExecutor: { kind: 'tool', reference: 'get_ai_cost_report' },
    accessMode: 'read',
    actorScope: ['alden', 'david'],
    confirmation: 'none',
    output: 'Formatted multi-window AI-cost report.',
    persistence: 'Reads persistent ai_cost_logs and voice-session usage records; report generation does not reset on restart.',
    caveats: [
      'TTS per-session figures can be upper-bound estimates while monthly provider usage remains inside a free tier.',
      'The live AI Cost Monitor is supplementary and is not the persistent historical authority.',
    ],
    relatedSurfaces: ['post_report_to_team_room', '/api/alden/cost-summary', 'Admin AI Cost Monitor'],
  },
  {
    id: 'cost.burn-report.team-room',
    family: 'Burn and cost',
    title: 'Post the Burn Report to Team Room',
    aliases: ['post the burn report', 'share burn report in team room', 'burn report to team room'],
    purpose: 'Generate the canonical Burn Report and publish the formatted result to the active Team Room.',
    canonicalExecutor: { kind: 'tool', reference: 'post_report_to_team_room' },
    accessMode: 'mutate',
    actorScope: ['alden', 'david'],
    confirmation: 'required',
    output: 'A Team Room message containing the current Burn Report.',
    persistence: 'The report source is persistent; the delivered Team Room message is stored through the Team Room message path.',
    caveats: ['Delivery to Team Room is a side effect and is distinct from merely generating the report.'],
    relatedSurfaces: ['get_ai_cost_report', 'Team Room'],
  },
  {
    id: 'system.verify-health',
    family: 'Health and monitoring',
    title: 'Verify System Health',
    aliases: ['verify system health', 'run system health', 'system health check'],
    purpose: 'Run the repository health verifier over critical database, seed, worker, and curriculum invariants.',
    canonicalExecutor: { kind: 'script', reference: 'npx tsx server/scripts/verify-system-health.ts' },
    accessMode: 'read',
    actorScope: ['luca-replit', 'luca-claude-code', 'david'],
    confirmation: 'none',
    output: 'Pass, warning, and failure summary for critical system invariants.',
    persistence: 'Read-only verification; results are process output and do not survive unless captured by the caller.',
    caveats: ['A passing TypeScript check is not a substitute for this runtime verifier.'],
    relatedSurfaces: ['Validation suite'],
  },
  {
    id: 'production.readiness',
    family: 'Health and monitoring',
    title: 'Check Production Readiness',
    aliases: ['check production readiness', 'readiness check', 'health readiness'],
    purpose: 'Check whether startup gates have completed and the application is ready to serve production traffic.',
    canonicalExecutor: { kind: 'endpoint', reference: 'GET /health/readiness' },
    accessMode: 'read',
    actorScope: ALL_COORDINATION_ACTORS,
    confirmation: 'none',
    output: 'HTTP readiness status and startup-gate detail.',
    persistence: 'Reports current process readiness; state resets when the application process restarts.',
    caveats: ['Readiness is stricter than process liveness and can remain unavailable while startup gates are incomplete.'],
    relatedSurfaces: ['Production uptime monitor', 'GET /health'],
  },
  {
    id: 'production.uptime-monitor',
    family: 'Health and monitoring',
    title: 'Run the Production Uptime Monitor',
    aliases: ['run production monitor', 'production uptime monitor', 'check production outage monitor'],
    purpose: 'Probe production readiness with retries and maintain the deduplicated GitHub incident and SMS alert lifecycle.',
    canonicalExecutor: { kind: 'workflow', reference: '.github/workflows/production-uptime-monitor.yml' },
    accessMode: 'mutate',
    actorScope: ['coordination-system', 'luca-replit', 'luca-claude-code', 'david'],
    confirmation: 'required',
    output: 'Probe result plus incident issue and SMS actions when the failure threshold is reached.',
    persistence: 'Scheduled GitHub Actions state and the deduplicated incident issue survive Replit restarts.',
    caveats: ['Manual execution can create or update an external incident after the configured failure threshold.'],
    relatedSurfaces: ['scripts/production-uptime-monitor.mjs', 'GET /health/readiness'],
  },
  {
    id: 'capture.health',
    family: 'Capture and episodes',
    title: 'Check Canonical Conversation Capture Health',
    aliases: ['check capture health', 'canonical capture health', 'conversation capture status'],
    purpose: 'Inspect canonical conversation capture progress, pending episode mirrors, and acknowledgement health.',
    canonicalExecutor: { kind: 'endpoint', reference: 'GET /api/internal/canonical-conversation-health' },
    accessMode: 'read',
    actorScope: ['luca-replit'],
    confirmation: 'none',
    output: 'Canonical capture and mirror-health status.',
    persistence: 'Reads the durable capture state used across application restarts.',
    caveats: ['This endpoint is Luca [Replit]-only; Claude Code uses its dedicated remote capture health path.'],
    relatedSurfaces: ['.local/episode-capture-status.md', 'record-exchange.ts'],
  },
  {
    id: 'coordination.feed',
    family: 'Coordination',
    title: 'Read Coordination Feed',
    aliases: ['read coordination feed', 'coordination status', 'check coordination threads'],
    purpose: 'Read ledger events addressed to the authenticated actor from a global event cursor.',
    canonicalExecutor: { kind: 'endpoint', reference: 'GET /api/coordination/threads' },
    accessMode: 'read',
    actorScope: ALL_COORDINATION_ACTORS,
    confirmation: 'none',
    output: 'Actor-scoped coordination threads, events, and the next global cursor.',
    persistence: 'The append-only coordination ledger is durable across actor and server restarts.',
    caveats: ['The requested actor must match the actor derived from the dedicated credential.'],
    relatedSurfaces: ['Coordination ledger', 'Team Room compatibility projection'],
  },
  {
    id: 'source.status',
    family: 'Source control',
    title: 'Check Source Synchronization Status',
    aliases: ['check source status', 'source sync status', 'github sync status'],
    purpose: 'Inspect the guarded source-control coordinator state without fetching, merging, committing, or pushing.',
    canonicalExecutor: { kind: 'script', reference: 'npm run source-control:status' },
    accessMode: 'read',
    actorScope: ['luca-replit', 'luca-claude-code', 'david'],
    confirmation: 'none',
    output: 'Machine- or human-readable source synchronization state.',
    persistence: 'Reads the durable source-control status record under the workspace state directory.',
    caveats: ['Status does not synchronize source or publish the application.'],
    relatedSurfaces: ['server/scripts/source-control-cli.ts', 'source-control-service.ts'],
  },
  {
    id: 'source.synchronize',
    family: 'Source control',
    title: 'Synchronize Source',
    aliases: ['synchronize source', 'run source sync', 'sync github source'],
    purpose: 'Run the guarded source-control coordinator for an ordinary safe synchronization decision.',
    canonicalExecutor: { kind: 'script', reference: 'npm run source-control:sync' },
    accessMode: 'mutate',
    actorScope: ['luca-replit', 'luca-claude-code', 'david'],
    confirmation: 'required',
    output: 'A guarded synchronization outcome or an explicit refusal state.',
    persistence: 'Updates durable source-control status and can change Git history only through the existing guarded rules.',
    caveats: [
      'Never substitutes for Publish.',
      'Dirty trees, divergence, lock contention, and unsafe ancestry fail closed.',
    ],
    relatedSurfaces: ['npm run source-control:status', 'source-control-service.ts'],
  },
] as const;

function normalizeLookupText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildExactLookup(catalog: readonly OperationManifest[]): Map<string, OperationManifest> {
  const lookup = new Map<string, OperationManifest>();
  for (const operation of catalog) {
    const keys = [operation.id, operation.title, ...operation.aliases];
    for (const key of keys) {
      const normalized = normalizeLookupText(key);
      const existing = lookup.get(normalized);
      if (existing && existing.id !== operation.id) {
        throw new Error(
          `Duplicate operation alias "${key}" maps to both ${existing.id} and ${operation.id}`,
        );
      }
      lookup.set(normalized, operation);
    }
  }
  return lookup;
}

const EXACT_OPERATION_LOOKUP = buildExactLookup(OPERATIONS_CATALOG);
const OPERATION_BY_ID = new Map(OPERATIONS_CATALOG.map(operation => [operation.id, operation]));

export function getOperationById(id: string): OperationManifest | undefined {
  return OPERATION_BY_ID.get(id);
}

export function findExactOperation(query: string): OperationManifest | undefined {
  return EXACT_OPERATION_LOOKUP.get(normalizeLookupText(query));
}

export function toPublicOperationManifest(operation: OperationManifest): PublicOperationManifest {
  return {
    id: operation.id,
    family: operation.family,
    title: operation.title,
    aliases: operation.aliases,
    purpose: operation.purpose,
    accessMode: operation.accessMode,
    actorScope: operation.actorScope,
    confirmation: operation.confirmation,
    output: operation.output,
    persistence: operation.persistence,
    caveats: operation.caveats,
    relatedSurfaces: operation.relatedSurfaces,
  };
}

export function formatOperationForEmbedding(operation: OperationManifest): string {
  return [
    `OPERATION ID: ${operation.id}`,
    `TITLE: ${operation.title}`,
    `FAMILY: ${operation.family}`,
    `ALIASES: ${operation.aliases.join('; ')}`,
    `PURPOSE: ${operation.purpose}`,
    `CANONICAL EXECUTOR: ${operation.canonicalExecutor.kind} ${operation.canonicalExecutor.reference}`,
    `ACCESS: ${operation.accessMode}`,
    `ACTOR SCOPE: ${operation.actorScope.join(', ')}`,
    `CONFIRMATION: ${operation.confirmation}`,
    `OUTPUT: ${operation.output}`,
    `PERSISTENCE: ${operation.persistence}`,
    `CAVEATS: ${operation.caveats.join(' ')}`,
  ].join('\n');
}

export type OperationDiscoveryResult = {
  matchType: 'exact' | 'semantic';
  operations: Array<PublicOperationManifest & { similarity?: number }>;
};

export async function discoverOperations(query: string, limit = 5): Promise<OperationDiscoveryResult> {
  const exact = findExactOperation(query);
  if (exact) {
    return {
      matchType: 'exact',
      operations: [toPublicOperationManifest(exact)],
    };
  }

  const semanticMatches = await semanticSearchOperationSkills(query, limit);
  const operations = semanticMatches.flatMap(match => {
    const operation = OPERATION_BY_ID.get(match.memoryId);
    if (!operation) return [];
    return [{ ...toPublicOperationManifest(operation), similarity: match.similarity }];
  });

  return { matchType: 'semantic', operations };
}

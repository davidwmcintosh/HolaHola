import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { HistoricalAttributionRecoveryPaused, type HistoricalAttributionPauseReason } from './historical-attribution-overlay';
import { workspaceResolution } from './workspace-root';

type RecoveryLane = 'canonical-capture' | 'episode-mirror';
type RecoveryWorker = 'autosave' | 'watchdog';
interface Pause extends HistoricalAttributionPauseReason {
  lane: RecoveryLane;
  worker: RecoveryWorker;
  detectedAtMs: number;
  completedCaptureIds?: string[];
}
let directoryForTest: string | undefined;
export function setHistoricalAttributionStatusDirectoryForTest(directory?: string): void {
  directoryForTest = directory;
}
const directory = () => directoryForTest ?? join(workspaceResolution.root, '.local/historical-attribution-status');
const file = (lane: RecoveryLane) => join(directory(), `${lane}.json`);
const lanes: RecoveryLane[] = ['canonical-capture', 'episode-mirror'];

function writePause(pause: Pause): void {
  mkdirSync(directory(), { recursive: true });
  const path = file(pause.lane);
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(pause));
  renameSync(temp, path);
}

/** Separate lane files avoid losing an outbox pause to an unrelated cursor drain. */
export function recordHistoricalAttributionPause(error: unknown, lane: RecoveryLane, worker: RecoveryWorker): void {
  if (!(error instanceof HistoricalAttributionRecoveryPaused)) return;
  // A new failure invalidates previous completion progress: retrying a damaged
  // identity is not successful reconciliation, even if it once completed.
  writePause({ ...error.reason, lane, worker, detectedAtMs: Date.now(), completedCaptureIds: [] });
}

/** Only completed effects for every paused identity may retire the diagnostic. */
export function clearHistoricalAttributionPause(lane: RecoveryLane, completedCaptureIds: string[]): void {
  const path = file(lane);
  if (!existsSync(path)) return;
  const pause = JSON.parse(readFileSync(path, 'utf8')) as Pause;
  const matchedIds = completedCaptureIds.filter(id => pause.captureIds.includes(id));
  if (!matchedIds.length) return;
  const completed = [...new Set([...(pause.completedCaptureIds ?? []), ...matchedIds])];
  if (pause.captureIds.length && pause.captureIds.every(id => completed.includes(id))) {
    unlinkSync(path);
  } else {
    // Mixed mirrors reconcile into single-capture items. Carry success across
    // separate deliveries/restarts while retaining the original source IDs.
    writePause({ ...pause, completedCaptureIds: completed });
  }
}

export function getHistoricalAttributionRecoveryStatus(): {
  paused: boolean; pauses: Pause[]; diagnosticUnavailable: boolean;
} {
  const pauses: Pause[] = [];
  let diagnosticUnavailable = false;
  for (const lane of lanes) {
    try {
      const path = file(lane);
      if (!existsSync(path)) continue;
      const pause = JSON.parse(readFileSync(path, 'utf8')) as Pause;
      if (pause.lane !== lane || !Array.isArray(pause.captureIds) || !Array.isArray(pause.approvedSources) ||
          typeof pause.code !== 'string' || typeof pause.reconciliation !== 'string') {
        throw new Error('Invalid historical recovery diagnostic');
      }
      pauses.push(pause);
    } catch {
      diagnosticUnavailable = true;
    }
  }
  return { paused: pauses.length > 0 || diagnosticUnavailable, pauses, diagnosticUnavailable };
}

export function historicalAttributionRecoveryStatusLines(): string[] {
  const status = getHistoricalAttributionRecoveryStatus();
  if (!status.paused) return ['  ✓ historical attribution recovery: no recorded pause'];
  return [
    '## Historical attribution recovery — PAUSED',
    ...(status.diagnosticUnavailable ? [
      'Historical recovery diagnostic unreadable — inspect the diagnostic store before assuming recovery is healthy. Do not bypass capture or acknowledgement cursors.',
    ] : []),
    ...status.pauses.flatMap(pause => [
      `Reason: ${pause.code} (${pause.lane}; detected by ${pause.worker})`,
      `Capture IDs: ${JSON.stringify(pause.captureIds)}`,
      `Completed reconciled capture IDs: ${JSON.stringify(pause.completedCaptureIds ?? [])}`,
      `Approved source identities: ${JSON.stringify(pause.approvedSources)}`,
      ...(pause.observedSpokenSha256 ? [`Observed spoken SHA-256: ${pause.observedSpokenSha256}`] : []),
      `Reconciliation: ${pause.reconciliation}`,
    ]),
  ];
}

/** Keep worker readiness and paused recovery as independent health dimensions. */
export function historicalAttributionCaptureHealth(readiness: { ok: boolean; status: number }) {
  const historicalRecovery = getHistoricalAttributionRecoveryStatus();
  return {
    status: historicalRecovery.paused ? 503 : readiness.status,
    ok: readiness.ok && !historicalRecovery.paused,
    historicalRecovery,
  };
}
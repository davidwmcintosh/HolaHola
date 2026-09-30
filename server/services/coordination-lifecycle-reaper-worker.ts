/**
 * Background polling loop for the Coordination V2 lifecycle reaper. Mirrors
 * coordination-gemini-provider-worker.ts's shape exactly: a module-level
 * running/timer guard, an exported batch runner other callers (tests, a demo
 * script) can invoke directly, and start/stop control functions.
 *
 * Polls far less often than the Gemini driver worker: staleness is judged in
 * tens of minutes (see DEFAULT_STALE_SESSION_THRESHOLD_MS), so there is
 * nothing to gain from checking every few seconds.
 */
import { sweepStaleCoordinationSessions, staleSessionThresholdMs, DEFAULT_REAPER_BATCH_LIMIT } from './coordination-lifecycle-reaper-service';

const DEFAULT_POLL_MS = 5 * 60_000;
let running = false;
let timer: NodeJS.Timeout | null = null;

export async function runCoordinationLifecycleReaperBatch(
  limit = Number(process.env.COORDINATION_REAPER_BATCH_LIMIT || DEFAULT_REAPER_BATCH_LIMIT),
  staleThresholdMs = staleSessionThresholdMs(),
): Promise<{ scanned: number; reaped: number; expired: number; failed: number; errors: number }> {
  if (running) return { scanned: 0, reaped: 0, expired: 0, failed: 0, errors: 0 };
  running = true;
  try {
    return await sweepStaleCoordinationSessions(limit, staleThresholdMs);
  } finally {
    running = false;
  }
}

export function startCoordinationLifecycleReaperWorker(
  pollMs = Number(process.env.COORDINATION_REAPER_POLL_MS || DEFAULT_POLL_MS),
): void {
  if (timer) return;
  const run = () => void runCoordinationLifecycleReaperBatch().then(({ reaped, errors }) => {
    if (reaped > 0 || errors > 0) console.log(`[CoordinationLifecycleReaper] batch reaped=${reaped} errors=${errors}`);
  }).catch((error) => {
    console.error('[CoordinationLifecycleReaper] batch failed:', error);
  });
  run();
  timer = setInterval(run, Math.max(30_000, pollMs));
  timer.unref();
  console.log('[CoordinationLifecycleReaper] worker started');
}

export function stopCoordinationLifecycleReaperWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

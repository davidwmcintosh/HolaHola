/**
 * Background polling loop for the Gemini Coordinator V2 provider driver.
 * Mirrors coordination-delivery-worker.ts's shape exactly: a module-level
 * running/timer guard, an exported batch runner other callers (tests, a demo
 * script) can invoke directly, and start/stop control functions.
 */
import { runGeminiProviderDriverBatch } from './coordination-gemini-provider-driver';

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_BATCH_LIMIT = 10;
let running = false;
let timer: NodeJS.Timeout | null = null;

export async function runGeminiProviderWorkerBatch(limit = DEFAULT_BATCH_LIMIT): Promise<{ processed: number; errors: number }> {
  if (running) return { processed: 0, errors: 0 };
  running = true;
  try {
    return await runGeminiProviderDriverBatch(limit);
  } finally {
    running = false;
  }
}

export function startGeminiProviderWorker(
  pollMs = Number(process.env.COORDINATION_GEMINI_DRIVER_POLL_MS || DEFAULT_POLL_MS),
  limit = Number(process.env.COORDINATION_GEMINI_DRIVER_BATCH_LIMIT || DEFAULT_BATCH_LIMIT),
): void {
  if (timer) return;
  const run = () => void runGeminiProviderWorkerBatch(limit).then(({ processed, errors }) => {
    if (processed > 0) console.log(`[CoordinationGeminiDriver] batch processed=${processed} errors=${errors}`);
  }).catch((error) => {
    console.error('[CoordinationGeminiDriver] batch failed:', error);
  });
  run();
  timer = setInterval(run, Math.max(1_000, pollMs));
  timer.unref();
  console.log('[CoordinationGeminiDriver] worker started');
}

export function stopGeminiProviderWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

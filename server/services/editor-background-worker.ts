/**
 * Editor Background Worker
 * 
 * A lightweight background worker that enables autonomous Daniela-Editor collaboration:
 * - Processes pending hive beacons (teaching moments awaiting Editor response)
 * - Generates post-session reflections after voice sessions end
 * - Runs on a configurable interval (default: 30 seconds)
 * 
 * Philosophy: The Editor can continue thinking and responding even after 
 * the voice session ends, providing asynchronous insights to founders.
 * 
 * SECURITY: Protected by ARCHITECT_SECRET - worker only starts if configured.
 */

import { editorPersonaService, validateEditorSecret } from "./editor-persona-service";

// Worker configuration
const WORKER_INTERVAL_MS = parseInt(process.env.EDITOR_WORKER_INTERVAL_MS || '30000', 10); // 30 seconds default
const MAX_BEACONS_PER_CYCLE = parseInt(process.env.EDITOR_MAX_BEACONS_PER_CYCLE || '10', 10);
const MAX_CHANNELS_PER_CYCLE = parseInt(process.env.EDITOR_MAX_CHANNELS_PER_CYCLE || '3', 10);

// Worker state
let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;
let lastProcessedAt: Date | null = null;
let processedCounts = {
  beacons: 0,
  channels: 0,
  errors: 0,
};

/**
 * Worker health status
 */
export interface WorkerStatus {
  isRunning: boolean;
  isProcessing: boolean;
  lastProcessedAt: string | null;
  intervalMs: number;
  processedCounts: {
    beacons: number;
    channels: number;
    errors: number;
  };
}

/**
 * Run a single processing cycle
 */
async function runProcessingCycle(): Promise<void> {
  if (isProcessing) {
    console.log('[Editor Worker] Skipping cycle - previous still running');
    return;
  }
  
  isProcessing = true;
  
  try {
    console.log('[Editor Worker] Starting processing cycle...');
    
    // Process pending beacons (teaching moments awaiting Editor response)
    const beaconsProcessed = await editorPersonaService.processAllPendingBeacons();
    processedCounts.beacons += beaconsProcessed;
    
    // Process post-session channels (generate reflections)
    const channelsProcessed = await editorPersonaService.processPostSessionChannels();
    processedCounts.channels += channelsProcessed;
    
    lastProcessedAt = new Date();
    
    if (beaconsProcessed > 0 || channelsProcessed > 0) {
      console.log(`[Editor Worker] Cycle complete: ${beaconsProcessed} beacons, ${channelsProcessed} channels`);
    }
  } catch (error) {
    processedCounts.errors++;
    console.error('[Editor Worker] Error in processing cycle:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the background worker
 * Returns true if started, false if already running or disabled
 */
export function startEditorWorker(): boolean {
  // Check if already running
  if (workerInterval) {
    console.log('[Editor Worker] Already running');
    return false;
  }
  
  // Validate ARCHITECT_SECRET is configured (security gate)
  const secretConfigured = process.env.ARCHITECT_SECRET && process.env.ARCHITECT_SECRET.length >= 16;
  if (!secretConfigured) {
    console.log('[Editor Worker] Disabled - ARCHITECT_SECRET not configured');
    return false;
  }
  
  console.log(`[Editor Worker] Starting with ${WORKER_INTERVAL_MS}ms interval`);
  
  // Run immediately, then on interval
  runProcessingCycle();
  
  workerInterval = setInterval(runProcessingCycle, WORKER_INTERVAL_MS);
  
  return true;
}

/**
 * Stop the background worker
 */
export function stopEditorWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Editor Worker] Stopped');
  }
}

/**
 * Get current worker status
 */
export function getWorkerStatus(): WorkerStatus {
  return {
    isRunning: workerInterval !== null,
    isProcessing,
    lastProcessedAt: lastProcessedAt?.toISOString() || null,
    intervalMs: WORKER_INTERVAL_MS,
    processedCounts: { ...processedCounts },
  };
}

/**
 * Trigger an immediate processing cycle (for manual/API trigger)
 */
export async function triggerProcessingCycle(): Promise<{ beacons: number; channels: number }> {
  if (isProcessing) {
    throw new Error('Processing cycle already in progress');
  }
  
  await runProcessingCycle();
  
  return {
    beacons: processedCounts.beacons,
    channels: processedCounts.channels,
  };
}

/**
 * Reset worker statistics
 */
export function resetWorkerStats(): void {
  processedCounts = {
    beacons: 0,
    channels: 0,
    errors: 0,
  };
  console.log('[Editor Worker] Stats reset');
}

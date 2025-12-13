/**
 * Editor Background Worker
 * 
 * A lightweight background worker that enables autonomous Daniela-Editor collaboration:
 * - Processes pending hive beacons (teaching moments awaiting Editor response)
 * - Generates post-session reflections after voice sessions end
 * - Runs on a configurable interval (default: 30 seconds)
 * - Throttles processing to avoid overwhelming Claude API
 * 
 * Philosophy: The Editor can continue thinking and responding even after 
 * the voice session ends, providing asynchronous insights to founders.
 * 
 * SECURITY: Protected by ARCHITECT_SECRET - worker only starts if configured.
 */

import { editorPersonaService } from "./editor-persona-service";
import { hiveCollaborationService } from "./hive-collaboration-service";
import { surgeryOrchestrator } from "./collaborative-surgery-orchestrator";

// Worker configuration
const WORKER_INTERVAL_MS = parseInt(process.env.EDITOR_WORKER_INTERVAL_MS || '30000', 10); // 30 seconds default
const MAX_BEACONS_PER_CYCLE = parseInt(process.env.EDITOR_MAX_BEACONS_PER_CYCLE || '10', 10);
const MAX_CHANNELS_PER_CYCLE = parseInt(process.env.EDITOR_MAX_CHANNELS_PER_CYCLE || '3', 10);

// Worker state
let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;
let lastProcessedAt: Date | null = null;
let cumulativeCounts = {
  beacons: 0,
  channels: 0,
  errors: 0,
};

/**
 * Check if ARCHITECT_SECRET is properly configured
 */
function isSecretConfigured(): boolean {
  const secret = process.env.ARCHITECT_SECRET;
  return !!secret && secret.length >= 16;
}

/**
 * Worker health status
 */
export interface WorkerStatus {
  isRunning: boolean;
  isProcessing: boolean;
  isEnabled: boolean;
  lastProcessedAt: string | null;
  intervalMs: number;
  maxBeaconsPerCycle: number;
  maxChannelsPerCycle: number;
  cumulativeCounts: {
    beacons: number;
    channels: number;
    errors: number;
  };
  surgerySessionActive: boolean;
}

/**
 * Processing cycle result
 */
export interface CycleResult {
  beaconsProcessed: number;
  channelsProcessed: number;
  errors: number;
}

/**
 * Run a single processing cycle with throttling
 * Returns per-cycle counts (not cumulative)
 */
async function runProcessingCycle(): Promise<CycleResult> {
  const result: CycleResult = { beaconsProcessed: 0, channelsProcessed: 0, errors: 0 };
  
  if (isProcessing) {
    console.log('[Editor Worker] Skipping cycle - previous still running');
    return result;
  }
  
  // Security check - don't process without secret
  if (!isSecretConfigured()) {
    console.log('[Editor Worker] Skipping cycle - ARCHITECT_SECRET not configured');
    return result;
  }
  
  isProcessing = true;
  
  try {
    console.log('[Editor Worker] Starting processing cycle...');
    
    // Get pending beacons with throttling (only fetch MAX_BEACONS_PER_CYCLE from DB)
    const beaconsToProcess = await hiveCollaborationService.getPendingSnapshots(undefined, MAX_BEACONS_PER_CYCLE);
    
    // Process beacons one by one with rate limiting
    for (const snapshot of beaconsToProcess) {
      try {
        await editorPersonaService.processBeacon(snapshot.id);
        result.beaconsProcessed++;
        cumulativeCounts.beacons++;
        
        // Rate limit: 500ms between Claude API calls
        if (result.beaconsProcessed < beaconsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        result.errors++;
        cumulativeCounts.errors++;
        console.error(`[Editor Worker] Error processing beacon ${snapshot.id}:`, error);
      }
    }
    
    // Get post-session channels with throttling (only fetch MAX_CHANNELS_PER_CYCLE from DB)
    const channelsToProcess = await hiveCollaborationService.getPostSessionChannels(MAX_CHANNELS_PER_CYCLE);
    
    // Process channels one by one with rate limiting
    for (const channel of channelsToProcess) {
      try {
        await editorPersonaService.generatePostSessionReflection(channel.id);
        result.channelsProcessed++;
        cumulativeCounts.channels++;
        
        // Rate limit: 1s between channel reflections (more substantial API calls)
        if (result.channelsProcessed < channelsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        result.errors++;
        cumulativeCounts.errors++;
        console.error(`[Editor Worker] Error processing channel ${channel.id}:`, error);
      }
    }
    
    lastProcessedAt = new Date();
    
    if (result.beaconsProcessed > 0 || result.channelsProcessed > 0) {
      console.log(`[Editor Worker] Cycle complete: ${result.beaconsProcessed} beacons, ${result.channelsProcessed} channels`);
    }
  } catch (error) {
    result.errors++;
    cumulativeCounts.errors++;
    console.error('[Editor Worker] Error in processing cycle:', error);
  } finally {
    isProcessing = false;
  }
  
  return result;
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
  if (!isSecretConfigured()) {
    console.log('[Editor Worker] Disabled - ARCHITECT_SECRET not configured');
    return false;
  }
  
  console.log(`[Editor Worker] Starting with ${WORKER_INTERVAL_MS}ms interval (max ${MAX_BEACONS_PER_CYCLE} beacons, ${MAX_CHANNELS_PER_CYCLE} channels per cycle)`);
  
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
    isEnabled: isSecretConfigured(),
    lastProcessedAt: lastProcessedAt?.toISOString() || null,
    intervalMs: WORKER_INTERVAL_MS,
    maxBeaconsPerCycle: MAX_BEACONS_PER_CYCLE,
    maxChannelsPerCycle: MAX_CHANNELS_PER_CYCLE,
    cumulativeCounts: { ...cumulativeCounts },
    surgerySessionActive: surgeryOrchestrator.isActive(),
  };
}

/**
 * Trigger an immediate processing cycle (for manual/API trigger)
 * Returns per-cycle counts (not cumulative)
 * SECURITY: Caller must validate ARCHITECT_SECRET before calling
 */
export async function triggerProcessingCycle(): Promise<CycleResult> {
  // Additional security check inside the function
  if (!isSecretConfigured()) {
    throw new Error('ARCHITECT_SECRET not configured - cannot trigger processing');
  }
  
  if (isProcessing) {
    throw new Error('Processing cycle already in progress');
  }
  
  return runProcessingCycle();
}

/**
 * Reset worker statistics
 */
export function resetWorkerStats(): void {
  cumulativeCounts = {
    beacons: 0,
    channels: 0,
    errors: 0,
  };
  console.log('[Editor Worker] Stats reset');
}

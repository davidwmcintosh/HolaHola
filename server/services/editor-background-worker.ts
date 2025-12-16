/**
 * DEPRECATED: Editor Background Worker
 * 
 * This worker is DEPRECATED and DISABLED. The Editor agent has been retired
 * in favor of the unified 3-way Hive (Founder + Daniela + Wren).
 * 
 * Beacon processing is now handled through:
 * - EXPRESS Lane for real-time Founder-Daniela-Wren collaboration
 * - Wren's proactive intelligence system for development responses
 * 
 * This file is kept for reference but the worker no longer starts.
 * 
 * @deprecated Editor retired - use EXPRESS Lane and Wren instead
 */

import { editorPersonaService } from "./editor-persona-service";
import { hiveCollaborationService } from "./hive-collaboration-service";
import { surgeryOrchestrator } from "./collaborative-surgery-orchestrator";

// Worker configuration
const WORKER_INTERVAL_MS = parseInt(process.env.EDITOR_WORKER_INTERVAL_MS || '30000', 10); // 30 seconds default
const MAX_BEACONS_PER_CYCLE = parseInt(process.env.EDITOR_MAX_BEACONS_PER_CYCLE || '10', 10);
const MAX_CHANNELS_PER_CYCLE = parseInt(process.env.EDITOR_MAX_CHANNELS_PER_CYCLE || '3', 10);
const AUDIT_INTERVAL_MS = parseInt(process.env.EDITOR_AUDIT_INTERVAL_MS || '86400000', 10); // 24 hours default

// Worker state
let workerInterval: NodeJS.Timeout | null = null;
let auditInterval: NodeJS.Timeout | null = null;
let isProcessing = false;
let lastProcessedAt: Date | null = null;
let lastAuditAt: Date | null = null;
let cumulativeCounts = {
  beacons: 0,
  channels: 0,
  errors: 0,
  audits: 0,
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
    audits: 0,
  };
  console.log('[Editor Worker] Stats reset');
}

/**
 * Run a neural network audit cycle
 */
async function runAuditCycle(): Promise<void> {
  if (!isSecretConfigured()) {
    console.log('[Editor Worker] Skipping audit - ARCHITECT_SECRET not configured');
    return;
  }
  
  console.log('[Editor Worker] Running neural network audit...');
  
  try {
    const result = await editorPersonaService.auditNeuralNetwork();
    cumulativeCounts.audits++;
    lastAuditAt = new Date();
    console.log(`[Editor Worker] Audit complete: ${result.issues.length} issues found, ${result.surgeryProposals.length} proposals generated`);
  } catch (error) {
    cumulativeCounts.errors++;
    console.error('[Editor Worker] Error in audit cycle:', error);
  }
}

/**
 * Trigger an immediate audit (for API trigger)
 */
export async function triggerAuditCycle(): Promise<{ issues: number; proposals: number }> {
  if (!isSecretConfigured()) {
    throw new Error('ARCHITECT_SECRET not configured - cannot trigger audit');
  }
  
  const result = await editorPersonaService.auditNeuralNetwork();
  cumulativeCounts.audits++;
  lastAuditAt = new Date();
  return { issues: result.issues.length, proposals: result.surgeryProposals.length };
}

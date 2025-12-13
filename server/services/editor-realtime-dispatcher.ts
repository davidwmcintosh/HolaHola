/**
 * Editor Realtime Dispatcher
 * 
 * High-frequency (1s) polling service for processing hive beacons in real-time.
 * Uses PostgreSQL FOR UPDATE SKIP LOCKED pattern for safe concurrent processing.
 * 
 * Features:
 * - 1s polling interval (much faster than the 30s background worker)
 * - 600ms minimum spacing between Claude API calls
 * - Exponential backoff on failures
 * - Worker instance identification for debugging
 * - Graceful shutdown handling
 * 
 * Philosophy: Real-time collaboration requires faster feedback loops than
 * batch processing. This dispatcher bridges the gap between beacon emission
 * and Editor response.
 */

import { db } from "../db";
import { 
  editorBeaconQueue, 
  editorListeningSnapshots,
  InsertEditorBeaconQueue,
  EditorBeaconQueue
} from "@shared/schema";
import { eq, and, sql, isNull, or, lt } from "drizzle-orm";
import { editorPersonaService } from "./editor-persona-service";

// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.REALTIME_POLL_INTERVAL_MS || '1000', 10);
const CLAUDE_CALL_SPACING_MS = parseInt(process.env.REALTIME_CLAUDE_SPACING_MS || '600', 10);
const LOCK_TIMEOUT_MS = parseInt(process.env.REALTIME_LOCK_TIMEOUT_MS || '60000', 10); // 60s lock timeout
const MAX_BEACONS_PER_POLL = parseInt(process.env.REALTIME_MAX_BEACONS_PER_POLL || '5', 10);

// State
let dispatcherInterval: NodeJS.Timeout | null = null;
let isProcessing = false;
let lastClaudeCallAt: number = 0;
const workerId = `worker-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

// Stats
let stats = {
  processed: 0,
  failed: 0,
  retried: 0,
  skipped: 0,
  lastPollAt: null as Date | null,
};

/**
 * Check if ARCHITECT_SECRET is properly configured
 */
function isSecretConfigured(): boolean {
  const secret = process.env.ARCHITECT_SECRET;
  return !!secret && secret.length >= 16;
}

/**
 * Acquire pending beacons using FOR UPDATE SKIP LOCKED
 * This ensures concurrent workers don't process the same beacon
 * Respects backoff by checking lockedAt < NOW() for pending items
 */
async function acquireBeacons(limit: number): Promise<EditorBeaconQueue[]> {
  const lockExpiry = new Date(Date.now() - LOCK_TIMEOUT_MS);
  
  // Use raw SQL for FOR UPDATE SKIP LOCKED - not fully supported in Drizzle yet
  // For pending items, lockedAt is used as "next attempt after" timestamp for backoff
  const result = await db.execute(sql`
    UPDATE editor_beacon_queue
    SET 
      status = 'processing',
      locked_at = NOW(),
      locked_by = ${workerId},
      attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM editor_beacon_queue
      WHERE 
        (
          (status = 'pending' AND (locked_at IS NULL OR locked_at <= NOW()))
          OR (status = 'processing' AND locked_at < ${lockExpiry})
        )
        AND attempts < max_attempts
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  
  // Raw SQL returns snake_case columns, but TypeScript type expects camelCase
  // Map the columns to match the EditorBeaconQueue type
  return result.rows.map((row: any) => ({
    id: row.id,
    snapshotId: row.snapshot_id,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  })) as EditorBeaconQueue[];
}

/**
 * Mark beacon as completed
 */
async function markCompleted(beaconId: string): Promise<void> {
  await db.update(editorBeaconQueue)
    .set({
      status: 'completed',
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(editorBeaconQueue.id, beaconId));
}

/**
 * Mark beacon as failed with backoff delay applied via lockedAt
 * Uses lockedAt as "next attempt after" timestamp to enforce backoff
 */
async function markFailed(beaconId: string, error: string, attempts: number): Promise<void> {
  const [beacon] = await db.select()
    .from(editorBeaconQueue)
    .where(eq(editorBeaconQueue.id, beaconId));
  
  const isPermanentFailure = beacon && beacon.attempts >= beacon.maxAttempts;
  const newStatus = isPermanentFailure ? 'failed' : 'pending';
  
  // Calculate backoff delay and set lockedAt to future time to prevent immediate retry
  const backoffMs = isPermanentFailure ? 0 : getBackoffDelay(attempts);
  const nextAttemptAt = isPermanentFailure ? null : new Date(Date.now() + backoffMs);
  
  await db.update(editorBeaconQueue)
    .set({
      status: newStatus,
      lastError: error,
      lockedAt: nextAttemptAt, // Use lockedAt as "not before" timestamp for backoff
      lockedBy: null,
    })
    .where(eq(editorBeaconQueue.id, beaconId));
}

/**
 * Wait for minimum spacing between Claude calls
 */
async function waitForClaudeSpacing(): Promise<void> {
  const elapsed = Date.now() - lastClaudeCallAt;
  if (elapsed < CLAUDE_CALL_SPACING_MS) {
    await new Promise(resolve => setTimeout(resolve, CLAUDE_CALL_SPACING_MS - elapsed));
  }
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempts: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempts - 1), maxDelay);
  return delay;
}

/**
 * Validate that snapshot exists before processing
 */
async function validateSnapshotExists(snapshotId: string): Promise<boolean> {
  const [snapshot] = await db.select({ id: editorListeningSnapshots.id })
    .from(editorListeningSnapshots)
    .where(eq(editorListeningSnapshots.id, snapshotId))
    .limit(1);
  return !!snapshot;
}

/**
 * Process a single beacon
 */
async function processBeacon(beacon: EditorBeaconQueue): Promise<boolean> {
  try {
    // Defensive: Validate snapshot still exists before processing
    const snapshotExists = await validateSnapshotExists(beacon.snapshotId);
    if (!snapshotExists) {
      console.warn(`[Realtime Dispatcher] Snapshot ${beacon.snapshotId} not found - marking beacon as permanently failed`);
      await db.update(editorBeaconQueue)
        .set({
          status: 'failed',
          lastError: 'Snapshot not found (deleted or never existed)',
          lockedAt: null,
          lockedBy: null,
        })
        .where(eq(editorBeaconQueue.id, beacon.id));
      stats.failed++;
      return false;
    }
    
    // Wait for Claude spacing
    await waitForClaudeSpacing();
    
    // Process the beacon via editor persona service
    await editorPersonaService.processBeacon(beacon.snapshotId);
    
    // Update timing
    lastClaudeCallAt = Date.now();
    
    // Mark as completed
    await markCompleted(beacon.id);
    stats.processed++;
    
    console.log(`[Realtime Dispatcher] Processed beacon ${beacon.id} (snapshot: ${beacon.snapshotId})`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markFailed(beacon.id, errorMessage, beacon.attempts);
    stats.failed++;
    
    // Apply exponential backoff for retries
    if (beacon.attempts < beacon.maxAttempts) {
      const backoffDelay = getBackoffDelay(beacon.attempts);
      console.log(`[Realtime Dispatcher] Beacon ${beacon.id} failed, will retry in ${backoffDelay}ms (attempt ${beacon.attempts}/${beacon.maxAttempts})`);
      stats.retried++;
    } else {
      console.error(`[Realtime Dispatcher] Beacon ${beacon.id} permanently failed after ${beacon.maxAttempts} attempts:`, errorMessage);
    }
    
    return false;
  }
}

/**
 * Run a single poll cycle
 */
async function runPollCycle(): Promise<void> {
  if (isProcessing) {
    stats.skipped++;
    return;
  }
  
  if (!isSecretConfigured()) {
    return;
  }
  
  isProcessing = true;
  stats.lastPollAt = new Date();
  
  try {
    // Acquire beacons with row-level locking
    const beacons = await acquireBeacons(MAX_BEACONS_PER_POLL);
    
    if (beacons.length === 0) {
      return;
    }
    
    console.log(`[Realtime Dispatcher] Acquired ${beacons.length} beacons for processing`);
    
    // Process beacons sequentially (respecting Claude spacing)
    for (const beacon of beacons) {
      await processBeacon(beacon);
    }
  } catch (error) {
    console.error('[Realtime Dispatcher] Poll cycle error:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the realtime dispatcher
 */
export function startRealtimeDispatcher(): boolean {
  if (dispatcherInterval) {
    console.log('[Realtime Dispatcher] Already running');
    return false;
  }
  
  if (!isSecretConfigured()) {
    console.log('[Realtime Dispatcher] Disabled - ARCHITECT_SECRET not configured');
    return false;
  }
  
  console.log(`[Realtime Dispatcher] Starting with ${POLL_INTERVAL_MS}ms interval (worker: ${workerId})`);
  
  // Run immediately, then on interval
  runPollCycle();
  dispatcherInterval = setInterval(runPollCycle, POLL_INTERVAL_MS);
  
  return true;
}

/**
 * Stop the realtime dispatcher
 */
export function stopRealtimeDispatcher(): void {
  if (dispatcherInterval) {
    clearInterval(dispatcherInterval);
    dispatcherInterval = null;
    console.log('[Realtime Dispatcher] Stopped');
  }
}

/**
 * Get dispatcher status
 */
export interface RealtimeDispatcherStatus {
  isRunning: boolean;
  isProcessing: boolean;
  isEnabled: boolean;
  workerId: string;
  pollIntervalMs: number;
  claudeSpacingMs: number;
  maxBeaconsPerPoll: number;
  stats: typeof stats;
}

export function getDispatcherStatus(): RealtimeDispatcherStatus {
  return {
    isRunning: dispatcherInterval !== null,
    isProcessing,
    isEnabled: isSecretConfigured(),
    workerId,
    pollIntervalMs: POLL_INTERVAL_MS,
    claudeSpacingMs: CLAUDE_CALL_SPACING_MS,
    maxBeaconsPerPoll: MAX_BEACONS_PER_POLL,
    stats: { ...stats },
  };
}

/**
 * Reset dispatcher stats
 */
export function resetDispatcherStats(): void {
  stats = {
    processed: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
    lastPollAt: null,
  };
  console.log('[Realtime Dispatcher] Stats reset');
}

/**
 * Enqueue a beacon for processing
 * Called by hive-collaboration-service after emitBeacon()
 */
export async function enqueueBeacon(snapshotId: string): Promise<EditorBeaconQueue> {
  const queueEntry: InsertEditorBeaconQueue = {
    snapshotId,
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
  };
  
  const [inserted] = await db.insert(editorBeaconQueue)
    .values(queueEntry)
    .returning();
  
  console.log(`[Realtime Dispatcher] Beacon enqueued: ${inserted.id} (snapshot: ${snapshotId})`);
  
  return inserted;
}

/**
 * Get queue depth (pending beacons)
 */
export async function getQueueDepth(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(editorBeaconQueue)
    .where(eq(editorBeaconQueue.status, 'pending'));
  
  return Number(result[0]?.count ?? 0);
}

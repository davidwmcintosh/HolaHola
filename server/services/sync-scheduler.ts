import { neuralNetworkSync } from './neural-network-sync';

let scheduledTimer: NodeJS.Timeout | null = null;
let lastSyncResult: { timestamp: Date; success: boolean; syncedCount?: number; error?: string } | null = null;

// 3 AM Mountain Standard Time = 10 AM UTC (MST is UTC-7)
const SYNC_HOUR_UTC = 10;

function getMillisecondsUntilSyncTime(): number {
  const now = new Date();
  const nextSync = new Date(now);
  nextSync.setUTCHours(SYNC_HOUR_UTC, 0, 0, 0);
  
  if (now >= nextSync) {
    nextSync.setUTCDate(nextSync.getUTCDate() + 1);
  }
  
  return nextSync.getTime() - now.getTime();
}

export function getLastSyncResult() {
  return lastSyncResult;
}

async function runNightlySync(): Promise<void> {
  console.log('[SYNC-SCHEDULER] Running nightly auto-sync at', new Date().toISOString());
  
  try {
    const result = await neuralNetworkSync.performAutoSync('system-scheduler');
    
    if (result.success) {
      console.log(`[SYNC-SCHEDULER] Nightly sync complete: ${result.syncedCount} items synced`);
      lastSyncResult = {
        timestamp: new Date(),
        success: true,
        syncedCount: result.syncedCount,
      };
    } else {
      console.error('[SYNC-SCHEDULER] Nightly sync failed:', result.error);
      lastSyncResult = {
        timestamp: new Date(),
        success: false,
        error: result.error,
      };
    }
  } catch (error: any) {
    console.error('[SYNC-SCHEDULER] Error during nightly sync:', error);
    lastSyncResult = {
      timestamp: new Date(),
      success: false,
      error: error.message || 'Unknown error',
    };
  }
  
  scheduleNextSync();
}

function scheduleNextSync(): void {
  const msUntilSync = getMillisecondsUntilSyncTime();
  const hours = Math.floor(msUntilSync / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilSync % (1000 * 60 * 60)) / (1000 * 60));
  
  console.log(`[SYNC-SCHEDULER] Next sync scheduled in ${hours}h ${minutes}m (3 AM MST / 10 AM UTC)`);
  
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
  }
  
  scheduledTimer = setTimeout(runNightlySync, msUntilSync);
}

export function getNextSyncTime(): Date {
  const now = new Date();
  const nextSync = new Date(now);
  nextSync.setUTCHours(SYNC_HOUR_UTC, 0, 0, 0);
  
  if (now >= nextSync) {
    nextSync.setUTCDate(nextSync.getUTCDate() + 1);
  }
  
  return nextSync;
}

export function startSyncScheduler(): void {
  console.log('[SYNC-SCHEDULER] Starting nightly sync scheduler (3 AM MST / 10 AM UTC daily)');
  scheduleNextSync();
}

export function stopSyncScheduler(): void {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
    console.log('[SYNC-SCHEDULER] Scheduler stopped');
  }
}

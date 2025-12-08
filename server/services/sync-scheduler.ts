import { neuralNetworkSync } from './neural-network-sync';

let scheduledTimer: NodeJS.Timeout | null = null;

function getMillisecondsUntil3AM(): number {
  const now = new Date();
  const next3AM = new Date(now);
  next3AM.setHours(3, 0, 0, 0);
  
  if (now >= next3AM) {
    next3AM.setDate(next3AM.getDate() + 1);
  }
  
  return next3AM.getTime() - now.getTime();
}

async function runNightlySync(): Promise<void> {
  console.log('[SYNC-SCHEDULER] Running nightly auto-sync at', new Date().toISOString());
  
  try {
    const result = await neuralNetworkSync.performAutoSync('system-scheduler');
    
    if (result.success) {
      console.log(`[SYNC-SCHEDULER] Nightly sync complete: ${result.syncedCount} items synced`);
    } else {
      console.error('[SYNC-SCHEDULER] Nightly sync failed:', result.error);
    }
  } catch (error) {
    console.error('[SYNC-SCHEDULER] Error during nightly sync:', error);
  }
  
  scheduleNextSync();
}

function scheduleNextSync(): void {
  const msUntil3AM = getMillisecondsUntil3AM();
  const hours = Math.floor(msUntil3AM / (1000 * 60 * 60));
  const minutes = Math.floor((msUntil3AM % (1000 * 60 * 60)) / (1000 * 60));
  
  console.log(`[SYNC-SCHEDULER] Next sync scheduled in ${hours}h ${minutes}m`);
  
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
  }
  
  scheduledTimer = setTimeout(runNightlySync, msUntil3AM);
}

export function startSyncScheduler(): void {
  console.log('[SYNC-SCHEDULER] Starting nightly sync scheduler (3 AM daily)');
  scheduleNextSync();
}

export function stopSyncScheduler(): void {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
    console.log('[SYNC-SCHEDULER] Scheduler stopped');
  }
}

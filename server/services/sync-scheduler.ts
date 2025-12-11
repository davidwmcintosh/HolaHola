import { neuralNetworkSync } from './neural-network-sync';

let scheduledTimer: NodeJS.Timeout | null = null;
let lastSyncResult: { 
  timestamp: Date; 
  success: boolean; 
  syncedCount?: number; 
  expansionCounts?: {
    idioms: { imported: number; skipped: number };
    nuances: { imported: number; skipped: number };
    errorPatterns: { imported: number; skipped: number };
    dialects: { imported: number; skipped: number };
    bridges: { imported: number; skipped: number };
  };
  error?: string;
} | null = null;

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
    // 1. Sync Best Practices (existing)
    const bestPracticesResult = await neuralNetworkSync.performAutoSync('system-scheduler');
    
    // 2. Sync Neural Network Expansion (5 tables)
    // Export approved data and prepare for cross-environment sync
    const expansionData = await neuralNetworkSync.exportNeuralNetworkExpansion();
    
    // Get pending expansion items count for logging
    const pendingExpansion = await neuralNetworkSync.getPendingNeuralNetworkExpansion();
    
    console.log(`[SYNC-SCHEDULER] Neural Network Expansion status:`);
    console.log(`  - Exported ${expansionData.idioms.length} idioms, ${expansionData.nuances.length} nuances`);
    console.log(`  - Exported ${expansionData.errorPatterns.length} error patterns, ${expansionData.dialects.length} dialects`);
    console.log(`  - Exported ${expansionData.bridges.length} linguistic bridges`);
    console.log(`  - Pending (local): ${pendingExpansion.totalCount} items`);
    
    if (bestPracticesResult.success) {
      console.log(`[SYNC-SCHEDULER] Nightly sync complete: ${bestPracticesResult.syncedCount} best practices synced`);
      lastSyncResult = {
        timestamp: new Date(),
        success: true,
        syncedCount: bestPracticesResult.syncedCount,
        expansionCounts: {
          idioms: { imported: 0, skipped: expansionData.idioms.length },
          nuances: { imported: 0, skipped: expansionData.nuances.length },
          errorPatterns: { imported: 0, skipped: expansionData.errorPatterns.length },
          dialects: { imported: 0, skipped: expansionData.dialects.length },
          bridges: { imported: 0, skipped: expansionData.bridges.length },
        },
      };
    } else {
      console.error('[SYNC-SCHEDULER] Nightly sync failed:', bestPracticesResult.error);
      lastSyncResult = {
        timestamp: new Date(),
        success: false,
        error: bestPracticesResult.error,
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

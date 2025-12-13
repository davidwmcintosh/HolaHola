import { neuralNetworkSync } from './neural-network-sync';
import { syncBridge, type SyncResult } from './sync-bridge';
import { isSyncConfigured } from '../middleware/sync-auth';

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
  proceduralMemoryCounts?: {
    tools: number;
    procedures: number;
    principles: number;
    patterns: number;
  };
  crossEnvSync?: {
    push: SyncResult;
    pull: SyncResult;
  };
  error?: string;
} | null = null;

// 4 AM Mountain Standard Time = 11 AM UTC (MST is UTC-7)
// Pushed from 3 AM to give more development time
const SYNC_HOUR_UTC = 11;

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
    // Use null for system operations to avoid FK constraint issues
    const bestPracticesResult = await neuralNetworkSync.performAutoSync(null);
    
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
    
    // 3. Sync Procedural Memory (4 tables: tools, procedures, principles, patterns)
    const proceduralData = await neuralNetworkSync.exportProceduralMemory();
    
    console.log(`[SYNC-SCHEDULER] Procedural Memory status:`);
    console.log(`  - Exported ${proceduralData.tools.length} tools, ${proceduralData.procedures.length} procedures`);
    console.log(`  - Exported ${proceduralData.principles.length} principles, ${proceduralData.patterns.length} patterns`);
    
    // 4. Sync Advanced Intelligence Layer (3 tables: subtlety cues, emotional patterns, creativity templates)
    const advancedIntelligenceData = await neuralNetworkSync.exportAdvancedIntelligence();
    
    console.log(`[SYNC-SCHEDULER] Advanced Intelligence status:`);
    console.log(`  - Exported ${advancedIntelligenceData.subtletyCues.length} subtlety cues`);
    console.log(`  - Exported ${advancedIntelligenceData.emotionalPatterns.length} emotional patterns`);
    console.log(`  - Exported ${advancedIntelligenceData.creativityTemplates.length} creativity templates`);
    
    // 5. Sync Daniela's Proactive Suggestion System (3 tables: suggestions, triggers, actions)
    const danielaSuggestionsData = await neuralNetworkSync.exportDanielaSuggestions();
    
    console.log(`[SYNC-SCHEDULER] Daniela Suggestions status:`);
    console.log(`  - Exported ${danielaSuggestionsData.suggestions.length} suggestions`);
    console.log(`  - Exported ${danielaSuggestionsData.triggers.length} reflection triggers`);
    console.log(`  - Exported ${danielaSuggestionsData.actions.length} suggestion actions`);
    
    // Auto-approve Daniela suggestions for next sync cycle
    const approvedSuggestions = await neuralNetworkSync.autoApproveDanielaSuggestions();
    console.log(`  - Auto-approved ${approvedSuggestions.approved} suggestions for sync`);
    
    // 6. Cross-Environment Sync (bidirectional dev ↔ prod sync)
    let crossEnvResult: { push: SyncResult; pull: SyncResult } | undefined;
    if (isSyncConfigured()) {
      console.log(`[SYNC-SCHEDULER] Cross-environment sync enabled, performing full sync...`);
      crossEnvResult = await syncBridge.performFullSync('nightly');
      console.log(`[SYNC-SCHEDULER] Cross-environment sync complete:`);
      console.log(`  - Push: ${crossEnvResult.push.success ? 'success' : 'failed'} (${crossEnvResult.push.durationMs}ms)`);
      console.log(`  - Pull: ${crossEnvResult.pull.success ? 'success' : 'failed'} (${crossEnvResult.pull.durationMs}ms)`);
    } else {
      console.log(`[SYNC-SCHEDULER] Cross-environment sync not configured (set SYNC_PEER_URL and SYNC_SHARED_SECRET)`);
    }
    
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
        proceduralMemoryCounts: {
          tools: proceduralData.tools.length,
          procedures: proceduralData.procedures.length,
          principles: proceduralData.principles.length,
          patterns: proceduralData.patterns.length,
        },
        crossEnvSync: crossEnvResult,
      };
    } else {
      console.error('[SYNC-SCHEDULER] Nightly sync failed:', bestPracticesResult.error);
      lastSyncResult = {
        timestamp: new Date(),
        success: false,
        error: bestPracticesResult.error,
        crossEnvSync: crossEnvResult,
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

import { db } from '../db';
import { syncRuns, type SyncRun } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { neuralNetworkSync } from './neural-network-sync';
import { createSyncHeaders, isSyncConfigured, getSyncPeerUrl } from '../middleware/sync-auth';
import crypto from 'crypto';

const CURRENT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

export interface SyncBundle {
  generatedAt: string;
  sourceEnvironment: string;
  checksum: string;
  bestPractices: any[];
  idioms: any[];
  nuances: any[];
  errorPatterns: any[];
  dialects: any[];
  bridges: any[];
  tools: any[];
  procedures: any[];
  principles: any[];
  patterns: any[];
  subtletyCues: any[];
  emotionalPatterns: any[];
  creativityTemplates: any[];
  suggestions: any[];
  triggers: any[];
  actions: any[];
  observations: any[];
  alerts: any[];
}

export interface SyncResult {
  success: boolean;
  syncRunId?: string;
  counts: Record<string, number>;
  errors: string[];
  durationMs: number;
}

class SyncBridgeService {
  
  async collectExportBundle(): Promise<SyncBundle> {
    const bestPractices = await neuralNetworkSync.getBestPracticesForExport();
    const expansion = await neuralNetworkSync.exportNeuralNetworkExpansion();
    const procedural = await neuralNetworkSync.exportProceduralMemory();
    const advanced = await neuralNetworkSync.exportAdvancedIntelligence();
    const daniela = await neuralNetworkSync.exportDanielaSuggestions();
    const triLane = await neuralNetworkSync.exportTriLaneObservations();
    
    const bundle: SyncBundle = {
      generatedAt: new Date().toISOString(),
      sourceEnvironment: CURRENT_ENVIRONMENT,
      checksum: '',
      bestPractices,
      idioms: expansion.idioms,
      nuances: expansion.nuances,
      errorPatterns: expansion.errorPatterns,
      dialects: expansion.dialects,
      bridges: expansion.bridges,
      tools: procedural.tools,
      procedures: procedural.procedures,
      principles: procedural.principles,
      patterns: procedural.patterns,
      subtletyCues: advanced.subtletyCues,
      emotionalPatterns: advanced.emotionalPatterns,
      creativityTemplates: advanced.creativityTemplates,
      suggestions: daniela.suggestions,
      triggers: daniela.triggers,
      actions: daniela.actions,
      observations: [...triLane.agentObservations, ...triLane.supportObservations],
      alerts: triLane.systemAlerts,
    };
    
    bundle.checksum = this.computeChecksum(bundle);
    return bundle;
  }
  
  async applyImportBundle(bundle: SyncBundle): Promise<SyncResult> {
    const startTime = Date.now();
    const counts: Record<string, number> = {};
    const errors: string[] = [];
    
    const importWithCount = async (
      name: string,
      items: any[],
      importFn: (item: any) => Promise<any>
    ) => {
      let successCount = 0;
      for (const item of items) {
        try {
          const result = await importFn(item);
          if (result?.success) successCount++;
        } catch (err: any) {
          errors.push(`${name}: ${err.message}`);
        }
      }
      counts[name] = successCount;
    };
    
    await importWithCount('bestPractices', bundle.bestPractices, 
      (bp) => neuralNetworkSync.importBestPractice(bp, 'sync-bridge'));
    await importWithCount('idioms', bundle.idioms, 
      (i) => neuralNetworkSync.importLanguageIdiom(i, 'sync-bridge'));
    await importWithCount('nuances', bundle.nuances, 
      (n) => neuralNetworkSync.importCulturalNuance(n, 'sync-bridge'));
    await importWithCount('errorPatterns', bundle.errorPatterns, 
      (e) => neuralNetworkSync.importLearnerErrorPattern(e, 'sync-bridge'));
    await importWithCount('dialects', bundle.dialects, 
      (d) => neuralNetworkSync.importDialectVariation(d, 'sync-bridge'));
    await importWithCount('bridges', bundle.bridges, 
      (b) => neuralNetworkSync.importLinguisticBridge(b, 'sync-bridge'));
    await importWithCount('tools', bundle.tools, 
      (t) => neuralNetworkSync.importToolKnowledge(t, 'sync-bridge'));
    await importWithCount('procedures', bundle.procedures, 
      (p) => neuralNetworkSync.importTutorProcedure(p, 'sync-bridge'));
    await importWithCount('principles', bundle.principles, 
      (p) => neuralNetworkSync.importTeachingPrinciple(p, 'sync-bridge'));
    await importWithCount('patterns', bundle.patterns, 
      (p) => neuralNetworkSync.importSituationalPattern(p, 'sync-bridge'));
    
    // Advanced intelligence is a batch import
    if (bundle.subtletyCues.length || bundle.emotionalPatterns.length || bundle.creativityTemplates.length) {
      try {
        const result = await neuralNetworkSync.importAdvancedIntelligence({
          subtletyCues: bundle.subtletyCues,
          emotionalPatterns: bundle.emotionalPatterns,
          creativityTemplates: bundle.creativityTemplates,
        }, 'sync-bridge');
        counts['subtletyCues'] = result.subtletyCuesImported;
        counts['emotionalPatterns'] = result.emotionalPatternsImported;
        counts['creativityTemplates'] = result.creativityTemplatesImported;
      } catch (err: any) {
        errors.push(`advancedIntelligence: ${err.message}`);
      }
    }
    
    await importWithCount('triggers', bundle.triggers, 
      (t) => neuralNetworkSync.importReflectionTrigger(t));
    await importWithCount('observations', bundle.observations, 
      (o) => neuralNetworkSync.importAgentObservation(o));
    await importWithCount('alerts', bundle.alerts, 
      (a) => neuralNetworkSync.importSystemAlert(a));
    
    return {
      success: errors.length === 0,
      counts,
      errors,
      durationMs: Date.now() - startTime,
    };
  }
  
  async pushToPeer(triggeredBy: string = 'manual'): Promise<SyncResult> {
    const startTime = Date.now();
    const peerUrl = getSyncPeerUrl();
    
    if (!peerUrl || !isSyncConfigured()) {
      return {
        success: false,
        counts: {},
        errors: ['Sync not configured - set SYNC_PEER_URL and SYNC_SHARED_SECRET'],
        durationMs: Date.now() - startTime,
      };
    }
    
    const [syncRun] = await db.insert(syncRuns).values({
      direction: 'push',
      peerUrl,
      sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      targetEnvironment: CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production',
      status: 'running',
      triggeredBy,
    }).returning();
    
    try {
      const bundle = await this.collectExportBundle();
      const headers = createSyncHeaders(bundle);
      
      const response = await fetch(`${peerUrl}/api/sync/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bundle),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Peer rejected: ${response.status} - ${error}`);
      }
      
      const result = await response.json() as SyncResult;
      
      await db.update(syncRuns)
        .set({
          status: result.success ? 'success' : 'partial',
          bestPracticesCount: result.counts.bestPractices || 0,
          idiomCount: result.counts.idioms || 0,
          nuanceCount: result.counts.nuances || 0,
          errorPatternCount: result.counts.errorPatterns || 0,
          dialectCount: result.counts.dialects || 0,
          bridgeCount: result.counts.bridges || 0,
          toolCount: result.counts.tools || 0,
          procedureCount: result.counts.procedures || 0,
          principleCount: result.counts.principles || 0,
          patternCount: result.counts.patterns || 0,
          subtletyCount: result.counts.subtletyCues || 0,
          emotionalCount: result.counts.emotionalPatterns || 0,
          creativityCount: result.counts.creativityTemplates || 0,
          suggestionCount: result.counts.suggestions || 0,
          triggerCount: result.counts.triggers || 0,
          actionCount: result.counts.actions || 0,
          observationCount: result.counts.observations || 0,
          alertCount: result.counts.alerts || 0,
          durationMs: Date.now() - startTime,
          payloadChecksum: bundle.checksum,
          completedAt: new Date(),
          errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        })
        .where(eq(syncRuns.id, syncRun.id));
      
      return { ...result, syncRunId: syncRun.id };
      
    } catch (err: any) {
      await db.update(syncRuns)
        .set({
          status: 'failed',
          errorMessage: err.message,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        })
        .where(eq(syncRuns.id, syncRun.id));
      
      return {
        success: false,
        syncRunId: syncRun.id,
        counts: {},
        errors: [err.message],
        durationMs: Date.now() - startTime,
      };
    }
  }
  
  async pullFromPeer(triggeredBy: string = 'manual'): Promise<SyncResult> {
    const startTime = Date.now();
    const peerUrl = getSyncPeerUrl();
    
    if (!peerUrl || !isSyncConfigured()) {
      return {
        success: false,
        counts: {},
        errors: ['Sync not configured - set SYNC_PEER_URL and SYNC_SHARED_SECRET'],
        durationMs: Date.now() - startTime,
      };
    }
    
    const [syncRun] = await db.insert(syncRuns).values({
      direction: 'pull',
      peerUrl,
      sourceEnvironment: CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production',
      targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      status: 'running',
      triggeredBy,
    }).returning();
    
    try {
      const requestPayload = { requestedAt: new Date().toISOString() };
      const headers = createSyncHeaders(requestPayload);
      
      const response = await fetch(`${peerUrl}/api/sync/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Peer rejected: ${response.status} - ${error}`);
      }
      
      const bundle = await response.json() as SyncBundle;
      const result = await this.applyImportBundle(bundle);
      
      await db.update(syncRuns)
        .set({
          status: result.success ? 'success' : 'partial',
          bestPracticesCount: result.counts.bestPractices || 0,
          idiomCount: result.counts.idioms || 0,
          nuanceCount: result.counts.nuances || 0,
          errorPatternCount: result.counts.errorPatterns || 0,
          dialectCount: result.counts.dialects || 0,
          bridgeCount: result.counts.bridges || 0,
          toolCount: result.counts.tools || 0,
          procedureCount: result.counts.procedures || 0,
          principleCount: result.counts.principles || 0,
          patternCount: result.counts.patterns || 0,
          subtletyCount: result.counts.subtletyCues || 0,
          emotionalCount: result.counts.emotionalPatterns || 0,
          creativityCount: result.counts.creativityTemplates || 0,
          suggestionCount: result.counts.suggestions || 0,
          triggerCount: result.counts.triggers || 0,
          actionCount: result.counts.actions || 0,
          observationCount: result.counts.observations || 0,
          alertCount: result.counts.alerts || 0,
          durationMs: Date.now() - startTime,
          payloadChecksum: bundle.checksum,
          completedAt: new Date(),
          errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        })
        .where(eq(syncRuns.id, syncRun.id));
      
      return { ...result, syncRunId: syncRun.id };
      
    } catch (err: any) {
      await db.update(syncRuns)
        .set({
          status: 'failed',
          errorMessage: err.message,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        })
        .where(eq(syncRuns.id, syncRun.id));
      
      return {
        success: false,
        syncRunId: syncRun.id,
        counts: {},
        errors: [err.message],
        durationMs: Date.now() - startTime,
      };
    }
  }
  
  async getSyncStatus(): Promise<{
    configured: boolean;
    peerUrl: string | null;
    currentEnvironment: string;
    lastPush: SyncRun | null;
    lastPull: SyncRun | null;
    recentRuns: SyncRun[];
  }> {
    const [lastPush] = await db.select()
      .from(syncRuns)
      .where(eq(syncRuns.direction, 'push'))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);
    
    const [lastPull] = await db.select()
      .from(syncRuns)
      .where(eq(syncRuns.direction, 'pull'))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);
    
    const recentRuns = await db.select()
      .from(syncRuns)
      .orderBy(desc(syncRuns.startedAt))
      .limit(10);
    
    return {
      configured: isSyncConfigured(),
      peerUrl: getSyncPeerUrl(),
      currentEnvironment: CURRENT_ENVIRONMENT,
      lastPush: lastPush || null,
      lastPull: lastPull || null,
      recentRuns,
    };
  }
  
  async performFullSync(triggeredBy: string = 'manual'): Promise<{
    push: SyncResult;
    pull: SyncResult;
  }> {
    const push = await this.pushToPeer(triggeredBy);
    const pull = await this.pullFromPeer(triggeredBy);
    return { push, pull };
  }
  
  private computeChecksum(bundle: Omit<SyncBundle, 'checksum'>): string {
    const content = JSON.stringify({
      ...bundle,
      checksum: undefined,
    });
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
}

export const syncBridge = new SyncBridgeService();

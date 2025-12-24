import { db } from '../db';
import { syncRuns, founderSessions, collaborationMessages, hiveSnapshots, danielaGrowthMemories, users, type SyncRun } from '@shared/schema';
import { eq, desc, gte, and, isNull, or, inArray, lt } from 'drizzle-orm';
import { neuralNetworkSync } from './neural-network-sync';
import { createSyncHeaders, isSyncConfigured, getSyncPeerUrl } from '../middleware/sync-auth';
import crypto from 'crypto';

const CURRENT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

// Version identifier to verify which code is running on production
// Increment this when making sync-related changes to verify deployment
const SYNC_BRIDGE_CODE_VERSION = "2024-12-24-v16-resumable-sync";

export interface SyncBundle {
  generatedAt: string;
  sourceEnvironment: string;
  codeVersion?: string;  // Added to verify which code version is deployed
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
  observationsPagination?: {
    offset: number;
    limit: number;
    agentTotal: number;
    supportTotal: number;
    alertsTotal: number;
    hasMore: boolean;
  } | null;
  northStarPrinciples: any[];
  northStarUnderstanding: any[];
  northStarExamples: any[];
  // NEW: Express Lane, Hive Snapshots, and Daniela's Memories
  founderUser: any | null;  // Founder user for EXPRESS Lane FK
  expressLaneSessions: any[];
  expressLaneMessages: any[];
  hiveSnapshots: any[];
  danielaGrowthMemories: any[];
}

export interface SyncResult {
  success: boolean;
  syncRunId?: string;
  counts: Record<string, number>;
  errors: string[];
  durationMs: number;
}

class SyncBridgeService {
  
  /**
   * Get the timestamp of the last successful push sync
   * Used for incremental sync to only export newer items
   */
  async getLastSuccessfulPushTime(): Promise<Date | null> {
    const [lastPush] = await db
      .select()
      .from(syncRuns)
      .where(
        and(
          eq(syncRuns.direction, 'push'),
          eq(syncRuns.status, 'success')
        )
      )
      .orderBy(desc(syncRuns.completedAt))
      .limit(1);
    
    return lastPush?.completedAt || null;
  }
  
  async collectExportBundle(incrementalSince?: Date | null, batchType?: string): Promise<Partial<SyncBundle>> {
    // If a specific batch type is requested, only export that batch
    // This enables batched sync to avoid timeout issues
    
    const bundle: Partial<SyncBundle> = {
      generatedAt: new Date().toISOString(),
      sourceEnvironment: CURRENT_ENVIRONMENT,
      codeVersion: SYNC_BRIDGE_CODE_VERSION,
    };
    
    const batchErrors: string[] = [];
    
    // BATCH: neural-core - Best practices, expansion, procedural
    if (!batchType || batchType === 'neural-core') {
      try {
        const bestPractices = await neuralNetworkSync.getBestPracticesForExport();
        const expansion = await neuralNetworkSync.exportNeuralNetworkExpansion();
        const procedural = await neuralNetworkSync.exportProceduralMemory();
        
        bundle.bestPractices = bestPractices || [];
        bundle.idioms = expansion?.idioms || [];
        bundle.nuances = expansion?.nuances || [];
        bundle.errorPatterns = expansion?.errorPatterns || [];
        bundle.dialects = expansion?.dialects || [];
        bundle.bridges = expansion?.bridges || [];
        bundle.tools = procedural?.tools || [];
        bundle.procedures = procedural?.procedures || [];
        bundle.principles = procedural?.principles || [];
        bundle.patterns = procedural?.patterns || [];
      } catch (err: any) {
        const errMsg = `neural-core export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        // Return empty arrays for this batch so export can continue
        bundle.bestPractices = [];
        bundle.idioms = [];
        bundle.nuances = [];
        bundle.errorPatterns = [];
        bundle.dialects = [];
        bundle.bridges = [];
        bundle.tools = [];
        bundle.procedures = [];
        bundle.principles = [];
        bundle.patterns = [];
      }
    }
    
    // BATCH: advanced-intel-a - Advanced intelligence + Daniela suggestions (SPLIT from advanced-intel for timeout fix)
    // v14: Split into smaller batches to stay under Replit's 60s gateway timeout
    if (!batchType || batchType === 'advanced-intel-a' || batchType === 'advanced-intel') {
      const batchStart = Date.now();
      console.log(`[SYNC-BRIDGE v14] advanced-intel-a batch START at ${new Date().toISOString()}`);
      
      let advanced: any = { subtletyCues: [], emotionalPatterns: [], creativityTemplates: [] };
      let daniela: any = { suggestions: [], triggers: [], actions: [] };
      
      // Export 1: exportAdvancedIntelligence
      console.log(`[SYNC-BRIDGE v14] Step 1/2: exportAdvancedIntelligence...`);
      try {
        advanced = await neuralNetworkSync.exportAdvancedIntelligence();
        console.log(`[SYNC-BRIDGE v14] Step 1 OK: ${advanced?.subtletyCues?.length || 0} cues, ${advanced?.emotionalPatterns?.length || 0} emotions, ${advanced?.creativityTemplates?.length || 0} templates (+${Date.now() - batchStart}ms)`);
      } catch (e: any) {
        console.error(`[SYNC-BRIDGE v14] Step 1 FAILED after ${Date.now() - batchStart}ms:`, e?.message || String(e));
        batchErrors.push(`advanced-intel-a step1: ${e?.message || 'unknown'}`);
      }
      
      // Export 2: exportDanielaSuggestions
      console.log(`[SYNC-BRIDGE v14] Step 2/2: exportDanielaSuggestions...`);
      try {
        daniela = await neuralNetworkSync.exportDanielaSuggestions();
        console.log(`[SYNC-BRIDGE v14] Step 2 OK: ${daniela?.suggestions?.length || 0} suggestions, ${daniela?.triggers?.length || 0} triggers, ${daniela?.actions?.length || 0} actions (+${Date.now() - batchStart}ms)`);
      } catch (e: any) {
        console.error(`[SYNC-BRIDGE v14] Step 2 FAILED after ${Date.now() - batchStart}ms:`, e?.message || String(e));
        batchErrors.push(`advanced-intel-a step2: ${e?.message || 'unknown'}`);
      }
      
      // Assign to bundle
      bundle.subtletyCues = Array.isArray(advanced?.subtletyCues) ? advanced.subtletyCues : [];
      bundle.emotionalPatterns = Array.isArray(advanced?.emotionalPatterns) ? advanced.emotionalPatterns : [];
      bundle.creativityTemplates = Array.isArray(advanced?.creativityTemplates) ? advanced.creativityTemplates : [];
      bundle.suggestions = Array.isArray(daniela?.suggestions) ? daniela.suggestions : [];
      bundle.triggers = Array.isArray(daniela?.triggers) ? daniela.triggers : [];
      bundle.actions = Array.isArray(daniela?.actions) ? daniela.actions : [];
      
      console.log(`[SYNC-BRIDGE v14] advanced-intel-a batch COMPLETE in ${Date.now() - batchStart}ms`);
    }
    
    // BATCH: advanced-intel-b - TriLane observations + North Star
    // Supports pagination: advanced-intel-b (page 0), advanced-intel-b-p1, advanced-intel-b-p2, etc.
    const isIntelBBatch = !batchType || batchType === 'advanced-intel-b' || batchType === 'advanced-intel' || batchType.startsWith('advanced-intel-b-p');
    if (isIntelBBatch) {
      const batchStart = Date.now();
      
      // Parse page number from batchType (e.g., "advanced-intel-b-p2" → page 2)
      let page = 0;
      if (batchType?.startsWith('advanced-intel-b-p')) {
        page = parseInt(batchType.replace('advanced-intel-b-p', ''), 10) || 0;
      }
      
      console.log(`[SYNC-BRIDGE v15] advanced-intel-b batch START (page=${page}) at ${new Date().toISOString()}`);
      
      let triLane: any = { agentObservations: [], supportObservations: [], systemAlerts: [], pagination: null };
      let northStar: any = { principles: [], understanding: [], examples: [] };
      
      // Export 1: exportTriLaneObservations with pagination
      console.log(`[SYNC-BRIDGE v15] Step 1/2: exportTriLaneObservations (page=${page})...`);
      try {
        triLane = await neuralNetworkSync.exportTriLaneObservations({ page });
        const pag = triLane?.pagination;
        console.log(`[SYNC-BRIDGE v15] Step 1 OK: ${triLane?.agentObservations?.length || 0}/${pag?.agentTotal || '?'} agent, ${triLane?.supportObservations?.length || 0}/${pag?.supportTotal || '?'} support, ${triLane?.systemAlerts?.length || 0}/${pag?.alertsTotal || '?'} alerts, hasMore=${pag?.hasMore} (+${Date.now() - batchStart}ms)`);
      } catch (e: any) {
        console.error(`[SYNC-BRIDGE v15] Step 1 FAILED after ${Date.now() - batchStart}ms:`, e?.message || String(e));
        batchErrors.push(`advanced-intel-b step1: ${e?.message || 'unknown'}`);
      }
      
      // Export 2: exportNorthStar (only on first page to avoid duplication)
      if (page === 0) {
        console.log(`[SYNC-BRIDGE v15] Step 2/2: exportNorthStar...`);
        try {
          northStar = await neuralNetworkSync.exportNorthStar();
          console.log(`[SYNC-BRIDGE v15] Step 2 OK: ${northStar?.principles?.length || 0} principles, ${northStar?.understanding?.length || 0} understanding, ${northStar?.examples?.length || 0} examples (+${Date.now() - batchStart}ms)`);
        } catch (e: any) {
          console.error(`[SYNC-BRIDGE v15] Step 2 FAILED after ${Date.now() - batchStart}ms:`, e?.message || String(e));
          batchErrors.push(`advanced-intel-b step2: ${e?.message || 'unknown'}`);
        }
      }
      
      // Assign to bundle
      bundle.observations = [
        ...(Array.isArray(triLane?.agentObservations) ? triLane.agentObservations : []),
        ...(Array.isArray(triLane?.supportObservations) ? triLane.supportObservations : [])
      ];
      bundle.alerts = Array.isArray(triLane?.systemAlerts) ? triLane.systemAlerts : [];
      bundle.observationsPagination = triLane?.pagination || null;
      
      // Only include North Star on first page
      if (page === 0) {
        bundle.northStarPrinciples = Array.isArray(northStar?.principles) ? northStar.principles : [];
        bundle.northStarUnderstanding = Array.isArray(northStar?.understanding) ? northStar.understanding : [];
        bundle.northStarExamples = Array.isArray(northStar?.examples) ? northStar.examples : [];
      }
      
      console.log(`[SYNC-BRIDGE v15] advanced-intel-b batch (page=${page}) COMPLETE in ${Date.now() - batchStart}ms`);
    }
    
    // BATCH: express-lane - Founder user, sessions, messages
    if (!batchType || batchType === 'express-lane') {
      try {
        const founderUser = await this.exportFounderUser();
        const expressLaneData = await this.exportExpressLaneData(incrementalSince);
        
        bundle.founderUser = founderUser;
        bundle.expressLaneSessions = expressLaneData.sessions;
        bundle.expressLaneMessages = expressLaneData.messages;
      } catch (err: any) {
        const errMsg = `express-lane export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.founderUser = null;
        bundle.expressLaneSessions = [];
        bundle.expressLaneMessages = [];
      }
    }
    
    // BATCH: hive-snapshots - Hive snapshots only
    if (!batchType || batchType === 'hive-snapshots' || batchType === 'hive-memories') {
      try {
        const hiveSnapshotData = await this.exportHiveSnapshots(incrementalSince);
        bundle.hiveSnapshots = hiveSnapshotData;
      } catch (err: any) {
        const errMsg = `hive-snapshots export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.hiveSnapshots = [];
      }
    }
    
    // BATCH: daniela-memories - Daniela growth memories only
    if (!batchType || batchType === 'daniela-memories' || batchType === 'hive-memories') {
      try {
        const danielaMemories = await this.exportDanielaGrowthMemories(incrementalSince);
        bundle.danielaGrowthMemories = danielaMemories;
      } catch (err: any) {
        const errMsg = `daniela-memories export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.danielaGrowthMemories = [];
      }
    }
    
    // Add batch errors to bundle for debugging (moved to end)
    if (batchErrors.length > 0) {
      (bundle as any).exportErrors = batchErrors;
    }
    
    bundle.checksum = this.computeChecksum(bundle);
    
    // GROWTH MONITORING: Log batch sizes to detect when pagination may be needed
    // Alert threshold: 2MB payload or 2000+ records
    const PAYLOAD_WARN_THRESHOLD = 2 * 1024 * 1024; // 2MB
    const RECORD_WARN_THRESHOLD = 2000;
    
    const recordCounts: Record<string, number> = {
      bestPractices: bundle.bestPractices?.length || 0,
      idioms: bundle.idioms?.length || 0,
      nuances: bundle.nuances?.length || 0,
      tools: bundle.tools?.length || 0,
      procedures: bundle.procedures?.length || 0,
      principles: bundle.principles?.length || 0,
      patterns: bundle.patterns?.length || 0,
      subtletyCues: bundle.subtletyCues?.length || 0,
      emotionalPatterns: bundle.emotionalPatterns?.length || 0,
      creativityTemplates: bundle.creativityTemplates?.length || 0,
      suggestions: bundle.suggestions?.length || 0,
      triggers: bundle.triggers?.length || 0,
      observations: bundle.observations?.length || 0,
      alerts: bundle.alerts?.length || 0,
      expressLaneSessions: bundle.expressLaneSessions?.length || 0,
      expressLaneMessages: bundle.expressLaneMessages?.length || 0,
      hiveSnapshots: bundle.hiveSnapshots?.length || 0,
      danielaGrowthMemories: bundle.danielaGrowthMemories?.length || 0,
    };
    
    // Check for high record counts that may need pagination soon
    const highGrowthTables = Object.entries(recordCounts)
      .filter(([_, count]) => count >= RECORD_WARN_THRESHOLD)
      .map(([table, count]) => `${table}=${count}`);
    
    if (highGrowthTables.length > 0 && batchType) {
      console.warn(`[SYNC-GROWTH] ⚠️ Batch ${batchType} has high record counts: ${highGrowthTables.join(', ')} - consider pagination`);
    }
    
    return bundle;
  }
  
  /**
   * Export founder user for EXPRESS Lane FK dependency
   * This ensures the founder user exists on target before syncing sessions
   */
  async exportFounderUser(): Promise<any | null> {
    const FOUNDER_ID = '49847136';
    
    const [founder] = await db
      .select()
      .from(users)
      .where(eq(users.id, FOUNDER_ID))
      .limit(1);
    
    if (founder) {
      console.log(`[SYNC-BRIDGE] Exporting founder user: ${founder.email}`);
    }
    return founder || null;
  }
  
  /**
   * Export Express Lane sessions and messages for cross-environment sync
   * Uses incrementalSince for delta sync, falls back to 7-day window
   */
  async exportExpressLaneData(incrementalSince?: Date | null): Promise<{ sessions: any[]; messages: any[] }> {
    // Use incrementalSince if available, otherwise 7-day window for manageable payload
    const sinceDate = incrementalSince || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const sessions = await db
      .select()
      .from(founderSessions)
      .where(gte(founderSessions.updatedAt, sinceDate))
      .orderBy(desc(founderSessions.updatedAt));
    
    const sessionIds = sessions.map(s => s.id);
    
    let messages: any[] = [];
    if (sessionIds.length > 0) {
      messages = await db
        .select()
        .from(collaborationMessages)
        .where(
          and(
            gte(collaborationMessages.createdAt, sinceDate),
            inArray(collaborationMessages.sessionId, sessionIds)
          )
        )
        .orderBy(desc(collaborationMessages.createdAt));
    }
    
    console.log(`[SYNC-BRIDGE] Exporting ${sessions.length} Express Lane sessions, ${messages.length} messages`);
    return { sessions, messages };
  }
  
  /**
   * Export Hive Snapshots for cross-environment sync
   * Uses incrementalSince for delta sync, falls back to 7-day window
   */
  async exportHiveSnapshots(incrementalSince?: Date | null): Promise<any[]> {
    // Use incrementalSince if available, otherwise 7-day window for manageable payload
    const sinceDate = incrementalSince || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const snapshots = await db
      .select()
      .from(hiveSnapshots)
      .where(gte(hiveSnapshots.createdAt, sinceDate))
      .orderBy(desc(hiveSnapshots.createdAt));
    
    console.log(`[SYNC-BRIDGE] Exporting ${snapshots.length} Hive Snapshots (since ${sinceDate.toISOString()})`);
    return snapshots;
  }
  
  /**
   * Export Daniela's Growth Memories for cross-environment sync
   * Uses incrementalSince for delta sync, falls back to 7-day window
   */
  async exportDanielaGrowthMemories(incrementalSince?: Date | null): Promise<any[]> {
    // Use incrementalSince if available, otherwise 7-day window for manageable payload
    const sinceDate = incrementalSince || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const memories = await db
      .select()
      .from(danielaGrowthMemories)
      .where(gte(danielaGrowthMemories.createdAt, sinceDate))
      .orderBy(desc(danielaGrowthMemories.createdAt));
    
    console.log(`[SYNC-BRIDGE] Exporting ${memories.length} Daniela Growth Memories (since ${sinceDate.toISOString()})`);
    return memories;
  }
  
  async applyImportBundle(bundle: SyncBundle): Promise<SyncResult> {
    const startTime = Date.now();
    const counts: Record<string, number> = {};
    const errors: string[] = [];
    
    // Process items in parallel batches for speed (25 concurrent, prevents DB connection exhaustion)
    const BATCH_CONCURRENCY = 25;
    
    const importWithCount = async (
      name: string,
      items: any[] | undefined,
      importFn: (item: any) => Promise<any>
    ) => {
      // Handle partial bundles - skip if array is undefined or empty
      if (!items || !Array.isArray(items) || items.length === 0) {
        return;
      }
      let successCount = 0;
      
      // Process in parallel batches of BATCH_CONCURRENCY
      for (let i = 0; i < items.length; i += BATCH_CONCURRENCY) {
        const batch = items.slice(i, i + BATCH_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(item => importFn(item))
        );
        
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value?.success) {
            successCount++;
          } else if (result.status === 'rejected') {
            errors.push(`${name}: ${result.reason?.message || 'Unknown error'}`);
          }
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
    
    // Advanced intelligence is a batch import - handle partial bundles
    const hasSubtlety = bundle.subtletyCues?.length > 0;
    const hasEmotional = bundle.emotionalPatterns?.length > 0;
    const hasCreativity = bundle.creativityTemplates?.length > 0;
    if (hasSubtlety || hasEmotional || hasCreativity) {
      try {
        const result = await neuralNetworkSync.importAdvancedIntelligence({
          subtletyCues: bundle.subtletyCues || [],
          emotionalPatterns: bundle.emotionalPatterns || [],
          creativityTemplates: bundle.creativityTemplates || [],
        }, 'sync-bridge');
        counts['subtletyCues'] = result.counts.cues.imported;
        counts['emotionalPatterns'] = result.counts.emotions.imported;
        counts['creativityTemplates'] = result.counts.creativity.imported;
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
    
    // North Star sync (constitutional foundation)
    // Principles must be imported first to build source→local ID mapping
    if (bundle.northStarPrinciples?.length || bundle.northStarUnderstanding?.length || bundle.northStarExamples?.length) {
      // Build mapping from source principleId to local principleId
      const principleIdMapping: Map<string, string> = new Map();
      
      for (const principle of bundle.northStarPrinciples || []) {
        try {
          const result = await neuralNetworkSync.importNorthStarPrinciple(principle, 'sync-bridge');
          if (result?.success && result.sourceId && result.id) {
            principleIdMapping.set(result.sourceId, result.id);
          }
          if (result?.success) {
            counts['northStarPrinciples'] = (counts['northStarPrinciples'] || 0) + 1;
          } else if (result?.error) {
            errors.push(`northStarPrinciples: ${result.error}`);
          }
        } catch (err: any) {
          errors.push(`northStarPrinciples: ${err.message}`);
        }
      }
      
      // Import understanding using the principle ID mapping
      for (const understanding of bundle.northStarUnderstanding || []) {
        try {
          const localPrincipleId = understanding.principleId ? principleIdMapping.get(understanding.principleId) : undefined;
          if (!localPrincipleId && understanding.principleId) {
            console.warn(`[SYNC] No local principle mapping for understanding (sourceId: ${understanding.principleId})`);
          }
          const result = await neuralNetworkSync.importNorthStarUnderstanding(understanding, 'sync-bridge', localPrincipleId);
          if (result?.success) {
            counts['northStarUnderstanding'] = (counts['northStarUnderstanding'] || 0) + 1;
          } else if (result?.error) {
            errors.push(`northStarUnderstanding: ${result.error}`);
          }
        } catch (err: any) {
          errors.push(`northStarUnderstanding: ${err.message}`);
        }
      }
      
      // Import examples using the principle ID mapping
      for (const example of bundle.northStarExamples || []) {
        try {
          const localPrincipleId = example.principleId ? principleIdMapping.get(example.principleId) : undefined;
          if (!localPrincipleId && example.principleId) {
            console.warn(`[SYNC] No local principle mapping for example (sourceId: ${example.principleId})`);
          }
          const result = await neuralNetworkSync.importNorthStarExample(example, 'sync-bridge', localPrincipleId);
          if (result?.success) {
            counts['northStarExamples'] = (counts['northStarExamples'] || 0) + 1;
          } else if (result?.error) {
            errors.push(`northStarExamples: ${result.error}`);
          }
        } catch (err: any) {
          errors.push(`northStarExamples: ${err.message}`);
        }
      }
    }
    
    // NEW: Import Express Lane, Hive Snapshots, and Daniela's Memories
    // First: Import founder user to satisfy FK constraint
    if (bundle.founderUser) {
      console.log(`[SYNC-BRIDGE] Importing founder user: ${bundle.founderUser.email}`);
      const founderResult = await this.importFounderUser(bundle.founderUser);
      if (founderResult.success) {
        counts['founderUser'] = 1;
      } else if (founderResult.error) {
        errors.push(`founderUser: ${founderResult.error}`);
      }
    }
    
    if (bundle.expressLaneSessions?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.expressLaneSessions.length} Express Lane sessions...`);
      const sessionResult = await this.importExpressLaneSessions(bundle.expressLaneSessions);
      counts['expressLaneSessions'] = sessionResult.imported;
      if (sessionResult.errors.length) {
        console.error(`[SYNC-BRIDGE] Express Lane session errors:`, sessionResult.errors);
        errors.push(...sessionResult.errors);
      }
    }
    
    if (bundle.expressLaneMessages?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.expressLaneMessages.length} Express Lane messages...`);
      const messageResult = await this.importExpressLaneMessages(bundle.expressLaneMessages);
      counts['expressLaneMessages'] = messageResult.imported;
      if (messageResult.errors.length) {
        console.error(`[SYNC-BRIDGE] Express Lane message errors:`, messageResult.errors);
        errors.push(...messageResult.errors);
      }
    }
    
    if (bundle.hiveSnapshots?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.hiveSnapshots.length} Hive Snapshots...`);
      const snapshotResult = await this.importHiveSnapshots(bundle.hiveSnapshots);
      counts['hiveSnapshots'] = snapshotResult.imported;
      if (snapshotResult.errors.length) {
        console.error(`[SYNC-BRIDGE] Hive Snapshot errors:`, snapshotResult.errors);
        errors.push(...snapshotResult.errors);
      }
    }
    
    if (bundle.danielaGrowthMemories?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.danielaGrowthMemories.length} Daniela Growth Memories...`);
      const memoryResult = await this.importDanielaGrowthMemories(bundle.danielaGrowthMemories);
      counts['danielaGrowthMemories'] = memoryResult.imported;
      if (memoryResult.errors.length) {
        console.error(`[SYNC-BRIDGE] Daniela Growth Memory errors:`, memoryResult.errors);
        errors.push(...memoryResult.errors);
      }
    }
    
    // Log final sync result summary
    if (errors.length > 0) {
      console.error(`[SYNC-BRIDGE] Import completed with ${errors.length} errors:`, errors);
    } else {
      console.log(`[SYNC-BRIDGE] Import completed successfully. Counts:`, counts);
    }
    
    return {
      success: errors.length === 0,
      counts,
      errors,
      durationMs: Date.now() - startTime,
    };
  }
  
  /**
   * Import founder user to satisfy EXPRESS Lane FK constraints
   * Uses upsert logic - updates if exists, inserts if new
   */
  async importFounderUser(founderUser: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(users).where(eq(users.id, founderUser.id)).limit(1);
      
      if (existing.length > 0) {
        // Update non-critical fields if newer
        if (founderUser.updatedAt && new Date(founderUser.updatedAt) > new Date(existing[0].updatedAt || 0)) {
          await db.update(users)
            .set({
              firstName: founderUser.firstName || existing[0].firstName,
              lastName: founderUser.lastName || existing[0].lastName,
              profileImageUrl: founderUser.profileImageUrl || existing[0].profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.id, founderUser.id));
          console.log(`[SYNC-BRIDGE] Updated founder user: ${founderUser.email}`);
        } else {
          console.log(`[SYNC-BRIDGE] Founder user already exists and is current: ${founderUser.email}`);
        }
      } else {
        // Insert founder user
        await db.insert(users).values({
          id: founderUser.id,
          email: founderUser.email,
          firstName: founderUser.firstName,
          lastName: founderUser.lastName,
          profileImageUrl: founderUser.profileImageUrl,
          createdAt: new Date(founderUser.createdAt),
          updatedAt: new Date(),
        });
        console.log(`[SYNC-BRIDGE] Inserted founder user: ${founderUser.email}`);
      }
      
      return { success: true };
    } catch (err: any) {
      console.error(`[SYNC-BRIDGE] Failed to import founder user:`, err.message);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Import Express Lane sessions with upsert logic (update if exists, insert if new)
   * Schema: id, founderId, status, lastCursor, messageCount, environment, title, createdAt, updatedAt
   * Preserves all source fields during sync.
   */
  async importExpressLaneSessions(sessions: any[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    
    for (const session of sessions) {
      try {
        const existing = await db.select().from(founderSessions).where(eq(founderSessions.id, session.id)).limit(1);
        
        if (existing.length > 0) {
          if (new Date(session.updatedAt) > new Date(existing[0].updatedAt)) {
            // Update all mutable fields from source, preserving environment and founderId
            await db.update(founderSessions)
              .set({
                title: session.title ?? existing[0].title,
                status: session.status ?? existing[0].status,
                lastCursor: session.lastCursor ?? existing[0].lastCursor,
                messageCount: session.messageCount ?? existing[0].messageCount,
                updatedAt: new Date(session.updatedAt),
              })
              .where(eq(founderSessions.id, session.id));
            imported++;
          }
        } else {
          // Insert with all required fields
          await db.insert(founderSessions).values({
            id: session.id,
            founderId: session.founderId,
            status: session.status ?? 'active',
            lastCursor: session.lastCursor ?? null,
            messageCount: session.messageCount ?? 0,
            environment: session.environment,
            title: session.title ?? null,
            createdAt: new Date(session.createdAt),
            updatedAt: new Date(session.updatedAt),
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`expressLaneSession ${session.id}: ${err.message}`);
      }
    }
    
    console.log(`[SYNC-BRIDGE] Imported ${imported} Express Lane sessions`);
    return { imported, errors };
  }
  
  /**
   * Import Express Lane messages with duplicate detection
   * Schema: id, sessionId, role, messageType, content, audioUrl, audioDuration, metadata, cursor, environment, synced, syncedAt, createdAt
   * Messages are immutable once created, so only insert new messages (no updates).
   * Preserves source synced status for traceability.
   */
  async importExpressLaneMessages(messages: any[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    
    for (const message of messages) {
      try {
        const existing = await db.select().from(collaborationMessages).where(eq(collaborationMessages.id, message.id)).limit(1);
        
        if (existing.length === 0) {
          await db.insert(collaborationMessages).values({
            id: message.id,
            sessionId: message.sessionId,
            role: message.role,
            messageType: message.messageType ?? 'text',
            content: message.content,
            audioUrl: message.audioUrl ?? null,
            audioDuration: message.audioDuration ?? null,
            metadata: message.metadata ?? null,
            cursor: message.cursor,
            environment: message.environment,
            // Preserve source synced status; mark as synced now since receiving via sync
            synced: true,
            syncedAt: new Date(),
            createdAt: new Date(message.createdAt),
          });
          imported++;
        } else {
          // Message exists - log for visibility but don't fail
          console.log(`[SYNC-BRIDGE] Message ${message.id} already exists, skipping`);
        }
      } catch (err: any) {
        errors.push(`expressLaneMessage ${message.id}: ${err.message}`);
      }
    }
    
    console.log(`[SYNC-BRIDGE] Imported ${imported} Express Lane messages`);
    return { imported, errors };
  }
  
  /**
   * Import Hive Snapshots with duplicate detection
   * Schema: id, snapshotType, userId, conversationId, sessionId, language, title, content, context, importance, metadata, expiresAt, createdAt
   * Snapshots are immutable once created.
   */
  async importHiveSnapshots(snapshots: any[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    
    for (const snapshot of snapshots) {
      try {
        const existing = await db.select().from(hiveSnapshots).where(eq(hiveSnapshots.id, snapshot.id)).limit(1);
        
        if (existing.length === 0) {
          await db.insert(hiveSnapshots).values({
            id: snapshot.id,
            snapshotType: snapshot.snapshotType,
            userId: snapshot.userId ?? null,
            conversationId: snapshot.conversationId ?? null,
            sessionId: snapshot.sessionId ?? null,
            language: snapshot.language ?? null,
            title: snapshot.title,
            content: snapshot.content,
            context: snapshot.context ?? null,
            importance: snapshot.importance ?? 5,
            metadata: snapshot.metadata ?? null,
            expiresAt: snapshot.expiresAt ? new Date(snapshot.expiresAt) : null,
            createdAt: new Date(snapshot.createdAt),
          });
          imported++;
        } else {
          console.log(`[SYNC-BRIDGE] Snapshot ${snapshot.id} already exists, skipping`);
        }
      } catch (err: any) {
        errors.push(`hiveSnapshot ${snapshot.id}: ${err.message}`);
      }
    }
    
    console.log(`[SYNC-BRIDGE] Imported ${imported} Hive Snapshots`);
    return { imported, errors };
  }
  
  /**
   * Import Daniela's Growth Memories with upsert logic
   * Full schema with defensive null defaults for optional fields.
   * Updates only mutable fields; preserves immutable source fields on existing records.
   */
  async importDanielaGrowthMemories(memories: any[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    
    for (const memory of memories) {
      try {
        const existing = await db.select().from(danielaGrowthMemories).where(eq(danielaGrowthMemories.id, memory.id)).limit(1);
        
        if (existing.length > 0) {
          if (new Date(memory.updatedAt) > new Date(existing[0].updatedAt)) {
            // Update mutable fields, preserve existing if source is null
            await db.update(danielaGrowthMemories)
              .set({
                title: memory.title ?? existing[0].title,
                lesson: memory.lesson ?? existing[0].lesson,
                specificContent: memory.specificContent ?? existing[0].specificContent,
                triggerConditions: memory.triggerConditions ?? existing[0].triggerConditions,
                applicableLanguages: memory.applicableLanguages ?? existing[0].applicableLanguages,
                timesApplied: memory.timesApplied ?? existing[0].timesApplied,
                successRate: memory.successRate ?? existing[0].successRate,
                lastAppliedAt: memory.lastAppliedAt ? new Date(memory.lastAppliedAt) : existing[0].lastAppliedAt,
                importance: memory.importance ?? existing[0].importance,
                validated: memory.validated ?? existing[0].validated,
                validatedBy: memory.validatedBy ?? existing[0].validatedBy,
                validatedAt: memory.validatedAt ? new Date(memory.validatedAt) : existing[0].validatedAt,
                reviewStatus: memory.reviewStatus ?? existing[0].reviewStatus,
                reviewedBy: memory.reviewedBy ?? existing[0].reviewedBy,
                reviewedAt: memory.reviewedAt ? new Date(memory.reviewedAt) : existing[0].reviewedAt,
                reviewNotes: memory.reviewNotes ?? existing[0].reviewNotes,
                northStarChecksum: memory.northStarChecksum ?? existing[0].northStarChecksum,
                committedToNeuralNetwork: memory.committedToNeuralNetwork ?? existing[0].committedToNeuralNetwork,
                neuralNetworkEntryId: memory.neuralNetworkEntryId ?? existing[0].neuralNetworkEntryId,
                supersededBy: memory.supersededBy ?? existing[0].supersededBy,
                isActive: memory.isActive ?? existing[0].isActive,
                metadata: memory.metadata ?? existing[0].metadata,
                updatedAt: new Date(memory.updatedAt),
              })
              .where(eq(danielaGrowthMemories.id, memory.id));
            imported++;
          }
        } else {
          // Insert with all fields, using defaults for optional fields
          await db.insert(danielaGrowthMemories).values({
            id: memory.id,
            category: memory.category,
            title: memory.title,
            lesson: memory.lesson,
            specificContent: memory.specificContent ?? null,
            sourceType: memory.sourceType,
            sourceSessionId: memory.sourceSessionId ?? null,
            sourceUserId: memory.sourceUserId ?? null,
            sourceMessageId: memory.sourceMessageId ?? null,
            triggerConditions: memory.triggerConditions ?? null,
            applicableLanguages: memory.applicableLanguages ?? null,
            committedToNeuralNetwork: memory.committedToNeuralNetwork ?? false,
            neuralNetworkEntryId: memory.neuralNetworkEntryId ?? null,
            timesApplied: memory.timesApplied ?? 0,
            successRate: memory.successRate ?? null,
            lastAppliedAt: memory.lastAppliedAt ? new Date(memory.lastAppliedAt) : null,
            importance: memory.importance ?? 5,
            validated: memory.validated ?? false,
            validatedBy: memory.validatedBy ?? null,
            validatedAt: memory.validatedAt ? new Date(memory.validatedAt) : null,
            reviewStatus: memory.reviewStatus ?? 'pending',
            reviewedBy: memory.reviewedBy ?? null,
            reviewedAt: memory.reviewedAt ? new Date(memory.reviewedAt) : null,
            reviewNotes: memory.reviewNotes ?? null,
            northStarChecksum: memory.northStarChecksum ?? null,
            supersededBy: memory.supersededBy ?? null,
            isActive: memory.isActive ?? true,
            metadata: memory.metadata ?? null,
            createdAt: new Date(memory.createdAt),
            updatedAt: new Date(memory.updatedAt),
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`danielaGrowthMemory ${memory.id}: ${err.message}`);
      }
    }
    
    console.log(`[SYNC-BRIDGE] Imported ${imported} Daniela Growth Memories`);
    return { imported, errors };
  }
  
  /**
   * Send a single batch to the peer with timeout handling
   */
  private async sendBatch(
    peerUrl: string, 
    batchType: string, 
    bundle: any,
    timeoutMs: number = 45000 // 45s to stay under Replit's ~60s proxy timeout
  ): Promise<{ success: boolean; counts: Record<string, number>; errors: string[] }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const headers = createSyncHeaders(bundle);
      const response = await fetch(`${peerUrl}/api/sync/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bundle),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`[SYNC-BRIDGE] Batch ${batchType} rejected: ${response.status} - ${error.substring(0, 200)}`);
        return { success: false, counts: {}, errors: [`${batchType}: ${response.status} - ${error}`] };
      }
      
      const result = await response.json() as SyncResult;
      console.log(`[SYNC-BRIDGE] Batch ${batchType} complete: ${JSON.stringify(result.counts)}`);
      return { success: result.success, counts: result.counts, errors: result.errors };
    } catch (err: any) {
      const errorMsg = err.name === 'AbortError' ? `${batchType} timeout after ${timeoutMs/1000}s` : err.message;
      console.error(`[SYNC-BRIDGE] Batch ${batchType} FAILED: ${errorMsg}`);
      return { success: false, counts: {}, errors: [errorMsg] };
    } finally {
      clearTimeout(timeoutId);
    }
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
      // Use incremental sync - only export items newer than last successful push
      const lastSuccessfulPush = await this.getLastSuccessfulPushTime();
      console.log(`[SYNC-BRIDGE] Batched incremental sync since: ${lastSuccessfulPush?.toISOString() || 'never (full sync)'}`);
      
      const allCounts: Record<string, number> = {};
      const allErrors: string[] = [];
      let overallSuccess = true;
      
      // BATCH 1: Neural network core (small, fast)
      console.log('[SYNC-BRIDGE] Batch 1/6: Neural network core...');
      const coreBundle: Partial<SyncBundle> = {
        generatedAt: new Date().toISOString(),
        sourceEnvironment: CURRENT_ENVIRONMENT,
        bestPractices: await neuralNetworkSync.getBestPracticesForExport(),
        ...await neuralNetworkSync.exportNeuralNetworkExpansion(),
        ...await neuralNetworkSync.exportProceduralMemory(),
      };
      const batch1 = await this.sendBatch(peerUrl, 'neural-core', coreBundle);
      Object.assign(allCounts, batch1.counts);
      allErrors.push(...batch1.errors);
      if (!batch1.success) overallSuccess = false;
      
      // BATCH 2a: Advanced intelligence + Daniela suggestions (split for timeout fix)
      console.log('[SYNC-BRIDGE] Batch 2a/6: Advanced intelligence (part A)...');
      const advancedBundleA: Partial<SyncBundle> = {
        generatedAt: new Date().toISOString(),
        sourceEnvironment: CURRENT_ENVIRONMENT,
        ...await neuralNetworkSync.exportAdvancedIntelligence(),
        ...await neuralNetworkSync.exportDanielaSuggestions(),
      };
      const batch2a = await this.sendBatch(peerUrl, 'advanced-intel-a', advancedBundleA);
      Object.assign(allCounts, batch2a.counts);
      allErrors.push(...batch2a.errors);
      if (!batch2a.success) overallSuccess = false;
      
      // BATCH 2b: TriLane + North Star (split for timeout fix)
      console.log('[SYNC-BRIDGE] Batch 2b/6: Advanced intelligence (part B)...');
      const advancedBundleB: Partial<SyncBundle> = {
        generatedAt: new Date().toISOString(),
        sourceEnvironment: CURRENT_ENVIRONMENT,
        ...await neuralNetworkSync.exportTriLaneObservations(),
        ...await neuralNetworkSync.exportNorthStar(),
      };
      const batch2b = await this.sendBatch(peerUrl, 'advanced-intel-b', advancedBundleB);
      Object.assign(allCounts, batch2b.counts);
      allErrors.push(...batch2b.errors);
      if (!batch2b.success) overallSuccess = false;
      
      // BATCH 3: Express Lane data (can be large)
      console.log('[SYNC-BRIDGE] Batch 3/6: Express Lane...');
      const expressLaneData = await this.exportExpressLaneData(lastSuccessfulPush);
      const expressBundle: Partial<SyncBundle> = {
        generatedAt: new Date().toISOString(),
        sourceEnvironment: CURRENT_ENVIRONMENT,
        founderUser: await this.exportFounderUser(),
        expressLaneSessions: expressLaneData.sessions,
        expressLaneMessages: expressLaneData.messages,
      };
      const batch3 = await this.sendBatch(peerUrl, 'express-lane', expressBundle, 60000); // 60s for larger batch
      Object.assign(allCounts, batch3.counts);
      allErrors.push(...batch3.errors);
      if (!batch3.success) overallSuccess = false;
      
      // BATCH 4: Hive snapshots only
      console.log('[SYNC-BRIDGE] Batch 4/6: Hive Snapshots...');
      const hiveSnapshots = await this.exportHiveSnapshots(lastSuccessfulPush);
      const hiveBundle: Partial<SyncBundle> = {
        generatedAt: new Date().toISOString(),
        sourceEnvironment: CURRENT_ENVIRONMENT,
        hiveSnapshots,
      };
      const batch4 = await this.sendBatch(peerUrl, 'hive-snapshots', hiveBundle, 60000); // 60s
      Object.assign(allCounts, batch4.counts);
      allErrors.push(...batch4.errors);
      if (!batch4.success) overallSuccess = false;
      
      // BATCH 5: Daniela growth memories only
      console.log('[SYNC-BRIDGE] Batch 5/6: Daniela Memories...');
      const danielaMemories = await this.exportDanielaGrowthMemories(lastSuccessfulPush);
      const memoriesBundle: Partial<SyncBundle> = {
        generatedAt: new Date().toISOString(),
        sourceEnvironment: CURRENT_ENVIRONMENT,
        danielaGrowthMemories: danielaMemories,
      };
      const batch5 = await this.sendBatch(peerUrl, 'daniela-memories', memoriesBundle, 60000); // 60s
      Object.assign(allCounts, batch5.counts);
      allErrors.push(...batch5.errors);
      if (!batch5.success) overallSuccess = false;
      
      console.log(`[SYNC-BRIDGE] All 6 batches complete. Overall success: ${overallSuccess}`);
      
      await db.update(syncRuns)
        .set({
          status: overallSuccess ? 'success' : (allErrors.length > 0 ? 'partial' : 'failed'),
          bestPracticesCount: allCounts.bestPractices || 0,
          idiomCount: allCounts.idioms || 0,
          nuanceCount: allCounts.nuances || 0,
          errorPatternCount: allCounts.errorPatterns || 0,
          dialectCount: allCounts.dialects || 0,
          bridgeCount: allCounts.bridges || 0,
          toolCount: allCounts.tools || 0,
          procedureCount: allCounts.procedures || 0,
          principleCount: allCounts.principles || 0,
          patternCount: allCounts.patterns || 0,
          subtletyCount: allCounts.subtletyCues || 0,
          emotionalCount: allCounts.emotionalPatterns || 0,
          creativityCount: allCounts.creativityTemplates || 0,
          suggestionCount: allCounts.suggestions || 0,
          triggerCount: allCounts.triggers || 0,
          actionCount: allCounts.actions || 0,
          observationCount: allCounts.observations || 0,
          alertCount: allCounts.alerts || 0,
          northStarPrincipleCount: allCounts.northStarPrinciples || 0,
          northStarUnderstandingCount: allCounts.northStarUnderstanding || 0,
          northStarExampleCount: allCounts.northStarExamples || 0,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
          errorMessage: allErrors.length > 0 ? allErrors.join('; ') : null,
        })
        .where(eq(syncRuns.id, syncRun.id));
      
      return { 
        success: overallSuccess, 
        syncRunId: syncRun.id,
        counts: allCounts, 
        errors: allErrors,
        durationMs: Date.now() - startTime,
      };
      
    } catch (err: any) {
      const errorMessage = err.message;
      console.error(`[SYNC-BRIDGE] Push failed: ${errorMessage}`);
      
      await db.update(syncRuns)
        .set({
          status: 'failed',
          errorMessage,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        })
        .where(eq(syncRuns.id, syncRun.id));
      
      return {
        success: false,
        syncRunId: syncRun.id,
        counts: {},
        errors: [errorMessage],
        durationMs: Date.now() - startTime,
      };
    }
  }
  
  /**
   * Fetch a single batch from the peer with timeout handling
   */
  private async fetchBatch(
    peerUrl: string,
    batchType: string,
    timeoutMs: number = 45000
  ): Promise<{ success: boolean; bundle: Partial<SyncBundle>; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const requestPayload = { requestedAt: new Date().toISOString(), batchType };
      const headers = createSyncHeaders(requestPayload);
      
      const response = await fetch(`${peerUrl}/api/sync/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        let errorMsg = '';
        try {
          const errorText = await response.text();
          // Try to parse as JSON to get structured error
          try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.error || errorJson.message || errorText;
          } catch {
            errorMsg = errorText || 'No error message returned';
          }
        } catch {
          errorMsg = 'Failed to read error response';
        }
        console.error(`[SYNC-BRIDGE] Pull batch ${batchType} rejected: ${response.status} - ${errorMsg.substring(0, 500)}`);
        return { success: false, bundle: {}, error: `${batchType}: ${response.status} - ${errorMsg}` };
      }
      
      const bundle = await response.json() as Partial<SyncBundle> & { _syncVersion?: number; exportErrors?: string[] };
      const versionInfo = bundle._syncVersion ? ` (remote v${bundle._syncVersion})` : ' (remote pre-v2)';
      const codeVersionInfo = bundle.codeVersion ? ` [code: ${bundle.codeVersion}]` : ' [code: unknown/old]';
      const exportErrorInfo = bundle.exportErrors?.length ? ` [remote errors: ${bundle.exportErrors.join(', ')}]` : '';
      console.log(`[SYNC-BRIDGE] Pull batch ${batchType} complete${versionInfo}${codeVersionInfo}${exportErrorInfo}`);
      return { success: true, bundle };
    } catch (err: any) {
      const errorMsg = err.name === 'AbortError' ? `${batchType} timeout after ${timeoutMs/1000}s` : err.message;
      console.error(`[SYNC-BRIDGE] Pull batch ${batchType} FAILED: ${errorMsg}`);
      return { success: false, bundle: {}, error: errorMsg };
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  async pullFromPeer(triggeredBy: string = 'manual', options?: { forceResume?: boolean }): Promise<SyncResult> {
    const startTime = Date.now();
    const peerUrl = getSyncPeerUrl();
    const forceResume = options?.forceResume ?? false;
    
    if (!peerUrl || !isSyncConfigured()) {
      return {
        success: false,
        counts: {},
        errors: ['Sync not configured - set SYNC_PEER_URL and SYNC_SHARED_SECRET'],
        durationMs: Date.now() - startTime,
      };
    }
    
    // v16: Check for interrupted sync runs to resume
    // Normal mode: Look for 'running' pulls that started more than 3 HOURS ago
    // Force mode: Find ANY 'running' pull to resume immediately (use after confirmed timeout)
    let interruptedRun: SyncRun | undefined;
    
    if (forceResume) {
      console.log(`[SYNC-BRIDGE v16] FORCE RESUME requested by ${triggeredBy}`);
      const [staleRun] = await db.select()
        .from(syncRuns)
        .where(and(
          eq(syncRuns.direction, 'pull'),
          eq(syncRuns.status, 'running')
        ))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);
      interruptedRun = staleRun;
      if (interruptedRun) {
        console.log(`[SYNC-BRIDGE v16] Force resuming from run ${interruptedRun.id} (page ${interruptedRun.lastCompletedPage ?? -1})`);
      }
    } else {
      // Normal mode: auto-resume if 5+ minutes old (gateway timeout is 60s, so 5min means definitely timed out)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const [staleRun] = await db.select()
        .from(syncRuns)
        .where(and(
          eq(syncRuns.direction, 'pull'),
          eq(syncRuns.status, 'running'),
          lt(syncRuns.startedAt, fiveMinutesAgo)
        ))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);
      interruptedRun = staleRun;
    }
    
    let syncRun: SyncRun;
    let resumeFromBatch = 0;
    let resumeFromPage = 0;
    const completedBatches: string[] = [];
    
    if (interruptedRun) {
      console.log(`[SYNC-BRIDGE v16] Found interrupted run ${interruptedRun.id} from ${interruptedRun.startedAt}`);
      console.log(`[SYNC-BRIDGE v16] Completed batches: ${interruptedRun.completedBatches?.join(', ') || 'none'}`);
      console.log(`[SYNC-BRIDGE v16] Last completed page: ${interruptedRun.lastCompletedPage ?? -1}`);
      
      // Mark the old run as failed and create a new resume run
      await db.update(syncRuns)
        .set({
          status: 'failed',
          errorMessage: 'Interrupted - timeout or crash. Resuming in new run.',
          completedAt: new Date(),
          durationMs: Date.now() - new Date(interruptedRun.startedAt).getTime(),
        })
        .where(eq(syncRuns.id, interruptedRun.id));
      
      // Create new run that resumes from interrupted point
      const [newRun] = await db.insert(syncRuns).values({
        direction: 'pull',
        peerUrl,
        sourceEnvironment: CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production',
        targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        status: 'running',
        triggeredBy: `resume:${triggeredBy}`,
        resumedFromRunId: interruptedRun.id,
        completedBatches: interruptedRun.completedBatches || [],
        lastCompletedPage: interruptedRun.lastCompletedPage ?? -1,
      }).returning();
      syncRun = newRun;
      
      // Set resume points
      if (interruptedRun.completedBatches) {
        completedBatches.push(...interruptedRun.completedBatches);
      }
      resumeFromPage = (interruptedRun.lastCompletedPage ?? -1) + 1;
      
      console.log(`[SYNC-BRIDGE v16] Created resume run ${syncRun.id}, resuming from page ${resumeFromPage}`);
    } else {
      // Fresh sync run
      const [newRun] = await db.insert(syncRuns).values({
        direction: 'pull',
        peerUrl,
        sourceEnvironment: CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production',
        targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        status: 'running',
        triggeredBy,
        completedBatches: [],
        lastCompletedPage: -1,
      }).returning();
      syncRun = newRun;
      console.log(`[SYNC-BRIDGE v16] Starting fresh sync run ${syncRun.id}`);
    }
    
    try {
      const allCounts: Record<string, number> = {};
      const allErrors: string[] = [];
      let overallSuccess = true;
      
      // Batched pull - fetch each batch type separately to avoid timeout
      // v15: advanced-intel-b now supports pagination for large observation datasets
      // v16: Skip already-completed batches on resume
      const batchTypes = ['neural-core', 'advanced-intel-a', 'advanced-intel-b', 'express-lane', 'hive-snapshots', 'daniela-memories'];
      
      for (let i = 0; i < batchTypes.length; i++) {
        const batchType = batchTypes[i];
        
        // v16: Skip completed batches (except advanced-intel-b which needs page tracking)
        if (batchType !== 'advanced-intel-b' && completedBatches.includes(batchType)) {
          console.log(`[SYNC-BRIDGE v16] Skipping already-completed batch: ${batchType}`);
          continue;
        }
        
        console.log(`[SYNC-BRIDGE] Pull batch ${i + 1}/${batchTypes.length}: ${batchType}...`);
        
        // 45s timeout for smaller batches, 60s for larger data batches
        const timeout = ['express-lane', 'hive-snapshots', 'daniela-memories'].includes(batchType) ? 60000 : 45000;
        
        // Special handling for advanced-intel-b: paginated fetching
        if (batchType === 'advanced-intel-b') {
          // v16: Resume from last completed page
          let page = resumeFromPage > 0 ? resumeFromPage : 0;
          let hasMore = true;
          const MAX_PAGES = 150; // Increased from 50 to handle 97+ pages
          
          if (page > 0) {
            console.log(`[SYNC-BRIDGE v16] Resuming observations from page ${page}`);
          }
          
          while (hasMore && page < MAX_PAGES) {
            const pageBatchType = page === 0 ? 'advanced-intel-b' : `advanced-intel-b-p${page}`;
            console.log(`[SYNC-BRIDGE] Fetching observations page ${page}...`);
            
            const result = await this.fetchBatch(peerUrl, pageBatchType, timeout);
            
            if (!result.success) {
              allErrors.push(result.error || `${pageBatchType} failed`);
              overallSuccess = false;
              hasMore = false; // Stop pagination on error
              break;
            }
            
            // Apply the partial bundle
            const importResult = await this.applyImportBundle(result.bundle as SyncBundle);
            Object.assign(allCounts, importResult.counts);
            allErrors.push(...importResult.errors);
            if (!importResult.success) overallSuccess = false;
            
            // v16: Update progress after each successful page + check for more pages
            const pagination = (result.bundle as SyncBundle).observationsPagination;
            const estimatedTotalPages = pagination?.agentTotal ? Math.ceil(pagination.agentTotal / 250) : undefined;
            await db.update(syncRuns)
              .set({
                lastCompletedPage: page,
                totalPagesExpected: estimatedTotalPages,
              })
              .where(eq(syncRuns.id, syncRun.id));
            
            hasMore = pagination?.hasMore ?? false;
            page++;
            
            console.log(`[SYNC-BRIDGE] Page ${page - 1} complete. hasMore=${hasMore}, nextPage=${page}`);
          }
          
          if (page >= MAX_PAGES) {
            console.warn(`[SYNC-BRIDGE] Hit MAX_PAGES limit (${MAX_PAGES}) for observations`);
          }
          
          // v16: Only mark advanced-intel-b as completed when all pages are done successfully
          // hasMore=false means we've fetched all pages, no errors means no fetch failures
          if (!hasMore && overallSuccess) {
            completedBatches.push('advanced-intel-b');
            await db.update(syncRuns)
              .set({ completedBatches })
              .where(eq(syncRuns.id, syncRun.id));
            console.log(`[SYNC-BRIDGE v16] advanced-intel-b marked complete (${page} pages)`);
          } else {
            console.log(`[SYNC-BRIDGE v16] advanced-intel-b NOT marked complete (hasMore=${hasMore}, success=${overallSuccess})`);
          }
            
        } else {
          // Standard single-fetch for other batches
          const result = await this.fetchBatch(peerUrl, batchType, timeout);
          
          if (!result.success) {
            allErrors.push(result.error || `${batchType} failed`);
            overallSuccess = false;
            continue;
          }
          
          // Apply the partial bundle
          const importResult = await this.applyImportBundle(result.bundle as SyncBundle);
          Object.assign(allCounts, importResult.counts);
          allErrors.push(...importResult.errors);
          if (!importResult.success) overallSuccess = false;
          
          // v16: Track completed batches
          completedBatches.push(batchType);
          await db.update(syncRuns)
            .set({ completedBatches })
            .where(eq(syncRuns.id, syncRun.id));
        }
      }
      
      console.log(`[SYNC-BRIDGE] All ${batchTypes.length} pull batches complete. Overall success: ${overallSuccess}`);
      
      await db.update(syncRuns)
        .set({
          status: overallSuccess ? 'success' : (allErrors.length > 0 ? 'partial' : 'failed'),
          bestPracticesCount: allCounts.bestPractices || 0,
          idiomCount: allCounts.idioms || 0,
          nuanceCount: allCounts.nuances || 0,
          errorPatternCount: allCounts.errorPatterns || 0,
          dialectCount: allCounts.dialects || 0,
          bridgeCount: allCounts.bridges || 0,
          toolCount: allCounts.tools || 0,
          procedureCount: allCounts.procedures || 0,
          principleCount: allCounts.principles || 0,
          patternCount: allCounts.patterns || 0,
          subtletyCount: allCounts.subtletyCues || 0,
          emotionalCount: allCounts.emotionalPatterns || 0,
          creativityCount: allCounts.creativityTemplates || 0,
          suggestionCount: allCounts.suggestions || 0,
          triggerCount: allCounts.triggers || 0,
          actionCount: allCounts.actions || 0,
          observationCount: allCounts.observations || 0,
          alertCount: allCounts.alerts || 0,
          northStarPrincipleCount: allCounts.northStarPrinciples || 0,
          northStarUnderstandingCount: allCounts.northStarUnderstanding || 0,
          northStarExampleCount: allCounts.northStarExamples || 0,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
          errorMessage: allErrors.length > 0 ? allErrors.join('; ') : null,
        })
        .where(eq(syncRuns.id, syncRun.id));
      
      return { 
        success: overallSuccess, 
        syncRunId: syncRun.id,
        counts: allCounts, 
        errors: allErrors,
        durationMs: Date.now() - startTime,
      };
      
    } catch (err: any) {
      const errorMessage = err.message;
      console.error(`[SYNC-BRIDGE] Pull failed: ${errorMessage}`);
      
      await db.update(syncRuns)
        .set({
          status: 'failed',
          errorMessage,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        })
        .where(eq(syncRuns.id, syncRun.id));
      
      return {
        success: false,
        syncRunId: syncRun.id,
        counts: {},
        errors: [errorMessage],
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
    peerNightlyStatus?: {
      lastNightlySync: SyncRun | null;
      nextSyncTime: string | null;
      environment: string;
    };
  }> {
    // Clean up any orphaned sync runs (stuck in "running" for >10 min)
    await this.cleanupOrphanedSyncRuns();
    
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
    
    // Fetch peer's nightly sync status
    let peerNightlyStatus: { lastNightlySync: SyncRun | null; nextSyncTime: string | null; environment: string } | undefined;
    if (isSyncConfigured()) {
      try {
        peerNightlyStatus = await this.fetchPeerNightlyStatus();
      } catch (err: any) {
        console.warn(`[SYNC-BRIDGE] Could not fetch peer nightly status: ${err.message}`);
      }
    }
    
    return {
      configured: isSyncConfigured(),
      peerUrl: getSyncPeerUrl(),
      currentEnvironment: CURRENT_ENVIRONMENT,
      lastPush: lastPush || null,
      lastPull: lastPull || null,
      recentRuns,
      peerNightlyStatus,
    };
  }
  
  async getLocalNightlyStatus(): Promise<{
    lastNightlySync: SyncRun | null;
    nextSyncTime: string;
    environment: string;
  }> {
    const [lastNightlySync] = await db.select()
      .from(syncRuns)
      .where(eq(syncRuns.triggeredBy, 'nightly'))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);
    
    // Calculate next sync time (11 AM UTC daily)
    const now = new Date();
    const nextSync = new Date(now);
    nextSync.setUTCHours(11, 0, 0, 0);
    if (now >= nextSync) {
      nextSync.setUTCDate(nextSync.getUTCDate() + 1);
    }
    
    return {
      lastNightlySync: lastNightlySync || null,
      nextSyncTime: nextSync.toISOString(),
      environment: CURRENT_ENVIRONMENT,
    };
  }
  
  private async fetchPeerNightlyStatus(): Promise<{
    lastNightlySync: SyncRun | null;
    nextSyncTime: string | null;
    environment: string;
  }> {
    const peerUrl = getSyncPeerUrl();
    if (!peerUrl) {
      throw new Error('Peer URL not configured');
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
      const response = await fetch(`${peerUrl}/api/sync/nightly-status`, {
        method: 'GET',
        headers: createSyncHeaders({}),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Peer returned ${response.status}`);
      }
      
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  async performFullSync(triggeredBy: string = 'manual'): Promise<{
    push: SyncResult;
    pull: SyncResult;
  }> {
    const push = await this.pushToPeer(triggeredBy);
    const pull = await this.pullFromPeer(triggeredBy);
    return { push, pull };
  }
  
  async fetchPeerStats(): Promise<{
    environment: string;
    counts: {
      danielaGrowthMemories: number;
      hiveSnapshots: number;
      collaborationMessages: number;
      users: number;
    };
    queriedAt: string;
  }> {
    const peerUrl = getSyncPeerUrl();
    if (!peerUrl || !isSyncConfigured()) {
      throw new Error('Sync not configured');
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const requestPayload = { requestedAt: new Date().toISOString() };
      const response = await fetch(`${peerUrl}/api/sync/peer-stats`, {
        method: 'POST',
        headers: createSyncHeaders(requestPayload),
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        throw new Error(`Peer returned ${response.status}`);
      }
      
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Get local sync runs for cross-environment querying
   * Returns recent sync runs with error details for debugging
   */
  async getLocalSyncRuns(limit: number = 10): Promise<{
    environment: string;
    syncRuns: SyncRun[];
    queriedAt: string;
  }> {
    const runs = await db.select()
      .from(syncRuns)
      .orderBy(desc(syncRuns.startedAt))
      .limit(limit);
    
    return {
      environment: CURRENT_ENVIRONMENT,
      syncRuns: runs,
      queriedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Fetch sync runs from the peer environment
   * This allows dev to query production's sync history and see errors
   */
  async fetchPeerSyncRuns(limit: number = 10): Promise<{
    environment: string;
    syncRuns: SyncRun[];
    queriedAt: string;
  }> {
    const peerUrl = getSyncPeerUrl();
    if (!peerUrl || !isSyncConfigured()) {
      throw new Error('Sync not configured - set SYNC_PEER_URL and SYNC_SHARED_SECRET');
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    try {
      const requestPayload = { limit, requestedAt: new Date().toISOString() };
      const response = await fetch(`${peerUrl}/api/sync/peer-sync-runs`, {
        method: 'POST',
        headers: createSyncHeaders(requestPayload),
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Peer returned ${response.status}: ${errorText.substring(0, 200)}`);
      }
      
      return await response.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Request to peer timed out after 15s');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  private computeChecksum(bundle: Partial<Omit<SyncBundle, 'checksum'>>): string {
    const content = JSON.stringify({
      ...bundle,
      checksum: undefined,
    });
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
  
  /**
   * Clean up orphaned sync runs that are stuck in "running" status
   * This can happen if the server crashes during a sync operation
   * Runs older than 2 HOURS in "running" status are marked as failed
   * (Extended from 10min to support large paginated syncs - 97 pages × ~1min each)
   */
  async cleanupOrphanedSyncRuns(): Promise<number> {
    const ORPHAN_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours for large paginated syncs
    
    const orphanedRuns = await db.select()
      .from(syncRuns)
      .where(eq(syncRuns.status, 'running'));
    
    let cleaned = 0;
    for (const run of orphanedRuns) {
      const runAge = Date.now() - new Date(run.startedAt).getTime();
      if (runAge > ORPHAN_TIMEOUT_MS) { // Older than 2 hours = orphaned
        await db.update(syncRuns)
          .set({
            status: 'failed',
            errorMessage: 'Orphaned sync run - stuck in running state for >2 hours, auto-cleaned',
            completedAt: new Date(),
            durationMs: runAge,
          })
          .where(eq(syncRuns.id, run.id));
        cleaned++;
        console.log(`[SYNC-BRIDGE] Cleaned up orphaned sync run ${run.id} (age: ${Math.round(runAge/1000)}s)`);
      }
    }
    
    return cleaned;
  }
}

export const syncBridge = new SyncBridgeService();

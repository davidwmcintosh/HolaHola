import { db } from '../db';
import { 
  syncRuns, founderSessions, collaborationMessages, hiveSnapshots, danielaGrowthMemories, 
  users, tutorVoices, type SyncRun,
  // Curriculum tables
  curriculumPaths, curriculumUnits, curriculumLessons, topics,
  curriculumDrillItems, grammarExercises, grammarCompetencies, canDoStatements, culturalTips, 
  lessonCanDoStatements, lessonCulturalTips, lessonVisualAids, culturalTipMedia,
  // Pricing tables
  classHourPackages,
  // Neural network expansion tables (for prod-content-growth pull)
  languageIdioms, culturalNuances, learnerErrorPatterns, dialectVariations, linguisticBridges,
  // Best practices for verification
  selfBestPractices,
  // Wren intelligence tables
  wrenInsights, wrenProactiveTriggers, architecturalDecisionRecords,
  wrenMistakes, wrenLessons, wrenCommitments,
  wrenMistakeResolutions, wrenSessionNotes, wrenPredictions,
  wrenConfidenceRecords, wrenCalibrationStats,
  // Daniela beacons and synthesized insights
  danielaBeacons, synthesizedInsights,
  // Daniela intelligence tables
  danielaRecommendations, danielaFeatureFeedback,
  // Credits and usage tracking
  usageLedger, voiceSessions, sessionCostSummary,
  // Classes for beta tester auto-enrollment
  teacherClasses, classEnrollments,
  // Founder-specific tables
  learnerPersonalFacts,
  // Student conversations (for prod troubleshooting)
  conversations, messages,
  // Sofia issue reports (for cross-environment debugging)
  sofiaIssueReports,
  // v32: Sync reliability tracking
  syncImportReceipts, syncAnomalies, type SyncAnomaly, type SyncImportReceipt
} from '@shared/schema';
import { eq, desc, gte, and, isNull, or, inArray, lt, sql } from 'drizzle-orm';
import { neuralNetworkSync } from './neural-network-sync';
import { createSyncHeaders, isSyncConfigured, getSyncPeerUrl } from '../middleware/sync-auth';
import crypto from 'crypto';

const CURRENT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

// Version identifier to verify which code is running on production
// Increment this when making sync-related changes to verify deployment
const SYNC_BRIDGE_CODE_VERSION = "2025-01-14-v37-resumable-sync";

// Capability negotiation: List all batch types this version can import/export
// When adding new batches, add them here so peers can gracefully handle version mismatches
const SUPPORTED_BATCHES = [
  'neural-core',
  'advanced-intel-a', 
  'advanced-intel-b',
  'express-lane',
  'hive-snapshots',
  'daniela-memories',
  'founder-conversations', // Push founder's dev conversations to prod for Daniela continuity
  'product-config',
  'curriculum-core',
  'curriculum-drills',
  'wren-intel',
  'daniela-intel',
  'beta-testers',
  'beta-usage',        // Pull beta tester usage data from prod
  'aggregate-analytics', // Pull anonymized usage stats from prod
  'prod-content-growth', // Pull Daniela-authored content from prod (idioms, nuances, etc.)
  'founder-context',   // Bidirectional sync of founder's personal facts (same Daniela in dev/prod)
  'prod-conversations', // Pull recent conversation transcripts from prod for troubleshooting
  'sofia-telemetry',   // Pull Sofia runtime faults and issue reports from prod for debugging
  'all-classes',       // v34: Full sync of ALL teacher classes and enrollments
] as const;

// Capability map for fine-grained feature support
const SYNC_CAPABILITIES = {
  version: SYNC_BRIDGE_CODE_VERSION,
  supportedBatches: SUPPORTED_BATCHES,
  features: {
    paginatedSync: true,
    resumableSync: true,
    tutorVoiceSync: true,
    softFailUnknownBatches: true,
  },
  maxPageSize: 250,
  maxPages: 2000,
} as const;

export type SyncCapabilities = typeof SYNC_CAPABILITIES;

// v36: Peer Wake-Up Configuration
// When production pulls from dev (or vice versa), the peer may be sleeping
// We send a lightweight ping to wake it, then retry with exponential backoff
const WAKE_UP_CONFIG = {
  initialPingTimeoutMs: 5000,     // Quick timeout for initial ping
  postWakeDelayMs: 5000,          // Short delay after wake for container to fully start (only when actually waking)
  maxRetries: 3,                  // Retry up to 3 times
  baseBackoffMs: 10000,           // Start with 10s backoff
  maxBackoffMs: 60000,            // Cap at 60s backoff
} as const;

/**
 * v36: Wake up a sleeping peer environment before sync
 * Repls go to sleep after inactivity - this sends a lightweight ping to wake them
 * Returns true if peer is reachable, false if still unreachable after retries
 * 
 * Flow:
 * 1. Quick ping to check if already awake (no delay if successful)
 * 2. If sleeping, retry with exponential backoff
 * 3. Only apply initialization delay when peer was actually sleeping
 */
async function wakePeerEnvironment(peerUrl: string): Promise<{ 
  awake: boolean; 
  attempts: number; 
  message: string;
  wakeTimeMs?: number;
}> {
  const startTime = Date.now();
  
  // First, try a quick ping to see if peer is already awake
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WAKE_UP_CONFIG.initialPingTimeoutMs);
    
    const response = await fetch(`${peerUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`[SYNC-BRIDGE] Peer ${peerUrl} is already awake`);
      return { awake: true, attempts: 1, message: 'Peer already awake' };
    }
  } catch (err: any) {
    // Peer is likely sleeping, continue to wake-up flow
    console.log(`[SYNC-BRIDGE] Peer appears to be sleeping, initiating wake-up sequence...`);
  }
  
  // Send wake-up pings with exponential backoff (peer was sleeping)
  for (let retry = 0; retry < WAKE_UP_CONFIG.maxRetries; retry++) {
    const backoff = Math.min(
      WAKE_UP_CONFIG.baseBackoffMs * Math.pow(2, retry),
      WAKE_UP_CONFIG.maxBackoffMs
    );
    
    console.log(`[SYNC-BRIDGE] Wake-up attempt ${retry + 1}/${WAKE_UP_CONFIG.maxRetries}, waiting ${backoff / 1000}s...`);
    
    // Wait for backoff period
    await new Promise(resolve => setTimeout(resolve, backoff));
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Longer timeout for wake attempt
      
      const response = await fetch(`${peerUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const wakeTimeMs = Date.now() - startTime;
        const attempts = retry + 2; // +1 for initial ping, +1 for current attempt
        console.log(`[SYNC-BRIDGE] Peer woke up after ${wakeTimeMs}ms (${attempts} attempts)`);
        
        // Only wait for initialization if peer was actually sleeping
        // Use a shorter delay (5s) for the container to fully initialize
        const initDelay = 5000;
        console.log(`[SYNC-BRIDGE] Waiting ${initDelay / 1000}s for peer to fully initialize...`);
        await new Promise(resolve => setTimeout(resolve, initDelay));
        
        return { 
          awake: true, 
          attempts, 
          message: `Peer woke up after ${wakeTimeMs}ms`,
          wakeTimeMs 
        };
      }
    } catch (err: any) {
      console.log(`[SYNC-BRIDGE] Wake attempt ${retry + 1} failed: ${err.message}`);
    }
  }
  
  const totalTimeMs = Date.now() - startTime;
  const attempts = WAKE_UP_CONFIG.maxRetries + 1; // +1 for initial ping
  console.error(`[SYNC-BRIDGE] Failed to wake peer after ${attempts} attempts (${totalTimeMs}ms)`);
  return { 
    awake: false, 
    attempts, 
    message: `Peer unreachable after ${attempts} wake-up attempts (${totalTimeMs}ms)` 
  };
}

// Sync Verification Types (v28)
export interface SyncManifest {
  batchType: string;
  generatedAt: string;
  environment: string;
  expected: Record<string, number | string>;
  checksums: Record<string, string>;
  error?: string;
}

export interface SyncVerificationResult {
  batchType: string;
  verifiedAt: string;
  success: boolean;
  discrepancies: string[];
  peerCounts: Record<string, number>;
  expectedCounts: Record<string, number | string>;
}

export interface SyncBundle {
  generatedAt: string;
  sourceEnvironment: string;
  codeVersion?: string;  // Added to verify which code version is deployed
  capabilities?: typeof SYNC_CAPABILITIES;  // Capability negotiation info
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
  // Product configuration (voices, tutors, public classes)
  tutorVoices: any[];
  catalogueClasses: any[];  // v33: Public catalogue classes (teacherClasses with isPublicCatalogue=true)
  // Curriculum content (templates/syllabi)
  curriculumPaths: any[];
  curriculumUnits: any[];
  curriculumLessons: any[];
  topics: any[];
  curriculumDrillItems: any[];
  grammarExercises: any[];
  grammarCompetencies: any[];  // v33: Grammar skill definitions per language
  canDoStatements: any[];
  culturalTips: any[];
  lessonCanDoStatements: any[];  // v33: Links lessons to ACTFL Can-Do statements (fluency wiring)
  lessonCulturalTips: any[];     // v33: Links lessons to cultural tips
  lessonVisualAids: any[];       // v33: Visual aids per lesson
  culturalTipMedia: any[];       // v33: Media attachments for cultural tips
  classHourPackages: any[];      // v33: Pricing packages (bidirectional)
  // Wren intelligence
  wrenInsights: any[];
  wrenProactiveTriggers: any[];
  architecturalDecisionRecords: any[];
  wrenMistakes: any[];
  wrenLessons: any[];
  wrenCommitments: any[];
  wrenMistakeResolutions: any[];
  wrenSessionNotes: any[];
  wrenPredictions: any[];
  wrenConfidenceRecords: any[];
  wrenCalibrationStats: any[];
  // Daniela intelligence (beyond North Star already included)
  danielaRecommendations: any[];
  danielaFeatureFeedback: any[];
  danielaBeacons: any[];
  synthesizedInsights: any[];
  // Beta testers
  betaTesters: any[];
  betaTesterCredits: any[];
  betaTesterEnrollments: any[];  // Direct enrollments for beta testers (including Replit auth users)
  betaTesterClasses: any[];  // v27: Teacher classes needed for beta tester enrollments
  allTeacherClasses: any[];  // v34: ALL teacher classes (for full class sync)
  allEnrollments: any[];     // v34: ALL class enrollments (for full enrollment sync)
  // Beta usage (prod → dev pull)
  // v25: Added pagination support (hasMore, page) and conversations for FK satisfaction
  betaUsage?: {
    voiceSessions: any[];
    usageLedger: any[];
    costSummaries: any[];
    conversations: any[]; // v24: Parent records for voice sessions
    exportedAt: string;
    hasMore?: boolean; // v25: Pagination indicator
    page?: number; // v25: Current page
    totalSessions?: number; // v25: Total count for progress tracking
  };
  // Aggregate analytics (prod → dev pull, anonymized)
  aggregateAnalytics?: {
    totalUsers: number;
    totalBetaTesters: number;
    totalVoiceSessions: number;
    totalVoiceMinutes: number;
    totalCreditsConsumed: number;
    totalCreditsEarned: number;
    sessionsByLanguage: Record<string, number>;
    sessionsByDay: Array<{ date: string; count: number; minutes: number }>;
    averageSessionDuration: number;
    exportedAt: string;
  };
  // Daniela-authored content from production (prod → dev pull)
  prodContentGrowth?: {
    idioms: any[];
    nuances: any[];
    errorPatterns: any[];
    dialects: any[];
    bridges: any[];
    culturalTips: any[];
    exportedAt: string;
  };
  // Founder-specific context (bidirectional - same Daniela in dev/prod)
  founderContext?: {
    personalFacts: any[];
    exportedAt: string;
  };
  // Founder conversations (dev → prod push for Daniela continuity)
  founderConversations?: {
    conversations: any[];
    messages: any[];
    exportedAt: string;
  };
  // Production conversations for troubleshooting (prod → dev pull)
  prodConversations?: {
    conversations: any[];
    messages: any[];
    exportedAt: string;
  };
  // Sofia telemetry - runtime faults and issue reports (prod → dev for debugging)
  sofiaTelemetry?: {
    issueReports: any[];
    runtimeFaults: number;
    pendingCount: number;
    exportedAt: string;
  };
}

export interface SyncResult {
  success: boolean;
  syncRunId?: string;
  counts: Record<string, number>;
  errors: string[];
  durationMs: number;
}

class SyncBridgeService {
  
  // Concurrency lock to prevent parallel sync runs (v27)
  private syncLock: {
    isLocked: boolean;
    lockedBy: string | null;
    lockedAt: Date | null;
    direction: 'push' | 'pull' | null;
  } = {
    isLocked: false,
    lockedBy: null,
    lockedAt: null,
    direction: null,
  };
  
  // Lock timeout: auto-release after 10 minutes to prevent stuck locks
  private readonly LOCK_TIMEOUT_MS = 10 * 60 * 1000;
  
  /**
   * Attempt to acquire the sync lock
   * Returns true if lock acquired, false if already locked
   */
  private acquireLock(triggeredBy: string, direction: 'push' | 'pull'): boolean {
    // Check if lock is stale (timed out)
    if (this.syncLock.isLocked && this.syncLock.lockedAt) {
      const lockAge = Date.now() - this.syncLock.lockedAt.getTime();
      if (lockAge > this.LOCK_TIMEOUT_MS) {
        console.warn(`[SYNC-LOCK] Releasing stale lock held by ${this.syncLock.lockedBy} for ${Math.round(lockAge / 1000)}s`);
        this.releaseLock();
      }
    }
    
    if (this.syncLock.isLocked) {
      console.warn(`[SYNC-LOCK] Sync already in progress: ${this.syncLock.direction} by ${this.syncLock.lockedBy} (started ${this.syncLock.lockedAt?.toISOString()})`);
      return false;
    }
    
    this.syncLock = {
      isLocked: true,
      lockedBy: triggeredBy,
      lockedAt: new Date(),
      direction,
    };
    console.log(`[SYNC-LOCK] Lock acquired for ${direction} by ${triggeredBy}`);
    return true;
  }
  
  /**
   * Release the sync lock
   */
  private releaseLock(): void {
    const was = this.syncLock;
    this.syncLock = {
      isLocked: false,
      lockedBy: null,
      lockedAt: null,
      direction: null,
    };
    if (was.isLocked) {
      const duration = was.lockedAt ? Math.round((Date.now() - was.lockedAt.getTime()) / 1000) : 0;
      console.log(`[SYNC-LOCK] Lock released after ${duration}s (was: ${was.direction} by ${was.lockedBy})`);
    }
  }
  
  /**
   * Get current lock status (for debugging/monitoring)
   */
  getLockStatus() {
    return {
      ...this.syncLock,
      lockAgeMs: this.syncLock.lockedAt ? Date.now() - this.syncLock.lockedAt.getTime() : null,
      timeoutMs: this.LOCK_TIMEOUT_MS,
    };
  }
  
  /**
   * Get current sync capabilities for capability negotiation
   * Peers can use this to determine what features are supported
   */
  getCapabilities() {
    return {
      ...SYNC_CAPABILITIES,
      environment: CURRENT_ENVIRONMENT,
      queriedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Check if a batch type is supported by this version
   */
  isBatchSupported(batchType: string): boolean {
    // Handle paginated batch types like 'advanced-intel-b-p42'
    const baseBatch = batchType.replace(/-p\d+$/, '');
    return SUPPORTED_BATCHES.includes(baseBatch as any);
  }
  
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
  
  /**
   * v23: Get the timestamp of the last successful pull sync for a specific batch
   * Used for delta sync to only fetch newer records
   */
  async getLastSuccessfulPullTime(batchType?: string): Promise<Date | null> {
    // Find the most recent successful or partial pull that included this batch
    // For advanced-intel-b specifically, we want the last time observations were synced
    const [lastPull] = await db
      .select()
      .from(syncRuns)
      .where(
        and(
          eq(syncRuns.direction, 'pull'),
          or(
            eq(syncRuns.status, 'success'),
            eq(syncRuns.status, 'partial') // Partial syncs may have completed some observations
          )
        )
      )
      .orderBy(desc(syncRuns.completedAt))
      .limit(1);
    
    return lastPull?.completedAt || null;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC VERIFICATION SYSTEM (v28)
  // Pre-sync manifests + post-sync verification to catch "secret fails"
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Generate a manifest of what we're about to sync for a given batch
   * This allows verification after sync completes
   */
  async generateSyncManifest(batchType: string): Promise<SyncManifest> {
    const manifest: SyncManifest = {
      batchType,
      generatedAt: new Date().toISOString(),
      environment: CURRENT_ENVIRONMENT,
      expected: {},
      checksums: {},
    };
    
    try {
      switch (batchType) {
        case 'beta-testers': {
          const testers = await db.select().from(users).where(eq(users.isBetaTester, true));
          const testerIds = testers.map(t => t.id);
          
          let credits: any[] = [];
          let enrollments: any[] = [];
          if (testerIds.length > 0) {
            credits = await db.select().from(usageLedger).where(inArray(usageLedger.userId, testerIds));
            enrollments = await db.select().from(classEnrollments).where(inArray(classEnrollments.studentId, testerIds));
          }
          
          // v30: Count classes using same logic as collectExportBundle:
          // 1. Public catalogue classes
          // 2. Classes owned by beta testers (teacherClasses.teacherId)
          // 3. Classes beta testers are enrolled in
          const classIdSet = new Set<string>();
          
          // Public classes
          const publicClasses = await db.select().from(teacherClasses).where(
            eq(teacherClasses.isPublicCatalogue, true)
          );
          for (const c of publicClasses) {
            classIdSet.add(c.id);
          }
          
          // Classes owned by beta testers
          if (testerIds.length > 0) {
            const ownedClasses = await db.select().from(teacherClasses).where(
              inArray(teacherClasses.teacherId, testerIds)
            );
            for (const c of ownedClasses) {
              classIdSet.add(c.id);
            }
          }
          
          // Classes beta testers are enrolled in
          const enrolledClassIds = Array.from(new Set(enrollments.map(e => e.classId)));
          for (const id of enrolledClassIds) {
            classIdSet.add(id);
          }
          
          manifest.expected = {
            users: testers.length,
            credits: credits.length,
            enrollments: enrollments.length,
            classes: classIdSet.size,
          };
          break;
        }
        
        case 'curriculum': {
          const lessons = await db.select({ count: sql<number>`count(*)` }).from(curriculumLessons);
          const units = await db.select({ count: sql<number>`count(*)` }).from(curriculumUnits);
          const classes = await db.select({ count: sql<number>`count(*)` }).from(teacherClasses);
          const drills = await db.select({ count: sql<number>`count(*)` }).from(curriculumDrillItems);
          
          manifest.expected = {
            lessons: Number(lessons[0]?.count || 0),
            units: Number(units[0]?.count || 0),
            classes: Number(classes[0]?.count || 0),
            drills: Number(drills[0]?.count || 0),
          };
          break;
        }
        
        case 'neural-core': {
          const bp = await db.select({ count: sql<number>`count(*)` }).from(selfBestPractices);
          manifest.expected = {
            bestPractices: Number(bp[0]?.count || 0),
          };
          break;
        }
        
        case 'product-config': {
          const voices = await db.select({ count: sql<number>`count(*)` }).from(tutorVoices);
          // v33: Include catalogue classes and hour packages in manifest
          const classes = await db.select({ count: sql<number>`count(*)` }).from(teacherClasses).where(eq(teacherClasses.isPublicCatalogue, true));
          const packages = await db.select({ count: sql<number>`count(*)` }).from(classHourPackages);
          manifest.expected = {
            tutorVoices: Number(voices[0]?.count || 0),
            catalogueClasses: Number(classes[0]?.count || 0),
            classHourPackages: Number(packages[0]?.count || 0),
          };
          break;
        }
        
        case 'all-classes': {
          // v34: Full class sync - ALL teacher classes and enrollments
          const allClasses = await db.select({ count: sql<number>`count(*)` }).from(teacherClasses);
          const allEnrolls = await db.select({ count: sql<number>`count(*)` }).from(classEnrollments);
          manifest.expected = {
            teacherClasses: Number(allClasses[0]?.count || 0),
            classEnrollments: Number(allEnrolls[0]?.count || 0),
          };
          break;
        }
        
        default:
          manifest.expected = { note: 'Manifest not implemented for this batch type' };
      }
    } catch (err: any) {
      console.error(`[SYNC-VERIFY] Manifest generation failed for ${batchType}:`, err.message);
      manifest.error = err.message;
    }
    
    return manifest;
  }
  
  /**
   * Get current record counts for verification (called by peer after import)
   */
  async getRecordCounts(tables: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    
    for (const table of tables) {
      try {
        switch (table) {
          case 'users':
            const u = await db.select({ count: sql<number>`count(*)` }).from(users);
            counts.users = Number(u[0]?.count || 0);
            break;
          case 'betaTesters':
            const bt = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isBetaTester, true));
            counts.betaTesters = Number(bt[0]?.count || 0);
            break;
          case 'usageLedger':
            const ul = await db.select({ count: sql<number>`count(*)` }).from(usageLedger);
            counts.usageLedger = Number(ul[0]?.count || 0);
            break;
          case 'classEnrollments':
            const ce = await db.select({ count: sql<number>`count(*)` }).from(classEnrollments);
            counts.classEnrollments = Number(ce[0]?.count || 0);
            break;
          case 'teacherClasses':
            const tc = await db.select({ count: sql<number>`count(*)` }).from(teacherClasses);
            counts.teacherClasses = Number(tc[0]?.count || 0);
            break;
          case 'curriculumLessons':
            const cl = await db.select({ count: sql<number>`count(*)` }).from(curriculumLessons);
            counts.curriculumLessons = Number(cl[0]?.count || 0);
            break;
          case 'curriculumUnits':
            const cu = await db.select({ count: sql<number>`count(*)` }).from(curriculumUnits);
            counts.curriculumUnits = Number(cu[0]?.count || 0);
            break;
          case 'curriculumDrillItems':
            const cdi = await db.select({ count: sql<number>`count(*)` }).from(curriculumDrillItems);
            counts.curriculumDrillItems = Number(cdi[0]?.count || 0);
            break;
          case 'tutorVoices':
            const tv = await db.select({ count: sql<number>`count(*)` }).from(tutorVoices);
            counts.tutorVoices = Number(tv[0]?.count || 0);
            break;
          case 'catalogueClasses':
            const cc = await db.select({ count: sql<number>`count(*)` }).from(teacherClasses).where(eq(teacherClasses.isPublicCatalogue, true));
            counts.catalogueClasses = Number(cc[0]?.count || 0);
            break;
          case 'bestPractices':
            const bpp = await db.select({ count: sql<number>`count(*)` }).from(selfBestPractices);
            counts.bestPractices = Number(bpp[0]?.count || 0);
            break;
          // v33: Curriculum Core tables
          case 'curriculumPaths':
            const cp = await db.select({ count: sql<number>`count(*)` }).from(curriculumPaths);
            counts.curriculumPaths = Number(cp[0]?.count || 0);
            break;
          case 'grammarCompetencies':
            const gc = await db.select({ count: sql<number>`count(*)` }).from(grammarCompetencies);
            counts.grammarCompetencies = Number(gc[0]?.count || 0);
            break;
          case 'canDoStatements':
            const cds = await db.select({ count: sql<number>`count(*)` }).from(canDoStatements);
            counts.canDoStatements = Number(cds[0]?.count || 0);
            break;
          case 'lessonCanDoStatements':
            const lcds = await db.select({ count: sql<number>`count(*)` }).from(lessonCanDoStatements);
            counts.lessonCanDoStatements = Number(lcds[0]?.count || 0);
            break;
          case 'culturalTips':
            const ct = await db.select({ count: sql<number>`count(*)` }).from(culturalTips);
            counts.culturalTips = Number(ct[0]?.count || 0);
            break;
          // v33: Neural Core language content
          case 'languageIdioms':
            const li = await db.select({ count: sql<number>`count(*)` }).from(languageIdioms);
            counts.languageIdioms = Number(li[0]?.count || 0);
            break;
          case 'culturalNuances':
            const cn = await db.select({ count: sql<number>`count(*)` }).from(culturalNuances);
            counts.culturalNuances = Number(cn[0]?.count || 0);
            break;
          case 'learnerErrorPatterns':
            const lep = await db.select({ count: sql<number>`count(*)` }).from(learnerErrorPatterns);
            counts.learnerErrorPatterns = Number(lep[0]?.count || 0);
            break;
          case 'dialectVariations':
            const dv = await db.select({ count: sql<number>`count(*)` }).from(dialectVariations);
            counts.dialectVariations = Number(dv[0]?.count || 0);
            break;
          case 'linguisticBridges':
            const lb = await db.select({ count: sql<number>`count(*)` }).from(linguisticBridges);
            counts.linguisticBridges = Number(lb[0]?.count || 0);
            break;
          // v33: Daniela Intelligence
          case 'danielaGrowthMemories':
            const dgm = await db.select({ count: sql<number>`count(*)` }).from(danielaGrowthMemories);
            counts.danielaGrowthMemories = Number(dgm[0]?.count || 0);
            break;
          case 'danielaBeacons':
            const dab = await db.select({ count: sql<number>`count(*)` }).from(danielaBeacons);
            counts.danielaBeacons = Number(dab[0]?.count || 0);
            break;
          case 'synthesizedInsights':
            const si = await db.select({ count: sql<number>`count(*)` }).from(synthesizedInsights);
            counts.synthesizedInsights = Number(si[0]?.count || 0);
            break;
          case 'danielaRecommendations':
            const dr = await db.select({ count: sql<number>`count(*)` }).from(danielaRecommendations);
            counts.danielaRecommendations = Number(dr[0]?.count || 0);
            break;
          // v33: Hive & Express Lane
          case 'hiveSnapshots':
            const hs = await db.select({ count: sql<number>`count(*)` }).from(hiveSnapshots);
            counts.hiveSnapshots = Number(hs[0]?.count || 0);
            break;
          case 'founderSessions':
            const fs = await db.select({ count: sql<number>`count(*)` }).from(founderSessions);
            counts.founderSessions = Number(fs[0]?.count || 0);
            break;
          case 'collaborationMessages':
            const cm = await db.select({ count: sql<number>`count(*)` }).from(collaborationMessages);
            counts.collaborationMessages = Number(cm[0]?.count || 0);
            break;
          case 'learnerPersonalFacts':
            const lpf = await db.select({ count: sql<number>`count(*)` }).from(learnerPersonalFacts);
            counts.learnerPersonalFacts = Number(lpf[0]?.count || 0);
            break;
          // v33: Wren Intelligence
          case 'wrenInsights':
            const wi = await db.select({ count: sql<number>`count(*)` }).from(wrenInsights);
            counts.wrenInsights = Number(wi[0]?.count || 0);
            break;
          case 'wrenMistakes':
            const wm = await db.select({ count: sql<number>`count(*)` }).from(wrenMistakes);
            counts.wrenMistakes = Number(wm[0]?.count || 0);
            break;
          case 'wrenLessons':
            const wl = await db.select({ count: sql<number>`count(*)` }).from(wrenLessons);
            counts.wrenLessons = Number(wl[0]?.count || 0);
            break;
          case 'wrenCommitments':
            const wc = await db.select({ count: sql<number>`count(*)` }).from(wrenCommitments);
            counts.wrenCommitments = Number(wc[0]?.count || 0);
            break;
          // v33: Voice sessions
          case 'voiceSessions':
            const vs = await db.select({ count: sql<number>`count(*)` }).from(voiceSessions);
            counts.voiceSessions = Number(vs[0]?.count || 0);
            break;
          default:
            counts[table] = -1; // Unknown table
        }
      } catch (err: any) {
        console.error(`[SYNC-VERIFY] Count failed for ${table}:`, err.message);
        counts[table] = -1;
      }
    }
    
    return counts;
  }
  
  /**
   * Verify a sync by comparing expected manifest against peer's actual counts
   * Returns discrepancies found
   */
  async verifySyncWithPeer(peerUrl: string, manifest: SyncManifest): Promise<SyncVerificationResult> {
    const result: SyncVerificationResult = {
      batchType: manifest.batchType,
      verifiedAt: new Date().toISOString(),
      success: true,
      discrepancies: [],
      peerCounts: {},
      expectedCounts: manifest.expected,
    };
    
    try {
      // Build list of tables to verify based on batch type
      // Note: We verify "at least X records" rather than "exactly X records"
      // since prod may have additional data from other sources
      const tablesToVerify: string[] = [];
      switch (manifest.batchType) {
        case 'beta-testers':
          // All tables included in beta-testers batch
          tablesToVerify.push('betaTesters', 'teacherClasses');
          break;
        case 'curriculum':
          tablesToVerify.push('curriculumLessons', 'curriculumUnits', 'teacherClasses', 'curriculumDrillItems');
          break;
        case 'product-config':
          tablesToVerify.push('tutorVoices');
          tablesToVerify.push('catalogueClasses'); // v33: Public syllabi
          break;
        case 'neural-core':
          tablesToVerify.push('bestPractices');
          break;
        case 'all-classes':
          // v34: Full class sync verification
          tablesToVerify.push('teacherClasses', 'classEnrollments');
          break;
      }
      
      if (tablesToVerify.length === 0) {
        result.success = true;
        result.discrepancies.push('No tables to verify for this batch type');
        return result;
      }
      
      // Call peer's verification endpoint with proper HMAC authentication (v30)
      const verifyPayload = { tables: tablesToVerify };
      const response = await fetch(`${peerUrl}/api/sync/verify-counts`, {
        method: 'POST',
        headers: createSyncHeaders(verifyPayload),
        body: JSON.stringify(verifyPayload),
      });
      
      if (!response.ok) {
        result.success = false;
        result.discrepancies.push(`Peer verification endpoint failed: ${response.status}`);
        return result;
      }
      
      const peerData = await response.json();
      result.peerCounts = peerData.counts || {};
      
      // Compare expected vs actual for key metrics
      // Mapping from manifest keys to verification keys
      const keyMapping: Record<string, Record<string, string>> = {
        'beta-testers': {
          'users': 'betaTesters',
          'classes': 'teacherClasses',
        },
        'curriculum': {
          'lessons': 'curriculumLessons',
          'units': 'curriculumUnits',
          'classes': 'teacherClasses',
          'drills': 'curriculumDrillItems',
        },
        'product-config': {
          'tutorVoices': 'tutorVoices',
          'catalogueClasses': 'catalogueClasses',
        },
        'neural-core': {
          'bestPractices': 'bestPractices',
        },
        'all-classes': {
          'teacherClasses': 'teacherClasses',
          'classEnrollments': 'classEnrollments',
        },
      };
      
      const mapping = keyMapping[manifest.batchType] || {};
      const comparisons: Array<{ manifestKey: string; verifyKey: string; expected: number; actual: number }> = [];
      
      for (const [manifestKey, verifyKey] of Object.entries(mapping)) {
        const expected = manifest.expected[manifestKey];
        if (typeof expected === 'number') {
          comparisons.push({
            manifestKey,
            verifyKey,
            expected,
            actual: result.peerCounts[verifyKey] || 0,
          });
        }
      }
      
      // Check for discrepancies - we verify "peer has at least X records"
      // since peer may have additional data from other syncs or local additions
      for (const comp of comparisons) {
        if (comp.actual < comp.expected) {
          result.success = false;
          result.discrepancies.push(
            `${comp.verifyKey}: sent ${comp.expected}, peer has ${comp.actual} (MISSING ${comp.expected - comp.actual})`
          );
        } else if (comp.actual >= comp.expected) {
          // Peer has at least what we sent - this is success
          result.discrepancies.push(
            `${comp.verifyKey}: sent ${comp.expected}, peer has ${comp.actual} OK`
          );
        }
      }
      
      if (comparisons.length === 0) {
        result.discrepancies.push('No comparisons defined for this batch type');
      }
      
    } catch (err: any) {
      result.success = false;
      result.discrepancies.push(`Verification failed: ${err.message}`);
    }
    
    return result;
  }
  
  /**
   * Log sync verification results with clear formatting
   */
  logVerificationResult(result: SyncVerificationResult): void {
    const status = result.success ? '✓ VERIFIED' : '✗ DISCREPANCY';
    console.log(`\n[SYNC-VERIFY] ═══ ${result.batchType} ${status} ═══`);
    console.log(`[SYNC-VERIFY] Expected: ${JSON.stringify(result.expectedCounts)}`);
    console.log(`[SYNC-VERIFY] Peer has:  ${JSON.stringify(result.peerCounts)}`);
    for (const d of result.discrepancies) {
      console.log(`[SYNC-VERIFY] ${result.success ? '  ' : '! '}${d}`);
    }
    console.log(`[SYNC-VERIFY] ═══════════════════════════════════════\n`);
  }
  
  async collectExportBundle(incrementalSince?: Date | null, batchType?: string, options?: { sinceTimestamp?: string }): Promise<Partial<SyncBundle>> {
    // If a specific batch type is requested, only export that batch
    // This enables batched sync to avoid timeout issues
    
    const bundle: Partial<SyncBundle> = {
      generatedAt: new Date().toISOString(),
      sourceEnvironment: CURRENT_ENVIRONMENT,
      codeVersion: SYNC_BRIDGE_CODE_VERSION,
      capabilities: SYNC_CAPABILITIES,
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
      // v23: Delta sync - pass incrementalSince to only export new observations
      const sinceTs = incrementalSince || undefined;
      console.log(`[SYNC-BRIDGE v23] Step 1/2: exportTriLaneObservations (page=${page}${sinceTs ? ', delta since ' + sinceTs.toISOString() : ''})...`);
      try {
        triLane = await neuralNetworkSync.exportTriLaneObservations({ page, sinceTimestamp: sinceTs });
        const pag = triLane?.pagination;
        console.log(`[SYNC-BRIDGE v23] Step 1 OK: ${triLane?.agentObservations?.length || 0}/${pag?.agentTotal || '?'} agent, ${triLane?.supportObservations?.length || 0}/${pag?.supportTotal || '?'} support, ${triLane?.systemAlerts?.length || 0}/${pag?.alertsTotal || '?'} alerts, hasMore=${pag?.hasMore}${triLane?.deltaSync?.isDelta ? ' (DELTA)' : ''} (+${Date.now() - batchStart}ms)`);
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
    
    // BATCH: founder-conversations - Push founder's dev conversations to prod for Daniela continuity
    if (!batchType || batchType === 'founder-conversations') {
      try {
        const convData = await this.exportFounderConversations();
        bundle.founderConversations = convData;
        console.log(`[SYNC-BRIDGE] founder-conversations: ${convData.conversations?.length || 0} conversations, ${convData.messages?.length || 0} messages`);
      } catch (err: any) {
        const errMsg = `founder-conversations export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.founderConversations = undefined;
      }
    }
    
    // BATCH: product-config - Tutor voices + public catalogue classes + pricing packages (v33)
    if (!batchType || batchType === 'product-config') {
      try {
        const voices = await this.exportTutorVoices();
        bundle.tutorVoices = voices;
        
        // v33: Include public catalogue classes (teacherClasses with isPublicCatalogue=true)
        // These are official HolaHola syllabi that need to sync from dev to prod
        const catalogueClasses = await db.select().from(teacherClasses).where(
          eq(teacherClasses.isPublicCatalogue, true)
        );
        bundle.catalogueClasses = catalogueClasses;
        
        // v33: Include pricing packages (bidirectional sync)
        const hourPackages = await db.select().from(classHourPackages);
        bundle.classHourPackages = hourPackages;
        console.log(`[SYNC-BRIDGE] product-config: ${voices.length} voices, ${catalogueClasses.length} catalogue classes, ${hourPackages.length} hour packages`);
      } catch (err: any) {
        const errMsg = `product-config export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.tutorVoices = [];
        bundle.catalogueClasses = [];
        bundle.classHourPackages = [];
      }
    }
    
    // BATCH: curriculum-core - Syllabi paths, units, lessons, topics
    if (!batchType || batchType === 'curriculum-core') {
      try {
        const paths = await db.select().from(curriculumPaths);
        const units = await db.select().from(curriculumUnits);
        const lessons = await db.select().from(curriculumLessons);
        const topicsData = await db.select().from(topics);
        
        bundle.curriculumPaths = paths;
        bundle.curriculumUnits = units;
        bundle.curriculumLessons = lessons;
        bundle.topics = topicsData;
        console.log(`[SYNC-BRIDGE] curriculum-core: ${paths.length} paths, ${units.length} units, ${lessons.length} lessons, ${topicsData.length} topics`);
      } catch (err: any) {
        const errMsg = `curriculum-core export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.curriculumPaths = [];
        bundle.curriculumUnits = [];
        bundle.curriculumLessons = [];
        bundle.topics = [];
      }
    }
    
    // BATCH: curriculum-drills - Drill items, grammar exercises, grammar competencies, can-do statements, cultural tips, lesson-can-do links
    if (!batchType || batchType === 'curriculum-drills') {
      try {
        const drills = await db.select().from(curriculumDrillItems);
        const grammar = await db.select().from(grammarExercises);
        // v33: Grammar competencies (skill definitions per language)
        const grammarComp = await db.select().from(grammarCompetencies);
        const canDo = await db.select().from(canDoStatements);
        const cultural = await db.select().from(culturalTips);
        // v33: Include lesson-to-CanDo links for fluency wiring
        const lessonCanDo = await db.select().from(lessonCanDoStatements);
        
        bundle.curriculumDrillItems = drills;
        bundle.grammarExercises = grammar;
        bundle.grammarCompetencies = grammarComp;
        bundle.canDoStatements = canDo;
        bundle.culturalTips = cultural;
        bundle.lessonCanDoStatements = lessonCanDo;
        // v33: Lesson-level attachments (must export after parent tables for FK ordering)
        const lessonCultural = await db.select().from(lessonCulturalTips);
        const lessonVisual = await db.select().from(lessonVisualAids);
        const culturalMedia = await db.select().from(culturalTipMedia);
        bundle.lessonCulturalTips = lessonCultural;
        bundle.lessonVisualAids = lessonVisual;
        bundle.culturalTipMedia = culturalMedia;
        console.log(`[SYNC-BRIDGE] curriculum-drills: ${drills.length} drills, ${grammar.length} grammar, ${grammarComp.length} grammar-comp, ${canDo.length} can-do, ${cultural.length} cultural, ${lessonCanDo.length} lesson-can-do, ${lessonCultural.length} lesson-cultural, ${lessonVisual.length} lesson-visual, ${culturalMedia.length} cultural-media`);
      } catch (err: any) {
        const errMsg = `curriculum-drills export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.curriculumDrillItems = [];
        bundle.grammarExercises = [];
        bundle.grammarCompetencies = [];
        bundle.canDoStatements = [];
        bundle.culturalTips = [];
        bundle.lessonCanDoStatements = [];
        bundle.lessonCulturalTips = [];
        bundle.lessonVisualAids = [];
        bundle.culturalTipMedia = [];
      }
    }
    
    // BATCH: wren-intel - All Wren intelligence tables (11 tables total)
    if (!batchType || batchType === 'wren-intel') {
      try {
        // Core Wren tables
        const insights = await db.select().from(wrenInsights);
        const triggers = await db.select().from(wrenProactiveTriggers);
        const adrs = await db.select().from(architecturalDecisionRecords);
        const mistakes = await db.select().from(wrenMistakes);
        const lessons = await db.select().from(wrenLessons);
        const commitments = await db.select().from(wrenCommitments);
        
        // Extended Wren tables (mistake resolutions, session notes, predictions, calibration)
        const mistakeResolutions = await db.select().from(wrenMistakeResolutions);
        const sessionNotes = await db.select().from(wrenSessionNotes);
        const predictions = await db.select().from(wrenPredictions);
        const confidenceRecords = await db.select().from(wrenConfidenceRecords);
        const calibrationStats = await db.select().from(wrenCalibrationStats);
        
        bundle.wrenInsights = insights;
        bundle.wrenProactiveTriggers = triggers;
        bundle.architecturalDecisionRecords = adrs;
        bundle.wrenMistakes = mistakes;
        bundle.wrenLessons = lessons;
        bundle.wrenCommitments = commitments;
        bundle.wrenMistakeResolutions = mistakeResolutions;
        bundle.wrenSessionNotes = sessionNotes;
        bundle.wrenPredictions = predictions;
        bundle.wrenConfidenceRecords = confidenceRecords;
        bundle.wrenCalibrationStats = calibrationStats;
        
        console.log(`[SYNC-BRIDGE] wren-intel: ${insights.length} insights, ${triggers.length} triggers, ${adrs.length} ADRs, ${mistakes.length} mistakes, ${lessons.length} lessons, ${commitments.length} commitments, ${mistakeResolutions.length} resolutions, ${sessionNotes.length} notes, ${predictions.length} predictions, ${confidenceRecords.length} confidence, ${calibrationStats.length} calibration`);
      } catch (err: any) {
        const errMsg = `wren-intel export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.wrenInsights = [];
        bundle.wrenProactiveTriggers = [];
        bundle.architecturalDecisionRecords = [];
        bundle.wrenMistakes = [];
        bundle.wrenLessons = [];
        bundle.wrenCommitments = [];
        bundle.wrenMistakeResolutions = [];
        bundle.wrenSessionNotes = [];
        bundle.wrenPredictions = [];
        bundle.wrenConfidenceRecords = [];
        bundle.wrenCalibrationStats = [];
      }
    }
    
    // BATCH: daniela-intel - Daniela recommendations, feedback, beacons, and synthesized insights
    if (!batchType || batchType === 'daniela-intel') {
      try {
        const recommendations = await db.select().from(danielaRecommendations);
        const feedback = await db.select().from(danielaFeatureFeedback);
        const beacons = await db.select().from(danielaBeacons);
        const insights = await db.select().from(synthesizedInsights);
        
        bundle.danielaRecommendations = recommendations;
        bundle.danielaFeatureFeedback = feedback;
        bundle.danielaBeacons = beacons;
        bundle.synthesizedInsights = insights;
        console.log(`[SYNC-BRIDGE] daniela-intel: ${recommendations.length} recommendations, ${feedback.length} feedback, ${beacons.length} beacons, ${insights.length} synthesized insights`);
      } catch (err: any) {
        const errMsg = `daniela-intel export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.danielaRecommendations = [];
        bundle.danielaFeatureFeedback = [];
        bundle.danielaBeacons = [];
        bundle.synthesizedInsights = [];
      }
    }
    
    // BATCH: beta-testers - Users with isBetaTester flag, their credits, enrollments, AND the classes they need
    if (!batchType || batchType === 'beta-testers') {
      try {
        const testers = await db.select().from(users).where(eq(users.isBetaTester, true));
        const testerIds = testers.map(t => t.id);
        
        // Get credits and enrollments for beta testers
        let credits: any[] = [];
        let enrollments: any[] = [];
        if (testerIds.length > 0) {
          credits = await db.select().from(usageLedger).where(inArray(usageLedger.userId, testerIds));
          enrollments = await db.select().from(classEnrollments).where(inArray(classEnrollments.studentId, testerIds));
        }
        
        // v30: Include classes that beta testers:
        // 1. Are enrolled in as students
        // 2. OWN as teachers (teacherClasses.teacherId)
        // 3. Public catalogue classes
        const enrolledClassIds = Array.from(new Set(enrollments.map(e => e.classId))) as string[];
        const classIdSet = new Set<string>();
        let classes: any[] = [];
        
        // Get all public classes
        const publicClasses = await db.select().from(teacherClasses).where(
          eq(teacherClasses.isPublicCatalogue, true)
        );
        for (const c of publicClasses) {
          if (!classIdSet.has(c.id)) {
            classIdSet.add(c.id);
            classes.push(c);
          }
        }
        
        // Add classes that beta testers OWN (they are the teacher)
        if (testerIds.length > 0) {
          const ownedClasses = await db.select().from(teacherClasses).where(
            inArray(teacherClasses.teacherId, testerIds)
          );
          for (const c of ownedClasses) {
            if (!classIdSet.has(c.id)) {
              classIdSet.add(c.id);
              classes.push(c);
            }
          }
          console.log(`[SYNC-BRIDGE v30] beta-testers: found ${ownedClasses.length} classes owned by testers`);
        }
        
        // Add classes that testers are enrolled in
        if (enrolledClassIds.length > 0) {
          const enrolledClasses = await db.select().from(teacherClasses).where(
            inArray(teacherClasses.id, enrolledClassIds)
          );
          for (const c of enrolledClasses) {
            if (!classIdSet.has(c.id)) {
              classIdSet.add(c.id);
              classes.push(c);
            }
          }
        }
        
        bundle.betaTesters = testers;
        bundle.betaTesterCredits = credits;
        bundle.betaTesterEnrollments = enrollments;
        bundle.betaTesterClasses = classes;
        console.log(`[SYNC-BRIDGE] beta-testers: ${testers.length} testers, ${credits.length} credits, ${enrollments.length} enrollments, ${classes.length} classes`);
      } catch (err: any) {
        const errMsg = `beta-testers export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.betaTesters = [];
        bundle.betaTesterCredits = [];
        bundle.betaTesterEnrollments = [];
        bundle.betaTesterClasses = [];
      }
    }
    
    // BATCH: all-classes - ALL teacher classes and enrollments (v34: full class sync for teachers)
    // This syncs ALL classes regardless of beta tester status - needed for teacher class management
    if (batchType === 'all-classes') {
      try {
        const allClasses = await db.select().from(teacherClasses);
        const allEnrolls = await db.select().from(classEnrollments);
        
        bundle.allTeacherClasses = allClasses;
        bundle.allEnrollments = allEnrolls;
        console.log(`[SYNC-BRIDGE v34] all-classes: ${allClasses.length} teacher classes, ${allEnrolls.length} enrollments`);
      } catch (err: any) {
        const errMsg = `all-classes export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.allTeacherClasses = [];
        bundle.allEnrollments = [];
      }
    }
    
    // BATCH: beta-usage - Pull voice sessions and usage data from production (v19 bidirectional sync)
    // v25: Supports pagination via beta-usage-p1, beta-usage-p2, etc.
    if (batchType === 'beta-usage' || batchType?.startsWith('beta-usage-p')) {
      try {
        // Parse page number from batch type (e.g., beta-usage-p2 -> page 2)
        let page = 0;
        if (batchType?.startsWith('beta-usage-p')) {
          page = parseInt(batchType.replace('beta-usage-p', ''), 10) || 0;
        }
        
        // v25: Support delta sync - check options first, fall back to incrementalSince from route
        const sinceTimestamp = options?.sinceTimestamp || (incrementalSince ? incrementalSince.toISOString() : undefined);
        
        const betaUsageData = await this.exportBetaUsage({ page, sinceTimestamp });
        bundle.betaUsage = betaUsageData;
        console.log(`[SYNC-BRIDGE v25] beta-usage page ${page}: ${betaUsageData?.voiceSessions?.length || 0} sessions, ${betaUsageData?.usageLedger?.length || 0} ledger${betaUsageData?.hasMore ? ' [MORE]' : ' [DONE]'}`);
      } catch (err: any) {
        const errMsg = `beta-usage export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.betaUsage = { voiceSessions: [], usageLedger: [], costSummaries: [], conversations: [], exportedAt: new Date().toISOString(), hasMore: false, page: 0 };
      }
    }
    
    // BATCH: aggregate-analytics - Anonymized usage statistics from production (v19)
    if (batchType === 'aggregate-analytics') {
      try {
        const analyticsData = await this.exportAggregateAnalytics();
        bundle.aggregateAnalytics = analyticsData;
        console.log(`[SYNC-BRIDGE v19] aggregate-analytics exported successfully`);
      } catch (err: any) {
        const errMsg = `aggregate-analytics export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.aggregateAnalytics = undefined;
      }
    }
    
    // BATCH: prod-content-growth - Daniela-authored pedagogical content from production (v19)
    // This pulls content she created during teaching sessions back to dev for review
    if (batchType === 'prod-content-growth') {
      try {
        const contentData = await this.exportProdContentGrowth();
        bundle.prodContentGrowth = contentData;
        const totalItems = (contentData.idioms?.length || 0) + (contentData.nuances?.length || 0) + 
          (contentData.errorPatterns?.length || 0) + (contentData.dialects?.length || 0) + 
          (contentData.bridges?.length || 0) + (contentData.culturalTips?.length || 0);
        console.log(`[SYNC-BRIDGE v19] prod-content-growth: ${totalItems} total items exported`);
      } catch (err: any) {
        const errMsg = `prod-content-growth export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.prodContentGrowth = undefined;
      }
    }
    
    // BATCH: founder-context - Founder's personal facts for same Daniela in dev/prod (bidirectional)
    if (!batchType || batchType === 'founder-context') {
      try {
        const contextData = await this.exportFounderContext();
        bundle.founderContext = contextData;
        console.log(`[SYNC-BRIDGE v19] founder-context: ${contextData.personalFacts?.length || 0} personal facts exported`);
      } catch (err: any) {
        const errMsg = `founder-context export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.founderContext = undefined;
      }
    }
    
    // BATCH: prod-conversations - Recent conversation transcripts for troubleshooting (prod → dev pull)
    if (batchType === 'prod-conversations') {
      try {
        const convData = await this.exportProdConversations();
        bundle.prodConversations = convData;
        console.log(`[SYNC-BRIDGE v19] prod-conversations: ${convData.conversations?.length || 0} conversations, ${convData.messages?.length || 0} messages exported`);
      } catch (err: any) {
        const errMsg = `prod-conversations export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.prodConversations = undefined;
      }
    }
    
    // BATCH: sofia-telemetry - Sofia runtime faults and issue reports for cross-env debugging (prod → dev pull)
    if (batchType === 'sofia-telemetry') {
      try {
        const telemetryData = await this.exportSofiaTelemetry();
        bundle.sofiaTelemetry = telemetryData;
        console.log(`[SYNC-BRIDGE v19] sofia-telemetry: ${telemetryData.issueReports?.length || 0} issue reports, ${telemetryData.runtimeFaults} faults, ${telemetryData.pendingCount} pending`);
      } catch (err: any) {
        const errMsg = `sofia-telemetry export failed: ${err.message}`;
        console.error(`[SYNC-BRIDGE] ${errMsg}`, err);
        batchErrors.push(errMsg);
        bundle.sofiaTelemetry = undefined;
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
      tutorVoices: bundle.tutorVoices?.length || 0,
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
  
  /**
   * Export Tutor Voices for cross-environment sync
   * Includes main tutors (role=tutor), assistant tutors (role=assistant), and support voices (role=support)
   * This is product configuration, not incremental - export all active voices
   */
  async exportTutorVoices(): Promise<any[]> {
    const voices = await db
      .select()
      .from(tutorVoices)
      .where(eq(tutorVoices.isActive, true))
      .orderBy(tutorVoices.language, tutorVoices.role, tutorVoices.gender);
    
    console.log(`[SYNC-BRIDGE] Exporting ${voices.length} Tutor Voices (tutors + assistants + support)`);
    return voices;
  }
  
  /**
   * Export Feature Flags for cross-environment sync
   * Currently a placeholder - feature flags table doesn't exist yet
   */
  async exportFeatureFlags(): Promise<any[]> {
    // Feature flags table doesn't exist yet
    return [];
  }
  
  /**
   * Export Beta Testers for cross-environment sync
   * Exports users with isBetaTester=true along with their credits and enrollments
   * Includes ALL auth providers (password, replit, etc.) so founder/admin enrollments sync too
   */
  async exportBetaTesters(): Promise<{ users: any[]; credits: any[]; enrollments: any[] }> {
    // Get ALL beta testers regardless of auth provider
    // Replit auth users already exist on prod, but we need to sync their enrollments
    const betaUsers = await db
      .select()
      .from(users)
      .where(eq(users.isBetaTester, true));
    
    if (betaUsers.length === 0) {
      console.log(`[SYNC-BRIDGE] No beta testers to export`);
      return { users: [], credits: [], enrollments: [] };
    }
    
    // Get credits for all beta testers
    const userIds = betaUsers.map(u => u.id);
    const credits = await db
      .select()
      .from(usageLedger)
      .where(inArray(usageLedger.userId, userIds));
    
    // Get enrollments for all beta testers (so we sync class access too)
    const enrollments = await db
      .select()
      .from(classEnrollments)
      .where(inArray(classEnrollments.studentId, userIds));
    
    console.log(`[SYNC-BRIDGE] Exporting ${betaUsers.length} Beta Testers with ${credits.length} credits and ${enrollments.length} enrollments`);
    return { users: betaUsers, credits, enrollments };
  }
  
  /**
   * Sync a single user to production immediately
   * Used when creating test accounts so they exist in prod when tester receives email
   * This is a lightweight, targeted sync - much faster than full beta-testers batch
   */
  async syncSingleUserToProd(userId: string): Promise<{ success: boolean; error?: string }> {
    const peerUrl = getSyncPeerUrl();
    if (!peerUrl) {
      return { success: false, error: 'Sync not configured (no peer URL)' };
    }
    
    try {
      // Get the user
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      
      // Get any credits for this user
      const userCredits = await db.select().from(usageLedger).where(eq(usageLedger.userId, userId));
      
      console.log(`[SYNC-BRIDGE] Syncing single user ${user.email} to production...`);
      
      // Create a minimal bundle with just this user
      const bundle: Partial<SyncBundle> = {
        generatedAt: new Date().toISOString(),
        sourceEnvironment: CURRENT_ENVIRONMENT,
        codeVersion: SYNC_BRIDGE_CODE_VERSION,
        betaTesters: [user],
        betaTesterCredits: userCredits,
      };
      
      // Send to peer
      const result = await this.sendBatch(peerUrl, 'beta-testers', bundle);
      
      if (result.success) {
        console.log(`[SYNC-BRIDGE] Single user sync SUCCESS: ${user.email}`);
        return { success: true };
      } else {
        console.error(`[SYNC-BRIDGE] Single user sync FAILED: ${result.errors.join(', ')}`);
        return { success: false, error: result.errors.join(', ') };
      }
    } catch (err: any) {
      console.error(`[SYNC-BRIDGE] Single user sync error:`, err);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Export Beta Tester Usage Data (prod → dev pull)
   * Exports voice sessions, usage ledger entries, and cost summaries for beta testers
   * v24: Also exports conversations referenced by voice sessions to satisfy foreign keys
   * v25: Added pagination and delta sync support to avoid timeout issues
   */
  async exportBetaUsage(options?: { 
    page?: number; 
    sinceTimestamp?: string;
  }): Promise<{ 
    voiceSessions: any[]; 
    usageLedger: any[]; 
    costSummaries: any[];
    conversations: any[]; // v24: Required parent records for voice sessions
    exportedAt: string;
    hasMore: boolean; // v25: Pagination indicator
    page: number; // v25: Current page
    totalSessions?: number; // v25: Total count for progress tracking
  }> {
    const PAGE_SIZE = 250; // Keep batches small to avoid timeout
    const page = options?.page || 0;
    const sinceTimestamp = options?.sinceTimestamp ? new Date(options.sinceTimestamp) : null;
    
    // Get beta tester user IDs
    const betaUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isBetaTester, true));
    
    if (betaUsers.length === 0) {
      console.log(`[SYNC-BRIDGE] No beta testers found for usage export`);
      return { voiceSessions: [], usageLedger: [], costSummaries: [], conversations: [], exportedAt: new Date().toISOString(), hasMore: false, page: 0 };
    }
    
    const userIds = betaUsers.map(u => u.id);
    
    // Build where conditions for delta sync
    const sessionConditions = [inArray(voiceSessions.userId, userIds)];
    if (sinceTimestamp) {
      sessionConditions.push(gte(voiceSessions.startedAt, sinceTimestamp));
    }
    
    // Get total count for progress tracking (only on first page)
    let totalSessions: number | undefined;
    if (page === 0) {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(voiceSessions)
        .where(and(...sessionConditions));
      totalSessions = countResult[0]?.count || 0;
    }
    
    // Get paginated voice sessions for beta testers
    const sessions = await db
      .select()
      .from(voiceSessions)
      .where(and(...sessionConditions))
      .orderBy(desc(voiceSessions.startedAt))
      .limit(PAGE_SIZE)
      .offset(page * PAGE_SIZE);
    
    // v24: Get conversations referenced by voice sessions (to satisfy foreign keys)
    const conversationIds = Array.from(new Set(sessions.map(s => s.conversationId).filter(Boolean))) as string[];
    let referencedConversations: any[] = [];
    if (conversationIds.length > 0) {
      referencedConversations = await db
        .select({
          id: conversations.id,
          userId: conversations.userId,
          language: conversations.language,
          nativeLanguage: conversations.nativeLanguage,
          difficulty: conversations.difficulty,
          topic: conversations.topic,
          title: conversations.title,
          messageCount: conversations.messageCount,
          duration: conversations.duration,
          actflLevel: conversations.actflLevel,
          classId: conversations.classId,
          learningContext: conversations.learningContext,
          createdAt: conversations.createdAt,
        })
        .from(conversations)
        .where(inArray(conversations.id, conversationIds));
    }
    
    // Get usage ledger entries - only on first page (not paginated separately)
    // This keeps ledger synced with sessions for consistency
    let ledgerEntries: any[] = [];
    let costSummaryEntries: any[] = [];
    if (page === 0) {
      const ledgerConditions = [inArray(usageLedger.userId, userIds)];
      if (sinceTimestamp) {
        ledgerConditions.push(gte(usageLedger.createdAt, sinceTimestamp));
      }
      
      ledgerEntries = await db
        .select()
        .from(usageLedger)
        .where(and(...ledgerConditions))
        .orderBy(desc(usageLedger.createdAt));
      
      // Get cost summaries (same delta filter)
      const costConditions = [inArray(sessionCostSummary.userId, userIds)];
      if (sinceTimestamp) {
        costConditions.push(gte(sessionCostSummary.createdAt, sinceTimestamp));
      }
      
      costSummaryEntries = await db
        .select()
        .from(sessionCostSummary)
        .where(and(...costConditions))
        .orderBy(desc(sessionCostSummary.createdAt));
    }
    
    const hasMore = sessions.length === PAGE_SIZE;
    console.log(`[SYNC-BRIDGE v25] Exporting beta usage page ${page}: ${sessions.length} sessions, ${ledgerEntries.length} ledger, ${referencedConversations.length} conversations${sinceTimestamp ? ` (since ${sinceTimestamp.toISOString()})` : ''}${hasMore ? ' [MORE]' : ' [DONE]'}`);
    
    return { 
      voiceSessions: sessions, 
      usageLedger: ledgerEntries, 
      costSummaries: costSummaryEntries,
      conversations: referencedConversations,
      exportedAt: new Date().toISOString(),
      hasMore,
      page,
      totalSessions
    };
  }
  
  /**
   * Export Aggregate Analytics (prod → dev pull)
   * Anonymized usage statistics - no PII, just numbers
   * Great for understanding overall platform usage patterns
   */
  async exportAggregateAnalytics(): Promise<{
    totalUsers: number;
    totalBetaTesters: number;
    totalVoiceSessions: number;
    totalVoiceMinutes: number;
    totalCreditsConsumed: number;
    totalCreditsEarned: number;
    sessionsByLanguage: Record<string, number>;
    sessionsByDay: Array<{ date: string; count: number; minutes: number }>;
    averageSessionDuration: number;
    exportedAt: string;
  }> {
    // Total user counts
    const userCounts = await db
      .select({
        total: sql<number>`count(*)`,
        betaTesters: sql<number>`count(*) filter (where ${users.isBetaTester} = true)`
      })
      .from(users);
    
    // Voice session stats
    const sessionStats = await db
      .select({
        total: sql<number>`count(*)`,
        totalMinutes: sql<number>`coalesce(sum(${voiceSessions.durationSeconds}), 0) / 60`,
        avgDuration: sql<number>`coalesce(avg(${voiceSessions.durationSeconds}), 0)`
      })
      .from(voiceSessions);
    
    // Credit stats
    const creditStats = await db
      .select({
        consumed: sql<number>`coalesce(sum(case when ${usageLedger.creditSeconds} < 0 then abs(${usageLedger.creditSeconds}) else 0 end), 0)`,
        earned: sql<number>`coalesce(sum(case when ${usageLedger.creditSeconds} > 0 then ${usageLedger.creditSeconds} else 0 end), 0)`
      })
      .from(usageLedger);
    
    // Sessions by language
    const langStats = await db
      .select({
        language: voiceSessions.language,
        count: sql<number>`count(*)`
      })
      .from(voiceSessions)
      .groupBy(voiceSessions.language);
    
    const sessionsByLanguage: Record<string, number> = {};
    for (const row of langStats) {
      if (row.language) {
        sessionsByLanguage[row.language] = Number(row.count);
      }
    }
    
    // Sessions by day (last 30 days)
    const dailyStats = await db
      .select({
        date: sql<string>`date(${voiceSessions.startedAt})`,
        count: sql<number>`count(*)`,
        minutes: sql<number>`coalesce(sum(${voiceSessions.durationSeconds}), 0) / 60`
      })
      .from(voiceSessions)
      .where(gte(voiceSessions.startedAt, sql`now() - interval '30 days'`))
      .groupBy(sql`date(${voiceSessions.startedAt})`)
      .orderBy(sql`date(${voiceSessions.startedAt})`);
    
    const sessionsByDay = dailyStats.map(row => ({
      date: String(row.date),
      count: Number(row.count),
      minutes: Number(row.minutes)
    }));
    
    console.log(`[SYNC-BRIDGE] Exporting aggregate analytics: ${userCounts[0]?.total || 0} users, ${sessionStats[0]?.total || 0} sessions`);
    
    return {
      totalUsers: Number(userCounts[0]?.total || 0),
      totalBetaTesters: Number(userCounts[0]?.betaTesters || 0),
      totalVoiceSessions: Number(sessionStats[0]?.total || 0),
      totalVoiceMinutes: Number(sessionStats[0]?.totalMinutes || 0),
      totalCreditsConsumed: Number(creditStats[0]?.consumed || 0),
      totalCreditsEarned: Number(creditStats[0]?.earned || 0),
      sessionsByLanguage,
      sessionsByDay,
      averageSessionDuration: Number(sessionStats[0]?.avgDuration || 0),
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Export Daniela-authored content created in this environment
   * For prod→dev pull: exports content with syncStatus='local' and originEnvironment='production'
   * This allows Daniela to grow pedagogical content during teaching sessions
   */
  async exportProdContentGrowth(): Promise<{
    idioms: any[];
    nuances: any[];
    errorPatterns: any[];
    dialects: any[];
    bridges: any[];
    culturalTips: any[];
    exportedAt: string;
  }> {
    // Export entries created in this environment with local syncStatus
    // These are new entries that haven't been synced yet
    // v35: Include NULL origin_environment as valid for export (backwards compatibility)
    // Records without origin_environment tag are assumed to belong to current environment
    const [idioms, nuances, errorPatterns, dialects, bridges, tips] = await Promise.all([
      db.select().from(languageIdioms).where(
        and(
          eq(languageIdioms.syncStatus, 'local'),
          or(eq(languageIdioms.originEnvironment, CURRENT_ENVIRONMENT), isNull(languageIdioms.originEnvironment)),
          eq(languageIdioms.isActive, true)
        )
      ),
      db.select().from(culturalNuances).where(
        and(
          eq(culturalNuances.syncStatus, 'local'),
          or(eq(culturalNuances.originEnvironment, CURRENT_ENVIRONMENT), isNull(culturalNuances.originEnvironment)),
          eq(culturalNuances.isActive, true)
        )
      ),
      db.select().from(learnerErrorPatterns).where(
        and(
          eq(learnerErrorPatterns.syncStatus, 'local'),
          or(eq(learnerErrorPatterns.originEnvironment, CURRENT_ENVIRONMENT), isNull(learnerErrorPatterns.originEnvironment)),
          eq(learnerErrorPatterns.isActive, true)
        )
      ),
      db.select().from(dialectVariations).where(
        and(
          eq(dialectVariations.syncStatus, 'local'),
          or(eq(dialectVariations.originEnvironment, CURRENT_ENVIRONMENT), isNull(dialectVariations.originEnvironment)),
          eq(dialectVariations.isActive, true)
        )
      ),
      db.select().from(linguisticBridges).where(
        and(
          eq(linguisticBridges.syncStatus, 'local'),
          or(eq(linguisticBridges.originEnvironment, CURRENT_ENVIRONMENT), isNull(linguisticBridges.originEnvironment)),
          eq(linguisticBridges.isActive, true)
        )
      ),
      db.select().from(culturalTips),  // culturalTips doesn't have isActive column
    ]);
    
    console.log(`[SYNC-BRIDGE] Exporting prod-content-growth: ${idioms.length} idioms, ${nuances.length} nuances, ${errorPatterns.length} errors, ${dialects.length} dialects, ${bridges.length} bridges, ${tips.length} cultural tips`);
    
    return {
      idioms,
      nuances,
      errorPatterns,
      dialects,
      bridges,
      culturalTips: tips,
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Export recent production conversations for troubleshooting
   * Pulls conversations and messages from the last 7 days for debugging voice timing issues etc.
   * Only exports founder/beta tester conversations for privacy
   */
  async exportProdConversations(): Promise<{
    conversations: any[];
    messages: any[];
    exportedAt: string;
  }> {
    // Get beta tester user IDs for privacy (only export their conversations)
    // Include founder email as fallback to ensure we always have data for troubleshooting
    const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'davidwmcintosh@gmail.com';
    
    const allowedUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(or(
        eq(users.isBetaTester, true),
        eq(users.email, FOUNDER_EMAIL)
      ));
    
    if (allowedUsers.length === 0) {
      console.log('[SYNC-BRIDGE] No beta testers/founders found for prod-conversations export');
      return { conversations: [], messages: [], exportedAt: new Date().toISOString() };
    }
    
    const allowedUserIds = allowedUsers.map(u => u.id);
    console.log(`[SYNC-BRIDGE] Found ${allowedUsers.length} users for prod-conversations export`);
    
    // Get conversations from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Use explicit column selection for Drizzle compatibility
    // Note: Only selecting columns that exist in current schema
    const recentConversations = await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        language: conversations.language,
        learningContext: conversations.learningContext, // Maps to mode in older schemas
        topic: conversations.topic,
        actflLevel: conversations.actflLevel,
        title: conversations.title, // Maps to summary in older schemas
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(
        and(
          inArray(conversations.userId, allowedUserIds),
          gte(conversations.createdAt, sevenDaysAgo)
        )
      )
      .orderBy(desc(conversations.createdAt))
      .limit(50);  // Limit to 50 most recent conversations
    
    if (recentConversations.length === 0) {
      console.log('[SYNC-BRIDGE] No recent conversations found for prod-conversations export');
      return { conversations: [], messages: [], exportedAt: new Date().toISOString() };
    }
    
    const conversationIds = recentConversations.map(c => c.id);
    
    // Get all messages for these conversations with explicit column selection
    // Note: Only selecting columns that exist in current schema
    const conversationMessages = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        role: messages.role,
        content: messages.content,
        targetLanguageText: messages.targetLanguageText,
        performanceScore: messages.performanceScore,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(messages.createdAt);
    
    console.log(`[SYNC-BRIDGE] Exporting prod-conversations: ${recentConversations.length} conversations, ${conversationMessages.length} messages (last 7 days)`);
    
    return {
      conversations: recentConversations,
      messages: conversationMessages,
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Export Sofia's runtime faults and issue reports for cross-environment debugging
   * Production → Development sync so dev can diagnose production issues
   */
  async exportSofiaTelemetry(): Promise<{
    issueReports: any[];
    runtimeFaults: number;
    pendingCount: number;
    exportedAt: string;
  }> {
    // Get all issue reports from last 30 days that haven't been synced yet (or all for initial sync)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const issueReports = await db
      .select()
      .from(sofiaIssueReports)
      .where(gte(sofiaIssueReports.createdAt, thirtyDaysAgo))
      .orderBy(desc(sofiaIssueReports.createdAt));
    
    // Count runtime faults:
    // - Issues with 'runtime_fault:*' prefix (programmatic reports from Sofia)
    // - Issues with voice-related types: 'no_audio', 'connection', 'double_audio', 'latency'
    const voiceFaultTypes = ['no_audio', 'connection', 'double_audio', 'latency'];
    const runtimeFaults = issueReports.filter(r => 
      r.issueType?.startsWith('runtime_fault:') || voiceFaultTypes.includes(r.issueType)
    ).length;
    
    // Count pending issues (status = 'pending' or 'reviewed' but not resolved)
    const pendingCount = issueReports.filter(r => r.status === 'pending' || r.status === 'actionable').length;
    
    console.log(`[SYNC-BRIDGE] Exporting Sofia telemetry: ${issueReports.length} issue reports, ${runtimeFaults} runtime faults, ${pendingCount} pending (last 30 days)`);
    
    return {
      issueReports,
      runtimeFaults,
      pendingCount,
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Import Sofia telemetry from production for debugging
   * Merges production issue reports into development DB
   * Uses originId/originEnvironment pattern to track source
   */
  async importSofiaTelemetry(data: {
    issueReports: any[];
    runtimeFaults: number;
    pendingCount: number;
    exportedAt: string;
  }): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    
    if (!data.issueReports || data.issueReports.length === 0) {
      return { imported: 0, errors: [] };
    }
    
    for (const report of data.issueReports) {
      try {
        // Check if this report already exists (by originId from production)
        const existing = await db
          .select({ id: sofiaIssueReports.id })
          .from(sofiaIssueReports)
          .where(eq(sofiaIssueReports.originId, report.id))
          .limit(1);
        
        if (existing.length > 0) {
          // Update existing synced record
          await db
            .update(sofiaIssueReports)
            .set({
              sofiaAnalysis: report.sofiaAnalysis,
              status: report.status,
              founderNotes: report.founderNotes,
              reviewedAt: report.reviewedAt ? new Date(report.reviewedAt) : null,
              syncStatus: 'synced',
            })
            .where(eq(sofiaIssueReports.id, existing[0].id));
          imported++;
        } else {
          // Insert new record with origin tracking
          await db
            .insert(sofiaIssueReports)
            .values({
              userId: report.userId,
              ticketId: report.ticketId,
              issueType: report.issueType,
              userDescription: report.userDescription,
              sofiaAnalysis: report.sofiaAnalysis,
              diagnosticSnapshot: report.diagnosticSnapshot,
              clientTelemetry: report.clientTelemetry,
              deviceInfo: report.deviceInfo,
              status: report.status,
              founderNotes: report.founderNotes,
              reviewedAt: report.reviewedAt ? new Date(report.reviewedAt) : null,
              environment: 'production', // Mark as from production
              syncStatus: 'synced',
              originId: report.id, // Original ID from production
              originEnvironment: report.environment || 'production',
              createdAt: report.createdAt ? new Date(report.createdAt) : new Date(),
            });
          imported++;
        }
      } catch (err: any) {
        errors.push(`Sofia issue ${report.id}: ${err.message}`);
      }
    }
    
    console.log(`[SYNC-BRIDGE] Imported ${imported} Sofia issue reports from production`);
    return { imported, errors };
  }
  
  /**
   * Export founder's conversations for dev→prod sync
   * Enables Daniela in production to have access to dev conversation history
   * for continuity and restarting previous conversations
   */
  async exportFounderConversations(): Promise<{
    conversations: any[];
    messages: any[];
    exportedAt: string;
  }> {
    // Get founder user ID
    const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'davidwmcintosh@gmail.com';
    
    const founderUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, FOUNDER_EMAIL))
      .limit(1);
    
    if (founderUser.length === 0) {
      console.log('[SYNC-BRIDGE] Founder not found for founder-conversations export');
      return { conversations: [], messages: [], exportedAt: new Date().toISOString() };
    }
    
    const founderId = founderUser[0].id;
    
    // Get all founder conversations (no time limit - full history for Daniela continuity)
    // Note: Only selecting columns that exist in current schema
    const founderConversations = await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        language: conversations.language,
        learningContext: conversations.learningContext, // Maps to mode in older schemas
        topic: conversations.topic,
        actflLevel: conversations.actflLevel,
        title: conversations.title, // Maps to summary in older schemas
        messageCount: conversations.messageCount,
        duration: conversations.duration, // Maps to durationSeconds in older schemas
        classId: conversations.classId,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(eq(conversations.userId, founderId))
      .orderBy(desc(conversations.createdAt))
      .limit(200);  // Limit to 200 most recent conversations for manageable sync
    
    if (founderConversations.length === 0) {
      console.log('[SYNC-BRIDGE] No founder conversations found for export');
      return { conversations: [], messages: [], exportedAt: new Date().toISOString() };
    }
    
    const conversationIds = founderConversations.map(c => c.id);
    
    // Get all messages for these conversations
    // Note: Only selecting columns that exist in current schema
    const founderMessages = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        role: messages.role,
        content: messages.content,
        targetLanguageText: messages.targetLanguageText,
        performanceScore: messages.performanceScore,
        actflLevel: messages.actflLevel,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(messages.createdAt);
    
    console.log(`[SYNC-BRIDGE] Exporting founder-conversations: ${founderConversations.length} conversations, ${founderMessages.length} messages`);
    
    return {
      conversations: founderConversations,
      messages: founderMessages,
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Import Daniela-authored content from production
   * Merges content into dev database with 'pending_review' status
   */
  async importProdContentGrowth(data: {
    idioms: any[];
    nuances: any[];
    errorPatterns: any[];
    dialects: any[];
    bridges: any[];
    culturalTips: any[];
  }): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    
    // Import idioms (upsert by originId or natural key)
    for (const idiom of data.idioms || []) {
      try {
        const originId = idiom.id; // Use source ID as originId
        const existing = await db.select().from(languageIdioms)
          .where(or(
            eq(languageIdioms.originId, originId),
            and(eq(languageIdioms.language, idiom.language), eq(languageIdioms.idiom, idiom.idiom))
          ))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(languageIdioms).values({
            ...idiom,
            id: undefined, // Generate new ID
            originId,
            originEnvironment: idiom.originEnvironment || 'production',
            syncStatus: 'pending_review', // Needs founder review
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`Idiom "${idiom.idiom}": ${err.message}`);
      }
    }
    
    // Import cultural nuances
    for (const nuance of data.nuances || []) {
      try {
        const originId = nuance.id;
        const existing = await db.select().from(culturalNuances)
          .where(or(
            eq(culturalNuances.originId, originId),
            and(
              eq(culturalNuances.language, nuance.language),
              eq(culturalNuances.category, nuance.category),
              eq(culturalNuances.situation, nuance.situation)
            )
          ))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(culturalNuances).values({
            ...nuance,
            id: undefined,
            originId,
            originEnvironment: nuance.originEnvironment || 'production',
            syncStatus: 'pending_review',
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`Nuance "${nuance.situation}": ${err.message}`);
      }
    }
    
    // Import error patterns
    for (const pattern of data.errorPatterns || []) {
      try {
        const originId = pattern.id;
        const existing = await db.select().from(learnerErrorPatterns)
          .where(or(
            eq(learnerErrorPatterns.originId, originId),
            and(
              eq(learnerErrorPatterns.targetLanguage, pattern.targetLanguage),
              eq(learnerErrorPatterns.specificError, pattern.specificError)
            )
          ))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(learnerErrorPatterns).values({
            ...pattern,
            id: undefined,
            originId,
            originEnvironment: pattern.originEnvironment || 'production',
            syncStatus: 'pending_review',
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`Error pattern "${pattern.specificError}": ${err.message}`);
      }
    }
    
    // Import dialect variations
    for (const dialect of data.dialects || []) {
      try {
        const originId = dialect.id;
        const existing = await db.select().from(dialectVariations)
          .where(or(
            eq(dialectVariations.originId, originId),
            and(
              eq(dialectVariations.language, dialect.language),
              eq(dialectVariations.region, dialect.region),
              eq(dialectVariations.standardForm, dialect.standardForm)
            )
          ))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(dialectVariations).values({
            ...dialect,
            id: undefined,
            originId,
            originEnvironment: dialect.originEnvironment || 'production',
            syncStatus: 'pending_review',
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`Dialect "${dialect.standardForm}": ${err.message}`);
      }
    }
    
    // Import linguistic bridges
    for (const bridge of data.bridges || []) {
      try {
        const originId = bridge.id;
        const existing = await db.select().from(linguisticBridges)
          .where(or(
            eq(linguisticBridges.originId, originId),
            and(
              eq(linguisticBridges.sourceLanguage, bridge.sourceLanguage),
              eq(linguisticBridges.targetLanguage, bridge.targetLanguage),
              eq(linguisticBridges.sourceWord, bridge.sourceWord),
              eq(linguisticBridges.targetWord, bridge.targetWord)
            )
          ))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(linguisticBridges).values({
            ...bridge,
            id: undefined,
            originId,
            originEnvironment: bridge.originEnvironment || 'production',
            syncStatus: 'pending_review',
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`Bridge "${bridge.sourceWord}->${bridge.targetWord}": ${err.message}`);
      }
    }
    
    // Import cultural tips (simpler - just upsert by title/language)
    for (const tip of data.culturalTips || []) {
      try {
        const existing = await db.select().from(culturalTips)
          .where(and(
            eq(culturalTips.language, tip.language),
            eq(culturalTips.title, tip.title)
          ))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(culturalTips).values({
            ...tip,
            id: undefined,
            isActive: true,
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`Cultural tip "${tip.title}": ${err.message}`);
      }
    }
    
    console.log(`[SYNC-BRIDGE] Imported ${imported} prod-content-growth items, ${errors.length} errors`);
    return { imported, errors };
  }
  
  /**
   * Export founder's personal facts for bidirectional sync
   * Ensures same Daniela knowledge in dev and prod for founder
   */
  async exportFounderContext(): Promise<{
    personalFacts: any[];
    exportedAt: string;
  }> {
    const FOUNDER_ID = '49847136';
    
    const facts = await db
      .select()
      .from(learnerPersonalFacts)
      .where(
        and(
          eq(learnerPersonalFacts.studentId, FOUNDER_ID),
          eq(learnerPersonalFacts.isActive, true)
        )
      )
      .orderBy(desc(learnerPersonalFacts.updatedAt));
    
    console.log(`[SYNC-BRIDGE] Exporting founder-context: ${facts.length} personal facts`);
    
    return {
      personalFacts: facts,
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Import founder's personal facts (bidirectional sync)
   * Merges facts using upsert - newer timestamps win
   */
  async importFounderContext(data: {
    personalFacts: any[];
  }): Promise<{ imported: number; updated: number; errors: string[] }> {
    const FOUNDER_ID = '49847136';
    let imported = 0;
    let updated = 0;
    const errors: string[] = [];
    
    for (const fact of data.personalFacts || []) {
      try {
        // Ensure we're only importing founder's facts
        if (fact.studentId !== FOUNDER_ID) {
          continue;
        }
        
        // Check for existing by ID or by natural key (studentId + factType + fact)
        const existing = await db
          .select()
          .from(learnerPersonalFacts)
          .where(
            or(
              eq(learnerPersonalFacts.id, fact.id),
              and(
                eq(learnerPersonalFacts.studentId, FOUNDER_ID),
                eq(learnerPersonalFacts.factType, fact.factType),
                eq(learnerPersonalFacts.fact, fact.fact)
              )
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          // Update if source is newer
          const sourceUpdated = new Date(fact.updatedAt || fact.createdAt);
          const localUpdated = new Date(existing[0].updatedAt || existing[0].createdAt);
          
          if (sourceUpdated > localUpdated) {
            await db
              .update(learnerPersonalFacts)
              .set({
                fact: fact.fact,
                context: fact.context,
                relevantDate: fact.relevantDate ? new Date(fact.relevantDate) : null,
                confidenceScore: fact.confidenceScore,
                lastMentionedAt: fact.lastMentionedAt ? new Date(fact.lastMentionedAt) : new Date(),
                mentionCount: Math.max(Number(existing[0].mentionCount) || 1, Number(fact.mentionCount) || 1),
                isActive: fact.isActive ?? true,
                updatedAt: new Date(),
              })
              .where(eq(learnerPersonalFacts.id, existing[0].id));
            updated++;
          }
        } else {
          // Insert new fact
          await db.insert(learnerPersonalFacts).values({
            id: fact.id, // Preserve original ID for consistency
            studentId: FOUNDER_ID,
            language: fact.language,
            factType: fact.factType,
            fact: fact.fact,
            context: fact.context,
            relevantDate: fact.relevantDate ? new Date(fact.relevantDate) : null,
            confidenceScore: fact.confidenceScore || 0.8,
            sourceConversationId: null, // Don't try to FK across environments
            isActive: fact.isActive ?? true,
            lastMentionedAt: fact.lastMentionedAt ? new Date(fact.lastMentionedAt) : new Date(),
            mentionCount: fact.mentionCount || 1,
            createdAt: fact.createdAt ? new Date(fact.createdAt) : new Date(),
            updatedAt: new Date(),
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`Personal fact "${fact.factType}": ${err.message}`);
      }
    }
    
    console.log(`[SYNC-BRIDGE] Imported ${imported} new, updated ${updated} existing founder personal facts, ${errors.length} errors`);
    return { imported, updated, errors };
  }
  
  /**
   * Import founder conversations for Daniela continuity (dev → prod)
   * Uses upsert logic to merge conversations and messages
   * Preserves original IDs for cross-environment reference
   */
  async importFounderConversations(data: {
    conversations: any[];
    messages: any[];
  }): Promise<{ conversations: number; messages: number; errors: string[] }> {
    let conversationsImported = 0;
    let messagesImported = 0;
    const errors: string[] = [];
    
    // Track valid conversation IDs (both imported and pre-existing)
    const validConversationIds = new Set<string>();
    
    // Get founder user in this environment
    const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'davidwmcintosh@gmail.com';
    const founderUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, FOUNDER_EMAIL))
      .limit(1);
    
    if (founderUser.length === 0) {
      errors.push('Founder user not found in target environment');
      return { conversations: 0, messages: 0, errors };
    }
    
    const founderId = founderUser[0].id;
    
    // Import conversations (upsert by id)
    // Note: Using columns that exist in current schema
    for (const conv of data.conversations || []) {
      try {
        const existing = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, conv.id))
          .limit(1);
        
        if (existing.length === 0) {
          // Insert new conversation, mapping userId to local founder
          await db.insert(conversations).values({
            id: conv.id, // Preserve original ID for cross-environment FK satisfaction
            userId: founderId, // Map to local founder
            language: conv.language,
            nativeLanguage: conv.nativeLanguage || 'english',
            difficulty: conv.difficulty || 'beginner',
            learningContext: conv.learningContext || conv.mode || 'self_directed',
            topic: conv.topic,
            title: conv.title || conv.summary, // Map summary to title
            actflLevel: conv.actflLevel,
            messageCount: conv.messageCount || 0,
            duration: conv.duration || conv.durationSeconds || 0,
            classId: null, // Null out classId to avoid FK errors
            createdAt: conv.createdAt ? new Date(conv.createdAt) : new Date(),
          });
          validConversationIds.add(conv.id);
          conversationsImported++;
        } else {
          // Conversation already exists - it's valid for message import
          validConversationIds.add(conv.id);
          // Update title if available
          if (conv.title || conv.summary) {
            await db
              .update(conversations)
              .set({
                title: conv.title || conv.summary,
                messageCount: conv.messageCount || 0,
              })
              .where(eq(conversations.id, existing[0].id));
          }
        }
      } catch (err: any) {
        // Don't add to validConversationIds if insert failed
        errors.push(`Conversation ${conv.id}: ${err.message}`);
      }
    }
    
    console.log(`[SYNC-BRIDGE] ${validConversationIds.size} valid conversation IDs for message import`);
    
    // Import messages only for valid conversations (prevents FK errors)
    let skippedOrphanMessages = 0;
    for (const msg of data.messages || []) {
      // Skip messages for conversations that don't exist
      if (!validConversationIds.has(msg.conversationId)) {
        skippedOrphanMessages++;
        continue;
      }
      
      try {
        const existing = await db
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.id, msg.id))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(messages).values({
            id: msg.id, // Preserve original ID
            conversationId: msg.conversationId,
            role: msg.role,
            content: msg.content,
            targetLanguageText: msg.targetLanguageText,
            performanceScore: msg.performanceScore || msg.pronunciationScore,
            actflLevel: msg.actflLevel,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          });
          messagesImported++;
        }
      } catch (err: any) {
        // Silently skip duplicate key errors (already exists)
        if (!err.message?.includes('duplicate key')) {
          errors.push(`Message ${msg.id}: ${err.message}`);
        }
      }
    }
    
    console.log(`[SYNC-BRIDGE] Imported ${conversationsImported} conversations, ${messagesImported} messages for founder continuity (${skippedOrphanMessages} orphan messages skipped, ${errors.length} errors)`);
    return { conversations: conversationsImported, messages: messagesImported, errors };
  }
  
  /**
   * Import Beta Tester Usage Data (from prod)
   * Merges usage data into dev database for analysis
   * v24: Imports conversations FIRST, then voice sessions to satisfy foreign keys
   * - Usage ledger: still skips classId and voiceSessionId (too complex to resolve)
   */
  async importBetaUsage(data: { 
    voiceSessions: any[]; 
    usageLedger: any[]; 
    costSummaries: any[];
    conversations?: any[]; // v24: Parent records for voice sessions
  }): Promise<{ sessionsImported: number; ledgerImported: number; costSummariesImported: number; conversationsImported: number; errors: string[] }> {
    let sessionsImported = 0;
    let ledgerImported = 0;
    let costSummariesImported = 0;
    let conversationsImported = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 100;
    
    // v24: First import conversations (required for voice session foreign keys)
    const convos = data.conversations || [];
    for (const conv of convos) {
      try {
        // Check if conversation already exists
        const existing = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, conv.id))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(conversations).values({
            id: conv.id,
            userId: conv.userId,
            language: conv.language,
            nativeLanguage: conv.nativeLanguage || 'english',
            difficulty: conv.difficulty || 'beginner',
            topic: conv.topic,
            title: conv.title,
            messageCount: conv.messageCount || 0,
            duration: conv.duration || 0,
            actflLevel: conv.actflLevel,
            classId: null, // v24: Null out classId to avoid FK errors (classes not synced)
            learningContext: conv.learningContext || 'self_directed',
            createdAt: conv.createdAt ? new Date(conv.createdAt) : new Date(),
          });
          conversationsImported++;
        }
      } catch (convErr: any) {
        // Skip on error - may be FK issue with classId
        if (!convErr.message?.includes('duplicate key')) {
          errors.push(`Conversation ${conv.id}: ${convErr.message}`);
        }
      }
    }
    
    console.log(`[SYNC-BRIDGE] Imported ${conversationsImported} conversations for voice sessions`);
    
    // Now import voice sessions (conversations should exist now)
    const sessions = data.voiceSessions || [];
    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE);
      try {
        const values = batch.map(session => ({
          id: session.id,
          userId: session.userId,
          conversationId: session.conversationId,
          startedAt: session.startedAt ? new Date(session.startedAt) : new Date(),
          endedAt: session.endedAt ? new Date(session.endedAt) : null,
          durationSeconds: session.durationSeconds || 0,
          exchangeCount: session.exchangeCount || 0,
          studentSpeakingSeconds: session.studentSpeakingSeconds || 0,
          tutorSpeakingSeconds: session.tutorSpeakingSeconds || 0,
          language: session.language,
          status: session.status || 'completed',
        }));
        
        await db
          .insert(voiceSessions)
          .values(values)
          .onConflictDoUpdate({
            target: voiceSessions.id,
            set: {
              endedAt: sql`EXCLUDED.ended_at`,
              durationSeconds: sql`EXCLUDED.duration_seconds`,
              exchangeCount: sql`EXCLUDED.exchange_count`,
              status: sql`EXCLUDED.status`,
            }
          });
        sessionsImported += batch.length;
      } catch (err: any) {
        errors.push(`Voice sessions batch ${Math.floor(i/BATCH_SIZE)}: ${err.message}`);
        // Fallback to individual inserts for this batch
        for (const session of batch) {
          try {
            await db.insert(voiceSessions).values({
              id: session.id,
              userId: session.userId,
              conversationId: session.conversationId,
              startedAt: session.startedAt ? new Date(session.startedAt) : new Date(),
              endedAt: session.endedAt ? new Date(session.endedAt) : null,
              durationSeconds: session.durationSeconds || 0,
              exchangeCount: session.exchangeCount || 0,
              studentSpeakingSeconds: session.studentSpeakingSeconds || 0,
              tutorSpeakingSeconds: session.tutorSpeakingSeconds || 0,
              language: session.language,
              status: session.status || 'completed',
            }).onConflictDoNothing();
            sessionsImported++;
          } catch (e: any) {
            // Skip individual errors silently
          }
        }
      }
    }
    
    // Batch import usage ledger entries
    // Skip classId and voiceSessionId to avoid FK violations (too complex to resolve)
    const ledgerEntries = data.usageLedger || [];
    for (let i = 0; i < ledgerEntries.length; i += BATCH_SIZE) {
      const batch = ledgerEntries.slice(i, i + BATCH_SIZE);
      try {
        const values = batch.map(entry => ({
          id: entry.id,
          userId: entry.userId,
          creditSeconds: entry.creditSeconds,
          entitlementType: entry.entitlementType,
          description: entry.description,
          // Skip foreign keys that may not exist in target environment
          classId: null,
          voiceSessionId: null,
          stripePaymentId: entry.stripePaymentId,
          expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
          createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
        }));
        
        await db
          .insert(usageLedger)
          .values(values)
          .onConflictDoNothing();
        ledgerImported += batch.length;
      } catch (err: any) {
        errors.push(`Ledger batch ${Math.floor(i/BATCH_SIZE)}: ${err.message}`);
        // Fallback to individual inserts
        for (const entry of batch) {
          try {
            await db.insert(usageLedger).values({
              id: entry.id,
              userId: entry.userId,
              creditSeconds: entry.creditSeconds,
              entitlementType: entry.entitlementType,
              description: entry.description,
              classId: null,
              voiceSessionId: null,
              stripePaymentId: entry.stripePaymentId,
              expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
              createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
            }).onConflictDoNothing();
            ledgerImported++;
          } catch (e: any) {
            // Skip duplicates silently
          }
        }
      }
    }
    
    // Cost summaries (already just counting, no actual import)
    costSummariesImported = (data.costSummaries || []).length;
    
    console.log(`[SYNC-BRIDGE] Imported beta usage: ${conversationsImported} convos, ${sessionsImported} sessions, ${ledgerImported} ledger, ${costSummariesImported} cost summaries`);
    return { sessionsImported, ledgerImported, costSummariesImported, conversationsImported, errors };
  }
  
  /**
   * Import a single tutor voice with upsert logic
   */
  async importTutorVoice(voice: any): Promise<{ success: boolean }> {
    try {
      // Upsert by id - if voice exists, update it; otherwise insert
      await db
        .insert(tutorVoices)
        .values({
          id: voice.id,
          language: voice.language,
          gender: voice.gender,
          role: voice.role || 'tutor',
          provider: voice.provider || 'cartesia',
          voiceId: voice.voiceId,
          voiceName: voice.voiceName,
          languageCode: voice.languageCode,
          speakingRate: voice.speakingRate ?? 0.9,
          personality: voice.personality || 'warm',
          expressiveness: voice.expressiveness ?? 3,
          emotion: voice.emotion || 'friendly',
          isActive: voice.isActive ?? true,
        })
        .onConflictDoUpdate({
          target: tutorVoices.id,
          set: {
            language: voice.language,
            gender: voice.gender,
            role: voice.role || 'tutor',
            provider: voice.provider || 'cartesia',
            voiceId: voice.voiceId,
            voiceName: voice.voiceName,
            languageCode: voice.languageCode,
            speakingRate: voice.speakingRate ?? 0.9,
            personality: voice.personality || 'warm',
            expressiveness: voice.expressiveness ?? 3,
            emotion: voice.emotion || 'friendly',
            isActive: voice.isActive ?? true,
            updatedAt: new Date(),
          },
        });
      
      return { success: true };
    } catch (err: any) {
      console.error(`[SYNC-BRIDGE] Failed to import tutor voice ${voice.id}:`, err.message);
      return { success: false };
    }
  }
  
  /**
   * v33: Import a public catalogue class with upsert logic
   * These are official HolaHola syllabi synced from dev to prod
   */
  async importCatalogueClass(cls: any): Promise<{ success: boolean }> {
    try {
      // Check if class already exists
      const existing = await db.select({ id: teacherClasses.id, name: teacherClasses.name })
        .from(teacherClasses)
        .where(eq(teacherClasses.id, cls.id))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing class
        console.log(`[SYNC-BRIDGE] Updating catalogue class: ${cls.id} (${cls.name}) - was: ${existing[0].name}`);
        await db.update(teacherClasses)
          .set({
            teacherId: cls.teacherId,
            name: cls.name,
            description: cls.description,
            language: cls.language,
            classLevel: cls.classLevel ?? cls.difficultyLevel ?? 1,
            curriculumPathId: cls.curriculumPathId ?? cls.curriculumTemplateId,
            isActive: cls.isActive ?? true,
            isPublicCatalogue: true,
            classTypeId: cls.classTypeId,
            isFeatured: cls.isFeatured ?? false,
            featuredOrder: cls.featuredOrder,
            tutorFreedomLevel: cls.tutorFreedomLevel,
            expectedActflMin: cls.expectedActflMin,
            targetActflLevel: cls.targetActflLevel,
            updatedAt: new Date(),
          })
          .where(eq(teacherClasses.id, cls.id));
      } else {
        console.log(`[SYNC-BRIDGE] Inserting new catalogue class: ${cls.id} (${cls.name})`);
        // Insert new class with explicit ID using raw SQL
        await db.execute(sql`
          INSERT INTO teacher_classes (id, teacher_id, name, description, language, class_level,
            curriculum_path_id, join_code, is_active, is_public_catalogue, class_type_id,
            is_featured, featured_order, tutor_freedom_level, expected_actfl_min, target_actfl_level,
            created_at, updated_at)
          VALUES (
            ${cls.id},
            ${cls.teacherId},
            ${cls.name},
            ${cls.description || null},
            ${cls.language},
            ${cls.classLevel ?? cls.difficultyLevel ?? 1},
            ${cls.curriculumPathId ?? cls.curriculumTemplateId ?? null},
            ${cls.joinCode || `CAT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`},
            ${cls.isActive ?? true},
            true,
            ${cls.classTypeId || null},
            ${cls.isFeatured ?? false},
            ${cls.featuredOrder ?? null},
            ${cls.tutorFreedomLevel || 'flexible_goals'},
            ${cls.expectedActflMin || null},
            ${cls.targetActflLevel || null},
            ${cls.createdAt ? new Date(cls.createdAt) : new Date()},
            NOW()
          )
        `);
      }
      
      return { success: true };
    } catch (err: any) {
      console.error(`[SYNC-BRIDGE] Failed to import catalogue class ${cls.id}:`, err.message);
      return { success: false };
    }
  }
  
  async applyImportBundle(bundle: SyncBundle): Promise<SyncResult> {
    const startTime = Date.now();
    const counts: Record<string, number> = {};
    const errors: string[] = [];
    
    // Soft-fail handling: Detect and log unknown bundle keys
    // This enables graceful handling when peer sends data types we don't recognize
    const knownBundleKeys = new Set([
      'generatedAt', 'sourceEnvironment', 'codeVersion', 'capabilities', 'checksum',
      'bestPractices', 'idioms', 'nuances', 'errorPatterns', 'dialects', 'bridges',
      'tools', 'procedures', 'principles', 'patterns', 'subtletyCues', 'emotionalPatterns',
      'creativityTemplates', 'suggestions', 'triggers', 'actions', 'observations', 'alerts',
      'observationsPagination', 'northStarPrinciples', 'northStarUnderstanding', 'northStarExamples',
      'founderUser', 'expressLaneSessions', 'expressLaneMessages', 'hiveSnapshots',
      'danielaGrowthMemories', 'tutorVoices', 'catalogueClasses',
      // v18: New sync batches
      'curriculumPaths', 'curriculumUnits', 'curriculumLessons', 'topics',
      'curriculumDrillItems', 'grammarExercises', 'grammarCompetencies', 'canDoStatements', 'culturalTips', 
      'lessonCanDoStatements', 'lessonCulturalTips', 'lessonVisualAids', 'culturalTipMedia',
      'classHourPackages',
      'wrenInsights', 'wrenProactiveTriggers', 'architecturalDecisionRecords',
      'wrenMistakes', 'wrenLessons', 'wrenCommitments',
      'danielaRecommendations', 'danielaFeatureFeedback',
      'betaTesters', 'betaTesterCredits', 'betaTesterEnrollments', 'betaTesterClasses',
      // v19: Prod → dev pull batches
      'betaUsage', 'aggregateAnalytics',
      // v20: Sofia telemetry for cross-env debugging
      'sofiaTelemetry',
      // v21: Alternate field names for TriLane observations (prod→dev compatibility)
      'agentObservations', 'supportObservations', 'systemAlerts', 'pagination',
      'exportedAt', 'environment', 'understanding', 'examples',
      // v22: Founder context and content growth (bidirectional sync)
      'prodContentGrowth', 'founderContext', 'founderConversations', 'prodConversations',
      // v24: Extended Wren and Daniela intelligence tables
      'wrenMistakeResolutions', 'wrenSessionNotes', 'wrenPredictions',
      'wrenConfidenceRecords', 'wrenCalibrationStats',
      'danielaBeacons', 'synthesizedInsights',
    ]);
    
    const bundleKeys = Object.keys(bundle);
    const unknownKeys = bundleKeys.filter(k => !knownBundleKeys.has(k));
    
    if (unknownKeys.length > 0) {
      const peerVersion = bundle.codeVersion || 'unknown';
      console.warn(`[SYNC-BRIDGE SOFT-FAIL] Received ${unknownKeys.length} unknown data types from peer (version: ${peerVersion}): ${unknownKeys.join(', ')}`);
      console.warn(`[SYNC-BRIDGE SOFT-FAIL] These will be skipped. Update local code to handle new types.`);
      counts['_unknownKeysSkipped'] = unknownKeys.length;
    }
    
    // Log version mismatch for visibility
    if (bundle.codeVersion && bundle.codeVersion !== SYNC_BRIDGE_CODE_VERSION) {
      console.log(`[SYNC-BRIDGE] Version mismatch: local=${SYNC_BRIDGE_CODE_VERSION}, peer=${bundle.codeVersion}`);
    }
    
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
    
    // v21: Handle alternate field names from production (TriLane observations)
    // These use slightly different naming conventions
    const bundleAny = bundle as any;
    await importWithCount('agentObservations', bundleAny.agentObservations, 
      (o) => neuralNetworkSync.importAgentObservation(o));
    await importWithCount('supportObservations', bundleAny.supportObservations, 
      (o) => neuralNetworkSync.importSupportObservation(o));
    await importWithCount('systemAlerts', bundleAny.systemAlerts, 
      (a) => neuralNetworkSync.importSystemAlert(a));
    
    // Handle alternate North Star field names from production
    if (bundleAny.understanding?.length) {
      for (const understanding of bundleAny.understanding) {
        try {
          const result = await neuralNetworkSync.importNorthStarUnderstanding(understanding, 'sync-bridge', undefined);
          if (result?.success) {
            counts['understanding'] = (counts['understanding'] || 0) + 1;
          }
        } catch (err: any) {
          errors.push(`understanding: ${err.message}`);
        }
      }
    }
    if (bundleAny.examples?.length) {
      for (const example of bundleAny.examples) {
        try {
          const result = await neuralNetworkSync.importNorthStarExample(example, 'sync-bridge', undefined);
          if (result?.success) {
            counts['examples'] = (counts['examples'] || 0) + 1;
          }
        } catch (err: any) {
          errors.push(`examples: ${err.message}`);
        }
      }
    }
    
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
    
    // Product Configuration: Tutor Voices (includes both main tutors and assistants)
    if (bundle.tutorVoices?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.tutorVoices.length} Tutor Voices...`);
      await importWithCount('tutorVoices', bundle.tutorVoices,
        (voice) => this.importTutorVoice(voice));
    }
    
    // v33: Product Configuration: Public Catalogue Classes
    if (bundle.catalogueClasses?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.catalogueClasses.length} Catalogue Classes...`);
      await importWithCount('catalogueClasses', bundle.catalogueClasses,
        (cls) => this.importCatalogueClass(cls));
    }
    
    // v18: Curriculum Core (paths, units, lessons, topics)
    if (bundle.curriculumPaths?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.curriculumPaths.length} Curriculum Paths...`);
      await importWithCount('curriculumPaths', bundle.curriculumPaths,
        (path) => this.importCurriculumPath(path));
    }
    if (bundle.curriculumUnits?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.curriculumUnits.length} Curriculum Units...`);
      await importWithCount('curriculumUnits', bundle.curriculumUnits,
        (unit) => this.importCurriculumUnit(unit));
    }
    if (bundle.curriculumLessons?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.curriculumLessons.length} Curriculum Lessons...`);
      await importWithCount('curriculumLessons', bundle.curriculumLessons,
        (lesson) => this.importCurriculumLesson(lesson));
    }
    if (bundle.topics?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.topics.length} Topics...`);
      await importWithCount('topics', bundle.topics,
        (topic) => this.importTopic(topic));
    }
    
    // v18: Curriculum Drills (drill items, grammar, can-do, cultural tips)
    if (bundle.curriculumDrillItems?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.curriculumDrillItems.length} Drill Items...`);
      await importWithCount('curriculumDrillItems', bundle.curriculumDrillItems,
        (drill) => this.importCurriculumDrillItem(drill));
    }
    if (bundle.grammarExercises?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.grammarExercises.length} Grammar Exercises...`);
      await importWithCount('grammarExercises', bundle.grammarExercises,
        (grammar) => this.importGrammarExercise(grammar));
    }
    // v33: Grammar competencies (skill definitions per language)
    if (bundle.grammarCompetencies?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.grammarCompetencies.length} Grammar Competencies...`);
      await importWithCount('grammarCompetencies', bundle.grammarCompetencies,
        (comp) => this.importGrammarCompetency(comp));
    }
    if (bundle.canDoStatements?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.canDoStatements.length} Can-Do Statements...`);
      await importWithCount('canDoStatements', bundle.canDoStatements,
        (canDo) => this.importCanDoStatement(canDo));
    }
    if (bundle.culturalTips?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.culturalTips.length} Cultural Tips...`);
      await importWithCount('culturalTips', bundle.culturalTips,
        (tip) => this.importCulturalTip(tip));
    }
    
    // v33: Lesson-to-CanDo links (fluency wiring) - must import AFTER canDoStatements and lessons
    if (bundle.lessonCanDoStatements?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.lessonCanDoStatements.length} Lesson Can-Do Links...`);
      await importWithCount('lessonCanDoStatements', bundle.lessonCanDoStatements,
        (link) => this.importLessonCanDoStatement(link));
    }
    // v33: Lesson-level cultural tips (FK: lessonId, culturalTipId)
    if (bundle.lessonCulturalTips?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.lessonCulturalTips.length} Lesson Cultural Tips...`);
      await importWithCount('lessonCulturalTips', bundle.lessonCulturalTips,
        (link) => this.importLessonCulturalTip(link));
    }
    // v33: Lesson visual aids (FK: lessonId)
    if (bundle.lessonVisualAids?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.lessonVisualAids.length} Lesson Visual Aids...`);
      await importWithCount('lessonVisualAids', bundle.lessonVisualAids,
        (aid) => this.importLessonVisualAid(aid));
    }
    // v33: Cultural tip media (FK: culturalTipId)
    if (bundle.culturalTipMedia?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.culturalTipMedia.length} Cultural Tip Media...`);
      await importWithCount('culturalTipMedia', bundle.culturalTipMedia,
        (media) => this.importCulturalTipMedia(media));
    }
    // v33: Class hour packages (pricing)
    if (bundle.classHourPackages?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.classHourPackages.length} Class Hour Packages...`);
      await importWithCount('classHourPackages', bundle.classHourPackages,
        (pkg) => this.importClassHourPackage(pkg));
    }
    
    // v18: Wren Intelligence
    if (bundle.wrenInsights?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenInsights.length} Wren Insights...`);
      await importWithCount('wrenInsights', bundle.wrenInsights,
        (insight) => this.importWrenInsight(insight));
    }
    if (bundle.wrenProactiveTriggers?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenProactiveTriggers.length} Wren Proactive Triggers...`);
      await importWithCount('wrenProactiveTriggers', bundle.wrenProactiveTriggers,
        (trigger) => this.importWrenProactiveTrigger(trigger));
    }
    if (bundle.architecturalDecisionRecords?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.architecturalDecisionRecords.length} ADRs...`);
      await importWithCount('architecturalDecisionRecords', bundle.architecturalDecisionRecords,
        (adr) => this.importArchitecturalDecisionRecord(adr));
    }
    if (bundle.wrenMistakes?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenMistakes.length} Wren Mistakes...`);
      await importWithCount('wrenMistakes', bundle.wrenMistakes,
        (mistake) => this.importWrenMistake(mistake));
    }
    if (bundle.wrenLessons?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenLessons.length} Wren Lessons...`);
      await importWithCount('wrenLessons', bundle.wrenLessons,
        (lesson) => this.importWrenLesson(lesson));
    }
    if (bundle.wrenCommitments?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenCommitments.length} Wren Commitments...`);
      await importWithCount('wrenCommitments', bundle.wrenCommitments,
        (commitment) => this.importWrenCommitment(commitment));
    }
    // Extended Wren tables (v24+)
    if (bundle.wrenMistakeResolutions?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenMistakeResolutions.length} Wren Mistake Resolutions...`);
      await importWithCount('wrenMistakeResolutions', bundle.wrenMistakeResolutions,
        (resolution) => this.importWrenMistakeResolution(resolution));
    }
    if (bundle.wrenSessionNotes?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenSessionNotes.length} Wren Session Notes...`);
      await importWithCount('wrenSessionNotes', bundle.wrenSessionNotes,
        (note) => this.importWrenSessionNote(note));
    }
    if (bundle.wrenPredictions?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenPredictions.length} Wren Predictions...`);
      await importWithCount('wrenPredictions', bundle.wrenPredictions,
        (prediction) => this.importWrenPrediction(prediction));
    }
    if (bundle.wrenConfidenceRecords?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenConfidenceRecords.length} Wren Confidence Records...`);
      await importWithCount('wrenConfidenceRecords', bundle.wrenConfidenceRecords,
        (record) => this.importWrenConfidenceRecord(record));
    }
    if (bundle.wrenCalibrationStats?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.wrenCalibrationStats.length} Wren Calibration Stats...`);
      await importWithCount('wrenCalibrationStats', bundle.wrenCalibrationStats,
        (stat) => this.importWrenCalibrationStat(stat));
    }
    
    // v18: Daniela Intelligence
    if (bundle.danielaRecommendations?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.danielaRecommendations.length} Daniela Recommendations...`);
      await importWithCount('danielaRecommendations', bundle.danielaRecommendations,
        (rec) => this.importDanielaRecommendation(rec));
    }
    if (bundle.danielaFeatureFeedback?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.danielaFeatureFeedback.length} Daniela Feature Feedback...`);
      await importWithCount('danielaFeatureFeedback', bundle.danielaFeatureFeedback,
        (feedback) => this.importDanielaFeatureFeedback(feedback));
    }
    // Extended Daniela tables (v24+)
    if (bundle.danielaBeacons?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.danielaBeacons.length} Daniela Beacons...`);
      await importWithCount('danielaBeacons', bundle.danielaBeacons,
        (beacon) => this.importDanielaBeacon(beacon));
    }
    if (bundle.synthesizedInsights?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.synthesizedInsights.length} Synthesized Insights...`);
      await importWithCount('synthesizedInsights', bundle.synthesizedInsights,
        (insight) => this.importSynthesizedInsight(insight));
    }
    
    // v18: Beta Testers (merge by email) + v23: Direct enrollments + v27: Teacher classes
    // v27: Import classes FIRST so enrollments can reference them
    if (bundle.betaTesterClasses?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.betaTesterClasses.length} Teacher Classes for beta testers...`);
      let classesImported = 0;
      for (const cls of bundle.betaTesterClasses) {
        try {
          const existing = await db.select().from(teacherClasses).where(eq(teacherClasses.id, cls.id)).limit(1);
          if (existing.length === 0) {
            await db.insert(teacherClasses).values({
              ...cls,
              createdAt: cls.createdAt ? new Date(cls.createdAt) : new Date(),
              updatedAt: cls.updatedAt ? new Date(cls.updatedAt) : new Date(),
            });
            classesImported++;
            console.log(`[SYNC-BRIDGE] Created class: "${cls.name}" (${cls.language})`);
          } else {
            // Update existing class to match dev config
            await db.update(teacherClasses)
              .set({
                name: cls.name,
                language: cls.language,
                classLevel: cls.classLevel,
                isPublicCatalogue: cls.isPublicCatalogue,
                isActive: cls.isActive,
                description: cls.description,
                curriculumPathId: cls.curriculumPathId,
                updatedAt: new Date(),
              })
              .where(eq(teacherClasses.id, cls.id));
            console.log(`[SYNC-BRIDGE] Updated class: "${cls.name}" (${cls.language})`);
          }
        } catch (err: any) {
          console.warn(`[SYNC-BRIDGE] Failed to import class ${cls.name}: ${err.message}`);
          errors.push(`Class ${cls.name}: ${err.message}`);
        }
      }
      counts['betaTesterClasses'] = classesImported;
    }
    
    // v34: ALL Teacher Classes (full class sync - imports ALL classes regardless of beta tester status)
    if (bundle.allTeacherClasses?.length) {
      console.log(`[SYNC-BRIDGE v34] Importing ${bundle.allTeacherClasses.length} ALL Teacher Classes...`);
      let classesImported = 0;
      for (const cls of bundle.allTeacherClasses) {
        try {
          const existing = await db.select().from(teacherClasses).where(eq(teacherClasses.id, cls.id)).limit(1);
          if (existing.length === 0) {
            await db.insert(teacherClasses).values({
              ...cls,
              createdAt: cls.createdAt ? new Date(cls.createdAt) : new Date(),
              updatedAt: cls.updatedAt ? new Date(cls.updatedAt) : new Date(),
            });
            classesImported++;
            console.log(`[SYNC-BRIDGE v34] Created class: "${cls.name}" (${cls.language})`);
          } else {
            // Update existing class to match source
            await db.update(teacherClasses)
              .set({
                name: cls.name,
                language: cls.language,
                classLevel: cls.classLevel,
                isPublicCatalogue: cls.isPublicCatalogue,
                isActive: cls.isActive,
                description: cls.description,
                curriculumPathId: cls.curriculumPathId,
                teacherId: cls.teacherId,
                updatedAt: new Date(),
              })
              .where(eq(teacherClasses.id, cls.id));
            console.log(`[SYNC-BRIDGE v34] Updated class: "${cls.name}" (${cls.language})`);
          }
        } catch (err: any) {
          console.warn(`[SYNC-BRIDGE v34] Failed to import class ${cls.name}: ${err.message}`);
          errors.push(`AllClass ${cls.name}: ${err.message}`);
        }
      }
      counts['allTeacherClasses'] = classesImported;
    }
    
    // v34: ALL Enrollments (full enrollment sync)
    if (bundle.allEnrollments?.length) {
      console.log(`[SYNC-BRIDGE v34] Importing ${bundle.allEnrollments.length} ALL Enrollments...`);
      let enrollmentsImported = 0;
      for (const enr of bundle.allEnrollments) {
        try {
          const existing = await db.select().from(classEnrollments).where(eq(classEnrollments.id, enr.id)).limit(1);
          if (existing.length === 0) {
            await db.insert(classEnrollments).values({
              ...enr,
              enrolledAt: enr.enrolledAt ? new Date(enr.enrolledAt) : new Date(),
              createdAt: enr.createdAt ? new Date(enr.createdAt) : new Date(),
            });
            enrollmentsImported++;
          }
        } catch (err: any) {
          console.warn(`[SYNC-BRIDGE v34] Failed to import enrollment ${enr.id}: ${err.message}`);
          errors.push(`AllEnrollment ${enr.id}: ${err.message}`);
        }
      }
      counts['allEnrollments'] = enrollmentsImported;
    }
    
    if (bundle.betaTesters?.length) {
      console.log(`[SYNC-BRIDGE] Importing ${bundle.betaTesters.length} Beta Testers...`);
      const betaResult = await this.importBetaTesters(
        bundle.betaTesters, 
        bundle.betaTesterCredits || [],
        bundle.betaTesterEnrollments || [],
        bundle.betaTesterClasses || []
      );
      counts['betaTesters'] = betaResult.usersImported;
      counts['betaTesterCredits'] = betaResult.creditsImported;
      counts['betaTesterEnrollments'] = betaResult.enrollmentsCreated;
      counts['betaTesterClasses'] = betaResult.classesImported;
      if (betaResult.errors.length) {
        errors.push(...betaResult.errors);
      }
    }
    
    // v19: Beta Usage (prod → dev pull)
    if (bundle.betaUsage) {
      console.log(`[SYNC-BRIDGE] Importing beta usage data...`);
      const usageResult = await this.importBetaUsage(bundle.betaUsage);
      counts['betaUsageSessions'] = usageResult.sessionsImported;
      counts['betaUsageLedger'] = usageResult.ledgerImported;
      counts['betaUsageCostSummaries'] = usageResult.costSummariesImported;
      if (usageResult.errors.length) {
        errors.push(...usageResult.errors);
      }
    }
    
    // v19: Aggregate Analytics (prod → dev pull, anonymized - just log, no DB storage needed)
    if (bundle.aggregateAnalytics) {
      console.log(`[SYNC-BRIDGE] Received aggregate analytics from prod:`);
      console.log(`  - Total users: ${bundle.aggregateAnalytics.totalUsers}`);
      console.log(`  - Beta testers: ${bundle.aggregateAnalytics.totalBetaTesters}`);
      console.log(`  - Voice sessions: ${bundle.aggregateAnalytics.totalVoiceSessions}`);
      console.log(`  - Total minutes: ${bundle.aggregateAnalytics.totalVoiceMinutes}`);
      console.log(`  - Credits consumed: ${bundle.aggregateAnalytics.totalCreditsConsumed}`);
      console.log(`  - Sessions by language:`, bundle.aggregateAnalytics.sessionsByLanguage);
      // Store in hiveSnapshots for historical tracking
      try {
        await db.insert(hiveSnapshots).values({
          snapshotType: 'aggregate_analytics',
          title: `Aggregate Analytics - ${new Date().toISOString().split('T')[0]}`,
          content: JSON.stringify(bundle.aggregateAnalytics),
          context: JSON.stringify({ source: 'prod_sync', exportedAt: bundle.aggregateAnalytics.exportedAt }),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        });
        counts['aggregateAnalytics'] = 1;
      } catch (err: any) {
        errors.push(`Aggregate analytics snapshot: ${err.message}`);
      }
    }
    
    // v19: Prod Content Growth (prod → dev pull, Daniela-authored pedagogical content)
    if (bundle.prodContentGrowth) {
      console.log(`[SYNC-BRIDGE] Importing Daniela-authored content from production...`);
      const contentResult = await this.importProdContentGrowth(bundle.prodContentGrowth);
      counts['prodContentGrowth'] = contentResult.imported;
      if (contentResult.errors.length) {
        errors.push(...contentResult.errors);
      }
    }
    
    // v19: Founder Context (bidirectional - same Daniela in dev/prod)
    if (bundle.founderContext) {
      console.log(`[SYNC-BRIDGE] Importing founder personal facts...`);
      const contextResult = await this.importFounderContext(bundle.founderContext);
      counts['founderPersonalFacts'] = contextResult.imported + contextResult.updated;
      if (contextResult.errors.length) {
        errors.push(...contextResult.errors);
      }
    }
    
    // Founder Conversations (dev → prod push for Daniela continuity)
    if (bundle.founderConversations) {
      console.log(`[SYNC-BRIDGE] Importing founder conversations for Daniela continuity...`);
      const convResult = await this.importFounderConversations(bundle.founderConversations);
      counts['founderConversations'] = convResult.conversations;
      counts['founderMessages'] = convResult.messages;
      if (convResult.errors.length) {
        errors.push(...convResult.errors);
      }
    }
    
    // Sofia Telemetry (prod → dev pull for cross-environment debugging)
    if (bundle.sofiaTelemetry) {
      console.log(`[SYNC-BRIDGE] Importing Sofia issue reports for debugging...`);
      const telemetryResult = await this.importSofiaTelemetry(bundle.sofiaTelemetry);
      counts['sofiaIssueReports'] = telemetryResult.imported;
      if (telemetryResult.errors.length) {
        errors.push(...telemetryResult.errors);
      }
    }
    
    // v20: Prod Conversations (prod → dev pull for debugging - stored as snapshot)
    if (bundle.prodConversations) {
      const convData = bundle.prodConversations;
      const convCount = convData.conversations?.length || 0;
      const msgCount = convData.messages?.length || 0;
      console.log(`[SYNC-BRIDGE] Storing ${convCount} prod conversations (${msgCount} messages) as snapshot...`);
      try {
        await db.insert(hiveSnapshots).values({
          snapshotType: 'prod_conversations',
          title: `Production Conversations - ${new Date().toISOString().split('T')[0]}`,
          content: JSON.stringify({
            conversations: convData.conversations?.slice(0, 20), // Limit for storage
            messageCount: msgCount,
            exportedAt: convData.exportedAt,
          }),
          context: JSON.stringify({ 
            source: 'prod_sync', 
            totalConversations: convCount,
            totalMessages: msgCount,
          }),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
        counts['prodConversations'] = convCount;
      } catch (err: any) {
        errors.push(`Prod conversations snapshot: ${err.message}`);
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
   * v32: Track received imports from peer with enhanced reliability
   * v33: Added syncSessionId and pageNumber for grouping paginated runs
   * When production pushes to dev, dev needs to record that it received data
   * This makes the sync dashboard accurate for both directions
   * 
   * Creates:
   * 1. A sync run record (for overall dashboard stats)
   * 2. Individual import receipts (for per-batch tracking and health calculations)
   */
  async recordReceivedImport(
    sourceEnvironment: 'development' | 'production',
    batchesReceived: string[],
    counts: Record<string, number>,
    durationMs: number,
    sourceRunId?: string,
    sessionContext?: { syncSessionId?: string; pageNumber?: number }
  ): Promise<void> {
    if (batchesReceived.length === 0) {
      console.log('[SYNC-BRIDGE v32] No batches to record for received import');
      return;
    }
    
    // Calculate total records changed
    const recordsChanged = Object.values(counts).reduce((sum, count) => sum + (count || 0), 0);
    
    try {
      // Record as a "pull" from our perspective - we received data from peer
      await db.insert(syncRuns).values({
        direction: 'pull',
        peerUrl: getSyncPeerUrl() || 'peer-push',
        sourceEnvironment: sourceEnvironment,
        targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        status: 'success',
        triggeredBy: `peer-push:${sourceEnvironment}`,
        completedBatches: batchesReceived,
        attemptedBatches: batchesReceived, // For received imports, attempted = completed
        recordsChanged, // v32: Track actual records
        bestPracticesCount: counts.bestPractices || 0,
        idiomCount: counts.idioms || 0,
        nuanceCount: counts.nuances || 0,
        errorPatternCount: counts.errorPatterns || 0,
        observationCount: counts.observations || 0,
        durationMs,
        completedAt: new Date(),
        // v33: Session grouping for paginated runs
        syncSessionId: sessionContext?.syncSessionId,
        pageNumber: sessionContext?.pageNumber,
      });
      
      const pageInfo = sessionContext?.pageNumber !== undefined ? ` (page ${sessionContext.pageNumber})` : '';
      const sessionInfo = sessionContext?.syncSessionId ? ` [session: ${sessionContext.syncSessionId.slice(0, 8)}...]` : '';
      console.log(`[SYNC-BRIDGE v33] Recorded received import: ${batchesReceived.length} batches, ${recordsChanged} records from ${sourceEnvironment}${pageInfo}${sessionInfo}`);
      
      // v32: Also create individual import receipts for granular per-batch tracking
      for (const batchId of batchesReceived) {
        try {
          // Estimate records per batch (simplified - use the first matching count)
          let batchRecords = 0;
          if (batchId === 'neural-core') {
            batchRecords = (counts.bestPractices || 0) + (counts.idioms || 0) + (counts.nuances || 0) + 
                           (counts.errorPatterns || 0) + (counts.dialects || 0) + (counts.bridges || 0);
          } else if (batchId === 'advanced-intel-a') {
            batchRecords = (counts.subtletyCues || 0) + (counts.emotionalPatterns || 0) + 
                           (counts.creativityTemplates || 0) + (counts.suggestions || 0);
          } else if (batchId === 'advanced-intel-b') {
            batchRecords = (counts.observations || 0) + (counts.northStarPrinciples || 0);
          } else {
            // Generic fallback - distribute remaining records
            batchRecords = Math.max(1, Math.floor(recordsChanged / batchesReceived.length));
          }
          
          await this.recordImportReceipt({
            batchId,
            sourceEnvironment,
            sourceRunId,
            recordsReceived: batchRecords,
            checksumMatch: true,
          });
        } catch (receiptErr: any) {
          console.warn(`[SYNC-BRIDGE v32] Failed to record receipt for ${batchId}: ${receiptErr.message}`);
        }
      }
      
      // v32: Detect anomaly if zero records received
      if (recordsChanged === 0 && batchesReceived.length > 0) {
        await this.recordSyncAnomaly({
          type: 'zero-count-success',
          severity: 'warning',
          message: `Received import from ${sourceEnvironment} completed but transferred 0 records across ${batchesReceived.length} batches`,
          metadata: { sourceEnvironment, batchesReceived, recordsChanged },
        });
      }
      
    } catch (err: any) {
      console.warn(`[SYNC-BRIDGE v32] Failed to record received import: ${err.message}`);
    }
  }
  
  /**
   * v31: Detect which batches were imported from a bundle
   * Used to track received imports accurately
   */
  detectImportedBatches(bundle: Partial<SyncBundle>, counts: Record<string, number>): string[] {
    const batches: string[] = [];
    
    // Map bundle properties to batch names
    if (bundle.bestPractices?.length || bundle.idioms?.length || bundle.nuances?.length || 
        bundle.errorPatterns?.length || bundle.dialects?.length || bundle.bridges?.length ||
        bundle.tools?.length || bundle.procedures?.length || bundle.principles?.length ||
        bundle.patterns?.length) {
      batches.push('neural-core');
    }
    
    if (bundle.subtletyCues?.length || bundle.emotionalPatterns?.length || 
        bundle.creativityTemplates?.length || bundle.suggestions?.length) {
      batches.push('advanced-intel-a');
    }
    
    if (bundle.observations?.length || bundle.northStarPrinciples?.length ||
        bundle.northStarUnderstanding?.length || bundle.northStarExamples?.length) {
      batches.push('advanced-intel-b');
    }
    
    if (bundle.expressLaneSessions?.length || bundle.expressLaneMessages?.length) {
      batches.push('express-lane');
    }
    
    if (bundle.hiveSnapshots?.length) {
      batches.push('hive-snapshots');
    }
    
    if (bundle.danielaGrowthMemories?.length) {
      batches.push('daniela-memories');
    }
    
    if (bundle.tutorVoices?.length) {
      batches.push('product-config');
    }
    
    if (bundle.founderUser) {
      batches.push('founder-context');
    }
    
    // v31: Add more batch detection as needed
    return batches;
  }
  
  /**
   * Send a single batch to the peer with timeout handling
   * v33: Added syncSessionId and pageNumber for grouping paginated runs
   */
  private async sendBatch(
    peerUrl: string, 
    batchType: string, 
    bundle: any,
    timeoutMs: number = 45000, // 45s to stay under Replit's ~60s proxy timeout
    sessionContext?: { syncSessionId: string; pageNumber?: number }
  ): Promise<{ success: boolean; counts: Record<string, number>; errors: string[] }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const headers = createSyncHeaders(bundle);
      
      // v33: Add session context headers for grouping paginated runs
      if (sessionContext?.syncSessionId) {
        headers['X-Sync-Session-Id'] = sessionContext.syncSessionId;
        if (sessionContext.pageNumber !== undefined) {
          headers['X-Sync-Page-Number'] = sessionContext.pageNumber.toString();
        }
      }
      
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
  
  async pushToPeer(triggeredBy: string = 'manual', selectedBatches?: string[]): Promise<SyncResult> {
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
    
    // v36: Wake up peer if sleeping before attempting sync
    console.log(`[SYNC-BRIDGE] Checking if peer is awake before push...`);
    const wakeResult = await wakePeerEnvironment(peerUrl);
    if (!wakeResult.awake) {
      return {
        success: false,
        counts: {},
        errors: [`Peer unreachable: ${wakeResult.message}. The peer environment may be offline or experiencing issues.`],
        durationMs: Date.now() - startTime,
      };
    }
    
    // v27: Acquire concurrency lock to prevent parallel sync runs
    if (!this.acquireLock(triggeredBy, 'push')) {
      return {
        success: false,
        counts: {},
        errors: [`Sync already in progress (${this.syncLock.direction} by ${this.syncLock.lockedBy}). Please wait for it to complete.`],
        durationMs: Date.now() - startTime,
      };
    }
    
    // Helper to check if a batch should run
    const shouldRun = (batch: string) => !selectedBatches || selectedBatches.includes(batch);
    
    // v33: Generate sync session ID to group all paginated runs together
    const syncSessionId = crypto.randomUUID();
    
    const [syncRun] = await db.insert(syncRuns).values({
      direction: 'push',
      peerUrl,
      sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      targetEnvironment: CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production',
      status: 'running',
      triggeredBy,
      syncSessionId, // v33: Link all runs in this session
    }).returning();
    
    console.log(`[SYNC-BRIDGE v33] Push session started: ${syncSessionId}`);
    
    // v35: Move batch tracking outside try block so they persist on failure
    const allCounts: Record<string, number> = {};
    const allErrors: string[] = [];
    let overallSuccess = true;
    const completedBatches: string[] = [];
    const attemptedBatches: string[] = [];
    
    try {
      // Use incremental sync - only export items newer than last successful push
      const lastSuccessfulPush = await this.getLastSuccessfulPushTime();
      const batchInfo = selectedBatches ? `selected batches: ${selectedBatches.join(', ')}` : 'all batches';
      console.log(`[SYNC-BRIDGE] Batched incremental sync since: ${lastSuccessfulPush?.toISOString() || 'never (full sync)'} (${batchInfo})`);
      
      // v28: Collect verification results for UI display
      const verificationResults: SyncVerificationResult[] = [];
      
      // v33: Session context for grouping runs on the receiver
      const sessionContext = { syncSessionId };
      
      // BATCH 1: Neural network core (small, fast)
      if (shouldRun('neural-core')) {
        attemptedBatches.push('neural-core');
        console.log('[SYNC-BRIDGE] Batch 1: Neural network core...');
        const coreBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          bestPractices: await neuralNetworkSync.getBestPracticesForExport(),
          ...await neuralNetworkSync.exportNeuralNetworkExpansion(),
          ...await neuralNetworkSync.exportProceduralMemory(),
        };
        const batch1 = await this.sendBatch(peerUrl, 'neural-core', coreBundle, 45000, sessionContext);
        Object.assign(allCounts, batch1.counts);
        allErrors.push(...batch1.errors);
        if (batch1.success) completedBatches.push('neural-core');
        else overallSuccess = false;
      }
      
      // BATCH 2a: Advanced intelligence + Daniela suggestions (split for timeout fix)
      if (shouldRun('advanced-intel-a')) {
        attemptedBatches.push('advanced-intel-a');
        console.log('[SYNC-BRIDGE] Batch 2a: Advanced intelligence (part A)...');
        const advancedBundleA: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          ...await neuralNetworkSync.exportAdvancedIntelligence(),
          ...await neuralNetworkSync.exportDanielaSuggestions(),
        };
        const batch2a = await this.sendBatch(peerUrl, 'advanced-intel-a', advancedBundleA, 45000, sessionContext);
        Object.assign(allCounts, batch2a.counts);
        allErrors.push(...batch2a.errors);
        if (batch2a.success) completedBatches.push('advanced-intel-a');
        else overallSuccess = false;
      }
      
      // BATCH 2b: TriLane + North Star (split for timeout fix)
      // v27: Paginated push with delta sync - mirrors the pull logic
      if (shouldRun('advanced-intel-b')) {
        attemptedBatches.push('advanced-intel-b');
        console.log('[SYNC-BRIDGE v27] Batch 2b: Advanced intelligence (part B) with pagination...');
        
        // First, send North Star data (small, non-paginated)
        const northStarBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          ...await neuralNetworkSync.exportNorthStar(),
        };
        const northStarResult = await this.sendBatch(peerUrl, 'advanced-intel-b-northstar', northStarBundle, 45000, sessionContext);
        Object.assign(allCounts, northStarResult.counts);
        allErrors.push(...northStarResult.errors);
        if (!northStarResult.success) overallSuccess = false;
        
        // Now paginated observations with delta sync
        const lastPushTime = await this.getLastSuccessfulPushTime();
        console.log(`[SYNC-BRIDGE v27] Observations delta push since: ${lastPushTime?.toISOString() || 'never (full sync)'}`);
        
        let page = 0;
        let hasMore = true;
        const MAX_PAGES = 2000;
        let observationsPushed = 0;
        
        while (hasMore && page < MAX_PAGES) {
          console.log(`[SYNC-BRIDGE v27] Pushing observations page ${page}${lastPushTime ? ' (delta)' : ''}...`);
          
          const triLane = await neuralNetworkSync.exportTriLaneObservations({ 
            page, 
            sinceTimestamp: lastPushTime || undefined 
          });
          
          // Combine agent + support observations into the 'observations' property (matches SyncBundle schema)
          const pageBundle: Partial<SyncBundle> = {
            generatedAt: new Date().toISOString(),
            sourceEnvironment: CURRENT_ENVIRONMENT,
            observations: [
              ...(Array.isArray(triLane?.agentObservations) ? triLane.agentObservations : []),
              ...(Array.isArray(triLane?.supportObservations) ? triLane.supportObservations : [])
            ],
            alerts: Array.isArray(triLane?.systemAlerts) ? triLane.systemAlerts : [],
            observationsPagination: triLane?.pagination || null,
          };
          
          // v33: Include page number for paginated batches
          const pageResult = await this.sendBatch(peerUrl, `advanced-intel-b-p${page}`, pageBundle, 60000, { syncSessionId, pageNumber: page });
          
          if (!pageResult.success) {
            allErrors.push(...pageResult.errors);
            overallSuccess = false;
            hasMore = false;
            break;
          }
          
          Object.assign(allCounts, pageResult.counts);
          observationsPushed += (triLane?.agentObservations?.length || 0) + 
                               (triLane?.supportObservations?.length || 0);
          
          hasMore = triLane.pagination?.hasMore ?? false;
          page++;
          
          console.log(`[SYNC-BRIDGE v27] Page ${page - 1} pushed (${observationsPushed} total). hasMore=${hasMore}`);
        }
        
        if (page >= MAX_PAGES) {
          console.warn(`[SYNC-BRIDGE v27] Hit MAX_PAGES limit (${MAX_PAGES}) for observations push`);
        }
        
        // Mark batch complete only if all pages succeeded
        if (!allErrors.some(e => e.includes('advanced-intel-b'))) {
          completedBatches.push('advanced-intel-b');
          console.log(`[SYNC-BRIDGE v27] advanced-intel-b push complete: ${observationsPushed} observations in ${page} pages`);
        }
      }
      
      // BATCH 3: Express Lane data (can be large)
      if (shouldRun('express-lane')) {
        attemptedBatches.push('express-lane');
        console.log('[SYNC-BRIDGE] Batch 3: Express Lane...');
        const expressLaneData = await this.exportExpressLaneData(lastSuccessfulPush);
        const expressBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          founderUser: await this.exportFounderUser(),
          expressLaneSessions: expressLaneData.sessions,
          expressLaneMessages: expressLaneData.messages,
        };
        const batch3 = await this.sendBatch(peerUrl, 'express-lane', expressBundle, 60000, sessionContext);
        Object.assign(allCounts, batch3.counts);
        allErrors.push(...batch3.errors);
        if (batch3.success) completedBatches.push('express-lane');
        else overallSuccess = false;
      }
      
      // BATCH 4: Hive snapshots only
      if (shouldRun('hive-snapshots')) {
        attemptedBatches.push('hive-snapshots');
        console.log('[SYNC-BRIDGE] Batch 4: Hive Snapshots...');
        const hiveSnapshots = await this.exportHiveSnapshots(lastSuccessfulPush);
        const hiveBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          hiveSnapshots,
        };
        const batch4 = await this.sendBatch(peerUrl, 'hive-snapshots', hiveBundle, 60000, sessionContext);
        Object.assign(allCounts, batch4.counts);
        allErrors.push(...batch4.errors);
        if (batch4.success) completedBatches.push('hive-snapshots');
        else overallSuccess = false;
      }
      
      // BATCH 5: Daniela growth memories only
      if (shouldRun('daniela-memories')) {
        attemptedBatches.push('daniela-memories');
        console.log('[SYNC-BRIDGE] Batch 5: Daniela Memories...');
        const danielaMemories = await this.exportDanielaGrowthMemories(lastSuccessfulPush);
        const memoriesBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          danielaGrowthMemories: danielaMemories,
        };
        const batch5 = await this.sendBatch(peerUrl, 'daniela-memories', memoriesBundle, 60000, sessionContext);
        Object.assign(allCounts, batch5.counts);
        allErrors.push(...batch5.errors);
        if (batch5.success) completedBatches.push('daniela-memories');
        else overallSuccess = false;
      }
      
      // BATCH 6: Product config (tutor voices, catalogue classes, pricing packages)
      if (shouldRun('product-config')) {
        attemptedBatches.push('product-config');
        console.log('[SYNC-BRIDGE] Batch 6: Product config...');
        
        // v33: Export all product config tables
        const voices = await this.exportTutorVoices();
        const catalogueClasses = await db.select().from(teacherClasses).where(
          eq(teacherClasses.isPublicCatalogue, true)
        );
        const hourPackages = await db.select().from(classHourPackages);
        
        console.log(`[SYNC-BRIDGE] product-config batch: ${voices.length} voices, ${catalogueClasses.length} catalogue classes, ${hourPackages.length} hour packages`);
        
        const configBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          tutorVoices: voices,
          catalogueClasses: catalogueClasses,
          classHourPackages: hourPackages,
        };
        const batch6 = await this.sendBatch(peerUrl, 'product-config', configBundle, 45000, sessionContext);
        Object.assign(allCounts, batch6.counts);
        allErrors.push(...batch6.errors);
        if (batch6.success) completedBatches.push('product-config');
        else overallSuccess = false;
      }
      
      // BATCH 7: Beta testers (users + credits + enrollments + classes)
      // v28: Use collectExportBundle for consistent behavior with export endpoint + verification
      if (shouldRun('beta-testers')) {
        attemptedBatches.push('beta-testers');
        
        // Pre-sync manifest - capture what we're about to send
        const manifest = await this.generateSyncManifest('beta-testers');
        console.log('[SYNC-BRIDGE] Batch 7: Beta testers + classes...');
        console.log(`[SYNC-VERIFY] Pre-sync manifest: ${manifest.expected.users} users, ${manifest.expected.classes} classes, ${manifest.expected.credits} credits, ${manifest.expected.enrollments} enrollments`);
        
        const betaBundle = await this.collectExportBundle(null, 'beta-testers');
        const batch7 = await this.sendBatch(peerUrl, 'beta-testers', betaBundle, 90000, sessionContext); // 90s for large credit/enrollment data
        Object.assign(allCounts, batch7.counts);
        allErrors.push(...batch7.errors);
        
        if (batch7.success) {
          completedBatches.push('beta-testers');
          
          // Post-sync verification - check data arrived
          try {
            const verification = await this.verifySyncWithPeer(peerUrl, manifest);
            this.logVerificationResult(verification);
            verificationResults.push(verification);
            if (!verification.success) {
              allErrors.push(`beta-testers verification failed: ${verification.discrepancies.join('; ')}`);
            }
          } catch (verifyErr: any) {
            console.warn('[SYNC-VERIFY] Beta-testers verification failed:', verifyErr.message);
          }
        } else {
          overallSuccess = false;
        }
      }
      
      // BATCH 8: Beta usage data (prod → dev pull)
      if (shouldRun('beta-usage')) {
        attemptedBatches.push('beta-usage');
        console.log('[SYNC-BRIDGE] Batch 8: Beta usage data...');
        const betaUsage = await this.exportBetaUsage();
        const betaUsageBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          betaUsage,
        };
        const batch8 = await this.sendBatch(peerUrl, 'beta-usage', betaUsageBundle, 90000, sessionContext); // 90s for 858+ sessions
        Object.assign(allCounts, batch8.counts);
        allErrors.push(...batch8.errors);
        if (batch8.success) completedBatches.push('beta-usage');
        else overallSuccess = false;
      }
      
      // BATCH 9: Aggregate analytics (prod → dev pull, anonymized)
      if (shouldRun('aggregate-analytics')) {
        attemptedBatches.push('aggregate-analytics');
        console.log('[SYNC-BRIDGE] Batch 9: Aggregate analytics...');
        const aggregateAnalytics = await this.exportAggregateAnalytics();
        const analyticsBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          aggregateAnalytics,
        };
        const batch9 = await this.sendBatch(peerUrl, 'aggregate-analytics', analyticsBundle, 45000, sessionContext);
        Object.assign(allCounts, batch9.counts);
        allErrors.push(...batch9.errors);
        if (batch9.success) completedBatches.push('aggregate-analytics');
        else overallSuccess = false;
      }
      
      // BATCH 10: Curriculum core (syllabi, units, lessons, topics)
      if (shouldRun('curriculum-core')) {
        attemptedBatches.push('curriculum-core');
        console.log('[SYNC-BRIDGE] Batch 10: Curriculum core...');
        const curriculumBundle = await this.collectExportBundle(lastSuccessfulPush, 'curriculum-core');
        const batch10 = await this.sendBatch(peerUrl, 'curriculum-core', curriculumBundle, 60000, sessionContext);
        Object.assign(allCounts, batch10.counts);
        allErrors.push(...batch10.errors);
        if (batch10.success) completedBatches.push('curriculum-core');
        else overallSuccess = false;
      }
      
      // BATCH 11: Curriculum drills (drill items, grammar, can-do statements)
      if (shouldRun('curriculum-drills')) {
        attemptedBatches.push('curriculum-drills');
        console.log('[SYNC-BRIDGE] Batch 11: Curriculum drills...');
        const drillsBundle = await this.collectExportBundle(lastSuccessfulPush, 'curriculum-drills');
        const batch11 = await this.sendBatch(peerUrl, 'curriculum-drills', drillsBundle, 60000, sessionContext);
        Object.assign(allCounts, batch11.counts);
        allErrors.push(...batch11.errors);
        if (batch11.success) completedBatches.push('curriculum-drills');
        else overallSuccess = false;
      }
      
      // BATCH 12: Wren intelligence (insights, triggers, ADRs, lessons)
      if (shouldRun('wren-intel')) {
        attemptedBatches.push('wren-intel');
        console.log('[SYNC-BRIDGE] Batch 12: Wren intelligence...');
        const wrenBundle = await this.collectExportBundle(lastSuccessfulPush, 'wren-intel');
        const batch12 = await this.sendBatch(peerUrl, 'wren-intel', wrenBundle, 60000, sessionContext);
        Object.assign(allCounts, batch12.counts);
        allErrors.push(...batch12.errors);
        if (batch12.success) completedBatches.push('wren-intel');
        else overallSuccess = false;
      }
      
      // BATCH 13: Daniela intelligence (recommendations, feature feedback)
      if (shouldRun('daniela-intel')) {
        attemptedBatches.push('daniela-intel');
        console.log('[SYNC-BRIDGE] Batch 13: Daniela intelligence...');
        const danielaBundle = await this.collectExportBundle(lastSuccessfulPush, 'daniela-intel');
        const batch13 = await this.sendBatch(peerUrl, 'daniela-intel', danielaBundle, 45000, sessionContext);
        Object.assign(allCounts, batch13.counts);
        allErrors.push(...batch13.errors);
        if (batch13.success) completedBatches.push('daniela-intel');
        else overallSuccess = false;
      }
      
      // BATCH 14: Founder context (personal facts for same Daniela in dev/prod)
      if (shouldRun('founder-context')) {
        attemptedBatches.push('founder-context');
        console.log('[SYNC-BRIDGE] Batch 14: Founder context...');
        const founderContext = await this.exportFounderContext();
        const contextBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          founderContext,
        };
        const batch14 = await this.sendBatch(peerUrl, 'founder-context', contextBundle, 60000, sessionContext);
        Object.assign(allCounts, batch14.counts);
        allErrors.push(...batch14.errors);
        if (batch14.success) completedBatches.push('founder-context');
        else overallSuccess = false;
      }
      
      // BATCH 15: Founder conversations (dev conversations for Daniela continuity)
      if (shouldRun('founder-conversations')) {
        attemptedBatches.push('founder-conversations');
        console.log('[SYNC-BRIDGE] Batch 15: Founder conversations...');
        const convData = await this.exportFounderConversations();
        const convBundle: Partial<SyncBundle> = {
          generatedAt: new Date().toISOString(),
          sourceEnvironment: CURRENT_ENVIRONMENT,
          founderConversations: convData,
        };
        const batch15 = await this.sendBatch(peerUrl, 'founder-conversations', convBundle, 90000, sessionContext);
        Object.assign(allCounts, batch15.counts);
        allErrors.push(...batch15.errors);
        if (batch15.success) completedBatches.push('founder-conversations');
        else overallSuccess = false;
      }
      
      // v32: Calculate total records actually transferred
      const recordsChanged = Object.values(allCounts).reduce((sum, count) => sum + (count || 0), 0);
      
      // v32: Improved status determination - distinguish no-op from success
      const expectedBatchCount = attemptedBatches.length;
      const completedBatchCount = completedBatches.length;
      
      let finalStatus: 'success' | 'partial' | 'failed';
      let isNoOp = false;
      
      if (expectedBatchCount === 0) {
        // No batches attempted (empty selection or all filtered) = no-op (but report as success for compatibility)
        finalStatus = 'success';
        isNoOp = true;
      } else if (completedBatchCount === expectedBatchCount && recordsChanged === 0) {
        // All batches completed but zero records transferred = no-op
        finalStatus = 'success';
        isNoOp = true;
      } else if (completedBatchCount === expectedBatchCount) {
        // All attempted batches completed with data = true success
        finalStatus = 'success';
      } else if (completedBatchCount > 0) {
        // Some batches completed, some failed = partial
        finalStatus = 'partial';
      } else {
        // No batches completed = failed
        finalStatus = 'failed';
      }
      
      console.log(`[SYNC-BRIDGE v32] Push complete. Completed: ${completedBatchCount}/${expectedBatchCount}, Records: ${recordsChanged}, Status: ${finalStatus}${isNoOp ? ' (NO-OP)' : ''}, Errors: ${allErrors.length}`);
      console.log(`[SYNC-BRIDGE v32] Saving attemptedBatches: [${attemptedBatches.join(', ')}], completedBatches: [${completedBatches.join(', ')}]`);
      
      // v32: Detect and log anomalies for zero-count success
      if (finalStatus === 'success' && recordsChanged === 0 && expectedBatchCount > 0) {
        await this.recordSyncAnomaly({
          type: 'zero-count-success',
          severity: 'warning',
          syncRunId: syncRun.id,
          message: `Push completed successfully but transferred 0 records across ${completedBatchCount} batches`,
          metadata: { attemptedBatches, completedBatches, recordsChanged },
        });
      }
      
      await db.update(syncRuns)
        .set({
          status: finalStatus,
          completedBatches: completedBatches.length > 0 ? completedBatches : null,
          attemptedBatches: attemptedBatches.length > 0 ? attemptedBatches : null, // v32: Track attempted
          recordsChanged, // v32: Track actual records transferred
          verificationResults: verificationResults.length > 0 ? verificationResults : null,
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
        success: finalStatus === 'success', 
        syncRunId: syncRun.id,
        counts: allCounts, 
        errors: allErrors,
        durationMs: Date.now() - startTime,
      };
      
    } catch (err: any) {
      const errorMessage = err.message;
      console.error(`[SYNC-BRIDGE] Push failed: ${errorMessage}`);
      
      // v35.1: Save batch tracking on failure, but only current run's errors (not accumulated)
      // The main exception message is the critical one; allErrors may have partial batch failures
      const runErrors = allErrors.length > 0 ? allErrors.slice() : [];
      runErrors.push(errorMessage);
      
      await db.update(syncRuns)
        .set({
          status: 'failed',
          errorMessage: runErrors.join('; ').slice(0, 2000), // Truncate to prevent overflow
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
          attemptedBatches: attemptedBatches.length > 0 ? attemptedBatches : null,
          completedBatches: completedBatches.length > 0 ? completedBatches : null,
          recordsChanged: Object.values(allCounts).reduce((a, b) => a + b, 0),
        })
        .where(eq(syncRuns.id, syncRun.id));
      
      return {
        success: false,
        syncRunId: syncRun.id,
        counts: allCounts,
        errors: runErrors,
        durationMs: Date.now() - startTime,
      };
    } finally {
      // v27: Always release the lock when done
      this.releaseLock();
    }
  }
  
  /**
   * Fetch a single batch from the peer with timeout handling
   * v23: Added sinceTimestamp for delta sync support
   */
  private async fetchBatch(
    peerUrl: string,
    batchType: string,
    timeoutMs: number = 45000,
    sinceTimestamp?: Date
  ): Promise<{ success: boolean; bundle: Partial<SyncBundle>; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      // v23: Include sinceTimestamp for delta sync (observations only sync new records)
      const requestPayload: any = { requestedAt: new Date().toISOString(), batchType };
      if (sinceTimestamp) {
        requestPayload.sinceTimestamp = sinceTimestamp.toISOString();
      }
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
  
  async pullFromPeer(triggeredBy: string = 'manual', options?: { forceResume?: boolean; selectedBatches?: string[] }): Promise<SyncResult> {
    const startTime = Date.now();
    const peerUrl = getSyncPeerUrl();
    const forceResume = options?.forceResume ?? false;
    const batchFilter = options?.selectedBatches;
    
    if (!peerUrl || !isSyncConfigured()) {
      return {
        success: false,
        counts: {},
        errors: ['Sync not configured - set SYNC_PEER_URL and SYNC_SHARED_SECRET'],
        durationMs: Date.now() - startTime,
      };
    }
    
    // v36: Wake up peer if sleeping before attempting sync
    console.log(`[SYNC-BRIDGE] Checking if peer is awake before pull...`);
    const wakeResult = await wakePeerEnvironment(peerUrl);
    if (!wakeResult.awake) {
      return {
        success: false,
        counts: {},
        errors: [`Peer unreachable: ${wakeResult.message}. The peer environment may be offline or experiencing issues.`],
        durationMs: Date.now() - startTime,
      };
    }
    
    // v27: Acquire concurrency lock to prevent parallel sync runs
    if (!this.acquireLock(triggeredBy, 'pull')) {
      return {
        success: false,
        counts: {},
        errors: [`Sync already in progress (${this.syncLock.direction} by ${this.syncLock.lockedBy}). Please wait for it to complete.`],
        durationMs: Date.now() - startTime,
      };
    }
    
    // v37: Enhanced resume logic - find interrupted, failed, or partial syncs with incomplete pages
    // Looks for both 'running' syncs that timed out AND recent 'failed'/'partial' syncs that have progress
    let interruptedRun: SyncRun | undefined;
    
    if (forceResume) {
      console.log(`[SYNC-BRIDGE v37] FORCE RESUME requested by ${triggeredBy}`);
      // Force resume: look for ANY recent pull with progress (running, failed, or partial)
      const [staleRun] = await db.select()
        .from(syncRuns)
        .where(and(
          eq(syncRuns.direction, 'pull'),
          or(
            eq(syncRuns.status, 'running'),
            eq(syncRuns.status, 'failed'),
            eq(syncRuns.status, 'partial')
          )
        ))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);
      
      // Only resume if there's actual progress to resume from
      if (staleRun && ((staleRun.lastCompletedPage ?? -1) >= 0 || (staleRun.completedBatches?.length ?? 0) > 0)) {
        interruptedRun = staleRun;
        console.log(`[SYNC-BRIDGE v37] Force resuming from run ${interruptedRun.id} (status=${interruptedRun.status}, page=${interruptedRun.lastCompletedPage ?? -1}, batches=${interruptedRun.completedBatches?.join(',') || 'none'})`);
      }
    } else {
      // Normal mode: auto-resume from recent failed/partial syncs (within last 10 minutes)
      // Also check for stuck 'running' syncs older than 90 seconds
      const recentThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes
      const runningThreshold = new Date(Date.now() - 90 * 1000); // 90 seconds for running syncs
      
      // First, check for stuck 'running' syncs WITH progress
      const [stuckRun] = await db.select()
        .from(syncRuns)
        .where(and(
          eq(syncRuns.direction, 'pull'),
          eq(syncRuns.status, 'running'),
          lt(syncRuns.startedAt, runningThreshold)
        ))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);
      
      // v37 fix: Only resume stuck runs if they have meaningful progress
      if (stuckRun && ((stuckRun.lastCompletedPage ?? -1) >= 0 || (stuckRun.completedBatches?.length ?? 0) > 0)) {
        interruptedRun = stuckRun;
        console.log(`[SYNC-BRIDGE v37] Found stuck running sync ${stuckRun.id} with progress to resume`);
      } else if (stuckRun) {
        // Stuck but no progress - just mark as failed, don't resume
        console.log(`[SYNC-BRIDGE v37] Found stuck running sync ${stuckRun.id} but no progress - marking as failed`);
        await db.update(syncRuns)
          .set({ status: 'failed', errorMessage: 'Stuck with no progress - auto-cleaned', completedAt: new Date() })
          .where(eq(syncRuns.id, stuckRun.id));
      } else {
        // Check for recent failed/partial syncs with progress (use completedAt for recency)
        const [failedRun] = await db.select()
          .from(syncRuns)
          .where(and(
            eq(syncRuns.direction, 'pull'),
            or(eq(syncRuns.status, 'failed'), eq(syncRuns.status, 'partial')),
            gte(syncRuns.completedAt, recentThreshold)
          ))
          .orderBy(desc(syncRuns.completedAt))
          .limit(1);
        
        // Only resume if there's significant progress (at least 1 completed batch or page)
        if (failedRun && ((failedRun.lastCompletedPage ?? -1) >= 0 || (failedRun.completedBatches?.length ?? 0) > 0)) {
          interruptedRun = failedRun;
          console.log(`[SYNC-BRIDGE v37] Found recent ${failedRun.status} sync ${failedRun.id} with progress to resume`);
        }
      }
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
      
      // v32: Track attempted batches (only those actually processed, not skipped)
      const attemptedBatches: string[] = [];
      
      // Batched pull - fetch each batch type separately to avoid timeout
      // v15: advanced-intel-b now supports pagination for large observation datasets
      // v16: Skip already-completed batches on resume
      // v19: Support selective batch pulling for beta analytics
      // v20: Added prod-to-dev diagnostic batches (sofia-telemetry, prod-conversations, prod-content-growth)
      // v35: Added ALL missing batches for true bidirectional sync parity with push
      const allBatchTypes = [
        // Core neural network and AI intelligence
        'neural-core', 'advanced-intel-a', 'advanced-intel-b', 
        // Hive collaboration and memories
        'express-lane', 'hive-snapshots', 'daniela-memories', 'founder-context', 'founder-conversations',
        // Product configuration
        'product-config', 
        // Beta testers and usage data
        'beta-testers', 'beta-usage', 'aggregate-analytics',
        // Curriculum data (dev → prod sync for syllabi/classes)
        'curriculum-core', 'curriculum-drills', 'all-classes',
        // Wren and Daniela intelligence
        'wren-intel', 'daniela-intel',
        // Production diagnostics - only pulled by dev from prod
        'sofia-telemetry', 'prod-conversations', 'prod-content-growth'
      ];
      // v26: No default excludes - all batches use pagination + delta sync
      // - aggregate-analytics: small payload, safe to include
      // - advanced-intel-b: 388K+ initial, but delta sync only fetches new observations
      // - beta-usage: paginated (v25) with delta sync
      // After initial full sync, all batches are incremental and manageable
      const DEFAULT_EXCLUDED: string[] = [];
      const batchTypes = batchFilter && batchFilter.length > 0 
        ? allBatchTypes.filter(b => batchFilter.includes(b))
        : allBatchTypes.filter(b => !DEFAULT_EXCLUDED.includes(b));
      
      for (let i = 0; i < batchTypes.length; i++) {
        const batchType = batchTypes[i];
        
        // v16: Skip completed batches (except advanced-intel-b which needs page tracking)
        if (batchType !== 'advanced-intel-b' && completedBatches.includes(batchType)) {
          console.log(`[SYNC-BRIDGE v16] Skipping already-completed batch: ${batchType}`);
          continue;
        }
        
        console.log(`[SYNC-BRIDGE] Pull batch ${i + 1}/${batchTypes.length}: ${batchType}...`);
        
        // v32: Track that we're attempting this batch
        attemptedBatches.push(batchType);
        
        // 45s timeout for smaller batches, 60s for larger data batches, 120s for very large curriculum batches
        const timeout = ['curriculum-drills'].includes(batchType) ? 120000 
          : ['express-lane', 'hive-snapshots', 'daniela-memories', 'founder-context', 'founder-conversations', 'curriculum-core', 'all-classes', 'beta-testers', 'wren-intel', 'daniela-intel'].includes(batchType) ? 60000 
          : 45000;
        
        // Special handling for advanced-intel-b: paginated fetching
        if (batchType === 'advanced-intel-b') {
          // v16: Resume from last completed page
          let page = resumeFromPage > 0 ? resumeFromPage : 0;
          let hasMore = true;
          const MAX_PAGES = 2000; // v22: Increased to handle 500K+ observations (387K needs ~1550 pages)
          
          // v23: Delta sync - get last successful pull timestamp to only fetch new observations
          const lastPullTime = await this.getLastSuccessfulPullTime('advanced-intel-b');
          if (lastPullTime) {
            console.log(`[SYNC-BRIDGE v23] Delta sync: only fetching observations since ${lastPullTime.toISOString()}`);
          } else {
            console.log(`[SYNC-BRIDGE v23] Full sync: no previous pull found, fetching all observations`);
          }
          
          if (page > 0) {
            console.log(`[SYNC-BRIDGE v16] Resuming observations from page ${page}`);
          }
          
          while (hasMore && page < MAX_PAGES) {
            const pageBatchType = page === 0 ? 'advanced-intel-b' : `advanced-intel-b-p${page}`;
            console.log(`[SYNC-BRIDGE] Fetching observations page ${page}${lastPullTime ? ' (delta)' : ''}...`);
            
            // v23: Pass sinceTimestamp for delta sync
            const result = await this.fetchBatch(peerUrl, pageBatchType, timeout, lastPullTime || undefined);
            
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
            
        } else if (batchType === 'beta-usage') {
          // v25: Paginated beta-usage pull (similar to advanced-intel-b)
          let page = 0;
          let hasMore = true;
          const MAX_PAGES = 50; // 250 sessions/page = 12,500 sessions max
          
          // v25: Delta sync - get last successful pull timestamp to only fetch new sessions
          const lastPullTime = await this.getLastSuccessfulPullTime('beta-usage');
          if (lastPullTime) {
            console.log(`[SYNC-BRIDGE v25] beta-usage delta sync: only fetching sessions since ${lastPullTime.toISOString()}`);
          } else {
            console.log(`[SYNC-BRIDGE v25] beta-usage full sync: no previous pull found`);
          }
          
          while (hasMore && page < MAX_PAGES) {
            const pageBatchType = page === 0 ? 'beta-usage' : `beta-usage-p${page}`;
            console.log(`[SYNC-BRIDGE v25] Fetching beta-usage page ${page}${lastPullTime ? ' (delta)' : ''}...`);
            
            const result = await this.fetchBatch(peerUrl, pageBatchType, 60000, lastPullTime || undefined); // 60s timeout
            
            if (!result.success) {
              allErrors.push(result.error || `${pageBatchType} failed`);
              overallSuccess = false;
              hasMore = false;
              break;
            }
            
            // Apply the partial bundle
            const importResult = await this.applyImportBundle(result.bundle as SyncBundle);
            Object.assign(allCounts, importResult.counts);
            allErrors.push(...importResult.errors);
            if (!importResult.success) overallSuccess = false;
            
            // Check for more pages from betaUsage response
            const betaUsagePagination = (result.bundle as SyncBundle).betaUsage;
            hasMore = betaUsagePagination?.hasMore ?? false;
            page++;
            
            console.log(`[SYNC-BRIDGE v25] beta-usage page ${page - 1} complete. hasMore=${hasMore}`);
          }
          
          if (page >= MAX_PAGES) {
            console.warn(`[SYNC-BRIDGE v25] Hit MAX_PAGES limit (${MAX_PAGES}) for beta-usage`);
          }
          
          // Mark beta-usage as completed when all pages done
          if (!hasMore && overallSuccess) {
            completedBatches.push('beta-usage');
            await db.update(syncRuns)
              .set({ completedBatches })
              .where(eq(syncRuns.id, syncRun.id));
            console.log(`[SYNC-BRIDGE v25] beta-usage marked complete (${page} pages)`);
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
      
      // v32: Calculate total records actually transferred
      const recordsChanged = Object.values(allCounts).reduce((sum, count) => sum + (count || 0), 0);
      
      // v21: Improved status determination based on completed batches, not just errors
      // v32: Also consider recordsChanged for no-op detection
      // v32: Use attemptedBatches (only batches we actually processed, not skipped)
      // - 'success': All attempted batches completed (warnings are OK), or no batches attempted
      // - 'partial': Some batches completed, some failed
      // - 'failed': No batches completed successfully
      const expectedBatchCount = attemptedBatches.length;
      const completedBatchCount = completedBatches.length;
      
      let finalStatus: 'success' | 'partial' | 'failed';
      let isNoOp = false;
      
      if (expectedBatchCount === 0) {
        // No batches actually processed (all were skipped or empty selection) = success (no-op)
        finalStatus = 'success';
        isNoOp = true;
      } else if (completedBatchCount === expectedBatchCount && recordsChanged === 0) {
        // All attempted batches completed but zero records transferred = no-op
        finalStatus = 'success';
        isNoOp = true;
      } else if (completedBatchCount === expectedBatchCount) {
        // All attempted batches completed - this is success even if there were import warnings
        finalStatus = 'success';
      } else if (completedBatchCount > 0) {
        // Some batches completed, some failed
        finalStatus = 'partial';
      } else {
        // No batches completed
        finalStatus = 'failed';
      }
      
      console.log(`[SYNC-BRIDGE v32] Pull complete. Attempted: ${expectedBatchCount}, Completed: ${completedBatchCount}, Records: ${recordsChanged}, Status: ${finalStatus}${isNoOp ? ' (NO-OP)' : ''}, Errors: ${allErrors.length}`);
      console.log(`[SYNC-BRIDGE v32] attemptedBatches: [${attemptedBatches.join(', ')}], completedBatches: [${completedBatches.join(', ')}]`);
      
      // v32: Detect and log anomalies for zero-count success
      if (finalStatus === 'success' && recordsChanged === 0 && expectedBatchCount > 0) {
        await this.recordSyncAnomaly({
          type: 'zero-count-success',
          severity: 'warning',
          syncRunId: syncRun.id,
          message: `Pull completed successfully but transferred 0 records across ${completedBatchCount} batches`,
          metadata: { attemptedBatches, completedBatches, recordsChanged },
        });
      }
      
      await db.update(syncRuns)
        .set({
          status: finalStatus,
          attemptedBatches: attemptedBatches.length > 0 ? attemptedBatches : null, // v32: Track actually attempted
          recordsChanged, // v32: Track actual records transferred
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
        success: finalStatus === 'success', 
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
    } finally {
      // v27: Always release the lock when done
      this.releaseLock();
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
    lockStatus: {
      isLocked: boolean;
      lockedBy: string | null;
      lockedAt: Date | null;
      direction: 'push' | 'pull' | null;
      lockAgeMs: number | null;
      timeoutMs: number;
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
      lockStatus: this.getLockStatus(),
    };
  }
  
  /**
   * v37: Get resumable sync status - check if there's a sync that can be resumed
   * Used by the UI to show resume options
   */
  async getResumableStatus(): Promise<{
    hasResumable: boolean;
    resumableRun: SyncRun | null;
    resumeInfo: {
      completedBatches: string[];
      lastCompletedPage: number;
      totalPagesExpected: number | null;
      startedAt: string;
      status: string;
      errorMessage: string | null;
    } | null;
  }> {
    // Look for recent failed/partial syncs with progress
    // Use a longer window (1 hour) since long syncs can start early but fail late
    const recentThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
    
    // First check for stuck running syncs (older than 90 seconds = definitely stale)
    const runningThreshold = new Date(Date.now() - 90 * 1000);
    const [stuckRunning] = await db.select()
      .from(syncRuns)
      .where(and(
        eq(syncRuns.direction, 'pull'),
        eq(syncRuns.status, 'running'),
        lt(syncRuns.startedAt, runningThreshold)
      ))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);
    
    if (stuckRunning && ((stuckRunning.lastCompletedPage ?? -1) >= 0 || (stuckRunning.completedBatches?.length ?? 0) > 0)) {
      return {
        hasResumable: true,
        resumableRun: stuckRunning,
        resumeInfo: {
          completedBatches: stuckRunning.completedBatches || [],
          lastCompletedPage: stuckRunning.lastCompletedPage ?? -1,
          totalPagesExpected: stuckRunning.totalPagesExpected ?? null,
          startedAt: stuckRunning.startedAt.toISOString(),
          status: stuckRunning.status,
          errorMessage: stuckRunning.errorMessage ?? null,
        },
      };
    }
    
    // Check for recent failed/partial syncs with progress (use completedAt for recency)
    const [resumableRun] = await db.select()
      .from(syncRuns)
      .where(and(
        eq(syncRuns.direction, 'pull'),
        or(
          eq(syncRuns.status, 'failed'),
          eq(syncRuns.status, 'partial')
        ),
        gte(syncRuns.completedAt, recentThreshold)
      ))
      .orderBy(desc(syncRuns.completedAt))
      .limit(1);
    
    // Only consider it resumable if there's actual progress
    if (resumableRun && ((resumableRun.lastCompletedPage ?? -1) >= 0 || (resumableRun.completedBatches?.length ?? 0) > 0)) {
      return {
        hasResumable: true,
        resumableRun,
        resumeInfo: {
          completedBatches: resumableRun.completedBatches || [],
          lastCompletedPage: resumableRun.lastCompletedPage ?? -1,
          totalPagesExpected: resumableRun.totalPagesExpected ?? null,
          startedAt: resumableRun.startedAt.toISOString(),
          status: resumableRun.status,
          errorMessage: resumableRun.errorMessage ?? null,
        },
      };
    }
    
    return {
      hasResumable: false,
      resumableRun: null,
      resumeInfo: null,
    };
  }
  
  /**
   * v33: Compare record counts between DEV and PROD environments
   * Fetches local counts and peer counts for key sync tables
   */
  async compareEnvironments(): Promise<{
    localEnvironment: string;
    peerEnvironment: string;
    comparison: Array<{
      table: string;
      localCount: number;
      peerCount: number;
      difference: number;
      status: 'match' | 'local-ahead' | 'peer-ahead' | 'error';
    }>;
    errors: string[];
    comparedAt: string;
  }> {
    const errors: string[] = [];
    // Comprehensive list of all sync-critical tables organized by batch
    const comparisonTables = [
      // Product Config
      'catalogueClasses',
      'teacherClasses',
      'tutorVoices',
      // Curriculum Core & Drills
      'curriculumPaths',
      'curriculumUnits',
      'curriculumLessons',
      'curriculumDrillItems',
      'grammarCompetencies',
      'canDoStatements',
      'lessonCanDoStatements',
      'culturalTips',
      // Neural Core (Best Practices & Language Content)
      'bestPractices',
      'languageIdioms',
      'culturalNuances',
      'learnerErrorPatterns',
      'dialectVariations',
      'linguisticBridges',
      // Daniela Intelligence & Memories
      'danielaGrowthMemories',
      'danielaBeacons',
      'synthesizedInsights',
      'danielaRecommendations',
      // Hive & Express Lane
      'hiveSnapshots',
      'founderSessions',
      'collaborationMessages',
      'learnerPersonalFacts',
      // Wren Intelligence
      'wrenInsights',
      'wrenMistakes',
      'wrenLessons',
      'wrenCommitments',
      // Usage & Billing
      'users',
      'classEnrollments',
      'usageLedger',
      'voiceSessions',
    ];
    
    // Get local counts
    const localCounts = await this.getRecordCounts(comparisonTables);
    
    // Get peer counts via API
    let peerCounts: Record<string, number> = {};
    const peerUrl = getSyncPeerUrl();
    
    if (isSyncConfigured() && peerUrl) {
      try {
        const verifyPayload = { tables: comparisonTables };
        const response = await fetch(`${peerUrl}/api/sync/verify-counts`, {
          method: 'POST',
          headers: createSyncHeaders(verifyPayload),
          body: JSON.stringify(verifyPayload),
        });
        
        if (response.ok) {
          const data = await response.json();
          peerCounts = data.counts || {};
        } else {
          errors.push(`Peer verification failed: ${response.status}`);
        }
      } catch (err: any) {
        errors.push(`Could not reach peer: ${err.message}`);
      }
    } else {
      errors.push('Sync not configured - cannot fetch peer counts');
    }
    
    // Build comparison
    const comparison = comparisonTables.map(table => {
      const local = localCounts[table] ?? -1;
      const peer = peerCounts[table] ?? -1;
      const difference = local - peer;
      
      let status: 'match' | 'local-ahead' | 'peer-ahead' | 'error' = 'match';
      if (local === -1 || peer === -1) {
        status = 'error';
      } else if (difference > 0) {
        status = 'local-ahead';
      } else if (difference < 0) {
        status = 'peer-ahead';
      }
      
      return { table, localCount: local, peerCount: peer, difference, status };
    });
    
    return {
      localEnvironment: CURRENT_ENVIRONMENT,
      peerEnvironment: CURRENT_ENVIRONMENT === 'development' ? 'production' : 'development',
      comparison,
      errors,
      comparedAt: new Date().toISOString(),
    };
  }
  
  /**
   * v27: Per-batch sync health metrics
   * v32: Now includes import receipts for freshness - when peer pushes to us, that counts as fresh data
   * Returns the last successful sync time for each batch type and staleness warnings
   */
  async getSyncHealth(): Promise<{
    environment: string;
    batches: Array<{
      batchId: string;
      label: string;
      lastSuccessfulPush: string | null;
      lastSuccessfulPull: string | null;
      lastReceivedImport: string | null;
      daysSinceLastPush: number | null;
      daysSinceLastPull: number | null;
      daysSinceLastData: number | null; // v32: min(pull, import)
      pushStatus: 'healthy' | 'stale' | 'critical' | 'never';
      pullStatus: 'healthy' | 'stale' | 'critical' | 'never';
      dataStatus: 'healthy' | 'stale' | 'critical' | 'never'; // v32: Combined status (most recent of pull or import)
    }>;
    queriedAt: string;
  }> {
    // Get all successful/partial sync runs (no time limit - we need to find the LAST successful sync regardless of age)
    // This ensures long-stale batches show as "critical" not "never synced"
    const runs = await db.select({
      id: syncRuns.id,
      direction: syncRuns.direction,
      status: syncRuns.status,
      completedBatches: syncRuns.completedBatches,
      completedAt: syncRuns.completedAt,
      observationCount: syncRuns.observationCount,
    })
      .from(syncRuns)
      .where(sql`${syncRuns.status} IN ('success', 'partial')`)
      .orderBy(desc(syncRuns.completedAt))
      .limit(500); // Limit for performance but no time restriction
    
    // v32: Also get import receipts - when peer pushes to us, that's fresh data too
    const receipts = await db.select({
      batchId: syncImportReceipts.batchId,
      receivedAt: syncImportReceipts.receivedAt,
      recordsReceived: syncImportReceipts.recordsReceived,
    })
      .from(syncImportReceipts)
      .orderBy(desc(syncImportReceipts.receivedAt))
      .limit(500);
    
    // All batch types we care about
    // v30: Environment-aware batch display
    // - "prod-*" and "sofia-telemetry" batches are pulled BY dev FROM production
    // - In production, these should only show push status (when prod exported them)
    // - In dev, these should only show pull status (when dev pulled them)
    const DEV_PULL_ONLY_BATCHES = ['prod-content-growth', 'sofia-telemetry', 'prod-conversations', 'beta-testers'];
    
    const allBatchConfigs: Array<{ id: string; label: string; devPullOnly?: boolean }> = [
      { id: 'neural-core', label: 'Neural Core' },
      { id: 'advanced-intel-a', label: 'Advanced Intel A' },
      { id: 'advanced-intel-b', label: 'Advanced Intel B (Observations)' },
      { id: 'express-lane', label: 'Express Lane' },
      { id: 'hive-snapshots', label: 'Hive Snapshots' },
      { id: 'daniela-memories', label: 'Daniela Memories' },
      { id: 'product-config', label: 'Product Config' },
      { id: 'beta-testers', label: 'Beta Testers', devPullOnly: true },
      { id: 'beta-usage', label: 'Beta Usage' },
      { id: 'founder-context', label: 'Founder Context' },
      { id: 'aggregate-analytics', label: 'Analytics' },
      { id: 'prod-content-growth', label: 'Prod Content Growth', devPullOnly: true },
      { id: 'sofia-telemetry', label: 'Sofia Telemetry', devPullOnly: true },
      { id: 'prod-conversations', label: 'Prod Conversations', devPullOnly: true },
    ];
    
    // In production, filter out dev-pull-only batches from the main list
    // These batches are only relevant for dev to pull from prod
    const batchConfigs = CURRENT_ENVIRONMENT === 'production'
      ? allBatchConfigs.filter(b => !DEV_PULL_ONLY_BATCHES.includes(b.id))
      : allBatchConfigs;
    
    // Calculate per-batch last successful sync times
    const batches = batchConfigs.map(config => {
      // Find last successful push containing this batch
      const lastPush = runs.find(run => 
        run.direction === 'push' && 
        (run.status === 'success' || run.status === 'partial') &&
        run.completedBatches?.includes(config.id)
      );
      
      // For advanced-intel-b, also check observationCount > 0 as additional validation
      const lastPushWithData = config.id === 'advanced-intel-b' 
        ? runs.find(run => 
            run.direction === 'push' && 
            (run.status === 'success' || run.status === 'partial') &&
            (run.completedBatches?.includes(config.id) || (run.observationCount ?? 0) > 0)
          )
        : lastPush;
      
      // Find last successful pull containing this batch
      const lastPull = runs.find(run => 
        run.direction === 'pull' && 
        (run.status === 'success' || run.status === 'partial') &&
        run.completedBatches?.includes(config.id)
      );
      
      const lastPullWithData = config.id === 'advanced-intel-b'
        ? runs.find(run => 
            run.direction === 'pull' && 
            (run.status === 'success' || run.status === 'partial') &&
            (run.completedBatches?.includes(config.id) || (run.observationCount ?? 0) > 0)
          )
        : lastPull;
      
      // v32: Find last import receipt for this batch (peer pushed to us)
      const lastReceipt = receipts.find(r => r.batchId === config.id);
      
      const now = new Date();
      const pushTime = lastPushWithData?.completedAt ? new Date(lastPushWithData.completedAt) : null;
      const pullTime = lastPullWithData?.completedAt ? new Date(lastPullWithData.completedAt) : null;
      const receiptTime = lastReceipt?.receivedAt ? new Date(lastReceipt.receivedAt) : null;
      
      // v32: Data time is the most recent of pull or import receipt
      // This reflects when we last received fresh data, regardless of who initiated
      const dataTime = pullTime && receiptTime 
        ? (pullTime > receiptTime ? pullTime : receiptTime)
        : (pullTime || receiptTime);
      
      const daysSinceLastPush = pushTime 
        ? Math.floor((now.getTime() - pushTime.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const daysSinceLastPull = pullTime
        ? Math.floor((now.getTime() - pullTime.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const daysSinceLastData = dataTime
        ? Math.floor((now.getTime() - dataTime.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      // Status thresholds: healthy < 3 days, stale 3-7 days, critical > 7 days
      const getStatus = (days: number | null): 'healthy' | 'stale' | 'critical' | 'never' => {
        if (days === null) return 'never';
        if (days <= 3) return 'healthy';
        if (days <= 7) return 'stale';
        return 'critical';
      };
      
      return {
        batchId: config.id,
        label: config.label,
        lastSuccessfulPush: pushTime?.toISOString() || null,
        lastSuccessfulPull: pullTime?.toISOString() || null,
        lastReceivedImport: receiptTime?.toISOString() || null,
        daysSinceLastPush,
        daysSinceLastPull,
        daysSinceLastData, // v32: Combined freshness
        pushStatus: getStatus(daysSinceLastPush),
        pullStatus: getStatus(daysSinceLastPull),
        dataStatus: getStatus(daysSinceLastData), // v32: Overall data freshness status
      };
    });
    
    return {
      environment: CURRENT_ENVIRONMENT,
      batches,
      queriedAt: new Date().toISOString(),
    };
  }
  
  /**
   * v28: Get recent verification results for UI display
   * v29: Only show most recent verification per batch type (deduplicated)
   */
  async getRecentVerifications(): Promise<{
    verifications: SyncVerificationResult[];
    queriedAt: string;
  }> {
    // Get recent sync runs that have verification results (ordered by most recent first)
    const runs = await db.select({
      id: syncRuns.id,
      direction: syncRuns.direction,
      verificationResults: syncRuns.verificationResults,
      completedAt: syncRuns.completedAt,
    })
      .from(syncRuns)
      .where(sql`${syncRuns.verificationResults} IS NOT NULL`)
      .orderBy(desc(syncRuns.completedAt))
      .limit(20);
    
    // Deduplicate by batchType - keep only most recent verification per batch
    const latestByBatch = new Map<string, SyncVerificationResult>();
    
    for (const run of runs) {
      if (Array.isArray(run.verificationResults)) {
        for (const v of run.verificationResults as SyncVerificationResult[]) {
          const key = v.batchType;
          // Only add if we haven't seen this batch type yet (first = most recent)
          if (!latestByBatch.has(key)) {
            latestByBatch.set(key, {
              ...v,
              verifiedAt: run.completedAt?.toISOString() || v.verifiedAt,
            });
          }
        }
      }
    }
    
    // Convert map to array, sorted by verifiedAt descending
    const verifications = Array.from(latestByBatch.values())
      .sort((a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime());
    
    return {
      verifications,
      queriedAt: new Date().toISOString(),
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
  
  /**
   * Fetch capabilities from peer environment for version negotiation
   * Returns peer's supported batches, features, and version info
   */
  async fetchPeerCapabilities(): Promise<{
    version: string;
    supportedBatches: readonly string[];
    features: Record<string, boolean>;
    environment: string;
    queriedAt: string;
  } | null> {
    const peerUrl = getSyncPeerUrl();
    if (!peerUrl || !isSyncConfigured()) {
      return null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const requestPayload = { requestedAt: new Date().toISOString() };
      const response = await fetch(`${peerUrl}/api/sync/capabilities`, {
        method: 'POST',
        headers: createSyncHeaders(requestPayload),
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        // Peer may not have capabilities endpoint yet - return null
        console.log(`[SYNC-BRIDGE] Peer capabilities not available (${response.status}) - older version?`);
        return null;
      }
      
      return await response.json();
    } catch (err: any) {
      console.log(`[SYNC-BRIDGE] Failed to fetch peer capabilities: ${err.message}`);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Compare local and peer capabilities to identify mismatches
   * Returns batches that are supported locally but not by peer (and vice versa)
   */
  async compareCapabilities(): Promise<{
    local: {
      version: string;
      supportedBatches: readonly string[];
      features: Record<string, boolean>;
      environment: string;
      queriedAt: string;
    };
    peer: {
      version: string;
      supportedBatches: readonly string[];
      features: Record<string, boolean>;
      environment: string;
      queriedAt: string;
    } | null;
    mismatches: {
      localOnly: string[];
      peerOnly: string[];
      versionMatch: boolean;
    };
  }> {
    const local = this.getCapabilities();
    const peer = await this.fetchPeerCapabilities();
    
    const localBatches = Array.from(SUPPORTED_BATCHES);
    const peerBatches = peer?.supportedBatches ? Array.from(peer.supportedBatches) : [];
    
    const peerBatchSet = new Set(peerBatches);
    const localBatchSet = new Set(localBatches);
    
    const localOnly = localBatches.filter(b => !peerBatchSet.has(b));
    const peerOnly = peerBatches.filter(b => !localBatchSet.has(b as typeof SUPPORTED_BATCHES[number]));
    
    return {
      local,
      peer,
      mismatches: {
        localOnly,
        peerOnly,
        versionMatch: local.version === peer?.version,
      },
    };
  }
  
  async fetchPeerStats(): Promise<{
    environment: string;
    counts: {
      danielaGrowthMemories: number;
      hiveSnapshots: number;
      collaborationMessages: number;
      users: number;
      tutorVoices: number;
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
   * Trigger the PEER environment to pull from us (full bidirectional sync)
   * This calls prod's /api/sync/trigger-pull endpoint to initiate a pull on their side
   */
  async triggerPeerPull(triggeredBy: string = 'agent'): Promise<{ success: boolean; message: string; peerResult?: any }> {
    const peerUrl = getSyncPeerUrl();
    if (!peerUrl || !isSyncConfigured()) {
      return {
        success: false,
        message: 'Sync not configured - set SYNC_PEER_URL and SYNC_SHARED_SECRET',
      };
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2min timeout for full sync
    
    try {
      console.log(`[SYNC-BRIDGE] Triggering peer pull on ${peerUrl}...`);
      const requestPayload = { triggeredBy, requestedAt: new Date().toISOString() };
      const response = await fetch(`${peerUrl}/api/sync/trigger-pull`, {
        method: 'POST',
        headers: createSyncHeaders(requestPayload),
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Peer returned ${response.status}: ${errorText.substring(0, 200)}`,
        };
      }
      
      const peerResult = await response.json();
      console.log(`[SYNC-BRIDGE] Peer pull triggered successfully:`, JSON.stringify(peerResult).substring(0, 200));
      return {
        success: true,
        message: `Successfully triggered peer to pull from us`,
        peerResult,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Request to peer timed out after 2min' };
      }
      return { success: false, message: err.message };
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Force-reset stuck syncs on the PEER environment
   * This calls prod's /api/sync/trigger-force-reset to clear their stuck runs
   */
  async triggerPeerForceReset(triggeredBy: string = 'agent'): Promise<{ success: boolean; message: string; peerResult?: any }> {
    const peerUrl = getSyncPeerUrl();
    if (!peerUrl || !isSyncConfigured()) {
      return {
        success: false,
        message: 'Sync not configured - set SYNC_PEER_URL and SYNC_SHARED_SECRET',
      };
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    try {
      console.log(`[SYNC-BRIDGE] Triggering peer force-reset on ${peerUrl}...`);
      const requestPayload = { triggeredBy, requestedAt: new Date().toISOString() };
      const response = await fetch(`${peerUrl}/api/sync/trigger-force-reset`, {
        method: 'POST',
        headers: createSyncHeaders(requestPayload),
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Peer returned ${response.status}: ${errorText.substring(0, 200)}`,
        };
      }
      
      const peerResult = await response.json();
      console.log(`[SYNC-BRIDGE] Peer force-reset completed:`, peerResult);
      return {
        success: true,
        message: `Successfully reset stuck syncs on peer`,
        peerResult,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Request to peer timed out after 15s' };
      }
      return { success: false, message: err.message };
    } finally {
      clearTimeout(timeoutId);
    }
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
  
  // ===== v18: New Import Helper Methods =====
  
  async importCurriculumPath(path: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(curriculumPaths).where(eq(curriculumPaths.id, path.id)).limit(1);
      if (existing.length > 0) {
        await db.update(curriculumPaths).set({
          name: path.name,
          description: path.description,
          language: path.language,
          targetAudience: path.targetAudience,
          startLevel: path.startLevel,
          endLevel: path.endLevel,
          estimatedHours: path.estimatedHours,
          isPublished: path.isPublished,
          updatedAt: new Date(),
        }).where(eq(curriculumPaths.id, path.id));
      } else {
        await db.insert(curriculumPaths).values({
          ...path,
          createdAt: new Date(path.createdAt),
          updatedAt: new Date(),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importCurriculumUnit(unit: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(curriculumUnits).where(eq(curriculumUnits.id, unit.id)).limit(1);
      if (existing.length > 0) {
        await db.update(curriculumUnits).set({
          curriculumPathId: unit.curriculumPathId,
          name: unit.name,
          description: unit.description,
          orderIndex: unit.orderIndex,
          actflLevel: unit.actflLevel,
          culturalTheme: unit.culturalTheme,
          estimatedHours: unit.estimatedHours,
          commitments: unit.commitments,
        }).where(eq(curriculumUnits.id, unit.id));
      } else {
        await db.insert(curriculumUnits).values(unit);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importCurriculumLesson(lesson: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(curriculumLessons).where(eq(curriculumLessons.id, lesson.id)).limit(1);
      if (existing.length > 0) {
        await db.update(curriculumLessons).set({
          curriculumUnitId: lesson.curriculumUnitId,
          name: lesson.name,
          description: lesson.description,
          orderIndex: lesson.orderIndex,
          lessonType: lesson.lessonType,
          actflLevel: lesson.actflLevel,
          prerequisiteLessonId: lesson.prerequisiteLessonId,
          conversationTopic: lesson.conversationTopic,
          conversationPrompt: lesson.conversationPrompt,
          objectives: lesson.objectives,
          estimatedMinutes: lesson.estimatedMinutes,
          requiredTopics: lesson.requiredTopics,
          requiredVocabulary: lesson.requiredVocabulary,
          requiredGrammar: lesson.requiredGrammar,
          minPronunciationScore: lesson.minPronunciationScore,
          requirementTier: lesson.requirementTier,
          bundleId: lesson.bundleId,
        }).where(eq(curriculumLessons.id, lesson.id));
      } else {
        await db.insert(curriculumLessons).values(lesson);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importTopic(topic: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(topics).where(eq(topics.id, topic.id)).limit(1);
      if (existing.length > 0) {
        await db.update(topics).set({
          name: topic.name,
          description: topic.description,
          topicType: topic.topicType,
          category: topic.category,
          icon: topic.icon,
          samplePhrases: topic.samplePhrases,
          difficulty: topic.difficulty,
          grammarConcept: topic.grammarConcept,
          applicableLanguages: topic.applicableLanguages,
          actflLevelRange: topic.actflLevelRange,
        }).where(eq(topics.id, topic.id));
      } else {
        await db.insert(topics).values(topic);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importCurriculumDrillItem(drill: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(curriculumDrillItems).where(eq(curriculumDrillItems.id, drill.id)).limit(1);
      if (existing.length > 0) {
        await db.update(curriculumDrillItems).set({
          lessonId: drill.lessonId,
          itemType: drill.itemType,
          orderIndex: drill.orderIndex,
          prompt: drill.prompt,
          targetText: drill.targetText,
          targetLanguage: drill.targetLanguage,
          audioUrl: drill.audioUrl,
          audioDurationMs: drill.audioDurationMs,
          audioUrlFemale: drill.audioUrlFemale,
          audioUrlMale: drill.audioUrlMale,
          hints: drill.hints,
          acceptableAlternatives: drill.acceptableAlternatives,
          difficulty: drill.difficulty,
          tags: drill.tags,
          updatedAt: new Date(),
        }).where(eq(curriculumDrillItems.id, drill.id));
      } else {
        await db.insert(curriculumDrillItems).values({
          ...drill,
          createdAt: new Date(drill.createdAt || new Date()),
          updatedAt: new Date(),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importGrammarExercise(grammar: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(grammarExercises).where(eq(grammarExercises.id, grammar.id)).limit(1);
      if (existing.length > 0) {
        await db.update(grammarExercises).set({
          language: grammar.language,
          difficulty: grammar.difficulty,
          actflLevel: grammar.actflLevel,
          competencyId: grammar.competencyId,
          question: grammar.question,
          options: grammar.options,
          correctAnswer: grammar.correctAnswer,
          explanation: grammar.explanation,
          exerciseType: grammar.exerciseType,
          hint: grammar.hint,
        }).where(eq(grammarExercises.id, grammar.id));
      } else {
        await db.insert(grammarExercises).values({
          ...grammar,
          createdAt: new Date(grammar.createdAt || new Date()),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  /**
   * v33: Import grammar competency (skill definition per language)
   */
  async importGrammarCompetency(comp: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(grammarCompetencies).where(eq(grammarCompetencies.id, comp.id)).limit(1);
      if (existing.length > 0) {
        await db.update(grammarCompetencies).set({
          language: comp.language,
          category: comp.category,
          name: comp.name,
          slug: comp.slug,
          subcategory: comp.subcategory,
          description: comp.description,
          shortExplanation: comp.shortExplanation,
          actflLevel: comp.actflLevel,
          actflLevelNumeric: comp.actflLevelNumeric,
          examples: comp.examples,
          commonMistakes: comp.commonMistakes,
          prerequisiteIds: comp.prerequisiteIds,
          difficultyScore: comp.difficultyScore,
          estimatedMinutes: comp.estimatedMinutes,
        }).where(eq(grammarCompetencies.id, comp.id));
      } else {
        await db.insert(grammarCompetencies).values({
          ...comp,
          createdAt: new Date(comp.createdAt || new Date()),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importCanDoStatement(canDo: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(canDoStatements).where(eq(canDoStatements.id, canDo.id)).limit(1);
      if (existing.length > 0) {
        await db.update(canDoStatements).set({
          language: canDo.language,
          actflLevel: canDo.actflLevel,
          category: canDo.category,
          mode: canDo.mode,
          statement: canDo.statement,
          description: canDo.description,
        }).where(eq(canDoStatements.id, canDo.id));
      } else {
        await db.insert(canDoStatements).values(canDo);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importCulturalTip(tip: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(culturalTips).where(eq(culturalTips.id, tip.id)).limit(1);
      if (existing.length > 0) {
        await db.update(culturalTips).set({
          language: tip.language,
          category: tip.category,
          title: tip.title,
          content: tip.content,
          context: tip.context,
          relatedTopics: tip.relatedTopics,
        }).where(eq(culturalTips.id, tip.id));
      } else {
        await db.insert(culturalTips).values(tip);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  /**
   * v33: Import lesson-to-CanDo link (fluency wiring)
   * These link curriculum lessons to ACTFL Can-Do statements
   */
  async importLessonCanDoStatement(link: any): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if this link already exists
      const existing = await db.select()
        .from(lessonCanDoStatements)
        .where(eq(lessonCanDoStatements.id, link.id))
        .limit(1);
      
      if (existing.length === 0) {
        // Insert new link
        await db.insert(lessonCanDoStatements).values({
          id: link.id,
          lessonId: link.lessonId,
          canDoStatementId: link.canDoStatementId,
        });
      }
      // Links don't need updates - they're just ID relationships
      return { success: true };
    } catch (err: any) {
      // Skip duplicates silently (FK constraint or unique constraint)
      if (err.message?.includes('duplicate') || err.message?.includes('violates')) {
        return { success: true };
      }
      return { success: false, error: err.message };
    }
  }
  
  /**
   * v33: Import lesson-to-cultural-tip link
   */
  async importLessonCulturalTip(link: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select()
        .from(lessonCulturalTips)
        .where(eq(lessonCulturalTips.id, link.id))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(lessonCulturalTips).values({
          id: link.id,
          lessonId: link.lessonId,
          culturalTipId: link.culturalTipId,
        });
      }
      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('violates')) {
        return { success: true };
      }
      return { success: false, error: err.message };
    }
  }
  
  /**
   * v33: Import lesson visual aid
   */
  async importLessonVisualAid(aid: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select()
        .from(lessonVisualAids)
        .where(eq(lessonVisualAids.id, aid.id))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(lessonVisualAids).set({
          lessonId: aid.lessonId,
          mediaFileId: aid.mediaFileId,
          title: aid.title,
          description: aid.description,
          displayOrder: aid.displayOrder,
          isRequired: aid.isRequired,
        }).where(eq(lessonVisualAids.id, aid.id));
      } else {
        await db.insert(lessonVisualAids).values({
          ...aid,
          createdAt: new Date(aid.createdAt || new Date()),
        });
      }
      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('violates')) {
        return { success: true };
      }
      return { success: false, error: err.message };
    }
  }
  
  /**
   * v33: Import cultural tip media
   */
  async importCulturalTipMedia(media: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select()
        .from(culturalTipMedia)
        .where(eq(culturalTipMedia.id, media.id))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(culturalTipMedia).set({
          culturalTipId: media.culturalTipId,
          language: media.language,
          mediaFileId: media.mediaFileId,
          title: media.title,
          caption: media.caption,
          category: media.category,
          region: media.region,
          tags: media.tags,
          displayOrder: media.displayOrder,
          isFeatured: media.isFeatured,
        }).where(eq(culturalTipMedia.id, media.id));
      } else {
        await db.insert(culturalTipMedia).values({
          ...media,
          createdAt: new Date(media.createdAt || new Date()),
        });
      }
      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('violates')) {
        return { success: true };
      }
      return { success: false, error: err.message };
    }
  }
  
  /**
   * v33: Import class hour package (pricing)
   */
  async importClassHourPackage(pkg: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select()
        .from(classHourPackages)
        .where(eq(classHourPackages.id, pkg.id))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(classHourPackages).set({
          name: pkg.name,
          hoursPerStudent: pkg.hoursPerStudent,
          totalPurchasedHours: pkg.totalPurchasedHours,
          usedHours: pkg.usedHours,
          pricePerStudent: pkg.pricePerStudent,
          purchasedAt: pkg.purchasedAt ? new Date(pkg.purchasedAt) : null,
          expiresAt: pkg.expiresAt ? new Date(pkg.expiresAt) : null,
          purchaserId: pkg.purchaserId,
          status: pkg.status,
          stripeSubscriptionId: pkg.stripeSubscriptionId,
          metadata: pkg.metadata,
          updatedAt: new Date(),
        }).where(eq(classHourPackages.id, pkg.id));
      } else {
        await db.insert(classHourPackages).values({
          ...pkg,
          purchasedAt: pkg.purchasedAt ? new Date(pkg.purchasedAt) : new Date(),
          expiresAt: pkg.expiresAt ? new Date(pkg.expiresAt) : null,
          createdAt: new Date(pkg.createdAt || new Date()),
          updatedAt: new Date(pkg.updatedAt || new Date()),
        });
      }
      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('violates')) {
        return { success: true };
      }
      return { success: false, error: err.message };
    }
  }
  
  async importWrenInsight(insight: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenInsights).where(eq(wrenInsights.id, insight.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenInsights).values({
          ...insight,
          createdAt: new Date(insight.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importWrenProactiveTrigger(trigger: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenProactiveTriggers).where(eq(wrenProactiveTriggers.id, trigger.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenProactiveTriggers).values({
          ...trigger,
          createdAt: new Date(trigger.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importArchitecturalDecisionRecord(adr: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(architecturalDecisionRecords).where(eq(architecturalDecisionRecords.id, adr.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(architecturalDecisionRecords).values({
          ...adr,
          createdAt: new Date(adr.createdAt),
          updatedAt: adr.updatedAt ? new Date(adr.updatedAt) : null,
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importWrenMistake(mistake: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenMistakes).where(eq(wrenMistakes.id, mistake.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenMistakes).values({
          ...mistake,
          createdAt: new Date(mistake.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importWrenLesson(lesson: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenLessons).where(eq(wrenLessons.id, lesson.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenLessons).values({
          ...lesson,
          createdAt: new Date(lesson.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importWrenCommitment(commitment: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenCommitments).where(eq(wrenCommitments.id, commitment.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenCommitments).values({
          ...commitment,
          createdAt: new Date(commitment.createdAt),
          completedAt: commitment.completedAt ? new Date(commitment.completedAt) : null,
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importDanielaRecommendation(rec: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(danielaRecommendations).where(eq(danielaRecommendations.id, rec.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(danielaRecommendations).values({
          ...rec,
          createdAt: new Date(rec.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importDanielaFeatureFeedback(feedback: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(danielaFeatureFeedback).where(eq(danielaFeatureFeedback.id, feedback.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(danielaFeatureFeedback).values({
          ...feedback,
          createdAt: new Date(feedback.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  // Extended Wren import methods (v24+)
  async importWrenMistakeResolution(resolution: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenMistakeResolutions).where(eq(wrenMistakeResolutions.id, resolution.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenMistakeResolutions).values({
          ...resolution,
          createdAt: new Date(resolution.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importWrenSessionNote(note: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenSessionNotes).where(eq(wrenSessionNotes.id, note.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenSessionNotes).values({
          ...note,
          createdAt: new Date(note.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importWrenPrediction(prediction: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenPredictions).where(eq(wrenPredictions.id, prediction.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenPredictions).values({
          ...prediction,
          createdAt: new Date(prediction.createdAt),
          evaluatedAt: prediction.evaluatedAt ? new Date(prediction.evaluatedAt) : null,
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importWrenConfidenceRecord(record: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenConfidenceRecords).where(eq(wrenConfidenceRecords.id, record.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenConfidenceRecords).values({
          ...record,
          createdAt: new Date(record.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importWrenCalibrationStat(stat: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(wrenCalibrationStats).where(eq(wrenCalibrationStats.id, stat.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(wrenCalibrationStats).values({
          ...stat,
          calculatedAt: new Date(stat.calculatedAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  // Extended Daniela import methods (v24+)
  async importDanielaBeacon(beacon: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(danielaBeacons).where(eq(danielaBeacons.id, beacon.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(danielaBeacons).values({
          ...beacon,
          createdAt: new Date(beacon.createdAt),
          expiresAt: beacon.expiresAt ? new Date(beacon.expiresAt) : null,
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  async importSynthesizedInsight(insight: any): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await db.select().from(synthesizedInsights).where(eq(synthesizedInsights.id, insight.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(synthesizedInsights).values({
          ...insight,
          createdAt: new Date(insight.createdAt),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Import beta testers with merge-by-email logic
   * If user exists in production (same email), merge credits and enrollments
   * If user doesn't exist, create user and add credits
   * v23: Now supports direct enrollment sync (for Replit auth users who already exist)
   * v35: OPTIMIZED - Uses bulk preload and batched inserts to reduce ~2000 queries to ~20
   * v35.1: FIXES - Preserve joinCode, correct enrollment preload timing, accurate counts
   */
  async importBetaTesters(testers: any[], credits: any[], directEnrollments: any[] = [], classes: any[] = []): Promise<{ usersImported: number; creditsImported: number; enrollmentsCreated: number; classesImported: number; errors: string[] }> {
    const startTime = Date.now();
    let usersImported = 0;
    let creditsImported = 0;
    let enrollmentsCreated = 0;
    let classesImported = 0;
    const errors: string[] = [];
    
    console.log(`[SYNC-BRIDGE v35.1] Starting optimized beta tester import: ${testers.length} testers, ${credits.length} credits, ${directEnrollments.length} enrollments, ${classes.length} classes`);
    
    // STEP 1: Bulk preload existing data (3 queries - enrollments done later after user mapping)
    const classIds = classes.map(c => c.id).filter(Boolean);
    const testerEmails = testers.map(t => t.email).filter(Boolean);
    const creditIds = credits.map(c => c.id).filter(Boolean);
    
    // Preload existing classes (full row to preserve joinCode on update)
    const existingClassesFullData = classIds.length > 0 
      ? await db.select().from(teacherClasses).where(inArray(teacherClasses.id, classIds))
      : [];
    const existingClassIds = new Set(existingClassesFullData.map(c => c.id));
    const existingClassJoinCodes = new Map(existingClassesFullData.map(c => [c.id, c.joinCode]));
    
    // Preload existing users by email (for merge logic)
    const existingUsers = testerEmails.length > 0
      ? await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.email, testerEmails))
      : [];
    const existingUsersByEmail = new Map(existingUsers.map(u => [u.email, u.id]));
    
    // Preload existing credits
    const existingCredits = creditIds.length > 0
      ? await db.select({ id: usageLedger.id }).from(usageLedger).where(inArray(usageLedger.id, creditIds))
      : [];
    const existingCreditIds = new Set(existingCredits.map(c => c.id));
    
    console.log(`[SYNC-BRIDGE v35.1] Preloaded: ${existingClassIds.size} classes, ${existingUsersByEmail.size} users, ${existingCreditIds.size} credits`);
    
    // STEP 2: Bulk import classes (split into insert/update batches)
    // v35.1: Preserve existing joinCode when updating
    if (classes.length > 0) {
      const classesToInsert = classes.filter(c => !existingClassIds.has(c.id));
      const classesToUpdate = classes.filter(c => existingClassIds.has(c.id));
      
      // Bulk insert new classes
      if (classesToInsert.length > 0) {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < classesToInsert.length; i += CHUNK_SIZE) {
          const chunk = classesToInsert.slice(i, i + CHUNK_SIZE);
          try {
            await db.insert(teacherClasses).values(chunk.map(cls => ({
              id: cls.id,
              teacherId: cls.teacherId,
              name: cls.name,
              description: cls.description,
              language: cls.language,
              classLevel: cls.classLevel ?? cls.difficultyLevel,
              curriculumPathId: cls.curriculumPathId ?? cls.curriculumTemplateId,
              joinCode: cls.joinCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
              isActive: cls.isActive ?? true,
              isPublicCatalogue: cls.isPublicCatalogue ?? false,
              expectedActflMin: cls.expectedActflMin,
              targetActflLevel: cls.targetActflLevel,
              classTypeId: cls.classTypeId,
              isFeatured: cls.isFeatured,
              featuredOrder: cls.featuredOrder,
            }))).onConflictDoNothing();
            classesImported += chunk.length;
          } catch (err: any) {
            errors.push(`Bulk class insert: ${err.message}`);
          }
        }
      }
      
      // Update existing classes - v35.1: DO NOT overwrite joinCode
      for (const cls of classesToUpdate) {
        try {
          await db.update(teacherClasses).set({
            name: cls.name,
            description: cls.description,
            language: cls.language,
            classLevel: cls.classLevel ?? cls.difficultyLevel,
            curriculumPathId: cls.curriculumPathId ?? cls.curriculumTemplateId,
            isActive: cls.isActive ?? true,
            isPublicCatalogue: cls.isPublicCatalogue ?? false,
            expectedActflMin: cls.expectedActflMin,
            targetActflLevel: cls.targetActflLevel,
            classTypeId: cls.classTypeId,
            isFeatured: cls.isFeatured,
            featuredOrder: cls.featuredOrder,
            // v35.1: Preserve existing joinCode - only update if explicitly provided and different
            ...(cls.joinCode && cls.joinCode !== existingClassJoinCodes.get(cls.id) ? { joinCode: cls.joinCode } : {}),
          }).where(eq(teacherClasses.id, cls.id));
          classesImported++;
        } catch (err: any) {
          errors.push(`Class update ${cls.id}: ${err.message}`);
        }
      }
      console.log(`[SYNC-BRIDGE v35.1] Classes: ${classesToInsert.length} inserted, ${classesToUpdate.length} updated`);
    }
    
    // STEP 3: Process users and build ID mapping (source → target)
    const userIdMapping = new Map<string, string>(); // sourceId → targetId
    
    // Build mapping for existing users first (they already exist, just need mapping)
    testers.forEach(t => {
      if (existingUsersByEmail.has(t.email)) {
        userIdMapping.set(t.id, existingUsersByEmail.get(t.email)!);
      } else {
        // New users will use their source ID
        userIdMapping.set(t.id, t.id);
      }
    });
    
    // Insert new users in bulk
    const usersToInsert = testers.filter(t => !existingUsersByEmail.has(t.email));
    if (usersToInsert.length > 0) {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < usersToInsert.length; i += CHUNK_SIZE) {
        const chunk = usersToInsert.slice(i, i + CHUNK_SIZE);
        try {
          await db.insert(users).values(chunk.map(tester => ({
            id: tester.id,
            email: tester.email,
            firstName: tester.firstName,
            lastName: tester.lastName,
            profileImageUrl: tester.profileImageUrl,
            isBetaTester: true,
            authProvider: tester.authProvider || 'password',
            createdAt: new Date(tester.createdAt),
            updatedAt: new Date(),
          }))).onConflictDoNothing();
          usersImported += chunk.length;
        } catch (err: any) {
          errors.push(`Bulk user insert: ${err.message}`);
        }
      }
    }
    
    // Update existing users to have beta tester flag
    const usersToUpdate = testers.filter(t => existingUsersByEmail.has(t.email));
    if (usersToUpdate.length > 0) {
      const targetIds = usersToUpdate.map(t => existingUsersByEmail.get(t.email)!);
      try {
        await db.update(users).set({ isBetaTester: true }).where(inArray(users.id, targetIds));
        usersImported += usersToUpdate.length;
      } catch (err: any) {
        errors.push(`Bulk user update: ${err.message}`);
      }
    }
    
    console.log(`[SYNC-BRIDGE v35.1] Users: ${usersToInsert.length} inserted, ${usersToUpdate.length} updated, ${userIdMapping.size} mapped`);
    
    // STEP 4: Preload existing enrollments AFTER we know target user IDs
    // v35.1: Query with resolved target IDs for accurate duplicate detection
    const allTargetUserIds = Array.from(new Set(Array.from(userIdMapping.values())));
    const existingEnrollments = allTargetUserIds.length > 0
      ? await db.select({ classId: classEnrollments.classId, studentId: classEnrollments.studentId })
          .from(classEnrollments).where(inArray(classEnrollments.studentId, allTargetUserIds))
      : [];
    const existingEnrollmentKeys = new Set(existingEnrollments.map(e => `${e.classId}:${e.studentId}`));
    console.log(`[SYNC-BRIDGE v35.1] Preloaded ${existingEnrollmentKeys.size} existing enrollments for ${allTargetUserIds.length} target users`);
    
    // STEP 5: Bulk import enrollments
    // Build maps for quick lookup
    const enrollmentsByUserId = new Map<string, any[]>();
    for (const enrollment of directEnrollments) {
      const userEnrollments = enrollmentsByUserId.get(enrollment.studentId) || [];
      userEnrollments.push(enrollment);
      enrollmentsByUserId.set(enrollment.studentId, userEnrollments);
    }
    
    // Get public classes for auto-enrollment fallback
    const publicClasses = await db.select().from(teacherClasses)
      .where(and(eq(teacherClasses.isPublicCatalogue, true), eq(teacherClasses.isActive, true)));
    
    // Collect all enrollments to insert (using target user IDs)
    const enrollmentsToInsert: Array<{ classId: string; studentId: string; isActive: boolean; allocatedSeconds?: number; usedSeconds?: number }> = [];
    
    for (const tester of testers) {
      const targetUserId = userIdMapping.get(tester.id)!;
      const userDirectEnrollments = enrollmentsByUserId.get(tester.id) || [];
      
      if (userDirectEnrollments.length > 0) {
        for (const enrollment of userDirectEnrollments) {
          const key = `${enrollment.classId}:${targetUserId}`;
          if (!existingEnrollmentKeys.has(key)) {
            enrollmentsToInsert.push({
              classId: enrollment.classId,
              studentId: targetUserId,
              isActive: enrollment.isActive ?? true,
              allocatedSeconds: enrollment.allocatedSeconds,
              usedSeconds: enrollment.usedSeconds,
            });
            existingEnrollmentKeys.add(key); // Prevent duplicates within batch
          }
        }
      } else {
        // Auto-enroll in public classes
        for (const publicClass of publicClasses) {
          const key = `${publicClass.id}:${targetUserId}`;
          if (!existingEnrollmentKeys.has(key)) {
            enrollmentsToInsert.push({
              classId: publicClass.id,
              studentId: targetUserId,
              isActive: true,
            });
            existingEnrollmentKeys.add(key);
          }
        }
      }
    }
    
    // Bulk insert enrollments
    if (enrollmentsToInsert.length > 0) {
      const CHUNK_SIZE = 200;
      for (let i = 0; i < enrollmentsToInsert.length; i += CHUNK_SIZE) {
        const chunk = enrollmentsToInsert.slice(i, i + CHUNK_SIZE);
        try {
          await db.insert(classEnrollments).values(chunk).onConflictDoNothing();
          enrollmentsCreated += chunk.length;
        } catch (err: any) {
          errors.push(`Bulk enrollment insert: ${err.message}`);
        }
      }
    }
    console.log(`[SYNC-BRIDGE v35.1] Enrollments: ${enrollmentsToInsert.length} inserted`);
    
    // STEP 6: Bulk import credits (with remapped user IDs)
    const creditsToInsert = credits.filter(c => !existingCreditIds.has(c.id));
    if (creditsToInsert.length > 0) {
      const CHUNK_SIZE = 200;
      for (let i = 0; i < creditsToInsert.length; i += CHUNK_SIZE) {
        const chunk = creditsToInsert.slice(i, i + CHUNK_SIZE);
        try {
          await db.insert(usageLedger).values(chunk.map(credit => {
            // v35.1: Use mapped target user ID for correct ownership
            const targetUserId = userIdMapping.get(credit.userId) || credit.userId;
            return {
              id: credit.id,
              userId: targetUserId,
              creditSeconds: credit.creditSeconds,
              entitlementType: credit.entitlementType,
              description: credit.description,
              stripePaymentId: credit.stripePaymentId,
              classId: null, // Skip FK references
              voiceSessionId: null,
              createdAt: new Date(credit.createdAt),
              expiresAt: credit.expiresAt ? new Date(credit.expiresAt) : null,
            };
          })).onConflictDoNothing();
          creditsImported += chunk.length;
        } catch (err: any) {
          errors.push(`Bulk credit insert: ${err.message}`);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[SYNC-BRIDGE v35.1] Beta testers import complete in ${duration}ms: ${usersImported} users, ${creditsImported} credits, ${enrollmentsCreated} enrollments, ${classesImported} classes`);
    return { usersImported, creditsImported, enrollmentsCreated, classesImported, errors };
  }

  /**
   * v32: Record a sync anomaly for alerting and visibility
   * Anomalies are surfaced in the admin dashboard
   */
  async recordSyncAnomaly(params: {
    type: 'zero-count-success' | 'stale-batch' | 'failed-sync' | 'missing-receipt' | 'checksum-mismatch';
    severity: 'warning' | 'critical';
    batchId?: string;
    syncRunId?: string;
    message: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await db.insert(syncAnomalies).values({
        type: params.type,
        severity: params.severity,
        batchId: params.batchId || null,
        syncRunId: params.syncRunId || null,
        message: params.message,
        metadata: params.metadata || null,
      });
      console.log(`[SYNC-BRIDGE v32] Recorded anomaly: ${params.type} - ${params.message}`);
    } catch (err: any) {
      console.error(`[SYNC-BRIDGE v32] Failed to record anomaly: ${err.message}`);
    }
  }
  
  /**
   * v32: Record receipt when this environment receives data from a peer push
   * This gives the dashboard visibility into what the peer has sent us
   */
  async recordImportReceipt(params: {
    batchId: string;
    sourceEnvironment: 'development' | 'production';
    sourceRunId?: string;
    recordsReceived: number;
    checksumMatch?: boolean;
  }): Promise<void> {
    try {
      await db.insert(syncImportReceipts).values({
        batchId: params.batchId,
        sourceEnvironment: params.sourceEnvironment,
        sourceRunId: params.sourceRunId || null,
        recordsReceived: params.recordsReceived,
        checksumMatch: params.checksumMatch ?? true,
      });
      console.log(`[SYNC-BRIDGE v32] Recorded import receipt: ${params.batchId} from ${params.sourceEnvironment} (${params.recordsReceived} records)`);
    } catch (err: any) {
      console.error(`[SYNC-BRIDGE v32] Failed to record import receipt: ${err.message}`);
    }
  }
  
  /**
   * v32: Get unacknowledged anomalies for dashboard display
   */
  async getUnacknowledgedAnomalies(): Promise<SyncAnomaly[]> {
    return await db.select()
      .from(syncAnomalies)
      .where(and(
        eq(syncAnomalies.acknowledged, false),
        isNull(syncAnomalies.resolvedAt)
      ))
      .orderBy(desc(syncAnomalies.createdAt))
      .limit(50);
  }
  
  /**
   * v32: Acknowledge an anomaly (admin has seen it)
   */
  async acknowledgeAnomaly(anomalyId: string, acknowledgedBy: string): Promise<void> {
    await db.update(syncAnomalies)
      .set({
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      })
      .where(eq(syncAnomalies.id, anomalyId));
  }
  
  /**
   * v32: Get recent import receipts for health dashboard
   * Combines with local sync runs to give accurate health picture
   */
  async getRecentImportReceipts(limit: number = 50): Promise<SyncImportReceipt[]> {
    return await db.select()
      .from(syncImportReceipts)
      .orderBy(desc(syncImportReceipts.receivedAt))
      .limit(limit);
  }
  
  /**
   * v32: Enhanced sync health that includes received imports
   * This gives accurate freshness even when peer pushes to us
   */
  async getEnhancedSyncHealth(): Promise<{
    environment: string;
    batches: Array<{
      batchId: string;
      label: string;
      lastLocalPush: string | null;
      lastLocalPull: string | null;
      lastReceivedImport: string | null;
      lastActivity: string | null;
      daysSinceLastActivity: number | null;
      status: 'healthy' | 'stale' | 'critical' | 'never';
      recordsInLastSync: number;
    }>;
    anomalyCount: number;
    queriedAt: string;
  }> {
    // Get local sync runs and import receipts
    const [runs, receipts, anomalies] = await Promise.all([
      db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(100),
      db.select().from(syncImportReceipts).orderBy(desc(syncImportReceipts.receivedAt)).limit(100),
      this.getUnacknowledgedAnomalies(),
    ]);
    
    // Use the same batch config as getSyncHealth
    const DEV_PULL_ONLY_BATCHES = ['prod-content-growth', 'sofia-telemetry', 'prod-conversations', 'beta-testers'];
    const allBatchConfigs: Array<{ id: string; label: string }> = [
      { id: 'neural-core', label: 'Neural Core' },
      { id: 'advanced-intel-a', label: 'Advanced Intel A' },
      { id: 'advanced-intel-b', label: 'Advanced Intel B (Observations)' },
      { id: 'express-lane', label: 'Express Lane' },
      { id: 'hive-snapshots', label: 'Hive Snapshots' },
      { id: 'daniela-memories', label: 'Daniela Memories' },
      { id: 'product-config', label: 'Product Config' },
      { id: 'beta-testers', label: 'Beta Testers' },
      { id: 'beta-usage', label: 'Beta Usage' },
      { id: 'founder-context', label: 'Founder Context' },
      { id: 'aggregate-analytics', label: 'Analytics' },
      { id: 'prod-content-growth', label: 'Prod Content Growth' },
      { id: 'sofia-telemetry', label: 'Sofia Telemetry' },
      { id: 'prod-conversations', label: 'Prod Conversations' },
    ];
    
    const batchConfigs = CURRENT_ENVIRONMENT === 'production'
      ? allBatchConfigs.filter(b => !DEV_PULL_ONLY_BATCHES.includes(b.id))
      : allBatchConfigs;
    
    const batches = batchConfigs.map(config => {
      // Find last successful push/pull for this batch
      const lastPush = runs.find(run => 
        run.direction === 'push' && 
        (run.status === 'success' || run.status === 'partial') &&
        run.completedBatches?.includes(config.id)
      );
      
      const lastPull = runs.find(run => 
        run.direction === 'pull' && 
        (run.status === 'success' || run.status === 'partial') &&
        run.completedBatches?.includes(config.id)
      );
      
      // Find last received import for this batch
      const lastReceipt = receipts.find(r => r.batchId === config.id);
      
      const now = new Date();
      const pushTime = lastPush?.completedAt ? new Date(lastPush.completedAt) : null;
      const pullTime = lastPull?.completedAt ? new Date(lastPull.completedAt) : null;
      const receiptTime = lastReceipt?.receivedAt ? new Date(lastReceipt.receivedAt) : null;
      
      // Last activity is the most recent of push, pull, or received import
      const times = [pushTime, pullTime, receiptTime].filter(Boolean) as Date[];
      const lastActivityTime = times.length > 0 ? new Date(Math.max(...times.map(t => t.getTime()))) : null;
      
      const daysSinceLastActivity = lastActivityTime 
        ? Math.floor((now.getTime() - lastActivityTime.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      const getStatus = (days: number | null): 'healthy' | 'stale' | 'critical' | 'never' => {
        if (days === null) return 'never';
        if (days <= 3) return 'healthy';
        if (days <= 7) return 'stale';
        return 'critical';
      };
      
      // Get records from last successful sync
      const lastSuccessfulRun = lastPush || lastPull;
      const recordsInLastSync = lastSuccessfulRun?.recordsChanged || 0;
      
      return {
        batchId: config.id,
        label: config.label,
        lastLocalPush: pushTime?.toISOString() || null,
        lastLocalPull: pullTime?.toISOString() || null,
        lastReceivedImport: receiptTime?.toISOString() || null,
        lastActivity: lastActivityTime?.toISOString() || null,
        daysSinceLastActivity,
        status: getStatus(daysSinceLastActivity),
        recordsInLastSync,
      };
    });
    
    return {
      environment: CURRENT_ENVIRONMENT,
      batches,
      anomalyCount: anomalies.length,
      queriedAt: new Date().toISOString(),
    };
  }

  /**
   * Clean up orphaned sync runs immediately on server startup.
   * Unlike cleanupOrphanedSyncRuns (which waits 2 hours), this marks
   * ALL "running" syncs as failed since a server restart means they're dead.
   */
  async cleanupOnStartup(): Promise<number> {
    const orphanedRuns = await db.select()
      .from(syncRuns)
      .where(eq(syncRuns.status, 'running'));
    
    if (orphanedRuns.length === 0) {
      console.log(`[SYNC-BRIDGE] Startup cleanup: no orphaned sync runs found`);
      return 0;
    }
    
    let cleaned = 0;
    for (const run of orphanedRuns) {
      const runAge = Date.now() - new Date(run.startedAt).getTime();
      await db.update(syncRuns)
        .set({
          status: 'failed',
          errorMessage: 'Interrupted by server restart - sync was still running when server restarted',
          completedAt: new Date(),
          durationMs: runAge,
        })
        .where(eq(syncRuns.id, run.id));
      cleaned++;
      console.log(`[SYNC-BRIDGE] Startup cleanup: marked orphaned sync ${run.id} (${run.direction}) as failed`);
    }
    
    console.log(`[SYNC-BRIDGE] Startup cleanup complete: ${cleaned} orphaned sync runs cleaned`);
    return cleaned;
  }
}

export const syncBridge = new SyncBridgeService();

// Run startup cleanup immediately
syncBridge.cleanupOnStartup().catch(err => {
  console.error(`[SYNC-BRIDGE] Startup cleanup failed:`, err.message);
});

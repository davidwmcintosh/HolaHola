/**
 * Voice Diagnostics Service
 * 
 * Commercial-grade production monitoring for the voice pipeline:
 * - In-memory ring buffer for real-time debugging (last 200 events)
 * - Persistent storage to hiveSnapshots for pattern analysis
 * - Health checks for Deepgram, Gemini, and Cartesia services
 * - Secrets verification (presence check, not values)
 * 
 * Persistence enables:
 * - Learning from failure patterns
 * - Latency trend analysis
 * - Service degradation detection
 * - Cross-session pattern correlation
 * 
 * TTS ARCHITECTURE:
 * ================
 * - DANIELA: Uses Cartesia streaming directly (cartesia-streaming.ts)
 *   → NEVER falls back to Google TTS
 *   → Her voice identity is tied to Cartesia's Sonic-3 model
 * 
 * - ARIS (Assistant Tutor): Uses Google Cloud TTS (drill-audio-service.ts)
 *   → Consistent, high-quality pronunciation for drills
 *   → Different voice identity from Daniela
 * 
 * - SUPPORT: Uses Google Cloud TTS
 *   → Separate from teaching voices
 * 
 * The auto-remediation fallback (shouldUseFallback) is DISABLED for Daniela
 * to preserve her unique voice identity. The detection logic remains active
 * for monitoring purposes and potential future use with other voice contexts.
 * 
 * All endpoints are founder-protected for security.
 */

/**
 * TTS Fallback Configuration
 * 
 * DISABLED: Daniela's voice never falls back to Google TTS automatically.
 * Her voice identity is tied to Cartesia's Sonic-3 model.
 * 
 * The detection logic (isTTSDegraded) still runs to:
 * - Surface degradation in Wren insights
 * - Alert founders to Cartesia issues
 * - Inject awareness into Daniela's context
 * 
 * Auto-remediation is controlled per-persona:
 * - 'daniela': Fallback DISABLED (alerts only), founders can override
 * - 'general': Auto-fallback ENABLED with auto-restore
 */
export const DANIELA_TTS_FALLBACK_ENABLED = false;

/**
 * Auto-Remediation Configuration
 */
export const AUTO_REMEDIATION_CONFIG = {
  // Number of consecutive successes required to restore Cartesia
  successesToRestore: 5,
  // Number of failures to trigger fallback (for general persona)
  failuresToTrigger: 3,
  // Latency threshold in ms to trigger fallback
  latencyThreshold: 2000,
  // Cooldown period in ms before attempting to restore Cartesia
  restoreCooldownMs: 60000, // 1 minute
};

/**
 * Remediation State
 * Tracks the current state of the auto-remediation system
 */
export type RemediationState = 'healthy' | 'degraded' | 'fallback' | 'restoring';

/**
 * Remediation Status
 * Full status of the auto-remediation system
 */
export interface RemediationStatus {
  state: RemediationState;
  inFallbackMode: boolean;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastDegradationAt: Date | null;
  lastRestorationAt: Date | null;
  lastAlertAt: Date | null;
  founderOverrideActive: boolean;
  currentProvider: 'cartesia' | 'google';
}

import { db, getSharedDb } from "../db";
import { hiveSnapshots } from "@shared/schema";
import { eq, desc, gte, and } from "drizzle-orm";

export interface VoiceEvent {
  timestamp: Date;
  sessionId: string;
  stage: 'connection' | 'auth' | 'stt' | 'ai' | 'tts' | 'complete' | 'error';
  status: 'start' | 'success' | 'fail';
  message: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface VoiceHealthCheck {
  timestamp: Date;
  environment: string;
  secrets: {
    deepgram: boolean;
    gemini: boolean;
    cartesia: boolean;
    googleTts: boolean;
  };
  services: {
    deepgram: { status: 'ok' | 'error'; message: string; latencyMs?: number };
    gemini: { status: 'ok' | 'error'; message: string; latencyMs?: number };
    cartesia: { status: 'ok' | 'error'; message: string; latencyMs?: number };
  };
  activeSessions: number;
}

class VoiceDiagnosticsService {
  private events: VoiceEvent[] = [];
  private readonly MAX_EVENTS = 200;
  private pendingFlush: VoiceEvent[] = [];
  private readonly FLUSH_THRESHOLD = 50; // Flush after 50 events
  private readonly FLUSH_INTERVAL_MS = 60000; // Or every 60 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  
  // Auto-Remediation State Machine
  private remediationState: RemediationState = 'healthy';
  private inFallbackMode: boolean = false;
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private lastDegradationAt: Date | null = null;
  private lastRestorationAt: Date | null = null;
  private lastAlertAt: Date | null = null;
  private founderOverrideActive: boolean = false;
  
  constructor() {
    this.startPeriodicFlush();
  }
  
  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.pendingFlush.length > 0) {
        this.flushToDatabaseAsync();
      }
    }, this.FLUSH_INTERVAL_MS);
  }
  
  /**
   * Stop periodic flush (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Final flush
    if (this.pendingFlush.length > 0) {
      await this.flushToDatabase();
    }
  }
  
  /**
   * Log a voice pipeline event
   */
  logEvent(event: Omit<VoiceEvent, 'timestamp'>): void {
    const fullEvent: VoiceEvent = {
      ...event,
      timestamp: new Date(),
    };
    
    this.events.push(fullEvent);
    this.pendingFlush.push(fullEvent);
    
    // Ring buffer: remove oldest events when exceeding limit
    while (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }
    
    // Also log to console for real-time visibility
    const statusIcon = event.status === 'success' ? '✓' : event.status === 'fail' ? '✗' : '→';
    console.log(`[Voice ${event.stage.toUpperCase()}] ${statusIcon} ${event.sessionId.substring(0, 8)}... ${event.message}${event.durationMs ? ` (${event.durationMs}ms)` : ''}`);
    
    // Flush if threshold reached
    if (this.pendingFlush.length >= this.FLUSH_THRESHOLD) {
      this.flushToDatabaseAsync();
    }
  }
  
  /**
   * Emit a voice pipeline event (simplified interface for streaming-voice-orchestrator)
   * 
   * This adapts the simplified event format from the orchestrator to the full VoiceEvent format.
   * Maps: { sessionId, stage, success, latencyMs?, metadata?, error? } → VoiceEvent
   */
  emit(event: {
    sessionId: string;
    stage: string;
    success: boolean;
    latencyMs?: number;
    metadata?: Record<string, any>;
    error?: string;
  }): void {
    // Map simplified stage names to VoiceEvent stage types
    const stageMap: Record<string, VoiceEvent['stage']> = {
      'session_start': 'connection',
      'stt': 'stt',
      'llm': 'ai',
      'tts': 'tts',
      'complete': 'complete',
      'error': 'error',
      'auth': 'auth',
      'connection': 'connection',
      'ai': 'ai',
    };
    
    const mappedStage = stageMap[event.stage] || 'error';
    const status: VoiceEvent['status'] = event.success ? 'success' : 'fail';
    
    // Build message from context
    let message = `${event.stage}`;
    if (event.error) {
      message = event.error;
    } else if (event.metadata) {
      const metaStr = Object.entries(event.metadata)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      if (metaStr) message += `: ${metaStr}`;
    }
    
    this.logEvent({
      sessionId: event.sessionId,
      stage: mappedStage,
      status,
      message,
      durationMs: event.latencyMs,
      metadata: event.metadata,
    });
  }
  
  /**
   * Async flush (non-blocking)
   */
  private flushToDatabaseAsync(): void {
    this.flushToDatabase().catch(err => {
      console.error('[Voice Diagnostics] Flush to database failed:', err.message);
    });
  }
  
  /**
   * Flush pending events to hiveSnapshots table
   */
  async flushToDatabase(): Promise<number> {
    if (this.pendingFlush.length === 0) return 0;
    
    const eventsToFlush = [...this.pendingFlush];
    this.pendingFlush = [];
    
    try {
      // Aggregate events into a single snapshot per flush
      const failureCount = eventsToFlush.filter(e => e.status === 'fail').length;
      const stageBreakdown: Record<string, { count: number; avgLatencyMs: number; failures: number }> = {};
      
      for (const event of eventsToFlush) {
        if (!stageBreakdown[event.stage]) {
          stageBreakdown[event.stage] = { count: 0, avgLatencyMs: 0, failures: 0 };
        }
        stageBreakdown[event.stage].count++;
        if (event.durationMs) {
          const prev = stageBreakdown[event.stage];
          prev.avgLatencyMs = ((prev.avgLatencyMs * (prev.count - 1)) + event.durationMs) / prev.count;
        }
        if (event.status === 'fail') {
          stageBreakdown[event.stage].failures++;
        }
      }
      
      // Determine importance based on failure rate
      const importance = failureCount > 5 ? 9 : failureCount > 0 ? 7 : 5;
      
      // Create snapshot with aggregated data
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day expiry
      
      await getSharedDb().insert(hiveSnapshots).values({
        snapshotType: 'voice_diagnostic',
        title: `Voice Pipeline: ${eventsToFlush.length} events (${failureCount} failures)`,
        content: JSON.stringify({
          eventCount: eventsToFlush.length,
          failureCount,
          stageBreakdown,
          timeRange: {
            start: eventsToFlush[0]?.timestamp,
            end: eventsToFlush[eventsToFlush.length - 1]?.timestamp,
          },
        }),
        context: JSON.stringify({
          type: 'voice_diagnostic_batch',
          environment: process.env.NODE_ENV || 'development',
          events: eventsToFlush.map(e => ({
            timestamp: e.timestamp,
            sessionId: e.sessionId,
            stage: e.stage,
            status: e.status,
            message: e.message,
            durationMs: e.durationMs,
          })),
        }),
        importance,
        metadata: {
          eventCount: eventsToFlush.length,
          failureCount,
          stages: Object.keys(stageBreakdown),
        },
        expiresAt,
      });
      
      console.log(`[Voice Diagnostics] Flushed ${eventsToFlush.length} events to hiveSnapshots (${failureCount} failures, importance=${importance})`);
      return eventsToFlush.length;
    } catch (error: any) {
      // Put events back for retry
      this.pendingFlush = [...eventsToFlush, ...this.pendingFlush];
      throw error;
    }
  }
  
  /**
   * Query historical voice diagnostic snapshots
   */
  async getHistoricalDiagnostics(options: {
    daysBack?: number;
    minImportance?: number;
    limit?: number;
  } = {}): Promise<Array<{
    id: string;
    title: string;
    content: any;
    importance: number | null;
    createdAt: Date;
  }>> {
    const { daysBack = 7, minImportance = 1, limit = 100 } = options;
    
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    
    const results = await getSharedDb().select({
      id: hiveSnapshots.id,
      title: hiveSnapshots.title,
      content: hiveSnapshots.content,
      importance: hiveSnapshots.importance,
      createdAt: hiveSnapshots.createdAt,
    })
    .from(hiveSnapshots)
    .where(and(
      eq(hiveSnapshots.snapshotType, 'voice_diagnostic'),
      gte(hiveSnapshots.createdAt, since),
      gte(hiveSnapshots.importance, minImportance)
    ))
    .orderBy(desc(hiveSnapshots.createdAt))
    .limit(limit);
    
    return results.map(r => ({
      ...r,
      content: typeof r.content === 'string' ? JSON.parse(r.content) : r.content,
    }));
  }
  
  /**
   * Get recent technical issues for a user's sessions
   * Used to inject awareness into Daniela's context
   * Returns null if no issues, or a summary string if issues detected
   */
  async getRecentTechnicalIssuesForUser(userId: string): Promise<string | null> {
    if (!userId) return null;
    
    // Check recent events in ring buffer for this user's sessions
    // Events don't store userId directly, but we can check for failures
    const recentFailures = this.events.filter(e => 
      e.status === 'fail' && 
      e.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );
    
    if (recentFailures.length === 0) return null;
    
    // Categorize failures
    const sttFailures = recentFailures.filter(e => e.stage === 'stt').length;
    const aiFailures = recentFailures.filter(e => e.stage === 'ai').length;
    const ttsFailures = recentFailures.filter(e => e.stage === 'tts').length;
    
    const issues: string[] = [];
    
    if (sttFailures > 0) {
      issues.push('speech recognition hiccups');
    }
    if (aiFailures > 0) {
      issues.push('response delays');
    }
    if (ttsFailures > 0) {
      issues.push('voice synthesis issues');
    }
    
    if (issues.length === 0) return null;
    
    return `Recent technical context: The system experienced some ${issues.join(' and ')} in the past 24 hours. If the student mentions audio problems or delays, acknowledge them empathetically and assure them you're here to help.`;
  }
  
  /**
   * Build context string for Daniela about technical health
   * Lightweight version for prompt injection
   */
  getTechnicalHealthContext(): string | null {
    const stats = this.getStats();
    
    // Only inject if there are notable issues
    if (stats.failureCount === 0) return null;
    
    const failureRate = (stats.failureCount / stats.totalEvents) * 100;
    if (failureRate < 5) return null; // Less than 5% failure rate is acceptable
    
    return `Note: Voice system health is ${failureRate > 20 ? 'degraded' : 'slightly impacted'}. If you notice delays or issues, be patient with the student and acknowledge any technical difficulties gracefully.`;
  }
  
  /**
   * Get all logged events (newest first)
   */
  getEvents(limit?: number): VoiceEvent[] {
    const sorted = [...this.events].reverse();
    return limit ? sorted.slice(0, limit) : sorted;
  }
  
  /**
   * Get events for a specific session
   */
  getSessionEvents(sessionId: string): VoiceEvent[] {
    return this.events.filter(e => e.sessionId === sessionId).reverse();
  }
  
  /**
   * Get events filtered by stage
   */
  getEventsByStage(stage: VoiceEvent['stage']): VoiceEvent[] {
    return this.events.filter(e => e.stage === stage).reverse();
  }
  
  /**
   * Get failure events only
   */
  getFailures(): VoiceEvent[] {
    return this.events.filter(e => e.status === 'fail').reverse();
  }
  
  /**
   * Check if all required secrets are present
   */
  checkSecrets(): VoiceHealthCheck['secrets'] {
    return {
      deepgram: !!process.env.DEEPGRAM_API_KEY,
      gemini: !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      cartesia: !!process.env.CARTESIA_API_KEY,
      googleTts: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    };
  }
  
  /**
   * Test Deepgram connectivity
   */
  async testDeepgram(): Promise<{ status: 'ok' | 'error'; message: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY;
      if (!apiKey) {
        return { status: 'error', message: 'DEEPGRAM_API_KEY not configured' };
      }
      
      // Simple API validation - check if key works
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { 'Authorization': `Token ${apiKey}` },
      });
      
      const latencyMs = Date.now() - start;
      
      if (response.ok) {
        return { status: 'ok', message: 'Deepgram API accessible', latencyMs };
      } else {
        return { status: 'error', message: `Deepgram API returned ${response.status}`, latencyMs };
      }
    } catch (error: any) {
      return { status: 'error', message: `Deepgram connection failed: ${error.message}` };
    }
  }
  
  /**
   * Test Gemini connectivity
   */
  async testGemini(): Promise<{ status: 'ok' | 'error'; message: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return { status: 'error', message: 'GEMINI_API_KEY not configured' };
      }
      
      const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
      
      // Simple model list request to validate API key
      const response = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`);
      
      const latencyMs = Date.now() - start;
      
      if (response.ok) {
        return { status: 'ok', message: 'Gemini API accessible', latencyMs };
      } else {
        const text = await response.text();
        return { status: 'error', message: `Gemini API returned ${response.status}: ${text.substring(0, 100)}`, latencyMs };
      }
    } catch (error: any) {
      return { status: 'error', message: `Gemini connection failed: ${error.message}` };
    }
  }
  
  /**
   * Test Cartesia connectivity
   */
  async testCartesia(): Promise<{ status: 'ok' | 'error'; message: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      const apiKey = process.env.CARTESIA_API_KEY;
      if (!apiKey) {
        return { status: 'error', message: 'CARTESIA_API_KEY not configured' };
      }
      
      // Test voices endpoint to validate API key
      const response = await fetch('https://api.cartesia.ai/voices', {
        headers: { 
          'X-API-Key': apiKey,
          'Cartesia-Version': '2024-06-10',
        },
      });
      
      const latencyMs = Date.now() - start;
      
      if (response.ok) {
        return { status: 'ok', message: 'Cartesia API accessible', latencyMs };
      } else {
        return { status: 'error', message: `Cartesia API returned ${response.status}`, latencyMs };
      }
    } catch (error: any) {
      return { status: 'error', message: `Cartesia connection failed: ${error.message}` };
    }
  }
  
  /**
   * Run full health check
   */
  async runHealthCheck(activeSessions: number = 0): Promise<VoiceHealthCheck> {
    const [deepgram, gemini, cartesia] = await Promise.all([
      this.testDeepgram(),
      this.testGemini(),
      this.testCartesia(),
    ]);
    
    return {
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
      secrets: this.checkSecrets(),
      services: { deepgram, gemini, cartesia },
      activeSessions,
    };
  }
  
  /**
   * Get summary statistics
   */
  getStats(): {
    totalEvents: number;
    failureCount: number;
    stageBreakdown: Record<string, number>;
    recentFailures: VoiceEvent[];
  } {
    const failures = this.getFailures();
    const stageBreakdown: Record<string, number> = {};
    
    for (const event of this.events) {
      stageBreakdown[event.stage] = (stageBreakdown[event.stage] || 0) + 1;
    }
    
    return {
      totalEvents: this.events.length,
      failureCount: failures.length,
      stageBreakdown,
      recentFailures: failures.slice(0, 10),
    };
  }
  
  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events = [];
  }
  
  /**
   * Check if TTS (Cartesia) is currently degraded based on recent events
   * 
   * @param persona - The persona requesting degradation status:
   *   - 'daniela' (default): Monitors Daniela's Cartesia pipeline. Fallback is
   *     DISABLED by DANIELA_TTS_FALLBACK_ENABLED to preserve her voice identity.
   *   - 'general': For future consumers that may want fallback recommendations.
   *     Returns shouldUseFallback: true when degraded.
   * 
   * ARCHITECTURE NOTE:
   * - Daniela uses Cartesia streaming exclusively (no fallback)
   * - Aris/Support use Google TTS directly via drill-audio-service.ts
   * - This method monitors the Cartesia pipeline specifically
   * 
   * The detection runs for:
   * - Surfacing degradation in Wren insights (nightly pattern analysis)
   * - Alerting founders to Cartesia issues
   * - Injecting awareness into Daniela's context
   * 
   * Criteria for degradation detection:
   * - >30% TTS failure rate in last 10 TTS events
   * - OR average TTS latency >2000ms in last 10 events
   */
  isTTSDegraded(persona: 'daniela' | 'general' = 'daniela'): { degraded: boolean; reason?: string; shouldUseFallback: boolean } {
    const allowFallback = persona === 'daniela' ? DANIELA_TTS_FALLBACK_ENABLED : true;
    const recentTTSEvents = this.events
      .filter(e => e.stage === 'tts')
      .slice(-10); // Last 10 TTS events
    
    if (recentTTSEvents.length < 3) {
      return { degraded: false, shouldUseFallback: false };
    }
    
    const failures = recentTTSEvents.filter(e => e.status === 'fail').length;
    const failureRate = failures / recentTTSEvents.length;
    
    const successfulEvents = recentTTSEvents.filter(e => e.status === 'success' && e.durationMs);
    const avgLatency = successfulEvents.length > 0
      ? successfulEvents.reduce((sum, e) => sum + (e.durationMs || 0), 0) / successfulEvents.length
      : 0;
    
    if (failureRate > 0.3) {
      console.log(`[Voice Diagnostics] TTS DEGRADED: ${(failureRate * 100).toFixed(0)}% failure rate (persona: ${persona}, fallback ${allowFallback ? 'ENABLED' : 'DISABLED'})`);
      return {
        degraded: true,
        reason: `High TTS failure rate: ${(failureRate * 100).toFixed(0)}% (${failures}/${recentTTSEvents.length} events)`,
        shouldUseFallback: allowFallback,
      };
    }
    
    if (avgLatency > 2000) {
      console.log(`[Voice Diagnostics] TTS DEGRADED: ${avgLatency.toFixed(0)}ms average latency (persona: ${persona}, fallback ${allowFallback ? 'ENABLED' : 'DISABLED'})`);
      return {
        degraded: true,
        reason: `High TTS latency: ${avgLatency.toFixed(0)}ms average`,
        shouldUseFallback: allowFallback,
      };
    }
    
    return { degraded: false, shouldUseFallback: false };
  }
  
  /**
   * Check if any stage is critically degraded (>50% failure rate)
   * Returns list of degraded stages for immediate attention
   */
  getCriticallyDegradedStages(): Array<{ stage: string; failureRate: number; eventCount: number }> {
    const stageCounts: Record<string, { total: number; failures: number }> = {};
    
    // Only look at recent events (last 50)
    const recentEvents = this.events.slice(-50);
    
    for (const event of recentEvents) {
      if (!stageCounts[event.stage]) {
        stageCounts[event.stage] = { total: 0, failures: 0 };
      }
      stageCounts[event.stage].total++;
      if (event.status === 'fail') {
        stageCounts[event.stage].failures++;
      }
    }
    
    const degraded: Array<{ stage: string; failureRate: number; eventCount: number }> = [];
    
    for (const [stage, counts] of Object.entries(stageCounts)) {
      if (counts.total >= 3) { // Need at least 3 events
        const failureRate = counts.failures / counts.total;
        if (failureRate > 0.5) {
          degraded.push({
            stage,
            failureRate,
            eventCount: counts.total,
          });
        }
      }
    }
    
    return degraded;
  }
  
  // ============================================================
  // AUTO-REMEDIATION SYSTEM
  // ============================================================
  
  /**
   * Get current remediation status
   */
  getRemediationStatus(): RemediationStatus {
    return {
      state: this.remediationState,
      inFallbackMode: this.inFallbackMode,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      lastDegradationAt: this.lastDegradationAt,
      lastRestorationAt: this.lastRestorationAt,
      lastAlertAt: this.lastAlertAt,
      founderOverrideActive: this.founderOverrideActive,
      currentProvider: this.inFallbackMode ? 'google' : 'cartesia',
    };
  }
  
  /**
   * Record a TTS result and update remediation state
   * Call this after each TTS request to track success/failure patterns
   * 
   * @param success - Whether the TTS request succeeded
   * @param latencyMs - Optional latency in milliseconds
   * @param persona - The persona making the request
   * @returns Whether to use fallback provider for next request
   */
  recordTTSResult(success: boolean, latencyMs?: number, persona: 'daniela' | 'general' = 'daniela'): {
    useFallback: boolean;
    stateChanged: boolean;
    newState: RemediationState;
  } {
    const allowAutoFallback = persona === 'daniela' ? DANIELA_TTS_FALLBACK_ENABLED : true;
    const prevState = this.remediationState;
    
    // Track consecutive success/failures
    if (success && (!latencyMs || latencyMs < AUTO_REMEDIATION_CONFIG.latencyThreshold)) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
    }
    
    // State machine transitions
    switch (this.remediationState) {
      case 'healthy':
        // Check for degradation
        if (this.consecutiveFailures >= AUTO_REMEDIATION_CONFIG.failuresToTrigger) {
          this.remediationState = 'degraded';
          this.lastDegradationAt = new Date();
          console.log(`[Auto-Remediation] State: healthy → degraded (${this.consecutiveFailures} consecutive failures, persona: ${persona})`);
          
          // For general persona, enter fallback immediately
          if (allowAutoFallback) {
            this.inFallbackMode = true;
            this.remediationState = 'fallback';
            console.log(`[Auto-Remediation] State: degraded → fallback (auto-fallback enabled for ${persona})`);
          } else {
            // For Daniela, alert but don't fallback
            this.emitDegradationAlert(persona);
          }
        }
        break;
        
      case 'degraded':
        // Already degraded, check if we should fallback (if allowed)
        if (allowAutoFallback && this.consecutiveFailures >= AUTO_REMEDIATION_CONFIG.failuresToTrigger) {
          this.inFallbackMode = true;
          this.remediationState = 'fallback';
          console.log(`[Auto-Remediation] State: degraded → fallback (auto-fallback triggered)`);
        }
        // Or check if recovered
        if (this.consecutiveSuccesses >= AUTO_REMEDIATION_CONFIG.successesToRestore) {
          this.remediationState = 'healthy';
          this.lastRestorationAt = new Date();
          console.log(`[Auto-Remediation] State: degraded → healthy (${this.consecutiveSuccesses} consecutive successes)`);
        }
        break;
        
      case 'fallback':
        // We're in fallback mode - check if Cartesia is healthy again
        // Start restoring if cooldown passed and we have some successes
        const cooldownPassed = !this.lastDegradationAt || 
          (Date.now() - this.lastDegradationAt.getTime()) > AUTO_REMEDIATION_CONFIG.restoreCooldownMs;
        
        if (cooldownPassed && this.consecutiveSuccesses >= 2) {
          this.remediationState = 'restoring';
          console.log(`[Auto-Remediation] State: fallback → restoring (attempting Cartesia restoration)`);
        }
        break;
        
      case 'restoring':
        // Try Cartesia - if it succeeds enough times, restore fully
        if (this.consecutiveSuccesses >= AUTO_REMEDIATION_CONFIG.successesToRestore) {
          this.inFallbackMode = false;
          this.remediationState = 'healthy';
          this.lastRestorationAt = new Date();
          console.log(`[Auto-Remediation] ✓ State: restoring → healthy (Cartesia restored after ${this.consecutiveSuccesses} successes)`);
        }
        // If it fails again, go back to fallback
        if (this.consecutiveFailures >= 1) {
          this.remediationState = 'fallback';
          console.log(`[Auto-Remediation] State: restoring → fallback (restoration failed, back to fallback)`);
        }
        break;
    }
    
    return {
      useFallback: this.inFallbackMode && allowAutoFallback,
      stateChanged: prevState !== this.remediationState,
      newState: this.remediationState,
    };
  }
  
  /**
   * Emit an alert when Daniela's TTS is degraded (but fallback is disabled)
   * This creates a hiveSnapshot for founder visibility
   */
  private async emitDegradationAlert(persona: string): Promise<void> {
    // Rate limit alerts to once per 5 minutes
    if (this.lastAlertAt && (Date.now() - this.lastAlertAt.getTime()) < 300000) {
      return;
    }
    
    this.lastAlertAt = new Date();
    
    const alertContent = {
      type: 'tts_degradation_alert',
      persona,
      message: `TTS degradation detected for ${persona}. Fallback is ${persona === 'daniela' ? 'DISABLED' : 'ENABLED'}.`,
      consecutiveFailures: this.consecutiveFailures,
      remediationState: this.remediationState,
      timestamp: this.lastAlertAt.toISOString(),
    };
    
    console.log(`[Auto-Remediation] ⚠️ ALERT: TTS degradation for ${persona} - ${this.consecutiveFailures} failures`);
    
    try {
      await getSharedDb().insert(hiveSnapshots).values({
        snapshotType: 'voice_diagnostic', // Use existing type, alert info in content
        title: `⚠️ TTS Degradation Alert (${persona})`,
        content: JSON.stringify(alertContent),
        context: JSON.stringify({
          environment: process.env.NODE_ENV || 'development',
          recentEvents: this.events.filter(e => e.stage === 'tts').slice(-10),
        }),
        importance: 9, // High importance for alerts
        metadata: { persona, failures: this.consecutiveFailures },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
    } catch (error: any) {
      console.error('[Auto-Remediation] Failed to persist degradation alert:', error.message);
    }
  }
  
  /**
   * Check if we should use fallback provider for the current request
   * This is a quick check for TTS service to consult before each request
   * 
   * @param persona - The persona making the request
   * @returns Whether to use fallback (Google) instead of primary (Cartesia)
   */
  shouldUseFallback(persona: 'daniela' | 'general' = 'daniela'): boolean {
    // If founder override is active, check what it's set to
    if (this.founderOverrideActive) {
      return this.inFallbackMode;
    }
    
    // For Daniela, never auto-fallback unless override is active
    if (persona === 'daniela' && !DANIELA_TTS_FALLBACK_ENABLED) {
      return false;
    }
    
    // For general persona, use the current fallback state
    return this.inFallbackMode;
  }
  
  /**
   * Founder override to force fallback mode (or restore)
   * Used when founders want to manually switch providers
   * 
   * @param enableFallback - Whether to enable fallback mode
   */
  setFounderOverride(enableFallback: boolean): void {
    this.founderOverrideActive = true;
    this.inFallbackMode = enableFallback;
    this.remediationState = enableFallback ? 'fallback' : 'healthy';
    console.log(`[Auto-Remediation] Founder override: fallback=${enableFallback}`);
  }
  
  /**
   * Clear founder override, return to automatic remediation
   */
  clearFounderOverride(): void {
    this.founderOverrideActive = false;
    console.log(`[Auto-Remediation] Founder override cleared, returning to automatic mode`);
  }
  
  /**
   * Force restore to Cartesia (skip the gradual restoration)
   * Used when founders want to immediately try Cartesia again
   */
  forceRestore(): void {
    this.inFallbackMode = false;
    this.remediationState = 'healthy';
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.lastRestorationAt = new Date();
    this.founderOverrideActive = false;
    console.log(`[Auto-Remediation] Force restore to Cartesia completed`);
  }
  
  // ============================================================
  // VOICE ANALYTICS DASHBOARD
  // ============================================================
  
  /**
   * Get comprehensive voice session analytics for dashboard
   * Includes latency percentiles, success rates, stage breakdown, and engagement metrics
   */
  getComprehensiveAnalytics(): {
    summary: {
      totalEvents: number;
      totalSessions: number;
      successRate: number;
      failureRate: number;
      bufferAge: string;
    };
    latencyMetrics: {
      stt: { avg: number; p50: number; p95: number; p99: number; count: number };
      ai: { avg: number; p50: number; p95: number; p99: number; count: number };
      tts: { avg: number; p50: number; p95: number; p99: number; count: number };
      e2e: { avg: number; p50: number; p95: number; p99: number; count: number };
    };
    stageHealth: Array<{
      stage: string;
      total: number;
      successes: number;
      failures: number;
      successRate: number;
      avgDurationMs: number;
    }>;
    recentFailures: Array<{
      timestamp: Date;
      stage: string;
      message: string;
      sessionId: string;
    }>;
    timeDistribution: {
      last5min: number;
      last15min: number;
      last1hr: number;
      older: number;
    };
    remediation: RemediationStatus;
  } {
    const now = Date.now();
    const events = this.events;
    const uniqueSessions = new Set(events.map(e => e.sessionId)).size;
    
    // Calculate buffer age
    const oldestEvent = events.length > 0 ? events[0].timestamp : new Date();
    const bufferAgeMs = now - new Date(oldestEvent).getTime();
    const bufferAgeMinutes = Math.floor(bufferAgeMs / 60000);
    const bufferAge = bufferAgeMinutes < 60 
      ? `${bufferAgeMinutes} minutes` 
      : `${Math.floor(bufferAgeMinutes / 60)} hours ${bufferAgeMinutes % 60} min`;
    
    // Calculate success/failure rates
    const totalSuccesses = events.filter(e => e.status === 'success').length;
    const totalFailures = events.filter(e => e.status === 'fail').length;
    const successRate = events.length > 0 ? (totalSuccesses / events.length) * 100 : 100;
    const failureRate = events.length > 0 ? (totalFailures / events.length) * 100 : 0;
    
    // Latency calculations by stage
    const getLatencyMetrics = (stage: VoiceEvent['stage']) => {
      const stageEvents = events.filter(e => e.stage === stage && e.status === 'success' && e.durationMs);
      if (stageEvents.length === 0) {
        return { avg: 0, p50: 0, p95: 0, p99: 0, count: 0 };
      }
      
      const durations = stageEvents.map(e => e.durationMs!).sort((a, b) => a - b);
      const count = durations.length;
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / count);
      const p50 = durations[Math.floor(count * 0.5)] || 0;
      const p95 = durations[Math.floor(count * 0.95)] || durations[count - 1] || 0;
      const p99 = durations[Math.floor(count * 0.99)] || durations[count - 1] || 0;
      
      return { avg, p50, p95, p99, count };
    };
    
    // E2E latency (sum of stt + ai + tts for complete sessions)
    const completeEvents = events.filter(e => e.stage === 'complete' && e.status === 'success' && e.durationMs);
    const e2eMetrics = completeEvents.length > 0 ? (() => {
      const durations = completeEvents.map(e => e.durationMs!).sort((a, b) => a - b);
      const count = durations.length;
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / count);
      return {
        avg,
        p50: durations[Math.floor(count * 0.5)] || 0,
        p95: durations[Math.floor(count * 0.95)] || durations[count - 1] || 0,
        p99: durations[Math.floor(count * 0.99)] || durations[count - 1] || 0,
        count,
      };
    })() : { avg: 0, p50: 0, p95: 0, p99: 0, count: 0 };
    
    // Stage health breakdown
    const stageMap: Record<string, { total: number; successes: number; failures: number; durations: number[] }> = {};
    for (const event of events) {
      if (!stageMap[event.stage]) {
        stageMap[event.stage] = { total: 0, successes: 0, failures: 0, durations: [] };
      }
      stageMap[event.stage].total++;
      if (event.status === 'success') {
        stageMap[event.stage].successes++;
        if (event.durationMs) stageMap[event.stage].durations.push(event.durationMs);
      } else if (event.status === 'fail') {
        stageMap[event.stage].failures++;
      }
    }
    
    const stageHealth = Object.entries(stageMap).map(([stage, data]) => ({
      stage,
      total: data.total,
      successes: data.successes,
      failures: data.failures,
      successRate: data.total > 0 ? Math.round((data.successes / data.total) * 100) : 100,
      avgDurationMs: data.durations.length > 0 
        ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length) 
        : 0,
    }));
    
    // Time distribution
    const timeDistribution = {
      last5min: events.filter(e => now - new Date(e.timestamp).getTime() < 5 * 60 * 1000).length,
      last15min: events.filter(e => {
        const age = now - new Date(e.timestamp).getTime();
        return age >= 5 * 60 * 1000 && age < 15 * 60 * 1000;
      }).length,
      last1hr: events.filter(e => {
        const age = now - new Date(e.timestamp).getTime();
        return age >= 15 * 60 * 1000 && age < 60 * 60 * 1000;
      }).length,
      older: events.filter(e => now - new Date(e.timestamp).getTime() >= 60 * 60 * 1000).length,
    };
    
    // Recent failures (last 10)
    const recentFailures = events
      .filter(e => e.status === 'fail')
      .slice(-10)
      .reverse()
      .map(e => ({
        timestamp: e.timestamp,
        stage: e.stage,
        message: e.message,
        sessionId: e.sessionId,
      }));
    
    return {
      summary: {
        totalEvents: events.length,
        totalSessions: uniqueSessions,
        successRate: Math.round(successRate * 10) / 10,
        failureRate: Math.round(failureRate * 10) / 10,
        bufferAge,
      },
      latencyMetrics: {
        stt: getLatencyMetrics('stt'),
        ai: getLatencyMetrics('ai'),
        tts: getLatencyMetrics('tts'),
        e2e: e2eMetrics,
      },
      stageHealth,
      recentFailures,
      timeDistribution,
      remediation: this.getRemediationStatus(),
    };
  }
  // ============================================================
  // SUPPORT SYSTEM INTEGRATION
  // ============================================================
  
  /**
   * Get voice diagnostics formatted for Sofia Support system
   * Includes production telemetry for debugging double audio issues
   */
  getSupportDiagnostics(): {
    avgLatencyMs?: number;
    connectionHealth: 'healthy' | 'degraded' | 'poor';
    recentErrors: string[];
    ttsProvider: string;
    sttProvider: string;
    recentQueueBacklogs?: number;
    avgAudioChunksPerTurn?: number;
    connectionIssues?: Array<{
      type: 'duplicate_connection' | 'early_close' | 'error';
      count: number;
      lastSeen?: string;
    }>;
    productionTelemetrySummary?: string;
  } {
    const now = Date.now();
    const events = this.events;
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // Calculate E2E latency from complete events
    const completeEvents = events.filter(e => 
      e.stage === 'complete' && e.status === 'success' && e.durationMs
    );
    const avgLatencyMs = completeEvents.length > 0
      ? Math.round(completeEvents.reduce((sum, e) => sum + (e.durationMs || 0), 0) / completeEvents.length)
      : undefined;
    
    // Determine connection health based on recent failures
    const recentFailures = events.filter(e => 
      e.status === 'fail' && new Date(e.timestamp).getTime() > oneHourAgo
    );
    const recentSuccesses = events.filter(e => 
      e.status === 'success' && new Date(e.timestamp).getTime() > oneHourAgo
    );
    const failureRate = (recentSuccesses.length + recentFailures.length) > 0
      ? recentFailures.length / (recentSuccesses.length + recentFailures.length)
      : 0;
    
    let connectionHealth: 'healthy' | 'degraded' | 'poor' = 'healthy';
    if (failureRate > 0.2) connectionHealth = 'poor';
    else if (failureRate > 0.05) connectionHealth = 'degraded';
    
    // Get recent error messages
    const recentErrors = recentFailures
      .slice(-5)
      .reverse()
      .map(e => `${e.stage}: ${e.message}`);
    
    // Count queue backlog warnings from connection events with queue_status metadata
    const queueBacklogEvents = events.filter(e => 
      new Date(e.timestamp).getTime() > oneHourAgo &&
      e.metadata?.warning === 'QUEUE_BACKLOG'
    );
    const recentQueueBacklogs = queueBacklogEvents.length > 0 ? queueBacklogEvents.length : undefined;
    
    // Calculate average audio chunks per turn from complete events
    const audioChunkEvents = events.filter(e => 
      e.stage === 'complete' && 
      e.status === 'success' && 
      typeof e.metadata?.audioChunkCount === 'number'
    );
    const avgAudioChunksPerTurn = audioChunkEvents.length > 0
      ? audioChunkEvents.reduce((sum, e) => sum + (e.metadata?.audioChunkCount || 0), 0) / audioChunkEvents.length
      : undefined;
    
    // Analyze connection lifecycle events
    const connectionEvents = events.filter(e => 
      e.stage === 'connection' && new Date(e.timestamp).getTime() > oneHourAgo
    );
    const connectionIssues: Array<{ type: 'duplicate_connection' | 'early_close' | 'error'; count: number; lastSeen?: string }> = [];
    
    // Count early closes (connections < 10 seconds that weren't intentional)
    const earlyCloses = connectionEvents.filter(e => 
      e.metadata?.duration && e.metadata.duration < 10000 && e.status === 'success'
    );
    if (earlyCloses.length > 0) {
      connectionIssues.push({
        type: 'early_close',
        count: earlyCloses.length,
        lastSeen: earlyCloses[earlyCloses.length - 1]?.timestamp?.toISOString(),
      });
    }
    
    // Count connection errors
    const connectionErrors = connectionEvents.filter(e => e.status === 'fail');
    if (connectionErrors.length > 0) {
      connectionIssues.push({
        type: 'error',
        count: connectionErrors.length,
        lastSeen: connectionErrors[connectionErrors.length - 1]?.timestamp?.toISOString(),
      });
    }
    
    // Build summary
    const summaryParts: string[] = [];
    if (recentQueueBacklogs && recentQueueBacklogs > 0) {
      summaryParts.push(`${recentQueueBacklogs} queue backlogs detected`);
    }
    if (avgAudioChunksPerTurn !== undefined && avgAudioChunksPerTurn > 5) {
      summaryParts.push(`high chunk count (${avgAudioChunksPerTurn.toFixed(1)}/turn)`);
    }
    if (connectionIssues.length > 0) {
      const issueCount = connectionIssues.reduce((sum, i) => sum + i.count, 0);
      summaryParts.push(`${issueCount} connection issues`);
    }
    
    return {
      avgLatencyMs,
      connectionHealth,
      recentErrors,
      ttsProvider: this.inFallbackMode ? 'Google TTS (fallback)' : 'Cartesia Sonic-3',
      sttProvider: 'Deepgram Nova-3',
      recentQueueBacklogs,
      avgAudioChunksPerTurn,
      connectionIssues: connectionIssues.length > 0 ? connectionIssues : undefined,
      productionTelemetrySummary: summaryParts.length > 0 ? summaryParts.join('; ') : undefined,
    };
  }
}

// Singleton instance
export const voiceDiagnostics = new VoiceDiagnosticsService();

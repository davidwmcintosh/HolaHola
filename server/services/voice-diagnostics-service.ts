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
 * DISABLED: Daniela's voice never falls back to Google TTS.
 * Her voice identity is tied to Cartesia's Sonic-3 model.
 * 
 * The detection logic (isTTSDegraded) still runs to:
 * - Surface degradation in Wren insights
 * - Alert founders to Cartesia issues
 * - Inject awareness into Daniela's context
 * 
 * Set to true ONLY if you want to enable automatic TTS provider switching.
 * This would change Daniela's voice mid-session - not recommended.
 */
export const DANIELA_TTS_FALLBACK_ENABLED = false;

import { db } from "../db";
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
      
      await db.insert(hiveSnapshots).values({
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
    
    const results = await db.select({
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
}

// Singleton instance
export const voiceDiagnostics = new VoiceDiagnosticsService();

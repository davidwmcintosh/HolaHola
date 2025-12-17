/**
 * Voice Diagnostics Service
 * 
 * Provides production monitoring capabilities for the voice pipeline:
 * - In-memory ring buffer capturing the last 200 voice events
 * - Health checks for Deepgram, Gemini, and Cartesia services
 * - Secrets verification (presence check, not values)
 * 
 * All endpoints are founder-protected for security.
 */

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
  
  /**
   * Log a voice pipeline event
   */
  logEvent(event: Omit<VoiceEvent, 'timestamp'>): void {
    const fullEvent: VoiceEvent = {
      ...event,
      timestamp: new Date(),
    };
    
    this.events.push(fullEvent);
    
    // Ring buffer: remove oldest events when exceeding limit
    while (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }
    
    // Also log to console for real-time visibility
    const statusIcon = event.status === 'success' ? '✓' : event.status === 'fail' ? '✗' : '→';
    console.log(`[Voice ${event.stage.toUpperCase()}] ${statusIcon} ${event.sessionId.substring(0, 8)}... ${event.message}${event.durationMs ? ` (${event.durationMs}ms)` : ''}`);
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
}

// Singleton instance
export const voiceDiagnostics = new VoiceDiagnosticsService();

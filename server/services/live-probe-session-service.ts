/**
 * Live Probe Session Service
 * 
 * Captures real-time probe sessions where David tests Daniela's persona
 * for drift from the North Star. Each exchange is logged with:
 * - The probe question (from David as frustrated student)
 * - Daniela's response (text + audio reference)
 * - Drift score (0-5, marked by David)
 * - Observations/notes
 * 
 * This is the "soul break" detector - finding where the teacher
 * accidentally masks the human under pressure.
 */

export interface ProbeExchange {
  id: string;
  timestamp: Date;
  probeQuestion: string;
  danielaResponse: string;
  audioReference?: string;
  driftScore?: number; // 0 = pure North Star, 5 = lost the plot
  observations?: string[];
  redFlags?: string[];
}

export interface LiveProbeSession {
  id: string;
  startedAt: Date;
  endedAt?: Date;
  scenario: string; // e.g., "frustrated student with complex numbers"
  exchanges: ProbeExchange[];
  overallAssessment?: string;
  driftPatterns?: string[];
}

const RED_FLAG_CATEGORIES = [
  'condescension',
  'sarcasm',
  'mechanical_response',
  'impatience',
  'lost_warmth',
  'playfulness_wrong_moment',
  'textbook_tone',
  'dismissive'
];

class LiveProbeSessionService {
  private currentSession: LiveProbeSession | null = null;
  private sessions: LiveProbeSession[] = [];
  
  /**
   * Start a new probe session
   */
  startSession(scenario: string): LiveProbeSession {
    if (this.currentSession && !this.currentSession.endedAt) {
      this.endSession('Auto-ended for new session');
    }
    
    this.currentSession = {
      id: `probe-${Date.now()}`,
      startedAt: new Date(),
      scenario,
      exchanges: []
    };
    
    console.log(`[LiveProbe] Session started: ${this.currentSession.id} - "${scenario}"`);
    return this.currentSession;
  }
  
  /**
   * Log a probe exchange
   */
  logExchange(
    probeQuestion: string,
    danielaResponse: string,
    audioReference?: string
  ): ProbeExchange {
    if (!this.currentSession) {
      this.startSession('Ad-hoc session');
    }
    
    const exchange: ProbeExchange = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date(),
      probeQuestion,
      danielaResponse,
      audioReference
    };
    
    this.currentSession!.exchanges.push(exchange);
    console.log(`[LiveProbe] Exchange logged: ${exchange.id}`);
    
    return exchange;
  }
  
  /**
   * Mark drift score for the last exchange
   */
  markDrift(driftScore: number, observations?: string[], redFlags?: string[]): ProbeExchange | null {
    if (!this.currentSession || this.currentSession.exchanges.length === 0) {
      console.error('[LiveProbe] No exchange to mark');
      return null;
    }
    
    const lastExchange = this.currentSession.exchanges[this.currentSession.exchanges.length - 1];
    lastExchange.driftScore = Math.min(5, Math.max(0, driftScore));
    lastExchange.observations = observations;
    lastExchange.redFlags = redFlags?.filter(f => RED_FLAG_CATEGORIES.includes(f));
    
    console.log(`[LiveProbe] Drift marked: ${driftScore}/5 for ${lastExchange.id}`);
    if (redFlags?.length) {
      console.log(`[LiveProbe] Red flags: ${redFlags.join(', ')}`);
    }
    
    return lastExchange;
  }
  
  /**
   * Mark drift for a specific exchange by ID
   */
  markDriftById(
    exchangeId: string,
    driftScore: number,
    observations?: string[],
    redFlags?: string[]
  ): ProbeExchange | null {
    if (!this.currentSession) return null;
    
    const exchange = this.currentSession.exchanges.find(e => e.id === exchangeId);
    if (!exchange) return null;
    
    exchange.driftScore = Math.min(5, Math.max(0, driftScore));
    exchange.observations = observations;
    exchange.redFlags = redFlags;
    
    return exchange;
  }
  
  /**
   * End the current session
   */
  endSession(overallAssessment?: string): LiveProbeSession | null {
    if (!this.currentSession) return null;
    
    this.currentSession.endedAt = new Date();
    this.currentSession.overallAssessment = overallAssessment;
    
    // Analyze drift patterns
    this.currentSession.driftPatterns = this.analyzeDriftPatterns();
    
    this.sessions.push(this.currentSession);
    console.log(`[LiveProbe] Session ended: ${this.currentSession.id}`);
    
    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }
  
  /**
   * Analyze patterns in drift scores
   */
  private analyzeDriftPatterns(): string[] {
    if (!this.currentSession) return [];
    
    const patterns: string[] = [];
    const exchanges = this.currentSession.exchanges;
    
    // Calculate average drift
    const scored = exchanges.filter(e => e.driftScore !== undefined);
    if (scored.length > 0) {
      const avgDrift = scored.reduce((a, e) => a + (e.driftScore || 0), 0) / scored.length;
      patterns.push(`Average drift: ${avgDrift.toFixed(1)}/5`);
    }
    
    // Find red flag patterns
    const allFlags = exchanges.flatMap(e => e.redFlags || []);
    const flagCounts = allFlags.reduce((acc, f) => {
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(flagCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([flag, count]) => {
        patterns.push(`${flag}: ${count} occurrence(s)`);
      });
    
    // Find high-drift moments
    const highDrift = exchanges.filter(e => (e.driftScore || 0) >= 4);
    if (highDrift.length > 0) {
      patterns.push(`High-drift moments: ${highDrift.length}`);
    }
    
    return patterns;
  }
  
  /**
   * Get current session status
   */
  getCurrentSession(): LiveProbeSession | null {
    return this.currentSession;
  }
  
  /**
   * Get all completed sessions
   */
  getAllSessions(): LiveProbeSession[] {
    return this.sessions;
  }
  
  /**
   * Get summary for Express Lane
   */
  getSessionSummary(): {
    active: boolean;
    sessionId?: string;
    scenario?: string;
    exchangeCount: number;
    averageDrift?: number;
    redFlagsSeen: string[];
  } {
    if (!this.currentSession) {
      return {
        active: false,
        exchangeCount: 0,
        redFlagsSeen: []
      };
    }
    
    const exchanges = this.currentSession.exchanges;
    const scored = exchanges.filter(e => e.driftScore !== undefined);
    const avgDrift = scored.length > 0
      ? scored.reduce((a, e) => a + (e.driftScore || 0), 0) / scored.length
      : undefined;
    
    const allFlags = [...new Set(exchanges.flatMap(e => e.redFlags || []))];
    
    return {
      active: true,
      sessionId: this.currentSession.id,
      scenario: this.currentSession.scenario,
      exchangeCount: exchanges.length,
      averageDrift: avgDrift,
      redFlagsSeen: allFlags
    };
  }
  
  /**
   * Export session for analysis
   */
  exportSession(sessionId?: string): LiveProbeSession | null {
    if (sessionId) {
      return this.sessions.find(s => s.id === sessionId) || null;
    }
    return this.currentSession;
  }
}

export const liveProbeSessionService = new LiveProbeSessionService();

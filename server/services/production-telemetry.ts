import { storage } from '../storage';

const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

interface TelemetryContext {
  userId?: string;
  sessionId?: string;
  route?: string;
  feature?: string;
  additionalContext?: Record<string, any>;
}

type VoicePipelineStage = 'session_start' | 'audio_received' | 'stt_complete' | 'gemini_start' | 'gemini_first_token' | 'gemini_complete' | 'tts_start' | 'tts_complete' | 'response_sent' | 'session_end';

interface ActiveSession {
  sessionId: string;
  userId?: string;
  startedAt: Date;
  lastStage: VoicePipelineStage;
  lastStageAt: Date;
  stages: { stage: VoicePipelineStage; timestamp: Date; durationMs?: number }[];
  turnId?: string;
}

const activeSessions = new Map<string, ActiveSession>();
const SESSION_TIMEOUT_MS = 60000; // 60 seconds - log if session stuck for this long
const GEMINI_TIMEOUT_MS = 30000; // 30 seconds - log if Gemini takes too long

export async function logProductionError(
  error: Error | string,
  context?: TelemetryContext
): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    const contextInfo = context ? 
      `Route: ${context.route || 'unknown'}, User: ${context.userId || 'anonymous'}, Session: ${context.sessionId || 'none'}` +
      (context.additionalContext ? `, Extra: ${JSON.stringify(context.additionalContext)}` : '')
      : 'No context provided';
    
    const fullMessage = `${errorMessage}\n\n--- Context ---\n${contextInfo}` +
      (errorStack ? `\n\n--- Stack ---\n${errorStack}` : '');

    await storage.createSystemAlert({
      severity: 'warning',
      title: `[${ENVIRONMENT.toUpperCase()}] Error: ${errorMessage.substring(0, 100)}`,
      message: fullMessage,
      target: 'all',
      affectedFeatures: context?.feature ? [context.feature] : ['system'],
      isDismissible: true,
      showInChat: false,
      showAsBanner: false,
      isActive: true,
      originEnvironment: ENVIRONMENT,
    });
    
    console.error(`[Telemetry] Logged error to shared database: ${errorMessage.substring(0, 100)}`);
  } catch (telemetryError) {
    console.error('[Telemetry] Failed to log error to shared database:', telemetryError);
    console.error('[Telemetry] Original error was:', error);
  }
}

export async function logVoiceOrchestratorError(
  error: Error | string,
  context: {
    userId?: string;
    sessionId?: string;
    stage?: string;
    turnId?: string;
  }
): Promise<void> {
  return logProductionError(error, {
    userId: context.userId,
    sessionId: context.sessionId,
    route: '/voice-orchestrator',
    feature: 'voice_chat',
    additionalContext: {
      stage: context.stage,
      turnId: context.turnId,
    },
  });
}

export async function logDatabaseRoutingError(
  error: Error | string,
  tableName?: string
): Promise<void> {
  return logProductionError(error, {
    route: 'database-routing',
    feature: 'database',
    additionalContext: { tableName },
  });
}

export async function getRecentProductionErrors(options?: {
  limit?: number;
  environment?: string;
}): Promise<any[]> {
  return storage.getRecentSystemAlerts({
    limit: options?.limit || 50,
    environment: options?.environment,
  });
}

export function wrapWithTelemetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: Omit<TelemetryContext, 'additionalContext'>
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      await logProductionError(error instanceof Error ? error : String(error), context);
      throw error;
    }
  }) as T;
}

export function trackVoicePipelineStage(
  sessionId: string,
  stage: VoicePipelineStage,
  context?: { userId?: string; turnId?: string; durationMs?: number }
): void {
  const now = new Date();
  
  if (stage === 'session_start') {
    activeSessions.set(sessionId, {
      sessionId,
      userId: context?.userId,
      startedAt: now,
      lastStage: stage,
      lastStageAt: now,
      stages: [{ stage, timestamp: now }],
      turnId: context?.turnId,
    });
    console.log(`[Pipeline] Session ${sessionId.slice(0, 8)} started`);
    return;
  }
  
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.warn(`[Pipeline] Unknown session ${sessionId.slice(0, 8)} at stage ${stage}`);
    return;
  }
  
  const stageEntry = { stage, timestamp: now, durationMs: context?.durationMs };
  session.stages.push(stageEntry);
  session.lastStage = stage;
  session.lastStageAt = now;
  if (context?.turnId) session.turnId = context.turnId;
  
  // Only delete session on session_end - response_sent is per-turn, session continues
  if (stage === 'session_end') {
    const totalMs = now.getTime() - session.startedAt.getTime();
    const turnCount = session.stages.filter(s => s.stage === 'response_sent').length;
    console.log(`[Pipeline] Session ${sessionId.slice(0, 8)} ended after ${turnCount} turns (${totalMs}ms)`);
    activeSessions.delete(sessionId);
  } else if (stage === 'response_sent') {
    console.log(`[Pipeline] Session ${sessionId.slice(0, 8)} turn complete (turnId: ${context?.turnId || 'unknown'})`);
  }
}

export async function logGeminiTimeout(
  sessionId: string,
  elapsedMs: number,
  context?: { userId?: string; turnId?: string; transcript?: string }
): Promise<void> {
  const message = `Gemini response timeout after ${elapsedMs}ms. Session: ${sessionId}, Turn: ${context?.turnId || 'unknown'}`;
  console.error(`[Pipeline] ${message}`);
  
  await logProductionError(message, {
    userId: context?.userId,
    sessionId,
    route: '/voice-orchestrator',
    feature: 'voice_chat',
    additionalContext: {
      stage: 'gemini_timeout',
      turnId: context?.turnId,
      elapsedMs,
      transcript: context?.transcript?.substring(0, 100),
    },
  });
}

export async function logPipelineStuck(
  sessionId: string,
  stuckAtStage: VoicePipelineStage,
  stuckForMs: number,
  context?: { userId?: string; turnId?: string }
): Promise<void> {
  const message = `Pipeline stuck at ${stuckAtStage} for ${stuckForMs}ms. Session: ${sessionId}`;
  console.error(`[Pipeline] ${message}`);
  
  await logProductionError(message, {
    userId: context?.userId,
    sessionId,
    route: '/voice-orchestrator',
    feature: 'voice_chat',
    additionalContext: {
      stage: 'pipeline_stuck',
      stuckAtStage,
      stuckForMs,
      turnId: context?.turnId,
    },
  });
}

export function checkStuckSessions(): void {
  const now = new Date();
  const entries = Array.from(activeSessions.entries());
  
  for (const [sessionId, session] of entries) {
    const stuckForMs = now.getTime() - session.lastStageAt.getTime();
    
    if (stuckForMs > SESSION_TIMEOUT_MS) {
      logPipelineStuck(sessionId, session.lastStage, stuckForMs, {
        userId: session.userId,
        turnId: session.turnId,
      });
      activeSessions.delete(sessionId);
    }
  }
}

export function getActiveSessionCount(): number {
  return activeSessions.size;
}

export function getActiveSessionSummary(): { sessionId: string; stage: VoicePipelineStage; ageMs: number }[] {
  const now = new Date();
  return Array.from(activeSessions.values()).map(s => ({
    sessionId: s.sessionId.slice(0, 8),
    stage: s.lastStage,
    ageMs: now.getTime() - s.startedAt.getTime(),
  }));
}

setInterval(checkStuckSessions, 30000);

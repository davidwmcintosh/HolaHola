import { storage } from '../storage';

const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

interface TelemetryContext {
  userId?: string;
  sessionId?: string;
  route?: string;
  feature?: string;
  additionalContext?: Record<string, any>;
}

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

export type GuardianSummaryFire = {
  path: 'pre-turn' | 'post-turn-phrase' | 'friction-signal' | 'hard-wall' | 'carry-forward-buffered' | 'carry-forward-injected';
  outcome: 'heard' | 'missed' | null;
};

export type GuardianSummaryValues = {
  guardianFires: number;
  guardianHardWalls: number;
  guardianHeard: number;
  guardianMissed: number;
  guardianCarryForward: number;
};

/** Persist the derived summary without making it authoritative evidence. */
export async function persistGuardianSummary(options: {
  dbSessionId: string | null | undefined;
  transientSessionId?: string;
  fireLog: readonly GuardianSummaryFire[];
  update: (dbSessionId: string, values: GuardianSummaryValues) => Promise<unknown[]>;
  timeoutMs?: number;
  warn?: (message: string, details: Record<string, unknown>) => void;
}): Promise<void> {
  const warn = options.warn ?? ((message, details) => console.warn(message, details));
  if (!options.dbSessionId) {
    warn('[GeminiLive] Guardian summary warning', {
      reason: 'missing_db_session_id',
      transientSessionId: options.transientSessionId,
    });
    return;
  }
  const values: GuardianSummaryValues = {
    guardianFires: options.fireLog.length,
    guardianHardWalls: options.fireLog.filter(fire => fire.path === 'hard-wall').length,
    guardianHeard: options.fireLog.filter(fire => fire.outcome === 'heard').length,
    guardianMissed: options.fireLog.filter(fire => fire.outcome === 'missed').length,
    guardianCarryForward: options.fireLog.filter(fire => fire.path === 'carry-forward-buffered').length,
  };
  const timeoutMs = options.timeoutMs ?? 3000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Promise.race attaches handlers to the update promise even if the timeout
    // wins, so a late rejection cannot become unhandled.
    const updatePromise = options.update(options.dbSessionId, values);
    const result = await Promise.race([
      updatePromise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`summary update timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    if (!result.length) {
      warn('[GeminiLive] Guardian summary warning', {
        reason: 'zero_row_match',
        dbSessionId: options.dbSessionId,
        values,
      });
      return;
    }
    console.log(`[GeminiLive] Guardian stats persisted — fires:${values.guardianFires} heard:${values.guardianHeard} missed:${values.guardianMissed} hard:${values.guardianHardWalls} carry:${values.guardianCarryForward}`);
  } catch (err: any) {
    warn('[GeminiLive] Guardian summary warning', {
      reason: err?.message?.includes('timed out') ? 'timeout' : 'write_failed',
      dbSessionId: options.dbSessionId,
      error: err?.message ?? String(err),
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
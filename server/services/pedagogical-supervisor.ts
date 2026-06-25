import type { StreamingSession } from './streaming-session-types';

export interface PedagogicalDirective {
  directive: string;
  urgency: 'emergency' | 'nudge';
}

/**
 * Evaluates real-time session state and returns a pedagogical directive when
 * the backend detects a condition Daniela should act on immediately.
 *
 * This is the "Emergency Brake" — injected as a [Pedagogical Supervisor] note
 * into the next tool response's result string, following the existing System
 * Whisper injection pattern in gemini-live-session.ts.
 *
 * Three trigger conditions (in priority order):
 *   1. Death Spiral — student struggling in PRACTICE/PRODUCTION, struggle count ≥ 3
 *   2. Phase too long — stuck in PRACTICE/PRODUCTION > 12 min without transitioning
 *   3. ACTFL/phase mismatch — novice learner in full PRODUCTION mode
 *
 * Returns null when the session is within normal operating range.
 * Fires at most once every 3 minutes per session to avoid directive noise.
 */
export function evaluatePedagogicalState(session: StreamingSession): PedagogicalDirective | null {
  const phase = session.currentSessionPhase;
  const struggleCount = session.sessionStruggleCount || 0;
  const lastFluency = (session as any)._lastFluency as string | undefined;
  const lastGear = (session as any)._lastGear as number | undefined;
  const phaseStartTime = (session as any)._phaseStartTime as number | undefined;
  const actflLevel = session.studentActflLevel || '';

  // Rate limit: don't fire more than once every 3 minutes to avoid directive fatigue.
  const lastDirectiveTime = (session as any)._lastDirectiveTime as number | undefined;
  if (lastDirectiveTime && (Date.now() - lastDirectiveTime) < 3 * 60 * 1000) {
    return null;
  }

  // 1. Death Spiral — student is struggling in a demanding phase
  if (
    struggleCount >= 3 &&
    (phase === 'PRACTICE' || phase === 'PRODUCTION') &&
    (lastFluency === 'struggling' || (lastGear !== undefined && lastGear <= 2))
  ) {
    (session as any)._lastDirectiveTime = Date.now();
    return {
      directive: `Student is struggling in ${phase} (${struggleCount} struggle signals this session, last gear ${lastGear ?? '?'}/5). Step back — offer a win, scaffold the next attempt, or drop to WARM_UP. Do not persist in the current demand level.`,
      urgency: 'emergency',
    };
  }

  // 2. Phase too long — stuck in PRACTICE/PRODUCTION > 12 minutes
  if (
    phaseStartTime &&
    (phase === 'PRACTICE' || phase === 'PRODUCTION') &&
    (Date.now() - phaseStartTime) > 12 * 60 * 1000
  ) {
    const minutesInPhase = Math.round((Date.now() - phaseStartTime) / 60000);
    (session as any)._lastDirectiveTime = Date.now();
    return {
      directive: `You have been in ${phase} for ~${minutesInPhase} minutes without a phase transition. If the student is tiring, move toward COOL_DOWN — name today's wins and set a cliffhanger.`,
      urgency: 'nudge',
    };
  }

  // 3. ACTFL/phase mismatch — novice learner in full PRODUCTION
  if (
    (actflLevel === 'novice_low' || actflLevel === 'novice_mid') &&
    phase === 'PRODUCTION'
  ) {
    (session as any)._lastDirectiveTime = Date.now();
    return {
      directive: `At ${actflLevel} level, full PRODUCTION may be too demanding. Consider stepping back to PRACTICE with more scaffolding.`,
      urgency: 'nudge',
    };
  }

  return null;
}

/**
 * Computes a unified scaffolding level (1-10) from ACTFL level, current gear,
 * and session struggle count. Backend owns this value.
 *
 * 1 = maximum scaffolding (full native-language support, slow pace)
 * 10 = no scaffolding (full target language, native speed, demanding follow-ups)
 *
 * Used by Session 3 (Scaffolding Slider) — echoed in tool returns so Daniela
 * maintains the level between calls via Contextual Echoing.
 */
export function computeScaffoldingLevel(session: StreamingSession): number {
  const actflLevel = session.studentActflLevel || '';
  const struggleCount = session.sessionStruggleCount || 0;
  const lastGear = (session as any)._lastGear as number | undefined;

  // Base from ACTFL level
  let base = 5;
  if (actflLevel === 'novice_low') base = 2;
  else if (actflLevel === 'novice_mid') base = 3;
  else if (actflLevel === 'novice_high') base = 4;
  else if (actflLevel === 'intermediate_low') base = 5;
  else if (actflLevel === 'intermediate_mid') base = 6;
  else if (actflLevel === 'intermediate_high') base = 7;
  else if (actflLevel.startsWith('advanced')) base = 8;
  else if (actflLevel === 'superior') base = 10;

  // Gear adjustment (model's current read on the session)
  let gearAdj = 0;
  if (lastGear !== undefined) {
    if (lastGear <= 1) gearAdj = -2;
    else if (lastGear === 2) gearAdj = -1;
    else if (lastGear === 4) gearAdj = +1;
    else if (lastGear >= 5) gearAdj = +2;
  }

  // Struggle penalty: -1 per 2 struggles, capped at -3
  const strugglePenalty = Math.min(3, Math.floor(struggleCount / 2));

  return Math.max(1, Math.min(10, base + gearAdj - strugglePenalty));
}

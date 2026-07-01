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
 * Four trigger conditions (in priority order):
 *   1. Thought-based struggle — Daniela's own reasoning flags confusion/struggle
 *      (detected via includeThoughts:true; fires below the normal rate-limit threshold)
 *   2. Death Spiral — student struggling in PRACTICE/PRODUCTION, struggle count ≥ 3
 *   3. Phase too long — stuck in PRACTICE/PRODUCTION > 12 min without transitioning
 *   4. ACTFL/phase mismatch — novice learner in full PRODUCTION mode
 *
 * Returns null when the session is within normal operating range.
 * Fires at most once every 3 minutes per session to avoid directive noise.
 *
 * @param thoughtText  Optional — Daniela's pre-response reasoning from includeThoughts:true.
 *                     Passed in from gemini-live-session.ts at generationComplete.
 *                     Used as an early-warning signal before struggle count climbs.
 */
export function evaluatePedagogicalState(session: StreamingSession, thoughtText?: string): PedagogicalDirective | null {
  const phase = session.currentSessionPhase;
  const lastFluency = (session as any)._lastFluency as string | undefined;
  const lastGear = (session as any)._lastGear as number | undefined;
  const phaseStartTime = (session as any)._phaseStartTime as number | undefined;
  const actflLevel = session.studentActflLevel || '';

  // ── Rolling 5-minute struggle window ──────────────────────────────────────
  // Filter raw timestamps to the last 5 min and write back (trims old entries).
  // Also prune entries that pre-date the current phase start so a struggle in
  // WARM_UP doesn't haunt the student when they reach PRODUCTION.
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const phaseFloor = phaseStartTime ?? 0;
  const rawTs: number[] = (session as any)._struggleTimestamps || [];
  const recentTs = rawTs.filter((t: number) => t > fiveMinAgo && t > phaseFloor);
  (session as any)._struggleTimestamps = recentTs;
  // Rolling count is used for trigger 2; global count still drives adaptive speed.
  const struggleCount = recentTs.length;

  // Rate limit: don't fire more than once every 3 minutes to avoid directive fatigue.
  const lastDirectiveTime = (session as any)._lastDirectiveTime as number | undefined;
  if (lastDirectiveTime && (Date.now() - lastDirectiveTime) < 3 * 60 * 1000) {
    return null;
  }

  // 1. Thought-based struggle signal — Daniela's own reasoning flags difficulty
  // before the struggle count has climbed to the rule-based threshold.
  // Keywords: language Daniela uses when she perceives the student is lost or stuck.
  // Lower confidence than rule-based triggers — only fires if already in a demanding phase.
  if (thoughtText && (phase === 'PRACTICE' || phase === 'PRODUCTION')) {
    const t = thoughtText.toLowerCase();
    // Phrases are student-centric to reduce false positives.
    // Avoided: bare "lost" (story context), "scaffold" alone (construction context).
    const thoughtFlagsStruggle =
      t.includes('struggling') ||
      t.includes('student is confused') ||
      t.includes('learner is confused') ||
      t.includes('seems confused') ||
      t.includes('not understanding') ||
      t.includes("doesn't understand") ||
      t.includes('student is lost') ||
      t.includes('learner is lost') ||
      t.includes('overwhelmed') ||
      t.includes('too difficult for') ||
      t.includes('step back') ||
      t.includes('need to scaffold') ||
      t.includes('should scaffold');

    if (thoughtFlagsStruggle) {
      console.log(`[PedagogicalSupervisor] Thought-based struggle signal detected in ${phase}`);
      (session as any)._lastDirectiveTime = Date.now();
      return {
        directive: `Your own reasoning flagged that the student may be struggling or confused. Trust that read — step back, offer a smaller win, or add scaffolding before continuing at this demand level.`,
        urgency: 'nudge',
      };
    }

    // 1b. Instruction Drift — Daniela's thoughts reveal intent to use grammar/vocabulary
    // far above the student's ACTFL level. Catches drift before she speaks.
    // Proxy: advanced grammar markers in thought text + student is novice or low-intermediate.
    // A second LLM call is not needed — keyword scan on the thought stream is sufficient
    // because Daniela's reasoning is explicit ("I'll use subjunctive here...").
    const isLowLevel =
      actflLevel === 'novice_low' ||
      actflLevel === 'novice_mid' ||
      actflLevel === 'novice_high' ||
      actflLevel === 'intermediate_low';

    if (isLowLevel) {
      const advancedMarkers = [
        'subjunctive', 'conditional perfect', 'past perfect', 'pluperfect',
        'future perfect', 'passive voice constructions', 'indirect discourse',
        'contrary to fact', 'sequence of tenses',
      ];
      // Negation guard: Daniela's thoughts often say "avoid X" or "not use X"
      // when she is correctly self-correcting. Don't fire on those cases.
      const driftMarker = advancedMarkers.find(m => {
        const hasMarker = t.includes(m);
        const isNegated =
          t.includes(`avoid ${m}`) ||
          t.includes(`not use ${m}`) ||
          t.includes(`no ${m}`) ||
          t.includes(`don't use ${m}`) ||
          t.includes(`shouldn't use ${m}`);
        return hasMarker && !isNegated;
      });
      if (driftMarker) {
        console.log(`[PedagogicalSupervisor] Drift detected — "${driftMarker}" in thought stream for ${actflLevel} student`);
        (session as any)._lastDirectiveTime = Date.now();
        return {
          directive: `Instruction drift: your reasoning mentioned "${driftMarker}" but the student is at ${actflLevel} level. Keep grammar at their level — present tense, simple structures, high-frequency vocabulary only.`,
          urgency: 'nudge',
        };
      }
    }
  }

  // 2. Death Spiral — student is struggling in a demanding phase
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

  // 3. Phase too long — stuck in PRACTICE/PRODUCTION > 12 minutes
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

  // 4. ACTFL/phase mismatch — novice learner in full PRODUCTION
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

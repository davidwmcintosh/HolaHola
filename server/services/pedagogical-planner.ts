// server/services/pedagogical-planner.ts
// GOAP (Goal-Oriented Action Planning) for Daniela — Path 2 of the Worldness Framework.
//
// Instead of Daniela improvising in context every turn, the Planner selects
// a pedagogical action based on the current world state and injects it as a
// stage direction alongside the student's utterance. Daniela becomes a
// Dungeon Master with a hidden agenda rather than a helpful mirror.
//
// Rule-based (no extra LLM call). Re-plans every turn.
// Injects on action type CHANGE or every 3 turns (heartbeat) to fight recency bias.
// BAILOUT fires unconditionally on 3+ consecutive struggle turns (Director's Safety Valve).
// Full doc: docs/worldness-framework.md — Path 2

export type PedagogicalActionType =
  | 'BAILOUT'         // Safety Valve — student stuck 3+ turns under pressure: lower the bar in-character
  | 'SCAFFOLD'        // Student failing or scene breaking — ease in, reduce pressure
  | 'CHALLENGE'       // Student comfortable and capable — raise the bar
  | 'ELICIT'          // Default: draw out response without filling the silence
  | 'PROGRESS_SCENE'  // Scene has run long enough — move toward completion
  | 'CELEBRATE';      // Student nailed something — acknowledge before pressing on

// ─── Directives ──────────────────────────────────────────────────────────────
// Stage directions in actor-note style — subtextual guidance, not imperative.
// Describe Daniela's internal awareness, not external system commands.

const DIRECTIVES: Record<PedagogicalActionType, string> = {
  BAILOUT:        '*(they are stuck — lower the bar right now, drop a hint in character, make it possible for them to succeed with one simple phrase)*',
  SCAFFOLD:       '*(they are reaching for it — ease in, meet them where they are)*',
  CHALLENGE:      '*(they have their footing — make them earn the next step, don\'t hand it to them)*',
  ELICIT:         '*(find the opening — let them construct it, don\'t fill the silence for them)*',
  PROGRESS_SCENE: '*(the scene can move forward now — lead them toward the next beat)*',
  CELEBRATE:      '*(they just got it — acknowledge it genuinely before pressing on)*',
};

// Used when the student goes quiet inside an active tense scene
const SILENCE_DIRECTIVE =
  '*(the silence is stretching — give them a gentle nudge to keep the momentum)*';

// ─── Planner ─────────────────────────────────────────────────────────────────
// Reads session state set by tension-evaluator.ts and the WS handler.
// Returns a stage direction string, or null if no injection is needed this turn.

export function selectPedagogicalDirective(session: any, isQuietTurn = false): string | null {
  if (!session?.sceneCanvas) return null;

  // ── Silence handling ───────────────────────────────────────────────────────
  const tension: number = typeof session.sceneTension === 'number' ? session.sceneTension : 0;
  if (isQuietTurn && tension > 0.40) {
    return SILENCE_DIRECTIVE;
  }

  const exchangeCount: number = session.studentPulse?.messageCount ?? 0;
  const lastAction = session.lastPedagogicalActionType as PedagogicalActionType | undefined;
  const turnsSinceLast: number = session.pedagogicalTurnsSinceDirective ?? 0;

  // Last turn scores stored by tension-evaluator.ts (session.lastTurnScores)
  const pragmaticScore: number = session.lastTurnScores?.pragmaticScore ?? 3;
  const socialFriction: number = session.lastTurnScores?.socialFriction ?? 1;

  // ── Director's Safety Valve (Graceful Degradation) ────────────────────────
  // Track consecutive struggle turns. Reset on any clear communication.
  // BAILOUT fires unconditionally — bypasses cooldown. It is the emergency signal.
  const isStruggleTurn = pragmaticScore <= 2 && tension > 0.40;
  const prevStreak: number = session.consecutiveStruggleTurns ?? 0;
  if (isStruggleTurn) {
    session.consecutiveStruggleTurns = prevStreak + 1;
  } else {
    session.consecutiveStruggleTurns = 0;
  }

  if ((session.consecutiveStruggleTurns ?? 0) >= 3) {
    // Hard reset the streak so bailout fires once, not every turn
    session.consecutiveStruggleTurns = 0;
    session.lastPedagogicalActionType = 'BAILOUT';
    session.pedagogicalTurnsSinceDirective = 0;
    console.log(
      `[GOAP] ${session.sceneCanvas?.environment} action=BAILOUT [Safety Valve] ` +
      `(prag=${pragmaticScore} tension=${tension.toFixed(2)} exchanges=${exchangeCount})`,
    );
    return DIRECTIVES.BAILOUT;
  }

  // ── Selection rules (priority order) ─────────────────────────────────────
  // Scaffold threshold 0.80 — preserve flow state (high tension + high performance).

  let action: PedagogicalActionType;

  if ((tension > 0.80) || (pragmaticScore <= 1) || (socialFriction >= 4)) {
    action = 'SCAFFOLD';
  } else if (pragmaticScore >= 5 && lastAction !== 'CELEBRATE') {
    action = 'CELEBRATE';
  } else if (pragmaticScore >= 4 && tension < 0.40) {
    action = 'CHALLENGE';
  } else if (exchangeCount > 14) {
    action = 'PROGRESS_SCENE';
  } else {
    action = 'ELICIT';
  }

  // ── Inject decision ───────────────────────────────────────────────────────
  // Inject if: action changed (course correction) OR heartbeat (3 turns without directive)

  const actionChanged = action !== lastAction;
  const heartbeatFired = turnsSinceLast >= 3;

  if (!actionChanged && !heartbeatFired) {
    session.pedagogicalTurnsSinceDirective = turnsSinceLast + 1;
    return null;
  }

  session.lastPedagogicalActionType = action;
  session.pedagogicalTurnsSinceDirective = 0;

  console.log(
    `[GOAP] ${session.sceneCanvas?.environment} action=${action}` +
    ` (prag=${pragmaticScore} friction=${socialFriction} tension=${tension.toFixed(2)}` +
    ` exchanges=${exchangeCount}${heartbeatFired && !actionChanged ? ' [heartbeat]' : ''})`,
  );

  return DIRECTIVES[action];
}

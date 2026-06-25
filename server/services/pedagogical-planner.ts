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
// Full doc: docs/worldness-framework.md — Path 2

export type PedagogicalActionType =
  | 'SCAFFOLD'        // Student failing or scene breaking — ease in, reduce pressure
  | 'CHALLENGE'       // Student comfortable and capable — raise the bar
  | 'ELICIT'          // Default: draw out response without filling the silence
  | 'PROGRESS_SCENE'  // Scene has run long enough — move toward completion
  | 'CELEBRATE';      // Student nailed something — acknowledge before pressing on

// ─── Directives ──────────────────────────────────────────────────────────────
// Stage directions in actor-note style — subtextual guidance, not imperative.
// Describe Daniela's internal awareness, not external system commands.

const DIRECTIVES: Record<PedagogicalActionType, string> = {
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
  // Short or empty student turn inside a tense scene — nudge without evaluating.
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

  // ── Selection rules (priority order) ─────────────────────────────────────
  // NOTE: Scaffold threshold is 0.80 (not 0.60) to avoid killing "flow state".
  // High tension + high pragmatic score = student in flow — don't intervene.

  let action: PedagogicalActionType;

  if ((tension > 0.80) || (pragmaticScore <= 1) || (socialFriction >= 4)) {
    // True distress: scene is breaking OR student is completely lost
    action = 'SCAFFOLD';
  } else if (pragmaticScore >= 5 && lastAction !== 'CELEBRATE') {
    // Student nailed it (no tension cap — celebrate even under mild pressure)
    action = 'CELEBRATE';
  } else if (pragmaticScore >= 4 && tension < 0.40) {
    // Comfortable and capable — challenge them
    action = 'CHALLENGE';
  } else if (exchangeCount > 14) {
    // Scene has run its natural arc — nudge toward completion
    action = 'PROGRESS_SCENE';
  } else {
    // Default: hold space, let them construct the response
    action = 'ELICIT';
  }

  // ── Inject decision ───────────────────────────────────────────────────────
  // Inject if: action changed (course correction) OR heartbeat (3 turns without directive)
  // This fights LLM recency bias — Daniela needs reminders to hold a sustained mode.

  const actionChanged = action !== lastAction;
  const heartbeatFired = turnsSinceLast >= 3;

  if (!actionChanged && !heartbeatFired) {
    // Increment turns-since counter but don't inject
    session.pedagogicalTurnsSinceDirective = turnsSinceLast + 1;
    return null;
  }

  // Inject — reset counter and record action
  session.lastPedagogicalActionType = action;
  session.pedagogicalTurnsSinceDirective = 0;

  console.log(
    `[GOAP] ${session.sceneCanvas?.environment} action=${action}` +
    ` (prag=${pragmaticScore} friction=${socialFriction} tension=${tension.toFixed(2)}` +
    ` exchanges=${exchangeCount}${heartbeatFired && !actionChanged ? ' [heartbeat]' : ''})`,
  );

  return DIRECTIVES[action];
}

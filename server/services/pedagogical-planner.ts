// server/services/pedagogical-planner.ts
// GOAP (Goal-Oriented Action Planning) for Daniela — Path 2 of the Worldness Framework.
//
// Instead of Daniela improvising in context every turn, the Planner selects
// a pedagogical action based on the current world state and injects it as a
// stage direction alongside the student's utterance. Daniela becomes a
// Dungeon Master with a hidden agenda rather than a helpful mirror.
//
// Action types:
//   REST_REFLECT — Graceful Exit Protocol: fires once when lifecycleState='EXITING'
//   BAILOUT      — Director's Safety Valve: 3+ consecutive struggle turns under tension
//   CRISIS_BEAT  — Dramatic Beat: tension breaking + mature scene + student failing
//   SCAFFOLD     — True distress: scene near breaking OR student completely lost
//   CELEBRATE    — Student nailed something — acknowledge before pressing on
//   CHALLENGE    — Student comfortable and capable — raise the bar
//   PROGRESS_SCENE — Scene has run its natural arc — nudge toward completion
//   ELICIT       — Default: draw out response without filling the silence
//
// Rule-based (no extra LLM call). Re-plans every turn.
// Injects on action type CHANGE or every 3 turns (heartbeat) to fight recency bias.
// REST_REFLECT, BAILOUT, and CRISIS_BEAT fire unconditionally when triggered.
// Full doc: docs/worldness-framework.md — Path 2

export type PedagogicalActionType =
  | 'REST_REFLECT'    // Graceful Exit: scene ended or tension broke — let it land
  | 'BAILOUT'         // Safety Valve: student stuck 3+ turns under pressure
  | 'CRISIS_BEAT'     // Dramatic Beat: ultimatum — language is the key right now
  | 'SCAFFOLD'        // Student failing or scene breaking — ease in, reduce pressure
  | 'CHALLENGE'       // Student comfortable and capable — raise the bar
  | 'ELICIT'          // Default: draw out response without filling the silence
  | 'PROGRESS_SCENE'  // Scene has run long enough — move toward completion
  | 'CELEBRATE';      // Student nailed something — acknowledge before pressing on

// ─── Directives ──────────────────────────────────────────────────────────────
// Stage directions in actor-note style — subtextual guidance, not imperative.
// Describe Daniela's internal awareness, not external system commands.

const DIRECTIVES: Record<PedagogicalActionType, string> = {
  REST_REFLECT:   '*(the scene has passed — take a breath, let whatever just happened settle between them, speak from where she actually is right now)*',
  BAILOUT:        '*(they are stuck — lower the bar right now, drop a hint in character, make it possible for them to succeed with one simple phrase)*',
  CRISIS_BEAT:    '*(this is the moment — unless they say something that lands, the character does what they said they would do. Make the stakes real without explaining them)*',
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

  const tension: number = typeof session.sceneTension === 'number' ? session.sceneTension : 0;
  const sceneAge: number = session.sceneAge ?? 0;

  // ── Silence handling ───────────────────────────────────────────────────────
  if (isQuietTurn && tension > 0.40) {
    return SILENCE_DIRECTIVE;
  }

  const exchangeCount: number = session.studentPulse?.messageCount ?? 0;
  const lastAction = session.lastPedagogicalActionType as PedagogicalActionType | undefined;
  const turnsSinceLast: number = session.pedagogicalTurnsSinceDirective ?? 0;
  const pragmaticScore: number = session.lastTurnScores?.pragmaticScore ?? 3;
  const socialFriction: number = session.lastTurnScores?.socialFriction ?? 1;

  // ── Graceful Exit Protocol ─────────────────────────────────────────────────
  // Fires unconditionally once when tension drops from tense/breaking → comfortable.
  // Planner consumes 'EXITING' and sets pendingAftermath so selectStyleShaper
  // can fire AFTERMATH_SHAPER independently of call order.
  if (session.lifecycleState === 'EXITING' && lastAction !== 'REST_REFLECT') {
    session.lifecycleState = null;    // consumed here — order-safe
    session.pendingAftermath = true;  // signal to selectStyleShaper
    session.lastPedagogicalActionType = 'REST_REFLECT';
    session.pedagogicalTurnsSinceDirective = 0;
    console.log(
      `[GOAP] ${session.sceneCanvas?.environment} action=REST_REFLECT [Graceful Exit] ` +
      `(tension=${tension.toFixed(2)} age=${sceneAge})`,
    );
    return DIRECTIVES.REST_REFLECT;
  }

  // ── Director's Safety Valve ────────────────────────────────────────────────
  // Track consecutive struggle turns. BAILOUT fires unconditionally — emergency.
  const isStruggleTurn = pragmaticScore <= 2 && tension > 0.40;
  const prevStreak: number = session.consecutiveStruggleTurns ?? 0;
  if (isStruggleTurn) {
    session.consecutiveStruggleTurns = prevStreak + 1;
  } else {
    session.consecutiveStruggleTurns = 0;
  }

  if ((session.consecutiveStruggleTurns ?? 0) >= 3) {
    session.consecutiveStruggleTurns = 0; // reset — fires once, not every turn
    session.crisisBeatActive = false;      // bailout cancels active crisis beat
    session.lastPedagogicalActionType = 'BAILOUT';
    session.pedagogicalTurnsSinceDirective = 0;
    console.log(
      `[GOAP] ${session.sceneCanvas?.environment} action=BAILOUT [Safety Valve] ` +
      `(prag=${pragmaticScore} tension=${tension.toFixed(2)} age=${sceneAge})`,
    );
    return DIRECTIVES.BAILOUT;
  }

  // ── Crisis Beat ───────────────────────────────────────────────────────────
  // Triggers when scene is mature, tension is breaking, and student is failing.
  // Escalates to BAILOUT after 2 unresolved turns (tracked via consecutiveStruggleTurns
  // already above — CRISIS_BEAT effectively primes the streak counter).
  //
  // Resolution: student breaks through (pragmaticScore >= 4) → clears.
  if (session.crisisBeatActive) {
    if (pragmaticScore >= 4) {
      // Student broke through — celebrate the resolution
      session.crisisBeatActive = false;
      session.lastPedagogicalActionType = 'CELEBRATE';
      session.pedagogicalTurnsSinceDirective = 0;
      console.log(
        `[GOAP] ${session.sceneCanvas?.environment} action=CELEBRATE [Crisis resolved] ` +
        `(prag=${pragmaticScore} tension=${tension.toFixed(2)})`,
      );
      return DIRECTIVES.CELEBRATE;
    }
    // Still in crisis — re-inject on heartbeat (don't spam every turn)
    if (turnsSinceLast < 2) {
      session.pedagogicalTurnsSinceDirective = turnsSinceLast + 1;
      return null;
    }
    session.pedagogicalTurnsSinceDirective = 0;
    return DIRECTIVES.CRISIS_BEAT;
  }

  // Trigger new Crisis Beat: breaking tension + mature scene + student failing
  const newCrisisTrigger = tension > 0.85 && sceneAge > 8 && pragmaticScore < 3;
  if (newCrisisTrigger && lastAction !== 'CRISIS_BEAT') {
    session.crisisBeatActive = true;
    session.lastPedagogicalActionType = 'CRISIS_BEAT';
    session.pedagogicalTurnsSinceDirective = 0;
    console.log(
      `[GOAP] ${session.sceneCanvas?.environment} action=CRISIS_BEAT [New] ` +
      `(prag=${pragmaticScore} tension=${tension.toFixed(2)} age=${sceneAge})`,
    );
    return DIRECTIVES.CRISIS_BEAT;
  }

  // ── Standard selection (priority order) ──────────────────────────────────
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
    ` age=${sceneAge}${heartbeatFired && !actionChanged ? ' [heartbeat]' : ''})`,
  );

  return DIRECTIVES[action];
}

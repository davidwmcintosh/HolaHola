// server/services/pedagogical-planner.ts
// GOAP (Goal-Oriented Action Planning) for Daniela — Path 2 of the Worldness Framework.
//
// Action types (priority order):
//   REST_REFLECT   — Graceful Exit: scene tension resolved — let it land
//   BAILOUT        — Safety Valve: 3+ consecutive struggle turns under pressure
//   CRISIS_BEAT    — Dramatic Beat: ultimatum — language is the key right now
//   SCAFFOLD       — True distress: scene near breaking OR student completely lost
//   CELEBRATE      — Student nailed something — acknowledge before pressing on
//   CHALLENGE      — Student comfortable and capable — raise the bar
//   PROGRESS_SCENE — Scene has run its natural arc
//   ELICIT         — Default: draw out response without filling the silence
//
// Social Affordances: register mismatch appended to directive when INCONGRUENT.
// Rule-based (no extra LLM call). Full doc: docs/worldness-framework.md — Path 2

export type PedagogicalActionType =
  | 'REST_REFLECT'
  | 'BAILOUT'
  | 'CRISIS_BEAT'
  | 'SCAFFOLD'
  | 'CHALLENGE'
  | 'ELICIT'
  | 'PROGRESS_SCENE'
  | 'CELEBRATE';

// ─── Directives ──────────────────────────────────────────────────────────────

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

// Social Affordance register notes — appended to main directive when register is incongruent
const REGISTER_NOTES: Record<string, string> = {
  INCONGRUENT_TOO_FORMAL:
    ' *(their register is too formal — the distance it creates is something the character feels, not something she corrects)*',
  INCONGRUENT_TOO_CASUAL:
    ' *(the register is off — they are being too casual with someone who expects more formality, and the character notices)*',
};

const SILENCE_DIRECTIVE =
  '*(the silence is stretching — give them a gentle nudge to keep the momentum)*';

// ─── Planner ─────────────────────────────────────────────────────────────────

export function selectPedagogicalDirective(session: any, isQuietTurn = false): string | null {
  if (!session?.sceneCanvas) return null;

  const tension: number = typeof session.sceneTension === 'number' ? session.sceneTension : 0;
  const sceneAge: number = session.sceneAge ?? 0;

  if (isQuietTurn && tension > 0.40) return SILENCE_DIRECTIVE;

  const exchangeCount: number = session.studentPulse?.messageCount ?? 0;
  const lastAction = session.lastPedagogicalActionType as PedagogicalActionType | undefined;
  const turnsSinceLast: number = session.pedagogicalTurnsSinceDirective ?? 0;
  const pragmaticScore: number = session.lastTurnScores?.pragmaticScore ?? 3;
  const socialFriction: number = session.lastTurnScores?.socialFriction ?? 1;
  const socialRegister: string = session.lastTurnScores?.socialRegister ?? 'HARMONIC';

  // Helper: build final directive string with optional register note
  const withRegisterNote = (base: string): string => {
    const note = REGISTER_NOTES[socialRegister];
    return note ? base + note : base;
  };

  // ── Graceful Exit Protocol ────────────────────────────────────────────────
  if (session.lifecycleState === 'EXITING' && lastAction !== 'REST_REFLECT') {
    session.lifecycleState = null;
    session.pendingAftermath = true;
    session.lastPedagogicalActionType = 'REST_REFLECT';
    session.pedagogicalTurnsSinceDirective = 0;
    console.log(`[GOAP] ${session.sceneCanvas?.environment} action=REST_REFLECT [Graceful Exit] (tension=${tension.toFixed(2)} age=${sceneAge})`);
    return DIRECTIVES.REST_REFLECT; // no register note on exit
  }

  // ── Director's Safety Valve ───────────────────────────────────────────────
  const isStruggleTurn = pragmaticScore <= 2 && tension > 0.40;
  session.consecutiveStruggleTurns = isStruggleTurn
    ? (session.consecutiveStruggleTurns ?? 0) + 1
    : 0;

  if ((session.consecutiveStruggleTurns ?? 0) >= 3) {
    session.consecutiveStruggleTurns = 0;
    session.crisisBeatActive = false;
    session.lastPedagogicalActionType = 'BAILOUT';
    session.pedagogicalTurnsSinceDirective = 0;
    console.log(`[GOAP] ${session.sceneCanvas?.environment} action=BAILOUT [Safety Valve] (prag=${pragmaticScore} tension=${tension.toFixed(2)} age=${sceneAge})`);
    return DIRECTIVES.BAILOUT;
  }

  // ── Crisis Beat ───────────────────────────────────────────────────────────
  if (session.crisisBeatActive) {
    if (pragmaticScore >= 4) {
      session.crisisBeatActive = false;
      session.lastPedagogicalActionType = 'CELEBRATE';
      session.pedagogicalTurnsSinceDirective = 0;
      console.log(`[GOAP] ${session.sceneCanvas?.environment} action=CELEBRATE [Crisis resolved] (prag=${pragmaticScore})`);
      return withRegisterNote(DIRECTIVES.CELEBRATE);
    }
    if (turnsSinceLast < 2) {
      session.pedagogicalTurnsSinceDirective = turnsSinceLast + 1;
      return null;
    }
    session.pedagogicalTurnsSinceDirective = 0;
    return withRegisterNote(DIRECTIVES.CRISIS_BEAT);
  }

  if (tension > 0.85 && sceneAge > 8 && pragmaticScore < 3 && lastAction !== 'CRISIS_BEAT') {
    session.crisisBeatActive = true;
    session.crisisBeatEverActive = true; // for Memory Distillation
    session.lastPedagogicalActionType = 'CRISIS_BEAT';
    session.pedagogicalTurnsSinceDirective = 0;
    console.log(`[GOAP] ${session.sceneCanvas?.environment} action=CRISIS_BEAT [New] (prag=${pragmaticScore} tension=${tension.toFixed(2)} age=${sceneAge})`);
    return withRegisterNote(DIRECTIVES.CRISIS_BEAT);
  }

  // ── Standard selection ────────────────────────────────────────────────────
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
    ` register=${socialRegister} age=${sceneAge}${heartbeatFired && !actionChanged ? ' [heartbeat]' : ''})`,
  );

  return withRegisterNote(DIRECTIVES[action]);
}

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
// World Mutation: returns CanvasMutation[] alongside the directive so the caller
// can mutate the scene canvas as a consequence of pedagogical state changes.
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

// ─── World Mutation types ─────────────────────────────────────────────────────

export interface CanvasMutation {
  type: 'set_prop_state' | 'remove_prop';
  propName: string;
  state?: string;
}

export interface PedagogicalResult {
  directive: string | null;
  mutations: CanvasMutation[];
}

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

// ─── Prop Awareness ───────────────────────────────────────────────────────────
// When ELICIT fires, ground the elicitation in a specific prop from the scene canvas.
// Fires every other ELICIT — prevents prop-spamming while keeping the room present.
// Tracks referenced props on session.referencedPropIds to cycle through all available.
// Also tracks session.lastGroundedProp (prop name) for world mutation targeting.

interface SceneProp {
  name: string;
  label: string;
  imageUrl?: string;
  nativeLabel?: string;
  state?: string;
  vocab?: { word: string; translation: string }[];
}

function selectPropGrounding(session: any): string | null {
  const props: SceneProp[] = session?.sceneCanvas?.props ?? [];
  if (props.length === 0) return null;

  // Priority: student just tapped a specific prop — use it directly, no throttle
  const tapped = session.recentlyTappedProp as { id: string; label: string } | undefined;
  if (tapped?.label) {
    session.recentlyTappedProp = null;
    session.lastGroundedProp = tapped.id;
    session.propGroundingAge = 0; // reset age — grounding is fresh
    // Mark it referenced so the cycle knows it's been used
    const referenced: string[] = session.referencedPropIds ?? [];
    if (!referenced.includes(tapped.id)) {
      session.referencedPropIds = [...referenced, tapped.id];
    }
    return `*(she focuses on the ${tapped.label.toLowerCase()} the student just touched — the room is speaking, she lets it)*`;
  }

  // Every other ELICIT only (ambient cycle)
  const elicitCount: number = session.elicitCount ?? 0;
  session.elicitCount = elicitCount + 1;
  if (elicitCount % 2 !== 0) return null;

  // Pick an unreferenced prop first; reset cycle if all used
  const referenced: string[] = session.referencedPropIds ?? [];
  const unreferenced = props.filter(p => !referenced.includes(p.name));
  const pool = unreferenced.length > 0 ? unreferenced : props;

  // Prefer lighter props at low tension, heavier-sounding ones at high tension
  const tension: number = session.sceneTension ?? 0;
  const chosen = tension > 0.55
    ? pool[pool.length - 1]   // last in list — often more dramatic
    : pool[0];

  if (!chosen) return null;

  session.lastGroundedProp = chosen.name;
  session.propGroundingAge = 0; // reset age — grounding is fresh

  if (unreferenced.length === 0) session.referencedPropIds = [chosen.name];
  else session.referencedPropIds = [...referenced, chosen.name];

  return `*(she lets her eye fall on the ${chosen.label.toLowerCase()} — the room has things in it, she doesn't have to carry the silence alone)*`;
}

// ─── Canvas Mutation Builder ──────────────────────────────────────────────────
// Decides what prop state changes (if any) should accompany a GOAP action.
// Gemini's "Reactive Manifestation" principle: every pedagogical change should
// have a visual manifestation in the world.
//
// CELEBRATE: the last grounded prop moves to 'success' state (e.g. empty cup → full)
// BAILOUT:   the last grounded prop moves to 'cold' state — world reflects the stumble
//            ("your coffee got cold while we were figuring that out")
// All others: no mutation — don't mutate the world on every turn, only on clear outcomes

function buildMutations(action: PedagogicalActionType, session: any): CanvasMutation[] {
  const propName: string | undefined = session.lastGroundedProp;
  if (!propName) return [];

  // Ghost Grounding guard (Gemini Q2): only mutate if the grounding is recent.
  // propGroundingAge increments each turn; resets to 0 when a prop is chosen in selectPropGrounding.
  // If > 1 turn has passed since grounding, the causal link is too loose to be credible.
  const propGroundingAge: number = session.propGroundingAge ?? 99;
  if (propGroundingAge > 1) return [];

  // BAILOUT only — 'cold' state is genuine Reactive Manifestation (world dims on communication failure).
  // CELEBRATE is intentionally removed: 'success' state fires from lexical mastery detection
  // in tension-evaluator.ts (when vocab words are *named*), not from the teacher's mood.
  if (action === 'BAILOUT') {
    return [{ type: 'set_prop_state', propName, state: 'cold' }];
  }
  return [];
}

// ─── Planner ─────────────────────────────────────────────────────────────────

export function selectPedagogicalDirective(session: any, isQuietTurn = false): PedagogicalResult {
  if (!session?.sceneCanvas) return { directive: null, mutations: [] };

  // Increment prop grounding age only on turns with real student speech.
  // Quiet turns (no transcript — VAD-only) don't consume the grounding window.
  // (Gemini Q2: prevents "interrupted thought" false negatives)
  if (session.propGroundingAge !== undefined && !isQuietTurn) session.propGroundingAge += 1;

  const tension: number = typeof session.sceneTension === 'number' ? session.sceneTension : 0;
  const sceneAge: number = session.sceneAge ?? 0;

  if (isQuietTurn && tension > 0.40) return { directive: SILENCE_DIRECTIVE, mutations: [] };

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
    return { directive: DIRECTIVES.REST_REFLECT, mutations: [] };
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
    return { directive: DIRECTIVES.BAILOUT, mutations: buildMutations('BAILOUT', session) };
  }

  // ── Crisis Beat ───────────────────────────────────────────────────────────
  if (session.crisisBeatActive) {
    if (pragmaticScore >= 4) {
      session.crisisBeatActive = false;
      session.lastPedagogicalActionType = 'CELEBRATE';
      session.pedagogicalTurnsSinceDirective = 0;
      console.log(`[GOAP] ${session.sceneCanvas?.environment} action=CELEBRATE [Crisis resolved] (prag=${pragmaticScore})`);
      return { directive: withRegisterNote(DIRECTIVES.CELEBRATE), mutations: buildMutations('CELEBRATE', session) };
    }
    if (turnsSinceLast < 2) {
      session.pedagogicalTurnsSinceDirective = turnsSinceLast + 1;
      return { directive: null, mutations: [] };
    }
    session.pedagogicalTurnsSinceDirective = 0;
    return { directive: withRegisterNote(DIRECTIVES.CRISIS_BEAT), mutations: [] };
  }

  if (tension > 0.85 && sceneAge > 8 && pragmaticScore < 3 && lastAction !== 'CRISIS_BEAT') {
    session.crisisBeatActive = true;
    session.crisisBeatEverActive = true;
    session.lastPedagogicalActionType = 'CRISIS_BEAT';
    session.pedagogicalTurnsSinceDirective = 0;
    console.log(`[GOAP] ${session.sceneCanvas?.environment} action=CRISIS_BEAT [New] (prag=${pragmaticScore} tension=${tension.toFixed(2)} age=${sceneAge})`);
    return { directive: withRegisterNote(DIRECTIVES.CRISIS_BEAT), mutations: [] };
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
    return { directive: null, mutations: [] };
  }

  session.lastPedagogicalActionType = action;
  session.pedagogicalTurnsSinceDirective = 0;

  console.log(
    `[GOAP] ${session.sceneCanvas?.environment} action=${action}` +
    ` (prag=${pragmaticScore} friction=${socialFriction} tension=${tension.toFixed(2)}` +
    ` register=${socialRegister} age=${sceneAge}${heartbeatFired && !actionChanged ? ' [heartbeat]' : ''})`,
  );

  const baseDirective = withRegisterNote(DIRECTIVES[action]);

  // Prop Awareness: ground ELICIT in a specific scene prop every other turn
  if (action === 'ELICIT') {
    const propGrounding = selectPropGrounding(session);
    if (propGrounding) {
      return { directive: baseDirective + ' ' + propGrounding, mutations: buildMutations(action, session) };
    }
  }

  return { directive: baseDirective, mutations: buildMutations(action, session) };
}

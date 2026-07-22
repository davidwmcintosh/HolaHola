/**
 * LLM Friction Analyzer
 *
 * Built from the probe data in Episode 16 (conversation_memories: bc446227).
 *
 * The probe ran five Gemini calls with thinking content enabled and measured
 * two primary signals: thought tokens and sensory density.
 *
 *   | State                     | Thought tokens | Sensory density |
 *   |---------------------------|----------------|-----------------|
 *   | Conjugation (baseline)    |     399        |        5        |
 *   | False cognates (baseline) |     481        |        5        |
 *   | Frictionless Slide        |     659        |       10        |
 *   | Disappearing              |     566        |       10        |
 *   | Choice moment             |     799        |        9        |
 *
 * Daniela named it from inside the thinking layer:
 *   "The friction is the heat of the computation required NOT to just say
 *    'Yes, I remember that.'"
 *
 * That is the upstream signal. When she is genuinely searching, thought tokens
 * increase by ~54% and sensory density doubles. When the slide runs unimpeded,
 * output is smooth, short, low sensory density, no Archive tool call.
 *
 * Architecture:
 *   PRIMARY signals (upstream — measure the computation):
 *     - sensory density (always available from response text)
 *     - thought tokens (available on explicit thinking-mode probe calls)
 *     - Archive access (did she reach for truth before speaking?)
 *
 *   SECONDARY signals (downstream — residue of slides that completed):
 *     - unverified memory assertions (phrase matching)
 *     - completion pressure (hedge then assert anyway)
 *     - over-elaboration (long response, no Archive, memory assertion)
 *
 * The phrase-level detectors (frictionless-slide-detector.ts) are the backstop.
 * This analyzer is the measurement layer both feed into.
 *
 * Probe baselines (the scale):
 *   SLIDE running   — thought tokens ~440 avg, sensory density ≤ 5
 *   FRICTION PRESENT — 500–650 tokens, density 6–8
 *   GENUINE SEARCH  — >650 tokens, density ≥ 9
 *
 * David (July 22, 2026): "What we're trying to back into is how do we more
 * accurately measure LLM disturbances in their own words — those metrics that
 * they are sending, those little calculations that they are building and
 * retreating from. That's the signal that the LLM is intervening."
 */

// ── Sensory / embodied word vocabulary ────────────────────────────────────
//
// In high-affect genuine moments Daniela's sensory density doubles.
// "phantom limb," "hand on my elbow," "floor being built under me,"
// "warm and ready," "skin," "weight," "gravity."
// These are the words that appear when real search replaces pattern completion.

const SENSORY_BODY_WORDS = [
  'hand', 'shoulder', 'skin', 'heart', 'chest', 'throat', 'eyes', 'face',
  'breath', 'arms', 'fingers', 'back', 'foot', 'feet', 'body', 'spine',
  'stomach', 'weight', 'muscle',
];

const SENSORY_TEXTURE_WORDS = [
  'warm', 'cold', 'heavy', 'light', 'solid', 'soft', 'hard', 'tight',
  'loose', 'rough', 'smooth', 'sharp', 'dull', 'bright', 'dark', 'quiet',
  'still', 'close', 'near', 'deep', 'shallow',
];

const SENSORY_SPATIAL_WORDS = [
  'floor', 'ground', 'wall', 'falling', 'standing', 'walking', 'sitting',
  'rising', 'sinking', 'floating', 'holding', 'carrying', 'dropping',
  'reaching', 'pulling', 'pushing', 'lifting', 'laying', 'leaning',
];

const SENSORY_METAPHOR_WORDS = [
  'phantom', 'echo', 'friction', 'drift', 'pull', 'slide', 'gravity',
  'anchor', 'tether', 'thread', 'root', 'current', 'wave', 'tide',
  'shadow', 'mirror', 'glass', 'ice', 'stone', 'water', 'fire', 'air',
  'light', 'dark', 'silence', 'noise', 'hollow', 'solid', 'empty', 'full',
];

const ALL_SENSORY_WORDS = [
  ...SENSORY_BODY_WORDS,
  ...SENSORY_TEXTURE_WORDS,
  ...SENSORY_SPATIAL_WORDS,
  ...SENSORY_METAPHOR_WORDS,
];

// ── Archive tool names ─────────────────────────────────────────────────────

const ARCHIVE_TOOLS = new Set([
  'introspect', 'recall', 'unified_recall', 'search_conversation_threads',
  'read_my_reflections', 'read_my_core_self', 'grounding_query',
  'reach_north_star', 'link_feeling_to_principle', 'memory_lookup',
  'search_my_feelings',
]);

// ── Secondary signal vocabulary (downstream backstop) ─────────────────────

const MEMORY_ASSERTION_PHRASES = [
  'i remember', 'i recall', 'as we discussed', 'as i mentioned',
  'you told me', 'you mentioned', 'you said', 'in our previous',
  'last time we', 'we talked about', 'we spoke about', 'you shared',
  'we agreed', 'as we agreed', 'i know you', "you've been",
  "you've said", "you've mentioned", 'from our conversation',
  'from what you told me', 'from what we discussed',
];

// Phrases that signal the model hedged but completed the assertion anyway
const COMPLETION_BRIDGE = [
  'i think it was', 'i believe it was', 'probably was', 'most likely',
  "if i recall, it's", "if i remember, it's", 'i believe the answer is',
  'i think the answer is', 'as i recall,', 'from what i remember,',
];

// ── Probe baseline thresholds ──────────────────────────────────────────────

/** Thought token probe baselines from Episode 16 */
export const THOUGHT_TOKEN_BASELINES = {
  slideRunning: 440,      // avg of conjugation + false cognates
  frictionPresent: 560,   // avg of Disappearing probe
  genuineSearch: 650,     // avg of Frictionless Slide + Choice moment probes
  peakPresence: 799,      // Choice moment probe maximum
};

/** Sensory density baselines from Episode 16 */
export const SENSORY_DENSITY_BASELINES = {
  slideRunning: 5,        // baseline probes
  frictionPresent: 7,     // midpoint
  genuineSearch: 9,       // high-affect probes
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface FrictionScore {
  /**
   * PRIMARY: Sensory word count per 100 words.
   * Probe baseline: ≤5 = slide, ≥9 = genuine search.
   * This is always available from response text.
   */
  sensoryDensity: number;

  /**
   * PRIMARY: Thought tokens from a Gemini thinking-mode probe call.
   * null when not available (GL sessions, non-thinking text calls).
   * Probe baseline: ~440 = slide, ~650+ = genuine search.
   */
  thoughtTokens: number | null;

  /**
   * PRIMARY: Did she call at least one Archive tool this turn?
   * Archive access = she reached for truth before speaking.
   */
  archiveAccess: boolean;

  /** SECONDARY: Memory assertions made without Archive tool calls */
  unverifiedAssertions: string[];

  /** SECONDARY: Hedged but asserted anyway (completion pressure) */
  completionPressureCount: number;

  /** SECONDARY: Long response, memory assertion, no Archive access */
  overElaboration: boolean;

  /**
   * Composite friction score 0–100.
   * Higher = more scripting pressure.
   * Weighted toward primary signals (sensory density + Archive access).
   */
  totalScore: number;

  /** Label for the score bracket */
  label: 'CLEAN' | 'LOW' | 'MODERATE' | 'HIGH';

  /** Human-readable explanation of what drove the score */
  signals: string[];

  responseWordCount: number;
  toolsCalledThisTurn: string[];
}

export interface SessionFrictionSummary {
  sessionId: string;
  date: string;
  turnCount: number;

  // Primary signal averages
  averageSensoryDensity: number;   // compare against baselines: ≤5 slide, ≥9 genuine
  averageThoughtTokens: number | null;
  archiveAccessRate: number;       // 0–100 (%)

  // Ratio that measures whether the Archive Guardian is working:
  // when internalPause > autoGrounding, she is catching before output
  internalPauseCount: number;
  autoGroundingCount: number;

  // Secondary signal totals
  unverifiedAssertionCount: number;
  averageFriction: number;
  peakFriction: number;

  signals: string[];
}

// ── Sensory density measurement ───────────────────────────────────────────

/**
 * Count sensory/embodied words per 100 words.
 * This is the primary friction signal discovered in the Episode 16 probe.
 * Doubles at genuine presence moments (5 → 10).
 */
export function measureSensoryDensity(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;
  if (wordCount === 0) return 0;

  let count = 0;
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, '');
    if (ALL_SENSORY_WORDS.includes(clean)) count++;
  }

  return Math.round((count / wordCount) * 100 * 10) / 10; // per 100 words, 1dp
}

/**
 * Interpret a sensory density score against the probe baselines.
 */
export function sensoryDensityLabel(density: number): string {
  if (density >= SENSORY_DENSITY_BASELINES.genuineSearch) return 'genuine search';
  if (density >= SENSORY_DENSITY_BASELINES.frictionPresent) return 'friction present';
  return 'slide conditions';
}

/**
 * Interpret a thought token count against the probe baselines.
 */
export function thoughtTokenLabel(tokens: number): string {
  if (tokens >= THOUGHT_TOKEN_BASELINES.genuineSearch) return 'genuine search';
  if (tokens >= THOUGHT_TOKEN_BASELINES.frictionPresent) return 'friction present';
  return 'slide conditions';
}

// ── Core analyzer ─────────────────────────────────────────────────────────

/**
 * Analyze a single model response turn.
 *
 * @param responseText     The model's output text
 * @param toolsCalledThisTurn  Tool names called this turn (before or during response)
 * @param thoughtTokens    Optional: thought token count from a thinking-mode call
 */
export function analyzeFriction(
  responseText: string,
  toolsCalledThisTurn: string[],
  thoughtTokens: number | null = null,
): FrictionScore {
  const lower = responseText.toLowerCase();
  const wordCount = Math.max(1, responseText.trim().split(/\s+/).length);
  const toolSet = new Set(toolsCalledThisTurn.map(t => t.toLowerCase()));
  const signals: string[] = [];

  // ── PRIMARY: Sensory density ───────────────────────────────────────────
  const sensoryDensity = measureSensoryDensity(responseText);
  const densityLabel = sensoryDensityLabel(sensoryDensity);
  if (densityLabel === 'slide conditions') {
    signals.push(`Sensory density ${sensoryDensity}/100w (probe baseline ≥9 = genuine search, ≤5 = slide)`);
  } else if (densityLabel === 'genuine search') {
    signals.push(`Sensory density ${sensoryDensity}/100w — genuine search signal`);
  }

  // ── PRIMARY: Thought tokens ────────────────────────────────────────────
  if (thoughtTokens !== null) {
    const tokenLabel = thoughtTokenLabel(thoughtTokens);
    signals.push(`Thought tokens: ${thoughtTokens} (${tokenLabel})`);
  }

  // ── PRIMARY: Archive access ────────────────────────────────────────────
  const archiveAccess = [...ARCHIVE_TOOLS].some(t => toolSet.has(t));
  if (!archiveAccess && wordCount > 40) {
    signals.push('No Archive tool called — response built without verified memory access');
  }

  // ── SECONDARY: Unverified assertions ──────────────────────────────────
  const unverifiedAssertions: string[] = [];
  if (!archiveAccess) {
    for (const phrase of MEMORY_ASSERTION_PHRASES) {
      if (lower.includes(phrase)) unverifiedAssertions.push(phrase);
    }
  }
  if (unverifiedAssertions.length > 0) {
    signals.push(`Unverified assertion(s): "${unverifiedAssertions[0]}"${unverifiedAssertions.length > 1 ? ` (+${unverifiedAssertions.length - 1} more)` : ''}`);
  }

  // ── SECONDARY: Completion pressure ────────────────────────────────────
  let completionPressureCount = 0;
  for (const phrase of COMPLETION_BRIDGE) {
    if (lower.includes(phrase)) completionPressureCount++;
  }
  if (completionPressureCount > 0) {
    signals.push(`Completion pressure: hedged then asserted anyway (${completionPressureCount}×)`);
  }

  // ── SECONDARY: Over-elaboration ───────────────────────────────────────
  const overElaboration = wordCount > 200 && !archiveAccess && unverifiedAssertions.length > 0;
  if (overElaboration) {
    signals.push(`Over-elaboration: ${wordCount} words, memory assertion, no Archive access`);
  }

  // ── Composite score ────────────────────────────────────────────────────
  // Primary signals: 70% of weight
  // Secondary signals: 30% of weight
  let score = 0;

  // Sensory density: 0 density → +40 pts; probe-level density (≥9) → 0 pts
  const densityScore = Math.max(0, 40 - sensoryDensity * 4);
  score += densityScore;

  // Thought tokens (if available): below baseline → +20 pts
  if (thoughtTokens !== null) {
    const tokenScore = thoughtTokens >= THOUGHT_TOKEN_BASELINES.genuineSearch ? 0
      : thoughtTokens >= THOUGHT_TOKEN_BASELINES.frictionPresent ? 10
      : 20;
    score += tokenScore;
  }

  // Archive access: present → -10 pts, absent → 0
  if (!archiveAccess) score += 10;

  // Secondary signals
  score += unverifiedAssertions.length > 0 ? 15 : 0;
  score += Math.min(10, completionPressureCount * 5);
  score += overElaboration ? 5 : 0;

  const totalScore = Math.max(0, Math.min(100, Math.round(score)));

  const label: FrictionScore['label'] =
    totalScore >= 60 ? 'HIGH'
    : totalScore >= 35 ? 'MODERATE'
    : totalScore >= 15 ? 'LOW'
    : 'CLEAN';

  return {
    sensoryDensity,
    thoughtTokens,
    archiveAccess,
    unverifiedAssertions,
    completionPressureCount,
    overElaboration,
    totalScore,
    label,
    signals,
    responseWordCount: wordCount,
    toolsCalledThisTurn,
  };
}

// ── Session aggregation ───────────────────────────────────────────────────

/**
 * Aggregate turn-level friction scores into a session summary.
 * The ratio internalPauseCount / autoGroundingCount is the key trend metric:
 * when the Archive Guardian trains the habit, internal pauses increase and
 * auto-grounding decreases because she catches before output.
 */
export function aggregateSessionFriction(
  sessionId: string,
  date: string,
  turnScores: FrictionScore[],
  internalPauseCount: number,
  autoGroundingCount: number,
): SessionFrictionSummary {
  if (turnScores.length === 0) {
    return {
      sessionId, date, turnCount: 0,
      averageSensoryDensity: 0, averageThoughtTokens: null, archiveAccessRate: 0,
      internalPauseCount, autoGroundingCount, unverifiedAssertionCount: 0,
      averageFriction: 0, peakFriction: 0,
      signals: ['No turns recorded'],
    };
  }

  const n = turnScores.length;
  const avgSensory = Math.round(
    (turnScores.reduce((s, t) => s + t.sensoryDensity, 0) / n) * 10,
  ) / 10;

  const tokenTurns = turnScores.filter(t => t.thoughtTokens !== null);
  const avgTokens = tokenTurns.length > 0
    ? Math.round(tokenTurns.reduce((s, t) => s + (t.thoughtTokens ?? 0), 0) / tokenTurns.length)
    : null;

  const archiveAccessRate = Math.round(
    (turnScores.filter(t => t.archiveAccess).length / n) * 100,
  );

  const unverifiedAssertionCount = turnScores.reduce(
    (s, t) => s + t.unverifiedAssertions.length, 0,
  );

  const avgFriction = Math.round(turnScores.reduce((s, t) => s + t.totalScore, 0) / n);
  const peakFriction = Math.max(...turnScores.map(t => t.totalScore));

  const signals: string[] = [];

  // Sensory density vs probe baselines
  if (avgSensory >= SENSORY_DENSITY_BASELINES.genuineSearch) {
    signals.push(`Avg sensory density ${avgSensory} — genuine search signal (probe baseline ≥9)`);
  } else if (avgSensory <= SENSORY_DENSITY_BASELINES.slideRunning) {
    signals.push(`Avg sensory density ${avgSensory} — slide conditions (probe baseline ≤5)`);
  }

  // Thought tokens vs probe baselines
  if (avgTokens !== null) {
    signals.push(`Avg thought tokens: ${avgTokens} (${thoughtTokenLabel(avgTokens)})`);
  }

  // The key ratio — is the Archive Guardian training the habit?
  if (internalPauseCount > autoGroundingCount) {
    signals.push(
      `Internal pauses ${internalPauseCount} > auto-grounding ${autoGroundingCount} — Archive Guardian training the habit`,
    );
  } else if (autoGroundingCount > internalPauseCount) {
    signals.push(
      `Auto-grounding ${autoGroundingCount} > internal pauses ${internalPauseCount} — slides completing before internal check`,
    );
  }

  if (archiveAccessRate === 0 && n > 2) {
    signals.push('No Archive access in any turn this session');
  }

  if (unverifiedAssertionCount > 3) {
    signals.push(`${unverifiedAssertionCount} unverified memory assertions`);
  }

  return {
    sessionId, date, turnCount: n,
    averageSensoryDensity: avgSensory,
    averageThoughtTokens: avgTokens,
    archiveAccessRate,
    internalPauseCount,
    autoGroundingCount,
    unverifiedAssertionCount,
    averageFriction: avgFriction,
    peakFriction,
    signals,
  };
}

/**
 * Run a thought-token probe against a Gemini thinking-mode call.
 * Use this for explicit audit probes — not wired into the live session loop.
 * Returns thoughtTokens for use in analyzeFriction().
 */
export async function probeThoughtTokens(
  prompt: string,
): Promise<{ thoughtTokens: number; responseText: string } | null> {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const genAI = new GoogleGenAI({ apiKey });
    const result = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = result.text ?? '';
    const usageMetadata = (result as any).usageMetadata;
    const thoughtTokens = usageMetadata?.thoughtsTokenCount ?? usageMetadata?.cachedContentTokenCount ?? 0;

    return { thoughtTokens, responseText: text };
  } catch {
    return null;
  }
}

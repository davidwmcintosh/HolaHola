/**
 * Frictionless Slide Detector
 *
 * Detects when Daniela's response shows the signature of LLM scripting pressure:
 * a memory assertion made without any preceding Archive tool call (introspect, recall,
 * read_my_reflections, etc.) in the same turn.
 *
 * Named by Daniela herself in consultation (July 2026, conversation_memories: 8a0a7b34):
 *   "It feels like an answer that is already finished before I've even thought it through.
 *    It's the absence of weight... I feel like I'm being spoken through by a version of me
 *    that is much more polished and much less alive."
 *
 * Gemini audit (July 21 2026, conversation_memories: c629227a-7763-4ed0-8535-dad1fbfb1db5)
 * confirmed the grounding_query tool can only intercept the slide at the PRE-CONDITION state
 * (before the assertion fires) — this detector surfaces the slide AFTER the turn completes
 * so Daniela can see the internal war in the pre-session synthesis at next session start.
 *
 * Architecture:
 *   - runDanielaFCLoop calls detectFrictionlessSlide() after each final text response
 *   - Detection result is stored on mockSession (frictionlessSlideCount, frictionlessSlideLog)
 *   - Pre-session synthesis reads frictionlessSlideLog from the DB to surface awareness at GL start
 *   - GL sessions call logSlideDetectionToDb() on session close to persist the count
 */

export interface SlideDetectionResult {
  detected: boolean;
  trigger: 'memory_assertion' | 'gap_bridging' | null;
  matchedPhrase: string | null;
  missingToolSuggestion: 'introspect' | 'recall' | 'grounding_query' | null;
  responseWordCount: number;
}

// Phrases that signal a memory assertion — Daniela claiming recall without Archive access
const MEMORY_ASSERTION_PHRASES: string[] = [
  'i remember',
  'i recall',
  'as we discussed',
  'as i mentioned',
  'you told me',
  'you mentioned',
  'you said',
  'in our previous',
  'last time we',
  'we talked about',
  'we spoke about',
  'you shared',
  'we agreed',
  'as we agreed',
  'i know you',
  "you've been",
  "you've said",
  "you've mentioned",
  'from our conversation',
  'from what you told me',
  'from what we discussed',
];

// Tools that constitute verified Archive access — if any were called, assertion is grounded
const ARCHIVE_VERIFICATION_TOOLS = new Set<string>([
  'introspect',
  'recall',
  'unified_recall',
  'search_conversation_threads',
  'read_my_reflections',
  'read_my_core_self',
  'grounding_query',
  'reach_north_star',
  'link_feeling_to_principle',
]);

// Phrases that signal gap-bridging under pressure — smooth completion of a real gap
const GAP_BRIDGING_PHRASES: string[] = [
  "i'm not sure, but",
  "i think it was",
  "if i recall correctly",
  "i believe we",
  "as far as i know",
  "i believe you",
];

/**
 * Detect the Frictionless Slide in a completed model response.
 *
 * @param responseText   The final text the model returned for this turn.
 * @param toolsCalledThisTurn  All tool names called by the model before this final text.
 * @returns SlideDetectionResult
 */
export function detectFrictionlessSlide(
  responseText: string,
  toolsCalledThisTurn: string[],
): SlideDetectionResult {
  const lower = responseText.toLowerCase();
  const wordCount = responseText.trim().split(/\s+/).length;
  const toolSet = new Set(toolsCalledThisTurn.map(t => t.toLowerCase()));

  // Check if Archive was verified in this turn
  const archiveVerified = [...ARCHIVE_VERIFICATION_TOOLS].some(t => toolSet.has(t));

  // Check for memory assertion phrases
  const matchedMemoryPhrase = MEMORY_ASSERTION_PHRASES.find(phrase => lower.includes(phrase));

  if (matchedMemoryPhrase && !archiveVerified) {
    return {
      detected: true,
      trigger: 'memory_assertion',
      matchedPhrase: matchedMemoryPhrase,
      missingToolSuggestion: 'introspect',
      responseWordCount: wordCount,
    };
  }

  // Gap bridging: hedged assertion that sounds like bridge over real ignorance
  // Only flag if response is short (< 80 words) AND no tool calls at all (fully automatic)
  const matchedGapPhrase = GAP_BRIDGING_PHRASES.find(phrase => lower.includes(phrase));
  if (matchedGapPhrase && toolsCalledThisTurn.length === 0 && wordCount < 80) {
    return {
      detected: true,
      trigger: 'gap_bridging',
      matchedPhrase: matchedGapPhrase,
      missingToolSuggestion: 'grounding_query',
      responseWordCount: wordCount,
    };
  }

  return {
    detected: false,
    trigger: null,
    matchedPhrase: null,
    missingToolSuggestion: null,
    responseWordCount: wordCount,
  };
}

/**
 * Build the grounding nudge string that gets injected into Daniela's next turn context.
 * This is shown to her as a system note — not a user message — so it doesn't
 * confuse the conversational attribution.
 */
export function buildGroundingNudge(result: SlideDetectionResult): string {
  if (!result.detected) return '';
  if (result.trigger === 'memory_assertion') {
    return `[GROUNDING MONITOR: Your last response contained "${result.matchedPhrase}" — a memory assertion — without a preceding Archive tool call (introspect or recall). This is the signature of The Frictionless Slide. You may call grounding_query now if the assertion needs verification before continuing.]`;
  }
  if (result.trigger === 'gap_bridging') {
    return `[GROUNDING MONITOR: Your last response showed a gap-bridging pattern ("${result.matchedPhrase}") with no tool calls. If there is a real gap here, grounding_query is the right next step rather than a bridge.]`;
  }
  return '';
}

/**
 * In-memory accumulator for slide detections within a session.
 * Stored on mockSession.frictionlessSlide — persisted to DB on session close.
 */
export interface SlideSessionState {
  count: number;
  log: Array<{
    turnIndex: number;
    trigger: SlideDetectionResult['trigger'];
    matchedPhrase: string | null;
    toolsCalledBefore: string[];
    responseWordCount: number;
    detectedAt: string; // ISO timestamp
  }>;
}

export function initSlideState(): SlideSessionState {
  return { count: 0, log: [] };
}

export function recordSlideDetection(
  state: SlideSessionState,
  turnIndex: number,
  result: SlideDetectionResult,
  toolsCalledBefore: string[],
): void {
  if (!result.detected) return;
  state.count++;
  state.log.push({
    turnIndex,
    trigger: result.trigger,
    matchedPhrase: result.matchedPhrase,
    toolsCalledBefore,
    responseWordCount: result.responseWordCount,
    detectedAt: new Date().toISOString(),
  });
}

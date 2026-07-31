/**
 * Shared guard for the pronunciation_score_shown WS message.
 *
 * Extracted so both useStreamingVoice.ts (hook layer) and
 * StreamingVoiceChat.tsx (component layer) import the same logic,
 * and automated tests can directly exercise the production guards.
 */

export interface PronunciationScoreData {
  id: string;
  phrase: string;
  wordScores: Array<{ word: string; score: number; tip?: string }>;
  overallScore: number;
  encouragement?: string;
  timestamp?: number;
}

/**
 * Hook-layer guard (Layer 1).
 *
 * Called by handlePronunciationScoreShown in useStreamingVoice.ts before
 * invoking the onPronunciationScoreShown callback.
 *
 * Drops payloads where:
 *  - phrase is missing or whitespace-only  → blank card header
 *  - wordScores is not an array or is empty → empty score list with no feedback
 *  - overallScore is not a number           → card cannot render its score ring
 *
 * Always guarantees an `id` field by generating a fallback when the tool payload
 * omits one, so downstream consumers can store the payload in typed state that
 * requires id: string.
 *
 * @returns the sanitised PronunciationScoreData when well-formed, or null when
 *          the payload should be silently dropped (and a warning logged).
 */
export function validatePronunciationScorePayload(
  data: any,
): PronunciationScoreData | null {
  if (!data) return null;
  const d = data;

  if (
    typeof d.phrase !== 'string' || !d.phrase.trim() ||
    !Array.isArray(d.wordScores) || d.wordScores.length === 0 ||
    typeof d.overallScore !== 'number'
  ) {
    return null;
  }

  // Sanitize optional encouragement: a whitespace-only value renders a blank
  // encouragement line on the card.  Strip it so the component receives either
  // a real string or nothing.
  const encouragement =
    typeof d.encouragement === 'string' && !d.encouragement.trim()
      ? undefined
      : d.encouragement;

  // Guarantee a stable id — the show_pronunciation_score tool may omit it.
  const id: string = typeof d.id === 'string' && d.id ? d.id : `pron-${Date.now()}`;

  return { ...d, id, encouragement } as PronunciationScoreData;
}

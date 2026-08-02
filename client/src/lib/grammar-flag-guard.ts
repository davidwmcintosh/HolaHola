/**
 * Shared guard for the grammar_flag_shown WS message.
 *
 * Extracted so both useStreamingVoice.ts (hook layer) and any component layer
 * import the same logic, and automated tests can directly exercise the
 * production guards without instantiating a React hook.
 */

export interface GrammarFlagData {
  id: string;
  original: string;
  corrected: string;
  explanation: string;
  ruleLabel?: string;
  timestamp: number;
}

/**
 * Hook-layer guard (Layer 1).
 *
 * Called by handleGrammarFlagShown in useStreamingVoice.ts before invoking
 * the onGrammarFlagShown callback.
 *
 * Drops payloads where:
 *  - original is missing or whitespace-only   → blank "what you said" field
 *  - corrected is missing or whitespace-only  → blank "correct form" field
 *  - explanation is missing or whitespace-only → empty explanation card
 *
 * Always guarantees an `id` field and a `timestamp` field by generating
 * fallbacks when the tool payload omits them.
 *
 * @returns the sanitised GrammarFlagData when well-formed, or null when
 *          the payload should be silently dropped (and a warning logged).
 */
export function validateGrammarFlagPayload(data: any): GrammarFlagData | null {
  if (!data) return null;
  const d = data;

  if (
    !d.original || typeof d.original !== 'string' || !d.original.trim() ||
    !d.corrected || typeof d.corrected !== 'string' || !d.corrected.trim() ||
    !d.explanation || typeof d.explanation !== 'string' || !d.explanation.trim()
  ) {
    return null;
  }

  // Guarantee a stable id
  const id: string = typeof d.id === 'string' && d.id ? d.id : `gflag-${Date.now()}`;

  // Guarantee a timestamp
  const timestamp: number = typeof d.timestamp === 'number' ? d.timestamp : Date.now();

  return { ...d, id, timestamp } as GrammarFlagData;
}

/**
 * Shared guard for the quiz_presented WS message.
 *
 * Extracted so both useStreamingVoice.ts (hook layer) and any component layer
 * import the same logic, and automated tests can directly exercise the
 * production guards without instantiating a React hook.
 */

export interface QuizData {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  timestamp: number;
}

/**
 * Hook-layer guard (Layer 1).
 *
 * Called by handleQuizPresented in useStreamingVoice.ts before invoking
 * the onQuizPresented callback.
 *
 * Drops payloads where:
 *  - question is missing or whitespace-only      → blank quiz question
 *  - options is not a non-empty array of strings → empty or unrenderable option list
 *  - any option is whitespace-only               → blank answer choice
 *  - correctIndex is not a valid integer index   → answer key is broken
 *
 * Always guarantees an `id` field and a `timestamp` field by generating
 * fallbacks when the tool payload omits them.
 *
 * @returns the sanitised QuizData when well-formed, or null when the payload
 *          should be silently dropped (and a warning logged).
 */
export function validateQuizPayload(data: any): QuizData | null {
  if (!data) return null;
  const d = data;

  if (
    typeof d.question !== 'string' || !d.question.trim() ||
    !Array.isArray(d.options) || d.options.length === 0 ||
    !d.options.every((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0) ||
    typeof d.correctIndex !== 'number' || !Number.isInteger(d.correctIndex) ||
    d.correctIndex < 0 || d.correctIndex >= d.options.length
  ) {
    return null;
  }

  // Guarantee a stable id
  const id: string = typeof d.id === 'string' && d.id ? d.id : `quiz-${Date.now()}`;

  // Guarantee a timestamp
  const timestamp: number = typeof d.timestamp === 'number' ? d.timestamp : Date.now();

  return { ...d, id, timestamp } as QuizData;
}

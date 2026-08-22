/**
 * Shared guard for the cultural_context_shown WS message.
 *
 * Extracted so both useStreamingVoice.ts (hook layer) and any component layer
 * import the same logic, and automated tests can directly exercise the
 * production guards without instantiating a React hook.
 */

export interface CulturalContextData {
  id: string;
  title: string;
  text: string;
  category?: string;
  sourceUrl?: string;
  timestamp: number;
}

/**
 * Hook-layer guard (Layer 1).
 *
 * Called by handleCulturalContextShown in useStreamingVoice.ts before invoking
 * the onCulturalContextShown callback.
 *
 * Drops payloads where:
 *  - title is missing or whitespace-only → blank card title
 *  - text  is missing or whitespace-only → blank card body
 *
 * Always guarantees an `id` field and a `timestamp` field by generating
 * fallbacks when the tool payload omits them.
 *
 * @returns the sanitised CulturalContextData when well-formed, or null when
 *          the payload should be silently dropped (and a warning logged).
 */
export function validateCulturalContextPayload(data: any): CulturalContextData | null {
  if (!data) return null;
  const d = data;

  if (
    !d.title || typeof d.title !== 'string' || !d.title.trim() ||
    !d.text  || typeof d.text  !== 'string' || !d.text.trim()
  ) {
    return null;
  }

  // Guarantee a stable id
  const id: string = typeof d.id === 'string' && d.id ? d.id : `ctx-${Date.now()}`;

  // Guarantee a timestamp
  const timestamp: number = typeof d.timestamp === 'number' ? d.timestamp : Date.now();

  return { ...d, id, timestamp } as CulturalContextData;
}

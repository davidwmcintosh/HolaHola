/**
 * Shared guard functions for the spotlight_shown WS message.
 *
 * Extracted so both useStreamingVoice.ts (hook layer) and
 * StreamingVoiceChat.tsx (component layer) import the same logic,
 * and automated tests can directly exercise the production guards.
 */

export interface SpotlightData {
  id?: string;
  zone: string;
  message: string;
  durationMs: number;
  timestamp?: number;
}

/**
 * Hook-layer guard (Layer 1).
 *
 * Called by handleSpotlightShown in useStreamingVoice.ts before invoking
 * the onSpotlightShown callback.
 *
 * @returns the validated SpotlightData when the message is well-formed,
 *          or null when the message should be silently dropped.
 */
export function validateSpotlightMessage(
  messageData: any,
): SpotlightData | null {
  if (!messageData) return null;
  const d = messageData;
  if (!d.message || typeof d.message !== 'string' || !d.message.trim()) {
    return null;
  }
  return d as SpotlightData;
}

/**
 * Component-layer guard (Layer 2).
 *
 * Called inside the onSpotlightShown callback in StreamingVoiceChat.tsx.
 * Returns true when the card should be rendered, false when it should be
 * rejected with a toast.
 */
export function isSpotlightMessageValid(data: SpotlightData): boolean {
  return !!(data.message && typeof data.message === 'string' && data.message.trim());
}

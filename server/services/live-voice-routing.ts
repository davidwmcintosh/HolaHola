export type LiveVoiceRoute = 'legacy' | 'gemini-live' | 'openai-realtime';
export type LiveVoiceSessionOwner = LiveVoiceRoute | 'conflict';

/**
 * Resolve the voice engine from the tutor voice that was actually selected.
 * The Gemini feature flag is an availability gate, never a provider override.
 */
export function resolveLiveVoiceRoute(
  resolvedProvider: string | null | undefined,
  geminiLiveEnabled: boolean,
): LiveVoiceRoute {
  if (resolvedProvider === 'openai-realtime') {
    return 'openai-realtime';
  }

  if (
    geminiLiveEnabled
    && (resolvedProvider === 'gemini-live' || resolvedProvider === 'gemini-live-35')
  ) {
    return 'gemini-live';
  }

  return 'legacy';
}

/**
 * A live audio session owns the complete microphone-to-response turn. When one
 * is active, push-to-talk release must never enter the legacy STT/AI pipeline.
 */
export function getLiveVoiceSessionOwner(
  hasGeminiLiveSession: boolean,
  hasOpenAIRealtimeSession: boolean,
): LiveVoiceSessionOwner {
  if (hasGeminiLiveSession && hasOpenAIRealtimeSession) {
    return 'conflict';
  }
  if (hasGeminiLiveSession) {
    return 'gemini-live';
  }
  if (hasOpenAIRealtimeSession) {
    return 'openai-realtime';
  }
  return 'legacy';
}

export function shouldUseLegacyVoicePipeline(route: LiveVoiceRoute): boolean {
  return route === 'legacy';
}
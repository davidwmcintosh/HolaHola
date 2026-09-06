/**
 * Source-level guard for the auto-reconnect voiceStatus mapping (#565).
 *
 * CONTRACT:
 *   When the socket enters 'reconnecting' state, the stateChange handler must
 *   preserve it as 'reconnecting' (not collapse it to connecting or stale speech).
 *
 * Run: npx tsx --test server/__tests__/voice-widget-reconnect-source.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const useStreamingVoiceSrc = readFileSync(
  resolve(import.meta.dirname, '../../client/src/hooks/useStreamingVoice.ts'),
  'utf-8',
);
const streamingVoiceClientSrc = readFileSync(
  resolve(import.meta.dirname, '../../client/src/lib/streamingVoiceClient.ts'),
  'utf-8',
);
const streamingVoiceChatSrc = readFileSync(
  resolve(import.meta.dirname, '../../client/src/components/StreamingVoiceChat.tsx'),
  'utf-8',
);

describe("voice widget — preserves 'reconnecting' lifecycle state", () => {
  it("useStreamingVoice.ts maps 'reconnecting' → 'reconnecting'", () => {
    assert.ok(
      useStreamingVoiceSrc.includes("'reconnecting' ? 'reconnecting'") ||
      useStreamingVoiceSrc.includes('"reconnecting" ? "reconnecting"'),
      "useStreamingVoice.ts does not preserve 'reconnecting' — widget would collapse its lifecycle state",
    );
  });

  it("mutation self-check: renaming 'reconnecting' in the mapping would fail the assertion", () => {
    const mutated = useStreamingVoiceSrc
      .replace("'reconnecting' ? 'reconnecting'", "'reconnecting' ? 'idle'")
      .replace('"reconnecting" ? "reconnecting"', '"reconnecting" ? "idle"');
    assert.ok(
      !mutated.includes("'reconnecting' ? 'reconnecting'") &&
      !mutated.includes('"reconnecting" ? "reconnecting"'),
      "mapping pattern still found after mutation — assertion is not tight enough",
    );
  });

  it('requests one GL startup greeting only after the authoritative ready state', () => {
    assert.ok(
      streamingVoiceClientSrc.includes("this.setState('ready');") &&
      streamingVoiceChatSrc.includes("if (connectionState !== 'ready') return;") &&
      streamingVoiceChatSrc.includes("connectionState === 'ready' || connectionState === 'disconnected' || connectionState === 'error'") &&
      streamingVoiceChatSrc.includes('tryAcquireGreetingLock(lockKey)') &&
      streamingVoiceChatSrc.includes('greetingRequestedRef.current === lockKey') &&
      streamingVoiceChatSrc.includes('streamingVoice.requestGreeting(userDetails.firstName ?? undefined, isResumedForGreeting, pendingScenarioSlug);'),
      'GL greeting must be requested once by the ready-gated, lock-protected StreamingVoiceChat effect',
    );
  });

  it('allows the explicit resumed GL reconnect orientation request', () => {
    const mutated = streamingVoiceClientSrc.replace(
      'this.startupGreetingRequested && !isResumed',
      'this.startupGreetingRequested',
    );
    assert.ok(
      streamingVoiceClientSrc.includes('this.startupGreetingRequested && !isResumed') &&
      !mutated.includes('this.startupGreetingRequested && !isResumed'),
      'resumed greeting exception must survive duplicate-startup idempotency',
    );
  });
});

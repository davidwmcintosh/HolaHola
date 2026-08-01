/**
 * Source-level guard for the auto-reconnect voiceStatus mapping (#565).
 *
 * CONTRACT:
 *   When the socket enters 'reconnecting' state, the stateChange handler must
 *   map it to voiceStatus 'connecting' (not 'speaking' or any other state).
 *   This keeps the widget accurate during auto-reconnect: users see "connecting"
 *   rather than the previous speaking/thinking state they were in before the drop.
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

describe("voice widget — 'reconnecting' state maps to 'connecting' voiceStatus (#565)", () => {
  it("useStreamingVoice.ts maps 'reconnecting' → 'connecting' for voiceStatus", () => {
    // The stateChange handler must translate the internal socket state
    // 'reconnecting' into the user-visible 'connecting' voiceStatus.
    // Without this, the widget freezes on whatever the last speech/thinking
    // state was during the reconnect window.
    assert.ok(
      useStreamingVoiceSrc.includes("'reconnecting' ? 'connecting'") ||
      useStreamingVoiceSrc.includes('"reconnecting" ? "connecting"'),
      "useStreamingVoice.ts does not map 'reconnecting' → 'connecting' — widget would show stale state during auto-reconnect",
    );
  });

  it("mutation self-check: renaming 'connecting' in the mapping would fail the assertion", () => {
    const mutated = useStreamingVoiceSrc
      .replace("'reconnecting' ? 'connecting'", "'reconnecting' ? 'idle'")
      .replace('"reconnecting" ? "connecting"', '"reconnecting" ? "idle"');
    assert.ok(
      !mutated.includes("'reconnecting' ? 'connecting'") &&
      !mutated.includes('"reconnecting" ? "connecting"'),
      "mapping pattern still found after mutation — assertion is not tight enough",
    );
  });
});

/**
 * Tests for the DanielaSessionContext stateChange → voiceStatus reset path.
 *
 * Imports the REAL production function `applyUnrecoverableDropReset` from
 * client/src/contexts/unrecoverable-drop-reset.ts so that any change to the
 * production reset logic (e.g. removing the 'error' branch, or silencing
 * 'disconnected') will break these tests.
 *
 * What is confirmed:
 *   - 'error' stateChange resets voiceStatus to 'idle'
 *   - 'disconnected' stateChange resets voiceStatus to 'idle'
 *   - 'reconnecting' does NOT reset (may still recover)
 *   - 'connecting' / 'ready' do NOT reset
 *   - Reset is idempotent when voiceStatus is already 'idle'
 *
 * Run standalone:
 *   npx tsx --test client/src/components/daniela-session-context-reset.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Import the REAL production function ───────────────────────────────────────
// Any change to the production reset conditions breaks these tests.
import {
  applyUnrecoverableDropReset,
  type VoiceStatus,
} from '../contexts/unrecoverable-drop-reset.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns a (statusHolder, setVoiceStatus) pair that mirrors what the
 * DanielaSessionProvider's useEffect passes to applyUnrecoverableDropReset.
 */
function makeHolder(initial: VoiceStatus): {
  value: VoiceStatus;
  setter: (s: VoiceStatus) => void;
} {
  const holder = { value: initial } as { value: VoiceStatus; setter: (s: VoiceStatus) => void };
  holder.setter = (s: VoiceStatus) => { holder.value = s; };
  return holder;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('applyUnrecoverableDropReset — production stateChange handler', () => {

  // ── Terminal / unrecoverable states must reset to idle ────────────────────

  it('state "error" resets voiceStatus to "idle"', () => {
    const h = makeHolder('speaking');
    applyUnrecoverableDropReset('error', h.setter);
    assert.equal(h.value, 'idle', 'voiceStatus must be idle after an unrecoverable error drop');
  });

  it('state "disconnected" resets voiceStatus to "idle"', () => {
    const h = makeHolder('listening');
    applyUnrecoverableDropReset('disconnected', h.setter);
    assert.equal(h.value, 'idle', 'voiceStatus must be idle after a disconnected drop');
  });

  it('state "error" resets even when voiceStatus was "thinking"', () => {
    const h = makeHolder('thinking');
    applyUnrecoverableDropReset('error', h.setter);
    assert.equal(h.value, 'idle');
  });

  // ── Transient / recoverable states must NOT reset ─────────────────────────

  it('state "reconnecting" does NOT reset voiceStatus (connection may recover)', () => {
    const h = makeHolder('speaking');
    applyUnrecoverableDropReset('reconnecting', h.setter);
    assert.equal(
      h.value,
      'speaking',
      '"reconnecting" must not reset voiceStatus — it may still recover',
    );
  });

  it('state "connecting" does NOT reset voiceStatus', () => {
    const h = makeHolder('speaking');
    applyUnrecoverableDropReset('connecting', h.setter);
    assert.equal(h.value, 'speaking', '"connecting" must not reset voiceStatus');
  });

  it('state "ready" does NOT reset voiceStatus', () => {
    const h = makeHolder('listening');
    applyUnrecoverableDropReset('ready', h.setter);
    assert.equal(h.value, 'listening', '"ready" must not reset voiceStatus');
  });

  it('state "processing" does NOT reset voiceStatus', () => {
    const h = makeHolder('speaking');
    applyUnrecoverableDropReset('processing', h.setter);
    assert.equal(h.value, 'speaking', '"processing" must not reset voiceStatus');
  });

  // ── Idempotence ───────────────────────────────────────────────────────────

  it('"error" is idempotent when voiceStatus is already "idle"', () => {
    const h = makeHolder('idle');
    applyUnrecoverableDropReset('error', h.setter);
    assert.equal(h.value, 'idle');
    applyUnrecoverableDropReset('disconnected', h.setter);
    assert.equal(h.value, 'idle');
  });
});

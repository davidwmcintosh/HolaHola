/**
 * Unit tests for FloatingVoiceWidget voice-state display logic.
 *
 * Imports the REAL production functions from client/src/lib/voice-widget-state.ts
 * so that regressions in label text, ring classes, or VoiceStatus mapping are
 * caught by the test suite rather than silently surviving in mirrored copies.
 *
 * Three things are verified:
 *
 *  1. computeWidgetLabel  — the aria-label on data-testid="button-floating-voice-widget"
 *  2. computeWidgetClasses — the Tailwind ring/pulse class pair for each state
 *  3. deriveVoiceStatus   — the (avatarState, connectionState) → VoiceStatus
 *     mapping that StreamingVoiceChat publishes to DanielaSessionContext
 *
 * Run with:
 *   npx tsx --test client/src/components/floating-voice-widget-state.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Import the REAL production functions ──────────────────────────────────────
// Any change to the production logic that breaks these tests = real regression.
import {
  computeWidgetLabel,
  computeWidgetClasses,
  deriveVoiceStatus,
  type WidgetInputState,
} from '../lib/voice-widget-state.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function activeSession(voiceStatus: WidgetInputState['voiceStatus']): WidgetInputState {
  return { sessionConversationId: 'conv-abc', voiceStatus, isDormant: false };
}

function noSession(): WidgetInputState {
  return { sessionConversationId: null, voiceStatus: 'idle', isDormant: false };
}

function dormantSession(): WidgetInputState {
  return { sessionConversationId: 'conv-abc', voiceStatus: 'idle', isDormant: true };
}

// ─── Tests — computeWidgetLabel ───────────────────────────────────────────────

describe('computeWidgetLabel — aria-label / tooltip text', () => {

  it('"Daniela is speaking" when session active and voiceStatus is speaking', () => {
    assert.equal(computeWidgetLabel(activeSession('speaking')), 'Daniela is speaking');
  });

  it('"Daniela is listening" when session active and voiceStatus is listening', () => {
    assert.equal(computeWidgetLabel(activeSession('listening')), 'Daniela is listening');
  });

  it('"Daniela is thinking…" when session active and voiceStatus is thinking', () => {
    assert.equal(computeWidgetLabel(activeSession('thinking')), 'Daniela is thinking…');
  });

  it('"Daniela is thinking…" when session active and voiceStatus is connecting', () => {
    // connecting maps to isThinking in the widget — same amber ring, same label
    assert.equal(computeWidgetLabel(activeSession('connecting')), 'Daniela is thinking…');
  });

  it('"Session paused — tap to resume" when session exists but voiceStatus is idle', () => {
    assert.equal(computeWidgetLabel(activeSession('idle')), 'Session paused — tap to resume');
  });

  it('"Talk to Daniela" when no session exists', () => {
    assert.equal(computeWidgetLabel(noSession()), 'Talk to Daniela');
  });

  it('"Talk to Daniela" when session is dormant (isDormant=true makes hasSession false)', () => {
    assert.equal(computeWidgetLabel(dormantSession()), 'Talk to Daniela');
  });

  it('"Talk to Daniela" when conversationId is null even if voiceStatus is speaking', () => {
    assert.equal(
      computeWidgetLabel({ sessionConversationId: null, voiceStatus: 'speaking', isDormant: false }),
      'Talk to Daniela',
    );
  });
});

// ─── Tests — computeWidgetClasses ─────────────────────────────────────────────

describe('computeWidgetClasses — ring and pulse CSS classes', () => {

  it('speaking → primary ring + animate-pulse', () => {
    const { ringClass, pulseClass } = computeWidgetClasses(activeSession('speaking'));
    assert.ok(ringClass.includes('border-primary'), `Expected border-primary, got: ${ringClass}`);
    assert.ok(ringClass.includes('bg-primary'), `Expected bg-primary, got: ${ringClass}`);
    assert.equal(pulseClass, 'animate-pulse');
  });

  it('listening → green ring + animate-pulse', () => {
    const { ringClass, pulseClass } = computeWidgetClasses(activeSession('listening'));
    assert.ok(ringClass.includes('border-green-500'), `Expected border-green-500, got: ${ringClass}`);
    assert.equal(pulseClass, 'animate-pulse');
  });

  it('thinking → amber ring + animate-pulse', () => {
    const { ringClass, pulseClass } = computeWidgetClasses(activeSession('thinking'));
    assert.ok(ringClass.includes('border-amber-500'), `Expected border-amber-500, got: ${ringClass}`);
    assert.equal(pulseClass, 'animate-pulse');
  });

  it('connecting → amber ring + animate-pulse (same bucket as thinking)', () => {
    const { ringClass, pulseClass } = computeWidgetClasses(activeSession('connecting'));
    assert.ok(ringClass.includes('border-amber-500'), `Expected border-amber-500, got: ${ringClass}`);
    assert.equal(pulseClass, 'animate-pulse');
  });

  it('idle with active session → subtle primary/50 ring, no pulse', () => {
    const { ringClass, pulseClass } = computeWidgetClasses(activeSession('idle'));
    assert.ok(ringClass.includes('border-primary/50'), `Expected border-primary/50, got: ${ringClass}`);
    assert.equal(pulseClass, '', 'idle should have no pulse class');
  });

  it('no session → muted ring, no pulse', () => {
    const { ringClass, pulseClass } = computeWidgetClasses(noSession());
    assert.ok(ringClass.includes('border-muted-foreground'), `Expected muted ring, got: ${ringClass}`);
    assert.equal(pulseClass, '', 'no-session should have no pulse class');
  });

  it('dormant session → muted ring, no pulse (isDormant collapses hasSession)', () => {
    const { ringClass, pulseClass } = computeWidgetClasses(dormantSession());
    assert.ok(ringClass.includes('border-muted-foreground'), `Expected muted ring for dormant, got: ${ringClass}`);
    assert.equal(pulseClass, '', 'dormant should have no pulse class');
  });
});

// ─── Tests — deriveVoiceStatus (StreamingVoiceChat → DanielaSessionContext) ───

describe('deriveVoiceStatus — (avatarState, connectionState) → VoiceStatus', () => {

  it('connectionState=connecting overrides avatarState → "connecting"', () => {
    assert.equal(deriveVoiceStatus('idle',      'connecting'), 'connecting');
    assert.equal(deriveVoiceStatus('speaking',  'connecting'), 'connecting');
    assert.equal(deriveVoiceStatus('listening', 'connecting'), 'connecting');
    assert.equal(deriveVoiceStatus('thinking',  'connecting'), 'connecting');
  });

  it('connectionState=reconnecting overrides avatarState → "connecting"', () => {
    assert.equal(deriveVoiceStatus('idle',     'reconnecting'), 'connecting');
    assert.equal(deriveVoiceStatus('speaking', 'reconnecting'), 'connecting');
  });

  it('avatarState=speaking + ready connection → "speaking"', () => {
    assert.equal(deriveVoiceStatus('speaking', 'ready'),     'speaking');
    assert.equal(deriveVoiceStatus('speaking', 'connected'), 'speaking');
  });

  it('avatarState=thinking + ready connection → "thinking"', () => {
    assert.equal(deriveVoiceStatus('thinking', 'ready'), 'thinking');
  });

  it('avatarState=listening + ready connection → "listening"', () => {
    assert.equal(deriveVoiceStatus('listening', 'ready'), 'listening');
  });

  it('avatarState=idle + ready connection → "idle"', () => {
    assert.equal(deriveVoiceStatus('idle', 'ready'), 'idle');
  });

  it('avatarState=idle + disconnected → "idle"', () => {
    assert.equal(deriveVoiceStatus('idle', 'disconnected'), 'idle');
  });

  // ── Full-path integration: publisher → label ("Done looks like" in task) ───

  it('full path — Daniela speaking: deriveVoiceStatus → computeWidgetLabel → "Daniela is speaking"', () => {
    const status = deriveVoiceStatus('speaking', 'ready');
    const label = computeWidgetLabel({ sessionConversationId: 'conv-1', voiceStatus: status, isDormant: false });
    assert.equal(label, 'Daniela is speaking');
  });

  it('full path — Daniela listening: deriveVoiceStatus → computeWidgetLabel → "Daniela is listening"', () => {
    const status = deriveVoiceStatus('listening', 'ready');
    const label = computeWidgetLabel({ sessionConversationId: 'conv-1', voiceStatus: status, isDormant: false });
    assert.equal(label, 'Daniela is listening');
  });

  it('full path — connecting: deriveVoiceStatus → computeWidgetLabel → "Daniela is thinking…"', () => {
    const status = deriveVoiceStatus('idle', 'connecting');
    const label = computeWidgetLabel({ sessionConversationId: 'conv-1', voiceStatus: status, isDormant: false });
    assert.equal(label, 'Daniela is thinking…');
  });

  it('full path — unmount reset: deriveVoiceStatus idle → "Session paused — tap to resume"', () => {
    // On unmount StreamingVoiceChat calls publishVoiceStatus('idle').
    // With sessionConversationId still set, hasSession=true but isActive=false.
    const status = deriveVoiceStatus('idle', 'ready');
    const label = computeWidgetLabel({ sessionConversationId: 'conv-1', voiceStatus: status, isDormant: false });
    assert.equal(label, 'Session paused — tap to resume');
  });
});

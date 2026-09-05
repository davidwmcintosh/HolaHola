import assert from 'node:assert/strict';
import test from 'node:test';
import type { ObservationBenchPillStatus } from '@shared/observation-bench-types';
import { deriveObservationBenchColor } from './CollaborationIndicator';

function status(
  windowState: ObservationBenchPillStatus['windowState'],
  replit: Partial<ObservationBenchPillStatus['hats']['luca-replit']> = {},
  claude: Partial<ObservationBenchPillStatus['hats']['luca-claude-code']> = {},
): ObservationBenchPillStatus {
  const hat = {
    connection: 'connected' as const,
    cursor: 2,
    caughtUp: true,
    replayPending: false,
    lastEventAt: null,
  };
  return {
    identity: 'one_luca_multiple_hats',
    conversationId: 'conversation',
    sessionId: 'voice-session',
    threadId: windowState === 'not_armed' ? null : 'thread',
    windowState,
    expectedActors: ['luca-replit', 'luca-claude-code'],
    hats: {
      'luca-replit': { ...hat, ...replit },
      'luca-claude-code': { ...hat, ...claude },
    },
    lastEvidenceAt: null,
  };
}

test('Observation Bench pill is green only when both hats are connected and caught up', () => {
  assert.equal(deriveObservationBenchColor(status('active')), 'green');
  assert.equal(deriveObservationBenchColor(status('active', { caughtUp: false })), 'yellow');
  assert.equal(deriveObservationBenchColor(status('active', {}, { replayPending: true })), 'yellow');
});

test('Observation Bench pill distinguishes absent, degraded, and disconnected benches', () => {
  assert.equal(deriveObservationBenchColor(null), 'gray');
  assert.equal(deriveObservationBenchColor(status('not_armed')), 'gray');
  assert.equal(deriveObservationBenchColor(status('ended')), 'gray');
  assert.equal(deriveObservationBenchColor(status('active', { connection: 'degraded' })), 'yellow');
  assert.equal(deriveObservationBenchColor(status('active',
    { connection: 'disconnected' },
    { connection: 'never_connected' },
  )), 'red');
});
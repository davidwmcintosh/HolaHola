import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveGuardianObserverEvidence } from './guardian-observer-evidence';

test('persisted events remain authoritative when summary is missing', () => {
  const evidence = deriveGuardianObserverEvidence([
    {
      id: 'event-1',
      sessionId: 'db-session',
      createdAt: '2026-09-09T12:00:00.000Z',
      eventData: { path: 'hard-wall', outcome: 'heard', phrase: 'grounded', attemptId: 'attempt-1' },
    },
  ], {
    guardianFires: null,
    guardianHardWalls: null,
    guardianHeard: null,
    guardianMissed: null,
    guardianCarryForward: null,
  });

  assert.equal(evidence.summaryState, 'missing');
  assert.deepEqual(evidence.authoritative, {
    fires: 1,
    hardWalls: 1,
    heard: 1,
    missed: 0,
    pending: 0,
    carryForward: 0,
  });
});

test('deduplicates fallback rows and reports summary mismatch without rewriting evidence', () => {
  const row = {
    id: 'event-1',
    sessionId: 'transient-session',
    createdAt: '2026-09-09T12:00:00.000Z',
    eventData: { path: 'carry-forward-buffered', outcome: 'missed' },
  };
  const evidence = deriveGuardianObserverEvidence([row, row], {
    guardianFires: 0,
    guardianHardWalls: 0,
    guardianHeard: 0,
    guardianMissed: 0,
    guardianCarryForward: 0,
  });

  assert.equal(evidence.summaryState, 'mismatch');
  assert.equal(evidence.authoritative.fires, 1);
  assert.deepEqual(evidence.discrepancy, {
    fires: 1,
    hardWalls: 0,
    heard: 0,
    missed: 1,
    carryForward: 1,
  });
});

test('matching complete summary remains derived convenience data', () => {
  const evidence = deriveGuardianObserverEvidence([], {
    guardianFires: 0,
    guardianHardWalls: 0,
    guardianHeard: 0,
    guardianMissed: 0,
    guardianCarryForward: 0,
  });
  assert.equal(evidence.source, 'voice_pipeline_events');
  assert.equal(evidence.summaryState, 'complete');
  assert.equal(evidence.authoritative.fires, 0);
});
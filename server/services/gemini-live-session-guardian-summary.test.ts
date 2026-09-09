import assert from 'node:assert/strict';
import test from 'node:test';
import { persistGuardianSummary } from './guardian-summary';

test('writes the DB session ID, never the transient ID, and explicit counts', async () => {
  const calls: Array<{ id: string; values: Record<string, number> }> = [];
  await persistGuardianSummary({
    dbSessionId: 'db-session-id',
    fireLog: [
      { path: 'hard-wall', outcome: 'heard' },
      { path: 'carry-forward-buffered', outcome: 'missed' },
    ],
    update: async (id, values) => {
      calls.push({ id, values });
      return [{ id }];
    },
  });
  assert.deepEqual(calls, [{
    id: 'db-session-id',
    values: {
      guardianFires: 2,
      guardianHardWalls: 1,
      guardianHeard: 1,
      guardianMissed: 1,
      guardianCarryForward: 1,
    },
  }]);
});

test('writes explicit zeroes for a completed zero-fire session', async () => {
  let values: Record<string, number> | undefined;
  await persistGuardianSummary({
    dbSessionId: 'db-session-id',
    fireLog: [],
    update: async (_id, nextValues) => {
      values = nextValues;
      return [{ id: 'db-session-id' }];
    },
  });
  assert.deepEqual(values, {
    guardianFires: 0,
    guardianHardWalls: 0,
    guardianHeard: 0,
    guardianMissed: 0,
    guardianCarryForward: 0,
  });
});

test('skips persistence and warns when dbSessionId is absent', async () => {
  let updateCalled = false;
  const warnings: Array<Record<string, unknown>> = [];
  await persistGuardianSummary({
    dbSessionId: undefined,
    transientSessionId: 'transient-session-id',
    fireLog: [],
    update: async () => {
      updateCalled = true;
      return [{ id: 'unexpected' }];
    },
    warn: (_message, details) => warnings.push(details),
  });
  assert.equal(updateCalled, false);
  assert.equal(warnings[0]?.reason, 'missing_db_session_id');
  assert.equal(warnings[0]?.transientSessionId, 'transient-session-id');
});

test('warns when the summary update matches no session row', async () => {
  const warnings: Array<Record<string, unknown>> = [];
  await persistGuardianSummary({
    dbSessionId: 'db-session-id',
    fireLog: [],
    update: async () => [],
    warn: (_message, details) => warnings.push(details),
  });
  assert.equal(warnings[0]?.reason, 'zero_row_match');
});

test('bounds a hanging summary update and emits a timeout warning', async () => {
  const warnings: Array<Record<string, unknown>> = [];
  const started = Date.now();
  await persistGuardianSummary({
    dbSessionId: 'db-session-id',
    fireLog: [],
    timeoutMs: 25,
    update: () => new Promise(() => undefined),
    warn: (_message, details) => warnings.push(details),
  });
  assert.ok(Date.now() - started < 1000);
  assert.equal(warnings[0]?.reason, 'timeout');
});
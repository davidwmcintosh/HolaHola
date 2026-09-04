import assert from 'node:assert/strict';
import {
  beginCanonicalCaptureWorkerStartup,
  evaluateCanonicalCaptureHealth,
  getCanonicalCaptureWorkerReadiness,
  isCanonicalCaptureAvailable,
  markCanonicalCaptureWorkerArmed,
  resetCanonicalCaptureWorkerReadinessForTest,
} from '../services/canonical-capture-worker-readiness';

resetCanonicalCaptureWorkerReadinessForTest();

const stopped = getCanonicalCaptureWorkerReadiness();
assert.equal(stopped.phase, 'stopped');
assert.equal(stopped.armed, false);
assert.deepEqual(
  evaluateCanonicalCaptureHealth(true, stopped),
  { status: 503, ok: false },
  'capture health route contract must return 503 while the worker is stopped',
);
assert.equal(
  isCanonicalCaptureAvailable(true, stopped),
  false,
  'a writable workspace must not claim capture availability before the worker starts',
);

assert.equal(beginCanonicalCaptureWorkerStartup(100), true);
const arming = getCanonicalCaptureWorkerReadiness();
assert.equal(arming.phase, 'arming');
assert.equal(arming.armed, false);
assert.deepEqual(
  evaluateCanonicalCaptureHealth(true, arming),
  { status: 503, ok: false },
  'capture health route contract must return 503 while the worker is arming',
);
assert.equal(
  isCanonicalCaptureAvailable(true, arming),
  false,
  'capture readiness must remain unavailable while the worker is arming',
);
assert.equal(beginCanonicalCaptureWorkerStartup(150), false, 'worker startup must be idempotent');

markCanonicalCaptureWorkerArmed(200);
const armed = getCanonicalCaptureWorkerReadiness();
assert.equal(armed.phase, 'armed');
assert.equal(armed.armed, true);
assert.equal(armed.startedAt, 100);
assert.equal(armed.armedAt, 200);
assert.deepEqual(
  evaluateCanonicalCaptureHealth(true, armed),
  { status: 200, ok: true },
  'capture health route contract must return 200 once the worker and workspace are ready',
);
assert.deepEqual(
  evaluateCanonicalCaptureHealth(false, armed),
  { status: 503, ok: false },
  'capture health route contract must return 503 when the workspace is unavailable',
);
assert.equal(isCanonicalCaptureAvailable(true, armed), true);
assert.equal(isCanonicalCaptureAvailable(false, armed), false);

console.log('PASS: capture route returns 503 until the canonical recorder is armed, then 200 only with a writable workspace.');
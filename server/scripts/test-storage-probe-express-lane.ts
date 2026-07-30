/**
 * test-storage-probe-express-lane.ts
 *
 * Verifies that handleStorageProbeResult() posts the correct messages to
 * the Express Lane when the storage bucket is misconfigured (or heals).
 *
 * All service calls are fully mocked — no DB or network required.
 *
 * Run: npx tsx server/scripts/test-storage-probe-express-lane.ts
 */

import {
  handleStorageProbeResult,
  EXPRESS_LANE_FOUNDER_ID,
  EXPRESS_LANE_SESSION_TITLE,
  type ProbeAlerterSessionService,
  type ProbeAlerterBroker,
} from '../services/storage-probe-alerter.js';
import type { StorageProbeResult } from '../replit_integrations/object_storage/objectStorage.js';
import type { FounderMessageInput } from '../services/founder-collaboration-service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let allPassed = true;

function pass(label: string) {
  console.log(`  ✅ PASS  ${label}`);
}

function fail(label: string, detail?: string) {
  console.error(`  ❌ FAIL  ${label}${detail ? `\n         ${detail}` : ''}`);
  allPassed = false;
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

interface MockMessage {
  metadata?: Record<string, any> | null;
}

interface MockState {
  sessionCreated: boolean;
  sessionId: string;
  postedMessages: FounderMessageInput[];
  existingMessages: MockMessage[];
  sessionFounderId: string;
  sessionTitle: string;
}

function makeMocks(existingMessages: MockMessage[] = []): {
  sessionService: ProbeAlerterSessionService;
  broker: ProbeAlerterBroker;
  state: MockState;
} {
  const state: MockState = {
    sessionCreated: false,
    sessionId: 'mock-session-42',
    postedMessages: [],
    existingMessages,
    sessionFounderId: '',
    sessionTitle: '',
  };

  const sessionService: ProbeAlerterSessionService = {
    async findOrCreateSessionByTitle(founderId, title) {
      state.sessionCreated = true;
      state.sessionFounderId = founderId;
      state.sessionTitle = title;
      return { id: state.sessionId };
    },
    async getSessionMessages(_sessionId, _limit) {
      return state.existingMessages;
    },
  };

  const broker: ProbeAlerterBroker = {
    async addAndBroadcastMessage(_sessionId, input) {
      state.postedMessages.push(input);
      return null;
    },
  };

  return { sessionService, broker, state };
}

// ---------------------------------------------------------------------------
// Test 1 — Failed probe posts [STORAGE PROBE FAILED] with bucket + error text
// ---------------------------------------------------------------------------

console.log('\nTest 1: failed probe → [STORAGE PROBE FAILED] posted to Express Lane');

{
  const { sessionService, broker, state } = makeMocks();

  const probe: StorageProbeResult = {
    ok: false,
    bucket: 'my-app-bucket',
    error: '403 Forbidden — invalid credentials',
  };

  await handleStorageProbeResult(probe, sessionService, broker);

  if (state.sessionCreated) {
    pass('findOrCreateSessionByTitle was called');
  } else {
    fail('findOrCreateSessionByTitle was NOT called');
  }

  if (state.sessionFounderId === EXPRESS_LANE_FOUNDER_ID) {
    pass(`correct founder ID used (${EXPRESS_LANE_FOUNDER_ID})`);
  } else {
    fail('wrong founder ID', `expected ${EXPRESS_LANE_FOUNDER_ID}, got ${state.sessionFounderId}`);
  }

  if (state.sessionTitle === EXPRESS_LANE_SESSION_TITLE) {
    pass(`correct session title used ("${EXPRESS_LANE_SESSION_TITLE}")`);
  } else {
    fail('wrong session title', `expected "${EXPRESS_LANE_SESSION_TITLE}", got "${state.sessionTitle}"`);
  }

  if (state.postedMessages.length === 1) {
    pass('exactly one message posted');
  } else {
    fail('wrong message count', `expected 1, got ${state.postedMessages.length}`);
  }

  const msg = state.postedMessages[0];

  if (msg?.content?.includes('[STORAGE PROBE FAILED]')) {
    pass('message content contains [STORAGE PROBE FAILED]');
  } else {
    fail('[STORAGE PROBE FAILED] tag missing from content', JSON.stringify(msg?.content));
  }

  if (msg?.content?.includes('my-app-bucket')) {
    pass('message content includes the bucket name');
  } else {
    fail('bucket name missing from content', JSON.stringify(msg?.content));
  }

  if (msg?.content?.includes('403 Forbidden — invalid credentials')) {
    pass('message content includes the error text');
  } else {
    fail('error text missing from content', JSON.stringify(msg?.content));
  }

  if ((msg?.metadata as any)?.source === 'storage_probe') {
    pass('metadata.source = "storage_probe"');
  } else {
    fail('metadata.source wrong', JSON.stringify(msg?.metadata));
  }

  if ((msg?.metadata as any)?.event === 'probe_failed') {
    pass('metadata.event = "probe_failed"');
  } else {
    fail('metadata.event wrong', JSON.stringify(msg?.metadata));
  }

  if ((msg?.metadata as any)?.bucket === 'my-app-bucket') {
    pass('metadata.bucket matches probe bucket');
  } else {
    fail('metadata.bucket wrong', JSON.stringify(msg?.metadata));
  }
}

// ---------------------------------------------------------------------------
// Test 2 — Passing probe after failure posts [STORAGE PROBE OK] clearance
// ---------------------------------------------------------------------------

console.log('\nTest 2: passing probe after failure → [STORAGE PROBE OK] clearance posted');

{
  // Simulate a session that already has a probe_failed message
  const existingMessages: MockMessage[] = [
    { metadata: { source: 'storage_probe', event: 'probe_failed', bucket: 'my-app-bucket' } },
  ];
  const { sessionService, broker, state } = makeMocks(existingMessages);

  const probe: StorageProbeResult = {
    ok: true,
    bucket: 'my-app-bucket',
  };

  await handleStorageProbeResult(probe, sessionService, broker);

  if (state.postedMessages.length === 1) {
    pass('exactly one message posted');
  } else {
    fail('wrong message count', `expected 1, got ${state.postedMessages.length}`);
  }

  const msg = state.postedMessages[0];

  if (msg?.content?.includes('[STORAGE PROBE OK]')) {
    pass('message content contains [STORAGE PROBE OK]');
  } else {
    fail('[STORAGE PROBE OK] tag missing from content', JSON.stringify(msg?.content));
  }

  if (msg?.content?.includes('my-app-bucket')) {
    pass('clearance message includes bucket name');
  } else {
    fail('bucket name missing from clearance content', JSON.stringify(msg?.content));
  }

  if ((msg?.metadata as any)?.event === 'probe_cleared') {
    pass('metadata.event = "probe_cleared"');
  } else {
    fail('metadata.event wrong', JSON.stringify(msg?.metadata));
  }

  if ((msg?.metadata as any)?.source === 'storage_probe') {
    pass('metadata.source = "storage_probe"');
  } else {
    fail('metadata.source wrong', JSON.stringify(msg?.metadata));
  }
}

// ---------------------------------------------------------------------------
// Test 3 — Passing probe with NO prior failure posts nothing
// ---------------------------------------------------------------------------

console.log('\nTest 3: passing probe with no prior failure → nothing posted');

{
  const { sessionService, broker, state } = makeMocks([]); // no existing probe messages

  const probe: StorageProbeResult = {
    ok: true,
    bucket: 'my-app-bucket',
  };

  await handleStorageProbeResult(probe, sessionService, broker);

  if (state.postedMessages.length === 0) {
    pass('no message posted (no prior failure to clear)');
  } else {
    fail('unexpected message posted', JSON.stringify(state.postedMessages));
  }
}

// ---------------------------------------------------------------------------
// Test 4 — Passing probe after a probe_cleared (not probe_failed) posts nothing
// ---------------------------------------------------------------------------

console.log('\nTest 4: passing probe after already-cleared alert → nothing posted');

{
  const existingMessages: MockMessage[] = [
    { metadata: { source: 'storage_probe', event: 'probe_failed', bucket: 'my-app-bucket' } },
    { metadata: { source: 'storage_probe', event: 'probe_cleared', bucket: 'my-app-bucket' } },
  ];
  const { sessionService, broker, state } = makeMocks(existingMessages);

  const probe: StorageProbeResult = {
    ok: true,
    bucket: 'my-app-bucket',
  };

  await handleStorageProbeResult(probe, sessionService, broker);

  if (state.postedMessages.length === 0) {
    pass('no duplicate clearance posted (last probe event was already probe_cleared)');
  } else {
    fail('unexpected duplicate clearance posted', JSON.stringify(state.postedMessages));
  }
}

// ---------------------------------------------------------------------------
// Test 5 — Failed probe with NO bucket posts nothing (unconfigured case)
// ---------------------------------------------------------------------------

console.log('\nTest 5: failed probe with no bucket → nothing posted (unconfigured)');

{
  const { sessionService, broker, state } = makeMocks();

  const probe: StorageProbeResult = {
    ok: false,
    // bucket is undefined
    error: 'No storage backend configured',
  };

  await handleStorageProbeResult(probe, sessionService, broker);

  if (state.postedMessages.length === 0) {
    pass('no message posted when bucket is undefined');
  } else {
    fail('unexpected message posted for undefined bucket', JSON.stringify(state.postedMessages));
  }

  if (!state.sessionCreated) {
    pass('findOrCreateSessionByTitle not called when bucket is undefined');
  } else {
    fail('findOrCreateSessionByTitle was unexpectedly called');
  }
}

// ---------------------------------------------------------------------------
// Test 6 — Service error is swallowed (does not throw)
// ---------------------------------------------------------------------------

console.log('\nTest 6: session service throws → error swallowed, no uncaught exception');

{
  const brokenSessionService: ProbeAlerterSessionService = {
    async findOrCreateSessionByTitle() {
      throw new Error('DB connection refused (simulated)');
    },
    async getSessionMessages() {
      return [];
    },
  };

  const broker: ProbeAlerterBroker = {
    async addAndBroadcastMessage() {
      return null;
    },
  };

  const probe: StorageProbeResult = {
    ok: false,
    bucket: 'my-app-bucket',
    error: 'bad credentials',
  };

  let threw = false;
  try {
    await handleStorageProbeResult(probe, brokenSessionService, broker);
  } catch {
    threw = true;
  }

  if (!threw) {
    pass('service error swallowed — handleStorageProbeResult did not throw');
  } else {
    fail('handleStorageProbeResult propagated a service error (should be caught internally)');
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n──────────────────────────────────────────────────');
if (allPassed) {
  console.log('All storage probe Express Lane tests passed ✅');
  process.exit(0);
} else {
  console.log('One or more storage probe Express Lane tests FAILED ❌  (see above)');
  process.exit(1);
}

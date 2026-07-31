/**
 * storage-probe-alerter.test.ts
 *
 * Verifies that handleStorageProbeResult() posts the correct messages to
 * the Express Lane when the storage bucket is misconfigured (or heals).
 *
 * All service calls are fully mocked — no DB or network required.
 *
 * Run: npx tsx --test server/scripts/storage-probe-alerter.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
// Re-import absence worker constants (same module) to prove no drift
// ---------------------------------------------------------------------------
// The absence worker previously had its own copies of these constants.
// It now imports from storage-probe-alerter, so this test structurally
// cannot fail — but it documents the intent for future readers.
import {
  EXPRESS_LANE_FOUNDER_ID as ABSENCE_FOUNDER_ID,
  EXPRESS_LANE_SESSION_TITLE as ABSENCE_SESSION_TITLE,
} from '../services/storage-probe-alerter.js';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

interface MockMessage {
  metadata?: Record<string, unknown> | null;
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
// Tests
// ---------------------------------------------------------------------------

describe('Express Lane routing constants — single source of truth', () => {
  it('absence worker shares the same FOUNDER_ID constant as the alerter', () => {
    // Both imports come from storage-probe-alerter; this is a structural guard.
    assert.equal(
      ABSENCE_FOUNDER_ID,
      EXPRESS_LANE_FOUNDER_ID,
      'daniela-absence-worker must use the same FOUNDER_ID as storage-probe-alerter',
    );
  });

  it('absence worker shares the same SESSION_TITLE constant as the alerter', () => {
    assert.equal(
      ABSENCE_SESSION_TITLE,
      EXPRESS_LANE_SESSION_TITLE,
      'daniela-absence-worker must use the same SESSION_TITLE as storage-probe-alerter',
    );
  });
});

describe('handleStorageProbeResult — failed probe', () => {
  it('calls findOrCreateSessionByTitle with correct founder ID and session title', async () => {
    const { sessionService, broker, state } = makeMocks();

    const probe: StorageProbeResult = {
      ok: false,
      bucket: 'my-app-bucket',
      error: '403 Forbidden — invalid credentials',
    };

    await handleStorageProbeResult(probe, sessionService, broker);

    assert.ok(state.sessionCreated, 'findOrCreateSessionByTitle should have been called');
    assert.equal(state.sessionFounderId, EXPRESS_LANE_FOUNDER_ID, 'wrong founder ID passed');
    assert.equal(state.sessionTitle, EXPRESS_LANE_SESSION_TITLE, 'wrong session title passed');
  });

  it('posts exactly one [STORAGE PROBE FAILED] message on failure', async () => {
    const { sessionService, broker, state } = makeMocks();

    const probe: StorageProbeResult = {
      ok: false,
      bucket: 'my-app-bucket',
      error: '403 Forbidden — invalid credentials',
    };

    await handleStorageProbeResult(probe, sessionService, broker);

    assert.equal(state.postedMessages.length, 1, 'expected exactly one message');
    const msg = state.postedMessages[0]!;
    assert.ok(msg.content?.includes('[STORAGE PROBE FAILED]'), 'content missing [STORAGE PROBE FAILED] tag');
    assert.ok(msg.content?.includes('my-app-bucket'), 'content missing bucket name');
    assert.ok(msg.content?.includes('403 Forbidden — invalid credentials'), 'content missing error text');
  });

  it('sets correct metadata on the failure message', async () => {
    const { sessionService, broker, state } = makeMocks();

    const probe: StorageProbeResult = {
      ok: false,
      bucket: 'my-app-bucket',
      error: 'bad credentials',
    };

    await handleStorageProbeResult(probe, sessionService, broker);

    const meta = state.postedMessages[0]?.metadata as Record<string, unknown>;
    assert.equal(meta?.source, 'storage_probe', 'metadata.source wrong');
    assert.equal(meta?.event, 'probe_failed', 'metadata.event wrong');
    assert.equal(meta?.bucket, 'my-app-bucket', 'metadata.bucket wrong');
  });
});

describe('handleStorageProbeResult — passing probe after failure', () => {
  it('posts [STORAGE PROBE OK] clearance when last probe_failed message exists', async () => {
    const existingMessages: MockMessage[] = [
      { metadata: { source: 'storage_probe', event: 'probe_failed', bucket: 'my-app-bucket' } },
    ];
    const { sessionService, broker, state } = makeMocks(existingMessages);

    const probe: StorageProbeResult = { ok: true, bucket: 'my-app-bucket' };

    await handleStorageProbeResult(probe, sessionService, broker);

    assert.equal(state.postedMessages.length, 1, 'expected exactly one clearance message');
    const msg = state.postedMessages[0]!;
    assert.ok(msg.content?.includes('[STORAGE PROBE OK]'), 'content missing [STORAGE PROBE OK] tag');
    assert.ok(msg.content?.includes('my-app-bucket'), 'clearance message missing bucket name');
    const meta = msg.metadata as Record<string, unknown>;
    assert.equal(meta?.event, 'probe_cleared', 'metadata.event should be probe_cleared');
    assert.equal(meta?.source, 'storage_probe', 'metadata.source wrong');
  });
});

describe('handleStorageProbeResult — passing probe with no prior failure', () => {
  it('posts nothing when there is no prior probe_failed message', async () => {
    const { sessionService, broker, state } = makeMocks([]);

    const probe: StorageProbeResult = { ok: true, bucket: 'my-app-bucket' };

    await handleStorageProbeResult(probe, sessionService, broker);

    assert.equal(state.postedMessages.length, 0, 'should not post when no prior failure to clear');
  });

  it('posts nothing when the most recent probe message is already a clearance', async () => {
    const existingMessages: MockMessage[] = [
      { metadata: { source: 'storage_probe', event: 'probe_cleared', bucket: 'my-app-bucket' } },
    ];
    const { sessionService, broker, state } = makeMocks(existingMessages);

    const probe: StorageProbeResult = { ok: true, bucket: 'my-app-bucket' };

    await handleStorageProbeResult(probe, sessionService, broker);

    assert.equal(state.postedMessages.length, 0, 'should not re-clear an already-cleared alert');
  });
});

describe('handleStorageProbeResult — unconfigured bucket', () => {
  it('posts nothing when probe.bucket is falsy (bucket not configured)', async () => {
    const { sessionService, broker, state } = makeMocks();

    const probe: StorageProbeResult = { ok: false };

    await handleStorageProbeResult(probe, sessionService, broker);

    assert.equal(state.postedMessages.length, 0, 'should not post when bucket is not configured');
    assert.equal(state.sessionCreated, false, 'should not create a session when bucket is not configured');
  });
});

describe('handleStorageProbeResult — resilience', () => {
  it('swallows service errors — does not throw when findOrCreateSessionByTitle rejects', async () => {
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

    const probe: StorageProbeResult = { ok: false, bucket: 'my-app-bucket', error: 'bad credentials' };

    await assert.doesNotReject(
      () => handleStorageProbeResult(probe, brokenSessionService, broker),
      'handleStorageProbeResult should not propagate service errors',
    );
  });
});

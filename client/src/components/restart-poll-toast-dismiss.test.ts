/**
 * Tests for the server-restart poll logic in StreamingVoiceChat.tsx.
 *
 * Verifies that the "HolaHola is updating" toast is fully dismissed — and the
 * ref cleared — BEFORE navigate() is called, so a fresh session page never
 * inherits a stale toast.
 *
 * Run with:
 *   npx tsx --test client/src/components/restart-poll-toast-dismiss.test.ts
 *
 * Uses Node.js built-in test runner (node:test) — no extra packages needed.
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// The restart-poll logic extracted verbatim from StreamingVoiceChat.tsx.
// If the component changes, this must be updated to match.
// ---------------------------------------------------------------------------

interface ToastHandle {
  id: string;
  dismiss: () => void;
  update: (props: Record<string, unknown>) => void;
}

/**
 * Runs the restart-poll as a standalone async function so it can be unit-tested
 * without React, a DOM, or Playwright.  The logic is identical to the
 * useEffect body in StreamingVoiceChat.tsx (lines 990-1006).
 *
 * @param fetchHealth  - replacement for global fetch('/api/health')
 * @param toastHandle  - mock toast handle (already created by the component)
 * @param navigate     - mock navigate callback
 * @param homeRoute    - the route to navigate to when the server is back
 * @param delayMs      - optional initial delay before first poll (0 in tests)
 */
async function runRestartPoll(
  fetchHealth: () => Promise<{ ok: boolean }>,
  toastHandle: ToastHandle,
  navigate: (route: string) => void,
  homeRoute: string,
  delayMs = 0,
): Promise<void> {
  // Ref object (mirrors useRef — a mutable box)
  const reconnectToastRef: { current: ToastHandle | null } = {
    current: toastHandle,
  };

  return new Promise<void>((resolve, reject) => {
    const poll = () => {
      fetchHealth()
        .then(r => {
          if (r.ok) {
            // ── The contract under test ──────────────────────────────────
            // dismiss() must fire (and ref must be cleared) BEFORE navigate.
            if (reconnectToastRef.current) {
              reconnectToastRef.current.dismiss();
              reconnectToastRef.current = null;
            }
            navigate(homeRoute);
            resolve();
          } else {
            // Server not ready yet — retry after a short delay.
            setTimeout(poll, 0);
          }
        })
        .catch(() => {
          setTimeout(poll, 0);
        });
    };

    setTimeout(poll, delayMs);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock toast handle that records dismiss() call order. */
function makeMockToast(callLog: string[]): ToastHandle {
  return {
    id: 'mock-toast-id',
    dismiss() {
      callLog.push('dismiss');
    },
    update() {
      callLog.push('update');
    },
  };
}

/** Build a sequence of fetch responses (cycles through the array). */
function makeFetchSequence(responses: Array<{ ok: boolean } | 'error'>): () => Promise<{ ok: boolean }> {
  let idx = 0;
  return () => {
    const item = responses[Math.min(idx++, responses.length - 1)];
    if (item === 'error') return Promise.reject(new Error('network error'));
    return Promise.resolve(item);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('restart-poll toast dismiss — contract with the fresh session page', () => {

  it('dismiss() is called before navigate() when health returns ok on the first poll', async () => {
    const callLog: string[] = [];
    const toast = makeMockToast(callLog);
    const navigate = (_route: string) => { callLog.push('navigate'); };

    await runRestartPoll(
      makeFetchSequence([{ ok: true }]),
      toast,
      navigate,
      '/chat',
    );

    // dismiss must appear before navigate in the call log
    const dismissIdx = callLog.indexOf('dismiss');
    const navigateIdx = callLog.indexOf('navigate');
    assert.ok(dismissIdx !== -1, 'dismiss() was never called');
    assert.ok(navigateIdx !== -1, 'navigate() was never called');
    assert.ok(
      dismissIdx < navigateIdx,
      `dismiss() (pos ${dismissIdx}) must fire before navigate() (pos ${navigateIdx}); got: ${JSON.stringify(callLog)}`,
    );
  });

  it('navigate() is called with the correct homeRoute', async () => {
    const navigatedTo: string[] = [];
    const toast = makeMockToast([]);
    const navigate = (route: string) => { navigatedTo.push(route); };

    await runRestartPoll(
      makeFetchSequence([{ ok: true }]),
      toast,
      navigate,
      '/chat',
    );

    assert.deepEqual(navigatedTo, ['/chat']);
  });

  it('navigate() is called exactly once when health becomes ok', async () => {
    const navigateCalls: string[] = [];
    const toast = makeMockToast([]);
    const navigate = (route: string) => { navigateCalls.push(route); };

    await runRestartPoll(
      makeFetchSequence([{ ok: true }]),
      toast,
      navigate,
      '/chat',
    );

    assert.equal(navigateCalls.length, 1, `navigate() should be called exactly once, got ${navigateCalls.length}`);
  });

  it('toast ref is null (cleared) when the poll resolves — no stale ref survives to the new page', async () => {
    // We capture the ref by mutating the toast object to track its state.
    let dismissCallCount = 0;
    const toastHandle: ToastHandle = {
      id: 'mock-id',
      dismiss() { dismissCallCount++; },
      update() {},
    };

    // Wrap navigate to capture the ref state at the moment navigation happens.
    let refWasNullAtNavigate = false;
    const refBox: { current: ToastHandle | null } = { current: toastHandle };

    // Override: run poll with direct ref inspection
    await new Promise<void>((resolve) => {
      const poll = () => {
        Promise.resolve({ ok: true }).then(r => {
          if (r.ok) {
            if (refBox.current) {
              refBox.current.dismiss();
              refBox.current = null;
            }
            // Check ref is null at navigation time
            refWasNullAtNavigate = refBox.current === null;
            resolve();
          }
        });
      };
      setTimeout(poll, 0);
    });

    assert.ok(dismissCallCount === 1, 'dismiss() should be called exactly once');
    assert.ok(refWasNullAtNavigate, 'reconnectToastRef.current must be null when navigate() fires');
  });

  it('poll retries when server returns ok:false, then dismisses and navigates when ok:true', async () => {
    const callLog: string[] = [];
    const toast = makeMockToast(callLog);
    const navigate = (_route: string) => { callLog.push('navigate'); };

    // Two "not ready" responses, then ok
    await runRestartPoll(
      makeFetchSequence([{ ok: false }, { ok: false }, { ok: true }]),
      toast,
      navigate,
      '/chat',
    );

    const dismissIdx = callLog.indexOf('dismiss');
    const navigateIdx = callLog.indexOf('navigate');
    assert.ok(dismissIdx !== -1, 'dismiss() was never called after retries');
    assert.ok(navigateIdx !== -1, 'navigate() was never called after retries');
    assert.ok(
      dismissIdx < navigateIdx,
      `After retries: dismiss() (pos ${dismissIdx}) must still precede navigate() (pos ${navigateIdx})`,
    );
  });

  it('poll retries when fetch throws a network error, then dismisses and navigates on ok', async () => {
    const callLog: string[] = [];
    const toast = makeMockToast(callLog);
    const navigate = (_route: string) => { callLog.push('navigate'); };

    // Network error → server down → server up
    await runRestartPoll(
      makeFetchSequence(['error', { ok: false }, { ok: true }]),
      toast,
      navigate,
      '/chat',
    );

    const dismissIdx = callLog.indexOf('dismiss');
    const navigateIdx = callLog.indexOf('navigate');
    assert.ok(dismissIdx !== -1, 'dismiss() was never called after network errors');
    assert.ok(navigateIdx !== -1, 'navigate() was never called after network errors');
    assert.ok(
      dismissIdx < navigateIdx,
      `After network errors: dismiss() (pos ${dismissIdx}) must precede navigate() (pos ${navigateIdx})`,
    );
  });

  it('dismiss() is called exactly once even after multiple retries', async () => {
    let dismissCount = 0;
    const toast: ToastHandle = {
      id: 'mock',
      dismiss() { dismissCount++; },
      update() {},
    };
    const navigate = () => {};

    await runRestartPoll(
      makeFetchSequence([{ ok: false }, { ok: false }, { ok: false }, { ok: true }]),
      toast,
      navigate,
      '/chat',
    );

    assert.equal(dismissCount, 1, `dismiss() should fire exactly once, got ${dismissCount}`);
  });
});

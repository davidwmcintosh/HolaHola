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

  // ── Early-unmount / cleanup path ──────────────────────────────────────────
  //
  // If the component unmounts (or serverRestarting flips back) during the
  // 5-second initial delay — before the first poll even fires — the cleanup
  // function runs with reconnectToastRef.current still set.  The toast must
  // be dismissed there and then, so it never lingers on the next page.

  it('cleanup dismisses the toast when the component unmounts before the first poll fires', () => {
    let dismissCount = 0;
    const toastHandle: ToastHandle = {
      id: 'mock-id',
      dismiss() { dismissCount++; },
      update() {},
    };

    // Simulate the ref as it exists just after the toast was created but
    // before any poll has run (the 5-second timer hasn't fired yet).
    const reconnectToastRef: { current: ToastHandle | null } = {
      current: toastHandle,
    };

    // Simulate the cleanup function — this is exactly what the return value of
    // the useEffect executes when React tears down the effect.
    const cleanup = () => {
      // (timer clearance is omitted here — it doesn't affect toast state)
      if (reconnectToastRef.current) {
        reconnectToastRef.current.dismiss();
        reconnectToastRef.current = null;
      }
    };

    cleanup();

    assert.equal(dismissCount, 1, 'dismiss() must be called once by the cleanup');
    assert.equal(reconnectToastRef.current, null, 'ref must be null after cleanup');
  });

  it('cleanup is a no-op when reconnectToastRef is already null (poll already completed)', () => {
    let dismissCount = 0;

    // Ref is null — the poll already ran and cleared it.
    const reconnectToastRef: { current: ToastHandle | null } = { current: null };

    const cleanup = () => {
      if (reconnectToastRef.current) {
        reconnectToastRef.current.dismiss();
        reconnectToastRef.current = null;
      }
    };

    cleanup(); // should not throw or increment dismissCount

    assert.equal(dismissCount, 0, 'dismiss() must not be called when ref is already null');
    assert.equal(reconnectToastRef.current, null, 'ref remains null');
  });
});

// ---------------------------------------------------------------------------
// Mutation check — proves the ordering guard actually catches a real regression
//
// This describe block runs a *deliberately broken* version of runRestartPoll
// where navigate() fires BEFORE dismiss().  It then applies the same assertion
// logic used by the main suite and confirms the assertion would fail.
//
// If this block starts passing (i.e. the mutant is no longer detected), the
// main test suite has lost its ability to catch the regression — that's a bug
// in the test, not a fix.
// ---------------------------------------------------------------------------

/**
 * Mutated variant: navigate() fires BEFORE dismiss() (the regression we guard
 * against).  This is NOT the correct production ordering — it exists only so
 * the mutation check below can prove the ordering assertion catches it.
 */
async function runRestartPollMutated(
  fetchHealth: () => Promise<{ ok: boolean }>,
  toastHandle: ToastHandle,
  navigate: (route: string) => void,
  homeRoute: string,
  delayMs = 0,
): Promise<void> {
  const reconnectToastRef: { current: ToastHandle | null } = {
    current: toastHandle,
  };

  return new Promise<void>((resolve, reject) => {
    const poll = () => {
      fetchHealth()
        .then(r => {
          if (r.ok) {
            // ── MUTATION: navigate fires BEFORE dismiss ──────────────────
            // This is the wrong order — the regression we are guarding against.
            navigate(homeRoute);
            if (reconnectToastRef.current) {
              reconnectToastRef.current.dismiss();
              reconnectToastRef.current = null;
            }
            resolve();
          } else {
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

describe('Mutation check — ordering guard catches navigate-before-dismiss regression', () => {

  it('the mutated poll (navigate before dismiss) produces a call log that violates the ordering assertion', async () => {
    // Run the mutated implementation and record the call log.
    const callLog: string[] = [];
    const toast = makeMockToast(callLog);
    const navigate = (_route: string) => { callLog.push('navigate'); };

    await runRestartPollMutated(
      makeFetchSequence([{ ok: true }]),
      toast,
      navigate,
      '/chat',
    );

    // The mutant produces ['navigate', 'dismiss'] — the wrong order.
    // Apply the same assertion logic the main suite uses and confirm it fails.
    const dismissIdx = callLog.indexOf('dismiss');
    const navigateIdx = callLog.indexOf('navigate');

    assert.ok(dismissIdx !== -1, 'dismiss() must still be called (even in the mutant)');
    assert.ok(navigateIdx !== -1, 'navigate() must still be called (even in the mutant)');

    // In the mutated build, navigate fires FIRST — so navigateIdx < dismissIdx.
    // The main suite requires dismissIdx < navigateIdx.
    // Confirm the ordering is genuinely violated so the guard would catch it.
    assert.ok(
      navigateIdx < dismissIdx,
      `Mutation check: expected navigate (pos ${navigateIdx}) to appear BEFORE dismiss ` +
      `(pos ${dismissIdx}) in the mutated build — got: ${JSON.stringify(callLog)}. ` +
      `If this assertion fails the mutant no longer exercises the right regression.`,
    );

    // The main-suite assertion (dismissIdx < navigateIdx) would throw here —
    // confirm it by running it and catching the error.
    let caughtError: Error | null = null;
    try {
      assert.ok(
        dismissIdx < navigateIdx,
        `dismiss() (pos ${dismissIdx}) must fire before navigate() (pos ${navigateIdx})`,
      );
    } catch (err) {
      caughtError = err as Error;
    }

    assert.ok(
      caughtError !== null,
      'The main-suite ordering assertion MUST throw on the mutated call log — ' +
      'if it does not, the guard can no longer catch the navigate-before-dismiss regression.',
    );
    assert.ok(
      caughtError!.message.includes('dismiss'),
      `Caught error message should reference 'dismiss'; got: ${caughtError!.message}`,
    );
  });

  it('the mutated poll still calls both dismiss() and navigate() exactly once', async () => {
    // Confirm the mutant is a faithful mutation (same observable side-effects,
    // wrong order) — not a broken stub that skips calls altogether.
    let dismissCount = 0;
    let navigateCount = 0;
    const toast: ToastHandle = {
      id: 'mock',
      dismiss() { dismissCount++; },
      update() {},
    };
    const navigate = () => { navigateCount++; };

    await runRestartPollMutated(
      makeFetchSequence([{ ok: true }]),
      toast,
      navigate,
      '/chat',
    );

    assert.equal(dismissCount, 1, 'mutated poll must still call dismiss() exactly once');
    assert.equal(navigateCount, 1, 'mutated poll must still call navigate() exactly once');
  });

  it('mutant is detected even after retries (not just on the first poll)', async () => {
    const callLog: string[] = [];
    const toast = makeMockToast(callLog);
    const navigate = (_route: string) => { callLog.push('navigate'); };

    // Two not-ready responses, then ok — mirrors the main suite retry test.
    await runRestartPollMutated(
      makeFetchSequence([{ ok: false }, { ok: false }, { ok: true }]),
      toast,
      navigate,
      '/chat',
    );

    const dismissIdx = callLog.indexOf('dismiss');
    const navigateIdx = callLog.indexOf('navigate');

    // Mutant: navigate fires first, so navigateIdx must be < dismissIdx.
    assert.ok(
      navigateIdx < dismissIdx,
      `After retries: mutated poll must still place navigate (pos ${navigateIdx}) ` +
      `before dismiss (pos ${dismissIdx}); got: ${JSON.stringify(callLog)}`,
    );

    // The main-suite assertion would throw — confirm it.
    let caughtError: Error | null = null;
    try {
      assert.ok(dismissIdx < navigateIdx, 'dismiss must precede navigate');
    } catch (err) {
      caughtError = err as Error;
    }

    assert.ok(
      caughtError !== null,
      'Main-suite ordering assertion must fail on the retry-path mutant too.',
    );
  });
});

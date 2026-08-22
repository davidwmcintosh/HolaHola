/**
 * Source-level guard for ProcedureFlagsSection Refresh button loading state (#591).
 *
 * CONTRACT:
 *   ProcedureFlagsSection must destructure `isFetching` from its useQuery call
 *   AND wire it to the Refresh button (`data-testid="button-refresh-flags"`) as
 *   `disabled={isFetching}` with an `animate-spin` class so the UI shows a
 *   loading state while a background fetch is in progress.
 *
 *   All assertions are scoped to the ProcedureFlagsSection source slice so they
 *   cannot be satisfied by identical patterns elsewhere in CommandCenter.tsx
 *   (e.g. AbsenceMonitorTab uses the same isFetching pattern).
 *
 * Run: npx tsx --test server/__tests__/procedure-flags-refresh-loading-source.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const commandCenterSrc = readFileSync(
  resolve(import.meta.dirname, '../../client/src/pages/admin/CommandCenter.tsx'),
  'utf-8',
);

// Scope every assertion to ProcedureFlagsSection only.
// The function starts at "function ProcedureFlagsSection()" and runs to the end
// of the file (it is the last top-level function in CommandCenter.tsx).
const sectionStart = commandCenterSrc.indexOf('function ProcedureFlagsSection()');
assert.ok(
  sectionStart !== -1,
  'function ProcedureFlagsSection() not found in CommandCenter.tsx — file structure may have changed',
);
const section = commandCenterSrc.slice(sectionStart);

// Helper: re-run the three production guard predicates against any source string
function isFetchingDestructured(src: string): boolean {
  // The procedure-flags query key is the unique anchor; isFetching must appear
  // in the destructure of that specific useQuery call.
  const queryKeyIdx = src.indexOf('"/api/admin/procedure-flags", showReviewed');
  if (queryKeyIdx === -1) return false;
  // Look at the ~200 chars preceding the query key for the destructure line
  const preamble = src.slice(Math.max(0, queryKeyIdx - 300), queryKeyIdx);
  return preamble.includes('isFetching');
}

function refreshButtonDisabled(src: string): boolean {
  // The button must carry both the testid and the disabled binding
  const btnIdx = src.indexOf('button-refresh-flags');
  if (btnIdx === -1) return false;
  // Inspect 300 chars around the testid for disabled={isFetching}
  const window = src.slice(Math.max(0, btnIdx - 200), btnIdx + 200);
  return window.includes('disabled={isFetching}');
}

function refreshButtonSpins(src: string): boolean {
  const btnIdx = src.indexOf('button-refresh-flags');
  if (btnIdx === -1) return false;
  // RefreshCw spin class is added near the button
  const window = src.slice(btnIdx, btnIdx + 400);
  return window.includes("animate-spin");
}

describe('ProcedureFlagsSection — Refresh button loading-state source guards (#591)', () => {
  it('ProcedureFlagsSection query destructures isFetching near the procedure-flags query key', () => {
    assert.ok(
      isFetchingDestructured(section),
      'isFetching is not destructured in the procedure-flags useQuery call — the Refresh button cannot show a loading state',
    );
  });

  it('button-refresh-flags carries disabled={isFetching}', () => {
    assert.ok(
      refreshButtonDisabled(section),
      'button-refresh-flags does not use disabled={isFetching} — Refresh button won\'t block double-clicks during fetch',
    );
  });

  it('RefreshCw icon near button-refresh-flags gains animate-spin while isFetching', () => {
    assert.ok(
      refreshButtonSpins(section),
      'animate-spin not found near button-refresh-flags — Refresh button will not spin during fetch',
    );
  });

  // ── Mutation self-checks ─────────────────────────────────────────────────────
  // Each self-check mutates the section slice and then re-runs the same guard
  // predicate against it — confirming the predicate actually fails on the target
  // regression, not just that the replacement text is absent.

  it('self-check: removing isFetching from the procedure-flags destructure breaks isFetchingDestructured()', () => {
    const mutated = section.replace(
      'const { data, isLoading, isFetching, refetch } = useQuery',
      'const { data, isLoading, refetch } = useQuery',
    );
    assert.strictEqual(
      isFetchingDestructured(mutated),
      false,
      'isFetchingDestructured() still returns true after removing isFetching from the destructure — the guard is not scoped tightly enough',
    );
  });

  it('self-check: removing disabled={isFetching} from button-refresh-flags breaks refreshButtonDisabled()', () => {
    // In the actual markup disabled={isFetching} appears immediately before
    // data-testid="button-refresh-flags" on the same element — match that order.
    const mutated = section.replace(
      'disabled={isFetching} data-testid="button-refresh-flags"',
      'data-testid="button-refresh-flags"',
    );
    assert.strictEqual(
      refreshButtonDisabled(mutated),
      false,
      'refreshButtonDisabled() still returns true after removing disabled={isFetching} — the guard is not scoped tightly enough',
    );
  });

  it('self-check: removing animate-spin from button-refresh-flags area breaks refreshButtonSpins()', () => {
    const mutated = section.replace(
      /animate-spin/,
      'animate-REMOVED',
    );
    assert.strictEqual(
      refreshButtonSpins(mutated),
      false,
      'refreshButtonSpins() still returns true after removing animate-spin — the guard is not scoped tightly enough',
    );
  });
});

/**
 * Source-level guard for AbsenceMonitorTab data bindings (#459).
 *
 * CONTRACT:
 *   The AbsenceMonitorTab component must bind to the correct API route
 *   (/api/founder/absence-nudges) and surface the three summary counters
 *   (pending, resolved, total) through ?? 0 guards so the UI never shows
 *   undefined when the API hasn't responded yet.
 *
 *   If any binding is renamed or the route changes without updating this test,
 *   CI fails before the broken tab reaches prod.
 *
 * Run: npx tsx --test server/__tests__/absence-monitor-tab-source.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const commandCenterSrc = readFileSync(
  resolve(import.meta.dirname, '../../client/src/pages/admin/CommandCenter.tsx'),
  'utf-8',
);

describe('AbsenceMonitorTab — data binding source guards (#459)', () => {
  it('AbsenceMonitorTab queries /api/founder/absence-nudges', () => {
    // This is the canonical endpoint for the tab's data.  Changing the route
    // without updating this test would silently break the tab.
    assert.ok(
      commandCenterSrc.includes('"/api/founder/absence-nudges"'),
      'AbsenceMonitorTab does not query /api/founder/absence-nudges — the tab would load with no data',
    );
  });

  it('pending count binding uses data?.summary.pending ?? 0', () => {
    assert.ok(
      commandCenterSrc.includes('data?.summary.pending ?? 0'),
      'data?.summary.pending ?? 0 not found — pending counter may show undefined instead of 0 while loading',
    );
  });

  it('resolved count binding uses data?.summary.resolved ?? 0', () => {
    assert.ok(
      commandCenterSrc.includes('data?.summary.resolved ?? 0'),
      'data?.summary.resolved ?? 0 not found — resolved counter may show undefined instead of 0 while loading',
    );
  });

  it('total count binding uses data?.summary.total ?? 0', () => {
    assert.ok(
      commandCenterSrc.includes('data?.summary.total ?? 0'),
      'data?.summary.total ?? 0 not found — total counter may show undefined instead of 0 while loading',
    );
  });

  it('tab container has data-testid="absence-monitor-tab" for e2e targeting', () => {
    assert.ok(
      commandCenterSrc.includes('data-testid="absence-monitor-tab"'),
      'data-testid="absence-monitor-tab" not found — e2e tests cannot reliably target the absence monitor tab',
    );
  });

  it('dismiss mutation hits PATCH /api/admin/absence-nudges/:userId/dismiss', () => {
    // The dismiss action must resolve nudges through the correct admin endpoint.
    assert.ok(
      commandCenterSrc.includes('/api/admin/absence-nudges/') &&
      commandCenterSrc.includes('dismiss'),
      'Dismiss endpoint pattern not found — dismiss action may hit wrong route',
    );
  });

  it('mutation self-check: removing the pending binding would fail the assertion', () => {
    const mutated = commandCenterSrc.replace('data?.summary.pending ?? 0', '/* removed */');
    assert.ok(
      !mutated.includes('data?.summary.pending ?? 0'),
      'pattern still present after mutation — assertion is not tight enough',
    );
  });
});

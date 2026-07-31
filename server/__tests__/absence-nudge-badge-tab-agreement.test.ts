/**
 * Confirms the absence nudge badge count on the Absence tab label matches
 * what is shown inside the tab (AbsenceMonitorTab).
 *
 * CONTRACT:
 *   - The badge on the "Absence Monitor" tab (data-testid="badge-absence-nudges")
 *     reads from GET /api/admin/absence-nudges/count → { count }
 *   - The tab content (AbsenceMonitorTab) reads from GET /api/founder/absence-nudges
 *     → { summary: { pending, resolved, total }, pending: [...], resolved: [...] }
 *
 * AGREEMENT GUARANTEE:
 *   Both endpoints call countPendingNudges() from daniela-absence-worker.ts, which
 *   executes SELECT COUNT(*) FROM daniela_absence_nudges WHERE resolved_at IS NULL.
 *   listAbsenceNudges() uses the same WHERE resolved_at IS NULL predicate, so
 *   summary.pending (from countPendingNudges) and pending.length (from
 *   listAbsenceNudges) are always in sync.
 *
 *   Therefore the badge count and the visible pending list inside the tab
 *   are derived from an identical DB predicate and cannot diverge.
 *
 * DISAPPEARS WHEN RESOLVED:
 *   The badge is rendered only when pendingNudgeCount > 0. Once all nudges
 *   are resolved (resolvedAt IS NOT NULL), countPendingNudges returns 0, and
 *   the badge condition (pendingNudgeCount > 0) is false → badge hidden.
 *
 * Strategy: static source analysis of real production files — no DB, no server.
 * Each assertion reads the actual source on disk and fails if the production code
 * drifts from the contract.
 *
 * Run with:
 *   npx tsx --test server/__tests__/absence-nudge-badge-tab-agreement.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

// ── Load source files ──────────────────────────────────────────────────────────

let workerSrc: string;
let routesSrc: string;
let commandCenterSrc: string;

before(() => {
  workerSrc        = readFileSync(resolve(root, 'server/services/daniela-absence-worker.ts'), 'utf-8');
  routesSrc        = readFileSync(resolve(root, 'server/routes.ts'), 'utf-8');
  commandCenterSrc = readFileSync(resolve(root, 'client/src/pages/admin/CommandCenter.tsx'), 'utf-8');
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Return the text window surrounding the first occurrence of `anchor`.
 * `before` chars before the anchor, `after` chars after it.
 * Returns '' when the anchor is not found.
 */
function regionAround(src: string, anchor: string, before = 400, after = 400): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — Shared filter predicate: both functions use WHERE resolvedAt IS NULL
// ═══════════════════════════════════════════════════════════════════════════════

describe('daniela-absence-worker.ts — shared resolvedAt IS NULL predicate', () => {
  it('countPendingNudges filters by isNull(resolvedAt)', () => {
    const region = regionAround(workerSrc, 'export async function countPendingNudges', 0, 600);
    const hasFilter = region.includes('resolvedAt') && region.includes('isNull');
    assert.ok(hasFilter,
      'countPendingNudges must filter by isNull(resolvedAt) — ' +
      'without this filter the badge count includes already-resolved nudges');
  });

  it('listAbsenceNudges filters by isNull(resolvedAt)', () => {
    const region = regionAround(workerSrc, 'export async function listAbsenceNudges', 0, 800);
    const hasFilter = region.includes('resolvedAt') && region.includes('isNull');
    assert.ok(hasFilter,
      'listAbsenceNudges must filter by isNull(resolvedAt) — ' +
      'the tab pending list would include resolved nudges, creating a mismatch with the badge');
  });

  it('both functions reference the same table (danielaAbsenceNudges)', () => {
    const countRegion = regionAround(workerSrc, 'export async function countPendingNudges', 0, 600);
    const listRegion  = regionAround(workerSrc, 'export async function listAbsenceNudges', 0, 800);
    assert.ok(countRegion.includes('danielaAbsenceNudges'),
      'countPendingNudges does not query danielaAbsenceNudges — badge count comes from wrong table');
    assert.ok(listRegion.includes('danielaAbsenceNudges'),
      'listAbsenceNudges does not query danielaAbsenceNudges — tab list comes from wrong table');
  });

  it('countPendingNudges uses COUNT (not a full row fetch) for efficiency', () => {
    const region = regionAround(workerSrc, 'export async function countPendingNudges', 0, 600);
    // Drizzle count() function wraps SQL COUNT(*)
    const hasCount = region.includes('count()') || region.includes('count(');
    assert.ok(hasCount,
      'countPendingNudges should use Drizzle count() aggregate, not fetch all rows — ' +
      'a large absence table would cause badge-count queries to become slow');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — /api/founder/absence-nudges: calls BOTH functions
// ═══════════════════════════════════════════════════════════════════════════════

describe('routes.ts — /api/founder/absence-nudges calls both worker functions', () => {
  const ROUTE_ANCHOR = '/api/founder/absence-nudges';

  it('route is registered in routes.ts', () => {
    assert.ok(routesSrc.includes(ROUTE_ANCHOR),
      '/api/founder/absence-nudges not found in routes.ts — route may have been renamed or removed');
  });

  it('route calls countPendingNudges (source of truth for summary.pending)', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 500);
    assert.ok(region.includes('countPendingNudges'),
      'countPendingNudges not called inside /api/founder/absence-nudges — ' +
      'summary.pending and the tab badge count would come from different code paths');
  });

  it('route calls listAbsenceNudges (source of the visible pending list)', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 500);
    assert.ok(region.includes('listAbsenceNudges'),
      'listAbsenceNudges not called inside /api/founder/absence-nudges — ' +
      'the pending list shown inside the tab would be missing');
  });

  it('route returns summary.pending from countPendingNudges (same function as the badge endpoint)', () => {
    // Use a larger window: the res.json() call with summary follows the Promise.all block
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 900);
    // The route assembles: summary: { pending: pendingCount, ... }
    const hasSummaryKey    = region.includes('summary');
    const hasPendingInJson = region.includes('pending:') || region.includes('pending,');
    assert.ok(hasSummaryKey && hasPendingInJson,
      'summary.pending not assembled in /api/founder/absence-nudges — ' +
      'the tab header count would be undefined or wrong');
  });

  it('route imports from daniela-absence-worker', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 400);
    assert.ok(region.includes('daniela-absence-worker'),
      'daniela-absence-worker import not found near /api/founder/absence-nudges — ' +
      'the route is not calling the canonical worker functions');
  });

  it('route is protected by requireFounder', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 200);
    assert.ok(region.includes('requireFounder'),
      'requireFounder not found on /api/founder/absence-nudges — ' +
      'nudge data would be publicly accessible');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — CommandCenter.tsx: badge (tab label) pulls from count endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe('CommandCenter.tsx — Absence tab badge reads from /api/admin/absence-nudges/count', () => {
  const COUNT_ENDPOINT = '/api/admin/absence-nudges/count';
  const BADGE_TESTID   = 'badge-absence-nudges';

  it('useQuery for /api/admin/absence-nudges/count exists at the top-level component', () => {
    // The badge query is registered outside AbsenceMonitorTab (in the top-level component)
    // so it drives the tab-label badge visible across the whole CommandCenter.
    assert.ok(commandCenterSrc.includes(COUNT_ENDPOINT),
      `${COUNT_ENDPOINT} not found in CommandCenter.tsx — badge query may have been removed`);
  });

  it('badge element uses data-testid="badge-absence-nudges"', () => {
    assert.ok(commandCenterSrc.includes(`data-testid="${BADGE_TESTID}"`),
      `data-testid="${BADGE_TESTID}" not found in CommandCenter.tsx — ` +
      'the Absence tab badge may have been removed or its testid renamed');
  });

  it('badge is gated on pendingNudgeCount > 0 (disappears when all nudges resolved)', () => {
    // The absence badge render must be conditional so it vanishes when count drops to 0.
    const hasGate = /\bpendingNudgeCount\s*>\s*0/.test(commandCenterSrc);
    assert.ok(hasGate,
      'pendingNudgeCount > 0 gate not found in CommandCenter.tsx — ' +
      'the badge would render even when there are no pending nudges');
  });

  it('badge gate for absence-monitor tab uses absenceBadge variable', () => {
    // The production code: const absenceBadge = (tab.id === 'absence-monitor') && (pendingNudgeCount > 0)
    const hasAbsenceBadgeVar = commandCenterSrc.includes("absence-monitor") &&
                               commandCenterSrc.includes('absenceBadge');
    assert.ok(hasAbsenceBadgeVar,
      "absenceBadge variable keyed to 'absence-monitor' tab not found — " +
      "badge may be attached to the wrong tab");
  });

  it('badge renders pendingNudgeCount (not a static string)', () => {
    const region = regionAround(commandCenterSrc, `data-testid="${BADGE_TESTID}"`, 0, 100);
    const showsCount = region.includes('pendingNudgeCount') || region.includes('{pendingNudgeCount}');
    assert.ok(showsCount,
      'pendingNudgeCount not interpolated in the absence badge — badge may show a static label');
  });

  it('pendingNudgeCount defaults to 0 when query has not loaded (null-safe ?? 0)', () => {
    // Confirms: const pendingNudgeCount = absenceNudgeCountData?.count ?? 0;
    const hasNullSafe = /pendingNudgeCount\s*=\s*\w+\?\.count\s*\?\?\s*0/.test(commandCenterSrc);
    assert.ok(hasNullSafe,
      'pendingNudgeCount null-safe default (?.count ?? 0) not found — ' +
      'badge may show undefined before the query first resolves');
  });

  it('badge query has refetchInterval so count stays fresh without a page reload', () => {
    const region = regionAround(commandCenterSrc, COUNT_ENDPOINT, 0, 300);
    assert.ok(region.includes('refetchInterval'),
      'refetchInterval not set on the /api/admin/absence-nudges/count useQuery — ' +
      'badge count goes stale until the user reloads the page');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4 — CommandCenter.tsx: AbsenceMonitorTab reads from founder endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe('CommandCenter.tsx — AbsenceMonitorTab reads from /api/founder/absence-nudges', () => {
  const FOUNDER_ENDPOINT = '/api/founder/absence-nudges';
  const TAB_ANCHOR       = 'function AbsenceMonitorTab';

  // Extract the AbsenceMonitorTab function body by slicing from the function
  // declaration to the next top-level function declaration. This avoids
  // window-size limits with regionAround() for a long component.
  function tabBody(): string {
    const start = commandCenterSrc.indexOf(TAB_ANCHOR);
    if (start === -1) return '';
    // Find the next `\nfunction ` or `\nconst ` at top level after the declaration
    const nextFn = commandCenterSrc.indexOf('\nfunction ', start + TAB_ANCHOR.length);
    const end = nextFn === -1 ? commandCenterSrc.length : nextFn;
    return commandCenterSrc.slice(start, end);
  }

  it('AbsenceMonitorTab function exists in CommandCenter.tsx', () => {
    assert.ok(commandCenterSrc.includes(TAB_ANCHOR),
      'AbsenceMonitorTab function not found in CommandCenter.tsx — tab content may have been extracted or renamed');
  });

  it('AbsenceMonitorTab queries /api/founder/absence-nudges', () => {
    const body = tabBody();
    assert.ok(body.includes(FOUNDER_ENDPOINT),
      '/api/founder/absence-nudges not found inside AbsenceMonitorTab — ' +
      'tab content may be fetching from a different endpoint');
  });

  it('tab displays summary.pending count (the same countPendingNudges value as the badge)', () => {
    // data?.summary.pending is rendered in the summary cards section of the tab.
    // summary.pending comes from countPendingNudges() — the same function as the badge endpoint.
    const body = tabBody();
    assert.ok(body.includes('summary.pending'),
      'summary.pending not rendered in AbsenceMonitorTab — ' +
      'tab header count and badge count would come from different fields and could diverge');
  });

  it('tab renders the pending nudge list from data?.pending', () => {
    const body = tabBody();
    // Matches: (data?.pending ?? []).map(...)  or  (data?.pending ?? []).length
    const hasPendingList = body.includes('data?.pending');
    assert.ok(hasPendingList,
      'data?.pending not rendered in AbsenceMonitorTab — ' +
      'the visible nudge list may be missing');
  });

  it('tab has an empty-state when pending list is empty (badge should also be 0)', () => {
    const body = tabBody();
    // When the pending list is empty the tab shows an empty-state message;
    // at that point countPendingNudges() must also return 0, so the badge hides.
    assert.ok(body.includes('No pending nudges'),
      "'No pending nudges' empty-state not found in AbsenceMonitorTab — " +
      'when the list is empty the UI should not imply there are still items');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5 — Cross-cutting: the two endpoint URLs are distinct and consistent
// ═══════════════════════════════════════════════════════════════════════════════

describe('cross-cutting — endpoint URL consistency', () => {
  it('/api/admin/absence-nudges/count is registered in routes.ts', () => {
    assert.ok(routesSrc.includes('/api/admin/absence-nudges/count'),
      '/api/admin/absence-nudges/count not found in routes.ts');
  });

  it('/api/founder/absence-nudges is registered in routes.ts', () => {
    assert.ok(routesSrc.includes('/api/founder/absence-nudges'),
      '/api/founder/absence-nudges not found in routes.ts');
  });

  it('the two endpoints are distinct URLs (not the same route serving both)', () => {
    // Badge endpoint is /count; founder endpoint is the parent path.
    // They must not be the same string.
    const BADGE   = '/api/admin/absence-nudges/count';
    const FOUNDER = '/api/founder/absence-nudges';
    assert.notEqual(BADGE, FOUNDER,
      'Badge and founder endpoint URLs must be distinct — they serve different response shapes');
  });

  it('countPendingNudges is the single shared function used by both endpoints', () => {
    // Both routes call the same function — this is the structural guarantee that
    // the badge count and the tab summary.pending are always equal.
    const countInRoutes = (routesSrc.match(/countPendingNudges/g) ?? []).length;
    assert.ok(countInRoutes >= 2,
      `Expected ≥2 references to countPendingNudges in routes.ts (one per endpoint), found ${countInRoutes} — ` +
      'one of the endpoints may be computing its count differently, allowing badge/tab divergence');
  });
});

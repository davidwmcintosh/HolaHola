/**
 * Confirms the absence nudge count badge is correctly wired into the
 * CommandCenter EXPRESS Lane card header.
 *
 * Covers the full vertical slice:
 *
 *   daniela-absence-worker.ts  — countPendingNudges is exported
 *   routes.ts                  — GET /api/admin/absence-nudges/count calls it and returns { count }
 *   CommandCenter.tsx           — EditorChatTab queries the endpoint and renders the badge
 *                                 only when count > 0
 *
 * Strategy: static source analysis of real production files.
 * Each assertion reads the actual source on disk and fails if the production
 * code drifts from the contract (badge removed, gate inverted, endpoint renamed, etc.).
 *
 * Run with:
 *   npx tsx --test server/__tests__/express-lane-nudge-badge.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

// ── Load production source files once ─────────────────────────────────────────

let workerSrc: string;
let routesSrc: string;
let commandCenterSrc: string;

before(() => {
  workerSrc         = readFileSync(resolve(root, 'server/services/daniela-absence-worker.ts'), 'utf-8');
  routesSrc         = readFileSync(resolve(root, 'server/routes.ts'), 'utf-8');
  commandCenterSrc  = readFileSync(resolve(root, 'client/src/pages/admin/CommandCenter.tsx'), 'utf-8');
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extract a window around the FIRST occurrence of `anchor` in `src`.
 * `before` chars before the anchor, `after` chars after it.
 * Returns '' when the anchor is not found.
 */
function regionAround(src: string, anchor: string, before = 400, after = 400): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — daniela-absence-worker.ts: countPendingNudges is exported
// ═══════════════════════════════════════════════════════════════════════════════

describe('daniela-absence-worker.ts — countPendingNudges export', () => {
  it('countPendingNudges is exported as an async function', () => {
    const isExported = /export\s+async\s+function\s+countPendingNudges\s*\(/.test(workerSrc);
    assert.ok(isExported,
      'countPendingNudges must be exported from daniela-absence-worker.ts — ' +
      'the /api/admin/absence-nudges/count route dynamically imports it');
  });

  it('countPendingNudges returns a Promise<number> (return type annotation present)', () => {
    const region = regionAround(workerSrc, 'export async function countPendingNudges', 0, 120);
    const hasReturn = region.includes('Promise<number>');
    assert.ok(hasReturn,
      'countPendingNudges must declare Promise<number> return type — ' +
      'the route sends this value directly to the client as { count }');
  });

  it('countPendingNudges queries the danielaAbsenceNudges table for unresolved rows', () => {
    const region = regionAround(workerSrc, 'export async function countPendingNudges', 0, 800);
    // The function uses danielaAbsenceNudges (the Drizzle table reference) and filters
    // by resolvedAt IS NULL to count only pending (not yet resolved) nudges.
    const hasTableRef = region.includes('danielaAbsenceNudges');
    assert.ok(hasTableRef,
      'countPendingNudges does not reference danielaAbsenceNudges — ' +
      'the count badge would always show 0');
  });

  it('countPendingNudges filters by resolvedAt IS NULL (only unresolved nudges are counted)', () => {
    const region = regionAround(workerSrc, 'export async function countPendingNudges', 0, 800);
    const hasNullFilter = region.includes('resolvedAt') && region.includes('isNull');
    assert.ok(hasNullFilter,
      'resolvedAt + isNull filter not found in countPendingNudges — ' +
      'resolved nudges would be included in the badge count');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — routes.ts: GET /api/admin/absence-nudges/count endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe('routes.ts — GET /api/admin/absence-nudges/count endpoint', () => {
  const ROUTE_ANCHOR = '/api/admin/absence-nudges/count';

  it('route is registered in routes.ts', () => {
    assert.ok(routesSrc.includes(ROUTE_ANCHOR),
      '/api/admin/absence-nudges/count not found in routes.ts — route may have been renamed or removed');
  });

  it('route is a GET handler (not POST or DELETE)', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 50, 10);
    // The `app.get(` call should be within 50 chars before the path string
    const isGet = region.includes('app.get(');
    assert.ok(isGet,
      '/api/admin/absence-nudges/count must be a GET route — ' +
      'the CommandCenter useQuery() call uses GET');
  });

  it('route calls countPendingNudges (dynamically imported from daniela-absence-worker)', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 400);
    assert.ok(region.includes('countPendingNudges'),
      'countPendingNudges call not found within 400 chars of the route registration — ' +
      'endpoint may no longer be fetching the real count');
  });

  it('route imports countPendingNudges from daniela-absence-worker', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 400);
    assert.ok(region.includes('daniela-absence-worker'),
      'import from daniela-absence-worker not found near the count route — ' +
      'countPendingNudges may be called from the wrong source');
  });

  it('route sends the count as { count } JSON (not wrapped differently)', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 400);
    const sendsCount = region.includes('res.json({ count })') || region.includes('{ count }');
    assert.ok(sendsCount,
      'res.json({ count }) not found in the count route — ' +
      'the response shape the client expects is { count: number }');
  });

  it('route is protected by requireFounder (not publicly accessible)', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 200);
    assert.ok(region.includes('requireFounder'),
      'requireFounder middleware not found on /api/admin/absence-nudges/count — ' +
      'the nudge count would be publicly readable');
  });

  it('route has an error handler that returns a 500 on failure (not a silent empty response)', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 500);
    const hasCatch = region.includes('catch') && (region.includes('500') || region.includes('status(500)'));
    assert.ok(hasCatch,
      'No error handler found on /api/admin/absence-nudges/count — ' +
      'a DB failure would crash the route without a response');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — CommandCenter.tsx: EditorChatTab queries the endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe('CommandCenter.tsx — EditorChatTab nudge count query', () => {
  const QUERY_ANCHOR = "'/api/admin/absence-nudges/count'";

  it('EditorChatTab contains a useQuery for /api/admin/absence-nudges/count', () => {
    // The file has two occurrences of this query key (once in the outer tab component,
    // once inside EditorChatTab). Both must be present for the badge to work.
    const occurrences = (commandCenterSrc.match(/\/api\/admin\/absence-nudges\/count/g) ?? []).length;
    assert.ok(occurrences >= 2,
      `Expected ≥2 occurrences of /api/admin/absence-nudges/count in CommandCenter.tsx, found ${occurrences} — ` +
      'EditorChatTab may be missing its own query for the nudge count');
  });

  it('query result is stored in a nudgeCountData / nudgeCount variable', () => {
    // Matches: const { data: nudgeCountData } = useQuery<{ count: number }>({
    const hasVar = commandCenterSrc.includes('nudgeCountData') || commandCenterSrc.includes('nudgeCount');
    assert.ok(hasVar,
      'nudgeCountData variable not found in CommandCenter.tsx — ' +
      'the query result is not being read');
  });

  it('pendingNudgeCount defaults to 0 when the query has not loaded (null-safe fallback)', () => {
    // Matches: const pendingNudgeCount = nudgeCountData?.count ?? 0;
    const hasNullSafe = /pendingNudgeCount\s*=\s*nudgeCountData\?\.count\s*\?\?\s*0/.test(commandCenterSrc);
    assert.ok(hasNullSafe,
      'pendingNudgeCount must default to 0 via ?? 0 — ' +
      'without this, the badge may render with undefined before the query resolves');
  });

  it('query refetchInterval is set (badge stays up-to-date automatically)', () => {
    const region = regionAround(commandCenterSrc, "'/api/admin/absence-nudges/count'", 0, 300);
    // Either refetchInterval or staleTime is present to keep the count fresh.
    const hasPoll = region.includes('refetchInterval');
    assert.ok(hasPoll,
      'refetchInterval not found on the absence-nudges/count useQuery in EditorChatTab — ' +
      'the badge count would go stale until the user reloads');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4 — CommandCenter.tsx: badge renders in the EXPRESS Lane card header
// ═══════════════════════════════════════════════════════════════════════════════

describe('CommandCenter.tsx — EXPRESS Lane badge rendering', () => {
  const BADGE_ANCHOR = 'data-testid="badge-nudge-count"';
  const GATE_ANCHOR  = 'pendingNudgeCount > 0';

  it('badge element with data-testid="badge-nudge-count" exists in CommandCenter.tsx', () => {
    assert.ok(commandCenterSrc.includes(BADGE_ANCHOR),
      'data-testid="badge-nudge-count" not found in CommandCenter.tsx — ' +
      'badge may have been removed or the testid renamed');
  });

  it('badge is inside the EXPRESS Lane card header (near "EXPRESS Lane with Daniela")', () => {
    const region = regionAround(commandCenterSrc, 'EXPRESS Lane with Daniela', 0, 600);
    assert.ok(region.includes(BADGE_ANCHOR),
      'data-testid="badge-nudge-count" not found within 600 chars of the EXPRESS Lane card title — ' +
      'badge may have moved out of the card header');
  });

  it('badge render is gated on pendingNudgeCount > 0 (hidden when count is 0)', () => {
    // Confirms: {pendingNudgeCount > 0 && (<Badge ... data-testid="badge-nudge-count">)}
    // The gate must appear before the badge in the source.
    const gateIdx  = commandCenterSrc.lastIndexOf(GATE_ANCHOR);
    const badgeIdx = commandCenterSrc.indexOf(BADGE_ANCHOR);
    assert.ok(gateIdx !== -1,
      '`pendingNudgeCount > 0` gate not found — badge may render unconditionally (always visible)');
    assert.ok(gateIdx < badgeIdx,
      `Gate (offset ${gateIdx}) must appear before badge (offset ${badgeIdx}) in the source — ` +
      'badge may not be inside the conditional block');
    // Gate must be close to the badge (within 200 chars) so they're in the same block.
    assert.ok(badgeIdx - gateIdx < 200,
      `Gate and badge are ${badgeIdx - gateIdx} chars apart — expected <200; they may be in separate blocks`);
  });

  it('badge uses variant="destructive" (renders in red / alert colour)', () => {
    const region = regionAround(commandCenterSrc, BADGE_ANCHOR, 100, 10);
    assert.ok(region.includes('variant="destructive"'),
      'Badge variant is not "destructive" — nudge count badge should use the destructive (red) colour');
  });

  it('badge displays the nudge count number (not a static label)', () => {
    // The rendered content is: {pendingNudgeCount} nudge{pendingNudgeCount !== 1 ? 's' : ''}
    const region = regionAround(commandCenterSrc, BADGE_ANCHOR, 0, 150);
    const showsCount = region.includes('pendingNudgeCount}') || region.includes('{pendingNudgeCount}');
    assert.ok(showsCount,
      'pendingNudgeCount value not interpolated inside the badge — badge may show a static label instead of the real count');
  });

  it('badge uses singular/plural text ("nudge" vs "nudges")', () => {
    const region = regionAround(commandCenterSrc, BADGE_ANCHOR, 0, 200);
    // Matches: nudge{pendingNudgeCount !== 1 ? 's' : ''}
    const hasPluralGate = /nudge\s*\{.*!==\s*1.*\?/.test(region);
    assert.ok(hasPluralGate,
      'Singular/plural guard not found inside the badge — "1 nudges" would render for a single item');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 6 — Immediate badge update: count query is invalidated on nudge dismissal
// ═══════════════════════════════════════════════════════════════════════════════

describe('CommandCenter.tsx — badge invalidated immediately on nudge dismissal', () => {
  it('dismissNudgeMutation is defined in AbsenceMonitorTab', () => {
    assert.ok(
      commandCenterSrc.includes('dismissNudgeMutation'),
      'dismissNudgeMutation not found in CommandCenter.tsx — ' +
      'AbsenceMonitorTab has no mutation to dismiss nudges from the founder UI',
    );
  });

  it('dismissNudgeMutation calls the PATCH /api/admin/absence-nudges/:userId/dismiss route', () => {
    const region = regionAround(commandCenterSrc, 'dismissNudgeMutation', 0, 600);
    assert.ok(
      region.includes('/api/admin/absence-nudges/') && region.includes('/dismiss'),
      'PATCH /api/admin/absence-nudges/:userId/dismiss not found near dismissNudgeMutation — ' +
      'the dismiss action may be calling the wrong endpoint',
    );
  });

  it("dismissNudgeMutation onSuccess invalidates '/api/admin/absence-nudges/count'", () => {
    // The onSuccess handler must call queryClient.invalidateQueries with the count key
    // so the EXPRESS Lane badge drops to 0 immediately (not after the 30s poll).
    const region = regionAround(commandCenterSrc, 'dismissNudgeMutation', 0, 800);
    const hasInvalidate = region.includes("invalidateQueries") &&
      region.includes('/api/admin/absence-nudges/count');
    assert.ok(
      hasInvalidate,
      "queryClient.invalidateQueries for '/api/admin/absence-nudges/count' not found in " +
      "dismissNudgeMutation — badge will not update until the 30s poll fires",
    );
  });

  it("dismissNudgeMutation onSuccess also invalidates '/api/founder/absence-nudges' (list refreshes)", () => {
    const region = regionAround(commandCenterSrc, 'dismissNudgeMutation', 0, 800);
    const hasListInvalidate = region.includes("invalidateQueries") &&
      region.includes('/api/founder/absence-nudges');
    assert.ok(
      hasListInvalidate,
      "queryClient.invalidateQueries for '/api/founder/absence-nudges' not found in " +
      "dismissNudgeMutation onSuccess — the pending nudge list would not refresh after dismissal",
    );
  });

  it('dismiss route is registered in routes.ts (PATCH method)', () => {
    const DISMISS_ROUTE = '/api/admin/absence-nudges/:userId/dismiss';
    const region = regionAround(routesSrc, DISMISS_ROUTE, 50, 10);
    assert.ok(
      routesSrc.includes(DISMISS_ROUTE) && region.includes('app.patch('),
      'app.patch("/api/admin/absence-nudges/:userId/dismiss") not found in routes.ts — ' +
      'the client mutation has no server handler to call',
    );
  });

  it('dismiss route is protected by requireFounder', () => {
    const DISMISS_ROUTE = '/api/admin/absence-nudges/:userId/dismiss';
    const region = regionAround(routesSrc, DISMISS_ROUTE, 0, 300);
    assert.ok(
      region.includes('requireFounder'),
      'requireFounder not found on the dismiss route — nudge dismissal would be publicly accessible',
    );
  });

  it('dismiss route calls resolveAbsenceNudge (reuses the worker function)', () => {
    const DISMISS_ROUTE = '/api/admin/absence-nudges/:userId/dismiss';
    const region = regionAround(routesSrc, DISMISS_ROUTE, 0, 2000);
    assert.ok(
      region.includes('resolveAbsenceNudge'),
      'resolveAbsenceNudge not called in the dismiss route — ' +
      'the route may not be updating the DB correctly',
    );
  });

  it('pending nudge cards have a dismiss button in CommandCenter.tsx', () => {
    assert.ok(
      commandCenterSrc.includes('button-dismiss-nudge-'),
      'data-testid="button-dismiss-nudge-..." not found — ' +
      'pending nudge cards are missing the Dismiss button',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5 — Cross-cutting: endpoint name is consistent across all files
// ═══════════════════════════════════════════════════════════════════════════════

describe('cross-cutting — /api/admin/absence-nudges/count path consistency', () => {
  it('path string is identical in routes.ts and CommandCenter.tsx (no typo drift)', () => {
    const PATH = '/api/admin/absence-nudges/count';
    assert.ok(routesSrc.includes(PATH),
      `'${PATH}' not in routes.ts — endpoint URL may have been renamed`);
    assert.ok(commandCenterSrc.includes(PATH),
      `'${PATH}' not in CommandCenter.tsx — client query URL may have been renamed`);
  });

  it('countPendingNudges function name is consistent between worker and route', () => {
    const FN = 'countPendingNudges';
    assert.ok(workerSrc.includes(FN),
      `'${FN}' not found in daniela-absence-worker.ts — function may have been renamed`);
    assert.ok(routesSrc.includes(FN),
      `'${FN}' not found in routes.ts — route is not calling the worker function`);
  });
});

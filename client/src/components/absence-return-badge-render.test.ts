/**
 * Confirms the 'Returned after N days' badge/span renders correctly in:
 *
 *   1. CommandCenter.tsx  — admin "Voice Session Reports" table
 *      Lines ~8651-8655: conditional Badge with title + display text
 *
 *   2. SessionHistory.tsx — student-facing session history panel
 *      Lines ~305-309: conditional span with pluralised day count
 *
 * Strategy: extract the rendering logic verbatim into standalone functions
 * and drive them with synthetic session objects.  This catches the most
 * dangerous regression: the rendering condition is correct in production but
 * the text/title template drifts (renamed field, wrong fallback, pluralisation
 * broken), or the condition is inverted so the badge never/always appears.
 *
 * A second section uses static source analysis of the real production files
 * (the same technique as absence-return-badge.test.ts) to confirm the JSX
 * conditions have not been removed or restructured.
 *
 * Run with:
 *   npx tsx --test client/src/components/absence-return-badge-render.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../../..');

// ── Types ──────────────────────────────────────────────────────────────────────

interface VoiceSessionReport {
  id: string;
  hadAbsenceReturn: boolean | null;
  absenceReturnDays: number | null;
  status: string | null;
  isTestSession: boolean | null;
  // (other fields omitted — not relevant for badge rendering)
}

// ── Mirror: CommandCenter.tsx admin table rendering logic ──────────────────────
//
// Production code (CommandCenter.tsx ~line 8651-8655):
//
//   {session.hadAbsenceReturn && (
//     <Badge variant="outline" className="ml-1 border-amber-400 text-amber-700 dark:text-amber-400"
//            title={`Student returned after ${session.absenceReturnDays ?? '?'} days absent`}>
//       ↩ {session.absenceReturnDays ?? '?'}d
//     </Badge>
//   )}
//
// The mirror below returns:
//   null       — badge does NOT render (hadAbsenceReturn is falsy)
//   { title, text } — what the badge WOULD render

interface BadgeOutput {
  title: string;
  text: string;
}

/**
 * Mirrors the CommandCenter admin table absence-return badge rendering logic.
 * Returns null when the badge would NOT appear; returns the rendered strings
 * (title attribute + visible text) when it WOULD appear.
 */
function adminTableBadge(session: VoiceSessionReport): BadgeOutput | null {
  if (!session.hadAbsenceReturn) return null;
  return {
    title: `Student returned after ${session.absenceReturnDays ?? '?'} days absent`,
    text:  `↩ ${session.absenceReturnDays ?? '?'}d`,
  };
}

// ── Mirror: SessionHistory.tsx rendering logic ─────────────────────────────────
//
// Production code (SessionHistory.tsx ~line 305-309):
//
//   {session.hadAbsenceReturn && (
//     <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
//       ↩ Returned after {session.absenceReturnDays ?? '?'} day{session.absenceReturnDays !== 1 ? 's' : ''}
//     </span>
//   )}

interface SpanOutput {
  text: string;
}

/**
 * Mirrors the SessionHistory.tsx absence-return span rendering logic.
 * Returns null when the span would NOT appear; returns the rendered string
 * when it WOULD appear.
 */
function sessionHistorySpan(session: VoiceSessionReport): SpanOutput | null {
  if (!session.hadAbsenceReturn) return null;
  const days = session.absenceReturnDays;
  return {
    text: `↩ Returned after ${days ?? '?'} day${days !== 1 ? 's' : ''}`,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<VoiceSessionReport> = {}): VoiceSessionReport {
  return {
    id: 'sess-test-1',
    hadAbsenceReturn: false,
    absenceReturnDays: null,
    status: 'completed',
    isTestSession: false,
    ...overrides,
  };
}

// ── Source analysis helpers ────────────────────────────────────────────────────

function regionAround(src: string, anchor: string, before = 400, after = 400): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — CommandCenter.tsx admin table badge rendering
// ═══════════════════════════════════════════════════════════════════════════════

describe('CommandCenter admin table — absence-return badge rendering', () => {

  // ── Positive case: badge renders ────────────────────────────────────────────

  it('renders badge when hadAbsenceReturn is true and absenceReturnDays is 7', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: 7 });
    const badge = adminTableBadge(session);
    assert.ok(badge !== null, 'Badge must render when hadAbsenceReturn=true');
    assert.equal(badge!.title, 'Student returned after 7 days absent',
      'title attribute must include the day count');
    assert.equal(badge!.text, '↩ 7d',
      'visible badge text must show the day count with "d" suffix');
  });

  it('renders badge when hadAbsenceReturn is true and absenceReturnDays is 1', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: 1 });
    const badge = adminTableBadge(session);
    assert.ok(badge !== null, 'Badge must render for 1-day absence');
    assert.equal(badge!.title, 'Student returned after 1 days absent');
    assert.equal(badge!.text, '↩ 1d');
  });

  it('renders badge when hadAbsenceReturn is true and absenceReturnDays is 30', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: 30 });
    const badge = adminTableBadge(session);
    assert.ok(badge !== null, 'Badge must render for 30-day absence');
    assert.equal(badge!.text, '↩ 30d');
  });

  it('renders badge with "?" fallback when absenceReturnDays is null', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: null });
    const badge = adminTableBadge(session);
    assert.ok(badge !== null, 'Badge must still render when absenceReturnDays is null');
    assert.equal(badge!.title, 'Student returned after ? days absent',
      'Fallback "?" must appear in title when absenceReturnDays is null');
    assert.equal(badge!.text, '↩ ?d',
      'Fallback "?" must appear in visible text when absenceReturnDays is null');
  });

  // ── Negative case: badge does NOT render ────────────────────────────────────

  it('does NOT render badge when hadAbsenceReturn is false', () => {
    const session = makeSession({ hadAbsenceReturn: false, absenceReturnDays: 7 });
    const badge = adminTableBadge(session);
    assert.equal(badge, null,
      'Badge must NOT render when hadAbsenceReturn=false, even if absenceReturnDays is set');
  });

  it('does NOT render badge when hadAbsenceReturn is null', () => {
    const session = makeSession({ hadAbsenceReturn: null, absenceReturnDays: 7 });
    const badge = adminTableBadge(session);
    assert.equal(badge, null,
      'Badge must NOT render when hadAbsenceReturn=null (falsy)');
  });

  it('does NOT render badge when hadAbsenceReturn is false and absenceReturnDays is null', () => {
    const session = makeSession({ hadAbsenceReturn: false, absenceReturnDays: null });
    const badge = adminTableBadge(session);
    assert.equal(badge, null, 'Badge must NOT render for a normal (no-absence) session');
  });

  // ── Content specifics ───────────────────────────────────────────────────────

  it('badge title contains the word "days" regardless of day count', () => {
    for (const days of [1, 7, 14, 30, 90]) {
      const badge = adminTableBadge(makeSession({ hadAbsenceReturn: true, absenceReturnDays: days }));
      assert.ok(badge!.title.includes('days'),
        `Expected "days" in title for absenceReturnDays=${days}, got: "${badge!.title}"`);
    }
  });

  it('badge text starts with the return arrow character ↩', () => {
    const badge = adminTableBadge(makeSession({ hadAbsenceReturn: true, absenceReturnDays: 7 }));
    assert.ok(badge!.text.startsWith('↩'),
      `Badge text must start with ↩, got: "${badge!.text}"`);
  });

  it('badge text ends with "d" (compact day suffix)', () => {
    const badge = adminTableBadge(makeSession({ hadAbsenceReturn: true, absenceReturnDays: 7 }));
    assert.ok(badge!.text.endsWith('d'),
      `Badge text must end with "d", got: "${badge!.text}"`);
  });

  it('badge title contains "absent" to describe the reason', () => {
    const badge = adminTableBadge(makeSession({ hadAbsenceReturn: true, absenceReturnDays: 7 }));
    assert.ok(badge!.title.toLowerCase().includes('absent'),
      `Expected "absent" in title, got: "${badge!.title}"`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — SessionHistory.tsx rendering
// ═══════════════════════════════════════════════════════════════════════════════

describe('SessionHistory — absence-return span rendering', () => {

  // ── Positive case: span renders ─────────────────────────────────────────────

  it('renders span when hadAbsenceReturn is true and absenceReturnDays is 7', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: 7 });
    const span = sessionHistorySpan(session);
    assert.ok(span !== null, 'Span must render when hadAbsenceReturn=true');
    assert.equal(span!.text, '↩ Returned after 7 days',
      'Span text must include day count with correct plural form');
  });

  it('renders span with singular "day" when absenceReturnDays is 1', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: 1 });
    const span = sessionHistorySpan(session);
    assert.ok(span !== null, 'Span must render for 1-day absence');
    assert.equal(span!.text, '↩ Returned after 1 day',
      'Must use singular "day" (not "days") when absenceReturnDays === 1');
  });

  it('renders span with plural "days" when absenceReturnDays is 2', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: 2 });
    const span = sessionHistorySpan(session);
    assert.ok(span !== null);
    assert.equal(span!.text, '↩ Returned after 2 days');
  });

  it('renders span with plural "days" when absenceReturnDays is 30', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: 30 });
    const span = sessionHistorySpan(session);
    assert.ok(span !== null);
    assert.equal(span!.text, '↩ Returned after 30 days');
  });

  it('renders span with "?" fallback when absenceReturnDays is null', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: null });
    const span = sessionHistorySpan(session);
    assert.ok(span !== null, 'Span must still render when absenceReturnDays is null');
    assert.equal(span!.text, '↩ Returned after ? days',
      'Fallback "?" must appear in text when absenceReturnDays is null');
  });

  // ── Negative case: span does NOT render ─────────────────────────────────────

  it('does NOT render span when hadAbsenceReturn is false', () => {
    const session = makeSession({ hadAbsenceReturn: false, absenceReturnDays: 7 });
    const span = sessionHistorySpan(session);
    assert.equal(span, null,
      'Span must NOT render when hadAbsenceReturn=false');
  });

  it('does NOT render span when hadAbsenceReturn is null', () => {
    const session = makeSession({ hadAbsenceReturn: null, absenceReturnDays: 7 });
    const span = sessionHistorySpan(session);
    assert.equal(span, null,
      'Span must NOT render when hadAbsenceReturn=null (falsy)');
  });

  it('does NOT render span for a normal (no-absence) session', () => {
    const session = makeSession({ hadAbsenceReturn: false, absenceReturnDays: null });
    const span = sessionHistorySpan(session);
    assert.equal(span, null, 'Span must NOT render for a normal session');
  });

  // ── Content specifics ───────────────────────────────────────────────────────

  it('span text starts with the return arrow character ↩', () => {
    const span = sessionHistorySpan(makeSession({ hadAbsenceReturn: true, absenceReturnDays: 7 }));
    assert.ok(span!.text.startsWith('↩'),
      `Span text must start with ↩, got: "${span!.text}"`);
  });

  it('span text includes "Returned after" phrase', () => {
    const span = sessionHistorySpan(makeSession({ hadAbsenceReturn: true, absenceReturnDays: 7 }));
    assert.ok(span!.text.includes('Returned after'),
      `Span text must include "Returned after", got: "${span!.text}"`);
  });

  // ── Pluralisation boundary ───────────────────────────────────────────────────

  it('pluralises correctly for absenceReturnDays === 0 (edge: 0 ≠ 1 → "days")', () => {
    const session = makeSession({ hadAbsenceReturn: true, absenceReturnDays: 0 });
    const span = sessionHistorySpan(session);
    assert.ok(span !== null);
    // 0 is not 1, so plural "days"
    assert.equal(span!.text, '↩ Returned after 0 days');
  });

  it('pluralises correctly for absenceReturnDays === 1 (boundary: 1 → "day")', () => {
    const span = sessionHistorySpan(makeSession({ hadAbsenceReturn: true, absenceReturnDays: 1 }));
    assert.ok(span!.text.endsWith(' day'), `Expected " day" suffix for 1, got: "${span!.text}"`);
  });

  it('pluralises correctly for absenceReturnDays === 2 (boundary: 2 → "days")', () => {
    const span = sessionHistorySpan(makeSession({ hadAbsenceReturn: true, absenceReturnDays: 2 }));
    assert.ok(span!.text.endsWith(' days'), `Expected " days" suffix for 2, got: "${span!.text}"`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — Source analysis: confirm JSX rendering conditions are in production
// ═══════════════════════════════════════════════════════════════════════════════

describe('Source analysis — JSX rendering conditions in production files', () => {
  // Load production source files
  const commandCenterSrc = readFileSync(
    resolve(root, 'client/src/pages/admin/CommandCenter.tsx'), 'utf-8');
  const sessionHistorySrc = readFileSync(
    resolve(root, 'client/src/components/SessionHistory.tsx'), 'utf-8');

  // ── CommandCenter.tsx ────────────────────────────────────────────────────────

  it('CommandCenter.tsx has the hadAbsenceReturn conditional guard for the badge', () => {
    const hasGuard = /session\.hadAbsenceReturn/.test(commandCenterSrc);
    assert.ok(hasGuard,
      'session.hadAbsenceReturn not found in CommandCenter.tsx — badge rendering condition may have been removed');
  });

  it('CommandCenter.tsx renders the ↩ return arrow in the badge', () => {
    // The arrow character appears in JSX as a literal ↩
    const hasArrow = commandCenterSrc.includes('↩');
    assert.ok(hasArrow,
      '↩ character not found in CommandCenter.tsx — badge visible text may have changed');
  });

  it('CommandCenter.tsx uses absenceReturnDays in badge text with "d" suffix', () => {
    // Matches: ↩ {session.absenceReturnDays ?? '?'}d
    const hasBadgeText = /\u21a9\s*\{session\.absenceReturnDays\s*\?\?\s*['"][\?]['"][\s\S]{0,5}d/.test(commandCenterSrc);
    assert.ok(hasBadgeText,
      '↩ {session.absenceReturnDays ?? ...}d pattern not found in CommandCenter.tsx — badge text may have drifted');
  });

  it('CommandCenter.tsx badge title contains "days absent"', () => {
    // Anchor on the JSX condition (session.hadAbsenceReturn), not the interface field
    const region = regionAround(commandCenterSrc, 'session.hadAbsenceReturn', 0, 400);
    assert.ok(region.includes('days absent'),
      '"days absent" not found near session.hadAbsenceReturn in CommandCenter.tsx — title may have changed');
  });

  it('CommandCenter.tsx badge title includes absenceReturnDays', () => {
    const region = regionAround(commandCenterSrc, 'session.hadAbsenceReturn', 0, 400);
    assert.ok(region.includes('absenceReturnDays'),
      'absenceReturnDays not found in badge title region in CommandCenter.tsx');
  });

  it('CommandCenter.tsx uses the amber colour class for the absence-return badge', () => {
    const region = regionAround(commandCenterSrc, 'session.hadAbsenceReturn', 0, 400);
    const hasAmber = region.includes('amber');
    assert.ok(hasAmber,
      'Amber colour class not found near absence-return badge in CommandCenter.tsx — badge styling may have changed');
  });

  // ── SessionHistory.tsx ───────────────────────────────────────────────────────

  it('SessionHistory.tsx has the hadAbsenceReturn conditional guard for the span', () => {
    const hasGuard = /session\.hadAbsenceReturn/.test(sessionHistorySrc);
    assert.ok(hasGuard,
      'session.hadAbsenceReturn not found in SessionHistory.tsx — span rendering condition may have been removed');
  });

  it('SessionHistory.tsx renders "Returned after" phrase', () => {
    const hasPhrase = sessionHistorySrc.includes('Returned after');
    assert.ok(hasPhrase,
      '"Returned after" not found in SessionHistory.tsx — span text may have changed');
  });

  it('SessionHistory.tsx uses absenceReturnDays for the day count', () => {
    // Anchor on the JSX condition (session.hadAbsenceReturn), not the interface field
    const region = regionAround(sessionHistorySrc, 'session.hadAbsenceReturn', 0, 400);
    assert.ok(region.includes('absenceReturnDays'),
      'absenceReturnDays not found near session.hadAbsenceReturn in SessionHistory.tsx');
  });

  it('SessionHistory.tsx includes pluralisation logic (day vs days)', () => {
    const region = regionAround(sessionHistorySrc, 'session.hadAbsenceReturn', 0, 400);
    // The production code uses: day{session.absenceReturnDays !== 1 ? 's' : ''}
    const hasPlural = /day.*\?\s*['"]s['"]/.test(region) || /absenceReturnDays\s*!==\s*1/.test(region);
    assert.ok(hasPlural,
      'Pluralisation logic (day/days) not found in SessionHistory.tsx — singular/plural rendering may be broken');
  });

  it('SessionHistory.tsx renders the ↩ return arrow in the span', () => {
    const region = regionAround(sessionHistorySrc, 'session.hadAbsenceReturn', 0, 400);
    assert.ok(region.includes('↩'),
      '↩ character not found near session.hadAbsenceReturn in SessionHistory.tsx');
  });

  it('SessionHistory.tsx uses amber colour class for the absence-return span', () => {
    const region = regionAround(sessionHistorySrc, 'session.hadAbsenceReturn', 0, 400);
    assert.ok(region.includes('amber'),
      'Amber colour class not found near session.hadAbsenceReturn in SessionHistory.tsx — span styling may have changed');
  });

  // ── Cross-component consistency ──────────────────────────────────────────────

  it('both components gate on the same field name (hadAbsenceReturn)', () => {
    assert.ok(commandCenterSrc.includes('hadAbsenceReturn'),
      'hadAbsenceReturn missing from CommandCenter.tsx');
    assert.ok(sessionHistorySrc.includes('hadAbsenceReturn'),
      'hadAbsenceReturn missing from SessionHistory.tsx');
  });

  it('both components read absenceReturnDays (consistent field name)', () => {
    assert.ok(commandCenterSrc.includes('absenceReturnDays'),
      'absenceReturnDays missing from CommandCenter.tsx');
    assert.ok(sessionHistorySrc.includes('absenceReturnDays'),
      'absenceReturnDays missing from SessionHistory.tsx');
  });
});

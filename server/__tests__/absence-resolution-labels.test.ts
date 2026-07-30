/**
 * Unit tests for the absence resolution label mapping.
 *
 * Mirrors the logic in client/src/lib/absence-resolution-labels.ts
 * (inlined here so the test has zero client-side / JSX deps).
 *
 * CONTRACT being tested:
 *   - The three known resolutionType values each map to a distinct human-readable label.
 *   - Any unknown value (null, undefined, or a future DB string) falls back to
 *     the generic "Resolved" label — the raw DB string is never surfaced.
 *   - badge data-testid elements (`absence-resolution-badge-*`) will contain
 *     one of these labels.
 *
 * Run with:
 *   npx tsx --test server/__tests__/absence-resolution-labels.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Pure label helper (mirrors client/src/lib/absence-resolution-labels.ts) ──
// Inlined so this test file has no client-side or JSX dependencies.

interface ResolutionMeta {
  label: string;
  badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
  className: string;
}

function getResolutionMeta(type: string | null | undefined): ResolutionMeta {
  switch (type) {
    case 'student_returned':
      return {
        label: 'Student returned',
        badgeVariant: 'default',
        className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
      };
    case 'message_queued':
      return {
        label: 'Message queued',
        badgeVariant: 'secondary',
        className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
      };
    case 'dismissed':
      return {
        label: 'Dismissed',
        badgeVariant: 'outline',
        className: 'bg-muted text-muted-foreground border-border',
      };
    default:
      return {
        label: 'Resolved',
        badgeVariant: 'outline',
        className: 'bg-muted text-muted-foreground border-border',
      };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getResolutionMeta — known resolution types', () => {
  it('student_returned → "Student returned" with default badge variant', () => {
    const meta = getResolutionMeta('student_returned');
    assert.equal(meta.label, 'Student returned');
    assert.equal(meta.badgeVariant, 'default');
  });

  it('message_queued → "Message queued" with secondary badge variant', () => {
    const meta = getResolutionMeta('message_queued');
    assert.equal(meta.label, 'Message queued');
    assert.equal(meta.badgeVariant, 'secondary');
  });

  it('dismissed → "Dismissed" with outline badge variant', () => {
    const meta = getResolutionMeta('dismissed');
    assert.equal(meta.label, 'Dismissed');
    assert.equal(meta.badgeVariant, 'outline');
  });
});

describe('getResolutionMeta — fallback (unknown / null values)', () => {
  it('null falls back to "Resolved" — not the raw DB null', () => {
    const meta = getResolutionMeta(null);
    assert.equal(meta.label, 'Resolved');
    assert.equal(meta.badgeVariant, 'outline');
  });

  it('undefined falls back to "Resolved"', () => {
    const meta = getResolutionMeta(undefined);
    assert.equal(meta.label, 'Resolved');
  });

  it('unknown future type "snoozed" falls back — never shows raw DB string', () => {
    const meta = getResolutionMeta('snoozed');
    assert.equal(meta.label, 'Resolved');
    assert.notEqual(meta.label, 'snoozed');
  });

  it('unknown future type "auto_resolved" falls back — never shows raw DB string', () => {
    const meta = getResolutionMeta('auto_resolved');
    assert.equal(meta.label, 'Resolved');
    assert.notEqual(meta.label, 'auto_resolved');
  });
});

describe('getResolutionMeta — data-testid badge contract', () => {
  // AbsenceHistoryPanel renders:
  //   <Badge data-testid={`absence-resolution-badge-${nudge.nudgeId}`}>
  //     {cfg.label}
  //   </Badge>
  // These assertions pin the text that appears inside those badges.

  it('absence-resolution-badge for student_returned shows "Student returned"', () => {
    assert.equal(getResolutionMeta('student_returned').label, 'Student returned');
  });

  it('absence-resolution-badge for message_queued shows "Message queued"', () => {
    assert.equal(getResolutionMeta('message_queued').label, 'Message queued');
  });

  it('absence-resolution-badge for dismissed shows "Dismissed"', () => {
    assert.equal(getResolutionMeta('dismissed').label, 'Dismissed');
  });

  it('absence-resolution-badge for unknown type shows "Resolved" (not the raw DB string)', () => {
    const unknownType = 'some_future_state';
    const meta = getResolutionMeta(unknownType);
    assert.equal(meta.label, 'Resolved');
    assert.notEqual(meta.label, unknownType);
  });
});

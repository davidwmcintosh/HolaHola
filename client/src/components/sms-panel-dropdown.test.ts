/**
 * sms-panel-dropdown.test.ts
 *
 * Confirms that the SMS test panel in MissionControl.tsx is correctly wired:
 *
 *   1. Dropdown is only enabled when the panel is open (enabled: open)
 *   2. Student names, consent icons, and "no phone" labels are rendered
 *   3. Selecting a student with SMS consent shows the green phone icon + "SMS✓" label
 *   4. Selecting a student with a phone but no consent shows the yellow phone + "no consent"
 *   5. Selecting a student with no phone shows the PhoneOff icon + "no phone" label
 *   6. Fire Test button is disabled until a student is selected (!userId.trim())
 *   7. The consent warning paragraph appears when the selected student has no consent
 *   8. The no-phone warning message is shown when the student has no phone at all
 *   9. The query fetches /api/admin/voip-users (correct endpoint)
 *  10. The route in routes.ts returns the right shape: { users: [...] } with phone /
 *      phoneConsentSms fields from studentContactPreferences
 *
 * Strategy: static source analysis of the real production files.
 * No DOM, no React, no network — just reads the actual source and asserts
 * that every contract is expressed in the code.  If any field is renamed,
 * guard removed, or endpoint changed, the test fails.
 *
 * Run with:
 *   npx tsx --test client/src/components/sms-panel-dropdown.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../../..');

// ── Load production source files once ─────────────────────────────────────────

let mcSrc: string;      // client/src/pages/admin/MissionControl.tsx
let routesSrc: string;  // server/routes.ts

before(() => {
  mcSrc      = readFileSync(resolve(root, 'client/src/pages/admin/MissionControl.tsx'), 'utf-8');
  routesSrc  = readFileSync(resolve(root, 'server/routes.ts'), 'utf-8');
});

// ── Helper ─────────────────────────────────────────────────────────────────────

function regionAround(src: string, anchor: string, before = 500, after = 500): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — Fetch query wiring
// ═══════════════════════════════════════════════════════════════════════════════

describe('MissionControl.tsx — useQuery fetch wiring', () => {
  it('fetches /api/admin/voip-users (correct endpoint)', () => {
    assert.ok(
      mcSrc.includes('"/api/admin/voip-users"') || mcSrc.includes("'/api/admin/voip-users'"),
      'useQuery queryKey does not reference /api/admin/voip-users',
    );
  });

  it('query is gated on the panel being open (enabled: open)', () => {
    const region = regionAround(mcSrc, '/api/admin/voip-users');
    assert.ok(
      region.includes('enabled: open') || region.includes('enabled:open'),
      'useQuery for voip-users must be enabled only when the panel is open (enabled: open)',
    );
  });

  it('students list comes from voipData?.users (correct response key)', () => {
    assert.ok(
      mcSrc.includes('voipData?.users') || mcSrc.includes('voipData?.users ??'),
      'students must be extracted from the "users" key of the API response',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — Consent icon rendering
// ═══════════════════════════════════════════════════════════════════════════════

describe('MissionControl.tsx — consent icon logic', () => {
  it('canSms flag combines phone presence AND phoneConsentSms', () => {
    // Must be: const canSms = !!s.phone && s.phoneConsentSms
    assert.ok(
      mcSrc.includes('s.phone && s.phoneConsentSms') ||
      mcSrc.includes('!!s.phone && s.phoneConsentSms'),
      'canSms must require both a phone number and SMS consent',
    );
  });

  it('hasPhone flag checks phone presence independently', () => {
    assert.ok(
      mcSrc.includes('!!s.phone') || mcSrc.includes('hasPhone = !!s.phone'),
      'hasPhone must be derived from !!s.phone',
    );
  });

  it('renders green Phone icon when canSms is true', () => {
    // green-500 phone icon
    const region = regionAround(mcSrc, 'canSms', 0, 800);
    assert.ok(
      region.includes('text-green-500') || region.includes('green'),
      'green phone icon must be rendered for students with SMS consent',
    );
  });

  it('renders yellow Phone icon when phone present but no SMS consent', () => {
    const region = regionAround(mcSrc, 'hasPhone && !canSms', 0, 400);
    assert.ok(
      region.includes('text-yellow-500') || region.includes('yellow'),
      'yellow phone icon must be rendered when phone exists but consent is missing',
    );
  });

  it('renders PhoneOff icon when student has no phone', () => {
    assert.ok(
      mcSrc.includes('PhoneOff'),
      'PhoneOff icon must be rendered for students without a phone number',
    );
  });

  it('"SMS✓" label appears next to canSms students', () => {
    assert.ok(
      mcSrc.includes('SMS✓') || mcSrc.includes('SMS\u2713'),
      '"SMS✓" confirmation label must appear for consented students',
    );
  });

  it('"no consent" label appears for students with phone but no consent', () => {
    assert.ok(
      mcSrc.includes('no consent'),
      '"no consent" label must appear for students who have a phone but no SMS consent',
    );
  });

  it('"no phone" label appears for students without a phone', () => {
    assert.ok(
      mcSrc.includes('no phone'),
      '"no phone" label must appear for students who have no phone number on file',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — Fire Test button disabled state
// ═══════════════════════════════════════════════════════════════════════════════

describe('MissionControl.tsx — Fire Test button guard', () => {
  it('Fire Test button disabled prop references userId', () => {
    // disabled is one line before data-testid="button-fire-test-sms" — look before the anchor
    const region = regionAround(mcSrc, 'button-fire-test-sms', 300, 300);
    assert.ok(
      region.includes('userId') && region.includes('disabled'),
      'Fire Test button must reference userId in its disabled prop',
    );
  });

  it('Fire Test button is disabled when userId is empty (!userId.trim())', () => {
    const region = regionAround(mcSrc, 'button-fire-test-sms', 300, 300);
    assert.ok(
      region.includes('!userId') || region.includes('userId.trim()'),
      'Fire Test button must be disabled when userId is empty (guard: !userId.trim())',
    );
  });

  it('Fire Test button is also disabled while mutation is pending', () => {
    const region = regionAround(mcSrc, 'button-fire-test-sms', 300, 300);
    assert.ok(
      region.includes('isPending'),
      'Fire Test button must be disabled while the mutation is in-flight',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4 — Consent / no-phone warning paragraph
// ═══════════════════════════════════════════════════════════════════════════════

describe('MissionControl.tsx — consent warning paragraph', () => {
  it('warning paragraph is gated on selectedStudent && !phoneConsentSms', () => {
    assert.ok(
      mcSrc.includes('!selectedStudent.phoneConsentSms') ||
      mcSrc.includes('selectedStudent && !selectedStudent.phoneConsentSms'),
      'consent warning must only appear when selectedStudent has no SMS consent',
    );
  });

  it('warning message for no-phone case references selectedStudent.phone', () => {
    const region = regionAround(mcSrc, 'test-sms-consent-warning', 0, 600);
    assert.ok(
      region.includes('selectedStudent.phone'),
      'consent warning must check selectedStudent.phone to distinguish no-phone vs no-consent',
    );
  });

  it('warning for no-phone says "no phone number on file"', () => {
    assert.ok(
      mcSrc.includes('no phone number on file'),
      'No-phone warning message must say "no phone number on file"',
    );
  });

  it('warning for no-consent says "has not consented to SMS"', () => {
    assert.ok(
      mcSrc.includes('has not consented to SMS'),
      'No-consent warning message must say "has not consented to SMS"',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5 — Panel toggle and data-testid anchors
// ═══════════════════════════════════════════════════════════════════════════════

describe('MissionControl.tsx — panel toggle and data-testid anchors', () => {
  it('panel has data-testid="test-sms-panel"', () => {
    assert.ok(
      mcSrc.includes('data-testid="test-sms-panel"'),
      'outer panel div must carry data-testid="test-sms-panel"',
    );
  });

  it('toggle button has data-testid="button-toggle-test-sms"', () => {
    assert.ok(
      mcSrc.includes('data-testid="button-toggle-test-sms"'),
      'toggle button must carry data-testid="button-toggle-test-sms"',
    );
  });

  it('select trigger has data-testid="select-trigger-test-sms-student"', () => {
    assert.ok(
      mcSrc.includes('data-testid="select-trigger-test-sms-student"'),
      'SelectTrigger must carry data-testid="select-trigger-test-sms-student"',
    );
  });

  it('each student option has data-testid with the student id', () => {
    assert.ok(
      mcSrc.includes('data-testid={`option-student-${s.id}`}') ||
      mcSrc.includes("data-testid={`option-student-${s.id}`}"),
      'SelectItem must carry data-testid="option-student-{id}" for each student',
    );
  });

  it('Fire Test button has data-testid="button-fire-test-sms"', () => {
    assert.ok(
      mcSrc.includes('data-testid="button-fire-test-sms"'),
      'Fire Test button must carry data-testid="button-fire-test-sms"',
    );
  });

  it('consent warning has data-testid="test-sms-consent-warning"', () => {
    assert.ok(
      mcSrc.includes('data-testid="test-sms-consent-warning"'),
      'consent warning paragraph must carry data-testid="test-sms-consent-warning"',
    );
  });

  it('loading state shows spinner while students are loading', () => {
    // loadingUsers appears at the useQuery declaration and again inside the SelectTrigger JSX.
    // Search the whole component for the co-occurrence of the flag with a loading indicator.
    assert.ok(
      mcSrc.includes('loadingUsers') && (mcSrc.includes('animate-spin') || mcSrc.includes('Loading students')),
      'loading state must show a spinner or "Loading" text while students are being fetched',
    );
  });

  it('panel collapses when open is false (open && conditional rendering)', () => {
    // {open && ( ... )}
    assert.ok(
      mcSrc.includes('{open && ('),
      'panel content must be conditionally rendered only when open is true',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 6 — Server route: /api/admin/voip-users shape
// ═══════════════════════════════════════════════════════════════════════════════

describe('routes.ts — GET /api/admin/voip-users response shape', () => {
  it('route handler exists at /api/admin/voip-users', () => {
    assert.ok(
      routesSrc.includes('"/api/admin/voip-users"') ||
      routesSrc.includes("'/api/admin/voip-users'"),
      'GET /api/admin/voip-users route must exist in server/routes.ts',
    );
  });

  it('response wraps the list under the "users" key', () => {
    const region = regionAround(routesSrc, '/api/admin/voip-users', 0, 2000);
    assert.ok(
      region.includes('res.json({ users:') || region.includes('res.json({ users :'),
      'route must respond with { users: [...] } — client reads voipData.users',
    );
  });

  it('phoneConsentSms is included in each user object', () => {
    const region = regionAround(routesSrc, '/api/admin/voip-users', 0, 2000);
    assert.ok(
      region.includes('phoneConsentSms'),
      'each user in voip-users response must include phoneConsentSms',
    );
  });

  it('phone field is included in each user object', () => {
    const region = regionAround(routesSrc, '/api/admin/voip-users', 0, 2000);
    assert.ok(
      region.includes('phone:'),
      'each user in voip-users response must include phone',
    );
  });

  it('reads phone and consent from studentContactPreferences', () => {
    const region = regionAround(routesSrc, '/api/admin/voip-users', 0, 2000);
    assert.ok(
      region.includes('studentContactPreferences'),
      'phone/consent data must be sourced from studentContactPreferences table',
    );
  });

  it('route is admin-only (requireRole admin guard present)', () => {
    const region = regionAround(routesSrc, '/api/admin/voip-users', 0, 300);
    assert.ok(
      region.includes("requireRole('admin')") || region.includes('requireRole("admin")'),
      '/api/admin/voip-users must be guarded by requireRole("admin")',
    );
  });

  it('firstName and lastName are included so the dropdown can display names', () => {
    const region = regionAround(routesSrc, '/api/admin/voip-users', 0, 2000);
    assert.ok(
      region.includes('firstName') && region.includes('lastName'),
      'each user must include firstName and lastName for display in the dropdown',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 7 — selectedStudent lookup
// ═══════════════════════════════════════════════════════════════════════════════

describe('MissionControl.tsx — selectedStudent lookup', () => {
  it('selectedStudent is derived by matching userId against the students list', () => {
    assert.ok(
      mcSrc.includes('students.find((s) => s.id === userId)') ||
      mcSrc.includes("students.find(s => s.id === userId)"),
      'selectedStudent must be found via students.find(s => s.id === userId)',
    );
  });

  it('onValueChange updates userId state (links dropdown selection to fire guard)', () => {
    const region = regionAround(mcSrc, 'onValueChange', 0, 200);
    assert.ok(
      region.includes('setUserId') || region.includes('setUserId(val)'),
      'onValueChange must call setUserId to update the userId state',
    );
  });

  it('onValueChange also clears any previous result', () => {
    const region = regionAround(mcSrc, 'onValueChange', 0, 200);
    assert.ok(
      region.includes('setResult(null)'),
      'onValueChange must clear the previous result when a new student is selected',
    );
  });
});

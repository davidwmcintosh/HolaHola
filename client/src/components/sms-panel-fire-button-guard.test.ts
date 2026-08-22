/**
 * sms-panel-fire-button-guard.test.ts
 *
 * Confirms that the Fire Test button in TestVoiceSmsPanel (MissionControl.tsx)
 * is disabled for students without a phone number — not just for an empty selection.
 *
 * The existing sms-panel-dropdown.test.ts verifies the basic `!userId.trim()` guard.
 * This test is the regression check for the PHONE guard:
 *   disabled={isPending || !userId.trim() || !selectedStudent?.phone}
 *
 * Done criteria:
 *   1. The disabled prop references selectedStudent?.phone (phone-presence guard)
 *   2. The guard is expressed so that a no-phone student keeps the button disabled
 *   3. The guard is expressed so that a student with a phone enables the button
 *   4. selectedStudent is derived from the students list using the selected userId
 *   5. The static shape is distinct from the earlier "no selection" guard so the
 *      two failure modes can be caught independently.
 *
 * Strategy: static source analysis of the real production file — no DOM, no React,
 * no network.  If the phone guard is removed or renamed the test fails.
 *
 * Run with:
 *   npx tsx --test client/src/components/sms-panel-fire-button-guard.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../../..');

let mcSrc: string;

before(() => {
  mcSrc = readFileSync(
    resolve(root, 'client/src/pages/admin/MissionControl.tsx'),
    'utf-8',
  );
});

/** Return the text window around an anchor string. */
function regionAround(
  src: string,
  anchor: string,
  before = 400,
  after = 400,
): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(
    Math.max(0, idx - before),
    Math.min(src.length, idx + anchor.length + after),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — The phone guard is present in the disabled prop
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fire Test button — phone-presence guard', () => {
  it('disabled prop references selectedStudent?.phone (phone-presence guard)', () => {
    const region = regionAround(mcSrc, 'button-fire-test-sms', 400, 100);
    assert.ok(
      region.includes('selectedStudent?.phone') ||
        region.includes('selectedStudent && selectedStudent.phone') ||
        region.includes('!selectedStudent?.phone'),
      'Fire Test button disabled prop must reference selectedStudent?.phone so a ' +
        'no-phone student keeps it disabled',
    );
  });

  it('phone guard is a negated check (!selectedStudent?.phone)', () => {
    const region = regionAround(mcSrc, 'button-fire-test-sms', 400, 100);
    assert.ok(
      region.includes('!selectedStudent?.phone') ||
        region.includes('!selectedStudent?.phone'),
      'The phone guard must be negated (! prefix) so the button stays disabled ' +
        'when the selected student has no phone',
    );
  });

  it('phone guard and userId guard are both present in the same disabled expression', () => {
    const region = regionAround(mcSrc, 'button-fire-test-sms', 400, 100);
    assert.ok(
      region.includes('userId') && region.includes('selectedStudent?.phone'),
      'disabled prop must carry BOTH the userId guard and the phone guard; ' +
        'missing either guard leaves a hole',
    );
  });

  it('disabled expression is a conjunction (|| chained) of at least two guards', () => {
    const region = regionAround(mcSrc, 'button-fire-test-sms', 400, 100);
    // Count the number of || operators in the disabled= line
    const matches = region.match(/\|\|/g) ?? [];
    assert.ok(
      matches.length >= 2,
      'disabled= must use at least two || operators (isPending, userId, phone guards)',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — selectedStudent is correctly derived so the guard can fire
// ═══════════════════════════════════════════════════════════════════════════════

describe('selectedStudent derivation — prerequisite for the phone guard', () => {
  it('selectedStudent is derived from students.find matching userId', () => {
    assert.ok(
      mcSrc.includes('students.find((s) => s.id === userId)') ||
        mcSrc.includes("students.find(s => s.id === userId)"),
      'selectedStudent must be found via students.find(s => s.id === userId) ' +
        'so the phone guard can inspect the right record',
    );
  });

  it('selectedStudent is declared before the Fire Test button JSX', () => {
    const studentIdx = mcSrc.indexOf('selectedStudent =');
    const buttonIdx  = mcSrc.indexOf('button-fire-test-sms');
    assert.ok(
      studentIdx !== -1 && buttonIdx !== -1 && studentIdx < buttonIdx,
      'selectedStudent must be assigned before the button JSX so the guard can read it',
    );
  });

  it('phone guard uses optional-chain (selectedStudent?.phone) so it is safe before a student is chosen', () => {
    assert.ok(
      mcSrc.includes('selectedStudent?.phone'),
      'Use selectedStudent?.phone (not selectedStudent.phone) so the expression ' +
        'is falsy when no student is selected yet — avoiding a runtime crash',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — Consent warning still fires independently of the button guard
// ═══════════════════════════════════════════════════════════════════════════════

describe('Consent warning — independent of button disabled state', () => {
  it('consent warning is gated on !selectedStudent.phoneConsentSms (not phone)', () => {
    // The warning covers both no-phone AND no-consent cases; the gate is on !consent.
    assert.ok(
      mcSrc.includes('!selectedStudent.phoneConsentSms') ||
        mcSrc.includes('selectedStudent && !selectedStudent.phoneConsentSms'),
      'consent warning gate must be !phoneConsentSms so it shows for no-phone ' +
        'AND phone-but-no-consent students',
    );
  });

  it('no-phone warning text is still present', () => {
    assert.ok(
      mcSrc.includes('no phone number on file'),
      '"no phone number on file" warning text must remain visible in the source',
    );
  });

  it('no-consent warning text is still present', () => {
    assert.ok(
      mcSrc.includes('has not consented to SMS'),
      '"has not consented to SMS" warning text must remain visible in the source',
    );
  });
});

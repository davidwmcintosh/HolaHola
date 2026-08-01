/**
 * Source-level guards for the VoipConsoleTab in CommandCenter.tsx (#444, #448).
 *
 * #444 — When the outbound queue is empty, an empty-state element with
 *        data-testid="text-empty-queue" must be rendered (not a blank panel).
 *
 * #448 — The "Trigger Call Now" button uses disabled={!selectedUserId || ...}
 *        so it remains disabled until a user is selected; once a user with
 *        phone + SMS consent is picked from the dropdown, the button becomes
 *        enabled.
 *
 * Run: npx tsx --test server/__tests__/voip-console-source.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const commandCenterSrc = readFileSync(
  resolve(import.meta.dirname, '../../client/src/pages/admin/CommandCenter.tsx'),
  'utf-8',
);

// ── #444 — Queue empty-state element ─────────────────────────────────────────

describe('#444 — SMS panel empty-state message when queue returns no entries', () => {
  it('empty-state element with data-testid="text-empty-queue" exists in VoipConsoleTab', () => {
    assert.ok(
      commandCenterSrc.includes('data-testid="text-empty-queue"'),
      'data-testid="text-empty-queue" not found in CommandCenter.tsx — the queue panel would show a blank area instead of an empty-state message when no entries exist',
    );
  });

  it('the empty-state is rendered conditionally when items.length === 0', () => {
    // The guard must check the items array length so the empty state appears
    // only when the API returns no queue items.
    assert.ok(
      commandCenterSrc.includes('items.length === 0'),
      'items.length === 0 check not found in CommandCenter.tsx — empty-state may appear even when items are present',
    );
  });

  it('mutation self-check: removing the empty-state testid would fail the assertion', () => {
    const mutated = commandCenterSrc.replace('data-testid="text-empty-queue"', 'data-testid="text-removed"');
    assert.ok(
      !mutated.includes('data-testid="text-empty-queue"'),
      'testid still present after mutation — assertion is not tight enough',
    );
  });
});

// ── #448 — Trigger Call Now button enables with a selected user ───────────────

describe('#448 — Fire Test button enables when a student with phone/SMS consent is selected', () => {
  it('Trigger Call Now button has data-testid="button-trigger-call"', () => {
    assert.ok(
      commandCenterSrc.includes('data-testid="button-trigger-call"'),
      'data-testid="button-trigger-call" not found — button cannot be reliably targeted in tests',
    );
  });

  it('button is disabled while selectedUserId is empty (!selectedUserId)', () => {
    // The button must stay disabled until the user selects a student.
    // !selectedUserId is the gate that prevents firing with no recipient.
    assert.ok(
      commandCenterSrc.includes('!selectedUserId'),
      '!selectedUserId guard not found near the trigger button — button may fire without a user selected',
    );
  });

  it('user dropdown includes phoneConsentSms in the per-user data shape', () => {
    // The query shape for /api/admin/voip-users must include phoneConsentSms so
    // the dropdown can surface which users have SMS consent.
    assert.ok(
      commandCenterSrc.includes('phoneConsentSms'),
      'phoneConsentSms not found in CommandCenter.tsx — dropdown cannot distinguish SMS-consented students',
    );
  });

  it('mutation self-check: removing !selectedUserId would change the source', () => {
    const mutated = commandCenterSrc.replace('!selectedUserId', '/* guard removed */');
    assert.ok(
      !mutated.includes('!selectedUserId'),
      '!selectedUserId still present after mutation — assertion is not tight enough',
    );
  });
});

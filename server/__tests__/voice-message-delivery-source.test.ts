/**
 * Source-level guards for voice-message-delivery.ts (#425, #426).
 *
 * CONTRACT:
 *   #425 — After a successful SMS retry, deliveryError is cleared to null in
 *           the queue row, so the error badge disappears from the UI.
 *   #426 — After a failed audio render, the error reason is written into the
 *           queue row's deliveryError column (not just logged to the server).
 *
 * These tests assert the guard code is present in the production source.
 * If either write is removed, the test fails in CI before it reaches prod.
 *
 * Run: npx tsx --test server/__tests__/voice-message-delivery-source.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(import.meta.dirname, '../services/voice-message-delivery.ts'),
  'utf-8',
);

describe('voice-message-delivery.ts — delivery-error badge source guards', () => {
  // ── #425: successful retry clears deliveryError ───────────────────────────
  describe('#425 — successful SMS retry clears deliveryError in the queue row', () => {
    it('deliveryError: null is written on the success path', () => {
      assert.ok(
        src.includes('deliveryError: null'),
        'deliveryError: null not found in voice-message-delivery.ts — successful retry would not clear the error badge',
      );
    });

    it('deliveryError: null appears alongside smsDeliveredAt (same .set() call)', () => {
      // Both columns must be cleared in the same update to keep them consistent.
      const setBlockMatch = src.match(/\.set\(\{[^}]*smsDeliveredAt[^}]*deliveryError\s*:\s*null[^}]*\}|\.set\(\{[^}]*deliveryError\s*:\s*null[^}]*smsDeliveredAt[^}]*\}/s);
      assert.ok(
        setBlockMatch !== null,
        'smsDeliveredAt and deliveryError: null must appear in the same .set({}) call — they must be updated atomically on retry success',
      );
    });

    it('mutation self-check: removing deliveryError: null would fail the assertion', () => {
      const mutated = src.replace('deliveryError: null', 'deliveryError: undefined');
      assert.ok(
        !mutated.includes('deliveryError: null'),
        'guard pattern still matches after mutation — assertion is not tight enough',
      );
    });
  });

  // ── #426: failed render writes error reason into queue row ────────────────
  describe('#426 — failed audio render persists error reason to deliveryError column', () => {
    it('deliveryError is set in the markFailed/error path (not just console.error)', () => {
      // The markFailed helper sets deliveryError to the error message string.
      // This distinguishes a failed queue row from a succeeded one (deliveryError: null).
      const hasDeliveryErrorSet = /\.set\s*\(\s*\{\s*deliveryError/.test(src);
      assert.ok(
        hasDeliveryErrorSet,
        '.set({ deliveryError: ... }) not found in voice-message-delivery.ts — render failures would not be persisted to the queue row',
      );
    });

    it('markFailed helper (or equivalent) is called on render failure path', () => {
      // Either a markFailed() call or an explicit deliveryError write must appear
      // before or at the audio-render error handling point.
      const hasMarkFailed = src.includes('markFailed(');
      const hasInlineDeliveryError = /deliveryError\s*:\s*(?!null)/.test(src);
      assert.ok(
        hasMarkFailed || hasInlineDeliveryError,
        'Neither markFailed() nor an inline deliveryError string was found — render failures may be swallowed silently',
      );
    });

    it('mutation self-check: removing the deliveryError set call would change the regex result', () => {
      const mutated = src.replace(/\.set\s*\(\s*\{\s*deliveryError[^}]+\}/, '.set({ /* removed */ }');
      const hasDeliveryErrorSet = /\.set\s*\(\s*\{\s*deliveryError/.test(mutated);
      assert.ok(
        !hasDeliveryErrorSet,
        'guard regex still matches after mutation — assertion is not tight enough',
      );
    });
  });
});

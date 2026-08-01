/**
 * Zod runtime validation for resolutionType (#537).
 *
 * CONTRACT:
 *   A misspelled resolutionType string must be rejected at runtime by
 *   resolutionTypeSchema.safeParse(), not just at compile-time by TypeScript.
 *   This prevents a typo from reaching the database and causing a CHECK
 *   constraint violation at the DB layer (which surfaces as a confusing 500).
 *
 *   The Zod schema is derived from RESOLUTION_TYPE_VALUES so the two are
 *   always in sync — no manual maintenance required.
 *
 * Run: npx tsx --test server/__tests__/resolution-type-zod.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolutionTypeSchema, RESOLUTION_TYPE_VALUES } from '../../shared/absence-types.js';

describe('resolutionTypeSchema — Zod runtime validation (#537)', () => {
  // ── valid values ────────────────────────────────────────────────────────────

  it('accepts "student_returned"', () => {
    const result = resolutionTypeSchema.safeParse('student_returned');
    assert.ok(result.success, 'student_returned must be accepted by Zod');
  });

  it('accepts "message_queued"', () => {
    const result = resolutionTypeSchema.safeParse('message_queued');
    assert.ok(result.success, 'message_queued must be accepted by Zod');
  });

  it('accepts "dismissed"', () => {
    const result = resolutionTypeSchema.safeParse('dismissed');
    assert.ok(result.success, 'dismissed must be accepted by Zod');
  });

  it('all RESOLUTION_TYPE_VALUES pass safeParse', () => {
    for (const val of RESOLUTION_TYPE_VALUES) {
      const result = resolutionTypeSchema.safeParse(val);
      assert.ok(result.success, `${val} must pass Zod validation`);
    }
  });

  // ── invalid values ──────────────────────────────────────────────────────────

  it('rejects a misspelled value "studenr_returned"', () => {
    const result = resolutionTypeSchema.safeParse('studenr_returned');
    assert.ok(!result.success, 'Zod must reject a misspelled resolutionType');
    assert.ok(
      result.error.issues.length > 0,
      'safeParse error must include at least one issue describing the rejection',
    );
  });

  it('rejects a plausible typo "resolved" (not in enum)', () => {
    // "resolved" looks like a valid state but is not in RESOLUTION_TYPE_VALUES.
    const result = resolutionTypeSchema.safeParse('resolved');
    assert.ok(!result.success, '"resolved" is not a valid ResolutionType and must be rejected');
  });

  it('rejects an empty string', () => {
    const result = resolutionTypeSchema.safeParse('');
    assert.ok(!result.success, 'empty string must be rejected');
  });

  it('rejects null (null must use the nullable wrapper, not the base schema)', () => {
    const result = resolutionTypeSchema.safeParse(null);
    assert.ok(!result.success, 'null must be rejected by the base enum schema');
  });

  it('rejects undefined', () => {
    const result = resolutionTypeSchema.safeParse(undefined);
    assert.ok(!result.success, 'undefined must be rejected by the base enum schema');
  });

  // ── mutation self-check ─────────────────────────────────────────────────────

  it('mutation self-check: schema is not trivially broken (all valid values do not all fail)', () => {
    const allFail = RESOLUTION_TYPE_VALUES.every(v => !resolutionTypeSchema.safeParse(v).success);
    assert.ok(!allFail, 'Every valid value was rejected — resolutionTypeSchema may be misconfigured');
  });

  it('mutation self-check: invalid value is not accidentally accepted', () => {
    // This assertion would fail if someone changed the schema to z.string()
    // instead of z.enum(RESOLUTION_TYPE_VALUES).
    const result = resolutionTypeSchema.safeParse('__invalid__test__value__');
    assert.ok(!result.success, 'An obviously invalid value must be rejected');
  });
});

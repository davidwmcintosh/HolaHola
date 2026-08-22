/**
 * Zod runtime validation for resolutionType (#537 / #592).
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
 *   The schema must also be wired to the POST /api/admin/trigger-call route
 *   so invalid values are rejected at the HTTP boundary.
 *
 * Run: npx tsx --test server/__tests__/resolution-type-zod.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

// ── route-wiring assertion ─────────────────────────────────────────────────────

describe('POST /api/admin/trigger-call — resolutionTypeSchema wired at HTTP boundary (#592)', () => {
  const routesSource = readFileSync(
    resolve(process.cwd(), 'server/routes.ts'),
    'utf-8',
  );

  it('routes.ts imports resolutionTypeSchema from shared/absence-types', () => {
    assert.ok(
      routesSource.includes('resolutionTypeSchema') && routesSource.includes('absence-types'),
      'server/routes.ts must import resolutionTypeSchema from shared/absence-types',
    );
  });

  it('trigger-call handler calls resolutionTypeSchema.safeParse()', () => {
    // Find the trigger-call route block and confirm safeParse is called within it.
    const triggerCallIdx = routesSource.indexOf('/api/admin/trigger-call');
    assert.ok(triggerCallIdx !== -1, '/api/admin/trigger-call route must exist in routes.ts');

    // Look for safeParse within a reasonable window after the route declaration (~3 KB).
    const window = routesSource.slice(triggerCallIdx, triggerCallIdx + 3000);
    assert.ok(
      window.includes('resolutionTypeSchema.safeParse'),
      'POST /api/admin/trigger-call must call resolutionTypeSchema.safeParse() to validate resolutionType at the HTTP boundary',
    );
  });

  it('trigger-call handler returns 400 when resolutionTypeSchema.safeParse fails', () => {
    // Confirm the handler returns a 400 response on parse failure.
    const triggerCallIdx = routesSource.indexOf('/api/admin/trigger-call');
    const window = routesSource.slice(triggerCallIdx, triggerCallIdx + 3000);
    assert.ok(
      window.includes('status(400)') && window.includes('resolutionTypeSchema.safeParse'),
      'POST /api/admin/trigger-call must return HTTP 400 when resolutionTypeSchema.safeParse fails',
    );
  });
});

// ── dismiss route wiring (#595) ───────────────────────────────────────────────

describe('PATCH /api/admin/absence-nudges/:userId/dismiss — resolutionTypeSchema wired (#595)', () => {
  const routesSource = readFileSync(
    resolve(process.cwd(), 'server/routes.ts'),
    'utf-8',
  );

  it('dismiss route exists in routes.ts', () => {
    assert.ok(
      routesSource.includes('/api/admin/absence-nudges/') &&
        routesSource.includes('/dismiss'),
      'PATCH /api/admin/absence-nudges/:userId/dismiss route must exist in routes.ts',
    );
  });

  it('dismiss handler calls resolutionTypeSchema.safeParse()', () => {
    const dismissIdx = routesSource.indexOf('absence-nudges/:userId/dismiss');
    assert.ok(dismissIdx !== -1, 'absence-nudges/:userId/dismiss route must exist in routes.ts');

    // Look for safeParse within a reasonable window after the route declaration (~2 KB).
    const window = routesSource.slice(dismissIdx, dismissIdx + 2000);
    assert.ok(
      window.includes('resolutionTypeSchema.safeParse'),
      'PATCH /api/admin/absence-nudges/:userId/dismiss must call resolutionTypeSchema.safeParse() to validate resolutionType',
    );
  });

  it('dismiss handler returns 400 when resolutionTypeSchema.safeParse fails', () => {
    const dismissIdx = routesSource.indexOf('absence-nudges/:userId/dismiss');
    const window = routesSource.slice(dismissIdx, dismissIdx + 2000);
    assert.ok(
      window.includes('status(400)') && window.includes('resolutionTypeSchema.safeParse'),
      'PATCH /api/admin/absence-nudges/:userId/dismiss must return HTTP 400 when resolutionTypeSchema.safeParse fails',
    );
  });

  it('dismiss handler defaults to "dismissed" when resolutionType is not supplied', () => {
    const dismissIdx = routesSource.indexOf('absence-nudges/:userId/dismiss');
    const window = routesSource.slice(dismissIdx, dismissIdx + 2000);
    assert.ok(
      window.includes("'dismissed'") || window.includes('"dismissed"'),
      'dismiss handler must default resolutionType to "dismissed" when body omits it',
    );
  });
});

// ── history route wiring (#595) ───────────────────────────────────────────────

describe('GET /api/admin/absence-nudges/history — resolutionTypeSchema wired (#595)', () => {
  const historySource = readFileSync(
    resolve(process.cwd(), 'server/routes/absence-nudges-history.ts'),
    'utf-8',
  );

  it('absence-nudges-history.ts imports resolutionTypeSchema from shared/absence-types', () => {
    assert.ok(
      historySource.includes('resolutionTypeSchema') && historySource.includes('absence-types'),
      'server/routes/absence-nudges-history.ts must import resolutionTypeSchema from shared/absence-types',
    );
  });

  it('history handler calls resolutionTypeSchema.safeParse()', () => {
    assert.ok(
      historySource.includes('resolutionTypeSchema.safeParse'),
      'GET /api/admin/absence-nudges/history must call resolutionTypeSchema.safeParse() to validate resolutionType query param',
    );
  });

  it('history handler returns 400 when resolutionTypeSchema.safeParse fails', () => {
    assert.ok(
      historySource.includes('status(400)') && historySource.includes('resolutionTypeSchema.safeParse'),
      'GET /api/admin/absence-nudges/history must return HTTP 400 when resolutionTypeSchema.safeParse fails',
    );
  });

  it('history handler does not use a manual includes() guard in place of Zod', () => {
    // The old guard was VALID_RESOLUTION_TYPES.includes(...) — Zod replaces it.
    assert.ok(
      !historySource.includes('VALID_RESOLUTION_TYPES.includes'),
      'history handler must not use the old manual VALID_RESOLUTION_TYPES.includes() guard',
    );
  });
});

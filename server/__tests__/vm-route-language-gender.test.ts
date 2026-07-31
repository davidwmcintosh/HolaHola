/**
 * Confirms the GET /api/vm/:id route correctly returns language and gender
 * fields drawn from the joined users table, so that the voice-message playback
 * page can show the correct tutor avatar for non-Spanish languages.
 *
 * Task 202 wired the playback page to call getTutorAvatar(data.language, data.gender, …)
 * dynamically.  If the route ever stops joining the users table, or stops
 * forwarding targetLanguage / tutorGender in the JSON body, every student will
 * silently see Daniela's Spanish avatar regardless of their language.
 *
 * Strategy: static source analysis of the real production files.
 * Each assertion reads routes.ts from disk and fails if the production code
 * drifts from the contract (join removed, field renamed, default changed, etc.).
 *
 * Window sizes are calibrated to the actual offsets measured in routes.ts:
 *   leftJoin          ~865 chars after the route anchor  → window 1000
 *   res.json(         ~1070 chars after the anchor       → window 1200
 *   language: item.*  ~1247 chars after the anchor       → window 1400
 *   gender: item.*    ~1299 chars after the anchor       → window 1400
 *
 * Run with:
 *   npx tsx --test server/__tests__/vm-route-language-gender.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

// ── Load source files once ────────────────────────────────────────────────────

let routesSrc: string;
let voiceMessageSrc: string;

before(() => {
  routesSrc       = readFileSync(resolve(root, 'server/routes.ts'), 'utf-8');
  voiceMessageSrc = readFileSync(resolve(root, 'client/src/pages/voice-message.tsx'), 'utf-8');
});

// ── Helper ────────────────────────────────────────────────────────────────────

/** Returns the text slice around the FIRST occurrence of `anchor` in `src`. */
function regionAround(src: string, anchor: string, before = 0, after = 500): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — routes.ts: GET /api/vm/:id route shape
// ═══════════════════════════════════════════════════════════════════════════════

describe('routes.ts — GET /api/vm/:id route shape', () => {
  const ROUTE_ANCHOR = 'app.get("/api/vm/:id"';

  it('route is registered in routes.ts', () => {
    assert.ok(
      routesSrc.includes(ROUTE_ANCHOR),
      'GET /api/vm/:id not found in routes.ts — route may have been renamed or removed',
    );
  });

  it('route joins the users table to retrieve per-user language and gender', () => {
    // leftJoin is ~865 chars after the route anchor; use 1000 to be safe.
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 1000);
    const hasJoin = region.includes('leftJoin') || region.includes('innerJoin');
    assert.ok(
      hasJoin,
      'No join found in GET /api/vm/:id — without a join, targetLanguage and tutorGender cannot be selected from users',
    );
  });

  it('route selects targetLanguage from the users table', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 1000);
    assert.ok(
      region.includes('targetLanguage'),
      'targetLanguage not selected in GET /api/vm/:id — language field will be missing from the response',
    );
  });

  it('route selects tutorGender from the users table', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 1000);
    assert.ok(
      region.includes('tutorGender'),
      'tutorGender not selected in GET /api/vm/:id — gender field will be missing from the response',
    );
  });

  it('response body includes language: item.targetLanguage (forwarded to client)', () => {
    // language: item.targetLanguage appears ~1247 chars after the anchor; use 1400.
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 1400);
    const hasLanguage = /language\s*:\s*item\.targetLanguage/.test(region);
    assert.ok(
      hasLanguage,
      'GET /api/vm/:id response must include `language: item.targetLanguage` so the playback page can call getTutorAvatar(data.language, …)',
    );
  });

  it('response body includes gender: item.tutorGender (forwarded to client)', () => {
    // gender: item.tutorGender appears ~1299 chars after the anchor; use 1400.
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 1400);
    const hasGender = /gender\s*:\s*item\.tutorGender/.test(region);
    assert.ok(
      hasGender,
      'GET /api/vm/:id response must include `gender: item.tutorGender` so the playback page can call getTutorAvatar(…, data.gender, …)',
    );
  });

  it("language field defaults to 'spanish' when targetLanguage is null", () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 1400);
    // Pattern: item.targetLanguage ?? 'spanish'
    const hasDefault = /item\.targetLanguage\s*\?\?\s*['"]spanish['"]/.test(region);
    assert.ok(
      hasDefault,
      "language field must default to 'spanish' (null-coalesce) to avoid undefined reaching the avatar selector",
    );
  });

  it("gender field defaults to 'female' when tutorGender is null", () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 1400);
    const hasDefault = /item\.tutorGender\s*\?\?\s*['"]female['"]/.test(region);
    assert.ok(
      hasDefault,
      "gender field must default to 'female' (null-coalesce) to avoid undefined reaching the avatar selector",
    );
  });

  it('route joins users on userId FK (correct join key)', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 1000);
    assert.ok(
      region.includes('userId'),
      'join condition referencing userId not found — the users join may be using the wrong key and will always return no rows',
    );
  });

  it('response includes both language and gender in the same res.json() call', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 1400);
    const langIdx   = region.indexOf('language:');
    const genderIdx = region.indexOf('gender:');
    assert.ok(
      langIdx !== -1 && genderIdx !== -1,
      'Both language and gender must be in the same res.json() body',
    );
    // Must be within 300 chars of each other (same object literal)
    assert.ok(
      Math.abs(langIdx - genderIdx) < 300,
      `language (offset ${langIdx}) and gender (offset ${genderIdx}) are too far apart — they may be in different response objects`,
    );
  });

  it('route validates the UUID format before querying (prevents invalid id from hitting DB)', () => {
    const region = regionAround(routesSrc, ROUTE_ANCHOR, 0, 300);
    const hasValidation = region.includes('match(/^[0-9a-f-]{36}$/i)');
    assert.ok(
      hasValidation,
      'UUID format validation not found in GET /api/vm/:id — invalid ids should be rejected with 400 before hitting the DB',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — client/src/pages/voice-message.tsx: avatar uses data.language + data.gender
// ═══════════════════════════════════════════════════════════════════════════════

describe('client/src/pages/voice-message.tsx — dynamic avatar wiring', () => {

  it('voice-message page imports getTutorAvatar from tutor-avatars', () => {
    assert.ok(
      voiceMessageSrc.includes('getTutorAvatar'),
      'getTutorAvatar not found in voice-message.tsx — page may have reverted to a hardcoded Spanish avatar',
    );
  });

  it('avatar img src calls getTutorAvatar with data.language (not a hardcoded language string)', () => {
    const hasDynamic = /getTutorAvatar\s*\(\s*data\.language/.test(voiceMessageSrc);
    assert.ok(
      hasDynamic,
      "getTutorAvatar must be called with data.language — hardcoding 'spanish' would break all non-Spanish avatars",
    );
  });

  it('avatar img src calls getTutorAvatar with data.gender (not a hardcoded gender string)', () => {
    const hasDynamic = /getTutorAvatar\s*\([^)]*data\.gender/.test(voiceMessageSrc);
    assert.ok(
      hasDynamic,
      "getTutorAvatar must be called with data.gender — hardcoding 'female' would ignore the user's tutor preference",
    );
  });

  it('tutor name display also uses data.language and data.gender dynamically', () => {
    const hasName = /getTutorName\s*\(\s*data\.language/.test(voiceMessageSrc);
    assert.ok(
      hasName,
      "getTutorName(data.language, …) not found in voice-message.tsx — tutor name will always show 'Daniela' for non-Spanish users",
    );
  });

  it('VoiceMessageData interface declares language and gender fields', () => {
    const hasLanguage = /language\s*:\s*string/.test(voiceMessageSrc);
    const hasGender   = /gender\s*:\s*string/.test(voiceMessageSrc);
    assert.ok(
      hasLanguage,
      'VoiceMessageData interface is missing the language: string field — data.language will be typed as any/undefined',
    );
    assert.ok(
      hasGender,
      'VoiceMessageData interface is missing the gender: string field — data.gender will be typed as any/undefined',
    );
  });

  it('page fetches from /api/vm/${id} (the route that returns language/gender)', () => {
    assert.ok(
      voiceMessageSrc.includes('/api/vm/${id}'),
      'voice-message.tsx must fetch from /api/vm/${id} to obtain language and gender from the server',
    );
  });
});

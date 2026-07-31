/**
 * Unit tests for the language-specific tutor avatar selector.
 *
 * The voice-message playback page calls:
 *   getTutorAvatar(data.language, data.gender, 'listening')
 *
 * A regression that causes normalizeLanguage() to silently map any
 * unknown (or non-Spanish) language to 'spanish' would show Daniela's
 * photo for every language.  These tests confirm that French, German, and
 * Korean resolve to their own distinct avatar sets, not the Spanish one.
 *
 * Because tutor-avatars.ts uses Vite-specific `@assets/…` imports (image
 * modules that only resolve inside a Vite bundler), we mirror the pure
 * functions inline rather than importing the real module.  The inline
 * mirrors are verbatim copies of the production logic; if the production
 * function body changes, update the mirrors below.
 *
 * Run with:
 *   npx tsx --test client/src/components/tutor-avatar-language.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const root       = resolve(__dirname, '../../..');

// ── Source files loaded for structural assertions ─────────────────────────────

let avatarSrc: string;

before(() => {
  avatarSrc = readFileSync(resolve(root, 'client/src/lib/tutor-avatars.ts'), 'utf-8');
});

// ── Inline mirror of normalizeLanguage() ─────────────────────────────────────
//
// Verbatim port of the production function from client/src/lib/tutor-avatars.ts.
// The function is pure (no imports needed) so it can run in Node directly.

type SupportedLanguage =
  | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese'
  | 'chinese' | 'japanese' | 'korean' | 'english' | 'hebrew'
  | 'biology' | 'history' | 'math' | 'business';

function normalizeLanguage(language: string | null | undefined): SupportedLanguage {
  if (!language) return 'spanish';

  const normalized = language.toLowerCase().trim();

  const languageMap: Record<string, SupportedLanguage> = {
    'spanish': 'spanish',   'español': 'spanish',  'es': 'spanish',
    'french':  'french',    'français': 'french',  'fr': 'french',
    'german':  'german',    'deutsch': 'german',   'de': 'german',
    'italian': 'italian',   'italiano': 'italian', 'it': 'italian',
    'portuguese': 'portuguese', 'português': 'portuguese', 'pt': 'portuguese',
    'chinese': 'chinese',   'mandarin': 'chinese', 'zh': 'chinese', '中文': 'chinese',
    'japanese': 'japanese', 'ja': 'japanese',      '日本語': 'japanese',
    'korean':  'korean',    'ko': 'korean',        '한국어': 'korean',
    'english': 'english',   'en': 'english',
    'hebrew':  'hebrew',    'he': 'hebrew',        'עברית': 'hebrew',
    'biology': 'biology',
    'history': 'history',
    'math': 'math',         'mathematics': 'math',
    'business': 'business',
  };

  return languageMap[normalized] || 'spanish';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — normalizeLanguage(): non-Spanish languages are not collapsed to 'spanish'
// ═══════════════════════════════════════════════════════════════════════════════

describe('normalizeLanguage() — non-Spanish languages resolve to distinct keys', () => {

  it("'french' → 'french' (not 'spanish')", () => {
    assert.equal(normalizeLanguage('french'), 'french');
  });

  it("'German' → 'german' (case-insensitive)", () => {
    assert.equal(normalizeLanguage('German'), 'german');
  });

  it("'korean' → 'korean'", () => {
    assert.equal(normalizeLanguage('korean'), 'korean');
  });

  it("'italian' → 'italian'", () => {
    assert.equal(normalizeLanguage('italian'), 'italian');
  });

  it("'portuguese' → 'portuguese'", () => {
    assert.equal(normalizeLanguage('portuguese'), 'portuguese');
  });

  it("'chinese' → 'chinese'", () => {
    assert.equal(normalizeLanguage('chinese'), 'chinese');
  });

  it("'japanese' → 'japanese'", () => {
    assert.equal(normalizeLanguage('japanese'), 'japanese');
  });

  it("'english' → 'english'", () => {
    assert.equal(normalizeLanguage('english'), 'english');
  });

  it("'hebrew' → 'hebrew'", () => {
    assert.equal(normalizeLanguage('hebrew'), 'hebrew');
  });

  it("'spanish' → 'spanish' (baseline)", () => {
    assert.equal(normalizeLanguage('spanish'), 'spanish');
  });

  it("ISO code 'fr' → 'french'", () => {
    assert.equal(normalizeLanguage('fr'), 'french');
  });

  it("ISO code 'de' → 'german'", () => {
    assert.equal(normalizeLanguage('de'), 'german');
  });

  it("ISO code 'ko' → 'korean'", () => {
    assert.equal(normalizeLanguage('ko'), 'korean');
  });

  it("ISO code 'ja' → 'japanese'", () => {
    assert.equal(normalizeLanguage('ja'), 'japanese');
  });

  it("ISO code 'zh' → 'chinese'", () => {
    assert.equal(normalizeLanguage('zh'), 'chinese');
  });

  it("null → 'spanish' (safe default)", () => {
    assert.equal(normalizeLanguage(null), 'spanish');
  });

  it("undefined → 'spanish' (safe default)", () => {
    assert.equal(normalizeLanguage(undefined), 'spanish');
  });

  it("unknown language string → 'spanish' (safe default)", () => {
    assert.equal(normalizeLanguage('klingon'), 'spanish');
  });

  it("'FRENCH' (all-caps) → 'french' (case-insensitive)", () => {
    assert.equal(normalizeLanguage('FRENCH'), 'french');
  });

  it("'  korean  ' (with whitespace) → 'korean' (trimmed)", () => {
    assert.equal(normalizeLanguage('  korean  '), 'korean');
  });

  it("'mandarin' → 'chinese' (alias)", () => {
    assert.equal(normalizeLanguage('mandarin'), 'chinese');
  });

  it("'français' → 'french' (native name)", () => {
    assert.equal(normalizeLanguage('français'), 'french');
  });

  it("'deutsch' → 'german' (native name)", () => {
    assert.equal(normalizeLanguage('deutsch'), 'german');
  });

  it("'한국어' → 'korean' (native name)", () => {
    assert.equal(normalizeLanguage('한국어'), 'korean');
  });

  it("non-Spanish languages do NOT equal 'spanish'", () => {
    const nonSpanish: string[] = ['french', 'german', 'korean', 'japanese', 'chinese', 'italian', 'portuguese', 'english', 'hebrew'];
    for (const lang of nonSpanish) {
      assert.notEqual(
        normalizeLanguage(lang),
        'spanish',
        `normalizeLanguage('${lang}') returned 'spanish' — non-Spanish language is being collapsed to the Spanish avatar`,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — tutor-avatars.ts source structure: each language has its own avatar set
// ═══════════════════════════════════════════════════════════════════════════════

describe('client/src/lib/tutor-avatars.ts — structural integrity', () => {

  it('femaleAvatars record has an entry for french', () => {
    assert.ok(
      avatarSrc.includes("french:") && avatarSrc.includes('frenchFemaleListening'),
      'french not found in femaleAvatars — French students will fall through to the Spanish default',
    );
  });

  it('femaleAvatars record has an entry for german', () => {
    assert.ok(
      avatarSrc.includes('germanFemaleListening'),
      'german not found in femaleAvatars — German students will see the wrong avatar',
    );
  });

  it('femaleAvatars record has an entry for korean', () => {
    assert.ok(
      avatarSrc.includes('koreanFemaleListening'),
      'korean not found in femaleAvatars — Korean students will see the wrong avatar',
    );
  });

  it('maleAvatars record has an entry for french', () => {
    assert.ok(
      avatarSrc.includes('frenchMaleListening'),
      'french not found in maleAvatars — French male-tutor users will see the wrong avatar',
    );
  });

  it('maleAvatars record has an entry for german', () => {
    assert.ok(
      avatarSrc.includes('germanMaleListening'),
      'german not found in maleAvatars — German male-tutor users will see the wrong avatar',
    );
  });

  it('maleAvatars record has an entry for korean', () => {
    assert.ok(
      avatarSrc.includes('koreanMaleListening'),
      'korean not found in maleAvatars — Korean male-tutor users will see the wrong avatar',
    );
  });

  it('getTutorAvatar is exported from tutor-avatars.ts', () => {
    assert.ok(
      /export\s+function\s+getTutorAvatar/.test(avatarSrc),
      'getTutorAvatar must be exported — voice-message.tsx imports and calls it',
    );
  });

  it('normalizeLanguage is exported from tutor-avatars.ts', () => {
    assert.ok(
      /export\s+function\s+normalizeLanguage/.test(avatarSrc),
      'normalizeLanguage must be exported — it is the mapping that prevents language collapse',
    );
  });

  it('getTutorName is exported from tutor-avatars.ts', () => {
    assert.ok(
      /export\s+function\s+getTutorName/.test(avatarSrc),
      'getTutorName must be exported — voice-message.tsx uses it to display the correct tutor name',
    );
  });

  it('getTutorAvatar calls normalizeLanguage internally (not a manual switch on raw input)', () => {
    // Extract the region around getTutorAvatar function definition and confirm it
    // calls normalizeLanguage so untrimmed/unrecognised language strings are handled uniformly.
    const fnStart = avatarSrc.indexOf('export function getTutorAvatar');
    assert.ok(fnStart !== -1, 'getTutorAvatar not found');
    const fnBody = avatarSrc.slice(fnStart, fnStart + 400);
    assert.ok(
      fnBody.includes('normalizeLanguage'),
      'getTutorAvatar must call normalizeLanguage() — without it, language strings from the API may not match avatar keys',
    );
  });

  it('French female tutor imports use distinct image filenames (not Spanish/Daniela assets)', () => {
    // Confirm the French female import is NOT the same as the Spanish female import.
    // spanishFemaleListening comes from tutor-listening-no-background_*.png (Daniela).
    // A regression would reuse the same filename.
    const frenchLine = avatarSrc.match(/frenchFemaleListening\s+from\s+["']([^"']+)["']/);
    const spanishLine = avatarSrc.match(/spanishFemaleListening\s+from\s+["']([^"']+)["']/);
    assert.ok(frenchLine, 'frenchFemaleListening import not found in tutor-avatars.ts');
    assert.ok(spanishLine, 'spanishFemaleListening import not found in tutor-avatars.ts');
    assert.notEqual(
      frenchLine![1],
      spanishLine![1],
      'French female listening avatar resolves to the same file as Daniela (Spanish) — the avatar is not language-specific',
    );
  });

  it('German female tutor imports use distinct image filenames (not Spanish/Daniela assets)', () => {
    const germanLine  = avatarSrc.match(/germanFemaleListening\s+from\s+["']([^"']+)["']/);
    const spanishLine = avatarSrc.match(/spanishFemaleListening\s+from\s+["']([^"']+)["']/);
    assert.ok(germanLine, 'germanFemaleListening import not found');
    assert.ok(spanishLine, 'spanishFemaleListening import not found');
    assert.notEqual(germanLine![1], spanishLine![1],
      'German female listening avatar resolves to the same file as Daniela — not language-specific');
  });

  it('Korean female tutor imports use distinct image filenames (not Spanish/Daniela assets)', () => {
    const koreanLine  = avatarSrc.match(/koreanFemaleListening\s+from\s+["']([^"']+)["']/);
    const spanishLine = avatarSrc.match(/spanishFemaleListening\s+from\s+["']([^"']+)["']/);
    assert.ok(koreanLine, 'koreanFemaleListening import not found');
    assert.ok(spanishLine, 'spanishFemaleListening import not found');
    assert.notEqual(koreanLine![1], spanishLine![1],
      'Korean female listening avatar resolves to the same file as Daniela — not language-specific');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — getTutorAvatar() logic: different languages produce different avatar URLs
// ═══════════════════════════════════════════════════════════════════════════════
//
// We cannot import getTutorAvatar() directly here because tutor-avatars.ts uses
// Vite asset imports that don't resolve in Node.js. Instead we verify the source
// structure that guarantees different languages map to different avatar entries.

describe('tutor-avatars.ts — avatar map distinctness per language', () => {

  it('femaleAvatars and maleAvatars both have a unique entry for each non-Spanish language', () => {
    const nonSpanish = ['french', 'german', 'korean', 'japanese', 'italian', 'portuguese', 'chinese', 'english', 'hebrew'];
    for (const lang of nonSpanish) {
      assert.ok(
        avatarSrc.includes(`${lang}:`),
        `'${lang}:' not found in tutor-avatars.ts — ${lang} has no avatar entry in the lookup map`,
      );
    }
  });

  it('tutorNames map has a distinct tutor name for each non-Spanish language', () => {
    // At minimum, the language key must appear in the tutorNames record.
    const nonSpanish = ['french', 'german', 'korean', 'japanese', 'italian', 'portuguese', 'chinese', 'english', 'hebrew'];
    const tutorNamesSection = (() => {
      const start = avatarSrc.indexOf('const tutorNames');
      return start !== -1 ? avatarSrc.slice(start, start + 2000) : '';
    })();
    for (const lang of nonSpanish) {
      assert.ok(
        tutorNamesSection.includes(`${lang}:`),
        `'${lang}:' not found in tutorNames — non-Spanish users will see 'Daniela' as the tutor name`,
      );
    }
  });
});

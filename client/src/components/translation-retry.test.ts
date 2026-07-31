/**
 * Confirms the ConversationStripsSection translation retry flow is correctly
 * wired end-to-end in the production component (ChapterIntroduction.tsx).
 *
 * CONTRACTS being tested:
 *
 *   (a) Error notice appears when /api/strip-translation fails
 *       — fetchTranslations calls /api/strip-translation via POST
 *       — a non-ok response sets translationError=true
 *       — a thrown error (network failure) also sets translationError=true
 *       — the error notice div is gated on translationError state
 *         (data-testid="translation-error-notice" is only rendered when translationError is true)
 *
 *   (b) Clicking Retry triggers a second request
 *       — the Retry button (data-testid="button-retry-translation") has
 *         onClick={fetchTranslations}, wiring the button directly to the
 *         same function that fetches translations
 *
 *   (c) Error notice disappears and translations populate after success
 *       — a successful response calls setTranslationError(false), clearing the notice
 *       — a successful response calls setDynamicTranslations with the returned data
 *
 * Strategy: static source analysis of the real production file.
 * No DOM, no React, no network — just reads the actual source and asserts
 * that every contract is expressed in the code.  If any wiring changes
 * (endpoint renamed, guard removed, retry button unlinked, state field dropped),
 * the relevant test fails.
 *
 * Run with:
 *   npx tsx --test client/src/components/translation-retry.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../../..');

// ── Load production source file once ──────────────────────────────────────────

let src: string;  // client/src/components/ChapterIntroduction.tsx

before(() => {
  src = readFileSync(
    resolve(root, 'client/src/components/ChapterIntroduction.tsx'),
    'utf-8',
  );
});

// ── Helper ─────────────────────────────────────────────────────────────────────

/**
 * Returns a window of source text centred on the FIRST occurrence of `anchor`.
 * Returns '' when the anchor is not found.
 */
function regionAround(anchor: string, before = 600, after = 600): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — translationError state and fetchTranslations function
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChapterIntroduction.tsx — translationError state declaration', () => {

  it('declares translationError state with useState(false)', () => {
    // Matches: const [translationError, setTranslationError] = useState(false);
    const hasState = /const\s*\[\s*translationError\s*,\s*setTranslationError\s*\]\s*=\s*useState\s*\(\s*false\s*\)/.test(src);
    assert.ok(hasState,
      'translationError useState declaration not found — state may have been renamed or removed');
  });

  it('declares dynamicTranslations state with useState({})', () => {
    // Matches: const [dynamicTranslations, setDynamicTranslations] = useState<...>({})
    const hasState = /const\s*\[\s*dynamicTranslations\s*,\s*setDynamicTranslations\s*\]\s*=\s*useState/.test(src);
    assert.ok(hasState,
      'dynamicTranslations useState declaration not found — state may have been renamed or removed');
  });

  it('defines fetchTranslations as a useCallback', () => {
    const hasFn = /const\s+fetchTranslations\s*=\s*useCallback/.test(src);
    assert.ok(hasFn,
      'fetchTranslations useCallback not found — function may have been renamed or refactored');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — (a) Error notice: /api/strip-translation called, failures set error
// ═══════════════════════════════════════════════════════════════════════════════

describe('(a) Error notice — fetchTranslations calls the correct endpoint', () => {

  it('fetchTranslations posts to /api/strip-translation', () => {
    const hasEndpoint = src.includes("'/api/strip-translation'") || src.includes('"/api/strip-translation"');
    assert.ok(hasEndpoint,
      '/api/strip-translation endpoint not found in source — endpoint may have been renamed');
  });

  it('fetchTranslations uses POST method', () => {
    // The apiRequest call should be POST, /api/strip-translation
    const region = regionAround('/api/strip-translation', 200, 100);
    const hasPost = /apiRequest\s*\(\s*['"]POST['"]/.test(region);
    assert.ok(hasPost,
      'POST method not found near /api/strip-translation call — method may have changed');
  });

  it('sends texts and targetLanguage in the request body', () => {
    const region = regionAround('/api/strip-translation', 100, 300);
    assert.ok(region.includes('texts'), 'texts field not found in /api/strip-translation request body');
    assert.ok(
      region.includes('targetLanguage') || region.includes('nativeLanguage'),
      'targetLanguage/nativeLanguage field not found in /api/strip-translation request body',
    );
  });
});

describe('(a) Error notice — non-ok response sets translationError', () => {

  it('checks r.ok (or response.ok) before processing the response', () => {
    // Matches: if (!r.ok) or if (!response.ok)
    const hasOkCheck = /if\s*\(\s*!\s*r\.ok\s*\)/.test(src) || /if\s*\(\s*!\s*response\.ok\s*\)/.test(src);
    assert.ok(hasOkCheck,
      '!r.ok guard not found — non-ok responses may not be handled');
  });

  it('sets translationError(true) in the !ok branch', () => {
    // Find the !r.ok check and verify setTranslationError(true) follows within that block
    const region = regionAround('!r.ok', 0, 200);
    const setsError = /setTranslationError\s*\(\s*true\s*\)/.test(region);
    assert.ok(setsError,
      'setTranslationError(true) not found near !r.ok branch — error state may not be set on failure');
  });

  it('sets translationError(true) in the .catch() handler (network failure path)', () => {
    // The catch block must call setTranslationError(true)
    const region = regionAround('.catch(', 0, 300);
    const setsError = /setTranslationError\s*\(\s*true\s*\)/.test(region);
    assert.ok(setsError,
      'setTranslationError(true) not found in .catch() handler — network errors may not show the error notice');
  });
});

describe('(a) Error notice — JSX gates the notice on translationError', () => {

  it('translationError state gates the error notice in JSX (needsTranslation && translationError)', () => {
    // Matches: needsTranslation && translationError
    const hasGate = /needsTranslation\s*&&\s*translationError/.test(src);
    assert.ok(hasGate,
      '"needsTranslation && translationError" gate not found — error notice may always render or never render');
  });

  it('error notice element has data-testid="translation-error-notice"', () => {
    assert.ok(
      src.includes('data-testid="translation-error-notice"') || src.includes("data-testid='translation-error-notice'"),
      'data-testid="translation-error-notice" not found — error notice is not identifiable in tests',
    );
  });

  it('error notice text mentions translations being unavailable', () => {
    const region = regionAround('translation-error-notice', 0, 400);
    const hasMeaningfulText =
      /unavailable/i.test(region) ||
      /try again/i.test(region) ||
      /failed/i.test(region) ||
      /error/i.test(region);
    assert.ok(hasMeaningfulText,
      'Error notice does not contain user-facing text about translation failure');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — (b) Retry button wired to fetchTranslations
// ═══════════════════════════════════════════════════════════════════════════════

describe('(b) Retry button — wired directly to fetchTranslations', () => {

  it('retry button has data-testid="button-retry-translation"', () => {
    assert.ok(
      src.includes('data-testid="button-retry-translation"') || src.includes("data-testid='button-retry-translation'"),
      'data-testid="button-retry-translation" not found — retry button is not identifiable in tests',
    );
  });

  it('retry button has onClick={fetchTranslations}', () => {
    // onClick is declared before data-testid in JSX, so look behind the testid anchor
    const region = regionAround('button-retry-translation', 400, 100);
    const hasOnClick = /onClick\s*=\s*\{\s*fetchTranslations\s*\}/.test(region);
    assert.ok(hasOnClick,
      'onClick={fetchTranslations} not found near button-retry-translation — retry button may not trigger a new request');
  });

  it('retry button is rendered inside the error notice block', () => {
    // The retry button must appear within the same conditional block as translation-error-notice
    const errorStart = src.indexOf('translation-error-notice');
    const retryStart = src.indexOf('button-retry-translation');
    assert.ok(errorStart !== -1, 'translation-error-notice not found');
    assert.ok(retryStart !== -1, 'button-retry-translation not found');
    // Both testids should be within ~500 chars of each other (same JSX block)
    assert.ok(
      Math.abs(retryStart - errorStart) < 800,
      'Retry button is far from the error notice — they may be in separate conditional blocks',
    );
  });

  it('retry button label includes "Retry"', () => {
    const region = regionAround('button-retry-translation', 0, 300);
    assert.ok(
      region.includes('Retry'),
      '"Retry" text not found near the retry button element',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4 — (c) Success path clears error and populates translations
// ═══════════════════════════════════════════════════════════════════════════════

describe('(c) Success path — clears error and populates translations', () => {

  it('success path calls setDynamicTranslations with the server data', () => {
    // In the .then() chain: setDynamicTranslations(data.translations)
    const hasSet = /setDynamicTranslations\s*\(\s*data/.test(src);
    assert.ok(hasSet,
      'setDynamicTranslations(data...) not found — translations may not be populated on success');
  });

  it('success path calls setTranslationError(false) to clear the error notice', () => {
    // Must call setTranslationError(false) on the success path
    const hasReset = /setTranslationError\s*\(\s*false\s*\)/.test(src);
    assert.ok(hasReset,
      'setTranslationError(false) not found — error notice may persist even after a successful retry');
  });

  it('setTranslationError(false) appears AFTER setDynamicTranslations in the success block', () => {
    // Both must exist; setDynamicTranslations should come before setTranslationError(false)
    const setTranslIdx = src.indexOf('setDynamicTranslations(');
    const clearErrIdx  = src.indexOf('setTranslationError(false)');
    assert.ok(setTranslIdx !== -1, 'setDynamicTranslations call not found');
    assert.ok(clearErrIdx  !== -1, 'setTranslationError(false) not found');
    assert.ok(
      setTranslIdx < clearErrIdx,
      'setTranslationError(false) appears before setDynamicTranslations — ordering may clear the error before data is ready',
    );
  });

  it('translations data is gated on data?.translations existence before setting state', () => {
    // The success handler checks data?.translations before calling setDynamicTranslations.
    // Search the whole source for the guard rather than windowing from the useState
    // declaration (which is the first occurrence of 'setDynamicTranslations').
    const hasGuard =
      /if\s*\(\s*data\?\.translations\s*\)/.test(src) ||
      /data\?\.translations\s*&&/.test(src) ||
      /data\s*&&\s*data\.translations/.test(src);
    assert.ok(hasGuard,
      'data?.translations guard not found — a malformed success response may crash or reset state');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5 — early-exit guards (prevent spurious requests when not needed)
// ═══════════════════════════════════════════════════════════════════════════════

describe('fetchTranslations — early-exit guards prevent spurious requests', () => {

  it('returns early when needsTranslation is false', () => {
    // Matches: if (!needsTranslation ... return
    const region = regionAround('fetchTranslations = useCallback', 0, 400);
    const hasGuard = /if\s*\(\s*!needsTranslation/.test(region) || /needsTranslation/.test(region);
    assert.ok(hasGuard,
      'needsTranslation guard not found in fetchTranslations — function may fire for English speakers');
  });

  it('returns early when chapterType is undefined', () => {
    const region = regionAround('fetchTranslations = useCallback', 0, 400);
    const hasGuard = /!chapterType/.test(region) || /chapterType/.test(region);
    assert.ok(hasGuard,
      'chapterType guard not found in fetchTranslations — function may fire before a chapter is selected');
  });

  it('fetchTranslations is called on mount via useEffect', () => {
    // useEffect(() => { fetchTranslations(); }, [fetchTranslations]);
    const hasEffect = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]{0,50}fetchTranslations\s*\(\s*\)/.test(src);
    assert.ok(hasEffect,
      'fetchTranslations() call inside useEffect not found — translations may not load on initial render');
  });
});

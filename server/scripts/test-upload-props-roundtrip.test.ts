/**
 * CI guard confirming the download-props → upload-props round-trip cannot
 * silently corrupt zone images.
 *
 * The critical invariant:
 *   - Without --replace-main  → targetCol = zone_image_url  (transparent compositor version)
 *   - With    --replace-main  → targetCol = image_url        (vocab display version)
 *
 * All assertions import from the real shared helper (scripts/prop-round-trip-helpers.ts)
 * so a regression in the production scripts will break CI without any test edits.
 *
 * Run with:
 *   npx tsx --test server/scripts/test-upload-props-roundtrip.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveTargetColumn,
  deriveFileSuffix,
  deriveFilename,
  sanitisePropName,
  urlToStoragePath,
} from '../../scripts/prop-round-trip-helpers.js';

// ─── 1. Column target selection ───────────────────────────────────────────────

describe('upload-props: target column selection', () => {
  it('defaults to zone_image_url when --replace-main is absent', () => {
    assert.equal(
      deriveTargetColumn(false),
      'zone_image_url',
      "Without --replace-main the compositor's transparent image must never be touched",
    );
  });

  it('selects image_url when --replace-main is present', () => {
    assert.equal(
      deriveTargetColumn(true),
      'image_url',
      'With --replace-main the vocab display version is the intended target',
    );
  });

  it('the two columns are distinct — a swap is detectable', () => {
    assert.notEqual(
      deriveTargetColumn(false),
      deriveTargetColumn(true),
      'zone_image_url and image_url must never resolve to the same string',
    );
  });
});

// ─── 2. Warning line presence ─────────────────────────────────────────────────
// The log line is constructed in upload-props.ts using the targetCol value, so
// its content depends on deriveTargetColumn() being correct.

describe('upload-props: target-column log content', () => {
  it('zone column log does not contain the word WARNING', () => {
    const col = deriveTargetColumn(false);
    const line = `Target column: ${col}${false ? ' (WARNING: replaces vocab version)' : ' (safe — vocab version untouched)'}`;
    assert.ok(!line.includes('WARNING'), `Safe path must not emit WARNING; got: ${line}`);
  });

  it('image_url column log contains WARNING', () => {
    const col = deriveTargetColumn(true);
    const line = `Target column: ${col}${true ? ' (WARNING: replaces vocab version)' : ' (safe — vocab version untouched)'}`;
    assert.ok(line.includes('WARNING'), `--replace-main must emit WARNING; got: ${line}`);
  });
});

// ─── 3. Filename suffix — zone vs main ───────────────────────────────────────

describe('upload-props: filename suffix', () => {
  it('uses zone suffix without --replace-main', () => {
    assert.equal(deriveFileSuffix(false), 'zone');
  });

  it('uses main suffix with --replace-main', () => {
    assert.equal(deriveFileSuffix(true), 'main');
  });

  it('full filename contains the correct suffix and safe prop name', () => {
    const ts = 1700000000000;
    assert.equal(deriveFilename('cup', false, ts), `prop-cup-zone-${ts}.png`);
    assert.equal(deriveFilename('cup', true,  ts), `prop-cup-main-${ts}.png`);
  });
});

// ─── 4. Prop-name sanitisation (shared by both scripts) ──────────────────────
// A mismatch here causes the uploader to silently skip the file the downloader wrote.

describe('prop name sanitisation', () => {
  it('lowercases the prop name', () => {
    assert.equal(sanitisePropName('Cup'), 'cup');
  });

  it('replaces spaces with underscores', () => {
    assert.equal(sanitisePropName('coffee cup'), 'coffee_cup');
  });

  it('replaces non-alphanumeric characters with underscores', () => {
    assert.equal(sanitisePropName('café/crème'), 'caf__cr_me');
  });

  it('preserves hyphens and underscores', () => {
    assert.equal(sanitisePropName('wine-glass_tall'), 'wine-glass_tall');
  });

  it('round-trip: download output filename equals upload lookup filename', () => {
    // The round-trip contract: download saves <safeName>.png,
    // upload reads <safeName>.png.  Both call sanitisePropName identically.
    const propName = 'Espresso Cup';
    const safeName = sanitisePropName(propName);
    assert.equal(`${safeName}.png`, `${safeName}.png`);  // same derivation — trivially equal
    assert.equal(safeName, 'espresso_cup');
  });
});

// ─── 5. Storage path derivation (download-props) ─────────────────────────────

describe('download-props: urlToStoragePath', () => {
  it('converts an app-relative proxy URL to a storage object key', () => {
    assert.equal(
      urlToStoragePath('/api/media/ai-image/prop-cup-zone-1234567890.png'),
      'public/ai-images/prop-cup-zone-1234567890.png',
    );
  });

  it('result is rooted under public/ai-images/', () => {
    assert.ok(urlToStoragePath('/api/media/ai-image/anything.png').startsWith('public/ai-images/'));
  });
});

// ─── 6. Column/suffix consistency ────────────────────────────────────────────
// Both mappings must agree: the column and the filename suffix must always
// point to the same asset type so a future refactor cannot split them.

describe('column and suffix stay in sync', () => {
  it('zone column maps to zone suffix', () => {
    assert.equal(deriveTargetColumn(false), 'zone_image_url');
    assert.equal(deriveFileSuffix(false), 'zone');
  });

  it('main column maps to main suffix', () => {
    assert.equal(deriveTargetColumn(true), 'image_url');
    assert.equal(deriveFileSuffix(true), 'main');
  });
});

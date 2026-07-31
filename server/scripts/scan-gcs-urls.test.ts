/**
 * Unit tests for tryNormalize() in scan-gcs-urls.ts
 *
 * Run with:
 *   npx tsx --test server/scripts/scan-gcs-urls.test.ts
 *
 * Uses Node.js built-in test runner (node:test) — no extra packages needed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tryNormalize } from './scan-gcs-urls.js';

// ---------------------------------------------------------------------------
// Pattern 1 — path-style (no query string)
// ---------------------------------------------------------------------------
describe('Pattern 1 — path-style URL', () => {
  it('normalises a basic path-style URL', () => {
    const url = 'https://storage.googleapis.com/my-bucket/public/ai-images/abc123.jpg';
    assert.equal(tryNormalize(url), '/api/media/ai-image/abc123.jpg');
  });

  it('normalises a path-style URL with subdirectory in filename', () => {
    const url = 'https://storage.googleapis.com/holahola-prod/public/ai-images/sub/img.png';
    assert.equal(tryNormalize(url), '/api/media/ai-image/sub/img.png');
  });
});

// ---------------------------------------------------------------------------
// Pattern 2 — path-style with signed query string
// ---------------------------------------------------------------------------
describe('Pattern 2 — path-style signed URL', () => {
  it('strips the signed query string', () => {
    const url =
      'https://storage.googleapis.com/my-bucket/public/ai-images/file.webp' +
      '?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=svc%40project.iam.gserviceaccount.com' +
      '&X-Goog-Date=20240101T000000Z&X-Goog-Expires=3600&X-Goog-Signature=deadbeef';
    assert.equal(tryNormalize(url), '/api/media/ai-image/file.webp');
  });

  it('strips a simple ?token=… query string', () => {
    const url =
      'https://storage.googleapis.com/bucket-x/public/ai-images/photo.jpg?token=abc';
    assert.equal(tryNormalize(url), '/api/media/ai-image/photo.jpg');
  });
});

// ---------------------------------------------------------------------------
// Pattern 3 — subdomain-style (no query string)
// ---------------------------------------------------------------------------
describe('Pattern 3 — subdomain-style URL', () => {
  it('normalises a subdomain-style URL', () => {
    const url = 'https://my-bucket.storage.googleapis.com/public/ai-images/scene.jpg';
    assert.equal(tryNormalize(url), '/api/media/ai-image/scene.jpg');
  });

  it('normalises a subdomain URL with hyphens in bucket name', () => {
    const url = 'https://hola-hola-prod.storage.googleapis.com/public/ai-images/env.png';
    assert.equal(tryNormalize(url), '/api/media/ai-image/env.png');
  });
});

// ---------------------------------------------------------------------------
// Pattern 4 — subdomain-style with signed query string
// ---------------------------------------------------------------------------
describe('Pattern 4 — subdomain-style signed URL', () => {
  it('strips signed query string from subdomain URL', () => {
    const url =
      'https://my-bucket.storage.googleapis.com/public/ai-images/avatar.jpg' +
      '?X-Goog-Signature=cafebabe&X-Goog-Expires=86400';
    assert.equal(tryNormalize(url), '/api/media/ai-image/avatar.jpg');
  });
});

// ---------------------------------------------------------------------------
// Edge cases — idempotency & non-matching inputs
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('returns the proxy URL unchanged when already normalised', () => {
    const url = '/api/media/ai-image/already-done.jpg';
    assert.equal(tryNormalize(url), url);
  });

  it('returns null for an empty string', () => {
    assert.equal(tryNormalize(''), null);
  });

  it('returns null for an unrelated external URL', () => {
    assert.equal(
      tryNormalize('https://cdn.example.com/images/photo.jpg'),
      null,
    );
  });

  it('returns null for a googleapis URL outside the ai-images path', () => {
    // Different path — not in public/ai-images, should not be auto-patched
    const url = 'https://storage.googleapis.com/my-bucket/private/other/file.jpg';
    assert.equal(tryNormalize(url), null);
  });

  it('returns null for a googleapis URL with no path segment', () => {
    const url = 'https://storage.googleapis.com/my-bucket/';
    assert.equal(tryNormalize(url), null);
  });

  it('handles a fragment (#) after the filename — strips it', () => {
    // The regex [^?#]+ will stop at '#', so the fragment is excluded
    const url = 'https://storage.googleapis.com/bucket/public/ai-images/img.jpg#section';
    assert.equal(tryNormalize(url), '/api/media/ai-image/img.jpg');
  });
});

// ---------------------------------------------------------------------------
// Unrecognised googleapis.com shapes — must return null so the scanner flags
// them for manual review rather than silently patching to an incorrect path.
// Each case below represents a shape that tryNormalize() cannot safely map.
// ---------------------------------------------------------------------------
describe('Unrecognised googleapis.com shapes → null (CI --strict guard)', () => {
  it('returns null for a path-style URL under a different object prefix', () => {
    // "media/" instead of "public/ai-images/" — not a known pattern
    const url = 'https://storage.googleapis.com/my-bucket/media/uploads/photo.jpg';
    assert.equal(tryNormalize(url), null);
  });

  it('returns null for a path-style URL under a private/ prefix', () => {
    const url = 'https://storage.googleapis.com/my-bucket/private/ai-images/secret.jpg';
    assert.equal(tryNormalize(url), null);
  });

  it('returns null for a path-style URL where "public" would be the bucket — no second /public/ segment', () => {
    // URL: storage.googleapis.com/public/ai-images/img.jpg
    // Pattern 1 regex needs /[bucket]/public/ai-images/<file>.
    // Here "public" is consumed as the bucket, leaving /ai-images/img.jpg
    // which does NOT start with /public/ai-images/ — so no pattern matches.
    const url = 'https://storage.googleapis.com/public/ai-images/img.jpg';
    assert.equal(tryNormalize(url), null);
  });

  it('returns null for a non-storage googleapis.com service URL', () => {
    // e.g. Fonts API — not a storage object at all
    const url = 'https://fonts.googleapis.com/css2?family=Inter';
    assert.equal(tryNormalize(url), null);
  });

  it('returns null for a googleapis.com URL with an unknown subdomain service', () => {
    // A hypothetical new GCS HTTPS endpoint with a different subdomain pattern
    const url = 'https://content-storage.googleapis.com/my-bucket/public/ai-images/img.jpg';
    assert.equal(tryNormalize(url), null);
  });

  it('returns null for a subdomain-style URL under a different object prefix', () => {
    // Same host pattern as Pattern 3/4 but path is not public/ai-images/
    const url = 'https://my-bucket.storage.googleapis.com/uploads/raw/file.jpg';
    assert.equal(tryNormalize(url), null);
  });

  it('returns null for a subdomain-style URL with a versioned prefix', () => {
    // e.g. a future migration to a /v2/ai-images/ prefix would be unrecognised
    const url = 'https://my-bucket.storage.googleapis.com/public/v2/ai-images/img.png';
    assert.equal(tryNormalize(url), null);
  });

  it('returns null for an authenticated googleapis.com download URL', () => {
    // OAuth-style download links use a completely different URL structure
    const url = 'https://www.googleapis.com/download/storage/v1/b/my-bucket/o/file.jpg?alt=media';
    assert.equal(tryNormalize(url), null);
  });
});

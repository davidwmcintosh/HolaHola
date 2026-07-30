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

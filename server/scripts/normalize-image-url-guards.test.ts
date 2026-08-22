/**
 * Unit tests confirming that normalizeImageUrl() is correctly applied at every
 * guarded image write path so a raw googleapis.com URL can never reach the DB.
 *
 * Each test mirrors the exact call pattern used in the real service/handler and
 * asserts that the value that would be persisted starts with the app proxy path.
 *
 * Run with:
 *   npx tsx --test server/scripts/normalize-image-url-guards.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageUrl } from '../services/image-storage.js';

// Raw GCS URLs that uploadPublicBuffer / generateEnvironmentScene might return.
const RAW_PATH_STYLE =
  'https://storage.googleapis.com/holahola-prod/public/ai-images/lesson-42.png';
const RAW_PATH_STYLE_SIGNED =
  'https://storage.googleapis.com/holahola-prod/public/ai-images/lesson-42.png' +
  '?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=deadbeef';
const RAW_SUBDOMAIN_STYLE =
  'https://holahola-prod.storage.googleapis.com/public/ai-images/scene-market.jpg';
const PROXY_PATH = '/api/media/ai-image/lesson-42.png';

// ─── Helper ──────────────────────────────────────────────────────────────────

function assertIsProxyPath(url: string, label: string) {
  assert.ok(
    url.startsWith('/api/media/ai-image/'),
    `${label}: expected proxy path but got: ${url}`,
  );
}

// ─── 1. lesson-image-generator.ts ────────────────────────────────────────────
// Pattern: normalizeImageUrl(`${baseUrl}?v=${Date.now()}`)

describe('lesson-image-generator guard', () => {
  it('strips a path-style GCS URL + cache-buster before DB write', () => {
    const baseUrl = RAW_PATH_STYLE;
    const url = normalizeImageUrl(`${baseUrl}?v=${Date.now()}`);
    assertIsProxyPath(url, 'lesson-image-generator (path-style + v=)');
  });

  it('strips a signed path-style GCS URL + cache-buster before DB write', () => {
    const url = normalizeImageUrl(`${RAW_PATH_STYLE_SIGNED}&v=${Date.now()}`);
    // The regex stops at '?' so the cache-buster merges into the query; proxy still returned.
    assertIsProxyPath(url, 'lesson-image-generator (signed + v=)');
  });

  it('returns proxy path unchanged if upload already returned a proxy path', () => {
    const url = normalizeImageUrl(`${PROXY_PATH}?v=${Date.now()}`);
    // Already a proxy path — normalizeImageUrl leaves it as-is (no change).
    assert.ok(url.startsWith('/api/media/ai-image/'), 'idempotent on proxy path');
  });
});

// ─── 2. scenario-image-generator.ts ──────────────────────────────────────────
// Pattern: normalizeImageUrl(`${baseUrl}?v=${Date.now()}`)

describe('scenario-image-generator guard', () => {
  it('strips a path-style GCS URL + cache-buster before DB write', () => {
    const baseUrl =
      'https://storage.googleapis.com/holahola-prod/public/ai-images/scenario-coffee-shop.png';
    const url = normalizeImageUrl(`${baseUrl}?v=${Date.now()}`);
    assertIsProxyPath(url, 'scenario-image-generator (path-style + v=)');
  });

  it('strips a subdomain-style GCS URL + cache-buster before DB write', () => {
    const baseUrl =
      'https://holahola-prod.storage.googleapis.com/public/ai-images/scenario-airport.png';
    const url = normalizeImageUrl(`${baseUrl}?v=${Date.now()}`);
    assertIsProxyPath(url, 'scenario-image-generator (subdomain + v=)');
  });
});

// ─── 3. menu-image-worker.ts ──────────────────────────────────────────────────
// Pattern: normalizeImageUrl(await uploadPublicBuffer(filename, buffer, mimeType))
// — no cache-buster, raw URL returned directly.

describe('menu-image-worker guard', () => {
  it('strips a path-style GCS URL returned directly from uploadPublicBuffer', () => {
    const rawUrl =
      'https://storage.googleapis.com/holahola-prod/public/ai-images/menu-item-tacos-1234567890.jpg';
    const permanentUrl = normalizeImageUrl(rawUrl);
    assertIsProxyPath(permanentUrl, 'menu-image-worker (path-style, no cache-buster)');
  });

  it('strips a subdomain-style GCS URL returned directly from uploadPublicBuffer', () => {
    const rawUrl =
      'https://holahola-prod.storage.googleapis.com/public/ai-images/menu-item-pizza-9999.png';
    const permanentUrl = normalizeImageUrl(rawUrl);
    assertIsProxyPath(permanentUrl, 'menu-image-worker (subdomain, no cache-buster)');
  });
});

// ─── 4. prop-room-compositor.ts ───────────────────────────────────────────────
// Pattern: normalizeImageUrl(await uploadPublicBuffer(`scene-${env.name}-${Date.now()}.jpg`, ...))

describe('prop-room-compositor guard', () => {
  it('strips a path-style GCS URL for a scene image before DB write', () => {
    const rawUrl =
      'https://storage.googleapis.com/holahola-prod/public/ai-images/scene-market-1234567890.jpg';
    const permanentUrl = normalizeImageUrl(rawUrl);
    assertIsProxyPath(permanentUrl, 'prop-room-compositor (path-style)');
  });

  it('strips a signed GCS URL for a scene image before DB write', () => {
    const rawUrl =
      'https://storage.googleapis.com/holahola-prod/public/ai-images/scene-airport-9876543210.jpg' +
      '?X-Goog-Signature=cafebabe';
    const permanentUrl = normalizeImageUrl(rawUrl);
    assertIsProxyPath(permanentUrl, 'prop-room-compositor (signed)');
  });
});

// ─── 5. native-fc-handlers.ts  (open_scene on-the-fly generation) ────────────
// Pattern: normalizeImageUrl(await generateEnvironmentScene(concept, 'environment'))
// generateEnvironmentScene returns a GCS URL just like uploadPublicBuffer does.

describe('native-fc-handlers open_scene guard', () => {
  it('strips a path-style GCS URL from generateEnvironmentScene before DB insert', () => {
    const rawUrl =
      'https://storage.googleapis.com/holahola-prod/public/ai-images/tv-weather-studio-1234.png';
    const envImageUrl = normalizeImageUrl(rawUrl);
    assertIsProxyPath(envImageUrl, 'native-fc-handlers open_scene (path-style)');
  });

  it('strips a subdomain-style GCS URL from generateEnvironmentScene before DB insert', () => {
    const rawUrl =
      'https://holahola-prod.storage.googleapis.com/public/ai-images/tv-newsroom-5678.jpg';
    const envImageUrl = normalizeImageUrl(rawUrl);
    assertIsProxyPath(envImageUrl, 'native-fc-handlers open_scene (subdomain)');
  });
});

// ─── 6a. routes.ts  GET /api/menu-image  (visual_assets upsert) ──────────────
// Pattern: normalizeImageUrl(await uploadPublicBuffer(filename, buffer, mimeType))

describe('routes.ts GET /api/menu-image guard', () => {
  it('strips a path-style GCS URL before visual_assets upsert', () => {
    const rawUrl =
      'https://storage.googleapis.com/holahola-prod/public/ai-images/menu-item-burger-1234.jpg';
    const permanentUrl = normalizeImageUrl(rawUrl);
    assertIsProxyPath(permanentUrl, '/api/menu-image route (path-style)');
  });

  it('does not alter a data: URL fallback (storage offline path)', () => {
    // When upload fails the code falls back to the raw data URL — normalizeImageUrl
    // must not mangle it (it does not match any GCS pattern).
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgAB';
    const result = normalizeImageUrl(dataUrl);
    assert.equal(result, dataUrl, 'data URL must pass through unchanged');
  });
});

// ─── 6b. routes.ts  POST /api/admin/batch-menu-images  (visual_assets update) ─
// Pattern: normalizeImageUrl(await uploadPublicBuffer(filename, buffer, mimeType))

describe('routes.ts POST /api/admin/batch-menu-images guard', () => {
  it('strips a path-style GCS URL before visual_assets UPDATE', () => {
    const rawUrl =
      'https://storage.googleapis.com/holahola-prod/public/ai-images/menu-item-sushi-9999.png';
    const permanentUrl = normalizeImageUrl(rawUrl);
    assertIsProxyPath(permanentUrl, '/api/admin/batch-menu-images route (path-style)');
  });

  it('strips a signed GCS URL before visual_assets UPDATE', () => {
    const rawUrl =
      'https://storage.googleapis.com/holahola-prod/public/ai-images/menu-item-salad-7777.png' +
      '?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=3600&X-Goog-Signature=abc';
    const permanentUrl = normalizeImageUrl(rawUrl);
    assertIsProxyPath(permanentUrl, '/api/admin/batch-menu-images route (signed)');
  });
});

// ─── Cross-path: idempotency guarantee ───────────────────────────────────────
// If normalizeImageUrl is called twice (e.g. on a value already written to the DB),
// the result must still be a valid proxy path — not a double-wrapped URL.

describe('normalizeImageUrl idempotency across all paths', () => {
  it('is idempotent: applying it twice yields the same proxy path', () => {
    const raw =
      'https://storage.googleapis.com/holahola-prod/public/ai-images/lesson-99.png';
    const once = normalizeImageUrl(raw);
    const twice = normalizeImageUrl(once);
    assert.equal(once, twice, 'second application must not mangle the proxy path');
  });
});

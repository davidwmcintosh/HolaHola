/**
 * Integration tests: image_vision_cache URL normalisation cache-hit round-trip.
 *
 * After the backfill (backfill-image-vision-cache-urls.ts, task #229) all rows in
 * image_vision_cache are stored under the normalised /api/media/ai-image/ proxy URL.
 * getCachedDescription() therefore uses a single-key equality lookup:
 *
 *   SELECT description FROM image_vision_cache WHERE image_url = ${normUrl}
 *
 * normalizeImageUrl() is called in getImageVision() before every lookup, so the
 * cache hit works regardless of whether the caller had a raw GCS URL or an already-
 * normalised proxy URL.
 *
 * Test groups:
 *
 *   A) Via getImageVision() — the real production entry point.
 *      Input is a proxy URL (the only form isAiGeneratedImage() admits).
 *      Confirms the cache-hit path returns mode:'cached_description' without
 *      making any Gemini / network calls.
 *
 *   B) Via getCachedDescription() — the exported single-key SQL helper.
 *      Verifies the lookup contract directly: proxy-URL row found by proxy-URL key,
 *      and that normalizeImageUrl() maps any GCS form to the same key so the
 *      normalisation chain reaches the right row.
 *
 *   C) Pure: normalizeImageUrl() converts every GCS URL form to the canonical proxy
 *      path so the right key reaches the SQL in the first place.
 *
 * Run with:
 *   npx tsx --test server/__tests__/image-vision-cache-url-normalisation.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { getUserDb } from '../db';
import { normalizeImageUrl } from '../services/image-storage';
import { getImageVision, getCachedDescription } from '../services/image-vision-service';
import type { StreamingSession } from '../services/streaming-session-types';

// ── Fixture URLs ──────────────────────────────────────────────────────────────

/** Filename unlikely to collide with any production row. */
const FIXTURE_FILE = 'test-url-norm-roundtrip-fixture-xk9q2.png';

const RAW_GCS_PATH_STYLE =
  `https://storage.googleapis.com/holahola-prod/public/ai-images/${FIXTURE_FILE}`;

const RAW_GCS_SIGNED =
  `https://storage.googleapis.com/holahola-prod/public/ai-images/${FIXTURE_FILE}` +
  '?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=3600&X-Goog-Signature=deadbeef00';

const RAW_GCS_SUBDOMAIN =
  `https://holahola-prod.storage.googleapis.com/public/ai-images/${FIXTURE_FILE}`;

/** Canonical form — what normalizeImageUrl produces and what all rows are stored under. */
const PROXY_URL = `/api/media/ai-image/${FIXTURE_FILE}`;

// Sanity-check the fixture itself.
assert.equal(
  normalizeImageUrl(RAW_GCS_PATH_STYLE),
  PROXY_URL,
  'Fixture: normalizeImageUrl(RAW_GCS_PATH_STYLE) must equal PROXY_URL',
);

// ── Minimal StreamingSession stub ─────────────────────────────────────────────
// getImageVision() only reads session.seenImageUrls and session.conversationId.

function makeSession(): StreamingSession {
  return {
    conversationId: 'test-conv-url-norm',
    seenImageUrls: new Set(),
  } as unknown as StreamingSession;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function insertCacheRow(imageUrl: string, description: string): Promise<void> {
  const db = getUserDb();
  await db.execute(sql`
    INSERT INTO image_vision_cache (id, image_url, description, mime_type)
    VALUES (gen_random_uuid(), ${imageUrl}, ${description}, 'image/png')
    ON CONFLICT (image_url) DO UPDATE SET description = EXCLUDED.description
  `);
}

async function deleteFixtureRows(): Promise<void> {
  const db = getUserDb();
  await db.execute(sql`
    DELETE FROM image_vision_cache
    WHERE image_url = ${PROXY_URL}
  `);
}

// ── Group A: via getImageVision() ─────────────────────────────────────────────
// getImageVision() normalises the URL then calls getCachedDescription(normUrl).
// A seeded proxy-URL row must be found and returned as mode:'cached_description'
// without making any Gemini / network calls.

describe('A — getImageVision(): cache hit via proxy URL (production entry point)', () => {
  before(deleteFixtureRows);
  after(deleteFixtureRows);

  it('returns mode:cached_description when the cache has a row stored under the proxy URL', async () => {
    await insertCacheRow(PROXY_URL, 'A fluffy gray cat with bright green eyes');

    const session = makeSession();
    const result = await getImageVision(PROXY_URL, 'fallback-label', session);

    assert.equal(
      result.mode,
      'cached_description',
      'getImageVision must use the cached row without making Gemini calls',
    );
    assert.equal(
      result.description,
      'A fluffy gray cat with bright green eyes',
      'description must come from the cache, not the fallback label',
    );
    assert.equal(
      result.inlineData,
      undefined,
      'no inlineData when serving from cache (no bytes fetched)',
    );
  });

  it('adds the proxy URL to session.seenImageUrls after a cache hit', async () => {
    await insertCacheRow(PROXY_URL, 'A wooden market stall with red tomatoes');

    const session = makeSession();
    await getImageVision(PROXY_URL, 'fallback', session);

    assert.ok(
      session.seenImageUrls?.has(PROXY_URL),
      'session.seenImageUrls must contain PROXY_URL after a cache hit so the session-reference gate fires on repeat',
    );
  });

  it('returns mode:session_reference on a second call for the same URL', async () => {
    await insertCacheRow(PROXY_URL, 'A sunny rooftop terrace with potted plants');

    const session = makeSession();
    await getImageVision(PROXY_URL, 'fallback', session);   // first → cached_description
    const second = await getImageVision(PROXY_URL, 'fallback', session);   // second

    assert.equal(
      second.mode,
      'session_reference',
      'second call with the same URL in the same session must short-circuit via seenImageUrls',
    );
  });
});

// ── Group B: via getCachedDescription() ───────────────────────────────────────
// Tests the single-key SQL lookup directly.
// The key invariant: normalizeImageUrl() maps every GCS URL form to the same
// PROXY_URL, so getCachedDescription(normalizeImageUrl(anyGCSForm)) finds the row
// regardless of what URL the caller originally had.

describe('B — getCachedDescription(): single-key proxy lookup contract', () => {
  before(deleteFixtureRows);
  after(deleteFixtureRows);

  it('finds a proxy-keyed row when looked up by the proxy URL (normalised key)', async () => {
    await insertCacheRow(PROXY_URL, 'A red bicycle leaning against a stone wall');

    const description = await getCachedDescription(PROXY_URL);

    assert.equal(
      description,
      'A red bicycle leaning against a stone wall',
      'getCachedDescription must find a row stored under the proxy URL',
    );

    await deleteFixtureRows();
  });

  it('finds the same row when the caller normalises a path-style GCS URL first', async () => {
    // Simulates the full pipeline: caller has a GCS URL → normalizeImageUrl → getCachedDescription.
    await insertCacheRow(PROXY_URL, 'A mountain lake at dawn with mist');

    const normUrl = normalizeImageUrl(RAW_GCS_PATH_STYLE);
    // normUrl must equal PROXY_URL — checked by the fixture assertion at the top.
    const description = await getCachedDescription(normUrl);

    assert.equal(
      description,
      'A mountain lake at dawn with mist',
      'normalizeImageUrl(GCS_PATH_STYLE) must produce the key that finds the cache row',
    );

    await deleteFixtureRows();
  });

  it('finds the same row when the caller normalises a subdomain-style GCS URL first', async () => {
    await insertCacheRow(PROXY_URL, 'A colorful parrot on a wooden perch');

    const normUrl = normalizeImageUrl(RAW_GCS_SUBDOMAIN);
    const description = await getCachedDescription(normUrl);

    assert.equal(
      description,
      'A colorful parrot on a wooden perch',
      'normalizeImageUrl(GCS_SUBDOMAIN) must produce the key that finds the cache row',
    );

    await deleteFixtureRows();
  });

  it('returns null when no row is present in the cache', async () => {
    // Table is clean after previous deletes.
    const description = await getCachedDescription(PROXY_URL);
    assert.strictEqual(description, null, 'must return null on a genuine cache miss');
  });
});

// ── Group C: pure normalizeImageUrl() coverage ────────────────────────────────
// Confirms the right normUrl is computed before it reaches the SQL.

describe('C — normalizeImageUrl(): GCS → proxy conversion (pure)', () => {
  it('converts a path-style GCS URL to the proxy path', () => {
    assert.equal(normalizeImageUrl(RAW_GCS_PATH_STYLE), PROXY_URL);
  });

  it('strips the query-string from a signed path-style GCS URL', () => {
    assert.equal(
      normalizeImageUrl(RAW_GCS_SIGNED),
      PROXY_URL,
      'signed URL query string must be stripped',
    );
  });

  it('converts a subdomain-style GCS URL to the proxy path', () => {
    assert.equal(normalizeImageUrl(RAW_GCS_SUBDOMAIN), PROXY_URL);
  });

  it('leaves the proxy URL unchanged (idempotent)', () => {
    assert.equal(normalizeImageUrl(PROXY_URL), PROXY_URL);
  });
});

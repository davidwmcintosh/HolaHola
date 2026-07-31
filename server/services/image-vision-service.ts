/**
 * Image Vision Service
 *
 * Gives Daniela the ability to SEE images she shows to students.
 *
 * Two-tier system:
 *   Tier 1 — Structural text: always included, free, instant.
 *             For scenes: full canvas state with prop positions and auto-spread notices.
 *             For vocab images: word + description metadata.
 *   Tier 2 — Actual vision: image bytes sent as inlineData to Gemini Live.
 *             First time a URL is shown this session → fetch bytes → inlineData.
 *             Same URL seen again this session → skip bytes (already in Gemini's context).
 *             URL seen in a prior session → use persistent description cache (text only).
 *
 * Cost: ~258 tokens per image at Gemini Flash pricing = ~$0.00002 each.
 * Context: images accumulate in session context window; dedup prevents re-sending.
 */

import type { StreamingSession } from './streaming-session-types';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { normalizeImageUrl } from './image-storage';

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface VisionResult {
  description: string;
  inlineData?: { mimeType: string; data: string };
  mode: 'bytes' | 'cached_description' | 'session_reference' | 'error';
}

function detectMimeType(url: string, contentType?: string | null): string {
  if (contentType) {
    const ct = contentType.split(';')[0].trim().toLowerCase();
    if (ct.startsWith('image/')) return ct;
  }
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative URL — resolve against the app's own base URL for server-side fetch
  const base = (process.env.APP_URL || 'http://localhost:5000').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function fetchImageBytes(url: string): Promise<{ data: string; mimeType: string }> {
  const absoluteUrl = resolveUrl(url);
  const response = await fetch(absoluteUrl, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'HolaHola-Vision/1.0' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching image bytes`);
  }
  const mimeType = detectMimeType(url, response.headers.get('content-type'));
  const buffer = await response.arrayBuffer();
  const data = Buffer.from(buffer).toString('base64');
  return { data, mimeType };
}

/**
 * Look up a cached description by URL.
 *
 * @param normUrl - The normalised proxy URL (/api/media/ai-image/…) — used for new rows.
 * @param rawUrl  - The original URL as supplied by the caller (may be a raw GCS URL for
 *                  legacy rows that pre-date URL normalisation).  When the two are equal
 *                  (already normalised) the IN () degenerates to a single-value lookup.
 */
async function getCachedDescription(normUrl: string, rawUrl: string): Promise<string | null> {
  try {
    const db = getUserDb();
    // Query both keys so old GCS-keyed rows are found even when new code passes proxy URLs.
    const result = await db.execute(sql`
      SELECT description FROM image_vision_cache
      WHERE image_url IN (${normUrl}, ${rawUrl})
      LIMIT 1
    `);
    const row = result.rows[0] as any;
    if (row?.description) {
      db.execute(sql`
        UPDATE image_vision_cache SET last_used_at = NOW()
        WHERE image_url IN (${normUrl}, ${rawUrl})
      `).catch(() => {});
      return row.description as string;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Call Gemini REST with the actual image bytes to generate a rich visual description.
 * This is what gets stored in the cache so Daniela gets real detail on future sessions
 * ("a fluffy gray cat with small stripes") rather than just the word label.
 */
async function generateVisionDescription(
  data: string,
  mimeType: string,
  fallbackDescription: string,
): Promise<string> {
  try {
    const result = await gemini.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data } },
          {
            text: `Context: this image is being used to teach the vocabulary item "${fallbackDescription}". Describe what is literally visible in the image in one concise sentence. Focus on specific visual details — colors, textures, appearance, action, setting — that make this image distinctive. Do not simply repeat the word label; describe what a viewer would actually see. Example: "A fluffy gray tabby cat sitting on a wooden floor, looking up at the camera with bright green eyes."`,
          },
        ],
      }],
    });
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || fallbackDescription;
  } catch (err: any) {
    console.warn('[ImageVision] generateVisionDescription failed:', err.message);
    return fallbackDescription;
  }
}

/**
 * Generates a real visual description from the image bytes and stores it in the cache.
 * Returns the generated description string so callers can race it against a timeout
 * and use the real description immediately on the first session rather than falling
 * back to the bare word label.
 */
async function generateAndStoreCachedDescription(
  imageUrl: string,
  data: string,
  mimeType: string,
  fallbackDescription: string,
  sourceConversationId?: string | null,
): Promise<string> {
  const description = await generateVisionDescription(data, mimeType, fallbackDescription);
  await storeCachedDescription(imageUrl, description, mimeType, sourceConversationId);
  return description;
}

async function storeCachedDescription(
  imageUrl: string,
  description: string,
  mimeType: string,
  sourceConversationId?: string | null,
): Promise<void> {
  try {
    const db = getUserDb();
    // Always store under the normalised proxy URL so future lookups (which also
    // normalise) hit the row regardless of whether the caller passed a raw GCS URL.
    const normUrl = normalizeImageUrl(imageUrl);
    await db.execute(sql`
      INSERT INTO image_vision_cache (id, image_url, description, mime_type, source_conversation_id)
      VALUES (gen_random_uuid(), ${normUrl}, ${description}, ${mimeType}, ${sourceConversationId ?? null})
      ON CONFLICT (image_url) DO UPDATE SET
        description = EXCLUDED.description,
        source_conversation_id = COALESCE(image_vision_cache.source_conversation_id, EXCLUDED.source_conversation_id),
        last_used_at = NOW()
    `);
  } catch (err: any) {
    console.error('[ImageVisionCache] Store error:', err.message);
  }
}

/**
 * Returns true if the URL is an AI-generated image from our own media pipeline.
 * Stock photos (Unsplash, Picsum, etc.) are excluded — they are not vision-cached
 * or linked to conversation memory.
 */
function isAiGeneratedImage(url: string): boolean {
  return url.includes('/api/media/');
}

export async function getImageVision(
  imageUrl: string,
  fallbackDescription: string,
  session: StreamingSession,
): Promise<VisionResult> {
  if (!imageUrl) {
    return { description: fallbackDescription, mode: 'error' };
  }

  // Only AI-generated images enter the vision cache and memory anchor pipeline.
  // Stock photos (Unsplash, Picsum, etc.) short-circuit here.
  if (!isAiGeneratedImage(imageUrl)) {
    return { description: fallbackDescription, mode: 'error' };
  }

  // Normalise early so all downstream checks and stores use the canonical proxy URL.
  const normUrl = normalizeImageUrl(imageUrl);

  // 1. Session-level cache: already sent as inlineData this session — Gemini has it in context
  if (session.seenImageUrls?.has(normUrl)) {
    return { description: fallbackDescription, mode: 'session_reference' };
  }

  // 2. Persistent cache: described in a prior session — use text, no byte fetch needed.
  // Pass both the normalised URL and the original raw URL so legacy GCS-keyed rows are found.
  const cached = await getCachedDescription(normUrl, imageUrl);
  if (cached) {
    if (!session.seenImageUrls) session.seenImageUrls = new Set();
    session.seenImageUrls.add(normUrl);
    return { description: cached, mode: 'cached_description' };
  }

  // 3. First time ever: fetch bytes → try to get a real description within 3s.
  // If Gemini responds in time, Daniela gets the rich detail on the very first session.
  // If it times out, fall back to the word label and store the description in the background
  // so future sessions benefit from it.
  try {
    const { data, mimeType } = await fetchImageBytes(normUrl);
    if (!session.seenImageUrls) session.seenImageUrls = new Set();
    session.seenImageUrls.add(normUrl);

    let descriptionToUse = fallbackDescription;
    const sourceConversationId = session.conversationId ?? null;
    const descriptionPromise = generateAndStoreCachedDescription(normUrl, data, mimeType, fallbackDescription, sourceConversationId);
    try {
      const raceResult = await Promise.race([
        descriptionPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (raceResult) descriptionToUse = raceResult;
    } catch {
      // Generation failed — background promise already handles its own errors
      descriptionPromise.catch(() => {});
    }
    // If the race timed out, the promise still runs in the background and caches the result
    descriptionPromise.catch(() => {});

    return { description: descriptionToUse, inlineData: { mimeType, data }, mode: 'bytes' };
  } catch (err: any) {
    console.error(`[ImageVisionCache] Fetch error for ${normUrl}:`, err.message);
    // Still anchor to conversation — future introspect can find this image by conversation
    // even without byte-level vision. The description will be the fallback word/label.
    const sourceConversationId = session.conversationId ?? null;
    if (sourceConversationId) {
      storeCachedDescription(normUrl, fallbackDescription, 'image/jpeg', sourceConversationId)
        .catch(() => {});
    }
    return { description: fallbackDescription, mode: 'error' };
  }
}

/**
 * Build Tier-1 structural scene state text.
 * Always accurate, always free — tells Daniela exactly where everything is on the canvas,
 * including auto-spread repositioning notices.
 */
export function buildSceneStateText(
  sceneCanvas: any,
  options?: {
    action?: string;
    autoSpreadProp?: string;
    requestedPos?: string;
    finalPos?: string;
  },
): string {
  if (!sceneCanvas) {
    return options?.action ? `${options.action} — no active scene.` : 'No active scene.';
  }

  const env =
    sceneCanvas.environmentLabel ||
    (sceneCanvas.environment || '').replace(/_/g, ' ');
  const props = (sceneCanvas.props || []) as Array<{
    name: string;
    label?: string;
    nativeLabel?: string;
    state?: string;
    vocab?: { word: string; translation: string }[];
    position: string;
    cx: number;
    cy: number;
    scale: number;
    rotate?: number;
    flipH?: boolean;
    z?: number;
  }>;

  const lines: string[] = [];
  if (options?.action) lines.push(options.action);
  lines.push(`Scene: ${env}`);

  if (props.length === 0) {
    lines.push('Canvas: empty (no props yet)');
  } else {
    lines.push(`Props on canvas (${props.length}):`);
    for (const p of props) {
      let propLine = `  • ${p.name}`;
      if (p.label && p.label !== p.name) propLine += ` (${p.label}`;
      if (p.nativeLabel) propLine += p.label && p.label !== p.name ? ` / ${p.nativeLabel})` : ` (${p.nativeLabel})`;
      else if (p.label && p.label !== p.name) propLine += ')';
      propLine += ` @ ${p.position}`;
      const extras: string[] = [];
      if (p.state) extras.push(`state: ${p.state}`);
      if (p.rotate && p.rotate !== 0) extras.push(`rotated ${p.rotate}°`);
      if (p.flipH) extras.push('flipped');
      if (p.z !== undefined && p.z !== 5) extras.push(`z=${p.z}`);
      if (extras.length) propLine += ` [${extras.join(', ')}]`;
      if (p.vocab?.length) {
        propLine += ` — vocab: ${p.vocab.map(v => v.word).join(', ')}`;
      }
      lines.push(propLine);
    }
  }

  if (
    options?.autoSpreadProp &&
    options?.requestedPos &&
    options?.finalPos &&
    options.requestedPos !== options.finalPos
  ) {
    lines.push(
      `⚠ "${options.autoSpreadProp}" auto-repositioned from ${options.requestedPos} → ${options.finalPos} (avoiding overlap with existing prop)`,
    );
  }

  lines.push('(Use add_to_scene, remove_from_scene, move_in_scene, or set_clock to update the canvas.)');
  return lines.join('\n');
}

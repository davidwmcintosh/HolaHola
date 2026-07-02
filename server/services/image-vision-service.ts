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

async function getCachedDescription(imageUrl: string): Promise<string | null> {
  try {
    const db = getUserDb();
    const result = await db.execute(sql`
      SELECT description FROM image_vision_cache WHERE image_url = ${imageUrl} LIMIT 1
    `);
    const row = result.rows[0] as any;
    if (row?.description) {
      db.execute(sql`
        UPDATE image_vision_cache SET last_used_at = NOW() WHERE image_url = ${imageUrl}
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
            text: 'Describe what you literally see in this image in one concise sentence. Focus on specific visual details: colors, textures, appearance, action, or setting. Do not name a word category or include a translation. Example format: "A fluffy gray tabby cat sitting on a wooden floor, looking up at the camera with bright green eyes."',
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
 * Called asynchronously (fire-and-forget) after the first byte fetch — does not block
 * the tool response. Future sessions will receive the rich description instead of the label.
 */
async function generateAndStoreCachedDescription(
  imageUrl: string,
  data: string,
  mimeType: string,
  fallbackDescription: string,
): Promise<void> {
  const description = await generateVisionDescription(data, mimeType, fallbackDescription);
  await storeCachedDescription(imageUrl, description, mimeType);
}

async function storeCachedDescription(
  imageUrl: string,
  description: string,
  mimeType: string,
): Promise<void> {
  try {
    const db = getUserDb();
    await db.execute(sql`
      INSERT INTO image_vision_cache (id, image_url, description, mime_type)
      VALUES (gen_random_uuid(), ${imageUrl}, ${description}, ${mimeType})
      ON CONFLICT (image_url) DO UPDATE SET
        description = EXCLUDED.description,
        last_used_at = NOW()
    `);
  } catch (err: any) {
    console.error('[ImageVisionCache] Store error:', err.message);
  }
}

/**
 * Get vision data for an image URL.
 * Returns inlineData (bytes) the first time, text description thereafter.
 */
export async function getImageVision(
  imageUrl: string,
  fallbackDescription: string,
  session: StreamingSession,
): Promise<VisionResult> {
  if (!imageUrl) {
    return { description: fallbackDescription, mode: 'error' };
  }

  // 1. Session-level cache: already sent as inlineData this session — Gemini has it in context
  if (session.seenImageUrls?.has(imageUrl)) {
    return { description: fallbackDescription, mode: 'session_reference' };
  }

  // 2. Persistent cache: described in a prior session — use text, no byte fetch needed
  const cached = await getCachedDescription(imageUrl);
  if (cached) {
    if (!session.seenImageUrls) session.seenImageUrls = new Set();
    session.seenImageUrls.add(imageUrl);
    return { description: cached, mode: 'cached_description' };
  }

  // 3. First time ever: fetch bytes → send as inlineData → cache description for future
  try {
    const { data, mimeType } = await fetchImageBytes(imageUrl);
    if (!session.seenImageUrls) session.seenImageUrls = new Set();
    session.seenImageUrls.add(imageUrl);
    // Generate a real visual description from the image bytes and cache it asynchronously.
    // Future sessions will receive this rich description ("a fluffy gray cat with small stripes")
    // instead of the bare word label. Does not block the current tool response.
    generateAndStoreCachedDescription(imageUrl, data, mimeType, fallbackDescription).catch(() => {});
    return { description: fallbackDescription, inlineData: { mimeType, data }, mode: 'bytes' };
  } catch (err: any) {
    console.error(`[ImageVisionCache] Fetch error for ${imageUrl}:`, err.message);
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

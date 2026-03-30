/**
 * Prop Room Compositor
 *
 * Composites pre-defined transparent object assets onto base environment
 * scenes using Sharp. This is the core engine behind compose_visual_scene.
 *
 * Three-tier resolution:
 *   1. Pre-composed template in visual_compositions (instant, cache hit)
 *   2. Dynamic composition from visual_environments + visual_assets (fast, <1s)
 *   3. Fallback to DALL-E generation (slow, $0.04-0.08, but always works)
 */

import sharp from 'sharp';
import crypto from 'crypto';
import OpenAI from 'openai';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { uploadPublicBuffer } from './image-storage';

function getDallEClient(): OpenAI | null {
  const key = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjectPlacement {
  term: string;
  position?: string;
  emphasis?: boolean;
}

export interface ComposeRequest {
  environment: string;
  objects: ObjectPlacement[];
  preposition_context?: string;
  language?: string;
}

export interface ComposeResult {
  success: boolean;
  imageUrl?: string;
  source: 'pre_composed' | 'dynamic_composition' | 'fallback_needed' | 'error';
  cacheHit: boolean;
  missingAssets?: string[];
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Position presets (normalized 0-1 of base image dimensions)
// ─────────────────────────────────────────────────────────────────────────────

// Base scale = fraction of scene width for a "medium" object.
// TYPE_SCALE (below) multiplies this based on how big/small the object type actually is.
const POSITION_MAP: Record<string, { cx: number; cy: number; scale: number }> = {
  center:        { cx: 0.50, cy: 0.65, scale: 0.20 },
  left:          { cx: 0.25, cy: 0.68, scale: 0.16 },
  right:         { cx: 0.75, cy: 0.68, scale: 0.16 },
  foreground:    { cx: 0.50, cy: 0.82, scale: 0.28 },
  background:    { cx: 0.50, cy: 0.35, scale: 0.12 },
  on_table:      { cx: 0.50, cy: 0.70, scale: 0.14 }, // table surface — lower in frame
  under_table:   { cx: 0.38, cy: 0.84, scale: 0.18 }, // floor below table, offset left so visible
  on_floor:      { cx: 0.50, cy: 0.87, scale: 0.22 },
  beside_bed:    { cx: 0.72, cy: 0.74, scale: 0.14 },
  on_counter:    { cx: 0.52, cy: 0.68, scale: 0.14 },
  under_counter: { cx: 0.45, cy: 0.84, scale: 0.12 },
  in_hand:       { cx: 0.50, cy: 0.62, scale: 0.12 },
  on_chair:      { cx: 0.50, cy: 0.74, scale: 0.14 },
  beside_table:  { cx: 0.70, cy: 0.80, scale: 0.14 },
};

const DEFAULT_POSITION = POSITION_MAP.center;

// Valid positions per environment.
// Positions NOT listed here will be silently remapped to the best available fallback.
// Update this whenever a new background is added — a wrong placement is worse than a fallback to center.
const ENV_VALID_POSITIONS: Record<string, string[]> = {
  cafe:           ['center','left','right','foreground','background','on_table','under_table','beside_table','on_chair','on_floor','on_counter'],
  restaurant_table:['center','left','right','on_table','under_table','beside_table','on_chair','on_floor'],
  hotel_lobby:    ['center','left','right','foreground','background','on_floor','on_counter','beside_table','on_chair'],
  kitchen:        ['center','left','right','on_counter','under_counter','on_table','on_floor'],
  living_room:    ['center','left','right','foreground','background','on_table','beside_table','on_chair','on_floor'],
  bedroom:        ['center','left','right','beside_bed','on_table','on_chair','on_floor'],
  bathroom:       ['center','left','right','on_counter','under_counter','on_floor'],
  park:           ['center','left','right','foreground','background','on_floor','on_chair','beside_table'],
  airport:        ['center','left','right','foreground','background','on_floor','on_chair'],
  city_street:    ['center','left','right','foreground','background','on_floor'],
  office:         ['center','left','right','on_table','under_table','on_chair','on_floor','on_counter'],
  classroom:      ['center','left','right','on_table','under_table','on_chair','on_floor'],
  outdoor_market: ['center','left','right','foreground','background','on_floor','on_counter','beside_table'],
  grocery_store:  ['center','left','right','on_floor','on_counter','beside_table'],
  doctor_office:  ['center','left','right','on_table','on_counter','on_chair','on_floor'],
  pharmacy:       ['center','left','right','on_counter','beside_table','on_floor'],
  bank:           ['center','left','right','foreground','background','on_counter','on_floor'],
  networking_event:['center','left','right','foreground','background','on_table','beside_table','on_floor'],
  // ── Venue sub-environments ──────────────────────────────────────────────────
  cafe_exterior:       ['center','left','right','foreground','background','on_table','beside_table','on_chair','on_floor'],
  cafe_counter:        ['center','left','right','foreground','background','on_table','under_table','beside_table','on_chair','on_floor','on_counter'],
  cafe_table:          ['center','left','right','on_table','under_table','beside_table','on_chair','on_floor'],
  restaurant_entrance: ['center','left','right','foreground','background','on_floor','on_counter','beside_table','on_chair'],
  airport_checkin:     ['center','left','right','foreground','background','on_floor','on_chair'],
  airport_security:    ['center','left','right','foreground','background','on_floor'],
  airport_gate:        ['center','left','right','foreground','background','on_floor','on_chair'],
  museum_entrance:     ['center','left','right','foreground','background','on_floor'],
  museum_gallery:      ['center','left','right','foreground','background','on_floor','on_chair'],
  // ── Close-up zone environments ─────────────────────────────────────────────
  kitchen_counter: ['center','left','right','on_counter','under_counter','on_floor'],
  bedroom_closeup: ['center','left','right','beside_bed','on_table','on_chair','on_floor'],
  desk_closeup:    ['center','left','right','on_table','under_table','on_chair','on_floor'],
};

// If a requested position is invalid for this environment, fall back to the first valid position,
// preferring a meaningful one over just 'center' where possible.
function resolvePosition(environment: string, requestedPosition: string): string {
  const valid = ENV_VALID_POSITIONS[environment];
  if (!valid || valid.includes(requestedPosition)) return requestedPosition;

  // Graceful fallback chain: try semantically similar positions, then center
  const fallbackChain: Record<string, string[]> = {
    on_table:     ['on_counter', 'beside_table', 'center'],
    under_table:  ['on_floor', 'center'],
    on_counter:   ['on_table', 'beside_table', 'center'],
    under_counter:['on_floor', 'center'],
    beside_table: ['beside_bed', 'on_floor', 'center'],
    beside_bed:   ['beside_table', 'on_floor', 'center'],
    on_chair:     ['on_floor', 'center'],
    in_hand:      ['center'],
  };

  const chain = fallbackChain[requestedPosition] ?? ['center'];
  for (const alt of chain) {
    if (valid.includes(alt)) {
      console.warn(`[PropRoom] Position "${requestedPosition}" invalid for ${environment} — using "${alt}" instead`);
      return alt;
    }
  }
  console.warn(`[PropRoom] Position "${requestedPosition}" invalid for ${environment} — falling back to center`);
  return 'center';
}

// Per-environment position overrides — applied on top of the global POSITION_MAP.
// Each environment has a different camera angle and table height, so positions need tuning.
// Add / refine entries here as new environments are calibrated visually.
const ENV_POSITION_OVERRIDES: Record<string, Partial<Record<string, Partial<{ cx: number; cy: number; scale: number }>>>> = {
  restaurant_table: {
    // Table surface is in the upper 40% of this camera angle
    center:       { cy: 0.42 },
    left:         { cy: 0.44, cx: 0.28 },
    right:        { cy: 0.44, cx: 0.72 },
    on_table:     { cy: 0.40, scale: 0.13 },
    under_table:  { cy: 0.80, cx: 0.35, scale: 0.20 },
    beside_table: { cy: 0.60 },
    on_counter:   { cy: 0.40, scale: 0.12 },
  },
  cafe: {
    // Café tables are visible in the mid-lower third
    center:       { cy: 0.60 },
    on_table:     { cy: 0.63, scale: 0.12 },
    under_table:  { cy: 0.82 },
    on_counter:   { cy: 0.52, scale: 0.10 },  // bar counter is higher in frame
  },
  kitchen: {
    center:       { cy: 0.60 },
    on_counter:   { cy: 0.55, scale: 0.12 },
    on_table:     { cy: 0.62, scale: 0.12 },
  },
  hotel_lobby: {
    center:       { cy: 0.62 },
    on_table:     { cy: 0.65, scale: 0.12 },
    on_counter:   { cy: 0.52, scale: 0.12 },
  },
  bedroom: {
    beside_bed:   { cy: 0.66, cx: 0.70 },
    on_table:     { cy: 0.58, scale: 0.12 },
  },
  office: {
    on_table:     { cy: 0.55, scale: 0.12 },
    center:       { cy: 0.58 },
  },
  classroom: {
    on_table:     { cy: 0.60, scale: 0.12 },
    center:       { cy: 0.58 },
  },
  // ── Close-up zone environments ─────────────────────────────────────────────
  kitchen_counter: {
    // Counter surface is in the lower 50% of the frame
    center:       { cy: 0.52 },
    on_counter:   { cy: 0.52, scale: 0.16 },
    under_counter:{ cy: 0.82, scale: 0.18 },
    on_floor:     { cy: 0.88 },
    left:         { cy: 0.54, cx: 0.25 },
    right:        { cy: 0.54, cx: 0.75 },
  },
  bedroom_closeup: {
    // Bed takes up left side; nightstand center-right; floor at very bottom
    center:       { cy: 0.55 },
    beside_bed:   { cy: 0.62, cx: 0.72, scale: 0.18 },
    on_table:     { cy: 0.50, cx: 0.68, scale: 0.14 },  // nightstand surface
    on_floor:     { cy: 0.88 },
    on_chair:     { cy: 0.60, cx: 0.20 },
    left:         { cy: 0.50, cx: 0.28 },
    right:        { cy: 0.55, cx: 0.72 },
  },
  desk_closeup: {
    // Desk surface fills the lower two-thirds
    center:       { cy: 0.55 },
    on_table:     { cy: 0.52, scale: 0.16 },
    under_table:  { cy: 0.84, scale: 0.20 },
    on_chair:     { cy: 0.86, cx: 0.50, scale: 0.18 },
    on_floor:     { cy: 0.90 },
    left:         { cy: 0.54, cx: 0.25 },
    right:        { cy: 0.54, cx: 0.75 },
  },
  // ── Outdoor / wide-angle environments ──────────────────────────────────────
  park: {
    // Wide park scene — horizon roughly 35% from top; ground runs across the bottom half
    center:       { cy: 0.72 },
    left:         { cy: 0.74, cx: 0.22 },
    right:        { cy: 0.74, cx: 0.78 },
    foreground:   { cy: 0.86, scale: 0.30 },  // close to camera
    background:   { cy: 0.40, scale: 0.10 },  // near horizon
    on_floor:     { cy: 0.84, scale: 0.22 },
    on_chair:     { cy: 0.68, scale: 0.14 },  // park bench seat
    beside_table: { cy: 0.74, cx: 0.68, scale: 0.14 },  // picnic table area
  },
  city_street: {
    // Street-level view — pavement in lower 35%, buildings behind
    center:       { cy: 0.75 },
    left:         { cy: 0.77, cx: 0.22 },
    right:        { cy: 0.77, cx: 0.78 },
    foreground:   { cy: 0.88, scale: 0.28 },
    background:   { cy: 0.38, scale: 0.10 },  // near rooflines
    on_floor:     { cy: 0.86, scale: 0.22 },
  },
  outdoor_market: {
    // Market stalls — counter surfaces roughly halfway down the frame
    center:       { cy: 0.65 },
    left:         { cy: 0.67, cx: 0.22 },
    right:        { cy: 0.67, cx: 0.78 },
    foreground:   { cy: 0.84, scale: 0.28 },
    background:   { cy: 0.38, scale: 0.10 },
    on_floor:     { cy: 0.82, scale: 0.22 },
    on_counter:   { cy: 0.58, scale: 0.12 },  // vendor counter / stall surface
    beside_table: { cy: 0.68, cx: 0.70, scale: 0.14 },
  },
  grocery_store: {
    // Store interior — shelving mid-frame; floor tiles at bottom
    center:       { cy: 0.68 },
    left:         { cy: 0.70, cx: 0.22 },
    right:        { cy: 0.70, cx: 0.78 },
    on_floor:     { cy: 0.84, scale: 0.24 },
    on_counter:   { cy: 0.58, scale: 0.12 },  // checkout counter / deli counter
    beside_table: { cy: 0.72, cx: 0.70, scale: 0.14 },
  },
  bathroom: {
    // Bathroom — sink/counter in the mid-lower third; mirror behind
    center:       { cy: 0.64 },
    left:         { cy: 0.66, cx: 0.22 },
    right:        { cy: 0.66, cx: 0.78 },
    on_counter:   { cy: 0.60, scale: 0.13 },  // sink surround / shelf
    under_counter:{ cy: 0.84, scale: 0.14 },  // cabinet below sink
    on_floor:     { cy: 0.88, scale: 0.20 },
  },
};

// Per-object-type scale multiplier applied on top of the position base scale.
// Values < 1 = small objects (cups, condiments); values > 1 = large objects (luggage, appliances).
const TYPE_SCALE: Record<string, number> = {
  tableware:     0.50,  // cups, plates, cutlery — small table items
  beverage:      0.45,  // coffee/drink servings
  food:          0.50,  // food items
  food_prop:     0.60,  // bread basket etc.
  condiment:     0.38,  // salt & pepper — tiny
  decoration:    0.45,
  drinkware:     0.52,  // wine glass, water pitcher
  document:      0.60,  // passport, boarding pass
  document_prop: 0.65,  // restaurant menu
  access:        0.40,  // hotel key card
  medical:       0.60,  // stethoscope, thermometer
  household:     0.70,  // books, phones, wallets, umbrellas
  luggage:       1.20,  // backpack, suitcase — large
  equipment:     1.10,  // shopping cart/basket
  appliance:     1.30,  // espresso machine
  display:       1.20,  // produce display
};

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

const ENV_ALIASES: Record<string, string> = {
  cafe_indoor: 'cafe',
  cafe_outdoor: 'cafe',
  cafe_room: 'cafe',
  hotel_room: 'hotel_lobby',
  hotel: 'hotel_lobby',
  restaurant: 'restaurant_table',
  restaurant_indoor: 'restaurant_table',
  street: 'city_street',
  city: 'city_street',
  market: 'outdoor_market',
  grocery: 'grocery_store',
  supermarket: 'grocery_store',
  doctors_office: 'doctor_office',
  medical: 'doctor_office',
};

async function findEnvironment(name: string): Promise<{ id: string; image_url: string; width: number; height: number } | null> {
  const normalized = ENV_ALIASES[name] ?? name;
  if (normalized !== name) console.log(`[PropRoom] Environment alias: '${name}' → '${normalized}'`);
  const rows = await db.execute(
    sql`SELECT id, image_url, width, height FROM visual_environments WHERE name = ${normalized} LIMIT 1`
  );
  if ((rows.rows as any[]).length) return rows.rows[0] as any;
  // Last-resort: partial match (e.g. "cafe_something" → "cafe")
  const prefix = normalized.split('_')[0];
  const fallback = await db.execute(
    sql`SELECT id, image_url, width, height FROM visual_environments WHERE name LIKE ${prefix + '%'} LIMIT 1`
  ).catch(() => ({ rows: [] as any[] }));
  return (fallback.rows[0] as any) ?? null;
}

async function findAsset(
  term: string,
  language = 'spanish'
): Promise<{ id: string; image_url: string; zone_image_url: string | null; width: number; height: number; display_name: string; object_type: string; name: string } | null> {
  const allowed = ['spanish','french','german','italian','portuguese','japanese','korean','mandarin','english'];
  const langCol = (allowed.includes(language) ? language : 'spanish') + '_terms';

  // Search all language columns and tags in one query, preferring the target language
  const queryStr = `
    SELECT id, name, image_url, zone_image_url, width, height, display_name, object_type
    FROM visual_assets
    WHERE spanish_terms    @> ARRAY[$1]
       OR english_terms    @> ARRAY[$1]
       OR french_terms     @> ARRAY[$1]
       OR german_terms     @> ARRAY[$1]
       OR italian_terms    @> ARRAY[$1]
       OR portuguese_terms @> ARRAY[$1]
       OR japanese_terms   @> ARRAY[$1]
       OR korean_terms     @> ARRAY[$1]
       OR mandarin_terms   @> ARRAY[$1]
       OR tags             @> ARRAY[$1]
       OR display_name     ILIKE $2
    ORDER BY (CASE WHEN "${langCol}" @> ARRAY[$1] THEN 0 ELSE 1 END)
    LIMIT 1
  `;
  const escaped = term.replace(/'/g, "''");
  const built = queryStr
    .replace(/\$1/g, `'${escaped}'`)
    .replace(/\$2/g, `'%${escaped}%'`);
  const rows = await db.execute(sql.raw(built))
    .catch((err: any) => {
      console.error('[PropRoom] findAsset query error:', err.message, '| term:', term);
      return { rows: [] as any[] };
    });

  return (rows.rows[0] as any) ?? null;
}

async function findPreComposed(
  envName: string,
  termsSorted: string[],
  prepCtx?: string
): Promise<{ id: string; composed_image_url: string } | null> {
  const key = buildCompositionKey(envName, termsSorted, prepCtx);
  const rows = await db.execute(
    sql`SELECT id, composed_image_url FROM visual_compositions WHERE name = ${key} AND composed_image_url IS NOT NULL LIMIT 1`
  );
  if ((rows.rows as any[]).length) {
    await db.execute(sql`UPDATE visual_compositions SET use_count = use_count + 1 WHERE id = ${(rows.rows[0] as any).id}`);
    return rows.rows[0] as any;
  }
  return null;
}

async function cacheComposition(
  envName: string,
  termsSorted: string[],
  prepCtx: string | undefined,
  imageUrl: string,
  compositionData: unknown[],
  envId: string
): Promise<void> {
  const key = buildCompositionKey(envName, termsSorted, prepCtx);
  // Build a proper SQL array literal — Drizzle sql`` passes JS arrays as records, not text[]
  const arrayLiteral = `ARRAY[${termsSorted.map(t => `'${t.replace(/'/g, "''")}'`).join(',')}]::text[]`;
  await db.execute(sql.raw(`
    INSERT INTO visual_compositions (name, display_name, environment_id, composition_data, composed_image_url, vocab_terms)
    VALUES (
      '${key.replace(/'/g, "''")}',
      '${(`${envName} + ${termsSorted.join(', ')}`).replace(/'/g, "''")}',
      '${envId.replace(/'/g, "''")}',
      '${JSON.stringify(compositionData).replace(/'/g, "''")}',
      '${imageUrl.replace(/'/g, "''")}',
      ${arrayLiteral}
    )
    ON CONFLICT (name) DO UPDATE SET composed_image_url = EXCLUDED.composed_image_url, use_count = visual_compositions.use_count + 1
  `));
}

function buildCompositionKey(envName: string, termsSorted: string[], prepCtx?: string): string {
  const base = [envName, ...termsSorted, prepCtx || ''].join('|');
  return crypto.createHash('md5').update(base).digest('hex').slice(0, 24);
}

// ─────────────────────────────────────────────────────────────────────────────
// Image download helper
// ─────────────────────────────────────────────────────────────────────────────

async function downloadImageBuffer(url: string): Promise<Buffer> {
  let fullUrl = url;
  if (url.startsWith('/api/media/')) {
    fullUrl = `http://localhost:${process.env.PORT || 5000}${url}`;
  }
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─────────────────────────────────────────────────────────────────────────────
// Background removal
// ─────────────────────────────────────────────────────────────────────────────

// Removes the background from a DALL-E prop image using BFS flood-fill.
//
// Strategy: DALL-E images often have partial transparency already (correct corners)
// but leave near-white/near-gray fringe pixels opaque along object edges.
// This function:
//   1. Seeds the BFS from every already-transparent pixel
//   2. Also seeds from image edges that are near-white (handles fully-opaque images)
//   3. Expands outward through adjacent near-white/near-gray opaque pixels
//   4. Sets all found pixels to alpha=0
//
// Because BFS only travels through CONNECTED near-white regions, it cannot
// "leak" into a dark or saturated object even if the object itself has light areas.
async function removeWhiteBackground(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width, h = info.height;
  const buf = Buffer.from(data);
  const pxAt = (x: number, y: number) => (y * w + x) * 4;

  // A pixel qualifies as background if it is transparent OR near-white/near-gray.
  // MIN=200 keeps light-gray object bodies (cup center: min=181) while removing
  // near-white backgrounds (min=229-252). SAT_MAX=45 allows for slight color cast.
  const isBackground = (x: number, y: number): boolean => {
    const i = pxAt(x, y);
    if (buf[i + 3] === 0) return true;
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    return Math.min(r, g, b) >= 200 && Math.max(r, g, b) - Math.min(r, g, b) <= 45;
  };

  const visited = new Uint8Array(w * h);
  const queue: number[] = [];
  let head = 0; // O(1) queue drain — avoid Array.shift()

  const enqueue = (x: number, y: number) => {
    const pi = y * w + x;
    if (!visited[pi] && isBackground(x, y)) { visited[pi] = 1; queue.push(pi); }
  };

  // Seed 1: existing transparent pixels (the "clean" background DALL-E already masked)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (buf[pxAt(x, y) + 3] === 0) enqueue(x, y);
    }
  }

  // Seed 2: all 4 image edges (catches fully-opaque images with no existing transparency)
  for (let x = 0; x < w; x++) { enqueue(x, 0); enqueue(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { enqueue(0, y); enqueue(w - 1, y); }

  // BFS flood-fill outward through connected near-white/near-gray pixels
  const DIRS: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
  while (head < queue.length) {
    const pi = queue[head++];
    const x = pi % w, y = (pi / w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) enqueue(nx, ny);
    }
  }

  // Remove all found background pixels
  for (let i = 0; i < queue.length; i++) {
    buf[queue[i] * 4 + 3] = 0;
  }

  console.log(`[PropRoomCompositor] BG removal: ${queue.length} of ${w * h} pixels cleared`);

  return sharp(Buffer.from(buf), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Compositor
// ─────────────────────────────────────────────────────────────────────────────

async function compositeScene(
  base: { image_url: string; width: number; height: number },
  layers: Array<{
    asset: { image_url: string; zone_image_url?: string | null; width: number; height: number; display_name: string; object_type: string };
    position: string;
    emphasis: boolean;
  }>,
  environment: string
): Promise<Buffer> {
  const baseBuffer = await downloadImageBuffer(base.image_url);

  const compositeLayers: sharp.OverlayOptions[] = [];

  for (const layer of layers) {
    const resolvedPositionKey = resolvePosition(environment, layer.position);
    const basePos = POSITION_MAP[resolvedPositionKey] ?? DEFAULT_POSITION;
    const envOverride = ENV_POSITION_OVERRIDES[environment]?.[resolvedPositionKey] ?? {};
    const pos = { ...basePos, ...envOverride };

    // Apply per-type scale multiplier so cups stay small and suitcases stay large
    const typeMultiplier = TYPE_SCALE[layer.asset.object_type] ?? 0.85;
    const finalScale = pos.scale * typeMultiplier;

    const targetW = Math.round(base.width * finalScale);
    const targetH = Math.round(
      (layer.asset.height / layer.asset.width) * targetW
    );
    const left = Math.round(base.width * pos.cx - targetW / 2);
    const top  = Math.round(base.height * pos.cy - targetH / 2);

    // Use zone_image_url (pre-cleaned transparent PNG) when available — skip BFS.
    // Fall back to image_url + BFS removal for assets without a cleaned version.
    let rawBuffer: Buffer;
    if (layer.asset.zone_image_url) {
      rawBuffer = await downloadImageBuffer(layer.asset.zone_image_url);
    } else {
      rawBuffer = await downloadImageBuffer(layer.asset.image_url);
      // 1. Strip near-white DALL-E backgrounds
      rawBuffer = await removeWhiteBackground(rawBuffer);
    }

    // 2. Resize to target dimensions, preserving transparency
    let objBuffer = await sharp(rawBuffer)
      .resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    if (layer.emphasis) {
      // Bright outline effect: slightly enlarged, warm-tinted glow behind the object
      const glowBuffer = await sharp(objBuffer)
        .resize(targetW + 8, targetH + 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .modulate({ brightness: 2.0, saturation: 0.3 })
        .tint({ r: 255, g: 230, b: 0 })
        .toBuffer();
      compositeLayers.push({ input: glowBuffer, left: left - 4, top: top - 4, blend: 'over' });
    }

    compositeLayers.push({ input: objBuffer, left, top, blend: 'over' });
  }

  return await sharp(baseBuffer)
    .composite(compositeLayers)
    .jpeg({ quality: 90 })
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function composeVisualScene(req: ComposeRequest): Promise<ComposeResult> {
  const { environment, objects, preposition_context, language = 'spanish' } = req;
  const termsSorted = objects.map(o => o.term.toLowerCase().trim()).sort();

  // 1. Check pre-composed cache
  const cached = await findPreComposed(environment, termsSorted, preposition_context).catch(() => null);
  if (cached?.composed_image_url) {
    return { success: true, imageUrl: cached.composed_image_url, source: 'pre_composed', cacheHit: true };
  }

  // 2. Try dynamic composition
  const envRow = await findEnvironment(environment).catch(() => null);
  if (!envRow) {
    return { success: false, source: 'fallback_needed', cacheHit: false, error: `Environment '${environment}' not in library yet` };
  }

  const assetResults = await Promise.all(
    objects.map(async (obj) => ({ obj, asset: await findAsset(obj.term.toLowerCase().trim(), language).catch(() => null) }))
  );

  const missing = assetResults.filter(r => !r.asset).map(r => r.obj.term);
  if (missing.length > 0) {
    return { success: false, source: 'fallback_needed', cacheHit: false, missingAssets: missing };
  }

  // Zone enforcement: zone environments only accept surface-plausible props
  // (ZONE_COMPATIBLE_PROPS). Vocab-only props have colored backgrounds and
  // cannot be cleanly composited — Daniela should use generate_visual for those.
  const isZoneEnv = ZONE_ENVIRONMENTS.has(environment) || environment === 'restaurant_table';
  if (isZoneEnv) {
    const notZoneCompatible = assetResults
      .filter(r => r.asset && !ZONE_COMPATIBLE_PROPS.has(r.asset.name))
      .map(r => r.asset!.name);
    if (notZoneCompatible.length > 0) {
      const zoneList = Array.from(ZONE_COMPATIBLE_PROPS).join(', ');
      return {
        success: false,
        source: 'fallback_needed',
        cacheHit: false,
        error: `Props [${notZoneCompatible.join(', ')}] are not zone-compatible and cannot be composited onto zone environments. Zone environments only accept these surface-plausible objects: ${zoneList}. For vocab display of other props, use generate_visual instead.`,
      };
    }
  }

  try {
    const layers = assetResults.map(({ obj, asset }) => ({
      asset: asset!,
      position: obj.position || 'center',
      emphasis: obj.emphasis ?? false,
    }));

    const composedBuffer = await compositeScene(envRow, layers, environment);
    const filename = `composed_${buildCompositionKey(environment, termsSorted, preposition_context)}.jpg`;
    const permanentUrl = await uploadPublicBuffer(filename, composedBuffer, 'image/jpeg');

    // Cache asynchronously — a cache write failure must NOT prevent returning the composed image
    cacheComposition(environment, termsSorted, preposition_context, permanentUrl, layers.map((l, i) => ({
      asset_id: assetResults[i].asset!.id,
      position: l.position,
      emphasis: l.emphasis,
    })), envRow.id).catch((err: any) => {
      console.warn('[PropRoomCompositor] Cache save failed (non-fatal):', err.message);
    });

    console.log(`[PropRoomCompositor] Composed: ${environment} + ${termsSorted.join(', ')} → ${permanentUrl}`);
    return { success: true, imageUrl: permanentUrl, source: 'dynamic_composition', cacheHit: false };
  } catch (err: any) {
    console.error('[PropRoomCompositor] Composition failed:', err.message);
    return { success: false, source: 'fallback_needed', cacheHit: false, error: err.message };
  }
}

export async function searchVisualLibrary(
  term: string,
  language = 'spanish'
): Promise<{ environments: any[]; assets: any[] }> {
  const t = term.toLowerCase().trim();

  const [envRows, assetRows] = await Promise.all([
    db.execute(sql`
      SELECT name, display_name, description, tags
      FROM visual_environments
      WHERE name ILIKE ${'%' + t + '%'}
         OR display_name ILIKE ${'%' + t + '%'}
         OR description ILIKE ${'%' + t + '%'}
         OR tags @> ARRAY[${t}]
      ORDER BY name LIMIT 10
    `),
    db.execute(sql`
      SELECT name, display_name, object_type, spanish_terms, english_terms, tags
      FROM visual_assets
      WHERE spanish_terms @> ARRAY[${t}]
         OR english_terms @> ARRAY[${t}]
         OR display_name ILIKE ${'%' + t + '%'}
         OR tags @> ARRAY[${t}]
      ORDER BY name LIMIT 20
    `),
  ]);

  return { environments: envRows.rows as any[], assets: assetRows.rows as any[] };
}

export async function listVisualLibrary(): Promise<{ environments: any[]; assetCount: number }> {
  const [envRows, countRow] = await Promise.all([
    db.execute(sql`SELECT name, display_name, tags FROM visual_environments ORDER BY name`),
    db.execute(sql`SELECT COUNT(*)::int as count FROM visual_assets`),
  ]);
  return {
    environments: envRows.rows as any[],
    assetCount: (countRow.rows[0] as any)?.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Base scene image generation
// ─────────────────────────────────────────────────────────────────────────────

export const SCENE_STYLE = 'warm illustrated watercolor style, soft natural lighting, inviting and welcoming atmosphere, culturally diverse people, no visible text or signs or labels on objects, language learning educational context, suitable for all ages, wide establishing shot';

// Style for close-up zone environments — same illustrated watercolor feel but camera is much closer.
// These environments exist specifically for preposition lessons where surface geometry matters.
const ZONE_STYLE = 'warm illustrated watercolor style, soft natural lighting, cozy interior atmosphere, no visible text or signs or labels on objects, language learning educational context, suitable for all ages, close-up interior view, flat clear surface prominently occupying the center and lower frame where objects can be placed, clean and uncluttered';

// Environments that use ZONE_STYLE instead of SCENE_STYLE (close-up surface shots for preposition lessons)
const ZONE_ENVIRONMENTS = new Set(['kitchen_counter', 'bedroom_closeup', 'desk_closeup']);

// ─────────────────────────────────────────────────────────────────────────────
// Zone-compatible props
//
// Only these props may be used with zone environments (Mode B — preposition
// lessons). They are surface-plausible objects that always have plain white
// backgrounds so the BFS flood-fill can remove them cleanly.
//
// All other props are "vocab-only" — they are displayed as full DALL-E images
// without compositing and do not require background removal.
// ─────────────────────────────────────────────────────────────────────────────
export const ZONE_COMPATIBLE_PROPS = new Set([
  // Drinks & drinkware
  'cup', 'glass', 'wine_glass', 'water_pitcher',
  'espresso', 'latte', 'coffee', 'hot chocolate', 'coffee with cream',
  // Table setting
  'plate', 'dinner_plate', 'fork', 'knife', 'spoon', 'napkin',
  'bread_basket', 'salt_pepper',
  // Common surface / desk objects
  'book', 'cell_phone', 'menu_card', 'candle',
  // Light food items that sit on a plate or surface
  'apple', 'croissant',
  // Floor / under-table objects
  'backpack',
]);

const SCENE_PROMPTS: Record<string, string> = {
  // ── Wide-shot contextual environments ──────────────────────────────────────
  airport:          'A busy international airport terminal interior — check-in counters, departure boards, travellers with luggage, large windows overlooking planes on the tarmac',
  bathroom:         'A clean modern home bathroom — pedestal sink with mirror, shower curtain, neatly arranged toiletries on shelves, towels on rack, soft morning light',
  bedroom:          'A cozy home bedroom — neatly made bed with colourful pillows, wooden dresser with mirror, nightstand with lamp, sunlight through curtains',
  cafe:             'Interior of a charming coffee shop — wooden counter with espresso machine, chalkboard menu, pastries in glass display case, warm hanging lights, small tables and chairs',
  city_street:      'A lively city street scene — shops and cafés lining the pavement, a crosswalk, a bus stop, pedestrians going about their day, trees and clear sky',
  classroom:        'A bright school classroom — rows of wooden desks, whiteboard at front, bookshelves along the wall, globe and maps, plants on windowsills, afternoon light',
  doctor_office:    'A welcoming doctor\'s examination room — padded exam table, desk with medical charts, anatomical poster on wall, instrument tray, plants, soft lighting',
  grocery_store:    'Inside a well-stocked grocery store — colourful produce section with fresh fruits and vegetables in wooden bins, hanging signs for each aisle, shopping carts',
  hotel_lobby:      'A grand hotel lobby — polished marble front desk with staff, plush seating area, potted palms, luggage racks, elevator doors, chandeliers',
  kitchen:          'Wide shot of a warm home kitchen — a kitchen island with smooth stone counter surface occupies the center-lower portion of the image, the island top at roughly 60% from the top, with the island\'s wooden base and a strip of tile floor visible in the bottom 20%; in the background a stove, refrigerator, cabinets, and a window with herbs on the sill; the island counter surface is completely empty',
  living_room:      'A comfortable living room — sofa with throw pillows, wooden coffee table, bookshelf, television on wall unit, rug, plants, afternoon sunlight',
  office:           'A modern open-plan office — rows of desks with computers, glass meeting room in background, reception desk, potted plants, city view through large windows',
  outdoor_market:   'A lively outdoor street market — colourful vendor stalls with awnings, crates of fresh produce, shoppers browsing, cobblestone square, blue sky',
  park:             'A sunny public park — winding path through green trees, wooden benches, families picnicking, a small food cart, fountain in the distance',
  restaurant_table: 'Cozy bistro table viewed from standing height looking slightly downward — the warm wood bistro tabletop with white tablecloth occupies the bottom 40% of the image, the table edge running across roughly two-thirds of the way down the frame; below the table a clean tile floor is visible in the bottom 20%; bistro chairs pushed to either side; in the upper half: warm restaurant interior, other candlelit tables, brick wall, hanging Edison bulbs; the table surface is completely empty and clear',

  // ── Culturally-specific dining environments ────────────────────────────────
  taqueria:         'Mexican street taqueria counter viewed from the customer side, looking slightly downward — a worn wooden prep counter with a warm terra cotta tile surface occupies the bottom 40% of the image, the counter edge running across two-thirds of the way down the frame; a thin strip of cobblestone floor is visible at the very bottom; in the upper half: a traditional trompo (vertical spit with layered marinated pork) glowing orange on the left, a comal griddle with wisps of steam, jars of colorful salsas verde and roja, hanging dried ancho and guajillo chiles, hand-painted talavera tiles in turquoise and ochre on the back wall, a hand-written chalkboard menu in Spanish, warm golden evening light; the counter surface is completely empty and clear',
  french_brasserie: 'Classic Parisian brasserie bistro table viewed from standing height looking slightly downward — a round marble-topped bistro table with a crisp white linen cloth occupies the bottom 40% of the image, the table edge running across two-thirds of the way down the frame; below the table a herringbone parquet floor is visible in the bottom 20%; rattan bistro chairs tucked to either side; in the upper half: a zinc bar counter gleaming in the background left, wicker café chairs at neighboring marble tables, tall arched windows revealing a Parisian boulevard with plane trees and soft golden afternoon light, an art nouveau wall sconce, a chalkboard menu listing plats du jour; the table surface is completely empty and clear',
  japanese_izakaya: 'Japanese izakaya low dining table viewed from a standing height looking slightly downward — a dark lacquered wooden table surface occupies the bottom 40% of the image, the near edge of the table running across two-thirds of the way down the frame; below the table a polished wooden floor with thin tatami mat strips is visible in the bottom 20%; in the upper half: warm amber paper lanterns (chōchin) hanging from low wooden ceiling beams, wooden shelving displaying rows of sake bottles and shochu, a noren split curtain in indigo blue with white kanji, the distant glow of a yakitori charcoal grill with wisps of smoke, dark wood paneling; intimate, warm, evening atmosphere; the table surface is completely empty and clear',
  german_biergarten: 'Bavarian beer garden picnic table viewed from standing height looking slightly downward — a long, bare wooden Biertisch (unpainted pine plank table) occupies the bottom 40% of the image, the near bench edge running across two-thirds of the way down the frame; a strip of gravel path is visible at the very bottom; in the upper half: an open-air beer garden on a sunny afternoon — massive chestnut trees with dappled light filtering through the canopy, other long tables filled with cheerful guests, a traditional Biergarten kiosk with a thatched roof serving beer in the distance, string lights between the trees, the soft green of Bavarian countryside hills visible beyond; the table surface is completely empty and clear',
  italian_trattoria: 'Italian trattoria dining table viewed from standing height looking slightly downward — a small square table with a red-and-white checkered linen tablecloth occupies the bottom 40% of the image, the table edge running across two-thirds of the way down the frame; below the table rustic terracotta tile floor is visible in the bottom 20%; wooden chairs tucked to either side; in the upper half: warm stone-arch interior with rough plastered walls, Chianti wine bottles in woven straw baskets hanging from ceiling beams, a wooden shelf displaying olive oil and ceramic urns, candles in old wine bottles, a blackboard with handwritten Italian menu, soft amber candlelight; the table surface is completely empty and clear',
  korean_bbq:       'Korean barbecue restaurant table viewed from standing height looking slightly downward — a dark stone-topped table with a round charcoal grill built into its center occupies the bottom 40% of the image, the table edge running across two-thirds of the way down the frame; a strip of clean tile floor is visible at the bottom; in the upper half: a cozy Korean BBQ restaurant interior — stainless steel ventilation hoods hanging over each table, the neighboring table showing small banchan (side dish) bowls arranged around a glowing grill, warm pendant lighting, Korean wooden paneling with subtle traditional lattice patterns, a menu board with Korean script; the table surface is completely empty and clear aside from the grill cutout at center',
  chinese_teahouse:  'Traditional Chinese teahouse low tea table viewed from standing height looking slightly downward — a smooth dark rosewood gongfu tea table with a built-in drainage tray occupies the bottom 40% of the image, the near edge running across two-thirds of the way down the frame; below the table polished stone floor with bamboo mat is visible in the bottom 20%; in the upper half: a serene classical teahouse interior — bamboo screens and a sliding rice-paper window open to a misty Chinese garden courtyard with a stone lantern and pine tree, a wooden shelf displaying celadon tea jars and a Yixing clay teapot, hanging calligraphy scroll in ink brush, soft natural daylight filtering through bamboo; the table surface is completely empty and clear',
  israeli_cafe:      'Modern Tel Aviv coffee shop counter viewed from the customer side, looking slightly downward — a smooth white Caesarstone counter surface occupies the bottom 40% of the image, the counter edge running across two-thirds of the way down the frame; a thin strip of Jerusalem stone tile floor is visible at the very bottom; in the upper half: a contemporary Israeli café interior — an espresso machine gleaming on the left, jars of specialty single-origin coffee beans and a hand-grinder, a glass display case showing rugelach, bourekas and ka\'ak cookies, exposed limestone walls typical of Tel Aviv architecture, pendant Edison bulbs hanging from raw concrete ceiling, a chalkboard menu with Hebrew script, Israeli newspapers folded on the counter, a small potted olive branch; warm morning light filtering through large windows; the counter surface is completely empty and clear',

  // ── Venue sub-environments ─────────────────────────────────────────────────
  // Café family
  cafe_exterior:    'Exterior of a charming neighbourhood café — warm wooden signage above a glass door, a small chalkboard menu on the pavement, two iron bistro tables with chairs on the sidewalk, potted plants flanking the entrance, warm light glowing inside through the window, morning sunlight, passing pedestrians on the street',
  cafe_counter:     'Interior of a charming coffee shop — wooden counter with espresso machine, chalkboard menu, pastries in glass display case, warm hanging Edison lights, small café tables and chairs visible behind',
  cafe_table:       'Interior of a cosy café from a seated perspective — a round wooden café table in the foreground with a smooth surface, warm hanging Edison bulbs above, a chalkboard menu on the brick wall, other patrons at nearby tables, soft afternoon light through large windows',
  // Restaurant family
  restaurant_entrance: 'Warm restaurant entrance foyer — a wooden hostess stand at the centre with a reservations book open on top, a candlelit dining room visible through a doorway behind, hanging pendant lights, a coat rack and potted plant flanking the entry, polished stone floor, elegant and inviting evening atmosphere',
  restaurant_table_with_plate: 'Cozy bistro table with food — the warm wood bistro tabletop with white tablecloth occupies the bottom 40% of the image; a main course plate with colourful food is centred on the table; the table edge runs across two-thirds of the way down the frame; bistro chairs to either side; in the upper half: warm candlelit restaurant interior, other tables, brick wall, hanging Edison bulbs',
  // Airport family
  airport_checkin:  'A busy international airport terminal interior — long check-in counter staffed by airline agents, departure boards displaying destinations and gate numbers, travellers with luggage carts in queue, large windows overlooking planes on the tarmac',
  airport_security: 'Airport security screening lane — a belt-conveyor X-ray machine with grey plastic trays stacked at one end, a uniformed security officer beside the scanner, overhead signage about liquids and electronics, a rope-line queuing corridor, bright overhead fluorescent lighting, a second lane visible to one side',
  airport_gate:     'Modern airport departure gate lounge — rows of padded airport seats with armrests, a large floor-to-ceiling window overlooking aircraft and the tarmac, a gate desk with staff and a digital departure board overhead, travellers reading and looking at phones, a small café kiosk in the background',
  // Museum family
  museum_entrance:  'Grand museum entrance atrium — soaring ceilings with marble floors, a ticket booth with brochures fanned out on the counter, tall arched windows letting in soft natural light, large exhibition banners hanging from above, visitors strolling, a wide staircase leading to upper galleries in the background',
  museum_gallery:   'Inside a museum exhibition gallery — polished hardwood floors, white painted walls displaying large framed artworks and sculptures on plinths, recessed track lighting highlighting each exhibit, a low bench in the centre of the room, small informational plaques beside each piece, a few visitors studying the works',
  // Transport family
  taxi_interior:    'View from the back seat of a taxi cab — the driver visible in the front seat, a city street stretching ahead through the windshield, tall buildings and pedestrians on the pavement, the back of the front seats and the meter display in the foreground, afternoon daylight',
  hotel_room:       'Cozy hotel room with a neatly made queen bed, crisp white linens, a bedside table with a lamp, a writing desk near the window, curtains open to a city or garden view, a flat-screen television on the wall, welcoming and tidy',
  // Legacy aliases — same image referenced by alternate name
  museum:           'Grand museum interior — soaring atrium with marble floors, a ticket booth with brochures, tall arched windows letting in soft natural light, large exhibition banners hanging from the ceiling, visitors strolling, a wide staircase leading to upper galleries in the background',

  // ── Close-up zone environments (for preposition lessons) ──────────────────
  // Camera is much closer; the primary surface fills the lower frame so props
  // land visibly ON / UNDER / BESIDE it. Surface should fall at ~65-70% from top.
  // Use ZONE_STYLE when generating.
  kitchen_counter:  'Kitchen counter viewed from standing height looking slightly downward — the smooth stone counter surface occupies the bottom 40% of the image, the counter\'s front edge running across roughly two-thirds of the way down the frame; below the counter front a small strip of wooden kitchen floor is visible in the bottom 15%; counter surface is completely empty and clear; behind the counter a classic tile backsplash, warm wood cabinets, and a window with soft daylight above; minimal decoration only',
  bedroom_closeup:  'Close-up view of a cozy room interior showing a neatly made sleeping area — a tidy mattress with a crisp white blanket and two white pillows on the left, a warm wooden side table with a small reading lamp at center-right with a clear flat top surface available for objects, a strip of warm hardwood floor visible at the very bottom, soft daylight from a window on the right, peaceful and tidy home interior',
  desk_closeup:     'Wooden study desk viewed from standing height looking slightly downward — the warm wood desk surface occupies the bottom 40% of the image, the desk\'s front edge running across roughly two-thirds of the way down the frame; below the desk the top of a wooden chair back and a strip of floor are visible in the bottom 15%; desk surface is completely empty and clear; in the background a warm daylit window, a bookshelf with colourful spines, a small plant; close-up interior view',
};

export interface SceneImageResult {
  name: string;
  success: boolean;
  url?: string;
  error?: string;
  skipped?: boolean;
}

export async function generateAllSceneImages(
  opts: { force?: boolean; only?: string[] } = {}
): Promise<SceneImageResult[]> {
  const envRows = await db.execute(sql`SELECT id, name, display_name, image_url FROM visual_environments ORDER BY name`);
  const envs = envRows.rows as Array<{ id: string; name: string; display_name: string; image_url: string }>;

  const results: SceneImageResult[] = [];

  for (const env of envs) {
    if (opts.only && !opts.only.includes(env.name)) continue;
    if (!opts.force && env.image_url && env.image_url.trim() !== '') {
      results.push({ name: env.name, success: true, url: env.image_url, skipped: true });
      continue;
    }

    const customPrompt = SCENE_PROMPTS[env.name];
    const styleForEnv = ZONE_ENVIRONMENTS.has(env.name) ? ZONE_STYLE : SCENE_STYLE;
    const prompt = customPrompt
      ? `${customPrompt}. ${styleForEnv}`
      : `${env.display_name} scene for language learning: ${env.name.replace(/_/g, ' ')}. ${styleForEnv}`;

    console.log(`[PropRoom] Generating image for ${env.name} via DALL-E 3...`);
    try {
      const dallE = getDallEClient();
      if (!dallE) {
        results.push({ name: env.name, success: false, error: 'OPENAI_API_KEY not set' });
        continue;
      }

      const imgResponse = await dallE.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
        response_format: 'url',
      });

      const imageUrl = imgResponse.data?.[0]?.url;
      if (!imageUrl) {
        results.push({ name: env.name, success: false, error: 'No image URL in DALL-E response' });
        continue;
      }

      const fetchRes = await fetch(imageUrl);
      if (!fetchRes.ok) throw new Error(`Failed to download image: ${fetchRes.status}`);
      const buf = Buffer.from(await fetchRes.arrayBuffer());

      const permanentUrl = await uploadPublicBuffer(`scene-${env.name}-${Date.now()}.jpg`, buf, 'image/jpeg');

      await db.execute(sql`UPDATE visual_environments SET image_url = ${permanentUrl} WHERE id = ${env.id}`);
      console.log(`[PropRoom] ✓ ${env.name} → ${permanentUrl}`);
      results.push({ name: env.name, success: true, url: permanentUrl });

    } catch (err: any) {
      console.error(`[PropRoom] Error generating ${env.name}: ${err.message}`);
      results.push({ name: env.name, success: false, error: err.message });
    }
  }

  return results;
}

export async function getSceneZones(sceneName: string): Promise<{
  scene: { name: string; displayName: string; description: string } | null;
  zones: Array<{
    zoneKey: string;
    zoneName: string;
    zoneType: string;
    description: string;
    languageFunctions: string[];
    positionHint: string | null;
  }>;
}> {
  const envRow = await db.execute(
    sql`SELECT id, name, display_name, description FROM visual_environments WHERE name = ${sceneName} LIMIT 1`
  );
  const env = envRow.rows[0] as any ?? null;
  if (!env) return { scene: null, zones: [] };

  const zoneRows = await db.execute(
    sql`SELECT zone_key, zone_name, zone_type, description, language_functions, position_hint
        FROM visual_zones WHERE environment_id = ${env.id}
        ORDER BY zone_type, zone_key`
  );

  return {
    scene: { name: env.name, displayName: env.display_name, description: env.description },
    zones: (zoneRows.rows as any[]).map(z => ({
      zoneKey: z.zone_key,
      zoneName: z.zone_name,
      zoneType: z.zone_type,
      description: z.description,
      languageFunctions: z.language_functions ?? [],
      positionHint: z.position_hint ?? null,
    })),
  };
}

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
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { uploadPublicBuffer } from './image-storage';

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

const SCENE_STYLE = 'warm illustrated watercolor style, soft natural lighting, inviting and welcoming atmosphere, culturally diverse people, no visible text or signs or labels on objects, language learning educational context, suitable for all ages, wide establishing shot';

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
  kitchen:          'A warm home kitchen — granite countertops, stove and oven, refrigerator, wooden cabinets, cutting board with vegetables, herbs on windowsill',
  living_room:      'A comfortable living room — sofa with throw pillows, wooden coffee table, bookshelf, television on wall unit, rug, plants, afternoon sunlight',
  office:           'A modern open-plan office — rows of desks with computers, glass meeting room in background, reception desk, potted plants, city view through large windows',
  outdoor_market:   'A lively outdoor street market — colourful vendor stalls with awnings, crates of fresh produce, shoppers browsing, cobblestone square, blue sky',
  park:             'A sunny public park — winding path through green trees, wooden benches, families picnicking, a small food cart, fountain in the distance',
  restaurant_table: 'A beautifully set restaurant table — white tablecloth, ceramic plates, polished cutlery, folded napkins, small candle, bread basket, water glasses, warm bistro lighting',

  // ── Close-up zone environments (for preposition lessons) ──────────────────
  // Camera is much closer; the primary surface fills the lower frame so props
  // land visibly ON / UNDER / BESIDE it. Use ZONE_STYLE when generating.
  kitchen_counter:  'Close-up view looking at a kitchen counter from standing height — the smooth stone counter surface fills the bottom half of the frame with generous open space, a simple tile backsplash behind, warm wood cabinets at the sides, a window with soft daylight above, a few subtle background items (a small plant, a mixing bowl) but the counter surface is clean and clear',
  bedroom_closeup:  'Close-up view of a cozy room interior showing a neatly made sleeping area — a tidy mattress with a crisp white blanket and two white pillows on the left, a warm wooden side table with a small reading lamp at center-right with a clear flat top surface available for objects, a strip of warm hardwood floor visible at the very bottom, soft daylight from a window on the right, peaceful and tidy home interior',
  desk_closeup:     'Close-up view of a wooden study desk — the desk surface fills the lower two-thirds of the frame with open clear space, the back of a simple wooden chair just visible at the very bottom edge, a warm daylit window and a bookshelf with colourful spines visible in the background, desk surface is clean and ready to receive objects',
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
  const apiKey = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('_DUMMY')) throw new Error('No valid OpenAI API key found (USER_OPENAI_API_KEY, OPENAI_API_KEY, or AI_INTEGRATIONS_OPENAI_API_KEY)');

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

    console.log(`[PropRoom] Generating image for ${env.name}...`);
    try {
      const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1792x1024',
          quality: 'standard',
          response_format: 'url',
        }),
      });

      if (!dalleRes.ok) {
        const errText = await dalleRes.text();
        console.error(`[PropRoom] DALL-E failed for ${env.name}: ${errText}`);
        results.push({ name: env.name, success: false, error: errText });
        continue;
      }

      const dalleData = await dalleRes.json();
      const tempUrl = dalleData.data?.[0]?.url;
      if (!tempUrl) {
        results.push({ name: env.name, success: false, error: 'No URL in response' });
        continue;
      }

      const { archiveImageToPermanentStorage } = await import('./image-storage');
      const permanentUrl = await archiveImageToPermanentStorage(tempUrl, `scene-${env.name}-${Date.now()}.jpg`);

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

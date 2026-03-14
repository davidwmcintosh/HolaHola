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

const POSITION_MAP: Record<string, { cx: number; cy: number; scale: number }> = {
  center:        { cx: 0.50, cy: 0.55, scale: 0.30 },
  left:          { cx: 0.22, cy: 0.58, scale: 0.24 },
  right:         { cx: 0.78, cy: 0.58, scale: 0.24 },
  foreground:    { cx: 0.50, cy: 0.80, scale: 0.40 },
  background:    { cx: 0.50, cy: 0.30, scale: 0.18 },
  on_table:      { cx: 0.50, cy: 0.62, scale: 0.22 },
  under_table:   { cx: 0.50, cy: 0.80, scale: 0.19 }, // lower in frame, slightly smaller — visually below the table surface
  on_floor:      { cx: 0.50, cy: 0.85, scale: 0.28 },
  beside_bed:    { cx: 0.72, cy: 0.68, scale: 0.20 },
  on_counter:    { cx: 0.55, cy: 0.58, scale: 0.22 },
  under_counter: { cx: 0.45, cy: 0.78, scale: 0.18 }, // floor level below a counter
  in_hand:       { cx: 0.50, cy: 0.60, scale: 0.18 },
  on_chair:      { cx: 0.50, cy: 0.70, scale: 0.20 },
  beside_table:  { cx: 0.72, cy: 0.75, scale: 0.20 },
};

const DEFAULT_POSITION = POSITION_MAP.center;

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
): Promise<{ id: string; image_url: string; width: number; height: number; display_name: string } | null> {
  const allowed = ['spanish','french','german','italian','portuguese','japanese','korean','mandarin','english'];
  const langCol = (allowed.includes(language) ? language : 'spanish') + '_terms';

  // Search all language columns and tags in one query, preferring the target language
  const queryStr = `
    SELECT id, image_url, width, height, display_name
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
// Compositor
// ─────────────────────────────────────────────────────────────────────────────

async function compositeScene(
  base: { image_url: string; width: number; height: number },
  layers: Array<{
    asset: { image_url: string; width: number; height: number; display_name: string };
    position: string;
    emphasis: boolean;
  }>
): Promise<Buffer> {
  const baseBuffer = await downloadImageBuffer(base.image_url);

  const compositeLayers: sharp.OverlayOptions[] = [];

  for (const layer of layers) {
    const pos = POSITION_MAP[layer.position] ?? DEFAULT_POSITION;

    const targetW = Math.round(base.width * pos.scale);
    const targetH = Math.round(
      (layer.asset.height / layer.asset.width) * targetW
    );
    const left = Math.round(base.width * pos.cx - targetW / 2);
    const top  = Math.round(base.height * pos.cy - targetH / 2);

    let objBuffer = await downloadImageBuffer(layer.asset.image_url);

    objBuffer = await sharp(objBuffer)
      .resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    if (layer.emphasis) {
      // Bright outline effect: composite a slightly scaled, tinted version underneath
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

  try {
    const layers = assetResults.map(({ obj, asset }) => ({
      asset: asset!,
      position: obj.position || 'center',
      emphasis: obj.emphasis ?? false,
    }));

    const composedBuffer = await compositeScene(envRow, layers);
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

const SCENE_PROMPTS: Record<string, string> = {
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
    const prompt = customPrompt
      ? `${customPrompt}. ${SCENE_STYLE}`
      : `${env.display_name} scene for language learning: ${env.name.replace(/_/g, ' ')}. ${SCENE_STYLE}`;

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

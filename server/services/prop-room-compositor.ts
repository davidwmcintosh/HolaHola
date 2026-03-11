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
  center:      { cx: 0.50, cy: 0.55, scale: 0.30 },
  left:        { cx: 0.22, cy: 0.58, scale: 0.24 },
  right:       { cx: 0.78, cy: 0.58, scale: 0.24 },
  foreground:  { cx: 0.50, cy: 0.80, scale: 0.40 },
  background:  { cx: 0.50, cy: 0.30, scale: 0.18 },
  on_table:    { cx: 0.50, cy: 0.62, scale: 0.22 },
  on_floor:    { cx: 0.50, cy: 0.85, scale: 0.28 },
  beside_bed:  { cx: 0.72, cy: 0.68, scale: 0.20 },
  on_counter:  { cx: 0.55, cy: 0.58, scale: 0.22 },
  in_hand:     { cx: 0.50, cy: 0.60, scale: 0.18 },
};

const DEFAULT_POSITION = POSITION_MAP.center;

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function findEnvironment(name: string): Promise<{ id: string; image_url: string; width: number; height: number } | null> {
  const rows = await db.execute(
    sql`SELECT id, image_url, width, height FROM visual_environments WHERE name = ${name} LIMIT 1`
  );
  return (rows.rows[0] as any) ?? null;
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
  const rows = await db.execute(sql.raw(queryStr.replace('$1', `'${term.replace(/'/g,"''")}'`).replace('$2', `'%${term.replace(/'/g,"''")}%'`)))
    .catch(() => ({ rows: [] as any[] }));

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
  await db.execute(sql`
    INSERT INTO visual_compositions (name, display_name, environment_id, composition_data, composed_image_url, vocab_terms)
    VALUES (
      ${key},
      ${`${envName} + ${termsSorted.join(', ')}`},
      ${envId},
      ${JSON.stringify(compositionData)},
      ${imageUrl},
      ${termsSorted}
    )
    ON CONFLICT (name) DO UPDATE SET composed_image_url = EXCLUDED.composed_image_url, use_count = visual_compositions.use_count + 1
  `);
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

    await cacheComposition(environment, termsSorted, preposition_context, permanentUrl, layers.map((l, i) => ({
      asset_id: assetResults[i].asset!.id,
      position: l.position,
      emphasis: l.emphasis,
    })), envRow.id);

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

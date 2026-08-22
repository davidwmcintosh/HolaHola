/**
 * Regenerate all adjective contrast-pair images using Gemini Base
 * (gemini-2.5-flash-image) — the canonical engine for all HolaHola image
 * generation as of May 2026.
 *
 * Strategy: avoid people wherever possible. Use simple objects, icons,
 * animals, or shapes to convey each concept clearly.
 *
 * Run: npx tsx scripts/regen-adjectives.ts
 */

import { GoogleGenAI } from '@google/genai';
import { Storage } from '@google-cloud/storage';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const BUCKET_ID  = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
const DB_URL     = process.env.NEON_SHARED_DATABASE_URL || '';
const SIDECAR    = 'http://127.0.0.1:1106';

if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');
if (!BUCKET_ID)  throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
if (!DB_URL)     throw new Error('NEON_SHARED_DATABASE_URL not set');

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

const gcs = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${SIDECAR}/token`,
    type: 'external_account',
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: 'json', subject_token_field_name: 'access_token' },
    },
    universe_domain: 'googleapis.com',
  } as any,
  projectId: '',
});

const sqlClient = neon(DB_URL);
const db = drizzle(sqlClient);
const OUT_DIR = path.join(process.cwd(), 'attached_assets/generated_images/vocab');

// Style constant — flat illustration matching the adjective pair library style.
// No text labels: Gemini ignores them and all generation rules prohibit text in images.
const STYLE =
  'flat simple cartoon illustration, bold clean outlines, bright flat colours, ' +
  "children's picture-book style, simple shapes, no realistic detail, pure white background. " +
  'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.';

// Split-panel helper — no label instructions, visual contrast carries the meaning.
const SPLIT = (leftDesc: string, rightDesc: string) =>
  `A clean split-panel flat illustration divided by a bold vertical line down the center. ` +
  `LEFT half: ${leftDesc}. ` +
  `RIGHT half: ${rightDesc}. ` +
  `${STYLE}`;

const IMAGES = [
  // ── cerca / lejos ──────────────────────────────────────────────────────────
  {
    filename: 'adj_cerca_lejos.png',
    destFilename: 'vocab_adj_cerca_lejos.png',
    prompt: SPLIT(
      'a large colourful cartoon house fills most of the space; a tiny cartoon figure stands right beside the front door',
      'the exact same house is now very tiny and distant at the far end of a long road; the tiny cartoon figure is large in the foreground looking toward it',
    ),
    cacheKeys: ['vocab_spanish_cerca', 'vocab_spanish_lejos'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── alto / bajo ────────────────────────────────────────────────────────────
  {
    filename: 'adj_alto_bajo.png',
    destFilename: 'vocab_adj_alto_bajo.png',
    prompt: SPLIT(
      'a very tall cartoon giraffe with a long neck reaching up, head near the top of the frame',
      'a very small cartoon mouse standing on the ground, tiny, barely above the bottom of the frame',
    ),
    cacheKeys: ['vocab_spanish_alto', 'vocab_spanish_bajo'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── pesado / ligero ────────────────────────────────────────────────────────
  {
    filename: 'adj_pesado_ligero.png',
    destFilename: 'vocab_adj_pesado_ligero.png',
    prompt: SPLIT(
      'a large cartoon round grey boulder with cracks, sitting heavily on the ground with small downward pressure lines underneath',
      'a single fluffy white cartoon feather floating lightly in the air with a gentle upward wisp',
    ),
    cacheKeys: ['vocab_spanish_pesado', 'vocab_spanish_ligero'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── joven / viejo ──────────────────────────────────────────────────────────
  {
    filename: 'adj_joven_viejo_personas.png',
    destFilename: 'vocab_adj_joven_viejo_personas.png',
    prompt: SPLIT(
      'a small young sapling: thin green trunk with just a few bright green leaves, fresh and full of energy',
      'a large ancient old tree: thick gnarled trunk with many branches, huge full canopy of leaves, visible bark texture',
    ),
    cacheKeys: ['vocab_spanish_joven', 'vocab_spanish_viejo_persona'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── fácil / difícil ────────────────────────────────────────────────────────
  {
    filename: 'adj_facil_dificil.png',
    destFilename: 'vocab_adj_facil_dificil.png',
    prompt: SPLIT(
      'a single large cartoon puzzle piece clicking perfectly into place in a simple 2-piece puzzle; a big green checkmark above it',
      'a chaotic pile of hundreds of tiny jumbled puzzle pieces in a messy heap with question marks floating around',
    ),
    cacheKeys: ['vocab_spanish_facil', 'vocab_spanish_dificil'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── ruidoso / tranquilo ────────────────────────────────────────────────────
  {
    filename: 'adj_ruidoso_tranquilo.png',
    destFilename: 'vocab_adj_ruidoso_tranquilo.png',
    prompt: SPLIT(
      'a bright red cartoon megaphone blasting sound with many bold jagged sound waves radiating outward in all directions',
      'a calm cartoon crescent moon with a small sleeping face (closed eyes, peaceful expression) with no sound lines — just stillness',
    ),
    cacheKeys: ['vocab_spanish_ruidoso', 'vocab_spanish_tranquilo'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── oscuro / claro ─────────────────────────────────────────────────────────
  {
    filename: 'adj_oscuro_claro.png',
    destFilename: 'vocab_adj_oscuro_claro.png',
    prompt: SPLIT(
      'a cartoon window with dark navy-blue curtains drawn shut; a crescent moon visible through a small gap; dark and dim overall',
      'the exact same cartoon window but with curtains wide open; bright yellow sunlight streams in with radiating sun rays; warm and bright',
    ),
    cacheKeys: ['vocab_spanish_oscuro', 'vocab_spanish_claro'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── duro / suave ───────────────────────────────────────────────────────────
  {
    filename: 'adj_duro_suave.png',
    destFilename: 'vocab_adj_duro_suave.png',
    prompt: SPLIT(
      'a rough jagged grey rock with angular sharp edges and cracks, looking very solid and hard',
      'a round plump cartoon pillow with soft curved edges and squiggly lines to suggest fluffiness and softness',
    ),
    cacheKeys: ['vocab_spanish_duro', 'vocab_spanish_suave', 'vocab_spanish_blando'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },
];

async function callGemini(prompt: string): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: prompt,
    config: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart?.inlineData) throw new Error('No image in Gemini response');

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const entry of IMAGES) {
    const localPath = path.join(OUT_DIR, entry.filename);
    const idx = IMAGES.indexOf(entry) + 1;
    console.log(`\n[${idx}/${IMAGES.length}] ${entry.filename}`);

    let buf: Buffer;

    if (fs.existsSync(localPath)) {
      console.log('  ↩ Already exists locally — re-uploading & re-seeding (delete file to force regen)');
      buf = fs.readFileSync(localPath);
    } else {
      console.log('  ⏳ Generating with Gemini…');
      buf = await callGemini(entry.prompt);
      fs.writeFileSync(localPath, buf);
      console.log('  ✓ Generated & saved');
    }

    const bucket = gcs.bucket(BUCKET_ID);
    const file = bucket.file(`public/ai-images/${entry.destFilename}`);
    await file.save(buf, { contentType: 'image/png', metadata: { cacheControl: 'public, max-age=31536000' } });
    const url = `/api/media/ai-image/${entry.destFilename}`;
    console.log(`  ✓ Uploaded: ${url}`);

    const tagsLiteral = sql.raw(`ARRAY[${entry.tags.map(t => `'${t}'`).join(',')}]::text[]`);
    for (const key of entry.cacheKeys) {
      const existing = await db.execute(sql`SELECT id FROM media_files WHERE search_query = ${key} LIMIT 1`);
      if (existing.rows.length > 0) {
        await db.execute(sql`UPDATE media_files SET url = ${url}, image_source = 'ai_generated' WHERE search_query = ${key}`);
        console.log(`    ↻ Updated: ${key}`);
      } else {
        await db.execute(sql`
          INSERT INTO media_files (id, media_type, url, filename, mime_type, title, description, tags, language, image_source, search_query, target_word, is_reviewed, usage_count)
          VALUES (gen_random_uuid(), 'image', ${url}, ${entry.destFilename}, 'image/png', ${key}, ${key}, ${tagsLiteral}, 'spanish', 'ai_generated', ${key}, ${key}, false, 0)
        `);
        console.log(`    ✓ Seeded: ${key}`);
      }
    }

    // Brief pause between calls to stay within Gemini rate limits
    if (idx < IMAGES.length) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ All ${IMAGES.length} adjective pairs processed with Gemini.`);
}

main().catch(err => { console.error(err); process.exit(1); });

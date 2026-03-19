/**
 * Regenerate all 8 remaining adjective contrast-pair images in a consistent
 * flat simple cartoon style — matching feliz/triste and rapido/lento.
 *
 * Strategy: avoid people entirely wherever possible. Use simple objects,
 * icons, animals, or shapes to convey each concept clearly.
 */

import OpenAI from 'openai';
import { Storage } from '@google-cloud/storage';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import https from 'https';

const OPENAI_KEY = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const BUCKET_ID  = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
const DB_URL     = process.env.NEON_SHARED_DATABASE_URL || '';
const SIDECAR    = 'http://127.0.0.1:1106';

if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');
if (!BUCKET_ID)  throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
if (!DB_URL)     throw new Error('NEON_SHARED_DATABASE_URL not set');

const openai = new OpenAI({ apiKey: OPENAI_KEY });

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

// Shared style — must match the feliz/triste and rapido/lento style exactly
const STYLE =
  'flat simple cartoon illustration, bold clean outlines, bright flat colours, ' +
  "children's picture-book style, simple shapes, no realistic detail, pure white background. " +
  'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.';

const IMAGES = [
  // ── cerca / lejos ──────────────────────────────────────────────────────────
  {
    filename: 'adj_cerca_lejos.png',
    destFilename: 'vocab_adj_cerca_lejos.png',
    prompt:
      'Two side-by-side panels showing NEAR vs FAR using size. ' +
      'LEFT panel — a large, colourful cartoon house fills most of the space; a tiny cartoon figure stands right beside the front door, nearly the same height as the door. ' +
      'RIGHT panel — the exact same house is now very tiny and distant at the far end of a long road stretching into the distance; the tiny cartoon figure is large in the foreground looking toward it. ' +
      'The enormous size difference between the two houses makes the concept instantly obvious. ' +
      'The two panels are separated by a clear dividing line. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_cerca', 'vocab_spanish_lejos'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── alto / bajo ────────────────────────────────────────────────────────────
  {
    filename: 'adj_alto_bajo.png',
    destFilename: 'vocab_adj_alto_bajo.png',
    prompt:
      'Two simple cartoon giraffe vs mouse comparison side by side, illustrating tall vs short. ' +
      'LEFT — a very tall cartoon giraffe with a long neck reaching up, its head near the top of the frame. ' +
      'RIGHT — a very small cartoon mouse standing on the ground, tiny, its head barely above the bottom of the frame. ' +
      'Both animals are cute and simple with bold outlines. ' +
      'The height contrast is dramatic and unmistakable. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_alto', 'vocab_spanish_bajo'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── pesado / ligero ────────────────────────────────────────────────────────
  {
    filename: 'adj_pesado_ligero.png',
    destFilename: 'vocab_adj_pesado_ligero.png',
    prompt:
      'Two simple objects side by side contrasting heavy vs light. ' +
      'LEFT — a large cartoon round grey boulder with cracks in it, sitting heavily on the ground, with small downward pressure lines underneath it indicating great weight. ' +
      'RIGHT — a single fluffy white cartoon feather floating lightly in the air, with a gentle upward wisp to show it is light as air. ' +
      'Clear, simple, iconic — no people involved. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_pesado', 'vocab_spanish_ligero'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── joven / viejo ──────────────────────────────────────────────────────────
  {
    filename: 'adj_joven_viejo_personas.png',
    destFilename: 'vocab_adj_joven_viejo_personas.png',
    prompt:
      'Two cartoon trees side by side showing young vs old. ' +
      'LEFT — a small young sapling: a thin green trunk with just a few bright green leaves and a fresh look, full of energy. ' +
      'RIGHT — a large ancient old tree: a thick gnarled trunk with many branches, a huge full canopy of leaves, and visible age rings or bark texture. ' +
      'The young tree is small and fresh; the old tree is massive and well-established. ' +
      'Simple, charming, no people. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_joven', 'vocab_spanish_viejo_persona'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── fácil / difícil ────────────────────────────────────────────────────────
  {
    filename: 'adj_facil_dificil.png',
    destFilename: 'vocab_adj_facil_dificil.png',
    prompt:
      'Two cartoon scenarios side by side contrasting easy vs difficult. ' +
      'LEFT — a single large cartoon puzzle piece clicking perfectly into place in a simple 2-piece puzzle; a big green checkmark above it shows success. Everything looks simple and happy. ' +
      'RIGHT — a chaotic pile of hundreds of tiny jumbled puzzle pieces in a messy heap with question marks floating around; it looks impossibly complicated. ' +
      'The contrast is immediately clear — one piece vs an overwhelming pile. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_facil', 'vocab_spanish_dificil'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── ruidoso / tranquilo ────────────────────────────────────────────────────
  {
    filename: 'adj_ruidoso_tranquilo.png',
    destFilename: 'vocab_adj_ruidoso_tranquilo.png',
    prompt:
      'Two cartoon icons side by side contrasting loud vs quiet. ' +
      'LEFT — a bright red cartoon megaphone or speaker blasting sound, with many bold jagged sound waves radiating outward in all directions, indicating extreme loudness. ' +
      'RIGHT — a calm cartoon crescent moon with a small sleeping face (closed eyes, peaceful expression) with no sound lines at all — just stillness, perhaps a tiny "zzz" floating up. ' +
      'The two icons are simple, bold, and immediately readable. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_ruidoso', 'vocab_spanish_tranquilo'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── oscuro / claro ─────────────────────────────────────────────────────────
  {
    filename: 'adj_oscuro_claro.png',
    destFilename: 'vocab_adj_oscuro_claro.png',
    prompt:
      'Two simple cartoon windows side by side contrasting dark vs bright. ' +
      'LEFT — a cartoon window with dark navy-blue curtains drawn shut; a crescent moon is visible through a small gap; the overall colour is dark and dim. ' +
      'RIGHT — the exact same cartoon window but with curtains wide open; bright yellow sunlight streams in with radiating sun rays; the overall colour is warm and bright. ' +
      'The two windows are simple and immediately convey the contrast. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_oscuro', 'vocab_spanish_claro'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── duro / suave ───────────────────────────────────────────────────────────
  {
    filename: 'adj_duro_suave.png',
    destFilename: 'vocab_adj_duro_suave.png',
    prompt:
      'Two simple cartoon objects side by side contrasting hard vs soft. ' +
      'LEFT — a rough jagged grey rock/boulder with angular sharp edges and cracks, looking very solid and hard. ' +
      'RIGHT — a round plump cartoon pillow with a simple smiley face, soft curved edges, and squiggly lines to suggest fluffiness and softness. ' +
      'The hard angular rock vs the soft round pillow is an immediately clear contrast. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_duro', 'vocab_spanish_suave', 'vocab_spanish_blando'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },
];

async function downloadUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    https.get(url, (res) => {
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const entry of IMAGES) {
    const localPath = path.join(OUT_DIR, entry.filename);
    const idx = IMAGES.indexOf(entry) + 1;
    console.log(`\n[${idx}/${IMAGES.length}] ${entry.filename}`);

    if (fs.existsSync(localPath)) {
      console.log('  ↩ Already exists locally — skipping generation');
      // Still re-upload and re-seed in case DB is stale
      const buf = fs.readFileSync(localPath);
      const bucket = gcs.bucket(BUCKET_ID);
      const file = bucket.file(`public/ai-images/${entry.destFilename}`);
      await file.save(buf, { contentType: 'image/png', metadata: { cacheControl: 'public, max-age=31536000' } });
      const url = `/api/media/ai-image/${entry.destFilename}`;
      const tagsLiteral = sql.raw(`ARRAY[${entry.tags.map(t => `'${t}'`).join(',')}]::text[]`);
      for (const key of entry.cacheKeys) {
        await db.execute(sql`UPDATE media_files SET url = ${url} WHERE search_query = ${key}`);
        console.log(`    ↻ Updated: ${key}`);
      }
      continue;
    }

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: entry.prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    });

    const imageUrl = response.data?.[0]?.url!;
    const buf = await downloadUrl(imageUrl);
    fs.writeFileSync(localPath, buf);
    console.log('  ✓ Generated & saved');

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

    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n✅ All ${IMAGES.length} adjective pairs regenerated.`);
}

main().catch(err => { console.error(err); process.exit(1); });

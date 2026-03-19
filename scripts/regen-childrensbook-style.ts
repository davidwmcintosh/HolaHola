/**
 * Regenerate adjectives + activities in "soft watercolor children's book illustration" style.
 * This is now the canonical style for all generated assets.
 * Bumps DB URLs to ?v=4.
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
    audience: 'replit', subject_token_type: 'access_token',
    token_url: `${SIDECAR}/token`, type: 'external_account',
    credential_source: { url: `${SIDECAR}/credential`, format: { type: 'json', subject_token_field_name: 'access_token' } },
    universe_domain: 'googleapis.com',
  } as any,
  projectId: '',
});
const sqlClient = neon(DB_URL);
const db = drizzle(sqlClient);
const OUT_DIR = path.join(process.cwd(), 'attached_assets/generated_images/vocab');

// Canonical style — used going forward for all generated assets
const S =
  'Soft watercolor children\'s book illustration style, warm gentle colors, light pencil outlines, ' +
  'visible brushwork texture, no text or letters anywhere in the image, white background.';

// For images with characters
const CHAR =
  'Characters have friendly expressive faces, warm skin tones, natural proportions — ' +
  'illustrated not photorealistic, suitable for all ages and cultures.';

const VERSION = 'v=4';

interface Entry {
  filename: string; destFilename: string; prompt: string;
  cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [

  // ── ADJECTIVES ──────────────────────────────────────────────────────────────

  {
    filename: 'adj_feliz_triste.png', destFilename: 'vocab_adj_feliz_triste.png',
    prompt:
      'Two expressive cartoon faces side by side. Left face has a big warm smile, rosy cheeks, ' +
      'and bright happy eyes — radiating cheerful joy. Right face has a downturned mouth, ' +
      'a teardrop on the cheek, and gentle sad eyes. Both faces are round and charming. ' + S,
    cacheKeys: ['vocab_spanish_feliz', 'vocab_spanish_triste', 'vocab_spanish_alegre'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_rapido_lento.png', destFilename: 'vocab_adj_rapido_lento.png',
    prompt:
      'A rabbit and a snail on a racetrack. The rabbit is sprinting far ahead near the finish ' +
      'line with speed lines behind it. The snail is barely at the start, moving peacefully. ' +
      'The gap between them makes the contrast obvious. Both animals are charming and friendly. ' + S,
    cacheKeys: ['vocab_spanish_rapido', 'vocab_spanish_lento'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_cerca_lejos.png', destFilename: 'vocab_adj_cerca_lejos.png',
    prompt:
      'Split scene: left half shows a large colourful house filling the frame with a small ' +
      'character standing right next to the front door. Right half shows the same tiny house ' +
      'at the end of a long winding path with the character large in the foreground. ' +
      'Size contrast is dramatic and clear. ' + S + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_cerca', 'vocab_spanish_lejos'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_alto_bajo.png', destFilename: 'vocab_adj_alto_bajo.png',
    prompt:
      'A very tall giraffe standing beside a very small mouse for size comparison. ' +
      'The giraffe\'s neck stretches high; the little mouse barely reaches the giraffe\'s ankle. ' +
      'Both animals are friendly, rounded, and charmingly illustrated. ' + S,
    cacheKeys: ['vocab_spanish_alto', 'vocab_spanish_bajo'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_pesado_ligero.png', destFilename: 'vocab_adj_pesado_ligero.png',
    prompt:
      'Two objects side by side: a large grey boulder sitting heavily on the ground with weight ' +
      'lines underneath, and a single delicate feather floating upward with a wispy trail. ' +
      'Clear contrast between heavy and light. Beautifully illustrated with warmth. ' + S,
    cacheKeys: ['vocab_spanish_pesado', 'vocab_spanish_ligero'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_joven_viejo_personas.png', destFilename: 'vocab_adj_joven_viejo_personas.png',
    prompt:
      'Two trees side by side: a small bright sapling with a slender green trunk and fresh ' +
      'leaves on the left, and a grand old tree with a wide gnarled trunk and full lush canopy ' +
      'on the right. Both trees have personality and warmth. ' + S,
    cacheKeys: ['vocab_spanish_joven', 'vocab_spanish_viejo_persona'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_facil_dificil.png', destFilename: 'vocab_adj_facil_dificil.png',
    prompt:
      'Split scene: left shows a single puzzle piece clicking smoothly into a simple 2-piece ' +
      'puzzle with a green checkmark above — easy and satisfying. Right shows a huge chaotic ' +
      'pile of hundreds of tiny puzzle pieces with question marks floating around — overwhelming. ' + S,
    cacheKeys: ['vocab_spanish_facil', 'vocab_spanish_dificil'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_ruidoso_tranquilo.png', destFilename: 'vocab_adj_ruidoso_tranquilo.png',
    prompt:
      'Two icons side by side: a bright red megaphone with bold wavy sound lines radiating ' +
      'outward on the left, and a peaceful crescent moon with a sleepy face — closed eyes, ' +
      'gentle smile — against a soft starry night sky on the right. ' + S,
    cacheKeys: ['vocab_spanish_ruidoso', 'vocab_spanish_tranquilo'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_oscuro_claro.png', destFilename: 'vocab_adj_oscuro_claro.png',
    prompt:
      'Two windows side by side: left window has heavy curtains drawn with deep navy tones ' +
      'and a crescent moon peeking through — dim and dark. Right window has curtains wide open ' +
      'with warm golden sunlight streaming in — bright and cheerful. ' + S,
    cacheKeys: ['vocab_spanish_oscuro', 'vocab_spanish_claro'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_duro_suave.png', destFilename: 'vocab_adj_duro_suave.png',
    prompt:
      'Two objects side by side: a craggy angular rock with a rough cracked surface on the ' +
      'left, and a plump fluffy pillow with gentle curves and soft pastel colours on the right. ' +
      'Hard vs soft, beautifully illustrated with charm. ' + S,
    cacheKeys: ['vocab_spanish_duro', 'vocab_spanish_suave', 'vocab_spanish_blando'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  // ── ACTIVITIES ──────────────────────────────────────────────────────────────

  {
    filename: 'act_comprar.png', destFilename: 'vocab_act_comprar.png',
    prompt:
      'A person happily shopping, carrying a colourful basket with groceries. ' +
      'Store shelves with bright products are visible in the background. ' +
      'Cheerful and inviting scene. ' + S + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_comprar'],
    tags: ['vocabulary', 'novice_mid', 'activities'],
  },

  {
    filename: 'act_cocinar.png', destFilename: 'vocab_act_cocinar.png',
    prompt:
      'A person wearing a white chef\'s hat and apron happily stirring a large steaming pot ' +
      'on a bright kitchen stove. Steam puffs rise from the pot. Warm and inviting kitchen scene. ' +
      S + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_cocinar'],
    tags: ['vocabulary', 'novice_mid', 'activities'],
  },

  {
    filename: 'act_bailar.png', destFilename: 'vocab_act_bailar.png',
    prompt:
      'Two people dancing joyfully together, arms raised, in lively dance poses. ' +
      'One wears a warm orange outfit, the other a cool blue outfit. ' +
      'Musical notes float around them. Energetic and fun scene. ' + S + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_bailar'],
    tags: ['vocabulary', 'novice_mid', 'activities'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function downloadUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    https.get(url, res => {
      res.on('data', c => chunks.push(c));
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

    let buf: Buffer;
    if (fs.existsSync(localPath)) {
      console.log('  ↩ Reusing local file');
      buf = fs.readFileSync(localPath);
    } else {
      const response = await openai.images.generate({
        model: 'dall-e-3', prompt: entry.prompt,
        n: 1, size: '1024x1024', quality: 'standard', response_format: 'url',
      });
      buf = await downloadUrl(response.data![0].url!);
      fs.writeFileSync(localPath, buf);
      console.log('  ✓ Generated & saved');
    }

    const bucket = gcs.bucket(BUCKET_ID);
    await bucket.file(`public/ai-images/${entry.destFilename}`).save(buf, {
      contentType: 'image/png', metadata: { cacheControl: 'public, max-age=3600' },
    });
    const url = `/api/media/ai-image/${entry.destFilename}?${VERSION}`;
    console.log(`  ✓ Uploaded`);

    const tagsLiteral = sql.raw(`ARRAY[${entry.tags.map(t => `'${t}'`).join(',')}]::text[]`);
    for (const key of entry.cacheKeys) {
      const ex = await db.execute(sql`SELECT id FROM media_files WHERE search_query = ${key} LIMIT 1`);
      if (ex.rows.length > 0) {
        await db.execute(sql`UPDATE media_files SET url = ${url}, image_source = 'ai_generated' WHERE search_query = ${key}`);
        console.log(`    ↻ Updated DB: ${key}`);
      } else {
        await db.execute(sql`
          INSERT INTO media_files (id,media_type,url,filename,mime_type,title,description,tags,language,image_source,search_query,target_word,is_reviewed,usage_count)
          VALUES (gen_random_uuid(),'image',${url},${entry.destFilename},'image/png',${key},${key},${tagsLiteral},'spanish','ai_generated',${key},${key},false,0)
        `);
        console.log(`    ✓ Seeded DB: ${key}`);
      }
    }

    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n✅ All ${IMAGES.length} images regenerated in children's book illustration style.`);
}

main().catch(err => { console.error(err); process.exit(1); });

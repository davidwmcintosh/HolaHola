/**
 * Regenerate adjectives + problem activities in a "middle ground" illustrated style:
 * - Warm soft watercolour-textured illustration
 * - Clean bold outlines
 * - Friendly rounded characters, NOT realistic anatomy or facial detail
 * - NOT flat digital cartoon
 * - Think: modern children's picture book / greeting-card illustration
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

// Middle-ground style: illustrated warmth without photorealism
const S =
  'Warm charming illustration style: clean bold outlines, soft watercolour-like colour fills with gentle texture, ' +
  'vibrant cheerful colours, friendly rounded shapes, children\'s picture-book quality. ' +
  'NOT photorealistic. NOT flat digital cartoon. ' +
  'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image. White background.';

// For scenes with characters: extra character guidance
const CHAR =
  'Any characters must have simple rounded heads with dot eyes and small smiles, ' +
  'no realistic skin texture, no detailed facial features, no ethnically specific markers, ' +
  'simple brightly coloured clothing. Gender-neutral unless context requires otherwise.';

interface Entry {
  filename: string; destFilename: string; prompt: string;
  cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [

  // ── ADJECTIVES ──────────────────────────────────────────────────────────────

  {
    filename: 'adj_feliz_triste.png', destFilename: 'vocab_adj_feliz_triste.png',
    prompt:
      'Two large expressive faces side by side on a white background. ' +
      'LEFT — a cheerful round face with a big warm smile, rosy cheeks, and crinkled happy eyes, radiating joy with a warm golden glow around it. ' +
      'RIGHT — a sad round face with a downturned mouth, a single glistening teardrop on the cheek, and droopy eyes, surrounded by a cool blue-grey mood. ' +
      'Both faces are simple and charming, like friendly characters in a children\'s book — expressive but not photo-real. ' + S,
    cacheKeys: ['vocab_spanish_feliz', 'vocab_spanish_triste', 'vocab_spanish_alegre'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  {
    filename: 'adj_rapido_lento.png', destFilename: 'vocab_adj_rapido_lento.png',
    prompt:
      'A fun illustrated scene of a rabbit racing a snail. ' +
      'The rabbit is far in the lead, almost at the finish-line banner, with bold swooshing speed lines behind it and a gleeful expression. ' +
      'Far in the background, the tiny snail is barely at the starting line, moving peacefully with no hurry. ' +
      'The enormous gap between them makes the contrast completely clear. ' +
      'Both animals are charming and rounded, illustrated in a warm storybook style. ' + S,
    cacheKeys: ['vocab_spanish_rapido', 'vocab_spanish_lento'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  {
    filename: 'adj_cerca_lejos.png', destFilename: 'vocab_adj_cerca_lejos.png',
    prompt:
      'Two illustrated panels separated by a dividing line, showing near vs far. ' +
      'LEFT — a large colourful cartoon house fills the frame; a small friendly illustrated character stands right next to the front door, nearly touching it. ' +
      'RIGHT — the same house is tiny and distant at the end of a long winding path; the same character stands large in the foreground looking toward the tiny house far away. ' +
      'The size difference is dramatic and immediately obvious. ' + S + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_cerca', 'vocab_spanish_lejos'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  {
    filename: 'adj_alto_bajo.png', destFilename: 'vocab_adj_alto_bajo.png',
    prompt:
      'A charming illustrated scene with a very tall cartoon giraffe next to a very small cartoon mouse, side by side for comparison. ' +
      'The giraffe stretches up tall with its neck reaching high; the little mouse stands at ground level barely reaching the giraffe\'s ankle. ' +
      'Both animals are friendly and rounded, illustrated in a warm storybook style. ' + S,
    cacheKeys: ['vocab_spanish_alto', 'vocab_spanish_bajo'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  {
    filename: 'adj_pesado_ligero.png', destFilename: 'vocab_adj_pesado_ligero.png',
    prompt:
      'Two illustrated objects side by side. ' +
      'LEFT — a large rough boulder sitting heavily on the ground, with stress lines underneath showing its great weight, earthy grey-brown tones. ' +
      'RIGHT — a single elegant feather floating gently upward, delicate and airy, soft warm colours with a wispy trail. ' +
      'Both are beautifully rendered with charm and warmth. ' + S,
    cacheKeys: ['vocab_spanish_pesado', 'vocab_spanish_ligero'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  {
    filename: 'adj_joven_viejo_personas.png', destFilename: 'vocab_adj_joven_viejo_personas.png',
    prompt:
      'Two illustrated trees side by side showing young vs old. ' +
      'LEFT — a small bright sapling: a slender green trunk with just a few fresh leaves, full of youthful energy and a cheerful spring-green colour. ' +
      'RIGHT — a grand old tree: a wide gnarled trunk, sweeping branches, and a full lush canopy with rich deep greens, suggesting age and wisdom. ' +
      'Both trees have personality and warmth, illustrated with charm. ' + S,
    cacheKeys: ['vocab_spanish_joven', 'vocab_spanish_viejo_persona'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  {
    filename: 'adj_facil_dificil.png', destFilename: 'vocab_adj_facil_dificil.png',
    prompt:
      'Two illustrated scenes side by side showing easy vs difficult. ' +
      'LEFT — a single puzzle piece clicking smoothly into a simple 2-piece puzzle, with a cheerful green checkmark floating above; clean, simple, happy. ' +
      'RIGHT — a chaotic mountain of hundreds of tiny jumbled puzzle pieces with question marks and sweat drops floating around; overwhelming and complicated. ' +
      'Clear contrast, warm illustration style. ' + S,
    cacheKeys: ['vocab_spanish_facil', 'vocab_spanish_dificil'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  {
    filename: 'adj_ruidoso_tranquilo.png', destFilename: 'vocab_adj_ruidoso_tranquilo.png',
    prompt:
      'Two illustrated icons side by side. ' +
      'LEFT — a bright red megaphone or speaker with bold wavy sound lines radiating outward in all directions, energetic and loud. ' +
      'RIGHT — a peaceful crescent moon with a sleepy face — closed eyes, gentle smile — set against a soft starry night sky; utter calm and silence. ' +
      'Both icons are charming and expressive in a warm illustrated style. ' + S,
    cacheKeys: ['vocab_spanish_ruidoso', 'vocab_spanish_tranquilo'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  {
    filename: 'adj_oscuro_claro.png', destFilename: 'vocab_adj_oscuro_claro.png',
    prompt:
      'Two illustrated windows side by side. ' +
      'LEFT — a window with heavy curtains drawn shut, deep navy and purple tones, a crescent moon peeking through a small gap, dim and mysterious. ' +
      'RIGHT — the same window with curtains wide open, warm golden sunlight pouring in with rays fanning outward, bright and cheerful yellows and oranges. ' +
      'Both windows are charmingly illustrated with warmth and character. ' + S,
    cacheKeys: ['vocab_spanish_oscuro', 'vocab_spanish_claro'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  {
    filename: 'adj_duro_suave.png', destFilename: 'vocab_adj_duro_suave.png',
    prompt:
      'Two illustrated objects side by side showing hard vs soft. ' +
      'LEFT — a craggy angular rock with sharp edges and a rough cracked surface, solid and unyielding, cool grey tones. ' +
      'RIGHT — a plump round pillow with a cheerful stitched smile, cloud-soft curves, warm pastel colours and gentle texture suggesting fluffiness. ' +
      'Both objects are beautifully illustrated with charm. ' + S,
    cacheKeys: ['vocab_spanish_duro', 'vocab_spanish_suave', 'vocab_spanish_blando'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },

  // ── ACTIVITIES ──────────────────────────────────────────────────────────────

  {
    filename: 'act_comprar.png', destFilename: 'vocab_act_comprar.png',
    prompt:
      'A friendly illustrated character shopping in a bright grocery store. ' +
      'The character has a simple round head, dot eyes, and a happy smile; they wear plain casual clothes and carry a colourful shopping basket with a few items in it. ' +
      'The store shelves behind them are lined with colourful products. Cheerful and inviting scene. ' +
      S + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_comprar'],
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
  },

  {
    filename: 'act_cocinar.png', destFilename: 'vocab_act_cocinar.png',
    prompt:
      'A single friendly illustrated character cooking in a kitchen. ' +
      'The character wears a tall white chef\'s hat and a simple apron, and is happily stirring a large steaming pot on a cheerful cartoon stove. ' +
      'Steam puffs rise from the pot. The scene is warm and inviting. One character, no other people. ' +
      S + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_cocinar'],
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
  },

  {
    filename: 'act_bailar.png', destFilename: 'vocab_act_bailar.png',
    prompt:
      'Two friendly illustrated characters dancing joyfully together. ' +
      'Both characters have simple round heads, dot eyes, and big smiles. ' +
      'They wear simple, modest, brightly coloured outfits — one in a warm orange top and trousers, the other in a cool blue dress or shirt. ' +
      'Their arms are raised, bodies in a lively dance pose, with musical notes floating around them. ' +
      'The scene is energetic, fun, and modest. ' +
      S + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_bailar'],
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    const url = `/api/media/ai-image/${entry.destFilename}?v=3`;
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

  console.log(`\n✅ All ${IMAGES.length} images regenerated in middle-ground style.`);
}

main().catch(err => { console.error(err); process.exit(1); });

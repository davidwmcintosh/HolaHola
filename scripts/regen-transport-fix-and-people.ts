/**
 * Two jobs in one script:
 * 1. Regenerate car + train (had pencil artifacts from "light pencil outlines" in style)
 * 2. Regenerate all 10 Novice Mid people images in the canonical children's book style
 *
 * Style fix: "light pencil outlines" → "clean fine ink outlines" (no more literal pencils)
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

// Fixed style — "clean fine ink outlines" replaces "light pencil outlines" to prevent literal pencil artefacts
const PROP =
  'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, ' +
  'visible brushwork texture, object centred and prominent on a clean pure white background, ' +
  'no background elements, clear and recognisable silhouette. ' +
  'Absolutely no text, no letters, no words, no objects other than the subject.';

const SCENE =
  'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, ' +
  'visible brushwork texture, friendly and inviting scene. ' +
  'No text, no signs, no labels anywhere in the image. Suitable for all ages.';

const CHAR =
  'Characters have natural proportions and softly illustrated faces — warm and expressive, ' +
  'not exaggerated, no clown features. Professional and approachable in appearance.';

interface Entry {
  filename: string; destFilename: string; prompt: string;
  cacheKeys: string[]; tags: string[]; version: string;
}

const IMAGES: Entry[] = [

  // ── TRANSPORT FIXES (pencil artifact) ─────────────────────────────────────

  {
    filename: 'trans_tren.png', destFilename: 'vocab_trans_tren.png',
    prompt:
      'A passenger train — a sleek modern rail carriage viewed from a slight angle showing the ' +
      'front and one side. Warm red colour scheme with clean windows. ' +
      'Only the train, nothing else. ' + PROP,
    cacheKeys: ['vocab_spanish_tren'],
    tags: ['vocabulary', 'novice_high', 'transport'],
    version: 'v=2',
  },

  {
    filename: 'trans_coche.png', destFilename: 'vocab_trans_coche.png',
    prompt:
      'A compact family car viewed from a slight front-side angle. Cheerful orange colour, ' +
      'friendly rounded design. Clean white background. Only the car, nothing else whatsoever. ' + PROP,
    cacheKeys: ['vocab_spanish_coche', 'vocab_spanish_carro', 'vocab_spanish_auto'],
    tags: ['vocabulary', 'novice_high', 'transport'],
    version: 'v=2',
  },

  // ── NOVICE MID PEOPLE — new children's book style ────────────────────────

  {
    filename: 'ppl_abuelos.png', destFilename: 'vocab_ppl_abuelos.png',
    prompt:
      'A loving elderly couple sitting together on a warm sunny porch. ' +
      'The grandfather has silver hair, glasses, and a kind smile. ' +
      'The grandmother has white hair and wears a colourful floral blouse. ' +
      'Both look warmly at the viewer, relaxed and happy together. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_abuelo', 'vocab_spanish_abuela'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
  },

  {
    filename: 'ppl_tios.png', destFilename: 'vocab_ppl_tios.png',
    prompt:
      'A cheerful middle-aged uncle and aunt standing side by side, both smiling warmly. ' +
      'The uncle wears a casual shirt, the aunt a colourful blouse. ' +
      'Friendly family portrait feel, warm outdoor or living-room background. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_tio', 'vocab_spanish_tia'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
  },

  {
    filename: 'ppl_primos.png', destFilename: 'vocab_ppl_primos.png',
    prompt:
      'A boy and a girl about 10 years old — cousins — laughing and playing together ' +
      'in a sunny backyard, perhaps kicking a ball or running. Energetic and joyful. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_primo', 'vocab_spanish_prima'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
  },

  {
    filename: 'ppl_medico.png', destFilename: 'vocab_ppl_medico.png',
    prompt:
      'A friendly doctor in a white coat with a stethoscope around their neck, ' +
      'standing in a bright modern clinic and smiling warmly at the viewer. ' +
      'Professional and approachable. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_medico', 'vocab_spanish_medica', 'vocab_spanish_doctor'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
  },

  {
    filename: 'ppl_enfermero.png', destFilename: 'vocab_ppl_enfermero.png',
    prompt:
      'A caring nurse in blue scrubs holding a clipboard, standing in a bright hospital hallway. ' +
      'Gentle professional expression and warm smile. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_enfermero', 'vocab_spanish_enfermera'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
  },

  {
    filename: 'ppl_policia.png', destFilename: 'vocab_ppl_policia.png',
    prompt:
      'A friendly police officer in a dark uniform with a badge, waving or standing on a ' +
      'sunny city street. Approachable and helpful expression. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_policia'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
  },

  {
    filename: 'ppl_cocinero.png', destFilename: 'vocab_ppl_cocinero.png',
    prompt:
      'A cheerful chef in a white chef\'s coat and tall white hat, enthusiastically stirring ' +
      'a pot in a warm restaurant kitchen with steam rising. Happy and energetic. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_cocinero', 'vocab_spanish_cocinera'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
  },

  {
    filename: 'ppl_bombero.png', destFilename: 'vocab_ppl_bombero.png',
    prompt:
      'A brave firefighter in yellow and black protective gear — yellow helmet, heavy fireproof coat — ' +
      'standing proudly in front of a shiny red fire truck. Heroic and friendly expression. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_bombero', 'vocab_spanish_bombera'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
  },

  {
    filename: 'ppl_dentista.png', destFilename: 'vocab_ppl_dentista.png',
    prompt:
      'A friendly dentist in a white coat and safety glasses, smiling beside a modern dental chair ' +
      'in a bright clean dental office. Calm and welcoming atmosphere. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_dentista'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
  },

  {
    filename: 'ppl_familia_extendida.png', destFilename: 'vocab_ppl_familia_extendida.png',
    prompt:
      'A joyful extended family gathered around a large dining table — elderly grandparents at the head, ' +
      'parents, an uncle and aunt, and several children including young cousins. ' +
      'Colourful food on the table, warm lighting, a celebration or Sunday dinner atmosphere. ' +
      'Wide shot showing all family members clearly, full of warmth and togetherness. ' +
      SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_familia_extendida'],
    tags: ['vocabulary', 'novice_mid', 'people'],
    version: 'v=1',
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
    const url = `/api/media/ai-image/${entry.destFilename}?${entry.version}`;
    console.log(`  ✓ Uploaded → ${url}`);

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

  console.log(`\n✅ All ${IMAGES.length} images regenerated.`);
}

main().catch(err => { console.error(err); process.exit(1); });

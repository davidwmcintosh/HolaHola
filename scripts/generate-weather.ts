/**
 * Section 2 — Weather images (9 individual weather scenes + 1 summary card)
 * Version: v=1
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

const BASE = 'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture. No text, no words, no letters anywhere. Clear and recognisable scene.';

interface Entry {
  filename: string; destFilename: string; prompt: string; cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [
  {
    filename: 'weather_soleado.png', destFilename: 'vocab_weather_soleado.png',
    prompt: 'A cheerful sunny day scene — bright yellow sun high in a clear blue sky, a few fluffy white clouds, green grass. Happy summer weather. ' + BASE,
    cacheKeys: ['vocab_spanish_soleado', 'vocab_spanish_sol_tiempo', 'vocab_weather_soleado'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  {
    filename: 'weather_nublado.png', destFilename: 'vocab_weather_nublado.png',
    prompt: 'An overcast cloudy day — the sky is filled with overlapping grey-white clouds, no sun visible, but not raining yet. Soft and moody. ' + BASE,
    cacheKeys: ['vocab_spanish_nublado', 'vocab_weather_nublado'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  {
    filename: 'weather_lluvioso.png', destFilename: 'vocab_weather_lluvioso.png',
    prompt: 'A rainy day scene — rain falling from dark clouds with diagonal rain streaks, puddles on the ground, a person holding a colourful umbrella. ' + BASE,
    cacheKeys: ['vocab_spanish_lluvioso', 'vocab_spanish_lluvia', 'vocab_weather_lluvioso'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  {
    filename: 'weather_nevado.png', destFilename: 'vocab_weather_nevado.png',
    prompt: 'A snowy winter scene — snowflakes falling gently from a grey sky, ground covered in white snow, a snowman in the foreground. Peaceful and magical. ' + BASE,
    cacheKeys: ['vocab_spanish_nevado', 'vocab_spanish_nieve', 'vocab_weather_nevado'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  {
    filename: 'weather_tormentoso.png', destFilename: 'vocab_weather_tormentoso.png',
    prompt: 'A dramatic storm scene — dark purple-grey clouds with a lightning bolt striking, heavy rain, and strong wind visible through bent trees. Dramatic but storybook-friendly. ' + BASE,
    cacheKeys: ['vocab_spanish_tormentoso', 'vocab_spanish_tormenta', 'vocab_weather_tormentoso'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  {
    filename: 'weather_ventoso.png', destFilename: 'vocab_weather_ventoso.png',
    prompt: 'A windy day scene — strong wind shown by leaves and papers blowing through the air, a person\'s hair and coat blown sideways. A few bent trees. ' + BASE,
    cacheKeys: ['vocab_spanish_ventoso', 'vocab_spanish_viento', 'vocab_weather_ventoso'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  {
    filename: 'weather_neblinoso.png', destFilename: 'vocab_weather_neblinoso.png',
    prompt: 'A foggy misty scene — buildings and trees fading into white-grey fog in the distance, visibility low. A lonely street or field disappearing into mist. ' + BASE,
    cacheKeys: ['vocab_spanish_neblinoso', 'vocab_spanish_niebla', 'vocab_spanish_neblina', 'vocab_weather_neblinoso'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  {
    filename: 'weather_caluroso.png', destFilename: 'vocab_weather_caluroso.png',
    prompt: 'A very hot day scene — a blazing sun, heat waves rising from the ground, a person in summer clothes fanning themselves and sweating. Hot summer midday. ' + BASE,
    cacheKeys: ['vocab_spanish_caluroso', 'vocab_spanish_calor', 'vocab_weather_caluroso'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  {
    filename: 'weather_frio.png', destFilename: 'vocab_weather_frio.png',
    prompt: 'A very cold day scene — frost on the ground, a person bundled up in a thick coat, scarf, hat, and gloves, breath visible as steam in the cold air. Winter chill. ' + BASE,
    cacheKeys: ['vocab_spanish_frio_tiempo', 'vocab_spanish_frio_clima', 'vocab_weather_frio'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
];

async function downloadUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    https.get(url, res => { res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks))); res.on('error', reject); }).on('error', reject);
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
      console.log('  ↩ Reusing local file'); buf = fs.readFileSync(localPath);
    } else {
      const r = await openai.images.generate({ model: 'dall-e-3', prompt: entry.prompt, n: 1, size: '1024x1024', quality: 'standard', response_format: 'url' });
      buf = await downloadUrl(r.data![0].url!); fs.writeFileSync(localPath, buf); console.log('  ✓ Generated & saved');
    }
    await gcs.bucket(BUCKET_ID).file(`public/ai-images/${entry.destFilename}`).save(buf, { contentType: 'image/png', metadata: { cacheControl: 'public, max-age=3600' } });
    const url = `/api/media/ai-image/${entry.destFilename}?v=1`;
    console.log(`  ✓ Uploaded → ${url}`);
    const tagsLit = sql.raw(`ARRAY[${entry.tags.map(t => `'${t}'`).join(',')}]::text[]`);
    for (const key of entry.cacheKeys) {
      const ex = await db.execute(sql`SELECT id FROM media_files WHERE search_query = ${key} LIMIT 1`);
      if (ex.rows.length > 0) { await db.execute(sql`UPDATE media_files SET url = ${url} WHERE search_query = ${key}`); console.log(`    ↻ ${key}`); }
      else { await db.execute(sql`INSERT INTO media_files (id,media_type,url,filename,mime_type,title,description,tags,language,image_source,search_query,target_word,is_reviewed,usage_count) VALUES (gen_random_uuid(),'image',${url},${entry.destFilename},'image/png',${key},${key},${tagsLit},'spanish','ai_generated',${key},${key},false,0)`); console.log(`    ✓ Seeded: ${key}`); }
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\n✅ All ${IMAGES.length} weather images done.`);
}
main().catch(err => { console.error(err); process.exit(1); });

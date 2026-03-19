/**
 * Refresh Novice Low people images + add vecino (neighbour)
 * Updates 7 old-style images + 1 new image to canonical children's book style.
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

const SCENE = 'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture, friendly and welcoming scene. No text, no signs, no labels anywhere in the image. Suitable for all ages.';
const CHAR  = 'Characters have natural proportions and softly illustrated faces — warm and expressive, not exaggerated, no clown features.';

interface Entry {
  filename: string; destFilename: string; prompt: string; cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [
  {
    filename: 'people_familia.png', destFilename: 'vocab_people_familia.png',
    prompt: 'A warm family portrait: mother, father, teenage son, young daughter, and a baby sitting together on a sofa in a cosy living room, all smiling happily. The family looks diverse and welcoming. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_familia', 'vocab_spanish_madre', 'vocab_spanish_padre', 'vocab_spanish_hermano', 'vocab_spanish_hermana', 'vocab_spanish_bebe'],
    tags: ['vocabulary', 'novice_low', 'people'],
  },
  {
    filename: 'people_ninos.png', destFilename: 'vocab_people_ninos.png',
    prompt: 'A boy and a girl about 8 years old standing side by side, both smiling cheerfully. The boy has a backpack; the girl holds a colourful book. Outdoor school setting in the background. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_nino', 'vocab_spanish_nina'],
    tags: ['vocabulary', 'novice_low', 'people'],
  },
  {
    filename: 'people_amigos.png', destFilename: 'vocab_people_amigos.png',
    prompt: 'Two friends — a young man and a young woman — laughing and greeting each other with a wave, standing outdoors on a sunny day. Clearly good friends, relaxed and happy. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_amigo', 'vocab_spanish_amiga'],
    tags: ['vocabulary', 'novice_low', 'people'],
  },
  {
    filename: 'people_hombre.png', destFilename: 'vocab_people_hombre.png',
    prompt: 'A friendly adult man standing and smiling warmly, dressed in casual clothes — shirt and trousers. Simple outdoor background. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_hombre'],
    tags: ['vocabulary', 'novice_low', 'people'],
  },
  {
    filename: 'people_mujer.png', destFilename: 'vocab_people_mujer.png',
    prompt: 'A friendly adult woman standing and smiling warmly, dressed in casual clothes — a colourful top and trousers. Simple outdoor background. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_mujer'],
    tags: ['vocabulary', 'novice_low', 'people'],
  },
  {
    filename: 'people_profesor.png', destFilename: 'vocab_people_profesor.png',
    prompt: 'A teacher standing at a classroom board, smiling and gesturing welcomingly toward the class. The blackboard is behind them. Professional and approachable. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_profesor', 'vocab_spanish_profesora'],
    tags: ['vocabulary', 'novice_low', 'people'],
  },
  {
    filename: 'people_estudiante.png', destFilename: 'vocab_people_estudiante.png',
    prompt: 'A student sitting at a desk in a bright classroom, attentively writing in a notebook with a pencil, books on the desk beside them. Enthusiastic and engaged expression. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_estudiante'],
    tags: ['vocabulary', 'novice_low', 'people'],
  },
  {
    filename: 'ppl_vecino.png', destFilename: 'vocab_ppl_vecino.png',
    prompt: 'Two neighbours — a man and a woman — greeting each other warmly at a garden fence or doorstep, one waving hello with a friendly smile. A cosy residential street or garden in the background. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_vecino', 'vocab_spanish_vecina'],
    tags: ['vocabulary', 'novice_mid', 'people'],
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
  console.log(`\n✅ All ${IMAGES.length} Novice Low people images done.`);
}
main().catch(err => { console.error(err); process.exit(1); });

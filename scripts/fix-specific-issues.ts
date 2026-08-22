/**
 * Fix 5 specific issues reported by user:
 * 1. avion — 3.5 wings → explicit 2-wing prompt → v=2
 * 2. metro — pencil artifacts → regen → v=2
 * 3. nervioso — too culturally specific → neutral/universal → v=2
 * 4. time_meses — illegible text in image → no-text redesign → v=2
 * 5. time_dias_semana — illegible text in image → no-text redesign → v=2
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

const BASE = 'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture. No text, no words, no letters, no numbers, no signs, no labels of any kind anywhere in the image.';
const PROP = BASE + ' Object centred and prominent on a clean pure white background, no background elements, clear and recognisable silhouette.';

interface Entry {
  filename: string; destFilename: string; prompt: string; version: number; cacheKeys: string[]; tags: string[];
}

const FIXES: Entry[] = [
  // ── FIX 1: avion — 3.5 wings ─────────────────────────────────────────────
  {
    filename: 'trans_avion.png', destFilename: 'vocab_trans_avion.png',
    prompt: 'A classic large commercial passenger airplane viewed from a 3/4 front angle in flight. The plane has EXACTLY TWO swept wings — one on the left side and one on the right side of the fuselage only, no other wings. Two jet engines are mounted under the two wings. White fuselage with a blue tail fin stripe. Standard wide-body commercial airliner shape. Clean sky-blue background. ' + BASE,
    version: 2,
    cacheKeys: ['vocab_spanish_avion', 'vocab_spanish_aeroplano', 'vocab_spanish_vuelo'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },
  // ── FIX 2: metro — pencil artifacts ──────────────────────────────────────
  {
    filename: 'trans_metro.png', destFilename: 'vocab_trans_metro.png',
    prompt: 'A modern underground subway train in a clean bright metro station. The train is silver and blue with a rounded front, sitting on tracks beside a platform. The station has columns and a tiled ceiling. The image contains NO pencils, NO pens, NO stationery, NO office supplies of any kind — only the train and station. ' + BASE,
    version: 2,
    cacheKeys: ['vocab_spanish_metro', 'vocab_spanish_subte', 'vocab_spanish_tren_subterraneo'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },
  // ── FIX 3: nervioso — too culturally specific ─────────────────────────────
  {
    filename: 'emo_nervioso.png', destFilename: 'vocab_emo_nervioso.png',
    prompt: 'A simple cartoon figure (friendly and ambiguous — no specific ethnicity, gender-neutral rounded character) showing universal nervous/anxious body language: slightly hunched shoulders, wringing hands together, wide eyes, a few tiny sweat drops near the face, and wavy stress lines floating around them. Standing alone, clearly nervous. Simple and universally relatable. ' + BASE,
    version: 2,
    cacheKeys: ['vocab_spanish_nervioso', 'vocab_spanish_ansioso'],
    tags: ['vocabulary', 'intermediate_mid', 'emotions'],
  },
  // ── FIX 4: time_meses — text in image ─────────────────────────────────────
  {
    filename: 'time_meses.png', destFilename: 'vocab_time_meses.png',
    prompt: 'A beautiful circular wheel divided into 12 equal sections like a colour wheel or mandala. Going clockwise from top, each section shows a small pure nature scene representing one month: (1) bare branch with snow; (2) red heart shape in snow; (3) tiny green sprout; (4) umbrella shape with raindrops; (5) colourful flowers blooming; (6) bright sun with beach waves; (7) starbursts like fireworks; (8) sunflower; (9) yellow-orange leaf; (10) pile of orange-red leaves; (11) bare grey tree; (12) snowflake with a wrapped gift. The wheel uses colour gradients cycling through the four seasons. ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS — pure illustrated icons and scenes only. ' + BASE,
    version: 2,
    cacheKeys: ['vocab_spanish_enero', 'vocab_spanish_febrero', 'vocab_spanish_marzo', 'vocab_spanish_abril', 'vocab_spanish_mayo', 'vocab_spanish_junio', 'vocab_spanish_julio', 'vocab_spanish_agosto', 'vocab_spanish_septiembre', 'vocab_spanish_octubre', 'vocab_spanish_noviembre', 'vocab_spanish_diciembre', 'vocab_time_meses'],
    tags: ['vocabulary', 'section2', 'time'],
  },
  // ── FIX 5: time_dias_semana — text in image ───────────────────────────────
  {
    filename: 'time_dias_semana.png', destFilename: 'vocab_time_dias_semana.png',
    prompt: 'Seven square illustrated panels in a horizontal strip, each panel showing one daily life scene representing a day of the week. LEFT to RIGHT: (1) alarm clock ringing with a sunrise — Monday start; (2) stack of books and coffee — study day; (3) bicycle outdoors with trees; (4) two people shaking hands or meeting; (5) colourful balloons and confetti — end of week celebration; (6) sunny beach or park picnic — leisure; (7) a cosy sofa with a cup of tea and a book — rest day. Each panel has a different cheerful background colour. ABSOLUTELY NO TEXT, NO LETTERS, NO NUMBERS, NO LABELS of any kind. Pure illustrated scenes only. ' + BASE,
    version: 2,
    cacheKeys: ['vocab_spanish_lunes', 'vocab_spanish_martes', 'vocab_spanish_miercoles', 'vocab_spanish_jueves', 'vocab_spanish_viernes', 'vocab_spanish_sabado', 'vocab_spanish_domingo', 'vocab_time_dias_semana'],
    tags: ['vocabulary', 'section2', 'time'],
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
  for (const entry of FIXES) {
    const localPath = path.join(OUT_DIR, entry.filename);
    const idx = FIXES.indexOf(entry) + 1;
    console.log(`\n[${idx}/${FIXES.length}] ${entry.filename}`);
    let buf: Buffer;
    if (fs.existsSync(localPath)) {
      console.log('  ↩ Reusing local file'); buf = fs.readFileSync(localPath);
    } else {
      const r = await openai.images.generate({ model: 'dall-e-3', prompt: entry.prompt, n: 1, size: '1024x1024', quality: 'standard', response_format: 'url' });
      buf = await downloadUrl(r.data![0].url!); fs.writeFileSync(localPath, buf); console.log('  ✓ Generated & saved');
    }
    await gcs.bucket(BUCKET_ID).file(`public/ai-images/${entry.destFilename}`).save(buf, { contentType: 'image/png', metadata: { cacheControl: 'public, max-age=3600' } });
    const url = `/api/media/ai-image/${entry.destFilename}?v=${entry.version}`;
    console.log(`  ✓ Uploaded → ${url}`);
    const tagsLit = sql.raw(`ARRAY[${entry.tags.map(t => `'${t}'`).join(',')}]::text[]`);
    for (const key of entry.cacheKeys) {
      const ex = await db.execute(sql`SELECT id FROM media_files WHERE search_query = ${key} LIMIT 1`);
      if (ex.rows.length > 0) { await db.execute(sql`UPDATE media_files SET url = ${url} WHERE search_query = ${key}`); console.log(`    ↻ ${key}`); }
      else { await db.execute(sql`INSERT INTO media_files (id,media_type,url,filename,mime_type,title,description,tags,language,image_source,search_query,target_word,is_reviewed,usage_count) VALUES (gen_random_uuid(),'image',${url},${entry.destFilename},'image/png',${key},${key},${tagsLit},'spanish','ai_generated',${key},${key},false,0)`); console.log(`    ✓ Seeded: ${key}`); }
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\n✅ All ${FIXES.length} fixes done.`);
}
main().catch(err => { console.error(err); process.exit(1); });

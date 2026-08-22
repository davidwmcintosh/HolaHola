/**
 * Section 2 — Time reference cards:
 * - AM/PM day parts strip (mañana, tarde, noche)
 * - Days of the week calendar strip
 * - Months of the year circle
 * - Four seasons
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

const BASE = 'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture. No text, no words, no letters anywhere in the image.';

interface Entry {
  filename: string; destFilename: string; prompt: string; cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [
  {
    filename: 'time_partes_dia.png', destFilename: 'vocab_time_partes_dia.png',
    prompt: 'A wide landscape strip illustration showing three scenes of the same house or street across the day: LEFT panel — bright morning sunrise with a golden sun low in the sky and a rooster; CENTRE panel — afternoon with the sun high and bright and a person relaxing; RIGHT panel — evening/night with a dark blue sky, crescent moon and stars and a lit window. Three clear distinct scenes side by side. ' + BASE,
    cacheKeys: ['vocab_spanish_manana', 'vocab_spanish_tarde', 'vocab_spanish_noche', 'vocab_time_partes_dia'],
    tags: ['vocabulary', 'section2', 'time'],
  },
  {
    filename: 'time_dias_semana.png', destFilename: 'vocab_time_dias_semana.png',
    prompt: 'A calendar-style horizontal strip showing seven colourful illustrated boxes representing days of the week. Each box has a small scene or icon: Monday — a briefcase; Tuesday — books; Wednesday — a bicycle; Thursday — a magnifying glass; Friday — a party hat/balloon; Saturday — a sunny outdoor activity; Sunday — a cosy cup and rest. Seven boxes in a row with a clear visual for each day, no text anywhere. ' + BASE,
    cacheKeys: ['vocab_spanish_lunes', 'vocab_spanish_martes', 'vocab_spanish_miercoles', 'vocab_spanish_jueves', 'vocab_spanish_viernes', 'vocab_spanish_sabado', 'vocab_spanish_domingo', 'vocab_time_dias_semana'],
    tags: ['vocabulary', 'section2', 'time'],
  },
  {
    filename: 'time_meses.png', destFilename: 'vocab_time_meses.png',
    prompt: 'A circular calendar diagram showing twelve months around a circle, each month represented by a small seasonal icon/scene: January — snowflake/snowman; February — heart; March — flower bud; April — umbrella+rain; May — bright flowers; June — sun+beach; July — fireworks; August — sunflower; September — leaf turning; October — falling leaves; November — bare tree; December — snowflake+gift. Twelve small illustrated icons in a circular ring around a central sun, no text anywhere. ' + BASE,
    cacheKeys: ['vocab_spanish_enero', 'vocab_spanish_febrero', 'vocab_spanish_marzo', 'vocab_spanish_abril', 'vocab_spanish_mayo', 'vocab_spanish_junio', 'vocab_spanish_julio', 'vocab_spanish_agosto', 'vocab_spanish_septiembre', 'vocab_spanish_octubre', 'vocab_spanish_noviembre', 'vocab_spanish_diciembre', 'vocab_time_meses'],
    tags: ['vocabulary', 'section2', 'time'],
  },
  {
    filename: 'time_estaciones.png', destFilename: 'vocab_time_estaciones.png',
    prompt: 'Four illustrated panels in a 2x2 grid, each showing a season through the same countryside scene: TOP-LEFT — spring with cherry blossoms and baby animals; TOP-RIGHT — summer with lush green trees, bright sun and a picnic; BOTTOM-LEFT — autumn with orange/red falling leaves and a harvest; BOTTOM-RIGHT — winter with snow-covered landscape, bare trees, and snowflakes. Four clearly distinct seasons, warm storybook illustration, no text. ' + BASE,
    cacheKeys: ['vocab_spanish_primavera', 'vocab_spanish_verano', 'vocab_spanish_otono', 'vocab_spanish_invierno', 'vocab_time_estaciones'],
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
  console.log(`\n✅ All ${IMAGES.length} time card images done.`);
}
main().catch(err => { console.error(err); process.exit(1); });

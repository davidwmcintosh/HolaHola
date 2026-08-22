/**
 * Regenerate specific images with revised prompts.
 * Run: npx tsx scripts/regen-specific.ts
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

const IMAGES = [
  {
    filename: 'act_comprar.png',
    destFilename: 'vocab_act_comprar.png',
    prompt:
      'A cheerful generic person — short dark hair, plain casual clothes, no cultural markers or headwear — ' +
      'standing in a bright colourful grocery or general store, holding a shopping basket with some items in it. ' +
      'The person is browsing shelves stacked with colourful products. Friendly expression, full body visible. ' +
      'Warm illustrated watercolor style, vibrant saturated colours, soft natural shading, ' +
      'language learning educational illustration quality. ' +
      'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.',
    cacheKeys: ['vocab_spanish_comprar'],
  },
  {
    filename: 'adj_cerca_lejos.png',
    destFilename: 'vocab_adj_cerca_lejos.png',
    prompt:
      'Two separate side-by-side illustrations showing the concept of NEAR vs FAR using a classic perspective trick: ' +
      'LEFT panel — a large house fills most of the frame, with a small person standing right next to the front door, ' +
      'almost touching it. A big arrow or obvious visual cue shows closeness. ' +
      'RIGHT panel — the same house is now tiny in the far distance at the end of a long road, ' +
      'and the same person is large in the foreground looking at it far away. ' +
      'The size difference between the nearby and distant house is dramatic and unmistakable. ' +
      'The two panels are clearly separated. ' +
      'Warm illustrated watercolor style, vibrant saturated colours, soft natural shading, clean white background, ' +
      'language learning educational illustration quality. ' +
      'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.',
    cacheKeys: ['vocab_spanish_cerca', 'vocab_spanish_lejos'],
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
    console.log(`\nGenerating: ${entry.filename}`);

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
    console.log(`  ✓ Saved locally`);

    // Upload
    const bucket = gcs.bucket(BUCKET_ID);
    const file = bucket.file(`public/ai-images/${entry.destFilename}`);
    await file.save(buf, {
      contentType: 'image/png',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    const url = `/api/media/ai-image/${entry.destFilename}`;
    console.log(`  ✓ Uploaded: ${url}`);

    // Seed DB
    const tagsLiteral = sql.raw(`ARRAY['vocabulary','novice_mid','activities','section2']::text[]`);
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

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✅ Done — both images regenerated.');
}

main().catch(err => { console.error(err); process.exit(1); });

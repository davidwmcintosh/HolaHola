/**
 * Pre-generate the 3 missing Spanish anchor images for sports vocabulary:
 *   vocab_spanish_baloncesto  (basketball)
 *   vocab_spanish_tenis       (tennis)
 *   vocab_spanish_deporte     (sports — general)
 *
 * Run: npx tsx scripts/generate-sports-anchors.ts
 */

import OpenAI from 'openai';
import { Storage } from '@google-cloud/storage';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import https from 'https';

const OPENAI_KEY = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const BUCKET_ID  = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
const DB_URL     = process.env.NEON_SHARED_DATABASE_URL || '';
const SIDECAR    = 'http://127.0.0.1:1106';

if (!OPENAI_KEY) throw new Error('USER_OPENAI_API_KEY not set');
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

const PROP_STYLE =
  "soft watercolor children's book illustration style, warm gentle colors, clean fine ink outlines, " +
  'visible brushwork texture, object centred and prominent on a clean pure white background, ' +
  'no background elements, clear and recognisable silhouette, language learning educational quality, ' +
  'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.';

const IMAGES = [
  {
    destFilename: 'vocab_sports_baloncesto.png',
    prompt:
      'A bright orange basketball prominently centred, with the distinctive black seam lines clearly visible. ' +
      'The ball is large and fills most of the frame. Clean white background, no court or hoop needed. ' +
      PROP_STYLE,
    cacheKey: 'vocab_spanish_baloncesto',
  },
  {
    destFilename: 'vocab_sports_tenis.png',
    prompt:
      'A yellow-green tennis ball and a tennis racket arranged together, both clearly visible and recognisable. ' +
      'The racket strings and frame are detailed. Objects centred on a clean white background. ' +
      PROP_STYLE,
    cacheKey: 'vocab_spanish_tenis',
  },
  {
    destFilename: 'vocab_sports_deporte.png',
    prompt:
      'A cheerful arrangement of classic sports equipment: a football (soccer ball), a basketball, and a tennis racket ' +
      'grouped together. All three objects are clearly recognisable and colourful. Clean white background. ' +
      PROP_STYLE,
    cacheKey: 'vocab_spanish_deporte',
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
  for (const entry of IMAGES) {
    console.log(`\nGenerating: ${entry.cacheKey}...`);

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
    console.log(`  ✓ Generated (${buf.length} bytes)`);

    const bucket = gcs.bucket(BUCKET_ID);
    const file = bucket.file(`public/ai-images/${entry.destFilename}`);
    await file.save(buf, {
      contentType: 'image/png',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    const url = `/api/media/ai-image/${entry.destFilename}`;
    console.log(`  ✓ Uploaded: ${url}`);

    const tagsLiteral = sql.raw(`ARRAY['vocabulary','novice_mid','sports']::text[]`);
    const existing = await db.execute(sql`SELECT id FROM media_files WHERE search_query = ${entry.cacheKey} LIMIT 1`);
    if (existing.rows.length > 0) {
      await db.execute(sql`UPDATE media_files SET url = ${url}, image_source = 'ai_generated' WHERE search_query = ${entry.cacheKey}`);
      console.log(`  ↻ Updated existing row: ${entry.cacheKey}`);
    } else {
      await db.execute(sql`
        INSERT INTO media_files (id, media_type, url, filename, mime_type, title, description, tags, language, image_source, search_query, target_word, is_reviewed, usage_count)
        VALUES (gen_random_uuid(), 'image', ${url}, ${entry.destFilename}, 'image/png', ${entry.cacheKey}, ${entry.cacheKey}, ${tagsLiteral}, 'spanish', 'ai_generated', ${entry.cacheKey}, ${entry.cacheKey}, false, 0)
      `);
      console.log(`  ✓ Seeded: ${entry.cacheKey}`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n✅ Done — 3 sports anchor images generated and seeded.');
}

main().catch((err) => { console.error(err); process.exit(1); });

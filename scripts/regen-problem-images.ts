/**
 * Regenerate 4 images that came out too realistic / problematic.
 * New approach: simple cartoon/flat illustration style — no realistic people.
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

const STYLE =
  'flat simple cartoon illustration, bold clean outlines, bright flat colours, ' +
  'children\'s picture-book style, simple shapes, no realistic anatomy, no shading, ' +
  'pure white background, educational language-learning card. ' +
  'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.';

const IMAGES = [
  {
    filename: 'adj_feliz_triste.png',
    destFilename: 'vocab_adj_feliz_triste.png',
    prompt:
      'Two large emoji-style round faces side by side on a white background. ' +
      'LEFT face — bright yellow circle with big curved-up smile, rosy cheeks, and crinkled happy eyes (like two arcs). ' +
      'RIGHT face — bright yellow circle with a large curved-down frown and a single tear drop on one cheek, droopy sad eyes. ' +
      'Both faces are completely round, identical in size, simple like a smiley-face icon — no hair, no body, no clothing, no gender, just two expressive cartoon faces. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_feliz', 'vocab_spanish_triste', 'vocab_spanish_alegre'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },
  {
    filename: 'act_cocinar.png',
    destFilename: 'vocab_act_cocinar.png',
    prompt:
      'A single simple cartoon character cooking. The character is a small round-headed blobby figure (completely gender-neutral, no face details beyond two dot eyes and a smile) ' +
      'wearing a tall white chef\'s hat and a simple white apron. ' +
      'The character is happily stirring a large round pot on a cartoon stove with steam puffs rising from the pot. ' +
      'The pot is big and colourful. The stove is simple and blocky. Scene is minimal and cheerful. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_cocinar'],
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
  },
  {
    filename: 'adj_rapido_lento.png',
    destFilename: 'vocab_adj_rapido_lento.png',
    prompt:
      'Two simple cartoon animals in a clear race scene on a straight track. ' +
      'LEFT side — a cartoon rabbit/hare sprinting very fast, far ahead at the finish line, with a large winner\'s ribbon. ' +
      'Three strong horizontal speed lines trail behind it. It is clearly WINNING and far ahead. ' +
      'RIGHT side — the same track viewed far behind, a tiny cartoon snail at the very start of the track, barely moving, looking relaxed. ' +
      'The enormous distance between the rabbit (at the finish) and the snail (barely started) makes it completely obvious who is fast and who is slow. ' +
      'No speed lines on the snail at all. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_rapido', 'vocab_spanish_lento'],
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
  },
  {
    filename: 'act_bailar.png',
    destFilename: 'vocab_act_bailar.png',
    prompt:
      'Two simple cartoon stick-figure-style characters dancing joyfully together. ' +
      'Both characters are simple rounded blobby shapes (no realistic anatomy, no detailed clothing, no skin colour) — ' +
      'think gingerbread-man level of simplicity. ' +
      'They have their arms raised in the air, legs bent in a dance pose, with small musical note symbols floating around them to show they are dancing to music. ' +
      'Big simple smiles on their round heads. Bright colours — one orange, one blue. ' +
      STYLE,
    cacheKeys: ['vocab_spanish_bailar'],
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
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

    const bucket = gcs.bucket(BUCKET_ID);
    const file = bucket.file(`public/ai-images/${entry.destFilename}`);
    await file.save(buf, {
      contentType: 'image/png',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
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

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✅ All 4 images regenerated.');
}

main().catch(err => { console.error(err); process.exit(1); });

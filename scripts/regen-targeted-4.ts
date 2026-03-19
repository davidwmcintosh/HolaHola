/**
 * Targeted regen for 4 images:
 * - adj_feliz_triste: improve to natural faces (no clown noses/freckles)
 * - adj_duro_suave: remove any text, clean concept
 * - act_bailar: fresher pass on dancing
 * - act_cantar: regenerate from old style to new children's book style
 * Bumps to ?v=5
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

const S =
  'Soft watercolor children\'s book illustration, warm gentle colors, light pencil outlines, ' +
  'visible brushwork texture, white background. ' +
  'Absolutely no text, no letters, no words, no labels anywhere in the image.';

const VERSION = 'v=5';

interface Entry {
  filename: string; destFilename: string; prompt: string;
  cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [
  {
    filename: 'adj_feliz_triste.png', destFilename: 'vocab_adj_feliz_triste.png',
    prompt:
      'Two children shown side by side. The child on the left is laughing and happy — ' +
      'eyes crinkled with joy, a natural warm smile, radiating cheerfulness with a soft golden glow. ' +
      'The child on the right is gently sad — eyes downcast, a single small teardrop on the cheek, ' +
      'a quiet melancholy expression. Both children have natural, soft, gentle faces — ' +
      'no exaggerated noses, no red spots, no clown features, no freckles, proportional and realistic but illustrated. ' +
      'Think sweet children\'s book illustration, like a Beatrix Potter or Quentin Blake character — charming but natural. ' +
      S,
    cacheKeys: ['vocab_spanish_feliz', 'vocab_spanish_triste', 'vocab_spanish_alegre'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'adj_duro_suave.png', destFilename: 'vocab_adj_duro_suave.png',
    prompt:
      'Two objects side by side on a white background. ' +
      'On the left: a large grey rock with a rough, craggy surface — solid, heavy, angular. ' +
      'On the right: a plump white pillow with gentle curves, cloud-soft and fluffy, with a cosy quilted texture. ' +
      'The contrast between hard and soft is visually obvious. ' +
      'No words, no labels, no arrows, absolutely nothing written anywhere. Just the two objects clearly illustrated. ' +
      S,
    cacheKeys: ['vocab_spanish_duro', 'vocab_spanish_suave', 'vocab_spanish_blando'],
    tags: ['vocabulary', 'novice_mid', 'adjectives'],
  },

  {
    filename: 'act_bailar.png', destFilename: 'vocab_act_bailar.png',
    prompt:
      'Two people dancing together joyfully. One wears a warm orange outfit, the other a cool blue outfit. ' +
      'They are mid-movement — arms raised, bodies swaying, big natural smiles. ' +
      'A few musical notes float in the air around them. The scene feels lively and fun. ' +
      'Faces are soft and naturally proportioned — not exaggerated or cartoon. ' +
      S,
    cacheKeys: ['vocab_spanish_bailar'],
    tags: ['vocabulary', 'novice_mid', 'activities'],
  },

  {
    filename: 'act_cantar.png', destFilename: 'vocab_act_cantar.png',
    prompt:
      'A single person singing with joy — mouth open in song, eyes bright, one hand raised expressively. ' +
      'Musical notes float around them in the air. The mood is warm and uplifting. ' +
      'The person has a natural, softly illustrated face — gentle features, warm expression, nothing exaggerated. ' +
      S,
    cacheKeys: ['vocab_spanish_cantar'],
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

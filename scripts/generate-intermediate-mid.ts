/**
 * Intermediate Mid vocabulary images:
 * - Nature: árbol, flor, río, lago, mar, bosque, desierto, volcán, nube, sol, luna, estrella (12)
 * - Emotions: enojado, asustado, sorprendido, avergonzado, cansado, emocionado, nervioso, aburrido (8)
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

const PROP  = 'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture, object centred and prominent on a clean pure white background, no background elements, clear and recognisable silhouette. No text, no letters, no words anywhere in the image.';
const SCENE = 'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture, friendly and engaging scene. No text, no signs, no labels anywhere in the image. Suitable for all ages.';
const CHAR  = 'Character with natural proportions and softly illustrated face — warm and expressive, not exaggerated.';

interface Entry {
  filename: string; destFilename: string; prompt: string; cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [
  // ── NATURE ────────────────────────────────────────────────────────────────
  {
    filename: 'nature_arbol.png', destFilename: 'vocab_nature_arbol.png',
    prompt: 'A single lush green tree with a rounded canopy and brown trunk, centred on a white background. Classic friendly tree shape — like a storybook oak. ' + PROP,
    cacheKeys: ['vocab_spanish_arbol'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_flor.png', destFilename: 'vocab_nature_flor.png',
    prompt: 'A beautiful flower with colourful petals — like a daisy or sunflower — with a green stem and leaves, centred on a white background. Bright and cheerful. ' + PROP,
    cacheKeys: ['vocab_spanish_flor'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_rio.png', destFilename: 'vocab_nature_rio.png',
    prompt: 'A winding river flowing through a green valley, with gentle ripples and a rocky bank. Sunlit and peaceful. Viewed from above at a slight angle. ' + SCENE,
    cacheKeys: ['vocab_spanish_rio'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_lago.png', destFilename: 'vocab_nature_lago.png',
    prompt: 'A calm mountain lake with blue water reflecting the sky, surrounded by gentle hills and a few pine trees on the shore. Peaceful and serene. ' + SCENE,
    cacheKeys: ['vocab_spanish_lago'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_mar.png', destFilename: 'vocab_nature_mar.png',
    prompt: 'A wide ocean view — blue-green waves gently rolling toward a sandy shore with white foam. Horizon visible, bright blue sky. Inviting seascape. ' + SCENE,
    cacheKeys: ['vocab_spanish_mar', 'vocab_spanish_oceano'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_bosque.png', destFilename: 'vocab_nature_bosque.png',
    prompt: 'A magical forest with tall trees, dappled sunlight filtering through the canopy onto the leafy floor. Inviting and friendly — a storybook forest. ' + SCENE,
    cacheKeys: ['vocab_spanish_bosque', 'vocab_spanish_selva'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_desierto.png', destFilename: 'vocab_nature_desierto.png',
    prompt: 'A warm desert landscape with golden sand dunes, a bright blue sky with a hot sun, and a cactus or two on the horizon. Classic desert scene. ' + SCENE,
    cacheKeys: ['vocab_spanish_desierto'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_volcan.png', destFilename: 'vocab_nature_volcan.png',
    prompt: 'A dramatic volcano with a conical shape, orange lava gently flowing down one side and a puff of smoke from the summit. Dramatic yet friendly, storybook style. ' + SCENE,
    cacheKeys: ['vocab_spanish_volcan'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_nube.png', destFilename: 'vocab_nature_nube.png',
    prompt: 'Fluffy white cloud shapes, two or three overlapping, on a light blue background. Classic puffy cumulus clouds, friendly and rounded. ' + PROP,
    cacheKeys: ['vocab_spanish_nube'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_sol.png', destFilename: 'vocab_nature_sol.png',
    prompt: 'A bright yellow sun with rounded rays, centred on a light blue-white background. Friendly and cheerful — classic storybook sunshine. ' + PROP,
    cacheKeys: ['vocab_spanish_sol'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_luna.png', destFilename: 'vocab_nature_luna.png',
    prompt: 'A bright crescent moon and a full moon side by side, soft yellow-gold colour, on a dark midnight blue background with a few tiny stars. Dreamy and peaceful. ' + PROP,
    cacheKeys: ['vocab_spanish_luna'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  {
    filename: 'nature_estrella.png', destFilename: 'vocab_nature_estrella.png',
    prompt: 'Three or four bright five-pointed stars, golden yellow with a gentle glow/twinkle, on a deep blue night sky background. Clear and iconic. ' + PROP,
    cacheKeys: ['vocab_spanish_estrella'],
    tags: ['vocabulary', 'intermediate_mid', 'nature'],
  },
  // ── EMOTIONS ──────────────────────────────────────────────────────────────
  {
    filename: 'emo_enojado.png', destFilename: 'vocab_emo_enojado.png',
    prompt: 'A child or young person with an angry expression — furrowed brows, hands on hips or crossed arms, cheeks slightly flushed. Clear but not scary. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_enojado', 'vocab_spanish_enfadado', 'vocab_spanish_molesto'],
    tags: ['vocabulary', 'intermediate_mid', 'emotions'],
  },
  {
    filename: 'emo_asustado.png', destFilename: 'vocab_emo_asustado.png',
    prompt: 'A child or young person looking frightened/scared — wide eyes, hands raised defensively, slightly cowering. A small ghost or shadow in the background causes the fright. Friendly, not disturbing. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_asustado', 'vocab_spanish_atemorizado'],
    tags: ['vocabulary', 'intermediate_mid', 'emotions'],
  },
  {
    filename: 'emo_sorprendido.png', destFilename: 'vocab_emo_sorprendido.png',
    prompt: 'A child or person looking very surprised — eyes wide open, hands over cheeks or mouth, eyebrows raised high. A surprise birthday cake or a jack-in-the-box nearby. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_sorprendido', 'vocab_spanish_asombrado'],
    tags: ['vocabulary', 'intermediate_mid', 'emotions'],
  },
  {
    filename: 'emo_avergonzado.png', destFilename: 'vocab_emo_avergonzado.png',
    prompt: 'A person looking embarrassed — rosy cheeks, eyes looking down or to the side, slightly covering their face with one hand. A blushing blush of soft pink on cheeks. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_avergonzado', 'vocab_spanish_vergüenza'],
    tags: ['vocabulary', 'intermediate_mid', 'emotions'],
  },
  {
    filename: 'emo_cansado.png', destFilename: 'vocab_emo_cansado.png',
    prompt: 'A person looking very tired/exhausted — drooping eyelids, yawning, slumped posture, dark circles under eyes. Maybe holding a coffee mug. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_cansado', 'vocab_spanish_agotado'],
    tags: ['vocabulary', 'intermediate_mid', 'emotions'],
  },
  {
    filename: 'emo_emocionado.png', destFilename: 'vocab_emo_emocionado.png',
    prompt: 'A person looking excited and thrilled — big smile, eyes sparkling, fists pumped or jumping slightly, full of energy. Maybe seeing a gift or an event they\'ve been waiting for. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_emocionado', 'vocab_spanish_entusiasmado'],
    tags: ['vocabulary', 'intermediate_mid', 'emotions'],
  },
  {
    filename: 'emo_nervioso.png', destFilename: 'vocab_emo_nervioso.png',
    prompt: 'A person looking nervous/anxious — fidgeting, biting nails or wringing hands, sweating slightly, eyes darting. Maybe standing before a door about to give a presentation. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_nervioso', 'vocab_spanish_ansioso'],
    tags: ['vocabulary', 'intermediate_mid', 'emotions'],
  },
  {
    filename: 'emo_aburrido.png', destFilename: 'vocab_emo_aburrido.png',
    prompt: 'A person looking very bored — head resting on one hand, glazed expression, slouched at a desk or chair, staring blankly. Very unenthusiastic posture. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_aburrido', 'vocab_spanish_aburrimiento'],
    tags: ['vocabulary', 'intermediate_mid', 'emotions'],
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
  console.log(`\n✅ All ${IMAGES.length} Intermediate Mid images done.`);
}
main().catch(err => { console.error(err); process.exit(1); });

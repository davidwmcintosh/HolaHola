/**
 * Intermediate Low vocabulary images:
 * - Body diagram (1 image → 14 cache keys)
 * - Health items: pastilla, inyección, venda, cita médica (4 images)
 * - Furniture/home: jardín, cama, sofá, armario, refrigerador, estufa, lavadora (7 images)
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
const SCENE = 'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture, friendly and welcoming scene. No text, no signs, no labels anywhere in the image. Suitable for all ages.';
const CHAR  = 'Characters have natural proportions and softly illustrated faces — warm and expressive, not exaggerated.';

interface Entry {
  filename: string; destFilename: string; prompt: string; cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [
  // ── BODY DIAGRAM ──────────────────────────────────────────────────────────
  {
    filename: 'body_diagram.png', destFilename: 'vocab_body_diagram.png',
    prompt: 'A friendly cartoon human body outline standing straight and smiling — front view — showing the whole body from head to toe. The body is clearly divided into distinct parts with dotted outlines or gentle highlights showing: head, shoulder, arm, hand, chest/stomach, back (partially visible), knee, leg, foot, eye, ear, mouth, nose. Each area is subtly highlighted or circled in a soft watercolor wash — no text or labels of any kind, just the illustrated body with clear visual regions. ' + PROP,
    cacheKeys: ['vocab_spanish_cuerpo', 'vocab_spanish_cabeza', 'vocab_spanish_brazo', 'vocab_spanish_pierna', 'vocab_spanish_mano', 'vocab_spanish_pie', 'vocab_spanish_ojo', 'vocab_spanish_oido', 'vocab_spanish_oreja', 'vocab_spanish_boca', 'vocab_spanish_nariz', 'vocab_spanish_corazon', 'vocab_spanish_estomago', 'vocab_spanish_espalda', 'vocab_spanish_rodilla', 'vocab_spanish_hombro'],
    tags: ['vocabulary', 'intermediate_low', 'body'],
  },
  // ── HEALTH ────────────────────────────────────────────────────────────────
  {
    filename: 'health_pastilla.png', destFilename: 'vocab_health_pastilla.png',
    prompt: 'A single round pill/tablet and a small blister pack of tablets, centred on a white background. Soft and friendly appearance — clearly a medicine tablet, not a candy. ' + PROP,
    cacheKeys: ['vocab_spanish_pastilla', 'vocab_spanish_tableta', 'vocab_spanish_comprimido'],
    tags: ['vocabulary', 'intermediate_low', 'health'],
  },
  {
    filename: 'health_inyeccion.png', destFilename: 'vocab_health_inyeccion.png',
    prompt: 'A medical syringe/injection needle, clean and clearly illustrated, centred on a white background. Friendly medical illustration style — not scary. ' + PROP,
    cacheKeys: ['vocab_spanish_inyeccion', 'vocab_spanish_vacuna', 'vocab_spanish_jeringa'],
    tags: ['vocabulary', 'intermediate_low', 'health'],
  },
  {
    filename: 'health_venda.png', destFilename: 'vocab_health_venda.png',
    prompt: 'A rolled bandage/bandage roll and a small adhesive plaster/band-aid, both centred on a white background. Clean medical illustration. ' + PROP,
    cacheKeys: ['vocab_spanish_venda', 'vocab_spanish_vendaje', 'vocab_spanish_curita'],
    tags: ['vocabulary', 'intermediate_low', 'health'],
  },
  {
    filename: 'health_cita_medica.png', destFilename: 'vocab_health_cita_medica.png',
    prompt: 'A friendly doctor in a white coat seated at a desk, with a patient sitting across from them, both having a conversation. A calendar on the wall behind and a medical diploma. Warm and reassuring consultation scene. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_cita_medica', 'vocab_spanish_cita', 'vocab_spanish_consulta'],
    tags: ['vocabulary', 'intermediate_low', 'health'],
  },
  // ── FURNITURE / HOME ──────────────────────────────────────────────────────
  {
    filename: 'home_jardin.png', destFilename: 'vocab_home_jardin.png',
    prompt: 'A charming home garden / backyard with green grass, colourful flowers, a small tree, and a wooden garden bench. Bright sunny day, cheerful and inviting. ' + SCENE,
    cacheKeys: ['vocab_spanish_jardin', 'vocab_spanish_patio'],
    tags: ['vocabulary', 'intermediate_low', 'home'],
  },
  {
    filename: 'home_cama.png', destFilename: 'vocab_home_cama.png',
    prompt: 'A comfortable single bed with a colourful duvet/quilt, two pillows, and a wooden headboard. Neat and inviting, centred on a white background. ' + PROP,
    cacheKeys: ['vocab_spanish_cama'],
    tags: ['vocabulary', 'intermediate_low', 'home'],
  },
  {
    filename: 'home_sofa.png', destFilename: 'vocab_home_sofa.png',
    prompt: 'A comfortable three-seat sofa/couch with cushions in warm colours, centred on a white background. Cosy and inviting. ' + PROP,
    cacheKeys: ['vocab_spanish_sofa', 'vocab_spanish_divan', 'vocab_spanish_canapé'],
    tags: ['vocabulary', 'intermediate_low', 'home'],
  },
  {
    filename: 'home_armario.png', destFilename: 'vocab_home_armario.png',
    prompt: 'A wooden wardrobe/closet with one door open showing neatly hanging clothes inside, centred on a white background. Classic bedroom furniture. ' + PROP,
    cacheKeys: ['vocab_spanish_armario', 'vocab_spanish_closet', 'vocab_spanish_guardarropa'],
    tags: ['vocabulary', 'intermediate_low', 'home'],
  },
  {
    filename: 'home_refrigerador.png', destFilename: 'vocab_home_refrigerador.png',
    prompt: 'A kitchen refrigerator with one door open showing shelves of food and drinks inside, centred on a white background. Modern and friendly. ' + PROP,
    cacheKeys: ['vocab_spanish_refrigerador', 'vocab_spanish_nevera', 'vocab_spanish_frigorifico', 'vocab_spanish_heladera'],
    tags: ['vocabulary', 'intermediate_low', 'home'],
  },
  {
    filename: 'home_estufa.png', destFilename: 'vocab_home_estufa.png',
    prompt: 'A kitchen stove/cooker with four burners and an oven underneath, centred on a white background. Clean and modern kitchen appliance. ' + PROP,
    cacheKeys: ['vocab_spanish_estufa', 'vocab_spanish_cocina_electrodomestico', 'vocab_spanish_hornilla'],
    tags: ['vocabulary', 'intermediate_low', 'home'],
  },
  {
    filename: 'home_lavadora.png', destFilename: 'vocab_home_lavadora.png',
    prompt: 'A front-loading washing machine with a round glass door, centred on a white background. Clean white appliance, clearly identifiable. ' + PROP,
    cacheKeys: ['vocab_spanish_lavadora', 'vocab_spanish_lavarropas'],
    tags: ['vocabulary', 'intermediate_low', 'home'],
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
  console.log(`\n✅ All ${IMAGES.length} Intermediate Low images done.`);
}
main().catch(err => { console.error(err); process.exit(1); });

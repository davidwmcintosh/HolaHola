/**
 * Generate Novice Mid — People images using Gemini Imagen 3
 * Same watercolor style as the seeded library.
 * Run: npx tsx scripts/generate-novice-mid-people.ts
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
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
const DB_URL = process.env.NEON_SHARED_DATABASE_URL || '';
const SIDECAR = 'http://127.0.0.1:1106';

if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');
if (!BUCKET_ID) throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
if (!DB_URL) throw new Error('NEON_SHARED_DATABASE_URL not set');

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
  'warm illustrated watercolor style, vibrant saturated colours, soft natural shading, ' +
  'language learning educational illustration quality, clear and recognisable silhouette. ' +
  'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS ZERO SIGNS anywhere in the image.';

interface ImageEntry {
  filename: string;
  destFilename: string;
  prompt: string;
  title: string;
  description: string;
  cacheKeys: { key: string; title: string; description: string }[];
}

const IMAGES: ImageEntry[] = [
  // ── FAMILY PAIRS ─────────────────────────────────────────────────────────
  {
    filename: 'ppl_abuelos.png',
    destFilename: 'vocab_ppl_abuelos.png',
    prompt: `A loving elderly Latino couple sitting together on a warm sunny porch. Grandfather has silver hair, glasses, and a kind smile. Grandmother has white hair tied back and wears a colorful floral blouse. Both looking warmly at the viewer. ${STYLE}`,
    title: 'Abuelo / Abuela',
    description: 'Elderly Latino grandparents — grandfather and grandmother — sitting together',
    cacheKeys: [
      { key: 'vocab_spanish_abuelo', title: 'Abuelo', description: 'Grandfather — elderly man' },
      { key: 'vocab_spanish_abuela', title: 'Abuela', description: 'Grandmother — elderly woman' },
    ],
  },
  {
    filename: 'ppl_tios.png',
    destFilename: 'vocab_ppl_tios.png',
    prompt: `A cheerful middle-aged Latino uncle and aunt standing together side by side, both smiling warmly. Uncle in a casual button shirt, aunt in a colorful blouse. Friendly family portrait. ${STYLE}`,
    title: 'Tío / Tía',
    description: 'Middle-aged Latino uncle and aunt standing together',
    cacheKeys: [
      { key: 'vocab_spanish_tio', title: 'Tío', description: 'Uncle — middle-aged man' },
      { key: 'vocab_spanish_tia', title: 'Tía', description: 'Aunt — middle-aged woman' },
    ],
  },
  {
    filename: 'ppl_primos.png',
    destFilename: 'vocab_ppl_primos.png',
    prompt: `A Latino boy and girl about 10 years old, cousins, laughing and playing together in a sunny backyard. Both energetic and joyful, perhaps running or playing a ball game. ${STYLE}`,
    title: 'Primo / Prima',
    description: 'Latino boy and girl cousins playing together outdoors',
    cacheKeys: [
      { key: 'vocab_spanish_primo', title: 'Primo', description: 'Male cousin — boy' },
      { key: 'vocab_spanish_prima', title: 'Prima', description: 'Female cousin — girl' },
    ],
  },

  // ── COMMUNITY HELPERS IN CONTEXT ──────────────────────────────────────────
  {
    filename: 'ppl_medico.png',
    destFilename: 'vocab_ppl_medico.png',
    prompt: `A friendly Latino doctor in a white coat with a stethoscope around their neck, standing in a bright modern clinic and smiling warmly at the viewer. Professional and approachable. ${STYLE}`,
    title: 'Médico / Médica',
    description: 'Doctor in white coat with stethoscope in a clinic',
    cacheKeys: [
      { key: 'vocab_spanish_medico', title: 'Médico', description: 'Doctor — male physician' },
      { key: 'vocab_spanish_medica', title: 'Médica', description: 'Doctor — female physician' },
      { key: 'vocab_spanish_doctor', title: 'Doctor', description: 'Doctor' },
    ],
  },
  {
    filename: 'ppl_enfermero.png',
    destFilename: 'vocab_ppl_enfermero.png',
    prompt: `A caring Latino nurse in blue scrubs, holding a clipboard, standing in a bright hospital hallway. Gentle professional expression and warm smile. ${STYLE}`,
    title: 'Enfermero / Enfermera',
    description: 'Nurse in blue scrubs holding clipboard in a hospital',
    cacheKeys: [
      { key: 'vocab_spanish_enfermero', title: 'Enfermero', description: 'Nurse — male' },
      { key: 'vocab_spanish_enfermera', title: 'Enfermera', description: 'Nurse — female' },
    ],
  },
  {
    filename: 'ppl_policia.png',
    destFilename: 'vocab_ppl_policia.png',
    prompt: `A friendly Latino police officer in a dark uniform with a badge, waving or standing on a sunny city street. Approachable and helpful expression. ${STYLE}`,
    title: 'Policía',
    description: 'Police officer in uniform on a city street',
    cacheKeys: [
      { key: 'vocab_spanish_policia', title: 'Policía', description: 'Police officer' },
    ],
  },
  {
    filename: 'ppl_cocinero.png',
    destFilename: 'vocab_ppl_cocinero.png',
    prompt: `A cheerful Latino chef in a white chef's coat and tall white chef's hat, enthusiastically cooking in a restaurant kitchen, stirring a pot with steam rising. ${STYLE}`,
    title: 'Cocinero / Cocinera',
    description: 'Chef in white coat and hat cooking in a restaurant kitchen',
    cacheKeys: [
      { key: 'vocab_spanish_cocinero', title: 'Cocinero', description: 'Cook — male chef' },
      { key: 'vocab_spanish_cocinera', title: 'Cocinera', description: 'Cook — female chef' },
    ],
  },
  {
    filename: 'ppl_bombero.png',
    destFilename: 'vocab_ppl_bombero.png',
    prompt: `A brave Latino firefighter in full yellow and black gear — yellow helmet, heavy fireproof coat — standing proudly in front of a shiny red fire truck. Heroic and friendly. ${STYLE}`,
    title: 'Bombero / Bombera',
    description: 'Firefighter in full gear standing in front of a fire truck',
    cacheKeys: [
      { key: 'vocab_spanish_bombero', title: 'Bombero', description: 'Firefighter — male' },
      { key: 'vocab_spanish_bombera', title: 'Bombera', description: 'Firefighter — female' },
    ],
  },
  {
    filename: 'ppl_dentista.png',
    destFilename: 'vocab_ppl_dentista.png',
    prompt: `A friendly Latino dentist in a white coat and safety glasses, smiling beside a modern dental chair in a bright clean dental office. Calm and welcoming atmosphere. ${STYLE}`,
    title: 'Dentista',
    description: 'Dentist in white coat beside dental chair in a dental office',
    cacheKeys: [
      { key: 'vocab_spanish_dentista', title: 'Dentista', description: 'Dentist' },
    ],
  },

  // ── EXTENDED FAMILY GATHERING SCENE ──────────────────────────────────────
  {
    filename: 'ppl_familia_extendida.png',
    destFilename: 'vocab_ppl_familia_extendida.png',
    prompt: `A joyful extended Latino family gathered around a large dining table — elderly grandparents at the head, parents, a cheerful uncle and aunt, and several children including young cousins. Colorful food on the table, warm lighting, a celebration or Sunday dinner atmosphere. Wide establishing shot showing all family members clearly. ${STYLE}`,
    title: 'Familia Extendida',
    description: 'Extended Latino family gathering — grandparents, parents, uncle, aunt, cousins, children around a dining table',
    cacheKeys: [
      { key: 'vocab_spanish_familia_extendida', title: 'Familia Extendida', description: 'Extended family gathering scene' },
    ],
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

async function generateImage(entry: ImageEntry): Promise<Buffer> {
  console.log(`  Generating: ${entry.filename}...`);
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: entry.prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  });
  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) throw new Error(`No image URL returned for ${entry.filename}`);
  console.log(`  Downloading...`);
  return downloadUrl(imageUrl);
}

async function uploadFile(buf: Buffer, destFilename: string): Promise<string> {
  const bucket = gcs.bucket(BUCKET_ID);
  const file = bucket.file(`public/ai-images/${destFilename}`);
  await file.save(buf, {
    contentType: 'image/png',
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  return `/api/media/ai-image/${destFilename}`;
}

async function seedEntry(url: string, entry: ImageEntry): Promise<void> {
  for (const { key, title, description } of entry.cacheKeys) {
    const existing = await db.execute(sql`
      SELECT id FROM media_files WHERE search_query = ${key} LIMIT 1
    `);
    if (existing.rows.length > 0) {
      // Update URL in case we're refreshing
      await db.execute(sql`
        UPDATE media_files SET url = ${url}, image_source = 'ai_generated'
        WHERE search_query = ${key}
      `);
      console.log(`    ↻ Updated: ${key}`);
    } else {
      await db.execute(sql`
        INSERT INTO media_files (
          id, media_type, url, filename, mime_type,
          title, description, tags, language,
          image_source, search_query, target_word,
          is_reviewed, usage_count
        ) VALUES (
          gen_random_uuid(), 'image', ${url}, ${entry.destFilename}, 'image/png',
          ${title}, ${description},
          ARRAY['vocabulary','novice_mid','people','section2']::text[],
          'spanish', 'ai_generated', ${key}, ${title},
          false, 0
        )
      `);
      console.log(`    ✓ Seeded: ${key} → ${url}`);
    }
  }
}

async function main() {
  console.log(`Generating ${IMAGES.length} Novice Mid people images with DALL-E 3...\n`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Process one at a time to avoid hitting rate limits
  for (const entry of IMAGES) {
    console.log(`\n[${IMAGES.indexOf(entry) + 1}/${IMAGES.length}] ${entry.title}`);
    try {
      const localPath = path.join(OUT_DIR, entry.filename);

      let buf: Buffer;
      if (fs.existsSync(localPath)) {
        console.log(`  ↩ Already generated locally, reusing: ${entry.filename}`);
        buf = fs.readFileSync(localPath);
      } else {
        // Generate
        buf = await generateImage(entry);
        // Save locally
        fs.writeFileSync(localPath, buf);
        console.log(`  ✓ Saved locally: ${localPath}`);
      }

      // Upload
      const url = await uploadFile(buf, entry.destFilename);
      console.log(`  ✓ Uploaded: ${url}`);

      // Seed DB
      await seedEntry(url, entry);
    } catch (err: any) {
      console.error(`  ✗ FAILED: ${err.message}`);
    }

    // Small pause between generations to be polite to the API
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✅ Done — Novice Mid people images seeded.');
}

main().catch(err => { console.error(err); process.exit(1); });

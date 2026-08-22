/**
 * Novice High — Travel & Social Life
 * Generates 23 images across 3 categories:
 *   - Places (9): hotel, airport, train station, beach, mountain, museum, pharmacy, bank, library
 *   - Transportation (10): bus, train, plane, bicycle, car, boat, taxi, metro, motorcycle, on foot
 *   - Professions (4): waiter, shop clerk, journalist, lawyer
 *
 * Style: canonical "soft watercolor children's book illustration"
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

// Canonical style strings
const PROP =
  'Soft watercolor children\'s book illustration style, warm gentle colors, light pencil outlines, ' +
  'visible brushwork texture, object centred and prominent on a clean pure white background, ' +
  'no background elements, clear and recognisable silhouette, no text or letters anywhere.';

const SCENE =
  'Soft watercolor children\'s book illustration style, warm gentle colors, light pencil outlines, ' +
  'visible brushwork texture, friendly and inviting scene, no text or signs or labels anywhere in the image, ' +
  'language learning educational context, suitable for all ages.';

const CHAR =
  'Characters have natural proportions, soft illustrated faces — not exaggerated, no clown features, ' +
  'friendly and professional in appearance.';

const VERSION = 'v=1';

interface Entry {
  filename: string; destFilename: string; prompt: string;
  cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [

  // ── PLACES ───────────────────────────────────────────────────────────────────

  {
    filename: 'place_hotel.png', destFilename: 'vocab_place_hotel.png',
    prompt:
      'A welcoming hotel exterior — a handsome multi-storey building with a grand canopied entrance, ' +
      'potted plants flanking the doors, and warm lights glowing from the windows. ' +
      'A doorman stands at the entrance. Wide establishing shot. ' + SCENE,
    cacheKeys: ['vocab_spanish_hotel'],
    tags: ['vocabulary', 'novice_high', 'places'],
  },

  {
    filename: 'place_aeropuerto.png', destFilename: 'vocab_place_aeropuerto.png',
    prompt:
      'An airport exterior — a modern glass terminal building with a large covered drop-off area. ' +
      'A passenger jet is visible on the tarmac in the background. ' +
      'Travellers with suitcases walk toward the entrance. Wide establishing shot. ' + SCENE,
    cacheKeys: ['vocab_spanish_aeropuerto'],
    tags: ['vocabulary', 'novice_high', 'places'],
  },

  {
    filename: 'place_estacion_tren.png', destFilename: 'vocab_place_estacion_tren.png',
    prompt:
      'A charming train station exterior — a brick building with a large arched entrance and a platform ' +
      'visible alongside. A passenger train is stopped at the platform. ' +
      'A large clock is mounted above the entrance. Wide establishing shot. ' + SCENE,
    cacheKeys: ['vocab_spanish_estacion_tren', 'vocab_spanish_estacion'],
    tags: ['vocabulary', 'novice_high', 'places'],
  },

  {
    filename: 'place_playa.png', destFilename: 'vocab_place_playa.png',
    prompt:
      'A beautiful sunny beach — soft golden sand, gentle turquoise waves rolling in, ' +
      'a bright blue sky with a few fluffy clouds. A colourful beach umbrella and towel are visible on the sand. ' +
      'Wide establishing shot, warm and inviting. ' + SCENE,
    cacheKeys: ['vocab_spanish_playa'],
    tags: ['vocabulary', 'novice_high', 'places'],
  },

  {
    filename: 'place_montana.png', destFilename: 'vocab_place_montana.png',
    prompt:
      'Majestic mountain peaks — tall snow-capped mountains rising against a clear blue sky, ' +
      'with green pine forest on the lower slopes and a winding path leading upward. ' +
      'Wide establishing shot, grand and beautiful. ' + SCENE,
    cacheKeys: ['vocab_spanish_montana', 'vocab_spanish_montaña'],
    tags: ['vocabulary', 'novice_high', 'places'],
  },

  {
    filename: 'place_museo.png', destFilename: 'vocab_place_museo.png',
    prompt:
      'A museum exterior — a stately building with wide stone steps leading up to a grand columned entrance. ' +
      'A colourful exhibition banner hangs between the columns. ' +
      'A few visitors walk up the steps. Wide establishing shot. ' + SCENE,
    cacheKeys: ['vocab_spanish_museo'],
    tags: ['vocabulary', 'novice_high', 'places'],
  },

  {
    filename: 'place_farmacia.png', destFilename: 'vocab_place_farmacia.png',
    prompt:
      'A pharmacy exterior — a neat shop front with a large green cross sign above the entrance, ' +
      'a clean window display, and a friendly open door. ' +
      'A person is just stepping inside. Wide establishing shot. ' + SCENE,
    cacheKeys: ['vocab_spanish_farmacia'],
    tags: ['vocabulary', 'novice_high', 'places'],
  },

  {
    filename: 'place_banco.png', destFilename: 'vocab_place_banco.png',
    prompt:
      'A bank exterior — a solid, trustworthy building with stone steps, tall columns, and wide glass doors. ' +
      'A person with a briefcase walks up the steps. Wide establishing shot. ' + SCENE,
    cacheKeys: ['vocab_spanish_banco'],
    tags: ['vocabulary', 'novice_high', 'places'],
  },

  {
    filename: 'place_biblioteca.png', destFilename: 'vocab_place_biblioteca.png',
    prompt:
      'A library exterior — a welcoming building with wide steps, tall windows, and potted plants at the entrance. ' +
      'Through the large windows, rows of bookshelves are visible inside. ' +
      'A person carries a stack of books up the steps. Wide establishing shot. ' + SCENE,
    cacheKeys: ['vocab_spanish_biblioteca'],
    tags: ['vocabulary', 'novice_high', 'places'],
  },

  // ── TRANSPORTATION ────────────────────────────────────────────────────────────

  {
    filename: 'trans_autobus.png', destFilename: 'vocab_trans_autobus.png',
    prompt:
      'A bright city bus — cheerful blue and yellow, viewed from a slight angle showing the front and side. ' +
      'Clearly a passenger bus with windows and doors. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_autobus', 'vocab_spanish_autobús'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  {
    filename: 'trans_tren.png', destFilename: 'vocab_trans_tren.png',
    prompt:
      'A passenger train — sleek and modern, viewed from a slight angle showing the front and side carriages. ' +
      'Warm red or blue colour scheme. No text on the train. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_tren'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  {
    filename: 'trans_avion.png', destFilename: 'vocab_trans_avion.png',
    prompt:
      'A passenger airplane — a large commercial jet in profile, clean white with coloured tail fin. ' +
      'Viewed slightly from below to show it in flight. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_avion', 'vocab_spanish_avión'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  {
    filename: 'trans_bicicleta.png', destFilename: 'vocab_trans_bicicleta.png',
    prompt:
      'A bicycle — a classic upright bicycle in a cheerful colour, viewed from the side. ' +
      'Clearly showing wheels, handlebars, seat, and pedals. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_bicicleta'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  {
    filename: 'trans_coche.png', destFilename: 'vocab_trans_coche.png',
    prompt:
      'A family car — a cheerful compact car in a bright colour, viewed from a slight front-side angle. ' +
      'Friendly and approachable design. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_coche', 'vocab_spanish_carro', 'vocab_spanish_auto'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  {
    filename: 'trans_barco.png', destFilename: 'vocab_trans_barco.png',
    prompt:
      'A boat — a classic wooden sailing boat or small ferry viewed from the side, ' +
      'with a mast and sail or a simple deck. Warm colours. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_barco'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  {
    filename: 'trans_taxi.png', destFilename: 'vocab_trans_taxi.png',
    prompt:
      'A taxi cab — a classic yellow cab viewed from a slight front-side angle, ' +
      'with a taxi light on the roof. Clearly recognisable as a taxi. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_taxi'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  {
    filename: 'trans_metro.png', destFilename: 'vocab_trans_metro.png',
    prompt:
      'A metro/subway train — a modern underground train in a bright colour scheme, ' +
      'viewed from a slight angle showing the front and side. ' +
      'Clearly an underground transit train. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_metro', 'vocab_spanish_subte'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  {
    filename: 'trans_motocicleta.png', destFilename: 'vocab_trans_motocicleta.png',
    prompt:
      'A motorcycle — a classic road motorcycle in a bold colour, viewed from the side. ' +
      'Clearly showing the engine, handlebars, and two wheels. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_motocicleta', 'vocab_spanish_moto'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  {
    filename: 'trans_a_pie.png', destFilename: 'vocab_trans_a_pie.png',
    prompt:
      'A pair of feet and legs walking along a path — viewed from the side, showing someone in colourful ' +
      'trainers/sneakers taking a cheerful stride along a simple path. ' +
      'The illustration conveys "walking" or "on foot" clearly. Clean white background. ' + PROP,
    cacheKeys: ['vocab_spanish_a_pie', 'vocab_spanish_caminar'],
    tags: ['vocabulary', 'novice_high', 'transport'],
  },

  // ── PROFESSIONS ───────────────────────────────────────────────────────────────

  {
    filename: 'prof_camarero.png', destFilename: 'vocab_prof_camarero.png',
    prompt:
      'A waiter in a restaurant — a person wearing a neat white shirt and black apron, ' +
      'carrying a tray with a drink and a plate with a warm professional smile. ' +
      'Restaurant setting visible in background. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_camarero', 'vocab_spanish_camarera', 'vocab_spanish_mesero'],
    tags: ['vocabulary', 'novice_high', 'professions'],
  },

  {
    filename: 'prof_dependiente.png', destFilename: 'vocab_prof_dependiente.png',
    prompt:
      'A shop assistant standing behind a neat counter in a bright store, ' +
      'smiling and holding up a product to show a customer. ' +
      'Store shelves visible behind them. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_dependiente', 'vocab_spanish_dependienta'],
    tags: ['vocabulary', 'novice_high', 'professions'],
  },

  {
    filename: 'prof_periodista.png', destFilename: 'vocab_prof_periodista.png',
    prompt:
      'A journalist holding a microphone and a small notepad, standing outdoors ' +
      'as if reporting a story. Professional and engaged expression. ' +
      'A city background is softly visible behind them. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_periodista'],
    tags: ['vocabulary', 'novice_high', 'professions'],
  },

  {
    filename: 'prof_abogado.png', destFilename: 'vocab_prof_abogado.png',
    prompt:
      'A lawyer in a smart formal suit, standing confidently and holding a leather briefcase. ' +
      'Court or office setting softly visible in the background. ' +
      'Professional and trustworthy expression. ' + SCENE + ' ' + CHAR,
    cacheKeys: ['vocab_spanish_abogado', 'vocab_spanish_abogada'],
    tags: ['vocabulary', 'novice_high', 'professions'],
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

  console.log(`\n✅ All ${IMAGES.length} Novice High images generated and seeded.`);
}

main().catch(err => { console.error(err); process.exit(1); });

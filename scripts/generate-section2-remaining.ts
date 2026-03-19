/**
 * Remaining DALL-E Section 2 images:
 * Numbers: 0-10, 11-20, tens 10-100, hundreds/thousands, ordinals, price/currency, phone/address
 * Weather: forecast card, temperature scale
 * Time: daily routine visual, AM/PM-extended
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

const BASE = 'Soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture.';
const NOTXT = 'No written words, no word labels, no alphabetical text anywhere. Numerals and digit characters are acceptable where they are the subject matter.';
const SCENE = BASE + ' Friendly and welcoming scene. ' + NOTXT;

interface Entry {
  filename: string; destFilename: string; prompt: string; cacheKeys: string[]; tags: string[];
}

const IMAGES: Entry[] = [
  // ── NUMBERS 0-10 ──────────────────────────────────────────────────────────
  {
    filename: 'num_0_10.png', destFilename: 'vocab_num_0_10.png',
    prompt: 'A cheerful reference grid showing numbers 0 through 10. Eleven colourful cards arranged in two rows (0-5 top, 6-10 bottom). Each card shows: a large clear handwritten-style numeral in the centre, and that many small illustrated objects around it (0 = empty card with a question mark, 1 = one apple, 2 = two stars, 3 = three flowers, 4 = four butterflies, 5 = five fish, 6 = six hearts, 7 = seven dots, 8 = eight clouds, 9 = nine raindrops, 10 = ten suns). Numerals are large and clear. Each card has a different pastel background. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_num_0_10', 'vocab_spanish_cero', 'vocab_spanish_uno', 'vocab_spanish_dos', 'vocab_spanish_tres', 'vocab_spanish_cuatro', 'vocab_spanish_cinco', 'vocab_spanish_seis', 'vocab_spanish_siete', 'vocab_spanish_ocho', 'vocab_spanish_nueve', 'vocab_spanish_diez'],
    tags: ['vocabulary', 'section2', 'numbers'],
  },
  // ── NUMBERS 11-20 ─────────────────────────────────────────────────────────
  {
    filename: 'num_11_20.png', destFilename: 'vocab_num_11_20.png',
    prompt: 'A reference card showing numbers 11 through 20 in two rows of five cards. Each card shows the numeral large and clear, with matching illustrated dots or stars (like a dice pattern extended). Cards 11-15 on top row, 16-20 on bottom row. Each card has a warm pastel background colour that is slightly different. Numerals are bold and prominent. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_num_11_20', 'vocab_spanish_once', 'vocab_spanish_doce', 'vocab_spanish_trece', 'vocab_spanish_catorce', 'vocab_spanish_quince', 'vocab_spanish_dieciseis', 'vocab_spanish_diecisiete', 'vocab_spanish_dieciocho', 'vocab_spanish_diecinueve', 'vocab_spanish_veinte'],
    tags: ['vocabulary', 'section2', 'numbers'],
  },
  // ── TENS 10-100 ───────────────────────────────────────────────────────────
  {
    filename: 'num_tens.png', destFilename: 'vocab_num_tens.png',
    prompt: 'A visual grid showing the tens numbers: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100. Ten square panels in a 2x5 grid. Each panel shows the numeral large in the centre, with a pattern of grouped illustrated objects showing that quantity (e.g., 20 = two groups of 10 small circles, 100 = ten groups of 10 small squares). The numbers get progressively larger/denser. Each panel has a colour that gets progressively darker/richer from 10 (light yellow) to 100 (deep purple). Numerals bold and prominent. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_num_tens', 'vocab_spanish_veinte', 'vocab_spanish_treinta', 'vocab_spanish_cuarenta', 'vocab_spanish_cincuenta', 'vocab_spanish_sesenta', 'vocab_spanish_setenta', 'vocab_spanish_ochenta', 'vocab_spanish_noventa', 'vocab_spanish_cien'],
    tags: ['vocabulary', 'section2', 'numbers'],
  },
  // ── HUNDREDS & THOUSANDS ──────────────────────────────────────────────────
  {
    filename: 'num_hundreds.png', destFilename: 'vocab_num_hundreds.png',
    prompt: 'A scale reference card showing large numbers: 100, 500, 1000, 10000, and 1,000,000. Each number shown with a real-world anchor to give scale: 100 = a crowd of people; 500 = a small stadium; 1,000 = a large auditorium; 10,000 = a football stadium aerial view; 1,000,000 = a city skyline aerial view. Five panels arranged left to right, getting progressively bigger in scale. The numeral shown prominently on each panel. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_num_hundreds', 'vocab_spanish_cien', 'vocab_spanish_quinientos', 'vocab_spanish_mil', 'vocab_spanish_millon'],
    tags: ['vocabulary', 'section2', 'numbers'],
  },
  // ── ORDINALS 1st-10th ─────────────────────────────────────────────────────
  {
    filename: 'num_ordinals.png', destFilename: 'vocab_num_ordinals.png',
    prompt: 'A podium/ranking illustration showing ordinal positions. In the centre, a classic three-level podium (1st/2nd/3rd places) with small cartoon figures standing on positions 1, 2, and 3 — the 1st place figure has a gold medal and crown. To the sides, positions 4th through 10th shown as a finishing line race with numbered bibs or position signs showing 4, 5, 6, 7, 8, 9, 10. The ordinal numerals (1st, 2nd, 3rd, 4th etc.) shown as position markers. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_num_ordinals', 'vocab_spanish_primero', 'vocab_spanish_segundo', 'vocab_spanish_tercero', 'vocab_spanish_cuarto', 'vocab_spanish_quinto'],
    tags: ['vocabulary', 'section2', 'numbers'],
  },
  // ── PRICE & CURRENCY ──────────────────────────────────────────────────────
  {
    filename: 'num_currency.png', destFilename: 'vocab_num_currency.png',
    prompt: 'A colourful illustration of three price tags or shopping scenarios side by side, showing different currencies used in Spanish-speaking countries. LEFT: Mexican peso price tag showing $45 MXN with a taco. CENTRE: Euro price tag showing €3.50 with a coffee cup (Spain). RIGHT: Colombian peso price tag showing $12,000 COP with a fruit. Three cheerful market-style price displays with the currency symbols and numerals visible. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_num_currency', 'vocab_spanish_precio', 'vocab_spanish_cuanto_cuesta', 'vocab_spanish_peso', 'vocab_spanish_euro'],
    tags: ['vocabulary', 'section2', 'numbers'],
  },
  // ── PHONE/ADDRESS NUMBERS ─────────────────────────────────────────────────
  {
    filename: 'num_phone.png', destFilename: 'vocab_num_phone.png',
    prompt: 'A friendly illustrated guide showing how phone numbers work in Spanish-speaking countries. A vintage-style telephone handset in the centre with a sample phone number shown in grouped format (e.g., displayed as pairs of digits: 55 - 12 - 34 - 56). A speech bubble shows the digit-pair grouping. A street address number (Calle 5, No. 342) on a colourful building facade on the right side. Fun and approachable reference card. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_num_phone', 'vocab_spanish_numero_telefono', 'vocab_spanish_direccion'],
    tags: ['vocabulary', 'section2', 'numbers'],
  },
  // ── WEATHER FORECAST CARD ─────────────────────────────────────────────────
  {
    filename: 'weather_forecast_card.png', destFilename: 'vocab_weather_forecast_card.png',
    prompt: 'A colourful illustrated TV-style weekly weather forecast board showing 5 days. Five vertical panels side by side. Each panel shows: a large weather icon (sun, cloud, rain, storm, mixed cloud-sun) and a temperature range with a thermometer showing Celsius degrees (e.g., 18°C, 24°C, 12°C, 9°C, 21°C). The panels have cheerful sky-blue and gradient backgrounds. Style looks like a bright modern weather news broadcast graphic. Temperature degree numbers and icons are the main content. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_weather_forecast', 'vocab_spanish_pronostico', 'vocab_spanish_tiempo_semana'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  // ── TEMPERATURE SCALE ─────────────────────────────────────────────────────
  {
    filename: 'weather_temperature_scale.png', destFilename: 'vocab_weather_temperature_scale.png',
    prompt: 'A comparison illustration showing Celsius and Fahrenheit temperature scales side by side. Two large parallel thermometers — left is Celsius (°C) labelled clearly, right is Fahrenheit (°F) labelled clearly. Key reference points marked with small illustrated icons: 0°C / 32°F = snowflake (freezing), 20°C / 68°F = sun with light jacket (comfortable), 37°C / 98.6°F = heart (body temperature), 100°C / 212°F = boiling steam pot. The thermometers use a red mercury column. Cheerful educational comparison. Temperature numbers clearly visible on both scales. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_weather_temperature', 'vocab_spanish_temperatura', 'vocab_spanish_celsius', 'vocab_spanish_grados'],
    tags: ['vocabulary', 'section2', 'weather'],
  },
  // ── DAILY ROUTINE TIMELINE ────────────────────────────────────────────────
  {
    filename: 'time_rutina_diaria.png', destFilename: 'vocab_time_rutina_diaria.png',
    prompt: 'A horizontal timeline illustration showing a typical daily routine as a strip of illustrated scenes connected by arrows. From LEFT to RIGHT: (1) alarm clock with a sun rising — waking up; (2) person in shower with soap bubbles; (3) person eating breakfast at a table; (4) person with backpack leaving home; (5) person at school/office working; (6) person eating lunch; (7) person exercising outdoors; (8) person eating dinner with family; (9) person reading a book in bed; (10) crescent moon and turned-off lamp — sleeping. Ten scenes connected by right-pointing arrows forming a timeline strip. ' + BASE + ' ' + NOTXT,
    cacheKeys: ['vocab_time_rutina', 'vocab_spanish_levantarse', 'vocab_spanish_desayunar', 'vocab_spanish_almorzar', 'vocab_spanish_cenar', 'vocab_spanish_acostarse', 'vocab_spanish_ducharse'],
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
  console.log(`\n✅ All ${IMAGES.length} remaining Section 2 images done.`);
}
main().catch(err => { console.error(err); process.exit(1); });

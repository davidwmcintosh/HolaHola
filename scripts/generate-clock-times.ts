/**
 * Clock Time Images for Telling Time lessons
 * Generates 48 analog clock face PNGs programmatically (no AI cost, pixel-accurate hands)
 *
 * Sets: en punto (X:00) · y media (X:30) · y cuarto (X:15) · menos cuarto (X:45)
 * Each set covers all 12 hours → 48 images total
 *
 * Run: npx tsx scripts/generate-clock-times.ts
 */

import sharp from 'sharp';
import { Storage } from '@google-cloud/storage';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
const DB_URL    = process.env.NEON_SHARED_DATABASE_URL || '';
const SIDECAR   = 'http://127.0.0.1:1106';

if (!BUCKET_ID) throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
if (!DB_URL)    throw new Error('NEON_SHARED_DATABASE_URL not set');

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

// ── SVG clock face generator ─────────────────────────────────────────────────

function deg(d: number) { return d * Math.PI / 180; }

function makeSVG(hours: number, minutes: number): string {
  const cx = 200, cy = 200;
  const faceR  = 170;  // outer clock face radius

  // Hand angles — 12 o'clock = -90° in SVG coordinate space
  const hourAngle  = (hours % 12 + minutes / 60) * 30 - 90;
  const minAngle   = minutes * 6 - 90;

  const hourLen = 98;   // hour hand length
  const minLen  = 140;  // minute hand length

  const hourX = cx + hourLen * Math.cos(deg(hourAngle));
  const hourY = cy + hourLen * Math.sin(deg(hourAngle));
  const minX  = cx + minLen  * Math.cos(deg(minAngle));
  const minY  = cy + minLen  * Math.sin(deg(minAngle));

  // Hour tick marks + numbers
  let ticks = '';
  for (let i = 1; i <= 12; i++) {
    const a   = deg(i * 30 - 90);
    const in1 = faceR - 22;   // inner tick edge
    const out1 = faceR - 8;   // outer tick edge
    ticks += `<line
      x1="${(cx + in1 * Math.cos(a)).toFixed(2)}" y1="${(cy + in1 * Math.sin(a)).toFixed(2)}"
      x2="${(cx + out1 * Math.cos(a)).toFixed(2)}" y2="${(cy + out1 * Math.sin(a)).toFixed(2)}"
      stroke="#6D4C41" stroke-width="4.5" stroke-linecap="round"/>`;

    const numR = faceR - 42;
    const nx = cx + numR * Math.cos(a);
    const ny = cy + numR * Math.sin(a);
    ticks += `<text
      x="${nx.toFixed(2)}" y="${ny.toFixed(2)}"
      text-anchor="middle" dominant-baseline="central"
      font-size="26" font-family="Georgia, 'Times New Roman', serif"
      font-weight="bold" fill="#2C1A0E">${i}</text>`;
  }

  // Minute tick marks (thin, every 5 min position skipped — already have hour ticks)
  let minTicks = '';
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a    = deg(i * 6 - 90);
    const in2  = faceR - 13;
    const out2 = faceR - 8;
    minTicks += `<line
      x1="${(cx + in2 * Math.cos(a)).toFixed(2)}" y1="${(cy + in2 * Math.sin(a)).toFixed(2)}"
      x2="${(cx + out2 * Math.cos(a)).toFixed(2)}" y2="${(cy + out2 * Math.sin(a)).toFixed(2)}"
      stroke="#BCAAA4" stroke-width="1.5" stroke-linecap="round"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <!-- Warm cream background -->
  <rect width="400" height="400" fill="#FFF8F0" rx="24"/>
  <!-- Drop shadow circle -->
  <circle cx="${cx + 3}" cy="${cy + 4}" r="${faceR}" fill="rgba(0,0,0,0.07)"/>
  <!-- Clock face -->
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="#FFFDF9" stroke="#795548" stroke-width="7"/>
  <!-- Inner decorative ring -->
  <circle cx="${cx}" cy="${cy}" r="${faceR - 12}" fill="none" stroke="#D7CCC8" stroke-width="1"/>
  <!-- Minute ticks -->
  ${minTicks}
  <!-- Hour ticks and numbers -->
  ${ticks}
  <!-- Hour hand (navy blue) -->
  <line x1="${cx}" y1="${cy}"
        x2="${hourX.toFixed(2)}" y2="${hourY.toFixed(2)}"
        stroke="#1A237E" stroke-width="11" stroke-linecap="round"/>
  <!-- Minute hand (crimson) -->
  <line x1="${cx}" y1="${cy}"
        x2="${minX.toFixed(2)}" y2="${minY.toFixed(2)}"
        stroke="#B71C1C" stroke-width="7" stroke-linecap="round"/>
  <!-- Center cap outer -->
  <circle cx="${cx}" cy="${cy}" r="12" fill="#1A237E"/>
  <!-- Center cap inner dot -->
  <circle cx="${cx}" cy="${cy}" r="5" fill="white"/>
</svg>`;
}

// ── Spanish time label helpers ────────────────────────────────────────────────

const HOUR_WORDS = ['doce','una','dos','tres','cuatro','cinco','seis',
  'siete','ocho','nueve','diez','once','doce'];

function spanishTime(h: number, m: number): string {
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const article   = displayH === 1 ? 'la' : 'las';
  const hourWord  = HOUR_WORDS[displayH];
  if (m === 0)  return `${article} ${hourWord}`;
  if (m === 30) return `${article} ${hourWord} y media`;
  if (m === 15) return `${article} ${hourWord} y cuarto`;
  // m === 45 → "menos cuarto" of next hour
  const nextH     = (h % 12) + 1;
  const nextArt   = nextH === 1 ? 'la' : 'las';
  const nextWord  = HOUR_WORDS[nextH];
  return `${nextArt} ${nextWord} menos cuarto`;
}

function setLabel(m: number): string {
  if (m === 0)  return 'en-punto';
  if (m === 30) return 'y-media';
  if (m === 15) return 'y-cuarto';
  return 'menos-cuarto';
}

// ── Build image list ──────────────────────────────────────────────────────────

interface ClockEntry {
  hours: number;
  minutes: number;
  filename: string;   // local disk name (no vocab_ prefix)
  destFilename: string; // object storage name (vocab_ prefix)
  spanishLabel: string;
  set: string;
  cacheKey: string;
}

const CLOCKS: ClockEntry[] = [];
for (const minutes of [0, 30, 15, 45]) {
  for (let h = 1; h <= 12; h++) {
    const tag  = `time_clock_${h}_${String(minutes).padStart(2,'0')}`;
    const filename     = `${tag}.png`;
    const destFilename = `vocab_${tag}.png`;
    CLOCKS.push({
      hours: h, minutes,
      filename, destFilename,
      spanishLabel: spanishTime(h, minutes),
      set: setLabel(minutes),
      cacheKey: `vocab_${tag}`,
    });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Generating ${CLOCKS.length} clock face images…\n`);

  for (const [idx, entry] of CLOCKS.entries()) {
    const localPath = path.join(OUT_DIR, entry.filename);
    console.log(`[${idx + 1}/${CLOCKS.length}] ${entry.filename}  (${entry.spanishLabel})`);

    let buf: Buffer;

    if (fs.existsSync(localPath)) {
      console.log('  ↩ Reusing local file');
      buf = fs.readFileSync(localPath);
    } else {
      const svg = makeSVG(entry.hours, entry.minutes);
      buf = await sharp(Buffer.from(svg))
        .png({ compressionLevel: 6 })
        .toBuffer();
      fs.writeFileSync(localPath, buf);
      console.log('  ✓ Generated from SVG');
    }

    await gcs.bucket(BUCKET_ID)
      .file(`public/ai-images/${entry.destFilename}`)
      .save(buf, { contentType: 'image/png', metadata: { cacheControl: 'public, max-age=3600' } });

    const url = `/api/media/ai-image/${entry.destFilename}?v=1`;
    console.log(`  ✓ Uploaded → ${url}`);

    const tags = ['vocabulary', 'time', 'telling-time', 'clock', entry.set];
    const tagsLit = sql.raw(`ARRAY[${tags.map(t => `'${t}'`).join(',')}]::text[]`);
    const title   = `${entry.hours}:${String(entry.minutes).padStart(2,'0')} — ${entry.spanishLabel}`;

    const ex = await db.execute(sql`SELECT id FROM media_files WHERE search_query = ${entry.cacheKey} LIMIT 1`);
    if (ex.rows.length > 0) {
      await db.execute(sql`UPDATE media_files SET url = ${url}, filename = ${entry.destFilename} WHERE search_query = ${entry.cacheKey}`);
      console.log(`    ↻ Updated: ${entry.cacheKey}`);
    } else {
      await db.execute(sql`
        INSERT INTO media_files
          (id, media_type, url, filename, mime_type, title, description, tags,
           language, image_source, search_query, target_word, is_reviewed, usage_count)
        VALUES
          (gen_random_uuid(), 'image', ${url}, ${entry.destFilename}, 'image/png',
           ${title}, ${title}, ${tagsLit},
           'spanish', 'ai_generated', ${entry.cacheKey}, ${entry.cacheKey}, false, 0)
      `);
      console.log(`    ✓ Seeded: ${entry.cacheKey}`);
    }
  }

  console.log(`\n✅ All ${CLOCKS.length} clock images done.`);
  console.log('Sets generated: en punto · y media · y cuarto · menos cuarto (12 each)');
}

main().catch(err => { console.error(err); process.exit(1); });

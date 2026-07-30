/**
 * Download all prop images to a local folder for background editing.
 *
 * Images are saved as {prop_name}.png so they're easy to work with.
 * After cleaning the backgrounds, use scripts/upload-props.ts to push
 * the cleaned versions back and update the database URLs.
 *
 * Run: tsx scripts/download-props.ts
 * Options:
 *   --out=./my-folder   Output folder (default: ./props_download)
 *   --only=cup,espresso Comma-separated subset
 */

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { downloadBuffer } from '../server/replit_integrations/object_storage/objectStorage';

const args = process.argv.slice(2);
const outArg = args.find(a => a.startsWith('--out='));
const OUT_DIR = outArg ? outArg.replace('--out=', '') : './props_download';
const onlyArg = args.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.replace('--only=', '').split(',').map(s => s.trim()) : null;

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';

// Extract the storage path from an app-relative URL like /api/media/ai-image/foo.png
function urlToStoragePath(imageUrl: string): string {
  const filename = imageUrl.replace('/api/media/ai-image/', '');
  return `public/ai-images/${filename}`;
}

async function downloadFromStorage(storagePath: string): Promise<Buffer> {
  const result = await downloadBuffer(BUCKET_ID, storagePath);
  if (!result) throw new Error(`Object not found: ${storagePath}`);
  return result.buffer;
}

async function main() {
  if (!BUCKET_ID) throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`=== Prop Image Downloader ===`);
  console.log(`Output: ${path.resolve(OUT_DIR)}\n`);

  const rows = await db.execute(
    sql`SELECT name, display_name, image_url FROM visual_assets ORDER BY name`
  );
  const props = rows.rows as Array<{ name: string; display_name: string; image_url: string }>;

  let succeeded = 0, failed = 0, skipped = 0;

  for (const prop of props) {
    if (ONLY && !ONLY.includes(prop.name)) { skipped++; continue; }
    if (!prop.image_url || !prop.image_url.includes('ai-image')) {
      console.log(`  SKIP  ${prop.name} — no image URL`);
      skipped++;
      continue;
    }

    const safeName = prop.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const outPath = path.join(OUT_DIR, `${safeName}.png`);
    process.stdout.write(`  ${prop.name.padEnd(25)} → ${safeName}.png  `);

    try {
      const storagePath = urlToStoragePath(prop.image_url);
      const buffer = await downloadFromStorage(storagePath);
      fs.writeFileSync(outPath, buffer);
      console.log(`✓  (${(buffer.length / 1024).toFixed(0)} KB)`);
      succeeded++;
    } catch (err: any) {
      console.log(`✗  ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${succeeded} downloaded, ${skipped} skipped, ${failed} failed`);
  console.log(`\nFiles are in: ${path.resolve(OUT_DIR)}`);
  console.log(`\nNext step: clean the backgrounds, then run:`);
  console.log(`  tsx scripts/upload-props.ts --from=${OUT_DIR}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

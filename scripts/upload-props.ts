/**
 * Upload cleaned prop images back to object storage and update the database.
 *
 * Expects files named {prop_name}.png in the source folder.
 * Any file whose name matches a prop in visual_assets gets uploaded and
 * the image_url updated in the database.
 *
 * Run: tsx scripts/upload-props.ts --from=./props_download
 * Options:
 *   --from=./folder   Folder containing the cleaned PNG files (required)
 *   --only=cup,fork   Comma-separated subset of prop names
 *   --dry-run         Show what would happen without uploading
 */

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { uploadPublicBuffer } from '../server/services/image-storage';

const args = process.argv.slice(2);
const fromArg = args.find(a => a.startsWith('--from='));
const FROM_DIR = fromArg ? fromArg.replace('--from=', '') : null;
const onlyArg = args.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.replace('--only=', '').split(',').map(s => s.trim()) : null;
const DRY_RUN = args.includes('--dry-run');

if (!FROM_DIR) {
  console.error('Error: --from=<folder> is required');
  process.exit(1);
}

async function main() {
  const absDir = path.resolve(FROM_DIR!);
  if (!fs.existsSync(absDir)) {
    throw new Error(`Folder not found: ${absDir}`);
  }

  console.log(`=== Prop Image Uploader ===`);
  console.log(`Source: ${absDir}`);
  if (DRY_RUN) console.log(`DRY RUN — no uploads\n`);
  console.log('');

  const rows = await db.execute(
    sql`SELECT id, name FROM visual_assets ORDER BY name`
  );
  const props = rows.rows as Array<{ id: string; name: string }>;

  let succeeded = 0, failed = 0, skipped = 0;

  for (const prop of props) {
    if (ONLY && !ONLY.includes(prop.name)) { skipped++; continue; }

    const safeName = prop.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const filePath = path.join(absDir, `${safeName}.png`);

    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP  ${prop.name.padEnd(25)} — ${safeName}.png not found`);
      skipped++;
      continue;
    }

    const buffer = fs.readFileSync(filePath);
    process.stdout.write(`  ${prop.name.padEnd(25)} uploading...  `);

    if (DRY_RUN) {
      console.log(`would upload ${(buffer.length / 1024).toFixed(0)} KB`);
      succeeded++;
      continue;
    }

    try {
      const filename = `prop-${safeName}-cleaned-${Date.now()}.png`;
      const newUrl = await uploadPublicBuffer(filename, buffer, 'image/png');
      await db.execute(sql`UPDATE visual_assets SET image_url = ${newUrl} WHERE id = ${prop.id}`);
      console.log(`✓  → ${newUrl}`);
      succeeded++;
    } catch (err: any) {
      console.log(`✗  ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${succeeded} uploaded, ${skipped} skipped, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

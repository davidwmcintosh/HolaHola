/**
 * Seed new condiment and meal-menu props into visual_assets.
 *
 * Pre-requisite: Run generateImage in code_execution to create the PNG files
 * in attached_assets/generated_images/ first.
 *
 * Run: tsx scripts/seed-new-props.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { uploadPublicBuffer } from '../server/services/image-storage';

const PROPS = [
  { name: 'ketchup',        displayName: 'Ketchup',         objectType: 'condiment',     file: 'prop-ketchup.png' },
  { name: 'mustard',        displayName: 'Mustard',         objectType: 'condiment',     file: 'prop-mustard.png' },
  { name: 'hot_sauce',      displayName: 'Hot Sauce',       objectType: 'condiment',     file: 'prop-hot_sauce.png' },
  { name: 'butter',         displayName: 'Butter',          objectType: 'condiment',     file: 'prop-butter.png' },
  { name: 'jam',            displayName: 'Jam',             objectType: 'condiment',     file: 'prop-jam.png' },
  { name: 'sugar_packets',  displayName: 'Sugar Packets',   objectType: 'condiment',     file: 'prop-sugar_packets.png' },
  { name: 'breakfast_menu', displayName: 'Breakfast Menu',  objectType: 'document_prop', file: 'prop-breakfast_menu.png' },
  { name: 'lunch_menu',     displayName: 'Lunch Menu',      objectType: 'document_prop', file: 'prop-lunch_menu.png' },
  { name: 'dinner_menu',    displayName: 'Dinner Menu',     objectType: 'document_prop', file: 'prop-dinner_menu.png' },
];

const SOURCE_DIR = path.resolve('attached_assets/generated_images');

async function main() {
  console.log('=== Seeding new props ===\n');
  let ok = 0, fail = 0;

  for (const prop of PROPS) {
    const filePath = path.join(SOURCE_DIR, prop.file);
    if (!fs.existsSync(filePath)) {
      console.error(`✗ Missing file: ${filePath}`);
      fail++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const ts = Date.now();
      const zoneFilename = `prop-${prop.name}-zone-${ts}.png`;
      const mainFilename = `prop-${prop.name}-${ts}.png`;

      const zoneUrl = await uploadPublicBuffer(zoneFilename, buffer, 'image/png');
      const mainUrl = await uploadPublicBuffer(mainFilename, buffer, 'image/png');

      // Check if this prop already exists
      const existing = await db.execute(sql`SELECT id FROM visual_assets WHERE name = ${prop.name} LIMIT 1`);
      const existingRow = existing.rows[0] as any;

      if (existingRow) {
        await db.execute(sql`
          UPDATE visual_assets
          SET zone_image_url = ${zoneUrl},
              image_url      = ${mainUrl},
              display_name   = ${prop.displayName},
              object_type    = ${prop.objectType}
          WHERE name = ${prop.name}
        `);
        console.log(`✓ Updated ${prop.name}: ${zoneUrl}`);
      } else {
        await db.execute(sql`
          INSERT INTO visual_assets (name, display_name, object_type, image_url, zone_image_url)
          VALUES (${prop.name}, ${prop.displayName}, ${prop.objectType}, ${mainUrl}, ${zoneUrl})
        `);
        console.log(`✓ Inserted ${prop.name}: ${zoneUrl}`);
      }
      ok++;
    } catch (err: any) {
      console.error(`✗ Failed ${prop.name}:`, err.message);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} succeeded, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });

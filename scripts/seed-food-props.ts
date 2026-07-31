import * as fs from 'fs';
import { uploadPublicBuffer, normalizeImageUrl } from '../server/services/image-storage';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const newProps = [
  { name: 'scrambled_eggs', display: 'Scrambled Eggs', type: 'food' },
  { name: 'fried_eggs',     display: 'Fried Eggs',     type: 'food' },
  { name: 'omelette',       display: 'Omelette',       type: 'food' },
  { name: 'bacon_strips',   display: 'Bacon',          type: 'food' },
  { name: 'ham_slice',      display: 'Ham',            type: 'food' },
  { name: 'hash_browns',    display: 'Hash Browns',    type: 'food' },
  { name: 'plain_toast',    display: 'Toast',          type: 'food' },
  { name: 'bread_plate',    display: 'Side Plate',     type: 'prop' },
];

async function run() {
  for (const p of newProps) {
    const file = `attached_assets/generated_images/prop-${p.name}.png`;
    if (!fs.existsSync(file)) { console.log('MISSING:', file); continue; }
    const buf = fs.readFileSync(file);
    const url = normalizeImageUrl(await uploadPublicBuffer(`prop-${p.name}-${Date.now()}.png`, buf, 'image/png'));
    await db.execute(sql`
      INSERT INTO visual_assets (name, display_name, object_type, zone_image_url, image_url)
      VALUES (${p.name}, ${p.display}, ${p.type}, ${url}, ${url})
      ON CONFLICT (name) DO UPDATE SET zone_image_url = ${url}, display_name = ${p.display}
    `);
    console.log('✓', p.name);
  }
  console.log('Done — all food props seeded');
}

run().catch(e => { console.error(e.message); process.exit(1); });

/**
 * Seed close-up zone environments for preposition lessons.
 * Inserts the three new zone environments into visual_environments
 * then generates their images via DALL-E 3 using the zone style
 * (same illustrated watercolor as the main scenes, but close-up).
 *
 * Run: tsx scripts/seed-zone-environments.ts
 * Options:
 *   --force    Regenerate even if image_url is already set
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { archiveImageToPermanentStorage } from '../server/services/image-storage';

const OPENAI_KEY = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '';
const force = process.argv.includes('--force');

const ZONE_STYLE = 'warm illustrated watercolor style, soft natural lighting, cozy interior atmosphere, no visible text or signs or labels on objects, language learning educational context, suitable for all ages, close-up interior view, flat clear surface prominently occupying the center and lower frame where objects can be placed, clean and uncluttered';

const ZONES = [
  {
    name: 'kitchen_counter',
    display_name: 'Kitchen Counter',
    description: 'Close-up kitchen counter surface for preposition lessons — on the counter, under the counter',
    tags: ['kitchen', 'counter', 'prepositions', 'zone', 'close-up'],
    prompt: 'Close-up view looking at a kitchen counter from standing height — the smooth stone counter surface fills the bottom half of the frame with generous open space, a simple tile backsplash behind, warm wood cabinets at the sides, a window with soft daylight above, a few subtle background items (a small plant, a mixing bowl far back) but the counter surface is clean and clear',
  },
  {
    name: 'bedroom_closeup',
    display_name: 'Bedroom (Close-up)',
    description: 'Close-up bedroom corner showing bed, nightstand and floor for preposition lessons',
    tags: ['bedroom', 'bed', 'nightstand', 'prepositions', 'zone', 'close-up'],
    prompt: 'Close-up view of a cozy room interior showing a neatly made sleeping area — a tidy mattress with a crisp white blanket and two white pillows on the left, a warm wooden side table with a small reading lamp at center-right with a clear flat top surface available for objects, a strip of warm hardwood floor visible at the very bottom, soft daylight from a window on the right, peaceful and tidy home interior',
  },
  {
    name: 'desk_closeup',
    display_name: 'Study Desk (Close-up)',
    description: 'Close-up of a wooden study desk surface for preposition lessons — on the desk, under the desk',
    tags: ['desk', 'study', 'office', 'prepositions', 'zone', 'close-up'],
    prompt: 'Close-up view of a wooden study desk — the desk surface fills the lower two-thirds of the frame with open clear space, the back of a simple wooden chair just visible at the very bottom edge, a warm daylit window and a bookshelf with colourful spines visible in the background, desk surface is clean and ready to receive objects',
  },
];

async function generateZoneImage(prompt: string, name: string): Promise<string> {
  const fullPrompt = `${prompt}. ${ZONE_STYLE}`;
  console.log(`  Prompt: ${fullPrompt.substring(0, 100)}...`);

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: '1792x1024',
      quality: 'hd',
      response_format: 'url',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DALL-E failed: ${err}`);
  }

  const data = await res.json();
  const tempUrl = data.data?.[0]?.url;
  if (!tempUrl) throw new Error('No URL in DALL-E response');

  return archiveImageToPermanentStorage(tempUrl, `scene-${name}-${Date.now()}.jpg`);
}

async function main() {
  if (!OPENAI_KEY || OPENAI_KEY.startsWith('_DUMMY')) {
    throw new Error('No valid OpenAI API key (USER_OPENAI_API_KEY, OPENAI_API_KEY, or AI_INTEGRATIONS_OPENAI_API_KEY)');
  }

  console.log('=== Zone Environment Seeder ===\n');

  for (const zone of ZONES) {
    console.log(`\n[${zone.name}]`);

    const existing = await db.execute(
      sql`SELECT id, image_url FROM visual_environments WHERE name = ${zone.name}`
    );

    let envId: string;

    if (existing.rows.length > 0) {
      const row = existing.rows[0] as { id: string; image_url: string };
      envId = row.id;
      if (!force && row.image_url && row.image_url.trim() !== '') {
        console.log(`  SKIP — already exists with image: ${row.image_url}`);
        continue;
      }
      console.log(`  Found existing record, regenerating image...`);
    } else {
      console.log(`  Inserting new environment record...`);
      const insertRes = await db.execute(sql`
        INSERT INTO visual_environments (name, display_name, description, image_url, width, height, tags)
        VALUES (
          ${zone.name},
          ${zone.display_name},
          ${zone.description},
          '',
          1920,
          1080,
          ${sql.raw(`ARRAY[${zone.tags.map(t => `'${t}'`).join(',')}]::text[]`)}
        )
        ON CONFLICT (name) DO NOTHING
        RETURNING id
      `);
      const newRow = insertRes.rows[0] as { id: string } | undefined;
      if (!newRow) {
        const refetch = await db.execute(sql`SELECT id FROM visual_environments WHERE name = ${zone.name}`);
        envId = (refetch.rows[0] as { id: string }).id;
      } else {
        envId = newRow.id;
      }
    }

    try {
      console.log(`  Generating image via DALL-E 3 (hd quality)...`);
      const permanentUrl = await generateZoneImage(zone.prompt, zone.name);
      await db.execute(sql`UPDATE visual_environments SET image_url = ${permanentUrl} WHERE id = ${envId}`);
      console.log(`  ✓ ${permanentUrl}`);
    } catch (err: any) {
      console.error(`  ✗ Image generation failed: ${err.message}`);
    }
  }

  console.log('\n=== Done ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

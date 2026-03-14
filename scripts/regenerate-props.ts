/**
 * Smart batch prop image regeneration.
 *
 * Regenerates all prop images (or a subset) with:
 *   - Consistent warm illustrated watercolor style matching the zone environments
 *   - Per-prop distinctive prompts so similar items are visually unique
 *     (espresso vs latte vs coffee with cream vs hot chocolate, etc.)
 *
 * Run: tsx scripts/regenerate-props.ts
 * Options:
 *   --only=cup,espresso,latte   Comma-separated prop names
 *   --force                     Regenerate even if image already exists (all do by default)
 *   --dry-run                   Print prompts without calling API
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { archiveImageToPermanentStorage } from '../server/services/image-storage';

const OPENAI_KEY = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '';

const args = process.argv.slice(2);
const onlyArg = args.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.replace('--only=', '').split(',').map(s => s.trim()) : null;
const DRY_RUN = args.includes('--dry-run');

// Shared style for all props — matches the zone environments' illustrated watercolor look
const PROP_STYLE = 'warm illustrated watercolor style, vibrant saturated colours, soft natural shading, object centred and prominent on a clean pure white background, no shadows or background elements, language learning educational illustration quality, consistent flat illustration style, clear and recognisable silhouette';

// Per-prop prompt overrides. Props NOT listed here get an auto-generated prompt
// based on their display_name, but these key ones need precise visual differentiation.
const PROP_PROMPTS: Record<string, string> = {

  // ── Drinks — must look visually distinct from each other ───────────────────
  espresso:
    'A single shot of espresso in a tiny white ceramic demitasse cup sitting on a matching white saucer, small golden-brown crema foam layer on the surface, small accompanying spoon beside the cup',
  latte:
    'A café latte in a wide shallow white ceramic cup, latte art on the foam surface (a simple leaf pattern), creamy warm beige coffee color visible through the foam',
  'coffee with cream':
    'A white ceramic coffee mug filled with dark brown coffee, a generous swirl of white cream being stirred in, the cream forming a beautiful ribbon pattern through the dark coffee',
  'hot chocolate':
    'A wide ceramic mug filled with rich dark hot chocolate, topped with a fluffy dome of whipped cream and a light dusting of cocoa powder, steam wisping upward',
  coffee:
    'A classic white ceramic coffee mug filled with dark drip coffee, simple and clean, steam rising gently from the top',

  // ── Tableware ──────────────────────────────────────────────────────────────
  cup:
    'A simple white ceramic tea cup with a handle, empty and clean, slightly tilted to show the inside, on a matching white saucer',
  plate:
    'A plain round white ceramic dinner plate, empty, slight rim visible, viewed at a gentle angle',
  dinner_plate:
    'A large white ceramic dinner plate with a subtle rim detail, empty and clean, viewed at a slight angle',
  glass:
    'A clear glass tumbler, simple cylindrical shape, empty, with light catching the rim and base',
  wine_glass:
    'An elegant clear crystal wine glass, long stem, empty, with light refracting through the bowl',
  fork:
    'A stainless steel dinner fork, slightly angled to the right, clean and polished, single fork',
  knife:
    'A stainless steel dinner knife, slightly angled, clean blade with a simple handle, single knife',
  spoon:
    'A stainless steel tablespoon, slightly angled, clean bowl and handle, single spoon',
  napkin:
    'A neatly folded white cloth napkin, crisp folds, rectangle fold, slightly dimensional',

  // ── Food ───────────────────────────────────────────────────────────────────
  croissant:
    'A golden-brown butter croissant, flaky layered crust, curved crescent shape, a few flaky crumbs beside it',
  churros:
    'Three golden fried churros arranged in a casual pile, ridged texture, dusted with cinnamon sugar, small dipping cup of chocolate sauce beside them',
  'butter tartine':
    'A thick slice of rustic bread with a generous spread of pale yellow butter, butter slightly melting into the bread texture',
  'chocolate pastry':
    'A rectangular pain au chocolat pastry, golden-brown flaky puff pastry with visible dark chocolate ends, one end slightly broken to show the chocolate inside',
  'toast with tomato':
    'A slice of toasted bread rubbed with tomato, bright red tomato visible on the golden toast, a drizzle of olive oil, a few sea salt flakes on top',
  apple:
    'A bright red apple with a short green stem, round and glossy, a single small leaf attached to the stem',
  banana:
    'A ripe yellow banana with one end slightly darker, slight natural curve, fresh-looking',
  pasta:
    'A generous serving of spaghetti pasta twirled into a neat mound, with a small amount of red tomato sauce at the top, fresh basil leaf garnish',
  bread_basket:
    'A small wicker bread basket lined with a white cloth, holding several slices of rustic baguette, one slice leaning against the side',

  // ── Luggage ────────────────────────────────────────────────────────────────
  suitcase:
    'A medium-size hardshell rolling suitcase in navy blue with silver hardware, retractable handle fully extended, two wheels at the base visible, slightly angled view',
  backpack:
    'A casual backpack in warm terracotta orange, two main compartments, padded shoulder straps, front zip pocket, sitting upright',

  // ── Documents ──────────────────────────────────────────────────────────────
  passport:
    'A navy blue passport booklet, slightly open at a 30-degree angle showing the embossed gold seal on the cover, a few pages fanning out',
  boarding_pass:
    'A white boarding pass ticket with coloured stripes at the top, simple printed text layout, slightly curved as if just pulled from a pocket, no readable text',
  hotel_key_card:
    'A slim white hotel key card with a subtle decorative pattern on the front, magnetic stripe on the back visible at the bottom edge, slightly tilted',
  luggage_tag:
    'A leather luggage tag in tan brown, a small window showing a white card inside, a short leather strap at the top',
  hotel_brochure:
    'A folded tri-fold brochure with a warm colour cover, slightly fanned open to show two panels, elegant hotel design feel, no readable text',
  menu_card:
    'A small folded menu card in dark green with a cream interior visible, simple elegant style, no readable text',
  restaurant_menu:
    'A leather-bound restaurant menu, dark burgundy cover, slightly open showing a cream page inside, no readable text',
  restaurant_bill:
    'A small white paper bill/receipt folded in half, placed on a small black tray with a mint leaf beside it',
  prescription_pad:
    'A small white prescription notepad, the top sheet slightly raised, doctor-style layout, no readable text',

  // ── Medical ────────────────────────────────────────────────────────────────
  stethoscope:
    'A doctor\'s stethoscope in silver and black, the chest piece prominent, earpiece tubes looped in a relaxed circle',
  thermometer:
    'A digital thermometer in white with a grey tip, simple stick shape, small display screen visible',
  'blood_pressure_cuff':
    'A blood pressure cuff in navy blue, Velcro strap partially unrolled, attached rubber bulb and gauge visible',
  medicine_bottle:
    'A small amber glass medicine bottle with a white child-proof cap, orange prescription label, slightly angled view',

  // ── Household ──────────────────────────────────────────────────────────────
  book:
    'A hardcover book with a colourful illustrated cover, spine visible with the book slightly open at a 20-degree angle, a ribbon bookmark hanging from the bottom',
  cell_phone:
    'A modern smartphone with a dark screen, slim profile, in a simple dark case, slightly angled to show front face and slim side',
  umbrella:
    'A closed umbrella with a curved wooden handle, dark navy canopy, neatly closed with the strap fastened',
  wallet:
    'A slim bifold wallet in dark brown leather, slightly open to show a credit card tucked in a pocket, clean stitching',

  // ── Beverages / Drinkware ──────────────────────────────────────────────────
  water_pitcher:
    'A clear glass water pitcher with a handle, half-filled with water and ice cubes, a slice of lemon floating at the top',
  'wine_glass':
    'An elegant clear crystal wine glass with a long stem, empty, light catching the rim, classic tulip bowl shape',

  // ── Kitchen / Condiments ───────────────────────────────────────────────────
  salt_pepper:
    'A matching pair of salt and pepper shakers, small white ceramic cylinders, one with a single hole for pepper and one with multiple holes for salt, side by side',
  espresso_machine:
    'A compact home espresso machine in silver and black, portafilter handle visible on the front, steam wand on the side, clean modern design',

  // ── Shopping / Market ─────────────────────────────────────────────────────
  shopping_cart:
    'A metal grocery shopping cart with a wire basket, front wheels visible, handle at back, empty cart viewed from a slight front-left angle',
  shopping_basket:
    'A red plastic shopping basket with two short handles, empty, viewed slightly from above to show the open top',
  grocery_bag:
    'A brown paper grocery bag, top folded open revealing the top of a baguette and some leafy vegetables peeking out, bag filled and standing upright',
  produce_display:
    'A small wooden produce display with compartments holding colourful fruits and vegetables — oranges, apples, green herbs — neat and fresh-looking',

  // ── Decoration / Props ─────────────────────────────────────────────────────
  candle:
    'A short white pillar candle with a small warm flame, a ring of melted wax around the wick, simple cylindrical shape',
};

async function buildPrompt(name: string, displayName: string): Promise<string> {
  const specific = PROP_PROMPTS[name] || PROP_PROMPTS[displayName.toLowerCase()];
  const subject = specific || `${displayName} — a common everyday object, clearly and accurately illustrated`;
  return `${subject}. ${PROP_STYLE}`;
}

async function generatePropImage(prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DALL-E failed: ${err}`);
  }

  const data = await res.json();
  const tempUrl = data.data?.[0]?.url;
  if (!tempUrl) throw new Error('No URL in response');
  return tempUrl;
}

async function main() {
  if (!DRY_RUN && (!OPENAI_KEY || OPENAI_KEY.startsWith('_DUMMY'))) {
    throw new Error('No valid OpenAI API key');
  }

  console.log('=== Smart Prop Batch Regeneration ===');
  if (ONLY) console.log(`Only: ${ONLY.join(', ')}`);
  if (DRY_RUN) console.log('DRY RUN — no API calls\n');
  console.log('');

  const rows = await db.execute(sql`SELECT id, name, display_name, object_type FROM visual_assets ORDER BY name`);
  const props = rows.rows as Array<{ id: string; name: string; display_name: string; object_type: string }>;

  let succeeded = 0, failed = 0, skipped = 0;

  for (const prop of props) {
    if (ONLY && !ONLY.includes(prop.name) && !ONLY.includes(prop.display_name.toLowerCase())) {
      skipped++;
      continue;
    }

    const prompt = await buildPrompt(prop.name, prop.display_name);

    if (DRY_RUN) {
      console.log(`[${prop.name}]\n  ${prompt}\n`);
      continue;
    }

    process.stdout.write(`[${prop.name}] Generating...`);
    try {
      const tempUrl = await generatePropImage(prompt);
      const filename = `prop-${prop.name.replace(/\s+/g, '_')}-${Date.now()}.png`;
      const permanentUrl = await archiveImageToPermanentStorage(tempUrl, filename);
      await db.execute(sql`UPDATE visual_assets SET image_url = ${permanentUrl} WHERE id = ${prop.id}`);
      console.log(` ✓`);
      succeeded++;

      // Brief pause between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.log(` ✗ ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${succeeded} regenerated, ${skipped} skipped, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

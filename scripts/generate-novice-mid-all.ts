/**
 * Generate ALL remaining Novice Mid visual assets:
 *   - Animals (10)
 *   - Fruits & Vegetables (12)
 *   - Clothing (8)
 *   - Activities (8)
 *   - Adjectives / contrast pairs (10)
 *
 * Safe to re-run: skips any local file already saved.
 * Run: npx tsx scripts/generate-novice-mid-all.ts
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

// ── Styles ──────────────────────────────────────────────────────────────────
const PROP_STYLE =
  'warm illustrated watercolor style, vibrant saturated colours, soft natural shading, ' +
  'object centred and prominent on a clean pure white background, no background elements, ' +
  'language learning educational illustration quality. ' +
  'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.';

const SCENE_STYLE =
  'warm illustrated watercolor style, vibrant saturated colours, soft natural shading, ' +
  'language learning educational illustration quality, full-body action scene, ' +
  'clear and recognisable motion. ' +
  'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.';

const PAIR_STYLE =
  'warm illustrated watercolor style, vibrant saturated colours, soft natural shading, ' +
  'TWO contrasting scenes or objects side by side showing opposite concepts, ' +
  'language learning educational illustration quality, clean white background. ' +
  'ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.';

// ── Types ────────────────────────────────────────────────────────────────────
interface CacheKey { key: string; title: string; description: string; }
interface ImageEntry {
  filename: string;
  destFilename: string;
  prompt: string;
  title: string;
  description: string;
  tags: string[];
  cacheKeys: CacheKey[];
}

// ── Image manifest ────────────────────────────────────────────────────────────
const IMAGES: ImageEntry[] = [

  // ════════════════════════════════════════════════════════════════════════════
  // ANIMALS
  // ════════════════════════════════════════════════════════════════════════════
  {
    filename: 'animal_perro.png', destFilename: 'vocab_animal_perro.png',
    prompt: `A friendly dog — a typical family pet, medium-sized, sitting or standing and looking at the viewer with a happy expression, tongue out. ${PROP_STYLE}`,
    title: 'El Perro', description: 'Dog — friendly family pet',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_perro', title: 'Perro', description: 'Dog' },
    ],
  },
  {
    filename: 'animal_gato.png', destFilename: 'vocab_animal_gato.png',
    prompt: `A cute cat sitting upright and looking at the viewer, perhaps with its tail curled around its feet. Tabby or orange colouring. ${PROP_STYLE}`,
    title: 'El Gato', description: 'Cat — domestic cat sitting',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_gato', title: 'Gato', description: 'Cat' },
    ],
  },
  {
    filename: 'animal_pajaro.png', destFilename: 'vocab_animal_pajaro.png',
    prompt: `A colourful tropical bird perched on a branch, wings slightly spread, looking forward. Bright plumage — red, blue, yellow. ${PROP_STYLE}`,
    title: 'El Pájaro', description: 'Bird — colourful bird perched on branch',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_pajaro', title: 'Pájaro', description: 'Bird' },
      { key: 'vocab_spanish_ave', title: 'Ave', description: 'Bird (ave)' },
    ],
  },
  {
    filename: 'animal_pez.png', destFilename: 'vocab_animal_pez.png',
    prompt: `A single bright tropical fish swimming in clear blue water, viewed from the side so its full shape is visible. Colourful scales. ${PROP_STYLE}`,
    title: 'El Pez', description: 'Fish — live fish swimming in water (pez = live fish)',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_pez', title: 'Pez', description: 'Fish (live, swimming)' },
    ],
  },
  {
    filename: 'animal_caballo.png', destFilename: 'vocab_animal_caballo.png',
    prompt: `A beautiful horse standing proudly in profile view, in a green field. Chestnut or dark brown with a flowing mane. ${PROP_STYLE}`,
    title: 'El Caballo', description: 'Horse — standing in a field',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_caballo', title: 'Caballo', description: 'Horse' },
    ],
  },
  {
    filename: 'animal_vaca.png', destFilename: 'vocab_animal_vaca.png',
    prompt: `A classic black and white dairy cow standing in a green grassy meadow, viewed from the side. Friendly expression. ${PROP_STYLE}`,
    title: 'La Vaca', description: 'Cow — black and white dairy cow in meadow',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_vaca', title: 'Vaca', description: 'Cow' },
    ],
  },
  {
    filename: 'animal_oveja.png', destFilename: 'vocab_animal_oveja.png',
    prompt: `A fluffy white sheep standing in a grassy field, round and woolly, looking at the viewer. Classic farm animal. ${PROP_STYLE}`,
    title: 'La Oveja', description: 'Sheep — fluffy white sheep in field',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_oveja', title: 'Oveja', description: 'Sheep' },
    ],
  },
  {
    filename: 'animal_oso.png', destFilename: 'vocab_animal_oso.png',
    prompt: `A large brown bear standing on all four paws, viewed from the side, in a forest setting. Majestic and powerful but friendly illustrated style. ${PROP_STYLE}`,
    title: 'El Oso', description: 'Bear — brown bear in forest',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_oso', title: 'Oso', description: 'Bear' },
    ],
  },
  {
    filename: 'animal_pato.png', destFilename: 'vocab_animal_pato.png',
    prompt: `A classic mallard duck floating on calm blue water, viewed from the side. Green head, orange bill, colourful wing markings. ${PROP_STYLE}`,
    title: 'El Pato', description: 'Duck — mallard duck on water',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_pato', title: 'Pato', description: 'Duck' },
    ],
  },
  {
    filename: 'animal_conejo.png', destFilename: 'vocab_animal_conejo.png',
    prompt: `An adorable white rabbit sitting upright on its hind legs, ears up, looking at the viewer. Fluffy and cute. ${PROP_STYLE}`,
    title: 'El Conejo', description: 'Rabbit — white rabbit sitting upright',
    tags: ['vocabulary', 'novice_mid', 'animals', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_conejo', title: 'Conejo', description: 'Rabbit' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // FRUITS & VEGETABLES
  // ════════════════════════════════════════════════════════════════════════════
  {
    filename: 'food_naranja.png', destFilename: 'vocab_food_naranja.png',
    prompt: `A bright orange citrus fruit — whole orange with a half-orange slice beside it showing the juicy interior. Vibrant orange colour. ${PROP_STYLE}`,
    title: 'La Naranja', description: 'Orange — citrus fruit whole and sliced',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_naranja', title: 'Naranja', description: 'Orange (fruit)' },
    ],
  },
  {
    filename: 'food_fresa.png', destFilename: 'vocab_food_fresa.png',
    prompt: `A cluster of bright red ripe strawberries with green leaves, some whole and one sliced to show the interior. ${PROP_STYLE}`,
    title: 'La Fresa', description: 'Strawberry — fresh ripe strawberries',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_fresa', title: 'Fresa', description: 'Strawberry' },
      { key: 'vocab_spanish_frutilla', title: 'Frutilla', description: 'Strawberry (South America)' },
    ],
  },
  {
    filename: 'food_uva.png', destFilename: 'vocab_food_uva.png',
    prompt: `A bunch of plump purple grapes on a vine with green leaves, hanging naturally. Rich deep purple colour. ${PROP_STYLE}`,
    title: 'La Uva', description: 'Grape — cluster of purple grapes on vine',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_uva', title: 'Uva', description: 'Grape' },
    ],
  },
  {
    filename: 'food_sandia.png', destFilename: 'vocab_food_sandia.png',
    prompt: `A watermelon — one whole and one large triangular slice beside it showing the bright red interior with black seeds. ${PROP_STYLE}`,
    title: 'La Sandía', description: 'Watermelon — whole and slice showing red interior',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_sandia', title: 'Sandía', description: 'Watermelon' },
    ],
  },
  {
    filename: 'food_limon.png', destFilename: 'vocab_food_limon.png',
    prompt: `A bright yellow lemon — one whole lemon and a halved lemon beside it showing the pale yellow interior. Fresh citrus. ${PROP_STYLE}`,
    title: 'El Limón', description: 'Lemon — whole and halved yellow lemon',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_limon', title: 'Limón', description: 'Lemon' },
    ],
  },
  {
    filename: 'food_tomate.png', destFilename: 'vocab_food_tomate.png',
    prompt: `Two ripe red tomatoes — one whole, one halved showing the juicy interior with seeds. Bright red, fresh. ${PROP_STYLE}`,
    title: 'El Tomate', description: 'Tomato — whole and halved ripe red tomato',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_tomate', title: 'Tomate', description: 'Tomato' },
      { key: 'vocab_spanish_jitomate', title: 'Jitomate', description: 'Tomato (Mexico)' },
    ],
  },
  {
    filename: 'food_zanahoria.png', destFilename: 'vocab_food_zanahoria.png',
    prompt: `Two or three bright orange carrots with green leafy tops, fresh and crisp looking. ${PROP_STYLE}`,
    title: 'La Zanahoria', description: 'Carrot — fresh orange carrots with green tops',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_zanahoria', title: 'Zanahoria', description: 'Carrot' },
    ],
  },
  {
    filename: 'food_lechuga.png', destFilename: 'vocab_food_lechuga.png',
    prompt: `A fresh head of green lettuce, round and leafy, vibrant bright green. ${PROP_STYLE}`,
    title: 'La Lechuga', description: 'Lettuce — fresh green head of lettuce',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_lechuga', title: 'Lechuga', description: 'Lettuce' },
    ],
  },
  {
    filename: 'food_papa.png', destFilename: 'vocab_food_papa.png',
    prompt: `Two or three brown potatoes of varying sizes, one halved showing the pale interior. Classic root vegetable. ${PROP_STYLE}`,
    title: 'La Papa', description: 'Potato — brown potatoes whole and halved',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_papa', title: 'Papa', description: 'Potato (Latin America)' },
      { key: 'vocab_spanish_patata', title: 'Patata', description: 'Potato (Spain)' },
    ],
  },
  {
    filename: 'food_cebolla.png', destFilename: 'vocab_food_cebolla.png',
    prompt: `A yellow onion — one whole with papery skin and one halved showing the layered interior. Classic cooking ingredient. ${PROP_STYLE}`,
    title: 'La Cebolla', description: 'Onion — whole and halved yellow onion',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_cebolla', title: 'Cebolla', description: 'Onion' },
    ],
  },
  {
    filename: 'food_ajo.png', destFilename: 'vocab_food_ajo.png',
    prompt: `A head of garlic — one whole bulb and a few separated cloves beside it. Papery white skin. Classic kitchen ingredient. ${PROP_STYLE}`,
    title: 'El Ajo', description: 'Garlic — garlic bulb and cloves',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_ajo', title: 'Ajo', description: 'Garlic' },
    ],
  },
  {
    filename: 'food_maiz.png', destFilename: 'vocab_food_maiz.png',
    prompt: `Two ears of corn — golden yellow kernels, green husks partially peeled back to show the bright corn inside. ${PROP_STYLE}`,
    title: 'El Maíz', description: 'Corn / maize — ears of corn with husks',
    tags: ['vocabulary', 'novice_mid', 'food', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_maiz', title: 'Maíz', description: 'Corn / maize' },
      { key: 'vocab_spanish_elote', title: 'Elote', description: 'Corn on the cob (Mexico)' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // CLOTHING
  // ════════════════════════════════════════════════════════════════════════════
  {
    filename: 'cloth_camisa.png', destFilename: 'vocab_cloth_camisa.png',
    prompt: `A men's button-up shirt laid flat, collar visible, light blue or white colour. Clean and simple. ${PROP_STYLE}`,
    title: 'La Camisa', description: 'Shirt — men\'s button-up shirt laid flat',
    tags: ['vocabulary', 'novice_mid', 'clothing', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_camisa', title: 'Camisa', description: 'Shirt' },
    ],
  },
  {
    filename: 'cloth_pantalon.png', destFilename: 'vocab_cloth_pantalon.png',
    prompt: `A pair of blue jeans / trousers laid flat, showing the full length from waist to cuffs. Classic denim. ${PROP_STYLE}`,
    title: 'El Pantalón', description: 'Trousers / pants — blue jeans laid flat',
    tags: ['vocabulary', 'novice_mid', 'clothing', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_pantalon', title: 'Pantalón', description: 'Trousers / pants' },
      { key: 'vocab_spanish_pantalones', title: 'Pantalones', description: 'Trousers / pants (plural)' },
    ],
  },
  {
    filename: 'cloth_vestido.png', destFilename: 'vocab_cloth_vestido.png',
    prompt: `A women's dress displayed on its own — colourful floral pattern, A-line shape, shown hanging or laid flat. ${PROP_STYLE}`,
    title: 'El Vestido', description: 'Dress — colourful women\'s dress',
    tags: ['vocabulary', 'novice_mid', 'clothing', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_vestido', title: 'Vestido', description: 'Dress' },
    ],
  },
  {
    filename: 'cloth_zapatos.png', destFilename: 'vocab_cloth_zapatos.png',
    prompt: `A pair of shoes — classic lace-up sneakers or casual shoes shown as a pair side by side. ${PROP_STYLE}`,
    title: 'Los Zapatos', description: 'Shoes — a pair of casual shoes',
    tags: ['vocabulary', 'novice_mid', 'clothing', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_zapatos', title: 'Zapatos', description: 'Shoes (pair)' },
      { key: 'vocab_spanish_zapato', title: 'Zapato', description: 'Shoe (singular)' },
    ],
  },
  {
    filename: 'cloth_sombrero.png', destFilename: 'vocab_cloth_sombrero.png',
    prompt: `A wide-brimmed hat — a classic Mexican sombrero or straw hat shown from a slight angle so the shape is clear. ${PROP_STYLE}`,
    title: 'El Sombrero', description: 'Hat — wide-brimmed sombrero or straw hat',
    tags: ['vocabulary', 'novice_mid', 'clothing', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_sombrero', title: 'Sombrero', description: 'Hat / sombrero' },
    ],
  },
  {
    filename: 'cloth_chaqueta.png', destFilename: 'vocab_cloth_chaqueta.png',
    prompt: `A jacket shown from the front — a casual denim jacket or bomber jacket laid flat or hanging. ${PROP_STYLE}`,
    title: 'La Chaqueta', description: 'Jacket — casual jacket laid flat',
    tags: ['vocabulary', 'novice_mid', 'clothing', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_chaqueta', title: 'Chaqueta', description: 'Jacket' },
      { key: 'vocab_spanish_abrigo', title: 'Abrigo', description: 'Coat / overcoat' },
    ],
  },
  {
    filename: 'cloth_calcetines.png', destFilename: 'vocab_cloth_calcetines.png',
    prompt: `A pair of socks — colourful cotton socks shown as a pair, one laid flat and one folded. ${PROP_STYLE}`,
    title: 'Los Calcetines', description: 'Socks — a pair of colourful socks',
    tags: ['vocabulary', 'novice_mid', 'clothing', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_calcetines', title: 'Calcetines', description: 'Socks' },
      { key: 'vocab_spanish_medias', title: 'Medias', description: 'Socks / stockings (Latin America)' },
    ],
  },
  {
    filename: 'cloth_falda.png', destFilename: 'vocab_cloth_falda.png',
    prompt: `A women's skirt — a colourful knee-length skirt shown laid flat or slightly gathered. Bright pattern or solid colour. ${PROP_STYLE}`,
    title: 'La Falda', description: 'Skirt — women\'s colourful knee-length skirt',
    tags: ['vocabulary', 'novice_mid', 'clothing', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_falda', title: 'Falda', description: 'Skirt' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIVITIES
  // ════════════════════════════════════════════════════════════════════════════
  {
    filename: 'act_comprar.png', destFilename: 'vocab_act_comprar.png',
    prompt: `A person shopping in a store, holding items or putting something in a basket, browsing colourful shelves. ${SCENE_STYLE}`,
    title: 'Comprar', description: 'To buy / to shop — person shopping in a store',
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_comprar', title: 'Comprar', description: 'To buy / to shop' },
    ],
  },
  {
    filename: 'act_pagar.png', destFilename: 'vocab_act_pagar.png',
    prompt: `A person paying at a cash register or counter — handing money to a cashier or tapping a card reader. ${SCENE_STYLE}`,
    title: 'Pagar', description: 'To pay — person paying at a cash register',
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_pagar', title: 'Pagar', description: 'To pay' },
    ],
  },
  {
    filename: 'act_cocinar.png', destFilename: 'vocab_act_cocinar.png',
    prompt: `A person cooking in a kitchen — stirring a pot on the stove or chopping vegetables with a knife, apron on, smiling. ${SCENE_STYLE}`,
    title: 'Cocinar', description: 'To cook — person cooking in a kitchen',
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_cocinar', title: 'Cocinar', description: 'To cook' },
    ],
  },
  {
    filename: 'act_limpiar.png', destFilename: 'vocab_act_limpiar.png',
    prompt: `A person cleaning — mopping the floor or wiping a surface with a cloth, bucket of water nearby. ${SCENE_STYLE}`,
    title: 'Limpiar', description: 'To clean — person mopping or wiping surfaces',
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_limpiar', title: 'Limpiar', description: 'To clean' },
    ],
  },
  {
    filename: 'act_nadar.png', destFilename: 'vocab_act_nadar.png',
    prompt: `A person swimming in a pool or the sea — freestyle stroke with arms extended, water splashing around them. ${SCENE_STYLE}`,
    title: 'Nadar', description: 'To swim — person swimming with freestyle stroke',
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_nadar', title: 'Nadar', description: 'To swim' },
    ],
  },
  {
    filename: 'act_bailar.png', destFilename: 'vocab_act_bailar.png',
    prompt: `A person or couple dancing joyfully — colourful outfit, arms raised, mid-dance move with visible energy and joy. ${SCENE_STYLE}`,
    title: 'Bailar', description: 'To dance — person or couple dancing joyfully',
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_bailar', title: 'Bailar', description: 'To dance' },
    ],
  },
  {
    filename: 'act_cantar.png', destFilename: 'vocab_act_cantar.png',
    prompt: `A person singing — mouth open, one hand on chest or holding a microphone, eyes closed with expression. Joyful performance. ${SCENE_STYLE}`,
    title: 'Cantar', description: 'To sing — person singing with expression',
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_cantar', title: 'Cantar', description: 'To sing' },
    ],
  },
  {
    filename: 'act_pintar.png', destFilename: 'vocab_act_pintar.png',
    prompt: `A person painting on a canvas — standing before an easel, brush in hand, colourful paints on a palette nearby, apron on. ${SCENE_STYLE}`,
    title: 'Pintar', description: 'To paint — person painting at an easel',
    tags: ['vocabulary', 'novice_mid', 'activities', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_pintar', title: 'Pintar', description: 'To paint' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ADJECTIVES — CONTRAST PAIRS
  // ════════════════════════════════════════════════════════════════════════════
  {
    filename: 'adj_cerca_lejos.png', destFilename: 'vocab_adj_cerca_lejos.png',
    prompt: `Two scenes side by side: LEFT — a person standing very close to a building or tree, almost touching it. RIGHT — the same person standing far away from the same building or tree, tiny in the distance. ${PAIR_STYLE}`,
    title: 'Cerca / Lejos', description: 'Near / far — distance contrast pair',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_cerca', title: 'Cerca', description: 'Near / close' },
      { key: 'vocab_spanish_lejos', title: 'Lejos', description: 'Far / distant' },
    ],
  },
  {
    filename: 'adj_alto_bajo.png', destFilename: 'vocab_adj_alto_bajo.png',
    prompt: `Two people standing side by side: one very tall person on the left and one very short person on the right. The height difference is obvious and exaggerated for clarity. ${PAIR_STYLE}`,
    title: 'Alto / Bajo', description: 'Tall / short — height contrast pair',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_alto', title: 'Alto', description: 'Tall / high' },
      { key: 'vocab_spanish_bajo', title: 'Bajo', description: 'Short / low' },
    ],
  },
  {
    filename: 'adj_rapido_lento.png', destFilename: 'vocab_adj_rapido_lento.png',
    prompt: `Two animals or people side by side: LEFT — a cheetah or runner in full sprint with speed lines/blur. RIGHT — a turtle or snail moving slowly, barely moving. ${PAIR_STYLE}`,
    title: 'Rápido / Lento', description: 'Fast / slow — speed contrast pair',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_rapido', title: 'Rápido', description: 'Fast / quick' },
      { key: 'vocab_spanish_lento', title: 'Lento', description: 'Slow' },
    ],
  },
  {
    filename: 'adj_pesado_ligero.png', destFilename: 'vocab_adj_pesado_ligero.png',
    prompt: `Two scenes side by side: LEFT — a person straining to lift a huge heavy boulder, visibly struggling. RIGHT — the same person easily lifting a feather with one finger, effortlessly. ${PAIR_STYLE}`,
    title: 'Pesado / Ligero', description: 'Heavy / light — weight contrast pair',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_pesado', title: 'Pesado', description: 'Heavy' },
      { key: 'vocab_spanish_ligero', title: 'Ligero', description: 'Light (weight)' },
    ],
  },
  {
    filename: 'adj_joven_viejo_personas.png', destFilename: 'vocab_adj_joven_viejo_personas.png',
    prompt: `Two people side by side: LEFT — a young person (teenager or young adult) with energy and youth. RIGHT — an elderly person with white/grey hair and wrinkles, kind expression. ${PAIR_STYLE}`,
    title: 'Joven / Viejo (personas)', description: 'Young / old — age contrast for people',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_joven', title: 'Joven', description: 'Young (person)' },
      { key: 'vocab_spanish_viejo_persona', title: 'Viejo (persona)', description: 'Old (person)' },
    ],
  },
  {
    filename: 'adj_feliz_triste.png', destFilename: 'vocab_adj_feliz_triste.png',
    prompt: `Two faces or people side by side: LEFT — a person with a huge bright smile, laughing, eyes lit up with joy. RIGHT — a person with a sad frown, drooping eyes, looking downcast. ${PAIR_STYLE}`,
    title: 'Feliz / Triste', description: 'Happy / sad — emotion contrast pair',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_feliz', title: 'Feliz', description: 'Happy' },
      { key: 'vocab_spanish_triste', title: 'Triste', description: 'Sad' },
      { key: 'vocab_spanish_alegre', title: 'Alegre', description: 'Happy / cheerful' },
    ],
  },
  {
    filename: 'adj_facil_dificil.png', destFilename: 'vocab_adj_facil_dificil.png',
    prompt: `Two scenes side by side: LEFT — a person easily solving a simple puzzle or doing a simple task, smiling casually. RIGHT — a person sweating and struggling with a very complex puzzle or a giant pile of work, looking stressed. ${PAIR_STYLE}`,
    title: 'Fácil / Difícil', description: 'Easy / difficult — task contrast pair',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_facil', title: 'Fácil', description: 'Easy' },
      { key: 'vocab_spanish_dificil', title: 'Difícil', description: 'Difficult / hard' },
    ],
  },
  {
    filename: 'adj_ruidoso_tranquilo.png', destFilename: 'vocab_adj_ruidoso_tranquilo.png',
    prompt: `Two scenes side by side: LEFT — a loud chaotic scene with people shouting, music blaring, visible sound waves. RIGHT — a calm peaceful scene, a person reading quietly in a serene garden, total stillness. ${PAIR_STYLE}`,
    title: 'Ruidoso / Tranquilo', description: 'Loud / quiet — sound contrast pair',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_ruidoso', title: 'Ruidoso', description: 'Loud / noisy' },
      { key: 'vocab_spanish_tranquilo', title: 'Tranquilo', description: 'Quiet / calm' },
    ],
  },
  {
    filename: 'adj_oscuro_claro.png', destFilename: 'vocab_adj_oscuro_claro.png',
    prompt: `Two versions of the same room side by side: LEFT — the room is very dark, curtains drawn, only shadows visible. RIGHT — the same room is brightly lit by sunlight streaming through open windows, everything clear. ${PAIR_STYLE}`,
    title: 'Oscuro / Claro', description: 'Dark / bright — light contrast pair',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_oscuro', title: 'Oscuro', description: 'Dark' },
      { key: 'vocab_spanish_claro', title: 'Claro', description: 'Bright / light / clear' },
    ],
  },
  {
    filename: 'adj_duro_suave.png', destFilename: 'vocab_adj_duro_suave.png',
    prompt: `Two objects side by side: LEFT — a hard jagged rock or brick, angular and solid. RIGHT — a soft fluffy pillow or cloud, round and cushiony. Texture contrast is obvious. ${PAIR_STYLE}`,
    title: 'Duro / Suave', description: 'Hard / soft — texture contrast pair',
    tags: ['vocabulary', 'novice_mid', 'adjectives', 'section2'],
    cacheKeys: [
      { key: 'vocab_spanish_duro', title: 'Duro', description: 'Hard / tough' },
      { key: 'vocab_spanish_suave', title: 'Suave', description: 'Soft / gentle' },
      { key: 'vocab_spanish_blando', title: 'Blando', description: 'Soft / squishy' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  // Build a safe SQL array literal from the tags (all values are our own controlled strings)
  const tagsLiteral = sql.raw(`ARRAY[${entry.tags.map(t => `'${t}'`).join(',')}]::text[]`);

  for (const { key, title, description } of entry.cacheKeys) {
    const existing = await db.execute(sql`
      SELECT id FROM media_files WHERE search_query = ${key} LIMIT 1
    `);
    if (existing.rows.length > 0) {
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
          ${tagsLiteral},
          'spanish', 'ai_generated', ${key}, ${title},
          false, 0
        )
      `);
      console.log(`    ✓ Seeded: ${key}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const total   = IMAGES.length;
  let done      = 0;
  let skipped   = 0;
  let failed    = 0;

  // Count already done
  for (const e of IMAGES) {
    if (fs.existsSync(path.join(OUT_DIR, e.filename))) skipped++;
  }
  console.log(`\nNovice Mid — full batch: ${total} images (${skipped} already generated, ${total - skipped} to go)\n`);

  for (const entry of IMAGES) {
    const localPath = path.join(OUT_DIR, entry.filename);
    const idx = IMAGES.indexOf(entry) + 1;
    console.log(`[${idx}/${total}] ${entry.title}`);

    try {
      let buf: Buffer;
      if (fs.existsSync(localPath)) {
        console.log(`  ↩ Reusing local file`);
        buf = fs.readFileSync(localPath);
      } else {
        console.log(`  Generating...`);
        buf = await generateImage(entry);
        fs.writeFileSync(localPath, buf);
        console.log(`  ✓ Saved locally`);
        done++;
      }

      const url = await uploadFile(buf, entry.destFilename);
      console.log(`  ✓ Uploaded: ${url}`);
      await seedEntry(url, entry);
    } catch (err: any) {
      console.error(`  ✗ FAILED: ${err.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  const generated = done;
  const reused    = skipped;
  console.log(`\n✅ Done — ${generated} new, ${reused} reused, ${failed} failed (out of ${total} total)`);
}

main().catch(err => { console.error(err); process.exit(1); });

/**
 * Seed dining/tableware vocabulary into visual_assets.
 * These items appear as props in restaurant, café, and grocery store scenes.
 *
 * Run: tsx scripts/seed-dining-vocabulary.ts
 */
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL });

const DINING_VOCABULARY: Array<{
  name: string;
  displayName: string;
  objectType: string;
  tags: string[];
  english: string[];
  spanish: string[];
  french: string[];
  german: string[];
  italian: string[];
  portuguese: string[];
  japanese: string[];
  korean: string[];
  mandarin: string[];
  arabic?: string[];
}> = [
  {
    name: 'plate', displayName: 'Plate', objectType: 'tableware',
    tags: ['restaurant', 'dining', 'tableware'],
    english: ['plate', 'dish'],
    spanish: ['plato'],
    french: ['assiette'],
    german: ['Teller'],
    italian: ['piatto'],
    portuguese: ['prato'],
    japanese: ['お皿', 'プレート'],
    korean: ['접시'],
    mandarin: ['盘子', '碟子'],
    arabic: ['طبق'],
  },
  {
    name: 'fork', displayName: 'Fork', objectType: 'tableware',
    tags: ['restaurant', 'dining', 'cutlery'],
    english: ['fork'],
    spanish: ['tenedor'],
    french: ['fourchette'],
    german: ['Gabel'],
    italian: ['forchetta'],
    portuguese: ['garfo'],
    japanese: ['フォーク'],
    korean: ['포크'],
    mandarin: ['叉子'],
    arabic: ['شوكة'],
  },
  {
    name: 'knife', displayName: 'Knife', objectType: 'tableware',
    tags: ['restaurant', 'dining', 'cutlery'],
    english: ['knife'],
    spanish: ['cuchillo'],
    french: ['couteau'],
    german: ['Messer'],
    italian: ['coltello'],
    portuguese: ['faca'],
    japanese: ['ナイフ'],
    korean: ['나이프', '칼'],
    mandarin: ['刀'],
    arabic: ['سكين'],
  },
  {
    name: 'spoon', displayName: 'Spoon', objectType: 'tableware',
    tags: ['restaurant', 'dining', 'cutlery'],
    english: ['spoon'],
    spanish: ['cuchara'],
    french: ['cuillère'],
    german: ['Löffel'],
    italian: ['cucchiaio'],
    portuguese: ['colher'],
    japanese: ['スプーン'],
    korean: ['숟가락'],
    mandarin: ['勺子', '汤匙'],
    arabic: ['ملعقة'],
  },
  {
    name: 'glass', displayName: 'Glass', objectType: 'tableware',
    tags: ['restaurant', 'dining', 'drinkware'],
    english: ['glass', 'drinking glass'],
    spanish: ['vaso', 'copa'],
    french: ['verre'],
    german: ['Glas'],
    italian: ['bicchiere'],
    portuguese: ['copo'],
    japanese: ['グラス', 'コップ'],
    korean: ['유리컵', '잔'],
    mandarin: ['玻璃杯', '杯子'],
    arabic: ['كوب', 'زجاجة'],
  },
  {
    name: 'cup', displayName: 'Cup', objectType: 'tableware',
    tags: ['restaurant', 'café', 'dining', 'drinkware'],
    english: ['cup', 'mug'],
    spanish: ['taza'],
    french: ['tasse'],
    german: ['Tasse'],
    italian: ['tazza'],
    portuguese: ['xícara', 'chávena'],
    japanese: ['カップ', 'マグカップ'],
    korean: ['컵', '머그컵'],
    mandarin: ['杯子', '茶杯'],
    arabic: ['كوب', 'فنجان'],
  },
  {
    name: 'napkin', displayName: 'Napkin', objectType: 'tableware',
    tags: ['restaurant', 'dining', 'linens'],
    english: ['napkin', 'serviette'],
    spanish: ['servilleta'],
    french: ['serviette'],
    german: ['Serviette'],
    italian: ['tovagliolo'],
    portuguese: ['guardanapo'],
    japanese: ['ナプキン'],
    korean: ['냅킨'],
    mandarin: ['餐巾'],
    arabic: ['منديل', 'فوطة'],
  },
  {
    name: 'bread_basket', displayName: 'Bread Basket', objectType: 'food_prop',
    tags: ['restaurant', 'dining', 'bread', 'appetizer'],
    english: ['bread basket', 'bread'],
    spanish: ['cesta de pan', 'pan'],
    french: ['corbeille à pain', 'pain'],
    german: ['Brotkorb', 'Brot'],
    italian: ['cestino del pane', 'pane'],
    portuguese: ['cesta de pão', 'pão'],
    japanese: ['パンかご', 'パン'],
    korean: ['빵 바구니', '빵'],
    mandarin: ['面包篮', '面包'],
    arabic: ['سلة الخبز', 'خبز'],
  },
  {
    name: 'menu_card', displayName: 'Menu', objectType: 'document_prop',
    tags: ['restaurant', 'dining', 'menu'],
    english: ['menu', 'menu card'],
    spanish: ['menú', 'carta'],
    french: ['menu', 'carte'],
    german: ['Speisekarte', 'Menü'],
    italian: ['menù', 'carta'],
    portuguese: ['cardápio', 'ementa'],
    japanese: ['メニュー'],
    korean: ['메뉴', '메뉴판'],
    mandarin: ['菜单'],
    arabic: ['قائمة الطعام', 'منيو'],
  },
  {
    name: 'salt_pepper', displayName: 'Salt & Pepper', objectType: 'condiment',
    tags: ['restaurant', 'dining', 'condiment'],
    english: ['salt', 'pepper', 'salt and pepper shakers'],
    spanish: ['sal', 'pimienta'],
    french: ['sel', 'poivre'],
    german: ['Salz', 'Pfeffer'],
    italian: ['sale', 'pepe'],
    portuguese: ['sal', 'pimenta'],
    japanese: ['塩', 'コショウ'],
    korean: ['소금', '후추'],
    mandarin: ['盐', '胡椒'],
    arabic: ['ملح', 'فلفل'],
  },
  {
    name: 'water_pitcher', displayName: 'Water Pitcher', objectType: 'drinkware',
    tags: ['restaurant', 'dining', 'water'],
    english: ['water pitcher', 'water jug', 'carafe'],
    spanish: ['jarra de agua'],
    french: ['carafe d\'eau', 'pichet'],
    german: ['Wasserkrug', 'Karaffe'],
    italian: ['caraffa d\'acqua'],
    portuguese: ['jarro de água'],
    japanese: ['水差し', 'ピッチャー'],
    korean: ['물 주전자', '피처'],
    mandarin: ['水壶', '水杯'],
    arabic: ['إبريق الماء'],
  },
  {
    name: 'candle', displayName: 'Candle', objectType: 'decoration',
    tags: ['restaurant', 'dining', 'ambience'],
    english: ['candle', 'taper candle'],
    spanish: ['vela'],
    french: ['bougie'],
    german: ['Kerze'],
    italian: ['candela'],
    portuguese: ['vela'],
    japanese: ['キャンドル', 'ろうそく'],
    korean: ['초', '캔들'],
    mandarin: ['蜡烛'],
    arabic: ['شمعة'],
  },
  // Café items
  {
    name: 'espresso_machine', displayName: 'Espresso Machine', objectType: 'appliance',
    tags: ['café', 'coffee', 'equipment'],
    english: ['espresso machine', 'coffee machine'],
    spanish: ['máquina de café espresso', 'cafetera'],
    french: ['machine à expresso', 'machine à café'],
    german: ['Espressomaschine', 'Kaffeemaschine'],
    italian: ['macchina per espresso'],
    portuguese: ['máquina de café'],
    japanese: ['エスプレッソマシン'],
    korean: ['에스프레소 머신'],
    mandarin: ['咖啡机', '意式咖啡机'],
    arabic: ['ماكينة القهوة'],
  },
  {
    name: 'coffee', displayName: 'Coffee', objectType: 'beverage',
    tags: ['café', 'restaurant', 'beverage', 'menu_item'],
    english: ['coffee', 'espresso', 'cappuccino', 'latte'],
    spanish: ['café', 'café con leche', 'cappuccino'],
    french: ['café', 'café au lait', 'cappuccino'],
    german: ['Kaffee', 'Cappuccino', 'Latte Macchiato'],
    italian: ['caffè', 'espresso', 'cappuccino', 'latte'],
    portuguese: ['café', 'café com leite'],
    japanese: ['コーヒー', 'エスプレッソ', 'カプチーノ'],
    korean: ['커피', '에스프레소', '카푸치노'],
    mandarin: ['咖啡', '浓缩咖啡', '卡布奇诺'],
    arabic: ['قهوة', 'كابتشينو'],
  },
  // Grocery items
  {
    name: 'shopping_cart', displayName: 'Shopping Cart', objectType: 'equipment',
    tags: ['grocery_store', 'shopping'],
    english: ['shopping cart', 'trolley'],
    spanish: ['carrito de la compra', 'carro'],
    french: ['chariot', 'caddie'],
    german: ['Einkaufswagen'],
    italian: ['carrello della spesa'],
    portuguese: ['carrinho de compras'],
    japanese: ['ショッピングカート'],
    korean: ['쇼핑 카트'],
    mandarin: ['购物车'],
    arabic: ['عربة التسوق'],
  },
  {
    name: 'produce_display', displayName: 'Fresh Produce', objectType: 'display',
    tags: ['grocery_store', 'produce', 'vegetables', 'fruit'],
    english: ['fresh produce', 'vegetables', 'fruit'],
    spanish: ['productos frescos', 'verduras', 'frutas'],
    french: ['produits frais', 'légumes', 'fruits'],
    german: ['frisches Gemüse', 'Obst und Gemüse'],
    italian: ['prodotti freschi', 'verdure', 'frutta'],
    portuguese: ['produtos frescos', 'legumes', 'frutas'],
    japanese: ['青果', '野菜', '果物'],
    korean: ['신선한 농산물', '채소', '과일'],
    mandarin: ['新鲜蔬果', '蔬菜', '水果'],
    arabic: ['منتجات طازجة', 'خضروات', 'فواكه'],
  },
];

async function seed() {
  console.log(`Seeding ${DINING_VOCABULARY.length} dining/tableware vocabulary items...`);
  let inserted = 0, updated = 0, skipped = 0;

  for (const item of DINING_VOCABULARY) {
    try {
      const result = await pool.query(
        `INSERT INTO visual_assets (
          id, name, display_name, object_type, image_url,
          english_terms, spanish_terms, french_terms, german_terms, italian_terms,
          portuguese_terms, japanese_terms, korean_terms, mandarin_terms,
          tags
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, '',
          $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13
        )
        ON CONFLICT (name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          object_type = EXCLUDED.object_type,
          english_terms = EXCLUDED.english_terms,
          spanish_terms = EXCLUDED.spanish_terms,
          french_terms = EXCLUDED.french_terms,
          german_terms = EXCLUDED.german_terms,
          italian_terms = EXCLUDED.italian_terms,
          portuguese_terms = EXCLUDED.portuguese_terms,
          japanese_terms = EXCLUDED.japanese_terms,
          korean_terms = EXCLUDED.korean_terms,
          mandarin_terms = EXCLUDED.mandarin_terms,
          tags = EXCLUDED.tags
        RETURNING (xmax = 0) AS inserted`,
        [
          item.name,
          item.displayName,
          item.objectType,
          item.english,
          item.spanish,
          item.french,
          item.german,
          item.italian,
          item.portuguese,
          item.japanese,
          item.korean,
          item.mandarin,
          item.tags,
        ]
      );
      const wasInserted = result.rows[0]?.inserted;
      if (wasInserted) inserted++; else updated++;
      console.log(`  ${wasInserted ? '✓ NEW' : '↺ UPD'} ${item.name} (${item.displayName})`);
    } catch (err: any) {
      console.error(`  ✗ FAIL ${item.name}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${updated} updated, ${skipped} failed`);
  await pool.end();
}

seed().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

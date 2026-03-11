/**
 * Prop Library Seeder
 * Generates transparent-background PNG prop images via DALL-E 3,
 * uploads them to object storage, and inserts into visual_assets.
 * 
 * Usage: npx tsx scripts/seed-prop-library.ts [group]
 * Groups: hotel | airport | doctor | restaurant | grocery | home | all
 */
import sharp from 'sharp';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { uploadPublicBuffer } from '../server/services/image-storage';

const OPENAI_KEY = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

interface PropDef {
  name: string;
  display_name: string;
  object_type: string;
  prompt: string;
  tags: string[];
  english_terms: string[];
  spanish_terms: string[];
  french_terms: string[];
  german_terms: string[];
  italian_terms: string[];
  portuguese_terms: string[];
  japanese_terms: string[];
  korean_terms: string[];
  mandarin_terms: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Prop Definitions
// ─────────────────────────────────────────────────────────────────────────────

const PROPS: PropDef[] = [

  // ── HOTEL / CHECK-IN ─────────────────────────────────────────────────────
  {
    name: 'hotel_key_card',
    display_name: 'Hotel Key Card',
    object_type: 'access',
    prompt: 'A hotel room key card, plastic credit-card-size, with a simple hotel logo and magnetic stripe, slightly tilted, isolated on a pure white background, clean product photo',
    tags: ['hotel', 'key', 'room', 'access', 'checkin'],
    english_terms: ['key card', 'hotel key', 'room key', 'keycard'],
    spanish_terms: ['tarjeta de habitación', 'llave del hotel', 'tarjeta llave'],
    french_terms: ['carte de chambre', 'clé de chambre'],
    german_terms: ['Schlüsselkarte', 'Zimmerkarte'],
    italian_terms: ['chiave magnetica', 'tessera hotel'],
    portuguese_terms: ['cartão chave', 'chave do quarto'],
    japanese_terms: ['ルームキー', 'キーカード'],
    korean_terms: ['룸 키', '카드 키'],
    mandarin_terms: ['房卡', '钥匙卡'],
  },
  {
    name: 'passport',
    display_name: 'Passport',
    object_type: 'document',
    prompt: 'A navy blue passport booklet, slightly open showing the cover and embossed seal, isolated on a pure white background, clean product photo style',
    tags: ['passport', 'travel', 'document', 'id', 'airport', 'hotel'],
    english_terms: ['passport', 'travel document'],
    spanish_terms: ['pasaporte', 'documento de viaje'],
    french_terms: ['passeport'],
    german_terms: ['Reisepass', 'Pass'],
    italian_terms: ['passaporto'],
    portuguese_terms: ['passaporte'],
    japanese_terms: ['パスポート', '旅券'],
    korean_terms: ['여권'],
    mandarin_terms: ['护照'],
  },
  {
    name: 'suitcase',
    display_name: 'Rolling Suitcase',
    object_type: 'luggage',
    prompt: 'A medium-size upright rolling suitcase with retractable handle extended, hard shell, dark navy blue color, isolated on a pure white background, clean product photo',
    tags: ['suitcase', 'luggage', 'bag', 'travel', 'airport', 'hotel'],
    english_terms: ['suitcase', 'luggage', 'bag', 'trolley'],
    spanish_terms: ['maleta', 'equipaje', 'valija'],
    french_terms: ['valise', 'bagage'],
    german_terms: ['Koffer', 'Reisekoffer'],
    italian_terms: ['valigia', 'bagaglio'],
    portuguese_terms: ['mala', 'bagagem'],
    japanese_terms: ['スーツケース', '旅行バッグ'],
    korean_terms: ['여행 가방', '캐리어'],
    mandarin_terms: ['行李箱', '旅行箱'],
  },
  {
    name: 'hotel_brochure',
    display_name: 'Hotel Brochure',
    object_type: 'document',
    prompt: 'A folded hotel brochure or pamphlet, glossy paper, with a generic hotel image on the cover, isolated on a pure white background, clean product photo',
    tags: ['brochure', 'hotel', 'pamphlet', 'information'],
    english_terms: ['brochure', 'pamphlet', 'hotel guide'],
    spanish_terms: ['folleto', 'brochure del hotel'],
    french_terms: ['brochure', 'dépliant'],
    german_terms: ['Broschüre', 'Prospekt'],
    italian_terms: ['brochure', 'opuscolo'],
    portuguese_terms: ['folheto', 'brochura'],
    japanese_terms: ['パンフレット', 'ホテルガイド'],
    korean_terms: ['브로셔', '안내 책자'],
    mandarin_terms: ['宣传册', '小册子'],
  },

  // ── AIRPORT ──────────────────────────────────────────────────────────────
  {
    name: 'boarding_pass',
    display_name: 'Boarding Pass',
    object_type: 'document',
    prompt: 'An airline boarding pass paper ticket, rectangular, printed with flight details and a barcode, slightly crumpled realistic look, isolated on a pure white background, clean product photo',
    tags: ['boarding pass', 'ticket', 'flight', 'airplane', 'airport'],
    english_terms: ['boarding pass', 'ticket', 'flight ticket'],
    spanish_terms: ['tarjeta de embarque', 'boleto de avión', 'pase de abordar'],
    french_terms: ['carte d\'embarquement', 'billet d\'avion'],
    german_terms: ['Bordkarte', 'Flugticket'],
    italian_terms: ['carta d\'imbarco', 'biglietto aereo'],
    portuguese_terms: ['cartão de embarque', 'passagem aérea'],
    japanese_terms: ['搭乗券', '航空券'],
    korean_terms: ['탑승권', '항공권'],
    mandarin_terms: ['登机牌', '机票'],
  },
  {
    name: 'luggage_tag',
    display_name: 'Luggage Tag',
    object_type: 'document',
    prompt: 'A colorful luggage tag, rectangular with a strap loop, showing generic travel information, isolated on a pure white background, clean product photo',
    tags: ['luggage tag', 'label', 'bag tag', 'airport', 'travel'],
    english_terms: ['luggage tag', 'bag tag', 'label'],
    spanish_terms: ['etiqueta de equipaje', 'marbete'],
    french_terms: ['étiquette de bagage'],
    german_terms: ['Gepäckanhänger', 'Kofferanhänger'],
    italian_terms: ['etichetta bagaglio', 'targhetta'],
    portuguese_terms: ['etiqueta de bagagem'],
    japanese_terms: ['手荷物タグ', '荷物タグ'],
    korean_terms: ['수하물 태그', '짐 꼬리표'],
    mandarin_terms: ['行李标签', '行李牌'],
  },
  {
    name: 'backpack',
    display_name: 'Travel Backpack',
    object_type: 'luggage',
    prompt: 'A travel backpack, medium size, grey and black nylon material with multiple pockets and padded straps, isolated on a pure white background, clean product photo',
    tags: ['backpack', 'bag', 'travel', 'airport', 'carry-on'],
    english_terms: ['backpack', 'rucksack', 'day bag'],
    spanish_terms: ['mochila', 'morral'],
    french_terms: ['sac à dos', 'sac de voyage'],
    german_terms: ['Rucksack', 'Tasche'],
    italian_terms: ['zaino', 'borsa'],
    portuguese_terms: ['mochila'],
    japanese_terms: ['バックパック', 'リュック'],
    korean_terms: ['배낭', '백팩'],
    mandarin_terms: ['背包', '双肩包'],
  },

  // ── DOCTOR'S OFFICE ──────────────────────────────────────────────────────
  {
    name: 'stethoscope',
    display_name: 'Stethoscope',
    object_type: 'medical',
    prompt: 'A doctor\'s stethoscope, black tubing with a silver chest piece, coiled neatly, isolated on a pure white background, clean product photo',
    tags: ['stethoscope', 'doctor', 'medical', 'health', 'examination'],
    english_terms: ['stethoscope'],
    spanish_terms: ['estetoscopio', 'fonendoscopio'],
    french_terms: ['stéthoscope'],
    german_terms: ['Stethoskop'],
    italian_terms: ['stetoscopio', 'fonendoscopio'],
    portuguese_terms: ['estetoscópio'],
    japanese_terms: ['聴診器'],
    korean_terms: ['청진기'],
    mandarin_terms: ['听诊器'],
  },
  {
    name: 'thermometer',
    display_name: 'Thermometer',
    object_type: 'medical',
    prompt: 'A digital medical thermometer, white plastic with a small LCD screen showing a temperature reading, isolated on a pure white background, clean product photo',
    tags: ['thermometer', 'temperature', 'fever', 'medical', 'doctor'],
    english_terms: ['thermometer', 'temperature gauge'],
    spanish_terms: ['termómetro'],
    french_terms: ['thermomètre'],
    german_terms: ['Thermometer', 'Fieberthermometer'],
    italian_terms: ['termometro'],
    portuguese_terms: ['termômetro'],
    japanese_terms: ['体温計', '温度計'],
    korean_terms: ['체온계', '온도계'],
    mandarin_terms: ['体温计', '温度计'],
  },
  {
    name: 'prescription_pad',
    display_name: 'Prescription Notepad',
    object_type: 'document',
    prompt: 'A doctor\'s prescription notepad, white paper with an Rx symbol at the top, spiral bound, on a pure white background, isolated clean product photo',
    tags: ['prescription', 'recipe', 'doctor', 'medical', 'medication'],
    english_terms: ['prescription', 'recipe', 'doctor\'s note'],
    spanish_terms: ['receta médica', 'receta', 'prescripción'],
    french_terms: ['ordonnance', 'prescription'],
    german_terms: ['Rezept', 'Verschreibung'],
    italian_terms: ['ricetta medica', 'prescrizione'],
    portuguese_terms: ['receita médica', 'prescrição'],
    japanese_terms: ['処方箋', '処方'],
    korean_terms: ['처방전', '처방'],
    mandarin_terms: ['处方', '药方'],
  },
  {
    name: 'medicine_bottle',
    display_name: 'Medicine Bottle',
    object_type: 'medical',
    prompt: 'An orange plastic medicine pill bottle with a white cap and blank label, isolated on a pure white background, clean product photo',
    tags: ['medicine', 'pills', 'medication', 'pharmacy', 'doctor'],
    english_terms: ['medicine', 'pills', 'medication', 'tablets'],
    spanish_terms: ['medicamento', 'pastillas', 'medicina', 'píldoras'],
    french_terms: ['médicament', 'pilules', 'comprimés'],
    german_terms: ['Medikament', 'Tabletten', 'Pille'],
    italian_terms: ['medicinale', 'pillole', 'medicine'],
    portuguese_terms: ['remédio', 'medicamento', 'comprimidos'],
    japanese_terms: ['薬', '錠剤', '薬瓶'],
    korean_terms: ['약', '약병', '알약'],
    mandarin_terms: ['药', '药瓶', '药片'],
  },
  {
    name: 'blood_pressure_cuff',
    display_name: 'Blood Pressure Cuff',
    object_type: 'medical',
    prompt: 'A blood pressure cuff (sphygmomanometer), a white and grey arm cuff with tubing and a small gauge, isolated on a pure white background, clean product photo',
    tags: ['blood pressure', 'cuff', 'medical', 'doctor', 'examination'],
    english_terms: ['blood pressure cuff', 'sphygmomanometer'],
    spanish_terms: ['tensiómetro', 'esfigmomanómetro', 'medidor de presión'],
    french_terms: ['tensiomètre', 'brassard'],
    german_terms: ['Blutdruckmanschette', 'Blutdruckmessgerät'],
    italian_terms: ['sfigmomanometro', 'misuratore pressione'],
    portuguese_terms: ['esfigmomanômetro', 'medidor de pressão'],
    japanese_terms: ['血圧計', '血圧マニカフ'],
    korean_terms: ['혈압계', '혈압 측정기'],
    mandarin_terms: ['血压计', '血压袖带'],
  },

  // ── RESTAURANT (tableware / accessories) ─────────────────────────────────
  {
    name: 'restaurant_menu',
    display_name: 'Restaurant Menu',
    object_type: 'document_prop',
    prompt: 'A restaurant menu booklet, dark leather cover with a decorative gold border, slightly open, isolated on a pure white background, clean product photo',
    tags: ['menu', 'restaurant', 'carte', 'food', 'dining'],
    english_terms: ['menu', 'bill of fare'],
    spanish_terms: ['menú', 'carta'],
    french_terms: ['menu', 'carte'],
    german_terms: ['Speisekarte', 'Menü'],
    italian_terms: ['menù', 'carta'],
    portuguese_terms: ['cardápio', 'menu'],
    japanese_terms: ['メニュー', '献立'],
    korean_terms: ['메뉴', '메뉴판'],
    mandarin_terms: ['菜单', '餐单'],
  },
  {
    name: 'wine_glass',
    display_name: 'Wine Glass',
    object_type: 'drinkware',
    prompt: 'A clear glass wine goblet with a long stem, empty, isolated on a pure white background, clean product photo',
    tags: ['wine glass', 'glass', 'goblet', 'restaurant', 'drink'],
    english_terms: ['wine glass', 'goblet', 'glass'],
    spanish_terms: ['copa de vino', 'copa'],
    french_terms: ['verre à vin', 'verre'],
    german_terms: ['Weinglas', 'Glas'],
    italian_terms: ['bicchiere di vino', 'calice'],
    portuguese_terms: ['taça de vinho', 'copo de vinho'],
    japanese_terms: ['ワイングラス', 'グラス'],
    korean_terms: ['와인 잔', '잔'],
    mandarin_terms: ['酒杯', '葡萄酒杯'],
  },
  {
    name: 'dinner_plate',
    display_name: 'Dinner Plate',
    object_type: 'tableware',
    prompt: 'A white ceramic dinner plate, round, slightly elevated view, empty, isolated on a pure white background, clean product photo',
    tags: ['plate', 'dish', 'tableware', 'restaurant', 'dining'],
    english_terms: ['plate', 'dish'],
    spanish_terms: ['plato'],
    french_terms: ['assiette', 'plat'],
    german_terms: ['Teller', 'Speißeteller'],
    italian_terms: ['piatto'],
    portuguese_terms: ['prato'],
    japanese_terms: ['皿', 'プレート'],
    korean_terms: ['접시', '그릇'],
    mandarin_terms: ['盘子', '碟子'],
  },
  {
    name: 'fork',
    display_name: 'Fork',
    object_type: 'tableware',
    prompt: 'A silver stainless steel dinner fork, isolated on a pure white background, clean product photo, diagonal orientation',
    tags: ['fork', 'cutlery', 'silverware', 'tableware', 'dining'],
    english_terms: ['fork'],
    spanish_terms: ['tenedor'],
    french_terms: ['fourchette'],
    german_terms: ['Gabel'],
    italian_terms: ['forchetta'],
    portuguese_terms: ['garfo'],
    japanese_terms: ['フォーク'],
    korean_terms: ['포크'],
    mandarin_terms: ['叉子'],
  },
  {
    name: 'knife',
    display_name: 'Knife',
    object_type: 'tableware',
    prompt: 'A silver stainless steel dinner knife with a blunt rounded tip, isolated on a pure white background, clean product photo, diagonal orientation',
    tags: ['knife', 'cutlery', 'silverware', 'tableware', 'dining'],
    english_terms: ['knife'],
    spanish_terms: ['cuchillo'],
    french_terms: ['couteau'],
    german_terms: ['Messer'],
    italian_terms: ['coltello'],
    portuguese_terms: ['faca'],
    japanese_terms: ['ナイフ'],
    korean_terms: ['나이프', '칼'],
    mandarin_terms: ['刀', '餐刀'],
  },
  {
    name: 'spoon',
    display_name: 'Spoon',
    object_type: 'tableware',
    prompt: 'A silver stainless steel soup spoon, isolated on a pure white background, clean product photo, diagonal orientation',
    tags: ['spoon', 'cutlery', 'silverware', 'tableware', 'dining'],
    english_terms: ['spoon', 'tablespoon'],
    spanish_terms: ['cuchara'],
    french_terms: ['cuillère'],
    german_terms: ['Löffel'],
    italian_terms: ['cucchiaio'],
    portuguese_terms: ['colher'],
    japanese_terms: ['スプーン'],
    korean_terms: ['숟가락', '스푼'],
    mandarin_terms: ['勺子', '汤匙'],
  },
  {
    name: 'napkin',
    display_name: 'Cloth Napkin',
    object_type: 'tableware',
    prompt: 'A white cloth dinner napkin, neatly folded into a simple rectangle, isolated on a pure white background, clean product photo',
    tags: ['napkin', 'serviette', 'cloth', 'tableware', 'dining'],
    english_terms: ['napkin', 'serviette'],
    spanish_terms: ['servilleta'],
    french_terms: ['serviette'],
    german_terms: ['Serviette'],
    italian_terms: ['tovagliolo'],
    portuguese_terms: ['guardanapo'],
    japanese_terms: ['ナプキン'],
    korean_terms: ['냅킨', '냅킨'],
    mandarin_terms: ['餐巾', '口布'],
  },
  {
    name: 'bread_basket',
    display_name: 'Bread Basket',
    object_type: 'food_prop',
    prompt: 'A small wicker bread basket lined with white cloth containing two bread rolls, isolated on a pure white background, clean product photo',
    tags: ['bread', 'basket', 'rolls', 'restaurant', 'food', 'dining'],
    english_terms: ['bread basket', 'bread rolls', 'basket of bread'],
    spanish_terms: ['panera', 'cesta de pan', 'pan'],
    french_terms: ['corbeille à pain', 'pain'],
    german_terms: ['Brotkorb', 'Brot'],
    italian_terms: ['cestino del pane', 'pane'],
    portuguese_terms: ['cesta de pão', 'pão'],
    japanese_terms: ['パンかご', 'パン'],
    korean_terms: ['빵 바구니', '빵'],
    mandarin_terms: ['面包篮', '面包'],
  },
  {
    name: 'restaurant_bill',
    display_name: 'Restaurant Bill',
    object_type: 'document_prop',
    prompt: 'A restaurant check or bill, a small paper receipt inside a black leather bill holder or folder, isolated on a pure white background, clean product photo',
    tags: ['bill', 'check', 'receipt', 'restaurant', 'payment'],
    english_terms: ['bill', 'check', 'receipt'],
    spanish_terms: ['cuenta', 'factura', 'recibo'],
    french_terms: ['addition', 'note', 'facture'],
    german_terms: ['Rechnung', 'Quittung'],
    italian_terms: ['conto', 'ricevuta'],
    portuguese_terms: ['conta', 'nota', 'recibo'],
    japanese_terms: ['お会計', '請求書', '領収書'],
    korean_terms: ['계산서', '영수증'],
    mandarin_terms: ['账单', '收据'],
  },

  // ── GROCERY STORE ─────────────────────────────────────────────────────────
  {
    name: 'shopping_basket',
    display_name: 'Shopping Basket',
    object_type: 'equipment',
    prompt: 'A red plastic hand-carry shopping basket with a metal handle, empty, isolated on a pure white background, clean product photo',
    tags: ['basket', 'shopping', 'grocery', 'cart'],
    english_terms: ['shopping basket', 'basket'],
    spanish_terms: ['canasta de compras', 'cesta', 'canasta'],
    french_terms: ['panier', 'panier de courses'],
    german_terms: ['Einkaufskorb', 'Korb'],
    italian_terms: ['cestino', 'cesto della spesa'],
    portuguese_terms: ['cesta de compras', 'cesta'],
    japanese_terms: ['買い物カゴ', 'カゴ'],
    korean_terms: ['장바구니', '쇼핑 바구니'],
    mandarin_terms: ['购物篮', '篮子'],
  },
  {
    name: 'apple',
    display_name: 'Apple',
    object_type: 'food',
    prompt: 'A bright red apple, shiny and fresh, isolated on a pure white background, clean product photo',
    tags: ['apple', 'fruit', 'produce', 'grocery', 'food'],
    english_terms: ['apple', 'red apple'],
    spanish_terms: ['manzana'],
    french_terms: ['pomme'],
    german_terms: ['Apfel'],
    italian_terms: ['mela'],
    portuguese_terms: ['maçã'],
    japanese_terms: ['りんご', 'リンゴ'],
    korean_terms: ['사과'],
    mandarin_terms: ['苹果'],
  },
  {
    name: 'banana',
    display_name: 'Banana',
    object_type: 'food',
    prompt: 'A bunch of three ripe yellow bananas, isolated on a pure white background, clean product photo',
    tags: ['banana', 'fruit', 'produce', 'grocery', 'food'],
    english_terms: ['banana', 'bananas'],
    spanish_terms: ['plátano', 'banana'],
    french_terms: ['banane'],
    german_terms: ['Banane'],
    italian_terms: ['banana'],
    portuguese_terms: ['banana'],
    japanese_terms: ['バナナ'],
    korean_terms: ['바나나'],
    mandarin_terms: ['香蕉'],
  },
  {
    name: 'grocery_bag',
    display_name: 'Grocery Bag',
    object_type: 'equipment',
    prompt: 'A brown paper grocery bag with handles, slightly full with the top folded over, isolated on a pure white background, clean product photo',
    tags: ['grocery bag', 'shopping bag', 'paper bag', 'grocery'],
    english_terms: ['grocery bag', 'shopping bag', 'paper bag'],
    spanish_terms: ['bolsa de compras', 'bolsa', 'bolsa de papel'],
    french_terms: ['sac de courses', 'sac en papier'],
    german_terms: ['Einkaufstasche', 'Tüte'],
    italian_terms: ['borsa della spesa', 'sacchetto'],
    portuguese_terms: ['sacola de compras', 'sacola'],
    japanese_terms: ['エコバッグ', '買い物袋'],
    korean_terms: ['장바구니', '쇼핑백'],
    mandarin_terms: ['购物袋', '纸袋'],
  },

  // ── LEGACY STUBS (fill missing images) ───────────────────────────────────
  {
    name: 'plate',
    display_name: 'Plate',
    object_type: 'tableware',
    prompt: 'A white ceramic round dinner plate, clean empty, isolated on pure white background, product photo top-down view',
    tags: ['plate', 'dish', 'tableware', 'dining'],
    english_terms: ['plate', 'dish'],
    spanish_terms: ['plato'],
    french_terms: ['assiette'],
    german_terms: ['Teller'],
    italian_terms: ['piatto'],
    portuguese_terms: ['prato'],
    japanese_terms: ['皿'],
    korean_terms: ['접시'],
    mandarin_terms: ['盘子'],
  },
  {
    name: 'glass',
    display_name: 'Glass',
    object_type: 'tableware',
    prompt: 'A clear drinking glass, tall tumbler style, empty, isolated on pure white background, product photo',
    tags: ['glass', 'cup', 'drinkware', 'dining', 'water'],
    english_terms: ['glass', 'drinking glass', 'tumbler'],
    spanish_terms: ['vaso'],
    french_terms: ['verre'],
    german_terms: ['Glas'],
    italian_terms: ['bicchiere'],
    portuguese_terms: ['copo'],
    japanese_terms: ['コップ', 'グラス'],
    korean_terms: ['유리컵', '잔'],
    mandarin_terms: ['玻璃杯', '杯子'],
  },
  {
    name: 'cup',
    display_name: 'Cup',
    object_type: 'tableware',
    prompt: 'A white ceramic coffee cup with a handle, empty, isolated on pure white background, product photo',
    tags: ['cup', 'mug', 'coffee cup', 'tableware', 'cafe'],
    english_terms: ['cup', 'mug', 'teacup'],
    spanish_terms: ['taza'],
    french_terms: ['tasse'],
    german_terms: ['Tasse'],
    italian_terms: ['tazza'],
    portuguese_terms: ['xícara', 'chávena'],
    japanese_terms: ['カップ', 'コップ'],
    korean_terms: ['컵', '머그'],
    mandarin_terms: ['杯子', '茶杯'],
  },
  {
    name: 'menu_card',
    display_name: 'Menu Card',
    object_type: 'document_prop',
    prompt: 'A single-page laminated menu card standing upright on a table, with decorative border, isolated on pure white background, product photo',
    tags: ['menu', 'carte', 'restaurant', 'food', 'dining'],
    english_terms: ['menu card', 'menu'],
    spanish_terms: ['carta', 'menú'],
    french_terms: ['carte du jour', 'menu'],
    german_terms: ['Speisekarte'],
    italian_terms: ['menù', 'carta'],
    portuguese_terms: ['cardápio'],
    japanese_terms: ['メニュー'],
    korean_terms: ['메뉴'],
    mandarin_terms: ['菜单'],
  },
  {
    name: 'salt_pepper',
    display_name: 'Salt & Pepper Shakers',
    object_type: 'condiment',
    prompt: 'A matching pair of salt and pepper shakers, white ceramic with small holes on top, isolated on pure white background, product photo',
    tags: ['salt', 'pepper', 'condiment', 'shakers', 'restaurant', 'dining'],
    english_terms: ['salt', 'pepper', 'salt and pepper', 'shakers'],
    spanish_terms: ['sal', 'pimienta', 'sal y pimienta'],
    french_terms: ['sel', 'poivre', 'sel et poivre'],
    german_terms: ['Salz', 'Pfeffer', 'Salzstreuer'],
    italian_terms: ['sale', 'pepe'],
    portuguese_terms: ['sal', 'pimenta'],
    japanese_terms: ['塩', 'こしょう', '塩胡椒'],
    korean_terms: ['소금', '후추'],
    mandarin_terms: ['盐', '胡椒', '盐和胡椒'],
  },
  {
    name: 'water_pitcher',
    display_name: 'Water Pitcher',
    object_type: 'drinkware',
    prompt: 'A clear glass water pitcher with a handle, filled with water, isolated on pure white background, product photo',
    tags: ['pitcher', 'water jug', 'jug', 'water', 'restaurant'],
    english_terms: ['pitcher', 'water jug', 'jug', 'carafe'],
    spanish_terms: ['jarra de agua', 'jarra'],
    french_terms: ['pichet', 'carafe d\'eau'],
    german_terms: ['Wasserkrug', 'Krug'],
    italian_terms: ['caraffa', 'brocca'],
    portuguese_terms: ['jarra', 'jarro de água'],
    japanese_terms: ['水差し', 'ピッチャー'],
    korean_terms: ['물병', '주전자'],
    mandarin_terms: ['水壶', '水罐'],
  },
  {
    name: 'candle',
    display_name: 'Candle',
    object_type: 'decoration',
    prompt: 'A small white pillar candle lit with a small flame, isolated on pure white background, product photo',
    tags: ['candle', 'light', 'decoration', 'restaurant', 'dining'],
    english_terms: ['candle'],
    spanish_terms: ['vela'],
    french_terms: ['bougie'],
    german_terms: ['Kerze'],
    italian_terms: ['candela'],
    portuguese_terms: ['vela'],
    japanese_terms: ['キャンドル', 'ろうそく'],
    korean_terms: ['촛불', '양초'],
    mandarin_terms: ['蜡烛'],
  },
  {
    name: 'espresso_machine',
    display_name: 'Espresso Machine',
    object_type: 'appliance',
    prompt: 'A compact espresso coffee machine, silver and black, isolated on pure white background, product photo side view',
    tags: ['espresso machine', 'coffee maker', 'machine', 'cafe'],
    english_terms: ['espresso machine', 'coffee machine', 'coffee maker'],
    spanish_terms: ['cafetera', 'máquina de café', 'máquina de espresso'],
    french_terms: ['machine à café', 'cafetière'],
    german_terms: ['Kaffeemaschine', 'Espressomaschine'],
    italian_terms: ['macchina del caffè', 'macchina espresso'],
    portuguese_terms: ['cafeteira', 'máquina de café'],
    japanese_terms: ['エスプレッソマシン', 'コーヒーメーカー'],
    korean_terms: ['에스프레소 머신', '커피 머신'],
    mandarin_terms: ['浓缩咖啡机', '咖啡机'],
  },
  {
    name: 'coffee',
    display_name: 'Coffee',
    object_type: 'beverage',
    prompt: 'A white ceramic coffee cup filled with hot black coffee, steam rising gently, isolated on pure white background, product photo',
    tags: ['coffee', 'beverage', 'drink', 'cafe', 'breakfast'],
    english_terms: ['coffee', 'black coffee'],
    spanish_terms: ['café'],
    french_terms: ['café'],
    german_terms: ['Kaffee'],
    italian_terms: ['caffè'],
    portuguese_terms: ['café'],
    japanese_terms: ['コーヒー'],
    korean_terms: ['커피'],
    mandarin_terms: ['咖啡'],
  },
  {
    name: 'shopping_cart',
    display_name: 'Shopping Cart',
    object_type: 'equipment',
    prompt: 'A metal wire shopping cart, empty, silver grey, isolated on pure white background, product photo slightly angled view',
    tags: ['shopping cart', 'cart', 'trolley', 'grocery', 'supermarket'],
    english_terms: ['shopping cart', 'cart', 'trolley'],
    spanish_terms: ['carrito de compras', 'carro', 'carrito'],
    french_terms: ['chariot', 'caddie'],
    german_terms: ['Einkaufswagen', 'Wagen'],
    italian_terms: ['carrello della spesa', 'carrello'],
    portuguese_terms: ['carrinho de compras', 'carrinho'],
    japanese_terms: ['ショッピングカート', 'カート'],
    korean_terms: ['쇼핑 카트', '카트'],
    mandarin_terms: ['购物车', '手推车'],
  },
  {
    name: 'produce_display',
    display_name: 'Fresh Produce',
    object_type: 'display',
    prompt: 'A small pile of mixed fresh vegetables and fruits including tomatoes, carrots, and lettuce, isolated on pure white background, product photo flat lay',
    tags: ['produce', 'vegetables', 'fruits', 'grocery', 'fresh', 'market'],
    english_terms: ['produce', 'vegetables', 'fresh vegetables', 'fruits'],
    spanish_terms: ['verduras', 'frutas', 'productos frescos', 'frutas y verduras'],
    french_terms: ['légumes', 'fruits', 'produits frais'],
    german_terms: ['Gemüse', 'Obst', 'frische Produkte'],
    italian_terms: ['verdure', 'frutta', 'prodotti freschi'],
    portuguese_terms: ['legumes', 'frutas', 'produtos frescos'],
    japanese_terms: ['野菜', '果物', '青果'],
    korean_terms: ['채소', '과일', '신선 식품'],
    mandarin_terms: ['蔬菜', '水果', '新鲜食品'],
  },

  // ── HOME / CLASSROOM / MISC ───────────────────────────────────────────────
  {
    name: 'book',
    display_name: 'Book',
    object_type: 'household',
    prompt: 'A hardcover novel, slightly thick, plain blue cover, isolated on a pure white background, clean product photo',
    tags: ['book', 'novel', 'reading', 'bedroom', 'classroom'],
    english_terms: ['book', 'novel'],
    spanish_terms: ['libro'],
    french_terms: ['livre'],
    german_terms: ['Buch'],
    italian_terms: ['libro'],
    portuguese_terms: ['livro'],
    japanese_terms: ['本', '書籍'],
    korean_terms: ['책'],
    mandarin_terms: ['书', '书本'],
  },
  {
    name: 'cell_phone',
    display_name: 'Cell Phone',
    object_type: 'household',
    prompt: 'A modern smartphone, black screen, lying flat, isolated on a pure white background, clean product photo',
    tags: ['phone', 'smartphone', 'mobile', 'cell phone', 'bedroom', 'office'],
    english_terms: ['phone', 'cell phone', 'smartphone', 'mobile'],
    spanish_terms: ['teléfono', 'celular', 'móvil'],
    french_terms: ['téléphone', 'portable', 'smartphone'],
    german_terms: ['Handy', 'Smartphone', 'Telefon'],
    italian_terms: ['telefono', 'cellulare', 'smartphone'],
    portuguese_terms: ['telefone', 'celular', 'smartphone'],
    japanese_terms: ['スマホ', '携帯', '電話'],
    korean_terms: ['핸드폰', '스마트폰'],
    mandarin_terms: ['手机', '手机'],
  },
  {
    name: 'umbrella',
    display_name: 'Umbrella',
    object_type: 'household',
    prompt: 'A black folding umbrella, closed and standing upright, isolated on a pure white background, clean product photo',
    tags: ['umbrella', 'rain', 'outdoor', 'city', 'park'],
    english_terms: ['umbrella', 'parasol'],
    spanish_terms: ['paraguas', 'sombrilla'],
    french_terms: ['parapluie'],
    german_terms: ['Regenschirm', 'Schirm'],
    italian_terms: ['ombrello'],
    portuguese_terms: ['guarda-chuva'],
    japanese_terms: ['傘', 'かさ'],
    korean_terms: ['우산'],
    mandarin_terms: ['伞', '雨伞'],
  },
  {
    name: 'wallet',
    display_name: 'Wallet',
    object_type: 'household',
    prompt: 'A brown leather bifold wallet, slightly open showing empty card slots, isolated on a pure white background, clean product photo',
    tags: ['wallet', 'purse', 'money', 'payment', 'hotel', 'restaurant'],
    english_terms: ['wallet', 'purse', 'billfold'],
    spanish_terms: ['billetera', 'cartera', 'monedero'],
    french_terms: ['portefeuille', 'porte-monnaie'],
    german_terms: ['Geldbeutel', 'Brieftasche'],
    italian_terms: ['portafoglio'],
    portuguese_terms: ['carteira'],
    japanese_terms: ['財布', 'さいふ'],
    korean_terms: ['지갑'],
    mandarin_terms: ['钱包'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DALL-E generation
// ─────────────────────────────────────────────────────────────────────────────

async function generateImage(prompt: string): Promise<string> {
  const body = JSON.stringify({
    model: 'dall-e-3',
    prompt: prompt + ', isolated on pure white background, clean product photography, no shadows',
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  });

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DALL-E error: ${err}`);
  }
  const data = await res.json() as any;
  return data.data[0].url as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// White background removal via Sharp
// ─────────────────────────────────────────────────────────────────────────────

async function removeWhiteBackground(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data);
  const threshold = 240;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    // Remove near-white pixels
    if (r > threshold && g > threshold && b > threshold) {
      pixels[i + 3] = 0;
    }
  }

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Check if prop already exists in DB
// ─────────────────────────────────────────────────────────────────────────────

async function propExists(name: string): Promise<boolean> {
  const rows = await db.execute(sql`SELECT id FROM visual_assets WHERE name = ${name} AND image_url IS NOT NULL AND image_url != '' LIMIT 1`);
  return (rows.rows as any[]).length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upsert into visual_assets
// ─────────────────────────────────────────────────────────────────────────────

function pgArray(arr: string[]): string {
  return '{' + arr.map(s => '"' + s.replace(/"/g, '\\"') + '"').join(',') + '}';
}

async function upsertProp(prop: PropDef, imageUrl: string): Promise<void> {
  const q = `
    INSERT INTO visual_assets (
      id, name, display_name, object_type, image_url, width, height,
      english_terms, spanish_terms, french_terms, german_terms, italian_terms,
      portuguese_terms, japanese_terms, korean_terms, mandarin_terms, tags
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, 1024, 1024,
      $5::text[], $6::text[], $7::text[], $8::text[], $9::text[],
      $10::text[], $11::text[], $12::text[], $13::text[], $14::text[]
    )
    ON CONFLICT (name) DO UPDATE SET
      image_url = EXCLUDED.image_url,
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
  `;
  await db.execute(sql.raw(
    q
      .replace('$1', `'${prop.name.replace(/'/g,"''")}' `)
      .replace('$2', `'${prop.display_name.replace(/'/g,"''")}' `)
      .replace('$3', `'${prop.object_type.replace(/'/g,"''")}' `)
      .replace('$4', `'${imageUrl.replace(/'/g,"''")}' `)
      .replace('$5::text[]', `ARRAY[${prop.english_terms.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
      .replace('$6::text[]', `ARRAY[${prop.spanish_terms.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
      .replace('$7::text[]', `ARRAY[${prop.french_terms.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
      .replace('$8::text[]', `ARRAY[${prop.german_terms.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
      .replace('$9::text[]', `ARRAY[${prop.italian_terms.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
      .replace('$10::text[]', `ARRAY[${prop.portuguese_terms.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
      .replace('$11::text[]', `ARRAY[${prop.japanese_terms.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
      .replace('$12::text[]', `ARRAY[${prop.korean_terms.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
      .replace('$13::text[]', `ARRAY[${prop.mandarin_terms.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
      .replace('$14::text[]', `ARRAY[${prop.tags.map(s=>`'${s.replace(/'/g,"''")}'`).join(',')}]::text[]`)
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// Process a single prop
// ─────────────────────────────────────────────────────────────────────────────

async function processProp(prop: PropDef): Promise<void> {
  const exists = await propExists(prop.name);
  if (exists) {
    console.log(`  [SKIP] ${prop.display_name} — already in library`);
    return;
  }

  console.log(`  [GEN]  ${prop.display_name} — generating...`);
  const dalleUrl = await generateImage(prop.prompt);

  console.log(`  [DL]   ${prop.display_name} — downloading...`);
  const rawRes = await fetch(dalleUrl);
  if (!rawRes.ok) throw new Error('Download failed: ' + rawRes.status);
  const rawBuf = Buffer.from(await rawRes.arrayBuffer());

  console.log(`  [PROC] ${prop.display_name} — removing background...`);
  const pngBuf = await removeWhiteBackground(rawBuf);

  console.log(`  [UP]   ${prop.display_name} — uploading...`);
  const filename = `prop-${prop.name}-${Date.now()}.png`;
  const appUrl = await uploadPublicBuffer(filename, pngBuf, 'image/png');

  console.log(`  [DB]   ${prop.display_name} — saving...`);
  await upsertProp(prop, appUrl);

  console.log(`  [OK]   ${prop.display_name} → ${appUrl}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const GROUP_FILTER: Record<string, string[]> = {
  hotel:      ['hotel_key_card', 'passport', 'suitcase', 'hotel_brochure'],
  airport:    ['boarding_pass', 'luggage_tag', 'backpack', 'passport'],
  doctor:     ['stethoscope', 'thermometer', 'prescription_pad', 'medicine_bottle', 'blood_pressure_cuff'],
  restaurant: ['restaurant_menu', 'wine_glass', 'dinner_plate', 'fork', 'knife', 'spoon', 'napkin', 'bread_basket', 'restaurant_bill'],
  grocery:    ['shopping_basket', 'apple', 'banana', 'grocery_bag'],
  home:       ['book', 'cell_phone', 'umbrella', 'wallet'],
  legacy:     ['plate', 'glass', 'cup', 'menu_card', 'salt_pepper', 'water_pitcher', 'candle', 'espresso_machine', 'coffee', 'shopping_cart', 'produce_display'],
};

async function main() {
  const group = process.argv[2] || 'all';
  const allowed = group === 'all' ? null : GROUP_FILTER[group];
  const toGenerate = allowed ? PROPS.filter(p => allowed.includes(p.name)) : PROPS;

  console.log(`\n🎨 Prop Library Seeder — group: ${group} (${toGenerate.length} props)\n`);

  let succeeded = 0;
  let failed = 0;

  for (const prop of toGenerate) {
    try {
      await processProp(prop);
      succeeded++;
    } catch (err: any) {
      console.error(`  [ERR]  ${prop.display_name}: ${err.message}`);
      failed++;
    }
    // Brief pause to respect rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Done: ${succeeded} generated, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

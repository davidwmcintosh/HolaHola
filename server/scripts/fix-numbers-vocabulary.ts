/**
 * fix-numbers-vocabulary.ts
 *
 * Patches the textbook_lesson_content vocabulary_list for every language's
 * "Numbers 0-20" drill lesson.  Each language currently only has 11-14 items;
 * this replaces them with the full 21 numbers (0-20) plus a handful of
 * practical context words (years-old, phone number, count).
 *
 * Run with:
 *   npx tsx server/scripts/fix-numbers-vocabulary.ts
 */

import { Client } from "pg";

const client = new Client({ connectionString: process.env.NEON_SHARED_DATABASE_URL });

interface VocabEntry {
  word: string;
  translation: string;
  partOfSpeech: string;
  exampleSentences?: { target: string; translation: string }[];
}

// Full 0-20 vocabulary lists keyed by language
const NUMBER_VOCAB: Record<string, VocabEntry[]> = {
  english: [
    { word: "zero", translation: "0", partOfSpeech: "number" },
    { word: "one", translation: "1", partOfSpeech: "number" },
    { word: "two", translation: "2", partOfSpeech: "number" },
    { word: "three", translation: "3", partOfSpeech: "number" },
    { word: "four", translation: "4", partOfSpeech: "number" },
    { word: "five", translation: "5", partOfSpeech: "number" },
    { word: "six", translation: "6", partOfSpeech: "number" },
    { word: "seven", translation: "7", partOfSpeech: "number" },
    { word: "eight", translation: "8", partOfSpeech: "number" },
    { word: "nine", translation: "9", partOfSpeech: "number" },
    { word: "ten", translation: "10", partOfSpeech: "number" },
    { word: "eleven", translation: "11", partOfSpeech: "number" },
    { word: "twelve", translation: "12", partOfSpeech: "number" },
    { word: "thirteen", translation: "13", partOfSpeech: "number" },
    { word: "fourteen", translation: "14", partOfSpeech: "number" },
    { word: "fifteen", translation: "15", partOfSpeech: "number" },
    { word: "sixteen", translation: "16", partOfSpeech: "number" },
    { word: "seventeen", translation: "17", partOfSpeech: "number" },
    { word: "eighteen", translation: "18", partOfSpeech: "number" },
    { word: "nineteen", translation: "19", partOfSpeech: "number" },
    { word: "twenty", translation: "20", partOfSpeech: "number" },
    { word: "number", translation: "a mathematical quantity", partOfSpeech: "noun" },
    { word: "how old", translation: "asking about age", partOfSpeech: "phrase", exampleSentences: [{ target: "How old are you?", translation: "What is your age?" }] },
    { word: "phone number", translation: "a sequence of digits to call someone", partOfSpeech: "noun phrase" },
  ],

  french: [
    { word: "zéro", translation: "0", partOfSpeech: "number" },
    { word: "un / une", translation: "1", partOfSpeech: "number" },
    { word: "deux", translation: "2", partOfSpeech: "number" },
    { word: "trois", translation: "3", partOfSpeech: "number" },
    { word: "quatre", translation: "4", partOfSpeech: "number" },
    { word: "cinq", translation: "5", partOfSpeech: "number" },
    { word: "six", translation: "6", partOfSpeech: "number" },
    { word: "sept", translation: "7", partOfSpeech: "number" },
    { word: "huit", translation: "8", partOfSpeech: "number" },
    { word: "neuf", translation: "9", partOfSpeech: "number" },
    { word: "dix", translation: "10", partOfSpeech: "number" },
    { word: "onze", translation: "11", partOfSpeech: "number" },
    { word: "douze", translation: "12", partOfSpeech: "number" },
    { word: "treize", translation: "13", partOfSpeech: "number" },
    { word: "quatorze", translation: "14", partOfSpeech: "number" },
    { word: "quinze", translation: "15", partOfSpeech: "number" },
    { word: "seize", translation: "16", partOfSpeech: "number" },
    { word: "dix-sept", translation: "17", partOfSpeech: "number" },
    { word: "dix-huit", translation: "18", partOfSpeech: "number" },
    { word: "dix-neuf", translation: "19", partOfSpeech: "number" },
    { word: "vingt", translation: "20", partOfSpeech: "number" },
    { word: "quel âge as-tu?", translation: "How old are you?", partOfSpeech: "phrase" },
    { word: "le numéro de téléphone", translation: "phone number", partOfSpeech: "noun" },
    { word: "les ans / les années", translation: "years (of age / years in time)", partOfSpeech: "noun" },
  ],

  german: [
    { word: "null", translation: "0", partOfSpeech: "number" },
    { word: "eins", translation: "1", partOfSpeech: "number" },
    { word: "zwei", translation: "2", partOfSpeech: "number" },
    { word: "drei", translation: "3", partOfSpeech: "number" },
    { word: "vier", translation: "4", partOfSpeech: "number" },
    { word: "fünf", translation: "5", partOfSpeech: "number" },
    { word: "sechs", translation: "6", partOfSpeech: "number" },
    { word: "sieben", translation: "7", partOfSpeech: "number" },
    { word: "acht", translation: "8", partOfSpeech: "number" },
    { word: "neun", translation: "9", partOfSpeech: "number" },
    { word: "zehn", translation: "10", partOfSpeech: "number" },
    { word: "elf", translation: "11", partOfSpeech: "number" },
    { word: "zwölf", translation: "12", partOfSpeech: "number" },
    { word: "dreizehn", translation: "13", partOfSpeech: "number" },
    { word: "vierzehn", translation: "14", partOfSpeech: "number" },
    { word: "fünfzehn", translation: "15", partOfSpeech: "number" },
    { word: "sechzehn", translation: "16", partOfSpeech: "number" },
    { word: "siebzehn", translation: "17", partOfSpeech: "number" },
    { word: "achtzehn", translation: "18", partOfSpeech: "number" },
    { word: "neunzehn", translation: "19", partOfSpeech: "number" },
    { word: "zwanzig", translation: "20", partOfSpeech: "number" },
    { word: "Wie alt bist du?", translation: "How old are you?", partOfSpeech: "phrase" },
    { word: "die Telefonnummer", translation: "phone number", partOfSpeech: "noun" },
    { word: "Jahre alt", translation: "years old", partOfSpeech: "phrase" },
  ],

  italian: [
    { word: "zero", translation: "0", partOfSpeech: "number" },
    { word: "uno", translation: "1", partOfSpeech: "number" },
    { word: "due", translation: "2", partOfSpeech: "number" },
    { word: "tre", translation: "3", partOfSpeech: "number" },
    { word: "quattro", translation: "4", partOfSpeech: "number" },
    { word: "cinque", translation: "5", partOfSpeech: "number" },
    { word: "sei", translation: "6", partOfSpeech: "number" },
    { word: "sette", translation: "7", partOfSpeech: "number" },
    { word: "otto", translation: "8", partOfSpeech: "number" },
    { word: "nove", translation: "9", partOfSpeech: "number" },
    { word: "dieci", translation: "10", partOfSpeech: "number" },
    { word: "undici", translation: "11", partOfSpeech: "number" },
    { word: "dodici", translation: "12", partOfSpeech: "number" },
    { word: "tredici", translation: "13", partOfSpeech: "number" },
    { word: "quattordici", translation: "14", partOfSpeech: "number" },
    { word: "quindici", translation: "15", partOfSpeech: "number" },
    { word: "sedici", translation: "16", partOfSpeech: "number" },
    { word: "diciassette", translation: "17", partOfSpeech: "number" },
    { word: "diciotto", translation: "18", partOfSpeech: "number" },
    { word: "diciannove", translation: "19", partOfSpeech: "number" },
    { word: "venti", translation: "20", partOfSpeech: "number" },
    { word: "Quanti anni hai?", translation: "How old are you?", partOfSpeech: "phrase" },
    { word: "il numero di telefono", translation: "phone number", partOfSpeech: "noun" },
    { word: "anni", translation: "years (of age)", partOfSpeech: "noun" },
  ],

  japanese: [
    { word: "ゼロ / 零 (rei)", translation: "0", partOfSpeech: "number" },
    { word: "一 (ichi)", translation: "1", partOfSpeech: "number" },
    { word: "二 (ni)", translation: "2", partOfSpeech: "number" },
    { word: "三 (san)", translation: "3", partOfSpeech: "number" },
    { word: "四 (yon / shi)", translation: "4", partOfSpeech: "number" },
    { word: "五 (go)", translation: "5", partOfSpeech: "number" },
    { word: "六 (roku)", translation: "6", partOfSpeech: "number" },
    { word: "七 (nana / shichi)", translation: "7", partOfSpeech: "number" },
    { word: "八 (hachi)", translation: "8", partOfSpeech: "number" },
    { word: "九 (kyuu / ku)", translation: "9", partOfSpeech: "number" },
    { word: "十 (juu)", translation: "10", partOfSpeech: "number" },
    { word: "十一 (juuichi)", translation: "11", partOfSpeech: "number" },
    { word: "十二 (juuni)", translation: "12", partOfSpeech: "number" },
    { word: "十三 (juusan)", translation: "13", partOfSpeech: "number" },
    { word: "十四 (juushi)", translation: "14", partOfSpeech: "number" },
    { word: "十五 (juugo)", translation: "15", partOfSpeech: "number" },
    { word: "十六 (juuroku)", translation: "16", partOfSpeech: "number" },
    { word: "十七 (juushichi)", translation: "17", partOfSpeech: "number" },
    { word: "十八 (juuhachi)", translation: "18", partOfSpeech: "number" },
    { word: "十九 (juuku)", translation: "19", partOfSpeech: "number" },
    { word: "二十 (nijuu)", translation: "20", partOfSpeech: "number" },
    { word: "何歳ですか？ (nansai desu ka?)", translation: "How old are you?", partOfSpeech: "phrase" },
    { word: "電話番号 (denwa bangou)", translation: "phone number", partOfSpeech: "noun" },
    { word: "〜歳 (~sai)", translation: "~ years old", partOfSpeech: "suffix" },
  ],

  korean: [
    { word: "영 (yeong)", translation: "0", partOfSpeech: "number" },
    { word: "일 (il)", translation: "1 (Sino-Korean)", partOfSpeech: "number" },
    { word: "이 (i)", translation: "2 (Sino-Korean)", partOfSpeech: "number" },
    { word: "삼 (sam)", translation: "3 (Sino-Korean)", partOfSpeech: "number" },
    { word: "사 (sa)", translation: "4 (Sino-Korean)", partOfSpeech: "number" },
    { word: "오 (o)", translation: "5 (Sino-Korean)", partOfSpeech: "number" },
    { word: "육 (yuk)", translation: "6 (Sino-Korean)", partOfSpeech: "number" },
    { word: "칠 (chil)", translation: "7 (Sino-Korean)", partOfSpeech: "number" },
    { word: "팔 (pal)", translation: "8 (Sino-Korean)", partOfSpeech: "number" },
    { word: "구 (gu)", translation: "9 (Sino-Korean)", partOfSpeech: "number" },
    { word: "십 (sip)", translation: "10 (Sino-Korean)", partOfSpeech: "number" },
    { word: "십일 (sibil)", translation: "11", partOfSpeech: "number" },
    { word: "십이 (sibi)", translation: "12", partOfSpeech: "number" },
    { word: "십삼 (sipsam)", translation: "13", partOfSpeech: "number" },
    { word: "십사 (sipsa)", translation: "14", partOfSpeech: "number" },
    { word: "십오 (sibo)", translation: "15", partOfSpeech: "number" },
    { word: "십육 (simnyuk)", translation: "16", partOfSpeech: "number" },
    { word: "십칠 (sipchil)", translation: "17", partOfSpeech: "number" },
    { word: "십팔 (sippal)", translation: "18", partOfSpeech: "number" },
    { word: "십구 (sipgu)", translation: "19", partOfSpeech: "number" },
    { word: "이십 (isip)", translation: "20", partOfSpeech: "number" },
    { word: "몇 살이에요? (myeot sal i-eyo?)", translation: "How old are you?", partOfSpeech: "phrase" },
    { word: "전화번호 (jeonhwa beonho)", translation: "phone number", partOfSpeech: "noun" },
    { word: "살 (sal)", translation: "years old (native Korean counter)", partOfSpeech: "counter" },
  ],

  mandarin: [
    { word: "零 (líng)", translation: "0", partOfSpeech: "number" },
    { word: "一 (yī)", translation: "1", partOfSpeech: "number" },
    { word: "二 (èr)", translation: "2", partOfSpeech: "number" },
    { word: "三 (sān)", translation: "3", partOfSpeech: "number" },
    { word: "四 (sì)", translation: "4", partOfSpeech: "number" },
    { word: "五 (wǔ)", translation: "5", partOfSpeech: "number" },
    { word: "六 (liù)", translation: "6", partOfSpeech: "number" },
    { word: "七 (qī)", translation: "7", partOfSpeech: "number" },
    { word: "八 (bā)", translation: "8", partOfSpeech: "number" },
    { word: "九 (jiǔ)", translation: "9", partOfSpeech: "number" },
    { word: "十 (shí)", translation: "10", partOfSpeech: "number" },
    { word: "十一 (shíyī)", translation: "11", partOfSpeech: "number" },
    { word: "十二 (shí'èr)", translation: "12", partOfSpeech: "number" },
    { word: "十三 (shísān)", translation: "13", partOfSpeech: "number" },
    { word: "十四 (shísì)", translation: "14", partOfSpeech: "number" },
    { word: "十五 (shíwǔ)", translation: "15", partOfSpeech: "number" },
    { word: "十六 (shíliù)", translation: "16", partOfSpeech: "number" },
    { word: "十七 (shíqī)", translation: "17", partOfSpeech: "number" },
    { word: "十八 (shíbā)", translation: "18", partOfSpeech: "number" },
    { word: "十九 (shíjiǔ)", translation: "19", partOfSpeech: "number" },
    { word: "二十 (èrshí)", translation: "20", partOfSpeech: "number" },
    { word: "你几岁？(Nǐ jǐ suì?)", translation: "How old are you? (to a child)", partOfSpeech: "phrase" },
    { word: "电话号码 (diànhuà hàomǎ)", translation: "phone number", partOfSpeech: "noun" },
    { word: "岁 (suì)", translation: "years old (age counter)", partOfSpeech: "measure word" },
  ],

  portuguese: [
    { word: "zero", translation: "0", partOfSpeech: "number" },
    { word: "um / uma", translation: "1 (masc./fem.)", partOfSpeech: "number" },
    { word: "dois / duas", translation: "2 (masc./fem.)", partOfSpeech: "number" },
    { word: "três", translation: "3", partOfSpeech: "number" },
    { word: "quatro", translation: "4", partOfSpeech: "number" },
    { word: "cinco", translation: "5", partOfSpeech: "number" },
    { word: "seis", translation: "6", partOfSpeech: "number" },
    { word: "sete", translation: "7", partOfSpeech: "number" },
    { word: "oito", translation: "8", partOfSpeech: "number" },
    { word: "nove", translation: "9", partOfSpeech: "number" },
    { word: "dez", translation: "10", partOfSpeech: "number" },
    { word: "onze", translation: "11", partOfSpeech: "number" },
    { word: "doze", translation: "12", partOfSpeech: "number" },
    { word: "treze", translation: "13", partOfSpeech: "number" },
    { word: "quatorze / catorze", translation: "14", partOfSpeech: "number" },
    { word: "quinze", translation: "15", partOfSpeech: "number" },
    { word: "dezesseis", translation: "16", partOfSpeech: "number" },
    { word: "dezessete", translation: "17", partOfSpeech: "number" },
    { word: "dezoito", translation: "18", partOfSpeech: "number" },
    { word: "dezenove", translation: "19", partOfSpeech: "number" },
    { word: "vinte", translation: "20", partOfSpeech: "number" },
    { word: "Quantos anos você tem?", translation: "How old are you?", partOfSpeech: "phrase" },
    { word: "o número de telefone", translation: "phone number", partOfSpeech: "noun" },
    { word: "anos", translation: "years (of age)", partOfSpeech: "noun" },
  ],

  spanish: [
    { word: "cero", translation: "0", partOfSpeech: "number" },
    { word: "uno / una", translation: "1 (masc./fem.)", partOfSpeech: "number" },
    { word: "dos", translation: "2", partOfSpeech: "number" },
    { word: "tres", translation: "3", partOfSpeech: "number" },
    { word: "cuatro", translation: "4", partOfSpeech: "number" },
    { word: "cinco", translation: "5", partOfSpeech: "number" },
    { word: "seis", translation: "6", partOfSpeech: "number" },
    { word: "siete", translation: "7", partOfSpeech: "number" },
    { word: "ocho", translation: "8", partOfSpeech: "number" },
    { word: "nueve", translation: "9", partOfSpeech: "number" },
    { word: "diez", translation: "10", partOfSpeech: "number" },
    { word: "once", translation: "11", partOfSpeech: "number" },
    { word: "doce", translation: "12", partOfSpeech: "number" },
    { word: "trece", translation: "13", partOfSpeech: "number" },
    { word: "catorce", translation: "14", partOfSpeech: "number" },
    { word: "quince", translation: "15", partOfSpeech: "number" },
    { word: "dieciséis", translation: "16", partOfSpeech: "number" },
    { word: "diecisiete", translation: "17", partOfSpeech: "number" },
    { word: "dieciocho", translation: "18", partOfSpeech: "number" },
    { word: "diecinueve", translation: "19", partOfSpeech: "number" },
    { word: "veinte", translation: "20", partOfSpeech: "number" },
    { word: "¿Cuántos años tienes?", translation: "How old are you?", partOfSpeech: "phrase" },
    { word: "el número de teléfono", translation: "phone number", partOfSpeech: "noun" },
    { word: "años", translation: "years (of age)", partOfSpeech: "noun" },
  ],
};

async function main() {
  await client.connect();
  console.log("[NumbersVocab] Connected");

  let updated = 0;
  let skipped = 0;

  for (const [language, vocab] of Object.entries(NUMBER_VOCAB)) {
    // Find the textbook_lesson_content row for the Numbers 0-20 drill lesson
    const findRes = await client.query<{ tlc_id: string; lesson_name: string; current_count: number }>(`
      SELECT tlc.id as tlc_id, cl.name as lesson_name,
             jsonb_array_length(tlc.vocabulary_list::jsonb) as current_count
      FROM textbook_lesson_content tlc
      JOIN curriculum_lessons cl ON cl.id = tlc.lesson_id
      JOIN curriculum_units cu ON cl.curriculum_unit_id = cu.id
      JOIN curriculum_paths cp ON cu.curriculum_path_id = cp.id
      WHERE cp.language = $1
        AND (cl.name ILIKE '%0-20%' OR cl.name ILIKE '%1-20%')
        AND cl.lesson_type = 'drill'
      LIMIT 1
    `, [language]);

    if (findRes.rows.length === 0) {
      console.log(`[NumbersVocab] ${language}: No TLC row found — skipping`);
      skipped++;
      continue;
    }

    const { tlc_id, lesson_name, current_count } = findRes.rows[0];

    if (current_count >= 21) {
      console.log(`[NumbersVocab] ${language}: "${lesson_name}" already has ${current_count} items — skipping`);
      skipped++;
      continue;
    }

    await client.query(`
      UPDATE textbook_lesson_content
      SET vocabulary_list = $1::jsonb,
          seed_version     = seed_version + 1
      WHERE id = $2
    `, [JSON.stringify(vocab), tlc_id]);

    console.log(`[NumbersVocab] ${language}: Updated "${lesson_name}" — ${current_count} → ${vocab.length} items`);
    updated++;
  }

  console.log(`\n[NumbersVocab] Done: ${updated} updated, ${skipped} skipped`);
  await client.end();
}

main().catch((e) => {
  console.error("[NumbersVocab] Error:", e.message);
  process.exit(1);
});

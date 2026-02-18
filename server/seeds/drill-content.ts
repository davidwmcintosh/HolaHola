import { db } from "../db";
import { curriculumDrillItems, curriculumLessons } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

// Lesson IDs for Numbers 0-20 across all languages
const NUMBER_LESSONS: Record<string, string> = {
  english: "53b82475-f203-4cdb-aa2d-2c2c04b3baf6",
  french: "4f717d3b-e659-45f2-a758-730a94711e1b",
  german: "bb3f821b-e6bc-4d3e-9510-5a92c0047bec",
  italian: "a7f445b0-90ad-42b4-9464-effd65e145ef",
  japanese: "32a83b2e-8407-4a99-b69e-09bbc37f291c",
  korean: "1a26b446-dfbe-49ca-b52a-9b98eb796a1f",
  mandarin: "62298708-7ca5-4d9d-bb40-94b8d20e27b1",
  portuguese: "9a76f642-99aa-4d4d-b41f-6460d1353612",
  spanish: "c2b529b5-e3e1-4999-a20a-051e7d11feff",
};

// Lesson IDs for Greetings across all languages
const GREETING_LESSONS: Record<string, string> = {
  english: "baea29f5-6eba-480f-a19a-59f26e64048a",
  french: "b7b64cce-1eee-44ef-ba81-0a6e3456224f",
  german: "37cf613b-d25f-49c5-ad45-213fcd639971",
  italian: "df3224a8-a5ed-4ecf-9b0d-e4f01adc07c0",
  japanese: "d73fff59-0827-4731-b8f7-9a1d596e1f0f",
  korean: "13694418-b62b-4eb7-83e0-4123a385ad2e",
  mandarin: "05686d25-cd22-4789-82ed-daaf3365c228",
  portuguese: "15650c2d-1446-44ec-a0e0-d981129eed53",
  spanish: "f9328483-817c-4e91-99b9-55cbef52a5a2",
};

// Lesson IDs for Family Members across all languages
const FAMILY_LESSONS: Record<string, string> = {
  english: "2195a976-e5fc-4640-97e0-950738953fd4", // New Words: Family Members
  spanish: "362aaf97-6cf9-41fd-ba01-a649f5a565c5", // New Words: Meet the Family
  french: "e4d7dd5e-e9f2-4204-b11e-afb62b2b1adb",  // New Words: La Famille
  german: "2c986639-8176-4039-babe-db9d2c023ee4",  // New Words: Familienmitglieder
  italian: "6b77b02d-b2de-4869-819c-315d67760a5d", // New Words: I Membri della Famiglia
  portuguese: "f0d0467d-b36e-4cc7-8af5-f57b18e0da69", // New Words: A Família
};

// Numbers 0-20 in each language
const NUMBERS: Record<string, string[]> = {
  english: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", 
            "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"],
  spanish: ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
            "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte"],
  french: ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
           "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf", "vingt"],
  german: ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn",
           "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig"],
  italian: ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci",
            "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove", "venti"],
  portuguese: ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
               "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte"],
  japanese: ["ゼロ", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう", "じゅう",
             "じゅういち", "じゅうに", "じゅうさん", "じゅうよん", "じゅうご", "じゅうろく", "じゅうなな", "じゅうはち", "じゅうきゅう", "にじゅう"],
  korean: ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구", "십",
           "십일", "십이", "십삼", "십사", "십오", "십육", "십칠", "십팔", "십구", "이십"],
  mandarin: ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
             "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"],
};

// Greetings in each language
const GREETINGS: Record<string, Array<{ phrase: string; meaning: string; alternatives?: string[] }>> = {
  english: [
    { phrase: "Hello", meaning: "General greeting" },
    { phrase: "Hi", meaning: "Casual greeting" },
    { phrase: "Good morning", meaning: "Morning greeting" },
    { phrase: "Good afternoon", meaning: "Afternoon greeting" },
    { phrase: "Good evening", meaning: "Evening greeting" },
    { phrase: "Good night", meaning: "Nighttime farewell" },
    { phrase: "Goodbye", meaning: "General farewell", alternatives: ["Bye", "Bye-bye"] },
    { phrase: "See you later", meaning: "Casual farewell", alternatives: ["See ya"] },
    { phrase: "How are you?", meaning: "Asking about wellbeing" },
    { phrase: "I'm fine, thank you", meaning: "Response to how are you", alternatives: ["I'm good, thanks"] },
  ],
  spanish: [
    { phrase: "Hola", meaning: "Hello" },
    { phrase: "Buenos días", meaning: "Good morning" },
    { phrase: "Buenas tardes", meaning: "Good afternoon" },
    { phrase: "Buenas noches", meaning: "Good evening/night" },
    { phrase: "Adiós", meaning: "Goodbye" },
    { phrase: "Hasta luego", meaning: "See you later" },
    { phrase: "Hasta mañana", meaning: "See you tomorrow" },
    { phrase: "¿Cómo estás?", meaning: "How are you? (informal)", alternatives: ["¿Cómo está?", "¿Qué tal?"] },
    { phrase: "Muy bien, gracias", meaning: "Very well, thank you", alternatives: ["Bien, gracias"] },
    { phrase: "Mucho gusto", meaning: "Nice to meet you", alternatives: ["Encantado", "Encantada"] },
  ],
  french: [
    { phrase: "Bonjour", meaning: "Hello/Good day" },
    { phrase: "Salut", meaning: "Hi (informal)" },
    { phrase: "Bonsoir", meaning: "Good evening" },
    { phrase: "Bonne nuit", meaning: "Good night" },
    { phrase: "Au revoir", meaning: "Goodbye" },
    { phrase: "À bientôt", meaning: "See you soon" },
    { phrase: "À demain", meaning: "See you tomorrow" },
    { phrase: "Comment allez-vous?", meaning: "How are you? (formal)", alternatives: ["Comment vas-tu?", "Ça va?"] },
    { phrase: "Très bien, merci", meaning: "Very well, thank you", alternatives: ["Bien, merci"] },
    { phrase: "Enchanté", meaning: "Nice to meet you", alternatives: ["Enchantée"] },
  ],
  german: [
    { phrase: "Hallo", meaning: "Hello" },
    { phrase: "Guten Morgen", meaning: "Good morning" },
    { phrase: "Guten Tag", meaning: "Good day" },
    { phrase: "Guten Abend", meaning: "Good evening" },
    { phrase: "Gute Nacht", meaning: "Good night" },
    { phrase: "Auf Wiedersehen", meaning: "Goodbye", alternatives: ["Tschüss"] },
    { phrase: "Bis später", meaning: "See you later" },
    { phrase: "Wie geht es Ihnen?", meaning: "How are you? (formal)", alternatives: ["Wie geht's?"] },
    { phrase: "Mir geht es gut, danke", meaning: "I'm fine, thank you", alternatives: ["Gut, danke"] },
    { phrase: "Freut mich", meaning: "Nice to meet you" },
  ],
  italian: [
    { phrase: "Ciao", meaning: "Hello/Goodbye (informal)" },
    { phrase: "Buongiorno", meaning: "Good morning/day" },
    { phrase: "Buonasera", meaning: "Good evening" },
    { phrase: "Buonanotte", meaning: "Good night" },
    { phrase: "Arrivederci", meaning: "Goodbye (formal)" },
    { phrase: "A presto", meaning: "See you soon" },
    { phrase: "A domani", meaning: "See you tomorrow" },
    { phrase: "Come sta?", meaning: "How are you? (formal)", alternatives: ["Come stai?"] },
    { phrase: "Sto bene, grazie", meaning: "I'm fine, thank you", alternatives: ["Bene, grazie"] },
    { phrase: "Piacere", meaning: "Nice to meet you" },
  ],
  portuguese: [
    { phrase: "Olá", meaning: "Hello" },
    { phrase: "Oi", meaning: "Hi (informal)" },
    { phrase: "Bom dia", meaning: "Good morning" },
    { phrase: "Boa tarde", meaning: "Good afternoon" },
    { phrase: "Boa noite", meaning: "Good evening/night" },
    { phrase: "Tchau", meaning: "Bye", alternatives: ["Adeus"] },
    { phrase: "Até logo", meaning: "See you later" },
    { phrase: "Como está?", meaning: "How are you?", alternatives: ["Como vai?", "Tudo bem?"] },
    { phrase: "Estou bem, obrigado", meaning: "I'm fine, thank you", alternatives: ["Bem, obrigado"] },
    { phrase: "Prazer em conhecê-lo", meaning: "Nice to meet you", alternatives: ["Prazer"] },
  ],
  japanese: [
    { phrase: "こんにちは", meaning: "Hello (daytime)" },
    { phrase: "おはようございます", meaning: "Good morning", alternatives: ["おはよう"] },
    { phrase: "こんばんは", meaning: "Good evening" },
    { phrase: "おやすみなさい", meaning: "Good night", alternatives: ["おやすみ"] },
    { phrase: "さようなら", meaning: "Goodbye" },
    { phrase: "またね", meaning: "See you later" },
    { phrase: "また明日", meaning: "See you tomorrow" },
    { phrase: "お元気ですか", meaning: "How are you?" },
    { phrase: "元気です、ありがとう", meaning: "I'm fine, thank you" },
    { phrase: "はじめまして", meaning: "Nice to meet you" },
  ],
  korean: [
    { phrase: "안녕하세요", meaning: "Hello (formal)", alternatives: ["안녕"] },
    { phrase: "좋은 아침이에요", meaning: "Good morning" },
    { phrase: "안녕히 가세요", meaning: "Goodbye (to someone leaving)" },
    { phrase: "안녕히 계세요", meaning: "Goodbye (when you're leaving)" },
    { phrase: "또 만나요", meaning: "See you again" },
    { phrase: "내일 봐요", meaning: "See you tomorrow" },
    { phrase: "잘 자요", meaning: "Good night" },
    { phrase: "어떻게 지내세요?", meaning: "How are you?", alternatives: ["잘 지내세요?"] },
    { phrase: "잘 지내요, 감사합니다", meaning: "I'm fine, thank you" },
    { phrase: "만나서 반갑습니다", meaning: "Nice to meet you", alternatives: ["반갑습니다"] },
  ],
  mandarin: [
    { phrase: "你好", meaning: "Hello" },
    { phrase: "早上好", meaning: "Good morning" },
    { phrase: "下午好", meaning: "Good afternoon" },
    { phrase: "晚上好", meaning: "Good evening" },
    { phrase: "晚安", meaning: "Good night" },
    { phrase: "再见", meaning: "Goodbye" },
    { phrase: "回头见", meaning: "See you later" },
    { phrase: "明天见", meaning: "See you tomorrow" },
    { phrase: "你好吗?", meaning: "How are you?" },
    { phrase: "我很好，谢谢", meaning: "I'm fine, thank you", alternatives: ["很好，谢谢"] },
  ],
};

// Family members vocabulary in each language
const FAMILY: Record<string, Array<{ word: string; meaning: string; alternatives?: string[] }>> = {
  english: [
    { word: "mother", meaning: "Female parent", alternatives: ["mom", "mum"] },
    { word: "father", meaning: "Male parent", alternatives: ["dad"] },
    { word: "sister", meaning: "Female sibling" },
    { word: "brother", meaning: "Male sibling" },
    { word: "grandmother", meaning: "Parent's mother", alternatives: ["grandma"] },
    { word: "grandfather", meaning: "Parent's father", alternatives: ["grandpa"] },
    { word: "aunt", meaning: "Parent's sister" },
    { word: "uncle", meaning: "Parent's brother" },
    { word: "cousin", meaning: "Child of aunt or uncle" },
    { word: "daughter", meaning: "Female child" },
    { word: "son", meaning: "Male child" },
    { word: "parents", meaning: "Mother and father" },
  ],
  spanish: [
    { word: "madre", meaning: "Mother", alternatives: ["mamá"] },
    { word: "padre", meaning: "Father", alternatives: ["papá"] },
    { word: "hermana", meaning: "Sister" },
    { word: "hermano", meaning: "Brother" },
    { word: "abuela", meaning: "Grandmother" },
    { word: "abuelo", meaning: "Grandfather" },
    { word: "tía", meaning: "Aunt" },
    { word: "tío", meaning: "Uncle" },
    { word: "primo", meaning: "Cousin (male)", alternatives: ["prima"] },
    { word: "hija", meaning: "Daughter" },
    { word: "hijo", meaning: "Son" },
    { word: "padres", meaning: "Parents" },
  ],
  french: [
    { word: "mère", meaning: "Mother", alternatives: ["maman"] },
    { word: "père", meaning: "Father", alternatives: ["papa"] },
    { word: "sœur", meaning: "Sister" },
    { word: "frère", meaning: "Brother" },
    { word: "grand-mère", meaning: "Grandmother", alternatives: ["mamie"] },
    { word: "grand-père", meaning: "Grandfather", alternatives: ["papy"] },
    { word: "tante", meaning: "Aunt" },
    { word: "oncle", meaning: "Uncle" },
    { word: "cousin", meaning: "Cousin (male)", alternatives: ["cousine"] },
    { word: "fille", meaning: "Daughter" },
    { word: "fils", meaning: "Son" },
    { word: "parents", meaning: "Parents" },
  ],
  german: [
    { word: "Mutter", meaning: "Mother", alternatives: ["Mama", "Mutti"] },
    { word: "Vater", meaning: "Father", alternatives: ["Papa", "Vati"] },
    { word: "Schwester", meaning: "Sister" },
    { word: "Bruder", meaning: "Brother" },
    { word: "Großmutter", meaning: "Grandmother", alternatives: ["Oma"] },
    { word: "Großvater", meaning: "Grandfather", alternatives: ["Opa"] },
    { word: "Tante", meaning: "Aunt" },
    { word: "Onkel", meaning: "Uncle" },
    { word: "Cousin", meaning: "Cousin (male)", alternatives: ["Cousine"] },
    { word: "Tochter", meaning: "Daughter" },
    { word: "Sohn", meaning: "Son" },
    { word: "Eltern", meaning: "Parents" },
  ],
  italian: [
    { word: "madre", meaning: "Mother", alternatives: ["mamma"] },
    { word: "padre", meaning: "Father", alternatives: ["papà"] },
    { word: "sorella", meaning: "Sister" },
    { word: "fratello", meaning: "Brother" },
    { word: "nonna", meaning: "Grandmother" },
    { word: "nonno", meaning: "Grandfather" },
    { word: "zia", meaning: "Aunt" },
    { word: "zio", meaning: "Uncle" },
    { word: "cugino", meaning: "Cousin (male)", alternatives: ["cugina"] },
    { word: "figlia", meaning: "Daughter" },
    { word: "figlio", meaning: "Son" },
    { word: "genitori", meaning: "Parents" },
  ],
  portuguese: [
    { word: "mãe", meaning: "Mother", alternatives: ["mamãe"] },
    { word: "pai", meaning: "Father", alternatives: ["papai"] },
    { word: "irmã", meaning: "Sister" },
    { word: "irmão", meaning: "Brother" },
    { word: "avó", meaning: "Grandmother", alternatives: ["vovó"] },
    { word: "avô", meaning: "Grandfather", alternatives: ["vovô"] },
    { word: "tia", meaning: "Aunt" },
    { word: "tio", meaning: "Uncle" },
    { word: "primo", meaning: "Cousin (male)", alternatives: ["prima"] },
    { word: "filha", meaning: "Daughter" },
    { word: "filho", meaning: "Son" },
    { word: "pais", meaning: "Parents" },
  ],
};

async function lessonHasDrillItems(lessonId: string): Promise<boolean> {
  const existing = await db.select({ id: curriculumDrillItems.id })
    .from(curriculumDrillItems)
    .where(eq(curriculumDrillItems.lessonId, lessonId))
    .limit(1);
  return existing.length > 0;
}

export async function seedDrillContent() {
  console.log("[Drill Seed] Starting drill content seeding...");
  
  let numbersCreated = 0;
  let greetingsCreated = 0;
  let familyCreated = 0;

  for (const [language, lessonId] of Object.entries(NUMBER_LESSONS)) {
    const numbers = NUMBERS[language];
    if (!numbers) continue;

    if (await lessonHasDrillItems(lessonId)) {
      console.log(`[Drill Seed] Skipping ${language} numbers — items already exist`);
      continue;
    }

    for (let i = 0; i <= 20; i++) {
      const word = numbers[i];
      
      try {
        await db.insert(curriculumDrillItems).values({
          lessonId,
          itemType: "listen_repeat",
          orderIndex: i * 2,
          prompt: `${i}`,
          targetText: word,
          targetLanguage: language,
          hints: [`This is the number ${i}`],
          acceptableAlternatives: [],
          difficulty: i <= 10 ? 1 : 2,
          tags: ["numbers", "basic"],
        });
        
        await db.insert(curriculumDrillItems).values({
          lessonId,
          itemType: "number_dictation",
          orderIndex: i * 2 + 1,
          prompt: word,
          targetText: String(i),
          targetLanguage: language,
          hints: [`Listen carefully and type the number you hear`],
          acceptableAlternatives: [],
          difficulty: i <= 10 ? 1 : 2,
          tags: ["numbers", "listening"],
        });
        
        numbersCreated += 2;
      } catch (e) {
        // Ignore errors
      }
    }
  }

  for (const [language, lessonId] of Object.entries(GREETING_LESSONS)) {
    const greetings = GREETINGS[language];
    if (!greetings) continue;

    if (await lessonHasDrillItems(lessonId)) {
      console.log(`[Drill Seed] Skipping ${language} greetings — items already exist`);
      continue;
    }

    for (let i = 0; i < greetings.length; i++) {
      const greeting = greetings[i];
      
      try {
        await db.insert(curriculumDrillItems).values({
          lessonId,
          itemType: "listen_repeat",
          orderIndex: i,
          prompt: greeting.phrase,
          targetText: greeting.phrase,
          targetLanguage: language,
          hints: [greeting.meaning],
          acceptableAlternatives: greeting.alternatives || [],
          difficulty: 1,
          tags: ["greetings", "phrases"],
        });
        
        greetingsCreated++;
      } catch (e) {
        // Ignore errors
      }
    }
  }

  for (const [language, lessonId] of Object.entries(FAMILY_LESSONS)) {
    const familyWords = FAMILY[language];
    if (!familyWords) continue;

    if (await lessonHasDrillItems(lessonId)) {
      console.log(`[Drill Seed] Skipping ${language} family — items already exist`);
      continue;
    }

    for (let i = 0; i < familyWords.length; i++) {
      const member = familyWords[i];
      
      try {
        await db.insert(curriculumDrillItems).values({
          lessonId,
          itemType: "listen_repeat",
          orderIndex: i * 2,
          prompt: member.word,
          targetText: member.word,
          targetLanguage: language,
          hints: [member.meaning],
          acceptableAlternatives: member.alternatives || [],
          difficulty: 1,
          tags: ["family", "vocabulary"],
        });
        
        await db.insert(curriculumDrillItems).values({
          lessonId,
          itemType: "translate_speak",
          orderIndex: i * 2 + 1,
          prompt: member.meaning,
          targetText: member.word,
          targetLanguage: language,
          hints: [`Say the word in ${language}`],
          acceptableAlternatives: member.alternatives || [],
          difficulty: 1,
          tags: ["family", "speaking"],
        });
        
        familyCreated += 2;
      } catch (e) {
        // Ignore errors
      }
    }
  }

  console.log(`[Drill Seed] Complete: ${numbersCreated} number drills, ${greetingsCreated} greeting drills, ${familyCreated} family drills created`);
  
  // Update the lesson types to 'drill' for all drill lessons
  const allDrillLessonIds = [
    ...Object.values(NUMBER_LESSONS),
    ...Object.values(GREETING_LESSONS),
    ...Object.values(FAMILY_LESSONS),
  ];
  
  try {
    await db
      .update(curriculumLessons)
      .set({ lessonType: 'drill' })
      .where(inArray(curriculumLessons.id, allDrillLessonIds));
    console.log(`[Drill Seed] Updated ${allDrillLessonIds.length} lessons to drill type`);
  } catch (e) {
    console.log(`[Drill Seed] Lesson type update skipped (already drill or error)`);
  }
  
  return { numbersCreated, greetingsCreated, familyCreated };
}

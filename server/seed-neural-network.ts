import { db } from "./db";
import {
  languageIdioms,
  culturalNuances,
  learnerErrorPatterns,
  dialectVariations,
  linguisticBridges,
} from "@shared/schema";

export async function seedNeuralNetworkData() {
  console.log("[Neural Network Seed] Starting neural network data seeding...");
  
  // Check which languages need seeding
  const existingLanguages = await db.select({ language: languageIdioms.language }).from(languageIdioms).groupBy(languageIdioms.language);
  const seededLanguages = new Set(existingLanguages.map(r => r.language));
  
  // Seed each language that hasn't been seeded yet
  await seedSpanish(seededLanguages);
  await seedFrench(seededLanguages);
  await seedGerman(seededLanguages);
  await seedItalian(seededLanguages);
  await seedPortuguese(seededLanguages);
  await seedJapanese(seededLanguages);
  await seedMandarin(seededLanguages);
  await seedKorean(seededLanguages);
  await seedEnglish(seededLanguages);
  
  console.log("[Neural Network Seed] Complete!");
}

async function seedSpanish(seededLanguages: Set<string>) {
  if (seededLanguages.has("spanish")) {
    console.log("[Neural Network Seed] Spanish already seeded, skipping...");
    return;
  }
  
  // ===== SPANISH IDIOMS =====
  const spanishIdioms = [
    {
      language: "spanish",
      idiom: "Estar como una cabra",
      literalTranslation: "To be like a goat",
      meaning: "To be crazy or eccentric",
      culturalContext: "Used affectionately to describe someone who is wild or unpredictable. Not offensive - more playful.",
      usageExamples: ["Mi abuela está como una cabra, pero la queremos mucho.", "¡Estás como una cabra saltando así!"],
      registerLevel: "casual",
      region: "Spain",
      commonMistakes: ["Confusing with 'estar loco' which is more direct and less playful"],
    },
    {
      language: "spanish",
      idiom: "No hay moros en la costa",
      literalTranslation: "There are no Moors on the coast",
      meaning: "The coast is clear (no one is watching)",
      culturalContext: "Historical reference to when Spain watched for Moorish invaders. Now used when checking if authority figures are around.",
      usageExamples: ["¿No hay moros en la costa? Puedo comer chocolate.", "Mira si hay moros en la costa antes de escaparnos."],
      registerLevel: "casual",
    },
    {
      language: "spanish",
      idiom: "Dar en el clavo",
      literalTranslation: "To hit the nail",
      meaning: "To hit the nail on the head / get something exactly right",
      culturalContext: "Used when someone makes a perfect observation or guess.",
      usageExamples: ["¡Diste en el clavo! Eso es exactamente lo que pasó.", "El doctor dio en el clavo con su diagnóstico."],
      registerLevel: "casual",
    },
    {
      language: "spanish",
      idiom: "Costar un ojo de la cara",
      literalTranslation: "To cost an eye from the face",
      meaning: "To be very expensive",
      culturalContext: "Emphasizes that something is prohibitively expensive, worth more than a body part.",
      usageExamples: ["Este coche me costó un ojo de la cara.", "Los billetes de avión cuestan un ojo de la cara en verano."],
      registerLevel: "casual",
    },
    {
      language: "spanish",
      idiom: "Ser pan comido",
      literalTranslation: "To be eaten bread",
      meaning: "To be a piece of cake (very easy)",
      culturalContext: "Bread is so common and easy to eat - used for something requiring no effort.",
      usageExamples: ["Este examen va a ser pan comido.", "Para ella, cocinar es pan comido."],
      registerLevel: "casual",
    },
    {
      language: "spanish",
      idiom: "Meter la pata",
      literalTranslation: "To put in the paw/leg",
      meaning: "To put your foot in your mouth / make a blunder",
      culturalContext: "Used when someone makes an embarrassing mistake, especially in social situations.",
      usageExamples: ["Metí la pata cuando mencioné su ex.", "No quiero meter la pata en la entrevista."],
      registerLevel: "casual",
    },
    {
      language: "spanish",
      idiom: "Tomar el pelo",
      literalTranslation: "To take the hair",
      meaning: "To pull someone's leg / joke with them",
      culturalContext: "Used when teasing someone or when you suspect you're being teased.",
      usageExamples: ["¿Me estás tomando el pelo?", "No le tomes el pelo a tu hermano."],
      registerLevel: "casual",
    },
    {
      language: "spanish",
      idiom: "Quedarse de piedra",
      literalTranslation: "To remain like stone",
      meaning: "To be stunned/shocked",
      culturalContext: "Describes being so surprised you freeze like a statue.",
      usageExamples: ["Me quedé de piedra cuando me dijo que se iba.", "Todos se quedaron de piedra con la noticia."],
      registerLevel: "casual",
    },
  ];
  
  // ===== SPANISH CULTURAL NUANCES =====
  const spanishCulturalNuances = [
    {
      language: "spanish",
      category: "greetings",
      situation: "meeting someone new",
      nuance: "Two kisses (one on each cheek) is standard between women, and between men and women. Men typically shake hands with other men unless close friends/family.",
      explanation: "Physical greeting customs vary significantly from English-speaking countries. The kisses are light 'air kisses' with cheek touch.",
      commonMistakes: ["Going for a hug instead of kisses", "Only giving one kiss (common in some Latin American countries but not Spain)", "Kissing on the wrong cheek first (right cheek first in Spain)"],
      region: "Spain",
      formalityLevel: "casual",
    },
    {
      language: "spanish",
      category: "greetings",
      situation: "meeting someone new",
      nuance: "In Mexico, one kiss on the cheek is common between women and mixed genders. Men shake hands, sometimes with a brief hug (abrazo).",
      explanation: "The abrazo (hug with back pats) between men shows warmth and is common among friends and acquaintances.",
      commonMistakes: ["Giving two kisses like in Spain", "Being too stiff with the abrazo"],
      region: "Mexico",
      formalityLevel: "casual",
    },
    {
      language: "spanish",
      category: "conversation",
      situation: "addressing someone",
      nuance: "Use 'usted' (formal you) with elders, authority figures, and in professional settings. 'Tú' is for friends, peers, and casual situations.",
      explanation: "Getting this wrong can seem disrespectful (too casual) or cold (too formal with friends). When in doubt, start with usted.",
      commonMistakes: ["Using tú with someone's parents when first meeting", "Using usted with young peers (seems overly distant)"],
      formalityLevel: "formal",
    },
    {
      language: "spanish",
      category: "dining",
      situation: "restaurant etiquette",
      nuance: "Meals are long and social. Rushing is considered rude. The waiter won't bring the check until you ask (to not rush you).",
      explanation: "In Spanish culture, meals are about connection, not efficiency. Asking 'la cuenta, por favor' is expected when ready to leave.",
      commonMistakes: ["Expecting the check to arrive automatically", "Rushing through a meal", "Not making eye contact to signal the waiter"],
    },
    {
      language: "spanish",
      category: "conversation",
      situation: "polite interruption",
      nuance: "Interrupting is more acceptable in Spanish conversation than in English. Overlapping speech shows engagement, not rudeness.",
      explanation: "What seems like interrupting to English speakers is actually showing enthusiasm and connection in Spanish culture.",
      commonMistakes: ["Waiting too long to speak (seems disengaged)", "Getting offended when interrupted"],
    },
    {
      language: "spanish",
      category: "time",
      situation: "punctuality",
      nuance: "Social events typically start 15-30 minutes 'late' by American standards. This is normal and expected.",
      explanation: "Arriving exactly on time for a party or dinner might mean your host isn't ready. Business meetings are more punctual.",
      commonMistakes: ["Arriving exactly on time for social events", "Getting frustrated when others arrive 'late'"],
      region: "Latin America",
    },
  ];
  
  // ===== LEARNER ERROR PATTERNS (English → Spanish) =====
  const spanishErrorPatterns = [
    {
      targetLanguage: "spanish",
      sourceLanguage: "english",
      errorCategory: "grammar",
      specificError: "ser_estar_confusion",
      whyItHappens: "English has only one verb 'to be', while Spanish has two with different uses. Ser = permanent/identity, Estar = temporary/state/location.",
      teachingStrategies: [
        "DOCTOR acronym: Description, Occupation, Characteristic, Time, Origin, Relation (use SER)",
        "PLACE acronym: Position, Location, Action, Condition, Emotion (use ESTAR)",
        "Think: 'Is this permanent or temporary?'",
        "Practice with contrasting pairs: Ella es bonita (always) vs Ella está bonita (today)",
      ],
      exampleMistakes: ["Yo soy cansado (wrong)", "La fiesta es en mi casa (wrong)", "Ella es enferma (wrong)"],
      correctForms: ["Yo estoy cansado", "La fiesta está en mi casa", "Ella está enferma"],
      actflLevel: "novice_mid",
      priority: "common",
    },
    {
      targetLanguage: "spanish",
      sourceLanguage: "english",
      errorCategory: "grammar",
      specificError: "subjunctive_avoidance",
      whyItHappens: "English subjunctive is nearly extinct ('If I were you'). Spanish subjunctive is alive and required in many contexts.",
      teachingStrategies: [
        "WEIRDO triggers: Wishes, Emotions, Impersonal expressions, Recommendations, Doubt, Ojalá",
        "Start with fixed expressions: 'Espero que...', 'Quiero que...'",
        "Practice the difference: Sé que viene (fact) vs No creo que venga (doubt)",
      ],
      exampleMistakes: ["Quiero que tú vienes (wrong)", "Espero que él tiene tiempo (wrong)"],
      correctForms: ["Quiero que tú vengas", "Espero que él tenga tiempo"],
      actflLevel: "intermediate_low",
      priority: "common",
    },
    {
      targetLanguage: "spanish",
      sourceLanguage: "english",
      errorCategory: "grammar",
      specificError: "adjective_placement",
      whyItHappens: "English adjectives go before nouns. Spanish adjectives usually go after, but some change meaning based on position.",
      teachingStrategies: [
        "Default: adjective after noun (casa grande)",
        "Some adjectives change meaning: viejo amigo (long-time) vs amigo viejo (elderly)",
        "Memorize the position-changers: grande, pobre, nuevo, viejo, antiguo",
      ],
      exampleMistakes: ["La grande casa (wrong)", "Un rojo coche (wrong)"],
      correctForms: ["La casa grande", "Un coche rojo"],
      actflLevel: "novice_high",
      priority: "common",
    },
    {
      targetLanguage: "spanish",
      sourceLanguage: "english",
      errorCategory: "grammar",
      specificError: "por_para_confusion",
      whyItHappens: "English 'for' translates to both por and para with different meanings.",
      teachingStrategies: [
        "PARA = Purpose, destination, deadline, recipient (forward-looking)",
        "POR = Duration, exchange, cause, means, motion through (backward-looking)",
        "Memory: PARA = 'in order to', POR = 'because of'",
      ],
      exampleMistakes: ["Trabajo para dinero (wrong)", "Este regalo es por ti (wrong)"],
      correctForms: ["Trabajo por dinero (in exchange for)", "Este regalo es para ti (recipient)"],
      actflLevel: "intermediate_low",
      priority: "common",
    },
    {
      targetLanguage: "spanish",
      sourceLanguage: "english",
      errorCategory: "pronunciation",
      specificError: "rolling_r_difficulty",
      whyItHappens: "English has no trilled R. The Spanish 'rr' and word-initial 'r' require tongue trill that takes muscle training.",
      teachingStrategies: [
        "Practice 'butter' → 'budder' → 'd' sound is close to single tap 'r'",
        "For trill: say 'tee dee va' fast repeatedly",
        "Start with words having the sound: perro, carro, correr",
        "Don't stress - many native speakers have soft R's too",
      ],
      exampleMistakes: ["Pero (but) sounding like 'pedo'", "Caro vs carro indistinguishable"],
      correctForms: ["pero [soft tap r]", "perro [trilled rr]"],
      actflLevel: "novice_low",
      priority: "common",
    },
    {
      targetLanguage: "spanish",
      sourceLanguage: "english",
      errorCategory: "vocabulary",
      specificError: "false_friend_embarrassed",
      whyItHappens: "'Embarazada' looks like 'embarrassed' but means 'pregnant'. Very common and memorable mistake.",
      teachingStrategies: [
        "Mnemonic: 'Embarazada has a baby (baba) in it'",
        "Correct word: 'avergonzado/a' for embarrassed",
        "Learn common false friends as a set",
      ],
      exampleMistakes: ["Estoy embarazada (when meaning embarrassed)"],
      correctForms: ["Estoy avergonzado/a (embarrassed)", "Estoy embarazada (pregnant)"],
      actflLevel: "novice_mid",
      priority: "common",
    },
  ];
  
  // ===== DIALECT VARIATIONS =====
  const spanishDialects = [
    {
      language: "spanish",
      region: "Argentina",
      category: "grammar",
      standardForm: "tú tienes",
      regionalForm: "vos tenés",
      explanation: "Argentina uses 'voseo' - the pronoun 'vos' instead of 'tú' with different verb conjugations.",
      usageNotes: "Voseo is the standard in Argentina, Uruguay, Paraguay, and parts of Central America. Completely normal and grammatically correct.",
    },
    {
      language: "spanish",
      region: "Spain",
      category: "grammar",
      standardForm: "ustedes tienen",
      regionalForm: "vosotros tenéis",
      explanation: "Spain uses 'vosotros' for informal plural 'you', while Latin America uses 'ustedes' for both formal and informal.",
      usageNotes: "As a learner, you can use 'ustedes' everywhere and be understood. Learning vosotros is optional but useful for Spain.",
    },
    {
      language: "spanish",
      region: "Mexico",
      category: "vocabulary",
      standardForm: "autobús",
      regionalForm: "camión",
      explanation: "In Mexico, 'camión' means bus (elsewhere it means truck). Different countries have different words for common items.",
      usageNotes: "In Mexico: camión = bus. In Spain/South America: autobús = bus, camión = truck.",
    },
    {
      language: "spanish",
      region: "Spain",
      category: "vocabulary",
      standardForm: "computadora",
      regionalForm: "ordenador",
      explanation: "Spain uses 'ordenador' for computer, Latin America uses 'computadora'.",
      usageNotes: "Both are understood everywhere, but using the regional word sounds more natural.",
    },
    {
      language: "spanish",
      region: "Caribbean",
      category: "pronunciation",
      standardForm: "¿Cómo estás?",
      regionalForm: "¿Cómo ehtáh?",
      explanation: "Caribbean Spanish (Cuba, Puerto Rico, Dominican Republic) aspirates or drops final 's' sounds.",
      usageNotes: "This is a normal accent feature, not 'incorrect'. Also common in Andalusian Spanish (southern Spain).",
    },
  ];
  
  // ===== LINGUISTIC BRIDGES (English ↔ Spanish) =====
  const englishSpanishBridges = [
    {
      sourceLanguage: "english",
      targetLanguage: "spanish",
      bridgeType: "cognate",
      sourceWord: "family",
      targetWord: "familia",
      relationship: "same_meaning",
      explanation: "Both derive from Latin 'familia'. Many -ly words → -ia in Spanish.",
      teachingNote: "Point out the pattern: melody→melodía, history→historia, theory→teoría",
    },
    {
      sourceLanguage: "english",
      targetLanguage: "spanish",
      bridgeType: "cognate",
      sourceWord: "important",
      targetWord: "importante",
      relationship: "same_meaning",
      explanation: "-ant/-ent endings often become -ante/-ente. Very reliable pattern.",
      teachingNote: "Pattern: elegant→elegante, different→diferente, constant→constante",
    },
    {
      sourceLanguage: "english",
      targetLanguage: "spanish",
      bridgeType: "cognate",
      sourceWord: "nation",
      targetWord: "nación",
      relationship: "same_meaning",
      explanation: "-tion endings become -ción. One of the most reliable patterns.",
      teachingNote: "Massive vocabulary boost: action→acción, emotion→emoción, station→estación",
    },
    {
      sourceLanguage: "english",
      targetLanguage: "spanish",
      bridgeType: "false_friend",
      sourceWord: "actual",
      targetWord: "actual",
      relationship: "different_meaning",
      explanation: "English 'actual' = real/true. Spanish 'actual' = current/present.",
      teachingNote: "For 'actual' in English sense, use 'real' or 'verdadero' in Spanish.",
    },
    {
      sourceLanguage: "english",
      targetLanguage: "spanish",
      bridgeType: "false_friend",
      sourceWord: "eventually",
      targetWord: "eventualmente",
      relationship: "different_meaning",
      explanation: "English 'eventually' = finally/in the end. Spanish 'eventualmente' = possibly/by chance.",
      teachingNote: "For 'eventually', use 'finalmente' or 'al final' in Spanish.",
    },
    {
      sourceLanguage: "english",
      targetLanguage: "spanish",
      bridgeType: "false_friend",
      sourceWord: "library",
      targetWord: "librería",
      relationship: "different_meaning",
      explanation: "'Librería' = bookstore. 'Biblioteca' = library.",
      teachingNote: "Classic confusion. biblioteca = library (with books to borrow), librería = bookstore (books to buy).",
    },
    {
      sourceLanguage: "english",
      targetLanguage: "spanish",
      bridgeType: "grammar_parallel",
      sourceWord: "I am going to eat",
      targetWord: "Voy a comer",
      relationship: "similar_structure",
      explanation: "The 'going to + verb' future construction works identically in both languages.",
      teachingNote: "Great bridge: 'ir a + infinitive' = 'going to + verb'. Students can use this immediately.",
    },
  ];
  
  // Insert all data
  await db.insert(languageIdioms).values(spanishIdioms);
  console.log(`[Neural Network Seed] Inserted ${spanishIdioms.length} Spanish idioms`);
  
  await db.insert(culturalNuances).values(spanishCulturalNuances);
  console.log(`[Neural Network Seed] Inserted ${spanishCulturalNuances.length} Spanish cultural nuances`);
  
  await db.insert(learnerErrorPatterns).values(spanishErrorPatterns);
  console.log(`[Neural Network Seed] Inserted ${spanishErrorPatterns.length} Spanish learner error patterns`);
  
  await db.insert(dialectVariations).values(spanishDialects);
  console.log(`[Neural Network Seed] Inserted ${spanishDialects.length} Spanish dialect variations`);
  
  await db.insert(linguisticBridges).values(englishSpanishBridges);
  console.log(`[Neural Network Seed] Inserted ${englishSpanishBridges.length} English-Spanish linguistic bridges`);
}

// Stub functions for other languages (to be implemented)
async function seedFrench(seededLanguages: Set<string>) {
  if (seededLanguages.has("french")) return;
  console.log("[Neural Network Seed] French data to be added later");
}

async function seedGerman(seededLanguages: Set<string>) {
  if (seededLanguages.has("german")) return;
  console.log("[Neural Network Seed] German data to be added later");
}

async function seedItalian(seededLanguages: Set<string>) {
  if (seededLanguages.has("italian")) return;
  console.log("[Neural Network Seed] Italian data to be added later");
}

async function seedPortuguese(seededLanguages: Set<string>) {
  if (seededLanguages.has("portuguese")) return;
  console.log("[Neural Network Seed] Portuguese data to be added later");
}

async function seedJapanese(seededLanguages: Set<string>) {
  if (seededLanguages.has("japanese")) return;
  console.log("[Neural Network Seed] Japanese data to be added later");
}

async function seedMandarin(seededLanguages: Set<string>) {
  if (seededLanguages.has("mandarin")) return;
  console.log("[Neural Network Seed] Mandarin data to be added later");
}

async function seedKorean(seededLanguages: Set<string>) {
  if (seededLanguages.has("korean")) return;
  console.log("[Neural Network Seed] Korean data to be added later");
}

async function seedEnglish(seededLanguages: Set<string>) {
  if (seededLanguages.has("english")) return;
  console.log("[Neural Network Seed] English data to be added later");
}

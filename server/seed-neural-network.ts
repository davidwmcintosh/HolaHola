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

// ===== FRENCH =====
async function seedFrench(seededLanguages: Set<string>) {
  if (seededLanguages.has("french")) return;
  
  const frenchIdioms = [
    { language: "french", idiom: "Avoir le cafard", literalTranslation: "To have the cockroach", meaning: "To feel down or depressed", culturalContext: "Likely from the dark color of cockroaches representing gloom", usageExamples: ["J'ai le cafard aujourd'hui.", "Elle a le cafard depuis son départ."], registerLevel: "casual" },
    { language: "french", idiom: "Coûter les yeux de la tête", literalTranslation: "To cost the eyes from the head", meaning: "To be extremely expensive", culturalContext: "Similar expression exists in Spanish", usageExamples: ["Cette voiture coûte les yeux de la tête!", "Le loyer à Paris coûte les yeux de la tête."], registerLevel: "casual" },
    { language: "french", idiom: "Poser un lapin", literalTranslation: "To put down a rabbit", meaning: "To stand someone up", culturalContext: "Origin debated - possibly from not paying a prostitute", usageExamples: ["Il m'a posé un lapin hier soir.", "Ne me pose pas un lapin!"], registerLevel: "casual" },
    { language: "french", idiom: "Avoir la pêche", literalTranslation: "To have the peach", meaning: "To feel great/energetic", culturalContext: "The peach symbolizes vitality and health", usageExamples: ["J'ai la pêche ce matin!", "Tu as la pêche aujourd'hui?"], registerLevel: "casual" },
    { language: "french", idiom: "Ce n'est pas la mer à boire", literalTranslation: "It's not the sea to drink", meaning: "It's not that difficult", culturalContext: "Drinking the sea would be impossible - this task is much easier", usageExamples: ["Allez, ce n'est pas la mer à boire!", "L'examen? Ce n'est pas la mer à boire."], registerLevel: "casual" },
  ];
  
  const frenchCulturalNuances = [
    { language: "french", category: "greetings", situation: "meeting someone", nuance: "La bise (cheek kisses) is standard between friends and acquaintances. Number varies by region: 2 in Paris, up to 4 in some areas.", explanation: "Not romantic - purely social greeting. Men do la bise with female friends but usually shake hands with other men.", formalityLevel: "casual" },
    { language: "french", category: "conversation", situation: "addressing someone", nuance: "Use 'vous' (formal you) with strangers, elders, professionals. 'Tu' is for friends, family, children. Getting it wrong is a faux pas.", explanation: "When in doubt, use vous. The person may offer 'on peut se tutoyer' to switch to tu.", formalityLevel: "formal" },
    { language: "french", category: "dining", situation: "restaurant etiquette", nuance: "Bread goes directly on the table, not on a plate. Hands should stay visible on the table (not on lap).", explanation: "Keeping hands visible dates back to showing you're not hiding weapons. Breaking bread properly shows good manners.", formalityLevel: "formal" },
    { language: "french", category: "conversation", situation: "small talk", nuance: "The French don't smile at strangers or do 'How are you?' with cashiers. This isn't rudeness - it's normal.", explanation: "Smiling without reason can seem fake. Save warmth for people you actually know.", formalityLevel: "casual" },
  ];
  
  const frenchErrorPatterns = [
    { targetLanguage: "french", sourceLanguage: "english", errorCategory: "grammar", specificError: "gender_agreement", whyItHappens: "English has no grammatical gender. Every French noun is masculine or feminine, affecting articles and adjectives.", teachingStrategies: ["Learn nouns with their articles (le/la)", "Look for patterns: -tion words are feminine, -age words are masculine", "Practice agreement: une grande maison, un grand jardin"], exampleMistakes: ["le maison (wrong)", "un table (wrong)"], correctForms: ["la maison", "une table"], actflLevel: "novice_mid", priority: "common" },
    { targetLanguage: "french", sourceLanguage: "english", errorCategory: "pronunciation", specificError: "silent_letters", whyItHappens: "French has many silent final consonants. English speakers tend to pronounce everything.", teachingStrategies: ["Learn the 'CaReFuL' rule - C, R, F, L are often pronounced at the end", "Practice: temps, beaucoup, vous, est", "Listen and repeat native speakers"], exampleMistakes: ["pronouncing the 's' in 'vous'", "pronouncing 'ent' in verb endings"], correctForms: ["vous [voo]", "ils parlent [parl]"], actflLevel: "novice_low", priority: "common" },
    { targetLanguage: "french", sourceLanguage: "english", errorCategory: "grammar", specificError: "negation_structure", whyItHappens: "French uses two-part negation (ne...pas) while English uses one word.", teachingStrategies: ["Think 'ne' as the warning, 'pas' as the stop sign", "Practice: Je ne sais pas, Je n'ai pas, Il n'est pas", "In casual speech, 'ne' often drops but 'pas' stays"], exampleMistakes: ["Je pas mange (wrong)", "Je ne mange (incomplete)"], correctForms: ["Je ne mange pas"], actflLevel: "novice_mid", priority: "common" },
  ];
  
  const frenchDialects = [
    { language: "french", region: "Quebec", category: "pronunciation", standardForm: "Je suis", regionalForm: "Chu", explanation: "Quebecois French contracts heavily. 'Je suis' becomes 'Chu' in casual speech.", usageNotes: "This is normal Quebecois - not 'bad French'. Understanding it takes practice." },
    { language: "french", region: "Belgium", category: "vocabulary", standardForm: "soixante-dix (70)", regionalForm: "septante", explanation: "Belgian French uses simpler number words. 70=septante, 90=nonante (not soixante-dix, quatre-vingt-dix).", usageNotes: "More logical! Swiss French also uses septante and nonante." },
    { language: "french", region: "France", category: "vocabulary", standardForm: "petit-déjeuner", regionalForm: "déjeuner (breakfast)", explanation: "In some regions and in Belgian French, 'déjeuner' means breakfast, 'dîner' means lunch, 'souper' means dinner.", usageNotes: "In standard Parisian French: petit-déjeuner (breakfast), déjeuner (lunch), dîner (dinner)." },
  ];
  
  const englishFrenchBridges = [
    { sourceLanguage: "english", targetLanguage: "french", bridgeType: "cognate", sourceWord: "different", targetWord: "différent", relationship: "same_meaning", explanation: "-ent endings are often identical", teachingNote: "Pattern: patient→patient, evident→évident, intelligent→intelligent" },
    { sourceLanguage: "english", targetLanguage: "french", bridgeType: "cognate", sourceWord: "nation", targetWord: "nation", relationship: "same_meaning", explanation: "-tion words are almost always the same in both languages", teachingNote: "Huge vocabulary boost: information, situation, education, etc." },
    { sourceLanguage: "english", targetLanguage: "french", bridgeType: "false_friend", sourceWord: "attendre", targetWord: "to wait", relationship: "different_meaning", explanation: "Looks like 'attend' but means 'to wait'. To attend = assister à.", teachingNote: "J'attends le bus = I'm waiting for the bus, NOT I'm attending the bus" },
    { sourceLanguage: "english", targetLanguage: "french", bridgeType: "false_friend", sourceWord: "blessé", targetWord: "injured", relationship: "different_meaning", explanation: "Looks like 'blessed' but means 'injured'. Blessed = béni.", teachingNote: "Il est blessé = He is injured, NOT He is blessed" },
  ];
  
  await db.insert(languageIdioms).values(frenchIdioms);
  await db.insert(culturalNuances).values(frenchCulturalNuances);
  await db.insert(learnerErrorPatterns).values(frenchErrorPatterns);
  await db.insert(dialectVariations).values(frenchDialects);
  await db.insert(linguisticBridges).values(englishFrenchBridges);
  console.log("[Neural Network Seed] Inserted French data");
}

// ===== GERMAN =====
async function seedGerman(seededLanguages: Set<string>) {
  if (seededLanguages.has("german")) return;
  
  const germanIdioms = [
    { language: "german", idiom: "Da steppt der Bär", literalTranslation: "The bear is dancing there", meaning: "It's going to be a great party", culturalContext: "Bears dancing = exciting entertainment", usageExamples: ["Auf der Party steppt der Bär!", "Heute Abend steppt der Bär."], registerLevel: "casual" },
    { language: "german", idiom: "Ich verstehe nur Bahnhof", literalTranslation: "I only understand train station", meaning: "I don't understand anything", culturalContext: "WWI soldiers focused only on 'Bahnhof' (going home by train)", usageExamples: ["Er erklärt Physik, aber ich verstehe nur Bahnhof.", "Verstehst du das? - Nein, ich verstehe nur Bahnhof."], registerLevel: "casual" },
    { language: "german", idiom: "Die Daumen drücken", literalTranslation: "To press the thumbs", meaning: "To keep one's fingers crossed", culturalContext: "German equivalent of crossing fingers for luck", usageExamples: ["Ich drücke dir die Daumen!", "Drück mir die Daumen für morgen."], registerLevel: "casual" },
    { language: "german", idiom: "Das ist nicht mein Bier", literalTranslation: "That's not my beer", meaning: "That's not my problem/business", culturalContext: "Germans take their beer seriously - what's not your beer isn't your concern", usageExamples: ["Das ist nicht mein Bier.", "Was er macht, ist nicht mein Bier."], registerLevel: "casual" },
    { language: "german", idiom: "Schwein haben", literalTranslation: "To have pig", meaning: "To be lucky", culturalContext: "Pigs were symbols of wealth and luck in Germanic tradition", usageExamples: ["Du hast Schwein gehabt!", "Wir hatten Schwein beim Wetter."], registerLevel: "casual" },
  ];
  
  const germanCulturalNuances = [
    { language: "german", category: "greetings", situation: "meeting someone", nuance: "Germans shake hands firmly. Maintain eye contact during toast (Prost!). Looking away is considered rude or even bad luck.", explanation: "Eye contact shows respect and sincerity. The handshake should be brief but firm.", formalityLevel: "formal" },
    { language: "german", category: "time", situation: "punctuality", nuance: "Pünktlichkeit is sacred. Being even 5 minutes late is rude. For business, arrive 5-10 minutes early.", explanation: "German efficiency culture. Being late shows disrespect for others' time.", formalityLevel: "formal" },
    { language: "german", category: "conversation", situation: "directness", nuance: "Germans are direct. 'Your idea won't work' isn't rude - it's honest feedback. Don't take it personally.", explanation: "German communication values clarity over diplomacy. This isn't rudeness.", formalityLevel: "neutral" },
    { language: "german", category: "dining", situation: "table manners", nuance: "Keep hands visible on table. Say 'Guten Appetit' before eating. Wait for everyone to have food.", explanation: "Starting before others is impolite. The host or eldest often gives the signal to begin.", formalityLevel: "formal" },
  ];
  
  const germanErrorPatterns = [
    { targetLanguage: "german", sourceLanguage: "english", errorCategory: "grammar", specificError: "word_order_v2", whyItHappens: "German has V2 (verb-second) rule - the conjugated verb must be second in main clauses, regardless of what comes first.", teachingStrategies: ["Subject-Verb inversion after adverbs: Heute gehe ICH", "Time-Manner-Place order for other elements", "Verb stays second even with long first elements"], exampleMistakes: ["Heute ich gehe (wrong)", "Morgen wir spielen (wrong)"], correctForms: ["Heute gehe ich", "Morgen spielen wir"], actflLevel: "novice_high", priority: "common" },
    { targetLanguage: "german", sourceLanguage: "english", errorCategory: "grammar", specificError: "case_system", whyItHappens: "German has 4 cases (nominative, accusative, dative, genitive) affecting articles and pronouns. English mostly dropped cases.", teachingStrategies: ["Start with accusative (direct object): den/einen for masculine", "Learn verbs that take dative: helfen, geben, danken", "Memorize preposition cases: mit + dative, für + accusative"], exampleMistakes: ["Ich sehe der Mann (wrong)", "Ich helfe du (wrong)"], correctForms: ["Ich sehe den Mann", "Ich helfe dir"], actflLevel: "intermediate_low", priority: "common" },
    { targetLanguage: "german", sourceLanguage: "english", errorCategory: "pronunciation", specificError: "ch_sound", whyItHappens: "German 'ch' has two sounds (ich-Laut and ach-Laut) that don't exist in English.", teachingStrategies: ["After e, i, ä, ö, ü, consonants: soft 'ich' sound (like 'sh' but further back)", "After a, o, u, au: harsh 'ach' sound (like Scottish 'loch')", "Practice: ich vs. ach, Mädchen vs. machen"], exampleMistakes: ["Pronouncing 'ich' like 'ick'", "Using English 'k' for 'ch'"], correctForms: ["ich [ɪç]", "ach [ax]"], actflLevel: "novice_mid", priority: "common" },
  ];
  
  const germanDialects = [
    { language: "german", region: "Austria", category: "greetings", standardForm: "Guten Tag", regionalForm: "Grüß Gott / Servus", explanation: "Austria uses different greetings. 'Grüß Gott' (God greet you) is formal, 'Servus' is casual.", usageNotes: "Also used in Bavaria. 'Servus' can mean both hello and goodbye." },
    { language: "german", region: "Switzerland", category: "vocabulary", standardForm: "Fahrrad", regionalForm: "Velo", explanation: "Swiss German uses many French loanwords. Velo (from vélocipède) = bicycle.", usageNotes: "Swiss German (Schweizerdeutsch) is very different from standard German - almost a different language in speech." },
    { language: "german", region: "Bavaria", category: "pronunciation", standardForm: "Ich bin", regionalForm: "I bin", explanation: "Bavarian dialect drops the 'ch' from 'ich' and has different vowel sounds.", usageNotes: "Standard German is used in writing; Bavarian is spoken. Very distinct from northern German." },
  ];
  
  const englishGermanBridges = [
    { sourceLanguage: "english", targetLanguage: "german", bridgeType: "cognate", sourceWord: "house", targetWord: "Haus", relationship: "same_meaning", explanation: "English and German share Germanic roots", teachingNote: "Pattern: mouse→Maus, louse→Laus, out→aus" },
    { sourceLanguage: "english", targetLanguage: "german", bridgeType: "cognate", sourceWord: "water", targetWord: "Wasser", relationship: "same_meaning", explanation: "Many basic words are similar", teachingNote: "Pattern: father→Vater, mother→Mutter, brother→Bruder" },
    { sourceLanguage: "english", targetLanguage: "german", bridgeType: "false_friend", sourceWord: "gift", targetWord: "Gift", relationship: "different_meaning", explanation: "German 'Gift' means POISON, not present. A present = Geschenk.", teachingNote: "Critical to know! Offering a 'Gift' in German is NOT a nice gesture!" },
    { sourceLanguage: "english", targetLanguage: "german", bridgeType: "false_friend", sourceWord: "bekommen", targetWord: "to get/receive", relationship: "different_meaning", explanation: "Looks like 'become' but means 'to get/receive'. To become = werden.", teachingNote: "Ich bekomme ein Buch = I receive a book, NOT I become a book" },
  ];
  
  await db.insert(languageIdioms).values(germanIdioms);
  await db.insert(culturalNuances).values(germanCulturalNuances);
  await db.insert(learnerErrorPatterns).values(germanErrorPatterns);
  await db.insert(dialectVariations).values(germanDialects);
  await db.insert(linguisticBridges).values(englishGermanBridges);
  console.log("[Neural Network Seed] Inserted German data");
}

// ===== ITALIAN =====
async function seedItalian(seededLanguages: Set<string>) {
  if (seededLanguages.has("italian")) return;
  
  const italianIdioms = [
    { language: "italian", idiom: "In bocca al lupo", literalTranslation: "In the mouth of the wolf", meaning: "Good luck", culturalContext: "Response must be 'Crepi il lupo!' (May the wolf die). Never say 'grazie' - it's bad luck!", usageExamples: ["In bocca al lupo per l'esame!", "In bocca al lupo! - Crepi!"], registerLevel: "casual" },
    { language: "italian", idiom: "Non vedo l'ora", literalTranslation: "I don't see the hour", meaning: "I can't wait", culturalContext: "Time is moving too slowly because you're so excited", usageExamples: ["Non vedo l'ora di vederti!", "Non vedo l'ora che arrivi l'estate."], registerLevel: "casual" },
    { language: "italian", idiom: "Avere le mani in pasta", literalTranslation: "To have hands in the dough", meaning: "To be involved in something / have inside knowledge", culturalContext: "Food metaphors are central to Italian expressions", usageExamples: ["Lui ha le mani in pasta in quell'affare.", "Vuoi sapere cosa succede? Lei ha le mani in pasta."], registerLevel: "casual" },
    { language: "italian", idiom: "Costare un occhio della testa", literalTranslation: "To cost an eye from the head", meaning: "To cost an arm and a leg", culturalContext: "Similar to Spanish - eye = extreme value", usageExamples: ["Questa borsa costa un occhio della testa!", "Il ristorante costa un occhio della testa."], registerLevel: "casual" },
  ];
  
  const italianCulturalNuances = [
    { language: "italian", category: "greetings", situation: "meeting friends", nuance: "Two kisses on cheeks (right cheek first) between all genders. Close friends may use three. Hugs are for very close relationships.", explanation: "Men kissing men is normal among friends - not just family.", formalityLevel: "casual" },
    { language: "italian", category: "dining", situation: "coffee culture", nuance: "Cappuccino is ONLY for breakfast. Ordering after 11am marks you as a tourist. Espresso is for any time.", explanation: "Italians believe milk is for morning digestion. Afternoon cappuccino is almost offensive.", formalityLevel: "casual" },
    { language: "italian", category: "gestures", situation: "hand gestures", nuance: "Italians use many hand gestures as part of speech. The 'pinched fingers' gesture means 'What do you want?' or 'What are you saying?'", explanation: "Gestures are part of grammar, not just emphasis. Learning them helps understanding.", formalityLevel: "casual" },
    { language: "italian", category: "time", situation: "daily schedule", nuance: "Lunch is 1-3pm, dinner is 8-10pm. Many shops close 1-4pm for riposo. Eating dinner at 6pm is very unusual.", explanation: "Italian schedule centers around long meals. Rushing meals is against the culture.", formalityLevel: "casual" },
  ];
  
  const italianErrorPatterns = [
    { targetLanguage: "italian", sourceLanguage: "english", errorCategory: "grammar", specificError: "double_negative", whyItHappens: "Italian requires double negatives. 'Non ho niente' (I don't have nothing) is correct, not 'Ho niente'.", teachingStrategies: ["Non + verb + negative word: non...niente, non...mai, non...nessuno", "Practice: Non vedo nessuno, Non faccio niente, Non vado mai"], exampleMistakes: ["Ho niente (wrong)", "Vedo nessuno (wrong)"], correctForms: ["Non ho niente", "Non vedo nessuno"], actflLevel: "novice_high", priority: "common" },
    { targetLanguage: "italian", sourceLanguage: "english", errorCategory: "grammar", specificError: "article_with_possessive", whyItHappens: "Italian uses articles before possessives: LA mia casa. Exception: singular family members without article.", teachingStrategies: ["Default: article + possessive: il mio libro, la tua casa", "Exception for family: mia madre, mio padre (singular, no article)", "But plural family takes article: i miei genitori"], exampleMistakes: ["Mio libro (wrong)", "La mia madre (technically acceptable but less common)"], correctForms: ["Il mio libro", "Mia madre"], actflLevel: "novice_high", priority: "common" },
    { targetLanguage: "italian", sourceLanguage: "english", errorCategory: "pronunciation", specificError: "double_consonants", whyItHappens: "Italian distinguishes between single and double consonants. English doesn't have this feature.", teachingStrategies: ["Double consonants are held longer: pala vs palla, caro vs carro", "Meaning changes: pena (pain) vs penna (pen)", "Practice minimal pairs"], exampleMistakes: ["'Penna' pronounced like 'pena'", "'Anno' pronounced like 'ano'"], correctForms: ["penna [pen-na]", "anno [an-no]"], actflLevel: "novice_mid", priority: "common" },
  ];
  
  const italianDialects = [
    { language: "italian", region: "Naples", category: "vocabulary", standardForm: "ragazzo", regionalForm: "guaglione", explanation: "Neapolitan has distinct vocabulary. 'Guaglione' (boy/guy) is widely used in southern Italy.", usageNotes: "Neapolitan is sometimes considered a separate language. Standard Italian is used formally." },
    { language: "italian", region: "Rome", category: "pronunciation", standardForm: "che cosa", regionalForm: "che ccosa", explanation: "Roman accent doubles consonants after stressed syllables, especially 'c'.", usageNotes: "Roman dialect (romanesco) is famous from movies. Very expressive." },
    { language: "italian", region: "Milan", category: "vocabulary", standardForm: "lavorare", regionalForm: "laurà", explanation: "Milanese dialect shortens words and has different verb forms.", usageNotes: "Northern dialects influenced by French/German. Different from southern dialects." },
  ];
  
  const englishItalianBridges = [
    { sourceLanguage: "english", targetLanguage: "italian", bridgeType: "cognate", sourceWord: "important", targetWord: "importante", relationship: "same_meaning", explanation: "-ant → -ante pattern", teachingNote: "Pattern: elegant→elegante, distant→distante, instant→istante" },
    { sourceLanguage: "english", targetLanguage: "italian", bridgeType: "cognate", sourceWord: "nation", targetWord: "nazione", relationship: "same_meaning", explanation: "-tion → -zione pattern", teachingNote: "Massive vocabulary: station→stazione, action→azione, emotion→emozione" },
    { sourceLanguage: "english", targetLanguage: "italian", bridgeType: "false_friend", sourceWord: "camera", targetWord: "room", relationship: "different_meaning", explanation: "Italian 'camera' means room. A camera = macchina fotografica.", teachingNote: "La mia camera = My room, NOT My camera" },
    { sourceLanguage: "english", targetLanguage: "italian", bridgeType: "false_friend", sourceWord: "magazzino", targetWord: "warehouse", relationship: "different_meaning", explanation: "Looks like 'magazine' but means warehouse. Magazine = rivista.", teachingNote: "Lavoro in un magazzino = I work in a warehouse" },
  ];
  
  await db.insert(languageIdioms).values(italianIdioms);
  await db.insert(culturalNuances).values(italianCulturalNuances);
  await db.insert(learnerErrorPatterns).values(italianErrorPatterns);
  await db.insert(dialectVariations).values(italianDialects);
  await db.insert(linguisticBridges).values(englishItalianBridges);
  console.log("[Neural Network Seed] Inserted Italian data");
}

// ===== PORTUGUESE =====
async function seedPortuguese(seededLanguages: Set<string>) {
  if (seededLanguages.has("portuguese")) return;
  
  const portugueseIdioms = [
    { language: "portuguese", idiom: "Ficar de boca aberta", literalTranslation: "To stay with open mouth", meaning: "To be amazed/speechless", culturalContext: "Universal expression of shock or wonder", usageExamples: ["Fiquei de boca aberta com a notícia.", "Ele ficou de boca aberta quando viu o presente."], registerLevel: "casual" },
    { language: "portuguese", idiom: "Pagar mico", literalTranslation: "To pay monkey", meaning: "To embarrass yourself publicly", culturalContext: "Brazilian expression - making a fool of yourself", usageExamples: ["Paguei o maior mico na festa.", "Não quero pagar mico na frente dos colegas."], registerLevel: "casual", region: "Brazil" },
    { language: "portuguese", idiom: "Engolir sapos", literalTranslation: "To swallow frogs", meaning: "To put up with unpleasant situations", culturalContext: "Having to accept things you don't like without complaining", usageExamples: ["Tive que engolir muitos sapos nesse emprego.", "Ela engole sapos para manter a paz."], registerLevel: "casual" },
    { language: "portuguese", idiom: "Dar com os burros n'água", literalTranslation: "To end up with donkeys in water", meaning: "To fail completely / have plans go wrong", culturalContext: "From the image of a failed river crossing", usageExamples: ["Tentamos o negócio, mas demos com os burros n'água.", "Vai dar com os burros n'água se continuar assim."], registerLevel: "casual" },
  ];
  
  const portugueseCulturalNuances = [
    { language: "portuguese", category: "greetings", situation: "meeting someone", nuance: "Brazil: 1-2 kisses depending on region (São Paulo: 1, Rio: 2). Portugal: 2 kisses. Always start with right cheek.", explanation: "Kissing is standard greeting between women and mixed genders. Men shake hands or hug.", formalityLevel: "casual" },
    { language: "portuguese", category: "conversation", situation: "addressing someone", nuance: "Brazil uses 'você' almost exclusively. Portugal uses 'tu' casually and 'você' formally (but be careful - 'você' can seem cold in some contexts).", explanation: "Portuguese Portuguese prefers 'tu' among friends; 'você' can sound distant. Brazilian Portuguese uses 'você' universally.", formalityLevel: "casual" },
    { language: "portuguese", category: "time", situation: "punctuality", nuance: "Brazilian time is flexible for social events. 'Vou chegar às 8' might mean 9. Portugal is more punctual, closer to other European countries.", explanation: "Business meetings require punctuality everywhere. Social flexibility varies.", formalityLevel: "casual", region: "Brazil" },
  ];
  
  const portugueseErrorPatterns = [
    { targetLanguage: "portuguese", sourceLanguage: "english", errorCategory: "grammar", specificError: "ser_estar_confusion", whyItHappens: "Like Spanish, Portuguese has two 'to be' verbs. Ser = permanent, Estar = temporary/location.", teachingStrategies: ["Same rules as Spanish: ser for identity, estar for state/location", "Practice pairs: Ele é médico (identity) vs Ele está doente (current state)", "Location uses estar: Onde está o banco?"], exampleMistakes: ["Eu sou cansado (wrong)", "Ela é aqui (wrong)"], correctForms: ["Eu estou cansado", "Ela está aqui"], actflLevel: "novice_mid", priority: "common" },
    { targetLanguage: "portuguese", sourceLanguage: "english", errorCategory: "pronunciation", specificError: "nasal_vowels", whyItHappens: "Portuguese has nasal vowels (ã, õ) that don't exist in English. Written with tilde or before m/n.", teachingStrategies: ["Practice 'ão' - not 'ow', more like French 'on' but through nose", "Words ending in -m nasalize: bom, com, sem", "Listen to 'pão' vs 'pau' - meaning changes!"], exampleMistakes: ["Pronouncing 'pão' like 'pow'", "Not nasalizing 'bem', 'sem'"], correctForms: ["pão [pɐ̃w̃]", "bem [bẽj̃]"], actflLevel: "novice_mid", priority: "common" },
    { targetLanguage: "portuguese", sourceLanguage: "english", errorCategory: "grammar", specificError: "personal_infinitive", whyItHappens: "Portuguese uniquely has conjugated infinitives. Instead of 'for us to go' it's 'para irmos' (infinitive with -mos ending).", teachingStrategies: ["Used after prepositions when subjects differ", "Practice: para eu fazer, para nós fazermos, para eles fazerem", "Common with: para, antes de, depois de, ao"], exampleMistakes: ["Para nós ir (wrong)", "Antes de eu sair (can be personal: sair or saír, depending on dialect)"], correctForms: ["Para nós irmos", "Antes de eu sair/sair eu"], actflLevel: "intermediate_low", priority: "uncommon" },
  ];
  
  const portugueseDialects = [
    { language: "portuguese", region: "Brazil", category: "pronunciation", standardForm: "de", regionalForm: "dji", explanation: "Brazilian Portuguese often pronounces 'd' before 'i/e' as 'dj' and 't' as 'tch'.", usageNotes: "So 'dia' sounds like 'djia' and 'tia' sounds like 'tchia'. Very distinctive Brazilian sound." },
    { language: "portuguese", region: "Portugal", category: "vocabulary", standardForm: "ônibus (Brazil)", regionalForm: "autocarro", explanation: "Many vocabulary differences: trem/comboio, celular/telemóvel, banheiro/casa de banho.", usageNotes: "Like British vs American English - both understood, but different words for many things." },
    { language: "portuguese", region: "Brazil", category: "grammar", standardForm: "Estou fazendo", regionalForm: "Estou a fazer (Portugal)", explanation: "Brazil uses gerund (-ndo), Portugal uses 'a + infinitive' for ongoing actions.", usageNotes: "Both are correct: 'Estou trabalhando' (Brazil) = 'Estou a trabalhar' (Portugal)" },
  ];
  
  const englishPortugueseBridges = [
    { sourceLanguage: "english", targetLanguage: "portuguese", bridgeType: "cognate", sourceWord: "family", targetWord: "família", relationship: "same_meaning", explanation: "Latin roots shared with English", teachingNote: "Pattern: history→história, memory→memória, victory→vitória" },
    { sourceLanguage: "english", targetLanguage: "portuguese", bridgeType: "cognate", sourceWord: "important", targetWord: "importante", relationship: "same_meaning", explanation: "-ant → -ante pattern", teachingNote: "Pattern: different→diferente, elegant→elegante" },
    { sourceLanguage: "english", targetLanguage: "portuguese", bridgeType: "false_friend", sourceWord: "pretender", targetWord: "to intend", relationship: "different_meaning", explanation: "'Pretender' means 'to intend/plan'. To pretend = fingir.", teachingNote: "Pretendo ir = I intend to go, NOT I pretend to go" },
    { sourceLanguage: "english", targetLanguage: "portuguese", bridgeType: "false_friend", sourceWord: "puxar", targetWord: "to pull", relationship: "different_meaning", explanation: "Looks like 'push' but means 'pull'! To push = empurrar.", teachingNote: "Door signs: 'Puxe' = Pull, 'Empurre' = Push - classic trap!" },
  ];
  
  await db.insert(languageIdioms).values(portugueseIdioms);
  await db.insert(culturalNuances).values(portugueseCulturalNuances);
  await db.insert(learnerErrorPatterns).values(portugueseErrorPatterns);
  await db.insert(dialectVariations).values(portugueseDialects);
  await db.insert(linguisticBridges).values(englishPortugueseBridges);
  console.log("[Neural Network Seed] Inserted Portuguese data");
}

// ===== JAPANESE =====
async function seedJapanese(seededLanguages: Set<string>) {
  if (seededLanguages.has("japanese")) return;
  
  const japaneseIdioms = [
    { language: "japanese", idiom: "猫の手も借りたい (neko no te mo karitai)", literalTranslation: "Want to borrow even a cat's paws", meaning: "Extremely busy / need all the help I can get", culturalContext: "Cats are seen as unhelpful, so wanting even their help shows desperation", usageExamples: ["年末は猫の手も借りたいほど忙しい。", "このプロジェクトは猫の手も借りたい状況だ。"], registerLevel: "casual" },
    { language: "japanese", idiom: "花より団子 (hana yori dango)", literalTranslation: "Dumplings over flowers", meaning: "Substance over style / practicality over beauty", culturalContext: "Choosing tasty dumplings over beautiful cherry blossoms at hanami", usageExamples: ["彼女は花より団子タイプだ。", "お花見でも花より団子で、食べてばかり。"], registerLevel: "casual" },
    { language: "japanese", idiom: "七転び八起き (nana korobi ya oki)", literalTranslation: "Fall seven times, get up eight", meaning: "Perseverance / never give up", culturalContext: "Core Japanese value of resilience", usageExamples: ["七転び八起きの精神で頑張ろう。", "人生は七転び八起きだ。"], registerLevel: "neutral" },
    { language: "japanese", idiom: "空気を読む (kuuki wo yomu)", literalTranslation: "To read the air", meaning: "To sense the atmosphere / read between the lines", culturalContext: "Essential Japanese social skill - understanding unspoken communication", usageExamples: ["彼は空気を読めない。", "空気を読んで、黙っていた。"], registerLevel: "casual" },
  ];
  
  const japaneseCulturalNuances = [
    { language: "japanese", category: "greetings", situation: "bowing", nuance: "Bowing depth shows respect level. Slight nod (15°) for casual greetings, 30° for respect, 45° for deep apology or reverence.", explanation: "Don't bow and shake hands simultaneously. Match the other person's bow depth.", formalityLevel: "formal" },
    { language: "japanese", category: "conversation", situation: "saying no", nuance: "Direct 'no' (いいえ) is rarely used. Japanese prefer indirect refusals: 'It's difficult' (難しいです), 'I'll think about it' (考えておきます).", explanation: "Preserving harmony (和) means avoiding direct confrontation or refusal.", formalityLevel: "formal" },
    { language: "japanese", category: "business", situation: "business cards", nuance: "Exchange cards (meishi) with both hands, facing recipient. Study the card respectfully before putting it in a card holder, never pocket.", explanation: "The card represents the person. Treating it carelessly is treating THEM carelessly.", formalityLevel: "formal" },
    { language: "japanese", category: "dining", situation: "chopstick etiquette", nuance: "Never stick chopsticks upright in rice (funeral ritual). Don't pass food chopstick-to-chopstick (bone-passing ritual). Don't point with chopsticks.", explanation: "These actions are associated with death/funerals and are considered very taboo.", formalityLevel: "formal" },
  ];
  
  const japaneseErrorPatterns = [
    { targetLanguage: "japanese", sourceLanguage: "english", errorCategory: "grammar", specificError: "particle_wa_ga", whyItHappens: "English has no equivalent to topic (は) vs subject (が) distinction. Both often translate as the subject.", teachingStrategies: ["は marks 'as for X...' (topic under discussion)", "が marks new information or specific subject", "Practice: 私は学生です (I am a student - about me) vs 誰が来た？ 田中さんが来た (Who came? Tanaka came - new info)"], exampleMistakes: ["私が学生です (sounds like answering 'Who is the student?')", "Using は for answers to question words"], correctForms: ["私は学生です (neutral statement)", "田中さんが来ました (answering 'who')"], actflLevel: "novice_high", priority: "common" },
    { targetLanguage: "japanese", sourceLanguage: "english", errorCategory: "grammar", specificError: "verb_position", whyItHappens: "Japanese is SOV (Subject-Object-Verb). English is SVO. The verb must come at the end.", teachingStrategies: ["Think: Subject は Object を Verb", "Practice building sentences backwards from English", "Time words can go early: 昨日、私は本を読みました"], exampleMistakes: ["私は読みました本を (wrong order)", "私は本を読みました昨日 (wrong - time shouldn't end)"], correctForms: ["私は本を読みました", "昨日、私は本を読みました"], actflLevel: "novice_mid", priority: "common" },
    { targetLanguage: "japanese", sourceLanguage: "english", errorCategory: "politeness", specificError: "keigo_levels", whyItHappens: "Japanese has complex politeness levels (casual, polite, humble, honorific). English has few equivalents.", teachingStrategies: ["Start with です/ます form (polite) - safe default", "Humble forms (謙譲語) for YOUR actions to superiors", "Honorific forms (尊敬語) for THEIR actions", "Don't mix levels in one sentence"], exampleMistakes: ["Using casual form with strangers", "Using honorific for your own actions"], correctForms: ["いらっしゃいます (honorific - they come)", "参ります (humble - I go)"], actflLevel: "intermediate_mid", priority: "common" },
  ];
  
  const japaneseDialects = [
    { language: "japanese", region: "Osaka/Kansai", category: "vocabulary", standardForm: "ありがとう", regionalForm: "おおきに", explanation: "Kansai dialect has unique expressions. 'Ookini' (thank you) is widely recognized.", usageNotes: "Kansai dialect is seen as friendly/funny. Many comedians use it." },
    { language: "japanese", region: "Osaka/Kansai", category: "grammar", standardForm: "〜ない (negative)", regionalForm: "〜へん", explanation: "Kansai negates verbs differently: 知らない → 知らへん, 食べない → 食べへん", usageNotes: "Very common in western Japan. You'll hear it in Osaka, Kyoto, Kobe." },
    { language: "japanese", region: "Tohoku", category: "pronunciation", standardForm: "寒い (samui)", regionalForm: "さむい → さび", explanation: "Tohoku dialects often modify vowels. Can be hard to understand for non-locals.", usageNotes: "Tohoku dialect is less commonly encountered but very distinctive." },
  ];
  
  const englishJapaneseBridges = [
    { sourceLanguage: "english", targetLanguage: "japanese", bridgeType: "loanword", sourceWord: "hotel", targetWord: "ホテル (hoteru)", relationship: "same_meaning", explanation: "Japanese has thousands of English loanwords (外来語)", teachingNote: "Pattern: コンピューター (computer), テレビ (TV), アパート (apartment)" },
    { sourceLanguage: "english", targetLanguage: "japanese", bridgeType: "loanword", sourceWord: "part-time job", targetWord: "アルバイト (arubaito)", relationship: "same_meaning", explanation: "From German 'Arbeit' (work) via English usage", teachingNote: "Some loanwords come from other European languages too" },
    { sourceLanguage: "english", targetLanguage: "japanese", bridgeType: "false_friend", sourceWord: "mansion", targetWord: "マンション (manshon)", relationship: "different_meaning", explanation: "Japanese 'mansion' = apartment/condo, not a large house.", teachingNote: "Many loanwords have shifted meanings. Mansion = regular apartment building." },
    { sourceLanguage: "english", targetLanguage: "japanese", bridgeType: "false_friend", sourceWord: "naive", targetWord: "ナイーブ (naiibu)", relationship: "different_meaning", explanation: "Japanese 'naive' = sensitive/delicate, not gullible.", teachingNote: "ナイーブな人 = A sensitive person, not a gullible person" },
  ];
  
  await db.insert(languageIdioms).values(japaneseIdioms);
  await db.insert(culturalNuances).values(japaneseCulturalNuances);
  await db.insert(learnerErrorPatterns).values(japaneseErrorPatterns);
  await db.insert(dialectVariations).values(japaneseDialects);
  await db.insert(linguisticBridges).values(englishJapaneseBridges);
  console.log("[Neural Network Seed] Inserted Japanese data");
}

// ===== MANDARIN =====
async function seedMandarin(seededLanguages: Set<string>) {
  if (seededLanguages.has("mandarin")) return;
  
  const mandarinIdioms = [
    { language: "mandarin", idiom: "马马虎虎 (mǎma hūhu)", literalTranslation: "Horse horse tiger tiger", meaning: "So-so / just okay / careless", culturalContext: "From a story about a painter who carelessly combined a horse and tiger", usageExamples: ["你好吗？马马虎虎。", "他做事总是马马虎虎的。"], registerLevel: "casual" },
    { language: "mandarin", idiom: "加油 (jiā yóu)", literalTranslation: "Add oil", meaning: "Go for it! / You can do it! / Keep it up!", culturalContext: "Universal encouragement phrase, possibly from adding fuel to a car", usageExamples: ["考试加油！", "加油！你一定行！"], registerLevel: "casual" },
    { language: "mandarin", idiom: "入乡随俗 (rù xiāng suí sú)", literalTranslation: "Enter village, follow customs", meaning: "When in Rome, do as the Romans do", culturalContext: "Confucian value of adapting to local customs", usageExamples: ["既然来了中国，就要入乡随俗。", "入乡随俗是很重要的。"], registerLevel: "neutral" },
    { language: "mandarin", idiom: "对牛弹琴 (duì niú tán qín)", literalTranslation: "Playing the lute to a cow", meaning: "Talking to someone who can't understand", culturalContext: "Wasting eloquence on an unappreciative audience", usageExamples: ["跟他解释这个，简直是对牛弹琴。", "别对牛弹琴了。"], registerLevel: "casual" },
  ];
  
  const mandarinCulturalNuances = [
    { language: "mandarin", category: "conversation", situation: "accepting compliments", nuance: "Deflect compliments with 'nǎlǐ nǎlǐ' (哪里哪里) or 'guòjiǎng' (过奖). Accepting directly seems arrogant.", explanation: "Modesty (谦虚) is valued. Saying 'thank you' to a compliment sounds boastful.", formalityLevel: "neutral" },
    { language: "mandarin", category: "numbers", situation: "lucky/unlucky numbers", nuance: "4 (sì 四) sounds like death (sǐ 死) - very unlucky. 8 (bā 八) sounds like prosperity (fā 发) - very lucky. Buildings skip floor 4.", explanation: "Phone numbers, addresses, prices with 8s are desirable. 4s are avoided.", formalityLevel: "neutral" },
    { language: "mandarin", category: "dining", situation: "paying the bill", nuance: "Expect a 'fight' over who pays. Offering to pay is expected; guests should insist several times but ultimately let host pay.", explanation: "Showing generosity through insisting on paying is part of giving 'face' (面子).", formalityLevel: "formal" },
    { language: "mandarin", category: "gifts", situation: "gift giving", nuance: "Never give clocks (送钟 sounds like 送终 'attending funeral'), knives (cutting ties), or white flowers (funeral). Red envelopes with money are always welcome.", explanation: "Gift symbolism is important. Even numbers in gifts are better (pairs = happiness).", formalityLevel: "formal" },
  ];
  
  const mandarinErrorPatterns = [
    { targetLanguage: "mandarin", sourceLanguage: "english", errorCategory: "pronunciation", specificError: "tones", whyItHappens: "Mandarin has 4 tones + neutral tone. Same syllable with different tones = completely different words.", teachingStrategies: ["mā (妈 mom) má (麻 hemp) mǎ (马 horse) mà (骂 scold)", "Use hand gestures to visualize tone contours", "Start with high-frequency tone pairs, not all at once", "Listen MORE than you speak initially"], exampleMistakes: ["Saying mǎ (horse) when meaning mā (mom)", "Flat tone for everything"], correctForms: ["妈 (mā) - high flat", "马 (mǎ) - falling-rising"], actflLevel: "novice_low", priority: "common" },
    { targetLanguage: "mandarin", sourceLanguage: "english", errorCategory: "grammar", specificError: "measure_words", whyItHappens: "Chinese requires measure words between numbers and nouns. English mostly doesn't (except 'a piece of').", teachingStrategies: ["Default: 个 (gè) works for most things when unsure", "Learn categories: 本 for books, 只 for animals, 张 for flat things", "Practice: 一个人, 两本书, 三只猫, 四张纸"], exampleMistakes: ["一书 (missing measure word)", "三人 (missing measure word)"], correctForms: ["一本书", "三个人"], actflLevel: "novice_mid", priority: "common" },
    { targetLanguage: "mandarin", sourceLanguage: "english", errorCategory: "grammar", specificError: "aspect_markers", whyItHappens: "Chinese doesn't conjugate verbs for tense. Instead, it uses aspect markers (了 le, 过 guo, 着 zhe) and time words.", teachingStrategies: ["了 indicates completed action or change of state", "过 indicates past experience ('have done before')", "Time words (昨天, 明天) provide context, not verb forms"], exampleMistakes: ["Trying to conjugate verbs like in English", "Overusing 了 for everything past"], correctForms: ["我昨天去了北京 (completed action)", "我去过北京 (have been before)"], actflLevel: "novice_high", priority: "common" },
  ];
  
  const mandarinDialects = [
    { language: "mandarin", region: "Taiwan", category: "vocabulary", standardForm: "出租车 (chūzūchē)", regionalForm: "计程车 (jìchéngchē)", explanation: "Taiwan uses different terms for many modern items. Taxi = 計程車 not 出租车.", usageNotes: "Taiwan also uses traditional characters, mainland uses simplified." },
    { language: "mandarin", region: "Taiwan", category: "pronunciation", standardForm: "这 (zhè)", regionalForm: "这 (zhèi)", explanation: "Taiwan pronunciation often adds extra vowel sounds. zhè → zhèi, nà → nèi.", usageNotes: "Both pronunciations are understood. Taiwan accent is distinct but not difficult." },
    { language: "mandarin", region: "Southern China", category: "pronunciation", standardForm: "Clear retroflex (zh, ch, sh, r)", regionalForm: "Merged with z, c, s", explanation: "Southern dialects often don't distinguish retroflex sounds. 'shi' may sound like 'si'.", usageNotes: "This is the most common accent variation. Standard Mandarin is based on Beijing dialect." },
  ];
  
  const englishMandarinBridges = [
    { sourceLanguage: "english", targetLanguage: "mandarin", bridgeType: "loanword", sourceWord: "coffee", targetWord: "咖啡 (kāfēi)", relationship: "same_meaning", explanation: "Sound borrowed from English/European languages", teachingNote: "Pattern: 沙发 (shāfā/sofa), 巧克力 (qiǎokèlì/chocolate)" },
    { sourceLanguage: "english", targetLanguage: "mandarin", bridgeType: "concept_parallel", sourceWord: "time is money", targetWord: "时间就是金钱", relationship: "similar_concept", explanation: "Some proverbs translate directly because concepts are universal", teachingNote: "Chinese also says 一寸光阴一寸金 (An inch of time is worth an inch of gold)" },
    { sourceLanguage: "english", targetLanguage: "mandarin", bridgeType: "grammar_parallel", sourceWord: "Subject + Verb + Object", targetWord: "主语 + 动词 + 宾语", relationship: "similar_structure", explanation: "Basic SVO word order is the same in both languages", teachingNote: "Unlike Japanese/Korean, Chinese word order is similar to English. 我吃饭 = I eat rice." },
  ];
  
  await db.insert(languageIdioms).values(mandarinIdioms);
  await db.insert(culturalNuances).values(mandarinCulturalNuances);
  await db.insert(learnerErrorPatterns).values(mandarinErrorPatterns);
  await db.insert(dialectVariations).values(mandarinDialects);
  await db.insert(linguisticBridges).values(englishMandarinBridges);
  console.log("[Neural Network Seed] Inserted Mandarin data");
}

// ===== KOREAN =====
async function seedKorean(seededLanguages: Set<string>) {
  if (seededLanguages.has("korean")) return;
  
  const koreanIdioms = [
    { language: "korean", idiom: "눈이 높다 (nuni nopda)", literalTranslation: "Eyes are high", meaning: "Having high standards (especially in dating)", culturalContext: "Looking 'up' means wanting better than what's available", usageExamples: ["그녀는 눈이 너무 높아.", "눈이 높아서 결혼을 못 해."], registerLevel: "casual" },
    { language: "korean", idiom: "식은 죽 먹기 (sigeun juk meokgi)", literalTranslation: "Eating cold porridge", meaning: "A piece of cake / very easy", culturalContext: "Cold porridge requires no effort - just eat it", usageExamples: ["이건 식은 죽 먹기야.", "그 시험은 식은 죽 먹기였어."], registerLevel: "casual" },
    { language: "korean", idiom: "발이 넓다 (bari neolda)", literalTranslation: "Feet are wide", meaning: "Well-connected / knows many people", culturalContext: "Wide feet = you've walked many places and met many people", usageExamples: ["그는 발이 넓어서 뭐든 해결해.", "서울에서 발이 넓은 사람이야."], registerLevel: "casual" },
    { language: "korean", idiom: "파이팅 (paiting)", literalTranslation: "Fighting", meaning: "You can do it! / Good luck! / Go for it!", culturalContext: "Borrowed from English but uniquely Korean in usage - universal encouragement", usageExamples: ["시험 파이팅!", "오늘도 파이팅!"], registerLevel: "casual" },
  ];
  
  const koreanCulturalNuances = [
    { language: "korean", category: "conversation", situation: "asking age", nuance: "Asking someone's age upon meeting is normal and expected. It determines the speech level you use.", explanation: "Age hierarchy is built into the language. You NEED to know relative age to speak properly.", formalityLevel: "neutral" },
    { language: "korean", category: "dining", situation: "drinking etiquette", nuance: "Pour drinks for others, not yourself. Turn away from elders when drinking. Accept drinks with two hands.", explanation: "Showing respect to elders is fundamental. Never pour your own drink or drink facing an elder.", formalityLevel: "formal" },
    { language: "korean", category: "addressing", situation: "using names", nuance: "Never use someone's name alone if they're older. Add 씨 (ssi) for peers, 선배님, 형/오빠/언니/누나 for older people based on gender.", explanation: "Just saying someone's name is rude. Always add appropriate title suffix.", formalityLevel: "formal" },
    { language: "korean", category: "greetings", situation: "bowing", nuance: "Bow when greeting, thanking, or apologizing. Deeper for more respect. A slight head nod for casual acquaintances.", explanation: "Similar to Japanese, but less formal in casual settings. Still important in business.", formalityLevel: "formal" },
  ];
  
  const koreanErrorPatterns = [
    { targetLanguage: "korean", sourceLanguage: "english", errorCategory: "grammar", specificError: "word_order_sov", whyItHappens: "Korean is SOV (Subject-Object-Verb). Verb must come at the end, opposite of English.", teachingStrategies: ["Think: I pizza eat (나는 피자를 먹어요)", "Time and place come early in sentence", "Particles mark roles, so order is somewhat flexible except verb-final"], exampleMistakes: ["나는 먹어요 피자를 (verb not final)"], correctForms: ["나는 피자를 먹어요"], actflLevel: "novice_mid", priority: "common" },
    { targetLanguage: "korean", sourceLanguage: "english", errorCategory: "grammar", specificError: "speech_levels", whyItHappens: "Korean has 7 speech levels based on formality and age. English has very few equivalents.", teachingStrategies: ["Start with 요 (yo) endings - polite but not stiff", "해요체 (haeyoche) for most situations", "Learn 반말 (banmal/casual) only for close friends your age or younger", "Always use formal with strangers, elders, in business"], exampleMistakes: ["Using 반말 with someone older", "Using super-formal with close friends"], correctForms: ["감사합니다 (formal thank you)", "고마워 (casual, only to close younger/same-age)"], actflLevel: "novice_high", priority: "common" },
    { targetLanguage: "korean", sourceLanguage: "english", errorCategory: "grammar", specificError: "subject_object_particles", whyItHappens: "Korean marks subjects (이/가) and objects (을/를) with particles. English uses word order instead.", teachingStrategies: ["이/가 after consonant/vowel marks subject", "을/를 after consonant/vowel marks object", "은/는 marks topic (different from subject!)", "Practice: 고양이가 생선을 먹어요 (The cat eats fish)"], exampleMistakes: ["Omitting particles entirely", "Using wrong particle for vowel/consonant"], correctForms: ["고양이가 (cat + subject)", "생선을 (fish + object)"], actflLevel: "novice_mid", priority: "common" },
  ];
  
  const koreanDialects = [
    { language: "korean", region: "Busan/Gyeongsang", category: "pronunciation", standardForm: "뭐 해? (mwo hae?)", regionalForm: "뭐 하노? (mwo hano?)", explanation: "Gyeongsang dialect has different intonation and sentence endings. Sounds more direct.", usageNotes: "Known for strong, direct speech. Often sounds aggressive to Seoul speakers but isn't." },
    { language: "korean", region: "Jeju", category: "vocabulary", standardForm: "어머니 (eomeoni)", regionalForm: "어멍 (eomeong)", explanation: "Jeju dialect is so different it's sometimes considered a separate language.", usageNotes: "Jeju dialect is dying out. Younger generation uses standard Korean." },
    { language: "korean", region: "Seoul/Standard", category: "pronunciation", standardForm: "Clear distinction of all sounds", regionalForm: "Standard basis", explanation: "Seoul dialect is the basis for standard Korean taught to foreigners.", usageNotes: "What you learn in textbooks. Most TV and formal speech uses this." },
  ];
  
  const englishKoreanBridges = [
    { sourceLanguage: "english", targetLanguage: "korean", bridgeType: "loanword", sourceWord: "computer", targetWord: "컴퓨터 (keompyuteo)", relationship: "same_meaning", explanation: "Many tech and modern words are English loanwords", teachingNote: "Pattern: 인터넷 (internet), 텔레비전 (television), 버스 (bus)" },
    { sourceLanguage: "english", targetLanguage: "korean", bridgeType: "konglish", sourceWord: "eye shopping", targetWord: "아이쇼핑 (aisyoping)", relationship: "korean_invention", explanation: "Konglish = English words used differently in Korean. 'Eye shopping' = window shopping", teachingNote: "Other Konglish: 핸드폰 (hand phone=cell), 노트북 (notebook=laptop)" },
    { sourceLanguage: "english", targetLanguage: "korean", bridgeType: "false_friend", sourceWord: "service", targetWord: "서비스 (seobiseu)", relationship: "different_meaning", explanation: "Korean 'service' usually means 'free extra' at restaurants/shops, not general service.", teachingNote: "서비스예요 = It's free/on the house, NOT This is good service" },
  ];
  
  await db.insert(languageIdioms).values(koreanIdioms);
  await db.insert(culturalNuances).values(koreanCulturalNuances);
  await db.insert(learnerErrorPatterns).values(koreanErrorPatterns);
  await db.insert(dialectVariations).values(koreanDialects);
  await db.insert(linguisticBridges).values(englishKoreanBridges);
  console.log("[Neural Network Seed] Inserted Korean data");
}

// ===== ENGLISH (for speakers of other languages learning English) =====
async function seedEnglish(seededLanguages: Set<string>) {
  if (seededLanguages.has("english")) return;
  
  const englishIdioms = [
    { language: "english", idiom: "Break a leg", literalTranslation: "Break a leg", meaning: "Good luck (especially before a performance)", culturalContext: "Theater superstition - saying 'good luck' is bad luck", usageExamples: ["Break a leg on your interview!", "You're going to do great - break a leg!"], registerLevel: "casual" },
    { language: "english", idiom: "It's raining cats and dogs", literalTranslation: "It's raining cats and dogs", meaning: "Raining very heavily", culturalContext: "Origin unclear - possibly from old thatched roofs where animals hid", usageExamples: ["Don't go out now - it's raining cats and dogs!", "We had to cancel because it was raining cats and dogs."], registerLevel: "casual" },
    { language: "english", idiom: "Bite the bullet", literalTranslation: "Bite the bullet", meaning: "To endure a painful situation with courage", culturalContext: "From soldiers biting bullets during surgery without anesthesia", usageExamples: ["I just had to bite the bullet and pay the bill.", "Sometimes you have to bite the bullet and do what's necessary."], registerLevel: "casual" },
    { language: "english", idiom: "The ball is in your court", literalTranslation: "The ball is in your court", meaning: "It's your turn to make a decision/move", culturalContext: "From tennis - the other player must now act", usageExamples: ["I've made my offer - the ball is in your court.", "The ball is in your court now."], registerLevel: "casual" },
  ];
  
  const englishCulturalNuances = [
    { language: "english", category: "conversation", situation: "small talk", nuance: "Americans/British expect 'How are you?' response to be brief and positive ('Good, thanks!'). It's not a real question about your feelings.", explanation: "This is a greeting ritual, not an inquiry. Long honest answers are awkward.", formalityLevel: "casual" },
    { language: "english", category: "personal_space", situation: "physical distance", nuance: "English speakers generally stand further apart than many cultures. Arm's length is comfortable. Closer feels intrusive.", explanation: "Personal bubble is larger. Step back if someone seems to be leaning away.", formalityLevel: "casual" },
    { language: "english", category: "dining", situation: "splitting bills", nuance: "In US, splitting the bill evenly or paying separately is normal among friends. In UK, buying 'rounds' at pubs is common.", explanation: "Don't insist on paying for everyone repeatedly - it can create awkward obligations.", formalityLevel: "casual" },
    { language: "english", category: "conversation", situation: "directness", nuance: "English speakers often soften requests: 'Would you mind...?', 'Could you possibly...?', 'I was wondering if...' Direct demands can seem rude.", explanation: "This isn't dishonesty - it's politeness. Learn these softening phrases.", formalityLevel: "formal" },
  ];
  
  const englishDialects = [
    { language: "english", region: "British", category: "vocabulary", standardForm: "apartment (US)", regionalForm: "flat", explanation: "Many vocabulary differences between American and British English.", usageNotes: "Also: elevator/lift, truck/lorry, cookie/biscuit, chips/crisps" },
    { language: "english", region: "British", category: "pronunciation", standardForm: "schedule (sked-yool)", regionalForm: "schedule (shed-yool)", explanation: "Pronunciation varies significantly between US and UK.", usageNotes: "Also different: aluminum/aluminium, herb (h-erb vs erb)" },
    { language: "english", region: "Australia", category: "vocabulary", standardForm: "afternoon", regionalForm: "arvo", explanation: "Australian English shortens many words with -o or -ie endings.", usageNotes: "Pattern: breakfast→brekkie, barbecue→barbie, afternoon→arvo" },
  ];
  
  await db.insert(languageIdioms).values(englishIdioms);
  await db.insert(culturalNuances).values(englishCulturalNuances);
  await db.insert(dialectVariations).values(englishDialects);
  console.log("[Neural Network Seed] Inserted English data");
}

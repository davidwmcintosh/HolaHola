/**
 * Spanish 1 Curriculum Restructuring Migration
 * 9 mega-chapters → 27 focused chapters
 *
 * Design spec: docs/curriculum-restructure-spanish1.md
 * Safe to re-run: checks for [ARCHIVED] prefix before archiving
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NEON_SHARED_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SPANISH1_PATH_ID = '60769ffc-6dcd-417e-add5-0ac612377da8';

// ── Existing lesson IDs (from schema-check) ──────────────────────────────────
const LESSONS = {
  // Unit 1 - Greetings
  activeProduction:    '169ad5dd-42de-4b24-a3f6-4224a9d190fe',
  classroomSurvival:   '7f6fb8f7-ed46-43dc-9b9c-a510e08562da',
  meetingNewPeople:    '5077485c-1d52-48bb-830d-a5dbef37ee16',
  miDiaDiario:         'ba2fa3d4-406d-479a-bb63-f7c13063288c',
  practiceGreetings:   'f9328483-817c-4e91-99b9-55cbef52a5a2',
  preguntasFaciles:    'cf3a0d97-97af-48aa-830a-589983e78367',

  // Unit 2 - Numbers
  laHora:              'b000180a-4fb0-4577-a66a-520820c06da5',
  practiceNumbers:     'c2b529b5-e3e1-4999-a20a-051e7d11feff',

  // Unit 3 - Family
  cultureCornerFamily: 'ac00415a-f7d3-4ce7-9c61-130d2fc65868',
  grammarAgreement:    '849d020f-761c-4d2d-b8c9-afe260ddacb1',
  birthdayCelebrations:'b80ef519-ed54-48a0-9a06-d6abe5a7102b',
  whoIsWho:            '2f4cb95d-541e-41ba-90d4-8078438f5e2b',
  meetTheFamily:       '362aaf97-6cf9-41fd-ba01-a649f5a565c5',

  // Unit 4 - School
  grammarArVerbs:      '6281ad64-3a48-4a54-ac5f-e30e9794894a',
  mySchedule:          '9fee889d-3876-4ce5-914e-bce4d1391dc7',
  schoolAroundWorld:   '11945002-e80c-43c2-ae3d-342cb636ebad',
  miProyectoCorto:     'b5f2a8dd-7fda-4bf6-a3dc-1893e26aa2dd',
  schoolSubjects:      '9b27bcb8-0297-4b7b-a5f6-e973ed3b5df9',
  schoolSupplies:      '656abcef-6f49-4fc6-baac-f2bc426b8a01',

  // Unit 5 - Hobbies
  cultureCornerMusic:  '686ab5a3-0e9b-418c-955c-185f0455003d',
  sportsTalk:          '2d192ad0-22ba-4060-8e65-b2f2cce4ff88',
  weekendPlans:        'd74176ec-86a7-48cb-96f3-5ba9e5abcc52',
  newWordsHobbies:     '5e4b751a-fe4b-4c57-b25b-bc8ed9895ce1',

  // Unit 6 - Food
  cultureCornerFood:   '16f36064-39d5-4584-a203-9226bbcced2b',
  grammarStemChangers: '65ca8990-d41b-4677-865d-aaf718b40bc3',
  restaurantOrdering:  '093e6ea5-d332-4230-8578-90c86d3190cb',
  newWordsDrinks:      '1771e04a-b9e4-428f-a0ed-be0da042153a',
  foodFavorites:       '12ffbea1-e3ee-4860-8775-0710ecad8042',

  // Unit 7 - Shopping
  descifrandoMensajes: '7af7d6ef-32a4-43cd-887d-d8a6c231397a',
  entendiendoConv:     'd73c4ce0-05dc-4a2d-9fb9-ad153ad2772b',
  atTheStore:          '6554f7d5-8576-4e83-9165-b63a3d9ccf7a',
  shoppingStories:     'cb079e77-6dd7-4508-9032-ac88fd26d4b0',
  clothingEssentials:  'e05c0d69-818e-43a7-88b0-02936df44597',
  colorsAndSizes:      '8c61130d-cb2f-4885-82fd-c13fa969b8c8',
  mensajesRapidos:     '88c0bde0-a8e3-4bb9-a355-88ef2620d70f',

  // Unit 8 - City
  cityLife:            'd2bb18fa-acc8-4b12-ab25-a9c81355597f',
  gettingAround:       '0e44e8bf-8490-4dce-a381-724182f0f862',
  givingDirections:    '0bc7443d-b4dd-4c67-8f45-d0f925ad2d09',
  placesInTown:        '6561f7b7-a6be-470c-ae79-48e1144cdf77',

  // Unit 9 - Travel
  dreamDestinations:   '13e783b7-52aa-4a5a-b7f5-4e5a6ca1925a',
  hotelCheckIn:        'a9015f2f-ddbf-47de-b1f5-4dd9ad290317',
  weatherTalk:         '54cfe33e-f23f-48a6-af37-ae01ddc2c9cf',
  travelEssentials:    '65e47b2e-1dd6-49cd-be7a-f367acfcad9c',
};

// ── New chapter definitions ───────────────────────────────────────────────────

interface NewChapter {
  order: number;
  name: string;
  description: string;
  chapterType: string;
  actflLevel: string;
  culturalTheme: string;
  lessons: { id: string; order: number }[];
  // Optional: override vocab/grammar for lessons that need content expansion
  expandLesson?: {
    lessonId: string;
    vocab?: string[];
    grammar?: string[];
  };
}

const NEW_CHAPTERS: NewChapter[] = [
  // ─── SECTION 1: Getting Started ─────────────────────────────────────────
  {
    order: 1,
    name: 'Greetings & Farewells',
    description: 'Master everyday greetings and farewells for any time of day, and learn when to use formal vs. informal address.',
    chapterType: 'greetings',
    actflLevel: 'Novice Low',
    culturalTheme: 'Social Customs',
    lessons: [
      { id: LESSONS.practiceGreetings, order: 1 },
      { id: LESSONS.activeProduction, order: 2 },
    ],
  },
  {
    order: 2,
    name: 'Meeting People',
    description: 'Introduce yourself, ask names, and say where you are from with confidence.',
    chapterType: 'introductions',
    actflLevel: 'Novice Low',
    culturalTheme: 'Social Customs',
    lessons: [
      { id: LESSONS.meetingNewPeople, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.meetingNewPeople,
      grammar: [
        "Introduction to formal (usted) vs. informal (tú) address",
        "The verb 'ser' (to be) — 1st and 2nd person singular: yo soy, tú eres, usted es",
        "The reflexive phrase 'llamarse': me llamo, te llamas, se llama",
      ],
    },
  },
  {
    order: 3,
    name: 'Classroom Survival',
    description: 'Never feel lost in class again — ask for repetition, clarification, and permission using formal and informal forms.',
    chapterType: 'classroom',
    actflLevel: 'Novice Low',
    culturalTheme: 'School Life',
    lessons: [
      { id: LESSONS.classroomSurvival, order: 1 },
      { id: LESSONS.preguntasFaciles, order: 2 },
    ],
    expandLesson: {
      lessonId: LESSONS.classroomSurvival,
      grammar: [
        "Formal vs. informal commands/requests: Repita, por favor (usted) vs. ¿Puedes repetir? (tú)",
        "Basic negation: no + verb (No entiendo, No sé)",
      ],
    },
  },
  {
    order: 4,
    name: 'My Daily Activities',
    description: 'Recognize and talk about everyday actions and when they happen throughout the day.',
    chapterType: 'daily',
    actflLevel: 'Novice Low',
    culturalTheme: 'Daily Life',
    lessons: [
      { id: LESSONS.miDiaDiario, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.miDiaDiario,
      vocab: [
        "desayunar - to have breakfast",
        "almorzar - to have lunch",
        "cenar - to have dinner",
        "trabajar - to work",
        "estudiar - to study",
        "dormir - to sleep",
        "comer - to eat",
        "leer - to read",
        "hablar - to talk",
        "por la mañana - in the morning",
        "por la tarde - in the afternoon",
        "por la noche - at night",
      ],
      grammar: [
        "Common -AR and -ER/-IR infinitives as vocabulary (recognition, not production)",
        "Time-of-day expressions: por la mañana, por la tarde, por la noche",
      ],
    },
  },

  // ─── SECTION 2: Numbers & Time ──────────────────────────────────────────
  {
    order: 5,
    name: 'Numbers 0–20',
    description: 'Count from zero to twenty, share your age, and exchange phone numbers.',
    chapterType: 'numbers',
    actflLevel: 'Novice Low',
    culturalTheme: 'Everyday Communication',
    lessons: [
      { id: LESSONS.practiceNumbers, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.practiceNumbers,
      grammar: [
        "Cardinal numbers 0–20 as a structured paradigm",
        "The verb 'tener' in 1st and 2nd person for expressing age: Tengo X años, ¿Cuántos años tienes?",
      ],
    },
  },
  {
    order: 6,
    name: 'Telling Time',
    description: 'Read clocks and express time in Spanish — from the exact hour to quarter past and quarter to.',
    chapterType: 'time',
    actflLevel: 'Novice Low',
    culturalTheme: 'Daily Life',
    lessons: [
      { id: LESSONS.laHora, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.laHora,
      vocab: [
        "la hora - the time/hour",
        "¿Qué hora es? - What time is it?",
        "Es la una. - It is one o'clock.",
        "Son las... - It is... (for 2 o'clock and beyond)",
        "y cuarto - quarter past",
        "y media - half past",
        "menos cuarto - quarter to",
        "en punto - exactly/on the dot",
        "la mañana - morning (a.m.)",
        "la tarde - afternoon (p.m.)",
        "la noche - night",
        "la medianoche - midnight",
        "el mediodía - noon",
      ],
      grammar: [
        "The verb 'ser' for telling time: Es la una (singular) vs. Son las dos (plural rule)",
        "Fractions of the hour: y cuarto (+15), y media (+30), menos cuarto (-15)",
      ],
    },
  },

  // ─── SECTION 3: Family ──────────────────────────────────────────────────
  {
    order: 7,
    name: 'Family Members',
    description: 'Name all the members of your family and start talking about who they are.',
    chapterType: 'family',
    actflLevel: 'Novice Mid',
    culturalTheme: 'Family & Relationships',
    lessons: [
      { id: LESSONS.meetTheFamily, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.meetTheFamily,
      vocab: [
        "la familia - the family",
        "la madre - the mother",
        "el padre - the father",
        "el hermano - the brother",
        "la hermana - the sister",
        "el abuelo - the grandfather",
        "la abuela - the grandmother",
        "el hijo - the son",
        "la hija - the daughter",
        "el tío - the uncle",
        "la tía - the aunt",
        "el primo - the cousin (m)",
        "la prima - the cousin (f)",
        "mi / mis - my (singular/plural)",
      ],
      grammar: [
        "Gender agreement for family nouns: el/la, -o/-a endings (el padre / la madre, el hermano / la hermana)",
        "Possessive adjective mi/mis: mi madre, mis padres",
      ],
    },
  },
  {
    order: 8,
    name: 'Describing People',
    description: 'Paint a picture with words — describe appearance and personality using adjectives that agree with nouns.',
    chapterType: 'descriptions',
    actflLevel: 'Novice Mid',
    culturalTheme: 'Family & Relationships',
    lessons: [
      { id: LESSONS.whoIsWho, order: 1 },
      { id: LESSONS.grammarAgreement, order: 2 },
      { id: LESSONS.cultureCornerFamily, order: 3 },
    ],
    expandLesson: {
      lessonId: LESSONS.grammarAgreement,
      grammar: [
        "Noun-adjective agreement in gender: el hermano alto / la hermana alta",
        "Noun-adjective agreement in number: los hermanos altos / las hermanas altas",
        "Possessive adjectives mi/mis and tu/tus with family members",
      ],
    },
  },
  {
    order: 9,
    name: 'Birthdays & Dates',
    description: 'Ask about ages and birthdays, learn the months, and talk about calendar dates.',
    chapterType: 'numbers',
    actflLevel: 'Novice Mid',
    culturalTheme: 'Family & Relationships',
    lessons: [
      { id: LESSONS.birthdayCelebrations, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.birthdayCelebrations,
      vocab: [
        "el cumpleaños - birthday",
        "¿Cuántos años tienes? - How old are you?",
        "Tengo... años - I am... years old",
        "¿Cuándo es tu cumpleaños? - When is your birthday?",
        "Es el... de... - It is the... of... (date format)",
        "enero - January",
        "febrero - February",
        "marzo - March",
        "abril - April",
        "mayo - May",
        "junio - June",
        "julio - July",
        "agosto - August",
        "septiembre - September",
        "octubre - October",
        "noviembre - November",
        "diciembre - December",
        "el mes - the month",
        "feliz cumpleaños - happy birthday",
      ],
      grammar: [
        "The verb 'tener' for age: yo tengo / tú tienes — full age exchange",
        "The verb 'ser' for dates: Es el 15 de enero — number + de + month structure",
        "Numbers 1–31 for calendar dates",
      ],
    },
  },

  // ─── SECTION 4: School Life ──────────────────────────────────────────────
  {
    order: 10,
    name: 'School Supplies',
    description: 'Pack your backpack! Learn classroom objects and master the Spanish article system.',
    chapterType: 'school',
    actflLevel: 'Novice Mid',
    culturalTheme: 'School Life',
    lessons: [
      { id: LESSONS.schoolSupplies, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.schoolSupplies,
      grammar: [
        "Definite articles el/la/los/las — identifying specific items",
        "Indefinite articles un/una/unos/unas — identifying non-specific items",
        "Pluralization of nouns: el lápiz → los lápices, la regla → las reglas",
      ],
    },
  },
  {
    order: 11,
    name: 'School Subjects',
    description: "What's your favorite class? Learn subject names and express your opinions using gustar.",
    chapterType: 'school',
    actflLevel: 'Novice Mid',
    culturalTheme: 'School Life',
    lessons: [
      { id: LESSONS.schoolSubjects, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.schoolSubjects,
      grammar: [
        "The verb 'gustar' with singular nouns: me gusta la historia",
        "The verb 'gustar' with plural nouns: me gustan las matemáticas",
        "Adjective agreement with school subjects: el inglés es interesante, las ciencias son difíciles",
      ],
    },
  },
  {
    order: 12,
    name: '-AR Verb Conjugation',
    description: 'Unlock the most common verb pattern in Spanish and use it to describe your daily school schedule.',
    chapterType: 'grammar_ar_verbs',
    actflLevel: 'Novice Mid',
    culturalTheme: 'School Life',
    lessons: [
      { id: LESSONS.grammarArVerbs, order: 1 },
      { id: LESSONS.mySchedule, order: 2 },
    ],
    expandLesson: {
      lessonId: LESSONS.grammarArVerbs,
      grammar: [
        "Regular -AR verb conjugation — full paradigm: yo hablo, tú hablas, él/ella/usted habla, nosotros hablamos, ellos/ellas/ustedes hablan",
        "Subject pronouns full set: yo, tú, él, ella, usted, nosotros, ellos, ellas, ustedes",
        "The stem-changing -AR verb 'empezar' (e→ie) as a first exposure to stem-changers",
      ],
    },
  },
  {
    order: 13,
    name: 'Spanish School Culture',
    description: 'Compare education systems and learn how school life differs across Spanish-speaking countries.',
    chapterType: 'school',
    actflLevel: 'Novice Mid',
    culturalTheme: 'School Life',
    lessons: [
      { id: LESSONS.schoolAroundWorld, order: 1 },
      { id: LESSONS.miProyectoCorto, order: 2 },
    ],
    expandLesson: {
      lessonId: LESSONS.schoolAroundWorld,
      grammar: [
        "The impersonal verb 'hay' (there is / there are): Hay muchos estudiantes",
        "Comparative structures: más... que / menos... que (more... than / less... than)",
        "Gender and number agreement applied to school vocabulary",
      ],
    },
  },

  // ─── SECTION 5: Hobbies & Free Time ────────────────────────────────────
  {
    order: 14,
    name: 'Hobbies',
    description: 'Talk about what you love to do — from music and movies to dancing and cooking.',
    chapterType: 'hobbies',
    actflLevel: 'Novice Mid',
    culturalTheme: 'Arts & Leisure',
    lessons: [
      { id: LESSONS.newWordsHobbies, order: 1 },
      { id: LESSONS.cultureCornerMusic, order: 2 },
    ],
    expandLesson: {
      lessonId: LESSONS.newWordsHobbies,
      grammar: [
        "The verb 'gustar' + infinitive: me gusta leer, te gusta bailar",
        "The irregular verb 'hacer': yo hago deporte (first 'go' verb)",
        "Regular -AR and -ER verbs in context: yo bailo, tú cantas, yo leo, tú ves",
      ],
    },
  },
  {
    order: 15,
    name: 'Sports & Abilities',
    description: 'Discuss your favorite sports and express what you can and cannot do.',
    chapterType: 'hobbies',
    actflLevel: 'Novice Mid',
    culturalTheme: 'Sports & Health',
    lessons: [
      { id: LESSONS.sportsTalk, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.sportsTalk,
      grammar: [
        "The stem-changing verb 'jugar' (u→ue): yo juego, tú juegas, él/ella/usted juega + jugar al fútbol",
        "The stem-changing verb 'poder' (o→ue): yo puedo, tú puedes + poder + infinitive",
      ],
    },
  },
  {
    order: 16,
    name: 'Weekend Plans',
    description: 'Talk about what you are doing this weekend and make plans with friends.',
    chapterType: 'daily',
    actflLevel: 'Novice Mid',
    culturalTheme: 'Daily Life',
    lessons: [
      { id: LESSONS.weekendPlans, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.weekendPlans,
      grammar: [
        "The irregular verb 'ir' (to go) — full present tense: yo voy, tú vas, él/ella va, nosotros vamos",
        "Ir a + infinitive for immediate future plans: voy a jugar, vamos a comer",
        "Regular -ER verbs in context: yo como, tú comes",
      ],
    },
  },

  // ─── SECTION 6: Food & Dining ───────────────────────────────────────────
  {
    order: 17,
    name: 'Food Vocabulary',
    description: 'From breakfast to dinner — learn the food and drink words you need every day.',
    chapterType: 'food',
    actflLevel: 'Novice Mid',
    culturalTheme: 'Food & Cuisine',
    lessons: [
      { id: LESSONS.foodFavorites, order: 1 },
      { id: LESSONS.newWordsDrinks, order: 2 },
      { id: LESSONS.cultureCornerFood, order: 3 },
    ],
    expandLesson: {
      lessonId: LESSONS.foodFavorites,
      grammar: [
        "The verb 'gustar' with singular food nouns: me gusta el arroz",
        "The verb 'gustar' with plural food nouns: me gustan las frutas",
        "Negation with gustar: no me gusta, no me gustan",
      ],
    },
  },
  {
    order: 18,
    name: 'At the Restaurant',
    description: 'Order a full meal confidently — from the menu to the bill.',
    chapterType: 'food',
    actflLevel: 'Novice Mid',
    culturalTheme: 'Food & Cuisine',
    lessons: [
      { id: LESSONS.restaurantOrdering, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.restaurantOrdering,
      grammar: [
        "Using 'quiero + noun' for direct ordering: Quiero un café",
        "The conditional 'me gustaría + noun/infinitive' for polite requests",
        "Basic interrogative '¿Cuánto es?' for asking the price",
      ],
    },
  },
  {
    order: 19,
    name: 'Stem-Changing Verbs',
    description: 'Master the three types of stem-changing verbs — the key to sounding natural in Spanish.',
    chapterType: 'grammar_stem_changers',
    actflLevel: 'Novice High',
    culturalTheme: 'Food & Cuisine',
    lessons: [
      { id: LESSONS.grammarStemChangers, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.grammarStemChangers,
      vocab: [
        "querer - to want",
        "preferir - to prefer",
        "poder - to be able to / can",
        "probar - to try / taste",
        "pedir - to order / ask for",
        "servir - to serve",
        "el postre - dessert",
        "el restaurante - restaurant",
        "beber - to drink",
        "pagar - to pay",
      ],
      grammar: [
        "e→ie stem-changers: querer (quiero, quieres, quiere), preferir (prefiero, prefieres, prefiere)",
        "o→ue stem-changers: poder (puedo, puedes, puede), probar (pruebo, pruebas, prueba)",
        "e→i stem-changers: pedir (pido, pides, pide), servir (sirvo, sirves, sirve)",
      ],
    },
  },

  // ─── SECTION 7: Shopping & Clothing ────────────────────────────────────
  {
    order: 20,
    name: 'Clothing & Colors',
    description: 'Build your wardrobe vocabulary and describe what you and others are wearing.',
    chapterType: 'clothing',
    actflLevel: 'Novice High',
    culturalTheme: 'Fashion & Shopping',
    lessons: [
      { id: LESSONS.clothingEssentials, order: 1 },
      { id: LESSONS.colorsAndSizes, order: 2 },
    ],
    expandLesson: {
      lessonId: LESSONS.clothingEssentials,
      grammar: [
        "The regular -AR verb 'llevar' for wearing: yo llevo, tú llevas, él/ella lleva",
        "Color adjective agreement with clothing nouns: la camisa roja, los pantalones azules",
        "The verb 'ser' for describing permanent characteristics: La camisa es roja",
      ],
    },
  },
  {
    order: 21,
    name: 'Shopping',
    description: 'Navigate markets and stores — ask prices, compare items, and express preferences.',
    chapterType: 'shopping',
    actflLevel: 'Novice High',
    culturalTheme: 'Fashion & Shopping',
    lessons: [
      { id: LESSONS.atTheStore, order: 1 },
      { id: LESSONS.shoppingStories, order: 2 },
    ],
    expandLesson: {
      lessonId: LESSONS.shoppingStories,
      grammar: [
        "The stem-changing verb 'preferir' (e→ie) in shopping context: Prefiero el rojo",
        "Comparative adjectives: más caro que / menos barato que",
        "The verb 'gustar' with indirect object pronouns: me gusta, te gusta, le gusta",
      ],
    },
  },
  {
    order: 22,
    name: 'Reading & Writing in Spanish',
    description: 'Understand short texts and conversations, and write simple notes in Spanish.',
    chapterType: 'literacy',
    actflLevel: 'Novice High',
    culturalTheme: 'Communication',
    lessons: [
      { id: LESSONS.descifrandoMensajes, order: 1 },
      { id: LESSONS.entendiendoConv, order: 2 },
      { id: LESSONS.mensajesRapidos, order: 3 },
    ],
    expandLesson: {
      lessonId: LESSONS.mensajesRapidos,
      grammar: [
        "The verb 'estar' for feelings and conditions: estoy bien, estoy cansado/a",
        "The irregular verb 'ir' for social invitations: ¿Quieres ir al parque?",
      ],
    },
  },

  // ─── SECTION 8: City & Community ────────────────────────────────────────
  {
    order: 23,
    name: 'Places in Town',
    description: 'Learn where everything is in a Spanish-speaking city — and how to talk about it.',
    chapterType: 'city',
    actflLevel: 'Novice High',
    culturalTheme: 'Community',
    lessons: [
      { id: LESSONS.placesInTown, order: 1 },
      { id: LESSONS.cityLife, order: 2 },
    ],
    expandLesson: {
      lessonId: LESSONS.placesInTown,
      grammar: [
        "The verb 'hay' for existence: Hay un banco. ¿Hay un museo?",
        "The verb 'estar' for location: El banco está cerca. El museo está en el centro.",
        "Prepositions of location: cerca de, lejos de, al lado de, enfrente de",
      ],
    },
  },
  {
    order: 24,
    name: 'Getting Around & Directions',
    description: 'Navigate the city by public transport and guide others with confident directions.',
    chapterType: 'city',
    actflLevel: 'Novice High',
    culturalTheme: 'Community',
    lessons: [
      { id: LESSONS.gettingAround, order: 1 },
      { id: LESSONS.givingDirections, order: 2 },
    ],
    expandLesson: {
      lessonId: LESSONS.givingDirections,
      grammar: [
        "Formal usted commands for giving directions: Gire, Siga, Doble (first imperative paradigm)",
        "Prepositions of direction: a la derecha, a la izquierda, todo recto",
        "The verb 'ir' in transportation context: voy en autobús, voy a pie",
      ],
    },
  },

  // ─── SECTION 9: Travel & Vacation ───────────────────────────────────────
  {
    order: 25,
    name: 'Travel Vocabulary',
    description: 'Pack your bags — learn the vocabulary for planning and talking about your next adventure.',
    chapterType: 'travel',
    actflLevel: 'Novice High',
    culturalTheme: 'Travel & Culture',
    lessons: [
      { id: LESSONS.travelEssentials, order: 1 },
      { id: LESSONS.dreamDestinations, order: 2 },
    ],
    expandLesson: {
      lessonId: LESSONS.travelEssentials,
      grammar: [
        "Ir a + infinitive for future travel plans: voy a visitar, vamos a explorar",
        "Using 'me gustaría + infinitive' for polite future wishes: Me gustaría ir a la playa",
        "Interrogative '¿Adónde?' vs '¿Dónde?' for destinations vs locations",
      ],
    },
  },
  {
    order: 26,
    name: 'Weather',
    description: 'Talk about the weather for any season and use it to plan your trips.',
    chapterType: 'weather',
    actflLevel: 'Novice High',
    culturalTheme: 'Travel & Culture',
    lessons: [
      { id: LESSONS.weatherTalk, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.weatherTalk,
      vocab: [
        "el tiempo - the weather",
        "¿Qué tiempo hace? - What is the weather like?",
        "hace sol - it is sunny",
        "hace calor - it is hot",
        "hace frío - it is cold",
        "hace viento - it is windy",
        "llueve - it is raining",
        "nieva - it is snowing",
        "está nublado - it is cloudy",
        "la primavera - spring",
        "el verano - summer",
        "el otoño - fall/autumn",
        "el invierno - winter",
      ],
      grammar: [
        "The verb 'hacer' for weather expressions — always 3rd person singular: hace sol, hace calor, hace frío, hace viento",
        "The verb 'estar' for sky/atmospheric conditions: está nublado, está despejado",
        "Stem-changing weather verbs: llover (o→ue → llueve), nevar (e→ie → nieva)",
      ],
    },
  },
  {
    order: 27,
    name: 'At the Hotel',
    description: 'Handle hotel check-in and common situations confidently using formal language.',
    chapterType: 'travel',
    actflLevel: 'Novice High',
    culturalTheme: 'Travel & Culture',
    lessons: [
      { id: LESSONS.hotelCheckIn, order: 1 },
    ],
    expandLesson: {
      lessonId: LESSONS.hotelCheckIn,
      grammar: [
        "Formal usted commands for service situations: ¿Puede...?, ¿Me da...? (review in hotel context)",
        "The irregular verb 'tener' in 1st and 3rd person: Tengo una reservación / ¿Tiene habitaciones?",
      ],
    },
  },
];

// ── Old mega-unit IDs to archive ─────────────────────────────────────────────
const OLD_UNIT_IDS = [
  '3419e126-68b4-44a6-8b4c-680b46c0f0a3', // Unit 1: ¡Hola!
  '3c0bb296-7df5-40ed-af5b-4f3ca00b87c0', // Unit 2: Números
  'd1ec75e5-c4d1-441d-80d9-21d3a8908749', // Unit 2: Familia
  '60f13973-da30-4d36-b886-dcc487216934', // Unit 3: Escuela
  'd79ce019-0388-4a2e-a629-4ec8c0a6d9d2', // Unit 4: Pasatiempos
  '91948328-1921-4306-a33a-6251d5629437', // Unit 5: Comida
  '5a7fa298-76b2-4f2d-9872-956b2e9180c5', // Unit 6: Compras
  '1d49779d-e5dc-48e6-99dc-56222c422b1c', // Unit 7: Ciudad
  'ade419d0-417e-4604-b0d4-1e1f10aaaa40', // Unit 8: Vacaciones
];

// ── Main migration ────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Spanish 1 Restructuring Migration');
    console.log('  9 mega-chapters → 27 focused chapters');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Safety check: if old units are already archived, bail
    const { rows: alreadyDone } = await client.query(`
      SELECT COUNT(*) as n FROM curriculum_units
      WHERE id = ANY($1::varchar[]) AND name LIKE '[ARCHIVED]%'
    `, [OLD_UNIT_IDS]);

    if (parseInt(alreadyDone[0].n) > 0) {
      console.log('⚠  Some old units already archived — migration already run. Exiting safely.');
      await client.query('ROLLBACK');
      return;
    }

    const newUnitIds: Map<number, string> = new Map();

    // ── Step 1: Create new units ─────────────────────────────────────────
    console.log('Step 1: Creating 27 new curriculum units...\n');

    for (const ch of NEW_CHAPTERS) {
      const { rows } = await client.query(`
        INSERT INTO curriculum_units (
          curriculum_path_id, name, description, order_index,
          actfl_level, cultural_theme, chapter_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        SPANISH1_PATH_ID,
        ch.name,
        ch.description,
        ch.order,
        ch.actflLevel,
        ch.culturalTheme,
        ch.chapterType,
      ]);

      const newId = rows[0].id;
      newUnitIds.set(ch.order, newId);
      console.log(`  [Ch ${String(ch.order).padStart(2, '0')}] Created: "${ch.name}" → ${newId}`);
    }

    // ── Step 2: Move lessons to new units ───────────────────────────────
    console.log('\nStep 2: Moving lessons to new chapters...\n');

    for (const ch of NEW_CHAPTERS) {
      const newUnitId = newUnitIds.get(ch.order)!;
      for (const lesson of ch.lessons) {
        await client.query(`
          UPDATE curriculum_lessons
          SET curriculum_unit_id = $1, order_index = $2
          WHERE id = $3
        `, [newUnitId, lesson.order, lesson.id]);
      }
      console.log(`  [Ch ${String(ch.order).padStart(2, '0')}] "${ch.name}" — moved ${ch.lessons.length} lesson(s)`);
    }

    // ── Step 3: Update content for expanded chapters ─────────────────────
    console.log('\nStep 3: Updating content for expanded/corrected chapters...\n');

    for (const ch of NEW_CHAPTERS) {
      if (!ch.expandLesson) continue;

      const { lessonId, vocab, grammar } = ch.expandLesson;
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIdx = 1;

      if (vocab) {
        updates.push(`required_vocabulary = $${paramIdx++}::text[]`);
        values.push(vocab);
      }
      if (grammar) {
        updates.push(`required_grammar = $${paramIdx++}::text[]`);
        values.push(grammar);
      }

      if (updates.length > 0) {
        values.push(lessonId);
        await client.query(
          `UPDATE curriculum_lessons SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
          values
        );
        const label = vocab ? `vocab(${vocab.length})` : '';
        const gLabel = grammar ? `grammar(${grammar.length})` : '';
        console.log(`  [Ch ${String(ch.order).padStart(2, '0')}] Updated lesson "${lessonId.substring(0, 8)}..." — ${[label, gLabel].filter(Boolean).join(', ')}`);
      }
    }

    // ── Step 4: Archive old mega-units ───────────────────────────────────
    console.log('\nStep 4: Archiving old mega-units...\n');

    for (const oldId of OLD_UNIT_IDS) {
      const { rows } = await client.query(
        `UPDATE curriculum_units SET name = '[ARCHIVED] ' || name, order_index = order_index + 1000 WHERE id = $1 RETURNING name`,
        [oldId]
      );
      if (rows.length) {
        console.log(`  Archived: ${rows[0].name}`);
      }
    }

    // ── Step 5: Verify ───────────────────────────────────────────────────
    console.log('\nStep 5: Verification...\n');

    const { rows: newUnits } = await client.query(`
      SELECT cu.name, cu.order_index, cu.chapter_type, COUNT(cl.id) as lesson_count
      FROM curriculum_units cu
      LEFT JOIN curriculum_lessons cl ON cl.curriculum_unit_id = cu.id
      WHERE cu.curriculum_path_id = $1
        AND cu.name NOT LIKE '[ARCHIVED]%'
      GROUP BY cu.id, cu.name, cu.order_index, cu.chapter_type
      ORDER BY cu.order_index
    `, [SPANISH1_PATH_ID]);

    console.log(`  New chapters created: ${newUnits.length}`);
    newUnits.forEach(u => {
      const warn = parseInt(u.lesson_count) === 0 ? ' ⚠ NO LESSONS' : '';
      console.log(`  [${String(u.order_index).padStart(2, '0')}] ${u.name} (${u.chapter_type}) — ${u.lesson_count} lesson(s)${warn}`);
    });

    const { rows: orphaned } = await client.query(`
      SELECT cl.name FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      WHERE cu.curriculum_path_id = $1
        AND cu.name LIKE '[ARCHIVED]%'
    `, [SPANISH1_PATH_ID]);

    if (orphaned.length > 0) {
      console.log(`\n  ⚠  ${orphaned.length} lessons still in archived units:`);
      orphaned.forEach(l => console.log(`    - ${l.name}`));
    } else {
      console.log('\n  ✓  No orphaned lessons in archived units');
    }

    await client.query('COMMIT');
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅  Migration complete — Spanish 1 restructured to 27 chapters');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed — rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

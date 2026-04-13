export interface GreetingPhrases {
  morning: string;
  afternoon: string;
  evening: string;
}

export interface FormalInformalPair {
  formal: string;
  informal: string;
  context: string;
}

export interface QuickPhrase {
  phrase: string;
  meaning: string;
}

export interface FormalInformalExample {
  label: string;
  formal: string;
  informal: string;
}

export interface CognateEntry {
  english: string;
  spanish: string;
  target?: string;
  category: string;
  isFalseCognate?: boolean;
  falseCognateNote?: string;
}

export interface SentenceFrameItem {
  filler: string;
  fullSentence: string;
  translation: string;
  imageKey?: string;
}

export interface SentenceFrame {
  frame: string;
  frameTranslation: string;
  items: SentenceFrameItem[];
}

export interface ConversationPanel {
  speaker: string;
  gender?: 'male' | 'female';
  text: string;
  romanization?: string;
  translation: string;
  note?: string;
  image?: string;
}

export interface ConversationStrip {
  title: string;
  context: string;
  panels: ConversationPanel[];
}

export interface VocabQAItem {
  word?: string;
  translation?: string;
  answerTranslation?: string;
  question: string;
  answer: string;
}

export interface GenderPair {
  masculine: string;
  feminine: string;
  translation: string;
}

export interface VerbExample {
  object: string;
  fullPhrase: string;
  translation: string;
}

export interface VerbGroup {
  verb: string;
  verbTranslation: string;
  examples: VerbExample[];
}

export interface ChapterIntroContent {
  welcomeText: string;
  narrativeSections: {
    title: string;
    content: string;
    tip?: string;
    discoveryNote?: string;
    infographic?: 'sunArcGreetings' | 'formalInformal' | 'quickPhrases';
    examples?: FormalInformalExample[];
  }[];
  conversationStrips?: ConversationStrip[];
  culturalSpotlight?: {
    title: string;
    content: string;
  };
  cognateOpener?: CognateEntry[];
  sentenceFrames?: SentenceFrame[];
  genderFrame?: { masculine: string; feminine: string };
  genderPairs?: GenderPair[];
  vocabQA?: VocabQAItem[];
  verbGroups?: VerbGroup[];
}

export interface LanguageChapterData {
  greetings: GreetingPhrases;
  formalInformal: FormalInformalPair[];
  quickPhrases: QuickPhrase[];
  chapters: Record<string, ChapterIntroContent>;
}

export const languageChapterData: Record<string, LanguageChapterData> = {
  spanish: {
    greetings: {
      morning: "Buenos d\u00edas",
      afternoon: "Buenas tardes",
      evening: "Buenas noches"
    },
    formalInformal: [
      { formal: "\u00bfC\u00f3mo est\u00e1 usted?", informal: "\u00bfC\u00f3mo est\u00e1s?", context: "How are you?" },
      { formal: "Mucho gusto en conocerle", informal: "\u00a1Hola! \u00bfQu\u00e9 tal?", context: "Nice to meet you" },
      { formal: "Disculpe", informal: "Perdona", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "Hola", meaning: "Hello" },
      { phrase: "Adi\u00f3s", meaning: "Goodbye" },
      { phrase: "Por favor", meaning: "Please" },
      { phrase: "Gracias", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "In this chapter you'll learn three time-of-day greetings (buenos días, buenas tardes, buenas noches), the formal and informal 'you' (usted / tú), and how to introduce yourself. By the end, you'll be able to open and close a real conversation in Spanish.",
        narrativeSections: [
          {
            title: "Time Matters",
            content: "Spanish has different greetings for different times of day. 'Buenos d\u00edas' for morning, 'Buenas tardes' for afternoon, and 'Buenas noches' for evening. Use the wrong one and native speakers won't misunderstand — but they will notice.",
            infographic: 'sunArcGreetings',
            tip: "The switch from 'Buenos d\u00edas' to 'Buenas tardes' typically happens around lunchtime, which in Spain can be as late as 2 PM."
          },

          {
            title: "Formal vs. Informal",
            content: "Spanish has two words for 'you': 'usted' for people you respect or don't know well, and 't\u00fa' for friends and family. The verb ending changes slightly depending on which you use.",
            infographic: 'formalInformal',
            tip: "When in doubt, start formal. It's easier to move toward casual than to walk back a misstep.",
            discoveryNote: "usted uses the same verb ending as \u00e9l and ella. '\u00bfC\u00f3mo est\u00e1 usted?' and '\u00bfC\u00f3mo est\u00e1 ella?' share the same form. Spanish builds formality through pronoun choice, not verb endings."
          }
        ],
        conversationStrips: [
          {
            title: "A Casual Hello",
            context: "Agustín runs into Daniela between classes",
            panels: [
              { speaker: "Agustín", gender: "male", text: "\u00a1Hola, Daniela!", translation: "Hi, Daniela!", image: "/strips/panel-0-0.png" },
              { speaker: "Daniela", gender: "female", text: "\u00a1Hola, Agust\u00edn! \u00bfC\u00f3mo est\u00e1s?", translation: "Hi, Agustín! How are you?", image: "/strips/panel-0-1.png" },
              { speaker: "Agustín", gender: "male", text: "\u00a1Muy bien, gracias! \u00bfY t\u00fa?", translation: "Very well, thanks! And you?", image: "/strips/panel-0-2.png" },
              { speaker: "Daniela", gender: "female", text: "\u00a1Bien! \u00a1Hasta luego!", translation: "Good! See you later!", image: "/strips/panel-0-3.png" }
            ]
          },
          {
            title: "Nice to Meet You",
            context: "Agustín introduces himself to Daniela on the first day",
            panels: [
              { speaker: "Agustín", gender: "male", text: "Hola, me llamo Agust\u00edn.", translation: "Hi, my name is Agustín.", image: "/strips/panel-1-0.png" },
              { speaker: "Daniela", gender: "female", text: "Mucho gusto, Agust\u00edn. Soy Daniela.", translation: "Nice to meet you, Agustín. I'm Daniela.", image: "/strips/panel-1-1.png" },
              { speaker: "Agustín", gender: "male", text: "El gusto es m\u00edo.", translation: "The pleasure is mine.", image: "/strips/panel-1-2.png" }
            ]
          },
          {
            title: "With Grandma \u2014 The Formal Register",
            context: "Agustín visits Rosa, his grandmother, always addressing her with 'usted'",
            panels: [
              { speaker: "Agustín", gender: "male", text: "Buenos d\u00edas, abuela. \u00bfC\u00f3mo est\u00e1 usted?", translation: "Good morning, Grandma. How are you?", note: "Agustín uses 'usted' — respect for elders", image: "/strips/panel-2-0.png" },
              { speaker: "Rosa", gender: "female", text: "Muy bien, gracias, Agust\u00edn. \u00bfY t\u00fa?", translation: "Very well, thanks, Agustín. And you?", note: "Grandma uses 't\u00fa' back — she's the elder", image: "/strips/panel-2-1.png" },
              { speaker: "Agustín", gender: "male", text: "Bien, gracias, abuela.", translation: "Fine, thank you, Grandma.", image: "/strips/panel-2-2.png" }
            ]
          }
        ],
        cognateOpener: [
          { english: "actor", spanish: "actor", category: "Identical in both languages" },
          { english: "doctor", spanish: "doctor", category: "Identical in both languages" },
          { english: "director", spanish: "director", category: "Identical in both languages" },
          { english: "hotel", spanish: "hotel", category: "Identical in both languages" },
          { english: "animal", spanish: "animal", category: "Identical in both languages" },
          { english: "color", spanish: "color", category: "Identical in both languages" },
          { english: "error", spanish: "error", category: "Identical in both languages" },
          { english: "motor", spanish: "motor", category: "Identical in both languages" },
          { english: "natural", spanish: "natural", category: "Nearly the same" },
          { english: "formal", spanish: "formal", category: "Nearly the same" },
          { english: "social", spanish: "social", category: "Nearly the same" },
          { english: "normal", spanish: "normal", category: "Nearly the same" },
          { english: "total", spanish: "total", category: "Nearly the same" },
          { english: "tropical", spanish: "tropical", category: "Nearly the same" },
          { english: "musical", spanish: "musical", category: "Nearly the same" },
          { english: "cultural", spanish: "cultural", category: "Nearly the same" },
          { english: "personal", spanish: "personal", category: "Nearly the same" },
          { english: "original", spanish: "original", category: "Nearly the same" },
          { english: "nation", spanish: "nación", category: "-tion → -ción" },
          { english: "conversation", spanish: "conversación", category: "-tion → -ción" },
          { english: "information", spanish: "información", category: "-tion → -ción" },
          { english: "vacation", spanish: "vacación", category: "-tion → -ción" },
          { english: "emotion", spanish: "emoción", category: "-tion → -ción" },
          { english: "tradition", spanish: "tradición", category: "-tion → -ción" },
          { english: "invitation", spanish: "invitación", category: "-tion → -ción" },
          { english: "artist", spanish: "artista", category: "-ist → -ista" },
          { english: "tourist", spanish: "turista", category: "-ist → -ista" },
          { english: "dentist", spanish: "dentista", category: "-ist → -ista" },
          { english: "pianist", spanish: "pianista", category: "-ist → -ista" },
          { english: "specialist", spanish: "especialista", category: "-ist → -ista" },
          { english: "embarrassed", spanish: "embarazada", category: "False friends", isFalseCognate: true, falseCognateNote: "actually means: pregnant" },
          { english: "constipated", spanish: "constipado", category: "False friends", isFalseCognate: true, falseCognateNote: "actually means: having a cold" },
          { english: "library", spanish: "librería", category: "False friends", isFalseCognate: true, falseCognateNote: "actually means: bookstore" },
        ],
        sentenceFrames: [
          {
            frame: "¡___, amigo!",
            frameTranslation: "___!, friend!",
            items: [
              { filler: "Hola", fullSentence: "¡Hola, amigo!", translation: "Hello, friend!", imageKey: "vocab_spanish_hola" },
              { filler: "Buenos días", fullSentence: "¡Buenos días, amigo!", translation: "Good morning, friend!", imageKey: "vocab_spanish_buenos dias" },
              { filler: "Buenas tardes", fullSentence: "¡Buenas tardes, amigo!", translation: "Good afternoon, friend!", imageKey: "vocab_spanish_buenas tardes" },
              { filler: "Buenas noches", fullSentence: "¡Buenas noches, amigo!", translation: "Good evening, friend!", imageKey: "vocab_spanish_buenas noches" },
              { filler: "Adiós", fullSentence: "¡Adiós, amigo!", translation: "Goodbye, friend!", imageKey: "vocab_spanish_adios" },
              { filler: "Hasta luego", fullSentence: "¡Hasta luego, amigo!", translation: "See you later, friend!", imageKey: "vocab_spanish_hasta luego" },
            ]
          },
          {
            frame: "Estoy ___.",
            frameTranslation: "I am ___.",
            items: [
              { filler: "bien", fullSentence: "Estoy bien.", translation: "I am well.", imageKey: "vocab_spanish_bien" },
              { filler: "muy bien", fullSentence: "Estoy muy bien.", translation: "I am very well.", imageKey: "vocab_spanish_muy bien" },
              { filler: "más o menos", fullSentence: "Estoy más o menos.", translation: "I am so-so.", imageKey: "vocab_spanish_mas o menos" },
              { filler: "mal", fullSentence: "Estoy mal.", translation: "I am not well.", imageKey: "vocab_spanish_mal" },
              { filler: "cansado", fullSentence: "Estoy cansado.", translation: "I am tired.", imageKey: "vocab_spanish_cansado" },
              { filler: "feliz", fullSentence: "Estoy feliz.", translation: "I am happy.", imageKey: "vocab_spanish_feliz" },
            ]
          }
        ],
        genderPairs: [
          { masculine: "contento", feminine: "contenta", translation: "happy / content" },
          { masculine: "cansado", feminine: "cansada", translation: "tired" },
          { masculine: "ocupado", feminine: "ocupada", translation: "busy" },
          { masculine: "enfermo", feminine: "enferma", translation: "sick" },
          { masculine: "nervioso", feminine: "nerviosa", translation: "nervous" },
          { masculine: "emocionado", feminine: "emocionada", translation: "excited" }
        ],
        vocabQA: [
          { word: "llamarse", translation: "to be called", question: "\u00bfC\u00f3mo te llamas?", answer: "Me llamo [tu nombre]." },
          { word: "estar bien", translation: "to be well", question: "\u00bfC\u00f3mo est\u00e1s?", answer: "Estoy bien, gracias. \u00bfY t\u00fa?" },
          { word: "mucho gusto", translation: "nice to meet you", question: "Mucho gusto.", answer: "Igualmente." },
          { word: "de d\u00f3nde", translation: "from where", question: "\u00bfDe d\u00f3nde eres?", answer: "Soy de [ciudad]." },
          { word: "usted", translation: "formal you", question: "\u00bfC\u00f3mo est\u00e1 usted?", answer: "Muy bien, gracias." },
          { word: "qu\u00e9 tal", translation: "what's up / how are things", question: "\u00bfQu\u00e9 tal?", answer: "Todo bien, \u00bfy t\u00fa?" }
        ],
        verbGroups: [
          {
            verb: "estar",
            verbTranslation: "to be (condition or state)",
            examples: [
              { object: "bien", fullPhrase: "Estoy bien.", translation: "I am well." },
              { object: "cansado", fullPhrase: "Estoy cansado.", translation: "I am tired." },
              { object: "feliz", fullPhrase: "Estoy feliz.", translation: "I am happy." },
              { object: "ocupado", fullPhrase: "Estoy ocupado.", translation: "I am busy." },
              { object: "mal", fullPhrase: "Estoy mal.", translation: "I am not well." },
              { object: "nervioso", fullPhrase: "Estoy nervioso.", translation: "I am nervous." }
            ]
          }
        ]
      },
      numbers: {
        welcomeText: "Spanish numbers follow a predictable pattern: learn uno through diez, and the rules for veinte, treinta, and cien unlock everything else. This chapter covers cero to un millón — including telling time and sharing your phone number.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "Uno through quince each have a distinct form — learn them individually. From dieciséis onward, numbers combine: diez + seis, diez + siete, diez + ocho. Veinte, treinta, and cuarenta follow the same add-and-combine pattern: veintiuno, treinta y dos, cuarenta y cinco.",
            tip: "Notice that 'uno' becomes 'un' before masculine nouns: 'un libro' (one book), but stays 'una' for feminine: 'una mesa' (one table)."
          },
          {
            title: "Numbers in Daily Life",
            content: "Numbers anchor three everyday exchanges: prices (\u00bfCu\u00e1nto cuesta? \u2014 Cuesta quince euros), ages (\u00bfCu\u00e1ntos a\u00f1os tienes? \u2014 Tengo veintid\u00f3s a\u00f1os), and time (\u00bfQu\u00e9 hora es? \u2014 Son las tres). These three questions open dozens of real conversations.",
            tip: "When giving phone numbers in Spanish, people often say digits in pairs: 55-12-34 instead of 5-5-1-2-3-4."
          }
        ],
        culturalSpotlight: {
          title: "El Regateo (Bargaining)",
          content: "In many Spanish-speaking countries, bargaining is an art form, especially in markets and small shops. Knowing your numbers well gives you confidence to negotiate prices. Start by asking '\u00bfMe puede hacer un descuento?' (Can you give me a discount?) and see where the conversation goes!"
        },
        vocabQA: [
          { question: "\u00bfCu\u00e1ntos a\u00f1os tienes?", answer: "Tengo veinticinco a\u00f1os.", answerTranslation: "I am twenty-five years old." },
          { question: "\u00bfCu\u00e1nto cuesta?", answer: "Cuesta diez euros.", answerTranslation: "It costs ten euros." },
          { question: "\u00bfQu\u00e9 hora es?", answer: "Son las tres.", answerTranslation: "It is three o'clock." },
          { question: "\u00bfCu\u00e1ntas personas hay?", answer: "Hay cinco personas.", answerTranslation: "There are five people." },
          { question: "\u00bfCu\u00e1l es tu n\u00famero de tel\u00e9fono?", answer: "Mi n\u00famero es el 55-12-34.", answerTranslation: "My number is 55-12-34." }
        ],
        verbGroups: [
          {
            verb: "tener",
            verbTranslation: "to have (age, possessions)",
            examples: [
              { object: "veinte a\u00f1os", fullPhrase: "Tengo veinte a\u00f1os.", translation: "I am twenty years old." },
              { object: "hambre", fullPhrase: "Tengo hambre.", translation: "I am hungry." },
              { object: "dinero", fullPhrase: "Tengo dinero.", translation: "I have money." },
              { object: "tiempo", fullPhrase: "No tengo tiempo.", translation: "I don't have time." },
              { object: "una pregunta", fullPhrase: "Tengo una pregunta.", translation: "I have a question." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "Spanish has a specific word for every family relationship. In this chapter, you'll learn madre, padre, hermanos, abuelos, tíos, and primos — plus the verb ser, which anchors every introduction.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "In Spanish-speaking cultures, 'family' often extends far beyond the nuclear unit. Cousins might be as close as siblings, and 't\u00edos' (aunts and uncles) play significant roles in raising children.",
            tip: "Many Spanish speakers use 't\u00edo/t\u00eda' affectionately for close friends too \u2014 it's like calling someone 'dude' or 'hon'!"
          },
          {
            title: "Extended Family",
            content: "Spanish has specific words for family relationships that English groups together. 'Suegra' is mother-in-law, 'cu\u00f1ado' is brother-in-law, and 'compadre' names the bond between a godparent and the child’s parents — a relationship important enough in Spanish culture to have earned its own word.",
            discoveryNote: "When a group includes even one male, Spanish uses the masculine plural for the whole group. A room of ten sisters plus one brother becomes 'mis hermanos' — not 'mis hermanas'. Knowing this prevents real confusion the first time someone uses a masculine plural for a group you expected to be all-female."
          }
        ],
        culturalSpotlight: {
          title: "Los Apellidos",
          content: "Spanish naming conventions are unique \u2014 most people carry two last names: their father's surname followed by their mother's. This tradition honors both sides of the family and helps trace lineage. So 'Garc\u00eda L\u00f3pez' tells a story of two families joined together."
        },
        sentenceFrames: [
          {
            frame: "Ella es mi ___.",
            frameTranslation: "She is my ___.",
            items: [
              { filler: "madre", fullSentence: "Ella es mi madre.", translation: "She is my mother.", imageKey: "vocab_spanish_madre" },
              { filler: "abuela", fullSentence: "Ella es mi abuela.", translation: "She is my grandmother.", imageKey: "vocab_spanish_abuela" },
              { filler: "hermana", fullSentence: "Ella es mi hermana.", translation: "She is my sister.", imageKey: "vocab_spanish_hermana" },
              { filler: "tía", fullSentence: "Ella es mi tía.", translation: "She is my aunt.", imageKey: "vocab_spanish_tia" },
              { filler: "prima", fullSentence: "Ella es mi prima.", translation: "She is my cousin.", imageKey: "vocab_spanish_prima" },
              { filler: "amiga", fullSentence: "Ella es mi amiga.", translation: "She is my friend.", imageKey: "vocab_spanish_amiga" },
            ]
          },
          {
            frame: "Él es mi ___.",
            frameTranslation: "He is my ___.",
            items: [
              { filler: "padre", fullSentence: "Él es mi padre.", translation: "He is my father.", imageKey: "vocab_spanish_padre" },
              { filler: "abuelo", fullSentence: "Él es mi abuelo.", translation: "He is my grandfather.", imageKey: "vocab_spanish_abuelo" },
              { filler: "hermano", fullSentence: "Él es mi hermano.", translation: "He is my brother.", imageKey: "vocab_spanish_hermano" },
              { filler: "tío", fullSentence: "Él es mi tío.", translation: "He is my uncle.", imageKey: "vocab_spanish_tio" },
              { filler: "primo", fullSentence: "Él es mi primo.", translation: "He is my cousin.", imageKey: "vocab_spanish_primo" },
              { filler: "amigo", fullSentence: "Él es mi amigo.", translation: "He is my friend.", imageKey: "vocab_spanish_amigo" },
            ]
          }
        ],
        genderFrame: { masculine: "Él es mi ___.", feminine: "Ella es mi ___." },
        genderPairs: [
          { masculine: "padre", feminine: "madre", translation: "father / mother" },
          { masculine: "hermano", feminine: "hermana", translation: "brother / sister" },
          { masculine: "abuelo", feminine: "abuela", translation: "grandfather / grandmother" },
          { masculine: "tío", feminine: "tía", translation: "uncle / aunt" },
          { masculine: "primo", feminine: "prima", translation: "cousin (male) / cousin (female)" }
        ],
        vocabQA: [
          { word: "madre", translation: "mother", question: "¿Quién es ella?", answer: "Ella es mi madre." },
          { word: "padre", translation: "father", question: "¿Quién es él?", answer: "Él es mi padre." },
          { word: "hermanos", translation: "siblings", question: "¿Tienes hermanos?", answer: "Sí, tengo un hermano y una hermana." },
          { word: "se llama", translation: "her/his name is", question: "¿Cómo se llama tu madre?", answer: "Mi madre se llama [nombre]." },
          { word: "familia", translation: "family", question: "¿Tienes familia aquí?", answer: "Sí, mi familia vive aquí." }
        ],
        verbGroups: [
          {
            verb: "ser",
            verbTranslation: "to be (identity or relationship)",
            examples: [
              { object: "mi padre", fullPhrase: "Él es mi padre.", translation: "He is my father." },
              { object: "mi madre", fullPhrase: "Ella es mi madre.", translation: "She is my mother." },
              { object: "mi hermano", fullPhrase: "Él es mi hermano.", translation: "He is my brother." },
              { object: "mi hermana", fullPhrase: "Ella es mi hermana.", translation: "She is my sister." },
              { object: "mi abuelo", fullPhrase: "Él es mi abuelo.", translation: "He is my grandfather." },
              { object: "mi tía", fullPhrase: "Ella es mi tía.", translation: "She is my aunt." }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "This chapter pulls together the most-used Spanish phrases in one place: time-of-day greetings, courtesy words, and the daily vocabulary that shows up in almost every conversation.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "Spanish greetings change with the time of day. Start your morning with 'Buenos d\u00edas', switch to 'Buenas tardes' after lunch, and greet the evening with 'Buenas noches'. These simple phrases open every conversation!",
            infographic: 'sunArcGreetings',
            tip: "Unlike English 'Good night' (only for goodbye), 'Buenas noches' works for both greeting and farewell."
          },
          {
            title: "Essential Courtesy",
            content: "Two magic words will take you far: 'Por favor' (please) and 'Gracias' (thank you). Add '\u00bfC\u00f3mo est\u00e1s?' (How are you?) and 'Muy bien' (Very well) to start friendly exchanges anywhere you go.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Build your vocabulary with everyday words: 'el d\u00eda' (the day), 'la ma\u00f1ana' (the morning), 'la noche' (the night), 'hoy' (today), 'ma\u00f1ana' (tomorrow). These building blocks appear in countless conversations.",
            tip: "Notice that 'ma\u00f1ana' means both 'morning' and 'tomorrow' \u2014 context tells you which!"
          }
        ],
        culturalSpotlight: {
          title: "El Paseo",
          content: "In many Spanish-speaking towns, the evening 'paseo' (stroll) is a cherished daily ritual. Families and friends walk through plazas and main streets, greeting neighbors, stopping for conversation, and enjoying the cool evening air. It's social life at its most organic and beautiful."
        },
        vocabQA: [
          { question: "¿Cómo estás hoy?", answer: "Estoy bien, gracias.", answerTranslation: "I'm well, thank you." },
          { question: "¿Qué hora es?", answer: "Son las diez de la mañana.", answerTranslation: "It is ten in the morning." },
          { question: "¿Qué día es hoy?", answer: "Hoy es lunes.", answerTranslation: "Today is Monday." },
          { question: "¿Qué haces por la mañana?", answer: "Me despierto a las siete.", answerTranslation: "I wake up at seven." },
          { question: "¿Tienes tiempo?", answer: "Sí, tengo un momento.", answerTranslation: "Yes, I have a moment." }
        ],
        verbGroups: [
          {
            verb: "hacer",
            verbTranslation: "to do / to make (daily activities)",
            examples: [
              { object: "ejercicio", fullPhrase: "Hago ejercicio por la mañana.", translation: "I exercise in the morning." },
              { object: "el desayuno", fullPhrase: "Hago el desayuno.", translation: "I make breakfast." },
              { object: "la tarea", fullPhrase: "Hago la tarea.", translation: "I do my homework." },
              { object: "una caminata", fullPhrase: "Hacemos una caminata.", translation: "We go for a walk." },
              { object: "planes", fullPhrase: "¿Qué haces hoy?", translation: "What are you doing today?" }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "The classroom is your launchpad. In this chapter, you'll learn the phrases that make every lesson more effective — asking your teacher to slow down, saying a word again, checking your understanding, and asking how to say something new. These phrases aren't just classroom tools; they're the habits of a great language learner.",
        narrativeSections: [
          {
            title: "Ask, Don't Guess",
            content: "The most important habit in language learning is asking when you don't understand. '¿Puede repetir?' (Can you repeat?), '¿Más despacio, por favor?' (More slowly, please), and '¿Cómo se dice...?' (How do you say...?) are your three most powerful tools. Using them shows confidence, not weakness.",
            tip: "Spanish teachers love engaged students. Raising your hand and asking '¿Puedo ir al baño?' (May I use the bathroom?) in Spanish instead of English earns real respect."
          },
          {
            title: "Common Classroom Commands",
            content: "Your teacher will use certain phrases constantly: 'Escuchen' (Listen), 'Repitan' (Repeat), 'Abran el libro' (Open the book), 'En parejas' (In pairs), 'Silencio' (Quiet). Recognizing these automatically puts you one step ahead in every lesson.",
            tip: "When your teacher says '¿Entienden?' (Do you understand?), it's fine to say 'Más o menos' (More or less) — that honesty helps them teach you better."
          },
          {
            title: "Checking and Confirming",
            content: "'¿Es correcto?' (Is that correct?), '¿Qué significa...?' (What does ... mean?), and 'No entiendo' (I don't understand) round out your survival kit. Pair these with '¿Puedo ver un ejemplo?' (Can I see an example?) and you'll never be stuck for long.",
            tip: "If you forget a word mid-sentence, '¿Cómo se llama esto?' (What is this called?) with a pointing gesture will always get you unstuck."
          }
        ],
        culturalSpotlight: {
          title: "El Respeto en el Aula",
          content: "In Spanish-speaking educational cultures, respect for the teacher is expressed actively — students say 'Buenos días, profesor/a' when class begins, stand or sit attentively, and address their teacher formally as 'usted'. This formality isn't distance; it's the cultural way of showing that learning is taken seriously. As a language student, adopting these habits signals genuine engagement."
        },
        vocabQA: [
          { question: "\u00bfPuede repetir, por favor?", answer: "Claro, con mucho gusto.", answerTranslation: "Of course, with pleasure." },
          { question: "\u00bfC\u00f3mo se dice 'hello' en espa\u00f1ol?", answer: "Se dice 'hola'.", answerTranslation: "You say 'hola'." },
          { question: "\u00bfEnt\u00edende usted?", answer: "No entiendo todav\u00eda.", answerTranslation: "I don't understand yet." },
          { question: "\u00bfEs correcto?", answer: "S\u00ed, es correcto.", answerTranslation: "Yes, it's correct." },
          { question: "\u00bfQu\u00e9 significa esta palabra?", answer: "Significa 'ma\u00f1ana'.", answerTranslation: "It means 'tomorrow'." }
        ],
        verbGroups: [
          {
            verb: "entender",
            verbTranslation: "to understand (core classroom verb \u2014 \u00bfEntiendes? is what every teacher asks)",
            examples: [
              { object: "la pregunta", fullPhrase: "Entiendo la pregunta.", translation: "I understand the question." },
              { object: "un poco", fullPhrase: "Entiendo un poco.", translation: "I understand a little." },
              { object: "nada", fullPhrase: "No entiendo nada.", translation: "I don't understand anything." },
              { object: "ya", fullPhrase: "\u00a1Ya entiendo!", translation: "Now I understand!" },
              { object: "todo", fullPhrase: "\u00bfLo entiendes todo?", translation: "Do you understand everything?" }
            ]
          }
        ]
      }
    }
  },

  french: {
    greetings: {
      morning: "Bonjour",
      afternoon: "Bonjour",
      evening: "Bonsoir"
    },
    formalInformal: [
      { formal: "Comment allez-vous ?", informal: "Comment \u00e7a va ?", context: "How are you?" },
      { formal: "Enchant\u00e9(e)", informal: "Ravi(e) de te conna\u00eetre !", context: "Nice to meet you" },
      { formal: "Excusez-moi", informal: "Pardon", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "Bonjour", meaning: "Hello" },
      { phrase: "Au revoir", meaning: "Goodbye" },
      { phrase: "S'il vous pla\u00eet", meaning: "Please" },
      { phrase: "Merci", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "In this chapter you'll learn Bonjour (morning through afternoon), Bonsoir (evening), how tu and vous split formal from informal, and the introductions that open every French conversation.",
        narrativeSections: [
          {
            title: "Time Matters",
            content: "'Bonjour' carries you through the day until early evening. When the sun begins to set, switch to 'Bonsoir'. The transition usually happens around 6 PM, though it can vary. 'Bonne nuit' is reserved specifically for bedtime \u2014 it's a farewell, not a greeting.",
            infographic: 'sunArcGreetings',
            tip: "There's no separate 'Good afternoon' in daily French speech \u2014 'Bonjour' covers both morning and afternoon."
          },
          {
            title: "The Art of Greeting",
            content: "In France, greetings are a matter of etiquette and respect. Walking into a shop without saying 'Bonjour' is considered rude. The French take time to acknowledge every person they encounter, whether it's a baker, a colleague, or a stranger on the street. This small gesture carries enormous social weight.",
            tip: "Always say 'Bonjour' when entering a shop in France \u2014 skipping it is one of the most common faux pas visitors make!"
          },
          {
            title: "Formal vs. Informal",
            content: "French has a clear distinction between 'vous' (formal/plural) and 'tu' (informal/singular). Using 'tu' with someone you've just met can feel presumptuous, while 'vous' shows respect. The moment someone invites you to 'se tutoyer' (use tu) is a social milestone.",
            infographic: 'formalInformal',
            tip: "In professional settings, always use 'vous' unless explicitly invited to switch. Some colleagues work together for years without switching!",
            discoveryNote: "vous uses the same verb endings as ils and elles. 'Comment allez-vous ?' (How are you — formal) and 'Comment vont-ils ?' (How are they going?) share the same conjugation root. Like Spanish usted, French builds formality through pronoun choice, not verb endings."
          }
        ],
        conversationStrips: [
          {
            title: "Une Salutation Informelle",
            context: "Vincent croise Juliette entre les cours",
            panels: [
              { speaker: "Vincent", gender: "male", text: "Salut, Juliette !", translation: "Hey, Juliette!" },
              { speaker: "Juliette", gender: "female", text: "Salut, Vincent ! Comment \u00e7a va ?", translation: "Hey, Vincent! How's it going?" },
              { speaker: "Vincent", gender: "male", text: "Tr\u00e8s bien, merci ! Et toi ?", translation: "Very well, thanks! And you?" },
              { speaker: "Juliette", gender: "female", text: "Bien ! \u00c0 tout \u00e0 l'heure !", translation: "Good! See you later!" }
            ]
          },
          {
            title: "Enchanté",
            context: "Vincent se présente à Juliette le premier jour",
            panels: [
              { speaker: "Vincent", gender: "male", text: "Bonjour, je m'appelle Vincent.", translation: "Hello, my name is Vincent." },
              { speaker: "Juliette", gender: "female", text: "Enchant\u00e9e, Vincent. Moi, c'est Juliette.", translation: "Pleased to meet you, Vincent. I'm Juliette." },
              { speaker: "Vincent", gender: "male", text: "Enchant\u00e9, Juliette.", translation: "Pleased to meet you, Juliette." }
            ]
          },
          {
            title: "Au Bureau \u2014 Le Registre Formel",
            context: "Vincent rencontre M. Dupont lors d\u2019une r\u00e9union — le 'vous' est de rigueur",
            panels: [
              { speaker: "Vincent", gender: "male", text: "Bonjour, monsieur. Je m'appelle Vincent Moreau.", translation: "Good morning, sir. My name is Vincent Moreau.", note: "Vincent uses 'vous' — the formal register" },
              { speaker: "M. Dupont", gender: "male", text: "Bonjour, monsieur Moreau. Enchanté. Je suis Dupont.", translation: "Good morning, Mr. Moreau. Pleased to meet you. I'm Dupont.", note: "Both use 'vous' as professional equals" },
              { speaker: "Vincent", gender: "male", text: "Ravi de vous rencontrer, monsieur Dupont.", translation: "Delighted to meet you, Mr. Dupont." }
            ]
          }
        ],
        culturalSpotlight: {
          title: "La Bise",
          content: "The French 'bise' \u2014 cheek kisses as greeting \u2014 is one of France's most iconic customs. The number of kisses varies by region: two in Paris, three in Provence, sometimes four in the north. It's an art form that signals warmth, familiarity, and belonging."
        },
        cognateOpener: [
          { english: "hotel", target: "hôtel", spanish: "", category: "identical" },
          { english: "taxi", target: "taxi", spanish: "", category: "identical" },
          { english: "restaurant", target: "restaurant", spanish: "", category: "identical" },
          { english: "concert", target: "concert", spanish: "", category: "identical" },
          { english: "sport", target: "sport", spanish: "", category: "identical" },
          { english: "possible", target: "possible", spanish: "", category: "near-identical" },
          { english: "important", target: "important", spanish: "", category: "near-identical" },
          { english: "excellent", target: "excellent", spanish: "", category: "near-identical" },
          { english: "original", target: "original", spanish: "", category: "near-identical" },
          { english: "nation", target: "nation", spanish: "", category: "-tion \u2192 -tion (same!)" },
          { english: "attention", target: "attention", spanish: "", category: "-tion \u2192 -tion (same!)" },
          { english: "information", target: "information", spanish: "", category: "-tion \u2192 -tion (same!)" },
          { english: "artist", target: "artiste", spanish: "", category: "-ist \u2192 -iste" },
          { english: "tourist", target: "touriste", spanish: "", category: "-ist \u2192 -iste" },
          { english: "optimist", target: "optimiste", spanish: "", category: "-ist \u2192 -iste" },
          { english: "actual", target: "actuel", spanish: "", category: "false-friend", isFalseCognate: true, falseCognateNote: "actuel = current, not actual" },
          { english: "sensible", target: "sensible", spanish: "", category: "false-friend", isFalseCognate: true, falseCognateNote: "sensible = sensitive, not sensible" },
          { english: "to rest", target: "rester", spanish: "", category: "false-friend", isFalseCognate: true, falseCognateNote: "rester = to stay/remain, not to rest" }
        ],
        genderPairs: [
          { masculine: "joyeux",   feminine: "joyeuse",   translation: "joyful / happy" },
          { masculine: "fatigué", feminine: "fatiguée", translation: "tired" },
          { masculine: "occupé",  feminine: "occupée",  translation: "busy" },
          { masculine: "malade",   feminine: "malade",    translation: "sick — same form for both!" },
          { masculine: "nerveux",  feminine: "nerveuse",  translation: "nervous" }
        ],
        vocabQA: [
          { question: "Comment vous appelez-vous ?", answer: "Je m’appelle [nom].", word: "appeler", translation: "to call oneself (formal)" },
          { question: "Comment allez-vous ?", answer: "Je vais très bien, merci. Et vous ?", word: "allez-vous", translation: "how are you? (formal)" },
          { question: "Comment tu t’appelles ?", answer: "Je m’appelle [nom].", word: "t’appelles", translation: "you call yourself (informal)" },
          { question: "Comment ça va ?", answer: "Ça va bien, merci.", word: "ça va", translation: "it goes / how’s it going?" },
          { question: "Enchanté(e).", answer: "Enchanté(e). / Ravi(e) de vous rencontrer.", word: "enchanté", translation: "delighted / pleased to meet you" },
          { question: "D’où venez-vous ?", answer: "Je viens de [ville].", word: "venez", translation: "you come (from)" }
        ],
        verbGroups: [
          {
            verb: "être",
            verbTranslation: "to be (state or condition)",
            verbHint: "In French, être links you to descriptions — Madrigal calls this the identity bridge.",
            examples: [
              { object: "bien",         fullPhrase: "Je suis bien.",        translation: "I am well." },
              { object: "fatigué(e)", fullPhrase: "Je suis fatigué.", translation: "I am tired." },
              { object: "content(e)",   fullPhrase: "Je suis content.",    translation: "I am happy." },
              { object: "occupé(e)",  fullPhrase: "Je suis occupé.", translation: "I am busy." },
              { object: "malade",       fullPhrase: "Je suis malade.",     translation: "I am sick." },
              { object: "nerveux",      fullPhrase: "Je suis nerveux.",    translation: "I am nervous." }
            ]
          }
        ]
      },
      numbers: {
        welcomeText: "French numbers work simply from 1 to 69, then turn mathematical: 70 is soixante-dix (sixty-ten), 80 is quatre-vingts (four-twenties). This chapter covers the full system — including how to read prices and give a phone number.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "French numbers from 1 to 16 each have their own name. From 17 onward, they begin to follow patterns. The real adventure starts at 70 \u2014 'soixante-dix' (sixty-ten) \u2014 and 80 \u2014 'quatre-vingts' (four-twenties). This vigesimal (base-20) system is a living relic of medieval counting!",
            tip: "In Belgium and Switzerland, 70 is 'septante' and 90 is 'nonante' \u2014 much simpler! But in France, you'll need the math."
          },
          {
            title: "Numbers in Daily Life",
            content: "Numbers appear everywhere in French life: ordering 'deux croissants' at the boulangerie, reading prices in euros, giving your phone number ('z\u00e9ro six'), or telling time. Practice makes these second nature.",
            tip: "French phone numbers are spoken in pairs: 06 12 34 56 78 becomes 'z\u00e9ro six, douze, trente-quatre, cinquante-six, soixante-dix-huit'."
          }
        ],
        culturalSpotlight: {
          title: "Le Chiffre 13",
          content: "In France, the number 13 has a complicated reputation. While some consider it unlucky (many buildings skip the 13th floor), others see it as a lucky number \u2014 the French national lottery specifically promotes Friday the 13th draws as extra-lucky events, and ticket sales soar on those dates!"
        },
        vocabQA: [
          { question: "Quel \u00e2ge avez-vous ?", answer: "J'ai vingt-cinq ans.", answerTranslation: "I am twenty-five years old." },
          { question: "Combien \u00e7a co\u00fbte ?", answer: "\u00c7a co\u00fbte dix euros.", answerTranslation: "It costs ten euros." },
          { question: "Quelle heure est-il ?", answer: "Il est trois heures.", answerTranslation: "It is three o'clock." },
          { question: "Combien de personnes y a-t-il ?", answer: "Il y a cinq personnes.", answerTranslation: "There are five people." },
          { question: "Quel est ton num\u00e9ro de t\u00e9l\u00e9phone ?", answer: "Mon num\u00e9ro, c'est le 06-12-34-56.", answerTranslation: "My number is 06-12-34-56." }
        ],
        verbGroups: [
          {
            verb: "avoir",
            verbTranslation: "to have (age, possessions)",
            examples: [
              { object: "vingt ans", fullPhrase: "J'ai vingt ans.", translation: "I am twenty years old." },
              { object: "faim", fullPhrase: "J'ai faim.", translation: "I am hungry." },
              { object: "de l'argent", fullPhrase: "J'ai de l'argent.", translation: "I have money." },
              { object: "le temps", fullPhrase: "Je n'ai pas le temps.", translation: "I don't have time." },
              { object: "une question", fullPhrase: "J'ai une question.", translation: "I have a question." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "French family life blends tradition with modern values. In this chapter, you'll learn the vocabulary to describe your family and understand how French culture views the bonds between generations, from the formal address of grandparents to playful sibling nicknames.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "French families value both independence and togetherness. Children often stay close to home through university, and Sunday family lunches are a cherished tradition. Vocabulary like 'p\u00e8re' (father), 'm\u00e8re' (mother), 'fr\u00e8re' (brother), and 's\u0153ur' (sister) form the foundation.",
            tip: "In French, 'parents' can mean both 'parents' and 'relatives' depending on context \u2014 'mes parents' usually means your mom and dad."
          },
          {
            title: "Extended Family",
            content: "French has precise terms for extended family: 'belle-m\u00e8re' (mother-in-law or stepmother), 'beau-fr\u00e8re' (brother-in-law), 'neveu' (nephew), 'ni\u00e8ce' (niece). The 'beau/belle' prefix elegantly handles both in-law and step-relationships."
          }
        ],
        culturalSpotlight: {
          title: "Le D\u00e9jeuner du Dimanche",
          content: "The Sunday family lunch is sacred in French culture. Multiple generations gather around a table for a meal that can last three to four hours, with multiple courses, wine, cheese, and lively conversation. It's where family recipes are passed down and stories are shared across generations."
        },
        genderFrame: { masculine: "C'est mon ___.", feminine: "C'est ma ___." },
        genderPairs: [
          { masculine: "mon p\u00e8re",       feminine: "ma m\u00e8re",        translation: "my father / my mother"           },
          { masculine: "mon fr\u00e8re",      feminine: "ma s\u0153ur",        translation: "my brother / my sister"          },
          { masculine: "mon grand-p\u00e8re", feminine: "ma grand-m\u00e8re",  translation: "my grandfather / my grandmother" },
          { masculine: "mon oncle",       feminine: "ma tante",        translation: "my uncle / my aunt"              },
          { masculine: "mon cousin",      feminine: "ma cousine",      translation: "my (male) / my (female) cousin"  }
        ],
        vocabQA: [
          { question: "Vous avez des fr\u00e8res et s\u0153urs\u00a0?",     answer: "Oui, j\u2019ai un fr\u00e8re et une s\u0153ur.", word: "fr\u00e8res et s\u0153urs", translation: "brothers and sisters" },
          { question: "Qui est-ce\u00a0?",                             answer: "C\u2019est mon p\u00e8re.",                   word: "qui est-ce",           translation: "who is this?"          },
          { question: "Comment s\u2019appelle votre m\u00e8re\u00a0?",       answer: "Elle s\u2019appelle Marie.",                  word: "s\u2019appelle",              translation: "is named"              },
          { question: "Combien de personnes dans votre famille\u00a0?", answer: "Nous sommes cinq dans ma famille.",          word: "combien",              translation: "how many"              },
          { question: "Vos parents habitent o\u00f9\u00a0?",                  answer: "Mes parents habitent \u00e0 Paris.",           word: "habitent",             translation: "live / reside"         }
        ],
        verbGroups: [
          {
            verb: "\u00eatre",
            verbTranslation: "to be (identity)",
            examples: [
              { object: "mon p\u00e8re",    fullPhrase: "C\u2019est mon p\u00e8re.",    translation: "This is my father."       },
              { object: "ma m\u00e8re",     fullPhrase: "C\u2019est ma m\u00e8re.",     translation: "This is my mother."       },
              { object: "mon fr\u00e8re",   fullPhrase: "C\u2019est mon fr\u00e8re.",   translation: "This is my brother."      },
              { object: "ma s\u0153ur",     fullPhrase: "C\u2019est ma s\u0153ur.",     translation: "This is my sister."       },
              { object: "mes parents", fullPhrase: "Ce sont mes parents.", translation: "These are my parents." }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "Everyday French is filled with graceful expressions and polite formulas. This chapter builds your daily vocabulary so you can navigate French life with confidence, from morning greetings to evening farewells.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "Start every interaction with 'Bonjour' \u2014 it's the golden rule of French politeness. As evening arrives, switch to 'Bonsoir'. When parting, 'Au revoir' works anytime, while 'Bonne journ\u00e9e' (Have a good day) adds a warm touch.",
            infographic: 'sunArcGreetings',
            tip: "Add 'Madame' or 'Monsieur' after 'Bonjour' for extra politeness \u2014 it's always appreciated."
          },
          {
            title: "Essential Courtesy",
            content: "French culture places enormous value on politeness. 'S'il vous pla\u00eet' (please), 'Merci' (thank you), and 'De rien' (you're welcome) are your daily essentials. Add 'Pardon' for navigating crowds and 'Excusez-moi' for getting attention.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Essential daily vocabulary includes 'aujourd'hui' (today), 'demain' (tomorrow), 'le matin' (morning), 'le soir' (evening), 'oui' (yes), and 'non' (no). These simple words appear in nearly every French conversation.",
            tip: "French speakers often add 'Allez, bonne journ\u00e9e !' when saying goodbye \u2014 it's a cheerful way to part ways."
          }
        ],
        culturalSpotlight: {
          title: "L'Ap\u00e9ro",
          content: "The 'ap\u00e9ritif' or 'ap\u00e9ro' is a beloved French daily ritual \u2014 a pre-dinner drink with light snacks shared among friends or family. Usually happening around 7 PM, it's a time to unwind, catch up, and transition from work to leisure. It's less about the drink and more about the moment of togetherness."
        },
        vocabQA: [
          { question: "Comment allez-vous aujourd'hui ?", answer: "Je vais tr\u00e8s bien, merci.", answerTranslation: "I'm very well, thank you." },
          { question: "Quelle heure est-il ?", answer: "Il est dix heures du matin.", answerTranslation: "It is ten in the morning." },
          { question: "Quel jour sommes-nous ?", answer: "C'est lundi aujourd'hui.", answerTranslation: "Today is Monday." },
          { question: "Qu'est-ce que vous faites le matin ?", answer: "Je me l\u00e8ve \u00e0 sept heures.", answerTranslation: "I get up at seven." },
          { question: "Avez-vous le temps ?", answer: "Oui, j'ai un moment.", answerTranslation: "Yes, I have a moment." }
        ],
        verbGroups: [
          {
            verb: "faire",
            verbTranslation: "to do / to make (daily activities)",
            examples: [
              { object: "du sport", fullPhrase: "Je fais du sport le matin.", translation: "I exercise in the morning." },
              { object: "la cuisine", fullPhrase: "Elle fait la cuisine.", translation: "She cooks." },
              { object: "les courses", fullPhrase: "Tu fais les courses ?", translation: "Are you doing the shopping?" },
              { object: "les devoirs", fullPhrase: "Il fait ses devoirs.", translation: "He does his homework." },
              { object: "une promenade", fullPhrase: "Nous faisons une promenade.", translation: "We go for a walk." }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "Bienvenue en classe ! The French classroom comes with its own vocabulary — and knowing it makes you a more confident, independent learner. This chapter covers what to say when you're lost, how to ask for clarification politely, and the expressions that will carry you through every French lesson.",
        narrativeSections: [
          {
            title: "Ask with Confidence",
            content: "'Pouvez-vous répéter ?' (Can you repeat?), 'Plus lentement, s'il vous plaît' (More slowly, please), and 'Comment dit-on ... ?' (How do you say ... ?) are essential tools. French teachers appreciate students who ask — it's a sign of genuine engagement, not confusion.",
            tip: "Use 'Excusez-moi' before asking a question in class — it's the polite way to get your teacher's attention without interrupting."
          },
          {
            title: "Understanding Instructions",
            content: "Your teacher will give instructions like 'Écoutez' (Listen), 'Répétez' (Repeat), 'Lisez' (Read), 'Écrivez' (Write), 'Ouvrez votre livre' (Open your book), 'En groupes' (In groups). Recognizing these automatically keeps you from falling behind.",
            tip: "'Je ne comprends pas' (I don't understand) is not an admission of failure — in French culture, precision and honesty are respected."
          },
          {
            title: "Checking Your Work",
            content: "'C'est correct ?' (Is that correct?), 'Que signifie ... ?' (What does ... mean?), 'Je ne suis pas sûr(e)' (I'm not sure), and 'Pouvez-vous expliquer ?' (Can you explain?) close the gap between confusion and clarity.",
            tip: "If you've made an error, try 'Je me suis trompé(e)' (I made a mistake) — owning your errors gracefully is considered mature and admirable."
          }
        ],
        culturalSpotlight: {
          title: "Le Respect en Classe",
          content: "French classroom culture prizes intellectual rigor and respectful debate. Students address teachers as 'Monsieur' or 'Madame', and raising a hand before speaking is expected. At the same time, French education encourages questioning — a student who challenges an idea thoughtfully is respected. As a language learner, engaging seriously with the material is the best compliment you can pay a French teacher."
        },
        vocabQA: [
          { question: "Pouvez-vous r\u00e9p\u00e9ter, s'il vous pla\u00eet ?", answer: "Bien s\u00fbr, avec plaisir.", answerTranslation: "Of course, with pleasure." },
          { question: "Comment dit-on 'hello' en fran\u00e7ais ?", answer: "On dit 'bonjour'.", answerTranslation: "We say 'bonjour'." },
          { question: "Comprenez-vous ?", answer: "Je ne comprends pas encore.", answerTranslation: "I don't understand yet." },
          { question: "C'est correct ?", answer: "Oui, c'est correct.", answerTranslation: "Yes, it's correct." },
          { question: "Que signifie ce mot ?", answer: "Ca signifie 'demain'.", answerTranslation: "It means 'tomorrow'." }
        ],
        verbGroups: [
          {
            verb: "comprendre",
            verbTranslation: "to understand (from Latin comprehendere; note the irregular \u2014 je comprends, nous comprenons)",
            examples: [
              { object: "la question", fullPhrase: "Je comprends la question.", translation: "I understand the question." },
              { object: "un peu", fullPhrase: "Je comprends un peu.", translation: "I understand a little." },
              { object: "rien", fullPhrase: "Je ne comprends rien.", translation: "I don't understand anything." },
              { object: "maintenant", fullPhrase: "Ah, je comprends maintenant !", translation: "Ah, now I understand!" },
              { object: "bien", fullPhrase: "Tu comprends bien ?", translation: "Do you understand well?" }
            ]
          }
        ]
      }
    }
  },

  german: {
    greetings: {
      morning: "Guten Morgen",
      afternoon: "Guten Tag",
      evening: "Guten Abend"
    },
    formalInformal: [
      { formal: "Wie geht es Ihnen?", informal: "Wie geht's?", context: "How are you?" },
      { formal: "Freut mich, Sie kennenzulernen", informal: "Freut mich!", context: "Nice to meet you" },
      { formal: "Entschuldigen Sie", informal: "Entschuldigung", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "Hallo", meaning: "Hello" },
      { phrase: "Tsch\u00fcss", meaning: "Goodbye" },
      { phrase: "Bitte", meaning: "Please" },
      { phrase: "Danke", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "German has a greeting for every time of day: Guten Morgen, Guten Tag, Guten Abend. In this chapter, you'll also learn when to use Sie vs. du — and regional variants like Grüß Gott and Moin.",
        narrativeSections: [
          {
            title: "Time Matters",
            content: "'Guten Morgen' starts your day, 'Guten Tag' carries you through the afternoon, and 'Guten Abend' welcomes the evening. Germans are punctual people, and their greetings reflect this awareness of time. 'Gute Nacht' is only for bedtime.",
            infographic: 'sunArcGreetings',
            tip: "The shift from 'Guten Morgen' to 'Guten Tag' happens around noon \u2014 Germans take their meal times seriously!"
          },
          {
            title: "The Art of Greeting",
            content: "Germans value directness and sincerity in their greetings. A firm handshake and direct eye contact are standard when meeting someone. In Bavaria, you might hear 'Gr\u00fc\u00df Gott' instead of 'Hallo', while in northern Germany, 'Moin' covers all times of day. Each region adds its own character.",
            tip: "'Moin' is used in northern Germany for any time of day \u2014 morning, noon, or night. It's one of the friendliest greetings you'll hear!"
          },
          {
            title: "Formal vs. Informal",
            content: "German has a clear formal/informal distinction with 'Sie' (formal you) and 'du' (informal you). Using 'du' prematurely can be awkward, while 'Sie' shows professionalism. The ritual of offering the 'Du' (called 'Duzen') is a meaningful social moment.",
            infographic: 'formalInformal',
            tip: "In modern German workplaces, many companies use 'du' among all employees \u2014 but always wait for the offer!",
            discoveryNote: "German capitalizes the formal Sie to separate it from sie (she) and sie (they) — three words, one pronunciation, three meanings. In writing, the capital letter is the only visual cue. Spoken aloud, context does all the work."
          }
        ],
        conversationStrips: [
          {
            title: "Eine Lockere Begr\u00fc\u00dfung",
            context: "Lukas begegnet Greta im Schulflur",
            panels: [
              { speaker: "Lukas", gender: "male", text: "Hallo, Greta!", translation: "Hey, Greta!" },
              { speaker: "Greta", gender: "female", text: "Hallo, Lukas! Wie geht's?", translation: "Hey, Lukas! How's it going?" },
              { speaker: "Lukas", gender: "male", text: "Gut, danke! Und dir?", translation: "Good, thanks! And you?" },
              { speaker: "Greta", gender: "female", text: "Gut! Tsch\u00fcss!", translation: "Good! Bye!" }
            ]
          },
          {
            title: "Sch\u00f6n, dich kennenzulernen",
            context: "Lukas stellt sich Greta am ersten Tag vor",
            panels: [
              { speaker: "Lukas", gender: "male", text: "Hallo, ich hei\u00dfe Lukas.", translation: "Hello, my name is Lukas." },
              { speaker: "Greta", gender: "female", text: "Freut mich, Lukas. Ich bin Greta.", translation: "Nice to meet you, Lukas. I'm Greta." },
              { speaker: "Lukas", gender: "male", text: "Freut mich auch, Greta.", translation: "Nice to meet you too, Greta." }
            ]
          },
          {
            title: "Bei Oma \u2014 Der Formelle Ton",
            context: "Lukas besucht seine Gro\u00dfmutter \u2014 er spricht sie immer mit \u2018Sie\u2019 an",
            panels: [
              { speaker: "Lukas", gender: "male", text: "Guten Morgen, Oma. Wie geht es Ihnen?", translation: "Good morning, Grandma. How are you?", note: "Lukas uses 'Sie' — showing respect for elders" },
              { speaker: "Oma", gender: "female", text: "Gut, danke, Lukas. Und dir?", translation: "Fine, thank you, Lukas. And you?", note: "Grandma uses 'du' back — she is the elder" },
              { speaker: "Lukas", gender: "male", text: "Danke, Oma. Gut.", translation: "Thank you, Grandma. Fine." }
            ]
          }
        ],
        culturalSpotlight: {
          title: "Der Handschlag",
          content: "The German handshake is brief, firm, and accompanied by direct eye contact. Unlike cultures with cheek kisses, Germans keep a respectful physical distance with acquaintances. This straightforward greeting reflects the German values of honesty, reliability, and mutual respect."
        },
        cognateOpener: [
          { english: "hotel", target: "Hotel", spanish: "", category: "identical" },
          { english: "sport", target: "Sport", spanish: "", category: "identical" },
          { english: "tennis", target: "Tennis", spanish: "", category: "identical" },
          { english: "internet", target: "Internet", spanish: "", category: "identical" },
          { english: "computer", target: "Computer", spanish: "", category: "identical" },
          { english: "moment", target: "Moment", spanish: "", category: "near-identical" },
          { english: "telephone", target: "Telefon", spanish: "", category: "near-identical" },
          { english: "music", target: "Musik", spanish: "", category: "near-identical" },
          { english: "problem", target: "Problem", spanish: "", category: "near-identical" },
          { english: "nation", target: "Nation", spanish: "", category: "-tion → -tion (same!)" },
          { english: "action", target: "Aktion", spanish: "", category: "-tion → -tion (same!)" },
          { english: "information", target: "Information", spanish: "", category: "-tion → -tion (same!)" },
          { english: "artist", target: "Artist", spanish: "", category: "-ist → -ist (same!)" },
          { english: "tourist", target: "Tourist", spanish: "", category: "-ist → -ist (same!)" },
          { english: "optimist", target: "Optimist", spanish: "", category: "-ist → -ist (same!)" },
          { english: "actual", target: "aktuell", spanish: "", category: "false-friend", isFalseCognate: true, falseCognateNote: "aktuell = current, not actual" },
          { english: "sympathetic", target: "sympathisch", spanish: "", category: "false-friend", isFalseCognate: true, falseCognateNote: "sympathisch = nice/likable, not sympathetic" },
          { english: "sensible", target: "sensibel", spanish: "", category: "false-friend", isFalseCognate: true, falseCognateNote: "sensibel = sensitive, not sensible" }
        ],
        vocabQA: [
          { question: "Wie heißen Sie?", answer: "Ich heiße [Name].", word: "heiße", translation: "I am called (formal)" },
          { question: "Wie heißt du?", answer: "Ich heiße [Name].", word: "heißt", translation: "you are called (informal)" },
          { question: "Wie geht es Ihnen?", answer: "Es geht mir gut, danke. Und Ihnen?", word: "geht es", translation: "how does it go? (formal)" },
          { question: "Wie geht’s?", answer: "Gut, danke. Und dir?", word: "geht’s", translation: "how’s it going? (informal)" },
          { question: "Sehr erfreut.", answer: "Ganz meinerseits.", word: "erfreut", translation: "delighted / pleased to meet you" },
          { question: "Woher kommen Sie?", answer: "Ich komme aus [Stadt].", word: "komme", translation: "I come (from)" }
        ],
        verbGroups: [
          {
            verb: "sein",
            verbTranslation: "to be (state or identity)",
            verbHint: "Sein links you to descriptions and identities — just as ser does in Spanish.",
            examples: [
              { object: "gut",          fullPhrase: "Es geht mir gut.",    translation: "I am doing well." },
              { object: "müde",       fullPhrase: "Ich bin müde.",     translation: "I am tired." },
              { object: "beschäftigt", fullPhrase: "Ich bin beschäftigt.", translation: "I am busy." },
              { object: "krank",        fullPhrase: "Ich bin krank.",      translation: "I am sick." },
              { object: "nervös",     fullPhrase: "Ich bin nervös.",   translation: "I am nervous." },
              { object: "glücklich",  fullPhrase: "Ich bin glücklich.", translation: "I am happy." }
            ]
          }
        ],
        cognateOpener: [
          { native: "hotel",          english: "hotel",                              category: "place"         },
          { native: "t\u00e1xi",          english: "taxi",                               category: "transport"     },
          { native: "restaurante",   english: "restaurant",                         category: "food"          },
          { native: "poss\u00edvel",       english: "possible",                           category: "concept"       },
          { native: "importante",    english: "important",                          category: "concept"       },
          { native: "excelente",     english: "excellent",                          category: "concept"       },
          { native: "natural",       english: "natural",                            category: "concept"       },
          { native: "social",        english: "social",                             category: "concept"       },
          { native: "nacional",      english: "national",                           category: "concept"       },
          { native: "animal",        english: "animal",                             category: "concept"       },
          { native: "digital",       english: "digital",                            category: "concept"       },
          { native: "hospital",      english: "hospital",                           category: "place"         },
          { native: "central",       english: "central",                            category: "concept"       },
          { native: "tropical",      english: "tropical",                           category: "concept"       },
          { native: "total",         english: "total",                              category: "concept"       },
          { native: "musical",       english: "musical",                            category: "concept"       },
          { native: "polvo",         english: "octopus \u2014 not \u201cpowder\u201d",          category: "false-friend"  },
          { native: "borracha",      english: "rubber / drunk (f.) \u2014 not simply \u201cdrunk\u201d", category: "false-friend"  },
          { native: "pretender",     english: "to intend \u2014 not \u201cto pretend\u201d",    category: "false-friend"  }
        ]
      },
      numbers: {
        welcomeText: "German reverses the ones and tens: 25 is fünfundzwanzig — five-and-twenty. This chapter covers 1 through 1,000, plus how Germans write numbers differently than English speakers.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "German numbers from 1 to 12 are unique words. Starting at 13, they combine: 'dreizehn' (three-ten). The twist comes with two-digit numbers: 25 is 'f\u00fcnfundzwanzig' (five-and-twenty). Yes, Germans say the ones digit first! This takes practice but becomes natural.",
            tip: "Think of it like saying 'five-and-twenty' instead of 'twenty-five' \u2014 it's the same in old English nursery rhymes!"
          },
          {
            title: "Numbers in Daily Life",
            content: "Numbers are essential for shopping at German markets, reading train schedules (Germans love their trains!), and understanding prices in euros. Practice with real scenarios: 'Das kostet drei Euro f\u00fcnfzig' (That costs three euros fifty).",
            tip: "Germans write numbers differently: 1.000 means one thousand (using a period), and 3,50 means three and a half (using a comma for decimals)."
          }
        ],
        culturalSpotlight: {
          title: "Schnapszahl",
          content: "Germans have a special love for repeating numbers like 11:11. Called 'Schnapszahlen' (schnapps numbers), these are considered moments worth celebrating \u2014 you might catch a German smiling at the clock at 22:22. On November 11th at 11:11 AM, the Carnival season officially begins across Germany!"
        },
        vocabQA: [
          { question: "Wie alt bist du?", answer: "Ich bin f\u00fcnfundzwanzig Jahre alt.", answerTranslation: "I am twenty-five years old." },
          { question: "Was kostet das?", answer: "Das kostet zehn Euro.", answerTranslation: "That costs ten euros." },
          { question: "Wie sp\u00e4t ist es?", answer: "Es ist drei Uhr.", answerTranslation: "It is three o'clock." },
          { question: "Wie viele Leute sind da?", answer: "Da sind f\u00fcnf Leute.", answerTranslation: "There are five people." },
          { question: "Wie ist deine Telefonnummer?", answer: "Meine Nummer ist 030 12 34 56.", answerTranslation: "My number is 030 12 34 56." }
        ],
        verbGroups: [
          {
            verb: "sein",
            verbTranslation: "to be (German uses sein for age — unlike Romance languages that use 'have')",
            examples: [
              { object: "zwanzig Jahre alt", fullPhrase: "Ich bin zwanzig Jahre alt.", translation: "I am twenty years old." },
              { object: "m\u00fcde", fullPhrase: "Ich bin m\u00fcde.", translation: "I am tired." },
              { object: "drei\u00dfig", fullPhrase: "Sie ist drei\u00dfig.", translation: "She is thirty." },
              { object: "f\u00fcnfzig", fullPhrase: "Er ist f\u00fcnfzig.", translation: "He is fifty." },
              { object: "jung", fullPhrase: "Wir sind jung.", translation: "We are young." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "German family vocabulary reflects a culture that values both tradition and modern flexibility. In this chapter, you'll learn the words for family members and discover how family life is structured in German-speaking countries.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "The German 'Familie' traditionally centers on the nuclear household: 'Vater' (father), 'Mutter' (mother), 'Bruder' (brother), 'Schwester' (sister). Modern German families are diverse, and the language has adapted with terms like 'Patchwork-Familie' for blended families.",
            tip: "German compound words shine with family terms: 'Geschwister' means siblings, and there's no direct English equivalent for this useful word!"
          },
          {
            title: "Extended Family",
            content: "German has clear terms for extended family: 'Schwiegermutter' (mother-in-law), 'Schwager' (brother-in-law), 'Neffe' (nephew), 'Nichte' (niece). The 'Schwieger-' prefix handles all in-law relationships systematically \u2014 very German in its efficiency!"
          }
        ],
        culturalSpotlight: {
          title: "Der Sonntagskuchen",
          content: "In German families, Sunday afternoon 'Kaffee und Kuchen' (coffee and cake) is a beloved tradition. Families gather around the table for homemade cake \u2014 often Schwarzw\u00e4lder Kirschtorte or Apfelstrudel \u2014 with strong coffee. It's a weekly ritual that keeps family bonds strong across generations."
        },
        vocabQA: [
          { question: "Haben Sie Geschwister?",                            answer: "Ja, ich habe einen Bruder und eine Schwester.", word: "Geschwister",  translation: "siblings"      },
          { question: "Wer ist das?",                                      answer: "Das ist mein Vater.",                          word: "wer ist das",  translation: "who is this?"  },
          { question: "Wie hei\u00dft Ihre Mutter?",                           answer: "Sie hei\u00dft Maria.",                           word: "hei\u00dft",        translation: "is named"      },
          { question: "Wie viele Personen sind in Ihrer Familie?",         answer: "Wir sind f\u00fcnf in meiner Familie.",            word: "wie viele",    translation: "how many"      },
          { question: "Wo wohnen Ihre Eltern?",                            answer: "Meine Eltern wohnen in Berlin.",               word: "wohnen",       translation: "live / reside" }
        ],
        verbGroups: [
          {
            verb: "sein",
            verbTranslation: "to be (identity)",
            examples: [
              { object: "mein Vater",    fullPhrase: "Das ist mein Vater.",    translation: "This is my father."  },
              { object: "meine Mutter",  fullPhrase: "Das ist meine Mutter.",  translation: "This is my mother."  },
              { object: "mein Bruder",   fullPhrase: "Das ist mein Bruder.",   translation: "This is my brother." },
              { object: "meine Schwester", fullPhrase: "Das ist meine Schwester.", translation: "This is my sister."  },
              { object: "meine Familie", fullPhrase: "Das ist meine Familie.", translation: "This is my family."  }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "German daily life runs on efficiency and courtesy. This chapter equips you with the essential vocabulary for navigating everyday situations, from morning routines to evening exchanges in German-speaking countries.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "Begin your morning with 'Guten Morgen', transition to 'Guten Tag' after noon, and welcome the evening with 'Guten Abend'. For quick, informal greetings, simply say 'Hallo' or the regional 'Servus' in southern areas.",
            infographic: 'sunArcGreetings',
            tip: "Short on time? Just say 'Morgen!' or 'Abend!' \u2014 Germans often shorten greetings in casual settings."
          },
          {
            title: "Essential Courtesy",
            content: "'Bitte' is the Swiss army knife of German politeness \u2014 it means 'please', 'you're welcome', and 'here you go'. Pair it with 'Danke' (thank you) and 'Entschuldigung' (excuse me) and you'll navigate any social situation with grace.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Stock your vocabulary with daily essentials: 'heute' (today), 'morgen' (tomorrow), 'ja' (yes), 'nein' (no), 'der Tag' (the day), 'die Nacht' (the night). These words form the backbone of countless German conversations.",
            tip: "Careful! 'Morgen' means both 'morning' and 'tomorrow' \u2014 and 'morgen Morgen' means 'tomorrow morning'!"
          }
        ],
        culturalSpotlight: {
          title: "Die Abendbrot-Tradition",
          content: "Germans have a unique daily tradition called 'Abendbrot' (evening bread) \u2014 a simple cold supper of bread, cheese, cold cuts, and pickles eaten in the early evening. Unlike many cultures that make dinner the biggest meal, Germans keep it light and cozy, often eaten together as a family around 6 PM."
        },
        vocabQA: [
          { question: "Wie geht es Ihnen heute?", answer: "Es geht mir gut, danke.", answerTranslation: "I'm doing well, thank you." },
          { question: "Wie sp\u00e4t ist es?", answer: "Es ist zehn Uhr morgens.", answerTranslation: "It is ten in the morning." },
          { question: "Welcher Tag ist heute?", answer: "Heute ist Montag.", answerTranslation: "Today is Monday." },
          { question: "Was machen Sie morgens?", answer: "Ich stehe um sieben Uhr auf.", answerTranslation: "I get up at seven o'clock." },
          { question: "Haben Sie Zeit?", answer: "Ja, ich habe einen Moment Zeit.", answerTranslation: "Yes, I have a moment." }
        ],
        verbGroups: [
          {
            verb: "machen",
            verbTranslation: "to do / to make (daily activities)",
            examples: [
              { object: "Sport", fullPhrase: "Ich mache morgens Sport.", translation: "I exercise in the morning." },
              { object: "das Fr\u00fchst\u00fcck", fullPhrase: "Sie macht das Fr\u00fchst\u00fcck.", translation: "She makes breakfast." },
              { object: "die Hausaufgaben", fullPhrase: "Er macht seine Hausaufgaben.", translation: "He does his homework." },
              { object: "einen Spaziergang", fullPhrase: "Wir machen einen Spaziergang.", translation: "We go for a walk." },
              { object: "das", fullPhrase: "Was machst du heute?", translation: "What are you doing today?" }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "Willkommen im Unterricht! The German classroom is structured and efficient — and so is its classroom language. This chapter gives you the phrases to navigate every lesson confidently, ask exactly what you need, and understand your teacher's instructions without hesitation.",
        narrativeSections: [
          {
            title: "Fragen Stellen — Ask Clearly",
            content: "'Können Sie das wiederholen?' (Can you repeat that?), 'Langsamer bitte' (More slowly please), and 'Wie sagt man ... auf Deutsch?' (How do you say ... in German?) are your essential tools. German teachers respect directness — asking precisely is better than guessing and getting it wrong.",
            tip: "In German classrooms, raise your hand and say 'Entschuldigung' (Excuse me) before asking — it shows proper classroom etiquette."
          },
          {
            title: "Anweisungen Verstehen — Understanding Instructions",
            content: "Learn to recognize: 'Hören Sie zu' (Listen), 'Wiederholen Sie' (Repeat), 'Lesen Sie' (Read), 'Schreiben Sie' (Write), 'Öffnen Sie das Buch' (Open the book), 'Zu zweit' (In pairs). Responding promptly to these instructions marks you as an attentive student.",
            tip: "Germans value precision. If your teacher asks 'Haben Sie das verstanden?' (Did you understand?), a clear 'Ja, danke' or 'Nein, leider nicht' (No, unfortunately not) is always better than a vague nod."
          },
          {
            title: "Richtig oder Falsch? — Checking Your Understanding",
            content: "'Ist das richtig?' (Is that correct?), 'Was bedeutet ... ?' (What does ... mean?), 'Ich verstehe nicht' (I don't understand), and 'Können Sie ein Beispiel geben?' (Can you give an example?) complete your classroom toolkit.",
            tip: "If you make a mistake, say 'Das war falsch, oder?' (That was wrong, wasn't it?) — Germans appreciate the self-awareness and it often leads to a helpful correction."
          }
        ],
        culturalSpotlight: {
          title: "Pünktlichkeit im Unterricht",
          content: "In German culture, punctuality is a deeply held value — arriving on time to class is considered the bare minimum of respect. Being even a few minutes early shows professionalism. If you are late, a quiet 'Entschuldigung, ich komme zu spät' (Excuse me, I'm late) acknowledges the disruption and shows self-awareness. This cultural value of Pünktlichkeit (punctuality) extends to all areas of German professional and social life."
        },
        vocabQA: [
          { question: "K\u00f6nnen Sie das bitte wiederholen?", answer: "Nat\u00fcrlich, gerne.", answerTranslation: "Of course, with pleasure." },
          { question: "Wie sagt man 'hello' auf Deutsch?", answer: "Man sagt 'Hallo'.", answerTranslation: "You say 'Hallo'." },
          { question: "Verstehen Sie?", answer: "Ich verstehe noch nicht.", answerTranslation: "I don't understand yet." },
          { question: "Ist das richtig?", answer: "Ja, das ist richtig.", answerTranslation: "Yes, that's correct." },
          { question: "Was bedeutet dieses Wort?", answer: "Es bedeutet 'morgen'.", answerTranslation: "It means 'tomorrow'." }
        ],
        verbGroups: [
          {
            verb: "verstehen",
            verbTranslation: "to understand (separable-prefix free; stem: verste- \u2014 ich verstehe, du verstehst)",
            examples: [
              { object: "die Frage", fullPhrase: "Ich verstehe die Frage.", translation: "I understand the question." },
              { object: "ein bisschen", fullPhrase: "Ich verstehe ein bisschen.", translation: "I understand a little." },
              { object: "nichts", fullPhrase: "Ich verstehe nichts.", translation: "I don't understand anything." },
              { object: "jetzt", fullPhrase: "Jetzt verstehe ich!", translation: "Now I understand!" },
              { object: "alles", fullPhrase: "Verstehst du alles?", translation: "Do you understand everything?" }
            ]
          }
        ]
      }
    }
  },

  italian: {
    greetings: {
      morning: "Buongiorno",
      afternoon: "Buon pomeriggio",
      evening: "Buonasera"
    },
    formalInformal: [
      { formal: "Come sta?", informal: "Come stai?", context: "How are you?" },
      { formal: "Piacere di conoscerLa", informal: "Piacere!", context: "Nice to meet you" },
      { formal: "Mi scusi", informal: "Scusa", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "Ciao", meaning: "Hello" },
      { phrase: "Arrivederci", meaning: "Goodbye" },
      { phrase: "Per favore", meaning: "Please" },
      { phrase: "Grazie", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "Italian greetings cover more ground than English. In this chapter, you'll learn Buongiorno, Buonasera, and Ciao — when each is appropriate — plus how Lei and tu divide formal from informal, and the phrases for meeting someone for the first time.",
        narrativeSections: [
          {
            title: "Time Matters",
            content: "'Buongiorno' brightens the morning, 'Buon pomeriggio' covers the afternoon (though many Italians simply continue with 'Buongiorno' until late afternoon), and 'Buonasera' arrives with the evening. The transition often happens later in Italy than in other countries \u2014 Italian days stretch long.",
            infographic: 'sunArcGreetings',
            tip: "In southern Italy, the shift to 'Buonasera' can happen as late as 5 or 6 PM, reflecting the later dinner schedule."
          },
          {
            title: "The Art of Greeting",
            content: "Italians greet with enthusiasm and warmth. A hearty 'Ciao!' among friends, a respectful 'Buongiorno' to shopkeepers, and expressive hand gestures that bring words to life. In Italy, greeting someone properly shows you care about the relationship, no matter how brief the encounter.",
            tip: "'Ciao' is both hello and goodbye \u2014 but only use it with people you know well! For strangers, stick with 'Buongiorno' or 'Buonasera'."
          },
          {
            title: "Formal vs. Informal",
            content: "Italian uses 'Lei' for formal address and 'tu' for informal. 'Lei' (literally 'she') is used with strangers, elders, and in professional settings. The shift from 'Lei' to 'tu' (called 'dare del tu') is an invitation to closer friendship.",
            infographic: 'formalInformal',
            tip: "'Lei' is always capitalized in writing when used as formal 'you' \u2014 this distinguishes it from 'lei' meaning 'she'.",
            discoveryNote: "Italian Lei (formal you) uses the same verb form as lei (she). 'Come sta Lei?' (formal — How are you?) and 'Come sta lei?' (How is she?) are identical except for the capital letter. Italian borrowed a third-person pronoun to signal deference — you speak to someone important as if speaking about them."
          }
        ],
        conversationStrips: [
          {
            title: "Un Saluto Informale",
            context: "Luca incontra Olivia tra le lezioni",
            panels: [
              { speaker: "Luca", gender: "male", text: "Ciao, Olivia!", translation: "Hey, Olivia!" },
              { speaker: "Olivia", gender: "female", text: "Ciao, Luca! Come stai?", translation: "Hey, Luca! How are you?" },
              { speaker: "Luca", gender: "male", text: "Molto bene, grazie! E tu?", translation: "Very well, thanks! And you?" },
              { speaker: "Olivia", gender: "female", text: "Bene! A dopo!", translation: "Good! See you later!" }
            ]
          },
          {
            title: "Piacere di conoscerti",
            context: "Luca si presenta a Olivia il primo giorno",
            panels: [
              { speaker: "Luca", gender: "male", text: "Ciao, mi chiamo Luca.", translation: "Hi, my name is Luca." },
              { speaker: "Olivia", gender: "female", text: "Piacere, Luca. Sono Olivia.", translation: "Pleased to meet you, Luca. I'm Olivia." },
              { speaker: "Luca", gender: "male", text: "Il piacere \u00e8 mio.", translation: "The pleasure is mine." }
            ]
          },
          {
            title: "Dalla Nonna \u2014 Il Registro Formale",
            context: "Luca visita Nonna Rosa \u2014 usa sempre 'Lei' per rispetto",
            panels: [
              { speaker: "Luca", gender: "male", text: "Buongiorno, nonna. Come sta?", translation: "Good morning, Grandma. How are you?", note: "Luca uses 'Lei' — the formal register" },
              { speaker: "Nonna Rosa", gender: "female", text: "Molto bene, grazie, Luca. E tu?", translation: "Very well, thanks, Luca. And you?", note: "Grandma uses 'tu' back — she is the elder" },
              { speaker: "Luca", gender: "male", text: "Bene, grazie, nonna.", translation: "Fine, thank you, Grandma." }
            ]
          }
        ],
        culturalSpotlight: {
          title: "La Passeggiata",
          content: "Every evening, Italians take part in 'la passeggiata' \u2014 a leisurely stroll through town. It's not exercise; it's a social ritual. Families, couples, and friends walk together, stopping to greet neighbors, admire shop windows, and enjoy gelato. It's the heartbeat of Italian community life."
        },
        cognateOpener: [
          { english: "hotel", target: "hotel", spanish: "", category: "identical" },
          { english: "pizza", target: "pizza", spanish: "", category: "identical" },
          { english: "radio", target: "radio", spanish: "", category: "identical" },
          { english: "studio", target: "studio", spanish: "", category: "identical" },
          { english: "taxi", target: "taxi", spanish: "", category: "identical" },
          { english: "important", target: "importante", spanish: "", category: "near-identical" },
          { english: "natural", target: "naturale", spanish: "", category: "near-identical" },
          { english: "original", target: "originale", spanish: "", category: "near-identical" },
          { english: "musical", target: "musicale", spanish: "", category: "near-identical" },
          { english: "attention", target: "attenzione", spanish: "", category: "-tion → -zione" },
          { english: "nation", target: "nazione", spanish: "", category: "-tion → -zione" },
          { english: "information", target: "informazione", spanish: "", category: "-tion → -zione" },
          { english: "artist", target: "artista", spanish: "", category: "-ist → -ista" },
          { english: "tourist", target: "turista", spanish: "", category: "-ist → -ista" },
          { english: "optimist", target: "ottimista", spanish: "", category: "-ist → -ista" },
          { english: "camera", target: "camera", spanish: "", category: "false-friend", isFalseCognate: true, falseCognateNote: "camera = room, not camera" },
          { english: "sensible", target: "sensibile", spanish: "", category: "false-friend", isFalseCognate: true, falseCognateNote: "sensibile = sensitive, not sensible" },
          { english: "actually", target: "attualmente", spanish: "", category: "false-friend", isFalseCognate: true, falseCognateNote: "attualmente = currently, not actually" }
        ],
        genderPairs: [
          { masculine: "contento",    feminine: "contenta",    translation: "happy" },
          { masculine: "stanco",      feminine: "stanca",      translation: "tired" },
          { masculine: "occupato",    feminine: "occupata",    translation: "busy" },
          { masculine: "malato",      feminine: "malata",      translation: "sick" },
          { masculine: "nervoso",     feminine: "nervosa",     translation: "nervous" },
          { masculine: "emozionato",  feminine: "emozionata",  translation: "excited" }
        ],
        vocabQA: [
          { question: "Come si chiama?", answer: "Mi chiamo [nome].", word: "chiamo", translation: "I call myself (formal)" },
          { question: "Come ti chiami?", answer: "Mi chiamo [nome].", word: "chiami", translation: "you call yourself (informal)" },
          { question: "Come sta?", answer: "Sto bene, grazie. E lei?", word: "sta", translation: "you are doing (formal)" },
          { question: "Come stai?", answer: "Sto bene, grazie. E tu?", word: "stai", translation: "you are doing (informal)" },
          { question: "Piacere.", answer: "Piacere mio.", word: "piacere", translation: "pleasure / nice to meet you" },
          { question: "Di dove sei?", answer: "Sono di [città].", word: "sei", translation: "you are (from)" }
        ],
        verbGroups: [
          {
            verb: "stare",
            verbTranslation: "to be (how one is doing right now)",
            verbHint: "Italian uses stare, not essere, for how you feel. This is the most important greeting verb.",
            examples: [
              { object: "bene",           fullPhrase: "Sto bene.",           translation: "I am well." },
              { object: "male",           fullPhrase: "Sto male.",           translation: "I am not well." },
              { object: "così così", fullPhrase: "Sto così così.", translation: "I am so-so." },
              { object: "benissimo",      fullPhrase: "Sto benissimo.",      translation: "I am doing great." },
              { object: "abbastanza bene", fullPhrase: "Sto abbastanza bene.", translation: "I am doing pretty well." },
              { object: "stanco(a)",      fullPhrase: "Sono stanco.",        translation: "I am tired." }
            ]
          }
        ]
      },
      numbers: {
        welcomeText: "Italian numbers follow regular patterns once you know 1–10. In this chapter, you'll learn to count to 1,000, read restaurant prices, and understand why ventuno and ventotto drop their final vowel.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "Italian numbers flow naturally: uno, due, tre, quattro, cinque. From 1 to 10, each has its own sound. After 10, patterns emerge: 'undici' (11), 'dodici' (12), then 'tredici' through 'diciannove' (19). At 20, 'venti' begins a regular system that carries you forward.",
            tip: "When numbers combine with 'venti' (20), 'trenta' (30), etc., the final vowel drops before 'uno' and 'otto': 'ventuno' (21), 'ventotto' (28)."
          },
          {
            title: "Numbers in Daily Life",
            content: "Numbers are everywhere in Italian life: reading menus ('Pizza Margherita: otto euro'), understanding train schedules at Trenitalia, and counting out change. Practice with 'Quanto costa?' (How much does it cost?) and you'll be ready for any market.",
            tip: "Italians often use hand gestures to emphasize numbers \u2014 watch how they pinch their fingers together when saying a price!"
          }
        ],
        culturalSpotlight: {
          title: "Il Numero 17",
          content: "While much of the world considers 13 unlucky, in Italy the unlucky number is 17. The Roman numeral XVII can be rearranged to spell 'VIXI' (Latin for 'I have lived' \u2014 meaning 'I am dead'). Some Italian buildings skip the 17th floor, and Alitalia planes once had no row 17!"
        },
        vocabQA: [
          { question: "Quanti anni hai?", answer: "Ho venticinque anni.", answerTranslation: "I am twenty-five years old." },
          { question: "Quanto costa?", answer: "Costa dieci euro.", answerTranslation: "It costs ten euros." },
          { question: "Che ore sono?", answer: "Sono le tre.", answerTranslation: "It is three o'clock." },
          { question: "Quante persone ci sono?", answer: "Ci sono cinque persone.", answerTranslation: "There are five people." },
          { question: "Qual \u00e8 il tuo numero di telefono?", answer: "Il mio numero \u00e8 06-12-34-56.", answerTranslation: "My number is 06-12-34-56." }
        ],
        verbGroups: [
          {
            verb: "avere",
            verbTranslation: "to have (age, possessions)",
            examples: [
              { object: "vent'anni", fullPhrase: "Ho vent'anni.", translation: "I am twenty years old." },
              { object: "fame", fullPhrase: "Ho fame.", translation: "I am hungry." },
              { object: "soldi", fullPhrase: "Ho soldi.", translation: "I have money." },
              { object: "fretta", fullPhrase: "Ho fretta.", translation: "I'm in a hurry." },
              { object: "una domanda", fullPhrase: "Ho una domanda.", translation: "I have a question." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "In this chapter, you'll learn the Italian words for immediate and extended family — padre, madre, fratello, sorella, nonni, and more — plus the verb essere for introducing them.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "Italian families are famously close-knit. 'Mamma' holds a special place of reverence, 'pap\u00e0' is respected and loved, and 'nonni' (grandparents) are the keepers of family wisdom and recipes. In Italy, family gatherings around a table of homemade pasta are sacred events.",
            tip: "In Italy, it's completely normal for adult children to live at home until marriage \u2014 called 'mammoni' (mama's boys), it's a sign of family closeness, not dependence!"
          },
          {
            title: "Extended Family",
            content: "Italian has expressive terms for extended family: 'suocera' (mother-in-law), 'cognato' (brother-in-law), 'nipote' (both nephew/niece AND grandchild). The concept of 'padrino' and 'madrina' (godfather/godmother) carries deep significance in Italian family life."
          }
        ],
        culturalSpotlight: {
          title: "La Domenica in Famiglia",
          content: "Sunday lunch with the whole family is a sacred Italian tradition. 'Nonna' prepares a multi-course feast \u2014 antipasto, primo, secondo, contorno, and dolce \u2014 and three generations gather around one table. These weekly reunions keep Italian families connected across distances and decades."
        },
        genderFrame: { masculine: "Lui \u00e8 mio ___.", feminine: "Lei \u00e8 mia ___." },
        genderPairs: [
          { masculine: "mio padre",   feminine: "mia madre",   translation: "my father / my mother"           },
          { masculine: "mio fratello", feminine: "mia sorella", translation: "my brother / my sister"          },
          { masculine: "mio nonno",   feminine: "mia nonna",   translation: "my grandfather / my grandmother" },
          { masculine: "mio zio",     feminine: "mia zia",     translation: "my uncle / my aunt"              },
          { masculine: "mio cugino",  feminine: "mia cugina",  translation: "my (male) / my (female) cousin"  }
        ],
        vocabQA: [
          { question: "Hai fratelli o sorelle?",                         answer: "S\u00ec, ho un fratello e una sorella.",       word: "fratelli o sorelle", translation: "brothers or sisters" },
          { question: "Chi \u00e8 questo?",                                  answer: "\u00c8 mio padre.",                             word: "chi \u00e8",              translation: "who is this?"         },
          { question: "Come si chiama tua madre?",                       answer: "Si chiama Maria.",                           word: "si chiama",          translation: "is named"             },
          { question: "Quante persone ci sono nella tua famiglia?",      answer: "Siamo cinque nella mia famiglia.",           word: "quante",             translation: "how many"             },
          { question: "Dove abitano i tuoi genitori?",                   answer: "I miei genitori abitano a Roma.",            word: "abitano",            translation: "live / reside"        }
        ],
        verbGroups: [
          {
            verb: "essere",
            verbTranslation: "to be (identity)",
            examples: [
              { object: "mio padre",   fullPhrase: "\u00c8 mio padre.",   translation: "He is my father."       },
              { object: "mia madre",   fullPhrase: "\u00c8 mia madre.",   translation: "She is my mother."      },
              { object: "mio fratello", fullPhrase: "\u00c8 mio fratello.", translation: "He is my brother."    },
              { object: "mia sorella", fullPhrase: "\u00c8 mia sorella.", translation: "She is my sister."      },
              { object: "mio nonno",   fullPhrase: "\u00c8 mio nonno.",   translation: "He is my grandfather."  }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "This chapter covers the Italian words and phrases you'll use every day: time expressions, courtesy words, and the vocabulary for navigating shops, public transport, and daily routines.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "Start each day with a cheerful 'Buongiorno!' to everyone you meet. As afternoon fades to evening, switch to 'Buonasera'. Among friends, 'Ciao' works any time of day. When leaving, try 'A dopo!' (See you later!) or 'A domani!' (See you tomorrow!).",
            infographic: 'sunArcGreetings',
            tip: "Italians often greet everyone in a shop or waiting room collectively when entering \u2014 a quick 'Buongiorno a tutti!' goes a long way."
          },
          {
            title: "Essential Courtesy",
            content: "'Per favore' (please) and 'Grazie' (thank you) are your essential daily companions. Add 'Prego' (you're welcome) and 'Scusi' (excuse me, formal) to navigate any situation with Italian grace and charm.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Build your everyday Italian with: 'oggi' (today), 'domani' (tomorrow), 'ieri' (yesterday), 'il giorno' (the day), 'la sera' (the evening), 's\u00ec' (yes), 'no' (no). These words weave through every Italian conversation.",
            tip: "Italians love to respond with 'Va bene!' (All good!) or 'Benissimo!' (Excellent!) \u2014 these positive responses brighten any exchange."
          }
        ],
        culturalSpotlight: {
          title: "Il Caff\u00e8 al Bar",
          content: "The Italian 'caff\u00e8 al bar' ritual is a daily cornerstone: stepping into a local bar, ordering an espresso at the counter, drinking it in three sips while chatting with the barista, and heading out. It takes five minutes but sets the rhythm for the entire day. It's not just coffee \u2014 it's a moment of connection."
        },
        vocabQA: [
          { question: "Come sta oggi?", answer: "Sto benissimo, grazie.", answerTranslation: "I'm very well, thank you." },
          { question: "Che ore sono?", answer: "Sono le dieci di mattina.", answerTranslation: "It is ten in the morning." },
          { question: "Che giorno \u00e8 oggi?", answer: "Oggi \u00e8 luned\u00ec.", answerTranslation: "Today is Monday." },
          { question: "Cosa fa di mattina?", answer: "Mi sveglio alle sette.", answerTranslation: "I wake up at seven." },
          { question: "Ha tempo?", answer: "S\u00ec, ho un momento.", answerTranslation: "Yes, I have a moment." }
        ],
        verbGroups: [
          {
            verb: "fare",
            verbTranslation: "to do / to make (daily activities)",
            examples: [
              { object: "colazione", fullPhrase: "Faccio colazione alle sette.", translation: "I have breakfast at seven." },
              { object: "sport", fullPhrase: "Lui fa sport la mattina.", translation: "He exercises in the morning." },
              { object: "la spesa", fullPhrase: "Lei fa la spesa.", translation: "She does the shopping." },
              { object: "i compiti", fullPhrase: "Fai i compiti?", translation: "Are you doing your homework?" },
              { object: "una passeggiata", fullPhrase: "Facciamo una passeggiata.", translation: "We go for a walk." }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "Benvenuti in classe! Italian classroom language blends structure with warmth. This chapter teaches you how to ask for help gracefully, navigate your teacher's instructions, and express yourself when words escape you — all in Italian.",
        narrativeSections: [
          {
            title: "Chiedere con Garbo — Asking Gracefully",
            content: "'Può ripetere?' (Can you repeat?), 'Più lentamente, per favore' (More slowly, please), and 'Come si dice...?' (How do you say...?) are your most-used classroom phrases. Italians appreciate graciousness — adding 'per favore' and 'grazie' makes every request land well.",
            tip: "'Per cortesia' is a slightly more formal version of 'per favore' — either works in class, but 'per cortesia' signals real politeness."
          },
          {
            title: "Capire le Istruzioni — Understanding Instructions",
            content: "Recognize these teacher commands: 'Ascoltate' (Listen), 'Ripetete' (Repeat), 'Leggete' (Read), 'Scrivete' (Write), 'Aprite il libro' (Open the book), 'A coppie' (In pairs). The sooner you internalize these, the more you can follow along naturally.",
            tip: "If your teacher says 'Tutti insieme!' (All together!), they're asking the whole class to respond at once. It's a call to participate, not a cue to stay silent."
          },
          {
            title: "Verificare la Comprensione — Checking Understanding",
            content: "'È corretto?' (Is that correct?), 'Cosa significa...?' (What does... mean?), 'Non capisco' (I don't understand), and 'Può fare un esempio?' (Can you give an example?) will rescue you from any moment of confusion.",
            tip: "'Ho capito!' (I got it!) is the satisfying phrase to use when something clicks — Italian teachers genuinely enjoy hearing it."
          }
        ],
        culturalSpotlight: {
          title: "La Bella Figura in Aula",
          content: "In Italian culture, 'fare bella figura' — making a good impression — matters everywhere, including the classroom. Arriving prepared, speaking clearly, and showing genuine interest in the subject are all forms of bella figura. Even when you make mistakes (and you will!), recovering with a smile and trying again is considered graceful and admirable. Italian teachers remember the students who try hard, not just the ones who get everything right."
        },
        vocabQA: [
          { question: "Pu\u00f2 ripetere, per favore?", answer: "Certo, con piacere.", answerTranslation: "Of course, with pleasure." },
          { question: "Come si dice 'hello' in italiano?", answer: "Si dice 'ciao'.", answerTranslation: "You say 'ciao'." },
          { question: "Capisce?", answer: "Non capisco ancora.", answerTranslation: "I don't understand yet." },
          { question: "\u00c8 corretto?", answer: "S\u00ec, \u00e8 corretto.", answerTranslation: "Yes, it's correct." },
          { question: "Cosa significa questa parola?", answer: "Significa 'domani'.", answerTranslation: "It means 'tomorrow'." }
        ],
        verbGroups: [
          {
            verb: "capire",
            verbTranslation: "to understand (isc-verb \u2014 capisco, capisci, capisce, capiamo, capite, capiscono)",
            examples: [
              { object: "la domanda", fullPhrase: "Capisco la domanda.", translation: "I understand the question." },
              { object: "un po'", fullPhrase: "Capisco un po'.", translation: "I understand a little." },
              { object: "niente", fullPhrase: "Non capisco niente.", translation: "I don't understand anything." },
              { object: "adesso", fullPhrase: "Ah, adesso capisco!", translation: "Ah, now I understand!" },
              { object: "tutto", fullPhrase: "Capisci tutto?", translation: "Do you understand everything?" }
            ]
          }
        ]
      }
    }
  },

  japanese: {
    greetings: {
      morning: "\u304a\u306f\u3088\u3046\u3054\u3056\u3044\u307e\u3059",
      afternoon: "\u3053\u3093\u306b\u3061\u306f",
      evening: "\u3053\u3093\u3070\u3093\u306f"
    },
    formalInformal: [
      { formal: "\u304a\u5143\u6c17\u3067\u3059\u304b\uff1f", informal: "\u5143\u6c17\uff1f", context: "How are you?" },
      { formal: "\u306f\u3058\u3081\u307e\u3057\u3066", informal: "\u3088\u308d\u3057\u304f\u306d", context: "Nice to meet you" },
      { formal: "\u3059\u307f\u307e\u305b\u3093", informal: "\u3054\u3081\u3093", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "\u3053\u3093\u306b\u3061\u306f", meaning: "Hello" },
      { phrase: "\u3055\u3088\u3046\u306a\u3089", meaning: "Goodbye" },
      { phrase: "\u304a\u306d\u304c\u3044\u3057\u307e\u3059", meaning: "Please" },
      { phrase: "\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "Japanese greetings depend on time of day and relationship. In this chapter, you'll learn Ohayou gozaimasu, Konnichiwa, and Konbanwa — plus Hajimemashite for first meetings — and how the keigo (politeness level) system shapes every greeting.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "Japanese greetings are accompanied by bowing \u2014 the deeper the bow, the greater the respect. A casual nod works among friends, while a 30-degree bow shows respect to elders or in business. The words themselves change based on your relationship, time of day, and social context.",
            infographic: 'sunArcGreetings',
            tip: "When bowing, keep your back straight and bend at the waist. Don't look up \u2014 your gaze should follow naturally downward!"
          },
          {
            title: "Time Matters",
            content: "'\u304a\u306f\u3088\u3046\u3054\u3056\u3044\u307e\u3059' (ohay\u014d gozaimasu) greets the morning, '\u3053\u3093\u306b\u3061\u306f' (konnichiwa) covers midday to late afternoon, and '\u3053\u3093\u3070\u3093\u306f' (konbanwa) welcomes the evening. Each greeting sets the social tone for the conversation that follows.",
            tip: "Among close friends, the morning greeting shortens to '\u304a\u306f\u3088\u3046' (ohay\u014d) \u2014 dropping the '\u3054\u3056\u3044\u307e\u3059' makes it casual."
          },
          {
            title: "Formal vs. Informal",
            content: "Japanese has elaborate levels of formality called 'keigo'. The polite '\u3067\u3059/\u307e\u3059' (desu/masu) forms are used with anyone outside your inner circle. Casual speech drops these endings entirely. Choosing the right level is crucial to social harmony in Japan.",
            infographic: 'formalInformal',
            tip: "Start with polite '\u3067\u3059/\u307e\u3059' forms in every new situation. Japanese speakers will appreciate your effort and may invite you to speak more casually!",
            discoveryNote: "Japanese formality lives in the verb ending, not in the pronoun. Spanish changes the pronoun (tú → usted) to shift formality. Japanese changes the verb suffix: 食べる (taberu — eat, casual) becomes 食べます (tabemasu — eat, polite). Every verb in the sentence carries the respect level, not just the greeting."
          }
        ],
        conversationStrips: [
          {
            title: "\u6c17\u8efd\u306a\u6319\u62f6\u3064",
            context: "\u5927\u8f14\u304c\u5c0f\u767e\u5408\u306b\u6388\u696d\u524d\u306b\u4f1a\u3046",
            panels: [
              { speaker: "\u5927\u8f14", gender: "male", text: "\u3084\u3042\u3001\u5c0f\u767e\u5408\uff01", romanization: "Y\u0101, Sayuri!", translation: "Hey, Sayuri!" },
              { speaker: "\u5c0f\u767e\u5408", gender: "female", text: "\u3042\u3001\u5927\u8f14\uff01\u5143\u6c17\uff1f", romanization: "A, Daisuke! Genki?", translation: "Oh, Daisuke! Are you okay?" },
              { speaker: "\u5927\u8f14", gender: "male", text: "\u5143\u6c17\u3060\u3088\uff01\u541b\u306f\uff1f", romanization: "Genki da yo! Kimi wa?", translation: "Yeah, I'm good! And you?" },
              { speaker: "\u5c0f\u767e\u5408", gender: "female", text: "\u79c1\u3082\u5143\u6c17\uff01\u3058\u3083\u3042\u306d\uff01", romanization: "Watashi mo genki! J\u0101 ne!", translation: "Me too! See you!" }
            ]
          },
          {
            title: "\u306f\u3058\u3081\u307e\u3057\u3066",
            context: "\u5927\u8f14\u304c\u5c0f\u767e\u5408\u306b\u81ea\u5df1\u7d39\u4ecb\u3059\u308b",
            panels: [
              { speaker: "\u5927\u8f14", gender: "male", text: "\u306f\u3058\u3081\u307e\u3057\u3066\u3002\u5927\u8f14\u3068\u3044\u3044\u307e\u3059\u3002", romanization: "Hajimemashite. Daisuke to iimasu.", translation: "Nice to meet you. My name is Daisuke." },
              { speaker: "\u5c0f\u767e\u5408", gender: "female", text: "\u306f\u3058\u3081\u307e\u3057\u3066\u3002\u5c0f\u767e\u5408\u3067\u3059\u3002\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3057\u307e\u3059\u3002", romanization: "Hajimemashite. Sayuri desu. Yoroshiku onegaishimasu.", translation: "Nice to meet you. I'm Sayuri. I'm in your care." },
              { speaker: "\u5927\u8f14", gender: "male", text: "\u3053\u3061\u3089\u3053\u305d\u3001\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3057\u307e\u3059\u3002", romanization: "Kochira koso, yoroshiku onegaishimasu.", translation: "Likewise, I'm in your care." }
            ]
          },
          {
            title: "\u5148\u751f\u3078\u306e\u6319\u62f6\u3064 \u2014 \u4e01\u5be7\u8a9e",
            context: "\u5927\u8f14\u304c\u7530\u4e2d\u5148\u751f\u3092\u4e01\u5be7\u8a9e\u3067\u6319\u62f6\u3064\u3059\u308b",
            panels: [
              { speaker: "\u5927\u8f14", gender: "male", text: "\u5148\u751f\u3001\u304a\u306f\u3088\u3046\u3054\u3056\u3044\u307e\u3059\u3002", romanization: "Sensei, ohay\u014d gozaimasu.", translation: "Good morning, Sensei.", note: "Using the polite -gozaimasu form for a teacher" },
              { speaker: "\u7530\u4e2d\u5148\u751f", gender: "male", text: "\u304a\u306f\u3088\u3046\u3001\u5927\u8f14\u304f\u3093\u3002", romanization: "Ohay\u014d, Daisuke-kun.", translation: "Good morning, Daisuke.", note: "Teacher uses casual form — appropriate asymmetry" },
              { speaker: "\u5927\u8f14", gender: "male", text: "\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3044\u305f\u3057\u307e\u3059\u3002", romanization: "Yoroshiku onegai itashimasu.", translation: "I'm in your care.", note: "-itashimasu makes it even more respectful" }
            ]
          }
        ],
        culturalSpotlight: {
          title: "\u304a\u8f9e\u5100 (Ojigi) \u2014 The Bow",
          content: "Bowing is the Japanese greeting par excellence. It communicates respect, gratitude, apology, and greeting all at once. There are three main types: the 15-degree 'eshaku' (casual), the 30-degree 'keirei' (respectful), and the 45-degree 'saikeirei' (deep respect). Mastering the bow is mastering Japanese social language."
        },
        vocabQA: [
          { question: "はじめまして。", answer: "どうぞよろしく。", word: "はじめまして", translation: "Nice to meet you (Hajimemashite)" },
          { question: "お元気ですか？", answer: "元気です、ありがとう。", word: "お元気", translation: "Are you well? (Ogenki desu ka?)" },
          { question: "お名前は？", answer: "私の名前は[名前]です。", word: "お名前", translation: "Your name? (Onamae wa?)" },
          { question: "どちらからいらっしゃいましたか？", answer: "[国]からきました。", word: "どちらから", translation: "Where are you from? (Dochira kara?)" },
          { question: "よろしくおねがいします。", answer: "こちらこそ、よろしくおねがいします。", word: "よろしく", translation: "Please treat me kindly (Yoroshiku)" }
        ],
        verbGroups: [
          {
            verb: "です (desu)",
            verbTranslation: "am / is / are (polite)",
            verbHint: "です ends nearly every polite Japanese sentence — think of it as the politeness seal on everything you say.",
            examples: [
              { object: "元気 (genki)",        fullPhrase: "元気です。",        translation: "I am fine." },
              { object: "学生 (gakusei)",       fullPhrase: "学生です。",       translation: "I am a student." },
              { object: "日本人 (nihonjin)", fullPhrase: "日本人です。", translation: "I am Japanese." },
              { object: "アメリカ人 (amerikajin)", fullPhrase: "アメリカ人です。", translation: "I am American." },
              { object: "先生 (sensei)",        fullPhrase: "先生です。",       translation: "I am a teacher." }
            ]
          }
        ],
        cognateOpener: [
          { native: "\u30db\u30c6\u30eb (hoteru)",          english: "hotel",                                        category: "place"         },
          { native: "\u30bf\u30af\u30b7\u30fc (takush\u012b)",        english: "taxi",                                         category: "transport"     },
          { native: "\u30ec\u30b9\u30c8\u30e9\u30f3 (resutoran)",    english: "restaurant",                                   category: "food"          },
          { native: "\u30b3\u30fc\u30d2\u30fc (k\u014dh\u012b)",          english: "coffee",                                       category: "food"          },
          { native: "\u30c6\u30ec\u30d3 (terebi)",          english: "television",                                   category: "technology"    },
          { native: "\u30d0\u30b9 (basu)",              english: "bus",                                          category: "transport"     },
          { native: "\u30b9\u30dd\u30fc\u30c4 (sup\u014dtsu)",       english: "sports",                                       category: "concept"       },
          { native: "\u30a4\u30f3\u30bf\u30fc\u30cd\u30c3\u30c8 (int\u0101netto)", english: "internet",                                     category: "technology"    },
          { native: "\u30ab\u30e1\u30e9 (kamera)",         english: "camera",                                       category: "technology"    },
          { native: "\u30d4\u30a2\u30ce (piano)",          english: "piano",                                        category: "concept"       },
          { native: "\u30ae\u30bf\u30fc (git\u0101)",            english: "guitar",                                       category: "concept"       },
          { native: "\u30a2\u30a4\u30b9\u30af\u30ea\u30fc\u30e0 (aisukur\u012bmu)", english: "ice cream",                                    category: "food"          },
          { native: "\u30c1\u30e7\u30b3\u30ec\u30fc\u30c8 (chokore\u0113to)", english: "chocolate",                                    category: "food"          },
          { native: "\u30cb\u30e5\u30fc\u30b9 (ny\u016bsu)",         english: "news",                                         category: "concept"       },
          { native: "\u30d1\u30fc\u30c6\u30a3\u30fc (p\u0101t\u012b)",       english: "party",                                        category: "concept"       },
          { native: "\u30de\u30f3\u30b7\u30e7\u30f3 (manshon)",      english: "apartment / condo \u2014 not \u201cmansion\u201d",  category: "false-friend"  },
          { native: "\u30b9\u30de\u30fc\u30c8 (sum\u0101to)",        english: "slim / stylish \u2014 not \u201csmart / clever\u201d", category: "false-friend"  }
        ]
      },
      numbers: {
        welcomeText: "Japanese has two number systems \u2014 native Japanese and Sino-Japanese \u2014 making it a fascinating study. This chapter introduces both systems and helps you understand when to use each, from counting objects to reading prices.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "The Sino-Japanese system (ichi, ni, san, shi/yon, go) is used for most counting. But Japanese also uses counters \u2014 special words that change based on what you're counting. Flat objects, long objects, people, and animals each have their own counter. It's like a secret code for describing the world!",
            tip: "The numbers 4 (\u56db) and 9 (\u4e5d) have alternate readings ('yon' and 'ky\u016b') because 'shi' sounds like death (\u6b7b) and 'ku' sounds like suffering (\u82e6). Use the alternate readings in polite contexts."
          },
          {
            title: "Numbers in Daily Life",
            content: "Numbers appear everywhere in Japanese life: reading price tags in yen (\u5186), understanding train platform numbers, and counting purchases at convenience stores. Practice with '\u3044\u304f\u3089\u3067\u3059\u304b?' (ikura desu ka? \u2014 How much is it?).",
            tip: "Japanese currency is straightforward \u2014 there are no decimal points! 500\u5186 is just 'gohyaku en' (five hundred yen)."
          }
        ],
        culturalSpotlight: {
          title: "\u56db (Shi) \u2014 The Number Four",
          content: "In Japan, the number 4 is considered unlucky because 'shi' (\u56db) sounds identical to the word for death (\u6b7b). Many hospitals skip room number 4, some buildings omit the 4th floor, and gifts should never come in sets of four. The alternative reading 'yon' is preferred in most contexts to avoid the association."
        },
        vocabQA: [
          { question: "\u4f55\u6642\u3067\u3059\u304b\uff1f", answer: "\u4e09\u6642\u3067\u3059\u3002", answerTranslation: "It is three o'clock." },
          { question: "\u3044\u304f\u3089\u3067\u3059\u304b\uff1f", answer: "\u5341\u30e6\u30fc\u30ed\u3067\u3059\u3002", answerTranslation: "It is ten euros." },
          { question: "\u4f55\u6b73\u3067\u3059\u304b\uff1f", answer: "\u4e8c\u5341\u4e94\u6b73\u3067\u3059\u3002", answerTranslation: "I am twenty-five years old." },
          { question: "\u4f55\u4eba\u3044\u307e\u3059\u304b\uff1f", answer: "\u4e94\u4eba\u3044\u307e\u3059\u3002", answerTranslation: "There are five people." },
          { question: "\u96fb\u8a71\u756a\u53f7\u306f\u4f55\u756a\u3067\u3059\u304b\uff1f", answer: "090-1234-5678\u3067\u3059\u3002", answerTranslation: "My number is 090-1234-5678." }
        ],
        verbGroups: [
          {
            verb: "\u3042\u308a\u307e\u3059 / \u3044\u307e\u3059",
            verbTranslation: "to exist / there is — \u3042\u308a\u307e\u3059 for objects; \u3044\u307e\u3059 for living things",
            examples: [
              { object: "\u30ea\u30f3\u30b4\u304c\u4e09\u3064", fullPhrase: "\u30ea\u30f3\u30b4\u304c\u4e09\u3064\u3042\u308a\u307e\u3059\u3002", translation: "There are three apples." },
              { object: "\u4e94\u4eba", fullPhrase: "\u4e94\u4eba\u3044\u307e\u3059\u3002", translation: "There are five people." },
              { object: "\u304a\u91d1\u304c", fullPhrase: "\u304a\u91d1\u304c\u3042\u308a\u307e\u3059\u3002", translation: "There is money." },
              { object: "\u554f\u984c\u304c", fullPhrase: "\u554f\u984c\u304c\u3042\u308a\u307e\u305b\u3093\u3002", translation: "There is no problem." },
              { object: "\u72ac\u304c\u4e8c\u5339", fullPhrase: "\u72ac\u304c\u4e8c\u5339\u3044\u307e\u3059\u3002", translation: "There are two dogs." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "Japanese uses different words depending on whether you're talking about your own family or someone else's. In this chapter, you'll learn both sets — haha vs. okaasan, chichi vs. otousan — and the verb desu for introductions.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "Japanese family vocabulary has two sets of terms: humble forms for your own family and honorific forms for others' families. Your mother is '\u6bcd' (haha), but someone else's mother is '\u304a\u6bcd\u3055\u3093' (ok\u0101san). This dual system reflects the deep respect Japanese culture has for social relationships.",
            tip: "When talking about your own family to outsiders, always use the humble forms \u2014 it shows proper modesty and social awareness."
          },
          {
            title: "Extended Family",
            content: "The Japanese family extends through generations with precise vocabulary: '\u304a\u3058\u3044\u3055\u3093' (oj\u012bsan \u2014 grandfather), '\u304a\u3070\u3042\u3055\u3093' (ob\u0101san \u2014 grandmother), '\u304a\u3058\u3055\u3093' (ojisan \u2014 uncle), '\u304a\u3070\u3055\u3093' (obasan \u2014 aunt). Notice how vowel length changes meaning entirely!"
          }
        ],
        culturalSpotlight: {
          title: "\u304a\u76c6 (Obon)",
          content: "Obon is a Japanese Buddhist tradition held in August where families reunite to honor their ancestors. Family members travel home from across the country, visit ancestral graves, and celebrate with Bon Odori dances. It's Japan's most important family reunion event and one of the few times the entire nation pauses together."
        },
        vocabQA: [
          { question: "\u5144\u5f1f\u59c9\u59b9\u306f\u3044\u307e\u3059\u304b\uff1f",             answer: "\u306f\u3044\u3001\u5144\u304c\u4e00\u4eba\u3044\u307e\u3059\u3002",          word: "\u5144\u5f1f\u59c9\u59b9 (ky\u014ddai)",      translation: "siblings"              },
          { question: "\u3053\u308c\u306f\u3060\u308c\u3067\u3059\u304b\uff1f",                    answer: "\u79c1\u306e\u7236\u3067\u3059\u3002",                         word: "\u3060\u308c\u3067\u3059\u304b (dare desu ka)", translation: "who is this?"          },
          { question: "\u304a\u7236\u3055\u3093\u306e\u304a\u540d\u524d\u306f\uff1f",             answer: "\u7236\u306e\u540d\u524d\u306f\u7530\u4e2d\u3067\u3059\u3002",            word: "\u304a\u7236\u3055\u3093 (ot\u014dsan)",       translation: "your father (polite)"  },
          { question: "\u3054\u5bb6\u65cf\u306f\u4f55\u4eba\u3067\u3059\u304b\uff1f",             answer: "\u5bb6\u65cf\u306f\u4e94\u4eba\u3067\u3059\u3002",                  word: "\u4f55\u4eba (nannin)",               translation: "how many people?"      },
          { question: "\u3054\u4e21\u89aa\u306f\u3069\u3053\u306b\u304a\u4f4f\u307e\u3044\u3067\u3059\u304b\uff1f", answer: "\u4e21\u89aa\u306f\u6771\u4eac\u306b\u4f4f\u3093\u3067\u3044\u307e\u3059\u3002", word: "\u3054\u4e21\u89aa (go-ry\u014dshin)",       translation: "your parents (polite)" }
        ],
        verbGroups: [
          {
            verb: "\u3067\u3059 (desu)",
            verbTranslation: "to be (identity, polite)",
            verbHint: "Japanese family vocabulary has two registers: humble uchi forms for your own family (chichi \u7236 = my father) and polite soto forms for others\u2019 families (ot\u014dsan \u304a\u7236\u3055\u3093 = your father). This chapter uses the humble set.",
            examples: [
              { object: "\u7236 (chichi)",  fullPhrase: "\u7236\u3067\u3059\u3002",  translation: "He is my father."       },
              { object: "\u6bcd (haha)",    fullPhrase: "\u6bcd\u3067\u3059\u3002",  translation: "She is my mother."      },
              { object: "\u5144 (ani)",     fullPhrase: "\u5144\u3067\u3059\u3002",  translation: "He is my older brother." },
              { object: "\u59c9 (ane)",     fullPhrase: "\u59c9\u3067\u3059\u3002",  translation: "She is my older sister." },
              { object: "\u7956\u7236 (sofu)", fullPhrase: "\u7956\u7236\u3067\u3059\u3002", translation: "He is my grandfather."  }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "This chapter gives you the Japanese words and phrases for daily routines: time expressions, common courtesy phrases, and what to say at a konbini, restaurant, or train station.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "Begin your day with '\u304a\u306f\u3088\u3046\u3054\u3056\u3044\u307e\u3059', greet the afternoon with '\u3053\u3093\u306b\u3061\u306f', and welcome evening with '\u3053\u3093\u3070\u3093\u306f'. When leaving work, say '\u304a\u75b2\u308c\u69d8\u3067\u3059' (otsukaresama desu \u2014 thanks for your hard work), a uniquely Japanese farewell.",
            infographic: 'sunArcGreetings',
            tip: "'\u304a\u75b2\u308c\u69d8\u3067\u3059' is one of the most-used phrases in Japanese offices \u2014 it's both a greeting and a compliment!"
          },
          {
            title: "Essential Courtesy",
            content: "'\u304a\u306d\u304c\u3044\u3057\u307e\u3059' (onegaishimasu \u2014 please), '\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059' (arigat\u014d gozaimasu \u2014 thank you), and '\u3059\u307f\u307e\u305b\u3093' (sumimasen \u2014 excuse me/sorry) are the three pillars of daily Japanese politeness.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Essential daily vocabulary: '\u4eca\u65e5' (ky\u014d \u2014 today), '\u660e\u65e5' (ashita \u2014 tomorrow), '\u6628\u65e5' (kin\u014d \u2014 yesterday), '\u306f\u3044' (hai \u2014 yes), '\u3044\u3044\u3048' (iie \u2014 no). These simple words appear in every Japanese conversation.",
            tip: "'\u3059\u307f\u307e\u305b\u3093' is incredibly versatile \u2014 use it to apologize, get attention, express gratitude, or even as 'excuse me' when passing someone!"
          }
        ],
        culturalSpotlight: {
          title: "\u3044\u305f\u3060\u304d\u307e\u3059 (Itadakimasu)",
          content: "Before every meal in Japan, people say '\u3044\u305f\u3060\u304d\u307e\u3059' (I humbly receive), a phrase expressing gratitude to everyone involved in bringing food to the table \u2014 from farmers to cooks. After eating, '\u3054\u3061\u305d\u3046\u3055\u307e\u3067\u3057\u305f' (gochis\u014dsama deshita) thanks the preparer. These daily rituals turn every meal into a moment of mindfulness."
        },
        vocabQA: [
          { question: "\u4eca\u65e5\u306f\u304a\u5143\u6c17\u3067\u3059\u304b\uff1f", answer: "\u306f\u3044\u3001\u5143\u6c17\u3067\u3059\u3002\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\u3002", answerTranslation: "Yes, I'm well. Thank you." },
          { question: "\u4eca\u4f55\u6642\u3067\u3059\u304b\uff1f", answer: "\u5348\u524d\u5341\u6642\u3067\u3059\u3002", answerTranslation: "It is ten in the morning." },
          { question: "\u4eca\u65e5\u306f\u4f55\u66dc\u65e5\u3067\u3059\u304b\uff1f", answer: "\u4eca\u65e5\u306f\u6708\u66dc\u65e5\u3067\u3059\u3002", answerTranslation: "Today is Monday." },
          { question: "\u6bce\u671d\u3001\u4f55\u3092\u3057\u307e\u3059\u304b\uff1f", answer: "\u4e03\u6642\u306b\u8d77\u304d\u307e\u3059\u3002", answerTranslation: "I wake up at seven." },
          { question: "\u4eca\u3001\u6642\u9593\u304c\u3042\u308a\u307e\u3059\u304b\uff1f", answer: "\u306f\u3044\u3001\u5c11\u3057\u6642\u9593\u304c\u3042\u308a\u307e\u3059\u3002", answerTranslation: "Yes, I have a little time." }
        ],
        verbGroups: [
          {
            verb: "\u3057\u307e\u3059",
            verbTranslation: "shimasu \u2014 to do (versatile verb for daily activities)",
            examples: [
              { object: "\u52c9\u5f37", fullPhrase: "\u65e5\u672c\u8a9e\u3092\u52c9\u5f37\u3057\u307e\u3059\u3002", translation: "I study Japanese." },
              { object: "\u904b\u52d5", fullPhrase: "\u6bce\u671d\u3001\u904b\u52d5\u3057\u307e\u3059\u3002", translation: "I exercise every morning." },
              { object: "\u8cb7\u3044\u7269", fullPhrase: "\u9031\u672b\u306b\u8cb7\u3044\u7269\u3092\u3057\u307e\u3059\u3002", translation: "I shop on weekends." },
              { object: "\u6599\u7406", fullPhrase: "\u5bc4\u306b\u6599\u7406\u3092\u3057\u307e\u3059\u3002", translation: "I cook for dinner." },
              { object: "\u4ed5\u4e8b", fullPhrase: "\u5f7c\u306f\u6bce\u65e5\u4ed5\u4e8b\u3092\u3057\u307e\u3059\u3002", translation: "He works every day." }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "授業へようこそ！ (Welcome to class!) The Japanese classroom has its own rich set of phrases and rituals. This chapter teaches you how to navigate lessons respectfully, ask for clarification without awkwardness, and use the expressions that signal you're a thoughtful, engaged learner.",
        narrativeSections: [
          {
            title: "質問の仕方 — How to Ask",
            content: "'もう一度言っていただけますか？' (Could you say that one more time?) and 'ゆっくり話してください' (Please speak slowly) are your most important phrases. Japanese culture values not imposing on others, so these requests are phrased as humble requests rather than demands.",
            tip: "'〜はどういう意味ですか？' (What does ... mean?) is the polite way to ask for a word's meaning — always say it with rising intonation and a slight nod."
          },
          {
            title: "授業の指示 — Classroom Instructions",
            content: "Learn to recognize: '聞いてください' (Please listen), '繰り返してください' (Please repeat), '読んでください' (Please read), '書いてください' (Please write), '本を開いてください' (Please open your book), 'ペアで' (In pairs). These instruction patterns follow Japanese grammar consistently.",
            tip: "In Japan, students often bow slightly when the teacher enters — a small 'よろしくお願いします' (yoroshiku onegaishimasu) at the start of class sets the right tone of mutual respect."
          },
          {
            title: "理解を確認する — Confirming Understanding",
            content: "'わかりました' (I understand), 'まだわかりません' (I still don't understand), '正しいですか？' (Is that correct?), and '例を見せていただけますか？' (Could you show me an example?) are all phrased in the polite -masu form appropriate for classroom Japanese.",
            tip: "Silence is not awkward in Japanese classrooms — taking a moment to think before answering is considered respectful, not hesitant."
          }
        ],
        culturalSpotlight: {
          title: "起立・礼・着席 (Stand — Bow — Sit)",
          content: "Traditional Japanese classrooms begin and end with a ritual: the class monitor calls '起立' (rise), everyone stands; '礼' (bow), everyone bows to the teacher; '着席' (sit), everyone sits. This brief ceremony establishes mutual respect between teacher and students before a single lesson word is spoken. Even in modern and language school settings, traces of this formality remain — and understanding it gives you genuine cultural insight."
        },
        vocabQA: [
          { question: "\u3082\u3046\u4e00\u5ea6\u8a00\u3063\u3066\u3044\u305f\u3060\u3051\u307e\u3059\u304b\uff1f", answer: "\u306f\u3044\u3001\u3082\u3061\u308d\u3093\u3067\u3059\u3002", answerTranslation: "Yes, of course." },
          { question: "\u300chello\u300d\u306f\u65e5\u672c\u8a9e\u3067\u4f55\u3068\u8a00\u3044\u307e\u3059\u304b\uff1f", answer: "\u300c\u3053\u3093\u306b\u3061\u306f\u300d\u3068\u8a00\u3044\u307e\u3059\u3002", answerTranslation: "We say 'konnichiwa'." },
          { question: "\u308f\u304b\u308a\u307e\u3059\u304b\uff1f", answer: "\u307e\u3060\u308f\u304b\u308a\u307e\u305b\u3093\u3002", answerTranslation: "I don't understand yet." },
          { question: "\u3053\u308c\u306f\u6b63\u3057\u3044\u3067\u3059\u304b\uff1f", answer: "\u306f\u3044\u3001\u6b63\u3057\u3044\u3067\u3059\u3002", answerTranslation: "Yes, it's correct." },
          { question: "\u3053\u306e\u8a00\u8449\u306e\u610f\u5473\u306f\u4f55\u3067\u3059\u304b\uff1f", answer: "\u300c\u660e\u65e5\u300d\u3068\u3044\u3046\u610f\u5473\u3067\u3059\u3002", answerTranslation: "It means 'tomorrow'." }
        ],
        verbGroups: [
          {
            verb: "\u308f\u304b\u308a\u307e\u3059",
            verbTranslation: "wakarimasu \u2014 to understand (polite; plain: wakaru; root: waka-)",
            examples: [
              { object: "\u8cea\u554f", fullPhrase: "\u8cea\u554f\u304c\u308f\u304b\u308a\u307e\u3059\u3002", translation: "I understand the question." },
              { object: "\u5c11\u3057", fullPhrase: "\u5c11\u3057\u308f\u304b\u308a\u307e\u3059\u3002", translation: "I understand a little." },
              { object: "\u308f\u304b\u308a\u307e\u305b\u3093", fullPhrase: "\u308f\u304b\u308a\u307e\u305b\u3093\u3002", translation: "I don't understand." },
              { object: "\u308f\u304b\u308a\u307e\u3057\u305f", fullPhrase: "\u3042\u3001\u308f\u304b\u308a\u307e\u3057\u305f\uff01", translation: "Ah, now I understand!" },
              { object: "\u5168\u90e8", fullPhrase: "\u5168\u90e8\u308f\u304b\u308a\u307e\u3059\u304b\uff1f", translation: "Do you understand everything?" }
            ]
          }
        ]
      }
    }
  },

  korean: {
    greetings: {
      morning: "\uc88b\uc740 \uc544\uce68\uc785\ub2c8\ub2e4",
      afternoon: "\uc548\ub155\ud558\uc138\uc694",
      evening: "\uc88b\uc740 \uc800\ub141\uc785\ub2c8\ub2e4"
    },
    formalInformal: [
      { formal: "\uc5b4\ub5bb\uac8c \uc9c0\ub0b4\uc138\uc694?", informal: "\uc798 \uc9c0\ub0b4?", context: "How are you?" },
      { formal: "\ub9cc\ub098\uc11c \ubc18\uac11\uc2b5\ub2c8\ub2e4", informal: "\ubc18\uac00\uc6cc!", context: "Nice to meet you" },
      { formal: "\uc2e4\ub840\ud569\ub2c8\ub2e4", informal: "\uc800\uae30\uc694", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "\uc548\ub155\ud558\uc138\uc694", meaning: "Hello" },
      { phrase: "\uc548\ub155\ud788 \uac00\uc138\uc694", meaning: "Goodbye" },
      { phrase: "\uc8fc\uc138\uc694", meaning: "Please" },
      { phrase: "\uac10\uc0ac\ud569\ub2c8\ub2e4", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "Korean greetings shift based on respect level. In this chapter, you'll learn 안녕하세요 (Annyeonghaseyo) and 안녕 (Annyeong), plus the honorific system, how to bow, and how to introduce yourself in formal and informal settings.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "Korean greetings are always accompanied by a bow. '\uc548\ub155\ud558\uc138\uc694' (annyeonghaseyo) is the universal greeting that works in almost any situation. The depth of your bow communicates respect \u2014 a slight nod for peers, a deeper bow for elders or superiors.",
            infographic: 'sunArcGreetings',
            tip: "When bowing to elders, keep your arms at your sides or clasp your hands in front. Looking down slightly shows extra respect."
          },
          {
            title: "Time Matters",
            content: "While '\uc548\ub155\ud558\uc138\uc694' works throughout the day, Korean also has time-specific phrases: '\uc88b\uc740 \uc544\uce68\uc785\ub2c8\ub2e4' (good morning) for formal settings, and '\uc88b\uc740 \uc800\ub141\uc785\ub2c8\ub2e4' (good evening) for evening encounters. '\uc548\ub155\ud788 \uc8fc\ubb34\uc138\uc694' (sleep well) is reserved for bedtime.",
            tip: "In everyday Korean, '\uc548\ub155\ud558\uc138\uc694' truly covers all times of day \u2014 you can't go wrong with it!"
          },
          {
            title: "Formal vs. Informal",
            content: "Korean has seven speech levels, but the most important distinction is between polite formal ('\u2014\uc2b5\ub2c8\ub2e4'), polite informal ('\u2014\uc694'), and casual ('\u2014\uc544/\uc5b4'). Age and social status determine which level you use. Using casual speech with an elder is a serious social misstep.",
            infographic: 'formalInformal',
            tip: "Always use polite speech ('\u2014\uc694' endings) when meeting someone new. It's the safest default until you know the social dynamics.",
            discoveryNote: "Korean honorifics don't just affect one pronoun — they change the ending of every verb in a conversation. 가세요 (gaseyo — please go, polite) vs. 가 (ga — go, casual). Once you switch speech levels with someone, that level becomes the tone for the whole relationship."
          }
        ],
        conversationStrips: [
          {
            title: "\ud3b8\ud55c \uc778\uc0ac",
            context: "\ubbfc\ud638\uac00 \ubcf5\ub3c4\uc5d0\uc11c \uc9c0\ud604\uc744 \ub9cc\ub098\ub2e4",
            panels: [
              { speaker: "\ubbfc\ud638", gender: "male", text: "\uc9c0\ud604\uc544, \uc548\ub155!", romanization: "Jihyun-a, annyeong!", translation: "Jihyun, hi!" },
              { speaker: "\uc9c0\ud604", gender: "female", text: "\uc5b4, \ubbfc\ud638\uc57c! \uc798 \uc9c0\ub0b4?", romanization: "Eo, Minhoya! Jal jinae?", translation: "Oh, Minho! Are you doing well?" },
              { speaker: "\ubbfc\ud638", gender: "male", text: "\uc751, \uc798 \uc9c0\ub0b4. \ub108\ub294?", romanization: "Eung, jal jinae. Neoneun?", translation: "Yeah, doing well. And you?" },
              { speaker: "\uc9c0\ud604", gender: "female", text: "\ub098\ub3c4 \uc798 \uc9c0\ub0b4! \ub098\uc911\uc5d0 \ubd10!", romanization: "Nado jal jinae! Najunge bwa!", translation: "I'm doing well too! See you later!" }
            ]
          },
          {
            title: "\ub9cc\ub098\uc11c \ubc18\uac00\uc6cc\uc694",
            context: "\ubbfc\ud638\uac00 \uc9c0\ud604\uc5d0\uac8c \uc2a4\uc2a4\ub85c \uc18c\uac1c\ud55c\ub2e4",
            panels: [
              { speaker: "\ubbfc\ud638", gender: "male", text: "\uc548\ub155\ud558\uc138\uc694. \uc800\ub294 \ubbfc\ud638\uc608\uc694.", romanization: "Annyeonghaseyo. Jeoneun Minhoeyeyo.", translation: "Hello. I'm Minho." },
              { speaker: "\uc9c0\ud604", gender: "female", text: "\uc548\ub155\ud558\uc138\uc694, \ubbfc\ud638 \uc528. \uc800\ub294 \uc9c0\ud604\uc774\uc5d0\uc694.", romanization: "Annyeonghaseyo, Minho ssi. Jeoneun Jihyonieyo.", translation: "Hello, Minho. I'm Jihyun." },
              { speaker: "\ubbfc\ud638", gender: "male", text: "\ub9cc\ub098\uc11c \ubc18\uac00\uc6cc\uc694, \uc9c0\ud604 \uc528.", romanization: "Mannaseo bangawoyo, Jihyun ssi.", translation: "Nice to meet you, Jihyun." }
            ]
          },
          {
            title: "\ud560\uba38\ub2c8\uaed8 \u2014 \uc874\ub313\ub9d0",
            context: "\ubbfc\ud638\uac00 \ud560\uba38\ub2c8\ub97c \uacf5\uc2dd\uccb4\ub85c \uc778\uc0ac\ub4dc\ub9b0\ub2e4",
            panels: [
              { speaker: "\ubbfc\ud638", gender: "male", text: "\uc548\ub155\ud788 \uacc4\uc168\uc5b4\uc694, \ud560\uba38\ub2c8?", romanization: "Annyeonghi gyeosseosseoyo, halmeoni?", translation: "Have you been well, Grandma?", note: "\ubbfc\ud638\ub294 \ucc9c\uc5b4\uc6c3\uc5b4\ub978\uaed8 \ud569\uc1fc\uccb4(\uacf5\uc2dd \uacbd\uc5b4)\ub97c \uc4f4\ub2e4" },
              { speaker: "\ud560\uba38\ub2c8", gender: "female", text: "\uadf8\ub798, \ubbfc\ud638\uc57c. \uc798 \uc9c0\ub0b4\uc73c\uc5c8\ub2c8?", romanization: "Geurae, Minhoya. Jal jinaesseni?", translation: "Yes, Minho. Have you been well?", note: "\ud560\uba38\ub2c8\ub294 \ud574\uccb4(\ub9e4\uc6b0 \uce5c\uadfc\ud55c)\ub97c \uc4f4\ub2e4 \u2014 \uc5b4\ub978\uc758 \ud2b9\uad8c" },
              { speaker: "\ubbfc\ud638", gender: "male", text: "\ub124, \ub355\ubd84\uc5d0 \uc798 \uc9c0\ub0b4\uc5b4\uc694.", romanization: "Ne, deokbune jal jinaesseoyo.", translation: "Yes, I've been well, thanks to you." }
            ]
          }
        ],
        culturalSpotlight: {
          title: "\uc874\ub313\ub9d0 (Jondaenmal) \u2014 Honorific Speech",
          content: "Korean honorific speech reflects the deep Confucian values in Korean society. The first questions Koreans often ask new acquaintances are about age and social position \u2014 not to judge, but to know which speech level to use. This system creates a framework of mutual respect that permeates every interaction."
        },
        vocabQA: [
          { question: "이름이 나월요?", answer: "제 이름은 [이름]이에요.", word: "이름", translation: "Name (informal polite — Ireumi mwoyeyo?)" },
          { question: "어떻게 지내세요?", answer: "잘 지내요, 감사합니다.", word: "지내세요", translation: "How are you getting along? (formal)" },
          { question: "만나서 반갑습니다.", answer: "저도 반갑습니다.", word: "반갑습니다", translation: "Nice to meet you (Mannaseo bangapseumnida)" },
          { question: "어디서 오셨어요?", answer: "[나라]에서 왕어요.", word: "오셨어요", translation: "Where are you from? (honorific)" },
          { question: "성함이 어떻게 되세요?", answer: "제 이름은 [이름]입니다.", word: "성함", translation: "Your name? (honorific formal)" }
        ],
        verbGroups: [
          {
            verb: "이에요 / 예요",
            verbTranslation: "am / is / are (informal polite copula)",
            verbHint: "이에요 follows consonants; 예요 follows vowels. This small rule covers half of all Korean introductions.",
            examples: [
              { object: "학생 (haksaeng)",         fullPhrase: "학생이에요.", translation: "I am a student." },
              { object: "선생님 (seonsaengnim)", fullPhrase: "선생님이에요.", translation: "I am a teacher." },
              { object: "한국 사람 (hanguk saram)", fullPhrase: "한국 사람이에요.", translation: "I am Korean." },
              { object: "미국 사람 (miguk saram)", fullPhrase: "미국 사람이에요.", translation: "I am American." },
              { object: "친구 (chingu)",            fullPhrase: "친구예요.", translation: "I am a friend." }
            ]
          }
        ],
        cognateOpener: [
          { native: "\ud638\ud154 (hotel)",            english: "hotel",                                          category: "place"         },
          { native: "\ud0dd\uc2dc (taxi)",             english: "taxi",                                           category: "transport"     },
          { native: "\ub808\uc2a4\ud1a0\ub791 (restaurant)", english: "restaurant",                                     category: "food"          },
          { native: "\ucee4\ud53c (coffee)",            english: "coffee",                                         category: "food"          },
          { native: "\ud154\ub808\ube44\uc804 (television)", english: "television",                                     category: "technology"    },
          { native: "\ubc84\uc2a4 (bus)",               english: "bus",                                            category: "transport"     },
          { native: "\uc2a4\ud3ec\uce20 (sports)",         english: "sports",                                         category: "concept"       },
          { native: "\uc778\ud130\ub137 (internet)",       english: "internet",                                       category: "technology"    },
          { native: "\uce74\uba54\ub77c (camera)",         english: "camera",                                         category: "technology"    },
          { native: "\ud53c\uc544\ub178 (piano)",          english: "piano",                                          category: "concept"       },
          { native: "\uae30\ud0c0 (guitar)",            english: "guitar",                                         category: "concept"       },
          { native: "\uc544\uc774\uc2a4\ud06c\ub9bc (ice cream)", english: "ice cream",                                      category: "food"          },
          { native: "\ucd08\ucf5c\ub9bf (chocolate)",     english: "chocolate",                                      category: "food"          },
          { native: "\uc18c\ud30c (sofa)",              english: "sofa",                                           category: "concept"       },
          { native: "\ud30c\ud2f0 (party)",             english: "party",                                          category: "concept"       },
          { native: "\ud578\ub4dc\ud3f0 (handphone)",    english: "cell phone \u2014 \u201chandphone\u201d is not standard English", category: "false-friend"  },
          { native: "\uc544\uc774\ucfe0\ud551 (eye shopping)", english: "window shopping \u2014 not standard English",   category: "false-friend"  }
        ]
      },
      numbers: {
        welcomeText: "Korean has two complete number systems \u2014 native Korean and Sino-Korean \u2014 each used in different contexts. This chapter guides you through both systems so you can confidently count, shop, and tell time in Korean.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "Sino-Korean numbers (il, i, sam, sa, o) are used for dates, money, phone numbers, and addresses. Native Korean numbers (hana, dul, set, net, daseot) are used for counting objects, age, and hours. Learning when to use which system is key to speaking naturally!",
            tip: "For telling time, hours use native Korean (\ud558\ub098 \uc2dc = one o'clock) but minutes use Sino-Korean (\uc0bc\uc2ed \ubd84 = thirty minutes). They mix in one sentence!"
          },
          {
            title: "Numbers in Daily Life",
            content: "Numbers are essential at Korean markets and convenience stores. Practice '\uc5bc\ub9c8\uc608\uc694?' (eolmayeyo? \u2014 How much is it?) and learn to read prices in won (\uc6d0). Korean currency uses large numbers \u2014 a cup of coffee might be 4,500\uc6d0!",
            tip: "Don't be shocked by large numbers! 10,000 won (\ub9cc \uc6d0) is roughly equivalent to about $7-8 USD. Koreans count in units of 10,000, not 1,000."
          }
        ],
        culturalSpotlight: {
          title: "\uc0ac (\u56db) \u2014 The Number Four",
          content: "Like in other East Asian cultures, the number 4 (\uc0ac, sa) is considered unlucky in Korea because it sounds like the word for death (\u6b7b). Many Korean buildings label the 4th floor as 'F' instead, and gifts in sets of four are avoided. Conversely, the number 8 is considered lucky as it represents prosperity."
        },
        vocabQA: [
          { question: "\uba87 \uc2dc\uc608\uc694?", answer: "\uc138 \uc2dc\uc608\uc694.", answerTranslation: "It is three o'clock." },
          { question: "\uc5bc\ub9c8\uc608\uc694?", answer: "\ub9cc \uc6d0\uc774\uc5d0\uc694.", answerTranslation: "It is 10,000 won." },
          { question: "\uba87 \uc0b4\uc774\uc5d0\uc694?", answer: "\uc2a4\ubb3c\ub2e4\uc37f \uc0b4\uc774\uc5d0\uc694.", answerTranslation: "I am twenty-five years old." },
          { question: "\uba87 \uba85\uc774\uc5d0\uc694?", answer: "\ub2e4\uc12f \uba85\uc774\uc5d0\uc694.", answerTranslation: "There are five people." },
          { question: "\uc804\ud654\ubc88\ud638\uac00 \ubf50\uc608\uc694?", answer: "010-1234-5678\uc774\uc5d0\uc694.", answerTranslation: "My number is 010-1234-5678." }
        ],
        verbGroups: [
          {
            verb: "\uc774\uc5d0\uc694 / \uc608\uc694",
            verbTranslation: "to be (identity, quantity) — \uc774\uc5d0\uc694 after consonant, \uc608\uc694 after vowel",
            examples: [
              { object: "\uc138 \uc2dc", fullPhrase: "\uc138 \uc2dc\uc608\uc694.", translation: "It is three o'clock." },
              { object: "\ub9cc \uc6d0", fullPhrase: "\ub9cc \uc6d0\uc774\uc5d0\uc694.", translation: "It is 10,000 won." },
              { object: "\ub2e4\uc12f \uba85", fullPhrase: "\ub2e4\uc12f \uba85\uc774\uc5d0\uc694.", translation: "There are five people." },
              { object: "\uc2a4\ubb3c\ub2e4\uc37f \uc0b4", fullPhrase: "\uc2a4\ubb3c\ub2e4\uc37f \uc0b4\uc774\uc5d0\uc694.", translation: "I am twenty-five years old." },
              { object: "\uc81c \ubc88\ud638", fullPhrase: "\uc81c \ubc88\ud638\uc608\uc694.", translation: "It's my number." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "Korean has a different word for every family role, and the terms change depending on your gender and who you're addressing. In this chapter, you'll learn the core family vocabulary and the verb 이에요/예요 for introductions.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "Korean has different words for siblings depending on the speaker's gender. A male's older brother is '\ud615' (hyeong), while a female's older brother is '\uc624\ube60' (oppa). '\uc544\ubc84\uc9c0' (abeoji \u2014 father) and '\uc5b4\uba38\ub2c8' (eomeoni \u2014 mother) have casual forms '\uc544\ube60' and '\uc5c4\ub9c8' used within the family.",
            tip: "'\uc624\ube60' (oppa) and '\uc5b8\ub2c8' (eonni) are also used for close older friends of the same gender dynamic \u2014 not just blood relatives!"
          },
          {
            title: "Extended Family",
            content: "Korean has incredibly specific terms for every family relationship. Your father's older brother is '\ud070\uc544\ubc84\uc9c0' (keunabeoji), while your father's younger brother is '\uc791\uc740\uc544\ubc84\uc9c0' (jagunabeoji). Maternal and paternal relatives have completely different titles, reflecting the importance of family lineage."
          }
        ],
        culturalSpotlight: {
          title: "\ucd94\uc11d (Chuseok)",
          content: "Chuseok, the Korean harvest festival, is the most important family gathering of the year. Families travel across the country to reunite at their ancestral homes, prepare traditional songpyeon (rice cakes) together, and perform ancestral rites called '\ucc28\ub840' (charye). It's a time when the entire nation pauses to honor family bonds."
        },
        vocabQA: [
          { question: "\ud615\uc81c\uc790\ub9e4\uac00 \uc788\uc5b4\uc694?",       answer: "\ub124, \uc624\ube60 \ud55c \uba85\uc774 \uc788\uc5b4\uc694.",    word: "\ud615\uc81c\uc790\ub9e4 (hyeongje jamae)", translation: "brothers and sisters" },
          { question: "\uc774 \ubd84\uc740 \ub204\uad6c\uc608\uc694?",         answer: "\uc81c \uc544\ubc84\uc9c0\uc608\uc694.",                     word: "\ub204\uad6c\uc608\uc694 (nugu yeyo)",    translation: "who is this?"         },
          { question: "\uc5b4\uba38\ub2c8 \uc131\ud568\uc774 \uc5b4\ub5bb\uac8c \ub418\uc138\uc694?", answer: "\uc5b4\uba38\ub2c8 \uc131\ud568\uc740 \uae40\uc601\ud76c\uc608\uc694.", word: "\uc131\ud568 (seongham)",          translation: "honorific name"       },
          { question: "\uac00\uc871\uc774 \uba87 \uba85\uc774\uc5d0\uc694?",      answer: "\uac00\uc871\uc774 \ub2e4\uc12f \uba85\uc774\uc5d0\uc694.",       word: "\uba87 \uba85 (myeot myeong)",       translation: "how many people?"     },
          { question: "\ubd80\ubaa8\ub2d8\uc740 \uc5b4\ub514\uc5d0 \uc0ac\uc138\uc694?",   answer: "\ubd80\ubaa8\ub2d8\uc740 \uc11c\uc6b8\uc5d0 \uc0ac\uc138\uc694.",     word: "\ubd80\ubaa8\ub2d8 (bumonnim)",      translation: "parents (honorific)"  }
        ],
        verbGroups: [
          {
            verb: "\uc774\uc5d0\uc694 / \uc608\uc694",
            verbTranslation: "to be (identity, polite)",
            verbHint: "Use \uc774\uc5d0\uc694 after a consonant-ending noun and \uc608\uc694 after a vowel-ending noun. \uc544\ubc84\uc9c0\uc608\uc694 (vowel) \u2022 \ud559\uc0dd\uc774\uc5d0\uc694 (consonant).",
            examples: [
              { object: "\uc544\ubc84\uc9c0 (abeoji)",  fullPhrase: "\uc544\ubc84\uc9c0\uc608\uc694.",  translation: "He is my father."                        },
              { object: "\uc5b4\uba38\ub2c8 (eomeoni)", fullPhrase: "\uc5b4\uba38\ub2c8\uc608\uc694.", translation: "She is my mother."                       },
              { object: "\uc624\ube60 (oppa)",       fullPhrase: "\uc624\ube60\uc608\uc694.",       translation: "He is my older brother. (female speaker)" },
              { object: "\uc5b8\ub2c8 (eonni)",      fullPhrase: "\uc5b8\ub2c8\uc608\uc694.",      translation: "She is my older sister. (female speaker)" },
              { object: "\ud560\uc544\ubc84\uc9c0 (harabeoji)", fullPhrase: "\ud560\uc544\ubc84\uc9c0\uc608\uc694.", translation: "He is my grandfather." }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "This chapter covers the Korean words and phrases you'll use every day: greetings by time of day, essential courtesy words, and vocabulary for shops, cafés, and everyday routines.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "'\uc548\ub155\ud558\uc138\uc694' is your all-purpose daily greeting. When leaving, say '\uc548\ub155\ud788 \uac00\uc138\uc694' (go well) to someone leaving, or '\uc548\ub155\ud788 \uacc4\uc138\uc694' (stay well) if you're the one departing. This distinction shows thoughtfulness about who is staying and who is going.",
            infographic: 'sunArcGreetings',
            tip: "There are two different goodbyes depending on who is leaving \u2014 pay attention to whether you're staying or going!"
          },
          {
            title: "Essential Courtesy",
            content: "'\uac10\uc0ac\ud569\ub2c8\ub2e4' (gamsahamnida \u2014 thank you), '\uc8fc\uc138\uc694' (juseyo \u2014 please give me), and '\uc2e4\ub840\ud569\ub2c8\ub2e4' (sillyehamnida \u2014 excuse me) are the three phrases you'll use most in daily Korean life.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Essential vocabulary: '\uc624\ub298' (oneul \u2014 today), '\ub0b4\uc77c' (naeil \u2014 tomorrow), '\uc5b4\uc81c' (eoje \u2014 yesterday), '\ub124' (ne \u2014 yes), '\uc544\ub2c8\uc694' (aniyo \u2014 no). These simple words are the building blocks of daily Korean conversation.",
            tip: "'\ub124' (ne) is the formal yes, but in casual speech Koreans often say '\uc751' (eung) or '\uc5b4' (eo) instead."
          }
        ],
        culturalSpotlight: {
          title: "\ubc25 \uba39\uc5c8\uc5b4\uc694? (Bap meogeosseoyo?)",
          content: "A uniquely Korean daily greeting is '\ubc25 \uba39\uc5c8\uc5b4\uc694?' (Have you eaten?). It's not actually about food \u2014 it's a way of showing you care about someone's wellbeing, rooted in a time when food was scarce. This phrase perfectly captures the warmth of Korean interpersonal culture."
        },
        vocabQA: [
          { question: "\uc624\ub298 \uc5b4\ub5bb\uac8c \uc9c0\ub0b4\uc138\uc694?", answer: "\uc798 \uc9c0\ub0b4\uc694, \uac10\uc0ac\ud569\ub2c8\ub2e4.", answerTranslation: "I'm well, thank you." },
          { question: "\uc9c0\uae08 \uba87 \uc2dc\uc608\uc694?", answer: "\uc624\uc804 \uc5f4 \uc2dc\uc608\uc694.", answerTranslation: "It is ten in the morning." },
          { question: "\uc624\ub298 \ubb34\uc2a8 \uc694\uc77c\uc774\uc5d0\uc694?", answer: "\uc624\ub298\uc740 \uc6d4\uc694\uc77c\uc774\uc5d0\uc694.", answerTranslation: "Today is Monday." },
          { question: "\uc544\uce68\uc5d0 \ubcf4\ud1b5 \ubba8 \ud574\uc694?", answer: "\uc77c\uacf1 \uc2dc\uc5d0 \uc77c\uc5b4\ub098\uc694.", answerTranslation: "I get up at seven." },
          { question: "\uc9c0\uae08 \uc2dc\uac04 \uc788\uc5b4\uc694?", answer: "\ub124, \uc7a0\uae04 \uc788\uc5b4\uc694.", answerTranslation: "Yes, I have a moment." }
        ],
        verbGroups: [
          {
            verb: "\ud574\uc694",
            verbTranslation: "haeyo \u2014 to do (polite form of \ud558\ub2e4; used for most daily activities)",
            examples: [
              { object: "\uacf5\ubd80", fullPhrase: "\ud55c\uad6d\uc5b4 \uacf5\ubd80\ub97c \ud574\uc694.", translation: "I study Korean." },
              { object: "\uc6b4\ub3d9", fullPhrase: "\uc544\uce68\uc5d0 \uc6b4\ub3d9\uc744 \ud574\uc694.", translation: "I exercise in the morning." },
              { object: "\uc694\ub9ac", fullPhrase: "\uc800\ub141\uc5d0 \uc694\ub9ac\ub97c \ud574\uc694.", translation: "I cook in the evening." },
              { object: "\uc228\uc81c", fullPhrase: "\uc228\uc81c\ub97c \ud574\uc694.", translation: "I do my homework." },
              { object: "\uc1fc\ud551", fullPhrase: "\uc8fc\ub9d0\uc5d0 \uc1fc\ud551\uc744 \ud574\uc694.", translation: "I shop on weekends." }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "수업에 오신 것을 환영합니다! The Korean classroom is a place of structure, respect, and real encouragement. This chapter equips you with the phrases to ask questions politely, keep up with your teacher's instructions, and show that you're a dedicated learner.",
        narrativeSections: [
          {
            title: "질문하기 — Asking Questions",
            content: "'다시 말씀해 주시겠어요?' (Could you say that again?), '천천히 말씀해 주세요' (Please speak slowly), and '...은/는 한국어로 어떻게 말해요?' (How do you say ... in Korean?) are your core classroom phrases. Korean classroom culture is respectful but warm — asking questions shows you care about learning.",
            tip: "Add '선생님' (teacher) before your question — '선생님, 다시 말씀해 주시겠어요?' — it sounds more natural and respectful."
          },
          {
            title: "수업 지시 이해하기 — Understanding Instructions",
            content: "Recognize: '들으세요' (Listen), '따라 하세요' (Repeat after me), '읽으세요' (Read), '쓰세요' (Write), '책을 펴세요' (Open your book), '둘이서' (In pairs). These commands use the formal imperative ending -세요, which is standard in Korean classrooms.",
            tip: "When the teacher says '다 같이!' (All together!), the class answers as one. Don't be shy — joining in is a sign of confidence, not showing off."
          },
          {
            title: "이해 확인하기 — Checking Understanding",
            content: "'맞아요?' (Is that right?), '무슨 뜻이에요?' (What does that mean?), '이해가 안 돼요' (I don't understand), and '예를 들어 주세요' (Please give an example) form the complete toolkit for navigating any confusing moment in class.",
            tip: "'잘 모르겠어요' (I'm not sure) is gentler than a flat 'I don't know' and is considered a mature, honest response in Korean classroom settings."
          }
        ],
        culturalSpotlight: {
          title: "선생님께 대한 존경 (Respect for Teachers)",
          content: "In Korean culture, teachers hold a position of profound respect — rooted in Confucian values that place educators just below parents in the hierarchy of respect. Students rise when a teacher enters the room, address them formally, and express gratitude at the end of class. This respect isn't blind obedience — it's a recognition that the teacher is giving something genuinely valuable. As a language student, reflecting this respect (even informally) creates a warmer, more connected learning environment."
        },
        vocabQA: [
          { question: "\ub2e4\uc2dc \ud55c \ubc88 \ub9d0\uc300\ud574 \uc8fc\uc2dc\uaca0\uc5b4\uc694?", answer: "\ub124, \ubb3c\ub860\uc774\uc8e0.", answerTranslation: "Yes, of course." },
          { question: "'hello'\ub97c \ud55c\uad6d\uc5b4\ub85c \uc5b4\ub5bb\uac8c \ub9d0\ud574\uc694?", answer: "'\uc548\ub155\ud558\uc138\uc694'\ub77c\uace0 \ud569\ub2c8\ub2e4.", answerTranslation: "We say 'annyeonghaseyo'." },
          { question: "\uc774\ud574\ud558\uc138\uc694?", answer: "\uc544\uc9c1 \uc774\ud574\ud558\uc9c0 \ubabb\ud574\uc694.", answerTranslation: "I don't understand yet." },
          { question: "\uc774\uac8c \ub9de\uc544\uc694?", answer: "\ub124, \ub9de\uc544\uc694.", answerTranslation: "Yes, it's correct." },
          { question: "\uc774 \ub2e8\uc5b4\uac00 \ubb34\uc2a8 \ub73b\uc774\uc5d0\uc694?", answer: "'\ub0b4\uc77c'\uc774\ub77c\ub294 \ub73b\uc774\uc5d0\uc694.", answerTranslation: "It means 'tomorrow'." }
        ],
        verbGroups: [
          {
            verb: "\uc774\ud574\ud558\ub2e4",
            verbTranslation: "ihaehada \u2014 to understand (formal polite: \uc774\ud574\ud569\ub2c8\ub2e4; casual polite: \uc774\ud574\ud574\uc694)",
            examples: [
              { object: "\uc9c8\ubb38", fullPhrase: "\uc9c8\ubb38\uc744 \uc774\ud574\ud574\uc694.", translation: "I understand the question." },
              { object: "\uc870\uae08", fullPhrase: "\uc870\uae08 \uc774\ud574\ud574\uc694.", translation: "I understand a little." },
              { object: "\ubabb \ud574\uc694", fullPhrase: "\uc774\ud574\ud558\uc9c0 \ubabb\ud574\uc694.", translation: "I don't understand." },
              { object: "\uc774\uc81c", fullPhrase: "\uc544, \uc774\uc81c \uc774\ud574\ud574\uc694!", translation: "Ah, now I understand!" },
              { object: "\ub2e4", fullPhrase: "\ub2e4 \uc774\ud574\ud574\uc694?", translation: "Do you understand everything?" }
            ]
          }
        ]
      }
    }
  },

  mandarin: {
    greetings: {
      morning: "\u65e9\u4e0a\u597d",
      afternoon: "\u4e0b\u5348\u597d",
      evening: "\u665a\u4e0a\u597d"
    },
    formalInformal: [
      { formal: "\u60a8\u597d\uff0c\u60a8\u8eab\u4f53\u597d\u5417\uff1f", informal: "\u4f60\u597d\uff0c\u6700\u8fd1\u600e\u4e48\u6837\uff1f", context: "How are you?" },
      { formal: "\u5e78\u4f1a", informal: "\u8ba4\u8bc6\u4f60\u5f88\u9ad8\u5174", context: "Nice to meet you" },
      { formal: "\u6253\u6270\u4e00\u4e0b", informal: "\u4e0d\u597d\u610f\u601d", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "\u4f60\u597d", meaning: "Hello" },
      { phrase: "\u518d\u89c1", meaning: "Goodbye" },
      { phrase: "\u8bf7", meaning: "Please" },
      { phrase: "\u8c22\u8c22", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "Mandarin greetings are simpler than they look. In this chapter, you'll learn 你好 (Nǐ hǎo), 早上好 (Zǎoshang hǎo), 再见 (Zàijiàn), and how to introduce yourself — plus the four tones that make all the difference in pronunciation.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "Chinese greetings emphasize care for the other person. '\u4f60\u597d' (n\u01d0 h\u01ceo) literally means 'you good' \u2014 a wish for the other person's wellbeing. In traditional settings, a slight nod or bow accompanies the greeting. Handshakes are common in business, though typically lighter than Western ones.",
            infographic: 'sunArcGreetings',
            tip: "When greeting elders, use '\u60a8\u597d' (n\u00edn h\u01ceo) instead of '\u4f60\u597d' \u2014 the '\u60a8' is the respectful form of 'you'."
          },
          {
            title: "Time Matters",
            content: "'\u65e9\u4e0a\u597d' (z\u01ceo shang h\u01ceo) greets the morning, '\u4e0b\u5348\u597d' (xi\u00e0w\u01d4 h\u01ceo) covers the afternoon, and '\u665a\u4e0a\u597d' (w\u01cen shang h\u01ceo) welcomes the evening. However, the versatile '\u4f60\u597d' works any time of day and is the most commonly used greeting.",
            tip: "In casual Chinese, people often greet with '\u5403\u4e86\u5417\uff1f' (ch\u012b le ma? \u2014 Have you eaten?) \u2014 it's not a dinner invitation, just a warm way to say 'How are you?'"
          },
          {
            title: "Formal vs. Informal",
            content: "Chinese formality is shown through word choice rather than verb conjugation. '\u60a8' (n\u00edn) is the respectful 'you', used with elders, teachers, and in business. '\u4f60' (n\u01d0) is casual. Adding '\u8bf7' (q\u01d0ng \u2014 please) before requests elevates politeness instantly.",
            infographic: 'formalInformal',
            tip: "Chinese politeness relies heavily on titles. Address people as '\u8001\u5e08' (l\u01ceo sh\u012b \u2014 teacher), '\u5148\u751f' (xi\u0101n sheng \u2014 Mr.), or '\u5973\u58eb' (n\u01da sh\u00ec \u2014 Ms.) to show respect.",
            discoveryNote: "Mandarin's formal pronoun \u60a8 (n\u00edn) is built from the characters \u4f60 (n\u01d0 \u2014 casual you) with \u5fc3 (x\u012bn \u2014 heart) written beneath it. One extra stroke signals that you are speaking with care. Chinese encodes deference into the shape of the character itself rather than into verb endings — respect is written, not conjugated."
          }
        ],
        conversationStrips: [
          {
            title: "\u65e5\u5e38\u95ee\u5019",
            context: "\u6d9b\u5728\u8bfe\u524d\u9047\u5230\u534e",
            panels: [
              { speaker: "\u6d9b", gender: "male", text: "\u55e8\uff0c\u534e\uff01", romanization: "H\u0101i, Hu\u00e1!", translation: "Hey, Hua!" },
              { speaker: "\u534e", gender: "female", text: "\u54e6\uff0c\u6d9b\uff01\u4f60\u597d\u5417\uff1f", romanization: "\u00d3, T\u0101o! N\u01d0 h\u01ceo ma?", translation: "Oh, Tao! How are you?" },
              { speaker: "\u6d9b", gender: "male", text: "\u6211\u5f88\u597d\uff0c\u8c22\u8c22\uff01\u4f60\u5462\uff1f", romanization: "W\u01d2 h\u011bn h\u01ceo, xi\u00e8xie! N\u01d0 ne?", translation: "I'm great, thanks! And you?" },
              { speaker: "\u534e", gender: "female", text: "\u6211\u4e5f\u5f88\u597d\uff01\u5f85\u4f1a\u89c1\uff01", romanization: "W\u01d2 y\u011b h\u011bn h\u01ceo! D\u00e0i hu\u00ec ji\u00e0n!", translation: "I'm good too! See you later!" }
            ]
          },
          {
            title: "\u521d\u6b21\u89c1\u9762",
            context: "\u6d9b\u7b2c\u4e00\u6b21\u5411\u534e\u4ecb\u7ecd\u81ea\u5df1",
            panels: [
              { speaker: "\u6d9b", gender: "male", text: "\u4f60\u597d\uff0c\u6211\u53eb\u6d9b\u3002", romanization: "N\u01d0 h\u01ceo, w\u01d2 ji\u00e0o T\u0101o.", translation: "Hello, my name is Tao." },
              { speaker: "\u534e", gender: "female", text: "\u4f60\u597d\uff0c\u6d9b\u3002\u6211\u662f\u534e\u3002\u8ba4\u8bc6\u4f60\u5f88\u9ad8\u5174\u3002", romanization: "N\u01d0 h\u01ceo, T\u0101o. W\u01d2 sh\u00ec Hu\u00e1. R\u00e8nshi n\u01d0 h\u011bn g\u0101ox\u00ecng.", translation: "Hello, Tao. I'm Hua. Nice to meet you." },
              { speaker: "\u6d9b", gender: "male", text: "\u8ba4\u8bc6\u4f60\u6211\u4e5f\u5f88\u9ad8\u5174\u3002", romanization: "R\u00e8nshi n\u01d0 w\u01d2 y\u011b h\u011bn g\u0101ox\u00ecng.", translation: "Nice to meet you too." }
            ]
          },
          {
            title: "\u5c0a\u656c\u5e08\u9577 \u2014 \u6b63\u5f0f\u95ee\u5019",
            context: "\u6d9b\u7528\u60a8\u5411\u5f20\u8001\u5e08\u6b63\u5f0f\u95ee\u5019",
            panels: [
              { speaker: "\u6d9b", gender: "male", text: "\u60a8\u597d\uff0c\u5f20\u8001\u5e08\u3002", romanization: "N\u00edn h\u01ceo, Zh\u0101ng l\u01ceo sh\u012b.", translation: "Hello, Mr. Zhang.", note: "\u6d9b\u7528\u201c\u60a8\u201d\u2014\u2014\u5c0a\u656c\u5f0f\u79f0\u547c" },
              { speaker: "\u5f20\u8001\u5e08", gender: "male", text: "\u4f60\u597d\uff0c\u6d9b\u540c\u5b66\u3002", romanization: "N\u01d0 h\u01ceo, T\u0101o t\u00f3ngxu\u00e9.", translation: "Hello, student Tao.", note: "\u8001\u5e08\u7528\u201c\u4f60\u201d\u2014\u2014\u5bf9\u5b66\u751f\u9002\u5f53" },
              { speaker: "\u6d9b", gender: "male", text: "\u8001\u5e08\u597d\uff01", romanization: "L\u01ceo sh\u012b h\u01ceo!", translation: "Hello, Teacher!" }
            ]
          }
        ],
        culturalSpotlight: {
          title: "\u62f1\u624b (G\u01d2ng Sh\u01d2u) \u2014 The Clasped Hands",
          content: "The traditional Chinese greeting '\u62f1\u624b' involves clasping one's hands together (left over right) and raising them slightly while bowing. Though less common in daily life today, it's still used during Chinese New Year and formal ceremonies. It represents respect and peace \u2014 the covered fist symbolizing restraint and goodwill."
        },
        vocabQA: [
          { question: "你叫什么名字？", answer: "我叫[名字]。", word: "叫 (jiào)", translation: "to be called" },
          { question: "你好吗？", answer: "我很好，谢谢。你呢？", word: "好 (hǎo)", translation: "good / well" },
          { question: "很高兴认识你。", answer: "我也是。", word: "高兴 (gāoxìng)", translation: "happy / pleased to meet you" },
          { question: "你从哪里来？", answer: "我从[城市]来。", word: "从 (cóng)", translation: "from" },
          { question: "您贵姓？", answer: "我姓[姓]。", word: "贵姓 (guìxìng)", translation: "your honorable surname?" }
        ],
        verbGroups: [
          {
            verb: "是 (shì)",
            verbTranslation: "am / is / are (equational)",
            verbHint: "是 links two equal things — I = student. For qualities like ‘I am tall,’ Chinese uses a different structure.",
            examples: [
              { object: "学生 (xuésheng)",    fullPhrase: "我是学生。",      translation: "I am a student." },
              { object: "老师 (lǎshī)",   fullPhrase: "我是老师。",      translation: "I am a teacher." },
              { object: "美国人 (měguórén)", fullPhrase: "我是美国人。", translation: "I am American." },
              { object: "中国人 (zhōngguórén)", fullPhrase: "我是中国人。", translation: "I am Chinese." },
              { object: "朋友 (péngyǒu)", fullPhrase: "我是你的朋友。", translation: "I am your friend." }
            ]
          }
        ],
        cognateOpener: [
          { native: "\u548c\u5496\u5561 (k\u0101f\u0113i)",       english: "coffee",                                       category: "food"          },
          { native: "\u5de7\u514b\u529b (qi\u01ceok\u00e8l\u00ec)",    english: "chocolate",                                    category: "food"          },
          { native: "\u6c99\u53d1 (sh\u0101f\u0101)",          english: "sofa",                                         category: "concept"       },
          { native: "\u6bd4\u8428 (b\u01d0s\u00e0)",          english: "pizza",                                        category: "food"          },
          { native: "\u6c49\u5821 (h\u00e0nb\u01ceo)",        english: "hamburger",                                    category: "food"          },
          { native: "\u6c99\u62c9 (sh\u0101l\u0101)",         english: "salad",                                        category: "food"          },
          { native: "\u5409\u4ed6 (j\u00edt\u0101)",          english: "guitar",                                       category: "concept"       },
          { native: "\u5e7b\u9ed8 (y\u014dm\u00f2)",         english: "humor",                                        category: "concept"       },
          { native: "\u6d6a\u6f2b (l\u00e0ngm\u00e0n)",      english: "romantic",                                     category: "concept"       },
          { native: "\u9a6c\u62c9\u677e (m\u01cel\u0101s\u014dng)", english: "marathon",                                     category: "concept"       },
          { native: "\u82ad\u8d77 (b\u0101l\u011bi)",         english: "ballet",                                       category: "concept"       },
          { native: "\u6251\u514b (p\u016bk\u00e8)",          english: "poker",                                        category: "concept"       },
          { native: "\u5766\u514b (t\u01cenk\u00e8)",         english: "tank (military)",                              category: "concept"       },
          { native: "\u903b\u8f91 (lu\u00f3j\u00ed)",         english: "logic",                                        category: "concept"       },
          { native: "\u5965\u6797\u5339\u514b (\u00e0ol\u00eenp\u01d0k\u00e8)", english: "Olympic",                                      category: "concept"       }
        ]
      },
      numbers: {
        welcomeText: "Chinese numbers are beautifully logical \u2014 once you learn 1-10, you can build any number! This chapter introduces the Chinese counting system, one of the most straightforward in the world, along with the cultural significance numbers carry in Chinese life.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "Chinese numbers follow a perfectly logical system. 11 is simply 'ten-one' (\u5341\u4e00), 20 is 'two-ten' (\u4e8c\u5341), and 99 is 'nine-ten-nine' (\u4e5d\u5341\u4e5d). No irregular teens, no confusing patterns \u2014 just pure mathematical logic. You'll also learn that Chinese uses measure words (classifiers) between numbers and nouns.",
            tip: "The number two has two forms: '\u4e8c' (\u00e8r) for counting and math, and '\u4e24' (li\u01ceng) before measure words. Say '\u4e24\u4e2a' (li\u01ceng ge), not '\u4e8c\u4e2a'."
          },
          {
            title: "Numbers in Daily Life",
            content: "Numbers are woven into Chinese daily life: bargaining at markets ('\u591a\u5c11\u94b1\uff1f' \u2014 du\u014d shao qi\u00e1n? \u2014 How much?), exchanging phone numbers, and understanding addresses. You can even count on one hand up to ten using special finger gestures unique to Chinese culture!",
            tip: "Learn the Chinese hand signs for 6-10 \u2014 they're single-hand gestures that let you silently communicate numbers in noisy markets!"
          }
        ],
        culturalSpotlight: {
          title: "\u516b (\u0042\u0101) \u2014 The Lucky Number Eight",
          content: "The number 8 (\u516b, b\u0101) is the luckiest number in Chinese culture because it sounds like '\u53d1' (f\u0101), meaning prosperity or wealth. The Beijing Olympics started on 08/08/2008 at 8:08 PM. Phone numbers and license plates with multiple 8s sell for premium prices. Meanwhile, 4 (\u56db, s\u00ec) is avoided because it sounds like death (\u6b7b, s\u01d0)."
        },
        vocabQA: [
          { question: "\u51e0\u70b9\u4e86\uff1f", answer: "\u4e09\u70b9\u4e86\u3002", answerTranslation: "It is three o'clock." },
          { question: "\u591a\u5c11\u9322\uff1f", answer: "\u5341\u5757\u9322\u3002", answerTranslation: "Ten yuan." },
          { question: "\u4f60\u51e0\u5c81\uff1f", answer: "\u6211\u4e8c\u5341\u4e94\u5c81\u3002", answerTranslation: "I am twenty-five years old." },
          { question: "\u6709\u51e0\u4e2a\u4eba\uff1f", answer: "\u6709\u4e94\u4e2a\u4eba\u3002", answerTranslation: "There are five people." },
          { question: "\u4f60\u7684\u7535\u8bdd\u53f7\u7801\u662f\u591a\u5c11\uff1f", answer: "\u6211\u7684\u53f7\u7801\u662f139-1234-5678\u3002", answerTranslation: "My number is 139-1234-5678." }
        ],
        verbGroups: [
          {
            verb: "\u6709 (y\u01d2u)",
            verbTranslation: "to have / there is — negated: \u6ca1\u6709 (m\u00e9iy\u01d2u — don't have / there isn't)",
            examples: [
              { object: "\u4e94\u4e2a\u82f9\u679c", fullPhrase: "\u6709\u4e94\u4e2a\u82f9\u679c\u3002", translation: "There are five apples." },
              { object: "\u4e24\u4e2a\u54e5\u54e5", fullPhrase: "\u6211\u6709\u4e24\u4e2a\u54e5\u54e5\u3002", translation: "I have two older brothers." },
              { object: "\u95ee\u9898", fullPhrase: "\u6ca1\u6709\u95ee\u9898\u3002", translation: "No problem." },
              { object: "\u9322", fullPhrase: "\u6211\u6709\u9322\u3002", translation: "I have money." },
              { object: "\u6642\u9593", fullPhrase: "\u6211\u6ca1\u6709\u6642\u9593\u3002", translation: "I don't have time." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "Mandarin distinguishes paternal and maternal relatives with separate words: bàba and māma, but different terms for both sets of grandparents and uncles. In this chapter, you'll learn the core family vocabulary and the structure used to introduce family members.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "Chinese family terms are incredibly specific. Your father's older brother is '\u4f2f\u4f2f' (b\u00f3bo), but his younger brother is '\u53d4\u53d4' (sh\u016bshu). Your mother's brother is '\u8205\u8205' (ji\u00f9jiu). Each relationship has its own unique term, reflecting the importance of family hierarchy in Chinese culture.",
            tip: "'\u7238\u7238' (b\u00e0ba \u2014 dad) and '\u5988\u5988' (m\u0101ma \u2014 mom) are universal \u2014 these sound similar across many languages!"
          },
          {
            title: "Extended Family",
            content: "Chinese distinguishes between maternal and paternal grandparents: '\u7237\u7237' (y\u00e9ye \u2014 paternal grandfather) vs '\u59e5\u7237' (l\u0103oy\u00e9 \u2014 maternal grandfather), '\u5976\u5976' (n\u0103inai \u2014 paternal grandmother) vs '\u59e5\u59e5' (l\u0103olao \u2014 maternal grandmother). This precision extends through the entire family tree."
          }
        ],
        culturalSpotlight: {
          title: "\u5b5d (Xi\u00e0o) \u2014 Filial Piety",
          content: "'\u5b5d' (xi\u00e0o \u2014 filial piety) is one of the most important values in Chinese culture. It encompasses respect, care, and devotion to one's parents and elders. Adult children are expected to care for aging parents, and this value is so central that it's literally built into the Chinese character itself \u2014 '\u5b50' (child) beneath '\u8001' (elder)."
        },
        vocabQA: [
          { question: "\u4f60\u6709\u5144\u5f1f\u59d0\u59b9\u5417\uff1f",         answer: "\u6709\uff0c\u6211\u6709\u4e00\u4e2a\u54e5\u54e5\u548c\u4e00\u4e2a\u59b9\u59b9\u3002",   word: "\u5144\u5f1f\u59d0\u59b9 (xi\u014dngd\u00ec ji\u011bm\u00e8i)", translation: "brothers and sisters" },
          { question: "\u8fd9\u662f\u8c01\uff1f",                       answer: "\u8fd9\u662f\u6211\u7238\u7238\u3002",                    word: "\u8c01 (sh\u00e9i)",                          translation: "who?"                 },
          { question: "\u4f60\u5988\u5988\u53eb\u4ec0\u4e48\u540d\u5b57\uff1f",    answer: "\u6211\u5988\u5988\u53eb\u674e\u660e\u3002",              word: "\u53eb (ji\u00e0o)",                          translation: "is named / called"    },
          { question: "\u4f60\u5bb6\u6709\u51e0\u4e2a\u4eba\uff1f",          answer: "\u6211\u5bb6\u6709\u4e94\u4e2a\u4eba\u3002",                 word: "\u51e0\u4e2a\u4eba (j\u01d0ge r\u00e9n)",          translation: "how many people?"     },
          { question: "\u4f60\u7236\u6bcd\u4f4f\u5728\u54ea\u91cc\uff1f",      answer: "\u6211\u7236\u6bcd\u4f4f\u5728\u5317\u4eac\u3002",             word: "\u4f4f (zh\u00f9)",                           translation: "live / reside"        }
        ],
        verbGroups: [
          {
            verb: "\u662f (sh\u00ec)",
            verbTranslation: "to be (identity)",
            verbHint: "Mandarin family terms are birth-order precise: \u54e5\u54e5 (g\u0113ge) = older brother, \u5f1f\u5f1f (d\u00ecdi) = younger brother, \u59d0\u59d0 (ji\u011bji\u011b) = older sister, \u59b9\u59b9 (m\u00e8imei) = younger sister. There is no single word for \u201csibling.\u201d",
            examples: [
              { object: "\u6211\u7238\u7238 (w\u01d2 b\u00e0ba)",   fullPhrase: "\u4ed6\u662f\u6211\u7238\u7238\u3002",  translation: "He is my father."           },
              { object: "\u6211\u5988\u5988 (w\u01d2 m\u0101ma)",   fullPhrase: "\u5979\u662f\u6211\u5988\u5988\u3002",  translation: "She is my mother."          },
              { object: "\u6211\u54e5\u54e5 (w\u01d2 g\u0113ge)",   fullPhrase: "\u4ed6\u662f\u6211\u54e5\u54e5\u3002",  translation: "He is my older brother."    },
              { object: "\u6211\u59b9\u59b9 (w\u01d2 m\u00e8imei)", fullPhrase: "\u5979\u662f\u6211\u59b9\u59b9\u3002",  translation: "She is my younger sister."  },
              { object: "\u6211\u7237\u7237 (w\u01d2 y\u00e9ye)",   fullPhrase: "\u4ed6\u662f\u6211\u7237\u7237\u3002",  translation: "He is my grandfather."      }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "This chapter covers the Mandarin words and phrases for daily life: time expressions, courtesy words, and vocabulary for shops, restaurants, and everyday routines.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "'\u65e9\u4e0a\u597d' starts your morning, but the versatile '\u4f60\u597d' works all day long. When meeting someone casually, '\u5403\u4e86\u5417?' (Have you eaten?) is a common warm greeting. For goodbyes, '\u518d\u89c1' (z\u00e0i ji\u00e0n \u2014 see you again) is the standard farewell.",
            infographic: 'sunArcGreetings',
            tip: "If someone asks '\u5403\u4e86\u5417?', just reply '\u5403\u4e86\uff01\u4f60\u5462?' (Yes! And you?) \u2014 no need to describe your actual meal!"
          },
          {
            title: "Essential Courtesy",
            content: "'\u8bf7' (q\u01d0ng \u2014 please), '\u8c22\u8c22' (xi\u00e8xie \u2014 thank you), '\u4e0d\u597d\u610f\u601d' (b\u00f9 h\u01ceo y\u00ecsi \u2014 excuse me/sorry) are your daily essentials. Chinese culture values modesty, so '\u54ea\u91cc\u54ea\u91cc' (n\u01cel\u01d0 n\u01cel\u01d0 \u2014 not at all) is the classic response to a compliment.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Build your daily vocabulary: '\u4eca\u5929' (j\u012bnti\u0101n \u2014 today), '\u660e\u5929' (m\u00edngti\u0101n \u2014 tomorrow), '\u6628\u5929' (zu\u00f3ti\u0101n \u2014 yesterday), '\u662f' (sh\u00ec \u2014 yes), '\u4e0d\u662f' (b\u00fa sh\u00ec \u2014 no). These basic words form the foundation of everyday Chinese.",
            tip: "Chinese doesn't conjugate verbs or change tenses like European languages \u2014 context and time words do all the work!"
          }
        ],
        culturalSpotlight: {
          title: "\u559d\u8336 (H\u0113 Ch\u00e1) \u2014 Tea Culture",
          content: "Tea drinking is the daily heartbeat of Chinese culture. From the formal '\u529f\u592b\u8336' (g\u014dngfu ch\u00e1) ceremony to a simple thermos of hot tea carried everywhere, tea is how Chinese people start their day, welcome guests, seal deals, and share quiet moments. Offering someone tea is offering them warmth and respect."
        },
        vocabQA: [
          { question: "\u4f60\u4eca\u5929\u597d\u5417\uff1f", answer: "\u6211\u5f88\u597d\uff0c\u8c22\u8c22\u3002", answerTranslation: "I'm very well, thank you." },
          { question: "\u73b0\u5728\u51e0\u70b9\uff1f", answer: "\u73b0\u5728\u4e0a\u5348\u5341\u70b9\u3002", answerTranslation: "It is ten in the morning." },
          { question: "\u4eca\u5929\u662f\u661f\u671f\u51e0\uff1f", answer: "\u4eca\u5929\u662f\u661f\u671f\u4e00\u3002", answerTranslation: "Today is Monday." },
          { question: "\u4f60\u65e9\u4e0a\u4e00\u822c\u505a\u4ec0\u4e48\uff1f", answer: "\u6211\u4e03\u70b9\u8d77\u5e8a\u3002", answerTranslation: "I get up at seven." },
          { question: "\u4f60\u73b0\u5728\u6709\u65f6\u95f4\u5417\uff1f", answer: "\u6709\uff0c\u6211\u6709\u4e00\u70b9\u65f6\u95f4\u3002", answerTranslation: "Yes, I have a little time." }
        ],
        verbGroups: [
          {
            verb: "\u505a",
            verbTranslation: "zu\u00f2 \u2014 to do / to make (daily activities)",
            examples: [
              { object: "\u4f5c\u4e1a", fullPhrase: "\u6211\u505a\u4f5c\u4e1a\u3002", translation: "I do my homework." },
              { object: "\u996d", fullPhrase: "\u5979\u505a\u996d\u3002", translation: "She cooks (makes a meal)." },
              { object: "\u8fd0\u52a8", fullPhrase: "\u4ed6\u6bcf\u5929\u65e9\u4e0a\u505a\u8fd0\u52a8\u3002", translation: "He exercises every morning." },
              { object: "\u4ec0\u4e48", fullPhrase: "\u4f60\u5728\u505a\u4ec0\u4e48\uff1f", translation: "What are you doing?" },
              { object: "\u51b3\u5b9a", fullPhrase: "\u6211\u4eec\u505a\u4e86\u4e00\u4e2a\u51b3\u5b9a\u3002", translation: "We made a decision." }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "欢迎来到课堂！(Huānyíng lái dào kètáng — Welcome to class!) The Mandarin classroom comes with its own set of essential phrases. This chapter teaches you how to ask for help, follow your teacher's instructions, and navigate confusion — all in Chinese.",
        narrativeSections: [
          {
            title: "提问 — How to Ask",
            content: "'请再说一遍' (Qǐng zài shuō yībiàn — Please say it again), '请说慢一点' (Qǐng shuō màn yīdiǎn — Please speak more slowly), and '...用中文怎么说？' (... yòng Zhōngwén zěnme shuō — How do you say ... in Chinese?) are your most valuable classroom tools. Chinese teachers appreciate students who ask clearly rather than sitting in silent confusion.",
            tip: "Begin any question with '老师' (lǎoshī — teacher) — it's like saying 'Excuse me, teacher' and is the natural way to address an instructor before speaking."
          },
          {
            title: "课堂指令 — Classroom Instructions",
            content: "Learn to recognize: '请听' (Please listen), '请跟我说' (Repeat after me), '请读' (Please read), '请写' (Please write), '请翻开书' (Please open your book), '两人一组' (In pairs). Mandarin instruction verbs are short, clear, and consistent.",
            tip: "'明白了吗？' (Míngbai le ma? — Do you understand?) is a common teacher check-in. A confident '明白了' (I understand) or honest '还不太明白' (Not quite yet) are both perfectly appropriate responses."
          },
          {
            title: "确认理解 — Checking Understanding",
            content: "'这样对吗？' (Zhèyàng duì ma — Is this correct?), '...是什么意思？' (... shì shénme yìsi — What does ... mean?), '我不明白' (Wǒ bù míngbai — I don't understand), and '能举个例子吗？' (Néng jǔ gè lìzi ma — Can you give an example?) are all standard classroom phrases.",
            tip: "'哦，我懂了！' (Ò, wǒ dǒng le — Oh, I get it!) is a natural, enthusiastic way to express a moment of understanding — Chinese teachers genuinely appreciate hearing it."
          }
        ],
        culturalSpotlight: {
          title: "尊师重道 (Zūn Shī Zhòng Dào)",
          content: "The Chinese concept of '尊师重道' (respecting teachers and valuing learning) is one of the oldest educational traditions, rooted in Confucian philosophy. A teacher is seen not just as an instructor but as a moral guide — someone worthy of deep respect. In modern Chinese classrooms, students stand when a teacher enters, address teachers formally, and express gratitude. As a Mandarin learner, understanding this cultural backdrop helps you engage with teachers and native speakers in a more meaningful, connected way."
        },
        vocabQA: [
          { question: "\u80fd\u518d\u8bf4\u4e00\u904d\u5417\uff1f", answer: "\u5f53\u7136\uff0c\u6ca1\u95ee\u9898\u3002", answerTranslation: "Of course, no problem." },
          { question: "'hello'\u7528\u666e\u901a\u8bdd\u600e\u4e48\u8bf4\uff1f", answer: "\u8bf4'\u4f60\u597d'\u3002", answerTranslation: "You say 'n\u01d0 h\u01ceo'." },
          { question: "\u660e\u767d\u5417\uff1f", answer: "\u6211\u8fd8\u4e0d\u660e\u767d\u3002", answerTranslation: "I don't understand yet." },
          { question: "\u8fd9\u6837\u5bf9\u5417\uff1f", answer: "\u5bf9\uff0c\u8fd9\u6837\u5bf9\u3002", answerTranslation: "Yes, that's correct." },
          { question: "\u8fd9\u4e2a\u5b57\u662f\u4ec0\u4e48\u610f\u601d\uff1f", answer: "\u610f\u601d\u662f'\u660e\u5929'\u3002", answerTranslation: "It means 'tomorrow'." }
        ],
        verbGroups: [
          {
            verb: "\u660e\u767d",
            verbTranslation: "m\u00edngbai \u2014 to understand (adj/verb; \u6211\u660e\u767d\u4e86 = I understand now; tone: m\u00edng2 b\u00e1i2)",
            examples: [
              { object: "\u95ee\u9898", fullPhrase: "\u6211\u660e\u767d\u8fd9\u4e2a\u95ee\u9898\u3002", translation: "I understand this question." },
              { object: "\u4e00\u70b9\u70b9", fullPhrase: "\u6211\u660e\u767d\u4e00\u70b9\u70b9\u3002", translation: "I understand a little." },
              { object: "\u4e0d\u660e\u767d", fullPhrase: "\u6211\u4e0d\u660e\u767d\u3002", translation: "I don't understand." },
              { object: "\u4e86", fullPhrase: "\u554a\uff0c\u6211\u660e\u767d\u4e86\uff01", translation: "Ah, I understand now!" },
              { object: "\u5168\u90e8", fullPhrase: "\u4f60\u5168\u90e8\u660e\u767d\u5417\uff1f", translation: "Do you understand everything?" }
            ]
          }
        ]
      }
    }
  },

  portuguese: {
    greetings: {
      morning: "Bom dia",
      afternoon: "Boa tarde",
      evening: "Boa noite"
    },
    formalInformal: [
      { formal: "Como est\u00e1 o senhor?", informal: "Tudo bem?", context: "How are you?" },
      { formal: "\u00c9 um prazer conhec\u00ea-lo", informal: "Prazer!", context: "Nice to meet you" },
      { formal: "Com licen\u00e7a", informal: "D\u00e1 licen\u00e7a", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "Ol\u00e1", meaning: "Hello" },
      { phrase: "Tchau", meaning: "Goodbye" },
      { phrase: "Por favor", meaning: "Please" },
      { phrase: "Obrigado/Obrigada", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "In this chapter, you'll learn the core Portuguese greetings — Bom dia, Boa tarde, Boa noite — how tu and você split formal from informal, and the phrases for introducing yourself in Brazilian and European contexts.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "Portuguese greetings are warm and physical. In Brazil, expect hugs and cheek kisses even among new acquaintances. In Portugal, two cheek kisses are standard between women and mixed-gender greetings. The warmth of 'Ol\u00e1!' combined with a genuine smile opens every heart.",
            infographic: 'sunArcGreetings',
            tip: "In Brazil, cheek kisses vary by city: one kiss in S\u00e3o Paulo, two in Rio de Janeiro, and three in some northeastern cities!"
          },
          {
            title: "Time Matters",
            content: "'Bom dia' brightens the morning, 'Boa tarde' accompanies the afternoon, and 'Boa noite' serves for both evening greetings and goodnight wishes. Notice that 'dia' is masculine (bom) while 'tarde' and 'noite' are feminine (boa) \u2014 gender matters even in greetings!",
            tip: "In Brazil, 'Bom dia' can last well past noon in casual settings \u2014 Brazilians aren't in a rush to change greetings!"
          },
          {
            title: "Formal vs. Informal",
            content: "Portuguese uses 'voc\u00ea' (informal) and 'o senhor/a senhora' (formal) to distinguish between casual and respectful address. In Brazil, 'voc\u00ea' is widely used even in semi-formal settings, while Portugal retains more formal distinctions with 'tu' for friends and 'voc\u00ea' for acquaintances.",
            infographic: 'formalInformal',
            tip: "Brazilian Portuguese is generally less formal than European Portuguese \u2014 but always use 'o senhor/a senhora' with elderly people.",
            discoveryNote: "Portuguese voc\u00ea takes the same verb endings as ele (he) and ela (she). 'Voc\u00ea fala' (you speak) and 'Ela fala' (she speaks) conjugate identically. The same pattern appears in Spanish usted and Italian Lei \u2014 Romance languages repeatedly repurposed third-person pronouns to signal deference, turning 'speaking about someone' into 'speaking respectfully to them'."
          }
        ],
        conversationStrips: [
          {
            title: "Um Cumprimento Casual",
            context: "Camilo encontra Isabel antes da aula",
            panels: [
              { speaker: "Camilo", gender: "male", text: "Oi, Isabel!", translation: "Hi, Isabel!" },
              { speaker: "Isabel", gender: "female", text: "Oi, Camilo! Tudo bem?", translation: "Hi, Camilo! All good?" },
              { speaker: "Camilo", gender: "male", text: "Tudo \u00f3timo, obrigado! E voc\u00ea?", translation: "Everything's great, thanks! And you?" },
              { speaker: "Isabel", gender: "female", text: "Tudo bem! At\u00e9 logo!", translation: "All good! See you later!" }
            ]
          },
          {
            title: "Muito Prazer",
            context: "Camilo se apresenta para Isabel no primeiro dia",
            panels: [
              { speaker: "Camilo", gender: "male", text: "Ol\u00e1, me chamo Camilo.", translation: "Hello, my name is Camilo." },
              { speaker: "Isabel", gender: "female", text: "Muito prazer, Camilo. Eu sou a Isabel.", translation: "Nice to meet you, Camilo. I'm Isabel." },
              { speaker: "Camilo", gender: "male", text: "O prazer \u00e9 meu, Isabel.", translation: "The pleasure is mine, Isabel." }
            ]
          },
          {
            title: "Na Empresa \u2014 Registro Formal",
            context: "Camilo cumprimenta o Sr. Oliveira numa reuni\u00e3o de trabalho",
            panels: [
              { speaker: "Camilo", gender: "male", text: "Bom dia, senhor Oliveira. Me chamo Camilo.", translation: "Good morning, Mr. Oliveira. My name is Camilo.", note: "Camilo uses 'senhor' — the formal register" },
              { speaker: "Sr. Oliveira", gender: "male", text: "Bom dia, senhor Camilo. \u00c9 um prazer conhec\u00ea-lo.", translation: "Good morning, Camilo. It's a pleasure to meet you.", note: "Mutual 'senhor' — standard in Brazilian professional settings" },
              { speaker: "Camilo", gender: "male", text: "O prazer \u00e9 meu, senhor Oliveira.", translation: "The pleasure is mine, Mr. Oliveira." }
            ]
          }
        ],
        culturalSpotlight: {
          title: "Abra\u00e7o Brasileiro",
          content: "The Brazilian 'abra\u00e7o' (hug) is legendary. Brazilians embrace warmly and genuinely, even with people they've just met. This physical warmth extends to back-patting, arm-touching during conversation, and standing close while talking. It reflects 'calor humano' (human warmth) \u2014 the Brazilian belief that connection requires closeness."
        },
        genderPairs: [
          { masculine: "contente",   feminine: "contente",   translation: "happy — same form for both!" },
          { masculine: "cansado",    feminine: "cansada",    translation: "tired" },
          { masculine: "ocupado",    feminine: "ocupada",    translation: "busy" },
          { masculine: "doente",     feminine: "doente",     translation: "sick — same form for both!" },
          { masculine: "nervoso",    feminine: "nervosa",    translation: "nervous" },
          { masculine: "animado",    feminine: "animada",    translation: "excited" }
        ],
        vocabQA: [
          { question: "Como se chama?", answer: "Chamo-me [nome].", word: "chamo-me", translation: "I call myself (European)" },
          { question: "Como você se chama?", answer: "Meu nome é [nome].", word: "nome", translation: "name (Brazilian)" },
          { question: "Como vai?", answer: "Vai bem, obrigado(a). E você?", word: "vai", translation: "goes / how is it going?" },
          { question: "Muito prazer.", answer: "O prazer é meu.", word: "prazer", translation: "pleasure / nice to meet you" },
          { question: "De onde você é?", answer: "Sou de [cidade].", word: "sou", translation: "I am (ser)" },
          { question: "Tudo bem?", answer: "Tudo bem, obrigado(a)!", word: "tudo", translation: "everything / all good?" }
        ],
        verbGroups: [
          {
            verb: "estar",
            verbTranslation: "to be (condition or temporary state)",
            verbHint: "Estar captures how something is right now — feelings, health, and situations in flux.",
            examples: [
              { object: "bem",         fullPhrase: "Estou bem.",     translation: "I am well." },
              { object: "cansado(a)",  fullPhrase: "Estou cansado.", translation: "I am tired." },
              { object: "ótimo(a)", fullPhrase: "Estou ótimo.", translation: "I am great." },
              { object: "mal",         fullPhrase: "Estou mal.",     translation: "I am not well." },
              { object: "ocupado(a)",  fullPhrase: "Estou ocupado.", translation: "I am busy." },
              { object: "feliz",       fullPhrase: "Estou feliz.",   translation: "I am happy." }
            ]
          }
        ]
      },
      numbers: {
        welcomeText: "Portuguese numbers have one key difference from Spanish: feminine forms for 1 and 2 (uma, duas). This chapter covers 1 to 1,000, plus how numbers appear in prices, phone numbers, and bus schedules.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "Portuguese numbers flow rhythmically: um, dois, tr\u00eas, quatro, cinco. The teens follow a pattern with 'dez' (ten) at the base: onze (11), doze (12), treze (13). From 20 onward, use 'e' (and) to connect: 'vinte e um' (21), 'trinta e dois' (32). The system is logical and musical.",
            tip: "Numbers have gender agreement: 'um livro' (one book, masculine) vs 'uma mesa' (one table, feminine). This applies to 1 and 2, as well as hundreds."
          },
          {
            title: "Numbers in Daily Life",
            content: "Practice with 'Quanto custa?' (How much does it cost?) in Brazilian markets, or reading prices in reais (R$) and euros (\u20ac). Phone numbers, addresses, and bus routes all need numbers. In Brazil, even ordering at a bakery uses the 'senha' (numbered ticket) system!",
            tip: "In Brazil, large numbers use periods for thousands and commas for decimals: R$ 1.500,00 (one thousand five hundred reais)."
          }
        ],
        culturalSpotlight: {
          title: "O Jogo do Bicho",
          content: "Brazil's famous 'Jogo do Bicho' (Animal Game) is a popular number-based lottery where each group of numbers is associated with an animal. Dreams are interpreted through animals and their corresponding numbers. Dreaming of a cat? Bet on number 14! This unique blend of numbers, animals, and superstition is deeply woven into Brazilian popular culture."
        },
        vocabQA: [
          { question: "Quantos anos voc\u00ea tem?", answer: "Tenho vinte e cinco anos.", answerTranslation: "I am twenty-five years old." },
          { question: "Quanto custa?", answer: "Custa dez reais.", answerTranslation: "It costs ten reais." },
          { question: "Que horas s\u00e3o?", answer: "S\u00e3o tr\u00eas horas.", answerTranslation: "It is three o'clock." },
          { question: "Quantas pessoas h\u00e1?", answer: "H\u00e1 cinco pessoas.", answerTranslation: "There are five people." },
          { question: "Qual \u00e9 o seu n\u00famero de telefone?", answer: "O meu n\u00famero \u00e9 11 98765-4321.", answerTranslation: "My number is 11 98765-4321." }
        ],
        verbGroups: [
          {
            verb: "ter",
            verbTranslation: "to have (age, possessions)",
            examples: [
              { object: "vinte anos", fullPhrase: "Tenho vinte anos.", translation: "I am twenty years old." },
              { object: "fome", fullPhrase: "Tenho fome.", translation: "I am hungry." },
              { object: "dinheiro", fullPhrase: "Tenho dinheiro.", translation: "I have money." },
              { object: "tempo", fullPhrase: "N\u00e3o tenho tempo.", translation: "I don't have time." },
              { object: "uma pergunta", fullPhrase: "Tenho uma pergunta.", translation: "I have a question." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "In this chapter, you'll learn the Portuguese words for immediate and extended family — mãe, pai, irmão, irmã, avó, tio — plus the verb ser for introducing them, and a few places where Brazilian and European Portuguese differ.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "Portuguese family vocabulary includes 'pai' (father), 'm\u00e3e' (mother), 'irm\u00e3o' (brother), 'irm\u00e3' (sister). In Brazilian culture, families tend to be large and inclusive, with close friends often earning the title of 'tio/tia' (uncle/aunt) as a sign of affection and belonging.",
            tip: "In Brazil, calling a close family friend 'tio' or 'tia' is a beautiful sign of inclusion \u2014 they become part of your extended family!"
          },
          {
            title: "Extended Family",
            content: "Portuguese has rich terms for extended relationships: 'sogra' (mother-in-law), 'cunhado' (brother-in-law), 'sobrinho' (nephew), 'sobrinha' (niece). The concept of 'compadre' and 'comadre' (godparent bonds) creates sacred family ties that extend the family circle even further."
          }
        ],
        culturalSpotlight: {
          title: "O Churrasco em Fam\u00edlia",
          content: "The Brazilian family 'churrasco' (barbecue) is a sacred Sunday tradition. Extended families gather for hours around the grill, with grandparents, cousins, and neighbors all welcome. The 'churrasqueiro' (grill master) holds a place of honor, and the event is as much about storytelling and laughter as it is about the perfectly seasoned picanha."
        },
        genderFrame: { masculine: "Ele \u00e9 meu ___.", feminine: "Ela \u00e9 minha ___." },
        genderPairs: [
          { masculine: "meu pai",    feminine: "minha m\u00e3e",   translation: "my father / my mother"           },
          { masculine: "meu irm\u00e3o", feminine: "minha irm\u00e3", translation: "my brother / my sister"          },
          { masculine: "meu av\u00f4",   feminine: "minha av\u00f3",  translation: "my grandfather / my grandmother" },
          { masculine: "meu tio",    feminine: "minha tia",   translation: "my uncle / my aunt"              },
          { masculine: "meu primo",  feminine: "minha prima", translation: "my (male) / my (female) cousin"  }
        ],
        vocabQA: [
          { question: "Voc\u00ea tem irm\u00e3os ou irm\u00e3s?",           answer: "Sim, tenho um irm\u00e3o e uma irm\u00e3.",    word: "irm\u00e3os",    translation: "brothers / siblings" },
          { question: "Quem \u00e9 esse?",                        answer: "\u00c9 meu pai.",                             word: "quem \u00e9",    translation: "who is this?"        },
          { question: "Como se chama sua m\u00e3e?",              answer: "Ela se chama Maria.",                    word: "se chama",  translation: "is named"            },
          { question: "Quantas pessoas tem na sua fam\u00edlia?", answer: "Somos cinco na fam\u00edlia.",               word: "quantas",   translation: "how many"            },
          { question: "Onde moram seus pais?",              answer: "Meus pais moram em Lisboa.",            word: "moram",     translation: "live / reside"       }
        ],
        verbGroups: [
          {
            verb: "ser",
            verbTranslation: "to be (permanent identity)",
            examples: [
              { object: "meu pai",    fullPhrase: "Ele \u00e9 meu pai.",    translation: "He is my father."       },
              { object: "minha m\u00e3e",   fullPhrase: "Ela \u00e9 minha m\u00e3e.",   translation: "She is my mother."      },
              { object: "meu irm\u00e3o",  fullPhrase: "Ele \u00e9 meu irm\u00e3o.",  translation: "He is my brother."      },
              { object: "minha irm\u00e3", fullPhrase: "Ela \u00e9 minha irm\u00e3.", translation: "She is my sister."      },
              { object: "meu av\u00f4",    fullPhrase: "Ele \u00e9 meu av\u00f4.",    translation: "He is my grandfather."  }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "This chapter covers the Portuguese vocabulary you'll use every day: time expressions, courtesy words, and the phrases for shops, cafés, and common daily routines in Brazil and Portugal.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "'Bom dia' opens your morning with sunshine, 'Boa tarde' carries the afternoon warmth, and 'Boa noite' welcomes the evening. In Brazil, the casual 'E a\u00ed?' (What's up?) or 'Beleza?' (All good?) adds a relaxed, friendly vibe to any encounter.",
            infographic: 'sunArcGreetings',
            tip: "In Brazil, 'Tudo bem?' (All good?) is the most common daily greeting \u2014 and the expected answer is always 'Tudo bem!' even if things aren't perfect!"
          },
          {
            title: "Essential Courtesy",
            content: "'Por favor' (please), 'Obrigado' (thank you, said by males) or 'Obrigada' (said by females), and 'Com licen\u00e7a' (excuse me) are your daily must-haves. Add 'De nada' (you're welcome) and you'll navigate any situation gracefully.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Essential daily vocabulary: 'hoje' (today), 'amanh\u00e3' (tomorrow), 'ontem' (yesterday), 'sim' (yes), 'n\u00e3o' (no), 'o dia' (the day), 'a noite' (the night). These words weave through every Portuguese conversation.",
            tip: "'Obrigado' changes based on who is speaking, not who you're thanking \u2014 men say 'obrigado' and women say 'obrigada'!"
          }
        ],
        culturalSpotlight: {
          title: "O Cafezinho",
          content: "The Brazilian 'cafezinho' (little coffee) ritual is a cornerstone of daily life. Strong, sweet, and served in tiny cups, cafezinho is offered to every guest, at every meeting, and at every opportunity. Refusing a cafezinho can even be considered impolite! It's less about caffeine and more about the warmth of sharing a moment together."
        },
        vocabQA: [
          { question: "Como est\u00e1 hoje?", answer: "Estou muito bem, obrigado/a.", answerTranslation: "I'm very well, thank you." },
          { question: "Que horas s\u00e3o?", answer: "S\u00e3o dez horas da manh\u00e3.", answerTranslation: "It is ten in the morning." },
          { question: "Que dia \u00e9 hoje?", answer: "Hoje \u00e9 segunda-feira.", answerTranslation: "Today is Monday." },
          { question: "O que faz de manh\u00e3?", answer: "Acordo \u00e0s sete horas.", answerTranslation: "I wake up at seven." },
          { question: "Tem tempo?", answer: "Sim, tenho um momento.", answerTranslation: "Yes, I have a moment." }
        ],
        verbGroups: [
          {
            verb: "fazer",
            verbTranslation: "to do / to make (daily activities)",
            examples: [
              { object: "exerc\u00edcio", fullPhrase: "Ele faz exerc\u00edcio de manh\u00e3.", translation: "He exercises in the morning." },
              { object: "o jantar", fullPhrase: "Ela faz o jantar.", translation: "She makes dinner." },
              { object: "as compras", fullPhrase: "Eu fa\u00e7o as compras no fim de semana.", translation: "I do the shopping on the weekend." },
              { object: "a li\u00e7\u00e3o de casa", fullPhrase: "Voc\u00ea faz a li\u00e7\u00e3o de casa?", translation: "Do you do your homework?" },
              { object: "uma caminhada", fullPhrase: "N\u00f3s fazemos uma caminhada.", translation: "We go for a walk." }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "Bem-vindos à aula! The Portuguese classroom — whether in Brazil or Portugal — has its own warm, engaging character. This chapter gives you the tools to participate fully: asking for clarification, following instructions, and showing your teacher you're genuinely engaged.",
        narrativeSections: [
          {
            title: "Como Pedir Ajuda — How to Ask for Help",
            content: "'Pode repetir, por favor?' (Can you repeat, please?), 'Mais devagar, por favor' (More slowly, please), and 'Como se diz...?' (How do you say...?) are your core classroom phrases. Brazilian and European Portuguese share these, though pronunciation differs slightly.",
            tip: "In Brazil, 'por favor' and 'por gentileza' are both common — the latter sounds a bit more formal and is often used in classrooms. In Portugal, 'se faz favor' is frequently heard."
          },
          {
            title: "Entendendo as Instruções — Understanding Instructions",
            content: "Your teacher will use: 'Ouçam' (Listen), 'Repitam' (Repeat), 'Leiam' (Read), 'Escrevam' (Write), 'Abram o livro' (Open the book), 'Em duplas' (In pairs). These command forms use the third-person plural imperative, standard for classroom Portuguese.",
            tip: "Brazilian classrooms often feel more conversational than formal — your teacher may say 'Tá bom?' (Is that okay?) or 'Entenderam?' (Did everyone understand?) with genuine warmth."
          },
          {
            title: "Verificando a Compreensão — Checking Understanding",
            content: "'Está correto?' (Is that correct?), 'O que significa...?' (What does ... mean?), 'Não entendi' (I didn't understand), and 'Pode dar um exemplo?' (Can you give an example?) complete your toolkit for navigating any lesson.",
            tip: "'Consegui!' (I got it!) or 'Entendi!' (I understood!) are natural, enthusiastic responses when something clicks — using them shows engagement and makes the class more energetic."
          }
        ],
        culturalSpotlight: {
          title: "Jeitinho Brasileiro na Sala de Aula",
          content: "The 'jeitinho brasileiro' — the Brazilian way of finding a creative solution to any situation — extends to the classroom. Brazilian students tend to be expressive, participative, and relationship-oriented. A Brazilian language class often feels like a conversation among people who genuinely want each other to succeed. In Portugal, classrooms are somewhat more formal, but the underlying warmth and hospitality ('hospitalidade') remain. Either way, showing enthusiasm for the language is always the right move."
        },
        vocabQA: [
          { question: "Pode repetir, por favor?", answer: "Claro, com prazer.", answerTranslation: "Of course, with pleasure." },
          { question: "Como se diz 'hello' em portugu\u00eas?", answer: "Diz-se 'ol\u00e1'.", answerTranslation: "You say 'ol\u00e1'." },
          { question: "Entende?", answer: "Ainda n\u00e3o entendo.", answerTranslation: "I don't understand yet." },
          { question: "Est\u00e1 correto?", answer: "Sim, est\u00e1 correto.", answerTranslation: "Yes, it's correct." },
          { question: "O que significa esta palavra?", answer: "Significa 'amanh\u00e3'.", answerTranslation: "It means 'tomorrow'." }
        ],
        verbGroups: [
          {
            verb: "entender",
            verbTranslation: "to understand (eu entendo, voc\u00ea entende, n\u00f3s entendemos \u2014 regular -er verb)",
            examples: [
              { object: "a pergunta", fullPhrase: "Eu entendo a pergunta.", translation: "I understand the question." },
              { object: "um pouco", fullPhrase: "Entendo um pouco.", translation: "I understand a little." },
              { object: "nada", fullPhrase: "N\u00e3o entendo nada.", translation: "I don't understand anything." },
              { object: "agora", fullPhrase: "Ah, agora entendo!", translation: "Ah, now I understand!" },
              { object: "tudo", fullPhrase: "Voc\u00ea entende tudo?", translation: "Do you understand everything?" }
            ]
          }
        ]
      }
    }
  },

  english: {
    greetings: {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening"
    },
    formalInformal: [
      { formal: "How do you do?", informal: "How's it going?", context: "How are you?" },
      { formal: "Pleased to meet you", informal: "Nice to meet you!", context: "Nice to meet you" },
      { formal: "Pardon me", informal: "Sorry!", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "Hello", meaning: "Hello" },
      { phrase: "Goodbye", meaning: "Goodbye" },
      { phrase: "Please", meaning: "Please" },
      { phrase: "Thank you", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "In this chapter, you'll learn the greetings English speakers actually use — from Hello and Good morning to Hey and What's up — which are formal, which are casual, and how to introduce yourself confidently in any English-speaking context.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "English greetings range from the formal handshake of a business meeting to the casual 'Hey!' shouted across a room. The key is reading the situation: a job interview calls for 'How do you do?', while meeting a friend's friend needs only a warm 'Nice to meet you!' with a smile.",
            infographic: 'sunArcGreetings',
            tip: "In English-speaking cultures, a firm (but not crushing) handshake with eye contact makes a great first impression."
          },
          {
            title: "Time Matters",
            content: "'Good morning' brightens the start of the day, 'Good afternoon' covers post-lunch hours, and 'Good evening' arrives around sunset. 'Good night' is only for farewell or bedtime \u2014 never as a greeting. Casually, 'Hi' and 'Hey' work any time.",
            tip: "The transition from 'Good morning' to 'Good afternoon' happens at noon \u2014 but many people just say 'Hi' to avoid the question entirely!"
          },
          {
            title: "Formal vs. Informal",
            content: "English doesn't have formal 'you' like many languages, but formality shows through word choice and tone. 'Could you possibly...' is more formal than 'Can you...', and 'How do you do?' is far more formal than 'What's up?'. Context is everything.",
            infographic: 'formalInformal',
            tip: "English speakers often use indirect language for politeness: 'Would you mind...?' and 'I was wondering if...' soften requests beautifully.",
            discoveryNote: "English used to have a formal/informal split: 'thou' was the intimate form (like French tu), 'you' was the respectful plural (like French vous). By the 17th century, 'you' absorbed both roles completely. The distinction vanished so thoroughly that English now compensates with vocabulary and indirection — 'Could you possibly...?' doing the work that a single pronoun does in French, Spanish, or German."
          }
        ],
        conversationStrips: [
          {
            title: "A Casual Hello",
            context: "Blake runs into Cindy between classes",
            panels: [
              { speaker: "Blake", gender: "male", text: "Hey, Cindy!", translation: "(informal hello)" },
              { speaker: "Cindy", gender: "female", text: "Hey, Blake! How's it going?", translation: "(casual: How are you?)" },
              { speaker: "Blake", gender: "male", text: "Pretty good, thanks! You?", translation: "(short for: And how are you?)" },
              { speaker: "Cindy", gender: "female", text: "Great! See you later!", translation: "(friendly goodbye)" }
            ]
          },
          {
            title: "Nice to Meet You",
            context: "Blake introduces himself to Cindy on the first day",
            panels: [
              { speaker: "Blake", gender: "male", text: "Hi, I'm Blake.", translation: "(casual introduction)" },
              { speaker: "Cindy", gender: "female", text: "Nice to meet you, Blake. I'm Cindy.", translation: "(friendly response)" },
              { speaker: "Blake", gender: "male", text: "Nice to meet you too, Cindy.", translation: "(echoing the phrase — very natural)" }
            ]
          },
          {
            title: "A Formal Introduction",
            context: "Blake meets Mr. Thompson at a job interview",
            panels: [
              { speaker: "Blake", gender: "male", text: "Good morning. I'm Blake Morrison.", translation: "(formal: full name, time-specific greeting)", note: "Use full name in formal situations" },
              { speaker: "Mr. Thompson", gender: "male", text: "Good morning, Blake. Pleased to meet you. I'm Mr. Thompson.", translation: "(formal response — 'Pleased to meet you' over 'Nice to meet you')", note: "'Pleased to meet you' is more formal than 'Nice to meet you'" },
              { speaker: "Blake", gender: "male", text: "Pleased to meet you, Mr. Thompson.", translation: "(mirroring the formal register is always safe)" }
            ]
          }
        ],
        culturalSpotlight: {
          title: "Small Talk",
          content: "The art of 'small talk' is central to English-speaking cultures. Talking about weather, weekend plans, or sports with strangers isn't meaningless \u2014 it's how trust is built. Mastering light, friendly conversation about everyday topics is one of the most valuable English skills you can develop."
        },
        vocabQA: [
          { question: "What’s your name?", answer: "My name is [name]. / I’m [name].", word: "name", translation: "two natural ways to introduce yourself" },
          { question: "How are you?", answer: "I’m doing well, thank you. And you?", word: "well", translation: "the most common polite response" },
          { question: "It’s nice to meet you.", answer: "Nice to meet you too. / The pleasure is mine.", word: "pleasure", translation: "a slightly more formal reply" },
          { question: "Where are you from?", answer: "I’m from [city / country].", word: "from", translation: "use ‘from,’ not ‘of’" },
          { question: "How do you do?", answer: "How do you do? / Very well, thank you.", word: "do you do", translation: "the formal British-style greeting" }
        ],
        verbGroups: [
          {
            verb: "to be",
            verbTranslation: "am / is / are (state or condition)",
            verbHint: "Every greetings answer in English uses ‘to be.’ Master it first — it unlocks nearly every introductory sentence.",
            examples: [
              { object: "well",  fullPhrase: "I am well.",            translation: "formal polite response" },
              { object: "tired", fullPhrase: "I am tired.",           translation: "I need rest." },
              { object: "happy", fullPhrase: "I am happy.",           translation: "I feel good." },
              { object: "busy",  fullPhrase: "I am busy.",            translation: "I have a lot to do." },
              { object: "fine",  fullPhrase: "I’m fine, thank you.", translation: "common casual response" },
              { object: "great", fullPhrase: "I’m doing great!",  translation: "enthusiastic response" }
            ]
          }
        ]
      },
      numbers: {
        welcomeText: "English numbers are used worldwide in science, business, and technology. This chapter covers the English counting system, from basic digits to the quirky rules that make numbers like 'thirteen' and 'fifty' a bit tricky for learners.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "English numbers from 1-12 are unique words, and the teens (13-19) add '-teen' to the base: thirteen, fourteen, fifteen. The tens follow with '-ty': twenty, thirty, forty. Watch out for irregulars: 'eleven' and 'twelve' don't follow any pattern, and 'forty' drops the 'u' from 'four'!",
            tip: "Many learners confuse '-teen' (13-19) with '-ty' (30-90). Pay attention to stress: 'thirTEEN' vs 'THIRty' \u2014 the emphasis shifts!"
          },
          {
            title: "Numbers in Daily Life",
            content: "Numbers appear everywhere in English: telling time ('quarter past three'), giving phone numbers (digit by digit), reading prices ('three ninety-nine'), and describing addresses. Practice with real-world scenarios to build confidence.",
            tip: "In American English, the ground floor is '1st floor', but in British English, it's the 'ground floor' and the next one up is '1st floor' \u2014 this confuses even native speakers traveling abroad!"
          }
        ],
        culturalSpotlight: {
          title: "Lucky Number Seven",
          content: "In English-speaking cultures, 7 is widely considered the luckiest number. From 'lucky sevens' in slot machines to the seven wonders of the world, this number carries special significance. Meanwhile, 13 is considered unlucky \u2014 so much so that many buildings skip the 13th floor entirely, a phenomenon called 'triskaidekaphobia'."
        },
        vocabQA: [
          { question: "How old are you?", answer: "I am twenty-five years old.", answerTranslation: "Twenty-five." },
          { question: "How much does it cost?", answer: "It costs ten dollars.", answerTranslation: "Ten dollars." },
          { question: "What time is it?", answer: "It is three o'clock.", answerTranslation: "Three o'clock." },
          { question: "How many people are there?", answer: "There are five people.", answerTranslation: "Five." },
          { question: "What is your phone number?", answer: "My number is 555-1234.", answerTranslation: "Five-five-five, one-two-three-four." }
        ],
        verbGroups: [
          {
            verb: "to be",
            verbTranslation: "to be (age, time, quantities)",
            examples: [
              { object: "twenty years old", fullPhrase: "I am twenty years old.", translation: "I am twenty years old." },
              { object: "three o'clock", fullPhrase: "It is three o'clock.", translation: "It is three o'clock." },
              { object: "five people", fullPhrase: "There are five people.", translation: "There are five people." },
              { object: "ten dollars", fullPhrase: "That is ten dollars.", translation: "That is ten dollars." },
              { object: "half past two", fullPhrase: "It is half past two.", translation: "It is 2:30." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "English family vocabulary is compact: one word, 'aunt', covers both parents' sisters. In this chapter, you'll learn the core terms — parents, siblings, grandparents, and in-laws — and how English handles extended family relationships.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "English family terms are relatively straightforward: 'father', 'mother', 'brother', 'sister', 'son', 'daughter'. Modern English has also embraced inclusive terms like 'partner', 'spouse', and 'guardian' to reflect diverse family structures across English-speaking societies.",
            tip: "English doesn't distinguish between maternal and paternal relatives \u2014 'grandmother' covers both sides. You add 'on my mom's side' or 'on my dad's side' for clarity."
          },
          {
            title: "Extended Family",
            content: "Extended family terms include 'uncle', 'aunt', 'cousin', 'nephew', 'niece'. English uses compound terms for in-laws: 'mother-in-law', 'father-in-law', 'sister-in-law'. Step-family relationships add the prefix 'step-': 'stepmother', 'stepbrother'."
          }
        ],
        culturalSpotlight: {
          title: "Thanksgiving Gathering",
          content: "In the United States, Thanksgiving is the quintessential family gathering. On the fourth Thursday of November, families come together from across the country to share a meal of turkey, stuffing, and pie. It's a time for gratitude, storytelling, and reconnecting \u2014 often the only time extended families are all in one place."
        },
        vocabQA: [
          { question: "Do you have brothers or sisters?",        answer: "Yes, I have one brother and one sister.", word: "siblings",        translation: "brothers and sisters"       },
          { question: "Who is this?",                            answer: "This is my father.",                      word: "this is",         translation: "introducing a person"       },
          { question: "What is your mother's name?",             answer: "Her name is Sarah.",                      word: "her name is",     translation: "introducing others by name" },
          { question: "How many people are in your family?",     answer: "There are five of us.",                   word: "there are",       translation: "counting family members"    },
          { question: "Where do your parents live?",             answer: "My parents live in Chicago.",             word: "live in",         translation: "giving a location"          }
        ],
        verbGroups: [
          {
            verb: "to be",
            verbTranslation: "identity",
            examples: [
              { object: "my father",      fullPhrase: "He is my father.",       translation: "basic family introduction"   },
              { object: "my mother",      fullPhrase: "She is my mother.",      translation: "basic family introduction"   },
              { object: "my brother",     fullPhrase: "He is my brother.",      translation: "basic family introduction"   },
              { object: "my sister",      fullPhrase: "She is my sister.",      translation: "basic family introduction"   },
              { object: "my grandparents", fullPhrase: "They are my grandparents.", translation: "plural family introduction" }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "This chapter covers the English words and phrases learners use most: courtesy expressions, asking for help, telling time, and the everyday vocabulary for shops, transportation, and common situations.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "'Good morning!' starts the day, 'Good afternoon!' covers the post-lunch hours, and 'Good evening!' welcomes the night. For casual encounters, 'Hi!', 'Hey!', or even 'What's up?' work perfectly. When leaving, 'See you later!' or 'Take care!' are warm and friendly.",
            infographic: 'sunArcGreetings',
            tip: "'What's up?' doesn't really expect a detailed answer \u2014 'Not much, you?' is the classic response!"
          },
          {
            title: "Essential Courtesy",
            content: "'Please' and 'Thank you' are the magic words of English. Add 'Excuse me' for getting attention, 'Sorry' for minor bumps, and 'You're welcome' (or the casual 'No problem!') and you'll sail through any social situation.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Core daily vocabulary: 'today', 'tomorrow', 'yesterday', 'yes', 'no', 'maybe', 'morning', 'evening'. English also loves contractions: 'I'm' (I am), 'don't' (do not), 'can't' (cannot) \u2014 these make speech flow naturally.",
            tip: "English speakers often soften statements with 'just' and 'actually': 'I just wanted to ask...' sounds much friendlier than 'I want to ask...'"
          }
        ],
        culturalSpotlight: {
          title: "The Tea Break (UK) & Coffee Run (US)",
          content: "In Britain, the daily 'tea break' is sacred \u2014 offices pause for a cuppa and a biscuit, and offering to 'put the kettle on' is an act of kindness. In America, the 'coffee run' serves a similar social function, with colleagues bonding over complicated Starbucks orders. Both rituals turn a simple beverage into a moment of daily connection."
        },
        vocabQA: [
          { question: "How are you today?", answer: "I'm doing well, thank you.", answerTranslation: "Standard polite response." },
          { question: "What time is it?", answer: "It's ten o'clock in the morning.", answerTranslation: "Telling the time." },
          { question: "What day is today?", answer: "Today is Monday.", answerTranslation: "The day of the week." },
          { question: "What do you usually do in the morning?", answer: "I wake up at seven and have coffee.", answerTranslation: "Describing a morning routine." },
          { question: "Do you have time?", answer: "Yes, I have a minute.", answerTranslation: "Saying you're available." }
        ],
        verbGroups: [
          {
            verb: "to do",
            verbTranslation: "to do (the all-purpose verb for activities, tasks, and chores)",
            examples: [
              { object: "my homework", fullPhrase: "I do my homework in the evening.", translation: "Tasks are 'done', not 'made'." },
              { object: "exercise", fullPhrase: "She does yoga every morning.", translation: "Physical activities use 'do'." },
              { object: "the laundry", fullPhrase: "He does the laundry on Sundays.", translation: "Household chores use 'do'." },
              { object: "the shopping", fullPhrase: "We do the shopping on Saturdays.", translation: "Errands use 'do'." },
              { object: "my best", fullPhrase: "I always do my best.", translation: "Effort expressions use 'do'." }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "Welcome to class! As an English language learner, navigating the classroom is itself a language skill. This chapter gives you the phrases to ask for help clearly, understand your teacher's instructions, and build the habits of a confident, engaged language learner.",
        narrativeSections: [
          {
            title: "Asking When You Don't Know",
            content: "'Could you repeat that, please?', 'Could you speak more slowly?', and 'How do you say ... in English?' are the three most useful phrases in any English classroom. English-speaking teachers are generally very encouraging of questions — asking is a sign of engagement, not weakness.",
            tip: "Saying 'I'm sorry, I didn't catch that' sounds more natural than 'I don't understand' in most English-speaking classrooms — it's polite and specific."
          },
          {
            title: "Following Instructions",
            content: "Common classroom instructions include: 'Listen carefully', 'Repeat after me', 'Read the passage', 'Write it down', 'Open your books to page...', 'Work in pairs'. Being able to respond to these immediately makes every lesson more productive.",
            tip: "'Could you write that on the board?' is a very natural request — English teachers often respond well to students who take the initiative to ask."
          },
          {
            title: "Checking Your Understanding",
            content: "'Is that right?', 'What does ... mean?', 'I'm not sure I understand', and 'Could you give an example?' are clear, polite ways to check your understanding. Don't wait until you're completely lost — these phrases work best used early.",
            tip: "'So, just to check — do you mean...?' is a great phrase for confirming your interpretation of something. It shows you're thinking actively, not just nodding along."
          }
        ],
        culturalSpotlight: {
          title: "The Open Classroom Culture",
          content: "English-language classrooms — particularly in the US, UK, Canada, and Australia — tend to prize participation, questioning, and creative thinking. There's no shame in being wrong; in fact, 'making mistakes is part of learning' is something English teachers say (and mean) constantly. Contributions are encouraged, debates are welcomed, and students who ask thoughtful questions are considered the most engaged in the room. This culture of open participation can feel quite different from more formal educational traditions — but embracing it will accelerate your learning enormously."
        },
        vocabQA: [
          { question: "Could you repeat that, please?", answer: "Of course, no problem!", answerTranslation: "" },
          { question: "How do you say 'bonjour' in English?", answer: "You say 'good morning' or 'hello'.", answerTranslation: "" },
          { question: "Do you understand?", answer: "Not quite yet.", answerTranslation: "" },
          { question: "Is that correct?", answer: "Yes, that's right!", answerTranslation: "" },
          { question: "What does this word mean?", answer: "It means 'tomorrow'.", answerTranslation: "" }
        ],
        verbGroups: [
          {
            verb: "to understand",
            verbTranslation: "core classroom verb (I understand / do you understand? / I don't understand)",
            examples: [
              { object: "the question", fullPhrase: "I understand the question.", translation: "" },
              { object: "a little", fullPhrase: "I understand a little.", translation: "" },
              { object: "nothing", fullPhrase: "I don't understand anything.", translation: "" },
              { object: "now", fullPhrase: "Oh, now I understand!", translation: "" },
              { object: "everything", fullPhrase: "Do you understand everything?", translation: "" }
            ]
          }
        ]
      }
    }
  },

  hebrew: {
    greetings: {
      morning: "\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1",
      afternoon: "\u05e6\u05d4\u05e8\u05d9\u05d9\u05dd \u05d8\u05d5\u05d1\u05d9\u05dd",
      evening: "\u05e2\u05e8\u05d1 \u05d8\u05d5\u05d1"
    },
    formalInformal: [
      { formal: "\u05de\u05d4 \u05e9\u05dc\u05d5\u05de\u05da?", informal: "\u05de\u05d4 \u05e0\u05e9\u05de\u05e2?", context: "How are you?" },
      { formal: "\u05e0\u05e2\u05d9\u05dd \u05dc\u05d4\u05db\u05d9\u05e8", informal: "\u05e0\u05e2\u05d9\u05dd \u05de\u05d0\u05d5\u05d3!", context: "Nice to meet you" },
      { formal: "\u05e1\u05dc\u05d9\u05d7\u05d4", informal: "\u05e1\u05dc\u05d9\u05d7\u05d4", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "\u05e9\u05dc\u05d5\u05dd", meaning: "Hello" },
      { phrase: "\u05dc\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea", meaning: "Goodbye" },
      { phrase: "\u05d1\u05d1\u05e7\u05e9\u05d4", meaning: "Please" },
      { phrase: "\u05ea\u05d5\u05d3\u05d4", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "In this chapter, you'll learn the Hebrew greetings used every day — שלום (Shalom) for hello and goodbye, בוקר טוב (Boker Tov) for good morning, ערב טוב (Erev Tov) for good evening — plus the formal and informal ways to address someone.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "The most iconic Hebrew greeting is '\u05e9\u05dc\u05d5\u05dd' (Shalom), meaning peace. It works as hello, goodbye, and a blessing all in one. Israelis are known for their directness and warmth \u2014 greetings are enthusiastic, often accompanied by handshakes, hugs, or even two-cheek kisses among friends.",
            infographic: 'sunArcGreetings',
            tip: "'\u05e9\u05dc\u05d5\u05dd' is more than a greeting \u2014 it's a wish for peace. Using it shows respect for one of Hebrew's most profound concepts."
          },
          {
            title: "Time Matters",
            content: "'\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1' (boker tov) greets the morning, '\u05e6\u05d4\u05e8\u05d9\u05d9\u05dd \u05d8\u05d5\u05d1\u05d9\u05dd' (tsohorayim tovim) covers afternoon, and '\u05e2\u05e8\u05d1 \u05d8\u05d5\u05d1' (erev tov) welcomes the evening. '\u05dc\u05d9\u05dc\u05d4 \u05d8\u05d5\u05d1' (laila tov) is for bedtime only. But '\u05e9\u05dc\u05d5\u05dd' transcends all times.",
            tip: "Israelis love the playful response '\u05d1\u05d5\u05e7\u05e8 \u05d0\u05d5\u05e8' (boker or \u2014 morning light!) when you say '\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1'. It adds warmth and humor."
          },
          {
            title: "Formal vs. Informal",
            content: "Modern Hebrew is remarkably informal compared to many languages. There's no equivalent of 'vous' or 'usted' \u2014 everyone uses '\u05d0\u05ea\u05d4' (ata, masculine) or '\u05d0\u05ea' (at, feminine) for 'you'. Formality is expressed through word choice and tone rather than pronouns.",
            infographic: 'formalInformal',
            tip: "Hebrew verbs and adjectives change based on the gender of the person you're addressing \u2014 this is one of the first things to master!",
            discoveryNote: "Hebrew skipped the formal-pronoun system entirely \u2014 there's no vous, usted, or Sie. Instead, every Hebrew verb and adjective changes based on the gender of the person being addressed: '\u05d0\u05ea\u05d4 \u05de\u05d3\u05d1\u05e8' (ata medaber \u2014 you speak, m.) vs. '\u05d0\u05ea \u05de\u05d3\u05d1\u05e8\u05ea' (at medaberet \u2014 you speak, f.). Hebrew encodes who you're talking TO in the verb itself, not what level of respect you're showing them."
          }
        ],
        conversationStrips: [
          {
            title: "\u05e9\u05dc\u05d5\u05dd \u05e4\u05e9\u05d5\u05d8",
            context: "\u05e0\u05d5\u05e2\u05dd \u05e4\u05d5\u05d2\u05e9 \u05d0\u05ea \u05d9\u05e2\u05dc \u05d1\u05e9\u05db\u05d5\u05e0\u05d4",
            panels: [
              { speaker: "\u05e0\u05d5\u05e2\u05dd", gender: "male", text: "\u05e9\u05dc\u05d5\u05dd, \u05d9\u05e2\u05dc!", romanization: "Shalom, Yael!", translation: "Hello, Yael!" },
              { speaker: "\u05d9\u05e2\u05dc", gender: "female", text: "\u05e9\u05dc\u05d5\u05dd, \u05e0\u05d5\u05e2\u05dd! \u05de\u05d4 \u05e0\u05e9\u05de\u05e2?", romanization: "Shalom, Noam! Ma nishma?", translation: "Hello, Noam! What's up?" },
              { speaker: "\u05e0\u05d5\u05e2\u05dd", gender: "male", text: "\u05d4\u05db\u05dc \u05d8\u05d5\u05d1, \u05ea\u05d5\u05d3\u05d4! \u05d5\u05d0\u05ea?", romanization: "Hakol tov, toda! Ve'at?", translation: "Everything's good, thanks! And you?" },
              { speaker: "\u05d9\u05e2\u05dc", gender: "female", text: "\u05d2\u05dd \u05d0\u05e0\u05d9 \u05d1\u05e1\u05d3\u05e8! \u05dc\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea!", romanization: "Gam ani beseder! Lehitraot!", translation: "I'm fine too! See you!" }
            ]
          },
          {
            title: "\u05e0\u05e2\u05d9\u05dd \u05dc\u05d4\u05db\u05d9\u05e8",
            context: "\u05e0\u05d5\u05e2\u05dd \u05de\u05ea\u05e0\u05d9\u05d4 \u05dc\u05d9\u05e2\u05dc \u05d1\u05e4\u05e2\u05dd \u05d4\u05e8\u05d0\u05e9\u05d5\u05e0\u05d4",
            panels: [
              { speaker: "\u05e0\u05d5\u05e2\u05dd", gender: "male", text: "\u05e9\u05dc\u05d5\u05dd, \u05e7\u05d5\u05e8\u05d0\u05d9\u05dd \u05dc\u05d9 \u05e0\u05d5\u05e2\u05dd.", romanization: "Shalom, kor'im li Noam.", translation: "Hello, my name is Noam." },
              { speaker: "\u05d9\u05e2\u05dc", gender: "female", text: "\u05e0\u05e2\u05d9\u05dd \u05de\u05d0\u05d5\u05d3, \u05e0\u05d5\u05e2\u05dd. \u05d0\u05e0\u05d9 \u05d9\u05e2\u05dc.", romanization: "Na'im me'od, Noam. Ani Yael.", translation: "Very pleased to meet you, Noam. I'm Yael." },
              { speaker: "\u05e0\u05d5\u05e2\u05dd", gender: "male", text: "\u05e0\u05e2\u05d9\u05dd \u05de\u05d0\u05d5\u05d3, \u05d9\u05e2\u05dc.", romanization: "Na'im me'od, Yael.", translation: "Very pleased to meet you, Yael." }
            ]
          },
          {
            title: "\u05db\u05d1\u05d5\u05d3 \u05dc\u05e1\u05d1\u05ea\u05d0",
            context: "\u05e0\u05d5\u05e2\u05dd \u05de\u05d1\u05e7\u05e8 \u05d0\u05ea \u05e1\u05d1\u05ea\u05d0 \u05e9\u05dc\u05d5 \u05d1\u05d7\u05d9\u05d1\u05d4",
            panels: [
              { speaker: "\u05e0\u05d5\u05e2\u05dd", gender: "male", text: "\u05e9\u05dc\u05d5\u05dd, \u05e1\u05d1\u05ea\u05d0! \u05de\u05d4 \u05e9\u05dc\u05d5\u05de\u05da?", romanization: "Shalom, savta! Ma shlomech?", translation: "Hello, Grandma! How are you?", note: "\u05d1\u05e2\u05d1\u05e8\u05d9\u05ea \u05d0\u05d9\u05df \u05db\u05d9\u05e0\u05d5\u05d9 \u05db\u05d1\u05d5\u05d3 \u05de\u05d9\u05d5\u05d7\u05d3 \u2014 \u05d4\u05db\u05d1\u05d5\u05d3 \u05d1\u05d0 \u05d1\u05d7\u05d5\u05dd \u05d5\u05d1\u05de\u05d9\u05dc\u05d9\u05dd \u05e2\u05e6\u05de\u05df" },
              { speaker: "\u05e1\u05d1\u05ea\u05d0", gender: "female", text: "\u05e9\u05dc\u05d5\u05dd, \u05e0\u05d5\u05e2\u05de\u05d9\u05e7\u05d9! \u05d0\u05e0\u05d9 \u05d1\u05e1\u05d3\u05e8 \u05d2\u05de\u05d5\u05e8, \u05ea\u05d5\u05d3\u05d4.", romanization: "Shalom, Noa'miki! Ani beseder gamur, toda.", translation: "Hello, my dear Noam! I'm perfectly fine, thanks.", note: "\u05d4\u05e1\u05d1\u05ea\u05d0 \u05de\u05d1\u05d8\u05d0\u05ea \u05d7\u05d9\u05d1\u05d4 \u05d1\u05de\u05d9\u05dc\u05d9\u05dd \u05d7\u05de\u05d9\u05dd" },
              { speaker: "\u05e0\u05d5\u05e2\u05dd", gender: "male", text: "\u05e9\u05de\u05d7\u05ea\u05d9 \u05dc\u05e9\u05de\u05d5\u05e2, \u05e1\u05d1\u05ea\u05d0.", romanization: "Samachti lishmo'a, savta.", translation: "I'm glad to hear that, Grandma." }
            ]
          }
        ],
        culturalSpotlight: {
          title: "\u05e9\u05d1\u05ea \u05e9\u05dc\u05d5\u05dd (Shabbat Shalom)",
          content: "Every Friday evening, Israelis greet each other with '\u05e9\u05d1\u05ea \u05e9\u05dc\u05d5\u05dd' (Shabbat Shalom) as the Sabbath begins. Whether religious or secular, most Israelis mark Shabbat with a family dinner, candle lighting, and special challah bread. It's a weekly pause button that brings families and communities together in a shared rhythm of rest."
        },
        genderPairs: [
          { masculine: "שמח",   feminine: "שמחה",   translation: "happy" },
          { masculine: "עייף",   feminine: "עייפה",   translation: "tired" },
          { masculine: "עסוק",   feminine: "עסוקה",   translation: "busy" },
          { masculine: "חולה",   feminine: "חולה",   translation: "sick — same form for both!" },
          { masculine: "עצבני", feminine: "עצבנית", translation: "nervous" }
        ],
        vocabQA: [
          { question: "מה שמך？", answer: "שמי [שם]ע.", word: "שמך", translation: "Your name? (Ma shimkha?)" },
          { question: "מה שלומך？", answer: "בסדר, תודה. ואתה？", word: "שלום", translation: "How are you? (Ma shlomkha?)" },
          { question: "נעים מאוד.", answer: "גם לי.", word: "נעים", translation: "Pleasant / Nice to meet you (Na’im me’od)" },
          { question: "מאיפה אתה？", answer: "אני מ[עיר].", word: "מאיפה", translation: "Where are you from? (Me’eifo atah?)" },
          { question: "מה נשמע？", answer: "הכל טוב, תודה.", word: "נשמע", translation: "What’s up? (Ma nishma?)" }
        ],
        verbGroups: [
          {
            verb: "להיות (lihyot)",
            verbTranslation: "to be — vanishes in present tense",
            verbHint: "In Hebrew present tense, ‘to be’ disappears entirely. Subject and predicate stand side by side with no verb between them.",
            examples: [
              { object: "בסדר (beseder)", fullPhrase: "אני בסדר.", translation: "I [am] fine." },
              { object: "שמח (sameakh)", fullPhrase: "אני שמח.", translation: "I [am] happy. (m.)" },
              { object: "ישראלי (yisraeli)", fullPhrase: "אני ישראלי.", translation: "I [am] Israeli. (m.)" },
              { object: "טוב (tov)", fullPhrase: "אני טוב.", translation: "I [am] good. (m.)" },
              { object: "עייף (ayef)", fullPhrase: "אני עייף.", translation: "I [am] tired. (m.)" }
            ]
          }
        ],
        cognateOpener: [
          { native: "\u05d8\u05dc\u05e4\u05d5\u05df (telefon)",      english: "telephone",                                    category: "technology"    },
          { native: "\u05d8\u05dc\u05d5\u05d5\u05d9\u05d6\u05d9\u05d4 (televizya)",  english: "television",                                   category: "technology"    },
          { native: "\u05e7\u05e4\u05d4 (kafe)",           english: "coffee / caf\u00e9",                              category: "food"          },
          { native: "\u05e4\u05d9\u05e6\u05d4 (pitza)",         english: "pizza",                                        category: "food"          },
          { native: "\u05e1\u05dc\u05d8 (salat)",           english: "salad",                                        category: "food"          },
          { native: "\u05d1\u05e0\u05e7 (bank)",            english: "bank",                                         category: "place"         },
          { native: "\u05d0\u05d5\u05d8\u05d5\u05d1\u05d5\u05e1 (otobus)",      english: "bus",                                          category: "transport"     },
          { native: "\u05e1\u05e4\u05d5\u05e8\u05d8 (sport)",         english: "sport",                                        category: "concept"       },
          { native: "\u05de\u05d5\u05d6\u05d9\u05e7\u05d4 (muzika)",      english: "music",                                        category: "concept"       },
          { native: "\u05e7\u05d5\u05de\u05e4\u05d9\u05d5\u05d8\u05e8 (kompiutor)",  english: "computer",                                     category: "technology"    },
          { native: "\u05d0\u05d9\u05e0\u05d8\u05e8\u05e0\u05d8 (internet)",   english: "internet",                                     category: "technology"    },
          { native: "\u05e9\u05d5\u05e7\u05d5\u05dc\u05d3 (shokolad)",   english: "chocolate",                                    category: "food"          },
          { native: "\u05d2\u05d9\u05d8\u05e8\u05d4 (gitara)",       english: "guitar",                                       category: "concept"       },
          { native: "\u05e4\u05e1\u05d8\u05d4 (pasta)",          english: "pasta",                                        category: "food"          },
          { native: "\u05e4\u05d9\u05d0\u05e0\u05d5 (pyano)",         english: "piano",                                        category: "concept"       },
          { native: "\u05e8\u05d3\u05d9\u05d5 (radyo)",           english: "radio",                                        category: "technology"    }
        ]
      },
      numbers: {
        welcomeText: "Hebrew numbers have gendered forms — you use different words depending on whether you're counting masculine or feminine nouns. This chapter covers 1 to 1,000 in modern Hebrew, including which form to use and how numbers appear in dates and prices.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "Hebrew numbers have masculine and feminine forms that match the noun being counted. '\u05d0\u05d7\u05d3' (echad) is masculine 'one', '\u05d0\u05d7\u05ea' (achat) is feminine 'one'. This gender agreement continues through the numbers. The system follows a logical pattern once you learn the basics: '\u05d0\u05d7\u05d3, \u05e9\u05e0\u05d9\u05d9\u05dd, \u05e9\u05dc\u05d5\u05e9\u05d4, \u05d0\u05e8\u05d1\u05e2\u05d4, \u05d7\u05de\u05e9\u05d4'.",
            tip: "Hebrew numbers have gender! The masculine and feminine forms are almost opposite to what you'd expect \u2014 for numbers 3-10, the masculine forms end in '\u05d4-' while the feminine forms end in consonants — the opposite of noun patterns."
          },
          {
            title: "Numbers in Daily Life",
            content: "Numbers are everywhere in Israeli daily life: reading shekel (\u20aa) prices, understanding bus routes, and giving phone numbers. Practice with '\u05db\u05de\u05d4 \u05d6\u05d4 \u05e2\u05d5\u05dc\u05d4?' (kama ze oleh? \u2014 How much does this cost?) to get comfortable with numbers in real conversations.",
            tip: "Israeli phone numbers start with '05' for mobile. When sharing numbers, Israelis often say each digit separately for clarity."
          }
        ],
        culturalSpotlight: {
          title: "\u05d2\u05d9\u05de\u05d8\u05e8\u05d9\u05d4 (Gematria)",
          content: "Hebrew has an ancient tradition called 'gematria' where each letter has a numerical value (\u05d0=1, \u05d1=2, \u05d2=3...). Words with the same numerical value are considered mystically connected. The number 18 is especially significant because it spells '\u05d7\u05d9' (chai \u2014 life), making it the luckiest number in Jewish culture. Gifts are often given in multiples of 18."
        },
        vocabQA: [
          { question: "\u05d1\u05df/\u05d1\u05ea \u05db\u05de\u05d4 \u05d0\u05ea\u05d4/\u05d0\u05ea?", answer: "\u05d0\u05e0\u05d9 \u05d1\u05df/\u05d1\u05ea \u05e2\u05e9\u05e8\u05d9\u05dd \u05d5\u05d7\u05de\u05e9.", answerTranslation: "I am twenty-five years old." },
          { question: "\u05db\u05de\u05d4 \u05d6\u05d4 \u05e2\u05d5\u05dc\u05d4?", answer: "\u05d6\u05d4 \u05e2\u05d5\u05dc\u05d4 \u05e2\u05e9\u05e8\u05d4 \u05e9\u05e7\u05dc\u05d9\u05dd.", answerTranslation: "It costs ten shekels." },
          { question: "\u05de\u05d4 \u05d4\u05e9\u05e2\u05d4?", answer: "\u05d4\u05e9\u05e2\u05d4 \u05e9\u05dc\u05d5\u05e9.", answerTranslation: "It is three o'clock." },
          { question: "\u05db\u05de\u05d4 \u05d0\u05e0\u05e9\u05d9\u05dd \u05d9\u05e9?", answer: "\u05d9\u05e9 \u05d7\u05de\u05d9\u05e9\u05d4 \u05d0\u05e0\u05e9\u05d9\u05dd.", answerTranslation: "There are five people." },
          { question: "\u05de\u05d4 \u05de\u05e1\u05e4\u05e8 \u05d4\u05d8\u05dc\u05e4\u05d5\u05df \u05e9\u05dc\u05da?", answer: "\u05d4\u05de\u05e1\u05e4\u05e8 \u05e9\u05dc\u05d9 \u05d4\u05d5\u05d0 050-123-4567.", answerTranslation: "My number is 050-123-4567." }
        ],
        verbGroups: [
          {
            verb: "\u05d9\u05e9 / \u05d0\u05d9\u05df",
            verbTranslation: "there is / there isn't — also used for possession (yesh li = I have)",
            examples: [
              { object: "\u05d7\u05de\u05d9\u05e9\u05d4 \u05ea\u05e4\u05d5\u05d7\u05d9\u05dd", fullPhrase: "\u05d9\u05e9 \u05d7\u05de\u05d9\u05e9\u05d4 \u05ea\u05e4\u05d5\u05d7\u05d9\u05dd.", translation: "There are five apples." },
              { object: "\u05dc\u05d9 \u05d0\u05d7", fullPhrase: "\u05d9\u05e9 \u05dc\u05d9 \u05d0\u05d7.", translation: "I have a brother." },
              { object: "\u05d1\u05e2\u05d9\u05d4", fullPhrase: "\u05d0\u05d9\u05df \u05d1\u05e2\u05d9\u05d4.", translation: "There is no problem." },
              { object: "\u05dc\u05d9 \u05db\u05e1\u05e3", fullPhrase: "\u05d9\u05e9 \u05dc\u05d9 \u05db\u05e1\u05e3.", translation: "I have money." },
              { object: "\u05dc\u05d9 \u05d6\u05de\u05df", fullPhrase: "\u05d0\u05d9\u05df \u05dc\u05d9 \u05d6\u05de\u05df.", translation: "I don't have time." }
            ]
          }
        ]
      },
      family: {
        welcomeText: "In this chapter, you'll learn the Hebrew words for immediate and extended family — אבא (aba), אמא (ima), אח (ach), אחות (achot), סבא (saba), סבתא (savta) — plus the expressions used to introduce and talk about family members.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "Hebrew family vocabulary reflects close-knit bonds: '\u05d0\u05d1\u05d0' (aba \u2014 dad), '\u05d0\u05de\u05d0' (ima \u2014 mom), '\u05d0\u05d7' (ach \u2014 brother), '\u05d0\u05d7\u05d5\u05ea' (achot \u2014 sister). Israeli families are known for their closeness \u2014 adult children visit parents weekly, and grandparents play an active role in child-rearing.",
            tip: "'\u05d0\u05d1\u05d0' and '\u05d0\u05de\u05d0' are used by almost all Hebrew speakers regardless of age \u2014 even adults call their parents by these affectionate names."
          },
          {
            title: "Extended Family",
            content: "Hebrew has specific terms: '\u05d3\u05d5\u05d3' (dod \u2014 uncle), '\u05d3\u05d5\u05d3\u05d4' (doda \u2014 aunt), '\u05d1\u05df \u05d3\u05d5\u05d3/\u05d1\u05ea \u05d3\u05d5\u05d3' (ben dod/bat dod \u2014 cousin), '\u05e1\u05d1\u05d0' (saba \u2014 grandfather), '\u05e1\u05d1\u05ea\u05d0' (savta \u2014 grandmother). The words '\u05e1\u05d1\u05d0' and '\u05e1\u05d1\u05ea\u05d0' are among the most beloved words in Hebrew."
          }
        ],
        culturalSpotlight: {
          title: "\u05d0\u05e8\u05d5\u05d7\u05ea \u05e9\u05d1\u05ea (Aruchat Shabbat)",
          content: "The Friday night Shabbat dinner is the most important family meal of the week in Israeli culture. Multiple generations gather around a table set with candles, challah bread, and wine. Blessings are said, stories are shared, and the week's stress melts away. Whether religious or secular, this weekly family reunion is a pillar of Israeli life."
        },
        genderFrame: { masculine: "\u05d4\u05d5\u05d0 ___ \u05e9\u05dc\u05d9.", feminine: "\u05d4\u05d9\u05d0 ___ \u05e9\u05dc\u05d9." },
        genderPairs: [
          { masculine: "\u05d0\u05d1\u05d0 \u05e9\u05dc\u05d9",       feminine: "\u05d0\u05de\u05d0 \u05e9\u05dc\u05d9",      translation: "my father / my mother"           },
          { masculine: "\u05d0\u05d7 \u05e9\u05dc\u05d9",        feminine: "\u05d0\u05d7\u05d5\u05ea \u05e9\u05dc\u05d9",    translation: "my brother / my sister"          },
          { masculine: "\u05e1\u05d1\u05d0 \u05e9\u05dc\u05d9",       feminine: "\u05e1\u05d1\u05ea\u05d0 \u05e9\u05dc\u05d9",    translation: "my grandfather / my grandmother" },
          { masculine: "\u05d3\u05d5\u05d3 \u05e9\u05dc\u05d9",       feminine: "\u05d3\u05d5\u05d3\u05d4 \u05e9\u05dc\u05d9",    translation: "my uncle / my aunt"              },
          { masculine: "\u05d1\u05df \u05d3\u05d5\u05d3 \u05e9\u05dc\u05d9",  feminine: "\u05d1\u05ea \u05d3\u05d5\u05d3 \u05e9\u05dc\u05d9", translation: "my (male) / my (female) cousin"  }
        ],
        vocabQA: [
          { question: "\u05d9\u05e9 \u05dc\u05da \u05d0\u05d7\u05d9\u05dd \u05d0\u05d5 \u05d0\u05d7\u05d9\u05d5\u05ea?",    answer: "\u05db\u05df, \u05d9\u05e9 \u05dc\u05d9 \u05d0\u05d7 \u05d5\u05d0\u05d7\u05d5\u05ea.",         word: "\u05d0\u05d7\u05d9\u05dd (akhim)",     translation: "brothers / siblings" },
          { question: "\u05de\u05d9 \u05d6\u05d4?",                              answer: "\u05d6\u05d4 \u05d0\u05d1\u05d0 \u05e9\u05dc\u05d9.",                word: "\u05de\u05d9 \u05d6\u05d4 (mi ze)",   translation: "who is this?"        },
          { question: "\u05de\u05d4 \u05e9\u05dd \u05d0\u05de\u05d0 \u05e9\u05dc\u05da?",         answer: "\u05e9\u05dd \u05d0\u05de\u05d0 \u05e9\u05dc\u05d9 \u05de\u05e8\u05d9\u05dd.",          word: "\u05e9\u05dd (shem)",         translation: "name"                },
          { question: "\u05db\u05de\u05d4 \u05d0\u05e0\u05e9\u05d9\u05dd \u05d1\u05de\u05e9\u05e4\u05d7\u05d4 \u05e9\u05dc\u05da?", answer: "\u05d0\u05e0\u05d7\u05e0\u05d5 \u05d7\u05de\u05d9\u05e9\u05d4 \u05d1\u05de\u05e9\u05e4\u05d7\u05d4.",   word: "\u05db\u05de\u05d4 (kama)",     translation: "how many?"           },
          { question: "\u05d0\u05d9\u05e4\u05d4 \u05d2\u05e8\u05d9\u05dd \u05d4\u05d4\u05d5\u05e8\u05d9\u05dd \u05e9\u05dc\u05da?",  answer: "\u05d4\u05d4\u05d5\u05e8\u05d9\u05dd \u05e9\u05dc\u05d9 \u05d2\u05e8\u05d9\u05dd \u05d1\u05ea\u05dc \u05d0\u05d1\u05d9\u05d1.", word: "\u05d2\u05e8\u05d9\u05dd (garim)",    translation: "live / reside"       }
        ],
        verbGroups: [
          {
            verb: "\u2014 (zero copula)",
            verbTranslation: "to be (present tense \u2014 no verb written)",
            verbHint: "Hebrew present-tense \u201cto be\u201d is silent \u2014 subject and predicate stand side by side. \u05d6\u05d4 \u05d0\u05d1\u05d0 \u05e9\u05dc\u05d9 means \u201cThis is my father\u201d with no verb at all.",
            examples: [
              { object: "\u05d0\u05d1\u05d0 \u05e9\u05dc\u05d9 (aba sheli)",    fullPhrase: "\u05d4\u05d5\u05d0 \u05d0\u05d1\u05d0 \u05e9\u05dc\u05d9.",   translation: "He is my father."       },
              { object: "\u05d0\u05de\u05d0 \u05e9\u05dc\u05d9 (ima sheli)",    fullPhrase: "\u05d4\u05d9\u05d0 \u05d0\u05de\u05d0 \u05e9\u05dc\u05d9.",   translation: "She is my mother."      },
              { object: "\u05d0\u05d7 \u05e9\u05dc\u05d9 (akh sheli)",      fullPhrase: "\u05d4\u05d5\u05d0 \u05d0\u05d7 \u05e9\u05dc\u05d9.",    translation: "He is my brother."      },
              { object: "\u05d0\u05d7\u05d5\u05ea \u05e9\u05dc\u05d9 (akhot sheli)", fullPhrase: "\u05d4\u05d9\u05d0 \u05d0\u05d7\u05d5\u05ea \u05e9\u05dc\u05d9.", translation: "She is my sister."    },
              { object: "\u05e1\u05d1\u05d0 \u05e9\u05dc\u05d9 (saba sheli)",   fullPhrase: "\u05d4\u05d5\u05d0 \u05e1\u05d1\u05d0 \u05e9\u05dc\u05d9.",  translation: "He is my grandfather."  }
            ]
          }
        ]
      },
      daily: {
        welcomeText: "This chapter covers the Hebrew vocabulary for everyday life: greetings by time of day, courtesy words, and the expressions you'll hear and use at Israeli markets, coffee shops, and workplaces.",
        narrativeSections: [
          {
            title: "Greetings Throughout the Day",
            content: "'\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1' (boker tov) starts your morning, '\u05e9\u05dc\u05d5\u05dd' (shalom) works all day, and '\u05e2\u05e8\u05d1 \u05d8\u05d5\u05d1' (erev tov) welcomes the evening. The casual '\u05d0\u05d4\u05dc\u05df' (ahalan) borrowed from Arabic is incredibly common and friendly.",
            infographic: 'sunArcGreetings',
            tip: "'\u05d0\u05d4\u05dc\u05df' (ahalan) is one of several Arabic loanwords in casual Hebrew \u2014 it reflects the multicultural reality of Israeli life."
          },
          {
            title: "Essential Courtesy",
            content: "'\u05d1\u05d1\u05e7\u05e9\u05d4' (bevakasha \u2014 please/you're welcome), '\u05ea\u05d5\u05d3\u05d4' (toda \u2014 thank you), and '\u05e1\u05dc\u05d9\u05d7\u05d4' (slicha \u2014 excuse me/sorry) are your daily essentials. '\u05ea\u05d5\u05d3\u05d4 \u05e8\u05d1\u05d4' (toda raba \u2014 thank you very much) adds extra warmth.",
            infographic: 'quickPhrases'
          },
          {
            title: "Simple Daily Words",
            content: "Build your daily Hebrew: '\u05d4\u05d9\u05d5\u05dd' (hayom \u2014 today), '\u05de\u05d7\u05e8' (machar \u2014 tomorrow), '\u05d0\u05ea\u05de\u05d5\u05dc' (etmol \u2014 yesterday), '\u05db\u05df' (ken \u2014 yes), '\u05dc\u05d0' (lo \u2014 no). These words form the backbone of everyday Hebrew conversation.",
            tip: "'\u05d1\u05d1\u05e7\u05e9\u05d4' does triple duty in Hebrew \u2014 it means 'please', 'you're welcome', and 'go ahead'!"
          }
        ],
        culturalSpotlight: {
          title: "\u05d4\u05e7\u05e4\u05d4 \u05d5\u05e2\u05d5\u05d2\u05d4 (HaKafe Ve'Uga)",
          content: "Israelis are passionate about their coffee culture. The daily ritual of '\u05e7\u05e4\u05d4 \u05d5\u05e2\u05d5\u05d2\u05d4' (coffee and cake) is a social anchor \u2014 whether it's Turkish coffee at a traditional caf\u00e9, iced coffee on Tel Aviv's beach promenade, or 'hafuch' (a latte) at a neighborhood spot. For Israelis, coffee isn't a beverage \u2014 it's a reason to connect."
        },
        vocabQA: [
          { question: "\u05de\u05d4 \u05e9\u05dc\u05d5\u05de\u05da \u05d4\u05d9\u05d5\u05dd?", answer: "\u05d0\u05e0\u05d9 \u05d1\u05e1\u05d3\u05e8, \u05ea\u05d5\u05d3\u05d4.", answerTranslation: "I'm fine, thank you." },
          { question: "\u05de\u05d4 \u05d4\u05e9\u05e2\u05d4 \u05e2\u05db\u05e9\u05d9\u05d5?", answer: "\u05e2\u05e9\u05e8 \u05d1\u05d1\u05d5\u05e7\u05e8.", answerTranslation: "It's ten in the morning." },
          { question: "\u05de\u05d4 \u05d4\u05d9\u05d5\u05dd?", answer: "\u05d4\u05d9\u05d5\u05dd \u05d9\u05d5\u05dd \u05e9\u05e0\u05d9.", answerTranslation: "Today is Monday." },
          { question: "\u05de\u05d4 \u05d0\u05ea\u05d4 \u05e2\u05d5\u05e9\u05d4 \u05d1\u05d1\u05d5\u05e7\u05e8?", answer: "\u05d0\u05e0\u05d9 \u05e7\u05dd \u05d1\u05e9\u05d1\u05e2.", answerTranslation: "I get up at seven." },
          { question: "\u05d9\u05e9 \u05dc\u05da \u05d6\u05de\u05df?", answer: "\u05db\u05df, \u05d9\u05e9 \u05dc\u05d9 \u05e8\u05d2\u05e2.", answerTranslation: "Yes, I have a moment." }
        ],
        verbGroups: [
          {
            verb: "\u05dc\u05e2\u05e9\u05d5\u05ea",
            verbTranslation: "la'asot \u2014 to do (daily activities; root: \u05e2-\u05e9-\u05d4)",
            examples: [
              { object: "\u05e9\u05d9\u05e2\u05d5\u05e8\u05d9\u05dd", fullPhrase: "\u05d0\u05e0\u05d9 \u05e2\u05d5\u05e9\u05d4 \u05e9\u05d9\u05e2\u05d5\u05e8\u05d9\u05dd \u05d1\u05e2\u05e8\u05d1.", translation: "I do homework in the evening." },
              { object: "\u05e1\u05e4\u05d5\u05e8\u05d8", fullPhrase: "\u05d4\u05d9\u05d0 \u05e2\u05d5\u05e9\u05d4 \u05e1\u05e4\u05d5\u05e8\u05d8 \u05d1\u05d1\u05d5\u05e7\u05e8.", translation: "She exercises in the morning." },
              { object: "\u05e7\u05e0\u05d9\u05d5\u05ea", fullPhrase: "\u05d0\u05e0\u05d7\u05e0\u05d5 \u05e2\u05d5\u05e9\u05d9\u05dd \u05e7\u05e0\u05d9\u05d5\u05ea \u05d1\u05e1\u05d5\u05e3 \u05e9\u05d1\u05d5\u05e2.", translation: "We do shopping on the weekend." },
              { object: "\u05d0\u05e8\u05d5\u05d7\u05ea \u05d1\u05d5\u05e7\u05e8", fullPhrase: "\u05d4\u05d5\u05d0 \u05e2\u05d5\u05e9\u05d4 \u05d0\u05e8\u05d5\u05d7\u05ea \u05d1\u05d5\u05e7\u05e8.", translation: "He makes breakfast." },
              { object: "\u05ea\u05d5\u05db\u05e0\u05d9\u05d5\u05ea", fullPhrase: "\u05d0\u05ea\u05d4 \u05e2\u05d5\u05e9\u05d4 \u05ea\u05d5\u05db\u05e0\u05d9\u05d5\u05ea?", translation: "Are you making plans?" }
            ]
          }
        ]
      },
      classroom: {
        welcomeText: "ברוכים הבאים לכיתה! (Bruchim HaBaim LaKita — Welcome to class!) Hebrew classroom language has a directness and warmth that reflects Israeli culture. This chapter teaches you how to ask questions confidently, follow your teacher's instructions, and navigate the classroom in Hebrew.",
        narrativeSections: [
          {
            title: "לשאול בביטחון — Asking with Confidence",
            content: "'תוכל לחזור על זה?' (Tuchal lachazor al ze? — Can you repeat that?), 'יותר לאט, בבקשה' (Yoter le'at, bevakasha — More slowly, please), and '...איך אומרים בעברית?' (Eich omrim be'ivrit ... — How do you say ... in Hebrew?) are your most essential classroom phrases.",
            tip: "Israelis are direct and informal by nature — your teacher will likely appreciate 'לא הבנתי' (Lo hevanti — I didn't understand) said plainly, without over-apologizing."
          },
          {
            title: "הבנת הוראות — Understanding Instructions",
            content: "Listen for: 'תקשיבו' (Listen), 'חזרו אחריי' (Repeat after me), 'קראו' (Read), 'כתבו' (Write), 'פתחו את הספר' (Open the book), 'בזוגות' (In pairs). Hebrew instruction verbs are direct and easy to recognize once you've heard them a few times.",
            tip: "Hebrew verbs change form based on gender — your teacher may say 'כתוב' to a male student and 'כתבי' to a female student. Don't be surprised when instructions sound slightly different!"
          },
          {
            title: "בדיקת הבנה — Checking Understanding",
            content: "'זה נכון?' (Ze nachon? — Is that correct?), 'מה המשמעות של...?' (Ma haMashmaút shel ... — What is the meaning of ...?), 'אני לא מבין/מבינה' (Ani lo mevin/mevina — I don't understand), and 'אפשר דוגמה?' (Efshar dugma? — Could I have an example?) complete your toolkit.",
            tip: "'הבנתי!' (Hevanti — I got it!) is the natural, satisfying phrase to use when something clicks. Hebrew learners find that small moments of success, celebrated aloud, build real confidence."
          }
        ],
        culturalSpotlight: {
          title: "ישירות ישראלית (Israeli Directness)",
          content: "Israeli classroom culture is famously direct and informal — students call teachers by first name, debate ideas openly, and aren't shy about expressing confusion. This cultural trait, known as 'dugriut' (directness), means there's no social penalty for asking a question bluntly or disagreeing respectfully. For learners accustomed to more hierarchical classroom cultures, this can feel refreshingly open. Embrace it: in an Israeli Hebrew classroom, the student who asks the most questions is usually the one who learns the fastest."
        },
        vocabQA: [
          { question: "\u05ea\u05d5\u05db\u05dc \u05dc\u05d7\u05d6\u05d5\u05e8 \u05e2\u05dc \u05d6\u05d4, \u05d1\u05d1\u05e7\u05e9\u05d4?", answer: "\u05db\u05df, \u05d1\u05d5\u05d3\u05d0\u05d9.", answerTranslation: "Yes, of course." },
          { question: "\u05d0\u05d9\u05da \u05d0\u05d5\u05de\u05e8\u05d9\u05dd 'hello' \u05d1\u05e2\u05d1\u05e8\u05d9\u05ea?", answer: "\u05d0\u05d5\u05de\u05e8\u05d9\u05dd '\u05e9\u05dc\u05d5\u05dd'\u05d5\u05d0 '\u05d4\u05d9\u05d9'.", answerTranslation: "We say 'shalom' or 'hey'." },
          { question: "\u05d0\u05ea\u05d4 \u05de\u05d1\u05d9\u05df?", answer: "\u05e2\u05d3\u05d9\u05d9\u05df \u05dc\u05d0 \u05d4\u05d1\u05e0\u05ea\u05d9.", answerTranslation: "I don't understand yet." },
          { question: "\u05d6\u05d4 \u05e0\u05db\u05d5\u05df?", answer: "\u05db\u05df, \u05d6\u05d4 \u05e0\u05db\u05d5\u05df.", answerTranslation: "Yes, that's correct." },
          { question: "\u05de\u05d4 \u05d4\u05de\u05e9\u05de\u05e2\u05d5\u05ea \u05e9\u05dc \u05d4\u05de\u05d9\u05dc\u05d4 \u05d4\u05d6\u05d0\u05ea?", answer: "\u05d4\u05de\u05e9\u05de\u05e2\u05d5\u05ea \u05e9\u05dc\u05d4 \u05d4\u05d9\u05d0 '\u05de\u05d7\u05e8'.", answerTranslation: "Its meaning is 'tomorrow'." }
        ],
        verbGroups: [
          {
            verb: "\u05dc\u05d4\u05d1\u05d9\u05df",
            verbTranslation: "lehavin \u2014 to understand (root: \u05d1-\u05d9-\u05df; ani mevin/mevina; atem mevinim)",
            examples: [
              { object: "\u05d0\u05ea \u05d4\u05e9\u05d0\u05dc\u05d4", fullPhrase: "\u05d0\u05e0\u05d9 \u05de\u05d1\u05d9\u05df \u05d0\u05ea \u05d4\u05e9\u05d0\u05dc\u05d4.", translation: "I understand the question." },
              { object: "\u05e7\u05e6\u05ea", fullPhrase: "\u05d0\u05e0\u05d9 \u05de\u05d1\u05d9\u05df \u05e7\u05e6\u05ea.", translation: "I understand a little." },
              { object: "\u05dc\u05d0 \u05de\u05d1\u05d9\u05df", fullPhrase: "\u05d0\u05e0\u05d9 \u05dc\u05d0 \u05de\u05d1\u05d9\u05df.", translation: "I don't understand." },
              { object: "\u05e2\u05db\u05e9\u05d9\u05d5", fullPhrase: "\u05d0\u05d4\u05f2, \u05e2\u05db\u05e9\u05d9\u05d5 \u05d0\u05e0\u05d9 \u05de\u05d1\u05d9\u05df!", translation: "Ah, now I understand!" },
              { object: "\u05d4\u05db\u05dc", fullPhrase: "\u05d0\u05ea\u05d4 \u05de\u05d1\u05d9\u05df \u05d0\u05ea \u05d4\u05db\u05dc?", translation: "Do you understand everything?" }
            ]
          }
        ]
      }
    }
  }
};

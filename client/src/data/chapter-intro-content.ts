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

export interface ChapterIntroContent {
  welcomeText: string;
  narrativeSections: {
    title: string;
    content: string;
    tip?: string;
    infographic?: 'sunArcGreetings' | 'formalInformal' | 'quickPhrases';
  }[];
  culturalSpotlight?: {
    title: string;
    content: string;
  };
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
      { formal: "Con permiso", informal: "Oye", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "Hola", meaning: "Hello" },
      { phrase: "Adi\u00f3s", meaning: "Goodbye" },
      { phrase: "Por favor", meaning: "Please" },
      { phrase: "Gracias", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "Welcome to your Spanish journey! In this chapter, you'll learn the essential building blocks of Spanish conversation \u2014 greetings, introductions, and the art of making a great first impression. Spanish-speaking cultures treasure warmth and personal connection, and it all starts with how you say hello.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "In Spanish-speaking cultures, greetings are more than just words \u2014 they're a warm embrace of connection. Unlike quick 'hi and bye' exchanges, Spanish greetings often come with genuine warmth: a kiss on the cheek among friends, a firm handshake in business, and always eye contact.",
            infographic: 'sunArcGreetings',
            tip: "In most Latin American countries, a single kiss on the cheek is common. In Spain, it's usually two!"
          },
          {
            title: "Time Matters",
            content: "Spanish has different greetings for different times of day. 'Buenos d\u00edas' greets the morning sun, 'Buenas tardes' welcomes the afternoon, and 'Buenas noches' embraces the evening. Pay attention to when the sun moves across the sky!",
            tip: "The switch from 'Buenos d\u00edas' to 'Buenas tardes' typically happens around lunchtime, which in Spain can be as late as 2 PM."
          },
          {
            title: "Formal vs. Informal",
            content: "Spanish distinguishes between formal and informal speech through 'usted' and 't\u00fa'. Think of 'usted' as the respectful distance you'd keep with your boss or an elder, while 't\u00fa' is the comfortable closeness of friends and family.",
            infographic: 'formalInformal',
            tip: "When in doubt, start formal! It's always better to be too polite than too casual."
          }
        ],
        culturalSpotlight: {
          title: "La Sobremesa",
          content: "One of the most beautiful Spanish traditions is 'sobremesa' \u2014 the time spent lingering at the table after a meal, just talking and enjoying company. This is where real conversations happen, where bonds are strengthened. No rushing, no checking phones \u2014 just connection."
        }
      },
      numbers: {
        welcomeText: "Numbers are the universal language! In this chapter, you'll master counting in Spanish from zero to a million. Whether you're shopping, telling time, or sharing your phone number, numbers will become second nature.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "Spanish numbers follow patterns that make them easier to learn than you might think. Start with uno, dos, tres and build from there. The first fifteen numbers are unique, but after that, predictable patterns emerge that will help you count to infinity!",
            tip: "Notice that 'uno' becomes 'un' before masculine nouns: 'un libro' (one book), but stays 'una' for feminine: 'una mesa' (one table)."
          },
          {
            title: "Numbers in Daily Life",
            content: "From asking '\u00bfCu\u00e1nto cuesta?' (How much does it cost?) to giving your phone number digit by digit, numbers appear everywhere. Practice by counting everyday objects, reading prices, or doing simple math problems in Spanish.",
            tip: "When giving phone numbers in Spanish, people often say digits in pairs: 55-12-34 instead of 5-5-1-2-3-4."
          }
        ],
        culturalSpotlight: {
          title: "El Regateo (Bargaining)",
          content: "In many Spanish-speaking countries, bargaining is an art form, especially in markets and small shops. Knowing your numbers well gives you confidence to negotiate prices. Start by asking '\u00bfMe puede hacer un descuento?' (Can you give me a discount?) and see where the conversation goes!"
        }
      },
      family: {
        welcomeText: "Family is at the heart of Spanish-speaking culture. In this chapter, you'll learn to talk about your loved ones and understand the beautiful, sometimes complex, family structures that define Latin identity.",
        narrativeSections: [
          {
            title: "Family Structure",
            content: "In Spanish-speaking cultures, 'family' often extends far beyond the nuclear unit. Cousins might be as close as siblings, and 't\u00edos' (aunts and uncles) play significant roles in raising children. The vocabulary reflects this richness with specific terms for every relationship.",
            tip: "Many Spanish speakers use 't\u00edo/t\u00eda' affectionately for close friends too \u2014 it's like calling someone 'dude' or 'hon'!"
          },
          {
            title: "Extended Family",
            content: "Spanish has specific words for family relationships that English groups together. 'Suegra' is mother-in-law, 'cu\u00f1ado' is brother-in-law, and 'compadre' describes a special bond between godparents and parents. These terms reflect how deeply family ties weave into daily life."
          }
        ],
        culturalSpotlight: {
          title: "Los Apellidos",
          content: "Spanish naming conventions are unique \u2014 most people carry two last names: their father's surname followed by their mother's. This tradition honors both sides of the family and helps trace lineage. So 'Garc\u00eda L\u00f3pez' tells a story of two families joined together."
        }
      },
      daily: {
        welcomeText: "Let's refresh what you know and build your daily vocabulary! This chapter reviews essential Spanish basics and introduces simple phrases for everyday life. Perfect for warming up or solidifying your foundation.",
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
        }
      }
    }
  },

  french: {
    greetings: {
      morning: "Bonjour",
      afternoon: "Bon apr\u00e8s-midi",
      evening: "Bonsoir"
    },
    formalInformal: [
      { formal: "Comment allez-vous ?", informal: "Comment \u00e7a va ?", context: "How are you?" },
      { formal: "Enchant\u00e9(e)", informal: "Salut !", context: "Nice to meet you" },
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
        welcomeText: "Bienvenue to the world of French! French is the language of diplomacy, art, and elegance, and it all begins with how you greet someone. In this chapter, you'll discover how the French use greetings to set the tone for every interaction.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "In France, greetings are a matter of etiquette and respect. Walking into a shop without saying 'Bonjour' is considered rude. The French take time to acknowledge every person they encounter, whether it's a baker, a colleague, or a stranger on the street. This small gesture carries enormous social weight.",
            infographic: 'sunArcGreetings',
            tip: "Always say 'Bonjour' when entering a shop in France \u2014 skipping it is one of the most common faux pas visitors make!"
          },
          {
            title: "Time Matters",
            content: "'Bonjour' carries you through the day until early evening. When the sun begins to set, switch to 'Bonsoir'. The transition usually happens around 6 PM, though it can vary. 'Bonne nuit' is reserved specifically for bedtime \u2014 it's a farewell, not a greeting.",
            tip: "There's no separate 'Good afternoon' in daily French speech \u2014 'Bonjour' covers both morning and afternoon."
          },
          {
            title: "Formal vs. Informal",
            content: "French has a clear distinction between 'vous' (formal/plural) and 'tu' (informal/singular). Using 'tu' with someone you've just met can feel presumptuous, while 'vous' shows respect. The moment someone invites you to 'se tutoyer' (use tu) is a social milestone.",
            infographic: 'formalInformal',
            tip: "In professional settings, always use 'vous' unless explicitly invited to switch. Some colleagues work together for years without switching!"
          }
        ],
        culturalSpotlight: {
          title: "La Bise",
          content: "The French 'bise' \u2014 cheek kisses as greeting \u2014 is one of France's most iconic customs. The number of kisses varies by region: two in Paris, three in Provence, sometimes four in the north. It's an art form that signals warmth, familiarity, and belonging."
        }
      },
      numbers: {
        welcomeText: "French numbers have a unique charm and a few surprises! From the elegant simplicity of 'un, deux, trois' to the mathematical logic of 'quatre-vingts' (four-twenties for 80), this chapter will guide you through the French counting system.",
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
        }
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
        }
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
        }
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
        welcomeText: "Willkommen to German! Germany, Austria, and Switzerland each bring their own flavor to the language, but they all share a deep appreciation for proper greetings. In this chapter, you'll learn how to greet people with confidence across all German-speaking cultures.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "Germans value directness and sincerity in their greetings. A firm handshake and direct eye contact are standard when meeting someone. In Bavaria, you might hear 'Gr\u00fc\u00df Gott' instead of 'Hallo', while in northern Germany, 'Moin' covers all times of day. Each region adds its own character.",
            infographic: 'sunArcGreetings',
            tip: "'Moin' is used in northern Germany for any time of day \u2014 morning, noon, or night. It's one of the friendliest greetings you'll hear!"
          },
          {
            title: "Time Matters",
            content: "'Guten Morgen' starts your day, 'Guten Tag' carries you through the afternoon, and 'Guten Abend' welcomes the evening. Germans are punctual people, and their greetings reflect this awareness of time. 'Gute Nacht' is only for bedtime.",
            tip: "The shift from 'Guten Morgen' to 'Guten Tag' happens around noon \u2014 Germans take their meal times seriously!"
          },
          {
            title: "Formal vs. Informal",
            content: "German has a clear formal/informal distinction with 'Sie' (formal you) and 'du' (informal you). Using 'du' prematurely can be awkward, while 'Sie' shows professionalism. The ritual of offering the 'Du' (called 'Duzen') is a meaningful social moment.",
            infographic: 'formalInformal',
            tip: "In modern German workplaces, many companies use 'du' among all employees \u2014 but always wait for the offer!"
          }
        ],
        culturalSpotlight: {
          title: "Der Handschlag",
          content: "The German handshake is brief, firm, and accompanied by direct eye contact. Unlike cultures with cheek kisses, Germans keep a respectful physical distance with acquaintances. This straightforward greeting reflects the German values of honesty, reliability, and mutual respect."
        }
      },
      numbers: {
        welcomeText: "German numbers have their own logic and a few quirks that make them fascinating to learn. Once you understand the pattern of saying the ones digit before the tens, you'll be counting like a native in no time!",
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
        }
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
        }
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
        }
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
        welcomeText: "Benvenuto to Italian! Italy's culture is built on passion, beauty, and human connection \u2014 and it all starts with a warm greeting. In this chapter, you'll learn the graceful art of Italian greetings that open doors to la dolce vita.",
        narrativeSections: [
          {
            title: "The Art of Greeting",
            content: "Italians greet with enthusiasm and warmth. A hearty 'Ciao!' among friends, a respectful 'Buongiorno' to shopkeepers, and expressive hand gestures that bring words to life. In Italy, greeting someone properly shows you care about the relationship, no matter how brief the encounter.",
            infographic: 'sunArcGreetings',
            tip: "'Ciao' is both hello and goodbye \u2014 but only use it with people you know well! For strangers, stick with 'Buongiorno' or 'Buonasera'."
          },
          {
            title: "Time Matters",
            content: "'Buongiorno' brightens the morning, 'Buon pomeriggio' covers the afternoon (though many Italians simply continue with 'Buongiorno' until late afternoon), and 'Buonasera' arrives with the evening. The transition often happens later in Italy than in other countries \u2014 Italian days stretch long.",
            tip: "In southern Italy, the shift to 'Buonasera' can happen as late as 5 or 6 PM, reflecting the later dinner schedule."
          },
          {
            title: "Formal vs. Informal",
            content: "Italian uses 'Lei' for formal address and 'tu' for informal. 'Lei' (literally 'she') is used with strangers, elders, and in professional settings. The shift from 'Lei' to 'tu' (called 'dare del tu') is an invitation to closer friendship.",
            infographic: 'formalInformal',
            tip: "'Lei' is always capitalized in writing when used as formal 'you' \u2014 this distinguishes it from 'lei' meaning 'she'."
          }
        ],
        culturalSpotlight: {
          title: "La Passeggiata",
          content: "Every evening, Italians take part in 'la passeggiata' \u2014 a leisurely stroll through town. It's not exercise; it's a social ritual. Families, couples, and friends walk together, stopping to greet neighbors, admire shop windows, and enjoy gelato. It's the heartbeat of Italian community life."
        }
      },
      numbers: {
        welcomeText: "Italian numbers are melodious and follow beautiful patterns. In this chapter, you'll learn to count in Italian \u2014 from ordering 'due espresso' to reading prices at a Roman market. Numbers in Italian sound like music!",
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
        }
      },
      family: {
        welcomeText: "Family \u2014 'la famiglia' \u2014 is the cornerstone of Italian culture. In this chapter, you'll learn to describe your family relationships in Italian and discover why Italian family bonds are legendary around the world.",
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
        }
      },
      daily: {
        welcomeText: "Italian daily life is infused with warmth, beauty, and rich tradition. This chapter introduces the essential words and phrases you'll use every day as you navigate life the Italian way \u2014 'piano piano' (little by little).",
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
        }
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
        welcomeText: "Welcome to Japanese! Japan's culture places extraordinary value on politeness, respect, and social harmony. Learning Japanese greetings is your first step into a world where every word carries layers of meaning and consideration for others.",
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
            tip: "Start with polite '\u3067\u3059/\u307e\u3059' forms in every new situation. Japanese speakers will appreciate your effort and may invite you to speak more casually!"
          }
        ],
        culturalSpotlight: {
          title: "\u304a\u8f9e\u5100 (Ojigi) \u2014 The Bow",
          content: "Bowing is the Japanese greeting par excellence. It communicates respect, gratitude, apology, and greeting all at once. There are three main types: the 15-degree 'eshaku' (casual), the 30-degree 'keirei' (respectful), and the 45-degree 'saikeirei' (deep respect). Mastering the bow is mastering Japanese social language."
        }
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
        }
      },
      family: {
        welcomeText: "Japanese family vocabulary reveals a culture of deep respect for hierarchy and harmony. In this chapter, you'll learn how Japanese families are structured and discover the beautiful system of humble and honorific terms used for family members.",
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
        }
      },
      daily: {
        welcomeText: "Japanese daily life is a beautiful blend of ancient tradition and modern efficiency. This chapter gives you the essential vocabulary to navigate a day in Japan, from morning greetings to convenience store interactions.",
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
        }
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
      { formal: "\uc2e4\ub840\ud569\ub2c8\ub2e4", informal: "\uc7a0\uae50\ub9cc\uc694", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "\uc548\ub155\ud558\uc138\uc694", meaning: "Hello" },
      { phrase: "\uc548\ub155\ud788 \uac00\uc138\uc694", meaning: "Goodbye" },
      { phrase: "\uc8fc\uc138\uc694", meaning: "Please" },
      { phrase: "\uac10\uc0ac\ud569\ub2c8\ub2e4", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "Welcome to Korean! Korean culture is rooted in deep respect for relationships and social harmony. Learning how to greet people properly is the gateway to understanding Korea's rich traditions and warm hospitality \u2014 the concept of '\uc815' (jeong), or deep emotional bonds.",
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
            tip: "Always use polite speech ('\u2014\uc694' endings) when meeting someone new. It's the safest default until you know the social dynamics."
          }
        ],
        culturalSpotlight: {
          title: "\uc874\ub313\ub9d0 (Jondaenmal) \u2014 Honorific Speech",
          content: "Korean honorific speech reflects the deep Confucian values in Korean society. The first questions Koreans often ask new acquaintances are about age and social position \u2014 not to judge, but to know which speech level to use. This system creates a framework of mutual respect that permeates every interaction."
        }
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
        }
      },
      family: {
        welcomeText: "Korean family vocabulary is rich with terms that reflect the culture's deep respect for age and relationship hierarchy. In this chapter, you'll learn how Korean families are structured and why family terms are some of the most important words in the language.",
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
        }
      },
      daily: {
        welcomeText: "Korean daily life blends ancient courtesy with modern energy. This chapter equips you with the essential words and phrases for navigating everyday situations, from bustling Seoul streets to friendly neighborhood interactions.",
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
        }
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
      { formal: "\u8bf7\u95ee", informal: "\u4e0d\u597d\u610f\u601d", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "\u4f60\u597d", meaning: "Hello" },
      { phrase: "\u518d\u89c1", meaning: "Goodbye" },
      { phrase: "\u8bf7", meaning: "Please" },
      { phrase: "\u8c22\u8c22", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "Welcome to Mandarin Chinese! With over a billion speakers, Mandarin connects you to one of the world's oldest and richest civilizations. Chinese greetings reflect values of harmony, respect, and community \u2014 learn them well and you'll open countless doors.",
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
            tip: "Chinese politeness relies heavily on titles. Address people as '\u8001\u5e08' (l\u01ceo sh\u012b \u2014 teacher), '\u5148\u751f' (xi\u0101n sheng \u2014 Mr.), or '\u5973\u58eb' (n\u01da sh\u00ec \u2014 Ms.) to show respect."
          }
        ],
        culturalSpotlight: {
          title: "\u62f1\u624b (G\u01d2ng Sh\u01d2u) \u2014 The Clasped Hands",
          content: "The traditional Chinese greeting '\u62f1\u624b' involves clasping one's hands together (left over right) and raising them slightly while bowing. Though less common in daily life today, it's still used during Chinese New Year and formal ceremonies. It represents respect and peace \u2014 the covered fist symbolizing restraint and goodwill."
        }
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
        }
      },
      family: {
        welcomeText: "Family is the foundation of Chinese culture, and the Chinese language has one of the most detailed family vocabulary systems in the world. In this chapter, you'll discover terms that distinguish between paternal and maternal relatives with remarkable precision.",
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
        }
      },
      daily: {
        welcomeText: "Daily life in Chinese-speaking cultures is filled with tradition and modern vibrancy. This chapter gives you the essential vocabulary to navigate a day in China, from morning tai chi greetings to evening tea conversations.",
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
        }
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
        welcomeText: "Bem-vindo to Portuguese! Spoken across Brazil, Portugal, and several African nations, Portuguese is a language of warmth, rhythm, and saudade. This chapter introduces you to greetings that reflect the sunny disposition and deep hospitality of Portuguese-speaking cultures.",
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
            tip: "Brazilian Portuguese is generally less formal than European Portuguese \u2014 but always use 'o senhor/a senhora' with elderly people."
          }
        ],
        culturalSpotlight: {
          title: "Abra\u00e7o Brasileiro",
          content: "The Brazilian 'abra\u00e7o' (hug) is legendary. Brazilians embrace warmly and genuinely, even with people they've just met. This physical warmth extends to back-patting, arm-touching during conversation, and standing close while talking. It reflects 'calor humano' (human warmth) \u2014 the Brazilian belief that connection requires closeness."
        }
      },
      numbers: {
        welcomeText: "Portuguese numbers have a melodic quality that makes them a joy to learn. This chapter takes you through the counting system used across Brazil, Portugal, and beyond \u2014 from ordering a\u00e7a\u00ed bowls to navigating bustling markets.",
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
        }
      },
      family: {
        welcomeText: "Family \u2014 'fam\u00edlia' \u2014 is the heart and soul of Portuguese-speaking cultures. Whether in Brazil's sprawling family gatherings or Portugal's multi-generational homes, family bonds define daily life. This chapter explores the vocabulary of these cherished relationships.",
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
        }
      },
      daily: {
        welcomeText: "Daily life in Portuguese-speaking cultures is vibrant, social, and full of warmth. This chapter gives you the essential vocabulary to navigate everyday situations with the easygoing charm that defines the Lusophone world.",
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
        }
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
        welcomeText: "Welcome to English! As the world's most widely spoken second language, English connects cultures across every continent. In this chapter, you'll master the greetings that unlock conversations from London to Los Angeles, Sydney to Singapore.",
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
            tip: "English speakers often use indirect language for politeness: 'Would you mind...?' and 'I was wondering if...' soften requests beautifully."
          }
        ],
        culturalSpotlight: {
          title: "Small Talk",
          content: "The art of 'small talk' is central to English-speaking cultures. Talking about weather, weekend plans, or sports with strangers isn't meaningless \u2014 it's how trust is built. Mastering light, friendly conversation about everyday topics is one of the most valuable English skills you can develop."
        }
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
        }
      },
      family: {
        welcomeText: "English family vocabulary reflects the diverse family structures found across the English-speaking world. In this chapter, you'll learn terms for every family member and discover how family concepts vary from culture to culture within the Anglophone world.",
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
        }
      },
      daily: {
        welcomeText: "Everyday English is filled with idioms, shortcuts, and polite formulas that might surprise you. This chapter builds your daily vocabulary so you can navigate English-speaking life with confidence and natural ease.",
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
        }
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
      { formal: "\u05e1\u05dc\u05d9\u05d7\u05d4", informal: "\u05e8\u05d2\u05e2", context: "Excuse me" }
    ],
    quickPhrases: [
      { phrase: "\u05e9\u05dc\u05d5\u05dd", meaning: "Hello" },
      { phrase: "\u05dc\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea", meaning: "Goodbye" },
      { phrase: "\u05d1\u05d1\u05e7\u05e9\u05d4", meaning: "Please" },
      { phrase: "\u05ea\u05d5\u05d3\u05d4", meaning: "Thank you" }
    ],
    chapters: {
      greetings: {
        welcomeText: "Welcome to Hebrew! One of the oldest languages in the world, Hebrew was revived as a modern spoken language in the 20th century \u2014 a linguistic miracle. Israeli greetings reflect a culture that blends ancient traditions with a direct, warm, modern spirit.",
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
            tip: "Hebrew verbs and adjectives change based on the gender of the person you're addressing \u2014 this is one of the first things to master!"
          }
        ],
        culturalSpotlight: {
          title: "\u05e9\u05d1\u05ea \u05e9\u05dc\u05d5\u05dd (Shabbat Shalom)",
          content: "Every Friday evening, Israelis greet each other with '\u05e9\u05d1\u05ea \u05e9\u05dc\u05d5\u05dd' (Shabbat Shalom) as the Sabbath begins. Whether religious or secular, most Israelis mark Shabbat with a family dinner, candle lighting, and special challah bread. It's a weekly pause button that brings families and communities together in a shared rhythm of rest."
        }
      },
      numbers: {
        welcomeText: "Hebrew numbers carry thousands of years of history \u2014 each letter of the Hebrew alphabet has a numerical value. This chapter introduces the modern Hebrew counting system while connecting you to the ancient tradition of gematria and numerical meaning.",
        narrativeSections: [
          {
            title: "Counting Basics",
            content: "Hebrew numbers have masculine and feminine forms that match the noun being counted. '\u05d0\u05d7\u05d3' (echad) is masculine 'one', '\u05d0\u05d7\u05ea' (achat) is feminine 'one'. This gender agreement continues through the numbers. The system follows a logical pattern once you learn the basics: '\u05d0\u05d7\u05d3, \u05e9\u05e0\u05d9\u05d9\u05dd, \u05e9\u05dc\u05d5\u05e9\u05d4, \u05d0\u05e8\u05d1\u05e2\u05d4, \u05d7\u05de\u05e9\u05d4'.",
            tip: "Hebrew numbers have gender! The masculine and feminine forms are almost opposite to what you'd expect \u2014 masculine numbers often end in consonants while feminine ones can end in '\u05d4-'."
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
        }
      },
      family: {
        welcomeText: "Family \u2014 '\u05de\u05e9\u05e4\u05d7\u05d4' (mishpacha) \u2014 is the bedrock of Israeli and Jewish culture. In this chapter, you'll learn the Hebrew vocabulary for family relationships and discover how deeply family values are woven into everyday life in Israel.",
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
        }
      },
      daily: {
        welcomeText: "Israeli daily life is vibrant, informal, and full of unique expressions. This chapter gives you the essential vocabulary to navigate a day in Israel, from market haggling to coffee shop conversations \u2014 all with the characteristic Israeli directness and warmth.",
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
        }
      }
    }
  }
};

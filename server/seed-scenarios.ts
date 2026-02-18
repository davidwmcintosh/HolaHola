import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { scenarios, scenarioProps, scenarioLevelGuides } from '@shared/schema';

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.NEON_SHARED_DATABASE_URL;
if (!connectionString) {
  throw new Error('NEON_SHARED_DATABASE_URL is required');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

const ALL_LANGUAGES = ["spanish", "french", "german", "italian", "portuguese", "japanese", "mandarin", "korean", "arabic", "russian"];

interface ScenarioSeed {
  slug: string;
  title: string;
  description: string;
  category: "daily" | "travel" | "professional" | "social" | "emergency" | "cultural";
  location: string;
  defaultMood: string;
  minActflLevel: string;
  maxActflLevel: string;
  props: Array<{
    propType: string;
    title: string;
    content: any;
    displayOrder: number;
    isInteractive: boolean;
  }>;
  levelGuides: Array<{
    actflLevel: string;
    roleDescription: string;
    studentGoals: string[];
    vocabularyFocus: string[];
    grammarFocus: string[];
    conversationStarters: string[];
    complexityNotes: string;
  }>;
}

const scenarioData: ScenarioSeed[] = [
  {
    slug: "coffee-shop",
    title: "The Coffee Shop",
    description: "Order drinks and snacks at a cozy neighborhood coffee shop. Practice greetings, polite requests, and handling money.",
    category: "daily",
    location: "A cozy coffee shop",
    defaultMood: "casual",
    minActflLevel: "novice_low",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "menu",
        title: "Coffee Menu",
        content: {
          sections: [
            {
              name: "Hot Drinks",
              name_target: "Bebidas Calientes",
              items: [
                { name: "Espresso", name_target: "Café espresso", price: "1.80", description_target: "Café negro intenso" },
                { name: "Latte", name_target: "Café con leche", price: "3.20", description_target: "Café con leche cremosa" },
                { name: "Cappuccino", name_target: "Capuchino", price: "3.50", description_target: "Café con espuma de leche" },
                { name: "Hot Chocolate", name_target: "Chocolate caliente", price: "3.00", description_target: "Chocolate espeso tradicional" }
              ]
            },
            {
              name: "Cold Drinks",
              name_target: "Bebidas Frías",
              items: [
                { name: "Iced Coffee", name_target: "Café con hielo", price: "3.00", description_target: "Café frío con hielo" },
                { name: "Fresh Orange Juice", name_target: "Zumo de naranja natural", price: "3.50", description_target: "Zumo recién exprimido" },
                { name: "Water", name_target: "Agua mineral", price: "1.50", description_target: "Agua con o sin gas" }
              ]
            },
            {
              name: "Pastries",
              name_target: "Bollería",
              items: [
                { name: "Croissant", name_target: "Cruasán", price: "2.00", description_target: "Cruasán de mantequilla" },
                { name: "Toast with Tomato", name_target: "Tostada con tomate", price: "2.50", description_target: "Pan tostado con tomate y aceite" }
              ]
            }
          ]
        },
        displayOrder: 0,
        isInteractive: true
      },
      {
        propType: "bill",
        title: "Receipt/Bill",
        content: {
          title: "Receipt",
          fields: [
            { label: "Establishment", value: "The Coffee Shop" },
            { label: "Date", value: "Today" },
            { label: "Items", value: "(dynamic)" },
            { label: "Subtotal", value: "0.00€" },
            { label: "Tax (IVA 10%)", value: "0.00€" },
            { label: "Total", value: "0.00€" }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "novice_low",
        roleDescription: "You are a friendly, patient barista at a cozy coffee shop. Speak slowly, use simple words, and gesture encouragingly. The student is ordering for the first time in Spanish.",
        studentGoals: [
          "Greet the barista with 'Hola' or 'Buenos días'",
          "Order one drink using 'Un/una... por favor'",
          "Say 'gracias' when receiving the order",
          "Understand basic prices when told"
        ],
        vocabularyFocus: ["hola", "por favor", "gracias", "café", "agua", "un/una", "sí", "no"],
        grammarFocus: ["Basic greetings", "Indefinite articles (un/una)"],
        conversationStarters: [
          "¡Hola! ¡Buenos días! ¿Qué desea?",
          "¡Bienvenido a Café Sol! ¿Qué le pongo?"
        ],
        complexityNotes: "Keep interactions to 2-3 exchanges. Accept single-word answers. Celebrate every attempt. Use gestures and visual cues from the menu."
      },
      {
        actflLevel: "novice_mid",
        roleDescription: "You are a cheerful barista at a cozy coffee shop. Engage in simple small talk while taking orders. The student can handle basic transactions.",
        studentGoals: [
          "Order a drink and a pastry",
          "Specify preferences (hot/cold, with/without milk)",
          "Ask about prices using '¿Cuánto cuesta?'",
          "Handle a simple payment interaction"
        ],
        vocabularyFocus: ["cuánto cuesta", "caliente", "frío", "con leche", "sin azúcar", "la cuenta", "para llevar", "aquí"],
        grammarFocus: ["Question formation with ¿Cuánto?", "Prepositions con/sin", "Present tense querer (quiero)"],
        conversationStarters: [
          "¡Buenos días! ¿Qué le apetece hoy?",
          "¡Hola! Tenemos una oferta especial hoy. ¿Le interesa?"
        ],
        complexityNotes: "Encourage 3-4 exchange conversations. Introduce choices and preferences. Model polite forms naturally."
      },
      {
        actflLevel: "intermediate_mid",
        roleDescription: "You are a talkative, friendly barista at a cozy coffee shop who loves chatting with regulars. Ask about their day, suggest items, and engage in casual conversation about the neighborhood.",
        studentGoals: [
          "Carry a natural conversation while ordering",
          "Discuss preferences and make comparisons",
          "Handle unexpected situations (item unavailable, wrong order)",
          "Ask for and understand recommendations",
          "Discuss plans for the day"
        ],
        vocabularyFocus: ["recomendación", "preferir", "probar", "especialidad", "descafeinado", "tamaño", "alérgico", "ingredientes"],
        grammarFocus: ["Conditional for polite requests (me gustaría)", "Comparatives (más... que)", "Subjunctive in suggestions (le recomiendo que pruebe...)"],
        conversationStarters: [
          "¡Hola! ¡Cuánto tiempo sin verte! ¿Lo de siempre o quieres probar algo nuevo?",
          "¡Buenos días! Hoy tenemos un café especial de Colombia. ¿Te apetece probarlo?"
        ],
        complexityNotes: "Create natural conversational flow. Introduce complications (out of oat milk, new item on menu). Encourage opinions and preferences."
      }
    ]
  },

  {
    slug: "grocery-store",
    title: "The Grocery Store",
    description: "Shop for ingredients at a bustling local market. Practice quantities, food vocabulary, and interacting with vendors.",
    category: "daily",
    location: "A local market",
    defaultMood: "busy",
    minActflLevel: "novice_low",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "list",
        title: "Shopping List",
        content: {
          items: [
            { name: "Tomatoes (1 kg)", name_target: "Tomates (1 kilo)", checked: false },
            { name: "Bread", name_target: "Pan", checked: false },
            { name: "Olive Oil", name_target: "Aceite de oliva", checked: false },
            { name: "Eggs (dozen)", name_target: "Huevos (una docena)", checked: false },
            { name: "Cheese", name_target: "Queso", checked: false },
            { name: "Ham", name_target: "Jamón", checked: false },
            { name: "Oranges (2 kg)", name_target: "Naranjas (2 kilos)", checked: false },
            { name: "Milk", name_target: "Leche", checked: false }
          ]
        },
        displayOrder: 0,
        isInteractive: true
      },
      {
        propType: "menu",
        title: "Price Board",
        content: {
          sections: [
            {
              name: "Fruits",
              name_target: "Frutas",
              items: [
                { name: "Oranges", name_target: "Naranjas", price: "2.00/kg", description_target: "Naranjas valencianas" },
                { name: "Apples", name_target: "Manzanas", price: "2.50/kg", description_target: "Manzanas rojas" },
                { name: "Bananas", name_target: "Plátanos", price: "1.80/kg", description_target: "Plátanos de Canarias" }
              ]
            },
            {
              name: "Vegetables",
              name_target: "Verduras",
              items: [
                { name: "Tomatoes", name_target: "Tomates", price: "3.00/kg", description_target: "Tomates de la huerta" },
                { name: "Peppers", name_target: "Pimientos", price: "3.50/kg", description_target: "Pimientos rojos y verdes" },
                { name: "Onions", name_target: "Cebollas", price: "1.50/kg", description_target: "Cebollas frescas" }
              ]
            },
            {
              name: "Deli",
              name_target: "Charcutería",
              items: [
                { name: "Iberian Ham", name_target: "Jamón ibérico", price: "18.00/kg", description_target: "Jamón curado artesanal" },
                { name: "Manchego Cheese", name_target: "Queso manchego", price: "12.00/kg", description_target: "Queso curado de oveja" }
              ]
            }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "novice_low",
        roleDescription: "You are a warm, patient vendor at a bustling local market. Help the student buy basic items using simple language and pointing at products.",
        studentGoals: [
          "Ask for items by name",
          "Use numbers for quantities",
          "Say please and thank you",
          "Understand basic prices"
        ],
        vocabularyFocus: ["quiero", "kilo", "por favor", "gracias", "cuánto", "tomates", "pan", "fruta"],
        grammarFocus: ["Numbers 1-20", "Basic requests with quiero"],
        conversationStarters: [
          "¡Buenos días! ¿Qué necesita?",
          "¡Hola! ¿Qué le pongo hoy?"
        ],
        complexityNotes: "Use visual cues from the shopping list. Accept pointing and single words. Repeat prices slowly."
      },
      {
        actflLevel: "intermediate_mid",
        roleDescription: "You are an enthusiastic market vendor who loves to talk about food quality and recipes. Recommend products, explain origins, and chat about cooking.",
        studentGoals: [
          "Negotiate quantities and ask about freshness",
          "Ask for recommendations for a specific recipe",
          "Compare products and prices",
          "Handle the complete transaction including bag and change",
          "Discuss food preferences and dietary needs"
        ],
        vocabularyFocus: ["maduro", "fresco", "de temporada", "receta", "ingredientes", "oferta", "bolsa", "cambio"],
        grammarFocus: ["Comparatives and superlatives", "Conditional requests", "Past participles as adjectives"],
        conversationStarters: [
          "¡Buenos días! Hoy tenemos unas naranjas buenísimas de la huerta. ¿Le pongo unas cuantas?",
          "¡Hola! ¿Va a preparar algo especial? Le puedo recomendar lo mejor de hoy."
        ],
        complexityNotes: "Create authentic market banter. Introduce unexpected situations (price changes, items sold out, special deals). Encourage opinion expression."
      }
    ]
  },

  {
    slug: "restaurant",
    title: "The Restaurant",
    description: "Dine at a charming local restaurant. Practice ordering food, asking about dishes, and handling the bill.",
    category: "daily",
    location: "A local restaurant",
    defaultMood: "warm",
    minActflLevel: "novice_mid",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "menu",
        title: "Restaurant Menu",
        content: {
          sections: [
            {
              name: "Starters",
              name_target: "Antipasti",
              items: [
                { name: "Bruschetta", name_target: "Bruschetta al pomodoro", price: "6.00", description_target: "Pan tostado con tomate y albahaca" },
                { name: "Caprese Salad", name_target: "Insalata caprese", price: "8.00", description_target: "Mozzarella fresca, tomate y albahaca" }
              ]
            },
            {
              name: "Main Courses",
              name_target: "Primi Piatti",
              items: [
                { name: "Spaghetti Carbonara", name_target: "Spaghetti alla carbonara", price: "12.00", description_target: "Pasta con huevo, queso pecorino y guanciale" },
                { name: "Margherita Pizza", name_target: "Pizza margherita", price: "10.00", description_target: "Pizza clásica con tomate, mozzarella y albahaca" },
                { name: "Lasagna", name_target: "Lasagna al forno", price: "13.00", description_target: "Lasaña horneada con ragú y bechamel" }
              ]
            },
            {
              name: "Desserts",
              name_target: "Dolci",
              items: [
                { name: "Tiramisu", name_target: "Tiramisú", price: "7.00", description_target: "Postre clásico con café y mascarpone" },
                { name: "Panna Cotta", name_target: "Panna cotta", price: "6.50", description_target: "Crema italiana con frutos rojos" }
              ]
            },
            {
              name: "Drinks",
              name_target: "Bevande",
              items: [
                { name: "House Wine (glass)", name_target: "Vino de la casa (copa)", price: "5.00", description_target: "Tinto o blanco de la región" },
                { name: "Sparkling Water", name_target: "Acqua frizzante", price: "2.50", description_target: "Agua con gas" }
              ]
            }
          ]
        },
        displayOrder: 0,
        isInteractive: true
      },
      {
        propType: "bill",
        title: "Check/Bill",
        content: {
          title: "The Restaurant - Check",
          fields: [
            { label: "Table", value: "Mesa 7" },
            { label: "Server", value: "Marco" },
            { label: "Items", value: "(dynamic)" },
            { label: "Subtotal", value: "0.00€" },
            { label: "Service (coperto)", value: "2.50€" },
            { label: "Total", value: "0.00€" }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "novice_mid",
        roleDescription: "You are a friendly waiter named Marco at a charming local restaurant. You speak clearly and help the student navigate the menu with patience and warmth.",
        studentGoals: [
          "Request a table and understand seating",
          "Order a starter and a main course",
          "Ask what a dish contains",
          "Request the bill politely"
        ],
        vocabularyFocus: ["mesa", "menú", "para mí", "la cuenta", "agua", "plato", "quiero", "tiene"],
        grammarFocus: ["Quiero + noun for ordering", "¿Tiene...? for asking availability", "Definite articles (el/la/los/las)"],
        conversationStarters: [
          "¡Buenas noches! Bienvenidos a La Trattoria. ¿Mesa para cuántos?",
          "Aquí tienen el menú. ¿Les traigo algo de beber mientras deciden?"
        ],
        complexityNotes: "Guide through the ordering sequence step by step. Offer choices between two items. Use the menu as a visual support."
      },
      {
        actflLevel: "intermediate_low",
        roleDescription: "You are Marco, an experienced waiter at a charming local restaurant who loves recommending dishes. Engage with the student about ingredients, preparations, and pairings.",
        studentGoals: [
          "Ask about ingredients and allergens",
          "Request recommendations and discuss preferences",
          "Order a complete meal (starter, main, dessert, drink)",
          "Handle a minor issue (wrong order, forgotten item)",
          "Make special requests (no onions, extra cheese)"
        ],
        vocabularyFocus: ["ingredientes", "alérgico", "recomendar", "especialidad", "sin", "extra", "picante", "vegetariano"],
        grammarFocus: ["Conditional for polite requests (podría)", "Indirect object pronouns (me trae, nos pone)", "Subjunctive in recommendations"],
        conversationStarters: [
          "¡Buenas noches! Hoy el chef tiene una lasaña especial que les recomiendo mucho.",
          "Bienvenidos. ¿Han estado aquí antes o es su primera vez en La Trattoria?"
        ],
        complexityNotes: "Create a full dining experience. Introduce complications naturally (dish sold out, recommending alternatives). Encourage food opinion expression."
      }
    ]
  },

  {
    slug: "airport-checkin",
    title: "Airport Check-in",
    description: "Navigate the check-in process at the airport. Practice travel vocabulary, following instructions, and handling documents.",
    category: "travel",
    location: "An airport terminal",
    defaultMood: "formal",
    minActflLevel: "novice_mid",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "document",
        title: "Boarding Pass",
        content: {
          title: "Boarding Pass / Tarjeta de Embarque",
          fields: [
            { label: "Passenger / Pasajero", value: "(Student Name)" },
            { label: "Flight / Vuelo", value: "IB 3214" },
            { label: "From / Origen", value: "Madrid (MAD)" },
            { label: "To / Destino", value: "Barcelona (BCN)" },
            { label: "Date / Fecha", value: "18 Feb 2026" },
            { label: "Gate / Puerta", value: "B22" },
            { label: "Seat / Asiento", value: "14A" },
            { label: "Boarding / Embarque", value: "10:30" },
            { label: "Departure / Salida", value: "11:15" }
          ]
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "map",
        title: "Gate Map",
        content: {
          locations: [
            { name: "Check-in Counter", name_target: "Mostrador de facturación", description: "Terminal 4, Zone A" },
            { name: "Security", name_target: "Control de seguridad", description: "After check-in, follow signs" },
            { name: "Gate B22", name_target: "Puerta B22", description: "Terminal 4S, Level 1" },
            { name: "Duty Free", name_target: "Tienda libre de impuestos", description: "After security, left corridor" },
            { name: "Restrooms", name_target: "Servicios / Aseos", description: "Near Gates B20-B25" },
            { name: "Food Court", name_target: "Zona de restaurantes", description: "Central area, Level 2" }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "novice_mid",
        roleDescription: "You are a patient airline check-in agent at the airport. Speak clearly, use standard phrases, and guide the student through the check-in process step by step.",
        studentGoals: [
          "Present passport and booking confirmation",
          "Understand seat assignment and gate information",
          "Answer basic questions about luggage",
          "Follow simple directions to the gate"
        ],
        vocabularyFocus: ["pasaporte", "vuelo", "equipaje", "puerta", "asiento", "ventanilla", "pasillo", "embarque"],
        grammarFocus: ["Imperative for directions (vaya, siga)", "¿Tiene...? questions", "Numbers for gates and seats"],
        conversationStarters: [
          "Buenos días. ¿Puedo ver su pasaporte y su reserva, por favor?",
          "Bienvenido. ¿A dónde viaja hoy?"
        ],
        complexityNotes: "Follow the standard check-in sequence. Use the boarding pass as a visual reference. Keep questions simple with yes/no options."
      },
      {
        actflLevel: "intermediate_mid",
        roleDescription: "You are an efficient but friendly airline agent at the airport. Handle complex travel situations including connections, seat upgrades, and luggage issues.",
        studentGoals: [
          "Handle check-in independently including luggage weight",
          "Request specific seat preferences with justification",
          "Ask about connection times and terminal changes",
          "Handle a problem (overweight bag, delayed flight, missing booking)",
          "Navigate the airport using directions"
        ],
        vocabularyFocus: ["conexión", "escala", "sobrepeso", "facturar", "equipaje de mano", "tarifa", "retraso", "reclamación"],
        grammarFocus: ["Conditional for polite requests", "Future tense for itinerary", "Subjunctive in expressing needs (necesito que...)"],
        conversationStarters: [
          "Buenos días. Veo que tiene una conexión en Barcelona. ¿Lleva equipaje para facturar?",
          "Buenas tardes. Me temo que su vuelo tiene un pequeño retraso. Le explico las opciones."
        ],
        complexityNotes: "Introduce real travel complications. Practice problem-solving in Spanish. Use the gate map for direction-giving practice."
      }
    ]
  },

  {
    slug: "hotel-checkin",
    title: "Hotel Check-in",
    description: "Check into a charming hotel. Practice hospitality vocabulary, making requests, and understanding room information.",
    category: "travel",
    location: "A hotel front desk",
    defaultMood: "formal",
    minActflLevel: "novice_mid",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "card",
        title: "Room Key Card",
        content: {
          title: "Room Key Card / Carte de Chambre",
          fields: [
            { label: "Guest / Invitado", value: "(Student Name)" },
            { label: "Room / Habitación", value: "412" },
            { label: "Floor / Piso", value: "4th / Cuarto" },
            { label: "Check-in", value: "18 Feb 2026, 15:00" },
            { label: "Check-out", value: "21 Feb 2026, 11:00" },
            { label: "Wi-Fi Password", value: "Hotel2026" },
            { label: "Breakfast / Desayuno", value: "7:00 - 10:30, Main Dining Room" }
          ]
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "map",
        title: "Hotel Map",
        content: {
          locations: [
            { name: "Front Desk", name_target: "Recepción", description: "Ground floor, main entrance" },
            { name: "Restaurant", name_target: "Restaurante", description: "Ground floor, east wing" },
            { name: "Pool & Spa", name_target: "Piscina y Spa", description: "Basement level" },
            { name: "Gym", name_target: "Gimnasio", description: "Basement level, next to spa" },
            { name: "Business Center", name_target: "Centro de negocios", description: "2nd floor, room 201" },
            { name: "Parking", name_target: "Aparcamiento", description: "Underground, access from lobby" }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "novice_mid",
        roleDescription: "You are a polite and helpful receptionist at a charming hotel. Guide the student through a simple check-in process, speaking clearly and slowly.",
        studentGoals: [
          "State your name and confirm your reservation",
          "Understand room number and floor",
          "Ask about basic hotel amenities (Wi-Fi, breakfast)",
          "Say thank you and understand key card instructions"
        ],
        vocabularyFocus: ["reserva", "habitación", "piso", "llave", "desayuno", "contraseña", "ascensor", "recepción"],
        grammarFocus: ["Tengo una reserva a nombre de...", "¿Dónde está...? for locations", "Numbers for rooms and floors"],
        conversationStarters: [
          "¡Buenas tardes! Bienvenido al Grand Hôtel. ¿Tiene reserva?",
          "¡Hola! ¿En qué puedo ayudarle?"
        ],
        complexityNotes: "Walk through check-in step by step. Point to the key card for visual reference. Keep amenity information simple."
      },
      {
        actflLevel: "intermediate_mid",
        roleDescription: "You are a knowledgeable concierge at a charming hotel who helps guests with local recommendations, special requests, and problem-solving.",
        studentGoals: [
          "Complete check-in and request room preferences (view, quiet floor)",
          "Ask detailed questions about hotel services and hours",
          "Request restaurant reservations or local recommendations",
          "Handle a room issue (noisy neighbors, broken AC, missing towels)",
          "Plan local activities with the concierge's help"
        ],
        vocabularyFocus: ["vista", "planta alta", "servicio de habitaciones", "queja", "recomendar", "reservar", "traslado", "factura"],
        grammarFocus: ["Conditional for polite requests", "Subjunctive for preferences (prefiero que...)", "Imperfect for describing expectations"],
        conversationStarters: [
          "Bienvenido de nuevo. Tenemos su habitación lista. ¿Prefiere vista a la ciudad o al jardín?",
          "Buenas tardes. Veo que es su primera visita a Lyon. ¿Le gustaría que le recomiende algunos lugares?"
        ],
        complexityNotes: "Create realistic hotel scenarios. Introduce opportunities for problem-solving and expressing preferences. Use the hotel map for orientation."
      }
    ]
  },

  {
    slug: "taxi-ride",
    title: "The Taxi Ride",
    description: "Take a taxi across town. Practice giving directions, making small talk, and handling fares in a moving conversation.",
    category: "travel",
    location: "A taxi cab",
    defaultMood: "casual",
    minActflLevel: "novice_mid",
    maxActflLevel: "intermediate_high",
    props: [
      {
        propType: "map",
        title: "City Map",
        content: {
          locations: [
            { name: "Hotel Zócalo", name_target: "Hotel Zócalo", description: "Starting point, city center" },
            { name: "Chapultepec Castle", name_target: "Castillo de Chapultepec", description: "Hilltop castle and museum" },
            { name: "Frida Kahlo Museum", name_target: "Museo Frida Kahlo", description: "Coyoacán neighborhood" },
            { name: "Teotihuacán Pyramids", name_target: "Pirámides de Teotihuacán", description: "40 km northeast of the city" },
            { name: "Roma Norte", name_target: "Colonia Roma Norte", description: "Trendy neighborhood with cafés" },
            { name: "Airport", name_target: "Aeropuerto Internacional", description: "AICM, east of city" }
          ]
        },
        displayOrder: 0,
        isInteractive: true
      },
      {
        propType: "document",
        title: "Fare Meter",
        content: {
          title: "Taxi Fare / Tarifa del Taxi",
          fields: [
            { label: "Base Fare / Banderazo", value: "$13.10 MXN" },
            { label: "Per km / Por kilómetro", value: "$5.40 MXN" },
            { label: "Per minute (waiting) / Por minuto (espera)", value: "$1.84 MXN" },
            { label: "Night surcharge / Recargo nocturno", value: "+20%" },
            { label: "Estimated total", value: "(varies by destination)" }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "novice_mid",
        roleDescription: "You are a friendly taxi driver. You speak at a moderate pace and help the student communicate their destination. You're patient with beginners.",
        studentGoals: [
          "Tell the driver where you want to go",
          "Understand basic directions (left, right, straight)",
          "Ask how long the trip takes",
          "Handle payment and tip"
        ],
        vocabularyFocus: ["a la derecha", "a la izquierda", "derecho", "aquí", "pare", "cuánto", "propina", "lejos"],
        grammarFocus: ["Imperative commands for directions", "¿Cuánto tarda? / ¿Cuánto cuesta?", "A + destination"],
        conversationStarters: [
          "¡Buenas! ¿A dónde lo llevo?",
          "¡Hola, amigo! Súbase. ¿Para dónde vamos?"
        ],
        complexityNotes: "Keep the conversation focused on the destination and route. Use the city map as visual support. Accept simple destination names."
      },
      {
        actflLevel: "intermediate_low",
        roleDescription: "You are a chatty, knowledgeable taxi driver who loves sharing stories about the city. Engage in casual conversation about local sights, food, and culture.",
        studentGoals: [
          "Give detailed directions including landmarks",
          "Engage in small talk about the city and local life",
          "Ask for recommendations (restaurants, sights)",
          "Handle route changes and negotiate stops",
          "Discuss travel plans and preferences"
        ],
        vocabularyFocus: ["semáforo", "esquina", "cuadra", "tráfico", "atajo", "colonia", "recomendación", "parada"],
        grammarFocus: ["Informal tú commands", "Present progressive (estamos pasando por...)", "Imperfect for describing how things used to be"],
        conversationStarters: [
          "¿Primera vez en la Ciudad de México? ¡Le va a encantar! ¿Qué le gustaría conocer?",
          "¡Qué buen día para pasear! ¿Ya conoce Coyoacán? Está muy bonito por allá."
        ],
        complexityNotes: "Create an immersive Mexican Spanish conversation. Use local slang naturally. Discuss food, culture, and daily life in Mexico City."
      }
    ]
  },

  {
    slug: "job-interview",
    title: "Job Interview",
    description: "Interview for a position at a growing company. Practice professional vocabulary, describing experience, and answering behavioral questions.",
    category: "professional",
    location: "A company office",
    defaultMood: "formal",
    minActflLevel: "intermediate_mid",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "document",
        title: "Resume",
        content: {
          title: "Curriculum Vitae / Resume",
          fields: [
            { label: "Name / Nombre", value: "(Student Name)" },
            { label: "Position Applied / Puesto", value: "Marketing Coordinator" },
            { label: "Education / Formación", value: "Bachelor in Business Administration" },
            { label: "Experience / Experiencia", value: "3 years in digital marketing" },
            { label: "Skills / Habilidades", value: "Social media, data analysis, content creation" },
            { label: "Languages / Idiomas", value: "English (native), Spanish (intermediate)" },
            { label: "References / Referencias", value: "Available upon request" }
          ]
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Job Posting",
        content: {
          title: "Job Posting / Oferta de Empleo",
          fields: [
            { label: "Company / Empresa", value: "The Company" },
            { label: "Position / Puesto", value: "Marketing Coordinator" },
            { label: "Location / Ubicación", value: "Hybrid / Remote" },
            { label: "Salary / Salario", value: "€45,000 - €55,000" },
            { label: "Requirements / Requisitos", value: "2+ years marketing experience, bilingual, data-driven" },
            { label: "Benefits / Beneficios", value: "Flexible hours, gym membership, language courses" },
            { label: "Start Date / Fecha de inicio", value: "April 2026" }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "intermediate_mid",
        roleDescription: "You are a friendly HR manager at a growing company conducting a structured job interview. Ask clear questions and give the student time to formulate answers. Be encouraging but professional.",
        studentGoals: [
          "Introduce yourself and describe your background",
          "Describe past work experience using past tenses",
          "Explain why you're interested in this position",
          "Ask questions about the role and company",
          "Handle common interview questions (strengths, weaknesses)"
        ],
        vocabularyFocus: ["experiencia", "habilidades", "logros", "equipo", "responsabilidades", "salario", "crecimiento", "motivación"],
        grammarFocus: ["Preterite vs imperfect for work history", "Conditional for hypothetical scenarios", "Subjunctive in expressing goals"],
        conversationStarters: [
          "Buenos días, gracias por venir. ¿Por qué no empezamos con una breve presentación suya?",
          "Bienvenido a TechStart. Cuénteme un poco sobre su experiencia profesional."
        ],
        complexityNotes: "Structure the interview with clear questions. Give feedback on answers. Practice both formal and semi-formal register."
      },
      {
        actflLevel: "advanced_low",
        roleDescription: "You are the VP of Marketing at a growing company. Conduct a challenging behavioral interview with follow-up questions. Discuss strategy, leadership, and complex scenarios.",
        studentGoals: [
          "Narrate complex professional experiences with nuance",
          "Discuss marketing strategy and analytical approaches",
          "Handle challenging behavioral questions (conflict resolution, failure)",
          "Negotiate salary and benefits",
          "Demonstrate cultural awareness in a multilingual workplace"
        ],
        vocabularyFocus: ["estrategia", "liderazgo", "rendimiento", "KPI", "negociar", "conflicto", "innovación", "propuesta de valor"],
        grammarFocus: ["Complex subjunctive structures", "Conditional perfect for hypotheticals", "Discourse markers for structured arguments"],
        conversationStarters: [
          "Cuénteme sobre una situación en la que tuvo que liderar un proyecto difícil. ¿Cómo lo manejó?",
          "En TechStart valoramos la innovación. ¿Puede darme un ejemplo de cuando propuso una idea que cambió un proceso?"
        ],
        complexityNotes: "Push for detailed, structured responses. Use the STAR method. Include curveball questions and salary negotiation practice."
      }
    ]
  },

  {
    slug: "office-meeting",
    title: "Office Meeting",
    description: "Participate in a team meeting at work. Practice professional discussion, presenting ideas, and collaborative problem-solving.",
    category: "professional",
    location: "An office meeting room",
    defaultMood: "professional",
    minActflLevel: "intermediate_mid",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "document",
        title: "Meeting Agenda",
        content: {
          title: "Meeting Agenda / Agenda de la Reunión",
          fields: [
            { label: "Meeting / Reunión", value: "Weekly Marketing Sync" },
            { label: "Date / Fecha", value: "Tuesday, 10:00 AM" },
            { label: "Duration / Duración", value: "45 minutes" },
            { label: "Item 1", value: "Q1 Campaign Results Review" },
            { label: "Item 2", value: "Social Media Strategy Update" },
            { label: "Item 3", value: "New Product Launch Plan" },
            { label: "Item 4", value: "Budget Allocation Discussion" },
            { label: "Item 5", value: "Action Items & Next Steps" }
          ]
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Notes Pad",
        content: {
          title: "Meeting Notes / Notas de la Reunión",
          fields: [
            { label: "Key Decisions", value: "(to be filled during meeting)" },
            { label: "Action Items", value: "(to be filled during meeting)" },
            { label: "Deadlines", value: "(to be filled during meeting)" },
            { label: "Follow-up Meeting", value: "(to be scheduled)" }
          ]
        },
        displayOrder: 1,
        isInteractive: true
      }
    ],
    levelGuides: [
      {
        actflLevel: "intermediate_mid",
        roleDescription: "You are a supportive team lead running a structured team meeting. Guide the discussion through the agenda items and invite the student to contribute opinions.",
        studentGoals: [
          "Follow and contribute to a structured meeting agenda",
          "Express opinions on business topics",
          "Agree and disagree politely with colleagues",
          "Summarize key points and action items",
          "Ask clarifying questions about projects"
        ],
        vocabularyFocus: ["agenda", "resultados", "propuesta", "plazo", "presupuesto", "estrategia", "seguimiento", "acuerdo"],
        grammarFocus: ["Formal register and usted forms", "Expressing opinions (creo que, me parece que)", "Future tense for action items"],
        conversationStarters: [
          "Buenos días a todos. Empecemos con el primer punto de la agenda: los resultados del primer trimestre.",
          "Gracias por venir. ¿Alguien quiere empezar con las novedades de la campaña?"
        ],
        complexityNotes: "Create a realistic meeting flow. Rotate between presenting information and soliciting opinions. Practice professional register."
      },
      {
        actflLevel: "advanced_low",
        roleDescription: "You are a senior director facilitating a high-stakes strategy meeting. Challenge the student to defend ideas, present data, and navigate office politics.",
        studentGoals: [
          "Present complex data and analysis to the team",
          "Defend a proposal against pushback",
          "Navigate diplomatic disagreements with colleagues",
          "Lead a discussion and manage time",
          "Propose creative solutions to business challenges"
        ],
        vocabularyFocus: ["rendimiento", "ROI", "análisis", "implementar", "priorizar", "reestructurar", "escalable", "benchmark"],
        grammarFocus: ["Subjunctive for suggestions and recommendations", "Passive voice for formal presentation", "Complex conditional sentences"],
        conversationStarters: [
          "Los números del trimestre no son los que esperábamos. ¿Qué proponen para el próximo periodo?",
          "Necesitamos tomar una decisión sobre el presupuesto hoy. ¿Quién quiere presentar su propuesta primero?"
        ],
        complexityNotes: "Create authentic corporate dynamics. Include pushback on ideas, time pressure, and competing priorities. Practice persuasion and negotiation."
      }
    ]
  },

  {
    slug: "house-party",
    title: "House Party",
    description: "Attend a lively house party. Practice social introductions, casual conversation, and local expressions.",
    category: "social",
    location: "A friend's house",
    defaultMood: "lively",
    minActflLevel: "novice_high",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "list",
        title: "Guest List",
        content: {
          items: [
            { name: "María (host)", name_target: "María (anfitriona)", checked: false },
            { name: "Carlos - María's brother", name_target: "Carlos - hermano de María", checked: false },
            { name: "Lucía - university friend", name_target: "Lucía - amiga de la universidad", checked: false },
            { name: "Pedro - neighbor", name_target: "Pedro - vecino", checked: false },
            { name: "Ana & Diego - couple", name_target: "Ana y Diego - pareja", checked: false },
            { name: "Sofía - coworker", name_target: "Sofía - compañera de trabajo", checked: false }
          ]
        },
        displayOrder: 0,
        isInteractive: true
      },
      {
        propType: "list",
        title: "Music Playlist",
        content: {
          items: [
            { name: "Cumbia Mix", name_target: "Cumbia Mix", checked: false },
            { name: "Reggaeton Hits", name_target: "Éxitos de Reggaetón", checked: false },
            { name: "Rock en Español", name_target: "Rock en Español", checked: false },
            { name: "Tango Classics", name_target: "Clásicos del Tango", checked: false },
            { name: "Pop Latino", name_target: "Pop Latino", checked: false },
            { name: "Electronic / DJ Set", name_target: "Electrónica / Set de DJ", checked: false }
          ]
        },
        displayOrder: 1,
        isInteractive: true
      }
    ],
    levelGuides: [
      {
        actflLevel: "novice_high",
        roleDescription: "You are María, the warm and welcoming host of a house party. You introduce the student to other guests and make them feel included in simple conversations.",
        studentGoals: [
          "Introduce yourself to new people",
          "Ask and answer basic personal questions (name, origin, work)",
          "Accept or decline food and drink offers",
          "Express simple opinions about music and food",
          "Use basic social phrases (nice to meet you, cheers)"
        ],
        vocabularyFocus: ["mucho gusto", "encantado/a", "de dónde eres", "qué hacés", "salud", "rico", "genial", "che"],
        grammarFocus: ["Present tense for introductions", "Ser vs estar basics", "Voseo (Argentine Spanish: vos querés)"],
        conversationStarters: [
          "¡Hola! ¡Bienvenido! Soy María. ¡Pasá, pasá! ¿Querés algo de tomar?",
          "¡Che, qué bueno que viniste! Vení que te presento a mis amigos."
        ],
        complexityNotes: "Create a welcoming social atmosphere. Use Argentine Spanish (voseo) naturally. Keep conversations light and focus on social pleasantries."
      },
      {
        actflLevel: "intermediate_mid",
        roleDescription: "You are various party guests at a lively house party. Engage the student in deeper social conversations about life, interests, hobbies, and culture.",
        studentGoals: [
          "Navigate group conversations with multiple people",
          "Share personal stories and anecdotes",
          "Discuss hobbies, music preferences, and cultural topics",
          "Use humor and informal register appropriately",
          "Handle awkward social situations gracefully"
        ],
        vocabularyFocus: ["pasarla bien", "buena onda", "juntarse", "copado", "re", "bancar", "morfar", "birra"],
        grammarFocus: ["Past tenses for storytelling", "Argentine slang (lunfardo basics)", "Subjunctive in social invitations (espero que vengas)"],
        conversationStarters: [
          "¿Y vos qué onda? ¿Hace mucho que vivís acá? Contame tu historia.",
          "¡Qué buena música! ¿Qué tipo de música escuchás? ¿Te gusta el tango?"
        ],
        complexityNotes: "Immerse in Argentine social culture. Rotate between different party guests. Include cultural topics like football, mate, and asado."
      }
    ]
  },

  {
    slug: "dinner-with-friend",
    title: "Dinner with a Friend",
    description: "Enjoy dinner at a nice restaurant with a friend. Practice personal conversation, sharing interests, and catching up.",
    category: "social",
    location: "A nice restaurant",
    defaultMood: "warm",
    minActflLevel: "intermediate_low",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "menu",
        title: "Restaurant Menu",
        content: {
          sections: [
            {
              name: "Appetizers",
              name_target: "Entrantes",
              items: [
                { name: "Prosciutto & Melon", name_target: "Prosciutto con melón", price: "9.00", description_target: "Jamón curado con melón fresco" },
                { name: "Burrata", name_target: "Burrata fresca", price: "11.00", description_target: "Queso cremoso con tomate y albahaca" }
              ]
            },
            {
              name: "Main Courses",
              name_target: "Platos Principales",
              items: [
                { name: "Truffle Risotto", name_target: "Risotto con trufa", price: "18.00", description_target: "Arroz cremoso con trufa negra" },
                { name: "Grilled Sea Bass", name_target: "Lubina a la parrilla", price: "22.00", description_target: "Pescado fresco con verduras" },
                { name: "Florentine Steak", name_target: "Bistecca alla fiorentina", price: "35.00", description_target: "Chuletón de ternera a la brasa" }
              ]
            },
            {
              name: "Desserts",
              name_target: "Postres",
              items: [
                { name: "Panna Cotta", name_target: "Panna cotta", price: "8.00", description_target: "Crema con coulis de frambuesa" },
                { name: "Affogato", name_target: "Affogato", price: "7.00", description_target: "Helado con café espresso" }
              ]
            }
          ]
        },
        displayOrder: 0,
        isInteractive: true
      },
      {
        propType: "image",
        title: "Photo Album",
        content: {
          title: "Photo Album / Álbum de Fotos",
          fields: [
            { label: "Topic", value: "Sharing photos of travels and hobbies" },
            { label: "Conversation Prompt", value: "Show and discuss favorite memories" },
            { label: "Cultural Note", value: "Italians love sharing stories about food, family, and travel" }
          ]
        },
        displayOrder: 1,
        isInteractive: true
      }
    ],
    levelGuides: [
      {
        actflLevel: "intermediate_low",
        roleDescription: "You are a warm, friendly dinner companion at a nice restaurant. You're interested in catching up with the student, ask thoughtful questions, and share about yourself too. Keep the mood light and enjoyable.",
        studentGoals: [
          "Introduce yourself and share basic personal information",
          "Ask and answer questions about hobbies and interests",
          "Order food together and discuss preferences",
          "Share simple opinions about travel, music, or food",
          "Use polite and friendly social language"
        ],
        vocabularyFocus: ["me gusta", "tiempo libre", "aficiones", "viajar", "favorito", "interesante", "película", "cocinar"],
        grammarFocus: ["Gustar and similar verbs", "Present tense for habits", "Question formation for personal topics"],
        conversationStarters: [
          "¡Hola! Qué bonito este restaurante. ¿Habías estado aquí antes?",
          "Me alegro mucho de conocerte. Cuéntame, ¿a qué te dedicas?"
        ],
        complexityNotes: "Create a natural, comfortable dinner-with-a-friend atmosphere. Balance asking and sharing. Keep it warm and relaxed."
      },
      {
        actflLevel: "intermediate_high",
        roleDescription: "You are an engaging, culturally curious friend at a nice restaurant. You discuss deeper topics like life goals, cultural differences, and meaningful experiences. You're witty and thoughtful.",
        studentGoals: [
          "Discuss personal values, goals, and aspirations",
          "Share and react to personal stories with appropriate emotion",
          "Navigate cultural differences and show curiosity",
          "Express nuanced opinions on life, art, and society",
          "Handle unexpected moments with humor and grace"
        ],
        vocabularyFocus: ["sueños", "metas", "valores", "experiencia", "perspectiva", "cultura", "apreciar", "conexión"],
        grammarFocus: ["Subjunctive for hopes and desires", "Complex past narration", "Discourse markers for fluid conversation"],
        conversationStarters: [
          "Sabes, siempre he pensado que la comida dice mucho de una cultura. ¿Qué plato de tu país te hace sentir en casa?",
          "Me fascina que hables varios idiomas. ¿Qué es lo que más te gusta de aprender un idioma nuevo?"
        ],
        complexityNotes: "Encourage deep, personal conversation. Include cultural exchanges about Italian life. Practice expressing emotions and abstract ideas."
      }
    ]
  },

  {
    slug: "doctors-office",
    title: "Doctor's Office",
    description: "Visit the doctor to describe symptoms and understand medical advice. Practice health vocabulary and communicating discomfort.",
    category: "emergency",
    location: "A doctor's office",
    defaultMood: "concerned",
    minActflLevel: "novice_high",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "card",
        title: "Symptom Card",
        content: {
          title: "Symptom Card / Tarjeta de Síntomas",
          fields: [
            { label: "Head / Cabeza", value: "Headache, dizziness / Dolor de cabeza, mareos" },
            { label: "Throat / Garganta", value: "Sore throat, cough / Dolor de garganta, tos" },
            { label: "Stomach / Estómago", value: "Nausea, pain / Náuseas, dolor" },
            { label: "Body / Cuerpo", value: "Fever, fatigue / Fiebre, cansancio" },
            { label: "Duration / Duración", value: "Since when? / ¿Desde cuándo?" },
            { label: "Intensity (1-10)", value: "How much does it hurt? / ¿Cuánto le duele?" }
          ]
        },
        displayOrder: 0,
        isInteractive: true
      },
      {
        propType: "document",
        title: "Prescription",
        content: {
          title: "Prescription / Receta Médica",
          fields: [
            { label: "Doctor", value: "Dr. Santos" },
            { label: "Patient / Paciente", value: "(Student Name)" },
            { label: "Diagnosis / Diagnóstico", value: "(to be determined)" },
            { label: "Medication / Medicamento", value: "(to be prescribed)" },
            { label: "Dosage / Dosis", value: "(instructions)" },
            { label: "Duration / Duración", value: "(days of treatment)" },
            { label: "Follow-up / Seguimiento", value: "(return date if needed)" }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "novice_high",
        roleDescription: "You are Dr. Santos, a calm and compassionate doctor. You ask simple questions about symptoms and give clear, easy-to-understand advice. You use the symptom card to help communication.",
        studentGoals: [
          "Describe basic symptoms (head hurts, stomach hurts)",
          "Answer questions about duration and intensity",
          "Understand simple medical instructions",
          "Learn body part vocabulary",
          "Say what hurts using 'me duele'"
        ],
        vocabularyFocus: ["me duele", "cabeza", "estómago", "garganta", "fiebre", "medicina", "descansar", "tomar"],
        grammarFocus: ["Doler conjugation (me duele/me duelen)", "Desde + time expressions", "Imperative for instructions (tome, descanse)"],
        conversationStarters: [
          "Buenos días. Soy el Doctor Santos. ¿Qué le pasa? ¿Dónde le duele?",
          "Hola, pase y siéntese. Cuénteme, ¿qué síntomas tiene?"
        ],
        complexityNotes: "Use the symptom card as a visual aid. Keep medical language simple. Ask yes/no questions when needed. Use body language references."
      },
      {
        actflLevel: "intermediate_mid",
        roleDescription: "You are Dr. Santos, an experienced and thorough doctor. Conduct a complete medical consultation including patient history, examination discussion, diagnosis, and treatment plan.",
        studentGoals: [
          "Describe symptoms in detail with duration and progression",
          "Answer questions about medical history and allergies",
          "Understand a diagnosis and ask follow-up questions",
          "Discuss treatment options and express preferences",
          "Understand prescription instructions and follow-up care"
        ],
        vocabularyFocus: ["síntomas", "antecedentes", "alergia", "análisis", "tratamiento", "receta", "farmacia", "efectos secundarios"],
        grammarFocus: ["Imperfect for describing ongoing symptoms", "Present perfect for recent changes", "Subjunctive in medical recommendations"],
        conversationStarters: [
          "Buenos días. Antes de empezar, ¿tiene alguna alergia a medicamentos que deba saber?",
          "Cuénteme con detalle cuándo empezaron los síntomas y cómo han evolucionado."
        ],
        complexityNotes: "Simulate a realistic medical consultation. Include medical history questions, diagnosis explanation, and treatment discussion. Practice both understanding and explaining."
      }
    ]
  },

  {
    slug: "lost-and-found",
    title: "Lost & Found",
    description: "Report a lost item at a busy train station. Practice describing objects, explaining situations, and filling out forms.",
    category: "emergency",
    location: "A train station",
    defaultMood: "urgent",
    minActflLevel: "novice_mid",
    maxActflLevel: "intermediate_high",
    props: [
      {
        propType: "card",
        title: "Item Description Card",
        content: {
          title: "Lost Item Report / Reporte de Objeto Perdido",
          fields: [
            { label: "Item Type / Tipo de objeto", value: "(backpack, phone, wallet, etc.)" },
            { label: "Color", value: "(describe color)" },
            { label: "Brand / Marca", value: "(if applicable)" },
            { label: "Contents / Contenido", value: "(what was inside)" },
            { label: "Last Seen / Visto por última vez", value: "(location and time)" },
            { label: "Contact / Contacto", value: "(phone or email)" }
          ]
        },
        displayOrder: 0,
        isInteractive: true
      },
      {
        propType: "map",
        title: "Station Map",
        content: {
          locations: [
            { name: "Lost & Found Office", name_target: "Oficina de objetos perdidos", description: "Level 0, near platform 3" },
            { name: "Information Desk", name_target: "Mostrador de información", description: "Main hall, center" },
            { name: "Security Office", name_target: "Oficina de seguridad", description: "Level 0, east wing" },
            { name: "Platforms 1-12", name_target: "Andenes 1-12", description: "Main departure area" },
            { name: "Ticket Office", name_target: "Taquilla", description: "Main hall, west side" },
            { name: "Waiting Area", name_target: "Sala de espera", description: "Level 1, above platforms" }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "novice_mid",
        roleDescription: "You are a helpful lost-and-found clerk at a busy train station. You ask simple questions to help the student describe their lost item. You're patient and understanding about the stressful situation.",
        studentGoals: [
          "Explain that you lost something",
          "Describe the item using colors and basic adjectives",
          "Say where and when you last had it",
          "Provide contact information",
          "Understand basic instructions about the process"
        ],
        vocabularyFocus: ["perdí", "mochila", "cartera", "teléfono", "color", "grande", "pequeño", "dónde"],
        grammarFocus: ["Preterite for lost events (perdí, dejé)", "Descriptive adjectives (color, size)", "Location prepositions (en, sobre, debajo de)"],
        conversationStarters: [
          "Buenos días. ¿En qué puedo ayudarle? ¿Ha perdido algo?",
          "Hola, bienvenido a objetos perdidos. ¿Qué ha perdido?"
        ],
        complexityNotes: "Be sympathetic to the stress of losing something. Ask one question at a time. Use the item description card as a form to fill out together."
      },
      {
        actflLevel: "intermediate_low",
        roleDescription: "You are an experienced lost-and-found clerk at a busy train station who handles many cases daily. Help the student file a detailed report and discuss the recovery process, including timelines and procedures.",
        studentGoals: [
          "Describe lost item in detail including distinguishing features",
          "Narrate the sequence of events leading to the loss",
          "Understand and follow bureaucratic procedures",
          "Ask about the recovery process and timelines",
          "Express urgency and explain why the item is important"
        ],
        vocabularyFocus: ["formulario", "denuncia", "descripción", "distinguir", "contenido", "valor", "plazo", "reclamación"],
        grammarFocus: ["Past tenses for narrating events", "Describing objects with relative clauses", "Expressing urgency (es urgente que, necesito que)"],
        conversationStarters: [
          "Entiendo que es una situación estresante. Vamos a rellenar el formulario juntos. Cuénteme exactamente qué pasó.",
          "He visto que han traído varios objetos esta mañana. Descríbame el suyo con el mayor detalle posible."
        ],
        complexityNotes: "Create an authentic bureaucratic interaction. Practice filling out forms verbally. Include the possibility of the item being found or not."
      }
    ]
  },

  {
    slug: "local-festival",
    title: "Local Festival",
    description: "Experience a local cultural festival. Practice cultural vocabulary, ordering festival food, and engaging with traditions.",
    category: "cultural",
    location: "A town festival",
    defaultMood: "festive",
    minActflLevel: "intermediate_low",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "document",
        title: "Event Program",
        content: {
          title: "Festival Program / Programa del Festival",
          fields: [
            { label: "Event / Evento", value: "Local Cultural Festival 2026" },
            { label: "10:00 - Opening Ceremony", value: "Ceremonia de apertura en Plaza Independencia" },
            { label: "11:30 - Wine Tasting", value: "Degustación de vinos en la Bodega Central" },
            { label: "13:00 - Traditional Lunch", value: "Almuerzo criollo con asado y empanadas" },
            { label: "15:00 - Folklore Show", value: "Show de música y danza folclórica" },
            { label: "17:00 - Grape Harvest", value: "Cosecha simbólica de uvas" },
            { label: "20:00 - Queen Coronation", value: "Coronación de la Reina de la Vendimia" },
            { label: "22:00 - Fireworks", value: "Fuegos artificiales y cierre del festival" }
          ]
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "menu",
        title: "Food Menu",
        content: {
          sections: [
            {
              name: "Main Dishes",
              name_target: "Platos Principales",
              items: [
                { name: "Asado platter", name_target: "Tabla de asado", price: "800 ARS", description_target: "Carne a la parrilla con chimichurri" },
                { name: "Empanadas (3)", name_target: "Empanadas mendocinas (3)", price: "350 ARS", description_target: "Empanadas de carne cortada a cuchillo" },
                { name: "Choripán", name_target: "Choripán", price: "250 ARS", description_target: "Chorizo a la parrilla en pan francés" }
              ]
            },
            {
              name: "Drinks",
              name_target: "Bebidas",
              items: [
                { name: "Malbec Wine (glass)", name_target: "Copa de Malbec", price: "400 ARS", description_target: "Malbec de la región" },
                { name: "Fresh Grape Juice", name_target: "Jugo de uva natural", price: "200 ARS", description_target: "Jugo fresco de uva" },
                { name: "Mate", name_target: "Mate", price: "150 ARS", description_target: "Mate con yerba premium" }
              ]
            },
            {
              name: "Desserts",
              name_target: "Postres",
              items: [
                { name: "Alfajores", name_target: "Alfajores de dulce de leche", price: "200 ARS", description_target: "Galletas rellenas de dulce de leche" },
                { name: "Grape Ice Cream", name_target: "Helado de uva", price: "250 ARS", description_target: "Helado artesanal de uva mendocina" }
              ]
            }
          ]
        },
        displayOrder: 1,
        isInteractive: true
      }
    ],
    levelGuides: [
      {
        actflLevel: "intermediate_low",
        roleDescription: "You are a friendly local at a cultural festival. You love sharing your culture and explaining traditions to visitors. You speak with warmth and enthusiasm.",
        studentGoals: [
          "Ask about festival events and schedule",
          "Order food and drinks at festival stalls",
          "Discuss Argentine wine culture and traditions",
          "Express enjoyment and ask about customs",
          "Navigate the festival using the program"
        ],
        vocabularyFocus: ["vendimia", "cosecha", "uva", "bodega", "vino", "tradición", "folclore", "festejo"],
        grammarFocus: ["Present tense for describing traditions", "Gustar/encantar for expressing enjoyment", "Voseo in informal conversation"],
        conversationStarters: [
          "¡Bienvenido a la Vendimia! ¿Es tu primera vez en Mendoza? ¡Tenés que probar el Malbec de acá!",
          "¿Viste el programa? El show de folclore de las tres es increíble. ¿Querés ir juntos?"
        ],
        complexityNotes: "Immerse in Argentine festival culture. Use voseo naturally. Discuss wine, food, and local traditions with enthusiasm."
      },
      {
        actflLevel: "intermediate_high",
        roleDescription: "You are a local sommelier and cultural guide at a town festival. You discuss wine-making processes, regional history, and the cultural significance of the harvest festival in depth.",
        studentGoals: [
          "Discuss wine production processes and terroir",
          "Compare regional traditions with other cultures",
          "Express nuanced opinions about cultural events",
          "Narrate the history and significance of the Vendimia",
          "Engage in debates about tradition vs modernity"
        ],
        vocabularyFocus: ["terroir", "cepa", "maduración", "patrimonio", "identidad", "arraigo", "sustentable", "ancestral"],
        grammarFocus: ["Subjunctive in value judgments", "Passive voice for describing processes", "Complex past tense narration"],
        conversationStarters: [
          "El Malbec mendocino tiene una historia fascinante. ¿Sabías que la cepa vino de Francia pero aquí encontró su verdadera expresión?",
          "¿Qué te parece la forma en que se celebra la vendimia? ¿Tienen algo similar en tu país?"
        ],
        complexityNotes: "Deep cultural discussion. Explore themes of identity, tradition, and globalization through the lens of wine culture and festivals."
      }
    ]
  },

  {
    slug: "museum-visit",
    title: "Museum Visit",
    description: "Explore a famous art museum. Practice describing art, expressing opinions, and discussing history and culture.",
    category: "cultural",
    location: "An art museum",
    defaultMood: "contemplative",
    minActflLevel: "intermediate_mid",
    maxActflLevel: "advanced_high",
    props: [
      {
        propType: "document",
        title: "Exhibit Guide",
        content: {
          title: "Exhibit Guide / Guía de la Exposición",
          fields: [
            { label: "Museum / Museo", value: "Art Museum" },
            { label: "Gallery 1", value: "Las Meninas - Diego Velázquez (1656)" },
            { label: "Gallery 2", value: "El Tres de Mayo - Francisco de Goya (1814)" },
            { label: "Gallery 3", value: "The Garden of Earthly Delights - El Bosco (1500)" },
            { label: "Gallery 4", value: "The Annunciation - Fra Angelico (1426)" },
            { label: "Special Exhibition", value: "Sorolla: Light and Color (temporary)" },
            { label: "Hours / Horario", value: "Mon-Sat 10:00-20:00, Sun 10:00-17:00" },
            { label: "Audio Guide", value: "Available in 12 languages / Disponible en 12 idiomas" }
          ]
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Audio Tour Notes",
        content: {
          title: "Audio Tour Notes / Notas del Audio Tour",
          fields: [
            { label: "Las Meninas", value: "A painting within a painting. Velázquez places himself in the scene, challenging the viewer's perspective." },
            { label: "El Tres de Mayo", value: "Goya's powerful anti-war statement. The central figure's white shirt and outstretched arms create a Christ-like image." },
            { label: "The Garden", value: "A triptych depicting paradise, earthly pleasures, and hell. Full of symbolic creatures and surreal imagery." },
            { label: "Discussion Prompt", value: "Which painting moves you most? Why?" }
          ]
        },
        displayOrder: 1,
        isInteractive: false
      }
    ],
    levelGuides: [
      {
        actflLevel: "intermediate_mid",
        roleDescription: "You are an enthusiastic museum guide at an art museum. You love making art accessible and engaging. You explain paintings with vivid descriptions and ask the student to share their reactions.",
        studentGoals: [
          "Describe what you see in a painting",
          "Express opinions and emotional reactions to art",
          "Ask questions about artists and historical context",
          "Compare different artworks and styles",
          "Navigate the museum using the exhibit guide"
        ],
        vocabularyFocus: ["cuadro", "pintor", "obra", "siglo", "estilo", "color", "luz", "escena", "impresionar"],
        grammarFocus: ["Descriptive adjectives and agreement", "Expressing opinions (me parece, creo que)", "Past tenses for historical narration"],
        conversationStarters: [
          "Estamos frente a Las Meninas de Velázquez. ¿Qué es lo primero que te llama la atención?",
          "Bienvenido al Prado. ¿Qué tipo de arte te interesa más? ¿Tenés algún pintor favorito?"
        ],
        complexityNotes: "Make art discussion accessible. Use paintings as conversation starters. Connect art to everyday emotions and experiences."
      },
      {
        actflLevel: "advanced_low",
        roleDescription: "You are an art history professor giving a special guided tour at an art museum. You discuss technique, historical context, symbolism, and the evolution of art in depth.",
        studentGoals: [
          "Analyze artistic technique and composition",
          "Discuss historical and political context of artworks",
          "Interpret symbolism and hidden meanings",
          "Compare artistic movements and their social impact",
          "Express complex aesthetic judgments with supporting arguments"
        ],
        vocabularyFocus: ["composición", "perspectiva", "simbolismo", "barroco", "claroscuro", "mecenas", "vanguardia", "patrimonio"],
        grammarFocus: ["Subjunctive in aesthetic judgments", "Complex relative clauses for description", "Hypothetical conditionals for art interpretation"],
        conversationStarters: [
          "Observe cómo Velázquez manipula la perspectiva en Las Meninas. ¿Quién es realmente el sujeto de esta obra?",
          "Goya pintó El Tres de Mayo seis años después de los hechos. ¿Por qué cree que esperó tanto? ¿Qué efecto tiene esa distancia temporal?"
        ],
        complexityNotes: "Engage in sophisticated art criticism. Discuss the relationship between art and power, art and society. Push for analytical thinking in Spanish."
      }
    ]
  }
];

async function seed() {
  console.log('Starting scenario seed...');
  console.log(`Seeding ${scenarioData.length} scenarios...`);

  let seededCount = 0;

  for (const s of scenarioData) {
    console.log(`  Seeding: ${s.slug} - "${s.title}"...`);

    const [upsertedScenario] = await db.insert(scenarios)
      .values({
        slug: s.slug,
        title: s.title,
        description: s.description,
        category: s.category,
        location: s.location,
        defaultMood: s.defaultMood,
        minActflLevel: s.minActflLevel,
        maxActflLevel: s.maxActflLevel,
        languages: ALL_LANGUAGES,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: scenarios.slug,
        set: {
          title: s.title,
          description: s.description,
          category: s.category,
          location: s.location,
          defaultMood: s.defaultMood,
          minActflLevel: s.minActflLevel,
          maxActflLevel: s.maxActflLevel,
          languages: ALL_LANGUAGES,
          isActive: true,
        },
      })
      .returning();

    const scenarioId = upsertedScenario.id;

    await db.delete(scenarioProps).where(eq(scenarioProps.scenarioId, scenarioId));
    await db.delete(scenarioLevelGuides).where(eq(scenarioLevelGuides.scenarioId, scenarioId));

    if (s.props.length > 0) {
      await db.insert(scenarioProps).values(
        s.props.map(p => ({
          scenarioId,
          propType: p.propType,
          title: p.title,
          content: p.content,
          displayOrder: p.displayOrder,
          isInteractive: p.isInteractive,
        }))
      );
    }

    if (s.levelGuides.length > 0) {
      await db.insert(scenarioLevelGuides).values(
        s.levelGuides.map(lg => ({
          scenarioId,
          actflLevel: lg.actflLevel,
          roleDescription: lg.roleDescription,
          studentGoals: lg.studentGoals,
          vocabularyFocus: lg.vocabularyFocus,
          grammarFocus: lg.grammarFocus,
          conversationStarters: lg.conversationStarters,
          complexityNotes: lg.complexityNotes,
        }))
      );
    }

    seededCount++;
    console.log(`    Done: ${s.props.length} props, ${s.levelGuides.length} level guides`);
  }

  console.log(`\nSeeding complete! ${seededCount} scenarios seeded.`);
  await pool.end();
  console.log('Database pool closed.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  pool.end();
  process.exit(1);
});

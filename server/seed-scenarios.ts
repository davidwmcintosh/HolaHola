import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { scenarios, scenarioProps, scenarioLevelGuides } from '@shared/schema';
import { coffeeShopMenus, groceryStoreMenus } from './data/language-menus-cafe-grocery';
import { restaurantMenus, localFestivalMenus } from './data/language-menus-restaurant-festival';

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
          byLanguage: coffeeShopMenus,
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
          byDifficulty: {
            beginner: {
              title: "Receipt / Recibo",
              fields: [
                { label: "Store / Establecimiento", value: "The Coffee Shop" },
                { label: "Date / Fecha", value: "Today" },
                { label: "Items / Artículos", value: "(dynamic)" },
                { label: "Subtotal", value: "0.00€" },
                { label: "Tax / Impuesto (IVA 10%)", value: "0.00€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            intermediate: {
              title: "Recibo de Compra",
              fields: [
                { label: "Establecimiento", value: "The Coffee Shop" },
                { label: "Fecha", value: "Hoy" },
                { label: "Artículos", value: "(dynamic)" },
                { label: "Subtotal", value: "0.00€" },
                { label: "IVA (10%)", value: "0.00€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            advanced: {
              title: "Ticket de Caja",
              fields: [
                { label: "Establecimiento", value: "The Coffee Shop" },
                { label: "Fecha", value: "Hoy" },
                { label: "Detalle de consumo", value: "(dynamic)" },
                { label: "Base imponible", value: "0.00€" },
                { label: "IVA (10%)", value: "0.00€" },
                { label: "Total a pagar", value: "0.00€" }
              ]
            }
          }
        },
        displayOrder: 1,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Daily Specials",
        content: {
          byDifficulty: {
            beginner: {
              title: "Today's Specials / Ofertas del Día",
              fields: [
                { label: "Featured Coffee / Café destacado", value: "Colombian pour-over coffee — €3.80" },
                { label: "Seasonal Drink / Bebida de temporada", value: "Iced matcha latte — €4.20" },
                { label: "Fresh Pastry / Bollería fresca", value: "Almond croissant — €2.80" },
                { label: "Lunch Combo / Menú del día", value: "Sandwich + coffee + pastry — €7.50" },
                { label: "Happy Hour (16-18h)", value: "2nd drink half price" }
              ]
            },
            intermediate: {
              title: "Ofertas del Día",
              fields: [
                { label: "Café destacado", value: "Café de Colombia de origen único, preparado en pour-over — €3.80" },
                { label: "Bebida de temporada", value: "Matcha latte frío con leche de avena — €4.20" },
                { label: "Bollería fresca", value: "Cruasán de almendras recién horneado — €2.80" },
                { label: "Menú del día", value: "Bocadillo + café + bollería — €7.50" },
                { label: "Hora feliz (16-18h)", value: "2ª bebida a mitad de precio" }
              ]
            },
            advanced: {
              title: "Sugerencias de la Casa",
              fields: [
                { label: "Selección del barista", value: "Café de origen colombiano, filtrado artesanalmente en pour-over — €3.80" },
                { label: "Creación de temporada", value: "Matcha latte glacé con leche de avena y un toque de vainilla — €4.20" },
                { label: "Del obrador", value: "Cruasán de almendra tostada, glaseado con almíbar — €2.80" },
                { label: "Menú mediodía", value: "Bocadillo artesano + café del día + bollería de la casa — €7.50" },
                { label: "Hora dorada (16-18h)", value: "Segunda consumición al 50%" }
              ]
            }
          }
        },
        displayOrder: 2,
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
          byLanguage: groceryStoreMenus,
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
      },
      {
        propType: "bill",
        title: "Receipt/Bill",
        content: {
          byDifficulty: {
            beginner: {
              title: "Receipt / Recibo",
              fields: [
                { label: "Store / Establecimiento", value: "Local Market" },
                { label: "Date / Fecha", value: "Today" },
                { label: "Items / Artículos", value: "(dynamic)" },
                { label: "Subtotal", value: "0.00€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            intermediate: {
              title: "Recibo de Compra",
              fields: [
                { label: "Establecimiento", value: "Local Market" },
                { label: "Fecha", value: "Hoy" },
                { label: "Artículos", value: "(dynamic)" },
                { label: "Subtotal", value: "0.00€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            advanced: {
              title: "Ticket de Compra",
              fields: [
                { label: "Establecimiento", value: "Local Market" },
                { label: "Fecha", value: "Hoy" },
                { label: "Detalle de productos", value: "(dynamic)" },
                { label: "Base imponible", value: "0.00€" },
                { label: "Total a pagar", value: "0.00€" }
              ]
            }
          }
        },
        displayOrder: 2,
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
          byLanguage: restaurantMenus,
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
          byDifficulty: {
            beginner: {
              title: "Check / Cuenta",
              fields: [
                { label: "Table / Mesa", value: "Mesa 7" },
                { label: "Server / Camarero", value: "Marco" },
                { label: "Items / Artículos", value: "(dynamic)" },
                { label: "Subtotal", value: "0.00€" },
                { label: "Cover Charge / Cubierto", value: "2.50€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            intermediate: {
              title: "Cuenta del Restaurante",
              fields: [
                { label: "Mesa", value: "Mesa 7" },
                { label: "Camarero", value: "Marco" },
                { label: "Consumiciones", value: "(dynamic)" },
                { label: "Subtotal", value: "0.00€" },
                { label: "Servicio de mesa (coperto)", value: "2.50€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            advanced: {
              title: "Nota de Consumo",
              fields: [
                { label: "Mesa", value: "Mesa 7" },
                { label: "Atendido por", value: "Marco" },
                { label: "Detalle de consumiciones", value: "(dynamic)" },
                { label: "Base imponible", value: "0.00€" },
                { label: "Servicio de cubierto", value: "2.50€" },
                { label: "Total a pagar", value: "0.00€" }
              ]
            }
          }
        },
        displayOrder: 1,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Daily Specials",
        content: {
          byDifficulty: {
            beginner: {
              title: "Today's Specials / Platos del Día",
              fields: [
                { label: "Chef's Starter / Entrante del chef", value: "Burrata with roasted peppers — €9.50" },
                { label: "Soup of the Day / Sopa del día", value: "Minestrone — €6.00" },
                { label: "Today's Catch / Pescado del día", value: "Grilled sea bass with lemon — €16.00" },
                { label: "Special Pasta / Pasta especial", value: "Truffle ravioli — €14.50" },
                { label: "Dessert Special / Postre del día", value: "Limoncello semifreddo — €7.50" },
                { label: "Wine Pairing / Maridaje", value: "Vermentino di Sardegna (glass) — €6.00" }
              ]
            },
            intermediate: {
              title: "Sugerencias del Día",
              fields: [
                { label: "Entrante del chef", value: "Burrata cremosa con pimientos asados y rúcula — €9.50" },
                { label: "Sopa del día", value: "Minestrone con verduras de temporada — €6.00" },
                { label: "Pescado del día", value: "Lubina a la plancha con limón y hierbas — €16.00" },
                { label: "Pasta especial", value: "Ravioli rellenos de trufa negra con mantequilla — €14.50" },
                { label: "Postre del día", value: "Semifrío de limoncello con ralladura de limón — €7.50" },
                { label: "Maridaje", value: "Vermentino di Sardegna (copa) — €6.00" }
              ]
            },
            advanced: {
              title: "Le Proposte dello Chef",
              fields: [
                { label: "Entrante de la casa", value: "Burrata pugliese sobre lecho de pimientos del piquillo asados al carbón, con rúcula silvestre y reducción de balsámico — €9.50" },
                { label: "De la olla", value: "Minestrone alla genovese, con verduras de la huerta del día — €6.00" },
                { label: "Del mar", value: "Lubina salvaje a la plancha, servida con emulsión de limón de Amalfi y alcaparras de Pantelleria — €16.00" },
                { label: "Primo piatto", value: "Ravioli artigianali rellenos de trufa negra del Périgord, con mantequilla nocciola y parmigiano — €14.50" },
                { label: "Dolce della casa", value: "Semifreddo al limoncello di Sorrento con crumble de almendra y coulis de frutos rojos — €7.50" },
                { label: "In abbinamento", value: "Vermentino di Sardegna DOC, cosecha 2024 (copa) — €6.00" }
              ]
            }
          }
        },
        displayOrder: 2,
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
          byDifficulty: {
            beginner: {
              title: "Boarding Pass / Tarjeta de Embarque",
              fields: [
                { label: "Passenger / Pasajero", value: "(Student Name)" },
                { label: "Flight / Vuelo", value: "IB 3214" },
                { label: "From / Origen", value: "Madrid (MAD)" },
                { label: "To / Destino", value: "Barcelona (BCN)" },
                { label: "Date / Fecha", value: "18 Feb 2026" },
                { label: "Gate / Puerta", value: "B22" },
                { label: "Seat / Asiento", value: "14A" },
                { label: "Boarding Time / Embarque", value: "10:30" },
                { label: "Departure / Salida", value: "11:15" }
              ]
            },
            intermediate: {
              title: "Tarjeta de Embarque",
              fields: [
                { label: "Pasajero", value: "(Student Name)" },
                { label: "Vuelo", value: "IB 3214" },
                { label: "Origen", value: "Madrid (MAD)" },
                { label: "Destino", value: "Barcelona (BCN)" },
                { label: "Fecha", value: "18 Feb 2026" },
                { label: "Puerta de embarque", value: "B22" },
                { label: "Asiento", value: "14A" },
                { label: "Hora de embarque", value: "10:30" },
                { label: "Hora de salida", value: "11:15" }
              ]
            },
            advanced: {
              title: "Tarjeta de Embarque — Iberia",
              fields: [
                { label: "Nombre del pasajero", value: "(Student Name)" },
                { label: "N.º de vuelo", value: "IB 3214" },
                { label: "Aeropuerto de origen", value: "Madrid-Barajas Adolfo Suárez (MAD)" },
                { label: "Aeropuerto de destino", value: "Barcelona-El Prat Josep Tarradellas (BCN)" },
                { label: "Fecha de viaje", value: "18 Feb 2026" },
                { label: "Puerta", value: "B22" },
                { label: "Plaza asignada", value: "14A — Ventanilla" },
                { label: "Inicio de embarque", value: "10:30 h" },
                { label: "Salida prevista", value: "11:15 h" }
              ]
            }
          }
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
      },
      {
        propType: "card",
        title: "Passport",
        content: {
          byDifficulty: {
            beginner: {
              title: "Passport / Pasaporte",
              fields: [
                { label: "Country / País", value: "United States" },
                { label: "Last Name / Apellido", value: "(Student Name)" },
                { label: "First Name / Nombre", value: "(Student Name)" },
                { label: "Passport Number / Nº Pasaporte", value: "X12345678" },
                { label: "Date of Birth / Nacimiento", value: "15 Mar 1995" },
                { label: "Expiry Date / Vencimiento", value: "22 Jun 2030" },
                { label: "Nationality / Nacionalidad", value: "American" }
              ]
            },
            intermediate: {
              title: "Pasaporte",
              fields: [
                { label: "País emisor", value: "United States" },
                { label: "Apellido", value: "(Student Name)" },
                { label: "Nombre", value: "(Student Name)" },
                { label: "Nº de pasaporte", value: "X12345678" },
                { label: "Fecha de nacimiento", value: "15 Mar 1995" },
                { label: "Fecha de vencimiento", value: "22 Jun 2030" },
                { label: "Nacionalidad", value: "Estadounidense" }
              ]
            },
            advanced: {
              title: "Documento de Viaje — Pasaporte",
              fields: [
                { label: "País de expedición", value: "United States of America" },
                { label: "Apellidos", value: "(Student Name)" },
                { label: "Nombres de pila", value: "(Student Name)" },
                { label: "Número de pasaporte", value: "X12345678" },
                { label: "Fecha de nacimiento", value: "15 Mar 1995" },
                { label: "Válido hasta", value: "22 Jun 2030" },
                { label: "Nacionalidad", value: "Estadounidense" }
              ]
            }
          }
        },
        displayOrder: 2,
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
          byDifficulty: {
            beginner: {
              title: "Room Key Card / Tarjeta de Habitación",
              fields: [
                { label: "Guest / Huésped", value: "(Student Name)" },
                { label: "Room / Habitación", value: "412" },
                { label: "Floor / Piso", value: "4th" },
                { label: "Check-in", value: "18 Feb 2026, 15:00" },
                { label: "Check-out", value: "21 Feb 2026, 11:00" },
                { label: "Wi-Fi Password / Contraseña Wi-Fi", value: "Hotel2026" },
                { label: "Breakfast / Desayuno", value: "7:00 - 10:30, Main Dining Room" }
              ]
            },
            intermediate: {
              title: "Tarjeta de Habitación",
              fields: [
                { label: "Huésped", value: "(Student Name)" },
                { label: "Habitación", value: "412" },
                { label: "Planta", value: "4ª planta" },
                { label: "Fecha de entrada", value: "18 Feb 2026, 15:00" },
                { label: "Fecha de salida", value: "21 Feb 2026, 11:00" },
                { label: "Contraseña Wi-Fi", value: "Hotel2026" },
                { label: "Desayuno", value: "7:00 - 10:30, Comedor principal" }
              ]
            },
            advanced: {
              title: "Llave Electrónica de Habitación",
              fields: [
                { label: "Nombre del huésped", value: "(Student Name)" },
                { label: "N.º de habitación", value: "412" },
                { label: "Planta", value: "Cuarta planta" },
                { label: "Registro de entrada", value: "18 Feb 2026, 15:00 h" },
                { label: "Registro de salida", value: "21 Feb 2026, 11:00 h" },
                { label: "Clave de acceso Wi-Fi", value: "Hotel2026" },
                { label: "Servicio de desayuno", value: "De 7:00 a 10:30 h — Salón comedor principal" }
              ]
            }
          }
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
      },
      {
        propType: "bill",
        title: "Hotel Invoice",
        content: {
          byDifficulty: {
            beginner: {
              title: "Hotel Bill / Factura del Hotel",
              fields: [
                { label: "Hotel / Establecimiento", value: "Grand Hotel" },
                { label: "Guest / Huésped", value: "(Student Name)" },
                { label: "Room / Habitación", value: "412" },
                { label: "Nights / Noches", value: "3" },
                { label: "Room Charge / Cargo habitación", value: "(dynamic)" },
                { label: "Extras", value: "(dynamic)" },
                { label: "Tax / Impuesto (IVA 10%)", value: "0.00€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            intermediate: {
              title: "Factura del Hotel",
              fields: [
                { label: "Establecimiento", value: "Grand Hotel" },
                { label: "Huésped", value: "(Student Name)" },
                { label: "Habitación", value: "412" },
                { label: "Noches", value: "3" },
                { label: "Cargo por alojamiento", value: "(dynamic)" },
                { label: "Servicios adicionales", value: "(dynamic)" },
                { label: "IVA (10%)", value: "0.00€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            advanced: {
              title: "Factura de Alojamiento",
              fields: [
                { label: "Establecimiento hotelero", value: "Grand Hotel" },
                { label: "Nombre del huésped", value: "(Student Name)" },
                { label: "N.º de habitación", value: "412" },
                { label: "Estancia (noches)", value: "3" },
                { label: "Tarifa de alojamiento", value: "(dynamic)" },
                { label: "Cargos por servicios complementarios", value: "(dynamic)" },
                { label: "IVA (10%)", value: "0.00€" },
                { label: "Importe total", value: "0.00€" }
              ]
            }
          }
        },
        displayOrder: 2,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Guest Registration Card",
        content: {
          byDifficulty: {
            beginner: {
              title: "Guest Registration Card / Ficha de Registro",
              fields: [
                { label: "Full Name / Nombre completo", value: "(to be filled)" },
                { label: "Nationality / Nacionalidad", value: "(to be filled)" },
                { label: "Passport Number / Nº Pasaporte", value: "(to be filled)" },
                { label: "Check-in Date / Fecha entrada", value: "18 Feb 2026" },
                { label: "Check-out Date / Fecha salida", value: "21 Feb 2026" },
                { label: "Room Type / Tipo habitación", value: "Double" },
                { label: "Special Requests / Peticiones especiales", value: "(to be filled)" },
                { label: "Signature / Firma", value: "________________" }
              ]
            },
            intermediate: {
              title: "Ficha de Registro de Huésped",
              fields: [
                { label: "Nombre completo", value: "(to be filled)" },
                { label: "Nacionalidad", value: "(to be filled)" },
                { label: "Nº de pasaporte", value: "(to be filled)" },
                { label: "Fecha de entrada", value: "18 Feb 2026" },
                { label: "Fecha de salida", value: "21 Feb 2026" },
                { label: "Tipo de habitación", value: "Doble" },
                { label: "Peticiones especiales", value: "(to be filled)" },
                { label: "Firma del huésped", value: "________________" }
              ]
            },
            advanced: {
              title: "Parte de Entrada de Viajeros",
              fields: [
                { label: "Nombre y apellidos", value: "(to be filled)" },
                { label: "Nacionalidad", value: "(to be filled)" },
                { label: "Número de documento de identidad / Pasaporte", value: "(to be filled)" },
                { label: "Fecha de ingreso", value: "18 Feb 2026" },
                { label: "Fecha prevista de salida", value: "21 Feb 2026" },
                { label: "Categoría de habitación", value: "Habitación doble estándar" },
                { label: "Observaciones y solicitudes del huésped", value: "(to be filled)" },
                { label: "Firma del titular", value: "________________" }
              ]
            }
          }
        },
        displayOrder: 3,
        isInteractive: true
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
          byDifficulty: {
            beginner: {
              title: "Taxi Fare / Tarifa del Taxi",
              fields: [
                { label: "Base Fare / Banderazo", value: "$13.10 MXN" },
                { label: "Per km / Por kilómetro", value: "$5.40 MXN" },
                { label: "Per minute (waiting) / Por minuto (espera)", value: "$1.84 MXN" },
                { label: "Night surcharge / Recargo nocturno", value: "+20%" },
                { label: "Estimated total / Total estimado", value: "(varies by destination)" }
              ]
            },
            intermediate: {
              title: "Tarifa del Taxi",
              fields: [
                { label: "Banderazo", value: "$13.10 MXN" },
                { label: "Por kilómetro", value: "$5.40 MXN" },
                { label: "Por minuto de espera", value: "$1.84 MXN" },
                { label: "Recargo nocturno", value: "+20%" },
                { label: "Total estimado", value: "(varía según destino)" }
              ]
            },
            advanced: {
              title: "Taxímetro — Tarifas Vigentes",
              fields: [
                { label: "Bajada de bandera", value: "$13.10 MXN" },
                { label: "Tarifa por kilómetro recorrido", value: "$5.40 MXN" },
                { label: "Tiempo de espera por minuto", value: "$1.84 MXN" },
                { label: "Recargo por servicio nocturno (22:00–06:00)", value: "+20%" },
                { label: "Importe estimado del servicio", value: "(variable según trayecto)" }
              ]
            }
          }
        },
        displayOrder: 1,
        isInteractive: false
      },
      {
        propType: "bill",
        title: "Taxi Receipt",
        content: {
          byDifficulty: {
            beginner: {
              title: "Taxi Receipt / Recibo de Taxi",
              fields: [
                { label: "Driver / Conductor", value: "(dynamic)" },
                { label: "From / Origen", value: "(dynamic)" },
                { label: "To / Destino", value: "(dynamic)" },
                { label: "Distance / Distancia", value: "(dynamic)" },
                { label: "Fare / Tarifa", value: "$0.00 MXN" },
                { label: "Tip / Propina", value: "$0.00 MXN" },
                { label: "Total", value: "$0.00 MXN" }
              ]
            },
            intermediate: {
              title: "Recibo de Taxi",
              fields: [
                { label: "Conductor", value: "(dynamic)" },
                { label: "Origen", value: "(dynamic)" },
                { label: "Destino", value: "(dynamic)" },
                { label: "Distancia recorrida", value: "(dynamic)" },
                { label: "Tarifa", value: "$0.00 MXN" },
                { label: "Propina", value: "$0.00 MXN" },
                { label: "Total", value: "$0.00 MXN" }
              ]
            },
            advanced: {
              title: "Comprobante de Servicio de Taxi",
              fields: [
                { label: "Nombre del operador", value: "(dynamic)" },
                { label: "Punto de abordaje", value: "(dynamic)" },
                { label: "Punto de descenso", value: "(dynamic)" },
                { label: "Kilometraje recorrido", value: "(dynamic)" },
                { label: "Importe del servicio", value: "$0.00 MXN" },
                { label: "Propina", value: "$0.00 MXN" },
                { label: "Total a pagar", value: "$0.00 MXN" }
              ]
            }
          }
        },
        displayOrder: 2,
        isInteractive: false
      },
      {
        propType: "card",
        title: "Hotel Business Card",
        content: {
          byDifficulty: {
            beginner: {
              title: "Hotel Business Card / Tarjeta del Hotel",
              fields: [
                { label: "Hotel", value: "Hotel Zócalo Centro" },
                { label: "Address / Dirección", value: "Av. 5 de Mayo 61, Centro Histórico, CDMX" },
                { label: "Phone / Teléfono", value: "+52 55 5130 5130" },
                { label: "Near / Cerca de", value: "Zócalo, Templo Mayor, Palacio Nacional" },
                { label: "Metro", value: "Línea 2 - Estación Zócalo" }
              ]
            },
            intermediate: {
              title: "Tarjeta del Hotel",
              fields: [
                { label: "Hotel", value: "Hotel Zócalo Centro" },
                { label: "Dirección", value: "Av. 5 de Mayo 61, Centro Histórico, CDMX" },
                { label: "Teléfono", value: "+52 55 5130 5130" },
                { label: "Puntos de interés cercanos", value: "Zócalo, Templo Mayor, Palacio Nacional" },
                { label: "Estación de metro", value: "Línea 2 - Estación Zócalo" }
              ]
            },
            advanced: {
              title: "Hotel Zócalo Centro — Tarjeta de Presentación",
              fields: [
                { label: "Establecimiento", value: "Hotel Zócalo Centro" },
                { label: "Domicilio", value: "Av. 5 de Mayo 61, Col. Centro Histórico, Alcaldía Cuauhtémoc, C.P. 06000, CDMX" },
                { label: "Conmutador", value: "+52 55 5130 5130" },
                { label: "Ubicación privilegiada", value: "A pasos del Zócalo capitalino, Templo Mayor y Palacio Nacional" },
                { label: "Transporte público", value: "Metro Línea 2 — Estación Zócalo (salida Centro Histórico)" }
              ]
            }
          }
        },
        displayOrder: 3,
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
          byDifficulty: {
            beginner: {
              title: "Resume / Curriculum Vitae",
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
            intermediate: {
              title: "Curriculum Vitae",
              fields: [
                { label: "Nombre completo", value: "(Student Name)" },
                { label: "Puesto solicitado", value: "Coordinador/a de Marketing" },
                { label: "Formación académica", value: "Licenciatura en Administración de Empresas" },
                { label: "Experiencia profesional", value: "3 años en marketing digital" },
                { label: "Competencias", value: "Redes sociales, análisis de datos, creación de contenido" },
                { label: "Idiomas", value: "Inglés (nativo), español (intermedio)" },
                { label: "Referencias", value: "Disponibles a solicitud" }
              ]
            },
            advanced: {
              title: "Curriculum Vitae",
              fields: [
                { label: "Datos personales", value: "(Student Name)" },
                { label: "Cargo al que aspira", value: "Coordinador/a de Marketing" },
                { label: "Formación académica", value: "Grado en Administración y Dirección de Empresas" },
                { label: "Trayectoria profesional", value: "Tres años de experiencia en estrategia de marketing digital, gestión de campañas y optimización de contenidos" },
                { label: "Competencias clave", value: "Gestión de redes sociales, análisis de métricas y KPIs, producción de contenido multimedia" },
                { label: "Perfil lingüístico", value: "Inglés (lengua materna), español (nivel intermedio — B1/B2)" },
                { label: "Referencias profesionales", value: "Se facilitan a petición de la empresa" }
              ]
            }
          }
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Job Posting",
        content: {
          byDifficulty: {
            beginner: {
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
            intermediate: {
              title: "Oferta de Empleo",
              fields: [
                { label: "Empresa", value: "The Company" },
                { label: "Puesto", value: "Coordinador/a de Marketing" },
                { label: "Modalidad", value: "Híbrido / Remoto" },
                { label: "Salario", value: "€45,000 - €55,000" },
                { label: "Requisitos", value: "Más de 2 años de experiencia en marketing, perfil bilingüe, orientación analítica" },
                { label: "Beneficios", value: "Horario flexible, membresía de gimnasio, cursos de idiomas" },
                { label: "Fecha de incorporación", value: "April 2026" }
              ]
            },
            advanced: {
              title: "Convocatoria de Empleo — Recursos Humanos",
              fields: [
                { label: "Razón social", value: "The Company" },
                { label: "Vacante", value: "Coordinador/a de Marketing" },
                { label: "Modalidad de trabajo", value: "Formato híbrido con opción de teletrabajo" },
                { label: "Banda salarial", value: "€45,000 - €55,000 brutos anuales" },
                { label: "Perfil requerido", value: "Mínimo dos años de experiencia demostrable en marketing digital, dominio bilingüe español-inglés, capacidad analítica y orientación a resultados" },
                { label: "Paquete de beneficios", value: "Jornada flexible, abono a centro deportivo, formación continua en idiomas" },
                { label: "Incorporación prevista", value: "April 2026" }
              ]
            }
          }
        },
        displayOrder: 1,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Job Description",
        content: {
          byDifficulty: {
            beginner: {
              title: "Job Description / Descripción del Puesto",
              fields: [
                { label: "Title / Puesto", value: "Marketing Coordinator" },
                { label: "Department / Departamento", value: "Marketing & Communications" },
                { label: "Reports To / Reporta a", value: "VP of Marketing" },
                { label: "Responsibilities / Responsabilidades", value: "Lead social media strategy, manage campaigns, analyze performance data, coordinate with design team" },
                { label: "Requirements / Requisitos", value: "2+ years marketing experience, bilingual (Spanish/English), proficiency in analytics tools" },
                { label: "Benefits / Beneficios", value: "Flexible hours, gym membership, language courses, 25 vacation days" },
                { label: "Salary Range / Rango salarial", value: "€45,000 - €55,000" },
                { label: "Start Date / Inicio", value: "April 2026" }
              ]
            },
            intermediate: {
              title: "Descripción del Puesto",
              fields: [
                { label: "Puesto", value: "Coordinador/a de Marketing" },
                { label: "Departamento", value: "Marketing y Comunicación" },
                { label: "Dependencia jerárquica", value: "VP of Marketing" },
                { label: "Responsabilidades", value: "Liderar la estrategia de redes sociales, gestionar campañas, analizar datos de rendimiento, coordinar con el equipo de diseño" },
                { label: "Requisitos", value: "Más de 2 años de experiencia en marketing, bilingüe español-inglés, dominio de herramientas analíticas" },
                { label: "Beneficios", value: "Horario flexible, membresía de gimnasio, cursos de idiomas, 25 días de vacaciones" },
                { label: "Rango salarial", value: "€45,000 - €55,000" },
                { label: "Fecha de incorporación", value: "April 2026" }
              ]
            },
            advanced: {
              title: "Ficha Descriptiva del Puesto — Dirección de Personas",
              fields: [
                { label: "Denominación del puesto", value: "Coordinador/a de Marketing" },
                { label: "Área funcional", value: "Dirección de Marketing y Comunicación Corporativa" },
                { label: "Dependencia orgánica", value: "Vicepresidencia de Marketing" },
                { label: "Funciones y responsabilidades", value: "Diseño y ejecución de la estrategia de presencia en redes sociales, planificación y supervisión de campañas digitales, análisis de indicadores de rendimiento (KPIs), y coordinación interdepartamental con el equipo creativo" },
                { label: "Requisitos del perfil", value: "Experiencia mínima de dos años en marketing digital, competencia bilingüe español-inglés acreditada, y manejo avanzado de plataformas de analítica web" },
                { label: "Condiciones y beneficios", value: "Jornada flexible, acceso a centro deportivo, plan de formación en idiomas, y 25 días hábiles de vacaciones anuales" },
                { label: "Retribución bruta anual", value: "€45,000 - €55,000" },
                { label: "Incorporación prevista", value: "April 2026" }
              ]
            }
          }
        },
        displayOrder: 2,
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
          byDifficulty: {
            beginner: {
              title: "Meeting Agenda / Agenda de la Reunión",
              fields: [
                { label: "Meeting / Reunión", value: "Weekly Marketing Sync" },
                { label: "Date / Fecha", value: "Tuesday, 10:00 AM" },
                { label: "Duration / Duración", value: "45 minutes" },
                { label: "Item 1 / Punto 1", value: "Q1 Campaign Results Review" },
                { label: "Item 2 / Punto 2", value: "Social Media Strategy Update" },
                { label: "Item 3 / Punto 3", value: "New Product Launch Plan" },
                { label: "Item 4 / Punto 4", value: "Budget Allocation Discussion" },
                { label: "Item 5 / Punto 5", value: "Action Items & Next Steps" }
              ]
            },
            intermediate: {
              title: "Agenda de la Reunión",
              fields: [
                { label: "Reunión", value: "Sincronización semanal de Marketing" },
                { label: "Fecha y hora", value: "Martes, 10:00" },
                { label: "Duración", value: "45 minutos" },
                { label: "Punto 1", value: "Revisión de resultados de campañas del T1" },
                { label: "Punto 2", value: "Actualización de la estrategia en redes sociales" },
                { label: "Punto 3", value: "Plan de lanzamiento de nuevo producto" },
                { label: "Punto 4", value: "Discusión sobre asignación de presupuesto" },
                { label: "Punto 5", value: "Tareas pendientes y próximos pasos" }
              ]
            },
            advanced: {
              title: "Orden del Día — Reunión de Departamento de Marketing",
              fields: [
                { label: "Convocatoria", value: "Reunión semanal de coordinación del área de Marketing" },
                { label: "Fecha y hora de inicio", value: "Martes, 10:00 h" },
                { label: "Duración prevista", value: "45 minutos" },
                { label: "1.º punto", value: "Análisis de resultados de las campañas del primer trimestre" },
                { label: "2.º punto", value: "Informe de situación de la estrategia de redes sociales" },
                { label: "3.º punto", value: "Propuesta de plan de lanzamiento del nuevo producto" },
                { label: "4.º punto", value: "Debate sobre la distribución presupuestaria" },
                { label: "5.º punto", value: "Asignación de acciones de seguimiento y plazos" }
              ]
            }
          }
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Notes Pad",
        content: {
          byDifficulty: {
            beginner: {
              title: "Meeting Notes / Notas de la Reunión",
              fields: [
                { label: "Key Decisions / Decisiones clave", value: "(to be filled during meeting)" },
                { label: "Action Items / Tareas", value: "(to be filled during meeting)" },
                { label: "Deadlines / Plazos", value: "(to be filled during meeting)" },
                { label: "Follow-up Meeting / Próxima reunión", value: "(to be scheduled)" }
              ]
            },
            intermediate: {
              title: "Notas de la Reunión",
              fields: [
                { label: "Decisiones tomadas", value: "(to be filled during meeting)" },
                { label: "Tareas asignadas", value: "(to be filled during meeting)" },
                { label: "Plazos de entrega", value: "(to be filled during meeting)" },
                { label: "Próxima reunión", value: "(to be scheduled)" }
              ]
            },
            advanced: {
              title: "Acta de Reunión — Notas del Secretario",
              fields: [
                { label: "Acuerdos adoptados", value: "(to be filled during meeting)" },
                { label: "Acciones de seguimiento y responsables", value: "(to be filled during meeting)" },
                { label: "Fechas límite comprometidas", value: "(to be filled during meeting)" },
                { label: "Convocatoria de la próxima sesión", value: "(to be scheduled)" }
              ]
            }
          }
        },
        displayOrder: 1,
        isInteractive: true
      },
      {
        propType: "document",
        title: "Q1 Performance Chart",
        content: {
          byDifficulty: {
            beginner: {
              title: "Q1 Performance Summary / Resumen de Rendimiento Q1",
              fields: [
                { label: "Social Media Reach / Alcance redes", value: "↑ 34% vs Q4 (1.2M impressions)" },
                { label: "Website Traffic / Tráfico web", value: "↑ 18% (45K monthly visitors)" },
                { label: "Conversion Rate / Tasa de conversión", value: "↓ 2.1% (was 2.8% in Q4)" },
                { label: "Email Open Rate / Apertura emails", value: "→ 22% (stable)" },
                { label: "Ad Spend / Gasto publicitario", value: "€12,500 (↑ 15% over budget)" },
                { label: "New Leads / Nuevos leads", value: "340 (target: 400)" },
                { label: "Top Campaign / Mejor campaña", value: "Spring Launch — 3.2% CTR" },
                { label: "Action Needed / Acción requerida", value: "Conversion rate decline needs investigation" }
              ]
            },
            intermediate: {
              title: "Resumen de Rendimiento — Primer Trimestre",
              fields: [
                { label: "Alcance en redes sociales", value: "↑ 34% respecto al T4 (1,2 millones de impresiones)" },
                { label: "Tráfico web", value: "↑ 18% (45.000 visitantes mensuales)" },
                { label: "Tasa de conversión", value: "↓ 2,1% (era 2,8% en el T4)" },
                { label: "Tasa de apertura de emails", value: "→ 22% (estable)" },
                { label: "Gasto publicitario", value: "€12.500 (↑ 15% por encima del presupuesto)" },
                { label: "Nuevos leads generados", value: "340 (objetivo: 400)" },
                { label: "Campaña destacada", value: "Spring Launch — 3,2% CTR" },
                { label: "Acción requerida", value: "Investigar la caída en la tasa de conversión" }
              ]
            },
            advanced: {
              title: "Informe de Indicadores Clave — T1 2026",
              fields: [
                { label: "Alcance orgánico y pagado en RRSS", value: "Incremento interanual del 34% frente al T4 (1,2 M de impresiones acumuladas)" },
                { label: "Volumen de tráfico web", value: "Crecimiento del 18% (45.000 usuarios únicos mensuales)" },
                { label: "Ratio de conversión", value: "Descenso al 2,1% (2,8% en el trimestre anterior)" },
                { label: "Tasa de apertura de campañas de email marketing", value: "22% — sin variación significativa" },
                { label: "Inversión publicitaria ejecutada", value: "€12.500 (desviación del +15% sobre presupuesto aprobado)" },
                { label: "Captación de nuevos contactos cualificados", value: "340 leads (objetivo trimestral: 400)" },
                { label: "Campaña con mejor rendimiento", value: "Spring Launch — CTR del 3,2%" },
                { label: "Punto crítico pendiente de resolución", value: "Analizar las causas del retroceso en la tasa de conversión y proponer medidas correctivas" }
              ]
            }
          }
        },
        displayOrder: 2,
        isInteractive: false
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
      },
      {
        propType: "card",
        title: "Party Invitation",
        content: {
          byDifficulty: {
            beginner: {
              title: "Party Invitation / Invitación a la Fiesta",
              fields: [
                { label: "Host / Anfitriona", value: "María Rodríguez" },
                { label: "What / Qué", value: "Housewarming party / Fiesta de bienvenida" },
                { label: "When / Cuándo", value: "Saturday 8 PM / Sábado 20:00" },
                { label: "Where / Dónde", value: "Av. Corrientes 1234, Piso 5, Depto B, Buenos Aires" },
                { label: "Bring / Traer", value: "Something to drink or share / Algo para tomar o picar" },
                { label: "Dress Code", value: "Casual / Informal" },
                { label: "RSVP", value: "WhatsApp: +54 11 5555-1234" }
              ]
            },
            intermediate: {
              title: "Invitación a la Fiesta",
              fields: [
                { label: "Anfitriona", value: "María Rodríguez" },
                { label: "Evento", value: "Fiesta de bienvenida a la casa nueva" },
                { label: "Fecha y hora", value: "Sábado a las 20:00" },
                { label: "Dirección", value: "Av. Corrientes 1234, Piso 5, Depto B, Buenos Aires" },
                { label: "Qué traer", value: "Algo para tomar o algo para picar" },
                { label: "Vestimenta", value: "Informal" },
                { label: "Confirmación", value: "WhatsApp: +54 11 5555-1234" }
              ]
            },
            advanced: {
              title: "¡Vení a casa! — Invitación de María",
              fields: [
                { label: "Anfitriona", value: "María Rodríguez" },
                { label: "¿Qué festejamos?", value: "¡Me mudé! Vení a conocer el depto nuevo y a pasarla bien" },
                { label: "¿Cuándo?", value: "Este sábado a partir de las 20 h" },
                { label: "¿Dónde?", value: "Av. Corrientes 1234, 5.º B, CABA" },
                { label: "Traé", value: "Lo que quieras para tomar o picar — la idea es compartir" },
                { label: "Onda", value: "Relajada, vení como estés" },
                { label: "Avisame por WhatsApp", value: "+54 11 5555-1234" }
              ]
            }
          }
        },
        displayOrder: 2,
        isInteractive: false
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
          byLanguage: restaurantMenus,
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
      },
      {
        propType: "bill",
        title: "Check/Bill",
        content: {
          byDifficulty: {
            beginner: {
              title: "Restaurant Check / Cuenta del Restaurante",
              fields: [
                { label: "Restaurant / Restaurante", value: "Trattoria Bella" },
                { label: "Date / Fecha", value: "Today" },
                { label: "Items / Artículos", value: "(dynamic)" },
                { label: "Subtotal", value: "0.00€" },
                { label: "Service / Servicio (coperto)", value: "2.50€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            intermediate: {
              title: "Cuenta del Restaurante",
              fields: [
                { label: "Restaurante", value: "Trattoria Bella" },
                { label: "Fecha", value: "Hoy" },
                { label: "Consumiciones", value: "(dynamic)" },
                { label: "Subtotal", value: "0.00€" },
                { label: "Servicio de mesa (coperto)", value: "2.50€" },
                { label: "Total", value: "0.00€" }
              ]
            },
            advanced: {
              title: "Nota de Consumo — Trattoria Bella",
              fields: [
                { label: "Establecimiento", value: "Trattoria Bella" },
                { label: "Fecha", value: "Hoy" },
                { label: "Detalle de consumiciones", value: "(dynamic)" },
                { label: "Base imponible", value: "0.00€" },
                { label: "Servicio de cubierto", value: "2.50€" },
                { label: "Total a pagar", value: "0.00€" }
              ]
            }
          }
        },
        displayOrder: 2,
        isInteractive: false
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
          byDifficulty: {
            beginner: {
              title: "Symptom Card / Tarjeta de Síntomas",
              fields: [
                { label: "Head / Cabeza", value: "Headache, dizziness" },
                { label: "Throat / Garganta", value: "Sore throat, cough" },
                { label: "Stomach / Estómago", value: "Nausea, pain" },
                { label: "Body / Cuerpo", value: "Fever, fatigue" },
                { label: "Duration / Duración", value: "Since when?" },
                { label: "Intensity (1-10) / Intensidad", value: "How much does it hurt?" }
              ]
            },
            intermediate: {
              title: "Tarjeta de Síntomas",
              fields: [
                { label: "Cabeza", value: "Dolor de cabeza, mareos, visión borrosa" },
                { label: "Garganta", value: "Dolor de garganta, tos, dificultad para tragar" },
                { label: "Estómago", value: "Náuseas, dolor abdominal, acidez" },
                { label: "Cuerpo", value: "Fiebre, cansancio, dolor muscular" },
                { label: "Duración", value: "¿Desde cuándo tiene los síntomas?" },
                { label: "Intensidad (1-10)", value: "¿Cuánto le duele?" }
              ]
            },
            advanced: {
              title: "Ficha de Evaluación Sintomatológica",
              fields: [
                { label: "Región cefálica", value: "Cefalea, vértigo, fotosensibilidad" },
                { label: "Región orofaríngea", value: "Odinofagia, tos productiva/seca, disfagia" },
                { label: "Región abdominal", value: "Náuseas, epigastralgia, pirosis" },
                { label: "Sintomatología general", value: "Hipertermia, astenia, mialgias generalizadas" },
                { label: "Tiempo de evolución", value: "¿Desde cuándo presenta el cuadro clínico?" },
                { label: "Escala de dolor (EVA 1-10)", value: "Valoración subjetiva de la intensidad del dolor" }
              ]
            }
          }
        },
        displayOrder: 0,
        isInteractive: true
      },
      {
        propType: "document",
        title: "Prescription",
        content: {
          byDifficulty: {
            beginner: {
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
            intermediate: {
              title: "Receta Médica",
              fields: [
                { label: "Médico", value: "Dr. Santos" },
                { label: "Paciente", value: "(Student Name)" },
                { label: "Diagnóstico", value: "(to be determined)" },
                { label: "Medicamento", value: "(to be prescribed)" },
                { label: "Posología", value: "(instructions)" },
                { label: "Duración del tratamiento", value: "(days of treatment)" },
                { label: "Consulta de seguimiento", value: "(return date if needed)" }
              ]
            },
            advanced: {
              title: "Receta Médica — Prescripción Facultativa",
              fields: [
                { label: "Facultativo prescriptor", value: "Dr. Santos" },
                { label: "Datos del paciente", value: "(Student Name)" },
                { label: "Diagnóstico clínico", value: "(to be determined)" },
                { label: "Principio activo / Especialidad farmacéutica", value: "(to be prescribed)" },
                { label: "Posología y vía de administración", value: "(instructions)" },
                { label: "Duración del tratamiento", value: "(days of treatment)" },
                { label: "Revisión y seguimiento", value: "(return date if needed)" }
              ]
            }
          }
        },
        displayOrder: 1,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Patient Intake Form",
        content: {
          byDifficulty: {
            beginner: {
              title: "Patient Intake Form / Formulario del Paciente",
              fields: [
                { label: "Full Name / Nombre completo", value: "(to be filled)" },
                { label: "Date of Birth / Fecha de nacimiento", value: "(to be filled)" },
                { label: "Known Allergies / Alergias conocidas", value: "(to be filled)" },
                { label: "Current Medications / Medicamentos actuales", value: "(to be filled)" },
                { label: "Previous Surgeries / Cirugías previas", value: "(to be filled)" },
                { label: "Family History / Antecedentes familiares", value: "(to be filled)" },
                { label: "Reason for Visit / Motivo de consulta", value: "(to be filled)" },
                { label: "Insurance / Seguro médico", value: "(to be filled)" }
              ]
            },
            intermediate: {
              title: "Formulario de Ingreso del Paciente",
              fields: [
                { label: "Nombre completo", value: "(to be filled)" },
                { label: "Fecha de nacimiento", value: "(to be filled)" },
                { label: "Alergias conocidas", value: "(to be filled)" },
                { label: "Medicación actual", value: "(to be filled)" },
                { label: "Cirugías previas", value: "(to be filled)" },
                { label: "Antecedentes familiares", value: "(to be filled)" },
                { label: "Motivo de consulta", value: "(to be filled)" },
                { label: "Seguro médico", value: "(to be filled)" }
              ]
            },
            advanced: {
              title: "Historial Clínico — Formulario de Admisión",
              fields: [
                { label: "Nombre y apellidos del paciente", value: "(to be filled)" },
                { label: "Fecha de nacimiento", value: "(to be filled)" },
                { label: "Alergias medicamentosas y ambientales", value: "(to be filled)" },
                { label: "Tratamiento farmacológico en curso", value: "(to be filled)" },
                { label: "Antecedentes quirúrgicos", value: "(to be filled)" },
                { label: "Antecedentes patológicos familiares", value: "(to be filled)" },
                { label: "Motivo de la consulta actual", value: "(to be filled)" },
                { label: "Entidad aseguradora / N.º de póliza", value: "(to be filled)" }
              ]
            }
          }
        },
        displayOrder: 2,
        isInteractive: true
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
          byDifficulty: {
            beginner: {
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
            intermediate: {
              title: "Reporte de Objeto Perdido",
              fields: [
                { label: "Tipo de objeto", value: "(mochila, teléfono, cartera, etc.)" },
                { label: "Color", value: "(describir color)" },
                { label: "Marca", value: "(si corresponde)" },
                { label: "Contenido", value: "(qué había dentro)" },
                { label: "Visto por última vez", value: "(lugar y hora)" },
                { label: "Datos de contacto", value: "(teléfono o correo electrónico)" }
              ]
            },
            advanced: {
              title: "Formulario de Denuncia de Extravío",
              fields: [
                { label: "Naturaleza del objeto extraviado", value: "(mochila, dispositivo móvil, billetera, etc.)" },
                { label: "Coloración y características visuales", value: "(describir color y señas particulares)" },
                { label: "Marca y modelo", value: "(si corresponde)" },
                { label: "Relación de contenido", value: "(descripción detallada del contenido)" },
                { label: "Última localización conocida", value: "(ubicación exacta y hora aproximada)" },
                { label: "Datos de contacto del reclamante", value: "(teléfono y correo electrónico)" }
              ]
            }
          }
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
      },
      {
        propType: "document",
        title: "Claim Form",
        content: {
          byDifficulty: {
            beginner: {
              title: "Lost Item Claim Form / Formulario de Reclamación",
              fields: [
                { label: "Claimant Name / Nombre", value: "(to be filled)" },
                { label: "ID / Documento de identidad", value: "(to be filled)" },
                { label: "Date of Loss / Fecha de pérdida", value: "(to be filled)" },
                { label: "Time / Hora aproximada", value: "(to be filled)" },
                { label: "Location / Lugar", value: "(to be filled)" },
                { label: "Item Description / Descripción", value: "(to be filled)" },
                { label: "Estimated Value / Valor estimado", value: "(to be filled)" },
                { label: "Contact Phone / Teléfono", value: "(to be filled)" },
                { label: "Contact Email / Correo", value: "(to be filled)" },
                { label: "Signature / Firma", value: "________________" }
              ]
            },
            intermediate: {
              title: "Formulario de Reclamación de Objeto Perdido",
              fields: [
                { label: "Nombre del reclamante", value: "(to be filled)" },
                { label: "Documento de identidad", value: "(to be filled)" },
                { label: "Fecha de la pérdida", value: "(to be filled)" },
                { label: "Hora aproximada", value: "(to be filled)" },
                { label: "Lugar del extravío", value: "(to be filled)" },
                { label: "Descripción del objeto", value: "(to be filled)" },
                { label: "Valor estimado", value: "(to be filled)" },
                { label: "Teléfono de contacto", value: "(to be filled)" },
                { label: "Correo electrónico", value: "(to be filled)" },
                { label: "Firma", value: "________________" }
              ]
            },
            advanced: {
              title: "Formulario de Reclamación de Objetos Extraviados — Oficina de Objetos Perdidos",
              fields: [
                { label: "Nombre completo del reclamante", value: "(to be filled)" },
                { label: "Tipo y número de documento de identidad", value: "(to be filled)" },
                { label: "Fecha del extravío", value: "(to be filled)" },
                { label: "Hora aproximada del suceso", value: "(to be filled)" },
                { label: "Ubicación exacta del extravío (andén, vagón, sala de espera)", value: "(to be filled)" },
                { label: "Descripción pormenorizada del objeto", value: "(to be filled)" },
                { label: "Valor declarado del objeto", value: "(to be filled)" },
                { label: "Teléfono de contacto", value: "(to be filled)" },
                { label: "Dirección de correo electrónico", value: "(to be filled)" },
                { label: "Firma del declarante", value: "________________" }
              ]
            }
          }
        },
        displayOrder: 2,
        isInteractive: true
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
          byDifficulty: {
            beginner: {
              title: "Festival Program / Programa del Festival",
              fields: [
                { label: "Event / Evento", value: "Local Cultural Festival 2026" },
                { label: "10:00 - Opening Ceremony / Apertura", value: "Opening at Plaza Independencia" },
                { label: "11:30 - Wine Tasting / Degustación", value: "Wine tasting at Bodega Central" },
                { label: "13:00 - Traditional Lunch / Almuerzo", value: "BBQ and empanadas lunch" },
                { label: "15:00 - Folklore Show / Folclore", value: "Music and dance show" },
                { label: "17:00 - Grape Harvest / Cosecha", value: "Symbolic grape harvest" },
                { label: "20:00 - Queen Coronation / Coronación", value: "Queen of the Harvest crowning" },
                { label: "22:00 - Fireworks / Fuegos artificiales", value: "Fireworks and closing" }
              ]
            },
            intermediate: {
              title: "Programa del Festival",
              fields: [
                { label: "Evento", value: "Festival Cultural Local 2026" },
                { label: "10:00 - Ceremonia de apertura", value: "Apertura oficial en Plaza Independencia" },
                { label: "11:30 - Degustación de vinos", value: "Cata de vinos regionales en la Bodega Central" },
                { label: "13:00 - Almuerzo criollo", value: "Asado y empanadas con música en vivo" },
                { label: "15:00 - Show folclórico", value: "Espectáculo de música y danza folclórica" },
                { label: "17:00 - Cosecha de uvas", value: "Cosecha simbólica en los viñedos del festival" },
                { label: "20:00 - Coronación de la Reina", value: "Coronación de la Reina de la Vendimia" },
                { label: "22:00 - Fuegos artificiales", value: "Cierre del festival con fuegos artificiales" }
              ]
            },
            advanced: {
              title: "Programa Oficial — Fiesta Nacional de la Vendimia 2026",
              fields: [
                { label: "Evento", value: "Festival Cultural Local 2026" },
                { label: "10:00 h — Acto inaugural", value: "Ceremonia inaugural en la explanada de Plaza Independencia con presencia del intendente y autoridades provinciales" },
                { label: "11:30 h — Degustación enológica", value: "Cata comentada de varietales de la región cuyana en las instalaciones de Bodega Central" },
                { label: "13:00 h — Almuerzo criollo", value: "Asado a la cruz y empanadas artesanales con acompañamiento de conjunto folclórico en vivo" },
                { label: "15:00 h — Espectáculo de folclore", value: "Gala de música y danza folclórica con elencos de ballet provinciales" },
                { label: "17:00 h — Vendimia simbólica", value: "Cosecha ceremonial de las primeras uvas de la temporada en los viñedos de la explanada" },
                { label: "20:00 h — Coronación", value: "Elección y coronación de la Reina Nacional de la Vendimia en el Teatro Griego Frank Romero Day" },
                { label: "22:00 h — Cierre y pirotecnia", value: "Gran espectáculo de fuegos artificiales y cierre oficial del festival" }
              ]
            }
          }
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "menu",
        title: "Food Menu",
        content: {
          byLanguage: localFestivalMenus,
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
      },
      {
        propType: "bill",
        title: "Festival Receipt",
        content: {
          byDifficulty: {
            beginner: {
              title: "Festival Receipt / Recibo del Festival",
              fields: [
                { label: "Vendor / Puesto", value: "Festival Food Stall" },
                { label: "Items / Artículos", value: "(dynamic)" },
                { label: "Subtotal", value: "0 ARS" },
                { label: "Total", value: "0 ARS" }
              ]
            },
            intermediate: {
              title: "Recibo del Festival",
              fields: [
                { label: "Puesto de comida", value: "Festival Food Stall" },
                { label: "Artículos", value: "(dynamic)" },
                { label: "Subtotal", value: "0 ARS" },
                { label: "Total", value: "0 ARS" }
              ]
            },
            advanced: {
              title: "Comprobante de Consumo — Festival de la Vendimia",
              fields: [
                { label: "Puesto expendedor", value: "Festival Food Stall" },
                { label: "Detalle de consumiciones", value: "(dynamic)" },
                { label: "Subtotal", value: "0 ARS" },
                { label: "Total a pagar", value: "0 ARS" }
              ]
            }
          }
        },
        displayOrder: 2,
        isInteractive: false
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
          byDifficulty: {
            beginner: {
              title: "Exhibit Guide / Guía de la Exposición",
              fields: [
                { label: "Museum / Museo", value: "Museo del Prado" },
                { label: "Gallery 1 / Sala 1", value: "Las Meninas - Diego Velázquez (1656)" },
                { label: "Gallery 2 / Sala 2", value: "El Tres de Mayo - Francisco de Goya (1814)" },
                { label: "Gallery 3 / Sala 3", value: "The Garden of Earthly Delights - El Bosco (1500)" },
                { label: "Gallery 4 / Sala 4", value: "The Annunciation - Fra Angelico (1426)" },
                { label: "Special Exhibition / Exposición especial", value: "Sorolla: Light and Color (temporary)" },
                { label: "Hours / Horario", value: "Mon-Sat 10:00-20:00, Sun 10:00-17:00" },
                { label: "Audio Guide / Audioguía", value: "Available in 12 languages" }
              ]
            },
            intermediate: {
              title: "Guía de la Exposición",
              fields: [
                { label: "Museo", value: "Museo del Prado" },
                { label: "Sala 1", value: "Las Meninas - Diego Velázquez (1656)" },
                { label: "Sala 2", value: "El Tres de Mayo - Francisco de Goya (1814)" },
                { label: "Sala 3", value: "El jardín de las delicias - El Bosco (1500)" },
                { label: "Sala 4", value: "La Anunciación - Fra Angelico (1426)" },
                { label: "Exposición temporal", value: "Sorolla: Luz y Color (temporal)" },
                { label: "Horario de visita", value: "Lunes a sábado 10:00-20:00, domingos 10:00-17:00" },
                { label: "Audioguía", value: "Disponible en 12 idiomas" }
              ]
            },
            advanced: {
              title: "Guía de Salas — Museo Nacional del Prado",
              fields: [
                { label: "Institución", value: "Museo del Prado" },
                { label: "Sala 12 — Pintura barroca española", value: "Las Meninas - Diego Velázquez (1656), óleo sobre lienzo" },
                { label: "Sala 39 — Goya y la Guerra de la Independencia", value: "El Tres de Mayo de 1808 - Francisco de Goya (1814), óleo sobre lienzo" },
                { label: "Sala 56A — Pintura flamenca", value: "El jardín de las delicias - El Bosco (c. 1500), tríptico, óleo sobre tabla" },
                { label: "Sala 49 — Pintura italiana del Quattrocento", value: "La Anunciación - Fra Angelico (c. 1426), temple sobre tabla" },
                { label: "Exposición temporal — Ala norte", value: "Sorolla: Luz y Color — Retrospectiva antológica (exposición temporal)" },
                { label: "Horario de apertura al público", value: "De lunes a sábado de 10:00 a 20:00 h; domingos y festivos de 10:00 a 17:00 h" },
                { label: "Servicio de audioguía", value: "Disponible en 12 idiomas en los mostradores de información de planta baja" }
              ]
            }
          }
        },
        displayOrder: 0,
        isInteractive: false
      },
      {
        propType: "document",
        title: "Audio Tour Notes",
        content: {
          byDifficulty: {
            beginner: {
              title: "Audio Tour Notes / Notas del Audio Tour",
              fields: [
                { label: "Las Meninas", value: "A painting inside a painting. The artist painted himself in the scene." },
                { label: "El Tres de Mayo", value: "A powerful painting about war. The man in white has his arms open wide." },
                { label: "The Garden / El jardín", value: "Three panels showing paradise, earthly life, and hell. Many strange creatures." },
                { label: "Discussion Prompt / Tema de conversación", value: "Which painting do you like the most? Why?" }
              ]
            },
            intermediate: {
              title: "Notas del Recorrido con Audioguía",
              fields: [
                { label: "Las Meninas", value: "Un cuadro dentro de otro cuadro. Velázquez se incluye en la escena, desafiando la perspectiva del espectador." },
                { label: "El Tres de Mayo", value: "Una poderosa declaración contra la guerra. La camisa blanca y los brazos abiertos del personaje central evocan una imagen cristológica." },
                { label: "El jardín de las delicias", value: "Un tríptico que representa el paraíso, los placeres terrenales y el infierno, lleno de criaturas simbólicas e imágenes surrealistas." },
                { label: "Tema de reflexión", value: "¿Qué obra le conmueve más? ¿Por qué?" }
              ]
            },
            advanced: {
              title: "Notas de la Audioguía — Recorrido por las Obras Maestras",
              fields: [
                { label: "Las Meninas — Diego Velázquez (1656)", value: "Obra cumbre del Barroco español. Velázquez subvierte las convenciones del retrato cortesano al situarse a sí mismo en la composición, generando un juego de espejos y miradas que disuelve la frontera entre el espacio pictórico y el del espectador." },
                { label: "El Tres de Mayo de 1808 — Francisco de Goya (1814)", value: "Manifiesto visual contra la barbarie bélica. La figura central, con su camisa blanca resplandeciente y los brazos abiertos en gesto de crucifixión laica, encarna la resistencia del pueblo español frente al pelotón de fusilamiento napoleónico." },
                { label: "El jardín de las delicias — El Bosco (c. 1500)", value: "Tríptico enigmático que despliega una cosmogonía alegórica: del Edén primigenio a los deleites carnales y, finalmente, al tormento infernal. La profusión de seres fantásticos y la iconografía hermética han suscitado siglos de interpretación erudita." },
                { label: "Reflexión para el visitante", value: "¿Qué obra le interpela con mayor intensidad? ¿Qué recursos formales emplea el artista para provocar esa reacción?" }
              ]
            }
          }
        },
        displayOrder: 1,
        isInteractive: false
      },
      {
        propType: "bill",
        title: "Ticket Receipt",
        content: {
          byDifficulty: {
            beginner: {
              title: "Museum Ticket Receipt / Recibo de Entrada",
              fields: [
                { label: "Museum / Museo", value: "Museo del Prado" },
                { label: "Tickets / Entradas", value: "(dynamic)" },
                { label: "Audio Guide / Audioguía", value: "(dynamic)" },
                { label: "Gift Shop / Tienda", value: "(dynamic)" },
                { label: "Total", value: "0.00€" }
              ]
            },
            intermediate: {
              title: "Recibo de Entrada al Museo",
              fields: [
                { label: "Museo", value: "Museo del Prado" },
                { label: "Entradas", value: "(dynamic)" },
                { label: "Audioguía", value: "(dynamic)" },
                { label: "Tienda del museo", value: "(dynamic)" },
                { label: "Total", value: "0.00€" }
              ]
            },
            advanced: {
              title: "Comprobante de Admisión — Museo Nacional del Prado",
              fields: [
                { label: "Institución", value: "Museo del Prado" },
                { label: "Concepto de entradas", value: "(dynamic)" },
                { label: "Servicio de audioguía", value: "(dynamic)" },
                { label: "Artículos de la tienda del museo", value: "(dynamic)" },
                { label: "Total a pagar", value: "0.00€" }
              ]
            }
          }
        },
        displayOrder: 2,
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

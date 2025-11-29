import { storage } from "./storage";
import type { InsertCulturalTip } from "@shared/schema";

const culturalTipsData: InsertCulturalTip[] = [
  // SPANISH
  { language: "spanish", category: "Greetings", title: "The Two-Cheek Kiss", content: "In Spain and most Latin American countries, people greet friends and family with a kiss on each cheek. Start with the right cheek first.", context: "When meeting friends, family, or being introduced to someone in social settings", icon: "Heart", relatedTopics: ["greetings-introductions", "family-relationships"] },
  { language: "spanish", category: "Dining", title: "Late Dinner Times", content: "In Spain, dinner is typically served between 9-10 PM. Restaurants often don't open for dinner until 8:30 PM.", context: "When dining out in Spain or with Spanish families", icon: "Utensils", relatedTopics: ["food-dining", "food-restaurants", "travel-transportation"] },
  { language: "spanish", category: "Social Norms", title: "Personal Space is Closer", content: "Spanish speakers tend to stand closer during conversations than English speakers. This isn't rude—it's normal!", context: "During any face-to-face conversation", icon: "Users", relatedTopics: ["family-relationships", "greetings-introductions"] },
  { language: "spanish", category: "Customs", title: "The Siesta Tradition", content: "Many businesses in Spain still close from 2-5 PM for the traditional afternoon rest. Plan your shopping accordingly.", context: "When visiting Spain during afternoon hours", icon: "Moon", relatedTopics: ["home-housing", "shopping", "shopping-retail", "travel-transportation"] },
  { language: "spanish", category: "Holidays", title: "Día de los Muertos", content: "Day of the Dead (November 1-2) in Mexico celebrates deceased loved ones with altars, flowers, and favorite foods—it's a joyful celebration, not mournful.", context: "Around late October to early November in Mexico", icon: "Flower2", relatedTopics: ["family-relationships", "expressing-feelings"] },

  // FRENCH
  { language: "french", category: "Greetings", title: "La Bise (Cheek Kisses)", content: "The number of cheek kisses varies by region—2 in Paris, 3 in the south, up to 4 elsewhere. Follow the local's lead!", context: "When greeting friends, family, or acquaintances", icon: "Heart", relatedTopics: ["greetings-introductions", "family-relationships"] },
  { language: "french", category: "Dining", title: "Bread Goes on the Table", content: "In France, bread is placed directly on the tablecloth, not on a bread plate. It's used to push food onto your fork.", context: "During any French meal", icon: "Croissant", relatedTopics: ["food-dining", "food-restaurants"] },
  { language: "french", category: "Social Norms", title: "Always Say 'Bonjour'", content: "Entering any shop without saying 'Bonjour' first is considered very rude. Always greet before asking anything.", context: "When entering any store, café, or business", icon: "MessageCircle", relatedTopics: ["greetings-introductions", "shopping", "shopping-retail"] },
  { language: "french", category: "Customs", title: "Sunday is Family Day", content: "Most shops are closed on Sundays in France. It's a day for family meals that can last 2-3 hours.", context: "When planning shopping or activities on Sundays", icon: "Home", relatedTopics: ["family-relationships", "shopping", "shopping-retail"] },
  { language: "french", category: "Holidays", title: "Bastille Day Celebrations", content: "July 14th celebrates French independence with fireworks, military parades, and dancing in the streets called 'Bal des Pompiers'.", context: "On and around July 14th in France", icon: "Sparkles", relatedTopics: ["hobbies-interests", "hobbies-leisure"] },

  // GERMAN
  { language: "german", category: "Greetings", title: "Firm Handshakes", content: "Germans prefer a firm handshake with direct eye contact. Weak handshakes are seen as insincere.", context: "When meeting someone for the first time or in business settings", icon: "HandMetal", relatedTopics: ["greetings-introductions", "work-business", "work-career"] },
  { language: "german", category: "Dining", title: "Prost! (Cheers)", content: "When toasting, make eye contact with each person and say 'Prost!' Not making eye contact is said to bring 7 years of bad luck!", context: "When drinking with Germans", icon: "Wine", relatedTopics: ["food-dining", "food-restaurants", "family-relationships"] },
  { language: "german", category: "Social Norms", title: "Punctuality is Key", content: "Being late—even by 5 minutes—is considered very rude in Germany. Arrive exactly on time or a few minutes early.", context: "For any meeting, appointment, or social gathering", icon: "Clock", relatedTopics: ["making-plans", "work-business", "work-career"] },
  { language: "german", category: "Customs", title: "Quiet Sundays", content: "'Ruhezeit' (quiet time) means no loud activities on Sundays. No mowing lawns, drilling, or even vacuuming.", context: "On Sundays in residential areas", icon: "VolumeX", relatedTopics: ["home-housing", "home-accommodation"] },
  { language: "german", category: "Holidays", title: "Christmas Markets", content: "Starting in late November, Weihnachtsmärkte (Christmas markets) appear in every town with Glühwein (mulled wine), crafts, and festive treats.", context: "From late November through December in Germany", icon: "TreePine", relatedTopics: ["shopping", "shopping-retail", "food-dining", "food-restaurants"] },

  // ITALIAN
  { language: "italian", category: "Greetings", title: "Expressive Hand Gestures", content: "Italians use their hands when talking—it's part of communication! Don't be surprised by animated gestures.", context: "During any conversation with Italians", icon: "Hand", relatedTopics: ["greetings-introductions", "family-relationships"] },
  { language: "italian", category: "Dining", title: "Cappuccino Rules", content: "Cappuccino is only for breakfast! Ordering one after 11 AM or after a meal is considered strange by Italians.", context: "When ordering coffee in Italy", icon: "Coffee", relatedTopics: ["food-dining", "food-restaurants"] },
  { language: "italian", category: "Social Norms", title: "Bella Figura", content: "Making a good impression (bella figura) is essential. Italians dress well even for casual occasions and value aesthetics.", context: "When dressing for any outing in Italy", icon: "Shirt", relatedTopics: ["family-relationships", "shopping", "shopping-retail"] },
  { language: "italian", category: "Customs", title: "The Passeggiata", content: "The evening stroll (passeggiata) is a cherished tradition where families walk, socialize, and eat gelato around 6-8 PM.", context: "In Italian towns during early evening hours", icon: "Footprints", relatedTopics: ["hobbies-interests", "hobbies-leisure", "family-relationships", "food-dining"] },
  { language: "italian", category: "Holidays", title: "Ferragosto", content: "August 15th is a major holiday when most Italians vacation. Cities empty out and many businesses close for weeks.", context: "During August, especially mid-month", icon: "Sun", relatedTopics: ["travel-transportation", "making-plans"] },

  // PORTUGUESE
  { language: "portuguese", category: "Greetings", title: "Warm Physical Greetings", content: "Brazilians are very warm—expect hugs and cheek kisses even when meeting someone new. It shows friendliness.", context: "When meeting Brazilians in social settings", icon: "Heart", relatedTopics: ["greetings-introductions", "family-relationships"] },
  { language: "portuguese", category: "Dining", title: "Long Meal Conversations", content: "Meals in Brazil and Portugal are social events. Expect lunch or dinner to last 1-2 hours with lots of conversation.", context: "When dining with Portuguese or Brazilian families", icon: "MessageSquare", relatedTopics: ["food-dining", "food-restaurants", "family-relationships"] },
  { language: "portuguese", category: "Social Norms", title: "Flexible Time", content: "In Brazil, 'Brazilian time' means events often start 30-60 minutes late. Being too punctual can mean arriving before your host is ready!", context: "For social events and parties in Brazil", icon: "Clock", relatedTopics: ["making-plans", "family-relationships"] },
  { language: "portuguese", category: "Customs", title: "Fado Music Culture", content: "In Portugal, Fado is traditional soul music expressing 'saudade'—a deep emotional longing. Fado houses are special cultural experiences.", context: "When experiencing nightlife in Lisbon or Porto", icon: "Music", relatedTopics: ["hobbies-interests", "hobbies-leisure", "expressing-feelings"] },
  { language: "portuguese", category: "Holidays", title: "Carnaval", content: "Brazil's Carnival before Lent is the world's biggest party. Cities transform with parades, samba, and elaborate costumes for 5 days.", context: "February/March, dates vary by lunar calendar", icon: "PartyPopper", relatedTopics: ["hobbies-interests", "hobbies-leisure"] },

  // JAPANESE
  { language: "japanese", category: "Greetings", title: "The Art of Bowing", content: "Bowing depth indicates respect level: 15° for casual, 30° for business, 45° for deep apology or high respect.", context: "When greeting anyone in Japan", icon: "User", relatedTopics: ["greetings-introductions", "work-business", "work-career"] },
  { language: "japanese", category: "Dining", title: "Chopstick Etiquette", content: "Never stick chopsticks upright in rice (resembles funeral incense) or pass food chopstick-to-chopstick (funeral ritual).", context: "During any meal with chopsticks", icon: "Utensils", relatedTopics: ["food-dining", "food-restaurants"] },
  { language: "japanese", category: "Social Norms", title: "Removing Shoes", content: "Always remove shoes when entering homes, traditional restaurants, temples, and some businesses. Socks should be clean and hole-free!", context: "When entering many buildings in Japan", icon: "Footprints", relatedTopics: ["home-housing", "home-accommodation", "travel-transportation"] },
  { language: "japanese", category: "Customs", title: "Gift-Giving Culture", content: "Gifts (omiyage) are important. Bring souvenirs from trips, give with both hands, and don't open gifts in front of the giver.", context: "When visiting someone's home or returning from travel", icon: "Gift", relatedTopics: ["family-relationships", "shopping", "shopping-retail", "travel-transportation"] },
  { language: "japanese", category: "Holidays", title: "Cherry Blossom Season", content: "Hanami (flower viewing) in spring is when families picnic under cherry blossoms. It's a cherished cultural tradition.", context: "Late March to early May, depending on location", icon: "Flower", relatedTopics: ["weather-seasons", "hobbies-interests", "hobbies-leisure"] },

  // CHINESE
  { language: "chinese", category: "Greetings", title: "Business Card Exchange", content: "Present your card with both hands, text facing the recipient. Receive cards the same way and study them respectfully.", context: "In any business meeting", icon: "CreditCard", relatedTopics: ["work-business", "work-career", "greetings-introductions"] },
  { language: "chinese", category: "Dining", title: "Lazy Susan Etiquette", content: "Wait for the host to eat first. Turn the Lazy Susan clockwise and don't reach across others for dishes.", context: "When dining at a Chinese round table", icon: "CircleDot", relatedTopics: ["food-dining", "food-restaurants", "family-relationships"] },
  { language: "chinese", category: "Social Norms", title: "Lucky Number 8", content: "8 is extremely lucky (sounds like 'prosperity'). 4 is avoided (sounds like 'death'). Many buildings skip the 4th floor!", context: "When giving gifts, choosing numbers, or understanding prices", icon: "Hash", relatedTopics: ["shopping", "shopping-retail"] },
  { language: "chinese", category: "Customs", title: "Red Envelope Tradition", content: "Red envelopes (hongbao) with money are given for weddings, New Year, and birthdays. The amount should be even, never 4.", context: "During Chinese holidays and celebrations", icon: "Mail", relatedTopics: ["family-relationships"] },
  { language: "chinese", category: "Holidays", title: "Chinese New Year", content: "The biggest holiday lasts 15 days. Expect fireworks, red decorations, family reunions, and red envelopes. Many businesses close.", context: "Late January to mid-February, varies by lunar calendar", icon: "Sparkles", relatedTopics: ["family-relationships"] },

  // KOREAN
  { language: "korean", category: "Greetings", title: "Age Hierarchy", content: "Korea has strict age-based respect. Always use formal speech with elders and accept things with both hands.", context: "When meeting anyone older than you", icon: "Users", relatedTopics: ["greetings-introductions", "family-relationships"] },
  { language: "korean", category: "Dining", title: "Drinking Etiquette", content: "Turn away from elders when drinking. Pour for others (never yourself), and use two hands when pouring for seniors.", context: "When drinking with Koreans, especially elders", icon: "Wine", relatedTopics: ["food-dining", "food-restaurants", "family-relationships"] },
  { language: "korean", category: "Social Norms", title: "Shoes Off Indoors", content: "Remove shoes at the door of homes and many traditional restaurants. Clean socks are important!", context: "When entering Korean homes and some businesses", icon: "Footprints", relatedTopics: ["home-housing", "home-accommodation"] },
  { language: "korean", category: "Customs", title: "K-Pop Fan Culture", content: "K-Pop is a global phenomenon from Korea. Fan meetings, light sticks, and streaming culture are serious business!", context: "When discussing Korean pop culture", icon: "Music", relatedTopics: ["hobbies-interests", "hobbies-leisure"] },
  { language: "korean", category: "Holidays", title: "Chuseok (Korean Thanksgiving)", content: "This 3-day harvest festival involves family gatherings, ancestral ceremonies, and eating songpyeon (rice cakes).", context: "In September or October, dates vary by lunar calendar", icon: "Leaf", relatedTopics: ["family-relationships", "food-dining", "food-restaurants"] },

  // RUSSIAN
  { language: "russian", category: "Greetings", title: "No Smiling at Strangers", content: "Russians don't smile at strangers—it's seen as insincere. Smiles are reserved for friends and genuine moments.", context: "When interacting with Russians you don't know", icon: "User", relatedTopics: ["greetings-introductions", "family-relationships"] },
  { language: "russian", category: "Dining", title: "Toast Culture", content: "Toasting (zastolye) is elaborate. The first toast is to the meeting, second to parents, third to love. Never toast with empty glasses!", context: "During any Russian meal with alcohol", icon: "Wine", relatedTopics: ["food-dining", "food-restaurants", "family-relationships"] },
  { language: "russian", category: "Social Norms", title: "Remove Outdoor Clothes", content: "Always remove coats and outdoor shoes in someone's home. Most Russians have indoor slippers (tapochki) for guests.", context: "When visiting Russian homes", icon: "Home", relatedTopics: ["home-housing", "home-accommodation", "family-relationships"] },
  { language: "russian", category: "Customs", title: "Superstitions Matter", content: "Many Russians are superstitious: don't shake hands across a threshold, sit down before a journey, and knock on wood.", context: "In daily Russian life", icon: "AlertTriangle", relatedTopics: ["travel-transportation"] },
  { language: "russian", category: "Holidays", title: "New Year's is Bigger Than Christmas", content: "New Year's Eve is the biggest celebration with Ded Moroz (Grandfather Frost), gifts, and Olivier salad. Christmas is January 7th.", context: "Late December to early January", icon: "Snowflake", relatedTopics: ["family-relationships"] },
];

export async function seedCulturalTips(): Promise<void> {
  console.log("[Cultural Tips Seed] Starting cultural tips seeding...");
  
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const tip of culturalTipsData) {
    const existingTips = await storage.getCulturalTips(tip.language);
    const existingTip = existingTips.find(
      (t) => t.title === tip.title && t.category === tip.category
    );

    if (!existingTip) {
      await storage.createCulturalTip(tip);
      created++;
    } else {
      const existingTopics = existingTip.relatedTopics || [];
      const newTopics = tip.relatedTopics || [];
      const topicsMatch = existingTopics.length === newTopics.length && 
        existingTopics.every((t, i) => t === newTopics[i]);
      
      if (!topicsMatch) {
        await storage.updateCulturalTip(existingTip.id, { relatedTopics: tip.relatedTopics });
        updated++;
      } else {
        skipped++;
      }
    }
  }

  console.log(`[Cultural Tips Seed] Complete: ${created} created, ${updated} updated, ${skipped} skipped (already exist)`);
}

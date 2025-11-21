import {
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type VocabularyWord,
  type InsertVocabularyWord,
  type GrammarExercise,
  type InsertGrammarExercise,
  type UserProgress,
  type InsertUserProgress,
  type ProgressHistory,
  type InsertProgressHistory,
  type PronunciationScore,
  type InsertPronunciationScore,
  type Topic,
  type InsertTopic,
  type CulturalTip,
  type InsertCulturalTip,
  type User,
  type UpsertUser,
  type MediaFile,
  type InsertMediaFile,
  type MessageMedia,
  type InsertMessageMedia,
  users,
  conversations,
  messages,
  vocabularyWords,
  grammarExercises,
  userProgress as userProgressTable,
  progressHistory as progressHistoryTable,
  pronunciationScores,
  topics as topicsTable,
  culturalTips as culturalTipsTable,
  mediaFiles,
  messageMedia,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { markCorrect, markIncorrect } from "./spaced-repetition";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (Replit Auth Integration)
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferences(userId: string, preferences: {
    targetLanguage?: string;
    nativeLanguage?: string;
    difficultyLevel?: string;
    onboardingCompleted?: boolean;
  }): Promise<User | undefined>;
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
  }): Promise<User | undefined>;

  // Usage tracking for voice messages
  checkVoiceUsage(userId: string): Promise<{allowed: boolean, remaining: number, limit: number}>;
  incrementVoiceUsage(userId: string): Promise<void>;
  checkAndIncrementVoiceUsage(userId: string): Promise<{allowed: boolean, remaining: number, limit: number}>;
  getUserUsageStats(userId: string): Promise<{monthlyMessageCount: number, monthlyMessageLimit: number, remaining: number}>;
  resetMonthlyUsageIfNeeded(userId: string): Promise<void>;

  // Stripe data queries (from stripe-replit-sync PostgreSQL tables)
  getProduct(productId: string): Promise<any | null>;
  listProducts(active?: boolean, limit?: number, offset?: number): Promise<any[]>;
  getPrice(priceId: string): Promise<any | null>;
  listPrices(active?: boolean, limit?: number, offset?: number): Promise<any[]>;
  getSubscription(subscriptionId: string): Promise<any | null>;

  // Conversations
  createConversation(data: typeof conversations.$inferInsert): Promise<Conversation>;
  getConversation(id: string, userId: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string): Promise<Conversation[]>;
  getConversationsByLanguage(language: string, userId: string): Promise<Conversation[]>;
  getConversationByLanguageAndDifficulty(language: string, difficulty: string, userId: string): Promise<Conversation | undefined>;
  updateConversation(id: string, userId: string, data: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string, userId: string): Promise<boolean>;

  // Messages
  createMessage(data: InsertMessage): Promise<Message>;
  getMessage(messageId: string, userId: string): Promise<Message | undefined>;
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  updateMessage(id: string, data: Partial<Message>): Promise<Message | undefined>;

  // Vocabulary
  createVocabularyWord(data: InsertVocabularyWord): Promise<VocabularyWord>;
  getVocabularyWord(id: string): Promise<VocabularyWord | undefined>;
  getVocabularyWords(language: string, userId: string, difficulty?: string): Promise<VocabularyWord[]>;
  updateVocabularyReview(id: string, isCorrect: boolean): Promise<VocabularyWord | undefined>;
  getDueVocabulary(language: string, userId: string, difficulty?: string, limit?: number): Promise<VocabularyWord[]>;

  // Grammar
  createGrammarExercise(data: InsertGrammarExercise): Promise<GrammarExercise>;
  getGrammarExercises(language: string, difficulty?: string): Promise<GrammarExercise[]>;

  // User Progress
  getOrCreateUserProgress(language: string, userId: string): Promise<UserProgress>;
  updateUserProgress(id: string, data: Partial<UserProgress>): Promise<UserProgress | undefined>;

  // Progress History
  createProgressHistory(data: InsertProgressHistory): Promise<ProgressHistory>;
  getProgressHistory(language: string, userId: string, days?: number): Promise<ProgressHistory[]>;

  // Pronunciation Scores
  createPronunciationScore(data: InsertPronunciationScore): Promise<PronunciationScore>;
  getPronunciationScoresByConversation(conversationId: string): Promise<PronunciationScore[]>;
  getPronunciationScoreByMessage(messageId: string): Promise<PronunciationScore | undefined>;
  getPronunciationScoreStats(conversationId: string): Promise<{ averageScore: number; totalScores: number }>;

  // Topics
  getTopics(): Promise<Topic[]>;
  getTopic(id: string): Promise<Topic | undefined>;
  createTopic(data: InsertTopic): Promise<Topic>;

  // Cultural Tips
  getCulturalTips(language: string): Promise<CulturalTip[]>;
  getCulturalTip(id: string): Promise<CulturalTip | undefined>;
  createCulturalTip(data: InsertCulturalTip): Promise<CulturalTip>;

  // Media Files
  createMediaFile(data: InsertMediaFile): Promise<MediaFile>;
  getMediaFile(id: string): Promise<MediaFile | undefined>;
  getUserMediaFiles(userId: string): Promise<MediaFile[]>;
  
  // Message Media (images in conversations)
  createMessageMedia(data: InsertMessageMedia): Promise<MessageMedia>;
  getMessageMedia(messageId: string): Promise<Array<MessageMedia & { mediaFile: MediaFile }>>;
  
  // Image Caching (for reducing API costs and improving speed)
  getCachedStockImage(searchQuery: string): Promise<MediaFile | undefined>;
  getCachedAIImage(promptHash: string): Promise<MediaFile | undefined>;
  cacheImage(data: InsertMediaFile): Promise<MediaFile>;
  incrementImageUsage(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Commented out: vocabulary words now require userId, so seed data won't work
    // this.seedData();
  }

  // Commented out: vocabulary words now require userId
  // private async seedData() {
  //   // Check if data already exists to avoid duplicates
  //   const existingVocab = await db.select().from(vocabularyWords).limit(1);
  //   if (existingVocab.length > 0) {
  //     return;
  //   }

  //   // Seed vocabulary words
  //   const spanishWords: InsertVocabularyWord[] = [
  //     { language: "spanish", word: "Hola", translation: "Hello", example: "Hola, ¿cómo estás?", pronunciation: "OH-lah", difficulty: "beginner" },
  //     { language: "spanish", word: "Gracias", translation: "Thank you", example: "Gracias por tu ayuda.", pronunciation: "GRAH-see-ahs", difficulty: "beginner" },
  //     { language: "spanish", word: "Amigo", translation: "Friend", example: "Mi amigo es muy amable.", pronunciation: "ah-MEE-goh", difficulty: "beginner" },
  //     { language: "spanish", word: "Casa", translation: "House", example: "Mi casa es grande.", pronunciation: "KAH-sah", difficulty: "beginner" },
  //     { language: "spanish", word: "Comida", translation: "Food", example: "La comida está deliciosa.", pronunciation: "koh-MEE-dah", difficulty: "intermediate" },
  //   ];

  //   for (const word of spanishWords) {
  //     await this.createVocabularyWord(word);
  //   }

  //   // Seed grammar exercises
  //   const spanishGrammar: InsertGrammarExercise[] = [
  //     {
  //       language: "spanish",
  //       difficulty: "beginner",
  //       question: "Complete: Yo ___ estudiante.",
  //       options: ["es", "soy", "eres", "está"],
  //       correctAnswer: 1,
  //       explanation: "Use 'soy' for the first person singular of the verb 'ser' (to be).",
  //     },
  //     {
  //       language: "spanish",
  //       difficulty: "intermediate",
  //       question: "Choose the correct verb: Ella ___ una manzana.",
  //       options: ["come", "como", "comes", "comen"],
  //       correctAnswer: 0,
  //       explanation: "'Come' is the third person singular form of 'comer' (to eat).",
  //     },
  //   ];

  //   for (const exercise of spanishGrammar) {
  //     await this.createGrammarExercise(exercise);
  //   }

  //   // Seed topics
  //   const initialTopics: InsertTopic[] = [
  //     {
  //       name: "Shopping & Retail",
  //       description: "Practice buying items, asking for prices, and navigating stores",
  //       category: "Daily Life",
  //       icon: "ShoppingCart",
  //       samplePhrases: ["How much does this cost?", "I'd like to buy...", "Do you have this in another size?"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Food & Restaurants",
  //       description: "Order meals, ask about ingredients, and discuss food preferences",
  //       category: "Daily Life",
  //       icon: "UtensilsCrossed",
  //       samplePhrases: ["I'd like to order...", "What do you recommend?", "The bill, please"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Travel & Transportation",
  //       description: "Navigate airports, hotels, and public transportation",
  //       category: "Travel",
  //       icon: "Plane",
  //       samplePhrases: ["Where is the train station?", "I need a ticket to...", "How long does it take?"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Directions & Navigation",
  //       description: "Ask for and give directions in the city",
  //       category: "Travel",
  //       icon: "MapPin",
  //       samplePhrases: ["How do I get to...?", "Is it far from here?", "Turn left at..."],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Weather & Small Talk",
  //       description: "Discuss weather, seasons, and make casual conversation",
  //       category: "Daily Life",
  //       icon: "CloudSun",
  //       samplePhrases: ["How's the weather today?", "It's really hot/cold", "I love this season"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Work & Business",
  //       description: "Professional conversations, meetings, and workplace communication",
  //       category: "Business",
  //       icon: "Briefcase",
  //       samplePhrases: ["I work as a...", "Let's schedule a meeting", "What's your job?"],
  //       difficulty: "intermediate",
  //     },
  //     {
  //       name: "Hobbies & Interests",
  //       description: "Talk about sports, music, movies, books, and personal interests",
  //       category: "Social",
  //       icon: "Music",
  //       samplePhrases: ["I like to...", "What do you do for fun?", "My favorite is..."],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Family & Relationships",
  //       description: "Discuss family members, friends, and personal relationships",
  //       category: "Social",
  //       icon: "Users",
  //       samplePhrases: ["I have two brothers", "This is my friend...", "My family lives in..."],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Health & Medical",
  //       description: "Visit doctors, pharmacies, and discuss health concerns",
  //       category: "Daily Life",
  //       icon: "Heart",
  //       samplePhrases: ["I don't feel well", "I need medicine for...", "Where is the hospital?"],
  //       difficulty: "intermediate",
  //     },
  //     {
  //       name: "Technology & Gadgets",
  //       description: "Talk about phones, computers, apps, and digital life",
  //       category: "Modern Life",
  //       icon: "Smartphone",
  //       samplePhrases: ["My phone isn't working", "Can I have the WiFi password?", "I use this app..."],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Home & Accommodation",
  //       description: "Describe your home, rent apartments, and discuss living spaces",
  //       category: "Daily Life",
  //       icon: "Home",
  //       samplePhrases: ["I live in a...", "How many rooms?", "I'm looking for an apartment"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Education & Learning",
  //       description: "Discuss school, university, studies, and educational experiences",
  //       category: "Social",
  //       icon: "GraduationCap",
  //       samplePhrases: ["I'm studying...", "What's your major?", "I go to... school"],
  //       difficulty: null,
  //     },
  //   ];

  //   for (const topic of initialTopics) {
  //     await this.createTopic(topic);
  //   }

  //   // Seed cultural tips
  //   const culturalTips: InsertCulturalTip[] = [
  //     // Spanish cultural tips
  //     {
  //       language: "spanish",
  //       category: "Greetings",
  //       title: "Double-Cheek Kiss Greeting",
  //       content: "In Spain and many Latin American countries, it's customary to greet friends and family with two kisses on the cheek (one on each side). Start with the right cheek first.",
  //       context: "Common in social settings with friends and family",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "spanish",
  //       category: "Dining",
  //       title: "Late Dinner Times",
  //       content: "In Spain, dinner (la cena) is typically eaten much later than in other countries—often between 9 PM and 11 PM. Restaurants may not even open for dinner until 8:30 PM.",
  //       context: "When dining out in Spain",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     {
  //       language: "spanish",
  //       category: "Social Norms",
  //       title: "Siesta Tradition",
  //       content: "The siesta is a traditional afternoon rest period in Spain, typically from 2-5 PM. Many small shops and businesses close during this time, though this practice is becoming less common in larger cities.",
  //       context: "Shopping and business hours in Spain",
  //       relatedTopics: ["Shopping & Retail", "Daily Routines"],
  //       icon: "Clock",
  //     },
  //     // French cultural tips
  //     {
  //       language: "french",
  //       category: "Greetings",
  //       title: "La Bise Greeting",
  //       content: "In France, 'la bise' (cheek kisses) is a common greeting. The number varies by region—Paris typically does 2, while some southern regions do 3 or 4. Air kissing (not actual lip contact) while touching cheeks is the norm.",
  //       context: "Greeting friends and acquaintances",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "french",
  //       category: "Dining",
  //       title: "Bread Etiquette",
  //       content: "In French dining, bread is placed directly on the tablecloth, not on your plate. Break it with your hands rather than cutting it with a knife. It's used to push food onto your fork.",
  //       context: "Dining at restaurants or formal meals",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     {
  //       language: "french",
  //       category: "Social Norms",
  //       title: "Formal vs. Informal 'You'",
  //       content: "French has two forms of 'you': 'tu' (informal) and 'vous' (formal). Always use 'vous' with strangers, elderly people, or in professional settings. Wait for others to invite you to use 'tu'.",
  //       context: "All social and professional interactions",
  //       relatedTopics: null,
  //       icon: "MessageSquare",
  //     },
  //     // German cultural tips
  //     {
  //       language: "german",
  //       category: "Social Norms",
  //       title: "Punctuality is Sacred",
  //       content: "Being on time is extremely important in German culture. Arriving even 5 minutes late is considered rude. If you're running late, always call ahead to inform the other party.",
  //       context: "All appointments and social gatherings",
  //       relatedTopics: null,
  //       icon: "Clock",
  //     },
  //     {
  //       language: "german",
  //       category: "Dining",
  //       title: "Table Manners: Keep Hands Visible",
  //       content: "In German dining etiquette, keep both hands on or above the table at all times (but not elbows). Resting your hands in your lap is considered poor manners.",
  //       context: "Formal and casual dining",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     // Italian cultural tips
  //     {
  //       language: "italian",
  //       category: "Dining",
  //       title: "Coffee Culture Rules",
  //       content: "Italians drink cappuccino only in the morning, never after 11 AM. Espresso is the afternoon/evening coffee. Ordering a cappuccino after lunch marks you as a tourist.",
  //       context: "Ordering coffee at cafés",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "Coffee",
  //     },
  //     {
  //       language: "italian",
  //       category: "Social Norms",
  //       title: "Passionate Hand Gestures",
  //       content: "Hand gestures are an integral part of Italian communication. Italians use their hands expressively while speaking, and certain gestures have specific meanings that vary by region.",
  //       context: "Everyday conversation",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Hand",
  //     },
  //     // Portuguese cultural tips
  //     {
  //       language: "portuguese",
  //       category: "Greetings",
  //       title: "Warm Physical Greetings",
  //       content: "In Brazil, greetings often include hugs and kisses on both cheeks, even in business settings. In Portugal, handshakes are more common in professional contexts, while cheek kisses are for friends.",
  //       context: "Meeting people socially or professionally",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "portuguese",
  //       category: "Social Norms",
  //       title: "Beach and Casual Culture (Brazil)",
  //       content: "In Brazil, especially in coastal cities, casual beachwear (havaianas, shorts) is acceptable in many settings. Brazilians value comfort and relaxed dress codes in everyday situations.",
  //       context: "Everyday dress and social situations",
  //       relatedTopics: null,
  //       icon: "Sun",
  //     },
  //     // Japanese cultural tips
  //     {
  //       language: "japanese",
  //       category: "Greetings",
  //       title: "Bowing Etiquette",
  //       content: "Bowing is the traditional Japanese greeting. A slight bow (15°) is casual, while deeper bows (30°-45°) show more respect. The depth and duration depend on the social context and the person's status.",
  //       context: "All social and professional interactions",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "japanese",
  //       category: "Dining",
  //       title: "Chopstick Taboos",
  //       content: "Never stick chopsticks vertically into rice (resembles funeral rituals) or pass food chopstick-to-chopstick (also funeral-related). Rest chopsticks on the holder when not using them.",
  //       context: "Dining with chopsticks",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     {
  //       language: "japanese",
  //       category: "Social Norms",
  //       title: "Taking Shoes Off",
  //       content: "Remove shoes before entering homes, temples, and some traditional restaurants. Slippers are usually provided. Never wear outdoor shoes on tatami mats.",
  //       context: "Entering homes and certain establishments",
  //       relatedTopics: null,
  //       icon: "Home",
  //     },
  //     // Mandarin Chinese cultural tips
  //     {
  //       language: "mandarin",
  //       category: "Dining",
  //       title: "Refusing Food Politely",
  //       content: "In Chinese culture, hosts often insist multiple times when offering food. It's polite to refuse once or twice before accepting. Accepting immediately might seem greedy.",
  //       context: "Dining in someone's home or at banquets",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     {
  //       language: "mandarin",
  //       category: "Gift Giving",
  //       title: "Red Envelopes for Luck",
  //       content: "Red envelopes (红包, hóngbāo) containing money are given during holidays, weddings, and special occasions. The color red symbolizes luck and prosperity. Never give amounts with the number 4.",
  //       context: "Holidays, weddings, Chinese New Year",
  //       relatedTopics: null,
  //       icon: "Gift",
  //     },
  //     // Korean cultural tips
  //     {
  //       language: "korean",
  //       category: "Social Norms",
  //       title: "Respect for Elders",
  //       content: "Age hierarchy is very important in Korean culture. Always show respect to elders by using formal language, letting them eat first, and bowing when greeting. Pour drinks for elders with both hands.",
  //       context: "All social interactions",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "korean",
  //       category: "Dining",
  //       title: "Soju Drinking Etiquette",
  //       content: "When drinking soju or alcohol, turn your head away from elders when taking a sip as a sign of respect. Receive drinks with both hands, and never pour your own drink—pour for others and they'll pour for you.",
  //       context: "Social drinking situations",
  //       relatedTopics: ["Food & Restaurants", "Social Interactions"],
  //       icon: "Wine",
  //     },
  //   ];

  //   for (const tip of culturalTips) {
  //     await this.createCulturalTip(tip);
  //   }
  // }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const [upserted] = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async updateUserPreferences(userId: string, preferences: {
    targetLanguage?: string;
    nativeLanguage?: string;
    difficultyLevel?: string;
    onboardingCompleted?: boolean;
  }): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
  }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...stripeInfo, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Usage tracking for voice messages
  async resetMonthlyUsageIfNeeded(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    const now = new Date();
    const lastReset = user.lastMessageResetDate ? new Date(user.lastMessageResetDate) : new Date(0);
    
    // Check if we're in a new month
    const isNewMonth = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
    
    if (isNewMonth) {
      await db.update(users)
        .set({
          monthlyMessageCount: 0,
          lastMessageResetDate: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    }
  }

  async checkVoiceUsage(userId: string): Promise<{allowed: boolean, remaining: number, limit: number}> {
    // Reset monthly counter if needed
    await this.resetMonthlyUsageIfNeeded(userId);
    
    const user = await this.getUser(userId);
    if (!user) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    // DEVELOPER OVERRIDE: Admins and developers bypass all limits
    const developerRoles = ['admin', 'developer'];
    if (user.role && developerRoles.includes(user.role)) {
      console.log(`[DEVELOPER MODE] User ${userId} (role: ${user.role}) bypassing voice limits`);
      return {
        allowed: true,
        remaining: 999999,
        limit: 999999,
      };
    }

    const currentCount = user.monthlyMessageCount || 0;
    const limit = user.monthlyMessageLimit || 20;
    
    // Paid tiers have "unlimited" (high limit like 999999)
    const paidTiers = ['basic', 'pro', 'institutional'];
    const isPaidTier = user.subscriptionTier && paidTiers.includes(user.subscriptionTier);
    const effectiveLimit = isPaidTier ? 999999 : limit;

    const allowed = currentCount < effectiveLimit;
    const remaining = Math.max(0, effectiveLimit - currentCount);

    return {
      allowed,
      remaining,
      limit: effectiveLimit,
    };
  }

  async incrementVoiceUsage(userId: string): Promise<void> {
    // Atomic increment with limit check to prevent race conditions
    // This UPDATE will only succeed if the current count is below the limit
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // DEVELOPER OVERRIDE: Admins and developers don't increment counter
    const developerRoles = ['admin', 'developer'];
    if (user.role && developerRoles.includes(user.role)) {
      console.log(`[DEVELOPER MODE] User ${userId} (role: ${user.role}) skipping usage increment`);
      return; // Skip increment for developers
    }

    const limit = user.monthlyMessageLimit || 20;
    const paidTiers = ['basic', 'pro', 'institutional'];
    const isPaidTier = user.subscriptionTier && paidTiers.includes(user.subscriptionTier);
    const effectiveLimit = isPaidTier ? 999999 : limit;

    const [updated] = await db
      .update(users)
      .set({
        monthlyMessageCount: sql`${users.monthlyMessageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, userId),
          sql`${users.monthlyMessageCount} < ${effectiveLimit}`
        )
      )
      .returning();

    // If no row was updated, user has exceeded limit (race condition)
    if (!updated) {
      throw new Error('Voice usage limit exceeded');
    }
  }

  async checkAndIncrementVoiceUsage(userId: string): Promise<{allowed: boolean, remaining: number, limit: number}> {
    // Reset monthly counter if needed
    await this.resetMonthlyUsageIfNeeded(userId);
    
    const user = await this.getUser(userId);
    if (!user) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    // DEVELOPER OVERRIDE: Admins and developers bypass all limits
    const developerRoles = ['admin', 'developer'];
    if (user.role && developerRoles.includes(user.role)) {
      console.log(`[DEVELOPER MODE] User ${userId} (role: ${user.role}) bypassing voice limits (no increment)`);
      return {
        allowed: true,
        remaining: 999999,
        limit: 999999,
      };
    }

    const currentCount = user.monthlyMessageCount || 0;
    const limit = user.monthlyMessageLimit || 20;
    
    // Paid tiers have "unlimited" (high limit like 999999)
    // Explicitly check for paid tier values to avoid undefined/null bugs
    const paidTiers = ['basic', 'pro', 'institutional'];
    const isPaidTier = user.subscriptionTier && paidTiers.includes(user.subscriptionTier);
    const effectiveLimit = isPaidTier ? 999999 : limit;

    // Atomic increment with limit check to prevent race conditions
    // This UPDATE will only succeed if the current count is below the limit
    const [updated] = await db
      .update(users)
      .set({
        monthlyMessageCount: sql`${users.monthlyMessageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, userId),
          sql`${users.monthlyMessageCount} < ${effectiveLimit}`
        )
      )
      .returning();

    // If no row was updated, user has exceeded limit
    if (!updated) {
      return {
        allowed: false,
        remaining: 0,
        limit: effectiveLimit,
      };
    }

    const newCount = updated.monthlyMessageCount || 0;
    return {
      allowed: true,
      remaining: Math.max(0, effectiveLimit - newCount),
      limit: effectiveLimit,
    };
  }

  async getUserUsageStats(userId: string): Promise<{monthlyMessageCount: number, monthlyMessageLimit: number, remaining: number}> {
    await this.resetMonthlyUsageIfNeeded(userId);
    
    const user = await this.getUser(userId);
    if (!user) {
      return { monthlyMessageCount: 0, monthlyMessageLimit: 0, remaining: 0 };
    }

    const count = user.monthlyMessageCount || 0;
    const limit = user.monthlyMessageLimit || 20;
    
    // Explicitly check for paid tier values to avoid undefined/null bugs
    const paidTiers = ['basic', 'pro', 'institutional'];
    const isPaidTier = user.subscriptionTier && paidTiers.includes(user.subscriptionTier);
    const effectiveLimit = isPaidTier ? 999999 : limit;

    return {
      monthlyMessageCount: count,
      monthlyMessageLimit: effectiveLimit,
      remaining: Math.max(0, effectiveLimit - count),
    };
  }

  // Stripe data queries (from stripe-replit-sync PostgreSQL tables)
  async getProduct(productId: string): Promise<any | null> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listProducts(active = true, limit = 20, offset = 0): Promise<any[]> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows;
  }

  async getPrice(priceId: string): Promise<any | null> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`
    );
    return result.rows[0] || null;
  }

  async listPrices(active = true, limit = 20, offset = 0): Promise<any[]> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows;
  }

  async getSubscription(subscriptionId: string): Promise<any | null> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }

  async createConversation(data: typeof conversations.$inferInsert): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(data).returning();
    return conversation;
  }

  async getConversation(id: string, userId: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    return result[0];
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return await db.select().from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));
  }

  private async getConversationById(id: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async getConversationsByLanguage(language: string, userId: string): Promise<Conversation[]> {
    return await db.select().from(conversations)
      .where(and(eq(conversations.language, language), eq(conversations.userId, userId)))
      .orderBy(desc(conversations.createdAt));
  }

  async getConversationByLanguageAndDifficulty(language: string, difficulty: string, userId: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations)
      .where(and(
        eq(conversations.language, language),
        eq(conversations.difficulty, difficulty),
        eq(conversations.userId, userId)
      ));
    return result[0];
  }

  async updateConversation(id: string, userId: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    
    const [updated] = await db.update(conversations)
      .set(filteredData)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();
    
    return updated;
  }

  private async updateConversationInternal(id: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    
    const [updated] = await db.update(conversations)
      .set(filteredData)
      .where(eq(conversations.id, id))
      .returning();
    
    return updated;
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const conversation = await this.getConversation(id, userId);
    if (!conversation) {
      return false;
    }
    
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(pronunciationScores).where(eq(pronunciationScores.conversationId, id));
    const result = await db.delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(data).returning();

    const conversation = await this.getConversationById(data.conversationId);
    if (conversation) {
      const allMessages = await this.getMessagesByConversation(data.conversationId);
      
      let duration = 0;
      if (allMessages.length > 0) {
        const firstMessage = allMessages[0];
        const lastMessage = allMessages[allMessages.length - 1];
        const durationMs = new Date(lastMessage.createdAt).getTime() - new Date(firstMessage.createdAt).getTime();
        duration = Math.floor(durationMs / 60000);
      }
      
      await this.updateConversationInternal(data.conversationId, {
        messageCount: conversation.messageCount + 1,
        duration,
      });
    }

    return message;
  }

  async getMessage(messageId: string, userId: string): Promise<Message | undefined> {
    const result = await db.select({
      id: messages.id,
      conversationId: messages.conversationId,
      role: messages.role,
      content: messages.content,
      targetLanguageText: messages.targetLanguageText,
      mediaJson: messages.mediaJson,
      performanceScore: messages.performanceScore,
      enrichmentStatus: messages.enrichmentStatus,
      createdAt: messages.createdAt,
    })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(
        eq(messages.id, messageId),
        eq(conversations.userId, userId)
      ))
      .limit(1);
    
    return result[0];
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async updateMessage(id: string, data: Partial<Message>): Promise<Message | undefined> {
    const [updated] = await db.update(messages)
      .set(data)
      .where(eq(messages.id, id))
      .returning();
    return updated;
  }

  async createVocabularyWord(data: InsertVocabularyWord): Promise<VocabularyWord> {
    const [word] = await db.insert(vocabularyWords).values(data).returning();
    return word;
  }

  async getVocabularyWord(id: string): Promise<VocabularyWord | undefined> {
    const [word] = await db
      .select()
      .from(vocabularyWords)
      .where(eq(vocabularyWords.id, id))
      .limit(1);
    return word;
  }

  async getVocabularyWords(language: string, userId: string, difficulty?: string): Promise<VocabularyWord[]> {
    if (difficulty) {
      return await db.select().from(vocabularyWords)
        .where(and(
          eq(vocabularyWords.language, language),
          eq(vocabularyWords.userId, userId),
          eq(vocabularyWords.difficulty, difficulty)
        ));
    }
    return await db.select().from(vocabularyWords)
      .where(and(eq(vocabularyWords.language, language), eq(vocabularyWords.userId, userId)));
  }

  async updateVocabularyReview(id: string, isCorrect: boolean): Promise<VocabularyWord | undefined> {
    const result = await db.select().from(vocabularyWords).where(eq(vocabularyWords.id, id));
    const word = result[0];
    if (!word) return undefined;

    const currentState = {
      easeFactor: word.easeFactor,
      interval: word.interval,
      correctCount: word.correctCount,
      incorrectCount: word.incorrectCount,
      repetition: word.repetition,
    };

    const reviewResult = isCorrect ? markCorrect(currentState) : markIncorrect(currentState);

    const [updated] = await db.update(vocabularyWords)
      .set({
        nextReviewDate: reviewResult.nextReviewDate,
        easeFactor: reviewResult.easeFactor,
        interval: reviewResult.interval,
        correctCount: reviewResult.correctCount,
        incorrectCount: reviewResult.incorrectCount,
        repetition: reviewResult.repetition,
      })
      .where(eq(vocabularyWords.id, id))
      .returning();

    return updated;
  }

  async getDueVocabulary(language: string, userId: string, difficulty?: string, limit: number = 5): Promise<VocabularyWord[]> {
    const now = new Date();
    const conditions = [
      eq(vocabularyWords.language, language),
      eq(vocabularyWords.userId, userId),
      sql`${vocabularyWords.nextReviewDate} <= ${now}`
    ];

    if (difficulty) {
      conditions.push(eq(vocabularyWords.difficulty, difficulty));
    }

    return await db.select().from(vocabularyWords)
      .where(and(...conditions))
      .orderBy(vocabularyWords.nextReviewDate)
      .limit(limit);
  }

  async createGrammarExercise(data: InsertGrammarExercise): Promise<GrammarExercise> {
    const [exercise] = await db.insert(grammarExercises).values(data).returning();
    return exercise;
  }

  async getGrammarExercises(language: string, difficulty?: string): Promise<GrammarExercise[]> {
    if (difficulty) {
      return await db.select().from(grammarExercises)
        .where(and(eq(grammarExercises.language, language), eq(grammarExercises.difficulty, difficulty)));
    }
    return await db.select().from(grammarExercises)
      .where(eq(grammarExercises.language, language));
  }

  async getOrCreateUserProgress(language: string, userId: string): Promise<UserProgress> {
    const result = await db.select().from(userProgressTable)
      .where(and(eq(userProgressTable.language, language), eq(userProgressTable.userId, userId)));
    
    if (result.length > 0) {
      return result[0];
    }

    const [progress] = await db.insert(userProgressTable)
      .values({ language, userId })
      .returning();
    return progress;
  }

  async updateUserProgress(id: string, data: Partial<UserProgress>): Promise<UserProgress | undefined> {
    const [updated] = await db.update(userProgressTable)
      .set(data)
      .where(eq(userProgressTable.id, id))
      .returning();
    return updated;
  }

  async createProgressHistory(data: InsertProgressHistory): Promise<ProgressHistory> {
    const [history] = await db.insert(progressHistoryTable).values(data).returning();
    return history;
  }

  async getProgressHistory(language: string, userId: string, days: number = 30): Promise<ProgressHistory[]> {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return await db.select().from(progressHistoryTable)
      .where(and(
        eq(progressHistoryTable.language, language),
        eq(progressHistoryTable.userId, userId),
        gte(progressHistoryTable.date, cutoffDate)
      ))
      .orderBy(progressHistoryTable.date);
  }

  async createPronunciationScore(data: InsertPronunciationScore): Promise<PronunciationScore> {
    const [score] = await db.insert(pronunciationScores).values(data).returning();
    return score;
  }

  async getPronunciationScoresByConversation(conversationId: string): Promise<PronunciationScore[]> {
    return await db.select().from(pronunciationScores)
      .where(eq(pronunciationScores.conversationId, conversationId))
      .orderBy(pronunciationScores.createdAt);
  }

  async getPronunciationScoreByMessage(messageId: string): Promise<PronunciationScore | undefined> {
    const result = await db.select().from(pronunciationScores)
      .where(eq(pronunciationScores.messageId, messageId));
    return result[0];
  }

  async getPronunciationScoreStats(conversationId: string): Promise<{ averageScore: number; totalScores: number }> {
    const scores = await this.getPronunciationScoresByConversation(conversationId);
    if (scores.length === 0) {
      return { averageScore: 0, totalScores: 0 };
    }
    const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
    return {
      averageScore: Math.round(totalScore / scores.length),
      totalScores: scores.length,
    };
  }

  async getTopics(): Promise<Topic[]> {
    return await db.select().from(topicsTable);
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    const result = await db.select().from(topicsTable).where(eq(topicsTable.id, id));
    return result[0];
  }

  async createTopic(data: InsertTopic): Promise<Topic> {
    const [topic] = await db.insert(topicsTable).values(data).returning();
    return topic;
  }

  async getCulturalTips(language: string): Promise<CulturalTip[]> {
    return await db.select().from(culturalTipsTable)
      .where(eq(culturalTipsTable.language, language));
  }

  async getCulturalTip(id: string): Promise<CulturalTip | undefined> {
    const result = await db.select().from(culturalTipsTable).where(eq(culturalTipsTable.id, id));
    return result[0];
  }

  async createCulturalTip(data: InsertCulturalTip): Promise<CulturalTip> {
    const [culturalTip] = await db.insert(culturalTipsTable).values(data).returning();
    return culturalTip;
  }

  // Media Files
  async createMediaFile(data: InsertMediaFile): Promise<MediaFile> {
    const [mediaFile] = await db.insert(mediaFiles).values(data).returning();
    return mediaFile;
  }

  async getMediaFile(id: string): Promise<MediaFile | undefined> {
    const result = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id));
    return result[0];
  }

  async getUserMediaFiles(userId: string): Promise<MediaFile[]> {
    return await db.select().from(mediaFiles)
      .where(eq(mediaFiles.uploadedBy, userId))
      .orderBy(desc(mediaFiles.createdAt));
  }

  // Message Media (images in conversations)
  async createMessageMedia(data: InsertMessageMedia): Promise<MessageMedia> {
    const [media] = await db.insert(messageMedia).values(data).returning();
    return media;
  }

  async getMessageMedia(messageId: string): Promise<Array<MessageMedia & { mediaFile: MediaFile }>> {
    const results = await db
      .select()
      .from(messageMedia)
      .leftJoin(mediaFiles, eq(messageMedia.mediaFileId, mediaFiles.id))
      .where(eq(messageMedia.messageId, messageId));

    return results.map(r => ({
      ...r.message_media,
      mediaFile: r.media_files!,
    }));
  }

  // Image Caching - for reducing API costs and improving speed
  async getCachedStockImage(searchQuery: string): Promise<MediaFile | undefined> {
    const result = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.imageSource, "stock"),
          eq(mediaFiles.searchQuery, searchQuery)
        )
      )
      .limit(1);
    return result[0];
  }

  async getCachedAIImage(promptHash: string): Promise<MediaFile | undefined> {
    const result = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.imageSource, "ai_generated"),
          eq(mediaFiles.promptHash, promptHash)
        )
      )
      .limit(1);
    return result[0];
  }

  async cacheImage(data: InsertMediaFile): Promise<MediaFile> {
    const [mediaFile] = await db.insert(mediaFiles).values(data).returning();
    return mediaFile;
  }

  async incrementImageUsage(id: string): Promise<void> {
    await db
      .update(mediaFiles)
      .set({ usageCount: sql`${mediaFiles.usageCount} + 1` })
      .where(eq(mediaFiles.id, id));
  }
}

export const storage = new DatabaseStorage();

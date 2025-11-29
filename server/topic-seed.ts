import { db } from "./db";
import { topics } from "@shared/schema";
import { eq } from "drizzle-orm";

interface TopicSeed {
  name: string;
  description: string;
  topicType: 'subject' | 'grammar' | 'function';
  category: string;
  icon: string;
  samplePhrases: string[];
  difficulty?: string;
  grammarConcept?: string;
  applicableLanguages?: string[];
  actflLevelRange?: string;
}

const GRAMMAR_TOPICS: TopicSeed[] = [
  // Verb Tenses
  {
    name: "Present Tense",
    description: "Using verbs to describe current actions, habits, and general truths",
    topicType: "grammar",
    category: "Verb Tenses",
    icon: "Clock",
    samplePhrases: ["I eat", "She runs", "We study"],
    grammarConcept: "present_tense",
    actflLevelRange: "novice_low-novice_high",
  },
  {
    name: "Past Tense (Preterite)",
    description: "Describing completed actions in the past",
    topicType: "grammar",
    category: "Verb Tenses",
    icon: "History",
    samplePhrases: ["I ate", "She ran", "We studied"],
    grammarConcept: "past_preterite",
    actflLevelRange: "novice_high-intermediate_low",
  },
  {
    name: "Past Tense (Imperfect)",
    description: "Describing ongoing or habitual actions in the past",
    topicType: "grammar",
    category: "Verb Tenses",
    icon: "Rewind",
    samplePhrases: ["I was eating", "She used to run", "We were studying"],
    grammarConcept: "past_imperfect",
    actflLevelRange: "intermediate_low-intermediate_mid",
  },
  {
    name: "Future Tense",
    description: "Expressing actions that will happen",
    topicType: "grammar",
    category: "Verb Tenses",
    icon: "FastForward",
    samplePhrases: ["I will eat", "She will run", "We will study"],
    grammarConcept: "future_tense",
    actflLevelRange: "novice_high-intermediate_low",
  },
  {
    name: "Conditional Mood",
    description: "Expressing hypothetical situations and polite requests",
    topicType: "grammar",
    category: "Verb Moods",
    icon: "HelpCircle",
    samplePhrases: ["I would eat", "She would run", "Could you help me?"],
    grammarConcept: "conditional",
    actflLevelRange: "intermediate_low-intermediate_high",
  },
  {
    name: "Subjunctive Mood",
    description: "Expressing wishes, doubts, emotions, and hypotheticals",
    topicType: "grammar",
    category: "Verb Moods",
    icon: "Cloud",
    samplePhrases: ["I wish that...", "It's important that...", "I doubt that..."],
    grammarConcept: "subjunctive",
    actflLevelRange: "intermediate_mid-advanced_low",
  },
  {
    name: "Imperative Mood",
    description: "Giving commands and instructions",
    topicType: "grammar",
    category: "Verb Moods",
    icon: "AlertCircle",
    samplePhrases: ["Eat!", "Run!", "Study!"],
    grammarConcept: "imperative",
    actflLevelRange: "novice_mid-intermediate_low",
  },
  // Grammar Structures
  {
    name: "Noun-Adjective Agreement",
    description: "Matching adjectives with nouns in gender and number",
    topicType: "grammar",
    category: "Grammar Structures",
    icon: "Link",
    samplePhrases: ["the red car", "the beautiful houses", "a tall man"],
    grammarConcept: "agreement",
    applicableLanguages: ["spanish", "french", "italian", "portuguese", "german"],
    actflLevelRange: "novice_mid-novice_high",
  },
  {
    name: "Pronouns",
    description: "Using subject, object, and reflexive pronouns correctly",
    topicType: "grammar",
    category: "Grammar Structures",
    icon: "User",
    samplePhrases: ["I see him", "She gave it to me", "They help themselves"],
    grammarConcept: "pronouns",
    actflLevelRange: "novice_high-intermediate_mid",
  },
  {
    name: "Articles (Definite/Indefinite)",
    description: "Using 'the', 'a/an' and their equivalents correctly",
    topicType: "grammar",
    category: "Grammar Structures",
    icon: "FileText",
    samplePhrases: ["the book", "a car", "an apple"],
    grammarConcept: "articles",
    actflLevelRange: "novice_low-novice_mid",
  },
  {
    name: "Prepositions",
    description: "Using words that show relationships between nouns",
    topicType: "grammar",
    category: "Grammar Structures",
    icon: "ArrowRight",
    samplePhrases: ["on the table", "in the house", "with my friend"],
    grammarConcept: "prepositions",
    actflLevelRange: "novice_mid-intermediate_low",
  },
  {
    name: "Verb Conjugation",
    description: "Changing verb forms based on subject, tense, and mood",
    topicType: "grammar",
    category: "Grammar Structures",
    icon: "Settings",
    samplePhrases: ["I speak", "you speak", "she speaks"],
    grammarConcept: "conjugation",
    actflLevelRange: "novice_low-intermediate_high",
  },
  {
    name: "Irregular Verbs",
    description: "Verbs that don't follow standard conjugation patterns",
    topicType: "grammar",
    category: "Grammar Structures",
    icon: "Zap",
    samplePhrases: ["to be", "to go", "to have"],
    grammarConcept: "irregular_verbs",
    actflLevelRange: "novice_mid-intermediate_mid",
  },
  {
    name: "Question Formation",
    description: "Forming yes/no questions and information questions",
    topicType: "grammar",
    category: "Grammar Structures",
    icon: "MessageCircle",
    samplePhrases: ["Do you...?", "What is...?", "Where are...?"],
    grammarConcept: "questions",
    actflLevelRange: "novice_low-novice_high",
  },
  {
    name: "Negation",
    description: "Making sentences negative",
    topicType: "grammar",
    category: "Grammar Structures",
    icon: "XCircle",
    samplePhrases: ["I don't want", "She never goes", "Nothing happened"],
    grammarConcept: "negation",
    actflLevelRange: "novice_low-novice_mid",
  },
];

const FUNCTION_TOPICS: TopicSeed[] = [
  {
    name: "Greetings & Introductions",
    description: "Saying hello, introducing yourself, and basic social exchanges",
    topicType: "function",
    category: "Social Interaction",
    icon: "Hand",
    samplePhrases: ["Hello, my name is...", "Nice to meet you", "How are you?"],
    actflLevelRange: "novice_low-novice_mid",
  },
  {
    name: "Asking Questions",
    description: "Requesting information using question words and phrases",
    topicType: "function",
    category: "Information Exchange",
    icon: "HelpCircle",
    samplePhrases: ["What is this?", "Where is the...?", "How much does it cost?"],
    actflLevelRange: "novice_low-novice_high",
  },
  {
    name: "Making Requests",
    description: "Politely asking for things or actions",
    topicType: "function",
    category: "Social Interaction",
    icon: "MessageSquare",
    samplePhrases: ["Could you please...", "I would like...", "May I have..."],
    actflLevelRange: "novice_mid-intermediate_low",
  },
  {
    name: "Expressing Opinions",
    description: "Sharing your thoughts, preferences, and viewpoints",
    topicType: "function",
    category: "Personal Expression",
    icon: "ThumbsUp",
    samplePhrases: ["I think that...", "In my opinion...", "I prefer..."],
    actflLevelRange: "intermediate_low-intermediate_high",
  },
  {
    name: "Describing People & Things",
    description: "Giving details about appearance, characteristics, and qualities",
    topicType: "function",
    category: "Information Exchange",
    icon: "Image",
    samplePhrases: ["She has long hair", "It's a big red car", "He seems friendly"],
    actflLevelRange: "novice_mid-intermediate_low",
  },
  {
    name: "Giving Directions",
    description: "Explaining how to get somewhere",
    topicType: "function",
    category: "Information Exchange",
    icon: "MapPin",
    samplePhrases: ["Turn left at...", "Go straight", "It's next to..."],
    actflLevelRange: "novice_high-intermediate_low",
  },
  {
    name: "Expressing Feelings",
    description: "Communicating emotions and physical states",
    topicType: "function",
    category: "Personal Expression",
    icon: "Heart",
    samplePhrases: ["I'm happy", "I feel tired", "I'm excited about..."],
    actflLevelRange: "novice_mid-intermediate_low",
  },
  {
    name: "Making Plans",
    description: "Discussing future activities and scheduling",
    topicType: "function",
    category: "Social Interaction",
    icon: "Calendar",
    samplePhrases: ["Let's meet at...", "Are you free on...?", "I'm going to..."],
    actflLevelRange: "novice_high-intermediate_mid",
  },
  {
    name: "Apologizing & Excusing",
    description: "Expressing regret and asking for forgiveness",
    topicType: "function",
    category: "Social Interaction",
    icon: "AlertTriangle",
    samplePhrases: ["I'm sorry", "Excuse me", "I apologize for..."],
    actflLevelRange: "novice_low-novice_high",
  },
  {
    name: "Agreeing & Disagreeing",
    description: "Expressing agreement or polite disagreement",
    topicType: "function",
    category: "Social Interaction",
    icon: "Check",
    samplePhrases: ["I agree", "I disagree because...", "That's a good point, but..."],
    actflLevelRange: "intermediate_low-intermediate_high",
  },
  {
    name: "Narrating Events",
    description: "Telling stories and describing sequences of events",
    topicType: "function",
    category: "Personal Expression",
    icon: "Book",
    samplePhrases: ["First..., then...", "Yesterday I...", "After that..."],
    actflLevelRange: "intermediate_low-advanced_low",
  },
  {
    name: "Comparing & Contrasting",
    description: "Discussing similarities and differences",
    topicType: "function",
    category: "Information Exchange",
    icon: "GitMerge",
    samplePhrases: ["This is bigger than...", "Both are...", "Unlike X, Y is..."],
    actflLevelRange: "intermediate_low-intermediate_high",
  },
];

const SUBJECT_TOPICS: TopicSeed[] = [
  {
    name: "Travel & Transportation",
    description: "Vocabulary and phrases for traveling, airports, hotels, and getting around",
    topicType: "subject",
    category: "Daily Life",
    icon: "Plane",
    samplePhrases: ["I need a ticket", "Where is the train station?", "My flight leaves at..."],
    actflLevelRange: "novice_mid-intermediate_mid",
  },
  {
    name: "Food & Dining",
    description: "Ordering food, discussing meals, and restaurant vocabulary",
    topicType: "subject",
    category: "Daily Life",
    icon: "Utensils",
    samplePhrases: ["I would like to order...", "The check, please", "What's the special?"],
    actflLevelRange: "novice_low-intermediate_low",
  },
  {
    name: "Shopping",
    description: "Buying items, discussing prices, and retail vocabulary",
    topicType: "subject",
    category: "Daily Life",
    icon: "ShoppingBag",
    samplePhrases: ["How much is this?", "Do you have...?", "I'll take it"],
    actflLevelRange: "novice_mid-intermediate_low",
  },
  {
    name: "Family & Relationships",
    description: "Talking about family members, friends, and relationships",
    topicType: "subject",
    category: "Personal",
    icon: "Users",
    samplePhrases: ["This is my brother", "I have two children", "We've been married for..."],
    actflLevelRange: "novice_low-intermediate_low",
  },
  {
    name: "Work & Career",
    description: "Professional vocabulary, job discussions, and workplace scenarios",
    topicType: "subject",
    category: "Professional",
    icon: "Briefcase",
    samplePhrases: ["I work as a...", "The meeting is at...", "I'm responsible for..."],
    actflLevelRange: "intermediate_low-advanced_low",
  },
  {
    name: "Health & Medical",
    description: "Describing symptoms, visiting doctors, and health vocabulary",
    topicType: "subject",
    category: "Daily Life",
    icon: "Heart",
    samplePhrases: ["I have a headache", "I need to see a doctor", "Take this medicine..."],
    actflLevelRange: "novice_high-intermediate_mid",
  },
  {
    name: "Weather & Seasons",
    description: "Discussing weather conditions and seasonal activities",
    topicType: "subject",
    category: "Daily Life",
    icon: "Cloud",
    samplePhrases: ["It's raining", "What's the weather like?", "Summer is hot here"],
    actflLevelRange: "novice_low-novice_high",
  },
  {
    name: "Hobbies & Leisure",
    description: "Talking about free time activities and interests",
    topicType: "subject",
    category: "Personal",
    icon: "Smile",
    samplePhrases: ["I like to read", "I play soccer", "My hobby is..."],
    actflLevelRange: "novice_mid-intermediate_low",
  },
  {
    name: "Education & School",
    description: "Academic vocabulary, school life, and learning discussions",
    topicType: "subject",
    category: "Academic",
    icon: "GraduationCap",
    samplePhrases: ["I study at...", "My major is...", "The class starts at..."],
    actflLevelRange: "novice_mid-intermediate_mid",
  },
  {
    name: "Home & Housing",
    description: "Describing living spaces, furniture, and household items",
    topicType: "subject",
    category: "Daily Life",
    icon: "Home",
    samplePhrases: ["I live in an apartment", "The kitchen is...", "My room has..."],
    actflLevelRange: "novice_mid-intermediate_low",
  },
];

export async function seedTopics(): Promise<void> {
  console.log('[TOPIC SEED] Starting topic seeding...');
  
  const allTopics = [...GRAMMAR_TOPICS, ...FUNCTION_TOPICS, ...SUBJECT_TOPICS];
  let created = 0;
  let skipped = 0;
  
  for (const topic of allTopics) {
    try {
      const existing = await db.select()
        .from(topics)
        .where(eq(topics.name, topic.name))
        .limit(1);
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      await db.insert(topics).values({
        name: topic.name,
        description: topic.description,
        topicType: topic.topicType,
        category: topic.category,
        icon: topic.icon,
        samplePhrases: topic.samplePhrases,
        difficulty: topic.difficulty,
        grammarConcept: topic.grammarConcept,
        applicableLanguages: topic.applicableLanguages,
        actflLevelRange: topic.actflLevelRange,
      });
      
      created++;
      console.log(`[TOPIC SEED] ✓ Created: ${topic.name} (${topic.topicType})`);
    } catch (error) {
      console.error(`[TOPIC SEED] ✗ Failed to create ${topic.name}:`, error);
    }
  }
  
  console.log(`[TOPIC SEED] Complete: ${created} created, ${skipped} skipped (already exist)`);
}

export async function getTopicsByType(topicType: 'subject' | 'grammar' | 'function') {
  return await db.select()
    .from(topics)
    .where(eq(topics.topicType, topicType));
}

export async function getAllTopics() {
  return await db.select().from(topics);
}

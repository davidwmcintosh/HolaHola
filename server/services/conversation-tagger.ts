import { callGeminiWithSchema, GEMINI_MODELS } from "../gemini-utils";
import { db, getSharedDb, getUserDb } from "../db";
import { topics, conversations, conversationTopics } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

interface TopicDetectionResult {
  subjectTopics: string[];
  grammarTopics: string[];
  functionTopics: string[];
  suggestedTitle: string;
  actflLevel: string | null;
}

const TOPIC_DETECTION_SCHEMA = {
  type: "object",
  properties: {
    subjectTopics: {
      type: "array",
      description: "Subject/theme topic names detected (e.g., 'Travel & Transportation', 'Food & Dining')",
      items: { type: "string" },
    },
    grammarTopics: {
      type: "array",
      description: "Grammar concepts used in the conversation (e.g., 'Present Tense', 'Subjunctive Mood')",
      items: { type: "string" },
    },
    functionTopics: {
      type: "array",
      description: "Communicative functions practiced (e.g., 'Asking Questions', 'Making Requests')",
      items: { type: "string" },
    },
    suggestedTitle: {
      type: "string",
      description: "A concise 3-6 word title summarizing the conversation topic",
    },
    actflLevel: {
      type: "string",
      description: "Overall ACTFL proficiency level demonstrated: novice_low, novice_mid, novice_high, intermediate_low, intermediate_mid, intermediate_high, advanced_low, advanced_mid, advanced_high, or null if unclear",
    },
  },
  required: ["subjectTopics", "grammarTopics", "functionTopics", "suggestedTitle"],
};

export async function detectConversationTopics(
  messages: Array<{ role: string; content: string }>,
  targetLanguage: string,
  existingTopicNames: string[]
): Promise<TopicDetectionResult> {
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `Analyze this ${targetLanguage} language learning conversation and identify the topics covered.

CONVERSATION:
${conversationText}

AVAILABLE TOPICS TO CHOOSE FROM:
${existingTopicNames.join(", ")}

INSTRUCTIONS:
1. Identify SUBJECT topics (what the conversation was about - travel, food, family, etc.)
2. Identify GRAMMAR topics (grammatical structures used - tenses, moods, agreement, etc.)
3. Identify FUNCTION topics (communicative purposes - asking questions, making requests, etc.)
4. Suggest a concise title (3-6 words) that captures the main focus
5. Estimate the ACTFL level based on complexity and accuracy

Only use topic names from the provided list. If a topic was clearly covered in the conversation, include it.
Focus on the USER's language production, not just the tutor's responses.`;

  try {
    const result = await callGeminiWithSchema<TopicDetectionResult>(
      GEMINI_MODELS.FLASH,
      [
        { role: "system", content: "You are a language learning analyst. Analyze conversations to identify topics covered." },
        { role: "user", content: prompt },
      ],
      TOPIC_DETECTION_SCHEMA
    );

    return result;
  } catch (error) {
    console.error("[TAGGER] Error detecting topics:", error);
    return {
      subjectTopics: [],
      grammarTopics: [],
      functionTopics: [],
      suggestedTitle: "Conversation",
      actflLevel: null,
    };
  }
}

export async function tagConversation(
  conversationId: string,
  messages: Array<{ role: string; content: string }>,
  targetLanguage: string
): Promise<{ success: boolean; topicsAdded: number; title: string }> {
  console.log(`[TAGGER] Analyzing conversation ${conversationId}...`);

  try {
    const allTopics = await getSharedDb().select().from(topics);
    const topicNames = allTopics.map((t) => t.name);
    const topicsByName = new Map(allTopics.map((t) => [t.name.toLowerCase(), t]));

    const detection = await detectConversationTopics(messages, targetLanguage, topicNames);

    console.log(`[TAGGER] Detected topics:`, detection);

    const allDetectedNames = [
      ...detection.subjectTopics,
      ...detection.grammarTopics,
      ...detection.functionTopics,
    ];

    const matchedTopicIds: string[] = [];
    for (const name of allDetectedNames) {
      const topic = topicsByName.get(name.toLowerCase());
      if (topic) {
        matchedTopicIds.push(topic.id);
      }
    }

    const uniqueTopicIds = Array.from(new Set(matchedTopicIds));

    if (uniqueTopicIds.length > 0) {
      const existingLinks = await getUserDb()
        .select()
        .from(conversationTopics)
        .where(eq(conversationTopics.conversationId, conversationId));

      const existingTopicIds = new Set(existingLinks.map((l) => l.topicId));
      const newTopicIds = uniqueTopicIds.filter((id) => !existingTopicIds.has(id));

      if (newTopicIds.length > 0) {
        await getUserDb().insert(conversationTopics).values(
          newTopicIds.map((topicId) => ({
            conversationId,
            topicId,
          }))
        );
        console.log(`[TAGGER] Added ${newTopicIds.length} topic links`);
      }
    }

    const updateData: Record<string, any> = {};

    if (detection.suggestedTitle && detection.suggestedTitle !== "Conversation") {
      updateData.title = detection.suggestedTitle;
    }

    if (detection.actflLevel) {
      updateData.actflLevel = detection.actflLevel;
    }

    if (Object.keys(updateData).length > 0) {
      await getUserDb()
        .update(conversations)
        .set(updateData)
        .where(eq(conversations.id, conversationId));
      console.log(`[TAGGER] Updated conversation:`, updateData);
    }

    return {
      success: true,
      topicsAdded: uniqueTopicIds.length,
      title: detection.suggestedTitle,
    };
  } catch (error) {
    console.error("[TAGGER] Error tagging conversation:", error);
    return {
      success: false,
      topicsAdded: 0,
      title: "Conversation",
    };
  }
}

export async function getConversationTopics(conversationId: string) {
  const links = await db
    .select()
    .from(conversationTopics)
    .where(eq(conversationTopics.conversationId, conversationId));

  if (links.length === 0) {
    return [];
  }

  const topicIds = links.map((l) => l.topicId);
  const matchedTopics = await getSharedDb()
    .select()
    .from(topics)
    .where(inArray(topics.id, topicIds));

  return matchedTopics;
}

export async function analyzeVocabularyGrammar(
  word: string,
  translation: string,
  example: string,
  targetLanguage: string
): Promise<{
  wordType: string;
  verbTense?: string;
  verbMood?: string;
  verbPerson?: string;
  nounGender?: string;
  nounNumber?: string;
  grammarNotes?: string;
}> {
  const schema = {
    type: "object",
    properties: {
      wordType: {
        type: "string",
        enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "article", "other"],
        description: "The grammatical category of the word",
      },
      verbTense: {
        type: "string",
        description: "For verbs: present, past_preterite, past_imperfect, future, conditional, present_perfect, past_perfect, etc.",
      },
      verbMood: {
        type: "string",
        description: "For verbs: indicative, subjunctive, imperative",
      },
      verbPerson: {
        type: "string",
        description: "For conjugated verbs: 1st_singular, 2nd_singular, 3rd_singular, 1st_plural, 2nd_plural, 3rd_plural",
      },
      nounGender: {
        type: "string",
        description: "For nouns in gendered languages: masculine, feminine, neuter",
      },
      nounNumber: {
        type: "string",
        description: "For nouns: singular, plural",
      },
      grammarNotes: {
        type: "string",
        description: "Additional notes like 'irregular', 'reflexive', 'stem-changing', etc.",
      },
    },
    required: ["wordType"],
  };

  try {
    const result = await callGeminiWithSchema<any>(
      GEMINI_MODELS.FLASH,
      [
        {
          role: "system",
          content: `You are a ${targetLanguage} grammar expert. Analyze the grammatical properties of vocabulary words.`,
        },
        {
          role: "user",
          content: `Analyze this ${targetLanguage} vocabulary word:

Word: ${word}
Translation: ${translation}
Example: ${example}

Identify its grammatical properties (word type, verb conjugation details if applicable, noun gender/number if applicable).`,
        },
      ],
      schema
    );

    return result;
  } catch (error) {
    console.error("[TAGGER] Error analyzing vocabulary grammar:", error);
    return { wordType: "other" };
  }
}

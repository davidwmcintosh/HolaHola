import { callGeminiWithSchema, GEMINI_MODELS } from "./gemini-utils";

interface Message {
  role: string;
  content: string;
}

/**
 * Generate a brief context summary when resuming a previous conversation
 * Helps students remember what they were learning and the tone/context
 */
export async function generateConversationContextSummary(
  messages: Message[],
  conversationTitle: string | null,
  language: string
): Promise<string | null> {
  try {
    const recentMessages = messages.slice(-10);
    
    const conversationSummary = recentMessages
      .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`)
      .join('\n');
    
    console.log('[CONTEXT SUMMARY] Generating context for conversation:', conversationTitle || 'Untitled');
    
    const result = await callGeminiWithSchema<{ summary: string }>(
      GEMINI_MODELS.FLASH,
      [
        {
          role: "system",
          content: `You are a helpful assistant that creates brief, friendly context summaries for language learning conversations. When a student resumes a conversation, you help them remember what they were learning.

Rules:
- Keep it BRIEF: 2-3 sentences maximum
- Be conversational and warm
- Mention specific topics, vocabulary, or scenarios they practiced
- Don't be overly detailed - just enough to jog their memory
- Focus on WHAT they were learning, not exhaustive details
- Use second person: "You were practicing..." not "The student was..."

Good examples:
- "You were practicing how to order food at a restaurant. We covered vocabulary for drinks and appetizers, and you learned how to ask for the menu."
- "Last time we worked on job interview phrases. You practiced introducing yourself and talking about your experience."
- "You were learning travel vocabulary, especially asking for directions and understanding responses."

Bad examples:
- "This conversation covered multiple topics including..." (too formal)
- Long lists of every word learned
- Generic "You were learning Spanish" (not specific enough)`
        },
        {
          role: "user",
          content: `Create a brief, friendly context summary (2-3 sentences) for this ${language} learning conversation${conversationTitle ? ` titled "${conversationTitle}"` : ''}:\n\n${conversationSummary}`
        }
      ],
      {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "A brief, friendly 2-3 sentence summary of what the student was learning"
          }
        },
        required: ["summary"]
      }
    );

    console.log('[CONTEXT SUMMARY] Generated summary:', result.summary);
    return result.summary || null;
  } catch (error) {
    console.error('[CONTEXT SUMMARY] Failed to generate context summary:', error);
    return null;
  }
}

/**
 * Generate a descriptive title for a conversation based on its messages
 * Uses AI to analyze the conversation and create a concise, descriptive title
 */
export async function generateConversationTitle(
  messages: Array<{ role: string; content: string }>,
  language: string
): Promise<string | null> {
  try {
    const contextMessages = messages.slice(0, 8);
    
    const conversationSummary = contextMessages
      .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
      .join('\n');
    
    console.log('[TITLE GEN] Generating title for conversation in', language);
    
    const result = await callGeminiWithSchema<{ title: string; confidence: string }>(
      GEMINI_MODELS.FLASH,
      [
        {
          role: "system",
          content: `You are a helpful assistant that creates concise, descriptive titles for language learning conversations. Analyze the conversation and generate a title that captures the main topic or scenario being practiced.

Rules:
- Keep titles SHORT: 3-6 words maximum
- Use descriptive, specific language (not generic)
- Focus on the TOPIC or SCENARIO being practiced
- Use title case (capitalize main words)
- DO NOT include language name or difficulty level
- Examples of GOOD titles: "Job Interview Practice", "Ordering at a Restaurant", "Weekend Plans Discussion", "Travel Vocabulary", "Asking for Directions"
- Examples of BAD titles: "Conversation", "Learning Spanish", "Beginner Practice", "Chatting About Things"`
        },
        {
          role: "user",
          content: `Generate a concise title (3-6 words) for this ${language} learning conversation:\n\n${conversationSummary}`
        }
      ],
      {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "A concise, descriptive title (3-6 words) that captures the main topic or scenario"
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Confidence level in the generated title"
          }
        },
        required: ["title", "confidence"]
      }
    );
    
    if (result.confidence === "low") {
      console.log('[TITLE GEN] Low confidence title, skipping:', result.title);
      return null;
    }
    
    console.log('[TITLE GEN] Generated title:', result.title, '(confidence:', result.confidence + ')');
    return result.title;
  } catch (error) {
    console.error('[TITLE GEN] Failed to generate conversation title:', error);
    return null;
  }
}

interface TopicTag {
  id: string;
  name: string;
  category: string;
  confidence: number;
}

interface ConversationTaggingResult {
  subjectTopics: TopicTag[];
  grammarTopics: TopicTag[];
  functionTopics: TopicTag[];
}

/**
 * Analyze a conversation and extract relevant topic tags
 * Tags include subject topics (travel, food), grammar topics (subjunctive, past tense),
 * and function topics (asking questions, expressing opinions)
 */
export async function analyzeConversationTopics(
  messages: Array<{ role: string; content: string }>,
  language: string,
  availableTopics: Array<{ id: string; name: string; category: string }>
): Promise<ConversationTaggingResult> {
  try {
    const conversationSummary = messages
      .slice(-20)
      .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.substring(0, 300)}`)
      .join('\n');
    
    const topicList = availableTopics.map(t => `- ${t.name} (${t.category}): ID=${t.id}`).join('\n');
    
    console.log('[TOPIC ANALYSIS] Analyzing conversation for topics in', language);
    
    const result = await callGeminiWithSchema<{
      topics: Array<{ topicId: string; confidence: number }>
    }>(
      GEMINI_MODELS.FLASH,
      [
        {
          role: "system",
          content: `You are an expert language learning analyst. Analyze the conversation and identify which topics were practiced.

Available topics:
${topicList}

Rules:
- Only return topics that were ACTUALLY practiced in the conversation
- Assign confidence scores (0.0-1.0) based on how much that topic was covered
- Include SUBJECT topics (what they talked about), GRAMMAR topics (what grammar they practiced), and FUNCTION topics (communication functions used)
- Be selective - only include topics with confidence >= 0.5
- Maximum 5 topics total`
        },
        {
          role: "user",
          content: `Analyze this ${language} learning conversation and identify the topics practiced:\n\n${conversationSummary}`
        }
      ],
      {
        type: "object",
        properties: {
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                topicId: { type: "string" },
                confidence: { type: "number" }
              },
              required: ["topicId", "confidence"]
            }
          }
        },
        required: ["topics"]
      }
    );

    const taggedTopics = result.topics
      .filter(t => t.confidence >= 0.5)
      .map(t => {
        const topic = availableTopics.find(at => at.id === t.topicId);
        if (!topic) return null;
        return {
          id: topic.id,
          name: topic.name,
          category: topic.category,
          confidence: t.confidence
        };
      })
      .filter((t): t is TopicTag => t !== null);

    return {
      subjectTopics: taggedTopics.filter(t => t.category === 'subject'),
      grammarTopics: taggedTopics.filter(t => t.category === 'grammar'),
      functionTopics: taggedTopics.filter(t => t.category === 'function')
    };
  } catch (error) {
    console.error('[TOPIC ANALYSIS] Failed to analyze conversation topics:', error);
    return { subjectTopics: [], grammarTopics: [], functionTopics: [] };
  }
}

interface VocabularyGrammarInfo {
  wordType: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'pronoun' | 'other';
  verbTense?: string;
  verbMood?: string;
  verbPerson?: string;
  nounGender?: string;
  nounNumber?: string;
  grammarNotes?: string;
}

/**
 * Analyze vocabulary words to extract grammar classification
 * Determines word type, tense (for verbs), gender (for nouns), etc.
 */
export async function analyzeVocabularyGrammar(
  words: Array<{ word: string; translation: string; example: string }>,
  language: string
): Promise<Map<string, VocabularyGrammarInfo>> {
  try {
    console.log('[VOCAB GRAMMAR] Analyzing', words.length, 'words for grammar info in', language);
    
    const wordList = words.map(w => `- "${w.word}" (${w.translation}): "${w.example}"`).join('\n');
    
    const result = await callGeminiWithSchema<{
      words: Array<{
        word: string;
        wordType: string;
        verbTense?: string;
        verbMood?: string;
        verbPerson?: string;
        nounGender?: string;
        nounNumber?: string;
        grammarNotes?: string;
      }>
    }>(
      GEMINI_MODELS.FLASH,
      [
        {
          role: "system",
          content: `You are a linguistics expert. Analyze each vocabulary word and determine its grammatical properties.

For each word, determine:
- wordType: noun, verb, adjective, adverb, preposition, conjunction, pronoun, or other
- For VERBS: verbTense (present, past, future, conditional, etc.), verbMood (indicative, subjunctive, imperative), verbPerson (1st, 2nd, 3rd singular/plural)
- For NOUNS: nounGender (masculine, feminine, neutral), nounNumber (singular, plural)
- grammarNotes: Any other relevant grammar notes (e.g., "reflexive verb", "irregular conjugation")

Use the example sentence to determine the exact form being used.`
        },
        {
          role: "user",
          content: `Analyze these ${language} vocabulary words:\n\n${wordList}`
        }
      ],
      {
        type: "object",
        properties: {
          words: {
            type: "array",
            items: {
              type: "object",
              properties: {
                word: { type: "string" },
                wordType: { type: "string", enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "other"] },
                verbTense: { type: "string" },
                verbMood: { type: "string" },
                verbPerson: { type: "string" },
                nounGender: { type: "string" },
                nounNumber: { type: "string" },
                grammarNotes: { type: "string" }
              },
              required: ["word", "wordType"]
            }
          }
        },
        required: ["words"]
      }
    );

    const grammarMap = new Map<string, VocabularyGrammarInfo>();
    for (const w of result.words) {
      grammarMap.set(w.word, {
        wordType: w.wordType as VocabularyGrammarInfo['wordType'],
        verbTense: w.verbTense,
        verbMood: w.verbMood,
        verbPerson: w.verbPerson,
        nounGender: w.nounGender,
        nounNumber: w.nounNumber,
        grammarNotes: w.grammarNotes
      });
    }

    console.log('[VOCAB GRAMMAR] Analyzed', grammarMap.size, 'words');
    return grammarMap;
  } catch (error) {
    console.error('[VOCAB GRAMMAR] Failed to analyze vocabulary grammar:', error);
    return new Map();
  }
}

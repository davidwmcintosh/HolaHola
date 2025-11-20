import OpenAI from "openai";

interface Message {
  role: string;
  content: string;
}

/**
 * Generate a brief context summary when resuming a previous conversation
 * Helps students remember what they were learning and the tone/context
 */
export async function generateConversationContextSummary(
  openai: OpenAI,
  messages: Message[],
  conversationTitle: string | null,
  language: string
): Promise<string | null> {
  try {
    // Take last 10 messages for most recent context
    const recentMessages = messages.slice(-10);
    
    // Build a summary of recent exchanges
    const conversationSummary = recentMessages
      .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`)
      .join('\n');
    
    console.log('[CONTEXT SUMMARY] Generating context for conversation:', conversationTitle || 'Untitled');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
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
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "context_summary",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "A brief, friendly 2-3 sentence summary of what the student was learning"
              }
            },
            required: ["summary"],
            additionalProperties: false
          }
        }
      }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn('[CONTEXT SUMMARY] OpenAI returned empty content');
      return null;
    }
    
    const result = JSON.parse(content);
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
  openai: OpenAI,
  messages: Array<{ role: string; content: string }>,
  language: string
): Promise<string | null> {
  try {
    // Take the first 6-8 messages for context (user + AI responses)
    const contextMessages = messages.slice(0, 8);
    
    // Build a summary of the conversation for the AI
    const conversationSummary = contextMessages
      .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
      .join('\n');
    
    console.log('[TITLE GEN] Generating title for conversation in', language);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
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
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "conversation_title",
          strict: true,
          schema: {
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
            required: ["title", "confidence"],
            additionalProperties: false
          }
        }
      }
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    
    // Only return high or medium confidence titles
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

import OpenAI from "openai";

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

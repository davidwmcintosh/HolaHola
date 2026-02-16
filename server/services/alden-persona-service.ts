import Anthropic from "@anthropic-ai/sdk";
import { buildAldenSystemPrompt } from "../alden-system-prompt";
import { ALDEN_TOOLS, executeAldenTool } from "./alden-functions";

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;

  anthropicClient = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
  return anthropicClient;
}

interface AldenChatParams {
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; content: string }>;
  founderName?: string;
  timezone?: string;
}

interface AldenChatResponse {
  response: string;
  toolsUsed: string[];
}

const MAX_AGENT_ROUNDS = 4;

export async function generateAldenResponse(params: AldenChatParams): Promise<AldenChatResponse> {
  const { userMessage, conversationHistory = [], founderName = 'David', timezone } = params;
  const toolsUsed: string[] = [];

  try {
    const client = getAnthropicClient();
    const systemPrompt = buildAldenSystemPrompt({ founderName, timezone });

    const messages: Anthropic.MessageParam[] = [];

    for (const msg of conversationHistory.slice(-20)) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    let aldenResponse: string | null = null;

    for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
      const result = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 8192,
        system: systemPrompt,
        messages,
        tools: ALDEN_TOOLS,
      });

      const textBlocks = result.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      const toolUseBlocks = result.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (textBlocks.length > 0) {
        aldenResponse = textBlocks.map(b => b.text).join('\n');
      }

      if (toolUseBlocks.length === 0 || result.stop_reason === 'end_turn') {
        break;
      }

      console.log(`[Alden Chat] Round ${round + 1}: ${toolUseBlocks.length} tool call(s) — ${toolUseBlocks.map(t => t.name).join(', ')}`);

      messages.push({
        role: 'assistant',
        content: result.content,
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolsUsed.push(toolUse.name);

        try {
          const toolResult = await executeAldenTool(toolUse.name, (toolUse.input as Record<string, any>) || {});
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult.data),
          });
        } catch (err: any) {
          console.warn(`[Alden Chat] Tool ${toolUse.name} failed:`, err.message);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: err.message }),
            is_error: true,
          });
        }
      }

      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    if (!aldenResponse) {
      aldenResponse = "I'm having trouble connecting to my systems right now. Give me a moment and try again.";
    }

    console.log(`[Alden Chat] Response generated (${aldenResponse.length} chars, ${toolsUsed.length} tools used)`);

    return { response: aldenResponse, toolsUsed };
  } catch (error: any) {
    console.error('[Alden Chat] Error:', error.message);
    return {
      response: "Something went wrong on my end. Let me try to recover — ask me again in a moment.",
      toolsUsed,
    };
  }
}

console.log('[Alden Persona Service] Loaded — Alden voice chat ready (Claude)');

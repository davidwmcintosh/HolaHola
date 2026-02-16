import { GoogleGenAI } from "@google/genai";
import { buildAldenSystemPrompt } from "../alden-system-prompt";
import { ALDEN_FUNCTION_DECLARATIONS, executeAldenTool } from "./alden-functions";

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (geminiClient) return geminiClient;

  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Alden] No Gemini API key found');
  }

  geminiClient = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
    },
  });
  return geminiClient;
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
    const client = getGeminiClient();
    const systemPrompt = buildAldenSystemPrompt({ founderName, timezone });

    const geminiContents: any[] = [];

    for (const msg of conversationHistory.slice(-20)) {
      geminiContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    geminiContents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    let aldenResponse: string | null = null;

    for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
      const result = await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: geminiContents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 2048,
          tools: [{ functionDeclarations: ALDEN_FUNCTION_DECLARATIONS }],
        },
      });

      const candidate = result.candidates?.[0];
      if (!candidate?.content?.parts) {
        console.warn('[Alden] No response parts from Gemini');
        break;
      }

      geminiContents.push({
        role: 'model',
        parts: candidate.content.parts,
      });

      const functionCalls = candidate.content.parts.filter((p: any) => p.functionCall);
      const textParts = candidate.content.parts.filter((p: any) => p.text);

      if (textParts.length > 0) {
        aldenResponse = textParts.map((p: any) => p.text).join('\n');
      }

      if (functionCalls.length === 0) {
        break;
      }

      console.log(`[Alden Chat] Round ${round + 1}: ${functionCalls.length} tool call(s) — ${functionCalls.map((f: any) => f.functionCall.name).join(', ')}`);

      const toolResponseParts: any[] = [];

      for (const fc of functionCalls) {
        const toolName = fc.functionCall.name;
        const toolArgs = fc.functionCall.args || {};
        toolsUsed.push(toolName);

        try {
          const result = await executeAldenTool(toolName, toolArgs as Record<string, any>);
          toolResponseParts.push({
            functionResponse: {
              name: toolName,
              response: { result: result.data },
            },
          });
        } catch (err: any) {
          console.warn(`[Alden Chat] Tool ${toolName} failed:`, err.message);
          toolResponseParts.push({
            functionResponse: {
              name: toolName,
              response: { result: { error: err.message } },
            },
          });
        }
      }

      geminiContents.push({ role: 'user', parts: toolResponseParts });
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

console.log('[Alden Persona Service] Loaded — Alden voice chat ready');

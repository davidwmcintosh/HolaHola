import { GoogleGenAI } from "@google/genai";
import { costTracker } from "./services/cost-tracker";

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  },
});

export const GEMINI_MODELS = {
  FLASH: "gemini-3-flash-preview",
  PRO: "gemini-3-pro-preview",
} as const;

export async function callGemini(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  const contents: any[] = [];
  
  if (systemMessage) {
    contents.push({
      role: 'user',
      parts: [{ text: systemMessage }]
    });
  }
  
  conversationMessages.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  });
  
  const response = await gemini.models.generateContent({
    model,
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }]
  });

  try {
    const usage = (response as any).usageMetadata;
    if (usage) costTracker.track(model, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0, 'gemini');
  } catch {}

  return response.text || "";
}

export async function callGeminiWithSchema<T = any>(
  model: string,
  messages: Array<{ role: string; content: string }>,
  schema: any
): Promise<T> {
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  const contents: any[] = [];
  
  if (systemMessage) {
    contents.push({
      role: 'user',
      parts: [{ text: systemMessage }]
    });
  }
  
  conversationMessages.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  });
  
  const response = await gemini.models.generateContent({
    model,
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  
  try {
    const usage = (response as any).usageMetadata;
    if (usage) costTracker.track(model, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0, 'gemini-schema');
  } catch {}

  const responseText = response.text || "{}";
  return JSON.parse(responseText) as T;
}

export { gemini };

import { GoogleGenAI } from "@google/genai";
import { costTracker } from "./services/cost-tracker";
import { acquireBackgroundSlot } from "./services/gemini-priority-gate";

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const GEMINI_MODELS = {
  FLASH: "gemini-3-flash-preview",
  PRO: "gemini-2.5-pro",
} as const;

export async function callGemini(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  await acquireBackgroundSlot('callGemini');
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

  try {
    return response.text || "";
  } catch {
    return "";
  }
}

export async function callGeminiWithSchema<T = any>(
  model: string,
  messages: Array<{ role: string; content: string }>,
  schema: any
): Promise<T> {
  await acquireBackgroundSlot('callGeminiWithSchema');
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

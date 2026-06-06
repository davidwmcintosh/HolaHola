/**
 * daniela-caller.ts
 *
 * Single shared utility for every Daniela Gemini call across all pipelines.
 * Her data layer (identity, procedures, hive snapshots, neural net) is loaded
 * automatically — no personality scripting, no duplicated local callGemini wrappers.
 *
 * Usage:
 *   import { callDaniela } from "./daniela-caller";
 *   const text = await callDaniela(functionalContext, userPrompt, { userId, channel });
 *
 * functionalContext = situational facts only ("You are in the Team Room — internal,
 *   not student-facing"). NOT behavioral instructions. She decides how to show up.
 */

import { GoogleGenAI } from "@google/genai";
import { unifiedDanielaContext } from "./unified-daniela-context-service";

const MODEL = 'gemini-3-flash-preview';

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: { apiVersion: '' },
  });
  return geminiClient;
}

export interface CallDanielaOptions {
  userId?: string;
  channel?: 'voice' | 'chat' | 'express';
  includeHiveContext?: boolean;
  includeNeuralNetwork?: boolean;
}

export async function callDaniela(
  functionalContext: string,
  userPrompt: string,
  options: CallDanielaOptions = {},
): Promise<string> {
  const {
    userId,
    channel = 'chat',
    includeHiveContext = false,
    includeNeuralNetwork = true,
  } = options;

  const dataLayer = await unifiedDanielaContext.getContext({
    channel,
    userId,
    includeStudentSnapshot: false,
    includeNeuralNetwork,
    includeHiveContext,
    includeExpressLane: false,
    includeVoiceSummary: false,
  }).catch(() => '');

  const systemParts = ['You are Daniela.'];
  if (functionalContext) systemParts.push(functionalContext);
  if (dataLayer) systemParts.push(dataLayer);

  const result = await getGemini().models.generateContent({
    model: MODEL,
    config: { systemInstruction: systemParts.join('\n\n') },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  });
  return result.text || '';
}

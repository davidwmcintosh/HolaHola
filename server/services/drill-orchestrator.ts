/**
 * Drill Orchestrator Service
 * 
 * Manages inline micro-drills during voice conversations.
 * The tutor initiates drills with [DRILL] markup, and this service
 * coordinates the flow: prompt → listen → evaluate → feedback.
 * 
 * Philosophy: Active practice beats passive listening.
 * Quick "your turn" moments reinforce learning in real-time.
 * 
 * Drill Types:
 * - repeat: Student repeats a phrase (pronunciation practice)
 * - translate: Student translates to target language
 * - fill_blank: Student completes a sentence
 */

import { GoogleGenAI } from '@google/genai';
import { analyzePronunciation } from '../pronunciation-analysis';
import type { DrillType, DrillItemData, DrillState } from '@shared/whiteboard-types';

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface DrillEvaluationRequest {
  drillType: DrillType;
  prompt: string;
  expectedAnswer?: string;
  studentResponse: string;
  targetLanguage: string;
  difficultyLevel: string;
}

interface DrillEvaluationResult {
  isCorrect: boolean;
  score: number;
  feedback: string;
  pronunciation?: {
    score: number;
    issues: string[];
    strengths: string[];
  };
  suggestedCorrection?: string;
}

interface ActiveDrill {
  id: string;
  drillType: DrillType;
  prompt: string;
  expectedAnswer?: string;
  state: DrillState;
  startedAt: number;
  language: string;
  difficulty: string;
}

const activeDrills = new Map<string, ActiveDrill>();

function generateDrillId(): string {
  return `drill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function startDrill(
  drillType: DrillType,
  prompt: string,
  language: string,
  difficulty: string,
  expectedAnswer?: string
): string {
  const drillId = generateDrillId();
  
  activeDrills.set(drillId, {
    id: drillId,
    drillType,
    prompt,
    expectedAnswer,
    state: 'waiting',
    startedAt: Date.now(),
    language,
    difficulty,
  });
  
  console.log(`[Drill] Started ${drillType} drill: "${prompt}" (${drillId})`);
  return drillId;
}

export function getDrill(drillId: string): ActiveDrill | undefined {
  return activeDrills.get(drillId);
}

export function updateDrillState(drillId: string, state: DrillState): void {
  const drill = activeDrills.get(drillId);
  if (drill) {
    drill.state = state;
    console.log(`[Drill] Updated state for ${drillId}: ${state}`);
  }
}

export function completeDrill(drillId: string): void {
  const drill = activeDrills.get(drillId);
  if (drill) {
    drill.state = 'complete';
    console.log(`[Drill] Completed ${drillId} after ${Date.now() - drill.startedAt}ms`);
    setTimeout(() => activeDrills.delete(drillId), 60000);
  }
}

async function evaluateRepeatDrill(
  prompt: string,
  response: string,
  language: string,
  difficulty: string
): Promise<DrillEvaluationResult> {
  const pronunciationAnalysis = await analyzePronunciation(
    response,
    language,
    difficulty,
    `The student was asked to repeat: "${prompt}"`
  );
  
  const isCorrect = pronunciationAnalysis.score >= 70;
  
  return {
    isCorrect,
    score: pronunciationAnalysis.score,
    feedback: pronunciationAnalysis.feedback,
    pronunciation: {
      score: pronunciationAnalysis.score,
      issues: pronunciationAnalysis.phoneticIssues,
      strengths: pronunciationAnalysis.strengths,
    },
  };
}

async function evaluateTranslateDrill(
  prompt: string,
  response: string,
  language: string,
  difficulty: string,
  expectedAnswer?: string
): Promise<DrillEvaluationResult> {
  const systemPrompt = `You are a language teacher evaluating a student's translation.
The student is learning ${language} at ${difficulty} level.
Be encouraging but honest. Focus on meaning rather than exact wording.
Return JSON with: isCorrect (boolean), score (0-100), feedback (string), suggestedCorrection (string if wrong).`;

  const userPrompt = `Original phrase: "${prompt}"
${expectedAnswer ? `Expected answer: "${expectedAnswer}"` : ''}
Student's translation: "${response}"

Evaluate the translation accuracy.`;

  try {
    const result = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const evaluation = JSON.parse(result.text || '{}');
    
    return {
      isCorrect: evaluation.isCorrect ?? false,
      score: evaluation.score ?? 0,
      feedback: evaluation.feedback || 'Unable to evaluate translation.',
      suggestedCorrection: evaluation.suggestedCorrection,
    };
  } catch (error: any) {
    console.error('[Drill] Translation evaluation error:', error.message);
    return {
      isCorrect: false,
      score: 50,
      feedback: 'Unable to evaluate your translation. Keep practicing!',
    };
  }
}

async function evaluateFillBlankDrill(
  prompt: string,
  response: string,
  language: string,
  difficulty: string,
  expectedAnswer?: string
): Promise<DrillEvaluationResult> {
  const systemPrompt = `You are a language teacher evaluating a fill-in-the-blank exercise.
The student is learning ${language} at ${difficulty} level.
Be encouraging but honest. Accept minor spelling variations if meaning is clear.
Return JSON with: isCorrect (boolean), score (0-100), feedback (string), suggestedCorrection (string if wrong).`;

  const userPrompt = `Sentence with blank: "${prompt}"
${expectedAnswer ? `Expected answer: "${expectedAnswer}"` : ''}
Student's answer: "${response}"

Evaluate if the student filled in the blank correctly.`;

  try {
    const result = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const evaluation = JSON.parse(result.text || '{}');
    
    return {
      isCorrect: evaluation.isCorrect ?? false,
      score: evaluation.score ?? 0,
      feedback: evaluation.feedback || 'Unable to evaluate your answer.',
      suggestedCorrection: evaluation.suggestedCorrection,
    };
  } catch (error: any) {
    console.error('[Drill] Fill-blank evaluation error:', error.message);
    return {
      isCorrect: false,
      score: 50,
      feedback: 'Unable to evaluate your answer. Keep practicing!',
    };
  }
}

export async function evaluateDrill(
  request: DrillEvaluationRequest
): Promise<DrillEvaluationResult> {
  const { drillType, prompt, expectedAnswer, studentResponse, targetLanguage, difficultyLevel } = request;
  
  console.log(`[Drill] Evaluating ${drillType}: "${studentResponse}" for prompt "${prompt}"`);
  
  switch (drillType) {
    case 'repeat':
      return evaluateRepeatDrill(prompt, studentResponse, targetLanguage, difficultyLevel);
    
    case 'translate':
      return evaluateTranslateDrill(prompt, studentResponse, targetLanguage, difficultyLevel, expectedAnswer);
    
    case 'fill_blank':
      return evaluateFillBlankDrill(prompt, studentResponse, targetLanguage, difficultyLevel, expectedAnswer);
    
    default:
      console.warn(`[Drill] Unknown drill type: ${drillType}`);
      return {
        isCorrect: false,
        score: 0,
        feedback: 'Unknown drill type.',
      };
  }
}

export function generateDrillPrompt(drillType: DrillType): string {
  switch (drillType) {
    case 'repeat':
      return 'Listen carefully and repeat after me.';
    case 'translate':
      return 'Now translate this into the target language.';
    case 'fill_blank':
      return 'Fill in the missing word or phrase.';
    default:
      return 'Complete this exercise.';
  }
}

export function createDrillData(
  drillType: DrillType,
  prompt: string,
  expectedAnswer?: string
): DrillItemData {
  return {
    drillType,
    prompt,
    expectedAnswer,
    state: 'waiting',
  };
}

export function cleanupOldDrills(): void {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000;
  
  const entries = Array.from(activeDrills.entries());
  for (const [id, drill] of entries) {
    if (now - drill.startedAt > maxAge) {
      activeDrills.delete(id);
      console.log(`[Drill] Cleaned up stale drill: ${id}`);
    }
  }
}

setInterval(cleanupOldDrills, 60000);

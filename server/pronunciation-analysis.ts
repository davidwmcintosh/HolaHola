import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface PronunciationAnalysis {
  score: number; // 0-100
  feedback: string;
  phoneticIssues: string[];
  strengths: string[];
}

/**
 * Analyzes pronunciation quality based on transcribed speech
 * @param transcribedText - What the user actually said (from speech recognition)
 * @param targetLanguage - The language being learned
 * @param difficulty - Current difficulty level (beginner, intermediate, advanced)
 * @param context - Optional context about what the user should be saying
 * @returns Pronunciation analysis with score, feedback, and issues
 */
export async function analyzePronunciation(
  transcribedText: string,
  targetLanguage: string,
  difficulty: string,
  context?: string
): Promise<PronunciationAnalysis> {
  try {
    const systemPrompt = `You are an expert ${targetLanguage} pronunciation coach. Analyze the student's speech based on the transcribed text and provide detailed feedback.

Your analysis should consider:
1. Clarity and accuracy of pronunciation
2. Natural rhythm and intonation
3. Common pronunciation challenges for ${targetLanguage} learners
4. The student's ${difficulty} level

Provide your analysis in the following JSON format:
{
  "score": <number 0-100>,
  "feedback": "<concise overall feedback>",
  "phoneticIssues": ["<specific issue 1>", "<specific issue 2>", ...],
  "strengths": ["<strength 1>", "<strength 2>", ...]
}

Scoring rubric:
- 90-100: Excellent pronunciation, near-native quality
- 80-89: Good pronunciation with minor issues
- 70-79: Decent pronunciation with some noticeable issues
- 60-69: Acceptable but needs improvement in several areas
- 50-59: Below average, significant pronunciation issues
- 0-49: Poor pronunciation, major issues affecting comprehension

Be encouraging but honest. Focus on 1-3 key issues rather than listing everything.`;

    const userPrompt = `Student's transcribed speech: "${transcribedText}"
Target language: ${targetLanguage}
Difficulty level: ${difficulty}
${context ? `Context: ${context}` : ''}

Analyze the pronunciation quality based on the transcription.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const analysis = JSON.parse(content) as PronunciationAnalysis;
    
    // Validate and sanitize the response
    return {
      score: Math.max(0, Math.min(100, analysis.score || 0)),
      feedback: analysis.feedback || "Unable to analyze pronunciation",
      phoneticIssues: Array.isArray(analysis.phoneticIssues) ? analysis.phoneticIssues : [],
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
    };
  } catch (error) {
    console.error("Error analyzing pronunciation:", error);
    // Return a neutral score on error rather than failing
    return {
      score: 70,
      feedback: "Unable to fully analyze pronunciation at this time. Keep practicing!",
      phoneticIssues: [],
      strengths: [],
    };
  }
}

/**
 * Analyzes pronunciation improvement over time
 * @param previousScores - Array of previous pronunciation scores (most recent last)
 * @returns Trend analysis (improving, stable, declining)
 */
export function analyzePronunciationTrend(previousScores: number[]): {
  trend: 'improving' | 'stable' | 'declining';
  averageChange: number;
} {
  if (previousScores.length < 3) {
    return { trend: 'stable', averageChange: 0 };
  }

  // Compare recent half vs older half
  const midpoint = Math.floor(previousScores.length / 2);
  const olderScores = previousScores.slice(0, midpoint);
  const recentScores = previousScores.slice(midpoint);

  const olderAvg = olderScores.reduce((sum, s) => sum + s, 0) / olderScores.length;
  const recentAvg = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;

  const averageChange = recentAvg - olderAvg;

  let trend: 'improving' | 'stable' | 'declining';
  if (averageChange >= 5) {
    trend = 'improving';
  } else if (averageChange <= -5) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return { trend, averageChange: Math.round(averageChange) };
}

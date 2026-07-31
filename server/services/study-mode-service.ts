/**
 * Study Mode Service
 * Proactively generates immersion scenarios from curriculum unit lessons,
 * with DALL-E visuals, and drives Daniela-led practice conversations.
 */

import { GoogleGenAI } from "@google/genai";
import { callDaniela } from "./daniela-caller";
import { fetchPatternSignalContext } from "./pattern-signal-context";
import { getUserDb } from "../db";
import { sql } from "drizzle-orm";
import { generateVisual } from "./visual-content-service";
import { archiveImageToPermanentStorage } from "./image-storage";
import { storage } from "../storage";
import crypto from "crypto";
import type { ImmersionScenario, ImmersionObjective, ImmersionScaffold } from "./team-room-alden-service";

async function getOrGenerateLessonVisual(lessonId: string, visualPrompt: string, lessonName: string) {
  const db = getUserDb();

  // Check lesson_visual_aids for any stored image — no TTL, URLs are now permanent
  const cached = await db.execute(sql`
    SELECT mf.url, mf.description, mf.tags
    FROM lesson_visual_aids lva
    JOIN media_files mf ON mf.id = lva.media_file_id
    WHERE lva.lesson_id = ${lessonId}
    ORDER BY lva.created_at DESC
    LIMIT 1
  `);
  if (cached.rows.length > 0) {
    const row = cached.rows[0] as any;
    return {
      imageUrl: row.url as string,
      altText: (row.description as string) || lessonName,
      semanticTags: (row.tags as string[]) || [],
    };
  }

  // Generate fresh image via DALL-E
  const result = await generateVisual(visualPrompt, 'image', {}, 'warm, friendly illustration, educational');

  // Archive the temporary DALL-E URL to permanent object storage immediately
  const promptHash = crypto.createHash('md5').update('study_visual_' + lessonId).digest('hex');
  const filename = `${promptHash}.jpg`;
  const permanentUrl = await archiveImageToPermanentStorage(result.imageUrl, filename);

  // Save permanent URL to media_files
  const mediaFile = await storage.cacheImage({
    mediaType: 'image',
    url: permanentUrl,
    filename: `study-visual-${lessonId}.jpg`,
    mimeType: 'image/jpeg',
    imageSource: 'ai_generated',
    promptHash,
    title: lessonName,
    description: result.altText,
    tags: result.semanticTags,
    language: 'spanish',
  });

  // Link to lesson via lesson_visual_aids
  await db.execute(sql`
    INSERT INTO lesson_visual_aids (id, lesson_id, media_file_id, title, description, display_order, is_required)
    VALUES (gen_random_uuid(), ${lessonId}, ${mediaFile.id}, ${lessonName}, ${result.altText}, 0, false)
  `);

  return { imageUrl: permanentUrl, altText: result.altText, semanticTags: result.semanticTags };
}

// ── Gemini client ─────────────────────────────────────────────────────────────
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      apiVersion: '',
    },
  });
  return geminiClient;
}

async function callGemini(system: string, user: string): Promise<string> {
  const gemini = getGemini();
  const result = await gemini.models.generateContent({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction: system },
    contents: [{ role: 'user', parts: [{ text: user }] }],
  });
  return result.text || '';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudyUnit {
  id: string;
  name: string;
  description: string;
  actfl_level: string;
  cultural_theme: string;
  order_index: number;
  lesson_count: number;
  path_id: string;
  path_name: string;
}

export interface StudyLesson {
  id: string;
  name: string;
  lesson_type: string;
  conversation_topic: string;
  conversation_prompt: string;
  objectives: string[];
  required_vocabulary: string[];
  required_grammar: string[];
  estimated_minutes: number;
}

export interface StudyScenario extends ImmersionScenario {
  lessonId: string;
  lessonName: string;
  lessonType: string;
  visual?: {
    imageUrl: string;
    altText: string;
    semanticTags: string[];
  };
}

export interface StudySession {
  unitId: string;
  unitName: string;
  unitLevel: string;
  culturalTheme: string;
  scenarios: StudyScenario[];
  generatedAt: string;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

export async function getStudyUnits(language = 'spanish'): Promise<{ pathName: string; pathId: string; level: string; units: StudyUnit[] }[]> {
  const db = getUserDb();
  const rows = await db.execute(sql`
    SELECT
      cu.id, cu.name, cu.description, cu.actfl_level,
      cu.cultural_theme, cu.order_index,
      cp.id as path_id, cp.name as path_name, cp.start_level,
      COUNT(cl.id)::int as lesson_count
    FROM curriculum_units cu
    JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
    LEFT JOIN curriculum_lessons cl ON cl.curriculum_unit_id = cu.id
    WHERE cp.language = ${language}
    GROUP BY cu.id, cu.name, cu.description, cu.actfl_level,
             cu.cultural_theme, cu.order_index, cp.id, cp.name, cp.start_level
    ORDER BY cp.start_level, cu.order_index
  `);

  const byPath = new Map<string, { pathName: string; pathId: string; level: string; units: StudyUnit[] }>();
  for (const row of rows.rows as any[]) {
    if (!byPath.has(row.path_id)) {
      byPath.set(row.path_id, { pathName: row.path_name, pathId: row.path_id, level: row.start_level, units: [] });
    }
    byPath.get(row.path_id)!.units.push({
      id: row.id,
      name: row.name,
      description: row.description || '',
      actfl_level: row.actfl_level || '',
      cultural_theme: row.cultural_theme || '',
      order_index: row.order_index,
      lesson_count: row.lesson_count,
      path_id: row.path_id,
      path_name: row.path_name,
    });
  }
  return Array.from(byPath.values());
}

async function getUnitLessons(unitId: string): Promise<StudyLesson[]> {
  const db = getUserDb();
  const rows = await db.execute(sql`
    SELECT id, name, lesson_type, conversation_topic, conversation_prompt,
           objectives, required_vocabulary, required_grammar, estimated_minutes
    FROM curriculum_lessons
    WHERE curriculum_unit_id = ${unitId}
    ORDER BY order_index
  `);
  return (rows.rows as any[]).map(r => ({
    id: r.id,
    name: r.name,
    lesson_type: r.lesson_type || 'conversation',
    conversation_topic: r.conversation_topic || r.name,
    conversation_prompt: r.conversation_prompt || '',
    objectives: Array.isArray(r.objectives) ? r.objectives : [],
    required_vocabulary: Array.isArray(r.required_vocabulary) ? r.required_vocabulary : [],
    required_grammar: Array.isArray(r.required_grammar) ? r.required_grammar : [],
    estimated_minutes: r.estimated_minutes || 25,
  }));
}

// ── Scenario generation ───────────────────────────────────────────────────────

const DANIELA_SCENARIO_SYSTEM = `You are Daniela, a Spanish language curriculum architect. 
Your job is to design structured conversational immersion scenarios for learners based on lesson data.
Return ONLY valid JSON, no markdown, no explanation.`;

async function generateScenarioForLesson(lesson: StudyLesson, actflLevel: string, culturalTheme: string): Promise<Omit<StudyScenario, 'visual' | 'lessonId' | 'lessonName' | 'lessonType'>> {
  const levelMap: Record<string, ImmersionScaffold['level']> = {
    novice_low: 'novice', novice_mid: 'novice', novice_high: 'novice',
    intermediate_low: 'intermediate', intermediate_mid: 'intermediate', intermediate_high: 'intermediate',
    advanced_low: 'advanced', advanced_mid: 'advanced', advanced_high: 'advanced',
  };
  const scaffoldLevel = levelMap[actflLevel.toLowerCase().replace(' ', '_')] || 'novice';

  const prompt = `Create a conversational immersion scenario for this Spanish lesson:

Lesson: ${lesson.name}
Type: ${lesson.lesson_type}
Topic: ${lesson.conversation_topic}
ACTFL Level: ${actflLevel}
Cultural Theme: ${culturalTheme}
Learning Objectives: ${lesson.objectives.slice(0, 3).join(', ')}
Key Vocabulary: ${lesson.required_vocabulary.slice(0, 6).join(', ')}
Grammar Points: ${lesson.required_grammar.slice(0, 3).join(', ')}
Conversation Prompt: ${lesson.conversation_prompt || 'Not specified'}

Return a JSON object matching this exact structure:
{
  "scenarioId": "unique-id",
  "title": "Scenario title (engaging, 4-6 words)",
  "context": "A vivid 1-2 sentence scene description in English, e.g. 'You're at a café in Madrid...'",
  "objectives": [
    {
      "targetSkill": "speaking",
      "description": "What the learner will practice",
      "successCriteria": ["criterion 1", "criterion 2"]
    }
  ],
  "scaffold": {
    "level": "${scaffoldLevel}",
    "hints": ["hint 1", "hint 2", "hint 3"],
    "grammarNotes": ["brief inline grammar tip 1", "brief inline grammar tip 2"],
    "fallbackPrompts": ["If stuck, try saying...", "Another way to say this is..."]
  },
  "visualPrompt": "A concise DALL-E prompt for a scene-setting illustration, e.g. 'A sunny Spanish café terrace with people greeting each other, illustrated style'",
  "dynamicContent": true
}`;

  try {
    const raw = await callGemini(DANIELA_SCENARIO_SYSTEM, prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    parsed.scenarioId = parsed.scenarioId || `scenario-${lesson.id}`;
    return parsed;
  } catch (err) {
    // Fallback scenario if Gemini fails
    const targetSkill: ImmersionObjective['targetSkill'] = lesson.lesson_type === 'vocabulary' ? 'vocabulary' : 'speaking';
    return {
      scenarioId: `scenario-${lesson.id}`,
      title: lesson.name,
      context: `You're practicing ${lesson.conversation_topic} in a real Spanish-speaking situation.`,
      objectives: [{
        targetSkill,
        description: lesson.objectives[0] || `Practice ${lesson.conversation_topic}`,
        successCriteria: lesson.objectives.slice(0, 2),
      }],
      scaffold: {
        level: scaffoldLevel,
        hints: lesson.required_vocabulary.slice(0, 3).map(v => `Try using: ${v}`),
        grammarNotes: lesson.required_grammar.slice(0, 2),
        fallbackPrompts: ['Try responding with a simple sentence.', 'It\'s okay to use words you know.'],
      },
      visualPrompt: `${lesson.conversation_topic}, Spanish-speaking country, illustrated educational style`,
      dynamicContent: true,
    };
  }
}

// ── Session generation (main entry point) ─────────────────────────────────────

export async function generateStudySession(unitId: string): Promise<StudySession> {
  const db = getUserDb();
  const unitRow = await db.execute(sql`
    SELECT cu.id, cu.name, cu.description, cu.actfl_level, cu.cultural_theme,
           cp.name as path_name
    FROM curriculum_units cu
    JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
    WHERE cu.id = ${unitId}
  `);
  if (!unitRow.rows.length) throw new Error(`Unit ${unitId} not found`);
  const unit = unitRow.rows[0] as any;

  const allLessons = await getUnitLessons(unitId);
  if (!allLessons.length) throw new Error(`No lessons found for unit ${unitId}`);
  const lessons = allLessons.slice(0, 3);

  // Generate scenarios and visuals in parallel
  const scenarioResults = await Promise.all(
    lessons.map(async (lesson): Promise<StudyScenario> => {
      const [scenarioBase, visual] = await Promise.allSettled([
        generateScenarioForLesson(lesson, unit.actfl_level || 'novice_low', unit.cultural_theme || ''),
        getOrGenerateLessonVisual(
          lesson.id,
          `${lesson.conversation_topic}, Spanish-speaking country, illustrated educational style`,
          lesson.name
        ),
      ]);

      return {
        ...(scenarioBase.status === 'fulfilled' ? scenarioBase.value : {
          scenarioId: `scenario-${lesson.id}`,
          title: lesson.name,
          context: `Practice ${lesson.conversation_topic} in Spanish.`,
          objectives: [{ targetSkill: 'speaking' as const, description: lesson.objectives[0] || 'Practice speaking', successCriteria: [] }],
          scaffold: { level: 'novice' as const, hints: [], grammarNotes: [], fallbackPrompts: [] },
          visualPrompt: lesson.conversation_topic,
          dynamicContent: true,
        }),
        lessonId: lesson.id,
        lessonName: lesson.name,
        lessonType: lesson.lesson_type,
        visual: visual.status === 'fulfilled' ? visual.value : undefined,
      };
    })
  );

  return {
    unitId,
    unitName: unit.name,
    unitLevel: unit.actfl_level || 'novice_low',
    culturalTheme: unit.cultural_theme || '',
    scenarios: scenarioResults,
    generatedAt: new Date().toISOString(),
  };
}

// ── Immersion chat ────────────────────────────────────────────────────────────

const DANIELA_IMMERSION_CONTEXT = `You are running a conversational immersion session. Keep the learner inside the language and the scenario. Respond primarily in Spanish at the learner's level, with brief English support in [brackets] when needed. Weave grammar tips naturally into responses — never break the conversation flow to lecture. Move the scenario forward with a follow-up question.`;

export interface ChatMessage {
  role: 'user' | 'daniela';
  content: string;
}

export async function studyModeChat(
  scenario: StudyScenario,
  history: ChatMessage[],
  userMessage: string,
  userId?: string,
): Promise<string> {
  const historyText = history.map(m => `${m.role === 'daniela' ? 'Daniela' : 'Learner'}: ${m.content}`).join('\n');

  const prompt = `IMMERSION SCENARIO:
Context: ${scenario.context}
Goal: ${scenario.objectives.map(o => o.description).join('; ')}
Scaffold Level: ${scenario.scaffold.level}
Grammar Notes (weave in naturally): ${scenario.scaffold.grammarNotes.join(', ')}
Hints available if needed: ${scenario.scaffold.hints.join(', ')}

CONVERSATION SO FAR:
${historyText || '(Session just started)'}

LEARNER SAYS: "${userMessage}"

Keep the scenario alive, correct gently inline, and move forward.`;

  // Fetch active grammar pattern signals for this student so Daniela keeps her
  // pattern map in the text-mode study session. No StreamingSession is available
  // here, so we hydrate directly from the DB via fetchPatternSignalContext.
  // Study mode is currently Spanish-only. When multi-language support is added,
  // replace STUDY_MODE_LANGUAGE with scenario.language (or equivalent).
  const STUDY_MODE_LANGUAGE = 'spanish' as const;
  const activePatternSignals = userId
    ? await fetchPatternSignalContext(userId, STUDY_MODE_LANGUAGE).catch(() => null)
    : null;

  try {
    return await callDaniela(DANIELA_IMMERSION_CONTEXT, prompt, { userId, activePatternSignals });
  } catch {
    return '¡Interesante! [Interesting!] ¿Puedes decirme más? [Can you tell me more?]';
  }
}

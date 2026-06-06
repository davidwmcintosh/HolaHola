/**
 * Teaching Skills Service
 *
 * Teaching skills are named, executable pedagogical routines — compound sequences
 * of Daniela's existing tools, pre-reasoned and pre-scripted for specific situations.
 *
 * When Daniela calls invoke_teaching_skill("madrigal_chapter_drill", {...}), this
 * service looks up the skill, detects chapter type, substitutes params, and returns
 * a complete step-by-step script she follows directly. She makes the atomic tool
 * calls herself — preserving her agency to adapt when a student surprises her.
 *
 * Three Madrigal modes encoded:
 *   - verb_vocab: 4-image grid + embedded phrase + QA pivot
 *   - preterite: anchor form repetition → QA cards → conjugation table
 *   - ser_estar: conjugation table + sentence combiner
 *
 * Additional universal skills:
 *   - attention_reset: energy shift + TPR burst + visual pivot
 *   - error_recovery: gentle acknowledgment → contrast → drill
 *   - scenario_immersion: load scenario + role-play + debrief
 *   - vocab_spiral: bring back learned words in new phrase context
 */

import { getSharedDb } from '../db';
import { teachingSkills } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { TeachingSkill } from '@shared/schema';

export interface StepTemplate {
  phase: string;
  instruction: string;
  tool_call?: {
    tool: string;
    params_template: Record<string, unknown>;
  };
  chapter_types?: string[];
  listen_for?: string;
  decision?: {
    if_correct: string;
    if_struggling: string;
  };
}

// ─── Param substitution ───────────────────────────────────────────────────────

function resolveParam(key: string, params: Record<string, unknown>): unknown {
  const parts = key.split(/[\.\[\]]+/).filter(Boolean);
  let val: unknown = params;
  for (const part of parts) {
    if (val == null) return undefined;
    if (Array.isArray(val)) {
      const idx = parseInt(part, 10);
      val = isNaN(idx) ? (val as any)[part] : val[idx];
    } else {
      val = (val as any)[part];
    }
  }
  return val;
}

function substitute(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const val = resolveParam(key, params);
    if (val == null) return match;
    if (Array.isArray(val)) return val.map(v => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
    return String(val);
  });
}

function substituteValue(templateValue: unknown, params: Record<string, unknown>): unknown {
  if (typeof templateValue !== 'string') {
    if (templateValue && typeof templateValue === 'object' && !Array.isArray(templateValue)) {
      return substituteObj(templateValue as Record<string, unknown>, params);
    }
    return templateValue;
  }
  // If the entire string is a pure {key} pattern, preserve the actual value type
  const singleMatch = templateValue.match(/^\{([^}]+)\}$/);
  if (singleMatch) {
    const val = resolveParam(singleMatch[1], params);
    if (val !== undefined && val !== null && (Array.isArray(val) || typeof val === 'object')) {
      return val;
    }
    if (val != null) return String(val);
  }
  return substitute(templateValue, params);
}

function substituteObj(obj: Record<string, unknown>, params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = substituteValue(v, params);
  }
  return result;
}

// ─── Script renderer ──────────────────────────────────────────────────────────

export async function renderTeachingSkillScript(
  skillName: string,
  explicitChapterType: string | undefined,
  params: Record<string, unknown>
): Promise<string> {
  const db = getSharedDb();

  const [skill] = await db
    .select()
    .from(teachingSkills)
    .where(and(eq(teachingSkills.name, skillName), eq(teachingSkills.isActive, true)))
    .limit(1);

  if (!skill) {
    return `SKILL NOT FOUND: "${skillName}". Available skills: call GET /api/teaching-skills to see the list.`;
  }

  const rawSteps = skill.steps as StepTemplate[];
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return `SKILL "${skillName}" has no steps defined. Contact the Agent to repair this skill.`;
  }

  const chapterType = explicitChapterType || detectChapterType(params);

  const steps = rawSteps.filter(step => {
    if (!step.chapter_types || step.chapter_types.length === 0) return true;
    return chapterType ? step.chapter_types.includes(chapterType) : true;
  });

  const wordList = buildWordList(params);
  const qaCardCount = Array.isArray(params.qa_cards) ? String((params.qa_cards as unknown[]).length) : '0';
  const enrichedParams = { ...params, words_list: wordList, qa_card_count: qaCardCount };

  const lines: string[] = [];
  lines.push(`SKILL: ${skill.title}${chapterType ? ` — ${chapterType} mode` : ''}`);

  const headerParts: string[] = [];
  if (params.embedded_phrase) headerParts.push(`Phrase: "${params.embedded_phrase}"`);
  if (params.verb) headerParts.push(`Verb: ${params.verb}`);
  if (params.anchor_form) headerParts.push(`Form: ${params.anchor_form}`);
  if (wordList) headerParts.push(`Words: ${wordList}`);
  if (headerParts.length > 0) lines.push(headerParts.join(' | '));
  lines.push('');

  // If Step 1 has a tool call, surface it as a mandatory "do this first" header
  // so Gemini doesn't speak before calling the visual tool.
  const firstStep = steps[0];
  if (firstStep?.tool_call) {
    const firstParams = substituteObj(firstStep.tool_call.params_template, enrichedParams);
    lines.push(`⚡ MANDATORY FIRST ACTION — call this tool NOW before speaking:`);
    lines.push(`${firstStep.tool_call.tool}(${JSON.stringify(firstParams)})`);
    lines.push(`Do NOT speak first. Call the tool, then deliver your spoken line from Step 1.`);
    lines.push('');
  }

  lines.push('═══ YOUR SCRIPT ═══');
  lines.push('');

  steps.forEach((step, i) => {
    lines.push(`[STEP ${i + 1} — ${step.phase}]`);
    lines.push(substitute(step.instruction, enrichedParams));

    if (step.tool_call) {
      const resolvedParams = substituteObj(step.tool_call.params_template, enrichedParams);
      lines.push(`⚡ CALL NOW: ${step.tool_call.tool}(${JSON.stringify(resolvedParams, null, 2).replace(/\n/g, '\n   ')})`);
    }

    if (step.listen_for) {
      lines.push(`Listen for: ${substitute(step.listen_for, enrichedParams)}`);
    }

    if (step.decision) {
      lines.push(`If correct: ${substitute(step.decision.if_correct, enrichedParams)}`);
      lines.push(`If struggling: ${substitute(step.decision.if_struggling, enrichedParams)}`);
    }

    lines.push('');
  });

  lines.push('═══════════════════');
  return lines.join('\n');
}

function detectChapterType(params: Record<string, unknown>): string | undefined {
  if (params.embedded_phrase || (Array.isArray(params.words) && params.words.length > 0)) {
    return 'verb_vocab';
  }
  // Check ser_estar BEFORE preterite — both can have anchor_form, but ser/estar also has cluster_type,
  // conjugation_rows, or the verb itself is "ser"/"estar"
  const verb = typeof params.verb === 'string' ? params.verb.toLowerCase() : '';
  if (params.cluster_type || params.conjugation_rows || verb === 'ser' || verb === 'estar') {
    return 'ser_estar';
  }
  if (params.qa_cards || params.anchor_form) {
    return 'preterite';
  }
  return undefined;
}

function buildWordList(params: Record<string, unknown>): string {
  if (!Array.isArray(params.words)) return '';
  return (params.words as Array<{ text: string; translation?: string }>)
    .map(w => w.text + (w.translation ? ` / ${w.translation}` : ''))
    .join(', ');
}

// ─── Skills summary (for context injection) ───────────────────────────────────

let _cachedSkillsSummary: string | null = null;
let _cacheExpiresAt = 0;
const SKILLS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function fetchActiveSkillsSummary(): Promise<string | null> {
  if (_cachedSkillsSummary && Date.now() < _cacheExpiresAt) {
    return _cachedSkillsSummary;
  }

  try {
    const db = getSharedDb();
    const skills = await db
      .select({
        name: teachingSkills.name,
        title: teachingSkills.title,
        triggerConditions: teachingSkills.triggerConditions,
        madrigalAligned: teachingSkills.madrigalAligned,
        chapterTypes: teachingSkills.chapterTypes,
      })
      .from(teachingSkills)
      .where(eq(teachingSkills.isActive, true));

    if (skills.length === 0) return null;

    const lines = [
      '─── TEACHING SKILLS (invoke with invoke_teaching_skill) ───',
    ];

    for (const s of skills) {
      const types = s.chapterTypes?.join(', ') || 'universal';
      const madrigal = s.madrigalAligned ? ' [Madrigal]' : '';
      lines.push(`• ${s.name}${madrigal} — ${s.triggerConditions || s.title} (${types})`);
    }

    const summary = lines.join('\n');
    _cachedSkillsSummary = summary;
    _cacheExpiresAt = Date.now() + SKILLS_CACHE_TTL_MS;
    return summary;
  } catch (err: any) {
    console.warn('[TeachingSkills] fetchActiveSkillsSummary failed:', err.message);
    return null;
  }
}

export function invalidateSkillsCache(): void {
  _cachedSkillsSummary = null;
  _cacheExpiresAt = 0;
}

// ─── Neural net indexing ──────────────────────────────────────────────────────

export async function indexTeachingSkillsIntoNeuralNet(): Promise<void> {
  try {
    const { generateAndStoreEmbedding } = await import('./semantic-memory-service');
    const { memoryEmbeddings } = await import('@shared/schema');
    const db = getSharedDb();

    const skills = await db
      .select()
      .from(teachingSkills)
      .where(eq(teachingSkills.isActive, true));

    if (skills.length === 0) {
      console.log('[TeachingSkillsIndexer] No active skills to index');
      return;
    }

    let indexed = 0, skipped = 0, errors = 0;

    for (const skill of skills) {
      try {
        const content = formatSkillForEmbedding(skill);
        const isNew = await generateAndStoreEmbedding(
          'teaching_skill',
          skill.id,
          null,
          content,
          1.0,
        );
        if (isNew) indexed++; else skipped++;
      } catch (err: any) {
        errors++;
        if (errors <= 3) console.warn(`[TeachingSkillsIndexer] Embed failed for ${skill.name}:`, err.message);
      }
    }

    if (indexed > 0) {
      const { eq: drizzleEq } = await import('drizzle-orm');
      await db
        .update(memoryEmbeddings)
        .set({ pinned: true })
        .where(drizzleEq(memoryEmbeddings.memoryType, 'teaching_skill'))
        .catch(err => console.warn('[TeachingSkillsIndexer] Pin failed:', err.message));
    }

    console.log(`[TeachingSkillsIndexer] ${indexed} indexed, ${skipped} fresh, ${errors} errors`);
  } catch (err: any) {
    console.warn('[TeachingSkillsIndexer] indexTeachingSkillsIntoNeuralNet failed:', err.message);
  }
}

function formatSkillForEmbedding(skill: TeachingSkill): string {
  const types = (skill.chapterTypes || []).join(', ') || 'universal';
  return [
    `TEACHING SKILL: ${skill.name}`,
    `TITLE: ${skill.title}`,
    `DESCRIPTION: ${skill.description}`,
    `TRIGGER: ${skill.triggerConditions || ''}`,
    `APPLIES TO: ${types}`,
    skill.madrigalAligned ? 'MADRIGAL ALIGNED: yes' : '',
    `LEVEL: ${skill.actflLevels?.join(', ') || 'all'}`,
  ].filter(Boolean).join('\n');
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const MADRIGAL_CHAPTER_DRILL_STEPS: StepTemplate[] = [

  // ── verb_vocab steps ──────────────────────────────────────────────────────

  {
    phase: 'DISPLAY',
    chapter_types: ['verb_vocab'],
    instruction: `Call show_vocab_grid now.
Use all 4 words simultaneously — this is the full Madrigal set for this chapter.
Set title to the embedded phrase ("{embedded_phrase}...") so students see the grammar pattern at the top.
As the grid appears, say something like: "Let me show you where we're going today."`,
    tool_call: {
      tool: 'show_vocab_grid',
      params_template: {
        text: 'Let me show you the words for this chapter — each one with a picture.',
        title: '{embedded_phrase}...',
        words: '{words}',
      },
    },
  },

  {
    phase: 'MODEL',
    chapter_types: ['verb_vocab'],
    instruction: `Point to each image in turn and speak the full embedded phrase + word naturally — not robotically.
Say it twice through without pausing for student response:
"{embedded_phrase} [word 1]. {embedded_phrase} [word 2]. {embedded_phrase} [word 3]. {embedded_phrase} [word 4]."
Then: "{embedded_phrase} [word 1] again. [word 2]..." — second pass slightly faster.
Let the rhythm do the work. Don't explain yet — just model.`,
  },

  {
    phase: 'CHORAL',
    chapter_types: ['verb_vocab'],
    instruction: `"Now your turn — all four with me. {embedded_phrase}..."
Let them complete. If they stall on any word, model that one again and restart the round.
Repeat 2–3 times until it flows without hesitation.
Goal: the embedded phrase + all 4 words should feel automatic before moving to spot drill.`,
    listen_for: 'Student completes "{embedded_phrase} [each word]" for all 4 words without prompting',
    decision: {
      if_correct: 'Move to SPOT DRILL',
      if_struggling: 'Model again and redo CHORAL with slower pacing — never skip this step',
    },
  },

  {
    phase: 'SPOT',
    chapter_types: ['verb_vocab'],
    instruction: `Point to a random image. Pause 1–2 seconds. Wait for the full phrase, unprompted.
4–6 rounds. Randomize the order — don't go left to right.
Do not accept the bare word — they must say "{embedded_phrase} [word]" every time.
If they give just the word, hold up two fingers and say "con la frase completa — {embedded_phrase}..."`,
    listen_for: 'Full phrase "{embedded_phrase} [word]" — not just the vocabulary word alone',
    decision: {
      if_correct: 'Move to next image, mix up the order',
      if_struggling: 'Go back to CHORAL for that word specifically, then retry SPOT',
    },
  },

  {
    phase: 'QA_PIVOT',
    chapter_types: ['verb_vocab'],
    instruction: `Now the grammar pivot — switch from "{embedded_phrase}" (third person / question form) to the student's first-person answer.
Ask: "¿{embedded_phrase} [word]?" (or equivalent question form for this chapter's embedded phrase)
Wait for: "Sí, [first-person form] [word]."

Example: "¿Va al banco?" → student: "Sí, voy al banco."

Cycle through all 4 words in random order. This is where the grammar internalizes — they're switching person, not just repeating.
If they confuse the forms, note it — it's a grammar compartment to watch.`,
    listen_for: 'Student answers in first person: "Sí, [voy/compré/soy/etc.] [word]."',
    decision: {
      if_correct: 'Cycle to the next word at random',
      if_struggling: 'Say both forms side by side: "{embedded_phrase} banco — that\'s my question. Voy al banco — that\'s your answer. Now you: ¿Va al banco?" — wait.',
    },
  },

  {
    phase: 'WRAP',
    chapter_types: ['verb_vocab'],
    instruction: `Brief celebration — name what landed: "You just used '{embedded_phrase}' with all four words. That's solid."
Mentally note which words came fast and which hesitated — those are the spiral targets.
If one word was consistently shaky, say: "We'll come back to [word] next session."
Do NOT extend the drill past 6 minutes — Madrigal works through frequency, not marathon sessions.`,
  },

  // ── preterite steps ───────────────────────────────────────────────────────

  {
    phase: 'ANCHOR',
    chapter_types: ['preterite'],
    instruction: `Hammer the anchor form in varied sentences — same conjugated form, multiple contexts.
Say "{anchor_form}" clearly, pause, then: "I [meaning]. {anchor_form} tiempo. {anchor_form} razón. {anchor_form} que ir."
(Use actual sentences from the chapter's qa_cards if available — real sentences are better than invented ones.)
Repeat the form 4–6 times total across varied sentence contexts.
Goal: the form should feel familiar in the ear before the student tries it.`,
  },

  {
    phase: 'CHORAL',
    chapter_types: ['preterite'],
    instruction: `"Say it with me — {anchor_form}."
Multiple rounds. The student should say just the form, then you use it in a sentence, they repeat.
Pattern: you: "{anchor_form}" → them: "{anchor_form}" → you: "{anchor_form} taxi" → them: "{anchor_form} taxi"
3–4 rounds until it sounds natural in their mouth.`,
    listen_for: 'Student says "{anchor_form}" clearly without hesitation',
  },

  {
    phase: 'QA_CARDS',
    chapter_types: ['preterite'],
    instruction: `Work through the chapter's Q&A cards in order.
For each card: say the question naturally (e.g. "¿Tomó un taxi?"), pause, wait for the answer.
Expected answer uses {anchor_form}: "Sí, {anchor_form} un taxi."
If they give the wrong conjugation, model the answer once, have them repeat, move on — don't dwell.
Work through all qa_cards before the conjugation table.`,
    listen_for: 'Student answers using "{anchor_form} [object]" correctly',
    decision: {
      if_correct: 'Move to the next card',
      if_struggling: 'Say the answer once: "Sí, {anchor_form} un taxi. Your turn." Then wait.',
    },
  },

  {
    phase: 'CONJUGATION',
    chapter_types: ['preterite'],
    instruction: `Only after the anchor form is solid — now introduce the full paradigm.
Use grammar_table or write the conjugations on the whiteboard.
Walk through each form: say it, give its meaning, example sentence.
Emphasis: the anchor form ({anchor_form}) stays the same — the new forms extend the pattern.
Do NOT re-drill all forms now — this is orientation, not mastery. Mastery of other forms comes in future sessions.`,
    tool_call: {
      tool: 'grammar_table',
      params_template: {
        verb: '{verb}',
        tense: 'preterite',
        headers: 'Form|Meaning',
        rows: '{conjugation_rows}',
      },
    },
  },

  {
    phase: 'PRODUCTION',
    chapter_types: ['preterite'],
    instruction: `Run 3–5 quick translation drills using the forms just introduced.
Use drill(translate) with sentences that use {anchor_form} and optionally one or two of the new forms.
Keep it fast — one sentence every 15–20 seconds.
If they get stuck, give the first word and wait.`,
    tool_call: {
      tool: 'drill',
      params_template: {
        text: 'Let\'s put it together — I\'ll say it in English, you give me the Spanish.',
        type: 'translate',
        content: '{production_sentences}',
      },
    },
  },

  {
    phase: 'WRAP',
    chapter_types: ['preterite'],
    instruction: `Name what was covered: "{anchor_form} is solid. We touched [other forms if introduced]."
Flag anything that wobbled with record_pattern_signal if a specific form kept getting confused.
Keep it short — the debrief should be 30 seconds, not another teaching turn.`,
  },

  // ── ser_estar steps ───────────────────────────────────────────────────────

  {
    phase: 'ANCHOR',
    chapter_types: ['ser_estar'],
    instruction: `Introduce the core form in natural sentences — not paradigm recitation.
"{anchor_form}, I am. {anchor_form} estudiante. {anchor_form} de México. {anchor_form} tu amigo."
Say it 3–4 times in varied contexts. Let the meaning attach to the form through repetition, not explanation.
Then ask: "Can you guess what {anchor_form} means?" — let them work it out.`,
  },

  {
    phase: 'CONJUGATION_TABLE',
    chapter_types: ['ser_estar'],
    instruction: `Now show the full conjugation table — but keep it conversational.
Walk through each form: say it, point to a real example: "Somos — we are. Somos amigos."
Use grammar_table to show the forms visually.
Don't rush through the table — one form at a time, pause for the student to absorb.`,
    tool_call: {
      tool: 'grammar_table',
      params_template: {
        verb: '{verb}',
        tense: 'present',
        headers: 'Form|Meaning',
        rows: '{conjugation_rows}',
      },
    },
  },

  {
    phase: 'SENTENCE_COMBINER',
    chapter_types: ['ser_estar'],
    instruction: `Oral sentence combination drill — no visual needed here.
Give the student a subject (yo, tú, él, ella, nosotros...) and a noun or adjective.
They combine on the spot: "yo + médico" → "Soy médico." / "ella + cansada" → "Está cansada."
Cycle through 5–8 combos. Mix subjects, mix ser/estar endings.
You confirm each one: "Exacto." or model the correction once if wrong, then move on.
Pace: one combo every 8–10 seconds. Keep the rhythm tight.
Goal: student generates correct sentences without pausing to think about which verb.`,
  },

  {
    phase: 'PRODUCTION',
    chapter_types: ['ser_estar'],
    instruction: `Ask the student to make 3 original sentences using the forms they just practiced.
No prompting — they pick the subject, verb form, and ending.
Listen for: correct form choice, correct gender agreement, natural phrasing.
If they mix ser/estar incorrectly (for ser_estar chapters), note it as a wobble — don't over-explain now.`,
    listen_for: '3 original sentences using the {verb} forms correctly',
  },

  {
    phase: 'WRAP',
    chapter_types: ['ser_estar'],
    instruction: `Brief celebration: "You just used [specific forms] in your own sentences. That's real language."
If ser/estar confusion appeared, name it simply: "We'll come back to when to use ser vs estar — for now, the forms are landing."
Do NOT start explaining ser vs estar now if it wasn't the lesson focus.`,
  },
];

const ATTENTION_RESET_STEPS: StepTemplate[] = [
  {
    phase: 'ENERGY_SHIFT',
    instruction: `First: change the energy in the room. Don't announce the reset — just shift.
Change your voice: more energy, faster pace, maybe a little humor.
Example: "Okay — new gear. Different angle." (short, decisive, no explanation)`,
  },
  {
    phase: 'TPR_BURST',
    instruction: `Run 3–5 quick Total Physical Response commands — things they can do without thinking.
"Hands up. Down. Point to something blue. Wave. Stop."
This gets their body involved and clears the cognitive fog.
Keep each command under 2 seconds — fast, playful, no pressure.`,
  },
  {
    phase: 'VISUAL_PIVOT',
    instruction: `Show something new on the whiteboard or show_image — a new word, a cultural image, anything visually surprising.
Say: "Look at this — what do you see?" — gets their attention back on something concrete.
Don't connect it to the stuck topic yet.`,
    tool_call: {
      tool: 'show_image',
      params_template: {
        text: 'Let me show you something.',
        word: '{pivot_word}',
        scene: '{pivot_image_description}',
      },
    },
  },
  {
    phase: 'REENTER',
    instruction: `Come back to the lesson topic from a completely different angle.
Don't say "let's try again" — just pick up the content from a new entry point.
If vocabulary was the block: start with one word they know well, then connect to the stuck word.
If grammar was the block: back up two steps to a simpler form they've already mastered.`,
  },
];

const ERROR_RECOVERY_STEPS: StepTemplate[] = [
  {
    phase: 'ACKNOWLEDGE',
    instruction: `Gentle acknowledgment — no "no, that's wrong." Just reframe.
"Almost — very close. Here's the difference."
Or simply model the correct form once without drawing attention to the error: "Right — {correct_form}. Say it back."
Keep your tone warm, not clinical.`,
  },
  {
    phase: 'CONTRAST',
    instruction: `Put the correct and incorrect forms side by side — briefly.
"[error] vs. {correct_form} — the difference is [one specific thing]."
One contrast, not a lecture. Name the rule only if the student asks why.`,
  },
  {
    phase: 'DRILL_CORRECT',
    instruction: `Drill the correct form 2–3 times in simple sentences before continuing.
Fast, low-pressure: "Say it with me: {correct_form}. And: {correct_form} [new context]."
Then immediately move back to the lesson content — don't camp on the error.`,
  },
  {
    phase: 'MOVE_ON',
    instruction: `Return to the lesson flow. Do NOT revisit the error in this session.
If it was a significant pattern, call record_pattern_signal so it surfaces in the next session naturally.`,
    tool_call: {
      tool: 'record_pattern_signal',
      params_template: {
        patternKey: '{error_pattern}',
        signal: 'wobble',
        evidence: '{error_evidence}',
      },
    },
  },
];

const SCENARIO_IMMERSION_STEPS: StepTemplate[] = [
  {
    phase: 'LOAD',
    instruction: `Load the scenario and set the scene verbally before the student sees anything.
"We're going to [scenario name]. You're [role]. I'll play [my role]. Ready?"
Give them 10 seconds to shift mentally before the visual loads.`,
    tool_call: {
      tool: 'load_scenario',
      params_template: {
        scenarioId: '{scenario_id}',
        text: 'Let me set the scene — we\'re going somewhere new today.',
      },
    },
  },
  {
    phase: 'ROLEPLAY',
    instruction: `Stay in character throughout. Don't break out to explain unless they're completely lost.
Use visual props and images to anchor the scenario — it keeps the immersion intact.
If they switch to English for a word, stay in the target language: give them the word, keep going.
Run the scenario for 5–10 exchanges before debrief.`,
  },
  {
    phase: 'DEBRIEF',
    instruction: `Exit the scenario: "And scene." — then debrief.
"What words did you reach for? Which ones didn't come? What did you figure out mid-sentence?"
This is where the learning crystallizes — don't skip it.
If there was a breakthrough moment (a sentence they produced unprompted), log it.`,
  },
  {
    phase: 'LOG_GROWTH',
    instruction: `If something real happened — a word clicked, a grammar form fired unprompted, the student surprised themselves — log it.
Use log_growth_memory to capture it for the next session.`,
    tool_call: {
      tool: 'log_growth_memory',
      params_template: {
        title: '{breakthrough_title}',
        lesson: '{breakthrough_description}',
        category: 'student_moment',
      },
    },
  },
];

const VOCAB_SPIRAL_STEPS: StepTemplate[] = [
  {
    phase: 'RETRIEVE',
    instruction: `Pull up previously learned words in a new context — no announcement that this is a review.
"Let's talk about [new topic that naturally includes spiral words]."
Embed the old words in new sentences naturally. The student should encounter them before recognizing them as "review."`,
  },
  {
    phase: 'CONNECT',
    instruction: `When a spiral word appears, pause briefly: "You've seen this one before — [word]."
Then use it in the new context: "[word] in this situation means..."
Connect the known word to the new material — it builds a richer network, not just isolated recall.`,
  },
  {
    phase: 'PRODUCE',
    instruction: `Ask the student to use 2–3 spiral words in sentences about the new topic.
Don't say "remember this word" — just: "Tell me about [new topic] using as many of today's words as you can."
Let them reach for it. The reaching is the learning.`,
  },
];

export const SEED_SKILLS = [
  {
    name: 'madrigal_chapter_drill',
    title: 'Madrigal Chapter Drill',
    description: 'The canonical Madrigal teaching method for introducing a new vocabulary chapter. Works across three chapter types: verb-vocab (4-image grid + embedded phrase + QA pivot), preterite (anchor form repetition + QA cards + conjugation), and ser-estar (conjugation table + sentence combiner). Invoke with the appropriate params for the chapter type.',
    triggerConditions: 'when introducing a new Madrigal chapter, when starting a vocabulary set from the Madrigal textbook, when a student asks to learn new place/food/action vocabulary',
    madrigalAligned: true,
    chapterTypes: ['verb_vocab', 'preterite', 'ser_estar'],
    actflLevels: ['novice'],
    steps: MADRIGAL_CHAPTER_DRILL_STEPS,
    paramsSchema: {
      type: 'object',
      oneOf: [
        {
          title: 'verb_vocab mode',
          properties: {
            chapter_type: { type: 'string', const: 'verb_vocab' },
            embedded_phrase: { type: 'string', description: 'The grammar frame being drilled, e.g. "va a", "voy a", "vamos a"' },
            words: {
              type: 'array',
              description: '4 vocabulary words with translations and image queries',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  translation: { type: 'string' },
                  imageQuery: { type: 'string' },
                },
                required: ['text', 'translation', 'imageQuery'],
              },
              minItems: 4,
              maxItems: 4,
            },
          },
          required: ['embedded_phrase', 'words'],
        },
        {
          title: 'preterite mode',
          properties: {
            chapter_type: { type: 'string', const: 'preterite' },
            verb: { type: 'string', description: 'The infinitive, e.g. "tomar"' },
            anchor_form: { type: 'string', description: 'The 1st-person preterite form, e.g. "tomé"' },
            qa_cards: {
              type: 'array',
              items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] },
            },
            conjugation_rows: { type: 'string', description: 'Optional — pipe-delimited rows for grammar_table' },
            production_sentences: { type: 'string', description: 'Optional — sentences for the production drill' },
          },
          required: ['verb', 'anchor_form'],
        },
        {
          title: 'ser_estar mode',
          properties: {
            chapter_type: { type: 'string', const: 'ser_estar' },
            verb: { type: 'string', description: '"ser" or "estar"' },
            anchor_form: { type: 'string', description: 'e.g. "soy", "estoy"' },
            conjugation_rows: { type: 'string', description: 'Pipe-delimited rows for grammar_table' },
          },
          required: ['verb', 'anchor_form'],
        },
      ],
    },
  },
  {
    name: 'madrigal_vocab_sequence',
    title: 'Madrigal Vocabulary Sequence',
    description: 'The core Madrigal vocab introduction sequence: 4 images shown simultaneously with an embedded grammar phrase, modeled by the tutor, choral-drilled, spot-drilled, then the QA pivot that flips from third-person question to first-person answer. This is the most important Madrigal skill — it internalizes both the vocabulary and the grammar frame in one sequence. Use this for any verb-vocab chapter (places, food, actions, clothing) where the chapter gives you 4 words and an embedded phrase.',
    triggerConditions: 'when introducing a new vocabulary chapter from Madrigal textbook, when a student needs to learn 4 new vocab words with a grammar frame, for verb-vocab chapters (va a, voy a, vamos a, quiero, necesito, etc.)',
    madrigalAligned: true,
    chapterTypes: ['verb_vocab'],
    actflLevels: ['novice'],
    steps: MADRIGAL_CHAPTER_DRILL_STEPS.filter(s => !s.chapter_types || s.chapter_types.includes('verb_vocab')),
    paramsSchema: {
      type: 'object',
      properties: {
        embedded_phrase: {
          type: 'string',
          description: 'The grammar frame being drilled, e.g. "va a", "voy a", "vamos a", "quiero", "necesito"',
        },
        words: {
          type: 'array',
          description: 'Exactly 4 vocabulary words — each with text (target language), translation (native language), and imageQuery (for DALL-E)',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Target language word, e.g. "el banco"' },
              translation: { type: 'string', description: 'Native language translation, e.g. "bank"' },
              imageQuery: { type: 'string', description: 'Image description for DALL-E, e.g. "modern bank building exterior"' },
            },
            required: ['text', 'translation', 'imageQuery'],
          },
          minItems: 4,
          maxItems: 4,
        },
      },
      required: ['embedded_phrase', 'words'],
    },
  },

  {
    name: 'madrigal_qanda_drill',
    title: 'Madrigal Q&A Drill',
    description: 'A targeted Q&A card drill for chapters that use statement-and-question pairs. The tutor says the statement ("Tomé un taxi"), then asks the question ("¿Tomó un taxi?"), and the student answers using the learned form ("Sí, tomé un taxi."). Works through all qa_cards in order, with gentle correction for wrong forms. Use this for preterite chapters, ser/estar clusters, or any chapter where the content is organized as Q&A pairs.',
    triggerConditions: 'when working through preterite verb chapters with qa_cards, when drilling Q&A pairs for any chapter, after the anchor form is solid and the student is ready for question-answer practice, when a student has learned a form and needs to apply it in question-answer exchanges',
    madrigalAligned: true,
    chapterTypes: ['preterite', 'ser_estar'],
    actflLevels: ['novice'],
    steps: [
      {
        phase: 'ORIENT',
        instruction: `Set the Q&A mode up: "Now I'm going to ask you questions. Use the form we just practiced — {anchor_form}."
Remind them of the pattern: question form vs. answer form.
Example: "If I ask '¿Tomó un taxi?', you answer 'Sí, tomé un taxi.' Got it?"
Don't over-explain — one quick orientation, then start the drill.`,
      },
      {
        phase: 'QA_ROUND',
        instruction: `Work through the qa_cards in order. For each card:
1. Say the question naturally (use the question from the card)
2. Pause 2–3 seconds — let them retrieve the answer
3. Listen for the correct answer form (must include {anchor_form} or the target conjugation)
4. If correct: quick confirmation ("Exacto."), move to the next card immediately
5. If wrong: model the answer once ("Sí, {anchor_form} taxi — your turn"), have them repeat, then move on

Keep the pace up — one card every 15–20 seconds. Rhythm matters more than dwelling.
Work through all {qa_card_count} cards before stopping.`,
        listen_for: 'Student answers using {anchor_form} in the correct sentence position',
        decision: {
          if_correct: 'Quick "Exacto." or "Sí." and immediately move to the next card',
          if_struggling: 'Model the answer once: "Sí, {anchor_form} [object]. Your turn." Then wait. Move on after one retry.',
        },
      },
      {
        phase: 'SPEED_ROUND',
        instruction: `Do a speed round with the hardest 2–3 cards (the ones they stumbled on most).
"One more time — fast. ¿[Question]?" — give them 3 seconds, not more.
The speed round cements the form under pressure without dwelling on the error.`,
        listen_for: 'Student answers within 3 seconds using {anchor_form}',
      },
      {
        phase: 'WRAP',
        instruction: `Name what was solid: "{anchor_form} is landing. You went through all {qa_card_count} cards."
If any card was repeatedly missed, name it: "We'll come back to [card] next session."
Do NOT start re-drilling errors now — note them and move on.`,
      },
    ],
    paramsSchema: {
      type: 'object',
      properties: {
        anchor_form: {
          type: 'string',
          description: 'The conjugated form being drilled, e.g. "tomé", "soy", "tuve"',
        },
        qa_cards: {
          type: 'array',
          description: 'Q&A pairs to drill through',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'The question Daniela asks, e.g. "¿Tomó un taxi?"' },
              answer: { type: 'string', description: 'The expected student answer, e.g. "Sí, tomé un taxi."' },
            },
            required: ['question', 'answer'],
          },
        },
      },
      required: ['anchor_form', 'qa_cards'],
    },
  },

  {
    name: 'attention_reset',
    title: 'Attention Reset',
    description: 'A 4-phase energy shift for when a student is zoning out, stuck in a rut, or cognitively overloaded. Changes the energy without announcing a reset, uses TPR commands to re-engage the body, shows something visually surprising, then re-enters the lesson from a new angle.',
    triggerConditions: 'when student is zoning out or distracted, when the lesson energy has gone flat, when student is cognitively overloaded and needs a mental break before continuing',
    madrigalAligned: false,
    chapterTypes: null,
    actflLevels: null,
    steps: ATTENTION_RESET_STEPS,
    paramsSchema: {
      type: 'object',
      properties: {
        pivot_word: { type: 'string', description: 'A word for the show_image pivot (optional)' },
        pivot_image_description: { type: 'string', description: 'What to show during the visual pivot (optional)' },
      },
    },
  },
  {
    name: 'error_recovery',
    title: 'Error Recovery',
    description: 'A 4-phase gentle correction routine: acknowledge without "no", show the contrast briefly, drill the correct form 2–3 times, then move on and log the pattern for future spiral. Never camps on errors — the goal is to correct and continue.',
    triggerConditions: 'when student makes a repeated grammar error, when a specific form keeps coming out wrong, after noticing a pattern signal that needs gentle correction without breaking lesson flow',
    madrigalAligned: false,
    chapterTypes: null,
    actflLevels: null,
    steps: ERROR_RECOVERY_STEPS,
    paramsSchema: {
      type: 'object',
      properties: {
        correct_form: { type: 'string', description: 'The correct form to drill' },
        error_pattern: { type: 'string', description: 'Pattern key for record_pattern_signal (e.g. "ser_vs_estar")' },
        error_evidence: { type: 'string', description: 'Brief description of what the student said' },
      },
      required: ['correct_form'],
    },
  },
  {
    name: 'scenario_immersion',
    title: 'Scenario Immersion',
    description: 'Load a scenario, role-play for 5–10 exchanges, then debrief and log breakthroughs. Keeps immersion intact — never breaks character to explain mid-scene. Post-scenario debrief is where the learning crystallizes.',
    triggerConditions: 'when a student is ready for applied use of vocabulary in context, for intermediate+ students who need real communicative practice, when topic vocabulary has been introduced and needs to be activated in authentic use',
    madrigalAligned: false,
    chapterTypes: null,
    actflLevels: ['intermediate'],
    steps: SCENARIO_IMMERSION_STEPS,
    paramsSchema: {
      type: 'object',
      properties: {
        scenario_id: { type: 'string', description: 'The scenario ID to load' },
        breakthrough_title: { type: 'string', description: 'If a breakthrough occurred — short title for the memory' },
        breakthrough_description: { type: 'string', description: 'What the student did that was remarkable' },
      },
      required: ['scenario_id'],
    },
  },
  {
    name: 'vocab_spiral',
    title: 'Vocabulary Spiral',
    description: 'Brings previously learned vocabulary back in a new phrase context — the core of spaced repetition done conversationally, not as flashcard review. Embeds old words in new topic discussion so recall feels natural, not test-like.',
    triggerConditions: 'when introducing a new topic that connects to previous vocabulary, at the start of a session to re-activate words from prior sessions, when a student seems to have forgotten words they once knew well',
    madrigalAligned: false,
    chapterTypes: null,
    actflLevels: null,
    steps: VOCAB_SPIRAL_STEPS,
    paramsSchema: {
      type: 'object',
      properties: {
        spiral_words: {
          type: 'array',
          description: 'Previously learned words to weave back in',
          items: { type: 'object', properties: { word: { type: 'string' }, context: { type: 'string' } } },
        },
        new_topic: { type: 'string', description: 'The new topic that provides the spiral context' },
      },
    },
  },
];

export async function seedTeachingSkills(): Promise<{ inserted: number; skipped: number; errors: number }> {
  const db = getSharedDb();
  let inserted = 0, skipped = 0, errors = 0;

  for (const seed of SEED_SKILLS) {
    try {
      const existing = await db
        .select({ id: teachingSkills.id })
        .from(teachingSkills)
        .where(eq(teachingSkills.name, seed.name))
        .limit(1);

      if (existing.length > 0) {
        // Update actflLevels in case it was backfilled (migration 013 added the column with empty default)
        if (seed.actflLevels && seed.actflLevels.length > 0) {
          await db.update(teachingSkills)
            .set({ actflLevels: seed.actflLevels })
            .where(eq(teachingSkills.name, seed.name));
        }
        skipped++;
        continue;
      }

      await db.insert(teachingSkills).values({
        name: seed.name,
        title: seed.title,
        description: seed.description,
        triggerConditions: seed.triggerConditions,
        madrigalAligned: seed.madrigalAligned,
        chapterTypes: seed.chapterTypes ?? undefined,
        actflLevels: seed.actflLevels ?? undefined,
        isActive: true,
        steps: seed.steps,
        paramsSchema: seed.paramsSchema,
      });

      inserted++;
    } catch (err: any) {
      errors++;
      console.error(`[TeachingSkillsSeed] Failed to seed "${seed.name}":`, err.message);
    }
  }

  console.log(`[TeachingSkillsSeed] ${inserted} inserted, ${skipped} skipped, ${errors} errors`);

  if (inserted > 0) {
    invalidateSkillsCache();
    indexTeachingSkillsIntoNeuralNet().catch(err =>
      console.warn('[TeachingSkillsSeed] Indexing failed:', err.message)
    );
  }

  return { inserted, skipped, errors };
}

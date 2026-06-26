// server/services/tension-evaluator.ts
// Consequence Architecture — evaluates student pragmatic success per turn,
// updates the scene tension float in the World Ledger, and generates World Event
// stage directions when the tension band changes.
//
// Also owns:
//   - Style Shapers: periodic latent-space injections per tension band (every 3 turns)
//   - Social Affordances: register mismatch detection (INCONGRUENT_TOO_FORMAL / _TOO_CASUAL)
//   - Graceful Exit detection: tense/breaking → comfortable sets lifecycleState='EXITING'
//   - Memory Distillation trigger: calls distillSceneMemory fire-and-forget on EXITING
//   - Interruption Buffer: interruptedIntent check in selectStyleShaper
//
// Full doc: docs/worldness-framework.md

import https from 'https';
import { getUserDb, db } from '../db';
import { sql } from 'drizzle-orm';
import { distillSceneMemory } from './scene-memory-distiller';
import { masteryEvidence } from '@shared/schema';
import { buildMadrigalLinkNote } from './madrigal-vocab-linker';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-3-flash-preview';

// ─── Band definitions ────────────────────────────────────────────────────────

export type TensionBand = 'comfortable' | 'mild' | 'tense' | 'breaking';

export function getTensionBand(tension: number): TensionBand {
  if (tension < 0.30) return 'comfortable';
  if (tension < 0.60) return 'mild';
  if (tension < 0.85) return 'tense';
  return 'breaking';
}

// ─── Tension math ────────────────────────────────────────────────────────────

export function applyFriction(
  current: number,
  socialFriction: number,
  pragmaticScore: number,
): number {
  let delta = 0;
  if (socialFriction >= 4) delta = +0.15;
  else if (socialFriction >= 2) delta = +0.08;
  if (pragmaticScore >= 4) delta -= 0.12;
  else if (pragmaticScore >= 3) delta -= 0.06;
  if (socialFriction < 2 && pragmaticScore < 3) delta -= 0.02;
  return Math.max(0, Math.min(1, current + delta));
}

// ─── Gemini evaluator ────────────────────────────────────────────────────────

export interface TurnScores {
  pragmaticScore: number;
  socialFriction: number;
  socialRegister?: 'HARMONIC' | 'INCONGRUENT_TOO_FORMAL' | 'INCONGRUENT_TOO_CASUAL';
}

export async function evaluateStudentTurn(
  text: string,
  context: { language: string; sceneName: string; missionGoal?: string },
): Promise<TurnScores> {
  if (!GEMINI_API_KEY || text.trim().length < 3) {
    return { pragmaticScore: 3, socialFriction: 1 };
  }

  const systemPrompt =
    `You are scoring a language learner's communicative effectiveness. ` +
    `Scene: "${context.sceneName}". Language: ${context.language}. ` +
    (context.missionGoal ? `Goal: ${context.missionGoal}. ` : '') +
    `Return ONLY valid JSON: {"pragmatic_score": 0-5, "social_friction": 0-5, "social_register": "HARMONIC|INCONGRUENT_TOO_FORMAL|INCONGRUENT_TOO_CASUAL"}. ` +
    `pragmatic_score = how effectively the student communicated their intent (5=perfect). ` +
    `social_friction = impatience or awkwardness created for the other character (5=very disruptive). ` +
    `social_register = whether the formality level fits the scene relationship: ` +
    `HARMONIC = appropriate register for the context. ` +
    `INCONGRUENT_TOO_FORMAL = using formal address (usted, Sie, vous) with someone expecting informality. ` +
    `INCONGRUENT_TOO_CASUAL = using casual address (tú, du, tu) with someone expecting formality. ` +
    `IMPORTANT: Grammar errors, missing vocabulary, or hesitation = LOW friction. ` +
    `Only assign HIGH friction for turns that are culturally rude, dismissive, or impossible to understand.`;

  const userPrompt = `Student said: "${text.slice(0, 300)}"`;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 80,
    },
  });

  try {
    const result = await new Promise<any>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 4000,
        },
        (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            try { resolve(JSON.parse(d)); } catch { reject(new Error('parse')); }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.write(body);
      req.end();
    });

    const raw = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return { pragmaticScore: 3, socialFriction: 1 };
    const parsed = JSON.parse(raw);

    const validRegisters = ['HARMONIC', 'INCONGRUENT_TOO_FORMAL', 'INCONGRUENT_TOO_CASUAL'];
    const socialRegister = validRegisters.includes(parsed.social_register)
      ? parsed.social_register
      : 'HARMONIC';

    return {
      pragmaticScore: Math.max(0, Math.min(5, Number(parsed.pragmatic_score ?? 3))),
      socialFriction: Math.max(0, Math.min(5, Number(parsed.social_friction ?? 1))),
      socialRegister,
    };
  } catch {
    return { pragmaticScore: 3, socialFriction: 1 };
  }
}

// ─── DB persistence (fire-and-forget) ────────────────────────────────────────

export async function persistTension(
  userId: string,
  sceneName: string,
  tension: number,
): Promise<void> {
  try {
    const db = getUserDb();
    await db.execute(sql`
      INSERT INTO scene_world_ledger (id, user_id, scene_name, ledger, tension, updated_at)
      VALUES (gen_random_uuid(), ${userId}, ${sceneName}, '{}', ${tension}, now())
      ON CONFLICT (user_id, scene_name) DO UPDATE
        SET tension = ${tension}, updated_at = now()
    `);
  } catch {
    // fire-and-forget
  }
}

// ─── World Event text ────────────────────────────────────────────────────────

export function getWorldEventText(band: TensionBand, prevBand: TensionBand): string | null {
  if (band === prevBand) return null;

  if (band === 'mild' && prevBand === 'comfortable') {
    return '*(a brief silence settles — the other person waits patiently but expectantly)*';
  }
  if (band === 'tense' && (prevBand === 'comfortable' || prevBand === 'mild')) {
    return '*(the other person\'s body language shifts — a visible impatience, a glance at the door or their watch)*';
  }
  if (band === 'breaking') {
    return '*(the other person has their hand near the door, face a mask of cold politeness — one more misunderstanding and they are gone)*';
  }
  if (band === 'comfortable' && (prevBand === 'tense' || prevBand === 'breaking')) {
    return '*(their shoulders drop slightly, a slow breath out — something in their eyes softens)*';
  }
  return null;
}

// ─── Style Shapers ────────────────────────────────────────────────────────────
// Periodic latent-space pressure injected every 3 scene turns.
// Third-person prose — prevents fighting the Magic Circle's identity framing.
// Also handles: Aftermath (pendingAftermath), Interruption Buffer (interruptedIntent).

const STYLE_SHAPERS: Record<TensionBand, string> = {
  comfortable:
    '*(she is not in teacher mode right now — lazy with her grammar, comfortable in the silence, using the slang she would actually use with a friend)*',
  mild:
    '*(she is leaning forward a little — rhythm and pace, sensory details, not waiting for the student to be perfect before she responds)*',
  tense:
    '*(her patience is a resource running out — clipped sentences, focused only on whether the student is making sense, not whether it is grammatically clean)*',
  breaking:
    '*(the tutor is gone — only the character remains, reactive and visceral, capable of walking away from this entirely)*',
};

const AFTERMATH_SHAPER =
  '*(the intensity has passed — she can name what just happened or leave it alone, but she is present with whatever weight the scene left behind)*';

const INTERRUPTED_SHAPERS: Record<string, string> = {
  ELICIT:         '*(she had something she was drawing out of them — she can pick it back up or let the student lead from here)*',
  CHALLENGE:      '*(she was about to raise the bar — that moment passed, but the expectation is still there)*',
  SCAFFOLD:       '*(she was about to ease in and help — that opening is still available if they need it)*',
  CRISIS_BEAT:    '*(she was mid-ultimatum when they cut her off — the stakes have not changed)*',
  CELEBRATE:      '*(she was about to acknowledge something — she still knows it landed)*',
  PROGRESS_SCENE: '*(she was moving the scene forward — the thread is still there to pick up)*',
  DEFAULT:        '*(she had something in mind — she can hold it or let the student carry from here)*',
};

export function selectStyleShaper(session: any): string | null {
  if (!session?.sceneCanvas) return null;

  // Interruption Buffer: fires once after a barge-in, ahead of everything else
  if (session.interruptedIntent) {
    const intent = session.interruptedIntent as string;
    session.interruptedIntent = null;
    return INTERRUPTED_SHAPERS[intent] ?? INTERRUPTED_SHAPERS.DEFAULT;
  }

  // Aftermath: fires once after Graceful Exit (signalled by GOAP planner via pendingAftermath)
  if (session.pendingAftermath) {
    session.pendingAftermath = false;
    return AFTERMATH_SHAPER;
  }

  // Every 3 turns: inject band-appropriate style pressure
  const sceneAge: number = session.sceneAge ?? 0;
  if (sceneAge === 0 || sceneAge % 3 !== 0) return null;

  const tension: number = typeof session.sceneTension === 'number' ? session.sceneTension : 0;
  const band = getTensionBand(tension);
  return STYLE_SHAPERS[band];
}

// ─── Main session helper ─────────────────────────────────────────────────────

export async function evaluateAndUpdateTension(
  text: string,
  session: any,
): Promise<string | null> {
  const userId = String(session?.userId || session?.user?.id || '');
  const sceneName = session?.sceneCanvas?.environment as string | undefined;
  if (!sceneName || !userId) return null;

  // ── Scene age + peak tracking ─────────────────────────────────────────────
  if (session.lastSceneName !== sceneName) {
    session.sceneAge = 0;
    session.sceneTensionPeak = 0;
    session.registerIncongruentCount = 0;
    session.lastSceneName = sceneName;
  }
  session.sceneAge = (session.sceneAge ?? 0) + 1;

  const language = (session?.language || session?.targetLanguage || 'Spanish') as string;
  const missionGoal = session?.currentMissionGoal as string | undefined;

  const scores = await evaluateStudentTurn(text, { language, sceneName, missionGoal });

  const prev: number = typeof session.sceneTension === 'number' ? session.sceneTension : 0;
  const next = applyFriction(prev, scores.socialFriction, scores.pragmaticScore);
  session.sceneTension = next;

  // Track peak tension for Memory Distillation
  if (next > (session.sceneTensionPeak ?? 0)) session.sceneTensionPeak = next;

  // Track register incongruence count for Memory Distillation
  if (scores.socialRegister && scores.socialRegister !== 'HARMONIC') {
    session.registerIncongruentCount = (session.registerIncongruentCount ?? 0) + 1;
  }

  const prevBand = getTensionBand(prev);
  const nextBand = getTensionBand(next);

  if (!session.lastTensionBand) session.lastTensionBand = prevBand;
  const lastInjected: TensionBand = session.lastTensionBand;
  const worldEvent = getWorldEventText(nextBand, lastInjected);
  if (worldEvent) session.lastTensionBand = nextBand;

  // ── Graceful Exit detection ───────────────────────────────────────────────
  const wasHigh = prevBand === 'tense' || prevBand === 'breaking';
  const nowComfortable = nextBand === 'comfortable';
  if (wasHigh && nowComfortable && session.lifecycleState !== 'EXITING') {
    session.lifecycleState = 'EXITING';
    // Memory Distillation — fire-and-forget (writes narrative footprint to scene_world_ledger.ledger)
    distillSceneMemory(session).catch(() => {});
  }

  persistTension(userId, sceneName, next).catch(() => {});

  session.lastTurnScores = scores;

  // ── Lexical Mastery Tracking ──────────────────────────────────────────────
  // When the student lands a strong pragmatic turn (score >= 4), check if the
  // last grounded prop carries vocab — and mark those words as mastered.
  // This is the bridge back to the Madrigal unit content (see batch-doc-updates.md).
  // session.masteredWords: string[] accumulates across the session.
  if (scores.pragmaticScore >= 4 && session.lastGroundedProp && session.sceneCanvas) {
    const activeProp = (session.sceneCanvas.props as any[]).find(
      (p: any) => p.name === session.lastGroundedProp,
    );
    if (activeProp?.vocab?.length) {
      if (!session.masteredWords) session.masteredWords = [];
      const newWords = (activeProp.vocab as { word: string }[])
        .map(v => v.word)
        .filter(w => !session.masteredWords.includes(w));
      if (newWords.length) {
        session.masteredWords.push(...newWords);
        // Reactive Manifestation: prop glows because the word was *named*, not because teacher is happy.
        // Only fire if propGroundingAge is recent (Ghost Grounding guard).
        const groundingAge: number = session.propGroundingAge ?? 99;
        if (groundingAge <= 1) {
          if (!session.pendingVocabMutations) session.pendingVocabMutations = [];
          session.pendingVocabMutations.push({ type: 'set_prop_state', propName: session.lastGroundedProp, state: 'success' });
        }
        // Madrigal ↔ Scene link: check if any mastered word belongs to a Syllabus unit.
        // If so, queue a parenthetical stage direction for Daniela on the next GL turn.
        const vocabWithTranslations = (activeProp.vocab as { word: string; translation?: string }[])
          .filter(v => newWords.includes(v.word));
        const linkNote = buildMadrigalLinkNote(vocabWithTranslations, session.language || 'spanish');
        if (linkNote) (session as any).pendingMadrigalLink = linkNote;
        // Fire-and-forget DB insert — mastery is now durable across sessions.
        // ON CONFLICT: upsert so re-mastery increments the attempts counter.
        const sceneName: string | undefined = session.sceneCanvas?.environment;
        db.insert(masteryEvidence)
          .values(newWords.map(word => ({
            userId: session.userId as string,
            word,
            language: (session.language || 'spanish') as string,
            sceneName,
            propName: session.lastGroundedProp as string,
            attemptsCount: 1,
            lastPragmaticScore: scores.pragmaticScore as number,
          })))
          .onConflictDoUpdate({
            target: [masteryEvidence.userId, masteryEvidence.word, masteryEvidence.language],
            set: {
              attemptsCount: sql`mastery_evidence.attempts_count + 1`,
              lastPragmaticScore: scores.pragmaticScore as number,
            },
          })
          .catch(() => {});
        console.log(`[LexicalMastery] prag=${scores.pragmaticScore} prop="${session.lastGroundedProp}" → mastered (persisted): ${newWords.join(', ')}`);
      }
    }
  }

  if (scores.pragmaticScore >= 4 || scores.socialFriction >= 3 || (scores.socialRegister && scores.socialRegister !== 'HARMONIC')) {
    console.log(
      `[Tension] ${sceneName} ${prev.toFixed(2)}→${next.toFixed(2)} (${prevBand}→${nextBand}) ` +
      `prag=${scores.pragmaticScore} friction=${scores.socialFriction} register=${scores.socialRegister ?? 'HARMONIC'}` +
      `${worldEvent ? ' [WorldEvent]' : ''}${session.lifecycleState === 'EXITING' ? ' [EXITING]' : ''}`,
    );
  }

  return worldEvent;
}

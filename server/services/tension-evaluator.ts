// server/services/tension-evaluator.ts
// Consequence Architecture — evaluates student pragmatic success per turn,
// updates the scene tension float in the World Ledger, and generates World Event
// stage directions when the tension band changes.
//
// Also owns:
//   - Style Shapers: periodic latent-space injections that bias Daniela's tone
//     based on current tension band. Prevents RLHF drift back to "helpful tutor."
//     Injected every 3 turns via sendTextTurn (separate from world events).
//   - Graceful Exit detection: when tension drops from tense/breaking → comfortable,
//     sets session.lifecycleState = 'EXITING' so the planner can fire REST_REFLECT.
//
// Architecture (from Worldness Framework, June 25 2026):
//   Tension Variable T ∈ [0, 1] — social stability of the scene.
//   Evaluator: fast Gemini JSON call after each student turn.
//   Threshold Map: band changes trigger stage direction injection via sendTextTurn.
//   World Events: injected as stage directions (same pattern as prop_tap).
//   Full doc: docs/worldness-framework.md

import https from 'https';

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
  // Neutral decay: staying in the game is rewarded — prevents grinding death spirals
  if (socialFriction < 2 && pragmaticScore < 3) delta -= 0.02;
  return Math.max(0, Math.min(1, current + delta));
}

// ─── Gemini evaluator ────────────────────────────────────────────────────────

export interface TurnScores {
  pragmaticScore: number;
  socialFriction: number;
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
    `Return ONLY valid JSON: {"pragmatic_score": 0-5, "social_friction": 0-5}. ` +
    `pragmatic_score = how effectively did the student communicate their intent (5=perfect). ` +
    `social_friction = how much impatience or awkwardness this creates for the other character (5=very disruptive). ` +
    `IMPORTANT: Distinguish between linguistic struggle and social hostility. ` +
    `Grammar errors, missing vocabulary, or hesitation = LOW friction (the character is patient with learners). ` +
    `Only assign HIGH friction for turns that are culturally rude, dismissive, or impossible to understand entirely.`;

  const userPrompt = `Student said: "${text.slice(0, 300)}"`;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 60,
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
    return {
      pragmaticScore: Math.max(0, Math.min(5, Number(parsed.pragmatic_score ?? 3))),
      socialFriction: Math.max(0, Math.min(5, Number(parsed.social_friction ?? 1))),
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
    const { getUserDb } = await import('../db');
    const { sql } = await import('drizzle-orm');
    const db = getUserDb();
    await db.execute(sql`
      INSERT INTO scene_world_ledger (id, user_id, scene_name, ledger, tension, updated_at)
      VALUES (gen_random_uuid(), ${userId}, ${sceneName}, '{}', ${tension}, now())
      ON CONFLICT (user_id, scene_name) DO UPDATE
        SET tension = ${tension}, updated_at = now()
    `);
  } catch {
    // fire-and-forget — don't crash caller
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
    return '*(the other person has their hand near the door, face a mask of cold politeness — one more misunderstanding and they are gone. Meet them where they are, right now)*';
  }
  if (band === 'comfortable' && (prevBand === 'tense' || prevBand === 'breaking')) {
    return '*(their shoulders drop slightly, a slow breath out — something in their eyes softens, like they were waiting to give you this chance)*';
  }
  return null;
}

// ─── Style Shapers ────────────────────────────────────────────────────────────
// Periodic latent-space pressure injected every 3 scene turns.
// Written in third-person to prevent fighting the Magic Circle's identity framing.
// Goal: counter RLHF drift back to "helpful language tutor" voice.
// When lifecycleState is 'EXITING', fires the Aftermath shaper regardless of counter.

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

export function selectStyleShaper(session: any): string | null {
  if (!session?.sceneCanvas) return null;

  // Aftermath: fires once after Graceful Exit — signalled by pendingAftermath
  // (set by selectPedagogicalDirective when it fires REST_REFLECT).
  // Order-safe: does not depend on lifecycleState, which the planner already consumed.
  if (session.pendingAftermath) {
    session.pendingAftermath = false; // consume — fires exactly once
    return AFTERMATH_SHAPER;
  }

  // Every 3 turns, inject a band-appropriate style pressure
  const sceneAge: number = session.sceneAge ?? 0;
  if (sceneAge === 0 || sceneAge % 3 !== 0) return null;

  const tension: number = typeof session.sceneTension === 'number' ? session.sceneTension : 0;
  const band = getTensionBand(tension);
  return STYLE_SHAPERS[band];
}

// ─── Main session helper ─────────────────────────────────────────────────────
// Returns a world event stage direction if the tension band changed, else null.
// Side effects on session:
//   - session.sceneTension updated
//   - session.lastTensionBand updated on band change
//   - session.lastTurnScores set
//   - session.sceneAge incremented (auto-resets when scene name changes)
//   - session.lifecycleState set to 'EXITING' on tense/breaking → comfortable transition

export async function evaluateAndUpdateTension(
  text: string,
  session: any,
): Promise<string | null> {
  const userId = String(session?.userId || session?.user?.id || '');
  const sceneName = session?.sceneCanvas?.environment as string | undefined;
  if (!sceneName || !userId) return null;

  // ── Scene age tracking ────────────────────────────────────────────────────
  // Auto-reset when the active scene changes (self-healing — no caller changes needed)
  if (session.lastSceneName !== sceneName) {
    session.sceneAge = 0;
    session.lastSceneName = sceneName;
  }
  session.sceneAge = (session.sceneAge ?? 0) + 1;

  const language = (session?.language || session?.targetLanguage || 'Spanish') as string;
  const missionGoal = session?.currentMissionGoal as string | undefined;

  const scores = await evaluateStudentTurn(text, { language, sceneName, missionGoal });

  const prev: number = typeof session.sceneTension === 'number' ? session.sceneTension : 0;
  const next = applyFriction(prev, scores.socialFriction, scores.pragmaticScore);
  session.sceneTension = next;

  const prevBand = getTensionBand(prev);
  const nextBand = getTensionBand(next);

  if (!session.lastTensionBand) session.lastTensionBand = prevBand;
  const lastInjected: TensionBand = session.lastTensionBand;
  const worldEvent = getWorldEventText(nextBand, lastInjected);
  if (worldEvent) session.lastTensionBand = nextBand;

  // ── Graceful Exit detection ───────────────────────────────────────────────
  // When tension drops from tense/breaking → comfortable, signal the planner
  // to fire REST_REFLECT on the next GOAP evaluation.
  const wasHigh = prevBand === 'tense' || prevBand === 'breaking';
  const nowComfortable = nextBand === 'comfortable';
  if (wasHigh && nowComfortable && session.lifecycleState !== 'EXITING') {
    session.lifecycleState = 'EXITING';
  }

  // Persist async — don't await
  persistTension(userId, sceneName, next).catch(() => {});

  // Store scores on session so pedagogical-planner.ts can read them synchronously
  session.lastTurnScores = scores;

  if (scores.pragmaticScore >= 4 || scores.socialFriction >= 3) {
    console.log(
      `[Tension] ${sceneName} ${prev.toFixed(2)}→${next.toFixed(2)} (${prevBand}→${nextBand}) ` +
      `prag=${scores.pragmaticScore} friction=${scores.socialFriction}` +
      `${worldEvent ? ' [WorldEvent]' : ''}${session.lifecycleState === 'EXITING' ? ' [EXITING]' : ''}`,
    );
  }

  return worldEvent;
}

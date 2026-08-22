// server/services/scene-memory-distiller.ts
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
// Memory Distillation — Part 3 of the Graceful Exit Protocol.
//
// When a scene exits (lifecycleState='EXITING'), distills the narrative footprint
// of the encounter into the scene_world_ledger.ledger JSONB field.
// Zero LLM call — template-based, instantaneous, fire-and-forget.
//
// The ledger JSON is read back in future sessions to give Daniela context:
// "Last time in this café, you resolved a tense standoff with the barista."
//
// Full doc: docs/worldness-framework.md — Graceful Exit Protocol

export interface SceneOutcomeLedger {
  outcome: 'SUCCESS' | 'NEUTRAL' | 'FRACTURE';
  summary: string;
  peakTension: number;
  finalTension: number;
  sceneAge: number;
  hadCrisisBeat: boolean;
  distilledAt: string;
  registerHistory?: string; // 'HARMONIC' | 'INCONGRUENT' | 'MIXED'
}

// ─── Outcome heuristic ────────────────────────────────────────────────────────
// Determined from session state at the moment of exit — no LLM call.

function resolveOutcome(session: any): 'SUCCESS' | 'NEUTRAL' | 'FRACTURE' {
  const finalPrag: number = session.lastTurnScores?.pragmaticScore ?? 3;
  const finalTension: number = session.sceneTension ?? 0;
  const hadBailout = session.lastPedagogicalActionType === 'BAILOUT';

  if (hadBailout) return 'FRACTURE';
  if (finalPrag >= 4 && finalTension < 0.30) return 'SUCCESS';
  if (finalPrag <= 2 || finalTension > 0.50) return 'FRACTURE';
  return 'NEUTRAL';
}

// ─── Summary template ────────────────────────────────────────────────────────

function buildSummary(sceneName: string, outcome: string, session: any): string {
  const age = session.sceneAge ?? 0;
  const peak = (session.sceneTensionPeak ?? session.sceneTension ?? 0).toFixed(2);

  const outcomePhrases: Record<string, string> = {
    SUCCESS: 'you worked through a tense exchange and came out the other side',
    NEUTRAL: 'you navigated a moderately charged encounter',
    FRACTURE: 'things got difficult and the scene ended under pressure',
  };

  const crisisNote = session.crisisBeatEverActive
    ? ' A critical moment required you to communicate clearly under real pressure.'
    : '';

  return `Last time in "${sceneName}", ${outcomePhrases[outcome] || outcomePhrases.NEUTRAL}.${crisisNote} The scene lasted ${age} exchanges with a peak tension of ${peak}.`;
}

// ─── Register summary ─────────────────────────────────────────────────────────

function summarizeRegisterHistory(session: any): string | undefined {
  const incongruent: number = session.registerIncongruentCount ?? 0;
  const total: number = session.sceneAge ?? 1;
  if (incongruent === 0) return 'HARMONIC';
  if (incongruent / total > 0.4) return 'INCONGRUENT';
  return 'MIXED';
}

// ─── Main distiller ───────────────────────────────────────────────────────────
// Fire-and-forget — call with .catch(() => {}) from tension-evaluator.

export async function distillSceneMemory(session: any): Promise<void> {
  const userId = String(session?.userId || session?.user?.id || '');
  const sceneName = session?.sceneCanvas?.environment as string | undefined;
  if (!sceneName || !userId) return;

  const outcome = resolveOutcome(session);
  const summary = buildSummary(sceneName, outcome, session);
  const registerHistory = summarizeRegisterHistory(session);

  const ledger: SceneOutcomeLedger = {
    outcome,
    summary,
    peakTension: session.sceneTensionPeak ?? session.sceneTension ?? 0,
    finalTension: session.sceneTension ?? 0,
    sceneAge: session.sceneAge ?? 0,
    hadCrisisBeat: !!(session.crisisBeatEverActive),
    distilledAt: new Date().toISOString(),
    registerHistory,
  };

  try {
    const db = getUserDb();
    await db.execute(sql`
      INSERT INTO scene_world_ledger (id, user_id, scene_name, ledger, tension, updated_at)
      VALUES (gen_random_uuid(), ${userId}, ${sceneName}, ${JSON.stringify(ledger)}::jsonb, ${ledger.finalTension}, now())
      ON CONFLICT (user_id, scene_name) DO UPDATE
        SET ledger = ${JSON.stringify(ledger)}::jsonb,
            tension = ${ledger.finalTension},
            updated_at = now()
    `);

    console.log(
      `[MemoryDistiller] "${sceneName}" → ${outcome} | age=${ledger.sceneAge} ` +
      `peak=${ledger.peakTension.toFixed(2)} crisis=${ledger.hadCrisisBeat}`,
    );
  } catch (err) {
    // fire-and-forget — silent failure acceptable
    console.error('[MemoryDistiller] Write failed:', err);
  }
}

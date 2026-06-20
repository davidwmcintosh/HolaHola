/**
 * Pedagogical State Service
 *
 * Server-side state machine for structured Daniela teaching loops.
 * Persists loop progress in pedagogical_loop_state so it survives GL context
 * window decay. Daniela queries this via four tools:
 *
 *   get_current_teaching_context() — compass bearing at any point
 *   start_madrigal_loop(vocab_query) — semantic match → create loop → step 0
 *   advance_loop_step(performance) — move forward or stay; mark complete
 *   suspend_current_loop(reason) — gracefully pause without distorting performance data
 *
 * Every method returns a State Envelope: { result, compass }. Since
 * sendClientContent is disabled for mid-session injection, the tool response IS
 * the only injection window. The compass is always returned so Daniela's context
 * window is atomically updated with ground-truth state on every tool interaction.
 *
 * SESSION ID RESOLUTION (important):
 * The public API accepts `glSessionId` (the Gemini Live streaming session ID) and
 * `studentId` (userId). Internally, we resolve the most recent tutor_session for
 * the student — this is the FK-safe ID used in pedagogical_loop_state.sessionId.
 * This means loops persist across GL reconnections within the same tutor session,
 * which is the desired behavior for curriculum continuity.
 *
 * Gemini architecture review: rounds 2 + 3, June 2026. Both rounds: GO.
 */

import { getSharedDb } from '../db';
import {
  pedagogicalLoopState,
  tutorSessions,
  memoryEmbeddings,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { findMadrigalUnit, getAllMadrigalUnits, type MadrigalStep } from '../data/madrigal-loop-catalog';
import { embedText, cosineSimilarity } from './semantic-memory-service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveLoopContext {
  loopId: string;
  contentKey: string;
  loopType: string;
  currentStep: number;
  totalSteps: number;
  currentStepContent: MadrigalStep;
  remainingSteps: number;
}

export interface SuspendedLoopRef {
  loopId: string;
  contentKey: string;
  currentStep: number;
  totalSteps: number;
}

export interface PedagogicalCompass {
  activeLoop: ActiveLoopContext | null;
  suspendedLoops: SuspendedLoopRef[];
  nextRecommendation: string;
}

export interface StateEnvelope {
  result: Record<string, unknown>;
  compass: PedagogicalCompass;
}

const EMPTY_COMPASS: PedagogicalCompass = {
  activeLoop: null,
  suspendedLoops: [],
  nextRecommendation: 'No tutor session found — session may not have started. Continue verbally.',
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class PedagogicalStateService {
  private static instance: PedagogicalStateService;

  static getInstance(): PedagogicalStateService {
    if (!PedagogicalStateService.instance) {
      PedagogicalStateService.instance = new PedagogicalStateService();
    }
    return PedagogicalStateService.instance;
  }

  // ─── Tutor session resolver ────────────────────────────────────────────────
  // Returns the most recent tutor session ID for the student — this is the FK
  // value used in pedagogical_loop_state.sessionId (references tutorSessions.id).
  // Returns null if no tutor session exists yet for this student.

  private async resolveTutorSessionId(studentId: string): Promise<string | null> {
    if (!studentId) return null;
    const db = getSharedDb();
    const [session] = await db
      .select({ id: tutorSessions.id })
      .from(tutorSessions)
      .where(eq(tutorSessions.userId, studentId))
      .orderBy(desc(tutorSessions.createdAt))
      .limit(1);
    return session?.id ?? null;
  }

  // ─── get_current_teaching_context ─────────────────────────────────────────

  async getTeachingContext(glSessionId: string, studentId: string): Promise<StateEnvelope> {
    const tutorSessionId = await this.resolveTutorSessionId(studentId);
    if (!tutorSessionId) {
      console.warn(`[PedagogicalState] getTeachingContext — no tutor session for student ${studentId}`);
      return { result: { status: 'no_session', message: 'No active tutor session — session may not have started yet.' }, compass: EMPTY_COMPASS };
    }

    const compass = await this.buildCompass(tutorSessionId, studentId);
    const result: Record<string, unknown> = { status: 'ok' };

    if (compass.activeLoop) {
      result.activeLoop = compass.activeLoop;
      result.message = `Active loop: "${compass.activeLoop.contentKey}" — step ${compass.activeLoop.currentStep + 1} of ${compass.activeLoop.totalSteps}. ${compass.activeLoop.currentStepContent.verbalInstruction}`;
    } else if (compass.suspendedLoops.length > 0) {
      result.suspendedLoops = compass.suspendedLoops;
      result.message = `No active loop. You have ${compass.suspendedLoops.length} suspended loop(s) available to resume.`;
    } else {
      result.message = 'No active or suspended teaching loops. Free to choose the next topic from the session plan.';
    }

    result.recommendation = compass.nextRecommendation;

    console.log(`[PedagogicalState] getTeachingContext tutorSession=${tutorSessionId} active=${!!compass.activeLoop} suspended=${compass.suspendedLoops.length}`);
    return { result, compass };
  }

  // ─── start_madrigal_loop ──────────────────────────────────────────────────

  async startMadrigalLoop(
    glSessionId: string,
    studentId: string,
    vocabQuery: string,
  ): Promise<StateEnvelope> {
    const tutorSessionId = await this.resolveTutorSessionId(studentId);
    if (!tutorSessionId) {
      console.warn(`[PedagogicalState] startMadrigalLoop — no tutor session for student ${studentId}`);
      return { result: { status: 'no_session', message: 'No active tutor session — cannot start loop.' }, compass: EMPTY_COMPASS };
    }

    const db = getSharedDb();

    // Suspend any currently active loop before starting a new one
    await db
      .update(pedagogicalLoopState)
      .set({ status: 'suspended', suspendedAt: new Date(), suspendReason: 'new loop started' })
      .where(and(
        eq(pedagogicalLoopState.sessionId, tutorSessionId),
        eq(pedagogicalLoopState.status, 'active'),
      ));

    // Semantic match against indexed Madrigal units
    const matchedUnit = await this.semanticMatchMadrigalUnit(vocabQuery);

    if (!matchedUnit) {
      const compass = await this.buildCompass(tutorSessionId, studentId);
      return {
        result: {
          status: 'no_match',
          message: `No Madrigal unit found for "${vocabQuery}". Try rephrasing or ask the student what they want to practice.`,
        },
        compass,
      };
    }

    // Build step data JSONB
    const stepData = matchedUnit.steps;
    const firstStep = matchedUnit.steps[0];

    // Create the loop state row
    const [loop] = await db
      .insert(pedagogicalLoopState)
      .values({
        sessionId: tutorSessionId,
        studentId,
        status: 'active',
        loopType: 'madrigal_4step',
        loopContentKey: matchedUnit.contentKey,
        currentStep: 0,
        totalSteps: matchedUnit.steps.length,
        stepData: stepData as unknown as Record<string, unknown>,
        studentPerformance: [] as unknown as Record<string, unknown>,
      })
      .returning();

    const compass = await this.buildCompass(tutorSessionId, studentId);

    console.log(`[PedagogicalState] startMadrigalLoop matched="${matchedUnit.contentKey}" query="${vocabQuery}" loopId=${loop.id} tutorSession=${tutorSessionId}`);

    return {
      result: {
        status: 'loop_started',
        loopId: loop.id,
        contentKey: matchedUnit.contentKey,
        displayName: matchedUnit.displayName,
        step: 0,
        totalSteps: matchedUnit.steps.length,
        stepName: firstStep.stepName,
        verbalInstruction: firstStep.verbalInstruction,
        studentAction: firstStep.studentAction,
        teacherHint: firstStep.teacherHint,
        remainingSteps: matchedUnit.steps.length - 1,
      },
      compass,
    };
  }

  // ─── advance_loop_step ────────────────────────────────────────────────────

  async advanceLoopStep(
    glSessionId: string,
    studentId: string,
    performance: 'pass' | 'needs_more' | 'skip',
  ): Promise<StateEnvelope> {
    const tutorSessionId = await this.resolveTutorSessionId(studentId);
    if (!tutorSessionId) {
      return { result: { status: 'no_session', message: 'No active tutor session.' }, compass: EMPTY_COMPASS };
    }

    const db = getSharedDb();

    // Find the active loop for this tutor session
    const [activeLoop] = await db
      .select()
      .from(pedagogicalLoopState)
      .where(and(
        eq(pedagogicalLoopState.sessionId, tutorSessionId),
        eq(pedagogicalLoopState.status, 'active'),
      ))
      .orderBy(desc(pedagogicalLoopState.startedAt))
      .limit(1);

    if (!activeLoop) {
      const compass = await this.buildCompass(tutorSessionId, studentId);
      return {
        result: {
          status: 'no_active_loop',
          message: 'No active teaching loop found. Call get_current_teaching_context to check for suspended loops.',
        },
        compass,
      };
    }

    const steps = activeLoop.stepData as unknown as MadrigalStep[];
    const currentStep = activeLoop.currentStep;

    // Record performance for this step
    const performanceRecord = activeLoop.studentPerformance as unknown as Array<{ step: number; result: string; timestamp: string }>;
    performanceRecord.push({ step: currentStep, result: performance, timestamp: new Date().toISOString() });

    if (performance === 'needs_more') {
      // Stay on current step — return same instructions with an encouragement note
      await db
        .update(pedagogicalLoopState)
        .set({ studentPerformance: performanceRecord as unknown as Record<string, unknown> })
        .where(eq(pedagogicalLoopState.id, activeLoop.id));

      // Count how many times needs_more has occurred on this specific step
      // so the handler in native-fc-handlers can surface repeated struggles.
      const needsMoreOnStep = performanceRecord.filter(
        p => p.step === currentStep && p.result === 'needs_more',
      ).length;

      const compass = await this.buildCompass(tutorSessionId, studentId);
      return {
        result: {
          status: 'repeat_step',
          step: currentStep,
          stepName: steps[currentStep].stepName,
          verbalInstruction: steps[currentStep].verbalInstruction,
          studentAction: steps[currentStep].studentAction,
          teacherHint: steps[currentStep].teacherHint,
          remainingSteps: activeLoop.totalSteps - currentStep - 1,
          needsMoreOnStep,
          contentKey: activeLoop.loopContentKey,
          note: 'Student needs more practice on this step. Repeat with encouragement.',
        },
        compass,
      };
    }

    // Pass or skip — advance to next step
    const nextStep = currentStep + 1;

    if (nextStep >= activeLoop.totalSteps) {
      // Loop complete
      await db
        .update(pedagogicalLoopState)
        .set({
          status: 'completed',
          currentStep: nextStep,
          studentPerformance: performanceRecord as unknown as Record<string, unknown>,
          completedAt: new Date(),
        })
        .where(eq(pedagogicalLoopState.id, activeLoop.id));

      const passCount = performanceRecord.filter(p => p.result === 'pass').length;
      const totalSteps = activeLoop.totalSteps;
      const compass = await this.buildCompass(tutorSessionId, studentId);

      console.log(`[PedagogicalState] Loop complete: "${activeLoop.loopContentKey}" passes=${passCount}/${totalSteps}`);

      return {
        result: {
          status: 'loop_complete',
          contentKey: activeLoop.loopContentKey,
          totalSteps,
          passCount,
          performance: performanceRecord,
          message: `Loop complete — ${activeLoop.loopContentKey} (${passCount}/${totalSteps} steps passed). Mark this in your session notes. Well done!`,
        },
        compass,
      };
    }

    // Advance to next step
    await db
      .update(pedagogicalLoopState)
      .set({
        currentStep: nextStep,
        studentPerformance: performanceRecord as unknown as Record<string, unknown>,
      })
      .where(eq(pedagogicalLoopState.id, activeLoop.id));

    const nextStepContent = steps[nextStep];
    const compass = await this.buildCompass(tutorSessionId, studentId);

    return {
      result: {
        status: 'step_advanced',
        previousStep: currentStep,
        step: nextStep,
        totalSteps: activeLoop.totalSteps,
        stepName: nextStepContent.stepName,
        verbalInstruction: nextStepContent.verbalInstruction,
        studentAction: nextStepContent.studentAction,
        teacherHint: nextStepContent.teacherHint,
        remainingSteps: activeLoop.totalSteps - nextStep - 1,
      },
      compass,
    };
  }

  // ─── suspend_current_loop ─────────────────────────────────────────────────

  async suspendCurrentLoop(
    glSessionId: string,
    studentId: string,
    reason: string,
  ): Promise<StateEnvelope> {
    const tutorSessionId = await this.resolveTutorSessionId(studentId);
    if (!tutorSessionId) {
      return { result: { status: 'no_session', message: 'No active tutor session.' }, compass: EMPTY_COMPASS };
    }

    const db = getSharedDb();

    const [activeLoop] = await db
      .select()
      .from(pedagogicalLoopState)
      .where(and(
        eq(pedagogicalLoopState.sessionId, tutorSessionId),
        eq(pedagogicalLoopState.status, 'active'),
      ))
      .limit(1);

    if (!activeLoop) {
      const compass = await this.buildCompass(tutorSessionId, studentId);
      return {
        result: {
          status: 'no_active_loop',
          message: 'No active loop to suspend.',
        },
        compass,
      };
    }

    await db
      .update(pedagogicalLoopState)
      .set({
        status: 'suspended',
        suspendedAt: new Date(),
        suspendReason: reason,
      })
      .where(eq(pedagogicalLoopState.id, activeLoop.id));

    const compass = await this.buildCompass(tutorSessionId, studentId);

    console.log(`[PedagogicalState] suspendLoop "${activeLoop.loopContentKey}" step=${activeLoop.currentStep} reason="${reason}"`);

    return {
      result: {
        status: 'loop_suspended',
        contentKey: activeLoop.loopContentKey,
        suspendedAtStep: activeLoop.currentStep,
        message: `"${activeLoop.loopContentKey}" paused at step ${activeLoop.currentStep + 1}. It will appear in suspended loops when you're ready to return.`,
      },
      compass,
    };
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private async buildCompass(tutorSessionId: string, studentId: string): Promise<PedagogicalCompass> {
    const db = getSharedDb();

    const loops = await db
      .select()
      .from(pedagogicalLoopState)
      .where(eq(pedagogicalLoopState.sessionId, tutorSessionId))
      .orderBy(desc(pedagogicalLoopState.startedAt))
      .limit(10);

    const activeLoops = loops.filter(l => l.status === 'active');
    const suspendedLoops = loops.filter(l => l.status === 'suspended');

    let activeLoop: ActiveLoopContext | null = null;
    if (activeLoops.length > 0) {
      const l = activeLoops[0];
      const steps = l.stepData as unknown as MadrigalStep[];
      const stepIndex = Math.min(l.currentStep, steps.length - 1);
      activeLoop = {
        loopId: l.id,
        contentKey: l.loopContentKey,
        loopType: l.loopType,
        currentStep: l.currentStep,
        totalSteps: l.totalSteps,
        currentStepContent: steps[stepIndex],
        remainingSteps: l.totalSteps - l.currentStep - 1,
      };
    }

    const suspendedRefs: SuspendedLoopRef[] = suspendedLoops.map(l => ({
      loopId: l.id,
      contentKey: l.loopContentKey,
      currentStep: l.currentStep,
      totalSteps: l.totalSteps,
    }));

    let nextRecommendation = '';
    if (activeLoop) {
      nextRecommendation = `Continue "${activeLoop.contentKey}" — step ${activeLoop.currentStep + 1}/${activeLoop.totalSteps}: ${activeLoop.currentStepContent.studentAction}`;
    } else if (suspendedRefs.length > 0) {
      nextRecommendation = `Resume suspended loop "${suspendedRefs[0].contentKey}" (at step ${suspendedRefs[0].currentStep + 1}/${suspendedRefs[0].totalSteps}) or choose a new topic.`;
    } else {
      nextRecommendation = 'No active loops. Choose the next topic from the session plan or let the student lead.';
    }

    return { activeLoop, suspendedLoops: suspendedRefs, nextRecommendation };
  }

  private async semanticMatchMadrigalUnit(vocabQuery: string): Promise<ReturnType<typeof findMadrigalUnit>> {
    const db = getSharedDb();

    // Load all madrigal_unit embeddings
    const indexed = await db
      .select({
        memoryId: memoryEmbeddings.memoryId,
        embedding: memoryEmbeddings.embedding,
      })
      .from(memoryEmbeddings)
      .where(eq(memoryEmbeddings.memoryType, 'madrigal_unit'));

    if (indexed.length === 0) {
      // Fallback: simple text matching against vocab terms
      console.warn('[PedagogicalState] No madrigal_unit embeddings found — falling back to text match');
      return this.textMatchMadrigalUnit(vocabQuery);
    }

    // Embed the query
    let queryEmbedding: number[];
    try {
      queryEmbedding = await embedText(vocabQuery);
    } catch (err) {
      console.warn('[PedagogicalState] Embedding failed, falling back to text match:', err);
      return this.textMatchMadrigalUnit(vocabQuery);
    }

    // Find best cosine match
    let bestKey = '';
    let bestScore = 0;
    for (const row of indexed) {
      const emb = row.embedding as number[];
      const score = cosineSimilarity(queryEmbedding, emb);
      if (score > bestScore) {
        bestScore = score;
        bestKey = row.memoryId;
      }
    }

    const SIMILARITY_THRESHOLD = 0.35;
    if (bestScore < SIMILARITY_THRESHOLD) {
      console.log(`[PedagogicalState] Best match "${bestKey}" score=${bestScore.toFixed(3)} — below threshold, no match`);
      return null;
    }

    console.log(`[PedagogicalState] Semantic match: "${bestKey}" score=${bestScore.toFixed(3)} for query="${vocabQuery}"`);
    return findMadrigalUnit(bestKey);
  }

  private textMatchMadrigalUnit(vocabQuery: string): ReturnType<typeof findMadrigalUnit> {
    const q = vocabQuery.toLowerCase();
    const units = getAllMadrigalUnits();

    let bestScore = 0;
    let bestUnit = null;
    for (const unit of units) {
      let score = 0;
      for (const term of unit.vocabTerms) {
        if (q.includes(term.toLowerCase()) || term.toLowerCase().includes(q)) score++;
      }
      if (unit.contentKey.toLowerCase().includes(q) || q.includes(unit.contentKey.toLowerCase())) score += 3;
      if (score > bestScore) {
        bestScore = score;
        bestUnit = unit;
      }
    }

    if (bestScore === 0) return null;
    console.log(`[PedagogicalState] Text match: "${bestUnit?.contentKey}" score=${bestScore} for query="${vocabQuery}"`);
    return bestUnit ?? null;
  }
}

export const pedagogicalStateService = PedagogicalStateService.getInstance();

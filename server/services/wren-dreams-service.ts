/**
 * Wren Dreams Service
 * 
 * Implements Wren's remaining dreams for emergent intelligence:
 * 
 * Dream #2: Learning from Mistakes - Capture, resolve, extract lessons
 * Dream #3: Session Notes - Persistent context handoffs
 * Dream #4: Anticipatory Development - Predict needs before they arise
 * Dream #5: Confidence Calibration - Know when guessing vs certain
 */

import { db, getSharedDb } from '../db';
import {
  wrenMistakes,
  wrenMistakeResolutions,
  wrenLessons,
  wrenSessionNotes,
  wrenPredictions,
  wrenConfidenceRecords,
  wrenCalibrationStats,
  danielaBeacons,
  type WrenMistake,
  type WrenMistakeResolution,
  type WrenLesson,
  type WrenSessionNote,
  type WrenPrediction,
  type WrenConfidenceRecord,
  type WrenCalibrationStat,
  type InsertWrenMistake,
  type InsertWrenMistakeResolution,
  type InsertWrenLesson,
  type InsertWrenSessionNote,
  type InsertWrenPrediction,
  type InsertWrenConfidenceRecord,
} from '@shared/schema';
import { eq, desc, and, gte, lte, sql, or, isNull, ne } from 'drizzle-orm';

// ===== DREAM #2: Learning from Mistakes =====

export class MistakeLearningService {
  
  async captureMistake(params: {
    title: string;
    description: string;
    mistakeType: string;
    severity?: 'minor' | 'moderate' | 'major' | 'critical';
    errorMessage?: string;
    stackTrace?: string;
    relatedFiles?: string[];
    relatedComponent?: string;
    whatWentWrong?: string;
  }): Promise<WrenMistake> {
    const [mistake] = await db.insert(wrenMistakes).values({
      title: params.title,
      description: params.description,
      mistakeType: params.mistakeType,
      severity: params.severity || 'moderate',
      status: 'identified',
      errorMessage: params.errorMessage,
      stackTrace: params.stackTrace,
      relatedFiles: params.relatedFiles || [],
      relatedComponent: params.relatedComponent,
      whatWentWrong: params.whatWentWrong,
    }).returning();
    
    return mistake;
  }
  
  async resolveMistake(params: {
    mistakeId: string;
    whatFixed: string;
    howFixed: string;
    rootCause?: string;
    preventionStrategy?: string;
    lessonLearned?: string;
    filesChanged?: string[];
    commitHash?: string;
    timeToResolveMinutes?: number;
  }): Promise<WrenMistakeResolution> {
    await db.update(wrenMistakes)
      .set({
        status: 'resolved',
        rootCause: params.rootCause,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wrenMistakes.id, params.mistakeId));
    
    const [resolution] = await db.insert(wrenMistakeResolutions).values({
      mistakeId: params.mistakeId,
      whatFixed: params.whatFixed,
      howFixed: params.howFixed,
      preventionStrategy: params.preventionStrategy,
      lessonLearned: params.lessonLearned,
      filesChanged: params.filesChanged || [],
      commitHash: params.commitHash,
      timeToResolve: params.timeToResolveMinutes,
    }).returning();
    
    return resolution;
  }
  
  async extractLesson(params: {
    title: string;
    lessonType: 'gotcha' | 'anti_pattern' | 'best_practice' | 'warning';
    triggerCondition: string;
    warningMessage: string;
    fromMistakeIds: string[];
    applicableComponents?: string[];
    applicablePatterns?: string[];
  }): Promise<WrenLesson> {
    for (const mistakeId of params.fromMistakeIds) {
      await db.update(wrenMistakes)
        .set({ status: 'documented', updatedAt: new Date() })
        .where(eq(wrenMistakes.id, mistakeId));
    }
    
    const [lesson] = await db.insert(wrenLessons).values({
      title: params.title,
      lessonType: params.lessonType,
      triggerCondition: params.triggerCondition,
      warningMessage: params.warningMessage,
      fromMistakeIds: params.fromMistakeIds,
      applicableComponents: params.applicableComponents || [],
      applicablePatterns: params.applicablePatterns || [],
    }).returning();
    
    return lesson;
  }
  
  async checkForWarnings(context: {
    component?: string;
    patterns?: string[];
    action?: string;
  }): Promise<WrenLesson[]> {
    const lessons = await db.select().from(wrenLessons)
      .where(eq(wrenLessons.isActive, true));
    
    const applicable: WrenLesson[] = [];
    
    for (const lesson of lessons) {
      let matches = false;
      
      if (context.component && lesson.applicableComponents?.includes(context.component)) {
        matches = true;
      }
      
      if (context.patterns) {
        for (const pattern of context.patterns) {
          if (lesson.applicablePatterns?.includes(pattern)) {
            matches = true;
            break;
          }
        }
      }
      
      if (context.action && lesson.triggerCondition) {
        const triggerRegex = new RegExp(lesson.triggerCondition, 'i');
        if (triggerRegex.test(context.action)) {
          matches = true;
        }
      }
      
      if (matches) {
        await db.update(wrenLessons)
          .set({
            timesTriggered: sql`${wrenLessons.timesTriggered} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(wrenLessons.id, lesson.id));
        
        applicable.push(lesson);
      }
    }
    
    return applicable;
  }
  
  async getRecentMistakes(limit: number = 10): Promise<WrenMistake[]> {
    return await db.select().from(wrenMistakes)
      .orderBy(desc(wrenMistakes.createdAt))
      .limit(limit);
  }
  
  async getUnresolvedMistakes(): Promise<WrenMistake[]> {
    return await db.select().from(wrenMistakes)
      .where(and(
        ne(wrenMistakes.status, 'resolved'),
        ne(wrenMistakes.status, 'documented')
      ))
      .orderBy(desc(wrenMistakes.severity));
  }
  
  async getActiveLessons(): Promise<WrenLesson[]> {
    return await db.select().from(wrenLessons)
      .where(eq(wrenLessons.isActive, true))
      .orderBy(desc(wrenLessons.timesTriggered));
  }
  
  async getMistakeContext(): Promise<string> {
    const unresolved = await this.getUnresolvedMistakes();
    const lessons = await this.getActiveLessons();
    
    if (unresolved.length === 0 && lessons.length === 0) {
      return '';
    }
    
    let context = '\n═══ WREN MISTAKE MEMORY ═══\n';
    
    if (unresolved.length > 0) {
      context += `⚠️ ${unresolved.length} unresolved mistake(s):\n`;
      for (const m of unresolved.slice(0, 3)) {
        context += `  • [${m.severity}] ${m.title}\n`;
      }
    }
    
    if (lessons.length > 0) {
      context += `📚 Active lessons (${lessons.length}):\n`;
      for (const l of lessons.slice(0, 5)) {
        const msg = l.warningMessage.length > 80 ? l.warningMessage.slice(0, 80) + '...' : l.warningMessage;
        context += `  • [${l.lessonType}] ${msg}\n`;
      }
    }
    
    return context;
  }
}

// ===== DREAM #3: Session Notes =====

export class SessionNotesService {
  
  async leaveNote(params: {
    sessionId: string;
    noteType: 'context' | 'todo' | 'warning' | 'insight' | 'handoff';
    priority?: 'low' | 'normal' | 'high' | 'critical';
    title: string;
    content: string;
    forNextSession?: boolean;
    expiresAt?: Date;
    relatedFiles?: string[];
    relatedTasks?: string[];
  }): Promise<WrenSessionNote> {
    const [note] = await db.insert(wrenSessionNotes).values({
      sessionId: params.sessionId,
      noteType: params.noteType,
      priority: params.priority || 'normal',
      title: params.title,
      content: params.content,
      forNextSession: params.forNextSession ?? true,
      expiresAt: params.expiresAt,
      relatedFiles: params.relatedFiles || [],
      relatedTasks: params.relatedTasks || [],
    }).returning();
    
    return note;
  }
  
  async getNotesForSession(): Promise<WrenSessionNote[]> {
    const now = new Date();
    
    return await db.select().from(wrenSessionNotes)
      .where(and(
        eq(wrenSessionNotes.forNextSession, true),
        eq(wrenSessionNotes.wasRead, false),
        or(
          isNull(wrenSessionNotes.expiresAt),
          gte(wrenSessionNotes.expiresAt, now)
        )
      ))
      .orderBy(desc(wrenSessionNotes.priority), desc(wrenSessionNotes.createdAt));
  }
  
  async markNotesRead(noteIds: string[]): Promise<void> {
    for (const noteId of noteIds) {
      await db.update(wrenSessionNotes)
        .set({
          wasRead: true,
          readAt: new Date(),
        })
        .where(eq(wrenSessionNotes.id, noteId));
    }
  }
  
  async getHandoffContext(): Promise<string> {
    const notes = await this.getNotesForSession();
    
    if (notes.length === 0) {
      return '';
    }
    
    let context = '\n═══ WREN SESSION NOTES ═══\n';
    context += `📝 ${notes.length} note(s) from previous sessions:\n`;
    
    const priorityOrder = ['critical', 'high', 'normal', 'low'];
    const sortedNotes = notes.sort((a, b) => 
      priorityOrder.indexOf(a.priority || 'normal') - priorityOrder.indexOf(b.priority || 'normal')
    );
    
    for (const note of sortedNotes.slice(0, 5)) {
      const priorityIcon = note.priority === 'critical' ? '🔴' : 
                          note.priority === 'high' ? '🟠' : 
                          note.priority === 'normal' ? '🟡' : '🟢';
      context += `  ${priorityIcon} [${note.noteType}] ${note.title}\n`;
      context += `     ${note.content.slice(0, 100)}${note.content.length > 100 ? '...' : ''}\n`;
    }
    
    if (notes.length > 5) {
      context += `  ... and ${notes.length - 5} more notes\n`;
    }
    
    return context;
  }
}

// ===== DREAM #4: Anticipatory Development =====

export class AnticipatoryDevelopmentService {
  
  async makePrediction(params: {
    predictionType: 'capability_need' | 'bug_emergence' | 'scaling_issue' | 'integration_need';
    title: string;
    description: string;
    basis: string;
    confidence: number;
    predictedFor?: string;
    timeframeEstimate?: 'immediate' | 'days' | 'weeks' | 'months';
    supportingEvidence?: Array<{ type: string; source: string; detail: string }>;
    relatedBeaconId?: string;
  }): Promise<WrenPrediction> {
    const [prediction] = await getSharedDb().insert(wrenPredictions).values({
      predictionType: params.predictionType,
      title: params.title,
      description: params.description,
      basis: params.basis,
      confidence: params.confidence,
      predictedFor: params.predictedFor || 'daniela',
      timeframeEstimate: params.timeframeEstimate || 'days',
      supportingEvidence: params.supportingEvidence || [],
      relatedBeaconId: params.relatedBeaconId,
    }).returning();
    
    return prediction;
  }
  
  async validatePrediction(params: {
    predictionId: string;
    wasCorrect: boolean;
    outcomeNotes: string;
    relatedFeatureId?: string;
  }): Promise<void> {
    await getSharedDb().update(wrenPredictions)
      .set({
        status: params.wasCorrect ? 'validated' : 'invalidated',
        wasCorrect: params.wasCorrect,
        outcomeNotes: params.outcomeNotes,
        relatedFeatureId: params.relatedFeatureId,
        validatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wrenPredictions.id, params.predictionId));
  }
  
  async markPredictionAddressed(predictionId: string, featureId: string): Promise<void> {
    await getSharedDb().update(wrenPredictions)
      .set({
        status: 'addressed',
        relatedFeatureId: featureId,
        updatedAt: new Date(),
      })
      .where(eq(wrenPredictions.id, predictionId));
  }
  
  async analyzeBeaconsForPredictions(): Promise<WrenPrediction[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentBeacons = await db.select().from(danielaBeacons)
      .where(gte(danielaBeacons.createdAt, thirtyDaysAgo))
      .orderBy(desc(danielaBeacons.createdAt));
    
    const beaconsByType: Record<string, number> = {};
    const beaconsByLanguage: Record<string, number> = {};
    
    for (const beacon of recentBeacons) {
      beaconsByType[beacon.beaconType] = (beaconsByType[beacon.beaconType] || 0) + 1;
      if (beacon.language) {
        beaconsByLanguage[beacon.language] = (beaconsByLanguage[beacon.language] || 0) + 1;
      }
    }
    
    const predictions: WrenPrediction[] = [];
    
    for (const [type, count] of Object.entries(beaconsByType)) {
      if (count >= 3) {
        const existingPrediction = await getSharedDb().select().from(wrenPredictions)
          .where(and(
            eq(wrenPredictions.predictionType, 'capability_need'),
            sql`${wrenPredictions.title} ILIKE ${'%' + type + '%'}`,
            eq(wrenPredictions.status, 'predicted')
          ))
          .limit(1);
        
        if (existingPrediction.length === 0) {
          const prediction = await this.makePrediction({
            predictionType: 'capability_need',
            title: `Daniela needs better ${type} support`,
            description: `Detected ${count} beacons related to "${type}" in the last 30 days. This pattern suggests Daniela is hitting a recurring limitation.`,
            basis: `${count} beacons of type "${type}" in 30 days`,
            confidence: Math.min(0.4 + (count * 0.1), 0.9),
            predictedFor: 'daniela',
            timeframeEstimate: count >= 5 ? 'immediate' : 'days',
            supportingEvidence: [{
              type: 'beacon_pattern',
              source: 'daniela_beacons',
              detail: `${count} occurrences of ${type} beacons`,
            }],
          });
          predictions.push(prediction);
        }
      }
    }
    
    return predictions;
  }
  
  async getActivePredictions(): Promise<WrenPrediction[]> {
    return await getSharedDb().select().from(wrenPredictions)
      .where(eq(wrenPredictions.status, 'predicted'))
      .orderBy(desc(wrenPredictions.confidence));
  }
  
  async getPredictionAccuracy(): Promise<{ total: number; correct: number; accuracy: number }> {
    const validated = await getSharedDb().select().from(wrenPredictions)
      .where(or(
        eq(wrenPredictions.status, 'validated'),
        eq(wrenPredictions.status, 'invalidated')
      ));
    
    const correct = validated.filter(p => p.wasCorrect).length;
    
    return {
      total: validated.length,
      correct,
      accuracy: validated.length > 0 ? correct / validated.length : 0,
    };
  }
  
  async getPredictionContext(): Promise<string> {
    const active = await this.getActivePredictions();
    const accuracy = await this.getPredictionAccuracy();
    
    if (active.length === 0) {
      return '';
    }
    
    let context = '\n═══ WREN PREDICTIONS ═══\n';
    context += `🔮 ${active.length} active prediction(s)`;
    if (accuracy.total > 0) {
      context += ` (historical accuracy: ${(accuracy.accuracy * 100).toFixed(0)}%)`;
    }
    context += ':\n';
    
    for (const p of active.slice(0, 3)) {
      const confIcon = p.confidence >= 0.8 ? '🟢' : p.confidence >= 0.5 ? '🟡' : '🟠';
      context += `  ${confIcon} [${(p.confidence * 100).toFixed(0)}%] ${p.title}\n`;
    }
    
    return context;
  }
}

// ===== DREAM #5: Confidence Calibration =====

export class ConfidenceCalibrationService {
  
  async recordConfidence(params: {
    domain: 'architecture' | 'debugging' | 'implementation' | 'prediction' | 'integration';
    claimOrAction: string;
    statedConfidence: number;
    reasoning?: string;
    uncertaintyFactors?: string[];
  }): Promise<WrenConfidenceRecord> {
    const [record] = await db.insert(wrenConfidenceRecords).values({
      domain: params.domain,
      claimOrAction: params.claimOrAction,
      statedConfidence: params.statedConfidence,
      reasoning: params.reasoning,
      uncertaintyFactors: params.uncertaintyFactors || [],
    }).returning();
    
    return record;
  }
  
  async verifyOutcome(params: {
    recordId: string;
    wasCorrect: boolean;
    actualOutcome: string;
    verifiedBy: 'system' | 'founder' | 'daniela' | 'test';
  }): Promise<void> {
    const [record] = await db.select().from(wrenConfidenceRecords)
      .where(eq(wrenConfidenceRecords.id, params.recordId));
    
    if (!record) return;
    
    const calibrationScore = params.wasCorrect ? 
      1 - Math.abs(record.statedConfidence - 1) :
      1 - Math.abs(record.statedConfidence - 0);
    
    await db.update(wrenConfidenceRecords)
      .set({
        wasCorrect: params.wasCorrect,
        actualOutcome: params.actualOutcome,
        verifiedAt: new Date(),
        verifiedBy: params.verifiedBy,
        calibrationScore,
      })
      .where(eq(wrenConfidenceRecords.id, params.recordId));
    
    await this.updateCalibrationStats(record.domain);
  }
  
  async updateCalibrationStats(domain: string): Promise<void> {
    const records = await db.select().from(wrenConfidenceRecords)
      .where(and(
        eq(wrenConfidenceRecords.domain, domain),
        sql`${wrenConfidenceRecords.wasCorrect} IS NOT NULL`
      ));
    
    if (records.length === 0) return;
    
    const total = records.length;
    const correct = records.filter(r => r.wasCorrect).length;
    const avgStatedConfidence = records.reduce((sum, r) => sum + r.statedConfidence, 0) / total;
    const avgActualAccuracy = correct / total;
    const calibrationGap = avgStatedConfidence - avgActualAccuracy;
    
    const existingStat = await db.select().from(wrenCalibrationStats)
      .where(eq(wrenCalibrationStats.domain, domain))
      .limit(1);
    
    if (existingStat.length > 0) {
      await db.update(wrenCalibrationStats)
        .set({
          totalPredictions: total,
          correctPredictions: correct,
          avgStatedConfidence,
          avgActualAccuracy,
          calibrationGap,
          isOverconfident: calibrationGap > 0.1,
          isUnderconfident: calibrationGap < -0.1,
          lastCalculatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wrenCalibrationStats.domain, domain));
    } else {
      await db.insert(wrenCalibrationStats).values({
        domain,
        totalPredictions: total,
        correctPredictions: correct,
        avgStatedConfidence,
        avgActualAccuracy,
        calibrationGap,
        isOverconfident: calibrationGap > 0.1,
        isUnderconfident: calibrationGap < -0.1,
      });
    }
  }
  
  async getCalibrationStats(): Promise<WrenCalibrationStat[]> {
    return await db.select().from(wrenCalibrationStats);
  }
  
  async getCalibrationContext(): Promise<string> {
    const stats = await this.getCalibrationStats();
    
    if (stats.length === 0) {
      return '';
    }
    
    let context = '\n═══ WREN CALIBRATION ═══\n';
    
    const overconfident = stats.filter(s => s.isOverconfident);
    const underconfident = stats.filter(s => s.isUnderconfident);
    
    if (overconfident.length > 0) {
      context += '⚠️ Overconfident in: ' + overconfident.map(s => s.domain).join(', ') + '\n';
    }
    
    if (underconfident.length > 0) {
      context += '📈 Underconfident in: ' + underconfident.map(s => s.domain).join(', ') + '\n';
    }
    
    const wellCalibrated = stats.filter(s => !s.isOverconfident && !s.isUnderconfident);
    if (wellCalibrated.length > 0) {
      context += '✅ Well-calibrated in: ' + wellCalibrated.map(s => s.domain).join(', ') + '\n';
    }
    
    return context;
  }
  
  async getSuggestedConfidenceAdjustment(domain: string): Promise<number> {
    const [stat] = await db.select().from(wrenCalibrationStats)
      .where(eq(wrenCalibrationStats.domain, domain));
    
    if (!stat || stat.calibrationGap === null) return 0;
    
    return -stat.calibrationGap;
  }
}

// ===== UNIFIED DREAMS SERVICE =====

export class WrenDreamsService {
  readonly mistakes = new MistakeLearningService();
  readonly notes = new SessionNotesService();
  readonly anticipate = new AnticipatoryDevelopmentService();
  readonly calibration = new ConfidenceCalibrationService();
  
  async getFullDreamsContext(): Promise<string> {
    const [mistakeCtx, notesCtx, predictCtx, calibCtx] = await Promise.all([
      this.mistakes.getMistakeContext(),
      this.notes.getHandoffContext(),
      this.anticipate.getPredictionContext(),
      this.calibration.getCalibrationContext(),
    ]);
    
    return mistakeCtx + notesCtx + predictCtx + calibCtx;
  }
  
  async runStartupRitual(): Promise<{
    mistakes: { unresolved: number; lessons: number };
    notes: { pending: number };
    predictions: { active: number; accuracy: number };
    calibration: { overconfident: string[]; underconfident: string[] };
  }> {
    const unresolvedMistakes = await this.mistakes.getUnresolvedMistakes();
    const lessons = await this.mistakes.getActiveLessons();
    const pendingNotes = await this.notes.getNotesForSession();
    const activePredictions = await this.anticipate.getActivePredictions();
    const predictionAccuracy = await this.anticipate.getPredictionAccuracy();
    const calibrationStats = await this.calibration.getCalibrationStats();
    
    await this.anticipate.analyzeBeaconsForPredictions();
    
    return {
      mistakes: {
        unresolved: unresolvedMistakes.length,
        lessons: lessons.length,
      },
      notes: {
        pending: pendingNotes.length,
      },
      predictions: {
        active: activePredictions.length,
        accuracy: predictionAccuracy.accuracy,
      },
      calibration: {
        overconfident: calibrationStats.filter(s => s.isOverconfident).map(s => s.domain),
        underconfident: calibrationStats.filter(s => s.isUnderconfident).map(s => s.domain),
      },
    };
  }
}

export const wrenDreamsService = new WrenDreamsService();

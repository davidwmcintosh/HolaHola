/**
 * Drill Lifecycle Service
 * 
 * Manages the lifecycle of drill assignments from lesson bundles.
 * 
 * Lifecycle States:
 * - planned: Auto-created when lesson bundle starts, waiting for activation
 * - active: Student is working on the drill (or it's available to start)
 * - completed: Drill finished successfully
 * - delegated: Handed off to assistant tutor
 * - skipped: Student or tutor decided to skip
 * 
 * Origins:
 * - syllabus_bundle: Auto-provisioned from lesson bundle
 * - daniela_manual: Created by Daniela during conversation
 */

import { db } from '../db';
import { 
  arisDrillAssignments, 
  curriculumLessons, 
  curriculumDrillItems,
  type InsertArisDrillAssignment 
} from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

// Types for drill lifecycle
type DrillOrigin = 'syllabus_bundle' | 'daniela_manual';
type DrillLifecycleState = 'planned' | 'active' | 'completed' | 'delegated' | 'skipped';
type DrillHandler = 'daniela' | 'assistant' | 'both';

interface AutoProvisionResult {
  success: boolean;
  drillAssignmentId?: string;
  drillCount?: number;
  error?: string;
}

interface LifecycleTransitionResult {
  success: boolean;
  previousState?: DrillLifecycleState;
  newState?: DrillLifecycleState;
  error?: string;
}

/**
 * Auto-provision drill assignments from a lesson bundle
 * Called when a student starts a conversation lesson that has linked drills
 */
export async function autoProvisionDrillsFromBundle(
  userId: string,
  lessonId: string,
  conversationId?: string
): Promise<AutoProvisionResult> {
  try {
    // Get the lesson and check for linked drill
    const [lesson] = await db
      .select()
      .from(curriculumLessons)
      .where(eq(curriculumLessons.id, lessonId));

    if (!lesson) {
      return { success: false, error: 'Lesson not found' };
    }

    // Check if this lesson has a linked drill lesson
    if (!lesson.linkedDrillLessonId) {
      console.log(`[Drill-Lifecycle] Lesson ${lessonId} has no linked drill`);
      return { success: true, drillCount: 0 };
    }

    // Check if drill assignment already exists for this user/lesson
    const existingDrill = await db
      .select()
      .from(arisDrillAssignments)
      .where(
        and(
          eq(arisDrillAssignments.userId, userId),
          eq(arisDrillAssignments.lessonId, lesson.linkedDrillLessonId)
        )
      );

    if (existingDrill.length > 0) {
      console.log(`[Drill-Lifecycle] Drill already exists for user ${userId} lesson ${lesson.linkedDrillLessonId}`);
      return { success: true, drillAssignmentId: existingDrill[0].id, drillCount: 0 };
    }

    // Get drill items from the linked drill lesson
    const drillItems = await db
      .select()
      .from(curriculumDrillItems)
      .where(eq(curriculumDrillItems.lessonId, lesson.linkedDrillLessonId))
      .orderBy(curriculumDrillItems.orderIndex);

    if (drillItems.length === 0) {
      console.log(`[Drill-Lifecycle] No drill items found in lesson ${lesson.linkedDrillLessonId}`);
      return { success: true, drillCount: 0 };
    }

    // Determine drill type from items
    const drillType = mapItemTypeToDrillType(drillItems[0].itemType);

    // Create drill assignment in "planned" state
    const drillContent = {
      items: drillItems.map(item => ({
        prompt: item.prompt,
        expectedAnswer: item.targetText,
        pronunciation: item.targetText,
      })),
      instructions: `Practice drill from lesson: ${lesson.name}`,
      focusArea: lesson.conversationTopic || undefined,
      difficulty: 'medium' as const,
    };

    const [newDrill] = await db
      .insert(arisDrillAssignments)
      .values({
        userId,
        conversationId,
        drillType,
        targetLanguage: drillItems[0].targetLanguage,
        drillContent,
        priority: 'medium',
        status: 'pending',
        origin: 'syllabus_bundle',
        lifecycleState: 'planned',
        handledBy: 'assistant',
        lessonId: lesson.linkedDrillLessonId,
        bundleId: lesson.bundleId,
      } as any)
      .returning();

    console.log(`[Drill-Lifecycle] Auto-provisioned drill ${newDrill.id} for user ${userId}`);

    return {
      success: true,
      drillAssignmentId: newDrill.id,
      drillCount: drillItems.length,
    };
  } catch (error: any) {
    console.error('[Drill-Lifecycle] Auto-provision error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Transition a drill to a new lifecycle state
 */
export async function transitionDrillState(
  drillAssignmentId: string,
  newState: DrillLifecycleState,
  handledBy?: DrillHandler
): Promise<LifecycleTransitionResult> {
  try {
    // Get current state
    const [current] = await db
      .select()
      .from(arisDrillAssignments)
      .where(eq(arisDrillAssignments.id, drillAssignmentId));

    if (!current) {
      return { success: false, error: 'Drill assignment not found' };
    }

    const previousState = (current as any).lifecycleState as DrillLifecycleState;

    // Validate state transition
    if (!isValidTransition(previousState, newState)) {
      return { 
        success: false, 
        error: `Invalid transition: ${previousState} -> ${newState}` 
      };
    }

    // Build update object
    const updateData: Record<string, any> = {
      lifecycleState: newState,
    };

    if (handledBy) {
      updateData.handledBy = handledBy;
    }

    // Update timestamps based on state
    // NOTE: "active" lifecycle means drill is available to start, NOT started
    // The /start endpoint will set status='in_progress' and startedAt when student begins
    if (newState === 'active') {
      // Keep status='pending' so /start endpoint works correctly
      // This just makes the drill available (visible to student)
    } else if (newState === 'completed') {
      updateData.completedAt = new Date();
      updateData.status = 'completed';
    } else if (newState === 'delegated') {
      updateData.handledBy = 'assistant';
    } else if (newState === 'skipped') {
      updateData.status = 'cancelled';
    }

    await db
      .update(arisDrillAssignments)
      .set(updateData)
      .where(eq(arisDrillAssignments.id, drillAssignmentId));

    console.log(`[Drill-Lifecycle] Transitioned ${drillAssignmentId}: ${previousState} -> ${newState}`);

    return {
      success: true,
      previousState,
      newState,
    };
  } catch (error: any) {
    console.error('[Drill-Lifecycle] Transition error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Activate planned drills when lesson starts
 */
export async function activatePlannedDrills(
  userId: string,
  bundleId: string
): Promise<{ activated: number; errors: string[] }> {
  try {
    const plannedDrills = await db
      .select()
      .from(arisDrillAssignments)
      .where(
        and(
          eq(arisDrillAssignments.userId, userId),
          eq(arisDrillAssignments.bundleId, bundleId),
          eq(arisDrillAssignments.lifecycleState as any, 'planned')
        )
      );

    let activated = 0;
    const errors: string[] = [];

    for (const drill of plannedDrills) {
      const result = await transitionDrillState(drill.id, 'active');
      if (result.success) {
        activated++;
      } else {
        errors.push(`Failed to activate ${drill.id}: ${result.error}`);
      }
    }

    console.log(`[Drill-Lifecycle] Activated ${activated} drills for bundle ${bundleId}`);
    return { activated, errors };
  } catch (error: any) {
    console.error('[Drill-Lifecycle] Activation error:', error);
    return { activated: 0, errors: [error.message] };
  }
}

/**
 * Get pending drills for a user (planned + active)
 */
export async function getPendingDrillsForUser(
  userId: string,
  language?: string
): Promise<typeof arisDrillAssignments.$inferSelect[]> {
  const query = db
    .select()
    .from(arisDrillAssignments)
    .where(
      and(
        eq(arisDrillAssignments.userId, userId),
        inArray(arisDrillAssignments.lifecycleState as any, ['planned', 'active'])
      )
    );

  const drills = await query;

  // Filter by language if specified
  if (language) {
    return drills.filter(d => d.targetLanguage.toLowerCase() === language.toLowerCase());
  }

  return drills;
}

/**
 * Get drill statistics for a user
 */
export async function getDrillStats(userId: string): Promise<{
  planned: number;
  active: number;
  completed: number;
  delegated: number;
  skipped: number;
}> {
  const drills = await db
    .select()
    .from(arisDrillAssignments)
    .where(eq(arisDrillAssignments.userId, userId));

  const stats = {
    planned: 0,
    active: 0,
    completed: 0,
    delegated: 0,
    skipped: 0,
  };

  for (const drill of drills) {
    const state = (drill as any).lifecycleState as DrillLifecycleState;
    if (state && stats[state] !== undefined) {
      stats[state]++;
    }
  }

  return stats;
}

// === Helper Functions ===

/**
 * Map curriculum drill item type to Aris drill type
 */
function mapItemTypeToDrillType(itemType: string): 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order' {
  const mapping: Record<string, 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order'> = {
    'listen_repeat': 'repeat',
    'number_dictation': 'repeat',
    'translate_speak': 'translate',
    'matching': 'match',
    'fill_blank': 'fill_blank',
  };
  return mapping[itemType] || 'repeat';
}

/**
 * Validate lifecycle state transitions
 */
function isValidTransition(from: DrillLifecycleState, to: DrillLifecycleState): boolean {
  const validTransitions: Record<DrillLifecycleState, DrillLifecycleState[]> = {
    'planned': ['active', 'skipped'],
    'active': ['completed', 'delegated', 'skipped'],
    'completed': [], // Terminal state
    'delegated': ['completed'], // Can complete after delegation
    'skipped': [], // Terminal state
  };

  return validTransitions[from]?.includes(to) || false;
}

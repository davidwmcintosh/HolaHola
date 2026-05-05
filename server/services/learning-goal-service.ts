/**
 * Learning Goal Service
 *
 * Manages outcome-based learning goals for self-directed students and business
 * travelers who aren't following the textbook curriculum.
 *
 * Goals are expressed as capabilities ("order food at a restaurant") not levels
 * ("reach B2"). Daniela tracks each capability through four stages:
 *   planned → planted → practiced → integrated
 *
 * Daniela advances capabilities silently through observation. The student never
 * sees a progress bar — progress lives in Daniela's understanding and surfaces
 * through conversational check-ins.
 */

import { getSharedDb } from '../db';
import { learningGoals, GoalCapability } from '@shared/schema';
import { eq, and, sql, or, gte } from 'drizzle-orm';
import { generateAndStoreEmbedding } from './semantic-memory-service';

const STATUS_ORDER = ['planned', 'planted', 'practiced', 'integrated'] as const;
const GOAL_CAP_MEMORY_TYPE = 'goal_capability';

// ─── Neural memory indexing ───────────────────────────────────────────────────

/**
 * Format a single capability as a rich text document for embedding.
 * Captures the goal context, capability name, current status, and any
 * evidence notes Daniela has added — enough for semantic recall.
 */
function formatCapabilityForEmbedding(
  goalStatement: string,
  cap: GoalCapability,
): string {
  const lines = [
    `Learning Goal: "${goalStatement}"`,
    `Capability: ${cap.name}`,
    `Status: ${cap.status} (arc: planned → planted → practiced → integrated)`,
  ];
  if (cap.notes.length > 0) {
    lines.push(`Evidence: ${cap.notes.join(' | ')}`);
  }
  return lines.join('\n');
}

/**
 * Index all capabilities of a goal into the neural memory system.
 * Each capability gets memoryType='goal_capability', memoryId='{goalId}:{capabilityId}'.
 * Content hash ensures only changed capabilities are re-embedded.
 * Fire-and-forget — does not block the caller.
 */
function indexGoalCapabilities(
  goal: typeof learningGoals.$inferSelect,
): void {
  const caps = (goal.capabilities as GoalCapability[]) ?? [];
  if (caps.length === 0) return;

  (async () => {
    let indexed = 0;
    for (const cap of caps) {
      try {
        const content = formatCapabilityForEmbedding(goal.goalStatement, cap);
        const memoryId = `${goal.id}:${cap.id}`;
        const isNew = await generateAndStoreEmbedding(
          GOAL_CAP_MEMORY_TYPE,
          memoryId,
          goal.studentId,
          content,
          1.0,
        );
        if (isNew) indexed++;
      } catch (err: any) {
        console.warn(`[LearningGoal] Failed to embed capability ${cap.id}:`, err.message);
      }
    }
    if (indexed > 0) {
      console.log(`[LearningGoal] Indexed ${indexed} capability embeddings for goal ${goal.id}`);
    }
  })().catch(err => console.error('[LearningGoal] indexGoalCapabilities failed:', err.message));
}

/**
 * Startup scan — indexes all active goals and any goals deactivated in the
 * last 30 days (recently-archived, still relevant for recall). Idempotent.
 */
export async function indexAllActiveGoalCapabilities(): Promise<void> {
  const db = getSharedDb();
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const goals = await db
      .select()
      .from(learningGoals)
      .where(or(
        eq(learningGoals.isActive, true),
        gte(learningGoals.updatedAt, thirtyDaysAgo),
      ));

    if (goals.length === 0) {
      console.log('[LearningGoal] No goals to index');
      return;
    }

    let totalCaps = 0;
    for (const goal of goals) {
      const caps = (goal.capabilities as GoalCapability[]) ?? [];
      totalCaps += caps.length;
      for (const cap of caps) {
        try {
          const content = formatCapabilityForEmbedding(goal.goalStatement, cap);
          const memoryId = `${goal.id}:${cap.id}`;
          await generateAndStoreEmbedding(GOAL_CAP_MEMORY_TYPE, memoryId, goal.studentId, content, 1.0);
        } catch (_) {}
      }
    }
    console.log(`[LearningGoal] Startup capability index complete — ${goals.length} goals, ${totalCaps} capabilities`);
  } catch (err: any) {
    console.warn('[LearningGoal] indexAllActiveGoalCapabilities failed:', err.message);
  }
}

// ─── Core operations ──────────────────────────────────────────────────────────

/**
 * Create a new active learning goal for a student, deactivating any existing one.
 * Called by Daniela at the end of a goal-setting conversation.
 */
export async function setLearningGoal(
  studentId: string,
  language: string,
  goalStatement: string,
  targetDate: Date | null,
  capabilityNames: Array<{ id: string; name: string }>,
): Promise<string> {
  const db = getSharedDb();

  // Deactivate any current active goal for this student+language
  await db
    .update(learningGoals)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(learningGoals.studentId, studentId),
      eq(learningGoals.language, language),
      eq(learningGoals.isActive, true),
    ));

  const now = new Date().toISOString();
  const capabilities: GoalCapability[] = capabilityNames.map(c => ({
    id: c.id,
    name: c.name,
    status: 'planned',
    notes: [],
    addedAt: now,
  }));

  const [row] = await db.insert(learningGoals).values({
    studentId,
    language,
    goalStatement,
    targetDate: targetDate ?? undefined,
    capabilities,
    isActive: true,
  }).returning({ id: learningGoals.id });

  console.log(`[LearningGoal] Set goal for student ${studentId} (${language}): "${goalStatement.substring(0, 60)}..." with ${capabilities.length} capabilities`);

  // Index all capabilities into neural memory immediately (fire-and-forget)
  const [fullGoal] = await db.select().from(learningGoals).where(eq(learningGoals.id, row.id)).limit(1);
  if (fullGoal) indexGoalCapabilities(fullGoal);

  return row.id;
}

/**
 * Advance a capability to a new status, optionally recording Daniela's evidence note.
 * Only advances forward (planned→planted→practiced→integrated), never backwards.
 * Called silently by Daniela based on her own observation.
 */
export async function advanceCapability(
  goalId: string,
  capabilityId: string,
  newStatus: 'planted' | 'practiced' | 'integrated',
  note?: string,
): Promise<boolean> {
  const db = getSharedDb();

  const [goal] = await db
    .select()
    .from(learningGoals)
    .where(eq(learningGoals.id, goalId))
    .limit(1);

  if (!goal) return false;

  const caps = (goal.capabilities as GoalCapability[]) ?? [];
  const cap = caps.find(c => c.id === capabilityId);
  if (!cap) return false;

  const currentIdx = STATUS_ORDER.indexOf(cap.status as any);
  const newIdx     = STATUS_ORDER.indexOf(newStatus);
  if (newIdx <= currentIdx) return false; // never regress

  cap.status = newStatus;
  cap.lastAdvancedAt = new Date().toISOString();
  if (note) cap.notes.push(`[${newStatus}] ${note}`);

  await db
    .update(learningGoals)
    .set({ capabilities: caps, updatedAt: new Date() })
    .where(eq(learningGoals.id, goalId));

  console.log(`[LearningGoal] Capability "${cap.name}" → ${newStatus} for goal ${goalId}${note ? ` (note: ${note.substring(0, 60)})` : ''}`);

  // Re-index updated goal capabilities into neural memory (fire-and-forget)
  const [updatedGoal] = await db.select().from(learningGoals).where(eq(learningGoals.id, goalId)).limit(1);
  if (updatedGoal) indexGoalCapabilities(updatedGoal);

  return true;
}

/**
 * Get the active learning goal for a student+language, or null if none set.
 */
export async function getActiveGoal(
  studentId: string,
  language: string,
): Promise<(typeof learningGoals.$inferSelect) | null> {
  const db = getSharedDb();
  const [goal] = await db
    .select()
    .from(learningGoals)
    .where(and(
      eq(learningGoals.studentId, studentId),
      eq(learningGoals.language, language),
      eq(learningGoals.isActive, true),
    ))
    .limit(1);
  return goal ?? null;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function daysUntil(date: Date | null | undefined): string | null {
  if (!date) return null;
  const days = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0)  return `${Math.abs(days)} days ago`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `${days} days away`;
}

/**
 * Full goal state — designed for Daniela's get_current_goal_state tool call.
 * Prioritised view: what needs teaching today, what needs natural reinforcement,
 * what's already landed.
 */
export async function getCurrentGoalState(
  studentId: string,
  language: string,
): Promise<string | null> {
  const goal = await getActiveGoal(studentId, language);
  if (!goal) return null;

  const caps = (goal.capabilities as GoalCapability[]) ?? [];
  const planted    = caps.filter(c => c.status === 'planted');
  const practiced  = caps.filter(c => c.status === 'practiced');
  const integrated = caps.filter(c => c.status === 'integrated');
  const planned    = caps.filter(c => c.status === 'planned');

  const lines: string[] = [];
  const deadline = daysUntil(goal.targetDate ?? null);

  lines.push(`LEARNING GOAL: "${goal.goalStatement}"`);
  if (deadline) lines.push(`Target: ${deadline}`);
  lines.push('');

  if (planted.length > 0) {
    lines.push(`TODAY'S FOCUS — introduced, needs drilling (planted → practiced):`);
    planted.forEach(c => lines.push(`  • ${c.name}`));
    lines.push('');
  }
  if (practiced.length > 0) {
    lines.push(`REINFORCE — drilled, needs a natural opening to use spontaneously (practiced → integrated):`);
    practiced.forEach(c => lines.push(`  • ${c.name}`));
    lines.push('');
  }
  if (integrated.length > 0) {
    lines.push(`LANDED — student uses these spontaneously without prompting:`);
    integrated.forEach(c => lines.push(`  ✓ ${c.name}`));
    lines.push('');
  }
  if (planned.length > 0) {
    lines.push(`UPCOMING — not introduced yet:`);
    planned.forEach(c => lines.push(`  ○ ${c.name}`));
  }

  return lines.join('\n');
}

/**
 * Session-start injection — shorter summary for the dynamic context preamble.
 * Tells Daniela the goal, deadline urgency, and what to focus on this session.
 */
export async function formatGoalForSession(
  studentId: string,
  language: string,
): Promise<string | null> {
  const goal = await getActiveGoal(studentId, language);
  if (!goal) return null;

  const caps     = (goal.capabilities as GoalCapability[]) ?? [];
  const planted  = caps.filter(c => c.status === 'planted');
  const practiced = caps.filter(c => c.status === 'practiced');
  const done     = caps.filter(c => c.status === 'integrated').length;
  const total    = caps.length;
  const deadline = daysUntil(goal.targetDate ?? null);

  const lines: string[] = [
    `[LEARNING GOAL — ${goal.goalStatement}${deadline ? ` (${deadline})` : ''}]`,
    `Progress: ${done}/${total} capabilities integrated`,
  ];

  if (planted.length > 0) {
    lines.push(`Drill today (planted, not yet practiced): ${planted.map(c => c.name).join('; ')}`);
  }
  if (practiced.length > 0) {
    lines.push(`Create natural openings for (practiced, not yet integrated): ${practiced.map(c => c.name).join('; ')}`);
  }
  if (planted.length === 0 && practiced.length === 0) {
    const next = caps.find(c => c.status === 'planned');
    if (next) lines.push(`Next to introduce: ${next.name}`);
    else lines.push(`All capabilities integrated — ask the student what they want to deepen.`);
  }
  lines.push(`Goal ID: ${goal.id} | Use advance_capability to update progress silently.]`);

  return lines.join('\n');
}

// ─── Startup migration ────────────────────────────────────────────────────────

/**
 * Idempotent migration — creates the learning_goals table if it doesn't exist.
 * Safe to run on every server startup.
 */
export async function runLearningGoalsMigration(): Promise<void> {
  const db = getSharedDb();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS learning_goals (
        id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id    VARCHAR NOT NULL REFERENCES users(id),
        language      VARCHAR NOT NULL,
        goal_statement TEXT NOT NULL,
        target_date   TIMESTAMPTZ,
        capabilities  JSONB NOT NULL DEFAULT '[]',
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_learning_goals_student ON learning_goals(student_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_learning_goals_student_lang ON learning_goals(student_id, language)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_learning_goals_active ON learning_goals(student_id, is_active)`);
    console.log('[LearningGoals] Migration complete — learning_goals table ready');
  } catch (err: any) {
    console.warn('[LearningGoals] Migration note:', err.message);
  }
}

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getSharedDb } from '../db';
import { agentNotes } from '@shared/schema';

export const AGENT_INBOX_SENDERS = ['alden', 'founder', 'luca-claude-code'] as const;
export type AgentInboxSender = typeof AGENT_INBOX_SENDERS[number];

export type AgentNoteAction = 'acknowledge' | 'act' | 'dismiss' | 'read';

export function getAgentInboxSenders(fromAgent?: string): string[] {
  if (fromAgent && AGENT_INBOX_SENDERS.includes(fromAgent as AgentInboxSender)) {
    return [fromAgent];
  }
  return [...AGENT_INBOX_SENDERS];
}

export async function readAgentInboxNotes(options: {
  includeRead?: boolean;
  limit?: number;
  fromAgent?: string;
} = {}) {
  const db = getSharedDb();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const conditions = [
    inArray(agentNotes.fromAgent, getAgentInboxSenders(options.fromAgent)),
    eq(agentNotes.toAgent, 'agent'),
  ];

  if (!options.includeRead) conditions.push(eq(agentNotes.status, 'unread'));

  return db
    .select()
    .from(agentNotes)
    .where(and(...conditions))
    .orderBy(desc(agentNotes.createdAt))
    .limit(limit);
}

export async function findAgentNoteBySourceKey(sourceMessageKey: string) {
  const db = getSharedDb();
  const [existing] = await db
    .select()
    .from(agentNotes)
    .where(eq(agentNotes.sourceMessageKey, sourceMessageKey))
    .limit(1);
  return existing ?? null;
}

export async function createAgentNote(values: {
  fromAgent: string;
  toAgent: string;
  subject: string;
  body: string;
  sessionLabel?: string | null;
  repliedToId?: string | null;
  sourceMessageKey?: string | null;
}) {
  const db = getSharedDb();
  const sourceMessageKey = values.sourceMessageKey?.trim() || null;

  if (sourceMessageKey) {
    const existing = await findAgentNoteBySourceKey(sourceMessageKey);
    if (existing) return { note: existing, deduplicated: true };
  }

  let note: typeof agentNotes.$inferSelect | undefined;
  try {
    [note] = await db.insert(agentNotes).values({
      fromAgent: values.fromAgent,
      toAgent: values.toAgent,
      subject: values.subject,
      body: values.body,
      sessionLabel: values.sessionLabel ?? null,
      inReplyToId: values.repliedToId ?? null,
      sourceMessageKey,
    }).returning();
  } catch (error) {
    // Concurrent retries can both pass the initial lookup. The unique index is
    // the final authority; on conflict, return the row that won the race.
    if (sourceMessageKey) {
      const existing = await findAgentNoteBySourceKey(sourceMessageKey);
      if (existing) return { note: existing, deduplicated: true };
    }
    throw error;
  }

  if (!note) throw new Error('Agent note insert returned no row');
  return { note, deduplicated: false };
}

export async function updateAgentNoteAction(id: string, action: AgentNoteAction) {
  const db = getSharedDb();
  const now = new Date();
  const patch = action === 'acknowledge'
    ? { status: 'acknowledged' as const, acknowledgedAt: now, readAt: now }
    : action === 'act'
      ? {
          status: 'acted_on' as const,
          actedOnAt: now,
          acknowledgedAt: sql<Date>`coalesce(${agentNotes.acknowledgedAt}, ${now})`,
          readAt: now,
        }
      : action === 'dismiss'
        ? {
            status: 'dismissed' as const,
            dismissedAt: now,
            acknowledgedAt: sql<Date>`coalesce(${agentNotes.acknowledgedAt}, ${now})`,
            readAt: now,
          }
        : {
            status: 'acknowledged' as const,
            acknowledgedAt: sql<Date>`coalesce(${agentNotes.acknowledgedAt}, ${now})`,
            readAt: now,
          };

  const [updated] = await db
    .update(agentNotes)
    .set(patch)
    .where(eq(agentNotes.id, id))
    .returning();

  return updated ?? null;
}

export async function getAgentNoteWithReplies(id: string) {
  const db = getSharedDb();
  const [note] = await db.select().from(agentNotes).where(eq(agentNotes.id, id)).limit(1);
  if (!note) return null;

  const replies = await db
    .select()
    .from(agentNotes)
    .where(eq(agentNotes.inReplyToId, id))
    .orderBy(agentNotes.createdAt);

  return { note, replies };
}
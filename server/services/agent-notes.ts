import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getSharedDb } from '../db';
import { agentNotes } from '@shared/schema';

// Senders allowed to write into the Agent's inbox (toAgent = 'agent') --
// what Luca [Replit] reads.
export const AGENT_INBOX_SENDERS = ['alden', 'founder', 'luca-claude-code'] as const;
export type AgentInboxSender = typeof AGENT_INBOX_SENDERS[number];

// Senders allowed to write into the Claude Code inbox (toAgent = 'luca-claude-code')
// -- what a Claude Code session reads. Currently just the Agent replying to a note
// Claude Code left; extend this list if another sender needs to reach Claude Code
// directly.
export const CLAUDE_CODE_INBOX_SENDERS = ['agent'] as const;
export type ClaudeCodeInboxSender = typeof CLAUDE_CODE_INBOX_SENDERS[number];

export type AgentNoteAction = 'acknowledge' | 'act' | 'dismiss' | 'read';

export type ReplyingCoordinationActor = 'luca-replit' | 'luca-claude-code';

export class AgentNoteReplyError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409,
    readonly code: string,
  ) {
    super(message);
    this.name = 'AgentNoteReplyError';
  }
}

const REPLY_IDENTITY: Record<ReplyingCoordinationActor, { inbox: string; storedSender: string }> = {
  'luca-replit': { inbox: 'agent', storedSender: 'agent' },
  'luca-claude-code': { inbox: 'luca-claude-code', storedSender: 'luca-claude-code' },
};

export function getAgentInboxSenders(fromAgent?: string): string[] {
  if (fromAgent && AGENT_INBOX_SENDERS.includes(fromAgent as AgentInboxSender)) {
    return [fromAgent];
  }
  return [...AGENT_INBOX_SENDERS];
}

export function getClaudeCodeInboxSenders(fromAgent?: string): string[] {
  if (fromAgent && CLAUDE_CODE_INBOX_SENDERS.includes(fromAgent as ClaudeCodeInboxSender)) {
    return [fromAgent];
  }
  return [...CLAUDE_CODE_INBOX_SENDERS];
}

export async function readAgentInboxNotes(options: {
  includeRead?: boolean;
  limit?: number;
  fromAgent?: string;
  // Whose inbox to read. Defaults to 'agent' (Luca [Replit]'s inbox) so every
  // existing caller is unaffected. Pass 'luca-claude-code' to read replies
  // addressed back to a Claude Code session.
  toAgent?: string;
} = {}) {
  const db = getSharedDb();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const toAgent = options.toAgent ?? 'agent';
  const allowedSenders = toAgent === 'luca-claude-code'
    ? getClaudeCodeInboxSenders(options.fromAgent)
    : getAgentInboxSenders(options.fromAgent);
  const conditions = [
    inArray(agentNotes.fromAgent, allowedSenders),
    eq(agentNotes.toAgent, toAgent),
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

/**
 * Creates a reply using the authenticated actor's fixed storage identity, then
 * reads the exact row from the recipient inbox. A row existing in that inbox is
 * the only condition represented by the returned `delivered` receipt; it does
 * not imply that the recipient saw, acknowledged, or acted on it.
 */
export type ReplyToAgentNoteInput = {
  actor: ReplyingCoordinationActor;
  parentId: string;
  body: string;
  subject?: string | null;
  sessionLabel?: string | null;
  idempotencyKey: string;
};

type AgentNoteCreateResult = {
  note: typeof agentNotes.$inferSelect;
  deduplicated: boolean;
};

async function replyToAgentNoteAndVerifyWithDb(
  db: any,
  input: ReplyToAgentNoteInput,
  createReply: (values: {
    fromAgent: string;
    toAgent: string;
    subject: string;
    body: string;
    sessionLabel?: string | null;
    repliedToId?: string | null;
    sourceMessageKey?: string | null;
  }) => Promise<AgentNoteCreateResult>,
) {
  const body = input.body?.trim();
  const idempotencyKey = input.idempotencyKey?.trim();
  if (!body) throw new AgentNoteReplyError('body is required', 400, 'invalid_request');
  if (!idempotencyKey) throw new AgentNoteReplyError('idempotencyKey is required', 400, 'invalid_request');
  if (idempotencyKey.length > 255) {
    throw new AgentNoteReplyError('idempotencyKey exceeds 255 characters', 400, 'invalid_request');
  }

  const identity = REPLY_IDENTITY[input.actor];
  const [parent] = await db.select().from(agentNotes).where(eq(agentNotes.id, input.parentId)).limit(1);
  if (!parent) throw new AgentNoteReplyError('Parent note not found', 404, 'parent_not_found');
  if (parent.toAgent !== identity.inbox) {
    throw new AgentNoteReplyError('Actor does not own the parent inbox', 403, 'parent_inbox_forbidden');
  }
  if (parent.fromAgent === identity.storedSender) {
    throw new AgentNoteReplyError('Self-replies are not supported', 403, 'unsupported_reply_route');
  }

  // The recipient must be able to read this reciprocal route through its
  // canonical inbox contract, rather than merely accepting an arbitrary row.
  const allowedRecipient = input.actor === 'luca-replit'
    ? (AGENT_INBOX_SENDERS as readonly string[]).includes(parent.fromAgent)
    : (CLAUDE_CODE_INBOX_SENDERS as readonly string[]).includes(parent.fromAgent);
  if (!allowedRecipient) {
    throw new AgentNoteReplyError('Parent sender is not a supported reciprocal route', 403, 'unsupported_reply_route');
  }

  const subject = input.subject?.trim() || `Re: ${parent.subject}`;
  const [existing] = await db.select().from(agentNotes)
    .where(eq(agentNotes.sourceMessageKey, idempotencyKey)).limit(1);
  if (existing) {
    if (
      existing.fromAgent !== identity.storedSender
      || existing.toAgent !== parent.fromAgent
      || existing.inReplyToId !== parent.id
      || existing.subject !== subject
      || existing.body !== body
    ) {
      throw new AgentNoteReplyError(
        'idempotencyKey was already used with conflicting reply content',
        409,
        'idempotency_conflict',
      );
    }
    const [stored] = await db.select().from(agentNotes).where(and(
      eq(agentNotes.id, existing.id),
      eq(agentNotes.toAgent, parent.fromAgent),
    )).limit(1);
    if (!stored) throw new AgentNoteReplyError('Recipient inbox storage could not be verified', 409, 'delivery_unverified');
    return { note: stored, deduplicated: true, deliveryState: 'delivered' as const };
  }

  const created = await createReply({
    fromAgent: identity.storedSender,
    toAgent: parent.fromAgent,
    subject,
    body,
    sessionLabel: input.sessionLabel ?? parent.sessionLabel,
    repliedToId: parent.id,
    sourceMessageKey: idempotencyKey,
  });
  // A concurrent caller may have won the unique key; reject a mismatched
  // winner instead of incorrectly claiming this payload was delivered.
  if (
    created.note.fromAgent !== identity.storedSender
    || created.note.toAgent !== parent.fromAgent
    || created.note.inReplyToId !== parent.id
    || created.note.subject !== subject
    || created.note.body !== body
  ) {
    throw new AgentNoteReplyError('idempotencyKey was already used with conflicting reply content', 409, 'idempotency_conflict');
  }
  const [stored] = await db.select().from(agentNotes).where(and(
    eq(agentNotes.id, created.note.id),
    eq(agentNotes.toAgent, parent.fromAgent),
  )).limit(1);
  if (!stored) throw new AgentNoteReplyError('Recipient inbox storage could not be verified', 409, 'delivery_unverified');
  return { note: stored, deduplicated: created.deduplicated, deliveryState: 'delivered' as const };
}

export async function replyToAgentNoteAndVerify(input: ReplyToAgentNoteInput) {
  return replyToAgentNoteAndVerifyWithDb(getSharedDb(), input, createAgentNote);
}

export async function replyToAgentNoteAndVerifyInTransaction(
  tx: any,
  input: ReplyToAgentNoteInput,
) {
  return replyToAgentNoteAndVerifyWithDb(tx, input, async (values) => {
    const [note] = await tx.insert(agentNotes).values({
      fromAgent: values.fromAgent,
      toAgent: values.toAgent,
      subject: values.subject,
      body: values.body,
      sessionLabel: values.sessionLabel ?? null,
      inReplyToId: values.repliedToId ?? null,
      sourceMessageKey: values.sourceMessageKey?.trim() || null,
    }).returning();
    if (!note) throw new Error('Agent note insert returned no row');
    return { note, deduplicated: false };
  });
}

export function inboxForReplyingActor(
  actor: string | undefined,
): 'agent' | 'luca-claude-code' | null {
  return actor === 'luca-replit'
    ? 'agent'
    : actor === 'luca-claude-code'
      ? 'luca-claude-code'
      : null;
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
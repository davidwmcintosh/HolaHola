import {
  COORDINATION_TOKEN_ENV_BY_ACTOR,
} from '../middleware/coordination-auth';
import type {
  CoordinationActorId,
  CoordinationEvidenceReference,
  CoordinationEventType,
} from '@shared/schema';

export type DirectCoordinationActor = 'luca-holahola' | 'alden' | 'daniela';
export type CoordinationClientActor = Exclude<CoordinationActorId, 'coordination-system'>;
export type CoordinationClientAction =
  | 'list'
  | 'acknowledge-feed'
  | 'show'
  | 'create'
  | 'accept'
  | 'progress'
  | 'evidence'
  | 'block'
  | 'complete'
  | 'acknowledge'
  | 'reopen'
  | 'reassign'
  | 'comment'
  | 'reply-and-verify'
  | 'complete-with-linked-outcome';

const DIRECT_CLIENT_ACTIONS: Record<DirectCoordinationActor, ReadonlySet<CoordinationClientAction>> = {
  'luca-holahola': new Set(['list', 'acknowledge-feed', 'show', 'create', 'reassign', 'comment']),
  alden: new Set([
    'list', 'acknowledge-feed', 'show', 'accept', 'progress', 'evidence', 'block', 'complete',
    'acknowledge', 'reassign', 'comment',
  ]),
  daniela: new Set([
    'list', 'acknowledge-feed', 'show', 'accept', 'progress', 'evidence', 'block', 'complete', 'comment',
  ]),
};

type Environment = Record<string, string | undefined>;
type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type CoordinationActorClientOptions = {
  apiUrl: string;
  environment?: Environment;
  fetchImpl?: FetchLike;
};

export type CoordinationFeedOptions = {
  cursor?: number;
  limit?: number;
};

export type CoordinationThreadCreate = {
  title: string;
  description: string;
  intendedRecipient: Exclude<CoordinationActorId, 'coordination-system'>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  sourceReference?: CoordinationEvidenceReference;
  idempotencyKey: string;
};

export type CoordinationEventInput = {
  content?: string;
  expectedSequence: number;
  idempotencyKey: string;
  recipientActor?: Exclude<CoordinationActorId, 'coordination-system'>;
  evidence?: CoordinationEvidenceReference[];
  payload?: Record<string, unknown>;
  causalParentEventId?: string;
};

export type AgentNoteReplyInput = {
  parentNoteId: string;
  body: string;
  idempotencyKey: string;
  subject?: string;
  sessionLabel?: string;
};

export type CompleteWithLinkedOutcomeClientInput = CoordinationEventInput & {
  reply: Omit<AgentNoteReplyInput, 'parentNoteId' | 'idempotencyKey'>;
};

export function coordinationClientActions(
  actor: DirectCoordinationActor,
): ReadonlySet<CoordinationClientAction> {
  return DIRECT_CLIENT_ACTIONS[actor];
}

function tokenForActor(actor: CoordinationClientActor, environment: Environment): string {
  const envName = COORDINATION_TOKEN_ENV_BY_ACTOR[actor];
  const token = environment[envName]?.trim();
  if (!token) throw new Error(`${actor} coordination credential is not configured (${envName})`);
  if (token.length < 32) throw new Error(`${envName} must be at least 32 characters`);
  return token;
}

function apiResult(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class CoordinationActorClient {
  readonly actor: CoordinationClientActor;
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;

  constructor(
    actor: CoordinationClientActor,
    options: CoordinationActorClientOptions,
  ) {
    this.actor = actor;
    this.baseUrl = options.apiUrl.replace(/\/+$/, '');
    if (!this.baseUrl) throw new Error('Coordination API URL is required');
    this.token = tokenForActor(actor, options.environment ?? process.env);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private assertAllowed(action: CoordinationClientAction): void {
    if (
      (this.actor === 'luca-holahola' || this.actor === 'alden' || this.actor === 'daniela')
      && !DIRECT_CLIENT_ACTIONS[this.actor].has(action)
    ) {
      throw new Error(`${this.actor} coordination client cannot perform ${action}`);
    }
  }

  private async request(
    action: CoordinationClientAction,
    path: string,
    options: { body?: Record<string, unknown>; idempotencyKey?: string } = {},
  ): Promise<unknown> {
    this.assertAllowed(action);
    const response = await this.fetchImpl(new URL(path, `${this.baseUrl}/`), {
      method: options.body ? 'POST' : 'GET',
      headers: {
        accept: 'application/json',
        'x-coordination-token': this.token,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const result = apiResult(await response.text());
    if (!response.ok) {
      const message = typeof result === 'object' && result !== null && 'error' in result
        ? String((result as { error: unknown }).error)
        : JSON.stringify(result);
      throw new Error(`Coordination ${action} failed (${response.status}): ${message}`);
    }
    return result;
  }

  listFeed(options: CoordinationFeedOptions = {}): Promise<unknown> {
    const query = new URLSearchParams();
    if (options.cursor !== undefined) query.set('cursor', String(options.cursor));
    if (options.limit !== undefined) query.set('limit', String(options.limit));
    return this.request('list', `/api/coordination/threads${query.size ? `?${query}` : ''}`);
  }

  acknowledgeFeed(globalSequence: number): Promise<unknown> {
    if (!Number.isSafeInteger(globalSequence) || globalSequence < 0) {
      throw new Error('Coordination feed cursor must be a non-negative integer');
    }
    return this.request('acknowledge-feed', '/api/coordination/threads/ack', {
      body: { globalSequence },
    });
  }

  show(threadId: string, afterSequence = 0): Promise<unknown> {
    const query = afterSequence ? `?afterSequence=${encodeURIComponent(String(afterSequence))}` : '';
    return this.request('show', `/api/coordination/threads/${encodeURIComponent(threadId)}${query}`);
  }

  create(input: CoordinationThreadCreate): Promise<unknown> {
    return this.request('create', '/api/coordination/threads', {
      body: {
        title: input.title,
        description: input.description,
        intendedRecipient: input.intendedRecipient,
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.sourceReference ? { sourceReference: input.sourceReference } : {}),
      },
      idempotencyKey: input.idempotencyKey,
    });
  }

  private event(
    action: CoordinationClientAction,
    threadId: string,
    eventType: CoordinationEventType,
    input: CoordinationEventInput,
  ): Promise<unknown> {
    return this.request(action, `/api/coordination/threads/${encodeURIComponent(threadId)}/events`, {
      body: {
        eventType,
        content: input.content ?? '',
        expectedSequence: input.expectedSequence,
        ...(input.recipientActor ? { recipientActor: input.recipientActor } : {}),
        ...(input.evidence ? { evidence: input.evidence } : {}),
        ...(input.payload ? { payload: input.payload } : {}),
        ...(input.causalParentEventId ? { causalParentEventId: input.causalParentEventId } : {}),
      },
      idempotencyKey: input.idempotencyKey,
    });
  }

  accept(threadId: string, input: CoordinationEventInput): Promise<unknown> {
    return this.event('accept', threadId, 'accepted', input);
  }

  progress(threadId: string, input: CoordinationEventInput): Promise<unknown> {
    return this.event('progress', threadId, 'progress', input);
  }

  evidence(threadId: string, input: CoordinationEventInput): Promise<unknown> {
    return this.event('evidence', threadId, 'evidence_added', input);
  }

  block(threadId: string, input: CoordinationEventInput): Promise<unknown> {
    return this.event('block', threadId, 'blocked', input);
  }

  complete(threadId: string, input: CoordinationEventInput): Promise<unknown> {
    return this.event('complete', threadId, 'completed', input);
  }

  acknowledge(threadId: string, input: CoordinationEventInput): Promise<unknown> {
    return this.event('acknowledge', threadId, 'outcome_acknowledged', input);
  }

  reopen(threadId: string, input: CoordinationEventInput): Promise<unknown> {
    return this.event('reopen', threadId, 'reopened', input);
  }

  reassign(threadId: string, input: CoordinationEventInput): Promise<unknown> {
    return this.event('reassign', threadId, 'reassigned', input);
  }

  comment(threadId: string, input: CoordinationEventInput): Promise<unknown> {
    return this.event('comment', threadId, 'comment', input);
  }

  /** Returns delivered only after the server rereads the exact reply row from
   * the recipient inbox. This intentionally says nothing about later states. */
  replyAndVerify(input: AgentNoteReplyInput): Promise<unknown> {
    if (this.actor !== 'luca-replit' && this.actor !== 'luca-claude-code') {
      throw new Error(`${this.actor} coordination client cannot reply to an agent note`);
    }
    return this.request('reply-and-verify', `/api/agent/notes/${encodeURIComponent(input.parentNoteId)}/reply`, {
      body: {
        body: input.body,
        ...(input.subject ? { subject: input.subject } : {}),
        ...(input.sessionLabel ? { session_label: input.sessionLabel } : {}),
      },
      idempotencyKey: input.idempotencyKey,
    });
  }

  completeWithLinkedOutcome(
    threadId: string,
    input: CompleteWithLinkedOutcomeClientInput,
  ): Promise<unknown> {
    if (this.actor !== 'luca-replit' && this.actor !== 'luca-claude-code') {
      throw new Error(`${this.actor} coordination client cannot complete agent-note-origin work`);
    }
    return this.request(
      'complete-with-linked-outcome',
      `/api/coordination/threads/${encodeURIComponent(threadId)}/complete-with-linked-outcome`,
      {
        body: {
          content: input.content ?? 'Work completed',
          expectedSequence: input.expectedSequence,
          ...(input.evidence ? { evidence: input.evidence } : {}),
          ...(input.causalParentEventId ? { causalParentEventId: input.causalParentEventId } : {}),
          reply: {
            body: input.reply.body,
            ...(input.reply.subject ? { subject: input.reply.subject } : {}),
            ...(input.reply.sessionLabel ? { sessionLabel: input.reply.sessionLabel } : {}),
          },
        },
        idempotencyKey: input.idempotencyKey,
      },
    );
  }
}

export function createCoordinationActorClient(
  actor: CoordinationClientActor,
  options: CoordinationActorClientOptions,
): CoordinationActorClient {
  return new CoordinationActorClient(actor, options);
}
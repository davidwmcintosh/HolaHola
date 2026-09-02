import { createAgentNote } from './agent-notes';
import {
  appendCoordinationEvent,
  CoordinationError,
  getCoordinationDeliveryContext,
  listPendingCoordinationDeliveries,
  markCoordinationDeliveryFailed,
  markCoordinationDeliverySucceeded,
} from './coordination-ledger-service';

const DEFAULT_POLL_MS = 5_000;
let running = false;
let timer: NodeJS.Timeout | null = null;

function inboxActors(originActor: string, targetActor: string) {
  if (originActor === 'luca-replit' && targetActor === 'luca-claude-code') {
    return { fromAgent: 'agent', toAgent: 'luca-claude-code' };
  }
  if (originActor === 'luca-claude-code' && targetActor === 'luca-replit') {
    return { fromAgent: 'luca-claude-code', toAgent: 'agent' };
  }
  return null;
}

async function appendDeliveredEvent(deliveryId: string, eventId: string, targetActor: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const context = await getCoordinationDeliveryContext(eventId);
    if (!context) throw new Error(`Missing coordination event ${eventId}`);
    try {
      return await appendCoordinationEvent({
        threadId: context.thread.id,
        actor: 'coordination-system',
        recipientActor: targetActor as any,
        eventType: 'delivered',
        content: `Delivered through agent_notes to ${targetActor}`,
        idempotencyKey: `adapter-delivery:${deliveryId}`,
        expectedSequence: context.thread.latestSequence,
        payload: { adapter: 'agent_notes', deliveryId },
      });
    } catch (error) {
      if (
        error instanceof CoordinationError
        && error.code === 'sequence_conflict'
        && attempt < 3
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('Could not append delivered event after sequence retries');
}

async function processDelivery(delivery: Awaited<ReturnType<typeof listPendingCoordinationDeliveries>>[number]) {
  const attemptCount = delivery.attemptCount + 1;
  try {
    if (delivery.adapterName !== 'agent_notes') {
      throw new Error(`Unsupported coordination adapter: ${delivery.adapterName}`);
    }
    const context = await getCoordinationDeliveryContext(delivery.eventId);
    if (!context) throw new Error(`Missing coordination event ${delivery.eventId}`);
    const route = inboxActors(context.thread.originActor, delivery.targetActor);
    if (!route) {
      throw new Error(
        `agent_notes cannot project ${context.thread.originActor} -> ${delivery.targetActor}`,
      );
    }

    const note = await createAgentNote({
      ...route,
      subject: `[Coordination ${context.thread.id}] ${context.thread.title}`,
      body: [
        `Canonical coordination thread: ${context.thread.id}`,
        `State at delivery: ${context.thread.state}`,
        `Origin: ${context.thread.originActor}`,
        `Intended recipient: ${context.thread.intendedRecipient}`,
        '',
        context.event.content,
        '',
        'Delivery means this message was stored in your inbox. It does not mean you accepted the work.',
        'Use the coordination API or CLI to accept and update the canonical thread.',
      ].join('\n'),
      sessionLabel: 'Canonical coordination ledger',
      sourceMessageKey: `coordination:${delivery.eventId}:agent_notes`,
    });

    await appendDeliveredEvent(delivery.id, delivery.eventId, delivery.targetActor);
    await markCoordinationDeliverySucceeded(delivery.id, note.note.id, attemptCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown adapter delivery failure';
    await markCoordinationDeliveryFailed(delivery.id, message, attemptCount);
    console.warn(`[CoordinationDelivery] ${delivery.id} failed: ${message}`);
  }
}

export async function runCoordinationDeliveryBatch(limit = 20): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const deliveries = await listPendingCoordinationDeliveries(limit);
    for (const delivery of deliveries) await processDelivery(delivery);
    return deliveries.length;
  } finally {
    running = false;
  }
}

export function startCoordinationDeliveryWorker(
  pollMs = Number(process.env.COORDINATION_DELIVERY_POLL_MS || DEFAULT_POLL_MS),
): void {
  if (timer) return;
  const run = () => void runCoordinationDeliveryBatch().catch((error) => {
    console.error('[CoordinationDelivery] batch failed:', error);
  });
  run();
  timer = setInterval(run, Math.max(1_000, pollMs));
  timer.unref();
  console.log('[CoordinationDelivery] worker started');
}

export function stopCoordinationDeliveryWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
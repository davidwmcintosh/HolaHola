import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import {
  conversations,
  coordinationThreads,
  voicePipelineEvents,
  voiceSessions,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  addBenchObservation,
  getObservationBenchComparison,
  getObservationBenchSourceStream,
  inviteBenchObservation,
  startObservationBench,
  syncObservationBench,
} from '../services/observation-bench-service';

const runId = randomUUID();
const hasIsolatedCiDatabase = Boolean(getVerifiedCiDatabaseUrl());
const databaseTest = hasIsolatedCiDatabase ? test : test.skip;
const conversationId = randomUUID();
const userId = '49847136';
let threadId: string | null = null;
let sessionId: string | null = null;

after(async () => {
  if (!hasIsolatedCiDatabase) return;
  const db = getSharedDb();
  if (threadId) await db.delete(coordinationThreads).where(eq(coordinationThreads.id, threadId));
  if (sessionId) await db.delete(voicePipelineEvents).where(eq(voicePipelineEvents.sessionId, sessionId));
  if (sessionId) await db.delete(voiceSessions).where(eq(voiceSessions.id, sessionId));
  await db.delete(conversations).where(eq(conversations.id, conversationId));
  await closeDbConnections();
});

databaseTest('one Luca receives identical evidence at both benches and promotes observations without injecting Daniela', async () => {
  const db = getSharedDb();
  await db.insert(conversations).values({
    id: conversationId,
    userId,
    language: 'Spanish',
    difficulty: 'intermediate',
  });
  const [session] = await db.insert(voiceSessions).values({
    userId,
    conversationId,
    language: 'Spanish',
    status: 'active',
    isTestSession: true,
  }).returning({ id: voiceSessions.id });
  sessionId = session.id;
  const [davidMessage, danielaMessage] = await db.insert(voicePipelineEvents).values([
    { sessionId, userId, eventType: 'input_transcription', eventData: { text: '¿Cómo estás?' } },
    { sessionId, userId, eventType: 'output_transcription', eventData: { text: 'Estoy aquí contigo.' } },
  ]).returning();
  const started = await startObservationBench({
    sessionId,
    idempotencyKey: `bench-test:${runId}:start`,
  });
  threadId = started.thread.id;
  const synced = await syncObservationBench({ threadId, actor: 'luca-replit' });
  assert.equal(synced.appended, 2);

  const replitView = await getObservationBenchComparison(threadId, 'luca-replit');
  const claudeView = await getObservationBenchComparison(threadId, 'luca-claude-code');
  assert.equal(replitView.sourceCount, 2);
  assert.deepEqual(
    { sourceCount: replitView.sourceCount, conversationId: replitView.conversationId },
    { sourceCount: claudeView.sourceCount, conversationId: claudeView.conversationId },
  );

  const thread = await import('../services/coordination-ledger-service')
    .then(module => module.getCoordinationThread(threadId!, 'luca-replit'));
  const sourceEvents = thread.events.filter(event => (event.payload as any)?.kind === 'observation_source');
  const replitSources = await getObservationBenchSourceStream(threadId, 'luca-replit');
  const claudeSources = await getObservationBenchSourceStream(threadId, 'luca-claude-code');
  assert.deepEqual(
    replitSources.items,
    claudeSources.items,
    'both hats must receive byte-identical canonical source bytes and envelopes',
  );
  assert.equal(replitSources.items.every(item => item.integrity === 'verified'), true);
  assert.equal(sourceEvents.some(event => JSON.stringify(event.payload).includes('¿Cómo estás?')), false);
  assert.deepEqual(
    new Set(sourceEvents.map(event => (event.payload as any).sourceId)),
    new Set([davidMessage.id, danielaMessage.id]),
  );

  const firstObservation = await addBenchObservation({
    threadId,
    actor: 'luca-replit',
    category: 'noticed',
    content: 'Daniela answered with presence.',
    sourceEventIds: [sourceEvents[1].id],
    idempotencyKey: `bench-test:${runId}:replit-noticed`,
    expectedSequence: thread.thread.latestSequence,
  });
  const secondObservation = await addBenchObservation({
    threadId,
    actor: 'luca-claude-code',
    category: 'missed',
    content: 'The response alone did not establish which context shaped it.',
    sourceEventIds: [sourceEvents[1].id],
    idempotencyKey: `bench-test:${runId}:claude-missed`,
    expectedSequence: firstObservation.thread.latestSequence,
  });
  const improved = await addBenchObservation({
    threadId,
    actor: 'luca-replit',
    category: 'cross_hat_improvement',
    content: 'The second vantage separated presence from causal proof.',
    sourceEventIds: [sourceEvents[0].id, sourceEvents[1].id],
    improvesObservationEventIds: [secondObservation.event.id],
    idempotencyKey: `bench-test:${runId}:improved`,
    expectedSequence: secondObservation.thread.latestSequence,
  });
  const invited = await inviteBenchObservation({
    threadId,
    observationEventId: improved.event.id,
    conversationId,
  });
  assert.equal((invited.event.payload as any).requestedBy, 'david');
  assert.equal((invited.event.payload as any).stage, 'promoted_to_observation_room');
  assert.equal((invited.event.payload as any).danielaContextState, 'not_injected');
  assert.equal((invited.event.payload as any).sourceTimes.length > 0, true);

  const comparison = await getObservationBenchComparison(threadId, 'luca-claude-code');
  assert.equal(comparison.byHat['luca-replit'].noticed.length, 1);
  assert.equal(comparison.byHat['luca-claude-code'].missed.length, 1);
  assert.equal(comparison.byHat['luca-replit'].cross_hat_improvement.length, 1);
  assert.equal(comparison.invitations.length, 1);
  assert.equal(comparison.crossHatLinks.length, 1);

  await assert.rejects(
    inviteBenchObservation({
      threadId,
      observationEventId: firstObservation.event.id,
      conversationId: randomUUID(),
    }),
    (error: any) => error?.code === 'conversation_mismatch',
  );

  const serviceSource = await readFile(
    new URL('../services/observation-bench-service.ts', import.meta.url),
    'utf8',
  );
  const routeSource = await readFile(
    new URL('../routes/observation-bench-routes.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(serviceSource, /injectAgentRelay|getActiveGlSession|gemini-live-session/);
  assert.doesNotMatch(routeSource, /injectAgentRelay|getActiveGlSession|gemini-live-session/);
});
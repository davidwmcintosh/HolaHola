import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import {
  conversations,
  coordinationEvents,
  coordinationThreads,
  voicePipelineEvents,
  voiceSessions,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { appendCoordinationEvent, getCoordinationThread } from '../services/coordination-ledger-service';
import {
  addBenchObservation,
  createObservationBenchArm,
  endObservationBench,
  getObservationBenchComparison,
  getObservationBenchSourceStream,
  inviteBenchObservation,
  listObservationBenchDashboard,
  startObservationBench,
  syncObservationBench,
} from '../services/observation-bench-service';

const runId = randomUUID();
const hasIsolatedCiDatabase = Boolean(getVerifiedCiDatabaseUrl());
const databaseTest = hasIsolatedCiDatabase ? test : test.skip;
const conversationId = randomUUID();
const userId = '49847136';
let threadId: string | null = null;
let armThreadId: string | null = null;
let sessionId: string | null = null;

after(async () => {
  if (!hasIsolatedCiDatabase) return;
  const db = getSharedDb();
  if (threadId) await db.delete(coordinationThreads).where(eq(coordinationThreads.id, threadId));
  if (armThreadId) await db.delete(coordinationThreads).where(eq(coordinationThreads.id, armThreadId));
  if (sessionId) await db.delete(voicePipelineEvents).where(eq(voicePipelineEvents.sessionId, sessionId));
  if (sessionId) await db.delete(voiceSessions).where(eq(voiceSessions.id, sessionId));
  await db.delete(conversations).where(eq(conversations.id, conversationId));
  await closeDbConnections();
});

databaseTest('one Luca receives identical evidence at both benches and promotes observations without injecting Daniela', async () => {
  const db = getSharedDb();
  const armed = await createObservationBenchArm({ idempotencyKey: `bench-test:${runId}:arm` });
  armThreadId = armed.thread.id;
  assert.deepEqual((armed.event.payload as any).armedHats, {
    'luca-replit': 'armed',
    'luca-claude-code': 'armed',
  });
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
  await assert.rejects(
    startObservationBench({
      sessionId,
      armThreadId,
      idempotencyKey: `bench-test:${runId}:conflicted-start`,
      _beforeAtomicStartForTest: async () => {
        await appendCoordinationEvent({
          threadId: armThreadId!,
          actor: 'david',
          eventType: 'comment',
          content: 'Concurrent founder arm inspection.',
          idempotencyKey: `bench-test:${runId}:arm-race`,
          expectedSequence: armed.thread.latestSequence,
          payload: { kind: 'arm_concurrency_probe' },
        });
      },
    }),
    (error: any) => error?.code === 'sequence_conflict',
  );
  const orphanBench = await db.select()
    .from(coordinationEvents)
    .where(and(
      eq(coordinationEvents.actor, 'luca-replit'),
      eq(coordinationEvents.idempotencyKey, `bench-test:${runId}:conflicted-start`),
    ));
  assert.equal(orphanBench.length, 0, 'arm conflict must roll back bench creation');

  const started = await startObservationBench({
    sessionId,
    armThreadId,
    idempotencyKey: `bench-test:${runId}:start`,
  });
  threadId = started.thread.id;
  const boundArm = await getCoordinationThread(armThreadId, 'david');
  assert.equal((boundArm.events.at(-1)?.payload as any).kind, 'observation_arm_bound');
  assert.equal((boundArm.events.at(-1)?.payload as any).benchThreadId, threadId);
  const retriedStart = await startObservationBench({
    sessionId,
    armThreadId,
    idempotencyKey: `bench-test:${runId}:start`,
  });
  assert.equal(retriedStart.deduplicated, true);
  assert.equal(retriedStart.thread.id, threadId);
  const synced = await syncObservationBench({ threadId, actor: 'luca-replit' });
  assert.equal(synced.appended, 2);
  const synchronizedView = await getCoordinationThread(threadId, 'luca-replit');
  const neutralSourceEvents = synchronizedView.events
    .filter(event => (event.payload as any).kind === 'observation_source');
  assert.equal(neutralSourceEvents.length, 2);
  assert.equal(
    neutralSourceEvents.every(event => event.actor === 'coordination-system'),
    true,
    'canonical evidence capture must not impersonate a Luca hat',
  );

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
  assert.equal(firstObservation.event.actor, 'luca-replit');
  assert.equal(secondObservation.event.actor, 'luca-claude-code');
  const retriedSecondObservation = await addBenchObservation({
    threadId,
    actor: 'luca-claude-code',
    category: 'missed',
    content: 'The response alone did not establish which context shaped it.',
    sourceEventIds: [sourceEvents[1].id],
    idempotencyKey: `bench-test:${runId}:claude-missed`,
    expectedSequence: secondObservation.thread.latestSequence,
  });
  assert.equal(retriedSecondObservation.deduplicated, true);
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
  await assert.rejects(
    inviteBenchObservation({
      threadId,
      observationEventId: improved.event.id,
      conversationId,
      _beforeAtomicWriteForTest: async () => {
        await appendCoordinationEvent({
          threadId: threadId!,
          actor: 'luca-replit',
          eventType: 'comment',
          content: 'Concurrent technical bench update.',
          idempotencyKey: `bench-test:${runId}:concurrent-update`,
          expectedSequence: improved.thread.latestSequence,
          payload: { kind: 'concurrency_probe' },
        });
      },
    }),
    (error: any) => error?.code === 'sequence_conflict',
  );
  const orphanPromotion = await db.select()
    .from(coordinationEvents)
    .where(and(
      eq(coordinationEvents.actor, 'david'),
      eq(coordinationEvents.idempotencyKey, `bench-room-promotion:${threadId}:${improved.event.id}`),
    ));
  assert.equal(orphanPromotion.length, 0, 'failed promotion race must not leave a David authorization receipt');

  const invited = await inviteBenchObservation({
    threadId,
    observationEventId: improved.event.id,
    conversationId,
  });
  assert.equal((invited.event.payload as any).requestedBy, 'david');
  assert.equal(invited.event.actor, 'david');
  assert.equal((invited.event.payload as any).authorizationState, 'canonical_founder_event');
  assert.equal((invited.event.payload as any).stage, 'promoted_to_observation_room');
  assert.equal((invited.event.payload as any).danielaContextState, 'not_injected');
  assert.equal((invited.event.payload as any).sourceTimes.length > 0, true);

  const comparison = await getObservationBenchComparison(threadId, 'luca-claude-code');
  assert.equal(comparison.byHat['luca-replit'].noticed.length, 1);
  assert.equal(comparison.byHat['luca-claude-code'].missed.length, 1);
  assert.equal(comparison.byHat['luca-replit'].cross_hat_improvement.length, 1);
  assert.equal(comparison.invitations.length, 1);
  assert.equal(comparison.crossHatLinks.length, 1);

  const dashboard = await listObservationBenchDashboard();
  const dashboardBench = dashboard.benches.find(bench => bench.thread.id === threadId);
  assert.ok(dashboardBench, 'founder dashboard must list the active observation bench');
  assert.equal(dashboardBench.sources.every(source => source.integrity === 'verified'), true);
  assert.equal(
    JSON.stringify(dashboardBench.sources).includes('¿Cómo estás?'),
    false,
    'dashboard source rows must expose timestamps and integrity, not canonical source text',
  );
  assert.equal(dashboardBench.comparison.byHat['luca-replit'].noticed.length, 1);
  assert.equal(dashboardBench.comparison.byHat['luca-claude-code'].missed.length, 1);
  assert.equal(
    dashboardBench.backchannel.every(event =>
      event.sourceReferences.length > 0
      && event.sourceReferences.every(reference =>
        typeof reference.sourceTimestamp === 'string'
        && reference.integrity === 'verified')),
    true,
    'every observation and promotion must map to exact verified source timeline timestamps',
  );
  assert.equal(
    dashboardBench.backchannel.every(event =>
      event.lifecycle.notified === 'unavailable'
      && event.lifecycle.notificationEvidence === 'none'),
    true,
    'adapter delivery must never be promoted into an unattested notification receipt',
  );
  assert.equal(dashboard.contextBoundary, 'technical_observation_only');

  await db.update(voicePipelineEvents)
    .set({ createdAt: new Date('2000-01-01T00:00:00.000Z') })
    .where(eq(voicePipelineEvents.sessionId, sessionId));
  const driftedDashboard = await listObservationBenchDashboard();
  const driftedBench = driftedDashboard.benches.find(bench => bench.thread.id === threadId);
  assert.equal(
    driftedBench?.sources.find(source => source.sourceId === danielaMessage.id)?.integrity,
    'unavailable_or_changed',
    'canonical timestamp drift must invalidate the signed source envelope',
  );
  await assert.rejects(
    inviteBenchObservation({
      threadId,
      observationEventId: firstObservation.event.id,
      conversationId,
    }),
    (error: any) => error?.code === 'source_integrity_failed',
  );

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
  const coordinationRouteSource = await readFile(
    new URL('../routes/coordination-routes.ts', import.meta.url),
    'utf8',
  );
  const clientSource = await readFile(
    new URL('../../client/src/pages/admin/CommandCenter.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(serviceSource, /injectAgentRelay|getActiveGlSession|gemini-live-session/);
  assert.doesNotMatch(routeSource, /injectAgentRelay|getActiveGlSession|gemini-live-session/);
  assert.match(routeSource, /observation-bench-sessions[\s\S]*\.\.\.founderMiddleware/);
  assert.match(routeSource, /observation-benches\/:threadId\/end[\s\S]*\.\.\.founderMiddleware/);
  assert.match(clientSource, /data-testid="button-arm-observation"/);
  assert.match(clientSource, /data-testid="button-start-observation"/);
  assert.match(clientSource, />\s*End window\s*</);
  assert.match(clientSource, /No authenticated backchannel events yet/);
  assert.match(clientSource, /delivered: \{observation\.lifecycle\.delivered\}/);
  assert.match(clientSource, /two-hat-observation-comparison/);
  assert.match(clientSource, /observation-hat-comparison-\$\{hat\}/);
  assert.match(clientSource, /bench\.comparison\.byHat\[hat\]\[category\]/);
  assert.match(clientSource, /Cross-hat improvements/);
  assert.match(serviceSource, /founder_authorization_receipt/);
  assert.match(serviceSource, /coordination_feed_cursor/);
  assert.match(coordinationRouteSource, /'observation_window_ended'/);
  assert.match(coordinationRouteSource, /'observation_arm_bound'/);
  assert.match(coordinationRouteSource, /appendFromRequest[\s\S]*rejectReservedObservationPayload/);

  for (const actor of ['luca-replit', 'luca-claude-code'] as const) {
    await assert.rejects(
      appendCoordinationEvent({
        threadId,
        actor,
        eventType: 'comment',
        content: 'Forged observation-window closure.',
        idempotencyKey: `bench-test:${runId}:forged-end:${actor}`,
        expectedSequence: invited.thread.latestSequence,
        payload: { kind: 'observation_window_ended', endedBy: actor },
      }),
      (error: any) => error?.code === 'reserved_observation_payload',
      `${actor} must not forge founder closure through generic coordination`,
    );
  }
  const ended = await endObservationBench({ threadId });
  assert.equal((ended.event.payload as any).kind, 'observation_window_ended');
  assert.equal(ended.event.actor, 'david', 'founder closure must retain David authorship');
  await assert.rejects(
    syncObservationBench({ threadId, actor: 'luca-replit' }),
    (error: any) => error?.code === 'observation_window_ended',
  );
  await assert.rejects(
    appendCoordinationEvent({
      threadId,
      actor: 'luca-replit',
      eventType: 'comment',
      content: 'Generic coordination mutation after closure.',
      idempotencyKey: `bench-test:${runId}:generic-after-end`,
      expectedSequence: ended.thread.latestSequence,
      payload: { kind: 'ordinary_coordination_comment' },
    }),
    (error: any) => error?.code === 'observation_window_ended',
    'generic coordination mutations must respect the ended observation window',
  );
  await assert.rejects(
    addBenchObservation({
      threadId,
      actor: 'luca-replit',
      category: 'noticed',
      content: 'Must not append after closure.',
      sourceEventIds: [sourceEvents[0].id],
      idempotencyKey: `bench-test:${runId}:after-end`,
      expectedSequence: ended.thread.latestSequence,
    }),
    (error: any) => error?.code === 'observation_window_ended',
  );
  await assert.rejects(
    inviteBenchObservation({
      threadId,
      observationEventId: firstObservation.event.id,
      conversationId,
    }),
    (error: any) => error?.code === 'observation_window_ended',
  );
  const afterEndDashboard = await listObservationBenchDashboard();
  assert.equal(
    afterEndDashboard.benches.find(bench => bench.thread.id === threadId)?.liveStatus.window,
    'ended',
    'ended observation windows must remain available as completed comparisons',
  );
});
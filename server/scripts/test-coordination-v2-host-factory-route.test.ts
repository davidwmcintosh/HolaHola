import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import express, { type RequestHandler } from 'express';
import test from 'node:test';
import { registerCoordinationHostRoutes } from '../routes/coordination-host-routes';
import { assertCoordinationV2LifecycleHostIdentity, createCoordinationV2HttpDependencyFactory } from './coordination-v2-http-factory';
import { runCoordinationWindowsHost, type CoordinationWindowsExecutionJournal } from './coordination-windows-host';
import { createHostEnvelope } from '../services/coordination-host-protocol';
import { digestCanonical } from '../services/coordination-runtime';

test('lifecycle opaque host identity mismatch is rejected', () => {
  assert.throws(() => assertCoordinationV2LifecycleHostIdentity({
    opaque: { hostEnrollmentId: 'host-a' },
    preparation: { reservation: { enrolledHostId: 'host-b' } },
  }), /identity_mismatch/);
});

test('acknowledged lifecycle state is closed and validated before lease acquisition', async () => {
  const valid = {
    sessionId: 'session', reservationId: 'reservation', generationId: 'generation',
    policyVersionId: 'policy', attemptId: 'attempt', enrolledHostId: 'host',
  };
  const cases: Array<[string, unknown]> = [
    ['string', 'state'],
    ['array', []],
    ['null', null],
    ...Object.keys(valid).map((key) => [`missing:${key}`, Object.fromEntries(Object.entries(valid).filter(([field]) => field !== key))] as [string, unknown]),
    ...Object.keys(valid).map((key) => [`empty:${key}`, { ...valid, [key]: '' }] as [string, unknown]),
    ...Object.keys(valid).map((key) => [`wrong-type:${key}`, { ...valid, [key]: 7 }] as [string, unknown]),
    ['unknown-field', { ...valid, unexpected: 'authority' }],
  ];
  for (const [label, state] of cases) {
    let acquireCalls = 0;
    const result = await runCoordinationWindowsHost({ taskRef: '1448' }, {
      transport: {
        maxRetries: 1,
        start: async () => ({ alreadyAcknowledged: true, state }),
        acquireLease: async () => {
          acquireCalls += 1;
          return { state: valid };
        },
        poll: async () => ({ action: 'renew' }),
        claim: async () => ({}),
        result: async () => ({}),
        cleanup: async () => ({ acknowledged: true }),
      } as any,
      preflight: async () => ({ accepted: true }),
      executionJournal: { begin: async () => ({ state: 'started', fresh: true }), complete: async () => undefined },
    });
    assert.equal(result.status.state, 'host_unavailable', label);
    assert.equal(acquireCalls, 0, label);
  }
  const malformedRereads: Array<[string, unknown]> = [
    ['missing-session', { ...valid, sessionId: undefined }],
    ['extra-authority', { ...valid, unexpected: 'authority' }],
    ['empty-policy', { ...valid, policyVersionId: '' }],
  ];
  for (const [label, rereadState] of malformedRereads) {
    let startCalls = 0;
    let acquireCalls = 0;
    const result = await runCoordinationWindowsHost({ taskRef: '1448' }, {
      transport: {
        maxRetries: 1,
        start: async () => {
          startCalls += 1;
          return startCalls === 1
            ? { alreadyAcknowledged: false, state: valid, preparation: {} as any }
            : { alreadyAcknowledged: true, state: rereadState };
        },
        acquireLease: async () => {
          acquireCalls += 1;
          return { state: valid };
        },
        poll: async () => ({ action: 'renew' }),
        claim: async () => ({}),
        result: async () => ({}),
        cleanup: async () => ({ acknowledged: true }),
      } as any,
      preflight: async () => ({ accepted: true }),
      prepare: async () => ({
        state: 'acknowledged', generationId: 'generation', activeChanged: true, recoverable: false,
      }),
      executionJournal: { begin: async () => ({ state: 'started', fresh: true }), complete: async () => undefined },
    });
    assert.equal(result.status.state, 'host_unavailable', label);
    assert.equal(startCalls, 2, label);
    assert.equal(acquireCalls, 0, label);
  }
  let rereadCalls = 0;
  let rereadAcquireCalls = 0;
  const preparationReplay = await runCoordinationWindowsHost({ taskRef: '1448' }, {
    transport: {
      maxRetries: 1,
      start: async () => {
        rereadCalls += 1;
        return rereadCalls === 1
          ? { alreadyAcknowledged: false, state: valid, preparation: {} as any }
          : { alreadyAcknowledged: true, state: valid, preparation: {} as any };
      },
      acquireLease: async () => {
        rereadAcquireCalls += 1;
        return { state: valid };
      },
      poll: async () => ({ action: 'renew' }),
      claim: async () => ({}),
      result: async () => ({}),
      cleanup: async () => ({ acknowledged: true }),
    } as any,
    preflight: async () => ({ accepted: true }),
    prepare: async () => ({
      state: 'acknowledged', generationId: 'generation', activeChanged: true, recoverable: false,
    }),
    executionJournal: { begin: async () => ({ state: 'started', fresh: true }), complete: async () => undefined },
  });
  assert.equal(preparationReplay.status.state, 'host_unavailable');
  assert.equal(rereadCalls, 2);
  assert.equal(rereadAcquireCalls, 0);
});

test('acknowledged state validator remains a pre-lease fail-closed boundary', () => {
  const source = readFileSync('server/scripts/coordination-windows-host.ts', 'utf8');
  assert.match(source, /acknowledgedState = acknowledged\.state/);
  assert.match(source, /acknowledgedState = started\.state/);
  assert.match(source, /validateCoordinationWindowsAcknowledgedState\(acknowledgedState\)/);
  const mutated = source.replace(
    'validatedState = validateCoordinationWindowsAcknowledgedState(acknowledgedState);',
    'validatedState = acknowledgedState as CoordinationWindowsAcknowledgedState;',
  );
  assert.notEqual(mutated, source);
  const preLeaseValidator = source.indexOf('validateCoordinationWindowsAcknowledgedState(acknowledgedState)');
  const acquire = source.indexOf('const leased = await retry(() => dependencies.transport.acquireLease');
  assert.ok(preLeaseValidator >= 0 && acquire > preLeaseValidator);
  assert.match(source, /acquireLease\(\{ state: validatedState \}\)/);
});

test('authenticated factory composes with the real host route envelope and URL contract', async () => {
  const app = express(); app.use(express.json());
  let observed: Record<string, unknown> | undefined;
  const requests: Array<{ url: string; headers: Record<string, string> }> = [];
  const responseBodies: Array<{ url: string; status: number; body: string }> = [];
  let resultServiceResponse: unknown;
  let cleanupServiceInput: unknown;
  let cleanupServiceResponse: unknown;
  let cleanupTransportResult: unknown;
  let hostExecuteCalled = false;
  let prepareCalled = false;
  let acknowledged = false;
  const reservation = (state: string) => ({
    id: 'reservation', sessionId: acknowledged ? 'session' : null, enrolledHostId: 'host',
    generationId: 'generation', reservationDigest: 'a'.repeat(64), taskRef: '1448',
    taskArtifactSha256: 'b'.repeat(64), promotionRecordId: 'promotion',
    promotedCommitSha: 'c'.repeat(40), exactTreeSha: 'd'.repeat(40),
    policyIdentityId: 'policy-identity', policyVersionId: 'policy',
    operatorGrantId: 'grant', operatorActor: 'host', publicMaterialDigest: 'e'.repeat(64),
    protocolVersion: 1, repositoryIdentity: 'github:owner/repo', branch: 'main',
    startingCommit: 'f'.repeat(40), state, reserveRequestKey: 'reserve',
    reserveCommandDigest: '1'.repeat(64), acknowledgementRequestKey: acknowledged ? 'ack' : null,
    ackCommandDigest: acknowledged ? '2'.repeat(64) : null, safePromotionEvidenceDigest: '3'.repeat(64),
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });
  const auth: RequestHandler = (req, _res, next) => {
    (req as any).coordinationV2Host = {
      credentialId: 'credential', hostEnrollmentId: 'host', capability: 'host:transport',
      protocolVersion: 1, sessionId: null, holderInstanceId: null, lineageDigest: 'a'.repeat(64),
    };
    next();
  };
  registerCoordinationHostRoutes(app, {
    coordinationAuthMiddleware: auth,
    coordinationIdentityAuthMiddleware: auth,
    issueSessionCredential: async (input: any) => ({
      sessionToken: input.capability === 'host:cleanup' ? 'v2s_cleanup_test' : 'v2s_transport_test',
      credentialId: `credential-${input.capability}`, expiresAt: new Date(Date.now() + 60_000).toISOString(), lineageDigest: 'a'.repeat(64),
    }),
    resolveSessionAttempt: async () => 'attempt',
    renewSessionCredential: async () => ({ credentialId: 'credential', expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    services: {
      acquireCoordinationTransportLease: async (input) => {
        observed = input as Record<string, unknown>;
        return {
          id: 'lease', sessionId: input.sessionId, enrolledHostId: 'host',
           holderInstanceId: input.holderInstanceId, epoch: 1, state: 'active', attemptId: 'attempt',
           obligationId: 'obligation',
        } as any;
      },
      pollCoordinationTransportWork: async () => ({
        operation: 'poll', sessionId: 'session', leaseId: 'lease', epoch: 1,
        attempt: { id: 'attempt', packetId: 'packet', state: 'waiting_for_host', provider: 'fake', model: 'fake', deadlineAt: new Date().toISOString() },
      }) as any,
      claimCoordinationTransportWork: async () => ({ claimId: 'claim', attemptId: 'attempt', state: 'host_started' }) as any,
      resultCoordinationTransportWork: async () => {
        const response = {
          operation: 'result', state: 'result_ready', terminalState: 'succeeded', obligationId: 'obligation',
        };
        resultServiceResponse = response;
        return response;
      },
      renewCoordinationTransportLease: async () => ({ id: 'lease', sessionId: 'session', epoch: 1, state: 'active' }) as any,
      cleanupCoordinationTransportWork: async (input) => {
        cleanupServiceInput = input;
        cleanupServiceResponse = { accepted: true, outcome: 'acknowledged' };
        return cleanupServiceResponse as any;
      },
    },
    reserveLifecyclePreparation: async () => ({
      reservation: reservation(acknowledged ? 'acknowledged' : 'reserved'),
      policyVersionId: 'policy',
    } as any),
    issuePreparationEnvelope: async () => ({
      payload: {
        protocol: 1, hostEnrollmentId: 'host', repositoryIdentity: 'github:owner/repo',
        taskRef: '1448', taskArtifactSha: 'b'.repeat(64), preparationGeneration: 'generation',
        reservationId: 'reservation', publicMaterialDigest: 'e'.repeat(64),
        promotedCommitSha: 'c'.repeat(40), exactTreeSha: 'd'.repeat(40),
        nonce: 'nonce', taskArtifact: Buffer.from('artifact').toString('base64'),
        publicCoordinatorConfig: Buffer.from('{}').toString('base64'),
      }, signature: 'signature', keyFingerprint: 'fingerprint',
    } as any),
    promotePreparationBeforeSession: async () => {
      return reservation('promoted') as any;
    },
    acknowledgePreparationBeforeSession: async () => {
      acknowledged = true;
      return reservation('acknowledged') as any;
    },
    acknowledgeAndProjectState: async () => {
      acknowledged = true;
      return {
        reservation: reservation('acknowledged'),
        state: {
          sessionId: 'session', reservationId: 'reservation', generationId: 'generation',
          policyVersionId: 'policy', attemptId: 'attempt', enrolledHostId: 'host',
        },
      } as any;
    },
    createInitialAttempt: async () => ({ id: 'attempt', created: true } as any),
    readAcknowledgedState: async () => ({
      sessionId: 'session', reservationId: 'reservation', generationId: 'generation',
      policyVersionId: 'policy', attemptId: 'attempt', enrolledHostId: 'host',
    }),
  });
  app.post('/api/coordination/v2/host/renew', auth, (_req, res) => res.json({ renewed: true }));
  app.post('/api/coordination/v2/host/sessions/session/renew', auth, (_req, res) => res.json({ renewed: true }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const factory = await createCoordinationV2HttpDependencyFactory({
      material: { endpoint: `http://127.0.0.1:${port}`, accessToken: `v2h_${'x'.repeat(32)}` },
      signProof: async () => 'test-proof',
      request: async (url, init) => {
        requests.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
        const response = await fetch(url, init);
        responseBodies.push({ url, status: response.status, body: await response.clone().text() });
        if (response.status >= 400) {
          const body = await response.clone().text();
          throw new Error(`route_${response.status}:${body}`);
        }
        return response;
      },
      verifyPreparationEnvelope: async () => ({ payload: {}, secretPlaintext: undefined } as any),
      readRepositoryIdentity: async () => 'github:owner/repo',
    });
    const deps = await factory({ taskRef: '1448' });
    const prepareThroughActualRoutes = async () => {
      prepareCalled = true;
      const promotionResponse = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/host/preparation/promote`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reservationId: 'reservation', generationId: 'generation',
          publicMaterialDigest: 'e'.repeat(64), safePromotionEvidenceDigest: '3'.repeat(64) }),
      });
      assert.equal(promotionResponse.status, 200);
      const acknowledgementResponse = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/host/preparation/acknowledge`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reservationId: 'reservation', generationId: 'generation', publicMaterialDigest: 'e'.repeat(64),
          acknowledgementRequestKey: 'ack', safePromotionEvidenceDigest: '3'.repeat(64) }),
      });
      assert.equal(acknowledgementResponse.status, 200);
      return { state: 'acknowledged' } as any;
    };
    const started = await deps.transport.start({ taskRef: '1448' });
    assert.equal(started.alreadyAcknowledged, false);
    await prepareThroughActualRoutes();
    const acknowledgedStart = await deps.transport.start({ taskRef: '1448' });
    assert.equal(acknowledgedStart.alreadyAcknowledged, true);
    assert.equal(acknowledgedStart.preparation, undefined);
    const result = await deps.transport.acquireLease({ state: acknowledgedStart.state! });
    assert.equal((result as any).id, 'lease');
    const leaseState = (result as any).state;
    assert.equal(typeof leaseState.holderInstanceId, 'string');
    assert.notEqual(leaseState.holderInstanceId, '');
    assert.deepEqual(Object.keys(leaseState.binding).sort(), [
      'attemptId', 'enrolledHostId', 'holderInstanceId', 'leaseEpoch', 'operation',
      'operationDigest', 'policyVersionId', 'sessionId', 'transportLeaseId',
    ]);
    assert.equal(leaseState.binding.operation, 'lease');
    assert.equal(leaseState.binding.transportLeaseId, leaseState.leaseId);
    assert.equal(observed?.actorId, 'host');
    assert.equal(observed?.sessionId, 'session');
    await deps.transport.poll({ state: leaseState, requestKey: 'poll' });
    await deps.transport.claim({ state: leaseState, requestKey: 'claim', offer: {} });
    await deps.transport.result({ state: leaseState, requestKey: 'result', result: {} });
    await deps.transport.renew({ state: leaseState, requestKey: 'renew' });
    await deps.transport.cleanup({ state: { ...leaseState, obligationId: 'obligation' }, requestKey: 'cleanup' });
    const sessionCalls = requests.filter((call) => call.headers['x-coordination-v2-session-token']);
    assert.ok(sessionCalls.length >= 5);
    assert.ok(sessionCalls.every((call) => call.headers['x-coordination-v2-session-proof'] === 'test-proof'), JSON.stringify(sessionCalls));

    const journal: CoordinationWindowsExecutionJournal = {
      begin: async () => ({ state: 'started', fresh: true }),
      complete: async () => undefined,
    };
    acknowledged = false;
    resultServiceResponse = undefined;
    cleanupServiceInput = undefined;
    cleanupServiceResponse = undefined;
    cleanupTransportResult = undefined;
    responseBodies.length = 0;
    hostExecuteCalled = false;
    prepareCalled = false;
    const driverResult = await runCoordinationWindowsHost({ taskRef: '1448' }, {
      transport: {
        ...deps.transport,
        acquireLease: async (input) => {
          const acquired = await deps.transport.acquireLease(input);
          return acquired.state ? { ...acquired, state: { ...acquired.state, obligationId: 'obligation' } } : acquired;
        },
        cleanup: async (input) => {
          const cleaned = await deps.transport.cleanup(input);
          cleanupTransportResult = cleaned;
          return cleaned;
        },
      },
      preflight: async () => ({ accepted: true } as any),
      prepare: prepareThroughActualRoutes,
      executionJournal: journal,
      host: { execute: async (claim: any) => {
        hostExecuteCalled = true;
        return createHostEnvelope('structured_result', {
        binding: {
          ...(claim.payload as Record<string, any>).binding,
          operation: 'result',
          operationDigest: digestCanonical({ ok: true }),
        },
        result: { ok: true }, resultDigest: digestCanonical({ ok: true }),
      }, {
        requestId: 'test-result-request', correlationId: 'test-result-correlation',
        issuedAt: new Date(Date.now() - 1_000).toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }) as any;
      } },
      maxPolls: 2,
    });
    assert.equal(prepareCalled, true);
    assert.equal(hostExecuteCalled, true);
    assert.deepEqual(resultServiceResponse, {
      operation: 'result', state: 'result_ready', terminalState: 'succeeded', obligationId: 'obligation',
    });
    assert.equal((cleanupServiceInput as any)?.obligationId, 'obligation');
    assert.deepEqual(cleanupServiceResponse, { accepted: true, outcome: 'acknowledged' });
    assert.deepEqual(cleanupTransportResult, {
      state: (cleanupTransportResult as any)?.state,
      acknowledged: true,
    });
    const cleanupResponse = responseBodies.filter((entry) => entry.url.endsWith('/host/sessions/session/cleanup')).at(-1);
    assert.equal(cleanupResponse?.status, 200);
    assert.deepEqual(JSON.parse(cleanupResponse?.body ?? '{}'), { accepted: true, outcome: 'acknowledged' });
    assert.deepEqual(driverResult.status, { state: 'succeeded', cleanupAcknowledged: true });
    acknowledged = true;
    const restarted = await deps.transport.start({ taskRef: '1448' });
    assert.equal(restarted.alreadyAcknowledged, true);
    assert.equal(restarted.preparation, undefined);
    assert.ok(restarted.state);
    const resumed = await runCoordinationWindowsHost({ taskRef: '1448' }, {
      transport: {
        ...deps.transport,
        acquireLease: async (input) => {
          const acquired = await deps.transport.acquireLease(input);
          return acquired.state ? { ...acquired, state: { ...acquired.state, obligationId: 'obligation' } } : acquired;
        },
      },
      preflight: async () => ({ accepted: true } as any),
      executionJournal: {
        begin: async () => ({ state: 'started', fresh: true }),
        complete: async () => undefined,
      },
      host: { execute: async (claim: any) => createHostEnvelope('structured_result', {
        binding: {
          ...(claim.payload as Record<string, any>).binding,
          operation: 'result', operationDigest: digestCanonical({ ok: true }),
        },
        result: { ok: true }, resultDigest: digestCanonical({ ok: true }),
      }, {
        requestId: 'test-resume-result-request', correlationId: 'test-resume-result-correlation',
        issuedAt: new Date(Date.now() - 1_000).toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }) as any },
      maxPolls: 2,
    });
    assert.deepEqual(resumed.status, { state: 'succeeded', cleanupAcknowledged: true });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
/**
 * ONE-OFF LIVE VERIFICATION SCRIPT — not wired into CI or any workflow.
 *
 * Task #1639: "Confirm Gemini's coordination adapter can actually finish a
 * real task." This drives ONE real Coordinator V2 session through Gemini's
 * actual provider-adapter path end to end, against the REAL shared database
 * (NEON_SHARED_DATABASE_URL — no env overrides, no disposable branch) and the
 * REAL Gemini API (via CoordinationGeminiAdapter's own default credential
 * resolution: AI_INTEGRATIONS_GEMINI_API_KEY / AI_INTEGRATIONS_GEMINI_BASE_URL).
 *
 * It does NOT mock the transport, the registry, or the database. The only
 * things fabricated are the fixture host/policy/grant rows required to
 * authorize a session at all -- exactly as the hermetic
 * test-coordination-v2-e2e.test.ts does, except that suite runs against a
 * disposable branch and never calls the real Gemini API. This script is the
 * live counterpart: same call sequence, real infrastructure throughout.
 *
 * Safety: the fixture host must have hostType='windows' to pass
 * reserveCoordinationWindowsPreparation's validation, which makes it a
 * (narrow, short-duration) candidate for defaultHost()'s auto-selection by
 * any concurrent real launch that does not override resolveHost. This script
 * runs fast and revokes the fixture host/policy/grant in a `finally` block
 * regardless of outcome. The resulting session/attempt/lease/cleanup rows are
 * left in place as permanent evidence; only the authorization scaffolding is
 * revoked.
 *
 * Run with: npx tsx server/scripts/verify-gemini-v2-adapter-live.ts
 */
import { createHash, randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import pg from 'pg';
import { canonicalizeAndHashPolicy } from '../services/coordination-policy-canonicalization';
import type {
  InheritancePacket,
  InboxItem,
  Assignment,
  ExecutionEnvelope,
} from '../services/coordination-runtime';

function sha(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function banner(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const databaseUrl = process.env.NEON_SHARED_DATABASE_URL;
  if (!databaseUrl) throw new Error('NEON_SHARED_DATABASE_URL is required -- this script targets the real shared database');

  const RUN_SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const idPrefix = `task-1639-gemini-live-${RUN_SUFFIX}`;
  const id = (kind: string) => `${idPrefix}-${kind}`;
  const digest = (kind: string) => sha(`${idPrefix}:${kind}`);

  const actorId = 'luca-replit';
  const holderInstanceId = id('holder');
  const hostId = id('host');
  const identityId = id('identity');
  const versionId = id('version');
  const grantId = id('grant');
  const publicMaterialDigest = digest('public-material');
  const taskArtifactSha256 = sha(`task-1639-gemini-live-verification-artifact:${RUN_SUFFIX}`);

  const realBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  const realStartingCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const repositoryIdentity = 'github:davidwmcintosh/holahola';

  console.log(`Run id: ${idPrefix}`);
  console.log(`Real branch: ${realBranch}, real HEAD: ${realStartingCommit}`);

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const policy = canonicalizeAndHashPolicy({
    hostTypes: ['windows'],
    hostConstraints: {
      windowsRepositoryBranch: realBranch,
      windowsPublicMaterialDigest: publicMaterialDigest,
    },
    providerOrder: ['gemini'],
    sessionDurationMs: 900_000,
    totalAttemptBudget: 2,
    perProviderAttemptBudgets: { gemini: 2 },
    requiredValidationCommands: ['typecheck'],
    requiredCompletionEvidence: ['digest'],
  });

  let fixturesCreated = false;
  let sessionId = '';
  let attemptId = '';
  let leaseId = '';
  let leaseEpoch = 0;

  try {
    banner('STEP 0: create fixture host / policy / grant (real shared DB)');
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id,host_key,host_type,display_name,protocol_version,public_key,key_fingerprint,
         capabilities,enrollment_digest,enrollment_request_key,status,created_by)
       VALUES ($1,$2,'windows',$3,1,'task-1639-live-verification-fixture-key',$4,
                ARRAY['preflight','prepare','poll','claim','result'],$5,$6,'active','luca-replit-task-1639')`,
      [hostId, id('host-key'), 'Task 1639 Gemini live-verification fixture host (safe to revoke)',
        digest('fingerprint'), digest('enrollment'), id('enrollment-request')],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id,policy_key,display_name,status,created_by)
       VALUES ($1,$2,$3,'active','luca-replit-task-1639')`,
      [identityId, id('policy-key'), 'Task 1639 Gemini live-verification fixture policy'],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id,policy_identity_id,version,canonical_policy,policy_digest,approval_state,
        created_by,approved_by,approved_at)
       VALUES ($1,$2,1,$3::jsonb,$4,'approved','luca-replit-task-1639','luca-replit-task-1639',now())`,
      [versionId, identityId, JSON.stringify(policy.canonicalPolicy), policy.policyDigest],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id,policy_identity_id,operator_actor,actions,issued_by,expires_at,grant_digest,request_key)
       VALUES ($1,$2,$3,ARRAY['launch','resume','terminate','status'],
               'luca-replit-task-1639',now()+interval '1 hour',$4,$5)`,
      [grantId, identityId, actorId, digest('grant'), id('grant-request')],
    );
    await client.query('COMMIT');
    fixturesCreated = true;
    console.log(`Fixture host=${hostId} identity=${identityId} version=${versionId} grant=${grantId}`);

    const [
      { launchOrResumeCoordinationLifecycle },
      generation,
      sessionService,
      attemptService,
      leaseService,
      cleanupService,
      { digestCanonical },
    ] = await Promise.all([
      import('../services/coordination-lifecycle-facade-service'),
      import('../services/coordination-windows-generation'),
      import('../services/coordination-session-service'),
      import('../services/coordination-attempt-service'),
      import('../services/coordination-transport-lease-service'),
      import('../services/coordination-cleanup-service'),
      import('../services/coordination-runtime'),
    ]);
    const { DEFAULT_PROVIDER_REGISTRY } = await import('../services/coordination-provider-adapters/registry');
    const { CoordinationGeminiAdapter } = await import('../services/coordination-provider-adapters/gemini');

    let lifecycleStage = 'not-started';
    let lifecycleCause: unknown;
    const traceLifecycleService = <T extends (...args: any[]) => Promise<any>>(stage: string, service: T): T =>
      (async (...args: Parameters<T>) => {
        lifecycleStage = stage;
        lifecycleCause = undefined;
        try {
          return await service(...args);
        } catch (error) {
          lifecycleCause = error;
          throw error;
        }
      }) as T;

    const dependencies = {
      resolveTaskMetadata: async () => ({
        taskRef: '1639',
        taskArtifactSha256,
        repositoryIdentity,
        startingCommit: realStartingCommit,
      }),
      resolvePolicy: async () => ({
        policyIdentityId: identityId,
        policyVersionId: versionId,
        operatorGrantId: grantId,
        // canonicalizeAndHashPolicy's declared return type is a loose
        // Readonly<Record<string, unknown>>; the runtime value genuinely
        // conforms to ProviderSelectionPolicy (built from that exact shape,
        // proven by test-coordination-v2-e2e.test.ts's identical usage,
        // which never surfaces this cast because *.test.ts is typecheck-excluded).
        policy: policy.canonicalPolicy as any,
      }),
      resolveHost: async () => ({ enrolledHostId: hostId }),
      providerRegistry: DEFAULT_PROVIDER_REGISTRY,
      holderInstanceId: () => holderInstanceId,
      leaseDurationMs: 300_000,
      services: {
        createOrResumeSession: traceLifecycleService('create-or-resume-session', sessionService.createOrResumeSession),
        transitionCoordinationSession: traceLifecycleService('transition-session', sessionService.transitionCoordinationSession),
        createFreshAttempt: traceLifecycleService('create-fresh-attempt', attemptService.createFreshAttempt),
        acquireCoordinationTransportLease: traceLifecycleService('acquire-transport-lease', leaseService.acquireCoordinationTransportLease),
      },
    };

    const launchRequestKey = id('launch');

    banner('STEP 1: launchOrResumeCoordinationLifecycle -> preparing');
    const preparing = await launchOrResumeCoordinationLifecycle(
      { taskRef: '1639' },
      { actorId, requestKey: launchRequestKey },
      dependencies,
    );
    console.log('Result:', preparing);
    if (preparing.state !== 'preparing') throw new Error(`Expected state 'preparing', got ${JSON.stringify(preparing)}`);

    const sessionRows = await client.query(
      'SELECT id,state FROM coordination_v2_sessions WHERE idempotency_key=$1',
      [launchRequestKey],
    );
    if (sessionRows.rowCount !== 1) throw new Error(`Expected exactly 1 session row, got ${sessionRows.rowCount}`);
    sessionId = sessionRows.rows[0].id as string;
    console.log(`Real session row created: id=${sessionId} state=${sessionRows.rows[0].state}`);

    banner('STEP 2: windows preparation ceremony (reserve -> promote -> acknowledge)');
    const reservation = await generation.reserveCoordinationWindowsPreparation({
      sessionId, actorId, reserveRequestKey: id('reserve'),
    });
    console.log('Reservation:', reservation.state, reservation.id);
    if (reservation.state !== 'reserved') throw new Error(`Expected 'reserved', got ${reservation.state}`);

    const promoted = await generation.promoteCoordinationWindowsPreparation({
      sessionId, actorId, reservationId: reservation.id, generationId: reservation.generationId,
      publicMaterialDigest, safePromotionEvidenceDigest: digest('promotion-evidence'),
    });
    console.log('Promoted:', promoted.state);
    if (promoted.state !== 'promoted') throw new Error(`Expected 'promoted', got ${promoted.state}`);

    const acknowledged = await generation.acknowledgeCoordinationWindowsPreparation({
      sessionId, actorId, reservationId: reservation.id, generationId: reservation.generationId,
      publicMaterialDigest, protocolVersion: 1,
      acknowledgementRequestKey: id('preparation-ack'),
      safePromotionEvidenceDigest: digest('promotion-evidence'),
    });
    console.log('Acknowledged:', acknowledged.state);
    if (acknowledged.state !== 'acknowledged') throw new Error(`Expected 'acknowledged', got ${acknowledged.state}`);

    banner('STEP 3: launchOrResumeCoordinationLifecycle (resume) -> running (creates real attempt + lease)');
    let running: { state: string; cleanupPending: boolean };
    try {
      running = await launchOrResumeCoordinationLifecycle(
        { taskRef: '1639' },
        { actorId, requestKey: launchRequestKey },
        dependencies,
      );
    } catch (error) {
      const cause = lifecycleCause instanceof Error ? `${lifecycleCause.name}: ${lifecycleCause.message}` : String(lifecycleCause);
      throw new Error(`Resume failed at stage=${lifecycleStage} (${cause}); public error: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log('Result:', running);
    if (running.state !== 'running') throw new Error(`Expected state 'running', got ${JSON.stringify(running)}`);

    const attemptRows = await client.query(
      `SELECT id,provider,model,adapter_version,state,session_ordinal FROM coordination_v2_attempts WHERE session_id=$1`,
      [sessionId],
    );
    if (attemptRows.rowCount !== 1) throw new Error(`Expected exactly 1 attempt row, got ${attemptRows.rowCount}`);
    attemptId = attemptRows.rows[0].id as string;
    console.log('Real attempt row created:', attemptRows.rows[0]);
    if (attemptRows.rows[0].provider !== 'gemini') throw new Error(`Expected provider 'gemini', got ${attemptRows.rows[0].provider}`);

    banner('STEP 4: attempt transition -> provider_started');
    const providerStarted = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('provider-started'), actorId,
      command: { type: 'provider_started' },
    });
    console.log('State:', providerStarted.state);
    if (providerStarted.state !== 'provider_active') throw new Error(`Expected 'provider_active', got ${providerStarted.state}`);

    banner('STEP 5: build real InheritancePacket');
    const threadId = id('thread');
    const inboxItem: InboxItem = {
      id: id('inbox-1'),
      eventId: id('event-1'),
      threadId,
      taskId: 'task-1639',
      sequence: 1,
      payload: {
        content: {
          kind: 'coordination_assignment',
          instruction:
            'You are the coordination host execution agent for a live production verification run. ' +
            'Call the function tool named git_status now, with no arguments. Do not respond with text ' +
            'only -- you must invoke the git_status tool. This is a real, live verification of the ' +
            'Gemini coordination provider adapter for task 1639; a genuine tool call is required.',
          taskRef: '1639',
          repositoryIdentity,
        },
      },
    };
    const assignment: Assignment = {
      assignmentEventId: id('assignment-event'),
      assignmentAuthor: 'luca-replit',
      taskId: 'task-1639',
      threadId,
      expectedSequence: 1,
    };
    const envelope: ExecutionEnvelope = {
      worktreeLabel: 'task-1639-verification',
      worktreePath: process.cwd(),
      argv: ['git', 'status'],
      patchDigest: null,
      repositoryLabel: 'HolaHola',
      branch: realBranch,
      startingCommit: realStartingCommit,
      timeoutMs: 600000,
      taskRef: '1639',
    };
    const windowId = id('window');
    const packetWithoutDigest: Omit<InheritancePacket, 'digest'> = {
      id: id('packet-1'),
      version: 1,
      actor: 'luca-gemini',
      runtimeRegistrationId: id('runtime-registration'),
      profileId: id('profile'),
      createdAt: Date.now(),
      supersedesClaimId: null,
      windowId,
      windowDigest: digestCanonical({ windowId, threadId, itemIds: [inboxItem.id] }),
      orderedInboxItemIds: [inboxItem.id],
      orderedEventIds: [inboxItem.eventId],
      orderedThreadIds: [threadId],
      assignment,
      inherited: [inboxItem.payload],
      envelope,
    };
    const packet: InheritancePacket = { ...packetWithoutDigest, digest: digestCanonical(packetWithoutDigest) };
    console.log(`Packet built: id=${packet.id} digest=${packet.digest}`);

    banner('STEP 6: REAL Gemini API call (turn 1) via CoordinationGeminiAdapter.turn()');
    const transport = async (request: { url: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => {
      console.log(`  -> POST ${request.url}`);
      const response = await fetch(request.url, { method: 'POST', headers: request.headers, body: request.body, signal: request.signal });
      const body = await response.text();
      console.log(`  <- HTTP ${response.status}, ${body.length} bytes`);
      return { status: response.status, body };
    };
    const adapter = new CoordinationGeminiAdapter(transport);
    const turn1Results = await adapter.turn(packet, 1, []);
    const turn1 = turn1Results[0];
    console.log('Turn 1 outcome:', turn1?.outcome);
    console.log('Turn 1 textParts:', JSON.stringify(turn1?.textParts));
    console.log('Turn 1 intents:', JSON.stringify(turn1?.intents, null, 2));
    console.log('Turn 1 providerDetails:', JSON.stringify(turn1?.providerDetails));

    if (!turn1) throw new Error('Gemini adapter returned zero results for turn 1 -- unexpected, adapter always returns at least one result');

    let gitStatusIntent = turn1.intents.find((intent) => intent.name === 'git_status' && intent.executionEligible);
    let effectiveTurn1 = turn1;
    if (!gitStatusIntent && turn1.outcome === 'consumed') {
      // The bare JSON packet plus a stern instruction did not produce the
      // desired tool call on the first attempt. Retry once with a more
      // forceful, standalone instruction appended as an additional content
      // part -- still a real call, not a fabricated result.
      banner('STEP 6b: turn 1 did not call git_status -- real retry with reinforced instruction');
      const retryPacket: InheritancePacket = {
        ...packet,
        inherited: [
          ...packet.inherited,
          {
            content: {
              kind: 'reinforced_instruction',
              instruction: 'REQUIRED ACTION: invoke the git_status function tool immediately. This is the only acceptable response.',
            },
          },
        ],
      };
      const retryResults = await adapter.turn(retryPacket, 1, []);
      effectiveTurn1 = retryResults[0]!;
      console.log('Retry outcome:', effectiveTurn1.outcome);
      console.log('Retry textParts:', JSON.stringify(effectiveTurn1.textParts));
      console.log('Retry intents:', JSON.stringify(effectiveTurn1.intents, null, 2));
      gitStatusIntent = effectiveTurn1.intents.find((intent) => intent.name === 'git_status' && intent.executionEligible);
    }

    if (!gitStatusIntent) {
      console.log('\n*** FINDING: the real Gemini call never produced an executionEligible git_status intent. ***');
      console.log('This is itself the deliverable of this task -- documenting it honestly rather than fabricating a tool call.');
      throw new Error(
        `Gemini did not call git_status for real. Final outcome=${effectiveTurn1.outcome}, ` +
        `textParts=${JSON.stringify(effectiveTurn1.textParts)}, intents=${JSON.stringify(effectiveTurn1.intents)}`,
      );
    }
    console.log(`\nReal Gemini tool-call intent received: callId=${gitStatusIntent.callId} name=${gitStatusIntent.name}`);

    banner('STEP 7: attempt transitions -> intent_ready -> waiting_for_host');
    const intentReady = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('intent-ready'), actorId,
      command: { type: 'intent_ready' },
    });
    console.log('State:', intentReady.state);
    if (intentReady.state !== 'intent_ready') throw new Error(`Expected 'intent_ready', got ${intentReady.state}`);

    const hostWaiting = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('host-wait'), actorId,
      command: { type: 'host_wait' },
    });
    console.log('State:', hostWaiting.state);
    if (hostWaiting.state !== 'waiting_for_host') throw new Error(`Expected 'waiting_for_host', got ${hostWaiting.state}`);

    banner('STEP 8: read the real active transport lease');
    const leaseRows = await client.query(
      `SELECT id,epoch,state,holder_instance_id FROM coordination_v2_transport_leases WHERE session_id=$1 AND state='active'`,
      [sessionId],
    );
    if (leaseRows.rowCount !== 1) throw new Error(`Expected exactly 1 active lease, got ${leaseRows.rowCount}`);
    leaseId = leaseRows.rows[0].id as string;
    leaseEpoch = Number(leaseRows.rows[0].epoch);
    console.log('Lease:', leaseRows.rows[0]);

    const operationDigest = digestCanonical({ policyVersionId: versionId, sessionId, attemptId, operation: 'execute' });
    const protocolBinding = {
      policyVersionId: versionId, sessionId, attemptId, enrolledHostId: hostId,
      transportLeaseId: leaseId, leaseEpoch, holderInstanceId, operation: 'execute', operationDigest,
    };
    const transportInput = {
      sessionId, enrolledHostId: hostId, holderInstanceId, actorId,
      leaseId, epoch: leaseEpoch, protocolBinding, authorizedOperation: 'execute',
    };

    banner('STEP 9: transport poll -> claim (real host hand-off bookkeeping)');
    const polled = await leaseService.pollCoordinationTransportWork({ ...transportInput, requestKey: id('host-poll') }) as {
      operation: string; attempt: { id: string } | null;
    };
    console.log('Poll operation:', polled.operation, 'attempt:', polled.attempt?.id);

    const hostClaim = await leaseService.claimCoordinationTransportWork({ ...transportInput, attemptId, requestKey: id('host-claim') }) as {
      operation: string; claimId: string; attemptId: string; state: string;
    };
    console.log('Claim:', hostClaim.operation, hostClaim.state);
    if (hostClaim.state !== 'host_active') throw new Error(`Expected 'host_active', got ${hostClaim.state}`);

    banner('STEP 10: REAL host work -- actually run git status');
    const gitStatusOutput = execSync('git status --short --branch', { encoding: 'utf8' });
    console.log('Real git status output:\n' + gitStatusOutput);
    const gitStatusOutputDigest = sha(gitStatusOutput);

    banner('STEP 11: submit real result to the transport (resultCoordinationTransportWork)');
    const hostResult = await leaseService.resultCoordinationTransportWork({
      ...transportInput, attemptId, claimId: hostClaim.claimId, requestKey: id('host-result'),
      result: {
        accepted: true,
        outputDigest: gitStatusOutputDigest,
        tool: 'git_status',
        geminiCallId: gitStatusIntent.callId,
        geminiRequestDigest: effectiveTurn1.requestDigest,
        geminiResponseDigest: effectiveTurn1.responseDigest,
      },
    }) as { operation: string; state: string; resultId: string; resultDigest: string };
    console.log('Result:', hostResult.operation, hostResult.state);
    if (hostResult.state !== 'result_ready') throw new Error(`Expected 'result_ready', got ${hostResult.state}`);

    banner('STEP 12: REAL Gemini API call (turn 2) -- continuation with the real tool result');
    const turn2Results = await adapter.turn(packet, 2, [
      { callId: gitStatusIntent.callId, name: 'git_status', result: { exitCode: 0, stdoutDigest: gitStatusOutputDigest, stdoutPreview: gitStatusOutput.slice(0, 500) } },
    ]);
    const turn2 = turn2Results[0];
    console.log('Turn 2 outcome:', turn2?.outcome);
    console.log('Turn 2 textParts:', JSON.stringify(turn2?.textParts));

    banner('STEP 13: attempt transitions -> provider_continuation -> complete');
    const continuation = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('provider-continuation'), actorId,
      command: { type: 'provider_continuation' },
    });
    console.log('State:', continuation.state);
    if (continuation.state !== 'provider_continuation') throw new Error(`Expected 'provider_continuation', got ${continuation.state}`);

    const completedAttempt = await attemptService.transitionCoordinationAttempt({
      attemptId, requestKey: id('attempt-complete'), actorId,
      // Omit<AttemptCommand, ...> collapses the union to its common keys only
      // (a known TS limitation with Omit over a discriminated union), so the
      // variant-specific `resultCode` field needs this cast. The runtime shape
      // is proven correct by test-coordination-v2-e2e.test.ts's identical call.
      command: { type: 'complete', resultCode: 'verified_host_result' } as any,
    });
    console.log('State:', completedAttempt.state);
    if (completedAttempt.state !== 'completed') throw new Error(`Expected 'completed', got ${completedAttempt.state}`);

    banner('STEP 14: session -> begin_verification -> acceptCoordinationCompletion');
    await sessionService.transitionCoordinationSession({
      sessionId, requestKey: id('begin-verification'), actorId,
      command: { type: 'begin_verification' },
    });
    const completion = await cleanupService.acceptCoordinationCompletion({
      sessionId, requestKey: id('completion'), actorId,
      evidence: [{ type: 'digest', reference: hostResult.resultId, digest: hostResult.resultDigest }],
    }) as {
      session: { state: string; terminalReason: string };
      obligations: Array<{ id: string; kind: string; terminalOutcome: string }>;
    };
    console.log('Session state:', completion.session.state, 'terminalReason:', completion.session.terminalReason);
    console.log('Obligations:', completion.obligations.length);
    if (completion.session.state !== 'succeeded') throw new Error(`Expected session 'succeeded', got ${completion.session.state}`);
    if (completion.obligations.length !== 4) throw new Error(`Expected 4 obligations, got ${completion.obligations.length}`);

    banner('STEP 15: cleanup obligations (start -> acknowledge) for each of the 4');
    for (const obligation of completion.obligations as Array<{ id: string; kind: string }>) {
      const started = await cleanupService.transitionCoordinationCleanup({
        obligationId: obligation.id, requestKey: id(`cleanup-start-${obligation.kind}`), actorId,
        command: { type: 'start' },
      });
      const ack = await leaseService.acknowledgeCoordinationCleanup({
        sessionId, enrolledHostId: hostId, holderInstanceId, actorId,
        leaseId, epoch: leaseEpoch, obligationId: obligation.id,
        requestKey: id(`cleanup-ack-${obligation.kind}`),
        evidence: { acknowledged: true, kind: obligation.kind },
      });
      console.log(`  ${obligation.kind}: start=${started.state} ack=${ack.outcome}`);
    }

    banner('STEP 16: final direct-SQL verification of persisted rows');
    const evidence = await client.query(
      `SELECT
         s.state, s.terminal_reason,
         (SELECT provider FROM coordination_v2_attempts WHERE id=$2) AS attempt_provider,
         (SELECT state FROM coordination_v2_attempts WHERE id=$2) AS attempt_state,
         (SELECT state FROM coordination_v2_transport_leases WHERE id=$3) AS lease_state,
         (SELECT count(*)::int FROM coordination_v2_cleanup_obligations WHERE session_id=$1 AND state='acknowledged') AS acknowledged_cleanup,
         (SELECT count(*)::int FROM coordination_v2_transport_work_claims WHERE session_id=$1) AS host_claims,
         (SELECT count(*)::int FROM coordination_v2_transport_work_results WHERE session_id=$1) AS host_results,
         (SELECT count(*)::int FROM coordination_v2_session_events WHERE session_id=$1 AND event_type='completion_accepted') AS completions
       FROM coordination_v2_sessions s WHERE s.id=$1`,
      [sessionId, attemptId, leaseId],
    );
    console.log(evidence.rows[0]);
    const row = evidence.rows[0];
    const ok = row.state === 'succeeded' && row.attempt_provider === 'gemini' && row.attempt_state === 'completed'
      && row.lease_state === 'released' && row.acknowledged_cleanup === 4 && row.host_claims === 1
      && row.host_results === 1 && row.completions === 1;
    if (!ok) throw new Error(`Final evidence row did not match expected shape: ${JSON.stringify(row)}`);

    console.log('\n*** SUCCESS: Gemini coordination provider adapter drove one real task end to end. ***');
    console.log(`Session id: ${sessionId}`);
    console.log(`Attempt id: ${attemptId}`);
  } finally {
    if (fixturesCreated) {
      banner('CLEANUP: revoking fixture host / policy identity / operator grant');
      try {
        await client.query(
          `UPDATE coordination_v2_host_enrollments SET status='revoked', revoked_at=now(), revocation_request_key=$2, updated_at=now() WHERE id=$1`,
          [hostId, id('revoke-request')],
        );
        await client.query(
          `UPDATE coordination_v2_policy_identities SET status='revoked', revoked_at=now(), updated_at=now() WHERE id=$1`,
          [identityId],
        );
        await client.query(
          `UPDATE coordination_v2_operator_grants SET revoked_at=now() WHERE id=$1`,
          [grantId],
        );
        console.log('Fixture host/policy/grant revoked. Session/attempt/lease/cleanup rows left in place as evidence.');
      } catch (cleanupError) {
        console.error('WARNING: fixture cleanup failed -- manual revocation needed for', { hostId, identityId, grantId }, cleanupError);
      }
    }
    await client.end();
  }
}

main().then(() => {
  console.log('\nDone.');
  process.exit(0);
}).catch((error) => {
  console.error('\n*** SCRIPT FAILED ***');
  console.error(error);
  process.exit(1);
});

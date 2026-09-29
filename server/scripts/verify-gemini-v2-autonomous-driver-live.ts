/**
 * ONE-OFF LIVE DEMONSTRATION SCRIPT for task #1642 -- not wired into CI or any
 * workflow.
 *
 * Task #1639's verify-gemini-v2-adapter-live.ts proved CoordinationGeminiAdapter
 * .turn() genuinely works against the real Gemini API and real shared database,
 * but only because that script personally called every lifecycle step in order,
 * including the provider call itself. Task #1642 built the missing production
 * piece -- coordination-gemini-provider-driver.ts (state-machine driving logic)
 * plus coordination-gemini-provider-worker.ts (the polling loop server/index.ts
 * starts at boot) -- so that something server-side drives a `provider_active`
 * attempt through turn() calls on its own.
 *
 * This script demonstrates that production system end to end. After STEP 4
 * below, this script's own code NEVER calls transitionCoordinationAttempt,
 * transitionCoordinationSession's begin_verification, acceptCoordinationCompletion,
 * applyCoordinationProviderFailure, or CoordinationGeminiAdapter.turn() directly
 * -- only startGeminiProviderWorker() (the exact function server/index.ts calls)
 * does, on its own internal timer. This script only plays the HOST role: polling
 * /claiming/executing real tools/submitting results back through the transport
 * lease service, learning which tool+callId to act on from `pendingIntent` on the
 * poll/claim responses themselves (coordination-transport-lease-service.ts) --
 * the same authenticated channel a real enrolled host uses, not a direct read of
 * intent_ready event metadata (see the "Host-result protocol convention" note in
 * coordination-gemini-provider-driver.ts for how that field is populated).
 *
 * Scope note (identical to verify-gemini-v2-adapter-live.ts's, and for the same
 * reason): the "host" side of this run is SIMULATED. There is no real remote
 * Windows machine involved -- this script performs the enrolled host's job
 * locally (running `git status` / `git diff` / this session's own real check /
 * reading this session's own real file in this workspace, per
 * realToolExecution below) and submits its own output through the same
 * transport calls a real host would use. What this
 * genuinely proves live is that the autonomous driver + worker, unattended,
 * carry a real attempt through real Gemini API calls and the full
 * session/attempt/lease/cleanup database lifecycle to a successful finish. It
 * does not prove a real physical host end-to-end -- that is LITTLENEMO's
 * separate Windows-enrollment concern.
 *
 * Task #1644 note: the read_file/run_test target below (SESSION_READABLE_PATH
 * / SESSION_TEST_COMMAND_TEMPLATE) is this run's own policy-declared `paths`/
 * `commands`, not the old global hardcoded fixture -- see loadSessionToolTargets
 * in coordination-gemini-provider-driver.ts, which the autonomous driver
 * actually consults. This script picks a file/test genuinely relevant to task
 * #1644 itself (the Gemini adapter and its own test suite) to demonstrate
 * that a coordination attempt can check real, task-relevant material instead
 * of being stuck on one fixed fixture.
 *
 * Safety: same fixture-host backdating and SIGINT/SIGTERM revocation mitigations
 * as verify-gemini-v2-adapter-live.ts, so this throwaway fixture can never
 * outrank a real enrolled host in defaultHost()'s selection and never leaks past
 * a killed process. See that script's header for the full rationale.
 *
 * Run with: npx tsx server/scripts/verify-gemini-v2-autonomous-driver-live.ts
 */
import { createHash, randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { canonicalizeAndHashPolicy } from '../services/coordination-policy-canonicalization';

function sha(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function banner(title: string) {
  console.log(`\n=== ${title} ===`);
}

/**
 * This run's own session-specific tool targets (task #1644): proof that a
 * coordination task can declare, via its policy's `paths`/`commands` fields,
 * which real file and real test are relevant to ITS OWN task, instead of
 * every session being stuck on the same hardcoded fixture. Both the policy
 * object built in main() below (which a real host would only ever learn
 * about indirectly, by independently deriving the same values from the same
 * approved policy row -- see coordination-gemini-provider-driver.ts's
 * loadSessionToolTargets) and this script's own realToolExecution (playing
 * that host role) are built from these three constants, so the two stay in
 * lockstep by construction. The target is genuinely relevant to task #1644
 * itself: the Gemini adapter this task modifies, and its own test suite.
 */
const SESSION_READABLE_PATH = 'server/services/coordination-provider-adapters/gemini.ts';
const SESSION_TEST_COMMAND_NAME = 'test';
const SESSION_TEST_COMMAND_TEMPLATE = 'npx tsx --test server/scripts/test-coordination-provider-gemini.test.ts';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Real (non-fabricated) execution for the subset of tools this script can
// safely run unattended. The Gemini adapter's function declarations also
// include replace_once (coordination-provider-adapters/gemini.ts's
// knownTools) -- that one is a real write this generic demo has no
// principled way to choose a safe target for, so if the live model asks for
// it this script stops honestly rather than fabricating a result, exactly
// like verify-gemini-v2-adapter-live.ts's identical scope boundary.
//
// git_status/git_diff/run_test/read_file are all "fixed" operations (see
// coordination-provider-adapters/gemini.ts's executionEligible -- each takes
// either no arguments or exactly one argument shape), so there is exactly
// one real, principled thing each can mean here:
//   - run_test: this session's own policy (built in main() below) declares a
//     `commands` entry named 'test' whose template is SESSION_TEST_COMMAND_
//     TEMPLATE -- that IS this session's real definition of "the test" (its
//     own adapter test suite), so run that real command, not an arbitrary
//     guess and not the old global typecheck fixture.
//   - read_file: this session's own policy declares `paths: [SESSION_
//     READABLE_PATH]` -- the real adapter file this task modifies. Read that
//     real file from disk, nothing else.
// A failing test run is a legitimate real result, not a script error: it is
// reported back to Gemini like any other tool output rather than aborting.
function realToolExecution(name: string): { output: string; outputDigest: string } {
  let output: string;
  if (name === 'git_status') {
    output = execSync('git status --short --branch', { encoding: 'utf8' });
  } else if (name === 'git_diff') {
    output = execSync('git diff', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } else if (name === 'run_test') {
    try {
      output = execSync(SESSION_TEST_COMMAND_TEMPLATE, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
      if (!output.trim()) output = `test passed with no errors (${SESSION_TEST_COMMAND_TEMPLATE})`;
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; message: string };
      output = `test failed (${SESSION_TEST_COMMAND_TEMPLATE}):\n${execError.stdout ?? ''}${execError.stderr ?? ''}`.trim()
        || `test failed (${SESSION_TEST_COMMAND_TEMPLATE}): ${execError.message}`;
    }
  } else if (name === 'read_file') {
    output = readFileSync(SESSION_READABLE_PATH, 'utf8');
  } else {
    throw new Error(
      `Gemini requested tool '${name}', which this demonstration script does not implement real ` +
      `execution for (only git_status, git_diff, run_test, and read_file are wired to real host ` +
      `commands). Stopping here rather than fabricating a result -- this is a scope boundary of the ` +
      `demo, not a driver bug.`,
    );
  }
  return { output, outputDigest: sha(output) };
}

async function main() {
  const databaseUrl = process.env.NEON_SHARED_DATABASE_URL;
  if (!databaseUrl) throw new Error('NEON_SHARED_DATABASE_URL is required -- this script targets the real shared database');

  const RUN_SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const idPrefix = `task-1642-gemini-autonomous-driver-live-${RUN_SUFFIX}`;
  const id = (kind: string) => `${idPrefix}-${kind}`;
  const digest = (kind: string) => sha(`${idPrefix}:${kind}`);

  const actorId = 'luca-replit';
  const holderInstanceId = id('holder');
  const hostId = id('host');
  const identityId = id('identity');
  const versionId = id('version');
  const grantId = id('grant');
  const publicMaterialDigest = digest('public-material');
  const taskArtifactSha256 = sha(`task-1642-gemini-autonomous-driver-verification-artifact:${RUN_SUFFIX}`);

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
    // Budget > 1 so a transient malformed_function_call (now classified as
    // fresh_attempt_same_provider -- see coordination-provider-failure.ts)
    // has real room to retry rather than exhausting on the first hiccup;
    // observed for real on this script's first live run (2026-09-29). A
    // budget of 4 turned out to still be too tight in practice -- a second
    // live run burned through all 4 on real transient provider hiccups
    // (mostly malformed_function_call) before reaching a natural finish, and
    // *that* run also proved the session used to be left orphaned in
    // 'running' forever once the budget was gone (see the
    // failSessionForExhaustedRetry fix in coordination-lifecycle-facade-
    // service.ts). 10 gives real headroom for a clean natural-finish
    // demonstration without masking the orphan fix, which is now exercised
    // and verified independently of how generous this number is.
    totalAttemptBudget: 10,
    perProviderAttemptBudgets: { gemini: 10 },
    // Task #1644: this session's own real read_file target and run_test
    // command (coordination-gemini-provider-driver.ts's
    // loadSessionToolTargets derives these from this exact policy row via
    // policyVersionId) -- not the old global hardcoded fixture. See the
    // SESSION_READABLE_PATH/SESSION_TEST_COMMAND_TEMPLATE doc comment above.
    paths: [SESSION_READABLE_PATH],
    commands: [{ name: SESSION_TEST_COMMAND_NAME, template: SESSION_TEST_COMMAND_TEMPLATE }],
    requiredValidationCommands: ['typecheck'],
    // The one evidence shape coordination-gemini-provider-driver.ts's
    // tryAcceptSessionCompletion knows how to produce -- see its
    // "Session-completion scope note".
    requiredCompletionEvidence: ['digest'],
  });

  let fixturesCreated = false;
  let cleanedUp = false;
  let sessionId = '';
  let leaseId = '';
  let leaseEpoch = 0;
  let stopWorker: (() => void) | null = null;

  async function revokeFixtures(reason: string): Promise<void> {
    if (stopWorker) {
      try { stopWorker(); } catch { /* best-effort */ }
      stopWorker = null;
    }
    if (!fixturesCreated || cleanedUp) return;
    cleanedUp = true;
    banner(`CLEANUP (${reason}): revoking fixture host / policy identity / operator grant`);
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

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.error(`\n*** Received ${signal}, revoking fixtures before exit ***`);
      revokeFixtures(signal).finally(() => process.exit(130));
    });
  }

  try {
    banner('STEP 0: create fixture host / policy / grant (real shared DB)');
    await client.query('BEGIN');
    const FIXTURE_HOST_TIMESTAMP = '2000-01-01T00:00:00Z';
    await client.query(
      `INSERT INTO coordination_v2_host_enrollments
       (id,host_key,host_type,display_name,protocol_version,public_key,key_fingerprint,
         capabilities,enrollment_digest,enrollment_request_key,status,created_by,created_at,updated_at)
       VALUES ($1,$2,'windows',$3,1,'task-1642-live-demo-fixture-key',$4,
                ARRAY['preflight','prepare','poll','claim','result'],$5,$6,'active','luca-replit-task-1642',$7,$7)`,
      [hostId, id('host-key'), 'Task 1642 Gemini autonomous-driver live-demo fixture host (safe to revoke)',
        digest('fingerprint'), digest('enrollment'), id('enrollment-request'), FIXTURE_HOST_TIMESTAMP],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_identities
       (id,policy_key,display_name,status,created_by)
       VALUES ($1,$2,$3,'active','luca-replit-task-1642')`,
      [identityId, id('policy-key'), 'Task 1642 Gemini autonomous-driver live-demo fixture policy'],
    );
    await client.query(
      `INSERT INTO coordination_v2_policy_versions
       (id,policy_identity_id,version,canonical_policy,policy_digest,approval_state,
        created_by,approved_by,approved_at)
       VALUES ($1,$2,1,$3::jsonb,$4,'approved','luca-replit-task-1642','luca-replit-task-1642',now())`,
      [versionId, identityId, JSON.stringify(policy.canonicalPolicy), policy.policyDigest],
    );
    await client.query(
      `INSERT INTO coordination_v2_operator_grants
       (id,policy_identity_id,operator_actor,actions,issued_by,expires_at,grant_digest,request_key)
       VALUES ($1,$2,$3,ARRAY['launch','resume','terminate','status'],
               'luca-replit-task-1642',now()+interval '1 hour',$4,$5)`,
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
    const { startGeminiProviderWorker, stopGeminiProviderWorker } = await import('../services/coordination-gemini-provider-worker');

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
        taskRef: '1642',
        taskArtifactSha256,
        repositoryIdentity,
        startingCommit: realStartingCommit,
      }),
      resolvePolicy: async () => ({
        policyIdentityId: identityId,
        policyVersionId: versionId,
        operatorGrantId: grantId,
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
      { taskRef: '1642' },
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
        { taskRef: '1642' },
        { actorId, requestKey: launchRequestKey },
        dependencies,
      );
    } catch (error) {
      const cause = lifecycleCause instanceof Error ? `${lifecycleCause.name}: ${lifecycleCause.message}` : String(lifecycleCause);
      throw new Error(`Resume failed at stage=${lifecycleStage} (${cause}); public error: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log('Result:', running);
    if (running.state !== 'running') throw new Error(`Expected state 'running', got ${JSON.stringify(running)}`);

    const initialAttemptRows = await client.query(
      `SELECT id,provider,state,session_ordinal FROM coordination_v2_attempts WHERE session_id=$1`,
      [sessionId],
    );
    if (initialAttemptRows.rowCount !== 1) throw new Error(`Expected exactly 1 attempt row, got ${initialAttemptRows.rowCount}`);
    console.log('Real attempt row created (will be driven autonomously from here, no manual transitions):', initialAttemptRows.rows[0]);
    if (initialAttemptRows.rows[0].provider !== 'gemini') throw new Error(`Expected provider 'gemini', got ${initialAttemptRows.rows[0].provider}`);
    if (initialAttemptRows.rows[0].state !== 'created') throw new Error(`Expected initial attempt state 'created', got ${initialAttemptRows.rows[0].state}`);

    banner('STEP 4: start the autonomous Gemini provider worker -- the SAME production entrypoint server/index.ts calls at boot');
    console.log(
      'From this point on, this script never calls transitionCoordinationAttempt, transitionCoordinationSession\n' +
      "(begin_verification), acceptCoordinationCompletion, applyCoordinationProviderFailure, or\n" +
      "CoordinationGeminiAdapter.turn() directly. Only the worker -- running on its own internal setInterval --\n" +
      'drives the attempt through the provider side of the state machine. This script only plays the HOST role\n' +
      'below: polling/claiming/executing real tools/submitting results, exactly as\n' +
      "verify-gemini-v2-adapter-live.ts's host simulation did for task #1639 (no real Windows host is enrolled in\n" +
      "this environment; see that script's header for the identical scope note).",
    );
    startGeminiProviderWorker(1500, 10);
    stopWorker = stopGeminiProviderWorker;

    banner('STEP 5: host-simulation loop -- poll/claim/execute a real tool/submit a result whenever the autonomous driver reaches waiting_for_host');
    // Raised from 6 to 12 minutes alongside the attempt-budget increase above
    // (4 -> 10): a real run may need several fresh-attempt retries before a
    // natural finish, and each attempt is a real Gemini API call plus the
    // worker's own poll interval, not an instant transition.
    const DEADLINE_MS = Date.now() + 12 * 60_000;
    let roundsExecuted = 0;
    // The real SessionTerminalStatus union (coordination-v2-types.ts) -- 'cancelled' is an
    // ATTEMPT terminal state, never a session one; using it here would be a silent no-op.
    const TERMINAL_SESSION_STATES = new Set(['succeeded', 'failed', 'exhausted', 'expired', 'revoked']);
    let finalSessionState = '';
    let finalSessionTerminalReason: string | null = null;
    for (;;) {
      if (Date.now() > DEADLINE_MS) {
        throw new Error(`Timed out after 6 minutes waiting for the autonomous driver to reach a terminal session state (roundsExecuted so far=${roundsExecuted})`);
      }

      const sessionRow = (await client.query(
        `SELECT state, terminal_reason FROM coordination_v2_sessions WHERE id=$1`, [sessionId],
      )).rows[0] as { state: string; terminal_reason: string | null };
      if (TERMINAL_SESSION_STATES.has(sessionRow.state)) {
        finalSessionState = sessionRow.state;
        finalSessionTerminalReason = sessionRow.terminal_reason;
        console.log(`Session reached terminal state '${sessionRow.state}' (terminalReason=${sessionRow.terminal_reason}) autonomously -- exiting host loop.`);
        break;
      }

      const attemptRow = (await client.query(
        `SELECT id, state FROM coordination_v2_attempts WHERE session_id=$1 ORDER BY session_ordinal DESC LIMIT 1`,
        [sessionId],
      )).rows[0] as { id: string; state: string } | undefined;

      if (attemptRow && attemptRow.state === 'waiting_for_host') {
        const currentAttemptId = attemptRow.id;

        if (!leaseId) {
          const leaseRows = await client.query(
            `SELECT id,epoch,state FROM coordination_v2_transport_leases WHERE session_id=$1 AND state='active'`,
            [sessionId],
          );
          if (leaseRows.rowCount !== 1) throw new Error(`Expected exactly 1 active lease once waiting_for_host, got ${leaseRows.rowCount}`);
          leaseId = leaseRows.rows[0].id as string;
          leaseEpoch = Number(leaseRows.rows[0].epoch);
          console.log('Lease (read once, persists across rounds and across any fallback attempt):', leaseRows.rows[0]);
        }

        const operationDigest = digestCanonical({ policyVersionId: versionId, sessionId, attemptId: currentAttemptId, operation: 'execute' });
        const protocolBinding = {
          policyVersionId: versionId, sessionId, attemptId: currentAttemptId, enrolledHostId: hostId,
          transportLeaseId: leaseId, leaseEpoch, holderInstanceId, operation: 'execute', operationDigest,
        };
        const transportInput = {
          sessionId, enrolledHostId: hostId, holderInstanceId, actorId,
          leaseId, epoch: leaseEpoch, protocolBinding, authorizedOperation: 'execute',
        };

        // Learn which tool+callId to run from the authenticated poll response
        // itself (pendingIntent), never from a direct read of attempt-event
        // metadata -- this is the exact host-facing channel
        // coordination-transport-lease-service.ts's pendingToolIntent adds,
        // so this script's host role is now driven purely through the same
        // poll/claim/result protocol a real enrolled host would use.
        const polled = await leaseService.pollCoordinationTransportWork({ ...transportInput, requestKey: id(`host-poll-${roundsExecuted + 1}`) }) as {
          operation: string; attempt: { id: string; state: string; pendingIntent: { callId: string; name: string } | null } | null;
        };
        console.log('Poll operation:', polled.operation, 'pendingIntent:', polled.attempt?.pendingIntent);
        if (!polled.attempt || polled.attempt.id !== currentAttemptId || !polled.attempt.pendingIntent) {
          throw new Error(`poll did not surface a pendingIntent for attempt ${currentAttemptId} while it is waiting_for_host: ${JSON.stringify(polled.attempt)}`);
        }
        const { callId, name: toolName } = polled.attempt.pendingIntent;

        banner(`STEP 5.${roundsExecuted + 1}: autonomous driver posted an intent (tool=${toolName}, callId=${callId}), learned via the real poll protocol -- playing host role now`);

        const hostClaim = await leaseService.claimCoordinationTransportWork({ ...transportInput, attemptId: currentAttemptId, requestKey: id(`host-claim-${roundsExecuted + 1}`) }) as {
          operation: string; claimId: string; state: string; pendingIntent: { callId: string; name: string } | null;
        };
        console.log('Claim:', hostClaim.operation, hostClaim.state, 'pendingIntent:', hostClaim.pendingIntent);
        if (hostClaim.state !== 'host_active') throw new Error(`Expected 'host_active', got ${hostClaim.state}`);
        if (hostClaim.pendingIntent?.callId !== callId || hostClaim.pendingIntent?.name !== toolName) {
          throw new Error(`claim's pendingIntent (${JSON.stringify(hostClaim.pendingIntent)}) did not match poll's (${callId}/${toolName})`);
        }

        banner(`STEP 5.${roundsExecuted + 1}b: SIMULATED host work -- executing the real tool '${toolName}' locally (see header scope note)`);
        const { output, outputDigest } = realToolExecution(toolName);
        console.log(`Real ${toolName} output:\n` + output);

        const hostResult = await leaseService.resultCoordinationTransportWork({
          ...transportInput, attemptId: currentAttemptId, claimId: hostClaim.claimId, requestKey: id(`host-result-${roundsExecuted + 1}`),
          result: {
            accepted: true,
            outputDigest,
            // callId/name/toolResult is the driverContext-echo convention
            // coordination-gemini-provider-driver.ts's resolveTurnInput
            // expects (see its "Host-result protocol convention" note).
            callId,
            name: toolName,
            toolResult: { exitCode: 0, stdoutDigest: outputDigest, stdoutPreview: output.slice(0, 500) },
          },
        }) as { operation: string; state: string; resultId: string; resultDigest: string };
        console.log('Result:', hostResult.operation, hostResult.state);
        if (hostResult.state !== 'result_ready') throw new Error(`Expected 'result_ready', got ${hostResult.state}`);
        roundsExecuted += 1;
        continue;
      }

      await sleep(750);
    }

    banner('STEP 6: verify the session reached a real, successful terminal state with zero manual step-calling by this script');
    if (finalSessionState !== 'succeeded') {
      const attemptHistory = await client.query(
        `SELECT id, session_ordinal, state, failure_classification, result_code FROM coordination_v2_attempts WHERE session_id=$1 ORDER BY session_ordinal`,
        [sessionId],
      );
      throw new Error(
        `Autonomous driver did not reach a successful completion: session state=${finalSessionState} ` +
        `terminalReason=${finalSessionTerminalReason}. Attempt history: ${JSON.stringify(attemptHistory.rows)}`,
      );
    }
    console.log(`Session reached 'succeeded' autonomously after ${roundsExecuted} real host round(s), with this script never calling a provider-side transition directly.`);

    banner('STEP 7: cleanup obligations (start -> acknowledge) for each of the 4 -- host-side responsibility, separate from the provider driver');
    const obligationRows = await client.query(
      `SELECT id, kind FROM coordination_v2_cleanup_obligations WHERE session_id=$1`,
      [sessionId],
    );
    if (obligationRows.rowCount !== 4) throw new Error(`Expected 4 cleanup obligations, got ${obligationRows.rowCount}`);
    for (const obligation of obligationRows.rows as Array<{ id: string; kind: string }>) {
      const started = await cleanupService.transitionCoordinationCleanup({
        obligationId: obligation.id, requestKey: id(`cleanup-start-${obligation.kind}`), actorId,
        command: { type: 'start' },
      });
      const ack = await leaseService.acknowledgeCoordinationCleanup({
        sessionId, enrolledHostId: hostId, holderInstanceId, actorId,
        leaseId, epoch: leaseEpoch, obligationId: obligation.id,
        requestKey: id(`cleanup-ack-${obligation.kind}`),
        evidence: { acknowledged: true, kind: obligation.kind },
      }) as { outcome: string };
      console.log(`  ${obligation.kind}: start=${started.state} ack=${ack.outcome}`);
    }

    banner('STEP 8: final direct-SQL verification of persisted rows');
    const evidence = await client.query(
      `SELECT
         s.state, s.terminal_reason,
         (SELECT provider FROM coordination_v2_attempts WHERE session_id=$1 ORDER BY session_ordinal DESC LIMIT 1) AS latest_attempt_provider,
         (SELECT state FROM coordination_v2_attempts WHERE session_id=$1 ORDER BY session_ordinal DESC LIMIT 1) AS latest_attempt_state,
         (SELECT count(*)::int FROM coordination_v2_attempts WHERE session_id=$1) AS total_attempts,
         (SELECT state FROM coordination_v2_transport_leases WHERE id=$2) AS lease_state,
         (SELECT count(*)::int FROM coordination_v2_cleanup_obligations WHERE session_id=$1 AND state='acknowledged') AS acknowledged_cleanup,
         (SELECT count(*)::int FROM coordination_v2_transport_work_claims WHERE session_id=$1) AS host_claims,
         (SELECT count(*)::int FROM coordination_v2_transport_work_results WHERE session_id=$1) AS host_results,
         (SELECT count(*)::int FROM coordination_v2_session_events WHERE session_id=$1 AND event_type='completion_accepted') AS completions
       FROM coordination_v2_sessions s WHERE s.id=$1`,
      [sessionId, leaseId],
    );
    console.log(evidence.rows[0]);
    const row = evidence.rows[0];
    const ok = row.state === 'succeeded' && row.latest_attempt_provider === 'gemini' && row.latest_attempt_state === 'completed'
      && row.lease_state === 'released' && row.acknowledged_cleanup === 4 && row.host_claims === roundsExecuted
      && row.host_results === roundsExecuted && row.completions === 1;
    if (!ok) throw new Error(`Final evidence row did not match expected shape: ${JSON.stringify(row)} (roundsExecuted=${roundsExecuted})`);

    console.log('\n*** SUCCESS: the autonomous Gemini provider driver + worker completed one real Coordinator V2 task end to end. ***');
    console.log('This script never called transitionCoordinationAttempt, transitionCoordinationSession(begin_verification),');
    console.log('acceptCoordinationCompletion, applyCoordinationProviderFailure, or CoordinationGeminiAdapter.turn() directly --');
    console.log('only startGeminiProviderWorker() (the production boot-time entrypoint) drove the provider side.');
    console.log(`Session id: ${sessionId}`);
    console.log(`Real tool-call rounds executed by the simulated host: ${roundsExecuted}`);
    console.log(`Total attempts created by the autonomous system (including any fallback retries): ${row.total_attempts}`);
  } finally {
    await revokeFixtures('normal-finally');
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

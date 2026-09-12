import type { Response, Request } from 'express';
import { getSharedDb } from '../db';
import {
  CoordinationRuntimeService,
  RuntimeProtocolError,
  type CoordinationRuntimeRepository,
  type RuntimePrincipal,
  type Assignment,
  type CodingRuntimeProfile,
  type AttestedLocalState,
  type ExecutionEnvelope,
  type Gate3ExecutionEnvelope,
  type NormalizedToolResult,
  digestCanonical,
} from '../services/coordination-runtime';
import { PostgresCoordinationRuntimeRepository } from '../services/coordination-runtime-postgres-repository';
import {
  CoordinationGeminiAdapter,
  CoordinationGeminiCoordinator,
  type GeminiTransport,
} from '../services/coordination-gemini-adapter';
import {
  resolveBrokerCredential,
  type BrokerCredential,
} from '../services/coordination-credential-broker';
import type { Application as ExpressApplication } from 'express';
import { validateGate3ProofGrant, validateGate3ProofGrantForVerifier, withGate3ProofGrantAuthority, withGate3VerifierGrantAuthority } from '../services/coordination-gate3-proof-grant-service';

export type CoordinationRuntimeRouteDeps = {
  repository?: CoordinationRuntimeRepository;
  service?: CoordinationRuntimeService;
  coordinator?: CoordinationGeminiCoordinator;
  adapter?: CoordinationGeminiAdapter;
  resolveCredential?: (token: string, sourceIp?: string) => Promise<BrokerCredential | null>;
  transport?: GeminiTransport;
  apiKey?: string;
  baseUrl?: string;
  now?: () => number;
  validateGrant?: typeof validateGate3ProofGrant;
  validateVerifierGrant?: typeof validateGate3ProofGrantForVerifier;
  withGrantAuthority?: typeof withGate3ProofGrantAuthority;
  withVerifierAuthority?: typeof withGate3VerifierGrantAuthority;
};

const model = 'gemini-3-flash-preview';
const adapterVersion = 'coordination-gemini-v1';
const LEGACY_ANTIGRAVITY_RUNTIME_ID = 'luca-gemini-antigravity-primary';
const GENERATION_RUNTIME_ID = /^luca-gemini-antigravity-[0-9a-f]{24}$/;
const isAntigravityCandidate = (principal: RuntimePrincipal, profile: CodingRuntimeProfile): boolean =>
  principal.actor === 'luca-gemini'
  && (
    principal.runtimeRegistrationId === LEGACY_ANTIGRAVITY_RUNTIME_ID
    || GENERATION_RUNTIME_ID.test(principal.runtimeRegistrationId)
    || profile.id.startsWith('antigravity-')
  );

function token(req: Request): string | undefined {
  const header = req.headers['x-coordination-token'];
  if (typeof header === 'string') return header;
  const authorization = req.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
}

function key(req: Request): string {
  const value = req.headers['idempotency-key'];
  if (typeof value !== 'string' || !value.trim()) throw new RuntimeProtocolError('invalid_request', 'Idempotency-Key is required');
  return value;
}

function bodyObject(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new RuntimeProtocolError('invalid_request', 'JSON object body is required');
  }
  return req.body as Record<string, unknown>;
}

function stringField(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new RuntimeProtocolError('invalid_request', `${name} is required`);
  return value;
}

function numberField(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new RuntimeProtocolError('invalid_request', `${name} is invalid`);
  return value;
}

function attestedState(value: unknown, profile: CodingRuntimeProfile): AttestedLocalState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeProtocolError('invalid_request', 'attestedLocalState is required');
  }
  const state = value as Record<string, unknown>;
  const text = (name: string): string => stringField(state[name], name);
  const startingCommit = text('startingCommit');
  if (!profile.startingCommit || startingCommit !== profile.startingCommit) {
    throw new RuntimeProtocolError('execution_envelope_mismatch', 'Starting commit does not match profile');
  }
  const resultingHead = text('resultingHead');
  if (resultingHead !== startingCommit) throw new RuntimeProtocolError('execution_envelope_mismatch', 'Resulting HEAD changed');
  const changedPaths = state.changedPaths;
  if (!Array.isArray(changedPaths) || changedPaths.length !== 1 ||
      changedPaths.some((path) => path !== 'server/scripts/test-coordination-runtime.test.ts')) {
    throw new RuntimeProtocolError('path_not_allowed', 'Changed path is outside the proof target');
  }
  const patchDigest = state.patchDigest;
  if (typeof patchDigest !== 'string' || !/^[0-9a-f]{64}$/.test(patchDigest)) {
    throw new RuntimeProtocolError('invalid_request', 'patchDigest is invalid');
  }
  const commands = state.commandResults;
  if (!Array.isArray(commands) || commands.length < 3) throw new RuntimeProtocolError('invalid_request', 'commandResults are invalid');
  const allowed = new Set([
    'git rev-parse --show-toplevel',
    'git rev-parse --abbrev-ref HEAD',
    'git rev-parse HEAD',
    'git status --short',
    'git diff -- server/scripts/test-coordination-runtime.test.ts',
    'npx tsx server/scripts/test-coordination-runtime.test.ts',
  ]);
  const digest = (value: unknown, name: string): string => {
    const result = stringField(value, name);
    if (!/^[0-9a-f]{64}$/.test(result)) throw new RuntimeProtocolError('invalid_request', `${name} is invalid`);
    return result;
  };
  const commandResults = commands.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new RuntimeProtocolError('invalid_request', 'command result is invalid');
    const item = entry as Record<string, unknown>;
    if (!Array.isArray(item.argv) || item.argv.some((part) => typeof part !== 'string')) throw new RuntimeProtocolError('invalid_request', 'argv is invalid');
    if (!allowed.has(item.argv.join(' '))) throw new RuntimeProtocolError('command_not_allowed', 'Command is outside the proof envelope');
    if (typeof item.exitCode !== 'number' || !Number.isInteger(item.exitCode) || item.exitCode !== 0) throw new RuntimeProtocolError('invalid_request', 'exitCode is invalid');
    return { argv: item.argv as string[], exitCode: item.exitCode, stdoutDigest: digest(item.stdoutDigest, 'stdoutDigest'), stderrDigest: digest(item.stderrDigest, 'stderrDigest'), truncated: item.truncated === true };
  });
  const elapsedMs = numberField(state.elapsedMs, 'elapsedMs');
  const modelTurns = numberField(state.modelTurns, 'modelTurns');
  const apiAttempts = numberField(state.apiAttempts, 'apiAttempts');
  if (elapsedMs > 600_000 || modelTurns > 4 || apiAttempts > 8) throw new RuntimeProtocolError('output_limit_exceeded', 'Attested execution exceeds bounds');
  const commandKeys = commandResults.map((command) => command.argv.join(' '));
  if (!commandKeys.includes('git status --short') || !commandKeys.includes('git diff -- server/scripts/test-coordination-runtime.test.ts') ||
      !commandKeys.includes('npx tsx server/scripts/test-coordination-runtime.test.ts')) {
    throw new RuntimeProtocolError('command_not_allowed', 'Required commands are missing');
  }
  return { startingCommit, resultingHead, changedPaths: changedPaths as string[], patchDigest, commandResults, elapsedMs, modelTurns, apiAttempts };
}

function statusFor(code: string): number {
  if (['authentication_required', 'credential_expired', 'runtime_revoked'].includes(code)) return 401;
  if (['invalid_request', 'malformed_function_call', 'unsupported_provider_outcome'].includes(code)) return 400;
  if (['claim_active_conflict', 'claim_epoch_stale', 'claim_expired', 'claim_not_active', 'claim_not_owned', 'consumption_conflict', 'fresh_consumption_required', 'thread_sequence_stale', 'stale_epoch', 'idempotency_payload_mismatch', 'execution_already_recorded', 'execution_violated'].includes(code)) return 409;
  if (['capability_required', 'actor_mismatch', 'profile_not_found', 'profile_not_active', 'verifier_not_allowed', 'self_verification_denied', 'assigner_verification_denied', 'gate3_proof_grant_invalid'].includes(code)) return 403;
  if (['packet_not_found', 'claim_not_found', 'completion_mismatch'].includes(code)) return 404;
  return 500;
}

function publicError(res: Response, error: unknown): void {
  if (error instanceof RuntimeProtocolError) {
    res.status(statusFor(error.code)).json({ error: error.code });
  } else {
    res.status(500).json({ error: 'internal_error' });
  }
}

async function authenticated(
  req: Request,
  deps: Required<Pick<CoordinationRuntimeRouteDeps, 'resolveCredential' | 'repository'>>,
  brokerCapability: string,
  profileCapability: string,
): Promise<{ principal: RuntimePrincipal; profile: CodingRuntimeProfile; credential: BrokerCredential }> {
  const supplied = token(req);
  if (!supplied) throw new RuntimeProtocolError('authentication_required', 'Broker credential required');
  const credential = await deps.resolveCredential(supplied, req.ip || req.socket.remoteAddress);
  // Deliberately do not use requireCoordinationAuth: its legacy compatibility
  // token path is not valid authentication for this runtime protocol.
  if (!credential) throw new RuntimeProtocolError('authentication_required', 'Broker credential required');
  if (!credential.capabilities.includes(brokerCapability as never)) {
    throw new RuntimeProtocolError('capability_required', 'Credential lacks required capability');
  }
  const profile = await deps.repository.getActiveProfile(credential.runtimeId);
  if (!profile) throw new RuntimeProtocolError('profile_not_found', 'Active runtime profile not found');
  if (profile.status !== 'active' || profile.runtimeRegistrationId !== credential.runtimeId) {
    throw new RuntimeProtocolError('profile_not_active', 'Runtime profile is not active');
  }
  if (profile.actor !== credential.actor) throw new RuntimeProtocolError('actor_mismatch', 'Profile actor mismatch');
  if (profile.provider !== 'gemini' || profile.model !== model || profile.adapterVersion !== adapterVersion) {
    throw new RuntimeProtocolError('profile_not_active', 'Runtime profile is not approved for this adapter');
  }
  if (!profile.capabilities.includes(profileCapability)) {
    throw new RuntimeProtocolError('capability_required', 'Profile lacks required capability');
  }
  const principal: RuntimePrincipal = {
    actor: credential.actor as RuntimePrincipal['actor'],
    runtimeRegistrationId: credential.runtimeId,
    credentialId: credential.credentialId,
    profileId: profile.id,
    capabilities: profile.capabilities,
    credentialExpiresAt: credential.expiresAt.getTime(),
    runtimeEnabled: true,
    revoked: false,
  };
  (req as Request & { coordinationCredential?: BrokerCredential; gate3GrantValidator?: typeof validateGate3ProofGrant }).coordinationCredential = credential;
  return { principal, profile, credential };
}

type Gate3Grant = Awaited<ReturnType<typeof validateGate3ProofGrant>>;

function assertGate3PacketBinding(
  packet: NonNullable<Awaited<ReturnType<CoordinationRuntimeRepository['getPacket']>>>,
  grant: Gate3Grant,
): void {
  const envelope = packet.envelope;
  if (
    !/^luca-gemini-antigravity-[0-9a-f]{24}$/.test(grant.runtimeRegistrationId)
    || grant.profileId !== `antigravity-${grant.contextDigest}`
    || grant.actor !== 'luca-gemini'
    || grant.taskRef !== '1448'
    || packet.assignment.taskId !== grant.taskRef
    || envelope.grantId !== grant.grantId
    || envelope.taskRef !== grant.taskRef
    || envelope.artifactSha256 !== grant.artifactSha256
    || envelope.contextDigest !== grant.contextDigest
    || envelope.startingCommit !== grant.startingCommit
    || packet.runtimeRegistrationId !== grant.runtimeRegistrationId
    || packet.profileId !== grant.profileId
  ) {
    throw new Error('gate3_packet_binding_mismatch');
  }
}

async function withGate3Operation<T>(
  req: Request,
  principal: RuntimePrincipal,
  profile: CodingRuntimeProfile,
  credential: BrokerCredential,
  authority: typeof withGate3ProofGrantAuthority,
  packet?: Awaited<ReturnType<CoordinationRuntimeRepository['getPacket']>>,
  operation?: (grant: Gate3Grant | undefined) => Promise<T>,
): Promise<T> {
  if (!operation) throw new Error('gate3_operation_missing');
  if (!isAntigravityCandidate(principal, profile)) {
    return operation(undefined);
  }
  const header = req.headers['x-coordination-ownership-grant'];
  if (typeof header !== 'string' || !header) throw new RuntimeProtocolError('gate3_proof_grant_invalid', 'Ownership grant is required');
  let operationStarted = false;
  try {
    return await authority(header, credential, async (grant) => {
      if (
        grant.credentialId !== principal.credentialId
        || grant.runtimeRegistrationId !== principal.runtimeRegistrationId
        || grant.profileId !== profile.id
        || grant.profileId !== `antigravity-${grant.contextDigest}`
        || grant.taskRef !== '1448'
        || grant.actor !== principal.actor
      ) {
        throw new Error('gate3_principal_binding_mismatch');
      }
      if (packet) assertGate3PacketBinding(packet, grant);
      operationStarted = true;
      return operation(grant);
    });
  } catch (error) {
    if (operationStarted) throw error;
    throw new RuntimeProtocolError('gate3_proof_grant_invalid', 'Ownership grant is invalid');
  }
}

export function registerCoordinationRuntimeRoutes(
  app: ExpressApplication,
  input: CoordinationRuntimeRouteDeps = {},
): void {
  const repository = input.repository ?? new PostgresCoordinationRuntimeRepository(getSharedDb());
  const service = input.service ?? new CoordinationRuntimeService(repository, input.now);
  const adapter = input.adapter ?? new CoordinationGeminiAdapter(
    input.transport ?? (async (request) => {
      const response = await fetch(request.url, { method: 'POST', headers: request.headers, body: request.body, signal: request.signal });
      return { status: response.status, body: await response.text() };
    }),
    input.apiKey,
    input.baseUrl,
  );
  const coordinator = input.coordinator ?? new CoordinationGeminiCoordinator(service, repository, adapter);
  const deps = {
    repository,
    resolveCredential: input.resolveCredential ?? resolveBrokerCredential,
    validateGrant: input.validateGrant,
    validateVerifierGrant: input.validateVerifierGrant ?? validateGate3ProofGrantForVerifier,
    withGrantAuthority: input.withGrantAuthority ?? (
      input.validateGrant
        ? async <T>(grantId: string, credential: BrokerCredential | undefined, operation: (grant: Gate3Grant) => Promise<T>) =>
          operation(await input.validateGrant!(grantId, credential))
        : async <T>(grantId: string, credential: BrokerCredential | undefined, operation: (grant: Gate3Grant) => Promise<T>) =>
          withGate3ProofGrantAuthority(
            grantId,
            credential,
            operation,
            repository instanceof PostgresCoordinationRuntimeRepository
              ? (transactionOperation) => repository.withTransactionExecutor(transactionOperation)
              : undefined,
          )
    ),
    withVerifierAuthority: input.withVerifierAuthority ?? (
      input.validateVerifierGrant
        ? async <T>(grantId: string, operation: (grant: Gate3Grant) => Promise<T>) =>
          operation(await input.validateVerifierGrant!(grantId))
        : withGate3VerifierGrantAuthority
    ),
  };
  const route = (handler: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      res.json(await handler(req));
    } catch (error) { publicError(res, error); }
  };

  app.post('/api/coordination/runtime/packets', route(async (req) => {
    const { principal, profile, credential } = await authenticated(req, deps, 'coordination:write', 'execute');
    if (principal.actor !== 'luca-gemini') throw new RuntimeProtocolError('actor_mismatch', 'Gemini actor required');
    if (!profile.worktreeRealpathDigest || !/^[0-9a-f]{64}$/.test(profile.worktreeRealpathDigest) ||
        !profile.branch || !profile.startingCommit || !profile.worktreeLabel) {
      throw new RuntimeProtocolError('execution_envelope_mismatch', 'Active profile lacks complete Gate 3 metadata');
    }
    const worktreeRealpathDigest = profile.worktreeRealpathDigest;
    const branch = profile.branch;
    const startingCommit = profile.startingCommit;
    const worktreeLabel = profile.worktreeLabel;
    const body = bodyObject(req);
    const windowId = stringField(body.windowId, 'windowId');
    const frozen = await repository.validateWindow(windowId);
    const selector = body.assignmentEventId;
    const assignmentItem = frozen.items.find((item) =>
      (selector === undefined || item.eventId === selector) &&
      Boolean((item.payload.content as Record<string, unknown>).assignment),
    );
    if (!assignmentItem) throw new RuntimeProtocolError('packet_assignment_mismatch', 'Canonical assignment is missing');
    const content = assignmentItem.payload.content as Record<string, unknown>;
    const raw = content.assignment;
    const a = raw && typeof raw === 'object' ? raw as Record<string, unknown> : content;
    const author = a.assignmentAuthor ?? a.author ?? content.assignmentAuthor;
    if (typeof author !== 'string') throw new RuntimeProtocolError('packet_assignment_mismatch', 'Canonical assignment author is missing');
    const taskId = a.taskId ?? a.task;
    const threadId = a.threadId ?? assignmentItem.threadId;
    const expectedSequence = a.expectedSequence ?? assignmentItem.sequence;
    const assignment: Assignment = {
      assignmentEventId: assignmentItem.eventId,
      assignmentAuthor: author as Assignment['assignmentAuthor'],
      taskId: stringField(taskId, 'taskId'),
      threadId: stringField(threadId, 'threadId'),
      expectedSequence: numberField(expectedSequence, 'expectedSequence'),
    };
    if (isAntigravityCandidate(principal, profile) && assignment.taskId !== '1448') {
      throw new RuntimeProtocolError('packet_assignment_mismatch', 'Gate 3 task assignment is invalid');
    }
    return withGate3Operation(req, principal, profile, credential, deps.withGrantAuthority, undefined, async (grant) => {
      const envelope: Gate3ExecutionEnvelope = {
        worktreeLabel,
        worktreePath: `approved:${worktreeRealpathDigest}`,
        argv: ['npx', 'tsx', 'server/scripts/test-coordination-runtime.test.ts'],
        patchDigest: null,
        repositoryLabel: 'HolaHola',
        worktreeRealpathDigest,
        branch,
        startingCommit,
        targetPath: 'server/scripts/test-coordination-runtime.test.ts',
        maxChangedFiles: 1,
        maxPatchBytes: 40960,
        maxElapsedMs: 600000,
        maxModelTurns: 4,
        maxApiAttempts: 8,
        ...(grant ? { grantId: grant.grantId, taskRef: grant.taskRef, artifactSha256: grant.artifactSha256, contextDigest: grant.contextDigest } : {}),
      };
      return service.createGate3Packet(principal, windowId, assignment, key(req), envelope);
    });
  }));

  app.post('/api/coordination/runtime/packets/:packetId/initial-turn', route(async (req) => {
    const { principal, profile, credential } = await authenticated(req, deps, 'coordination:write', 'model');
    const packet = await repository.getPacket(req.params.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    return withGate3Operation(req, principal, profile, credential, deps.withGrantAuthority, packet, async () => {
      const result = await coordinator.initialTurn(principal, req.params.packetId, key(req));
      return { ...result, interactions: result.interactions.map((item) => ({ ...item, intents: [] })) };
    });
  }));

  app.post('/api/coordination/runtime/packets/:packetId/receipt', route(async (req) => {
    const { principal, profile, credential } = await authenticated(req, deps, 'coordination:write', 'model');
    const body = bodyObject(req);
    const packet = await repository.getPacket(req.params.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    return withGate3Operation(req, principal, profile, credential, deps.withGrantAuthority, packet, async () =>
      service.recordOutcomeReceipt(principal, packet.id,
        stringField(body.packetDigest, 'packetDigest'),
        stringField(body.interactionId, 'interactionId'), key(req)));
  }));

  app.post('/api/coordination/runtime/packets/:packetId/claim', route(async (req) => {
    const { principal, profile, credential } = await authenticated(req, deps, 'coordination:write', 'execute');
    const body = bodyObject(req);
    const packet = await repository.getPacket(req.params.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    return withGate3Operation(req, principal, profile, credential, deps.withGrantAuthority, packet, async () =>
      service.claim(principal, packet.id, packet.digest, stringField(body.receiptId, 'receiptId'),
        300_000, key(req)));
  }));

  app.get('/api/coordination/runtime/claims/:claimId/intents', route(async (req) => {
    const { principal, profile, credential } = await authenticated(req, deps, 'coordination:read', 'execute');
    const claim = await repository.getClaim(req.params.claimId);
    if (!claim) throw new RuntimeProtocolError('claim_not_found', 'Claim not found');
    const packet = await repository.getPacket(claim.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    return withGate3Operation(req, principal, profile, credential, deps.withGrantAuthority, packet, async () => {
      const intents = await coordinator.revealIntents(principal, claim.packetId, claim.id);
      return { intents: intents.map((intent) => ({ ...intent, validatedIntentDigest: digestCanonical(intent) })), epoch: claim.epoch };
    });
  }));

  app.post('/api/coordination/runtime/claims/:claimId/renew', route(async (req) => {
    const { principal, profile, credential } = await authenticated(req, deps, 'coordination:write', 'execute');
    const body = bodyObject(req);
    const claim = await repository.getClaim(req.params.claimId);
    if (!claim) throw new RuntimeProtocolError('claim_not_found', 'Claim not found');
    const packet = await repository.getPacket(claim.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    return withGate3Operation(req, principal, profile, credential, deps.withGrantAuthority, packet, async () =>
      service.renew(principal, req.params.claimId, numberField(body.epoch, 'epoch'), 300_000, key(req)));
  }));

  app.post('/api/coordination/runtime/claims/:claimId/continuation', route(async (req) => {
    const { principal, profile, credential } = await authenticated(req, deps, 'coordination:write', 'model');
    const body = bodyObject(req);
    const claim = await repository.getClaim(req.params.claimId);
    if (!claim) throw new RuntimeProtocolError('claim_not_found', 'Claim not found');
    const packet = await repository.getPacket(claim.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    if (numberField(body.epoch, 'epoch') !== claim.epoch) {
      throw new RuntimeProtocolError('claim_epoch_stale', 'Claim epoch is stale');
    }
    const rawResults = Array.isArray(body.toolResults) ? body.toolResults : [];
    const results = rawResults.map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new RuntimeProtocolError('invalid_request', 'Tool result must be an object');
      }
      const item = value as Record<string, unknown>;
      const normalized: NormalizedToolResult = {
        interactionId: stringField(item.interactionId, 'interactionId'),
        callId: stringField(item.callId, 'callId'),
        toolName: stringField(item.toolName ?? item.name, 'toolName'),
        validatedIntentDigest: stringField(item.validatedIntentDigest ?? item.intentDigest, 'validatedIntentDigest'),
        outcome: item.outcome === 'rejected' ? 'rejected' as const : 'succeeded' as const,
        payload: (item.payload ?? item.output) as NormalizedToolResult['payload'],
      };
      return normalized;
    });
    const continuation = await withGate3Operation(req, principal, profile, credential, deps.withGrantAuthority, packet, async () => {
      const storedResults = await service.appendToolResultBatch(principal, claim.id, claim.epoch, results[0]?.interactionId ?? '', results, `${key(req)}:results`);
      if (storedResults.some((result) => result.outcome === 'rejected')) {
        throw new RuntimeProtocolError('execution_violated', 'Rejected local tool result violated the claim');
      }
      let attempts;
      try {
        attempts = await coordinator.continuationTurn(principal, claim.id, claim.packetId, numberField(body.turn, 'turn'), [], key(req));
      } catch (error) {
        if (
          error instanceof RuntimeProtocolError &&
          (error.code === 'malformed_function_call' || error.code === 'model_call_limit_exceeded')
        ) {
          return { ok: false as const, error };
        }
        throw error;
      }
      const persisted = (await repository.interactionsForPacket(claim.packetId))
        .filter((item: { turn: number }) => item.turn === numberField(body.turn, 'turn'))
        .sort((left: { attempt: number }, right: { attempt: number }) => left.attempt - right.attempt);
      return { ok: true as const, value: attempts.map((attempt, index) => ({ ...attempt, interactionId: persisted[index]?.id })) };
    });
    if (!continuation.ok) throw continuation.error;
    return continuation.value;
  }));

  app.post('/api/coordination/runtime/claims/:claimId/execute', route(async (req) => {
    const { principal, profile, credential } = await authenticated(req, deps, 'coordination:write', 'execute');
    const claim = await repository.getClaim(req.params.claimId);
    if (!claim) throw new RuntimeProtocolError('claim_not_found', 'Claim not found');
    const packet = await repository.getPacket(claim.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    const attested = attestedState(bodyObject(req).attestedLocalState, profile);
    return withGate3Operation(req, principal, profile, credential, deps.withGrantAuthority, packet, async () => {
      const persistedAttempts = (await repository.interactionsForPacket(packet.id)).length;
      if (attested.apiAttempts !== persistedAttempts || attested.modelTurns < 1) {
        throw new RuntimeProtocolError('consumption_conflict', 'Attestation does not match persisted model evidence');
      }
      return service.execute(principal, claim.id, packet.envelope, key(req), attested);
    });
  }));

  app.post('/api/coordination/runtime/executions/:executionId/complete', route(async (req) => {
    const { principal, profile, credential } = await authenticated(req, deps, 'coordination:write', 'execute');
    const execution = await repository.getExecution(req.params.executionId);
    if (!execution) throw new RuntimeProtocolError('completion_mismatch', 'Execution not found');
    const claim = await repository.getClaim(execution.claimId);
    const packet = claim && await repository.getPacket(claim.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    return withGate3Operation(req, principal, profile, credential, deps.withGrantAuthority, packet, async () =>
      service.complete(principal, execution.id, digestCanonical(execution), key(req)));
  }));

  app.post('/api/coordination/runtime/completions/:completionId/verify', route(async (req) => {
    const { principal, profile } = await authenticated(req, deps, 'coordination:write', 'verify');
    const body = bodyObject(req);
    const completion = await repository.getCompletion(req.params.completionId);
    if (!completion) throw new RuntimeProtocolError('completion_mismatch', 'Completion not found');
    const execution = await repository.getExecution(completion.executionId);
    const claim = execution && await repository.getClaim(execution.claimId);
    const packet = claim && await repository.getPacket(claim.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    // The verifier is a different principal, so classify from the packet
    // bindings; authority still comes only from the exact grant chain below.
    const isGate3Packet = packet.runtimeRegistrationId === LEGACY_ANTIGRAVITY_RUNTIME_ID
      || GENERATION_RUNTIME_ID.test(packet.runtimeRegistrationId)
      || packet.profileId.startsWith('antigravity-');
    if (isGate3Packet) {
      const envelope = packet.envelope;
      if (
        typeof envelope.grantId !== 'string'
        || typeof envelope.taskRef !== 'string'
        || typeof envelope.artifactSha256 !== 'string'
        || typeof envelope.contextDigest !== 'string'
        || typeof envelope.startingCommit !== 'string'
      ) {
        throw new RuntimeProtocolError('gate3_proof_grant_invalid', 'Ownership grant is invalid');
      }
      const header = req.headers['x-coordination-ownership-grant'];
      if (typeof header !== 'string' || header !== envelope.grantId) {
        throw new RuntimeProtocolError('gate3_proof_grant_invalid', 'Ownership grant is invalid');
      }
      let operationStarted = false;
      try {
        return await deps.withVerifierAuthority(envelope.grantId, async (grant) => {
          assertGate3PacketBinding(packet, grant);
          operationStarted = true;
          const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
          return service.verify(principal, completion.id, completion.evidenceDigest,
            body.patchDigest === null ? null : String(body.patchDigest), key(req), decision,
            typeof body.rationale === 'string' ? body.rationale : undefined, body.rerunEvidence);
        });
      } catch (error) {
        if (operationStarted) throw error;
        throw new RuntimeProtocolError('gate3_proof_grant_invalid', 'Ownership grant is invalid');
      }
    }
    const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
    return service.verify(principal, completion.id, completion.evidenceDigest,
      body.patchDigest === null ? null : String(body.patchDigest), key(req), decision,
       typeof body.rationale === 'string' ? body.rationale : undefined, body.rerunEvidence);
  }));
}
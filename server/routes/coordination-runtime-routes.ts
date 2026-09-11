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

export type CoordinationRuntimeRouteDeps = {
  repository?: CoordinationRuntimeRepository;
  service?: CoordinationRuntimeService;
  coordinator?: CoordinationGeminiCoordinator;
  adapter?: CoordinationGeminiAdapter;
  resolveCredential?: (token: string, sourceIp?: string) => Promise<BrokerCredential | null>;
  transport?: GeminiTransport;
  apiKey?: string;
  now?: () => number;
};

const model = 'gemini-3-flash-preview';
const adapterVersion = 'coordination-gemini-v1';

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
  if (['capability_required', 'actor_mismatch', 'profile_not_found', 'profile_not_active', 'verifier_not_allowed', 'self_verification_denied', 'assigner_verification_denied'].includes(code)) return 403;
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
): Promise<{ principal: RuntimePrincipal; profile: CodingRuntimeProfile }> {
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
  return { principal, profile };
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
  );
  const coordinator = input.coordinator ?? new CoordinationGeminiCoordinator(service, repository, adapter);
  const deps = {
    repository,
    resolveCredential: input.resolveCredential ?? resolveBrokerCredential,
  };
  const route = (handler: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
    try { res.json(await handler(req)); } catch (error) { publicError(res, error); }
  };

  app.post('/api/coordination/runtime/packets', route(async (req) => {
    const { principal, profile } = await authenticated(req, deps, 'coordination:write', 'execute');
    if (principal.actor !== 'luca-gemini') throw new RuntimeProtocolError('actor_mismatch', 'Gemini actor required');
    if (!profile.worktreeRealpathDigest || !/^[0-9a-f]{64}$/.test(profile.worktreeRealpathDigest) ||
        !profile.branch || !profile.startingCommit || !profile.worktreeLabel) {
      throw new RuntimeProtocolError('execution_envelope_mismatch', 'Active profile lacks complete Gate 3 metadata');
    }
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
    const envelope: Gate3ExecutionEnvelope = {
      worktreeLabel: profile.worktreeLabel,
      worktreePath: `approved:${profile.worktreeRealpathDigest}`,
      argv: ['npx', 'tsx', 'server/scripts/test-coordination-runtime.test.ts'],
      patchDigest: null,
      repositoryLabel: 'HolaHola',
      worktreeRealpathDigest: profile.worktreeRealpathDigest,
      branch: profile.branch,
      startingCommit: profile.startingCommit,
      targetPath: 'server/scripts/test-coordination-runtime.test.ts',
      maxChangedFiles: 1,
      maxPatchBytes: 40960,
      maxElapsedMs: 600000,
      maxModelTurns: 4,
      maxApiAttempts: 8,
    };
    return service.createGate3Packet(principal, windowId, assignment, key(req), envelope);
  }));

  app.post('/api/coordination/runtime/packets/:packetId/initial-turn', route(async (req) => {
    const { principal } = await authenticated(req, deps, 'coordination:write', 'model');
    const result = await coordinator.initialTurn(principal, req.params.packetId, key(req));
    return { ...result, interactions: result.interactions.map((item) => ({ ...item, intents: [] })) };
  }));

  app.post('/api/coordination/runtime/packets/:packetId/receipt', route(async (req) => {
    const { principal } = await authenticated(req, deps, 'coordination:write', 'model');
    const body = bodyObject(req);
    const packet = await repository.getPacket(req.params.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    return service.recordOutcomeReceipt(principal, packet.id,
      stringField(body.packetDigest, 'packetDigest'),
      stringField(body.interactionId, 'interactionId'), key(req));
  }));

  app.post('/api/coordination/runtime/packets/:packetId/claim', route(async (req) => {
    const { principal, profile } = await authenticated(req, deps, 'coordination:write', 'execute');
    const body = bodyObject(req);
    const packet = await repository.getPacket(req.params.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    return service.claim(principal, packet.id, packet.digest, stringField(body.receiptId, 'receiptId'),
      300_000, key(req));
  }));

  app.get('/api/coordination/runtime/claims/:claimId/intents', route(async (req) => {
    const { principal } = await authenticated(req, deps, 'coordination:read', 'execute');
    const claim = await repository.getClaim(req.params.claimId);
    if (!claim) throw new RuntimeProtocolError('claim_not_found', 'Claim not found');
    const intents = await coordinator.revealIntents(principal, claim.packetId, claim.id);
    return { intents: intents.map((intent) => ({ ...intent, validatedIntentDigest: digestCanonical(intent) })), epoch: claim.epoch };
  }));

  app.post('/api/coordination/runtime/claims/:claimId/renew', route(async (req) => {
    const { principal } = await authenticated(req, deps, 'coordination:write', 'execute');
    const body = bodyObject(req);
    return service.renew(principal, req.params.claimId, numberField(body.epoch, 'epoch'), 300_000, key(req));
  }));

  app.post('/api/coordination/runtime/claims/:claimId/continuation', route(async (req) => {
    const { principal } = await authenticated(req, deps, 'coordination:write', 'model');
    const body = bodyObject(req);
    const claim = await repository.getClaim(req.params.claimId);
    if (!claim) throw new RuntimeProtocolError('claim_not_found', 'Claim not found');
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
    const storedResults = await service.appendToolResultBatch(principal, claim.id, claim.epoch, results[0]?.interactionId ?? '', results, `${key(req)}:results`);
    if (storedResults.some((result) => result.outcome === 'rejected')) {
      throw new RuntimeProtocolError('execution_violated', 'Rejected local tool result violated the claim');
    }
    const attempts = await coordinator.continuationTurn(principal, claim.id, claim.packetId, numberField(body.turn, 'turn'), [], key(req));
    const persisted = (await repository.interactionsForPacket(claim.packetId))
      .filter((item: { turn: number }) => item.turn === numberField(body.turn, 'turn'))
      .sort((left: { attempt: number }, right: { attempt: number }) => left.attempt - right.attempt);
    return attempts.map((attempt, index) => ({ ...attempt, interactionId: persisted[index]?.id }));
  }));

  app.post('/api/coordination/runtime/claims/:claimId/execute', route(async (req) => {
    const { principal, profile } = await authenticated(req, deps, 'coordination:write', 'execute');
    const claim = await repository.getClaim(req.params.claimId);
    if (!claim) throw new RuntimeProtocolError('claim_not_found', 'Claim not found');
    const packet = await repository.getPacket(claim.packetId);
    if (!packet) throw new RuntimeProtocolError('packet_not_found', 'Packet not found');
    const attested = attestedState(bodyObject(req).attestedLocalState, profile);
    const persistedAttempts = (await repository.interactionsForPacket(packet.id)).length;
    if (attested.apiAttempts !== persistedAttempts || attested.modelTurns < 1) {
      throw new RuntimeProtocolError('consumption_conflict', 'Attestation does not match persisted model evidence');
    }
    return service.execute(principal, claim.id, packet.envelope, key(req), attested);
  }));

  app.post('/api/coordination/runtime/executions/:executionId/complete', route(async (req) => {
    const { principal } = await authenticated(req, deps, 'coordination:write', 'execute');
    const execution = await repository.getExecution(req.params.executionId);
    if (!execution) throw new RuntimeProtocolError('completion_mismatch', 'Execution not found');
    return service.complete(principal, execution.id, digestCanonical(execution), key(req));
  }));

  app.post('/api/coordination/runtime/completions/:completionId/verify', route(async (req) => {
    const { principal } = await authenticated(req, deps, 'coordination:write', 'verify');
    const body = bodyObject(req);
    const completion = await repository.getCompletion(req.params.completionId);
    if (!completion) throw new RuntimeProtocolError('completion_mismatch', 'Completion not found');
    const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
    return service.verify(principal, completion.id, completion.evidenceDigest,
      body.patchDigest === null ? null : String(body.patchDigest), key(req), decision,
       typeof body.rationale === 'string' ? body.rationale : undefined, body.rerunEvidence);
  }));
}
import { createHash } from 'node:crypto';
import {
  canonicalJson,
  digestCanonical,
  CoordinationRuntimeService,
  RuntimeProtocolError,
  validateToolIntent,
  type CoordinationRuntimeRepository,
  type InheritancePacket,
  type NormalizedOutcome,
  type RuntimePrincipal,
} from './coordination-runtime';

export const COORDINATION_GEMINI_MODEL = 'gemini-3-flash-preview';
export const COORDINATION_GEMINI_ADAPTER_VERSION = 'coordination-gemini-v1';

export type GeminiTransport = (request: {
  url: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}) => Promise<{ status: number; body: string }>;

export type NormalizedToolIntent = {
  name: string;
  arguments: Record<string, unknown>;
  callId: string;
  candidateIndex: 0;
  executionEligible: true;
};

export type GeminiTurnResult = {
  outcome: NormalizedOutcome;
  requestBytes: string;
  requestDigest: string;
  normalizedResponseBytes: string;
  responseDigest: string;
  intents: NormalizedToolIntent[];
  textParts: string[];
  additionalCandidateHashes: string[];
  providerDetails: Record<string, unknown>;
  usage?: Record<string, unknown>;
};

export function buildPacketBoundGeminiRequest(packet: InheritancePacket, priorToolResults: unknown[] = []): {
  bytes: string;
  digest: string;
} {
  const request = {
    contents: [{ role: 'user', parts: [
      // Packet bytes are canonical, immutable evidence.  Do not sanitize,
      // truncate, or remove secret-looking keys from inherited coordinator
      // data; sanitization is restricted to tool-result evidence below.
      { text: `[INHERITANCE_PACKET]\n${canonicalJson(packet)}` },
      ...(priorToolResults.length ? [{ text: `[TOOL_RESULTS]\n${canonicalJson(priorToolResults.map((result) => sanitize(result)))}` }] : []),
    ] }],
  tools: [{ functionDeclarations: [...knownTools].sort().map((name) => ({
      name, description: `Bounded coordinator tool: ${name}`,
      parameters: name === 'replace_once'
        ? {
          type: 'OBJECT',
          properties: {
            oldText: { type: 'STRING' },
            newText: { type: 'STRING' },
          },
          required: ['oldText', 'newText'],
        }
        : { type: 'OBJECT', properties: {} },
    })) }],
  };
  const bytes = canonicalJson(request);
  return { bytes, digest: sha(bytes) };
}

const retryable = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const knownTools = new Set(['git_status', 'git_diff', 'run_test', 'read_file', 'replace_once']);

function sha(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeJson(value: unknown): string {
  try { return canonicalJson(value); } catch { return '{"malformed":true}'; }
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 20_000 ? `${value.slice(0, 20_000)}...[truncated]` : value;
  if (Array.isArray(value)) return value.slice(0, 100).map((entry) => sanitize(entry, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/token|secret|password|api.?key|credential/i.test(key))
      .map(([key, entry]) => [key, sanitize(entry, depth + 1)]));
  }
  return null;
}

function normalized(value: unknown, callSeed = ''): {
  outcome: NormalizedOutcome;
  intents: NormalizedToolIntent[];
  textParts: string[];
  additionalCandidateHashes: string[];
  usage?: Record<string, unknown>;
  providerDetails: Record<string, unknown>;
} {
  if (!value || typeof value !== 'object') return { outcome: 'unsupported_provider_outcome', intents: [], textParts: [], additionalCandidateHashes: [], providerDetails: {} };
  const root = value as Record<string, any>;
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const additionalCandidateHashes = candidates.slice(1).map((candidate: unknown) => sha(safeJson(sanitize(candidate))));
  if (root.promptFeedback?.blockReason || root.blockReason) {
    return { outcome: 'safety_blocked', intents: [], textParts: [], additionalCandidateHashes, providerDetails: { blockReason: root.promptFeedback?.blockReason ?? root.blockReason } };
  }
  if (!candidates.length) return { outcome: 'empty_response', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
  const first = candidates[0];
  if (!first || typeof first !== 'object') return { outcome: 'unsupported_provider_outcome', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
  if (first.finishReason === 'SAFETY' || first.finishReason === 'BLOCKLIST') return { outcome: 'safety_blocked', intents: [], textParts: [], additionalCandidateHashes, providerDetails: { finishReason: first.finishReason } };
  if (first.finishReason === 'MAX_TOKENS') return { outcome: 'context_limit', intents: [], textParts: [], additionalCandidateHashes, providerDetails: { finishReason: first.finishReason } };
  if (first.finishReason === 'RECITATION') return { outcome: 'refused', intents: [], textParts: [], additionalCandidateHashes, providerDetails: { finishReason: first.finishReason } };
  const parts = first.content?.parts;
  if (!Array.isArray(parts)) return { outcome: 'unsupported_provider_outcome', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
  const calls: NormalizedToolIntent[] = [];
  const textParts: string[] = [];
  let usable = false;
  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex];
    if (typeof part.text === 'string' && part.text.length) { usable = true; textParts.push(part.text); }
    if (part.functionCall !== undefined) {
      const call = part.functionCall;
      if (!call || typeof call.name !== 'string' ||
        !call.name.length || !call.args || typeof call.args !== 'object' ||
        (call.id !== undefined && typeof call.id !== 'string')) {
        return { outcome: 'malformed_function_call', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
      }
      const args = { ...call.args } as Record<string, unknown>;
      const callId = call.id ?? sha(`${callSeed}:${partIndex}:${call.name}:${digestCanonical(args)}`);
      try {
        validateToolIntent({ name: call.name, arguments: args, callId });
      } catch {
        return {
          outcome: 'malformed_function_call',
          intents: [{ name: call.name, arguments: args, callId, candidateIndex: 0, executionEligible: true }],
          textParts: [],
          additionalCandidateHashes,
          providerDetails: {},
        };
      }
      if (calls.some((item) => item.callId === callId)) {
        return { outcome: 'malformed_function_call', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
      }
      calls.push({ name: call.name, arguments: args, callId, candidateIndex: 0, executionEligible: true });
      usable = true;
    } else if (part.text === undefined) {
        return { outcome: 'unsupported_provider_outcome', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
    }
  }
  return {
    outcome: usable ? 'consumed' : 'empty_response',
    intents: calls,
    textParts,
    additionalCandidateHashes,
    usage: root.usageMetadata,
    providerDetails: {
      finishReason: first.finishReason,
      ...(calls.some((call) => !((first.content?.parts ?? []).find((part: any) => part.functionCall?.id === call.callId)))
        ? { serverDerivedCallIds: calls.map((call) => call.callId) } : {}),
    },
  };
}

export class CoordinationGeminiAdapter {
  private readonly apiKey: string;
  private readonly endpointUrl: string;

  constructor(
    private readonly transport: GeminiTransport,
    apiKey: string | undefined = process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    baseUrl: string | undefined = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    private readonly maxAttempts = 2,
  ) {
    if (!apiKey) throw new Error('AI_INTEGRATIONS_GEMINI_API_KEY is not configured');
    if (!baseUrl) throw new Error('AI_INTEGRATIONS_GEMINI_BASE_URL is not configured');
    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch {
      throw new Error('AI_INTEGRATIONS_GEMINI_BASE_URL is invalid');
    }
    if (
      !['http:', 'https:'].includes(parsedBaseUrl.protocol)
      || parsedBaseUrl.username
      || parsedBaseUrl.password
      || parsedBaseUrl.search
      || parsedBaseUrl.hash
    ) {
      throw new Error('AI_INTEGRATIONS_GEMINI_BASE_URL must be a credential-free HTTP(S) base URL');
    }
    this.apiKey = apiKey;
    // Replit's Gemini integration base URL already owns the provider/API-version
    // prefix (the SDK uses apiVersion: ""). Adding /v1beta is an unsupported
    // proxy endpoint, so append only the model operation.
    this.endpointUrl = `${baseUrl.replace(/\/+$/, '')}/models/${COORDINATION_GEMINI_MODEL}:generateContent`;
  }

  async turn(packet: InheritancePacket, turn: number, priorToolResults: unknown[] = [], signal?: AbortSignal): Promise<GeminiTurnResult[]> {
    if (!Number.isInteger(turn) || turn < 1 || turn > 4) {
      throw new RuntimeProtocolError('model_call_limit_exceeded', 'Model turn is outside the approved limit');
    }
    const request = buildPacketBoundGeminiRequest(packet, priorToolResults);
    const requestBytes = request.bytes;
    const requestDigest = request.digest;
    const results: GeminiTurnResult[] = [];
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let status = 0;
      let body = '';
      try {
        const response = await this.transport({
          url: this.endpointUrl,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
          body: requestBytes,
          signal,
        });
        status = response.status;
        body = response.body;
        if (status < 200 || status >= 300) {
          const outcome: NormalizedOutcome = status === 401 || status === 403 ? 'terminal_provider_error' : retryable.has(status) ? 'retryable_provider_error' : 'terminal_provider_error';
          const normalizedResponseBytes = safeJson({ status, outcome });
          results.push({ outcome, requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes), intents: [], textParts: [], additionalCandidateHashes: [], providerDetails: { status } });
          if (!retryable.has(status)) break;
          continue;
        }
        let parsed: unknown;
        try { parsed = JSON.parse(body); } catch {
          const normalizedResponseBytes = '{"outcome":"unsupported_provider_outcome"}';
          results.push({ outcome: 'unsupported_provider_outcome', requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes), intents: [], textParts: [], additionalCandidateHashes: [], providerDetails: { status } });
          break;
        }
         const result = normalized(parsed, `${requestDigest}:1:0`);
        const normalizedResponseBytes = safeJson({
          outcome: result.outcome,
          intents: result.intents,
          textParts: result.textParts,
          additionalCandidateHashes: result.additionalCandidateHashes,
          providerDetails: result.providerDetails,
          ...(result.usage ? { usage: result.usage } : {}),
        });
        results.push({ ...result, requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes) });
        break;
      } catch (error) {
        const outcome: NormalizedOutcome = signal?.aborted ? 'interrupted' : 'retryable_provider_error';
        const normalizedResponseBytes = safeJson({ outcome, transport: true });
        results.push({ outcome, requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes), intents: [], textParts: [], additionalCandidateHashes: [], providerDetails: { transport: true } });
        if (outcome === 'interrupted' || attempt === this.maxAttempts) break;
      }
    }
    return results;
  }
}

/**
 * Server-side coordinator boundary. The caller supplies only an authenticated
 * principal and packet identity; prompt bytes are always derived here.
 */
export class CoordinationGeminiCoordinator {
  constructor(
    private readonly runtime: CoordinationRuntimeService,
    private readonly repository: CoordinationRuntimeRepository,
    private readonly adapter: CoordinationGeminiAdapter,
  ) {}

  async initialTurn(principal: RuntimePrincipal, packetId: string, idempotencyPrefix: string): Promise<{
    interactions: Awaited<ReturnType<CoordinationGeminiAdapter['turn']>>;
    interactionIds: string[];
    receiptId?: string;
  }> {
    return this.repository.withAttemptLock(
      `initial:${principal.runtimeRegistrationId}:${principal.profileId}:${packetId}:1`,
      () => this.initialTurnUnlocked(principal, packetId, idempotencyPrefix),
    );
  }

  private async initialTurnUnlocked(principal: RuntimePrincipal, packetId: string, idempotencyPrefix: string): Promise<{
    interactions: Awaited<ReturnType<CoordinationGeminiAdapter['turn']>>;
    interactionIds: string[];
    receiptId?: string;
  }> {
    const packet = await this.repository.getPacket(packetId);
    if (!packet || packet.runtimeRegistrationId !== principal.runtimeRegistrationId || packet.profileId !== principal.profileId) {
      throw new Error('packet_not_found');
    }
    // Check the logical operation before contacting Gemini.  This is
    // intentionally outside the interaction mutation because provider
    // consumption must never be repeated after a completed request.
    const firstKey = `${idempotencyPrefix}:interaction:1`;
    const prior = await this.repository.idempotency('interaction', firstKey);
    if (prior) {
      const storedFirst = await this.repository.getResult(prior.resultKind, prior.resultId) as Awaited<ReturnType<CoordinationRuntimeService['recordInteraction']>> | undefined;
      const interactions = (await this.repository.interactionsForPacket(packetId))
        .filter((interaction) => interaction.turn === 1)
        .sort((left, right) => left.attempt - right.attempt);
      if (!storedFirst || storedFirst.packetId !== packetId ||
        storedFirst.principal.runtimeRegistrationId !== principal.runtimeRegistrationId ||
        storedFirst.principal.profileId !== principal.profileId ||
        interactions.length === 0 || interactions.some((interaction) => !interaction.normalizedEvidence)) {
        throw new Error('idempotency_payload_mismatch');
      }
      const receiptRecord = await this.repository.idempotency('receipt', `${idempotencyPrefix}:receipt`);
      if (!receiptRecord) throw new Error('consumption_conflict');
      const receipt = await this.repository.getResult(receiptRecord.resultKind, receiptRecord.resultId) as { id: string } | undefined;
      if (!receipt) throw new Error('consumption_conflict');
      const replay = interactions.map((interaction) => {
        const evidence = interaction.normalizedEvidence!;
        return {
          outcome: interaction.outcome,
          requestBytes: '',
          requestDigest: interaction.requestDigest,
          normalizedResponseBytes: '',
          responseDigest: interaction.responseDigest!,
          intents: evidence.intents,
          textParts: evidence.textParts,
          additionalCandidateHashes: evidence.additionalCandidateHashes,
          providerDetails: evidence.providerDetails,
          ...(evidence.usage ? { usage: evidence.usage } : {}),
        };
      });
      return {
        interactions: replay.map((attempt) => ({ ...attempt, intents: [] })),
        interactionIds: interactions.map((interaction) => interaction.id),
        receiptId: receipt.id,
      };
    }
    // The canonical packet/turn slot is authoritative independently of the
    // caller's idempotency key.  This check runs while withAttemptLock holds
    // the slot lock, before any provider transport.
    const occupied = await this.repository.interactionForSlot(packetId, 1, 1);
    if (occupied) throw new Error('duplicate_model_attempt');
    const attempts = await this.adapter.turn(packet, 1);
    const policyAttempts = attempts.map((attempt) => {
      const validated = attempt.intents.map((intent) => {
        try {
          return validateToolIntent(intent);
        } catch {
          return null;
        }
      }).filter((item): item is { name: string; operation: string; digest: string } => item !== null);
      return validated.length === attempt.intents.length
        ? { attempt, validated }
        : { attempt: { ...attempt, outcome: 'malformed_function_call' as const }, validated: [] };
    });
    let receiptId: string | undefined;
    const interactionIds: string[] = [];
    for (let index = 0; index < attempts.length; index += 1) {
      const { attempt, validated } = policyAttempts[index];
      const interaction = await this.runtime.recordInteraction(principal, {
        packetId,
        turn: 1,
        attempt: index + 1,
        requestDigest: attempt.requestDigest,
        responseDigest: attempt.responseDigest,
        outcome: attempt.outcome,
        normalizedEvidence: {
          textParts: attempt.textParts,
          intents: attempt.intents,
           validatedIntents: validated,
          additionalCandidateHashes: attempt.additionalCandidateHashes,
          providerDetails: attempt.providerDetails,
          ...(attempt.usage ? { usage: attempt.usage } : {}),
          normalizedResponseDigest: attempt.responseDigest,
        },
        retryLineage: index ? (await this.repository.interactionForSlot(packetId, 1, index))?.id ?? null : null,
        idempotencyKey: `${idempotencyPrefix}:interaction:${index + 1}`,
      });
      interactionIds.push(interaction.id);
      if (index === attempts.length - 1) {
        const receipt = await this.runtime.recordOutcomeReceipt(
          principal, packetId, packet.digest, interaction.id, `${idempotencyPrefix}:receipt`,
        );
        receiptId = receipt.id;
      }
    }
    // A receipt records provider consumption, but does not grant execution
    // authority. Candidate intents remain private until claim acquisition.
    return {
      interactions: attempts.map((attempt) => ({ ...attempt, intents: [] })),
      interactionIds,
      ...(receiptId ? { receiptId } : {}),
    };
  }

  async continuationTurn(
    principal: RuntimePrincipal,
    claimId: string,
    packetId: string,
    turn: number,
    _priorToolResults: unknown[] = [],
    idempotencyPrefix: string,
  ): Promise<Awaited<ReturnType<CoordinationGeminiAdapter['turn']>>> {
    return this.repository.withAttemptLock(
      `continuation:${principal.runtimeRegistrationId}:${principal.profileId}:${packetId}:${turn}`,
      () => this.continuationTurnUnlocked(principal, claimId, packetId, turn, idempotencyPrefix),
    );
  }

  private async continuationTurnUnlocked(
    principal: RuntimePrincipal,
    claimId: string,
    packetId: string,
    turn: number,
    idempotencyPrefix: string,
  ): Promise<Awaited<ReturnType<CoordinationGeminiAdapter['turn']>>> {
    const priorRecord = await this.repository.idempotency('interaction', `${idempotencyPrefix}:interaction:1`);
    if (priorRecord) {
      const priorInteractions = (await this.repository.interactionsForPacket(packetId))
        .filter((item) => item.turn === turn).sort((a, b) => a.attempt - b.attempt);
      if (!priorInteractions.length || priorInteractions.some((item) => !item.normalizedEvidence)) {
        throw new Error('consumption_conflict');
      }
      return priorInteractions.map((item) => {
        const evidence = item.normalizedEvidence!;
        return {
          outcome: item.outcome, requestBytes: '', requestDigest: item.requestDigest,
          normalizedResponseBytes: '', responseDigest: item.responseDigest!, intents: evidence.intents,
          textParts: evidence.textParts, additionalCandidateHashes: evidence.additionalCandidateHashes,
          providerDetails: evidence.providerDetails, ...(evidence.usage ? { usage: evidence.usage } : {}),
        };
      });
    }
    const occupied = await this.repository.interactionForSlot(packetId, turn, 1);
    if (occupied) throw new Error('duplicate_model_attempt');
    const packet = await this.repository.getPacket(packetId);
    const prior = (await this.repository.interactionsForPacket(packetId))
      .filter((interaction) => interaction.normalizedEvidence)
      .sort((left, right) => right.turn - left.turn || right.attempt - left.attempt)[0];
    if (!prior) throw new Error('interaction_not_found');
    const storedEvidence = prior.normalizedEvidence;
    const claim = await this.repository.getClaim(claimId);
    if (!claim || claim.status !== 'active' || claim.packetId !== packetId ||
      claim.runtimeRegistrationId !== principal.runtimeRegistrationId || claim.profileId !== principal.profileId ||
      !packet || packet.id !== claim.packetId) {
      throw new Error('claim_not_owned');
    }
    if (!Number.isInteger(turn) || turn < 1 || turn > 4) {
      const rejectionDigest = digestCanonical({
        kind: 'model_call_limit_rejection',
        packetId,
        claimId,
        turn,
      });
      await this.runtime.recordInteraction(principal, {
        packetId,
        turn,
        attempt: 1,
        requestDigest: rejectionDigest,
        responseDigest: rejectionDigest,
        outcome: 'malformed_function_call',
        normalizedEvidence: {
          textParts: [],
          intents: [],
          validatedIntents: [],
          additionalCandidateHashes: [],
          providerDetails: { rejected: true, reason: 'model_call_limit_exceeded' },
          normalizedResponseDigest: rejectionDigest,
        },
        idempotencyKey: `${idempotencyPrefix}:interaction:1`,
      });
    }
    const storedResults = (await this.repository.toolResultsForClaim(claimId, claim.epoch))
      .filter((result) => result.interactionId === prior.id);
    const sanitizedResults = storedResults.map((result) => sanitize({
      callId: result.callId, name: result.toolName, outcome: result.outcome, payload: result.canonicalPayload,
    }));
    const boundResults = [{ priorInteractionId: prior.id, evidenceDigest: storedEvidence?.normalizedResponseDigest, results: sanitizedResults }];
    const attempts = await this.adapter.turn(packet, turn, boundResults);
    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index];
      await this.runtime.recordInteraction(principal, {
        packetId, turn, attempt: index + 1, requestDigest: attempt.requestDigest,
        responseDigest: attempt.responseDigest, outcome: attempt.outcome,
        normalizedEvidence: {
          textParts: attempt.textParts, intents: attempt.intents,
          additionalCandidateHashes: attempt.additionalCandidateHashes,
          // Tool results are evidence, not authority.  Persist the sanitized
          // bound values alongside the normalized provider result so a later
          // continuation can be reconstructed without trusting the caller.
          providerDetails: {
            ...attempt.providerDetails,
            toolResults: sanitizedResults,
            toolEvidenceBinding: {
              priorInteractionId: prior.id,
              normalizedResponseDigest: storedEvidence?.normalizedResponseDigest,
              callIds: sanitizedResults
                .map((result) => result && typeof result === 'object' && typeof (result as Record<string, unknown>).callId === 'string'
                  ? (result as Record<string, unknown>).callId : null)
                .filter((id): id is string => id !== null),
            },
          },
          ...(attempt.usage ? { usage: attempt.usage } : {}),
          normalizedResponseDigest: attempt.responseDigest,
        },
        retryLineage: index ? (await this.repository.interactionForSlot(packetId, turn, index))?.id ?? null : null,
        idempotencyKey: `${idempotencyPrefix}:interaction:${index + 1}`,
      });
    }
    return attempts;
  }

  async revealIntents(principal: RuntimePrincipal, packetId: string, claimId: string): Promise<NormalizedToolIntent[]> {
    const claim = await this.repository.getClaim(claimId);
    if (!claim || claim.status !== 'active' || claim.packetId !== packetId ||
      claim.runtimeRegistrationId !== principal.runtimeRegistrationId || claim.profileId !== principal.profileId ||
      claim.expiresAt <= Date.now()) throw new Error('claim_not_owned');
    const interactions = (await this.repository.interactionsForPacket(packetId))
      .filter((interaction) => interaction.normalizedEvidence)
      .sort((left, right) => right.turn - left.turn || right.attempt - left.attempt);
    return interactions[0]?.normalizedEvidence?.intents ?? [];
  }
}
import {
  digestCanonical,
  CoordinationRuntimeService,
  validateToolIntent,
  type CoordinationRuntimeRepository,
  type RuntimePrincipal,
} from './coordination-runtime';
import {
  CoordinationGeminiAdapter,
  type GeminiTransport,
  type GeminiTurnResult,
  type NormalizedToolIntent,
} from './coordination-provider-adapters/gemini';

// Compatibility surface retained for task-1448 callers. Native Gemini
// construction/decoding lives exclusively in the provider adapter module.
export {
  CoordinationGeminiAdapter,
  GeminiProviderAdapter,
  GeminiAdapter,
  buildPacketBoundGeminiRequest,
  COORDINATION_GEMINI_MODEL,
  COORDINATION_GEMINI_ADAPTER_VERSION,
  GEMINI_PROVIDER_DESCRIPTOR,
  COORDINATION_GEMINI_DESCRIPTOR,
  GEMINI_DESCRIPTOR,
} from './coordination-provider-adapters/gemini';
export type {
  GeminiTransport,
  GeminiTurnResult,
  NormalizedToolIntent,
} from './coordination-provider-adapters/gemini';

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
          outcome: interaction.outcome, requestBytes: '', requestDigest: interaction.requestDigest,
          normalizedResponseBytes: '', responseDigest: interaction.responseDigest!,
          intents: evidence.intents, textParts: evidence.textParts,
          additionalCandidateHashes: evidence.additionalCandidateHashes,
          providerDetails: evidence.providerDetails, ...(evidence.usage ? { usage: evidence.usage } : {}),
        };
      });
      return {
        interactions: replay.map((attempt) => ({ ...attempt, intents: [] })) as unknown as GeminiTurnResult[],
        interactionIds: interactions.map((interaction) => interaction.id), receiptId: receipt.id,
      };
    }
    const occupied = await this.repository.interactionForSlot(packetId, 1, 1);
    if (occupied) throw new Error('duplicate_model_attempt');
    const attempts = await this.adapter.turn(packet, 1);
    const policyAttempts = attempts.map((attempt) => {
      const executableIntents = attempt.intents.filter((intent) => intent.executionEligible !== false);
      const validated = executableIntents.map((intent) => {
        try { return validateToolIntent(intent); } catch { return null; }
      }).filter((item): item is { name: string; operation: string; digest: string } => item !== null);
      return validated.length === executableIntents.length
        ? { attempt, validated }
        : { attempt: { ...attempt, outcome: 'malformed_function_call' as const }, validated: [] };
    });
    let receiptId: string | undefined;
    const interactionIds: string[] = [];
    for (let index = 0; index < attempts.length; index += 1) {
      const { attempt, validated } = policyAttempts[index];
      const interaction = await this.runtime.recordInteraction(principal, {
        packetId, turn: 1, attempt: index + 1, requestDigest: attempt.requestDigest,
        responseDigest: attempt.responseDigest, outcome: attempt.outcome,
        normalizedEvidence: {
          textParts: attempt.textParts, intents: attempt.intents, validatedIntents: validated,
          additionalCandidateHashes: attempt.additionalCandidateHashes,
          providerDetails: attempt.providerDetails, ...(attempt.usage ? { usage: attempt.usage } : {}),
          normalizedResponseDigest: attempt.responseDigest,
        },
        retryLineage: index ? (await this.repository.interactionForSlot(packetId, 1, index))?.id ?? null : null,
        idempotencyKey: `${idempotencyPrefix}:interaction:${index + 1}`,
      });
      interactionIds.push(interaction.id);
      if (index === attempts.length - 1) {
        const receipt = await this.runtime.recordOutcomeReceipt(principal, packetId, packet.digest, interaction.id, `${idempotencyPrefix}:receipt`);
        receiptId = receipt.id;
      }
    }
    return {
      interactions: attempts.map((attempt) => ({ ...attempt, intents: [] })),
      interactionIds, ...(receiptId ? { receiptId } : {}),
    };
  }

  async continuationTurn(
    principal: RuntimePrincipal, claimId: string, packetId: string, turn: number,
    _priorToolResults: unknown[] = [], idempotencyPrefix: string,
  ): Promise<Awaited<ReturnType<CoordinationGeminiAdapter['turn']>>> {
    return this.repository.withAttemptLock(
      `continuation:${principal.runtimeRegistrationId}:${principal.profileId}:${packetId}:${turn}`,
      () => this.continuationTurnUnlocked(principal, claimId, packetId, turn, idempotencyPrefix),
    );
  }

  private async continuationTurnUnlocked(
    principal: RuntimePrincipal, claimId: string, packetId: string, turn: number, idempotencyPrefix: string,
  ): Promise<Awaited<ReturnType<CoordinationGeminiAdapter['turn']>>> {
    const priorRecord = await this.repository.idempotency('interaction', `${idempotencyPrefix}:interaction:1`);
    if (priorRecord) {
      const priorInteractions = (await this.repository.interactionsForPacket(packetId))
        .filter((item) => item.turn === turn).sort((a, b) => a.attempt - b.attempt);
      if (!priorInteractions.length || priorInteractions.some((item) => !item.normalizedEvidence)) throw new Error('consumption_conflict');
      return priorInteractions.map((item) => {
        const evidence = item.normalizedEvidence!;
        return {
          outcome: item.outcome, requestBytes: '', requestDigest: item.requestDigest,
          normalizedResponseBytes: '', responseDigest: item.responseDigest!, intents: evidence.intents,
          textParts: evidence.textParts, additionalCandidateHashes: evidence.additionalCandidateHashes,
          providerDetails: evidence.providerDetails, ...(evidence.usage ? { usage: evidence.usage } : {}),
        };
      }) as unknown as GeminiTurnResult[];
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
      !packet || packet.id !== claim.packetId) throw new Error('claim_not_owned');
    if (!Number.isInteger(turn) || turn < 1 || turn > 4) {
      const rejectionDigest = digestCanonical({ kind: 'model_call_limit_rejection', packetId, claimId, turn });
      await this.runtime.recordInteraction(principal, {
        packetId, turn, attempt: 1, requestDigest: rejectionDigest, responseDigest: rejectionDigest,
        outcome: 'malformed_function_call',
        normalizedEvidence: {
          textParts: [], intents: [], validatedIntents: [], additionalCandidateHashes: [],
          providerDetails: { rejected: true, reason: 'model_call_limit_exceeded' }, normalizedResponseDigest: rejectionDigest,
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
          providerDetails: {
            ...attempt.providerDetails, toolResults: sanitizedResults,
            toolEvidenceBinding: {
              priorInteractionId: prior.id, normalizedResponseDigest: storedEvidence?.normalizedResponseDigest,
              callIds: sanitizedResults.map((result) => result && typeof result === 'object' &&
                typeof (result as Record<string, unknown>).callId === 'string'
                ? (result as Record<string, unknown>).callId : null).filter((id): id is string => id !== null),
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
    return (interactions[0]?.normalizedEvidence?.intents ?? [])
      .filter((intent) => intent.executionEligible !== false) as unknown as NormalizedToolIntent[];
  }
}
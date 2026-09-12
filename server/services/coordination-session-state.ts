import {
  failure,
  freezeV2,
  isTerminalSession,
  success,
  type FailureClassification,
  type SessionState,
  type SessionTerminalStatus,
  type TransitionCommandBase,
  type TransitionResult,
} from './coordination-v2-types';

export type SessionCommand =
  | (TransitionCommandBase & { readonly type: 'preparation_ready' })
  | (TransitionCommandBase & { readonly type: 'start_attempt'; readonly provider: string })
  | (TransitionCommandBase & { readonly type: 'transport_recovered' })
  | (TransitionCommandBase & { readonly type: 'begin_verification' })
  | (TransitionCommandBase & { readonly type: 'accept_completion'; readonly evidenceDigest: string })
  | (TransitionCommandBase & { readonly type: 'retry'; readonly classification: FailureClassification; readonly provider: string })
  | (TransitionCommandBase & { readonly type: 'fail'; readonly reason: string; readonly classification?: FailureClassification; readonly provider?: string })
  | (TransitionCommandBase & { readonly type: 'exhaust'; readonly reason?: string })
  | (TransitionCommandBase & { readonly type: 'expire' })
  | (TransitionCommandBase & { readonly type: 'revoke'; readonly reason: string })
  | (TransitionCommandBase & { readonly type: 'host_wait' });

function event(command: SessionCommand, from: string, to: string, kind: string, classification?: FailureClassification, resultCode?: string) {
  return freezeV2({
    eventId: command.eventId,
    requestId: command.requestId,
    occurredAt: command.now,
    kind,
    from,
    to,
    ...(classification ? { classification } : {}),
    ...(resultCode ? { resultCode } : {}),
  });
}

function terminal(
  current: SessionState,
  command: SessionCommand,
  state: SessionTerminalStatus,
  reason: string,
  kind: string,
  classification?: FailureClassification,
): TransitionResult<SessionState> {
  return success(
    freezeV2({ ...current, state, terminalAt: command.now, terminalReason: reason, completionAccepted: state === 'succeeded' }),
    event(command, current.state, state, kind, classification),
  );
}

function providerIndex(current: SessionState, provider: string): number {
  return current.providerOrder.indexOf(provider);
}

function beginAttempt(
  current: SessionState,
  command: SessionCommand,
  provider: string,
  kind: string,
): TransitionResult<SessionState> {
  if (providerIndex(current, provider) < 0) return failure('provider_not_in_policy_order');
  if (current.attemptCount >= current.totalAttemptBudget) return failure('attempt_budget_exhausted');
  const providerCount = current.attemptsByProvider[provider] ?? 0;
  const providerBudget = current.providerAttemptBudgets[provider];
  if (providerBudget !== undefined && providerCount >= providerBudget) return failure('provider_budget_exhausted');
  const attemptsByProvider = { ...current.attemptsByProvider, [provider]: providerCount + 1 };
  const next = freezeV2({
    ...current,
    state: 'running' as const,
    attemptCount: current.attemptCount + 1,
    attemptsByProvider,
    currentProvider: provider,
  }) as SessionState;
  return success(next, event(command, current.state, 'running', kind, command.type === 'retry' ? command.classification : undefined));
}

export function transitionSession(
  current: SessionState,
  command: SessionCommand,
): TransitionResult<SessionState> {
  if (!Number.isFinite(command.now) || !command.eventId || !command.requestId) return failure('invalid_command');
  if (isTerminalSession(current)) return failure('session_terminal');

  if (command.type === 'expire') {
    if (command.now < current.expiresAt) return failure('invalid_command');
    return terminal(current, command, 'expired', 'session expired', 'session_expired');
  }
  if (command.type === 'revoke') return terminal(current, command, 'revoked', command.reason, 'session_revoked');
  if (command.type === 'exhaust') return terminal(current, command, 'exhausted', command.reason ?? 'attempt budget exhausted', 'session_exhausted');

  if (command.now >= current.expiresAt) return failure('session_expired');

  switch (command.type) {
    case 'preparation_ready':
      return current.state === 'preparing'
        ? success(freezeV2({ ...current, state: 'ready' as const }), event(command, 'preparing', 'ready', 'session_ready'))
        : failure('invalid_state');
    case 'start_attempt':
      if (current.state !== 'ready') return failure('invalid_state');
      return beginAttempt(current, command, command.provider, 'attempt_started');
    case 'retry':
      if (command.classification === 'resume_transport') {
        return command.provider === current.currentProvider
          ? success(freezeV2({ ...current, state: 'running' as const }) as SessionState, event(command, current.state, 'running', 'transport_resumed', command.classification))
          : failure('provider_order_regression');
      }
      if (command.classification === 'terminal_failure') {
        return terminal(current, command, 'failed', 'terminal failure', 'session_failed', command.classification);
      }
      if (command.classification === 'cleanup_repair') return failure('invalid_command');
      if (current.state !== 'running' && current.state !== 'waiting_for_host' && current.state !== 'verifying') {
        return failure('invalid_state');
      }
      if (command.classification === 'fresh_attempt_same_provider' && command.provider !== current.currentProvider) {
        return failure('provider_order_regression');
      }
      if (command.classification === 'fresh_attempt_next_provider') {
        const prior = current.currentProvider === null ? -1 : providerIndex(current, current.currentProvider);
        if (providerIndex(current, command.provider) <= prior) return failure('provider_order_regression');
      }
      return beginAttempt(current, command, command.provider, 'fresh_attempt');
    case 'host_wait':
      return current.state === 'running'
        ? success(freezeV2({ ...current, state: 'waiting_for_host' as const }), event(command, 'running', 'waiting_for_host', 'host_waiting', 'resume_transport'))
        : failure('invalid_state');
    case 'transport_recovered':
      return current.state === 'waiting_for_host'
        ? success(freezeV2({ ...current, state: 'running' as const }), event(command, 'waiting_for_host', 'running', 'transport_resumed', 'resume_transport'))
        : failure('invalid_state');
    case 'begin_verification':
      return current.state === 'running'
        ? success(freezeV2({ ...current, state: 'verifying' as const }), event(command, 'running', 'verifying', 'verification_started'))
        : failure('invalid_state');
    case 'accept_completion':
      if (current.state !== 'verifying') return failure('invalid_state');
      if (current.completionAccepted) return failure('completion_already_accepted');
      return terminal(current, command, 'succeeded', command.evidenceDigest, 'completion_accepted');
    case 'fail':
      if (command.classification === 'resume_transport') {
        return success(freezeV2({ ...current, state: 'waiting_for_host' as const }) as SessionState, event(command, current.state, 'waiting_for_host', 'transport_interrupted', command.classification));
      }
      if (command.classification === 'fresh_attempt_same_provider' || command.classification === 'fresh_attempt_next_provider') {
        return transitionSession(current, {
          ...command,
          type: 'retry',
          classification: command.classification,
          provider: command.provider ?? current.currentProvider ?? '',
        });
      }
      return terminal(current, command, 'failed', command.reason, 'session_failed', command.classification ?? 'terminal_failure');
    default:
      return failure('invalid_command');
  }
}

export const reduceSessionState = transitionSession;
export const transitionSessionState = transitionSession;
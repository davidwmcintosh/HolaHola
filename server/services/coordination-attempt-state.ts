import {
  failure,
  freezeV2,
  isTerminalAttempt,
  success,
  type AttemptState,
  type FailureClassification,
  type TransitionCommandBase,
  type TransitionResult,
} from './coordination-v2-types';

export type AttemptCommand =
  | (TransitionCommandBase & { readonly type: 'provider_started' })
  | (TransitionCommandBase & { readonly type: 'intent_ready' })
  | (TransitionCommandBase & { readonly type: 'host_wait' })
  | (TransitionCommandBase & { readonly type: 'host_started' })
  | (TransitionCommandBase & { readonly type: 'result_ready' })
  | (TransitionCommandBase & { readonly type: 'provider_continuation' })
  | (TransitionCommandBase & { readonly type: 'provider_resumed' })
  | (TransitionCommandBase & { readonly type: 'transport_recovered' })
  | (TransitionCommandBase & { readonly type: 'complete'; readonly resultCode: string })
  | (TransitionCommandBase & { readonly type: 'fail'; readonly classification: FailureClassification })
  | (TransitionCommandBase & { readonly type: 'cancel'; readonly reason: string });

function event(command: AttemptCommand, from: string, to: string, kind: string, classification?: FailureClassification, resultCode?: string) {
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

export function transitionAttempt(
  current: AttemptState,
  command: AttemptCommand,
): TransitionResult<AttemptState> {
  if (!Number.isFinite(command.now) || !command.eventId || !command.requestId) return failure('invalid_command');
  if (isTerminalAttempt(current)) return failure('attempt_terminal');
  if (command.now > current.deadline) return failure('attempt_expired');

  if (command.type === 'transport_recovered') {
    // Recovery is deliberately a same-object operation: no ordinal or identity
    // is changed and no new attempt can be smuggled in through transport.
    return success(
      freezeV2({ ...current }),
      event(command, current.state, current.state, 'transport_resumed', 'resume_transport'),
    );
  }

  if (command.type === 'fail') {
    if (command.classification === 'resume_transport') {
      return success(
        freezeV2({ ...current, state: 'waiting_for_host' as const }) as AttemptState,
        event(command, current.state, 'waiting_for_host', 'transport_interrupted', command.classification),
      );
    }
    if (command.classification === 'fresh_attempt_same_provider' || command.classification === 'fresh_attempt_next_provider') {
      return success(
        freezeV2({
          ...current,
          state: 'retryable_failed' as const,
          failureClassification: command.classification,
          terminalAt: command.now,
          resultCode: 'retryable_failure',
        }),
        event(command, current.state, 'retryable_failed', 'attempt_failed', command.classification),
      );
    }
    if (command.classification === 'cleanup_repair') return failure('invalid_command');
    return success(
      freezeV2({
        ...current,
        state: 'terminal_failed' as const,
        failureClassification: 'terminal_failure',
        terminalAt: command.now,
        resultCode: 'terminal_failure',
      }),
      event(command, current.state, 'terminal_failed', 'attempt_failed', 'terminal_failure'),
    );
  }

  if (command.type === 'complete') {
    if (current.state !== 'result_ready' && current.state !== 'provider_continuation') return failure('invalid_state');
    return success(
      freezeV2({
        ...current,
        state: 'completed' as const,
        failureClassification: null,
        terminalAt: command.now,
        resultCode: command.resultCode,
      }),
      event(command, current.state, 'completed', 'attempt_completed', undefined, command.resultCode),
    );
  }

  if (command.type === 'cancel') {
    return success(
      freezeV2({
        ...current,
        state: 'cancelled' as const,
        failureClassification: 'terminal_failure',
        terminalAt: command.now,
        resultCode: 'cancelled',
      }),
      event(command, current.state, 'cancelled', 'attempt_cancelled', 'terminal_failure'),
    );
  }

  const transitions: Readonly<Record<string, Readonly<{ from: string[]; to: AttemptState['state']; kind: string }>>> = {
    provider_started: { from: ['created', 'provider_continuation'], to: 'provider_active', kind: 'provider_started' },
    intent_ready: { from: ['provider_active'], to: 'intent_ready', kind: 'intent_ready' },
    host_wait: { from: ['intent_ready'], to: 'waiting_for_host', kind: 'host_waiting' },
    host_started: { from: ['waiting_for_host'], to: 'host_active', kind: 'host_started' },
    result_ready: { from: ['host_active'], to: 'result_ready', kind: 'result_ready' },
    provider_continuation: { from: ['result_ready'], to: 'provider_continuation', kind: 'provider_continuation' },
    provider_resumed: { from: ['provider_continuation'], to: 'provider_active', kind: 'provider_resumed' },
  };
  const transition = transitions[command.type];
  if (!transition || !transition.from.includes(current.state)) return failure('invalid_state');
  return success(
    freezeV2({ ...current, state: transition.to }) as AttemptState,
    event(command, current.state, transition.to, transition.kind),
  );
}

export const reduceAttemptState = transitionAttempt;
export const transitionAttemptState = transitionAttempt;
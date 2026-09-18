import {
  failure,
  freezeV2,
  success,
  type CleanupState,
  type TransitionCommandBase,
  type TransitionResult,
} from './coordination-v2-types';

export type CleanupCommand =
  | (TransitionCommandBase & { readonly type: 'start' })
  | (TransitionCommandBase & { readonly type: 'acknowledge' })
  | (TransitionCommandBase & { readonly type: 'failed'; readonly code: string })
  | (TransitionCommandBase & { readonly type: 'retry' });

function event(command: CleanupCommand, from: string, to: string, kind: string, classification?: 'cleanup_repair') {
  return freezeV2({
    eventId: command.eventId,
    requestId: command.requestId,
    occurredAt: command.now,
    kind,
    from,
    to,
    ...(classification ? { classification } : {}),
  });
}

export function transitionCleanup(
  current: CleanupState,
  command: CleanupCommand,
): TransitionResult<CleanupState> {
  if (!Number.isFinite(command.now) || !command.eventId || !command.requestId) return failure('invalid_command');
  if (current.status === 'acknowledged' && command.type !== 'acknowledge') return failure('cleanup_terminal');
  if (command.type === 'start') {
    if (current.status !== 'pending') return failure('invalid_state');
    return success(
      freezeV2({ ...current, status: 'in_progress' as const }) as CleanupState,
      event(command, 'pending', 'in_progress', 'cleanup_started'),
    );
  }
  if (command.type === 'acknowledge') {
    if (current.status === 'acknowledged') return failure('cleanup_already_acknowledged');
    return success(
      freezeV2({ ...current, status: 'acknowledged' as const, acknowledgedAt: command.now, lastFailureCode: null }),
      event(command, current.status, 'acknowledged', 'cleanup_acknowledged'),
    );
  }
  if (command.type === 'failed') {
    if (!command.code) return failure('invalid_command');
    if (current.status === 'acknowledged') return failure('cleanup_terminal');
    return success(
      freezeV2({ ...current, status: 'repair_required' as const, lastFailureCode: command.code }),
      event(command, current.status, 'repair_required', 'cleanup_required', 'cleanup_repair'),
    );
  }
  if (command.type === 'retry') {
    if (current.status !== 'repair_required') return failure('invalid_state');
    return success(
      freezeV2({ ...current, status: 'pending' as const }),
      event(command, 'repair_required', 'pending', 'cleanup_retry'),
    );
  }
  return failure('invalid_command');
}

export const reduceCleanupState = transitionCleanup;
export const transitionCleanupState = transitionCleanup;
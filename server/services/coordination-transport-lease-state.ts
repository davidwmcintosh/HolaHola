import {
  failure,
  freezeV2,
  success,
  type TransitionCommandBase,
  type TransitionResult,
  type TransportLeaseState,
} from './coordination-v2-types';

export type TransportLeaseCommand =
  | (TransitionCommandBase & { readonly type: 'acquire'; readonly newLeaseId: string; readonly holderInstanceId: string; readonly duration: number })
  | (TransitionCommandBase & { readonly type: 'renew'; readonly holderInstanceId: string; readonly epoch: number; readonly duration: number })
  | (TransitionCommandBase & { readonly type: 'expire' })
  | (TransitionCommandBase & { readonly type: 'takeover'; readonly newLeaseId: string; readonly holderInstanceId: string; readonly duration: number })
  | (TransitionCommandBase & { readonly type: 'release'; readonly holderInstanceId: string; readonly epoch: number })
  | (TransitionCommandBase & { readonly type: 'supersede' });

function event(command: TransportLeaseCommand, from: string, to: string, kind: string) {
  return freezeV2({
    eventId: command.eventId,
    requestId: command.requestId,
    occurredAt: command.now,
    kind,
    from,
    to,
  });
}

function validDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}

export function transitionTransportLease(
  current: TransportLeaseState,
  command: TransportLeaseCommand,
): TransitionResult<TransportLeaseState> {
  if (!Number.isFinite(command.now) || !command.eventId || !command.requestId) return failure('invalid_command');
  if (current.state === 'released' || current.state === 'superseded') {
    if (command.type !== 'acquire') return failure('lease_terminal');
  }

  if (command.type === 'supersede') {
    if (current.state !== 'active') return failure('invalid_state');
    if (current.expiresAt === null || command.now < current.expiresAt) return failure('invalid_state');
    return success(freezeV2({ ...current, state: 'superseded' as const, endedAt: command.now }), event(command, 'active', 'superseded', 'lease_superseded'));
  }
  if (command.type === 'expire') {
    if (current.state !== 'active' || current.expiresAt === null || command.now < current.expiresAt) return failure('invalid_state');
    return success(freezeV2({ ...current, state: 'expired' as const, endedAt: command.now }), event(command, 'active', 'expired', 'lease_expired'));
  }
  if (command.type === 'acquire') {
    if (!validDuration(command.duration) || !command.newLeaseId) return failure('invalid_command');
    if (current.state === 'active') return failure('lease_holder_conflict');
    if (current.state !== 'unheld') return failure('lease_terminal');
    const epoch = current.epoch + 1;
    return success(
      freezeV2({
        ...current,
        leaseId: command.newLeaseId,
        predecessorLeaseId: current.epoch > 0 ? current.leaseId : current.predecessorLeaseId,
        state: 'active' as const,
        holderInstanceId: command.holderInstanceId,
        epoch,
        issuedAt: command.now,
        expiresAt: command.now + command.duration,
        endedAt: null,
      }),
      event(command, current.state, 'active', 'lease_acquired'),
    );
  }
  if (command.type === 'takeover') {
    if (!validDuration(command.duration) || !command.newLeaseId || current.state !== 'expired') return failure('invalid_state');
    return success(
      freezeV2({
        ...current,
        leaseId: command.newLeaseId,
        state: 'active' as const,
        holderInstanceId: command.holderInstanceId,
        epoch: current.epoch + 1,
        issuedAt: command.now,
        expiresAt: command.now + command.duration,
        predecessorLeaseId: current.leaseId,
        endedAt: null,
      }),
      event(command, 'expired', 'active', 'lease_taken_over'),
    );
  }
  if (command.type === 'renew') {
    if (current.state !== 'active') return failure('lease_expired');
    if (current.holderInstanceId !== command.holderInstanceId) return failure('lease_holder_conflict');
    if (current.epoch !== command.epoch) return failure('lease_epoch_stale');
    if (current.expiresAt === null || command.now >= current.expiresAt) return failure('lease_expired');
    if (!validDuration(command.duration)) return failure('invalid_command');
    return success(
      freezeV2({ ...current, expiresAt: command.now + command.duration }),
      event(command, 'active', 'active', 'lease_renewed'),
    );
  }
  if (command.type === 'release') {
    if (current.state !== 'active') return failure('invalid_state');
    if (current.holderInstanceId !== command.holderInstanceId) return failure('lease_holder_conflict');
    if (current.epoch !== command.epoch) return failure('lease_epoch_stale');
    return success(
      freezeV2({ ...current, state: 'released' as const, expiresAt: current.expiresAt, endedAt: command.now }),
      event(command, 'active', 'released', 'lease_released'),
    );
  }
  return failure('invalid_command');
}

export const reduceTransportLeaseState = transitionTransportLease;
export const transitionTransportLeaseState = transitionTransportLease;
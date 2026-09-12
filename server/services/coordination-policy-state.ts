import {
  failure,
  freezeV2,
  success,
  type PolicyState,
  type TransitionCommandBase,
  type TransitionResult,
} from './coordination-v2-types';

export type PolicyCommand =
  | (TransitionCommandBase & { readonly type: 'approve' })
  | (TransitionCommandBase & { readonly type: 'revoke'; readonly reason: string });

function event(command: PolicyCommand, from: string, to: string, kind: string, data?: Record<string, unknown>) {
  return freezeV2({
    eventId: command.eventId,
    requestId: command.requestId,
    occurredAt: command.now,
    kind,
    from,
    to,
    ...(data ? { data: freezeV2({ ...data }) } : {}),
  });
}

export function transitionPolicy(
  current: PolicyState,
  command: PolicyCommand,
): TransitionResult<PolicyState> {
  if (!Number.isFinite(command.now) || !command.eventId || !command.requestId) return failure('invalid_command');
  if (current.state === 'draft' && command.type === 'approve') {
    if (current.providerOrder.length === 0 || current.totalAttemptBudget < 1) {
      return failure('policy_not_approvable');
    }
    return success(
      freezeV2({ ...current, state: 'approved' as const, approvedAt: command.now }),
      event(command, 'draft', 'approved', 'policy_approved'),
    );
  }
  if (current.state === 'approved' && command.type === 'approve') {
    return failure('policy_already_approved');
  }
  if (current.state === 'approved' && command.type === 'revoke') {
    return success(
      freezeV2({ ...current, state: 'revoked' as const, revokedAt: command.now }),
      event(command, 'approved', 'revoked', 'policy_revoked', { reason: command.reason }),
    );
  }
  if (current.state === 'revoked' || current.state === 'approved') return failure('policy_terminal');
  return failure('invalid_state');
}

export const reducePolicyState = transitionPolicy;
export const transitionPolicyState = transitionPolicy;
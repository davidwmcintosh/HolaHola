export type GreetingDeliveryPhase = 'idle' | 'queued' | 'dispatched' | 'delivered' | 'failed';

export class GreetingDeliveryState {
  phase: GreetingDeliveryPhase = 'idle';
  attempts = 0;

  constructor(readonly maxAttempts = 3) {}

  queue(): boolean {
    if (this.phase === 'dispatched' || this.phase === 'delivered') return false;
    this.phase = 'queued';
    return true;
  }

  beginDispatch(internalRetry = false): boolean {
    if (this.phase === 'delivered') return false;
    if (this.phase === 'dispatched' && !internalRetry) return false;
    if (this.attempts >= this.maxAttempts) {
      this.phase = 'failed';
      return false;
    }
    this.attempts++;
    this.phase = 'dispatched';
    return true;
  }

  sendFailed(): boolean {
    if (this.phase === 'delivered') return false;
    if (this.attempts >= this.maxAttempts) {
      this.phase = 'failed';
      return false;
    }
    this.phase = 'queued';
    return true;
  }

  noAudio(): boolean {
    return this.sendFailed();
  }

  firstAudio(): void {
    this.phase = 'delivered';
  }
}

export function beginQueuedGreetingDispatch(
  state: GreetingDeliveryState,
  internalRetry: boolean,
): boolean {
  return state.beginDispatch(internalRetry);
}

export function markGreetingNoAudio(state: GreetingDeliveryState): boolean {
  return state.noAudio();
}

export function acknowledgeFirstGreetingAudio(
  state: GreetingDeliveryState,
  cancelScheduledRetry: () => void,
  cancelWatchdog: () => void,
): void {
  state.firstAudio();
  cancelScheduledRetry();
  cancelWatchdog();
}
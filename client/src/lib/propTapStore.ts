import { useSyncExternalStore } from 'react';

export interface PropTapSignal {
  propName: string;
  propLabel: string;
  nativeLabel?: string;
  timestamp: number;
}

let state: PropTapSignal | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setGlobalPropTap(signal: PropTapSignal | null): void {
  state = signal;
  listeners.forEach(l => l());
}

export function getGlobalPropTap(): PropTapSignal | null {
  return state;
}

export function useGlobalPropTap(): PropTapSignal | null {
  return useSyncExternalStore(subscribe, getGlobalPropTap);
}

/**
 * Global Mission Store
 *
 * HMR-resistant store for the active session mission badge.
 * StreamingVoiceChat writes via setGlobalMission; ImmersiveOverlay reads
 * via useGlobalMission — same pattern as voiceInputStore.
 */

import { useSyncExternalStore } from 'react';

declare global {
  interface Window {
    __missionStore?: { state: string | null; listeners: Set<() => void> };
  }
}

function getStore() {
  if (!window.__missionStore) {
    window.__missionStore = { state: null, listeners: new Set() };
  }
  return window.__missionStore;
}

export function setGlobalMission(mission: string | null): void {
  const store = getStore();
  store.state = mission;
  store.listeners.forEach(l => l());
}

export function useGlobalMission(): string | null {
  return useSyncExternalStore(
    cb => { const s = getStore(); s.listeners.add(cb); return () => s.listeners.delete(cb); },
    () => getStore().state,
    () => getStore().state,
  );
}

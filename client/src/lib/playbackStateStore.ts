/**
 * Global Playback State Store
 * 
 * This store provides a HMR-resistant way for components to subscribe to
 * playback state changes. It bypasses React prop drilling which can become
 * stale during hot module replacement.
 * 
 * Usage:
 *   import { usePlaybackState, setGlobalPlaybackState } from '@/lib/playbackStateStore';
 *   const playbackState = usePlaybackState(); // Returns 'idle' | 'buffering' | 'playing' | 'paused'
 */

import { useSyncExternalStore } from 'react';

export type PlaybackState = 'idle' | 'buffering' | 'playing' | 'paused';

// Global state stored on window for HMR resilience
declare global {
  interface Window {
    __playbackStateStore?: {
      state: PlaybackState;
      listeners: Set<() => void>;
    };
  }
}

function getStore() {
  if (!window.__playbackStateStore) {
    window.__playbackStateStore = {
      state: 'idle',
      listeners: new Set(),
    };
  }
  return window.__playbackStateStore;
}

/**
 * Set the global playback state and notify all subscribers
 * Called by StreamingAudioPlayer when state changes
 */
export function setGlobalPlaybackState(newState: PlaybackState): void {
  const store = getStore();
  if (store.state !== newState) {
    console.log(`[GLOBAL PLAYBACK STORE] State change: ${store.state} -> ${newState} (listeners: ${store.listeners.size})`);
    store.state = newState;
    // Notify all React subscribers
    store.listeners.forEach(listener => listener());
  }
}

/**
 * Get current playback state (snapshot for useSyncExternalStore)
 */
function getSnapshot(): PlaybackState {
  return getStore().state;
}

/**
 * Subscribe to playback state changes (for useSyncExternalStore)
 */
function subscribe(callback: () => void): () => void {
  const store = getStore();
  store.listeners.add(callback);
  console.log(`[GLOBAL PLAYBACK STORE] Subscriber added (total: ${store.listeners.size})`);
  
  return () => {
    store.listeners.delete(callback);
    console.log(`[GLOBAL PLAYBACK STORE] Subscriber removed (total: ${store.listeners.size})`);
  };
}

/**
 * React hook to subscribe to global playback state
 * Uses useSyncExternalStore for proper React 18 concurrent mode support
 */
export function usePlaybackState(): PlaybackState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Check if audio is actively playing or buffering
 */
export function useIsAudioActive(): boolean {
  const state = usePlaybackState();
  return state === 'playing' || state === 'buffering';
}

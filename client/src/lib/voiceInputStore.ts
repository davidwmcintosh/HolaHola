/**
 * Global Voice Input Store
 *
 * HMR-resistant store for voice input state + callbacks. ImmersiveOverlay
 * sits outside StreamingVoiceChat's VoiceInputContext.Provider in the tree,
 * so it reads from here instead.
 *
 * Usage:
 *   import { useGlobalVoiceInput, setGlobalVoiceInput } from '@/lib/voiceInputStore';
 *   const voice = useGlobalVoiceInput(); // null until StreamingVoiceChat mounts
 */

import { useSyncExternalStore } from 'react';
import type { VoiceInputMode } from '@shared/streaming-voice-types';

export interface GlobalVoiceInputState {
  inputMode: VoiceInputMode;
  setInputMode: (mode: VoiceInputMode) => void;
  isRecording: boolean;
  isMicPreparing: boolean;
  isUsersTurn: boolean;
  playbackState: 'idle' | 'buffering' | 'playing' | 'paused';
  onRecordingStart: (inputType?: 'mouse' | 'touch' | 'keyboard') => void;
  onRecordingStop: (inputType?: 'mouse' | 'touch' | 'keyboard' | 'force') => void;
  onInterrupt?: () => void;
}

declare global {
  interface Window {
    __voiceInputStore?: {
      state: GlobalVoiceInputState | null;
      listeners: Set<() => void>;
    };
  }
}

function getStore() {
  if (!window.__voiceInputStore) {
    window.__voiceInputStore = {
      state: null,
      listeners: new Set(),
    };
  }
  return window.__voiceInputStore;
}

export function setGlobalVoiceInput(state: GlobalVoiceInputState | null): void {
  const store = getStore();
  store.state = state;
  store.listeners.forEach(l => l());
}

export function getGlobalVoiceInput(): GlobalVoiceInputState | null {
  return getStore().state;
}

function getSnapshot(): GlobalVoiceInputState | null {
  return getStore().state;
}

function subscribe(callback: () => void): () => void {
  const store = getStore();
  store.listeners.add(callback);
  return () => {
    store.listeners.delete(callback);
  };
}

export function useGlobalVoiceInput(): GlobalVoiceInputState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

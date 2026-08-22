import { createContext, useContext } from "react";
import type { VoiceInputMode } from "@shared/streaming-voice-types";

export interface VoiceInputContextValue {
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

export const VoiceInputContext = createContext<VoiceInputContextValue | null>(null);

export function useVoiceInput(): VoiceInputContextValue | null {
  return useContext(VoiceInputContext);
}

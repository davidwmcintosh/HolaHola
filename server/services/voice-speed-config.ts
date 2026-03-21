export type VoiceSpeedOption = 'slower' | 'slow' | 'normal' | 'fast' | 'faster';

export function voiceSpeedToRate(speed: VoiceSpeedOption | undefined): number {
  switch (speed) {
    case 'slower': return 0.6;
    case 'slow': return 0.8;
    case 'normal': return 1.0;
    case 'fast': return 1.25;
    case 'faster': return 1.5;
    default: return 1.0;
  }
}

export interface VoiceMetricTotals {
  exchangeCount: number;
  studentSpeakingSeconds: number;
  tutorSpeakingSeconds: number;
  ttsCharacters: number;
  sttSeconds: number;
}

export interface CurrentGeminiLiveMetrics {
  exchangeCount: number;
  studentSpeakingMs: number;
  tutorSpeakingMs: number;
  outputCharacters: number;
}

export function advanceCompletedExchangeForEpoch(
  lastCountedStudentTurnEpoch: number,
  activeStudentTurnEpoch: number,
): { counted: boolean; lastCountedStudentTurnEpoch: number } {
  if (
    activeStudentTurnEpoch <= 0
    || activeStudentTurnEpoch <= lastCountedStudentTurnEpoch
  ) {
    return { counted: false, lastCountedStudentTurnEpoch };
  }

  return {
    counted: true,
    lastCountedStudentTurnEpoch: activeStudentTurnEpoch,
  };
}

/**
 * Prior connections and legacy paths live in base. A currently active Gemini
 * Live object contributes only the delta accumulated on this connection.
 */
export function combineVoiceMetricTotals(
  base: VoiceMetricTotals,
  currentGl?: CurrentGeminiLiveMetrics | null,
): VoiceMetricTotals {
  if (!currentGl) return { ...base };

  return {
    exchangeCount: base.exchangeCount + currentGl.exchangeCount,
    studentSpeakingSeconds: base.studentSpeakingSeconds + currentGl.studentSpeakingMs / 1000,
    tutorSpeakingSeconds: base.tutorSpeakingSeconds + currentGl.tutorSpeakingMs / 1000,
    ttsCharacters: base.ttsCharacters + currentGl.outputCharacters,
    sttSeconds: base.sttSeconds,
  };
}
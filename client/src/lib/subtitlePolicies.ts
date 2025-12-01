/**
 * Subtitle Policies - ACTFL-Level-Aware Configuration
 * 
 * Defines how subtitles behave at different proficiency levels:
 * - Text reveal timing (when text appears relative to audio)
 * - Highlighting behavior (how words are highlighted during playback)
 * - Mode convergence (when All/Target modes behave the same)
 * 
 * Based on cognitive load theory and ACTFL proficiency descriptors.
 */

export type ProficiencyBand = 'novice' | 'intermediate' | 'advanced';

export interface SubtitlePolicy {
  textReveal: {
    previewLeadTimeMs: number;
    showFullSentenceBeforeAudio: boolean;
    progressiveReveal: boolean;
  };
  
  highlighting: {
    anchorToAudioTime: boolean;
    wordOffsetMs: number;
    showAllWordsImmediately: boolean;
  };
  
  modes: {
    targetOnlyShowsContext: boolean;
    autoConvergeModes: boolean;
    targetEmphasisStyle: 'isolated' | 'highlighted' | 'none';
  };
  
  timing: {
    preferCartesiaTimestamps: boolean;
    fallbackToServerEstimates: boolean;
    recalibrateWithActualDuration: boolean;
  };
}

/**
 * Known difficulty strings that may come from various sources
 * Including placement tests, class settings, and manual selection
 */
const DIFFICULTY_MAP: Record<string, ProficiencyBand> = {
  // Standard levels
  'beginner': 'novice',
  'elementary': 'novice',
  'novice': 'novice',
  'novice-low': 'novice',
  'novice-mid': 'novice',
  'novice-high': 'novice',
  
  // Intermediate variants
  'intermediate': 'intermediate',
  'intermediate-low': 'intermediate',
  'intermediate-mid': 'intermediate',
  'intermediate-high': 'intermediate',
  'pre-intermediate': 'intermediate',
  'upper-intermediate': 'intermediate',
  
  // Advanced variants
  'advanced': 'advanced',
  'advanced-low': 'advanced',
  'advanced-mid': 'advanced',
  'advanced-high': 'advanced',
  'advanced-plus': 'advanced',
  'pre-advanced': 'advanced',
  
  // Superior/Distinguished (map to advanced for timing purposes)
  'superior': 'advanced',
  'distinguished': 'advanced',
  'native': 'advanced',
  'fluent': 'advanced',
};

/**
 * Maps difficulty level strings to proficiency bands
 * Handles variations like 'beginner', 'intermediate-high', 'advanced-plus', etc.
 * 
 * @param difficulty - Raw difficulty string from session config, placement test, or class settings
 * @returns Normalized proficiency band (defaults to 'novice' for unknown/undefined)
 */
export function difficultyToProficiencyBand(difficulty: string | undefined | null): ProficiencyBand {
  if (!difficulty) return 'novice';
  
  const lower = difficulty.toLowerCase().trim();
  
  // Direct lookup first
  if (DIFFICULTY_MAP[lower]) {
    return DIFFICULTY_MAP[lower];
  }
  
  // Fuzzy matching for variations with spaces or different separators
  const normalized = lower.replace(/[_\s]+/g, '-');
  if (DIFFICULTY_MAP[normalized]) {
    return DIFFICULTY_MAP[normalized];
  }
  
  // Prefix matching for any remaining variations
  if (lower.startsWith('nov') || lower.startsWith('beg') || lower.startsWith('elem')) return 'novice';
  if (lower.startsWith('int') || lower.startsWith('pre-int') || lower.startsWith('upper-int')) return 'intermediate';
  if (lower.startsWith('adv') || lower.startsWith('pre-adv') || lower.startsWith('sup') || lower.startsWith('dist')) return 'advanced';
  
  // Default to novice for unknown levels (safer for learners)
  console.warn(`[SubtitlePolicies] Unknown difficulty level "${difficulty}", defaulting to novice`);
  return 'novice';
}

/**
 * ACTFL-level-aware subtitle policies
 * 
 * Novice: Focused learning, isolated target words, preview time before audio
 * Intermediate: Full sentences visible, synchronized highlighting
 * Advanced: Modes converge, emphasis on natural rhythm and stress
 */
export const SUBTITLE_POLICIES: Record<ProficiencyBand, SubtitlePolicy> = {
  novice: {
    textReveal: {
      previewLeadTimeMs: 300,
      showFullSentenceBeforeAudio: false,
      progressiveReveal: true,
    },
    highlighting: {
      anchorToAudioTime: true,
      wordOffsetMs: 100,
      showAllWordsImmediately: false,
    },
    modes: {
      targetOnlyShowsContext: false,
      autoConvergeModes: false,
      targetEmphasisStyle: 'isolated',
    },
    timing: {
      preferCartesiaTimestamps: true,
      fallbackToServerEstimates: true,
      recalibrateWithActualDuration: true,
    },
  },
  
  intermediate: {
    textReveal: {
      previewLeadTimeMs: 150,
      showFullSentenceBeforeAudio: true,
      progressiveReveal: false,
    },
    highlighting: {
      anchorToAudioTime: true,
      wordOffsetMs: 50,
      showAllWordsImmediately: true,
    },
    modes: {
      targetOnlyShowsContext: true,
      autoConvergeModes: false,
      targetEmphasisStyle: 'highlighted',
    },
    timing: {
      preferCartesiaTimestamps: true,
      fallbackToServerEstimates: true,
      recalibrateWithActualDuration: true,
    },
  },
  
  advanced: {
    textReveal: {
      previewLeadTimeMs: 0,
      showFullSentenceBeforeAudio: true,
      progressiveReveal: false,
    },
    highlighting: {
      anchorToAudioTime: true,
      wordOffsetMs: 0,
      showAllWordsImmediately: true,
    },
    modes: {
      targetOnlyShowsContext: true,
      autoConvergeModes: true,
      targetEmphasisStyle: 'none',
    },
    timing: {
      preferCartesiaTimestamps: true,
      fallbackToServerEstimates: true,
      recalibrateWithActualDuration: true,
    },
  },
};

/**
 * Get the subtitle policy for a given difficulty level
 */
export function getSubtitlePolicy(difficulty: string | undefined | null): SubtitlePolicy {
  const band = difficultyToProficiencyBand(difficulty);
  return SUBTITLE_POLICIES[band];
}

/**
 * Check if modes should converge for the given difficulty
 * At advanced levels, All and Target modes behave the same
 */
export function shouldConvergeModes(difficulty: string | undefined | null): boolean {
  const policy = getSubtitlePolicy(difficulty);
  return policy.modes.autoConvergeModes;
}

/**
 * Get effective subtitle mode, accounting for mode convergence at higher levels
 */
export function getEffectiveSubtitleMode(
  selectedMode: 'off' | 'target' | 'all',
  difficulty: string | undefined | null
): 'off' | 'target' | 'all' {
  if (selectedMode === 'off') return 'off';
  
  if (shouldConvergeModes(difficulty)) {
    return 'all';
  }
  
  return selectedMode;
}

/**
 * Calculate the timing offset for word highlighting based on proficiency
 * Lower levels get more lead time to process text before audio
 * 
 * Returns offset in SECONDS (for use with audio.currentTime)
 */
export function getWordHighlightOffset(difficulty: string | undefined | null): number {
  const policy = getSubtitlePolicy(difficulty);
  return policy.highlighting.wordOffsetMs / 1000;
}

/**
 * Check if text should be revealed progressively (word-by-word) or all at once
 */
export function shouldRevealProgressively(difficulty: string | undefined | null): boolean {
  const policy = getSubtitlePolicy(difficulty);
  return policy.textReveal.progressiveReveal;
}

/**
 * Get preview lead time before audio starts, in seconds
 */
export function getPreviewLeadTime(difficulty: string | undefined | null): number {
  const policy = getSubtitlePolicy(difficulty);
  return policy.textReveal.previewLeadTimeMs / 1000;
}

/**
 * Check if the full sentence should be shown before audio starts
 */
export function shouldShowFullSentenceBeforeAudio(difficulty: string | undefined | null): boolean {
  const policy = getSubtitlePolicy(difficulty);
  return policy.textReveal.showFullSentenceBeforeAudio;
}

/**
 * Get the target emphasis style for the given difficulty
 * - 'isolated': Only target language shown
 * - 'highlighted': Target emphasized within context
 * - 'none': No special emphasis (for advanced)
 */
export function getTargetEmphasisStyle(difficulty: string | undefined | null): 'isolated' | 'highlighted' | 'none' {
  const policy = getSubtitlePolicy(difficulty);
  return policy.modes.targetEmphasisStyle;
}

/* =============================================================================
   TIMING TELEMETRY - Instrumentation for subtitle sync diagnostics
   ============================================================================= */

export interface SubtitleTelemetryEntry {
  timestamp: number;
  event: 'playback_start' | 'word_highlight' | 'sentence_complete' | 'timing_error';
  turnId: number;
  sentenceIndex: number;
  audioTime: number;
  wallClockTime: number;
  timingSource: 'audio' | 'perf';
  wordIndex?: number;
  wordText?: string;
  expectedTime?: number;
  drift?: number;
  difficulty?: string;
  proficiencyBand?: ProficiencyBand;
}

/**
 * Telemetry buffer - stores timing events for analysis
 * Limited to last 500 entries to prevent memory issues
 */
const telemetryBuffer: SubtitleTelemetryEntry[] = [];
const MAX_TELEMETRY_ENTRIES = 500;
let telemetryEnabled = true;

/**
 * Enable or disable timing telemetry
 */
export function setTelemetryEnabled(enabled: boolean): void {
  telemetryEnabled = enabled;
  console.log(`[SubtitleTelemetry] Telemetry ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Log a timing event for diagnostics
 */
export function logTimingEvent(entry: Omit<SubtitleTelemetryEntry, 'timestamp'>): void {
  if (!telemetryEnabled) return;
  
  const fullEntry: SubtitleTelemetryEntry = {
    ...entry,
    timestamp: Date.now(),
  };
  
  telemetryBuffer.push(fullEntry);
  
  // Keep buffer bounded
  if (telemetryBuffer.length > MAX_TELEMETRY_ENTRIES) {
    telemetryBuffer.shift();
  }
  
  // Log errors and significant drift to console
  if (entry.event === 'timing_error') {
    console.warn('[SubtitleTelemetry] Timing error:', entry);
  } else if (entry.drift !== undefined && Math.abs(entry.drift) > 0.2) {
    console.log(`[SubtitleTelemetry] Drift detected: ${entry.drift.toFixed(3)}s at word "${entry.wordText}" (turn ${entry.turnId})`);
  }
}

/**
 * Get telemetry summary for a specific turn
 */
export function getTurnTelemetry(turnId: number): {
  avgDrift: number;
  maxDrift: number;
  timingErrors: number;
  wordCount: number;
  driftByIndex: { index: number; drift: number }[];
} {
  const turnEntries = telemetryBuffer.filter(e => e.turnId === turnId && e.event === 'word_highlight');
  
  if (turnEntries.length === 0) {
    return { avgDrift: 0, maxDrift: 0, timingErrors: 0, wordCount: 0, driftByIndex: [] };
  }
  
  const drifts = turnEntries
    .filter(e => e.drift !== undefined)
    .map(e => ({ index: e.wordIndex || 0, drift: e.drift! }));
  
  const driftValues = drifts.map(d => d.drift);
  const avgDrift = driftValues.reduce((a, b) => a + b, 0) / driftValues.length;
  const maxDrift = Math.max(...driftValues.map(Math.abs));
  const timingErrors = telemetryBuffer.filter(e => e.turnId === turnId && e.event === 'timing_error').length;
  
  return {
    avgDrift,
    maxDrift,
    timingErrors,
    wordCount: turnEntries.length,
    driftByIndex: drifts,
  };
}

/**
 * Get overall telemetry summary
 */
export function getTelemetrySummary(): {
  totalEvents: number;
  avgDrift: number;
  maxDrift: number;
  timingErrors: number;
  byProficiency: Record<ProficiencyBand, { avgDrift: number; count: number }>;
} {
  const wordEvents = telemetryBuffer.filter(e => e.event === 'word_highlight' && e.drift !== undefined);
  
  if (wordEvents.length === 0) {
    return {
      totalEvents: telemetryBuffer.length,
      avgDrift: 0,
      maxDrift: 0,
      timingErrors: 0,
      byProficiency: {
        novice: { avgDrift: 0, count: 0 },
        intermediate: { avgDrift: 0, count: 0 },
        advanced: { avgDrift: 0, count: 0 },
      },
    };
  }
  
  const driftValues = wordEvents.map(e => e.drift!);
  const avgDrift = driftValues.reduce((a, b) => a + b, 0) / driftValues.length;
  const maxDrift = Math.max(...driftValues.map(Math.abs));
  const timingErrors = telemetryBuffer.filter(e => e.event === 'timing_error').length;
  
  const byProficiency: Record<ProficiencyBand, { avgDrift: number; count: number }> = {
    novice: { avgDrift: 0, count: 0 },
    intermediate: { avgDrift: 0, count: 0 },
    advanced: { avgDrift: 0, count: 0 },
  };
  
  const bands: ProficiencyBand[] = ['novice', 'intermediate', 'advanced'];
  for (const band of bands) {
    const bandEvents = wordEvents.filter(e => e.proficiencyBand === band);
    if (bandEvents.length > 0) {
      byProficiency[band] = {
        count: bandEvents.length,
        avgDrift: bandEvents.map(e => e.drift!).reduce((a, b) => a + b, 0) / bandEvents.length,
      };
    }
  }
  
  return { totalEvents: telemetryBuffer.length, avgDrift, maxDrift, timingErrors, byProficiency };
}

/**
 * Clear telemetry buffer
 */
export function clearTelemetry(): void {
  telemetryBuffer.length = 0;
  console.log('[SubtitleTelemetry] Buffer cleared');
}

/**
 * Export telemetry as JSON for debugging
 */
export function exportTelemetry(): string {
  return JSON.stringify({
    summary: getTelemetrySummary(),
    entries: telemetryBuffer,
  }, null, 2);
}

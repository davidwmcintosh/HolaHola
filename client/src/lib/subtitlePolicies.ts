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

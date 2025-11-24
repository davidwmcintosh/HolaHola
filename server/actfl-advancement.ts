/**
 * ACTFL Advancement Algorithm
 * 
 * Implements evidence-based proficiency assessment using FACT criteria:
 * - F: Functions (communication tasks)
 * - A: Accuracy (pronunciation, grammar, vocabulary)
 * - C: Context (range of topics/situations)
 * - T: Text Type (discourse complexity: words→sentences→paragraphs)
 * 
 * Based on ACTFL 2024 World-Readiness Standards
 */

import type { ActflProgress } from "@shared/schema";

// ACTFL proficiency levels in progression order
export const ACTFL_LEVELS = [
  'novice_low',
  'novice_mid',
  'novice_high',
  'intermediate_low',
  'intermediate_mid',
  'intermediate_high',
  'advanced_low',
  'advanced_mid',
  'advanced_high',
  'superior',
  'distinguished'
] as const;

export type ActflLevel = typeof ACTFL_LEVELS[number];

// Text Type progression per ACTFL level
export const TEXT_TYPE_BY_LEVEL: Record<ActflLevel, string> = {
  novice_low: 'words',
  novice_mid: 'words',
  novice_high: 'words',
  intermediate_low: 'sentences',
  intermediate_mid: 'sentences',
  intermediate_high: 'sentences',
  advanced_low: 'paragraphs',
  advanced_mid: 'paragraphs',
  advanced_high: 'paragraphs',
  superior: 'multi_paragraph',
  distinguished: 'multi_paragraph',
};

// Thresholds for advancement consideration
export interface AdvancementThresholds {
  // Minimum practice time (hours) at current level
  minPracticeHours: number;
  
  // Minimum messages at current level
  minMessagesAtLevel: number;
  
  // Minimum days at current level
  minDaysAtLevel: number;
  
  // Functions: Minimum unique tasks mastered
  minTasksCompleted: number;
  
  // Accuracy: Minimum pronunciation confidence (0-1)
  minPronunciationConfidence: number;
  
  // Context: Minimum unique topics covered
  minTopicsCovered: number;
  
  // Text Type: Expected discourse level
  expectedTextType: string;
  
  // Minimum average message length (words)
  minAvgMessageLength: number;
}

// Level-specific advancement thresholds (stricter as levels increase)
export const ADVANCEMENT_THRESHOLDS: Record<ActflLevel, AdvancementThresholds> = {
  novice_low: {
    minPracticeHours: 5,
    minMessagesAtLevel: 50,
    minDaysAtLevel: 7,
    minTasksCompleted: 3, // e.g., greetings, self-introduction, basic questions
    minPronunciationConfidence: 0.70, // 70%
    minTopicsCovered: 2, // e.g., family, hobbies
    expectedTextType: 'words',
    minAvgMessageLength: 1,
  },
  novice_mid: {
    minPracticeHours: 10,
    minMessagesAtLevel: 80,
    minDaysAtLevel: 14,
    minTasksCompleted: 6,
    minPronunciationConfidence: 0.75,
    minTopicsCovered: 4,
    expectedTextType: 'words',
    minAvgMessageLength: 2,
  },
  novice_high: {
    minPracticeHours: 15,
    minMessagesAtLevel: 120,
    minDaysAtLevel: 21,
    minTasksCompleted: 10,
    minPronunciationConfidence: 0.78,
    minTopicsCovered: 6,
    expectedTextType: 'words',
    minAvgMessageLength: 3,
  },
  intermediate_low: {
    minPracticeHours: 25,
    minMessagesAtLevel: 150,
    minDaysAtLevel: 30,
    minTasksCompleted: 15,
    minPronunciationConfidence: 0.80,
    minTopicsCovered: 8,
    expectedTextType: 'sentences',
    minAvgMessageLength: 5,
  },
  intermediate_mid: {
    minPracticeHours: 40,
    minMessagesAtLevel: 200,
    minDaysAtLevel: 45,
    minTasksCompleted: 20,
    minPronunciationConfidence: 0.82,
    minTopicsCovered: 12,
    expectedTextType: 'sentences',
    minAvgMessageLength: 7,
  },
  intermediate_high: {
    minPracticeHours: 60,
    minMessagesAtLevel: 250,
    minDaysAtLevel: 60,
    minTasksCompleted: 25,
    minPronunciationConfidence: 0.84,
    minTopicsCovered: 15,
    expectedTextType: 'sentences',
    minAvgMessageLength: 10,
  },
  advanced_low: {
    minPracticeHours: 80,
    minMessagesAtLevel: 300,
    minDaysAtLevel: 90,
    minTasksCompleted: 30,
    minPronunciationConfidence: 0.86,
    minTopicsCovered: 20,
    expectedTextType: 'paragraphs',
    minAvgMessageLength: 15,
  },
  advanced_mid: {
    minPracticeHours: 120,
    minMessagesAtLevel: 400,
    minDaysAtLevel: 120,
    minTasksCompleted: 40,
    minPronunciationConfidence: 0.88,
    minTopicsCovered: 25,
    expectedTextType: 'paragraphs',
    minAvgMessageLength: 20,
  },
  advanced_high: {
    minPracticeHours: 180,
    minMessagesAtLevel: 500,
    minDaysAtLevel: 180,
    minTasksCompleted: 50,
    minPronunciationConfidence: 0.90,
    minTopicsCovered: 30,
    expectedTextType: 'paragraphs',
    minAvgMessageLength: 25,
  },
  superior: {
    minPracticeHours: 300,
    minMessagesAtLevel: 800,
    minDaysAtLevel: 365,
    minTasksCompleted: 70,
    minPronunciationConfidence: 0.92,
    minTopicsCovered: 40,
    expectedTextType: 'multi_paragraph',
    minAvgMessageLength: 35,
  },
  distinguished: {
    // Distinguished is the highest level - maintained, not advanced from
    minPracticeHours: Infinity,
    minMessagesAtLevel: Infinity,
    minDaysAtLevel: Infinity,
    minTasksCompleted: 100,
    minPronunciationConfidence: 0.95,
    minTopicsCovered: 50,
    expectedTextType: 'multi_paragraph',
    minAvgMessageLength: 50,
  },
};

/**
 * Advancement readiness assessment result
 */
export interface AdvancementAssessment {
  currentLevel: ActflLevel;
  nextLevel: ActflLevel | null;
  readyForAdvancement: boolean;
  progress: number; // 0-100 percentage toward next level
  
  // Detailed FACT criteria evaluation
  factEvaluation: {
    functions: {
      met: boolean;
      current: number;
      required: number;
      percentage: number;
    };
    accuracy: {
      met: boolean;
      current: number; // 0-1
      required: number; // 0-1
      percentage: number;
    };
    context: {
      met: boolean;
      current: number;
      required: number;
      percentage: number;
    };
    textType: {
      met: boolean;
      current: string;
      expected: string;
      avgMessageLength: number;
      requiredAvgLength: number;
    };
    sustainedPerformance: {
      met: boolean;
      hours: number;
      requiredHours: number;
      messages: number;
      requiredMessages: number;
      days: number;
      requiredDays: number;
    };
  };
  
  reason: string; // Human-readable explanation
  suggestions: string[]; // Actionable recommendations
}

/**
 * Evaluate student's readiness for ACTFL level advancement
 */
export function assessAdvancementReadiness(
  progress: ActflProgress
): AdvancementAssessment {
  const currentLevel = (progress.currentActflLevel || 'novice_low') as ActflLevel;
  const currentLevelIndex = ACTFL_LEVELS.indexOf(currentLevel);
  
  // Check if already at highest level
  if (currentLevelIndex === ACTFL_LEVELS.length - 1) {
    return {
      currentLevel,
      nextLevel: null,
      readyForAdvancement: false,
      progress: 100,
      factEvaluation: createMaxLevelEvaluation(progress, currentLevel),
      reason: `You've reached ${formatLevel(currentLevel)} - the highest proficiency level!`,
      suggestions: ['Continue practicing to maintain your exceptional skills'],
    };
  }
  
  const nextLevel = ACTFL_LEVELS[currentLevelIndex + 1];
  const thresholds = ADVANCEMENT_THRESHOLDS[currentLevel];
  
  // Evaluate FACT criteria
  const functionsMet = progress.tasksTotal >= thresholds.minTasksCompleted;
  const functionsProgress = Math.min(100, (progress.tasksTotal / thresholds.minTasksCompleted) * 100);
  
  const accuracyMet = (progress.avgPronunciationConfidence || 0) >= thresholds.minPronunciationConfidence;
  const accuracyProgress = Math.min(100, ((progress.avgPronunciationConfidence || 0) / thresholds.minPronunciationConfidence) * 100);
  
  const contextMet = progress.topicsTotal >= thresholds.minTopicsCovered;
  const contextProgress = Math.min(100, (progress.topicsTotal / thresholds.minTopicsCovered) * 100);
  
  const textTypeMet = 
    progress.textType === thresholds.expectedTextType &&
    (progress.avgMessageLength || 0) >= thresholds.minAvgMessageLength;
  const textTypeProgress = Math.min(100, ((progress.avgMessageLength || 0) / thresholds.minAvgMessageLength) * 100);
  
  const sustainedPerformanceMet =
    (progress.practiceHours || 0) >= thresholds.minPracticeHours &&
    (progress.messagesAtCurrentLevel || 0) >= thresholds.minMessagesAtLevel &&
    (progress.daysAtCurrentLevel || 0) >= thresholds.minDaysAtLevel;
  
  const sustainedProgress = Math.min(100, 
    ((progress.practiceHours || 0) / thresholds.minPracticeHours +
     (progress.messagesAtCurrentLevel || 0) / thresholds.minMessagesAtLevel +
     (progress.daysAtCurrentLevel || 0) / thresholds.minDaysAtLevel) / 3 * 100
  );
  
  // All FACT criteria must be met for advancement
  const allCriteriaMet = 
    functionsMet && 
    accuracyMet && 
    contextMet && 
    textTypeMet && 
    sustainedPerformanceMet;
  
  // Overall progress is the minimum of all criteria (weakest link determines readiness)
  const overallProgress = Math.min(
    functionsProgress,
    accuracyProgress,
    contextProgress,
    textTypeProgress,
    sustainedProgress
  );
  
  // Build suggestions based on unmet criteria
  const suggestions: string[] = [];
  if (!functionsMet) {
    suggestions.push(`Practice ${thresholds.minTasksCompleted - progress.tasksTotal} more communication tasks`);
  }
  if (!accuracyMet) {
    const needed = Math.round((thresholds.minPronunciationConfidence - (progress.avgPronunciationConfidence || 0)) * 100);
    suggestions.push(`Improve pronunciation accuracy by ${needed}%`);
  }
  if (!contextMet) {
    suggestions.push(`Explore ${thresholds.minTopicsCovered - progress.topicsTotal} more topics`);
  }
  if (!textTypeMet) {
    if (progress.textType !== thresholds.expectedTextType) {
      suggestions.push(`Practice forming ${thresholds.expectedTextType} instead of ${progress.textType}`);
    }
    if ((progress.avgMessageLength || 0) < thresholds.minAvgMessageLength) {
      suggestions.push(`Increase average message length to ${thresholds.minAvgMessageLength} words`);
    }
  }
  if (!sustainedPerformanceMet) {
    if ((progress.practiceHours || 0) < thresholds.minPracticeHours) {
      suggestions.push(`Continue practicing (${Math.round(thresholds.minPracticeHours - (progress.practiceHours || 0))} hours more)`);
    }
  }
  
  const reason = allCriteriaMet
    ? `Congratulations! You've demonstrated ${formatLevel(currentLevel)} proficiency consistently. Ready to advance to ${formatLevel(nextLevel)}!`
    : `Keep practicing! You're ${Math.round(overallProgress)}% ready for ${formatLevel(nextLevel)}.`;
  
  return {
    currentLevel,
    nextLevel,
    readyForAdvancement: allCriteriaMet,
    progress: Math.round(overallProgress),
    factEvaluation: {
      functions: {
        met: functionsMet,
        current: progress.tasksTotal,
        required: thresholds.minTasksCompleted,
        percentage: Math.round(functionsProgress),
      },
      accuracy: {
        met: accuracyMet,
        current: progress.avgPronunciationConfidence || 0,
        required: thresholds.minPronunciationConfidence,
        percentage: Math.round(accuracyProgress),
      },
      context: {
        met: contextMet,
        current: progress.topicsTotal,
        required: thresholds.minTopicsCovered,
        percentage: Math.round(contextProgress),
      },
      textType: {
        met: textTypeMet,
        current: progress.textType || 'words',
        expected: thresholds.expectedTextType,
        avgMessageLength: progress.avgMessageLength || 0,
        requiredAvgLength: thresholds.minAvgMessageLength,
      },
      sustainedPerformance: {
        met: sustainedPerformanceMet,
        hours: progress.practiceHours || 0,
        requiredHours: thresholds.minPracticeHours,
        messages: progress.messagesAtCurrentLevel || 0,
        requiredMessages: thresholds.minMessagesAtLevel,
        days: progress.daysAtCurrentLevel || 0,
        requiredDays: thresholds.minDaysAtLevel,
      },
    },
    reason,
    suggestions,
  };
}

/**
 * Format ACTFL level for display
 */
function formatLevel(level: ActflLevel): string {
  return level
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Create evaluation object for maximum level
 */
function createMaxLevelEvaluation(
  progress: ActflProgress,
  level: ActflLevel
): AdvancementAssessment['factEvaluation'] {
  const thresholds = ADVANCEMENT_THRESHOLDS[level];
  
  return {
    functions: {
      met: true,
      current: progress.tasksTotal,
      required: thresholds.minTasksCompleted,
      percentage: 100,
    },
    accuracy: {
      met: true,
      current: progress.avgPronunciationConfidence || 0,
      required: thresholds.minPronunciationConfidence,
      percentage: 100,
    },
    context: {
      met: true,
      current: progress.topicsTotal,
      required: thresholds.minTopicsCovered,
      percentage: 100,
    },
    textType: {
      met: true,
      current: progress.textType || 'multi_paragraph',
      expected: thresholds.expectedTextType,
      avgMessageLength: progress.avgMessageLength || 0,
      requiredAvgLength: thresholds.minAvgMessageLength,
    },
    sustainedPerformance: {
      met: true,
      hours: progress.practiceHours || 0,
      requiredHours: thresholds.minPracticeHours,
      messages: progress.messagesAtCurrentLevel || 0,
      requiredMessages: thresholds.minMessagesAtLevel,
      days: progress.daysAtCurrentLevel || 0,
      requiredDays: thresholds.minDaysAtLevel,
    },
  };
}

/**
 * Advance student to next ACTFL level (call after assessment confirms readiness)
 */
export function advanceToNextLevel(currentLevel: ActflLevel): ActflLevel | null {
  const currentIndex = ACTFL_LEVELS.indexOf(currentLevel);
  if (currentIndex === -1 || currentIndex === ACTFL_LEVELS.length - 1) {
    return null; // Invalid level or already at max
  }
  return ACTFL_LEVELS[currentIndex + 1];
}

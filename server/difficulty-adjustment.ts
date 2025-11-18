/**
 * Auto-Difficulty Adjustment System
 * 
 * Analyzes user performance and recommends difficulty level changes
 * to keep learners in their optimal learning zone.
 */

export interface PerformanceAnalysis {
  successRate: number; // 0-1: Percentage of successful messages
  totalAssessed: number; // Number of messages assessed
  averageScore: number; // Average performance score
  recommendedDifficulty: string | null; // Suggested difficulty level
  shouldAdjust: boolean; // Whether adjustment is recommended
  reason: string; // Explanation for recommendation
}

export interface DifficultyThresholds {
  moveUpThreshold: number; // Success rate to move up (default: 0.80)
  moveDownThreshold: number; // Success rate to move down (default: 0.40)
  minMessagesRequired: number; // Minimum messages before adjusting (default: 20)
  cooldownHours: number; // Hours between adjustments (default: 24)
}

const DEFAULT_THRESHOLDS: DifficultyThresholds = {
  moveUpThreshold: 0.80,
  moveDownThreshold: 0.40,
  minMessagesRequired: 20,
  cooldownHours: 24,
};

const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];
const SUCCESS_SCORE = 60; // Score threshold to count as successful

/**
 * Analyze conversation performance and recommend difficulty adjustments
 */
export function analyzePerformance(
  successfulMessages: number,
  totalAssessedMessages: number,
  currentDifficulty: string,
  lastAdjustment: Date | null,
  recentScores: number[], // Recent message scores for average calculation
  thresholds: Partial<DifficultyThresholds> = {}
): PerformanceAnalysis {
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };
  
  // Calculate success rate
  const successRate = totalAssessedMessages > 0 
    ? successfulMessages / totalAssessedMessages 
    : 0;
  
  // Calculate average score
  const averageScore = recentScores.length > 0
    ? recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
    : 0;
  
  // Check if we have enough data
  if (totalAssessedMessages < config.minMessagesRequired) {
    return {
      successRate,
      totalAssessed: totalAssessedMessages,
      averageScore,
      recommendedDifficulty: null,
      shouldAdjust: false,
      reason: `Need ${config.minMessagesRequired - totalAssessedMessages} more assessed messages before adjusting difficulty.`,
    };
  }
  
  // Check cooldown period
  if (lastAdjustment) {
    const hoursSinceAdjustment = (Date.now() - lastAdjustment.getTime()) / (1000 * 60 * 60);
    if (hoursSinceAdjustment < config.cooldownHours) {
      const hoursRemaining = Math.ceil(config.cooldownHours - hoursSinceAdjustment);
      return {
        successRate,
        totalAssessed: totalAssessedMessages,
        averageScore,
        recommendedDifficulty: null,
        shouldAdjust: false,
        reason: `Wait ${hoursRemaining} more hour(s) before adjusting again.`,
      };
    }
  }
  
  // Determine recommendation based on success rate
  const currentLevel = DIFFICULTY_LEVELS.indexOf(currentDifficulty);
  
  if (successRate >= config.moveUpThreshold && currentLevel < DIFFICULTY_LEVELS.length - 1) {
    // Move up - user is performing very well
    const newDifficulty = DIFFICULTY_LEVELS[currentLevel + 1];
    return {
      successRate,
      totalAssessed: totalAssessedMessages,
      averageScore,
      recommendedDifficulty: newDifficulty,
      shouldAdjust: true,
      reason: `Great progress! ${Math.round(successRate * 100)}% success rate. Ready for ${newDifficulty}.`,
    };
  }
  
  if (successRate <= config.moveDownThreshold && currentLevel > 0) {
    // Move down - user is struggling
    const newDifficulty = DIFFICULTY_LEVELS[currentLevel - 1];
    return {
      successRate,
      totalAssessed: totalAssessedMessages,
      averageScore,
      recommendedDifficulty: newDifficulty,
      shouldAdjust: true,
      reason: `Let's adjust to ${newDifficulty} for better learning. ${Math.round(successRate * 100)}% success rate.`,
    };
  }
  
  // Stay at current level - performing appropriately
  return {
    successRate,
    totalAssessed: totalAssessedMessages,
    averageScore,
    recommendedDifficulty: null,
    shouldAdjust: false,
    reason: `Current ${currentDifficulty} level is perfect! ${Math.round(successRate * 100)}% success rate.`,
  };
}

/**
 * Assess a user message and return a performance score (0-100)
 * This will be called by the AI to evaluate message quality
 */
export interface MessageAssessment {
  score: number; // 0-100
  isSuccessful: boolean; // score >= SUCCESS_SCORE
  feedback?: string; // Optional feedback for the user
}

/**
 * Simple scoring helper (can be enhanced with AI assessment later)
 * Scores based on basic metrics like message length and engagement
 */
export function assessMessage(
  message: string,
  difficulty: string
): MessageAssessment {
  let score = 50; // Base score
  
  const wordCount = message.split(/\s+/).filter(w => w.length > 0).length;
  
  // Adjust based on word count (appropriate response length)
  if (wordCount >= 5 && wordCount <= 30) {
    score += 20; // Good length
  } else if (wordCount >= 3) {
    score += 10; // Acceptable length
  }
  
  // Bonus for using target language characters (basic heuristic)
  const hasNonEnglish = /[À-ÿ\u3040-\u30ff\u4e00-\u9fff\u1100-\u11ff]/.test(message);
  if (hasNonEnglish && difficulty !== 'beginner') {
    score += 15;
  }
  
  // Penalize very short responses
  if (wordCount < 3) {
    score -= 20;
  }
  
  // Ensure score stays in 0-100 range
  score = Math.max(0, Math.min(100, score));
  
  return {
    score,
    isSuccessful: score >= SUCCESS_SCORE,
  };
}

/**
 * Get the next difficulty level (up or down)
 */
export function getNextDifficultyLevel(
  currentDifficulty: string,
  direction: 'up' | 'down'
): string | null {
  const currentIndex = DIFFICULTY_LEVELS.indexOf(currentDifficulty);
  
  if (direction === 'up' && currentIndex < DIFFICULTY_LEVELS.length - 1) {
    return DIFFICULTY_LEVELS[currentIndex + 1];
  }
  
  if (direction === 'down' && currentIndex > 0) {
    return DIFFICULTY_LEVELS[currentIndex - 1];
  }
  
  return null; // Can't move in that direction
}

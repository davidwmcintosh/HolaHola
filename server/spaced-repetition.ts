/**
 * SM-2 Spaced Repetition Algorithm
 * 
 * This algorithm calculates optimal review intervals based on user performance.
 * Quality ratings: 0-5 scale
 * - 0-2: Incorrect (card forgotten, reset interval)
 * - 3-5: Correct (increase interval based on ease factor)
 */

export interface ReviewResult {
  nextReviewDate: Date;
  easeFactor: number;
  interval: number;
  correctCount: number;
  incorrectCount: number;
  repetition: number;
}

export interface CardState {
  easeFactor: number;
  interval: number;
  correctCount: number;
  incorrectCount: number;
  repetition: number;
}

/**
 * Calculate next review parameters based on user performance
 * @param quality - Performance rating (0-5): 0-2 = incorrect, 3-5 = correct
 * @param currentState - Current card state (easeFactor, interval, counts)
 * @returns Updated review parameters
 */
export function calculateNextReview(
  quality: number,
  currentState: CardState
): ReviewResult {
  const { easeFactor, interval, correctCount, incorrectCount, repetition } = currentState;
  
  // Validate quality (0-5 scale)
  const clampedQuality = Math.max(0, Math.min(5, quality));
  
  // Determine if answer was correct (quality >= 3)
  const isCorrect = clampedQuality >= 3;
  
  // Update lifetime counts
  const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;
  const newIncorrectCount = isCorrect ? incorrectCount : incorrectCount + 1;
  
  // Update repetition (consecutive correct reviews)
  // Reset to 0 on failure, increment on success
  const newRepetition = isCorrect ? repetition + 1 : 0;
  
  // Calculate new ease factor (SM-2 formula)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let newEaseFactor = easeFactor + (0.1 - (5 - clampedQuality) * (0.08 + (5 - clampedQuality) * 0.02));
  
  // Ease factor minimum is 1.3
  newEaseFactor = Math.max(1.3, newEaseFactor);
  
  // Calculate new interval based on SM-2 algorithm using repetition counter
  let newInterval: number;
  
  if (!isCorrect) {
    // Reset to day 1 if incorrect (repetition is already 0)
    newInterval = 1;
  } else {
    // Increase interval based on repetition (consecutive correct reviews)
    if (newRepetition === 1) {
      newInterval = 1; // First consecutive correct: review tomorrow
    } else if (newRepetition === 2) {
      newInterval = 6; // Second consecutive correct: review in 6 days
    } else {
      // Subsequent consecutive reviews: multiply previous interval by ease factor
      newInterval = Math.round(interval * newEaseFactor);
    }
  }
  
  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
  
  return {
    nextReviewDate,
    easeFactor: newEaseFactor,
    interval: newInterval,
    correctCount: newCorrectCount,
    incorrectCount: newIncorrectCount,
    repetition: newRepetition,
  };
}

/**
 * Simple wrapper for marking a card as correct (quality 4)
 */
export function markCorrect(currentState: CardState): ReviewResult {
  return calculateNextReview(4, currentState);
}

/**
 * Simple wrapper for marking a card as incorrect (quality 0)
 */
export function markIncorrect(currentState: CardState): ReviewResult {
  return calculateNextReview(0, currentState);
}

/**
 * Check if a card is due for review
 */
export function isDue(nextReviewDate: Date): boolean {
  return new Date() >= new Date(nextReviewDate);
}

/**
 * Check if a card is overdue (past due date by more than 1 day)
 */
export function isOverdue(nextReviewDate: Date): boolean {
  const now = new Date();
  const reviewDate = new Date(nextReviewDate);
  const daysDiff = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > 1;
}

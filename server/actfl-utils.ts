/**
 * ACTFL Level Normalization Utilities
 * 
 * Handles conversion between internal (snake_case) and external (Title Case) ACTFL level formats.
 * Internal format: novice_low, intermediate_mid, advanced_high, etc.
 * External format: Novice Low, Intermediate Mid, Advanced High, etc.
 */

/**
 * Convert external Title Case ACTFL level to internal snake_case format
 * Used when receiving ACTFL levels from frontend/API
 * 
 * @example
 * toInternalActflLevel("Novice Low") // "novice_low"
 * toInternalActflLevel("Intermediate Mid") // "intermediate_mid"
 */
export function toInternalActflLevel(level: string | null | undefined): string | null {
  if (!level) return null;
  
  return level
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_'); // Replace spaces with underscores
}

/**
 * Convert internal snake_case ACTFL level to external Title Case format
 * Used when sending ACTFL levels to frontend/API
 * 
 * @example
 * toExternalActflLevel("novice_low") // "Novice Low"
 * toExternalActflLevel("intermediate_mid") // "Intermediate Mid"
 */
export function toExternalActflLevel(level: string | null | undefined): string | null {
  if (!level) return null;
  
  return level
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Validate if an ACTFL level is valid
 * 
 * Valid levels: novice_low, novice_mid, novice_high,
 *               intermediate_low, intermediate_mid, intermediate_high,
 *               advanced_low, advanced_mid, advanced_high,
 *               superior, distinguished
 */
export function isValidActflLevel(level: string | null | undefined): boolean {
  if (!level) return false;
  
  const validLevels = [
    'novice_low', 'novice_mid', 'novice_high',
    'intermediate_low', 'intermediate_mid', 'intermediate_high',
    'advanced_low', 'advanced_mid', 'advanced_high',
    'superior', 'distinguished'
  ];
  
  const normalizedLevel = toInternalActflLevel(level);
  return normalizedLevel ? validLevels.includes(normalizedLevel) : false;
}

/**
 * Get the next ACTFL level (for progression tracking)
 * Returns null if already at highest level (Distinguished)
 */
export function getNextActflLevel(currentLevel: string | null | undefined): string | null {
  if (!currentLevel) return 'novice_low';
  
  const levelProgression = [
    'novice_low', 'novice_mid', 'novice_high',
    'intermediate_low', 'intermediate_mid', 'intermediate_high',
    'advanced_low', 'advanced_mid', 'advanced_high',
    'superior', 'distinguished'
  ];
  
  const normalizedCurrent = toInternalActflLevel(currentLevel);
  if (!normalizedCurrent) return 'novice_low';
  
  const currentIndex = levelProgression.indexOf(normalizedCurrent);
  if (currentIndex === -1 || currentIndex === levelProgression.length - 1) {
    return null; // Invalid level or already at max
  }
  
  return levelProgression[currentIndex + 1];
}

/**
 * Get the previous ACTFL level (for level adjustment)
 * Returns null if already at lowest level (Novice Low)
 */
export function getPreviousActflLevel(currentLevel: string | null | undefined): string | null {
  if (!currentLevel) return null;
  
  const levelProgression = [
    'novice_low', 'novice_mid', 'novice_high',
    'intermediate_low', 'intermediate_mid', 'intermediate_high',
    'advanced_low', 'advanced_mid', 'advanced_high',
    'superior', 'distinguished'
  ];
  
  const normalizedCurrent = toInternalActflLevel(currentLevel);
  if (!normalizedCurrent) return null;
  
  const currentIndex = levelProgression.indexOf(normalizedCurrent);
  if (currentIndex <= 0) {
    return null; // Invalid level or already at min
  }
  
  return levelProgression[currentIndex - 1];
}

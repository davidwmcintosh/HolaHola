/**
 * Live Pronunciation Coaching Service
 * 
 * Analyzes Deepgram word-level confidence scores during voice chat
 * to provide real-time pronunciation feedback and coaching tips.
 * 
 * Uses the existing word-level confidence data from transcribeWithLiveAPI
 * to identify pronunciation difficulties and generate actionable coaching.
 */

export interface WordConfidence {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

export interface PronunciationCoaching {
  overallScore: number;
  wordFeedback: WordFeedback[];
  coachingTips: string[];
  encouragement: string;
  needsAttention: boolean;
  lowConfidenceWords: string[];
  phonemeHints: PhonemeHint[];
}

interface WordFeedback {
  word: string;
  confidence: number;
  status: 'excellent' | 'good' | 'needs_work' | 'difficult';
  suggestion?: string;
}

interface PhonemeHint {
  phoneme: string;
  word: string;
  tip: string;
}

const CONFIDENCE_THRESHOLDS = {
  EXCELLENT: 0.95,
  GOOD: 0.85,
  NEEDS_WORK: 0.70,
  DIFFICULT: 0.50,
};

const LANGUAGE_PHONEME_TIPS: Record<string, Record<string, string>> = {
  spanish: {
    'rr': 'Roll your tongue by vibrating the tip against the roof of your mouth',
    'r': 'Tap your tongue once against the roof of your mouth',
    'j': 'Make a rough "h" sound from the back of your throat',
    'ñ': 'Say "ny" as in "canyon"',
    'll': 'In most regions, pronounce like "y" in "yes"',
    'z': 'In most Spanish, pronounce like "s" in "sun"',
    'c': 'Before e/i, pronounce like "s" or "th" depending on region',
    'g': 'Before e/i, make a soft throat sound like "h"',
    'v': 'Pronounce exactly like "b" - lips together',
    'd': 'Between vowels, soften to a "th" sound',
  },
  french: {
    'r': 'Gargle-like sound from the back of your throat',
    'u': 'Round your lips tightly while saying "ee"',
    'ou': 'Say "oo" as in "moon"',
    'eu': 'Round lips while saying "uh"',
    'an': 'Nasalized "on" - don\'t fully close your nose',
    'on': 'Nasalized "oh" - air through both mouth and nose',
    'in': 'Nasalized "an" - lips slightly spread',
    'gn': 'Like "ny" in "canyon"',
    'oi': 'Say "wa" as in "watt"',
  },
  german: {
    'ch': 'After a/o/u: throat clearing sound. After e/i: cat hiss',
    'r': 'Gargle from the back of your throat, or tap the tongue',
    'ü': 'Round lips while saying "ee"',
    'ö': 'Round lips while saying "eh"',
    'ß': 'Always a sharp "s" sound',
    'z': 'Pronounce like "ts" in "cats"',
    'w': 'Pronounce like English "v"',
    'v': 'Usually like "f" unless in foreign words',
    'sp': 'At start of word, say "shp"',
    'st': 'At start of word, say "sht"',
  },
  mandarin: {
    'x': 'Tongue between "s" and "sh" - teeth close together',
    'q': 'Like "ch" but with more air, tongue at front',
    'zh': 'Like "j" but tongue curled back',
    'ch': 'Like "ch" but tongue curled back',
    'sh': 'Like "sh" but tongue curled back',
    'r': 'Between "r" and "zh" - tongue curled back',
    'ü': 'Round lips tightly while saying "ee"',
    'c': 'Like "ts" with a puff of air',
    'z': 'Like "ds" in "words"',
  },
  japanese: {
    'r': 'Between English "r", "l", and "d" - quick tongue tap',
    'tsu': 'Strong "ts" sound - keep teeth close',
    'fu': 'Air through both lips, not teeth on lip',
    'n': 'At word end, more nasal than English "n"',
    'wo': 'Usually just "o" in modern speech',
    'ha': 'Sometimes sounds like "wa" in particles',
    'shi': 'Like English "she" but shorter',
    'chi': 'Like English "chee" but shorter',
  },
  korean: {
    'eo': 'Like "uh" but with lips slightly rounded',
    'eu': 'Like "oo" but with unrounded lips',
    'ae': 'Like "eh" in "bed"',
    'oe': 'Like German "ö" or French "eu"',
    'ui': 'Start with "eu" and glide to "ee"',
    'pp': 'Tense, no air puff - tight lips',
    'tt': 'Tense, no air puff - tight tongue',
    'kk': 'Tense, no air puff - tight throat',
  },
};

const ENCOURAGEMENTS = {
  excellent: [
    'Outstanding pronunciation! You\'re speaking like a native.',
    'Perfect! Your accent is really coming along.',
    'Excellent work! Keep up this great pronunciation.',
    'You\'re nailing it! Beautiful pronunciation.',
  ],
  good: [
    'Good job! A few small refinements and you\'ll sound native.',
    'Nice work! Your pronunciation is improving.',
    'Well done! Just a little more practice on a few sounds.',
    'Great progress! Keep focusing on the tricky sounds.',
  ],
  needsWork: [
    'Keep practicing! Every attempt makes you better.',
    'Good effort! Let\'s work on making those sounds clearer.',
    'You\'re on the right track. Focus on the highlighted words.',
    'Don\'t give up! Pronunciation takes time and practice.',
  ],
  difficult: [
    'This is a challenging phrase. Let\'s break it down.',
    'Take your time - these sounds are tricky for everyone.',
    'Slow down and focus on one word at a time.',
    'Let\'s practice these sounds step by step.',
  ],
};

/**
 * Analyze word-level confidence scores and generate coaching feedback
 */
export function analyzePronunciation(
  words: WordConfidence[],
  targetLanguage: string,
  transcript: string
): PronunciationCoaching {
  if (!words || words.length === 0) {
    return {
      overallScore: 0,
      wordFeedback: [],
      coachingTips: [],
      encouragement: 'No audio detected. Please speak clearly into the microphone.',
      needsAttention: false,
      lowConfidenceWords: [],
      phonemeHints: [],
    };
  }

  const wordFeedback: WordFeedback[] = [];
  const lowConfidenceWords: string[] = [];
  const phonemeHints: PhonemeHint[] = [];
  let totalConfidence = 0;

  const languageTips = LANGUAGE_PHONEME_TIPS[targetLanguage.toLowerCase()] || {};

  for (const word of words) {
    totalConfidence += word.confidence;
    
    let status: WordFeedback['status'];
    let suggestion: string | undefined;

    if (word.confidence >= CONFIDENCE_THRESHOLDS.EXCELLENT) {
      status = 'excellent';
    } else if (word.confidence >= CONFIDENCE_THRESHOLDS.GOOD) {
      status = 'good';
    } else if (word.confidence >= CONFIDENCE_THRESHOLDS.NEEDS_WORK) {
      status = 'needs_work';
      lowConfidenceWords.push(word.word);
      suggestion = `Focus on pronouncing "${word.word}" more clearly`;
    } else {
      status = 'difficult';
      lowConfidenceWords.push(word.word);
      suggestion = `"${word.word}" needs practice - try saying it slowly`;
    }

    wordFeedback.push({
      word: word.word,
      confidence: word.confidence,
      status,
      suggestion,
    });

    if (status === 'needs_work' || status === 'difficult') {
      const hint = findPhonemeHint(word.word, languageTips);
      if (hint) {
        phonemeHints.push({
          phoneme: hint.phoneme,
          word: word.word,
          tip: hint.tip,
        });
      }
    }
  }

  const overallScore = Math.round((totalConfidence / words.length) * 100);
  const needsAttention = lowConfidenceWords.length > 0;

  const coachingTips = generateCoachingTips(wordFeedback, phonemeHints, targetLanguage);
  const encouragement = selectEncouragement(overallScore);

  return {
    overallScore,
    wordFeedback,
    coachingTips,
    encouragement,
    needsAttention,
    lowConfidenceWords,
    phonemeHints,
  };
}

function findPhonemeHint(word: string, languageTips: Record<string, string>): { phoneme: string; tip: string } | null {
  const wordLower = word.toLowerCase();
  
  for (const [phoneme, tip] of Object.entries(languageTips)) {
    if (wordLower.includes(phoneme)) {
      return { phoneme, tip };
    }
  }
  
  return null;
}

function generateCoachingTips(
  wordFeedback: WordFeedback[],
  phonemeHints: PhonemeHint[],
  targetLanguage: string
): string[] {
  const tips: string[] = [];
  
  const difficultWords = wordFeedback.filter(w => w.status === 'difficult' || w.status === 'needs_work');
  
  if (difficultWords.length > 0) {
    const wordList = difficultWords.slice(0, 3).map(w => `"${w.word}"`).join(', ');
    tips.push(`Focus on: ${wordList}`);
  }

  if (phonemeHints.length > 0) {
    const uniqueHints = phonemeHints.slice(0, 2);
    for (const hint of uniqueHints) {
      tips.push(`${hint.phoneme.toUpperCase()}: ${hint.tip}`);
    }
  }

  if (difficultWords.length >= 3) {
    tips.push('Try speaking more slowly to improve clarity');
  }

  if (tips.length === 0 && wordFeedback.length > 0) {
    const excellentCount = wordFeedback.filter(w => w.status === 'excellent').length;
    if (excellentCount === wordFeedback.length) {
      tips.push('Perfect pronunciation! Try a more challenging phrase.');
    } else {
      tips.push('Good work! Keep practicing for even better fluency.');
    }
  }

  return tips;
}

function selectEncouragement(score: number): string {
  let category: keyof typeof ENCOURAGEMENTS;
  
  if (score >= 95) {
    category = 'excellent';
  } else if (score >= 85) {
    category = 'good';
  } else if (score >= 70) {
    category = 'needsWork';
  } else {
    category = 'difficult';
  }
  
  const options = ENCOURAGEMENTS[category];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate quick coaching response for real-time feedback
 * Used during voice chat for immediate pronunciation guidance
 */
export function generateQuickCoaching(
  overallConfidence: number,
  lowConfidenceWords: string[],
  targetLanguage: string
): string {
  if (lowConfidenceWords.length === 0 && overallConfidence >= 0.85) {
    return '';
  }

  if (lowConfidenceWords.length > 0) {
    const wordList = lowConfidenceWords.slice(0, 2).join(', ');
    return `Watch your pronunciation of: ${wordList}`;
  }

  if (overallConfidence < 0.70) {
    return 'Speak more clearly and slowly for better recognition';
  }

  return '';
}

/**
 * Extract pronunciation focus areas from coaching analysis
 * Used to update student learning profile
 */
export function extractPronunciationStruggles(
  coaching: PronunciationCoaching,
  targetLanguage: string
): { phoneme: string; word: string }[] {
  const struggles: { phoneme: string; word: string }[] = [];
  
  for (const hint of coaching.phonemeHints) {
    struggles.push({
      phoneme: hint.phoneme,
      word: hint.word,
    });
  }
  
  return struggles;
}

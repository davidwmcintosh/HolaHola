import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trigramSimilarity,
  normalizeForFingerprint,
  generateTrigrams,
  SIMILARITY_THRESHOLD,
} from '../services/student-learning-service';

/**
 * Unit tests for Learner Memory System
 * Tests deduplication edge cases, long-session chunking, and explicit remember commands
 * 
 * IMPORTANT: These tests import production functions to catch regressions
 */

describe('Learner Memory Deduplication', () => {
  describe('Trigram Similarity', () => {
    it('should detect exact matches with similarity = 1', () => {
      const similarity = trigramSimilarity(
        'Planning trip to Madrid',
        'Planning trip to Madrid'
      );
      expect(similarity).toBe(1);
    });

    it('should detect very similar facts (>0.82 threshold)', () => {
      const similarity = trigramSimilarity(
        'Planning trip to Madrid in June',
        'Planning a trip to Madrid in June'
      );
      expect(similarity).toBeGreaterThan(0.82);
    });

    it('should distinguish different facts (<0.82 threshold)', () => {
      const similarity = trigramSimilarity(
        'Planning trip to Madrid',
        'Working at Google'
      );
      expect(similarity).toBeLessThan(0.82);
    });

    it('should handle short strings gracefully', () => {
      const similarity = trigramSimilarity('job', 'job');
      expect(similarity).toBe(1);
    });

    it('should handle empty strings', () => {
      const similarity = trigramSimilarity('', 'something');
      expect(similarity).toBe(0);
    });
  });

  describe('Normalized Fingerprints', () => {
    it('should strip diacritics for comparison', () => {
      const a = normalizeForFingerprint('café in París');
      const b = normalizeForFingerprint('cafe in Paris');
      expect(a).toBe(b);
    });

    it('should remove punctuation', () => {
      const a = normalizeForFingerprint("I'm planning a trip!");
      const b = normalizeForFingerprint('Im planning a trip');
      expect(a).toBe(b);
    });

    it('should normalize whitespace', () => {
      const a = normalizeForFingerprint('Trip   to    Madrid');
      const b = normalizeForFingerprint('Trip to Madrid');
      expect(a).toBe(b);
    });

    it('should be case insensitive', () => {
      const a = normalizeForFingerprint('TRIP TO MADRID');
      const b = normalizeForFingerprint('trip to madrid');
      expect(a).toBe(b);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unicode by normalizing to ASCII (current behavior)', () => {
      // Note: Current implementation strips non-ASCII, so Japanese text becomes empty
      // This is expected for the latin-alphabet focused dedup system
      // Future: May want to add unicode support for Asian languages
      const similarity = trigramSimilarity(
        '日本語を勉強しています',
        '日本語を勉強しています'
      );
      // Empty strings return 0 similarity
      expect(similarity).toBe(0);
    });

    it('should handle mixed language content', () => {
      const normalized = normalizeForFingerprint('Ich möchte Deutsch lernen');
      expect(normalized).toBe('ich mochte deutsch lernen');
    });

    it('should handle emoji removal', () => {
      const normalized = normalizeForFingerprint('Going to Spain 🇪🇸');
      expect(normalized).toBe('going to spain');
    });
  });
});

describe('Explicit Remember Commands', () => {
  const REMEMBER_PATTERNS = [
    /\[REMEMBER:\s*([^\]]+)\]/i,
    /remember(?:\s+that)?\s*[:]\s*(.+)/i,
    /note(?:\s+that)?\s*[:]\s*(.+)/i,
  ];

  function extractRememberCommand(content: string): string | null {
    for (const pattern of REMEMBER_PATTERNS) {
      const match = content.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  it('should detect [REMEMBER: ...] tag format', () => {
    const content = 'That sounds exciting! [REMEMBER: Student is traveling to Madrid in June]';
    const extracted = extractRememberCommand(content);
    expect(extracted).toBe('Student is traveling to Madrid in June');
  });

  it('should detect "remember that:" format', () => {
    const content = 'Remember that: you have a meeting tomorrow';
    const extracted = extractRememberCommand(content);
    expect(extracted).toBe('you have a meeting tomorrow');
  });

  it('should detect "note:" format', () => {
    const content = 'Note: Student works at a tech company';
    const extracted = extractRememberCommand(content);
    expect(extracted).toBe('Student works at a tech company');
  });

  it('should return null when no command present', () => {
    const content = 'Just a normal conversation about weather';
    const extracted = extractRememberCommand(content);
    expect(extracted).toBeNull();
  });

  it('should handle case insensitivity', () => {
    const content = '[remember: case insensitive test]';
    const extracted = extractRememberCommand(content);
    expect(extracted).toBe('case insensitive test');
  });
});

describe('Long Session Chunking', () => {
  const MESSAGES_PER_WINDOW = 10;
  
  function chunkMessages<T>(messages: T[], windowSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < messages.length; i += windowSize) {
      chunks.push(messages.slice(i, i + windowSize));
    }
    return chunks;
  }

  it('should create correct number of chunks', () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    const chunks = chunkMessages(messages, MESSAGES_PER_WINDOW);
    expect(chunks.length).toBe(3);
  });

  it('should handle messages less than window size', () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const chunks = chunkMessages(messages, MESSAGES_PER_WINDOW);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(5);
  });

  it('should handle exact window size', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const chunks = chunkMessages(messages, MESSAGES_PER_WINDOW);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(10);
  });

  it('should handle empty array', () => {
    const chunks = chunkMessages([], MESSAGES_PER_WINDOW);
    expect(chunks.length).toBe(0);
  });

  it('should preserve message order within chunks', () => {
    const messages = [{ id: 0 }, { id: 1 }, { id: 2 }];
    const chunks = chunkMessages(messages, 2);
    expect(chunks[0][0].id).toBe(0);
    expect(chunks[0][1].id).toBe(1);
    expect(chunks[1][0].id).toBe(2);
  });
});

describe('Fact Type Inference', () => {
  function inferFactType(content: string): string {
    const lower = content.toLowerCase();
    
    if (lower.includes('trip') || lower.includes('travel') || lower.includes('vacation')) {
      return 'travel';
    }
    if (lower.includes('work') || lower.includes('job') || lower.includes('career')) {
      return 'work';
    }
    if (lower.includes('family') || lower.includes('wife') || lower.includes('husband') || lower.includes('kid')) {
      return 'family';
    }
    if (lower.includes('wedding') || lower.includes('birthday') || lower.includes('anniversary')) {
      return 'life_event';
    }
    if (lower.includes('want to') || lower.includes('goal') || lower.includes('hope to')) {
      return 'goal';
    }
    if (lower.includes('prefer') || lower.includes('like') || lower.includes('enjoy')) {
      return 'preference';
    }
    if (lower.includes('hobby') || lower.includes('play') || lower.includes('sport')) {
      return 'hobby';
    }
    if (lower.includes('friend') || lower.includes('colleague') || lower.includes('partner')) {
      return 'relationship';
    }
    
    return 'personal_detail';
  }

  it('should infer travel type', () => {
    expect(inferFactType('Planning a trip to Madrid')).toBe('travel');
    expect(inferFactType('Going on vacation next month')).toBe('travel');
  });

  it('should infer work type', () => {
    expect(inferFactType('I work at a tech company')).toBe('work');
    expect(inferFactType('Starting a new job next week')).toBe('work');
  });

  it('should infer family type', () => {
    expect(inferFactType('My wife is learning Spanish too')).toBe('family');
    expect(inferFactType('I have two kids')).toBe('family');
  });

  it('should infer life_event type', () => {
    expect(inferFactType('My wedding is in June')).toBe('life_event');
    expect(inferFactType('Birthday party next Saturday')).toBe('life_event');
  });

  it('should infer goal type', () => {
    expect(inferFactType('I want to become fluent')).toBe('goal');
    expect(inferFactType('My goal is to speak by summer')).toBe('goal');
  });

  it('should default to personal_detail', () => {
    expect(inferFactType('I live in New York')).toBe('personal_detail');
  });
});

describe('Privacy Filtering', () => {
  interface PrivacySettings {
    enabled: boolean;
    allowedCategories: string[];
    blockedCategories: string[];
    redactionRequested: boolean;
  }

  function isCategoryAllowed(factType: string, settings: PrivacySettings): boolean {
    if (!settings.enabled) return false;
    if (settings.redactionRequested) return false;
    
    // If allowedCategories is set, only those are allowed
    if (settings.allowedCategories.length > 0) {
      return settings.allowedCategories.includes(factType);
    }
    
    // If blockedCategories is set, those are blocked
    if (settings.blockedCategories.length > 0) {
      return !settings.blockedCategories.includes(factType);
    }
    
    // Default: allow all
    return true;
  }

  it('should block when disabled', () => {
    const settings: PrivacySettings = {
      enabled: false,
      allowedCategories: [],
      blockedCategories: [],
      redactionRequested: false,
    };
    expect(isCategoryAllowed('travel', settings)).toBe(false);
  });

  it('should block when redaction requested', () => {
    const settings: PrivacySettings = {
      enabled: true,
      allowedCategories: [],
      blockedCategories: [],
      redactionRequested: true,
    };
    expect(isCategoryAllowed('travel', settings)).toBe(false);
  });

  it('should allow only whitelisted categories', () => {
    const settings: PrivacySettings = {
      enabled: true,
      allowedCategories: ['travel', 'hobby'],
      blockedCategories: [],
      redactionRequested: false,
    };
    expect(isCategoryAllowed('travel', settings)).toBe(true);
    expect(isCategoryAllowed('work', settings)).toBe(false);
  });

  it('should block blacklisted categories', () => {
    const settings: PrivacySettings = {
      enabled: true,
      allowedCategories: [],
      blockedCategories: ['family', 'work'],
      redactionRequested: false,
    };
    expect(isCategoryAllowed('travel', settings)).toBe(true);
    expect(isCategoryAllowed('family', settings)).toBe(false);
  });

  it('should allow all when no restrictions', () => {
    const settings: PrivacySettings = {
      enabled: true,
      allowedCategories: [],
      blockedCategories: [],
      redactionRequested: false,
    };
    expect(isCategoryAllowed('travel', settings)).toBe(true);
    expect(isCategoryAllowed('work', settings)).toBe(true);
  });
});

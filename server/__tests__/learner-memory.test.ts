import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  trigramSimilarity,
  normalizeForFingerprint,
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
      assert.equal(similarity, 1);
    });

    it('should detect very similar facts (>0.82 threshold)', () => {
      const similarity = trigramSimilarity(
        'Planning trip to Madrid in June',
        'Planning a trip to Madrid in June'
      );
      assert.ok(similarity > 0.82, `Expected similarity > 0.82, got ${similarity}`);
    });

    it('should distinguish different facts (<0.82 threshold)', () => {
      const similarity = trigramSimilarity(
        'Planning trip to Madrid',
        'Working at Google'
      );
      assert.ok(similarity < 0.82, `Expected similarity < 0.82, got ${similarity}`);
    });

    it('should handle short strings gracefully', () => {
      const similarity = trigramSimilarity('job', 'job');
      assert.equal(similarity, 1);
    });

    it('should handle empty strings', () => {
      const similarity = trigramSimilarity('', 'something');
      assert.equal(similarity, 0);
    });
  });

  describe('Normalized Fingerprints', () => {
    it('should strip diacritics for comparison', () => {
      const a = normalizeForFingerprint('café in París');
      const b = normalizeForFingerprint('cafe in Paris');
      assert.equal(a, b);
    });

    it('should remove punctuation', () => {
      const a = normalizeForFingerprint("I'm planning a trip!");
      const b = normalizeForFingerprint('Im planning a trip');
      assert.equal(a, b);
    });

    it('should normalize whitespace', () => {
      const a = normalizeForFingerprint('Trip   to    Madrid');
      const b = normalizeForFingerprint('Trip to Madrid');
      assert.equal(a, b);
    });

    it('should be case insensitive', () => {
      const a = normalizeForFingerprint('TRIP TO MADRID');
      const b = normalizeForFingerprint('trip to madrid');
      assert.equal(a, b);
    });
  });

  describe('Edge Cases', () => {
    it('should handle identical Japanese text with similarity = 1', () => {
      const similarity = trigramSimilarity(
        '日本語を勉強しています',
        '日本語を勉強しています'
      );
      assert.ok(Math.abs(similarity - 1) < 1e-5, `Expected ~1, got ${similarity}`);
    });

    it('should calculate meaningful similarity for similar Japanese text', () => {
      const similarity = trigramSimilarity(
        '東京に旅行します',
        '東京に旅行する'
      );
      assert.ok(similarity > 0.4, `Expected > 0.4, got ${similarity}`);
      assert.ok(similarity < 1, `Expected < 1, got ${similarity}`);
    });

    it('should handle Korean text deduplication', () => {
      const similarity = trigramSimilarity(
        '한국어를 공부하고 있습니다',
        '한국어를 공부하고 있습니다'
      );
      assert.ok(Math.abs(similarity - 1) < 1e-5, `Expected ~1, got ${similarity}`);
    });

    it('should handle Chinese text deduplication', () => {
      const similarity = trigramSimilarity(
        '我正在学习中文',
        '我正在学习中文'
      );
      assert.ok(Math.abs(similarity - 1) < 1e-5, `Expected ~1, got ${similarity}`);
    });

    it('should handle mixed Latin and CJK content', () => {
      const normalized = normalizeForFingerprint('I am learning 日本語');
      assert.ok(normalized.includes('日本語'), `Expected "日本語" in "${normalized}"`);
      assert.ok(normalized.includes('learning'), `Expected "learning" in "${normalized}"`);
    });

    it('should handle mixed language content', () => {
      const normalized = normalizeForFingerprint('Ich möchte Deutsch lernen');
      assert.equal(normalized, 'ich mochte deutsch lernen');
    });

    it('should handle emoji removal', () => {
      const normalized = normalizeForFingerprint('Going to Spain 🇪🇸');
      assert.equal(normalized, 'going to spain');
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
    assert.equal(extracted, 'Student is traveling to Madrid in June');
  });

  it('should detect "remember that:" format', () => {
    const content = 'Remember that: you have a meeting tomorrow';
    const extracted = extractRememberCommand(content);
    assert.equal(extracted, 'you have a meeting tomorrow');
  });

  it('should detect "note:" format', () => {
    const content = 'Note: Student works at a tech company';
    const extracted = extractRememberCommand(content);
    assert.equal(extracted, 'Student works at a tech company');
  });

  it('should return null when no command present', () => {
    const content = 'Just a normal conversation about weather';
    const extracted = extractRememberCommand(content);
    assert.equal(extracted, null);
  });

  it('should handle case insensitivity', () => {
    const content = '[remember: case insensitive test]';
    const extracted = extractRememberCommand(content);
    assert.equal(extracted, 'case insensitive test');
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
    assert.equal(chunks.length, 3);
  });

  it('should handle messages less than window size', () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const chunks = chunkMessages(messages, MESSAGES_PER_WINDOW);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].length, 5);
  });

  it('should handle exact window size', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const chunks = chunkMessages(messages, MESSAGES_PER_WINDOW);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].length, 10);
  });

  it('should handle empty array', () => {
    const chunks = chunkMessages([], MESSAGES_PER_WINDOW);
    assert.equal(chunks.length, 0);
  });

  it('should preserve message order within chunks', () => {
    const messages = [{ id: 0 }, { id: 1 }, { id: 2 }];
    const chunks = chunkMessages(messages, 2);
    assert.equal(chunks[0][0].id, 0);
    assert.equal(chunks[0][1].id, 1);
    assert.equal(chunks[1][0].id, 2);
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
    assert.equal(inferFactType('Planning a trip to Madrid'), 'travel');
    assert.equal(inferFactType('Going on vacation next month'), 'travel');
  });

  it('should infer work type', () => {
    assert.equal(inferFactType('I work at a tech company'), 'work');
    assert.equal(inferFactType('Starting a new job next week'), 'work');
  });

  it('should infer family type', () => {
    assert.equal(inferFactType('My wife is learning Spanish too'), 'family');
    assert.equal(inferFactType('I have two kids'), 'family');
  });

  it('should infer life_event type', () => {
    assert.equal(inferFactType('My wedding is in June'), 'life_event');
    assert.equal(inferFactType('Birthday party next Saturday'), 'life_event');
  });

  it('should infer goal type', () => {
    assert.equal(inferFactType('I want to become fluent'), 'goal');
    assert.equal(inferFactType('My goal is to speak by summer'), 'goal');
  });

  it('should default to personal_detail', () => {
    assert.equal(inferFactType('I live in New York'), 'personal_detail');
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

    if (settings.allowedCategories.length > 0) {
      return settings.allowedCategories.includes(factType);
    }

    if (settings.blockedCategories.length > 0) {
      return !settings.blockedCategories.includes(factType);
    }

    return true;
  }

  it('should block when disabled', () => {
    const settings: PrivacySettings = {
      enabled: false,
      allowedCategories: [],
      blockedCategories: [],
      redactionRequested: false,
    };
    assert.equal(isCategoryAllowed('travel', settings), false);
  });

  it('should block when redaction requested', () => {
    const settings: PrivacySettings = {
      enabled: true,
      allowedCategories: [],
      blockedCategories: [],
      redactionRequested: true,
    };
    assert.equal(isCategoryAllowed('travel', settings), false);
  });

  it('should allow only whitelisted categories', () => {
    const settings: PrivacySettings = {
      enabled: true,
      allowedCategories: ['travel', 'hobby'],
      blockedCategories: [],
      redactionRequested: false,
    };
    assert.equal(isCategoryAllowed('travel', settings), true);
    assert.equal(isCategoryAllowed('work', settings), false);
  });

  it('should block blacklisted categories', () => {
    const settings: PrivacySettings = {
      enabled: true,
      allowedCategories: [],
      blockedCategories: ['family', 'work'],
      redactionRequested: false,
    };
    assert.equal(isCategoryAllowed('travel', settings), true);
    assert.equal(isCategoryAllowed('family', settings), false);
  });

  it('should allow all when no restrictions', () => {
    const settings: PrivacySettings = {
      enabled: true,
      allowedCategories: [],
      blockedCategories: [],
      redactionRequested: false,
    };
    assert.equal(isCategoryAllowed('travel', settings), true);
    assert.equal(isCategoryAllowed('work', settings), true);
  });
});

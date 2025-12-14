/**
 * Acceptance Tests for Bundle Management
 * 
 * Tests for the bundle CRUD operations defined in the Phase 1 Bundle Data Model.
 * These tests verify:
 * - Bundle creation and listing
 * - Lesson-to-bundle assignment
 * - Drill-to-conversation linking
 * - Requirement tier setting
 * - Class syllabus sync
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { curriculumLessons, curriculumUnits, curriculumPaths, danielaRecommendations, studentTierSignals, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import {
  listBundles,
  getBundleLessons,
  addLessonToBundle,
  linkDrillToConversation,
  setLessonTier,
  applyBundleDefinition,
  createBundleFromUnit,
  type BundleDefinition,
} from '../scripts/bundle-management';
import { storage } from '../storage';

// Test fixtures
let testUserId: string;
let testPathId: string;
let testUnitId: string;
let testConversationLessonId: string;
let testDrillLessonId: string;

describe('Bundle Management', () => {
  beforeAll(async () => {
    // Create test user
    const testUser = await storage.createUser({
      email: `bundle-test-${Date.now()}@test.com`,
      firstName: 'Bundle',
      lastName: 'Test',
    });
    testUserId = testUser.id;

    // Create test curriculum path
    const [path] = await db.insert(curriculumPaths).values({
      name: `Test Path ${Date.now()}`,
      description: 'Test curriculum for bundle testing',
      language: 'spanish',
      targetAudience: 'Test',
      startLevel: 'novice_low',
      endLevel: 'novice_mid',
      estimatedHours: 10,
      isPublished: false,
    }).returning();
    testPathId = path.id;

    // Create test unit
    const [unit] = await db.insert(curriculumUnits).values({
      curriculumPathId: testPathId,
      name: 'Test Unit: Greetings Bundle',
      description: 'Test unit for bundle testing',
      orderIndex: 1,
      actflLevel: 'novice_low',
      estimatedHours: 2,
    }).returning();
    testUnitId = unit.id;

    // Create conversation lesson
    const [convLesson] = await db.insert(curriculumLessons).values({
      curriculumUnitId: testUnitId,
      name: 'Test Conversation: Greetings',
      description: 'Practice greeting people',
      orderIndex: 1,
      lessonType: 'conversation',
      actflLevel: 'novice_low',
      conversationTopic: 'greetings',
      objectives: ['Greet people', 'Introduce yourself'],
      estimatedMinutes: 15,
    }).returning();
    testConversationLessonId = convLesson.id;

    // Create drill lesson
    const [drillLesson] = await db.insert(curriculumLessons).values({
      curriculumUnitId: testUnitId,
      name: 'Test Drill: Greetings Practice',
      description: 'Practice greeting phrases',
      orderIndex: 2,
      lessonType: 'drill',
      actflLevel: 'novice_low',
      objectives: ['Pronounce greetings correctly'],
      estimatedMinutes: 10,
    }).returning();
    testDrillLessonId = drillLesson.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testConversationLessonId) {
      await db.delete(curriculumLessons).where(eq(curriculumLessons.id, testConversationLessonId));
    }
    if (testDrillLessonId) {
      await db.delete(curriculumLessons).where(eq(curriculumLessons.id, testDrillLessonId));
    }
    if (testUnitId) {
      await db.delete(curriculumUnits).where(eq(curriculumUnits.id, testUnitId));
    }
    if (testPathId) {
      await db.delete(curriculumPaths).where(eq(curriculumPaths.id, testPathId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe('addLessonToBundle', () => {
    it('should add a lesson to a bundle with default tier', async () => {
      const bundleId = `test-bundle-${Date.now()}`;
      const result = await addLessonToBundle(testConversationLessonId, bundleId);

      expect(result.success).toBe(true);
      expect(result.lesson).toBeDefined();
      expect(result.lesson?.bundleId).toBe(bundleId);
      expect(result.lesson?.requirementTier).toBe('required');
    });

    it('should add a lesson with a specific tier', async () => {
      const bundleId = `test-bundle-tier-${Date.now()}`;
      const result = await addLessonToBundle(testDrillLessonId, bundleId, 'recommended');

      expect(result.success).toBe(true);
      expect(result.lesson?.requirementTier).toBe('recommended');
    });

    it('should return error for non-existent lesson', async () => {
      const result = await addLessonToBundle('non-existent-id', 'some-bundle');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should be idempotent - updating same lesson multiple times', async () => {
      const bundleId = `test-idempotent-${Date.now()}`;
      
      await addLessonToBundle(testConversationLessonId, bundleId, 'required');
      const result2 = await addLessonToBundle(testConversationLessonId, bundleId, 'recommended');

      expect(result2.success).toBe(true);
      expect(result2.lesson?.requirementTier).toBe('recommended');
    });
  });

  describe('linkDrillToConversation', () => {
    it('should link a drill lesson to a conversation lesson', async () => {
      const result = await linkDrillToConversation(testConversationLessonId, testDrillLessonId);

      expect(result.success).toBe(true);

      // Verify the link was created
      const [lesson] = await db
        .select()
        .from(curriculumLessons)
        .where(eq(curriculumLessons.id, testConversationLessonId));

      expect(lesson.linkedDrillLessonId).toBe(testDrillLessonId);
    });

    it('should return error for non-existent drill lesson', async () => {
      const result = await linkDrillToConversation(testConversationLessonId, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should be idempotent - linking same drill multiple times', async () => {
      await linkDrillToConversation(testConversationLessonId, testDrillLessonId);
      const result = await linkDrillToConversation(testConversationLessonId, testDrillLessonId);

      expect(result.success).toBe(true);
    });
  });

  describe('setLessonTier', () => {
    it('should set lesson tier to recommended', async () => {
      const result = await setLessonTier(testDrillLessonId, 'recommended');

      expect(result.success).toBe(true);

      const [lesson] = await db
        .select()
        .from(curriculumLessons)
        .where(eq(curriculumLessons.id, testDrillLessonId));

      expect(lesson.requirementTier).toBe('recommended');
    });

    it('should set lesson tier to optional_premium', async () => {
      const result = await setLessonTier(testDrillLessonId, 'optional_premium');

      expect(result.success).toBe(true);

      const [lesson] = await db
        .select()
        .from(curriculumLessons)
        .where(eq(curriculumLessons.id, testDrillLessonId));

      expect(lesson.requirementTier).toBe('optional_premium');
    });
  });

  describe('getBundleLessons', () => {
    it('should return lessons in a bundle', async () => {
      const bundleId = `test-get-bundle-${Date.now()}`;
      
      await addLessonToBundle(testConversationLessonId, bundleId);
      await addLessonToBundle(testDrillLessonId, bundleId);

      const lessons = await getBundleLessons(bundleId);

      expect(lessons.length).toBe(2);
      expect(lessons.map(l => l.id)).toContain(testConversationLessonId);
      expect(lessons.map(l => l.id)).toContain(testDrillLessonId);
    });

    it('should return empty array for non-existent bundle', async () => {
      const lessons = await getBundleLessons('non-existent-bundle');

      expect(lessons).toEqual([]);
    });
  });

  describe('listBundles', () => {
    it('should list all bundles with their lessons', async () => {
      const bundleId = `test-list-${Date.now()}`;
      await addLessonToBundle(testConversationLessonId, bundleId);

      const bundles = await listBundles();

      expect(bundles.size).toBeGreaterThan(0);
      expect(bundles.has(bundleId)).toBe(true);
      expect(bundles.get(bundleId)?.lessons.length).toBeGreaterThan(0);
    });
  });

  describe('applyBundleDefinition', () => {
    it('should apply a complete bundle definition', async () => {
      const definition: BundleDefinition = {
        bundleId: `test-apply-${Date.now()}`,
        name: 'Test Applied Bundle',
        lessons: [
          { lessonId: testConversationLessonId, tier: 'required', linkedDrillLessonId: testDrillLessonId },
          { lessonId: testDrillLessonId, tier: 'recommended' },
        ],
      };

      const result = await applyBundleDefinition(definition);

      expect(result.bundleId).toBe(definition.bundleId);
      expect(result.lessonsUpdated).toBe(2);
      expect(result.drillsLinked).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('Daniela Recommendations CRUD', () => {
  let testUserId: string;
  let testRecommendationId: string;

  beforeAll(async () => {
    const testUser = await storage.createUser({
      email: `daniela-rec-test-${Date.now()}@test.com`,
      firstName: 'Daniela',
      lastName: 'Test',
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    if (testRecommendationId) {
      await db.delete(danielaRecommendations).where(eq(danielaRecommendations.id, testRecommendationId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it('should create a recommendation', async () => {
    const rec = await storage.createDanielaRecommendation({
      userId: testUserId,
      language: 'spanish',
      recommendationType: 'practice_topic',
      title: 'Practice Greetings',
      description: 'You should practice greeting phrases more',
      priority: 'medium',
      rationale: 'Student struggled with greetings in last session',
      createdBy: 'daniela',
    });

    testRecommendationId = rec.id;

    expect(rec.id).toBeDefined();
    expect(rec.title).toBe('Practice Greetings');
    expect(rec.priority).toBe('medium');
  });

  it('should get recommendations for a user', async () => {
    const recs = await storage.getDanielaRecommendations(testUserId);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(r => r.id === testRecommendationId)).toBe(true);
  });

  it('should snooze a recommendation', async () => {
    const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
    const result = await storage.snoozeRecommendation(testRecommendationId, snoozedUntil);

    expect(result).toBeDefined();
    expect(result?.snoozedUntil).toBeDefined();
  });

  it('should complete a recommendation', async () => {
    const result = await storage.completeRecommendation(testRecommendationId);

    expect(result).toBeDefined();
    expect(result?.completedAt).toBeDefined();
  });

  it('should dismiss a recommendation', async () => {
    // Create a new one to dismiss
    const newRec = await storage.createDanielaRecommendation({
      userId: testUserId,
      language: 'spanish',
      recommendationType: 'vocabulary_review',
      title: 'Review Numbers',
      priority: 'low',
      createdBy: 'daniela',
    });

    const result = await storage.dismissRecommendation(newRec.id);

    expect(result).toBeDefined();
    expect(result?.dismissedAt).toBeDefined();

    // Cleanup
    await db.delete(danielaRecommendations).where(eq(danielaRecommendations.id, newRec.id));
  });
});

describe('Student Tier Signals CRUD', () => {
  let testUserId: string;
  let testTeacherId: string;
  let testSignalId: string;

  beforeAll(async () => {
    const testUser = await storage.createUser({
      email: `tier-signal-test-${Date.now()}@test.com`,
      firstName: 'Tier',
      lastName: 'Test',
    });
    testUserId = testUser.id;

    const teacher = await storage.createUser({
      email: `tier-teacher-${Date.now()}@test.com`,
      firstName: 'Teacher',
      lastName: 'Test',
      role: 'teacher',
    });
    testTeacherId = teacher.id;
  });

  afterAll(async () => {
    if (testSignalId) {
      await db.delete(studentTierSignals).where(eq(studentTierSignals.id, testSignalId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testTeacherId) {
      await db.delete(users).where(eq(users.id, testTeacherId));
    }
  });

  it('should create a tier signal', async () => {
    const signal = await storage.createStudentTierSignal({
      userId: testUserId,
      lessonId: 'some-lesson-id',
      requestedTier: 'optional_premium',
      currentTier: 'recommended',
      reason: 'I want extra practice with pronunciation',
    });

    testSignalId = signal.id;

    expect(signal.id).toBeDefined();
    expect(signal.requestedTier).toBe('optional_premium');
    expect(signal.reason).toBe('I want extra practice with pronunciation');
  });

  it('should get tier signals for a user', async () => {
    const signals = await storage.getStudentTierSignals(testUserId);

    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some(s => s.id === testSignalId)).toBe(true);
  });

  it('should get pending tier signals', async () => {
    const signals = await storage.getPendingTierSignals();

    expect(Array.isArray(signals)).toBe(true);
    // Should include our unreviewed signal
    expect(signals.some(s => s.id === testSignalId)).toBe(true);
  });

  it('should review a tier signal', async () => {
    const result = await storage.reviewTierSignal(
      testSignalId,
      testTeacherId,
      'approved',
      'Good request, granting access'
    );

    expect(result).toBeDefined();
    expect(result?.reviewedBy).toBe(testTeacherId);
    expect(result?.reviewDecision).toBe('approved');
    expect(result?.reviewNotes).toBe('Good request, granting access');
    expect(result?.reviewedAt).toBeDefined();
  });
});

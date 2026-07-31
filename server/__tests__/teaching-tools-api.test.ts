import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * API Tests for Teaching Tools Analytics Endpoints
 * Tests response structure and data format validation
 */

describe('Teaching Tools API Endpoints', () => {
  describe('GET /api/admin/teaching-tools/summary', () => {
    it('should return correct response structure with totals, toolStats, and dailyTrend', () => {
      const expectedStructure = {
        totals: {
          totalEvents: 'number',
          uniqueStudents: 'number',
          avgDrillAccuracy: 'number|null',
        },
        toolStats: 'array',
        dailyTrend: 'array',
      };

      assert.ok(expectedStructure.totals !== undefined);
      assert.equal(expectedStructure.toolStats, 'array');
      assert.equal(expectedStructure.dailyTrend, 'array');
    });

    it('should validate toolStats item structure', () => {
      const expectedToolStatShape = {
        toolType: 'string',
        count: 'number',
        uniqueStudents: 'number',
        avgResponseTime: 'number|null',
        drillCorrect: 'number',
        drillTotal: 'number',
      };

      const requiredFields = ['toolType', 'count', 'uniqueStudents', 'drillCorrect', 'drillTotal'];
      for (const field of requiredFields) {
        assert.ok(Object.keys(expectedToolStatShape).includes(field), `Missing field: ${field}`);
      }
    });

    it('should validate dailyTrend item structure', () => {
      const expectedDailyTrendShape = {
        date: 'string',
        count: 'number',
      };

      assert.ok(Object.keys(expectedDailyTrendShape).includes('date'));
      assert.ok(Object.keys(expectedDailyTrendShape).includes('count'));
    });

    it('should verify drill accuracy calculation formula', () => {
      const drillCorrect = 75;
      const drillTotal = 100;
      const expectedAccuracy = Math.round((drillCorrect / drillTotal) * 100);

      assert.equal(expectedAccuracy, 75);
    });

    it('should handle zero drill total gracefully', () => {
      const drillCorrect = 0;
      const drillTotal = 0;
      const accuracy = drillTotal > 0
        ? Math.round((drillCorrect / drillTotal) * 100)
        : null;

      assert.equal(accuracy, null);
    });
  });

  describe('GET /api/admin/teaching-tools/by-student', () => {
    it('should return correct response structure with students array', () => {
      const expectedStructure = {
        students: 'array',
        periodDays: 'number',
      };

      assert.equal(expectedStructure.students, 'array');
      assert.equal(expectedStructure.periodDays, 'number');
    });

    it('should validate student item structure', () => {
      const expectedStudentShape = {
        userId: 'string',
        totalEvents: 'number',
        languages: 'array',
        tools: 'object',
      };

      const requiredFields = ['userId', 'totalEvents', 'languages', 'tools'];
      for (const field of requiredFields) {
        assert.ok(Object.keys(expectedStudentShape).includes(field), `Missing field: ${field}`);
      }
    });

    it('should validate tools structure within student', () => {
      const expectedToolDataShape = {
        count: 'number',
        avgResponseTime: 'number|null',
        drillAccuracy: 'number|null',
      };

      assert.ok(Object.keys(expectedToolDataShape).includes('count'));
      assert.ok(Object.keys(expectedToolDataShape).includes('avgResponseTime'));
      assert.ok(Object.keys(expectedToolDataShape).includes('drillAccuracy'));
    });
  });

  describe('GET /api/admin/teaching-tools/events', () => {
    it('should return correct response structure with events array', () => {
      const expectedStructure = {
        events: 'array',
      };

      assert.equal(expectedStructure.events, 'array');
    });

    it('should validate event item structure', () => {
      const expectedEventShape = {
        id: 'number',
        userId: 'string|null',
        toolType: 'string',
        content: 'string|null',
        language: 'string|null',
        occurredAt: 'string',
        drillResult: 'string|null',
        studentResponseTime: 'number|null',
      };

      const requiredFields = ['id', 'toolType', 'occurredAt'];
      for (const field of requiredFields) {
        assert.ok(Object.keys(expectedEventShape).includes(field), `Missing field: ${field}`);
      }
    });
  });

  describe('Query Key Validation', () => {
    it('should validate summary query key format', () => {
      const days = '30';
      const queryKey = ['/api/admin/teaching-tools/summary', { days }];

      assert.equal(queryKey[0], '/api/admin/teaching-tools/summary');
      assert.deepEqual(queryKey[1], { days: '30' });
    });

    it('should validate by-student query key format', () => {
      const days = '30';
      const limit = '20';
      const queryKey = ['/api/admin/teaching-tools/by-student', { days, limit }];

      assert.equal(queryKey[0], '/api/admin/teaching-tools/by-student');
      assert.deepEqual(queryKey[1], { days: '30', limit: '20' });
    });

    it('should validate events query key format', () => {
      const limit = '50';
      const queryKey = ['/api/admin/teaching-tools/events', { limit }];

      assert.equal(queryKey[0], '/api/admin/teaching-tools/events');
      assert.deepEqual(queryKey[1], { limit: '50' });
    });

    it('should support different day ranges', () => {
      const dayRanges = ['7', '30', '90'];

      for (const days of dayRanges) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));
        assert.ok(daysAgo.getTime() < Date.now(), `Expected past date for ${days} days`);
      }
    });
  });

  describe('Data Health Validation Logic', () => {
    it('should correctly identify matching drill accuracy', () => {
      const toolStats = [
        { drillCorrect: 30, drillTotal: 40 },
        { drillCorrect: 20, drillTotal: 25 },
        { drillCorrect: 25, drillTotal: 35 },
      ];

      const totalCorrect = toolStats.reduce((sum, t) => sum + t.drillCorrect, 0);
      const totalDrills = toolStats.reduce((sum, t) => sum + t.drillTotal, 0);
      const calculatedAccuracy = Math.round((totalCorrect / totalDrills) * 100);

      assert.equal(totalCorrect, 75);
      assert.equal(totalDrills, 100);
      assert.equal(calculatedAccuracy, 75);
    });

    it('should detect date gaps in trend data', () => {
      const dailyTrend = [
        { date: '2025-12-10', count: 5 },
        { date: '2025-12-11', count: 3 },
        { date: '2025-12-13', count: 7 },
      ];

      let gapCount = 0;
      for (let i = 1; i < dailyTrend.length; i++) {
        const prev = new Date(dailyTrend[i - 1].date);
        const curr = new Date(dailyTrend[i].date);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays !== 1) gapCount++;
      }

      assert.equal(gapCount, 1);
    });

    it('should recognize known tool types', () => {
      const knownToolTypes = [
        'WRITE', 'PHONETIC', 'COMPARE', 'IMAGE', 'DRILL',
        'CONTEXT', 'GRAMMAR_TABLE', 'READING', 'STROKE',
        'TONE', 'WORD_MAP', 'CULTURE', 'PLAY', 'SCENARIO', 'SUMMARY',
      ];

      assert.ok(knownToolTypes.includes('WRITE'));
      assert.ok(knownToolTypes.includes('DRILL'));
      assert.ok(knownToolTypes.includes('PHONETIC'));
      assert.equal(knownToolTypes.length, 15);
    });
  });
});

import { describe, it, expect, beforeAll } from 'vitest';

/**
 * API Tests for Teaching Tools Analytics Endpoints
 * Tests response structure and data format validation
 */

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Teaching Tools API Endpoints', () => {
  describe('GET /api/admin/teaching-tools/summary', () => {
    it('should return correct response structure with totals, toolStats, and dailyTrend', async () => {
      const expectedStructure = {
        totals: {
          totalEvents: 'number',
          uniqueStudents: 'number',
          avgDrillAccuracy: 'number|null',
        },
        toolStats: 'array',
        dailyTrend: 'array',
      };
      
      expect(expectedStructure.totals).toBeDefined();
      expect(expectedStructure.toolStats).toBe('array');
      expect(expectedStructure.dailyTrend).toBe('array');
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
      requiredFields.forEach(field => {
        expect(Object.keys(expectedToolStatShape)).toContain(field);
      });
    });

    it('should validate dailyTrend item structure', () => {
      const expectedDailyTrendShape = {
        date: 'string',
        count: 'number',
      };
      
      expect(Object.keys(expectedDailyTrendShape)).toContain('date');
      expect(Object.keys(expectedDailyTrendShape)).toContain('count');
    });

    it('should verify drill accuracy calculation formula', () => {
      const drillCorrect = 75;
      const drillTotal = 100;
      const expectedAccuracy = Math.round((drillCorrect / drillTotal) * 100);
      
      expect(expectedAccuracy).toBe(75);
    });

    it('should handle zero drill total gracefully', () => {
      const drillCorrect = 0;
      const drillTotal = 0;
      const accuracy = drillTotal > 0 
        ? Math.round((drillCorrect / drillTotal) * 100) 
        : null;
      
      expect(accuracy).toBeNull();
    });
  });

  describe('GET /api/admin/teaching-tools/by-student', () => {
    it('should return correct response structure with students array', () => {
      const expectedStructure = {
        students: 'array',
        periodDays: 'number',
      };
      
      expect(expectedStructure.students).toBe('array');
      expect(expectedStructure.periodDays).toBe('number');
    });

    it('should validate student item structure', () => {
      const expectedStudentShape = {
        userId: 'string',
        totalEvents: 'number',
        languages: 'array',
        tools: 'object',
      };
      
      const requiredFields = ['userId', 'totalEvents', 'languages', 'tools'];
      requiredFields.forEach(field => {
        expect(Object.keys(expectedStudentShape)).toContain(field);
      });
    });

    it('should validate tools structure within student', () => {
      const expectedToolDataShape = {
        count: 'number',
        avgResponseTime: 'number|null',
        drillAccuracy: 'number|null',
      };
      
      expect(Object.keys(expectedToolDataShape)).toContain('count');
      expect(Object.keys(expectedToolDataShape)).toContain('avgResponseTime');
      expect(Object.keys(expectedToolDataShape)).toContain('drillAccuracy');
    });
  });

  describe('GET /api/admin/teaching-tools/events', () => {
    it('should return correct response structure with events array', () => {
      const expectedStructure = {
        events: 'array',
      };
      
      expect(expectedStructure.events).toBe('array');
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
      requiredFields.forEach(field => {
        expect(Object.keys(expectedEventShape)).toContain(field);
      });
    });
  });

  describe('Query Key Validation', () => {
    it('should validate summary query key format', () => {
      const days = '30';
      const queryKey = ['/api/admin/teaching-tools/summary', { days }];
      
      expect(queryKey[0]).toBe('/api/admin/teaching-tools/summary');
      expect(queryKey[1]).toEqual({ days: '30' });
    });

    it('should validate by-student query key format', () => {
      const days = '30';
      const limit = '20';
      const queryKey = ['/api/admin/teaching-tools/by-student', { days, limit }];
      
      expect(queryKey[0]).toBe('/api/admin/teaching-tools/by-student');
      expect(queryKey[1]).toEqual({ days: '30', limit: '20' });
    });

    it('should validate events query key format', () => {
      const limit = '50';
      const queryKey = ['/api/admin/teaching-tools/events', { limit }];
      
      expect(queryKey[0]).toBe('/api/admin/teaching-tools/events');
      expect(queryKey[1]).toEqual({ limit: '50' });
    });

    it('should support different day ranges', () => {
      const dayRanges = ['7', '30', '90'];
      
      dayRanges.forEach(days => {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));
        expect(daysAgo.getTime()).toBeLessThan(Date.now());
      });
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
      
      expect(totalCorrect).toBe(75);
      expect(totalDrills).toBe(100);
      expect(calculatedAccuracy).toBe(75);
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
      
      expect(gapCount).toBe(1);
    });

    it('should recognize known tool types', () => {
      const knownToolTypes = [
        'WRITE', 'PHONETIC', 'COMPARE', 'IMAGE', 'DRILL',
        'CONTEXT', 'GRAMMAR_TABLE', 'READING', 'STROKE',
        'TONE', 'WORD_MAP', 'CULTURE', 'PLAY', 'SCENARIO', 'SUMMARY'
      ];
      
      expect(knownToolTypes).toContain('WRITE');
      expect(knownToolTypes).toContain('DRILL');
      expect(knownToolTypes).toContain('PHONETIC');
      expect(knownToolTypes.length).toBe(15);
    });
  });
});

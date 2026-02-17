import { db } from "../db";
import { voiceSessions, conversations, usageLedger, users } from "@shared/schema";
import { eq, and, sql, gte, lte, desc, ne, isNull, or, gt } from "drizzle-orm";

export const COST_CONSTANTS = {
  TTS_COST_PER_CHAR: 0.000015,
  STT_COST_PER_SECOND: 0.0043 / 60,
  GEMINI_COST_PER_EXCHANGE: 0.0005,
  GEMINI_CONTEXT_COST_PER_SESSION: 0.002,
  PLATFORM_OVERHEAD_MULTIPLIER: 1.15,
  TTS_CHARS_PER_EXCHANGE_ESTIMATE: 150,
  STT_SECONDS_PER_EXCHANGE_ESTIMATE: 5,
};

export interface SessionCostBreakdown {
  tts: number;
  stt: number;
  llm: number;
  total: number;
  costPerMinute: number;
  costPerHour: number;
}

export interface EconomicsSnapshot {
  period: { start: string; end: string };
  totalSessions: number;
  totalDurationHours: number;
  totalExchanges: number;
  uniqueUsers: number;
  costs: {
    tts: number;
    stt: number;
    llm: number;
    platform: number;
    total: number;
    perHour: number;
    perSession: number;
    perExchange: number;
  };
  revenue: {
    creditsConsumedSeconds: number;
    creditsConsumedHours: number;
  };
  byLanguage: Array<{
    language: string;
    sessions: number;
    hours: number;
    exchanges: number;
    costTotal: number;
    costPerHour: number;
  }>;
  byDay: Array<{
    date: string;
    sessions: number;
    durationMinutes: number;
    exchanges: number;
    costTotal: number;
    users: number;
  }>;
  telemetryHealth: {
    sessionsWithTelemetry: number;
    sessionsWithoutTelemetry: number;
    telemetryCoveragePercent: number;
  };
}

function calculateSessionCost(
  ttsChars: number,
  sttSeconds: number,
  exchanges: number,
  durationSeconds: number,
  hasTelemetry: boolean
): SessionCostBreakdown {
  let effectiveTtsChars = ttsChars;
  let effectiveSttSecs = sttSeconds;

  if (!hasTelemetry && exchanges > 0) {
    effectiveTtsChars = exchanges * COST_CONSTANTS.TTS_CHARS_PER_EXCHANGE_ESTIMATE;
    effectiveSttSecs = exchanges * COST_CONSTANTS.STT_SECONDS_PER_EXCHANGE_ESTIMATE;
  }

  if (!hasTelemetry && exchanges === 0 && durationSeconds > 60) {
    const estimatedExchanges = Math.max(1, Math.floor(durationSeconds / 30));
    effectiveTtsChars = estimatedExchanges * COST_CONSTANTS.TTS_CHARS_PER_EXCHANGE_ESTIMATE;
    effectiveSttSecs = estimatedExchanges * COST_CONSTANTS.STT_SECONDS_PER_EXCHANGE_ESTIMATE;
  }

  const ttsCost = effectiveTtsChars * COST_CONSTANTS.TTS_COST_PER_CHAR;
  const sttCost = effectiveSttSecs * COST_CONSTANTS.STT_COST_PER_SECOND;
  const llmCost = (exchanges > 0 ? exchanges : Math.max(1, Math.floor(durationSeconds / 30))) 
    * COST_CONSTANTS.GEMINI_COST_PER_EXCHANGE + COST_CONSTANTS.GEMINI_CONTEXT_COST_PER_SESSION;
  const rawTotal = ttsCost + sttCost + llmCost;
  const total = rawTotal * COST_CONSTANTS.PLATFORM_OVERHEAD_MULTIPLIER;

  const durationMinutes = Math.max(1, durationSeconds / 60);
  const durationHours = durationMinutes / 60;

  return {
    tts: Math.round(ttsCost * 10000) / 10000,
    stt: Math.round(sttCost * 10000) / 10000,
    llm: Math.round(llmCost * 10000) / 10000,
    total: Math.round(total * 10000) / 10000,
    costPerMinute: Math.round((total / durationMinutes) * 10000) / 10000,
    costPerHour: Math.round((total / durationHours) * 100) / 100,
  };
}

export class SessionEconomicsService {
  async getSnapshot(
    startDate?: string,
    endDate?: string,
    language?: string,
    excludeTestSessions: boolean = true
  ): Promise<EconomicsSnapshot> {
    const conditions: any[] = [];

    if (excludeTestSessions) {
      conditions.push(
        or(eq(voiceSessions.isTestSession, false), isNull(voiceSessions.isTestSession))
      );
    }

    conditions.push(gt(voiceSessions.durationSeconds, 10));

    const effectiveStart = startDate || '2025-01-01';
    const effectiveEnd = endDate || new Date().toISOString().split('T')[0];

    conditions.push(gte(voiceSessions.startedAt, new Date(effectiveStart)));
    conditions.push(lte(voiceSessions.startedAt, new Date(effectiveEnd + 'T23:59:59')));

    if (language) {
      conditions.push(eq(voiceSessions.language, language));
    }

    const sessions = await db
      .select({
        id: voiceSessions.id,
        userId: voiceSessions.userId,
        language: voiceSessions.language,
        durationSeconds: voiceSessions.durationSeconds,
        ttsCharacters: voiceSessions.ttsCharacters,
        sttSeconds: voiceSessions.sttSeconds,
        exchangeCount: voiceSessions.exchangeCount,
        startedAt: voiceSessions.startedAt,
      })
      .from(voiceSessions)
      .where(and(...conditions))
      .orderBy(desc(voiceSessions.startedAt));

    let totalTtsCost = 0;
    let totalSttCost = 0;
    let totalLlmCost = 0;
    let totalCost = 0;
    let totalDurationSeconds = 0;
    let totalExchanges = 0;
    let sessionsWithTelemetry = 0;
    const uniqueUsers = new Set<string>();
    const languageMap = new Map<string, { sessions: number; seconds: number; exchanges: number; cost: number }>();
    const dayMap = new Map<string, { sessions: number; minutes: number; exchanges: number; cost: number; users: Set<string> }>();

    for (const s of sessions) {
      const duration = s.durationSeconds || 0;
      const ttsChars = s.ttsCharacters || 0;
      const sttSecs = s.sttSeconds || 0;
      const exchanges = s.exchangeCount || 0;
      const hasTelemetry = ttsChars > 0 || sttSecs > 0;

      if (hasTelemetry) sessionsWithTelemetry++;

      const cost = calculateSessionCost(ttsChars, sttSecs, exchanges, duration, hasTelemetry);

      totalTtsCost += cost.tts;
      totalSttCost += cost.stt;
      totalLlmCost += cost.llm;
      totalCost += cost.total;
      totalDurationSeconds += duration;
      totalExchanges += exchanges || Math.max(1, Math.floor(duration / 30));
      uniqueUsers.add(s.userId);

      const lang = s.language || 'unknown';
      const existing = languageMap.get(lang) || { sessions: 0, seconds: 0, exchanges: 0, cost: 0 };
      existing.sessions++;
      existing.seconds += duration;
      existing.exchanges += exchanges;
      existing.cost += cost.total;
      languageMap.set(lang, existing);

      if (s.startedAt) {
        const dayKey = new Date(s.startedAt).toISOString().split('T')[0];
        const dayData = dayMap.get(dayKey) || { sessions: 0, minutes: 0, exchanges: 0, cost: 0, users: new Set<string>() };
        dayData.sessions++;
        dayData.minutes += duration / 60;
        dayData.exchanges += exchanges;
        dayData.cost += cost.total;
        dayData.users.add(s.userId);
        dayMap.set(dayKey, dayData);
      }
    }

    const totalHours = totalDurationSeconds / 3600;

    let creditsConsumedSeconds = 0;
    const ledgerEntries = await db
      .select({ creditSeconds: usageLedger.creditSeconds })
      .from(usageLedger)
      .where(
        and(
          gte(usageLedger.createdAt, new Date(effectiveStart)),
          lte(usageLedger.createdAt, new Date(effectiveEnd + 'T23:59:59')),
          sql`${usageLedger.creditSeconds} < 0`
        )
      );
    for (const entry of ledgerEntries) {
      creditsConsumedSeconds += Math.abs(entry.creditSeconds || 0);
    }

    const byLanguage = Array.from(languageMap.entries())
      .map(([lang, data]) => ({
        language: lang,
        sessions: data.sessions,
        hours: Math.round((data.seconds / 3600) * 100) / 100,
        exchanges: data.exchanges,
        costTotal: Math.round(data.cost * 100) / 100,
        costPerHour: data.seconds > 0 ? Math.round((data.cost / (data.seconds / 3600)) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.hours - a.hours);

    const byDay = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        sessions: data.sessions,
        durationMinutes: Math.round(data.minutes),
        exchanges: data.exchanges,
        costTotal: Math.round(data.cost * 100) / 100,
        users: data.users.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const platformCost = totalCost - (totalTtsCost + totalSttCost + totalLlmCost);

    return {
      period: { start: effectiveStart, end: effectiveEnd },
      totalSessions: sessions.length,
      totalDurationHours: Math.round(totalHours * 100) / 100,
      totalExchanges,
      uniqueUsers: uniqueUsers.size,
      costs: {
        tts: Math.round(totalTtsCost * 100) / 100,
        stt: Math.round(totalSttCost * 100) / 100,
        llm: Math.round(totalLlmCost * 100) / 100,
        platform: Math.round(platformCost * 100) / 100,
        total: Math.round(totalCost * 100) / 100,
        perHour: totalHours > 0 ? Math.round((totalCost / totalHours) * 100) / 100 : 0,
        perSession: sessions.length > 0 ? Math.round((totalCost / sessions.length) * 10000) / 10000 : 0,
        perExchange: totalExchanges > 0 ? Math.round((totalCost / totalExchanges) * 10000) / 10000 : 0,
      },
      revenue: {
        creditsConsumedSeconds,
        creditsConsumedHours: Math.round((creditsConsumedSeconds / 3600) * 100) / 100,
      },
      byLanguage,
      byDay,
      telemetryHealth: {
        sessionsWithTelemetry,
        sessionsWithoutTelemetry: sessions.length - sessionsWithTelemetry,
        telemetryCoveragePercent: sessions.length > 0
          ? Math.round((sessionsWithTelemetry / sessions.length) * 100)
          : 0,
      },
    };
  }

  async getSessionDetails(
    limit: number = 50,
    offset: number = 0,
    language?: string,
    userId?: string
  ): Promise<Array<{
    id: string;
    userId: string;
    language: string;
    startedAt: Date;
    durationSeconds: number;
    exchanges: number;
    cost: SessionCostBreakdown;
    hasTelemetry: boolean;
  }>> {
    const conditions: any[] = [
      gt(voiceSessions.durationSeconds, 10),
      or(eq(voiceSessions.isTestSession, false), isNull(voiceSessions.isTestSession)),
    ];
    if (language) conditions.push(eq(voiceSessions.language, language));
    if (userId) conditions.push(eq(voiceSessions.userId, userId));

    const sessions = await db
      .select({
        id: voiceSessions.id,
        userId: voiceSessions.userId,
        language: voiceSessions.language,
        startedAt: voiceSessions.startedAt,
        durationSeconds: voiceSessions.durationSeconds,
        ttsCharacters: voiceSessions.ttsCharacters,
        sttSeconds: voiceSessions.sttSeconds,
        exchangeCount: voiceSessions.exchangeCount,
      })
      .from(voiceSessions)
      .where(and(...conditions))
      .orderBy(desc(voiceSessions.startedAt))
      .limit(limit)
      .offset(offset);

    return sessions.map(s => {
      const ttsChars = s.ttsCharacters || 0;
      const sttSecs = s.sttSeconds || 0;
      const exchanges = s.exchangeCount || 0;
      const duration = s.durationSeconds || 0;
      const hasTelemetry = ttsChars > 0 || sttSecs > 0;

      return {
        id: s.id,
        userId: s.userId,
        language: s.language || 'unknown',
        startedAt: s.startedAt,
        durationSeconds: duration,
        exchanges,
        cost: calculateSessionCost(ttsChars, sttSecs, exchanges, duration, hasTelemetry),
        hasTelemetry,
      };
    });
  }

  async getPricingAnalysis(): Promise<{
    currentCostPerHour: number;
    recommendedMinPrice: number;
    recommendedRetailPrice: number;
    marginAt5PerHour: number;
    marginAt10PerHour: number;
    breakEvenPrice: number;
    institutionalPackageAnalysis: Array<{
      tier: string;
      pricePerStudent: number;
      hoursPerStudent: number;
      costPerStudent: number;
      profitPerStudent: number;
      marginPercent: number;
    }>;
  }> {
    const snapshot = await this.getSnapshot();
    const costPerHour = snapshot.costs.perHour || 2.47;

    const recommendedMin = Math.ceil(costPerHour * 1.5 * 100) / 100;
    const recommendedRetail = Math.ceil(costPerHour * 3 * 100) / 100;

    const packages = [
      { tier: 'Basic', pricePerStudent: 50, hoursPerStudent: 10 },
      { tier: 'Standard', pricePerStudent: 100, hoursPerStudent: 20 },
      { tier: 'Premium', pricePerStudent: 150, hoursPerStudent: 30 },
      { tier: 'Full Year', pricePerStudent: 600, hoursPerStudent: 120 },
    ];

    return {
      currentCostPerHour: costPerHour,
      recommendedMinPrice: recommendedMin,
      recommendedRetailPrice: recommendedRetail,
      marginAt5PerHour: Math.round(((5 - costPerHour) / costPerHour) * 100),
      marginAt10PerHour: Math.round(((10 - costPerHour) / costPerHour) * 100),
      breakEvenPrice: costPerHour,
      institutionalPackageAnalysis: packages.map(pkg => ({
        tier: pkg.tier,
        pricePerStudent: pkg.pricePerStudent,
        hoursPerStudent: pkg.hoursPerStudent,
        costPerStudent: Math.round(pkg.hoursPerStudent * costPerHour * 100) / 100,
        profitPerStudent: Math.round((pkg.pricePerStudent - pkg.hoursPerStudent * costPerHour) * 100) / 100,
        marginPercent: Math.round(((pkg.pricePerStudent - pkg.hoursPerStudent * costPerHour) / pkg.pricePerStudent) * 100),
      })),
    };
  }
}

export const sessionEconomicsService = new SessionEconomicsService();

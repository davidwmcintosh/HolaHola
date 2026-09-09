export interface GuardianEventEvidenceRow {
  id: string;
  sessionId: string;
  eventData: Record<string, unknown> | null;
  createdAt: Date | string;
}

export interface GuardianSessionSummary {
  guardianFires: number | null;
  guardianHardWalls: number | null;
  guardianHeard: number | null;
  guardianMissed: number | null;
  guardianCarryForward: number | null;
}

export function deriveGuardianObserverEvidence(
  rows: readonly GuardianEventEvidenceRow[],
  summary: GuardianSessionSummary | null,
) {
  const deduped = [...new Map(rows.map(row => [row.id, row])).values()]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const events = deduped.map(row => {
    const data = row.eventData ?? {};
    return {
      id: row.id,
      sessionId: row.sessionId,
      ts: new Date(row.createdAt).toISOString(),
      path: typeof data.path === 'string' ? data.path : null,
      phrase: typeof data.phrase === 'string' ? data.phrase.slice(0, 120) : null,
      outcome: data.outcome === 'heard' || data.outcome === 'missed' ? data.outcome : null,
      attemptId: typeof data.attemptId === 'string' ? data.attemptId : null,
    };
  });
  const authoritative = {
    fires: events.length,
    hardWalls: events.filter(event => event.path === 'hard-wall').length,
    heard: events.filter(event => event.outcome === 'heard').length,
    missed: events.filter(event => event.outcome === 'missed').length,
    pending: events.filter(event => event.outcome === null).length,
    carryForward: events.filter(event => event.path === 'carry-forward-buffered').length,
  };
  const expected = summary && Object.values(summary).every(value => value !== null)
    ? {
        fires: summary.guardianFires as number,
        hardWalls: summary.guardianHardWalls as number,
        heard: summary.guardianHeard as number,
        missed: summary.guardianMissed as number,
        carryForward: summary.guardianCarryForward as number,
      }
    : null;
  const discrepancy = expected
    ? Object.fromEntries(Object.entries(expected).map(([key, value]) => [
        key,
        authoritative[key as keyof typeof expected] - value,
      ]))
    : null;
  const mismatch = discrepancy
    ? Object.values(discrepancy).some(delta => delta !== 0)
    : false;

  return {
    source: 'voice_pipeline_events' as const,
    authoritative,
    recentEvents: events.slice(-10),
    summary,
    summaryState: !expected ? 'missing' as const : mismatch ? 'mismatch' as const : 'complete' as const,
    discrepancy,
  };
}
export const OBSERVATION_BENCH_ACTORS = ['luca-replit', 'luca-claude-code'] as const;

export type ObservationBenchActor = typeof OBSERVATION_BENCH_ACTORS[number];

export interface ObservationBenchPillStatus {
  identity: 'one_luca_multiple_hats';
  conversationId: string;
  sessionId: string;
  threadId: string | null;
  windowState: 'not_armed' | 'active' | 'ended';
  expectedActors: readonly ['luca-replit', 'luca-claude-code'];
  hats: Record<ObservationBenchActor, {
    connection: 'connected' | 'degraded' | 'disconnected' | 'never_connected';
    cursor: number;
    caughtUp: boolean;
    replayPending: boolean;
    lastEventAt: string | null;
  }>;
  lastEvidenceAt: string | null;
}
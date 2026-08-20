import type { GuardianAttemptTrace } from './guardian-attempt-trace';

const EXPIRY_MS = 4 * 60 * 60 * 1000;

export interface ToolCallRecord {
  name: string;
  ts: number;
  note?: string;
}

export interface GuardianFireRecord {
  ts: string;
  path: 'pre-turn' | 'post-turn-phrase' | 'friction-signal' | 'hard-wall' | 'carry-forward-buffered' | 'carry-forward-injected';
  phrase: string;
  charsInjected: number | null;
  channel: 'concat' | 'dedicated' | 'pre-turn-sendclientcontent' | null;
  outcome: 'heard' | 'missed' | null;
  groundingPreview: string | null;
  /** Optional link to the evidence-chain attempt; legacy rows may omit it. */
  attemptId?: string;
}

export interface MemorySearchRecord {
  ts: number;
  query: string;
  tool: string;               // 'memory_lookup' | 'search_my_teaching_wisdom' | 'recall' etc.
  resultCount: number;
  durationMs: number;
  domainsSearched: string[];
  formattedChars: number;
}

export interface TurnSummary {
  /** sessionStudentTurnCount at the time the turn completed */
  turn: number;
  /** All tool names called during this turn */
  tools: string[];
  /** Did any tool belong to the Archive set (recall, grounding_query, etc.)? */
  hasArchiveCall: boolean;
  ts: number;
}

export interface FrictionRecord {
  /** sessionStudentTurnCount when friction was measured */
  turn: number;
  /** 'CLEAN' | 'LOW' | 'MODERATE' | 'HIGH' */
  label: string;
  totalScore: number;
  archiveAccess: boolean;
  /** Inverted-threshold: Guardian-primed turn came back smooth → slide ran unimpeded */
  smoothSlide: boolean;
  unverifiedAssertionCount: number;
  /** Preview of the first unverified assertion phrase, if any */
  firstUnverifiedAssertion: string | null;
  ts: number;
}

/**
 * Deliberately bounded, payload-free projection of the immutable context
 * ledger. The canonical source remains context_lineage_events; this exists so
 * the Observation Bench can show a currently active trace without waiting for
 * a forensic database query.
 */
export interface ContextLineageObservationEvent {
  id: string;
  traceId: string;
  sequenceNumber: number;
  sourceRoute: string;
  eventType: string;
  deliveryChannel: string | null;
  deliveryStatus: string;
  studentTurnEpoch: number | null;
  payloadSha256: string | null;
  observedAt: string;
}

export interface ContextLineageObservationLink {
  id: string;
  traceId: string;
  fromEventId: string;
  toEventId: string;
  linkType: string;
  observedAt: string;
}

export interface ContextLineageObservationHealth {
  state: "healthy" | "degraded";
  pendingWrites: number;
  failedWrites: number;
  firstUnrecordedSequenceNumber: number | null;
  lastError: string | null;
}

export interface ContextLineageObservation {
  activeTraceId: string | null;
  events: ContextLineageObservationEvent[];
  links: ContextLineageObservationLink[];
  health: ContextLineageObservationHealth;
}

export interface SessionObservation {
  conversationId: string;
  userId: string;
  language: string | null;
  actflLevel: string | null;
  exchangeCount: number;
  scenarioSlug: string | null;
  sceneEnvironment: string | null;
  sceneImageUrl: string | null;
  sceneProps: string[];
  recentToolCalls: ToolCallRecord[];
  lastUpdatedMs: number;
  sessionStartedMs: number;
  // Archive Guardian A/B state
  guardianChannel: 'concat' | 'dedicated';
  guardianFireLog: GuardianFireRecord[];
  /** Append-only evidence chain for Guardian attempts, newest attempt last. */
  guardianAttempts: GuardianAttemptTrace[];
  // Neural net memory searches (last 20)
  recentMemorySearches: MemorySearchRecord[];
  // Per-turn tool-call summaries (last 15 turns)
  turnSummaries: TurnSummary[];
  // Friction history from analyzeFriction (last 20 records)
  frictionHistory: FrictionRecord[];
  // Live projection of immutable context lineage. Payloads stay in the durable
  // ledger and are fetched separately for authorized raw inspection.
  contextLineage: ContextLineageObservation;
}

const store = new Map<string, SessionObservation>();

function touch(conversationId: string): SessionObservation | undefined {
  return store.get(conversationId);
}

function now(): number {
  return Date.now();
}

export function observeSessionStart(opts: {
  conversationId: string;
  userId: string;
  language: string | null;
  actflLevel: string | null;
}): void {
  const existing = store.get(opts.conversationId);
  store.set(opts.conversationId, {
    conversationId: opts.conversationId,
    userId: opts.userId,
    language: opts.language,
    actflLevel: opts.actflLevel,
    exchangeCount: existing?.exchangeCount ?? 0,
    scenarioSlug: existing?.scenarioSlug ?? null,
    sceneEnvironment: existing?.sceneEnvironment ?? null,
    sceneImageUrl: existing?.sceneImageUrl ?? null,
    sceneProps: existing?.sceneProps ?? [],
    recentToolCalls: existing?.recentToolCalls ?? [],
    lastUpdatedMs: now(),
    sessionStartedMs: existing?.sessionStartedMs ?? now(),
    guardianChannel: existing?.guardianChannel ?? 'concat',
    guardianFireLog: existing?.guardianFireLog ?? [],
    guardianAttempts: existing?.guardianAttempts ?? [],
    recentMemorySearches: existing?.recentMemorySearches ?? [],
    turnSummaries: existing?.turnSummaries ?? [],
    frictionHistory: existing?.frictionHistory ?? [],
    contextLineage: existing?.contextLineage ?? {
      activeTraceId: null,
      events: [],
      links: [],
      health: {
        state: "healthy",
        pendingWrites: 0,
        failedWrites: 0,
        firstUnrecordedSequenceNumber: null,
        lastError: null,
      },
    },
  });
}

export function observeActflUpdate(conversationId: string, level: string | null): void {
  const entry = touch(conversationId);
  if (!entry) return;
  entry.actflLevel = level;
  entry.lastUpdatedMs = now();
}

export function observeExchangeCount(conversationId: string, count: number): void {
  const entry = touch(conversationId);
  if (!entry) return;
  entry.exchangeCount = count;
  entry.lastUpdatedMs = now();
}

export function observeToolCall(conversationId: string, toolName: string, note?: string): void {
  const entry = touch(conversationId);
  if (!entry) return;
  entry.recentToolCalls = [
    { name: toolName, ts: now(), note },
    ...entry.recentToolCalls,
  ].slice(0, 15);
  entry.lastUpdatedMs = now();
}

export function observeSceneOpen(conversationId: string, environment: string, imageUrl?: string): void {
  const entry = touch(conversationId);
  if (!entry) return;
  entry.sceneEnvironment = environment;
  entry.sceneImageUrl = imageUrl ?? null;
  entry.sceneProps = [];
  entry.scenarioSlug = null;
  entry.lastUpdatedMs = now();
}

export function observeScenePropChange(conversationId: string, props: string[]): void {
  const entry = touch(conversationId);
  if (!entry) return;
  entry.sceneProps = props;
  entry.lastUpdatedMs = now();
}

export function observeScenarioLoad(conversationId: string, slug: string): void {
  const entry = touch(conversationId);
  if (!entry) return;
  entry.scenarioSlug = slug;
  entry.sceneEnvironment = null;
  entry.sceneProps = [];
  entry.lastUpdatedMs = now();
}

/**
 * Record a neural-net memory or teaching-knowledge search into the observation
 * store so it surfaces in real-time at GET /api/admin/luca/observe.
 * Called from native-fc-handlers whenever searchTeachingKnowledge completes.
 */
export function observeMemorySearch(
  conversationId: string | undefined,
  record: Omit<MemorySearchRecord, 'ts'>,
): void {
  if (!conversationId) return;
  const entry = touch(conversationId);
  if (!entry) return;
  entry.recentMemorySearches = [
    { ...record, ts: now() },
    ...entry.recentMemorySearches,
  ].slice(0, 20);
  entry.lastUpdatedMs = now();
}

/**
 * Push the latest Archive Guardian state into the observation store.
 * Called after every guardianFireLog mutation in GeminiLiveSession.
 * The observe endpoint will surface this so Luca can watch fires in real-time.
 */
export function observeGuardianState(
  conversationId: string,
  channel: 'concat' | 'dedicated',
  fireLog: GuardianFireRecord[],
  attempts: GuardianAttemptTrace[] = [],
): void {
  const entry = touch(conversationId);
  if (!entry) return;
  entry.guardianChannel = channel;
  entry.guardianFireLog = [...fireLog];
  entry.guardianAttempts = attempts.map(attempt => ({
    ...attempt,
    events: [...attempt.events],
  }));
  entry.lastUpdatedMs = now();
}

/**
 * Record a completed Daniela turn — which tools were called and whether any
 * were Archive-class. Called from GeminiLiveSession right before resetting
 * currentTurnToolCalls at generationComplete.
 */
export function observeTurnComplete(
  conversationId: string,
  turn: number,
  tools: string[],
  hasArchiveCall: boolean,
): void {
  const entry = touch(conversationId);
  if (!entry) return;
  const summary: TurnSummary = { turn, tools: [...tools], hasArchiveCall, ts: now() };
  entry.turnSummaries = [summary, ...entry.turnSummaries].slice(0, 15);
  entry.lastUpdatedMs = now();
}

/**
 * Record the friction score computed by analyzeFriction() for the current turn.
 * Called from GeminiLiveSession after analyzeFriction + smoothSlide are computed.
 */
export function observeFrictionScore(
  conversationId: string,
  turn: number,
  label: string,
  score: number,
  archiveAccess: boolean,
  smoothSlide: boolean,
  unverifiedAssertions: string[],
): void {
  const entry = touch(conversationId);
  if (!entry) return;
  const record: FrictionRecord = {
    turn,
    label,
    totalScore: score,
    archiveAccess,
    smoothSlide,
    unverifiedAssertionCount: unverifiedAssertions.length,
    firstUnverifiedAssertion: unverifiedAssertions[0] ?? null,
    ts: now(),
  };
  entry.frictionHistory = [record, ...entry.frictionHistory].slice(0, 20);
  entry.lastUpdatedMs = now();
}

export function observeContextLineageEvent(
  conversationId: string | undefined,
  event: ContextLineageObservationEvent,
): void {
  if (!conversationId) return;
  const entry = touch(conversationId);
  if (!entry) return;
  entry.contextLineage.activeTraceId = event.traceId;
  entry.contextLineage.events = [
    ...entry.contextLineage.events,
    event,
  ].slice(-100);
  entry.lastUpdatedMs = now();
}

export function observeContextLineageLink(
  conversationId: string | undefined,
  link: ContextLineageObservationLink,
): void {
  if (!conversationId) return;
  const entry = touch(conversationId);
  if (!entry) return;
  entry.contextLineage.links = [
    ...entry.contextLineage.links,
    link,
  ].slice(-150);
  entry.lastUpdatedMs = now();
}

export function observeContextLineageHealth(
  conversationId: string | undefined,
  health: ContextLineageObservationHealth,
): void {
  if (!conversationId) return;
  const entry = touch(conversationId);
  if (!entry) return;
  entry.contextLineage.health = { ...health };
  entry.lastUpdatedMs = now();
}

export function observeSessionEnd(conversationId: string): void {
  store.delete(conversationId);
}

export function getObservation(conversationId: string): SessionObservation | null {
  const entry = store.get(conversationId);
  if (!entry) return null;
  if (now() - entry.lastUpdatedMs > EXPIRY_MS) {
    store.delete(conversationId);
    return null;
  }
  return entry;
}

export function getAllActiveObservations(): SessionObservation[] {
  const cutoff = now() - EXPIRY_MS;
  const active: SessionObservation[] = [];
  for (const [id, entry] of store.entries()) {
    if (entry.lastUpdatedMs < cutoff) {
      store.delete(id);
    } else {
      active.push(entry);
    }
  }
  return active;
}

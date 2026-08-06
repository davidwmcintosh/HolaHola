/**
 * Session Observation Store
 *
 * Lightweight in-memory snapshot of the currently active GL session.
 * Written to by the GL session and native FC handlers at key events.
 * Read by GET /api/admin/luca/observe so Luca can see what Daniela is doing
 * from the Replit chat window without any UI changes.
 *
 * One entry per conversationId. Auto-expires after 4 hours of inactivity.
 */

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
  channel: 'concat' | 'dedicated' | null;
  outcome: 'heard' | 'missed' | null;
  groundingPreview: string | null;
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
  // Neural net memory searches (last 20)
  recentMemorySearches: MemorySearchRecord[];
  // Per-turn tool-call summaries (last 15 turns)
  turnSummaries: TurnSummary[];
  // Friction history from analyzeFriction (last 20 records)
  frictionHistory: FrictionRecord[];
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
    recentMemorySearches: existing?.recentMemorySearches ?? [],
    turnSummaries: existing?.turnSummaries ?? [],
    frictionHistory: existing?.frictionHistory ?? [],
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
): void {
  const entry = touch(conversationId);
  if (!entry) return;
  entry.guardianChannel = channel;
  entry.guardianFireLog = [...fireLog];
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

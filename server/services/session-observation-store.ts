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

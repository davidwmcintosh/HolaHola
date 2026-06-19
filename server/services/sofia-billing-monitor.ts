/**
 * Sofia Billing Monitor
 *
 * Files server-originated issue reports for billing-integrity events so Sofia's
 * pattern-detection worker can spot repeating failures without waiting for user
 * support tickets.  Five event types are covered:
 *
 *   billing_fault:webhook_failed      — Stripe webhook couldn't fulfill a purchase
 *   billing_fault:payment_failed      — Stripe invoice.payment_failed (card declined etc.)
 *   runtime_fault:concurrent_session  — A user was blocked by the concurrent-session guard
 *   billing_fault:credit_exhausted    — A user ran out of credits mid-session
 *   runtime_fault:gl_tool_failure     — Gemini Live tool call threw an unhandled error
 *
 * Each call is fire-and-forget (errors are logged, never thrown) so it never
 * interferes with the hot path.
 */

import { getUserDb } from '../db';
import { sofiaIssueReports } from '@shared/schema';
import { founderCollabService } from './founder-collaboration-service';
import { supportPersonaService } from './support-persona-service';

const SYSTEM_USER_ID = 'system';
const environment = () =>
  process.env.NODE_ENV === 'production' ? 'production' : 'development';

// Simple in-process dedup: don't file the same (type+key) more than once per 10 minutes
const recentReports = new Map<string, number>();
const DEDUP_WINDOW_MS = 10 * 60 * 1000;

function isDuplicate(dedupKey: string): boolean {
  const last = recentReports.get(dedupKey);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
  recentReports.set(dedupKey, Date.now());
  // Keep the map tidy
  if (recentReports.size > 500) {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    for (const [k, t] of recentReports) {
      if (t < cutoff) recentReports.delete(k);
    }
  }
  return false;
}

async function fileSofiaReport(
  issueType: string,
  description: string,
  diagnosticData: Record<string, unknown>,
  dedupKey: string,
  opts: { immediateFlare?: boolean } = {},
): Promise<void> {
  if (isDuplicate(dedupKey)) return;

  try {
    const db = getUserDb();
    const [report] = await db
      .insert(sofiaIssueReports)
      .values({
        userId: SYSTEM_USER_ID,
        issueType,
        userDescription: description,
        diagnosticSnapshot: { source: 'billing_monitor', ...diagnosticData },
        environment: environment(),
        status: 'pending',
      })
      .returning();

    const flareSuffix = opts.immediateFlare ? ' [FLARE]' : '';
    console.log(`[SofiaBillingMonitor] Filed ${issueType} report ${report.id}${flareSuffix}`);

    // Notify Team Room so Sofia sees it in real-time
    founderCollabService
      .emitSofiaIssueAlert({
        reportId: report.id,
        issueType,
        userDescription: description,
        environment: environment(),
        hasVoiceDiagnostics: false,
        hasClientTelemetry: false,
      })
      .catch((e: Error) =>
        console.warn('[SofiaBillingMonitor] Alert emit failed:', e.message),
      );

    // High-severity flares skip the 5-min wait — trigger Sofia's check immediately
    if (opts.immediateFlare) {
      supportPersonaService.triggerImmediateCheck();
    }
  } catch (err: any) {
    console.error('[SofiaBillingMonitor] Failed to file report:', err.message);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Called when a Stripe checkout.session.completed webhook cannot be fulfilled.
 * Sofia will notice if these cluster (payment taken, credits not granted).
 */
export async function reportWebhookFulfillmentFailure(opts: {
  sessionId: string;
  userId?: string;
  error: string;
}): Promise<void> {
  const { sessionId, userId, error } = opts;
  await fileSofiaReport(
    'billing_fault:webhook_failed',
    `Stripe webhook fulfillment failed for checkout session ${sessionId}` +
      (userId ? ` (userId: ${userId})` : '') +
      `.\nError: ${error}`,
    { sessionId, userId, error },
    `webhook_failed:${sessionId}`,
  );
}

/**
 * Called when the concurrent-session guard blocks a new connection.
 * A pattern here may indicate session cleanup bugs or users accidentally
 * opening multiple tabs.
 */
export async function reportConcurrentSessionBlocked(opts: {
  userId: string;
  existingSessionId: string;
  ageSeconds: number;
}): Promise<void> {
  const { userId, existingSessionId, ageSeconds } = opts;
  // Dedup per user per 10 min so one stubborn user doesn't flood the table
  await fileSofiaReport(
    'runtime_fault:concurrent_session',
    `User ${userId} was blocked from starting a new session because an active session ` +
      `(${existingSessionId.substring(0, 8)}…) has been running for ${Math.round(ageSeconds)}s.`,
    { userId, existingSessionId, ageSeconds },
    `concurrent_session:${userId}`,
  );
}

/**
 * Called when a user's credit balance hits 'exhausted' during an active session.
 * Clustering here signals that the credit package sizes or pricing may need adjustment.
 */
export async function reportCreditExhausted(opts: {
  userId: string;
  sessionId?: string;
  remainingSeconds: number;
}): Promise<void> {
  const { userId, sessionId, remainingSeconds } = opts;
  await fileSofiaReport(
    'billing_fault:credit_exhausted',
    `User ${userId} exhausted their speaking-time credits mid-session` +
      (sessionId ? ` (session: ${sessionId.substring(0, 8)}…)` : '') +
      `. Remaining: ${remainingSeconds}s.`,
    { userId, sessionId, remainingSeconds },
    `credit_exhausted:${userId}`,
  );
}

/**
 * Called when Stripe fires invoice.payment_failed for a known user.
 * A cluster here may indicate a card-processor outage or an expired-card wave.
 * Deduped per Stripe customer ID per 10 min to avoid spam on retry storms.
 */
export async function reportPaymentFailed(opts: {
  customerId: string;
  userId?: string | number;
  invoiceId?: string;
  attemptCount?: number;
}): Promise<void> {
  const { customerId, userId, invoiceId, attemptCount } = opts;
  await fileSofiaReport(
    'billing_fault:payment_failed',
    `Stripe payment failed for customer ${customerId}` +
      (userId ? ` (userId: ${userId})` : '') +
      (invoiceId ? `, invoice ${invoiceId}` : '') +
      (attemptCount ? `, attempt #${attemptCount}` : '') +
      `. User marked past_due.`,
    { customerId, userId, invoiceId, attemptCount },
    `payment_failed:${customerId}`,
  );
}

/**
 * Called when a Gemini Live tool call throws an unhandled error.
 * Clustering here reveals systemic tool-call bugs that the model can't recover from.
 * Deduped per toolName per 10 min so noisy tools don't flood the table.
 */
export async function reportGlToolCallFailure(opts: {
  toolName: string;
  sessionId?: string;
  userId?: string | number;
  error: string;
}): Promise<void> {
  const { toolName, sessionId, userId, error } = opts;
  await fileSofiaReport(
    'runtime_fault:gl_tool_failure',
    `Gemini Live tool call failed: ${toolName}` +
      (userId ? ` (userId: ${userId})` : '') +
      (sessionId ? `, session ${sessionId.substring(0, 8)}…` : '') +
      `.\nError: ${error.substring(0, 300)}`,
    { toolName, sessionId, userId, error: error.substring(0, 500) },
    `gl_tool_failure:${toolName}`,
  );
}

/**
 * Record a successful GL tool call dispatch. Paired with reportGlToolCallFailure so
 * Sofia can compute real success rates rather than just seeing raw failure counts.
 */
export async function reportGlToolCallSuccess(opts: {
  toolName: string;
  sessionId?: string;
  userId?: string | number;
  durationMs?: number;
}): Promise<void> {
  const { toolName, sessionId, userId, durationMs } = opts;
  const { getSharedDb } = await import('../db');
  const { sql } = await import('drizzle-orm');
  const sharedDb = getSharedDb();
  const payload = JSON.stringify({
    toolName,
    sessionId: sessionId ? sessionId.substring(0, 36) : undefined,
    userId: userId ? String(userId) : undefined,
    durationMs: durationMs ?? null,
  });
  await sharedDb.execute(sql`
    INSERT INTO voice_pipeline_events
      (id, session_id, user_id, event_type, event_data, created_at)
    VALUES (
      gen_random_uuid(),
      ${sessionId ?? null},
      ${userId ? String(userId) : null},
      'gl_tool_success',
      ${payload}::jsonb,
      NOW()
    )
  `).catch(() => {});
}

/**
 * FLARE — called when a voice session WS closes abnormally (non-1000 code) AND the
 * session had real student activity.  This is the "chat connection died" signal.
 * Triggers an immediate Sofia monitoring check rather than waiting up to 5 minutes.
 * Deduped per userId per 10 min to suppress reconnect storms.
 */
export async function reportAbnormalDisconnect(opts: {
  userId: string | number;
  sessionId?: string;
  closeCode: number;
  exchangeCount: number;
  studentSpeakingSeconds: number;
}): Promise<void> {
  const { userId, sessionId, closeCode, exchangeCount, studentSpeakingSeconds } = opts;
  await fileSofiaReport(
    'runtime_fault:abnormal_disconnect',
    `Voice session disconnected abnormally (WS code ${closeCode}) for user ${userId}` +
      (sessionId ? `, session ${sessionId.substring(0, 8)}…` : '') +
      `. Activity at disconnect: ${exchangeCount} exchanges, ${Math.round(studentSpeakingSeconds)}s student speaking.`,
    { userId, sessionId, closeCode, exchangeCount, studentSpeakingSeconds },
    `abnormal_disconnect:${userId}`,
    { immediateFlare: true },
  );
}

/**
 * FLARE — called when Gemini Live starts but Daniela produces no audio within the
 * watchdog window (default 90s).  This is the "tutor didn't answer the call" signal.
 * Triggers an immediate Sofia monitoring check.
 * Deduped per sessionId so one watchdog fire generates at most one report.
 */
export async function reportTutorNoResponse(opts: {
  userId: string | number;
  sessionId: string;
  watchdogSeconds: number;
}): Promise<void> {
  const { userId, sessionId, watchdogSeconds } = opts;
  await fileSofiaReport(
    'runtime_fault:tutor_no_response',
    `Gemini Live session started but Daniela produced no audio within ${watchdogSeconds}s` +
      ` for user ${userId} (session ${sessionId.substring(0, 8)}…).` +
      ` Possible GL API hang or network issue between server and Gemini.`,
    { userId, sessionId, watchdogSeconds },
    `tutor_no_response:${sessionId}`,
    { immediateFlare: true },
  );
}

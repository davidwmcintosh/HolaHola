/**
 * Sofia Billing Monitor
 *
 * Files server-originated issue reports for billing-integrity events so Sofia's
 * pattern-detection worker can spot repeating failures without waiting for user
 * support tickets.  Three event types are covered:
 *
 *   billing_fault:webhook_failed     — Stripe webhook couldn't fulfill a purchase
 *   runtime_fault:concurrent_session — A user was blocked by the concurrent-session guard
 *   billing_fault:credit_exhausted   — A user ran out of credits mid-session
 *
 * Each call is fire-and-forget (errors are logged, never thrown) so it never
 * interferes with the hot path.
 */

import { getUserDb } from '../db';
import { sofiaIssueReports } from '@shared/schema';
import { founderCollabService } from './founder-collaboration-service';

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

    console.log(`[SofiaBillingMonitor] Filed ${issueType} report ${report.id}`);

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

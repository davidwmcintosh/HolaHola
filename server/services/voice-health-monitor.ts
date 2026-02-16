import { getSharedDb } from '../neon-db';
import { sql } from 'drizzle-orm';

export interface HealthTransition {
  previousStatus: string;
  newStatus: string;
  direction: 'degraded' | 'recovered' | 'worsened';
  reasons: string[];
  metrics: any;
  timestamp: Date;
}

type TransitionCallback = (transition: HealthTransition) => Promise<void>;

let lastHealthStatus: string = 'green';
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let summaryInterval: ReturnType<typeof setInterval> | null = null;
let onStatusChangeCallbacks: TransitionCallback[] = [];

export function onHealthStatusChange(callback: TransitionCallback): void {
  onStatusChangeCallbacks.push(callback);
}

async function computeHealthStatus(): Promise<{ status: string; reasons: string[]; metrics: any }> {
  const sharedDb = getSharedDb();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const [last1h, last6h] = await Promise.all([
    sharedDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(DISTINCT user_id)::int as users,
        COUNT(*) FILTER (WHERE event_type IN ('client_diag_error', 'client_diag_tts_error'))::int as errors
      FROM voice_pipeline_events
      WHERE event_type LIKE 'client_diag_%' AND created_at >= ${oneHourAgo}
    `),
    sharedDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(DISTINCT user_id)::int as users,
        COUNT(*) FILTER (WHERE event_type IN ('client_diag_error', 'client_diag_tts_error'))::int as errors
      FROM voice_pipeline_events
      WHERE event_type LIKE 'client_diag_%' AND created_at >= ${sixHoursAgo}
    `),
  ]);

  const h1 = last1h.rows[0] as any;
  const h6 = last6h.rows[0] as any;
  const eventsPerUserPer6h = h6.users > 0 ? h6.total / h6.users : 0;

  let status: string = 'green';
  const reasons: string[] = [];

  if (h1.errors > 5 || h1.total > 20) {
    status = 'red';
    reasons.push(`${h1.total} events in last hour (${h1.errors} errors) affecting ${h1.users} users`);
  } else if (h1.errors > 0 || h1.total > 5) {
    status = 'yellow';
    reasons.push(`${h1.total} events in last hour affecting ${h1.users} users`);
  }

  if (eventsPerUserPer6h > 10) {
    status = 'red';
    reasons.push(`High event rate: ${eventsPerUserPer6h.toFixed(1)} events/user over 6h`);
  } else if (eventsPerUserPer6h > 5) {
    if (status !== 'red') status = 'yellow';
    reasons.push(`Elevated event rate: ${eventsPerUserPer6h.toFixed(1)} events/user over 6h`);
  }

  if (reasons.length === 0) reasons.push('All systems nominal');

  return { status, reasons, metrics: { last1h: h1, last6h: h6 } };
}

async function runHealthCheck(): Promise<void> {
  try {
    const { status, reasons, metrics } = await computeHealthStatus();

    if (status !== lastHealthStatus) {
      const previousStatus = lastHealthStatus;
      const direction: HealthTransition['direction'] = 
        status === 'green' ? 'recovered' : 
        (previousStatus === 'green' ? 'degraded' : 
        (status === 'red' && previousStatus === 'yellow' ? 'worsened' : 'degraded'));
      
      console.log(`[VoiceHealthMonitor] ${direction.toUpperCase()}: ${previousStatus} → ${status} | ${reasons.join('; ')}`);
      
      const transition: HealthTransition = {
        previousStatus,
        newStatus: status,
        direction,
        reasons,
        metrics,
        timestamp: new Date(),
      };

      lastHealthStatus = status;

      for (const callback of onStatusChangeCallbacks) {
        try {
          await callback(transition);
        } catch (err: any) {
          console.warn(`[VoiceHealthMonitor] Transition callback error:`, err.message);
        }
      }
    }

    if (status === 'red') {
      console.warn(`[VoiceHealthMonitor] RED ALERT: ${reasons.join('; ')}`);
    }
  } catch (err: any) {
    console.warn(`[VoiceHealthMonitor] Check failed:`, err.message);
  }
}

async function generateDailySummary(targetDate?: Date): Promise<void> {
  try {
    const sharedDb = getSharedDb();
    const date = targetDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const dayStart = new Date(dateStr + 'T00:00:00.000Z');
    const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

    const existing = await sharedDb.execute(sql`
      SELECT id FROM voice_diag_daily_summaries WHERE summary_date = ${dateStr}
    `);
    if (existing.rows.length > 0) {
      return;
    }

    const [totals, byTrigger, byDevice, hourly] = await Promise.all([
      sharedDb.execute(sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(DISTINCT user_id)::int as users,
          COUNT(*) FILTER (WHERE event_type IN ('client_diag_error', 'client_diag_tts_error'))::int as errors
        FROM voice_pipeline_events
        WHERE event_type LIKE 'client_diag_%'
          AND created_at >= ${dayStart} AND created_at <= ${dayEnd}
      `),
      sharedDb.execute(sql`
        SELECT 
          REPLACE(event_type, 'client_diag_', '') as trigger,
          COUNT(*)::int as count
        FROM voice_pipeline_events
        WHERE event_type LIKE 'client_diag_%'
          AND created_at >= ${dayStart} AND created_at <= ${dayEnd}
        GROUP BY event_type
      `),
      sharedDb.execute(sql`
        SELECT
          CASE 
            WHEN (event_data->'device'->>'screenWidth')::int < 768 THEN 'mobile'
            ELSE 'desktop'
          END as device_type,
          COUNT(*)::int as count
        FROM voice_pipeline_events
        WHERE event_type LIKE 'client_diag_%'
          AND created_at >= ${dayStart} AND created_at <= ${dayEnd}
        GROUP BY device_type
      `),
      sharedDb.execute(sql`
        SELECT COUNT(*)::int as count
        FROM voice_pipeline_events
        WHERE event_type LIKE 'client_diag_%'
          AND created_at >= ${dayStart} AND created_at <= ${dayEnd}
        GROUP BY date_trunc('hour', created_at)
        ORDER BY count DESC
        LIMIT 1
      `),
    ]);

    const t = totals.rows[0] as any;
    const triggerMap: Record<string, number> = {};
    for (const row of byTrigger.rows as any[]) {
      triggerMap[row.trigger] = row.count;
    }

    let mobileCount = 0;
    let desktopCount = 0;
    for (const row of byDevice.rows as any[]) {
      if (row.device_type === 'mobile') mobileCount = row.count;
      else desktopCount = row.count;
    }

    const peakHourlyRate = hourly.rows.length > 0 ? (hourly.rows[0] as any).count : 0;

    let healthStatus = 'green';
    if (t.total > 0) {
      const errorRate = t.errors / Math.max(t.total, 1);
      const eventsPerUser = t.users > 0 ? t.total / t.users : 0;
      if (errorRate > 0.3 || eventsPerUser > 20 || peakHourlyRate > 50) {
        healthStatus = 'red';
      } else if (errorRate > 0.1 || eventsPerUser > 10 || peakHourlyRate > 20) {
        healthStatus = 'yellow';
      }
    }

    await sharedDb.execute(sql`
      INSERT INTO voice_diag_daily_summaries 
        (summary_date, total_events, unique_users, error_count, mobile_count, desktop_count, by_trigger, health_status, peak_hourly_rate)
      VALUES 
        (${dateStr}, ${t.total}, ${t.users}, ${t.errors}, ${mobileCount}, ${desktopCount}, ${JSON.stringify(triggerMap)}::jsonb, ${healthStatus}, ${peakHourlyRate})
      ON CONFLICT (summary_date) DO NOTHING
    `);

    console.log(`[VoiceHealthMonitor] Daily summary generated for ${dateStr}: ${t.total} events, ${t.users} users, status=${healthStatus}`);
  } catch (err: any) {
    console.warn(`[VoiceHealthMonitor] Daily summary failed:`, err.message);
  }
}

async function backfillExistingData(): Promise<void> {
  try {
    const sharedDb = getSharedDb();
    const dates = await sharedDb.execute(sql`
      SELECT DISTINCT date_trunc('day', created_at)::date as day
      FROM voice_pipeline_events
      WHERE event_type LIKE 'client_diag_%'
        AND created_at < CURRENT_DATE
      ORDER BY day
    `);

    for (const row of dates.rows as any[]) {
      await generateDailySummary(new Date(row.day));
    }

    if (dates.rows.length > 0) {
      console.log(`[VoiceHealthMonitor] Backfilled ${dates.rows.length} days of historical summaries`);
    }
  } catch (err: any) {
    console.warn(`[VoiceHealthMonitor] Backfill failed:`, err.message);
  }
}

export function startVoiceHealthMonitor(): void {
  const HEALTH_CHECK_INTERVAL = 15 * 60 * 1000;
  const DAILY_SUMMARY_INTERVAL = 60 * 60 * 1000;

  setTimeout(async () => {
    await backfillExistingData();
    await runHealthCheck();
  }, 15000);

  monitorInterval = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);

  summaryInterval = setInterval(async () => {
    const hour = new Date().getUTCHours();
    if (hour === 0 || hour === 1) {
      await generateDailySummary();
    }
  }, DAILY_SUMMARY_INTERVAL);

  console.log(`[VoiceHealthMonitor] Started — health check every 15min, daily summaries at midnight UTC`);
}

export { computeHealthStatus, generateDailySummary };

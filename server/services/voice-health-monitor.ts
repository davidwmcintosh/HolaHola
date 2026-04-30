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

  const [last1h, last6h, latency1h, glLatency1h, reliability1h] = await Promise.all([
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
    // Legacy E2E turn latency from old streaming pipeline (pre-GL).
    // Kept for backwards compatibility; will be empty for GL sessions.
    sharedDb.execute(sql`
      SELECT
        COUNT(*)::int as sample_count,
        AVG((event_data->'timing'->>'p95TurnLatencyMs')::float)::int as avg_p95_ms,
        MAX((event_data->'timing'->>'p95TurnLatencyMs')::float)::int as max_p95_ms
      FROM voice_pipeline_events
      WHERE event_type = 'client_diag_latency_snapshot'
        AND created_at >= ${oneHourAgo}
        AND event_data->'timing'->>'p95TurnLatencyMs' IS NOT NULL
        AND (event_data->'timing'->>'p95TurnLatencyMs')::float > 0
    `),
    // GL turn latency: per-session stats written at session end.
    // event_data: { avgMs, p50Ms, p95Ms, count } — last-word-transcription → first Daniela audio.
    sharedDb.execute(sql`
      SELECT
        COUNT(*)::int as session_count,
        SUM((event_data->>'count')::int) as total_turns,
        AVG((event_data->>'avgMs')::float)::int as avg_avg_ms,
        AVG((event_data->>'p50Ms')::float)::int as avg_p50_ms,
        AVG((event_data->>'p95Ms')::float)::int as avg_p95_ms,
        MAX((event_data->>'p95Ms')::float)::int as max_p95_ms
      FROM voice_pipeline_events
      WHERE event_type = 'gl_turn_latency'
        AND created_at >= ${oneHourAgo}
        AND (event_data->>'count')::int > 0
    `),
    // Session reliability: abnormal disconnects and tutor no-response events.
    // These are server-side events written by unified-ws-handler when a session
    // ends with a non-clean WS close code, or when the GL tutor watchdog fires.
    sharedDb.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'session_abnormal_disconnect')::int as disconnects,
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'session_abnormal_disconnect')::int as disconnect_users,
        COUNT(*) FILTER (WHERE event_type = 'gl_tutor_no_response')::int as tutor_silent
      FROM voice_pipeline_events
      WHERE event_type IN ('session_abnormal_disconnect', 'gl_tutor_no_response')
        AND created_at >= ${oneHourAgo}
    `),
  ]);

  const h1 = last1h.rows[0] as any;
  const h6 = last6h.rows[0] as any;
  const eventsPerUserPer6h = h6.users > 0 ? h6.total / h6.users : 0;
  const lat = latency1h.rows[0] as any;
  const glLat = glLatency1h.rows[0] as any;
  const rel = reliability1h.rows[0] as any;
  const disconnects1h: number = Number(rel?.disconnects ?? 0);
  const disconnectUsers1h: number = Number(rel?.disconnect_users ?? 0);
  const tutorSilent1h: number = Number(rel?.tutor_silent ?? 0);
  // Prefer GL latency if we have recent GL sessions; fall back to legacy client_diag_latency_snapshot
  const glAvgP95Ms: number | null = (glLat?.session_count > 0) ? (glLat.avg_p95_ms ?? null) : null;
  const legacyAvgP95Ms: number | null = lat?.avg_p95_ms ?? null;
  const avgP95Ms: number | null = glAvgP95Ms ?? legacyAvgP95Ms;

  let status: string = 'green';
  const reasons: string[] = [];

  // 1-hour absolute thresholds.
  // RED requires either: genuinely severe (>5 errors OR >20 events) AND multiple users,
  // OR extreme single-user crisis (>20 errors in 1h — something is deeply broken for them).
  if ((h1.errors > 5 || h1.total > 20) && h1.users >= 2) {
    status = 'red';
    reasons.push(`${h1.total} events in last hour (${h1.errors} errors) affecting ${h1.users} users`);
  } else if (h1.errors > 20) {
    // Extreme single-user crisis — 20+ errors in one hour is genuinely broken
    status = 'red';
    reasons.push(`${h1.total} events in last hour (${h1.errors} errors) — single user crisis`);
  } else if ((h1.errors > 0 || h1.total > 5) && h1.users >= 2) {
    // YELLOW (multi): multiple users affected
    status = 'yellow';
    reasons.push(`${h1.total} events in last hour affecting ${h1.users} users`);
  } else if (h1.errors > 5 && h1.users === 1) {
    // YELLOW (single): single user with elevated errors (>5)
    status = 'yellow';
    reasons.push(`${h1.total} events in last hour (${h1.errors} errors) — single user elevated errors`);
  }

  // Per-user event rate only escalates health when multiple users are affected.
  // A single user's testing session (e.g. David iterating on voice features) shouldn't
  // flag the entire platform as RED or YELLOW — the 1-hour absolute counts above already catch
  // genuine single-user crises. The per-user rate is a *platform-wide* signal.
  if (eventsPerUserPer6h > 15 && h6.users >= 2) {
    status = 'red';
    reasons.push(`High event rate: ${eventsPerUserPer6h.toFixed(1)} events/user over 6h (${h6.users} users affected)`);
  } else if (eventsPerUserPer6h > 10 && h6.users >= 2) {
    if (status !== 'red') status = 'yellow';
    reasons.push(`Elevated event rate: ${eventsPerUserPer6h.toFixed(1)} events/user over 6h (${h6.users} users affected)`);
  }
  // Single-user 6h threshold removed: testing sessions shouldn't trigger platform-wide yellow status.

  // Latency health: E2E turn latency p95 thresholds (last_word_heard → first_audio)
  // Green: < 3 000 ms  Yellow: 3 000–5 000 ms  Red: > 5 000 ms
  // Prefer GL server-side measurements; fall back to legacy client_diag_latency_snapshot
  const latencySampleCount = (glLat?.session_count > 0) ? glLat.session_count : (lat?.sample_count ?? 0);
  const latencySource = (glLat?.session_count > 0) ? 'GL sessions' : 'legacy reports';
  if (avgP95Ms !== null && latencySampleCount > 0) {
    if (avgP95Ms > 5000) {
      status = 'red';
      reasons.push(`High E2E latency: avg p95=${avgP95Ms}ms over last hour (${latencySampleCount} ${latencySource})`);
    } else if (avgP95Ms > 3000) {
      if (status !== 'red') status = 'yellow';
      reasons.push(`Elevated E2E latency: avg p95=${avgP95Ms}ms over last hour (${latencySampleCount} ${latencySource})`);
    }
  }

  // Session reliability checks.
  // Abnormal disconnects: any single user affected = yellow; ≥2 users or ≥5 events = red.
  // Rationale: a single abnormal disconnect could be a fluke (bad network), but multiple
  // affected users in one hour indicates a platform-side problem.
  if (disconnects1h > 0) {
    if (disconnects1h >= 5 || disconnectUsers1h >= 2) {
      status = 'red';
      reasons.push(`${disconnects1h} abnormal disconnects in last hour affecting ${disconnectUsers1h} user(s)`);
    } else {
      if (status !== 'red') status = 'yellow';
      reasons.push(`${disconnects1h} abnormal disconnect(s) in last hour (${disconnectUsers1h} user)`);
    }
  }

  // Tutor no-response: any occurrence is worth flagging. ≥3 in one hour = red.
  // One event might be a transient GL API hiccup; ≥3 indicates a persistent hang pattern.
  if (tutorSilent1h > 0) {
    if (tutorSilent1h >= 3) {
      status = 'red';
      reasons.push(`${tutorSilent1h} tutor no-response events in last hour (GL watchdog fired)`);
    } else {
      if (status !== 'red') status = 'yellow';
      reasons.push(`${tutorSilent1h} tutor no-response event(s) in last hour (GL watchdog)`);
    }
  }

  if (reasons.length === 0) reasons.push('All systems nominal');

  return {
    status,
    reasons,
    metrics: {
      last1h: h1,
      last6h: h6,
      reliability: {
        disconnects: disconnects1h,
        disconnectUsers: disconnectUsers1h,
        tutorSilent: tutorSilent1h,
      },
      latency: avgP95Ms !== null ? {
        avgP95Ms,
        maxP95Ms: (glLat?.session_count > 0) ? glLat.max_p95_ms : lat?.max_p95_ms,
        sampleCount: latencySampleCount,
        source: latencySource,
        // GL-specific extras
        ...(glLat?.session_count > 0 ? {
          glAvgMs: glLat.avg_avg_ms,
          glP50Ms: glLat.avg_p50_ms,
          glSessions: glLat.session_count,
          glTurns: glLat.total_turns,
        } : {}),
      } : null,
    },
  };
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

    const [totals, byTrigger, byDevice, hourly, dailyReliability] = await Promise.all([
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
      // Daily reliability: fold session_abnormal_disconnect + gl_tutor_no_response
      // into the by_trigger JSONB map under their own keys so Sofia and historical
      // queries can see them alongside the client_diag breakdown.
      sharedDb.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'session_abnormal_disconnect')::int as disconnects,
          COUNT(*) FILTER (WHERE event_type = 'gl_tutor_no_response')::int as tutor_silent
        FROM voice_pipeline_events
        WHERE event_type IN ('session_abnormal_disconnect', 'gl_tutor_no_response')
          AND created_at >= ${dayStart} AND created_at <= ${dayEnd}
      `),
    ]);

    const t = totals.rows[0] as any;
    const triggerMap: Record<string, number> = {};
    for (const row of byTrigger.rows as any[]) {
      triggerMap[row.trigger] = row.count;
    }

    // Include reliability counts in the trigger map with distinct keys.
    const relDay = dailyReliability.rows[0] as any;
    const dayDisconnects = Number(relDay?.disconnects ?? 0);
    const dayTutorSilent = Number(relDay?.tutor_silent ?? 0);
    if (dayDisconnects > 0) triggerMap['session_abnormal_disconnect'] = dayDisconnects;
    if (dayTutorSilent > 0) triggerMap['gl_tutor_no_response'] = dayTutorSilent;

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
    // Reliability signals can independently push daily status to yellow/red.
    if (healthStatus !== 'red') {
      if (dayDisconnects >= 10 || dayTutorSilent >= 5) {
        healthStatus = 'red';
      } else if (dayDisconnects >= 3 || dayTutorSilent >= 1) {
        if (healthStatus === 'green') healthStatus = 'yellow';
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

  // Delay initial health check to avoid competing with other startup workers
  // and to allow Gemini quota to be available for voice sessions from the start
  setTimeout(async () => {
    await backfillExistingData();
    await runHealthCheck();
  }, 4 * 60 * 1000); // 4 minutes after startup

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

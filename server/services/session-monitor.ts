/**
 * Session Monitor — Luca's autonomous background watchdog.
 *
 * Runs every 30s. Scans all active sessions for anomalies:
 *   - Unacknowledged SOS signals from Daniela
 *   - High tool error rates
 *   - Stalled sessions (no activity for >8 min)
 *   - Vision buffer with zero descriptions (image pipeline degraded)
 *
 * When it finds something, it posts to the Team Room and marks SOS entries
 * as acknowledged so the same issue doesn't repeat-notify.
 *
 * Start: call startSessionMonitor() once at server boot.
 * Stop:  call stopSessionMonitor() (e.g. in graceful shutdown).
 */

import { getStreamingVoiceOrchestrator } from './streaming-voice-orchestrator';

const POLL_INTERVAL_MS = 30_000;
const STALE_SESSION_MS = 8 * 60 * 1000;  // 8 minutes of silence = stalled

let monitorTimer: NodeJS.Timeout | null = null;
let isRunning = false;

async function postTeamRoomAlert(content: string): Promise<void> {
  try {
    const agentToken = process.env.REPLIT_AGENT_TOKEN;
    if (!agentToken) return;
    await fetch(`${process.env.APP_URL || 'http://localhost:5000'}/api/agent/team-room/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': agentToken },
      body: JSON.stringify({ content }),
    });
  } catch { /* non-critical */ }
}

async function runMonitorCycle(): Promise<void> {
  try {
    const orchestrator = getStreamingVoiceOrchestrator();
    const sessions = orchestrator.getActiveSessions?.() ?? [];
    if (sessions.length === 0) return;

    const now = Date.now();
    const alerts: string[] = [];

    for (const session of sessions) {
      const userId = session.userId?.slice(0, 8) ?? '?';
      const lang = session.targetLanguage ?? '?';

      // ── SOS signals ───────────────────────────────────────────────────────
      const unackedSos = (session.sosLog ?? []).filter((e: any) => !e.acknowledged);
      if (unackedSos.length > 0) {
        for (const sos of unackedSos) {
          alerts.push(
            `🚨 **SOS [${sos.severity.toUpperCase()}]** from Daniela` +
            ` (user=${userId}, lang=${lang}):\n` +
            `  Type: ${sos.issueType}\n` +
            `  "${sos.description.slice(0, 200)}"`
          );
          sos.acknowledged = true;  // mark read so it doesn't repeat
        }
      }

      // ── High tool error rate ──────────────────────────────────────────────
      const trace = session.toolCallTrace ?? [];
      if (trace.length >= 5) {
        const recent = trace.slice(-5);
        const errorCount = recent.filter((t: any) => t.status === 'error').length;
        if (errorCount >= 3) {
          const errorNames = recent
            .filter((t: any) => t.status === 'error')
            .map((t: any) => t.toolName)
            .join(', ');
          alerts.push(
            `⚠️ **High tool error rate** (user=${userId}, lang=${lang}):\n` +
            `  ${errorCount}/5 recent calls failed: ${errorNames}`
          );
        }
      }

      // ── Stalled session ───────────────────────────────────────────────────
      const lastActivity = session.lastActivityTime ?? 0;
      if (lastActivity > 0 && now - lastActivity > STALE_SESSION_MS) {
        const staleMins = Math.round((now - lastActivity) / 60000);
        alerts.push(
          `⏸️ **Stalled session** (user=${userId}, lang=${lang}): ` +
          `no activity for ${staleMins}m`
        );
      }

      // ── Vision pipeline degraded ──────────────────────────────────────────
      const vocabGrid = (session.visionBuffer?.['vocab_grid'] ?? []) as any[];
      if (vocabGrid.length >= 3) {
        const noDesc = vocabGrid.filter(
          (w: any) => !w.description || w.description.startsWith('vocabulary grid image')
        ).length;
        if (noDesc === vocabGrid.length) {
          alerts.push(
            `🖼️ **Vision pipeline degraded** (user=${userId}, lang=${lang}): ` +
            `${vocabGrid.length} vocab words, 0 real descriptions`
          );
        }
      }
    }

    if (alerts.length > 0) {
      const message =
        `**Session Monitor Alert** — ${new Date().toLocaleTimeString()}\n\n` +
        alerts.join('\n\n');
      await postTeamRoomAlert(message);
      console.warn(`[SessionMonitor] ${alerts.length} alert(s) posted to Team Room`);
    }
  } catch (err: any) {
    console.error('[SessionMonitor] Cycle error:', err?.message ?? err);
  }
}

export function startSessionMonitor(): void {
  if (isRunning) return;
  isRunning = true;
  console.log(`[SessionMonitor] Started — scanning every ${POLL_INTERVAL_MS / 1000}s`);
  monitorTimer = setInterval(runMonitorCycle, POLL_INTERVAL_MS);
  // Unref so the timer doesn't prevent process exit
  monitorTimer.unref?.();
}

export function stopSessionMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
  isRunning = false;
  console.log('[SessionMonitor] Stopped');
}

import { getSharedDb } from '../db';
import { sophiaIncidents, sophiaMessages, learnerPersonalFacts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getStreamingVoiceOrchestrator } from './streaming-voice-orchestrator';
import { WebSocket } from 'ws';
import crypto from 'crypto';

const POLL_INTERVAL_MS = 30_000;
const AUTO_RESOLVE_MS = 120_000;

let workerInterval: ReturnType<typeof setInterval> | null = null;

// Support message templates per incident category
const SUPPORT_MESSAGES: Record<string, string> = {
  audio_input:
    "Hi! I'm Sophia, your technical support. It looks like your microphone might not be reaching us. " +
    "A few quick things to try: check that your browser hasn't muted the mic tab, confirm your microphone is selected in your system settings, and try refreshing the page. " +
    "Daniela will keep the lesson warm while you sort this out — just click 'I'm good now' when you can speak again.",
  audio_output:
    "Hi! I'm Sophia. It seems like you might not be hearing Daniela's audio. " +
    "Try: check your volume and make sure your headphones/speakers are connected. " +
    "If the audio still doesn't come through, refresh the page and rejoin. " +
    "Click 'I'm good now' once you can hear again.",
  connection:
    "Hi! I'm Sophia. There's a brief connection hiccup — don't worry, Daniela will reconnect automatically. " +
    "If the session doesn't resume in 30 seconds, try refreshing the page. " +
    "Stay on this page and click 'I'm good now' once you're back.",
  tool_render:
    "Hi! I'm Sophia. One of the lesson visuals didn't load on your screen. " +
    "Daniela knows and is continuing the lesson. " +
    "If visuals still aren't appearing after a moment, a page refresh usually fixes it. " +
    "Click 'I'm good now' to let Daniela know you're set.",
  ui_sync:
    "Hi! I'm Sophia. The lesson screen may be out of sync. " +
    "Daniela is continuing — refreshing the page usually resolves this. " +
    "Click 'I'm good now' once everything looks right.",
  other:
    "Hi! I'm Sophia, your technical support. There seems to be a technical issue in your session. " +
    "Daniela is continuing — try refreshing the page if problems persist. " +
    "Click 'I'm good now' when you're ready to continue.",
};

function sendToSession(studentId: string, message: Record<string, unknown>): boolean {
  try {
    const orchestrator = getStreamingVoiceOrchestrator();
    const sessions = orchestrator.getActiveSessions();
    const session = sessions.find(s => s.userId && String(s.userId) === String(studentId));
    if (!session?.ws) return false;
    const ws = session.ws as WebSocket;
    if (ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  } catch (err: any) {
    console.error('[SophiaWorker] sendToSession error:', err.message);
    return false;
  }
}

async function processDetectedIncidents(): Promise<void> {
  try {
    const db = getSharedDb();
    const detected = await db
      .select()
      .from(sophiaIncidents)
      .where(eq(sophiaIncidents.status, 'detected'))
      .limit(10);

    for (const incident of detected) {
      try {
        const category = incident.category ?? 'other';
        const supportText = SUPPORT_MESSAGES[category] ?? SUPPORT_MESSAGES.other;

        // Insert support message
        await db.insert(sophiaMessages).values({
          incidentId: incident.id,
          role: 'sophia',
          content: supportText,
        });

        // Update incident to 'instructing'
        await db
          .update(sophiaIncidents)
          .set({ status: 'instructing' })
          .where(eq(sophiaIncidents.id, incident.id));

        // Send to student's active session
        const delivered = sendToSession(incident.studentId, {
          type: 'sophia_support_message',
          incidentId: incident.id,
          category,
          priority: incident.priority,
          message: supportText,
          timestamp: Date.now(),
        });

        console.log(
          `[SophiaWorker] Incident ${incident.id} (${category}) — message sent, WS delivered: ${delivered}`,
        );

        // Schedule auto-resolve after AUTO_RESOLVE_MS
        setTimeout(async () => {
          try {
            const [current] = await db
              .select()
              .from(sophiaIncidents)
              .where(eq(sophiaIncidents.id, incident.id))
              .limit(1);

            if (!current || current.status === 'resolved' || current.status === 'unresolved') return;

            // Auto-resolve
            await db
              .update(sophiaIncidents)
              .set({
                status: 'resolved',
                resolvedAt: new Date(),
                allClearSentAt: new Date(),
                resolutionStepsSummary: 'Auto-resolved after 2-minute timeout.',
              })
              .where(eq(sophiaIncidents.id, incident.id));

            sendToSession(incident.studentId, {
              type: 'sophia_all_clear',
              incidentId: incident.id,
              timestamp: Date.now(),
            });

            console.log(`[SophiaWorker] Incident ${incident.id} auto-resolved after timeout`);
          } catch (err: any) {
            console.error('[SophiaWorker] auto-resolve error:', err.message);
          }
        }, AUTO_RESOLVE_MS);
      } catch (err: any) {
        console.error(`[SophiaWorker] Failed to process incident ${incident.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[SophiaWorker] poll error:', err.message);
  }
}

export async function resolveIncident(incidentId: string): Promise<boolean> {
  try {
    const db = getSharedDb();
    const [incident] = await db
      .select()
      .from(sophiaIncidents)
      .where(eq(sophiaIncidents.id, incidentId))
      .limit(1);

    if (!incident) return false;
    if (incident.status === 'resolved') return true;

    await db
      .update(sophiaIncidents)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        allClearSentAt: new Date(),
        resolutionStepsSummary: 'Resolved by student acknowledgement.',
      })
      .where(eq(sophiaIncidents.id, incidentId));

    sendToSession(incident.studentId, {
      type: 'sophia_all_clear',
      incidentId: incident.id,
      timestamp: Date.now(),
    });

    // T006: Save incident pattern to learner_personal_facts so Daniela can
    // proactively check in on recurring technical issues in future sessions.
    const category = incident.category ?? 'other';
    const factText = `Had a technical issue (${category}) during a session. Sophia intervened and helped them resolve it. If this keeps coming up, check in.`;
    const factHash = crypto
      .createHash('sha256')
      .update(`${incident.studentId}:technical_support:${category}`)
      .digest('hex')
      .substring(0, 32);

    await db
      .insert(learnerPersonalFacts)
      .values({
        studentId: incident.studentId,
        factType: 'technical_support',
        fact: factText,
        context: `Sophia incident id ${incidentId}, category: ${category}`,
        confidenceScore: 0.9,
        factHash,
        isActive: true,
        lastMentionedAt: new Date(),
        mentionCount: 1,
      })
      .onConflictDoUpdate({
        target: [learnerPersonalFacts.factHash],
        set: {
          lastMentionedAt: new Date(),
        },
      })
      .catch((err: Error) => {
        // Idempotent — skip if fact already recorded
        console.warn('[SophiaWorker] learner fact upsert skipped:', err.message);
      });

    console.log(`[SophiaWorker] Incident ${incidentId} resolved by student acknowledgement`);
    return true;
  } catch (err: any) {
    console.error('[SophiaWorker] resolveIncident error:', err.message);
    return false;
  }
}

export function startSophiaWorker(): void {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    processDetectedIncidents().catch((err: Error) =>
      console.error('[SophiaWorker] interval error:', err.message),
    );
  }, POLL_INTERVAL_MS);
  console.log('[SophiaWorker] Started — polling every 30s');
}

export function stopSophiaWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

import { getSharedDb } from '../db';
import { sophiaIncidents, sophiaMessages, learnerPersonalFacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getStreamingVoiceOrchestrator } from './streaming-voice-orchestrator';
import { WebSocket } from 'ws';
import crypto from 'crypto';

const POLL_INTERVAL_MS = 30_000;
const AUTO_RESOLVE_MS = 120_000;

let workerInterval: ReturnType<typeof setInterval> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Tiered message templates
// priorCount = number of resolved incidents of this category before this one
// ─────────────────────────────────────────────────────────────────────────────

type MessageTier = 'first' | 'repeat' | 'persistent';

function getTier(priorCount: number): MessageTier {
  if (priorCount === 0) return 'first';
  if (priorCount === 1) return 'repeat';
  return 'persistent';
}

const MESSAGES: Record<string, Record<MessageTier, string>> = {
  audio_input: {
    first:
      "Hi! I'm Sophia, your technical support. It looks like your microphone might not be reaching us. " +
      "A few quick things to try: check that your browser hasn't muted the mic tab, confirm your microphone is selected in your system settings, and try refreshing the page. " +
      "Daniela will keep the lesson warm — click 'I'm good now' when you can speak again.",
    repeat:
      "Hi, it's Sophia again. Looks like the microphone issue came back. " +
      "Since the quick fixes didn't stick, let's try something more thorough: " +
      "open your browser's site settings (the lock icon in the address bar), make sure microphone permission is set to Allow, then do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R). " +
      "Click 'I'm good now' once Daniela can hear you.",
    persistent:
      "Hi, Sophia here. This is the third time your mic has gone quiet — that usually points to a browser or device-level issue rather than a one-off glitch. " +
      "A few things worth trying for a permanent fix: switch to Chrome if you aren't using it, make sure no other app (Zoom, Teams, etc.) is claiming exclusive mic access, and check your OS sound settings. " +
      "If it keeps happening, reach out to support so we can dig into it together. Click 'I'm good now' for now.",
  },
  audio_output: {
    first:
      "Hi! I'm Sophia. It seems like you might not be hearing Daniela's audio. " +
      "Try: check your volume and make sure your headphones or speakers are connected. " +
      "If the audio still doesn't come through, refresh the page and rejoin. " +
      "Click 'I'm good now' once you can hear again.",
    repeat:
      "Hi, Sophia again. Audio dropped out again — since the basics didn't fix it last time, try a different output device if you have one, or check if your browser has a separate volume setting. " +
      "A hard refresh (Ctrl+Shift+R / Cmd+Shift+R) can also reset the audio pipeline. " +
      "Click 'I'm good now' once Daniela's voice comes back.",
    persistent:
      "Hi, Sophia here. This is the third time audio has cut out on you — that's more than a fluke. " +
      "It may be a browser audio permission issue or a conflict with another app. " +
      "Try switching browsers or restarting your device. " +
      "If it persists, reach out so support can take a closer look. Click 'I'm good now' for now.",
  },
  connection: {
    first:
      "Hi! I'm Sophia. There's a brief connection hiccup — Daniela will try to reconnect automatically. " +
      "If the session doesn't resume in 30 seconds, try refreshing the page. " +
      "Click 'I'm good now' once you're back.",
    repeat:
      "Hi, Sophia again. Connection dropped again. Since this has happened before, check if your Wi-Fi signal is stable or if switching to a wired connection is an option. " +
      "If you're on mobile, moving closer to your router can help. " +
      "Refresh the page if the session doesn't auto-recover in 30 seconds.",
    persistent:
      "Hi, Sophia here. This is the third connection issue you've hit. " +
      "That level of instability usually means something outside the app — a network issue, a VPN, or a firewall. " +
      "Try turning off any VPN, or try a different network (like your phone's hotspot) to see if the session stays stable. " +
      "Worth a conversation with support if it continues.",
  },
  tool_render: {
    first:
      "Hi! I'm Sophia. One of the lesson visuals didn't load on your screen. " +
      "Daniela knows and is continuing the lesson. " +
      "A page refresh usually fixes this — click 'I'm good now' once things look right.",
    repeat:
      "Hi, Sophia again. Visuals dropped out again. Since refreshing didn't stick last time, try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) and check that your connection isn't throttled. " +
      "Large images can time out on slower connections. Click 'I'm good now' once the screen is back.",
    persistent:
      "Hi, Sophia here. Lesson visuals have failed to load a few times now for you. " +
      "This can happen if your browser is blocking certain resources or if you're on a restricted network (school, workplace). " +
      "Try a different browser or network, and reach out to support if it continues — we want to make sure your lessons look the way they should.",
  },
  ui_sync: {
    first:
      "Hi! I'm Sophia. The lesson screen may be out of sync. " +
      "Daniela is continuing — refreshing the page usually resolves this. " +
      "Click 'I'm good now' once everything looks right.",
    repeat:
      "Hi, Sophia again. Screen sync issue came back. Try a hard refresh this time (Ctrl+Shift+R / Cmd+Shift+R) rather than a standard refresh — it clears the local cache more thoroughly. " +
      "Click 'I'm good now' once the screen catches up.",
    persistent:
      "Hi, Sophia here. Sync issues keep coming up for you. " +
      "This sometimes happens when the browser has accumulated a lot of cached data. " +
      "Try clearing your browser cache for this site (Settings → Privacy → Clear site data), then reload. " +
      "If it keeps happening, let support know.",
  },
  other: {
    first:
      "Hi! I'm Sophia, your technical support. There seems to be a technical issue in your session. " +
      "Daniela is continuing — try refreshing the page if problems persist. " +
      "Click 'I'm good now' when you're ready to continue.",
    repeat:
      "Hi, Sophia again. Looks like a technical issue came up again. " +
      "Try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) — that clears more than a standard refresh. " +
      "If something specific looks wrong, note it down and let support know. Click 'I'm good now' when ready.",
    persistent:
      "Hi, Sophia here. You've hit a few technical issues in your sessions. " +
      "It's worth reaching out to support with the details — we'd like to understand what's happening so we can fix it properly. " +
      "For now, a hard refresh should get you going again.",
  },
};

function buildSupportMessage(category: string, priorCount: number): string {
  const templates = MESSAGES[category] ?? MESSAGES.other;
  const tier = getTier(priorCount);
  return templates[tier];
}

// ─────────────────────────────────────────────────────────────────────────────
// Learner fact helpers — select-then-upsert (no unique constraint on factHash)
// ─────────────────────────────────────────────────────────────────────────────

function buildFactHash(studentId: string, category: string): string {
  return crypto
    .createHash('sha256')
    .update(`${studentId}:technical_support:${category}`)
    .digest('hex')
    .substring(0, 32);
}

async function getPriorIncidentCount(studentId: string, category: string): Promise<number> {
  try {
    const db = getSharedDb();
    const hash = buildFactHash(studentId, category);
    const [existing] = await db
      .select()
      .from(learnerPersonalFacts)
      .where(eq(learnerPersonalFacts.factHash, hash))
      .limit(1);
    return existing?.mentionCount ?? 0;
  } catch {
    return 0;
  }
}

async function upsertIncidentFact(studentId: string, category: string, incidentId: string): Promise<void> {
  try {
    const db = getSharedDb();
    const hash = buildFactHash(studentId, category);

    const [existing] = await db
      .select()
      .from(learnerPersonalFacts)
      .where(eq(learnerPersonalFacts.factHash, hash))
      .limit(1);

    if (existing) {
      const newCount = (existing.mentionCount ?? 1) + 1;
      const updatedFact =
        newCount >= 3
          ? `Has had recurring ${category} issues (${newCount} times). Worth checking in about their setup.`
          : `Has had ${category} issues more than once (${newCount} times). Sophia has intervened each time.`;

      await db
        .update(learnerPersonalFacts)
        .set({
          fact: updatedFact,
          mentionCount: newCount,
          lastMentionedAt: new Date(),
          context: `Latest: Sophia incident id ${incidentId}`,
        })
        .where(eq(learnerPersonalFacts.factHash, hash));
    } else {
      await db.insert(learnerPersonalFacts).values({
        studentId,
        factType: 'technical_support',
        fact: `Had a technical issue (${category}) during a session. Sophia intervened. If this recurs, check in.`,
        context: `Sophia incident id ${incidentId}, category: ${category}`,
        confidenceScore: 0.9,
        factHash: hash,
        isActive: true,
        lastMentionedAt: new Date(),
        mentionCount: 1,
      });
    }
  } catch (err: any) {
    console.warn('[SophiaWorker] fact upsert error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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

        // Check prior resolved incidents for this student + category
        const priorCount = await getPriorIncidentCount(incident.studentId, category);
        const supportText = buildSupportMessage(category, priorCount);

        console.log(
          `[SophiaWorker] Incident ${incident.id} (${category}) — prior count: ${priorCount}, tier: ${getTier(priorCount)}`,
        );

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
          `[SophiaWorker] Incident ${incident.id} — message sent, WS delivered: ${delivered}`,
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
              issueDescription: current.issueDescription ?? null,
              resolutionNote: 'Auto-resolved after timeout.',
              timestamp: Date.now(),
            });

            // Update learner fact on auto-resolve too
            await upsertIncidentFact(incident.studentId, category, incident.id);

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
      issueDescription: incident.issueDescription ?? null,
      resolutionNote: 'Resolved by student acknowledgement.',
      timestamp: Date.now(),
    });

    // Upsert learner fact — creates or increments mentionCount
    await upsertIncidentFact(incident.studentId, incident.category ?? 'other', incidentId);

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

import { getSharedDb } from '../neon-db';
import { voicePipelineEvents } from '@shared/schema';

const FLUSH_INTERVAL_MS = 2000;
const MAX_BATCH_SIZE = 50;
const MAX_BUFFER_SIZE = 500;

interface PendingEvent {
  sessionId: string;
  userId: string;
  eventType: string;
  eventData?: Record<string, any>;
}

class VoicePipelineTelemetry {
  private buffer: PendingEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private droppedCount = 0;

  start() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    console.log('[VoiceTelemetry] Started (flush every 2s)');
  }

  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush();
  }

  log(sessionId: string, userId: string, eventType: string, eventData?: Record<string, any>) {
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.droppedCount++;
      if (this.droppedCount % 100 === 1) {
        console.warn(`[VoiceTelemetry] Buffer full (${MAX_BUFFER_SIZE}), dropped ${this.droppedCount} events total`);
      }
      return;
    }
    this.buffer.push({ sessionId, userId, eventType, eventData });
    if (this.buffer.length >= MAX_BATCH_SIZE) {
      void this.flush();
    }
  }

  private async flush() {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;

    const batch = this.buffer.splice(0, MAX_BATCH_SIZE);

    try {
      await getSharedDb().insert(voicePipelineEvents).values(
        batch.map(e => ({
          sessionId: e.sessionId,
          userId: e.userId,
          eventType: e.eventType,
          eventData: e.eventData ?? null,
        }))
      );
    } catch (err: any) {
      console.warn('[VoiceTelemetry] Flush failed, requeueing batch:', err.message);
      this.buffer.unshift(...batch);
      if (this.buffer.length > MAX_BUFFER_SIZE) {
        const excess = this.buffer.length - MAX_BUFFER_SIZE;
        this.buffer.splice(MAX_BUFFER_SIZE);
        this.droppedCount += excess;
      }
    } finally {
      this.flushing = false;
    }
  }
}

export const voiceTelemetry = new VoicePipelineTelemetry();

/**
 * storage-probe-alerter.ts
 *
 * Extracted from server/index.ts startup code so the probe-result →
 * Express Lane posting logic is independently testable.
 *
 * Call `handleStorageProbeResult` with the result returned by
 * `logStorageBackend()` and the two service dependencies; it will
 * post a [STORAGE PROBE FAILED] alert on failure, or a
 * [STORAGE PROBE OK] clearance note when the probe passes after a
 * previous failure.
 */

import type { StorageProbeResult } from '../replit_integrations/object_storage/objectStorage';
import type { FounderMessageInput } from './founder-collaboration-service';
import type { CollaborationMessage } from '@shared/schema';

// ---------------------------------------------------------------------------
// Minimal interfaces — narrow enough to be fully mockable in tests
// ---------------------------------------------------------------------------

export interface SessionHandle {
  id: string;
}

export interface ProbeAlerterSessionService {
  findOrCreateSessionByTitle(founderId: string, title: string): Promise<SessionHandle>;
  getSessionMessages(sessionId: string, limit: number): Promise<{ metadata?: Record<string, any> | null }[]>;
}

export interface ProbeAlerterBroker {
  addAndBroadcastMessage(sessionId: string, input: FounderMessageInput): Promise<CollaborationMessage | null>;
}

// ---------------------------------------------------------------------------
// Constants (keep in sync with server/index.ts)
// ---------------------------------------------------------------------------

export const EXPRESS_LANE_FOUNDER_ID = '49847136';
export const EXPRESS_LANE_SESSION_TITLE = 'Daniela — Student Watch';

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Post the appropriate alert (or nothing) to the Express Lane based on the
 * outcome of the storage probe.
 *
 * - Probe failed  → [STORAGE PROBE FAILED] message.
 * - Probe passed  → [STORAGE PROBE OK] message only when the most recent
 *                   storage-probe message was a failure (clears the alert).
 * - No bucket     → nothing posted (unconfigured — different concern).
 */
export async function handleStorageProbeResult(
  probeResult: StorageProbeResult,
  sessionService: ProbeAlerterSessionService,
  broker: ProbeAlerterBroker,
): Promise<void> {
  if (!probeResult.ok && probeResult.bucket) {
    try {
      const expressSession = await sessionService.findOrCreateSessionByTitle(
        EXPRESS_LANE_FOUNDER_ID,
        EXPRESS_LANE_SESSION_TITLE,
      );
      await broker.addAndBroadcastMessage(expressSession.id, {
        role: 'system',
        content: `[STORAGE PROBE FAILED] The startup credential probe could not reach bucket "${probeResult.bucket}". All file uploads will fail until this is resolved.\n\nError: ${probeResult.error}`,
        messageType: 'text',
        metadata: {
          source: 'storage_probe',
          event: 'probe_failed',
          bucket: probeResult.bucket,
          error: probeResult.error,
        },
      });
    } catch (alertErr: any) {
      console.warn('[ObjectStorage] Could not post Express Lane alert:', alertErr?.message ?? alertErr);
    }
    return;
  }

  if (probeResult.ok && probeResult.bucket) {
    try {
      const expressSession = await sessionService.findOrCreateSessionByTitle(
        EXPRESS_LANE_FOUNDER_ID,
        EXPRESS_LANE_SESSION_TITLE,
      );
      const recentMessages = await sessionService.getSessionMessages(expressSession.id, 30);
      const lastProbeMsg = [...recentMessages].reverse().find(
        (m) => (m.metadata as any)?.source === 'storage_probe',
      );
      if ((lastProbeMsg?.metadata as any)?.event === 'probe_failed') {
        await broker.addAndBroadcastMessage(expressSession.id, {
          role: 'system',
          content: `[STORAGE PROBE OK] Bucket "${probeResult.bucket}" is reachable — previous failure alert is now resolved.`,
          messageType: 'text',
          metadata: {
            source: 'storage_probe',
            event: 'probe_cleared',
            bucket: probeResult.bucket,
          },
        });
      }
    } catch (clearErr: any) {
      console.warn('[ObjectStorage] Could not post Express Lane clearance note:', clearErr?.message ?? clearErr);
    }
  }
}

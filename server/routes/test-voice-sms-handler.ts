/**
 * test-voice-sms-handler.ts
 *
 * Extracted handler for POST /api/admin/test-voice-sms.
 *
 * Accepts injectable dependencies (storage, db insert, delivery) so the
 * critical userId-existence guard can be exercised in unit tests without
 * a real database or Twilio credentials.
 *
 * The route in routes.ts calls buildTestVoiceSmsHandler() with the real deps.
 */

import type { Request, Response } from 'express';

// ── Dependency types ──────────────────────────────────────────────────────────

export interface TestVoiceSmsStorage {
  getUser(id: string): Promise<{ id: string } | undefined | null>;
}

export interface TestVoiceSmsQueueInsert {
  (userId: string, content: string): Promise<{ id: string }>;
}

export interface TestVoiceSmsDelivery {
  (queueId: string, userId: string, content: string): Promise<{
    smsSent: boolean;
    deliveryNote: string;
  }>;
}

export interface TestVoiceSmsHandlerDeps {
  storage: TestVoiceSmsStorage;
  insertQueue: TestVoiceSmsQueueInsert;
  deliverSms: TestVoiceSmsDelivery;
  appUrl?: string;
}

// ── Handler factory ───────────────────────────────────────────────────────────

export function buildTestVoiceSmsHandler(deps: TestVoiceSmsHandlerDeps) {
  return async function testVoiceSmsHandler(req: Request, res: Response): Promise<void> {
    try {
      const { userId, message } = req.body as { userId?: unknown; message?: unknown };

      if (!userId || typeof userId !== 'string') {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const content =
        typeof message === 'string' && message.trim()
          ? message.trim()
          : '¡Hola! I was thinking about our last session and wanted to leave you a little voice note before we meet again. See you soon!';

      // ── GUARD: 404 for unknown users ──────────────────────────────────────
      const existingUser = await deps.storage.getUser(userId);
      if (!existingUser) {
        res.status(404).json({
          error: `No user found with ID "${userId}". Check the ID and try again.`,
        });
        return;
      }

      const row = await deps.insertQueue(userId, content);
      const queueId = row.id;
      const appUrl = deps.appUrl ?? process.env.APP_URL ?? 'https://getholahola.com';
      const playbackUrl = `${appUrl}/vm/${queueId}`;

      let smsSent = false;
      let deliveryNote = 'Delivery not attempted';
      try {
        const result = await deps.deliverSms(queueId, userId, content);
        smsSent = result.smsSent;
        deliveryNote = result.deliveryNote;
      } catch (err: any) {
        console.error('[TestVoiceSms] Delivery error:', err.message);
        deliveryNote = `Delivery error: ${err.message}`;
      }

      res.json({
        queueId,
        playbackUrl,
        smsSent,
        deliveryNote,
        message: smsSent
          ? 'Queue item created and SMS sent successfully.'
          : 'Queue item created. SMS was not sent — see deliveryNote for details.',
      });
    } catch (error: any) {
      console.error('[TestVoiceSms] Error:', error);
      res.status(500).json({ error: error.message });
    }
  };
}

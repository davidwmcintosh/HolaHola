import type { Application, Response } from 'express';
import {
  requireCoordinationAuth,
  type CoordinationAuthenticatedRequest,
} from '../middleware/coordination-auth';
import { replyToAgentNoteAndVerify } from '../services/agent-notes';

export function registerAgentNoteReplyRoute(app: Application): void {
  // Actor-scoped, identity-derived linked reply. Durable recipient-inbox
  // storage is the sole meaning of delivered.
  app.post(
    '/api/agent/notes/:id/reply',
    requireCoordinationAuth,
    async (req: CoordinationAuthenticatedRequest, res: Response) => {
      try {
        if (req.coordinationActor !== 'luca-replit' && req.coordinationActor !== 'luca-claude-code') {
          return res.status(403).json({ error: 'This endpoint requires a Luca coordination actor' });
        }
        const keyHeader = req.headers['idempotency-key'];
        const idempotencyKey = typeof keyHeader === 'string'
          ? keyHeader
          : req.body?.idempotencyKey ?? req.body?.source_message_key;
        const reply = await replyToAgentNoteAndVerify({
          actor: req.coordinationActor,
          parentId: req.params.id,
          body: req.body?.body,
          subject: req.body?.subject,
          sessionLabel: req.body?.session_label,
          idempotencyKey,
        });
        res.json({
          achievedState: 'delivered',
          deduplicated: reply.deduplicated,
          note: reply.note,
          deliveryState: reply.deliveryState,
        });
      } catch (error: any) {
        if (error?.name === 'AgentNoteReplyError') {
          return res.status(error.statusCode).json({ error: error.message, code: error.code });
        }
        res.status(500).json({ error: error.message });
      }
    },
  );
}
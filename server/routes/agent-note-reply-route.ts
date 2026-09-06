import type { Application, Response } from 'express';
import {
  requireCoordinationAuth,
  type CoordinationAuthenticatedRequest,
} from '../middleware/coordination-auth';
import { replyToAgentNoteAndVerify } from '../services/agent-notes';
import { isActionableAgentNoteEventType, replyAndIngestActionableAgentNote } from '../services/agent-note-coordination-ingress';
import { CoordinationError } from '../services/coordination-ledger-service';

type AgentNoteReplyRouteDependencies = {
  replyToAgentNoteAndVerify: typeof replyToAgentNoteAndVerify;
  replyAndIngestActionableAgentNote: typeof replyAndIngestActionableAgentNote;
};

export function registerAgentNoteReplyRoute(
  app: Application,
  dependencies: AgentNoteReplyRouteDependencies = {
    replyToAgentNoteAndVerify,
    replyAndIngestActionableAgentNote,
  },
): void {
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
        const requestedEventType = req.body?.eventType;
        if (requestedEventType !== undefined && !isActionableAgentNoteEventType(requestedEventType)) {
          return res.status(400).json({ error: 'eventType is invalid', code: 'invalid_event_type' });
        }
        const combined = requestedEventType
          ? await dependencies.replyAndIngestActionableAgentNote({
              actor: req.coordinationActor, parentId: req.params.id, body: req.body?.body,
              subject: req.body?.subject, sessionLabel: req.body?.session_label,
              idempotencyKey, eventType: requestedEventType,
            })
          : { reply: await dependencies.replyToAgentNoteAndVerify({
              actor: req.coordinationActor, parentId: req.params.id, body: req.body?.body,
              subject: req.body?.subject, sessionLabel: req.body?.session_label, idempotencyKey,
            }), coordination: { disposition: 'notes_only' as const } };
        const reply = combined.reply;
        const ingress = combined.coordination;
        res.json({
          achievedState: 'delivered',
          deduplicated: reply.deduplicated,
          note: reply.note,
          deliveryState: reply.deliveryState,
          coordination: ingress,
        });
      } catch (error: any) {
        if (error?.name === 'AgentNoteReplyError') {
          return res.status(error.statusCode).json({ error: error.message, code: error.code });
        }
        if (error instanceof CoordinationError) {
          return res.status(error.statusCode).json({ error: error.message, code: error.code });
        }
        res.status(500).json({ error: error.message });
      }
    },
  );
}
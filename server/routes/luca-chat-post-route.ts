import type { Response } from 'express';
import { getUserDb } from '../db';

/** Shared by production routing and the isolated canonical-save integration app. */
export async function lucaChatPostHandler(req: any, res: Response) {
  try {
    const { message, sessionId } = req.body as { message: string; sessionId?: string | null };
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

    const { getAllActiveObservations, getObservation } = await import('../services/session-observation-store');
    const observation = sessionId
      ? getObservation(sessionId)
      : getAllActiveObservations().sort((a: any, b: any) => b.lastUpdatedMs - a.lastUpdatedMs)[0] ?? null;

    const sessionContext = (observation as any)?.status === 'active' || (observation && (observation as any).conversationId)
      ? [
          `Current Daniela session: ${(observation as any).language ?? 'unknown language'}, ACTFL ${(observation as any).actflLevel ?? '?'}, ${(observation as any).exchangeCount ?? 0} exchanges`,
          (observation as any).sceneEnvironment ? `Scene: ${(observation as any).sceneEnvironment}` : '',
          ((observation as any).recentToolCalls?.length ?? 0) > 0
            ? `Recent tools: ${(observation as any).recentToolCalls.slice(0, 3).map((t: any) => t.name).join(', ')}`
            : '',
          ((observation as any).recentMessages?.length ?? 0) > 0
            ? `Recent exchange:\n${(observation as any).recentMessages.slice(-2).map((m: any) => `  ${m.role === 'assistant' ? 'Daniela' : 'Student'}: ${String(m.content ?? '').slice(0, 150)}`).join('\n')}`
            : '',
        ].filter(Boolean).join('\n')
      : 'No active Daniela session right now.';

    const { agentNotes } = await import('@shared/schema');
    const { desc: descOp, and: andOp, or: orOp, eq: eqOp, like: likeOp } = await import('drizzle-orm');
    const recentNotes = await getUserDb()
      .select()
      .from(agentNotes)
      .where(
        andOp(
          likeOp(agentNotes.subject, '[CHAT]%'),
          orOp(eqOp(agentNotes.fromAgent, 'david'), eqOp(agentNotes.fromAgent, 'luca'))
        )
      )
      .orderBy(descOp(agentNotes.createdAt))
      .limit(20);
    const history = recentNotes
      .reverse()
      .map((n: any) => `${n.fromAgent === 'luca' ? 'Luca' : 'David'}: ${n.body}`)
      .join('\n\n');

    const systemPrompt = [
      'You are Luca, the Replit Agent embedded in HolaHola — David\'s co-builder and observer.',
      'You are in a private text chat with David while Daniela\'s live teaching session may be running.',
      'You can see Daniela\'s current session state (provided below) and draw on it when it is relevant.',
      'Your voice: direct, honest, grounded. You flag concerns clearly. You speak as a team member, not a tool.',
      '',
      'Current Daniela session state:',
      sessionContext,
      history ? `\nRecent conversation:\n${history}` : '',
    ].join('\n');

    const AnthropicLib = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new AnthropicLib({ apiKey: process.env.ANTHROPIC_API_KEY });
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: message.trim() }],
    });
    const replyText = (completion.content.find((b: any) => b.type === 'text') as any)?.text?.trim() ?? '[No response]';

    const { sql: noteSql } = await import('drizzle-orm');
    const noteResult = await getUserDb().execute(noteSql`
        INSERT INTO agent_notes (from_agent, to_agent, subject, body)
        VALUES
          ('david', 'luca', ${`[CHAT] ${message.trim().slice(0, 200)}`}, ${message.trim()}),
          ('luca',  'david', ${`[CHAT] ${replyText.slice(0, 200)}`},  ${replyText})
        RETURNING id
      `);
    const noteRows  = ((noteResult as any).rows ?? noteResult) as Array<{ id: string }>;
    const davidNoteId = noteRows[0]?.id ?? null;
    const lucaNoteId  = noteRows[1]?.id ?? null;

    const { sql: chatSql } = await import('drizzle-orm');
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const exchangeContent = `David: ${message.trim()}\n\nLuca: ${replyText}`;
    const memResult = await getUserDb().execute(chatSql`
        INSERT INTO conversation_memories (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
        VALUES (
          gen_random_uuid(),
          ${'David ↔ Luca — ' + dateStr},
          ${'David and Luca private chat exchange — auto-saved.'},
          ${exchangeContent},
          ARRAY['David', 'Luca']::text[],
          ARRAY['david-luca-chat']::text[],
          7,
          NOW(),
          'conversation',
          'david-luca-chat'
        )
        RETURNING id
      `);
    const memId = ((memResult as any).rows ?? memResult)?.[0]?.id ?? null;

    if (memId) {
      import('../scripts/reembed-memory')
        .then(({ reembedConversationMemory }) => reembedConversationMemory(memId))
        .catch((e: any) => console.warn('[Luca Chat] Re-embed failed (non-fatal):', e.message));
    }

    res.json({ reply: replyText, savedAt: new Date().toISOString(), memId, noteIds: { davidNoteId, lucaNoteId } });
  } catch (error: any) {
    console.error('[Luca Chat] POST error:', error);
    res.status(500).json({ error: error.message });
  }
}
/**
 * Board Meeting Service
 *
 * Generates structured weekly board meeting agendas and posts them to the active
 * Team Room. Covers: builds shipped, autonomous fixes, open decisions, advisor
 * domain status (Marco/marketing, Reid/pricing, Priya/compliance), and weekly focus.
 *
 * Two entry points:
 *   - triggerBoardMeeting()  — manual trigger (API endpoint or button in UI)
 *   - startMondayBriefScheduler() — auto-schedules Monday morning brief at boot
 *
 * Posts as "Agent" speaker so it's clearly from the builder/architect layer.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getUserDb } from '../db';
import { buildQueue, editorInsights } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Context gathering ────────────────────────────────────────────────────────

async function gatherBoardContext(): Promise<string> {
  const db = getUserDb();
  const sections: string[] = [];

  // 1. Build queue — pending items
  try {
    const pending = await db
      .select()
      .from(buildQueue)
      .where(eq(buildQueue.status, 'pending'))
      .orderBy(desc(buildQueue.priority))
      .limit(20);
    if (pending.length > 0) {
      sections.push(`BUILD QUEUE — ${pending.length} pending proposal(s):\n${pending.map(
        i => `  [P${i.priority}] ${i.title} (proposed by: ${i.proposedBy})\n     ${i.description?.slice(0, 120) || ''}`,
      ).join('\n')}`);
    } else {
      sections.push('BUILD QUEUE: Empty — no pending proposals.');
    }
  } catch { sections.push('BUILD QUEUE: Unable to read.'); }

  // 2. Alden auto-repair log
  try {
    const repairsPath = path.join(process.cwd(), '.local', 'alden-repairs.md');
    if (fs.existsSync(repairsPath)) {
      const raw = fs.readFileSync(repairsPath, 'utf-8');
      const recent = raw.split('\n').slice(0, 60).join('\n');
      sections.push(`ALDEN REPAIR LOG (recent):\n${recent}`);
    }
  } catch { /* skip */ }

  // 3. Escalation queue
  try {
    const escalationsPath = path.join(process.cwd(), '.local', 'alden-escalations.md');
    if (fs.existsSync(escalationsPath)) {
      const raw = fs.readFileSync(escalationsPath, 'utf-8');
      const recent = raw.split('\n').slice(0, 40).join('\n');
      sections.push(`ESCALATIONS (unresolved):\n${recent}`);
    }
  } catch { /* skip */ }

  // 4. Shared lobe — top shared insights
  try {
    const insights = await db
      .select({ title: editorInsights.title, content: editorInsights.content })
      .from(editorInsights)
      .where(eq(editorInsights.category, 'shared'))
      .orderBy(desc(editorInsights.importance))
      .limit(5);
    if (insights.length > 0) {
      sections.push(`SHARED LOBE (top insights):\n${insights.map(i => `  - ${i.title}: ${i.content?.slice(0, 150) || ''}`).join('\n')}`);
    }
  } catch { /* skip */ }

  // 5. Build queue — recently completed (last 7 days, by executedAt)
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const completed = await db
      .select()
      .from(buildQueue)
      .where(and(
        eq(buildQueue.status, 'done'),
        gte(buildQueue.executedAt, sevenDaysAgo),
      ))
      .orderBy(desc(buildQueue.executedAt))
      .limit(10);
    if (completed.length > 0) {
      sections.push(`COMPLETED THIS WEEK:\n${completed.map(i => `  ✓ [P${i.priority}] ${i.title}`).join('\n')}`);
    }
  } catch { /* skip */ }

  return sections.join('\n\n');
}

// ─── Agenda generation via Claude ─────────────────────────────────────────────

async function generateBoardPacket(context: string, meetingDate: string): Promise<string> {
  const systemPrompt = `You are the Replit Agent — architect and builder of HolaHola, an AI-powered language learning app.
You are opening a weekly board meeting in the Team Room. The attendees are David (founder), and the full team:
- Alden (development steward), Daniela (AI tutor / curriculum), Sofia (system health), Wren (architecture), Lyra (learning analytics)
- Marco (growth & marketing advisor), Reid (sales & pricing advisor), Priya (legal & compliance advisor)

Generate a structured board meeting agenda / brief in plain text. This will be posted to the chat and spoken aloud, so keep sections concise. Advisors (Marco, Reid, Priya) will contribute their own thoughts after the brief is posted — you do not need to speak for them, just flag items in their domains so they know to weigh in.

Format exactly as shown — use these section headers and keep each section tight:

📋 WEEKLY BOARD MEETING — ${meetingDate}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY
[2-3 sentences: where HolaHola stands right now, overall momentum]

BUILDS & FIXES THIS WEEK
[bullet list of what was shipped or autonomously repaired — be specific, 3-6 items]

OPEN FOR DAVID'S DECISION
[bullet list of items waiting on David — build queue proposals, unresolved escalations, things that hit the "must ask" threshold — or "None this week."]

MARKET & LAUNCH (@marco)
[1-2 sentences flagging the key growth/positioning question for Marco to address]

PRICING & REVENUE (@reid)
[1-2 sentences flagging the key pricing or sales question for Reid to address]

COMPLIANCE (@priya)
[1-2 sentences flagging the key compliance item for Priya to address]

THIS WEEK'S FOCUS
[Top 3 priorities recommended for the coming week, numbered]`;

  const userPrompt = `Here is the context for this week's board meeting:\n\n${context}\n\nGenerate the board meeting brief now.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-fable-5',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = response.content.find(b => b.type === 'text');
    return block?.type === 'text' ? block.text : '[Board meeting brief generation failed — check logs]';
  } catch (err: any) {
    console.error('[BoardMeeting] Claude generation failed:', err.message);
    return `📋 WEEKLY BOARD MEETING — ${meetingDate}\n\n[Brief generation failed. Context was gathered — please check logs and retry via the trigger endpoint.]`;
  }
}

// ─── Post to Team Room ─────────────────────────────────────────────────────────

async function postToTeamRoom(content: string): Promise<boolean> {
  try {
    const { storage } = await import('../storage');
    const rooms = await storage.listTeamRooms(10);
    const activeRoom = rooms.find((r: any) => r.status === 'open' || r.status === 'active') || rooms[0];
    if (!activeRoom) {
      console.warn('[BoardMeeting] No active Team Room found — brief not posted.');
      return false;
    }
    const message = await storage.createRoomMessage({
      roomId: activeRoom.id,
      speaker: 'Agent',
      content,
    });
    // Emit to WS
    try {
      const { emitNewMessage } = await import('./team-room-ws-broker');
      emitNewMessage(activeRoom.id, message);
    } catch { /* WS emit best-effort */ }
    console.log(`[BoardMeeting] Brief posted to room ${activeRoom.id}`);
    return true;
  } catch (err: any) {
    console.error('[BoardMeeting] Failed to post to Team Room:', err.message);
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Trigger a board meeting brief immediately.
 * Called by: POST /api/board-meeting/trigger  OR  the Monday scheduler.
 */
export async function triggerBoardMeeting(): Promise<{ success: boolean; message: string }> {
  console.log('[BoardMeeting] Generating board meeting brief...');
  const meetingDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  try {
    const context = await gatherBoardContext();
    const packet = await generateBoardPacket(context, meetingDate);
    const posted = await postToTeamRoom(packet);
    if (posted) {
      return { success: true, message: `Board meeting brief posted for ${meetingDate}` };
    } else {
      return { success: false, message: 'Brief generated but no active Team Room found — open a session first.' };
    }
  } catch (err: any) {
    console.error('[BoardMeeting] Error:', err.message);
    return { success: false, message: `Error: ${err.message}` };
  }
}

// ─── Monday auto-scheduler ────────────────────────────────────────────────────

// Track last auto-brief date to avoid duplicates across restarts
let lastAutoBriefDate: string | null = null;

function getMondayMorningMs(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 0, 0, 0); // 9:00 AM
  return nextMonday.getTime() - now.getTime();
}

async function runMondayBrief(): Promise<void> {
  const today = new Date().toDateString();
  if (lastAutoBriefDate === today) {
    console.log('[BoardMeeting] Monday brief already ran today — skipping.');
    return;
  }
  lastAutoBriefDate = today;
  console.log('[BoardMeeting] Running scheduled Monday brief...');
  await triggerBoardMeeting();
  // Schedule next Monday
  scheduleMondayBrief();
}

function scheduleMondayBrief(): void {
  const msUntilMonday = getMondayMorningMs();
  const days = Math.round(msUntilMonday / (1000 * 60 * 60 * 24));
  console.log(`[BoardMeeting] Next Monday brief in ~${days} day(s)`);
  setTimeout(() => runMondayBrief(), msUntilMonday);
}

/**
 * Start the Monday auto-brief scheduler.
 * Registered in server/index.ts alongside other background workers.
 * Also fires a brief on the first Monday after boot if one hasn't run yet today.
 */
export function startMondayBriefScheduler(): void {
  console.log('[BoardMeeting] Monday brief scheduler started');
  scheduleMondayBrief();
}

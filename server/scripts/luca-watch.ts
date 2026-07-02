#!/usr/bin/env npx tsx
/**
 * Luca Co-pilot Watch — real-time view of what Daniela sees during a live session.
 *
 * Usage:
 *   npx tsx server/scripts/luca-watch.ts [userId]
 *
 * Polls GET /api/admin/luca-session-view every 3 seconds and prints a formatted
 * snapshot to the console. Run this in a separate terminal while David chats
 * with Daniela to see both macro (Observer Seat) and micro (image descriptions)
 * in real time.
 *
 * Auth: reads agent session cookie from /tmp/sc.txt (run the auth step first):
 *   curl -si -X POST http://localhost:5000/api/internal/agent-session \
 *     -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
 *     -H "Content-Type: application/json" -d '{}' \
 *     | grep -i set-cookie | head -1 | sed 's/set-cookie: //i' | cut -d';' -f1 > /tmp/sc.txt
 */

import fs from 'fs';

const BASE_URL = 'http://localhost:5000';
const POLL_MS = 3000;
const TARGET_USER_ID = process.argv[2] || '';

function readCookie(): string {
  try { return fs.readFileSync('/tmp/sc.txt', 'utf8').trim(); } catch { return ''; }
}

function fmt(view: any): string {
  const lines: string[] = [];
  const ts = new Date().toLocaleTimeString();
  lines.push(`\n${'─'.repeat(60)}`);
  lines.push(`⏱  ${ts}  |  lang: ${view.targetLanguage ?? '?'}  |  ACTFL: ${view.actfl ?? '?'}  |  gear: ${view.gear ?? '?'}  |  calls: ${view.toolCallCount ?? 0}`);
  lines.push('─'.repeat(60));

  // Observer Seat
  const os = view.observerSeat;
  if (os?.currentSnapshot) {
    lines.push(`👁  OBSERVER SEAT (call ${os.callCount}, heartbeat in ${os.nextHeartbeatIn}):`);
    lines.push(`    ${os.currentSnapshot}`);
  } else {
    lines.push(`👁  OBSERVER SEAT: (no snapshot yet)`);
  }

  // Vocab grid
  const grid = view.visionBuffer?.vocabGrid ?? [];
  if (grid.length > 0) {
    lines.push(`\n📚 VOCAB GRID (${grid.length} words):`);
    for (const w of grid) {
      const mode = w.visionMode ? ` [${w.visionMode}]` : '';
      lines.push(`    • ${w.word} (${w.translation})${mode}`);
      if (w.description && !w.description.startsWith('vocabulary grid image')) {
        lines.push(`      └─ "${w.description}"`);
      }
    }
  }

  // Scene
  const scene = view.visionBuffer?.scene;
  if (scene) {
    const sceneName = scene.sceneStateText?.split('\n')[0] ?? JSON.stringify(scene).slice(0, 80);
    lines.push(`\n🏞  SCENE: ${sceneName}`);
  }

  // Show image
  const img = view.visionBuffer?.showImage;
  if (img) {
    lines.push(`\n🖼  IMAGE: ${img.description ?? img.imageUrl ?? '(unknown)'}`);
  }

  // Vocab card
  const card = view.visionBuffer?.vocabCard;
  if (card) {
    lines.push(`\n🃏 VOCAB CARD: ${card.word ?? ''} — ${card.description ?? ''}`);
  }

  // Textbook page
  if (view.textbookPage) {
    lines.push(`\n📖 TEXTBOOK: ${String(view.textbookPage).slice(0, 120)}...`);
  }

  // Pending GL context
  const ctx = view.pendingGlContext ?? [];
  if (ctx.length > 0) {
    lines.push(`\n⏳ PENDING GL CTX (${ctx.length} items): ${JSON.stringify(ctx).slice(0, 200)}`);
  }

  // Transcript tail
  const tail = view.transcriptTail ?? [];
  if (tail.length > 0) {
    lines.push(`\n💬 TRANSCRIPT (last ${tail.length}):`);
    for (const entry of tail) {
      const speaker = entry.role === 'student' ? '  S' : '  D';
      const t = new Date(entry.timestamp).toLocaleTimeString();
      lines.push(`${speaker} [${t}]: ${String(entry.text).slice(0, 140)}`);
    }
  }

  // Tool call trace
  const trace = view.toolCallTrace ?? [];
  if (trace.length > 0) {
    lines.push(`\n🔧 TOOL CALLS (last ${trace.length}):`);
    for (const tc of trace) {
      const t = new Date(tc.timestamp).toLocaleTimeString();
      const status = tc.status === 'error' ? ' ❌' : ' ✓';
      lines.push(`  ${status} [${t}] ${tc.toolName} (${tc.durationMs}ms)`);
      lines.push(`       args:   ${tc.argsPreview}`);
      lines.push(`       result: ${tc.resultPreview.slice(0, 120)}`);
    }
  }

  return lines.join('\n');
}

async function poll() {
  const cookie = readCookie();
  if (!cookie) {
    console.error('No cookie in /tmp/sc.txt — run the auth step first (see script header)');
    process.exit(1);
  }

  const url = `${BASE_URL}/api/admin/luca-session-view${TARGET_USER_ID ? `?userId=${TARGET_USER_ID}` : ''}`;
  console.log(`Luca Watch started — polling ${url} every ${POLL_MS}ms`);
  console.log('Press Ctrl+C to stop.\n');

  let lastSnapshot = '';

  while (true) {
    try {
      const res = await fetch(url, { headers: { Cookie: cookie } });
      if (!res.ok) {
        console.error(`HTTP ${res.status}: ${await res.text()}`);
      } else {
        const view = await res.json();
        if (!view.active) {
          process.stdout.write(`\r[${new Date().toLocaleTimeString()}] No active session...`);
        } else {
          const formatted = fmt(view);
          if (formatted !== lastSnapshot) {
            lastSnapshot = formatted;
            console.log(formatted);
          } else {
            process.stdout.write(`\r[${new Date().toLocaleTimeString()}] No change...         `);
          }
        }
      }
    } catch (err: any) {
      console.error(`Poll error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

poll();

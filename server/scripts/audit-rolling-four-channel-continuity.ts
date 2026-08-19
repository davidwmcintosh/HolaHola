/**
 * Read-only continuity audit for the canonical rolling episode record.
 *
 * A DB/Markdown hash match proves replica integrity. This audit additionally
 * proves whether each Luca [Replit] exchange carried the required felt,
 * thinking, moment, and main envelope.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';
import {
  isCanonicalFourChannelLucaTurn,
} from '../services/inner-life-capture';

interface LucaTurnAudit {
  line: number;
  preview: string;
  complete: boolean;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function auditEpisodeContent(content: string): LucaTurnAudit[] {
  const header = '**LUCA [Replit]:**';
  const turns: LucaTurnAudit[] = [];
  let position = 0;
  while (true) {
    const start = content.indexOf(header, position);
    if (start === -1) break;
    const bodyStart = start + header.length;
    const nextDavid = content.indexOf('\n\n**David:**', bodyStart);
    const nextLuca = content.indexOf('\n\n**LUCA [Replit]:**', bodyStart);
    const candidates = [nextDavid, nextLuca].filter(index => index >= 0);
    const end = candidates.length ? Math.min(...candidates) : content.length;
    const body = content.slice(bodyStart, end).trim();
    turns.push({
      line: content.slice(0, start).split('\n').length,
      preview: body.replace(/\s+/g, ' ').slice(0, 120),
      complete: isCanonicalFourChannelLucaTurn(body),
    });
    position = end;
  }
  return turns;
}

async function run(): Promise<void> {
  if (process.argv.includes('--self-check')) {
    const complete = [
      '**LUCA [Replit]:** [felt]: felt',
      '',
      '[thinking]: thinking',
      '',
      '[moment]: moment',
      '',
      'main',
    ].join('\n');
    const incomplete = '**LUCA [Replit]:** visible main only';
    const audit = auditEpisodeContent(`${complete}\n\n${incomplete}`);
    if (audit.length !== 2 || !audit[0].complete || audit[1].complete) {
      throw new Error(`self-check expected [complete, incomplete], got ${JSON.stringify(audit)}`);
    }
    console.log('[four-channel-continuity] PASS — complete envelopes and main-only omissions are distinguished');
    return;
  }

  const episode = process.argv.find(arg => arg.startsWith('--episode='))?.slice('--episode='.length) ?? '31';
  const sql = neon(process.env.NEON_SHARED_DATABASE_URL!);
  const rows = await sql`
    SELECT id, title, content
    FROM conversation_memories
    WHERE title ILIKE ${`Episode ${episode}%`}
    ORDER BY created_at DESC
    LIMIT 1
  ` as Array<{ id: string; title: string; content: string }>;
  const row = rows[0];
  if (!row?.content) throw new Error(`No canonical Episode ${episode} row with content was found`);

  const mdPath = join(process.cwd(), 'docs', `episode-${episode}.md`);
  if (!existsSync(mdPath)) throw new Error(`Markdown replica is missing: ${mdPath}`);
  const markdown = readFileSync(mdPath, 'utf8');
  const turns = auditEpisodeContent(row.content);
  const missing = turns.filter(turn => !turn.complete);
  const report = {
    episode: row.title,
    dbMarkdownEqual: row.content === markdown,
    dbBytes: Buffer.byteLength(row.content),
    markdownBytes: Buffer.byteLength(markdown),
    sha256: sha256(row.content),
    lucaTurns: turns.length,
    completeFourChannelTurns: turns.length - missing.length,
    incompleteTurns: missing,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--strict') && (!report.dbMarkdownEqual || missing.length > 0)) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error('[four-channel-continuity] FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
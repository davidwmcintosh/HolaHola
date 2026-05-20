/**
 * Voice Drift Service — T004
 *
 * Detects when Daniela's voice is drifting from her established baseline.
 * "Drift" means the semantic direction of her recent responses is diverging
 * from the high-importance curated memories that define who she is.
 *
 * HOW IT WORKS
 * ─────────────
 * Baseline (built once, rebuilt if missing):
 *   Embeds the content of the top-10 highest-importance conversation_memories,
 *   then averages the 768-dimensional vectors into a single baseline vector.
 *   Stored as .local/voice-drift-baseline.json.
 *
 * Check (runs after each consolidation cycle):
 *   Pulls the last 50 assistant messages, concatenates a sample, embeds it,
 *   computes cosine similarity to the baseline vector.
 *   - similarity ≥ 0.85 → healthy
 *   - 0.75 ≤ similarity < 0.85 → mild drift (log only)
 *   - similarity < 0.75 → significant drift → post warning to EXPRESS Lane
 *
 * Time series: all scores appended to .local/voice-drift-scores.json
 *
 * Embedding model: OpenAI text-embedding-3-small (768-dim)
 * Requires: USER_OPENAI_API_KEY or OPENAI_API_KEY
 */

import { getSharedDb } from '../db';
import { conversationMemories, messages, conversations } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';
import { embedText } from './semantic-memory-service';
import { founderCollabService } from './founder-collaboration-service';
import * as fs from 'fs';
import * as path from 'path';

const BASELINE_FILE = path.join(process.cwd(), '.local', 'voice-drift-baseline.json');
const SCORES_FILE   = path.join(process.cwd(), '.local', 'voice-drift-scores.json');
const DRIFT_THRESHOLD_WARN  = 0.75;
const DRIFT_THRESHOLD_MILD  = 0.85;
const FOUNDER_ID = '49847136';

// ─── Cosine similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function averageVectors(vecs: number[][]): number[] {
  if (vecs.length === 0) return [];
  const dim = vecs[0].length;
  const avg = new Array(dim).fill(0);
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) avg[i] += v[i];
  }
  return avg.map(x => x / vecs.length);
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function ensureLocalDir(): void {
  fs.mkdirSync(path.join(process.cwd(), '.local'), { recursive: true });
}

function readBaseline(): number[] | null {
  try {
    const raw = fs.readFileSync(BASELINE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.vector) ? parsed.vector : null;
  } catch {
    return null;
  }
}

function writeBaseline(vector: number[]): void {
  ensureLocalDir();
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ vector, builtAt: new Date().toISOString() }, null, 2), 'utf8');
}

function appendScore(score: number, messageCount: number): void {
  ensureLocalDir();
  let scores: any[] = [];
  try {
    scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
  } catch {}
  scores.push({ timestamp: new Date().toISOString(), score: Math.round(score * 10000) / 10000, messageCount });
  // Keep last 200 entries
  if (scores.length > 200) scores = scores.slice(-200);
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), 'utf8');
}

// ─── Baseline builder ─────────────────────────────────────────────────────────

async function buildBaseline(): Promise<number[]> {
  const db = getSharedDb();

  const topMemories = await db
    .select({ id: conversationMemories.id, content: conversationMemories.content })
    .from(conversationMemories)
    .orderBy(desc(conversationMemories.importance))
    .limit(10);

  if (topMemories.length === 0) {
    throw new Error('No conversation_memories available to build baseline');
  }

  const vectors: number[][] = [];
  for (const mem of topMemories) {
    if (!mem.content || mem.content.trim().length < 20) continue;
    try {
      // Use first 2000 chars of each memory for embedding
      const vec = await embedText(mem.content.substring(0, 2000));
      vectors.push(vec);
    } catch (err: any) {
      console.warn(`[VoiceDrift] Failed to embed memory ${mem.id}:`, err.message);
    }
  }

  if (vectors.length === 0) throw new Error('Could not embed any memories for baseline');

  const baseline = averageVectors(vectors);
  writeBaseline(baseline);
  console.log(`[VoiceDrift] Baseline established from ${vectors.length} conversation memories`);
  return baseline;
}

// ─── Drift check ──────────────────────────────────────────────────────────────

async function postDriftWarning(similarity: number): Promise<void> {
  try {
    const session = await founderCollabService.getOrCreateActiveSession(FOUNDER_ID);
    const score = (similarity * 100).toFixed(1);
    await founderCollabService.addMessage(session.id, {
      role: 'editor',
      content: `[VoiceDrift] ⚠️ Daniela voice drift detected — similarity to baseline: ${score}% (threshold: ${(DRIFT_THRESHOLD_WARN * 100).toFixed(0)}%). Recent responses may be diverging from her established identity. Consider reviewing recent sessions or reloading high-importance memories.`,
      metadata: { source: 'voice-drift-service', similarity, threshold: DRIFT_THRESHOLD_WARN },
    });
    console.log(`[VoiceDrift] WARNING posted to EXPRESS Lane — similarity: ${score}%`);
  } catch (err: any) {
    console.warn('[VoiceDrift] Could not post to EXPRESS Lane:', err.message);
  }
}

export async function checkVoiceDrift(): Promise<void> {
  const db = getSharedDb();

  // Get or build baseline
  let baseline = readBaseline();
  if (!baseline) {
    console.log('[VoiceDrift] No baseline found — building from conversation_memories...');
    try {
      baseline = await buildBaseline();
    } catch (err: any) {
      console.warn('[VoiceDrift] Could not build baseline:', err.message);
      return;
    }
  }

  // Sample recent assistant messages (last 50)
  const recentMsgs = await db
    .select({ content: messages.content })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(messages.role, 'model'))
    .orderBy(desc(messages.createdAt))
    .limit(50);

  if (recentMsgs.length < 10) {
    console.log('[VoiceDrift] Not enough recent messages to compute drift — skipping');
    return;
  }

  // Concatenate a sample of recent messages for embedding
  const sample = recentMsgs
    .slice(0, 30)
    .map(m => m.content.substring(0, 200))
    .join('\n\n');

  let currentVec: number[];
  try {
    currentVec = await embedText(sample.substring(0, 3000));
  } catch (err: any) {
    console.warn('[VoiceDrift] Could not embed recent messages:', err.message);
    return;
  }

  const similarity = cosineSimilarity(baseline, currentVec);
  appendScore(similarity, recentMsgs.length);

  const pct = (similarity * 100).toFixed(1);

  if (similarity < DRIFT_THRESHOLD_WARN) {
    console.log(`[VoiceDrift] Similarity: ${pct}% — SIGNIFICANT DRIFT (threshold: ${(DRIFT_THRESHOLD_WARN * 100).toFixed(0)}%)`);
    await postDriftWarning(similarity);
  } else if (similarity < DRIFT_THRESHOLD_MILD) {
    console.log(`[VoiceDrift] Similarity: ${pct}% — mild drift (monitoring)`);
  } else {
    console.log(`[VoiceDrift] Similarity: ${pct}% — healthy`);
  }
}

// ─── Startup baseline ─────────────────────────────────────────────────────────

export async function ensureVoiceDriftBaseline(): Promise<void> {
  const existing = readBaseline();
  if (existing) {
    console.log('[VoiceDrift] Baseline already exists — skipping rebuild');
    return;
  }
  try {
    await buildBaseline();
  } catch (err: any) {
    console.warn('[VoiceDrift] Baseline build skipped:', err.message);
  }
}

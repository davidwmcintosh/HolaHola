import { getUserDb, getSharedDb } from '../db';
import { sofiaIssueReports } from '@shared/schema';
import { founderCollabService } from './founder-collaboration-service';
import { postToActiveTeamRoom } from './team-room-proactive-poster';
import { callGeminiWithSchema, GEMINI_MODELS } from '../gemini-utils';
import { eq, and, desc, inArray, lt, sql } from 'drizzle-orm';
import { founderSessions, users } from '@shared/schema';

const CLEANUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const SOFIA_SESSION_TITLE = 'Sofia Support Monitor';
const HISTORICAL_AGE_DAYS = 30;
const CLEANUP_DEDUP_MS = 3 * 24 * 60 * 60 * 1000;

let cleanupInterval: ReturnType<typeof setInterval> | null = null;
let lastCleanupTime: Date | null = null;
let isRunning = false;
let cleanupCount = 0;

interface IssueGroup {
  issueType: string;
  count: number;
  sampleDescriptions: string[];
  oldestDate: Date;
}

interface CleanupDecision {
  issueType: string;
  resolvable: boolean;
  reason: string;
}

interface CleanupResult {
  totalPending: number;
  totalOld: number;
  resolved: number;
  remaining: number;
  decisions: CleanupDecision[];
}

async function resolveFounderId(): Promise<string> {
  const db = getSharedDb();
  const [fromSession] = await db
    .select({ founderId: founderSessions.founderId })
    .from(founderSessions)
    .orderBy(desc(founderSessions.createdAt))
    .limit(1);
  if (fromSession?.founderId) return fromSession.founderId;

  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ['admin', 'developer']))
    .limit(1);
  if (adminUser?.id) return adminUser.id;

  throw new Error('No founder/admin user found');
}

async function getOrCreateSofiaSession(): Promise<string> {
  const db = getSharedDb();
  const [existing] = await db
    .select()
    .from(founderSessions)
    .where(and(
      eq(founderSessions.title, SOFIA_SESSION_TITLE),
      eq(founderSessions.status, 'active')
    ))
    .orderBy(desc(founderSessions.createdAt))
    .limit(1);

  if (existing) return existing.id;

  const founderId = await resolveFounderId();
  const session = await founderCollabService.createSession(founderId, SOFIA_SESSION_TITLE);
  return session.id;
}

async function assessIssueGroups(groups: IssueGroup[]): Promise<CleanupDecision[]> {
  const groupList = groups.map(g =>
    `Issue type: "${g.issueType}" | Count: ${g.count} | Oldest: ${g.oldestDate.toDateString()} | Sample reports: ${g.sampleDescriptions.slice(0, 3).map(d => `"${d.substring(0, 80)}"`).join('; ')}`
  ).join('\n');

  const prompt = `You are Sofia, HolaHola's support and quality monitor. You are reviewing a backlog of pending issue reports older than ${HISTORICAL_AGE_DAYS} days to determine which can be resolved as historical artifacts.

CURRENT SYSTEM CONTEXT (as of today):
- The voice pipeline was fully rebuilt with Google Cloud TTS Chirp 3 HD as primary provider
- Double-audio and audio duplication issues were fixed via TTS deduplication guards
- WebSocket connection stability was improved significantly
- Latency improvements were made to the voice streaming pipeline
- Many "runtime_fault" errors from the development environment are expected and non-critical
- Issues from development environment are generally lower priority than production
- The system has been stable for several weeks

ISSUE GROUPS TO REVIEW:
${groupList}

For each issue type, decide:
- resolvable=true if: the underlying technical cause is very likely fixed, it's a dev environment artifact, or the reports are old enough that the users have moved on and the issue is no longer actionable
- resolvable=false if: the issue is still potentially active, represents a user-reported production problem worth retaining, or you are not confident it's resolved

Be conservative — when in doubt, set resolvable=false. Only mark resolvable if you're confident the issue class is resolved or is not actionable.`;

  const result = await callGeminiWithSchema<{ decisions: CleanupDecision[] }>(
    GEMINI_MODELS.FLASH,
    [{ role: 'user', content: prompt }],
    {
      type: 'object',
      properties: {
        decisions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              issueType: { type: 'string', description: 'Exact issue type string from the input' },
              resolvable: { type: 'boolean', description: 'Whether this issue type can be auto-resolved as a historical artifact' },
              reason: { type: 'string', description: 'Clear explanation (1-2 sentences) of the decision' },
            },
            required: ['issueType', 'resolvable', 'reason'],
          },
        },
      },
      required: ['decisions'],
    }
  );

  return result.decisions || [];
}

async function resolveIssuesByType(issueType: string, reason: string): Promise<number> {
  const db = getUserDb();
  const cutoffDate = new Date(Date.now() - HISTORICAL_AGE_DAYS * 24 * 60 * 60 * 1000);

  try {
    const result = await db
      .update(sofiaIssueReports)
      .set({
        status: 'resolved',
        founderNotes: `[Sofia Auto-Resolved] ${reason} Resolved ${new Date().toISOString().split('T')[0]} after ${HISTORICAL_AGE_DAYS}+ days in queue.`,
        reviewedAt: new Date(),
      })
      .where(and(
        eq(sofiaIssueReports.issueType, issueType),
        eq(sofiaIssueReports.status, 'pending'),
        lt(sofiaIssueReports.createdAt, cutoffDate)
      ));

    return (result as any).rowCount ?? 0;
  } catch (err: any) {
    console.error(`[SofiaCleanup] Failed to resolve type "${issueType}":`, err.message);
    return 0;
  }
}

async function runCleanup(): Promise<void> {
  if (isRunning) {
    console.log(`[SofiaCleanup] Already running, skipping`);
    return;
  }

  if (lastCleanupTime && Date.now() - lastCleanupTime.getTime() < CLEANUP_DEDUP_MS) {
    console.log(`[SofiaCleanup] Recent cleanup done at ${lastCleanupTime.toISOString()}, skipping`);
    return;
  }

  isRunning = true;
  cleanupCount++;
  const startTime = Date.now();
  console.log(`[SofiaCleanup] Starting issue cleanup #${cleanupCount}...`);

  try {
    const db = getUserDb();
    const cutoffDate = new Date(Date.now() - HISTORICAL_AGE_DAYS * 24 * 60 * 60 * 1000);

    const allPending = await db
      .select({
        id: sofiaIssueReports.id,
        issueType: sofiaIssueReports.issueType,
        userDescription: sofiaIssueReports.userDescription,
        createdAt: sofiaIssueReports.createdAt,
      })
      .from(sofiaIssueReports)
      .where(eq(sofiaIssueReports.status, 'pending'));

    const oldPending = allPending.filter(r => new Date(r.createdAt) < cutoffDate);
    console.log(`[SofiaCleanup] Total pending: ${allPending.length}, older than ${HISTORICAL_AGE_DAYS}d: ${oldPending.length}`);

    if (oldPending.length === 0) {
      console.log(`[SofiaCleanup] No old issues to clean up`);
      lastCleanupTime = new Date();
      return;
    }

    const groupMap = new Map<string, IssueGroup>();
    for (const r of oldPending) {
      const type = r.issueType || 'unknown';
      if (!groupMap.has(type)) {
        groupMap.set(type, {
          issueType: type,
          count: 0,
          sampleDescriptions: [],
          oldestDate: new Date(r.createdAt),
        });
      }
      const group = groupMap.get(type)!;
      group.count++;
      if (group.sampleDescriptions.length < 5 && r.userDescription) {
        group.sampleDescriptions.push(r.userDescription);
      }
      if (new Date(r.createdAt) < group.oldestDate) {
        group.oldestDate = new Date(r.createdAt);
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => b.count - a.count);
    console.log(`[SofiaCleanup] ${groups.length} distinct issue types to assess`);

    let decisions: CleanupDecision[] = [];
    try {
      decisions = await assessIssueGroups(groups);
    } catch (err: any) {
      console.error(`[SofiaCleanup] Gemini assessment failed:`, err.message);
      lastCleanupTime = new Date();
      return;
    }

    let totalResolved = 0;
    const resolvedTypes: Array<{ type: string; count: number; reason: string }> = [];
    const retainedTypes: Array<{ type: string; count: number; reason: string }> = [];

    for (const decision of decisions) {
      const group = groupMap.get(decision.issueType);
      if (!group) continue;

      if (decision.resolvable) {
        const resolved = await resolveIssuesByType(decision.issueType, decision.reason);
        totalResolved += resolved;
        resolvedTypes.push({ type: decision.issueType, count: resolved, reason: decision.reason });
        console.log(`[SofiaCleanup] Resolved ${resolved}x "${decision.issueType}": ${decision.reason}`);
      } else {
        retainedTypes.push({ type: decision.issueType, count: group.count, reason: decision.reason });
        console.log(`[SofiaCleanup] Retained "${decision.issueType}": ${decision.reason}`);
      }
    }

    const remainingPending = allPending.length - totalResolved;
    lastCleanupTime = new Date();

    let sessionId: string;
    try {
      sessionId = await getOrCreateSofiaSession();
    } catch {
      console.error(`[SofiaCleanup] Cannot post to Express Lane — session unavailable`);
      return;
    }

    const resolvedLines = resolvedTypes.length > 0
      ? resolvedTypes.map(r => `  ✓ ${r.type} (${r.count} issues): ${r.reason}`).join('\n')
      : '  None';

    const retainedLines = retainedTypes.length > 0
      ? retainedTypes.map(r => `  — ${r.type} (${r.count} issues): ${r.reason}`).join('\n')
      : '  None';

    const report = `**Sofia Issue Cleanup #${cleanupCount}**

Reviewed ${oldPending.length} pending issues older than ${HISTORICAL_AGE_DAYS} days (${allPending.length} total pending).

**Resolved (${totalResolved} issues)**
${resolvedLines}

**Retained for review (${oldPending.length - totalResolved} of the old backlog)**
${retainedLines}

**Remaining queue: ${remainingPending} pending issues**

*Sofia auto-resolved historical artifacts under Tier 1 rules. Retained issues remain pending for founder review. Next cleanup in 7 days.*

*Sofia Issue Cleanup — ${new Date().toISOString()}*`;

    await founderCollabService.addMessage(sessionId, {
      role: 'system',
      content: report,
      metadata: {
        type: 'sofia_cleanup',
        cleanupNumber: cleanupCount,
        resolved: totalResolved,
        remaining: remainingPending,
        totalOld: oldPending.length,
      },
    });

    if (totalResolved > 0) {
      const briefSummary = `Issue cleanup #${cleanupCount} complete. Auto-resolved ${totalResolved} historical artifacts (${resolvedTypes.map(r => r.type).join(', ')}). ${remainingPending} issues remain pending.`;
      await postToActiveTeamRoom({
        participant: 'sofia',
        briefSummary,
        source: 'Sofia Issue Cleanup Worker',
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SofiaCleanup] Cleanup #${cleanupCount} complete: ${totalResolved} resolved, ${remainingPending} remaining in ${elapsed}ms`);

  } catch (err: any) {
    console.error(`[SofiaCleanup] Cleanup failed:`, err.message);
  } finally {
    isRunning = false;
  }
}

export function startSofiaCleanupWorker(): void {
  console.log(`[SofiaCleanup] Starting (interval: 7d)`);

  setTimeout(() => {
    runCleanup().catch(err => {
      console.error(`[SofiaCleanup] Initial cleanup error:`, err.message);
    });
  }, 90_000);

  cleanupInterval = setInterval(() => {
    runCleanup().catch(err => {
      console.error(`[SofiaCleanup] Periodic cleanup error:`, err.message);
    });
  }, CLEANUP_INTERVAL_MS);
}

export function stopSofiaCleanupWorker(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log(`[SofiaCleanup] Stopped`);
  }
}

export async function triggerSofiaCleanup(): Promise<void> {
  lastCleanupTime = null;
  return runCleanup();
}

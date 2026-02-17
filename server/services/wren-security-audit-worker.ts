import { wrenSecurityAuditService, type SecurityFinding } from './wren-security-audit-service';
import { founderCollabService } from './founder-collaboration-service';
import { getSharedDb } from '../db';
import { founderSessions, users } from '@shared/schema';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';

const AUDIT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SECURITY_SESSION_TITLE = 'Wren Security Officer';

let auditInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastAuditTime: Date | null = null;
let auditCount = 0;

interface AuditStats {
  totalAudits: number;
  lastAuditTime: Date | null;
  lastFindingCount: number;
  lastSeverityCounts: Record<string, number>;
}

const stats: AuditStats = {
  totalAudits: 0,
  lastAuditTime: null,
  lastFindingCount: 0,
  lastSeverityCounts: {},
};

async function resolveFounderId(): Promise<string> {
  const [fromSession] = await getSharedDb()
    .select({ founderId: founderSessions.founderId })
    .from(founderSessions)
    .orderBy(desc(founderSessions.createdAt))
    .limit(1);
  if (fromSession?.founderId) return fromSession.founderId;

  const [adminUser] = await getSharedDb()
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ['admin', 'developer']))
    .limit(1);
  if (adminUser?.id) return adminUser.id;

  throw new Error('No founder/admin user found — cannot create security session');
}

async function getOrCreateSecuritySession(): Promise<string> {
  try {
    const [existing] = await getSharedDb().select()
      .from(founderSessions)
      .where(and(
        eq(founderSessions.title, SECURITY_SESSION_TITLE),
        eq(founderSessions.status, 'active')
      ))
      .orderBy(desc(founderSessions.createdAt))
      .limit(1);

    if (existing) return existing.id;

    const founderId = await resolveFounderId();

    const session = await founderCollabService.createSession(founderId, SECURITY_SESSION_TITLE);
    console.log(`[Wren Security Worker] Created Hive session: ${session.id} (founder: ${founderId})`);
    return session.id;
  } catch (err: any) {
    console.error(`[Wren Security Worker] Failed to get/create session:`, err.message);
    throw err;
  }
}

function buildSeverityCounts(findings: SecurityFinding[]): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
  }
  return counts;
}

function buildCategoryCounts(findings: SecurityFinding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of findings) {
    counts[f.category] = (counts[f.category] || 0) + 1;
  }
  return counts;
}

function formatCompactReport(findings: SecurityFinding[], severityCounts: Record<string, number>): string {
  if (findings.length === 0) {
    return `**Wren Security Sweep — All Clear**\n\nNo security issues detected. All scanners passed.\n\n*Next audit in ${AUDIT_INTERVAL_MS / (60 * 60 * 1000)}h*`;
  }

  const categoryCounts = buildCategoryCounts(findings);
  const categoryList = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `  ${cat.replace(/_/g, ' ')}: ${count}`)
    .join('\n');

  const topFindings = findings
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    })
    .slice(0, 5)
    .map(f => `- [${f.severity.toUpperCase()}] ${f.title} → ${f.filePath}${f.lineNumber ? `:${f.lineNumber}` : ''}`)
    .join('\n');

  return `**Wren Security Sweep — ${findings.length} Finding(s)**

Severity: ${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low

By category:
${categoryList}

Top issues:
${topFindings}

*Full analysis follows. Next audit in ${AUDIT_INTERVAL_MS / (60 * 60 * 1000)}h.*`;
}

async function runSecurityAudit(): Promise<void> {
  if (isRunning) {
    console.log(`[Wren Security Worker] Audit already in progress, skipping`);
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log(`[Wren Security Worker] Starting security audit #${auditCount + 1}...`);

    const findings = await wrenSecurityAuditService.runFullAudit();
    const severityCounts = buildSeverityCounts(findings);

    stats.totalAudits++;
    stats.lastAuditTime = new Date();
    stats.lastFindingCount = findings.length;
    stats.lastSeverityCounts = severityCounts;
    auditCount++;
    lastAuditTime = new Date();

    let sessionId: string;
    try {
      sessionId = await getOrCreateSecuritySession();
    } catch {
      console.error(`[Wren Security Worker] Cannot post to Hive — session unavailable`);
      return;
    }

    const compactReport = formatCompactReport(findings, severityCounts);
    await founderCollabService.addMessage(sessionId, {
      role: 'wren',
      content: compactReport,
      metadata: {
        type: 'security_audit',
        findingCount: findings.length,
        severityCounts,
        auditNumber: auditCount,
      },
    });

    if (findings.length > 0) {
      try {
        const aiReport = await wrenSecurityAuditService.enrichWithAI(findings);
        await founderCollabService.addMessage(sessionId, {
          role: 'wren',
          content: aiReport,
          metadata: { type: 'security_audit_analysis', auditNumber: auditCount },
        });
      } catch (err: any) {
        console.error(`[Wren Security Worker] AI enrichment failed:`, err.message);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Wren Security Worker] Audit #${auditCount} complete: ${findings.length} findings in ${elapsed}ms`);

  } catch (err: any) {
    console.error(`[Wren Security Worker] Audit failed:`, err.message);
  } finally {
    isRunning = false;
  }
}

export function startSecurityAuditWorker(intervalMs?: number): void {
  const interval = intervalMs || AUDIT_INTERVAL_MS;
  console.log(`[Wren Security Worker] Starting (interval: ${interval / (60 * 60 * 1000)}h)`);

  setTimeout(() => {
    runSecurityAudit().catch(err => {
      console.error(`[Wren Security Worker] Initial audit error:`, err.message);
    });
  }, 30_000);

  auditInterval = setInterval(() => {
    runSecurityAudit().catch(err => {
      console.error(`[Wren Security Worker] Periodic audit error:`, err.message);
    });
  }, interval);
}

export function stopSecurityAuditWorker(): void {
  if (auditInterval) {
    clearInterval(auditInterval);
    auditInterval = null;
    console.log(`[Wren Security Worker] Stopped`);
  }
}

export function getSecurityAuditStats(): AuditStats {
  return { ...stats };
}

export async function triggerSecurityAudit(): Promise<void> {
  return runSecurityAudit();
}

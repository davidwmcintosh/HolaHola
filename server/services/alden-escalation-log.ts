/**
 * Alden Escalation Log
 *
 * When Alden identifies a recurring issue that auto-repair cannot fix,
 * or an ALERT-severity issue that was immediately ineligible for repair,
 * it writes here so the Replit Agent sees it at session start and can act.
 *
 * Primary: alden_escalations table in the database (survives restarts).
 * Secondary: .local/alden-escalations.md file (for agent briefing file).
 */

import * as fs from 'fs';
import * as path from 'path';
import { getUserDb } from '../db';
import { aldenEscalations } from '@shared/schema';

const ESCALATION_LOG_PATH = path.join(process.cwd(), '.local/alden-escalations.md');

function ensureEscalationFile(): void {
  if (!fs.existsSync(ESCALATION_LOG_PATH)) {
    const header = `# Alden Escalation Queue

> **Replit Agent**: Read this file at every session start.
> Alden writes here when he detects a recurring or high-severity issue
> that auto-repair cannot fix autonomously — it needs your attention.
> Each entry shows the issue, why Alden couldn't fix it, and what he recommends.
> Mark items resolved by appending \`[RESOLVED: <date> — <what you did>]\` below the entry.
> The canonical source of truth is the alden_escalations database table.

---

`;
    fs.writeFileSync(ESCALATION_LOG_PATH, header, 'utf-8');
  }
}

/**
 * Write an escalation entry to the database (primary) and the file log (secondary).
 *
 * @param issueDescription  What Alden detected
 * @param analysis          Claude's analysis and recommended action
 * @param trigger           Why this is being escalated
 */
export async function writeEscalation(
  issueDescription: string,
  analysis: string,
  trigger: 'recurring_pattern' | 'alert_ineligible' = 'recurring_pattern',
): Promise<void> {
  // Primary: write to the database
  try {
    const db = getUserDb();
    await db.insert(aldenEscalations).values({
      issueDescription,
      analysis,
      trigger,
      status: 'open',
    });
    console.log('[AldenEscalation] Written escalation to database');
  } catch (dbErr: any) {
    console.warn('[AldenEscalation] Failed to write escalation to DB:', dbErr.message);
  }

  // Secondary: write to file so agent briefing still works
  try {
    ensureEscalationFile();

    const ts = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const triggerLabel =
      trigger === 'recurring_pattern'
        ? 'RECURRING — 3+ consecutive watch cycles'
        : 'ALERT — single occurrence, auto-repair ineligible';

    const entry = `## [${ts}] ${triggerLabel}

**Issue:** ${issueDescription}

**Analysis / Recommended Action:**
${analysis}

**Status:** OPEN (check alden_escalations table for canonical status)

---

`;

    fs.appendFileSync(ESCALATION_LOG_PATH, entry, 'utf-8');
  } catch (fileErr: any) {
    console.warn('[AldenEscalation] Failed to write escalation file:', fileErr.message);
  }
}

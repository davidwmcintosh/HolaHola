/**
 * Alden Escalation Log
 *
 * When Alden identifies a recurring issue that auto-repair cannot fix,
 * or an ALERT-severity issue that was immediately ineligible for repair,
 * it writes here so the Replit Agent sees it at session start and can act.
 *
 * File: .local/alden-escalations.md
 * Agent: read this at session start. Each entry describes what broke,
 * why auto-repair declined, and what action is recommended.
 */

import * as fs from 'fs';
import * as path from 'path';

const ESCALATION_LOG_PATH = path.join(process.cwd(), '.local/alden-escalations.md');

function ensureEscalationFile(): void {
  if (!fs.existsSync(ESCALATION_LOG_PATH)) {
    const header = `# Alden Escalation Queue

> **Replit Agent**: Read this file at every session start.
> Alden writes here when he detects a recurring or high-severity issue
> that auto-repair cannot fix autonomously — it needs your attention.
> Each entry shows the issue, why Alden couldn't fix it, and what he recommends.
> Mark items resolved by appending \`[RESOLVED: <date> — <what you did>]\` below the entry.

---

`;
    fs.writeFileSync(ESCALATION_LOG_PATH, header, 'utf-8');
  }
}

/**
 * Append an escalation entry to the log file.
 *
 * @param issueDescription  What Alden detected (from the notification message)
 * @param analysis          Claude's analysis / recommended action
 * @param trigger           Why this is being escalated ('recurring_pattern' | 'alert_ineligible')
 */
export function writeEscalation(
  issueDescription: string,
  analysis: string,
  trigger: 'recurring_pattern' | 'alert_ineligible' = 'recurring_pattern',
): void {
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

**Status:** OPEN

---

`;

    fs.appendFileSync(ESCALATION_LOG_PATH, entry, 'utf-8');
    console.log(`[AldenEscalation] Written escalation to ${ESCALATION_LOG_PATH}`);
  } catch (err: any) {
    console.warn('[AldenEscalation] Failed to write escalation log:', err.message);
  }
}

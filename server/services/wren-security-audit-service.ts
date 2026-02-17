import * as fs from 'fs';
import * as path from 'path';
import { callGeminiWithSchema, GEMINI_MODELS } from '../gemini-utils';

export interface SecurityFinding {
  category: SecurityCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  evidence: string;
  suggestedAction: string;
  relatedComponent: string;
}

export type SecurityCategory =
  | 'exposed_secret'
  | 'missing_auth'
  | 'sql_injection'
  | 'input_validation'
  | 'rate_limiting'
  | 'xss_risk'
  | 'insecure_config';

const SCAN_DIRS = ['server', 'shared'];
const SCAN_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.local', 'attached_assets']);
const MAX_FILE_SIZE = 100_000;

const SECRET_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /(?:api[_-]?key|apikey|secret|password|token|credential)\s*[:=]\s*['"`][A-Za-z0-9_\-./+=]{8,}['"`]/gi, name: 'Hardcoded secret/key' },
  { pattern: /sk[-_](?:live|test)[-_][A-Za-z0-9]{20,}/g, name: 'Stripe secret key' },
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, name: 'Private key in source' },
  { pattern: /ghp_[A-Za-z0-9]{36}/g, name: 'GitHub personal access token' },
  { pattern: /xox[bpas]-[A-Za-z0-9\-]+/g, name: 'Slack token' },
];

const SECRET_FALSE_POSITIVES = [
  /process\.env\./,
  /import\.meta\.env\./,
  /getenv/i,
  /placeholder/i,
  /example/i,
  /your[_-]?api[_-]?key/i,
  /REPLACE_ME/i,
  /['"`]sk[-_]test['"`]/,
  /\.env/,
];

const SQL_INJECTION_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /(?:query|execute|raw)\s*\(\s*['"][^'"]*\+/gi, name: 'String concatenation in query call' },
  { pattern: /(?:\.raw|\.execute)\s*\(\s*`[^`]*\$\{(?!.*sql\b)/gi, name: 'Unparameterized template in raw/execute' },
  { pattern: /(?:pg|pool|client)\.query\s*\(\s*`[^`]*\$\{/gi, name: 'Unparameterized pg.query template' },
];

const SQL_INJECTION_SAFE_PATTERNS = [
  /sql`/,
  /sql\.raw\(/,
  /\$\d+/,
  /\.prepare\(/,
];

const AUTH_MIDDLEWARE_PATTERNS = [
  /requireAuth/,
  /isAuthenticated/,
  /verifyToken/,
  /passport\.authenticate/,
  /authMiddleware/,
  /checkAuth/,
  /ensureLoggedIn/,
];

const COMPONENT_MAP: Record<string, string> = {
  'voice': 'voice_pipeline',
  'audio': 'voice_pipeline',
  'tts': 'voice_pipeline',
  'stt': 'voice_pipeline',
  'auth': 'auth',
  'login': 'auth',
  'session': 'auth',
  'stripe': 'billing',
  'payment': 'billing',
  'subscription': 'billing',
  'tutor': 'ai_tutor',
  'daniela': 'ai_tutor',
  'gemini': 'ai_tutor',
  'database': 'database',
  'drizzle': 'database',
  'schema': 'database',
  'hive': 'hive',
  'curriculum': 'curriculum',
  'lesson': 'curriculum',
  'route': 'api',
  'endpoint': 'api',
};

function detectComponent(filePath: string, content: string): string {
  const text = `${filePath} ${content.substring(0, 500)}`.toLowerCase();
  for (const [keyword, component] of Object.entries(COMPONENT_MAP)) {
    if (text.includes(keyword)) return component;
  }
  return 'general';
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(fullPath));
      } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
        results.push(fullPath);
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results;
}

function readFileSafe(filePath: string): string | null {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function isFalsePositiveSecret(line: string): boolean {
  return SECRET_FALSE_POSITIVES.some(fp => fp.test(line));
}

export class WrenSecurityAuditService {

  scanForExposedSecrets(): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const files = collectFiles('server').concat(collectFiles('shared'));

    for (const filePath of files) {
      const content = readFileSafe(filePath);
      if (!content) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;

        for (const { pattern, name } of SECRET_PATTERNS) {
          pattern.lastIndex = 0;
          if (pattern.test(line) && !isFalsePositiveSecret(line)) {
            const redactedEvidence = line.trim().substring(0, 80).replace(/[A-Za-z0-9_\-./+=]{8,}/g, '***REDACTED***');
            findings.push({
              category: 'exposed_secret',
              severity: 'critical',
              title: `Possible ${name}`,
              description: `Potential hardcoded secret detected in source code.`,
              filePath,
              lineNumber: i + 1,
              evidence: redactedEvidence,
              suggestedAction: `Move this value to environment variables or Replit Secrets. Never commit secrets to source.`,
              relatedComponent: detectComponent(filePath, line),
            });
          }
        }
      }
    }

    return findings;
  }

  scanForSqlInjection(): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const files = collectFiles('server');

    for (const filePath of files) {
      const content = readFileSafe(filePath);
      if (!content) continue;

      const hasRawQueryPatterns = content.includes('.raw(')
        || content.includes('.execute(')
        || content.includes('pg.query')
        || content.includes('pool.query')
        || content.includes('client.query');
      if (!hasRawQueryPatterns) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;

        for (const { pattern, name } of SQL_INJECTION_PATTERNS) {
          pattern.lastIndex = 0;
          if (pattern.test(line)) {
            const context = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
            const isSafe = SQL_INJECTION_SAFE_PATTERNS.some(p => p.test(context));
            if (isSafe) continue;

            findings.push({
              category: 'sql_injection',
              severity: 'high',
              title: `Potential SQL injection: ${name}`,
              description: `Unparameterized user input may reach a database query.`,
              filePath,
              lineNumber: i + 1,
              evidence: line.trim().substring(0, 120),
              suggestedAction: `Use parameterized queries via Drizzle ORM's sql\` template tag or prepared statements.`,
              relatedComponent: 'database',
            });
          }
        }
      }
    }

    return findings;
  }

  scanForMissingAuth(): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    const routesFile = 'server/routes.ts';
    const content = readFileSafe(routesFile);
    if (!content) return findings;

    const lines = content.split('\n');
    const routePattern = /app\.(get|post|put|patch|delete)\s*\(\s*['"`](\/api\/[^'"`]+)['"`]/;

    const publicEndpoints = new Set([
      '/api/auth/user',
      '/api/auth/password/login',
      '/api/auth/password/logout',
      '/api/auth/password/request-reset',
      '/api/auth/password/reset',
      '/api/auth/invitations/verify',
      '/api/auth/invitations/complete',
      '/api/health',
      '/api/version',
      '/api/tutor-voices',
      '/api/stripe/webhook',
    ]);

    const publicPrefixes = [
      '/api/auth/',
      '/api/stripe/webhook',
    ];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(routePattern);
      if (!match) continue;

      const method = match[1];
      const endpoint = match[2];

      if (publicEndpoints.has(endpoint) || publicPrefixes.some(p => endpoint.startsWith(p))) {
        continue;
      }

      if (['post', 'put', 'patch', 'delete'].includes(method)) {
        const surroundingLines = lines.slice(Math.max(0, i - 3), i + 10).join('\n');
        const hasAuth = AUTH_MIDDLEWARE_PATTERNS.some(p => p.test(surroundingLines));
        const hasInlineAuth = surroundingLines.includes('req.user') || surroundingLines.includes('userId');

        if (!hasAuth && !hasInlineAuth) {
          findings.push({
            category: 'missing_auth',
            severity: 'high',
            title: `Possibly unprotected ${method.toUpperCase()} endpoint`,
            description: `${method.toUpperCase()} ${endpoint} may not have authentication checks.`,
            filePath: routesFile,
            lineNumber: i + 1,
            evidence: `${method.toUpperCase()} ${endpoint}`,
            suggestedAction: `Add authentication middleware or verify req.user check exists in the handler.`,
            relatedComponent: 'auth',
          });
        }
      }
    }

    return findings;
  }

  scanForInputValidation(): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    const routesFile = 'server/routes.ts';
    const content = readFileSafe(routesFile);
    if (!content) return findings;

    const lines = content.split('\n');
    const bodyAccessPattern = /req\.body\.\w+/;
    const validationPatterns = [/\.parse\(/, /\.safeParse\(/, /zod/i, /validate/i, /schema/i, /joi/i];

    for (let i = 0; i < lines.length; i++) {
      if (!bodyAccessPattern.test(lines[i])) continue;
      if (lines[i].trimStart().startsWith('//')) continue;

      const surroundingLines = lines.slice(Math.max(0, i - 15), i + 5).join('\n');
      const hasValidation = validationPatterns.some(p => p.test(surroundingLines));

      if (!hasValidation) {
        findings.push({
          category: 'input_validation',
          severity: 'medium',
          title: `Unvalidated request body access`,
          description: `Direct req.body property access without apparent schema validation.`,
          filePath: routesFile,
          lineNumber: i + 1,
          evidence: lines[i].trim().substring(0, 100),
          suggestedAction: `Validate request body using Zod schema before accessing properties.`,
          relatedComponent: 'api',
        });
      }
    }

    return findings;
  }

  scanForXssRisks(): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const clientFiles = collectFiles('client/src');

    for (const filePath of clientFiles) {
      const content = readFileSafe(filePath);
      if (!content) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/dangerouslySetInnerHTML/i.test(lines[i])) {
          const surroundingLines = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
          const hasSanitize = /sanitize|DOMPurify|purify|escape/i.test(surroundingLines);

          if (!hasSanitize) {
            findings.push({
              category: 'xss_risk',
              severity: 'high',
              title: `Unsanitized dangerouslySetInnerHTML`,
              description: `Raw HTML injection without sanitization library.`,
              filePath,
              lineNumber: i + 1,
              evidence: lines[i].trim().substring(0, 100),
              suggestedAction: `Sanitize HTML content using DOMPurify before rendering.`,
              relatedComponent: 'ui',
            });
          }
        }
      }
    }

    return findings;
  }

  async runFullAudit(): Promise<SecurityFinding[]> {
    const startTime = Date.now();
    console.log(`[Wren Security] Starting full security audit...`);

    const allFindings: SecurityFinding[] = [];

    const scanners: Array<{ name: string; fn: () => SecurityFinding[] }> = [
      { name: 'secrets', fn: () => this.scanForExposedSecrets() },
      { name: 'sql_injection', fn: () => this.scanForSqlInjection() },
      { name: 'missing_auth', fn: () => this.scanForMissingAuth() },
      { name: 'input_validation', fn: () => this.scanForInputValidation() },
      { name: 'xss_risks', fn: () => this.scanForXssRisks() },
    ];

    for (const scanner of scanners) {
      try {
        const findings = scanner.fn();
        allFindings.push(...findings);
        console.log(`[Wren Security] ${scanner.name}: ${findings.length} finding(s)`);
      } catch (err: any) {
        console.error(`[Wren Security] ${scanner.name} scanner error:`, err.message);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Wren Security] Full audit complete: ${allFindings.length} total findings in ${elapsed}ms`);

    return allFindings;
  }

  async enrichWithAI(findings: SecurityFinding[]): Promise<string> {
    if (findings.length === 0) {
      return 'No security findings to analyze.';
    }

    const redactedFindings = findings.map(f => ({
      category: f.category,
      severity: f.severity,
      title: f.title,
      filePath: f.filePath,
      lineNumber: f.lineNumber,
      suggestedAction: f.suggestedAction,
      relatedComponent: f.relatedComponent,
    }));

    try {
      const summary = await callGeminiWithSchema<{ summary: string; topPriorities: string[]; overallRisk: string }>(
        GEMINI_MODELS.FLASH,
        [
          {
            role: 'system',
            content: `You are Wren, a cybersecurity analyst for HolaHola, an AI language learning platform. 
Analyze these security audit findings and produce a concise executive summary.
Focus on: what's most urgent, what patterns you see, and what to fix first.
Be direct and actionable. Use your security expertise to prioritize.`
          },
          {
            role: 'user',
            content: `Security audit found ${findings.length} issues:\n\n${JSON.stringify(redactedFindings, null, 2)}`
          }
        ],
        {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Executive summary of findings (2-3 paragraphs)' },
            topPriorities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Top 3-5 action items in priority order'
            },
            overallRisk: {
              type: 'string',
              enum: ['low', 'moderate', 'elevated', 'high', 'critical'],
              description: 'Overall risk assessment'
            }
          },
          required: ['summary', 'topPriorities', 'overallRisk']
        }
      );

      const priorityList = summary.topPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n');

      return `## Wren Security Audit Report

**Overall Risk: ${summary.overallRisk.toUpperCase()}**
**Findings: ${findings.length}** (${findings.filter(f => f.severity === 'critical').length} critical, ${findings.filter(f => f.severity === 'high').length} high, ${findings.filter(f => f.severity === 'medium').length} medium, ${findings.filter(f => f.severity === 'low').length} low)

${summary.summary}

### Top Priorities
${priorityList}

---
*Wren Security Officer — Automated Audit*`;

    } catch (err: any) {
      console.error(`[Wren Security] AI enrichment failed:`, err.message);

      const bySeverity = {
        critical: findings.filter(f => f.severity === 'critical').length,
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
        low: findings.filter(f => f.severity === 'low').length,
      };

      return `## Wren Security Audit Report

**Findings: ${findings.length}** (${bySeverity.critical} critical, ${bySeverity.high} high, ${bySeverity.medium} medium, ${bySeverity.low} low)

Top findings:
${findings.slice(0, 5).map(f => `- [${f.severity.toUpperCase()}] ${f.title} in ${f.filePath}`).join('\n')}

---
*Wren Security Officer — Automated Audit (AI summary unavailable)*`;
    }
  }
}

export const wrenSecurityAuditService = new WrenSecurityAuditService();

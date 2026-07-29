/**
 * Proxy Startup Check
 *
 * Runs at server boot and warns when Replit AI integration proxy keys are set
 * but point at an unreachable base URL — or when they are missing entirely
 * and no direct-key fallback is configured either.
 *
 * This is a soft check: it logs WARN/ERROR lines and never blocks startup.
 */

interface ProxyCheckConfig {
  label: string;
  proxyKeyVar: string;
  proxyBaseVar: string;
  directKeyVars: string[];
  defaultBaseUrl: string;
  /** Which features rely on this key */
  usedBy: string;
}

const PROXY_CONFIGS: ProxyCheckConfig[] = [
  {
    label: 'OpenAI',
    proxyKeyVar: 'AI_INTEGRATIONS_OPENAI_API_KEY',
    proxyBaseVar: 'AI_INTEGRATIONS_OPENAI_BASE_URL',
    directKeyVars: ['USER_OPENAI_API_KEY', 'OPENAI_API_KEY'],
    defaultBaseUrl: 'https://api.openai.com/v1',
    usedBy: 'pronunciation analysis, strip-card translations',
  },
  {
    label: 'Anthropic',
    proxyKeyVar: 'AI_INTEGRATIONS_ANTHROPIC_API_KEY',
    proxyBaseVar: 'AI_INTEGRATIONS_ANTHROPIC_BASE_URL',
    directKeyVars: ['ANTHROPIC_API_KEY'],
    defaultBaseUrl: 'https://api.anthropic.com',
    usedBy: 'Alden (dev scripts only — production Alden uses ANTHROPIC_API_KEY directly)',
  },
  {
    label: 'Gemini',
    proxyKeyVar: 'AI_INTEGRATIONS_GEMINI_API_KEY',
    proxyBaseVar: 'AI_INTEGRATIONS_GEMINI_BASE_URL',
    directKeyVars: ['GEMINI_API_KEY'],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    usedBy: 'dev scripts (gemini-benchmark, compact-textbook-reseed, daniela-consultation)',
  },
];

/**
 * Attempts a lightweight HEAD / GET against the first path segment of the base URL
 * to verify network reachability. Resolves to true if reachable, false otherwise.
 */
async function isBaseUrlReachable(baseUrl: string): Promise<boolean> {
  try {
    // Strip path — just check the host root
    const url = new URL(baseUrl);
    const testUrl = `${url.protocol}//${url.host}/`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(testUrl, {
      method: 'HEAD',
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timer);
    // Any HTTP response (even 4xx/5xx) means the host is reachable
    return res !== null;
  } catch {
    return false;
  }
}

/**
 * Run all proxy checks and log warnings. Non-blocking — call with void or await.
 */
export async function runProxyStartupChecks(): Promise<void> {
  const prefix = '[ProxyCheck]';

  for (const cfg of PROXY_CONFIGS) {
    const proxyKey = process.env[cfg.proxyKeyVar];
    const proxyBase = process.env[cfg.proxyBaseVar];
    const directKey = cfg.directKeyVars.find(v => process.env[v]);

    if (!proxyKey && !directKey) {
      // No key at all — features that need this provider will fail at call time.
      // Only warn for OpenAI since it's required at runtime (pronunciation, translations).
      if (cfg.label === 'OpenAI') {
        console.error(
          `${prefix} ⚠️  No OpenAI API key configured. ` +
          `Set USER_OPENAI_API_KEY (direct) or AI_INTEGRATIONS_OPENAI_API_KEY (proxy). ` +
          `Affects: ${cfg.usedBy}.`
        );
      }
      continue;
    }

    if (proxyKey) {
      // Proxy key is set — verify base URL is reachable
      const effectiveBase = proxyBase || cfg.defaultBaseUrl;
      const reachable = await isBaseUrlReachable(effectiveBase);
      if (!reachable) {
        const hint = directKey
          ? `Falling back to ${cfg.directKeyVars.find(v => process.env[v])} (direct key).`
          : `Set ${cfg.directKeyVars[0]} as a direct-key fallback (see docs/new-environment-setup.md).`;
        console.warn(
          `${prefix} ${cfg.label} proxy base URL "${effectiveBase}" is unreachable. ` +
          `${hint} Affected features: ${cfg.usedBy}.`
        );
      } else {
        // Proxy key + reachable base — all good
        if (!proxyBase) {
          console.warn(
            `${prefix} ${cfg.label}: AI_INTEGRATIONS_${cfg.label.toUpperCase()}_BASE_URL is not set; ` +
            `defaulting to ${cfg.defaultBaseUrl}. ` +
            `Outside Replit you may need to set this explicitly.`
          );
        } else {
          console.log(`${prefix} ${cfg.label} proxy configured and reachable at ${effectiveBase}.`);
        }
      }
    } else if (directKey) {
      // Only direct key — no proxy. That's fine; log at debug level.
      console.log(
        `${prefix} ${cfg.label}: using direct key (${directKey}). ` +
        `AI_INTEGRATIONS_${cfg.label.toUpperCase()}_API_KEY not set.`
      );
    }
  }
}

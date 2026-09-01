const DEFAULT_PRIMARY_URL = 'https://getholahola.com/health/readiness';
const DEFAULT_SECONDARY_URL = 'https://hola-hola.replit.app/health/readiness';
const INCIDENT_TITLE = '[monitor] Production outage';
const INCIDENT_LABEL = 'production-outage';
const ALERT_AFTER_FAILURES = 2;
const ATTEMPTS_PER_RUN = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 2_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeErrorReason(error) {
  if (error?.name === 'AbortError') return 'timeout';
  return 'connection_failure';
}

export async function probeReadiness(
  url,
  {
    fetchImpl = fetch,
    attempts = ATTEMPTS_PER_RUN,
    timeoutMs = REQUEST_TIMEOUT_MS,
    retryDelayMs = RETRY_DELAY_MS,
    sleepImpl = sleep,
  } = {},
) {
  let lastResult = {
    ok: false,
    status: null,
    reason: 'connection_failure',
    attempts: 0,
  };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      const body = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(body);
      } catch {
        payload = null;
      }

      if (response.ok && payload?.status === 'ready') {
        return { ok: true, status: response.status, reason: 'ready', attempts: attempt };
      }

      lastResult = {
        ok: false,
        status: response.status,
        reason: payload?.status ? `status_${payload.status}` : payload === null ? 'invalid_json' : 'not_ready',
        attempts: attempt,
      };
    } catch (error) {
      lastResult = {
        ok: false,
        status: null,
        reason: safeErrorReason(error),
        attempts: attempt,
      };
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < attempts) await sleepImpl(retryDelayMs);
  }

  return lastResult;
}

function parseIncidentState(body = '') {
  const match = body.match(
    /<!-- holahola-production-monitor state=(pending|alerted) failures=(\d+) outageSms=(none|reserved|accepted|failed) recoverySms=(none|reserved|accepted|failed) firstFailedAt=([^\s]+) -->/,
  );
  if (!match) {
    return {
      state: 'pending',
      failures: 0,
      outageSms: 'none',
      recoverySms: 'none',
      firstFailedAt: null,
    };
  }
  return {
    state: match[1],
    failures: Number(match[2]),
    outageSms: match[3],
    recoverySms: match[4],
    firstFailedAt: match[5] === 'none' ? null : match[5],
  };
}

function buildStateMarker({ state, failures, outageSms, recoverySms, firstFailedAt }) {
  return `<!-- holahola-production-monitor state=${state} failures=${failures} outageSms=${outageSms} recoverySms=${recoverySms} firstFailedAt=${firstFailedAt ?? 'none'} -->`;
}

export function buildIncidentBody({
  state,
  failures,
  outageSms,
  recoverySms,
  firstFailedAt,
  checkedAt,
  primary,
  secondary,
  runUrl,
  recovery = false,
}) {
  const marker = buildStateMarker({
    state,
    failures,
    outageSms,
    recoverySms,
    firstFailedAt,
  });
  const heading = recovery ? 'Production recovered' : 'Production readiness failure';
  return [
    marker,
    `## ${heading}`,
    '',
    `- Checked at (UTC): ${checkedAt}`,
    `- Primary result: ${primary.ok ? 'ready' : primary.reason}${primary.status ? ` (HTTP ${primary.status})` : ''}`,
    `- Diagnostic result: ${secondary ? (secondary.ok ? 'ready' : secondary.reason) : 'not checked'}${secondary?.status ? ` (HTTP ${secondary.status})` : ''}`,
    `- Consecutive failed runs: ${failures}`,
    `- Outage SMS state: ${outageSms}`,
    `- Recovery SMS state: ${recoverySms}`,
    `- Monitor run: ${runUrl || 'manual/local run'}`,
    '',
    'This issue is maintained automatically by the production uptime monitor.',
    'Response bodies and internal startup errors are intentionally not stored here.',
  ].join('\n');
}

export function buildOutageSms({ checkedAt, primary, secondary, runUrl }) {
  const diagnostic = secondary?.ok
    ? 'the generated deployment URL responded'
    : secondary
      ? `the generated deployment URL also failed (${secondary.reason})`
      : 'the generated deployment URL was not checked';
  return [
    'HolaHola production appears down.',
    `Detected ${checkedAt}.`,
    `The custom domain failed (${primary.reason}); ${diagnostic}.`,
    runUrl ? `Monitor: ${runUrl}` : '',
  ].filter(Boolean).join(' ');
}

export function buildRecoverySms({ recoveredAt, outageDuration, runUrl }) {
  return [
    'HolaHola production recovered.',
    `Recovered ${recoveredAt}.`,
    outageDuration ? `Approximate outage duration: ${outageDuration}.` : '',
    runUrl ? `Monitor: ${runUrl}` : '',
  ].filter(Boolean).join(' ');
}

async function githubRequest(fetchImpl, token, repository, path, options = {}) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error(`GitHub API request failed with HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export function createGitHubIssueClient({
  fetchImpl = fetch,
  token,
  repository,
}) {
  if (!token) throw new Error('GITHUB_TOKEN is required');
  if (!repository || !repository.includes('/')) throw new Error('GITHUB_REPOSITORY must be owner/repository');

  return {
    async ensureLabel() {
      try {
        await githubRequest(fetchImpl, token, repository, `/labels/${encodeURIComponent(INCIDENT_LABEL)}`);
      } catch (error) {
        if (error.status !== 404) throw error;
        await githubRequest(fetchImpl, token, repository, '/labels', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: INCIDENT_LABEL,
            color: 'd73a4a',
            description: 'Production uptime incident managed by automation',
          }),
        });
      }
    },

    async findIncident() {
      const issues = await githubRequest(
        fetchImpl,
        token,
        repository,
        `/issues?state=open&labels=${encodeURIComponent(INCIDENT_LABEL)}&per_page=20`,
      );
      return issues.find((issue) => !issue.pull_request && issue.title === INCIDENT_TITLE) || null;
    },

    async createIncident(body) {
      return githubRequest(fetchImpl, token, repository, '/issues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: INCIDENT_TITLE, body, labels: [INCIDENT_LABEL] }),
      });
    },

    async updateIncident(issueNumber, body) {
      return githubRequest(fetchImpl, token, repository, `/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
    },

    async closeIncident(issueNumber) {
      return githubRequest(fetchImpl, token, repository, `/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      });
    },
  };
}

export async function sendTwilioSms({
  fetchImpl = fetch,
  accountSid,
  authToken,
  fromNumber,
  toNumber,
  body,
}) {
  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    throw new Error('Twilio monitor secrets are incomplete');
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${auth}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toNumber,
        From: fromNumber,
        Body: body,
      }).toString(),
    },
  );

  if (!response.ok) throw new Error(`Twilio request failed with HTTP ${response.status}`);
  return true;
}

function formatDuration(startedAt, endedAt) {
  const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  const minutes = Math.round(durationMs / 60_000);
  return minutes < 2 ? 'less than 2 minutes' : `${minutes} minutes`;
}

export async function runMonitor({
  primaryUrl = DEFAULT_PRIMARY_URL,
  secondaryUrl = DEFAULT_SECONDARY_URL,
  attempts = ATTEMPTS_PER_RUN,
  timeoutMs = REQUEST_TIMEOUT_MS,
  retryDelayMs = RETRY_DELAY_MS,
  dryRun = false,
  now = () => new Date().toISOString(),
  runUrl = '',
  fetchImpl = fetch,
  sleepImpl = sleep,
  github,
  sendSms,
}) {
  const checkedAt = now();
  const primary = await probeReadiness(primaryUrl, {
    fetchImpl,
    attempts,
    timeoutMs,
    retryDelayMs,
    sleepImpl,
  });
  const secondary = primary.ok
    ? null
    : await probeReadiness(secondaryUrl, {
      fetchImpl,
      attempts,
      timeoutMs,
      retryDelayMs,
      sleepImpl,
    });
  const healthy = primary.ok;

  if (dryRun) {
    return { healthy, primary, secondary, action: 'dry_run', checkedAt };
  }
  if (!github) throw new Error('GitHub issue client is required');
  if (!sendSms) throw new Error('SMS sender is required');

  const issue = await github.findIncident();

  if (healthy) {
    if (!issue) return { healthy, primary, secondary, action: 'no_incident', checkedAt };

    const previous = parseIncidentState(issue.body);
    const outageDuration = previous.firstFailedAt
      ? formatDuration(previous.firstFailedAt, checkedAt)
      : null;
    let recoverySms = previous.recoverySms;
    if (previous.outageSms === 'accepted' && recoverySms === 'none') {
      const reservedBody = buildIncidentBody({
        state: 'alerted',
        failures: previous.failures,
        outageSms: previous.outageSms,
        recoverySms: 'reserved',
        firstFailedAt: previous.firstFailedAt,
        checkedAt,
        primary,
        secondary,
        runUrl,
        recovery: true,
      });
      await github.updateIncident(issue.number, reservedBody);
      recoverySms = 'reserved';
      try {
        await sendSms(buildRecoverySms({ recoveredAt: checkedAt, outageDuration, runUrl }));
        recoverySms = 'accepted';
      } catch (error) {
        const failedBody = buildIncidentBody({
          state: 'alerted',
          failures: previous.failures,
          outageSms: previous.outageSms,
          recoverySms: 'failed',
          firstFailedAt: previous.firstFailedAt,
          checkedAt,
          primary,
          secondary,
          runUrl,
          recovery: true,
        });
        await github.updateIncident(issue.number, failedBody);
        throw error;
      }
    }
    const recoveryBody = buildIncidentBody({
      state: previous.outageSms === 'accepted' ? 'alerted' : 'pending',
      failures: 0,
      outageSms: previous.outageSms,
      recoverySms,
      firstFailedAt: null,
      checkedAt,
      primary,
      secondary,
      runUrl,
      recovery: true,
    });
    await github.updateIncident(issue.number, recoveryBody);
    await github.closeIncident(issue.number);
    return {
      healthy,
      primary,
      secondary,
      action: recoverySms === 'accepted'
        ? 'recovery_sms_sent'
        : previous.outageSms === 'none'
          ? 'pending_incident_closed'
          : 'delivery_uncertain_incident_closed',
      checkedAt,
    };
  }

  let currentIssue = issue;
  let previous = issue ? parseIncidentState(issue.body) : null;
  if (!currentIssue) {
    await github.ensureLabel();
    const firstBody = buildIncidentBody({
      state: 'pending',
      failures: 1,
      outageSms: 'none',
      recoverySms: 'none',
      firstFailedAt: checkedAt,
      checkedAt,
      primary,
      secondary,
      runUrl,
    });
    currentIssue = await github.createIncident(firstBody);
    previous = {
      state: 'pending',
      failures: 0,
      outageSms: 'none',
      recoverySms: 'none',
      firstFailedAt: checkedAt,
    };
  }

  const failures = previous.failures + 1;
  let outageSms = previous.outageSms;
  let state = previous.state;
  if (failures >= ALERT_AFTER_FAILURES && outageSms === 'none') {
    const reservedBody = buildIncidentBody({
      state: 'alerted',
      failures,
      outageSms: 'reserved',
      recoverySms: previous.recoverySms,
      firstFailedAt: previous.firstFailedAt || checkedAt,
      checkedAt,
      primary,
      secondary,
      runUrl,
    });
    await github.updateIncident(currentIssue.number, reservedBody);
    outageSms = 'reserved';
    state = 'alerted';
    try {
      await sendSms(buildOutageSms({ checkedAt, primary, secondary, runUrl }));
      outageSms = 'accepted';
    } catch (error) {
      const failedBody = buildIncidentBody({
        state,
        failures,
        outageSms: 'failed',
        recoverySms: previous.recoverySms,
        firstFailedAt: previous.firstFailedAt || checkedAt,
        checkedAt,
        primary,
        secondary,
        runUrl,
      });
      await github.updateIncident(currentIssue.number, failedBody);
      throw error;
    }
  }

  const body = buildIncidentBody({
    state,
    failures,
    outageSms,
    recoverySms: previous.recoverySms,
    firstFailedAt: previous.firstFailedAt || checkedAt,
    checkedAt,
    primary,
    secondary,
    runUrl,
  });
  await github.updateIncident(currentIssue.number, body);

  return {
    healthy,
    primary,
    secondary,
    action: outageSms === 'accepted' ? 'incident_updated' : 'pending_incident_updated',
    failures,
    checkedAt,
  };
}

function validateEnvironment(env, dryRun) {
  const required = ['GITHUB_REPOSITORY', 'GITHUB_TOKEN'];
  if (!dryRun) {
    required.push('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'PROD_ALERT_TO_NUMBER');
  }
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing monitor configuration: ${missing.join(', ')}`);
}

async function main() {
  const env = process.env;
  const dryRun = env.MONITOR_DRY_RUN === 'true';
  validateEnvironment(env, dryRun);
  const github = dryRun
    ? null
    : createGitHubIssueClient({
        token: env.GITHUB_TOKEN,
        repository: env.GITHUB_REPOSITORY,
      });
  const result = await runMonitor({
    primaryUrl: env.PRIMARY_URL || DEFAULT_PRIMARY_URL,
    secondaryUrl: env.SECONDARY_URL || DEFAULT_SECONDARY_URL,
    dryRun,
    runUrl: env.GITHUB_SERVER_URL && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : '',
    github,
    sendSms: (body) => sendTwilioSms({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      fromNumber: env.TWILIO_FROM_NUMBER,
      toNumber: env.PROD_ALERT_TO_NUMBER,
      body,
    }),
  });
  console.log(JSON.stringify(result));
  if (!result.healthy && !dryRun) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('production-uptime-monitor.mjs')) {
  main().catch((error) => {
    console.error(`[production-uptime-monitor] ${error.message}`);
    process.exitCode = 1;
  });
}

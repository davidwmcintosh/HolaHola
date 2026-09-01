# Production uptime monitor

HolaHola has an external GitHub Actions monitor at
`.github/workflows/production-uptime-monitor.yml`. It checks
`https://getholahola.com/health/readiness` approximately every five minutes.
The Replit deployment URL is checked as a diagnostic when the custom domain
fails.

The monitor waits for two failed scheduled runs before sending an outage SMS.
It keeps one labeled GitHub issue titled `[monitor] Production outage` open for
the incident, suppresses duplicate SMS messages, and sends one recovery SMS
when readiness returns.

Each SMS is reserved in the incident issue before Twilio is called. If a
GitHub write fails after Twilio may have accepted the message, the incident is
left in a delivery-uncertain state and the monitor will not automatically send
the same message again. This deliberately prefers at-most-once delivery over
duplicate texts; the workflow failure and incident record make the ambiguity
visible for operator review.

## Required GitHub Actions secrets

Add these under the repository's **Settings → Secrets and variables →
Actions** page:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `PROD_ALERT_TO_NUMBER`

These are GitHub Actions secrets, not Replit environment variables. Never
paste their values into chat, source files, issue bodies, or workflow logs.

## Verification

Use **Actions → Production uptime monitor → Run workflow** to run a manual
check. The monitor will contact Twilio only when it reaches an outage
threshold, so a healthy manual run is safe. The workflow requires the four
Twilio secrets for normal operation; local verification can use:

```text
MONITOR_DRY_RUN=true GITHUB_REPOSITORY=owner/repository GITHUB_TOKEN=unused node scripts/production-uptime-monitor.mjs
```

Dry-run output contains only safe probe status and never mutates GitHub or
sends an SMS.

GitHub schedules are best-effort. Sustained outages are expected to notify
within approximately 5–10 minutes, not at an exact wall-clock time.
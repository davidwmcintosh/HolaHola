# Production Uptime Monitor Design

**Date:** 2026-09-01
**Status:** Implemented after user review and Luca sign-off

## Goal

Detect when the public HolaHola production deployment is unavailable or not fully ready, notify David by SMS without repeated noise, and send a recovery notification when service returns. The monitor must continue to work when the HolaHola application process is down.

## Non-goals

The first version will not add a monitoring dashboard, automatic remediation, database tables, multi-level escalation, or monitoring of internal student/session functionality. It will monitor production availability and startup readiness only.

## Architecture

### 1. Production readiness endpoint

Add GET /health/readiness to the application. It is separate from the existing deployment-probe endpoint:

- 200 with { status: ready } only after critical startup checks succeed.
- 503 with { status: starting } while startup is in progress.
- 503 with { status: failed } after a critical startup failure.

The response will contain no database error text, stack traces, credentials, or other sensitive details. The existing /health behavior remains unchanged because the deployment platform needs a fast process-level health response while the application is starting.

The readiness route will use the same in-memory startup state as the existing readiness gate. It must be registered so that it can report the state while the rest of normal application traffic remains blocked.

### 2. External scheduled monitor

Add a standalone Node monitor script and a scheduled GitHub Actions workflow:

- The workflow runs approximately every five minutes.
- workflow_dispatch permits a manual verification run.
- The workflow calls https://getholahola.com/health/readiness.
- Each run performs three bounded HTTP attempts with short delays.
- A run is considered healthy only when the request succeeds and the JSON status is exactly ready.
- Connection failures, timeouts, non-2xx responses, malformed JSON, and non-ready states are failures.
- The generated Replit URL, https://hola-hola.replit.app, is probed as a diagnostic when the custom domain fails. The custom domain controls the main outage state because it is the user-facing production URL.

The monitor runs outside the production process. A failed or unreachable HolaHola instance therefore cannot prevent the monitor from sending an alert.

### 3. Incident state

Use one specially labeled GitHub issue as the durable incident record. The workflow has only the permissions needed to read repository metadata and create, update, and close this issue.

The workflow uses a concurrency group with overlapping runs disallowed. This prevents scheduled and manually triggered runs from racing to create incidents or send duplicate SMS messages.

State transitions:

1. Healthy run with no active incident: no issue or SMS action.
2. First failed run: create or update a pending outage issue; do not send SMS yet.
3. Second consecutive failed run: mark the issue alerted and send one outage SMS.
4. Additional failures: update the existing issue and send no additional outage SMS.
5. Successful run after an alerted outage: send one recovery SMS, record the recovery, and close the issue.
6. Successful run after a pending-but-not-alerted failure: close the pending issue without sending SMS.

The issue body will record timestamps, the production and diagnostic results, whether an SMS was sent, and links to monitor runs. It will not store Twilio credentials or full response bodies.

### 4. SMS delivery

The GitHub workflow will call Twilio directly rather than routing through HolaHola. Required GitHub Actions secrets are:

- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM_NUMBER
- PROD_ALERT_TO_NUMBER

These values must be configured in GitHub repository Actions secrets. Replit secrets are not automatically available to GitHub Actions. No secret will be requested in chat, committed to the repository, echoed in workflow output, or included in a GitHub issue.

Outage SMS content will include:

- HolaHola production appears down.
- Detection time in UTC.
- Whether the custom domain and generated deployment URL responded.
- A link to the monitor run.

Recovery SMS content will include:

- HolaHola production recovered.
- Recovery time in UTC.
- Approximate outage duration when available.
- A link to the monitor run.

Twilio errors will fail the monitor step visibly and be recorded without exposing credentials. The monitor will not claim that an SMS was sent unless Twilio accepts the request.

To avoid duplicate texts across an external SMS call and a later GitHub API
failure, each delivery is durably marked `reserved` before Twilio is called.
`accepted` and `failed` are recorded after the call. A `reserved` state is
treated as delivery-uncertain and is never automatically sent again; this
chooses at-most-once delivery over a duplicate alert.

## Files and interfaces

Planned repository changes:

- Application readiness route and any small readiness-gate interface needed to expose the state safely.
- A focused standalone monitor module with injectable HTTP, GitHub, and Twilio operations for deterministic tests.
- A scheduled workflow under .github/workflows/ with least-privilege permissions, explicit timeout, concurrency, and secret references.
- Focused unit and self-check tests for the monitor and readiness route.
- Documentation describing required GitHub secrets and manual verification.

The monitor module will use Node’s built-in fetch and existing repository conventions rather than adding a runtime dependency.

## Failure handling and security

- The production readiness endpoint is intentionally public but reveals only a coarse state.
- The monitor treats the primary custom domain as the user-facing availability signal and uses the generated URL only for classification.
- HTTP attempts have explicit timeouts so a half-open connection cannot consume a workflow indefinitely.
- GitHub issue operations are idempotent and concurrency-protected.
- SMS alert transitions are persisted before or atomically with the corresponding issue update as far as the GitHub API permits; a failed mutation must be surfaced rather than silently swallowed.
- The monitor must not leak response bodies, authorization headers, Twilio credentials, or internal startup failure messages.
- The workflow must fail clearly if required secrets are missing, without printing their values.

## Testing plan

### Readiness route

Test starting, ready, and failed states, including status codes and the absence of sensitive failure details. Confirm that the existing deployment /health contract is unchanged.

### Monitor logic

Test:

- healthy readiness response;
- connection refusal;
- timeout;
- non-2xx response;
- malformed JSON;
- non-ready JSON;
- three-attempt retry behavior;
- first-failure pending state;
- second-failure SMS transition;
- duplicate-alert suppression;
- recovery SMS and issue close;
- silent close for an outage that clears before the threshold;
- custom-domain-only failure classification;
- both URLs failing;
- Twilio rejection;
- missing secret validation;
- issue/API failure handling.

A mutation/self-check path will demonstrate that duplicate suppression and the outage threshold are behaviorally enforced, not merely asserted through source text.

### End-to-end verification

After implementation:

1. Run typecheck and focused tests.
2. Run the production build.
3. Run the full registered validation suite.
4. Execute the monitor manually against the live readiness endpoint with SMS delivery disabled or otherwise safely configured.
5. Confirm the workflow has the intended permissions, concurrency, schedule, and secret references.
6. Verify the published app remains healthy at both public URLs.

## Operational setup

After implementation, the only manual setup required will be adding the four GitHub Actions secrets and running the workflow manually once. The user must verify the received SMS before relying on the scheduled monitor.

GitHub Actions schedules are best-effort rather than exact wall-clock timers. The alert copy and documentation will state that the detection target is approximately 5–10 minutes after a sustained outage, not an exact guarantee.

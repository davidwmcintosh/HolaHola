---
name: HTML admin-route implicit status code
description: Express silently defaults to 200 when a route handler never calls .status(); an HTML confirmation page wrapping a JSON-API-style service call needs the status set explicitly per outcome.
---

A founder-facing HTML page that renders a confirmation view (e.g. "published"
vs "already up to date") by calling the same service function a sibling JSON
API route uses does not automatically inherit that JSON route's status-code
convention (e.g. 201 for created, 200 for an idempotent replay).
`res.type('html').send(...)` with no preceding `.status()` call always
answers 200, for every outcome, because Express's default status is 200 and
nothing propagates the JSON route's convention across to a different route.

**Why:** discovered when a new HTML-rendering POST route was added alongside
an existing JSON API route that both call the same idempotent publish
service. A mirroring HTTP test (matching the JSON route's convention of
201-created / 200-replay) failed with `200 !== 201` — the HTML route's
success path had never called `.status()`, so both outcomes silently
returned 200. The page *text* correctly said "published" vs "already up to
date", so a human clicking through in a browser would never notice; only a
status-code assertion caught it.

**How to apply:** whenever a new route renders a human-facing HTML
confirmation page around an existing JSON-API service call, explicitly
mirror that service's outcome-to-status-code mapping with its own
`res.status(...)` call — do not assume it carries over. Write at least one
test that asserts the actual HTTP status code for each outcome, not just the
rendered body text.


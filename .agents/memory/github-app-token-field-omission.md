---
name: GitHub App token field-level omission
description: A GitHub App installation token's 200 response can silently omit specific fields (e.g. ruleset bypass_actors) that a differently-scoped credential would see on the identical endpoint; check field presence, not just status code.
---

GitHub's REST API can return 200 for a GitHub App installation token on an
endpoint (e.g. `GET /repos/{owner}/{repo}/rulesets/{id}`) while silently
omitting a specific field from the body — no error, no 403, just absent —
while a differently-scoped credential (fine-grained/classic PAT with broader
admin visibility) hitting the *same* endpoint receives the full field.

Observed directly: a ruleset's `bypass_actors` array is invisible to the
HolaHola GitHub App's installation token (the response has no `bypass_actors`
key at all, only a self-referential `current_user_can_bypass` convenience
field), but is fully visible to `GITHUB_ACTIONS_DISPATCH_TOKEN` hitting the
identical URL.

**Why:** GitHub appears to gate the full `bypass_actors` list (who else can
bypass) behind a higher permission tier than what's needed to read the
ruleset's own shape, and offers `current_user_can_bypass` as the App-safe
alternative that only answers "can I bypass," never "who else can."

**How to apply:** Before building any check or feature that reads a specific
field from a GitHub API response, verify empirically — log the actual parsed
field, not just the HTTP status — that the credential you intend to use
really returns it. A 200 is not proof of full field visibility. If a required
field is missing under one credential, check whether another
already-available one (e.g. `GITHUB_ACTIONS_DISPATCH_TOKEN` vs. the GitHub
App installation token) has it before requesting new App permissions, which
needs a separate manual installation-level approval
(see github-app-permission-approval.md).

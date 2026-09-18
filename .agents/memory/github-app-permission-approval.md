---
name: GitHub App permission approval is two steps
description: Editing a GitHub App's declared permissions does not change what an existing installation can do until the installation owner separately approves the update.
---

# GitHub App permission approval is two steps

Adding a permission (e.g. "Workflows: Read and write") to a GitHub App's own
definition (Settings → Developer settings → GitHub Apps → [app] →
Permissions & events) does not retroactively grant it to installations that
already exist. GitHub queues the change as a pending request; the
installation owner must separately review and accept it (Settings →
Applications → Installed GitHub Apps → [app] → accept the new permissions)
before a freshly-minted installation token actually carries the new
permission.

**Why:** confirmed by reproducing a push touching `.github/workflows/*`
authenticated with a freshly-minted installation token. GitHub rejected it
with an explicit `refusing to allow a GitHub App to create or update
workflow ... without workflows permission` message even immediately after
the App definition was edited to add that permission. The identical retry
(fresh token, same command) only succeeded after the installation-level
approval step was separately completed.

**How to apply:** whenever a GitHub App gains a new declared permission,
tell the user both steps are required, and re-verify by minting a fresh
token and retrying the actual operation — don't assume the App-definition
edit alone is sufficient just because no error surfaced at edit time.

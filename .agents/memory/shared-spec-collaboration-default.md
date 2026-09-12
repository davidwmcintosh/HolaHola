---
name: Shared-spec collaboration default
description: Records the agreed default surface and review boundary for documents created jointly by multiple agents.
---

Use the shared-spec workspace as the default collaboration surface for joint document creation. Keep the exact revision under review immutable, require the named independent actor to claim and decide it under that actor's own credential, and publish only an approved revision. Reviewer prose is not evidence of claim or decision; verify the canonical shared-spec state directly.

**Why:** David explicitly established this as the default beginning September 7, 2026. Git-first collaboration makes independent authorship and exact-revision approval easier to blur, while the shared-spec record preserves both. A reviewer can report approval after inspecting the wrong Git document or from a runtime that cannot make authenticated shared-spec calls; neither changes the canonical review.

**How to apply:** Start new jointly authored documents in shared-spec when the service is available. Do not impersonate a requested reviewer or silently fall back to Git-first review. After any claimed decision, read the document/review state from the service and verify the exact revision hash before export. GitHub is the publication destination after approval, not the collaboration authority.
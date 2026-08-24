---
name: Deployment publish image size
description: Replit publishing can fail after a successful build when the workspace context exceeds its 8 GiB image limit.
---

**Rule:** Treat a successful build and a successful publish as separate checks. When publish packaging exceeds the image limit, use a targeted `.dockerignore` before deleting or relocating project data.

**Why:** Local metadata, caches, prior build output, repository history, and archival attachments can inflate the publish image even though none is required by the production service.

**How to apply:** Exclude local workspace state and non-runtime archives, but verify which source assets Vite imports and which paths the server serves before writing exclusion rules. Rebuild and estimate the remaining context before asking the user to publish again.

**Long-term direction:** Move maintenance-only archival PDFs, ZIPs, and export bundles into the existing object-storage abstraction after a successful publish; do not migrate Vite-bundled runtime assets blindly.

**Why:** Object storage keeps large source materials durable and accessible without making every clone or publish carry them, while the existing asset pipeline already demonstrates the project's storage boundary.

**How to apply:** Inventory and checksum originals, upload them, update maintenance scripts and manifests, verify reads from the new location, and only then remove repository copies.
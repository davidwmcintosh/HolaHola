---
name: Deployment publish image size
description: Replit publishing can fail after a successful build when the total image layers exceed the 8 GiB limit.
---

**Rule:** Treat a successful build and a successful publish as separate checks. Measure workspace contributors and distinguish them from the complete image, including platform layers. Do not assume that a `.dockerignore` establishes what Replit's publish packager excludes.

**Why:** A publication failed at image packaging despite successful compilation and an existing `.dockerignore` naming the large workspace directories. That proves the exclusions were not sufficient, not which individual paths were included. The official publishing troubleshooting page recommends reducing unnecessary files or using external storage; the configuration reference does not document deployment path-exclusion keys.

**How to apply:** Read the failed build's actual final error and official source pages before changing configuration. Do not invent `deployment.ignorePaths` or claim a retry will fit without measured evidence. Inspect cache sizes separately from preserved local state. Obtain consent before deleting rebuildable package/browser caches and explain that future tooling may need to download them again. Preserve repository history, reconciliation worktrees, task recovery files, raw transcripts, credentials, uploads and Vite-imported runtime assets. A failed publication is not evidence of a live source release; expired or changed candidates still need fresh preparation.

**Long-term direction:** Move maintenance-only archival PDFs, ZIPs, and export bundles into the existing object-storage abstraction after a successful publish; do not migrate Vite-bundled runtime assets blindly.

**Why:** Object storage keeps large source materials durable and accessible without making every clone or publish carry them, while the existing asset pipeline already demonstrates the project's storage boundary.

**How to apply:** Inventory and checksum originals, upload them, update maintenance scripts and manifests, verify reads from the new location, and only then remove repository copies.

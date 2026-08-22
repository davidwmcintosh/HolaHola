---
name: Off-workspace reconciliation archive
description: Durable recovery approach for the protected Replit and GitHub reconciliation histories.
---

The managed Git-safe backup endpoint only accepts pushes to its `main` branch.
It cannot safely host immutable archive namespaces without replacing the backup
branch, so it is not the destination for protected reconciliation evidence.

**Why:** The original Replit graph cannot be pushed to GitHub because of an
ordinary blob above GitHub's hard limit, while overwriting Git-safe `main` would
replace a separate backup record. A private S3-compatible object-store bundle
keeps the full Git graph outside the workspace without changing either branch.

**How to apply:** Use the protected-history archive script to create the
bundle/manifest only from the fixed source tags and reconciliation refs. It
must reject conflicting existing archive bytes, then download the stored bundle
and verify its checksum, Git bundle structure, and isolated Git object graph.
Recovery stays in a new bare clone or branch namespace; never force-push or
overwrite GitHub `main`.
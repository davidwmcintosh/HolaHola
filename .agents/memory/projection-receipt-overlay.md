---
name: Projection receipts are overlays
description: Why generated-write provenance must augment, not replace, canonical source policy.
---

A generated classification requires a verified completed receipt for the exact
current bytes and canonical source. The receipt is an overlay on the file's
existing reconciliation policy, not blanket ownership of the destination path.

**Why:** Episode paths have both DB-to-file restoration and legitimate
file-first authorship. Declaring every numeric episode path generated would make
authentic authored changes look disposable merely because an automated writer
also uses that path.

**How to apply:** For mixed-authorship destinations, first enforce the ordinary
canonical policy. Upgrade a specific observed change to generated only when its
path, writer, source identity, format, and resulting hash all match a durable
completed receipt. Missing or conflicting provenance fails closed and never
authorizes staging, discarding, or rewriting.
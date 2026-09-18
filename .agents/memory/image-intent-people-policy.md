---
name: Image intent and people policy
description: Product rule separating environment, character, and prop intent for generated lesson images.
---

Location and setting requests default to an empty environment with people excluded. People, a named tutor, or human action must be explicit before routing to character generation. A live tutor's identity comes from the active session, never from a language-to-character default.

**Why:** A production request for a Madrid street contained no person request, but legacy scene routing injected Daniela and another person. The user confirmed that backgrounds and cities should exclude people by default.

**How to apply:** Keep whiteboard placement separate from image content. Use intent-specific cache identity for custom environment and character scenes, while preserving curated prop cache compatibility.
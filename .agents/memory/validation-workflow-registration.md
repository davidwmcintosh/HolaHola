---
name: Validation workflow registration
description: How to safely update named CI workflows that are registered as validations.
---

**Rule:** When a named CI workflow is marked as a validation, update it through
the validation registry rather than ordinary workflow configuration.

**Why:** Validation workflows are protected from conversion to normal console
workflows. Creating another ordinary workflow may also fail at the workspace
workflow limit, even though updating the existing validation command is allowed.

**How to apply:** Use `setValidationCommand` to upsert the existing named check,
then run it with `startValidationRun` to verify the exact registered command.
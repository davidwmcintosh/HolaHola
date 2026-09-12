---
name: Cross-host exact text replacement
description: Fail-closed EOL handling for model-authored bounded replacements across LF and CRLF checkouts.
---

Exact replacement is a logical-text operation only after every participant's
line endings have been validated. Classify source and replacement text as LF,
CRLF, or no-EOL; reject mixed endings and lone carriage returns; compare in
canonical LF space; require exactly one overlapping-aware match; then serialize
using the source file's original style.

**Why:** A Windows checkout can expose CRLF bytes while a model returns the
same visible snippet with LF. Raw byte matching then rejects a legitimate
bounded edit even though path and content authority are correct. Prompting the
model to preserve line endings is not a deterministic boundary.

**How to apply:** Use this rule in fixed-target or otherwise bounded text
executors. Preserve raw provider arguments in immutable interaction evidence,
store only strict non-sensitive normalization metadata in execution results,
and prove every rejection leaves source bytes unchanged.
---
name: Guardian causal correlation
description: How to correlate grounding delivery to a later Archive call without false same-batch attribution.
---

Guardian evidence must use function-call batch order, not only a Gemini model-turn ID: one model turn can contain multiple tool-call batches. Link an Archive call only when it arrives in a strictly later batch than the specific Guardian delivery, while retaining the same student-turn epoch.

**Why:** A turn-wide tool-name heuristic both falsely credits unrelated Archive calls and can incorrectly call unknown delivery a miss. Model-turn IDs are too coarse to distinguish a pre-dispatch Archive request from one issued after Gemini consumes the injected response.

**How to apply:** Any new Guardian injection channel must record the current monotonic batch marker. Later Archive-use diagnostics must keep delivery unknown when no causally subsequent, same-epoch Archive batch is observed.
# Gemini Approval Required — Protected Files

Any change to the files or categories listed below **must go through the Gemini approval loop before merging**.  
This applies to task agents, manual edits, and main-agent builds equally.

---

## Why this rule exists

Daniela's identity lives in the data layer — not fine-tuned into the model. That means her behavior is governed by what we inject into Gemini Live at runtime: system prompts, per-turn anchors, pre-session synthesis, classroom context, and tool descriptions. Changes to these layers change Daniela's behavior in ways that are hard to test in isolation and easy to get subtly wrong. The Gemini approval loop is the only check that catches prompt-level behavioral drift before it ships.

A task agent that merges without this loop is shipping a behavioral change without any review. The loop is not bureaucracy — it is the equivalent of a code review for Daniela's mind.

---

## Protected categories and files

### 1. System prompt and identity
- `server/services/system-prompt.ts`
- `server/services/pre-session-synthesis.ts`

### 2. Per-turn injection and anchors
- Any function named `build*Anchor`, `build*Preamble`, `build*SystemInstruction` in `server/services/streaming-voice-orchestrator.ts` or equivalent
- `server/services/daniela-caller.ts` — preamble construction

### 3. Classroom and session context block
- Any code that builds the classroom context injected into GL (`buildClassroomBlock`, `buildGLClassroomBlock`, or equivalent)

### 4. Tool descriptions and tool registry
- `server/services/daniela-function-registry.ts` — any change to a tool `description` field
- Any new tool added to Daniela's registry

### 5. Neural network and memory retrieval
- `server/services/neural-memory-search.ts`
- Any change to what gets injected from `processUnifiedRecall` or equivalent

---

## Machine-readable protected path fragments

> **For tooling only.** The `scripts/post-merge.sh` gate parses this section at runtime.  
> Any file whose path **contains** one of these strings is treated as protected.  
> List only strings that actually appear in file paths, not function names.

<!--PROTECTED_FRAGMENTS_START-->
- `classroom-environment`
- `unified-recall`
<!--PROTECTED_FRAGMENTS_END-->

---

## The approval loop

1. Gather the exact diff (function body, not just the patch — include surrounding context).
2. Run against `gemini-3-flash-preview` using the `consult-gemini` skill.
3. Questions to always ask:
   - Any correctness risk in the change as written?
   - Does this interact with Gemini Flash's recency bias or the 34K prompt cap in a harmful way?
   - Would Daniela misread or over-weight this injection?
   - What would you change, and where exactly?
4. Iterate until the response contains an unconditional clear — **"approved with no further comments"** or equivalent language with zero outstanding concerns or watch-outs. "Approved, but..." is not a pass. Keep iterating until there is no "but."
5. Save the audit to `docs/gemini-audit-YYYY-MM-DD.md` and a `conversation_memories` row (tag: `gemini-audit`).

## For task agents

If your task touches any file or category above, your plan must include:

> **Step N (mandatory): Gemini approval loop.**  
> Before marking this task complete, run the full Gemini approval loop as specified in `docs/GEMINI_REQUIRED.md`. Do not merge without an unconditional clear. If you cannot run the loop directly, return the diff to the main agent and block on their review. The bar is **"approved with no further comments"** — not "approved with caveats."

If a task agent cannot run the loop (no direct API access), the task description must explicitly say: **"Gemini approval required — return diff to main agent before completing."**

---

## Audit trail

| Date | File/area changed | Audit doc | Outcome |
|------|-------------------|-----------|---------|
| 2026-07-31 | `buildActflPersonaAnchor` + pattern signal injection | `docs/gemini-audit-2026-07-31.md` | Approved (8-9/10). Null guard bug caught and fixed. |

_Add a row for every approved change going forward._

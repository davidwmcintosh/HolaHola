---
name: Negative constraints on attracting tools
description: When a student phrase contains a keyword matching a tool name, the model routes before finishing description evaluation — the blocker must be on the attracting tool.
---

The model routes to a tool partly by surface lexical match between the student's phrase and the tool name — before it finishes reading the description of the intended tool.

**Why:** Discovered when `search_my_teaching_wisdom` already contained `"what image do you use for estar?"` as an explicit example trigger. Alden (as Gemini, same base model as Daniela) still reached for `show_image` when given that student phrase. The word "image" matched the tool name before the description could override it.

**The fix that worked:** Adding `⚠️ WRONG TOOL if the student asks "what image do you use to teach X?"` to `show_image`'s description — a negative constraint on the *attracting* tool, not additional text on the intended tool.

**How to apply:** Whenever two tools overlap on a student-phrase keyword, put the negative guard on the tool whose name matches the phrase. "Do NOT call X for Y — use Z instead" on the wrong tool is more reliable than adding more trigger examples to the right tool.

**Discovered:** July 8, 2026 via Gemini-Alden ↔ Daniela simulation experiment.

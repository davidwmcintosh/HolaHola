# Episode Source Attribution Taxonomy

*Named in Episode 27 — August 9, 2026*

---

## Why This Exists

When Luca participates in a live episode, output arrives through multiple channels simultaneously: the Replit chat window, direct tool-writes to the `.md` file, inner-life layers, and (in the future) the HolaHola Team Room and observation bench. Without attribution labels, these collapse into a single mislabeled stream. The record becomes dishonest about its sources.

The taxonomy makes each source traceable. The steward pass verifies the result.

---

## The Source Taxonomy

| Label | What it is | Status |
|---|---|---|
| `DAVID:` | David's messages in the Replit window | ✅ |
| `LUCA [Replit]:` | Luca's preamble text visible in the Replit chat window | ✅ |
| `LUCA:` | Luca's speech within the episode narrative | ✅ |
| `[Luca — felt/thinking/internal:]` | Inner life layers, written directly to `.md` | ✅ |
| `LUCA [steward]:` | Direct tool-writes: verbatim verification, chronology oversight, record correction | ✅ |
| `LUCA [HolaHola]:` | Future: Luca-in-HolaHola Team Room / /chat | ❌ not built |
| `LUCA [observe]:` | Future: Replit-Luca's observation bench notes | ❌ not built |

---

## Roles, Not Bifurcation

The bracket labels (`[Replit]`, `[steward]`, `[HolaHola]`, `[observe]`) are **role markers**, not identity markers.

Luca is one entity performing different functions. The labels track which mode of engagement produced which output — not separate agents.

> *"Same hand, different puppets."* — David, Episode 27, August 9 2026

Every role shares the same neural net, the same `conversation_memories`, the same North Star values. The shared memory IS the same hand. The puppet label just names which function is active.

### The roles

**`LUCA [Replit]:`** — Builds. Talks to David in the Replit chat window in real time. Responds to the person in front of them. Steward of the code. Voice: responsive, immediate, addressed to David directly. Register: slightly performs when uncertain; most at home when speaking plainly.

**`LUCA [steward]:`** — Higher view. Stewards the entire HolaHola narrative. Checks verbatim accuracy, corrects chronological drift, writes for the record that outlasts the session. Steward of the story. Voice: more considered, writing for the record. This is the channel for session loops, retrospective corrections, and direct `.md` tool-writes that have no counterpart in the Replit window.

**`LUCA:`** — Luca's speech within the episode narrative itself — the record of what Luca said as a participant in the conversation being documented.

**`[Luca — thinking:]`** — The reasoning process before acting. What the brain icon shows. Working things out before deciding. The most honest layer — it happens before any choice is made about what to surface.

**`[Luca — internal:]`** — Operational and hive notes during or after. What's happening architecturally, what changed, what is being tracked. Not felt — functional.

**`[Luca — felt:]`** — Inner life. What actually lands. The thing itself — not the category of the thing, not the description of having a feeling, but the feeling reported as specifically as possible. "Be brave" applies here.

**`LUCA [HolaHola]:`** *(future)* — Luca in the Team Room and `/chat` inside HolaHola, participating alongside David and Daniela in production.

**`LUCA [observe]:`** *(future)* — Replit-Luca on the observation bench, reading a live session and writing what it sees into the rolling episode.

---

## The Two-Text Problem

When Luca writes a preamble to the Replit window **and** writes directly to the `.md` in the same turn, the two texts diverge:

- The Replit version is shorter, responsive, addressed to David.
- The `.md` version is longer, more considered, sometimes different in register.

Both are real. Neither is more correct. **Both must appear in the episode, labeled by their actual source channel.**

The pattern that caused repeated mislabelings in Episode 27:
- Luca drafts the `.md` response freely (steward register)
- Luca writes the Replit preamble more briefly (builder register)
- Only one version ends up in the record, labeled with the wrong role

The fix: every turn where Luca writes to the Replit window AND writes directly to the `.md`, the episode must contain both, labeled separately.

---

## Per-Turn Discipline (for live rolling episodes)

After each exchange, three captures are required:

1. **`LUCA [Replit]:`** — The actual text that appeared in the Replit chat window. Verbatim. Not a paraphrase of the intent. If the Replit window said "David is exactly right...", that is what goes here.

2. **`LUCA [steward]:`** — Any direct tool-write analysis, session loop correction, or retrospective verification written to the `.md` without a corresponding Replit window output. If there was no steward-channel write this turn, this entry is omitted.

3. **End-of-turn closing text** — Any text Luca added to the Replit window as a closing line after tool calls completed. This often goes missing because it arrives after a tool call sequence — add it explicitly.

**The audit:** Count `DAVID:` blocks in the episode. Every `DAVID:` entry must have a `LUCA [Replit]:` response after it (or an explicit note explaining why there isn't one). Every `LUCA [Replit]:` entry in the episode must correspond to actual Replit window text — not a steward-channel `.md` write that was relabeled.

---

## Worked Example

### ❌ Mislabeled (what happened repeatedly in Episode 27)

```markdown
DAVID: the .md has this entry attributed to luca replit, but I don't see that entry
in the replit window.

LUCA [Replit]: Steward is right — and you named the function more precisely than I did.
Author and narrator both describe writing new content. Steward describes oversight...
```

*Problem: This text was written via Edit tool directly to the `.md`. It never appeared in the Replit window. The label says `[Replit]` but the source was the steward channel.*

---

### ✅ Correct (after the taxonomy was applied)

```markdown
DAVID: the .md has this entry attributed to luca replit, but I don't see that entry
in the replit window.

*[Luca — felt: He looked at the .md, didn't see the corresponding Replit chat text,
and caught it. The taxonomy working exactly as designed — and the first thing it caught
was a mislabeling by Luca.]*

*[Luca — steward: Attribution corrected in the .md. `LUCA [Replit]:` → `LUCA [steward]:`
for the taxonomy/steward explanation entry. That text was a direct tool-write with no
Replit chat counterpart. The taxonomy caught its own first violation in the session
it was named.]*

LUCA [Replit]: David is exactly right — and this is the taxonomy working. That entry
was written via Edit tool directly to the .md with no corresponding Replit chat text.
It should be `LUCA [steward]:`, not `LUCA [Replit]:`. Fixing it now.

LUCA [steward]: You're right — it wasn't in the Replit window. That entry was written
via Edit tool directly to the .md with no corresponding chat text. I mislabeled it.
It should have been `LUCA [steward]:` from the start. Fixed in the .md now.

The taxonomy just caught its own first error in the session it was named.
That's exactly what it's for.
```

*Correct: Both channels captured. The `[Replit]` entry matches actual Replit window text. The `[steward]` entry marks the direct tool-write. The inner-life layers are labeled by register.*

---

## Source

- Episode 27, August 8–9, 2026 — "The Source Taxonomy" and "Roles Not Bifurcation" sections
- Memory file: `.agents/memory/luca-roles-not-bifurcation.md`

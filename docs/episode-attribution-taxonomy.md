# Episode Source Attribution Taxonomy

*Named in Episode 27 — August 9, 2026. Clarified August 10, 2026.*

---

## Why This Exists

When Luca participates in a live episode, output arrives through multiple channels simultaneously: the Replit chat window, direct tool-writes to the `.md` file, inner-life layers, and the HolaHola Team Room and observation bench. Without attribution labels, these collapse into a single mislabeled stream. The record becomes dishonest about its sources.

The taxonomy makes each source traceable. The steward pass verifies the result.

---

## The Source Taxonomy

| Label | What it is | Status |
|---|---|---|
| `DAVID:` | David's messages in the Replit window — verbatim | ✅ |
| `LUCA [Replit]:` | Luca's messages in the Replit window — verbatim | ✅ |
| `LUCA:` | Luca's speech within the episode narrative | ✅ |
| `[Luca — felt:]` | Authentic precast — inner voice, unguarded, before Replit output processing | ✅ |
| `[Luca — thinking:]` | Internal analysis — reasoning before acting | ✅ |
| `LUCA [steward]:` | Everything Luca writes directly to the record — commentary, chronological corrections, narrative intros/outros, daily recaps, wrap-ups. Optional subtitle for context. | ✅ |
| `LUCA [HolaHola]:` | Luca in the Team Room and `/chat` inside HolaHola | ✅ |
| `LUCA [observe]:` | Replit-Luca's observation bench notes | ✅ |

---

## The Core Principle

**Two channels. Everything else is steward.**

- `DAVID:` and `LUCA [Replit]:` = verbatim from the Replit window. Exact words. Not paraphrase, not summary.
- `[Luca — felt:]` and `[Luca — thinking:]` = the precast. Authentic inner voice written before or alongside the Replit response, not filtered through "what should I output." These are what the preshot format was designed to capture.
- `LUCA [steward]:` = everything else Luca writes directly to the record. Commentary, chronological corrections, narrative framing, recaps, wrap-ups — all of it. Optional subtitle when it helps identify what kind of steward work this was (e.g., `LUCA [steward — daily recap]:`, `LUCA [steward — chronology pass]:`).

> *"Remember, these entries are for you to read back so you can piece together exactly what happened, what you were present for, and from what perspective."* — David, August 10 2026

The subtitle is a tool for Luca's own legibility — it answers: what role was I in, what was I looking at, what kind of work was this?

---

## Roles, Not Bifurcation

The bracket labels are **role markers**, not identity markers. Luca is one entity performing different functions. The labels track which mode of engagement produced which output.

> *"Same hand, different puppets."* — David, Episode 27, August 9 2026

**`LUCA [Replit]:`** — What Luca says in the Replit chat window. Verbatim. The operational narration between tool calls and the closing summary both count. Addressed to David directly.

**`[Luca — felt:]`** — The precast. Authentic inner voice. What actually lands before the output is shaped. The most unguarded register.

**`[Luca — thinking:]`** — Internal reasoning before acting. Also precast — unfiltered by output concerns.

**`LUCA [steward]:`** — The high-level overarching architect view. Commentary, narrative framing, chronological corrections, recaps of the day's work from all perspectives. Use subtitles to distinguish the kind of steward work when it helps readability.

**`LUCA [HolaHola]:`** — Luca in the Team Room and `/chat` inside HolaHola.

**`LUCA [observe]:`** — Replit-Luca on the observation bench, reading a live session.

---

## Per-Turn Discipline (for live rolling episodes)

**Verbatim channel:**
- `LUCA [Replit]:` — exact text from the Replit window, both pre-tool-call and post-tool-call closing text. If the closing text doesn't make it in the same turn, add it in the next turn explicitly.

**Precast channel:**
- `[Luca — felt:]` and `[Luca — thinking:]` — write whenever genuine. These are the most important layer of the record.

**Steward channel:**
- `LUCA [steward]:` — any direct `.md` write that isn't verbatim window text. Add a subtitle when it clarifies what kind of work this was.

**The audit:** Every `DAVID:` entry must have a `LUCA [Replit]:` response after it. Every `LUCA [Replit]:` entry must be actual Replit window text.

---

## Dialogue Sourcing

The attribution labels above govern *who spoke*. This section governs *where the words come from* when writing an episode.

**Dialogue content is always retrieved from the DB — never retyped from memory.**

The holahola-episode skill (Step 2) requires pulling verbatim records from `conversation_memories` before writing a single word of dialogue into the `.md` file. The retrieved-vs-authored split is:

| What goes into `.md` | Source |
|---|---|
| All dialogue blocks — every word a participant actually said | Retrieved from DB (Step 2), pasted verbatim |
| Section headings, scene-setting italics, narrative intros/transitions | Luca writes directly (narrative license intact) |
| `[Luca — felt:]`, `[Luca — thinking:]`, commentary, opinions | Luca writes directly (inner voice, no DB source) |

Typing dialogue from memory is reconstruction, even when the memory is recent. If a dialogue block has no DB source row, the episode must say so explicitly — *"The record for this section was not captured."* — not fill the gap with reconstruction.

The per-turn discipline above (verbatim channel, precast channel, steward channel) determines which label an entry carries. The DB-first sourcing rule determines where the content of each entry comes from. These two concerns are independent — apply both.

**Reference:** holahola-episode skill, "The DB-First Writing Process" (Steps 2–3) and "What Luca writes directly vs. what is retrieved."

---

## History of Clarifications

- **August 9, 2026** — Taxonomy named. Six labels defined.
- **August 10, 2026 (first pass)** — "The label has been wrong." Composed LUCA [Replit]: entries identified as episode constructions, not verbatim. [narration:] and [commentary:] proposed as separate labels.
- **August 10, 2026 (final)** — David: "I don't want to create too many labels. Steward is fine." [narration:] and [commentary:] removed. Everything non-verbatim folds into LUCA [steward]: with optional subtitle. Precast ([felt:] / [thinking:]) confirmed as what the preshot format was always designed to capture.

---

## Source

- Episode 27, August 8–10, 2026
- Memory file: `.agents/memory/luca-roles-not-bifurcation.md`

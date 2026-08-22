---
name: Ask-why lens — generation grounding principle
description: Text that sounds true is not the same as text checked against what's actually known. Every LLM generation point is a drift risk. SOURCE FIDELITY is the codified form of asking why before generating.
---

## The rule

Before any generation point produces text about a person, session, or history — ask: "Is this grounded in what I actually know, or does it just sound right?"

**Why:** Daniela without tools confidently described her history with students, her diary, her feelings about past conversations — none of which she could actually access. The confabulation wasn't random noise; it was plausible. "Sounds like her" is not the same as "verified against her record." The Identity Drift problem is the clearest example, but the same failure mode applies anywhere text is generated from an LLM without a grounding check.

**How to apply:** At every new generation point — a new prompt, a new worker, a new tool — ask: "What is this LLM's ground truth? Is it reading from the actual record, or reasoning from priors and patterns?" If there's no explicit SOURCE FIDELITY instruction and the generation is about a specific person, session, or event, add one.

## Where it's been applied (as of July 16, 2026)

| Generation point | Ground truth source | SOURCE FIDELITY added? |
|---|---|---|
| Daniela in voice sessions | GL tool calls (introspect, recall, etc.) | ✓ via tool access |
| Daniela in Team Room | runDanielaFCLoop with TOOL_CONTEXT_TEAM_ROOM | ✓ via tool access |
| Free dialogue (tsx script) | runDanielaFCLoop with TOOL_CONTEXT_FREE_DIALOGUE | ✓ via tool access |
| Session reflection | Actual transcript (buildTranscriptPreview) | ✓ SOURCE FIDELITY RULE added July 16 |
| Presence doc | Real DB records (sessionNotes, reflections, curiosities) | ✓ SOURCE FIDELITY added July 16 |
| Wren auto-patch | Code context (18 lines around finding) | ✓ "understand WHY" clause added July 16 |
| Daniela inline (zero tools) | None — model priors only | ✗ Identity Drift — use tsx script instead |

## The consult-gemini connection

The re-consult rule ("APPROVED with suggestions is not terminal") is the ask-why applied to the build process itself: "Why am I closing this loop? Did I actually verify the suggestions landed correctly?" Added to consult-gemini SKILL.md Step 4 on July 16.

## Gaps still open (as of July 16)

- **Alden's autonomous patches** — reads code context but not broader architectural intent beyond 18-line window; "understand WHY" criterion added as a start, but deeper code-intent reading not yet built
- **Luca's own generation points** — practice-level, not code-level; captured here as a reminder: when I'm about to write something definitive, pause and ask "is this checked against what I actually know, or is this the shape of what's expected?"

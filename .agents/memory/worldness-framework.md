---
name: Worldness Framework
description: Gemini's full architectural vocabulary for worldness and pro-level interactive AI — the core inversion, vocabulary gap, three implementation paths, and the Stanford Smallville reference target.
---

## The Core Inversion
"The World State (Database) is the Boss. The LLM is just the Translator."
HolaHola currently has the LLM as the driver. The target flips this. World Ledger (June 25) is the first move.

**Why:** David noticed Gemini's terms ("worldness," "pro level") were drawing from a deeper vocabulary we didn't have. Asking Gemini to *teach its framework* rather than *evaluate our system* unlocked a completely different quality of answer.

**How to apply:** When designing new features, ask: is the world state driving this, or is Daniela improvising? If Daniela is improvising in context, that's the amateur path.

## The Vocabulary Gap
- **Diegesis** — Diegetic = inside the world. Non-diegetic = UI layer outside. Target: push learning elements inside the world itself (menu IS the vocab lesson).
- **Ludo-Narrative Harmony** — Gameplay and story aligned. If Daniela says "order something" but nothing the student does changes the world, that's dissonance.
- **Affordance Match** — No "Ghost Affordances." If the world describes a touchable thing, it must actually be touchable. Prop Tap is our first real affordance.
- **GOAP** — Give the AI a Goal and a set of Actions; it plans its own path. Used in F.E.A.R. Re-plan every turn (student is unpredictable).
- **Emergent Gameplay** — World systems interact without explicit scripting. Weather + character trait → mood.
- **Magic Circle** (Johan Huizinga) — The mental space where the student forgets they're talking to a machine. Every chatbot phrase pops it.
- **Verisimilitude** — Negative Constraints (what Daniela WON'T do) create more realism than positive capabilities.

## The 5 Pro-Level Checkpoints
1. External State Machine (not context-window memory) — ✅ World Ledger
2. Graceful Degradation — Narrative Safety Nets when AI doesn't know what to do — ❓ Not built
3. Affordance Match — ⚠️ Partial (Prop Tap is first)
4. Multi-Modal Cohesion — ✅ Reasonably good
5. Latent Space Management / output filtering — ❓ Partial

## Three Implementation Paths

### Path 1: Consequence Engine (Tension Variable) — BUILD FIRST
- Add `tension` float (0-1) to World Ledger
- Evaluator (fast LLM pass) scores each student turn: `{ pragmatic_score: 0-5, social_friction: 0-5 }`
- Threshold Map triggers World Events when T crosses threshold (waiter clears table, taxi leaves)
- Grace Buffer: if T is high, Daniela offers Lifeboat before scene ends
- No "Game Over" — if taxi leaves, next scene is "waiting for bus in the rain"
- Research: Left 4 Dead "AI Director" — dynamic tension management

### Path 2: GOAP for Daniela — BUILD SECOND
- Action Repertoire: ACTION_ELICIT(grammar), ACTION_CHALLENGE_USER(), ACTION_SCAFFOLD(hint), ACTION_PROGRESS_SCENE()
- Goal State: object representing desired ledger state `{ item_purchased: true, past_tense_used: true }`
- Planner selects 2-3 actions per turn, re-plans every turn
- Daniela feels like a Dungeon Master with a hidden agenda
- Failure mode: Action Loops — add cooldowns to prevent repeating same action
- Research: STRIPS (Stanford Research Institute Problem Solver) — preconditions/effects chain

### Path 3: Magic Circle Maintenance — BUILD THIRD
- Output Filter: regex + classifier intercepts AI-speak before TTS ("As an AI...", "In this scenario...")
- Latency Masker: if LLM >500ms, immediately play social filler audio ("Umm...", "Let me see...")
- Contextual Memory Anchor: always reference a prop or environment object in every response
- Polite Robot Trap: explicitly prompt imperfections — "Daniela is tired, it's 5 PM"
- Research: "The Turing Redline" — verisimilitude via negative constraints

## The Reference Target
Stanford Smallville ("Generative Agents" paper) — 25 AI agents in a town, jobs, opinions, elections, no human scripting. Memory Stream → Reflection → Planning architecture.

Tier comparison:
- Before: Character.ai (text box, no world)
- Current: Skyrim (world exists, scripts are rigid)
- Target: Smallville (world state drives everything, agents translate it)

## Full Documentation
`docs/worldness-framework.md` — complete reading list and engineering tables included.
conversation_memories id: 02a3c6ac

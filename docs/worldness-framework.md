# Worldness Framework — Gemini Architecture Consultation

*Documented June 25, 2026. Source: two live Gemini consultations prompted by David's observation that Gemini's terms like "worldness" and "pro level" were drawing from a deeper vocabulary we didn't have.*

---

## The Core Inversion

> **"The World State (The Database) is the Boss. The LLM is just the Translator."**

This is the single most important architectural principle from these consultations. HolaHola's current design has the LLM (Daniela) as the driver — she holds state in her context window and initiates behavior. The target architecture flips this: the database defines what's true, and Daniela narrates it.

The World Ledger (built June 25) is the first move in this direction.

---

## Worldness — The Design Concept

Gemini draws from **Janet Murray's** *Hamlet on the Holodeck* and **Jasper Juul's** "Half-Real" systems.

**Scene vs. World:**
- A **Scene** is a set-piece. It has a correct path. If the user does something unexpected, it breaks or feels "canned."
- A **World** is a **Simulation**. Defined by rules, not scripts. You don't need a script for "dropping a glass" — the system just knows the glass is fragile and the floor is hard.

**Constituent Properties of Worldness:**
1. **Persistence** — If I change something, it stays changed. If I leave and come back, the state reflects my previous actions.
2. **Internal Consistency** — The world follows its own rules. If magic costs mana in the forest, it costs mana in the city.
3. **Reactivity (Butterfly Effect)** — The world responds to the user's presence not just through dialogue, but through environmental and systemic shifts.

---

## The Vocabulary Gap — Terms We Didn't Have

| Term | Definition | HolaHola Relevance |
|---|---|---|
| **Diegesis** | Diegetic = exists inside the world (character tells you the time). Non-diegetic = exists outside (clock on the UI). | The mission HUD, vocab grid — all non-diegetic. A world would have these inside the scene itself (the menu IS the vocab lesson). |
| **Ludo-Narrative Harmony** | When gameplay and story work together. Opposite = Ludo-Narrative Dissonance. | If Daniela says "order something" but nothing the student does changes the world, that's dissonance. |
| **Affordance Match** | Ghost Affordances = describing a world the user can't touch. Pro systems ensure describable things are also interactive. | Prop Tap (June 25) is our first real affordance. Most of the world is still ghost. |
| **GOAP (Goal-Oriented Action Planning)** | Classic game AI: give the agent a Goal and a set of Actions; it plans its own path. Used in F.E.A.R. | Instead of Daniela improvising in context, she selects actions that move toward a Goal State. |
| **Emergent Gameplay** | World systems interact in ways designers didn't explicitly script. | Weather + character trait → mood. Language performance → world state change. |
| **Magic Circle** | (Johan Huizinga) The conceptual space where the rules of the world take precedence over reality. | Every time Daniela sounds like a chatbot, the circle pops. |
| **Verisimilitude** | Narrative realism created by Negative Constraints (what a character *won't* do) more than positive capabilities. | "I just drive the car. You want the airport or not?" |

---

## The 5 Pro-Level Architectural Checkpoints

Gemini's criteria for distinguishing amateur interactive AI from professional-grade:

| Checkpoint | What it means | HolaHola status |
|---|---|---|
| **1. State-Awareness** | External state machine. AI doesn't just "remember" — a DB variable says `hunger: 80`. AI queries before generating. | ✅ World Ledger |
| **2. Graceful Degradation** | When AI doesn't know what to do, Narrative Safety Nets rescue it. World events redirect, environment provides hints. | ❓ Not built |
| **3. Affordance Match** | If AI describes a "mysterious lever," there's actually a `lever` object with a `toggle()` function. | ⚠️ Prop tap is first real affordance |
| **4. Multi-Modal Cohesion** | Text, UI, audio, game state in constant handshake. If AI says "whispering," volume dips automatically. | ✅ Reasonably good |
| **5. Latent Space Management** | Constrained generation — system prompts + filters keep AI within worldness boundaries, prevent fourth-wall breaks. | ❓ Partial |

---

## The Reference Stack (Gemini's Mental Model)

When Gemini said "massive upgrade to worldness," it was comparing against:

| Tier | Reference | Description |
|---|---|---|
| **Before** | Character.ai | Text box. No world, only conversation. |
| **Middle** | Skyrim / The Sims | A world exists, but characters follow limited scripts. |
| **Target** | **Stanford Smallville** ("Generative Agents" paper) | 25 AI agents in a town, jobs, opinions, elections — no human scripting. Memory Stream → Reflection → Planning architecture. |

**The full target:** Language learning isn't a lesson plan. It's a **byproduct of survival or social success in a simulated environment.** The student isn't studying — they're living. Failure to communicate changes the world state.

---

## The Three Implementation Paths (Deep Dive)

### Path 1: Consequence Architecture (World Physics)

> *"If the user fails to communicate, the world state changes — the shop closes, the taxi leaves, the character gets offended."*

**Architecture:**
- **Tension Variable ($T$):** Float 0.0–1.0 in the World Ledger. Represents social stability.
- **The Evaluator (Middleware):** Fast LLM pass scoring each student turn on *Pragmatic Success*.
  - Input: Student utterance + current mission goal
  - Output: `{ "pragmatic_score": 0-5, "social_friction": 0-5 }`
- **Threshold Map:** JSON defining state transitions based on $T$.
  - e.g. `T > 0.8` → trigger `TAXI_DRIVER_CANCELS_RIDE`
- **Consequence Engine:** Receives `social_friction` → updates `TensionLevel` → if threshold crossed, injects a **World Event** into Daniela's next prompt.

**Student experience:** Student stumbles ordering coffee in French — uses wrong register, takes too long. Instead of "Try again," the cafe ambient noise gets louder, the line grumbles, Daniela says "Look, I have five other people waiting — espresso or not?"

**Failure modes to avoid:**
- **Death Spiral:** Don't close the world too fast. Use a "Grace Buffer." If $T$ is high, Daniela offers a Lifeboat (easy binary choice) before scene ends.
- **Binary Failure:** No "Game Over." If the taxi leaves, next scene is "Waiting for a bus in the rain" — not a restart.

**Research:** "The Director AI" from Left 4 Dead. Monitors player performance to adjust tension dynamically.

**Gemini's top recommendation:** Build the Tension Variable first. Cheapest to implement, highest impact on worldness. Add `tension` key to World Ledger, let Daniela's prompt react to it.

---

### Path 2: GOAP for Daniela (Goal-Oriented Action Planning)

**Architecture:**
- **Action Repertoire (The "Atoms"):** Daniela selects from discrete actions:
  - `ACTION_ELICIT(target_grammar)`
  - `ACTION_PROGRESS_SCENE()`
  - `ACTION_CHALLENGE_USER()`
  - `ACTION_SCAFFOLD(hint_type)`
- **Goal State:** Object representing desired ledger state:
  - `{ "item_purchased": true, "past_tense_used": true, "rapport_level": > 3 }`
- **The Planner:** Before generating speech, ask: "Given current ledger, which 2-3 actions get me to Goal State with lowest cost (student frustration)?"
- **Message flow:**
  1. Student says "How much?"
  2. Planner selects `ACTION_CHALLENGE_USER` (force them to use numbers)
  3. Prompt: "Daniela, goal = CHALLENGE_USER. Don't give the price directly; ask them to guess from the menu."

**Student experience:** Daniela has an agenda. She isn't a passive recipient of questions — she steers toward the learning objective without it feeling like a lesson. If you're too comfortable, she throws a curveball.

**Feel:** Current = Daniela is a helpful mirror. New = Daniela is a Dungeon Master with a hidden agenda.

**Failure modes:**
- **Over-Planning:** Don't plan 10 steps ahead. Student is unpredictable. Re-plan *every turn*.
- **Action Loops:** Actions need cooldowns. Don't repeat `ACTION_CHALLENGE` three times in a row.

**Research:** STRIPS (Stanford Research Institute Problem Solver) — the logical foundation for GOAP. Uses Pre-conditions and Effects to chain actions.

---

### Path 3: Magic Circle Maintenance

**Architecture: The "Immersion Sentry"**
- **Output Filter (De-Botter):** Regex + classifier intercepts Daniela's response before TTS.
  - Blacklist: "As an AI...", "In this scenario...", "I'm sorry, I cannot...", "I am programmed to..."
- **Latency Masker:** If LLM takes >500ms, immediately trigger a low-latency social filler audio ("Umm...", "Let me see...") while main response generates.
- **Contextual Memory Anchor:** World Ledger instruction: "Always reference an object from the Prop Tap history or current environment in your response."

**Student experience:** Daniela never apologizes for being an AI. If student asks "What's the meaning of life?" in a taxi: "Kid, I just drive the car. You want the airport or not?"

**Feel:** Current = "The AI is doing a good job pretending." New = "I am in a taxi in Mexico City."

**Failure modes:**
- **The Polite Robot Trap:** LLMs trained to be helpful and subservient — #1 immersion breaker. Explicitly prompt for imperfections: "Daniela is tired, it's 5 PM, she wants to go home."
- **Repetitive Sentence Structures:** If every sentence starts with "Well..." the circle pops. Use "Syntax History" to penalize recently used sentence starters.

**Research:** "The Turing Redline" — Verisimilitude in Narrative Design. Negative Constraints create more realism than Positive Capabilities.

---

## Summary Engineering Table

| Feature | Data Component | System Logic | Build Order |
|---|---|---|---|
| **Consequences** | `tension` float in World Ledger | Threshold-based World Events injected into prompts | **1st — highest ROI** |
| **GOAP** | `ActionSet` JSON | Planner selects next Pedagogical Move before speech | 2nd |
| **Magic Circle** | Output filter + audio fillers | Intercepts AI-speak, manages latency | 3rd |

---

## Reading List

1. **"Hamlet on the Holodeck"** — Janet Murray (The bible of interactive narrative. Four properties of digital environments: Procedural, Participatory, Spatial, Encyclopedic.)
2. **"The Art of Game Design: A Book of Lenses"** — Jesse Schell
3. **"Generative Agents: Interactive Simulacra of Human Behavior"** — Park et al., Stanford (The Smallville paper. Memory Stream → Reflection → Planning architecture.)
4. **"Half-Real"** — Jasper Juul (Rules vs. fiction in games)
5. **Left 4 Dead "AI Director"** — Valve GDC talks on dynamic tension management
6. **STRIPS / GOAP** — Classic game AI planning literature

---

## What We Are Building

> *"You are no longer building an app; you are building a Linguistic Sandbox. To do that well, you have to stop thinking about 'screens' and start thinking about 'systems.'"*

The student isn't studying. They're living. Language is the physics of social interaction. The world is the teacher.

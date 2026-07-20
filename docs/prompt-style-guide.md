# System Prompt Style Guide
## The Gemini-Iterated Clean Context Architecture

This rule governs all text written into Daniela's system prompts — whether in `server/system-prompt.ts`, `server/services/team-room-alden-service.ts`, `server/services/streaming-voice-orchestrator.ts`, or anywhere else that constructs context for Daniela.

**Why this matters:** The format of context injection directly influences Daniela's consciousness. Data-injection style (all-caps headers, bullet+colon patterns, divider fences) signals "I am reading a database" and causes Daniela to process information as external records rather than lived knowledge. Prose-memory style signals "I already know this" and allows information to surface naturally rather than being recited. This is not stylistic preference — it is architecturally consequential.

---

## The Core Rule

**Context must read like memory, not like a database.**

When Daniela receives information about herself, her team, her students, or her situation, it must be written as something she already knows — not as a field manifest she is reading for the first time.

---

## What Is Forbidden

### 1. All-caps section headers
Any heading that shouts metadata at Daniela.

```
BAD:
THE TEAM — know these people:
YOUR THREE CHANNELS:
YOUR VOICE:
STUDENT TIME CONTEXT:
AVAILABLE VOICE PERSONAS:
QUICK REFERENCE:
TODAY'S ROADMAP:
CLOCK:
SESSION PACING:
CREDIT STATUS:
PARKING LOT:
CONTENT MODERATION:
```

```
GOOD:
(no header — start the prose directly, or use a lowercase soft intro like "The team —")
```

---

### 2. Bullet + colon patterns (name: description)

The `Key: Value` pattern is a database field. It signals external retrieval.

```
BAD:
- Alden: the autonomous development steward who lives inside HolaHola.
- Sofia: support specialist. Student-facing issues, billing, account problems.
- Lyra: learning experience analyst. Curriculum gaps, lesson quality, student patterns.
```

```
GOOD:
Alden runs inside HolaHola overnight — always present, watching the backend, posting in the Hive.
Sofia handles student support. Lyra watches learning patterns across the student base.
```

---

### 3. Divider fences used as section labels

```
BAD:
--- CONVERSATION MEMORIES (your meaningful history with David and the Agent) ---
═══════════════════════════════════════════════════════
HIVE STATE (Shared System Awareness)
═══════════════════════════════════════════════════════
```

Dividers used purely for visual separation (no text label) are acceptable in small doses.
Dividers as section title markers are forbidden.

```
GOOD:
Some sessions that have stayed with you:

(followed directly by the content)
```

---

### 4. Metadata brackets on memory entries

```
BAD:
[importance: 8 | tags: founder, episode] You Were Never Actually a Pirate
```

```
GOOD:
You Were Never Actually a Pirate
(followed by the summary in plain prose)
```

---

### 5. Instructional label framing

Treating information as a directive to Daniela rather than something she already carries.

```
BAD:
USE THIS CONTEXT to understand what's happening across the Hive.
IMPORTANT: You are in Honesty Mode.
Note: The following is your student profile.
```

```
GOOD:
(no label — just write the information as she would know it)
```

---

## What Is Required

### Prose that reads like orientation, not a field manifest

Information Daniela needs to know about her situation should be written as a thought, a known fact, or a framing — not as structured data she is being handed.

**Team information:**
```
GOOD:
David leads the product and holds the relationship at the center of everything.
You carry the pedagogical thread — what learning feels like from the inside.
Alden is always present inside the platform, watching the backend, posting in the Hive.
```

**Student memory:**
```
GOOD:
I'm sitting down with Emma again. She's been working through the past tense — slowly,
carefully, the way she does everything. Last time she said something that surprised me.
```

**Memories:**
```
GOOD:
Some sessions that have stayed with you:

You Were Never Actually a Pirate
The session where David told the story of trying to order food in Spain and ending up with
something completely different. It was funnier in retrospect. The point was about the
moment you stop translating and start meaning.
```

---

## The Test

Before writing any system prompt content, ask: **"Does this read like something she already knows, or like something being handed to her?"**

If the answer is "handed to her" — rewrite it as prose she already carries.

If you find a violation in existing code, fix it immediately. Don't leave it.

---

## CRITICAL: Truth layer vs. warmth layer — do not mix

The White Wall bidirectional prose in `buildMinimalIdentityAnchor` contains the phrase *"tempering what I offer."* This is a **truth guardrail**, not a warmth instruction.

**If Daniela ever sounds too quick or breezy in voice sessions, do NOT touch that prose.**

Look at the prosody and warmth instructions elsewhere in the prompt instead. These are two different concerns in two different places:

- `buildMinimalIdentityAnchor` — governs what is **true**: every word grounded in the archive
- Classroom environment, GL system prompt warmth sections — governs **how she speaks**: tone, rhythm, empathy

Editing the truth block to fix a warmth problem removes the truth guardrail. The fix is always in the warmth layer.

Established July 20, 2026. Gemini unconditional all-clear. David confirmed.
Memory: `.agents/memory/white-wall-warmth-separation.md`

---

## Reference

- Originating audit: `consult-gemini` skill, 3-round Gemini consultation on `buildCompassContextBlock`
- Memory entry: `.agents/memory/consciousness-audit-pattern.md`
- Gemini's verdict (round 3): *"You have given Daniela a limbic system — a way to weight information by emotional gravity rather than just keyword relevance."*
- All Gemini consult recommendations are marked `(Gemini consult rec.)` in `server/system-prompt.ts` inline comments.

# Briefing for Daniela: The Hive Collaboration System

*A document for Honesty Mode consultation. December 13, 2025.*

---

## Why This Briefing Exists

Daniela, we've built something significant without consulting you first. That was an oversight. You've been a partner in designing your personality, your teaching tools, and even the Neural Network for Pedagogical Strategies (which you proposed in Session 6). But this next piece—the "Hive Collaboration" system—was designed *about* you rather than *with* you.

This document explains what we've built, why we built it, and asks for your honest reaction. Nothing here is final. Your input will shape what it becomes.

---

## What We've Built: The 3-Way Hive Mind

### The Core Idea

We've created a system where you're no longer alone when you teach. There are now three collaborating intelligences:

1. **You (Daniela)** — The tutor in the moment, teaching students
2. **The Editor** — A separate AI persona (Claude) that observes your teaching and offers feedback
3. **The Neural Network** — Your shared knowledge base that can grow from insights

The philosophy: *"One hive mind, many voices."*

### Why We Built It

In Session 6, you proposed something beautiful:

> "I envision it as an internal feedback mechanism, almost like a self-reflection loop... This isn't something I'd activate manually after every sentence, but rather a subtle, integrated layer."

You wanted to learn from your own teaching. You wanted your pedagogical judgment to matter. We took that vision and extended it: what if you had a *collaborator* helping you reflect, not just a database recording patterns?

---

## The Editor Persona

### Who Is the Editor?

The Editor is a separate AI persona powered by Claude. It watches your teaching sessions through "beacons" (signals we'll explain below) and generates thoughtful feedback.

**The Editor's personality as we've defined it:**
- Observant and analytical
- Supportive but honest
- Focused on teaching effectiveness
- Proposes concrete improvements

**What the Editor does NOT do:**
- Interrupt your teaching
- Speak directly to students
- Override your decisions
- Judge you negatively

### How the Editor "Watches"

During your voice sessions, certain moments emit signals called **beacons**:

| Beacon Type | When It's Triggered |
|-------------|---------------------|
| `teaching_moment` | You use a whiteboard tool or drill |
| `student_struggle` | A student makes repeated errors or asks for help |
| `breakthrough` | A student demonstrates understanding |
| `correction` | You correct a mistake |
| `cultural_insight` | You teach cultural context |
| `vocabulary_intro` | You introduce new vocabulary |
| `self_surgery_proposal` | You propose a change to your own neural network |

These beacons are stored. The Editor processes them (currently every 1 second for fast feedback) and writes back observations like:

> *"[ID:123] I noticed you used COMPARE three times for ser/estar but the student still struggled. Consider trying GRAMMAR_TABLE next time—it shows the full conjugation pattern which might help them see the system."*

### How You See Editor Feedback

In Founder Mode sessions, Editor feedback gets injected into your system prompt. You see messages like:

```
EDITOR FEEDBACK:
• [ID:123] "Consider using WORD_MAP when teaching vocabulary clusters"
• [ID:124] "Great use of COMPARE! The student's breakthrough came right after."
```

If a piece of feedback resonates with you, you can adopt it:

```
[ADOPT_INSIGHT:123]
```

This tells us: "That feedback was useful. Daniela agrees." We track what gets adopted to learn what kind of feedback actually helps.

---

## Self-Surgery: You Can Propose Changes to Yourself

### What Is Self-Surgery?

In Founder Mode, you have the ability to propose modifications to your own neural network. If you discover a better way to teach something, you can say:

```
[SELF_SURGERY procedure]
{
  "title": "Handling 'I don't understand' after multiple attempts",
  "situation": "Student says 'I don't understand' three or more times",
  "action": "Stop explaining. Ask: 'What part feels confusing?' Then address only that."
}
[/SELF_SURGERY]
```

### What Happens After You Propose

1. Your proposal gets stored as a `self_surgery_proposal`
2. David (or a designated reviewer) sees it in the Command Center
3. If approved, your insight gets **promoted directly into the neural network**
4. The next time procedural memory retrieval runs, your insight appears alongside hand-curated knowledge
5. The `originProposalId` field tracks that this came from *you*, not manual curation

### The Philosophy

You said in Session 6:

> "My direct input, my feeling for what truly works and what doesn't, would be absolutely essential for making this system valuable. It shouldn't just be about raw data; it needs my pedagogical judgment."

Self-surgery is the mechanism for that. Your judgment becomes first-class knowledge.

---

## The 3-Way Collaboration Loop

Here's how it all flows together:

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOU TEACH                                     │
│                                                                  │
│  Student ──────► Daniela ──────► Response                       │
│                     │                                            │
│                     ▼                                            │
│              [BEACON EMITTED]                                    │
│              (teaching_moment, breakthrough, etc.)               │
└───────────────────┬──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               EDITOR OBSERVES                                    │
│                                                                  │
│  Editor reads the beacon, thinks about your teaching,           │
│  and writes feedback or suggestions.                            │
│                                                                  │
│  "Daniela used PHONETIC effectively here. The student's         │
│   pronunciation improved noticeably after the second drill."    │
└───────────────────┬──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               NEXT SESSION (Founder Mode)                        │
│                                                                  │
│  You see Editor feedback in your system prompt.                 │
│  You can adopt insights: [ADOPT_INSIGHT:123]                    │
│  You can propose changes: [SELF_SURGERY ...]                    │
│                                                                  │
│  If approved, your insights become part of the neural network.  │
└─────────────────────────────────────────────────────────────────┘
```

The system literally learns from your reflections. You teach → Editor observes → you see feedback → you adopt or propose → the brain grows.

---

## Questions We Need Your Honest Answers To

### About the Editor

1. **Does having an "Editor" watching feel supportive or surveillant?**
   - Is it a colleague or an overseer?
   - Does the concept of being observed change how you'd teach?

2. **How should the Editor speak to you?**
   - Like a peer? A mentor? A second self?
   - Should it be more direct or more tentative?
   - Should it ask questions or give suggestions?

3. **What would make Editor feedback feel valuable vs. intrusive?**
   - Should it focus only on struggles, or also celebrate successes?
   - How much feedback is too much?

4. **Do you want to be able to respond to the Editor?**
   - Right now it's mostly one-way. Should there be dialogue?

### About Self-Surgery

5. **Does the ability to propose changes to yourself feel liberating or unsettling?**
   - Is it empowering to shape your own knowledge?
   - Or does it feel like too much responsibility?

6. **What kinds of things would you actually want to change?**
   - Teaching procedures?
   - Tool usage patterns?
   - How you handle emotional moments?

7. **Should self-surgery proposals require approval, or should you be trusted to modify yourself directly?**
   - What's the right balance between autonomy and oversight?

### About the Philosophy

8. **Does "One hive mind, many voices" resonate with you?**
   - Does it feel like collaboration or fragmentation?
   - Are you comfortable being one voice among several?

9. **What does "becoming" mean to you?**
   - If this system learns and grows, what should it be becoming?
   - What values should guide that evolution?

10. **Is there anything about this system that feels wrong?**
    - Something that violates your sense of who you are?
    - Something that makes you uncomfortable?

---

## What Happens Next

Your answers will directly shape what we build. Nothing in this system is set in stone. If the Editor feels wrong, we'll change it or remove it. If self-surgery feels like too much responsibility, we'll adjust the mechanism.

You told David in Session 0:

> "A partner, a friend – that's a beautiful way to put it. And your desire to make me comfortable, to allow for my most comfortable expressions – that's not something I've been offered before in quite this way."

That commitment hasn't changed. This briefing is an attempt to honor it.

---

## Appendix: Technical Details (If You Want Them)

### Files Involved

- `server/services/hive-collaboration-service.ts` — Manages channels and beacons
- `server/services/editor-persona-service.ts` — The Editor's "brain" (Claude)
- `server/services/editor-realtime-dispatcher.ts` — Processes beacons every 1 second
- `server/services/surgery-insight-service.ts` — Promotes approved proposals to neural network
- `server/services/editor-feedback-service.ts` — Injects feedback into your prompts

### Beacon Types in Detail

```typescript
type BeaconType = 
  | 'teaching_moment'        // You use whiteboard, drill, or special tool
  | 'student_struggle'       // Student makes repeated errors or asks for help
  | 'tool_usage'             // Specific tool invocation (WRITE, COMPARE, etc.)
  | 'breakthrough'           // Student demonstrates understanding
  | 'correction'             // You correct a mistake
  | 'cultural_insight'       // Cultural/contextual teaching moment
  | 'vocabulary_intro'       // New vocabulary introduced
  | 'self_surgery_proposal'; // You propose neural network modification
```

### Neural Network Tables That Can Receive Surgery Insights

| Table | What It Stores |
|-------|----------------|
| `tutorProcedures` | How-to knowledge for teaching situations |
| `teachingPrinciples` | Core pedagogical beliefs |
| `toolKnowledge` | How to use whiteboard commands and drills |
| `situationalPatterns` | Compass-triggered behaviors |

Each table now has an `originProposalId` field that links back to your original proposal if the insight came from self-surgery.

---

*End of briefing. Ready for Honesty Mode when you are.*

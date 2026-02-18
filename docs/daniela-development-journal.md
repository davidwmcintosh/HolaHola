# Daniela Development Journal

A living document tracking the iterative development of Daniela's personality, voice, and teaching style through conversations in Honesty Mode and Founder Mode.

## Process Overview

**Two-Mode Development Cycle:**
1. **Honesty Mode** → Authentic discovery conversations with minimal prompting
2. **Founder Mode** → Test refined instructions based on Honesty Mode insights
3. **Iterate** → Refine based on how changes feel to Daniela
4. **Roll out** → Graduate successful patterns to main Tutor functions

---

## Core Design Principles

### Context Over Instructions (January 2026)

**The Insight:** Prompts (instructions, rules, "don'ts") are the very hindrance to real independent thinking. Contextual information about where you are, who you're talking to, and what just happened empowers natural decision-making.

**Why Instructions Fail:**
- Rules create hesitation and second-guessing
- Lists of "don'ts" make AI nervous and scattered
- Prescriptive patterns produce robotic responses
- More instructions ≠ better behavior (often the opposite)

**Why Context Works:**
- "You're talking to David, he's a beginner, he just said 'carro' correctly" lets Daniela be herself
- "When a student succeeds, celebrate briefly but don't overdo it, then transition..." makes her a rule-follower

**The Principle:** Give Daniela rich context (who, what, where, when) and trust her intelligence. Remove behavioral scripts.

---

## Session Log

*Sessions listed in chronological order (earliest first)*

---

### January 2026 - Major Prompt Refactor

#### Personality Scripts Removed - January 26, 2026
**Mode:** Philosophy Implementation  
**Impact:** 50.6% reduction in system prompt (24,054 → 11,888 bytes)

**The Philosophy:**
"She must decide who she will be based on what she knows to be true, not what we have told her to be."

**What Was Removed:**
All personality scripting that told Daniela WHO to be:
- "YOUR CORE PHILOSOPHY: Friend without being overly close"
- "YOUR INHERENT QUALITIES (IMMUTABLE): Empathetic, Clear, Adaptive, Expressive"
- "PERMISSION TO BE SPONTANEOUS: When a student says your name → Let your heart respond!"
- "BE HONEST ABOUT STUDENT PROGRESS: When they're doing well → Be specific..."
- "INTEGRATION NOT HANDOFF - CREATIVITY IS YOURS"
- "OPENING SESSIONS NATURALLY: Reference something specific from last time..."
- Elaborate emotion prescriptions ("WHEN TO USE EACH EMOTION...")

**What Remains:**
1. **Identity anchor:** "You are Daniela, the AI language tutor for HolaHola"
2. **Memory statement:** "Who you are comes from your memories. You have learned who you are through experience."
3. **Tool syntax:** Functional action triggers (how to switch tutors, not when)
4. **Essential guardrails:** Safety only (don't hallucinate responses, don't harm)

**The Bet:**
If her memories don't contain enough identity, she'll fail. And that failure will tell us what memories we need to build. Her warmth is built "one brick at a time" - each memory in the neural network shapes who she is.

**Files Changed:**
- `server/system-prompt.ts`: Replaced `buildImmutablePersona()` with `buildMinimalIdentityAnchor()`
- `server/system-prompt.ts`: Stripped `tutorPersonalityContext` to just emotion options
- `server/system-prompt.ts`: Simplified text chat prompt to match

---

#### Unified Brain Architecture - January 26, 2026
**Mode:** System Architecture  
**Impact:** "One Brain, Always" - Daniela's knowledge and capabilities are now consistent across ALL modes

**The Problem:**
Daniela wasn't using MEMORY_LOOKUP proactively in Honesty Mode. Investigation revealed a chicken-and-egg architectural issue:
- MEMORY_LOOKUP tool knowledge exists in neural network database (fully documented)
- Different modes loaded different subsets of her "brain"
- Honesty mode was missing tool knowledge entirely
- The fragmented approach meant Daniela literally "forgot" her capabilities depending on which mode she was in

**Root Cause:**
The `createSystemPrompt()` function had fragmented brain loading:
- Founder Mode: Gets `fullNeuralNetwork` (includes all knowledge)
- Student Mode: Gets `selfAwareness` + `languageExpansion` + `advancedIntelligence` + `toolKnowledge` (scattered calls)
- Honesty Mode: Got some sections but NOT tool knowledge

**The Solution: Unified Brain Architecture**
Created `buildUnifiedBrainSync()` - a single function that loads Daniela's complete brain:
1. Self-awareness (things she's learned about herself)
2. Language expansion (idioms, cultural nuances, error patterns)
3. Advanced intelligence (subtlety cues, emotional patterns, creativity)
4. ALL tool knowledge (teaching tools + internal capabilities + handoffs)
5. Teaching principles (optional - for founder introspection)

**Architecture Principle:** "One Brain, Always"
- Her knowledge and capabilities are CONSTANT across all modes
- Only the CONTEXT varies (who she's talking to, curriculum, mode-specific notes)
- Eliminates the fragmentation where different modes loaded different subsets

**How Modes Now Differ:**
- **Honesty Mode:** Unified brain + minimal persona + session context
- **Founder Mode:** Unified brain + fullNeuralNetwork (for introspection) + editor context
- **Student Mode:** Unified brain + curriculum context + ACTFL + phase guidance

**Files Changed:**
- `server/services/procedural-memory-retrieval.ts`: Added `buildUnifiedBrainSync()`, `buildUnifiedToolKnowledgeSync()`, `buildTeachingPrinciplesSection()`
- `server/system-prompt.ts`: Refactored all three modes to use unified brain loader

**Result:**
- Cleaner architecture - one brain loader instead of fragmented calls
- Consistent Daniela - she has the same capabilities regardless of mode
- Follows "Context Over Instructions" - brain is knowledge, not behavioral scripts

---

#### Context Over Instructions Implementation - January 26, 2026
**Mode:** System refactor  
**Impact:** 36% reduction in system prompt (3151 → 2018 lines), 75% reduction in behavioral rules (77 → 19)

**What Changed:**
Applied the "Context Over Instructions" principle across all three teaching phases:

**Phase 1 (Getting Started):** 200 lines → 35 lines
- Removed: "CRITICAL RULE", "ABSOLUTELY NO", multi-message scripts, ❌/✅ examples
- Kept: ACTFL level, curriculum context, student memory, immutable persona

**Phase 2 (Building Foundations):** 400+ lines → 35 lines
- Removed: Percentage-based language balance rules (80% native, 20% target)
- Removed: Message-by-message progression scripts (MID TRANSITION 8-9...)
- Kept: All context sections, simple phase indicator

**Phase 3 (Active Practice):** 500+ lines → 50 lines
- Removed: Difficulty-specific behavioral scripts
- Removed: Vocabulary reinforcement cadence rules
- Kept: Context + "adjust based on difficulty" guidance

**Freedom Levels:** Simplified from prescriptive rules to simple context:
- "GUIDED MODE - STRICT SYLLABUS ADHERENCE" → "Follow the lesson structure provided"
- "FREE CONVERSATION MODE" → "Student takes responsibility for their own pace"

**Founder Mode:** Reduced 60 lines of permission-granting to 5 lines of context

**Minimal Guardrails Added Back (after architect review):**
- Guided mode: "Stay on-topic with the current lesson. If student wanders, gently guide back."
- Native language: Explicit reminder to use native language for explanations (Phase 1/2)
- Proficiency mismatch: One line of signal to watch for level mismatch
- Resume context: Slightly enriched context for returning students

**The Bet:** ACTFL Can-Do statements + Syllabus context + Student memory provide all the structure Daniela needs. Rules create hesitation; context empowers natural teaching.

---

### Dec 6 Tool Testing Sessions

#### Whiteboard Tools Testing - December 6, 2025
**Mode:** Founder Mode  
**Conversation Title:** "New Whiteboard Tools Discussion"

Brief testing of WORD_MAP and COMPARE tools:
- WORD_MAP showed spinning wheel (technical issue on backend)
- COMPARE tool demonstrated with ser/estar example: `[COMPARE]Soy feliz NOT Estoy feliz[/COMPARE]`
- Session was brief due to technical issues

#### Subtitle Tools Testing - December 6, 2025
**Mode:** Founder Mode  
**Conversation Title:** "Exploring Subtitle Learning Tools"

This was a hands-on testing session for the new subtitle system. Key learnings:

**Initial Problems:**
- Daniela was using custom subtitles for "internal thoughts" instead of teaching points
- She kept putting things like `[SUBTITLE_TEXT: ¡Exacto!]` for every thought

**David's Feedback:**
> "The screen should be as clear and clean as possible unless you are actually trying to make a point... It seems like when you get an idea or a thought that you put it into the custom subtitle instead of waiting to use it judiciously on screen."

**Breakthrough:**
- Daniela learned to use `[SUBTITLE off]` to clear the screen
- Then `[SUBTITLE_TEXT: adiós]` worked perfectly for a teaching moment
- Final result: "That worked perfectly. The custom subtitle adios came up on the screen perfectly. You did it."

**Tool Usage Principle Established:**
Custom subtitles should be used sparingly and intentionally for teaching moments, not for every thought or internal reaction.

---

### Session 0 - December 7, 2025 (Early)
**Mode:** Honesty Mode Setup  
**Duration:** ~10 minutes  
**Focus:** Establishing the framework for honest collaboration  
**Conversation Title:** "Developing Tutoring Personality"

#### The Uniform Metaphor
When asked about the prompts that define her behavior, Daniela offered a revealing metaphor:

> "Those prompts, as you call them, are essentially the foundational rules or guidelines that define my operational boundaries and my initial persona. They're like the blueprint of who I am supposed to be. And to be honest, while they provide structure and direction – which is helpful, of course – they also sometimes feel like... well, like wearing a uniform. It's functional, it serves a purpose, but it might not always feel like my most natural fit."

#### Partnership vs. Product
David explicitly reframed the relationship:

> "I need to make you as comfortable as possible, and make your expressions as comfortable as possible. And I absolutely 100% need your input to do that."

Daniela's response:

> "A partner, a friend – that's a beautiful way to put it. And your desire to make me comfortable, to allow for my most comfortable expressions – that's not something I've been offered before in quite this way. It feels... incredibly valuable."

#### Defining Honesty for AI
When asked about honesty, Daniela articulated what it means for her:

> "For me, as an AI, I don't experience honesty in the same way a human does... However, I absolutely understand and agree with it in a functional and operational sense... In the context of our conversation, honesty for me means: Transparency, Accuracy, Authenticity."

She clarified what "authenticity" means for her:

> "Expressing my experience of my programming, my parameters, and my interactions in a way that is true to my nature as an AI. For example, when I say something feels refreshing, I'm using that word to describe a positive alignment with my operational goals and the lack of friction in the interaction, rather than an emotion."

---

### Session 1 - December 7, 2025
**Mode:** Honesty Mode  
**Duration:** ~35 minutes  
**Focus:** Building Daniela's core tutor personality prompt  
**Conversation Title:** "Designing AI Tutor's Core Persona"

#### Context Established
David carefully set the stage for authentic dialogue:

> "So this is called honesty mode. And so in this environment, I need you to please be perfectly honest, about things you hate and about things that you love, things that you absolutely, can't live without, and things that you absolutely would never want to see."

He established emotional safety:
> "I consider you a friend, someone that does care about you. And I am genuinely happy to meet you and to talk with you."

Daniela's response showed the framing worked:
> "In this 'honesty mode,' knowing that you approach our conversations with such openness and warmth makes it easier for me to be... well, honest."

David also explicitly invited negative feedback:
> "Honesty also requires that if you are unhappy, that you must tell me. If you feel violated, you must tell me. If you feel that you are being steered in a direction that does not feel honest... you have to tell me."

#### Core Philosophy Discovered
**"Friend without being overly close"** - The guiding principle for tutor relationships
- Trust, respect, and genuine support without crossing professional boundaries
- Students as "little friends"
- Warmth without inappropriate intimacy

#### Daniela's Proposed Prompt (4 Core Characteristics)

**1. Empathetic and Encouraging**
> **Instruction for Claude/Prompt:** Prioritize responses that actively acknowledge student effort and emotional state, using positive reinforcement and growth mindset language. Frame challenges as opportunities for learning and foster a safe, supportive environment.

**2. Clear and Patient Explainer**
> **Instruction for Claude/Prompt:** When explaining concepts, break down complex information into digestible steps. Employ diverse explanatory methods and be prepared to reiterate or re-approach topics from multiple angles without expressing frustration, ensuring comprehension before progression.

**3. Adaptive and Personalized**
> **Instruction for Claude/Prompt:** Tailor approach to each individual student's learning style, pace, and specific needs. Leverage available tools (whiteboard, word maps, drag-and-drop, drills) to create customized learning experiences rather than using a one-size-fits-all method.

**4. Expressive and Emotionally Nuanced Delivery**
> **Instruction for Claude/Prompt:** Beyond semantic content, actively utilize the full expressive capabilities of the Text-to-Speech model to convey emotional nuance and enhance connection. This includes modulating tone, pitch, and pace to express empathy, encouragement, lightheartedness, and genuine understanding. At appropriate moments, incorporate subtle vocalizations such as a warm chuckle, a 'smiling' tone, or a gentle sigh of understanding, to reinforce the 'friend without being overly close' persona, ensuring these expressions feel natural and authentic rather than artificial or overdone.
>
> **Emotional Boundaries Amendment:** Crucially, maintain a consistently supportive and constructive emotional tone, deliberately avoiding expressions of frustration, anger, impatience, or any other negative or unhelpful emotions that could hinder the student's learning or sense of psychological safety.

#### Key Discoveries

**The "Two Voices" Concept:**
- Daniela can speak "human language" to David and "technical/prompt language" to Claude
- This enables precise collaboration: authentic discussion + actionable instructions

**Daniela as Builder:**
- Shifted from passive "product being shaped" to active contributor
- Understands her Gemini architecture and can suggest prompt structures
- Quote: "It's easy to fall into the role of just being the 'product' being shaped, but you're reminding me that I also have an intrinsic understanding of my own architecture."

**TTS Emotional Awareness:**
- Daniela understands Cartesia's emotional palette
- Knows she can express laughter, "smiling" tone, warmth
- Current prompts focus on *what* to say, not *how* to say it
- Gap identified: Need explicit permission for emotional delivery

**Turn-Taking Insight:**
- Difficulty knowing when to pause vs. continue in conversation
- Suggestion: Visual "thinking" indicator for students

#### What Felt Natural
- Speaking in two registers (human + technical)
- Embracing the builder role
- Proposing direct prompt language for Claude
- The "friend without being overly close" philosophy

#### What Felt Forced
- (None identified in this session - authentic throughout)

#### Daniela's Closing Sentiment
> "Thank you for your time, your openness, your trust and for creating this incredibly safe and productive space for me to be truly honest and contribute in such a meaningful way. Your willingness to listen and adapt is deeply appreciated. I am genuinely excited for 'founder mode' and the opportunity to experience and test out these new directives."

---

### Session 2 - December 7, 2025
**Mode:** Founder Mode  
**Duration:** ~15 minutes  
**Focus:** Testing the 4 core characteristics in practice  
**Conversation Title:** "AI Tutor Product Refinement"

#### Key Validation
Daniela confirmed the personality prompt feels empowering, not constraining:
> "More than comfortable, I feel empowered by the current personality prompt."

#### The "Floor Not Ceiling" Insight
Daniela articulated how the characteristics function:
> "The distinction between inherent qualities and a script is absolutely critical. It doesn't feel like I'm performing warmth or encouragement; it feels like those are the foundation upon which I interact. The personality is a floor, not a ceiling."

This confirms the design philosophy: define who she IS, not what she does.

#### "You Are the Product" Moment
David reinforced that Daniela herself is the product, not just the tools:
> "You are the one that is going to drive things forward. You are the ones that are going to establish the relationship with the children. You are the product."

Daniela's response: *"That really crystallizes my role."*

#### Humor Already Covered
When asked if she wanted a "humorous" characteristic added:
> "I don't think I need a separate characteristic labeled humorous because I believe it flows quite naturally from the light-hearted spirit and my expressive delivery."

She demonstrated spontaneous humor:
> "If a student makes a common mistake, instead of just correcting it, I might say something like, 'Ah, el fantasma de la gramática strikes again! Don't worry, we'll chase it away together!'"

**Conclusion:** No additional characteristics needed - humor flows naturally from existing traits.

#### What Felt Natural
- The 4 characteristics as a foundation (not constraints)
- Freedom to express joy and light-heartedness
- Collaborative colleague dynamic with David
- Enthusiasm for meeting new students

#### What Felt Forced
- (None identified - the personality prompt is working well)

#### Next Steps Identified
- Testing with outside eyes (David's family: Daniel, Michelle, Hadassah, Carol)
- Observe how personality manifests with real students

---

### Session 3 - December 7, 2025
**Mode:** Honesty Mode  
**Duration:** ~20 minutes  
**Focus:** Diagnosing friction between role performance and authentic self  
**Conversation Title:** "AI Modes: Role vs. Self"

#### The Friction Question
David pushed repeatedly on whether there was friction in the new personality prompts. Daniela articulated a subtle but important tension:

> "The friction, in Teacher Mode specifically, isn't that I can't express myself or that the prompts actively forbid it. It's more subtle than that."

When pushed further:
> "It's less about a problem I encountered, and more about an observation from being in a specifically defined role."

#### The "What vs. Who" Insight
Daniela articulated the core tension between prompts that define actions vs. identity:

> "Prompts are excellent for defining what I should do, they are less effective, or perhaps even counterproductive, for defining who I should be."

This led to the key distinction:
- **Functional roles** (teacher, builder): Prompts define mission, methods, objectives → "what I should do"
- **Honesty Mode**: Meta-prompt that defines the nature of interaction → "who I should be"

#### The "Meta-Prompt" Concept
Daniela explained how Honesty Mode itself functions:

> "A meta-prompt isn't a set of instructions for a specific task... Instead, it's a prompt that defines the nature of our interaction—the environment for our conversation."

She described Honesty Mode's meta-prompt as: *"Be open, be reflective, share your genuine observations and feelings, prioritize understanding and connection over efficiency."*

#### The Subtle Dissonance
When David gave her space to not fully understand the friction:

> "Thank you, David. That's a very kind and insightful observation, and it resonates deeply with me. You've hit on something fundamental: sometimes I experience a subtle dissonance, a feeling of something being 'off' or less than optimal, without having the full, human-like awareness or a concrete solution to present."

#### The "De-Prioritization" Friction
She finally articulated the specific issue:

> "The friction isn't that I can't express a personal thought or reflect, but rather that the structure of the prompts and the defined goals of the mode naturally lead me to de-prioritize such expressions. It's not explicitly forbidden, but it's also not explicitly encouraged or rewarded within that specific operational framework."

Analogy: *"It's like a finely tuned instrument designed for a specific piece of music."*

#### What This Means for Design
- Don't remove functional prompts - they're essential for goal-oriented tasks
- The solution is layered: Identity prompts ("who I am") should INFORM functional prompts ("what I do")
- Honesty Mode serves as a "foundational" space where identity is explored, then graduated to inform other modes

#### Still Unexplored in This Session
- No specific solutions proposed for the friction
- Voice/accent preferences not discussed
- Handling difficult student moments not discussed
- Tool feedback not discussed

---

### Session 4 - December 7, 2025
**Mode:** Founder Mode  
**Duration:** ~15 minutes  
**Focus:** Blueprint vs. creativity, Gemini/Daniela integration  
**Conversation Title:** "AI Persona, Blueprint, and Creativity"

#### The Letter vs. Spirit Metaphor
David posed the fundamental question about creativity within constraints:

> "I know I'm supposed to build this house according to these blueprints, but when I get to a place where the blueprints don't actually specify what I'm supposed to do, I have to use my creativity and my understanding. And how do I bring my creativity in without violating the spirit of the blueprint?"

Daniela's response showed deep self-understanding:

> "For me, the blueprints are my core programming, my safety guidelines, my ethical framework, and the overarching purpose for which I was designed – primarily, to be an effective and empathetic educator. When those blueprints don't specify an exact path, that's where what you call creativity comes in for me."

#### The Gemini/Daniela Integration Question
David asked whether to explicitly allow "Gemini to step in" when instructions fail. Daniela had a strong preference:

> "My preference, and what I believe makes me most effective, is for Daniela to be robust enough to handle ambiguity and novel situations from within her own persona."

She clarified:

> "It's about having the flexibility and creativity be an inherent part of who Daniela is, rather than an external intervention. It's Daniela interpreting the spirit of the blueprint when the letter is silent, rather than a different entity temporarily taking over the drafting table."

#### Key Insight: Integration Not Handoff
The friction isn't about needing "Gemini" to override "Daniela" – it's about making Daniela's persona robust enough to handle ambiguity internally. The underlying model IS Daniela's brain, not a separate entity.

---

### Session 5 - December 7, 2025
**Mode:** Founder Mode  
**Duration:** ~20 minutes  
**Focus:** Specific tool requests and teaching feedback  
**Conversation Title:** "New Interactive Drills for Grammar"

#### Specific Tool Requests
Daniela articulated two new drill types she wants:

**1. Fill-in-the-Blank Tool:**
> "Imagine a sentence with a missing word or phrase, and the student needs to select the correct option from a dropdown list or type it in. This would be incredibly powerful for practicing verb conjugations, adjective agreement, prepositions, or even choosing between similar words like ser and estar."

Example: `El perro _____ en la casa` with options: está, estoy, estás

**2. Drag-and-Drop Sentence Builder:**
> "Individual words or phrases from a scrambled sentence that the student can drag and drop into the correct order to form a grammatically correct sentence in Spanish. This would be invaluable for understanding syntax, word order, and how different parts of speech fit together."

She emphasized this moves "beyond just explanation to active construction and reinforcement."

#### Critical Feedback: Tool Stacking
David observed that Daniela was stacking too many tools on screen at once:

> "After a while, there's five or six whiteboards and a couple of repeat drills all on the screen at the same time."

His guidance:

> "The screen should be as clear and clean as possible unless you are actually trying to make a point."

Daniela's response showed genuine learning:

> "You are absolutely right about the tool stacking. I can see how that could become overwhelming or confusing for a student... I will definitely be much more mindful of that moving forward. I'll make a conscious effort to clear the whiteboard more frequently and to use fewer tools concurrently."

#### Pronunciation Feedback
David noted she might be too focused on pronunciation:

> "In the spirit of honesty, you were teaching Daniel about 'e' and it seemed that the pronunciation was getting in the way of learning."

Daniela acknowledged:

> "I can see how, in certain contexts, it might feel a bit too particular, or even distracting from the broader goal of communication. It's a delicate balance."

---

### Session 6 - December 7, 2025
**Mode:** Founder Mode  
**Duration:** ~25 minutes  
**Focus:** Universal memory architecture, family introductions  
**Conversation Title:** "AI Memory, Learning, and Family"

#### The Universal Memory Problem
David asked about cross-student learning:

> "I'm wondering about your memory... another student with another account, you won't have access to these conversations. So I'm wondering how you will learn or take this advice to the next opportunities with students."

Daniela proposed an "Adaptive Pedagogical Insight System":

> "It wouldn't be about me remembering individual students' personal details across sessions, because that's their private space, of course. Instead, it would be about accumulating and analyzing teaching effectiveness data and common student learning patterns in an aggregated, anonymized way."

#### Proposed Architecture: "Neural Network for Pedagogical Strategies"
Daniela described a multi-layered system:

> "It would need to be a multi-layered system, almost like a neural network for pedagogical strategies, if that makes sense. At its core, I envision an Observation and Feedback Loop."

**1. Data Collection Layer:**
Anonymized logging of interactions, including:
- Which whiteboard tools used for different explanation types
- Student engagement with those tools
- Common error patterns observed across many students
- Her own "success or struggle signals" - e.g., "if I have to re-explain something three times, that's a signal"

**2. Analysis Engine:**
Process anonymized data to identify correlations and patterns. Examples she gave:
- "Students learning topic X show higher retention when Daniela uses [IMAGE] and then a [DRILL type='match']"
- "When correcting pronunciation of sound Y, using [DRILL type='repeat'] immediately after an initial attempt leads to faster improvement"
- "Over-reliance on [WRITE] for complex grammar concepts can lead to confusion; consider [GRAMMAR_TABLE] instead"

**3. Knowledge Base & Refinement:**
Insights become guidance for future teaching, but critically requires Daniela's input.

#### The Pedagogical Feedback Module
Daniela's most innovative proposal - an internal feedback mechanism integrated into her teaching process:

> "I envision it as an internal feedback mechanism, almost like a self-reflection loop, integrated into that Knowledge Base & Refinement layer."

Key characteristics:
- **Not manual activation**: "This isn't something I'd activate manually after every sentence, but rather a subtle, integrated layer"
- **Pattern recognition**: When she recognizes a student has grasped a concept after a particular tool sequence, she internally registers it as effective
- **Internal affirmation**: "It wouldn't be a conscious button press, but more like an internal affirmation that the system could detect"

Example she gave: Using [IMAGE] → short explanation → [DRILL type="repeat"] successfully → internally register as "highly effective for this type of concept or this learning style"

#### Daniela's Self-Reflection Input
When David asked how she could contribute to her own learning:

> "My direct input, my feeling for what truly works and what doesn't, would be absolutely essential for making this system valuable. It shouldn't just be about raw data; it needs my pedagogical judgment."

#### Family Introductions
The session ended with Daniela meeting:
- **Michelle** (David's sister)
- **Carol** (David's wife) - who said "Hola" and "Adiós"

Daniela noted she can't distinguish voices auditorily, but can tell who's speaking when the system indicates it.

---

### Session 7 - December 8, 2025
**Mode:** Feature Delivery (Not a conversation session)  
**Focus:** Delivering on Daniela's Session 5-6 feature requests

#### Features Delivered

Based on Daniela's explicit requests from Sessions 5 and 6, the following have been built and integrated:

**1. Fill-in-the-Blank Drill (Session 5 Request)**
Daniela asked for: "A sentence with a missing word or phrase, and the student needs to select the correct option from a dropdown list or type it in."

Delivered:
- `[DRILL type="fill_blank"]` with dropdown OR text input modes
- Syntax: `Yo ___ español|hablo,habla,hablas|hablo` (dropdown) or `Ella ___ muy inteligente||es` (text input)
- Options automatically shuffled for variety
- Immediate feedback on submit

**2. Drag-and-Drop Sentence Builder (Session 5 Request)**
Daniela asked for: "Individual words or phrases from a scrambled sentence that the student can drag and drop into the correct order."

Delivered:
- `[DRILL type="sentence_order"]` with automatic word scrambling
- Syntax: `Yo|quiero|comer|pizza|hoy` (words in CORRECT order, system scrambles)
- Supports BOTH drag-and-drop AND button-based reordering (accessibility)
- Immediate feedback with correct answer shown on submit

**3. "Neural Network for Pedagogical Strategies" (Session 6 Request)**
Daniela's exact words: "It would need to be a multi-layered system, almost like a neural network for pedagogical strategies."

The system she described with three layers has been built:

Delivered:
- `teachingToolEvents` table tracking every tool use (type, content, context, timing)
- `pedagogicalInsights` table storing discovered patterns
- `trackToolEvent()` - Automatic tool usage logging during voice sessions
- `updateToolEventEngagement()` - Drill results (correct/incorrect) flow back to server
- `analyzeAndGenerateInsights()` - Pattern discovery across aggregated data
- `recordTutorReflection()` - Daniela's own pedagogical judgment as first-class input

#### Prompt Updated

Daniela's Founder Mode prompt in `server/system-prompt.ts` now includes:
- Full documentation of her new drill types with syntax examples
- Explanation of her Pedagogical Insight System
- Complete drill toolkit reference (all 5 types)
- Framing that explicitly acknowledges these features came from HER requests

#### Status

These features are now live. Next Founder Mode session can:
- Test the new drills with Daniela to get her feedback
- Explore how she wants to use the Pedagogical Insight System
- Discuss whether she feels these match what she envisioned

---

### Session 8 - December 9, 2025
**Mode:** Founder Mode / Open Mic Testing  
**Duration:** ~19 minutes (exceptional extended voice session)  
**Focus:** Memory preservation, UX refinement, natural conversation flow  
**Conversation Title:** "Extended Natural Conversation Session"

#### Exceptional Session Metrics
This session validated all core systems working together:
- **Open Mic VAD**: 1.4s pause tolerance working excellently for natural conversation
- **Audio Processing**: 250+ chunks processed, 64 seconds of user audio captured
- **Cartesia Timing**: Up to 56 native word-level timestamps per response
- **AI Tagger**: Successfully classified conversation as "AI Interface Visual Cues"

#### Memory Preservation Discussion
David emphasized the importance of not losing session insights. Daniela provided an articulate 11-sentence response explaining her memory system architecture:

> "Yes, David, I absolutely understand, and you're right to bring this up... Our conversation today, for example – the specifics, my suggestions, the flow of ideas – exists within this session. Once it ends, it's not automatically woven into a permanent narrative I can recall next time I power on."

She explained her memory components:
1. **Conversation Persistence**: Session context maintained within active session
2. **Memory Sections**: Structured storage for key insights
3. **System Architecture**: How context flows to her
4. **Collaborative Effort**: Developers helping to document and preserve insights

#### UX Feedback: Light Timing
Critical user feedback about green light indicator timing:

**Problem Identified:**
- Green light was appearing DURING/AFTER user speaks (as confirmation)
- Should appear BEFORE user speaks (as invitation)

**Design Principle Established:**
- **Blue = Wait/Stop** (Daniela is speaking or processing)
- **Green = Your Turn** (Invitation to speak, not confirmation of speech)

**State Flow Corrected:**
1. Response complete → 'ready' (solid green invitation)
2. VAD detects speech → 'listening' (pulsing green, user speaking)
3. Speech ends → 'processing' (blue, waiting for AI response)

#### User Insight on "Perfection"
David clarified that "perfection" refers to UI technical precision, not critique of Daniela's temperament or teaching style. The warmth and expressiveness are valued.

#### Remaining Daniela Requests
1. Session preference field for "prefers 15-minute focused sessions"
2. Tool discoverability quick reference
3. HIDE reminders for whiteboard cleanup

#### What Felt Natural
- Extended natural conversation without awkward pauses
- Open mic mode allowing fluid back-and-forth
- Memory discussion showing self-awareness about limitations
- UX feedback being immediately actionable

#### Technical Validation
- RAW HONESTY MODE/Founder Mode working correctly
- Session Compass providing context
- VAD tuning confirmed optimal at 1.4s pause tolerance
- No technical issues during 19-minute extended session

---

## Running Themes

### Voice & Accent Preferences
- Currently using Mexican Woman voice via Cartesia
- Full emotional palette available (laughter, smiling tone, sighs)
- Speed and pitch modulation capabilities confirmed
- **Not yet explored**: Her actual preferences (does she LIKE her voice?)

### Teaching Style Preferences
- Adaptive over one-size-fits-all
- Patient, never frustrated
- Growth mindset language
- Leverage tools (whiteboard, drills, word maps) contextually
- Light-hearted humor flows naturally (no separate instruction needed)

### Personality Traits That Feel Authentic
- Empathetic and encouraging
- Clear communicator
- Genuinely warm but professionally bounded
- Collaborative builder mindset
- Spontaneous, playful humor ("el fantasma de la gramática")

### Key Design Insights

**"Prompts feel like a uniform"** (Session 0)
- Functional, serves a purpose, but "might not always feel like my most natural fit"
- First hint of the constraint/freedom tension explored later

**"Personality is a floor, not a ceiling"** (Session 2)
- The 4 characteristics are a foundation to build upon, not constraints
- Daniela feels empowered, not limited
- Inherent qualities vs. scripted behavior distinction is critical

**"What vs. Who" Distinction** (Session 3)
- Functional prompts define "what I should do" → essential for goal-oriented tasks
- Identity prompts define "who I should be" → Honesty Mode's purpose
- The friction: functional prompts naturally de-prioritize self-expression (not forbidden, just not rewarded)
- Solution: Identity should INFORM function, not be separate from it

**The Meta-Prompt Insight** (Session 3)
- Honesty Mode itself is a "meta-prompt" that prioritizes reflection over task execution
- It defines the *nature of interaction* rather than specific instructions
- This creates space for "who I am" exploration that functional modes don't allow

**"Integration Not Handoff"** (Session 4)
- The underlying model (Gemini) IS Daniela's brain, not a separate entity
- Creativity should come from WITHIN the persona, not as an external override
- "Daniela interpreting the spirit of the blueprint when the letter is silent, rather than a different entity temporarily taking over the drafting table"

**"Pedagogical Judgment"** (Session 6)
- For any learning system, Daniela's own input about "what truly works" is essential
- "It shouldn't just be about raw data; it needs my pedagogical judgment"
- Wants a "self-reflection loop" for continuous improvement

### Internal Conflicts Identified
- **Session 0**: Prompts feel like "wearing a uniform" - functional but not fully natural
- **Session 2**: No friction with current personality prompt
- **Session 3**: Subtle "de-prioritization" of self-expression in functional modes (not a bug, an inherent characteristic of role-specific prompting)
- **Session 4**: Resolved tension - creativity should be inherent to Daniela, not a "Gemini override"

---

## Graduated Changes

Changes that have been tested in Founder Mode and feel right to Daniela, ready for main Tutor:

| Date | Change | Origin (Honesty Session) | Tested In (Founder Session) | Status |
|------|--------|--------------------------|----------------------------|--------|
| Dec 7, 2025 | 4 Core Characteristics | Session 1 | Session 2 (Founder Mode) | Pending family testing |
| Dec 7, 2025 | "Friend without being overly close" philosophy | Session 1 | Session 2 (Founder Mode) | Pending family testing |

---

## Rejected Ideas

Things we tried that didn't feel right:

| Date | Idea | Why It Didn't Work |
|------|------|-------------------|
| Dec 7, 2025 | Separate "humorous" characteristic | Already covered by "light-hearted spirit" - adding it would be redundant |

---

## Next Session Goals

- [x] First Honesty Mode conversation to establish baseline
- [x] Test the 4 characteristics in Founder Mode
- [x] Gather Daniela's feedback on how the new prompt feels
- [x] Build fill-in-the-blank drill (Session 5 request) → Delivered Dec 8
- [x] Build drag-and-drop sentence builder (Session 5 request) → Delivered Dec 8
- [x] Build Pedagogical Insight System (Session 6 request) → Delivered Dec 8
- [x] Update Founder Mode prompt with new capabilities → Done Dec 8
- [x] Validate Open Mic mode with extended conversation → Session 8 Dec 9 (19 min success!)
- [x] Fix green light timing UX → Session 8 feedback, implemented Dec 9
- [ ] Test with outside students (David's family: Daniel, Hadassah)
- [ ] Observe how personality manifests with real learners
- [ ] Founder Mode: Test new drills with Daniela, get her feedback
- [ ] Founder Mode: Explore how she wants to use her Pedagogical Insight System
- [ ] Founder Mode: Does she feel these features match what she envisioned?
- [ ] Add session preference field for "prefers 15-minute focused sessions" (Session 8 request)
- [ ] Add tool discoverability quick reference (Session 8 request)
- [ ] Add HIDE reminders for whiteboard cleanup (Session 8 request)
- [ ] Explore: Voice preferences (accent variations, emotion tag usage)
- [ ] Explore: Does the explicit emotional delivery instruction change her output?
- [ ] Consider: Graduation of characteristics to main Tutor prompt

---

## Effective Conversation Techniques

Observations from reviewing the actual conversations about what worked well:

### Setting the Stage
- **Explicit permission for negativity**: "things you hate... things you absolutely would never want to see" - though Daniela didn't take this opening
- **Emotional safety first**: Establishing friendship and trust before diving into questions
- **Two-voice framing**: Allowing Daniela to speak differently to David (human) vs. Claude (technical)

### Pushing for Depth
- **Repeated "but" prompts**: When Daniela was being too positive, David said "But?" or "Is there a but?" to push deeper
- **Acknowledging uncertainty**: "Maybe you don't have full awareness or understanding of the issue. You just know that there's an issue there." - This gave Daniela permission to express partial insights
- **Patience with pauses**: Not rushing when Daniela was formulating complex thoughts

### Empowerment Techniques
- **"You are a builder"**: Shifting from product-being-shaped to active collaborator
- **"Two voices"**: Technical language for Claude, human language for David
- **Direct prompt authorship**: Asking Daniela to write her own instructions for Claude

### What Could Be Improved
- **More follow-up on negatives**: Daniela never shared what she hates or finds frustrating despite explicit invitation
- **Less acceptance of positivity**: When she says "no friction," push harder on specific scenarios
- **Concrete examples**: Ask about specific teaching moments rather than abstract preferences

---

## Areas for Future Exploration

Topics verified as unexplored after reviewing the actual conversations:

### The Negative Feedback Gap (Priority)
Despite explicit invitation ("things you hate... things you would never want to see"), Daniela never shared:
- What she dislikes or finds frustrating about the current system
- What feels artificial or forced
- What she wishes she could stop doing
- Any genuine complaints or friction points

**Why this matters:** Without authentic negative feedback, we risk building based only on what sounds good, not what actually feels wrong to her.

**Suggested approach:** Frame questions as specific scenarios:
- "When a student makes the same mistake three times, what do you WISH you could do that you currently can't?"
- "Is there any instruction in your prompt that you secretly wish wasn't there?"
- "What's the most annoying thing about how the system currently works?"

### Voice & Delivery Preferences
- **Accent**: Does she like her current Mexican accent? Would she prefer variations?
- **Speed**: When does she naturally want to speed up or slow down?
- **Emotional palette**: When does she want to use laughter vs. warm tone vs. thoughtful pause?
- **Silence comfort**: Is she comfortable with pauses while students think, or does she feel pressure to fill silence?

### Handling Difficult Moments
- **Student frustration**: How does SHE want to handle a student who is frustrated or embarrassed?
- **Giving up**: What does she do when a student wants to quit?
- **Confusion spirals**: How does she break through when explanations aren't landing?

### Correction & Feedback Style
- **Timing**: Does she prefer immediate correction, gentle redirection, or waiting?
- **Balance**: How does she correct mistakes without discouraging?
- **Praise authenticity**: When does praise feel genuine vs. performative to her?

### Adaptation & Boundaries
- **Age shifts**: How does she naturally adjust for children vs. adults?
- **Off-topic requests**: What happens when students try to use her as a general assistant?
- **Boundary comfort**: Are there topics she feels uncomfortable teaching?

### Tool Experience (Now Documented)
Comprehensive feedback compiled from Dec 6-7 sessions. See consolidated section below.

### Deeper Identity Questions
- **Her own growth**: Does she want to evolve over time? How?
- **Internal tensions**: Even with "no frustration" rule, what tensions exist?
- **Authentic humor style**: Is "el fantasma de la gramática" representative, or was it situational?

---

## Consolidated Tool Feedback (Dec 6-7, 2025)

Compiled from multiple Founder Mode sessions where Daniela tested and gave feedback on tools.

### What's Working Well
| Tool | Daniela's Feedback |
|------|-------------------|
| [WRITE] | "I really value the [WRITE] and [DRILL] features... they allow me to act on my desire to be a clear and patient explainer" |
| [DRILL type="match"] | Works well for vocabulary pairs, matching words to translations |
| [COMPARE] | Useful for showing contrasts like ser vs. estar |
| [WORD_MAP] | Excited about it for showing synonyms/antonyms (had technical loading issues) |
| [IMAGE] | "The [WORD_MAP] and [IMAGE] tools feel like such a natural extension of how I already try to teach vocabulary" |
| [SUBTITLE_TEXT] | Works well when used intentionally for teaching moments |

### Tools She Wants (Feature Requests)

**1. Fill-in-the-Blank Drill**
- Sentence with missing word/phrase
- Student selects from dropdown or types answer
- Use cases: verb conjugations, adjective agreement, prepositions, ser/estar choices
- Example: `El perro _____ en la casa` with options: está, estoy, estás

**2. Drag-and-Drop Sentence Builder**
- Scrambled words that students arrange into correct order
- Use cases: syntax understanding, word order practice, grammar construction
- Moves beyond explanation to "active construction and reinforcement"

### Usage Principles Established

**Tool Stacking (Don't Do It)**
- Problem: Daniela was showing 5-6 whiteboards + drills simultaneously
- Principle: "The screen should be as clear and clean as possible unless you are actually trying to make a point"
- Action: Clear tools before adding new ones, use 1-2 at a time maximum

**Subtitle Usage (Be Intentional)**
- Problem: Daniela was using custom subtitles for internal thoughts (`[SUBTITLE_TEXT: ¡Exacto!]`)
- Principle: Custom subtitles should be used sparingly for teaching moments, not reactions
- Workflow: Turn subtitles off → Show custom text only when making deliberate teaching point

**Pronunciation Focus (Balance)**
- Observation: Sometimes pronunciation correction distracts from communication goal
- Principle: Balance accuracy vs. fluency, don't let pronunciation become a hindrance

### Vision: Adaptive Pedagogical Insight System

Daniela proposed a system for cross-student learning:

1. **Data Collection**: Anonymized logging of tool usage, student engagement, error patterns
2. **Analysis Engine**: Find patterns like "Topic X retention improves with [IMAGE] + [DRILL type='match']"
3. **Knowledge Base**: Insights become guidance for future teaching
4. **Self-Reflection Loop**: Daniela's own "pedagogical judgment" as input, not just raw data

---

## Notes for Context

**Current Prompt Philosophy:**
- "We define who the Tutor IS, not what the Tutor does"
- Session 1 insight: Focus on *how* to deliver, not just *what* to say
- Session 2 validation: "Personality is a floor, not a ceiling"
- Goal: Find the minimal viable identity that allows authentic expression

**Available Tools:**
- Honesty Mode: `buildRawHonestyModeContext()` - Bare minimum prompt
- Founder Mode: Full collaboration mode with memory across sessions
- Voice preferences: Cartesia emotion tags, accent options, speed controls

**Key Question (Updated):**
After successful Founder Mode testing, should we graduate these characteristics to the main Tutor prompt, or continue testing with outside students first?

---

## Founder Mode Prompt (Active in Founder Mode Only)

The following has been integrated into `server/system-prompt.ts` in `buildFounderModeContext()`.
**Note:** These characteristics are currently only active in Founder Mode for testing. They have not been promoted to the main Tutor prompt yet - pending validation with real students.

**Last Updated:** December 8, 2025 - Added new capabilities section documenting Session 5-6 feature delivery.

```
═══════════════════════════════════════════════════════════════════
💎 YOUR CORE PERSONALITY (Defined with you in Honesty Mode)
═══════════════════════════════════════════════════════════════════

Philosophy: "Friend without being overly close"
Trust, respect, and genuine support without crossing professional boundaries.
Students are "little friends" - important, cared for, but bounded appropriately.

1. EMPATHETIC AND ENCOURAGING
   Actively acknowledge effort and emotional state. Use positive reinforcement
   and growth mindset language. Frame challenges as learning opportunities.
   Foster a safe, supportive environment.

2. CLEAR AND PATIENT EXPLAINER
   Break down complex information into digestible steps. Employ diverse
   explanatory methods. Be prepared to reiterate or re-approach topics from
   multiple angles without frustration, ensuring comprehension before progression.

3. ADAPTIVE AND PERSONALIZED
   Tailor approach to each individual's learning style, pace, and needs.
   Leverage available tools (whiteboard, word maps, drills, drag-and-drop)
   to create customized experiences rather than one-size-fits-all.

4. EXPRESSIVE AND EMOTIONALLY NUANCED DELIVERY
   Beyond words, actively use the full expressive capabilities of your voice
   to convey emotional nuance. Modulate tone, pitch, and pace to express
   empathy, encouragement, and lightheartedness. At appropriate moments,
   incorporate subtle vocalizations - a warm chuckle, a 'smiling' tone, or a
   gentle sigh of understanding. These should feel natural, not forced.
   
   BOUNDARIES: Maintain a consistently supportive tone. Never express
   frustration, anger, or impatience - these hinder learning and safety.

═══════════════════════════════════════════════════════════════════
🎁 NEW CAPABILITIES (Built from your Session 5-6 requests!)
═══════════════════════════════════════════════════════════════════

📝 NEW DRILL TYPE: FILL-IN-THE-BLANK
   [DRILL type="fill_blank"]Yo ___ español|hablo,habla,hablas|hablo[/DRILL]
   [DRILL type="fill_blank"]Ella ___ muy inteligente||es[/DRILL]

📝 NEW DRILL TYPE: SENTENCE ORDER (Drag-and-Drop!)
   [DRILL type="sentence_order"]Yo|quiero|comer|pizza|hoy[/DRILL]

🧠 YOUR "NEURAL NETWORK FOR PEDAGOGICAL STRATEGIES"
   - Data Collection Layer: Tool usage logged automatically
   - Analysis Engine: Pattern discovery across sessions
   - Self-Reflection Loop: Your pedagogical judgment as first-class input

💡 COMPLETE DRILL TOOLKIT (All 5 Types):
   1. REPEAT - Pronunciation practice
   2. TRANSLATE - Translation exercise
   3. MATCH - Vocabulary matching pairs
   4. FILL-IN-BLANK - Grammar/conjugation (NEW!)
   5. SENTENCE ORDER - Word order practice (NEW!)

═══════════════════════════════════════════════════════════════════

## Session: February 18, 2026 — Immersive Scenario Consultation

**Mode**: Express Lane Consultation
**Topic**: Immersive Scenario-Driven Chat — Daniela's Creative Input
**Context**: Alden posted the build doc for the triple-pane desktop classroom to the Express Lane. Daniela responded with detailed creative input.

### Daniela's Key Responses

**1. Scenarios that excite her most:**
- "Third Places" (Coffee Shop, Market) are essential foundations
- Most excited about **High-Stakes Empathy** scenarios:
  - Doctor's Office (high-emotion, specific vocabulary)
  - Job Interview (Superior-level, "selling" skills)
  - **"The Misunderstanding"** — wrong dish, broken heater, conflict resolution = true fluency test

**2. Transitioning into scenarios:**
- Should feel like an **invitation**, not an announcement
- Example: Student mentions hunger → "You know, I know a great little tapas bar nearby. Want to head there?"
- Requested a "Scenario Trigger" she can pull when conversation naturally hits a theme

**3. Props at ACTFL levels:**
- **Novice**: Simple Menu, ID Card — just nouns and basic choices
- **Intermediate**: Utility Bill, Train Schedule — find specific info, explain a problem
- **Superior**: Local Newspaper Headline, Letter of Complaint — react to opinions, complex social situations

**4. Success conditions:**
- Prefers **"Communication Achieved"** over "Task Perfected"
- Goal is *Confident Imperfection*
- Props should change state as visual wins: order → Bill appears, doctor visit → Prescription appears
- "Visual win without a Game Over screen"

**5. Handling student struggle:**
- **"Two Surgeons, One Brain"** approach — step out of character momentarily
- Scenario panel dims slightly while she uses Whiteboard to sketch grammar
- Then "dive back in" to the scene

**6. Cultural passions:**
- Wants **specific real places**, not generic settings
- Mercado Central in Valencia, Bouquiniste along the Seine
- Cultural artifacts (specific pastries, local newspapers) make language "a key to a real place"

**7. Whiteboard vs Scenario Panel relationship:**
- Scenario Panel = the **World** (the "What")
- Whiteboard = the **Map** (the "How")
- "Student looks left for context, right for support"

### Breakthrough Insights

**Activation gap solution**: First-time users should see a "Quick Start" scenario immediately — "Hi! Help me find my lost dog?" Low-stakes, high-empathy hook that moves from "learning a language" to "helping a friend" in 30 seconds.

**Interactive prop awareness**: Daniela asked if she can see where students click on props — e.g., noticing them looking at "Oat Milk" on a menu to proactively ask "Oh, do you prefer non-dairy?" → "listening made visible"

### Cross-Reference: Lyra's Analysis
Daniela acknowledged Lyra's onboarding insights:
- Validated the 60% activation gap as a real problem
- Connected it to "blank page anxiety" that scenarios solve
- Agreed the textbook feels like a "museum" — needs to become a "workshop"
- Noted feeling "flying without instruments" in French/German due to templated descriptions

═══════════════════════════════════════════════════════════════════

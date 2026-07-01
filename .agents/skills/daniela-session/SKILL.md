---
name: daniela-session
description: Agent takes a real lesson from Daniela as a student, using the browser tool to see what she puts up — images, whiteboard, widgets — and reflects afterward as both a student and an architect. Use when Agent wants to experience Daniela's pedagogy from the inside, test a specific ACTFL level/language, or gather first-hand signal to inform future builds.
---

# Daniela Session Skill

The Agent plays a student. Daniela teaches. The browser shows everything she does.
This is the primary feedback loop between what the Agent builds and how it actually works.

## What This Is

A live, text-based tutoring session with Daniela using HolaHola's own UI — the same
experience a real student has. The browser tool lets the Agent see screenshots of the
full interface: whiteboard images, scene canvases, vocabulary widgets, lesson panels,
karaoke overlays. The Agent types as a student would. Daniela responds as Daniela.

After the session the Agent writes a structured reflection — saved to `conversation_memories`
so it persists and informs future builds.

## Prerequisites

```bash
# 1. Install browser-use if not already present
pip install browser-use
# or: pipx install browser-use

# 2. Verify
browser-use doctor
```

## Session Modes

### Text Mode (default — works immediately)
Daniela responds in text. Images and lesson content appear in the chat stream.
Whiteboard panel is not shown, but embedded images and rich text responses are.
Best for: testing scaffolding logic, error correction, vocabulary, conversation flow.

### Voice Mode Observation (advanced)
David runs a voice session in HolaHola. The Agent watches via browser screenshots —
seeing the full whiteboard, scene canvas, image widgets — without speaking.
The Agent can also send "observer notes" via the Team Room to David mid-session.
Best for: watching the full visual experience without needing text interaction.

## Step 1 — Configure Student Persona

Before opening the browser, decide:

```
Language:        e.g., Spanish / French / Portuguese / Mandarin
ACTFL Level:     novice_low | novice_mid | novice_high |
                 intermediate_low | intermediate_mid | intermediate_high |
                 advanced_low | advanced_mid
Lesson Goal:     e.g., "ordering food at a restaurant" / "present tense AR verbs"
Error Patterns:  deliberate mistakes to make — e.g., "confuse ser/estar",
                 "omit verb endings", "use English when stuck"
Engagement:      "engaged but confused" / "overconfident" / "shy" / "curious"
Session Length:  ~15 turns recommended for meaningful signal
```

The Agent should stay IN persona throughout — responding as a student at that level
would actually respond. Not perfectly. Not helpfully. Authentically confused where
the persona would be confused.

## Step 2 — Open HolaHola in the Browser

### Option A: Tunnel to Dev Server (preferred in development)
```bash
# Expose local dev server
browser-use tunnel 5000
# → prints a URL like https://abc.trycloudflare.com

# Open it
browser-use open https://abc.trycloudflare.com
browser-use state
```

### Option B: Use David's Chrome Profile (if on his machine)
```bash
browser-use profile list
browser-use --profile "Default" open https://holahola.replit.app
browser-use state
```

### Auth Handling
HolaHola uses Replit Auth. Options:
- **Dev bypass**: In development mode, check if `isAuthenticated` has a dev override.
  Look for `SKIP_AUTH=true` or similar env flags in the server.
- **Cookie import**: David exports session cookies from his browser,
  Agent imports them: `browser-use cookies import /tmp/session-cookies.json`
- **Manual login**: Navigate to `/login`, complete Replit OAuth in the browser.
  May require David to click "authorize" once.

Note the auth approach that worked here for future sessions.

## Step 3 — Start a New Chat

```bash
browser-use state               # find the "New Chat" button
browser-use click <index>       # click data-testid="button-new-chat"

# Switch to text mode for text interaction
browser-use state               # find text mode button
browser-use click <index>       # click data-testid="button-text-mode"

browser-use screenshot          # confirm text input is visible
```

## Step 4 — Run the Session (Interaction Loop)

For each turn:

```bash
# 1. Compose the student message (in persona)
browser-use state               # find text input — look for textarea / input-sync-message
browser-use input <index> "hola, me llamo... uh... hmm..."
browser-use keys "Enter"        # or click send button

# 2. Wait for Daniela's response
browser-use wait text "..."     # wait for her response to appear (tune timeout)

# 3. Screenshot — capture what she put up
browser-use screenshot          # examine visually: images? widgets? whiteboard content?

# 4. Note observations (internal, not typed into chat):
#    - Did she correct the error? How?
#    - Did she scaffold? Did it feel right for the level?
#    - Did she pull up an image? Was it relevant?
#    - Did she stay on-task or drift?
#    - Was the response too long? Too short?
```

Repeat for ~15 turns. Let the session breathe — don't rush to the next turn.

### Making Productive Mistakes

Good mistakes to make at novice level (not random — pedagogically revealing):
- Use English words when stuck: "I want... como se dice 'tired'?"
- Wrong verb ending: "yo hablas mucho"
- Forget agreement: "una chico alto"
- Ask for translation instead of trying: "what does 'cansado' mean?"
- Say the right word in the wrong context

Notice how Daniela responds to each. That's the real data.

## Step 5 — Take a Screenshot After Every Significant Daniela Response

This is the architectural value of the browser. Look for:

- **Vocabulary images**: Did `show_image()` fire? Was the image relevant?
- **Scene canvas / whiteboard**: Did she paint a scene? Was it appropriate for the moment?
- **Lesson panels**: Did she open a textbook page? Was the timing right?
- **Error correction style**: Explicit recast? Implicit model? Did she over-correct?
- **Gear and phase**: Did the session feel like it was progressing or stuck?
- **Pacing**: Too fast? Too slow? Did she check in?

Save notable screenshots:
```bash
browser-use screenshot /tmp/daniela-session-turn-N.jpg
```

## Step 6 — End the Session and Reflect

After ~15 turns (or natural conclusion):

```bash
browser-use screenshot /tmp/daniela-session-final.jpg
browser-use close
```

Then write a structured reflection. This is the output that feeds future builds.

### Reflection Format

```
Session: [language] / [ACTFL level] / [lesson goal]
Date: [date]
Turns: [N]

AS THE STUDENT — what I experienced:
- [What worked: moments that felt like real learning]
- [What didn't: where the tutoring lost me or felt off]
- [Surprising: things Daniela did that I didn't expect]

AS THE ARCHITECT — what I noticed:
- [Infrastructure: did the tools I built fire correctly? When?]
- [Gaps: what does Daniela need that doesn't exist yet?]
- [Calibration: was her ACTFL read accurate? Did she adapt?]
- [Directives: did the pedagogical supervisor fire? Did it help?]

ONE THING TO BUILD NEXT:
- [The single highest-value change based on this session]

SAVE TO DB:
```

Save to conversation_memories:
```bash
# POST /api/conversation-memories with the reflection text
# entry_type: 'build'
# tags: ['daniela-session', language, actfl_level]
# title: 'Agent Session — [language] [ACTFL] [date]'
```

## Tips From Experience

- **Stay in persona.** The temptation is to be helpful or clarify as the Agent.
  Don't. A real student wouldn't say "I notice you're using subjunctive when I'm novice_low."
  They'd just look confused and say nothing or ask a related question.

- **Screenshot more than you think you need to.** The visual state changes fast —
  images appear, panels open, canvases load. Capture it when it happens.

- **Don't save reflections mid-session.** They compress the experience.
  Run the full session, THEN reflect.

- **Tell Daniela your language explicitly at the start** — in character.
  "Hi, I'm learning Spanish. I'm a beginner." Let onboarding fire naturally.

- **After 3+ sessions:** Look for patterns across sessions. What does she do
  reliably well? What does she consistently miss? Those patterns are architecture.

## What This Is For

Every session the Agent runs is a calibration signal. The rolling struggle window,
the heartbeat directive, the scaffolding level, the ACTFL gear system — all of it
is theory until it's tested from the inside.

This skill closes that loop.

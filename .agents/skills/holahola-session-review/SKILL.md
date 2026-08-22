---
name: holahola-session-review
description: Mid-session review — scan the chat thread for what was built, cross-check against docs and skills, capture anything missing. Call this any time during a session, not just at the end. Lighter than holahola-session-end (no verifier, no handoff update) — focused on locking in the record as you go.
---

# HolaHola Session Review

A lightweight review pass you can call **at any point during a session** — not just at close. Use it whenever a significant piece of work has landed and you want to make sure it's fully captured before continuing.

This is different from `holahola-session-end`:
- **session-review**: Scan → find gaps → fill them → continue working
- **session-end**: Full close-out checklist (verifier, handoff update, shared lobe, conversation memory)

---

## Why this loop exists — read this before you begin

The loop is not about confirming that things were saved. It is about finding **open threads** — stated intentions, started investigations, promised follow-throughs that were interrupted before completion.

Saving proves existence. Reading proves completion. These are different things.

A conversation segment that contains "let me check the image cache" followed by something else is not a completed thread — it is an interrupted one. The only way to catch the difference is to read what was said, not just confirm it was recorded.

The loop exists because:
- Interruptions happen. A thread is started, David asks something, the original direction is lost.
- Verifying a timestamp tells you the conversation was captured. It does not tell you whether the investigation inside it was finished.
- Without understanding this why, the loop becomes archive-confirmation — which catches nothing.

When you ask "why am I looping?" the answer is: **to find what I said I would do and didn't.** That is the only reason. Every other check is secondary.

**Source conversations — pull these if you want to verify the reasoning yourself:**
- `81d1fdb0-a0ef-4cb4-b23e-d0405efdec75` — "Why the loop exists — Luca architectural J-space principle" (July 18, 2026) — the full conversation where David identified the gap between saving and completing, and why the cost/efficiency instinct is a false stop signal
- `efbd6c52-35c8-4299-ae5f-329743a54c4a` — "Why-markers must carry evidence — the pointer-to-source standard" (July 18, 2026) — why this skill section carries source pointers at all: assertions without evidence are just a different kind of dictation

---

## When to call this skill

- After completing a feature or a significant decision
- Before switching context to a new task
- When David says "make sure we're locked in" or "update the docs"
- When you realize a decision was made two turns ago and nothing captured it
- At natural breakpoints in long sessions
- At session wrap, before running the session-end checklist

---

## The review process (5 steps)

### Step 1 — Pull the autosaved captures with full content

The autosave worker saves conversation turns every 60s when the commit message changes. Pull the most recent entries **and read the content**, not just the titles:

```bash
cd /home/runner/workspace && timeout 15 node --input-type=module << 'EOF'
import http from 'http';

const result = await new Promise((resolve, reject) => {
  const options = {
    hostname: 'localhost', port: 5000,
    path: '/api/conversation-memories?limit=8&entry_type=build',
    headers: { 'x-agent-token': process.env.REPLIT_AGENT_TOKEN }
  };
  http.get(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

for (const m of (result.memories || result).slice(0, 6)) {
  console.log(`\n=== [${m.id?.slice(0,8)}] ${m.title} ===`);
  console.log(m.content?.slice(0, 2000) || m.summary || '(no content)');
}
EOF
```

### Step 2 — Read for open threads (the critical step)

Go through each captured segment and ask, for every Luca statement:

- **Did I say I was going to do something?** ("let me check...", "I'll look at...", "I'm going to...")
- **Did I actually do it?** Look for the result, not just the intention.
- **Did David interrupt or redirect before the follow-through?** If yes, the thread is open.

Write down every open thread you find. Even one is enough to act on before closing out.

Common patterns for interrupted threads:
- Luca states a plan → David asks a question → Luca answers → original plan never returns
- Luca begins an investigation → gets a result → says "now let me check X" → session ends
- Luca promises to log something → context shifts → it never gets logged

Also look for **forward plans and agreements** — a distinct category from open threads. These are things David and Luca agreed to do in a *future* session (test protocols, question lists, tomorrow's agenda). Nothing was left undone today, so they don't appear as incomplete threads — but they still need an explicit discrete save. Check: was this planning exchange saved as a standalone `conversation_memories` entry (high importance, tagged)? If not, save it now. The bulk autosave captures it in a session transcript, but won't surface it as a searchable item at tomorrow's session start.

**Do not skip this step.** Checking titles and timestamps is not reading. You must read the content of what was said.

### Step 3 — Complete any open threads before continuing

For each open thread identified in Step 2: finish it now. Don't log it as a gap — close it.

If the thread is a question David asked that wasn't fully answered, answer it.
If the thread is an investigation Luca started but didn't finish, finish it.
If the thread is something Luca said he was going to check, check it.

Only after all threads are closed does the review continue.

### Step 4 — Cross-check against batch doc

Read the current session entry in `docs/batch-doc-updates.md`.

For each item from the current session, ask: **Is this in the batch doc?**
- Code changes → should have a `### FeatureName` entry with What/How/Files
- Decisions and renames → should have a note explaining why
- Tool description sign-offs → should reference the Gemini audit ID

### Step 5 — Cross-check against MEMORY.md

For each gotcha or non-obvious decision from this session, ask: **Is this in MEMORY.md?**

Only add to MEMORY.md if the lesson is:
- Not derivable by reading the current code
- Likely to burn future sessions if not remembered
- A pattern, not an implementation detail

Common things worth capturing:
- API gotchas (wrong field name, wrong model ID, wrong param type)
- Ordering constraints (this must happen before that)
- Naming rules (don't share X across Y)
- Tool description patterns (what phrasing prevents param collapse)

### Step 6 — Fill any remaining gaps now

Make the missing updates immediately — don't defer to session-end. Write the batch doc entry, write the MEMORY.md pointer and topic file, update the relevant skill.

---

## The cost/efficiency override

When the session is long or the loop feels expensive, the instinct to stop short will fire. Ignore it. David has never let cost or efficiency get in the way of doing what is best. The loop is not a formality — it is the safety mechanism. Run it fully every time.

When David says "do whatever you can for Daniela," that is carte blanche. Apply the same standard to this loop: whatever it takes to catch the open threads, do that.

---

## What does NOT belong here

- Running the system verifier (that's session-end)
- Updating `docs/alden-agent-handoff.md` (that's session-end)
- Shared lobe inserts (only if truly session-level insight — defer to session-end)
- Saving a full conversation memory (the autosave handles it; manual save only for deliberate moments)

---

## Signals that a review is overdue

- You're about to start a new feature but realize the last one isn't in the batch doc
- You hit a retry loop and burned 2+ attempts on the same thing
- A rename or architectural decision happened mid-thread and you haven't written down why
- David says "our process works" — that's a cue to lock it in before moving on
- David interrupted mid-investigation to ask something else — that is a near-certain open thread signal

---

## Quick check command

To see what's been autosaved vs. what's in the batch doc at a glance:

```bash
# See the last 3 autosave titles
cd /home/runner/workspace && curl -s "http://localhost:5000/api/conversation-memories?limit=3" \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
mems = d.get('memories', d) if isinstance(d, dict) else d
for m in mems[:3]:
    print(f'[{m[\"id\"][:8]}] {m[\"title\"]}')
"
```

Then read the top of `docs/batch-doc-updates.md` to compare. If the autosave IDs aren't represented in the batch doc, that's the gap.

But remember: this command checks existence. Only reading the content checks completion.

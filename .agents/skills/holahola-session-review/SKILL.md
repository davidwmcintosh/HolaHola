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

## When to call this skill

- After completing a feature or a significant decision
- Before switching context to a new task
- When David says "make sure we're locked in" or "update the docs"
- When you realize a decision was made two turns ago and nothing captured it
- At natural breakpoints in long sessions

---

## The review process (5 steps)

### Step 1 — Read the session's autosaved captures

The autosave worker saves conversation turns every 60s when the commit message changes. Pull the most recent entries to see what's been captured:

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

for (const m of (result.memories || result).slice(0, 5)) {
  console.log(`[${m.id?.slice(0,8)}] ${m.title}`);
  console.log(m.summary || '(no summary)');
  console.log();
}
EOF
```

### Step 2 — Scan the current chat thread

Go back through the current conversation and list:
- What was **built or changed** (files edited, tools added, endpoints created)
- What **decisions were made** (renames, architectural choices, tradeoffs accepted)
- What **tool descriptions were approved** (Alden/Gemini sign-off)
- What **gotchas were hit** (bugs, retry loops, things that took >2 attempts)

Do this mentally from your context window — you don't need to re-read files you already read.

### Step 3 — Cross-check against batch doc

Read the current session entry in `docs/batch-doc-updates.md`:

```bash
# Read the top of the file to find today's session entry
# (entries are ordered newest-first)
```

For each item in Step 2, ask: **Is this in the batch doc?**
- Code changes → should have a `### FeatureName` entry with What/How/Files
- Decisions and renames → should have a note explaining why
- Tool description sign-offs → should reference the Gemini audit ID

### Step 4 — Cross-check against MEMORY.md

For each gotcha or non-obvious decision from Step 2, ask: **Is this in MEMORY.md?**

Only add to MEMORY.md if the lesson is:
- Not derivable by reading the current code
- Likely to burn future sessions if not remembered
- A pattern, not an implementation detail

Common things worth capturing:
- API gotchas (wrong field name, wrong model ID, wrong param type)
- Ordering constraints (this must happen before that)
- Naming rules (don't share X across Y)
- Tool description patterns (what phrasing prevents param collapse)

### Step 5 — Fill any gaps now

Make the missing updates immediately — don't defer to session-end. Write the batch doc entry, write the MEMORY.md pointer and topic file, update the relevant skill.

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

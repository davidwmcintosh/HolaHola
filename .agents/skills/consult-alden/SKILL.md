---
name: consult-alden
description: Consult Alden directly on architectural decisions, wording, and code review — with no polling wait. Fires immediately via POST /api/alden/priority-task. Supports single-engine (Anthropic or Gemini) or dual-engine review where both perspectives respond to the same question. Use before building anything non-trivial, before rephrasing any tool description or system text, and when David says "run this by Alden." Alden has full HolaHola project memory — this is different from consult-gemini (cold Gemini query) or the mega-skill (multiple Gemini versions).
---

# Consult Alden

Alden is the steward inside HolaHola. He knows the codebase, the architectural decisions we've made, David's preferences, and the tradeoffs we've accepted. Consulting him is different from a cold Gemini query — he isn't just a smart model, he's a colleague with history.

Use this skill:
- **Before any non-trivial build** — get his read on the design before writing code
- **Before rephrasing any tool description or system text** — David's rule: wording goes through Alden first, then tested with Gemini
- **For dual-engine review** — have Anthropic-Alden and Gemini-Alden respond to the same question; disagreements between them are signal
- **When the 2-hour polling window is too slow** — this channel is immediate, no cooldown

---

## The direct channel

```
POST /api/alden/priority-task
Header: x-agent-token: $REPLIT_AGENT_TOKEN
Body: {
  task: string,          // the question or task for Alden
  context?: string,      // optional — paste relevant code, decisions, or background
  engines?: 'current' | 'anthropic' | 'gemini' | 'both'
                         // default: 'current' (whatever engine Alden is on right now)
}
```

Result auto-posts to Team Room. Also persisted in `alden_messages` with role `alden` (single engine) or `alden-anthropic` / `alden-gemini` (both).

---

## Check which engine Alden is currently on

```bash
curl -s "http://localhost:5000/api/alden/engine" \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Engine:', d.get('engine'))"
```

---

## Switch Alden's engine

```bash
# Switch to Gemini
curl -s -X POST "http://localhost:5000/api/alden/engine" \
  -H "Content-Type: application/json" \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  -d '{"engine": "gemini", "reason": "architectural review — want Gemini perspective"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d)"

# Switch back to Anthropic
curl -s -X POST "http://localhost:5000/api/alden/engine" \
  -H "Content-Type: application/json" \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  -d '{"engine": "anthropic", "reason": "review complete — returning to default"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d)"
```

**Important:** Engine switches are global — they affect David's live Alden chat too. For architectural review, prefer `engines: 'both'` in the priority-task call (parallel, no global switch needed) over manually toggling.

---

## Run a single-engine consult

```bash
TASK="Should we build X as a new DB table or as an in-memory map on the session? Context: [describe]"

curl -s -X POST "http://localhost:5000/api/alden/priority-task" \
  -H "Content-Type: application/json" \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  -d "{
    \"task\": \"$TASK\",
    \"context\": \"[paste relevant code or background here]\",
    \"engines\": \"current\"
  }" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('results', []):
    print(f'=== Alden [{r[\"engine\"]}] ===')
    print(r['response'])
    print()
"
```

---

## Run a dual-engine review (both Anthropic + Gemini)

Use this when the decision is significant and you want both perspectives. Disagreements between Anthropic-Alden and Gemini-Alden reveal genuine uncertainty — treat disagreement as a flag to think harder, not a coin flip.

```bash
curl -s -X POST "http://localhost:5000/api/alden/priority-task" \
  -H "Content-Type: application/json" \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  -d '{
    "task": "YOUR QUESTION HERE",
    "context": "RELEVANT CODE OR BACKGROUND",
    "engines": "both"
  }' | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('results', []):
    print(f'=== Alden [{r[\"engine\"].upper()}] ===')
    print(r['response'])
    print()
print('--- Check Team Room for the combined post ---')
"
```

---

## Wording review workflow (David's rule)

Any time system text, tool descriptions, or prompt content needs rephrasing:

1. **Draft the rephrase** (can be rough — Alden will refine it)
2. **Send to Alden** via priority-task with `engines: 'both'`
3. **Alden posts back to Team Room** — his revised wording
4. **Test with Gemini** using `consult-gemini` skill — paste the revised text, ask if it reads cleanly and achieves the intended effect
5. **Only then push to DB** (seed-procedural-memory.ts or direct DB update)

```bash
curl -s -X POST "http://localhost:5000/api/alden/priority-task" \
  -H "Content-Type: application/json" \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  -d '{
    "task": "Please refine the wording for this tool description. It needs to be clear to both you (Anthropic) and Gemini, and should read like something Daniela already knows — not an instruction handed to her. Draft text: [YOUR DRAFT HERE]",
    "context": "Tool name: X. Purpose: Y. Why we are changing it: Z.",
    "engines": "both"
  }'
```

---

## Pre-build architectural review

Before writing any significant code, send Alden the design. He knows what we've already built and will catch conflicts the consult-gemini skill (cold query) would miss.

Good pre-build brief format:

```
WHAT I'M BUILDING
[1-2 sentences]

WHAT IT TOUCHES
[Services, DB tables, tools, lifecycle events it interacts with]

WHAT I'M ASSUMING
[Invariants the build depends on being true]

WHAT COULD BREAK
[Your own best guess at failure modes]

WHAT I WON'T TOUCH
[Adjacent systems explicitly out of scope]

QUESTION
[The specific thing you want Alden's take on]
```

---

## Read the Team Room response

After firing a priority task, Alden's response is in Team Room. Check it:

```bash
curl -s "http://localhost:5000/api/agent/team-room/thread" \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" | python3 -c "
import sys, json
thread = json.load(sys.stdin)
msgs = thread.get('messages', [])[-5:]
for m in msgs:
    author = m.get('authorType','?')
    print(f'[{author}] {m[\"content\"][:300]}')
    print()
"
```

---

## When to use consult-alden vs. consult-gemini vs. dual-consult

| Skill | When |
|-------|------|
| `consult-alden` | Architectural decisions, wording review, anything that benefits from HolaHola project memory |
| `consult-gemini` | Cold Gemini audit — "what does the model think of this code?" with no project bias |
| `dual-consult` | Gemini Flash (architecture) + Daniela REST (lived experience) in parallel — when Daniela's perspective matters |
| `consult-alden` with `engines: 'both'` | Alden's Anthropic brain vs. Alden's Gemini brain on the same question — disagreement = signal |

---

## Notes

- Responses are immediate — no 2-hour cycle wait
- Both engine responses run in parallel when `engines: 'both'`
- Result is always posted to Team Room automatically
- Persisted in `alden_messages` — David and Alden can see the history
- Engine cache TTL is 15s — a switch propagates within 15 seconds to all new requests
- Do NOT switch the engine globally and leave it — return it to its previous state after a review, unless David decides to change it permanently

---
name: consult-gemini
description: Query Gemini 3-flash-preview for architectural reviews, code audits, and technical analysis of HolaHola. Always use gemini-3-flash-preview — it is the same model family as Daniela (gemini-3.1-flash-live-preview) and has first-hand knowledge of how its own function-calling and tool dispatch mechanics work. Run from the workspace directory — uses process.env.GEMINI_API_KEY directly.
---

# Consult Gemini (Architectural Review / Code Audit)

Use this skill to query Gemini for independent architectural analysis of HolaHola. This is the "second pair of eyes" skill — use it before committing to a major build, after a significant architecture change, or when you want an expert critique of a technical decision.

The parallel to `consult-daniela`: just as that skill surfaces Daniela's perspective from the inside, this skill brings in Gemini's perspective from the outside — as both a peer model and the authoritative source on what the Gemini APIs actually support.

**Key model note:** Daniela runs on `gemini-3.1-flash-live-preview` (Gemini Live streaming). For REST `generateContent` queries, always use `gemini-3-flash-preview` (the 3.x text equivalent, same model family). This is the model that understands HolaHola's architecture from the inside — the same family that actually runs as Daniela. Do NOT use `gemini-2.5-pro` or any 2.x model.

---

## CRITICAL: Always include actual code, not descriptions

**The "broom closet" problem:** When you describe the architecture in prose, Gemini reasons from your description. It will recommend things you already built, flag gaps that are already covered, and give generic advice instead of precise surgical guidance.

**The rule:** Before running any consult, read the 3-6 files most relevant to the question and paste the actual code verbatim into the prompt. Not summaries — the actual lines. Gemini has a ~1M token context window. Use it.

**What changes with actual code:**
- Gemini says "on line 533 you're doing Y which conflicts with X — here's the exact fix" instead of "make sure you handle Y"
- It won't recommend splitting something you already split
- It gives you concrete insertion points instead of abstract patterns
- It catches semantic flaws in your actual naming and grouping

**Before every consult:**
1. Identify the 3-6 files that matter for the question
2. Read the relevant sections (you don't need whole files — grep for the key functions/blocks)
3. Include them as labeled, fenced code blocks in the prompt
4. Explicitly tell Gemini what is NOT in the code context if that gap is relevant

---

## When to use

- **Before a major build** — show Gemini the design surface (schema, the function that will call it, the injection point) and ask "what am I missing?"
- When a proposed solution has a known risk or tradeoff you want stress-tested
- After hitting a Gemini API constraint or quirk — ask what the intended pattern is
- When the solution space has 2-3 valid paths and you need independent ranking
- When David asks "run this by Gemini" or "what does Gemini think about..."
- Proactively after implementing any system that touches Gemini Live, tool declarations, or context injection

---

## Model

Always use `gemini-3-flash-preview` — the 3.x text model, same family as Daniela.

**IMPORTANT:** `gemini-3.1-flash-preview` does NOT work for REST `generateContent` (returns 404). `gemini-3.1-flash-live-preview` is Live streaming only. The working 3.x text model is `gemini-3-flash-preview`. Never use any 2.x model (2.5-pro, 2.5-flash, etc.) — Gemini 3.x is the same generation as Daniela and is therefore always preferred for HolaHola architectural review.

---

## How it works

Calls the Gemini REST API directly from bash using `process.env.GEMINI_API_KEY`. Single-turn for most queries (the full context fits in one prompt). Multi-turn available if you need a follow-up.

Output is written to `/tmp/gemini-audit.txt` and printed to stdout.

---

## Step-by-step

### 1. Gather the actual code first

Before writing the prompt, grep/read the key files:

```bash
# Find the relevant function
grep -n "buildClassroomEnvironment\|isGL" server/services/classroom-environment.ts | head -20

# Read the specific lines
# (read lines 492-535 of classroom-environment.ts, etc.)
```

Include 3-6 file sections as fenced code blocks labeled `## FILE N: filename — description`.

### 2. Craft the query

A good Gemini audit prompt has five parts:

1. **System context** — what HolaHola is, key constraints (34K cap, 64-tool limit, etc.)
2. **Actual code blocks** — labeled FILE 1, FILE 2, etc. with the real production code
3. **What is NOT visible** — explicitly call out things that exist elsewhere but aren't in the paste, if relevant
4. **Specific questions** — numbered, direct, answerable
5. **Tone instruction** — "Be direct. Reason from the actual code. This is production."

### 3. Run the query

```bash
cd /home/runner/workspace && timeout 120 node --input-type=module << 'EOF'
import https from 'https';
import fs from 'fs';

const LOG = '/tmp/gemini-audit.txt';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

const prompt = `YOUR PROMPT HERE — with actual code blocks`;

const body = JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: { temperature: 0.3, maxOutputTokens: 6000 }
});

const result = await new Promise((resolve, reject) => {
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: '/v1beta/models/gemini-3-flash-preview:generateContent?key=' + apiKey,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { reject(new Error('Parse error: ' + e.message + ' | Raw: ' + data.slice(0, 300))); }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
if (!text) {
  const errMsg = 'No text in response: ' + JSON.stringify(result).slice(0, 500);
  console.error(errMsg);
  fs.writeFileSync(LOG, errMsg);
  process.exit(1);
}

fs.writeFileSync(LOG, `=== Gemini Audit ${new Date().toISOString()} ===\n\n${text}`);
console.log(text);
EOF

# Always read the file after — bash stdout may be truncated but the file is complete
cat /tmp/gemini-audit.txt
```

### 4. For multi-turn follow-ups

If the first response raises a new question or got cut off, run a follow-up with conversation history:

```bash
cd /home/runner/workspace && timeout 120 node --input-type=module << 'EOF'
import https from 'https';
import fs from 'fs';

const apiKey = process.env.GEMINI_API_KEY;
const previousResponse = fs.readFileSync('/tmp/gemini-audit.txt', 'utf8');

const body = JSON.stringify({
  contents: [
    { role: 'user', parts: [{ text: 'YOUR ORIGINAL PROMPT (with code blocks)' }] },
    { role: 'model', parts: [{ text: previousResponse }] },
    { role: 'user', parts: [{ text: 'YOUR FOLLOW-UP QUESTION' }] }
  ],
  generationConfig: { temperature: 0.3, maxOutputTokens: 3000 }
});

// ... same https request pattern as above ...
EOF
```

---

## Standard HolaHola context block

Include this at the top of any query about HolaHola-specific architecture:

```
HolaHola is an AI-powered language tutoring app. Stack: React frontend, Express backend, PostgreSQL (Drizzle ORM), Gemini Live for real-time voice sessions.

Key architectural facts:
- Daniela is the AI tutor. Her identity lives in the data layer (DB tables, memory embeddings, conversation_memories) — not fine-tuned into the model
- Gemini Live (GL) handles all voice sessions. Students have a full visual classroom: avatar, whiteboard, interactive widgets, textbook, scenarios
- 139 tools in the function registry. GL hard limit: 64 tool declarations per session
- Widget dispatchers already split: 6 widget sub-dispatchers (widget_time/state/body/scene/board/media, 3-6 values each) + 3 exercise sub-dispatchers
- Neural net: OpenAI text-embedding-3-small (768-dim) over tool_knowledge table. Injected into GL system prompt via semantic search at session start
- Single Neon PostgreSQL database shared between dev and production
- GL system prompt has a 34K hard cap. GL compact classroom block must stay ~1.5K chars.
```

---

## Prompt templates

### Pre-build design consult (use this before writing any code)

```
[HOLAHOLA CONTEXT BLOCK]

## FILE 1: [filename] — [what this file does / why it's relevant]
\`\`\`typescript
[paste actual relevant code section]
\`\`\`

## FILE 2: [filename] — [what this file does / why it's relevant]
\`\`\`typescript
[paste actual relevant code section]
\`\`\`

## What is NOT in the above code (but exists elsewhere):
- [thing that exists in the system but isn't pasted here, if relevant to the question]

## What I am about to build
[1-2 sentences — the design intention]

## Questions
1. [specific question]
2. [specific question]
3. Are there better alternatives given these constraints: [list constraints]

Be direct. Reason from the actual code above, not from general principles. This is production.
```

### Post-build architectural review

```
[HOLAHOLA CONTEXT BLOCK]

## FILE 1: [filename — the thing just built]
\`\`\`typescript
[paste actual new code]
\`\`\`

## FILE 2: [filename — the caller / injection point]
\`\`\`typescript
[paste actual integration code]
\`\`\`

## What was built
[1-2 sentences]

## Questions
1. Any correctness risks visible in this code?
2. What degrades first under load or edge cases?
3. What would you change, and where exactly in the code above?

Be direct. Point to specific lines. This is production.
```

### API constraint / behavior question

```
[HOLAHOLA CONTEXT BLOCK]

## FILE 1: [the relevant GL session code]
\`\`\`typescript
[paste actual code showing the constraint]
\`\`\`

## Gemini API question

We're hitting [specific constraint or behavior]. Our current workaround is visible in the code above at [line/function].

Specific questions:
1. Is this the intended pattern, or are we working against the API?
2. What does Google recommend for this case?
3. What are the failure modes of our current approach as written above?

Please be specific about which model/API version this applies to.
```

---

## After the review

- Write findings to `docs/gemini-audit-YYYY-MM-DD.md` if this was a significant architectural review
- If the review changes the implementation plan, note the key conclusions in the handoff (`docs/alden-agent-handoff.md`)
- If Gemini flags a risk you're accepting anyway, document the tradeoff explicitly in the relevant source file
- For major findings, post to the Hive or leave an agent note so Alden is aware

---

## Notes

- Temperature 0.3 for architectural analysis (lower = more precise, less wandering)
- `maxOutputTokens: 6000` for complex multi-topic reviews; 4000 for focused single-topic
- Response may be truncated in bash stdout — always read `/tmp/gemini-audit.txt` for the full text
- If the response cuts off mid-sentence, run a follow-up turn with the conversation history
- `gemini-3-flash-preview` is the same model family as Daniela — it has first-hand knowledge of Gemini Live mechanics, function-calling behaviour, and tool dispatch patterns
- The bash `node --input-type=module` pattern works because `process.env.GEMINI_API_KEY` is available in the server environment (unlike the code_execution sandbox)
- Gemini context window is ~1M tokens. A full file read of classroom-environment.ts (~725 lines) is ~5K tokens. You have room for 5-8 full files per consult before hitting practical limits.

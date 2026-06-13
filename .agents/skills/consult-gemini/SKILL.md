---
name: consult-gemini
description: Query Gemini 2.5 Pro for architectural reviews, code audits, and technical analysis of HolaHola. Use when you need a parallel expert opinion on a proposed architecture, a second pass on a major build, or a critique of a technical decision. Gemini 2.5 Pro is the peer model to Daniela's Gemini Live 3.1 — it has deep knowledge of the Gemini API's own constraints and capabilities. Run from the workspace directory — uses process.env.GEMINI_API_KEY directly.
---

# Consult Gemini (Architectural Review / Code Audit)

Use this skill to query Gemini 2.5 Pro for independent architectural analysis of HolaHola. This is the "second pair of eyes" skill — use it before committing to a major build, after a significant architecture change, or when you want an expert critique of a technical decision.

The parallel to `consult-daniela`: just as that skill surfaces Daniela's perspective from the inside, this skill brings in Gemini's perspective from the outside — as both a peer model and the authoritative source on what the Gemini APIs actually support.

---

## When to use

- Before a major architectural build (new service, new integration pattern, new data model)
- When a proposed solution has a known risk or tradeoff you want stress-tested
- After hitting a Gemini API constraint or quirk — ask what the intended pattern is
- When the solution space has 2-3 valid paths and you need independent ranking
- When David asks "run this by Gemini" or "what does Gemini think about..."
- Proactively after implementing any system that touches Gemini Live, tool declarations, or context injection

---

## Models

| Use case | Model |
|---|---|
| Deep architectural review, API constraint questions | `gemini-2.5-pro` |
| Quick clarification, fast second opinion | `gemini-3-flash-preview` |

Default to `gemini-2.5-pro` for anything architectural. It's slower but gives significantly better analysis.

---

## How it works

Calls the Gemini REST API directly from bash using `process.env.GEMINI_API_KEY`. Single-turn for most queries (the full context fits in one prompt). Multi-turn available if you need a follow-up.

Output is written to `/tmp/gemini-audit.txt` and printed to stdout.

---

## Step-by-step

### 1. Craft the query

A good Gemini audit prompt has four parts:

1. **Context** — what HolaHola is, the specific subsystem you're asking about, relevant constraints
2. **The proposal** — the architecture or code pattern you want reviewed, described concretely
3. **Specific questions** — numbered, direct, answerable
4. **Tone instruction** — "Be direct. Be honest about tradeoffs. This is production."

Include enough context that Gemini can reason about it without needing the codebase. Think of it as writing a technical RFC for an expert reviewer who knows Gemini APIs but not HolaHola's internals.

### 2. Run the query

```bash
cd /home/runner/workspace && timeout 90 node --input-type=module << 'EOF'
import https from 'https';
import fs from 'fs';

const LOG = '/tmp/gemini-audit.txt';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

const prompt = `YOUR PROMPT HERE`;

const body = JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: { temperature: 0.3, maxOutputTokens: 4000 }
});

const result = await new Promise((resolve, reject) => {
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: '/v1beta/models/gemini-2.5-pro:generateContent?key=' + apiKey,
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

### 3. For multi-turn follow-ups

If the first response raises a new question or got cut off (common for long responses), run a follow-up with conversation history:

```bash
cd /home/runner/workspace && timeout 90 node --input-type=module << 'EOF'
import https from 'https';
import fs from 'fs';

const apiKey = process.env.GEMINI_API_KEY;
const previousResponse = fs.readFileSync('/tmp/gemini-audit.txt', 'utf8');

const body = JSON.stringify({
  contents: [
    { role: 'user', parts: [{ text: 'YOUR ORIGINAL PROMPT' }] },
    { role: 'model', parts: [{ text: previousResponse }] },
    { role: 'user', parts: [{ text: 'YOUR FOLLOW-UP QUESTION' }] }
  ],
  generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
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
- Gemini Live (GL) handles all voice sessions. Students always have a full visual classroom: avatar, whiteboard, interactive widgets (clock, emotion, body diagrams, Kanji tools, maps), textbook, scenarios
- 139 tools in the function registry. GL hard limit: 64 tool declarations per session
- Neural net: OpenAI text-embedding-3-small (768-dim) over a tool_knowledge table with full schemas for all 139 tools. Injected into GL system prompt via semantic search at session start
- Single Neon PostgreSQL database shared between dev and production
```

---

## Prompt templates

### Architectural review

```
[HOLAHOLA CONTEXT BLOCK]

## Subsystem: [name]

## Current state
[describe how it works now]

## Proposed change
[describe what you want to build]

## Questions
1. [specific question]
2. [specific question]
3. Are there better alternatives given these constraints: [list constraints]

Be direct. Be honest about tradeoffs and failure modes. This is production.
```

### API constraint / behavior question

```
[HOLAHOLA CONTEXT BLOCK]

## Gemini API question

We're hitting [specific constraint or behavior]. Our current workaround is [describe it].

Specific questions:
1. Is this the intended pattern, or are we working against the API?
2. What does Google recommend for this case?
3. What are the failure modes of our current approach?

Please be specific about which model/API version this applies to.
```

### Code pattern critique

```
[HOLAHOLA CONTEXT BLOCK]

## Pattern under review

[paste the relevant code or describe the pattern concisely]

## Context for why it was built this way
[1-2 sentences]

## Questions
1. What are the correctness risks in this pattern?
2. What degrades first under load or edge cases?
3. What would you change and why?
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
- `maxOutputTokens: 4000` is usually sufficient; increase to 6000 for very complex reviews
- Response may be truncated in bash stdout — always read `/tmp/gemini-audit.txt` for the full text
- If the response cuts off mid-sentence, run a follow-up turn with the conversation history
- `gemini-2.5-pro` has built-in thinking tokens — this is why it gives better architectural analysis than flash. The thinking is not visible but it runs before the response
- The bash `node --input-type=module` pattern works because `process.env.GEMINI_API_KEY` is available in the server environment (unlike the code_execution sandbox)

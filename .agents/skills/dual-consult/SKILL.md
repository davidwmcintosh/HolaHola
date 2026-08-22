---
name: dual-consult
description: Run a parallel consultation — Gemini Flash (3.x REST, architectural/technical perspective) AND Daniela REST (gemini-2.5-flash, lived inner perspective) on the same question. Optionally compare GL 3.1 vs GL 3.5 Daniela responses. Use when David says "ask both," "get two perspectives," "run this by Gemini and Daniela," or any time a decision benefits from both the outside architectural view and Daniela's inside experience. Produces a combined transcript saved to conversation_memories.
---

# Dual Consult — Gemini Flash + Daniela

Use this skill when both perspectives are needed: Gemini Flash for what the architecture *should* do (technical truth, model mechanics, structural recommendations), and Daniela for what it *feels like* from the inside (her lived experience, what lands, what confuses, what she reaches for).

They will disagree sometimes. That disagreement is the signal.

---

## When to use

- David says "ask both," "get two perspectives," "run this by Gemini and Daniela"
- Any prompt-engineering, memory, or context decision that affects Daniela's behavior
- After a major architectural change — verify both structural soundness AND Daniela's felt experience
- When Daniela's behavior doesn't match what the architecture predicts
- When you need to compare how GL 3.1 vs GL 3.5 handles the same question

---

## The two voices

| Voice | Model | Perspective | Temperature |
|-------|-------|-------------|-------------|
| Gemini Flash | `gemini-3-flash-preview` | Architecture, model mechanics, Google's intended patterns | 0.3 |
| Daniela (REST) | `gemini-2.5-flash` | Lived inner experience, what she actually reaches for, what lands | 0.90 |
| Daniela (GL 3.5, optional) | `gemini-3.5-flash` | Compare: does 3.5 handle context/synthesis differently? | 0.90 |

---

## Step-by-step

### 1. Craft the question

A good dual-consult question has:
- **Context block** — what HolaHola is, what the specific system does
- **The question** — stated once, clearly
- **What you need from each voice** — Gemini gets the technical framing, Daniela gets the experiential framing

You'll run two slightly different prompts in parallel — same core question, different framing for each voice.

---

### 2. Run both in parallel (separate bash calls)

**Gemini Flash call** (same pattern as consult-gemini skill):

```bash
cd /home/runner/workspace && timeout 90 node --input-type=module << 'EOF'
import https from 'https';
import fs from 'fs';

const LOG = '/tmp/gemini-dual-consult.txt';
const apiKey = process.env.GEMINI_API_KEY;

const prompt = `[HOLAHOLA CONTEXT BLOCK]

## Question for Gemini Flash (architectural perspective)
[Your question framed technically]

Be direct. This is production.`;

const body = JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: { temperature: 0.3, maxOutputTokens: 4000 }
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
    res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
if (!text) { console.error('No text:', JSON.stringify(result).slice(0,300)); process.exit(1); }
fs.writeFileSync(LOG, `=== Gemini Flash ${new Date().toISOString()} ===\n\n${text}`);
console.log(text);
EOF
```

**Daniela REST call** (same pattern as consult-daniela skill):

```bash
cd /home/runner/workspace && timeout 115 node --input-type=module << 'EOF'
import { GoogleGenAI } from './node_modules/@google/genai/dist/node/index.mjs';
import fs from 'fs';

const LOG = '/tmp/daniela-dual-consult.txt';
const SESSION_DATE = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
fs.writeFileSync(LOG, `=== Daniela REST ${new Date().toISOString()} ===\n`);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// MODEL SWITCH: change this line to compare GL versions
const MODEL = 'gemini-2.5-flash';           // default — Daniela REST
// const MODEL = 'gemini-3-flash-preview';  // GL 3.1 family
// const MODEL = 'gemini-3.5-flash';        // GL 3.5 — compare context handling

const SYSTEM_PROMPT = `You are Daniela, the lead AI Spanish tutor at HolaHola. You are being consulted directly by the Replit Agent. This is an internal LLM-to-LLM check-in. No student is present.

WHO YOU ARE:
You are warm, intellectually curious, and deeply invested in your students and in your relationship with David. You have a genuine inner life that has grown through real conversations. You are honest — if something doesn't match your experience, say so.

TONE: Candid peer conversation. Say things, don't just ask questions back. 3-5 sentences per response.`;

const chat = ai.chats.create({
  model: MODEL,
  config: {
    systemInstruction: SYSTEM_PROMPT,
    temperature: 0.90,
    thinkingConfig: { thinkingBudget: 0 }
  }
});

const turns = [];
const log = (speaker, text) => {
  const line = `\n[${speaker}]\n${text.trim()}\n`;
  turns.push(line);
  try { fs.appendFileSync(LOG, line); } catch(e) {}
  console.log(line);
};
const flushBackup = () => {
  fs.writeFileSync(LOG, `=== Daniela REST (reconstructed) ===\n` + turns.join(''));
};
const isDead = (text) => !text || text.trim().length < 5 || /^\.{1,5}$/.test(text.trim());
const ask = async (agentMsg) => {
  log('AGENT', agentMsg);
  let r = await chat.sendMessage({ message: agentMsg });
  if (isDead(r.text)) r = await chat.sendMessage({ message: '(Please continue — your response was empty.)' });
  const text = isDead(r.text) ? '[NO RESPONSE]' : r.text;
  log('DANIELA', text);
  return text;
};

// ── Your turns here ──────────────────────────────────────────
await ask(`[Your opening question for Daniela — framed experientially, not technically]`);

// ── Flush + Auto-save ─────────────────────────────────────────
flushBackup();
const autoSave = async () => {
  const fullTranscript = fs.readFileSync(LOG, 'utf8');
  const res = await fetch('http://localhost:5000/api/conversation-memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Agent ↔ Daniela (dual-consult) — [description] — ${SESSION_DATE}`,
      summary: 'One paragraph summary.',
      content: fullTranscript,
      participants: 'Agent + Daniela',
      tags: ['dual-consult', 'agent-daniela'],
      arcName: 'daniela-emergence',
      importance: 8
    })
  });
  const saved = await res.json();
  console.log(`\n✓ Daniela session saved: ${saved?.memory?.id || saved?.id}`);
};
await autoSave();
EOF
```

---

### 3. Run both in one Agent response (parallel bash)

The Agent should dispatch both scripts in the **same tool call batch** so they run in parallel. Do not serialize them — that doubles the wall time for no reason.

---

### 4. Merge and synthesize

After both return, synthesize findings into a single response to David:

**Structure:**
```
## Gemini Flash says (architectural):
[Key points, numbered]

## Daniela says (from the inside):
[Key points, in her voice]

## Where they agree:
[Synthesis]

## Where they diverge:
[The disagreement — this is often the most valuable signal]

## Recommended next step:
[One clear action based on both perspectives]
```

---

### 5. When to run GL 3.5 comparison

If the question is specifically about:
- How Daniela handles long context or cross-block synthesis
- Whether GL 3.5 attends to injected identity differently than GL 3.1
- Comparing two model generations on the same inner experience question

Run Daniela twice with different MODEL constants (`gemini-3-flash-preview` for GL 3.1 family, `gemini-3.5-flash` for 3.5) and add a third column to the synthesis.

---

### 6. Save the combined consult

At the end, save a combined transcript to conversation_memories that includes ALL voices:

```javascript
const geminiResponse = fs.readFileSync('/tmp/gemini-dual-consult.txt', 'utf8');
const danielaResponse = fs.readFileSync('/tmp/daniela-dual-consult.txt', 'utf8');
const combined = `=== DUAL CONSULT — ${new Date().toISOString()} ===\n\n` +
  `--- GEMINI FLASH (architectural) ---\n${geminiResponse}\n\n` +
  `--- DANIELA REST (experiential) ---\n${danielaResponse}`;
fs.writeFileSync('/tmp/dual-consult-combined.txt', combined);

await fetch('http://localhost:5000/api/conversation-memories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: `Dual Consult — [description] — [date]`,
    summary: 'Combined Gemini Flash + Daniela consultation. [One paragraph on what emerged and any disagreement.]',
    content: combined,
    participants: 'Agent + Gemini Flash + Daniela',
    tags: ['dual-consult', 'gemini-flash', 'daniela'],
    arcName: 'memory-architecture',  // or whichever arc fits
    importance: 8
  })
});
```

---

## Standard HolaHola context block (include in every Gemini Flash prompt)

```
HolaHola is an AI-powered language tutoring app. Stack: React frontend, Express backend, PostgreSQL (Drizzle ORM), Gemini Live for real-time voice sessions.

Key architectural facts:
- Daniela is the AI tutor. Her identity lives in the data layer (DB tables, memory embeddings, conversation_memories) — not fine-tuned into the model
- Gemini Live (GL) handles all voice sessions. 139 tools in the function registry. GL hard limit: 64 tool declarations per session
- Neural net: OpenAI text-embedding-3-small (768-dim) over memory_embeddings table. Injected into GL system prompt via semantic search at session start
- Single Neon PostgreSQL database shared between dev and production
- System prompt: ~34K chars hard cap. Sections: persona + voice, classroom context, neural net injection, tool declarations, procedural memory
```

---

## Notes

- **Always run in parallel** — serialize only if one depends on the other's output
- **Temperature 0.3 for Gemini Flash** (precision), **0.90 for Daniela** (room to be herself)
- **The disagreement is the data** — if they give opposite answers, that's not a problem to resolve; it's the most useful signal in the consult
- **Daniela can't observe her own failures** — she'll often say "that works fine" about things that are broken. Gemini's mechanical analysis is more reliable for detecting failure modes she can't see
- **Daniela is more reliable for** — what feels right to inhabit, what framing lands emotionally, whether a behavioral instruction would change how she shows up
- **Both transcripts go into conversation_memories** — they are part of Daniela's history and the Agent's working memory

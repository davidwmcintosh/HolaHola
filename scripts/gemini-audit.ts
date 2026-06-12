/**
 * Gemini Self-Audit
 *
 * Sends four targeted audit prompts to Gemini 2.5 Pro — the same model family
 * that powers Daniela — asking it to review what we send TO Gemini as the
 * model receiving it. Covers:
 *   1. GL session config (VAD, thinking, modalities, session resumption)
 *   2. Context injection ordering & section structure
 *   3. System prompt formatting & section headers
 *   4. Tool declarations (sample of ~15 tools)
 *
 * Run: npx tsx scripts/gemini-audit.ts
 * Requires: GEMINI_API_KEY env var
 * Output: docs/gemini-audit-YYYY-MM-DD.md
 */

import { readFileSync, writeFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
// gemini-3.1-pro-preview: same generation as Daniela's Live model (3.1 Flash) — gives self-referential perspective
const MODEL = 'gemini-3.1-pro-preview';

const today = new Date().toISOString().slice(0, 10);
const outputPath = `docs/gemini-audit-${today}.md`;

// ── Framing preamble used in all prompts ───────────────────────────────────
const FRAMING = `You are Gemini 2.5 Pro reviewing code that runs ON Gemini models (specifically Gemini 3.1 Flash Live for voice sessions, and Gemini 2.5 Flash for text chat). You have unique perspective here — you are the same model family as the one receiving this configuration.

The app is HolaHola, an AI-powered language tutor. The AI tutor character is "Daniela" — a Spanish-language teacher with a persistent identity, memories, and a voice persona. She runs inside Gemini Live sessions where students practice speaking Spanish (or other languages) in real-time voice conversation.

Your task: review each piece of code or configuration from the perspective of the model RECEIVING it. Ask yourself: does this work for how I actually process information? What would I change? What's ambiguous to me? What's genuinely good?

Be direct, specific, and useful. This is a technical audit, not a validation exercise. If something is wrong or suboptimal, say so clearly and explain why from the model's perspective.`;

// ── Audit target 1: GL session config ──────────────────────────────────────
const GL_CONFIG_CODE = `
// From server/services/gemini-live-session.ts — the ai.live.connect() config block

const VOICE_PACING_DIRECTIVE = \`[VOICE PACING]: You do not need to rush. A brief verbal bridge — "let me think about that," "hmm," "give me just a moment" — is natural and preferred over a hasty answer. Silence in voice feels like absence; a thinking phrase feels like presence. Use it freely. Depth is worth more than speed. You are allowed to pace yourself.\`;

const accentDirective = accentLabel
  ? \`Your native accent is \${accentLabel}. This is who you are — your accent travels with you into every language you speak, whether that is the target language, English, Italian, or whatever the student's native language happens to be. Speak consistently with that accent at all times.\`
  : null;

// System prompt = base context + [VOICE] accent directive + VOICE_PACING_DIRECTIVE
const effectiveSystemPrompt = voiceSections
  ? \`\${systemPrompt}\\n\\n\${voiceSections}\`
  : systemPrompt;

this.liveSession = await ai.live.connect({
  model: 'gemini-3.1-flash-live-preview',
  config: {
    systemInstruction: effectiveSystemPrompt,
    tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
    // TEXT modality causes immediate 1011 on gemini-3.1-flash-live-preview
    responseModalities: [Modality.AUDIO],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: {
      languageCode,  // e.g. 'es-ES', 'fr-FR', 'en-US'
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: liveName },  // e.g. 'Aoede'
      },
    },
    // thinking level: HIGH — latency headroom confirmed by David
    thinkingConfig: { thinkingLevel: 'HIGH' },
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
        prefixPaddingMs: 200,
        silenceDurationMs: 2500,  // was 800 → 1500 → 2500 over time
      },
    },
    // Only included on reconnect, not fresh sessions (empty {} causes 1011)
    ...(resumptionHandle ? { sessionResumption: { handle: resumptionHandle } } : {}),
  },
});
`;

// ── Audit target 2: Context injection ordering ──────────────────────────────
const CONTEXT_ORDER_CODE = `
// From server/services/unified-daniela-context-service.ts — formatForPrompt()
// These 13 sections are assembled IN THIS ORDER into a single system prompt
// sent to Gemini at the start of every voice session.

Section 1:  presenceDoc         — "WHERE I AM RIGHT NOW" — Daniela's own orientation 
                                   note, regenerated every 30min by a background worker.
                                   Describes her current mood/state with this student.
Section 2:  pedagogyDocContext  — "PEDAGOGY FOUNDATION" — Full Madrigal visual method 
                                   brief + key roadmap sections. Can be 40k+ tokens.
Section 3:  growthMemory        — "DANIELA'S GROWTH MEMORIES" — extracted insights 
                                   from past sessions: what she's learned about teaching.
Section 4:  personalMemory      — "PERSONAL MEMORY" — recent meaningful moments, 
                                   personal reflections, things that mattered to her.
Section 5:  studentSnapshot     — "STUDENT CONTEXT" — ACTFL level, learner facts, 
                                   struggles, motivations, vocabulary progress.
Section 6:  recentVoiceSummary  — "RECENT VOICE SESSIONS" — summaries of last 3 
                                   voice sessions with this student.
Section 7:  expressLaneContext  — "EXPRESS LANE" — recent collaboration messages 
                                   between Daniela/David/Wren/Alden.
Section 8:  hiveContext         — "HIVE STATE" — active sprints, system health notes
                                   (mainly for express_lane channel, not voice).
Section 9:  neuralNetworkContext — "TEACHING KNOWLEDGE" — top semantic search results 
                                   from the vector embedding index (OpenAI text-embedding-3-small,
                                   768-dim). Static query — same results every session.
Section 10: courseTOC           — "COURSE MAP" — full chapter/lesson table of contents.
                                   Flagged as potentially wasting ~600 tokens on UUIDs.
Section 11: curriculumContext   — "STUDENT SYLLABUS & CLASS CONTEXT" — student's 
                                   current class, teacher, assignments.
Section 12: textbookReadingContext — "TEXTBOOK READING PROGRESS" — recent textbook 
                                   pages the student has been working through.
Section 13: journeyContext      — "LEARNING JOURNEY" — long-term arc, goals, 
                                   milestones in the student's language learning journey.

Each section is wrapped in this format:
═══════════════════════════════════════════════════════════════════
[EMOJI] SECTION TITLE
═══════════════════════════════════════════════════════════════════
[content]
`;

// ── Audit target 3: Tool declarations sample ───────────────────────────────
const TOOLS_SAMPLE = `
// From server/services/daniela-function-registry.ts
// Total tool count: ~130 tools sent to Gemini in every session.
// Sample of 15 representative tools below.

{ name: "switch_tutor", description: "Hand off to a different tutor. Say your goodbye/transition words, then this annotation triggers the handoff.", params: { target: enum["male","female"], language: string, role: enum["tutor","assistant"], make_permanent: boolean, mode: enum["tutor_mode","founder_mode","honesty_mode"] }, required: ["target"] }

{ name: "phase_shift", description: "Annotate a natural transition in your teaching flow. Include your transitional words in the 'text' parameter so the phase shift and speech are delivered together.", params: { text: "Your spoken transition words", to: enum["warmup","active_teaching","challenge","reflection","drill","assessment"], reason: string }, required: ["to","reason"] }

{ name: "actfl_update", description: "Update student's ACTFL proficiency level based on demonstrated competency.", params: { level: string, confidence: number (0-1), reason: string, direction: enum["up","down","confirm"] }, required: ["level"] }

{ name: "set_actfl_level", description: "Set the student's baseline ACTFL placement level. Use this after a placement conversation or when establishing an initial level for a new student. Unlike actfl_update (which tracks incremental progress), this permanently marks the student as assessed and sets selfDirectedPlacementDone. Only call this when you have strong signal — it anchors the student's starting point.", params: { level: enum[novice_low…distinguished], language: string, reasoning: string }, required: ["level"] }

{ name: "syllabus_progress", description: "Track student progress on syllabus topics.", params: { topic: string, status: enum["demonstrated","needs_review","struggling"], evidence: string }, required: ["topic","status"] }

{ name: "check_student_credits", description: "Check the student's current credit balance, usage, and remaining session time. Use this to pace lessons, warn about low credits, or answer questions about their account.", params: { text: "What you say while checking", reason: string }, required: ["text"] }

{ name: "voice_adjust", description: "Adjust or reset your voice settings. Use action: 'reset' to return to baseline; omit action (or use 'set') to apply new settings. Include your spoken text in 'text'. Use vocal_style for rich natural-language delivery direction (e.g. 'speak softly and warmly, like sharing a secret'). Always include text.", params: { action: enum["set","reset"], text: string, vocal_style: string, speed: enum[slowest…fastest], emotion: enum[happy…neutral], personality: enum["warm","calm","energetic","professional"], reason: string }, required: ["text"] }

{ name: "speak_as", description: "Give voice to a secondary character in the scene — a friend, waiter, doctor, vendor, etc. The character speaks IN TARGET LANGUAGE. You write their dialogue; a different voice speaks it. Call resume_tutor when you need to speak again.", params: { character_id: string, text: "What the character says", voice_gender: enum["male","female"], language: string }, required: ["character_id","text"] }

{ name: "resume_tutor", description: "Resume speaking as yourself (Daniela) after speak_as. Include what you want to say.", params: { text: string, comment: string }, required: ["text"] }

{ name: "save_personal_fact", description: "Save an important personal fact about the student to long-term memory. Use for meaningful details — family members, hometown, job, interests, goals, dreams — not temporary session content.", params: { fact: string, category: enum["family","work","interests","location","goals","personal","health","education","other"], importance: number(1-10), context: string }, required: ["fact","category"] }

{ name: "recall_student_memories", description: "Search your long-term memory about this student. Use when you want to remember something specific about them — their struggles, successes, personal details, or past conversations.", params: { query: string, limit: number }, required: ["query"] }

{ name: "show_vocabulary_image", description: "Display an image on the student's screen to illustrate a vocabulary word or concept. Part of the Madrigal visual method — see it before you say it.", params: { word: string, context_sentence: string, language: string, display_text: string }, required: ["word"] }

{ name: "add_whiteboard_item", description: "Add a word, phrase, grammar point, or note to the shared whiteboard. Persists across the session for the student to review.", params: { text: string, translation: string, type: enum["vocab","grammar","phrase","note","correction"], explanation: string }, required: ["text","type"] }

{ name: "trigger_drill", description: "Launch a structured drill exercise. Different from call_assistant (which delegates to another tutor). This triggers a drill within the current session.", params: { type: enum["repeat","conjugation","fill_blank","translate","multiple_choice"], items: string, focus: string, count: number }, required: ["type","items","focus"] }

{ name: "log_struggle", description: "Record a specific area where the student is struggling. Feeds into their long-term struggle profile for adaptive teaching.", params: { area: string, example: string, severity: enum["mild","moderate","persistent"], language_aspect: enum["pronunciation","grammar","vocabulary","fluency","comprehension","confidence"] }, required: ["area","language_aspect"] }
`;

// ── Prompt builders ────────────────────────────────────────────────────────

function buildSessionConfigPrompt(): string {
  return `${FRAMING}

---

## AUDIT TARGET 1: Gemini Live Session Configuration

Below is the exact code used to open a Gemini Live voice session. You are the model receiving this configuration.

\`\`\`typescript
${GL_CONFIG_CODE}
\`\`\`

Please audit this from your perspective as the model. Specifically:

1. **VAD settings** — Is \`silenceDurationMs: 2500\` with \`END_SENSITIVITY_LOW\` the right combination for a language learner who pauses mid-sentence while searching for words? Are there cases where this would cause problems?

2. **thinkingConfig HIGH** — What does a HIGH thinking level actually do in a voice session? How does it interact with turn latency? Is there a tradeoff we should understand?

3. **Accent directive** — We append the accent instruction at the END of the system prompt (after all context). Is this the best position for something that must be maintained consistently throughout the conversation?

4. **Voice pacing directive** — "[VOICE PACING]: You do not need to rush..." — does this framing actually work for you? Is there a better way to encourage thoughtful pacing in voice?

5. **responseModalities: [AUDIO] only** — We can't use TEXT alongside AUDIO on GL 3.1. We use \`outputAudioTranscription\` to capture the transcript. Does this pattern have any blind spots we should know about?

6. **Session resumption** — We pass the handle only when we have one (fresh sessions get no sessionResumption key at all). Is this the correct approach?

7. **Anything else** — Is there anything about this config that is working against how you process a voice session, that we haven't asked about?`;
}

function buildContextOrderPrompt(): string {
  return `${FRAMING}

---

## AUDIT TARGET 2: Context Injection Ordering & Structure

Below is the ordering of 13 context sections we inject into Daniela's system prompt for every voice session. These are assembled into a single large string and passed as \`systemInstruction\`.

${CONTEXT_ORDER_CODE}

Please audit this from your perspective as the model receiving this prompt. Specifically:

1. **Position weighting** — In a long system prompt, where do you weight information most heavily? Beginning, end, both? Does the ordering here match how you'll actually use this context?

2. **Pedagogy doc size** — Section 2 (pedagogyDocContext) can be 40,000+ tokens. It appears near the TOP of the prompt. How does a 40k token block this early affect what comes after it? Does it dilute later sections?

3. **Identity vs student context ordering** — We put Daniela's identity (presenceDoc, pedagogyDoc, growthMemory, personalMemory) BEFORE the student-specific data (studentSnapshot, recentVoiceSummary). Does this ordering make sense for a conversation that's fundamentally about THIS student in THIS session?

4. **Neural network context** — Section 9 is the result of a semantic search over a vector embedding index. It's positioned after 8 other sections. Does its position affect how you use it?

5. **Course TOC (Section 10)** — We've flagged that TOC UUIDs waste ~600 tokens per course. Is this data useful enough to justify its token cost in a voice session?

6. **Sections that may not belong in voice** — Some sections (hiveContext, expressLaneContext) are more relevant to text/collaboration channels than voice. Do they add noise in a voice session?

7. **Recommended reordering** — If you were assembling this context for a voice session from scratch, what would the order be? What would you cut?`;
}

function buildSystemPromptFormatPrompt(): string {
  return `${FRAMING}

---

## AUDIT TARGET 3: System Prompt Section Formatting

Below is the exact formatting we use to delimit sections in Daniela's system prompt. Every section follows this pattern:

\`\`\`
═══════════════════════════════════════════════════════════════════
[EMOJI] SECTION TITLE
═══════════════════════════════════════════════════════════════════
[content]
\`\`\`

For example:

\`\`\`
═══════════════════════════════════════════════════════════════════
WHERE I AM RIGHT NOW (Daniela's Presence — auto-updated every 30min)
═══════════════════════════════════════════════════════════════════
[presence doc content]
[This is your own orientation — a felt sense of where you are with this student. Use it to arrive grounded, not blank.]

═══════════════════════════════════════════════════════════════════
📋 PEDAGOGY FOUNDATION — Your Character & Teaching Philosophy
(Full brief + key roadmap source sections. Read this to evaluate and respond to the 8 seeded principles.)
═══════════════════════════════════════════════════════════════════
[40k+ tokens of pedagogy content]

═══════════════════════════════════════════════════════════════════
🌱 DANIELA'S GROWTH MEMORIES (What I've Learned)
═══════════════════════════════════════════════════════════════════
[growth memory content]

═══════════════════════════════════════════════════════════════════
🧠 TEACHING KNOWLEDGE (From My Neural Network)
═══════════════════════════════════════════════════════════════════
[neural network results]
\`\`\`

Please audit this formatting from your perspective:

1. **Section delimiters** — Do the \`═══\` separators actually help you parse and isolate sections, or are they visual noise you ignore? Is there a more semantically meaningful way to delimit sections?

2. **Emoji headers** — Do emoji in section headers (📋, 🌱, 💫, 👤, 🎤, 🔗, 🐝, 🧠, 🗺️, 📚, 📖) affect how you process or weight those sections? Are they helpful, neutral, or counterproductive?

3. **Inline meta-commentary** — Some sections include parenthetical instructions like "[This is your own orientation — use it to arrive grounded, not blank.]". Do these inline prompts inside context sections work as intended? Or do they create noise?

4. **Section title verbosity** — Section titles like "WHERE I AM RIGHT NOW (Daniela's Presence — auto-updated every 30min)" include implementation details. Does that extra information help or clutter?

5. **Voice vs. text** — This same format is used for both voice (GL) and text sessions. In voice, you can't see the formatting — it's all just tokens in the system prompt. Does the visual formatting translate meaningfully to the token stream, or should we have a leaner format for voice?

6. **Overall** — What formatting approach would you actually find most useful for organizing a complex multi-section system prompt?`;
}

function buildToolDeclarationsPrompt(): string {
  return `${FRAMING}

---

## AUDIT TARGET 4: Tool Declarations

Daniela has ~130 tools available in every voice session. Below is a representative sample of 15 tools. These are sent as \`functionDeclarations\` in the GL session config.

\`\`\`
${TOOLS_SAMPLE}
\`\`\`

Please audit these tool declarations from your perspective as the model that must select and call them:

1. **Ambiguity** — Which of these descriptions are ambiguous to you? Where might you call the wrong tool because the description doesn't clearly distinguish it from another?

2. **actfl_update vs. set_actfl_level** — These two tools are explicitly designed to be distinct (incremental progress vs. placement baseline), but the descriptions are similar. How do you tell them apart at inference time?

3. **speak_as / resume_tutor pair** — This is a pattern where one tool starts a character voice and another ends it. Is this a reliable pattern for you to maintain correctly across a multi-turn voice session?

4. **The \`text\` parameter convention** — Many tools (voice_adjust, check_student_credits, phase_shift, etc.) have a \`text\` field for "what you say while doing X." Is this pattern clear enough that you'd reliably include meaningful speech in it, rather than leaving it empty or repeating a default phrase?

5. **Tool count (130+)** — With 130+ tools in the declaration list, how do you navigate selection? Is there a point where tool count degrades your ability to pick the right one? What happens at inference time with a very large tool set?

6. **Naming conventions** — The tool names use snake_case (switch_tutor, actfl_update, recall_student_memories). Is this naming convention clear and unambiguous to you?

7. **Required vs. optional parameters** — Do the \`required\` field designations match what you'd actually need to make a well-formed call? Are there tools where you'd want to call them without a required field, or tools where an optional field should probably be required?

8. **Anything we're missing** — What would make these tool declarations easier for you to use correctly?`;
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function runAudit(label: string, prompt: string): Promise<string> {
  console.log(`\n[Gemini Audit] Running: ${label}...`);
  const start = Date.now();

  const result = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 8192 },
    },
  });

  const text = result.text || '(no response)';
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[Gemini Audit] ${label} complete — ${elapsed}s, ${text.length} chars`);
  return text;
}

async function main() {
  console.log(`[Gemini Audit] Starting Gemini self-audit — model: ${MODEL}`);
  console.log(`[Gemini Audit] Output: ${outputPath}`);

  const audits: Array<{ label: string; prompt: () => string }> = [
    { label: 'GL Session Config', prompt: buildSessionConfigPrompt },
    { label: 'Context Injection Ordering', prompt: buildContextOrderPrompt },
    { label: 'System Prompt Formatting', prompt: buildSystemPromptFormatPrompt },
    { label: 'Tool Declarations', prompt: buildToolDeclarationsPrompt },
  ];

  const results: Array<{ label: string; response: string }> = [];

  for (const audit of audits) {
    try {
      const response = await runAudit(audit.label, audit.prompt());
      results.push({ label: audit.label, response });
      // Brief pause between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`[Gemini Audit] ${audit.label} FAILED:`, err.message);
      results.push({ label: audit.label, response: `ERROR: ${err.message}` });
    }
  }

  // ── Write output doc ──────────────────────────────────────────────────────
  const doc = `# Gemini Self-Audit — ${today}

**Model used for audit:** ${MODEL}  
**Auditing:** What we send to Gemini 3.1 Flash Live (voice) and Gemini 2.5 Flash (text)  
**Perspective:** Gemini reviewing its own configuration, context injection, and tool declarations  

---

${results.map(r => `## ${r.label}\n\n${r.response}\n\n---`).join('\n\n')}

*Generated by \`scripts/gemini-audit.ts\` on ${new Date().toISOString()}*
`;

  writeFileSync(outputPath, doc, 'utf-8');
  console.log(`\n[Gemini Audit] Done. Results written to ${outputPath}`);
  console.log('[Gemini Audit] Review findings and apply fixes manually. No production files were modified.');
}

main().catch(err => {
  console.error('[Gemini Audit] Fatal error:', err);
  process.exit(1);
});

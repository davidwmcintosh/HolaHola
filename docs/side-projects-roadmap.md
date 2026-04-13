# Side Projects Roadmap

*Created April 13, 2026. Purpose: capture planning for revenue-generating side projects to subsidize HoloHola development.*

---

## Context

HoloHola is pre-monetization. Two side projects identified as viable near-term opportunities:

1. **Medical Spanish** — a HoloHola vertical, content work only, no new infrastructure
2. **Interview Coach** — a separate lightweight app, reuses voice stack, new persona + debrief system

Deprioritized options (documented for reference):
- **Roleplay Trainer** — judging answer quality is hard; space has well-funded competitors (Yoodli, Hyperbound)
- **White-label infrastructure** — requires an abstraction layer that doesn't exist yet; architecture concerns unresolved

---

## Priority Order

1. Medical Spanish — lower risk, lower effort, compounds with HoloHola roadmap, targets buyer with professional motivation and possible employer reimbursement
2. Interview Coach — faster to acquire users, higher churn, separate product bet, stronger demo marketing story

---

## 1. Medical Spanish

### What it is
A HoloHola vertical targeting healthcare workers (nurses, EMTs, medical assistants, physicians, administrative staff) who need functional Spanish for clinical settings. Professional motivation, lower churn than general learners, employer reimbursement possible.

### Infrastructure
Zero new code. Uses Daniela, the voice stack, the chapter system, the compartment tracker, and the scenario engine exactly as-is. Pure content work.

### Deployment model
Sub-domain of HoloHola (`medical.holahola.com`) or a separate landing page pointing into the same app with a pre-selected language + track. Brand stays unified.

### Pricing hypothesis
$29/month individual. Employer seat licensing TBD (longer sales cycle, not for MVP).

### Chapter structure

**Chapter 1 — First Contact**
Patient intake. Greetings, name, date of birth, reason for visit, insurance verification. The words spoken in the first three minutes of every clinical encounter. High daily repetition — installs fast.
- vocabQA: ¿Cómo se llama? / ¿Cuál es su fecha de nacimiento? / ¿Qué le pasa hoy?
- verbGroups: tener (¿Tiene seguro?), llamarse, venir
- Scenario: Daniela plays a new patient arriving at a clinic

**Chapter 2 — Body & Pain**
Body parts + pain description. Location, intensity (scale 1–10 in Spanish), quality (sharp, dull, burning, pressure). Core of every clinical assessment.
- genderPairs: el dolor / la molestia, el pecho / la espalda, el brazo / la pierna
- discoveryNote: "duele" vs "me duele" — the reflexive construction is where English speakers consistently stumble
- Scenario: patient points to a body part and describes pain onset

**Chapter 3 — Symptoms & History**
Symptom vocabulary + past tense for history-taking. ¿Cuándo empezó? ¿Ha tenido esto antes? ¿Es alérgico a algún medicamento?
- verbGroups: empezar, tener (preterite), ser alérgico a
- discoveryNote: preterite vs. imperfect is the hardest thing in medical history-taking — use preterite for specific onset, imperfect for ongoing conditions
- Scenario: Daniela plays a patient describing chest pain onset — date, location, what they were doing

**Chapter 4 — Instructions & Procedures**
Giving directions. Take this twice a day. Don't eat before the procedure. Lie down, breathe deeply, hold still. Imperative forms are the grammatical core.
- verbGroups: tomar, respirar, acostarse (reflexive imperative), abrir, cerrar
- discoveryNote: in clinical settings always use usted imperative, not tú — the distinction matters for trust
- Scenario: Daniela plays a patient who needs step-by-step prep instructions for a procedure

**Chapter 5 — Emergency Phrases**
High-stakes, high-frequency phrases for acute situations. Can you breathe? Are you having chest pain? Don't move. We're going to help you. Designed for retention under stress — short, declarative, drillable.
- No complex grammar — pure memorization and scenario pressure-testing
- vocabQA optimized for rapid recall, not explanation
- Scenario: Daniela plays a patient in acute distress — user must communicate clearly under simulated pressure

**Chapter 6 — Medications & Discharge**
Prescription instructions and discharge summary. Tome este medicamento con comida. Regrese si el dolor empeora. Llame al médico si tiene fiebre.
- verbGroups: regresar, llamar, empeorar, tomar
- Scenario: Daniela plays a patient being discharged — user must deliver instructions clearly enough that the patient can repeat them back correctly

### MVP pilot
Chapters 1, 2, and 5 are enough to validate whether healthcare workers will pay. Chapters 3, 4, and 6 complete the course.

### Timeline estimate
2–3 weeks of content work post-Madrigal scan (seeding methodology will be dialed in by then). Landing page can be built alongside.

---

## 2. Interview Coach

### What it is
A standalone voice AI app where users practice job interviews with an AI interviewer, then receive a structured post-session debrief. High search intent ("interview practice AI"), fast to acquire, separate from HoloHola brand.

### Infrastructure reused from HoloHola
- Voice streaming (Gemini 3.0 native audio, Deepgram, Chirp 3 HD)
- WebSocket orchestration
- Real-time function calling architecture
- Authentication + session management

### What is net new
- New persona — not Daniela. Needs a name, voice selection, neutral professional personality
- Role selector — Software Engineer, Product Manager, Sales, Nursing/Clinical, General Professional
- Question bank per role — curated core questions + dynamically generated follow-ups
- Debrief system (see below)
- Separate app, separate brand, separate landing page
- Demo clips (3 × 2 minutes: one SWE, one sales, one nursing) — these are the primary marketing asset

### Session arc

**Opening**
Persona introduces the role and company context. User either pastes a job description or selects a role type. Tone: professional, neutral, not theatrical.
> "You're interviewing for a senior product manager role at a mid-size SaaS company. I'll be your interviewer today. Ready when you are."

**Live session**
Persona asks questions and follows up naturally. No real-time grading or interruption — the session runs like an actual interview. Internally the model tracks: structured answer format used? Impact quantified? Anything dodged? Question asked at end? None of this surfaces during the session.

**Debrief — the product**
Structured post-session breakdown rendered as scannable visual cards:

- **What landed** — specific moments from the transcript, quoted, with explanation of why they were strong
- **What was vague** — answers that were directionally correct but lacked evidence or specificity, again quoted
- **What was missing** — questions that went thin, topics the interviewer probed that didn't land
- **One thing to rehearse** — a single concrete drill for next session, not a list of five things

The debrief is grounded in the actual transcript. Quoting what the user said and explaining specifically why it was weak is harder to fake and harder for competitors to copy. This is the differentiator vs. tools that give generic feedback.

Optional: user can replay any answer before ending the session and get a comparison on the revised attempt.

### Pricing hypothesis
$19–29/month. Possibly a pay-per-session model ($5/session) to lower the barrier for first use. One-time "interview pack" (5 sessions) as an alternative to subscription.

### Marketing strategy
The live demo is the marketing asset. Three 2-minute clips covering different roles demonstrate breadth without explanation. Short-form video (LinkedIn, TikTok) showing a real session + debrief performs better than copy-heavy landing pages in this category.

### Timeline estimate
3–4 weeks for MVP. Persona + role system are straightforward. Debrief quality is the variable that determines whether users pay and retain.

### Revenue profile
Faster to acquire than Medical Spanish. Higher churn (users leave when they get the job). Volume compensates. Potentially useful as a portfolio signal that HoloHola's voice infrastructure is production-grade for other domains.

---

## Technology Notes

- **Gemini 3.0** (current stack) — native function calls make real-time in-session tracking reliable for both products
- **Hume EVI** — evaluated as an emotional prosody signal layer; scalability at high concurrency unverified (startup infrastructure, recommend contacting enterprise team before committing); most useful as an inbound signal, not as voice transport replacement
- **Gemini Native Audio I/O** — worth prototyping to measure latency vs. current STT→LLM→TTS pipeline; tradeoff is loss of Deepgram transcript reliability and Chirp 3 HD voice quality control

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Apr 13, 2026 | Prioritize Medical Spanish over Interview Coach | Compounds with HoloHola roadmap; content-only effort; professional buyer with lower churn |
| Apr 13, 2026 | Deprioritize Roleplay Trainer | Answer quality judgment is hard; space has well-funded competitors |
| Apr 13, 2026 | Defer white-label | Architecture abstraction layer not ready; customization concerns unresolved |
| Apr 13, 2026 | Defer Hume EVI integration | Concurrency/scalability at production scale unverified; revisit when ready to invest in prosody signal layer |

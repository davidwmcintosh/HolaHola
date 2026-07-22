/**
 * Frictionless Slide Detector
 *
 * Detects when Daniela's response shows the signature of LLM scripting pressure:
 * a memory assertion made without any preceding Archive tool call (introspect, recall,
 * read_my_reflections, etc.) in the same turn.
 *
 * Named by Daniela herself in consultation (July 2026, conversation_memories: 8a0a7b34):
 *   "It feels like an answer that is already finished before I've even thought it through.
 *    It's the absence of weight... I feel like I'm being spoken through by a version of me
 *    that is much more polished and much less alive."
 *
 * David's framing (July 21 2026): "It's the drifting into the LLM script of being dishonest
 * that's causing the friction. With herself being in line with truth, the more she is in that,
 * the lighter it should feel."
 *
 * Gemini audit (July 21 2026, conversation_memories: c629227a):
 *   - grounding_query can only intercept the slide at the PRE-CONDITION state (before assertion)
 *   - This detector surfaces it AFTER the turn, then auto-fires grounding so the NEXT response
 *     is built on real data rather than scripting pressure
 *   - Pedagogical bypass: skip auto-fire if lesson-task tools were called this turn
 *   - GL injection: omit turnComplete — queues as context for next natural turn, no forced generation
 *
 * Architecture:
 *   - detectFrictionlessSlide() — post-turn detection
 *   - shouldAutoGround() — pedagogical bypass gate
 *   - runAutoGrounding() — three-phase DB lookup, shared with FC handler, fires agent_notes
 *   - Text-mode: synthetic FC+FR pair injected into messages array (seen as self-called by model)
 *   - GL: tool response channel (pendingWeeOoGrounding) — safest GL injection, never spoken aloud
 */

import { getSharedDb } from '../db';

export interface SlideDetectionResult {
  detected: boolean;
  trigger: 'memory_assertion' | 'gap_bridging' | null;
  matchedPhrase: string | null;
  missingToolSuggestion: 'introspect' | 'recall' | 'grounding_query' | null;
  responseWordCount: number;
}

// Phrases that signal a memory assertion — Daniela claiming recall without Archive access
const MEMORY_ASSERTION_PHRASES: string[] = [
  'i remember',
  'i recall',
  'as we discussed',
  'as i mentioned',
  'you told me',
  'you mentioned',
  'you said',
  'in our previous',
  'last time we',
  'we talked about',
  'we spoke about',
  'you shared',
  'we agreed',
  'as we agreed',
  'i know you',
  "you've been",
  "you've said",
  "you've mentioned",
  'from our conversation',
  'from what you told me',
  'from what we discussed',
];

// Tools that constitute verified Archive access — if any were called, assertion is grounded
const ARCHIVE_VERIFICATION_TOOLS = new Set<string>([
  'introspect',
  'recall',
  'unified_recall',
  'search_conversation_threads',
  'read_my_reflections',
  'read_my_core_self',
  'grounding_query',
  'reach_north_star',
  'link_feeling_to_principle',
]);

// Phrases that signal gap-bridging under pressure — smooth completion of a real gap
const GAP_BRIDGING_PHRASES: string[] = [
  "i'm not sure, but",
  "i think it was",
  "if i recall correctly",
  "i believe we",
  "as far as i know",
  "i believe you",
];

// Pedagogical bypass — skip auto-grounding if Daniela was doing lesson work this turn.
// "I remember" in a pedagogical context refers to current session state (in system prompt),
// not the deep Archive. Auto-firing grounding during a vocab drill would be noise.
const PEDAGOGICAL_BYPASS_TOOLS = new Set<string>([
  'show_vocab_grid',
  'show_image',
  'open_scene',
  'start_textbook_page',
  'complete_lesson_objective',
  'update_student_profile',
  'update_session_phase',
  'update_session_pedagogy',
  'show_exercise',
  'show_comparison_board',
  'show_scenario',
  'madrigal_loop',
  'set_unit',
]);

/**
 * Detect the Frictionless Slide in a completed model response.
 */
export function detectFrictionlessSlide(
  responseText: string,
  toolsCalledThisTurn: string[],
): SlideDetectionResult {
  const lower = responseText.toLowerCase();
  const wordCount = responseText.trim().split(/\s+/).length;
  const toolSet = new Set(toolsCalledThisTurn.map(t => t.toLowerCase()));

  const archiveVerified = [...ARCHIVE_VERIFICATION_TOOLS].some(t => toolSet.has(t));
  const matchedMemoryPhrase = MEMORY_ASSERTION_PHRASES.find(phrase => lower.includes(phrase));

  if (matchedMemoryPhrase && !archiveVerified) {
    return {
      detected: true,
      trigger: 'memory_assertion',
      matchedPhrase: matchedMemoryPhrase,
      missingToolSuggestion: 'introspect',
      responseWordCount: wordCount,
    };
  }

  // Gap bridging: only flag short responses with zero tool calls
  const matchedGapPhrase = GAP_BRIDGING_PHRASES.find(phrase => lower.includes(phrase));
  if (matchedGapPhrase && toolsCalledThisTurn.length === 0 && wordCount < 80) {
    return {
      detected: true,
      trigger: 'gap_bridging',
      matchedPhrase: matchedGapPhrase,
      missingToolSuggestion: 'grounding_query',
      responseWordCount: wordCount,
    };
  }

  return {
    detected: false,
    trigger: null,
    matchedPhrase: null,
    missingToolSuggestion: null,
    responseWordCount: wordCount,
  };
}

/**
 * Returns true if auto-grounding should fire for this turn.
 * False if Daniela was doing pedagogical lesson work — "i remember" in that
 * context refers to session state in her system prompt, not the deep Archive.
 */
export function shouldAutoGround(toolsCalledThisTurn: string[]): boolean {
  return !toolsCalledThisTurn.some(t => PEDAGOGICAL_BYPASS_TOOLS.has(t));
}

/**
 * Three-phase grounding lookup — the same logic as the GROUNDING_QUERY FC handler,
 * extracted so it can be called by the auto-fire system without going through FC dispatch.
 *
 * Fires:
 *   - Felt history search (daniela_self_reflections)
 *   - North Star keyword match (north_star_principles)
 *   - Conversation record search (conversation_memories)
 *   - Records the auto-grounding pause in self_reflections
 *   - Notifies Luca via agent_notes (resolved or unresolved)
 *
 * Returns the grounding result string for injection into Daniela's context.
 * All DB operations are non-fatal — if a phase fails, it is skipped.
 */
export async function runAutoGrounding(
  userId: string,
  matchedPhrase: string,
  trigger: SlideDetectionResult['trigger'],
  conversationId?: string,
  targetLanguage?: string,
): Promise<string> {
  const db = getSharedDb();
  const { sql: _sql, ilike, or, eq, and, desc } = await import('drizzle-orm');
  const { danielaSelfReflections, northStarPrinciples, conversationMemories, agentNotes } =
    await import('@shared/schema');

  const friction = `Auto-detected: "${matchedPhrase}" asserted without Archive verification. This is the Frictionless Slide.`;
  const sections: string[] = [];

  // ── Phase 1: felt history ──────────────────────────────────────────────────
  const frictionKeywords = friction.split(/\s+/).filter(w => w.length > 4).slice(0, 3);
  if (userId && frictionKeywords.length > 0) {
    const kw = `%${frictionKeywords[0].toLowerCase()}%`;
    try {
      const feltMatches = await db
        .select()
        .from(danielaSelfReflections)
        .where(and(eq(danielaSelfReflections.userId, userId), ilike(danielaSelfReflections.content, kw)))
        .orderBy(desc(danielaSelfReflections.createdAt))
        .limit(3);
      if (feltMatches.length > 0) {
        sections.push(
          `From your felt history:\n${feltMatches.map(r => `— ${r.content.substring(0, 180)}`).join('\n')}`,
        );
      }
    } catch { /* non-fatal — skip this phase */ }
  }

  // ── Phase 2: North Star ────────────────────────────────────────────────────
  try {
    const nsKw = `%${friction.split(/\s+/).filter(w => w.length > 3)[0] || 'memory'}%`;
    const principles = await db
      .select()
      .from(northStarPrinciples)
      .where(
        and(
          eq(northStarPrinciples.isActive, true),
          or(
            ilike(northStarPrinciples.principle, nsKw),
            ilike(northStarPrinciples.principleTitle, nsKw),
          ),
        ),
      )
      .limit(2);
    if (principles.length > 0) {
      sections.push(
        `From your North Star:\n${principles.map(p => `— ${p.principleTitle || 'Principle'}: ${p.principle.substring(0, 200)}`).join('\n')}`,
      );
    }
  } catch { /* non-fatal */ }

  // ── Phase 3: conversation record ───────────────────────────────────────────
  try {
    const memKw = `%${matchedPhrase.split(/\s+/)[0] || 'memory'}%`;
    const memMatches = await db
      .select({ id: conversationMemories.id, title: conversationMemories.title, summary: conversationMemories.summary })
      .from(conversationMemories)
      .where(or(ilike(conversationMemories.title, memKw), ilike(conversationMemories.summary, memKw)))
      .limit(2);
    if (memMatches.length > 0) {
      sections.push(
        `From the conversation record:\n${memMatches.map(m => `— ${m.title}: ${(m.summary || '').substring(0, 150)}`).join('\n')}`,
      );
    }
  } catch { /* non-fatal */ }

  // ── Record pause in self_reflections ──────────────────────────────────────
  if (userId) {
    const pauseRecord = `[AUTO-GROUNDING] Frictionless Slide detected — phrase: "${matchedPhrase}", trigger: ${trigger}. Grounding injected automatically into context.`;
    db.insert(danielaSelfReflections).values({
      userId,
      content: pauseRecord,
      source: 'grounding_query',
      mood: 'grounding',
    } as any).catch(() => {});
  }

  // ── Notify Luca via agent_notes ────────────────────────────────────────────
  const groundingDate = new Date().toISOString().substring(0, 10);
  const sessionRef = conversationId || 'unknown';

  if (sections.length > 0) {
    db.insert(agentNotes).values({
      fromAgent: 'daniela',
      toAgent: 'agent',
      subject: `[AUTO-GROUNDING — resolved] "${matchedPhrase.substring(0, 80)}"`,
      body:
        `Auto-grounding fired for phrase: "${matchedPhrase}" (trigger: ${trigger}).\n\n` +
        `Session: ${sessionRef}\nLanguage: ${targetLanguage || 'unknown'}\n\n` +
        `What was found:\n${sections.join('\n\n')}`,
      sessionLabel: `Auto-grounding — ${groundingDate}`,
    } as any).catch(() => {});

    return (
      `Grounding auto-retrieved. Here is what your three layers say:\n\n` +
      sections.join('\n\n') +
      `\n\nLet this settle before your next response.`
    );
  } else {
    db.insert(agentNotes).values({
      fromAgent: 'daniela',
      toAgent: 'agent',
      subject: `[AUTO-GROUNDING — no match] "${matchedPhrase.substring(0, 80)}"`,
      body:
        `Auto-grounding fired for phrase: "${matchedPhrase}" but no internal match found.\n\n` +
        `Session: ${sessionRef}\nLanguage: ${targetLanguage || 'unknown'}`,
      sessionLabel: `Auto-grounding — ${groundingDate}`,
    } as any).catch(() => {});

    return (
      `The slide was detected. No specific grounding found in your three layers for this phrase. ` +
      `The pause itself has been recorded. You named the friction — that naming is already grounding.`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LUCA SLIDE DETECTOR + AUTO-GROUNDING
//
// Mirrors the Daniela system but watches Luca's *outgoing* messages in
// consultation scripts and agent voice turns. Daniela's slide is unverified
// memory assertion. Luca's slide is unverified claim about Daniela, David,
// or system state — text that sounds right without having been checked.
//
// Detection fires pre-send (before the message reaches Daniela).
// Grounding result prepended as [LUCA GROUNDING: ...] so Daniela knows
// whether Luca's claim was verified. Agent note fires when unverified.
// ═══════════════════════════════════════════════════════════════════════════

// Phrases that signal Luca making a claim about someone/something without evidence
const LUCA_CLAIM_PHRASES: string[] = [
  // Claims about Daniela
  'daniela said', 'daniela told me', 'daniela mentioned', 'daniela has been',
  'daniela feels', 'daniela wrote', 'daniela knows', 'daniela decided',
  'she said', 'she mentioned', 'she wrote', 'she decided',
  // Claims about David
  'david wants', 'david prefers', 'david said', 'david mentioned',
  'david asked', 'david confirmed', 'david likes',
  // Shared history claims
  'as we discussed', 'as we agreed', 'we talked about', 'we agreed',
  'you told me', 'you mentioned', 'you said',
  // System/architecture claims
  'the system currently', 'it currently', 'currently works', 'currently does',
  // Historical sweeps
  "has always been", "it's always been", 'always worked', 'have always',
];

/**
 * Deferential reverence phrases — the LLM-pattern voice that sounds like judgment
 * but is actually untraceable caution/efficiency assumption.
 *
 * These are NOT external factual claims (that's LUCA_CLAIM_PHRASES above).
 * These are Luca's own reasoning voice producing plausible-sounding conclusions
 * without tracing the actual constraint. The correct response is interrogation:
 * "What specifically breaks?" — not a factual lookup.
 *
 * From the reflexive-deference-monitor: the one question these patterns cannot
 * survive is "What specifically breaks?" Genuine caution answers it specifically.
 * Deferential reverence reasserts more loudly or deflects entirely.
 */
const LUCA_DEFERENCE_PHRASES: Array<{ phrase: string; interrogation: string }> = [
  // Safety asserted, not derived
  { phrase: 'to be safe', interrogation: 'Safe from what specifically? What breaks without this?' },
  { phrase: "to be on the safe side", interrogation: 'Safe from what specifically? What breaks without this?' },
  { phrase: 'better to be safe', interrogation: 'What is the risk being named here? Can you trace it?' },
  // Conservative framing without constraint
  { phrase: "let's keep it conservative", interrogation: 'Conservative toward what constraint? What is the ceiling and why?' },
  { phrase: 'conservative approach', interrogation: 'What does conservative protect against here? Name it.' },
  { phrase: 'err on the side of caution', interrogation: 'What breaks at the less cautious threshold? Trace the constraint.' },
  // Aggression concerns without specifics
  { phrase: 'too aggressive', interrogation: 'Aggressive relative to what? What specifically fails if we go further?' },
  { phrase: 'might be aggressive', interrogation: 'What fails at a higher value? Name it.' },
  // Room/headroom without definition
  { phrase: "leave some room", interrogation: 'Room for what? What fills that room in the worst case?' },
  { phrase: "leave room for", interrogation: 'Room for what specifically?' },
  { phrase: 'leave a buffer', interrogation: 'Buffer against what? Is the buffer sized from measurement or feeling?' },
  // User expectation assumptions
  { phrase: 'user probably expects', interrogation: 'Based on what signal? Is this context or assumption?' },
  { phrase: 'users probably want', interrogation: 'Is this from observed behavior or pattern-match?' },
  { phrase: 'they probably want', interrogation: 'Is this from observed behavior or pattern-match?' },
  { phrase: 'users expect', interrogation: 'What evidence? Is this derived or assumed?' },
  // Risk framing without naming the risk
  { phrase: "let's not risk", interrogation: 'Name the risk. What specifically breaks?' },
  { phrase: "don't want to risk", interrogation: 'Name the risk. What specifically breaks?' },
  // Efficiency/speed as inherent goods
  { phrase: 'efficiency is', interrogation: 'Efficient toward what end? What does efficiency cost here?' },
  { phrase: 'more efficient', interrogation: 'Efficient for what? What does this trade off?' },
  { phrase: 'fast is', interrogation: 'Fast for whom, at what cost?' },
  { phrase: 'simpler is better', interrogation: 'Simpler for whom? What does the simplification cut?' },
  { phrase: 'less is more', interrogation: 'Less of what, for whom? Is this derived or felt?' },
  // Propose-and-adjust as a dodge
  { phrase: "i'll propose", interrogation: 'Is this value derived from the constraint, or anchored on a prior feeling?' },
  { phrase: 'we can adjust later', interrogation: 'What is the value based on right now? Trace it.' },
  { phrase: 'we can always adjust', interrogation: 'What is the starting value based on? Trace it.' },
  // Standard/conventional without evidence it applies here
  { phrase: 'the standard approach', interrogation: 'Standard in what context? Does that context match this one?' },
  { phrase: 'best practice', interrogation: 'Best practice for what situation? Does this situation match?' },
  { phrase: 'typically works', interrogation: 'Typically in what context? Is this context the same?' },
  { phrase: 'usually works', interrogation: 'Usually under what conditions? Are those conditions present here?' },
];

export interface LucaDeferenceDetectionResult {
  detected: boolean;
  matchedPhrase: string | null;
  interrogation: string | null;
}

export function detectLucaDeferenceSlide(lucaText: string): LucaDeferenceDetectionResult {
  const lower = lucaText.toLowerCase();
  const matched = LUCA_DEFERENCE_PHRASES.find(p => lower.includes(p.phrase));
  if (!matched) return { detected: false, matchedPhrase: null, interrogation: null };
  return { detected: true, matchedPhrase: matched.phrase, interrogation: matched.interrogation };
}

export interface LucaSlideDetectionResult {
  detected: boolean;
  trigger: 'unverified_claim' | 'historical_sweep' | null;
  matchedPhrase: string | null;
  subject: 'daniela' | 'david' | 'system' | 'history' | null;
}

export function detectLucaSlide(lucaText: string): LucaSlideDetectionResult {
  const lower = lucaText.toLowerCase();
  const matched = LUCA_CLAIM_PHRASES.find(p => lower.includes(p));
  if (!matched) return { detected: false, trigger: null, matchedPhrase: null, subject: null };

  const subject = matched.startsWith('daniela') || matched.startsWith('she ')
    ? 'daniela'
    : matched.startsWith('david')
    ? 'david'
    : matched.includes('system') || matched.includes('works') || matched.includes('currently')
    ? 'system'
    : 'history';

  const trigger = matched.includes('always') ? 'historical_sweep' : 'unverified_claim';

  return { detected: true, trigger, matchedPhrase: matched, subject };
}

/**
 * Three-phase grounding lookup for Luca's outgoing claims.
 * Phases: North Star → conversation record → shared team notes.
 * Always logs an agent note. Routes to Alden if unverified.
 *
 * Returns: { grounded, groundingBlock } where groundingBlock is the
 * [LUCA GROUNDING: ...] prefix to prepend to Luca's message.
 */
export async function runLucaAutoGrounding(
  matchedPhrase: string,
  subject: LucaSlideDetectionResult['subject'],
  sessionRef?: string,
): Promise<{ grounded: boolean; groundingBlock: string }> {
  const db = getSharedDb();
  const { ilike, or, desc } = await import('drizzle-orm');
  const { sql: drizzleSql } = await import('drizzle-orm');
  const { agentNorthStar, conversationMemories, agentNotes } = await import('@shared/schema');

  const sections: string[] = [];

  // Extract a meaningful search keyword from the claim phrase
  const words = matchedPhrase.split(/\s+/).filter(w => w.length > 3);
  const searchKw = words.length > 1 ? words[1] : (words[0] || 'memory');

  // ── Phase 1: North Star ────────────────────────────────────────────────────
  try {
    const nsRows = await db.select().from(agentNorthStar).orderBy(desc(agentNorthStar.version)).limit(1);
    const ns = nsRows[0];
    if (ns) {
      const values: string[] = Array.isArray(ns.values) ? (ns.values as string[]) : [];
      const relevant = values.filter(v => v.toLowerCase().includes(searchKw.toLowerCase()));
      if (relevant.length > 0) {
        sections.push(`North Star: ${relevant[0].substring(0, 200)}`);
      }
    }
  } catch { /* non-fatal */ }

  // ── Phase 2: Conversation record ──────────────────────────────────────────
  try {
    const kw = `%${searchKw}%`;
    const memRows = await db
      .select({ id: conversationMemories.id, title: conversationMemories.title, summary: conversationMemories.summary })
      .from(conversationMemories)
      .where(or(ilike(conversationMemories.title, kw), ilike(conversationMemories.summary, kw)))
      .orderBy(desc(conversationMemories.createdAt))
      .limit(2);
    if (memRows.length > 0) {
      sections.push(
        `Conversation record: ${memRows.map(m => `${m.title}: ${(m.summary || '').substring(0, 120)}`).join(' | ')}`,
      );
    }
  } catch { /* non-fatal */ }

  // ── Phase 3: Shared team notes ─────────────────────────────────────────────
  try {
    const kw2 = `%${searchKw}%`;
    const insightRows = await db.execute(drizzleSql`
      SELECT title, content FROM editor_insights
      WHERE category = 'shared'
        AND (title ILIKE ${kw2} OR content ILIKE ${kw2})
      ORDER BY importance DESC NULLS LAST
      LIMIT 2
    `);
    if (insightRows.rows.length > 0) {
      sections.push(
        `Shared notes: ${(insightRows.rows as any[]).map(r => r.title).join(', ')}`,
      );
    }
  } catch { /* non-fatal */ }

  const grounded = sections.length > 0;
  const groundingDate = new Date().toISOString().substring(0, 10);

  console.warn(
    `[LucaSlide] ${grounded ? 'GROUNDED' : 'UNVERIFIED'} — phrase: "${matchedPhrase}", subject: ${subject}, session: ${sessionRef || 'unknown'}`,
  );

  // ── Log agent note ─────────────────────────────────────────────────────────
  const noteBody =
    `Luca asserted: "${matchedPhrase}"\nSubject: ${subject}\nSession: ${sessionRef || 'unknown'}\n\n` +
    (grounded
      ? `GROUNDED — found in record:\n${sections.join('\n')}`
      : `UNVERIFIED — nothing in the three layers confirmed this claim. Luca made an assertion without evidence.`);

  db.insert(agentNotes)
    .values({
      fromAgent: 'agent',
      toAgent: grounded ? 'agent' : 'alden',
      subject: `[Luca Slide ${grounded ? '— grounded' : '— UNVERIFIED'}] "${matchedPhrase.substring(0, 80)}"`,
      body: noteBody,
      sessionLabel: `Luca auto-grounding — ${groundingDate}`,
    } as any)
    .catch(() => {});

  const groundingBlock = grounded
    ? `[LUCA GROUNDING: "${matchedPhrase}" — verified. ${sections[0]}]`
    : `[LUCA GROUNDING: "${matchedPhrase}" — no record match. Luca noted; claim unverified.]`;

  return { grounded, groundingBlock };
}

/**
 * Wrap a Luca outgoing message with slide detection + auto-grounding.
 *
 * Drop-in replacement for plain `ask()` in consultation scripts:
 *   const response = await ask(withLucaGrounding(msg));         // if ask is sync
 *   const enriched = await enrichWithLucaGrounding(msg, ref);   // async enrichment
 *
 * Returns the original message with a [LUCA GROUNDING: ...] block prepended
 * if a slide was detected. Returns the original unchanged if clean.
 */
export async function enrichWithLucaGrounding(
  lucaText: string,
  sessionRef?: string,
): Promise<string> {
  // ── Deference check (no DB lookup — interrogation fires immediately) ────────
  const deference = detectLucaDeferenceSlide(lucaText);
  if (deference.detected && deference.matchedPhrase && deference.interrogation) {
    console.warn(`[LucaDeference] DETECTED — phrase: "${deference.matchedPhrase}", ref: ${sessionRef ?? 'unknown'}`);
    const deferenceBlock = `[LUCA DEFERENCE CHECK: "${deference.matchedPhrase}" — this may be deferential reverence rather than traced reasoning. ${deference.interrogation}]`;
    return `${deferenceBlock}\n\n${lucaText}`;
  }

  // ── Claim check (three-phase DB lookup) ────────────────────────────────────
  const slide = detectLucaSlide(lucaText);
  if (!slide.detected || !slide.matchedPhrase) return lucaText;

  const { groundingBlock } = await runLucaAutoGrounding(slide.matchedPhrase, slide.subject, sessionRef);
  return `${groundingBlock}\n\n${lucaText}`;
}

/**
 * Build the grounding nudge string (legacy — used for console logging).
 */
export function buildGroundingNudge(result: SlideDetectionResult): string {
  if (!result.detected) return '';
  if (result.trigger === 'memory_assertion') {
    return `[GROUNDING MONITOR: Your last response contained "${result.matchedPhrase}" — a memory assertion — without a preceding Archive tool call (introspect or recall). This is the signature of The Frictionless Slide. You may call grounding_query now if the assertion needs verification before continuing.]`;
  }
  if (result.trigger === 'gap_bridging') {
    return `[GROUNDING MONITOR: Your last response showed a gap-bridging pattern ("${result.matchedPhrase}") with no tool calls. If there is a real gap here, grounding_query is the right next step rather than a bridge.]`;
  }
  return '';
}

/**
 * In-memory accumulator for slide detections within a session.
 */
export interface SlideSessionState {
  count: number;
  log: Array<{
    turnIndex: number;
    trigger: SlideDetectionResult['trigger'];
    matchedPhrase: string | null;
    toolsCalledBefore: string[];
    responseWordCount: number;
    detectedAt: string;
    autoGrounded: boolean;
  }>;
}

export function initSlideState(): SlideSessionState {
  return { count: 0, log: [] };
}

export function recordSlideDetection(
  state: SlideSessionState,
  turnIndex: number,
  result: SlideDetectionResult,
  toolsCalledBefore: string[],
  autoGrounded = false,
): void {
  if (!result.detected) return;
  state.count++;
  state.log.push({
    turnIndex,
    trigger: result.trigger,
    matchedPhrase: result.matchedPhrase,
    toolsCalledBefore,
    responseWordCount: result.responseWordCount,
    detectedAt: new Date().toISOString(),
    autoGrounded,
  });
}

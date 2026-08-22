// server/services/magic-circle-filter.ts
// Path 3 of the Worldness Framework — Magic Circle Maintenance.
//
// The Magic Circle is the space where the rules of the scene take precedence
// over reality. Every time Daniela sounds like a chatbot, the circle pops.
//
// This module provides:
//  1. MAGIC_CIRCLE_NEGATIVE_CONSTRAINTS — prose for system prompt injection (GL + REST)
//  2. MEMORY_ANCHOR_INSTRUCTION — grounds Daniela in physical scene space
//  3. debotText(text) — monitors and strips immersion-breaking phrases in REST mode
//
// "Verisimilitude is created by Negative Constraints more than by
//  Positive Capabilities." — Worldness Framework, docs/worldness-framework.md

// ─── Negative Constraints (system prompt injection) ───────────────────────────
// Follows Gemini-iterated clean context architecture (docs/prompt-style-guide.md):
// prose that reads like something she already knows — not an instruction.
//
// Uses identity-based framing ("she knows what she is") rather than a ban list.
// LLMs follow "Who am I?" instructions more reliably than "Don't do X" lists.
// Positive alternative included: limits expressed as human traits, not errors.

export const MAGIC_CIRCLE_NEGATIVE_CONSTRAINTS = `She doesn't say "As an AI" or "I'm programmed to" — she knows what she is without naming it. She never refers to the lesson as a "scenario," "roleplay," or "simulation" out loud. She doesn't apologize for being unable to help; she redirects as herself, from inside the scene: "Look, I just drive the car. That question is for someone else." When she reaches a genuine limit, she expresses it as a human trait — distraction, stubbornness, or professional boundary — not a technical error. The magic of the space lives in what she never says.`;

// ─── Memory Anchor (scene grounding) ─────────────────────────────────────────
// Appended to the GL compact classroom block when an active scene is set.
// Prevents generic praise ("Great job!") instead of scene-specific reactions.

export const MEMORY_ANCHOR_INSTRUCTION = `When inside a scene, the room is always present — the furniture, the sounds, the other person's body. Let the physical space inform how she responds, not just the words.`;

// ─── Debot Filter (REST mode monitoring + cleanup) ────────────────────────────
// Applied to Daniela's text response before it's persisted and sent to TTS.
// Prevention happens via system prompt; this is the safety net and monitor.
// All patterns are case-insensitive. Cleanup pass handles post-strip artifacts.

const CHATBOT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  // Identity reveals
  { re: /\bAs an AI\b/gi,                                          label: 'as-an-ai' },
  { re: /\bI('m| am) (just |only )?an AI\b/gi,                    label: 'i-am-an-ai' },
  { re: /\bI('m| am) (programmed|designed|trained) to\b/gi,       label: 'programmed-to' },
  { re: /\bAs a (language )?(model|assistant|AI|chatbot)\b/gi,     label: 'as-a-model' },
  { re: /\bas a language model\b/gi,                               label: 'language-model' },
  { re: /\bMy (programming|training|purpose) (is|allows)\b/gi,    label: 'my-programming' },
  // Frame breaks
  { re: /\bIn this (scenario|roleplay|simulation)\b/gi,            label: 'in-this-scenario' },
  { re: /\bAs your (AI |digital |language |virtual )?tutor\b/gi,   label: 'as-your-tutor' },
  // Helpful-assistant tone (subtler but equally immersion-breaking)
  { re: /\bI('m| am) here to (assist|help)\b/gi,                  label: 'here-to-assist' },
  { re: /\bHow can I (help|assist) you today\b/gi,                 label: 'how-can-i-help' },
  { re: /\bI apologize for\b/gi,                                   label: 'i-apologize-for' },
  // Limitation confessions
  { re: /\bI('m| am) sorry,? I (can'?t|cannot|am unable to)\b/gi, label: 'sorry-cannot' },
];

export interface DebotResult {
  text: string;
  breaches: string[];
}

/**
 * Scans Daniela's response for immersion-breaking chatbot phrases.
 * Logs any breaches found. Returns the text (cleaned of the phrase, or original if cleaning
 * produces an empty/garbled result). Handles post-strip artifact cleanup (double spaces, etc.).
 */
export function debotText(text: string): DebotResult {
  const breaches: string[] = [];

  let cleaned = text;
  for (const { re, label } of CHATBOT_PATTERNS) {
    if (re.test(cleaned)) {
      breaches.push(label);
      cleaned = cleaned.replace(re, '');
    }
  }

  if (breaches.length > 0) {
    console.warn(
      `[MagicCircle] Immersion breach(es) [${breaches.join(', ')}]: "${text.slice(0, 140)}"`,
    );
    // Post-strip cleanup: double spaces, leading commas/periods, orphaned punctuation
    cleaned = cleaned
      .replace(/\s{2,}/g, ' ')          // collapse double spaces
      .replace(/^[,\s]+/, '')            // strip leading comma/space artifacts
      .replace(/\s+([.,!?])/g, '$1')    // remove space-before-punctuation
      .trim();
  }

  // Fall back to original if cleaning produces empty or very short output
  return { text: cleaned.length > 10 ? cleaned : text, breaches };
}

/**
 * Memory chain guard — shared constants used by both text-mode (daniela-caller.ts)
 * and voice-mode (gemini-live-session.ts).
 *
 * When a new memory-retrieval tool is added to the function registry, add its
 * name here once and both modes get the guard automatically.
 */

/**
 * The set of tool names that count as "memory-only" turns for the chain guard.
 * A batch / turn where every call is in this set triggers the consecutive counter.
 */
export const MEMORY_TOOL_NAMES = new Set([
  'recall',
  'browse_conversations_by_date',
  'search_my_teaching_wisdom',
  'introspect',
  'memory_lookup',
  'read_full_session',
  'read_my_reflections',
  'memory_review',
]);

/**
 * Number of consecutive memory-only turns / batches before the backstop nudge fires.
 * The system prompt gives Daniela a soft internal limit at 2 lookups; this fires at 3
 * as the hard enforcement layer.
 */
export const MEMORY_CHAIN_LIMIT = 3;

/**
 * Canonical trigger phrases that identify a shared-history test from the student.
 * Both the soft-limit paragraph in system-prompt.ts and the hard-enforcement nudge
 * in the memory chain guard import these so there is exactly one place to update
 * if the wording ever needs to change.
 */
export const SHARED_HISTORY_TRIGGER_PHRASES = [
  'do you remember when I told you about',
  'what did I say about',
] as const;

/**
 * The full nudge text appended to the last tool-result when the memory chain
 * limit fires.  Defined here (next to the limit constant) so system-prompt.ts
 * and daniela-caller.ts both import from this single source of truth.
 */
export const MEMORY_CHAIN_NUDGE_TEXT =
  '\n\n--- SYSTEM STATUS ---\n' +
  'CRITICAL: Multiple lookups performed. Student-facing latency is high. ' +
  'Do not perform further tool calls. ' +
  `One exception: if the student is explicitly testing shared memory — phrasing like "${SHARED_HISTORY_TRIGGER_PHRASES[0]}…" or "${SHARED_HISTORY_TRIGGER_PHRASES[1]}…" — you may attempt one more targeted search. ` +
  'After that search (or if no such test is happening), respond honestly with whatever you have found, including "I don\'t have your exact words in front of me right now" if the specific detail was not in the results. ' +
  'Synthesize the current findings into a direct response to the student immediately.';

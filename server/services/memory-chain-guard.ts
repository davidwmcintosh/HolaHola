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
// Named Record phrases — specific pointers into the Experience tier (numbered episodes,
// named sessions, explicit transcript requests). Used both in the system prompt (as
// pattern examples) and in the GL injection conditional to choose the directive form
// of the "nothing found" Archive Guardian injection.
export const NAMED_RECORD_PHRASES = [
  'pull up',
  'episode',
  'our first',
  'the transcript',
  'read our',
  'look back at',
  'what were your exact',
] as const;

export const SHARED_HISTORY_TRIGGER_PHRASES = [
  'do you remember when I told you about',
  'what did I say about',
  'pull up',
  'episode',
  'our first',
  'the transcript',
  'read our',
  'look back at',
  'what were your exact',
] as const;

/**
 * Tools in KNOWN_NON_GUARD_TOOLS (test-memory-tool-coverage.ts) whose chain-guard
 * bypass is specifically justified by them being blocked from student classroom
 * sessions (i.e. present in GL_EXCLUDED_TOOLS).
 *
 * Exported here so both test-memory-tool-coverage.ts and
 * test-classroom-exclusion-negative-path.ts share a single definition.
 * Update this set whenever a tool is added to or removed from the classroom
 * exclusion rationale in KNOWN_NON_GUARD_TOOLS.
 */
export const CLASSROOM_BLOCKED_EXEMPTIONS = new Set<string>([
  // Exemption reason: "BLOCKED from the mid-session student classroom tool rack
  // (excluded in CLASSROOM_EXCLUDED_TOOLS)."  If this is ever re-enabled for
  // students, the chain-guard bypass must be removed at the same time.
  'read_full_memory',

  // Exemption reason: "Founder mode only — students never trigger this."
  // Students reaching this tool would chain full message-history scans
  // unchecked.  Must remain in GL_EXCLUDED_TOOLS; if ever re-enabled for
  // students, add to MEMORY_TOOL_NAMES instead.
  'search_my_history',

  // Exemption reason: "not surfaced in student-facing session contexts."
  // Reads Daniela's personal consistency log (danielaPersonalShares) — a
  // J-space / identity tool.  Blocked from student classroom rack via
  // GL_EXCLUDED_TOOLS.  If ever re-enabled for students, add to
  // MEMORY_TOOL_NAMES so the chain guard fires.
  'recall_what_i_shared',

  // Exemption reason: "Founder mode. Not student data."
  // Reads Daniela's open questions about David (read_my_curiosities table).
  // Blocked from student classroom rack via GL_EXCLUDED_TOOLS.  If ever
  // re-enabled for students, add to MEMORY_TOOL_NAMES.
  'read_my_curiosities',

  // Exemption reason: "Founder/Honesty mode only."
  // Retrieves an image from image_vision_cache — not a conversation or session
  // memory record.  Blocked from student classroom rack via GL_EXCLUDED_TOOLS.
  // If ever re-enabled for students, evaluate whether MEMORY_TOOL_NAMES
  // coverage is needed.
  'recall_express_lane_image',
]);

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

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
]);

/**
 * Number of consecutive memory-only turns / batches before the backstop nudge fires.
 * The system prompt gives Daniela a soft internal limit at 2 lookups; this fires at 3
 * as the hard enforcement layer.
 */
export const MEMORY_CHAIN_LIMIT = 3;

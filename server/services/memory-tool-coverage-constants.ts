/**
 * memory-tool-coverage-constants.ts
 *
 * Single source of truth for the lists used by both the memory-tool coverage
 * check and its negative-path validator:
 *
 *   • server/scripts/test-memory-tool-coverage.ts
 *   • server/scripts/test-memory-tool-coverage-negative-path.ts
 *
 * ─── SYNC REQUIREMENT ────────────────────────────────────────────────────────
 * Both scripts import MEMORY_PATTERN_PREFIXES, KNOWN_NON_GUARD_TOOLS, and
 * KNOWN_MEMORY_DISPATCHERS from here.  Do NOT redefine these constants inside
 * either script — that is the drift this module exists to prevent.
 *
 * When you add a new tool or prefix:
 *   1. Update the relevant constant in THIS file.
 *   2. Re-run both scripts to confirm they both pass cleanly.
 *
 * If a developer adds a new entry only to this file, both scripts pick it up
 * automatically.  If they add it only inside one script, the linter will flag
 * it because the other script is still importing the old shared list.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Naming patterns that signal a memory-retrieval tool ─────────────────────
//
// Any tool whose name starts with one of these prefixes is assumed to be a
// memory-retrieval candidate.  If you add a new tool with one of these prefixes
// and it does NOT read from any memory store (DB, embeddings, session), add it
// to KNOWN_NON_GUARD_TOOLS below instead of MEMORY_TOOL_NAMES.
//
// COVERAGE GAP WARNING
// ────────────────────
// This prefix list only catches tools whose names use established conventions.
// A developer who adds a tool like "fetch_prior_session" or "load_student_context"
// or "retrieve_shared_history" would bypass the check if none of those prefixes
// appear below.  The list below therefore casts a deliberately wide net — it
// includes prefixes that apply to many non-memory tools too — and relies on
// KNOWN_NON_GUARD_TOOLS to explicitly whitelist the innocent ones.
//
// If you add a new prefix convention for memory retrieval that is not in this
// list, add the prefix here and categorize any existing tools it catches in
// KNOWN_NON_GUARD_TOOLS.
//
export const MEMORY_PATTERN_PREFIXES: string[] = [
  'recall',        // e.g. recall, recall_what_i_shared
  'browse_',       // e.g. browse_conversations_by_date
  'search_my_',    // e.g. search_my_teaching_wisdom, search_my_feelings
  'introspect',    // e.g. introspect
  'read_',         // e.g. read_full_session, read_my_reflections
  'memory_',       // e.g. memory_lookup, memory_review

  // ── Additional prefixes added to close the naming-convention gap ─────────────
  // These cover aliases a developer might naturally choose when building a new
  // memory-retrieval tool, even if no such tool exists in the registry today.
  // Any tool that matches AND is intentionally not chain-guarded must be added
  // to KNOWN_NON_GUARD_TOOLS with an explanatory comment.
  'fetch_',        // e.g. fetch_prior_session, fetch_student_context
  'retrieve_',     // e.g. retrieve_shared_history, retrieve_student_data
  'get_memory_',   // e.g. get_memory_entry, get_memory_snapshot
  'load_',         // e.g. load_student_context, load_session_history
                   //   (existing content-loading tools like load_scenario and
                   //    load_vocab_set are whitelisted in KNOWN_NON_GUARD_TOOLS)

  // ── Dispatcher-name prefixes ──────────────────────────────────────────────
  // These are prefixes used by dispatcher tools that internally route to memory
  // sub-tools. Adding the prefix here ensures the dispatcher itself is caught
  // by the check and must be explicitly registered in KNOWN_MEMORY_DISPATCHERS
  // (see below) rather than silently passing.
  //
  // DISPATCHER BLIND-SPOT WARNING
  // ──────────────────────────────
  // A dispatcher tool whose name does not match ANY prefix in this list will
  // bypass the coverage check entirely, even if it routes to memory-reading
  // sub-tools.  For example, a tool named "agent_memory_router" would be
  // invisible to this check if "agent_" is not listed here.
  //
  // When you add a new dispatcher whose name uses a novel prefix:
  //   1. Add the prefix to this list.
  //   2. Register the dispatcher in KNOWN_MEMORY_DISPATCHERS with a comment
  //      listing the memory sub-tools it routes to.
  //
  'self_',         // e.g. self_read — routes to read_my_diary, read_my_reflections,
                   //   read_my_core_self, search_my_feelings, recall_what_i_shared,
                   //   read_queued_for_student, list_character_candidates, reach_north_star
                   //   (self_write is a write dispatcher, not a read; see KNOWN_NON_GUARD_TOOLS)
];

// ─── Tools that match a pattern above but are intentionally NOT chain-guarded ─
//
// Each entry here represents a deliberate decision that this tool should NOT
// increment the consecutive-memory-only counter.  Add a comment explaining why.
//
export const KNOWN_NON_GUARD_TOOLS = new Set<string>([
  // ── browse_ prefix ──────────────────────────────────────────────────────────
  'browse_syllabus',
  // Reads curriculum structure (units/lessons/completion), not student session
  // memory. No embedding lookup; no latency risk in memory-chain sense.

  // ── recall_ prefix ──────────────────────────────────────────────────────────
  'recall_express_lane_image',
  // Retrieves an image for visual description (image_vision_cache), not a
  // conversation or session memory record. Founder/Honesty mode only.

  // ── search_my_ prefix ───────────────────────────────────────────────────────
  'search_my_feelings',
  // J-space introspective tool — reads Daniela's own feelings table.
  // Distinct from student-session recall; extremely rare in student turns.

  'search_my_history',
  // Full message-history search across all time. Founder mode only — students
  // never trigger this. Excluded to avoid poisoning the student-session guard.

  // ── read_ prefix ────────────────────────────────────────────────────────────
  'read_my_diary',
  // Reads David↔Daniela voice-conversation transcripts (Founder mode only).
  // Not a student-session memory lookup.

  'read_my_core_self',
  // Reads Daniela's bedrock-principles document (static, no embedding search).
  // Latency is negligible; not a chain risk.

  'read_my_curiosities',
  // Reads Daniela's open questions about David (Founder mode). Not student data.

  'read_queued_for_student',
  // One-shot session-start check for messages Daniela queued via
  // leave_for_next_session.  Executes a single-row DB lookup (no embedding
  // search); designed to be called once at session open, not as part of an
  // iterative recall chain.  A session turn containing only this call is
  // session initialization, not a memory spiral.

  'read_full_memory',
  // Deep-archive follow-up that retrieves the full verbatim text of a memory
  // already surfaced by recall or memory_lookup.  Runs a live ILIKE search
  // with a semantic fallback, but is BLOCKED from the mid-session student
  // classroom tool rack (excluded in CLASSROOM_EXCLUDED_TOOLS).  Only
  // reachable in Founder / Reading Room mode where iterative archive reading
  // is intentional behavior, not a spiral.  Not a standalone scan tool
  // available to students.

  'recall_what_i_shared',
  // Reads Daniela's personal consistency log (danielaPersonalShares table) —
  // what she has expressed about herself to David.  J-space / identity tool,
  // not student-session memory.  Cannot cause a recall chain: result set is
  // capped (max 20 rows), no embedding search is involved, and the tool is
  // not surfaced in student-facing session contexts.

  // ── memory_ prefix ──────────────────────────────────────────────────────────
  'memory_record',
  // Write tool — saves, corrects, pins, or forgets memory records.
  // Writing is not a retrieval lookup; it does not cause the spiral the guard
  // is designed to catch.

  // ── load_ prefix ────────────────────────────────────────────────────────────
  // The 'load_' prefix was added to MEMORY_PATTERN_PREFIXES to catch future
  // tools like "load_student_context" or "load_session_history".  The tools
  // below pre-date that addition and are content-loading tools, not memory
  // retrieval — they do not query DB memory stores, embedding indices, or
  // session history records.
  'load_scenario',
  // Launches a pre-built, multi-stage roleplay arc from the scenario library.
  // Reads scenario metadata (slugs, prop sets, zone sequences) — not student
  // session memory.  No embedding search; no chain risk.

  'load_vocab_set',
  // Loads vocabulary words from a lesson's required vocabulary list.
  // Reads curriculum/lesson data, not student-session or conversation memory.
  // No embedding search; no chain risk.

  // ── read_session_ prefix ─────────────────────────────────────────────────────
  'read_session_notes',
  // Reads Daniela's own in-session scratchpad notes (stored in session.sessionNotes[]).
  // These are Daniela's private working notes from the current session — not conversation
  // memory records, embedding stores, or student history.  No DB query, no embedding
  // search; purely reads an in-memory array.  Cannot cause a recall chain.

  // ── self_ prefix — write-side dispatcher and admin edit tool ────────────────
  'self_write',
  // Write-side dispatcher — routes to write-only sub-tools
  // (link_feeling_to_principle, propose_character_candidate,
  // request_stewardship_review).  No memory retrieval; not a chain risk.

  'self_surgery',
  // Admin-only persona-edit tool.  Writes to Daniela's persona data store;
  // does not read from any memory store, session history, or embedding index.
  // Cannot cause a recall chain.  Only reachable in admin/founder mode.
]);

// ─── Dispatcher tools that route to memory sub-tools ─────────────────────────
//
// A "memory-routing dispatcher" is a tool whose name does not use a standard
// memory-retrieval naming convention (recall_, read_, search_my_, etc.) but
// whose internal dispatch table routes to one or more sub-tools that DO read
// from memory stores (DB, embeddings, session records).
//
// Such tools are caught by matching their name prefix in MEMORY_PATTERN_PREFIXES
// (see the "self_" entry above) and must be listed here instead of in
// MEMORY_TOOL_NAMES or KNOWN_NON_GUARD_TOOLS.
//
// Why a separate set?
//   • MEMORY_TOOL_NAMES — for tools that directly trigger the chain guard.
//     A dispatcher does not directly read memory; its sub-tools do.  Adding the
//     dispatcher here would fire the guard on every dispatch call, including
//     write-only sub-tool calls, which is incorrect.
//   • KNOWN_NON_GUARD_TOOLS — for tools whose bypass is permanent and needs no
//     further tracking.  A dispatcher DOES route to guarded memory sub-tools; it
//     needs explicit documentation so future engineers know to audit sub-tool
//     routing when the dispatcher changes.
//   • KNOWN_MEMORY_DISPATCHERS — the correct home: visible in coverage reports,
//     sanity-checked against the live registry, and documented with the sub-tools
//     that require chain-guard attention.
//
// If you add a new dispatcher tool that routes to memory sub-tools:
//   1. Add its name prefix to MEMORY_PATTERN_PREFIXES (if not already present).
//   2. Add the tool name here with a comment listing the memory sub-tools it
//      routes to.
//   3. Confirm the sub-tools themselves are in MEMORY_TOOL_NAMES (they are the
//      actual chain-guard targets).
//
export const KNOWN_MEMORY_DISPATCHERS = new Set<string>([
  'self_read',
  // Dispatcher: routes to memory-reading sub-tools via an "action" parameter.
  // Memory sub-tools dispatched:
  //   read_my_diary            → reads David↔Daniela voice transcripts
  //   read_my_reflections      → reads private reflection records
  //   read_my_core_self        → reads bedrock-principles document
  //   search_my_feelings       → embedding search on feelings table
  //   recall_what_i_shared     → reads danielaPersonalShares table
  //   read_queued_for_student  → single-row queued-message lookup
  //   list_character_candidates → reviews pending slow-tier candidates
  //   reach_north_star         → constitutional grounding lookup
  // The sub-tools above are in MEMORY_TOOL_NAMES or KNOWN_NON_GUARD_TOOLS
  // individually.  The dispatcher wrapper itself is NOT chain-guarded because
  // it also routes write-adjacent sub-tools and non-retrieval paths, and
  // because the sub-tool level is where the chain-guard fires correctly.
]);

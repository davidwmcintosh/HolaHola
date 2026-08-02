/**
 * test-memory-tool-coverage.ts
 *
 * Lint/coverage check: every tool in the Daniela function registry whose name
 * matches a memory-retrieval naming pattern must be explicitly listed in either:
 *
 *   A) MEMORY_TOOL_NAMES  — counted against the chain guard (most recall-style tools)
 *   B) KNOWN_NON_GUARD_TOOLS — intentionally excluded, with a comment explaining why
 *
 * If a developer adds "recall_new_thing" and doesn't update either list, this
 * script exits non-zero so CI catches it.
 *
 * Run: npx tsx server/scripts/test-memory-tool-coverage.ts
 */

import { MEMORY_TOOL_NAMES, CLASSROOM_BLOCKED_EXEMPTIONS } from '../services/memory-chain-guard';
import { DANIELA_FUNCTION_DECLARATIONS, GL_EXCLUDED_TOOLS } from '../services/daniela-function-registry';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

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
const MEMORY_PATTERN_PREFIXES = [
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
const KNOWN_NON_GUARD_TOOLS = new Set<string>([
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
const KNOWN_MEMORY_DISPATCHERS = new Set<string>([
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

// ─── Non-memory dispatcher tools ─────────────────────────────────────────────
//
// Every tool that uses dispatchSubTool() internally must appear in either
// KNOWN_MEMORY_DISPATCHERS (above) or this set.  Together they form the
// complete registry of all dispatcher tools in the codebase.
//
// WHY THIS EXISTS
// ───────────────
// MEMORY_PATTERN_PREFIXES only catches dispatchers whose name prefix is
// already listed there.  A developer who names a new dispatcher "agent_",
// "meta_", or "context_" would bypass the coverage check entirely — just
// as "self_read" once did before its prefix was registered (the original
// blind-spot that motivated Task #336).
//
// The static check below reads native-fc-handlers.ts at CI time, extracts
// every tool name passed to dispatchSubTool() via regex, and verifies each
// one is either:
//   a) covered by a prefix in MEMORY_PATTERN_PREFIXES (already audited), or
//   b) listed here.
// Any dispatcher whose prefix is novel AND is not listed here will cause
// the script to exit non-zero, regardless of its prefix.
//
// HOW TO UPDATE
// ─────────────
// When you add a new dispatcher tool that uses dispatchSubTool():
//   • Routes to ANY memory-reading sub-tool → add to KNOWN_MEMORY_DISPATCHERS
//     AND add its name prefix to MEMORY_PATTERN_PREFIXES.
//   • Routes ONLY to non-memory sub-tools → add it here with a comment
//     listing the sub-tools it routes to.
//
// NOTE: dispatchers whose prefix IS already in MEMORY_PATTERN_PREFIXES
// (e.g. memory_record "memory_", self_write "self_") are handled by the
// existing pattern check and do NOT need an entry here.
//
const KNOWN_NON_MEMORY_DISPATCHERS = new Set<string>([
  // ── widget_ dispatchers ──────────────────────────────────────────────────
  // Each routes to UI-widget sub-tools only; no DB/embedding reads.
  'widget_time',    // sub-tools: set_clock, countdown_timer, etc.
  'widget_state',   // sub-tools: show_widget, hide_widget, toggle_widget
  'widget_body',    // sub-tools: set_body_part, set_face_part, set_hand_part, set_thermometer, set_emotion
  'widget_scene',   // sub-tools: open_scene, add_to_scene, remove_from_scene, move_in_scene, clear_scene
  'widget_board',   // sub-tools: whiteboard/conjugation/calendar widget actions
  'widget_media',   // sub-tools: audio/video media controls

  // ── exercise_ dispatchers ────────────────────────────────────────────────
  // Each routes to exercise/drill sub-tools only; no memory retrieval.
  'exercise_language',  // sub-tools: language drill types (matching, fill-in, etc.)
  'exercise_drill',     // sub-tools: pronunciation / translation drill sub-tools
  'exercise_content',   // sub-tools: content-generation exercise sub-tools

  // ── admin_ dispatchers ───────────────────────────────────────────────────
  // Admin/founder-mode only; no student memory retrieval.
  'admin_session',  // sub-tools: session-admin actions (switch, override, inspect)
  'admin_tools',    // sub-tools: administrative utility sub-tools

  // ── teaching_ dispatchers ────────────────────────────────────────────────
  // Routes to card-display and content-delivery sub-tools; no memory reads.
  'teaching_cards',    // sub-tools: vocab cards, grammar cards, etc.
  'teaching_content',  // sub-tools: content-delivery sub-tools
]);

// ─── Run ─────────────────────────────────────────────────────────────────────

sep();
console.log(B('Memory-tool chain-guard coverage check'));
console.log(Y('  Every pattern-matching tool must be in MEMORY_TOOL_NAMES, KNOWN_NON_GUARD_TOOLS,'));
console.log(Y('  or KNOWN_MEMORY_DISPATCHERS.  Failing to categorize a new tool is a test failure.'));
sep();

const allToolNames: string[] = DANIELA_FUNCTION_DECLARATIONS.map((d) => d.name as string);

// Find all tools matching any memory-retrieval pattern
const patternMatches = allToolNames.filter((name) =>
  MEMORY_PATTERN_PREFIXES.some((prefix) => name.startsWith(prefix)),
);

let allPassed = true;
const uncategorized: string[] = [];
const inGuard: string[] = [];
const inExclusion: string[] = [];
const inDispatcher: string[] = [];

for (const toolName of patternMatches) {
  if (MEMORY_TOOL_NAMES.has(toolName)) {
    inGuard.push(toolName);
  } else if (KNOWN_NON_GUARD_TOOLS.has(toolName)) {
    inExclusion.push(toolName);
  } else if (KNOWN_MEMORY_DISPATCHERS.has(toolName)) {
    inDispatcher.push(toolName);
  } else {
    uncategorized.push(toolName);
  }
}

// ── Report: guarded tools ─────────────────────────────────────────────────────
console.log('\n' + B('Guarded tools (in MEMORY_TOOL_NAMES):'));
for (const name of inGuard) {
  console.log(`  ${G('✓')} ${name}`);
}
if (inGuard.length === 0) {
  console.log(Y('  (none)'));
}

// ── Report: intentionally excluded tools ──────────────────────────────────────
console.log('\n' + B('Intentionally excluded tools (KNOWN_NON_GUARD_TOOLS):'));
for (const name of inExclusion) {
  console.log(`  ${Y('○')} ${name}`);
}
if (inExclusion.length === 0) {
  console.log(Y('  (none)'));
}

// ── Report: memory-routing dispatchers ───────────────────────────────────────
console.log('\n' + B('Memory-routing dispatchers (KNOWN_MEMORY_DISPATCHERS):'));
console.log(Y('  These tools route to memory sub-tools internally but are not chain-guarded'));
console.log(Y('  at the dispatcher level.  The sub-tools they dispatch to ARE guarded.'));
for (const name of inDispatcher) {
  console.log(`  ${B('⇒')} ${name}`);
}
if (inDispatcher.length === 0) {
  console.log(Y('  (none)'));
}

// ── Report: uncategorized tools — FAIL ───────────────────────────────────────
sep();
if (uncategorized.length > 0) {
  console.log(R('FAIL — uncategorized memory-pattern tools found:'));
  console.log('');
  for (const name of uncategorized) {
    console.log(R(`  ✗ ${name}`));
  }
  console.log('');
  console.log(R('  Each tool above matches a memory-retrieval naming pattern but is'));
  console.log(R('  present in NONE of: MEMORY_TOOL_NAMES, KNOWN_NON_GUARD_TOOLS,'));
  console.log(R('  or KNOWN_MEMORY_DISPATCHERS.'));
  console.log('');
  console.log(Y('  To fix: add the tool to one of these lists in:'));
  console.log(Y('    • server/services/memory-chain-guard.ts  (if it should trigger the guard)'));
  console.log(Y('    • server/scripts/test-memory-tool-coverage.ts KNOWN_NON_GUARD_TOOLS'));
  console.log(Y('      (if it intentionally bypasses the guard — add a comment explaining why)'));
  console.log(Y('    • server/scripts/test-memory-tool-coverage.ts KNOWN_MEMORY_DISPATCHERS'));
  console.log(Y('      (if it is a dispatcher that routes to memory sub-tools internally)'));
  console.log('');
  allPassed = false;
} else {
  console.log(G('✓ All pattern-matching tools are categorized.'));
}

// ── Sanity: verify MEMORY_TOOL_NAMES has no phantom entries ───────────────────
sep();
console.log(B('Sanity check: MEMORY_TOOL_NAMES entries exist in the registry'));
const toolNameSet = new Set(allToolNames);
const phantoms: string[] = [];
for (const guardedName of MEMORY_TOOL_NAMES) {
  if (!toolNameSet.has(guardedName)) {
    phantoms.push(guardedName);
  }
}
if (phantoms.length > 0) {
  console.log(R('FAIL — MEMORY_TOOL_NAMES contains tool names not found in the registry:'));
  for (const name of phantoms) {
    console.log(R(`  ✗ ${name}  (was it renamed or removed?)`));
  }
  console.log(Y('  Remove or rename these entries in server/services/memory-chain-guard.ts'));
  allPassed = false;
} else {
  console.log(G('✓ Every entry in MEMORY_TOOL_NAMES exists in the live registry.'));
}

// ── Sanity: verify KNOWN_NON_GUARD_TOOLS has no phantom entries ──────────────
sep();
console.log(B('Sanity check: KNOWN_NON_GUARD_TOOLS entries exist in the registry'));
const exclusionPhantoms: string[] = [];
for (const excludedName of KNOWN_NON_GUARD_TOOLS) {
  if (!toolNameSet.has(excludedName)) {
    exclusionPhantoms.push(excludedName);
  }
}
if (exclusionPhantoms.length > 0) {
  console.log(R('FAIL — KNOWN_NON_GUARD_TOOLS contains tool names not found in the registry:'));
  for (const name of exclusionPhantoms) {
    console.log(R(`  ✗ ${name}  (was it renamed or removed?)`));
  }
  console.log(Y('  Remove or rename these entries in KNOWN_NON_GUARD_TOOLS above.'));
  allPassed = false;
} else {
  console.log(G('✓ Every entry in KNOWN_NON_GUARD_TOOLS exists in the live registry.'));
}

// ── Sanity: verify KNOWN_MEMORY_DISPATCHERS has no phantom entries ───────────
sep();
console.log(B('Sanity check: KNOWN_MEMORY_DISPATCHERS entries exist in the registry'));
console.log(Y('  If a dispatcher was renamed or removed, its entry here becomes a phantom.'));
console.log(Y('  Remove the phantom and update MEMORY_PATTERN_PREFIXES if its prefix is no longer needed.'));
const dispatcherPhantoms: string[] = [];
for (const dispatcherName of KNOWN_MEMORY_DISPATCHERS) {
  if (!toolNameSet.has(dispatcherName)) {
    dispatcherPhantoms.push(dispatcherName);
  }
}
if (dispatcherPhantoms.length > 0) {
  console.log(R('FAIL — KNOWN_MEMORY_DISPATCHERS contains tool names not found in the registry:'));
  for (const name of dispatcherPhantoms) {
    console.log(R(`  ✗ ${name}  (was it renamed or removed?)`));
  }
  console.log(Y('  Remove or rename these entries in KNOWN_MEMORY_DISPATCHERS above.'));
  allPassed = false;
} else {
  console.log(G('✓ Every entry in KNOWN_MEMORY_DISPATCHERS exists in the live registry.'));
}

// ── Classroom-exclusion sync check ───────────────────────────────────────────
//
// CLASSROOM_BLOCKED_EXEMPTIONS is the single source of truth for tools whose
// chain-guard bypass is justified by classroom exclusion.  It is imported from
// server/services/memory-chain-guard.ts so this script and
// test-classroom-exclusion-negative-path.ts always agree on the list.
//
sep();
console.log(B('Classroom-exclusion sync: KNOWN_NON_GUARD_TOOLS entries blocked from student sessions'));
console.log(Y('  Each tool listed in CLASSROOM_BLOCKED_EXEMPTIONS must also be in GL_EXCLUDED_TOOLS.'));
console.log(Y('  A drift here means a student could chain the tool without the guard ever firing.'));

const classroomDrift: string[] = [];
for (const toolName of CLASSROOM_BLOCKED_EXEMPTIONS) {
  if (GL_EXCLUDED_TOOLS.has(toolName)) {
    console.log(`  ${G('✓')} ${toolName}  (still in GL_EXCLUDED_TOOLS)`);
  } else {
    console.log(R(`  ✗ ${toolName}  — NOT in GL_EXCLUDED_TOOLS but exempted from chain guard on that basis`));
    classroomDrift.push(toolName);
  }
}

if (classroomDrift.length > 0) {
  console.log('');
  console.log(R('FAIL — classroom-exclusion drift detected:'));
  for (const name of classroomDrift) {
    console.log(R(`  ✗ ${name}`));
  }
  console.log('');
  console.log(Y('  To fix, do ONE of the following for each drifted tool:'));
  console.log(Y('    a) Re-add it to GL_EXCLUDED_TOOLS in daniela-function-registry.ts'));
  console.log(Y('       (if it should still be blocked from student classroom sessions), OR'));
  console.log(Y('    b) Remove it from CLASSROOM_BLOCKED_EXEMPTIONS here AND add it to'));
  console.log(Y('       MEMORY_TOOL_NAMES in memory-chain-guard.ts so the chain guard fires'));
  console.log(Y('       (if it is now intentionally reachable in student sessions).'));
  allPassed = false;
} else if (CLASSROOM_BLOCKED_EXEMPTIONS.size > 0) {
  console.log(`  ${G('✓')} All classroom-blocked exemptions are still excluded from student sessions.`);
}

// ── Static check: every dispatchSubTool() caller is in the dispatcher registry ─
//
// Read native-fc-handlers.ts and extract every tool name passed as the 5th
// argument to dispatchSubTool() (the dispatcher tool name, e.g. 'widget_time').
// Verify that each name is either:
//   a) covered by a prefix in MEMORY_PATTERN_PREFIXES — already audited by the
//      pattern-match check above, OR
//   b) listed in KNOWN_NON_MEMORY_DISPATCHERS.
//
// This catches any future dispatcher whose prefix is novel (e.g. "agent_",
// "meta_", "context_") before it can bypass the coverage check silently.
//
sep();
console.log(B('Static check: every dispatchSubTool() caller is in the dispatcher registry'));
console.log(Y('  Parses native-fc-handlers.ts to extract all dispatcher tool names.'));
console.log(Y('  Each must be covered by a prefix in MEMORY_PATTERN_PREFIXES OR listed in'));
console.log(Y('  KNOWN_NON_MEMORY_DISPATCHERS — no dispatcher may be invisible to the check.'));

import { readFileSync } from 'fs';
import { resolve } from 'path';

const handlersPath = resolve(process.cwd(), 'server/services/native-fc-handlers.ts');
let handlersSource: string;
try {
  handlersSource = readFileSync(handlersPath, 'utf-8');
} catch (e) {
  console.log(R(`FAIL — could not read native-fc-handlers.ts: ${e}`));
  allPassed = false;
  handlersSource = '';
}

// dispatchSubTool call shape:
//   this.dispatchSubTool(sessionId, session, firstArg, paramsArg, 'dispatcher_name', 'paramKey')
// Capture the 5th argument (4th 0-indexed after the opening paren).
const dispatchSubToolRegex = /dispatchSubTool\s*\([^,]+,[^,]+,[^,]+,[^,]+,\s*'([^']+)'/g;
const extractedDispatchers = new Set<string>();
if (handlersSource) {
  let m: RegExpExecArray | null;
  while ((m = dispatchSubToolRegex.exec(handlersSource)) !== null) {
    extractedDispatchers.add(m[1]);
  }
  console.log(`\n  Dispatchers extracted from native-fc-handlers.ts: ${extractedDispatchers.size}`);
  for (const name of [...extractedDispatchers].sort()) {
    console.log(`    • ${name}`);
  }
}

// A dispatcher is "covered" if its prefix appears in MEMORY_PATTERN_PREFIXES
// (meaning the pattern check will catch it if it drifts) OR it is explicitly
// listed in KNOWN_NON_MEMORY_DISPATCHERS.
const uncoveredDispatchers: string[] = [];
for (const name of extractedDispatchers) {
  const prefixCovered = MEMORY_PATTERN_PREFIXES.some((prefix) => name.startsWith(prefix));
  const explicitlyCovered = KNOWN_NON_MEMORY_DISPATCHERS.has(name);
  if (!prefixCovered && !explicitlyCovered) {
    uncoveredDispatchers.push(name);
  }
}

if (uncoveredDispatchers.length > 0) {
  console.log('');
  console.log(R('FAIL — dispatcher(s) found in native-fc-handlers.ts with no coverage:'));
  console.log('');
  for (const name of uncoveredDispatchers) {
    console.log(R(`  ✗ ${name}  (prefix not in MEMORY_PATTERN_PREFIXES; not in KNOWN_NON_MEMORY_DISPATCHERS)`));
  }
  console.log('');
  console.log(Y('  To fix, do ONE of the following for each dispatcher above:'));
  console.log(Y('    a) If it routes to any memory-reading sub-tool:'));
  console.log(Y('       • Add its name prefix to MEMORY_PATTERN_PREFIXES'));
  console.log(Y('       • Add the tool name to KNOWN_MEMORY_DISPATCHERS'));
  console.log(Y('    b) If it routes ONLY to non-memory sub-tools:'));
  console.log(Y('       • Add the tool name to KNOWN_NON_MEMORY_DISPATCHERS'));
  console.log('');
  allPassed = false;
} else if (extractedDispatchers.size > 0) {
  console.log(G(`✓ All ${extractedDispatchers.size} dispatchSubTool() callers are covered.`));
}

// ── Sanity: KNOWN_NON_MEMORY_DISPATCHERS has no phantom entries ───────────────
sep();
console.log(B('Sanity check: KNOWN_NON_MEMORY_DISPATCHERS entries exist as dispatchSubTool() callers'));
console.log(Y('  If a dispatcher was renamed or removed, its entry here becomes a phantom.'));
const nonMemoryPhantoms: string[] = [];
for (const name of KNOWN_NON_MEMORY_DISPATCHERS) {
  if (handlersSource && !extractedDispatchers.has(name)) {
    nonMemoryPhantoms.push(name);
  }
}
if (nonMemoryPhantoms.length > 0) {
  console.log(R('FAIL — KNOWN_NON_MEMORY_DISPATCHERS contains entries not found as dispatchSubTool() callers:'));
  for (const name of nonMemoryPhantoms) {
    console.log(R(`  ✗ ${name}  (was it renamed or removed?)`));
  }
  console.log(Y('  Remove or rename these entries in KNOWN_NON_MEMORY_DISPATCHERS above.'));
  allPassed = false;
} else {
  console.log(G('✓ Every entry in KNOWN_NON_MEMORY_DISPATCHERS exists as a dispatchSubTool() caller.'));
}

// ── Summary ───────────────────────────────────────────────────────────────────
sep();
console.log(`  Pattern-matching tools found:  ${patternMatches.length}`);
console.log(`  Guarded (MEMORY_TOOL_NAMES):   ${inGuard.length}`);
console.log(`  Excluded (KNOWN_NON_GUARD):    ${inExclusion.length}`);
console.log(`  Dispatchers (KNOWN_DISPATCH):  ${inDispatcher.length}`);
console.log(`  Uncategorized (FAIL):          ${uncategorized.length}`);
console.log(`  Classroom-blocked exemptions:  ${CLASSROOM_BLOCKED_EXEMPTIONS.size} checked, ${classroomDrift.length} drifted`);
console.log(`  dispatchSubTool() callers:     ${extractedDispatchers.size} found, ${uncoveredDispatchers.length} uncovered`);
console.log(`  Non-memory dispatcher set:     ${KNOWN_NON_MEMORY_DISPATCHERS.size} entries, ${nonMemoryPhantoms.length} phantom`);
sep();

if (allPassed) {
  console.log(G('ALL CHECKS PASSED'));
  console.log(G('Chain-guard coverage is complete — no memory-pattern tool is silently unguarded.'));
  console.log('');
} else {
  console.log(R('ONE OR MORE CHECKS FAILED — see ✗ lines above.'));
  process.exit(1);
}

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
]);

// ─── Run ─────────────────────────────────────────────────────────────────────

sep();
console.log(B('Memory-tool chain-guard coverage check'));
console.log(Y('  Every pattern-matching tool must be in MEMORY_TOOL_NAMES or KNOWN_NON_GUARD_TOOLS.'));
console.log(Y('  Failing to categorize a new tool is a test failure.'));
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

for (const toolName of patternMatches) {
  if (MEMORY_TOOL_NAMES.has(toolName)) {
    inGuard.push(toolName);
  } else if (KNOWN_NON_GUARD_TOOLS.has(toolName)) {
    inExclusion.push(toolName);
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
  console.log(R('  present in NEITHER MEMORY_TOOL_NAMES nor KNOWN_NON_GUARD_TOOLS.'));
  console.log('');
  console.log(Y('  To fix: add the tool to one of these two lists in:'));
  console.log(Y('    • server/services/memory-chain-guard.ts  (if it should trigger the guard)'));
  console.log(Y('    • server/scripts/test-memory-tool-coverage.ts KNOWN_NON_GUARD_TOOLS'));
  console.log(Y('      (if it intentionally bypasses the guard — add a comment explaining why)'));
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

// ── Summary ───────────────────────────────────────────────────────────────────
sep();
console.log(`  Pattern-matching tools found:  ${patternMatches.length}`);
console.log(`  Guarded (MEMORY_TOOL_NAMES):   ${inGuard.length}`);
console.log(`  Excluded (KNOWN_NON_GUARD):    ${inExclusion.length}`);
console.log(`  Uncategorized (FAIL):          ${uncategorized.length}`);
console.log(`  Classroom-blocked exemptions:  ${CLASSROOM_BLOCKED_EXEMPTIONS.size} checked, ${classroomDrift.length} drifted`);
sep();

if (allPassed) {
  console.log(G('ALL CHECKS PASSED'));
  console.log(G('Chain-guard coverage is complete — no memory-pattern tool is silently unguarded.'));
  console.log('');
} else {
  console.log(R('ONE OR MORE CHECKS FAILED — see ✗ lines above.'));
  process.exit(1);
}

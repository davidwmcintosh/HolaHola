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

import { MEMORY_TOOL_NAMES } from '../services/memory-chain-guard';
import { DANIELA_FUNCTION_DECLARATIONS } from '../services/daniela-function-registry';

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
const MEMORY_PATTERN_PREFIXES = [
  'recall',        // e.g. recall, recall_what_i_shared
  'browse_',       // e.g. browse_conversations_by_date
  'search_my_',    // e.g. search_my_teaching_wisdom, search_my_feelings
  'introspect',    // e.g. introspect
  'read_',         // e.g. read_full_session, read_my_reflections
  'memory_',       // e.g. memory_lookup
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
  // Reads leave_for_next_session messages queued for the student.  One-shot at
  // session start, not part of iterative recall chains.

  'read_full_memory',
  // Retrieves complete verbatim content of a named memory record.  Used after
  // another search has already found the entry; the developer team has chosen
  // to treat it as a follow-up lookup, not a chain-triggering scan.

  'recall_what_i_shared',
  // Reads Daniela's personal consistency log (what she said about herself).
  // J-space / identity tool; not triggered by student memory-check questions.

  // ── memory_ prefix ──────────────────────────────────────────────────────────
  'memory_record',
  // Write tool — saves, corrects, pins, or forgets memory records.
  // Writing is not a retrieval lookup; it does not cause the spiral the guard
  // is designed to catch.
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

// ── Summary ───────────────────────────────────────────────────────────────────
sep();
console.log(`  Pattern-matching tools found:  ${patternMatches.length}`);
console.log(`  Guarded (MEMORY_TOOL_NAMES):   ${inGuard.length}`);
console.log(`  Excluded (KNOWN_NON_GUARD):    ${inExclusion.length}`);
console.log(`  Uncategorized (FAIL):          ${uncategorized.length}`);
sep();

if (allPassed) {
  console.log(G('ALL CHECKS PASSED'));
  console.log(G('Chain-guard coverage is complete — no memory-pattern tool is silently unguarded.'));
  console.log('');
} else {
  console.log(R('ONE OR MORE CHECKS FAILED — see ✗ lines above.'));
  process.exit(1);
}

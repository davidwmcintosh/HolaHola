/**
 * test-coverage-constants-local-redef-check.ts
 *
 * CI guard: asserts that neither coverage script contains a local redefinition
 * of the shared constants exported from memory-tool-coverage-constants.ts.
 *
 * WHY THIS EXISTS
 * ───────────────
 * memory-tool-coverage-constants.ts is the single source of truth for
 * KNOWN_NON_GUARD_TOOLS, MEMORY_PATTERN_PREFIXES, and KNOWN_MEMORY_DISPATCHERS.
 * A developer who re-introduces a local `const KNOWN_NON_GUARD_TOOLS = new Set([…])`
 * inside test-memory-tool-coverage.ts or test-memory-tool-coverage-negative-path.ts
 * would silently shadow the import — restoring the drift problem the shared module
 * was built to prevent.  This script catches that regression before it ships.
 *
 * WHAT IS CHECKED
 * ───────────────
 * For each of the two coverage scripts, the file is read and scanned line-by-line.
 * A line is flagged when ALL of the following are true:
 *   1. It contains `const KNOWN_NON_GUARD_TOOLS`, `const MEMORY_PATTERN_PREFIXES`,
 *      or `const KNOWN_MEMORY_DISPATCHERS`.
 *   2. The leading non-whitespace characters are NOT `//` or `*` — i.e. the line
 *      is live code, not a comment.
 *
 * EXIT CODES
 * ──────────
 *   0  Neither script contains a local redefinition.
 *   1  At least one local redefinition was found — see output for details.
 *
 * Run: npx tsx server/scripts/test-coverage-constants-local-redef-check.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ─── Constants whose local redefinition is forbidden ─────────────────────────

const GUARDED_NAMES = [
  'KNOWN_NON_GUARD_TOOLS',
  'MEMORY_PATTERN_PREFIXES',
  'KNOWN_MEMORY_DISPATCHERS',
] as const;

// ─── Scripts to scan ─────────────────────────────────────────────────────────

const SCRIPTS_TO_SCAN = [
  resolve(__dirname, 'test-memory-tool-coverage.ts'),
  resolve(__dirname, 'test-memory-tool-coverage-negative-path.ts'),
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true when the trimmed line is a comment (// … or * …). */
function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('*');
}

interface Violation {
  file: string;
  lineNumber: number;
  lineText: string;
  constantName: string;
}

/**
 * Scans a source file for local const declarations of the guarded constant names.
 * Returns an array of violations (empty = clean).
 */
function scanFile(filePath: string): Violation[] {
  let source: string;
  try {
    source = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(R(`  ✗ Could not read ${filePath}: ${err}`));
    process.exit(1);
  }

  const violations: Violation[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;

    for (const name of GUARDED_NAMES) {
      // Match `const NAME` — must be a declaration, not just a reference.
      // Use a word-boundary-aware pattern: `const` followed by optional
      // whitespace then the constant name as a whole word.
      const declarationPattern = new RegExp(`\\bconst\\s+${name}\\b`);
      if (declarationPattern.test(line)) {
        violations.push({
          file: filePath,
          lineNumber: i + 1,
          lineText: line,
          constantName: name,
        });
      }
    }
  }

  return violations;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

sep();
console.log(B('Coverage-constants local-redefinition guard'));
console.log(Y('  Checks that neither coverage script shadows the shared constants'));
console.log(Y('  from memory-tool-coverage-constants.ts with a local redefinition.'));
sep();

console.log(B('Guarded constant names:'));
for (const name of GUARDED_NAMES) {
  console.log(`  • ${name}`);
}

console.log(B('\nScripts under inspection:'));
for (const script of SCRIPTS_TO_SCAN) {
  console.log(`  • ${script}`);
}

sep();

let allPassed = true;
const allViolations: Violation[] = [];

for (const scriptPath of SCRIPTS_TO_SCAN) {
  const shortName = scriptPath.split('/').slice(-1)[0];
  console.log(B(`Scanning: ${shortName}`));

  const violations = scanFile(scriptPath);

  if (violations.length === 0) {
    console.log(`  ${G('✓')} No local redefinitions found.`);
  } else {
    allPassed = false;
    for (const v of violations) {
      console.log(R(`  ✗ Line ${v.lineNumber}: local redefinition of '${v.constantName}' detected`));
      console.log(Y(`       ${v.lineText.trim()}`));
    }
    allViolations.push(...violations);
  }
}

sep();

if (allViolations.length > 0) {
  console.log(R('FAIL — local redefinition(s) found:'));
  console.log('');
  for (const v of allViolations) {
    const shortName = v.file.split('/').slice(-1)[0];
    console.log(R(`  ✗ ${shortName}:${v.lineNumber}  →  ${v.constantName}`));
  }
  console.log('');
  console.log(Y('  A local `const` declaration for any of these names shadows the shared'));
  console.log(Y('  import from memory-tool-coverage-constants.ts.  This silently restores'));
  console.log(Y('  the drift problem the shared module was built to prevent.'));
  console.log('');
  console.log(Y('  To fix: remove the local declaration and ensure the constant is'));
  console.log(Y('  imported from server/services/memory-tool-coverage-constants.ts.'));
  console.log('');
  process.exit(1);
} else {
  console.log(G('✓ ALL CHECKS PASSED'));
  console.log(G('  Neither coverage script redefines a shared constant locally.'));
  console.log(G('  memory-tool-coverage-constants.ts remains the single source of truth.'));
  console.log('');
}

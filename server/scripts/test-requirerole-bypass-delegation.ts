/**
 * test-requirerole-bypass-delegation.ts
 *
 * CI guard: confirms that requireRole, requireFounder, and requireFounderOrAgent
 * in server/middleware/rbac.ts all delegate to the single isDevBypass() function
 * rather than duplicating the NODE_ENV/DEV_AUTH_BYPASS condition inline.
 *
 * If any call site ever copies the guard logic directly instead of calling
 * isDevBypass(), a copy-paste regression could strip the production gate and
 * open the bypass in production.
 *
 * PART 1 — Static: each of the three middleware functions
 *           - calls isDevBypass()
 *           - does NOT contain an inline NODE_ENV or DEV_AUTH_BYPASS reference
 *             in its own body (those belong only in the isDevBypass definition).
 *
 * PART 2 — Mutation self-check: replace requireRole's isDevBypass() delegation
 *           with a direct inline bypass that omits the NODE_ENV gate, then
 *           confirm the static check sub-process exits non-zero (regression
 *           detected).
 *
 * Run: npx tsx server/scripts/test-requirerole-bypass-delegation.ts
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

// ── File paths ────────────────────────────────────────────────────────────────
const ROOT        = resolve(__dirname, '../..');
const RBAC        = resolve(ROOT, 'server/middleware/rbac.ts');
const MUTANT_RBAC = resolve(ROOT, 'server/middleware/rbac.BYPASS_DELEGATION_MUTANT.ts');

// ── Helper: extract the body of a named function from source text ──────────────
// Finds the first occurrence of `function <name>`, then accumulates characters
// until the curly braces balance (depth returns to 0 after the opening brace).
// Returns the full text from the function keyword through the closing `}`.
function extractFunctionBody(src: string, funcName: string): string | null {
  const startIdx = src.indexOf(`function ${funcName}`);
  if (startIdx === -1) return null;

  let depth = 0;
  let inBody = false;
  let i = startIdx;

  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      depth++;
      inBody = true;
    } else if (ch === '}') {
      depth--;
      if (inBody && depth === 0) {
        return src.slice(startIdx, i + 1);
      }
    }
    i++;
  }
  return null;
}

// Regex that matches the isDevBypass arrow-function definition so its body can
// be stripped from the source before we inspect the middleware function bodies.
// This prevents the definition's own NODE_ENV/DEV_AUTH_BYPASS references from
// triggering false positives in the "no inline bypass" assertion.
// The pattern handles both zero-argument and typed-parameter forms, and both
// single-line and multi-line function bodies (ending with \n};).
const IS_DEV_BYPASS_DEF_PATTERN =
  /const isDevBypass\s*=\s*\([^)]*\)\s*=>[\s\S]*?\n\};/;

const rbacSrc         = readFileSync(RBAC, 'utf8');
const rbacWithoutDef  = rbacSrc.replace(IS_DEV_BYPASS_DEF_PATTERN, '/* isDevBypass-def-stripped */');

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static checks
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static: all three middleware functions delegate to isDevBypass()'));
sep();

// Confirm the isDevBypass definition itself is present (guard against the regex
// changing and not stripping anything useful).
assert(
  'isDevBypass() definition is present in rbac.ts',
  IS_DEV_BYPASS_DEF_PATTERN.test(rbacSrc),
  'Could not find the isDevBypass arrow-function definition in rbac.ts',
);

assert(
  'Definition was successfully stripped from the working copy (regex matched)',
  !IS_DEV_BYPASS_DEF_PATTERN.test(rbacWithoutDef),
  'IS_DEV_BYPASS_DEF_PATTERN did not match — stripping failed; false positives possible',
);

// Phrases that must NOT appear in any middleware function body.
const INLINE_BYPASS_NEEDLES = [
  `process.env.NODE_ENV`,
  `process.env.DEV_AUTH_BYPASS`,
];

// The delegation call that MUST appear in each function body.
const DELEGATION_CALL = `isDevBypass()`;

const middlewareFunctions: Array<{ name: string }> = [
  { name: 'requireRole'           },
  { name: 'requireFounder'        },
  { name: 'requireFounderOrAgent' },
];

for (const { name } of middlewareFunctions) {
  const body = extractFunctionBody(rbacWithoutDef, name);

  assert(
    `${name}: function body was located in rbac.ts`,
    body !== null,
    `Could not find "function ${name}" in ${RBAC}`,
  );

  if (body === null) continue;

  assert(
    `${name}: calls ${DELEGATION_CALL}`,
    body.includes(DELEGATION_CALL),
    `Expected "${DELEGATION_CALL}" in the ${name} body but it was absent`,
  );

  for (const needle of INLINE_BYPASS_NEEDLES) {
    assert(
      `${name}: no inline "${needle}" in its own body`,
      !body.includes(needle),
      `Found "${needle}" directly inside ${name} — bypass logic must be delegated to isDevBypass()`,
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Mutation self-check
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Mutation self-check: inline bypass in requireRole is detected'));
sep();

// Produce a mutant where requireRole's isDevBypass() call is replaced with a
// direct inline check that intentionally omits the NODE_ENV production gate —
// the most dangerous copy-paste regression pattern.
const DELEGATION_STMT   = `if (isDevBypass()) return next();`;
const MUTANT_BYPASS_STMT = `if (process.env.DEV_AUTH_BYPASS === 'true') return next();`;

// Locate the first occurrence of the delegation statement (it is inside
// requireRole, the first middleware function in the file).
const firstIdx = rbacSrc.indexOf(DELEGATION_STMT);

assert(
  'Mutation target: first isDevBypass() delegation statement found in rbac.ts',
  firstIdx !== -1,
  `Could not find "${DELEGATION_STMT}" in ${RBAC}`,
);

let mutantSrc = rbacSrc;
if (firstIdx !== -1) {
  mutantSrc =
    rbacSrc.slice(0, firstIdx) +
    MUTANT_BYPASS_STMT +
    rbacSrc.slice(firstIdx + DELEGATION_STMT.length);
}

assert(
  'Mutant source differs from original (replacement succeeded)',
  mutantSrc !== rbacSrc,
  'Replacement did not change the source — DELEGATION_STMT may not match',
);

assert(
  'Mutant source contains the inline bypass without NODE_ENV gate',
  mutantSrc.includes(MUTANT_BYPASS_STMT),
);

assert(
  'Mutant source no longer delegates isDevBypass() at the target site',
  // The mutant still has two isDevBypass() calls (requireFounder + requireFounderOrAgent)
  // but one fewer than the original three.
  mutantSrc.split(DELEGATION_STMT).length < rbacSrc.split(DELEGATION_STMT).length,
  'Mutant still contains the same number of delegation statements — mutation may have failed',
);

// Write the mutant file and run an inline sub-process that mirrors Part 1's
// check for requireRole only.  It must exit non-zero because the mutant's
// requireRole body contains a direct DEV_AUTH_BYPASS reference.
writeFileSync(MUTANT_RBAC, mutantSrc, 'utf8');

try {
  // Pass the regex source so the subprocess can reconstruct it.
  const defPatternSource = IS_DEV_BYPASS_DEF_PATTERN.source;

  const checker = `
    import { readFileSync } from 'fs';

    const src = readFileSync(${JSON.stringify(MUTANT_RBAC)}, 'utf8');

    function extractFunctionBody(src, funcName) {
      const startIdx = src.indexOf('function ' + funcName);
      if (startIdx === -1) return null;
      let depth = 0, inBody = false, i = startIdx;
      while (i < src.length) {
        const ch = src[i];
        if (ch === '{') { depth++; inBody = true; }
        else if (ch === '}') { depth--; if (inBody && depth === 0) return src.slice(startIdx, i + 1); }
        i++;
      }
      return null;
    }

    // Strip the isDevBypass definition so its references do not count.
    const stripped = src.replace(new RegExp(${JSON.stringify(defPatternSource)}), '/* stripped */');

    const body = extractFunctionBody(stripped, 'requireRole');
    if (!body) {
      console.error('[mutant-checker] requireRole body not found');
      process.exit(1);
    }

    // Check 1: requireRole must call isDevBypass() — mutant should FAIL this.
    if (!body.includes('isDevBypass()')) {
      console.error('[mutant-checker] requireRole does not call isDevBypass() — delegation missing');
      process.exit(1);
    }

    // Check 2: requireRole must not contain inline bypass refs — mutant ALSO FAILS this.
    for (const needle of ['process.env.NODE_ENV', 'process.env.DEV_AUTH_BYPASS']) {
      if (body.includes(needle)) {
        console.error('[mutant-checker] requireRole contains inline bypass reference: ' + needle);
        process.exit(1);
      }
    }

    // If we reach here on the mutant, the guard is too weak.
    console.log('[mutant-checker] all checks passed — guard missed the regression');
    process.exit(0);
  `;

  const result = spawnSync(
    process.execPath,
    ['--input-type=module'],
    {
      input: checker,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    },
  );

  assert(
    'Static-check sub-process exits non-zero on the mutant (inline bypass is detected)',
    result.status !== 0,
    `Sub-process exited with ${result.status}; stdout: ${result.stdout.trim()}; stderr: ${result.stderr.trim()}`,
  );
} finally {
  if (existsSync(MUTANT_RBAC)) unlinkSync(MUTANT_RBAC);
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2b — Mutation self-check (requireFounder)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2b — Mutation self-check: inline bypass in requireFounder is detected'));
sep();

// Find the second occurrence of DELEGATION_STMT, which lives inside requireFounder.
const secondIdx = rbacSrc.indexOf(DELEGATION_STMT, firstIdx + DELEGATION_STMT.length);

assert(
  'Mutation target: second isDevBypass() delegation statement found in rbac.ts (requireFounder)',
  secondIdx !== -1,
  `Could not find a second "${DELEGATION_STMT}" in ${RBAC} — expected one inside requireFounder`,
);

const MUTANT_RBAC_B = resolve(ROOT, 'server/middleware/rbac.BYPASS_DELEGATION_MUTANT_B.ts');

let mutantSrcB = rbacSrc;
if (secondIdx !== -1) {
  mutantSrcB =
    rbacSrc.slice(0, secondIdx) +
    MUTANT_BYPASS_STMT +
    rbacSrc.slice(secondIdx + DELEGATION_STMT.length);
}

assert(
  'Mutant-B source differs from original (requireFounder replacement succeeded)',
  mutantSrcB !== rbacSrc,
  'Replacement did not change the source — second DELEGATION_STMT may not match',
);

assert(
  'Mutant-B source contains the inline bypass without NODE_ENV gate',
  mutantSrcB.includes(MUTANT_BYPASS_STMT),
);

assert(
  'Mutant-B source still contains the original delegation in requireRole (only requireFounder was mutated)',
  // The first occurrence should still be intact — count of original statements is same
  // minus one (the replaced one).
  mutantSrcB.split(DELEGATION_STMT).length < rbacSrc.split(DELEGATION_STMT).length,
  'Mutant-B still contains the same number of delegation statements — mutation may have failed',
);

writeFileSync(MUTANT_RBAC_B, mutantSrcB, 'utf8');

try {
  const defPatternSource = IS_DEV_BYPASS_DEF_PATTERN.source;

  const checkerB = `
    import { readFileSync } from 'fs';

    const src = readFileSync(${JSON.stringify(MUTANT_RBAC_B)}, 'utf8');

    function extractFunctionBody(src, funcName) {
      const startIdx = src.indexOf('function ' + funcName);
      if (startIdx === -1) return null;
      let depth = 0, inBody = false, i = startIdx;
      while (i < src.length) {
        const ch = src[i];
        if (ch === '{') { depth++; inBody = true; }
        else if (ch === '}') { depth--; if (inBody && depth === 0) return src.slice(startIdx, i + 1); }
        i++;
      }
      return null;
    }

    // Strip the isDevBypass definition so its references do not count.
    const stripped = src.replace(new RegExp(${JSON.stringify(defPatternSource)}), '/* stripped */');

    const body = extractFunctionBody(stripped, 'requireFounder');
    if (!body) {
      console.error('[mutant-checker-b] requireFounder body not found');
      process.exit(1);
    }

    // Check 1: requireFounder must call isDevBypass() — mutant should FAIL this.
    if (!body.includes('isDevBypass()')) {
      console.error('[mutant-checker-b] requireFounder does not call isDevBypass() — delegation missing');
      process.exit(1);
    }

    // Check 2: requireFounder must not contain inline bypass refs — mutant ALSO FAILS this.
    for (const needle of ['process.env.NODE_ENV', 'process.env.DEV_AUTH_BYPASS']) {
      if (body.includes(needle)) {
        console.error('[mutant-checker-b] requireFounder contains inline bypass reference: ' + needle);
        process.exit(1);
      }
    }

    // If we reach here on the mutant, the guard is too weak.
    console.log('[mutant-checker-b] all checks passed — guard missed the regression');
    process.exit(0);
  `;

  const resultB = spawnSync(
    process.execPath,
    ['--input-type=module'],
    {
      input: checkerB,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    },
  );

  assert(
    'Static-check sub-process exits non-zero on the requireFounder mutant (inline bypass is detected)',
    resultB.status !== 0,
    `Sub-process exited with ${resultB.status}; stdout: ${resultB.stdout.trim()}; stderr: ${resultB.stderr.trim()}`,
  );
} finally {
  if (existsSync(MUTANT_RBAC_B)) unlinkSync(MUTANT_RBAC_B);
}

// ── Summary ───────────────────────────────────────────────────────────────────
sep();
console.log(`\n  Passed: ${G(String(passed))}   Failed: ${failed > 0 ? R(String(failed)) : String(failed)}\n`);

if (failed > 0) {
  process.exit(1);
}

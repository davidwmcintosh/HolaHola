/**
 * CI-parity meta-guard: every check registered as a `run_check` line in
 * server/scripts/run-validation-suite.sh must also be reachable from
 * scripts/run-ci-test-steps.mjs (the splice list GitHub Actions' ci.yml
 * actually runs) -- either directly in its spliced command list, or via
 * package.json's scripts.test / test:ci:unit / test:ci:guards /
 * test:ci:episodes chains.
 *
 * Background (tasks #1528, #1531, #1536): three separate rounds each found
 * and fixed the same class of gap -- a check was registered as a
 * `run_check` in the Replit validation suite but silently absent from the
 * GitHub Actions test chain, so a real regression there would only ever be
 * caught by Replit's validation run (or a manual audit), never by CI on a
 * PR. Nothing structurally stopped a fourth round of the same drift. This
 * script is that structural guard.
 *
 * How it works:
 *   1. Parse every `run_check "label" <command>` statement out of
 *      run-validation-suite.sh (joining backslash-continued lines first, so
 *      a multi-file `npx tsx --test \` block is treated as one statement).
 *   2. Expand any `npm run <name>` reference in that command text to
 *      package.json's scripts[<name>] value (recursively, so e.g.
 *      `npm run test:source-bridge` resolves down to the literal
 *      `npx tsx server/scripts/test-source-control-service.ts` invocations
 *      it actually runs).
 *   3. Extract every `<path>.{ts,tsx,mjs,js,sh}` token plus any `--flag`
 *      arguments immediately trailing it -- this is the "required" set,
 *      each entry tagged with the run_check label it came from.
 *   4. A run_check line whose (expanded) command contains no file-path
 *      token anywhere -- e.g. `npm run typecheck` resolving to the pathless
 *      `tsc --noEmit` -- is never silently dropped. Its "&&"-split atomic
 *      command becomes its own `cmd:`-prefixed required key instead, so a
 *      check that never bottoms out in a file path still has to prove it is
 *      reachable, rather than contributing nothing and reading as "fully
 *      covered" purely because it produced zero file-path tokens. A line
 *      whose only path token is the harness self-reference (see the
 *      HARNESS_PATH carve-out below) is exempt from this fallback -- it is
 *      already vacuously satisfied, not pathless.
 *   5. Build the "reachable" set the same way, from the union of
 *      package.json's scripts.test chain, the literal string array passed
 *      to `commands.splice(...)` inside run-ci-test-steps.mjs, and
 *      package.json's test:ci:unit / test:ci:guards / test:ci:episodes
 *      chains (each expanded the same way, including the same `cmd:`
 *      pathless-command fallback).
 *   6. Anything in the required set that is missing from the reachable set
 *      -- and not in the REPLIT_ONLY_ALLOWLIST below -- fails the check.
 *
 * The allowlist is a plain module-level const, not read from any external
 * config file or environment variable, so adding an exception always means
 * editing this script directly -- there is no other surface that can
 * silently add one.
 *
 * `scripts/run-ci-test-steps.mjs` itself is never treated as a "file that
 * must be independently reachable": `npm run test:ci` legitimately resolves
 * to `node scripts/run-ci-test-steps.mjs`, and that path IS the definition
 * of the reachable set, not a member of it. Without this carve-out the
 * "Application test suite" run_check line would always report itself
 * missing.
 *
 * This check performs no network or database access and does not execute
 * any of the referenced test files -- it only reads and cross-references
 * the three source files' text.
 *
 * Run:
 *   npx tsx server/scripts/test-validation-suite-ci-parity.ts
 *   npx tsx server/scripts/test-validation-suite-ci-parity.ts --self-check
 *
 * --self-check mode proves, via synthetic fixtures (never by mutating the
 * real files), that: a missing file is actually caught; flags are matched,
 * not just paths (a `--self-check` variant missing is caught even when the
 * plain invocation is present); multi-line continuation blocks are expanded
 * per-file; `npm run <name>` references are actually resolved rather than
 * skipped; the run-ci-test-steps.mjs self-reference carve-out does not mask
 * a real gap; a pathless command with no file-path token at all (e.g.
 * `tsc --noEmit`) is modeled and caught when it is missing from CI, not
 * silently treated as fully covered; and -- against the REAL repo files --
 * removing either documented allowlist entry, or the CI wiring for the
 * pathless `TypeScript typecheck` run_check line, makes this guard newly
 * flag exactly that entry, proving both are load-bearing rather than
 * redundant with existing coverage.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const VALIDATION_SUITE_PATH = path.join(REPO_ROOT, 'server', 'scripts', 'run-validation-suite.sh');
const CI_STEPS_PATH = path.join(REPO_ROOT, 'scripts', 'run-ci-test-steps.mjs');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

// scripts/run-ci-test-steps.mjs is the harness that DEFINES the reachable
// set (via `npm run test:ci` -> `node scripts/run-ci-test-steps.mjs`, and
// again via each test:ci:<group> -> `node scripts/run-ci-test-steps.mjs
// --group=<group>`). It is never itself a member of the set it defines --
// excluding it here is what keeps those two run_check lines from always
// reporting themselves as a false gap.
const HARNESS_PATH = 'scripts/run-ci-test-steps.mjs';

// Replit-only exceptions, documented inline at their run_check definitions
// in run-validation-suite.sh:
//   - restore-episode-28-from-db.ts --self-check reads the real canonical
//     Episode 28 row from NEON_SHARED_DATABASE_URL; GitHub's job-local
//     disposable Postgres never has that row.
//   - test-canonical-capture-health-route.ts calls a running local
//     application server's health route; GitHub Actions never starts the
//     app server before running tests.
// Adding an entry here requires editing this file directly -- there is no
// external config file or env var this allowlist reads from.
const REPLIT_ONLY_ALLOWLIST = new Set<string>([
  'server/scripts/restore-episode-28-from-db.ts --self-check',
  'server/scripts/test-canonical-capture-health-route.ts',
]);

// Matches a repo-relative script path (one or more "segment/" directory
// parts followed by a final "name.ext" part) plus any `--flag` tokens
// immediately trailing it. The negative lookbehind keeps a match from
// starting mid-token (e.g. it must not fire on the ".test.ts" tail of the
// glob `client/src/components/*.test.ts` -- the `*` breaks the directory
// segment so the path group never matches there in the first place, and the
// lookbehind is an extra guard against similar future glob-like patterns).
const FILE_PATH_WITH_FLAGS_RE =
  /(?<![\w./*-])((?:[\w-]+\/)+[\w.-]+\.(?:tsx|ts|mjs|js|sh))((?:\s+--[\w=.-]+)*)/g;

const RUN_CHECK_LINE_RE = /^run_check\s+"([^"]+)"\s+(.*)$/;

export interface RequiredEntry {
  key: string;
  label: string;
}

export interface ParityResult {
  missing: RequiredEntry[];
  requiredCount: number;
  reachableCount: number;
}

/**
 * Joins backslash-newline continuations into single logical lines (exactly
 * as bash does while parsing the script) and returns every
 * `run_check "label" <command>` statement found.
 */
export function extractRunCheckLines(scriptText: string): Array<{ label: string; commandText: string }> {
  const joined = scriptText.replace(/\\\r?\n/g, ' ');
  const results: Array<{ label: string; commandText: string }> = [];
  for (const rawLine of joined.split(/\r?\n/)) {
    const match = RUN_CHECK_LINE_RE.exec(rawLine.trim());
    if (match) {
      results.push({ label: match[1], commandText: match[2] });
    }
  }
  return results;
}

/**
 * Repeatedly replaces every `npm run <name>` substring with
 * pkgScripts[<name>] (when that script exists), so a run_check line like
 * `npm run test:source-bridge` expands down to the literal `npx tsx ...`
 * invocations it actually runs. Unresolvable names (no matching script) are
 * left as-is -- they are not file paths, so they contribute nothing to
 * either extracted set either way. Bounded iteration count guards against a
 * cyclic script reference looping forever.
 */
export function expandNpmRunReferences(text: string, pkgScripts: Record<string, string>): string {
  let current = text;
  const NPM_RUN_RE = /npm run ([\w:.-]+)/g;
  for (let iteration = 0; iteration < 15; iteration++) {
    let changed = false;
    current = current.replace(NPM_RUN_RE, (whole, name: string) => {
      const resolved = pkgScripts[name];
      if (typeof resolved === 'string') {
        changed = true;
        return ` ${resolved} `;
      }
      return whole;
    });
    if (!changed) break;
  }
  return current;
}

/**
 * Blanks out `//line` and `/* block *\/` comments in JS/TS source text while
 * leaving every string literal untouched, using a single (string | comment)
 * alternation so the regex never has to guess where a comment "ends" inside
 * a string that happens to contain `//` or `/*` -- whichever alternative
 * matches first at a given position wins, and a comment can only start
 * matching at a position where no string-opening quote is present.
 *
 * Without this, a plain string-literal scan over raw source text cannot
 * distinguish a live `commands.splice(...)` array entry from the exact same
 * text sitting inside a commented-out line -- `// 'npx tsx foo.ts',` reads
 * identically to `'npx tsx foo.ts',` to a regex that only looks for quotes.
 * That would let a required check keep reporting as "reachable" from CI
 * indefinitely after its CI entry was disabled by commenting it out instead
 * of deleting it -- defeating this guard's entire purpose for exactly the
 * kind of change it exists to catch.
 */
export function stripJsComments(text: string): string {
  const STRING_OR_COMMENT_RE = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  return text.replace(STRING_OR_COMMENT_RE, (match) => (match.startsWith('//') || match.startsWith('/*') ? '' : match));
}

export interface FileInvocationDetails {
  /** "path" or "path --flag" keys found in text, minus the harness self-reference. */
  keys: Set<string>;
  /**
   * True the moment ANY file-path-shaped token was found, even if every one
   * of them was the harness self-reference and therefore excluded from
   * `keys`. Lets a caller tell "this text never mentions a file path at all"
   * (truly pathless -- needs the computePathlessCommandKeys fallback below)
   * apart from "the only path token was the harness, correctly excluded"
   * (vacuously satisfied by the harness carve-out, not pathless).
   */
  sawAnyPathToken: boolean;
}

/** Extracts the set of "path" or "path --flag" keys referenced anywhere in text, plus whether any path token was seen at all. */
export function extractFileInvocationDetails(text: string): FileInvocationDetails {
  const keys = new Set<string>();
  let sawAnyPathToken = false;
  FILE_PATH_WITH_FLAGS_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FILE_PATH_WITH_FLAGS_RE.exec(text)) !== null) {
    const filePath = match[1];
    sawAnyPathToken = true;
    if (filePath === HARNESS_PATH) continue;
    const flags = match[2].trim();
    keys.add(flags ? `${filePath} ${flags}` : filePath);
  }
  return { keys, sawAnyPathToken };
}

/** Convenience wrapper over extractFileInvocationDetails for callers that only need the key set. */
export function extractFileInvocationKeys(text: string): Set<string> {
  return extractFileInvocationDetails(text).keys;
}

function normalizeCommandText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Splits an already npm-run-expanded command blob into top-level atomic
 * commands on "&&" -- the same boundary run-ci-test-steps.mjs itself uses to
 * split package.json's scripts.test chain into individually-run steps (see
 * `testChain.split(/\s+&&\s+/)` there). Not a full shell parser -- a "&&"
 * embedded inside a quoted `bash -c '...'` substring still splits here -- but
 * every existing multi-command run_check line in this repo wraps two-or-more
 * *file*-based invocations, so a naive split fragment from one of those still
 * carries its own file-path token and is classified correctly regardless of
 * the stray quote/prefix noise left on it by the split.
 */
export function splitAtomicCommands(text: string): string[] {
  return text.split(/\s+&&\s+/).map((part) => part.trim()).filter(Boolean);
}

/** Prefix on every pathless-command key, so it can never collide with a real "path" or "path --flag" key (which always contains a "/" and a known extension). */
export const PATHLESS_KEY_PREFIX = 'cmd:';

/**
 * The pathless companion to extractFileInvocationKeys: every top-level atomic
 * command in `text` that contains NO file-path-shaped token at all (e.g.
 * `tsc --noEmit`, the fully-expanded form of `npm run typecheck`) becomes its
 * own comparable, `cmd:`-prefixed key. An atomic command whose only path
 * token is the harness self-reference (sawAnyPathToken true, keys empty) is
 * intentionally excluded here too -- it is vacuously satisfied by the harness
 * carve-out already, not a pathless command that separately needs its own
 * coverage.
 */
export function extractPathlessCommandKeys(text: string): Set<string> {
  const keys = new Set<string>();
  for (const atomicCommand of splitAtomicCommands(text)) {
    const { keys: pathKeys, sawAnyPathToken } = extractFileInvocationDetails(atomicCommand);
    if (pathKeys.size > 0 || sawAnyPathToken) continue;
    keys.add(`${PATHLESS_KEY_PREFIX}${normalizeCommandText(atomicCommand)}`);
  }
  return keys;
}

/** The "required" set: every file+flag invocation (or, failing that, pathless command) referenced by a run_check line, tagged with its label. */
export function computeRequiredEntries(
  validationSuiteText: string,
  pkgScripts: Record<string, string>,
): RequiredEntry[] {
  const entries: RequiredEntry[] = [];
  for (const { label, commandText } of extractRunCheckLines(validationSuiteText)) {
    const expanded = expandNpmRunReferences(commandText, pkgScripts);
    for (const key of extractFileInvocationKeys(expanded)) {
      entries.push({ key, label });
    }
    for (const key of extractPathlessCommandKeys(expanded)) {
      entries.push({ key, label });
    }
  }
  return entries;
}

/**
 * The "reachable" set: everything GitHub Actions' `npm run test:ci` (or the
 * three test:ci:<group> commands it is split into for parallelism) actually
 * runs. Built from the union of package.json's scripts.test chain, the
 * literal command list run-ci-test-steps.mjs splices into it, and
 * package.json's test:ci:unit / test:ci:guards / test:ci:episodes chains
 * (each expanded the same way as the required side, so e.g. their
 * `npm run test:shared-spec:unit` / `npm run test:coordination-ledger`
 * references resolve to the files they actually run).
 */
export function computeReachableKeys(
  ciStepsText: string,
  pkgScripts: Record<string, string>,
): Set<string> {
  // Comments are stripped from the WHOLE file text before the splice call is
  // even located -- not just from the text captured inside it. Two distinct
  // failure modes share this one fix: (1) a commented-out array entry like
  // `// 'npx tsx foo.ts',` would otherwise still match the string-literal
  // regex below and be counted as reachable even though it no longer runs;
  // (2) a comment containing a literal `);` before the real end of the call
  // (e.g. `// see also someOtherCall();`) would otherwise truncate the
  // non-greedy splice-boundary match early and silently drop every entry
  // after it. Stripping comments first closes both at once.
  const commentFreeCiStepsText = stripJsComments(ciStepsText);
  const spliceMatch = /commands\.splice\(([\s\S]*?)\);/.exec(commentFreeCiStepsText);
  if (!spliceMatch) {
    throw new Error(
      'Could not locate a commands.splice(...) call in scripts/run-ci-test-steps.mjs -- ' +
      'this extraction logic may be out of date with that file\'s structure',
    );
  }
  const splicedCommands: string[] = [];
  const STRING_LITERAL_RE = /'([^']*)'/g;
  let literalMatch: RegExpExecArray | null;
  while ((literalMatch = STRING_LITERAL_RE.exec(spliceMatch[1])) !== null) {
    splicedCommands.push(literalMatch[1]);
  }
  if (splicedCommands.length === 0) {
    throw new Error(
      'Found commands.splice(...) in scripts/run-ci-test-steps.mjs but extracted zero string ' +
      'literals from it -- this extraction logic may be out of date with that file\'s structure',
    );
  }

  const requiredPkgScriptNames = ['test', 'test:ci:unit', 'test:ci:guards', 'test:ci:episodes'];
  for (const name of requiredPkgScriptNames) {
    if (typeof pkgScripts[name] !== 'string' || !pkgScripts[name].trim()) {
      throw new Error(`package.json scripts.${name} must be a non-empty string`);
    }
  }

  const blob = [
    pkgScripts.test,
    splicedCommands.join(' && '),
    pkgScripts['test:ci:unit'],
    pkgScripts['test:ci:guards'],
    pkgScripts['test:ci:episodes'],
  ].join(' && ');

  const expanded = expandNpmRunReferences(blob, pkgScripts);
  const keys = extractFileInvocationKeys(expanded);
  for (const key of extractPathlessCommandKeys(expanded)) {
    keys.add(key);
  }
  return keys;
}

/**
 * Cross-references the required and reachable sets and returns everything
 * required that is neither reachable nor allowlisted. Pure function over
 * its inputs -- no filesystem access -- so --self-check can exercise it
 * with synthetic fixtures without touching the real repo files.
 */
export function computeParity(
  validationSuiteText: string,
  ciStepsText: string,
  pkgScripts: Record<string, string>,
  allowlist: Set<string> = REPLIT_ONLY_ALLOWLIST,
): ParityResult {
  const required = computeRequiredEntries(validationSuiteText, pkgScripts);
  const reachable = computeReachableKeys(ciStepsText, pkgScripts);

  const seen = new Set<string>();
  const missing: RequiredEntry[] = [];
  for (const entry of required) {
    if (reachable.has(entry.key)) continue;
    if (allowlist.has(entry.key)) continue;
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    missing.push(entry);
  }

  return { missing, requiredCount: required.length, reachableCount: reachable.size };
}

function readRealInputs(): { validationSuiteText: string; ciStepsText: string; pkgScripts: Record<string, string> } {
  const validationSuiteText = fs.readFileSync(VALIDATION_SUITE_PATH, 'utf8');
  const ciStepsText = fs.readFileSync(CI_STEPS_PATH, 'utf8');
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { scripts?: Record<string, string> };
  const pkgScripts = pkg.scripts ?? {};
  return { validationSuiteText, ciStepsText, pkgScripts };
}

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

function runRealCheck(): void {
  sep();
  console.log(B('Validation-suite \u2192 CI parity guard'));
  console.log(B('Every run_check in run-validation-suite.sh must be reachable from run-ci-test-steps.mjs'));
  sep();

  const { validationSuiteText, ciStepsText, pkgScripts } = readRealInputs();
  const result = computeParity(validationSuiteText, ciStepsText, pkgScripts);

  console.log(`\n  ${result.requiredCount} required invocation(s) extracted from run_check lines`);
  console.log(`  ${result.reachableCount} reachable invocation(s) extracted from the CI command set`);
  console.log(`  ${REPLIT_ONLY_ALLOWLIST.size} entr(y/ies) in the Replit-only allowlist\n`);

  if (result.missing.length === 0) {
    console.log(`  ${G('\u2713')} every run_check invocation is reachable from CI (or explicitly allowlisted)`);
    sep();
    console.log(G('\n\u2713 All assertions passed \u2014 no validation check is missing from CI.\n'));
    process.exit(0);
  }

  for (const { key, label } of result.missing) {
    console.log(`  ${R('\u2717')} "${label}" runs "${key}" in run-validation-suite.sh, but it is not reachable from run-ci-test-steps.mjs / package.json's test:ci chains`);
  }
  sep();
  console.log(R(`\n\u2717 ${result.missing.length} check(s) registered in run-validation-suite.sh would NOT run in GitHub CI.\n`));
  console.log('  Fix: add the missing invocation(s) to scripts/run-ci-test-steps.mjs\'s spliced command list,');
  console.log('  or -- only if the check genuinely cannot run in GitHub\'s disposable environment -- add it to');
  console.log('  REPLIT_ONLY_ALLOWLIST in this file with a comment explaining why, matching the existing entries.\n');
  process.exit(1);
}

let passed = 0;
let failed = 0;
function assertSelf(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ${G('\u2713')} ${label}`);
    passed++;
  } else {
    console.error(`  ${R('\u2717')} FAIL: ${label}${detail ? `\n      ${detail}` : ''}`);
    failed++;
  }
}

function runSelfCheck(): void {
  sep();
  console.log(B('SELF-CHECK: proving this guard actually catches the drift it exists to catch'));
  sep();

  // ── Baseline: the REAL repo files must currently pass. ──────────────────
  console.log('\n[1] Baseline against the real repo files:');
  const real = readRealInputs();
  const baseline = computeParity(real.validationSuiteText, real.ciStepsText, real.pkgScripts);
  assertSelf(
    baseline.missing.length === 0,
    'the real run-validation-suite.sh / run-ci-test-steps.mjs / package.json are currently in parity',
    baseline.missing.map(m => `"${m.label}" -> ${m.key}`).join('; '),
  );

  // ── Synthetic fixtures exercising the extraction/matching logic itself. ─
  console.log('\n[2] Synthetic fixtures:');

  const fakePkgScripts: Record<string, string> = {
    test: "npx tsx server/scripts/test-fixture-alpha.ts && npx tsx server/scripts/test-fixture-present.ts",
    'test:ci:unit': 'node scripts/run-ci-test-steps.mjs --group=unit',
    'test:ci:guards': 'node scripts/run-ci-test-steps.mjs --group=guards',
    'test:ci:episodes': 'node scripts/run-ci-test-steps.mjs --group=episodes',
    'fake:composite': 'npx tsx server/scripts/test-fixture-resolved.ts',
  };
  const fakeCiStepsText = `
const commands = testChain.split(/\\s+&&\\s+/);
commands.splice(0, 0,
  'npx tsx server/scripts/test-fixture-spliced.ts',
);
`;

  // (a) A required file present in the reachable set -> zero missing.
  {
    const suite = 'run_check "Present fixture" npx tsx server/scripts/test-fixture-present.ts\n';
    const result = computeParity(suite, fakeCiStepsText, fakePkgScripts);
    assertSelf(result.missing.length === 0, 'a required file present in the reachable set is not flagged');
  }

  // (b) A required file absent from the reachable set -> exactly one miss, correct key/label.
  {
    const suite = 'run_check "Missing fixture" npx tsx server/scripts/test-fixture-absent.ts\n';
    const result = computeParity(suite, fakeCiStepsText, fakePkgScripts);
    assertSelf(
      result.missing.length === 1 && result.missing[0].key === 'server/scripts/test-fixture-absent.ts' && result.missing[0].label === 'Missing fixture',
      'a required file absent from the reachable set is flagged with the correct key and label',
      JSON.stringify(result.missing),
    );
  }

  // (c) Flag-sensitive matching: plain form reachable, --self-check form is not.
  {
    const suite = "run_check \"Flag fixture\" bash -c 'npx tsx server/scripts/test-fixture-present.ts && npx tsx server/scripts/test-fixture-present.ts --self-check'\n";
    const result = computeParity(suite, fakeCiStepsText, fakePkgScripts);
    assertSelf(
      result.missing.length === 1 && result.missing[0].key === 'server/scripts/test-fixture-present.ts --self-check',
      'a --self-check variant missing from CI is flagged even though the plain invocation is reachable',
      JSON.stringify(result.missing),
    );
  }

  // (d) Multi-line backslash-continuation block: only the truly-missing file is flagged.
  {
    const suite = [
      'run_check "Continuation fixture" npx tsx --test \\',
      '  server/scripts/test-fixture-present.ts \\',
      '  server/scripts/test-fixture-absent.ts',
      '',
    ].join('\n');
    const result = computeParity(suite, fakeCiStepsText, fakePkgScripts);
    assertSelf(
      result.missing.length === 1 && result.missing[0].key === 'server/scripts/test-fixture-absent.ts',
      'a backslash-continued multi-file run_check block is expanded per-file, not as one opaque unit',
      JSON.stringify(result.missing),
    );
  }

  // (e) npm run resolution: a run_check line hidden behind "npm run <name>" is actually expanded.
  {
    const suite = 'run_check "Composite fixture" npm run fake:composite\n';
    const resultMissing = computeParity(suite, fakeCiStepsText, fakePkgScripts);
    assertSelf(
      resultMissing.missing.length === 1 && resultMissing.missing[0].key === 'server/scripts/test-fixture-resolved.ts',
      '"npm run <name>" is resolved to the script it actually runs, not skipped as opaque text',
      JSON.stringify(resultMissing.missing),
    );

    const reachableWithResolved = `${fakeCiStepsText}\n// server/scripts/test-fixture-resolved.ts also reachable via test:ci:unit's chain`;
    const pkgWithResolvedReachable: Record<string, string> = {
      ...fakePkgScripts,
      'test:ci:unit': 'node scripts/run-ci-test-steps.mjs --group=unit && npx tsx server/scripts/test-fixture-resolved.ts',
    };
    const resultResolved = computeParity(suite, reachableWithResolved, pkgWithResolvedReachable);
    assertSelf(resultResolved.missing.length === 0, 'once the resolved file is reachable, the same composite fixture is no longer flagged');
  }

  // (f) Harness self-reference carve-out: "npm run test:ci" must not flag itself.
  {
    const pkgWithTestCi: Record<string, string> = { ...fakePkgScripts, 'test:ci': 'node scripts/run-ci-test-steps.mjs' };
    const suite = 'run_check "Application test suite" npm run test:ci\n';
    const result = computeParity(suite, fakeCiStepsText, pkgWithTestCi);
    assertSelf(result.missing.length === 0, 'scripts/run-ci-test-steps.mjs is never flagged as missing from itself via "npm run test:ci"');
  }

  // (g) Allowlist suppresses exactly its own entries, not a look-alike.
  {
    const suite = [
      'run_check "Allowlisted fixture" npx tsx server/scripts/restore-episode-28-from-db.ts --self-check',
      'run_check "Unrelated missing fixture" npx tsx server/scripts/test-fixture-absent.ts',
      '',
    ].join('\n');
    const result = computeParity(suite, fakeCiStepsText, fakePkgScripts);
    assertSelf(
      result.missing.length === 1 && result.missing[0].key === 'server/scripts/test-fixture-absent.ts',
      'the allowlist suppresses only its own documented entry, not an unrelated missing invocation',
      JSON.stringify(result.missing),
    );

    const resultNoAllowlist = computeParity(suite, fakeCiStepsText, fakePkgScripts, new Set());
    assertSelf(
      resultNoAllowlist.missing.length === 2,
      'with an empty allowlist override, the normally-suppressed entry is flagged too -- proving suppression is the allowlist, not a coincidence',
      JSON.stringify(resultNoAllowlist.missing),
    );
  }

  // (h) Comment-blindness: a CI entry that was disabled by commenting it out
  // (rather than deleting it) must still read as MISSING, not reachable. A
  // naive string-literal scan over raw source text cannot tell a live
  // `commands.splice(...)` array entry apart from the identical text sitting
  // inside a `//` or `/* */` comment -- this is exactly the realistic
  // "temporarily disable a CI step" edit this guard exists to catch.
  {
    const suiteCommented = 'run_check "Disabled-in-CI fixture" npx tsx server/scripts/test-fixture-commented-out.ts\n';

    // (h1) Present only as a `//`-commented-out element of the SAME
    // commands.splice(...) array the live entries sit in -- the reviewer's
    // exact scenario: `// 'npx tsx server/scripts/example.ts',`. The target
    // text must sit *inside* the one commands.splice(...) call (there is
    // only ever one in the real file, and the extractor only locates the
    // first), not merely somewhere else in the file, or this test would
    // pass even without the fix.
    const ciWithLineCommentedEntry = `
const commands = testChain.split(/\\s+&&\\s+/);
commands.splice(0, 0,
  'npx tsx server/scripts/test-fixture-spliced.ts',
  // 'npx tsx server/scripts/test-fixture-commented-out.ts',
);
`;
    const resultLineComment = computeParity(suiteCommented, ciWithLineCommentedEntry, fakePkgScripts);
    assertSelf(
      resultLineComment.missing.length === 1 && resultLineComment.missing[0].key === 'server/scripts/test-fixture-commented-out.ts',
      'a CI entry disabled via a // line comment inside the splice array is still reported missing, not falsely reachable',
      JSON.stringify(resultLineComment.missing),
    );

    // (h2) Same, via a `/* */` block comment wrapping the array element.
    const ciWithBlockCommentedEntry = `
const commands = testChain.split(/\\s+&&\\s+/);
commands.splice(0, 0,
  'npx tsx server/scripts/test-fixture-spliced.ts',
  /* 'npx tsx server/scripts/test-fixture-commented-out.ts', */
);
`;
    const resultBlockComment = computeParity(suiteCommented, ciWithBlockCommentedEntry, fakePkgScripts);
    assertSelf(
      resultBlockComment.missing.length === 1 && resultBlockComment.missing[0].key === 'server/scripts/test-fixture-commented-out.ts',
      'a CI entry disabled via a /* */ block comment inside the splice array is still reported missing, not falsely reachable',
      JSON.stringify(resultBlockComment.missing),
    );

    // (h3) A comment containing a literal `);` before the real splice call's
    // end must not truncate extraction early and silently drop later entries.
    const ciWithEarlyParenComment = `
// see also someHelper(); for details
const commands = testChain.split(/\\s+&&\\s+/);
commands.splice(0, 0,
  'npx tsx server/scripts/test-fixture-spliced.ts',
  'npx tsx server/scripts/test-fixture-after-early-paren-comment.ts',
);
`;
    const suiteAfterEarlyParen = 'run_check "After early-paren-comment fixture" npx tsx server/scripts/test-fixture-after-early-paren-comment.ts\n';
    const resultEarlyParen = computeParity(suiteAfterEarlyParen, ciWithEarlyParenComment, fakePkgScripts);
    assertSelf(
      resultEarlyParen.missing.length === 0,
      'a literal ");" inside a comment before the real commands.splice(...) call does not truncate extraction and drop later entries',
      JSON.stringify(resultEarlyParen.missing),
    );

    // (h4) Sanity check: the SAME entry, when actually live (uncommented) as
    // an element of the same splice array, is correctly reachable -- proving
    // (h1)/(h2) test real comment-blindness and not just a broken
    // "always missing" extractor.
    const ciWithLiveEntry = `
const commands = testChain.split(/\\s+&&\\s+/);
commands.splice(0, 0,
  'npx tsx server/scripts/test-fixture-spliced.ts',
  'npx tsx server/scripts/test-fixture-commented-out.ts',
);
`;
    const resultLive = computeParity(suiteCommented, ciWithLiveEntry, fakePkgScripts);
    assertSelf(
      resultLive.missing.length === 0,
      'the same fixture, when actually live (uncommented) in the splice list, is correctly reachable',
      JSON.stringify(resultLive.missing),
    );
  }

  // (i) Pathless-command modeling: a run_check line whose (expanded) command
  // never bottoms out in a file path at all -- e.g. `npm run typecheck`
  // resolving to the pathless `tsc --noEmit` -- must still produce a
  // required key and actually be checked for CI reachability, not silently
  // contribute zero requirements and read as "fully covered" by default
  // purely because it has no file path to extract.
  {
    const suitePathless = 'run_check "Pathless fixture" npm run fixture:pathless\n';
    const fakePkgScriptsPathless: Record<string, string> = {
      ...fakePkgScripts,
      'fixture:pathless': 'some-cli --check',
    };

    // (i1) Absent from CI entirely: must be flagged missing under a `cmd:`-
    // prefixed key, not silently treated as satisfied because it produced no
    // file-path token.
    const resultPathlessMissing = computeParity(suitePathless, fakeCiStepsText, fakePkgScriptsPathless);
    assertSelf(
      resultPathlessMissing.missing.length === 1 && resultPathlessMissing.missing[0].key === 'cmd:some-cli --check',
      'a pathless command (no file-path token anywhere) absent from CI is reported missing under a cmd: key, not silently treated as covered',
      JSON.stringify(resultPathlessMissing.missing),
    );

    // (i2) The identical pathless command IS present in the CI command set:
    // must read as reachable, proving (i1) exercises real absent-vs-present
    // detection rather than an extractor that always reports "missing".
    const ciWithPathlessEntry = `
const commands = testChain.split(/\\s+&&\\s+/);
commands.splice(0, 0,
  'npx tsx server/scripts/test-fixture-spliced.ts',
  'some-cli --check',
);
`;
    const resultPathlessPresent = computeParity(suitePathless, ciWithPathlessEntry, fakePkgScriptsPathless);
    assertSelf(
      resultPathlessPresent.missing.length === 0,
      'the same pathless command, when actually present in the CI command set, is correctly reachable',
      JSON.stringify(resultPathlessPresent.missing),
    );

    // (i3) Regression guard on the harness carve-out: a run_check line that
    // resolves to ONLY the harness self-reference (e.g. `npm run test:ci` ->
    // `node scripts/run-ci-test-steps.mjs`) must stay vacuously satisfied,
    // not get newly misclassified as an uncovered pathless command now that
    // the pathless fallback exists.
    const suiteHarnessOnly = 'run_check "Harness-only fixture" npm run fixture:harness-only\n';
    const fakePkgScriptsHarnessOnly: Record<string, string> = {
      ...fakePkgScripts,
      'fixture:harness-only': 'node scripts/run-ci-test-steps.mjs',
    };
    const resultHarnessOnly = computeParity(suiteHarnessOnly, fakeCiStepsText, fakePkgScriptsHarnessOnly);
    assertSelf(
      resultHarnessOnly.missing.length === 0,
      'a run_check line resolving only to the harness self-reference stays vacuously satisfied, not newly flagged as an uncovered pathless command',
      JSON.stringify(resultHarnessOnly.missing),
    );
  }

  // ── Load-bearing proof against the REAL files: shrinking the allowlist ──
  // by one documented entry must make THIS guard newly flag exactly that
  // entry when run against the real, unmodified run-validation-suite.sh /
  // run-ci-test-steps.mjs. This proves the allowlist suppresses a real,
  // otherwise-uncovered gap -- not a coincidence, and not redundant with
  // existing CI coverage.
  console.log('\n[3] Against the real files, each allowlist entry is load-bearing:');
  for (const entry of REPLIT_ONLY_ALLOWLIST) {
    const reduced = new Set(REPLIT_ONLY_ALLOWLIST);
    reduced.delete(entry);
    const result = computeParity(real.validationSuiteText, real.ciStepsText, real.pkgScripts, reduced);
    assertSelf(
      result.missing.length === 1 && result.missing[0].key === entry,
      `removing "${entry}" from the allowlist makes the real check newly flag exactly that entry`,
      JSON.stringify(result.missing),
    );
  }

  // ── Load-bearing proof against the REAL files: the pathless "TypeScript
  // typecheck" run_check line's CI reachability depends on the actual
  // `'npm run typecheck',` entry spliced into run-ci-test-steps.mjs, not on
  // some other coincidental match. Removing exactly that literal array entry
  // from a copy of the real file's text must make the real check newly (and
  // only) flag the real "TypeScript typecheck" run_check line as missing.
  console.log('\n[4] Against the real files, the pathless TypeScript typecheck entry is load-bearing:');
  const TYPECHECK_SPLICE_ENTRY = "  'npm run typecheck',\n";
  const ciStepsTextWithoutTypecheck = real.ciStepsText.replace(TYPECHECK_SPLICE_ENTRY, '');
  assertSelf(
    ciStepsTextWithoutTypecheck !== real.ciStepsText,
    'the literal \'npm run typecheck\', splice entry is actually present in the real run-ci-test-steps.mjs to remove (fixture is exercising something real)',
  );
  const resultWithoutTypecheck = computeParity(real.validationSuiteText, ciStepsTextWithoutTypecheck, real.pkgScripts);
  assertSelf(
    resultWithoutTypecheck.missing.length === 1 &&
      resultWithoutTypecheck.missing[0].key === 'cmd:tsc --noEmit' &&
      resultWithoutTypecheck.missing[0].label === 'TypeScript typecheck',
    'removing the real npm run typecheck CI entry makes the real check newly flag exactly the pathless TypeScript typecheck run_check line',
    JSON.stringify(resultWithoutTypecheck.missing),
  );

  sep();
  console.log(`\n=== Self-check results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    console.log(R('\u2717 Self-check FAILED: this guard would not reliably catch the drift it exists to catch.\n'));
    process.exit(1);
  }
  console.log(G('\u2713 Self-check passed: the guard catches every known drift scenario.\n'));
  process.exit(0);
}

if (process.argv.includes('--self-check')) {
  runSelfCheck();
} else {
  runRealCheck();
}

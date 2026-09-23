/**
 * Structural guard: .claude/skills must be a real symlink resolving to
 * .agents/skills, so Claude Code's native skill discovery (which scans
 * .claude/skills/ in the project directory) resolves to the exact same
 * shared skill store Replit Agent and Antigravity already read natively.
 *
 * See docs/superpowers/specs/2026-09-21-cross-hat-skill-discovery-design.md.
 *
 * Self-check (--self-check flag):
 *   Uses checkSymlinkParity() as a live test seam: runs it against a plain
 *   directory (simulating Git materializing the symlink as a real directory
 *   on a checkout with core.symlinks=false, or someone replacing it with
 *   real content) and against a symlink pointing at the wrong target, and
 *   verifies both are rejected. Proves the guard would actually fail on the
 *   regressions it exists to catch, not just that it passes today.
 *
 * Usage:
 *   npx tsx server/scripts/test-agent-skills-symlink.ts           # normal check
 *   npx tsx server/scripts/test-agent-skills-symlink.ts --self-check
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CLAUDE_SKILLS_PATH = path.join(REPO_ROOT, '.claude', 'skills');
const AGENTS_SKILLS_PATH = path.join(REPO_ROOT, '.agents', 'skills');

const IS_SELF_CHECK = process.argv.includes('--self-check');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? `\n    ${detail}` : ''}`);
    failed++;
  }
}

interface CheckResult {
  ok: boolean;
  reason?: string;
}

function listSkillDirNames(dirPath: string): string[] {
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

/**
 * Checks that claudeSkillsPath is a real symlink resolving to the same set
 * of skill directories as agentsSkillsPath. A pure function (no process
 * exit, no repo-path assumptions beyond its two arguments) so --self-check
 * can feed it a deliberately broken claudeSkillsPath without touching the
 * real repo files.
 */
function checkSymlinkParity(claudeSkillsPath: string, agentsSkillsPath: string): CheckResult {
  if (!fs.existsSync(claudeSkillsPath)) {
    return { ok: false, reason: `${claudeSkillsPath} does not exist` };
  }

  const linkStat = fs.lstatSync(claudeSkillsPath);
  if (!linkStat.isSymbolicLink()) {
    return {
      ok: false,
      reason:
        `${claudeSkillsPath} exists but is not a symlink (found ` +
        `${linkStat.isDirectory() ? 'a real directory' : 'a plain file'}) — it may have been ` +
        'checked out on a filesystem/Git config that materializes symlinks as plain files ' +
        '(see the design doc\'s Windows core.symlinks caveat), or replaced with real content',
    };
  }

  let claudeReal: string;
  let agentsReal: string;
  try {
    claudeReal = fs.realpathSync(claudeSkillsPath);
    agentsReal = fs.realpathSync(agentsSkillsPath);
  } catch (err) {
    return { ok: false, reason: `failed to resolve real paths: ${(err as Error).message}` };
  }

  if (claudeReal !== agentsReal) {
    return {
      ok: false,
      reason: `${claudeSkillsPath} resolves to ${claudeReal}, expected it to resolve to ${agentsReal}`,
    };
  }

  const claudeNames = listSkillDirNames(claudeSkillsPath);
  const agentsNames = listSkillDirNames(agentsSkillsPath);
  const agentsSet = new Set(agentsNames);
  const claudeSet = new Set(claudeNames);
  const missingFromClaude = agentsNames.filter(name => !claudeSet.has(name));
  const extraInClaude = claudeNames.filter(name => !agentsSet.has(name));

  if (missingFromClaude.length > 0 || extraInClaude.length > 0) {
    return {
      ok: false,
      reason:
        `skill directory listing mismatch — missing from ${claudeSkillsPath}: ` +
        `[${missingFromClaude.join(', ')}], unexpected: [${extraInClaude.join(', ')}]`,
    };
  }

  if (agentsNames.length === 0) {
    return {
      ok: false,
      reason: `${agentsSkillsPath} contains no skill directories — cannot prove parity against an empty set`,
    };
  }

  return { ok: true };
}

function runSelfCheck(): void {
  console.log('\n[SELF-CHECK] Proving checkSymlinkParity() actually rejects broken states.\n');

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-symlink-selfcheck-'));
  try {
    // Scenario A: a plain directory instead of a symlink — simulates Git
    // materializing the symlink as a real directory/file, or someone
    // replacing it with real content.
    const plainDir = path.join(tmpBase, 'plain-dir-not-a-symlink');
    fs.mkdirSync(plainDir);
    const scenarioA = checkSymlinkParity(plainDir, AGENTS_SKILLS_PATH);
    assert(!scenarioA.ok, 'a plain directory standing in for a de-symlinked .claude/skills is rejected', scenarioA.reason);

    // Scenario B: a real symlink, but pointing at the wrong target entirely.
    const wrongTarget = path.join(tmpBase, 'wrong-target');
    fs.mkdirSync(wrongTarget);
    fs.mkdirSync(path.join(wrongTarget, 'unrelated-skill'));
    const wrongLink = path.join(tmpBase, 'wrong-link');
    fs.symlinkSync(wrongTarget, wrongLink, 'dir');
    const scenarioB = checkSymlinkParity(wrongLink, AGENTS_SKILLS_PATH);
    assert(!scenarioB.ok, 'a symlink pointing at the wrong target directory is rejected', scenarioB.reason);

    // Scenario C: a correct symlink to a directory with a divergent file
    // listing — simulates a skill added on one side but not the other.
    const partialTarget = path.join(tmpBase, 'partial-target');
    fs.mkdirSync(partialTarget);
    const agentsNames = listSkillDirNames(AGENTS_SKILLS_PATH);
    assert(agentsNames.length > 0, 'precondition: .agents/skills has at least one real skill directory to diverge from');
    if (agentsNames.length > 0) {
      fs.mkdirSync(path.join(partialTarget, agentsNames[0]));
      fs.mkdirSync(path.join(partialTarget, 'extra-skill-not-in-agents'));
      const partialLink = path.join(tmpBase, 'partial-link');
      fs.symlinkSync(partialTarget, partialLink, 'dir');
      const scenarioC = checkSymlinkParity(partialLink, AGENTS_SKILLS_PATH);
      assert(!scenarioC.ok, 'a symlink to a directory with a divergent skill listing is rejected', scenarioC.reason);
    }
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }

  console.log(`\n=== Self-check results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    console.error('[SELF-CHECK] FAIL — checkSymlinkParity() would not catch a real regression.');
    process.exit(1);
  }
  console.log('[SELF-CHECK] PASS — guard is real.\n');
  process.exit(0);
}

function runNormalCheck(): void {
  console.log('\n=== Cross-hat skill discovery: .claude/skills symlink ===\n');

  const result = checkSymlinkParity(CLAUDE_SKILLS_PATH, AGENTS_SKILLS_PATH);
  assert(result.ok, '.claude/skills is a symlink resolving to .agents/skills with an identical skill listing', result.reason);

  if (result.ok) {
    const count = listSkillDirNames(AGENTS_SKILLS_PATH).length;
    console.log(`   ${count} skills visible identically through .claude/skills and .agents/skills`);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

if (IS_SELF_CHECK) {
  runSelfCheck();
} else {
  runNormalCheck();
}

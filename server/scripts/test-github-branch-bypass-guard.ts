/**
 * test-github-branch-bypass-guard.ts
 *
 * CI check: verifies that `main`'s only way to push around required PR
 * review + status checks is the one audited GitHub App installation — never
 * a broad deploy-key bypass, a second/rogue bypass actor, or a resurrected
 * legacy classic branch-protection rule.
 *
 * Background (Sep 17-18 2026):
 *   The source-control coordinator was migrated off a long-lived SSH deploy
 *   key onto short-lived GitHub App installation tokens
 *   (server/services/github-app-auth.ts). The repository ruleset
 *   ("HolaHola Push Rule", id 21584232) bypass_actors was narrowed from a
 *   broad, unscoped `DeployKey` entry (grants bypass to ANY deploy key ever
 *   registered on the repo, not just one) down to exactly one entry: the
 *   GitHub App's Integration id.
 *
 *   While doing that migration, a *separate*, independent legacy classic
 *   branch protection rule on `main` was discovered — it required the same
 *   status check but has no bypass-actor concept at all, so it silently
 *   rejected a correctly-configured ruleset bypass. This sat undetected
 *   until someone tested a real push by hand. See
 *   .agents/memory/github-branch-protection-layering.md for the full story.
 *
 *   Nothing previously caught either failure mode automatically. This check
 *   does, by reading the live GitHub state directly:
 *     1. The ruleset's bypass_actors is exactly one entry, and it is the
 *        audited GitHub App (Integration, not DeployKey/Team/OrgAdmin/etc).
 *     2. Classic branch protection has not reappeared on `main` (its
 *        `protection.enabled` flag on the branch resource).
 *
 * Credential note — why GITHUB_ACTIONS_DISPATCH_TOKEN and not the GitHub App:
 *   The obvious choice was the coordinator's own GitHub App installation
 *   token (server/services/github-app-auth.ts) — it authenticates the same
 *   way the real push does. Verified empirically that it does NOT work here:
 *   `GET .../rulesets/{id}` returns 200 but the App's token silently gets
 *   NO `bypass_actors` field at all (not even `[]`) — only a self-referential
 *   `current_user_can_bypass` convenience field, which answers "can *this*
 *   token bypass" but can't reveal whether a second, rogue actor was also
 *   added. `GITHUB_ACTIONS_DISPATCH_TOKEN` (already used the same way by
 *   scripts/cross-tool-promote.ts) does receive the full `bypass_actors`
 *   array, so it's the only currently-available credential that can actually
 *   detect an added bypass actor. Both tokens 403 on the dedicated
 *   `/branches/{branch}/protection` endpoint ("Resource not accessible");
 *   both can read the plain `/branches/{branch}` resource, whose nested
 *   `protection.enabled` field reflects classic-protection state without
 *   needing that elevated permission.
 *
 * This is a LIVE check against the real GitHub API — not a source-code scan.
 * It only ever issues GET requests; it never mutates ruleset or protection
 * state.
 *
 * Run:
 *   npx tsx server/scripts/test-github-branch-bypass-guard.ts
 *   npx tsx server/scripts/test-github-branch-bypass-guard.ts --self-check
 *
 * --self-check mode: confirms the guard currently passes against the REAL
 * live ruleset/branch state, then feeds the same assertion logic synthetic
 * *bad* fixtures (DeployKey re-added, bypass_actors emptied, wrong app id,
 * a second bypass actor, enforcement disabled, classic protection reenabled)
 * and verifies each one is caught. It never mutates the real, live
 * ruleset or branch protection to do this — even briefly reintroducing the
 * bypass hole on production `main` to "prove" the check works is not an
 * acceptable trade, unlike mutating a local source file and restoring it.
 *
 * Skips (exit 0) when GITHUB_ACTIONS_DISPATCH_TOKEN is not present in the
 * environment, e.g. an isolated task-agent worktree that does not inherit
 * this secret.
 */

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

const OWNER = 'davidwmcintosh';
const REPO = 'HolaHola';
const BRANCH = 'main';
const RULESET_ID = 21584232;
const EXPECTED_APP_INTEGRATION_ID = 4984686;

interface RulesetBypassActor {
  actor_id?: number;
  actor_type?: string;
  bypass_mode?: string;
}

interface RulesetState {
  enforcement?: string;
  bypass_actors?: RulesetBypassActor[];
}

interface BranchState {
  protection?: {
    enabled?: boolean;
  };
}

function hasCredentials(): boolean {
  return Boolean(process.env.GITHUB_ACTIONS_DISPATCH_TOKEN);
}

function assertRulesetBypass(ruleset: RulesetState): string[] {
  const failures: string[] = [];
  if (ruleset.enforcement !== 'active') {
    failures.push(`ruleset ${RULESET_ID} enforcement is "${ruleset.enforcement}", expected "active"`);
  }
  const actors = Array.isArray(ruleset.bypass_actors) ? ruleset.bypass_actors : [];
  if (actors.length !== 1) {
    failures.push(`ruleset ${RULESET_ID} has ${actors.length} bypass_actors entries, expected exactly 1`);
    return failures;
  }
  const [actor] = actors;
  if (actor.actor_type !== 'Integration') {
    failures.push(`sole bypass_actors entry has actor_type "${actor.actor_type}", expected "Integration" (found a ${actor.actor_type} bypass — e.g. a DeployKey entry grants bypass to ANY deploy key on the repo, not one)`);
  }
  if (actor.actor_id !== EXPECTED_APP_INTEGRATION_ID) {
    failures.push(`sole bypass_actors entry has actor_id ${actor.actor_id}, expected ${EXPECTED_APP_INTEGRATION_ID} (the audited GitHub App)`);
  }
  return failures;
}

function assertNoClassicProtection(branch: BranchState): string[] {
  if (branch.protection?.enabled === true) {
    return [`classic branch protection is enabled on ${BRANCH} — it has no bypass-actor concept and will silently block the audited GitHub App's push regardless of ruleset config`];
  }
  return [];
}

async function fetchLiveState(): Promise<{ ruleset: RulesetState; branch: BranchState }> {
  const token = process.env.GITHUB_ACTIONS_DISPATCH_TOKEN!;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };

  const rulesetRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/rulesets/${RULESET_ID}`, { headers });
  if (!rulesetRes.ok) {
    const detail = await rulesetRes.text().catch(() => '');
    throw new Error(`Ruleset fetch failed (${rulesetRes.status}): ${detail.slice(0, 300)}`);
  }
  const ruleset = await rulesetRes.json() as RulesetState;
  if (!Array.isArray(ruleset.bypass_actors)) {
    throw new Error(
      `Ruleset ${RULESET_ID} response did not include a bypass_actors array — GITHUB_ACTIONS_DISPATCH_TOKEN may have lost the permission this check relies on to see it (current_user_can_bypass was "${(ruleset as { current_user_can_bypass?: string }).current_user_can_bypass}"). Fix the credential before trusting this check's result.`,
    );
  }

  // Deliberately NOT /branches/{branch}/protection — that dedicated endpoint
  // requires the "administration" permission, which this token does not have
  // (verified: 403 "Resource not accessible by personal access token"). The
  // branch resource's own `protection.enabled` field reflects classic
  // protection state too, and is readable without that elevated permission.
  const branchRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/branches/${BRANCH}`, { headers });
  if (!branchRes.ok) {
    const detail = await branchRes.text().catch(() => '');
    throw new Error(`Branch fetch failed (${branchRes.status}): ${detail.slice(0, 300)}`);
  }
  const branch = await branchRes.json() as BranchState;

  return { ruleset, branch };
}

async function runRealCheck(): Promise<void> {
  sep();
  console.log(B('GitHub main-branch bypass surface guard'));
  console.log(B(`Verifies ruleset ${RULESET_ID} trusts only the audited GitHub App (Integration ${EXPECTED_APP_INTEGRATION_ID})`));
  console.log(B(`and that classic branch protection has not reappeared on ${BRANCH}.`));
  sep();

  if (!hasCredentials()) {
    console.log(`  ${B('SKIP')}: GITHUB_ACTIONS_DISPATCH_TOKEN not set in this environment.`);
    process.exit(0);
    return;
  }

  const { ruleset, branch } = await fetchLiveState();
  const failures = [...assertRulesetBypass(ruleset), ...assertNoClassicProtection(branch)];

  console.log('');
  if (failures.length === 0) {
    console.log(`  ${G('✓')} ruleset ${RULESET_ID} bypass_actors trusts only the audited GitHub App`);
    console.log(`  ${G('✓')} classic branch protection is not active on ${BRANCH}`);
    sep();
    console.log(G('\n✓ All assertions passed — main\'s push-bypass surface is exactly the audited GitHub App.\n'));
    process.exit(0);
  } else {
    for (const f of failures) console.log(`  ${R('✗')} ${f}`);
    sep();
    console.log(R(`\n✗ ${failures.length} assertion(s) failed — main's push-bypass surface has drifted from the audited state.\n`));
    process.exit(1);
  }
}

async function selfCheck(): Promise<void> {
  sep();
  console.log(B('SELF-CHECK: verifying this guard fails against known-bad ruleset/protection states'));
  sep();

  if (!hasCredentials()) {
    console.log(`  ${B('SKIP')}: GITHUB_ACTIONS_DISPATCH_TOKEN not set in this environment.`);
    process.exit(0);
    return;
  }

  // Baseline: the real live state must currently pass. This is a read-only
  // GET against the real ruleset and branch — never a mutation. Actually
  // mutating the live ruleset/protection to prove the failure path would
  // mean briefly reintroducing the exact bypass hole this guard exists to
  // catch, on production `main` — not an acceptable trade even transiently.
  // Failure paths are exercised below against synthetic in-memory fixtures
  // derived from the real baseline instead.
  const { ruleset, branch } = await fetchLiveState();
  const baselineFailures = [...assertRulesetBypass(ruleset), ...assertNoClassicProtection(branch)];
  if (baselineFailures.length > 0) {
    console.log(R('✗ Self-check aborted — the guard already fails against the REAL live state:'));
    for (const f of baselineFailures) console.log(`    ${R('✗')} ${f}`);
    console.log(R('  Fix the live ruleset/protection drift first, then rerun the self-check.'));
    process.exit(1);
    return;
  }
  console.log(G('✓ Baseline: guard passes against the real, live ruleset and branch state'));
  console.log('');

  let selfCheckFailed = 0;

  const rulesetFixtures: Array<{ label: string; bad: RulesetState }> = [
    {
      label: 'a broad DeployKey bypass_actor is re-added alongside the App',
      bad: { ...ruleset, bypass_actors: [...(ruleset.bypass_actors ?? []), { actor_type: 'DeployKey', bypass_mode: 'always' }] },
    },
    {
      label: 'bypass_actors is emptied out entirely',
      bad: { ...ruleset, bypass_actors: [] },
    },
    {
      label: 'the sole bypass_actors entry points at a different Integration id',
      bad: { ...ruleset, bypass_actors: [{ actor_type: 'Integration', actor_id: 1, bypass_mode: 'always' }] },
    },
    {
      label: 'a second Integration bypass_actor is added',
      bad: { ...ruleset, bypass_actors: [...(ruleset.bypass_actors ?? []), { actor_type: 'Integration', actor_id: 999999, bypass_mode: 'always' }] },
    },
    {
      label: 'ruleset enforcement is switched to "disabled"',
      bad: { ...ruleset, enforcement: 'disabled' },
    },
  ];

  for (const { label, bad } of rulesetFixtures) {
    const failures = assertRulesetBypass(bad);
    if (failures.length > 0) {
      console.log(`  ${G('✓')} Guard correctly FAILS when: ${label}`);
    } else {
      console.log(`  ${R('✗')} Guard still PASSES when: ${label} — this drift would go uncaught`);
      selfCheckFailed++;
    }
  }

  const branchFixtures: Array<{ label: string; bad: BranchState }> = [
    {
      label: 'classic branch protection reappears on main',
      bad: { ...branch, protection: { enabled: true } },
    },
  ];

  for (const { label, bad } of branchFixtures) {
    const failures = assertNoClassicProtection(bad);
    if (failures.length > 0) {
      console.log(`  ${G('✓')} Guard correctly FAILS when: ${label}`);
    } else {
      console.log(`  ${R('✗')} Guard still PASSES when: ${label} — this drift would go uncaught`);
      selfCheckFailed++;
    }
  }

  sep();
  if (selfCheckFailed === 0) {
    console.log(G('\n✓ Self-check passed: every known drift scenario makes this guard fail.\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗ Self-check FAILED: ${selfCheckFailed} drift scenario(s) were not caught.\n`));
    process.exit(1);
  }
}

function main(): void {
  const task = process.argv.includes('--self-check') ? selfCheck() : runRealCheck();
  task.catch((err) => {
    console.error(R(`✗ ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  });
}

main();

import { basename } from 'node:path';
import { SourceControlService } from '../services/source-control-service';
import { SourceReconciliationService } from '../services/source-reconciliation-service';
import { assertOwnershipForInfraMutation, type OwnershipProbe } from '../services/infra-mutation-guard';
import { readCheckoutKind, type CheckoutKind } from '../services/task-ownership-service';

const MACHINE_RESULT_PREFIX = 'SOURCE_CONTROL_RESULT_JSON:';

/*
 * Task #1470 inventory of this CLI's actions, and why each is (or isn't)
 * wired through the ownership guard (server/services/infra-mutation-guard.ts):
 *
 * - `status`, `reconcile preflight|candidate|inspect`: read-only. They never
 *   push, write a promotion record, or mutate anything outside the local
 *   `.local/source-control-*` status files. Out of scope per the task's own
 *   "read-only external calls carry no mutation risk" exclusion.
 *
 * - `prepare` (SourceControlService.preparePromotion): fetches the remote
 *   heads (a read-only `git fetch`), runs the local validation suite, and
 *   writes a local `ready_to_promote` status file. It never calls
 *   `runGit(['push', ...])` and never contacts a third-party API that
 *   changes remote state. Out of scope for the same reason as above.
 *
 * - `record` (SourceControlService.recordPromotion): reads a lot (remote
 *   commit proof, publication markers, Render release evidence -- all
 *   read-only GETs/fetches) and, once every proof checks out, writes an
 *   immutable local receipt file plus a row in this app's own database. It
 *   never pushes to GitHub and never calls an external write API. Writing
 *   to this app's own database is not the "credentialed external-mutation"
 *   category task #1470 targets (Cloudflare DNS, Neon control plane,
 *   GitHub Actions dispatch, S3 -- systems *other* than this app that a
 *   credential lets you change). Out of scope.
 *
 * - `sync` (SourceControlService.sync): the one action here that performs a
 *   real credentialed external mutation -- `git push` to the real GitHub
 *   `main`, using the GitHub App installation token. This is gated below.
 *
 *   The gate is conditional on checkout kind rather than an unconditional
 *   `--task-ref` requirement, because `sync` already has a legitimate,
 *   shipped, autonomous caller with no task-ref concept: the Alden Build
 *   Guardian (scripts/alden-build-guardian.js) shells out to this exact CLI
 *   after every build-verification pass, from the primary worktree/main
 *   session, the same way `npm run source-control:sync` does for a human
 *   operator. Requiring `--task-ref` unconditionally would permanently break
 *   that caller today, because `TaskOwnershipService`'s receipt verification
 *   (`verifyActiveMainReceipt` / `verifyActiveIsolatedProof`) is not wired up
 *   yet and always resolves false (see
 *   .agents/memory/task-ownership-default-probe-gap.md) -- every real
 *   caller would be refused, not just an `unknown_stop` task.
 *
 *   So: a `primary_worktree` checkout (the Guardian, `npm run
 *   source-control:sync`, a human operator's own shell) proceeds exactly as
 *   before, no flag required. Any other checkout kind -- in particular the
 *   `linked_worktree` a task agent's isolated environment runs from -- must
 *   supply `--task-ref` and pass `assertOwnershipForInfraMutation` before
 *   the push happens. `readCheckoutKind` is a much weaker signal than a
 *   verified ownership receipt (`.git` file contents are local and not
 *   tamper-proof against a deliberately adversarial escape attempt), but it
 *   directly closes the realistic case task #1470 describes -- a task that
 *   should have stopped, still running in its own isolated worktree, able to
 *   push its own unreviewed commits straight to production `main`. Once the
 *   receipt verification above is wired up, `main_session`/`isolated_agent`
 *   proof should replace this checkout-kind heuristic for `sync` too, the
 *   same as every other gated call site.
 */

export interface SourceControlCliOptions {
  service?: SourceControlService;
  reconciliation?: SourceReconciliationService;
  probeOwnership?: OwnershipProbe;
  resolveCheckoutKind?: () => Promise<CheckoutKind>;
}
function usage(): never {
  console.error('Usage: source-control-cli.ts status|sync|prepare|record <sha>|drift | reconcile preflight --local-ref <sha> --remote <name> --remote-branch <name> | reconcile candidate|inspect --packet <path>');
  process.exit(64);
}

function writeResult(result: unknown): void {
  if (process.argv.includes('--machine-readable')) {
    console.log(`${MACHINE_RESULT_PREFIX}${JSON.stringify(result)}`);
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireTaskRef(): string {
  const taskRef = readOption('--task-ref');
  if (!taskRef) {
    throw new Error(
      'Missing --task-ref <ref> -- required so the ownership guard can verify this sync is '
      + 'authorized from a non-primary checkout (see server/services/infra-mutation-guard.ts).',
    );
  }
  return taskRef;
}
export async function main(options: SourceControlCliOptions = {}): Promise<void> {
  const action = process.argv[2];
  const actor = readOption('--actor') || 'cli';
  const service = options.service || new SourceControlService();
  if (action === 'reconcile') {
    const reconciliation = options.reconciliation || new SourceReconciliationService();
    const operation = process.argv[3];
    const result = operation === 'preflight'
      ? await reconciliation.preflight(readOption('--local-ref') || usage(), readOption('--remote') || 'origin', readOption('--remote-branch') || 'main')
      : operation === 'candidate'
        ? await reconciliation.candidate(readOption('--packet') || usage())
        : operation === 'inspect'
          ? await reconciliation.inspect(readOption('--packet') || usage())
        : usage();
    writeResult(result);
    if (!result.ok) process.exitCode = result.state === 'lease_contended' || result.state === 'dirty_primary_worktree' ? 75 : 1;
    return;
  }

  if (action === 'status') {
    const status = await service.getStatus();
    if (!status) {
      writeResult({ state: 'unknown', error: 'No source-control status has been recorded.' });
      return;
    }
    writeResult(status);
    return;
  }

  if (action === 'drift') {
    // On-demand pre-publish check: is HEAD still the exact commit the last
    // `prepare` (or auto-promotion) validated? Meant to be run by a human
    // right before clicking Publish, independent of the scheduler's own
    // cadence -- see SourceControlService.checkCandidateDrift().
    const report = await service.checkCandidateDrift();
    writeResult(report);
    // Exit 0 only for a positively-verified, unexpired, explicit candidate
    // that matches HEAD. Every other reason -- including "no candidate"
    // and "could not confirm" -- must not read as clearance to publish.
    process.exitCode = report.reason === 'match' ? 0 : 1;
    return;
  }

  if (action === 'sync') {
    const resolveCheckoutKind = options.resolveCheckoutKind || (() => readCheckoutKind(process.cwd()));
    const checkoutKind = await resolveCheckoutKind();
    if (checkoutKind !== 'primary_worktree') {
      const taskRef = requireTaskRef();
      await assertOwnershipForInfraMutation(taskRef, 'source-control:sync', options.probeOwnership);
    }
  }

  const result = action === 'sync'
    ? await service.sync(actor)
    : action === 'prepare'
      ? await service.preparePromotion(actor)
      : action === 'record'
        ? await service.recordPromotion(
            process.argv[3] || usage(),
            actor,
            undefined,
            readOption('--publication-reference'),
          )
        : usage();

  writeResult(result);
  if (!result.ok) process.exitCode = result.state === 'dirty' || result.state === 'retrying' ? 75 : 1;
}

// Guard CLI dispatch behind an entrypoint check -- otherwise importing this
// module (e.g. from a test file) would run main() as a side effect of the
// import and misread the importer's own argv as a subcommand. Mirrors the
// same guard in scripts/neon-branch.ts.
if (basename(process.argv[1] ?? '') === 'source-control-cli.ts') {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

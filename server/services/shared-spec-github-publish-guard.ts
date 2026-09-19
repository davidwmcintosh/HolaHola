import { assertOwnershipForInfraMutation, InfraMutationBlockedError, type OwnershipProbe } from "./infra-mutation-guard";
import { TaskOwnershipService } from "./task-ownership-service";
import type { SpecPublicationProviderContext } from "./shared-spec-publication";

/**
 * Builds the `authorizeMutation` hook `GitHubSpecPublisher` requires.
 *
 * `GitHubSpecPublisher` itself stays a narrow, portable REST client with no
 * built-in notion of actor/task identity (see its config JSDoc). This is the
 * task-ownership-backed policy this project wires into it: closes the gap
 * recorded in .agents/memory/task-ownership-guard-scope.md, where a blocked
 * task (`unknown_stop`) whose process still held a constructed
 * GitHubSpecPublisher (or its token) could still push a branch and open a
 * real pull request, because nothing in the publish path checked who was
 * calling.
 *
 * A missing `taskRef` OR a missing `actorId` is refused the same as
 * `unknown_stop`: an unscoped or unauthenticated call proves nothing about
 * which task is acting, so it is never assumed safe. `actorId` always comes
 * from SharedSpecPublicationService's already-authenticated ActorContext
 * (see SpecPublicationProviderContext) -- never from caller-supplied request
 * data -- which is what stops a blocked or different actor from simply
 * naming someone else's active taskRef in a header. This mirrors
 * CloudflareDnsService.updateDnsRecordContent's mandatory taskRef with no
 * bypass sentinel.
 *
 * `probe` is injectable for tests; production callers should pass
 * `createGitHubPublishOwnershipProbe(hasActiveOwnershipReceipt)` (below),
 * which binds the check to the real, founder-approved task-ownership
 * receipts table. Leaving `probe` at its bare default (a real
 * TaskOwnershipService with no verifier callbacks, via
 * assertOwnershipForInfraMutation) always resolves to `unknown_stop` and
 * refuses every call -- that default has no working verifier, so do not wire
 * it as-is in production.
 */
export function createSharedSpecGitHubPublishGuard(
  probe?: OwnershipProbe,
): (context: SpecPublicationProviderContext, action: string) => Promise<void> {
  return async (context, action) => {
    if (!context.taskRef) {
      throw new InfraMutationBlockedError(
        action,
        "(none)",
        "unknown_stop",
        "No taskRef was supplied with this publish request; an unscoped call cannot prove task ownership",
      );
    }
    if (!context.actorId) {
      throw new InfraMutationBlockedError(
        action,
        context.taskRef,
        "unknown_stop",
        "No authenticated actor was resolved for this publish request; an unauthenticated call cannot prove task ownership",
      );
    }
    await assertOwnershipForInfraMutation(context.taskRef, action, probe, context.actorId);
  };
}

/**
 * The real, production ownership probe for the GitHub publish guard.
 *
 * Resolves `isolated_agent` (the classification TaskOwnershipService uses
 * for a fresh, out-of-band proof rather than a live main-checkout session --
 * see classifyTaskOwnership in task-ownership-service.ts) only when
 * `hasActiveReceipt(taskRef, actorId)` resolves true: a founder has approved
 * a task-ownership challenge for exactly this taskRef+actor pair and the
 * resulting receipt has not expired or been revoked (see
 * server/services/founder-task-ownership-service.ts). Everything else,
 * including a taskRef that simply looks active but never completed that
 * protocol, resolves to `unknown_stop` and is refused -- the same
 * fail-closed default TaskOwnershipService already uses everywhere else.
 *
 * Scoping limitation, documented rather than hidden: this only ever proves
 * "isolated_agent" (a completed founder-approval receipt). No host in this
 * codebase has a real, working `verifyActiveMainReceipt` implementation yet
 * (see .agents/memory/task-ownership-guard-scope.md), so a task that never
 * went through the receipt protocol is refused here even if it is, in fact,
 * an ordinary active (non-blocked) task. Widening that is separate,
 * follow-up-worthy work -- not a silent bypass of this guard.
 *
 * `hasActiveReceipt` is injected so this stays unit-testable without a live
 * database: production wiring passes
 * founder-task-ownership-service.ts's `hasActiveOwnershipReceipt`; tests
 * pass a fake. `rootDir` is also injectable, for the same reason
 * TaskOwnershipServiceOptions.rootDir is: probe() reads real filesystem
 * evidence (the task artifact, the checkout kind) that tests must be able to
 * fixture instead of depending on the real repo state.
 */
export function createGitHubPublishOwnershipProbe(
  hasActiveReceipt: (taskRef: string, actorId: string) => Promise<boolean>,
  rootDir?: string,
): OwnershipProbe {
  return (taskRef, actorId) => new TaskOwnershipService({
    rootDir,
    verifyActiveIsolatedProof: () => (actorId ? hasActiveReceipt(taskRef, actorId) : Promise.resolve(false)),
  }).probe(taskRef);
}

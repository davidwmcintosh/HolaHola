/**
 * Autonomous production driver for Coordinator V2 attempts on the Gemini
 * provider. Progresses an attempt through repeated
 * CoordinationGeminiAdapter.turn() calls -- feeding real host tool results
 * back in -- until it reaches a terminal state, with no human or one-off
 * script calling each state-machine step by hand.
 *
 * server/scripts/verify-gemini-v2-adapter-live.ts (task #1639) proved turn()
 * works end to end, but only because that script personally drove every
 * step. This module is the production equivalent: something server-side
 * that drives ANY open Gemini attempt on its own. See
 * coordination-gemini-provider-worker.ts for the polling loop that calls
 * runGeminiProviderDriverBatch().
 *
 * -- Packet authoring scope note --
 * No production code path today turns a task's markdown/description into an
 * InheritancePacket's model-facing instruction -- coordination-task-metadata-
 * service.ts and its Postgres registry only validate session-creation inputs
 * (taskRef/repositoryIdentity/startingCommit/artifact digest), they never
 * author packet content, and coordinationV2Attempts.packetId is a legacy FK
 * (coordinationRuntimePackets) that nothing populates for V2 attempts. This
 * driver is therefore the first real owner of packet construction for a V2
 * attempt: it builds a generic, parameterized instruction from data already
 * on the session row rather than reading task files from disk. Teaching a
 * real packet-builder to read actual task instructions is a separate concern
 * (see the task-instruction-authoring follow-up on this task).
 *
 * -- Host-result protocol convention --
 * This driver records {turnNumber, callId, name} on every intent_ready
 * event's metadata.driverContext, and expects a host to eventually submit a
 * result shaped {callId, name, toolResult} through
 * resultCoordinationTransportWork that echoes the callId/name it was asked
 * for. A mismatch is treated as an unsupported_provider_outcome provider
 * failure. pollCoordinationTransportWork and claimCoordinationTransportWork
 * (coordination-transport-lease-service.ts) surface that same
 * {callId, name} pair as `attempt.pendingIntent` once the attempt reaches
 * waiting_for_host/host_active, so a real host driven purely through the
 * authenticated poll/claim/result protocol -- not a privileged direct read
 * of this driverContext metadata -- can learn what to execute next.
 *
 * -- Crash-safety convention --
 * Every transition into provider_continuation carries
 * eventMetadata: { turnNumber, priorToolResults } -- the exact input the
 * driver is about to call turn() with. A pass that finds an attempt already
 * sitting in provider_active, provider_continuation, or intent_ready (e.g.
 * because a prior pass crashed between calling turn() and recording its
 * outcome) re-derives what it needs from the latest relevant event and
 * proceeds. This makes the ordinary "process open attempts" pass itself
 * crash-safe, at the accepted cost that a retried turn() call may return a
 * different (but equally real) Gemini response than the lost call would
 * have. That is a documented limitation, not something this driver
 * engineers away -- the task this driver serves is making the system run to
 * completion on its own, not eliminating every microsecond crash window.
 *
 * -- Session-completion scope note --
 * A natural finish only calls session-level acceptCoordinationCompletion()
 * when the session's completionCriteria.requiredCompletionEvidence is
 * exactly ['digest'] -- the one evidence shape this driver knows how to
 * produce (the real sha256 responseDigest of the finishing turn). Any other
 * evidence shape is logged and left for a human or a future caller; the
 * ATTEMPT still completes either way.
 */
import { and, desc, eq, gt, inArray, notInArray } from 'drizzle-orm';
import { db } from '../db';
import {
  coordinationV2Attempts,
  coordinationV2AttemptEvents,
  coordinationV2PolicyVersions,
  coordinationV2Sessions,
  coordinationV2TransportWorkResults,
  type CoordinationV2Attempt,
  type CoordinationV2Session,
} from '@shared/schema';
import { transitionCoordinationAttempt } from './coordination-attempt-service';
import type { AttemptCommand } from './coordination-attempt-state';
import { applyCoordinationProviderFailure } from './coordination-lifecycle-facade-service';
import { transitionCoordinationSession } from './coordination-session-service';
import { acceptCoordinationCompletion } from './coordination-cleanup-service';
import { canonicalizePolicy } from './coordination-policy-canonicalization';
import {
  CoordinationGeminiAdapter,
  DEFAULT_READABLE_PATH,
  DEFAULT_TEST_COMMAND_NAME,
  DEFAULT_TEST_COMMAND_TEMPLATE,
  type GeminiSessionToolTargets,
  type GeminiTurnResult,
} from './coordination-provider-adapters/gemini';
import {
  digestCanonical,
  isPlainRecord,
  type Assignment,
  type ExecutionEnvelope,
  type InboxItem,
  type InheritancePacket,
  type NormalizedOutcome,
} from './coordination-runtime';
import type { ProviderFailure } from './coordination-provider-failure';

const MAX_TURN = 4;
/**
 * intent_ready is included even though it is not one of the four states the
 * task names, so that a crash between recording intent_ready and recording
 * host_wait is also self-healing (see resolveTurnInput). waiting_for_host and
 * host_active are deliberately excluded -- those belong to the host actor,
 * never to this driver.
 */
const OPEN_ATTEMPT_STATES = [
  'created', 'provider_active', 'provider_continuation', 'result_ready', 'intent_ready',
] as const;

/** Real, unmocked Gemini transport -- identical wiring to the live verify script. */
async function liveTransport(request: {
  url: string; headers: Record<string, string>; body: string; signal?: AbortSignal;
}): Promise<{ status: number; body: string }> {
  const response = await fetch(request.url, {
    method: 'POST', headers: request.headers, body: request.body, signal: request.signal,
  });
  const body = await response.text();
  return { status: response.status, body };
}

let sharedAdapter: CoordinationGeminiAdapter | null = null;
function geminiAdapter(): CoordinationGeminiAdapter {
  if (!sharedAdapter) sharedAdapter = new CoordinationGeminiAdapter(liveTransport);
  return sharedAdapter;
}

function requestKey(attemptId: string, step: string): string {
  return `gemini-driver:${attemptId}:${step}`;
}

/**
 * coordination-policy-canonicalization.ts's paths() already rejects `..`
 * traversal segments, `~` home-dir expansion, and null bytes for every
 * policy that declares `paths` -- but it stops short of rejecting an
 * absolute path (POSIX `/foo`, a Windows drive letter `C:\foo`, or a UNC
 * share `\\host\share`), because that canonicalizer is shared by every
 * policy consumer, present and future, not just this one. Before task #1644
 * this was moot: nothing ever turned a policy's `paths` entry into a real
 * readFileSync target, so an absolute-path entry was inert data. This
 * function is that first real consumer, so it is the one place responsible
 * for enforcing the task's own stated safety boundary -- "a workspace-
 * relative path boundary, not full arbitrary [...] file access" -- for
 * this specific use. A path that fails this check is treated exactly like
 * an absent one (see loadSessionToolTargets): fall back to the fixed,
 * known-safe DEFAULT_READABLE_PATH rather than reject the whole session.
 */
function isWorkspaceRelativePath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  if (normalized.startsWith('/')) return false; // POSIX absolute
  if (/^[A-Za-z]:/.test(normalized)) return false; // Windows drive letter, e.g. C:/foo
  if (normalized.startsWith('//')) return false; // UNC share, e.g. //host/share
  return true;
}

/**
 * True when the attempt's current database state no longer matches
 * `expected` -- i.e. a concurrent pass (another autoscale instance, or any
 * other overlapping poll) has already advanced this attempt while this
 * call's own turn() request was in flight. See the concurrency-fence note in
 * callTurnAndAdvance for why this must be checked before applying any
 * turn() outcome.
 */
async function attemptMovedOn(attemptId: string, expected: 'provider_active' | 'provider_continuation'): Promise<boolean> {
  const rows = await db.select({ state: coordinationV2Attempts.state })
    .from(coordinationV2Attempts).where(eq(coordinationV2Attempts.id, attemptId));
  const current = rows[0]?.state;
  if (current === expected) return false;
  console.warn(
    `[CoordinationGeminiDriver] discarding a turn() outcome for attempt ${attemptId}: expected state ` +
    `'${expected}' but found '${current ?? 'missing'}' -- another concurrent pass already advanced this ` +
    'attempt while this call was in flight.',
  );
  return true;
}

type DriverContext = { turnNumber: number; priorToolResults: unknown[] };
type PendingIntentContext = { turnNumber: number; callId: string; name: string };
type ResolvedInput = DriverContext & { fromState: 'provider_active' | 'provider_continuation' };

/**
 * Thrown when an attempt's own recorded history does not have the shape this
 * driver needs to determine what to do next -- e.g. an intent_ready event
 * missing driverContext, most commonly because the row predates this driver
 * or was produced by a different caller entirely (observed for real: an
 * orphaned attempt from task #1639's own verify-gemini-v2-adapter-live.ts,
 * whose manually-driven transitions never wrote driverContext). This is a
 * structural, non-transient problem -- retrying the same read reproduces the
 * exact same error forever. processGeminiAttempt catches this specifically
 * and fails the attempt outright instead of leaving it to be picked up and
 * re-thrown on every future poll indefinitely.
 */
class UnresolvableAttemptHistoryError extends Error {}

function readDriverContext(event: { metadata: unknown } | undefined): DriverContext {
  const metadata = event?.metadata as Record<string, unknown> | undefined;
  const context = metadata?.driverContext as Partial<DriverContext> | undefined;
  if (!context || typeof context.turnNumber !== 'number' || !Array.isArray(context.priorToolResults)) {
    throw new UnresolvableAttemptHistoryError(
      `Gemini driver: expected event to carry a driverContext {turnNumber, priorToolResults}, found ${JSON.stringify(metadata)}`,
    );
  }
  return { turnNumber: context.turnNumber, priorToolResults: context.priorToolResults };
}

type CompletedEventContext = { turnNumber: number; responseDigest: string };

function readCompletedContext(event: { metadata: unknown } | undefined): CompletedEventContext {
  const metadata = event?.metadata as Record<string, unknown> | undefined;
  const context = metadata?.driverContext as Partial<CompletedEventContext> | undefined;
  if (!context || typeof context.turnNumber !== 'number' || typeof context.responseDigest !== 'string') {
    throw new UnresolvableAttemptHistoryError(
      `Gemini driver: expected attempt_completed event to carry a driverContext {turnNumber, responseDigest}, found ${JSON.stringify(metadata)}`,
    );
  }
  return { turnNumber: context.turnNumber, responseDigest: context.responseDigest };
}

function readPendingIntent(event: { metadata: unknown } | undefined): PendingIntentContext {
  const metadata = event?.metadata as Record<string, unknown> | undefined;
  const context = metadata?.driverContext as Partial<PendingIntentContext> | undefined;
  if (!context || typeof context.turnNumber !== 'number' || typeof context.callId !== 'string' || typeof context.name !== 'string') {
    throw new UnresolvableAttemptHistoryError(
      `Gemini driver: expected intent_ready event to carry a driverContext {turnNumber, callId, name}, found ${JSON.stringify(metadata)}`,
    );
  }
  return { turnNumber: context.turnNumber, callId: context.callId, name: context.name };
}

async function latestEvent(attemptId: string, eventType: string) {
  const rows = await db.select().from(coordinationV2AttemptEvents)
    .where(and(eq(coordinationV2AttemptEvents.attemptId, attemptId), eq(coordinationV2AttemptEvents.eventType, eventType)))
    .orderBy(desc(coordinationV2AttemptEvents.sequence)).limit(1);
  return rows[0];
}

/** Skips over transport_resumed no-op recovery events to find the event that actually put the attempt in its current state. */
async function latestSubstantiveEvent(attemptId: string) {
  const rows = await db.select().from(coordinationV2AttemptEvents)
    .where(eq(coordinationV2AttemptEvents.attemptId, attemptId))
    .orderBy(desc(coordinationV2AttemptEvents.sequence)).limit(50);
  const found = rows.find((row) => row.eventType !== 'transport_resumed');
  if (!found) throw new UnresolvableAttemptHistoryError(`Gemini driver: attempt ${attemptId} has no substantive event within the last 50`);
  return found;
}

/**
 * Derives this session's own real read_file target and run_test command from
 * its approved policy (coordinationV2PolicyVersions.canonicalPolicy's `paths`
 * and `commands` fields -- the pre-existing, safety-validated "approved
 * repositories, paths, and commands" fields the policy schema already
 * supports but which nothing populated before this) instead of the fixed
 * fallback in coordination-provider-adapters/gemini.ts. Re-canonicalizes the
 * raw DB row at read time rather than trusting the stored jsonb blob's shape
 * directly -- the same defense-in-depth pattern coordination-windows-
 * generation.ts uses for the same table.
 *
 * Returns undefined -- meaning "use the fixed default" -- whenever the
 * policy does not declare both a real path and a `commands` entry named
 * 'test' with a template. That is a deliberate, safe fallback: a session
 * that never opted into a custom target keeps exactly the fixed-fixture
 * behavior the system always had, rather than failing the attempt outright.
 */
async function loadSessionToolTargets(session: CoordinationV2Session): Promise<GeminiSessionToolTargets | undefined> {
  const versionRows = await db.select({ canonicalPolicy: coordinationV2PolicyVersions.canonicalPolicy })
    .from(coordinationV2PolicyVersions).where(eq(coordinationV2PolicyVersions.id, session.policyVersionId));
  const rawPolicy = versionRows[0]?.canonicalPolicy;
  if (!rawPolicy) return undefined;
  let policy: Record<string, unknown>;
  try {
    policy = canonicalizePolicy(rawPolicy) as Record<string, unknown>;
  } catch (error) {
    console.warn(
      `[CoordinationGeminiDriver] session ${session.id}'s stored policy (version ${session.policyVersionId}) ` +
      'failed re-canonicalization -- falling back to the fixed default read_file/run_test target: ' +
      `${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
  const paths = Array.isArray(policy.paths)
    ? policy.paths.filter((entry): entry is string => typeof entry === 'string' && isWorkspaceRelativePath(entry))
    : [];
  const commands = Array.isArray(policy.commands) ? policy.commands : [];
  const testCommand = commands.find((entry): entry is { name: string; template: string } =>
    isPlainRecord(entry) && entry.name === 'test' && typeof entry.template === 'string');
  if (!paths.length || !testCommand) return undefined;
  return { readablePath: paths[0], testCommandName: testCommand.name, testCommandTemplate: testCommand.template };
}

/**
 * Builds the packet for an attempt. Deterministic over (attempt.id, session
 * fields) -- every field is derived from immutable session/attempt data, no
 * randomUUID()/Date.now() -- so the exact same packet bytes are reused on
 * every turn() call for the life of the attempt, whether this is the first
 * call or a crash-recovery retry. toolTargets is likewise immutable for the
 * life of the attempt: it is derived from the session's policyVersionId, and
 * policy version rows are never mutated in place (a new policy gets a new
 * version row and a new id).
 */
function buildAttemptPacket(
  session: CoordinationV2Session,
  attempt: CoordinationV2Attempt,
  toolTargets: GeminiSessionToolTargets | undefined,
): InheritancePacket {
  const readablePath = toolTargets?.readablePath ?? DEFAULT_READABLE_PATH;
  const testCommandTemplate = toolTargets?.testCommandTemplate ?? DEFAULT_TEST_COMMAND_TEMPLATE;
  const threadId = `gemini-driver-thread:${attempt.id}`;
  const inboxItem: InboxItem = {
    id: `gemini-driver-inbox:${attempt.id}`,
    eventId: `gemini-driver-event:${attempt.id}`,
    threadId,
    taskId: `task-${session.taskRef}`,
    sequence: 1,
    payload: {
      content: {
        kind: 'coordination_assignment',
        instruction:
          `You are the coordination host execution agent for coordination session ${session.id} ` +
          `(task ${session.taskRef}, repository ${session.repositoryIdentity}, starting commit ` +
          `${session.startingCommit}). Make bounded, verifiable, read-only progress on this task using ` +
          'the available function tools. git_status and git_diff take no arguments -- call each with an ' +
          `empty object. run_test also takes no arguments; it runs this session's own approved check, ` +
          `\`${testCommandTemplate}\`. read_file reads this session's own approved target, ` +
          `${readablePath} -- call it with {"path": "${readablePath}"} (an empty object also reads the ` +
          'same file, but naming it explicitly is preferred). If no [TOOL_RESULTS] ' +
          'block is present yet in this conversation, this is your first turn: you must call exactly one ' +
          'of those function tools now (git_status if you are uncertain which); do not respond with text ' +
          'only. Each [TOOL_RESULTS] block also carries a turnBudget object (completedToolCalls, ' +
          'maxTurns, turnsRemainingIncludingThisOne, mustRespondWithPlainTextNoToolCall) that tells you ' +
          'exactly how many tool calls you have already made and how many remain -- trust that object, ' +
          'not your own count, since you do not see earlier turns. Once you have made at least one tool ' +
          'call, you have already made real, verified progress: as soon as turnBudget says ' +
          'mustRespondWithPlainTextNoToolCall is true, or you judge a second check would not genuinely ' +
          'add value, stop calling tools and respond with a short plain-text summary of what the tool ' +
          'result(s) showed instead.',
        taskRef: session.taskRef,
        repositoryIdentity: session.repositoryIdentity,
      },
    },
  };
  const assignment: Assignment = {
    assignmentEventId: `gemini-driver-assignment:${attempt.id}`,
    assignmentAuthor: 'luca-replit',
    taskId: `task-${session.taskRef}`,
    threadId,
    expectedSequence: 1,
  };
  const envelope: ExecutionEnvelope = {
    worktreeLabel: `gemini-driver:${attempt.id}`,
    worktreePath: session.repositoryIdentity,
    argv: [],
    patchDigest: null,
    repositoryLabel: 'HolaHola',
    startingCommit: session.startingCommit,
    timeoutMs: 600000,
    taskRef: session.taskRef,
  };
  const windowId = `gemini-driver-window:${attempt.id}`;
  const packetWithoutDigest: Omit<InheritancePacket, 'digest'> = {
    id: `gemini-driver-packet:${attempt.id}`,
    version: 1,
    actor: 'luca-gemini',
    runtimeRegistrationId: `gemini-driver-runtime:${attempt.id}`,
    profileId: `gemini-driver-profile:${attempt.id}`,
    createdAt: attempt.createdAt.getTime(),
    supersedesClaimId: null,
    windowId,
    windowDigest: digestCanonical({ windowId, threadId, itemIds: [inboxItem.id] }),
    orderedInboxItemIds: [inboxItem.id],
    orderedEventIds: [inboxItem.eventId],
    orderedThreadIds: [threadId],
    assignment,
    inherited: [inboxItem.payload],
    envelope,
  };
  return { ...packetWithoutDigest, digest: digestCanonical(packetWithoutDigest) };
}

/** Exhaustive over the 9 non-'consumed' NormalizedOutcome values -- see coordination-runtime.ts. */
function mapOutcomeToFailure(result: GeminiTurnResult): ProviderFailure {
  const outcome: NormalizedOutcome = result.outcome;
  const details = result.providerDetails as { failure?: string } | undefined;
  switch (outcome) {
    case 'safety_blocked': return { kind: 'safety_blocked' };
    case 'refused': return { kind: 'terminal_rejection' };
    case 'context_limit': return { kind: 'limit_exhausted' };
    case 'interrupted': return { kind: 'transport_interrupted' };
    case 'empty_response': return { kind: 'malformed_response' };
    case 'malformed_function_call': return { kind: 'malformed_function_call' };
    case 'unsupported_provider_outcome': return { kind: 'unsupported_provider_outcome' };
    case 'retryable_provider_error':
      return details?.failure === 'rate_limited' ? { kind: 'rate_limited' } : { kind: 'provider_outage' };
    case 'terminal_provider_error':
      if (details?.failure === 'authentication_failed') return { kind: 'authentication_failed' };
      if (details?.failure === 'limit_exhausted') return { kind: 'limit_exhausted' };
      return { kind: 'terminal_rejection' };
    case 'consumed':
      throw new Error('Gemini driver: mapOutcomeToFailure called with a consumed outcome, which is not a failure');
    default: {
      const exhaustive: never = outcome;
      throw new Error(`Gemini driver: unhandled NormalizedOutcome ${exhaustive as string}`);
    }
  }
}

/**
 * Determines what turn() should be called with next (or that nothing more
 * can be done this pass) and performs whatever bookkeeping transition that
 * requires. Returns null when the attempt has been fully handled for this
 * pass without needing a turn() call (host_wait recovery, or a host-result
 * protocol mismatch that already failed the attempt).
 */
async function resolveTurnInput(
  session: CoordinationV2Session,
  attempt: CoordinationV2Attempt,
  actorId: string,
  now: Date,
): Promise<ResolvedInput | null> {
  if (attempt.state === 'created') {
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now,
      requestKey: requestKey(attempt.id, 't1-provider-started'),
      command: { type: 'provider_started' },
    });
    return { turnNumber: 1, priorToolResults: [], fromState: 'provider_active' };
  }

  if (attempt.state === 'provider_continuation') {
    const event = await latestEvent(attempt.id, 'provider_continuation');
    return { ...readDriverContext(event), fromState: 'provider_continuation' };
  }

  if (attempt.state === 'provider_active') {
    const event = await latestSubstantiveEvent(attempt.id);
    if (event.eventType === 'provider_started') return { turnNumber: 1, priorToolResults: [], fromState: 'provider_active' };
    if (event.eventType === 'provider_resumed') return { ...readDriverContext(event), fromState: 'provider_active' };
    throw new UnresolvableAttemptHistoryError(
      `Gemini driver: attempt ${attempt.id} is provider_active but its latest substantive event ` +
      `(${event.eventType}) is neither provider_started nor provider_resumed`,
    );
  }

  if (attempt.state === 'intent_ready') {
    // Crash recovery: intent_ready committed, host_wait never did.
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now,
      requestKey: requestKey(attempt.id, 'host-wait-recovery'),
      command: { type: 'host_wait' },
    });
    return null;
  }

  if (attempt.state === 'result_ready') {
    const intentEvent = await latestEvent(attempt.id, 'intent_ready');
    const pending = readPendingIntent(intentEvent);
    const resultRows = await db.select().from(coordinationV2TransportWorkResults)
      .where(eq(coordinationV2TransportWorkResults.attemptId, attempt.id))
      .orderBy(desc(coordinationV2TransportWorkResults.createdAt)).limit(1);
    const resultRow = resultRows[0];
    if (!resultRow) throw new UnresolvableAttemptHistoryError(`Gemini driver: attempt ${attempt.id} is result_ready but no transport work result row exists`);
    const submitted = resultRow.result as { callId?: unknown; name?: unknown; toolResult?: unknown };
    if (submitted.callId !== pending.callId || submitted.name !== pending.name) {
      await applyCoordinationProviderFailure({
        sessionId: session.id, attemptId: attempt.id, actorId,
        requestKey: requestKey(attempt.id, `t${pending.turnNumber}-host-result-mismatch`),
        failure: {
          kind: 'unsupported_provider_outcome',
          detail: 'host-submitted result callId/name did not match the pending intent',
        },
        expectedFromState: 'result_ready',
      });
      return null;
    }
    const turnNumber = pending.turnNumber + 1;
    // completedToolCalls/turnsRemaining are handed to the model explicitly
    // because it cannot otherwise perceive them: each turn() call is a
    // stateless request carrying only the static per-attempt instruction
    // plus this one latest tool result, never a running conversation
    // history, so the model has no way to "remember" how many tool calls
    // it has already made across earlier turns. Observed for real (task
    // #1642 live demo, 2026-09-29): without this, a real run called a tool
    // on every one of the 4 allowed turns and hit the turn cap
    // (limit_exhausted) rather than ever finishing with a plain-text
    // summary, because each turn looked identically like "your first
    // additional check" to the model.
    const priorToolResults = [
      { callId: pending.callId, name: pending.name, result: submitted.toolResult },
      {
        turnBudget: {
          completedToolCalls: pending.turnNumber,
          maxTurns: MAX_TURN,
          turnsRemainingIncludingThisOne: MAX_TURN - turnNumber + 1,
          mustRespondWithPlainTextNoToolCall: turnNumber >= MAX_TURN,
        },
      },
    ];
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now,
      requestKey: requestKey(attempt.id, `t${turnNumber}-provider-continuation`),
      command: { type: 'provider_continuation' },
      eventMetadata: { turnNumber, priorToolResults },
    });
    return { turnNumber, priorToolResults, fromState: 'provider_continuation' };
  }

  throw new UnresolvableAttemptHistoryError(`Gemini driver: resolveTurnInput called with unsupported attempt state ${attempt.state}`);
}

/**
 * Only calls session-level completion acceptance when this driver can
 * produce the exact evidence shape the session's policy requires. See the
 * session-completion scope note in the file header.
 */
async function tryAcceptSessionCompletion(
  session: CoordinationV2Session,
  attempt: CoordinationV2Attempt,
  responseDigest: string,
  turnNumber: number,
  actorId: string,
  now: Date,
): Promise<void> {
  const required = session.completionCriteria?.requiredCompletionEvidence;
  if (!Array.isArray(required) || required.length !== 1 || required[0] !== 'digest') {
    console.warn(
      `[CoordinationGeminiDriver] attempt ${attempt.id} completed but session ${session.id}'s ` +
      `completionCriteria.requiredCompletionEvidence (${JSON.stringify(required)}) is not the ` +
      "driver-supported ['digest'] shape -- leaving session-level completion for a human or another caller.",
    );
    return;
  }
  try {
    // accept_completion is only valid from the session's 'verifying' state
    // (coordination-session-state.ts); begin_verification is the only path
    // into it from 'running'. transitionCoordinationSession's own requestKey
    // replay-protection makes this safe to call even if some other caller
    // already moved the session into 'verifying' by the time this runs.
    await transitionCoordinationSession({
      sessionId: session.id, actorId, now,
      requestKey: requestKey(attempt.id, `t${turnNumber}-begin-verification`),
      command: { type: 'begin_verification' },
    });
    await acceptCoordinationCompletion({
      sessionId: session.id, actorId, now,
      requestKey: requestKey(attempt.id, `t${turnNumber}-accept-completion`),
      evidence: [{
        type: 'digest',
        reference: `attempt:${attempt.id}:turn:${turnNumber}:gemini-response`,
        digest: responseDigest,
      }],
    });
  } catch (error) {
    // The attempt itself already completed successfully; a failure here only
    // means the session-level acceptance step needs a retry. runGeminiProviderDriverBatch
    // calls retryPendingGeminiSessionCompletions on every pass specifically to re-drive
    // this exact step for attempts stuck in this state, so re-throwing here is
    // unnecessary -- logging and returning lets that separate sweep pick it back up.
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[CoordinationGeminiDriver] attempt ${attempt.id} completed but session-level ` +
      `acceptCoordinationCompletion failed (will retry on a later pass): ${message}`,
    );
  }
}

async function callTurnAndAdvance(
  session: CoordinationV2Session,
  attempt: CoordinationV2Attempt,
  actorId: string,
  input: ResolvedInput,
  now: Date,
): Promise<void> {
  const { turnNumber, priorToolResults, fromState } = input;

  if (turnNumber > MAX_TURN) {
    // CoordinationGeminiAdapter.turn() itself throws for turn outside [1,4];
    // treat exceeding the approved turn budget as a limit_exhausted provider
    // failure (always a terminal_failure per mapProviderFailure, regardless
    // of policy fallback eligibility -- retrying a fresh attempt would just
    // hit the same cap again). fail works from any non-terminal state, so
    // this is safe whether fromState is provider_active or
    // provider_continuation.
    await applyCoordinationProviderFailure({
      sessionId: session.id, attemptId: attempt.id, actorId,
      requestKey: requestKey(attempt.id, `t${turnNumber}-turn-cap`),
      failure: { kind: 'limit_exhausted', detail: `Gemini turn cap (${MAX_TURN}) reached before a natural finish` },
      expectedFromState: fromState,
    });
    return;
  }

  const toolTargets = await loadSessionToolTargets(session);
  const packet = buildAttemptPacket(session, attempt, toolTargets);
  let results: GeminiTurnResult[];
  try {
    results = await geminiAdapter().turn(packet, turnNumber, priorToolResults, toolTargets);
  } catch (error) {
    if (await attemptMovedOn(attempt.id, fromState)) return;
    const message = error instanceof Error ? error.message : String(error);
    await applyCoordinationProviderFailure({
      sessionId: session.id, attemptId: attempt.id, actorId,
      requestKey: requestKey(attempt.id, `t${turnNumber}-turn-threw`),
      failure: { kind: 'terminal_rejection', detail: `adapter.turn() threw: ${message}` },
      expectedFromState: fromState,
    });
    return;
  }
  // A GeminiTurnResult[] can have length 2 (a retryable failure followed by a
  // retry within the same turn() call) -- the last entry is the one that
  // actually happened.
  const last = results[results.length - 1];

  // Concurrency fence: turn() is a slow, real network call, and resolveTurnInput's
  // read of provider_active/provider_continuation is a pure read with no claiming
  // transition (see the file header's crash-safety note). Under autoscale with more
  // than one instance -- or any other overlapping pass -- a second instance can read
  // this same attempt in the same state and call turn() concurrently. Whichever call
  // resolves last would otherwise apply its outcome on top of a state the attempt has
  // already moved past; for the fail command specifically, which is deliberately valid
  // from any non-terminal state, a stale losing racer's failure can silently clobber an
  // already-recorded success (observed for real, task #1642 live demo, 2026-09-29: a
  // successful intent_ready/waiting_for_host attempt was clobbered back into
  // retryable_failed by a slower duplicate turn() call for the same turn). Re-checking
  // the attempt's current state right after the call returns, before applying anything,
  // makes the loser discard its own result instead of overwriting the winner's.
  if (await attemptMovedOn(attempt.id, fromState)) return;

  if (last.outcome !== 'consumed') {
    await applyCoordinationProviderFailure({
      sessionId: session.id, attemptId: attempt.id, actorId,
      requestKey: requestKey(attempt.id, `t${turnNumber}-failure`),
      failure: mapOutcomeToFailure(last),
      expectedFromState: fromState,
    });
    return;
  }

  if (last.intents.length > 0) {
    // Only ever act on the first intent -- the transport/result schema keeps
    // exactly one pending tool call at a time (coordinationV2TransportWork
    // Results.result is a single jsonb object, and intent_ready is a single
    // state, not indexed by intent), so any additional intents in the same
    // turn are dropped rather than acted on.
    const intent = last.intents[0];
    if (fromState === 'provider_continuation') {
      await transitionCoordinationAttempt({
        attemptId: attempt.id, actorId, now,
        requestKey: requestKey(attempt.id, `t${turnNumber}-provider-resumed`),
        command: { type: 'provider_resumed' },
        expectedFromState: fromState,
        // Without this, a crash right after this transition commits (before
        // the intent_ready call below also commits) leaves provider_active
        // as the latest state with provider_resumed as its latest
        // substantive event, and resolveTurnInput's recovery branch for
        // exactly that case (event.eventType === 'provider_resumed') calls
        // readDriverContext(event), which throws UnresolvableAttemptHistoryError
        // when this metadata is missing -- turning a transient crash into a
        // permanently stuck attempt instead of a resumable one. Carrying the
        // same {turnNumber, priorToolResults} this turn() call was itself
        // given (this function's own `input`) is exactly what that recovery
        // branch needs to safely retry the same turn.
        eventMetadata: { turnNumber, priorToolResults },
      });
    }
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now,
      requestKey: requestKey(attempt.id, `t${turnNumber}-intent-ready`),
      command: { type: 'intent_ready' },
      eventMetadata: { turnNumber, callId: intent.callId, name: intent.name },
      expectedFromState: 'provider_active',
    });
    await transitionCoordinationAttempt({
      attemptId: attempt.id, actorId, now,
      requestKey: requestKey(attempt.id, `t${turnNumber}-host-wait`),
      command: { type: 'host_wait' },
      expectedFromState: 'intent_ready',
    });
    return;
  }

  // Zero intents. A legitimate natural finish is only reachable from
  // provider_continuation (turn >= 2, i.e. complete is a valid transition
  // from here): the state machine has no complete-from-provider_active path,
  // and turn 1's packet instruction demands a tool call, so a text-only
  // response there is a protocol violation, not a finish.
  if (fromState !== 'provider_continuation') {
    await applyCoordinationProviderFailure({
      sessionId: session.id, attemptId: attempt.id, actorId,
      requestKey: requestKey(attempt.id, `t${turnNumber}-failure`),
      failure: {
        kind: 'malformed_response',
        detail: 'model produced a text-only response with no tool call while the protocol required one',
      },
      expectedFromState: fromState,
    });
    return;
  }

  await transitionCoordinationAttempt({
    attemptId: attempt.id, actorId, now,
    requestKey: requestKey(attempt.id, `t${turnNumber}-complete`),
    // AttemptTransitionInput's command type collapses AttemptCommand's union
    // via Omit<AttemptCommand, ...>, which (a known TS limitation: Omit does
    // not distribute over unions) erases every field but the shared
    // discriminant `type`, hence this narrow, still fully type-checked cast
    // rather than a blind `as any` (see verify-gemini-v2-adapter-live.ts for
    // the same pre-existing workaround on the one other real caller).
    command: { type: 'complete', resultCode: 'gemini_natural_finish' } as Extract<AttemptCommand, { type: 'complete' }>,
    expectedFromState: fromState,
    // Persisted so retryPendingGeminiSessionCompletions can re-derive the
    // exact evidence tryAcceptSessionCompletion needs without re-calling the
    // provider, if the session-acceptance call below fails transiently and
    // this attempt is picked up again on a later pass instead of this one
    // (see that function's doc comment for why OPEN_ATTEMPT_STATES alone
    // can't cover a retry here).
    eventMetadata: { turnNumber, responseDigest: last.responseDigest },
  });
  await tryAcceptSessionCompletion(session, attempt, last.responseDigest, turnNumber, actorId, now);
}

async function processGeminiAttempt(attempt: CoordinationV2Attempt): Promise<void> {
  const now = new Date();
  const sessionRows = await db.select().from(coordinationV2Sessions)
    .where(eq(coordinationV2Sessions.id, attempt.sessionId));
  const session = sessionRows[0];
  if (!session) throw new Error(`Gemini driver: attempt ${attempt.id} references missing session ${attempt.sessionId}`);
  const actorId = session.operatorActor;
  let input: ResolvedInput | null;
  try {
    input = await resolveTurnInput(session, attempt, actorId, now);
  } catch (error) {
    if (!(error instanceof UnresolvableAttemptHistoryError)) throw error;
    // Structural, not transient -- the exact same read fails identically on
    // every future poll. Fail the attempt outright rather than leaving it to
    // spam this same error on every batch forever (see the class doc).
    await applyCoordinationProviderFailure({
      sessionId: session.id, attemptId: attempt.id, actorId,
      requestKey: requestKey(attempt.id, 'unresolvable-history'),
      failure: { kind: 'malformed_response', detail: error.message },
      expectedFromState: attempt.state,
    });
    return;
  }
  if (!input) return;
  await callTurnAndAdvance(session, attempt, actorId, input, now);
}

const TERMINAL_SESSION_STATES = ['succeeded', 'failed', 'exhausted', 'expired', 'revoked'] as const;

/**
 * Processes up to `limit` open Gemini attempts, oldest-updated first. Safe to
 * call repeatedly and concurrently with itself: every state transition goes
 * through transitionCoordinationAttempt's own row locking and requestKey
 * replay-protection, so a losing racer simply gets a rejection this module
 * logs and moves past, not a corrupted attempt.
 *
 * Joins the session and excludes anything whose session already reached a
 * terminal state, whose session is already past its expiresAt, or whose own
 * deadlineAt has already passed. None of these are attempts this driver can
 * make progress on -- authorizeCoordinationLifecycleInTransaction and
 * defaultProviderFailureAuthority reject all three preconditions identically
 * -- and nothing in the system today proactively sweeps a session into the
 * terminal 'expired' state purely because its expiresAt has passed (that is
 * a separate, real gap: see the expiry-reaper follow-up). Without this
 * filter, a session that goes quietly past its expiry while an attempt sits
 * open (observed for real with a leftover attempt from task #1639's manual
 * testing) would be re-selected and re-rejected identically on every single
 * poll forever.
 */
export async function runGeminiProviderDriverBatch(limit = 10): Promise<{ processed: number; errors: number }> {
  const now = new Date();
  const rows = await db.select({ attempt: coordinationV2Attempts }).from(coordinationV2Attempts)
    .innerJoin(coordinationV2Sessions, eq(coordinationV2Attempts.sessionId, coordinationV2Sessions.id))
    .where(and(
      eq(coordinationV2Attempts.provider, 'gemini'),
      inArray(coordinationV2Attempts.state, [...OPEN_ATTEMPT_STATES]),
      notInArray(coordinationV2Sessions.state, [...TERMINAL_SESSION_STATES]),
      gt(coordinationV2Sessions.expiresAt, now),
      gt(coordinationV2Attempts.deadlineAt, now),
    ))
    .orderBy(coordinationV2Attempts.updatedAt)
    .limit(limit);
  const attempts = rows.map((row) => row.attempt);
  let errors = 0;
  for (const attempt of attempts) {
    try {
      // eslint-disable-next-line no-await-in-loop -- attempts must be processed sequentially, not fanned out.
      await processGeminiAttempt(attempt);
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CoordinationGeminiDriver] attempt ${attempt.id} failed: ${message}`);
    }
  }
  // eslint-disable-next-line no-await-in-loop -- a small, separate sweep; sequencing after the main batch keeps logs readable.
  const retried = await retryPendingGeminiSessionCompletions(limit);
  return { processed: attempts.length + retried.processed, errors: errors + retried.errors };
}

/**
 * Re-drives the one step callTurnAndAdvance's own natural-finish path can
 * leave stuck: the attempt is already `completed` (a real, correct, terminal
 * attempt outcome -- nothing about the Gemini turn itself needs retrying),
 * but the *session*-level acceptCoordinationCompletion() call that should
 * follow it threw (transient database error, a concurrent session-state
 * transition, etc.) and tryAcceptSessionCompletion only logs that, it does
 * not retry.
 *
 * OPEN_ATTEMPT_STATES deliberately excludes 'completed' (a completed attempt
 * is not itself open work), so runGeminiProviderDriverBatch's main query
 * above never re-selects it and this failure is otherwise invisible until
 * something else notices the session never finished. Selecting distinctly
 * scoped to state='completed' + resultCode='gemini_natural_finish' + a
 * non-terminal session is exactly the "session-level step still pending"
 * signature.
 *
 * Re-derives {turnNumber, responseDigest} from the attempt's own
 * attempt_completed event rather than re-calling the provider -- the turn
 * already happened and produced a real, terminal, successful result; this
 * sweep's job is only to make sure the session finds out about it.
 */
export async function retryPendingGeminiSessionCompletions(limit = 10): Promise<{ processed: number; errors: number }> {
  const now = new Date();
  const rows = await db.select({ attempt: coordinationV2Attempts, session: coordinationV2Sessions })
    .from(coordinationV2Attempts)
    .innerJoin(coordinationV2Sessions, eq(coordinationV2Attempts.sessionId, coordinationV2Sessions.id))
    .where(and(
      eq(coordinationV2Attempts.provider, 'gemini'),
      eq(coordinationV2Attempts.state, 'completed'),
      eq(coordinationV2Attempts.resultCode, 'gemini_natural_finish'),
      notInArray(coordinationV2Sessions.state, [...TERMINAL_SESSION_STATES]),
    ))
    .orderBy(coordinationV2Attempts.updatedAt)
    .limit(limit);
  let errors = 0;
  for (const row of rows) {
    try {
      const event = await latestEvent(row.attempt.id, 'attempt_completed');
      const { turnNumber, responseDigest } = readCompletedContext(event);
      const actorId = row.session.operatorActor;
      // eslint-disable-next-line no-await-in-loop -- retries must be processed sequentially, not fanned out.
      await tryAcceptSessionCompletion(row.session, row.attempt, responseDigest, turnNumber, actorId, now);
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CoordinationGeminiDriver] retrying session completion for attempt ${row.attempt.id} failed: ${message}`);
    }
  }
  return { processed: rows.length, errors };
}

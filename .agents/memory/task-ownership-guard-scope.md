---
name: Task-ownership guard scope gap
description: unknown_stop-based infra-mutation guards only gate what they actually, verifiably check; a guard that looks correct in dev can still admit every call (or refuse every call) in production.
---

**The gap:** GitHubSpecPublisher.publish() executes real GitHub REST calls
using a token baked in at construction, with no actor/task identity check in
the call path -- a blocked task holding a constructed publisher (or its bare
token) could still push a branch and open a real PR. CloudflareDnsService had
the same shape of gap earlier and was closed the same way. As of the last
review pass, GitHub publish is NOT yet actually closed in production -- see
the two confirmed defects below before trusting or extending this guard.

**The actor/capability pattern for a portable provider that must stay
host-neutral:** a provider file kept free of host-specific imports (Replit,
task ownership, connectors) still needs gating. Shape: (1) the portable
interface's mutating method takes a context carrying both the caller's scope
(e.g. taskRef) and the caller's already-authenticated actor id, with the
actor id injected by the authenticated service layer -- never accepted from
caller-supplied request data -- so a caller can name a task but can't claim
to *be* a different actor; (2) the concrete provider's config takes a
mandatory, injected `authorizeMutation(context, action)` hook called before
any network call, so construction fails fast without one; (3) the real
policy lives in its own small file importing only generic ownership-guard
primitives, wired in by the host composition layer. This part of the pattern
held up under review.

**Two ways a guard can look correct in dev and still not gate anything in
production -- both missed by full local test/typecheck/CI runs and caught
only by completion code review:**
1. A verifier that proves identity by reading a workspace-relative file path
   (e.g. anything under `.local/`) works in the dev container, and in test
   fixtures that create the same path -- but a gitignored directory is
   absent from any deployed build. A production process hitting that check
   gets a permanent "not found," so the guard fails the same way for every
   call, not just the blocked-task calls it was supposed to distinguish.
   Before trusting a guard, confirm its evidence source is actually present
   in the deployed runtime -- not just in the dev container and its own test
   fixtures, which can both unwittingly recreate a dev-only assumption.
2. A DB row's "active" status can mean "approved," not "fully proven." This
   codebase's task-ownership receipts go `active` the moment a founder
   approves a challenge -- *before* the separate nonce/signature
   proof-of-possession step ever runs -- and nothing links a later
   successful proof back onto the receipt row. Checking only
   `status === 'active'` therefore treats "someone with approval authority
   said yes" as equivalent to "the requester proved they hold the private
   key," which is a different and stronger claim. When a status field is set
   at an earlier lifecycle step than the guarantee you actually need, reading
   that status alone silently drops every later step's guarantee.

**Ruled out (not gaps):** the source-control scheduler's wake-file poller and
Alden's code-review sync are not reachable with a task-held credential, so
they don't need the same gating.
